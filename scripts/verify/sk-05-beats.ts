// scripts/verify/sk-05-beats.ts — DP-SCRIPT WU-05 (10 checks).
// The beat plan is the arc made explicit: ids/kinds/scenes of §3.3, the code
// card read from the repository, the arc check green on estimated time.
import { readFileSync } from "node:fs";
import { check, done, runNode, runPy } from "../video/lib.js";
import { PROJECT } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};

interface Beat {
  id?: string; kind?: string; scene?: string; segments?: string[];
  props?: Record<string, unknown>;
}
const plan = JSON.parse(readFileSync(`${PROJECT}/beat-plan.json`, "utf8")) as { arc?: string; beats?: Beat[] };
const beats = plan.beats ?? [];
const segs = JSON.parse(readFileSync(`${PROJECT}/narration-segments.json`, "utf8")) as {
  segments?: { id?: string; text?: string; cues?: { on?: string; fire?: string }[] }[];
};
const segList = segs.segments ?? [];
const segById = new Map(segList.map((s) => [s.id, s]));

// 1. arc winner-v1; eleven beats with the ids and kinds of §3.3 in order.
{
  const chart: [string, string][] = [["W1", "cold-open"], ["W2", "problem"], ["W3", "insight"], ["A1", "architecture"], ["W4a", "demo"], ["W4x", "figure"], ["W4b", "demo"], ["W4c", "demo"], ["W5", "trust"], ["W6", "wow"], ["W7", "close"]];
  t(plan.arc === "winner-v1" && beats.length === 11 &&
    chart.every(([id, kind], i) => beats[i]?.id === id && beats[i]?.kind === kind),
    `arc winner-v1, eleven beats in §3.3 order (${beats.map((b) => b.id).join(",")})`);
}

// 2. every segment id belongs to exactly one beat; every beat's segments exist.
{
  const owners = new Map<string, number>();
  let exist = true;
  for (const b of beats) for (const s of b.segments ?? []) {
    owners.set(s, (owners.get(s) ?? 0) + 1);
    if (!segById.has(s)) exist = false;
  }
  const cover = segList.every((s) => owners.get(s.id ?? "") === 1) && owners.size === segList.length;
  t(cover && exist, `segments owned exactly once (${segList.length} segs)`);
}

// 3. scenes from the enum; no `<` except inside `pending WU-SCRIPT-08`.
{
  const scenes = new Set(["Stage3D", "Statement", "Mechanism", "ArchScene", "ScreenScene", "EndCard"]);
  const scenesOk = beats.every((b) => scenes.has(b.scene ?? ""));
  const raw = readFileSync(`${PROJECT}/beat-plan.json`, "utf8").replace(/pending WU-SCRIPT-08/g, "");
  t(scenesOk && !raw.includes("<"), "scenes in enum, no stray placeholders");
}

// 4. the code card is read from the repository: file exists, lines in range,
// reading those lines yields the text the registry regex matched.
{
  const code = (beats.find((b) => b.id === "W3")?.props?.code ?? {}) as { file?: string; lines?: [string, string] };
  let ok = false;
  if (code.file && code.lines && code.lines.length === 2) {
    try {
      const all = readFileSync(code.file, "utf8").split("\n");
      const from = Number(code.lines[0]);
      const to = Number(code.lines[1]);
      const window = all.slice(from - 1, to);
      ok = from >= 1 && to <= all.length && to - from + 1 <= 12 &&
        window.some((ln) => /name: "ingest_events"/.test(ln));
    } catch { ok = false; }
  }
  t(ok, `code card ${code.file} ${code.lines} holds the matched registry line`);
}

// 5. count.value is the ledger's F-actions-total; pill is Live only on bedrock.
{
  const w3props = (beats.find((b) => b.id === "W3")?.props ?? {}) as { count?: { value?: number }; pill?: string };
  const ledger = JSON.parse(readFileSync(`${PROJECT}/fact-ledger.json`, "utf8")) as {
    rung?: string; rows?: { id?: string; value?: number }[];
  };
  const total = ledger.rows?.find((r) => r.id === "F-actions-total")?.value;
  t(w3props.count?.value === total && (w3props.pill !== "Live" || ledger.rung === "bedrock"),
    `count ${w3props.count?.value} = F-actions-total ${total}, pill '${w3props.pill}' on rung ${ledger.rung}`);
}

// 6. the three Stage3D beats are never adjacent; first is cold-open; A1 reasoned.
{
  const idx = beats.map((b, i) => (b.scene === "Stage3D" ? i : -1)).filter((i) => i >= 0);
  const adjacent = idx.some((v, i) => i > 0 && v === idx[i - 1]! + 1);
  const a1 = beats.find((b) => b.id === "A1")?.props?.reason;
  t(!adjacent && beats[0]?.kind === "cold-open" && typeof a1 === "string" && a1.length > 0,
    `3D beats at ${idx.join(",")} non-adjacent, first cold-open, A1 reasoned`);
}

// 7. check_arc.py prints `arc: OK (total …)` exit 0; demo share at least 38
// (2026-10-12: aligned with the check_arc wrapper's recorded floor).
{
  const r = runPy(["scripts/video/check_arc.py"]);
  const m = /arc: OK \(total ([\d.]+)s, demo (\d+)%\)/.exec(r.out);
  t(r.code === 0 && m !== null && Number(m[2]) >= 38, `arc green (${m ? `${m[1]}s demo ${m[2]}%` : r.out.split("\n")[0]})`);
}

// 8. each Stage3D line is at most eight words and shares a word (ci) with its segment.
{
  const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w !== "");
  const ok = ["W1", "W4x", "W6"].every((id) => {
    const b = beats.find((x) => x.id === id);
    const line = String(b?.props?.line ?? "");
    const segText = (b?.segments ?? []).map((s) => segById.get(s)?.text ?? "").join(" ");
    return line.split(/\s+/).filter((w) => w !== "").length <= 8 &&
      words(line).some((w) => words(segText).includes(w));
  });
  t(ok, "3D lines ≤8 words, sharing a word with the voice");
}

// 9. each demo sync cue names a cue on the beat's own segment or a scenario step.
{
  const demo = JSON.parse(readFileSync("design_documents/demo-scenario.json", "utf8")) as { steps?: { id?: string }[] };
  const stepIds = new Set((demo.steps ?? []).map((s) => s.id));
  const ok = beats.filter((b) => b.kind === "demo").every((b) => {
    const sync = (b.props?.sync ?? []) as { cue?: string }[];
    const fires = new Set((b.segments ?? []).flatMap((s) => (segById.get(s)?.cues ?? []).map((c) => c.fire)));
    return sync.length > 0 && sync.every((e) =>
      fires.has(e.cue) || stepIds.has(e.cue) || stepIds.has((e.cue ?? "").replace(/^demo:/, "")));
  });
  t(ok, "demo sync cues land on their segment or a scenario step");
}

// 10. lint-script-v2 and lint-cues still exit 0.
{
  const a = runNode(["scripts/lint-script-v2.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  const b = runNode(["scripts/lint-cues.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  t(a.code === 0 && b.code === 0, "lint-script-v2 + lint-cues exit 0");
}

done("sk-05-beats", n, failures);
