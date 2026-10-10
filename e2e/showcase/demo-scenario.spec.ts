// e2e/showcase/demo-scenario.spec.ts — DP-SHOWCASE WU-02.
// Runs design_documents/demo-scenario.json with the showcase tool's runStep,
// so the stills show exactly what this test proves. Outside e2e/scenarios/
// so the 60-test E2E suite keeps its count.
import { test, expect } from "../fixtures";
import { readDemoScenario, runStep } from "../../hee/src/showcase/scenario";

test("SHOWCASE-1 the demo scenario runs", async ({ page, guard, app }) => {
  const scenario = readDemoScenario("design_documents/demo-scenario.json");
  for (const step of scenario.steps) {
    await runStep(page, step, app.url);
  }
  await expect(page.locator("[data-run-status]")).toHaveAttribute("data-run-status", "done");
  await expect(page.locator('[data-result-region="incident-card"]').first()).toBeAttached();
  expect(guard.errors()).toEqual([]);
});
