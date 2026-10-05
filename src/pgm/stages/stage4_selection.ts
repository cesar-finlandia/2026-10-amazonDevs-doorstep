// Requirement IDs: PGM-09, PGM-08, IDEA-02, NONGOAL-02, NONGOAL-12, PGM-REU-01,
// PGM-10, PGM-11, RES-01, RES-04, RES-06, XCUT-08
// Stage 4 Strategic Selection (DP-K §7): pitch_candidates.json + hackathon brief
// + component catalog → winning_project_plan.md via ONE pgm_selector strong-model
// call routed through resilientCall (the only src/pgm path to src/resilience —
// PGM-10), {timeout_ms:45000, retries:1} per §7.4.
//
// Flow per DP-K §7:
//   source_brief_hash = sha256(brief) — traceability, never trusted from model
//   render selection.template.md with {{brief}}/{{catalog}}/{{candidates}}/
//     {{event_profile}} (PGM-REU-01: domain-free template)
//   candidates rendered as compact JSON array {id, persona, problem,
//     ai_solution, why_now, predictability_note, score, grounded} (§7.1)
//   ONE callLlmForRole("pgm_selector", …) — a single strong-model call, NOT an
//     ensemble (PGM-09).
//   Parse YAML frontmatter + body; canonicalize traceability fields
//     (created_at/source_brief_hash/version are OURS); RES-04 validate against
//     contracts/winning-plan-frontmatter.schema.json with EXACTLY ONE repair
//     round-trip; failure → DegradedResult{reason:"stage4_selection_failed"}
//     and NO winning_project_plan.md is written (RES-06).
//   Structural gate: the 8 frozen body headings in order (§7.2), no u/<username>
//     pattern (PGM-08), quoted fragments ≤25 words, and the NONGOAL-12 manifest-
//     leak guard ("manifest_version" / "included": / components[] must not appear
//     — advisory prose never carries AssemblyManifest shape).
//   Output: <outDir>/winning_project_plan.md (+ run.json stage manifest).
//   PGM output is advisory input for ADV-01 (winning_plan_path); ADV stays the
//   exclusive manifest authority.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  renderRepairPrompt,
  validate,
  type ValidationError,
} from "../../resilience/index.js";
import { callLlmForRole, type RoleCallOptions } from "../resilientCall.js";
import { renderTemplate } from "./stage1_deconstruction.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
export const FRONTMATTER_SCHEMA_PATH = join(
  REPO_ROOT,
  "contracts",
  "winning-plan-frontmatter.schema.json",
);
export const CATALOG_PATH = join(REPO_ROOT, "contracts", "component-catalog.json");
export const TEMPLATE_PATH = join(REPO_ROOT, "src", "pgm", "prompts", "selection.template.md");

//#region Frozen contract constants (DP-K §7.2)

/** The 8 frozen body headings, in order — adding one is a MINOR bump upstream. */
export const FROZEN_BODY_HEADINGS = [
  "## Executive Pitch",
  "## Problem Framing",
  "## AI Solution",
  "## Why Now",
  "## Target Persona",
  "## Business Value",
  "## Architecture",
  "## Suggested Module Emphasis",
] as const;

/** PGM-08: any quoted evidence fragment must stay under this many words. */
export const MAX_QUOTE_WORDS = 25;

//#endregion

//#region Options / outcome

export interface Stage4Options {
  /** pitch_candidates.json path (Stage 3 output). Required unless candidatesDoc given. */
  inputPath?: string;
  /** Pre-parsed Stage 3 document (tests / in-memory pipelines). */
  candidatesDoc?: unknown;
  /** Raw hackathon brief text path or direct text. */
  briefPath?: string;
  briefText?: string;
  /** Component catalog path (defaults to contracts/component-catalog.json). */
  catalogPath?: string;
  catalogText?: string;
  /** Optional event_profile.json path or direct text (PROFILE output). */
  eventProfilePath?: string;
  eventProfileText?: string;
  outDir: string;
  transport?: RoleCallOptions["transport"];
  repairLlm?: RoleCallOptions["repairLlm"];
  /** Override of the DP-K §7.4 default (45000ms) — long-transport runs (sweep). */
  llmTimeoutMs?: number;
}

