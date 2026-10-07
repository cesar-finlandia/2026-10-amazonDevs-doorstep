// scripts/verify/3d-07-capability.ts — DP-3D WU-3D-07 (12 checks).
// The capability fallback and the performance probe.
import type { Page } from "@playwright/test";
import type { WeekModel } from "src/domain/types.js";
import { weekRibbon } from "src/domain/derive.js";
import { canRenderGl, renderQuality } from "src/3d/capability.js";
import { FPS_MIN, loadWeek, open3d, openIncident, setIncidentStatus, settle, waitScene } from "./3d-kit.js";
import type { ThreeRun } from "./3d-kit.js";
import { createChecker, readModel } from "./ui-kit.js";

const c = createChecker("3d-07-capability");

const NO_GL = "HTMLCanvasElement.prototype.getContext = function () { return null };";

// 1. canRenderGl on injected factories.
{
  const none = canRenderGl(() => ({ getContext: () => null }));
  const gl2Only = canRenderGl(() => ({ getContext: (kind: string) => (kind === "webgl2" ? {} : null) }));
  const throws = canRenderGl(() => ({
    getContext: () => {
      throw new Error("blocked");
    },
  }));
  c.ok(none === false && gl2Only === true && throws === false, "1 canRenderGl: null is false, webgl2 only is true, a throw is false");
}

// 2. renderQuality.
c.ok(
  renderQuality("?quality=high", true) === "high" &&
    renderQuality("?quality=low", false) === "low" &&
    renderQuality("", true) === "low" &&
    renderQuality("", false) === "high" &&
    renderQuality("?quality=x", true) === "low",
  "2 renderQuality: the query wins, else a webdriver browser is low",
);

const runs: ThreeRun[] = [];
const track = async (opts: Parameters<typeof open3d>[0]): Promise<ThreeRun> => {
  const r = await open3d(opts);
  runs.push(r);
  return r;
};

const frames = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __scene3d: { frames(): number } }).__scene3d.frames());
const probeCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __scene3d: { drawCalls(): number } }).__scene3d.drawCalls());
const revisionOf = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __scene3d: { revision(): number } }).__scene3d.revision());
async function awaitRevision(page: Page, rev: number): Promise<void> {
  await page.waitForFunction(
    (r: number) => (window as unknown as { __scene3d: { revision(): number } }).__scene3d.revision() > r,
    rev,
    { timeout: 10000 },
  );
}

