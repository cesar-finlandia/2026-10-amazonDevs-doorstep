// Requirement IDs: HEE-KIT-02
import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { saveTraceFromPage } from "../../src/node/saveTrace.js";
import { summarizeTrace } from "../../src/trace/summarize.js";

const OUT = join(import.meta.dirname, "..", "..", "test-results", "run-trace.json");

test("scripted agent run approves, repairs, and traces", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Run scripted agent" }).click();
  await expect(page.getByText(/AGENT WANTS TO/)).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Stocked 6 widgets").last()).toBeVisible({ timeout: 30000 });

  const trace = await saveTraceFromPage(page, OUT);
  const summary = summarizeTrace(trace.entries);
  expect(summary.verify_repair_rounds).toBeGreaterThanOrEqual(1);
  expect(summary.human_checkpoints).toBeGreaterThanOrEqual(1);
  expect(summary.actions).toBeGreaterThanOrEqual(8);

  const feedText = await page.locator("ol").first().innerText();
  expect(feedText).toContain("AGENT");

  const revisionText = await page.getByText(/^Revision \d+$/).innerText();
  const lastChange = [...trace.entries].reverse().find((e) => e.state_change);
  expect(revisionText).toBe(`Revision ${lastChange?.state_change?.revision_after}`);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("ol").first()).toContainText("YOU");
});

test("rejection shows the exact sentence and keeps the entity", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Run scripted agent" }).click();
  await expect(page.getByText(/AGENT WANTS TO/)).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.locator("ol").first()).toContainText(
    'The human declined "remove epsilon". Ask what to do instead.',
    { timeout: 30000 },
  );

  await page.getByLabel("Action").selectOption("get_widget");
  await page.getByLabel("Name").fill("epsilon");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("epsilon on shelf-a").last()).toBeVisible({ timeout: 15000 });
});
