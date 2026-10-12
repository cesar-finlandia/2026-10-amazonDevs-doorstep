// scripts/video/script-to-segments.ts — DP-SCRIPT WU-04.
// Section 4 prose → narration-segments.json (or --check parity).
// Prints `segments: <n> segments, <w> words, parity yes`.
import { readFileSync } from "node:fs";
import { PROJECT, readJson, writeJson, blocked } from "./lib.js";

const CUES: Record<string, { on: string; fire: string }[]> = {
  s1: [
    { on: "every event at her front door, by the hour", fire: "stage:caption" },
    { on: "This one spoke", fire: "stage:mark:0" },
  ],
  s2: [
    { on: "lives far away", fire: "statement:1" },
    { on: "take away her independence", fire: "statement:2" },
    // NOTE (chassis contradiction, recorded in sk-04): the §5.3 cue table
    // wants `statement:evidence` here, but the binding lint-cues only accepts
    // `statement:<n>` and fails the run otherwise. The evidence settles on
    // the scene's default timing instead; nothing is hidden, only uncued.
  ],
  s3: [
    { on: "Doorstep Rhythm", fire: "mechanism:name" },
    { on: "the Ring track", fire: "mechanism:track" },
    { on: "typed actions", fire: "mechanism:count" },
    { on: "a truth engine", fire: "mechanism:code" },
  ],
  // s3b carries pulse only: the §5.3 table's `arch:proof` cue cannot coexist
  // with the chassis 8 s optional-insert cap under this estimator (the style
  // prefix alone costs ~4 s), so the proof frame is shown, not named.
  s3b: [
    { on: "Ring", fire: "arch:pulse:ring" },
  ],
  s4: [{ on: "We load the sample week", fire: "demo:week" }],
  s6: [
    { on: "how the agent works, step by step", fire: "stage:caption" },
    { on: "extractor", fire: "stage:pulse:extractor" },
    { on: "planner", fire: "stage:pulse:planner" },
    { on: "actor", fire: "stage:pulse:actor" },
    { on: "The truth engine", fire: "stage:pulse:truth" },
  ],
  s7: [{ on: "Review the week", fire: "demo:review" }],
  s9: [{ on: "circled in pencil", fire: "demo:moment" }],
  s10: [{ on: "Here is the request", fire: "demo:decision" }],
  s11: [
    { on: "the errors the engine found, pass by pass", fire: "stage:caption" },
    { on: "start high", fire: "stage:mark:0" },
    { on: "end at zero", fire: "stage:mark:1" },
  ],
};

const FRAMES: Record<string, string> = {
  s1: "stage3d.json#cold",
  s2: "pitch/slide1.html",
  s3: "/",
  s3b: "/",
  s4: "/",
  s5: "/",
  s6: "stage3d-2.json#wow",
  s7: "/",
  s8: "/",
  s9: "/",
  s10: "/",
  s11: "stage3d-3.json#wow",
  s12: "pitch/cover.html",
};

const EMPHASIS: Record<string, string[]> = {
  s1: ["the hour that did not fit"],
  s10: ["Here is the request"],
  s12: ["Know her day without calling."],
};

function readScript(): { ids: string[]; prose: Map<string, string> } {
  const md = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8").replace(/\r/g, "");
  const ids: string[] = [];
  const prose = new Map<string, string>();
  const lines = md.split("\n");
  let cur: string | null = null;
  let buf: string[] = [];
  const flush = (): void => {
    if (cur !== null) prose.set(cur, buf.join("\n").trim());
    cur = null;
    buf = [];
  };
  for (const line of lines) {
    const m = /^<!-- seg: (\S+) -->/.exec(line.trim());
    if (m) {
      flush();
      cur = m[1] as string;
      ids.push(cur);
      continue;
    }
    if (cur !== null) {
      // A new ## section ends the block (timed ### headings belong to it).
      if (/^## \d\. /.test(line)) {
        flush();
        continue;
      }
      buf.push(line);
    }
  }
  flush();
  return { ids, prose };
}

function spokenOf(block: string): string {
  return block
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return t !== "" && !t.startsWith("**[Visual:") && !t.startsWith("*(") && !t.startsWith("<!--") && !t.startsWith("###");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const ORDER = ["s1", "s2", "s3", "s3b", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"];
const { ids, prose } = readScript();
if (JSON.stringify(ids) !== JSON.stringify(ORDER)) blocked(`script-to-segments: seg markers are [${ids.join(",")}], want [${ORDER.join(",")}]`);

const segments = ORDER.map((id) => {
  const text = spokenOf(prose.get(id) ?? "");
  if (text === "") blocked(`script-to-segments: empty prose for ${id}`);
  const seg: Record<string, unknown> = {
    id,
    text,
    frame: FRAMES[id] ?? "/",
    cues: (CUES[id] ?? []).map((c) => ({ ...c })),
  };
  if (EMPHASIS[id] !== undefined) seg["emphasis"] = EMPHASIS[id];
  return seg;
});

const header = {
  project: "2026-10-amazonDevs",
  voice: "Iapetus",
  style: "Confident documentary narrator. Warm, clear and brisk, around one hundred fifty-five words per minute. A short pause between sentences; no pauses inside short sentences.",
  cap_seconds: 260,
  cap_quote: "under 3 minutes (judges not required to watch past 3:00)",
  // Operator deviation 2026-10-11: the measured voice runs ~4:00 against the
  // brief's 3:00 cap. The cap_quote above stays the brief verbatim; the raised
  // cap_seconds carries the accepted deviation (production notes §8).
  segments,
};

if (process.argv.includes("--check")) {
  const live = readJson(`${PROJECT}/narration-segments.json`) as {
    segments?: { id?: string; text?: string }[];
  };
  const wantIds = segments.map((s) => s.id as string).join("\n");
  const wantText = segments.map((s) => s.text as string).join("\n");
  const gotIds = (live.segments ?? []).map((s) => s.id ?? "").join("\n");
  const gotText = (live.segments ?? []).map((s) => s.text ?? "").join("\n");
  const norm = (t: string): string => t.replace(/\s+/g, " ").trim();
  if (wantIds !== gotIds || norm(wantText) !== norm(gotText)) {
    const a = norm(wantText).split(" ");
    const b = norm(gotText).split(" ");
    let i = 0;
    while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    console.log(`segments: differs at word ${i} (${a.slice(i, i + 4).join(" ")} vs ${b.slice(i, i + 4).join(" ")})`);
    process.exit(1);
  }
  const words = norm(wantText).split(" ").filter((w) => w !== "").length;
  console.log(`segments: ${segments.length} segments, ${words} words, parity yes`);
} else {
  writeJson(`${PROJECT}/narration-segments.json`, header);
  const words = segments.map((s) => s.text as string).join(" ").split(/\s+/).filter((w) => w !== "").length;
  console.log(`segments: ${segments.length} segments, ${words} words, parity yes`);
}
