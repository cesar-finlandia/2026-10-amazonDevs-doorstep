# DP-SCRIPT — measured facts, the winner-arc script, narration segments, beat plan, three 3D figures, cover and two slides

> Plan 11 of 12 (second to last). The single owner of the words and the pictures of the demo video before anything is filmed: the facts measured by running the deployed product, the script, the machine-readable narration segments, the beat plan, the three 3D figure files with their harvested data, and the three generated assets (cover, slide 1, slide 2). It writes no code that the product runs; its tools are production aids under `scripts/video/` and the files it owns live outside the repository, in the chassis project folder.
> Chassis paths are written `../../hackathons/…`. The project folder is `../../hackathons/hackathon-projects/2026-10-amazonDevs/` and is called **the project folder** below. Scripts run under `vite-node` from the entry root; chassis tools are run as installed and never edited.

## §0 Context & blockers

**Must already exist before WU-01 runs** (plans 1–10). Proof, each prints its own line:

```bash
npx vite-node scripts/verify/e2e-12-results.ts
npx vite-node scripts/verify/sc-05-readme.ts
npx vite-node scripts/verify/sb-02-fields.ts
npx vite-node scripts/verify/sb-05-delta.ts
```
Expected: `e2e-12-results: 10 checks OK`, `sc-05-readme: 12 checks OK`, `sb-02-fields: 10 checks OK`, `sb-05-delta: 8 checks OK`. If one differs, stop: the owning plan is not finished. This plan states facts about the product, so it never starts from a red suite.

**Preflight (each line must print a path or a version):**
```bash
ls -d design_documents/showcase.json design_documents/showcase-facts.json design_documents/demo-scenario.json design_documents/submission/provenance.json actions.manifest.json architecture.json cinematic-tokens.json brand/mark.svg brand/brandmark.css data/bundle/doorstep-14d.json e2e/depth.spec.ts e2e/smoke.spec.ts scripts/e2e-run.ts hee/src/showcase/scenario.ts
ls -d ../../hackathons/hackathon-projects/2026-10-amazonDevs/event_profile.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/mined_frustrations.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/personas.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/hackathon_brief.md
ls -d ../../hackathons/_useful/scripts/tts_vertex.py ../../hackathons/_useful/scripts/render_narration.py ../../hackathons/_useful/scripts/compose_plates.py ../../hackathons/_useful/scripts/winner_arc.py ../../hackathons/_useful/scripts/check_banned_words.py ../../hackathons/scripts/lint-script-v2.ts ../../hackathons/scripts/lint-cues.ts ../../hackathons/scripts/lint-stage3d.ts ../../hackathons/scripts/stage3d-pick.ts ../../hackathons/templates/beat-plan.example.json ../../hackathons/templates/stage3d.example.json ../../hackathons/contracts/stage3d.schema.json
node --version
python3 --version
python --version
gcloud --version
npx playwright --version
```
`python --version` must work: the chassis script lint calls `python` by that name. When it does not, the unit prints `BLOCKED (python is not on the PATH under that name; the chassis lint needs it)` and stops. The chassis lints read paths relative to the chassis root, so this plan runs them as `(cd ../../hackathons && node scripts/lint-… hackathon-projects/2026-10-amazonDevs)`.

**The brand files.** DP-UI's sync script copies `cinematic-tokens.json` and `brand/mark.svg` to the project folder but not `brand/brandmark.css`. WU-07 step 1 copies it (`brand/brandmark.css` → `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/brandmark.css`) and the check proves the copy is byte-identical.

**Live calls here.** WU-01 and WU-02 run the deployed product (the product's own model calls are the product's runtime). WU-07 calls Gemini on Vertex AI to generate three pictures. The AI ACCESS rule is reproduced because those calls happen under this plan's commands.

**Vendor-name guard check (AI ACCESS SPEC §2A).** The brief carries no list of forbidden vendor names, so §2A does not apply and the full AI ACCESS rule below stands.

> **Verbatim contract — AI ACCESS SPEC (§1,§2).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §1 The rule

Any plan, work unit or test that needs a live model call MUST attempt the Vertex path before declaring
AI unavailable. A plan may only report "AI unavailable" after §2 has been run and has failed with a
named error, and it must then quote that error.

##### §2 How to reach Gemini — run these, do not describe them

1. Confirm Application Default Credentials:
   `gcloud auth application-default print-access-token`
   A token means you are authenticated. If it fails, run
   `gcloud auth application-default login`.
2. Use the default project unless the operator names another:
   `GOOGLE_CLOUD_PROJECT=2026-09-agentic-cinema1`.
   Set the environment for the call (these three, not an API key):
   - `GOOGLE_GENAI_USE_VERTEXAI=true`
   - `GOOGLE_CLOUD_PROJECT=2026-09-agentic-cinema1`
   - `GOOGLE_CLOUD_LOCATION=<region, e.g. us-central1>` — and `GOOGLE_VERTEX_LOCATION=global` for
     models published in the global endpoint.
   Only ask the operator for a project id when this default fails with permission or
   not-found. Never invent a project id.
3. Confirm the API is enabled:
   `gcloud services list --enabled --filter="name:aiplatform.googleapis.com"`
4. **Discover the model, do not hardcode a version.** List the models visible to the project and pick a
   current Gemini model of the needed capability (text, or image-capable for slide graphics). Record the
   exact model name and region wherever the plan records reproducibility facts.
5. In deployed environments there is still no API key: the Cloud Run (or equivalent) service account
   carries `roles/aiplatform.user` and the same `GOOGLE_GENAI_USE_VERTEXAI=true` env var.
**How this plan uses the rule above.** WU-07 runs the commands of AI ACCESS §2, lists the image-capable models visible to the project, picks the pinned image model of the visual-assets spec (or, if it is retired, the current non-preview flagship image model) and records the model name and region in `pitch/work/video/plates/plates-manifest.json` and in the script's production notes. If the model route fails after §2 has been run, the unit prints `BLOCKED (<named error>)`, exits `3`, and ships the one legal fallback of the visual-assets spec §9 (a typographic slide) only when two attempts produced text-contaminated images; an unreachable model is never replaced by a drawing.

## §1 Purpose & requirement IDs

| ID | This plan's share |
|---|---|
| FR-26 (part) | The script, the narration segments, the beat plan, the three figures and the three assets |
| N-TRUTH | Every sentence the voice says is true of what the product does today; the facts come from two runs of the deployed product (§5.4) |
| NFR-08 | No banned vocabulary on a spoken word, a subtitle, a slide or the cover (`check_banned_words.py --preset video`) |
| NFR-10 | The entry holds only the tools (`scripts/video/`) and verification scripts; every file the film is made from lives in the project folder |
| Spec §2 | The estimator total is 120–150 s, never over `min(cap − 5 s, 165 s)` |
| Spec §3 | The winner arc W1–W7, three 3D figures, an architecture insert for the sponsor's runtime proof |
| Spec §4A / §8A | The spoken text is TTS-ready and equals `narration-segments.json` character for character |
| Spec §9 + visual-assets | The cover and two slides are generated pictures with zero text under HTML text layers that pass a measured check and were looked at |
| Brief item 3 | A script whose runtime fits the cap and shows the project functioning on its target platform |
| Judging axes | Each of the four axes is evidenced by a named spoken sentence (the coverage table of the script) |

## §2 Scope boundaries

**IN — files this plan creates (project folder unless it says entry):**

| Path | Purpose |
|---|---|
| `demo-video-script.md` | the script, in the section order of the spec §8 |
| `narration-segments.json`, `narration-review.md` | the spoken text as data (spec §8A) and its prose projection |
| `beat-plan.json` | the arc made explicit (spec §8B) |
| `stage3d.json`, `stage3d-2.json`, `stage3d-3.json`, `video/stage3d/data-1.json`, `data-2.json`, `data-3.json`, `video/stage3d/source/*.json` | three figures and the real-run files they were harvested from |
| `fact-ledger.json`, `video/facts/harvest.json`, `video/facts/run-1/`, `video/facts/run-2/`, `video/facts/screen-reality.json`, `video/facts/reality/*.png` | the measured facts |
| `pitch/work/plates.json`, `pitch/work/video/plates/*`, `pitch/cover-image.png`, `pitch/slide1-image.png`, `pitch/slide2-image.png`, `pitch/cover.html`, `pitch/slide1.html`, `pitch/slide2.html`, `pitch/cover.png`, `pitch/slide1.png`, `pitch/slide2.png`, `pitch/review.md`, `brand/brandmark.css` | the three assets |
| `video/script-acceptance.md` | the one-page result of WU-10 |
| entry: `scripts/video/lib.ts`, `preflight.ts`, `harvest-facts.ts`, `check-ledger.ts`, `screen-reality.ts`, `script-to-segments.ts`, `pick-code-card.ts`, `check_arc.py`, `harvest-stage3d.ts`, `make-plates.ts`, `render-pitch.ts`, `check-pitch.ts`, `acceptance.ts` | the tools of §3.6 |
| entry: `scripts/verify/sk-01-harvest.ts` … `scripts/verify/sk-10-acceptance.ts`, `package.json` (`verify:script`) | one verification script per unit |

**OUT — owned elsewhere:**

| What | Owner |
|---|---|
| Rendering the voice, subtitles, capture, the 3D compositor, the final mux | DP-LIVE-RUN-AND-VIDEO |
| The colours, fonts and the brandmark | DP-UI (this plan imports `cinematic-tokens.json` and `brand/`) |
| The product's own 3D view and its `window.__demo3d` hook | DP-3D (the film's figures are the compositor's, from harvested data) |
| `architecture.json` and its proofs | DP-API-TRANSPORT, DP-E2E-BROWSER-TESTING, DP-LIVE-RUN-AND-VIDEO |
| The Devpost text, the deck, the Q&A sheet | DP-SUBMISSION (this plan reads `provenance.json` for model names) |
| Uploading the video, the final `video_url` | the operator (DP-SHOWCASE WU-07) |

## §3 Interfaces owned (literal skeletons)

### §3.1 Where files go

```
../../hackathons/hackathon-projects/2026-10-amazonDevs/
  demo-video-script.md   narration-segments.json   narration-review.md   beat-plan.json
  stage3d.json   stage3d-2.json   stage3d-3.json   fact-ledger.json
  brand/  (mark.svg from DP-UI, brandmark.css copied by WU-07)
  video/facts/{harvest.json, run-1/, run-2/, screen-reality.json, reality/}
  video/stage3d/{source/, data-1.json, data-2.json, data-3.json}
  pitch/{work/, cover-image.png, slide1-image.png, slide2-image.png, cover.html, slide1.html, slide2.html, cover.png, slide1.png, slide2.png, review.md}
  video/script-acceptance.md
```
`video/` also holds what DP-LIVE-RUN-AND-VIDEO writes later (`narration/`, `plates/`, `final.mp4`, …); this plan never writes into those.

### §3.2 `fact-ledger.json` (literal shape)

```ts
export interface LedgerRow {
  id: string;                                   // "F-01" …
  claim: string;                                // the sentence the script may say, in words
  value: string | number | boolean;             // the exact figure
  unit?: string;
  kind: "measured" | "constant" | "static" | "modelled";   // measured: from a run; constant: a rule value the code assigns; static: a count read from a file; modelled: an assumption
  quote: "exact" | "range" | "none";            // exact only when both runs agreed (or the value is static)
  range?: [number, number];                     // when quote is "range"
  source: { file: string; pointer?: string; command?: string };
}
export interface FactLedger {
  version: "1.0.0";
  measuredAt: string;                           // ISO
  baseUrl: string;                              // the address the product was run at
  rung: "bedrock" | "vertex-fallback" | "golden" | "manual";   // from GET /api/status → agent.kind, read before each run
  runsAgree: boolean;
  narrationMayNameBedrock: boolean;             // true only when rung is "bedrock" in both runs
  rows: LedgerRow[];
}
```

### §3.3 `beat-plan.json` (literal skeleton; `<…>` values are filled in WU-05 from the ledger, the figure files and the repository)

```json
{
  "arc": "winner-v1",
  "beats": [
    { "id": "W1",  "kind": "cold-open", "scene": "Stage3D",    "segments": ["s1"],
      "props": { "stage": "stage3d.json", "shot": "cold", "line": "<≤ 8 words, shares a word with s1>" } },
    { "id": "W2",  "kind": "problem",   "scene": "Statement",  "segments": ["s2"],
      "props": { "statements": [ { "text": "<4–9 words>", "on": "<phrase>" }, { "text": "<4–9 words>", "on": "<phrase>" } ],
                 "watermark": ["<word>", "<word>", "<word>"], "backdrop": "grid",
                 "evidence": { "kind": "stat", "text": "<the published figure, verified in WU-08 step 1>", "source": "<publisher, page title, date>" } } },
    { "id": "W3",  "kind": "insight",   "scene": "Mechanism",  "segments": ["s3"],
      "props": { "name": "Doorstep Rhythm", "track": "Ring", "pill": "<short status>",
                 "count": { "value": "<actions count from the ledger>", "label": "typed actions" },
                 "code": { "file": "<from pick-code-card.ts>", "lines": ["<from>", "<to>"] } } },
    { "id": "A1",  "kind": "architecture", "scene": "ArchScene", "segments": ["s3b"],
      "props": { "reason": "The Ring track needs a runtime proof frame." } },
    { "id": "W4a", "kind": "demo",      "scene": "ScreenScene", "segments": ["s4", "s5"],
      "props": { "chapter": "01 · The week", "urlMark": "<host> / sample week", "route": "/",
                 "sync": [ { "cue": "demo:week", "event": "state:workbench" } ] } },
    { "id": "W4x", "kind": "figure",    "scene": "Stage3D",    "segments": ["s6"],
      "props": { "stage": "stage3d-2.json", "shot": "wow", "line": "<≤ 8 words>" } },
    { "id": "W4b", "kind": "demo",      "scene": "ScreenScene", "segments": ["s7", "s8"],
      "props": { "chapter": "02 · The review", "route": "/",
                 "sync": [ { "cue": "demo:review", "event": "state:workbench" } ] } },
    { "id": "W4c", "kind": "demo",      "scene": "ScreenScene", "segments": ["s9"],
      "props": { "chapter": "03 · The moment", "route": "/",
                 "sync": [ { "cue": "demo:moment", "event": "state:workbench" } ] } },
    { "id": "W5",  "kind": "trust",     "scene": "ScreenScene", "segments": ["s10"],
      "props": { "chapter": "04 · The decision", "route": "/",
                 "shots": [ { "at": "cue:demo:decision", "kind": "spotlight", "rect": "geo:approval-bar" } ] } },
    { "id": "W6",  "kind": "wow",       "scene": "Stage3D",    "segments": ["s11"],
      "props": { "stage": "stage3d-3.json", "shot": "wow", "entry": "slab", "line": "<≤ 8 words>" } },
    { "id": "W7",  "kind": "close",     "scene": "EndCard",    "segments": ["s12"],
      "props": { "repo": "<showcase.repo_url>", "licence": "MIT", "live": "<showcase.live_url>", "tail_seconds": 3 } }
  ]
}
```
The beat order obeys the arc: the first beat is the cold open, the three 3D beats (W1, W4x, W6) are never next to each other, the one optional insert (`A1`) has a written `reason` and runs 8 s or less, and the `demo` beats (W4a, W4b, W4c) together are at least 45 % of the measured total (checked by `scripts/video/check_arc.py`, §5.6). Segment ids are fixed by §5.3; a segment belongs to one beat.

### §3.4 The three figure files (literal shapes; `<…>` filled by `harvest-stage3d.ts` from the harvested artefacts)

```jsonc
// stage3d.json — figure 1 (W1 cold open): the question is "what does an ordinary stretch at this door look like?"
{ "archetype": "radial", "data": "video/stage3d/data-1.json",
  "provenance": { "source": "video/stage3d/source/bundle-events.json", "harvested_by": "npx vite-node scripts/video/harvest-stage3d.ts", "harvested_at": "<ISO>" },
  "explain": { "title": "Every event at the front door, by hour of day", "reads": "Each spoke is one hour; a taller spoke means more events in that hour.", "say": "every event at her front door, by the hour", "claim": "A door has a rhythm." },
  "look": { "ground": "token:surface.base", "preset": "<from stage3d-pick.ts>", "shadow": 0.35 },
  "shots": { "cold": { "camera": "orbit", "from_deg": -32, "to_deg": 26, "elev_deg": 24, "dist": 1.12 } } }

// stage3d-2.json — figure 2 (W4x): the question is "how does the agent act?"
{ "archetype": "constellation", "data": "video/stage3d/data-2.json",
  "provenance": { "source": "video/stage3d/source/run-trace.json", "harvested_by": "npx vite-node scripts/video/harvest-stage3d.ts", "harvested_at": "<ISO>" },
  "explain": { "title": "The six parts that act on the week, in order", "reads": "Each orb is one part; a line shows what it hands to the next.", "say": "how the agent works, step by step", "claim": "Code checks every step." },
  "look": { "ground": "token:surface.base", "preset": "<from stage3d-pick.ts>", "shadow": 0.35 },
  "shots": { "wow": { "camera": "orbit", "from_deg": -24, "to_deg": 22, "elev_deg": 30, "dist": 0.95 } } }

// stage3d-3.json — figure 3 (W6 wow): the question is "what did the check find, pass by pass?"
{ "archetype": "ribbon", "data": "video/stage3d/data-3.json",
  "provenance": { "source": "video/stage3d/source/run-trace.json", "harvested_by": "npx vite-node scripts/video/harvest-stage3d.ts", "harvested_at": "<ISO>" },
  "explain": { "title": "Errors the truth engine found, pass by pass", "reads": "Each column is one check of the week; a taller column means more errors.", "say": "the errors the engine found, pass by pass", "claim": "The count falls to zero." },
  "look": { "ground": "token:surface.base", "preset": "<from stage3d-pick.ts>", "shadow": 0.35 },
  "shots": { "wow": { "camera": "orbit", "from_deg": -24, "to_deg": 22, "elev_deg": 30, "dist": 0.95, "entry": "slab" } } }
```
Data files (shapes of `../../hackathons/contracts/stage3d.schema.json`): `data-1.json` is ribbon-shaped with `style: "clock"`: `x = { label: "Hour of day", values: [0…23] }`, one series `{ id: "events", label: "Events at the front door", values: [24 counts] }` and one mark `{ i: <hour of the featured moment>, label: "The hour that did not fit" }`. `data-2.json` is constellation-shaped: six nodes (ids `extractor`, `planner`, `actor`, `truth`, `narrator`, `human`; labels of at most 28 characters carrying the measured counts, for example `Actor · <n> actions`; groups `model`, `code`, `human`) and edges `extractor→planner`, `planner→actor`, `actor→truth`, `truth→actor`, `truth→narrator`, `narrator→human`. `data-3.json` is ribbon-shaped with `style` chosen by `stage3d-pick.ts` from `columns, lollipop, tube`: `x = { label: "Check number", values: [1…n] }`, series `errors` and `warnings` (the `truth` values of the verify entries of the trace, in order) and marks on the first and the last column. Every number is read from a file, never typed.

### §3.5 `narration-segments.json` header (literal; the pair is pinned for the whole video)

