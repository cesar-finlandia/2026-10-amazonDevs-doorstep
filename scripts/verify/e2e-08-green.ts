// scripts/verify/e2e-08-green.ts — DP-E2E-BROWSER-TESTING WU-E2E-08 (8 checks).
// Requirement IDs: FR-24
// Proves the whole suite passes twice in a row with no test removed and no
// assertion weakened, and that every defect found on the way is written down.
//
// The pair of full runs takes about an hour. `scripts/e2e-run.ts --twice`
// leaves e2e/artifacts/twice-record.json; a record newer than every file the
// suite depends on is the pair this script reports. Otherwise the pair is run
// here.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { probeBedrock } from "../../e2e/bedrock-probe.js";
import { createChecker } from "./ui-kit.js";
import { readTable, run, wrapper } from "./e2e-kit.js";

const c = createChecker("e2e-08-green");

const SCENARIO_DIR = "e2e/scenarios";
const RECORD = "e2e/artifacts/twice-record.json";
const COUNTS = "e2e/artifacts/expect-counts.json";

function newestMtime(paths: string[]): number {
  let newest = 0;
  const walk = (p: string): void => {
    let st;
    try {
      st = statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) {
        if (name === "artifacts" || name === "node_modules") continue;
        walk(join(p, name));
      }
    } else if (st.mtimeMs > newest) {
      newest = st.mtimeMs;
    }
  };
  for (const p of paths) walk(p);
  return newest;
}

const probe = await probeBedrock();
console.log(probe.available ? "bedrock-probe: available" : `bedrock-probe: unavailable (${probe.error})`);
const expected = probe.available ? "full: 60 passed, 0 failed, 0 skipped" : "full: 59 passed, 0 failed, 1 skipped";

// 1. The list is 60 tests in 17 files.
const listed = wrapper("full", [], { list: true });
c.ok(listed.line === "full: 60 tests in 17 files", `full --list prints "${listed.line}"`);

// The pair of full runs: a still-valid record, else a fresh pair.
const watched = [
  "src", "e2e", "public", "data", "evals/scenarios.json", "playwright.config.ts", "scripts/e2e-run.ts",
  "scripts/mock-ring-server.ts", "index.html", "vite.config.ts", "config",
];
let record: { lines: string[]; skips: string[]; finishedAt: number } | null = null;
if (existsSync(RECORD)) {
  const r = JSON.parse(readFileSync(RECORD, "utf8")) as { lines: string[]; skips: string[]; finishedAt: number };
  if (r.finishedAt > newestMtime(watched)) record = r;
}
let twiceLine = "";
if (record === null) {
  const r = wrapper("full", [], { twice: true, timeout: 7_200_000 });
  twiceLine = r.line;
  if (!existsSync(RECORD)) throw new Error("e2e-run --twice left no record");
  record = JSON.parse(readFileSync(RECORD, "utf8")) as { lines: string[]; skips: string[]; finishedAt: number };
  twiceLine = r.out.split("\n").map((l) => l.trim()).find((l) => l === "full: green twice") ?? "";
} else {
  const same = record.lines.length === 2 && record.lines[0] === record.lines[1] && /, 0 failed,/.test(record.lines[0] as string);
  twiceLine = same ? "full: green twice" : "";
}
for (const l of record.lines) console.log(l);
console.log(twiceLine);

// 2, 3, 4. Both runs print the expected line, and the pair is green twice.
c.ok(record.lines[0] === expected, `the first full run prints "${expected}" (got "${record.lines[0]}")`);
c.ok(record.lines[1] === record.lines[0], "the second full run prints the same line as the first");
c.ok(twiceLine === "full: green twice", "the wrapper prints `full: green twice`");

// 5. The only skip is S-BEDROCK-1 with a reason.
{
  const skips = record.skips;
  const ok = probe.available
    ? skips.length === 0
    : skips.length === 1 && /^SKIP S-BEDROCK-1 [^:]*: .+/.test(skips[0] as string);
  c.ok(ok, `the only skipped test is S-BEDROCK-1 with a named reason (${JSON.stringify(skips)})`);
}

