// e2e/scenarios/s-ring.spec.ts — the nine mandated-technology scenarios S-RING-1…9
// (DP-E2E-BROWSER-TESTING §5.3). Every Ring answer comes from the simulated Ring
// of the app fixture (createMockRingServer); nothing here is live Ring. The
// scenarios use mock-access-token, the simulated Ring's documented default
// token (a fixed mock credential that carries no secret).
// Requirement IDs: FR-01, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, NFR-01, NFR-12
import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";
import type { AppHandle } from "../fixtures";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  loadSampleWeek,
  openFirstCandidate,
  openHome,
  randomSecret,
  readModel,
  waitScene,
  settleSampleWeek,
} from "../helpers";
import { weekRibbon } from "src/domain/derive.js";
import { signPayload } from "src/ring/signature.js";

const MOCK_TOKEN = "mock-access-token";
const WRONG_TOKEN = "wrong-token-value";

/** The browser tab's server session id (sessionStorage "dr-session"). */
async function sessionId(page: Page): Promise<string> {
  const sid = await page.evaluate(() => sessionStorage.getItem("dr-session"));
  if (!sid) throw new Error("no browser session id in sessionStorage");
  return sid;
}

/** Presses Connect Ring, types a Playground token, submits, waits for the Ring chip to read Live. */
async function linkLive(page: Page, token: string = MOCK_TOKEN): Promise<void> {
  await page.getByRole("button", { name: "Connect Ring" }).first().click();
  const dialog = page.locator('[role="dialog"][aria-label="Connect Ring"]');
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.locator("input").fill(token);
  await dialog.getByRole("button", { name: "Use this token" }).click();
  await expect(
    page.locator(".appbar__cluster .status-chip", { hasText: "Ring" }),
  ).toContainText("Live", { timeout: 15_000 });
}

export interface PostedDelivery {
  status: number;
  elapsed: number;
}

/** Posts one signed webhook delivery straight at the server (node fetch, so no
 *  browser console line), built from WIRE_SAMPLES.webhookMotion with the given
 *  type/device/request id. Timestamps ride in `timestamp` and `meta.time` (the
 *  fields parseRingPayload reads); `occurred_at` is set too because WU-E2E-04
 *  names it, although the wire sample carries no such field. */
async function postDelivery(
  app: AppHandle,
  opts: {
    type: string;
    deviceId: string;
    subType?: string;
    componentId?: number;
    requestId: string;
    tsMs: number;
    badSignature?: boolean;
  },
): Promise<PostedDelivery> {
  const iso = new Date(opts.tsMs).toISOString();
  const payload = {
    event_id: `evt-${opts.requestId}`,
    timestamp: iso,
    occurred_at: iso,
    type: opts.type,
    account_id: "acct-demo",
    device_id: opts.deviceId,
    attributes: {
      ...(opts.subType !== undefined ? { sub_type: opts.subType } : {}),
      component_ids: [opts.componentId ?? 0],
    },
    meta: { request_id: opts.requestId, time: iso },
  };
  const raw = Buffer.from(JSON.stringify(payload));
  const signature = opts.badSignature === true ? `sha256=${"0".repeat(64)}` : signPayload(raw, app.secrets.webhook);
  const started = Date.now();
  const res = await fetch(`${app.url}/webhooks/ring`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": signature },
    body: raw,
  });
  await res.text();
  return { status: res.status, elapsed: Date.now() - started };
}

interface DrainDoc {
  ok?: boolean;
  data?: { meta?: { request_id?: string } }[];
}

async function drainOnce(app: AppHandle, sid: string): Promise<{ meta?: { request_id?: string } }[]> {
  const res = await fetch(`${app.url}/api/ring/drainWebhookInbox`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: sid, args: {} }),
  });
  const doc = (await res.json()) as DrainDoc;
  return doc.data ?? [];
}

/** Drains until every wanted request id has been seen (the webhook handler
 *  enqueues asynchronously). Accumulates across polls because each drain empties. */
