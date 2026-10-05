// Requirement IDs: FR-18, FR-21, NFR-14
// WU-API-TRANSPORT-05: agent routes, status, the degraded ladder, cost.
import { readFileSync } from "node:fs";
import { makeDegradedResult } from "src/resilience";
import { createGoldenTransport, createManualTransport } from "src/agent/transport.js";
import type { AgentTransport } from "src/agent/transport.js";
import { createAgentService } from "src/server/agent-service.js";
import { createLazyBedrockTransport } from "src/server/bedrock-lazy.js";
import { buildServerDeps } from "src/server/deps.js";
import { createEventHub } from "src/server/events.js";
import { api, createChecker, startTestServer } from "./at-kit.js";

const check = createChecker("at-05-agent");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type RoleBehaviour = "ok" | "fail";
type StepBehaviour = "ok" | "fail" | "hang";

function validOutput(role: string): Record<string, unknown> {
  if (role === "planner") {
    const step = (order: number) => ({
      order,
      goal: `Do review part ${order} carefully now.`,
      actions: ["list_week_events"],
      why: "The record needs a fresh read first.",
    });
    return { steps: [step(1), step(2), step(3)], focusDays: [], watchFor: [] };
  }
  if (role === "narrator") {
    return {
      incidentId: "inc-1",
      title: "Door activity",
      explanation: "The door saw several visits in the evening and all was calm.",
      tone: "calm",
      suggestedNudge: null,
    };
  }
  return { events: [], skipped: [] };
}

function stubTransport(kind0: string, label0: string, behaviour: { role: RoleBehaviour; step: StepBehaviour }) {
  const listeners = new Set<(kind: never, label: string) => void>();
  const stub = {
    kind: kind0,
    label: label0,
    model: (): string => "stub-model",
    roleCalls: 0,
    stepCalls: 0,
    lastStepBody: null as unknown,
    fire: (k: string, l: string): void => {
      for (const fn of listeners) fn(k as never, l);
    },
    role: async (role: string): Promise<never> => {
      stub.roleCalls += 1;
      if (behaviour.role === "fail") {
        return {
          ok: false,
          degraded: makeDegradedResult({ reason: "stub role failed", fallback_source: "none" }),
          kind: stub.kind,
        } as never;
      }
      return {
        ok: true,
        output: validOutput(role),
        model: "stub-model",
        kind: stub.kind,
        usage: { promptTokens: 10, outputTokens: 20, totalTokens: 30 },
        latencyMs: 7,
      } as never;
    },
    step: async (body: never): Promise<never> => {
      stub.stepCalls += 1;
      stub.lastStepBody = body;
      if (behaviour.step === "hang") return new Promise<never>(() => undefined);
      if (behaviour.step === "fail") return { ok: false, status: 502, message: "stub step failed" } as never;
      return {
        ok: true,
        result: {
          text: "stub-text",
          functionCalls: [],
          usage: { promptTokens: 1, outputTokens: 2, totalTokens: 3 },
          model: "stub-model",
          latencyMs: 5,
        },
      } as never;
    },
    onRungChange(fn: (kind: never, label: string) => void): void {
      listeners.add(fn);
    },
  };
  return stub;
}

function goldenStub() {
  return {
    kind: "golden",
    label: "Recorded run",
    model: (): string => "recorded",
    role: (): Promise<never> => Promise.resolve({ ok: true } as never),
    step: (): Promise<never> => Promise.resolve({ ok: true } as never),
    remaining: (): number => 0,
    drift: (): number => 0,
  };
}

