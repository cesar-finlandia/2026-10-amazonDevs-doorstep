// scripts/verify/3d-05-arcs.ts — DP-3D WU-3D-05 (14 checks).
// Incident arcs, evidence flares, visit threads and the highlight.
import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { SceneEntity } from "src/kits/three-scene/src/react/index.js";
import type { WeekModel } from "src/domain/types.js";
import { toSceneDescription } from "src/3d/adapter.js";
import { dayX, minuteZ } from "src/3d/layout.js";
import { createRenderers } from "src/3d/renderers/index.js";
import { OVERVIEW, WALK, shotsForScene } from "src/3d/shots.js";
import { NEUTRAL_DEMO_TOKENS, validateSceneDescription } from "src/kits/three-scene/src/react/index.js";
import { demoSeed } from "src/domain/seed.js";
import { visitorThreads, weekRibbon } from "src/domain/derive.js";
import { DAY_MS } from "src/domain/time.js";
import { VARIANCE_MIN, loadWeek, open3d, openIncident, setIncidentStatus, settle, variance64, waitNear, waitScene } from "./3d-kit.js";
import type { ThreeRun } from "./3d-kit.js";
import { createChecker, readModel } from "./ui-kit.js";

const c = createChecker("3d-05-arcs");

type Pose = { position: [number, number, number]; target: [number, number, number] };

// ── Node checks ─────────────────────────────────────────────────────────────

// 2. createRenderers has the six keys (the five of DP-3D §5.5 and the label layer), each a function.
{
  const r = createRenderers({ tokens: NEUTRAL_DEMO_TOKENS }) as Record<string, unknown>;
  const keys = ["camera-frustum", "incident-arc", "evidence-flare", "visit-thread", "probe", "scene-labels"];
  c.ok(
    keys.every((k) => typeof r[k] === "function") && Object.keys(r).length === keys.length,
    "2 createRenderers has the six renderer keys, each a function",
  );
}

// 5. One thread entity per visitorThreads entry, with its hops. The seed's
// multi-camera visits all fall in its baseline weeks, which the calendar (and so
// the scene) does not show; reading the model with its first week as the week
// under review puts every one of them on the ribbon. The plain seed, whose
// threads are off the ribbon, has no thread entity.
{
  const seed = demoSeed();
  const model: WeekModel = { ...seed, window: { ...seed.window, baselineEndMs: seed.window.baselineStartMs } };
  const threads = visitorThreads(model);
  const entities = toSceneDescription(model).entities.filter((e) => e.id.startsWith("thread:"));
  const byId = new Map(entities.map((e) => [e.id, e]));
  const offWeek = toSceneDescription(seed).entities.filter((e) => e.id.startsWith("thread:")).length;
  const ok =
    entities.length === threads.length &&
    threads.length > 0 &&
    offWeek === 0 &&
    threads.every((t) => {
      const e = byId.get(`thread:${t.visitId}`);
      return e !== undefined && e.meta?.["hops"] === t.hops.join(",") && e.customKey === "visit-thread";
    });
  c.ok(ok, `5 one thread entity per multi-camera visit of the week shown (${threads.length})`);
}

// 6. An incident across midnight is one arc, on its first day.
{
  const base = demoSeed();
  const day = weekRibbon(base)[2];
  if (!day) throw new Error("no ribbon day");
  const startMs = day.dayStartMs + 23.5 * 3_600_000;
  const endMs = day.dayStartMs + DAY_MS + 0.5 * 3_600_000;
  const model: WeekModel = {
    ...base,
    incidents: [
      { id: "inc-1", kind: "long_dwell", status: "open", title: "Late dwell", eventIds: [], startMs, endMs, createdMs: endMs },
    ],
  };
  const desc = toSceneDescription(model);
  const arcs = desc.entities.filter((e) => e.id.startsWith("inc-"));
  const arc = arcs[0];
  c.ok(
    arcs.length === 1 && arc !== undefined && arc.position[0] === dayX(2) && validateSceneDescription(desc).ok === true,
    "6 a midnight-spanning incident is one arc on its first day and validates",
  );
}

// ── Browser checks ──────────────────────────────────────────────────────────

async function cameraOf(page: Page): Promise<Pose> {
  return page.evaluate(() => (window as unknown as { __scene3d: { camera(): Pose } }).__scene3d.camera());
}

async function revisionOf(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __scene3d: { revision(): number } }).__scene3d.revision());
}

async function entityOf(page: Page, id: string): Promise<SceneEntity | undefined> {
  return page.evaluate(
    (eid: string) => (window as unknown as { __scene3d: { entity(i: string): unknown } }).__scene3d.entity(eid),
    id,
  ) as Promise<SceneEntity | undefined>;
}

async function countOf(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __scene3d: { entityCount(): number } }).__scene3d.entityCount());
}

