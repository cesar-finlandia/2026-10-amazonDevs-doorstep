// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §3.2 README: scaffold from the template, action table, stills grid, lint.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintClaims } from "./claims.js";
import type { ActionManifestLike, CaptionEntry, LintResult } from "./types.js";

const SHOWCASE_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(SHOWCASE_DIR, "..", "..", "templates", "hee-readme.template.md");

export const ACTION_TABLE_HEADER = "| Action | Group | What it does |";
export const STILLS_GRID_HEADER = "| Still | Still |";

/** First sentence: cut at the first ". " or at 160 characters. */
export function firstSentence(description: string): string {
  const idx = description.indexOf(". ");
  if (idx !== -1 && idx < 160) return description.slice(0, idx + 1);
  return description.slice(0, 160);
}

/** One row per actions[] entry except get_capabilities, in manifest order. */
export function buildActionTable(manifest: ActionManifestLike): string {
  const rows = manifest.actions
    .filter((a) => a.name !== "get_capabilities")
    .map((a) => `| \`${a.name}\` | ${a.group} | ${firstSentence(a.description)} |`);
  return [ACTION_TABLE_HEADER, "|---|---|", ...rows].join("\n");
}

/** Two-column grid over size:"readme" entries; an odd count leaves the last cell empty. */
export function buildStillsGrid(captions: CaptionEntry[]): string {
  const readme = captions.filter((c) => c.size === "readme");
  if (readme.length === 0) return "";
  const cell = (c: CaptionEntry): string =>
    `![${c.alt}](shots/showcase/${c.file})<br><sub>${c.caption}</sub>`;
  const rows: string[] = [];
  for (let i = 0; i < readme.length; i += 2) {
    const left = cell(readme[i] as CaptionEntry);
    const right = i + 1 < readme.length ? cell(readme[i + 1] as CaptionEntry) : "";
    rows.push(`| ${left} | ${right} |`);
  }
  return [STILLS_GRID_HEADER, "|---|---|", ...rows].join("\n");
}

function readJsonIfExists(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export interface ScaffoldResult {
  ok: boolean;
  message: string;
}

/** The scaffold substitutes only the 7 data placeholders; prose stays {{...}}. */
export function scaffoldReadme(entryDir: string, opts?: { force?: boolean }): ScaffoldResult {
  const dest = join(entryDir, "README.md");
  if (existsSync(dest) && !opts?.force) {
    return { ok: false, message: "README.md exists; use --force to overwrite" };
  }
  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const cfg = (readJsonIfExists(join(entryDir, "design_documents", "showcase.json")) ?? {}) as {
    title?: string;
    technology_name?: string;
    live_url?: string;
    video_url?: string;
    license_name?: string;
  };
  const manifest = readJsonIfExists(join(entryDir, "actions.manifest.json")) as ActionManifestLike | null;
  const captions = readJsonIfExists(join(entryDir, "shots", "showcase", "captions.json")) as CaptionEntry[] | null;
  const actionTable = manifest !== null && Array.isArray(manifest.actions) ? buildActionTable(manifest) : "";
  const stillsGrid = Array.isArray(captions) ? buildStillsGrid(captions) : "";
  const out = template
    .split("{{title}}").join(cfg.title ?? "")
    .split("{{technology_name}}").join(cfg.technology_name ?? "")
    .split("{{live_url}}").join(cfg.live_url ?? "")
    .split("{{video_url}}").join(cfg.video_url ?? "")
    .split("{{license_name}}").join(cfg.license_name ?? "")
    .split("{{action_table}}").join(actionTable)
    .split("{{stills_grid}}").join(stillsGrid);
  writeFileSync(dest, out, "utf8");
  return { ok: true, message: "wrote README.md" };
}

function sectionLines(readme: string, heading: string): { lines: string[]; startLine: number } {
  const lines = readme.split("\n");
  const isH2 = (l: string): boolean => /^##(?!#)\s/.test(l);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isH2(lines[i] as string) && (lines[i] as string).replace(/^##\s+/, "").trim() === heading) {
      start = i;
      break;
    }
  }
  if (start === -1) return { lines: [], startLine: 0 };
  const collected: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (isH2(lines[i] as string)) break;
    collected.push(lines[i] as string);
  }
  return { lines: collected, startLine: start + 2 };
}

