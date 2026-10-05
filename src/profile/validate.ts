// Requirement IDs: PROFILE-01, RES-04
// Thin wrapper over src/resilience/validate for the event-profile schema —
// DP-L §9.2 (non-duplicate): all ajv/compilation logic stays in RES-04; this
// module only pins the frozen contract contracts/event-profile.schema.json so
// callers never hand-roll schema loading or re-implement validation.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validate } from "../resilience/index.js";
import type { ValidationResult } from "../resilience/validate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = join(HERE, "..", "..", "contracts", "event-profile.schema.json");

/** The authoritative contract, loaded defensively (absent/malformed → throw:
 * a missing schema is a repo integrity bug, not a runtime degradation). */
export function loadEventProfileSchema(): object {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as object;
}

/** Validate one parsed EventProfile document against the frozen contract. */
export function validateEventProfile(data: unknown): ValidationResult {
  return validate(loadEventProfileSchema(), data);
}
