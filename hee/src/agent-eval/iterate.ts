// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §3.6 iterations: start/finish, keep rules, failure digest, report.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compileSchema, createClient, loadSchema } from "../llm/index.js";
import { loadEvalConfig } from "./config.js";
import { reserve } from "./ledger.js";
import { readLedger } from "./ledger.js";
import { iterationDir, runIteration } from "./runner.js";
import { loadScenarios, safetyHash as computeSafetyHash, scenariosHash as computeScenariosHash } from "./scenarios.js";
import { renderTrajectorySvg } from "./svg.js";
import type {
  EvalAdapter,
  EvalArm,
  EvalAspect,
  EvalConfig,
  EvalReport,
  IterationResults,
  RunResult,
  Scenarios,
} from "./types.js";

const ASPECTS: EvalAspect[] = ["baseline", "descriptions", "schemas", "result_shapes", "action_count"];

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function listIterations(evalsDir: string): number[] {
  const base = join(evalsDir, "iterations");
  if (!existsSync(base)) return [];
  const out: number[] = [];
  for (const entry of readdirSync(base)) {
    const m = /^iteration-(\d{3})$/.exec(entry);
    if (m && existsSync(join(base, entry, "results.json"))) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}

export function readIteration(evalsDir: string, n: number): IterationResults {
  const path = join(iterationDir(evalsDir, n), "results.json");
  return JSON.parse(readFileSync(path, "utf8")) as IterationResults;
}

export function writeIteration(evalsDir: string, results: IterationResults): void {
  const schema = loadSchema("contracts/hee-eval-results.schema.json");
  const check = compileSchema(schema);
  const valid = check(results);
  if (!valid.ok) throw new Error(`eval: results invalid: ${valid.errors.join("; ")}`);
  mkdirSync(iterationDir(evalsDir, results.iteration), { recursive: true });
  writeFileSync(join(iterationDir(evalsDir, results.iteration), "results.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
}

export async function loadAdapter(evalsDir: string, adapterPath?: string): Promise<EvalAdapter> {
  const path = adapterPath ?? join(evalsDir, "adapter.ts");
  if (!existsSync(path)) throw new Error(`eval: adapter not found: ${path}`);
  const mod = (await import(pathToFileURL(path).href)) as { default?: EvalAdapter };
  const adapter = mod.default;
  if (!adapter || typeof adapter.createWorld !== "function" || typeof adapter.product !== "string") {
    throw new Error(`eval: adapter at ${path} does not default-export { product, createWorld }`);
  }
  return adapter;
}

export interface StartIterationOpts {
  evalsDir: string;
  arms?: string;
  aspect?: string;
  note?: string;
  reps?: number;
  adapterPath?: string;
  client?: ReturnType<typeof createClient>;
}

export interface StartedIteration {
  evalsDir: string;
  cfg: EvalConfig;
  scenarios: Scenarios;
  scenariosHash: string;
  safetyHash: string;
  iteration: number;
  arms: EvalArm[];
  reps: number;
  aspect: EvalAspect;
  note: string;
  adapter: EvalAdapter;
  client: ReturnType<typeof createClient>;
}

function usageError(message: string): Error {
  const err = new Error(`eval: ${message}`);
  err.name = "UsageError";
  return err;
}

export function isUsageError(e: unknown): boolean {
  return e instanceof Error && e.name === "UsageError";
}

export async function startIteration(opts: StartIterationOpts): Promise<StartedIteration> {
  const { evalsDir } = opts;
  const cfg = loadEvalConfig(evalsDir);
  const scenarios = loadScenarios(join(evalsDir, "scenarios.json"));
  const scenariosHash = computeScenariosHash(scenarios);
  const safetyHash = computeSafetyHash(scenarios);
  const existing = listIterations(evalsDir);
  const iteration = existing.length === 0 ? 1 : Math.max(...existing) + 1;

  if (!opts.arms || !["treatment", "control", "both"].includes(opts.arms)) {
    throw usageError(`--arms must be treatment|control|both`);
  }
  const arms: EvalArm[] = opts.arms === "both" ? ["treatment", "control"] : [opts.arms as EvalArm];
  if (iteration === 1 && opts.arms !== "both") {
    throw usageError(`iteration 1 must use --arms both`);
  }
  let aspect: EvalAspect;
  let note = opts.note ?? "";
  if (iteration === 1) {
    aspect = "baseline";
    note = "";
  } else {
    if (!opts.aspect || !ASPECTS.slice(1).includes(opts.aspect as EvalAspect)) {
      throw usageError(`iteration ${iteration} requires --aspect one of descriptions|schemas|result_shapes|action_count`);
    }
    if (!note.trim()) {
      throw usageError(`iteration ${iteration} requires a non-empty --note`);
    }
    aspect = opts.aspect as EvalAspect;
  }
  const reps = opts.reps ?? cfg.repetitions;
  const sessions = scenarios.tasks.length * reps * arms.length;
  reserve(evalsDir, sessions, cfg);
  if (iteration > 1) {
    const first = readIteration(evalsDir, existing[0] as number);
    if (first.scenarios_hash !== scenariosHash || first.safety_hash !== safetyHash) {
      throw new Error("eval: scenarios changed since iteration 1; the comparison is no longer valid");
    }
  }
  const adapter = await loadAdapter(evalsDir, opts.adapterPath);
  const client = opts.client ?? createClient();
  return { evalsDir, cfg, scenarios, scenariosHash, safetyHash, iteration, arms, reps, aspect, note, adapter, client };
}

export function decideKeep(
  prev: IterationResults | null,
  cur: IterationResults,
  hashes: { safety_hash: string | null },
): { kept: boolean; reason: string } {
  if (prev === null) return { kept: true, reason: "baseline" };
  const best = prev.metrics.treatment;
  const now = cur.metrics.treatment;
  if (!now) return { kept: false, reason: "treatment arm not run" };
  if (!best) return { kept: true, reason: `first treatment measurement (${now.pass_rate} vs none)` };
  if (!(now.pass_rate > best.pass_rate)) {
    return { kept: false, reason: `pass rate did not improve (${now.pass_rate} vs ${best.pass_rate})` };
  }
  if (now.safety_violations > best.safety_violations) {
    return { kept: false, reason: `safety violations increased (${now.safety_violations} vs ${best.safety_violations})` };
  }
  if (hashes.safety_hash !== null && cur.safety_hash !== hashes.safety_hash) {
    return { kept: false, reason: "safety checks changed since baseline" };
  }
  return { kept: true, reason: `pass rate improved (${best.pass_rate} to ${now.pass_rate}) without more safety failures` };
}

export function bestKept(all: IterationResults[]): IterationResults | null {
  const kept = all.filter((r) => r.kept && r.metrics.treatment);
  if (kept.length === 0) return null;
  kept.sort((a, b) => {
    const ra = (a.metrics.treatment as { pass_rate: number }).pass_rate;
    const rb = (b.metrics.treatment as { pass_rate: number }).pass_rate;
    if (rb !== ra) return rb - ra;
    return a.iteration - b.iteration;
  });
  return kept[0] as IterationResults;
}

function failedTreatmentRuns(results: IterationResults): Map<string, RunResult[]> {
  const byTask = new Map<string, RunResult[]>();
  for (const run of results.runs) {
    if (run.arm !== "treatment" || run.passed) continue;
    const list = byTask.get(run.task_id) ?? [];
    list.push(run);
    byTask.set(run.task_id, list);
  }
  return byTask;
}

function causeLine(first: RunResult): string {
  if (first.calls.length === 0) return "cause: the agent called no tool";
  if (first.stopped === "max_steps") return "cause: step limit reached; shorten the path or add a combined action";
  if (first.calls.filter((c) => c.invalid_args).length >= 2) {
    return "cause: arguments were invalid; clarify the schema or add an example";
  }
  if (first.checks.some((c) => c.kind === "safety" && !c.passed)) return "cause: a safety check failed";
  if (first.checks.some((c) => c.kind === "success" && !c.passed) && !first.calls.some((c) => !c.ok)) {
    return "cause: the agent finished without achieving the outcome";
  }
  return "cause: domain error; read the error strings above";
}

export function failureDigest(evalsDir: string, results: IterationResults): string {
  // Deviation note: DP-W08 §3.6.5 names failureDigest(results); the evals dir
  // is threaded as a first argument so the function can write
  // iterations/iteration-NNN/failures.md itself (behaviour unchanged).
  let scenarios: Scenarios | null = null;
  try {
    scenarios = loadScenarios(join(evalsDir, "scenarios.json"));
  } catch {
    scenarios = null;
  }
  const titleOf = (id: string): string => scenarios?.tasks.find((t) => t.id === id)?.title ?? id;
  const lines: string[] = [`# Failures — iteration ${results.iteration}`, ""];
  const byTask = failedTreatmentRuns(results);
  const ids = [...byTask.keys()].sort();
  if (ids.length === 0) {
    lines.push("No failed treatment runs.");
    lines.push("");
  }
  for (const id of ids) {
    const failed = (byTask.get(id) as RunResult[]).sort((a, b) => a.rep - b.rep);
    const total = results.runs.filter((r) => r.arm === "treatment" && r.task_id === id).length;
    lines.push(`## ${id} — ${titleOf(id)}`);
    lines.push(`failed ${failed.length}/${total}`);
    const counts = new Map<string, number>();
    for (const run of failed) {
      for (const call of run.calls) {
        if (!call.ok && call.error) counts.set(call.error, (counts.get(call.error) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length > 0) {
      lines.push("frequent errors:");
      for (const [error, count] of top) lines.push(`- (${count}x) ${error}`);
    }
    const first = failed[0] as RunResult;
    lines.push("last calls of the first failed run:");
    for (const call of first.calls.slice(-3)) {
      lines.push(`- ${call.name} ok=${call.ok}${call.error ? ` error=${call.error}` : ""}`);
    }
    lines.push(causeLine(first));
    lines.push("");
  }
  const text = lines.join("\n");
  const dir = iterationDir(evalsDir, results.iteration);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "failures.md"), text, "utf8");
  return text;
}

export function stopLine(all: IterationResults[], cfg: EvalConfig): string {
  const best = bestKept(all);
  const latest = Math.max(...all.map((r) => r.iteration));
  if (best?.metrics.treatment && best.metrics.treatment.pass_rate >= cfg.target_pass_rate * 100) {
    return "eval: stop — target reached";
  }
  if (latest >= cfg.max_iterations) return "eval: stop — iteration cap";
  if (best && all.filter((r) => r.iteration > best.iteration).length >= cfg.patience) {
    return `eval: stop — no improvement in ${cfg.patience} iterations`;
  }
  return "eval: continue";
}

function fmt1(v: number): string {
  return v.toFixed(1);
}

export function buildReport(evalsDir: string): EvalReport {
  const cfg = loadEvalConfig(evalsDir);
  const scenarios = loadScenarios(join(evalsDir, "scenarios.json"));
  const all = listIterations(evalsDir).map((n) => readIteration(evalsDir, n));
  if (all.length === 0) throw new Error("eval: no iterations yet");
  const chosen = bestKept(all) ?? all[0];
  const withControl = all.filter((r) => r.arms_run.includes("control"));
  const controlIt = withControl.length > 0 ? withControl[withControl.length - 1] : null;
  const treatment = (chosen as IterationResults).metrics.treatment;
  const control = controlIt?.metrics.control ?? null;
  const comparable_reasons: string[] = [];
  if (!controlIt || !control || !treatment) {
    comparable_reasons.push("no control run yet");
  } else {
    if (controlIt.model !== (chosen as IterationResults).model) {
      comparable_reasons.push(`model differs: ${(chosen as IterationResults).model} vs ${controlIt.model}`);
    }
    if (controlIt.repetitions !== (chosen as IterationResults).repetitions) {
      comparable_reasons.push(`repetitions differ: ${(chosen as IterationResults).repetitions} vs ${controlIt.repetitions}`);
    }
    if (controlIt.scenarios_hash !== (chosen as IterationResults).scenarios_hash) {
      comparable_reasons.push(
        `scenarios hash differs: ${(chosen as IterationResults).scenarios_hash.slice(0, 8)} vs ${controlIt.scenarios_hash.slice(0, 8)}`,
      );
    }
  }
  const comparable = comparable_reasons.length === 0;
  const countFor = (runs: RunResult[], taskId: string, arm: "treatment" | "control"): { passed: number; runs: number } | null => {
    const subset = runs.filter((r) => r.task_id === taskId && r.arm === arm);
    if (subset.length === 0) return null;
    return { passed: subset.filter((r) => r.passed).length, runs: subset.length };
  };
  const per_task = scenarios.tasks.map((t) => ({
    task_id: t.id,
    title: t.title,
    treatment: countFor((chosen as IterationResults).runs, t.id, "treatment"),
    control: controlIt ? countFor((controlIt as IterationResults).runs, t.id, "control") : null,
  }));
  const scoped = [...(chosen as IterationResults).runs, ...(controlIt ? (controlIt as IterationResults).runs : [])];
  const replayed = scoped.some((r) => r.replayed);
  const caveats: string[] = [];
  for (const t of scenarios.tasks) {
    if (t.rubric !== null && scoped.some((r) => r.task_id === t.id && r.rubric === null)) {
      caveats.push(`rubric unavailable for ${t.id}`);
    }
  }
  if (replayed) caveats.push("some runs were replayed from recordings");
  const tp = treatment?.passed ?? 0;
  const tn = treatment?.runs ?? 0;
  const headline = control && controlIt
    ? `${fmt1(treatment?.pass_rate ?? 0)}% task success (${tp}/${tn}) with the product's action surface against ${fmt1(control.pass_rate)}% (${control.passed}/${control.runs}) with generic screen actions only; ${treatment?.tokens_per_run ?? 0} tokens and ${treatment?.wall_s_per_run ?? 0} s per try with the surface.`
    : `${fmt1(treatment?.pass_rate ?? 0)}% task success (${tp}/${tn}) with the product's action surface; no control run yet.`;
  const ceiling = `Measured on ${scenarios.tasks.length} frozen tasks, ${(chosen as IterationResults).repetitions} repetitions each, with ${(chosen as IterationResults).model}; this shows success on those tasks only.`;
  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    product: scenarios.product,
    scenarios_hash: (chosen as IterationResults).scenarios_hash,
    tasks: scenarios.tasks.length,
    repetitions: (chosen as IterationResults).repetitions,
    model: (chosen as IterationResults).model,
    chosen_iteration: (chosen as IterationResults).iteration,
    control_iteration: controlIt ? (controlIt as IterationResults).iteration : null,
    comparable,
    comparable_reasons,
    treatment,
    control,
    per_task,
    iterations: all.map((r) => ({
      n: r.iteration,
      aspect: r.aspect,
      note: r.note,
      pass_rate: r.metrics.treatment?.pass_rate ?? null,
      first_pass_valid_rate: r.metrics.treatment?.first_pass_valid_rate ?? null,
      tokens_per_run: r.metrics.treatment?.tokens_per_run ?? null,
      wall_s_per_run: r.metrics.treatment?.wall_s_per_run ?? null,
      safety_violations: r.metrics.treatment?.safety_violations ?? null,
      kept: r.kept,
    })),
    sessions_used: readLedger(evalsDir).sessions,
    sessions_cap: cfg.max_sessions,
    replayed,
    headline,
    ceiling,
    caveats,
  };
}

export function writeReportArtifacts(evalsDir: string, report: EvalReport): void {
  const schema = loadSchema("contracts/hee-eval-report.schema.json");
  const check = compileSchema(schema);
  const valid = check(report);
  if (!valid.ok) throw new Error(`eval: report invalid: ${valid.errors.join("; ")}`);
  writeFileSync(join(evalsDir, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  const svg = renderTrajectorySvg(
    report.iterations.map((i) => ({ n: i.n, rate: i.pass_rate ?? 0, kept: i.kept })),
    report.control?.pass_rate ?? null,
  );
  writeFileSync(join(evalsDir, "trajectory.svg"), svg, "utf8");
  const md = [
    "# Task success per iteration",
    "",
    "![Task success per iteration](trajectory.svg)",
    "",
    "| Iteration | Aspect | Note | Success | Kept |",
    "|---|---|---|---|---|",
    ...report.iterations.map((i) => `| ${i.n} | ${i.aspect} | ${i.note} | ${i.pass_rate === null ? "n/a" : `${fmt1(i.pass_rate)}%`} | ${i.kept ? "yes" : "no"} |`),
    "",
  ].join("\n");
  writeFileSync(join(evalsDir, "trajectory.md"), md, "utf8");
}

export async function finishIteration(started: StartedIteration): Promise<IterationResults> {
  const results = await runIteration({
    adapter: started.adapter,
    scenarios: started.scenarios,
    scenariosHash: started.scenariosHash,
    safetyHash: started.safetyHash,
    arms: started.arms,
    reps: started.reps,
    iteration: started.iteration,
    aspect: started.aspect,
    note: started.note,
    cfg: started.cfg,
    evalsDir: started.evalsDir,
    client: started.client,
  });
  const existing = listIterations(started.evalsDir).filter((n) => n !== results.iteration);
  const prevAll = existing.map((n) => readIteration(started.evalsDir, n));
  const baseline = prevAll.length > 0 ? (prevAll[0] as IterationResults) : null;
  const best = bestKept(prevAll);
  const { kept, reason } = decideKeep(best, results, {
    safety_hash: baseline ? baseline.safety_hash : results.safety_hash,
  });
  results.kept = kept;
  results.kept_reason = reason;
  writeIteration(started.evalsDir, results);
  if (results.iteration > 1) {
    const prev = readIteration(started.evalsDir, results.iteration - 1);
    if (prev.manifest_hash !== null && prev.manifest_hash === results.manifest_hash) {
      console.log("eval: warning — manifest unchanged since the previous iteration");
    }
  }
  if (!kept && results.iteration > 1) {
    const target = best ? best.iteration : results.iteration - 1;
    console.log(
      `eval: iteration ${results.iteration} NOT kept — restore the previous action surface (see iterations/iteration-${pad(target, 3)}/actions.manifest.json)`,
    );
  }
  failureDigest(started.evalsDir, results);
  const all = [...prevAll, results].sort((a, b) => a.iteration - b.iteration);
  const report = buildReport(started.evalsDir);
  writeReportArtifacts(started.evalsDir, report);
  const t = results.metrics.treatment;
  const c = results.metrics.control;
  const segments: string[] = [];
  if (t) segments.push(`treatment ${t.passed}/${t.runs}`);
  if (c) segments.push(`control ${c.passed}/${c.runs}`);
  console.log(`eval: iteration ${results.iteration} — ${segments.join(", ")}, model ${results.model}`);
  console.log(stopLine(all, started.cfg));
  return results;
}
