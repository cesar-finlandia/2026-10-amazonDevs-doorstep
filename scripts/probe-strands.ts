// Requirement IDs: FR-18
// Live probe: runs one structured-output call through the Strands SDK.
import { z } from "zod";
import { discoverModels } from "src/llm/model-discovery.js";
import { createStrandsAdapter } from "src/llm/strands-adapter.js";

async function main(): Promise<void> {
  try {
    const models = await discoverModels();
    const adapter = createStrandsAdapter();
    const schema = z.object({ word: z.string() });
    const res = await adapter.run({
      system: "Reply with a single JSON object.",
      user: 'Return {"word": "ok"}.',
      schema,
      modelId: models.fast,
      region: models.region,
      maxTokens: 256,
    });
    if (!res.ok) {
      console.log(`strands: FAILED ${res.detail}`);
      process.exit(1);
    }
    const out = res.output as Record<string, unknown>;
    const keys = out !== null && typeof out === "object" ? Object.keys(out).join(",") : "";
    const usage = res.usage.totalTokens > 0 || res.usage.promptTokens > 0 ? "found" : "absent";
    console.log(`strands: structuredOutput=ok usage=${usage} keys=${keys}`);
  } catch (e) {
    console.log(`strands: FAILED ${(e as Error).message ?? String(e)}`);
    process.exit(1);
  }
}

void main();
