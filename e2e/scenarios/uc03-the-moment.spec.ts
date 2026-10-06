// e2e/scenarios/uc03-the-moment.spec.ts — UC-03 "I see the one moment that did not fit, with a picture".
// Requirement IDs: FR-14, FR-17, FR-19
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, readModel, openFirstCandidate } from "../helpers";
import { fmtDuration } from "src/domain/time";

test("UC03-1 a moment that did not fit is circled on its day", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const id = await openFirstCandidate(page);
  expect(id).not.toBeNull();
  await expect(page.locator(".pencil-circle")).toHaveCount(1);
  const model = await readModel(page);
  const incident = model.incidents.find((i) => i.id === id);
  expect(incident).toBeDefined();
  const circle = page.locator(".pencil-circle");
  await expect(circle).toHaveAttribute("aria-label", /^Open incident: /);
  // The ribbon columns carry display indices (0..6) while incident.dayIndex is
  // absolute over the 14-day window: locate the incident through its own
  // event tick instead of assuming an offset (FIX-6).
  const firstEvent = incident?.eventIds[0] ?? "";
  expect(firstEvent).not.toBe("");
  const col = page.locator("div.day-col", { has: page.locator(`.tick[title="${firstEvent}"]`) });
  await expect(col.locator(".pencil-circle")).toHaveCount(1);
});

test("UC03-2 the card shows the picture from that moment", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await openFirstCandidate(page);
  const img = page.getByRole("img", { name: /^Snapshot from / });
  await expect(img).toBeVisible();
  const width = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
  expect(width).toBeGreaterThan(0);
});

test("UC03-3 the dwell time shown is the time recorded", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const id = await openFirstCandidate(page);
  const model = await readModel(page);
  const incident = model.incidents.find((i) => i.id === id);
  if (!incident) throw new Error("opened incident is not in the model");
  const card = page.locator('[data-result-region="incident-card"]');
  await expect(card.getByText(fmtDuration(incident.endMs - incident.startMs))).toBeVisible();
  const p90 = Math.round(Math.max(model.baseline.dwellP90Sec, 900) / 60);
  await expect(card.getByText(`usual under ${p90} min`)).toBeVisible();
});
