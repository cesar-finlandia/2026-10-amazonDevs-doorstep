// scripts/3d-screenshots.ts — DP-3D WU-3D-08: the two review screenshots.
// Writes design_documents/3d-screenshots/{overview,focus}.png and manifest.json,
// prints each written path and then `3d-screenshots: 2 written`.
// Requirement IDs: FR-20
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { OVERVIEW } from "src/3d/shots.js";
import { loadWeek, open3d, settle, waitNear, waitScene } from "./verify/3d-kit.js";

const OUT = "design_documents/3d-screenshots";
mkdirSync(OUT, { recursive: true });

type Vec = [number, number, number];
type Pose = { position: Vec; target: Vec };

interface Entry {
  file: string;
  width: number;
  height: number;
  shot: string;
  quality: string;
  camera: Pose;
  stageVisible: boolean;
  daysInView: number;
  consoleErrors: number;
  /** The incident the focus shot frames, and the target that shot aims at. */
  incidentId?: string;
  focusTarget?: Vec;
}

async function describe(page: Page, file: string, shot: string, problems: number): Promise<Entry> {
  const state = await page.evaluate(() => {
    const w = window as unknown as {
      __scene3d: {
        mode(): string;
        camera(): Pose;
        project(id: string, o?: Vec): { x: number; y: number } | null;
      };
    };
    const canvas = document.querySelector('[data-slot="stage"] canvas') as HTMLElement | null;
    const r = canvas?.getBoundingClientRect();
    const stageVisible =
      r !== undefined && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
    let daysInView = 0;
    for (let i = 0; i < 7; i++) if (w.__scene3d.project(`day:${i}`) !== null) daysInView++;
    return { quality: w.__scene3d.mode(), camera: w.__scene3d.camera(), stageVisible, daysInView };
  });
  return { file, width: 1280, height: 720, shot, consoleErrors: problems, ...state };
}

const run = await open3d({ path: "/?hook=1&quality=high", width: 1280, height: 720, theme: "light" });
try {
  const page = run.page;
  await loadWeek(page);
  await waitScene(page);
  const incidentId = await page.evaluate(() =>
    (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate(),
  );
  if (!incidentId) throw new Error("the sample week has no candidate incident to open");

  // Frame the hero stage under the app bar (loading the week scrolled the ribbon into view).
  await page.evaluate(() => {
    const stage = document.querySelector('[data-slot="stage"]') as HTMLElement;
    window.scrollTo(0, window.scrollY + stage.getBoundingClientRect().top - 150);
  });
  await page.evaluate(() => (window as unknown as { __demo3d: { play(s: string): void } }).__demo3d.play("overview"));
  await settle(page, 15000, OVERVIEW);
  // Let the highlight pulse of the freshly opened moment end before shooting.
  await page.waitForTimeout(2800);
  await settle(page, 15000, OVERVIEW);
  const manifest: Entry[] = [];
  const overviewPath = join(OUT, "overview.png");
  await page.screenshot({ path: overviewPath });
  manifest.push(await describe(page, "overview.png", "overview", run.problems.length));
  console.log(overviewPath);

  // The focus shot goes through the agent's route, as a visitor's click would.
  await page.evaluate(
    (id: string) =>
      (window as unknown as { __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } } }).__doorstep.session.call(
        "set_camera_shot",
        { shot: "focus", incidentId: id },
        { source: "human" },
      ),
    incidentId,
  );
  const arc = (await page.evaluate(
    (id: string) => (window as unknown as { __scene3d: { entity(i: string): { position: Vec } | undefined } }).__scene3d.entity(id),
    incidentId,
  )) as { position: Vec } | undefined;
  if (!arc) throw new Error(`no arc entity for ${incidentId}`);
  const focusTarget: Vec = [arc.position[0], arc.position[1] + 0.3, arc.position[2]];
  const focusPose: Pose = {
    target: focusTarget,
    position: [focusTarget[0] + 3.0, focusTarget[1] + 2.8, focusTarget[2] + 3.4],
  };
  await waitNear(page, focusPose, 15000);
  await page.waitForTimeout(2800);
  await settle(page, 15000, focusPose);
  const focusPath = join(OUT, "focus.png");
  await page.screenshot({ path: focusPath });
  manifest.push({ ...(await describe(page, "focus.png", `focus:${incidentId}`, run.problems.length)), incidentId, focusTarget });
  console.log(focusPath);

  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
} finally {
  await run.close();
}
console.log("3d-screenshots: 2 written");
