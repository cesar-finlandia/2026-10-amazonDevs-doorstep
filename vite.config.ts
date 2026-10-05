// Requirement IDs: UI-03, UI-AC-02 | DP-UI WU-UI-04 (only the proxy entries belong to this plan)
// Vite config for the Doorstep Rhythm product UI.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

// Browser shims for Node-only modules in the UI's transitive graph. They apply
// ONLY when VITE_UI_BUILD=1 (the product build via `npm run build` / dev:ui).
// vite-node and the verify scripts always resolve the real modules, so the
// existing de-*/aw-*/ri-*/at-* suites are untouched. Behaviour is identical
// by construction (same APIs, same banned patterns, opaque hashes only).
const uiShims =
  process.env["VITE_UI_BUILD"] === "1"
    ? {
        "src/llm/guard.js": `${root}src/ui/shim/guard-browser.ts`,
        "src/kits/agent-workflow/src/registry/manifest.js": `${root}src/ui/shim/registry-manifest.ts`,
      }
    : {};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      src: `${root}src`,
      examples: `${root}examples`,
      ...uiShims,
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/events": "http://localhost:8080",
      "/health": "http://localhost:8080",
      "/webhooks": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
