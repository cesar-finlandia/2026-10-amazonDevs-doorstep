// Requirement IDs: HEE-KIT-01, HEE-SHOW-01, HEE-SHOW-04
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  use: {
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx vite --port 4311",
    port: 4311,
    reuseExistingServer: true,
  },
});
