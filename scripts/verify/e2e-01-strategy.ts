// scripts/verify/e2e-01-strategy.ts — DP-E2E-BROWSER-TESTING WU-E2E-01 (10 checks).
// Requirement IDs: FR-01, FR-05…FR-21, FR-23, FR-24
// Verifies strategy.md (use cases, 60-row traceability, control inventory),
// e2e/controls.json and known-inert.md agree with each other.
import { existsSync, readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { readTable } from "./e2e-kit.js";

const c = createChecker("e2e-01-strategy");

const STRATEGY = "design_documents/e2e-testing/strategy.md";
const KNOWN_INERT = "design_documents/e2e-testing/known-inert.md";
const CONTROLS = "e2e/controls.json";

const strategyText = readFileSync(STRATEGY, "utf8");

// 1. The three section headings exist.
c.ok(
  strategyText.includes("## 1 Use cases") &&
    strategyText.includes("## 2 Traceability") &&
    strategyText.includes("## 3 Control inventory"),
  "strategy.md has the three headings",
);

// 2. The use-case table has 15 rows UC-01…UC-15 with a sentence and a file.
const ucRows = readTable(STRATEGY, "1 Use cases");
const ucIds = ucRows.map((r) => r[0] as string).sort();
c.ok(
  ucRows.length === 15 &&
    JSON.stringify(ucIds) ===
      JSON.stringify(
        Array.from({ length: 15 }, (_, i) => `UC-${String(i + 1).padStart(2, "0")}`),
      ) &&
    ucRows.every((r) => (r[1] as string).length > 0 && (r[2] as string).length > 0),
  "use-case table has 15 rows UC-01…UC-15 with sentence and file",
);

// 3. The traceability table has exactly 60 rows, unique ids, per-file counts of §5.3.
const traceRows = readTable(STRATEGY, "2 Traceability");
const traceIds = traceRows.map((r) => r[0] as string);
const fileOf = (cell: string): string => cell.replace(/\.spec(\.ts)?$/, "");
const counts: Record<string, number> = {};
for (const r of traceRows) {
  const f = fileOf(r[1] as string);
  counts[f] = (counts[f] ?? 0) + 1;
}
const expectedCounts: Record<string, number> = {
  harness: 1,
  uc01: 5,
  uc02: 4,
  uc03: 3,
  uc04: 4,
  uc05: 3,
  uc06: 5,
  uc07: 3,
  uc11: 3,
  uc13: 3,
  uc14: 4,
  controls: 2,
  "s-ring": 9,
  "s-bedrock": 1,
  smoke: 4,
  depth: 1,
  "3d": 5,
};
c.ok(
  traceRows.length === 60 &&
    new Set(traceIds).size === 60 &&
    JSON.stringify(counts, Object.keys(counts).sort()) ===
      JSON.stringify(expectedCounts, Object.keys(expectedCounts).sort()),
  "traceability table has 60 unique rows with the §5.3 per-file counts",
);

// 4. Every row has a non-empty observable assertion and a Req cell of `—` or requirement ids.
const reqCell = /^((FR|NFR|HEE-E2E)-[0-9]+)(, (FR|NFR|HEE-E2E)-[0-9]+)*$/;
c.ok(
  traceRows.every(
    (r) =>
      (r[5] as string).length > 0 && ((r[4] as string) === "—" || reqCell.test(r[4] as string)),
  ),
  "every traceability row has an assertion and a well-formed requirement cell",
);

// 5. Every use case UC-01…UC-15 is named by at least one traceability row.
const ucCells = traceRows.map((r) => r[3] as string);
c.ok(
  Array.from({ length: 15 }, (_, i) => `UC-${String(i + 1).padStart(2, "0")}`).every((id) =>
    ucCells.includes(id),
  ),
  "every use case UC-01…UC-15 is named by a traceability row",
);

// 6. Every observable requirement of blueprint §1.1 appears in a requirement cell.
const required = [
  "FR-01",
  ...Array.from({ length: 17 }, (_, i) => `FR-${String(i + 5).padStart(2, "0")}`),
  "FR-23",
  "FR-24",
];
const mentioned = new Set(traceRows.flatMap((r) => (r[4] as string).match(/(FR|NFR|HEE-E2E)-[0-9]+/g) ?? []));
c.ok(
  required.every((id) => mentioned.has(id)),
  "every observable requirement FR-01, FR-05…FR-21, FR-23, FR-24 appears",
);

// 7. controls.json parses with the §3.4 schema, and strategy §3 mirrors its ids.
const controls = JSON.parse(readFileSync(CONTROLS, "utf8")) as {
  version: string;
  routes: string[];
  controls: { id: string; route: string; role?: string; name?: string; selector?: string; covered_by: string; optional?: boolean }[];
  inert: { id: string }[];
};
const controlRows = readTable(STRATEGY, "3 Control inventory");
const controlIds = controls.controls.map((r) => r.id);
const inventoryIds = controlRows.map((r) => r[0] as string);
c.ok(
  existsSync(CONTROLS) &&
    controls.version === "1.0.0" &&
    JSON.stringify(controls.routes) === JSON.stringify(["/", "/watch", "/lab"]) &&
    controls.controls.length >= 28 &&
    controls.controls.every(
      (r) =>
        (r.role !== undefined && r.name !== undefined ? true : r.selector !== undefined) &&
        (traceIds.includes(r.covered_by) || r.covered_by === "controls-sweep"),
    ) &&
    JSON.stringify([...controlIds].sort()) === JSON.stringify([...inventoryIds].sort()),
  "controls.json parses with ≥28 rows and strategy §3 mirrors its ids",
);

// 8. known-inert.md has one row per inert[] entry with a reason; delegated rows name 3d-06-lab.
const inertDoc = readTable(KNOWN_INERT);
const inertIds = (controls.inert as { id: string; kind: string }[]).map((r) => r.id);
const inertById = new Map(inertDoc.map((r) => [r[0] as string, r] as const));
c.ok(
  inertIds.every((id) => (inertById.get(id)?.[4] as string | undefined ?? "").length > 0) &&
    inertDoc.length === inertIds.length &&
    (controls.inert as { id: string; kind: string }[])
      .filter((r) => r.kind === "delegated")
      .every((r) => ((inertById.get(r.id)?.[4] as string) ?? "").includes("3d-06-lab")),
  "known-inert.md mirrors inert[] with reasons and delegated rows name 3d-06-lab",
);

// 9. The control names of WU-01 step 2 are all present in controls.json.
const step2Names = [
  "Review the sample week",
  "Load the sample week",
  "Approve",
  "Reject",
  "Mark as explained",
  "Dismiss",
  "Merge duplicates",
  "Overview",
  "Focus",
  "Walk",
  "Paper",
  "Dusk",
  "Action",
  "Run",
  "Start",
  "End",
  "Connect Ring",
  "Try it",
  "Show details",
  "Use the sample week",
  "Show more",
  "Run an action by hand",
  "button[data-help-for]",
  "[data-app-explainer]",
  "summary",
];
c.ok(
  step2Names.every((n) => controls.controls.some((r) => r.name === n || r.selector === n)) &&
    controls.controls.some((r) => r.role === "switch"),
  "every step-2 control name or selector is present in controls.json",
);

// 10. The row count is printed and is at least the use-case count.
console.log(`strategy: ${traceRows.length} rows for ${ucRows.length} use cases`);
c.ok(traceRows.length >= ucRows.length, "60 rows for 15 use cases");

c.done();