async function drainUntil(
  app: AppHandle,
  sid: string,
  wantIds: string[],
): Promise<{ meta?: { request_id?: string } }[]> {
  const acc: { meta?: { request_id?: string } }[] = [];
  await expect
    .poll(
      async () => {
        for (const p of await drainOnce(app, sid)) {
          if (!acc.some((a) => a.meta?.request_id === p.meta?.request_id)) acc.push(p);
        }
        const ids = acc.map((p) => p.meta?.request_id);
        return wantIds.every((w) => ids.includes(w)) ? "ready" : ids.join(",");
      },
      { timeout: 10_000 },
    )
    .toBe("ready");
  return acc;
}

/** Calls POST /api/ring/<op> with the browser session id (node fetch). */
async function ringOp(
  app: AppHandle,
  op: string,
  sid: string,
  args: Record<string, unknown> = {},
): Promise<{ ok?: boolean; data?: unknown } & Record<string, unknown>> {
  const res = await fetch(`${app.url}/api/ring/${op}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: sid, args }),
  });
  return (await res.json()) as { ok?: boolean; data?: unknown } & Record<string, unknown>;
}

/** window.__doorstep.session.call(name, args, { source }) from the page. */
async function callAs(
  page: Page,
  name: string,
  args: unknown,
  source: "human" | "agent",
): Promise<{ ok?: boolean; summary?: string; error?: { message?: string } }> {
  return (await page.evaluate(
    ([n, a, s]) =>
      (
        window as unknown as {
          __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } };
        }
      ).__doorstep.session.call(n, a, { source: s }),
    [name, args, source],
  )) as { ok?: boolean; summary?: string; error?: { message?: string } };
}

/** window.__doorstep.session.store.dispatch(name, args, source) — the store
 *  actions (set_ui, set_consent) are not registry actions, so session.call
 *  would answer "Unknown action" (DP-UI's useUiActions documents the same). */
async function dispatchAs(
  page: Page,
  name: string,
  args: unknown,
  source: "human" = "human",
): Promise<{ ok?: boolean }> {
  return (await page.evaluate(
    ([n, a, s]) =>
      (
        window as unknown as {
          __doorstep: { session: { store: { dispatch(n: string, a: unknown, s: unknown): unknown } } };
        }
      ).__doorstep.session.store.dispatch(n, a, s),
    [name, args, source],
  )) as { ok?: boolean };
}

/** Ingests the webhook inbox until `total` fresh events have landed in total
 *  across calls (each ingest drains, so partial async arrivals accumulate). */
async function ingestWebhooks(page: Page, total: number): Promise<void> {
  let added = 0;
  await expect
    .poll(
      async () => {
        const r = await callAs(page, "ingest_ring_events", { source: "webhook_inbox" }, "human");
        if (r.ok !== true) return `ERR ${r.summary ?? ""}`;
        const m = /Added (\d+) events/.exec(r.summary ?? "");
        added += m ? Number(m[1]) : 0;
        return added;
      },
      { timeout: 15_000 },
    )
    .toBe(total);
}

function byPathCount(app: AppHandle, fragment: string): number {
  const byPath = app.stats()?.byPath ?? {};
  return Object.entries(byPath)
    .filter(([k]) => k.includes(fragment))
    .reduce((n, [, v]) => n + (v as number), 0);
}

function byPathKeys(app: AppHandle, fragment: string): string[] {
  return Object.keys(app.stats()?.byPath ?? {}).filter((k) => k.includes(fragment));
}

test("S-RING-1 signed webhooks are accepted once and bad ones are refused", async ({ page, app }) => {
  await openHome(page);
  await loadSampleWeek(page);
  await linkLive(page);
  const sid = await sessionId(page);
  const ticksBefore = await page.locator(".tick").count();
  const reqA = `req-${randomSecret(4)}`;
  const reqB = `req-${randomSecret(4)}`;
  const tMotion = Date.parse("2026-10-13T09:14:05Z");
  const tButton = Date.parse("2026-10-13T09:20:00Z");
  const d1 = await postDelivery(app, {
    type: "motion_detected",
    deviceId: "dev-door",
    subType: "human",
    componentId: 0,
    requestId: reqA,
    tsMs: tMotion,
  });
  expect(d1.status).toBe(200);
  expect(d1.elapsed).toBeLessThan(5000);
  const d2 = await postDelivery(app, {
    type: "button_press",
    deviceId: "dev-door",
    componentId: 0,
    requestId: reqB,
    tsMs: tButton,
  });
  expect(d2.status).toBe(200);
  expect(d2.elapsed).toBeLessThan(5000);
  const dup = await postDelivery(app, {
    type: "motion_detected",
    deviceId: "dev-door",
    subType: "human",
    componentId: 0,
    requestId: reqA,
    tsMs: tMotion,
  });
  expect(dup.status).toBe(200);
  const bad = await postDelivery(app, {
    type: "motion_detected",
    deviceId: "dev-door",
    subType: "human",
    componentId: 0,
    requestId: `req-${randomSecret(4)}`,
    tsMs: tMotion,
    badSignature: true,
  });
  expect(bad.status).toBe(401);
  // The direct drain returns the two payloads with the first one only once.
  const drained = await drainUntil(app, sid, [reqA, reqB]);
  const drainedIds = drained.map((p) => p.meta?.request_id);
  expect(drainedIds.filter((id) => id === reqA)).toHaveLength(1);
  expect(drainedIds).toContain(reqB);
  // A drain consumes the queue, so a second pair with fresh request ids proves
  // the ingest path: the same two moments land in the model as two events.
  const reqC = `req-${randomSecret(4)}`;
  const reqD = `req-${randomSecret(4)}`;
  await postDelivery(app, {
    type: "motion_detected",
    deviceId: "dev-door",
    subType: "human",
    componentId: 0,
    requestId: reqC,
    tsMs: tMotion,
  });
  await postDelivery(app, {
    type: "button_press",
    deviceId: "dev-door",
    componentId: 0,
    requestId: reqD,
    tsMs: tButton,
  });
  const eventsBefore = (await readModel(page)).events.length;
  await ingestWebhooks(page, 2);
  const model = await readModel(page);
  expect(model.events.length).toBe(eventsBefore + 2);
  const ribbon = weekRibbon(model);
  const day = ribbon.find((d) => d.ticks.some((t) => t.id === `evt:${reqC}`));
  expect(day).toBeDefined();
  expect(day?.dayStartMs).toBeLessThanOrEqual(tMotion);
  expect(tMotion).toBeLessThan((day?.dayStartMs ?? 0) + 86_400_000);
  expect(day?.ticks.map((t) => t.id)).toContain(`evt:${reqD}`);
  expect(await page.locator(".tick").count()).toBe(ticksBefore + 2);
  expect(app.stats()?.requests).toBeGreaterThan(0);
  expect(byPathCount(app, "/v1/devices")).toBeGreaterThanOrEqual(1);
});

test("S-RING-2 offline and online make an outage band", async ({ page, app }) => {
  await openHome(page);
  await loadSampleWeek(page);
  // The inbox drains through the live port, so the session must be linked live
  // before the offline/online pair can be ingested.
  await linkLive(page);
  const sid = await sessionId(page);
  void sid;
  expect(byPathCount(app, "/v1/devices")).toBeGreaterThanOrEqual(1);
  const tOff = Date.parse("2026-10-14T09:00:00Z");
  const tOn = tOff + 40 * 60 * 1000;
  const reqOff = `req-${randomSecret(4)}`;
  const reqOn = `req-${randomSecret(4)}`;
  const d1 = await postDelivery(app, { type: "device_offline", deviceId: "dev-door", requestId: reqOff, tsMs: tOff });
  expect(d1.status).toBe(200);
  const d2 = await postDelivery(app, { type: "device_online", deviceId: "dev-door", requestId: reqOn, tsMs: tOn });
  expect(d2.status).toBe(200);
  await ingestWebhooks(page, 2);
  const model = await readModel(page);
  const ribbon = weekRibbon(model);
  const day = ribbon.find((d) => d.dayStartMs <= tOff && tOff < d.dayStartMs + 86_400_000);
  expect(day).toBeDefined();
  expect(day?.outages).toHaveLength(1);
  expect(day?.outages[0]?.minutes).toBe(40);
  const band = page.locator(".outage-band", { hasText: "40 min offline" });
  await expect(band).toHaveCount(1);
  await expect(band).toHaveAttribute("title", /40 min/);
});

test("S-RING-3 history fills a webhook gap and the seam shows", async ({ page, app }) => {
  await openHome(page);
  await loadSampleWeek(page);
  await linkLive(page);
  const reqH = `req-${randomSecret(4)}`;
  const tHook = Date.parse("2026-10-16T08:00:00Z");
  const posted = await postDelivery(app, {
    type: "motion_detected",
    deviceId: "dev-door",
    subType: "human",
    componentId: 0,
    requestId: reqH,
    tsMs: tHook,
  });
  expect(posted.status).toBe(200);
  await ingestWebhooks(page, 1);
  const reconciled = await callAs(page, "reconcile_webhook_gap", { deviceId: "dev-door" }, "human");
  expect(reconciled.ok).toBe(true);
  expect(byPathCount(app, "/v1/history/devices/dev-door/events")).toBeGreaterThanOrEqual(1);
  const model = await readModel(page);
  const ribbon = weekRibbon(model);
  const seamDay = ribbon.find((d) => d.dayStartMs <= tHook && tHook < d.dayStartMs + 86_400_000);
  expect(seamDay?.seamMinute).not.toBeNull();
  const seam = page.locator(".seam", { hasText: "from history" });
  await expect(seam).toHaveCount(1);
});

test("S-RING-4 a token links the live Ring and is never echoed", async ({ page, app, guard }) => {
  test.info().skip(!app.local, "needs the local fixture with the simulated Ring");
  guard.allow("Failed to load resource: the server responded with a status of 401 (Unauthorized)");
  await openHome(page);
  // Console capture through CDP keeps the guard the only page.on("console")
  // subscriber while still observing every console message for the absence scan.
  const cdp = await page.context().newCDPSession(page);
  const consoleTexts: string[] = [];
  cdp.on("Runtime.consoleAPICalled", (ev) => {
    const args = (ev.args ?? []) as { value?: unknown; description?: string }[];
    consoleTexts.push(
      args.map((a) => (typeof a.value === "string" ? a.value : (a.description ?? ""))).join(" "),
    );
  });
  cdp.on("Log.entryAdded", (ev) => {
    if (ev.entry.text !== "") consoleTexts.push(ev.entry.text);
  });
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  try {
    await loadSampleWeek(page);
    // The background ingest must be done before the token flow: its last landing
    // clears the banner the wrong token raised (FIX-22).
    await settleSampleWeek(page);
    // Wrong token first: the banner names the failure and the field is emptied.
    await page.getByRole("button", { name: "Connect Ring" }).first().click();
    const dialog = page.locator('[role="dialog"][aria-label="Connect Ring"]');
    await dialog.waitFor({ timeout: 10_000 });
    await dialog.locator("input").fill(WRONG_TOKEN);
    await dialog.getByRole("button", { name: "Use this token" }).click();
    // The dialog's callout and the banner (while the app is still in live mode) both say it.
    await expect(page.getByText("Couldn't read Ring").first()).toBeVisible({ timeout: 15_000 });
    // The refusal stays in the dialog (DP-UI: the field is emptied, the message is shown there).
    await dialog.waitFor({ timeout: 10_000 });
    expect(await dialog.locator("input").inputValue()).toBe("");
    await page.keyboard.press("Escape");
    // Then the mock token links live.
    await linkLive(page, MOCK_TOKEN);
    const sid = await sessionId(page);
    await expect(page.locator(".appbar__cluster .status-chip", { hasText: "Ring" })).toContainText("Live");
    const devRes = await ringOp(app, "listDevices", sid);
    expect(devRes.ok).toBe(true);
    const devices = (devRes.data ?? []) as { id: string; description: string }[];
    expect(devices.length).toBeGreaterThan(0);
    const listText = (await page.locator("aside.rail .device-list").innerText()) ?? "";
    for (const d of devices) expect(listText).toContain(d.description);
    // The nonce call proves the /v1/users/me path against the mock (mock
    // request counters are worker-cumulative, so this keeps the test
    // self-contained however the file is run).
    const nonceRes = await ringOp(app, "linking/nonce", sid);
    expect(nonceRes.ok).toBe(true);
    expect(typeof (nonceRes as Record<string, unknown>)["nonce"]).toBe("string");
    const byPath = app.stats()?.byPath ?? {};
    expect(Object.keys(byPath).some((k) => k.includes("/v1/devices"))).toBe(true);
    expect(Object.keys(byPath).some((k) => k.includes("/v1/users/me"))).toBe(true);
    // The token text appears nowhere: DOM, storage, console, proof log.
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    expect(html).not.toContain(MOCK_TOKEN);
    expect(html).not.toContain(WRONG_TOKEN);
    const stores = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(stores).not.toContain(MOCK_TOKEN);
    expect(stores).not.toContain(WRONG_TOKEN);
    expect(consoleTexts.join("\n")).not.toContain(MOCK_TOKEN);
    expect(consoleTexts.join("\n")).not.toContain(WRONG_TOKEN);
    const proofLog = app.proofLog;
    expect(proofLog).not.toBe("");
  } finally {
    await cdp.detach().catch(() => undefined);
  }
  const { readFileSync } = await import("node:fs");
  const logged = readFileSync(app.proofLog, "utf8");
  expect(logged).not.toContain(MOCK_TOKEN);
  expect(logged).not.toContain(WRONG_TOKEN);
});

test("S-RING-5 the live view opens, counts down and closes", async ({ page, app }) => {
  test.info().skip(!app.local, "needs the local fixture with the simulated Ring");
  // Stubbed RTCPeerConnection, as DP-UI WU-10 does in scripts/verify/ui-10-liveview.ts.
  await page.addInitScript(`
    window.RTCPeerConnection = class {
      constructor() { this.transceivers = []; }
      addTransceiver(kind, opts) { this.transceivers.push([kind, opts]); return {}; }
      async createOffer() { return { type: "offer", sdp: "v=0\\r\\no=- 0 0 IN IP4 127.0.0.1" }; }
      async setLocalDescription(d) { this._local = d; }
      async setRemoteDescription(d) { this._remote = d; }
      set ontrack(fn) { this._track = fn; }
      get ontrack() { return this._track; }
      close() {}
    };
  `);
  await openHome(page);
  await loadSampleWeek(page);
  await linkLive(page);
  await dispatchAs(page, "set_ui", { liveViewDeviceId: "dev-door" });
  await expect(page.getByText("Simulated live view — the sample week has no camera stream.")).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(async () => byPathKeys(app, "whep/sessions").length, { timeout: 10_000 })
    .toBe(1);
  await page.locator("[data-live-view] button", { hasText: "Close" }).click();
  await expect
    .poll(async () => byPathKeys(app, "whep/sessions").length, { timeout: 10_000 })
    .toBe(2);
  await expect(page.locator("[data-live-view]")).toHaveCount(0);
  expect(app.stats()?.requests).toBeGreaterThan(0);
});

test("S-RING-6 a snapshot becomes the picture on a moment", async ({ page, app }) => {
  await openHome(page);
  await loadSampleWeek(page);
  await linkLive(page);
  const incidentId = await openFirstCandidate(page);
  expect(incidentId).not.toBeNull();
  const img = page.getByRole("img", { name: /^Snapshot from / }).first();
  await expect(img).toBeVisible({ timeout: 10_000 });
  const src = await img.getAttribute("src");
  // Plan-literal (§5.3 S-RING-6): the img is non-empty. The simulated Ring
  // serves the bundle's 1-byte synthetic snapshot, so no length beyond
  // non-empty is asserted here (FIX-2).
  expect(src?.startsWith("data:")).toBe(true);
  expect((src ?? "").length).toBeGreaterThan(0);
  expect(byPathCount(app, "/media/image/download")).toBeGreaterThanOrEqual(1);
});

test("S-RING-7 two cameras make one thread", async ({ page, app }) => {
  test.info().skip(!app.local, "needs the local fixture with the simulated Ring");
  // The scene is mounted by this first load, so the visit created below lands
  // in the live model the scene is already bound to (no reload in between).
  await openHome(page, { path: "/?quality=low" });
  await loadSampleWeek(page);
  await linkLive(page);
  expect(byPathCount(app, "/v1/devices")).toBeGreaterThanOrEqual(1);
  const tDoor = Date.parse("2026-10-15T10:00:00Z");
  const tElite = tDoor + 20 * 1000;
  const reqDoor = `req-${randomSecret(4)}`;
  const reqElite = `req-${randomSecret(4)}`;
  const p1 = await postDelivery(app, {
    type: "motion_detected",
    deviceId: "dev-door",
    subType: "human",
    componentId: 0,
    requestId: reqDoor,
    tsMs: tDoor,
  });
  expect(p1.status).toBe(200);
  const p2 = await postDelivery(app, {
    type: "motion_detected",
    deviceId: "dev-elite",
    subType: "human",
    componentId: 1,
    requestId: reqElite,
    tsMs: tElite,
  });
  expect(p2.status).toBe(200);
  await ingestWebhooks(page, 2);
  const model = await readModel(page);
  const visit = model.visits.find(
    (v) => v.eventIds.includes(`evt:${reqDoor}`) && v.eventIds.includes(`evt:${reqElite}`),
  );
  expect(visit).toBeDefined();
  expect(new Set(visit?.hops ?? []).size).toBeGreaterThanOrEqual(2);
  // window.__scene3d exposes entityIds() (the probe of src/3d/probe.ts has no
  // entities(); entityIds() is its read-only list).
  await waitScene(page);
  const ids = await page.evaluate(
    () =>
      (window as unknown as { __scene3d?: { entityIds(): string[] } }).__scene3d?.entityIds() ?? null,
  );
  expect(ids).not.toBeNull();
  expect(ids ?? []).toContain(`thread:${visit?.id ?? ""}`);
});

test("S-RING-8 the chime needs consent and approval", async ({ page, app }) => {
  await openHome(page);
  await loadSampleWeek(page);
  await linkLive(page);
  expect(byPathCount(app, "/media/audio/playback")).toBe(0);
  const refused = await callAs(
    page,
    "play_chime_announcement",
    { deviceId: "dev-door", audioRef: "gentle_hello" },
    "agent",
  );
  expect(refused.ok).toBe(false);
  expect(`${refused.summary ?? ""} ${refused.error?.message ?? ""}`).toMatch(/consent/i);
  expect(byPathCount(app, "/media/audio/playback")).toBe(0);
  // Grant consent as the person: set_consent is a store action (actor human),
  // not a registry action.
  const granted = await dispatchAs(page, "set_consent", {
    scope: "chime_announcement",
    granted: true,
    actor: "human",
  });
  expect(granted.ok).not.toBe(false);
  expect(
    (await readModel(page)).consent.find((c) => c.scope === "chime_announcement")?.granted,
  ).toBe(true);
  await page.evaluate(() => {
    const w = window as unknown as {
      __chimeResult: unknown;
      __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } };
    };
    w.__chimeResult = null;
    void w.__doorstep.session
      .call("play_chime_announcement", { deviceId: "dev-door", audioRef: "gentle_hello" }, { source: "agent" })
      .then((r) => {
        w.__chimeResult = JSON.parse(JSON.stringify(r));
      });
  });
  const approve = page.locator('[data-result-region="approval-bar"] button', { hasText: "Approve" }).first();
  await expect(approve).toBeVisible({ timeout: 15_000 });
  await approve.click();
  await page.waitForFunction(() => (window as unknown as { __chimeResult?: unknown }).__chimeResult !== null, {
    timeout: 15_000,
  });
  const result = (await page.evaluate(
    () => (window as unknown as { __chimeResult?: unknown }).__chimeResult,
  )) as { ok?: boolean };
  expect(result.ok).toBe(true);
  expect(byPathCount(app, "/media/audio/playback")).toBe(1);
});

test("S-RING-9 account linking runs nonce, confirm, complete", async ({ page, app }) => {
  await openHome(page);
  await loadSampleWeek(page);
  await linkLive(page);
  const sid = await sessionId(page);
  const meRes = await fetch(`${app.ring?.url ?? ""}/v1/users/me`, {
    headers: { authorization: `Bearer ${MOCK_TOKEN}` },
  });
  expect(meRes.status).toBe(200);
  const me = (await meRes.json()) as { data?: { id?: string } };
  const rawId = me.data?.id ?? "";
  expect(rawId).not.toBe("");
  const nonceRes = await ringOp(app, "linking/nonce", sid);
  expect(nonceRes.ok).toBe(true);
  const nonce = (nonceRes as Record<string, unknown>)["nonce"];
  const accountId = (nonceRes as Record<string, unknown>)["accountId"];
  expect(typeof nonce).toBe("string");
  expect(typeof accountId).toBe("string");
  // The linking routes read their fields at the top level of the JSON body
  // (unlike /api/ring/:op, which reads body.args), so confirm is posted flat.
  const confirmRaw = await fetch(`${app.url}/api/ring/linking/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: sid, accountIdentifier: accountId, nonce }),
  });
  const confirmRes = (await confirmRaw.json()) as { ok?: boolean } & Record<string, unknown>;
  expect(confirmRes.ok).toBe(true);
  expect((confirmRes as Record<string, unknown>)["status"]).toBe("awaiting");
  const completeRes = await ringOp(app, "linking/complete", sid);
  expect(completeRes.ok).toBe(true);
  expect((completeRes as Record<string, unknown>)["status"]).toBe("completed");
  const bodies = JSON.stringify([nonceRes, confirmRes, completeRes]);
  expect(bodies).not.toContain(rawId);
  expect(Object.keys(app.stats()?.byPath ?? {}).some((k) => k.includes("/v1/accounts/me/app-integrations"))).toBe(
    true,
  );
  const again = await ringOp(app, "linking/complete", sid);
  expect(again.ok).not.toBe(true);
  const direct = await fetch(`${app.ring?.url ?? ""}/v1/accounts/me/app-integrations`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${MOCK_TOKEN}` },
    body: JSON.stringify({ status: "completed" }),
  });
  expect(direct.status).toBe(409);
});

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// A failing guard retires the Playwright worker, so each test may see a fresh
// mock: every test therefore records its own per-path counters, and the merge
// below (plus scripts/verify/e2e-04-ring.ts check 3) sums them. e2e/artifacts/
// is gitignored; these files never reach the repository.
test.afterEach("record ring stats", async ({ app }, testInfo) => {
  const stats = app.stats();
  mkdirSync("e2e/artifacts/ring-stats", { recursive: true });
  writeFileSync(
    `e2e/artifacts/ring-stats/frag-${slug(testInfo.title)}.json`,
    JSON.stringify({ requests: stats?.requests ?? 0, byPath: stats?.byPath ?? {} }),
  );
});

test.afterAll("write ring stats", async ({ app }) => {
  // The mock's per-path counters for scripts/verify/e2e-04-ring.ts check 3:
  // this worker's own counts merged with every per-test fragment on disk. The
  // merge takes the per-key maximum (fragments may overlap when a worker is
  // reused); check 3 reads presence per fragment, which is exact under max.
  const { readdirSync, readFileSync } = await import("node:fs");
  const merged: Record<string, number> = { ...(app.stats()?.byPath ?? {}) };
  let dir: string[] = [];
  try {
    dir = readdirSync("e2e/artifacts/ring-stats");
  } catch {
    dir = [];
  }
  for (const f of dir) {
    if (!f.startsWith("frag-") || !f.endsWith(".json")) continue;
    try {
      const frag = JSON.parse(readFileSync(`e2e/artifacts/ring-stats/${f}`, "utf8")) as {
        byPath?: Record<string, number>;
      };
      for (const [k, v] of Object.entries(frag.byPath ?? {})) merged[k] = Math.max(merged[k] ?? 0, v);
    } catch {
      /* a half-written fragment from a crashed worker is ignored */
    }
  }
  mkdirSync("e2e/artifacts", { recursive: true });
  writeFileSync(
    "e2e/artifacts/ring-stats.json",
    JSON.stringify(
      { requests: Object.values(merged).reduce((n, v) => n + v, 0), byPath: merged },
      null,
      2,
    ),
  );
});
