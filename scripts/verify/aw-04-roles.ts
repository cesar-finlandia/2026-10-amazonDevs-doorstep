// Requirement IDs: FR-18, FR-21, NFR-03
// WU-AGENT-WORKFLOW-04: role runners with stubs (offline).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createGoldenCache } from "src/resilience";
import type { GenerateRequest, GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
import { createRoleRunners } from "src/llm/roles.js";
import type { RoleCtx } from "src/llm/roles.js";
import { PROMPT_VERSION } from "src/prompts/index.js";
import type { CostClient } from "src/llm/cost.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function okResult(json: unknown, model = "m"): GenerateResult {
  return { ok: true, text: JSON.stringify(json), json, functionCalls: [], usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 }, model, location: "r", latencyMs: 1 };
}

const extractorJson = {
  events: [{
    rawId: "evt:req-1", deviceId: "dev-door", componentId: 0, type: "motion_detected",
    subType: null, tsMs: 1791000000000, requestId: "req-1",
  }],
  skipped: [],
};
const plannerJson = {
  steps: [
    { order: 1, goal: "Read the record and reconcile every device cleanly.", actions: ["list_week_events"], why: "The counts need a fresh read first." },
    { order: 2, goal: "Compare each focus day with the baseline rhythm.", actions: ["compare_to_baseline"], why: "Day counts point at the odd days." },
    { order: 3, goal: "Record every real change as an incident now.", actions: ["open_incident"], why: "Findings fade unless recorded." },
    { order: 4, goal: "Verify the record until zero errors remain.", actions: ["check_week_model"], why: "Only a clean check ends doubt." },
  ],
  focusDays: [8],
  watchFor: ["late visits"],
};
const narratorJson = {
  incidentId: "inc-1", title: "Door activity late at night",
  explanation: "There was door activity at 02:14 on Tue 13 Oct, during quiet hours.",
  tone: "calm", suggestedNudge: null,
};

interface StrandsCapture { system: string; user: string; schema: unknown; modelId: string; maxTokens?: number }
function stubStrands(responses: ({ ok: true; output: unknown } | { ok: false })[], captured: StrandsCapture[]) {
  let n = 0;
  return {
    run: (r: { system: string; user: string; schema: z.ZodType; modelId: string; maxTokens?: number }) => {
      captured.push({ system: r.system, user: r.user, schema: r.schema, modelId: r.modelId, maxTokens: r.maxTokens });
      const next = responses[Math.min(n++, responses.length - 1)] as { ok: true; output: unknown } | { ok: false };
      if (next.ok) {
        return Promise.resolve({ ok: true as const, output: next.output, usage: { promptTokens: 3, outputTokens: 4, totalTokens: 7 } });
      }
      return Promise.resolve({ ok: false as const, reason: "boom", detail: "stubbed strands failure" });
    },
  };
}
function stubBedrock(script: GenerateResult[], log: { req: GenerateRequest }[], modelId = "fast-m") {
  let n = 0;
  return {
    modelId,
    region: "us-east-1",
    generate: (req: GenerateRequest) => {
      log.push({ req });
      const next = script[Math.min(n++, script.length - 1)] as GenerateResult;
      return Promise.resolve(next);
    },
  };
}
function stubVertex(script: GenerateResult[], log: { req: GenerateRequest }[]) {
  let n = 0;
  return {
    label: "Fallback model (not Bedrock)",
    modelId: "",
    generate: (req: GenerateRequest) => {
      log.push({ req });
      const next = script[Math.min(n++, script.length - 1)] as GenerateResult;
      return Promise.resolve(next);
    },
  };
}
function spyCost(seen: { provider: string; label: string }[]): CostClient {
  return {
    guard: (async (meta, call) => {
      seen.push({ provider: meta.provider, label: meta.label });
      const v = await call();
      return {
        result: v.result,
        summary: { usedPct: 0, totalTokens: 0, requests: 0, warning: "none" as const, degraded: false, text: "" },
      };
    }) as CostClient["guard"],
    summary: () => ({ usedPct: 0, totalTokens: 0, requests: 0, warning: "none" as const, degraded: false, text: "" }),
    reset: () => undefined,
    close: () => undefined,
  };
}

