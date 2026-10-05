// Requirement IDs: FR-18
// WU-AGENT-WORKFLOW-01: pinned deps, discovery, Converse mapping (offline, stubbed).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverModels, rankCandidates } from "src/llm/model-discovery.js";
import type { ModelCandidate } from "src/llm/model-discovery.js";
import { createBedrockClient, fromConverseOutput, toConverseInput } from "src/llm/bedrock-client.js";
import type { GenerateRequest } from "src/kits/agent-workflow/src/llm/types.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function pkgVersion(name: string): string {
  const p = join(process.cwd(), "node_modules", ...name.split("/"), "package.json");
  return (JSON.parse(readFileSync(p, "utf8")) as { version: string }).version;
}

assert(pkgVersion("@strands-agents/sdk") === "1.19.0", "strands sdk version is 1.19.0");
assert(pkgVersion("@aws-sdk/client-bedrock-runtime") === "3.1146.0", "bedrock-runtime version is 3.1146.0");
assert(pkgVersion("@aws-sdk/client-bedrock") === "3.1146.0", "bedrock version is 3.1146.0");
assert(pkgVersion("zod") === "4.6.5", "zod version is 4.6.5");

const fixtures: ModelCandidate[] = [
  { id: "profile-sonnet-4", provider: "Anthropic", name: "Claude Sonnet 4", inputModalities: ["TEXT"], outputModalities: ["TEXT"], active: true },
  { id: "profile-sonnet-45", provider: "Anthropic", name: "Claude Sonnet 4.5", inputModalities: ["TEXT"], outputModalities: ["TEXT"], active: true },
  { id: "profile-haiku-45", provider: "Anthropic", name: "Claude Haiku 4.5", inputModalities: ["TEXT"], outputModalities: ["TEXT"], active: true },
  { id: "profile-opus-41", provider: "Anthropic", name: "Claude Opus 4.1", inputModalities: ["TEXT"], outputModalities: ["TEXT"], active: true },
  { id: "profile-nova-pro", provider: "Amazon", name: "Nova Pro", inputModalities: ["TEXT"], outputModalities: ["TEXT"], active: true },
  { id: "profile-nova-lite", provider: "Amazon", name: "Nova Lite", inputModalities: ["TEXT"], outputModalities: ["TEXT"], active: true },
  { id: "profile-sonnet-9", provider: "Anthropic", name: "Claude Sonnet 9", inputModalities: ["TEXT"], outputModalities: ["TEXT"], active: false },
];

assert(rankCandidates(fixtures, "balanced") === "profile-sonnet-45", "balanced ranks the Sonnet 4.5 id");
assert(rankCandidates(fixtures, "fast") === "profile-haiku-45", "fast ranks the Haiku 4.5 id");
assert(
  rankCandidates(fixtures.filter((f) => f.id === "profile-opus-41" || f.id === "profile-sonnet-9"), "balanced") === null &&
    rankCandidates(fixtures.filter((f) => f.id === "profile-opus-41" || f.id === "profile-sonnet-9"), "fast") === null,
  "Opus and the inactive Sonnet never win either tier",
);

const viaEnv = await discoverModels({ env: { BEDROCK_MODEL_ID: "x-model", AWS_REGION: "eu-west-1" } });
assert(
  viaEnv.fast === "x-model" && viaEnv.balanced === "x-model" && viaEnv.source === "env" && viaEnv.region === "eu-west-1",
  "BEDROCK_MODEL_ID wins for both tiers with source env",
);

const viaStub = await discoverModels({ listCandidates: () => Promise.resolve(fixtures), env: {} });
assert(viaStub.source === "discovery" && viaStub.region === "us-east-1", "stub candidates give source discovery and region us-east-1");

const llmDir = join(process.cwd(), "src", "llm");
for (const f of readdirSync(llmDir).filter((x) => x.endsWith(".ts"))) {
  const text = readFileSync(join(llmDir, f), "utf8");
  assert(!/(anthropic|amazon)\.(claude|nova)/i.test(text), `no hardcoded model id in src/llm/${f}`);
}

const none = await discoverModels({ listCandidates: () => Promise.resolve([]), env: {} }).then(
  () => null,
  (e: Error) => e,
);
assert(none !== null && none.message.startsWith("No invocable text model is visible in"), "empty candidates reject with the discovery error");

const mergeReq: GenerateRequest = {
  contents: [
    { role: "model", parts: [{ text: "first" }] },
    { role: "user", parts: [{ text: "a" }] },
    { role: "user", parts: [{ text: "b" }] },
  ],
};
const merged = toConverseInput(mergeReq, "m", 64)["messages"] as { role: string; content: { text?: string }[] }[];
assert(
  merged.length === 3 && merged[0]?.role === "user" && merged[1]?.role === "assistant" &&
    (merged[2]?.content.length ?? 0) === 2,
  "consecutive users merge and a leading model turn gets a Continue user turn",
);

const toolReq: GenerateRequest = {
  contents: [
    { role: "user", parts: [{ text: "go" }] },
    { role: "model", parts: [{ functionCall: { name: "list_week_events", args: { day: 8 } } }] },
    { role: "user", parts: [{ functionResponse: { name: "list_week_events", response: { ok: true } } }] },
  ],
};
const toolMsgs = toConverseInput(toolReq, "m", 64)["messages"] as {
  role: string;
  content: { toolUse?: { toolUseId: string }; toolResult?: { toolUseId: string } }[];
}[];
const callId = toolMsgs[1]?.content[0]?.toolUse?.toolUseId;
const respId = toolMsgs[2]?.content[0]?.toolResult?.toolUseId;
assert(callId === "tu-1-0" && respId === "tu-1-0", "functionCall and its functionResponse share tu-1-0");

const schemaReq: GenerateRequest = {
  contents: [{ role: "user", parts: [{ text: "{}" }] }],
  responseSchema: { type: "object", properties: { a: { type: "number" } } },
};
const schemaInput = toConverseInput(schemaReq, "m", 64);
const toolConfig = schemaInput["toolConfig"] as { tools: { toolSpec: { name: string } }[]; toolChoice: { tool: { name: string } } };
assert(
  toolConfig.tools.some((t) => t.toolSpec.name === "emit_result") && toolConfig.toolChoice.tool.name === "emit_result",
  "responseSchema adds the emit_result tool and toolChoice",
);
const stubReply = {
  output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "tu-0-0", name: "emit_result", input: { a: 1 } } }] } },
  stopReason: "end_turn",
  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
};
const parsed = fromConverseOutput(stubReply, "m", "us-east-1", 7);
assert(
  parsed.ok && JSON.stringify((parsed as { json: unknown }).json) === JSON.stringify({ a: 1 }) &&
    parsed.usage.promptTokens === 10 && parsed.usage.outputTokens === 5 && parsed.usage.totalTokens === 15,
  "emit_result input becomes json with mapped usage",
);

const throttled = createBedrockClient({
  modelId: "m",
  send: () => {
    const e = new Error("slow down") as Error & { name: string };
    e.name = "ThrottlingException";
    return Promise.reject(e);
  },
});
const thr = await throttled.generate({ contents: [{ role: "user", parts: [{ text: "hi" }] }] });
assert(!thr.ok && thr.reason === "ThrottlingException" && thr.retryable === true, "ThrottlingException maps to retryable false-ok");

console.log("aw-01-bedrock: 15 checks OK");