export type Stage4Outcome =
  | { ok: true; data: Stage4Data }
  | ({ ok: false } & DegradedResultLike);

export interface Stage4Data {
  winner_id: string | null;
  title: string;
  grounded: boolean | null;
  output_path: string;
  source_brief_hash: string;
}

interface DegradedResultLike {
  degraded: true;
  reason: string;
  fallback_source: string;
  original_error: string;
  data: null;
  timestamp: string;
  version: string;
}

//#endregion

//#region Internal helpers

function degraded(reason: string, originalError: string): Stage4Outcome {
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

interface CandidateLike {
  id?: unknown;
  persona_name?: unknown;
  problem_framing?: unknown;
  ai_solution?: unknown;
  why_now?: unknown;
  predictability_note?: unknown;
  rubric_alignment_score?: unknown;
  grounded?: unknown;
  /** DEPTH-01 (templates/product-depth.spec.md) — passed through to the selector when present. */
  depth?: unknown;
}

/**
 * compactCandidates — §7.1 shape: {id, persona, problem, ai_solution, why_now,
 * predictability_note, score, grounded} per candidate, JSON array.
 */
export function compactCandidates(doc: unknown): Array<Record<string, unknown>> {
  const raw = (doc as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(raw)) return [];
  return (raw as CandidateLike[]).map((c) => ({
    id: typeof c.id === "string" ? c.id : null,
    persona: typeof c.persona_name === "string" ? c.persona_name : null,
    problem: typeof c.problem_framing === "string" ? c.problem_framing : null,
    ai_solution: typeof c.ai_solution === "string" ? c.ai_solution : null,
    why_now: typeof c.why_now === "string" ? c.why_now : null,
    predictability_note: typeof c.predictability_note === "string" ? c.predictability_note : null,
    score: typeof c.rubric_alignment_score === "number" ? c.rubric_alignment_score : null,
    grounded: c.grounded === true,
    // DEPTH-01: forwarded only when Stage 3 produced it, so older candidate files keep the §7.1 shape.
    ...(c.depth && typeof c.depth === "object" ? { depth: c.depth } : {}),
  }));
}

/**
 * renderCatalogDigest — {{catalog}} input: one line per component with id,
 * description and env/provider requirements (single source shared with ADV).
 */
export function renderCatalogDigest(catalogText: string): string {
  let doc: { components?: unknown };
  try {
    doc = JSON.parse(catalogText) as { components?: unknown };
  } catch {
    return catalogText; // tolerate pre-rendered text digests
  }
  const comps = Array.isArray(doc.components) ? doc.components : [];
  const lines = (comps as Array<Record<string, unknown>>).map((c) => {
    const id = typeof c.id === "string" ? c.id : "?";
    const desc = typeof c.description === "string" ? c.description : "";
    const reqs: string[] = [];
    if (Array.isArray(c.requires_env) && c.requires_env.length) reqs.push(`env:${(c.requires_env as unknown[]).join(",")}`);
    if (Array.isArray(c.requires_providers) && c.requires_providers.length) reqs.push(`providers:${(c.requires_providers as unknown[]).join(",")}`);
    return `- ${id}: ${desc}${reqs.length ? ` [${reqs.join("; ")}]` : ""}`;
  });
  return lines.join("\n") || catalogText;
}

/** Split a model markdown response into frontmatter text + body. */
export function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text.trim());
  if (!m || m[1] === undefined || m[2] === undefined) return { frontmatter: null, body: text.trim() };
  return { frontmatter: m[1], body: m[2].trim() };
}

/** Tolerant YAML-subset parser for the frozen frontmatter field set. */
export function parseFrontmatterYaml(fm: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of fm.split(/\r?\n/)) {
    const kv = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1] ?? "";
    let valueText = (kv[2] ?? "").trim();
    // strip trailing comments outside quotes
    if (valueText.startsWith('"') || valueText.startsWith("'")) {
      const q = valueText.charAt(0);
      const end = valueText.indexOf(q, 1);
      if (end > 0) valueText = valueText.slice(0, end + 1);
    } else {
      const hash = valueText.indexOf(" #");
      if (hash >= 0) valueText = valueText.slice(0, hash).trim();
    }
    if (valueText.startsWith("[") && valueText.endsWith("]")) {
      const inner = valueText.slice(1, -1).trim();
      out[key] = inner === ""
        ? []
        : inner.split(",").map((item) => stripQuotes(item.trim()));
    } else if (valueText === "true") {
      out[key] = true;
    } else if (valueText === "false") {
      out[key] = false;
    } else {
      out[key] = stripQuotes(valueText);
    }
  }
  return out;
}

