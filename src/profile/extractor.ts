// Requirement IDs: PROFILE-01, PROFILE-02, PROFILE-03, PROFILE-04, PROFILE-06,
//   PROFILE-RES-01, PROFILE-RES-02, GOV-RES-02, GOV-RES-04, RES-01, RES-04
// Event Profile Extractor — DP-L §4 (extraction flow), §5 (fallback + flag).
//
// - PROFILE-01: ONE generic LLM call on the happy path; at most one RES-04
//   repair round-trip (exactly-one retry, DP-A §6.2). No loops, no cache.
// - PROFILE-02 standalone: imports ONLY src/resilience (RES-01/RES-04),
//   src/profile/roles (shared model-profiles reader) and the frozen contract
//   contracts/event-profile.schema.json — never src/pgm, src/assembly,
//   src/ideation, src/platform/context/media (CI-blocked, DP-L §4.5).
// - PROFILE-03 budget: timeout_ms 18000, retries 1, backoff exponential base
//   400ms; hard ceiling enforced by the CLI driver (AbortSignal.timeout(40000)).
// - PROFILE-04/RES-02: every failure mode (RES-01 exhaustion, corrupt JSON,
//   failed repair, unreadable/short brief) collapses to the SAME blank
//   template with the literal marker "not extracted — confirm manually"
//   (em dash U+2014) — never a throw to the caller, never an empty file,
//   never a fabricated value.
// - PROFILE-06: the mandated-platform flag is DATA ONLY (advisory); nothing
//   here gates or disables any chassis component.

import { readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { withResilience, validate, repair, renderRepairPrompt } from "../resilience/index.js";
import type { ValidationError } from "../resilience/index.js";
import { callLlmForProfile } from "./roles.js";
import { loadEventProfileSchema } from "./validate.js";

const PROFILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PROFILE_DIR, "..", "..");
export const EXTRACT_TEMPLATE_PATH = join(PROFILE_DIR, "prompts", "extract.template.md");
export const EVENT_PROFILE_SCHEMA_PATH = join(REPO_ROOT, "contracts", "event-profile.schema.json");

/** Literal marker per DP-L §5.1 — em dash U+2014, NEVER a hyphen. */
export const NOT_EXTRACTED = "not extracted — confirm manually" as const;

/** §4.4 RES-01 wrapping for BOTH primary and repair calls. */
export const EXTRACTION_RESILIENCE_CONFIG = {
  timeout_ms: 18_000,
  retries: 1,
  backoff: { policy: "exponential" as const, base_ms: 400, factor: 2.0, max_ms: 3000, jitter: true },
  fallback_chain: { order: ["none" as "none"] }, // no stale-cache fact fallback — would fabricate
};

//#region Types (structural view of contracts/event-profile.schema.json)

/** Raw LLM output shape (pre-normalization); extra fields dropped by validate/repair. */
export interface RawProfile {
  mandated_platform?: { required?: boolean; name?: string | null };
  tracks?: { structure?: string; sponsors?: string[] };
  video_limits?: { max_minutes?: number | null; section_boundaries?: object | null };
  submission_fields?: string[] | null;
  disclosure_required?: boolean | null;
}

/** Normalized EventProfile — mirrors the schema's extracted branch. */
export interface EventProfile {
  version: "1.0.0";
  mandated_platform: {
    required: boolean;
    name: string | null;
    flag: string | null;
    needs_human_confirm: boolean;
  };
  tracks: { structure: string; sponsors: string[] };
  video_limits: {
    max_minutes: number | null;
    max_seconds: number | null;
    section_boundaries: object | null;
  };
  submission_fields: string[] | null;
  disclosure_required: boolean | null;
  not_extracted_fields: string[];
  raw_brief_hash: string;
  extracted_at: string;
  extraction_meta: { status: "extracted" | "not-extracted"; not_extracted_marker: typeof NOT_EXTRACTED };
}

//#endregion

//#region Prompt render + defensive parse (§4.2)

