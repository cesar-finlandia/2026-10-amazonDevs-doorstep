// e2e/scenarios/3d.spec.ts — UC-12 "I fly over the week in 3D and the picture follows what I do".
// Requirement IDs: FR-20, NFR-07
import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  openHome,
  loadSampleWeek,
  waitScene,
  readModel,
  openFirstCandidate,
  stageVariance,
} from "../helpers";
import { weekRibbon } from "src/domain/derive";
import { candidateIncidents } from "src/domain/rules";
import { OVERVIEW, WALK, shotList } from "src/3d/shots";

function dist3(a: number[], b: readonly number[]): number {
  const dx = (a[0] ?? 0) - (b[0] ?? 0);
  const dy = (a[1] ?? 0) - (b[1] ?? 0);
  const dz = (a[2] ?? 0) - (b[2] ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

async function sceneCamera(page: Page): Promise<{ position: number[]; target: number[] }> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __scene3d: { camera(): { position: number[]; target: number[] } } })
      .__scene3d;
    return hook.camera();
  });
}

async function sceneIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __scene3d: { entityIds(): string[] } }).__scene3d;
    return hook.entityIds();
  });
}

test("3D-1 the stage draws the week", async ({ page, guard, app }) => {
  await openHome(page, { path: "/?quality=low" });
  await app.local || true;
  await loadSampleWeek(page);
  await waitScene(page);
  await expect(page.locator('[data-demo-3d="doorway-week"]')).toBeVisible();
  const ready = await page.evaluate(
    () => (window as unknown as { __scene3d: { ready(): boolean } }).__scene3d.ready(),
  );
  expect(ready).toBe(true);
  const variance = await stageVariance(page);
  expect(variance).toBeGreaterThanOrEqual(40);
  test.info().annotations.push({ type: "variance", description: String(variance) });
  expect(guard.errors()).toEqual([]);
});

test("3D-2 the picture has the same days as the calendar", async ({ page, app }) => {
  await openHome(page, { path: "/?quality=low" });
  await app.local || true;
  await loadSampleWeek(page);
  await waitScene(page);
  const model = await readModel(page);
  const ids = await sceneIds(page);
  expect(ids.filter((id) => id.startsWith("day:"))).toHaveLength(7);
  const expected = weekRibbon(model).reduce((sum, day) => sum + day.visits.length, 0);
  expect(ids.filter((id) => id.startsWith("vis:")).length).toBe(expected);
});

