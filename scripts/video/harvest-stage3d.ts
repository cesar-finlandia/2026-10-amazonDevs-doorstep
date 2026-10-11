// scripts/video/harvest-stage3d.ts — DP-SCRIPT WU-06 step 1.
// Copies the source artefacts BYTE-IDENTICAL into video/stage3d/source/ and
// derives the three data files in the shapes of §3.4. Every number is read
// from a file, never typed. Prints `stage3d: 3 figures, <n> marks`.
import { copyFileSync, mkdirSync } from "node:fs";
import { PROJECT, readJson, writeJson } from "./lib.js";

mkdirSync(`${PROJECT}/video/stage3d/source`, { recursive: true });

// Byte-identical copies: sk-06 check 3 compares hashes with the artefacts.
copyFileSync("data/bundle/doorstep-14d.json", `${PROJECT}/video/stage3d/source/bundle-events.json`);
copyFileSync(`${PROJECT}/video/facts/run-1/run-trace.json`, `${PROJECT}/video/stage3d/source/run-trace.json`);

interface BundleEvent { timestamp?: string }
interface TraceEntry { seq?: number; kind?: string; name?: string; truth?: { errors?: number; warnings?: number } }

function bundleEvents(): BundleEvent[] {
  const bundle = readJson("data/bundle/doorstep-14d.json") as {
    inbox?: BundleEvent[]; history?: Record<string, { items?: BundleEvent[] }[]>;
  };
  const out: BundleEvent[] = [...(bundle.inbox ?? [])];
  for (const pages of Object.values(bundle.history ?? {})) {
    for (const page of pages ?? []) out.push(...(page.items ?? []));
  }
  return out;
}

// Local hour at the doorstep (Europe/Helsinki, DST-aware): the figure answers
// "what does an ordinary stretch at THIS door look like".
const helsinkiHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "numeric", hour12: false });
const localHour = (iso: string): number => Number(helsinkiHour.format(new Date(iso))) % 24;

const events = bundleEvents();
const harvest = readJson(`${PROJECT}/video/facts/harvest.json`) as { featured?: { startHour?: number } };
const startHour = harvest.featured?.startHour ?? 9;
const counts = new Array(24).fill(0) as number[];
for (const e of events) {
  if (e.timestamp === undefined) continue;
  counts[localHour(e.timestamp)] = (counts[localHour(e.timestamp)] as number) + 1;
}
writeJson(`${PROJECT}/video/stage3d/data-1.json`, {
  style: "clock",
  x: { label: "Hour of day", values: [...Array(24).keys()] },
  series: [{ id: "events", label: "Events at the front door", values: counts }],
  marks: [{ i: startHour, label: "The hour that did not fit" }],
});

const trace = readJson(`${PROJECT}/video/facts/run-1/run-trace.json`) as { entries?: TraceEntry[] };
const entries = trace.entries ?? [];
const modelCount = (role: string): number => entries.filter((e) => e.kind === "model" && e.name === role).length;
const actionCalls = entries.filter((e) => e.kind === "action").length;
const truthChecks = entries.filter((e) => e.kind === "action" && e.name === "check_week_model").length;
const approvals = entries.filter((e) => e.kind === "approval").length;
writeJson(`${PROJECT}/video/stage3d/data-2.json`, {
  style: "orb",
  nodes: [
    { id: "extractor", label: `Extractor · ${modelCount("extractor")} reads`, group: "model" },
    { id: "planner", label: `Planner · ${modelCount("planner")} plan`, group: "model" },
    { id: "actor", label: `Actor · ${actionCalls} actions`, group: "model" },
    { id: "truth", label: `Truth engine · ${truthChecks} checks`, group: "code" },
    { id: "narrator", label: `Narrator · ${modelCount("narrator")} notes`, group: "model" },
    { id: "human", label: `Human · ${approvals} approval`, group: "human" },
  ],
  edges: [
    { from: "extractor", to: "planner" },
    { from: "planner", to: "actor" },
    { from: "actor", to: "truth" },
    { from: "truth", to: "actor" },
    { from: "truth", to: "narrator" },
    { from: "narrator", to: "human" },
  ],
});

const verify = entries.filter((e) => e.kind === "action" && e.name === "check_week_model" && e.truth !== undefined);
writeJson(`${PROJECT}/video/stage3d/data-3.json`, {
  style: "columns",
  x: { label: "Check number", values: verify.map((_, i) => i + 1) },
  series: [
    { id: "errors", values: verify.map((e) => e.truth?.errors ?? 0) },
    { id: "warnings", values: verify.map((e) => e.truth?.warnings ?? 0) },
  ],
  marks: verify.length > 0 ? [{ i: 0, label: "First check" }, { i: verify.length - 1, label: "Last check" }] : [],
});

const d1 = readJson(`${PROJECT}/video/stage3d/data-1.json`) as { marks?: unknown[] };
const d3 = readJson(`${PROJECT}/video/stage3d/data-3.json`) as { marks?: unknown[] };
console.log(`stage3d: 3 figures, ${(d1.marks ?? []).length + (d3.marks ?? []).length} marks`);
