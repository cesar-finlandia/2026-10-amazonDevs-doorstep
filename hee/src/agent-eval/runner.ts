// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §3.3 one task run and one iteration of runs.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileSchema, createClient, loadSchema } from "../llm/index.js";
import type { Content } from "../llm/index.js";
import { renderSystemPrompt } from "./control.js";
import { gradeRun } from "./grader.js";
import { armMetrics } from "./metrics.js";
import type {
  CallLog,
  EvalAdapter,
  EvalArm,
  EvalAspect,
  EvalConfig,
  EvalWorld,
  IterationResults,
  RunResult,
  Scenarios,
  Task,
  ToolOutcome,
} from "./types.js";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function iterationDir(evalsDir: string, iteration: number): string {
  return join(evalsDir, "iterations", `iteration-${pad(iteration, 3)}`);
}

function stepKey(iteration: number, arm: EvalArm, taskId: string, rep: number, step: number): string {
  return `eval.i${pad(iteration, 3)}.${arm}.${taskId}.r${rep}.s${pad(step, 2)}`;
}

function truncateJson(data: unknown, maxChars: number): string {
  const text = JSON.stringify(data) ?? "null";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…[truncated]";
}

function responseFor(outcome: ToolOutcome, maxChars: number): Record<string, unknown> {
  const response: Record<string, unknown> = { ok: outcome.ok, summary: outcome.summary };
  if (outcome.data !== undefined) response["data"] = truncateJson(outcome.data, maxChars);
  if (outcome.error !== undefined) response["error"] = outcome.error;
  return response;
}

function cutContents(contents: Content[]): Content[] {
  return contents.map((c) => ({
    role: c.role,
    parts: c.parts.map((p) => (p.text !== undefined ? { ...p, text: p.text.slice(0, 1000) } : p)),
  }));
}

export interface RunTaskOpts {
  adapter: EvalAdapter;
  task: Task;
  arm: EvalArm;
  rep: number;
  iteration: number;
  cfg: EvalConfig;
  evalsDir: string;
  client?: ReturnType<typeof createClient>;
}

export async function runTask(opts: RunTaskOpts): Promise<RunResult> {
  const { adapter, task, arm, rep, iteration, cfg, evalsDir } = opts;
  const client = opts.client ?? createClient();
  const world: EvalWorld = await adapter.createWorld(arm, task.seed);
  const system = renderSystemPrompt(arm, adapter.product);
  const contents: Content[] = [{ role: "user", parts: [{ text: task.prompt }] }];
  const calls: CallLog[] = [];
  let tokens = 0;
  let model = "unknown";
  let final_text = "";
  let stopped: RunResult["stopped"] = "max_steps";
  let completed = false;
  const replayedFlags: boolean[] = [];
  const t0 = Date.now();
  try {
    for (let step = 1; step <= task.max_steps; step++) {
      const tools = world.tools();
      const reply = await client.generate({
        role: "hee_eval_agent",
        module: "agent-eval",
        key: stepKey(iteration, arm, task.id, rep, step),
        system,
        contents,
        tools,
        temperature: 0.2,
      });
      if (!reply.ok) {
        stopped = "model_error";
        final_text = `model error: ${reply.reason}`;
        completed = true;
        break;
      }
      tokens += reply.usage.totalTokens;
      model = reply.model;
      replayedFlags.push(reply.replayed);
      const modelParts: Content["parts"] = [];
      if (reply.text) modelParts.push({ text: reply.text });
      for (const fc of reply.functionCalls) {
        modelParts.push({ functionCall: { name: fc.name, args: fc.args } });
      }
      contents.push({ role: "model", parts: modelParts });
      if (reply.functionCalls.length === 0) {
        stopped = "done";
        final_text = reply.text;
        completed = true;
        break;
      }
      const responses: Content["parts"] = [];
      for (const fc of reply.functionCalls) {
        const outcome = await world.call(fc.name, fc.args);
        const prev = calls.length > 0 ? (calls[calls.length - 1] as CallLog) : null;
        calls.push({
          name: fc.name,
          ok: outcome.ok,
          invalid_args: outcome.invalid_args === true,
          retry: prev !== null && prev.name === fc.name && !prev.ok,
          error: outcome.error ?? null,
        });
        responses.push({ functionResponse: { name: fc.name, response: responseFor(outcome, cfg.max_result_chars) } });
      }
      contents.push({ role: "user", parts: responses });
    }
    if (!completed) {
      stopped = "max_steps";
      final_text = "";
    }
    world.recordFinalText?.(final_text);
    const grade = await gradeRun({ world, task, arm, rep, iteration, final_text, client });
    const dir = iterationDir(evalsDir, iteration);
    const traceRel = join("iterations", `iteration-${pad(iteration, 3)}`, "traces", arm, `${task.id}.r${rep}.json`);
    mkdirSync(join(dir, "traces", arm), { recursive: true });
    writeFileSync(
      join(evalsDir, traceRel),
      JSON.stringify({ system, task, contents: cutContents(contents), calls, grade }, null, 2) + "\n",
      "utf8",
    );
    return {
      task_id: task.id,
      arm,
      rep,
      passed: grade.passed,
      checks: grade.checks,
      safety_violation: grade.safety_violation,
      rubric: grade.rubric,
      steps: contents.filter((c) => c.role === "model").length,
      stopped,
      calls,
      tokens,
      wall_ms: Date.now() - t0,
      model,
      final_text,
      replayed: replayedFlags.length > 0 && replayedFlags.every(Boolean),
      trace_file: traceRel.replace(/\\/g, "/"),
    };
  } finally {
    await world.close();
  }
}

