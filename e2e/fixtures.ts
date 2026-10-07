// e2e/fixtures.ts — the Playwright app + console-guard fixtures (DP-E2E-BROWSER-TESTING §3.3).
// Requirement IDs: FR-24
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test as base, expect, type ConsoleMessage, type Page } from "@playwright/test";
import type { MockRing } from "../scripts/mock-ring-server";
import { createMockRingServer } from "../scripts/mock-ring-server";
import { startServer } from "src/server/start.js";
import { randomSecret } from "./helpers";

export interface AppHandle {
  url: string;                              // BASE_URL when set, else the local server's URL
  local: boolean;                           // false when BASE_URL is set (a deployed run)
  secrets: { webhook: string; hmac: string };   // random per worker; empty strings when !local
  ring: MockRing | null;                    // the simulated Ring this server talks to; null when !local
  proofLog: string;                         // temporary file path the server writes proof lines to; "" when !local
  stats(): { requests: number; byPath: Record<string, number>; rateLimited: number } | null;
}

export interface ConsoleGuard {
  allow(exactMessage: string): void;        // the only way to tolerate a console error: by its exact text, per test
  errors(): string[];                       // every console.error and uncaught page error not allowed, so far
}

function newestSourceMs(): number {
  let newest = 0;
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(p).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        walk(p);
      } else {
        try {
          const ms = statSync(p).mtimeMs;
          if (ms > newest) newest = ms;
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk("src");
  walk("public");
  for (const f of ["index.html", "vite.config.ts"]) {
    try {
      const ms = statSync(f).mtimeMs;
      if (ms > newest) newest = ms;
    } catch {
      /* ignore */
    }
  }
  return newest;
}

/** `npx vite build --logLevel error` when dist/index.html is missing or older
 *  than any file under src/ (the ensureBuilt rule of DP-UI). */
async function ensureBuilt(): Promise<void> {
  const index = "dist/index.html";
  let built = 0;
  try {
    built = statSync(index).mtimeMs;
  } catch {
    built = 0;
  }
  if (!existsSync(index) || built < newestSourceMs()) {
    const r = spawnSync("npx", ["vite", "build", "--logLevel", "error"], {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: true,
      timeout: 300000,
      env: { ...process.env, VITE_UI_BUILD: "1" },
    });
    if ((r.status ?? 1) !== 0) throw new Error(`vite build failed: ${r.stdout ?? ""}${r.stderr ?? ""}`);
  }
}

export const test: import("@playwright/test").TestType<
  { guard: ConsoleGuard },                  // auto fixture: attached to `page`, asserted empty after every test
  { app: AppHandle }                        // worker fixture
> = base.extend<{ guard: ConsoleGuard }, { app: AppHandle }>({
  app: [
    async ({}, use) => {
      // Behaviour (literal): the **`app`** worker fixture, when `process.env.BASE_URL` is empty, runs `npx vite build --logLevel error` once if `dist/index.html` is missing or older than any file under `src/` (the `ensureBuilt` rule of DP-UI), creates the simulated Ring `createMockRingServer({ webhookSecret })`, and calls
      // `startServer({ port: 0, config: { staticDir: "dist", proofLog: <tmp>/proof.log }, env: { NODE_ENV: "test", AGENT_PROVIDER: "golden", BUILD_MARKER: "e2e-1", ALLOW_SIMULATE: "1", RING_WEBHOOK_SECRET: secrets.webhook, RING_HMAC_KEY: secrets.hmac }, ringBaseUrl: ring.url, oauthUrl: ring.oauthUrl })`;
      // teardown closes both. The **`guard`** auto fixture subscribes to `page.on("console")` (type `error`) and `page.on("pageerror")` before the test body and, after it, fails the test with the collected messages unless each was allowed by exact text. A scenario that deliberately provokes an error (the `500` of `uc11`, the `401` of `S-RING-4`) names the exact browser message it expects with `guard.allow(...)`.
      const baseUrl = process.env["BASE_URL"] ?? "";
      if (baseUrl !== "") {
        const handle: AppHandle = {
          url: baseUrl,
          local: false,
          secrets: { webhook: "", hmac: "" },
          ring: null,
          proofLog: "",
          stats: () => null,
        };
        await use(handle);
        return;
      }
      await ensureBuilt();
      const secrets = { webhook: randomSecret(), hmac: randomSecret() };
      const ring = await createMockRingServer({ webhookSecret: secrets.webhook });
      // E2E_PROOF_LOG (WU-E2E-11): only depth.spec.ts and s-bedrock.spec.ts are run with it set.
      const proofLog = process.env["E2E_PROOF_LOG"] ? resolve(process.env["E2E_PROOF_LOG"]) : join(tmpdir(), `e2e-${randomSecret(4)}-proof.log`);
      const server = await startServer({
        port: 0,
        config: { staticDir: process.env["E2E_DIST"] ?? "dist", proofLog },
        env: {
          NODE_ENV: "test",
          AGENT_PROVIDER: "golden",
          BUILD_MARKER: "e2e-1",
          ALLOW_SIMULATE: "1",
          RING_WEBHOOK_SECRET: secrets.webhook,
          RING_HMAC_KEY: secrets.hmac,
        },
        ringBaseUrl: ring.url,
        oauthUrl: ring.oauthUrl,
      });
      // Export the local URL through the environment so openHome(page) and the
      // config's baseURL resolve without the test naming the port.
      process.env["BASE_URL"] = server.url;
      const handle: AppHandle = {
        url: server.url,
        local: true,
        secrets,
        ring,
        proofLog,
        stats: () => ring.stats(),
      };
      try {
        await use(handle);
      } finally {
        await server.close();
        await ring.close();
      }
    },
    { scope: "worker" },
  ],
  guard: [
    async ({ page }: { page: Page }, use) => {
      const allowed = new Set<string>();
      const seen: string[] = [];
      const guard: ConsoleGuard = {
        allow: (exactMessage: string): void => {
          allowed.add(exactMessage);
        },
        errors: (): string[] => seen.filter((m) => !allowed.has(m)),
      };
      const onConsole = (msg: ConsoleMessage): void => {
        if (msg.type() === "error") seen.push(msg.text());
      };
      const onPageError = (err: Error): void => {
        seen.push(err.message);
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      await use(guard);
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      const left = guard.errors();
      if (left.length > 0) throw new Error(`console errors:\n${left.join("\n")}`);
    },
    { auto: true },
  ],
});
export { expect };
