// e2e/scenarios/uc05-approve-a-message.spec.ts — UC-05 "Before anything is sent to Maya I approve or turn it down".
// Requirement IDs: FR-07, FR-15
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, readModel, reviewTheWeek } from "../helpers";

test("UC05-1 a proposed message to the caretaker shows its audience", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  const model = await readModel(page);
  expect(model.nudges.filter((n) => n.status === "proposed").length, `no proposed nudge; ledger has ${model.ledger.length} entries`).toBeGreaterThan(0);
  const card = page.locator("[data-nudge-card]");
  await expect(card.getByRole("button", { name: "Approve" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Reject" })).toBeVisible();
  await expect(card.getByText(/^To Maya/)).toBeVisible();
});

test("UC05-2 approving sends nothing until the person says so", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  const before = await readModel(page);
  const nudge = before.nudges.filter((n) => n.status === "proposed")[0];
  if (!nudge) throw new Error(`no proposed nudge; ledger has ${before.ledger.length} entries`);
  expect(nudge.status).toBe("proposed");
  await page.locator("[data-nudge-card]").getByRole("button", { name: "Approve" }).click();
  await expect.poll(async () => (await readModel(page)).nudges.find((n) => n.id === nudge.id)?.status, { timeout: 10000 }).toBe("approved");
  const after = await readModel(page);
  expect(after.ledger.filter((e) => e.action === "decide_nudge")).toHaveLength(1);
});

test("UC05-3 turning a message down returns a sentence", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  const before = await readModel(page);
  const nudge = before.nudges.filter((n) => n.status === "proposed")[0];
  if (!nudge) throw new Error(`no proposed nudge; ledger has ${before.ledger.length} entries`);
  await page.locator("[data-nudge-card]").getByRole("button", { name: "Reject" }).click();
  await expect.poll(async () => (await readModel(page)).nudges.find((n) => n.id === nudge.id)?.status, { timeout: 10000 }).toBe("rejected");
  await expect(page.locator('[data-result-region="activity-feed"]').getByText(/The human declined/)).toBeVisible();
});
