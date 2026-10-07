// e2e/scenarios/uc04-decide-a-moment.spec.ts — UC-04 "I decide what to do about that moment".
// Requirement IDs: FR-07, FR-19
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, settleSampleWeek, readModel, checkNow, openFirstCandidate } from "../helpers";
import { candidateIncidents } from "src/domain/rules";

test("UC04-1 marking a moment explained keeps its write-up", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const id = await openFirstCandidate(page);
  const before = await readModel(page);
  const summary = before.incidents.find((i) => i.id === id)?.summary;
  await page.getByRole("button", { name: "Mark as explained" }).click();
  await expect.poll(async () => (await readModel(page)).incidents.find((i) => i.id === id)?.status, { timeout: 10000 }).toBe("explained");
  const after = await readModel(page);
  expect(after.incidents.find((i) => i.id === id)?.summary).toBe(summary);
  const cls = await page.locator(".pencil-circle").getAttribute("class");
  expect(cls).toContain("pencil-circle");
});

test("UC04-2 dismissing a moment is recorded as the person's act", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const id = await openFirstCandidate(page);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect.poll(async () => (await readModel(page)).incidents.find((i) => i.id === id)?.status, { timeout: 10000 }).toBe("dismissed");
  const model = await readModel(page);
  const last = model.ledger[model.ledger.length - 1];
  expect(last?.action).toBe("set_incident_status");
  const badge = await page.locator('[data-result-region="activity-feed"] li').first().locator("span").first().textContent();
  expect((badge ?? "").trim()).toBe("YOU");
});

test("UC04-3 a duplicate burst is merged from the Check panel", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await settleSampleWeek(page);
  const before = (await checkNow(page)).filter((i) => i.severity === "error").length;
  await page.getByRole("button", { name: "Merge duplicates" }).first().click();
  await expect.poll(async () => (await checkNow(page)).filter((i) => i.severity === "error").length, { timeout: 10000 }).toBeLessThan(before);
  const after = (await checkNow(page)).filter((i) => i.severity === "error").length;
  await expect(page.locator("[data-check-count]")).toHaveText(String((await checkNow(page)).length), { timeout: 1000 });
  expect(after).toBeLessThan(before);
});

test("UC04-4 a moment with no picture says so", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const model = await readModel(page);
  const first = candidateIncidents(model)[0];
  if (!first) throw new Error("the sample week has no candidate incident");
  await page.evaluate((c) => (window as unknown as { __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } } }).__doorstep.session.call("open_incident", { kind: c.kind, title: c.title, eventIds: [...c.eventIds], startMs: c.startMs, endMs: c.endMs, ...(c.routineId !== undefined ? { routineId: c.routineId } : {}), ...(c.dayIndex !== undefined ? { dayIndex: c.dayIndex } : {}), withSnapshot: false }, { source: "human" }), first);
  const card = page.locator('[data-result-region="incident-card"]');
  await expect(card.getByText("No snapshot for this moment")).toBeVisible();
  await expect(card.getByRole("img")).toHaveCount(0);
});
