// scripts/verify/lv-04-voice.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-04 (11 checks).
// The answer is in, the narration is the delivery voice, cues resolve.
// Plan check 10 (the bed) is deferred to WU-LIVE-06: compose_bed scores the
// SOLVED storyboard, which needs the take first (stage order voice, capture,
// storyboard, bed — recorded in ## Deviations). Length/pace bounds are the
// recorded-deviation ones (cap 260, this voice's ~119 wpm), not plan 11's.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const absPath = (s: string): boolean => /[A-Za-z]:\\/.test(s) || /"\/[^"]/.test(s) || s.includes('"~/');
const noSecrets = (s: string): boolean => !/AKIA|Bearer [A-Za-z0-9_\-]{16,}/.test(s);
const NARR = `${PROJECT}/video/narration`;

// 1. resume answers, not asks: receipt carries the operator's answer with
// resumedAt after pausedAt; resume.ts refuses a null answer (proved on a
// sheltered copy, receipt restored after).
{
  const rep = readJson(`${PROJECT}/video/pause-receipt.json`) as {
    pausedAt?: string; resumedAt?: string | null;
    answer?: null | { speech?: string; length?: string; assets?: string; approved_by?: string; regenerate?: string[] };
  };
  const a = rep.answer;
  const shape = a !== null && a !== undefined && typeof a.speech === "string" &&
    typeof a.length === "string" && typeof a.assets === "string" &&
    typeof a.approved_by === "string" && Array.isArray(a.regenerate) &&
    (rep.resumedAt ?? "") > (rep.pausedAt ?? "z");
  const repPath = `${PROJECT}/video/pause-receipt.json`;
  const backup = readFileSync(repPath, "utf8");
  const { writeFileSync } = await import("node:fs") as typeof import("node:fs");
  const nulled = { ...(JSON.parse(backup) as Record<string, unknown>), answer: null, resumedAt: null };
  let refused = false;
  try {
    writeFileSync(repPath, `${JSON.stringify(nulled, null, 2)}\n`);
    const r = runNode(["scripts/video/resume.ts"]);
    refused = r.code === 1 && r.out.includes("resume: no answer recorded");
  } finally {
    writeFileSync(repPath, backup);
  }
  t(shape && refused, "answer recorded + resumedAt; resume refuses without one");
}

