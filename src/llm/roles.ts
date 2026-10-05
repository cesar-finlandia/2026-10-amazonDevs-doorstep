// Requirement IDs: FR-18, FR-21, NFR-03
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { withResilience, isDegradedResult, makeDegradedResult, createGoldenCache } from "src/resilience";
import type { DegradedResult, GoldenCache, ResilienceConfig } from "src/resilience";
import type { GenerateRequest, GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
import { ROLE_MODEL_TIER, ROLE_SCHEMAS } from "src/agent/schemas.js";
import type { RoleName, RoleInput, RoleOutput } from "src/agent/schemas.js";
import { EXTRACTOR_PROMPT } from "src/prompts/extractor.js";
import { PLANNER_PROMPT } from "src/prompts/planner.js";
import { NARRATOR_PROMPT } from "src/prompts/narrator.js";
import { PROMPT_VERSION } from "src/prompts/index.js";
import type { BedrockClient } from "src/llm/bedrock-client.js";
import type { StrandsAdapter } from "src/llm/strands-adapter.js";
import type { CostClient, Usage3 } from "src/llm/cost.js";
import type { VertexFallback } from "src/llm/vertex-fallback.js";

export type TransportKind = "bedrock" | "vertex-fallback" | "golden" | "manual";
export interface RoleCtx { round: number; key: string /* unique per call, e.g. "extractor-1"; the golden-cache key suffix */; signal?: AbortSignal }
export type RoleOutcome<R extends RoleName> =
  | { ok: true; output: RoleOutput[R]; model: string; kind: TransportKind; usage: { promptTokens: number; outputTokens: number; totalTokens: number }; latencyMs: number }
  | { ok: false; degraded: DegradedResult; kind: TransportKind };
export type RoleRunners = { [R in RoleName]: (input: RoleInput[R], ctx: RoleCtx) => Promise<RoleOutcome<R>> };
export interface RoleDeps {
  models: { fast: string; balanced: string };
  region?: string;
  strands?: StrandsAdapter;
  bedrock: BedrockClient;          // the Converse forced-tool fallback runner uses it
  vertex?: VertexFallback;        // labelled secondary provider, used only when allowFallback
  allowFallback: boolean;
  cost: CostClient;
  cache?: GoldenCache;
  recordGolden?: boolean;                                              // write each successful output to the cache (WU-09)
  resilience?: ResilienceConfig;
}

const PROMPTS: Record<RoleName, string> = {
  extractor: EXTRACTOR_PROMPT,
  planner: PLANNER_PROMPT,
  narrator: NARRATOR_PROMPT,
};
const MAX_TOKENS: Record<RoleName, number> = { extractor: 8192, planner: 1500, narrator: 600 };

interface Tagged {
  via: "primary" | "secondary" | "recorded";
  value: unknown;
  model: string;
  usage: Usage3;
  latencyMs: number;
}

let narratorSuffix: string | null = null;
function narratorBannedLine(): string {
  if (narratorSuffix === null) {
    let patterns = "";
    try {
      const raw = JSON.parse(readFileSync(join(process.cwd(), "config", "banned-patterns.json"), "utf8")) as {
        patterns: { pattern: string }[];
      };
      patterns = raw.patterns.map((p) => p.pattern).join(", ");
    } catch {
      patterns = "";
    }
    narratorSuffix = `\nNever use words that match any of these patterns: ${patterns}.`;
  }
  return narratorSuffix;
}

/** The vendored GoldenCache addresses entries by 64-hex hashes, so the plan's
 *  readable keys ("doorstep-role-<key>") are hashed with deriveKey and the
 *  readable form is kept in the entry's explicit_key metadata. */
export function goldenReadableKey(suffix: string): string {
  return `doorstep-role-${suffix}`;
}

function sumUsage(a: Usage3, b?: Usage3): Usage3 {
  return {
    promptTokens: a.promptTokens + (b?.promptTokens ?? 0),
    outputTokens: a.outputTokens + (b?.outputTokens ?? 0),
    totalTokens: a.totalTokens + (b?.totalTokens ?? 0),
  };
}

function extractJson(res: GenerateResult): { json: unknown; usage: Usage3 } {
  if (!res.ok) throw new Error(`model call failed: ${res.reason}: ${res.detail}`);
  if (res.json !== undefined) return { json: res.json, usage: res.usage };
  const text = res.text.trim();
  try {
    return { json: JSON.parse(text) as unknown, usage: res.usage };
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return { json: JSON.parse(text.slice(start, end + 1)) as unknown, usage: res.usage };
      } catch {
        /* fall through */
      }
    }
    throw new Error(`model reply was not JSON: ${text.slice(0, 200)}`);
  }
}