const models = { fast: "fast-m", balanced: "balanced-m" };
const extractorIn = { kind: "webhook_inbox" as const, deviceId: "all", records: [] };
const plannerIn = {
  goal: "Review the week and decide what to tell the family.",
  household: { name: "Rosa", age: 78, caretaker: "Maya", quietHours: "22:00 to 07:00" },
  baseline: { dwellP90Min: 15, visitsPerDay: 3 },
  dayCounts: [{ day: 8, label: "Tue", events: 5 }],
  actions: [{ name: "list_week_events", purpose: "List week events" }],
};
const narratorIn = {
  incident: { id: "inc-1", kind: "quiet_hours_activity", title: "t", whenLocal: "Tue 02:14", facts: ["Day: Tue"] },
  household: { name: "Rosa", caretaker: "Maya" },
  baseline: { dwellP90Min: 15 },
};
const ctx = (key: string): RoleCtx => ({ round: 1, key });

// 1: extractor via Strands stub
{
  const captured: StrandsCapture[] = [];
  const seen: { provider: string; label: string }[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: true, output: extractorJson }], captured),
    bedrock: stubBedrock([], []), cost: spyCost(seen), cache, allowFallback: false,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === true && out.kind === "bedrock" && out.ok && out.model === "fast-m", "extractor via Strands is bedrock with the fast model");
}
// 2: planner uses the balanced model
{
  const captured: StrandsCapture[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: true, output: plannerJson }], captured),
    bedrock: stubBedrock([], []), cost: spyCost([]), cache, allowFallback: false,
  });
  const out = await roles.planner(plannerIn, ctx("planner-1"));
  assert(out.ok === true && out.ok && out.model === "balanced-m", "planner uses the balanced model");
}
// 3: narrator system ends with the banned-words line
{
  const captured: StrandsCapture[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: true, output: narratorJson }], captured),
    bedrock: stubBedrock([], []), cost: spyCost([]), cache, allowFallback: false,
  });
  const out = await roles.narrator(narratorIn, ctx("narrator-1"));
  const lastLine = (captured[0]?.system.split("\n").pop() ?? "");
  assert(out.ok === true && lastLine.startsWith("Never use words that match any of these patterns:"), "narrator system ends with the banned-words line");
}
// 4: Strands failure falls back to Converse forced-tool with a responseSchema
{
  const captured: StrandsCapture[] = [];
  const log: { req: GenerateRequest }[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: false }], captured),
    bedrock: stubBedrock([okResult(extractorJson)], log), cost: spyCost([]), cache, allowFallback: false,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === true && (log[0]?.req.responseSchema !== undefined), "converse fallback runs with a responseSchema");
}
// 5: invalid then valid JSON gives ok with exactly 2 generate calls
{
  const log: { req: GenerateRequest }[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: false }], []),
    bedrock: stubBedrock(
      [{ ...okResult({ nope: 1 }), text: "not json", json: undefined }, okResult(extractorJson)],
      log,
    ),
    cost: spyCost([]), cache, allowFallback: false,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === true && log.length === 2, "one repair round after invalid JSON");
}
// 6: two invalid replies, no fallback, empty cache → primary_failed
{
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: false }], []),
    bedrock: stubBedrock([{ ...okResult({}), text: "bad", json: undefined }], []),
    cost: spyCost([]), cache, allowFallback: false,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === false && out.degraded.reason === "primary_failed", "total failure degrades as primary_failed");
}
// 7+8: vertex fallback on/off
{
  const vlog: { req: GenerateRequest }[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: false }], []),
    bedrock: stubBedrock([{ ok: false, reason: "AccessDenied", detail: "no", retryable: false }], []),
    vertex: stubVertex([{ ...okResult(extractorJson), model: "vertex-m" }], vlog),
    cost: spyCost([]), cache, allowFallback: true,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === true && out.ok && out.kind === "vertex-fallback", "failing Bedrock falls to vertex-fallback");
  assert(vlog.length >= 1, "vertex was called when allowed");
}
{
  const vlog: { req: GenerateRequest }[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: true, output: extractorJson }], []),
    bedrock: stubBedrock([], []),
    vertex: stubVertex([okResult(extractorJson)], vlog),
    cost: spyCost([]), cache, allowFallback: false,
  });
  await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(vlog.length === 0, "vertex is never called when fallback is off");
}
// 9+10: golden cache rung
{
  const dir = mkdtempSync(join(tmpdir(), "aw04-"));
  const cache = createGoldenCache(dir);
  const key = cache.deriveKey({ explicitKey: "doorstep-role-extractor-1" });
  await cache.put(key, {
    via: "recorded", value: extractorJson, model: "fast-m",
    usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 }, latencyMs: 1,
  }, { provider: "bedrock", model: "fast-m", source: "recorded", explicit_key: "doorstep-role-extractor-1" });
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: false }], []),
    bedrock: stubBedrock([{ ok: false, reason: "AccessDenied", detail: "no", retryable: false }], []),
    cost: spyCost([]), cache, allowFallback: false,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === true && out.ok && out.kind === "golden", "a cached entry replays as golden");
}
{
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const key = cache.deriveKey({ explicitKey: "doorstep-role-extractor-1" });
  await cache.put(key, { via: "recorded", value: { events: "nope" }, model: "m", usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 }, latencyMs: 0 });
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: false }], []),
    bedrock: stubBedrock([{ ok: false, reason: "AccessDenied", detail: "no", retryable: false }], []),
    cost: spyCost([]), cache, allowFallback: false,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === false && out.degraded.reason === "golden_entry_invalid", "a stale cache entry degrades as golden_entry_invalid");
}
// 11: recordGolden stores the entry
{
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: true, output: extractorJson }], []),
    bedrock: stubBedrock([], []), cost: spyCost([]), cache, allowFallback: false, recordGolden: true,
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(out.ok === true, "recorded run still succeeds");
  const stored = await cache.get(cache.deriveKey({ explicitKey: "doorstep-role-extractor-1" })) as {
    via: string; provider: string; promptVersion: string;
  };
  assert(stored.via === "recorded" && stored.provider === "bedrock" && stored.promptVersion === PROMPT_VERSION, "recordGolden stores via/provider/promptVersion");
}
// 12: cost spy
{
  const seen: { provider: string; label: string }[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models, strands: stubStrands([{ ok: true, output: extractorJson }], []),
    bedrock: stubBedrock([], []), cost: spyCost(seen), cache, allowFallback: false,
  });
  await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(seen.some((s) => s.provider === "bedrock" && s.label === "extractor"), "cost saw the bedrock extractor call");
}
// 13: forced_degraded never calls primary
{
  let strandsCalls = 0;
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models,
    strands: { run: () => { strandsCalls += 1; return Promise.resolve({ ok: true as const, output: extractorJson, usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 } }); } },
    bedrock: stubBedrock([], []), cost: spyCost([]), cache, allowFallback: false,
    resilience: { forced_degraded: true },
  });
  const out = await roles.extractor(extractorIn, ctx("extractor-1"));
  assert(strandsCalls === 0 && out.ok === false, "forced_degraded skips primary and degrades");
}
// 14: per-role maxTokens
{
  const captured: StrandsCapture[] = [];
  const cache = createGoldenCache(mkdtempSync(join(tmpdir(), "aw04-")));
  const roles = createRoleRunners({
    models,
    strands: stubStrands(
      [{ ok: true, output: extractorJson }, { ok: true, output: plannerJson }, { ok: true, output: narratorJson }],
      captured,
    ),
    bedrock: stubBedrock([], []), cost: spyCost([]), cache, allowFallback: false,
  });
  await roles.extractor(extractorIn, ctx("extractor-1"));
  await roles.planner(plannerIn, ctx("planner-1"));
  await roles.narrator(narratorIn, ctx("narrator-1"));
  assert(
    captured[0]?.maxTokens === 8192 && captured[1]?.maxTokens === 1500 && captured[2]?.maxTokens === 600,
    "maxTokens are 8192/1500/600 per role",
  );
}

console.log("aw-04-roles: 14 checks OK");
