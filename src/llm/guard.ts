// Requirement IDs: NFR-08
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface BannedPattern { id: string; pattern: string; flags: string }

let cached: { id: string; re: RegExp }[] | null = null;

function loadPatterns(): { id: string; re: RegExp }[] {
  if (!cached) {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "config", "banned-patterns.json"), "utf8")) as {
      patterns: BannedPattern[];
    };
    cached = raw.patterns.map((p) => ({ id: p.id, re: new RegExp(p.pattern, p.flags) }));
  }
  return cached;
}

export function bannedHits(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of loadPatterns()) {
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
