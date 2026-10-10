// scripts/gen-showcase-facts.ts — DP-SHOWCASE WU-01 (§5.2).
// Writes design_documents/showcase-facts.json with four numeric fields, each
// computed from an artefact and never typed. Sorted keys, trailing newline,
// no timestamp: two runs are byte-identical.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function fail(name: string): never {
  console.error(`facts: cannot compute ${name}`);
  process.exit(1);
}

// actions: entries of actions.manifest.json whose name is not get_capabilities.
const manifest = JSON.parse(readFileSync("actions.manifest.json", "utf8")) as {
  actions?: { name?: string }[];
};
const list = manifest.actions ?? [];
if (list.length === 0) fail("actions");
const actions = list.filter((a) => a.name !== "get_capabilities").length;
if (actions === 0) fail("actions");

// e2eTests: the `Total: <n> tests` line of `npx playwright test --list`.
const listed = spawnSync("npx", ["playwright", "test", "--list"], { encoding: "utf8", shell: true, timeout: 300000 });
const m = /Total:\s*(\d+)\s*tests?/.exec(`${listed.stdout ?? ""}${listed.stderr ?? ""}`);
if (m === null) fail("e2eTests");
const e2eTests = Number(m[1]);

// ringScenarios: distinct S-RING-<n> ids in the E2E strategy.
const strategy = readFileSync("design_documents/e2e-testing/strategy.md", "utf8");
const ids = new Set<string>();
for (const hit of strategy.matchAll(/S-RING-(\d+)/g)) ids.add(hit[0] as string);
if (ids.size === 0) fail("ringScenarios");
const ringScenarios = ids.size;

// evalTasks: tasks.length of evals/scenarios.json.
const scenarios = JSON.parse(readFileSync("evals/scenarios.json", "utf8")) as { tasks?: unknown[] };
if (!Array.isArray(scenarios.tasks) || scenarios.tasks.length === 0) fail("evalTasks");
const evalTasks = scenarios.tasks.length;

const facts = { actions, e2eTests, evalTasks, ringScenarios };
const ordered = Object.fromEntries(Object.entries(facts).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync("design_documents/showcase-facts.json", JSON.stringify(ordered, null, 2) + "\n", "utf8");
console.log(`facts: actions=${actions} e2eTests=${e2eTests} ringScenarios=${ringScenarios} evalTasks=${evalTasks}`);
