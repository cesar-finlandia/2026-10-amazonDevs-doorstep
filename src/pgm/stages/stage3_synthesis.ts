// Requirement IDs: PGM-07, PGM-08, PGM-13, IDEA-02, PGM-REU-01, PGM-10,
// RES-01, RES-04, RES-06, XCUT-08
// Stage 3 Pitch Synthesis (DP-K §6): personas.json + mined_frustrations.json +
// hackathon brief → pitch_candidates.json (+ human render pitch_candidates.md)
// via ONE pgm_synthesizer LLM call routed through resilientCall (the only
// src/pgm path to src/resilience — PGM-10).
//
// Flow per DP-K §6:
//   input_mined_hash = sha256(mined_frustrations.json)  — traceability PGM-13
//   render synthesis.template.md with {{evidence}}/{{brief}}/{{count}}
//     (PGM-REU-01: domain-free template, domain enters at runtime only)
//   ONE callValidatedRole(pgm_synthesizer, …) wrapped by resilientCall
//     {timeout_ms:30000, retries:1} — RES-04 schema check against
//     contracts/pitch-candidates.schema.json with one repair round-trip;
//     failure → DegradedResult{reason:"stage3_synthesis_failed"} +
//     pitch_candidates.partial.md when anything was salvageable (RES-06).
//   Ungrounded inputs still synthesize (PGM-03 tier 3): supporting_evidence
//     becomes "No external grounding — market validation required manually
//     (IDEA-01/03)" with grounded:false on every such candidate.
//   sanitizeQuotes() post-process enforces PGM-08: fragment ≤ max_quote_words
//     (25) / ≤180 chars, r/<subreddit>-only attribution, no @username/u/
//     pattern, Jaccard n-gram similarity vs source excerpt <0.6 else
//     truncate/re-paraphrase + flag.
// Evidence attribution invariant: always {subreddit, rough_date YYYY-MM,
// paraphrase} — never full timestamp, never permalink, never username.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  isDegradedResult,
  renderRepairPrompt,
  validate,
  type DegradedResult,
  type ValidationError,
} from "../../resilience/index.js";
import { callLlmForRole, type RoleCallOptions } from "../resilientCall.js";
import { renderTemplate } from "./stage1_deconstruction.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
export const PITCH_SCHEMA_PATH = join(REPO_ROOT, "contracts", "pitch-candidates.schema.json");
export const TEMPLATE_PATH = join(REPO_ROOT, "src", "pgm", "prompts", "synthesis.template.md");

//#region Config slices (contracts/pgm-config.schema.json pgm.candidates.*)

export interface CandidatesConfig {
  count?: number;
  max_quote_words?: number;
  paraphrase_max_chars?: number;
}

export interface Stage3PgmConfig {
  candidates?: CandidatesConfig;
}

//#endregion

//#region Options / outcome

export interface Stage3Options {
  /** mined_frustrations.json path (Stage 2 output). Required unless minedDoc given. */
  inputPath?: string;
  /** Pre-parsed mined document (tests / in-memory pipelines). */
  minedDoc?: unknown;
  /** Raw hackathon brief text path or direct text. */
  briefPath?: string;
  briefText?: string;
  outDir: string;
  config?: Stage3PgmConfig;
  transport?: RoleCallOptions["transport"];
  repairLlm?: RoleCallOptions["repairLlm"];
  /** Override of the DP-K §7.4 default (30000ms) — long-transport runs (sweep). */
  llmTimeoutMs?: number;
}

export type Stage3Outcome =
  | { ok: true; data: unknown }
  | ({ ok: false } & DegradedResult);

/** Validation result used when parsing failed before ajv could run. */
const PARSE_FAILED_CHECK: { valid: false; errors: ValidationError[] } = {
  valid: false,
  errors: [{ path: "/", message: "output was not valid JSON", code: "type" }],
};

interface SalvageDoc {
  candidates?: unknown;
}

/**
 * writeSalvagedPartial — best-effort pitch_candidates.partial.md from a parsed-
 * but-invalid synthesizer document so degraded runs still surface anything
 * salvageable for human triage (DP-K §6 / handout).
 */
