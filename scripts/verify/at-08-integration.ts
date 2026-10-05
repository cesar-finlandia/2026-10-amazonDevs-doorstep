// Requirement IDs: FR-01…FR-24
// WU-API-TRANSPORT-08: the whole path through the browser-side clients.
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { get } from "node:http";
import { createLogger } from "src/server/logger.js";
import { createEventHub } from "src/server/events.js";
import { createAgentService } from "src/server/agent-service.js";
import { createGoldenTransport, createManualTransport } from "src/agent/transport.js";
import { makeDegradedResult } from "src/resilience";
import { createAppSession } from "src/agent/app-session.js";
import { runWeekReview } from "src/agent/orchestrator.js";
import { demoSeed } from "src/domain/seed.js";
import { createHttpRingPort } from "src/server/http-ring-port.js";
import { createHttpAgentTransport } from "src/server/http-agent-transport.js";
import { createMockRingServer } from "../mock-ring-server.js";
import { api, createChecker, startTestServer } from "./at-kit.js";

const check = createChecker("at-08-integration");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Recursion guard (file-based: verify scripts never read the process environment).
// Step 5 runs `npm run verify:api`, which itself runs this script; the inner copy
// still runs all 15 checks but skips spawning the suite again.
const LOCK = join(tmpdir(), "at-08-verify-api.lock");
function lockFresh(): boolean {
  try {
    const at = Number(readFileSync(LOCK, "utf8"));
    return Number.isFinite(at) && Date.now() - at < 5 * 60 * 1000;
  } catch {
    return false;
  }
}
const nested = lockFresh();
if (!nested) {
  try {
    writeFileSync(LOCK, String(Date.now()));
  } catch {
    /* ignore */
  }
}

const bodies: string[] = [];
async function apiCap(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: unknown; headers: Headers }> {
  const r = await api(base, method, path, body, headers);
  try {
    bodies.push(JSON.stringify(r.json));
  } catch {
    /* ignore */
  }
  return r;
}

