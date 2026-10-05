// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §3.1 claim ledger: candidates, lint, verify, init. Deterministic; no model calls.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { compileSchema, loadSchema } from "../llm/index.js";
import type { Claim, ClaimLedger, ClaimsLint, VerifyResult } from "./types.js";

export const DEFAULT_SURFACES = [
  "README.md",
  "JUDGES.md",
  "design_documents/submission_description.md",
  "shots/showcase/captions.json",
  "src/copy/**/*",
];

export const RISKY = [
  "first",
  "only",
  "best",
  "fastest",
  "never",
  "always",
  "guaranteed",
  "unique",
  "state-of-the-art",
  "unprecedented",
  "no other",
];

export interface Candidate {
  file: string;
  line: number;
  match: string;
  kind: "number" | "superlative";
}

interface Sentence {
  text: string;
  line: number;
}

const NUMERIC_RE =
  /(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s?(%|×|x\b|ms\b|s\b|sec\b|seconds?\b|minutes?\b|hours?\b|days?\b|k\b|M\b|tokens?\b|users?\b|tests?\b|lines\b|files?\b|iterations?\b|actions?\b|tasks?\b|calls?\b|runs?\b|points?\b|pp\b)/gi;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RISKY_RE = new RegExp(`\\b(${RISKY.map(escapeRe).join("|")})\\b`, "gi");

function stripLine(line: string): string {
  return line
    .replace(/`[^`\n]*`/g, "")
    .replace(/<!--.*?-->/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, "");
}

function isFence(line: string): boolean {
  return line.trimStart().startsWith("```");
}

function isHeading(line: string): boolean {
  return /^\s*#{1,6}\s/.test(line) || /^\s*#+$/.test(line);
}

/** Reduced, scannable lines with original 1-based line numbers. */
function scannableLines(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inFence = false;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] as string;
    if (isFence(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (isHeading(raw)) continue;
    out.push({ line: i + 1, text: stripLine(raw) });
  }
  return out;
}

function splitSentences(kept: { line: number; text: string }[]): Sentence[] {
  const sentences: Sentence[] = [];
  let current = "";
  let currentLine = 0;
  const flush = () => {
    if (current.trim().length > 0) sentences.push({ text: current, line: currentLine });
    current = "";
    currentLine = 0;
  };
  for (const part of kept) {
    if (current === "") currentLine = part.line;
    current += (current === "" ? "" : "\n") + part.text;
    if (/[.?!](?=\s|$)/.test(part.text)) flush();
  }
  flush();
  return sentences;
}

function normaliseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Candidates in a surface text. Fences, inline code, comments, link targets,
 *  bare URLs and headings are never scanned. */
export function extractCandidates(text: string, file: string): Candidate[] {
  const kept = scannableLines(text);
  const candidates: Candidate[] = [];
  for (const { line, text: cleaned } of kept) {
    NUMERIC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = NUMERIC_RE.exec(cleaned)) !== null) {
      candidates.push({ file, line, match: normaliseSpace(m[0]), kind: "number" });
    }
  }
  for (const sentence of splitSentences(kept)) {
    RISKY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RISKY_RE.exec(sentence.text)) !== null) {
      candidates.push({ file, line: sentence.line, match: (m[1] as string).toLowerCase(), kind: "superlative" });
    }
  }
  candidates.sort((a, b) => a.line - b.line || a.match.localeCompare(b.match));
  return candidates;
}

/** Sentences of a surface text after the same reduction (for superlative backing). */
export function surfaceSentences(text: string): Sentence[] {
  return splitSentences(scannableLines(text));
}

function globToRegExp(glob: string): RegExp {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] as string;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += escapeRe(c);
    }
  }
  return new RegExp(re + "$");
}

