// Requirement IDs: MOCK-01, MOCK-02, MOCK-04, MOCK-REU-01, TRN-04, MOCK-RES-01
// Synthetic event driver (DP-F1 §3.2/§3.3): loads a MockScript from local FS,
// validates it whole via RES-04 (./validate.js), then publishes each event as
// an EventEnvelope through the single TRN-04 primitive — indistinguishable from
// a real backend on the wire. Offline by construction (MOCK-RES-01): FS read +
// injected/memory publisher only; no HTTP, no LLM call, no API key.
//
// Timing (MOCK-02): per-envelope delay_ms + global tick_ms wait before publish;
// realtime:false (--fast) emits back-to-back with zero waits. Payloads are
// opaque (GOV-REU-02) and never inspected.

import { readFileSync } from "node:fs";
import { createPublisher } from "../../platform/transport/publisher.js";
import type { Publisher } from "../../platform/transport/publisher.js";
import type { EventEnvelope } from "../../platform/transport/event-envelope.js";
import type { EnvelopeStatus } from "../../platform/transport/publisher.js";
import type { GoldenCache } from "../../resilience/cache/index.js";
import type { ValidationError } from "../../resilience/validate.js";
import { assertValidMockScript, validateEnvelope } from "./validate.js";
import { MockEnvelopeError, MockFatalError, MockScriptReadError } from "./errors.js";

export interface MockEvent {
  step_id: string;
  status: EnvelopeStatus;
  payload: Record<string, unknown>;
  sequence: number;
  delay_ms?: number;
  timestamp?: string;
  degraded?: boolean;
}

export interface MockScript {
  version: string;
  trace_id: string;
  tick_ms?: number;
  realtime?: boolean;
  events: MockEvent[];
}

export interface RunMockOptions {
  /** Path to a MockScript JSON file (read from local FS). */
  scriptPath?: string;
  /** Already-parsed script object (tests / CLI --stdin). One of the two required. */
  scriptObject?: unknown;
  /** Global pacing pad added to every event's delay_ms; wins over script.tick_ms (§3.3). */
  tickMs?: number;
  /** false → ignore all waits (§3.3 --fast); wins over script.realtime. */
  realtime?: boolean;
  /** Transport passed to createPublisher when no publisher is injected. */
  transport?: "sse" | "websocket";
  /** Injected TRN-04 publisher (tests inject the memory adapter from ./stream.js). */
  publisher?: Publisher;
  /** RES-05 store to record every published envelope into (--record; MOCK-05). */
  recordTo?: GoldenCache;
  /** Deterministic replay mode (DEMODRIVE-01): derive the key from this kebab
   *  string instead of provider|model|prompt content (--key). */
  explicitKey?: string;
  /** Emit one debug row per envelope: sequence, step_id, status, delay_ms (BENCH-03). */
  debug?: boolean;
}

/** sleep helper — the only pacing mechanism (setTimeout, §3.3). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadScript(opts: RunMockOptions): unknown {
  if (opts.scriptObject !== undefined) return opts.scriptObject;
  if (opts.scriptPath !== undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return JSON.parse(readFileSync(opts.scriptPath, "utf8"));
    } catch (err) {
      throw new MockScriptReadError(opts.scriptPath, err);
    }
  }
  throw new MockFatalError("runMock requires scriptPath or scriptObject");
}

/** DEBUG row per emit — telemetry consumed by BENCH-03 budget observation. */
function debugEmit(debug: boolean | undefined, evt: MockEvent): void {
  if (!debug && process.env.MOCK_DEBUG === undefined && process.env.DEBUG === undefined) return;
  console.debug(
    `[mock] sequence=${evt.sequence} step_id=${evt.step_id} status=${evt.status} delay_ms=${evt.delay_ms ?? 0}`,
  );
}

export interface MockWarning {
  /** Script-relative index of the skipped envelope. */
  index: number;
  stepId: string;
  errors: ValidationError[];
}

export interface MockRunResult {
  traceId: string;
  published: number;
  skipped: number;
  warnings: MockWarning[];
  /** Number of envelopes written to the golden cache (0 when not recording). */
  recorded: number;
}

