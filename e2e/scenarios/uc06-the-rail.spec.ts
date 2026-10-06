// e2e/scenarios/uc06-the-rail.spec.ts — UC-06 "I change the quiet hours and what the house agrees to share".
// Requirement IDs: FR-19, FR-16, NFR-05
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, settleSampleWeek, readModel } from "../helpers";
import { EFFECTIVE_QUIET_HOURS } from "src/domain/rules";

test("UC06-1 quiet hours can be changed and the page says what it counts", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await page.getByLabel("Start", { exact: true }).fill("21:30");
  await page.getByLabel("End", { exact: true }).fill("05:30");
  await expect(page.locator('[data-result-region="quiet-hours"]').getByText("Counted from 22:00 to 05:00")).toBeVisible();
  const model = await readModel(page);
  const eff = EFFECTIVE_QUIET_HOURS(model.household.quietHours);
  const pad = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  expect(`Counted from ${pad(eff.startMin)} to ${pad(eff.endMin)}`).toBe("Counted from 22:00 to 05:00");
});

test("UC06-2 two equal times are refused in words", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await settleSampleWeek(page);
  const before = (await readModel(page)).ledger.length;
  const endValue = await page.getByLabel("End", { exact: true }).inputValue();
  await page.getByLabel("Start", { exact: true }).fill(endValue);
  await expect(page.getByText("Pick two different times.")).toBeVisible();
  expect((await readModel(page)).ledger.length).toBe(before);
});

test("UC06-3 consent switches work and survive a reload of the page state", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const sw = page.getByRole("switch", { name: "Family messages" });
  const was = await sw.getAttribute("aria-checked");
  await sw.click();
  const model = await readModel(page);
  const scope = model.consent.find((c) => c.scope === "family_message");
  expect(scope).toBeDefined();
  await expect(sw).toHaveAttribute("aria-checked", String(scope?.granted));
  expect(String(scope?.granted)).not.toBe(was);
  const last = model.ledger[model.ledger.length - 1];
  expect(last?.action).toBe("set_consent");
  // LedgerEntry carries no actor field (src/domain/types.ts), so the person's
  // authorship is proven the way the product shows it: the trace entry the
  // toggle recorded has source "human" and the feed renders it with the YOU
  // badge on its first row.
  const badge = await page.locator('[data-result-region="activity-feed"] li').first().locator("span").first().textContent();
  expect((badge ?? "").trim()).toBe("YOU");
  await page.reload();
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 });
  await expect(page.getByRole("switch", { name: "Family messages" })).toHaveAttribute("aria-checked", String(scope?.granted));
});

test("UC06-4 the theme can be switched and is remembered", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await page.getByRole("radio", { name: "Dusk" }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await page.reload();
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await page.getByRole("radio", { name: "Paper" }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
});

test("UC06-5 the webhook pill counts what is waiting", async ({ page, app, request }) => {
  await openHome(page);
  await app.local || true;
  const first = (await (await request.get(`${app.url}/api/status`)).json()) as { inbox: { default: number } };
  await expect(page.getByText(`Webhook inbox · ${first.inbox.default} waiting`)).toBeVisible();
  await loadSampleWeek(page);
  const second = (await (await request.get(`${app.url}/api/status`)).json()) as { inbox: { default: number } };
  expect(second.inbox.default).toBe(0);
  await expect(page.getByText("Webhook inbox · 0 waiting")).toBeVisible();
});