function listFilesRecursive(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const full = join(dir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) listFilesRecursive(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function expandSurfaces(entryDir: string, surfaces: string[]): string[] {
  const all = listFilesRecursive(entryDir).map((abs) => toPosix(relative(entryDir, abs)));
  const regexes = surfaces.map(globToRegExp);
  return all.filter((rel) => regexes.some((r) => r.test(rel))).sort();
}

export function readLedger(entryDir: string): ClaimLedger | null {
  const path = join(entryDir, "claims.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ClaimLedger;
}

function validateLedger(ledger: unknown): string[] {
  const schema = loadSchema("contracts/hee-claims.schema.json");
  const result = compileSchema(schema)(ledger);
  if (result.ok) return [];
  return result.errors.map((e) => `claims.json: ${e}`);
}

function surfacesOf(entryDir: string): string[] {
  const cfgPath = join(entryDir, "design_documents", "showcase.json");
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as { surfaces?: unknown };
      if (Array.isArray(cfg.surfaces) && cfg.surfaces.every((s) => typeof s === "string")) {
        return cfg.surfaces as string[];
      }
    } catch {
      // fall through to the default
    }
  }
  return DEFAULT_SURFACES;
}

function resolvePointer(doc: unknown, pointer: string): { found: boolean; value: unknown } {
  if (!pointer.startsWith("/")) return { found: false, value: undefined };
  const parts = pointer
    .slice(1)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: unknown = doc;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return { found: false, value: undefined };
    if (!(part in (cur as Record<string, unknown>))) return { found: false, value: undefined };
    cur = (cur as Record<string, unknown>)[part];
  }
  return { found: true, value: cur };
}

function applyFormat(format: string, v: unknown): string {
  return format.replace(/\{v(?::(\d+))?\}/g, (_whole, digits: string | undefined) => {
    if (digits !== undefined) return Number(v).toFixed(Number(digits));
    return String(v);
  });
}

export function verifyClaim(claim: Claim, entryDir: string): VerifyResult {
  const source = claim.source;
  if (source.type === "url") {
    const ok = source.evidence_quote.length > 0 && /^\d{4}-\d{2}-\d{2}/.test(source.checked_at);
    return {
      ok,
      detail: ok ? "manual: operator quoted the page" : "manual: operator quoted the page (missing quote or bad checked_at)",
    };
  }
  const abs = join(entryDir, ...source.path.split("/"));
  if (!existsSync(abs)) return { ok: false, detail: `artifact ${source.path} not found` };
  if (source.pointer !== undefined) {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      return { ok: false, detail: `artifact ${source.path} is not JSON` };
    }
    const { found, value } = resolvePointer(doc, source.pointer);
    if (!found) return { ok: false, detail: `artifact ${source.path}: pointer ${source.pointer} not found` };
    const text = applyFormat(source.format ?? "{v}", value);
    const ok = text.trim() === claim.match.trim();
    return {
      ok,
      detail: `artifact ${source.path}${source.pointer}: "${text}" ${ok ? "matches" : "does not match"} "${claim.match}"`,
    };
  }
  if (source.contains !== undefined) {
    const body = readFileSync(abs, "utf8");
    const ok = body.includes(source.contains);
    return {
      ok,
      detail: `artifact ${source.path} ${ok ? "contains" : "does not contain"} the quoted text`,
    };
  }
  return { ok: true, detail: `artifact ${source.path} exists` };
}

function backingClaim(candidate: Candidate, sentence: string | null, claims: Claim[]): Claim | null {
  for (const claim of claims) {
    if (candidate.kind === "number") {
      if (claim.match === candidate.match) return claim;
    } else {
      if (!claim.match.toLowerCase().includes(candidate.match)) continue;
      const normSentence = normaliseSpace(sentence ?? "");
      const normText = normaliseSpace(claim.text);
      if (normText === normSentence || (normSentence.length > 0 && normSentence.includes(normText))) return claim;
    }
  }
  return null;
}

