// Requirement IDs: FR-21
// WU-AGENT-WORKFLOW-07: agent transports (offline with stubs).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGoldenCache } from "src/resilience";
import type { GenerateRequest, GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
import type { StepBody } from "src/kits/agent-workflow/src/server/stepHandler.js";
import { createGoldenTransport, createInProcessTransport, createManualTransport } from "src/agent/transport.js";
import { FALLBACK_LABEL } from "src/llm/vertex-fallback.js";
import { createRoleRunners } from "src/llm/roles.js";
import type { CostClient } from "src/llm/cost.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function genResult(text: string, calls: { name: string; args: Record<string, unknown> }[], model: string): GenerateResult {
  return {
    ok: true, text, functionCalls: calls,
    usage: { promptTokens: 2, outputTokens: 3, totalTokens: 5 }, model, location: "r", latencyMs: 1,
  };
}
const failResult: GenerateResult = { ok: false, reason: "AccessDenied", detail: "no", retryable: false };

function stubBedrock(script: GenerateResult[], log: unknown[], modelId = "bedrock-m") {
  let n = 0;
  return {
    modelId,
    region: "us-east-1",
    generate: (req: GenerateRequest) => {
      log.push(req);
      return Promise.resolve(script[Math.min(n++, script.length - 1)] as GenerateResult);
    },
  };
}
function stubVertex(script: GenerateResult[], log: unknown[]) {
  let n = 0;
  return {
    label: FALLBACK_LABEL,
    modelId: "vertex-m",
    generate: (req: GenerateRequest) => {
      log.push(req);
      return Promise.resolve(script[Math.min(n++, script.length - 1)] as GenerateResult);
    },
  };
}
function fakeCost(): CostClient {
  return {
    guard: (async (_meta, call) => {
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
const dummyRoles = {
  extractor: () => Promise.reject(new Error("unused")),
  planner: () => Promise.reject(new Error("unused")),
  narrator: () => Promise.reject(new Error("unused")),
} as unknown as Parameters<typeof createInProcessTransport>[0]["roles"];

const body: StepBody = { system: "s", contents: [{ role: "user", parts: [{ text: "goal" }] }], tools: [] };

// 1: bedrock step with one function call
{
  const t = createInProcessTransport({
    roles: dummyRoles,
    bedrock: stubBedrock([genResult("", [{ name: "list_week_events", args: { day: 8 } }], "bedrock-m")], []),
    allowFallback: false, cost: fakeCost(), cache: createGoldenCache(mkdtempSync(join(tmpdir(), "aw07-"))),
  });
  const res = await t.step(body);
  assert(res.ok === true && res.ok && res.result.functionCalls.length === 1 && t.kind === "bedrock", "bedrock step yields one call");
}
// 2: both fail → 502
{
  const t = createInProcessTransport({
    roles: dummyRoles,
    bedrock: stubBedrock([failResult], []),
    vertex: stubVertex([failResult], []),
    allowFallback: true, cost: fakeCost(), cache: createGoldenCache(mkdtempSync(join(tmpdir(), "aw07-"))),
  });
  const res = await t.step(body);
  assert(res.ok === false && res.status === 502, "total failure gives 502");
}
// 3: fallback switch fires once
{
  const vlog: unknown[] = [];
  const t = createInProcessTransport({
    roles: dummyRoles,
    bedrock: stubBedrock([failResult], []),
    vertex: stubVertex([genResult("", [], "vertex-m")], vlog),
    allowFallback: true, cost: fakeCost(), cache: createGoldenCache(mkdtempSync(join(tmpdir(), "aw07-"))),
  });
  const seen: [string, string][] = [];
  t.onRungChange((kind, label) => seen.push([kind, label]));
  const res = await t.step(body);
  assert(res.ok === true && t.kind === "vertex-fallback", "kind switches to vertex-fallback");
  assert(seen.length === 1 && seen[0]?.[1] === FALLBACK_LABEL, "rung change fires once with the fallback label");
  assert(vlog.length >= 1, "vertex was used");
}
// 4: no fallback when disallowed
{
  const vlog: unknown[] = [];
  const t = createInProcessTransport({
    roles: dummyRoles,
    bedrock: stubBedrock([genResult("", [], "bedrock-m")], []),
    vertex: stubVertex([genResult("", [], "vertex-m")], vlog),
    allowFallback: false, cost: fakeCost(), cache: createGoldenCache(mkdtempSync(join(tmpdir(), "aw07-"))),
  });
  await t.step(body);
  assert(vlog.length === 0, "vertex never called when fallback is off");
}
// 5+6+7: record two steps, replay in order, drift
const dir = mkdtempSync(join(tmpdir(), "aw07-"));
{
  const cache = createGoldenCache(dir);
  const t = createInProcessTransport({
    roles: dummyRoles,
    bedrock: stubBedrock([genResult("one", [], "bedrock-m"), genResult("two", [], "bedrock-m")], []),
    allowFallback: false, cost: fakeCost(), cache, recordGolden: true,
  });
  await t.step(body);
  await t.step(body);
  for (const n of ["doorstep-step-001", "doorstep-step-002"]) {
    const stored = await cache.get(cache.deriveKey({ explicitKey: n })) as { via?: string; inputHash?: unknown } | null;
    assert(stored?.via === "recorded" && typeof stored?.inputHash === "string", `${n} recorded with an inputHash`);
  }
}
{
  const g = createGoldenTransport({ dir });
  assert(g.remaining() === 2, "two steps remaining");
  const first = await g.step(body);
  assert(first.ok === true && g.remaining() === 1, "first step served");
  const second = await g.step(body);
  assert(second.ok === true && g.remaining() === 0, "second step served");
  const third = await g.step(body);
  assert(third.ok === false && third.status === 502 && third.message === "The recorded run has no further steps.", "exhausted run gives 502");
}
{
  const g = createGoldenTransport({ dir });
  const other: StepBody = { system: "s", contents: [{ role: "user", parts: [{ text: "different goal" }] }], tools: [] };
  const res = await g.step(other);
  assert(res.ok === true && g.drift() === 1, "a differing turn is served with drift 1");
}
// 8: golden role serves a stored entry, misses otherwise
{
  const dir2 = mkdtempSync(join(tmpdir(), "aw07-"));
  const cache = createGoldenCache(dir2);
  const extractorJson = {
    events: [{
      rawId: "evt:req-1", deviceId: "dev-door", componentId: 0, type: "motion_detected",
      subType: null, tsMs: 1791000000000, requestId: "req-1",
    }],
    skipped: [],
  };
  const roles = createRoleRunners({
    models: { fast: "fast-m", balanced: "balanced-m" },
    strands: {
      run: () => Promise.resolve({ ok: true as const, output: extractorJson, usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 } }),
    },
    bedrock: stubBedrock([], []), cost: fakeCost(), cache, allowFallback: false, recordGolden: true,
  });
  const t = createInProcessTransport({ roles, bedrock: stubBedrock([], []), allowFallback: false, cost: fakeCost(), cache });
  const rec = await t.role("extractor", { kind: "webhook_inbox", deviceId: "all", records: [] }, { round: 1, key: "extractor-1" });
  assert(rec.ok === true, "in-process role records");
  const g = createGoldenTransport({ dir: dir2 });
  const served = await g.role("extractor", { kind: "webhook_inbox", deviceId: "all", records: [] }, { round: 1, key: "extractor-1" });
  assert(served.ok === true && served.kind === "golden", "golden role serves the stored entry");
  const miss = await g.role("extractor", { kind: "webhook_inbox", deviceId: "all", records: [] }, { round: 1, key: "nope-9" });
  assert(miss.ok === false && miss.degraded.reason === "golden_cache_miss", "an unknown key misses");
}
// 9: manual transport
{
  const m = createManualTransport();
  const role = await m.role("extractor", { kind: "webhook_inbox", deviceId: "all", records: [] }, { round: 1, key: "extractor-1" });
  const stepped = await m.step(body);
  assert(
    m.kind === "manual" && role.ok === false && role.degraded.reason === "manual_mode" &&
      stepped.ok === false && stepped.status === 503 && stepped.message.includes("Use the action runner"),
    "manual rung refuses with the runner hint",
  );
}
// 10: labels
{
  const t = createInProcessTransport({
    roles: dummyRoles,
    bedrock: stubBedrock([genResult("", [], "bedrock-m")], []),
    allowFallback: false, cost: fakeCost(),
  });
  const g = createGoldenTransport({ dir });
  const m = createManualTransport();
  assert(t.label === "Amazon Bedrock · bedrock-m", "bedrock label names the model");
  assert(g.label === "Recorded run" && m.label === "Manual", "golden and manual labels");
}
// 11: missing directory never throws
{
  const g = createGoldenTransport({ dir: join(tmpdir(), `aw07-missing-${Date.now()}`) });
  const miss = await g.role("extractor", { kind: "webhook_inbox", deviceId: "all", records: [] }, { round: 1, key: "extractor-1" });
  assert(miss.ok === false, "a missing dir misses every role");
}

console.log("aw-07-transport: 11 checks OK");
