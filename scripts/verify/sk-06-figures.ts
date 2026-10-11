// scripts/verify/sk-06-figures.ts — DP-SCRIPT WU-06 (10 checks).
// Three 3D figure files that differ, each built from a copy of a real
// artefact, named and pointed at by the voice.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { check, done, runNode } from "../video/lib.js";
import { PROJECT, readJson } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};

interface StageFig {
  archetype?: string; data?: string;
  explain?: { title?: string; reads?: string; say?: string; claim?: string };
  look?: { preset?: string };
  provenance?: { source?: string; harvested_at?: string; harvested_by?: string };
}
const plan = readJson(`${PROJECT}/beat-plan.json`) as {
  beats?: { id?: string; kind?: string; segments?: string[]; props?: { stage?: string } }[];
};
const segs = readJson(`${PROJECT}/narration-segments.json`) as {
  segments?: { id?: string; text?: string; cues?: { on?: string; fire?: string }[] }[];
};
const segById = new Map((segs.segments ?? []).map((s) => [s.id, s]));
const figBeats = (plan.beats ?? []).filter((b) => b.kind === "figure" || (b.props?.stage !== undefined && b.id === "W1"));
const figFiles = ["stage3d.json", "stage3d-2.json", "stage3d-3.json"];
const figs = figFiles.map((f) => readJson(`${PROJECT}/${f}`) as StageFig);

// 1. the harvest prints its line with at least one mark.
{
  const r = runNode(["scripts/video/harvest-stage3d.ts"]);
  const m = /stage3d: 3 figures, (\d+) marks/.exec(r.out);
  t(r.code === 0 && m !== null && Number(m[1]) >= 1, `harvest line (${m ? m[0] : r.out.split("\n").pop()})`);
}