```json
{
  "project": "2026-10-amazonDevs",
  "voice": "Iapetus",
  "style": "Confident documentary narrator. Warm, clear and brisk, around one hundred fifty-five words per minute. A short pause between sentences; no pauses inside short sentences.",
  "cap_seconds": 180,
  "cap_quote": "under 3 minutes (judges not required to watch past 3:00)",
  "segments": []
}
```
The cap quote is the brief's own wording (item 3 of `design_documents/hackathon_brief.md`); the event profile says `max_seconds` `180`. The hard ceiling is `min(180 − 5, 165)` = 165 s.

### §3.6 Tools (all under `scripts/video/`; each prints one summary line)

```
npx vite-node scripts/video/preflight.ts                       # prints `preflight: <n> checks passed` or `BLOCKED (<named reason>)` (exit 3)
npx vite-node scripts/video/harvest-facts.ts [--base-url <url>] # WU-01: smoke + two depth runs; prints `harvest: rung <kind>, runs agree <yes|no>, <n> rows`
npx vite-node scripts/video/check-ledger.ts [--base-url <url>]  # WU-02 (also called by DP-LIVE-RUN-AND-VIDEO): one more depth run compared with the ledger; prints `ledger: <n> facts hold` or `ledger: <id> differs (was <a>, now <b>)` (exit 1)
npx vite-node scripts/video/screen-reality.ts [--base-url <url>] # WU-02: runs the demo scenario and records what is on screen; prints `screen-reality: <n> steps, <m> regions`
npx vite-node scripts/video/script-to-segments.ts [--check]    # WU-04: script prose → narration-segments.json (or, with --check, compares them); prints `segments: <n> segments, <w> words, parity yes`
npx vite-node scripts/video/pick-code-card.ts <regex> <file>   # WU-05: prints `code: <file> <from>-<to>` for the real lines that match
python3 scripts/video/check_arc.py                              # WU-05/10: the chassis arc checker on estimator durations; prints `arc: OK (total <s>s, demo <p>%)` or the problems
npx vite-node scripts/video/harvest-stage3d.ts                 # WU-06: copies the source artefacts, writes the three data files; prints `stage3d: 3 figures, <n> marks`
npx vite-node scripts/video/make-plates.ts [--only cover,slide1,slide2]   # WU-07: plates.json → compose_plates.py → pitch/*-image.png; prints `plates: <n> generated, <m> cache hits`
npx vite-node scripts/video/render-pitch.ts                    # WU-07/08: renders the three HTML layers to PNG at 1920×1080; prints `pitch: 3 rendered`
npx vite-node scripts/video/check-pitch.ts                     # WU-09: the measured pass of the visual-assets spec §8; prints `pitch: 0 violations, 9 files`
npx vite-node scripts/video/acceptance.ts                      # WU-10: every lint of the spec §10 in order; writes video/script-acceptance.md; prints `acceptance: <n> of <n> gates pass`
```
`scripts/video/lib.ts` exports: `PROJECT = "../../hackathons/hackathon-projects/2026-10-amazonDevs"`, `CHASSIS = "../../hackathons"`, `readJson`, `writeJson`, `runNode(args, cwd)`, `runPy(args, cwd)`, `blocked(reason): never` (prints `BLOCKED (<reason>)`, exit `3`), `check(n, ok, label, failures)`, `done(name, total, failures): never` (the shape of the other plans' verification scripts), `estimate(file): { perSegment: Record<string, number>, total: number, cold: boolean }` (runs `python3 ../../hackathons/_useful/scripts/tts_vertex.py --batch <file> --estimate` and parses the lines `<id> words=<n> syllables=<n> estimate=<x>s` and `TOTAL … estimate=<x>s`).

## §4 Interfaces consumed (copy verbatim)

```ts
import { readDemoScenario, runStep } from "../../hee/src/showcase/scenario";        // DP-SHOWCASE §4: the scenario reader and step runner
import { validateRunTraceFile } from "../../hee/scripts/hee-validate-run-trace";    // chassis tool vendored in hee/
import { chromium } from "@playwright/test";                                      // the pinned Playwright of the entry
import { GL_ARGS } from "../../e2e/helpers";                                         // DP-E2E-BROWSER-TESTING §3.2: software-GL launch arguments
import { readShowcase } from "../lib/submission";                                      // DP-SUBMISSION §3.5 (`scripts/lib/submission.ts`)
```
Files read (never edited): `actions.manifest.json`, `architecture.json`, `cinematic-tokens.json`, `brand/mark.svg`, `brand/brandmark.css`, `data/bundle/doorstep-14d.json`, `design_documents/showcase.json`, `design_documents/showcase-facts.json`, `design_documents/demo-scenario.json`, `design_documents/submission/provenance.json`, `evals/report.json` (when it exists), `e2e/artifacts/run-trace.json` (written by the depth test), the deploy record (`../../hackathons/hackathon-projects/2026-10-amazonDevs/deploy-record.json`), and in the project folder `event_profile.json`, `mined_frustrations.json`, `personas.json`.

Command-line tools used as installed:

```
python3 ../../hackathons/_useful/scripts/tts_vertex.py --batch <narration-segments.json> --estimate
python3 ../../hackathons/_useful/scripts/render_narration.py --segments <narration-segments.json> --outdir <dir> --cap-seconds 180 --review
python3 ../../hackathons/_useful/scripts/compose_plates.py --project <dir holding plates.json> [--only <ids>] [--model <id>] [--location <region>] [--dry-run]
python3 ../../hackathons/_useful/scripts/check_banned_words.py --preset video ../../hackathons/hackathon-projects/2026-10-amazonDevs
(cd ../../hackathons && node scripts/lint-script-v2.ts hackathon-projects/2026-10-amazonDevs)
(cd ../../hackathons && node scripts/lint-cues.ts hackathon-projects/2026-10-amazonDevs)
(cd ../../hackathons && node scripts/lint-stage3d.ts hackathon-projects/2026-10-amazonDevs)
(cd ../../hackathons && node scripts/stage3d-pick.ts hackathon-projects/2026-10-amazonDevs --allow <shapes> [--figure <file>] [--opening])
```

## §5 Algorithms and literal content

### §5.1 The demo-video script contract (reproduced; binding)

> **Verbatim contract — DEMO-VIDEO SCRIPT SPEC.** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.


#### SPEC — The Demo Video Script (`script.md`)

> **Status: binding contract.** This file is the single source of truth for what a usable
> hackathon demo-video script is. `../../hackathons/src/pgm/engine-prompt.ts` inlines it verbatim into every
> generated `engine-building-prompt.md`, so editing this file changes the deliverable for every
> future hackathon. Do not fork it into a second copy.

##### §0 Why this spec exists

The chassis has shipped scripts that could not be used to record a video. Every failure had the
same three root causes, and every rule below exists to kill one of them:

1. **Authored from the plan, not from the product.** The script described step names, latencies and
   savings that the shipped build never had. A judge who watches the video and then opens the repo
   sees a mismatch — which is worse than a plain video.
2. **Shaped as a table.** Spoken paragraphs were crammed into markdown table cells. Nobody can read
   a paragraph out of a table cell while driving a screen recording.
3. **Never measured against the clock.** The text ran minutes over the cap, so it got improvised on
   the day, and the improvisation dropped exactly the sponsor-track evidence that scores points.

4. **Written for eyes, not for a voice.** The script was authored assuming a human would read it
   and quietly fix the awkward bits on the fly. The chassis now synthesizes the voiceover, and a
   synthetic voice fixes nothing: it reads `$1,252.00` as a string of symbols, stumbles on
   `snake_case`, and says a parenthetical aside out loud. What the script writes is exactly what
   the judges hear.

A script is usable when it can be read top to bottom at a natural pace by the operator OR by the
synthesized voice, every sentence is true of what is on screen, and it fits the clock.

---

##### §1 Non-negotiables

1. **Every fact is measured, never inferred.** Any number, id, entity name, filename, dollar figure
   or latency in the spoken text must come from an actual execution of the built product against
   the shipped demo data. §5 is the procedure. If it was not measured, it does not go in the script.
2. **Prose, not tables.** Spoken text lives in normal paragraphs under a section heading. Tables are
   for the delivery budget and the fact ledger only — never for words that get read aloud.
3. **The clock is a hard constraint.** Every section carries a measured word count and its duration
   at 150 wpm. The total must land under the event's cap with deliberate headroom (§2).
4. **It must sound like a person.** §4 governs. Fragments glued together are a failure, not a style.
5. **The sponsor/side track is the spine, not a mention.** §7 governs.
6. **Never promise a frame that does not exist.** §6 governs.
7. **It ships with its three graphical assets, generated — not specified on paper.** A cover image
   and two slides, built to the VISUAL ASSETS SPEC: **pictures are generated and carry zero text;
   every word is HTML with a real layout engine over them**. §9 governs what goes on them. A
   hand-drawn SVG of boxes and labels is not a graphic and never ships.
8. **Everything visual is ONE theme, and the default is `paper`.** (DP-V9 D6 — this reverses the
   2026-09-21 "dark by default" decision on evidence: all three winning demo videos are light,
   warm and high-contrast.) The titles, the 3D, the captions and the app footage share one palette
   and two typefaces. `video-config.json` → `video_theme` defaults to `paper`; the app is captured
   in the theme it ships in `cinematic-tokens.json`, and if the app has a light theme the capture
   uses it. A dark app in a light film is a mixed-theme video and is a defect.
9. **Every spoken word is also readable.** The finished video carries subtitles built from the
   measured audio, so the spoken text must be worth reading as well as hearing — §4A's rules do
   double duty here.
10. **It ships TTS-ready, and it ships machine-readable.** §4A governs the words; §8A governs
   `narration-segments.json`, the file DP-LIVE-RUN-AND-VIDEO synthesizes the voiceover from. The
   spoken text in the markdown and the text in that JSON are the same words, character for
   character. No operator reads this script aloud — a synthetic voice does, and the video is
   assembled from the result.

---

**N-TRUTH. Every claim about what the product does matches what the build does today**, and the fact-harvest (§5) records the source of each. A flow that depends on a state (clinic open or closed, user signed in) is recorded in the real state, never faked, and the narration does not say the product does something it does not (e.g. handing a message to a person nobody has on duty).

##### §2 Runtime budget — derive it, do not assume it

1. Read the cap from, in precedence order: `event_profile.json` → `video_limits.max_minutes`; then
   `design_documents/hackathon_brief.md` §4 (Hackathon Rules / Requirements / Tracks); then the live
   hackathon page. **Quote the rule verbatim in the script header**, e.g. *"≤3 minutes (only the
   first 3 minutes are evaluated)"*.
2. Note any judging quirk that changes the shape: an "only the first N minutes are evaluated" rule
   means the close must land before N, not at N. A "must include footage of the project functioning"
   rule means the live-demo section is mandatory and cannot be replaced by slides.
3. **Target 120–150 seconds, whatever the cap.** (DP-V9 D1 — the earlier "92–97% of the cap" rule
   is gone: it produced 5-minute videos, and the three winning entries run 56, 135 and 148 s.)
   The hard ceiling is `min(cap − 5 s, 165 s)`. If the event states a **minimum** length, obey it.
   If the cap is under 120 s, scale the arc down proportionally (a 56 s cut is a valid shape). The
   solver enforces this: a total in 120–150 s passes, 100–165 s warns, anything else fails. Shorter
   is not thinner — every second is doing a job (§3): a judge who has watched a hundred entries
   rewards the video that respects their time.
3a. **Cut, do not fill.** A draft that is over the window loses its weakest section, never its demo
   or its trust beat. A draft under 120 s gains another *measured* fact — the degraded path, the
   error handling, a second chapter of the demo — not adjectives, not a slower voice. Every added
   sentence still obeys §1.1: measured, or it does not go in.
4. **Do not estimate the duration by hand — measure it with the estimator.** `tts_vertex.py` keeps
   a per-(model, voice, style) history of real renders and fits a syllable rate through it, which
   is far closer than any words-per-minute rule of thumb. (Changing the pinned style — §4A —
   resets that history; the first estimate after a style change reports `estimator: cold`.)

   ```bash
   python3 ../../hackathons/_useful/scripts/tts_vertex.py --batch narration-segments.json --estimate
   ```

   It prints one line per segment plus a `TOTAL`, in seconds and `m:ss`, and makes no API call. Run
   it against every draft and against every revision. The chassis voice is pinned (§4A):
   **`Iapetus`** with the brisk documentary style below (about 155 words per minute).
5. Word counts are still counted and written into the markers (§8) — they are how a human reads the
   shape of a script — but **the estimator, not the word count, decides whether the script fits.**
   About 2.75 words per second is a sanity check, not the budget. The estimator improves every time
   a video is rendered, because each render records what it actually measured.

---

##### §3 Sectioning

**The winner arc (`"arc": "winner-v1"`) is the only arc for a new project** (DP-V9 §4). It is the
shape of the three winning entries: they show the product working first, name the problem as a
mechanism, show the mechanism, then spend half the runtime proving it on the running app. Problem-
first without a cold open reads as a slide deck; these read as product reveals.

Seven required beats, W1…W7, plus the `figure` beats the length requires (`../../hackathons/templates/demo-video-figures.spec.md` §2: 3 figures in total for a 120–149 s film, 4 from 150 s). Shares are for a 135 s reference; the **bounds** are enforced by the solver
(`build_storyboard.py`) and a violation stops the build with a message that names the beat.

| # | Beat `kind` | Scene | Bounds | ~135 s | Job |
|---|---|---|---|---|---|
| W1 | `cold-open` | `Stage3D` (figure 1) | 7–12 s | 0:00–0:09 | A 3D figure of the product's own data moving from frame 1, with its caption card. The voice speaks 16–32 words: ONE claim (a finished result, **no product name**), then the sentence that NAMES the figure (cue `stage:caption`), then points at its parts (`stage:mark`/`pulse`). Burned-in line ≤ 8 words that shares a word with the voice. No logo, no title card. |
| W2 | `problem` | `Statement` | 8–20 s | 0:07–0:22 | The problem as a **mechanism** in 1–2 display statements (4–9 words each: "Agents can't drag a wall."), ghost watermark words, **one** sourced number *or* a quote ≤ 20 words with attribution. |
| W3 | `insight` | `Mechanism` | 8–16 s | 0:22–0:35 | The one-sentence insight. **The product name is spoken and shown for the first time here**, the track named, a **real** code card (from the repo, with file:line provenance) and a count ("31 typed tools"). |
| W4 | `demo` (1–4 chapters) | `ScreenScene` | ≥ 45% of runtime | 0:35–1:40 | The running app, chaptered (`01 · The brief`). Each chapter: name what the viewer is about to see, action → visible state change → on-page proof (a log or trace line). Something changes on screen at least every 4 s. |
| W4x | `figure` (1 from 120 s, 2 from 150 s) | `Stage3D` (figure n) | 8–12 s each | between demo chapters | **Required, not optional.** A different question of THIS product answered by a different figure (its tool graph, its decision path, where it stops): never the same data or archetype as W1/W6, never next to another 3D beat. 16+ spoken words that name it and point at its parts. |
| W5 | `trust` | `ScreenScene` | 6–18 s | 1:40–1:52 | An error, a guardrail or a human veto **on screen**, held long enough to read, spotlighted. The machine-readable complaint (units, ids) is legible. |
| W6 | `wow` | `Stage3D` (last figure) | 8–18 s | 1:52–2:07 | The product's artifact rising / orbiting / walked, **built from the data the demo just produced**, with its caption and the voice naming it. Entry `slab` (the last demo frame tilts back into 3D and the artifact rises out of it). |
| W7 | `close` | `EndCard` | 5–9 s | 2:07–2:15 | Name, one value line, URL, `licence · repo`, and "Open source, live now." only when all three are true. Held ≥ 3 s after the last word. |

Optional inserts — at most two, each ≤ 8 s and each needing a written `props.reason`:
`architecture` (`ArchScene`, only when a sponsor track requires runtime proof), `impact`
(`MetricRoll`, ≤ 2 metrics), `quote` (`QuoteCard`, a practitioner quote too long for W2).

Rules:

- **The demo is the largest section, and it is never cut before another beat.** ≥ 45% of runtime.
- **The first frame is the artifact moving** — no black, no fade in. The solver refuses a plan whose
  first beat is not the cold open.
- **Every 3D beat is a figure that explains itself** (`../../hackathons/templates/demo-video-figures.spec.md`, read it before writing the
  script): `Stage3D` built from harvested data (a screen beat on a `[data-demo-3d]` element no longer counts); the number
  of figures is a rule of the length; each is chosen from the product's topic BEFORE the narration, carries
  `explain.title|reads|say`, is named by the voice (`stage:caption`) and pointed at (`stage:mark|pulse|flow`). Three.js
  shows the product's own artifact and nothing else — no spinning logos, no particle fields, no abstract blobs, no 3D text.
- **Say what the film is.** A film-side 3D visualisation of the product's real output is described
  in words that say so ("Here is every frame it scored, as a surface."). The narration must not
  claim the *app* has a 3D view unless it does.
- If the run is slower than its window, the solver cuts idle capture time and speeds waiting up to
  2× (a small `2×` chip shows it); the voice is never touched. Never let the voiceover drift out of
  sync with the recording.
- Old projects with `"arc": "3min"` / `"5min"` keep their old seven-beat rules and still render.

---

##### §4 The spoken text must sound like a person

Write it to be **read aloud**, then read it aloud and fix what makes you stumble.

**Do:**

- Full sentences with a subject and a verb. Vary their length — a long one, then a short one.
- Contractions. "It doesn't scale" beats "It does not scale."
- One idea per sentence. Land it, then move on.
- Say numbers the way a person says them: write "twelve fifty-two", not "$1252.00", when it is read
  aloud. Keep the exact figure in the fact ledger.
- Signpost what the viewer is about to see: "Watch step four." "Here's the payoff."
- Name the specific person from the problem framing. Not "users" — the actual persona.

**Do not:**

- Glue fragments together with dashes and slashes. *"Deterministic multi-step agent — tool
  isolation — MergeTree ORDER BY — sub-100ms p95"* is unreadable and unsayable.
- Stack more than two proper nouns in a sentence. Product names are speed bumps.
- Read out identifiers a listener cannot parse — schema names, snake_case function names, UUIDs.
  Show them on screen instead, and refer to them in words.
- Use marketing verbs (revolutionise, seamless, unlock, empower) or exclamation marks.
- Write anything you would not say to a colleague at a whiteboard.

**The winner-arc rules** (DP-V9 §4.3; `node ../../hackathons/scripts/lint-script-v2.ts ../../hackathons/hackathon-projects/2026-10-amazonDevs` checks them):

- **No presenter talk.** No greeting, no self-introduction, no "in this video", no "let me show
  you", no "I built it alone" — `../../hackathons/templates/banned-words.json` bans them for the `video` preset.
  Judges care what the product does, not who is talking.
- **W1 is one claim that states a finished result and names no product, then the sentence that names the figure** (16–32 words):
  "This print was watched by an agent. Here is the score it measured on every frame. This tile is the moment it asked a person."
- **A W1 that asks a question names its subject.** "How do you know it will work?" leaves the viewer asking *what* will work for the
  whole first beat. If the W1 headline or its first sentence is a question, the beat carries `props.subject`: a noun phrase of 2+ words that
  says what the question is about, by what it is or does (never the product name, which is first spoken in W3). It appears verbatim in the
  headline (so it is on the screen; the headline is still ≤ 8 words) and in the first 220 characters of the voice. A W1 that is a statement
  needs none. `lint-script-v2.ts` fails otherwise (DP-V9 §18.6).