function writeSalvagedPartial(outDir: string, parsed: unknown): void {
  const doc = parsed as SalvageDoc | undefined;
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.candidates) || doc.candidates.length === 0) return;
  try {
    const md = renderPitchMarkdown(
      { candidates: doc.candidates, input_mined_hash: "invalid-after-repair" },
      {},
    );
    writeFileSync(join(outDir, "pitch_candidates.partial.md"), md);
  } catch {
    // partial salvage must never mask the degraded result
  }
}

//#endregion

//#region runStage3

/** PGM-08 ungrounded fallback sentence — verbatim per DP-K §6 / handout. */
export const UNGROUNDED_PARAPHRASE =
  "No external grounding — market validation required manually (IDEA-01/03)";

interface MinedRecordLike {
  persona_id?: unknown;
  subreddit?: unknown;
  excerpt?: unknown;
  timestamp?: unknown;
  rough_date?: unknown;
  grounded?: unknown;
  source_subset?: unknown;
}

interface MinedDoc {
  version?: unknown;
  generated_at?: unknown;
  source_brief_hash?: unknown;
  subset?: unknown;
  records?: unknown;
}

function clampRange(n: number, min: number, max: number, dflt: number): number {
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Tolerant JSON extraction: strips optional markdown fences. */
function parseJsonLoose(text: string): unknown {
  const stripped = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  return JSON.parse(stripped);
}

function degraded(reason: string, originalError: string): Stage3Outcome {
  return {
    ok: false,
    degraded: true,
    reason,
    fallback_source: "none",
    original_error: originalError,
    data: null,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
}

export async function runStage3(opts: Stage3Options): Promise<Stage3Outcome> {
  // 1) Mined input (Stage 2 output) + sha256 traceability hash (PGM-13).
  let rawMined: string;
  let doc: MinedDoc;
  try {
    if (opts.minedDoc !== undefined) {
      rawMined = JSON.stringify(opts.minedDoc);
      doc = opts.minedDoc as MinedDoc;
    } else {
      rawMined = readFileSync(opts.inputPath as string, "utf8");
      doc = JSON.parse(rawMined) as MinedDoc;
    }
  } catch (err) {
    return degraded("input_unreadable", `cannot read mined_frustrations input: ${(err as Error).message}`);
  }
  const inputMinedHash = createHash("sha256").update(rawMined, "utf8").digest("hex");

  // 2) Brief — raw free text (PGM-01); Stage 3 cannot score rubrics without it.
  let briefText: string;
  try {
    briefText = opts.briefText ?? readFileSync(opts.briefPath as string, "utf8");
  } catch (err) {
    return degraded("brief_unreadable", `cannot read hackathon brief: ${(err as Error).message}`);
  }

  mkdirSync(opts.outDir, { recursive: true });

  // 3) Config knobs (pgm.candidates.* per DP-K §6 table; defaults 10/25/600).
  const cand = opts.config?.candidates ?? {};
  const count = clampRange(Number(cand.count), 3, 20, 10);
  const maxQuoteWords = clampRange(Number(cand.max_quote_words), 10, 30, 25);
  const paraphraseMaxChars = clampRange(Number(cand.paraphrase_max_chars), 200, 800, 600);

  // 4) Evidence digest lines ({persona_id, subreddit, rough_date, excerpt,
  //    grounded} only) + per-persona source map for sanitizeQuotes + staleness.
  const records = Array.isArray(doc.records) ? (doc.records as MinedRecordLike[]) : [];
  const sourcesByPersona = new Map<string, EvidenceSourceLike[]>();
  const stalePersonaIds = new Set<string>();
  const evidenceLines: string[] = [];
  for (const r of records) {
    const pid = typeof r.persona_id === "string" ? r.persona_id : "persona-00";
    const list = sourcesByPersona.get(pid) ?? [];
    list.push(r);
    sourcesByPersona.set(pid, list);
    if (r.source_subset === "comments") stalePersonaIds.add(pid);
    const roughDate =
      typeof r.rough_date === "string"
        ? r.rough_date
        : typeof r.timestamp === "string" && /^\d{4}-\d{2}/.test(r.timestamp)
          ? r.timestamp.slice(0, 7)
          : null;
    evidenceLines.push(
      JSON.stringify({
        persona_id: pid,
        subreddit: typeof r.subreddit === "string" ? r.subreddit : null,
        rough_date: roughDate,
        excerpt: typeof r.excerpt === "string" ? r.excerpt : null,
        grounded: r.grounded === true,
      }),
    );
  }

  // 5) Render the domain-free template (PGM-REU-01) and fire the ONE
  //    pgm_synthesizer call through resilientCall {timeout_ms:30000, retries:1}.
  const prompt = renderTemplate(readFileSync(TEMPLATE_PATH, "utf8"), {
    evidence: evidenceLines.join("\n") || '(no evidence records)',
    brief: briefText,
    count: String(count),
  });
  const schema = JSON.parse(readFileSync(PITCH_SCHEMA_PATH, "utf8")) as object;
  const callOpts = {
    transport: opts.transport,
    timeoutMs: opts.llmTimeoutMs ?? 30000,
    retries: 1,
  } satisfies RoleCallOptions;

  const first = await callLlmForRole("pgm_synthesizer", prompt, callOpts);
  if (!first.ok) {
    return degraded("stage3_synthesis_failed", first.original_error ?? "synthesizer call failed");
  }

  // 6) Canonicalize: traceability fields are ours, never trusted from the
  //    model — then RES-04 gate; EXACTLY ONE repair round-trip on failure.
  const briefHash =
    typeof doc.source_brief_hash === "string" && /^[a-f0-9]{64}$/.test(doc.source_brief_hash)
      ? doc.source_brief_hash
      : createHash("sha256").update(briefText, "utf8").digest("hex");
  const canonicalize = (rawParsed: unknown): Array<Record<string, unknown>> => {
    const cands = (rawParsed as SalvageDoc | null)?.candidates;
    return Array.isArray(cands) ? (cands as Array<Record<string, unknown>>) : [];
  };
  let parsed: unknown;
  let check: { valid: boolean; errors: ValidationError[] } = PARSE_FAILED_CHECK;
  let firstText = first.data;
  try {
    parsed = parseJsonLoose(firstText);
    check = validate(schema, {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      source_brief_hash: briefHash,
      input_mined_hash: inputMinedHash,
      candidates: canonicalize(parsed),
    });
  } catch {
    check = PARSE_FAILED_CHECK;
  }
  if (!check.valid) {
    const repairLlm = opts.repairLlm ?? opts.transport;
    if (!repairLlm) {
      writeSalvagedPartial(opts.outDir, parsed);
      return degraded("stage3_synthesis_failed", "synthesizer output failed RES-04 and no repair LLM available");
    }
    const repairPrompt = renderRepairPrompt(check.errors, firstText);
    const second = await callLlmForRole("pgm_synthesizer", repairPrompt, {
      transport: repairLlm,
      timeoutMs: opts.llmTimeoutMs ?? 30000,
      retries: 1,
    });
    let repaired: unknown;
    let check2: { valid: boolean; errors: ValidationError[] } = PARSE_FAILED_CHECK;
    if (second.ok) {
      try {
        repaired = parseJsonLoose(second.data);
        check2 = validate(schema, {
          version: "1.0.0",
          generated_at: new Date().toISOString(),
          source_brief_hash: briefHash,
          input_mined_hash: inputMinedHash,
          candidates: canonicalize(repaired),
        });
      } catch {
        check2 = PARSE_FAILED_CHECK;
      }
      if (check2.valid) {
        parsed = repaired;
        check = check2;
      }
    }
    if (!check.valid) {
      writeSalvagedPartial(opts.outDir, parsed);
      return degraded(
        "stage3_synthesis_failed",
        `pitch_candidates failed RES-04 after repair: ${check.errors.map((e) => `${e.path} ${e.message}`).join("; ")}`,
      );
    }
  }

  // 7) Candidates from the RES-04-validated document (raw or repaired output).
  const rawCandidates = canonicalize(parsed);

  // 8) Ungrounded enforcement (PGM-03 tier 3 still synthesizes — DP-K §6):
  //    a candidate whose persona had NO grounded mined record is forced to
  //    grounded:false with subreddit/rough_date null and the canonical
  //    ungrounded paraphrase; illustrative_quote must be null.
  const personaHasGrounded = new Map<string, boolean>();
  for (const r of records) {
    const pid = typeof r.persona_id === "string" ? r.persona_id : "persona-00";
    if (r.grounded === true) personaHasGrounded.set(pid, true);
  }
  for (const c of rawCandidates) {
    const ev = (c.supporting_evidence ?? {}) as Record<string, unknown>;
    const pid = typeof c.persona_id === "string" ? c.persona_id : "persona-00";
    if (personaHasGrounded.get(pid) !== true || ev.grounded === false) {
      c.grounded = false;
      c.supporting_evidence = {
        subreddit: null,
        rough_date: null,
        paraphrase: UNGROUNDED_PARAPHRASE,
        grounded: false,
      };
      c.illustrative_quote = null;
    }
    // Paraphrase length clamp (pgm.candidates.paraphrase_max_chars).
    if (typeof ev.paraphrase === "string" && ev.paraphrase.length > paraphraseMaxChars) {
      ev.paraphrase = ev.paraphrase.slice(0, paraphraseMaxChars - 1).trimEnd() + "…";
    }
  }

  // 9) PGM-08 post-process: quote length / attribution / similarity guards.
  sanitizeQuotes(rawCandidates, { maxQuoteWords, sourcesByPersona });

  const out = {
    version: "1.0.0" as const,
    generated_at: new Date().toISOString(),
    source_brief_hash: briefHash,
    input_mined_hash: inputMinedHash,
    candidates: rawCandidates,
  };

  // 10) Final RES-04 gate BEFORE write (sanitize/canonicalize may not regress).
  const finalCheck = validate(schema, out);
  if (!finalCheck.valid) {
    writeSalvagedPartial(opts.outDir, out);
    return degraded(
      "stage3_synthesis_failed",
      `pitch_candidates failed final RES-04: ${finalCheck.errors.map((e) => `${e.path} ${e.message}`).join("; ")}`,
    );
  }

  // 11) Write JSON + human markdown render of the SAME validated data + manifest.
  const commentsEnabled = doc.subset === "submissions+comments";
  writeFileSync(join(opts.outDir, "pitch_candidates.json"), JSON.stringify(out, null, 2) + "\n");
  writeFileSync(
    join(opts.outDir, "pitch_candidates.md"),
    renderPitchMarkdown(out, { commentsEnabled, stalePersonaIds }),
  );
  writeFileSync(
    join(opts.outDir, "run.json"),
    JSON.stringify(
      {
        module: "pgm",
        stage: 3,
        status: "stage3_complete",
        flags: { comments_enabled: commentsEnabled },
        grounded_count: rawCandidates.filter((c) => c.grounded === true).length,
        ungrounded_count: rawCandidates.filter((c) => c.grounded !== true).length,
        input_mined_hash: inputMinedHash,
        generated_at: out.generated_at,
      },
      null,
      2,
    ) + "\n",
  );
  return { ok: true, data: out };
}

//#endregion

//#region sanitizeQuotes + PGM-08 helpers

export interface SanitizeStats {
  truncated: number;
  usernameRejected: number;
  similarityFlagged: number;
}

/** Word count on whitespace-split tokens. */
function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/** Lowercased character n-gram set for Jaccard similarity. */
function ngrams(text: string, n: number): Set<string> {
  const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (let i = 0; i + n <= norm.length; i++) out.add(norm.slice(i, i + n));
  return out;
}

/** Jaccard similarity of two strings over character 8-grams (DP-K §6 table). */
export function jaccardSimilarity(a: string, b: string, n = 8): number {
  const ga = ngrams(a, n);
  const gb = ngrams(b, n);
  if (ga.size === 0 || gb.size === 0) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  return inter / (ga.size + gb.size - inter);
}

const USERNAME_PATTERN = /(^|[^\w])@[A-Za-z0-9_-]{2,}|(^|[^\w])u\/[A-Za-z0-9_-]{2,}/i;

/** Hard-truncate a fragment to maxWords words without splitting mid-token. */
function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

interface QuoteLike {
  fragment?: unknown;
  subreddit?: unknown;
}

interface EvidenceSourceLike {
  excerpt?: unknown; // mined record source text for similarity comparison
}

/**
 * sanitizeQuotes — PGM-08 post-processor (DP-K §6 prohibition table):
 *   - fragment ≤ max_quote_words (default 25) AND ≤180 chars → else truncate;
 *   - attribution subreddit-only: reject quotes carrying an @username / u/
 *     pattern (drop the quote rather than ship a PII violation);
 *   - Jaccard n-gram similarity vs the mined source excerpt must stay <0.6,
 *     else the fragment is re-truncated harder and flagged.
 * Mutates candidates in place; returns stats for the run manifest.
 */
export function sanitizeQuotes(
  candidates: Array<Record<string, unknown>>,
  opts: { maxQuoteWords?: number; sourcesByPersona?: Map<string, EvidenceSourceLike[]> } = {},
): SanitizeStats {
  const maxWords = Math.max(1, Math.round(opts.maxQuoteWords ?? 25));
  const stats: SanitizeStats = { truncated: 0, usernameRejected: 0, similarityFlagged: 0 };
  for (const cand of candidates) {
    const quote = cand.illustrative_quote as QuoteLike | null | undefined;
    if (!quote || typeof quote !== "object" || Array.isArray(quote)) continue;
    const fragment = typeof quote.fragment === "string" ? quote.fragment : "";
    if (!fragment.trim()) {
      cand.illustrative_quote = null;
      continue;
    }
    if (USERNAME_PATTERN.test(fragment)) {
      // Attribution must be r/<subreddit> only — a quote embedding an @username
      // or u/ handle violates PGM-06/08; drop the whole quote.
      cand.illustrative_quote = null;
      stats.usernameRejected += 1;
      continue;
    }
    let cleaned = truncateToWords(fragment, maxWords);
    if (cleaned.length > 180) cleaned = cleaned.slice(0, 177).trimEnd() + "…";
    const personaId = typeof cand.persona_id === "string" ? cand.persona_id : "";
    const sources = opts.sourcesByPersona?.get(personaId) ?? [];
    for (const src of sources) {
      const excerpt = typeof src.excerpt === "string" ? src.excerpt : "";
      if (excerpt && jaccardSimilarity(cleaned, excerpt) >= 0.6) {
        // Too close to verbatim — re-paraphrase guard: hard truncation lowers
        // the shared n-gram mass; flag it either way (DP-K §6).
        stats.similarityFlagged += 1;
        let retry = truncateToWords(cleaned, Math.max(5, Math.floor(maxWords / 2)));
        if (retry.length > 180) retry = retry.slice(0, 177).trimEnd() + "…";
        cleaned = retry;
        break;
      }
    }
    if (cleaned !== fragment) stats.truncated += 1;
    quote.fragment = cleaned;
  }
  return stats;
}

//#endregion

//#region Markdown renderer (pitch_candidates.md — human view of the same JSON)

interface EvidenceLike {
  subreddit?: unknown;
  rough_date?: unknown;
  paraphrase?: unknown;
  grounded?: unknown;
}

interface CandidateLike {
  id?: unknown;
  persona_id?: unknown;
  persona_name?: unknown;
  supporting_evidence?: unknown;
  problem_framing?: unknown;
  ai_solution?: unknown;
  why_now?: unknown;
  predictability_note?: unknown;
  rubric_alignment_score?: unknown;
  grounded?: unknown;
  illustrative_quote?: unknown;
  depth?: unknown;
}

interface DepthLike {
  necessity_thesis?: unknown;
  real_input?: unknown;
  truth_engine?: unknown;
  agent_workflow?: unknown;
  hero_3d?: unknown;
  novelty?: unknown;
}

function s(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * renderPitchMarkdown — §6 human render of the validated JSON. Same data,
 * never more: heading with counts, per-candidate block with grounded ✓ /
 * ungrounded ⚠️ badge and ⚠️ staleness badge on comment-derived evidence when
 * include_comments was on.
 */
export function renderPitchMarkdown(
  doc: { candidates?: unknown; input_mined_hash?: unknown },
  opts: { commentsEnabled?: boolean; stalePersonaIds?: Set<string> } = {},
): string {
  const candidates = Array.isArray(doc.candidates) ? (doc.candidates as CandidateLike[]) : [];
  const total = candidates.length;
  const groundedCount = candidates.filter((c) => c.grounded === true).length;
  const lines: string[] = [];
  lines.push(`# Pitch Candidates — ${total} candidates (grounded ${groundedCount}/${total})`);
  lines.push("");
  for (const c of candidates) {
    const ev = (c.supporting_evidence ?? {}) as EvidenceLike;
    const grounded = c.grounded === true;
    const sub = typeof ev.subreddit === "string" ? `r/${ev.subreddit}` : "—";
    const date = typeof ev.rough_date === "string" ? ev.rough_date : "—";
    const score = typeof c.rubric_alignment_score === "number" ? c.rubric_alignment_score.toFixed(1) : "—";
    const badge = grounded ? "grounded ✓" : "ungrounded ⚠️ — no external evidence, market validation required";
    lines.push(
      `## ${s(c.id, "pitch-??")} — ${s(c.persona_name, "untitled persona")} (persona: ${s(c.persona_id)}, ${sub}, ${date}) — ${badge} — score ${score}`,
    );
    lines.push(`- **Problem:** ${s(c.problem_framing)}`);
    lines.push(`- **AI solution:** ${s(c.ai_solution)}`);
    lines.push(`- **Why now:** ${s(c.why_now)} (IDEA-02 filter)`);
    lines.push(
      `- **Evidence (paraphrased):** ${sub}, ${date} — ${s(ev.paraphrase, "(no evidence)")}${ev.grounded === false ? " *(never full verbatim)*" : ""}`,
    );
    if (opts.commentsEnabled && opts.stalePersonaIds?.has(s(c.persona_id))) {
      lines.push(`- ⚠️ **Staleness:** comment-derived evidence may lag the live discussion — recheck before final pitch`);
    }
    const quote = (c.illustrative_quote ?? null) as QuoteLike | null;
    if (quote && typeof quote.fragment === "string") {
      lines.push(`- **Illustrative quote:** "${quote.fragment}" — r/${s(quote.subreddit, "unknown")} (≤25 words, subreddit only)`);
    } else {
      lines.push(`- **Illustrative quote:** none`);
    }
    lines.push(`- **Predictability:** ${s(c.predictability_note)} (does not replace IDEA-03 manual gallery scan)`);
    // DEPTH-01 (templates/product-depth.spec.md): rendered only when present, so older files are unchanged.
    const depth = (c.depth ?? null) as DepthLike | null;
    if (depth && typeof depth === "object") {
      lines.push(`- **Thesis:** ${s(depth.necessity_thesis, "—")}`);
      lines.push(`- **Real input:** ${s(depth.real_input, "—")}`);
      lines.push(`- **Truth engine:** ${s(depth.truth_engine, "—")}`);
      lines.push(`- **Agent workflow:** ${s(depth.agent_workflow, "—")}`);
      lines.push(`- **Signature 3D:** ${s(depth.hero_3d, "—")}`);
      lines.push(`- **Novelty:** ${s(depth.novelty, "—")}`);
    }
    lines.push("");
  }
  lines.push(
    `<!-- traceability: input_mined_hash=${s(doc.input_mined_hash, "none")} | requirement IDs: PGM-07 PGM-08 IDEA-02 -->`,
  );
  return lines.join("\n") + "\n";
}

//#endregion
