// scripts/verify/e2e-02-harness.ts — DP-E2E-BROWSER-TESTING WU-E2E-02 (12 checks).
// Requirement IDs: FR-24
// Proves a real Chromium drives the real server and the real built UI against
// a simulated Ring, a stray console error fails a test, a red test is counted
// and never hidden, and the harness leaves no trace in the repository.
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run, wrapper } from "./e2e-kit.js";

const c = createChecker("e2e-02-harness");

// 1. The Playwright pin of DP-UI is in force.
const version = run("npx", ["playwright", "--version"]);
c.ok(version.code === 0 && version.out.includes("1.62.1"), "playwright --version prints 1.62.1");

// 2. The harness spec lists one H-1 test (the src/… imports resolve).
const listed = run("npx", ["playwright", "test", "e2e/harness.spec.ts", "--list"]);
const listedTitles = listed.out
  .split("\n")
  .filter((l) => l.includes("›"))
  .map((l) => (l.split("›").pop() as string).trim());
c.ok(
  listed.code === 0 &&
    listedTitles.length === 1 &&
    (listedTitles[0] as string).startsWith("H-1"),
  "harness --list shows exactly one test starting H-1",
);

// 3. The config is the literal §3.1 (no retries, no webServer).
const configText = readFileSync("playwright.config.ts", "utf8");
c.ok(
  configText.includes("retries: 0") &&
    configText.includes('testDir: "e2e"') &&
    configText.includes("e2e/artifacts/report.json") &&
    configText.includes("GL_ARGS") &&
    !/webServer/.test(configText),
  "playwright.config.ts holds retries 0, testDir e2e, the json report, GL_ARGS, no webServer",
);

// 4. helpers.ts exports every name of §3.2 with the declared kind.
const helpers = (await import("../../e2e/helpers.js")) as Record<string, unknown>;
const expectedFns = [
  "randomSecret",
  "openHome",
  "readModel",
  "loadSampleWeek",
  "reviewTheWeek",
  "openFirstCandidate",
  "checkNow",
  "saveTrace",
  "waitScene",
];
const expectedObjs = ["GL_ARGS", "SIZE_DESKTOP", "SIZE_WIDE", "SIZE_PHONE"];
c.ok(
  expectedFns.every((n) => typeof helpers[n] === "function") &&
    expectedObjs.every((n) => typeof helpers[n] === "object"),
  "helpers.ts exports every §3.2 name with its declared kind",
);

// 5. randomSecret() shape: 48 lowercase hex by default, unique, 16 for 8 bytes.
const randomSecret = helpers["randomSecret"] as (bytes?: number) => string;
const first = randomSecret();
const second = randomSecret();
c.ok(
  /^[0-9a-f]{48}$/.test(first) && first !== second && /^[0-9a-f]{16}$/.test(randomSecret(8)),
  "randomSecret() is 48 lowercase hex, unique, 16 for 8 bytes",
);

// 6. No secret-looking literal in the harness sources (scan).
const hexRun = /[0-9a-f]{20,}/;
const scanned = ["e2e/helpers.ts", "e2e/fixtures.ts"].map((f) => readFileSync(f, "utf8"));
c.ok(
  scanned.every((t) => !hexRun.test(t) && !t.includes("Bearer ")),
  "helpers.ts and fixtures.ts hold no 20-hex string and no Bearer literal",
);

// 7. The wrapper lists the harness selection.
const listed2 = wrapper("harness", ["e2e/harness.spec.ts"], { list: true });
c.ok(listed2.line === "harness: 1 tests in 1 files", "e2e-run --list prints harness: 1 tests in 1 files");

// Snapshot the (absent) proof log before the first server run for check 11.
function proofSnap(): { exists: boolean; size: number; mtimeMs: number } {
  try {
    const s = statSync("logs/proof.log");
    return { exists: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch {
    return { exists: false, size: -1, mtimeMs: -1 };
  }
}
const proofBefore = proofSnap();

// 8. The harness passes against the local server.
const green = wrapper("harness", ["e2e/harness.spec.ts"]);
c.ok(
  green.code === 0 && green.line === "harness: 1 passed, 0 failed, 0 skipped",
  "harness run prints harness: 1 passed, 0 failed, 0 skipped",
);

// 9. An unreachable BASE_URL fails SMOKE-style with a FAIL line first.
const bad = wrapper("harness", ["e2e/harness.spec.ts"], { env: { BASE_URL: "http://127.0.0.1:1" } });
const failAt = bad.out.indexOf("FAIL H-1");
c.ok(
  bad.code === 1 &&
    bad.line === "harness: 0 passed, 1 failed, 0 skipped" &&
    failAt >= 0 &&
    failAt < bad.out.indexOf(bad.line),
  "unreachable BASE_URL prints FAIL H-1 then harness: 0 passed, 1 failed, 0 skipped",
);

// 10. Guard probes: an unallowed console error fails, an allowed one passes.
mkdirSync("e2e/scenarios", { recursive: true });
const probeFail = "e2e/scenarios/zz-guard-probe.spec.ts";
const probeAllow = "e2e/scenarios/zz-guard-allow.spec.ts";
let probeOk = false;
let allowOk = false;
try {
  writeFileSync(
    probeFail,
    `import { test, expect } from "../fixtures";\nimport { openHome } from "../helpers";\ntest("ZZ probe-xyz console error fails the guard", async ({ page, app }) => {\n  expect(app.local).toBe(true);\n  await openHome(page);\n  await page.evaluate(() => console.error("probe-xyz"));\n  expect(1).toBe(1);\n});\n`,
  );
  const probe = wrapper("guardprobe", [probeFail]);
  probeOk = probe.code === 1 && /FAIL.*probe-xyz/.test(probe.out);
  writeFileSync(
    probeAllow,
    `import { test, expect } from "../fixtures";\nimport { openHome } from "../helpers";\ntest("ZZ probe-xyz allowed error passes", async ({ page, app, guard }) => {\n  expect(app.local).toBe(true);\n  guard.allow("probe-xyz");\n  await openHome(page);\n  await page.evaluate(() => console.error("probe-xyz"));\n  expect(1).toBe(1);\n});\n`,
  );
  const allowed = wrapper("guardallow", [probeAllow]);
  allowOk = allowed.code === 0 && allowed.line === "guardallow: 1 passed, 0 failed, 0 skipped";
} finally {
  try {
    unlinkSync(probeFail);
  } catch {
    /* already gone */
  }
  try {
    unlinkSync(probeAllow);
  } catch {
    /* already gone */
  }
}
c.ok(probeOk && allowOk, "unallowed probe-xyz fails, allowed probe-xyz passes");

// 11. The harness writes its proof lines to a temporary file, never logs/proof.log.
const proofAfter = proofSnap();
c.ok(
  proofAfter.exists === proofBefore.exists &&
    proofAfter.size === proofBefore.size &&
    proofAfter.mtimeMs === proofBefore.mtimeMs,
  "logs/proof.log size and mtime are unchanged by the harness run",
);

// 12. package.json wires the E2E scripts.
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
c.ok(
  typeof pkg.scripts["e2e"] === "string" &&
    typeof pkg.scripts["e2e:list"] === "string" &&
    pkg.scripts["e2e:smoke"] === "playwright test e2e/smoke.spec.ts" &&
    typeof pkg.scripts["verify:e2e"] === "string",
  "package.json has e2e, e2e:list, e2e:smoke and verify:e2e",
);

c.done();
