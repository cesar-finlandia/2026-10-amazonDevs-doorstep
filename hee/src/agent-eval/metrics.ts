// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §2.4 arm metrics over completed runs.
import type { ArmMetrics, RunResult } from "./types.js";

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function armMetrics(runs: RunResult[]): ArmMetrics {
  const passed = runs.filter((r) => r.passed).length;
  const calls = runs.flatMap((r) => r.calls);
  const valid = calls.filter((c) => !c.invalid_args).length;
  const failed_calls = calls.filter((c) => !c.ok).length;
  let retries = 0;
  for (const run of runs) {
    for (let i = 1; i < run.calls.length; i++) {
      const prev = run.calls[i - 1] as (typeof run.calls)[number];
      const cur = run.calls[i] as (typeof run.calls)[number];
      if (cur.name === prev.name && !prev.ok) retries++;
    }
  }
  const tokens = runs.reduce((sum, r) => sum + r.tokens, 0);
  const walls = runs.reduce((sum, r) => sum + r.wall_ms, 0);
  return {
    runs: runs.length,
    passed,
    pass_rate: runs.length === 0 ? 0 : round1((passed / runs.length) * 100),
    first_pass_valid_rate: calls.length === 0 ? 1.0 : round4(valid / calls.length),
    failed_calls,
    retries,
    tokens_per_run: runs.length === 0 ? 0 : round1(tokens / runs.length),
    wall_s_per_run: runs.length === 0 ? 0 : round1(walls / runs.length / 1000),
    safety_violations: runs.filter((r) => r.safety_violation).length,
    calls_per_run: runs.length === 0 ? 0 : round1(calls.length / runs.length),
  };
}