function costStub(opts?: { usedPct?: number; warning?: "none" | "warning" | "critical"; degraded?: boolean }) {
  const s = {
    usedPct: opts?.usedPct ?? 0,
    totalTokens: 0,
    requests: 0,
    warning: (opts?.warning ?? "none") as "none" | "warning" | "critical",
    degraded: opts?.degraded ?? false,
    text: "",
  };
  return {
    guard: async <T>(
      _m: unknown,
      call: () => Promise<{ result: T; usage: { promptTokens: number; outputTokens: number; totalTokens: number } }>,
    ): Promise<{ result: T; summary: typeof s }> => {
      const v = await call();
      return { result: v.result, summary: { ...s } };
    },
    summary: (): typeof s => ({ ...s }),
    setWarning: (w: "none" | "warning" | "critical"): void => {
      s.warning = w;
    },
    reset: (): void => undefined,
    close: (): void => undefined,
  };
}

function hubStub() {
  return createEventHub();
}

// 1
{
  const hub = hubStub();
  const svc = createAgentService({
    env: { AGENT_PROVIDER: "bedrock" },
    hub: hub as never,
    cost: costStub() as never,
    makeBedrock: () => stubTransport("bedrock", "b", { role: "ok", step: "ok" }) as never,
    makeGolden: () => goldenStub() as never,
    makeManual: () => createManualTransport(),
    runMax: 50,
  });
  const st = svc.state();
  await hub.close();
  check.ok(st.rung === "bedrock" && st.kind === "bedrock", "1 bedrock rung");
}
// 2
{
  const hub = hubStub();
  const svc = createAgentService({
    env: { AGENT_PROVIDER: "golden" },
    hub: hub as never,
    cost: costStub() as never,
    makeBedrock: () => stubTransport("bedrock", "b", { role: "ok", step: "ok" }) as never,
    makeGolden: () => goldenStub() as never,
    makeManual: () => createManualTransport(),
    runMax: 50,
  });
  const st = svc.state();
  await hub.close();
  check.ok(st.rung === "golden" && st.kind === "golden", "2 golden rung");
}
// 3
{
  const hub = hubStub();
  const svc = createAgentService({
    env: { AGENT_PROVIDER: "bedrock" },
    hub: hub as never,
    cost: costStub() as never,
    makeBedrock: () => null,
    makeGolden: () => goldenStub() as never,
    makeManual: () => createManualTransport(),
    runMax: 50,
  });
  await hub.close();
  check.ok(svc.state().rung === "golden", "3 bedrock missing");
}
// 4
{
  const hub = hubStub();
  const svc = createAgentService({
    env: {},
    hub: hub as never,
    cost: costStub() as never,
    makeBedrock: () => null,
    makeGolden: () => null,
    makeManual: () => createManualTransport(),
    runMax: 50,
  });
  await hub.close();
  check.ok(svc.state().rung === "manual", "4 manual fallback");
}

function makeService(env: Record<string, string | undefined>, hub: ReturnType<typeof createEventHub>, cost: ReturnType<typeof costStub>, bedrock: ReturnType<typeof stubTransport> | null, golden: (() => AgentTransport & { remaining(): number; drift(): number }) | null, extra?: { stepTimeoutMs?: number }) {
  return createAgentService({
    env,
    hub: hub as never,
    cost: cost as never,
    makeBedrock: bedrock ? (() => bedrock as never) : () => null,
    makeGolden: golden ?? (() => null),
    makeManual: () => createManualTransport(),
    runMax: 50,
    ...(extra?.stepTimeoutMs !== undefined ? { stepTimeoutMs: extra.stepTimeoutMs } : {}),
  });
}

const idx = JSON.parse(readFileSync("data/golden-cache/golden-index.json", "utf8")) as {
  entries: Record<string, { explicit_key?: string }>;
};
const roleKeys = Object.values(idx.entries)
  .map((e) => e.explicit_key ?? "")
  .filter((k) => k.startsWith("doorstep-role-"));
const firstSuffix = roleKeys[0]?.slice("doorstep-role-".length) as string;
const firstRole = firstSuffix.split("-")[0] as string;

