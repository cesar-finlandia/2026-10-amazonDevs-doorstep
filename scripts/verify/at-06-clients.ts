// Requirement IDs: FR-01, FR-18, FR-21
// WU-API-TRANSPORT-06: browser-safe HTTP clients.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import { makeDegradedResult } from "src/resilience";
import { createGoldenTransport, createManualTransport } from "src/agent/transport.js";
import { createAgentService } from "src/server/agent-service.js";
import { createEventHub } from "src/server/events.js";
import { createHttpRingPort } from "src/server/http-ring-port.js";
import { createHttpAgentTransport } from "src/server/http-agent-transport.js";
import { createMockRingServer } from "../mock-ring-server.js";
import { runRingPortContract } from "./ring-port-contract.js";
import { api, createChecker, startTestServer } from "./at-kit.js";

const check = createChecker("at-06-clients");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function recorder(reply: unknown, status = 200) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: string }[] = [];
  const f = (async (url: unknown, init?: RequestInit): Promise<Response> => {
    const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : String((url as { url?: string }).url ?? String(url));
    const headers: Record<string, string> = {};
    const h = init?.headers as Record<string, string> | undefined;
    if (h) for (const [k, v] of Object.entries(h)) headers[String(k).toLowerCase()] = String(v);
    calls.push({ url: u, method: init?.method ?? "GET", headers, body: typeof init?.body === "string" ? init.body : "" });
    return new Response(JSON.stringify(reply), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetch: f };
}

const agentStub = {
  state: () => ({ kind: "bedrock", label: "t", model: "t", rung: "bedrock" }) as const,
};
const mock = await createMockRingServer({ accessTokens: ["tok-test-123"], webhookSecret: "whsec-test-1" });
try {
  const srv = await startTestServer({
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
    ringBaseUrl: mock.url,
    oauthUrl: mock.oauthUrl,
    overrides: { agent: agentStub as never },
  });
  const base = srv.url;
  const bundle = createBundleRingPort();
  try {
    // 1
    {
      let threw: unknown = null;
      try {
        await runRingPortContract(createHttpRingPort({ baseUrl: base, sessionId: "sess-clients-ctr1" }));
      } catch (e) {
        threw = e;
      }
      check.ok(threw === null, "1 ring contract over http");
    }
    const port = createHttpRingPort({ baseUrl: base, sessionId: "sess-clients-1" });
    // 2
    check.ok(port.mode === "http", "2 http mode");
    // 3
    {
      const m0 = await port.remoteMode();
      await port.setToken("tok-test-123");
      const m1 = await port.remoteMode();
      check.ok(m0 === "bundle" && m1 === "live", "3 remote mode");
    }
    // 4 (dedicated bundle session: check 3 turns sess-clients-1 live)
    {
      const bp = createHttpRingPort({ baseUrl: base, sessionId: "sess-clients-bnd" });
      const a = await bp.listDevices();
      const b = await bundle.listDevices();
      check.ok(JSON.stringify(a) === JSON.stringify(b), "4 listDevices equal");
    }
    // 5
    {
      const bp = createHttpRingPort({ baseUrl: base, sessionId: "sess-clients-bnd" });
      const a = await bp.getEventHistory("dev-door", { limit: 10, offset: 0 });
      const b = await bundle.getEventHistory("dev-door", { limit: 10, offset: 0 });
      check.ok(JSON.stringify(a) === JSON.stringify(b), "5 history equal");
    }
    // 6
    {
      let err: unknown = null;
      try {
        await port.getStatus("nope");
      } catch (e) {
        err = e;
      }
      check.ok(err instanceof RingError && err.status === 404 && err.code === "not_found", "6 not found");
    }
    // 7
    {
      const live = createHttpRingPort({ baseUrl: base, sessionId: "sess-clients-7" });
      await live.setToken("tok-test-123");
      mock.failNext(429, 1);
      const p = live.listDevices();
      // attach a handler immediately: awaiting 9 s later would be an unhandled rejection
      p.catch(() => undefined);
      for (let i = 0; i < 60; i++) {
        await sleep(150);
        mock.failNext(429, 1);
      }
      let err: unknown = null;
      try {
        await p;
      } catch (e) {
        err = e;
      }
      check.ok(err instanceof RingError && err.code === "rate_limited" && err.retryAfterSec === 1, "7 rate limited");
    }
    // 8
    {
      const tmp = await startTestServer({
        env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
        overrides: { agent: agentStub as never },
      });
      const url = tmp.url;
      await tmp.close();
      const dead = createHttpRingPort({ baseUrl: url, sessionId: "sess-clients-8" });
      let err: unknown = null;
      try {
        await dead.listDevices();
      } catch (e) {
        err = e;
      }
      check.ok(err instanceof RingError && err.status === 0 && err.code === "network", "8 unreachable");
    }
    // 9
    {
      const tiny = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<html>hi</html>");
      });
      await new Promise<void>((r) => tiny.listen(0, "127.0.0.1", r));
      const portN = (tiny.address() as { port: number }).port;
      const html = createHttpRingPort({ baseUrl: `http://127.0.0.1:${portN}`, sessionId: "sess-clients-9" });
      let err: unknown = null;
      try {
        await html.listDevices();
      } catch (e) {
        err = e;
      }
      await new Promise<void>((r) => tiny.close(() => r()));
      check.ok(err instanceof RingError && err.status === 502 && err.code === "upstream", "9 html upstream");
    }
    // 10
    {
      const rec = recorder({ ok: true, data: { items: [], limit: 5, offset: 0, total: 0 } });
      const p = createHttpRingPort({ sessionId: "sess-clients-1", fetch: rec.fetch });
      await p.getEventHistory("d", { limit: 5, offset: 0 });
      check.ok(
        rec.calls.length === 1 && rec.calls[0]?.url === "/api/ring/getEventHistory" &&
          rec.calls[0]?.headers["content-type"] === "application/json" &&
          rec.calls[0]?.body === '{"sessionId":"sess-clients-1","args":{"deviceId":"d","limit":5,"offset":0}}',
        "10 request shape",
      );
    }
    // 11
    {
      const rec = recorder({ ok: true, data: null });
      const p = createHttpRingPort({ sessionId: "sess-clients-1", fetch: rec.fetch });
      await p.stopWhep("d", "w");
      const args = JSON.parse(rec.calls[0]?.body ?? "{}") as { args?: unknown };
      check.ok(JSON.stringify(args.args) === JSON.stringify({ deviceId: "d", whepSessionId: "w" }), "11 stopWhep args");
    }
    // 12
    {
      const rec = recorder({ ok: true, expiresInSec: 1700 });
      const p = createHttpRingPort({ sessionId: "sess-clients-1", fetch: rec.fetch });
      await p.setToken("t");
      const setBody = JSON.parse(rec.calls[0]?.body ?? "{}") as unknown;
      const rec2 = recorder({ ok: true });
      const p2 = createHttpRingPort({ sessionId: "sess-clients-1", fetch: rec2.fetch });
      await p2.forgetToken();
      const delBody = JSON.parse(rec2.calls[0]?.body ?? "{}") as unknown;
      check.ok(
        rec.calls[0]?.url === "/api/ring/token" && JSON.stringify(setBody) === JSON.stringify({ sessionId: "sess-clients-1", token: "t" }) &&
          rec2.calls[0]?.method === "DELETE" && JSON.stringify(delBody) === JSON.stringify({ sessionId: "sess-clients-1" }),
        "12 token shapes",
      );
    }
    // 13
    {
      const rec = recorder({ ok: true, data: [] });
      await createHttpRingPort({ sessionId: "s", fetch: rec.fetch }).listDevices();
      const rec2 = recorder({ ok: true, data: [] });
      await createHttpRingPort({ baseUrl: "http://x.test", sessionId: "s", fetch: rec2.fetch }).listDevices();
      check.ok(
        rec.calls[0]?.url === "/api/ring/listDevices" &&
          rec2.calls[0]?.url === "http://x.test/api/ring/listDevices",
        "13 baseUrl",
      );
    }
    // 14
    {
      const a = readFileSync("src/server/http-ring-port.ts", "utf8");
      const b = readFileSync("src/server/http-agent-transport.ts", "utf8");
      const bad = (s: string): boolean =>
        s.includes("node:") || s.includes("process.env") || /^import (?!type)[^;]*from\s+["']src\/resilience/m.test(s);
      check.ok(!bad(a) && !bad(b), "14 browser safe");
    }
  } finally {
    await srv.close();
  }

  const idx = JSON.parse(readFileSync("data/golden-cache/golden-index.json", "utf8")) as {
    entries: Record<string, { explicit_key?: string }>;
  };
  const roleKeys = Object.values(idx.entries)
    .map((e) => e.explicit_key ?? "")
    .filter((k) => k.startsWith("doorstep-role-"));
  const firstSuffix = roleKeys[0]?.slice("doorstep-role-".length) as string;
  const firstRole = firstSuffix.split("-")[0] as string;

  // golden server (real agent on the golden rung)
  const srvG = await startTestServer({
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1", AGENT_PROVIDER: "golden" },
    ringBaseUrl: mock.url,
    oauthUrl: mock.oauthUrl,
  });
  try {
    // 15
    {
      const t = createHttpAgentTransport({ baseUrl: srvG.url, runId: "run-aaaa1111" });
      const s = await t.refreshStatus();
      check.ok(
        s.kind === "golden" && typeof s.label === "string" && typeof s.model === "string" &&
          t.kind === s.kind && t.label === s.label && t.model() === s.model,
        "15 refresh status",
      );
    }
    // 16
    {
      const t = createHttpAgentTransport({ baseUrl: srvG.url, runId: "run-aaaa1111" });
      const r = await t.role(firstRole as never, {} as never, { round: 1, key: firstSuffix });
      check.ok(r.ok === true && (r as { kind?: string }).kind === "golden", "16 golden role");
    }
    // 18
    {
      const t = createHttpAgentTransport({ baseUrl: srvG.url, runId: "run-aaaa1111" });
      const r = await t.step({ contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [] } as never);
      check.ok(
        r.ok === true && typeof (r as { result?: { model?: unknown } }).result?.model === "string",
        "18 golden step",
      );
    }
  } finally {
    await srvG.close();
  }

  // 17 (recording fetch)
  {
    const rec = recorder({
      ok: true,
      output: {},
      model: "m",
      kind: "bedrock",
      usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 },
      latencyMs: 1,
      label: "L",
      rungChanged: false,
    });
    const t = createHttpAgentTransport({ runId: "run-aaaa1111", fetch: rec.fetch });
    await t.role("extractor", { x: 1 } as never, { round: 1, key: "extractor-1" });
    const body = JSON.parse(rec.calls[0]?.body ?? "{}") as unknown;
    check.ok(
      rec.calls[0]?.headers["x-run-id"] === "run-aaaa1111" &&
        JSON.stringify(body) === JSON.stringify({ input: { x: 1 }, round: 1, key: "extractor-1" }),
      "17 role shape",
    );
  }

  // bedrock-fail server for 19
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
  const bedF = {
    kind: "bedrock",
    label: "Bedrock stub",
    model: (): string => "stub",
    role: async (): Promise<never> =>
      ({ ok: false, degraded: makeDegradedResult({ reason: "stub down", fallback_source: "none" }), kind: "bedrock" }) as never,
    step: async (): Promise<never> => ({ ok: false, status: 502, message: "down" }) as never,
    onRungChange: (): void => undefined,
  };
  const svcF = createAgentService({
    env: { AGENT_PROVIDER: "bedrock" },
    hub: hubF as never,
    cost: costF as never,
    makeBedrock: () => bedF as never,
    makeGolden: () => createGoldenTransport(),
    makeManual: () => createManualTransport(),
    runMax: 50,
  });
  const srvF = await startTestServer({
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
    ringBaseUrl: mock.url,
    oauthUrl: mock.oauthUrl,
    overrides: { hub: hubF as never, agent: svcF as never, cost: costF as never },
  });
  try {
    // 19
    {
      const t = createHttpAgentTransport({ baseUrl: srvF.url, runId: "run-f19" });
      const seen: [string, string][] = [];
      t.onRungChange((k, l) => seen.push([k, l]));
      const r = await t.role(firstRole as never, {} as never, { round: 1, key: firstSuffix });
      check.ok(
        r.ok === false && (r as { kind?: string }).kind === "golden" && seen.length === 1 &&
          seen[0]?.[0] === "golden" && seen[0]?.[1] === "Recorded run",
        "19 rung change",
      );
    }
    // 21
    {
      const rec = recorder({
        ok: true,
        output: {},
        model: "m",
        kind: "golden",
        usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
        latencyMs: 0,
        label: "Recorded run",
        rungChanged: true,
      });
      const t = createHttpAgentTransport({ runId: "run-w21", fetch: rec.fetch });
      await t.role("extractor", {} as never, { round: 1, key: "k" });
      check.ok(
        t.kind === "golden" && t.label === "Recorded run" && rec.calls.length === 1,
        "21 immediate update",
      );
    }
    // 23
    {
      const bad = await api(srvF.url, "POST", "/api/agent/step", { tools: [] }, { "x-run-id": "run-w23" });
      const t = createHttpAgentTransport({ baseUrl: srvF.url, runId: "run-w23" });
      const r = await t.step({ tools: [] } as never);
      check.ok(
        (r as { status?: number }).status === 400 &&
          JSON.stringify(r) === JSON.stringify(bad.json),
        "23 step passthrough",
      );
    }
  } finally {
    await srvF.close();
  }

  // 20 (network failures)
  {
    const tmp = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      overrides: { agent: agentStub as never },
    });
    const url = tmp.url;
    await tmp.close();
    const t = createHttpAgentTransport({ baseUrl: url, runId: "run-net20" });
    const r = await t.role("extractor", {} as never, { round: 1, key: "k" });
    const s = await t.step({ contents: [], tools: [] } as never);
    check.ok(
      r.ok === false && (r as { degraded?: { reason?: string; fallback_source?: string } }).degraded?.reason === "The server is not reachable." &&
        (r as { degraded?: { fallback_source?: string } }).degraded?.fallback_source === "none" &&
        (s as { status?: number; message?: string }).status === 503 &&
        (s as { message?: string }).message === "The server is not reachable.",
      "20 network failure",
    );
  }
  // 22
  {
    const a = createHttpAgentTransport();
    const b = createHttpAgentTransport();
    check.ok(
      a.runId !== b.runId && /^[a-z0-9]{16}$/.test(a.runId) && /^[a-z0-9]{16}$/.test(b.runId),
      "22 run ids",
    );
  }
} finally {
  await mock.close();
}

check.done();
