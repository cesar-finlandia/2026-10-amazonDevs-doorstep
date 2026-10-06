// scripts/e2e-run.ts — the counting wrapper (DP-E2E-BROWSER-TESTING §3.5).
// Requirement IDs: FR-24
//
// npx vite-node scripts/e2e-run.ts --label <name> [<spec file>…] [--twice] [--list]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const REPORT = "e2e/artifacts/report.json";

function fail(msg: string): never {
  console.error(msg);
  process.exit(2);
}

const argv = process.argv.slice(2);
let label = "";
const files: string[] = [];
let twice = false;
let list = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i] as string;
  if (a === "--label") {
    label = argv[i + 1] ?? "";
    i += 1;
  } else if (a === "--twice") {
    twice = true;
  } else if (a === "--list") {
    list = true;
  } else if (a.startsWith("--")) {
    fail(`unknown flag ${a}\nusage: npx vite-node scripts/e2e-run.ts --label <name> [<spec file>…] [--twice] [--list]`);
  } else {
    files.push(a);
  }
}
if (label === "") {
  fail("usage: npx vite-node scripts/e2e-run.ts --label <name> [<spec file>…] [--twice] [--list]");
}

interface JsonTest {
  annotations: { type: string; description?: string }[];
  results: { status: string }[];
}
interface JsonSpec {
  title: string;
  file: string;
  tests: JsonTest[];
}
interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

function collectSpecs(node: JsonSuite, acc: JsonSpec[]): void {
  for (const s of node.specs ?? []) acc.push(s);
  for (const sub of node.suites ?? []) collectSpecs(sub, acc);
}

function readJsonReport(): { suites?: JsonSuite[] } {
  return JSON.parse(readFileSync(REPORT, "utf8")) as { suites?: JsonSuite[] };
}

function summarize(specs: JsonSpec[]): { passed: number; failed: number; skipped: number; fails: string[]; skips: string[] } {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const fails: string[] = [];
  const skips: string[] = [];
  for (const spec of specs) {
    for (const t of spec.tests) {
      const statuses = t.results.map((r) => r.status);
      if (statuses.some((s) => s === "failed" || s === "timedOut" || s === "interrupted")) {
        failed += 1;
        if (!fails.includes(spec.title)) fails.push(spec.title);
      } else if (statuses.some((s) => s === "skipped" || s === "didNotRun")) {
        skipped += 1;
        const ann = t.annotations.find((a) => a.type === "skip");
        skips.push(`SKIP ${spec.title}: ${ann?.description ?? ""}`);
      } else if (statuses.some((s) => s === "passed")) {
        passed += 1;
      } else {
        failed += 1;
        if (!fails.includes(spec.title)) fails.push(spec.title);
      }
    }
  }
  return { passed, failed, skipped, fails, skips };
}

function runPlaywright(extraArgs: string[]): { code: number; out: string } {
  mkdirSync("e2e/artifacts", { recursive: true });
  const r = spawnSync("npx", ["playwright", "test", ...extraArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    // A full 61-test run with a dozen golden reviews needs ~25-35 min on two
    // workers; capping at 15 min kills it mid-run and the summary then reads a
    // partial report (FIX-5).
    timeout: 3600000,
    env: { ...process.env },
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  return { code: r.status ?? 1, out };
}

/** One selection run; prints SKIP lines, FAIL lines, then the summary line. */
function runOnce(): { code: number; passed: number; failed: number; skipped: number; line: string } {
  const child = runPlaywright(files);
  void child.out;
  const report = readJsonReport();
  const specs: JsonSpec[] = [];
  for (const s of report.suites ?? []) collectSpecs(s, specs);
  const sum = summarize(specs);
  for (const s of sum.skips) console.log(s);
  for (const f of sum.fails) console.log(`FAIL ${f}`);
  const line = `${label}: ${sum.passed} passed, ${sum.failed} failed, ${sum.skipped} skipped`;
  console.log(line);
  return {
    code: sum.failed === 0 ? 0 : 1,
    passed: sum.passed,
    failed: sum.failed,
    skipped: sum.skipped,
    line,
  };
}

if (list) {
  const child = runPlaywright(["--list", "--reporter=json", ...files]);
  const specs: JsonSpec[] = [];
  let parsed = false;
  // Module-load notices of the app may share stdout with the reporter; parse the JSON object span.
  const span = child.out.slice(child.out.indexOf("{"), child.out.lastIndexOf("}") + 1);
  try {
    const report = JSON.parse(span) as { suites?: JsonSuite[] };
    for (const s of report.suites ?? []) collectSpecs(s, specs);
    parsed = true;
  } catch {
    parsed = false;
  }
  if (!parsed) fail("could not read the test list from the JSON reporter");
  const distinctFiles = new Set(specs.map((s) => s.file));
  console.log(`${label}: ${specs.length} tests in ${distinctFiles.size} files`);
  process.exit(child.code);
}

if (twice) {
  const first = runOnce();
  const second = runOnce();
  if (
    first.failed === 0 &&
    second.failed === 0 &&
    first.passed === second.passed &&
    first.skipped === second.skipped
  ) {
    console.log(`${label}: green twice`);
    process.exit(0);
  }
  process.exit(1);
}

const once = runOnce();
process.exit(once.code);
