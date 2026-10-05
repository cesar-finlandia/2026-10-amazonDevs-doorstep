// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LLM_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(LLM_DIR, "..", "..");

export function compileSchema(schema: object): (data: unknown) => { ok: true } | { ok: false; errors: string[] } {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return (data: unknown) => {
    const valid = validate(data);
    if (valid) return { ok: true };
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
    return { ok: false, errors };
  };
}

export function loadSchema(pathFromRepoRoot: string): object {
  const full = resolve(REPO_ROOT, pathFromRepoRoot);
  return JSON.parse(readFileSync(full, "utf8")) as object;
}