// srvA: bedrock ok
const hubA = createEventHub();
const costA = costStub();
const bedA = stubTransport("bedrock", "Bedrock stub", { role: "ok", step: "ok" });
const svcA = makeService({ AGENT_PROVIDER: "bedrock" }, hubA, costA, bedA, () => createGoldenTransport());
const srvA = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { hub: hubA as never, agent: svcA as never, cost: costA as never },
});
try {
  // 5
  {
    const r = await api(srvA.url, "GET", "/api/status");
    const j = r.json as Record<string, unknown>;
    const keys = Object.keys(j).sort();
    const agent = j["agent"] as { kind?: string };
    const inbox = j["inbox"] as { default?: unknown };
    check.ok(
      JSON.stringify(keys) === JSON.stringify(["agent", "build", "cost", "inbox", "ring"]) &&
        agent.kind === svcA.state().kind && typeof inbox.default === "number",
      "5 status shape",
    );
  }
  // 6
  {
    const r = await api(srvA.url, "POST", "/api/agent/role/extractor", {
      input: { kind: "webhook_inbox", deviceId: "all", records: [] },
      round: 1,
    }, { "x-run-id": "run-ok-1" });
    const j = r.json as Record<string, unknown>;
    check.ok(
      r.status === 200 && j["ok"] === true && j["output"] !== undefined && typeof j["model"] === "string" &&
        j["tokens"] !== undefined && j["usage"] !== undefined && typeof j["latencyMs"] === "number" &&
        j["kind"] === "bedrock" && typeof j["label"] === "string" && j["rungChanged"] === false,
      "6 role success",
    );
  }
  // 7
  {
    const r = await api(srvA.url, "POST", "/api/agent/role/janitor", { input: {}, round: 1 });
    const j = r.json as { ok?: boolean; error?: { code?: string } };
    check.ok(r.status === 404 && j.error?.code === "unknown_role", "7 unknown role");
  }
  // 8
  {
    const r = await api(srvA.url, "POST", "/api/agent/role/extractor", { round: 1 });
    const j = r.json as { ok?: boolean; error?: { code?: string } };
    check.ok(r.status === 400 && j.error?.code === "bad_request", "8 role validation");
  }
  // 9
  {
    const ev = hubA.snapshot().events.filter((e) => e.step_id === "agent-role");
    const keys = ev.length > 0 ? Object.keys(ev[0]?.payload ?? {}).sort() : [];
    check.ok(
      ev.length >= 1 &&
        JSON.stringify(keys) === JSON.stringify(["kind", "latencyMs", "model", "role", "round", "totalTokens"]),
      "9 role envelope",
    );
  }
  // 13 (bedrock success step on srvA; run-id reaches the service layer — per-run
  // isolation itself is proven in check 12; the shared bedrock transport cannot
  // observe run ids through the fixed StepFn shape)
  {
    const before = bedA.stepCalls;
    const body = { contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [] };
    const r = await api(srvA.url, "POST", "/api/agent/step", body, { "x-run-id": "run-step-13" });
    const j = r.json as { ok?: boolean; result?: unknown; kind?: string; label?: string };
    check.ok(
      r.status === 200 && j.ok === true && j.result !== undefined && typeof j.kind === "string" &&
        typeof j.label === "string" && bedA.stepCalls === before + 1 &&
        JSON.stringify((bedA.lastStepBody as { contents?: unknown }).contents) === JSON.stringify(body.contents),
      "13 step success",
    );
  }
  // 14
  {
    const before = bedA.stepCalls;
    const rungBefore = svcA.state().rung;
    const r = await api(srvA.url, "POST", "/api/agent/step", { tools: [] }, { "x-run-id": "run-step-14" });
    const j = r.json as { ok?: boolean; status?: number; message?: string; kind?: string };
    check.ok(
      r.status === 400 && j.ok === false && j.status === 400 && typeof j.message === "string" &&
        j.kind === undefined && bedA.stepCalls === before && svcA.state().rung === rungBefore,
      "14 step validation",
    );
  }
} finally {
  await srvA.close();
}

