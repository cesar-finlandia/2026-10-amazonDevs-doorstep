// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §3.8 publish the report numbers into the README between markers.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ArmMetrics, EvalReport } from "./types.js";

export const EVAL_START = "<!-- hee-eval:start -->";
export const EVAL_END = "<!-- hee-eval:end -->";

function pct1(v: number): string {
  return (v * 100).toFixed(1);
}

function rate1(v: number): string {
  return v.toFixed(1);
}

function row(label: string, m: ArmMetrics): string {
  return `| ${label} | ${m.runs} | ${m.passed} | ${rate1(m.pass_rate)}% | ${pct1(m.first_pass_valid_rate)}% | ${m.failed_calls} | ${m.retries} | ${m.tokens_per_run} | ${m.wall_s_per_run} |`;
}

export function renderReadmeBlock(report: EvalReport, hasRubric = false): string {
  const t = report.treatment as ArmMetrics;
  const c = report.control as ArmMetrics;
  const rubricClause = hasRubric ? " and, for some tasks, a rubric read in a fresh context" : "";
  const lines = [
    EVAL_START,
    "### Measured agent success",
    "",
    report.headline,
    ...(report.replayed ? ["", "(Numbers replayed from recorded runs.)"] : []),
    "",
    "| Condition | Runs | Passed | Success | Valid first-try calls | Failed calls | Retries | Tokens per run | Seconds per run |",
    "|---|---|---|---|---|---|---|---|---|",
    row("With the product's action surface", t),
    row("Generic screen actions only", c),
    "",
    "![Task success per iteration](evals/trajectory.svg)",
    "",
    report.ceiling,
    "",
    `Method: ${report.tasks} tasks written in the user's own words and frozen before tuning (hash \`${report.scenarios_hash.slice(0, 8)}\`); each run ${report.repetitions} times per condition with the same model; outcomes are graded from the final application state${rubricClause}. ${report.iterations.length} iterations, each changing one aspect of the action surface; an iteration was kept only if success improved without more safety failures. Reproduce: \`npx vite-node hee/src/agent-eval/cli.ts run --entry . --arms both\`.`,
    EVAL_END,
  ];
  return lines.join("\n") + "\n";
}

export function publishToReadme(readmePath: string, block: string): number {
  if (!existsSync(readmePath)) throw new Error(`eval: readme not found: ${readmePath}`);
  const current = readFileSync(readmePath, "utf8");
  const start = current.indexOf(EVAL_START);
  const end = current.indexOf(EVAL_END);
  let next: string;
  if (start !== -1 && end !== -1 && end > start) {
    const after = current.slice(end + EVAL_END.length);
    next = current.slice(0, start) + block + (after.trim() === "" ? "" : after.startsWith("\n") ? after : `\n${after}`);
  } else {
    const sep = current.endsWith("\n") ? "\n" : "\n\n";
    next = `${current}${sep}${block}`;
  }
  writeFileSync(readmePath, next, "utf8");
  return block.length;
}
