// scripts/verify/sc-02-scenario.ts — DP-SHOWCASE WU-SHOWCASE-02 (12 checks).
// Requirement IDs: FR-25 (part)
import { readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { readDemoScenario } from "../../hee/src/showcase/scenario.js";
import { captionError } from "../../hee/src/showcase/stills.js";

const c = createChecker("sc-02-scenario");

// 1. Reads + validates against the contract.
let scenario: ReturnType<typeof readDemoScenario>;
try {
  scenario = readDemoScenario("design_documents/demo-scenario.json");
  c.ok(true, "readDemoScenario validates");
} catch (e) {
  c.ok(false, `readDemoScenario validates (${(e as Error).message})`);
  scenario = { version: "1.0.0", base_url: "", viewport: { width: 0, height: 0 }, steps: [], stills: [], hero: { from_step: "", to_step: "" } };
}

// 2. Exact step ids, settle >= 300.
c.ok(
  JSON.stringify(scenario.steps.map((s) => s.id)) === JSON.stringify(["open", "week", "review", "approve", "circle", "walk", "focus", "dusk"]) &&
    scenario.steps.every((s) => (s.settle_ms ?? 0) >= 300),
  "eight step ids in order, settle_ms >= 300",
);

// 3. Approve count N from the saved trace, N >= 1.
const trace = JSON.parse(readFileSync("e2e/artifacts/run-trace.json", "utf8")) as {
  entries?: { kind?: string; decision?: string }[];
};
const n = (trace.entries ?? []).filter((e) => e.kind === "approval" && e.decision === "approved").length;
const approve = scenario.steps.find((s) => s.id === "approve");
const approveClicks = (approve?.actions ?? []).filter((a) => "click" in a && (a as { click: string }).click === "Approve" && (a as { role?: string }).role === "button").length;
c.ok(n >= 1 && approveClicks === n, `approve has exactly N=${n} Approve clicks`);

// 4. Six stills, valid after_step, clean captions.
const stills = (scenario as { stills?: { id: string; after_step: string; claim: string }[] }).stills ?? [];
const stepIds = new Set(scenario.steps.map((s) => s.id));
c.ok(
  JSON.stringify(stills.map((s) => s.id)) === JSON.stringify(["week", "agent", "approval", "circle", "stage", "dusk"]) &&
    stills.every((s) => stepIds.has(s.after_step)) &&
    stills.every((s) => captionError(s.claim) === null),
  "six stills with valid steps and clean captions",
);

// 5. Hero review -> approve.
const hero = (scenario as { hero?: { from_step: string; to_step: string } }).hero;
c.ok(hero?.from_step === "review" && hero?.to_step === "approve", "hero review->approve");

// 6. Only allowed action keys; play3d overview|walk.
// "role" rides with "click" ({ click, role }) in the plan literal, so it is
// allowed only on click actions; every other key must be a top-level action key.
const KEY_OK = new Set(["route", "click", "type", "press", "wait_ms", "play3d", "expect_text"]);
let keysOk = true;
let playOk = true;
for (const s of scenario.steps) {
  for (const a of s.actions as Record<string, unknown>[]) {
    for (const k of Object.keys(a)) {
      if (k === "role") {
        if (!("click" in a)) keysOk = false;
      } else if (!KEY_OK.has(k)) keysOk = false;
    }
    if ("play3d" in a && a["play3d"] !== "overview" && a["play3d"] !== "walk") playOk = false;
  }
}
c.ok(keysOk && playOk, "action keys allowed; play3d overview|walk");

// 7. No data-demo-focus in scenario or spec.
const specText = readFileSync("e2e/showcase/demo-scenario.spec.ts", "utf8");
const scenText = readFileSync("design_documents/demo-scenario.json", "utf8");
c.ok(!specText.includes("data-demo-focus") && !scenText.includes("data-demo-focus"), "no data-demo-focus");

// 8. Showcase config testMatch; base config untouched.
const cfgText = readFileSync("playwright.showcase.config.ts", "utf8");
const diff = run("git", ["diff", "--quiet", "--", "playwright.config.ts"]);
c.ok(cfgText.includes('testMatch: ["showcase/**/*.spec.ts"]') && diff.code === 0, "showcase testMatch set; base config untouched");

// 9. The scenario test passes.
const t = run("npx", ["playwright", "test", "-c", "playwright.showcase.config.ts"]);
c.ok(t.code === 0 && t.out.includes("1 passed"), "showcase config: 1 passed");

// 10. Full suite still 60 tests in 17 files.
const list = run("npx", ["vite-node", "scripts/e2e-run.ts", "--label", "full", "--list"]);
c.ok(list.out.includes("full: 60 tests in 17 files"), "full suite still 60 tests in 17 files");

// 11. Spec uses the tool's reader/runner; no re-implemented clicks/waits.
c.ok(
  specText.includes("readDemoScenario") && specText.includes("runStep") &&
    !specText.includes("waitForTimeout") && !specText.includes('getByRole("button", { name: "Approve"'),
  "spec reads + runs via the tool",
);

// 12. Banned-words scan clean.
const banned = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "design_documents/demo-scenario.json"]);
c.ok(banned.code === 0, "banned-words scan exits 0");

c.done();