/** Render the checked-in generic template; the brief is the ONLY variable. */
export function renderExtractPrompt(briefText: string): string {
  return readFileSync(EXTRACT_TEMPLATE_PATH, "utf8").replace("{{brief}}", briefText);
}

/** Defensive fenced-strip then JSON.parse (provider may ignore json_object). */
export function parseLlmJson(raw: string): RawProfile {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence?.[1]) text = fence[1].trim();
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("profile LLM output is not a JSON object");
  }
  return parsed as RawProfile;
}

//#endregion

//#region Normalization + blank template (§4.3, §5.1)

/** Order-preserving case-insensitive dedup (deterministic, no domain logic). */
export function dedupStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

/** Groups left null/unknown by brief SILENCE — expected, not failure (§4.3). */
export function computeNotExtracted(raw: RawProfile): string[] {
  const groups: string[] = [];
  if (raw.mandated_platform?.required == null && raw.mandated_platform?.name == null) {
    groups.push("mandated_platform");
  }
  const structure = raw.tracks?.structure;
  if (!structure || structure === "unknown" || (raw.tracks?.sponsors ?? []).length === 0) {
    groups.push("tracks");
  }
  if (raw.video_limits?.max_minutes == null && raw.video_limits?.section_boundaries == null) {
    groups.push("video_limits");
  }
  if (raw.submission_fields == null) groups.push("submission_fields");
  if (raw.disclosure_required == null) groups.push("disclosure_required");
  return groups;
}

/** Pure deterministic normalization — NO second LLM call (§4.3). */
export function normalize(raw: RawProfile, briefHash: string): EventProfile {
  const maxMinutes =
    typeof raw.video_limits?.max_minutes === "number" ? raw.video_limits.max_minutes : null;
  const maxSeconds = maxMinutes != null ? Math.round(maxMinutes * 60) : null;
  const req = !!raw.mandated_platform?.required;
  // NOTE: the marker literal NEVER appears in extracted-status documents
  // (contracts/event-profile.schema.json allOf[1] forbids it); a mandated
  // platform whose name stayed null stays null here and surfaces via
  // needs_human_confirm + flag("unknown") — manual confirmation, not fabrication.
  const name = typeof raw.mandated_platform?.name === "string" ? raw.mandated_platform.name.trim() : null;
  const flag = req
    ? `⚠️ MANDATED PLATFORM — ${name ?? "unknown"} — chassis likely doesn't apply — confirm manually`
    : null;
  const structure = raw.tracks?.structure ?? "unknown";
  return {
    version: "1.0.0",
    mandated_platform: { required: req, name: name ?? null, flag, needs_human_confirm: req },
    tracks: { structure, sponsors: dedupStrings(raw.tracks?.sponsors ?? []) },
    video_limits: {
      max_minutes: maxMinutes,
      max_seconds: maxSeconds,
      section_boundaries: raw.video_limits?.section_boundaries ?? null,
    },
    submission_fields: Array.isArray(raw.submission_fields)
      ? dedupStrings(raw.submission_fields)
      : raw.submission_fields ?? null,
    disclosure_required:
      typeof raw.disclosure_required === "boolean" ? raw.disclosure_required : null,
    not_extracted_fields: computeNotExtracted(raw),
    raw_brief_hash: briefHash,
    extracted_at: new Date().toISOString(),
    extraction_meta: { status: "extracted", not_extracted_marker: NOT_EXTRACTED },
  };
}

/** Total-failure template (§5.1): EVERY field carries the literal marker. */
export function blankTemplate(briefHash: string): EventProfile {
  return {
    version: "1.0.0",
    mandated_platform: {
      required: false,
      name: NOT_EXTRACTED,
      flag: null,
      needs_human_confirm: false,
    },
    tracks: { structure: NOT_EXTRACTED, sponsors: [NOT_EXTRACTED] },
    video_limits: {
      max_minutes: NOT_EXTRACTED as unknown as number,
      max_seconds: NOT_EXTRACTED as unknown as number,
      section_boundaries: NOT_EXTRACTED as unknown as object,
    },
    submission_fields: [NOT_EXTRACTED],
    disclosure_required: NOT_EXTRACTED as unknown as boolean,
    not_extracted_fields: [
      "mandated_platform",
      "tracks",
      "video_limits",
      "submission_fields",
      "disclosure_required",
    ],
    raw_brief_hash: briefHash || "0".repeat(64),
    extracted_at: new Date().toISOString(),
    extraction_meta: { status: "not-extracted", not_extracted_marker: NOT_EXTRACTED },
  };
}

