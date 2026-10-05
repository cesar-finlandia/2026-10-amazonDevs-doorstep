// Requirement IDs: FR-18
// Live probe: discovers a Bedrock model and makes one minimal generate call.
import { discoverModels } from "src/llm/model-discovery.js";
import { createBedrockClient } from "src/llm/bedrock-client.js";

async function main(): Promise<void> {
  try {
    const models = await discoverModels();
    const client = createBedrockClient({ modelId: models.fast, region: models.region });
    const res = await client.generate({
      contents: [{ role: "user", parts: [{ text: "Reply with the single word ok." }] }],
      maxOutputTokens: 32,
    });
    if (!res.ok) {
      console.log(`bedrock: FAILED ${res.reason}: ${res.detail}`);
      process.exit(1);
    }
    console.log(`bedrock: ok model=${models.fast} region=${models.region} latencyMs=${res.latencyMs}`);
  } catch (e) {
    const err = e as { name?: string; message?: string };
    console.log(`bedrock: FAILED ${err.name ?? "Error"}: ${err.message ?? String(e)}`);
    process.exit(1);
  }
}

void main();