// 2. manifest: thirteen ids of plan 11, all measured, starts non-decreasing.
{
  const m = readJson(`${NARR}/narration-manifest.json`) as {
    segments?: { id?: string; seconds?: number; start_seconds?: number; end_seconds?: number }[];
  };
  const ids = (m.segments ?? []).map((s) => s.id);
  const want = ["s1", "s2", "s3", "s3b", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"];
  const starts = (m.segments ?? []).map((s) => s.start_seconds ?? -1);
  const ends = (m.segments ?? []).map((s) => s.end_seconds ?? -1);
  const gapsOk = starts.slice(1).every((st, i) => st >= (starts[i] ?? 0) && st - (ends[i] ?? 0) < 2.0);
  t(JSON.stringify(ids) === JSON.stringify(want) &&
    (m.segments ?? []).every((s) => (s.seconds ?? 0) > 0) && gapsOk,
    `manifest: 13 measured segs, starts ordered (${(m.segments ?? []).length})`);
}

// 3. the delivery voice pair, pinned style character for character.
{
  const m = readJson(`${NARR}/narration-manifest.json`) as {
    voice?: string; tts_voice?: string; style?: string;
    voice_convert?: { applied?: boolean; settings?: { tool?: string; model?: string; pitch?: number; index_rate?: number; f0_method?: string } };
    model?: string;
  };
  const segs = readJson(`${PROJECT}/narration-segments.json`) as { style?: string };
  const vc = m.voice_convert?.settings;
  t(m.voice === "cesar_voice" && m.voice_convert?.applied === true && vc?.tool === "applio-rvc" &&
    vc?.model === "cesar_voice" && vc?.pitch === 0 && vc?.index_rate === 0.75 && vc?.f0_method === "rmvpe" &&
    m.tts_voice === "Iapetus" && typeof m.model === "string" && m.model.length > 0 &&
    m.style === segs.style, `voice cesar_voice <- Iapetus (${m.model}), style pinned`);
}

// 4. pre-conversion originals kept; the converted track differs.
{
  const { readdirSync } = await import("node:fs") as typeof import("node:fs");
  const names = readdirSync(`${NARR}/.gemini-orig`).filter((f) => f.endsWith(".wav"));
  const segs = readJson(`${NARR}/narration-manifest.json`) as { segments?: { wav?: string }[] };
  const conv = (segs.segments ?? []).map((s) => s.wav ?? "");
  let differ = names.length >= 13 && conv.length === 13;
  for (const w of conv) {
    const orig = `${NARR}/.gemini-orig/${w}`;
    if (!w || !existsSync(orig)) { differ = false; break; }
    const a = createHash("sha256").update(readFileSync(`${NARR}/${w}`)).digest("hex");
    if (createHash("sha256").update(readFileSync(orig)).digest("hex") === a) { differ = false; break; }
  }
  t(differ, `.gemini-orig keeps ${names.length} originals, converted track differs`);
}

// 5. total within the deviated cap (plan 11's 105-147 retired by the recorded
// deviation; the chassis cap gate is the binding one).
{
  const m = readJson(`${NARR}/narration-manifest.json`) as { total_seconds?: number; cap_seconds?: number };
  const md = readFileSync(`${PROJECT}/demo-video-script.md`, "utf8");
  t((m.total_seconds ?? 0) <= 260 && (m.cap_seconds ?? 0) === 260 && md.includes("RECORDED DEVIATION 2026-10-11"),
    `total ${(m.total_seconds ?? 0).toFixed(1)}s within deviated cap 260`);
}

// 6. measured pace and tightened silences (this voice: ~119 wpm, not plan
// 11's 145-165 assumption; silences per tighten_gaps).
{
  const m = readJson(`${NARR}/narration-manifest.json`) as {
    measured_words_per_second?: number;
    gap_tighten?: { gap_median_after?: number; max_gap?: number };
  };
  const wpm = (m.measured_words_per_second ?? 0) * 60;
  const med = m.gap_tighten?.gap_median_after ?? -1;
  const max = m.gap_tighten?.max_gap ?? 99;
  t(wpm >= 110 && wpm <= 130 && med >= 0.35 && med <= 0.65 && max <= 0.65,
    `pace ${wpm.toFixed(0)} wpm, median silence ${med}s, max ${max}s`);
}

// 7. subtitles equal the script; every cue shippable (≥1.2 s, ≤84 chars, ≤2 lines).
{
  const srt = readFileSync(`${NARR}/narration.srt`, "utf8").replace(/\r/g, "");
  const vtt = existsSync(`${NARR}/narration.vtt`);
  const ass = existsSync(`${NARR}/narration.ass`);
  const blocks = srt.trim().split(/\n\n+/);
  const textOf = (b: string): string => b.split("\n").slice(2).join(" ").replace(/\s+/g, " ").trim();
  const durOf = (b: string): number => {
    const m = /(\d+):(\d+):([\d.,]+) --> (\d+):(\d+):([\d.,]+)/.exec(b.split("\n")[1] ?? "");
    if (!m) return 0;
    const s = (h: string, mi: string, se: string): number => Number(h) * 3600 + Number(mi) * 60 + Number(se.replace(",", "."));
    return s(m[4] as string, m[5] as string, m[6] as string) - s(m[1] as string, m[2] as string, m[3] as string);
  };
  const linesOf = (b: string): string[] => b.split("\n").slice(2);
  const segs = readJson(`${PROJECT}/narration-segments.json`) as { segments?: { text?: string }[] };
  const norm = (x: string): string => x.replace(/\s+/g, " ").trim();
  const want = norm((segs.segments ?? []).map((s) => s.text ?? "").join(" "));
  const cuesOk = blocks.length > 0 && blocks.every((b) =>
    durOf(b) >= 1.2 && linesOf(b).length <= 2 && linesOf(b).every((l) => l.length <= 84));
  t(vtt && ass && norm(blocks.map(textOf).join(" ")) === want && cuesOk,
    `srt/vtt/ass present, text equals script, ${blocks.length} shippable cues`);
}

// 8. words file degraded-proportional with the recorded bullet; order monotonic.
{
  const w = readJson(`${NARR}/narration-words.json`) as {
    provider?: string; degraded?: boolean; words?: { t?: number }[];
  };
  const notes = readFileSync(`${PROJECT}/video/production-notes.md`, "utf8");
  const ts = (w.words ?? []).map((x) => x.t ?? 0);
  const mono = ts.every((v, i) => i === 0 || v >= (ts[i - 1] ?? 0));
  const bullet = notes.split("\n").some((l) => l.startsWith("- voice: character-share"));
  const chk = runPy(["../../hackathons/_useful/scripts/align_narration.py", "--indir", NARR, "--check"]);
  t(w.provider === "proportional" && w.degraded === true && bullet && mono && chk.code === 0,
    "words proportional/degraded with bullet, monotonic, align --check green");
}

// 9. cue timeline covers every segment cue with evidence; none unresolved.
{
  const ct = readJson(`${PROJECT}/video/cue-timeline.json`) as {
    cues?: { fire?: string; segment?: string; on?: string; evidence?: string }[];
  };
  const segs = readJson(`${PROJECT}/narration-segments.json`) as {
    segments?: { id?: string; cues?: { on?: string; fire?: string }[] }[];
  };
  const want = new Set<string>();
  for (const s of segs.segments ?? []) for (const c of s.cues ?? []) want.add(`${s.id}|${c.fire}|${c.on}`);
  const got = new Set((ct.cues ?? []).map((c) => `${c.segment}|${c.fire}|${c.on}`));
  const covered = [...want].every((k) => got.has(k));
  const evOk = (ct.cues ?? []).length > 0 && (ct.cues ?? []).every((c) => (c.evidence ?? "") !== "");
  const noUnresolved = !JSON.stringify(ct).toLowerCase().includes("unresolv");
  t(covered && evOk && noUnresolved, `cue timeline: ${want.size} cues covered, evidenced, resolved`);
}

// 10. the speech was never time-modified.
{
  const m = readJson(`${NARR}/narration-manifest.json`) as Record<string, unknown>;
  const log = readJson(`${PROJECT}/video/run-log.json`) as { stage?: string }[];
  const mods = ["speed", "atempo", "pitch_shift"].some((k) => m[k] !== undefined);
  const stageMods = log.some((e) => /speed|atempo|stretch|remap/i.test(e.stage ?? ""));
  t(!mods && !stageMods, "no time modification in manifest or run log");
}

// 11. voice/alignment sections filled, clean; banned scan over narration text.
{
  const notes = readFileSync(`${PROJECT}/video/production-notes.md`, "utf8");
  const vsec = notes.slice(notes.indexOf("## Voice and models"));
  const filled = !vsec.includes("Pending WU-LIVE-04") && vsec.includes("cesar_voice") && vsec.includes("251.85");
  const chk = runPy(["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "video",
    `${NARR}/narration.srt`, `${NARR}/narration-words.json`]);
  const txt = [readFileSync(`${NARR}/narration.srt`, "utf8"), readFileSync(`${NARR}/narration-words.json`, "utf8")].join("\n");
  t(filled && !absPath(notes) && noSecrets(notes) && chk.code === 0 && !absPath(txt) && noSecrets(txt),
    "voice sections filled and clean, banned scan green");
}

done("lv-04-voice", n, failures);
