// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §2 data shapes: config, scenarios, adapter, runs, metrics, report.
import type { ToolDecl } from "../llm/index.js";

export type EvalArm = "treatment" | "control";
export type EvalAspect = "baseline" | "descriptions" | "schemas" | "result_shapes" | "action_count";

export interface EvalConfig {
  version: "1.0.0";
  max_sessions: number;
  repetitions: number;
  target_pass_rate: number;
  max_iterations: number;
  patience: number;
  max_steps_default: number;
  parallel: number;
  min_tasks: number;
  min_repetitions: number;
  max_result_chars: number;
}

export interface Task {
  id: string;
  title: string;
  prompt: string;
  seed: string;
  difficulty: 1 | 2 | 3;
  max_steps: number;
  success: { check_ids: string[] };
  safety: { check_ids: string[] };
  rubric: string | null;
}

export interface Scenarios {
  version: "1.0.0";
  product: string;
  written_for: string;
  tasks: Task[];
  frozen_at: string | null;
  frozen_hash: string | null;
  safety_hash: string | null;
}

export interface ToolOutcome {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
  invalid_args?: boolean;
}

export interface EvalWorld {
  tools(): ToolDecl[];
  call(name: string, args: Record<string, unknown>): Promise<ToolOutcome>;
  verify(checkId: string): Promise<{ passed: boolean; detail: string }>;
  describeOutcome(): Promise<string>;
  close(): Promise<void>;
}

export interface EvalAdapter {
  product: string;
  createWorld(arm: EvalArm, seed: string): Promise<EvalWorld>;
}

export interface CheckResult {
  check_id: string;
  kind: "success" | "safety";
  passed: boolean;
  detail: string;
}

export interface RubricResult {
  verdict: "pass" | "fail";
  reason: string;
  model: string;
}

export interface CallLog {
  name: string;
  ok: boolean;
  invalid_args: boolean;
  retry: boolean;
  error: string | null;
}

export interface RunResult {
  task_id: string;
  arm: EvalArm;
  rep: number;
  passed: boolean;
  checks: CheckResult[];
  safety_violation: boolean;
  rubric: RubricResult | null;
  steps: number;
  stopped: "done" | "max_steps" | "model_error";
  calls: CallLog[];
  tokens: number;
  wall_ms: number;
  model: string;
  final_text: string;
  replayed: boolean;
  trace_file: string;
}

export interface ArmMetrics {
  runs: number;
  passed: number;
  pass_rate: number;
  first_pass_valid_rate: number;
  failed_calls: number;
  retries: number;
  tokens_per_run: number;
  wall_s_per_run: number;
  safety_violations: number;
  calls_per_run: number;
}

export interface IterationResults {
  version: "1.0.0";
  iteration: number;
  started_at: string;
  finished_at: string;
  arms_run: EvalArm[];
  repetitions: number;
  scenarios_hash: string;
  safety_hash: string;
  model: string;
  aspect: EvalAspect;
  note: string;
  manifest_hash: string | null;
  runs: RunResult[];
  metrics: { treatment: ArmMetrics | null; control: ArmMetrics | null };
  kept: boolean;
  kept_reason: string;
}

export interface EvalReport {
  version: "1.0.0";
  generated_at: string;
  product: string;
  scenarios_hash: string;
  tasks: number;
  repetitions: number;
  model: string;
  chosen_iteration: number;
  control_iteration: number | null;
  comparable: boolean;
  comparable_reasons: string[];
  treatment: ArmMetrics | null;
  control: ArmMetrics | null;
  per_task: {
    task_id: string;
    title: string;
    treatment: { passed: number; runs: number } | null;
    control: { passed: number; runs: number } | null;
  }[];
  iterations: {
    n: number;
    aspect: string;
    note: string;
    pass_rate: number | null;
    first_pass_valid_rate: number | null;
    tokens_per_run: number | null;
    wall_s_per_run: number | null;
    safety_violations: number | null;
    kept: boolean;
  }[];
  sessions_used: number;
  sessions_cap: number;
  replayed: boolean;
  headline: string;
  ceiling: string;
  caveats: string[];
}
