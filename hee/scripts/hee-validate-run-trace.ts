// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04, HEE-KIT-02
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { summarizeTrace } from "../kits/agent-workflow/src/trace/summarize.js";
import type { TraceEntry } from "../kits/agent-workflow/src/trace/types.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

interface Flags {
  file: string;
  minRoles: number;
  minActions: number;
  requireVerifyRepair: boolean;
  requireHumanCheckpoint: boolean;
}

function parseArgv(argv: string[]): Flags | { error: string } {
  let file = "";
  let minRoles = 0;
  let minActions = 0;
  let requireVerifyRepair = false;
  let requireHumanCheckpoint = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--min-roles" && i + 1 < argv.length) minRoles = Number(argv[++i]);
    else if (a === "--min-actions" && i + 1 < argv.length) minActions = Number(argv[++i]);
    else if (a === "--require-verify-repair") requireVerifyRepair = true;
    else if (a === "--require-human-checkpoint") requireHumanCheckpoint = true;
    else if (!a.startsWith("--") && !file) file = a;
    else return { error: `usage: hee-validate-run-trace.ts <run-trace.json> [--min-roles N --min-actions N --require-verify-repair --require-human-checkpoint]` };
  }
  if (!file) return { error: `usage: hee-validate-run-trace.ts <run-trace.json> [--min-roles N --min-actions N --require-verify-repair --require-human-checkpoint]` };
  return { file, minRoles, minActions, requireVerifyRepair, requireHumanCheckpoint };
}

export function validateRunTraceFile(path: string): { ok: true; summary: ReturnType<typeof summarizeTrace> } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { ok: false, reason: `not JSON: ${(e as Error).message}` };
  }
  const schema = JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "hee-run-trace.schema.json"), "utf8"));
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    return { ok: false, reason: `schema: ${JSON.stringify(validate.errors)}` };
  }
  const entries = (data as { entries: TraceEntry[] }).entries;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]?.seq !== i + 1) return { ok: false, reason: `seq gap at index ${i}` };
  }
  return { ok: true, summary: summarizeTrace(entries) };
}

function main(): void {
  const parsed = parseArgv(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(`FAIL ${parsed.error}`);
    process.exit(1);
  }
  const checked = validateRunTraceFile(resolve(process.cwd(), parsed.file));
  if (!checked.ok) {
    console.error(`FAIL ${checked.reason}`);
    process.exit(1);
  }
  const s = checked.summary;
  if (s.model_roles.length < parsed.minRoles) {
    console.error(`FAIL only ${s.model_roles.length} model roles, need ${parsed.minRoles}`);
    process.exit(1);
  }
  if (s.actions < parsed.minActions) {
    console.error(`FAIL only ${s.actions} actions, need ${parsed.minActions}`);
    process.exit(1);
  }
  if (parsed.requireVerifyRepair && s.verify_repair_rounds < 1) {
    console.error("FAIL no verify→repair round");
    process.exit(1);
  }
  if (parsed.requireHumanCheckpoint && s.human_checkpoints < 1) {
    console.error("FAIL no human checkpoint");
    process.exit(1);
  }
  console.log(`trace ok: ${s.model_calls} model calls, ${s.actions} actions, ${s.verify_repair_rounds} verify→repair, ${s.human_checkpoints} human checkpoints, roles=${s.model_roles.length}`);
}

if (!process.env["VITEST"] && !process.env["VITEST_WORKER_ID"]) main();