// srvB: bedrock role fails -> golden
const hubB = createEventHub();
const costB = costStub();
const bedB = stubTransport("bedrock", "Bedrock stub", { role: "fail", step: "ok" });
const svcB = makeService({ AGENT_PROVIDER: "bedrock" }, hubB, costB, bedB, () => createGoldenTransport());
const srvB = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { hub: hubB as never, agent: svcB as never, cost: costB as never },
});
try {
  // 10
  {
    const r = await api(srvB.url, "POST", "/api/agent/role/extractor", {
      input: { kind: "webhook_inbox", deviceId: "all", records: [] },
      round: 1,
    }, { "x-run-id": "run-fail-10" });
    const j = r.json as { ok?: boolean; rungChanged?: boolean; kind?: string; label?: string };
    const st = svcB.state();
    const evts = hubB.snapshot().events;
    check.ok(
      r.status === 200 && j.ok === false && j.rungChanged === true && j.kind === "golden" &&
        j.label === "Recorded run" && st.rung === "golden" &&
        evts.some((e) => e.step_id === "agent-rung") &&
        evts.some((e) => e.step_id === "system-degraded" && e.degraded === true && (e.payload as { layer?: string; kind?: string }).layer === "agent" && (e.payload as { kind?: string }).kind === "golden"),
      "10 role descend",
    );
  }
  // 11
  {
    const r = await api(srvB.url, "POST", `/api/agent/role/${firstRole}`, { input: {}, round: 1, key: firstSuffix }, { "x-run-id": "run-golden-11" });
    const j = r.json as { ok?: boolean; kind?: string; label?: string };
    check.ok(r.status === 200 && j.ok === true && j.kind === "golden" && j.label === "Recorded run", "11 golden role");
  }
  // 12
  {
    const body = { contents: [{ role: "user", parts: [{ text: "hello" }] }], tools: [] };
    const r1 = await api(srvB.url, "POST", "/api/agent/step", body, { "x-run-id": "run-g12a" });
    const r2 = await api(srvB.url, "POST", "/api/agent/step", body, { "x-run-id": "run-g12b" });
    const j1 = r1.json as { ok?: boolean; result?: { text?: string; functionCalls?: unknown } };
    const j2 = r2.json as { ok?: boolean; result?: { text?: string; functionCalls?: unknown } };
    check.ok(
      j1.ok === true && j2.ok === true && j1.result?.text === j2.result?.text &&
        JSON.stringify(j1.result?.functionCalls) === JSON.stringify(j2.result?.functionCalls),
      "12 per-run replay",
    );
  }
} finally {
  await srvB.close();
}

// srvC: bedrock step fails -> golden
const hubC = createEventHub();
const costC = costStub();
const bedC = stubTransport("bedrock", "Bedrock stub", { role: "ok", step: "fail" });
const svcC = makeService({ AGENT_PROVIDER: "bedrock" }, hubC, costC, bedC, () => createGoldenTransport());
const srvC = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { hub: hubC as never, agent: svcC as never, cost: costC as never },
});
try {
  // 15
  {
    const body = { contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [] };
    const r = await api(srvC.url, "POST", "/api/agent/step", body, { "x-run-id": "run-c15" });
    const j = r.json as { ok?: boolean; status?: number; rungChanged?: boolean };
    check.ok(r.status === 502 && j.rungChanged === true && svcC.state().rung === "golden", "15 step descend");
  }
} finally {
  await srvC.close();
}

// srvD: hanging step with 100ms timeout
const hubD = createEventHub();
const costD = costStub();
const bedD = stubTransport("bedrock", "Bedrock stub", { role: "ok", step: "hang" });
const svcD = makeService({ AGENT_PROVIDER: "bedrock" }, hubD, costD, bedD, () => createGoldenTransport(), { stepTimeoutMs: 100 });
const srvD = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { hub: hubD as never, agent: svcD as never, cost: costD as never },
});
try {
  // 16
  {
    const body = { contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [] };
    const r = await api(srvD.url, "POST", "/api/agent/step", body, { "x-run-id": "run-d16" });
    const j = r.json as { ok?: boolean; status?: number; message?: string };
    check.ok(
      r.status === 504 && j.message === "The model took too long." && svcD.state().rung === "golden",
      "16 step timeout",
    );
  }
} finally {
  await srvD.close();
}

