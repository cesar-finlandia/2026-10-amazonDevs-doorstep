// scripts/check-entry-layout.ts — DP-SUBMISSION WU-09.
// Prints `layout: OK` or `layout: <path> is not allowed`.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync("config/entry-layout.json", "utf8")) as {
  allowedFiles?: string[]; allowedDirs?: string[]; ignoredButPresent?: string[];
};
const files = new Set(cfg.allowedFiles ?? []);
const dirs = new Set(cfg.allowedDirs ?? []);
const ignored = new Set(cfg.ignoredButPresent ?? []);

function runGit(args: string[]): string[] {
  const r = spawnSync("git", args, { encoding: "utf8", shell: true });
  return `${r.stdout ?? ""}`.split("\n").map((l) => l.trim()).filter((l) => l !== "");
}

const tracked = runGit(["ls-files"]);
const untracked: string[] = [];
{
  // Unignored untracked files (respects .gitignore).
  const r = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8", shell: true });
  for (const line of `${r.stdout ?? ""}`.split("\n")) {
    const m = /^\?\? (.+)$/.exec(line.trim());
    if (m) untracked.push((m[1] as string).replace(/\/$/, ""));
  }
  const ign = runGit(["ls-files", "--others", "--ignored", "--exclude-standard"]);
  const ignSet = new Set(ign.map((p) => p.replace(/\/$/, "")));
  for (let i = untracked.length - 1; i >= 0; i--) {
    if (ignSet.has(untracked[i] as string)) untracked.splice(i, 1);
  }
}

const bad: string[] = [];
for (const p of [...tracked, ...untracked]) {
  const top = p.includes("/") ? (p.split("/")[0] as string) : p;
  if (files.has(p) || dirs.has(top) || ignored.has(top) || ignored.has(p)) continue;
  bad.push(p);
}
if (bad.length > 0) {
  console.log(`layout: ${bad[0]} is not allowed`);
  process.exit(1);
}
console.log("layout: OK");
