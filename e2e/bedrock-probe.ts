// e2e/bedrock-probe.ts — the AI ACCESS attempt for the entry's own provider
// (DP-E2E-BROWSER-TESTING §3.6). Runs discoverModels() (src/llm/model-discovery,
// the real file — §4's "src/llm/discover" does not exist; no alias is created)
// and, when it yields a model, one structured call of the extractor role through
// createRoleRunners (src/llm/roles) with a one-line input. Never throws: any
// failure becomes { available: false, error: "<ErrorName>: <first 160 chars>" }.
// Credentials come from the environment only and are never printed.
// Requirement IDs: FR-18
import { discoverModels } from "src/llm/model-discovery.js";
import { createBedrockClient } from "src/llm/bedrock-client.js";
import { createRoleRunners } from "src/llm/roles.js";
import { createCostClient } from "src/llm/cost.js";
import { WIRE_SAMPLES } from "src/ring/wire.js";

export type BedrockProbe =
  | { available: true; modelId: string; region: string }
  | { available: false; error: string };

function namedError(e: unknown): string {
  const err = e as { name?: unknown; message?: unknown };
  const rawName = typeof err?.name === "string" ? err.name : "";
  const name = /^[A-Za-z]+$/.test(rawName) ? rawName : "Error";
  const rawMessage = typeof err?.message === "string" && err.message.length > 0 ? err.message : String(e);
  return `${name}: ${rawMessage.slice(0, 160)}`;
}

/** See the header. envOverride replaces process.env for the call (the verify
 *  script passes an invalid AWS_REGION through it for check 10). */
export async function probeBedrock(
  envOverride?: Record<string, string | undefined>,
): Promise<BedrockProbe> {
  try {
    const env = envOverride ?? process.env;
    const models = await discoverModels({ env });
    const bedrock = createBedrockClient({ modelId: models.balanced, region: models.region });
    // spawnSidecar: false keeps the probe to one model call with no python child.
    const cost = createCostClient({ spawnSidecar: false });
    try {
      const roles = createRoleRunners({
        models,
        region: models.region,
        bedrock,
        allowFallback: false,
        cost,
      });
      const out = await roles.extractor(
        {
          kind: "webhook_inbox",
          deviceId: "dev-door",
          records: [{ rawId: "probe-1", record: JSON.stringify(WIRE_SAMPLES.webhookMotion) }],
        },
        { round: 1, key: "e2e-bedrock-probe" },
      );
      if (!out.ok) {
        return {
          available: false,
          error: namedError(new Error(`bedrock role degraded: ${JSON.stringify(out.degraded).slice(0, 120)}`)),
        };
      }
      return { available: true, modelId: models.balanced, region: models.region };
    } finally {
      try {
        cost.close();
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    return { available: false, error: namedError(e) };
  }
}
