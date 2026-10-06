// e2e/smoke.spec.ts — the deployed-URL gate C-40 (DP-E2E-BROWSER-TESTING §3.7; assertions §5.3 SMOKE-1..4).
// Requirement IDs: FR-24, FR-06
// It reads its target from BASE_URL (default: the local server of the `app`
// fixture) and uses only app.url, openHome, loadSampleWeek, reviewTheWeek,
// checkNow, request and guard, so it runs unchanged against a deployed URL.
import { test, expect } from "./fixtures";
import { openHome, loadSampleWeek, reviewTheWeek, checkNow } from "./helpers";

test.beforeAll(async ({ app }) => {
  console.log(`smoke: base ${app.url}`);
  console.log(`smoke: local ${app.local}`);
});

type Issue = { id: string; severity: "error" | "warning"; message: string };

/** helpers.checkNow is typed as the issue list, but session.checkNow()
//  answers { issues, counts }: accept both shapes (recorded for WU-08). */
function issuesOf(res: unknown): Issue[] {
  if (Array.isArray(res)) return res as Issue[];
  if (typeof res === "object" && res !== null && Array.isArray((res as { issues?: unknown }).issues)) {
    return (res as { issues: Issue[] }).issues;
  }
  throw new Error(`checkNow() answered neither a list nor { issues }: ${String(JSON.stringify(res)).slice(0, 120)}`);
}

test("SMOKE-1 health answers with a build marker", async ({ app, request }) => {
  const res = await request.get(`${app.url}/health`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: unknown; build: unknown };
  expect(body.ok).toBe(true);
  expect(typeof body.build === "string" && (body.build as string).length > 0).toBe(true);
});

test("SMOKE-2 the home page loads clean", async ({ page, guard }) => {
  await openHome(page);
  await expect(page.locator('body[data-app-ready="true"]')).toBeAttached();
  await expect(page.locator(".brandmark__word")).toBeVisible();
  expect(guard.errors()).toEqual([]);
});

test("SMOKE-3 a week review runs to the end", async ({ page }) => {
  await openHome(page);
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  await expect(page.locator("[data-run-status]")).toHaveAttribute("data-run-status", "done");
  const issues = issuesOf(await checkNow(page));
  const open = issues.filter((i) => i.severity === "error" || i.severity === "warning").length;
  const badge = Number((await page.locator("[data-check-count]").innerText()).trim());
  expect(badge).toBe(open);
  const hero = Number(
    (await page.locator('[data-result-region="open-checks"] [data-metric]').innerText()).trim(),
  );
  expect(hero).toBe(open);
  const chips = page.locator("header.appbar").locator(".status-chip");
  const ringChip = (await chips.filter({ hasText: "Ring" }).locator(".subject").innerText()).trim();
  const agentChip = (await chips.filter({ hasText: "Agent" }).locator(".subject").innerText()).trim();
  expect(agentChip.length).toBeGreaterThan(0);
  expect(ringChip.length).toBeGreaterThan(0);
  test.info().annotations.push({ type: "rung", description: agentChip });
  test.info().annotations.push({ type: "ring", description: ringChip });
});

test("SMOKE-4 the three routes render", async ({ page }) => {
  await openHome(page);
  await expect(page.locator('[data-demo-focus="workbench"]')).toBeVisible();
  await openHome(page, { path: "/watch" });
  await expect(page.locator('[data-demo-focus="replay"]')).toContainText(/replay/i);
  await openHome(page, { path: "/lab" });
  await expect(page.locator('[data-demo-focus="lab"]')).toBeVisible();
  await openHome(page, { path: "/nope" });
  await expect(page.locator('[data-demo-focus="workbench"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});
