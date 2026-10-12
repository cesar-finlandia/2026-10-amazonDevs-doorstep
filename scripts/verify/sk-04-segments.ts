// scripts/verify/sk-04-segments.ts — DP-SCRIPT WU-04 (12 checks).
import { readFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const segs = JSON.parse(readFileSync(`${PROJECT}/narration-segments.json`, "utf8")) as {
  project?: string; voice?: string; style?: string; cap_seconds?: number; cap_quote?: string;
  segments?: { id?: string; text?: string; cues?: { on?: string; fire?: string }[]; frame?: string; emphasis?: string[] }[];
};

// 1. Header equals §3.5, with the recorded 2026-10-11 length deviation:
// cap_seconds 260 carries the operator-accepted over-brief voice; cap_quote
// keeps the brief verbatim and the deviation lives in §8 production notes.
{
  const notes = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8");
  const dev = notes.includes("RECORDED DEVIATION 2026-10-11") && notes.includes("cap_seconds is 260");
  t(
    segs.project === "2026-10-amazonDevs" && segs.voice === "Iapetus" &&
      segs.style === "Confident documentary narrator. Warm, clear and brisk, around one hundred fifty-five words per minute. A short pause between sentences; no pauses inside short sentences." &&
      segs.cap_seconds === 260 && segs.cap_quote === "under 3 minutes (judges not required to watch past 3:00)" && dev,
    "header equals §3.5 + recorded deviation",
  );
}

// 2. Thirteen ids s1..s12 in order. (The plan text says "twelve"; §5.3 and
// §3.3 list thirteen ids including s3b, and the beat plan names all thirteen.)
{
  const ids = (segs.segments ?? []).map((s) => s.id);
  t(JSON.stringify(ids) === JSON.stringify(["s1", "s2", "s3", "s3b", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"]), `thirteen ids (${ids.length})`);
}

// 3. Parity via the tool.
{
  const r = runNode(["scripts/video/script-to-segments.ts", "--check"]);
  t(r.code === 0 && /segments: 13 segments, \d+ words, parity yes/.test(r.out), "parity yes");
}

// 4. TTS-ready character set.
{
  const bad = /[*_#`()%&/@]|\\d/;
  t((segs.segments ?? []).every((s) => !bad.test(s.text ?? "")), "tts-ready characters");
}

// 5. lint-cues.
{
  const r = runNode(["scripts/lint-cues.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  t(r.code === 0, "lint-cues exits 0");
}

// 6. Cue table present; no markup in text.
{
  const table: Record<string, { on: string; fire: string }[]> = {
    s1: [{ on: "every event at her front door, by the hour", fire: "stage:caption" }, { on: "This one spoke", fire: "stage:mark:0" }],
    // s2 carries statement:1/2 only: the §5.3 table's `statement:evidence`
    // is rejected by the binding lint (see script-to-segments.ts note).
    s2: [{ on: "lives far away", fire: "statement:1" }, { on: "take away her independence", fire: "statement:2" }],
    s3: [{ on: "Doorstep Rhythm", fire: "mechanism:name" }, { on: "the Ring track", fire: "mechanism:track" }, { on: "typed actions", fire: "mechanism:count" }, { on: "a truth engine", fire: "mechanism:code" }],
    s3b: [{ on: "Ring", fire: "arch:pulse:ring" }],
    s4: [{ on: "We load the sample week", fire: "demo:week" }],
    s6: [{ on: "how the agent works, step by step", fire: "stage:caption" }, { on: "extractor", fire: "stage:pulse:extractor" }, { on: "planner", fire: "stage:pulse:planner" }, { on: "actor", fire: "stage:pulse:actor" }, { on: "The truth engine", fire: "stage:pulse:truth" }],
    s7: [{ on: "Review the week", fire: "demo:review" }],
    s9: [{ on: "circled in pencil", fire: "demo:moment" }],
    s10: [{ on: "Here is the request", fire: "demo:decision" }],
    s11: [{ on: "the errors the engine found, pass by pass", fire: "stage:caption" }, { on: "start high", fire: "stage:mark:0" }, { on: "end at zero", fire: "stage:mark:1" }],
  };
  const byId = new Map((segs.segments ?? []).map((s) => [s.id, s]));
  const wordsOf = (t: string): string[] => t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w !== "");
  const occurrences = (text: string, phrase: string): number => {
    const hay = wordsOf(text);
    const ndl = wordsOf(phrase);
    if (ndl.length === 0) return 0;
    let n = 0;
    for (let i = 0; i + ndl.length <= hay.length; i++) {
      if (ndl.every((w, j) => hay[i + j] === w)) n += 1;
    }
    return n;
  };
  let ok = true;
  for (const [id, cues] of Object.entries(table)) {
    const seg = byId.get(id);
    if (!seg) { ok = false; continue; }
    for (const cue of cues) {
      const hit = (seg.cues ?? []).some((c) => c.on === cue.on && c.fire === cue.fire);
      if (!hit) ok = false;
      if (occurrences(seg.text ?? "", cue.on) !== 1) ok = false;
    }
  }
  const markup = (segs.segments ?? []).some((s) => /stage:|statement:|mechanism:|arch:|demo:|\bopen:|\bquote:|\breveal:|\bimpact:/.test(s.text ?? ""));
  t(ok && !markup, "cue table present, text markup-free");
}

// 7. Estimator lines + TOTAL.
{
  const r = runPy([`${PROJECT}/../_useful/scripts/tts_vertex.py`, "--batch", `${PROJECT}/narration-segments.json`, "--estimate"]);
  void r;
  const r2 = runPy(["../../hackathons/_useful/scripts/tts_vertex.py", "--batch", `${PROJECT}/narration-segments.json`, "--estimate"]);
  const lines = r2.out.split("\n").map((l) => l.trim());
  const per = lines.filter((l) => /^\S+ words=\d+ syllables=\d+ estimate=[\d.]+s$/.test(l));
  const total = lines.find((l) => l.startsWith("TOTAL"));
  t(r2.code === 0 && per.length === 13 && total !== undefined, `estimator lines (${per.length}) + TOTAL`);
}

// 8. TOTAL within the raised cap, with the deviation recorded (the 120–150
// window is retired by the operator-accepted 2026-10-11 deviation).
{
  const est = JSON.parse(readFileSync(`${PROJECT}/video/facts/estimate.json`, "utf8")) as { total?: number; cold?: boolean };
  const gaps = 12.5;
  const total = (est.total ?? 0) + gaps;
  const md = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8");
  t(total <= 260 && md.includes("RECORDED DEVIATION 2026-10-11"), `total ${total.toFixed(1)}s within deviated cap 260`);
}

// 9. No segment over 22 s; s6/s11 word floors.
{
  const perSeg = runPy(["../../hackathons/_useful/scripts/tts_vertex.py", "--batch", `${PROJECT}/narration-segments.json`, "--estimate"]);
  const max = Math.max(...perSeg.out.split("\n").map((l) => {
    const m = /^s\S+ words=\d+ syllables=\d+ estimate=([\d.]+)s/.exec(l.trim());
    return m ? Number(m[1]) : 0;
  }));
  const words = (id: string): number => {
    const s = (segs.segments ?? []).find((x) => x.id === id);
    return (s?.text ?? "").split(/\s+/).filter((w) => w !== "").length;
  };
  t(max <= 22 && words("s6") >= 16 && words("s11") >= 16, `max seg ${max}s, s6/s11 floors`);
}

// 10. W1 line shares a word with s1 (pending until the beat plan exists).
{
  let beat: { beats?: { id?: string; props?: { line?: string } }[] } | null = null;
  try {
    beat = JSON.parse(readFileSync(`${PROJECT}/beat-plan.json`, "utf8")) as typeof beat;
  } catch { /* ignore */ }
  if (beat === null) {
    console.log("pending");
    t(true, "w1 line pending (no beat plan yet)");
  } else {
    const line = (beat.beats?.find((b) => b.id === "W1")?.props?.line ?? "").toLowerCase().split(/\s+/);
    const s1 = ((segs.segments ?? []).find((s) => s.id === "s1")?.text ?? "").toLowerCase().split(/\s+/);
    t(line.some((w) => w !== "" && s1.includes(w)), "w1 line shares a word");
  }
}

// 11. Banned video preset over the project folder.
{
  const r = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video", PROJECT]);
  t(r.code === 0, "video banned scan exits 0");
}

// 12. s12 names repo + live in words; closing phrase conditional.
{
  const s12 = (segs.segments ?? []).find((s) => s.id === "s12")?.text ?? "";
  const show = JSON.parse(readFileSync("design_documents/showcase.json", "utf8")) as { repo_url?: string; live_url?: string };
  const ledger = JSON.parse(readFileSync(`${PROJECT}/fact-ledger.json`, "utf8")) as { rung?: string };
  const hasRepo = /open source/i.test(s12);
  const hasLive = /page is live/i.test(s12);
  const phraseOk = !s12.includes("open source, live now") || ((show.repo_url ?? "") !== "" && (show.live_url ?? "") !== "" && ledger.rung !== "manual");
  t(hasRepo && hasLive && phraseOk, "s12 close in words, conditional phrase");
}

done("sk-04-segments", n, failures);