async function drawCallsOf(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __scene3d: { drawCalls(): number } }).__scene3d.drawCalls());
}

/** Waits for the scene to rebuild past `rev`. */
async function awaitRevision(page: Page, rev: number): Promise<void> {
  await page.waitForFunction(
    (r: number) => (window as unknown as { __scene3d: { revision(): number } }).__scene3d.revision() > r,
    rev,
    { timeout: 10000 },
  );
}

let reduced: ThreeRun | undefined;
const run = await open3d();
try {
  const page = run.page;
  await loadWeek(page);
  await waitScene(page);
  await page.locator('[data-slot="stage"]').scrollIntoViewIfNeeded();

  const play = (shot: string): Promise<unknown> =>
    page.evaluate((s: string) => {
      (window as unknown as { __demo3d: { play(x: string): void } }).__demo3d.play(s);
    }, shot);

  // 1, 4, 7. The first opened moment: arc + flare, then one without a snapshot.
  const n0 = await countOf(page);
  const rev0 = await revisionOf(page);
  const id1 = await openIncident(page, 0, true);
  await awaitRevision(page, rev0);
  const n1 = await countOf(page);
  const model1 = (await readModel(page)) as unknown as WeekModel;
  const inc1 = model1.incidents.find((i) => i.id === id1);
  const day = weekRibbon(model1).find((d) => d.incidents.some((x) => x.id === id1));
  const rInc = day?.incidents.find((x) => x.id === id1);
  if (!inc1 || !day || !rInc) throw new Error("opened incident missing from the model or ribbon");
  const arc = await entityOf(page, id1);
  const mid = (rInc.fromMin + rInc.toMin) / 2;
  c.ok(
    arc !== undefined &&
      arc.kind === "custom" &&
      arc.customKey === "incident-arc" &&
      arc.material.token === "pillar-warn" &&
      arc.meta?.["status"] === "open" &&
      arc.meta?.["title"] === inc1.title &&
      arc.position[0] === dayX(day.dayIndex) &&
      arc.position[2] === minuteZ(mid) &&
      arc.size[2] === Math.max(((rInc.toMin - rInc.fromMin) / 1440) * 8 + 0.6, 1),
    "1 an opened incident is an incident-arc entity at its day and time",
  );

  const flare = await entityOf(page, `flare:${id1}`);
  const rev1 = await revisionOf(page);
  const id2 = await openIncident(page, 1, false);
  await awaitRevision(page, rev1);
  const n2 = await countOf(page);
  const noFlare = await entityOf(page, `flare:${id2}`);
  c.ok(
    flare !== undefined && flare.material.token === "arc" && flare.position[1] === 3.3 && noFlare === undefined,
    "4 a snapshot incident has a flare at y 3.3; one without has none",
  );
  c.ok(n1 - n0 === 2 && n2 - n1 === 1, `7 entity count rises by 2 (arc and flare), then by 1 (${n1 - n0}, ${n2 - n1})`);

  // 3. Status maps to material.
  {
    const seen: Record<string, string | undefined> = {};
    for (const status of ["resolved", "dismissed", "explained"]) {
      const rev = await revisionOf(page);
      await setIncidentStatus(page, id1, status);
      await awaitRevision(page, rev);
      seen[status] = (await entityOf(page, id1))?.material.token;
    }
    c.ok(
      seen["resolved"] === "resolved" && seen["dismissed"] === "gap" && seen["explained"] === "pillar-warn",
      `3 arc material follows status (${JSON.stringify(seen)})`,
    );
  }

  // 9. The highlight: in within 300 ms, still in at 2.0 s, gone by 3.2 s.
  {
    await page.waitForTimeout(3300);
    const r = await page.evaluate(async (iid: string) => {
      const w = window as unknown as {
        __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } };
        __scene3d: { highlightedIds(): string[] };
      };
      await w.__doorstep.session.call(
        "set_incident_status",
        { incidentId: iid, status: "resolved", summary: "Checked against the record." },
        { source: "human" },
      );
      const t0 = performance.now();
      const has = (): boolean => w.__scene3d.highlightedIds().includes(iid);
      let firstIn: number | null = null;
      let at2000: boolean | null = null;
      let at3200: boolean | null = null;
      for (;;) {
        const t = performance.now() - t0;
        if (firstIn === null && has()) firstIn = t;
        if (at2000 === null && t >= 2000) at2000 = has();
        if (at3200 === null && t >= 3200) {
          at3200 = has();
          break;
        }
        await new Promise((res) => setTimeout(res, 10));
      }
      return { firstIn, at2000, at3200 };
    }, id1);
    c.ok(
      r.firstIn !== null && r.firstIn <= 300 && r.at2000 === true && r.at3200 === false,
      `9 the arc highlights within 300 ms, holds at 2.0 s, is clear by 3.2 s (${JSON.stringify(r)})`,
    );
  }

  // 8. Clicking the arc selects its incident and frames it.
  {
    await play("overview");
    await settle(page, 5000, OVERVIEW);
    const pt = (await page.evaluate(
      (iid: string) =>
        (window as unknown as { __scene3d: { project(i: string, o: number[]): { x: number; y: number } | null } }).__scene3d.project(iid, [-0.1, 0.05, 0]),
      id1,
    )) as { x: number; y: number } | null;
    if (!pt) throw new Error("the arc is off screen at the overview");
    await page.mouse.click(pt.x, pt.y);
    await page.waitForFunction(
      (iid: string) => {
        const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
        return w.__doorstep.session.store.getState().ui.selectedIncidentId === iid;
      },
      id1,
      { timeout: 5000 },
    );
    const model = (await readModel(page)) as unknown as WeekModel;
    const pressed = await page
      .waitForFunction(
        (iid: string) =>
          document.querySelector(`.pencil-circle[data-incident-id="${iid}"]`)?.getAttribute("aria-pressed") ?? null,
        id1,
        { timeout: 5000 },
      )
      .then((h) => h.jsonValue())
      .catch(() => null);
    const focus = shotsForScene(toSceneDescription(model)).find((s) => s.name === `focus:${id1}`);
    if (!focus) throw new Error("no focus shot for the arc");
    const arrived = await waitNear(page, focus, 3000);
    c.ok(
      model.ui.selectedIncidentId === id1 && model.ui.shotId === `focus:${id1}` && pressed === "true" && arrived,
      "8 clicking the arc selects the incident, frames it and presses its circle",
    );
  }

  // 11. Overview and walk render differently, each non-blank.
  {
    const shot = async (name: string, pose: Pose): Promise<{ hash: string; variance: number }> => {
      await play(name);
      await settle(page, 5000, pose);
      const png = await page.locator('[data-slot="stage"] canvas').first().screenshot();
      return {
        hash: createHash("sha256").update(png).digest("hex"),
        variance: await variance64(page, '[data-slot="stage"] canvas'),
      };
    };
    const over = await shot("overview", OVERVIEW);
    const walk = await shot("walk", WALK);
    c.ok(
      over.hash !== walk.hash && over.variance >= VARIANCE_MIN && walk.variance >= VARIANCE_MIN,
      `11 overview and walk differ and are not blank (variance ${Math.round(over.variance)} / ${Math.round(walk.variance)})`,
    );
  }

  // 12. The walk pose is eye height, looking down the week.
  {
    await play("walk");
    await settle(page, 5000, WALK);
    const cam = await cameraOf(page);
    c.ok(
      cam.position[1] >= 1.5 && cam.position[1] <= 1.8 && cam.target[2] - cam.position[2] > 5,
      "12 the walk camera stands at eye height and looks more than 5 m down the week",
    );
  }

  // 13. Each extra incident costs at most 6 draw calls.
  {
    await play("overview");
    await settle(page, 5000, OVERVIEW);
    await page.waitForTimeout(300);
    const before = await drawCallsOf(page);
    for (const index of [2, 3, 4]) {
      const rev = await revisionOf(page);
      await openIncident(page, index, true);
      await awaitRevision(page, rev);
    }
    await page.waitForTimeout(3000);
    await settle(page, 5000, OVERVIEW);
    const after = await drawCallsOf(page);
    c.ok((after - before) / 3 <= 6, `13 each incident adds at most 6 draw calls (${before} -> ${after} for three)`);
  }

  // 14. Nothing logged by the renderer.
  c.ok(run.problems.length === 0, `14 no console problems (${run.problems.slice(0, 3).join(" | ")})`);

  // 10. Reduced motion removes the pulse (separate context).
  reduced = await open3d({ reducedMotion: true });
  {
    const rp = reduced.page;
    await loadWeek(rp);
    await waitScene(rp);
    const rev = await revisionOf(rp);
    const rid = await openIncident(rp, 0, true);
    await awaitRevision(rp, rev);
    const seen = await rp.evaluate(async (iid: string) => {
      const w = window as unknown as {
        __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } };
        __scene3d: { highlightedIds(): string[] };
      };
      await w.__doorstep.session.call(
        "set_incident_status",
        { incidentId: iid, status: "resolved", summary: "Checked against the record." },
        { source: "human" },
      );
      let any = false;
      const t0 = performance.now();
      while (performance.now() - t0 < 1000) {
        if (w.__scene3d.highlightedIds().length > 0) any = true;
        await new Promise((res) => setTimeout(res, 10));
      }
      return any;
    }, rid);
    c.ok(seen === false && reduced.problems.length === 0, "10 under reduced motion nothing is highlighted");
  }
} finally {
  if (reduced) await reduced.close();
  await run.close();
}

c.done();