// srvE: manual rung
const hubE = createEventHub();
const costE = costStub();
const svcE = makeService({}, hubE, costE, null, null);
const srvE = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { hub: hubE as never, agent: svcE as never, cost: costE as never },
});
try {
  // 17
  {
    const rr = await api(srvE.url, "POST", "/api/agent/role/extractor", {
      input: { kind: "webhook_inbox", deviceId: "all", records: [] },
      round: 1,
    }, { "x-run-id": "run-e17" });
    const jr = rr.json as { ok?: boolean; degraded?: { reason?: string }; rungChanged?: boolean };
    const body = { contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [] };
    const rs = await api(srvE.url, "POST", "/api/agent/step", body, { "x-run-id": "run-e17s" });
    const js = rs.json as { ok?: boolean; status?: number; message?: string };
    check.ok(
      jr.ok === false && jr.degraded?.reason === "manual_mode" && jr.rungChanged === false &&
        js.status === 503 && js.message === "The AI path is off. Use the action runner." &&
        svcE.state().rung === "manual",
      "17 manual rung",
    );
  }
} finally {
  await srvE.close();
}

// srvF: cost degraded pre-descend
const hubF = createEventHub();
const costF = costStub({ degraded: true });
const bedF = stubTransport("bedrock", "Bedrock stub", { role: "ok", step: "ok" });
const svcF = makeService({ AGENT_PROVIDER: "bedrock" }, hubF, costF, bedF, () => createGoldenTransport());
const srvF = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { hub: hubF as never, agent: svcF as never, cost: costF as never },
});
try {
  // 18
  {
    const r = await api(srvF.url, "POST", `/api/agent/role/${firstRole}`, { input: {}, round: 1, key: firstSuffix }, { "x-run-id": "run-f18" });
    const j = r.json as { ok?: boolean; kind?: string };
    check.ok(r.status === 200 && bedF.roleCalls === 0 && j.ok === true && j.kind === "golden", "18 budget descend");
  }
} finally {
  await srvF.close();
}

// srvG: warnings + usedPct
const hubG = createEventHub();
const costG = costStub({ usedPct: 42.5 });
const bedG = stubTransport("bedrock", "Bedrock stub", { role: "ok", step: "ok" });
const svcG = makeService({ AGENT_PROVIDER: "bedrock" }, hubG, costG, bedG, () => createGoldenTransport());
const srvG = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { hub: hubG as never, agent: svcG as never, cost: costG as never },
});
try {
  // 19
  {
    const count = (): number => hubG.snapshot().events.filter((e) => e.step_id === "cost-warning").length;
    const n0 = count();
    costG.setWarning("warning");
    await api(srvG.url, "POST", "/api/agent/role/extractor", {
      input: { kind: "webhook_inbox", deviceId: "all", records: [] },
      round: 1,
    }, { "x-run-id": "run-g19a" });
    const n1 = count();
    await api(srvG.url, "POST", "/api/agent/role/extractor", {
      input: { kind: "webhook_inbox", deviceId: "all", records: [] },
      round: 1,
    }, { "x-run-id": "run-g19b" });
    const n2 = count();
    const last = hubG.snapshot().events.filter((e) => e.step_id === "cost-warning").pop();
    check.ok(
      n1 === n0 + 1 && n2 === n1 && (last?.payload as { warning?: string }).warning === "warning",
      "19 cost warning",
    );
  }
  // 20
  {
    const r = await api(srvG.url, "GET", "/api/status");
    check.ok((r.json as { cost?: { usedPct?: number } }).cost?.usedPct === 42.5, "20 usedPct");
  }
} finally {
  await srvG.close();
}

