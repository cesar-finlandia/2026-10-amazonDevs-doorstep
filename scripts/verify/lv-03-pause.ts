// scripts/verify/lv-03-pause.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-03 (10 checks).
// One pause carrying speech, clock and pictures; nothing synthesized or
// recorded; it cannot repeat by accident. The clock dispute (measured 224s
// vs cold 123s) is recorded with all three numbers, not papered over.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { check, done, runNode } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const absPath = (s: string): boolean => /[A-Za-z]:\\/.test(s) || /"\/[^"]/.test(s) || s.includes('"~/');
const noSecrets = (s: string): boolean => !/AKIA|Bearer [A-Za-z0-9_\-]{16,}/.test(s);

// 1. the gate is idempotent and green: exit 0 without changes. Before the
// answer it waits; after resume (answer recorded, WU-LIVE-04) it reports the
// pause answered and still changes nothing (no second pause opens).
{
  const repBefore = createHash("sha256").update(readFileSync(`${PROJECT}/video/pause-receipt.json`, "utf8")).digest("hex");
  const r = runNode(["scripts/video/pause.ts"]);
  const repAfter = createHash("sha256").update(readFileSync(`${PROJECT}/video/pause-receipt.json`, "utf8")).digest("hex");
  const lines = r.out.replace(/\r/g, "").trim().split("\n").map((l) => l.trim());
  const settled = lines.some((l) => l === "pause: awaiting the operator" || l === "pause: already waiting for the operator" ||
    l === "pause: already answered");
  t(r.code === 0 && settled && repBefore === repAfter, "pause exits 0, settled line, receipt stable");
}

// 2. the receipt asked the three things; after resume it carries the answer
// (phase evolution WU-LIVE-04: open-pause assertions retire once answered).
{
  const receipt = readJson(`${PROJECT}/video/pause-receipt.json`) as {
    pauses?: number; asked?: string[]; resumedAt?: string | null; pausedAt?: string; answer?: null | {
      speech?: string; length?: string; assets?: string; approved_by?: string; regenerate?: string[];
    };
  };
  const open = receipt.resumedAt === null || receipt.resumedAt === undefined;
  const askedOk = receipt.pauses === 1 && JSON.stringify(receipt.asked) === JSON.stringify(["speech", "length", "assets"]);
  const answeredOk = !open && receipt.answer !== null && receipt.answer !== undefined &&
    typeof receipt.answer.speech === "string" && typeof receipt.answer.length === "string" &&
    typeof receipt.answer.assets === "string" && typeof receipt.answer.approved_by === "string" &&
    Array.isArray(receipt.answer.regenerate) &&
    (receipt.resumedAt ?? "") > (receipt.pausedAt ?? "z");
  t(askedOk && (open ? receipt.answer === null : answeredOk),
    open ? "receipt: 1 pause, 3 asks, awaiting answer" : "receipt: 1 pause, 3 asks, answered with resumedAt");
}

// 3. the pause fired before any synthesis or footage (phase evolution:
// after resume, assert the pause PREDATES the voice by file time — the order
// the gate certified, not an eternal absence of voice).
{
  const { statSync } = await import("node:fs") as typeof import("node:fs");
  const rep = readJson(`${PROJECT}/video/pause-receipt.json`) as { pausedAt?: string };
  const pausedAt = Date.parse(rep.pausedAt ?? "");
  let wavs: string[] = [];
  try {
    const { readdirSync } = await import("node:fs") as typeof import("node:fs");
    wavs = readdirSync(`${PROJECT}/video/narration`).filter((f) => /\.(wav|mp4|srt)$/.test(f));
  } catch { /* narration/ absent counts as pre-voice */ }
  const clean = !existsSync(`${PROJECT}/video/master-silent.mp4`) && !existsSync(`${PROJECT}/video/capture-geometry.json`);
  let orderOk = true;
  for (const f of wavs) {
    try {
      if (statSync(`${PROJECT}/video/narration/${f}`).mtimeMs <= pausedAt) orderOk = false;
    } catch { /* ignore */ }
  }
  t(clean && orderOk && Number.isFinite(pausedAt), wavs.length === 0 ? "no voice, no footage yet" : `pause predates ${wavs.length} narration files`);
}

