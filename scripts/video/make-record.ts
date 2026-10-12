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
// The circled moment's button carries its title in the accessible name
// ("Open incident: <title>"); the title is golden-deterministic for the
// committed bundle (harvest featured moment), so the take addresses it
// exactly instead of prefix-matching.
const featuredTitle = ((): string => {
  try {
    return (readJson(`${PROJECT}/video/facts/harvest.json`) as { featured?: { title?: string } }).featured?.title ?? "";
  } catch { return ""; }
})();

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

interface Directive { at: number; click?: string; role?: string; scrollToSelector?: string; key?: string; eval?: string; step?: string }
// wait_ms only spaces at offsets inside the beat (the solver cuts idle time
// to the narration); clicks become role selectors at generation time.
const directivesOf = (step: Step, stepId: string): Directive[] => {
  const out: Directive[] = [];
  let at = 0;
  for (const a of step.actions ?? []) {
    if (typeof a.wait_ms === "number") { at += a.wait_ms / 1000; continue; }
    if (a.route !== undefined) { out.push({ at, key: `route:${a.route}` }); continue; }
    if (a.click !== undefined) {
      const text = stepId === "circle" && featuredTitle !== "" ? `Open incident: ${featuredTitle}` : a.click;
      out.push({ at, click: text, role: a.role ?? "button", step: stepId });
      continue;
    }
    if (a.play3d !== undefined) continue; // 3D beats are not filmed
  }
  return out;
};

// Directed extras (not scenario steps): press-first ordering (the press must
// land before history starts streaming so the inbox drains press-first,
// deterministically — a mid-stream press interleaves nondeterministically
// and the review's repair bill explodes), the simulator press that lands
// the compliance beat on camera, and framing scrolls (selectors only, never
// pixels). Timed against the MEASURED holds (W4a ~23s, W4b ~35s).
const PRESS_GATE_SNIPPET = "(async () => { const t0 = Date.now(); for (;;) { " +
  "const b = Array.from(document.querySelectorAll('button')).find(function (x) { " +
  "return (x.textContent || '').indexOf('Simulate a doorbell press') >= 0; }); " +
  "if (b) return 'ready'; " +
  "if (Date.now() - t0 > 15000) throw new Error('simulate button never appeared'); " +
  "await new Promise(function (r) { setTimeout(r, 500); }); } })()";
const WAIT_SNIPPET = (sel: string): string =>
  "(async () => { const t0 = Date.now(); for (;;) { if (document.querySelector(" +
  JSON.stringify(sel) +
  ")) return 'ready'; if (Date.now() - t0 > 120000) throw new Error('take gate: prerequisite never appeared'); " +
  "await new Promise(function (r) { setTimeout(r, 500); }); } })()";
const EXTRAS: Record<string, Directive[]> = {
  // Press-first ordering (FIX-12 race): the press must land BEFORE history
  // starts streaming so the inbox drains press-first, deterministically.
  // A mid-stream press interleaves nondeterministically and the review's
  // repair bill explodes (one slow take per mechanism study). The gate waits
  // only for the button to exist (page render), never for data to settle.
  W4a: [
    { at: 1.0, eval: PRESS_GATE_SNIPPET, key: "press-gate" },
    { at: 1.5, click: "Simulate a doorbell press", role: "button", key: "simulate-press" },
    { at: 19.0, scrollToSelector: '[data-demo-focus="workbench"]', key: "frame-week" },
  ],
  W4b: [{ at: 20.0, scrollToSelector: '[data-demo-focus="workbench"]', key: "frame-feed" }],
  // Event gates (not fixed offsets): the take's browser carries screencast
  // load, so review phases land later than in probes. Each gate polls for
  // its beat's prerequisite and throws past its cap, so a click can never
  // miss and a stuck review fails loudly instead of filming the wrong beat.
  W4c: [
    { at: 0.5, eval: WAIT_SNIPPET('button[aria-label^="Open incident"]'), key: "wait-moment" },
  ],
  W5: [
    { at: 0.5, eval: WAIT_SNIPPET('[data-result-region="approval-bar"] button'), key: "wait-decision" },
    { at: 0.6, scrollToSelector: '[data-result-region="approval-bar"]', key: "frame-decision" },
  ],
};
// Cue-aligned clicks: each beat's scenario click fires at its sync cue's
// beat-relative narration time (read from cue-timeline.json), so the action
// lands on its phrase — clamped to 1.0 s after a navigation (the page needs
// a breath) and 0.3 s on continuation beats. Gates still dominate when the
// review runs slow (the click fires at max(planned, gate-done)).
const cueAt = ((): Map<string, number> => {
  const m = new Map<string, number>();
  try {
    const ct = readJson(`${PROJECT}/video/cue-timeline.json`) as {
      cues?: { fire?: string; segment?: string; t?: number }[];
    };
    const man = readJson(`${PROJECT}/video/narration/narration-manifest.json`) as {
      segments?: { id?: string; start_seconds?: number }[];
    };
    const segStart = new Map((man.segments ?? []).map((s) => [s.id ?? "", s.start_seconds ?? 0]));
    const plan = readJson(`${PROJECT}/beat-plan.json`) as { beats?: { id?: string; segments?: string[] }[] };
    const beatOf = (seg: string): string => {
      for (const b of plan.beats ?? []) if ((b.segments ?? []).includes(seg)) return b.id ?? "";
      return "";
    };
    const beatStart = (bid: string): number => {
      const b = (plan.beats ?? []).find((x) => x.id === bid);
      const first = (b?.segments ?? [])[0] ?? "";
      return segStart.get(first) ?? 0;
    };
    for (const c of ct.cues ?? []) {
      if (c.fire === undefined || !c.fire.startsWith("demo:")) continue;
      const step = ALIAS[c.fire.replace(/^demo:/, "")] ?? c.fire.replace(/^demo:/, "");
      const bid = beatOf(c.segment ?? "");
      if (bid !== "" && !m.has(`${bid}:${step}`)) m.set(`${bid}:${step}`, Math.max(0, (c.t ?? 0) - beatStart(bid)));
    }
  } catch { /* cues unavailable: fall back to CLICK_AT/defaults */ }
  return m;
})();
// The take's first navigation needs a breath before any click.
const NAV_FLOOR = 1.0;
const CONT_FLOOR = 0.3;

