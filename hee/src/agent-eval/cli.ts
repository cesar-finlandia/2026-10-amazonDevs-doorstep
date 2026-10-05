// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §1 CLI: init, freeze, run, digest, report, publish.
// Exit 0 ok; 1 error; 2 usage; 3 budget refused.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initEvalConfig, loadEvalConfig } from "./config.js";
import { BudgetError } from "./ledger.js";
import {
  buildReport,
  failureDigest,
  finishIteration,
  isUsageError,
  listIterations,
  readIteration,
  startIteration,
  writeReportArtifacts,
} from "./iterate.js";
import { publishToReadme, renderReadmeBlock } from "./publish.js";
import { freezeScenarios } from "./scenarios.js";
import type { EvalReport, IterationResults } from "./types.js";

const USAGE = `agent-eval — action-surface evaluation

  agent-eval init     --entry <E>
  agent-eval freeze   --entry <E>
  agent-eval run      --entry <E> --arms treatment|control|both [--aspect <a> --note "<text>"] [--reps <n>] [--adapter <path>]
  agent-eval digest   --entry <E> [--iteration <n>]
  agent-eval report   --entry <E>
  agent-eval publish  --entry <E> [--readme <path>] [--allow-replayed]`;

function usageError(message: string): number {
  console.error(`eval: ${message}`);
  console.error(USAGE);
  return 2;
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function evalsDirOf(entry: string): string {
  return join(entry, "evals");
}

function readReport(evalsDir: string): EvalReport {
  const path = join(evalsDir, "report.json");
  if (!existsSync(path)) throw new Error(`eval: report not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as EvalReport;
}

function hasRubricRuns(evalsDir: string, report: EvalReport): boolean {
  const ids = new Set<number>([report.chosen_iteration]);
  if (report.control_iteration !== null) ids.add(report.control_iteration);
  for (const n of ids) {
    try {
      const results = readIteration(evalsDir, n);
      if (results.runs.some((r) => r.rubric !== null)) return true;
    } catch {
      // ignore unreadable iterations
    }
  }
  return false;
}

export async function runCli(argv: string[]): Promise<number> {
  const command = argv[0] ?? "";
  if (!["init", "freeze", "run", "digest", "report", "publish"].includes(command)) {
    return usageError(`unknown command ${command || "(none)"}`);
  }
  const entry = flag(argv, "--entry");
  if (!entry) return usageError("missing --entry <dir>");
  const evalsDir = evalsDirOf(entry);
  const rest = argv.slice(1);

  try {
    if (command === "init") {
      initEvalConfig(evalsDir);
      console.log(`eval: initialized ${evalsDir}`);
      return 0;
    }
    if (command === "freeze") {
      freezeScenarios(join(evalsDir, "scenarios.json"));
      return 0;
    }
    if (command === "run") {
      const started = await startIteration({
        evalsDir,
        arms: flag(rest, "--arms"),
        aspect: flag(rest, "--aspect"),
        note: flag(rest, "--note"),
        reps: flag(rest, "--reps") === undefined ? undefined : Number(flag(rest, "--reps")),
        adapterPath: flag(rest, "--adapter"),
      });
      await finishIteration(started);
      return 0;
    }
    if (command === "digest") {
      const existing = listIterations(evalsDir);
      if (existing.length === 0) {
        console.error("eval: no iterations yet");
        return 1;
      }
      const n = flag(rest, "--iteration") === undefined ? Math.max(...existing) : Number(flag(rest, "--iteration"));
      const results: IterationResults = readIteration(evalsDir, n);
      const digest = failureDigest(evalsDir, results);
      console.log(digest);
      return 0;
    }
    if (command === "report") {
      const report = buildReport(evalsDir);
      writeReportArtifacts(evalsDir, report);
      console.log(report.headline);
      return 0;
    }
    // publish
    const report = readReport(evalsDir);
    if (!report.treatment || !report.control) {
      console.error("eval: publish needs both conditions measured");
      return 1;
    }
    if (!report.comparable) {
      console.error(`eval: not comparable: ${report.comparable_reasons.join("; ")}`);
      return 1;
    }
    if (report.replayed && !hasFlag(rest, "--allow-replayed")) {
      console.error("eval: results were replayed from recordings; pass --allow-replayed to publish them labelled as such");
      return 1;
    }
    const readme = flag(rest, "--readme") ?? join(entry, "README.md");
    const block = renderReadmeBlock(report, hasRubricRuns(evalsDir, report));
    const chars = publishToReadme(readme, block);
    console.log(`eval: published to ${readme} (${chars} chars between markers)`);
    return 0;
  } catch (e) {
    if (isUsageError(e)) {
      console.error((e as Error).message);
      return 2;
    }
    if (e instanceof BudgetError) {
      console.error(e.message);
      return 3;
    }
    console.error((e as Error).message ?? String(e));
    return 1;
  }
}

const argv1 = (process.argv[1] ?? "").replace(/\\/g, "/");
const invokedDirectly = argv1.endsWith("src/agent-eval/cli.ts");
const invokedViaViteNode =
  argv1.includes("vite-node") && process.env["CHASSIS_DISPATCH"] === undefined && process.env["VITEST"] === undefined;
if (invokedDirectly || invokedViaViteNode) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error((err as Error).message ?? String(err));
      process.exit(1);
    },
  );
}

export { loadEvalConfig };
