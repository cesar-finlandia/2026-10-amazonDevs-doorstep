// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §2.1 evaluation config: defaults, load, init.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EvalConfig } from "./types.js";

export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  version: "1.0.0",
  max_sessions: 300,
  repetitions: 2,
  target_pass_rate: 0.9,
  max_iterations: 25,
  patience: 3,
  max_steps_default: 30,
  parallel: 2,
  min_tasks: 8,
  min_repetitions: 2,
  max_result_chars: 4000,
};

export function configPath(evalsDir: string): string {
  return join(evalsDir, "config.json");
}

export function loadEvalConfig(evalsDir: string): EvalConfig {
  const path = configPath(evalsDir);
  if (!existsSync(path)) return { ...DEFAULT_EVAL_CONFIG };
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<EvalConfig>;
  return { ...DEFAULT_EVAL_CONFIG, ...raw, version: "1.0.0" };
}

export function initEvalConfig(evalsDir: string): EvalConfig {
  mkdirSync(evalsDir, { recursive: true });
  const path = configPath(evalsDir);
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(DEFAULT_EVAL_CONFIG, null, 2) + "\n", "utf8");
  }
  return loadEvalConfig(evalsDir);
}
