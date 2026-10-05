// Requirement IDs: HEE-SHOW-01, HEE-SHOW-04
// Replay control e2e: labelled banner, rows per replayable call, stop freezes,
// and no data-demo-focus anywhere.
import { expect, test } from "@playwright/test";

test("replay is labelled, plays the recorded calls, and stops", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/REPLAY of a recorded run from/)).toBeVisible();
  await expect(page.locator("[data-demo-focus]")).toHaveCount(0);

  await page.selectOption("[data-hee-replay=speed]", "4");
  await page.getByRole("button", { name: "Watch the agent do it" }).click();
  await expect.poll(async () => page.getByTestId("replay-rows").locator("li").count()).toBe(3);
  await expect(page.getByText(/REPLAY of a recorded run from/)).toBeVisible();
  await expect(page.getByText("Replay finished. Nothing above was live.")).toBeVisible();

  await page.reload();
  await expect(page.getByText(/REPLAY of a recorded run from/)).toBeVisible();
  await page.getByRole("button", { name: "Watch the agent do it" }).click();
  await expect(page.getByTestId("replay-rows").locator("li").first()).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  const frozen = await page.getByTestId("replay-rows").locator("li").count();
  await page.waitForTimeout(1500);
  expect(await page.getByTestId("replay-rows").locator("li").count()).toBe(frozen);
  expect(await page.locator("[data-demo-focus]").count()).toBe(0);
});
