// Requirement IDs: GOV-RES-04, MOCK-RES-01, TRN-04 | DP-F1 §7.1
// Typed error family for the MOCK tool. Every failure mode in §7.1 maps to one
// of these — the runner never lets an untyped exception escape (outermost
// try/catch maps stragglers to MockFatalError, GOV-RES-04).

import type { EventEnvelope } from "../../platform/transport/event-envelope.js";
import type { ValidationError } from "../../resilience/validate.js";

/** Script file missing / unreadable (§7.1 row 3) — no publish, no cache write. */
export class MockScriptReadError extends Error {
  readonly path: string;
  constructor(path: string, cause: unknown) {
    super(`cannot read script at ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "MockScriptReadError";
    this.path = path;
  }
}

/** A single envelope violated contracts/event-envelope.schema.json (§7.1 row 2). */
export class MockEnvelopeError extends Error {
  readonly envelope: EventEnvelope;
  readonly errors: ValidationError[];
  constructor(envelope: EventEnvelope, errors: ValidationError[]) {
    super(`envelope step_id=${envelope.step_id} sequence=${envelope.sequence} violates EventEnvelope: ${errors.length} error(s)`);
    this.name = "MockEnvelopeError";
    this.envelope = envelope;
    this.errors = errors;
  }
}

/** Last-line catch-all (§7.1 "never throws unhandled") — unexpected failures only. */
export class MockFatalError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(`FATAL: ${message}`);
    this.name = "MockFatalError";
    this.cause = cause;
  }
}
