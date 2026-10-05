// Requirement IDs: FR-21
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StepFn } from "src/kits/agent-workflow/src/adapters/inApp.js";
import type { StepBody, StepResult } from "src/kits/agent-workflow/src/server/stepHandler.js";
import { handleAgentStep } from "src/kits/agent-workflow/src/server/stepHandler.js";
import type { GoldenCache, ResilienceConfig } from "src/resilience";
import { createGoldenCache, isDegradedResult, makeDegradedResult, withResilience } from "src/resilience";
import type { TraceWriter } from "src/kits/agent-workflow/src/trace/types.js";
import type { Content } from "src/kits/agent-workflow/src/llm/types.js";
import type { RoleName, RoleInput } from "src/agent/schemas.js";
import { ROLE_SCHEMAS } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome, RoleRunners, TransportKind } from "src/llm/roles.js";
import type { BedrockClient } from "src/llm/bedrock-client.js";
import type { VertexFallback } from "src/llm/vertex-fallback.js";
import { FALLBACK_LABEL } from "src/llm/vertex-fallback.js";
import type { CostClient, Usage3 } from "src/llm/cost.js";
import { fitTurns } from "src/llm/context.js";
import { PROMPT_VERSION } from "src/prompts/index.js";

export interface AgentTransport {
  readonly kind: TransportKind;
  readonly label: string;                 // "Amazon Bedrock · <model id>" | FALLBACK_LABEL | "Recorded run" | "Manual"
  model(): string;
  role<R extends RoleName>(role: R, input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R>>;
  step: StepFn;                           // the actor's tool-use turn: kit handleAgentStep semantics
}
export interface InProcessDeps {
  roles: RoleRunners; bedrock: BedrockClient;
  vertex?: VertexFallback; allowFallback: boolean;
  cost: CostClient; cache?: GoldenCache; recordGolden?: boolean;
  resilience?: ResilienceConfig;
  trace?: TraceWriter;                    // receives the context_fit system entry when fitTurns evicts
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function hashTurn(turn: Content): string {
  return createHash("sha256").update(JSON.stringify(turn)).digest("hex");
}

interface StepTagged {
  via: "primary" | "secondary" | "recorded";
  value: StepResult;
  inputHash: string;
  model: string;
}

/** Rung 1/2. step = handleAgentStep(body, client) wrapped by withResilience + fitTurns + cost; client = Bedrock, or the labelled Vertex fallback
 *  once Bedrock returned a DegradedResult and allowFallback is true. kind switches from "bedrock" to "vertex-fallback" at that moment. */
export function createInProcessTransport(deps: InProcessDeps): AgentTransport & { onRungChange(fn: (kind: TransportKind, label: string) => void): void } {
  let kind: TransportKind = "bedrock";
  let currentModel = deps.bedrock.modelId;
  let stepCounter = 0;
  // Key derivation needs a cache instance; without one use a throwaway (puts
  // are skipped then, lookups hit the wrapper default which stays empty here).
  const keyCache: GoldenCache = deps.cache ?? createGoldenCache(join(process.cwd(), ".cache", "golden-unused"));
  const keyFor = (readable: string): string => keyCache.deriveKey({ explicitKey: readable });
  const listeners = new Set<(kind: TransportKind, label: string) => void>();

  function labelFor(k: TransportKind): string {
    if (k === "bedrock") return `Amazon Bedrock · ${deps.bedrock.modelId}`;
    if (k === "vertex-fallback") return FALLBACK_LABEL;
    if (k === "golden") return "Recorded run";
    return "Manual";
  }

  function setKind(next: TransportKind): void {
    if (next === kind) return;
    kind = next;
    if (next === "vertex-fallback" && deps.vertex) currentModel = deps.vertex.modelId;
    const label = labelFor(next);
    for (const fn of listeners) fn(next, label);
  }

  async function role<R extends RoleName>(role: R, input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R>> {
    return deps.roles[role](input, ctx);
  }

  const step: StepFn = async (body: StepBody) => {
    const n = ++stepCounter;
    const fitted = fitTurns(body.contents);
    if (fitted.evicted > 0 && deps.trace) {
      deps.trace.record({
        round: 0, kind: "system", name: "context_fit", source: "agent",
        input_ref: null, output_ref: `${fitted.evicted} turns evicted`, ok: true, latency_ms: 0,
      });
    }
    const last = fitted.contents[fitted.contents.length - 1] as Content;
    const inputHash = hashTurn(last);

    const primary = async (): Promise<StepTagged> => {
      const { result } = await deps.cost.guard({ provider: "bedrock", label: "actor", model: deps.bedrock.modelId }, async () => {
        const started = Date.now();
        const out = await handleAgentStep({ system: body.system, contents: fitted.contents, tools: body.tools }, deps.bedrock);
        if (!out.ok) throw new Error(out.message);
        const usage: Usage3 = {
          promptTokens: out.result.usage.promptTokens,
          outputTokens: out.result.usage.outputTokens,
          totalTokens: out.result.usage.totalTokens,
        };
        return { result: { value: out.result, model: deps.bedrock.modelId }, usage, latencyMs: Date.now() - started };
      });
      return { via: "primary", value: result.value, inputHash, model: result.model };
    };

    const secondary = async (): Promise<StepTagged> => {
      const vertex = deps.vertex;
      if (!vertex) throw new Error("vertex fallback is not configured");
      const { result } = await deps.cost.guard({ provider: "vertex", label: "actor", model: vertex.modelId !== "" ? vertex.modelId : "vertex-fallback" }, async () => {
        const started = Date.now();
        const out = await handleAgentStep({ system: body.system, contents: fitted.contents, tools: body.tools }, { generate: (req) => vertex.generate(req) });
        if (!out.ok) throw new Error(out.message);
        const usage: Usage3 = {
          promptTokens: out.result.usage.promptTokens,
          outputTokens: out.result.usage.outputTokens,
          totalTokens: out.result.usage.totalTokens,
        };
        const resolved = vertex.modelId !== "" ? vertex.modelId : "vertex-fallback";
        return { result: { value: out.result, model: resolved }, usage, latencyMs: Date.now() - started };
      });
      return { via: "secondary", value: result.value, inputHash, model: result.model };
    };

    const wrapped = withResilience(primary, {
      timeout_ms: 60000,
      retries: 1,
      cache_key_strategy: "explicit",
      cache_key_explicit: keyFor(`doorstep-step-${pad3(n)}`),
      fallback_chain: {
        order: ["secondary_provider", "cache", "none"],
        secondary_provider: { enabled: deps.allowFallback && !!deps.vertex },
        cache: { enabled: true },
      },
      ...deps.resilience,
    }, { secondaryProvider: secondary, cache: deps.cache });

    const r = await wrapped();
    if (isDegradedResult(r)) {
      return { ok: false, status: 502, message: "The model is not reachable right now." };
    }
    const tagged = r as StepTagged;
    if (tagged.via === "secondary") setKind("vertex-fallback");
    else if (tagged.via === "recorded") setKind("golden");
    if (deps.recordGolden && deps.cache && (tagged.via === "primary" || tagged.via === "secondary")) {
      await deps.cache.put(
        keyFor(`doorstep-step-${pad3(n)}`),
        {
          via: "recorded", value: tagged.value, inputHash: tagged.inputHash,
          model: tagged.model, provider: tagged.via === "primary" ? "bedrock" : "vertex-fallback",
          promptVersion: PROMPT_VERSION,
        },
        {
          provider: tagged.via === "primary" ? "bedrock" : "vertex-fallback",
          model: tagged.model, source: "recorded", explicit_key: `doorstep-step-${pad3(n)}`,
        },
      );
    }
    return { ok: true, result: tagged.value };
  };

  return {
    get kind(): TransportKind {
      return kind;
    },
    get label(): string {
      return labelFor(kind);
    },
    model: () => currentModel,
    role,
    step,
    onRungChange(fn: (kind: TransportKind, label: string) => void): void {
      listeners.add(fn);
    },
  };
}

/** Rung 3. Replays data/golden-cache entries in recorded order; kind "golden", label "Recorded run". */
export function createGoldenTransport(opts?: { cache?: GoldenCache; dir?: string }): AgentTransport & { remaining(): number; drift(): number } {
  const rootDir = opts?.dir ?? join(process.cwd(), "data", "golden-cache");
  const cache: GoldenCache = opts?.cache ?? createGoldenCache(rootDir);
  // Synchronously preload the readable-key index so remaining() stays sync:
  // golden-index.json maps hashed keys to their explicit_key readable form.
  let stepTotal: number | null = null;
  try {
    const indexRaw = JSON.parse(readFileSync(join(rootDir, "golden-index.json"), "utf8")) as {
      entries?: Record<string, { explicit_key?: string }>;
    };
    const entries = indexRaw.entries ?? {};
    stepTotal = Object.values(entries).filter((e) => /^doorstep-step-\d+$/.test(e.explicit_key ?? "")).length;
  } catch {
    stepTotal = null;
  }
  let served = 0;
  let drifts = 0;

  function stepKey(n: number): string {
    return cache.deriveKey({ explicitKey: `doorstep-step-${pad3(n)}` });
  }
  function roleKey(key: string): string {
    return cache.deriveKey({ explicitKey: `doorstep-role-${key}` });
  }

  async function role<R extends RoleName>(role: R, _input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R>> {
    const stored = await cache.get(roleKey(ctx.key)) as {
      via?: string; value?: unknown; model?: string; usage?: Usage3; latencyMs?: number;
    } | null;
    if (!stored || typeof stored !== "object" || !("value" in stored)) {
      return {
        ok: false,
        degraded: makeDegradedResult({ reason: "golden_cache_miss", fallback_source: "none" }),
        kind: "golden",
      };
    }
    const checked = ROLE_SCHEMAS[role].safeParse(stored.value);
    if (!checked.success) {
      return {
        ok: false,
        degraded: makeDegradedResult({ reason: "golden_entry_invalid", fallback_source: "cache" }),
        kind: "golden",
      };
    }
    return {
      ok: true,
      output: checked.data as never,
      model: typeof stored.model === "string" ? stored.model : "recorded",
      kind: "golden",
      usage: stored.usage ?? { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      latencyMs: typeof stored.latencyMs === "number" ? stored.latencyMs : 0,
    };
  }

  const step: StepFn = async (body: StepBody) => {
    const n = served + 1;
    if (stepTotal !== null && n > stepTotal) {
      return { ok: false, status: 502, message: "The recorded run has no further steps." };
    }
    const stored = await cache.get(stepKey(n)) as {
      via?: string; value?: StepResult; inputHash?: string;
    } | null;
    if (!stored || typeof stored !== "object" || !("value" in stored)) {
      return { ok: false, status: 502, message: "The recorded run has no further steps." };
    }
    served = n;
    const last = body.contents[body.contents.length - 1] as Content | undefined;
    if (last && typeof stored.inputHash === "string" && stored.inputHash !== hashTurn(last)) {
      drifts += 1;
    }
    return { ok: true, result: stored.value as StepResult };
  };

  return {
    kind: "golden" as TransportKind,
    label: "Recorded run",
    model: () => "recorded",
    role,
    step,
    remaining: () => (stepTotal === null ? 0 : Math.max(0, stepTotal - served)),
    drift: () => drifts,
  };
}

/** Rung 4. role() returns { ok:false, degraded:{reason:"manual_mode"} }; step returns { ok:false, status:503, message:"The AI path is off. Use the action runner." }. */
export function createManualTransport(): AgentTransport {
  return {
    kind: "manual",
    label: "Manual",
    model: () => "manual",
    role: <R extends RoleName>(_role: R, _input: RoleInput[R], _ctx: RoleCtx): Promise<RoleOutcome<R>> =>
      Promise.resolve({
        ok: false,
        degraded: makeDegradedResult({ reason: "manual_mode", fallback_source: "none" }),
        kind: "manual",
      }),
    step: () => Promise.resolve({ ok: false, status: 503, message: "The AI path is off. Use the action runner." }),
  };
}
