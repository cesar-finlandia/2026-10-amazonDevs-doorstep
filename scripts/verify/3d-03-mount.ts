// scripts/verify/3d-03-mount.ts — DP-3D WU-3D-03 (15 checks).
// The scene mounts, follows the store and selects in both directions.
import type { Page } from "@playwright/test";
import type { WeekModel } from "src/domain/types.js";
import { toSceneDescription } from "src/3d/adapter.js";
import { OVERVIEW } from "src/3d/shots.js";
import { FPS_MIN, VARIANCE_MIN, loadWeek, open3d, settle, variance64, waitNear, waitScene } from "./3d-kit.js";
import { createChecker, readModel } from "./ui-kit.js";

void FPS_MIN;
void settle;

const c = createChecker("3d-03-mount");

interface Probe {
  mode(): string;
  revision(): number;
  entityCount(): number;
  entityIds(): string[];
  entity(id: string): { position: [number, number, number]; size: [number, number, number] } | undefined;
  selectedId(): string | null;
  tokens(): { background: string };
  camera(): { position: [number, number, number]; target: [number, number, number] };
  project(id: string, offset?: [number, number, number]): { x: number; y: number } | null;
}

async function probe(page: Page, expr: string): Promise<unknown> {
  return page.evaluate(`(window.__scene3d.${expr})`);
}

async function uiOf(page: Page): Promise<{ selectedDay: number | null; selectedIncidentId: string | null }> {
  const m = (await readModel(page)) as unknown as WeekModel;
  return { selectedDay: m.ui.selectedDay, selectedIncidentId: m.ui.selectedIncidentId };
}

async function project(page: Page, id: string, offset: [number, number, number]): Promise<{ x: number; y: number }> {
  const pt = (await page.evaluate(
    ([eid, off]) =>
      (window as unknown as { __scene3d: Probe }).__scene3d.project(eid, off as [number, number, number]),
    [id, offset] as const,
  )) as { x: number; y: number } | null;
  if (!pt) throw new Error(`project(${id}) returned null`);
  return pt;
}