test("3D-3 the shots move the camera", async ({ page, app }) => {
  await openHome(page, { path: "/?quality=low" });
  await app.local || true;
  await loadSampleWeek(page);
  await waitScene(page);
  await page.locator('button[data-shot="walk"]').click();
  {
    const start = Date.now();
    let ok = false;
    while (Date.now() - start < 5000) {
      const cam = await sceneCamera(page);
      if (dist3(cam.position, WALK.position) <= 0.05 && dist3(cam.target, WALK.target) <= 0.05) {
        ok = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    expect(ok).toBe(true);
  }
  expect((await readModel(page)).ui.shotId).toBe("walk");
  await page.locator('button[data-shot="overview"]').click();
  {
    const start = Date.now();
    let ok = false;
    while (Date.now() - start < 5000) {
      const cam = await sceneCamera(page);
      if (dist3(cam.position, OVERVIEW.position) <= 0.05 && dist3(cam.target, OVERVIEW.target) <= 0.05) {
        ok = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    expect(ok).toBe(true);
  }
  expect((await readModel(page)).ui.shotId).toBe("overview");
  const id = await openFirstCandidate(page);
  if (!id) throw new Error("the sample week has no candidate incident");
  const focus = shotList(await readModel(page)).find((s) => s.name === `focus:${id}`);
  if (!focus) throw new Error(`no focus shot for ${id}`);
  await page.locator('button[data-shot="focus"]').click();
  {
    const start = Date.now();
    let ok = false;
    while (Date.now() - start < 5000) {
      const cam = await sceneCamera(page);
      if (dist3(cam.position, focus.position) <= 0.05 && dist3(cam.target, focus.target) <= 0.05) {
        ok = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    expect(ok).toBe(true);
  }
  expect((await readModel(page)).ui.shotId).toBe(`focus:${id}`);
});

test("3D-4 an agent action moves the picture", async ({ page, app }) => {
  await openHome(page, { path: "/?quality=low" });
  await app.local || true;
  await loadSampleWeek(page);
  await waitScene(page);
  const before = (await sceneIds(page)).filter((id) => id.startsWith("inc-")).length;
  await page.getByText("Run an action by hand").click();
  await page.getByLabel("Action").selectOption({ label: "Set camera shot" });
  await page.getByLabel("Shot", { exact: true }).selectOption("walk");
  await page.getByRole("button", { name: "Run" }).click();
  {
    const start = Date.now();
    let ok = false;
    while (Date.now() - start < 5000) {
      const cam = await sceneCamera(page);
      if (dist3(cam.position, WALK.position) <= 0.05 && dist3(cam.target, WALK.target) <= 0.05) {
        ok = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    expect(ok).toBe(true);
  }
  expect((await readModel(page)).ui.shotId).toBe("walk");
  const picked = candidateIncidents(await readModel(page))[0];
  if (!picked) throw new Error("the sample week has no candidate incident");
  await page.getByLabel("Action").selectOption({ label: "Open incident" });
  await page.getByLabel("Kind").selectOption(picked.kind);
  await page.getByLabel("Title").fill(picked.title);
  await page.getByLabel("EventIds", { exact: true }).fill(JSON.stringify(picked.eventIds));
  await page.getByLabel("StartMs", { exact: true }).fill(String(picked.startMs));
  await page.getByLabel("EndMs", { exact: true }).fill(String(picked.endMs));
  if (picked.routineId !== undefined) await page.getByLabel("RoutineId", { exact: true }).fill(picked.routineId);
  if (picked.dayIndex !== undefined) await page.getByLabel("DayIndex", { exact: true }).fill(String(picked.dayIndex));
  await page.getByRole("button", { name: "Run" }).click();
  await expect
    .poll(async () => (await sceneIds(page)).filter((id) => id.startsWith("inc-")).length, {
      timeout: 10000,
    })
    .toBe(before + 1);
});

test("3D-5 the picture is fast enough and survives no WebGL", async ({ page, browser, app }) => {
  await openHome(page, { path: "/?quality=low" });
  await app.local || true;
  await loadSampleWeek(page);
  await waitScene(page);
  // Demand frameloop draws nothing when idle, so an idle window measures 0–2
  // frames by design (not slowness): measure across a shot transition, which
  // renders continuously for ~2.5–3 s under SwiftShader (FIX-9).
  await page.locator('[data-slot="stage"] button[data-shot="walk"]').click();
  const need = process.env["THREE_D_HEADED"] === "1" ? 100 : 40;
  const frames0 = await page.evaluate(
    () => (window as unknown as { __scene3d: { frames(): number } }).__scene3d.frames(),
  );
  const calls = await page.evaluate(
    () => (window as unknown as { __scene3d: { drawCalls(): number } }).__scene3d.drawCalls(),
  );
  await page.waitForTimeout(2000);
  const frames1 = await page.evaluate(
    () => (window as unknown as { __scene3d: { frames(): number } }).__scene3d.frames(),
  );
  expect(frames1 - frames0).toBeGreaterThanOrEqual(need);
  expect(calls).toBeLessThan(300);
  const noGl = await browser.newContext();
  try {
    await noGl.addInitScript(`HTMLCanvasElement.prototype.getContext = () => null;`);
    const flat = await noGl.newPage();
    const errors: string[] = [];
    flat.on("pageerror", (err) => errors.push(err.message));
    const origin = new URL(page.url()).origin;
    await flat.goto(`${origin}/?hook=1&quality=low`, { waitUntil: "domcontentloaded" });
    await flat.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 });
    await expect(flat.locator('[data-demo-3d="unavailable"]')).toBeVisible();
    await expect(flat.locator('[data-demo-3d="unavailable"]')).toContainText(/flat week/i);
    expect(errors).toEqual([]);
  } finally {
    await noGl.close();
  }
});
