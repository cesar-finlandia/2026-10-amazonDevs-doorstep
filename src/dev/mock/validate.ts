// Requirement IDs: MOCK-01, MOCK-REU-01, RES-04, XCUT-06 | DP-F1 §3.1
// Thin RES-04 wrapper for MOCK scripts: every schema check routes through the
// single shared validator in src/resilience (blueprint §4 contract 4) — ajv /
// jsonschema are never instantiated here. Two surfaces only: whole-script
// validation against contracts/mock-script.schema.json and per-envelope
// validation against contracts/event-envelope.schema.json. Domain-free
// (GOV-REU-02): payloads pass through opaque.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../../resilience/validate.js";
import type { ValidationError, ValidationResult } from "../../resilience/validate.js";

export type { ValidationError, ValidationResult };

/** Directory of this module (TRN-06 style single source — loaded once from disk).
 *  Built via fileURLToPath rather than the `new URL(rel, import.meta.url)`
 *  pattern: Vite rewrites that pattern to the environment location, which under
 *  a jsdom test environment is http://localhost:… and readFileSync rejects it
 *  (ERR_INVALID_URL_SCHEME). fileURLToPath(import.meta.url) is untouched by the
 *  rewrite and resolves identically in node and jsdom environments. */
const HERE = dirname(fileURLToPath(import.meta.url));

let mockScriptSchemaCache: object | null = null;
function loadMockScriptSchema(): object {
  if (!mockScriptSchemaCache) {
    mockScriptSchemaCache = JSON.parse(
      readFileSync(join(HERE, "../../../contracts/mock-script.schema.json"), "utf8"),
    ) as object;
  }
  return mockScriptSchemaCache;
}

let envelopeSchemaCache: object | null = null;
function loadEnvelopeSchema(): object {
  if (!envelopeSchemaCache) {
    envelopeSchemaCache = JSON.parse(
      readFileSync(join(HERE, "../../../contracts/event-envelope.schema.json"), "utf8"),
    ) as object;
  }
  return envelopeSchemaCache;
}

/** Thrown when a MockScript fails RES-04 validation before any publish happens. */
export class MockScriptValidationError extends Error {
  readonly errors: ValidationError[];
  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = "MockScriptValidationError";
    this.errors = errors;
  }
}

/** JSON Pointer ("/events/2/status") → readable form ("events[2].status"). */
export function formatValidationError(err: ValidationError): string {
  const segments = err.path.split("/").filter(Boolean).map(decodeURIComponent);
  let readable = "";
  for (const seg of segments) {
    readable += /^\d+$/.test(seg) ? `[${seg}]` : `${readable ? "." : ""}${seg}`;
  }
  return `${readable || "/"} ${err.code}: ${err.message}`;
}

/** Whole-script check — validate(mock-script.schema, script) via shared RES-04. */
export function validateMockScript(script: unknown): ValidationResult {
  return validate(loadMockScriptSchema(), script);
}

/** Per-envelope check — validate(event-envelope.schema, envelope) via shared RES-04. */
export function validateEnvelope(envelope: unknown): ValidationResult {
  return validate(loadEnvelopeSchema(), envelope);
}

/**
 * Convenience used by callers that want throw-on-invalid semantics for a whole
 * script: raises MockScriptValidationError whose message names the FIRST error's
 * path + code + message (§3.1 "never a silent emit"); full errors array carried.
 */
export function assertValidMockScript(script: unknown): ValidationResult {
  const result = validateMockScript(script);
  if (!result.valid) {
    const first = result.errors[0];
    const detail = first ? ` at ${formatValidationError(first)}` : "";
    throw new MockScriptValidationError(`MockScript validation failed${detail}`, result.errors);
  }
  return result;
}