export interface RunIterationOpts {
  adapter: EvalAdapter;
  scenarios: Scenarios;
  scenariosHash: string;
  safetyHash: string;
  arms: EvalArm[];
  reps: number;
  iteration: number;
  aspect: EvalAspect;
  note: string;
  cfg: EvalConfig;
  evalsDir: string;
  client?: ReturnType<typeof createClient>;
}

export async function runIteration(opts: RunIterationOpts): Promise<IterationResults> {
  const { adapter, scenarios, arms, reps, iteration, aspect, note, cfg, evalsDir } = opts;
  const client = opts.client ?? createClient();
  const started_at = new Date().toISOString();
  const jobs: { arm: EvalArm; task: Task; rep: number }[] = [];
  for (const arm of arms) {
    for (const task of scenarios.tasks) {
      for (let rep = 1; rep <= reps; rep++) jobs.push({ arm, task, rep });
    }
  }
  const results: RunResult[] = new Array(jobs.length);
  let next = 0;
  const workers = Math.max(1, Math.min(cfg.parallel, jobs.length));
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++] as { arm: EvalArm; task: Task; rep: number };
        results[jobs.indexOf(job)] = await runTask({
          adapter,
          task: job.task,
          arm: job.arm,
          rep: job.rep,
          iteration,
          cfg,
          evalsDir,
          client,
        });
      }
    }),
  );
  results.sort((a, b) =>
    a.arm === b.arm ? (a.task_id === b.task_id ? a.rep - b.rep : a.task_id < b.task_id ? -1 : 1) : a.arm < b.arm ? -1 : 1,
  );
  const treatmentRuns = results.filter((r) => r.arm === "treatment");
  const controlRuns = results.filter((r) => r.arm === "control");
  const finished_at = new Date().toISOString();
  const entryRoot = dirname(evalsDir);
  const manifestPath = join(entryRoot, "actions.manifest.json");
  let manifest_hash: string | null = null;
  const dir = iterationDir(evalsDir, iteration);
  mkdirSync(dir, { recursive: true });
  if (existsSync(manifestPath)) {
    const bytes = readFileSync(manifestPath);
    manifest_hash = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(join(dir, "actions.manifest.json"), bytes);
  }
  const out: IterationResults = {
    version: "1.0.0",
    iteration,
    started_at,
    finished_at,
    arms_run: [...arms],
    repetitions: reps,
    scenarios_hash: opts.scenariosHash,
    safety_hash: opts.safetyHash,
    model: results.length > 0 ? (results[0] as RunResult).model : "unknown",
    aspect,
    note,
    manifest_hash,
    runs: results,
    metrics: {
      treatment: arms.includes("treatment") ? armMetrics(treatmentRuns) : null,
      control: arms.includes("control") ? armMetrics(controlRuns) : null,
    },
    kept: false,
    kept_reason: "undecided",
  };
  const schema = loadSchema("contracts/hee-eval-results.schema.json");
  const check = compileSchema(schema);
  const valid = check(out);
  if (!valid.ok) throw new Error(`eval: results invalid: ${valid.errors.join("; ")}`);
  writeFileSync(join(dir, "results.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  return out;
}
