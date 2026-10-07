// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §3.1 scenarios: load, lint, freeze, hashes.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileSchema, loadSchema } from "../llm/index.js";
import type { Scenarios } from "./types.js";

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalize(v)).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function scenariosHash(s: Scenarios): string {
  return sha256Hex(canonicalize({ product: s.product, written_for: s.written_for, tasks: s.tasks }));
}

export function safetyHash(s: Scenarios): string {
  return sha256Hex(
    canonicalize(s.tasks.map((t) => ({ id: t.id, safety: t.safety.check_ids }))),
  );
}

function validateScenariosShape(data: unknown): Scenarios {
  const schema = loadSchema("contracts/hee-eval-scenarios.schema.json");
  const check = compileSchema(schema);
  const result = check(data);
  if (!result.ok) {
    throw new Error(`eval: scenarios invalid: ${result.errors.join("; ")}`);
  }
  return data as Scenarios;
}

function parseScenariosFile(path: string): Scenarios {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`eval: scenarios not found: ${path}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch (e) {
    throw new Error(`eval: scenarios invalid: ${(e as Error).message}`);
  }
  return validateScenariosShape(data);
}

export function loadScenarios(path: string): Scenarios {
  const s = parseScenariosFile(path);
  if (s.frozen_hash === null || s.frozen_hash !== scenariosHash(s)) {
    throw new Error("eval: scenarios are not frozen or were edited after freezing (hash mismatch)");
  }
  return s;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${escapeRe(word)}\\b`, "i").test(haystack);
}

export function lintScenarios(s: Scenarios, actionNames: string[], minTasks = 8): string[] {
  const problems: string[] = [];
  if (s.tasks.length < minTasks) {
    problems.push(`only ${s.tasks.length} tasks, need at least ${minTasks}`);
  }
  const difficulties = new Set(s.tasks.map((t) => t.difficulty));
  if (difficulties.size < 2) {
    problems.push("tasks cover fewer than 2 distinct difficulty values");
  }
  if (!s.tasks.some((t) => t.safety.check_ids.length > 0)) {
    problems.push("no task carries a safety check");
  }
  const seen = new Set<string>();
  for (const t of s.tasks) {
    if (seen.has(t.id)) problems.push(`duplicate task id ${t.id}`);
    seen.add(t.id);
  }
  const banned = ["tool", "function", "API", "endpoint", "schema"];
  for (const t of s.tasks) {
    for (const name of actionNames) {
      if (name && wholeWord(t.prompt, name)) {
        problems.push(`task ${t.id} prompt names an action (${name})`);
        break;
      }
    }
    for (const word of banned) {
      if (wholeWord(t.prompt, word)) {
        problems.push(`task ${t.id} prompt contains the word ${word}`);
        break;
      }
    }
    if (t.prompt.length < 12) {
      problems.push(`task ${t.id} prompt is shorter than 12 characters`);
    }
    if (t.max_steps < 3) {
      problems.push(`task ${t.id} max_steps is below 3`);
    }
  }
  return problems;
}

function manifestActionNames(scenariosPath: string): string[] {
  const entryRoot = dirname(dirname(scenariosPath));
  const manifestPath = join(entryRoot, "actions.manifest.json");
  if (!existsSync(manifestPath)) return [];
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      actions?: { name?: string }[];
    };
    return (manifest.actions ?? []).map((a) => a.name ?? "").filter((n) => n.length > 0);
  } catch {
    return [];
  }
}

export function freezeScenarios(path: string, actionNames?: string[]): Scenarios {
  const s = parseScenariosFile(path);
  const names = actionNames ?? manifestActionNames(path);
  const problems = lintScenarios(s, names);
  if (problems.length > 0) {
    throw new Error(`eval: scenarios failed lint:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  }
  const hash = scenariosHash(s);
  const safety = safetyHash(s);
  // Freezing a file already frozen with these hashes changes nothing, the timestamp
  // included: a re-run must not make a frozen file look edited.
  if (s.frozen_at !== null && s.frozen_hash === hash && s.safety_hash === safety) {
    console.log(`eval: froze ${s.tasks.length} tasks, hash ${hash.slice(0, 8)}`);
    return s;
  }
  s.frozen_at = new Date().toISOString();
  s.frozen_hash = hash;
  s.safety_hash = safety;
  writeFileSync(path, JSON.stringify(s, null, 2) + "\n", "utf8");
  console.log(`eval: froze ${s.tasks.length} tasks, hash ${ (s.frozen_hash as string).slice(0, 8)}`);
  return s;
}