// 2. lint-stage3d exits 0.
{
  const r = runNode(["scripts/lint-stage3d.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  t(r.code === 0, "lint-stage3d exits 0");
}

// 3. every provenance.source exists relative and is byte-identical (hash).
{
  const pairs: [string, string][] = [
    ["video/stage3d/source/bundle-events.json", "data/bundle/doorstep-14d.json"],
    ["video/stage3d/source/run-trace.json", `${PROJECT}/video/facts/run-1/run-trace.json`],
  ];
  const hash = (f: string): string => createHash("sha256").update(readFileSync(f)).digest("hex");
  let ok = true;
  for (const f of figFiles) {
    const fig = readJson(`${PROJECT}/${f}`) as StageFig;
    const src = fig.provenance?.source ?? "";
    const pair = pairs.find(([s]) => s === src);
    if (!pair) { ok = false; continue; }
    try { if (hash(`${PROJECT}/${src}`) !== hash(pair[1])) ok = false; } catch { ok = false; }
  }
  t(ok, "sources byte-identical to the artefacts");
}

// 4. three distinct archetypes/titles/data files/presets; no studio.
// (Figure 2's preset is graphite, not the pick's repeat cobalt: the figures
// spec forbids two figures sharing a preset, and the pick counts other films.)
{
  const arch = new Set(figs.map((f) => f.archetype));
  const titles = new Set(figs.map((f) => f.explain?.title));
  const data = new Set(figs.map((f) => f.data));
  const presets = new Set(figs.map((f) => f.look?.preset));
  t(arch.size === 3 && titles.size === 3 && data.size === 3 && presets.size === 3 &&
    ![...presets].includes("studio"), `archetypes/titles/data/presets distinct (${[...presets].join(",")})`);
}

// 5. data-1: 24 values summing to the bundle's event count; mark at featured.startHour.
{
  const d1 = readJson(`${PROJECT}/video/stage3d/data-1.json`) as {
    series?: { values?: number[] }[]; marks?: { i?: number }[];
  };
  const bundle = readJson("data/bundle/doorstep-14d.json") as {
    inbox?: unknown[]; history?: Record<string, { items?: unknown[] }[]>;
  };
  let total = (bundle.inbox ?? []).length;
  for (const pages of Object.values(bundle.history ?? {})) {
    for (const page of pages ?? []) total += (page.items ?? []).length;
  }
  const harvest = readJson(`${PROJECT}/video/facts/harvest.json`) as { featured?: { startHour?: number } };
  const values = d1.series?.[0]?.values ?? [];
  t(values.length === 24 && values.reduce((a, b) => a + b, 0) === total &&
    d1.marks?.[0]?.i === harvest.featured?.startHour, `data-1: 24 values sum ${total}, mark at hour ${harvest.featured?.startHour}`);
}

// 6. data-2: the six node ids and six edges of §3.4; labels short and few.
{
  const d2 = readJson(`${PROJECT}/video/stage3d/data-2.json`) as {
    nodes?: { id?: string; label?: string }[]; edges?: { from?: string; to?: string }[];
  };
  const ids = (d2.nodes ?? []).map((x) => x.id);
  const edges = (d2.edges ?? []).map((e) => `${e.from}->${e.to}`);
  const wantIds = ["extractor", "planner", "actor", "truth", "narrator", "human"];
  const wantEdges = ["extractor->planner", "planner->actor", "actor->truth", "truth->actor", "truth->narrator", "narrator->human"];
  const labels = (d2.nodes ?? []).map((x) => x.label ?? "");
  t(JSON.stringify(ids) === JSON.stringify(wantIds) && wantEdges.every((e) => edges.includes(e)) &&
    labels.every((l) => l.length <= 28) && labels.length <= 8, `data-2: six nodes/edges, labels ≤28 chars (${labels.length})`);
}

// 7. data-3: one column per verify entry; first/last errors from the ledger; shape allowed.
{
  const d3 = readJson(`${PROJECT}/video/stage3d/data-3.json`) as {
    style?: string; x?: { values?: number[] };
    series?: { id?: string; values?: number[] }[];
    marks?: { i?: number }[];
  };
  const trace = readJson(`${PROJECT}/video/facts/run-1/run-trace.json`) as {
    entries?: { kind?: string; name?: string; truth?: { errors?: number; warnings?: number } }[];
  };
  const verify = (trace.entries ?? []).filter((e) => e.kind === "action" && e.name === "check_week_model" && e.truth !== undefined);
  const ledger = readJson(`${PROJECT}/fact-ledger.json`) as { rows?: { id?: string; value?: number }[] };
  const first = ledger.rows?.find((r) => r.id === "F-errors-first")?.value;
  const last = ledger.rows?.find((r) => r.id === "F-errors-last")?.value;
  const errors = d3.series?.find((s) => s.id === "errors")?.values ?? [];
  t((d3.x?.values ?? []).length === verify.length && errors.length === verify.length &&
    errors[0] === first && errors[errors.length - 1] === last &&
    ["columns", "lollipop", "tube"].includes(d3.style ?? ""), `data-3: ${verify.length} columns ${first}…${last}, style ${d3.style}`);
}

// 8. title ≤12 words, reads ≤16, claim ≤8; say once verbatim in the beat's segment.
{
  const wc = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;
  const stageOf: Record<string, string> = {};
  for (const b of plan.beats ?? []) {
    const stage = (b.props as { stage?: string } | undefined)?.stage;
    if (stage) stageOf[stage] = (b.segments ?? [])[0] ?? "";
  }
  const ok = figFiles.every((f) => {
    const fig = readJson(`${PROJECT}/${f}`) as StageFig;
    const ex = fig.explain ?? { title: "", reads: "", say: "", claim: "" };
    // Case-insensitive: §3.4 pins a lowercase say while §5.3 pins a capital
    // sentence start (s1); WU-05 check 8 compares the same way.
    const text = (segById.get(stageOf[f] ?? "")?.text ?? "").toLowerCase();
    const say = (ex.say ?? "").toLowerCase();
    return wc(ex.title ?? "") <= 12 && wc(ex.reads ?? "") <= 16 && wc(ex.claim ?? "") <= 8 &&
      text.split(say).length - 1 === 1;
  });
  t(ok, "explain fits (12/16/8), say spoken once per figure");
}

// 9. stage: cues on each segment (caption on exactly say; mark or pulse/flow) + lint-cues.
{
  const cueOk = figFiles.every((f) => {
    const fig = readJson(`${PROJECT}/${f}`) as StageFig;
    const segId = (plan.beats ?? []).find((b) => (b.props as { stage?: string } | undefined)?.stage === f)?.segments?.[0] ?? "";
    const cues = segById.get(segId)?.cues ?? [];
    const caption = cues.filter((c) => c.fire === "stage:caption");
    const pointed = cues.some((c) => /^(stage:mark:\d+|stage:pulse:[\w-]+|stage:flow:\d+)$/.test(c.fire ?? ""));
    return caption.length === 1 && caption[0]?.on === fig.explain?.say && pointed;
  });
  const r = runNode(["scripts/lint-cues.ts", "hackathon-projects/2026-10-amazonDevs"], "../../hackathons");
  t(cueOk && r.code === 0, "stage cues point at each figure, lint-cues exits 0");
}

// 10. no absolute paths, no logo/particle keys, no bars/slab shapes.
{
  const files = [...figFiles.map((f) => `${PROJECT}/${f}`),
    `${PROJECT}/video/stage3d/data-1.json`, `${PROJECT}/video/stage3d/data-2.json`, `${PROJECT}/video/stage3d/data-3.json`];
  const raws = files.map((f) => readFileSync(f, "utf8"));
  const absPath = raws.some((s) => /[A-Za-z]:\\/.test(s) || s.includes('"/') || s.includes('"~/'));
  const junk = raws.some((s) => /spinning[-_ ]logo|particles|abstract[-_ ]blob|3d[-_ ]text/i.test(s));
  // The ban is on figure SHAPES (data style / shape fields); the W6 camera
  // entry move is literally named "slab" by §3.4 and is not a shape.
  const banned = ["video/stage3d/data-1.json", "video/stage3d/data-2.json", "video/stage3d/data-3.json"]
    .map((f) => (readJson(`${PROJECT}/${f}`) as { style?: string }).style)
    .some((s) => s === "bars" || s === "slab") ||
    raws.some((s) => /"shape":\s*"(bars|slab)"/.test(s));
  void figBeats;
  t(!absPath && !junk && !banned, "relative paths, product artefacts only, no banned shapes");
}

done("sk-06-figures", n, failures);
