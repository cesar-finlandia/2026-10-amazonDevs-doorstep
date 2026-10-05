// Requirement IDs: DEPTH-01, LEVERAGE-01, 3D-01 (templates/product-depth.spec.md §8,
// templates/tech-leverage.spec.md §3, templates/3d-experience.spec.md §6).
//
// src/pgm/plan-depth.ts — pure, dependency-free checks that a winning_project_plan.md carries the
// depth sections prize-winning entries implied: a necessity thesis, an agentic call graph, an action
// surface, a truth engine, real demo inputs, a mandated-technology leverage map and a signature 3D
// view. Used by stage4_enrichment (retry until present) and by scripts/lint-winning-plan.ts (the
// operator's gate after writing the plan by hand). Event-agnostic: it never looks for a specific
// technology name.

export interface PlanDepthReport {
  /** Blocking: the plan is not ready for engine building. */
  errors: string[];
  /** Advisory: the plan passes but falls below a target the specs recommend. */
  warnings: string[];
  metrics: {
    callGraphRows: number;
    totalActions: number | null;
    coveragePercent: number | null;
    grounded: boolean | null;
  };
}

/** The ### subsections Architecture must carry, in this order, before the compliance subsections. */
export const ARCHITECTURE_DEPTH_SUBSECTIONS = [
  "Truth Engine",
  "Demo Inputs",
  "Mandated Technology Leverage Map",
  "Signature 3D Experience",
] as const;

/** The labelled lines the Signature 3D Experience subsection must carry. */
export const SIGNATURE_3D_LABELS = ["Subject", "Why 3D", "Live binding", "Stack", "Shots", "Hero frame"] as const;

/** Body of a top-level `## <heading>` section (up to the next `## `), or null when absent. */
export function topSection(body: string, heading: string): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s(?!#)/.test(lines[i] ?? "")) break;
    out.push(lines[i] ?? "");
  }
  return out.join("\n");
}

/** Body of a `### <heading...>` subsection inside `text` (up to the next ### or ##), or null. */
export function subSection(text: string, headingPrefix: string): string | null {
  const lines = text.split(/\r?\n/);
  const re = new RegExp(`^###\\s+${escapeRe(headingPrefix)}`, "i");
  const start = lines.findIndex((l) => re.test(l.trim()));
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,3}\s/.test(lines[i] ?? "")) break;
    out.push(lines[i] ?? "");
  }
  return out.join("\n");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Data rows of the first markdown table in `text` (header and separator excluded). */
export function tableRows(text: string): string[] {
  const rows = text.split(/\r?\n/).filter((l) => /^\s*\|.*\|\s*$/.test(l));
  return rows.filter((r, i) => !(i === 1 && /^\s*\|[\s:|-]+\|\s*$/.test(r))).slice(1);
}

function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
  const m = text.match(/^﻿?\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: text };
  return { frontmatter: m[1] ?? "", body: m[2] ?? "" };
}

