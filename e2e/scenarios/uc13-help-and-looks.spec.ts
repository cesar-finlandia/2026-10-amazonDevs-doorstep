// e2e/scenarios/uc13-help-and-looks.spec.ts — UC-13 "I read what each part means and switch the page to the dusk look".
// Requirement IDs: FR-23, NFR-05
import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";
import { openHome, loadSampleWeek, settleSampleWeek } from "../helpers";
import { helpContent } from "src/ui/help/helpContent";

async function contrastRatio(page: Page): Promise<number> {
  // Measure the settled look: the theme switch runs colour transitions (FIX-24).
  // Wait until the resolved colours stop changing (three equal reads, 100 ms apart).
  let prev = "";
  let equal = 0;
  for (let i = 0; i < 60 && equal < 3; i += 1) {
    const now = await page.evaluate(() => `${getComputedStyle(document.body).color}|${getComputedStyle(document.body).backgroundColor}|${getComputedStyle(document.documentElement).backgroundColor}`);
    equal = now === prev ? equal + 1 : 0;
    prev = now;
    await page.waitForTimeout(100);
  }
  return page.evaluate(() => {
    const parse = (s: string): [number, number, number] => {
      const m = /rgba?\(([^)]+)\)/.exec(s);
      const parts = (m?.[1] ?? "").split(",").map((x) => parseFloat(x));
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    };
    const alpha = (s: string): number => {
      const m = /rgba?\(([^)]+)\)/.exec(s);
      const parts = (m?.[1] ?? "").split(",").map((x) => parseFloat(x));
      return parts.length > 3 ? (parts[3] ?? 1) : 1;
    };
    const lum = (c: [number, number, number]): number => {
      const f = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const body = getComputedStyle(document.body);
    const fg = parse(body.color);
    let bg = parse(body.backgroundColor);
    if (alpha(body.backgroundColor) === 0) bg = parse(getComputedStyle(document.documentElement).backgroundColor);
    const hi = Math.max(lum(fg), lum(bg));
    const lo = Math.min(lum(fg), lum(bg));
    return (hi + 0.05) / (lo + 0.05);
  });
}

test("UC13-1 every result region has a working `?`", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const ids: string[] = [];
  for (const id of Object.keys(helpContent)) {
    if ((await page.locator(`button[data-help-for="${id}"]`).count()) > 0) ids.push(id);
  }
  expect(ids.length).toBeGreaterThanOrEqual(5);
  for (const id of ids) {
    const copy = helpContent[id as keyof typeof helpContent];
    const btn = page.locator(`button[data-help-for="${id}"]`).first();
    await expect(btn).toHaveAttribute("aria-label", copy.label);
    await btn.click();
    const dialog = page.getByRole("dialog", { name: copy.label });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(copy.body)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

test("UC13-2 the explainer explains and lets the person try", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await settleSampleWeek(page);
  const before = await page.evaluate(() => document.querySelectorAll('[data-result-region="activity-feed"] li').length);
  await page.locator("[data-app-explainer]").click();
  const panel = page.locator("[data-app-explainer-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("h2")).toHaveCount(5);
  await panel.getByRole("button", { name: "Review the sample week" }).click();
  await expect.poll(async () => page.evaluate(() => document.querySelectorAll('[data-result-region="activity-feed"] li').length), { timeout: 120000 }).toBeGreaterThan(before);
});

test("UC13-3 the page reads well in both looks", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await page.getByRole("radio", { name: "Paper" }).click();
  expect(await contrastRatio(page)).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("radio", { name: "Dusk" }).click();
  expect(await contrastRatio(page)).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("radio", { name: "Paper" }).click();
});
