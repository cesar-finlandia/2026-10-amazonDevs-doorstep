// scripts/compile-friction.ts — DP-SUBMISSION WU-04 (§5.4).
// Compiles design_documents/friction-log.md into the six-part Devpost shape
// at design_documents/submission/friction-log-devpost.md. Platform entries
// name a platform surface in their Where line; internal ones stay out.
// FRICTION_SOURCE points at a temporary copy (verification). Prints
// `friction: <n> platform entries, <m> internal entries kept out`.
import { readFileSync, writeFileSync } from "node:fs";

const PLATFORM_WORDS = ["Ring", "webhook", "history", "GET /v1", "WHEP", "Playground", "OAuth", "Bedrock", "Strands", "AgentCore"];

function isPlatform(where: string): boolean {
  return PLATFORM_WORDS.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(where));
}

interface Entry { n: string; title: string; fields: Record<string, string> }

function parseEntries(text: string): Entry[] {
  const clean = text.replace(/\r/g, "");
  const entries: Entry[] = [];
  let cur: Entry | null = null;
  let field = "";
  for (const line of clean.split("\n")) {
    const h = /^## (FL-\d+)\s+(.*)$/.exec(line);
    if (h) {
      if (cur !== null) entries.push(cur);
      cur = { n: h[1] as string, title: (h[2] as string).trim(), fields: {} };
      field = "";
      continue;
    }
    if (cur === null) continue;
    const kv = /^(Date|Severity|Where|What happened|Workaround|Suggestion):\s*(.*)$/.exec(line);
    if (kv) {
      field = kv[1] as string;
      cur.fields[field] = (kv[2] as string).trim();
    } else if (field !== "" && line.trim() !== "") {
      cur.fields[field] = `${cur.fields[field] as string} ${line.trim()}`;
    }
  }
  if (cur !== null) entries.push(cur);
  return entries;
}

function sentencesOf(t: string): string[] {
  return t.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s !== "");
}

function render(entry: Entry): string {
  const f = entry.fields;
  const what = sentencesOf(f["What happened"] ?? "");
  let steps = what;
  const resultIdx = what.findIndex((s) => /§|\bsays\b|\bexpects?\b/i.test(s) || /\bso\b/i.test(s));
  if (resultIdx > 0) steps = what.slice(0, resultIdx);
  else if (resultIdx === 0 && what.length > 1) steps = [];
  else if (resultIdx === 0) steps = [what[0] as string];
  let expected = "none stated";
  let actual = "none stated";
  const explicit = what.findIndex((s) => /^§|.*\bsays\b|.*\bexpects?\b/i.test(s));
  if (explicit !== -1) {
    expected = what[explicit] as string;
    actual = what.filter((_, i) => i !== explicit).join(" ");
    if (actual === "") actual = "none stated";
  } else {
    const joined = what.join(" ");
    const cut = joined.split(/,? so /);
    if (cut.length >= 2) {
      expected = (cut[0] as string).trim().replace(/[,;:]+$/, "");
      actual = cut.slice(1).join(" so ").trim();
    } else if (joined !== "") {
      expected = joined;
      actual = "none stated";
    }
  }
  const lines = [
    `## ${entry.n} ${entry.title}`,
    `- **Task:** ${f["Where"] ?? ""}`,
    `- **Steps:** ${steps.join(" ")}`,
    `- **Expected vs actual:** ${expected} — actual: ${actual}`,
    `- **Severity:** ${f["Severity"] ?? ""}`,
    `- **Workaround:** ${f["Workaround"] ?? ""}`,
    `- **Suggestion:** ${f["Suggestion:"] ?? f["Suggestion"] ?? "none stated"}`,
  ];
  return lines.join("\n");
}

const src = process.env["FRICTION_SOURCE"] ?? "design_documents/friction-log.md";
const entries = parseEntries(readFileSync(src, "utf8"));
for (const e of entries) {
  if (!e.fields["What happened"]) { console.error(`friction: ${e.n} is missing What happened`); process.exit(1); }
  if (!e.fields["Workaround"]) { console.error(`friction: ${e.n} is missing Workaround`); process.exit(1); }
  const sev = (e.fields["Severity"] ?? "").trim();
  if (sev !== "low" && sev !== "medium" && sev !== "high") { console.error(`friction: ${e.n} has a bad Severity`); process.exit(1); }
}
const platform = entries.filter((e) => isPlatform(e.fields["Where"] ?? ""));
const internal = entries.filter((e) => !isPlatform(e.fields["Where"] ?? ""));
const out = `# Friction log for Devpost\n\n${platform.map(render).join("\n\n")}\n`;
writeFileSync("design_documents/submission/friction-log-devpost.md", out, "utf8");
console.log(`friction: ${platform.length} platform entries, ${internal.length} internal entries kept out`);
