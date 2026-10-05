// Requirement IDs: PROFILE-07, PGM-11 (XCUT-08)
// Profile-side role→model resolution for the Event Profile Extractor —
// DP-L §7 / master_blueprint §6.14.
//
// - THE single read path for PROFILE role routing is REUSED, not duplicated:
//   this module re-exports getModelForRole from src/pgm/roles.ts (the one
//   resolver established by M09), exactly as DP-L §7.2 mandates — never a
//   second routing file, never a second parser (PROFILE-07). The shared file
//   is config/model-profiles.json; its loader already tolerates both the
//   repo's string-form roles and the DP-K §8 {model_profile} object form,
//   and honors the tests-only PGM_ROLES_FILE env override used below to
//   prove the GOV-RES-02 fallback against a deliberately malformed copy.
// - Unlike PGM (whose stages must throw rather than silently mis-route),
//   PROFILE applies the advisor-style GOV-RES-02 contract on top: absent or
//   malformed shared config → warn ONCE + safe defaults
//   (profile_extractor → analyst-balanced, synthetic generic-heuristic
//   provider so the offline bench keeps working) — NEVER a throw.
// - No hardcoded provider/model strings live in src/profile/: everything is
//   resolved from the shared file's profile entries (GOV-REU-02). The only
//   literals below are the two documented safe-default NAMES, mirroring
//   src/context/token_counter.ts' generic-heuristic convention.
// - Outbound calls made here are plain JSON-mode chat completions; the
//   RES-01/RES-04 wrapping (timeout/retry/repair) belongs to the extractor
//   (src/profile/extractor.ts, DP-L §4.3–§4.4), not to this routing module.

import { getModelForRole as pgmGetModelForRole } from "../pgm/roles.js";
import type { RoleModelConfig } from "../pgm/roles.js";

/** Single shared resolver, re-exported verbatim — never a duplicate (PROFILE-07). */
export { getModelForRole } from "../pgm/roles.js";
export type { RoleModelConfig };

//#region PROFILE role identity + GOV-RES-02 safe defaults

/** Role keys are open-ended config entries (§7 "new roles are additive");
 *  `profile_extractor` is the one PROFILE uses today. */
export type ProfileRole = string;

/** Default model_profile for profile_extractor per DP-L §7 table (analyst task). */
export const DEFAULT_PROFILE_MODEL_PROFILE = "analyst-balanced";

/**
 * Safe-default routing used ONLY when the shared file is absent/malformed or
 * lacks the role (GOV-RES-02): synthetic heuristic provider keeps the offline
 * bench functional — no network, deterministic output, never a throw.
 * Temperature 0.2 mirrors the DP-L §7 analyst-balanced example entry.
 */
export const DEFAULT_PROFILE_ROLE_CONFIG: RoleModelConfig = {
  provider: "generic-heuristic",
  model: DEFAULT_PROFILE_MODEL_PROFILE,
  temperature: 0.2,
  max_tokens: 4000,
};

let warnedFallback = false;
function warnOnce(message: string): void {
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(`[profile] warn: ${message}`);
  }
}

//#endregion

//#region Public wrappers (DP-L §7.2)

/**
 * Resolve {provider, model, temperature, max_tokens} for a PROFILE role via
 * the ONE shared resolver + shared routing file. The pgm resolver throws on
 * unknown role / unknown model_profile / malformed file (PGM-11 contract);
 * this wrapper converts exactly those failures into the GOV-RES-02 safe
 * defaults with a single warn, so extraction never crashes on config trouble.
 */
export function getModelForProfileRole(role: ProfileRole = "profile_extractor"): RoleModelConfig {
  try {
    // The pgm resolver looks roles up by string key and its Role union is
    // deliberately frozen to PGM stages (PGM-11); PROFILE-07 explicitly
    // reuses the resolver for the additive "profile_extractor" key instead
    // of widening that frozen union, hence the narrowing cast (DP-L §7.2).
    return pgmGetModelForRole(role as Parameters<typeof pgmGetModelForRole>[0]);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    warnOnce(
      `profile config invalid (${reason}); using defaults ` +
        `(role ${role} → ${DEFAULT_PROFILE_MODEL_PROFILE}, provider generic-heuristic)`,
    );
    return { ...DEFAULT_PROFILE_ROLE_CONFIG };
  }
}

/**
 * JSON-mode LLM call for PROFILE: resolves provider/model/temperature/
 * max_tokens from the profile entry (never hardcoded), then issues an
 * OpenAI-compatible chat completion with response_format json_object.
 * - provider "generic-heuristic" → deterministic synthetic response (all-null
 *   five-fact-group JSON) so the offline bench runs without network;
 *   fabrication-free by construction, matching prompt rule 6.
 * - any other provider → OPENAI_API_KEY/OPENAI_BASE_URL endpoint; failures
 *   THROW here by contract — the extractor's RES-01 wrapper degrades them
 *   into the blank template (DP-L §4.4), mirroring advisor defaultCallLlm.
 */
export async function callLlmForProfile(
  prompt: string,
  opts?: { temperature?: number },
  role: ProfileRole = "profile_extractor",
): Promise<string> {
  const cfg = getModelForProfileRole(role); // --role override via shared module (§7/§9.3)
  const temperature = opts?.temperature ?? cfg.temperature;
  if (cfg.provider === "generic-heuristic" || cfg.provider === "heuristic") {
    return syntheticHeuristicResponse();
  }
  return openAiCompatibleJsonCall(prompt, { ...cfg, temperature });
}

/**
 * Deterministic offline response for the synthetic generic-heuristic provider:
 * the conservative all-null five-fact-group object — parseable, schema-shaped,
 * and fabrication-free (prompt rule 6). Real extraction needs a real model;
 * the bench uses this to exercise plumbing, validation and fallback paths.
 */
function syntheticHeuristicResponse(): string {
  return JSON.stringify({
    mandated_platform: { required: false, name: null },
    tracks: { structure: "unknown", sponsors: [] },
    video_limits: { max_minutes: null, section_boundaries: null },
    submission_fields: null,
    disclosure_required: null,
  });
}

/** OpenAI-compatible chat completion in json_object mode (advisor-style). */
async function openAiCompatibleJsonCall(prompt: string, cfg: RoleModelConfig): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set — profile extractor cannot reach an LLM (offline path)");
  }
  const baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "user", content: prompt }],
      temperature: cfg.temperature,
      ...(cfg.max_tokens !== undefined ? { max_tokens: cfg.max_tokens } : {}),
      response_format: { type: "json_object" }, // DP-L §4.2 — structured output
    }),
    signal: AbortSignal.timeout(60_000), // hard outer stop; RES-01 governs budget
  });
  if (!res.ok) throw new Error(`profile LLM HTTP ${res.status}`);
  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("profile LLM returned empty content");
  return content;
}

//#endregion