//#endregion

//#region Fabrication guard (§8 row "LLM fabricates value")

/**
 * PROFILE-REU-02 post-processor, MORE stringent than the schema alone: a value
 * the LLM could only have invented (absent from the brief text) is demoted to
 * the literal NOT_EXTRACTED marker and its group is added to
 * not_extracted_fields. Because the frozen contract forbids the marker under
 * extraction_meta.status:"extracted" (allOf[1]), any violation flips the
 * document to status:"not-extracted" — downstream then prompts a manual
 * confirm instead of trusting a hallucinated fact. tracks.structure stays
 * untouched (§8). Pure function; never calls the LLM.
 */
export function applyFabricationGuard(profile: EventProfile, briefText: string): EventProfile {
  const lower = briefText.toLowerCase();
  const violations = new Set<string>();
  const out: EventProfile = JSON.parse(JSON.stringify(profile)) as EventProfile;

  // mandated_platform: required:true demands the name be a brief substring.
  const name = out.mandated_platform.name;
  if (
    out.mandated_platform.required &&
    typeof name === "string" &&
    name.length > 0 &&
    !lower.includes(name.trim().toLowerCase())
  ) {
    // Never echo the fabricated string anywhere — not in name, not in flag.
    out.mandated_platform.name = NOT_EXTRACTED;
    out.mandated_platform.flag = null;
    violations.add("mandated_platform");
  }

  // sponsors: every non-empty sponsor entry must appear in the brief.
  if (out.tracks.sponsors.length > 0) {
    const fabricated = out.tracks.sponsors.some(
      (s) => typeof s === "string" && s.length > 0 && !lower.includes(s.trim().toLowerCase()),
    );
    if (fabricated) {
      out.tracks.sponsors = [NOT_EXTRACTED];
      violations.add("tracks");
    }
  }

  if (violations.size > 0) {
    out.extraction_meta.status = "not-extracted";
    out.not_extracted_fields = [...new Set([...out.not_extracted_fields, ...violations])];
  }
  return out;
}

//#endregion

//#region Extraction flow (§4.1) + driver (§5.1)

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Load the frozen contract once per process via the thin wrapper (§9.2). */
function eventProfileSchema(): object {
  return loadEventProfileSchema();
}

export interface ExtractDeps {
  /** Optional injected LLM transport (tests/bench stubs); defaults to the
   * shared callLlmForProfile routing. Mirrors pgm resilientCall's transport DI.
   * opts.temperature lets the RES-04 repair call run colder than the primary. */
  callLlm?: (prompt: string, opts?: { temperature?: number }) => Promise<string>;
}

/** Repair round-trips run colder than extraction (DP-L §4.3): 0.1. */
export const REPAIR_TEMPERATURE = 0.1;

/**
 * extractEventProfile — ONE LLM call on the happy path; at most one RES-04
 * repair round-trip; RES-01 wrapping on BOTH calls; fabrication guard applied
 * to every accepted candidate; throws only after ALL of that fails so the
 * outer §5.1 driver can collapse to the blank template.
 */
