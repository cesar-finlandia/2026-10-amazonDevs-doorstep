// Sweep-backed LLM transport (DP-CHAT x PGM-10; PAS-M1 §6.5) — now a THIN
// WRAPPER over the generalized shared module src/shared/sweepLlm.ts. All
// mechanism lives there: file-reference turns (Windows argv ceiling), stable
// conversation ids, tolerant JSON-envelope extraction, orphaned-driver
// recovery and lock handling. This wrapper only pins the PGM identity:
//   - conversation prefix `pgm-…` (per-factory salt, as before)
//   - task files under .tmp/pgm-sweep/ (unchanged location)
//   - bash resolution honors PGM_SWEEP_BASH first.
//
// Concurrency: one transport call at a time (PGM stages are sequential). The
// sweep driver also holds .run_sweep.lock per turn — do NOT nest a `pgm --llm
// sweep` invocation inside another running sweep driver.

import { makeSweepLlmTransport } from "../../shared/sweepLlm.js";
import type { SweepLlmOptions as SweepTransportOptions } from "../../shared/sweepLlm.js";

export { extractJsonLoose } from "../../shared/sweepLlm.js";
export type { SweepLlmOptions as SweepTransportOptions } from "../../shared/sweepLlm.js";

/** RoleLlm-compatible factory; options contract unchanged for PGM callers. */
export function makeSweepTransport(opts: SweepTransportOptions = {}): ReturnType<typeof makeSweepLlmTransport> {
  return makeSweepLlmTransport({ caller: "pgm", bashEnvVar: "PGM_SWEEP_BASH", ...opts });
}
