// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §3.4 judge kit: JUDGES.md is generated from showcase.json, never hand-edited.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LintResult, ShowcaseConfig } from "./types.js";

export interface JudgeKitLint extends LintResult {
  note: string;
}

export interface OnlineCheck {
  fetch?: (url: string) => Promise<{ status: number }>;
  online?: boolean;
}

/** Text of §4.2 with the data filled, no other prose. */
export function renderJudgeKit(cfg: ShowcaseConfig): string {
  const path = cfg.sixty_second_path.map((s, i) => `${i + 1}. ${s.step} — you should see: ${s.expect}`).join("\n");
  const prompts = cfg.try_prompts.map((p, i) => `${i + 1}. \`${p}\``).join("\n");
  const gaps =
    cfg.known_gaps.length === 0 ? "Known gaps: None known." : `Known gaps:\n${cfg.known_gaps.map((g) => `- ${g}`).join("\n")}`;
  const axes = cfg.axes
    .map((a) => `| ${a.criterion} | ${a.evidence.map((e) => `[${e.label}](${e.link})`).join(" · ")} |`)
    .join("\n");
  return [
    "# Judges' guide",
    "",
    `**Live:** ${cfg.live_url}`,
    `**Video:** ${cfg.video_url}`,
    `**Repository:** ${cfg.repo_url}`,
    "",
    "## The 60-second path",
    path,
    "",
    "## Three prompts to try",
    prompts,
    "",
    "## Where it runs",
    `Supported: ${cfg.supported_runtimes.join(", ")}`,
    gaps,
    "",
    "## Criteria → evidence",
    "| Criterion | Where to see it |",
    "|---|---|",
    axes,
    "",
  ].join("\n");
}

function readConfig(entryDir: string): ShowcaseConfig | null {
  const path = join(entryDir, "design_documents", "showcase.json");
  if (!existsSync(path)) return null;
  try {
    const doc = JSON.parse(readFileSync(path, "utf8")) as ShowcaseConfig;
    if (typeof doc !== "object" || doc === null || !Array.isArray((doc as { axes?: unknown }).axes)) return null;
    return doc;
  } catch {
    return null;
  }
}

function isHttp(link: string): boolean {
  return /^https?:\/\//i.test(link);
}

async function defaultFetch(url: string): Promise<{ status: number }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return { status: res.status };
}

/** DP-W09 §3.4 lintJudgeKit. */
export async function lintJudgeKit(entryDir: string, opts?: OnlineCheck): Promise<JudgeKitLint> {
  const problems: string[] = [];
  const warnings: string[] = [];
  const cfg = readConfig(entryDir);
  if (cfg === null) {
    return { problems: ["design_documents/showcase.json not found or invalid"], warnings, note: "" };
  }
  const judgesPath = join(entryDir, "JUDGES.md");
  if (!existsSync(judgesPath) || readFileSync(judgesPath, "utf8") !== renderJudgeKit(cfg)) {
    problems.push("JUDGES.md is hand-edited or missing; run judge-kit render");
  }

  if (!Array.isArray(cfg.try_prompts) || cfg.try_prompts.length !== 3) {
    problems.push("showcase.json: try_prompts needs exactly 3 prompts");
  } else {
    cfg.try_prompts.forEach((p, i) => {
      if (typeof p !== "string" || p.length < 8 || p.length > 200) {
        problems.push(`showcase.json: try_prompts[${i}] must be 8-200 characters`);
      }
    });
  }
  if (!Array.isArray(cfg.sixty_second_path) || cfg.sixty_second_path.length < 3 || cfg.sixty_second_path.length > 6) {
    problems.push("showcase.json: sixty_second_path needs 3-6 steps");
  } else {
    cfg.sixty_second_path.forEach((s, i) => {
      if (typeof s?.step !== "string" || s.step.length === 0) {
        problems.push(`showcase.json: sixty_second_path[${i}].step must be non-empty`);
      }
      if (typeof s?.expect !== "string" || s.expect.length === 0) {
        problems.push(`showcase.json: sixty_second_path[${i}].expect must be non-empty`);
      }
    });
  }
  if (!Array.isArray(cfg.axes) || cfg.axes.length < 3) {
    problems.push("showcase.json: axes needs at least 3 criteria");
  } else {
    cfg.axes.forEach((a, i) => {
      if (!Array.isArray(a?.evidence) || a.evidence.length < 1) {
        problems.push(`showcase.json: axes[${i}] needs at least 1 evidence link`);
      }
    });
  }
  if (!Array.isArray(cfg.supported_runtimes) || cfg.supported_runtimes.length === 0) {
    problems.push("showcase.json: supported_runtimes must be non-empty");
  }
  if (!Array.isArray(cfg.known_gaps) || cfg.known_gaps.length === 0) {
    warnings.push("showcase.json: known_gaps is empty");
  }

  const httpLinks: string[] = [];
  for (const url of [cfg.live_url, cfg.video_url, cfg.repo_url]) {
    if (typeof url === "string" && isHttp(url)) httpLinks.push(url);
  }
  for (const axis of cfg.axes ?? []) {
    for (const e of axis?.evidence ?? []) {
      if (typeof e?.link !== "string") continue;
      if (isHttp(e.link)) httpLinks.push(e.link);
      else if (!existsSync(join(entryDir, ...e.link.split("/")))) {
        problems.push(`showcase.json: evidence link "${e.link}" not found`);
      }
    }
  }

  let note = "";
  if (opts?.online === true) {
    const runFetch = opts.fetch ?? defaultFetch;
    for (const url of httpLinks) {
      try {
        const res = await runFetch(url);
        if (res.status >= 400) problems.push(`link "${url}" answered ${res.status}`);
      } catch {
        problems.push(`link "${url}" could not be fetched`);
      }
    }
  } else {
    note = "links not checked online";
  }

  const briefPath = join(entryDir, "design_documents", "hackathon_brief.md");
  if (existsSync(briefPath)) {
    const brief = readFileSync(briefPath, "utf8").toLowerCase();
    for (const axis of cfg.axes ?? []) {
      if (typeof axis?.criterion === "string" && !brief.includes(axis.criterion.toLowerCase())) {
        warnings.push(`criterion "${axis.criterion}" not found in the brief`);
      }
    }
  }

  return { problems, warnings, note };
}

/** Write JUDGES.md from showcase.json. */
export function renderJudgeKitTo(entryDir: string): { ok: boolean; message: string } {
  const cfg = readConfig(entryDir);
  if (cfg === null) return { ok: false, message: "design_documents/showcase.json not found or invalid" };
  writeFileSync(join(entryDir, "JUDGES.md"), renderJudgeKit(cfg), "utf8");
  return { ok: true, message: "wrote JUDGES.md" };
}
