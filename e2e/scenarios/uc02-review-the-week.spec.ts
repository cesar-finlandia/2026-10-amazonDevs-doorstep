// e2e/scenarios/uc02-review-the-week.spec.ts — UC-02 "I ask for a review of the week and watch it work".
// Requirement IDs: FR-06, FR-09, FR-18, FR-05
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, settleSampleWeek, readModel, checkNow, reviewTheWeek, saveTrace } from "../helpers";

const PHASE_NAMES = ["Read the week", "Plan the review", "Check each day", "Run the checks", "Fix what was found", "Write it up", "Your decision"];

test("UC02-1 the review starts and shows its phases in order", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await settleSampleWeek(page);
  await page.getByRole("button", { name: /Review the (sample )?week/ }).first().click();
  await expect(page.locator("[data-run-status]")).toHaveAttribute("data-run-status", "running", { timeout: 60000 });
  const phases = await page.locator('[data-slot="agent"] .phase-list li').allTextContents();
  expect(phases.map((t) => t.trim())).toEqual(PHASE_NAMES);
  const start = Date.now();
  for (;;) {
    const status = await page.locator("[data-run-status]").getAttribute("data-run-status");
    if (status === "done" || status === "stopped") break;
    // count() + short-timeout click (never isVisible(): it can hang on a busy
    // page past the 90 s test budget). FIX-4.
    try {
      const approve = page.locator('[data-result-region="approval-bar"]').getByRole("button", { name: "Approve" }).first();
      if ((await approve.count()) > 0) await approve.click({ timeout: 3000 });
    } catch {
      /* detached mid-render; the next poll retries */
    }
    if (Date.now() - start > 120000) throw new Error("review did not finish after UC02-1 phase check");
    await page.waitForTimeout(100);
  }
  await expect(page.locator("[data-run-status]")).toHaveAttribute("data-run-status", "done");
});

test("UC02-2 the run waits for the person and then finishes", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await settleSampleWeek(page);
  await page.getByRole("button", { name: /Review the (sample )?week/ }).first().click();
  await expect(page.locator('[data-result-region="approval-bar"]').getByRole("button", { name: "Approve" }).first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole("button", { name: "Reject" }).first()).toBeVisible();
  await expect(page.getByText("Nothing is waiting for you.")).toBeHidden();
  const start = Date.now();
  for (;;) {
    const status = await page.locator("[data-run-status]").getAttribute("data-run-status");
    if (status === "done" || status === "stopped") break;
    try {
      const approve = page.locator('[data-result-region="approval-bar"]').getByRole("button", { name: "Approve" }).first();
      if ((await approve.count()) > 0) await approve.click({ timeout: 3000 });
    } catch {
      /* detached mid-render; the next poll retries */
    }
    if (Date.now() - start > 120000) throw new Error("review did not finish after UC02-2 approval check");
    await page.waitForTimeout(100);
  }
  await expect(page.locator("[data-run-status]")).toHaveAttribute("data-run-status", "done");
});

test("UC02-3 the numbers on screen are the engine's numbers", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  const issues = await checkNow(page);
  const total = issues.length;
  expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  await expect(page.locator("[data-check-count]")).toHaveText(String(total));
  const hero = await page.locator('[data-result-region="open-checks"] [data-metric]').textContent();
  expect((hero ?? "").trim()).toBe(String(total));
  const model = await readModel(page);
  expect(model.window.startMs).toBeLessThan(model.window.endMs);
});

test("UC02-4 the run leaves a valid trace", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  await saveTrace(page, "e2e/artifacts/run-trace.json");
  // The validator's module runs its CLI on import outside Vitest, so it is
  // loaded dynamically with the Vitest gate set (importing it must not exit).
  process.env["VITEST"] = "1";
  const { validateRunTraceFile } = await import("../../hee/scripts/hee-validate-run-trace");
  const checked = validateRunTraceFile("e2e/artifacts/run-trace.json");
  expect(checked.ok).toBe(true);
  if (!checked.ok) throw new Error("trace did not validate");
  expect(checked.summary.model_roles.length).toBeGreaterThanOrEqual(4);
  expect(checked.summary.actions).toBeGreaterThanOrEqual(15);
  expect(checked.summary.verify_repair_rounds).toBeGreaterThanOrEqual(1);
  expect(checked.summary.human_checkpoints).toBeGreaterThanOrEqual(1);
});