function h2Headings(readme: string): string[] {
  return readme
    .split("\n")
    .filter((l) => /^##(?!#)\s/.test(l))
    .map((l) => l.replace(/^##\s+/, "").trim());
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]*)\)/g;
const LINK_RE = /!?\[([^\]]*)\]\(([^)]*)\)/g;

interface FoundLink {
  line: number;
  text: string;
  target: string;
  image: boolean;
}

function findLinks(lines: string[], startLine: number): FoundLink[] {
  const out: FoundLink[] = [];
  lines.forEach((line, i) => {
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(line)) !== null) {
      out.push({ line: startLine + i, text: m[1] as string, target: m[2] as string, image: m[0].startsWith("!") });
    }
  });
  return out;
}

/** DP-W09 §3.2 lintReadme: 12 rules. */
export function lintReadme(entryDir: string): LintResult {
  const problems: string[] = [];
  const warnings: string[] = [];
  const readmePath = join(entryDir, "README.md");
  if (!existsSync(readmePath)) return { problems: ["README.md not found"], warnings };
  const readme = readFileSync(readmePath, "utf8");
  const allLines = readme.split("\n");

  const cfg = readJsonIfExists(join(entryDir, "design_documents", "showcase.json")) as {
    technology_name?: string;
    live_url?: string;
    video_url?: string;
    license_name?: string;
  } | null;

  // Rule 1: no leftovers.
  if (readme.includes("{{")) problems.push("README.md: contains unfinished {{ placeholders");
  if (readme.includes("TODO")) problems.push("README.md: contains TODO markers");

  // Rule 2: heading order.
  const tech = cfg?.technology_name ?? "";
  const expected = [
    "Live demo",
    "Video",
    "See it",
    "Try it in 2 minutes",
    `Why ${tech} is the point`,
    "What the agent can do",
    "The truth engine",
    "Measured proof",
    "Evidence",
    "Architecture",
    `What building this taught us about ${tech}`,
    "Develop, test, deploy",
    "Licence and credits",
  ];
  if (!cfg || tech.length === 0) {
    problems.push("README.md: design_documents/showcase.json with technology_name is needed for the lint");
  } else {
    const found = h2Headings(readme);
    if (found.length !== expected.length) {
      problems.push(
        `README.md: headings do not match the template order (found ${found.length}, expected ${expected.length})`,
      );
    } else {
      for (let i = 0; i < expected.length; i++) {
        if (found[i] !== expected[i]) {
          problems.push(
            `README.md: headings break the template order at "## ${found[i]}" (expected "## ${expected[i]}")`,
          );
          break;
        }
      }
    }
  }

  // Rule 3: thesis.
  const titleIdx = allLines.findIndex((l) => /^#\s/.test(l));
  if (titleIdx !== -1) {
    const para: string[] = [];
    for (let i = titleIdx + 1; i < allLines.length; i++) {
      const l = (allLines[i] as string).trim();
      if (l === "") {
        if (para.length > 0) break;
        continue;
      }
      para.push(allLines[i] as string);
    }
    if (para.length !== 1 || (para[0] as string).length > 200) {
      problems.push("README.md: thesis must be one line of at most 200 characters");
    }
  }

  // Rule 4: links.
  if (cfg?.live_url) {
    const live = sectionLines(readme, "Live demo");
    if (!live.lines.join("\n").includes(cfg.live_url)) {
      problems.push("README.md: live_url missing under ## Live demo");
    }
  }
  if (cfg?.video_url) {
    const video = sectionLines(readme, "Video");
    if (!video.lines.join("\n").includes(cfg.video_url)) {
      problems.push("README.md: video_url missing under ## Video");
    }
  }
  for (const link of findLinks(allLines, 1)) {
    if (link.target === "" || link.target.startsWith("#")) {
      problems.push(`README.md:${link.line}: link "${link.text}" is empty or "#"`);
    } else if (!/^[a-z][a-z0-9+.-]*:/i.test(link.target)) {
      const target = link.target.split("#")[0] as string;
      if (!existsSync(join(entryDir, ...target.split("/")))) {
        problems.push(`README.md:${link.line}: link target "${link.target}" not found`);
      }
    }
  }

  // Rule 5: See it.
  const see = sectionLines(readme, "See it");
  const seeImages = findLinks(see.lines, see.startLine).filter((l) => l.image);
  if (seeImages.length === 0) {
    problems.push("README.md: ## See it needs a .gif as its first image");
  } else {
    const first = seeImages[0] as FoundLink;
    if (!first.target.toLowerCase().endsWith(".gif")) {
      problems.push("README.md: first image under ## See it must be a .gif");
    } else if (!existsSync(join(entryDir, ...first.target.split("/")))) {
      problems.push(`README.md: hero gif "${first.target}" not found`);
    }
    const further = seeImages.slice(1).filter((l) => l.target.includes("shots/showcase/"));
    if (further.length < 4) {
      problems.push("README.md: ## See it needs at least 4 stills besides the hero gif");
    }
    seeImages.forEach((img) => {
      const idx = img.line - see.startLine;
      const rest = (see.lines[idx] as string).slice((see.lines[idx] as string).indexOf(img.target) + img.target.length);
      const next = ((see.lines[idx + 1] as string) ?? "").trim();
      const captioned =
        rest.includes("<sub>") || next.includes("<sub>") || /^\*.*\*$/.test(next) || /^_.*_$/.test(next);
      if (!captioned) problems.push(`README.md:${img.line}: image "${img.target}" has no caption line`);
    });
  }

  // Rule 6: Try it list.
  const attempt = sectionLines(readme, "Try it in 2 minutes");
  const steps = attempt.lines.filter((l) => /^\d+\.\s+\S/.test(l.trim()));
  if (steps.length < 3 || steps.length > 6) {
    problems.push(`README.md: ## Try it in 2 minutes needs 3-6 numbered steps (found ${steps.length})`);
  }

  // Rule 7: action table.
  const manifest = readJsonIfExists(join(entryDir, "actions.manifest.json")) as ActionManifestLike | null;
  if (manifest === null || !Array.isArray(manifest.actions)) {
    warnings.push("README.md: no actions.manifest.json; action table not checked");
  } else {
    const actions = sectionLines(readme, "What the agent can do");
    const tableLines = actions.lines.filter((l) => l.trim().startsWith("|"));
    if (!tableLines.some((l) => l.trim() === ACTION_TABLE_HEADER)) {
      problems.push(`README.md: action table header must be "${ACTION_TABLE_HEADER}"`);
    } else {
      const rows = tableLines.filter((l) => {
        const t = l.trim();
        return t !== ACTION_TABLE_HEADER && !/^\|[\s-|:]+\|$/.test(t);
      });
      const want = manifest.actions.filter((a) => a.name !== "get_capabilities").length;
      if (rows.length !== want) {
        problems.push(`README.md: action table has ${rows.length} rows, expected ${want}`);
      }
    }
  }

  // Rule 8: measured proof.
  const report = readJsonIfExists(join(entryDir, "evals", "report.json")) as { ceiling?: unknown } | null;
  if (!readme.includes("<!-- hee-eval:start -->") || !readme.includes("<!-- hee-eval:end -->")) {
    problems.push("README.md: eval markers <!-- hee-eval:start --> / <!-- hee-eval:end --> missing");
  } else if (report === null || typeof report.ceiling !== "string") {
    warnings.push("README.md: no evals/report.json; measured proof not checked");
  } else if (!readme.includes(report.ceiling)) {
    problems.push("README.md: report.ceiling sentence missing from ## Measured proof");
  }

  // Rule 9: evidence links.
  const evidence = sectionLines(readme, "Evidence");
  const evidenceLinks = findLinks(evidence.lines, evidence.startLine).filter((l) => !l.image);
  if (evidenceLinks.length < 3) {
    problems.push(`README.md: ## Evidence needs at least 3 links (found ${evidenceLinks.length})`);
  }

  // Rule 10: architecture fence.
  const arch = sectionLines(readme, "Architecture");
  const archText = arch.lines.join("\n");
  const fence = archText.match(/```[\s\S]*?```/);
  const fenceLines = fence ? fence[0].split("\n").slice(1, -1).length : 0;
  if (fenceLines < 5) {
    problems.push("README.md: ## Architecture needs a fenced block of at least 5 lines");
  }

  // Rule 11: licence.
  const licence = sectionLines(readme, "Licence and credits");
  const licenceText = licence.lines.join("\n");
  if (cfg?.license_name && !licenceText.includes(cfg.license_name)) {
    problems.push(`README.md: ## Licence and credits must mention "${cfg.license_name}"`);
  }
  if (!/upstream/i.test(licenceText)) {
    problems.push("README.md: ## Licence and credits must credit upstream");
  }

  // Rule 12: claims.
  for (const p of lintClaims(entryDir).problems) problems.push(`claims: ${p}`);

  return { problems, warnings };
}
