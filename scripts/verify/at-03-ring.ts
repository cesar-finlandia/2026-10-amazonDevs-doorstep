// Requirement IDs: FR-01, FR-10
// WU-API-TRANSPORT-03: Ring routes, Playground token, per-session ports, linking.
import { readFileSync } from "node:fs";
import { createLogger } from "src/server/logger.js";
import { SESSION_ID_PATTERN } from "src/server/sessions.js";
import { createMockRingServer } from "../mock-ring-server.js";
import { api, createChecker, startTestServer } from "./at-kit.js";

const check = createChecker("at-03-ring");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// 1
check.ok(
  SESSION_ID_PATTERN.test("abcd1234") &&
    !SESSION_ID_PATTERN.test("short") &&
    !SESSION_ID_PATTERN.test("has space!!") &&
    !SESSION_ID_PATTERN.test("x".repeat(65)),
  "1 session pattern",
);

const agentStub = {
  state: () => ({ kind: "bedrock", label: "t", model: "t", rung: "bedrock" }) as const,
};
const logLines: string[] = [];
const capLog = createLogger({ write: (l) => logLines.push(l) });
const mock = await createMockRingServer({ accessTokens: ["tok-test-123"], webhookSecret: "whsec-test-1" });
const proofPaths: string[] = [];
try {
  const srv = await startTestServer({
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
    ringBaseUrl: mock.url,
    oauthUrl: mock.oauthUrl,
    overrides: { log: capLog, agent: agentStub as never },
  });
  proofPaths.push(srv.deps.proof.path);
  const base = srv.url;
  try {
    const A = "sess-ring-a001";
    const B = "sess-ring-b002";
    const L = "sess-ring-live1";
    const D = "sess-ring-dead1";
    const E = "sess-ring-e503a";
    const F = "sess-ring-f503b";
    const G = "sess-ring-g429c";
    const H = "sess-ring-hdel1";

    // 2
    {
      const r = await api(base, "POST", "/api/ring/listDevices", { sessionId: A, args: {} });
      const j = r.json as { ok?: boolean; data?: { id?: string }[] };
      check.ok(
        r.status === 200 && j.ok === true && Array.isArray(j.data) && j.data.some((d) => d.id === "dev-door"),
        "2 bundle listDevices",
      );
    }
    // 3
    {
      const r = await api(base, "POST", "/api/ring/listDevices", { sessionId: "x", args: {} });
      const j = r.json as { ok?: boolean; error?: { code?: string } };
      check.ok(r.status === 400 && (j.error?.code ?? "") === "bad_session", "3 bad session");
    }
    // 4
    {
      const r = await api(base, "POST", "/api/ring/drop", { sessionId: A, args: {} });
      const j = r.json as { ok?: boolean; error?: { code?: string } };
      check.ok(r.status === 404 && (j.error?.code ?? "") === "unknown_op", "4 unknown op");
    }
    // 5
    {
      const r = await api(base, "POST", "/api/ring/getStatus", { sessionId: A, args: {} });
      const j = r.json as { ok?: boolean; error?: { code?: string; message?: string } };
      check.ok(
        r.status === 400 &&
          j.error?.code === "bad_request" &&
          j.error?.message === "getStatus: deviceId is required.",
        "5 missing arg",
      );
    }
    // 6
    {
      const r = await api(base, "POST", "/api/ring/getEventHistory", {
        sessionId: A,
        args: { deviceId: "dev-door", limit: 5000, offset: 0 },
      });
      const j = r.json as { ok?: boolean; error?: { code?: string } };
      check.ok(r.status === 400 && j.error?.code === "bad_request", "6 bad limit");
    }
    // 7
    {
      const r = await api(base, "POST", "/api/ring/getEventHistory", {
        sessionId: A,
        args: { deviceId: "dev-door", limit: 10, offset: 0 },
      });
      const j = r.json as { ok?: boolean; data?: { items?: unknown[] } };
      check.ok(r.status === 200 && (j.data?.items ?? []).length === 10, "7 history page");
    }
    // 8
    {
      const a1 = await api(base, "POST", "/api/ring/drainWebhookInbox", { sessionId: A, args: {} });
      const a2 = await api(base, "POST", "/api/ring/drainWebhookInbox", { sessionId: A, args: {} });
      const b1 = await api(base, "POST", "/api/ring/drainWebhookInbox", { sessionId: B, args: {} });
      const j1 = a1.json as { data?: unknown[] };
      const j2 = a2.json as { data?: unknown[] };
      const j3 = b1.json as { data?: unknown[] };
      check.ok(
        (j1.data ?? []).length > 0 && (j2.data ?? []).length === 0 && (j3.data ?? []).length > 0,
        "8 independent bundles",
      );
    }
    // 9
    {
      const r = await api(base, "POST", "/api/ring/token", { sessionId: L, token: "tok-test-123" });
      const raw = await (await fetch(base + "/api/ring/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: "sess-ring-x999", token: "tok-test-123" }) })).text();
      void raw;
      const j = r.json as { ok?: boolean; expiresInSec?: number };
      const bodyText = JSON.stringify(r.json);
      check.ok(
        r.status === 200 &&
          typeof j.expiresInSec === "number" &&
          j.expiresInSec >= 1700 &&
          j.expiresInSec <= 1800 &&
          !bodyText.includes("tok-test-123"),
        "9 set token",
      );
    }
    // 10
    {
      const rl = await api(base, "GET", `/api/status?sessionId=${L}`);
      const ro = await api(base, "GET", "/api/status?sessionId=sess-ring-other1");
      const jl = rl.json as { ring?: { mode?: string } };
      const jo = ro.json as { ring?: { mode?: string } };
      check.ok(jl.ring?.mode === "live" && jo.ring?.mode === "bundle", "10 modes");
    }
    // 11
    {
      const before = mock.stats().byPath["/v1/devices"] ?? 0;
      const r = await api(base, "POST", "/api/ring/listDevices", { sessionId: L, args: {} });
      const after = mock.stats().byPath["/v1/devices"] ?? 0;
      check.ok(r.status === 200 && after - before >= 1, "11 live listDevices");
    }
    // 12
    {
      await api(base, "POST", "/api/ring/token", { sessionId: D, token: "bad-token" });
      const r = await api(base, "POST", "/api/ring/listDevices", { sessionId: D, args: {} });
      const j = r.json as { ok?: boolean; error?: { code?: string } };
      check.ok(r.status === 401 && j.error?.code === "unauthorized", "12 bad token 401");
    }
    // 13
    {
      const st = await api(base, "GET", `/api/status?sessionId=${D}`);
      const js = st.json as { ring?: { mode?: string } };
      const ev = await api(base, "GET", "/events");
      const je = ev.json as { events?: { step_id?: string; degraded?: boolean; payload?: { layer?: string } }[] };
      const found = (je.events ?? []).some(
        (e) => e.step_id === "system-degraded" && e.degraded === true && e.payload?.layer === "ring",
      );
      check.ok(js.ring?.mode === "bundle" && found, "13 degraded to bundle");
    }
    // 14
    {
      const r = await api(base, "POST", "/api/ring/listDevices", { sessionId: D, args: {} });
      const j = r.json as { ok?: boolean; data?: unknown[] };
      check.ok(r.status === 200 && j.ok === true && Array.isArray(j.data), "14 bundle after degrade");
    }
    // 15
    {
      await api(base, "POST", "/api/ring/token", { sessionId: D, token: "tok-test-123" });
      const st = await api(base, "GET", `/api/status?sessionId=${D}`);
      const js = st.json as { ring?: { mode?: string } };
      const ev = await api(base, "GET", "/events");
      const je = ev.json as { events?: { step_id?: string; payload?: { mode?: string } }[] };
      const found = (je.events ?? []).some((e) => e.step_id === "ring-mode" && e.payload?.mode === "live");
      check.ok(js.ring?.mode === "live" && found, "15 token heals");
    }
    // 16: each surfaced 5xx needs two armed failures (initial + resilience retry).
    // NOTE (deviation, see final report): the mock's failNext body carries an
    // errors array, so the client's classify() message is the detail text, not
    // "Ring returned 5…"; the resilience wrapper therefore converts a twice-
    // failed call to RingError(0, "network"), which §5.6 maps to HTTP 502
    // (status 0 → 502). The degrade-after-two behaviour is as specified.
    async function surfaced5xx(sid: string): Promise<{ status: number }> {
      mock.failNext(503);
      const p = api(base, "POST", "/api/ring/listDevices", { sessionId: sid, args: {} });
      await sleep(150);
      mock.failNext(503);
      return p;
    }
    {
      await api(base, "POST", "/api/ring/token", { sessionId: E, token: "tok-test-123" });
      const r1 = await surfaced5xx(E);
      const s1 = await api(base, "GET", `/api/status?sessionId=${E}`);
      const r2 = await surfaced5xx(E);
      const s2 = await api(base, "GET", `/api/status?sessionId=${E}`);
      const m1 = (s1.json as { ring?: { mode?: string } }).ring?.mode;
      const m2 = (s2.json as { ring?: { mode?: string } }).ring?.mode;
      check.ok(r1.status === 502 && m1 === "live" && r2.status === 502 && m2 === "bundle", "16 degrade after two");
    }
    // 17
    {
      await api(base, "POST", "/api/ring/token", { sessionId: F, token: "tok-test-123" });
      const q1 = await surfaced5xx(F);
      const ok1 = await api(base, "POST", "/api/ring/listDevices", { sessionId: F, args: {} });
      const q2 = await surfaced5xx(F);
      const ok2 = await api(base, "POST", "/api/ring/listDevices", { sessionId: F, args: {} });
      const st = await api(base, "GET", `/api/status?sessionId=${F}`);
      check.ok(
        q1.status === 502 && ok1.status === 200 && q2.status === 502 && ok2.status === 200 &&
          (st.json as { ring?: { mode?: string } }).ring?.mode === "live",
        "17 failures reset",
      );
    }
    // 18: surfacing a 429 needs four armed failures (initial + three client retries)
    {
      await api(base, "POST", "/api/ring/token", { sessionId: G, token: "tok-test-123" });
      mock.failNext(429, 1);
      const p = api(base, "POST", "/api/ring/listDevices", { sessionId: G, args: {} });
      for (let i = 0; i < 60; i++) {
        await sleep(150);
        mock.failNext(429, 1);
      }
      const r = await p;
      const j = r.json as { ok?: boolean; error?: { code?: string; retryAfterSec?: number } };
      const st = await api(base, "GET", `/api/status?sessionId=${G}`);
      check.ok(
        r.status === 429 && j.error?.code === "rate_limited" && j.error?.retryAfterSec === 1 &&
          (st.json as { ring?: { mode?: string } }).ring?.mode === "live",
        "18 rate limited",
      );
    }
    // 19
    {
      await api(base, "POST", "/api/ring/token", { sessionId: H, token: "tok-test-123" });
      await api(base, "DELETE", "/api/ring/token", { sessionId: H });
      const st = await api(base, "GET", `/api/status?sessionId=${H}`);
      check.ok((st.json as { ring?: { mode?: string } }).ring?.mode === "bundle", "19 forget token");
    }
    // 20
    {
      const sEnv = await startTestServer({
        env: { NODE_ENV: "test", BUILD_MARKER: "test-1", RING_ACCESS_TOKEN: "tok-test-123" },
        ringBaseUrl: mock.url,
        oauthUrl: mock.oauthUrl,
        overrides: { log: capLog, agent: agentStub as never },
      });
      proofPaths.push(sEnv.deps.proof.path);
      const noSess = await api(sEnv.url, "GET", "/api/status");
      const m1 = (noSess.json as { ring?: { mode?: string } }).ring?.mode;
      await sEnv.close();
      const sBun = await startTestServer({
        env: { NODE_ENV: "test", BUILD_MARKER: "test-1", RING_ACCESS_TOKEN: "tok-test-123", RING_MODE: "bundle" },
        ringBaseUrl: mock.url,
        oauthUrl: mock.oauthUrl,
        overrides: { log: capLog, agent: agentStub as never },
      });
      proofPaths.push(sBun.deps.proof.path);
      const noSess2 = await api(sBun.url, "GET", "/api/status");
      const m2 = (noSess2.json as { ring?: { mode?: string } }).ring?.mode;
      await api(sBun.url, "POST", "/api/ring/token", { sessionId: "sess-ring-env01", token: "tok-test-123" });
      const withTok = await api(sBun.url, "GET", "/api/status?sessionId=sess-ring-env01");
      const m3 = (withTok.json as { ring?: { mode?: string } }).ring?.mode;
      await sBun.close();
      check.ok(m1 === "live" && m2 === "bundle" && m3 === "live", "20 env credentials");
    }
    // 21
    {
      const r = await api(base, "POST", "/api/ring/linking/nonce", { sessionId: A });
      const j = r.json as { ok?: boolean; error?: { code?: string; message?: string } };
      check.ok(
        r.status === 409 && j.error?.code === "not_live" && j.error?.message === "Connect a Ring token first.",
        "21 linking needs live",
      );
    }
    // 22
    {
      const r = await api(base, "POST", "/api/ring/linking/nonce", { sessionId: L });
      const j = r.json as { ok?: boolean; error?: { code?: string } };
      check.ok(r.status === 503 && j.error?.code === "not_configured", "22 linking key unset");
    }
    // 23
    {
      const sH = await startTestServer({
        env: { NODE_ENV: "test", BUILD_MARKER: "test-1", RING_HMAC_KEY: "k-test-key-123" },
        ringBaseUrl: mock.url,
        oauthUrl: mock.oauthUrl,
        overrides: { log: capLog, agent: agentStub as never },
      });
      proofPaths.push(sH.deps.proof.path);
      const LS = "sess-ring-hmac1";
      await api(sH.url, "POST", "/api/ring/token", { sessionId: LS, token: "tok-test-123" });
      const n = await api(sH.url, "POST", "/api/ring/linking/nonce", { sessionId: LS });
      const jn = n.json as { ok?: boolean; nonce?: string; time?: number; accountId?: string };
      const nonceOk =
        n.status === 200 && typeof jn.nonce === "string" && /^[A-Za-z0-9_-]{43}$/.test(jn.nonce) &&
        typeof jn.time === "number" && Math.abs(jn.time - Math.floor(Date.now() / 1000)) <= 5;
      const c = await api(sH.url, "POST", "/api/ring/linking/confirm", {
        sessionId: LS,
        accountIdentifier: "user@partner.example.com",
        nonce: jn.nonce,
      });
      const jc = c.json as { status?: string; accountIdentifier?: string };
      const confirmOk =
        (c.json as { ok?: boolean }).ok === true && jc.status === "awaiting" &&
        typeof jc.accountIdentifier === "string" && jc.accountIdentifier.includes("***");
      const d = await api(sH.url, "POST", "/api/ring/linking/complete", { sessionId: LS });
      const completeOk = (d.json as { status?: string }).status === "completed";
      await sH.close();
      check.ok(nonceOk && confirmOk && completeOk, "23 linking flow");
    }
    // 24
    {
      const content = readFileSync(srv.deps.proof.path, "utf8");
      check.ok(
        content.includes("edge=api-ring mode=live listDevices ok") &&
          content.includes("edge=api-ring mode=bundle listDevices ok"),
        "24 ring proofs",
      );
    }
    // 25
    {
      const s = await api(base, "POST", "/api/ring/getSnapshot", { sessionId: A, args: { deviceId: "dev-door" } });
      const js = s.json as { ok?: boolean; data?: { contentType?: string; synthetic?: boolean } };
      const p = await api(base, "POST", "/api/ring/playChime", {
        sessionId: A,
        args: { deviceId: "dev-door", audioRef: "gentle_hello" },
      });
      const jp = p.json as { ok?: boolean; data?: { ok?: boolean; simulated?: boolean } };
      const w = await api(base, "POST", "/api/ring/stopWhep", {
        sessionId: A,
        args: { deviceId: "dev-door", whepSessionId: "whep-dev-door-1" },
      });
      const jw = w.json as { ok?: boolean; data?: unknown };
      check.ok(
        (js.data?.contentType ?? "").startsWith("image/") && js.data?.synthetic === true &&
          jp.ok === true && jp.data?.ok === true && jp.data?.simulated === true &&
          jw.ok === true && jw.data === null,
        "25 bundle media",
      );
    }
    // 26
    {
      const proofs = proofPaths.map((p) => {
        try {
          return readFileSync(p, "utf8");
        } catch {
          return "";
        }
      }).join("\n");
      const leaked =
        logLines.some((l) => l.includes("tok-test-123") || l.includes("bad-token")) ||
        proofs.includes("tok-test-123") || proofs.includes("bad-token");
      check.ok(!leaked, "26 no secret leaks");
    }
  } finally {
    await srv.close();
  }
} finally {
  await mock.close();
}

check.done();
