import { probeBedrock } from "./e2e/bedrock-probe.js";

const p = await probeBedrock();
console.log(`probe: ${JSON.stringify(p).slice(0, 220)}`);
