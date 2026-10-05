// Requirement IDs: FR-06, FR-21
// Headless week-review runner: --transport bedrock|vertex|golden|scripted [--out <path>].
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createGoldenCache } from "src/resilience";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { demoSeed } from "src/domain/seed.js";
import { createAppSession } from "src/agent/app-session.js";
import { runWeekReview } from "src/agent/orchestrator.js";
import type { AgentTransport } from "src/agent/transport.js";
import { createGoldenTransport, createInProcessTransport } from "src/agent/transport.js";
import { createRoleRunners } from "src/llm/roles.js";
import { createBedrockClient } from "src/llm/bedrock-client.js";
import { createStrandsAdapter } from "src/llm/strands-adapter.js";
import { createVertexFallback } from "src/llm/vertex-fallback.js";
import { createCostClient } from "src/llm/cost.js";
import { discoverModels } from "src/llm/model-discovery.js";
import { createScriptedTransport } from "scripts/verify/scripted-transport.js";

async function buildLive(kind: "bedrock" | "vertex", allowFallback: boolean): Promise<{ transport: AgentTransport; cost: ReturnType<typeof createCostClient> }> {
  const discovered = await discoverModels();
  const cost = createCostClient();
  const cache = createGoldenCache(join(process.cwd(), "data", "golden-cache"));
  if (kind === "vertex") {
    const vertex = createVertexFallback();
    const shim = {
      modelId: discovered.balanced,
      region: discovered.region,
      generate: (req: Parameters<typeof vertex.generate>[0]) => vertex.generate(req),
    };
    const roles = createRoleRunners({
      models: { fast: discovered.fast, balanced: discovered.balanced },
      region: discovered.region,
      strands: createStrandsAdapter(),
      bedrock: shim,
      vertex,
      allowFallback: true,
      cost,
      cache,
    });
    return {
      transport: createInProcessTransport({ roles, bedrock: shim, vertex, allowFallback: true, cost, cache }),
      cost,
    };
  }
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
  });
  return {
    transport: createInProcessTransport({ roles, bedrock, vertex, allowFallback, cost, cache }),
    cost,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const transportArg = argv[argv.indexOf("--transport") + 1] ?? "golden";
  const outArg = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : undefined;
  if (!["bedrock", "vertex", "golden", "scripted"].includes(transportArg)) {
    console.error(`unknown transport ${transportArg}`);
    process.exit(1);
  }
  const session = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
  let transport: AgentTransport;
  let cost: ReturnType<typeof createCostClient> | null = null;
  try {
    if (transportArg === "golden") {
      transport = createGoldenTransport();
    } else if (transportArg === "scripted") {
      transport = createScriptedTransport(session);
    } else {
      const allowFallback = process.env["AGENT_ALLOW_FALLBACK"] === "1";
      const built = await buildLive(transportArg, allowFallback);
      transport = built.transport;
      cost = built.cost;
    }
    const summary = await runWeekReview({ session, transport, autoDecide: "approve" });
    const c = summary.counts;
    console.log(
      `review: ok=${summary.ok} rung=${summary.rung} modelCalls=${c.modelCalls} errors ${c.errorsAfterPerceive}→${c.errorsAfterAct}→${c.errorsAfterRepair} warnings=${c.warningsAfterRepair}`,
    );
    if (outArg) {
      mkdirSync(dirname(outArg), { recursive: true });
      writeFileSync(outArg, JSON.stringify(summary.trace, null, 2) + "\n", "utf8");
    }
    process.exit(summary.ok ? 0 : 1);
  } catch (e) {
    const err = e as { name?: string; message?: string };
    console.log(`review: FAILED ${err.name ?? "Error"}: ${err.message ?? String(e)}`);
    process.exit(1);
  } finally {
    cost?.close();
  }
}

void main();
