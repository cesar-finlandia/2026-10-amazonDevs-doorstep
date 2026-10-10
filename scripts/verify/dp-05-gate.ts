// scripts/verify/dp-05-gate.ts — DP-DEPLOY WU-DEPLOY-05 (8 checks).
// Requirement IDs: FR-24, FR-06
// Proves the hosted product meets the smoke + depth bars and the gate
// records the answering rung, stops on red with the way back, and is the
// one smoke test named by the strategy.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createChecker } from "./at-kit.js";
import { run } from "./e2e-kit.js";

const c = createChecker("dp-05-gate");
const URL = "https://doorstep-rhythm-7wndoy2fuq-uc.a.run.app";
const RUNGS = ["Amazon Bedrock", "Fallback model (not Bedrock)", "Recorded run", "Manual"];

// 1. Playwright's own summary: 4 passed against the deployed URL.
const pw = run("npx", ["playwright", "test", "e2e/smoke.spec.ts"], { env: { BASE_URL: URL } });
c.ok(pw.code === 0 && /4 passed/.test(pw.out), "playwright smoke.spec.ts: 4 passed");

// 2. Counting wrapper: smoke green.
const smoke = run("npx", ["vite-node", "scripts/e2e-run.ts", "--label", "smoke", "e2e/smoke.spec.ts"], { env: { BASE_URL: URL } });
c.ok(smoke.code === 0 && smoke.out.includes("smoke: 4 passed, 0 failed, 0 skipped"), "e2e-run smoke: 4 passed, 0 failed, 0 skipped");

// 3. Counting wrapper: depth green.
const depth = run("npx", ["vite-node", "scripts/e2e-run.ts", "--label", "depth", "e2e/depth.spec.ts"], { env: { BASE_URL: URL } });
c.ok(depth.code === 0 && depth.out.includes("depth: 1 passed, 0 failed, 0 skipped"), "e2e-run depth: 1 passed, 0 failed, 0 skipped");

// 4. The gate really ran against the deployed URL, not localhost.
c.ok(smoke.out.includes(`smoke: base ${URL}`), `smoke ran against ${URL}`);

// 5. The record names the answering rung + ring (written by deploy-gate.ts).
const { loadDeployConfig } = await import("../lib/deploy-plan.js");
const { cfg } = loadDeployConfig({ env: {} });
const dir = process.env[cfg.record.dirEnv] ?? cfg.record.defaultDir;
const sep = dir.endsWith("/") || dir.endsWith("\\") ? "" : "/";
const rec = JSON.parse(readFileSync(`${dir}${sep}deploy-record.json`, "utf8")) as {
  smoke: null | { smoke: string; depth: string; rung: string; ring: string };
};
c.ok(
  rec.smoke !== null && rec.smoke.smoke === "smoke: 4 passed, 0 failed, 0 skipped" &&
    rec.smoke.depth === "depth: 1 passed, 0 failed, 0 skipped" &&
    rec.smoke.rung !== "" && rec.smoke.ring !== "" && RUNGS.includes(rec.smoke.rung),
  `record.smoke names rung ${rec.smoke?.rung} + ring ${rec.smoke?.ring}`,
);

// 6. Unreachable address: exit 1, gate red + rollback hint, real record untouched.
const tmpRec = mkdtempSync(join(tmpdir(), "dp05-"));
const dead = run("npx", ["vite-node", "scripts/deploy-gate.ts", "--url", "http://127.0.0.1:1"], { env: { PROJECT_SYNC_DIR: tmpRec } });
c.ok(
  dead.code === 1 && dead.out.includes("gate: red") && dead.out.includes("gate: red — roll back with:"),
  "dead URL: exit 1, gate red + rollback hint",
);

// 7. Real URL: gate green, exit 0.
const gate = run("npx", ["vite-node", "scripts/deploy-gate.ts", "--url", URL]);
c.ok(gate.code === 0 && gate.out.includes("gate: green"), "gate on deployed URL: green, exit 0");

// 8. One smoke test: strategy + gate name e2e/smoke.spec.ts; no other SMOKE- titles.
const strategy = readFileSync("design_documents/e2e-testing/strategy.md", "utf8");
const gateSrc = readFileSync("scripts/deploy-gate.ts", "utf8");
const specHits = gateSrc.match(/e2e\/smoke\.spec\.ts/g) ?? [];
const stray = run("npx", ["playwright", "test", "--list"], {});
const strayTitles = stray.out.split("\n").filter((l) => l.includes("SMOKE-") && !l.includes("SMOKE-1") && !l.includes("SMOKE-2") && !l.includes("SMOKE-3") && !l.includes("SMOKE-4"));
c.ok(
  strategy.includes("e2e/smoke.spec.ts") && specHits.length >= 2 && strayTitles.length === 0,
  "strategy + gate name the one smoke spec; no stray SMOKE- titles",
);

c.done();
