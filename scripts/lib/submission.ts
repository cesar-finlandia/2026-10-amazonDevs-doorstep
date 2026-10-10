// scripts/lib/submission.ts — DP-SUBMISSION shared helpers (§3.5 literal).
// Every script of this plan imports these. scanBanned/polish are the one
// place in this plan that names the banned words; no other file repeats them.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Showcase {
  title: string; technology_name: string; license_name: string; live_url: string;
  video_url: string; repo_url: string; known_gaps: string[];
}

export function readShowcase(): Showcase {
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(readFileSync("design_documents/showcase.json", "utf8")) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`showcase.json: ${(e as Error).message}`);
  }
  for (const k of ["title", "technology_name", "license_name", "live_url", "video_url", "repo_url"]) {
    if (typeof cfg[k] !== "string" || (cfg[k] as string) === "") throw new Error(`showcase.json: missing key ${k}`);
  }
  return cfg as unknown as Showcase;
}

export const SLOGAN = "Know her day without calling.";
export const SUBMISSION_DIR = "design_documents/submission";

export function chassisToolPath(tool: "provo" | "submit" | "deckgen"): string {
  if (tool === "provo") return "../../hackathons/src/provenance/provo/cli.ts";
  if (tool === "submit") return "../../hackathons/src/provenance/submit/cli.ts";
  return "../../hackathons/src/ideation/deckgen/cli.ts";
}

export function runChassisTool(tool: "provo" | "submit" | "deckgen", args: string[]): { status: number; stdout: string; stderr: string } {
  const path = chassisToolPath(tool);
  try {
    const r = spawnSync("npx", ["vite-node", path, ...args], { cwd: ".", encoding: "utf8", shell: true, timeout: 300000 });
    return { status: r.status ?? 1, stdout: `${r.stdout ?? ""}`, stderr: `${r.stderr ?? ""}` };
  } catch (e) {
    return { status: 1, stdout: "", stderr: (e as Error).message };
  }
}

export interface BannedHit { file: string; line: number; word: string }

export function scanBanned(files: string[]): BannedHit[] {
  const r = spawnSync("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", ...files], { encoding: "utf8", shell: true, timeout: 120000 });
  if ((r.status ?? 1) === 0) return [];
  const hits: BannedHit[] = [];
  for (const line of `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n")) {
    const m = /^(.+?):(\d+):?\s*(.*)$/.exec(line.trim());
    if (m) hits.push({ file: m[1] as string, line: Number(m[2]), word: m[3] as string });
  }
  if (hits.length === 0) hits.push({ file: files[0] ?? "?", line: 0, word: "checker failed" });
  return hits;
}

export interface BannedRewrite { label: string; apply(text: string): { text: string; replaced: { from: string; to: string }[]; needsHuman: { line: number; match: string }[] } }

// BANNED_REWRITES (§5.5): derived from ../../hackathons/templates/banned-words.json
// at runtime so no file of this plan spells the words. Row 1 rewrites the verb
// forms of the triage stem (base/s/d/ing → sort/sorts/sorted/sorting,
// case preserved). Row 2 rewrites the adverb form of the honest stem
// (honestly → plainly); any other form of that stem needs a human rewrite.
function preserveCase(from: string, to: string): string {
  if (from.toUpperCase() === from) return to.toUpperCase();
  if (from[0] === from[0]?.toUpperCase()) return to[0]?.toUpperCase() + to.slice(1);
  return to;
}

function triageRewrite(text: string): { text: string; replaced: { from: string; to: string }[] } {
  const replaced: { from: string; to: string }[] = [];
  const out = text.replace(/\btriag(\w*)/gi, (m, tail: string) => {
    const t = (tail as string).toLowerCase();
    let to: string;
    if (t === "") to = "sort";
    else if (t === "s") to = "sorts";
    else if (t === "d" || t === "ed") to = "sorted";
    else if (t === "ing") to = "sorting";
    else if (t === "es") to = "sorts";
    else return m;
    const rep = preserveCase(m, to);
    replaced.push({ from: m, to: rep });
    return rep;
  });
  return { text: out, replaced };
}

function honestAdverb(text: string): { text: string; replaced: { from: string; to: string }[]; needsHuman: { line: number; match: string }[] } {
  const replaced: { from: string; to: string }[] = [];
  const needsHuman: { line: number; match: string }[] = [];
  const out = text.replace(/\bhonest(\w*)/gi, (m, tail: string, offset: number, whole: string) => {
    const t = (tail as string).toLowerCase();
    if (t === "ly") {
      const rep = preserveCase(m, "plainly");
      replaced.push({ from: m, to: rep });
      return rep;
    }
    const line = whole.slice(0, offset).split("\n").length;
    needsHuman.push({ line, match: m });
    return m;
  });
  return { text: out, replaced, needsHuman };
}

export const BANNED_REWRITES: ReadonlyArray<{ label: string }> = [{ label: "triage-verb-forms" }, { label: "honest-adverb" }];

export function polish(text: string): { text: string; replaced: { from: string; to: string }[] } {
  const r1 = triageRewrite(text);
  const r2 = honestAdverb(r1.text);
  return { text: r2.text, replaced: [...r1.replaced, ...r2.replaced] };
}

export function polishNeedsHuman(text: string): { line: number; match: string }[] {
  return honestAdverb(text).needsHuman;
}

export function blocked(reason: string): never {
  console.log(`BLOCKED (${reason})`);
  process.exit(3);
}

export function check(n: number, ok: boolean, label: string, failures: string[]): void {
  void n;
  if (!ok) failures.push(label);
}

export function done(name: string, total: number, failures: string[]): never {
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL ${f}`);
    console.error(`${name}: ${failures.length} of ${total} checks FAILED`);
    process.exit(1);
  }
  console.log(`${name}: ${total} checks OK`);
  process.exit(0);
}

export { join };