/** DP-W09 §3.1 lintClaims. */
export function lintClaims(entryDir: string): ClaimsLint {
  const ledger = readLedger(entryDir);
  if (ledger === null) {
    return { problems: ["claims.json not found; run claims init"], warnings: [], count: 0 };
  }
  const schemaProblems = validateLedger(ledger);
  if (schemaProblems.length > 0) {
    return { problems: schemaProblems, warnings: [], count: (ledger.claims ?? []).length };
  }
  for (const claim of ledger.claims) {
    if (!claim.source || (claim.ceiling ?? "").length === 0) {
      return {
        problems: [`claims.json: claim ${claim.id} needs a non-empty source and ceiling`],
        warnings: [],
        count: ledger.claims.length,
      };
    }
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  const used = new Set<string>();
  const surfaceRels = expandSurfaces(entryDir, surfacesOf(entryDir));

  interface Occurrence {
    rel: string;
    candidate: Candidate;
    sentence: string | null;
  }
  const occurrences: Occurrence[] = [];
  for (const rel of surfaceRels) {
    const abs = join(entryDir, ...rel.split("/"));
    let body: string;
    try {
      body = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (rel === "shots/showcase/captions.json" || rel.endsWith("/captions.json")) {
      let entries: { caption?: unknown }[];
      try {
        entries = JSON.parse(body) as { caption?: unknown }[];
      } catch {
        continue;
      }
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry, i) => {
        if (typeof entry?.caption !== "string") return;
        for (const c of extractCandidates(entry.caption, rel)) {
          occurrences.push({ rel, candidate: { ...c, line: i + 1 }, sentence: entry.caption });
        }
      });
      continue;
    }
    const sentences = surfaceSentences(body);
    for (const c of extractCandidates(body, rel)) {
      const sentence = c.kind === "superlative" ? (sentences.find((s) => s.line === c.line)?.text ?? null) : null;
      occurrences.push({ rel, candidate: c, sentence });
    }
  }

  for (const { rel, candidate, sentence } of occurrences) {
    const claim = backingClaim(candidate, sentence, ledger.claims);
    if (claim === null) {
      problems.push(`${rel}:${candidate.line}: "${candidate.match}" is not in claims.json`);
      continue;
    }
    used.add(claim.id);
    if (claim.status !== "verified") {
      problems.push(`${rel}:${candidate.line}: claim ${claim.id} "${candidate.match}" is ${claim.status}`);
    }
  }

  for (const claim of ledger.claims) {
    if (!used.has(claim.id)) warnings.push(`claim ${claim.id} is not used on any surface`);
  }

  const readmePath = join(entryDir, "README.md");
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, "utf8");
    const start = "<!-- hee-eval:start -->";
    const end = "<!-- hee-eval:end -->";
    const si = readme.indexOf(start);
    const ei = readme.indexOf(end);
    if (si !== -1 && ei !== -1 && ei > si) {
      const reportPath = join(entryDir, "evals", "report.json");
      if (!existsSync(reportPath)) {
        problems.push("README.md: eval block present but evals/report.json not found");
      } else {
        const raw = readFileSync(reportPath, "utf8");
        const block = readme.slice(si + start.length, ei);
        const blockStartLine = readme.slice(0, si).split("\n").length;
        const blockLines = block.split("\n");
        for (let i = 0; i < blockLines.length; i++) {
          for (const c of extractCandidates(blockLines[i] as string, "README.md")) {
            const digits = c.match.replace(/%/g, "").replace(/,/g, "").trim();
            if (!raw.includes(digits)) {
              problems.push(`README.md:${blockStartLine + i}: "${c.match}" is not in evals/report.json`);
            }
          }
        }
      }
    }
  }

  return { problems, warnings, count: ledger.claims.length };
}

/** DP-W09 §3.1 claims verify: rewrites statuses, never writes retracted. */
export function verifyAllClaims(entryDir: string): { ok: number; bad: number } {
  const ledger = readLedger(entryDir);
  if (ledger === null) return { ok: 0, bad: 0 };
  let ok = 0;
  let bad = 0;
  for (const claim of ledger.claims) {
    const result = verifyClaim(claim, entryDir);
    if (result.ok) {
      claim.status = "verified";
      claim.verified_at = new Date().toISOString();
      ok++;
    } else {
      claim.status = "unverified";
      claim.verified_at = null;
      bad++;
    }
  }
  writeFileSync(join(entryDir, "claims.json"), JSON.stringify(ledger, null, 2) + "\n", "utf8");
  return { ok, bad };
}

/** DP-W09 §3.1 claims init: writes an empty ledger when absent; never overwrites. */
export function initClaims(entryDir: string): { created: boolean; candidates: Candidate[] } {
  const ledgerPath = join(entryDir, "claims.json");
  const created = !existsSync(ledgerPath);
  if (created) {
    const ledger: ClaimLedger = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      surfaces: [...DEFAULT_SURFACES],
      claims: [],
    };
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  }
  const candidates: Candidate[] = [];
  for (const rel of expandSurfaces(entryDir, surfacesOf(entryDir))) {
    const abs = join(entryDir, ...rel.split("/"));
    let body: string;
    try {
      body = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (rel === "shots/showcase/captions.json" || rel.endsWith("/captions.json")) {
      try {
        const entries = JSON.parse(body) as { caption?: unknown }[];
        if (Array.isArray(entries)) {
          entries.forEach((entry, i) => {
            if (typeof entry?.caption !== "string") return;
            for (const c of extractCandidates(entry.caption, rel)) {
              candidates.push({ ...c, line: i + 1 });
            }
          });
        }
      } catch {
        // unreadable captions file: no candidates
      }
      continue;
    }
    candidates.push(...extractCandidates(body, rel));
  }
  candidates.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.match.localeCompare(b.match));
  return { created, candidates };
}