export function createRoleRunners(deps: RoleDeps): RoleRunners {
  // Key derivation needs a cache instance; when the caller passes none, use an
  // unrooted throwaway purely for its pure deriveKey (no writes ever happen).
  const keyCache: GoldenCache = deps.cache ?? createGoldenCache(join(process.cwd(), ".cache", "golden-unused"));
  const keyFor = (ctxKey: string): string => keyCache.deriveKey({ explicitKey: goldenReadableKey(ctxKey) });

  function runner<R extends RoleName>(role: R): (input: RoleInput[R], ctx: RoleCtx) => Promise<RoleOutcome<R>> {
    const schema = ROLE_SCHEMAS[role];
    const tier = ROLE_MODEL_TIER[role];
    const modelId = tier === "fast" ? deps.models.fast : deps.models.balanced;
    const maxTokens = MAX_TOKENS[role];
    const jsonSchema = z.toJSONSchema(schema) as unknown as Record<string, unknown>;
    const baseSystem = PROMPTS[role];
    const region = deps.region;

    /** Converse forced-tool runner shared by the primary fallback and the vertex secondary. */
    async function forcedTool(
      generate: (req: GenerateRequest) => Promise<GenerateResult>,
      userText: string,
      system: string,
    ): Promise<{ value: unknown; usage: Usage3 }> {
      const first = await generate({
        system,
        contents: [{ role: "user", parts: [{ text: userText }] }],
        responseSchema: jsonSchema,
        temperature: 0,
      });
      let usage = first.ok ? first.usage : { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
      let parsed: ReturnType<typeof schema.safeParse>;
      try {
        parsed = schema.safeParse(extractJson(first).json);
      } catch (e) {
        parsed = { success: false, error: { issues: [{ path: [], message: (e as Error).message }] } } as unknown as ReturnType<typeof schema.safeParse>;
      }
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${String(i.path.join("."))}: ${i.message}`).join("; ");
        const second = await generate({
          system,
          contents: [
            { role: "user", parts: [{ text: `${userText}\n\nYour previous JSON failed validation: ${issues}. Return corrected JSON only.` }] },
          ],
          responseSchema: jsonSchema,
          temperature: 0,
        });
        usage = sumUsage(usage, second.ok ? second.usage : undefined);
        let reparsed: ReturnType<typeof schema.safeParse>;
        try {
          reparsed = schema.safeParse(extractJson(second).json);
        } catch (e) {
          throw new Error(`structured output failed validation: ${(e as Error).message}`);
        }
        if (!reparsed.success) {
          const issues2 = reparsed.error.issues.map((i) => `${String(i.path.join("."))}: ${i.message}`).join("; ");
          throw new Error(`structured output failed validation: ${issues2}`);
        }
        return { value: reparsed.data, usage };
      }
      return { value: parsed.data, usage };
    }

    return async (input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R>> => {
      const system = role === "narrator" ? baseSystem + narratorBannedLine() : baseSystem;
      const user = JSON.stringify(input);

      const primary = async (): Promise<Tagged> => {
        const started = Date.now();
        const { result } = await deps.cost.guard({ provider: "bedrock", label: role, model: modelId }, async () => {
          if (deps.strands) {
            const s = await deps.strands.run({ system, user, schema, modelId, region, maxTokens, signal: ctx.signal });
            if (s.ok) {
              const value = schema.parse(s.output);
              const out = { value, model: modelId, usage: s.usage, latencyMs: Date.now() - started };
              return { result: out, usage: s.usage };
            }
          }
          const conv = await forcedTool((req) => deps.bedrock.generate(req), user, system);
          const out = { value: conv.value, model: modelId, usage: conv.usage, latencyMs: Date.now() - started };
          return { result: out, usage: conv.usage };
        });
        return { via: "primary", ...result };
      };

      const secondary = async (): Promise<Tagged> => {
        const vertex = deps.vertex;
        if (!vertex) throw new Error("vertex fallback is not configured");
        const started = Date.now();
        const { result } = await deps.cost.guard(
          { provider: "vertex", label: role, model: vertex.modelId !== "" ? vertex.modelId : "vertex-fallback" },
          async () => {
            const conv = await forcedTool((req) => vertex.generate(req), user, system);
            const resolved = vertex.modelId !== "" ? vertex.modelId : "vertex-fallback";
            const out = { value: conv.value, model: resolved, usage: conv.usage, latencyMs: Date.now() - started };
            return { result: out, usage: conv.usage };
          },
        );
        return { via: "secondary", ...result };
      };

      const wrapped = withResilience(primary, {
        timeout_ms: 45000,
        retries: 1,
        backoff: { base_ms: 500 },
        cache_key_strategy: "explicit",
        cache_key_explicit: keyFor(ctx.key),
        fallback_chain: {
          order: ["secondary_provider", "cache", "none"],
          secondary_provider: { enabled: deps.allowFallback && !!deps.vertex },
          cache: { enabled: true },
        },
        ...deps.resilience,
      }, { secondaryProvider: secondary, cache: deps.cache });

      const r = await wrapped();
      if (isDegradedResult(r)) return { ok: false, degraded: r, kind: "bedrock" };
      const tagged = r as Tagged;
      const checked = schema.safeParse(tagged.value);
      if (!checked.success) {
        return {
          ok: false,
          degraded: makeDegradedResult({ reason: "golden_entry_invalid", fallback_source: "cache" }),
          kind: "bedrock",
        };
      }
      if (deps.recordGolden && deps.cache && (tagged.via === "primary" || tagged.via === "secondary")) {
        await deps.cache.put(
          keyFor(ctx.key),
          {
            via: "recorded",
            value: tagged.value,
            model: tagged.model,
            usage: tagged.usage,
            latencyMs: tagged.latencyMs,
            provider: tagged.via === "primary" ? "bedrock" : "vertex-fallback",
            promptVersion: PROMPT_VERSION,
          },
          {
            provider: tagged.via === "primary" ? "bedrock" : "vertex-fallback",
            model: tagged.model,
            source: "recorded",
            explicit_key: goldenReadableKey(ctx.key),
          },
        );
      }
      const kind: TransportKind =
        tagged.via === "primary" ? "bedrock" : tagged.via === "secondary" ? "vertex-fallback" : "golden";
      return {
        ok: true,
        output: checked.data as RoleOutput[R],
        model: tagged.model,
        kind,
        usage: tagged.usage,
        latencyMs: tagged.latencyMs,
      };
    };
  }

  return { extractor: runner("extractor"), planner: runner("planner"), narrator: runner("narrator") };
}