/** Strip one pair of matching surrounding double or single quotes. */
function stripQuotes(text: string): string {
  if (text.length >= 2) {
    const first = text.charAt(0);
    const last = text.charAt(text.length - 1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return text.slice(1, -1);
    }
  }
  return text;
}

/**
 * unwrapJsonEnvelope — models sometimes wrap the markdown plan in a JSON
 * envelope ({title, persona, sponsor_tracks, grounded, body:"..."}) instead of
 * emitting the raw file content. Normalize such payloads back to what the gate
 * expects: YAML frontmatter reconstructed from the envelope's scalar/array
 * fields + the body verbatim. Anything not starting with "{" passes through.
 */
export function unwrapJsonEnvelope(text: string): string {
  const t = text.trim();
  if (!t.startsWith("{")) return t;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(t) as Record<string, unknown>;
  } catch {
    return t;
  }
  if (!obj || typeof obj.body !== "string") return t;
  const body = obj.body.trim();
  if (body.startsWith("---")) return body; // full document inside the envelope
  const fmLines: string[] = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "body") continue;
    if (typeof v === "string") fmLines.push(`${k}: ${JSON.stringify(v)}`);
    else if (typeof v === "boolean" || typeof v === "number") fmLines.push(`${k}: ${String(v)}`);
    else if (Array.isArray(v)) {
      fmLines.push(`${k}: [${v.map((x) => JSON.stringify(String(x))).join(", ")}]`);
    }
  }
  if (fmLines.length <= 1) return t; // envelope carried nothing usable
  fmLines.push("---", "");
  return `${fmLines.join("\n")}\n${body}`;
}

/** Normalize a heading for tolerant matching: collapse whitespace, drop
 *  trailing punctuation models like to add ("Why Now?", "Architecture:"). */
function normalizeHeading(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[?!:.;,]+$/g, "")
    .trim();
}

/**
 * All 8 frozen headings present AND in order → [] else ValidationError list.
 * Matching is line-based over `##` headings with trailing-punctuation
 * tolerance — models routinely emit "## Why Now?" / "## Architecture:".
 */
