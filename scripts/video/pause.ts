// scripts/video/pause.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-03 step 4.
// Runs the stages up to the pause, prints the one message of §5.2, writes
// pause-receipt.json, exits 0 with `pause: awaiting the operator`.
// A second call while the receipt is open prints `pause: already waiting for
// the operator` and changes nothing.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { rehydrateEnv } from "./env-fresh.js";
import { PROJECT, readJson, runNode } from "./lib.js";

rehydrateEnv();
const receiptPath = `${PROJECT}/video/pause-receipt.json`;
if (existsSync(receiptPath)) {
  const open = readJson(receiptPath) as { resumedAt?: string | null };
  if (open.resumedAt === null || open.resumedAt === undefined) {
    console.log("pause: already waiting for the operator");
    process.exit(0);
  }
}

// Stages up to the pause (plates holds: never regenerates unprompted).
const built = runNode(["scripts/video/build-video.ts", "--from", "plates", "--to", "pause"]);
if (built.code !== 0) {
  console.error(`pause: build failed\n${built.out.split("\n").slice(-3).join("\n")}`);
  process.exit(1);
}

// Asset statuses: recompute each prompt SHA exactly like compose_plates.py.
const plates = readJson(`${PROJECT}/pitch/work/plates.json`) as {
  style?: string; negative?: string; plates?: { id?: string; prompt?: string }[];
};
const NO_TEXT = "Absolutely no text of any kind: no letters, no words, no numbers, no labels, no captions, no logos, no watermarks, no signage, no user interface chrome containing words.";
const shared = `${(plates.style ?? "").trim()}${plates.negative ? ` Avoid: ${plates.negative.trim()}.` : ""}`;
const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
const manifest = readJson(`${PROJECT}/pitch/work/video/plates/plates-manifest.json`) as {
  plates?: { id?: string; prompt_sha?: string }[];
};
const statusOf = (id: string): "ok" | "MISS" | "OLD" => {
  if (!existsSync(`${PROJECT}/pitch/${id}-image.png`)) return "MISS";
  const entry = (plates.plates ?? []).find((p) => p.id === id);
  const recorded = (manifest.plates ?? []).find((p) => p.id === id);
  const digest = sha([shared, (entry?.prompt ?? "").trim(), NO_TEXT].filter((x) => x !== "").join(" "));
  return recorded?.prompt_sha === digest ? "ok" : "OLD";
};
const assets = (["cover", "slide1", "slide2"] as const).map((id) => {
  const png = `${PROJECT}/pitch/${id}-image.png`;
  let size = "?";
  let time = "?";
  try {
    const buf = readFileSync(png);
    size = `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
    time = new Date(statSync(png).mtimeMs).toISOString().slice(0, 10);
  } catch { /* MISS keeps placeholders */ }
  return { id, png: `pitch/${id}-image.png`, size, time, status: statusOf(id) };
});

// The clock: the measured override when present (a diagnostic render with the
// pinned voice beats the cold default), else the plan-11 estimator + gaps.
const est = readJson(`${PROJECT}/video/facts/estimate.json`) as { total?: number };
let total = (est.total ?? 0) + 12.5;
let clockNote = "";
try {
  const override = readJson(`${PROJECT}/video/clock-override.json`) as { total_seconds?: number; note?: string };
  if (typeof override.total_seconds === "number" && override.total_seconds > 0) {
    total = override.total_seconds;
    clockNote = `measured, not estimated (${override.note ?? "see clock-override.json"})`;
  }
} catch { /* no override */ }
const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const wps = clockNote !== "" ? 2.04 : 2.75;
const wordsToChange = total >= 120 && total <= 150 ? 0 : Math.round(Math.abs(total - 135) * wps);

// SVG-with-text warning.
let warning = "";
try {
  const { readdirSync } = await import("node:fs") as typeof import("node:fs");
  for (const f of readdirSync(`${PROJECT}/pitch`)) {
    if (!f.endsWith(".svg")) continue;
    const svg = readFileSync(`${PROJECT}/pitch/${f}`, "utf8");
    if (/<text[\s>]/i.test(svg)) warning = `WARNING: pitch/${f} is a hand-drawn SVG with text; regenerate it`;
  }
} catch { /* no svgs */ }

// The receipt.
const now = new Date().toISOString();
writeFileSync(receiptPath, JSON.stringify({
  version: "1.0.0",
  pausedAt: now,
  resumedAt: null,
  pauses: 1,
  asked: ["speech", "length", "assets"],
  estimate: { total_seconds: Math.round(total * 10) / 10, window: [120, 150], words_to_change: wordsToChange },
  assets,
  answer: null,
}, null, 2) + "\n");

// The run log pauses once.
try {
  const p = `${PROJECT}/video/run-log.json`;
  const log = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>[] : [];
  log.push({ stage: "pause", startedAt: now, endedAt: now, status: "ok", stops: 1 });
  writeFileSync(p, `${JSON.stringify(log, null, 2)}\n`);
} catch { /* best-effort */ }

// The one message (§5.2, line for line; relative paths only).
const clockLine = total >= 120 && total <= 150 ? "inside the window" : `add or cut about ${wordsToChange} words (measured content, never filler)`;
const clockExtra = clockNote !== "" ? `\n    ${clockNote}` : "";
console.log(`THE ONE PAUSE — everything a person has to decide about this video is decided here.

(1) THE SPEECH — edit it until it sounds like a person:
    narration-review.md

(2) THE CLOCK — 13 segments, estimated ${mmss(total)} against the window 2:00–2:30 and the ceiling 2:45.
    ${clockLine}${clockExtra}

(3) THE PICTURES — open the three renders and judge them:`);
for (const a of assets) console.log(`    ${a.id.padEnd(7)} ${a.png}  ${a.size}  ${a.time}  ${a.status}`);
console.log(`    animatic: video/master-animatic.mp4 (480p; labelled colour fields; the arc, the pacing and the camera)`);
if (warning !== "") console.log(warning);
console.log(`
Reply once with: the edited speech (or "speech approved"), and "regenerate <ids>" for any picture to redo (or "pictures approved").
Nothing has been synthesized and no browser has been opened. After your reply the run goes on to final.mp4 without stopping again.`);
console.log("pause: awaiting the operator");
