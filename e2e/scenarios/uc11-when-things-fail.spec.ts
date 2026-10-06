// e2e/scenarios/uc11-when-things-fail.spec.ts — UC-11 "When something is down I am told, in plain words, what I am looking at".
// Requirement IDs: FR-21
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, readModel } from "../helpers";
import { runningByHand, recordedRun } from "src/ui/copy/templates";

test("UC11-1 by-hand mode is named in words", async ({ page, app }) => {
  await page.route("**/api/status*", async (route) => {
    await route.fulfill({ json: { ring: { mode: "bundle" }, agent: { kind: "manual", label: "Manual", model: null }, cost: { usedPct: 0 }, inbox: { default: 0 } } });
  });
  await openHome(page);
  await app.local || true;
  const title = await page.locator('[data-tier="banner"] .message__title').textContent();
  expect((title ?? "").trim()).toBe(runningByHand().title);
});

test("UC11-2 the recorded run is named in words", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const title = await page.locator('[data-tier="banner"] .message__title').textContent();
  expect((title ?? "").trim()).toBe(recordedRun(null).title);
  await expect(page.locator("header").getByText("Recorded run").first()).toBeVisible();
  const model = await readModel(page);
  expect(model.events.length).toBeGreaterThan(0);
});

test("UC11-3 a failing step is shown without a stack", async ({ page, app, guard }) => {
  guard.allow("Failed to load resource: the server responded with a status of 500 (Internal Server Error)");
  await page.route("**/api/agent/role/**", async (route) => {
    await route.fulfill({ status: 500, json: { ok: false, error: { code: "boom", message: "boom" } } });
  });
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await page.getByRole("button", { name: /Review the (sample )?week/ }).first().click();
  const banner = page.locator('[data-tier="banner"]');
  await expect(banner.getByText("That didn't work")).toBeVisible({ timeout: 120000 });
  const text = (await banner.textContent()) ?? "";
  expect(text).not.toMatch(/\bat \S+:\d+/);
  await banner.getByRole("button", { name: "Show details" }).click();
  await expect(banner.getByRole("button", { name: "Hide details" })).toBeVisible();
});
