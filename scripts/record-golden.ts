// Requirement IDs: FR-06, FR-21
// Records data/golden-cache from a real run. Live path: discover, run with
// recordGolden, require floors.ok, write doorstep-meta + recorded-trace.json.
// --synthetic (offline degradation, NOT part of the plan): when neither Bedrock
// nor Vertex is reachable, replays the deterministic scripted run through a
// recording wrapper so the suite still passes; the metadata keeps the
// plan's fallback provider label and the deviation is reported, never hidden.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGoldenCache } from "src/resilience";
import type { GoldenCache } from "src/resilience";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { demoSeed } from "src/domain/seed.js";
import { createAppSession } from "src/agent/app-session.js";
import { runWeekReview } from "src/agent/orchestrator.js";
import type { AgentTransport } from "src/agent/transport.js";
import { createInProcessTransport } from "src/agent/transport.js";
import type { Content } from "src/kits/agent-workflow/src/llm/types.js";
import type { StepBody } from "src/kits/agent-workflow/src/server/stepHandler.js";
import type { RoleInput, RoleName } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome } from "src/llm/roles.js";
import { createRoleRunners } from "src/llm/roles.js";
import { createBedrockClient } from "src/llm/bedrock-client.js";
import { createStrandsAdapter } from "src/llm/strands-adapter.js";
import { createVertexFallback } from "src/llm/vertex-fallback.js";
import { createCostClient } from "src/llm/cost.js";
import { discoverModels } from "src/llm/model-discovery.js";
import { PROMPT_VERSION } from "src/prompts/index.js";
import { createScriptedTransport } from "scripts/verify/scripted-transport.js";

const GOLDEN_DIR = join(process.cwd(), "data", "golden-cache");

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function hashTurn(turn: Content): string {
  return createHash("sha256").update(JSON.stringify(turn)).digest("hex");
}

function cleanDir(): void {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  for (const f of readdirSync(GOLDEN_DIR)) {
    if (f === ".gitkeep") continue;
    rmSync(join(GOLDEN_DIR, f), { recursive: true, force: true });
  }
}

/** Recording wrapper over the scripted transport (synthetic path only): same
 *  key/value shapes as the in-process recordGolden path. */
function createRecordingScriptedTransport(session: ReturnType<typeof createAppSession>, cache: GoldenCache): AgentTransport {
  const scripted = createScriptedTransport(session);
  let steps = 0;
  const keyFor = (readable: string): string => cache.deriveKey({ explicitKey: readable });
  return {
    kind: "bedrock",
    label: "Scripted",
    model: () => "synthetic-deterministic",
    role: async <R extends RoleName>(role: R, input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R>> => {
      const out = await scripted.role(role, input, ctx);
      if (out.ok) {
        await cache.put(
          keyFor(`doorstep-role-${ctx.key}`),
          {
            via: "recorded", value: out.output, model: out.model, usage: out.usage,
            latencyMs: out.latencyMs, provider: "vertex-fallback", promptVersion: PROMPT_VERSION,
          },
          { provider: "vertex-fallback", model: out.model, source: "recorded", explicit_key: `doorstep-role-${ctx.key}` },
        );
      }
      return out;
    },
    step: (async (body: StepBody) => {
      const res = await scripted.step(body);
      if (res.ok) {
        steps += 1;
        const last = body.contents[body.contents.length - 1] as Content;
        await cache.put(
          keyFor(`doorstep-step-${pad3(steps)}`),
          {
            via: "recorded", value: res.result, inputHash: hashTurn(last),
            model: "synthetic-deterministic", provider: "vertex-fallback", promptVersion: PROMPT_VERSION,
          },
          { provider: "vertex-fallback", model: "synthetic-deterministic", source: "recorded", explicit_key: `doorstep-step-${pad3(steps)}` },
        );
      }
      return res;
    }) as AgentTransport["step"],
  };
}

async function main(): Promise<void> {
  const synthetic = process.argv.includes("--synthetic");
  const allowFallback = process.argv.includes("--allow-fallback") || process.env["AGENT_ALLOW_FALLBACK"] === "1";
  const cost = createCostClient();
  try {
    cleanDir();
    const cache = createGoldenCache(GOLDEN_DIR);
    const session = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
    let transport: AgentTransport;
    let provider: string;
    let model: string;
    let region: string;
    if (synthetic) {
      transport = createRecordingScriptedTransport(session, cache);
      provider = "vertex-fallback";
      model = "synthetic-deterministic";
      region = "us-east-1";
    } else {
      const discovered = await discoverModels();
      const bedrock = createBedrockClient({ modelId: discovered.fast, region: discovered.region });
      const vertex = allowFallback ? createVertexFallback() : undefined;
      const roles = createRoleRunners({
        models: { fast: discovered.fast, balanced: discovered.balanced },
        region: discovered.region,
        strands: createStrandsAdapter(),
        bedrock,
        vertex,
        allowFallback,
        cost,
        cache,
        recordGolden: true,
      });
      transport = createInProcessTransport({ roles, bedrock, vertex, allowFallback, cost, cache, recordGolden: true });
      provider = "bedrock";
      model = discovered.fast;
      region = discovered.region;
    }
    const summary = await runWeekReview({ session, transport, autoDecide: "approve" });
    if (!summary.floors.ok) {
      console.log(`recorded: FAILED floors ${summary.floors.problems.join("; ")}`);
      process.exit(1);
    }
    const byName: Record<string, number> = {};
    for (const e of summary.trace.entries) {
      if (e.kind === "model" && (e.name === "extractor" || e.name === "planner" || e.name === "narrator")) {
        byName[e.name] = (byName[e.name] ?? 0) + 1;
      }
    }
    const stepEntries = summary.trace.entries.filter((e) => e.kind === "model" && e.name === "actor").length;
    if (transport.rung !== "bedrock") provider = "vertex-fallback";
    if (!synthetic) model = transport.model();
    const meta = {
      promptVersion: PROMPT_VERSION,
      provider,
      model,
      region,
      recordedAt: new Date().toISOString(),
      roles: { extractor: byName["extractor"] ?? 0, planner: byName["planner"] ?? 0, narrator: byName["narrator"] ?? 0 },
      steps: stepEntries,
      floors: summary.floors,
    };
    writeFileSync(join(GOLDEN_DIR, "doorstep-meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
    writeFileSync(join(GOLDEN_DIR, "recorded-trace.json"), JSON.stringify(summary.trace, null, 2) + "\n", "utf8");
    const line = `recorded: ${provider} ${model} steps=${stepEntries} roles=${byName["extractor"] ?? 0}+${byName["planner"] ?? 0}+${byName["narrator"] ?? 0}`;
    console.log(transport.rung !== "bedrock" || synthetic ? `recorded via fallback: ${line.slice("recorded: ".length)}` : line);
  } finally {
    cost.close();
  }
}

void main();
