import { defineConfig } from "@playwright/test";
import { GL_ARGS } from "./e2e/helpers";

export default defineConfig({
  testDir: "e2e",
  testMatch: ["scenarios/**/*.spec.ts", "harness.spec.ts", "smoke.spec.ts", "depth.spec.ts"],
  outputDir: "e2e/artifacts/results",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,                                   // a flaky scenario is a defect, never retried away
  reporter: [["list"], ["json", { outputFile: "e2e/artifacts/report.json" }]],
  use: {
    baseURL: process.env.BASE_URL || undefined,
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: { args: GL_ARGS },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