export function evaluatePlanDepth(planText: string): PlanDepthReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { frontmatter, body } = splitFrontmatter(planText);
  let grounded: boolean | null = null;
  const g = frontmatter?.match(/^grounded:\s*(true|false)\s*$/m);
  if (g) grounded = g[1] === "true";

  // 1. Thesis line — first non-empty line of Executive Pitch.
  const pitch = topSection(body, "Executive Pitch");
  if (pitch === null) errors.push("missing ## Executive Pitch");
  else {
    const first = pitch.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
    if (!/^\*\*Thesis:\*\*\s+\S/.test(first)) {
      errors.push("Executive Pitch must open with '**Thesis:** <one sentence>' (product-depth.spec.md §8)");
    } else if (first.replace(/^\*\*Thesis:\*\*\s+/, "").length < 40) {
      warnings.push("Thesis sentence is very short — state <domain> is <property>, which is why ... cannot ... without <mandated technology>");
    }
  }

  // 2. AI Solution — call graph + action surface.
  let callGraphRows = 0;
  let totalActions: number | null = null;
  const ai = topSection(body, "AI Solution");
  if (ai === null) errors.push("missing ## AI Solution");
  else {
    const cg = subSection(ai, "Agentic Workflow & Call Graph");
    if (cg === null) errors.push("missing ### Agentic Workflow & Call Graph in AI Solution");
    else {
      callGraphRows = tableRows(cg).length;
      if (callGraphRows < 3) errors.push(`Agentic Workflow & Call Graph table has ${callGraphRows} stage rows; at least 3 are required`);
      if (!/verif/i.test(cg) || !/repair/i.test(cg)) errors.push("call graph must include a verify → repair round driven by the truth engine");
      if (!/human|approv|checkpoint/i.test(cg)) errors.push("call graph must include at least one human checkpoint");
      if (!/=\s*\d+/.test(cg)) warnings.push("call graph should state the expected total for one core demo run with its arithmetic (e.g. '1 + 1 + 12 + 2 = 16')");
    }
    const as = subSection(ai, "Action Surface");
    if (as === null) errors.push("missing ### Action Surface in AI Solution");
    else {
      const m = as.match(/Total actions:\s*(\d+)/i);
      if (!m) errors.push("Action Surface must end with a line 'Total actions: <n>'");
      else {
        totalActions = Number(m[1]);
        if (totalActions < 15 && !/reason|because/i.test(as)) {
          warnings.push(`Action Surface has ${totalActions} actions (< 15) without a stated reason`);
        }
      }
    }
  }

  // 3. Architecture — depth subsections, order, labels, coverage.
  let coveragePercent: number | null = null;
  const arch = topSection(body, "Architecture");
  if (arch === null) errors.push("missing ## Architecture");
  else {
    const subs = arch.split(/\r?\n/).filter((l) => /^###\s/.test(l)).map((l) => l.replace(/^###\s+/, "").trim());
    const idx = (prefix: string) => subs.findIndex((s) => s.toLowerCase().startsWith(prefix.toLowerCase()));
    for (const name of ARCHITECTURE_DEPTH_SUBSECTIONS) {
      if (idx(name) < 0) errors.push(`missing ### ${name} in Architecture`);
    }
    const matrixAt = idx("Hackathon Requirements");
    if (matrixAt >= 0) {
      for (const name of ARCHITECTURE_DEPTH_SUBSECTIONS) {
        const at = idx(name);
        if (at > matrixAt) errors.push(`### ${name} must come before ### Hackathon Requirements & Compliance Matrix`);
      }
    }
    const lev = subSection(arch, "Mandated Technology Leverage Map");
    if (lev !== null) {
      if (tableRows(lev).length < 1) errors.push("Mandated Technology Leverage Map must contain a table");
      const cov = lev.match(/Coverage:\s*(\d+)\s*\/\s*(\d+)/i);
      if (!cov) errors.push("Leverage Map must contain 'Coverage: <used>/<product-relevant> (<percent>%) ...'");
      else {
        const used = Number(cov[1]);
        const total = Number(cov[2]);
        coveragePercent = total > 0 ? Math.round((used / total) * 100) : null;
        if (coveragePercent !== null && coveragePercent < 80) warnings.push(`leverage coverage ${coveragePercent}% is below the 80% target (tech-leverage.spec.md §2)`);
      }
      if (!/Beyond the sample:/i.test(lev)) errors.push("Leverage Map must contain a 'Beyond the sample:' line");
    }
    const d3 = subSection(arch, "Signature 3D Experience");
    if (d3 !== null) {
      for (const label of SIGNATURE_3D_LABELS) {
        if (!new RegExp(`\\b${escapeRe(label)}\\b\\s*\\**\\s*:`, "i").test(d3)) {
          errors.push(`Signature 3D Experience must carry a '${label}:' line`);
        }
      }
    }
    const inputs = subSection(arch, "Demo Inputs");
    if (inputs !== null && /synthetic/i.test(inputs) && !/because|reason|no real/i.test(inputs)) {
      warnings.push("Demo Inputs uses synthetic data without stating why real input is impossible");
    }
  }

  // 4. Honesty — an ungrounded plan carries no community quotes.
  if (grounded === false) {
    if (/r\/[A-Za-z0-9_]{3,21}\s*,?\s*\d{4}-\d{2}/.test(body) || /\bfragment:/i.test(body)) {
      errors.push("grounded:false plan cites community evidence (r/<sub>, YYYY-MM or 'fragment:') — remove invented evidence");
    }
  }

  return { errors, warnings, metrics: { callGraphRows, totalActions, coveragePercent, grounded } };
}
