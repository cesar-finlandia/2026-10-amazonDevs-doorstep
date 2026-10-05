// Requirement IDs: PGM-09-ENRICH, RES-01, RES-04, RES-06
// Stage 4 Enrichment — post-selection winning-strategy augmentation via run_sweep.sh chat.
// After Stage 4 picks the winner, this stage enriches winning_project_plan.md so it
// satisfies Task 2's winning-strategy quality gate (Hackathon Requirements & Compliance
// Matrix + Sponsored Track Strategy 1-2 tracks). Best-effort: never blocks the
// pipeline — a failed enrichment keeps the original Stage 4 plan and warns.
// Flow:
//   1. Read winning_project_plan.md + brief + catalog + event_profile.
//   2. Render enrichment.template.md with {{plan}}/{{brief}}/{{catalog}}/{{event_profile}}.
//   3. ONE callLlmForRole("pgm_selector", prompt) via resilientCall {45000ms,1} — same
//      transport as Stage 4 (sweep when --llm sweep, direct otherwise). Repair round-trip
//      on RES-04 / heading / leak failures. On success, overwrite winning_project_plan.md
//      after NONGOAL-12 leak guard + frozen-heading order check.
//   4. Quality evaluation: the caller (pipeline.ts) re-reads the enriched file and runs
//      evaluateEnrichmentQuality(). If quality is insufficient, the prompt is rewritten
//      (add missing sections explicitly) and the sweep is retried ONCE, then re-evaluated.
//      This satisfies the task's "evaluate, analyse prompt, rewrite, call again" loop.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { validate, renderRepairPrompt, type ValidationError } from "../../resilience/index.js";
import { evaluatePlanDepth } from "../plan-depth.js";
import { callLlmForRole, type RoleCallOptions } from "../resilientCall.js";
import { renderTemplate } from "./stage1_deconstruction.js";
import {
  checkHeadings,
  findManifestLeaks,
  findOverlongQuotes,
  findUsernameLeak,
  FRONTMATTER_SCHEMA_PATH,
  splitFrontmatter,
  parseFrontmatterYaml,
  unwrapJsonEnvelope,
} from "./stage4_selection.js";
import { renderCatalogDigest } from "./stage4_selection.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const TEMPLATE_PATH = join(REPO_ROOT, "src", "pgm", "prompts", "enrichment.template.md");
const CATALOG_PATH = join(REPO_ROOT, "contracts", "component-catalog.json");

export interface EnrichOptions {
  briefPath?: string;
  briefText?: string;
  eventProfilePath?: string;
  eventProfileText?: string;
  catalogPath?: string;
  catalogText?: string;
  outDir: string;
  transport?: RoleCallOptions["transport"];
  repairLlm?: RoleCallOptions["repairLlm"];
  llmTimeoutMs?: number;
}

export interface EnrichResult {
  ok: boolean;
  enriched: boolean;
  reason?: string;
  quality?: QualityReport;
}

