// scripts/verify/ui-10-liveview.ts — DP-UI WU-UI-10 (12 checks).
// Requirement IDs: FR-13, FR-14
import type { WeekModel } from "src/domain/types.js";
import { createChecker, openApp, readModel } from "./ui-kit.js";

const STUB = `
window.__pc = { created: 0, closed: 0, offers: 0, local: 0, remote: [], instances: [] };
window.RTCPeerConnection = class {
  constructor() {
    const rec = window.__pc;
    rec.created += 1;
    rec.instances.push(this);
    this.transceivers = [];
    this._track = null;
  }
  addTransceiver(kind, opts) { this.transceivers.push([kind, opts]); return {}; }
  async createOffer() { window.__pc.offers += 1; return { type: "offer", sdp: "v=0\\r\\no=- 0 0 IN IP4 127.0.0.1" }; }
  async setLocalDescription(d) { window.__pc.local += 1; this._local = d; }
  async setRemoteDescription(d) { window.__pc.remote.push(d); }
  set ontrack(fn) { this._track = fn; }
  get ontrack() { return this._track; }
  close() { window.__pc.closed += 1; }
};
window.__fireTrack = () => {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 4;
  const stream = c.captureStream();
  const last = window.__pc.instances[window.__pc.instances.length - 1];
  if (last && last._track) last._track({ streams: [stream], track: {} });
  return true;
};
`;

