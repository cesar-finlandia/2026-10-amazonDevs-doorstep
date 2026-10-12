import { probeBedrock } from "./e2e/bedrock-probe.js";

const ids = [
  "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  "global.anthropic.claude-haiku-5-5",
  "global.anthropic.claude-sonnet-4-5",
  "global.anthropic.claude-sonnet-4-6",
];
for (const id of ids) {
  const env = { ...(process.env as Record<string, string | undefined>), BEDROCK_MODEL_ID: id };
  try {
    const p = await probeBedrock(env);
    console.log(`pin ${id.split(".").pop()} -> available=${p.available}`);
  } catch (e) {
    console.log(`pin ${id.split(".").pop()} -> error=${String(e).slice(0, 80)}`);
  }
}