const actionMap: Record<string, Directive[]> = {};
let m = 0;
let lastRoute = "";
// TAKE_BARE=1 (experiments only): scenario clicks with no evals, gates or
// scrolls — bisects whether the directed extras slow the take.
const BARE = process.env["TAKE_BARE"] === "1";
const EXTRAS_EFF: Record<string, Directive[]> = BARE ? {} : EXTRAS;
// TAKE_NOGATES=1 (experiments only): drop the wait-* gate evals (keep
// everything else) — bisects whether long-running evaluates slow the take.
const NOGATES = process.env["TAKE_NOGATES"] === "1";
const extrasFor = (bid: string): Directive[] => {
  const list = EXTRAS_EFF[bid ?? ""] ?? [];
  if (!NOGATES) return list.map((e) => ({ ...e }));
  return list.filter((e) => !(e.key ?? "").startsWith("wait-")).map((e) => ({ ...e }));
};
for (const b of screen) {
  const dirs: Directive[] = [];
  for (const s of b.props?.sync ?? []) {
    const step = s.cue !== undefined ? stepFor(s.cue) : null;
    const sid = s.cue !== undefined ? (ALIAS[s.cue.replace(/^demo:/, "")] ?? s.cue.replace(/^demo:/, "")) : "";
    if (step) dirs.push(...directivesOf(step, sid));
  }
  for (const e of extrasFor(b.id ?? "")) dirs.push({ ...e });
  dirs.sort((a, c) => a.at - c.at);
  // Cue-aligned clicks: each scenario click fires at its sync cue's
  // beat-relative narration time (never before the page is ready: 1.0 s
  // after a navigation, 0.3 s on continuation beats). Event gates still
  // dominate at runtime when the review runs slow.
  const navigates = (() => {
    const route = b.props?.route ?? "/";
    const nav = route.split("?")[0] !== lastRoute.split("?")[0] || lastRoute === "";
    return nav;
  })();
  const floor = navigates ? NAV_FLOOR : CONT_FLOOR;
  // W4a load follows the press (press-first inbox order); 3.0 s still lands
  // inside its sentence in film time (check 9 documents the allowance).
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i] as Directive;
    if (d.click !== undefined && d.step !== undefined) {
      const cue = cueAt.get(`${b.id ?? ""}:${d.step}`);
      let at = Math.max(cue ?? d.at, floor);
      if ((b.id ?? "") === "W4a" && (d.step === "week" || d.step === "open")) at = Math.max(at, 3.0);
      dirs[i] = { ...d, at };
    } else if (d.click !== undefined && (d.at ?? 0) === 0) {
      dirs[i] = { ...d, at: Math.max(1.0, floor) };
    }
  }
  dirs.sort((a, c) => a.at - c.at);
  actionMap[b.id ?? ""] = dirs;
  m += dirs.filter((d) => d.click !== undefined || d.scrollToSelector !== undefined || d.eval !== undefined).length;
  // The take navigates when the route PATH changes (first filmed beat
  // always). A second load of the same page is not a neutral repeat: the
  // recorder already opens the bare address (flash, theme assertion), so a
  // beat route of "/" would boot the app twice 0.6 s apart, aborting the
  // first boot mid-flight. Beats on "/" carry no route and continue on the
  // recorder's initial page.
  // A navigation is a performed action too (the recorder's initial one; the
  // take URL stays the bare deploy address, no test handles in footage).
  const route = b.props?.route ?? "/";
  if (route.split("?")[0] !== "/" && route.split("?")[0] !== lastRoute.split("?")[0]) m += 1;
  lastRoute = route;
}
if (screen.length > 0) m += 1; // the recorder's initial navigation

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
    if (d.eval !== undefined) {
      out.push({ at: d.at ?? 0, key: d.key, eval: d.eval });
    } else if (d.scrollToSelector !== undefined) {
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
// at take time (nothing here invents a timing). The recorder opens the bare
// address itself (flash, theme assertion), so a beat navigates only when its
// route path differs from "/": one boot, one session, no aborted load.
const BEATS = storyboard.beats
  .filter((b) => b.scene === "ScreenScene")
  .map((b) => {
    const route = b.props?.route ?? "/";
    const navigate = route.split("?")[0] !== "/";
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