const c = createChecker("ui-10-liveview");
const run = await openApp({ path: "/?hook=1", initScript: STUB });
const seen: string[] = [];
try {
  const page = run.page;
  page.on("request", (r) => seen.push(r.url()));

  await page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
  await page.waitForFunction(() => document.querySelectorAll(".tick").length > 20, { timeout: 30000 });
  const incidentId = await page.evaluate(async () => {
    const w = window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } };
    return w.__doorstep.openFirstCandidate();
  });
  if (!incidentId) throw new Error("no candidate incident");
  await page.locator(".pencil-circle").first().waitFor({ timeout: 10000 });

  let mode: "simulated" | "short" | "fail" | "real" = "simulated";
  const starts: Record<string, unknown>[] = [];
  const stops: Record<string, unknown>[] = [];
  await page.route("**/api/ring/startWhep", (route) => {
    starts.push((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
    if (mode === "fail") {
      void route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: { status: 502, code: "upstream", message: "Ring did not answer." } }) });
      return;
    }
    const maxSeconds = mode === "short" ? 2 : 30;
    const answerSdp = mode === "real" ? "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96" : "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\nSIMULATED";
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { sessionId: `whep-${starts.length}`, answerSdp, maxSeconds, expiresInSec: maxSeconds } }),
    });
  });
  await page.route("**/api/ring/stopWhep", (route) => {
    stops.push((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
    void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: null }) });
  });

  const pc = async (): Promise<{ created: number; closed: number; remote: { type: string }[] }> =>
    page.evaluate(() => ({ created: window.__pc.created as number, closed: window.__pc.closed as number, remote: window.__pc.remote as { type: string }[] }));

  // 1. Live view opens on the snapshot's device.
  {
    await page.locator('[data-slot="incident"] button:has-text("Live view")').click();
    await page.locator("[data-live-view]").waitFor({ timeout: 10000 });
    const model = (await readModel(page)) as unknown as WeekModel;
    const media = model.media.find((m) => m.incidentId === incidentId && m.kind === "snapshot") ?? model.media.find((m) => m.kind === "snapshot");
    c.ok((await page.locator("[data-live-view]").count()) === 1 && model.ui.liveViewDeviceId === media?.deviceId, "1 live view opens on the snapshot device");
  }

  // 2. The simulated answer is labelled.
  {
    await page.getByText("Simulated live view — the sample week has no camera stream.").waitFor({ timeout: 10000 });
    c.ok(true, "2 simulated answer labelled as simulated");
  }

  // 3. A data image, no live stream object.
  {
    const src = await page.locator("[data-live-view] img").first().getAttribute("src");
    const live = await page.evaluate(() => [...document.querySelectorAll("[data-live-view] video")].filter((v) => (v as HTMLVideoElement).srcObject !== null).length);
    c.ok((src ?? "").startsWith("data:image/") && live === 0, "3 snapshot image shown, no live stream attached");
  }

  // 4. The countdown runs.
  {
    const num = async (): Promise<number> => {
      const t = (await page.locator("[data-live-view] [data-metric]").first().innerText()) ?? "";
      return Number((/(\d+)/.exec(t) ?? [])[1] ?? NaN);
    };
    const n0 = await num();
    await page.waitForTimeout(1600);
    const n1 = await num();
    c.ok(n0 <= 30 && Number.isFinite(n0) && n1 <= n0 - 1, "4 countdown starts at 30 or less and runs down");
  }

  // 5. One start, one stop with the same session id.
  // 6. Close tears everything down.
  {
    const before = await pc();
    await page.locator('[data-live-view] button:has-text("Close")').click();
    await page.waitForFunction(() => document.querySelectorAll("[data-live-view]").length === 0, { timeout: 5000 });
    const model = (await readModel(page)) as unknown as WeekModel;
    const after = await pc();
    const same = starts.length === 1 && stops.length === 1 &&
      ((stops[0] as { args?: { whepSessionId?: string } }).args?.whepSessionId === "whep-1");
    c.ok(same, "5 one start and one stop carrying the same session id");
    c.ok(model.ui.liveViewDeviceId === null && after.closed === after.created && after.closed - before.closed === 1, "6 close clears the device and closes the connection");
  }

  // 7. A short session closes itself.
  {
    mode = "short";
    const s0 = starts.length;
    const t0 = stops.length;
    await page.locator('[data-slot="incident"] button:has-text("Live view")').click();
    await page.locator("[data-live-view]").waitFor({ timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-live-view]").length === 0, { timeout: 6000 });
    c.ok(starts.length === s0 + 1 && stops.length === t0 + 1, "7 short session closes itself with a stop");
  }

  // 8. A failed start leaves nothing open.
  {
    mode = "fail";
    const s0 = starts.length;
    const t0 = stops.length;
    const before = await pc();
    await page.locator('[data-slot="incident"] button:has-text("Live view")').click();
    await page.locator("[data-live-view]").waitFor({ timeout: 10000 });
    await page.getByText("Live view didn't start").waitFor({ timeout: 10000 });
    const noAnswer = await page.getByText("Ring didn't answer. Try again in a moment.").count();
    const after = await pc();
    c.ok(
      starts.length === s0 + 1 && stops.length === t0 && noAnswer >= 1 && after.created === before.created + 1 &&
        after.closed === before.closed + 1 && after.closed === after.created,
      "8 failed start warns and closes every connection",
    );
    await page.locator('[data-live-view] button:has-text("Close")').click();
    await page.waitForFunction(() => document.querySelectorAll("[data-live-view]").length === 0, { timeout: 5000 });
  }

  // 9. A real answer attaches the stream.
  // 11. The video carries the streaming attributes.
  {
    mode = "real";
    const before = (await pc()).remote.length;
    await page.locator('[data-slot="incident"] button:has-text("Live view")').click();
    await page.locator("[data-live-view] video").waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => (window as unknown as { __fireTrack(): boolean }).__fireTrack());
    await page.waitForFunction(
      () => [...document.querySelectorAll("[data-live-view] video")].some((v) => (v as HTMLVideoElement).srcObject !== null),
      { timeout: 5000 },
    );
    const after = await pc();
    const sim = await page.getByText("Simulated live view — the sample week has no camera stream.").count();
    const attrs = await page.locator("[data-live-view] video").first().evaluate((v) => ({
      autoplay: v.hasAttribute("autoplay"),
      playsinline: v.hasAttribute("playsinline"),
      muted: v.hasAttribute("muted"),
    }));
    c.ok(after.remote.length === before + 1 && after.remote[after.remote.length - 1]?.type === "answer" && sim === 0, "9 real answer attached without the simulated callout");
    c.ok(attrs.autoplay && attrs.playsinline && attrs.muted, "11 video autoplays inline and muted");
  }

  // 12. Escape closes and hands focus back; the region carries its help.
  {
    const region = await page.locator('[data-result-region="live-view"]').count();
    const help = await page.locator('[data-result-region="live-view"] [data-help-for="live-view"]').count();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelectorAll("[data-live-view]").length === 0, { timeout: 5000 });
    const focused = await page.evaluate(() => (document.activeElement as HTMLElement)?.textContent?.trim() ?? "");
    c.ok(region >= 1 && help >= 1 && focused.includes("Live view"), "12 escape closes, focus returns, region with help");
  }

  // 10. Nothing leaves the page origin.
  {
    c.ok(seen.length > 0 && seen.every((u) => u.startsWith(run.url)), "10 every request stays on the page origin");
  }
} finally {
  await run.close();
}

c.done();
