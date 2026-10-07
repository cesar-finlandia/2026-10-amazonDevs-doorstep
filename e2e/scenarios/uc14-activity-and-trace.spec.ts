// e2e/scenarios/uc14-activity-and-trace.spec.ts — UC-14 "I see every step that was taken and by whom".
// Requirement IDs: FR-09
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, readModel, reviewTheWeek, openFirstCandidate } from "../helpers";

const BADGES = ["AGENT", "YOU", "SYSTEM"];

test("UC14-1 every step appears in the feed with its badge", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  const rows = page.locator('[data-result-region="activity-feed"] li');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(15);
  for (let i = 0; i < count; i++) {
    const badge = await rows.nth(i).locator("span").first().textContent();
    expect(BADGES).toContain((badge ?? "").trim());
  }
});

test("UC14-2 the feed rows use friendly titles", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  const texts = await page.locator('[data-result-region="activity-feed"] li').allTextContents();
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    expect(text).not.toMatch(/[A-Za-z]_[A-Za-z]/);
  }
  const titles = await page.locator('[data-result-region="activity-feed"] li strong').allTextContents();
  expect(titles.some((t) => t === "List devices" || t === "Open incident")).toBe(true);
});

test("UC14-3 a changed item flashes", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await openFirstCandidate(page);
  await page.getByRole("button", { name: "Mark as explained" }).click();
  await page.waitForSelector(".changed-flash", { timeout: 10000 });
  const appeared = Date.now();
  // The kit holds the class 900 ms; the visible tint is its 400 ms animation (DP-UI motion table).
  const animationMs = await page.evaluate(() => {
    const el = document.querySelector(".changed-flash");
    return el ? parseFloat(getComputedStyle(el).animationDuration) * 1000 : -1;
  });
  expect(animationMs).toBeGreaterThanOrEqual(200);
  expect(animationMs).toBeLessThanOrEqual(400);
  let gone = 0;
  for (let i = 0; i < 40; i++) {
    if ((await page.locator(".changed-flash").count()) === 0) {
      gone = Date.now();
      break;
    }
    await page.waitForTimeout(50);
  }
  expect(gone).toBeGreaterThan(0);
  const held = gone - appeared;
  expect(held).toBeGreaterThanOrEqual(100);
  expect(held).toBeLessThanOrEqual(1500);
  const model = await readModel(page);
  expect(model.incidents.length).toBeGreaterThan(0);
});

test("UC14-4 long rows can be opened", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  const buttons = page.locator('[data-result-region="activity-feed"] li button', { hasText: "Show more" });
  await expect(buttons.first()).toBeVisible();
  const before = await buttons.count();
  const handle = await buttons.first().elementHandle();
  if (!handle) throw new Error("the Show more button vanished before it was pressed");
  const row = await handle.evaluateHandle((el) => el.closest("li") as HTMLElement);
  await buttons.first().click();
  // The pressed button is gone and its row is no longer clamped.
  await expect(buttons).toHaveCount(before - 1);
  expect(await row.evaluate((el) => (el as HTMLElement).style.maxHeight)).toBe("none");
});
