// src/ui/shim/guard-browser.ts — browser-safe twin of src/llm/guard.js (DP-UI WU-UI-04).
// The Node module reads config/banned-patterns.json with node:fs at first use,
// which the browser bundle cannot do. The patterns below are copied verbatim
// from config/banned-patterns.json v1.2.0; the API and matching semantics are
// identical, so narrator copy is guarded the same way on both sides.
const PATTERNS: { id: string; re: RegExp }[] = [
  { id: "honest", re: /\bhonest\w*/i },
  { id: "triage", re: /\btriag\w*/i },
];

export function bannedHits(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of PATTERNS) {
    const flags = p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g";
    const g = new RegExp(p.re.source, flags);
    for (const m of text.matchAll(g)) {
      if (m[0] === "") continue;
      const low = m[0].toLowerCase();
      if (!seen.has(low)) {
        seen.add(low);
        out.push(low);
      }
    }
  }
  return out;
}

/** Returns text unchanged when clean. Otherwise calls rewrite(text, hits) ONCE; if the rewrite is still dirty or throws, returns `template`. */
export async function guardCopy(
  text: string,
  rewrite: (text: string, hits: string[]) => Promise<string>,
  template: string,
): Promise<{ text: string; rewritten: boolean; usedTemplate: boolean }> {
  const hits = bannedHits(text);
  if (hits.length === 0) return { text, rewritten: false, usedTemplate: false };
  let rewritten: string;
  try {
    rewritten = await rewrite(text, hits);
  } catch {
    return { text: template, rewritten: true, usedTemplate: true };
  }
  if (bannedHits(rewritten).length > 0) return { text: template, rewritten: true, usedTemplate: true };
  return { text: rewritten, rewritten: true, usedTemplate: false };
}
