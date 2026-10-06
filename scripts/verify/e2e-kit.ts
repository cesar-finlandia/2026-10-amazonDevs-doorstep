// scripts/verify/e2e-kit.ts — shared by the twelve E2E scripts (DP-E2E-BROWSER-TESTING §7).
// Requirement IDs: FR-24
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

export interface RunResult {
  code: number;
  out: string;
}

/** Spawns a command and returns its exit code with combined stdout+stderr output. */
export function run(
  cmd: string,
  args: string[],
  opts?: { env?: Record<string, string | undefined>; timeout?: number },
): RunResult {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    timeout: opts?.timeout ?? 600000,
    env: { ...process.env, ...(opts?.env ?? {}) },
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export interface WrapperResult extends RunResult {
  line: string;
}

/** Runs scripts/e2e-run.ts with --label and returns its summary line. */
export function wrapper(
  label: string,
  files: string[],
  extra?: { env?: Record<string, string | undefined>; twice?: boolean; list?: boolean; timeout?: number },
): WrapperResult {
  const args = ["vite-node", "scripts/e2e-run.ts", "--label", label];
  if (extra?.list === true) args.push("--list");
  if (extra?.twice === true) args.push("--twice");
  args.push(...files);
  const r = run("npx", args, { env: extra?.env, timeout: extra?.timeout });
  const line = r.out
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(`${label}: `)) ?? "";
  return { code: r.code, out: r.out, line };
}

function stripCell(c: string): string {
  return c.trim().replace(/`/g, "");
}

/** Parses the data rows of a pipe table of a markdown file into cell arrays
 *  (backticks removed). With `heading`, reads the first pipe table under the
 *  `## ` heading containing that text; otherwise the first table of the file. */
export function readTable(path: string, heading?: string): string[][] {
  const lines = readFileSync(path, "utf8").split("\n");
  let start = 0;
  if (heading !== undefined) {
    const at = lines.findIndex((l) => l.startsWith("## ") && l.includes(heading));
    if (at < 0) throw new Error(`no heading containing "${heading}" in ${path}`);
    start = at + 1;
  }
  for (let i = start; i + 1 < lines.length; i++) {
    const head = (lines[i] as string).trim();
    const sepr = (lines[i + 1] as string).trim();
    if (!head.startsWith("|") || !head.includes("|")) continue;
    if (!/^\|?[\s:|-]+\|?[\s:|.-]*$/.test(sepr) || !sepr.includes("-")) continue;
    const rows: string[][] = [];
    for (let k = i + 2; k < lines.length; k++) {
      const row = (lines[k] as string).trim();
      if (!row.startsWith("|")) break;
      rows.push(row.split("|").slice(1, -1).map(stripCell));
    }
    return rows;
  }
  throw new Error(`no pipe table${heading === undefined ? "" : ` under "${heading}"`} in ${path}`);
}

function globToRegExp(glob: string): RegExp {
  const norm = glob.split(sep).join("/");
  let re = "";
  for (let i = 0; i < norm.length; i++) {
    const ch = norm[i] as string;
    if (ch === "*" && norm[i + 1] === "*") {
      re += ".*";
      i += 1;
      if (norm[i + 1] === "/") i += 1;
    } else if (ch === "*") {
      re += "[^/]*";
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

/** Lists repository files (tracked or not) matching a simple glob with `*`, `**`, `?`. */
export function repoFiles(glob: string): string[] {
  const re = globToRegExp(glob);
  const found: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git") continue;
      const p = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(p).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        walk(p);
      } else if (re.test(p.split(sep).join("/"))) {
        found.push(p.split(sep).join("/"));
      }
    }
  };
  walk(".");
  if (existsSync(glob) && !found.includes(glob)) found.push(glob);
  return found.sort();
}

/** Runs `git <args>` and returns its exit code with combined output. */
export function git(args: string[]): RunResult {
  return run("git", args);
}