/**
 * Cache-write path for --record (MOCK-05 → RES-05, §3.5): MOCK is only ever a
 * PRODUCER into the single store created by createGoldenCache() — same tool,
 * same deriveKey, no second cache-writer, no custom index format.
 *
 * Failure contract (§7.1 row "Cache write fails"): a failed put logs
 * `warn: cache write failed for key <sha>: <os message>` and the stream
 * continues — recording never degrades the publish path.
 */
async function recordEnvelope(
  cache: GoldenCache,
  key: string,
  envelope: EventEnvelope,
  explicitKey?: string,
): Promise<void> {
  try {
    await cache.put(key, envelope, {
      provider: "mock",
      model: "synthetic",
      source: "mock",
      ...(explicitKey !== undefined ? { explicit_key: explicitKey } : {}),
    });
    if (!(await cache.has(key))) {
      console.warn(`[mock] warn: cache write failed for key ${key}`);
      return;
    }
  } catch (err) {
    console.warn(
      `[mock] warn: cache write failed for key ${key}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * runMock — replay a MockScript as a live EventEnvelope stream (§3.2).
 *
 * Failure contract (§7.1):
 * - invalid whole script → MockScriptValidationError before ANY publish;
 * - unreadable script file → MockScriptReadError, no publish;
 * - one offending envelope → skipped with a WARN row, the stream continues;
 * - anything else unexpected → MockFatalError (GOV-RES-04, never unhandled).
 */
export async function runMock(opts: RunMockOptions): Promise<MockRunResult> {
  try {
    const raw = loadScript(opts);
    assertValidMockScript(raw); // whole-script gate before ANY publish (§7.1 row 1)
    const script = raw as MockScript;

    // Flag wins over script field, script field wins over default (§3.3).
    const tickMs = opts.tickMs ?? script.tick_ms ?? 0;
    const realtime = opts.realtime ?? script.realtime ?? true;
    const publisher = opts.publisher ?? createPublisher(opts.transport);

    let published = 0;
    let recorded = 0;
    const warnings: MockWarning[] = [];

    for (let i = 0; i < script.events.length; i++) {
      const evt = script.events[i]!; // schema guarantees minItems 1, items object
      if (realtime) {
        await sleep((evt.delay_ms ?? 0) + tickMs);
      }

      // 1:1 mapping per §3.1 table — no second envelope shape.
      const envelope: EventEnvelope = {
        step_id: evt.step_id,
        status: evt.status,
        payload: evt.payload,
        sequence: evt.sequence,
        timestamp: evt.timestamp ?? new Date().toISOString(),
        trace_id: script.trace_id,
        degraded: evt.degraded ?? false,
      };

      // Offending envelope is skipped with a WARN row; peers continue (§7.1).
      const { valid, errors } = validateEnvelope(envelope);
      if (!valid) {
        warnings.push({ index: i, stepId: evt.step_id, errors });
        console.warn(`[mock] WARN skipping events[${i}] (${evt.step_id}): envelope invalid`);
        continue;
      }

      await publisher.publish({
        stepId: envelope.step_id,
        status: envelope.status,
        payload: envelope.payload,
        traceId: envelope.trace_id,
        degraded: envelope.degraded,
      });
      published += 1;

      // --record (MOCK-05): after each successful publish, write the same
      // envelope into the RES-05 store under the canonical deriveKey (§3.5).
      if (opts.recordTo !== undefined) {
        const cache = opts.recordTo;
        const key =
          opts.explicitKey !== undefined
            ? cache.deriveKey({ explicitKey: opts.explicitKey }) // DEMODRIVE-01 mode
            : cache.deriveKey({
                provider: "mock",
                model: "synthetic",
                prompt: {
                  trace_id: script.trace_id,
                  sequence: envelope.sequence,
                  step_id: envelope.step_id,
                },
              });
        await recordEnvelope(cache, key, envelope, opts.explicitKey);
        recorded += 1;
      }

      debugEmit(opts.debug, evt);
    }

    await publisher.close();
    return { traceId: script.trace_id, published, skipped: warnings.length, warnings, recorded };
  } catch (err) {
    // Typed MOCK errors propagate as-is; everything else becomes MockFatalError
    // so callers never see an unhandled crash (GOV-RES-04 / §7.1 last line).
    if (err instanceof MockScriptReadError) throw err;
    if (err instanceof MockFatalError) throw err;
    if (err instanceof Error && err.name === "MockScriptValidationError") throw err;
    throw new MockFatalError(err instanceof Error ? err.message : String(err), err);
  }
}