try {
  // 3. No WebGL: the stage message and marker, and no recorder hooks.
  {
    const r = await track({ init: NO_GL });
    const text = (await r.page.locator('[data-slot="stage"]').textContent()) ?? "";
    const marker = await r.page.locator('[data-slot="stage"] [data-demo-3d="unavailable"]').count();
    const hooks = await r.page.evaluate(() => typeof (window as unknown as { __demo3d?: unknown }).__demo3d);
    c.ok(text.includes("3D view unavailable") && marker >= 1 && hooks === "undefined", "3 without WebGL the stage says so, is marked unavailable and has no __demo3d");
  }

  // 4, 5, 6. No WebGL on /lab: the flat week replica.
  {
    const r = await track({ path: "/lab?hook=1", init: NO_GL });
    const page = r.page;
    await page.waitForSelector("svg[role=img][aria-label^='Flat week: ']", { timeout: 15000 });
    const root = page.locator('[data-demo-focus="lab"] [data-demo-3d="unavailable"]').first();
    const text = (await root.textContent()) ?? "";
    const label = (await page.locator("svg[role=img]").first().getAttribute("aria-label")) ?? "";
    c.ok(text.includes("3D view unavailable — showing the flat week.") && label.startsWith("Flat week: "), "4 /lab without WebGL shows the flat week and its label");

    // The lab loads the sample week; open a moment, then compare counts with the ribbon.
    await page.waitForFunction(
      () => document.querySelectorAll(".fb-tick").length > 0,
      undefined,
      { timeout: 15000 },
    );
    await page.evaluate(() => (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate());
    await page.waitForFunction(() => document.querySelectorAll(".fb-circle").length > 0, undefined, { timeout: 10000 });
    const model = (await readModel(page)) as unknown as WeekModel;
    const ribbon = weekRibbon(model);
    const want = {
      ticks: ribbon.reduce((s, d) => s + d.ticks.length, 0),
      visits: ribbon.reduce((s, d) => s + d.visits.length, 0),
      circles: ribbon.reduce((s, d) => s + d.incidents.length, 0),
    };
    const got = await page.evaluate(() => ({
      ticks: document.querySelectorAll(".fb-tick").length,
      visits: document.querySelectorAll(".fb-visit").length,
      circles: document.querySelectorAll(".fb-circle").length,
    }));
    c.ok(
      JSON.stringify(got) === JSON.stringify(want) && want.circles > 0,
      `5 replica counts match the ribbon (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`,
    );

    // 6. No colour literal in the markup; no horizontal overflow at 390 px.
    const html = await page.evaluate(() => document.querySelector("[data-demo-3d='unavailable']")?.innerHTML ?? "");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    c.ok(!/#[0-9a-fA-F]{3,8}\b/.test(html) && !overflow, `6 the replica has no colour literal and fits 390 px (overflow ${overflow})`);
  }

  // 7–12. The GL scene in CI mode: frame rate, draw calls, idle, leaks, triangles, problems.
  const gl = await track({});
  const page = gl.page;
  await loadWeek(page);
  await waitScene(page);
  await page.locator('[data-slot="stage"]').scrollIntoViewIfNeeded();

  // Three incidents, the weekly demo scene's busiest state.
  const ids: string[] = [];
  for (const n of [0, 1, 2]) {
    const rev = await revisionOf(page);
    ids.push(await openIncident(page, n, true));
    await awaitRevision(page, rev);
  }

  // 12 (part). Every shot, both themes and a viewport change stay quiet.
  const shotsToPlay = ["overview", "walk", "focus:day:3", "focus:door", `focus:${ids[0]}`];
  for (const shot of shotsToPlay) {
    await page.evaluate((s: string) => (window as unknown as { __demo3d: { play(x: string): void } }).__demo3d.play(s), shot);
    await settle(page, 3000);
  }
  await page.locator('.rail [role="radiogroup"] button:has-text("Dusk")').click();
  await page.waitForTimeout(600);
  await page.locator('.rail [role="radiogroup"] button:has-text("Paper")').click();
  await page.waitForTimeout(600);
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.waitForTimeout(600);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as unknown as { __demo3d: { play(x: string): void } }).__demo3d.play("overview"));
  await settle(page, 5000);

  // 8. Draw calls on a settled frame.
  await page.waitForTimeout(800);
  const calls = await probeCalls(page);
  c.ok(calls > 0 && calls < 300, `8 draw calls on a settled frame: ${calls} (< 300)`);

  // 11. Triangles of a low-quality frame.
  const triangles = await page.evaluate(() => (window as unknown as { __scene3d: { triangles(): number } }).__scene3d.triangles());
  c.ok(triangles >= 1 && triangles <= 200000, `11 a low-quality frame has ${triangles} triangles`);

  // 9. Idle: the on-demand loop draws (almost) nothing in one second.
  {
    await settle(page, 5000);
    // The kit keeps drawing for 1.3 s after a camera move and the highlight
    // lasts 2.4 s: let both end, then count one idle second.
    await page.waitForTimeout(3000);
    const f0 = await frames(page);
    await page.waitForTimeout(1000);
    const f1 = await frames(page);
    c.ok(f1 - f0 <= 2, `9 one idle second draws ${f1 - f0} frames (<= 2)`);
  }

  // 10. Toggling an incident does not leak geometry or grow the frame.
  {
    const target = ids[0] as string;
    const rev = await revisionOf(page);
    await setIncidentStatus(page, target, "explained");
    await awaitRevision(page, rev);
    // Wait out the 2.4 s highlight: its frames draw more than a settled one.
    await page.waitForTimeout(3000);
    await settle(page, 5000);
    await page.waitForTimeout(500);
    const callsBefore = await probeCalls(page);
    const geomBefore = await page.evaluate(() => (window as unknown as { __scene3d: { memory(): { geometries: number } } }).__scene3d.memory().geometries);
    for (let i = 0; i < 20; i++) {
      const r = await revisionOf(page);
      await setIncidentStatus(page, target, i % 2 === 0 ? "open" : "explained");
      await awaitRevision(page, r);
    }
    await page.waitForTimeout(3000);
    await settle(page, 5000);
    await page.waitForTimeout(500);
    const callsAfter = await probeCalls(page);
    const geomAfter = await page.evaluate(() => (window as unknown as { __scene3d: { memory(): { geometries: number } } }).__scene3d.memory().geometries);
    c.ok(
      geomAfter - geomBefore <= 10 && Math.abs(callsAfter - callsBefore) <= 2,
      `10 20 toggles: geometries ${geomBefore} -> ${geomAfter}, draw calls ${callsBefore} -> ${callsAfter}`,
    );
  }

  // 7. The frame rate over three seconds.
  {
    const fps = await page.evaluate(() => (window as unknown as { __demo3d: { fpsProbe(ms: number): Promise<number> } }).__demo3d.fpsProbe(3000));
    c.ok(fps >= FPS_MIN, `7 fpsProbe(3000) measured ${fps} fps (>= ${FPS_MIN})`);
  }

  // 12. Nothing was logged along the way.
  c.ok(gl.problems.length === 0, `12 no console problems across shots, themes, a viewport change and the fps probe (${gl.problems.slice(0, 3).join(" | ")})`);
} finally {
  for (const r of runs.reverse()) await r.close();
}

c.done();
