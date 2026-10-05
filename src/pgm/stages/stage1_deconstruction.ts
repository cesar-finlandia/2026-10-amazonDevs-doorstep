// Requirement IDs: PGM-01, PGM-02, PGM-REU-01, PGM-RES-01, PGM-10, RES-01, RES-04, GOV-RES-02, XCUT-08
// Stage 1 Deconstruction (DP-K §4): hackathon_brief.md + component catalog →
// personas.json via ONE pgm_deconstructor LLM call routed through resilientCall
// (the only src/pgm path to src/resilience — PGM-10).
//
// Flow per DP-K §4.4 gate diagram:
//   brief (raw free text, PGM-01) → sha256 source_brief_hash
//   render deconstruction.template.md with {{brief}}/{{catalog_sponsor_list}}/
//     {{count}}/{{min_sponsor_pair_fraction}} (PGM-REU-01: domain-free template)
//   ONE callValidatedRole(pgm_deconstructor, …) — RES-01 wrap {timeout_ms:20000,
//     retries:1, fallback_chain:["none"]} + RES-04 schema check w/ one repair
//   validatePersonas(): combination-sprint fraction + sponsor-substring checks
//   fraction/schema violation after the gate → EXACTLY ONE semantic repair
//     round-trip; second failure → DegradedResult{reason:"validation_repair_failed",
//     fallback_source:"none"} + personas.partial.json + run manifest
//     status "degraded_stage1" (pipeline halts; human fallback = IDEA-01).
// Malformed brief (empty/binary/<20 chars): warn + brief_insufficient flag,
//   still produces configured count — no crash (GOV-RES-02 / §10 row 2).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isDegradedResult, type DegradedResult } from "../../resilience/index.js";
import { callValidatedRole, type RoleCallOptions } from "../resilientCall.js";

const PGM_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PGM_DIR, "..", "..", "..");
export const PERSONAS_SCHEMA_PATH = join(REPO_ROOT, "contracts", "pgm-personas.schema.json");
export const CATALOG_PATH = join(REPO_ROOT, "contracts", "component-catalog.json");
export const TEMPLATE_PATH = join(PGM_DIR, "..", "prompts", "deconstruction.template.md");

/** Minimum viable brief length; shorter ⇒ degraded-flag run (DP-K §10). */
export const MIN_BRIEF_CHARS = 20;

//#region Placeholder rendering (tiny Mustache-style, mirrors src/data/template.ts)

/** Replace every {{key}} occurrence with vars[key]; unknown keys render empty. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? (vars[key] ?? "") : "",
  );
}

//#endregion

//#region Sponsor-list rendering (PGM-REU-01: domain enters at runtime only)

/**
 * Extract sponsor technology names from the raw brief text (domain-free code:
 * names come from whatever brief is supplied). Heuristic, format-tolerant:
 * inside any section whose heading mentions "sponsor", `- **Name** …` bullets,
 * bare `Name — description` dashes, AND markdown table rows whose first cell
 * carries a bold name (`| **Name** … |`) yield candidate names.
 */
export function extractSponsorNames(briefText: string): string[] {
  const names: string[] = [];
  let inSection = false;
  for (const rawLine of briefText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^#{1,6}\s/.test(line)) {
      inSection = /sponsor/i.test(line);
      continue;
    }
    if (!inSection || !line) continue;
    // Markdown table row (common real-brief layout): first cell's bold text
    // is the partner name — `| **AWS** `[est.]` | Data Centers | … |`.
    if (line.startsWith("|")) {
      const firstCell = line.split("|")[1] ?? "";
      const cellBold = /\*\*([^*]+)\*\*/.exec(firstCell);
      if (cellBold?.[1]) {
        const name = cellBold[1].trim();
        if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
      }
      continue;
    }
    const bold = /^[-*+]\s*\*\*([^*]+)\*\*/.exec(line) ?? /^(.{2,60}?)\s+\u2014\s/.exec(line);
    if (bold && bold[1]) {
      const name = bold[1].trim();
      if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
    }
  }
  return names;
}

/**
 * Render the {{catalog_sponsor_list}} placeholder: an explicit top-level
 * `sponsors` array on contracts/component-catalog.json wins; otherwise the
 * names extracted from the brief itself are surfaced; "(none listed)" when
 * neither exists (template instruction 4 then applies).
 */
export function renderCatalogSponsorList(catalog: unknown, briefText: string): string {
  const top = catalog as { sponsors?: unknown } | null;
  if (top && Array.isArray(top.sponsors)) {
    const listed = top.sponsors.filter((s): s is string => typeof s === "string" && !!s.trim());
    if (listed.length > 0) return listed.join("\n");
  }
  const fromBrief = extractSponsorNames(briefText);
  return fromBrief.length > 0 ? fromBrief.join("\n") : "(none listed)";
}

