// scripts/verify/e2e-03-scenarios.ts — DP-E2E-BROWSER-TESTING WU-E2E-03 (10 checks).
// Requirement IDs: FR-05…FR-09, FR-11, FR-14…FR-17, FR-19, FR-21, FR-23, NFR-04…NFR-06, HEE-E2E-04
// Verifies the eleven scenario files of WU-E2E-03 (uc01…uc14 subset + controls):
// stable ids and titles, fixture-only imports, no sleeps/skips, assertions that
// read the model or the server, the bidirectional control sweep, no secrets.
import { readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run, wrapper, readTable } from "./e2e-kit.js";

const c = createChecker("e2e-03-scenarios");

const STRATEGY = "design_documents/e2e-testing/strategy.md";
const FILES = [
  "e2e/scenarios/uc01-open-the-week.spec.ts",
  "e2e/scenarios/uc02-review-the-week.spec.ts",
  "e2e/scenarios/uc03-the-moment.spec.ts",
  "e2e/scenarios/uc04-decide-a-moment.spec.ts",
  "e2e/scenarios/uc05-approve-a-message.spec.ts",
  "e2e/scenarios/uc06-the-rail.spec.ts",
  "e2e/scenarios/uc07-by-hand.spec.ts",
  "e2e/scenarios/uc11-when-things-fail.spec.ts",
  "e2e/scenarios/uc13-help-and-looks.spec.ts",
  "e2e/scenarios/uc14-activity-and-trace.spec.ts",
  "e2e/scenarios/controls.spec.ts",
];
const SCOPE = ["uc01", "uc02", "uc03", "uc04", "uc05", "uc06", "uc07", "uc11", "uc13", "uc14", "controls"];

const traceRows = readTable(STRATEGY, "2 Traceability");
const scopeRows = traceRows.filter((r) => SCOPE.includes(r[1] as string));
const fileOf = (cell: string): string =>
  cell === "controls" ? "e2e/scenarios/controls.spec.ts" : `e2e/scenarios/${cell}-*.spec.ts`;
const pathOf = (cell: string): string =>
  cell === "controls"
    ? "e2e/scenarios/controls.spec.ts"
    : (FILES.find((f) => f.includes(`/${cell}-`)) as string);
void fileOf;

// Listed titles from `playwright test --list --reporter=json` on the 11 files.
interface JsonSpec { title: string; file: string; tests: { results: { status: string }[] }[] }
interface JsonSuite { specs?: JsonSpec[]; suites?: JsonSuite[] }
function collect(node: JsonSuite, acc: JsonSpec[]): void {
  for (const s of node.specs ?? []) acc.push(s);
  for (const sub of node.suites ?? []) collect(sub, acc);
}
const listRun = run("npx", ["playwright", "test", "--list", "--reporter=json", ...FILES], { timeout: 300000 });
const span = listRun.out.slice(listRun.out.indexOf("{"), listRun.out.lastIndexOf("}") + 1);
const listed: JsonSpec[] = [];
try {
  const report = JSON.parse(span) as { suites?: JsonSuite[] };
  for (const s of report.suites ?? []) collect(s, listed);
} catch {
  /* parsed below by the check */
}
const listedTitles = listed.map((s) => s.title).sort();

// 1. --list on the 11 files shows exactly 39 tests.
const listLine = wrapper("e2e-03", FILES, { list: true });
const listMatch = /e2e-03: (\d+) tests in (\d+) files/.exec(listLine.line);
c.ok(listMatch !== null && Number(listMatch[1]) === 39, "--list of the 11 files shows exactly 39 tests");

// 2. Every listed title equals <id> <title> of the matching §5.3 row.
// Titles come from the raw strategy.md lines: readTable strips backticks but
// the literal UC13-1 title carries them ("a working `?`").
const strategyLines = readFileSync(STRATEGY, "utf8").split("\n");
const rawTitleOf = (id: string): string => {
  const line = strategyLines.find((l) => l.trim().startsWith(`| ${id} |`));
  if (line === undefined) throw new Error(`no strategy row for ${id}`);
  const cells = line.trim().split("|").slice(1, -1).map((x) => x.trim());
  return `${cells[0] as string} ${cells[2] as string}`;
};
const expectedTitles = scopeRows.map((r) => rawTitleOf(r[0] as string)).sort();
c.ok(
  listedTitles.length === expectedTitles.length &&
    listedTitles.every((t, i) => t === expectedTitles[i]),
  "every listed title equals <id> <title> of its §5.3 row",
);

