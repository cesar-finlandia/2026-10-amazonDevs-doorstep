// scripts/video/build-video.ts — DP-LIVE-RUN-AND-VIDEO stage runner.
// Wraps video_build.py with the run log kept.
// Usage: npx vite-node scripts/video/build-video.ts [--from <stage>] [--to <stage>]
// Prints one line per stage run.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { rehydrateEnv } from "./env-fresh.js";
import { PROJECT } from "./lib.js";

rehydrateEnv();
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const from = arg("--from");
const to = arg("--to");
const stages = ["gate", "plates", "pause", "voice", "cues", "capture", "storyboard", "bed", "render", "finalize", "verify"];
const args = ["../../hackathons/_useful/scripts/video_build.py", PROJECT];
if (from) args.push("--from", from);
if (to) args.push("--to", to);
args.push("--url", (JSON.parse(readFileSync(`${PROJECT}/deploy-record.json`, "utf8")) as { url?: string }).url ?? "");
const ran: string[] = [];
for (const s of stages) {
  if (from && stages.indexOf(s) < stages.indexOf(from)) continue;
  if (to && stages.indexOf(s) > stages.indexOf(to)) continue;
  ran.push(s);
}
const r = spawnSync("python3", args, { cwd: process.cwd(), encoding: "utf8", timeout: 3600000 });
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
if ((r.status ?? 1) !== 0) {
  console.error(`build-video: stage failed (exit ${r.status})`);
  process.exit(r.status ?? 1);
}
// Keep the run log: one entry per stage run (gate and pause are owned by
// live-gate.ts and pause.ts/resume.ts and would double-log here).
try {
  const p = `${PROJECT}/video/run-log.json`;
  const log = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>[] : [];
  const now = new Date().toISOString();
  for (const s of ran) {
    if (s === "gate" || s === "pause") continue;
    if (!log.some((e) => e.stage === s)) {
      log.push({ stage: s, startedAt: now, endedAt: now, status: "ok", stops: 0 });
    }
  }
  writeFileSync(p, `${JSON.stringify(log, null, 2)}\n`);
} catch { /* log append best-effort */ }
for (const s of ran) console.log(`build-video: stage ${s} done`);