export async function extractEventProfile(
  briefText: string,
  briefHash: string,
  deps?: ExtractDeps,
): Promise<EventProfile> {
  const callLlm = deps?.callLlm ?? callLlmForProfile;
  const prompt = renderExtractPrompt(briefText); // generic template; brief is the only variable
  const resilientCall = withResilience(() => callLlm(prompt), EXTRACTION_RESILIENCE_CONFIG);
  const out = await resilientCall(); // T | DegradedResult — both mean "extraction failed"
  if (typeof out !== "string") throw new Error(`profile extraction degraded: ${out.reason}`);
  const parsed = parseLlmJson(out);

  // The frozen contract requires the FULL document shape (version, meta,
  // hashes) and gates the marker literal by status — so validation runs on
  // the NORMALIZED candidate, never on the bare 5-group raw object. The
  // fabrication guard runs BEFORE validation so a sanitized document is what
  // gets checked (and what repair, if ever needed, starts from).
  const schema = eventProfileSchema();
  const candidate = applyFabricationGuard(normalize(parsed, briefHash), briefText);
  const first = validate(schema, candidate);
  if (!first.valid) {
    // Exactly ONE repair round-trip via RES-04 (DP-A §6.2) using the SHARED
    // generic re-prompt template (src/resilience/repair-prompt.template.md,
    // rendered by renderRepairPrompt — never a bespoke profile re-prompt).
    // Its throw means total failure → caller writes the blank template.
    const repaired = await repair(
      schema,
      candidate,
      (errors: ValidationError[]) => renderRepairPrompt(errors, out),
      async (rePrompt: string) => {
        const second = parseLlmJson(await callLlm(rePrompt, { temperature: REPAIR_TEMPERATURE }));
        return JSON.stringify(applyFabricationGuard(normalize(second, briefHash), briefText));
      },
    );
    return repaired.data as EventProfile;
  }
  return candidate;
}

/** Generic repair re-prompt (§4.3): errors[].path|code|message + truncated original.
 * DELEGATES to the single shared template renderer (src/resilience/
 * repair-prompt.template.md via RES-04's renderRepairPrompt) — no bespoke copy. */
export function renderExtractRepairPrompt(errors: ValidationError[], originalOutput: string): string {
  return renderRepairPrompt(errors, originalOutput);
}

/** Atomic write: tmp + rename in the SAME directory — no partial file, no empty file. */
export function writeAtomically(outPath: string, profile: EventProfile): void {
  const dir = dirname(outPath);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${Math.random().toString(36).slice(2)}.tmp`);
  try {
    writeFileSync(tmp, JSON.stringify(profile, null, 2) + "\n", "utf8");
    renameSync(tmp, outPath);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

//#endregion

//#region Typed failures + readEventProfile + driver (§5.1, §8)

/** §5.1/§8: empty, severely short, <5 whitespace-tokens or NUL-byte brief —
 * NO LLM call is made; the driver maps this straight to the blank template. */
export class BriefInsufficientError extends Error {
  readonly reason = "brief_insufficient";
  constructor(message: string) {
    super(message);
    this.name = "BriefInsufficientError";
  }
}

/** §8 row "Output path unwritable": the ONLY failure the driver surfaces to
 * its caller (CLI maps it to exit 1 with a clear message; no raw stack). */
export class ProfileWriteError extends Error {
  readonly path: string;
  readonly code: string;
  constructor(path: string, cause: unknown) {
    const c = cause as { code?: string } | null;
    super(`profile extract failed to write ${path}: ${cause instanceof Error ? cause.message : String(cause)} — re-run with --out <writable-dir>`);
    this.name = "ProfileWriteError";
    this.path = path;
    this.code = c?.code ?? "EWRITE";
  }
}

/** PROFILE-03 hard ceiling (§4.6/§8): the driver aborts extraction at 40 s and
 * falls back to the blank template — Hour-0 progress never blocks. */
export const PROFILE_HARD_CEILING_MS = 40_000;

/** Race `work` against AbortSignal.timeout(ceilingMs); rejects on ceiling hit. */
async function withHardCeiling<T>(work: () => Promise<T>, ceilingMs: number): Promise<T> {
  const signal = AbortSignal.timeout(ceilingMs); // fires automatically; nothing to clear
  const ceiling = new Promise<never>((_, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new Error(`profile hard ceiling (${ceilingMs}ms) exceeded — falling back to blank template`)),
      { once: true },
    );
  });
  return Promise.race([work(), ceiling]);
}

/** Consumer read path (DP-L §9.1 index exports): parse + RES-04 validate.
 * Throws on unreadable/malformed/schema-invalid files — consumers apply their
 * own RES rules around this advisory input; silent bad data is worse. */
export function readEventProfile(path: string): EventProfile {
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`event profile not valid JSON at ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const result = validate(eventProfileSchema(), parsed);
  if (!result.valid) {
    const first = result.errors[0];
    throw new Error(
      `event profile at ${path} fails contracts/event-profile.schema.json: ${first ? `${first.path} [${first.code}]: ${first.message}` : "unknown error"}`,
    );
  }
  return parsed as EventProfile;
}