// 4. the animatic exists, small, and carries no sound (the chassis muxes a
// silent filler track; silence, not stream absence, is what proves nothing
// was synthesized), with duration within 10% of the storyboard beats.
{
  const { spawnSync } = await import("node:child_process") as typeof import("node:child_process");
  const probe = (a: string[]): string => {
    const r = spawnSync("ffprobe", ["-v", "error", ...a, `${PROJECT}/video/master-animatic.mp4`],
      { encoding: "utf8", timeout: 120000, shell: true });
    return (((r.stdout ?? "").trim().match(/[\d.]+/) ?? [""])[0] ?? "");
  };
  const h = Number(probe(["-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0"]));
  const hasAudio = probe(["-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0"]) !== "";
  let meanDb = -100;
  if (hasAudio) {
    const v = spawnSync("ffmpeg",
      ["-i", `${PROJECT}/video/master-animatic.mp4`, "-af", "volumedetect", "-vn", "-f", "null", "NUL"],
      { encoding: "utf8", timeout: 600000, shell: true });
    const m = /mean_volume:\s*(-?[\d.]+)\s*dB/.exec(`${v.stderr ?? ""}`);
    meanDb = m ? Number(m[1]) : 0;
  }
  const dur = Number(probe(["-show_entries", "format=duration", "-of", "csv=p=0"]));
  const sb = readJson(`${PROJECT}/video/storyboard-estimate.json`) as { beats?: { start?: number; end?: number }[] };
  const beats = (sb.beats ?? []).reduce((a, b) => a + (b.end ?? 0) - (b.start ?? 0), 0);
  t(existsSync(`${PROJECT}/video/master-animatic.mp4`) && h > 0 && h <= 480 && meanDb <= -60 &&
    Math.abs(dur - beats) / beats <= 0.1, `animatic ${h}p ${meanDb}dB ${dur.toFixed(0)}s vs beats ${beats.toFixed(0)}s`);
}

// 5. the clock dispute is recorded with all three numbers.
{
  const receipt = readJson(`${PROJECT}/video/pause-receipt.json`) as {
    estimate?: { total_seconds?: number; window?: number[] };
  };
  const override = readJson(`${PROJECT}/video/clock-override.json`) as { total_seconds?: number };
  const notes = readFileSync(`${PROJECT}/video/production-notes.md`, "utf8");
  t(JSON.stringify(receipt.estimate?.window) === JSON.stringify([120, 150]) &&
    receipt.estimate?.total_seconds === override.total_seconds &&
    notes.includes("clock dispute") && notes.includes("224.0") && notes.includes("195.8"),
    "receipt carries measured clock, dispute documented with plan-11/storyboard/measured");
}

// 6. the message has the skeleton's parts and no absolute path. The live
// receipt is open, so pause.ts answers idempotently; validate the full
// message from a sheltered fresh run (receipt + run-log restored after).
{
  const repPath = `${PROJECT}/video/pause-receipt.json`;
  const logPath = `${PROJECT}/video/run-log.json`;
  const { readFileSync: rf, writeFileSync: wf } = await import("node:fs") as typeof import("node:fs");
  const repBackup = rf(repPath, "utf8");
  const logBackup = rf(logPath, "utf8");
  try { (await import("node:fs") as typeof import("node:fs")).unlinkSync(repPath); } catch { /* keep */ }
  const r = runNode(["scripts/video/pause.ts"]);
  const out = r.out.replace(/\r/g, "");
  const lines = out.trim().split("\n").map((l) => l.trim());
  const assetLines = (out.match(/^ {4}(cover|slide1|slide2) +\S+ +\S+ +\S+ +(ok|MISS|OLD)$/gm) ?? []).length;
  const pass = r.code === 0 && out.includes("(1) THE SPEECH") && out.includes("(2) THE CLOCK") &&
    out.includes("(3) THE PICTURES") && assetLines === 3 && out.includes("animatic: video/master-animatic.mp4") &&
    out.includes("Reply once with:") && lines.some((l) => l === "pause: awaiting the operator") &&
    !absPath(out) && noSecrets(out);
  wf(repPath, repBackup);
  wf(logPath, logBackup);
  t(pass, "message: 3 asks, 3 asset lines, animatic, closing; no paths or secrets");
}

// 7. all three assets ok (a MISS/OLD names DP-SCRIPT by failing here).
{
  const receipt = readJson(`${PROJECT}/video/pause-receipt.json`) as {
    assets?: { id?: string; png?: string; status?: string }[];
  };
  const assets = receipt.assets ?? [];
  t(assets.length === 3 && assets.every((a) => a.status === "ok" && existsSync(`${PROJECT}/${a.png}`)),
    "cover, slide1, slide2 ok with existing PNGs");
}

// 8. the run log stopped exactly once, at the pause.
{
  const log = readJson(`${PROJECT}/video/run-log.json`) as { stage?: string; stops?: number }[];
  const ones = log.filter((e) => e.stops === 1);
  t(ones.length === 1 && ones[0]?.stage === "pause" && log.every((e) => e.stops === 0 || e.stage === "pause"),
    "run-log: one stop, at pause");
}

// 9. repetition changes nothing (covered with check 1's hash; plus log length).
{
  const before = (readJson(`${PROJECT}/video/run-log.json`) as unknown[]).length;
  runNode(["scripts/video/pause.ts"]);
  const after = (readJson(`${PROJECT}/video/run-log.json`) as unknown[]).length;
  t(before === after, "second pause call appends nothing");
}

// 10. this unit's files hold no token, value, or absolute path.
{
  const files = ["pause-receipt.json", "clock-override.json", "run-log.json", "storyboard-estimate.json"];
  const raws = files.map((f) => {
    try { return readFileSync(`${PROJECT}/video/${f}`, "utf8"); } catch { return ""; }
  });
  t(raws.every((s) => !absPath(s) && noSecrets(s)), "pause files path- and token-free");
}

done("lv-03-pause", n, failures);
