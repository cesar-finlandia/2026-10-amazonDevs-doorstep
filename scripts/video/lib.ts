// scripts/video/lib.ts — DP-SCRIPT shared helpers (§3.6 literal).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const PROJECT = "../../hackathons/hackathon-projects/2026-10-amazonDevs";
export const CHASSIS = "../../hackathons";

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function runNode(args: string[], cwd?: string): { code: number; out: string } {
  const r = spawnSync("npx", ["vite-node", ...args], { cwd: cwd ?? process.cwd(), encoding: "utf8", shell: true, timeout: 3600000 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function runPy(args: string[], cwd?: string): { code: number; out: string } {
  const r = spawnSync("python3", args, { cwd: cwd ?? process.cwd(), encoding: "utf8", shell: true, timeout: 600000 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
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

export function estimate(file: string): { perSegment: Record<string, number>; total: number; cold: boolean } {
  const r = runPy([`${CHASSIS}/_useful/scripts/tts_vertex.py`, "--batch", file, "--estimate"]);
  const perSegment: Record<string, number> = {};
  let total = 0;
  let cold = false;
  for (const line of r.out.split("\n")) {
    const m = /^(\S+)\s+words=(\d+)\s+syllables=(\d+)\s+estimate=([\d.]+)s/.exec(line.trim());
    if (m) perSegment[m[1] as string] = Number(m[4]);
    const t = /^TOTAL\s+.*estimate=([\d.]+)s/.exec(line.trim());
    if (t) total = Number(t[1]);
    if (/cold/i.test(line)) cold = true;
  }
  if (r.code !== 0 && total === 0) cold = true;
  return { perSegment, total, cold };
}