const run = await open3d();
try {
  const page = run.page;
  await loadWeek(page);
  await waitScene(page);
  // The sample-week button scrolls the ribbon into view; bring the stage back
  // before projecting screen points or clicking the canvas.
  await page.locator('[data-slot="stage"]').scrollIntoViewIfNeeded();

  // 1. Exactly one scene marker, the hero canvas, low mode by default.
  {
    const count = await page.locator("[data-demo-3d]").count();
    const value = await page.locator("[data-demo-3d]").first().getAttribute("data-demo-3d");
    const width = (await page.locator('[data-slot="stage"] canvas').first().boundingBox())?.width ?? 0;
    const mode = (await probe(page, "mode()")) as string;
    c.ok(count === 1 && value === "doorway-week" && width >= 600 && mode === "low", "1 one doorway-week marker with a wide canvas in low mode");
  }

  // 2. No unavailable text while WebGL works.
  {
    const text = await page.locator('[data-slot="stage"]').innerText();
    c.ok(!text.includes("3D view unavailable"), "2 stage shows the live scene, not the unavailable text");
  }

  // 3. The probe sees the same entities as Node from the same model.
  {
    const model = (await readModel(page)) as unknown as WeekModel;
    const expected = toSceneDescription(model);
    const count = (await probe(page, "entityCount()")) as number;
    const ids = ((await probe(page, "entityIds()")) as string[]).sort();
    const want = expected.entities.map((e) => e.id).sort();
    c.ok(count === expected.entities.length && JSON.stringify(ids) === JSON.stringify(want), "3 probe entity set equals the Node description");
  }

  // 5. The canvas is non-blank.
  {
    c.ok((await variance64(page, '[data-slot="stage"] canvas')) >= VARIANCE_MIN, "5 canvas variance above the floor");
  }

  // 4 + 6. Idle plus theme switches stay clean; opening a moment bumps revision.
  {
    await page.waitForTimeout(3000);
    await page.locator('.rail [role="radiogroup"] button:has-text("Dusk")').click();
    await page.waitForTimeout(600);
    await page.locator('.rail [role="radiogroup"] button:has-text("Paper")').click();
    await page.waitForTimeout(600);
    const rev0 = (await probe(page, "revision()")) as number;
    const incidentId = (await page.evaluate(
      () => (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate(),
    )) as string | null;
    // The scene rebuild is scheduled through React after the ledger grows.
    let rev1 = rev0;
    for (let i = 0; i < 50 && rev1 <= rev0; i++) {
      await page.waitForTimeout(100);
      rev1 = (await probe(page, "revision()")) as number;
    }
    c.ok(run.problems.length === 0, `4 no renderer errors or warnings across idle and theme switches (${run.problems.slice(0, 3).join(" | ")})`);
    c.ok(typeof incidentId === "string" && incidentId.startsWith("inc-") && rev1 > rev0, "6 opening a moment bumps the scene revision");
    (globalThis as Record<string, unknown>).__incidentId = incidentId;
  }
  const incidentId = (globalThis as Record<string, unknown>).__incidentId as string;

  // 7. Clicking a day strip in the canvas selects it in the page.
  // DEVIATION on the aim (asserted behaviour unchanged): the plan's offset
  // [-0.65, 0.05, 0] lies 0.05 m inside the strip edge — about 0.4 px at this
  // viewport — while browser clicks land on integer pixels, which flips the
  // landing pixel outside the strip (verified with an exact three.js raycast
  // replica: the true pixel hits the strip top, the rounded pixel misses it;
  // ticks span [-0.54, -0.36], so no robust point exists left of them).
  // [-0.2, 0.05, 0] keeps the check's intent (bare strip between the ticks at
  // -0.45 and the pillars at +0.2) with pixel margins on every side; the
  // asserted behaviour — a canvas strip click selects the day in the page —
  // is unchanged.
  {
    // Review round 1 lowered the overview camera, so pillars can hide parts of
    // a strip: try bare points along it (between the ticks and the pillars)
    // until one lands on the strip.
    let selected = false;
    for (const dz of [0, -3.9, -3, 3, 3.9, -2, 2]) {
      const pt = await project(page, "day:2", [-0.2, 0.05, dz]);
      await page.mouse.click(pt.x, pt.y);
      selected = await page
        .waitForFunction(
          () => {
            const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
            return w.__doorstep.session.store.getState().ui.selectedDay === 2;
          },
          undefined,
          { timeout: 1500 },
        )
        .then(() => true)
        .catch(() => false);
      if (selected) break;
    }
    if (!selected) throw new Error("no point on day 2's strip selected it");
    await page.waitForFunction(
      () => document.querySelector('[data-day="2"]')?.getAttribute("aria-pressed") === "true",
      { timeout: 5000 },
    );
    const pressed = await page.locator('[data-day="2"]').getAttribute("aria-pressed");
    c.ok(pressed === "true", "7 canvas day click selects day 2 in the page");
  }

  // 8. Clicking the flagged pillar selects its incident in the page.
  // DEVIATION on the aim (asserted behaviour unchanged): the plan aims at the
  // pillar's top face ([0, h / 2, 0] above its centre), a ~1 px sliver from the
  // overview pose that integer click quantization hits only by luck. Aiming at
  // the pillar body's centre ([0, 0, 0] — the entity position) selects through
  // the same visit-to-incident mapping with pixel margins; the asserted
  // behaviour — a canvas pillar click selects the incident in the page — is
  // unchanged.
  {
    const pillar = await page.evaluate((incId: string) => {
      const w = window as unknown as {
        __doorstep: { session: { store: { getState(): WeekModel } } };
        __scene3d: Probe;
      };
      const m = w.__doorstep.session.store.getState();
      const inc = m.incidents.find((x) => x.id === incId);
      const visit = m.visits.find((v) => inc !== undefined && inc.eventIds.some((id) => v.eventIds.includes(id)));
      const ent = visit ? w.__scene3d.entity(visit.id) : undefined;
      return ent ? { id: visit?.id ?? null, h: ent.size[1] } : null;
    }, incidentId);
    if (!pillar || !pillar.id) throw new Error("flagged pillar not found");
    // Selecting a day in step 7 sent the camera to that day's shot, which may
    // not show this pillar: frame the whole week before aiming at it.
    // The day selection's own focus move is still being scheduled: let it
    // finish first, or it lands after (and overrides) the overview.
    await waitNear(page, { position: [2.6, 4, 0.6], target: [-1.6, 0.4, 5.6] }, 8000);
    await page.evaluate(() => (window as unknown as { __demo3d: { play(s: string): void } }).__demo3d.play("overview"));
    await settle(page, 5000, OVERVIEW);
    const pt = await project(page, pillar.id, [0, 0, 0]);
    await page.mouse.click(pt.x, pt.y);
    await page.waitForFunction((inc: string) => {
      const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
      return w.__doorstep.session.store.getState().ui.selectedIncidentId === inc;
    }, incidentId);
    const pressed = await page.waitForFunction(
      (inc: string) =>
        document.querySelector(`.pencil-circle[data-incident-id="${inc}"]`)?.getAttribute("aria-pressed") ?? null,
      incidentId,
      { timeout: 5000 },
    ).then((h) => h.jsonValue()).catch(() => null);
    c.ok(pressed === "true", "8 canvas pillar click selects the incident in the page");
  }

  // 9 + 10. The 2D selection reaches the scene; clearing reaches null.
  {
    await page.locator(`.pencil-circle[data-incident-id="${incidentId}"]`).click();
    await page.waitForFunction((inc: string) => {
      const w = window as unknown as { __scene3d: Probe };
      return w.__scene3d.selectedId() === inc;
    }, incidentId);
    const selected = (await probe(page, "selectedId()")) as string | null;
    await page.evaluate(() => {
      const w = window as unknown as { __doorstep: { session: { store: { dispatch(n: string, a: unknown, s: string): unknown } } } };
      w.__doorstep.session.store.dispatch("set_ui", { selectedDay: null, selectedIncidentId: null }, "human");
    });
    await page.locator('[data-day="4"]').click();
    await page.waitForFunction(() => {
      const w = window as unknown as { __scene3d: Probe };
      return w.__scene3d.selectedId() === "day:4";
    });
    const day4 = (await probe(page, "selectedId()")) as string | null;
    await page.evaluate(() => {
      const w = window as unknown as { __doorstep: { session: { store: { dispatch(n: string, a: unknown, s: string): unknown } } } };
      w.__doorstep.session.store.dispatch("set_ui", { selectedDay: null, selectedIncidentId: null }, "human");
    });
    await page.waitForFunction(() => {
      const w = window as unknown as { __scene3d: Probe };
      return w.__scene3d.selectedId() === null;
    });
    const cleared = (await probe(page, "selectedId()")) as string | null;
    c.ok(selected === incidentId && day4 === "day:4", "9 page selection reaches the scene both ways");
    c.ok(cleared === null && (await uiOf(page)).selectedDay === null, "10 clearing the selection empties the probe");
  }

  // 11. Theme change recolours the scene without a reload (computed colours
  // read back lowercase).
  {
    await page.locator('.rail [role="radiogroup"] button:has-text("Dusk")').click();
    let bg = "";
    for (let i = 0; i < 20; i++) {
      bg = ((await page.evaluate(
        () => (window as unknown as { __scene3d: Probe }).__scene3d.tokens().background,
      )) as string).toLowerCase();
      if (bg === "#0c1012") break;
      await page.waitForTimeout(100);
    }
    await page.locator('.rail [role="radiogroup"] button:has-text("Paper")').click();
    let bg2 = "";
    for (let i = 0; i < 20; i++) {
      bg2 = ((await page.evaluate(
        () => (window as unknown as { __scene3d: Probe }).__scene3d.tokens().background,
      )) as string).toLowerCase();
      if (bg2 === "#ebe4d3") break;
      await page.waitForTimeout(100);
    }
    c.ok(bg === "#0c1012" && bg2 === "#ebe4d3", "11 dusk and paper recolour the scene live");
  }

  // 12. Selection never rebuilds the scene.
  {
    const before = (await probe(page, "revision()")) as number;
    await page.evaluate(() => {
      const w = window as unknown as { __doorstep: { session: { store: { dispatch(n: string, a: unknown, s: string): unknown } } } };
      w.__doorstep.session.store.dispatch("set_ui", { selectedDay: 1 }, "human");
    });
    await page.waitForTimeout(300);
    const after = (await probe(page, "revision()")) as number;
    c.ok(before === after, "12 set_ui leaves the scene revision unchanged");
  }

  // 13. History navigation keeps one scene with working hooks.
  {
    await page.evaluate(() => {
      history.pushState({}, "", "/watch");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-demo-3d]").length === 1 && (window as unknown as { __demo3d?: unknown }).__demo3d !== undefined,
      { timeout: 15000 },
    );
    const count = await page.locator("[data-demo-3d]").count();
    c.ok(count === 1 && run.problems.length === 0, "13 history navigation keeps one hooked scene");
  }

  // 14. The canvas tracks the stage well across a viewport change.
  {
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.waitForTimeout(800);
    await page.locator('[data-slot="stage"]').scrollIntoViewIfNeeded();
    const widths = await page.locator('[data-slot="stage"] canvas').first().evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { canvas: box.width, parent: (el.parentElement as HTMLElement).clientWidth };
    });
    c.ok(Math.abs(widths.canvas - widths.parent) <= 2, `14 canvas tracks the well at 1024 wide (${widths.canvas} vs ${widths.parent})`);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
} finally {
  await run.close();
}

// 15. High quality renders cleanly (separate run).
{
  const high = await open3d({ quality: "high" });
  try {
    await loadWeek(high.page);
    await waitScene(high.page);
    const mode = (await high.page.evaluate(
      () => (window as unknown as { __scene3d: Probe }).__scene3d.mode(),
    )) as string;
    const variance = await variance64(high.page, '[data-slot="stage"] canvas');
    c.ok(mode === "high" && variance >= VARIANCE_MIN && high.problems.length === 0, `15 high mode renders cleanly (variance ${variance.toFixed(1)})`);
  } finally {
    await high.close();
  }
}

c.done();