/** §8 binary/brief heuristics: NUL byte or fewer than 5 whitespace-separated tokens. */
function assertBriefContent(text: string): void {
  if (text.includes("\u0000")) throw new BriefInsufficientError("brief looks binary (NUL byte present)");
  if (text.split(/\s+/).filter(Boolean).length < 5) {
    throw new BriefInsufficientError("brief has fewer than 5 whitespace-delimited tokens");
  }
}

function writeOrThrow(outPath: string, profile: EventProfile): void {
  try {
    writeAtomically(outPath, profile);
  } catch (err) {
    throw new ProfileWriteError(outPath, err);
  }
}

/**
 * Catch-all CLI driver (§5.1 pseudocode, GOV-RES-04): EVERY failure mode —
 * unreadable/short/binary brief, RES-01 exhaustion, corrupt JSON, failed repair,
 * 40 s hard ceiling — collapses to writing the blank template. NEVER throws
 * except for an UNWRITABLE OUTPUT PATH (ProfileWriteError), which the CLI
 * surfaces with exit 1. Exit status is decided by the CLI layer from the outcome.
 */
export interface ProfileRunOutcome {
  status: "extracted" | "not-extracted";
  outPath: string;
  briefHash: string;
  reason: string | null;
}

export async function runProfileExtractBrief(
  briefPath: string,
  outPath: string,
  deps?: ExtractDeps,
): Promise<ProfileRunOutcome> {
  let hash = "0".repeat(64);
  try {
    let text: string;
    try {
      text = readFileSync(briefPath, "utf8");
      hash = sha256Hex(text);
    } catch (readErr) {
      throw new Error(`brief unreadable: ${readErr instanceof Error ? readErr.message : String(readErr)}`);
    }
    if (text.trim().length < 20) throw new BriefInsufficientError("brief empty or severely short");
    assertBriefContent(text); // NUL byte / <5 tokens → no LLM call (PROFILE-RES-02)
    try {
      // Hard ceiling wraps ONLY the extraction (PROFILE-03); fallback writes stay under it.
      const profile = await withHardCeiling(() => extractEventProfile(text, hash, deps), PROFILE_HARD_CEILING_MS);
      writeOrThrow(outPath, profile); // ProfileWriteError propagates — never mapped to blank
      return { status: profile.extraction_meta.status, outPath, briefHash: hash, reason: null };
    } catch (llmOrValidationError) {
      if (llmOrValidationError instanceof ProfileWriteError) throw llmOrValidationError;
      writeOrThrow(outPath, blankTemplate(hash));
      console.warn(
        `[profile] extraction failed — wrote blank template: ${
          llmOrValidationError instanceof Error ? llmOrValidationError.message : String(llmOrValidationError)
        }`,
      );
      return { status: "not-extracted", outPath, briefHash: hash, reason: "extraction_failed" };
    }
  } catch (briefReadError) {
    if (briefReadError instanceof ProfileWriteError) throw briefReadError;
    writeOrThrow(outPath, blankTemplate(hash));
    console.warn(
      `[profile] brief unreadable — wrote blank template: ${
        briefReadError instanceof Error ? briefReadError.message : String(briefReadError)
      }`,
    );
    const reason =
      briefReadError instanceof BriefInsufficientError ? briefReadError.reason : "brief_unreadable";
    return { status: "not-extracted", outPath, briefHash: hash, reason };
  }
}

//#endregion
