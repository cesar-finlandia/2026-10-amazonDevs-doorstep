// scripts/make-stills.ts — DP-SHOWCASE WU-04 (§5.6, §3.4).
// Captures the six stills + hero GIF with the software-GL launch arguments.
// Usage: npx vite-node scripts/make-stills.ts [--base-url <url>]
// Base URL default: deploy-record.json (PROJECT_SYNC_DIR or the default dir).
// Prints `stills: base <url>`, `stills: webgl yes`, then the tool's own line.
// If the approve step fails on the deployed rung, falls back to a local
// golden server and records the choice in shots/showcase/fallback.json
// (WU-05 folds it into showcase.json known_gaps).
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { makeStills } from "../hee/src/showcase/stills.js";
import type { BrowserLike } from "../hee/src/showcase/stills.js";
import { GL_ARGS } from "../e2e/helpers.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function recordUrl(): string {
  const dir = process.env["PROJECT_SYNC_DIR"] ?? "../../hackathons/hackathon-projects/2026-10-amazonDevs";
  const sep = dir.endsWith("/") || dir.endsWith("\\") ? "" : "/";
  try {
    const rec = JSON.parse(readFileSync(`${dir}${sep}deploy-record.json`, "utf8")) as { url?: string };
    if (typeof rec.url === "string" && rec.url !== "") return rec.url;
  } catch { /* ignore */ }
  return "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function webglYes(): Promise<boolean> {
  const browser = await chromium.launch({ args: GL_ARGS });
  try {
    const page = await browser.newPage();
    const ok = await page.evaluate(() => {
      const c = document.createElement("canvas");
      return c.getContext("webgl") !== null || (c as unknown as { getContext(x: string): unknown }).getContext("experimental-webgl") !== null;
    });
    return ok === true;
  } finally {
    await browser.close();
  }
}

async function make(baseUrl: string): Promise<void> {
  const res = await makeStills({
    entryDir: ".",
    baseUrl,
    launch: async (): Promise<BrowserLike> => {
      const b = await chromium.launch({ args: GL_ARGS });
      return b as unknown as BrowserLike;
    },
  });
  if (res.warning !== undefined) console.log(`stills: warning ${res.warning}`);
}

const requested = arg("--base-url") ?? "";
const primary = requested !== "" ? requested : recordUrl();
if (primary === "") {
  console.error("BLOCKED (no base URL: pass --base-url or deploy first)");
  process.exit(3);
}
console.log(`stills: base ${primary}`);
if (!(await webglYes())) {
  console.log("stills: webgl no");
  process.exit(1);
}
console.log("stills: webgl yes");
try {
  await make(primary);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/no element named "Approve"/.test(msg)) {
    console.log(`stills: deployed rung asks for different approvals (${msg}); falling back to a local golden server`);
    const port = 44001 + Math.floor(Math.random() * 1000);
    const child = spawn("npx", ["vite-node", "src/server/index.ts"], {
      cwd: process.cwd(),
      shell: true,
      env: { ...process.env, PORT: String(port), AGENT_PROVIDER: "golden", BUILD_MARKER: "local", ALLOW_SIMULATE: "1" },
    });
    const local = `http://127.0.0.1:${port}`;
    try {
      const deadline = Date.now() + 30000;
      for (;;) {
        await sleep(500);
        try {
          const res = await fetch(`${local}/health`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) break;
        } catch { /* retry */ }
        if (Date.now() > deadline) throw new Error("local server did not start");
      }
      await make(local);
      writeFileSync(
        "shots/showcase/fallback.json",
        JSON.stringify({ baseUrl: local, fallback: true, reason: "deployed rung approval mismatch; captured against a local golden server" }, null, 2) + "\n",
        "utf8",
      );
    } finally {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      await sleep(1000);
      try { child.kill("SIGKILL"); } catch { /* ignore */ }
    }
  } else {
    throw e;
  }
}
process.exit(0);
