// Requirement IDs: PGM-10, RES-01, RES-04, RES-06, XCUT-08
// The ONLY module under src/pgm/ allowed to import from src/resilience —
// every outbound PGM LLM call is routed through here, never raw (PGM-10).
//
// - callLlmForRole(role, prompt, opts?) resolves provider/model/temperature
//   via roles.getModelForRole (PGM-11) and wraps the injected transport in
//   withResilience (timeout/retry/backoff/fallback per DP-K §7.4: selector
//   45s, others 20s — the repo has no SDK adapter, so the actual HTTP/SDK
//   callable is injected by the caller, mirroring the advisor's AdvisorLlm
//   pattern; omitting it yields a DegradedResult, never a throw).
// - callValidatedRole adds RES-04 structured-output enforcement: schema
//   validation of the transport output + EXACTLY ONE repair round-trip via
//   withValidation (DP-A §6); second failure degrades as
//   validation_repair_failed (RES-06).
// - Outcomes are explicit unions {ok:true,data}|{ok:false,...DegradedResult}
//   so stages surface degraded mode instead of crashing (RES-06 / UI-RES-02).

import {
  isDegradedResult,
  withResilience,
  withValidation,
} from "../resilience/index.js";
import type { DegradedResult } from "../resilience/index.js";
import { getModelForRole, type Role } from "./roles.js";

/** Minimal transport contract: prompt in, completion text out (advisor-style). */
export type RoleLlm = (input: string) => string | Promise<string>;

export interface RoleCallOptions {
  /** Actual provider/SDK callable; tests inject mocks. Omit → degraded. */
  transport?: RoleLlm;
  /** RES-04 schema — when set, output is validated + one repair round-trip. */
  schema?: object;
  /** Out-of-band repair LLM used only for the single repair attempt (DP-A §6). */
  repairLlm?: RoleLlm;
  /** Overrides for the DP-K §7.4 defaults (selector 45000ms, rest 20000ms). */
  timeoutMs?: number;
  retries?: number;
}

/** Explicit outcome union per RES-06: success carries data; failure a DegradedResult. */
export type ResilientCallOutcome<T> =
  | { ok: true; data: T }
  | ({ ok: false } & DegradedResult);

/** Per-role timeouts, DP-K §7.4: stage 4 selection gets the long budget. */
export function resolveRoleTimeoutMs(role: Role): number {
  return role === "pgm_selector" ? 45000 : 20000;
}

function resilienceConfig(opts: RoleCallOptions): {
  timeout_ms: number;
  retries: number;
  fallback_chain: { order: ["none"] };
} {
  return {
    timeout_ms: opts.timeoutMs ?? resolveRoleTimeoutMs("pgm_deconstructor"),
    retries: opts.retries ?? 1,
    fallback_chain: { order: ["none"] }, // ADV-05-style manual checklist, not a cache
  };
}

//#region Raw-text dispatch

/**
 * callLlmForRole — DP-K §8 signature. Routes one prompt through withResilience.
 * On success returns {ok:true,data:<text>}; any timeout/retry exhaustion or
 * missing transport maps to {ok:false,...} + DegradedResult fields (RES-06).
 */
export async function callLlmForRole(
  role: Role,
  prompt: string,
  opts: RoleCallOptions = {},
): Promise<ResilientCallOutcome<string>> {
  getModelForRole(role); // PGM-11 guard: throws on unknown role/profile before any I/O
  const transport = opts.transport;
  if (!transport) {
    return {
      ok: false,
      ...makeNoTransport(role),
    };
  }
  const wrapped = withResilience(
    () => transport(prompt),
    resilienceConfig({ ...opts, timeoutMs: opts.timeoutMs ?? resolveRoleTimeoutMs(role) }),
  );
  const out = await wrapped();
  if (isDegradedResult(out)) return { ok: false, ...out };
  return { ok: true, data: String(out) };
}

//#endregion

//#region Structured-output variant (RES-04 inside RES-01)

/**
 * callValidatedRole — same routing as callLlmForRole plus withValidation:
 * validates `schema` against the transport output and runs EXACTLY ONE repair
 * round-trip via opts.repairLlm on first failure (DP-A §6). Success data is the
 * parsed object; invalid-after-repair degrades (validation_repair_failed).
 */
export async function callValidatedRole<T = unknown>(
  role: Role,
  prompt: string,
  schema: object,
  opts: RoleCallOptions = {},
): Promise<ResilientCallOutcome<T>> {
  getModelForRole(role); // PGM-11 guard: throws on unknown role/profile before any I/O
  const transport = opts.transport;
  if (!transport) {
    return { ok: false, ...makeNoTransport(role) };
  }
  const wrapped = withValidation(
    () => transport(prompt),
    schema,
    // retries stay 1 by default: avoid latency amplification through repair (DP-A §6.2)
    resilienceConfig({ ...opts, timeoutMs: opts.timeoutMs ?? resolveRoleTimeoutMs(role) }),
    { repairLlm: opts.repairLlm },
  );
  const out = await wrapped();
  if (isDegradedResult(out)) return { ok: false, ...out };
  return { ok: true, data: out as T };
}

//#endregion

//#region Generic data-source wrapping (Stage 2 tiers — PGM-03, PGM-10)

export interface TierCallOptions {
  timeoutMs: number;
  retries: number;
  /** When set, adds backoff {policy:"exponential", base_ms} (stage2 tier2). */
  backoffBaseMs?: number;
}

/**
 * callTier — wraps one Stage-2 Reddit data-source call in withResilience
 * (RES-01) with the per-tier policy from config/pgm.json
 * resilience.stage2_tier1 / stage2_tier2: tier1 {timeout_ms:3000, retries:0},
 * tier2 {timeout_ms:8000, retries:1, backoff exponential base 500}. Lives here
 * so resilientCall stays the ONLY src/pgm module importing the resilience
 * wrappers (PGM-10); sources themselves never touch src/resilience.
 * Returns the explicit outcome union — never throws (RES-06).
 */
export async function callTier<T>(
  fn: () => T | Promise<T>,
  opts: TierCallOptions,
): Promise<ResilientCallOutcome<T>> {
  const wrapped = withResilience(fn, {
    timeout_ms: opts.timeoutMs,
    retries: opts.retries,
    ...(opts.backoffBaseMs !== undefined
      ? { backoff: { policy: "exponential" as const, base_ms: opts.backoffBaseMs } }
      : {}),
    fallback_chain: { order: ["none"] as const },
  });
  const out = await wrapped();
  if (isDegradedResult(out)) return { ok: false, ...out };
  return { ok: true, data: out };
}

//#endregion

function makeNoTransport(role: Role): DegradedResult<null> {
  return {
    degraded: true,
    reason: "provider_transport_unavailable",
    fallback_source: "none",
    original_error: `no transport injected for role ${role} (PGM-10)`,
    data: null,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
}