export interface QualityReport {
  hasComplianceMatrix: boolean;
  hasTrackStrategy: boolean;
  trackFocusCount: number | null;
  sponsorTracksMatch: boolean;
  hasTrackRoi: boolean;
  /** DEPTH-01: thesis, call graph, action surface, truth engine, demo inputs, leverage map, 3D (plan-depth.ts). */
  hasDepthSections: boolean;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Quality evaluator — checks Task 2 requirements inside the enriched plan.
// ---------------------------------------------------------------------------
export function evaluateEnrichmentQuality(planText: string): QualityReport {
  const issues: string[] = [];
  const { frontmatter, body } = splitFrontmatter(planText);
  let sponsorTracks: string[] = [];
  if (frontmatter !== null) {
    try {
      const fm = parseFrontmatterYaml(frontmatter);
      if (Array.isArray(fm.sponsor_tracks)) sponsorTracks = fm.sponsor_tracks.map((s) => String(s));
    } catch {}
  }
  // Must contain the two Architecture subsections
  const hasComplianceMatrix = /###\s+Hackathon Requirements.*Compliance Matrix/i.test(body);
  if (!hasComplianceMatrix) issues.push("missing ### Hackathon Requirements & Compliance Matrix in Architecture");
  const hasTrackStrategy = /###\s+Sponsored Track Strategy/i.test(body);
  if (!hasTrackStrategy) issues.push("missing ### Sponsored Track Strategy in Architecture");
  // Track focus count: look for "Focus: 1 track" or "Focus: 2 tracks"
  let trackFocusCount: number | null = null;
  const focusMatch = body.match(/Focus:\s*([12])\s*tracks?/i);
  if (focusMatch) trackFocusCount = Number(focusMatch[1]);
  else if (hasTrackStrategy) issues.push("Sponsored Track Strategy must state 'Focus: 1 track' or 'Focus: 2 tracks' with justification");

  // sponsor_tracks vs strategy match
  let sponsorTracksMatch = true;
  if (sponsorTracks.length > 0 && hasTrackStrategy) {
    const strategySection = body.split(/###\s+Sponsored Track Strategy/i)[1]?.split(/^###\s/m)[0] ?? "";
    for (const t of sponsorTracks) {
      if (!strategySection.toLowerCase().includes(t.toLowerCase()) && !body.toLowerCase().includes(t.toLowerCase())) {
        sponsorTracksMatch = false;
        issues.push(`sponsor_tracks entry '${t}' not found verbatim in Sponsored Track Strategy subsection`);
      }
    }
    if (sponsorTracks.length > 2) {
      sponsorTracksMatch = false;
      issues.push(`sponsor_tracks must be 1-2 entries, got ${sponsorTracks.length}`);
    }
    if (sponsorTracks.length === 0) {
      issues.push("sponsor_tracks is empty but brief names tracks — must be 1-2 entries");
    }
  }

  const hasTrackRoi = /Track ROI/i.test(body);
  if (!hasTrackRoi) issues.push("missing Track ROI paragraph in Business Value");

  // Also ensure compliance matrix is a table
  if (hasComplianceMatrix) {
    const matrixSection = body.split(/###\s+Hackathon Requirements.*Compliance Matrix/i)[1]?.split(/^###\s/m)[0] ?? "";
    if (!matrixSection.includes("|")) issues.push("Compliance Matrix subsection should be a markdown table (| columns)");
  }

  // DEPTH-01 / LEVERAGE-01 / 3D-01 — the depth sections prize-winning entries implied.
  const depth = evaluatePlanDepth(planText);
  for (const e of depth.errors) issues.push(e);
  const hasDepthSections = depth.errors.length === 0;

  return {
    hasComplianceMatrix,
    hasTrackStrategy,
    trackFocusCount,
    sponsorTracksMatch,
    hasTrackRoi,
    hasDepthSections,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering helpers
// ---------------------------------------------------------------------------
function loadBriefText(opts: EnrichOptions): string | null {
  if (opts.briefText) return opts.briefText;
  if (opts.briefPath) {
    try {
      return readFileSync(opts.briefPath, "utf8");
    } catch {
      return null;
    }
  }
  return null;
}

function buildPrompt(planText: string, briefText: string, catalogText: string, eventProfileText: string | null): string {
  const tpl = readFileSync(TEMPLATE_PATH, "utf8");
  return renderTemplate(tpl, {
    plan: planText,
    brief: briefText,
    catalog: renderCatalogDigest(catalogText),
    event_profile: eventProfileText ?? "(no event profile — PROFILE stage has not run)",
  });
}

function buildRetryPrompt(planText: string, briefText: string, catalogText: string, eventProfileText: string | null, quality: QualityReport): string {
  const base = buildPrompt(planText, briefText, catalogText, eventProfileText);
  return `${base}

CRITICAL RETRY INSTRUCTION — your previous enrichment FAILED quality gate with these issues:
${quality.issues.map((i) => `- ${i}`).join("\n")}
Fix ALL of them in this retry. Keep the frontmatter sponsor_tracks exactly as before. Ensure Executive Pitch opens with the **Thesis:** line, AI Solution contains ### Agentic Workflow & Call Graph and ### Action Surface, Architecture contains ### Truth Engine, ### Demo Inputs, ### Mandated Technology Leverage Map, ### Signature 3D Experience and then the two compliance ### subsections with tables, and Business Value contains the Track ROI paragraph. Return ONLY the corrected winning_project_plan.md.
`;
}

// ---------------------------------------------------------------------------
// Main enrichment
// ---------------------------------------------------------------------------
export async function enrichWinningPlan(opts: EnrichOptions): Promise<EnrichResult> {
  const outPath = join(opts.outDir, "winning_project_plan.md");
  let planText: string;
  try {
    planText = readFileSync(outPath, "utf8");
  } catch (err) {
    return { ok: false, enriched: false, reason: `cannot read winning_project_plan.md: ${(err as Error).message}` };
  }

  const briefText = loadBriefText(opts);
  if (!briefText) {
    return { ok: false, enriched: false, reason: "cannot read hackathon brief — enrichment requires the brief (Hackathon-page transcription)" };
  }

  let catalogText: string;
  try {
    catalogText = opts.catalogText ?? readFileSync(opts.catalogPath ?? CATALOG_PATH, "utf8");
  } catch {
    catalogText = "(catalog unavailable)";
  }

  let eventProfileText: string | null = opts.eventProfileText ?? null;
  if (eventProfileText === null && opts.eventProfilePath) {
    try {
      eventProfileText = readFileSync(opts.eventProfilePath, "utf8");
    } catch {
      eventProfileText = null;
    }
  }

  const sourceBriefHash = createHash("sha256").update(briefText, "utf8").digest("hex");
  const schema = JSON.parse(readFileSync(FRONTMATTER_SCHEMA_PATH, "utf8")) as object;

  const callOpts: RoleCallOptions = {
    transport: opts.transport,
    timeoutMs: opts.llmTimeoutMs ?? 45000,
    retries: 1,
  };

  mkdirSync(opts.outDir, { recursive: true });

  // Gate helper — same as Stage 4 but without winner attribution
  const gate = (rawText: string): { errors: ValidationError[]; quality: QualityReport } => {
    const errors: ValidationError[] = [];
    const { frontmatter, body } = splitFrontmatter(rawText);
    if (frontmatter === null) {
      errors.push({ path: "/", message: "output has no --- delimited YAML frontmatter block", code: "required" });
      return { errors, quality: evaluateEnrichmentQuality(rawText) };
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
      errors.push({ path: "/", message: `NONGOAL-12 manifest leak: ${leak}`, code: "pattern" });
    }
    const quality = evaluateEnrichmentQuality(rawText);
    // Quality issues are surfaced as gate errors for retry purposes (but caller
    // treats them as enrichment-quality, not just schema errors)
    for (const issue of quality.issues) {
      errors.push({ path: "/body", message: `enrichment quality: ${issue}`, code: "required" });
    }
    return { errors, quality };
  };

  // Attempt 1
  let prompt = buildPrompt(planText, briefText, catalogText, eventProfileText);
  let first = await callLlmForRole("pgm_selector", prompt, callOpts);
  if (!first.ok) {
    return { ok: false, enriched: false, reason: `enrichment LLM call failed: ${first.original_error ?? "unknown"}` };
  }
  let raw = unwrapJsonEnvelope(first.data);
  let gated = gate(raw);

  // If quality/schema failed, one repair round-trip, then evaluate prompt rewrite
  if (gated.errors.length > 0) {
    const repairLlm = opts.repairLlm ?? opts.transport;
    if (repairLlm) {
      const second = await callLlmForRole("pgm_selector", renderRepairPrompt(gated.errors, raw), {
        transport: repairLlm,
        timeoutMs: opts.llmTimeoutMs ?? 45000,
        retries: 1,
      });
      if (second.ok) {
        const repaired = unwrapJsonEnvelope(second.data);
        const repairedGate = gate(repaired);
        if (repairedGate.errors.length === 0) {
          raw = repaired;
          gated = repairedGate;
        } else {
          // Keep repaired gate for quality analysis — we will try a prompt rewrite
          raw = repaired;
          gated = repairedGate;
        }
      }
    }
  }

  // If still failing quality, do ONE prompt-rewrite + sweep retry (task requirement)
  if (gated.errors.length > 0) {
    const lastQuality = gated.quality;
    // Rewrite prompt explicitly calling out missing sections
    prompt = buildRetryPrompt(planText, briefText, catalogText, eventProfileText, lastQuality);
    const retry = await callLlmForRole("pgm_selector", prompt, callOpts);
    if (retry.ok) {
      const retryRaw = unwrapJsonEnvelope(retry.data);
      const retryGate = gate(retryRaw);
      if (retryGate.errors.length === 0) {
        raw = retryRaw;
        gated = retryGate;
      } else {
        // Retry also failed — keep original plan, report enrichment as not applied
        return {
          ok: false,
          enriched: false,
          reason: `enrichment quality gate still failing after prompt rewrite: ${retryGate.errors.map((e) => e.message).join("; ")}`,
          quality: retryGate.quality,
        };
      }
    } else {
      return {
        ok: false,
        enriched: false,
        reason: `enrichment retry call failed: ${retry.original_error ?? "unknown"}`,
        quality: lastQuality,
      };
    }
  }

  // NONGOAL-12 post-write guard
  const written = raw.trim() + "\n";
  const leaks = findManifestLeaks(written);
  if (leaks.length > 0) {
    return { ok: false, enriched: false, reason: `NONGOAL-12 violation after enrichment (${leaks.join(", ")})` };
  }

  writeFileSync(outPath, written);
  // Update run.json enrichment marker (best-effort)
  try {
    const runPath = join(opts.outDir, "run.json");
    const run = JSON.parse(readFileSync(runPath, "utf8")) as Record<string, unknown>;
    (run as Record<string, unknown>)["enrichment"] = {
      status: "enriched",
      hasComplianceMatrix: gated.quality.hasComplianceMatrix,
      hasTrackStrategy: gated.quality.hasTrackStrategy,
      trackFocusCount: gated.quality.trackFocusCount,
      enriched_at: new Date().toISOString(),
    };
    writeFileSync(runPath, JSON.stringify(run, null, 2) + "\n");
  } catch {
    // non-fatal
  }

  return { ok: true, enriched: true, quality: gated.quality };
}
