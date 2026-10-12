// scripts/video/make-record.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-05 step 1.
// Writes video/record.mjs from the chassis template, the beat plan, the demo
// scenario and the measured narration: one entry per ScreenScene beat, route
// only when it changes (a reload wipes the client model and a running review,
// so continuation beats stay on the live page), actions from the scenario
// steps named by each beat's sync cues plus the directed extras (the
// simulator press in W4a, framing scrolls). Theme paper is the film theme;
// the app implements it as its light scheme (its Paper radio), so the take
// seeds the app's own key with light (see the mapping note in the file).
// Prints `record: <n> screen beats, <m> actions`.
// Usage: npx vite-node scripts/video/make-record.ts [--outdir <dir>]
// Exits BLOCKED (DEPLOY_URL is not set) when DEPLOY_URL is missing (the
// generated file carries the same guard for the scratch-directory check).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT, readJson, blocked } from "./lib.js";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const outDir = arg("--outdir") ?? `${PROJECT}/video`;
const deployUrl = process.env["DEPLOY_URL"] ?? "";
if (deployUrl === "") blocked("DEPLOY_URL is not set");

interface StepAction { click?: string; role?: string; route?: string; wait_ms?: number; expect_text?: string; play3d?: string }
interface Step { id?: string; actions?: StepAction[] }
interface Beat { id?: string; kind?: string; scene?: string; segments?: string[]; props?: { route?: string; sync?: { cue?: string }[]; simulate?: string } }

const plan = readJson(`${PROJECT}/beat-plan.json`) as { beats?: Beat[] };
const scen = readJson("design_documents/demo-scenario.json") as { steps?: Step[] };
const steps = new Map((scen.steps ?? []).map((s) => [s.id ?? "", s]));

const screen = (plan.beats ?? []).filter((b) => b.scene === "ScreenScene");
// sync cue demo:<step> names the scenario step; open/week/review/approve/
// circle/focus/dusk ids double as the demo: names (scenario step "week" for
// cue "demo:week"; "demo:review" matches step "review"; bare names match too).
// sync cue demo:<step> names the scenario step; the beat plan's cue names
// are semantic anchors (moment, decision) while the scenario ids the
// buttons (circle, approve): aliases bridge the two vocabularies.
const ALIAS: Record<string, string> = { moment: "circle", decision: "approve" };
const stepFor = (cue: string): Step | null => {
  const id = ALIAS[cue.replace(/^demo:/, "")] ?? cue.replace(/^demo:/, "");
  if (steps.has(id)) return steps.get(id) ?? null;
  for (const [sid, s] of steps) if (sid === id || `demo:${sid}` === cue) return s;
  return null;
};

interface Directive { at: number; click?: string; role?: string; scrollToSelector?: string; key?: string }
// wait_ms only spaces at offsets inside the beat (the solver cuts idle time
// to the narration); clicks become role selectors at generation time.
const directivesOf = (step: Step): Directive[] => {
  const out: Directive[] = [];
  let at = 0;
  for (const a of step.actions ?? []) {
    if (typeof a.wait_ms === "number") { at += a.wait_ms / 1000; continue; }
    if (a.route !== undefined) { out.push({ at, key: `route:${a.route}` }); continue; }
    if (a.click !== undefined) { out.push({ at, click: a.click, role: a.role ?? "button" }); continue; }
    if (a.play3d !== undefined) continue; // 3D beats are not filmed
  }
  return out;
};

// Directed extras (not scenario steps): the simulator press lands the
// compliance beat on camera; framing scrolls keep the filling views in
// frame (selectors only, never pixels).
const EXTRAS: Record<string, Directive[]> = {
  W4a: [
    { at: 16.0, click: "Simulate a doorbell press", role: "button", key: "simulate-press" },
    { at: 30.0, scrollToSelector: '[data-demo-focus="workbench"]', key: "frame-week" },
  ],
  W4b: [{ at: 20.0, scrollToSelector: '[data-demo-focus="workbench"]', key: "frame-feed" }],
};