// 3. Every file imports test from ../fixtures; @playwright/test only for types.
c.ok(
  FILES.every((f) => {
    const text = readFileSync(f, "utf8");
    const hasFixture = text.includes('from "../fixtures"') || text.includes("from '../fixtures'");
    const badRuntime = text.split("\n").some((line) => line.includes("@playwright/test") && !/^\s*import\s+type\b/.test(line));
    return hasFixture && !badRuntime;
  }),
  "every file imports test from ../fixtures, @playwright/test only for types",
);

// 4. No long sleep, no focused/skipped/failed markers.
c.ok(
  FILES.every((f) => {
    const text = readFileSync(f, "utf8");
    const sleeps = [...text.matchAll(/waitForTimeout\(\s*(\d+)\s*\)/g)].map((m) => Number(m[1]));
    return (
      sleeps.every((n) => n <= 250) &&
      !text.includes(".only(") &&
      !text.includes("test.skip(") &&
      !text.includes("test.fixme(") &&
      !text.includes("test.fail(")
    );
  }),
  "no waitForTimeout above 250 and no .only/skip/fixme/fail",
);

// 5. Every test body contains at least one expect(.
c.ok(
  FILES.every((f) => readFileSync(f, "utf8").split('test("').slice(1).every((body) => body.includes("expect("))),
  "every test body contains at least one expect(",
);

// 6. Every (Truth) row's test reads the model or the server.
c.ok(
  scopeRows
    .filter((r) => (r[5] as string).includes("(Truth)"))
    .every((r) => {
      const id = r[0] as string;
      const body = readFileSync(pathOf(r[1] as string), "utf8")
        .split('test("')
        .slice(1)
        .find((chunk) => chunk.startsWith(`${id} `));
      return (
        body !== undefined &&
        ["readModel(", "checkNow(", "weekRibbon(", "/api/status", "request.get("].some((s) => body.includes(s))
      );
    }),
  "every (Truth) test uses readModel/checkNow/weekRibbon//api/status/request.get",
);

// 7. The guard is auto and no scenario subscribes to console itself.
c.ok(
  readFileSync("e2e/fixtures.ts", "utf8").includes("{ auto: true }") &&
    FILES.every((f) => !readFileSync(f, "utf8").includes('page.on("console"')),
  "guard is auto and no scenario file has a bare page.on(console",
);

// 8. controls.spec.ts reads the inventory and enumerates in reverse.
const controlsText = readFileSync("e2e/scenarios/controls.spec.ts", "utf8");
c.ok(
  controlsText.includes("e2e/controls.json") &&
    controlsText.includes('button, a[href], [role="switch"], [role="radio"], input, select, summary'),
  "controls.spec.ts reads controls.json and reverse-enumerates",
);

// 9. No secrets and no absolute paths in scenario files.
// URL route prefixes (/api/, /events, /health, /webhooks) and single-segment
// route strings ("/watch") are server routes, not filesystem paths.
const ROUTE_PREFIX = /^\/(api|events|health|webhooks)(\/|$)/;
c.ok(
  FILES.every((f) => {
    const text = readFileSync(f, "utf8");
    if (/[0-9a-f]{20,}/.test(text) || text.includes("Bearer ") || text.includes("sk-")) return false;
    if (/[A-Za-z]:[\\/]/.test(text)) return false;
    const quoted = [...text.matchAll(/(["'])((?:\/[A-Za-z0-9_.-]+){2,}(?:\/[^\s"']*)?)\1/g)].map((m) => m[2] as string);
    return quoted.every((p) => ROUTE_PREFIX.test(p));
  }),
  "no 20-hex, Bearer, sk- or absolute path in scenario files",
);

// 10. The uc01 file runs through the wrapper with 5 tests across the numbers.
const uc01 = wrapper("uc01", ["e2e/scenarios/uc01-open-the-week.spec.ts"], { timeout: 600000 });
const uc01Match = /uc01: (\d+) passed, (\d+) failed, (\d+) skipped/.exec(uc01.line);
c.ok(
  uc01Match !== null &&
    Number(uc01Match[1]) + Number(uc01Match[2]) + Number(uc01Match[3]) === 5,
  "e2e-run on uc01 prints three numbers adding up to 5",
);

c.done();