// 21: proofs (srvA bedrock + srvB golden + cost lines)
{
  const a = readFileSync(srvA.deps.proof.path, "utf8");
  const b = readFileSync(srvB.deps.proof.path, "utf8");
  check.ok(
    a.includes("edge=api-bedrock mode=bedrock") && b.includes("edge=api-cache mode=golden") &&
      a.includes("edge=api-cost mode=sidecar") && b.includes("edge=api-cost mode=sidecar"),
    "21 proofs",
  );
}

// 22: vertex fallback switch
{
  const hub = createEventHub();
  const bed = stubTransport("bedrock", "Amazon Bedrock", { role: "ok", step: "ok" });
  const svc = makeService({ AGENT_PROVIDER: "bedrock" }, hub, costStub(), bed, () => createGoldenTransport());
  void svc.state();
  bed.kind = "vertex-fallback";
  bed.fire("vertex-fallback", "Fallback model (not Bedrock)");
  await sleep(50);
  const evts = hub.snapshot().events;
  const st = svc.state();
  await hub.close();
  check.ok(
    evts.some((e) => e.step_id === "system-degraded" && e.degraded === true && (e.payload as { kind?: string }).kind === "vertex-fallback") &&
      st.kind === "vertex-fallback" && st.rung === "bedrock",
    "22 vertex fallback",
  );
}

// 23
{
  const deps = buildServerDeps({ env: {} });
  const st = deps.agent.state();
  deps.cost.close();
  try {
    await deps.hub.close();
  } catch {
    /* ignore */
  }
  check.ok(st.rung === "golden", "23 golden default");
}
// 24
{
  const deps = buildServerDeps({ env: { AWS_BEARER_TOKEN_BEDROCK: "x", AGENT_PROVIDER: "bedrock" } });
  const st = deps.agent.state();
  const label = st.label;
  const model = deps.agent.state().model;
  deps.cost.close();
  try {
    await deps.hub.close();
  } catch {
    /* ignore */
  }
  check.ok(st.rung === "bedrock" && label === "Amazon Bedrock" && model === "", "24 lazy bedrock");
}
// 25
{
  let builds = 0;
  const attached: string[] = [];
  const built = {
    kind: "bedrock",
    label: "Built",
    model: (): string => "m-1",
    role: async (): Promise<never> =>
      ({ ok: true, output: validOutput("extractor"), model: "m-1", kind: "bedrock", usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 }, latencyMs: 1 }) as never,
    step: async (): Promise<never> => ({ ok: true, result: {} }) as never,
    onRungChange: (fn: (kind: never, label: string) => void): void => {
      attached.push("yes");
      void fn;
    },
  };
  const lazy = createLazyBedrockTransport({
    build: async () => {
      builds += 1;
      await sleep(50);
      return built as never;
    },
  });
  lazy.onRungChange(() => undefined);
  const [r1, r2] = await Promise.all([
    lazy.role("extractor", { kind: "webhook_inbox", deviceId: "a", records: [] } as never, { round: 1, key: "k" }),
    lazy.role("extractor", { kind: "webhook_inbox", deviceId: "a", records: [] } as never, { round: 1, key: "k" }),
  ]);
  check.ok(
    builds === 1 && lazy.label === "Built" && lazy.model() === "m-1" && lazy.kind === "bedrock" &&
      r1.ok === true && r2.ok === true && attached.length === 1,
    "25 lazy build once",
  );
}
// 26
{
  let builds = 0;
  const lazy = createLazyBedrockTransport({
    build: async (): Promise<never> => {
      builds += 1;
      throw new Error("no model");
    },
  });
  const r = await lazy.role("extractor", { kind: "webhook_inbox", deviceId: "a", records: [] } as never, { round: 1, key: "k" });
  const s = await lazy.step({ contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [] } as never);
  check.ok(
    r.ok === false && r.degraded.reason.startsWith("The model could not be set up:") && s.status === 502 &&
      builds === 2,
    "26 lazy build fail",
  );
}

check.done();
