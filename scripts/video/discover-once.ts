import { discoverModels } from "./src/llm/model-discovery.js";

const m = await discoverModels({ env: process.env as Record<string, string | undefined> });
console.log(`discovery: fast=${m.fast} balanced=${m.balanced} region=${m.region} source=${m.source}`);