const actionMap: Record<string, Directive[]> = {};
let m = 0;
let lastRoute = "";
for (const b of screen) {
  const dirs: Directive[] = [];
  for (const s of b.props?.sync ?? []) {
    const step = s.cue !== undefined ? stepFor(s.cue) : null;
    if (step) dirs.push(...directivesOf(step));
  }
  for (const e of EXTRAS[b.id ?? ""] ?? []) dirs.push({ ...e });
  dirs.sort((a, c) => a.at - c.at);
  // The review press opens the beat; shift scenario spacing so the first
  // click lands at 1-2 s (the scenario's own waits only space followers).
  if (dirs.length > 0 && (dirs[0]?.at ?? 0) === 0) dirs[0] = { ...(dirs[0] as Directive), at: 1.0 };
  actionMap[b.id ?? ""] = dirs;
  m += dirs.filter((d) => d.click !== undefined || d.scrollToSelector !== undefined).length;
  // The take navigates when the route changes (first filmed beat always):
  // a navigation is a performed action too.
  const route = b.props?.route ?? "/";
  if (route !== lastRoute) m += 1;
  lastRoute = route;
}

const template = readFileSync("../../hackathons/_useful/capture/record.template.mjs", "utf8");
if (!template.includes('import { runTake } from "../../../_useful/capture/recorder.mjs"')) {
  blocked("record template changed shape (runTake import not found)");
}
const generated = `// GENERATED by scripts/video/make-record.ts — do not hand-edit.
// WU-LIVE-05: chassis template + beat plan + demo scenario + directed extras.
// The film theme is paper; this app implements it as its light scheme (the
// Paper radio, UC06-4), so the take seeds the app's own key (dr-theme) with
// light. storyboard.theme stays "paper" for the solver and the checks.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runTake } from "../../../_useful/capture/recorder.mjs";

if (!process.env.DEPLOY_URL) {
  console.error("BLOCKED (DEPLOY_URL is not set)");
  process.exit(3);
}

const here = dirname(fileURLToPath(import.meta.url));
const storyboard = JSON.parse(readFileSync(join(here, "storyboard.json"), "utf8"));

// The deployed URL the health gate probed. Never a local address, never guessed.
const URL = process.env.DEPLOY_URL ?? "<<DEPLOYED URL>>";

// The entry repository, where playwright-core is installed.
const ENTRY_ROOT = resolve(here, "..", "..", "..", "..", "hackathon-entries", storyboard.project);

// Directed actions per ScreenScene beat id (at = beat-clock seconds).
// route: only the first filmed beat navigates; continuation beats stay on
// the live page (a reload wipes the client model and kills a running
// review). click: role selectors. scrollToSelector: framing only.
const ACTION_MAP = ${JSON.stringify(actionMap, null, 2) as string};

function toRecorderActions(beatId, directives = []) {
  const out = [];
  for (const d of directives) {
    if (typeof d.key === "string" && d.key.startsWith("route:")) continue; // navigation is per-beat, below
    if (d.scrollToSelector !== undefined) {
      out.push({ at: d.at ?? 0, key: d.key, scrollToSelector: d.scrollToSelector });
    } else if (d.click !== undefined) {
      out.push({ at: d.at ?? 0, key: d.key, click: \`role=\${d.role ?? "button"}[name="\${d.click}"]\` });
    } else {
      out.push(d);
    }
  }
  return out;
}

// One entry per ScreenScene beat. hold/route/theme come from the storyboard
// at take time (nothing here invents a timing); route only when it changes.
let lastRoute = "";
const BEATS = storyboard.beats
  .filter((b) => b.scene === "ScreenScene")
  .map((b) => {
    const route = b.props?.route ?? "/";
    const navigate = route !== lastRoute;
    lastRoute = route;
    return {
      id: b.id,
      segment: (b.segments ?? [])[0] ?? "",
      hold: b.end - b.start,
      ...(navigate ? { route } : {}),
      extraSelectors: b.props?.extraSelectors ?? [],
      actions: toRecorderActions(b.id, ACTION_MAP[b.id] ?? []),
    };
  });

await runTake({
  url: URL,
  beats: BEATS,
  outDir: here,
  entryRoot: ENTRY_ROOT,
  theme: "light",
  themeKey: "dr-theme",
  size: storyboard.capture_css_size ?? [1280, 720],
  captureMethod: process.env.CAPTURE_METHOD ?? "screencast",
  fps: storyboard.fps ?? 30,
  domPointer: process.argv.includes("--dom-pointer"),
  allowLocal: process.argv.includes("--allow-local"),
});
`;
const dest = join(outDir, "record.mjs");
if (!existsSync(outDir)) blocked(`out dir missing: ${outDir}`);
writeFileSync(dest, generated, "utf8");
const n = screen.length;
console.log(`record: ${n} screen beats, ${m} actions`);
if (n < 1 || m < 1) blocked("record: no beats or no actions");