- **The product name is first spoken in W3.**
- **Short declaratives.** Every sentence ≤ 20 words, the average 9–14. Learn the *shapes* of the
  winners' lines, never their words: a claim; "X can't Y"; "There is no button that means …"; "It
  checks its own work"; "And when … it doesn't get it, it gets a request."
- **Name what the viewer is about to see before it happens** ("Give it a photo of the plan and one
  sentence…"), and point once per demo chapter at the on-page proof.
- **At most three numbers in the whole script**, each from the Fact Ledger. Judges remember counts,
  not tables.
- **Emphasis:** a segment may carry `"emphasis": [...]` — up to two phrases, each occurring exactly
  once in its text — drawn in the accent colour in captions and statements.

**Checks:** no sentence over 20 words (the old 25 is gone). No paragraph over ~60. If a sentence
needs a comma-spliced list of three technologies, split it.

---

##### §4A It must survive a synthetic voice

The voiceover is synthesized by Gemini TTS (`../../hackathons/_useful/scripts/tts_vertex.py`), one call per section,
and the result is muxed straight into the submission video. Nobody edits the audio afterwards. So
the spoken text is not a draft for a human to interpret — it is literal input to a machine.

**Write every spoken block so it can be pasted into a TTS call unchanged:**

- **No banned vocabulary.** The BANNED VOCABULARY CONTRACT binds every spoken word, and therefore
  every subtitle. Read `../../hackathons/templates/banned-words.json` — it is maintained and it grows — and run
  `check_banned_words.py --preset video` after writing the script and the segments. Fixes are
  rewritten sentences, never a synonym carrying the same tell.
- **Plain prose only.** No markdown inside the spoken text: no `**bold**`, no backticks, no links,
  no bullet characters, no headings. The voice reads punctuation it does not understand as noise.
- **No parentheticals and no asides.** A synthetic voice has no way to know that `(measured)` is a
  note to the operator. If it is in the spoken text, it is heard. Move notes to the visual
  direction or the ledger.
- **Numbers, symbols and units in words.** Write "twelve fifty-two" not `$1,252.00`; "ninety-four
  percent" not `94%`; "two hundred milliseconds" not `200ms`; "version three" not `v3`. The exact
  figure stays in the Fact Ledger, which is where a judge checks it.
- **Spell out what the voice would mangle.** Acronyms read letter by letter get a hyphenated
  spoken form (`A-P-I`, `S-Q-L`) when that is what you want heard, or the expanded words when it
  is not. Identifiers, file paths, snake_case and camelCase names never appear in spoken text —
  §4 already bans them, and TTS makes the ban load-bearing.
- **Pronunciation overrides.** Any product, place or person name the voice is likely to mispronounce
  gets a spoken spelling in the text itself plus a row in a short **Pronunciation notes** table
  (written form → spoken form → why). Test it: render that one segment and listen before
  committing the script.
- **Punctuate for breath.** Full stops and commas are the only pacing controls the voice has. A
  sentence with no internal comma is read in one breathless run. Long sentences get commas where a
  person would pause; a beat that needs a pause gets its own short sentence.
- **One voice, one style, both pinned in the header.** The chassis default pair is
  **`--voice Iapetus --style "Confident documentary narrator. Warm, clear and brisk, around one
  hundred fifty-five words per minute. A short pause between sentences; no pauses inside short
  sentences."`** (DP-V9 §7 — the old "distinct pauses" direction produced 113 wpm against the
  winners' 144–164), and it is the default in `render_narration.py`. The pace target is 150–160
  wpm; the pipeline then clamps every silence *between sentences* to 0.35–0.65 s (`tighten_gaps.py`)
  — editing silence is allowed, stretching or speeding speech never is. Name that pair in the script header and in
  `narration-segments.json`. Every section is rendered with the same pair — a voice change
  mid-video reads as a mistake — and the style direction is a rendering parameter, never a word
  of the script. Changing either pair member re-renders every segment, so change it before the
  review pass, not after.
- **Segment on meaning, not on length, but stay under ~120 words per segment.** One section may
  split into two segments at a natural pause; a segment longer than that risks truncation and
  costs a full re-render when one sentence changes.

**The operator reads it before the machine does.** DP-SCRIPT's last act on the words is to write
`narration-segments.json` and then project it into an editable prose file:

```bash
python3 ../../hackathons/_useful/scripts/render_narration.py --segments ../../hackathons/hackathon-projects/2026-10-amazonDevs/narration-segments.json \
  --outdir ../../hackathons/hackathon-projects/2026-10-amazonDevs/video/narration --cap-seconds <cap> --review
```

That writes `../../hackathons/hackathon-projects/2026-10-amazonDevs/narration-review.md` — the exact words the voice will read, as prose, with
nothing else in it. The operator edits that file until it sounds like a person, and
`--apply-review` folds the edits back into `narration-segments.json`. Because the renderer's cache
is keyed on the text, only the edited segments are re-synthesized. This gate exists because the
first draft of any generated script reads like a generated script, and a synthetic voice makes that
audible in a way silent text never is.

**Then check it the only way that works:** run the estimator
(`tts_vertex.py --batch narration-segments.json --estimate`), confirm the TOTAL lands in §2.3's
120–150 s window, render for real, listen start to finish, and fix what the voice gets wrong in the
words — never in the audio.

**The spoken text is also the subtitle text.** DP-LIVE-RUN-AND-VIDEO splits these same words into
caption cues timed from the measured audio, so a sentence that reads badly on screen is a defect
here, not there. Short declarative sentences subtitle well; a 40-word sentence becomes four cues
that outrun the eye.

---

##### §5 Measure first — the fact-harvest procedure

This is the work unit that must run **before a single line of spoken text is written**, and it runs
**after the product is built** — never against the plan.

1. **Pick the exact demo parameters** the video will use (dataset, filters, ranges, caps). Write
   them down; they are part of the script header.
2. **Execute the real product end to end with those exact parameters.** Prefer the real entry point
   the video shows. Capture: every headline output value, the entities the script will name, and the
   wall-clock duration of the run.
3. **Run it a second time, unchanged.** Compare. If the headline numbers differ, the script may not
   quote them as facts — either fix the nondeterminism, or quote a range and say it is a range.
   Record which it was.
4. **Pick the featured entity** — the single record the demo zooms into — from the *measured* output,
   not from the plan or the seed data. Capture every field the script will mention, plus the
   downstream artefacts it produces.
5. **Distinguish measured from modelled.** If a figure is a constant the code assigns (a scoring
   weight, an assumed hourly rate, a per-incident cost), it is **not** a measurement. Say the
   qualifying word out loud in the script ("modelled exposure", "estimated"), and label it in the
   ledger. Research-sourced business figures (hours saved, industry costs) are assumptions —
   label them and cite where they came from.
6. **Write the Fact Ledger** into the script (§8). Every spoken claim gets a row: the claim, the real
   value, and the source (file, field, or command). A judge's question must be answerable from it.

**The most common failure this prevents:** a bare rule/scoring engine queried in isolation returns
different results than the full pipeline, because the pipeline loads or derives data first. Always
measure the **full path** the demo actually runs.

---

##### §6 Screen-reality check

Before writing the visual directions, confirm what the UI actually renders in each beat.

1. For each thing the script says the viewer will see, find the code that renders it. If it is not
   rendered, either change the direction or add a cutaway (terminal, log tail, database query,
   dashboard) that does show it.
2. Check truncation. Previews are often clipped; a "look at the query" beat is worthless if the UI
   shows only the first N characters.
3. List, in a Production Notes section, what each step of the run actually prints on screen, so the
   voiceover matches the recording beat for beat.
4. Where a one-line code change would materially improve the strongest frame, note it as an
   **optional** suggestion with the file and line — do not silently change the product from within
   the script task.

---

##### §7 Judging axes and the sponsor track

1. **Read the judging criteria** from `event_profile.json` / `hackathon_brief.md` §4. Every axis must
   be evidenced by at least one specific sentence of spoken text — not a claim that the project is
   good, but a demonstrated fact. Include a coverage table in the script mapping axis → the sentence
   that earns it.
2. **The chosen side/sponsor track is the spine of section 3.** The sponsor's product must be shown
   doing something the project genuinely depends on, and the voiceover must name it at the moment it
   is on screen. A logo, a README mention, or "we also use X" scores nothing.
3. **State the track by name, out loud, once** — early, so a track judge knows within the first
   minute that this entry is theirs.
4. **Show the runtime proof, and make it structural.** If the track requires the product to *use*
   the sponsor at runtime, the video must contain the frame that proves it: the live query, the log
   line, the trace, the written record. That frame is no longer improvised: the sponsor is a node in
   `architecture.json` marked `"sponsor": true`, and an edge touching it carries a `proof` — a real
   file, a real line, and the text on it. `lint-architecture.ts` reads that line and fails if it does
   not match, and the architecture scene will not validate without it. The script's job is to name
   the sentence the proof rides on, as a cue (§8A): `{"on": "every query", "fire":
   "arch:proof:<edge>"}`. If the UI does not surface it, §6 applies — find the cutaway.
5. **One track, argued deeply.** Do not spend spoken seconds on secondary integrations; depth in the
   chosen track beats breadth every time.
6. Mandatory-technology requirements (a required model, framework or platform) get one clear
   sentence naming them, because Stage-One screening looks for exactly that.

---

##### §8 Required file shape

**Output path — outside the entry repository.** Write to
`../../hackathons/hackathon-projects/2026-10-amazonDevs/demo-video-script.md`.
Graphical artefacts live beside it in a `pitch/` subfolder of the same directory —
`pitch/cover-image.png`, `pitch/slide1-image.png`, `pitch/slide2-image.png` (generated pictures),
`pitch/cover.html`, `pitch/slide1.html`, `pitch/slide2.html` (the text layers) and their rendered
`pitch/cover.png`, `pitch/slide1.png`, `pitch/slide2.png` — produced by the visual-assets runbook,
never hand-drawn. The machine-readable
`narration-segments.json` (§8A) sits beside the script in that same directory.

The entry repo is what the organizers receive, and it must contain only the application and the few
documents the rules require. The script is a production aid for the operator, so it lives beside the
event's other working files in the chassis' `../../hackathons/hackathon-projects/2026-10-amazonDevs/` folder. If the chassis
SCRIPT module left a `script.md` stub in that folder, leave it — it points here.

Sections, in this order:

1. **Header** — project, track, cap quoted verbatim from the rules, target speech time, one-line
   theme, **the TTS voice name and style direction** (§4A), and the pronunciation-notes table when
   the script has any.
2. **Fact-check status** — the date measured, the exact parameters, and whether the two runs agreed.
3. **Delivery budget** — the section table: window, measured words, speech duration, running total,
   and where the headroom goes.
4. **The sections themselves** — for each: `## [mm:ss – mm:ss] Title`, a `**[Visual: …]**` direction,
   the spoken text as prose, and a `*(N words — m:ss)*` marker.
5. **Fact Ledger** — §5.6. Sub-tables: headline run numbers, the featured entity, the dataset, and a
   clearly separated block for assumptions/modelled figures.
6. **Judging-axis coverage** — §7.1.
7. **Corrections applied** — when revising an earlier draft, a table of *previous claim → why it was
   wrong → what replaced it*. This is how the operator learns to trust the new version.
8. **Production notes** — §6.3, plus recording settings the event's rules require (resolution,
   captions, length, upload target).
9. **Graphical assets** — §9: the words for all three, slide 1's sourced evidence, slide 2's
   before-and-after, the three image prompts and the shared style block.

**Word counts must be counted, not estimated.** Count the words in each spoken block and put the
real number in the marker and the budget table.

---

##### §8A `narration-segments.json` — the spoken text, machine-readable

The voiceover is synthesized from a file, not scraped out of markdown. Parsing prose for "the bits
that get read aloud" is exactly how word-count markers and visual directions ended up inside a
narration sheet before; the fix is to emit the spoken text as data in the first place.

**Path:** `../../hackathons/hackathon-projects/2026-10-amazonDevs/narration-segments.json`,
beside `demo-video-script.md`. DP-SCRIPT writes it; DP-LIVE-RUN-AND-VIDEO consumes it and never
edits it.

**Shape — exactly this:**

```json
{
  "project": "2026-10-amazonDevs",
  "voice": "Iapetus",
  "style": "Confident documentary narrator. Warm, clear and brisk, around one hundred fifty-five words per minute. A short pause between sentences; no pauses inside short sentences.",
  "cap_seconds": 180,
  "cap_quote": "≤3 minutes (only the first 3 minutes are evaluated)",
  "segments": [
    {
      "id": "s1",
      "title": "Cold open",
      "frame": "stage3d.json#cold",
      "text": "This board was scanned, scored, and flagged by an agent. It never touched a mouse.",
      "emphasis": ["never touched a mouse"]
    }
  ]
}
```

Field rules:

- `voice` and `style` — the §4A pair, identical to the script header. One of each, for the whole
  video.
- `cap_seconds` — the event cap in seconds, derived by §2. `cap_quote` is that rule verbatim.
- `id` — stable and short (`s1`, `s2`, …). It names the audio file and the video beat, so it must
  not change between renders of the same script.
- `frame` — the slide file or the app route this segment is spoken over, so the capture plan does
  not have to re-derive it from prose. Use a `pitch/…html` path for slide sections and a route or
  URL path for demo sections.
- `focus` — the small anchor the fake pointer parks on (a selector or a named region), per the
  video spec §5.2. Slide segments may use the slide's headline selector.
- `text` — the spoken words, character for character identical to the section's prose in
  `demo-video-script.md`, and obeying §4A: no markdown, no parentheticals, no `[Visual: …]`, no
  `*(N words — m:ss)*`, no identifiers. The renderer rejects the file when it finds any of them.

- `cues` — OPTIONAL. The visual events this segment drives, declared BESIDE the words rather than
  inside them. Each entry is `{ "on": "<verbatim phrase from this segment's text>",
  "fire": "<target>", "offset": <seconds, optional, ±1.0 max> }`. The renderer resolves `on` to a
  timestamp from the measured word times (`narration-words.json`), so a component lights, a data
  flow runs or an evidence card cuts in **at the moment the voice names it**, without a single
  character of markup reaching the spoken text or the subtitle. `fire` targets are
  `arch:pulse:<node>`, `arch:flow:<edge>`, `arch:proof:<edge>` and the **scene events** of the
  problem and solution beats (DP-V8 §3), each of which fires only in the one scene that draws it:

  | Target | Scene | What changes on screen, on that word |
  |---|---|---|
  | `open:line` / `open:stat` | `ColdOpen` (B1) | the headline arrives / the number lands and finishes counting as the word ends |
  | `quote:open` / `quote:attribution` | `QuoteCard` (B2) | the quote is set / who said it, where and when, settles under it |
  | `reveal:name` / `reveal:line` / `reveal:track` / `reveal:app` | `Reveal` (B3) | the name sets / the value line / the sponsor-track chip, as the track is named / the first app frame rises into its window |
  | `impact:<n>` | `MetricRoll` (optional insert) | metric *n* (1-based) lands and its bar travels from before to after |
  | `statement:<n>` / `statement:evidence` | `Statement` (W2) | statement *n* lands (280 ms rise) / the number or quote settles |
  | `mechanism:name` / `mechanism:code` / `mechanism:count` / `mechanism:track` | `Mechanism` (W3) | the product name sets / the code card rises / the count settles as the word ends / the track chip appears |
  | `stage:rise` / `stage:count` / `stage:mark:<i>` / `stage:flow:<edge>` / `stage:pulse:<node>` | `Stage3D` (W1, W6) | the artifact rises / the count assembles / mark *i* is pinned / a call travels edge *i* / a node pulses — targets are validated against `stage3d.json`'s data |
  | `demo:<name>` | `ScreenScene` (W4, W5) | free-form: a **sync anchor** — `sync[].cue` and a shot's `at: "cue:demo:<name>"` refer to it |

  Declare them for every content-bearing beat (W1–W3, W6, and the sync anchors of W4/W5): a picture that changes on the word is
  what separates a product film from a slideshow, and without a cue the scene falls back to an
  authored offset or a default. When `architecture.json` exists beside this file, every `arch:`
  target must name a real node or edge in it. Run `node ../../hackathons/scripts/lint-cues.ts ../../hackathons/hackathon-projects/2026-10-amazonDevs` after writing them: it fails on a phrase
  that is absent, a phrase that occurs twice (ambiguous), an offset over a second, an unknown target,
  and on any cue markup that leaked into `text`.

```jsonc
{ "id": "s5",
  "text": "Every question goes through the vector index before the model ever sees it.",
  "cues": [ { "on": "vector index", "fire": "arch:pulse:vector-store", "offset": -0.15 } ] }
```

**One section may become two segments** at a natural pause (§4A). When it does, both carry the same
`frame` unless the visual actually changes, and the script's section marker states the split.

**`narration-review.md` is the human face of this file.** It is a projection, not a third source:
`--review` writes it from the JSON, `--apply-review` writes the edits back. The operator never
hand-edits the JSON, and nothing else ever writes the review file.

**The JSON is authoritative for audio; the markdown script is authoritative for the operator.** If
they disagree, the script is wrong — fix both in the same edit and re-render. A machine check belongs in
DP-SCRIPT's verification: concatenate the `text` fields, concatenate the markdown's spoken blocks,
and assert the two strings match after whitespace normalization.

---

##### §8B `beat-plan.json` — the arc made explicit

The video is composed from measured segments by a solver, not assembled by hand, and the solver
never invents content. `beat-plan.json` is where the script says **which segments belong to which
beat, which scene renders it, and the words that scene puts on screen.**

**Path:** `../../hackathons/hackathon-projects/2026-10-amazonDevs/beat-plan.json`, beside the script.
**Template:** `../../hackathons/templates/beat-plan.example.json` (winner-v1, neutral placeholder content) — copy it
and fill it in. The legacy arc's template is `../../hackathons/templates/beat-plan.legacy.example.json`.

```jsonc
{ "arc": "winner-v1",
  "beats": [
    { "id": "W1", "kind": "cold-open", "scene": "Stage3D", "segments": ["s1"],
      "props": { "stage": "stage3d.json", "shot": "cold", "line": "Checked by an agent." } },
    { "id": "W4a", "kind": "demo", "scene": "ScreenScene", "segments": ["s4", "s5"],
      "props": { "chapter": "01 · The brief", "urlMark": "domain / route",
                 "sync": [ { "cue": "demo:scale", "event": "state:scale-set" } ] } },
    { "id": "W5", "kind": "trust", "scene": "ScreenScene", "segments": ["s8"],
      "props": { "shots": [ { "at": "cue:demo:card", "kind": "spotlight", "rect": "geo:approval-card" } ] } }
  ] }
```

**The winner-v1 scenes and props** (DP-V9 §4–§8): `Stage3D` (`stage`, `shot`, `line`, `entry:
"slab"`), `Statement` (`statements[]` with `on`, `watermark[]`, `backdrop`, `evidence`), `Mechanism`
(`name`, `track`, `pill`, `count`, `code {file, lines}` — read from the repo by the solver, never
typed), `ScreenScene` (`chapter`, `urlMark`, `sync[]`, `shots[]`), `EndCard` (`repo`, `licence`,
`live`, `tail_seconds`). A shot's `at` is a number, `"cue:<fire>"` or `"event:<kind>:<key>"`.
`sync` pins a capture event (a `data-demo-focus` element's state change or a click) to the cue that
names it, so the effect lands on the word; the solver cuts idle capture time to make it fit.

Rules (these apply to both arcs unless marked):

- **A segment belongs to exactly one beat**, and a beat's window is the union of its segments'
  measured windows. The solver never splits a segment: a cut inside one is audible.
- **The scenes are a fixed set** — `ColdOpen`, `QuoteCard`, `Reveal`, `ScreenScene`, `ArchScene`,
  `MetricRoll`, `EndCard`, `Fallback`, and (winner-v1) `Statement`, `Mechanism`, `Stage3D` — and
  naming one that does not exist is caught before a render.
- **winner-v1 is checked by the solver:** beat order and bounds (§3), demo share ≥ 45%, first beat
  = cold open, W1/W6 3D, total 120–150 s, at most two optional inserts each with a `reason`, and a
  **cadence gate** — no screen beat may go more than 6 s (warn at 4 s) without a visual event. The
  fix for a static stretch is more *real* content (another synced state change, a tighter cut),
  never a meaningless drift.
- **The words on screen are not the words in the voiceover.** A slide repeating the narration
  sentence for sentence is read, not watched. Headlines are short — a `ColdOpen` line is at most
  12 words, and the solver warns past that; the voice carries the argument. (The one exception is
  a quote the voice reads verbatim: then the quote *is* the caption, and the burned-in caption for
  those words steps aside automatically — DP-V8 §5.)
- **Times in props are fallbacks, not the plan.** `stat.at`, `appAt` and `attributionAt` are used
  only when no scene cue resolved. The plan is the cue: the number lands when the voice says it.
- **Slide 1's evidence rule moves here intact.** `QuoteCard`'s quote is verbatim from
  `mined_frustrations.json` with its community and month, or a named published figure. Never an
  invented statistic.
- **Slide 2's numbers move here intact.** `MetricRoll`'s metrics come from the Fact Ledger, and a
  modelled figure carries `"modelled": true`, which draws it as an outlined bar with the modelled
  chip. At most four metrics. `"before": null` means no baseline was measured, and the scene says
  so rather than drawing a comparison. An optional `"source"` names where the number was measured,
  as a footnote under the label.
- **No pixel coordinate is ever typed.** `ScreenScene`'s shots reference elements by
  `"rect": "geo:<key>"`, resolved against the recorder's `capture-geometry.json`.
- **Omitting a beat's content is allowed and visible.** The solver renders that beat as a
  typographic frame built from its own spoken words and prints which prop it was owed. That is a
  fallback, not a finish.

---

##### §9 The graphical assets — content here, craft in the visual-assets spec

**Under the winner arc (DP-V9) the film's graphics are different.** The cold open (W1) and the wow
(W6) are **3D built from the product's own data**; the problem (W2) is display type; the mechanism
(W3) is a real code card. Generated plates are **optional** (they were the backbone of the old cold
open) — the two-layer rule below still binds any plate you do use. The platform **cover image** is
still required. DP-SCRIPT owns, in addition:

- **`stage3d*.json` + their data files** (`../../hackathons/templates/stage3d.example.json`, `../../hackathons/contracts/stage3d.schema.json`): one per
  figure (`stage3d.json`, `stage3d-2.json`, …). Each: the archetype (`extrude` | `ribbon` | `constellation` | `slab`)
  **chosen from the figure's question** (`../../hackathons/templates/demo-video-figures.spec.md` §3), its camera shots, **`explain`
  (`title`, `reads`, `say`)**, and `provenance.source` — a real run artifact the data was **harvested** from, by a
  harvest step the live-run task runs after the E2E run. No invented data; the lint (`../../hackathons/scripts/lint-stage3d.ts`) fails
  when the source does not exist, the data does not match the archetype, or the figure does not explain itself.
- **The code-card pointer** for W3: `props.code = { file, lines }` — the solver reads those lines
  from the entry repo, so the card is the real code with its `file:line` shown.
- **The 3D look is the engine's, not yours (DP-V9 §17):** a photographic studio - procedural softbox lighting,
  ceramic / glass / metal materials, bevelled smoothed geometry, a soft floor reflection, ambient occlusion, depth
  of field, 2x supersampling, a paper ground. You choose WHAT is shown (the archetype follows the figure's question,
  never a habit: a "how much over a series" question is a `ribbon`, a "how the parts connect" question a
  `constellation`, a "where on the picture" question an `extrude`), never how it is lit. Cameras: `cold` for W1, `wow` for
  the others (a figure beat's `orbit` -24 to 22 deg, elev 30, dist 0.95); W6 uses `entry: "slab"` (the last demo frame
  tilts into a slab and the artifact rises out of it) and the engine pushes in from the slab by itself. The caption card
  (`explain.title`, `explain.reads`) is drawn by the engine, on the narration phrase `explain.say`.
  **Banned in `Stage3D`:** spinning logos, particle fields, abstract blobs, 3D text, any background that is not
  the artifact, and any hand-tuned lighting or material (they live in `src/stage3d/look.tsx`).

The legacy section plan below (cover + slide 1 + slide 2) still applies to projects on the
`"3min"`/`"5min"` arcs.

The video ships **three** graphical assets, and DP-SCRIPT owns all three: a **cover image** (the
platform thumbnail), **slide 1** (the problem) and **slide 2** (the outcome). Slides 1 and 4 of the
section plan are where they appear; sections 2 and 3 are screen recording.

**How they are built is fixed by the VISUAL ASSETS SPEC**, reproduced in full in the
engine-building prompt: the two-layer rule (generated pictures carry zero text; every word is HTML
with a real layout engine), the prompt formula, the generation runbook, the overflow-proof slide
skeleton, and the measured verification. Read it before writing this section, and reproduce its
binding parts into DP-SCRIPT. **Do not re-derive slide mechanics here.**

What this script owns is the *content* that goes on them:

- **(a) The exact words** for each asset, ready to drop into the HTML text layer — a headline plus a
  quote, a statistic, or three short lines. Count them; a slide is not a document.
- **(b) The evidence behind slide 1.** This is the part a judge weighs hardest, and it is why the
  problem-grounding outputs exist. Pull a real practitioner's dated words from
  `../../hackathons/hackathon-projects/2026-10-amazonDevs/mined_frustrations.json` (with its community, month
  and score) and the persona they belong to from `personas.json`, and put that quote and its
  attribution on the slide verbatim. Where no mined evidence fits, cite a published figure by name.
  **Never an invented statistic** — a judge who googles one fabricated number stops believing the
  whole video.
- **(c) The before-and-after for slide 2**, in units, taken from the Fact Ledger (§5.6), with
  measured and modelled figures distinguished on the slide itself.
- **(d) One image prompt per asset**, written to the visual-assets spec's formula and recorded in
  this script beside the image it produced, so a regeneration at the review gate is a re-run rather
  than a re-derivation.
- **(e) The shared style block** — medium, palette hexes from the entry's LIGHT UI tokens, and the
  negative list — prepended verbatim to all three prompts so the set reads as one design.

Rules that belong to the words rather than the pictures:

- **The visual metaphor carries the argument.** Slide 1 congested, manual, human cost visible; slide
  2 clean and linear, the same persona unstressed. The contrast between the two images is the point,
  so both are generated from the same style block.
- **Slide 2's numbers come from the Fact Ledger**, and the script must warn that re-shooting with
  different parameters invalidates them.
- **The prompts are not the deliverable — the generated images and the assembled, rendered assets
  are.** A script whose §9 was never executed is unfinished, however good its prose.

##### §10 Acceptance checks

**Winner arc (DP-V9) — these replace the legacy runtime, slide and B1/B2/B3/B6 checks for a
`"winner-v1"` project:**

- [ ] `node ../../hackathons/scripts/lint-script-v2.ts ../../hackathons/hackathon-projects/2026-10-amazonDevs` is clean: W1 16–32 words with no product name;
  the product name first spoken in W3; every sentence ≤ 20 words (average 9–14); ≤ 3 numbers;
  emphasis phrases occur once.
- [ ] No presenter phrase anywhere spoken (`check_banned_words.py --preset video` is clean).
- [ ] The estimator's TOTAL is 120–150 s (never over `min(cap − 5 s, 165 s)`); demo beats ≥ 45%.
- [ ] `build_storyboard.py` passes: beat order and bounds, first beat = cold open, the number of 3D figures the length requires (W1, W6 and the `figure` beats), each explained and different, cadence
  gate (no screen beat static > 6 s), every `sync` cue and event resolved.
- [ ] Every `stage3d*.json` passes `../../hackathons/scripts/lint-stage3d.ts`: provenance file exists, data matches the
  archetype, every shot uses a known camera path, each figure has `explain` and is named and pointed at by the voice. The 3D is built from harvested data and the figures differ.
- [ ] You watched each figure and could say what it showed from the caption and the voice alone.
- [ ] The W3 code card is read from the repo (`props.code = {file, lines}`), not typed.
- [ ] The trust beat (W5) shows an error, guardrail or veto on screen, readable at 480p.
- [ ] The close names the URL, `licence · repo`, and holds ≥ 3 s after the last word; "Open source,
  live now." only when all three claims were verified.
- [ ] Voice ≈ 150–160 wpm, silences between sentences 0.35–0.65 s, a bed under the voice, −14 LUFS.
- [ ] Quality bar (`video_qa.py` and the blind judge, `judge/JUDGE-PROMPT.md`) is met or the
  deviation is recorded.

The script is done when all of these pass (the items below that name 92–97%, the three slide
assets, or B1/B2/B3/B6 apply to legacy-arc projects only):

- [ ] Every number, id and name in spoken text appears in the Fact Ledger with a source.
- [ ] Both measurement runs agreed, or the script quotes a range and says so.
- [ ] Word counts are counted, and the ESTIMATOR's TOTAL
  (`tts_vertex.py --batch narration-segments.json --estimate`) lands in the arc's window — winner-v1: total 120–150 s
  (legacy arcs: 92–97% of the cap, e.g. 2:45–2:55 against a 3:00 cap).
- [ ] Read aloud start to finish without stumbling, in under the cap, on a clock.
- [ ] Every judging axis has a named sentence; the track is stated by name and proven on screen.
- [ ] Every visual direction names a frame that exists (or a cutaway that does).
- [ ] Modelled/assumed figures are labelled as such, in the script and out loud.
- [ ] Three assets specified with their words, image prompts, shared style block and evidence.
- [ ] Slide 1 carries a dated, attributed quote (from `mined_frustrations.json` where one fits) or a
  named published figure — and no invented statistic anywhere.
- [ ] Slide 2 carries a before-and-after in units from the Fact Ledger, measured vs modelled marked.
- [ ] Both slides and the app theme are LIGHT mode; the cover may be bold.
- [ ] All three pictures generated via the visual-assets runbook (model + region recorded, not
  hardcoded), each carrying zero text, with its prompt recorded beside it.
- [ ] All three text layers are HTML with a real layout engine, rendered at 1920×1080, and the
  measured verification pass reported no overflow, no clipping and no sub-24px text.
- [ ] No spoken sentence exceeds ~25 words; no fragment-chains; no unpronounceable identifiers.
- [ ] `check_banned_words.py --preset video` is clean over the script, the segments and the review
  file — no banned word in a spoken line, and therefore none in a subtitle.
- [ ] Spoken text obeys §4A: no markdown, no parentheticals, numbers and symbols written as words,
  pronunciation overrides listed for every name the voice would mangle.
- [ ] `narration-segments.json` exists beside the script, validates against §8A, and its
  concatenated `text` matches the markdown's spoken blocks after whitespace normalization.
- [ ] `beat-plan.json` exists beside the script (§8B): every segment is assigned to exactly one
  beat, every scene name is real, and every content-bearing beat carries its words — the quote with
  its attribution, the metrics from the Fact Ledger, the name and the deployed URL.
- [ ] The voice name and style direction are pinned in the script header and in the JSON, and are
  the same pair.
- [ ] Any `cues[]` declared pass `node ../../hackathons/scripts/lint-cues.ts ../../hackathons/hackathon-projects/2026-10-amazonDevs`: every phrase appears
  once, verbatim, in its own segment's spoken text, every target exists, and no cue markup is
  anywhere in `text`.
- [ ] Every content-bearing B1/B2/B3/B6 beat has its scene cues (§8A): at least `open:stat` when
  the cold open carries a number, `quote:attribution`, `reveal:name` and `reveal:track`, and one
  `impact:<n>` per metric — so each change on screen lands on the word that causes it.
- [ ] The narration renderer's budget check was run against the JSON
  (`render_narration.py --dry-run`) at the event's calibrated pace, and the estimated speech
  lands at 90–95% of the cap.
- [ ] `narration-review.md` was generated (`--review`) and left in the project folder for the
  operator's edit pass, and the script names that file as the place to change the words.

### §5.2 The visual assets contract (reproduced; binding)

> **Verbatim contract — VISUAL ASSETS SPEC.** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.


#### SPEC — The video's graphical assets (`pitch/`)

> **Status: binding contract.** This file is the single source of truth for the cover image and the
> two slides every hackathon video carries. `../../hackathons/src/pgm/engine-prompt.ts` inlines it verbatim into every
> generated `engine-building-prompt.md`, so editing this file changes the deliverable for every future
> hackathon. Do not fork it into a second copy.

##### §0 Why this spec exists — four failures, observed, named

A judge decides whether to open your repository in the first fifteen seconds of your video. Those
seconds are a slide. The chassis has shipped slides that lost that decision before the voice said
anything, and the post-mortem found four causes. Every rule below kills one:

1. **The image was never generated.** The runbook said "generate the graphic with Gemini via Vertex."
   The implementor instead hand-wrote an SVG of rectangles and text labels and shipped that as "the
   graphic." Two entries in a row did this. Hand-drawn boxes are not an illustration; they are a
   wireframe, and on a 1080p slide they look like one. **§3 and §9 make this impossible to do
   accidentally.**
2. **Text was drawn by hand into the picture.** Those SVGs positioned `<text>` at fixed coordinates
   with `letter-spacing`, centred on a guessed anchor. SVG has no layout engine: the labels ran
   outside their boxes, collided with each other, and overflowed the frame. The same failure arrives
   from the other direction when an image model is asked for labels and misspells them. **§3 moves
   every character of text out of the picture layer entirely.**
3. **The HTML slide had no layout, only coordinates.** Headlines were absolutely positioned at
   hardcoded pixel offsets over a full-bleed image, and a 96px headline plus a 40px paragraph plus a
   full-width image silently overflowed a 1080px stage. **§7 replaces coordinates with a grid that
   cannot overflow.**
4. **Verification was a judgement call.** The check was "view the screenshot and confirm the text is
   legible and nothing is clipped." A model asked to confirm its own work confirms it. **§8 replaces
   opinion with DOM measurements that fail loudly.**

None of these were caused by a prompt being too long or too short. Three of the four happened before
any prompt reached a model.

---

##### §1 Non-negotiables

1. **Three assets ship, every time:** a cover image, slide 1 (the problem), slide 2 (the outcome).
   §2 governs. A video missing its cover is unfinished.
2. **Pictures carry no text. Text carries no pictures.** §3 governs, and it is the rule the other
   rules depend on. Generated imagery contains zero letters, digits, labels or watermarks; every
   word the viewer reads is HTML with a real layout engine over it.
3. **The picture is generated, never hand-drawn.** §9 governs the one legal fallback, and it is a
   deliberate typographic slide — never an SVG of rectangles pretending to be a diagram. **The
   architecture picture has its own replacement:** it is generated from `architecture.json` and laid
   out by ELK, with the nodes, the edges and the data flowing along them animated by cues from the
   voice (DP-V5). Hand-drawing the architecture is not a shortcut around this rule; it is the defect
   the rule exists to prevent.
4. **Slide 1 proves the problem is real with sourced evidence.** §4.2 governs. A named person, a
   dated quote, a citable number. Never an invented statistic, never "studies show".
5. **Slide 2 quantifies the change.** §4.3 governs. Before and after, in units, from the Fact
   Ledger, with measured and modelled figures visually distinguished.
6. **Nothing is signed off on opinion.** The measurements run and pass, and then a human or an
   agent actually looks. Both, in that order. For plates that is `compose_plates.py`'s OCR gate;
   for the composed frames it is `check-scenes.mjs`, which renders every scene in both themes and
   fails on text under the readable floor, on any element overflowing its box, and on any text
   under 4.5:1 contrast — measured in the browser, against the real layout engine.
7. **The two slides carry the video's ONE theme; the cover is allowed to be bold.** The theme is
   `../../hackathons/hackathon-projects/2026-10-amazonDevs/video-config.json` → `video_theme`, default **dark**
   (video-spec §4.7), and the slides must
   match the app footage recorded in that same theme. The cover is a thumbnail, not a video frame —
   it wants saturation and contrast, and it may depart from the theme.

---

##### §2 The three assets

| Asset | File | Aspect | Job | Seen for |
|---|---|---|---|---|
| Cover | `pitch/cover.png` (from `cover-image.png` + `cover.html`) | 16:9, 1920×1080 | the YouTube thumbnail: stop the scroll, name the app | a fraction of a second, at 320px wide |
| Slide 1 | `pitch/slide1.html` → `slide1.png` | 16:9, 1920×1080 | make the problem feel real, current, and someone else's pain — not the builder's invention | the video's opening ~30 s |
| Slide 2 | `pitch/slide2.html` → `slide2.png` | 16:9, 1920×1080 | show the change, quantified, and what it feels like on the other side | the video's closing ~25 s |

Each is a pair: a generated picture and a text layer composed over it. **The cover keeps its HTML
page** — it is a still, uploaded to the platform as the thumbnail. **The two slides are no longer
stills:** their pictures are *plates* (`video/plates/<beat>.png`, generated by
`../../hackathons/_useful/scripts/compose_plates.py` from `plates.json`) and their text is laid out live by the
compositor's scene kit over the plate, with the same layout engine and the same overflow rules, on
a timeline. The two-layer rule is unchanged and now covers every plate in the video, not only two
slides: **the picture carries zero letterforms, and every word is laid out by a real layout engine
over it.**

`compose_plates.py` enforces that mechanically — it OCR-scans every generated plate, rejects one in
which words are readable, regenerates it once, and then reports it — and records each plate with its
model and prompt in `plates-manifest.json` for the entry's AI-asset disclosure.

**The cover is not a video frame.** It is uploaded to the platform as the thumbnail. The video still
opens on slide 1.

---

##### §3 The two-layer rule — the fix everything else rests on

**Layer one, the picture:** a generated raster image. Illustration, photography or rendered scene.
It contains **no text of any kind** — no labels, no captions, no numbers, no logos, no watermarks,
no UI chrome with words in it. Not "a few short uppercase labels." Zero.

**Layer two, the text:** HTML and CSS over that image, with a real layout engine — flow, grid, line
wrapping, font metrics. Every headline, statistic, quote, citation and caption lives here.

Why this split is not negotiable:

- **Image models cannot spell reliably.** They produce plausible-looking letterforms that are wrong,
  and a typo on a slide reads as carelessness about everything else, including your code.
- **Hand-placed SVG text has no layout engine.** `<text x="960" letter-spacing="6">` does not know
  how wide the string is, so it cannot centre it, wrap it or keep it inside a box. It will overflow,
  and nothing will tell you.
- **HTML text is measurable.** §8 can assert that it fits, that it does not collide, that it meets a
  minimum size and a contrast ratio. A picture of text can assert nothing.
- **HTML text is fixable in one second.** A typo is an edit. A typo baked into an image is a
  regeneration, a new random seed, and a different picture.

**The practical consequence:** every image prompt in §5 ends with an explicit no-text instruction,
and §8 fails the asset if the rendered image contains recognisable glyphs.

**The brandmark is not an exception to this rule — it is the rule applied again.** The lockup DP-UI
built (BRANDMARK SPEC) is authored vector geometry plus live text: the mark carries no `<text>`, and
the app name is rendered by the layout engine. It goes into the **text layer** of each asset, never
into the generated picture, and the image prompts must not ask for a logo. Import it from
`../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/`; never redraw it here.

---

##### §4 What each asset shows

###### §4.1 The cover — one idea, legible at thumbnail size

The cover is judged at 320 pixels wide in a list of competitors. Test every decision against that.

**Composition:** one focal subject, strong silhouette, high contrast, saturated. Off-centre subject
with clear space on one side for the title block. No busy background, no small details, no thin
lines, no more than three dominant colours. If it needs a second glance to parse, it has failed.

**The text layer carries:**

- the **brandmark**, at cover size — if the app name is already the banner below, place the **mark
  alone** here and let the banner be the wordmark; never a giant lockup *and* a giant wordmark;
- the **app name**, huge — a banner across the clear side, the single largest thing on the frame,
  set in a heavy weight, on a solid or gradient band so it never fights the image behind it;
- **one line** saying what it does, at roughly a third of the name's size, eight words at most;
- optionally a small track or event badge in a corner.

Nothing else. A cover with a bulleted list is a slide, not a cover.

**Subject ideas that work:** the central metaphor of the product as a physical object or scene; a
person mid-action at the moment the product matters; a bold abstract representing the transformation.
**Subjects that fail:** laptops on desks, generic robots, glowing brains, circuit-board textures,
handshakes, arrows pointing up. These are stock clichés and they read as "no idea inside".

###### §4.2 Slide 1 — the problem, and the proof it is real

This slide answers one unspoken question: *did this person find a real problem, or invent one to fit
the hackathon?* The difference between those two answers is most of the score.

**It must carry sourced evidence.** In order of preference:

1. **A real practitioner's own words.** The chassis' problem-grounding pipeline already mined them:
   `../../hackathons/hackathon-projects/2026-10-amazonDevs/mined_frustrations.json` holds dated, grounded excerpts with their
   community, timestamp and score, and `personas.json` holds who they are.

   **Select, do not just take the first row.** That file is mined broadly and is noisy — a typical
   run mixes genuinely on-topic complaints with layoff threads, hiring posts and unrelated viral
   posts, and it often contains near-duplicate records of the same post. Work through it:

   1. Filter to records whose text is actually about *this* entry's problem, not its general field.
      Keyword-scan the excerpts for the pain the product removes.
   2. Drop duplicates (the same post appears more than once with slightly different scores).
   3. Prefer recent, `grounded: true` records, and among those prefer the one whose *sentence* is
      quotable — a complaint stated in the first person, short enough to read at 38px.
   4. Quote it verbatim, trimmed only at sentence boundaries, in real quotation marks. Never
      paraphrase a quote and keep the quotation marks.

   **Attribute accurately, and cite the score only when it helps.** *"r/devops · August 2026 · 2.1k
   upvotes"* is powerful. *"r/AI_Agents · August 2026 · 3 upvotes"* undercuts the slide — drop the
   score and cite community and month alone. A low score does not make a complaint less real, but
   putting it on the slide invites the wrong question.

   **If nothing in the file is on-topic, say so and use evidence 2 or 3.** Forcing an unrelated
   quote onto the slide is worse than not having one: a judge who reads it and cannot connect it to
   the product concludes you are padding. Record in the production notes that the mined set had no
   usable record, so the operator knows the grounding run needs better seeds next time.
2. **A citable published figure** — an industry survey, a vendor report, a public incident count —
   with the source named on the slide.
3. **A measured figure from the operator's own domain**, labelled as such.

**Never invent a statistic.** No "70% of teams struggle with…" unless the slide names where that came
from. A judge who googles one fabricated number stops believing the rest of the video, and some of
them will google it.

**No banned vocabulary in any text layer.** The BANNED VOCABULARY CONTRACT binds every word on the
cover and both slides — headlines, statistic labels, captions and attributions. The one exception is a
verbatim quotation, which is never edited: pick a different quote, or keep it and record the exception
in the production notes.

**The text layer carries:** a headline that states the problem as a consequence, not a category
(*"Merging on a model's word broke production"*, not *"The code review problem"*); the quote block
with its attribution; one number that hurts, with its unit and its source; and the persona's name and
role, so the problem belongs to someone.

**The picture layer carries:** the *feeling* of that problem — congestion, waiting, repetition,
mess, fatigue — as illustration or photography. A person mid-frustration works well. An abstract of
the bottleneck works well. Never a diagram of your architecture; that is slide 2's job at best.

###### §4.3 Slide 2 — the outcome, quantified

**The text layer carries a before-and-after in units.** Two columns, or a strikethrough-and-replace
pair: *4 hours → 90 seconds*, *$1,252 per incident → $0.94*, *12 manual steps → 1*. Take the numbers
from the Fact Ledger, and mark which are measured and which are modelled — a small superscript or a
one-line key, visible without being loud. Add at most three short benefit lines under it.

**The picture layer carries the other side of the feeling** from slide 1: the same persona,
unstressed; the flow uncongested; the mess resolved. The pair is the argument — slide 1 congested
and manual, slide 2 clean and linear, in the same illustration style and palette. **Generate both
from the same style block so they read as a set**, and say so in the prompt.

Slide 2's figures are invalidated by re-shooting with different parameters. The script must say so in
its production notes.

---

##### §5 Writing the image prompt — short, concrete, and negative at the end

**A prompt with four strong constraints beats a prompt with twelve weak ones.** Long prompts dilute:
the model averages the requirements and produces something that satisfies none of them strongly. Aim
for **60–110 words**, in this order:

1. **Medium and style** — *"editorial vector illustration, flat shapes, subtle grain"*; *"photoreal
   editorial photograph, 35mm, shallow depth of field"*; *"isometric 3D render, matte materials"*.
   Pick one and commit; mixed-medium prompts produce mush.
2. **Subject and action** — one sentence. Who or what, doing what, in what setting.
3. **Composition** — where the subject sits, where the empty space is, what fills the frame.
   *"Subject on the right third; the left third is empty background for a title block."*
4. **Palette** — two or three literal hex values from the entry's light UI tokens, named as
   dominant, secondary and accent.
5. **Light and mood** — one clause.
6. **The negative list, last and literal** — *"No text, no letters, no numbers, no words, no logos,
   no watermarks, no user interface, no screenshots. No stock-photo clichés: no handshakes, no
   glowing brains, no circuit boards, no upward arrows."*

**A shared style block** — medium, palette hexes, and the negative list — is written once and
prepended verbatim to all three prompts, so the cover and both slides read as one set.

**Aspect ratio 16:9** on every generation.

**Keep the prompt in the script beside the image it produced.** A regeneration must be a re-run of a
recorded prompt, never a re-derivation from memory, because the operator can ask for exactly that at
the review gate (video-spec §3A.0).

---

##### §6 The generation runbook — execute it, do not describe it

###### §6.1 Reach the model

1. `gcloud auth application-default login`, then confirm with
   `gcloud auth application-default print-access-token`.
2. Use the ai-access spec's default GCP project (never invent one). Confirm
   `aiplatform.googleapis.com` is enabled.
3. **Generate with the pinned image model** — `gemini-3.1-flash-image` in the `global`
   region (pinned 2026-09-18; confirmed visible beside the pro, preview and lite image
   variants). If it is retired, pick the current non-preview flagship image model and record
   the substitution; only then fall back to Imagen in `us-central1`.
4. Record the exact model name and region in the script's production notes. Generation bills to the
   operator's project — say so there too.

###### §6.2 Generate

One image per asset, 16:9, shared style block prepended. Three generations total: `cover-image.png`,
`slide1-image.png`, `slide2-image.png`. Save the exact prompt used beside each one, in the script.

###### §6.3 Inspect, and regenerate once

Open every image at full size and look at it. **Reject it if:**

- any glyph, letterform, digit or word-like mark is visible — §3 says zero, and "it's only a squiggle
  that looks like writing" is still a reject;
- the palette contradicts the style block (a dark region on a light-paper slide);
- the composition has no clear space where the title block must go;
- it is a stock cliché from §4.1's list;
- the two slide images do not read as a matched pair.

On rejection, regenerate **once** with the specific failure appended as a literal prohibition — name
the thing and forbid it in its own sentence. After the second attempt, accept minor symbolic
deviations and record them in the production notes; diminishing returns set in fast. A visible
word is never acceptable at any attempt; if two attempts both produce text, crop it out or go to §9.

###### §6.4 What is never a substitute

Not a hand-authored SVG of rectangles and labels. Not a screenshot of the app. Not clip-art, not a
stock-photo search, not an emoji, not a chart of the numbers that are already in the text layer. If
the model is unreachable, §9 is the only fallback.

---

##### §7 The HTML layer — a grid that cannot overflow

Each slide is one self-contained file on a fixed 1920×1080 stage, no webfonts, no external assets,
images referenced by relative path, so it renders identically offline on the recording machine.

**Use layout, never coordinates.** The failure in §0.3 came from `position: absolute; top: 880px`.
Absolute positioning over a full-bleed image has no idea how tall the text is. A grid does.

This skeleton is the default; adapt the content, keep the safety rails:

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Slide 1</title><style>
  :root{ --bg:#F6F7F9; --surface:#FFFFFF; --ink:#11161D; --muted:#59626E; --accent:#5B4BD6; }
  *{box-sizing:border-box}
  html,body{margin:0;width:1920px;height:1080px;background:var(--bg);color:var(--ink);
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
  .stage{width:1920px;height:1080px;display:grid;grid-template-columns:1fr 1fr;
    gap:72px;padding:96px;overflow:hidden}
  .art{position:relative;border-radius:24px;overflow:hidden;background:var(--bg)}
  .art img{width:100%;height:100%;object-fit:cover;display:block}
  .copy{display:flex;flex-direction:column;justify-content:center;gap:32px;min-width:0}
  h1{font-size:76px;line-height:1.08;margin:0;font-weight:700;letter-spacing:-0.02em;
    overflow-wrap:break-word}
  .quote{font-size:38px;line-height:1.35;margin:0;padding:28px 32px;border-left:8px solid var(--accent);
    background:var(--surface);border-radius:0 16px 16px 0;font-style:italic}
  .cite{font-size:26px;color:var(--muted);margin:0}
  .stat{font-size:110px;font-weight:800;line-height:1;margin:0;color:var(--accent)}
  .stat small{display:block;font-size:28px;font-weight:500;color:var(--muted);margin-top:12px}
</style></head><body>
  <div class="stage">
    <figure class="art"><img src="./slide1-image.png" alt=""></figure>
    <div class="copy">
      <h1>Merging on a model&rsquo;s word broke production.</h1>
      <blockquote class="quote">&ldquo;&hellip;verbatim excerpt, one or two sentences&hellip;&rdquo;</blockquote>
      <p class="cite">r/&lt;community&gt; &middot; &lt;Month Year&gt; &middot; &lt;score&gt; upvotes</p>
      <p class="stat">4 hrs<small>per incident, measured</small></p>
    </div>
  </div>
</body></html>
```

Rules the skeleton encodes, which survive any redesign:

1. **A fixed stage with `overflow:hidden` plus a grid.** Content that does not fit is then *provably*
   detectable by §8 rather than silently spilling off-frame.
2. **No absolute positioning of text over art.** Art gets its own grid cell. Full-bleed art with an
   overlay is allowed only when the text sits on a solid or gradient scrim with its own padding, and
   §8's contrast check still applies.
3. **Minimum sizes:** headline ≥ 64px, body and quotes ≥ 32px, captions and citations ≥ 24px. Below
   that, nothing is readable on a laptop across a room, and the video is watched on laptops.
4. **Line length ≤ ~40 characters** per line in the copy column at these sizes. Longer lines at 76px
   wrap into a wall.
5. **At most one idea per region.** A slide is not a document; if it needs a fourth block, it needs
   to be two slides or fewer words.
6. **Real characters:** `&rsquo;`, `&ldquo;`, `&mdash;`. Straight quotes on a 76px headline look like
   a draft.
7. **The cover uses the same skeleton** with a single full-bleed `.art` cell and one overlay block
   holding the brandmark, the app name and its one line.
8. **The brandmark sits on every asset.** Link
   `../brand/brandmark.css` and inline the mark from `../brand/mark.svg`: on the cover at
   `.brandmark--cover` inside the title block; on slides 1 and 2 at `.brandmark--slide`, in the SAME
   corner on both, over the flat slide background rather than over the generated picture, with the
   clear space the identity plan specifies. It is a signature on the slides, not a headline — it must
   not compete with the evidence quote or the before/after figures.

---

##### §8 Verification that is measured, then looked at

Render each HTML file headless at exactly 1920×1080 (a Chromium `file://` URL is sufficient) and save
`cover.png`, `slide1.png`, `slide2.png`. Then run **both** passes. Neither replaces the other.

**Pass one — assertions, in the page, that fail the work unit:**

```js
// Run in the rendered page; every one of these must be empty/true.
const stage = document.querySelector('.stage');
const overflowing = [...document.querySelectorAll('.stage *')].filter(el => {
  const r = el.getBoundingClientRect();
  return r.right > 1920.5 || r.bottom > 1080.5 || r.left < -0.5 || r.top < -0.5;
}).map(el => el.className || el.tagName);            // must be []
const clipped = [...document.querySelectorAll('h1,p,blockquote,li,.stat')]
  .filter(el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
  .map(el => el.className || el.tagName);            // must be []
const tooSmall = [...document.querySelectorAll('h1,p,blockquote,li,.cite')]
  .filter(el => el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 24)
  .map(el => el.className || el.tagName);            // must be []
const imgOk = [...document.images].every(i => i.naturalWidth > 0);  // must be true
```

A non-empty `overflowing` is the §0.3 failure. A non-empty `clipped` is text cut off inside its own
box. A non-empty `tooSmall` is unreadable at viewing distance. `imgOk` false means the picture never
loaded and the slide is text on a blank field — which is how a missing image ships unnoticed.

**Pass two — look at the PNG.** Open each rendered slide and the cover and confirm, by eye: no
letterforms anywhere in the picture layer (§3); the headline reads in under two seconds; the two
slides look like a matched pair; the cover survives being scaled to 320px wide — shrink it and check.

**The work unit's runnable verification command** asserts all six PNGs and three HTML files exist
with non-zero size (`cover-image.png`, `slide1-image.png`, `slide2-image.png`, `cover.png`,
`slide1.png`, `slide2.png`, `cover.html`, `slide1.html`, `slide2.html`) **and** that pass one
returned no violations. Print the paths and the byte sizes.

---

##### §9 When there is no image model — the one legal fallback

If §6.1 fails with a named error, or two attempts both produce text-contaminated images, the fallback
is **a deliberate typographic slide**: no picture, a strong type hierarchy, generous whitespace, one
large accent shape or rule, the quote and the numbers doing all the work. A well-set type-only slide
looks intentional. It can be genuinely excellent — many conference decks are nothing else.

**What is never the fallback:** a hand-authored SVG of rectangles, arrows and text labels. It is not
an illustration, it has no layout engine behind its text, and it is exactly what shipped the last two
times. If you find yourself writing `<text x=` into a `.svg` file, you are in the failure this spec
exists to prevent — stop, and set type in HTML instead.

Record the fallback in the production notes with the named error that caused it, so the operator can
decide whether to fix the credential and re-run before the deadline.

---

##### §10 Acceptance checks

- [ ] Three assets exist and render: `cover.png`, `slide1.png`, `slide2.png`, each 1920×1080.
- [ ] Every picture layer was **generated**, not hand-drawn; the model name and region are recorded.
- [ ] No picture layer contains any letter, digit, label, logo or watermark.
- [ ] No `.svg` file in `pitch/` contains a `<text` element.
- [ ] Every word the viewer reads is HTML text with a real layout engine.
- [ ] Slide 1 carries sourced evidence — a dated, attributed quote or a cited figure — and no
  invented statistic.
- [ ] Slide 2 carries a before-and-after in units from the Fact Ledger, with measured and modelled
  figures distinguished.
- [ ] The two slide images read as a matched pair in one style and palette; both carry the
      video's one theme (`video_theme`, default dark).
- [ ] The cover has one focal subject, the app name as the largest element, and stays legible at
  320px wide.
- [ ] §8 pass one returned no overflow, no clipping, no sub-24px text, and all images loaded.
- [ ] §8 pass two was actually performed — someone looked at the rendered PNGs.
- [ ] Each image's exact prompt is recorded in the script beside the image it produced.
- [ ] `check_banned_words.py --preset video` is clean over the three text layers; any banned word
  surviving inside a verbatim quotation is recorded as a deliberate exception.
- [ ] The brandmark lockup is on the cover and on both slides — same corner and size on the two
  slides — imported from `brand/`, never redrawn, and never baked into a generated picture.

### §5.2a The banned-vocabulary contract (reproduced; binding)

> **Verbatim contract — BANNED WORDS SPEC (§1,§2,§3).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §1 Scope — where the ban applies

**Absolutely, on every judge-visible surface:**

1. **The spoken narration** — `narration-segments.json`, the spoken blocks of `demo-video-script.md`,
   `narration-review.md`, and therefore the subtitles, which are those same words.
2. **Every slide and the cover** — the text layers of `cover.html`, `slide1.html`, `slide2.html`,
   including headlines, quote attributions, statistic labels and captions.
3. **Every word the application renders** — UI labels, button text, navigation, column headers, empty
   and error copy, system-message templates, `helpContent` popovers and the explainer panel, chart
   legends, tooltips, `aria-label`s and page titles.

**And in the design plans that feed those surfaces,** because plan prose becomes UI copy: **no plan
may specify a banned word as a literal user-visible string.** A plan that names a button
`"Run triage"` has shipped the word, whatever the implementor does next.

**Out of scope:** the product's own source identifiers — a variable, a function, a CSS class, a JSON
key, a database column, an internal event name. Renaming `triageQueue` to satisfy a copy rule buys
nothing a judge will ever see and risks breaking working code. The ban is on what is *read*, not on
what is *compiled*.

**A quoted source is quoted verbatim.** If a practitioner's mined complaint (visual-assets spec §4.2)
uses a banned word, the quote is not edited — altering a quotation is worse than the tell. Choose a
different quote if one fits, or keep it and note the exception in the production notes.

##### §2 Rewriting, not word-swapping

A synonym that carries the same tell is not a fix. **Rewrite the sentence around the idea.**

- *"Impact, honestly measured: zero percent deflection"* → *"Measured on this run: zero percent
  deflection"*. The word was doing no work; the measurement was already the point.
- *"the panel honestly shows nothing"* → *"the panel shows nothing rather than guessing"*. The
  behaviour is the honesty; saying the word adds nothing.
- *"a complete triage app"* → *"a complete queue app"*, or better, name the action: *"it clears the
  repeats and leaves you the rest"*.
- *"two tickets triaged"* → *"two tickets sorted"*, or the concrete outcome: *"two tickets answered,
  none sent"*.

`instead:` in the list carries suggestions per entry, but they are prompts for a rewrite, not a
find-and-replace table. **Read the sentence aloud after changing it** (script-spec §4) — most banned
words are filler, and the sentence is usually shorter and better once the word is gone.

##### §3 Enforcement — a check, not a promise

The chassis ships the scanner. Run it; do not reimplement it.

```bash
# the video surfaces: narration, script, slides, cover, subtitles
python3 ../../hackathons/_useful/scripts/check_banned_words.py \
  --preset video ../../hackathons/hackathon-projects/2026-10-amazonDevs

# everything the application renders
python3 ../../hackathons/_useful/scripts/check_banned_words.py --preset app .

# the design plans, whose prose becomes UI copy
python3 ../../hackathons/_useful/scripts/check_banned_words.py --preset plans .

# what is on the list today
python3 ../../hackathons/_useful/scripts/check_banned_words.py --list
```

It prints `file:line:col` with the offending sentence, the reason and the suggested rewrites, and
exits non-zero on any hit. Clean output is `banned-words: clean (N files, M patterns)`.

**Where it runs, as a gate that fails the work unit:**

- **DP-SCRIPT** — after writing `demo-video-script.md` and `narration-segments.json`, and again after
  assembling the three asset text layers. `--preset video`.
- **DP-LIVE-RUN-AND-VIDEO** — at the §3 health gate, alongside the ffmpeg and credential checks, so a
  violation is caught **before** a voice is synthesized and before anything is recorded. Re-rendering
  narration because of one word is cheap; re-recording a take is not.
- **DP-UI** — in the craft audit work unit, `--preset app`, so no banned word reaches a rendered
  label, a help popover or a message template.
- **The blueprint run** — `--preset plans` before finishing, so no plan specifies a banned word as
  literal copy.
### §5.2b The 3D figures — binding rules from the figures spec (`../../hackathons/templates/demo-video-figures.spec.md`)

1. A film of 120–149 s has **three** figures: W1 (the cold open, shot `cold`), one `figure` beat between demo chapters (shot `wow`, 8–12 s, 16+ spoken words) and W6 (shot `wow`, entry `slab`). A second camera on the same data is not a second figure. No two figures share a title, a data file, a shape or a preset, and a film of three figures uses at least two archetypes (this one uses `radial`, `constellation` and `ribbon`).
2. The figure comes first and the narration is written to say it: each figure has a brief (§5.5) — the judge's question, the archetype and data that answer it, the claim (at most 8 words), the `say` phrase that names it, and the parts the voice points at.
3. Four channels say one thing: the voice (a `stage:caption` cue on exactly `explain.say`, then `stage:mark:<i>` for a clock or ribbon, or `stage:pulse:<node>` / `stage:flow:<n>` for a constellation), the headline (`props.line`, at most 8 words, sharing a word with the voice), the caption (`explain.title`, at most 12 words, and `explain.reads`, at most 16) and the labels (at most 28 characters each, at most 8 per figure).
4. The shape and the preset are chosen, not defaulted: `scripts/stage3d-pick.ts <project> --allow <shapes that tell this story truthfully> [--opening]`. For figure 1 the allowed shapes are `clock,donut`; for figure 2 `orb,hex,capsule`; for figure 3 `columns,lollipop,tube`. `bars` and `slab` are banned; `look.preset` is mandatory and is never `studio`.
5. The data is harvested from a real run (`provenance.source` must exist; `harvest-stage3d.ts` copies each source artefact into `video/stage3d/source/` so the path is always relative and always present). The 3D shows the product's own artefact and nothing else: no spinning logo, no particles, no abstract blob, no 3D text.

### §5.3 The segments and what each says (the starting draft; every sentence is edited against the ledger in WU-03 and none is kept that the product does not do today)

The segment ids are fixed so that the beat plan, the cues and DP-LIVE-RUN-AND-VIDEO can refer to them. The number of words is a target; the estimator decides.

| Segment | Beat | Target | Draft (spoken words only; `[…]` marks what the ledger must confirm before the sentence stays) |
|---|---|---|---|
| s1 | W1 | 10 s | "A week at one front door, read by an agent. Here is every event at her front door, by the hour. This one spoke is the hour that did not fit." |
| s2 | W2 | 14 s | "Rosa's daughter lives a train ride away. A quiet day could be nothing, or the start of something. Calling every day would take away her mother's independence." |
| s3 | W3 | 14 s | "Doorstep Rhythm is our entry for the Ring track. It reads one door as a week, and learns what normal looks like there. [Twenty] typed actions let an agent work on it, and a truth engine checks every step." |
| s3b | A1 | 7 s | "Every call to Ring goes through one port, and the proof is on record in the architecture file." |
| s4 | W4a | 10 s | "We load the sample week. It draws as a paper calendar, with a mark for every visit." |
| s5 | W4a | 10 s | "Beside it sits a plain timeline, and a label that says this is sample data, not a live account." |
| s6 | W4x | 11 s | "Here is how the agent works, step by step. [An extractor, a planner and an actor run on Amazon Bedrock — only when the ledger says `narrationMayNameBedrock`; otherwise: an extractor, a planner and an actor take turns.] The truth engine, written in code, checks every result." |
| s7 | W4b | 8 s | "Now we press Review the week. Every step the agent takes is listed as it happens." |
| s8 | W4b | 12 s | "The truth engine finds errors in the week. The agent repairs them, and the count falls to zero. That is the check running on the page." |
| s9 | W4c | 12 s | "One moment did not fit: a visit in the small hours. It is circled in pencil on its day, and opening it shows what the agent wrote." |
| s10 | W5 | 8 s | "Nothing reaches Marta until a person decides. Here is the request, with Approve and Reject." |
| s11 | W6 | 12 s | "Here are the errors the engine found, pass by pass. They start high, and they end at zero." |
| s12 | W7 | 6 s | "Doorstep Rhythm. Know her day without calling. The code is open source, and the page is live now." |

Rules for the draft: at most three numbers in the whole script (the draft uses one); the product name is first spoken in s3; s1 names no product; `[the hour that did not fit]` is the featured moment's hour from the ledger; the sentence of s6 about Bedrock is kept only when the rung was `bedrock` in both runs; the last sentence of s12 is kept only when the licence file, the public repository and the live address are all true on the day (WU-10 check 11); every sentence is at most 20 words and the average is 9–14.

**Cues (declared beside the words; each `on` phrase occurs exactly once in its segment):**

| Segment | Cues |
|---|---|
| s1 | `{ "on": "every event at her front door, by the hour", "fire": "stage:caption" }`, `{ "on": "This one spoke", "fire": "stage:mark:0" }` |
| s2 | `statement:1` on the phrase of the first statement, `statement:2` on the second, `statement:evidence` on `Calling every day` |
| s3 | `mechanism:name` on `Doorstep Rhythm`, `mechanism:track` on `the Ring track`, `mechanism:count` on `typed actions`, `mechanism:code` on `a truth engine` |
| s3b | `arch:pulse:<the Ring node id of architecture.json>` on `Ring`, `arch:proof:<an edge of that node that carries a proof>` on `the proof is on record` |
| s4, s7, s9, s10 | `demo:week` on `We load the sample week`; `demo:review` on `Review the week`; `demo:moment` on `circled in pencil`; `demo:decision` on `Here is the request` |
| s6 | `{ "on": "how the agent works, step by step", "fire": "stage:caption" }`, then `stage:pulse:extractor`, `stage:pulse:planner`, `stage:pulse:actor` on the words that name them, and `stage:pulse:truth` on `The truth engine` |
| s11 | `{ "on": "the errors the engine found, pass by pass", "fire": "stage:caption" }`, `stage:mark:0` on `start high`, `stage:mark:1` on `end at zero` |

`lint-cues.ts` fails on a phrase that is absent or occurs twice, an offset over one second, an unknown target, or cue markup inside `text`.

### §5.4 The fact harvest (spec §5, applied)

1. **Parameters.** The deployed address from the deploy record (or, when DP-DEPLOY ended `BLOCKED (…)`, a local server started with `PORT=<free> AGENT_PROVIDER=golden BUILD_MARKER=script npm run server`, recorded as a known gap), the sample week (`data/bundle/doorstep-14d.json`), the review started with the product's own `Review the week` button, every approval pressed through the interface.
2. **First, the smoke suite** against that address: `BASE_URL=<url> npx vite-node scripts/e2e-run.ts --label smoke e2e/smoke.spec.ts` must print `smoke: 4 passed, 0 failed, 0 skipped` (the smoke gate of DP-DEPLOY, run again so that no fact is measured against a broken page).
3. **Two runs** of `BASE_URL=<url> npx vite-node scripts/e2e-run.ts --label depth e2e/depth.spec.ts`; after each, the trace `e2e/artifacts/run-trace.json` is copied to `video/facts/run-<n>/run-trace.json` and `GET <url>/api/status` is read and stored as `status.json` beside it (`agent.kind` is the rung).
4. **Compare.** For each of `model_roles`, `actions`, `rounds`, `verify_repair_rounds`, `human_checkpoints`, `final_truth` and the verify entries' `truth` series: equal in both runs gives `quote: "exact"`; different gives `quote: "range"` with the minimum and maximum and a sentence in the script that says so (never one run's number as a fact).
5. **Featured moment.** The incident the agent opened: the first `open_incident` action entry of the trace (`args.title`, the number of event ids, the start time of its first event read from `data/bundle/doorstep-14d.json` by id); the same in both runs or a range.
6. **Measured or modelled.** Counts of the trace and of the bundle are measured or static; the quiet-hours window and any threshold are constants of the code (`kind: "constant"`); nothing the product does not compute is invented. The ledger holds at least these rows: `F-roles`, `F-actions-called`, `F-verify-passes`, `F-errors-first`, `F-errors-last`, `F-checkpoints`, `F-featured-hour`, `F-actions-total` (`design_documents/showcase-facts.json` `actions`), `F-bundle-days`, `F-bundle-events`, `F-rung`.
7. **Re-run guard.** `check-ledger.ts` performs one more depth run against a given address and fails when an `exact` row differs; DP-LIVE-RUN-AND-VIDEO runs it before filming.

### §5.5 The figure briefs (spec figures §3; each is written into the script's section 9 before the narration)

| Figure | Question a judge has | Archetype and data | Claim (≤ 8 words) | `say` | Parts the voice points at |
|---|---|---|---|---|---|
| 1 (W1) | What does an ordinary stretch at this door look like? | `radial` clock; events per hour over the sample fortnight (`data/bundle`) | A door has a rhythm. | every event at her front door, by the hour | one spoke: the hour of the featured moment |
| 2 (W4x) | How does the agent act, and what checks it? | `constellation`; the six parts, counts from the trace | Code checks every step. | how the agent works, step by step | extractor, planner, actor, truth engine |
| 3 (W6) | What did the check find, and where did it end? | `ribbon` (columns, lollipop or tube); `truth.errors` and `truth.warnings` per verify entry | The count falls to zero. | the errors the engine found, pass by pass | the first column and the last |

### §5.6 The arc check on estimated durations (`scripts/video/check_arc.py`)

The chassis solver needs rendered audio, which DP-LIVE-RUN-AND-VIDEO produces; this plan applies the same pure function to estimated durations. `check_arc.py` imports `check_arc` and `figures_required` from `../../hackathons/_useful/scripts/winner_arc.py` (by inserting that directory into `sys.path`), reads `beat-plan.json` and the estimator's per-segment seconds, adds `0.5` s between consecutive sentences of a segment and `0.5` s between segments, adds `3.0` s of tail to the close, builds `{ id, kind, scene, start, end, props }` per beat from consecutive windows, and calls `check_arc(beats, total, 180)`. It prints `arc: OK (total <s>s, demo <p>%)` when `problems` is empty (warnings are printed) and exits `1` with the problem lines otherwise. The estimate carries the estimator's own `cold` flag: while it is cold the check prints `arc: estimator cold, durations are the default rate` and a total within 10 % of the window edges is reported as a warning, not a pass.

### §5.7 The literal image prompts and the style block (written into `pitch/work/plates.json`; recorded in the script's section 9)

```json
{
  "style": "Editorial gouache illustration on warm paper, soft grain, matte flat shapes with hand-drawn pencil edges, one clear focal subject. Palette: dominant #F6F1E7 warm paper, secondary #D9EAE6 pale teal, accent #1B6A62 deep teal, a touch of #8F4B00 amber for lamplight. Light key, gentle morning or dusk light.",
  "negative": "no text, no letters, no numbers, no words, no logos, no watermarks, no user interface, no screenshots, no stock-photo clichés: no handshakes, no glowing brains, no circuit boards, no upward arrows, no laptops on desks, no generic robots",
  "plates": [
    { "id": "cover", "beat": "thumbnail", "intent": "stop the scroll at 320 px: one door, one pencil circle",
      "prompt": "A quiet front doorstep at dusk seen from the pavement: a worn welcome mat, a potted geranium, a warm porch lamp, the door slightly open with amber light spilling across the step. A loose hand-drawn pencil circle drawn around the lit gap of the door. Subject on the right third; the left third is empty warm paper for a title block." },
    { "id": "slide1", "beat": "problem", "intent": "distance and not knowing, congested and manual",
      "prompt": "A woman in her thirties at a kitchen table late in the evening, phone face down beside a cold mug, looking out of a dark window toward a far-off lit train platform; the room crowded with small unfinished things, a coat over a chair, a stack of unopened post. Subject on the left third; the right third is quiet empty background for a quote block." },
    { "id": "slide2", "beat": "outcome", "intent": "the same woman, unstressed, the flow uncongested",
      "prompt": "The same woman at the same kitchen table in clear morning light, a fresh mug, phone resting open and calm, a tidy table, the window now bright with a small distant figure at a lit doorstep. Same illustration style and palette as the evening scene, mirrored composition: subject on the right third; the left third is quiet empty background for a before-and-after block." }
  ]
}
```
`compose_plates.py` appends its own no-text sentence to every prompt. The `--project` argument is `../../hackathons/hackathon-projects/2026-10-amazonDevs/pitch/work` (a folder that holds only `plates.json`), **not** the project folder: the tool reads a `cinematic-tokens.json` it finds in the project folder and appends the key `dark`, which would contradict the paper theme. The tool writes `pitch/work/video/plates/<id>.png` and `plates-manifest.json`; `make-plates.ts` copies the three PNGs to `pitch/<id>-image.png` (`cover-image.png`, `slide1-image.png`, `slide2-image.png`).

### §5.8 The text layers (HTML; the skeleton of the visual-assets spec §7 is the base; these are the contents)

All three files: `<!doctype html>`, a fixed 1920×1080 stage, system fonts only (`Georgia` for display, `system-ui` for text), `../brand/brandmark.css` linked, the picture by relative path, colours from `cinematic-tokens.json` `themes.paper` (`--bg #F6F1E7`, `--surface #FFFDF8`, `--ink #221D16`, `--muted #5B5142`, `--accent #1B6A62`). The brandmark is the lockup markup of `brand/lockup.html` (`.brandmark.brandmark--slide`) placed over the flat background in the same corner on both slides; on the cover the mark alone is used (`.brandmark--cover` wrapper holding only the `<svg class="brandmark__mark">` of `brand/mark.svg`) so the app name is the single largest element.

| File | Text (counted; every word is HTML) |
|---|---|
| `pitch/cover.html` | app name `Doorstep Rhythm` (96 px or larger, heavy weight, on a solid band); one line `Know her day without calling.`; badge `Ring track`. Nothing else. |
| `pitch/slide1.html` | headline (a consequence, at most 12 words), for example `From far away, a quiet day and a bad day look the same.`; the quote block: the excerpt of the mined record chosen in WU-08 step 1, verbatim, attributed `r/AgingParents · August 2026`; the published figure `1 in 4` with its unit `older adults report falling every year` and its source `CDC, Older Adult Falls Data` (verified in WU-08 step 1); the persona line from `personas.json` (`Long-distance daughter watching solo-living mum`). |
| `pitch/slide2.html` | the before-and-after pairs from the ledger: `<errors first> errors → zero errors` (unit: errors the truth engine found in the week; measured) and `<events in the sample week> events to read → 1 moment circled` (measured); a one-line key `Measured on a recorded sample week`; at most three short benefit lines (`The week is read for her.`, `A checker written in code keeps it straight.`, `A person decides what is sent.`). |

## §6 Failure modes

| Failure | Detection | Handling |
|---|---|---|
| The deployed address is unreachable or the smoke suite is not `4 passed, 0 failed, 0 skipped` | `harvest-facts.ts` step 2 | `BLOCKED (smoke gate: <failing test>)`, exit `3`; nothing is measured against a broken page |
| DP-DEPLOY ended `BLOCKED (…)` and the deploy record has no address | `preflight.ts` | the harvest runs against a local server started with `AGENT_PROVIDER=golden`; `fact-ledger.json` records `rung: "golden"` and the script says "recorded run" wherever it speaks of the agent; recorded as a known gap in `video/script-acceptance.md` |
| The two depth runs differ on a figure | §5.4 step 4 | the row becomes `quote: "range"`; the script says "between <a> and <b>"; a single run's number is never a fact |
| The rung is not `bedrock` in both runs | `narrationMayNameBedrock` | no sentence names the sponsor's model service; the architecture insert says "the model service" and the segment text is rewritten, never the flag |
| A sentence says something the ledger does not hold | `check-ledger.ts` plus the cover table of WU-03 | the sentence is cut or rewritten; the ledger row is never edited to fit a sentence |
| The estimator is cold (no calibration for the voice) | `estimate().cold` | the check prints `arc: estimator cold, durations are the default rate` and the plan still applies the 120–150 s window; DP-LIVE-RUN-AND-VIDEO re-measures on rendered audio |
| The estimated total is under 120 s or over 150 s | WU-04 check 8 | segments are edited (never padded with filler, never speeded up); the arc check is re-run |
| A figure fails `lint-stage3d.ts` | WU-06 | the shape or the preset is re-picked with `stage3d-pick.ts`; the data file is never hand-edited |
| An image comes back with letters in it | `check-pitch.ts` text-contamination step (WU-09) | one regeneration with the same prompt plus the negative clause of §5.7, one more with a simplified prompt, then `BLOCKED (text-contaminated image: <id>)`; the typographic fallback is used only after two failed attempts |
| The CDC figure of slide 1 cannot be confirmed from the publisher's page | WU-08 step 1 | the slide uses the mined quote only and the evidence line says so; a figure without a fetched page is never printed |
| The image model route is refused | WU-07 | `BLOCKED (<named error>)`, exit `3`, after AI ACCESS §2 has been run |
| `python` is not on the PATH | `preflight.ts` | `BLOCKED (…)` (§0) |

## §7 Work units

Prefix `sk-`. One verification script per unit under `scripts/verify/`, each importing `scripts/video/lib.ts` and ending with `done("<name>", <total>, failures)`. The verification summary is §8.

### WU-SCRIPT-01 — preflight, the smoke gate, two measured runs
- **Goal:** two complete runs of the deployed product exist as files, with the rung read before each, so that every later sentence has something real to stand on.
- **Steps:**
  1. Write `scripts/video/lib.ts` (§3.6) and `scripts/video/preflight.ts`. The preflight runs the commands of §0 (the four prerequisite verifiers and the preflight lists) and prints `preflight: <n> checks passed`, or `BLOCKED (<named reason>)`.
  2. Write `scripts/video/harvest-facts.ts` following §5.4 steps 1–5: read the address from the deploy record (`url` field) or from `--base-url`; read `GET /api/status` and store `status.json`; run the smoke suite; run the depth suite twice; copy each trace to `video/facts/run-<n>/run-trace.json`; compare per §5.4 step 4; write `video/facts/harvest.json` with `{ version, measuredAt, baseUrl, rung, runsAgree, comparisons: [{ field, run1, run2, quote }], featured: { title, eventCount, startHour } }`.
  3. Run the preflight, then the harvest. Add `verify:script` to `package.json` (runs `sk-01` … `sk-10` in order). Write `scripts/verify/sk-01-harvest.ts`.
- **Files:** `scripts/video/lib.ts`, `scripts/video/preflight.ts`, `scripts/video/harvest-facts.ts`, `scripts/verify/sk-01-harvest.ts`, `package.json`, project folder `video/facts/harvest.json`, `video/facts/run-1/{run-trace.json,status.json}`, `video/facts/run-2/{run-trace.json,status.json}`.
- **Checks (12):**
  1. `npx vite-node scripts/video/preflight.ts` exits `0` and its last line matches `^preflight: \d+ checks passed$`.
  2. `lib.ts` exports every name listed in §3.6 (read by import, each is defined).
  3. `harvest-facts.ts` prints a line matching `^harvest: rung (bedrock|vertex-fallback|golden|manual), runs agree (yes|no), \d+ rows$`.
  4. `video/facts/run-1/run-trace.json` and `video/facts/run-2/run-trace.json` both pass `validateRunTraceFile`.
  5. Each `status.json` has `agent.kind` equal to the rung recorded in `harvest.json`, and the two runs recorded the same rung or `harvest.json` says `runsAgree: false`.
  6. `harvest.json` has `version` `1.0.0`, a non-empty `baseUrl` that does not contain `localhost` unless the deploy record is `BLOCKED`, and an ISO `measuredAt` from today.
  7. `comparisons` holds one row for each of `model_roles`, `actions`, `rounds`, `verify_repair_rounds`, `human_checkpoints`, `final_truth`, and each has `quote` equal to `exact` when `run1` equals `run2` and `range` otherwise.
  8. When the rung is `bedrock` or `vertex-fallback`, `comparisons` has a `truth` series row for the verify entries (first and last `errors`), and the first `errors` is at least `1` and the last is `0`.
  9. `featured.title` is non-empty, `featured.eventCount` is at least `1`, and `featured.startHour` is an integer from `0` to `23` read from `data/bundle/doorstep-14d.json` by event id.
  10. The smoke result recorded in `harvest.json` (`smoke`) equals `smoke: 4 passed, 0 failed, 0 skipped`.
  11. A call with a closed port (`--base-url http://127.0.0.1:9`) prints a line starting `BLOCKED (` and exits `3`; no file under `video/facts/` changed (compared by hash before and after).
  12. No file of this unit holds an absolute path (a leading slash path into a home or user directory, or a drive letter), a bearer token or a value of an environment variable named in the blueprint secrets list.
- **Verify:** `npx vite-node scripts/verify/sk-01-harvest.ts`
- **Expected output:** `sk-01-harvest: 12 checks OK`
- **Proves:** the facts of the film come from two runs of the product as deployed, the smoke gate was green before they were taken, and a broken address stops the plan instead of producing guesses.

### WU-SCRIPT-02 — the fact ledger, the re-run guard, the screen-reality record
- **Goal:** every figure the voice may say is a row with a source, and every region the film will point at has been seen on a real screen.
- **Steps:**
  1. Write `fact-ledger.json` (§3.2) by running `harvest-facts.ts --ledger`: the eleven rows of §5.4 step 6, each with `claim` in plain words, `value`, `kind`, `quote`, `range` when it applies and a `source` that names a real file and a JSON pointer or a command.
  2. Write `scripts/video/check-ledger.ts`: one more depth run against `--base-url` (default: the ledger's `baseUrl`), compare every `exact` row with the new trace and every `range` row against its bounds; print `ledger: <n> facts hold` or `ledger: <id> differs (was <a>, now <b>)` and exit `1`.
  3. Write `scripts/video/screen-reality.ts`: run the steps of `design_documents/demo-scenario.json` with `runStep`, and after each step record the visible text of the regions the film will name (`approval-bar`, the week strip, the evidence list, the agent chip) and the bounding rectangle of each, writing `video/facts/screen-reality.json` and one 1920×1080 PNG per step under `video/facts/reality/`.
  4. Write `scripts/verify/sk-02-ledger.ts`.
- **Files:** `fact-ledger.json`, `video/facts/screen-reality.json`, `video/facts/reality/*.png`, `scripts/video/check-ledger.ts`, `scripts/video/screen-reality.ts`, `scripts/verify/sk-02-ledger.ts`.
- **Checks (10):**
  1. `fact-ledger.json` has `version` `1.0.0`, `rung` equal to `harvest.json`'s, `runsAgree` equal to it, and `narrationMayNameBedrock` `true` exactly when `rung` is `bedrock` and both `status.json` files say `bedrock`.
  2. The ledger holds a row for each id of §5.4 step 6 (`F-roles`, `F-actions-called`, `F-verify-passes`, `F-errors-first`, `F-errors-last`, `F-checkpoints`, `F-featured-hour`, `F-actions-total`, `F-bundle-days`, `F-bundle-events`, `F-rung`) and ids are unique.
  3. Every row has a non-empty `claim`, a `kind` of the four allowed, a `quote` of the three allowed, and a `source.file` that exists (relative to the entry or the project folder).
  4. Every row with `quote: "range"` has `range` with `range[0] < range[1]`, and every row with `quote: "exact"` has no `range`.
  5. `F-actions-total` equals `actions` of `design_documents/showcase-facts.json`; `F-bundle-events` equals the length of the events array of the bundle; `F-bundle-days` equals the number of distinct local dates in it.
  6. `check-ledger.ts` against the ledger's address prints `ledger: <n> facts hold` and exits `0`.
  7. A copy of the ledger with one `exact` numeric row changed by `+1` makes `check-ledger.ts --ledger <copy>` print a line starting `ledger: <that id> differs` and exit `1`; the real ledger is unchanged (hash).
  8. `screen-reality.ts` prints `screen-reality: 8 steps, <m> regions` with `<m>` at least `8`, and `screen-reality.json` holds one entry for each step id of the demo scenario (`open`, `week`, `review`, `approve`, `circle`, `walk`, `focus`, `dusk`).
  9. Every region has non-empty visible text or a non-zero rectangle fully inside 1920×1080, and `approval-bar` is present in the entry of the step `approve`.
  10. Every PNG under `video/facts/reality/` is 1920×1080 (read from the file header) and larger than 10 kB.
- **Verify:** `npx vite-node scripts/verify/sk-02-ledger.ts`
- **Expected output:** `sk-02-ledger: 10 checks OK`
- **Proves:** a spoken number can be traced to a file, a changed product is caught before filming, and the screen directions of the script name regions that were seen to exist.

### WU-SCRIPT-03 — the winner-arc script
- **Goal:** `demo-video-script.md` exists in the nine sections of the spec §8, every sentence in it is backed by a ledger row or by the screen-reality record, and the nine sections are complete except section 9's pictures (WU-07 and WU-08 finish it).
- **Steps:**
  1. Write the header (section 1): project, track `Ring`, the cap quote of §3.5 verbatim, target speech time `120–150 s`, the one-line theme (`Know her day without calling.`), the voice `Iapetus` and the style string of §3.5, and the pronunciation table (at least `Doorstep Rhythm`, `Ring`, `Bedrock` when named, `Alvarez`).
  2. Write section 2 (fact-check status: date, address, rung, whether the runs agreed), then section 5 (the ledger, projected from `fact-ledger.json` by a small generator in `harvest-facts.ts --markdown`, with the modelled block separate).
  3. Write section 4 from the segment draft of §5.3: edit each sentence against the ledger and the screen-reality record. Each timed section is `### [m:ss – m:ss] <Title>` followed by `**[Visual: …]**`, the spoken prose and `*(N words — m:ss)*`; the word count is counted by a script, not typed.
  4. Write sections 3, 6, 7, 8 and a stub of 9: the delivery table; the coverage table (one named sentence per judging axis of the brief and one for the track); corrections (when none: the line `No earlier draft.`); production notes (recording settings of the brief: 1920×1080, captions on, under the cap, upload target); section 9 holds only the heading and the line `Completed in WU-SCRIPT-07 and WU-SCRIPT-08.`.
  5. Run the chassis script lint and the banned-words check; fix every finding in the prose, never in the lint.
  6. Write `scripts/verify/sk-03-script.ts`.
- **Files:** `demo-video-script.md` (project folder), `scripts/verify/sk-03-script.ts`, `scripts/video/harvest-facts.ts` (adds `--markdown`).
- **Checks (12):**
  1. `demo-video-script.md` has exactly nine headings matching `^## [1-9]\. ` in the order Header, Fact-check status, Delivery budget, The sections, Fact Ledger, Judging-axis coverage, Corrections applied, Production notes, Graphical assets.
  2. The header holds the cap quote of §3.5 verbatim, the voice `Iapetus`, the style string of §3.5 character for character, and the slogan `Know her day without calling.`.
  3. The timed sections are `### [m:ss – m:ss]` headings, consecutive without gaps, each with a `**[Visual:` line and a `*(N words — m:ss)*` marker whose `N` equals the number of words of its spoken prose (counted by the check).
  4. `(cd ../../hackathons && node scripts/lint-script-v2.ts hackathon-projects/2026-10-amazonDevs)` exits `0`: W1 holds 16–32 words and no product name, the name `Doorstep Rhythm` is first spoken in W3, every sentence is at most 20 words, the average is 9–14, at most three numbers.
  5. `python3 ../../hackathons/_useful/scripts/check_banned_words.py --preset video ../../hackathons/hackathon-projects/2026-10-amazonDevs` exits `0`.
  6. Every numeral and every spelled number in the spoken prose (two to twenty and larger, not `one`) appears in a ledger claim or value (checked by matching the number words against the ledger's `claim` and `value`).
  7. No spoken sentence names the sponsor's model service unless `narrationMayNameBedrock` is `true`, and none says `live` about the agent when the rung is `golden` or `manual`.
  8. Section 5 holds one table row for every ledger row (same ids) and a separate block headed `Assumptions and modelled figures` that is empty-stated (`None.`) when no row has `kind: "modelled"`.
  9. Section 6 names, for each of the four judging axes of `design_documents/hackathon_brief.md`, a segment id from §5.3 and quotes the sentence; each quoted sentence occurs verbatim in section 4.
  10. Every region named in a `**[Visual: …]**` line is a region id in `screen-reality.json`, or one of the beat scenes of §3.3 (Stage3D, Statement, Mechanism, ArchScene, ScreenScene, EndCard).
  11. None of the words listed in the banned-vocabulary contract of §5.2a occurs anywhere in the file (the check reads the list from the chassis checker's own output, `--list`, not from a copy).
  12. The script holds no absolute path and no secret value, and its production notes mention neither a voice recording nor a manual voiceover as a plan.
- **Verify:** `npx vite-node scripts/verify/sk-03-script.ts`
- **Expected output:** `sk-03-script: 12 checks OK`
- **Proves:** the film's words are true of the product as deployed, fit the winner arc's rules, name the track and the four axes, and carry nothing the vocabulary rules forbid.

### WU-SCRIPT-04 — the narration segments and their parity
- **Goal:** the spoken text exists as data, equal character for character to the prose, with cues the film's compositor can follow, and its estimated duration lies in the window.
- **Steps:**
  1. Write `scripts/video/script-to-segments.ts`: read the timed sections of section 4, map each spoken block to the segment ids of §5.3 (a marker line `<!-- seg: s3b -->` before each block), write `narration-segments.json` with the header of §3.5, one segment per id with `{ id, text, cues: [...] }`; with `--check`, compare and print `segments: <n> segments, <w> words, parity yes` or the first difference (exit `1`).
  2. Add the cues of the §5.3 cue table to the segments: for each, the phrase appears once and verbatim in its own segment's text and the target is a real beat or a figure element (`stage:caption`, `stage:mark:<i>`, `stage:pulse:<node>`, `stage:flow:<n>`, `open:stat`, `quote:attribution`, `reveal:name`, `reveal:track`, `impact:<n>`, `demo:<step>`).
  3. Apply the TTS-ready rules of the spec §4A: no markdown, no parentheticals, numbers and symbols written as words, every unpronounceable name respelled in the pronunciation table and left correct in `text`.
  4. Run the estimator through `estimate()` and write the per-segment seconds to `video/facts/estimate.json` (derived; regenerated each run).
  5. Write `scripts/verify/sk-04-segments.ts`.
- **Files:** `narration-segments.json`, `scripts/video/script-to-segments.ts`, `video/facts/estimate.json`, `scripts/verify/sk-04-segments.ts`.
- **Checks (12):**
  1. `narration-segments.json` parses and equals §3.5 in `project`, `voice`, `style`, `cap_seconds` and `cap_quote`.
  2. Segment ids are exactly `s1`, `s2`, `s3`, `s3b`, `s4` … `s12` in order, and there are twelve of them.
  3. `script-to-segments.ts --check` prints `segments: 12 segments, <w> words, parity yes` and exits `0`; the concatenated `text` equals the script's spoken prose after whitespace normalisation.
  4. Each segment's `text` has no `*`, `_`, `#`, backtick, parenthesis, digit, `%`, `&`, `/` or `@`.
  5. `(cd ../../hackathons && node scripts/lint-cues.ts hackathon-projects/2026-10-amazonDevs)` exits `0`.
  6. Every cue of the §5.3 cue table is present on its segment, and no `text` holds cue markup.
  7. `python3 ../../hackathons/_useful/scripts/tts_vertex.py --batch ../../hackathons/hackathon-projects/2026-10-amazonDevs/narration-segments.json --estimate` exits `0` and prints one `<id> words=… syllables=… estimate=…s` line per segment and a `TOTAL` line.
  8. The estimator TOTAL is at least `120` and at most `150` seconds with the gaps of §5.6 added, and at most `min(180 − 5, 165)`.
  9. No segment's estimate exceeds 22 s, and `s6` and `s11` (the two figure beats) each hold at least 16 words.
  10. W1's text (`s1`) shares at least one word with `props.line` of the cold-open beat once WU-05 has filled it (this check reads the beat plan when it exists, and is skipped with the printed word `pending` only while `beat-plan.json` does not exist yet).
  11. `check_banned_words.py --preset video` over the project folder exits `0`.
  12. `s12` contains the repository and the live address in words a person can say (the host spoken as words, never a URL), and the phrase `open source, live now` only when `showcase.json` `repo_url` and `live_url` are non-empty and the ledger's `rung` is not `manual`.
- **Verify:** `npx vite-node scripts/verify/sk-04-segments.ts`
- **Expected output:** `sk-04-segments: 12 checks OK`
- **Proves:** the words are one source of truth (the data file), the voice can read them, the estimate fits the arc, and each change on screen lands on the word that causes it.

### WU-SCRIPT-05 — the beat plan, the code card, the arc check
- **Goal:** `beat-plan.json` is the arc made explicit, every `<…>` of §3.3 is filled from real files, and the arc check passes on the estimated durations.
- **Steps:**
  1. Write `scripts/video/pick-code-card.ts` and run it for the W3 card: `npx vite-node scripts/video/pick-code-card.ts "<regex of the typed-action registry>" src/domain/actions.ts` (the file and pattern are the registry of typed actions of DP-DOMAIN-ENGINE); it prints `code: <file> <from>-<to>` with at most 12 lines, all of which exist in the file.
  2. Fill `beat-plan.json` from §3.3: segment ids from §5.3; `count.value` from `F-actions-total`; `pill` from the rung (`Live` only when the rung is `bedrock`; `Recorded run` for `golden`); `evidence.text` and `evidence.source` from the WU-08 step 1 result when it exists, otherwise the string `pending WU-SCRIPT-08` (WU-08 step 1 then replaces it; sk-05 accepts only the first value and sk-10 only the second).
  3. Write `scripts/video/check_arc.py` per §5.6 and run it.
  4. Run `(cd ../../hackathons && node scripts/lint-script-v2.ts hackathon-projects/2026-10-amazonDevs)` and `lint-cues.ts` again.
  5. Write `scripts/verify/sk-05-beats.ts`.
- **Files:** `beat-plan.json`, `scripts/video/pick-code-card.ts`, `scripts/video/check_arc.py`, `scripts/verify/sk-05-beats.ts`.
- **Checks (10):**
  1. `beat-plan.json` has `arc` `winner-v1` and eleven beats with the ids and kinds of §3.3 in that order.
  2. Every segment id of `narration-segments.json` belongs to exactly one beat, and every beat's `segments` exist.
  3. Every scene name is one of `Stage3D`, `Statement`, `Mechanism`, `ArchScene`, `ScreenScene`, `EndCard`, and no `<` remains in the file except inside the string `pending WU-SCRIPT-08`.
  4. `props.code.file` exists in the entry and its `lines` are within the file length; reading those lines yields the text the regex of step 1 matched.
  5. `props.count.value` equals the ledger's `F-actions-total` value, and `props.pill` is `Live` only when the ledger's rung is `bedrock`.
  6. No two of the three Stage3D beats (`W1`, `W4x`, `W6`) are adjacent in the order, the first beat is `cold-open`, and `A1` has a non-empty `reason`.
  7. `python3 scripts/video/check_arc.py` prints a line starting `arc: OK (total ` and exits `0`; the demo percentage printed is at least `45`.
  8. Each `props.line` of the three Stage3D beats has at most eight words and shares a word with its segment's text (compared case-insensitively).
  9. Each `sync` cue of the `demo` beats names a cue that is on the beat's own segment in `narration-segments.json`, or a step id of the demo scenario.
  10. `lint-script-v2.ts` and `lint-cues.ts` still exit `0`.
- **Verify:** `npx vite-node scripts/verify/sk-05-beats.ts`
- **Expected output:** `sk-05-beats: 10 checks OK`
- **Proves:** the arc is explicit and obeyed on estimated time, the code on the card is read from the repository, and every beat carries words that came from a file.

### WU-SCRIPT-06 — the three figures and their harvested data
- **Goal:** three 3D figure files that differ, each built from a copy of a real artefact, pass the chassis figure lint and are named and pointed at by the voice.
- **Steps:**
  1. Write `scripts/video/harvest-stage3d.ts`: copy `data/bundle/doorstep-14d.json` (events only) to `video/stage3d/source/bundle-events.json` and `video/facts/run-1/run-trace.json` to `video/stage3d/source/run-trace.json`; derive `data-1.json` (24 counts by local hour; the mark is the hour of `featured.startHour`), `data-2.json` (six nodes whose labels carry the counts of the trace) and `data-3.json` (errors and warnings per verify entry) in the shapes of §3.4; print `stage3d: 3 figures, <n> marks`.
  2. For each figure, run `(cd ../../hackathons && node scripts/stage3d-pick.ts hackathon-projects/2026-10-amazonDevs --allow <shapes of §5.2b rule 4> [--opening])` (`--opening` for figure 1 only), and write the printed `preset` and shape into the figure file.
  3. Write `stage3d.json`, `stage3d-2.json` and `stage3d-3.json` from §3.4 with `provenance.harvested_at` set to the run time.
  4. Add the stage cues of §5.3 to the matching segments of `narration-segments.json`; the `explain.say` phrase of each figure occurs once, verbatim, in the segment named by the beat plan (`s1`, `s6`, `s11`).
  5. Run `lint-stage3d.ts`, `lint-cues.ts` and `script-to-segments.ts --check`. Write `scripts/verify/sk-06-figures.ts`.
- **Files:** `scripts/video/harvest-stage3d.ts`, `stage3d.json`, `stage3d-2.json`, `stage3d-3.json`, `video/stage3d/source/*.json`, `video/stage3d/data-{1,2,3}.json`, `narration-segments.json` (cues), `scripts/verify/sk-06-figures.ts`.
- **Checks (10):**
  1. `harvest-stage3d.ts` prints `stage3d: 3 figures, <n> marks` with `<n>` at least `1`.
  2. `(cd ../../hackathons && node scripts/lint-stage3d.ts hackathon-projects/2026-10-amazonDevs)` exits `0`.
  3. Every `provenance.source` exists relative to the project folder and is byte-identical to the artefact it was copied from (hash).
  4. The three figures have three distinct `archetype` values (`radial`, `constellation`, `ribbon`), three distinct `explain.title` values, three distinct data files and three distinct presets, and none of the presets is `studio`.
  5. `data-1.json` has 24 values whose sum equals the number of events of the bundle, and its mark index equals `featured.startHour`.
  6. `data-2.json` has the six node ids of §3.4, every label is at most 28 characters, there are at most eight labels in the figure, and the six edges of §3.4 are present.
  7. `data-3.json` has one column per verify entry of the trace, its first error value equals the ledger's `F-errors-first`, its last equals `F-errors-last`, and `style` is one of `columns`, `lollipop`, `tube`.
  8. For each figure, `explain.title` has at most 12 words, `explain.reads` at most 16, `claim` at most 8, and `explain.say` occurs exactly once, verbatim, in the segment its beat names.
  9. Each figure has at least one `stage:` cue on its segment (`stage:caption` on exactly `explain.say`; a `stage:mark:<i>` for figures 1 and 3, a `stage:pulse:<node>` or `stage:flow:<n>` for figure 2), and `lint-cues.ts` exits `0`.
  10. No figure file or data file holds an absolute path, a spinning-logo or particle key, or a `shape` of `bars` or `slab`.
- **Verify:** `npx vite-node scripts/verify/sk-06-figures.ts`
- **Expected output:** `sk-06-figures: 10 checks OK`
- **Proves:** the three figures show the product's own artefacts, differ from one another, explain themselves, and are named by the voice at the moment they appear.

### WU-SCRIPT-07 — the brand copy, the image route, the cover
- **Goal:** `plates.json` carries the literal style block and prompts, the image route is proven under AI ACCESS §2, and the cover picture and cover layer exist.
- **Steps:**
  1. Copy `brand/brandmark.css` to `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/brandmark.css`.
  2. Run the commands of AI ACCESS §2 as reproduced in §0; list the image-capable models visible to the project; pick the pinned image model of the visual-assets spec, or the current non-preview flagship image model when it is retired; record the model name and region.
  3. Write `pitch/work/plates.json` from §5.7 (the folder holds only that file) and `scripts/video/make-plates.ts` (calls `compose_plates.py --project <pitch/work> --model <id> --location <region>`, copies the PNGs to `pitch/<id>-image.png`, prints `plates: <n> generated, <m> cache hits`). Run `compose_plates.py --dry-run` first and confirm it prints the three prompts with the style block and the negative clause.
  4. Run `make-plates.ts --only cover`. Write `pitch/cover.html` from §5.8 and `scripts/video/render-pitch.ts` (Playwright with `GL_ARGS`, viewport 1920×1080, writes `pitch/cover.png`; prints `pitch: <n> rendered`). Open `pitch/cover.png` with the image reader and write the first lines of `pitch/review.md`: what the picture shows, where the empty third is, whether the title block is legible at 320 px.
  5. Write `scripts/verify/sk-07-cover.ts`.
- **Files:** `brand/brandmark.css` (project folder), `pitch/work/plates.json`, `pitch/work/video/plates/*`, `pitch/cover-image.png`, `pitch/cover.html`, `pitch/cover.png`, `pitch/review.md`, `scripts/video/make-plates.ts`, `scripts/video/render-pitch.ts`, `scripts/verify/sk-07-cover.ts`.
- **Checks (10):**
  1. The project folder's `brand/brandmark.css` is byte-identical to the entry's.
  2. `pitch/work/` holds `plates.json` and no `cinematic-tokens.json`; `plates.json` has the style, the negative clause and three plates `cover`, `slide1`, `slide2` with the prompts of §5.7 character for character.
  3. `compose_plates.py --project <pitch/work> --dry-run` exits `0` and prints the three ids.
  4. `plates-manifest.json` exists, records a non-empty model and region, and the model is not a preview model; the same pair is written in the script's production notes.
  5. `pitch/cover-image.png` is a PNG of at least 1280 px on its long side, larger than 100 kB.
  6. A measured text-contamination test on the picture (the same test as WU-09 step 2: an edge-density test on the high-contrast stroke regions, then a read of the image by the image reader that must answer `no text`) finds no letters or digits.
  7. `pitch/cover.html` contains the words `Doorstep Rhythm`, `Know her day without calling.` and `Ring track`, links `../brand/brandmark.css`, and every word is HTML text, not an image.
  8. `render-pitch.ts` prints `pitch: <n> rendered`; `pitch/cover.png` is 1920×1080.
  9. The measured layout of `cover.html` (Playwright `getBoundingClientRect`) shows the app name as the single largest text element, at least 96 px, fully inside the stage, with the title block not overlapping the subject third.
  10. `pitch/review.md` has a `## Cover` section of at least three sentences that describes the picture without saying `looks good`, and the cover text has no banned word (`check_banned_words.py --preset video`).
- **Verify:** `npx vite-node scripts/verify/sk-07-cover.ts`
- **Expected output:** `sk-07-cover: 10 checks OK`
- **Proves:** the picture route is real and recorded, the cover is a generated image with zero text under an HTML title block, and it was looked at.

### WU-SCRIPT-08 — slide 1 and slide 2, with sourced evidence
- **Goal:** two light-mode slides whose evidence is verified (a dated quote from a mined record, a published figure fetched from its publisher) and whose before-and-after numbers come from the ledger.
- **Steps:**
  1. **Evidence.** Choose the mined record that fits W2 from `mined_frustrations.json` (the excerpt is copied verbatim, with its source and date). Fetch the publisher's page for the figure named in §5.8 with WebFetch; if the page states it, record the exact sentence, title and fetch date in `pitch/review.md` under `## Evidence` and write the figure into the slide and into `beat-plan.json` `W2.props.evidence` (`text`, `source`), replacing `pending WU-SCRIPT-08`. If the page does not state it, drop the figure (§6) and say so in the same section.
  2. Run `make-plates.ts --only slide1,slide2` and apply the text-contamination rule of §6 to each picture.
  3. Write `pitch/slide1.html` and `pitch/slide2.html` from §5.8 using the overflow-proof skeleton of the visual-assets spec (fixed stage, real layout engine, no text smaller than 24 px, nothing under 4.5:1 contrast).
  4. Run `render-pitch.ts`; open both PNGs with the image reader and add `## Slide 1` and `## Slide 2` to `pitch/review.md`.
  5. Write `scripts/verify/sk-08-slides.ts`.
- **Files:** `pitch/slide1-image.png`, `pitch/slide2-image.png`, `pitch/slide1.html`, `pitch/slide2.html`, `pitch/slide1.png`, `pitch/slide2.png`, `pitch/review.md`, `beat-plan.json`, `scripts/verify/sk-08-slides.ts`.
- **Checks (10):**
  1. The quote on slide 1 occurs verbatim in a record of `mined_frustrations.json`, its attribution says the community and the month, and the record's date is no later than the measured date.
  2. Slide 1 holds a published figure only when `pitch/review.md` `## Evidence` quotes the publisher's sentence, the page title and a fetch date of today or earlier; otherwise slide 1 holds no statistic.
  3. `beat-plan.json` `W2.props.evidence.text` equals the figure text on slide 1 (or the quote, when the figure was dropped) and no longer contains `pending`.
  4. Slide 2's two pairs use `F-errors-first` and the bundle's event count from the ledger, say `measured` in the key line, and any `modelled` row appears with the word `modelled`.
  5. Both slides use the paper theme: the computed background of the stage equals `#F6F1E7` and the text colour of the body equals `#221D16` (read in the browser).
  6. Each of `slide1-image.png` and `slide2-image.png` is a PNG larger than 100 kB and passes the text-contamination test of WU-07 check 6.
  7. Both layers link `../brand/brandmark.css`, place the lockup in the same corner (the two rectangles differ by at most 2 px), and carry the persona line of `personas.json` (slide 1) and the three benefit lines of §5.8 (slide 2).
  8. `render-pitch.ts` prints `pitch: 3 rendered`; `slide1.png` and `slide2.png` are 1920×1080.
  9. The measured pass shows no element overflowing or clipped, and no text below 24 px, on either slide.
  10. `pitch/review.md` has `## Evidence`, `## Slide 1` and `## Slide 2`, each of at least three sentences naming what is in the picture and where the text sits; neither slide's text has a banned word.
- **Verify:** `npx vite-node scripts/verify/sk-08-slides.ts`
- **Expected output:** `sk-08-slides: 10 checks OK`
- **Proves:** the slides say something a judge can check, both pictures carry zero text, and the numbers on slide 2 are the ledger's.

### WU-SCRIPT-09 — the measured pass over all three assets
- **Goal:** one command applies the measured verification of the visual-assets spec §8 to the nine files and reports no violation, and a looked-at review exists for each picture.
- **Steps:**
  1. Write `scripts/video/check-pitch.ts`: for each of `cover`, `slide1`, `slide2` check that the image, the layer and the render exist (nine files), render the layer in a browser, read every text node's rectangle, and report overflow, clipping, text under 24 px, contrast under 4.5:1 on the text colour against the computed background, and text-contamination of the picture. Print `pitch: 0 violations, 9 files` or one line per violation (exit `1`).
  2. Make a deliberate break in a copy (a 12 px paragraph appended to a copy of `slide1.html`) and confirm the tool reports it with the rule name.
  3. Open each of the three PNGs once more and finish `pitch/review.md`: for each, three sentences of what is seen and one sentence that names a problem found or says `no problem found` after the measured pass.
  4. Write `scripts/verify/sk-09-pitch.ts`.
- **Files:** `scripts/video/check-pitch.ts`, `pitch/review.md`, `scripts/verify/sk-09-pitch.ts`.
- **Checks (10):**
  1. `check-pitch.ts` prints `pitch: 0 violations, 9 files` and exits `0`.
  2. Each of the nine files exists with a non-zero size and the renders are 1920×1080.
  3. The copy with the 12 px paragraph makes `check-pitch.ts --dir <copy>` exit `1` and print a line containing `text-size`.
  4. A copy of `slide2.html` with a very long unbroken word makes it print a line containing `overflow`.
  5. A copy with the text colour set to the background colour makes it print a line containing `contrast`.
  6. A copy of `cover.png` with a block of rendered letters drawn into it makes the text-contamination step print a line containing `text-contaminated`; the real files are unchanged (hash).
  7. `pitch/review.md` has one section for each of the three assets, and each section contains a sentence that names a colour of the picture and a sentence that names the position of the empty third.
  8. The measured text sizes of all three layers are at least 24 px and the measured contrast of every text node is at least 4.5:1 (printed as a table in the verification output's detail line).
  9. All three layers are HTML text over a picture (no `<img>` is used for words, no `background-image` carries a text asset) and none of the three PNG pictures has an alpha channel with transparent text areas.
  10. `check_banned_words.py --preset video` over `pitch/` exits `0`.
- **Verify:** `npx vite-node scripts/verify/sk-09-pitch.ts`
- **Expected output:** `sk-09-pitch: 10 checks OK`
- **Proves:** the measured pass catches the faults it is meant to catch, the real assets pass it, and each picture was looked at by the author.

### WU-SCRIPT-10 — the narration review, the acceptance page
- **Goal:** the operator's edit file exists, every gate of the spec §10 has been run in order and recorded on one page, and the closing sentence is true.
- **Steps:**
  1. Run `python3 ../../hackathons/_useful/scripts/render_narration.py --segments ../../hackathons/hackathon-projects/2026-10-amazonDevs/narration-segments.json --outdir <scratch dir> --cap-seconds 180 --review`, copy the produced review file to `narration-review.md`, and add one line to the script's production notes that names that file as the place to change the words.
  2. Write `scripts/video/acceptance.ts`: run, in order, the four prerequisite verifiers of §0 (not re-run when fresh within the session), `sk-01` … `sk-09`, `lint-script-v2.ts`, `lint-cues.ts`, `lint-stage3d.ts`, `check_banned_words.py --preset video`, `check_arc.py`, `check-pitch.ts`, `script-to-segments.ts --check`, `check-ledger.ts`, and the closing-sentence test below; write `video/script-acceptance.md` (one table: gate, command, result, date) and print `acceptance: <n> of <n> gates pass`.
  3. **Closing-sentence test.** `s12` may say `open source, live now` only when all three claims have been verified in this run: `LICENSE` is MIT (WU-01 of DP-SUBMISSION), `showcase.json` `repo_url` answers `git ls-remote` or is recorded as `unpublished` in which case the phrase is removed, and `GET <live_url>/health` returns `200`. When one fails, the sentence is rewritten to the claims that hold and `script-to-segments.ts --check` is re-run.
  4. Write `scripts/verify/sk-10-acceptance.ts`.
- **Files:** `narration-review.md`, `video/script-acceptance.md`, `scripts/video/acceptance.ts`, `scripts/verify/sk-10-acceptance.ts`, `demo-video-script.md` (production notes line).
- **Checks (12):**
  1. `render_narration.py … --review` exits `0` and `narration-review.md` exists with one block per segment (twelve) and no cue markup in the spoken text.
  2. The script's production notes name `narration-review.md` as the file to edit.
  3. `acceptance.ts` prints `acceptance: <n> of <n> gates pass` with both numbers equal and at least `20`, and exits `0`.
  4. `video/script-acceptance.md` has one table row per gate and each row's result is `pass`.
  5. The closing-sentence test result is recorded in the table; when `s12` contains `open source, live now`, the three claims are each shown as verified with the command that verified them.
  6. `beat-plan.json` no longer holds the string `pending WU-SCRIPT-08` anywhere.
  7. The estimator total is between `120` and `150` seconds, the number is printed in the acceptance page, and the demo-beat percentage is at least `45`.
  8. The script's section 9 is complete: it holds the three image prompts, the style block, the model and region of WU-07, the slide 1 evidence and the slide 2 pairs (each word of them present in the HTML layers).
  9. The script's section 7 names every correction made between the first draft of §5.3 and the final text (a row for each segment whose text changed), or says `No earlier draft.` only when no segment changed.
  10. `lint-script-v2.ts`, `lint-cues.ts`, `lint-stage3d.ts` and `check_banned_words.py --preset video` all exit `0` when run directly by this check.
  11. `check-ledger.ts` prints `ledger: <n> facts hold` and exits `0`.
  12. The plan wrote nothing into `video/narration/`, `video/plates/`, `video/final.mp4` or any other path that DP-LIVE-RUN-AND-VIDEO owns (the listing of `video/` shows only `facts/`, `stage3d/` and `script-acceptance.md`).
- **Verify:** `npx vite-node scripts/verify/sk-10-acceptance.ts`
- **Expected output:** `sk-10-acceptance: 12 checks OK`
- **Proves:** the script, the segments, the beat plan, the three figures and the three assets pass every gate the spec lists before anything is filmed, and the film's last sentence is true when it is said.

### §7.1 Hand-offs to DP-LIVE-RUN-AND-VIDEO

DP-LIVE-RUN-AND-VIDEO consumes, unchanged: `narration-segments.json`, `beat-plan.json`, `stage3d*.json`, `video/stage3d/*`, `pitch/{cover,slide1,slide2}.png`, `fact-ledger.json`, `video/script-acceptance.md`. It runs `check-ledger.ts` before filming and re-runs `scripts/video/acceptance.ts` when any of those files changed. When it changes the rung (for example the model service fell back during the run), it re-reads `narrationMayNameBedrock` and rewrites the affected segment through `script-to-segments.ts`, never by editing the JSON by hand.

## §8 Verification summary

| WU | Verify script | Expected output | Checks |
|---|---|---|---|
| 01 | `sk-01-harvest` | `sk-01-harvest: 12 checks OK` | 12 |
| 02 | `sk-02-ledger` | `sk-02-ledger: 10 checks OK` | 10 |
| 03 | `sk-03-script` | `sk-03-script: 12 checks OK` | 12 |
| 04 | `sk-04-segments` | `sk-04-segments: 12 checks OK` | 12 |
| 05 | `sk-05-beats` | `sk-05-beats: 10 checks OK` | 10 |
| 06 | `sk-06-figures` | `sk-06-figures: 10 checks OK` | 10 |
| 07 | `sk-07-cover` | `sk-07-cover: 10 checks OK` | 10 |
| 08 | `sk-08-slides` | `sk-08-slides: 10 checks OK` | 10 |
| 09 | `sk-09-pitch` | `sk-09-pitch: 10 checks OK` | 10 |
| 10 | `sk-10-acceptance` | `sk-10-acceptance: 12 checks OK` | 12 |

`npm run verify:script` runs the ten in order and ends with `verify:script: 108 checks OK` (the sum of the column above).

## §9 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| The two runs disagree on the model's own choices (number of actions, rounds) | Medium | those rows are ranges and the sentences say "between"; the truth series is the harvest's anchor because its first and last values are rules of the engine |
| The deployed rung is `golden`, so the voice cannot call the agent live | Medium | the pill says `Recorded run`, the sentences say "recorded run", and the acceptance page names it as a known gap |
| The estimator is cold and the real voice runs slower than the estimate | Medium | the window leaves 15 s of headroom under the 165 s ceiling; DP-LIVE-RUN-AND-VIDEO re-measures on rendered audio and edits through `script-to-segments.ts` |
| The image model returns letters inside a picture | Medium | the negative clause, the measured contamination test, two retries, then the typographic fallback only after two failures |
| The CDC page changes or cannot be fetched | Low | the figure is dropped and the slide keeps the mined quote; no number without a fetched sentence |
| A figure looks generic | Low | `stage3d-pick.ts` chooses the shape and preset, the data is the product's own, and the explain card is checked by `lint-stage3d.ts` |
| The ledger goes stale between this plan and filming | Medium | `check-ledger.ts` runs again in DP-LIVE-RUN-AND-VIDEO WU-01 and fails on any exact row that moved |
| A sentence in the final minute claims more than is true (`open source, live now`) | Low | the closing-sentence test of WU-10 verifies licence, repository and health before the sentence stays |