const logLines: string[] = [];
const SECRET = "whsec-test-1";
const TOKEN = "tok-test-123";
const mock1 = await createMockRingServer({ accessTokens: [TOKEN], webhookSecret: SECRET });
try {
  const srv = await startTestServer({
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1", RING_WEBHOOK_SECRET: SECRET, AGENT_PROVIDER: "golden" },
    ringBaseUrl: mock1.url,
    oauthUrl: mock1.oauthUrl,
    overrides: { log: createLogger({ write: (l) => logLines.push(l) }) },
  });
  const mock2 = await createMockRingServer({ webhookSecret: SECRET, webhookTarget: srv.url + "/webhooks/ring" });
  try {
    const sessionId = "sess-int-0001";
    const port = createHttpRingPort({ baseUrl: srv.url, sessionId });
    const transport = createHttpAgentTransport({ baseUrl: srv.url });
    const session = createAppSession({ initial: demoSeed(), ring: port });
    const summary = await runWeekReview({ session, transport, autoDecide: "approve", decisionDelayMs: 5 });

    // 1
    check.ok(summary.ok === true && summary.rung === "golden" && summary.counts.errorsAfterRepair === 0, "1 bundle review");
    // 2
    check.ok(summary.counts.errorsAfterAct === 1 && summary.counts.warningsAfterRepair === 3, "2 census");
    // 3
    check.ok(summary.floors.ok === true && summary.floors.humanCheckpoints >= 1, "3 floors");
    // 4
    {
      const file = join(mkdtempSync(join(tmpdir(), "at08-")), "trace.json");
      writeFileSync(file, JSON.stringify(summary.trace));
      const r = spawnSync(
        "npx",
        ["vite-node", "hee/scripts/hee-validate-run-trace.ts", file, "--min-roles", "4", "--min-actions", "15", "--require-verify-repair", "--require-human-checkpoint"],
        { cwd: process.cwd(), encoding: "utf8", shell: true },
      );
      check.ok((r.status ?? 1) === 0, "4 trace validates");
    }
    // 5
    {
      const ev = await apiCap(srv.url, "GET", "/events");
      const list = (ev.json as { events?: { step_id?: string }[] }).events ?? [];
      check.ok(list.filter((e) => e.step_id === "agent-role" || e.step_id === "agent-step").length >= 15, "5 envelopes");
    }
    // 6
    {
      const content = readFileSync(srv.deps.proof.path, "utf8");
      check.ok(
        content.includes("edge=ui-api mode=server") && content.includes("edge=api-ring mode=bundle") &&
          content.includes("edge=api-cache mode=golden") && content.includes("edge=api-cost mode=sidecar"),
        "6 proofs",
      );
    }
    // 7
    {
      const port2 = createHttpRingPort({ baseUrl: srv.url, sessionId: "sess-int-0002" });
      const t2 = createHttpAgentTransport({ baseUrl: srv.url });
      const s2 = createAppSession({ initial: demoSeed(), ring: port2 });
      const r2 = await runWeekReview({ session: s2, transport: t2, autoDecide: "reject-first-then-approve", decisionDelayMs: 5 });
      check.ok(r2.ok === true, "7 second run");
    }
    // 8
    {
      const before = mock1.stats().byPath["/v1/devices"] ?? 0;
      await port.setToken(TOKEN);
      const mode = await port.remoteMode();
      const devs = await port.listDevices();
      const after = mock1.stats().byPath["/v1/devices"] ?? 0;
      check.ok(mode === "live" && devs.length > 0 && after - before >= 1, "8 live ring");
    }
    // 9
    {
      const emitted = await mock2.emitWebhook({ type: "motion_detected", deviceId: "dev-door" });
      let found: { meta?: { request_id?: string } } | null = null;
      const end = Date.now() + 1000;
      while (Date.now() < end && !found) {
        const d = await apiCap(srv.url, "POST", "/api/ring/drainWebhookInbox", { sessionId, args: {} });
        const items = (d.json as { data?: { meta?: { request_id?: string } }[] }).data ?? [];
        found = items.find((x) => x.meta?.request_id === emitted.requestId) ?? null;
        if (!found) await sleep(50);
      }
      check.ok(emitted.status === 200 && found !== null, "9 live webhook");
    }
    // 10
    {
      const first = await mock2.emitWebhook({ type: "motion_detected", deviceId: "dev-door", requestId: "req-dedupe-1" });
      await sleep(200);
      const d1 = await apiCap(srv.url, "POST", "/api/ring/drainWebhookInbox", { sessionId, args: {} });
      const items1 = (d1.json as { data?: { meta?: { request_id?: string } }[] }).data ?? [];
      const second = await mock2.emitWebhook({ type: "motion_detected", deviceId: "dev-door", requestId: "req-dedupe-1" });
      await sleep(200);
      const d2 = await apiCap(srv.url, "POST", "/api/ring/drainWebhookInbox", { sessionId, args: {} });
      const items2 = (d2.json as { data?: { meta?: { request_id?: string } }[] }).data ?? [];
      const copies = (items: { meta?: { request_id?: string } }[]): number =>
        items.filter((x) => x.meta?.request_id === "req-dedupe-1").length;
      check.ok(
        first.status === 200 && second.status === 200 && copies(items1) === 1 && copies(items2) === 0,
        "10 webhook dedupe",
      );
    }

    // failing-bedrock server
    const hubF = createEventHub();
    const costF = {
      guard: async <T>(_m: unknown, call: () => Promise<{ result: T; usage: never }>): Promise<never> => {
        const v = await call();
        return { result: v.result, summary: { usedPct: 0, totalTokens: 0, requests: 0, warning: "none", degraded: false, text: "" } } as never;
      },
      summary: () => ({ usedPct: 0, totalTokens: 0, requests: 0, warning: "none" as const, degraded: false, text: "" }),
      reset: (): void => undefined,
      close: (): void => undefined,
    };
    const delegate = createGoldenTransport();
    let roleCalls = 0;
    const wrapper = {
      kind: "bedrock",
      label: "Bedrock stub",
      model: (): string => "stub",
      role: async (role: never, input: never, ctx: never): Promise<never> => {
        roleCalls += 1;
        if (roleCalls <= 2) return delegate.role(role as never, input as never, ctx as never) as never;
        return { ok: false, degraded: makeDegradedResult({ reason: "mid-run failure", fallback_source: "none" }), kind: "bedrock" } as never;
      },
      step: ((body: never): Promise<never> => delegate.step(body as never) as never) as never,
      onRungChange: (): void => undefined,
    };
    const svcF = createAgentService({
      env: { AGENT_PROVIDER: "bedrock" },
      hub: hubF as never,
      cost: costF as never,
      makeBedrock: () => wrapper as never,
      makeGolden: () => createGoldenTransport(),
      makeManual: () => createManualTransport(),
      runMax: 50,
    });
    const srvF = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1", RING_WEBHOOK_SECRET: SECRET, AGENT_PROVIDER: "bedrock" },
      ringBaseUrl: mock1.url,
      oauthUrl: mock1.oauthUrl,
      overrides: {
        log: createLogger({ write: (l) => logLines.push(l) }),
        hub: hubF as never,
        agent: svcF as never,
        cost: costF as never,
      },
    });
    try {
      // SSE before the failing run
      const frames: string[] = [];
      const req = get(srvF.url + "/events/stream", (res) => {
        res.setEncoding("utf8");
        res.on("data", (c: string) => frames.push(c));
      });
      await sleep(300);
      const portF = createHttpRingPort({ baseUrl: srvF.url, sessionId: "sess-int-fail1" });
      const tF = createHttpAgentTransport({ baseUrl: srvF.url });
      const sF = createAppSession({ initial: demoSeed(), ring: portF });
      const sumF = await runWeekReview({ session: sF, transport: tF, autoDecide: "approve", decisionDelayMs: 5 });
      // 11
      {
        const st = await apiCap(srvF.url, "GET", "/api/status");
        check.ok(
          sumF.degraded.length >= 1 &&
            (st.json as { agent?: { kind?: string } }).agent?.kind === "golden",
          "11 mid-run descend",
        );
      }
      // 12
      {
        const portF2 = createHttpRingPort({ baseUrl: srvF.url, sessionId: "sess-int-fail2" });
        const tF2 = createHttpAgentTransport({ baseUrl: srvF.url });
        const sF2 = createAppSession({ initial: demoSeed(), ring: portF2 });
        const sum2 = await runWeekReview({ session: sF2, transport: tF2, autoDecide: "approve", decisionDelayMs: 5 });
        check.ok(sum2.ok === true && sum2.rung === "golden", "12 second run golden");
      }
      // 13
      {
        let found = false;
        const end = Date.now() + 1000;
        while (Date.now() < end && !found) {
          const text = frames.join("");
          for (const f of text.split("\n\n")) {
            if (!f.includes("event: envelope")) continue;
            const m = /^data: (.*)$/m.exec(f);
            if (!m) continue;
            try {
              const env2 = JSON.parse(m[1] as string) as { step_id?: string; payload?: { layer?: string; kind?: string } };
              if (env2.step_id === "system-degraded" && env2.payload?.layer === "agent" && env2.payload?.kind === "golden") {
                found = true;
                break;
              }
            } catch {
              /* ignore */
            }
          }
          if (!found) await sleep(50);
        }
        try {
          req.destroy();
        } catch {
          /* ignore */
        }
        check.ok(found, "13 degraded frame");
      }
    } finally {
      const t0 = Date.now();
      await srvF.close();
      void t0;
    }

    // 15 (close timing + connections; srvF already closed)
    {
      const t0 = Date.now();
      await srv.close();
      const dt = Date.now() - t0;
      check.ok(dt < 2000 && srv.deps.hub.connections() === 0, "15 clean close");
    }
    // 14 (after all traffic)
    {
      const leaked =
        logLines.some((l) => l.includes(TOKEN) || l.includes(SECRET)) ||
        bodies.some((b) => b.includes(TOKEN) || b.includes(SECRET));
      check.ok(!leaked, "14 no secret leaks");
    }

    await mock2.close();
  } catch (e) {
    try {
      await srv.close();
    } catch {
      /* ignore */
    }
    throw e;
  }
} finally {
  await mock1.close();
}

// 5 (step): full suite once at the end. NOT counted in the 15 checks: a failure
// exits directly so the final line stays `at-08-integration: 15 checks OK`.
if (!nested) {
  const r = spawnSync("npm", ["run", "verify:api"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    timeout: 600000,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const lines = out.split(/\r?\n/);
  const want = [
    "at-01-app",
    "at-02-events",
    "at-03-ring",
    "at-04-webhook",
    "at-05-agent",
    "at-06-clients",
    "at-07-architecture",
    "at-08-integration",
  ];
  const seen: string[] = [];
  for (const line of lines) {
    const m = /^(at-\d\d-[a-z0-9-]+): (\d+) checks OK$/.exec(line.trim());
    if (m) seen.push(m[1] as string);
  }
  const inOrder = want.every((w, i) => seen[i] === w);
  try {
    const { rmSync } = await import("node:fs");
    rmSync(LOCK, { force: true });
  } catch {
    /* ignore */
  }
  if ((r.status ?? 1) !== 0 || !inOrder) {
    console.error("FAIL verify:api suite");
    process.exit(1);
  }
}

check.done();