export function checkHeadings(body: string): ValidationError[] {
  // Frozen entries are stored WITH their "## " prefix; compare like-for-like
  // over every markdown heading line, punctuation-tolerantly.
  const found = body
    .split(/\r?\n/)
    .filter((l) => /^#{1,6}\s/.test(l))
    .map((l) => normalizeHeading(l));
  let cursor = -1;
  for (const heading of FROZEN_BODY_HEADINGS) {
    const norm = normalizeHeading(heading);
    let at = -1;
    for (let i = cursor + 1; i < found.length; i++) {
      if (found[i] === norm || found[i]?.startsWith(norm + " ") || found[i]?.startsWith(norm + ":")) {
        at = i;
        break;
      }
    }
    if (at < 0) {
      const remaining = FROZEN_BODY_HEADINGS.slice(FROZEN_BODY_HEADINGS.indexOf(heading)).join(" · ");
      return [{
        path: "/body",
        message: `frozen heading missing or out of order: ${heading} (expected from here on: ${remaining})`,
        code: "required",
      }];
    }
    cursor = at;
  }
  return [];
}

/** PGM-08: no u/<username> handle anywhere in the body. */
export function findUsernameLeak(body: string): ValidationError[] {
  return /\bu\/[A-Za-z0-9_-]{2,}/.test(body)
    ? [{ path: "/body", message: "u/<username> attribution is forbidden (PGM-08)", code: "pattern" }]
    : [];
}

/** PGM-08: every double-quoted span stays ≤ MAX_QUOTE_WORDS words. */
export function findOverlongQuotes(body: string): ValidationError[] {
  for (const m of body.matchAll(/\"([^\"\n]+)\"/g)) {
    const quoted = m[1] ?? "";
    const words = quoted.trim().split(/\s+/).filter(Boolean).length;
    if (words > MAX_QUOTE_WORDS) {
      return [{
        path: "/body",
        message: `quoted fragment exceeds ${MAX_QUOTE_WORDS} words (PGM-08): \"${quoted.slice(0, 60)}…\"`,
        code: "maxLength",
      }];
    }
  }
  return [];
}

/**
 * NONGOAL-12 manifest-leak guard: advisory prose must never carry
 * AssemblyManifest shape (manifest_version / "included": / components[]).
 */
export function findManifestLeaks(text: string): string[] {
  const leaks: string[] = [];
  if (/manifest_version/.test(text)) leaks.push("manifest_version");
  if (/\"included\"\s*:/.test(text)) leaks.push('\"included\":');
  if (/components\s*\[/.test(text)) leaks.push("components[]");
  return leaks;
}

//#endregion

//#region runStage4

export async function runStage4(opts: Stage4Options): Promise<Stage4Outcome> {
  // 1) Candidates (Stage 3 output). No canonicalization beyond compaction:
  //    Stage 3 already RES-04-gated this document against its own schema.
  let candidatesDoc: unknown;
  try {
    candidatesDoc = opts.candidatesDoc ?? JSON.parse(readFileSync(opts.inputPath as string, "utf8"));
  } catch (err) {
    return degraded("input_unreadable", `cannot read pitch_candidates input: ${(err as Error).message}`);
  }
  const candidates = compactCandidates(candidatesDoc);
  if (candidates.length === 0) {
    return degraded("input_invalid", "pitch_candidates input contains no candidates");
  }

  // 2) Brief + catalog (+ optional event profile); sha256 traceability hash.
  let briefText: string;
  try {
    briefText = opts.briefText ?? readFileSync(opts.briefPath as string, "utf8");
  } catch (err) {
    return degraded("brief_unreadable", `cannot read hackathon brief: ${(err as Error).message}`);
  }
  let catalogText: string;
  try {
    catalogText = opts.catalogText ?? readFileSync(opts.catalogPath ?? CATALOG_PATH, "utf8");
  } catch (err) {
    return degraded("catalog_unreadable", `cannot read component catalog: ${(err as Error).message}`);
  }
  let eventProfileText = opts.eventProfileText ?? null;
  if (eventProfileText === null && opts.eventProfilePath) {
    try {
      eventProfileText = readFileSync(opts.eventProfilePath, "utf8");
    } catch {
      eventProfileText = null; // optional input — absence is not an error
    }
  }
  const sourceBriefHash = createHash("sha256").update(briefText, "utf8").digest("hex");

  mkdirSync(opts.outDir, { recursive: true });

  // 3) Render the domain-free template (PGM-REU-01) and fire the ONE
  //    pgm_selector strong-model call through resilientCall {45000ms, 1 retry}.
  const prompt = renderTemplate(readFileSync(TEMPLATE_PATH, "utf8"), {
    brief: briefText,
    catalog: renderCatalogDigest(catalogText),
    candidates: JSON.stringify(candidates),
    event_profile: eventProfileText ?? "(no event profile — PROFILE stage has not run)",
  });
  const callOpts = {
    transport: opts.transport,
    timeoutMs: opts.llmTimeoutMs ?? 45000,
    retries: 1,
  } satisfies RoleCallOptions;

  const first = await callLlmForRole("pgm_selector", prompt, callOpts);
  if (!first.ok) {
    return degraded("stage4_selection_failed", first.original_error ?? "selector call failed");
  }

  // 4) Gate the response: frontmatter RES-04 + structural checks. Traceability
  //    fields are OURS, never trusted from the model.
  const schema = JSON.parse(readFileSync(FRONTMATTER_SCHEMA_PATH, "utf8")) as object;

  interface GateResult {
    errors: ValidationError[];
    title: string;
    grounded: boolean | null;
    winnerId: string | null;
  }
  const gate = (rawText: string): GateResult => {
    const errors: ValidationError[] = [];
    const { frontmatter, body } = splitFrontmatter(rawText);
    if (frontmatter === null) {
      errors.push({ path: "/", message: "output has no --- delimited YAML frontmatter block", code: "required" });
      return { errors, title: "", grounded: null, winnerId: null };
    }
    const fmRaw = parseFrontmatterYaml(frontmatter);
    const fm: Record<string, unknown> = {
      ...fmRaw,
      created_at: new Date().toISOString(),
      source_brief_hash: sourceBriefHash,
      version: "1.0.0",
    };
    const check = validate(schema, fm);
    if (!check.valid) errors.push(...check.errors);
    errors.push(...checkHeadings(body));
    errors.push(...findUsernameLeak(body));
    errors.push(...findOverlongQuotes(body));
    const leaks = findManifestLeaks(rawText);
    for (const leak of leaks) {
      errors.push({
        path: "/",
        message: `NONGOAL-12 manifest leak in advisory prose: ${leak} — rewrite as plain prose`,
        code: "pattern",
      });
    }
    // Winner attribution: first candidate id referenced in the plan body,
    // else the candidate whose persona label appears in the frontmatter persona.
    let winnerId: string | null = null;
    for (const c of candidates) {
      const id = String(c.id ?? "");
      if (id && body.includes(id)) {
        winnerId = id;
        break;
      }
    }
    if (winnerId === null) {
      const fmPersona = String(fm.persona ?? "").toLowerCase();
      for (const c of candidates) {
        const persona = String(c.persona ?? "").toLowerCase();
        if (persona.length >= 3 && fmPersona.includes(persona)) {
          winnerId = String(c.id ?? "") || null;
          break;
        }
      }
    }
    return { errors, title: typeof fm.title === "string" ? fm.title : "", grounded: typeof fm.grounded === "boolean" ? fm.grounded : null, winnerId };
  };

  let outcome = gate(unwrapJsonEnvelope(first.data));
  let finalText = unwrapJsonEnvelope(first.data);

  // 5) EXACTLY ONE repair round-trip on any gate failure (RES-04 / DP-A §6).
  if (outcome.errors.length > 0) {
    const repairLlm = opts.repairLlm ?? opts.transport;
    if (!repairLlm) {
      return degraded("stage4_selection_failed", `selector output failed gate and no repair LLM available: ${summarizeErrors(outcome.errors)}`);
    }
    const second = await callLlmForRole("pgm_selector", renderRepairPrompt(outcome.errors, finalText), {
      transport: repairLlm,
      timeoutMs: opts.llmTimeoutMs ?? 45000,
      retries: 1,
    });
    if (second.ok) {
      const repairedText = unwrapJsonEnvelope(second.data);
      const repaired = gate(repairedText);
      if (repaired.errors.length === 0) {
        outcome = repaired;
        finalText = repairedText;
      } else {
        outcome = repaired;
      }
    }
    if (outcome.errors.length > 0) {
      return degraded("stage4_selection_failed", `winning_project_plan failed gate after repair: ${summarizeErrors(outcome.errors)} — NO file written`);
    }
  }

  // 6) NONGOAL-12 post-write guard: leak patterns must grep to zero; a leaked
  //    file is unlinked again so no bad artifact survives on disk.
  const outputPath = join(opts.outDir, "winning_project_plan.md");
  writeFileSync(outputPath, normalizeFinal(finalText));
  const written = readFileSync(outputPath, "utf8");
  const postLeaks = findManifestLeaks(written);
  if (postLeaks.length > 0) {
    rmSync(outputPath, { force: true });
    return degraded("stage4_selection_failed", `NONGOAL-12 violation after write (${postLeaks.join(", ")}) — file removed`);
  }

  writeFileSync(
    join(opts.outDir, "run.json"),
    JSON.stringify(
      {
        module: "pgm",
        stage: 4,
        status: "stage4_complete",
        winner_id: outcome.winnerId ?? null,
        title: outcome.title,
        grounded: outcome.grounded,
        source_brief_hash: sourceBriefHash,
        nongoal12_leaks: 0,
        generated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  return {
    ok: true,
    data: {
      winner_id: outcome.winnerId,
      title: outcome.title,
      grounded: outcome.grounded,
      output_path: outputPath,
      source_brief_hash: sourceBriefHash,
    },
  };
}

//#endregion

//#region Output shaping

/** Ensure exactly one trailing newline on the emitted plan file. */
function normalizeFinal(text: string): string {
  return `${text.trim()}\n`;
}

function summarizeErrors(errors: ValidationError[]): string {
  return errors.map((e) => `${e.path} ${e.message}`).join("; ");
}

//#endregion
