// e2e/harness.spec.ts — the trivial harness scenario H-1 (DP-E2E-BROWSER-TESTING §5.3).
// Requirement IDs: NFR-12
import { test, expect } from "./fixtures";
import { openHome } from "./helpers";

test("H-1 the app boots and says its build", async ({ page, app, guard }) => {
  await openHome(page);
  await expect(page.locator('body[data-app-ready="true"]')).toBeAttached();
  const res = await page.request.get(`${app.url}/health`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { ok: boolean; build: unknown };
  expect(body.ok).toBe(true);
  if (app.local) {
    expect(body.build).toBe("e2e-1");
  } else {
    expect(typeof body.build === "string" && (body.build as string).length > 0).toBe(true);
  }
  expect(guard.errors()).toEqual([]);
});
