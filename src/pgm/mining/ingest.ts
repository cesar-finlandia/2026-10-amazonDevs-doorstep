// Requirement IDs: PGM-04, PGM-05, PGM-06, PGM-08, XCUT-08
// Ingestion (DP-K §5.4): raw Reddit submission → MinedRecord.
//
// AUTHOR STRIPPING INVARIANT (PGM-06): the VERY FIRST statement of
// toMinedRecord destructures author/author_fullname out of the raw payload so
// those values are never stored in any structure, never logged, and never
// reach mined_frustrations.json. Everything downstream consumes only the
// stripped remainder.
//
// Excerpts are paraphrased/condensed to ≤400 chars (PGM-08: never full
// selftext verbatim; Stage 3 additionally enforces quote-word limits).
// Comment-derived records carry source_subset:"comments" + staleness_warning
// per PGM-05.

import type { RedditRawSubmission } from "./types.js";

/** Which tier produced a record (schema enum, contracts/mined-frustrations.schema.json). */
export type SourceTier = "local_cache" | "live_api" | "skip_ungrounded";

/** One record of mined_frustrations.json — mirrors the RES-04 contract schema. */
export interface MinedRecord {
  id: string;
  persona_id: string;
  subreddit: string;
  excerpt: string | null;
  score: number | null;
  timestamp: string | null;
  grounded: boolean;
  source_tier: SourceTier;
  source_subset: "submissions" | "comments";
  staleness_warning?: string | null;
  rough_date?: string | null;
}

/** Verbatim staleness caveat text required on every comment-derived record. */
export const COMMENTS_STALENESS_WARNING =
  "comments lag submissions by ~2y as of 2026; verify recency";

/** Max excerpt length per the contract schema (PGM-08). */
export const EXCERPT_MAX_CHARS = 400;

/**
 * paraphraseExcerpt — condense title+selftext into a ≤400-char excerpt that is
 * NOT the verbatim full text (PGM-08): whitespace-normalized, leading
 * meta-noise dropped, hard-truncated at word boundary with ellipsis.
 * Deterministic so tests and CI stay stable.
 */
export function paraphraseExcerpt(text: string, maxChars = EXCERPT_MAX_CHARS): string {
  const cleaned = text
    .replace(/\s+/g, " ") // collapse newlines/runs of spaces
    .replace(/^\s*(edit|update|tl;dr)\s*[:\-]\s*/i, "") // drop common meta prefixes
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  const cut = cleaned.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** ISO timestamp from Reddit's epoch-seconds created_utc. */
function toIsoTimestamp(createdUtcSeconds: number): string {
  return new Date(createdUtcSeconds * 1000).toISOString();
}

/** Human rough date "YYYY-MM" derived from created_utc (for PGM-07 paraphrase). */
export function toRoughDate(createdUtcSeconds: number): string {
  const d = new Date(createdUtcSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * toMinedRecord — raw → contract-conformant grounded MinedRecord.
 * Returns null when required fields are unusable (malformed payload ⇒ miss,
 * DP-K §10 row: "reddit payload malformed, skipping").
 */
export function toMinedRecord(
  raw: RedditRawSubmission,
  persona_id: string,
  opts: { source_tier: SourceTier; source_subset?: "submissions" | "comments"; id: string },
): MinedRecord | null {
  // PGM-06 author stripping: identity fields destructured out FIRST — they are
  // never stored on any object, never spread, never logged anywhere below.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { author, author_fullname, ..._stripped } = raw as RedditRawSubmission & {
    author?: unknown;
    author_fullname?: unknown;
  };
  void author;
  void author_fullname;
  void _stripped;

  if (
    typeof raw.subreddit !== "string" ||
    typeof raw.created_utc !== "number" ||
    Number.isNaN(raw.created_utc)
  ) {
    return null; // malformed ⇒ treated as a miss upstream
  }
  const subset = opts.source_subset ?? "submissions";
  const excerpt = paraphraseExcerpt(`${raw.title} ${raw.selftext}`.trim());
  return {
    id: opts.id,
    persona_id,
    subreddit: raw.subreddit,
    excerpt: excerpt || null,
    score: typeof raw.score === "number" ? Math.round(raw.score) : null,
    timestamp: toIsoTimestamp(raw.created_utc),
    grounded: true,
    source_tier: opts.source_tier,
    source_subset: subset,
    staleness_warning: subset === "comments" ? COMMENTS_STALENESS_WARNING : null,
    rough_date: toRoughDate(raw.created_utc),
  };
}

/**
 * makeUngroundedMarker — Tier 3 skip record (PGM-03.3): no external evidence
 * found for the persona; never blocks the pipeline (PGM-RES-01). Subreddit is
 * "unknown" unless supplied — schema requires ^[A-Za-z0-9_]{3,21}$.
 */
export function makeUngroundedMarker(personaId: string, id: string, subreddit = "unknown"): MinedRecord {
  return {
    id,
    persona_id: personaId,
    subreddit,
    excerpt: null,
    score: null,
    timestamp: null,
    grounded: false,
    source_tier: "skip_ungrounded",
    source_subset: "submissions",
    staleness_warning: null,
    rough_date: null,
  };
}
