// Requirement IDs: FR-11
// WU-API-TRANSPORT-04: webhook receiver, inbox draining, simulated deliveries.
import { readFileSync } from "node:fs";
import { createLogger } from "src/server/logger.js";
import { parseRingPayload } from "src/domain/parse.js";
import { signPayload } from "src/ring/signature.js";
import { WIRE_SAMPLES } from "src/ring/wire.js";
import { buildSimulatedWebhook } from "src/server/simulate.js";
import { createMockRingServer } from "../mock-ring-server.js";
import { api, createChecker, startTestServer } from "./at-kit.js";

const check = createChecker("at-04-webhook");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => Promise<boolean>, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  for (;;) {
    if (await cond()) return true;
    if (Date.now() >= end) return false;
    await sleep(50);
  }
}

const agentStub = {
  state: () => ({ kind: "bedrock", label: "t", model: "t", rung: "bedrock" }) as const,
};
const SECRET = "whsec-test-1";
const mock = await createMockRingServer({ accessTokens: ["tok-test-123"], webhookSecret: SECRET });
try {
  const logLines: string[] = [];
  const srv = await startTestServer({
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1", RING_WEBHOOK_SECRET: SECRET },
    ringBaseUrl: mock.url,
    oauthUrl: mock.oauthUrl,
    overrides: { log: createLogger({ write: (l) => logLines.push(l) }), agent: agentStub as never },
  });
  const base = srv.url;
  const sign = (raw: string): string => signPayload(Buffer.from(raw, "utf8"), SECRET);
  const postRaw = (raw: string, sig?: string): Promise<Response> =>
    fetch(base + "/webhooks/ring", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(sig !== undefined ? { "x-signature": sig } : {}),
      },
      body: raw,
    });

  const motionRaw = JSON.stringify(WIRE_SAMPLES.webhookMotion);

  // 1
  {
    const r = await postRaw(motionRaw, sign(motionRaw));
    const t = await r.text();
    check.ok(
      r.status === 200 && t === '{"ok":true}' && (r.headers.get("content-type") ?? "").includes("application/json"),
      "1 signed webhook",
    );
  }
  // 2
  {
    const t0 = Date.now();
    await postRaw(motionRaw, sign(motionRaw));
    check.ok(Date.now() - t0 < 300, "2 fast ack");
  }
  // 3
  {
    const seen = await waitFor(async () => {
      const st = await api(base, "GET", "/api/status");
      return (st.json as { inbox?: { default?: number } }).inbox?.default === 1;
    }, 500);
    check.ok(seen, "3 inbox queued");
  }
  // 4
  {
    const r = await postRaw(motionRaw, sign(motionRaw));
    const t = await r.text();
    const st = await api(base, "GET", "/api/status");
    check.ok(
      r.status === 200 && t === '{"ok":true,"duplicate":true}' &&
        (st.json as { inbox?: { default?: number } }).inbox?.default === 1,
      "4 duplicate",
    );
  }
  // 5
  {
    const before = (await api(base, "GET", "/api/status")).json as { inbox?: { default?: number } };
    const r = await postRaw(motionRaw, "sha256=" + "0".repeat(64));
    const after = (await api(base, "GET", "/api/status")).json as { inbox?: { default?: number } };
    check.ok(r.status === 401 && before.inbox?.default === after.inbox?.default, "5 wrong signature");
  }
  // 6
  {
    const r = await postRaw(motionRaw);
    check.ok(r.status === 401, "6 missing signature");
  }
  // 7
  {
    const s2 = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      ringBaseUrl: mock.url,
      oauthUrl: mock.oauthUrl,
      overrides: { agent: agentStub as never },
    });
    const r = await fetch(s2.url + "/webhooks/ring", {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": sign(motionRaw) },
      body: motionRaw,
    });
    await s2.close();
    check.ok(r.status === 503, "7 secret unset");
  }
  // 8
  {
    const big = " ".repeat(300 * 1024);
    const r = await postRaw(big, sign(big));
    const t = await r.text();
    check.ok(r.status === 413 && t === '{"ok":false,"error":"too large"}', "8 body limit");
  }
  // 9
  {
    const raw = "{not json";
    const r = await postRaw(raw, sign(raw));
    check.ok(r.status === 400, "9 bad json");
  }
  // 10
  {
    const found = await waitFor(async () => {
      const ev = await api(base, "GET", "/events");
      const list = (ev.json as { events?: { step_id?: string; payload?: Record<string, unknown> }[] }).events ?? [];
      return list.some((e) => e.step_id === "ring-webhook");
    }, 500);
    const ev = await api(base, "GET", "/events");
    const list = (ev.json as { events?: { step_id?: string; payload?: Record<string, unknown> }[] }).events ?? [];
    const e = list.find((x) => x.step_id === "ring-webhook");
    const keys = e?.payload ? Object.keys(e.payload).sort() : [];
    check.ok(
      found && JSON.stringify(keys) === JSON.stringify(["deviceId", "requestId", "simulated", "tsMs", "type"]),
      "10 webhook envelope",
    );
  }
  // 11
  {
    const before = (await api(base, "GET", "/api/status")).json as { inbox?: { default?: number } };
    const payload = JSON.stringify({ ...(WIRE_SAMPLES.webhookMotion as Record<string, unknown>), type: "device_added" });
    const r = await postRaw(payload, sign(payload));
    const after = (await api(base, "GET", "/api/status")).json as { inbox?: { default?: number } };
    const ev = await api(base, "GET", "/events");
    const list = (ev.json as { events?: { step_id?: string }[] }).events ?? [];
    check.ok(
      r.status === 200 && before.inbox?.default === after.inbox?.default &&
        list.some((e) => e.step_id === "ring-webhook"),
      "11 unknown type",
    );
  }
  // 12
  {
    const content = readFileSync(srv.deps.proof.path, "utf8");
    check.ok(content.includes("edge=api-inbox mode=live webhook motion_detected accepted req-0001"), "12 inbox proof");
  }
  // 13
  {
    // extra spaces + trailing newline + a non-ascii char inside the JSON,
    // signed over the exact bytes (the route verifies raw bytes, not a re-serialisation)
    const signed = (() => {
      const p = JSON.parse(JSON.stringify(WIRE_SAMPLES.webhookButton)) as Record<string, unknown>;
      const meta = { ...((p["meta"] as Record<string, unknown>) ?? {}) };
      meta["request_id"] = "req-spaces-1";
      p["meta"] = meta;
      p["note"] = "café";
      return "  " + JSON.stringify(p) + "\n";
    })();
    const r = await postRaw(signed, sign(signed));
    check.ok(r.status === 200, "13 raw bytes");
  }
  // 14
  {
    const r = await api(base, "POST", "/api/dev/simulate-webhook", {
      type: "motion_detected",
      deviceId: "dev-door",
      subType: "human",
    });
    const j = r.json as { ok?: boolean; requestId?: string };
    check.ok(
      r.status === 200 && j.ok === true && typeof j.requestId === "string" && /^sim-\d+-\d+$/.test(j.requestId),
      "14 simulate",
    );
  }
  // 15
  {
    const sid = "sess-sim-0001";
    const r = await api(base, "POST", "/api/dev/simulate-webhook", {
      type: "motion_detected",
      deviceId: "dev-door",
      sessionId: sid,
    });
    const rid = (r.json as { requestId?: string }).requestId as string;
    const d = await api(base, "POST", "/api/ring/drainWebhookInbox", { sessionId: sid, args: {} });
    const items = (d.json as { data?: { simulated?: boolean; device_id?: string; meta?: { request_id?: string } }[] }).data ?? [];
    const last = items[items.length - 1];
    const st = await api(base, "GET", "/api/status");
    const defCount = (st.json as { inbox?: { default?: number } }).inbox?.default ?? -1;
    const dflt = await api(base, "POST", "/api/ring/drainWebhookInbox", { sessionId: "sess-sim-0002", args: {} });
    const dfltItems = (dflt.json as { data?: { meta?: { request_id?: string } }[] }).data ?? [];
    check.ok(
      last?.simulated === true && last?.device_id === "dev-door" &&
        !dfltItems.some((x) => x.meta?.request_id === rid) && defCount >= 1,
      "15 simulated session inbox",
    );
  }
  // 16
  {
    const bad = await api(base, "POST", "/api/dev/simulate-webhook", { type: "nope", deviceId: "dev-door" });
    const sNoSec = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      ringBaseUrl: mock.url,
      oauthUrl: mock.oauthUrl,
      overrides: { agent: agentStub as never },
    });
    const noSec = await api(sNoSec.url, "POST", "/api/dev/simulate-webhook", {
      type: "motion_detected",
      deviceId: "dev-door",
    });
    const noSecJ = noSec.json as { error?: { code?: string } };
    await sNoSec.close();
    const sProd = await startTestServer({
      env: { NODE_ENV: "production", BUILD_MARKER: "test-1", RING_WEBHOOK_SECRET: SECRET },
      ringBaseUrl: mock.url,
      oauthUrl: mock.oauthUrl,
      overrides: { agent: agentStub as never },
    });
    const prod = await api(sProd.url, "POST", "/api/dev/simulate-webhook", {
      type: "motion_detected",
      deviceId: "dev-door",
    });
    const sAllow = await startTestServer({
      env: { NODE_ENV: "production", BUILD_MARKER: "test-1", RING_WEBHOOK_SECRET: SECRET, ALLOW_SIMULATE: "1" },
      ringBaseUrl: mock.url,
      oauthUrl: mock.oauthUrl,
      overrides: { agent: agentStub as never },
    });
    const allow = await api(sAllow.url, "POST", "/api/dev/simulate-webhook", {
      type: "motion_detected",
      deviceId: "dev-door",
    });
    await sProd.close();
    await sAllow.close();
    check.ok(
      bad.status === 400 && noSec.status === 503 && noSecJ.error?.code === "not_configured" &&
        prod.status === 404 && allow.status === 200,
      "16 simulate gates",
    );
  }
  // 17
  {
    const ev = await api(base, "GET", "/events");
    const list = (ev.json as { events?: { step_id?: string; payload?: { simulated?: boolean } }[] }).events ?? [];
    const content = readFileSync(srv.deps.proof.path, "utf8");
    check.ok(
      list.some((e) => e.step_id === "ring-webhook" && e.payload?.simulated === true) &&
        content.includes("edge=api-inbox mode=simulated"),
      "17 simulated envelope+proof",
    );
  }
  // 18
  {
    const events = parseRingPayload(
      buildSimulatedWebhook({ type: "motion_detected", deviceId: "dev-door", subType: "human" }, 1760000000000, 7),
    );
    check.ok(
      events.length === 1 && events[0]?.type === "motion_detected" && events[0]?.subType === "human" &&
        events[0]?.id === "evt:sim-1760000000000-7",
      "18 simulated parse",
    );
  }
  // 19
  {
    const b = buildSimulatedWebhook({ type: "button_press", deviceId: "dev-door" }, 1760000000000, 1) as {
      attributes?: unknown;
    };
    const o = buildSimulatedWebhook({ type: "device_offline", deviceId: "dev-elite" }, 1760000000000, 2) as {
      attributes?: unknown;
    };
    check.ok(
      JSON.stringify(b.attributes) === JSON.stringify({ component_ids: [0] }) &&
        JSON.stringify(o.attributes) === JSON.stringify({}),
      "19 simulated shapes",
    );
  }
  // 20
  {
    const LS = "sess-live-web1";
    await api(base, "POST", "/api/ring/token", { sessionId: LS, token: "tok-test-123" });
    const mock2 = await createMockRingServer({
      webhookSecret: SECRET,
      webhookTarget: base + "/webhooks/ring",
    });
    const emitted = await mock2.emitWebhook({ type: "motion_detected", deviceId: "dev-door" });
    let found: { meta?: { request_id?: string } } | null = null;
    const end = Date.now() + 1000;
    while (Date.now() < end && !found) {
      const d = await api(base, "POST", "/api/ring/drainWebhookInbox", { sessionId: LS, args: {} });
      const items = (d.json as { data?: { meta?: { request_id?: string } }[] }).data ?? [];
      found = items.find((x) => x.meta?.request_id === emitted.requestId) ?? null;
      if (!found) await sleep(50);
    }
    await mock2.close();
    check.ok(emitted.status === 200 && found !== null, "20 live webhook drain");
  }

  await srv.close();
} finally {
  await mock.close();
}

check.done();
