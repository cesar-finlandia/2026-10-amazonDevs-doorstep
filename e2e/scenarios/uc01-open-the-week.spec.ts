// e2e/scenarios/uc01-open-the-week.spec.ts — UC-01 "I open the page and see my mum's week at a glance".
// Requirement IDs: FR-19, FR-23, NFR-04, NFR-06
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, readModel, SIZE_DESKTOP, SIZE_PHONE } from "../helpers";
import { emptyEvents, weekTitle } from "src/ui/copy/templates";
import { weekRibbon } from "src/domain/derive";

test("UC01-1 the first screen is empty, labelled and calm", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await expect(page.getByText(emptyEvents().title)).toBeVisible();
  const firstClass = await page.evaluate(() => document.querySelector("header")?.firstElementChild?.className ?? "");
  expect(firstClass).toContain("brandmark");
  await expect(page.locator('[data-demo-focus="workbench"]')).toHaveCount(1);
});

test("UC01-2 loading the sample week fills the calendar", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await expect(page.locator("button[data-day]")).toHaveCount(7);
  expect(await page.locator(".tick").count()).toBeGreaterThan(20);
  const model = await readModel(page);
  await expect(page.locator('[data-slot="title"] h1')).toHaveText(weekTitle(model));
  const support = await page.locator('[data-slot="title"] .support').textContent();
  expect(support?.startsWith("Rosa's front door · Sample week")).toBe(true);
});

test("UC01-3 every day shows the ticks the model holds", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  // The sample week ingests in three channel batches after the first ticks
  // paint, and derived ticks can trail the event count by a render: settle on
  // BOTH the event count and the rendered tick count, then compare each day
  // against a fresh model read. Both sides stay exact (never weakened, never
  // a fixed sleep above 250 ms). FIX-2.
  let last = -1;
  let lastTicks = -1;
  const settledAt = Date.now();
  for (;;) {
    const n = (await readModel(page)).events.length;
    const t = await page.locator(".tick").count();
    if (n === last && t === lastTicks) break;
    last = n;
    lastTicks = t;
    if (Date.now() - settledAt > 30000) throw new Error("the sample week did not settle");
    await page.waitForTimeout(250);
  }
  const model = await readModel(page);
  const ribbon = weekRibbon(model);
  for (let i = 0; i < 7; i++) {
    const day = ribbon[i];
    if (!day) throw new Error(`ribbon has no day ${i}`);
    await expect(page.locator(`button[data-day="${i}"] .tick`)).toHaveCount(day.ticks.length);
  }
});

test("UC01-4 choosing a day marks it and tells the model", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await page.locator('button[data-day="2"]').click();
  for (let i = 0; i < 7; i++) {
    await expect(page.locator(`button[data-day="${i}"]`)).toHaveAttribute("aria-pressed", i === 2 ? "true" : "false");
  }
  const model = await readModel(page);
  expect(model.ui.selectedDay).toBe(2);
});

test("UC01-5 the page fits a laptop and a phone", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  // Measure the loaded week, not the mid-stream layout: settle first (FIX-2b).
  let last = -1;
  let lastTicks = -1;
  const settledAt = Date.now();
  for (;;) {
    const n = (await readModel(page)).events.length;
    const t = await page.locator(".tick").count();
    if (n === last && t === lastTicks) break;
    last = n;
    lastTicks = t;
    if (Date.now() - settledAt > 30000) throw new Error("the sample week did not settle");
    await page.waitForTimeout(250);
  }
  await page.setViewportSize(SIZE_DESKTOP);
  const desktopOverflow = await page.evaluate(() => [...document.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).length);
  expect(desktopOverflow).toBe(0);
  await page.setViewportSize(SIZE_PHONE);
  // The R3F canvas resizes on the next frame after a viewport change; measure
  // the settled layout, not the mid-transition frame (FIX-2c).
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("canvas")].every(
        (c) => c.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5,
      ),
    undefined,
    { timeout: 5000 },
  );
  const phoneOverflow = await page.evaluate(() => [...document.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).length);
  expect(phoneOverflow).toBe(0);
  await page.setViewportSize(SIZE_DESKTOP);
  const heroSize = await page.evaluate(() => {
    const el = document.querySelector('[data-result-region="open-checks"] [data-metric]');
    return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
  });
  expect(heroSize).toBeGreaterThanOrEqual(64);
});
