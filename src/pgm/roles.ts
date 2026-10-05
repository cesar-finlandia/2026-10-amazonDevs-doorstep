// Requirement IDs: PGM-11, GOV-REU-02, XCUT-08
// Role→model resolution for the Problem Grounding & Market-Discovery Engine —
// DP-K §8 / master_blueprint §6.14.
//
// - THE single read path for PGM role routing: config/model-profiles.json, the
//   one shared role→model_profile file of the chassis (its $comment mandates
//   "exactly one routing file"; ADV/DATA/PROFILE already read it). The repo
//   consolidated config to JSON, so this is also the roles.yaml/roles.json
//   alias target described by DP-K §8 — no second file is created (PGM-11).
// - PGM_ROLES_FILE env override exists FOR TESTS ONLY; production always hits
//   the shared file above (GOV-REU-02: models swappable via config alone).
// - Unlike the advisor's warn+default fallback (GOV-RES-02), a PGM stage with
//   an unknown role or unknown model_profile THROWS: grounding stages must
//   never silently route to an unintended model (PGM-11 contract).
// - This module never imports src/resilience and never performs I/O beyond the
//   single readFileSync below; outbound LLM traffic lives in resilientCall.ts
//   (the only src/pgm file allowed to touch the resilience layer).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PGM_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PGM_DIR, "..", "..");
export const DEFAULT_ROLES_PATH = join(REPO_ROOT, "config", "model-profiles.json");

/** Frozen PGM stage roles per DP-K §8 table / §6.14 decision. */
export type Role =
  | "pgm_deconstructor"
  | "pgm_miner_query"
  | "pgm_synthesizer"
  | "pgm_selector";

/** Resolved model routing for one call (provider/model from the shared file). */
export interface RoleModelConfig {
  provider: string;
  model: string;
  temperature: number;
  max_tokens?: number;
}

/** Resolve the roles file path; env override is tests-only by convention. */
export function resolveRolesFilePath(): string {
  const override = process.env["PGM_ROLES_FILE"];
  return override && override.trim() ? override.trim() : DEFAULT_ROLES_PATH;
}

//#region Shared-file parsing (tolerates both documented shapes)

/**
 * Shape A (repo, config/model-profiles.json): roles[role] = "profile-name",
 * profiles under "profiles". Shape B (DP-K §8 roles.yaml example):
 * roles[role] = {model_profile}, profiles under "model_profiles". Both are
 * accepted so the file stays forward/backward compatible without a second
 * routing file (PGM-11).
 */
interface RolesDoc {
  roles?: Record<string, unknown>;
  profiles?: Record<string, unknown>;
  model_profiles?: Record<string, unknown>;
}

function readRolesDoc(path: string): RolesDoc {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as RolesDoc;
  if (!parsed || typeof parsed !== "object") throw new Error(`roles file is not an object: ${path}`);
  return parsed;
}

function profileNameForRole(doc: RolesDoc, role: Role): string {
  const entry = doc.roles?.[role];
  if (typeof entry === "string" && entry.trim()) return entry.trim();
  if (entry && typeof entry === "object") {
    const mp = (entry as Record<string, unknown>)["model_profile"];
    if (typeof mp === "string" && mp.trim()) return mp.trim();
  }
  throw new Error(`Unknown role ${role} — check ${resolveRolesFilePath()} (PGM-11)`);
}

function resolveProfile(doc: RolesDoc, name: string): RoleModelConfig {
  const raw = doc.profiles?.[name] ?? doc.model_profiles?.[name];
  if (!raw || typeof raw !== "object") {
    throw new Error(
      `Unknown model_profile ${name} — check ${resolveRolesFilePath()} (PGM-11)`,
    );
  }
  const p = raw as Record<string, unknown>;
  const provider = p["provider"];
  const model = p["model"];
  if (typeof provider !== "string" || !provider.trim() || typeof model !== "string" || !model.trim()) {
    throw new Error(`model_profile ${name} lacks provider/model in ${resolveRolesFilePath()} (PGM-11)`);
  }
  const temperature = typeof p["temperature"] === "number" ? p["temperature"] : 0.4; // DP-K §8 analyst default
  const maxTokens = typeof p["max_tokens"] === "number" ? p["max_tokens"] : undefined;
  return { provider, model, temperature, max_tokens: maxTokens };
}

//#endregion

//#region Public resolver (PGM-11)

/**
 * getModelForRole(role) — resolve {provider, model, temperature} for a frozen
 * PGM stage role via the ONE shared routing file (DP-K §8). Throws on unknown
 * role or unknown/unusable model_profile (see header: PGM must not silently
 * mis-route). Reads the file fresh per call so config edits apply without a
 * process restart.
 */
export function getModelForRole(role: Role): RoleModelConfig {
  const doc = readRolesDoc(resolveRolesFilePath());
  return resolveProfile(doc, profileNameForRole(doc, role));
}

//#endregion