/** Render src/pgm/prompts/deconstruction.template.md with runtime-only inputs. */
export function renderDeconstructionPrompt(args: {
  briefText: string;
  catalogSponsorList: string;
  count: number;
  minSponsorPairFraction: number;
}): string {
  return renderTemplate(readFileSync(TEMPLATE_PATH, "utf8"), {
    brief: args.briefText,
    catalog_sponsor_list: args.catalogSponsorList,
    count: String(args.count),
    min_sponsor_pair_fraction: String(args.minSponsorPairFraction),
  });
}

//#endregion

//#region Semantic validation — combination-sprint fraction + sponsor substring (DP-K §4)

export interface PersonaSemanticsResult {
  valid: boolean;
  errors: string[];
}

/**
 * validatePersonas — runs AFTER the RES-04 schema gate. Enforces:
 *   - pairedCount/total >= effective fraction (configured; relaxed to ≤0.2 when
 *     the brief lists no sponsors), error text per DP-K §4 verbatim;
 *   - when the brief HAS a sponsor list, every non-null sponsor_tech_name is a
 *     case-insensitive substring of one of those names.
 */
export function validatePersonas(
  doc: { personas?: Array<{ paired_sponsor_tech?: unknown; sponsor_tech_name?: unknown }> },
  opts: { configuredFraction: number; briefSponsorNames: string[] },
): PersonaSemanticsResult {
  const errors: string[] = [];
  const total = Array.isArray(doc.personas) ? doc.personas.length : 0;
  const personas = Array.isArray(doc.personas) ? doc.personas : [];
  if (total < 1) {
    return { valid: false, errors: ["personas array must contain at least one persona"] };
  }
  const briefHasSponsors = opts.briefSponsorNames.length > 0;
  const fraction = briefHasSponsors ? opts.configuredFraction : Math.min(opts.configuredFraction, 0.2);
  let pairedCount = 0;
  for (const p of personas) {
    if (p.paired_sponsor_tech === true && typeof p.sponsor_tech_name === "string" && p.sponsor_tech_name.trim()) {
      pairedCount += 1;
      if (briefHasSponsors) {
        const needle = p.sponsor_tech_name.toLowerCase();
        const ok = opts.briefSponsorNames.some((name) => name.toLowerCase().includes(needle));
        if (!ok) {
          errors.push(
            `sponsor_tech_name "${p.sponsor_tech_name}" does not match any sponsor in the brief's sponsor list`,
          );
        }
      }
    }
  }
  if (pairedCount / total < fraction) {
    const pct = Math.round(fraction * 100);
    errors.push(
      `combination sprint: at least ${pct}% of personas must pair sponsor tech \u00d7 domain`,
    );
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Canonicalize an LLM-produced personas document for write-out: we own the
 * traceability fields (version/generated_at/source_brief_hash are computed at
 * run time, never trusted from model output); personas pass through as-is —
 * shape already RES-04-gated.
 */
export function canonicalizePersonasDoc(raw: unknown, briefHash: string): Record<string, unknown> {
  const doc = (raw ?? {}) as Record<string, unknown>;
  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    source_brief_hash: briefHash,
    personas: Array.isArray(doc.personas) ? doc.personas : [],
  };
}

//#endregion

//#region Skeleton — filled in below by subsequent edits

export interface Stage1Options {
  briefPath?: string;
  briefText?: string;
  outDir: string;
  catalogPath?: string;
  count?: number;
  minSponsorPairFraction?: number;
  transport?: RoleCallOptions["transport"];
  repairLlm?: RoleCallOptions["repairLlm"];
  /** Override of the DP-K §7.4 default (20000ms) — long-transport runs (sweep). */
  llmTimeoutMs?: number;
}

export type Stage1Outcome =
  | { ok: true; data: unknown }
  | ({ ok: false } & DegradedResult);

export async function runStage1(opts: Stage1Options): Promise<Stage1Outcome> {
  // 1) Brief input — raw free text (PGM-01); malformed-brief guard (DP-K §10).
  let briefText: string;
  try {
    briefText = opts.briefText ?? readFileSync(opts.briefPath as string, "utf8");
  } catch (err) {
    return degraded("brief_unreadable", `cannot read brief: ${(err as Error).message}`);
  }
  const briefInsufficient =
    briefText.length < MIN_BRIEF_CHARS || /\u0000|\ufffd/.test(briefText);
  if (briefInsufficient) {
    console.warn(
      `[pgm:stage1] warning: hackathon brief empty/binary/<${MIN_BRIEF_CHARS} chars — proceeding with brief_insufficient flag (GOV-RES-02, DP-K §10)`,
    );
  }
  const briefHash = createHash("sha256").update(briefText, "utf8").digest("hex");

  mkdirSync(opts.outDir, { recursive: true });

  // 2) Config knobs (defaults per DP-K §4 count table; config/pgm.json is the
  //    operator's single source when provided via opts).
  const count = clampCount(opts.count ?? 10);
  const configuredFraction = opts.minSponsorPairFraction ?? 0.4;

  // 3) Catalog sponsor list rendering (PGM-REU-01: runtime injection only).
  const catalogPath = opts.catalogPath ?? CATALOG_PATH;
  let catalog: unknown = null;
  try {
    catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  } catch {
    catalog = null; // catalog is auxiliary context; brief remains the source of truth
  }
  const prompt = renderDeconstructionPrompt({
    briefText,
    catalogSponsorList: renderCatalogSponsorList(catalog, briefText),
    count,
    minSponsorPairFraction: configuredFraction,
  });

  const schema = JSON.parse(readFileSync(PERSONAS_SCHEMA_PATH, "utf8")) as object;
  const callOpts: RoleCallOptions = {
    transport: opts.transport,
    // Same fallback as S3/S4: under `--llm sweep` no separate repairLlm exists,
    // so the single RES-04 repair rides the transport itself (DP-A §6).
    repairLlm: opts.repairLlm ?? opts.transport,
    timeoutMs: opts.llmTimeoutMs ?? 20000,
    retries: 1,
  };

  // 4) ONE pgm_deconstructor call via RES-01 + RES-04 gate (one repair inside).
  const first = await callValidatedRole<unknown>("pgm_deconstructor", prompt, schema, callOpts);
  if (!first.ok) {
    const { ok: _ok, ...degradedFields } = first;
    void _ok;
    writeRunManifest(opts.outDir, "degraded_stage1", { brief_insufficient: briefInsufficient });
    return { ok: false, ...degradedFields }; // DegradedResult passthrough (RES-06)
  }

  // 5) Semantic validation (combination sprint) → at most ONE extra repair.
  const briefSponsorNames = extractSponsorNames(briefText);
  let doc = canonicalizePersonasDoc(first.data, briefHash);
  let semantics = validatePersonas(doc, { configuredFraction, briefSponsorNames });
  if (!semantics.valid) {
    const repairPrompt = `${prompt}\n\nPREVIOUS OUTPUT REJECTED — fix these issues and return the corrected JSON object only:\n- ${semantics.errors.join("\n- ")}`;
    const second = await callValidatedRole<unknown>("pgm_deconstructor", repairPrompt, schema, callOpts);
    if (second.ok) {
      doc = canonicalizePersonasDoc(second.data, briefHash);
      semantics = validatePersonas(doc, { configuredFraction, briefSponsorNames });
    }
  }
  if (!semantics.valid) {
    // Second failure → DegradedResult path (DP-K §4.4 / §10 row 1, PGM-RES-01).
    const partialPath = join(opts.outDir, "personas.partial.json");
    writeFileSync(partialPath, JSON.stringify(doc, null, 2) + "\n");
    writeRunManifest(opts.outDir, "degraded_stage1", { brief_insufficient: briefInsufficient });
    return degraded(
      "validation_repair_failed",
      semantics.errors.length > 0 ? semantics.errors.join("; ") : "stage1 output failed RES-04 after repair",
    );
  }

  // 6) Success — personas.json (RES-04-conformant) + run manifest.
  writeFileSync(join(opts.outDir, "personas.json"), JSON.stringify(doc, null, 2) + "\n");
  writeRunManifest(opts.outDir, "stage1_complete", { brief_insufficient: briefInsufficient });
  return { ok: true, data: doc };
}

//#endregion

//#region Internal helpers

/** pgm.personas.count range per DP-K §4 count table (3..20, default 10). */
function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.max(3, Math.min(20, Math.round(n)));
}

function degraded(reason: string, originalError: string): Stage1Outcome {
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

/**
 * writeRunManifest — <outDir>/run.json status marker (DP-K §10 signal column):
 * "stage1_complete" on success, "degraded_stage1" when the pipeline must halt
 * (human fallback is the IDEA-01 worksheet).
 */
export function writeRunManifest(
  outDir: string,
  status: string,
  flags: Record<string, boolean> = {},
): void {
  writeFileSync(
    join(outDir, "run.json"),
    JSON.stringify(
      { module: "pgm", stage: 1, status, flags, generated_at: new Date().toISOString() },
      null,
      2,
    ) + "\n",
  );
}

//#endregion
