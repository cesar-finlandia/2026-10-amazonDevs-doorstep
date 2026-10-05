// Requirement IDs: HEE-KIT-01
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180000,
  use: {
    ...devices["Desktop Chrome"],
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  webServer: {
    command: "npx vite preview --port 4173",
    port: 4173,
    reuseExistingServer: false,
  },
});