// 6. fix-log.md: numbered entries, four lines each, proving tests from the table.
{
  const text = readFileSync("design_documents/e2e-testing/fix-log.md", "utf8");
  const ids = new Set(
    readTable("design_documents/e2e-testing/strategy.md", "2 Traceability").map((r) => r[0] as string),
  );
  const sections = text.split(/^## /m).slice(1).filter((s) => /^FIX-\d/.test(s));
  const nums: number[] = [];
  let shaped = true;
  for (const sec of sections) {
    const head = /^FIX-(\d+)([a-z]?) — .+/.exec(sec);
    if (!head) {
      shaped = false;
      continue;
    }
    const n = Number(head[1]);
    if (head[2] === "") nums.push(n);
    const body = sec.split("\n").slice(1);
    const has = (label: string): string | undefined => body.find((l) => l.startsWith(`- ${label}:`));
    const proving = has("Proving test");
    const provingId = proving === undefined ? "" : proving.replace(/^- Proving test:\s*/, "").split(/[\s,(]/)[0] ?? "";
    if (!has("Symptom") || !has("Root cause") || !has("File changed") || !ids.has(provingId)) shaped = false;
  }
  const gapless = nums.every((n, i) => n === i + 1);
  const noDiag = !/^## DIAG-/m.test(text);
  c.ok(
    sections.length > 0 && shaped && gapless && noDiag,
    `fix-log.md has ${sections.length} well-shaped FIX entries numbered 1..${nums.length} with no open DIAG`,
  );
}

// 7. No test was deleted or skipped away: every table id is listed; no skip markers.
{
  const files = readdirSync(SCENARIO_DIR).filter((f) => f.endsWith(".spec.ts")).map((f) => join(SCENARIO_DIR, f));
  const all = [...files, "e2e/harness.spec.ts", "e2e/smoke.spec.ts", "e2e/depth.spec.ts"];
  const idsInTable = readTable("design_documents/e2e-testing/strategy.md", "2 Traceability").map((r) => r[0] as string);
  const source = all.map((f) => readFileSync(f, "utf8")).join("\n");
  const missing = idsInTable.filter((id) => !source.includes(`test("${id} `));
  const forbidden = all
    .filter((f) => !f.endsWith("s-bedrock.spec.ts"))
    .filter((f) => /test\.skip\(|\.only\(|test\.fixme\(/.test(readFileSync(f, "utf8")));
  c.ok(
    missing.length === 0 && forbidden.length === 0,
    `every table id has a test (missing ${JSON.stringify(missing)}) and no skip marker (${JSON.stringify(forbidden)})`,
  );
}

// 8. Assertions are never removed.
{
  const files = [
    ...readdirSync(SCENARIO_DIR).filter((f) => f.endsWith(".spec.ts")).map((f) => join(SCENARIO_DIR, f)),
    "e2e/harness.spec.ts", "e2e/smoke.spec.ts", "e2e/depth.spec.ts",
  ].sort();
  const now: Record<string, number> = {};
  for (const f of files) now[f] = (readFileSync(f, "utf8").match(/expect\(/g) ?? []).length;
  if (!existsSync(COUNTS)) {
    mkdirSync("e2e/artifacts", { recursive: true });
    writeFileSync(COUNTS, JSON.stringify(now, null, 2) + "\n", "utf8");
  }
  const before = JSON.parse(readFileSync(COUNTS, "utf8")) as Record<string, number>;
  const lower = Object.keys(before).filter((f) => (now[f] ?? 0) < (before[f] as number));
  // Counts only ever ratchet upward.
  const merged: Record<string, number> = { ...before };
  for (const f of files) merged[f] = Math.max(before[f] ?? 0, now[f] as number);
  writeFileSync(COUNTS, JSON.stringify(merged, null, 2) + "\n", "utf8");
  c.ok(lower.length === 0, `no scenario file lost an expect( (${JSON.stringify(lower)})`);
}

void run;
c.done();
