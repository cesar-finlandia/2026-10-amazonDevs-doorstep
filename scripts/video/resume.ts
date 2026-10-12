// scripts/video/resume.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-04 step 1.
// Folds the operator's pause answer in: edited speech via --apply-review,
// picture regenerations (none when approved), cue/segment parity, resumedAt.
// Refuses while the receipt has answer null unless --approve-earlier "<reason>".
// Prints `resume: no answer recorded` (exit 1) or
// `resume: edits applied, <n> segments to re-voice`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PROJECT, readJson, runNode, runPy } from "./lib.js";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

interface Receipt {
  pausedAt?: string; resumedAt?: string | null; answer?: null | {
    speech?: string; length?: string; assets?: string; approved_by?: string;
    regenerate?: string[]; deviation?: string | null;
  };
}

const repPath = `${PROJECT}/video/pause-receipt.json`;
if (!existsSync(repPath)) {
  console.log("resume: no answer recorded");
  process.exit(1);
}
const rep = readJson(repPath) as Receipt;
const flagReason = arg("--approve-earlier");
if ((rep.answer === null || rep.answer === undefined) && flagReason === undefined) {
  console.log("resume: no answer recorded");
  process.exit(1);
}
if ((rep.answer === null || rep.answer === undefined) && flagReason !== undefined) {
  rep.answer = {
    speech: "approved as written",
    length: "approved as estimated",
    assets: "approved",
    approved_by: "earlier-approval-in-this-session",
    regenerate: [],
    deviation: flagReason,
  };
  const notesPath = `${PROJECT}/video/production-notes.md`;
  try {
    const notes = readFileSync(notesPath, "utf8");
    if (!notes.includes(flagReason)) {
      writeFileSync(notesPath, notes.replace("## Deviations\n", `## Deviations\n- resume: ${flagReason}\n`));
    }
  } catch { /* notes stay */ }
  writeFileSync(repPath, `${JSON.stringify(rep, null, 2)}\n`);
}

// 1. edited speech folds back in (no-op when the review matches).
const segs = `${PROJECT}/narration-segments.json`;
const review = `${PROJECT}/narration-review.md`;
const cap = (readJson(segs) as { cap_seconds?: number }).cap_seconds ?? 260;
let changed = 0;
if (existsSync(review)) {
  const r = runPy(["../../hackathons/_useful/scripts/render_narration.py", "--segments", segs,
    "--outdir", `${PROJECT}/video/narration`, "--cap-seconds", String(cap), "--apply-review"]);
  if (r.code !== 0) {
    console.error(`resume: apply-review failed\n${r.out.trim().split("\n").slice(-3).join("\n")}`);
    process.exit(1);
  }
  const m = /applied edits to (\d+) segment\(s\)/.exec(r.out);
  changed = m ? Number(m[1]) : 0;
}

// 2. picture regenerations for any reject ids (none when approved).
const regen = rep.answer?.regenerate ?? [];
if (regen.length > 0) {
  const a = runNode(["scripts/video/make-plates.ts", "--only", regen.join(",")]);
  if (a.code !== 0) {
    console.error(`resume: make-plates failed\n${a.out.trim().split("\n").slice(-3).join("\n")}`);
    process.exit(1);
  }
  const b = runNode(["scripts/video/render-pitch.ts"]);
  if (b.code !== 0) {
    console.error(`resume: render-pitch failed\n${b.out.trim().split("\n").slice(-3).join("\n")}`);
    process.exit(1);
  }
  const c = runNode(["scripts/video/check-pitch.ts"]);
  if (c.code !== 0) {
    console.error(`resume: check-pitch failed\n${c.out.trim().split("\n").slice(-3).join("\n")}`);
    process.exit(1);
  }
}

// 3. cues resolve, segments match the script.
const lint = runNode(["scripts/lint-cues.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
if (lint.code !== 0) {
  console.error(`resume: lint-cues failed`);
  process.exit(1);
}
const par = runNode(["scripts/video/script-to-segments.ts", "--check"]);
if (par.code !== 0 || !/parity yes/.test(par.out)) {
  console.error(`resume: segments parity failed\n${par.out.trim().split("\n").slice(-3).join("\n")}`);
  process.exit(1);
}

// 4. close the pause.
const now = new Date().toISOString();
(rep as Receipt).resumedAt = now;
writeFileSync(repPath, `${JSON.stringify(rep, null, 2)}\n`);
console.log(`resume: edits applied, ${changed} segments to re-voice`);
