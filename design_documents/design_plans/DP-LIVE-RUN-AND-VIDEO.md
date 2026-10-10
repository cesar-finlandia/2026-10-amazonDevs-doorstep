# DP-LIVE-RUN-AND-VIDEO — the live gate, the live proofs, the one pause, the voice, the take and the finished narrated video

> Plan 12 of 12 (last). The single owner of everything that happens to the demo video after the words and the pictures exist: the health gate against the deployed address, the live architecture proofs and the live observations that close the feedback file, the one operator pause, the synthesized and re-voiced narration, the take of the deployed product, the storyboard, the render and the finished file `video/final.mp4`. It writes no product code. Its tools are thin wrappers under `scripts/video/` around the chassis tools, and every file the film is made from lives in the project folder.
> Chassis paths are written `../../hackathons/…`. The project folder is `../../hackathons/hackathon-projects/2026-10-amazonDevs/` and is called **the project folder** below. Scripts run under `vite-node` from the entry root; chassis tools are run as installed and never edited.

## §0 Context & blockers

**Must already exist before WU-01 runs** (plans 1–11). Proof, each prints its own line:

```bash
npx vite-node scripts/verify/at-07-architecture.ts
npx vite-node scripts/verify/e2e-12-results.ts
npx vite-node scripts/verify/sb-03-feedback.ts
npx vite-node scripts/verify/sk-10-acceptance.ts
```
Expected: `at-07-architecture: 16 checks OK`, `e2e-12-results: 10 checks OK`, `sb-03-feedback: 10 checks OK`, `sk-10-acceptance: 12 checks OK`. If one differs, stop: the owning plan is not finished. A video of a product whose words are not accepted, or whose address does not exist, is a submission failure.

**Preflight (each line must print a path):**
```bash
ls -d ../../hackathons/hackathon-projects/2026-10-amazonDevs/deploy-record.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/narration-segments.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/beat-plan.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/stage3d.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/stage3d-2.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/stage3d-3.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/fact-ledger.json ../../hackathons/hackathon-projects/2026-10-amazonDevs/pitch/slide1.png ../../hackathons/hackathon-projects/2026-10-amazonDevs/pitch/slide2.png ../../hackathons/hackathon-projects/2026-10-amazonDevs/pitch/cover.png
ls -d architecture.json config/architecture-proofs.json scripts/harvest-architecture-proofs.ts design_documents/submission/feedback.md scripts/check-feedback.ts scripts/public-readiness.ts scripts/video/lib.ts scripts/video/check-ledger.ts design_documents/demo-scenario.json
ls -d ../../hackathons/_useful/scripts/video_build.py ../../hackathons/_useful/scripts/video_gate.py ../../hackathons/_useful/scripts/render_narration.py ../../hackathons/_useful/scripts/apply_voice.py ../../hackathons/_useful/scripts/tighten_gaps.py ../../hackathons/_useful/scripts/align_narration.py ../../hackathons/_useful/scripts/resolve_cues.py ../../hackathons/_useful/scripts/compose_bed.py ../../hackathons/_useful/scripts/build_storyboard.py ../../hackathons/_useful/scripts/finalize_video.py ../../hackathons/_useful/scripts/verify_video.py ../../hackathons/_useful/capture/recorder.mjs ../../hackathons/_useful/capture/record.template.mjs ../../hackathons/_useful/cinema/scripts/render.mjs ../../hackathons/templates/video-config.example.json
ffmpeg -version
ffprobe -version
node --version
python3 --version
```
When `deploy-record.json` is missing, the deploy plan has not finished: print `BLOCKED (no deploy record: run DP-DEPLOY first)`, exit `3`; footage of a local server is never made (a flag-gated local run exists only as a recorded deviation, WU-01 step 4).

**Where this plan runs.** On the operator's own computer, because three things exist only there: the Applio checkout and the `cesar_voice` weights (variables `APPLIO_DIR`, `APPLIO_PTH`, `APPLIO_INDEX`), a working `ffmpeg` and `ffprobe`, and the operator's Vertex project under Application Default Credentials. WU-01 proves each. A missing Applio ends the run with `BLOCKED (Applio is not installed or the cesar_voice model is missing; the delivery voice is never replaced silently)`; a video in the stock voice is never shipped quietly.

**Live calls here.** Narration is synthesized by Gemini TTS on Vertex AI, the score by Lyria on the same project, and (only when the operator asks at the pause) a picture is regenerated. WU-02 also runs the product against a live Ring account and the sponsor's model service. The AI ACCESS rule is reproduced because these calls happen under this plan's commands.

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
**How this plan uses the rule above.** WU-01 runs the commands of AI ACCESS §2 before any synthesis. The narration voice and its style are the pair pinned in `narration-segments.json`; the TTS model and region are read from the renderer's own manifest and written into the production notes. When the model route fails after §2 has been run, the unit prints `BLOCKED (<named error>)`, exits `3`, and the run ends without a video: the silent master and the narration sheet are never offered as a replacement for the operator to voice by hand.

## §1 Purpose & requirement IDs

| ID | This plan's share |
|---|---|
| FR-26 (part) | The finished video: narrated, subtitled, paper theme, 120–150 s, `video/final.mp4` |
| FR-24 (part) | The footage shows the deployed address, after a smoke-green gate with two probes |
| N-TRUTH | Every spoken claim was measured by plan 11 and is checked again by `check-ledger.ts` before the take |
| NFR-08 | The banned-vocabulary check runs at the gate, before any voice exists, and again on the finished subtitles |
| NFR-10 | The entry holds only wrappers and verification scripts; every film file lives in the project folder |
| Architecture proofs | `api-ring`, `api-inbox` and `api-bedrock` proofs are harvested from a real run; a missing live line is reported and never replaced by a mock line |
| Feedback file | The live-check block of `feedback.md` is replaced by what the run observed, and `check-feedback.ts --final` passes |
| Spec §1.4a / §3A.0 | Exactly ONE operator pause, carrying the speech, the clock and the assets |
| Spec §1.7 | No manual voiceover, no editing suite, no hand-run mux |
| Brief item 3 | A video under the cap that shows the project functioning on its target platform |

## §2 Scope boundaries

**IN — files this plan creates (project folder unless it says entry):**

| Path | Purpose |
|---|---|
| `video-config.json` | the operator's choices for this video (§3.2) |
| `video/gate-report.json`, `video/production-notes.md`, `video/run-log.json`, `video/pause-receipt.json` | the gate result, every deviation, every stage with its operator stops, the single pause and its answer |
| `video/narration/*` (`seg-NN-<id>.wav`, `narration.wav`, `narration-manifest.json`, `narration.srt`, `narration.vtt`, `narration.ass`, `narration-words.json`, `.gemini-orig/`) | the voice, written by the chassis renderer |
| `video/cue-timeline.json`, `video/audio/bed.wav`, `video/audio/mix-report.json` | cues, the generated score and its measured mix |
| `video/master-animatic.mp4`, `video/storyboard-estimate.json` | what the operator judges at the pause |
| `video/record.mjs`, `video/master-silent.mp4`, `video/capture-geometry.json`, `video/take-log.txt` | the take |
| `video/storyboard.json`, `video/capture-plan.md`, `video/narration-timestamps.md`, `video/master-cinematic.mp4` | the solved beats, their projections and the composed picture |
| `video/final.mp4`, `video/final.srt`, `video/verify/verify-report.md` | the deliverable, its sidecar and the proof it is submittable |
| `video/proofs/`, `video/live-observations.json` | the live proof harvest and what was observed |
| entry: `scripts/video/live-gate.ts`, `live-proofs.ts`, `fill-live-check.ts`, `pause.ts`, `resume.ts`, `make-record.ts`, `build-video.ts`, `check-final.ts` | the wrappers of §3.5 |
| entry: `architecture.json` (proofs only, through the harvest), `design_documents/submission/feedback.md` (the live-check block only) | the two repository files this plan may change |
| entry: `scripts/verify/lv-01-gate.ts` … `lv-07-final.ts`, `package.json` (`verify:live`) | one verification script per unit |

**OUT — owned elsewhere:**

| What | Owner |
|---|---|
| The words, the segments, the beat plan, the three figures and the three assets | DP-SCRIPT (this plan reads them; a change goes back there) |
| The deploy and the build marker | DP-DEPLOY |
| The smoke suite and the depth run | DP-E2E-BROWSER-TESTING |
| The Devpost text and the readiness checks | DP-SUBMISSION (this plan re-runs two of its scripts) |
| Uploading the video, setting `video_url`, creating the public repository, pressing Submit | the operator (`public-readiness.md` names each as `BLOCKED (…)` until done) |
| The chassis tools | the chassis; run as installed |

## §3 Interfaces owned (literal skeletons)

### §3.1 Where files go

```
../../hackathons/hackathon-projects/2026-10-amazonDevs/
  video-config.json
  video/
    gate-report.json  production-notes.md  run-log.json  pause-receipt.json  live-observations.json
    proofs/{proof.log, harvest.json}
    narration/ audio/ cue-timeline.json
    master-animatic.mp4  storyboard-estimate.json
    record.mjs  master-silent.mp4  capture-geometry.json  take-log.txt
    storyboard.json  capture-plan.md  narration-timestamps.md  master-cinematic.mp4
    final.mp4  final.srt  verify/verify-report.md
```

### §3.2 `video-config.json` (literal; copied from `../../hackathons/templates/video-config.example.json`, then edited)

```json
{
  "video_theme": "paper",
  "capture_method": "screencast",
  "entry_root": "../../../hackathon-entries/2026-10-amazonDevs",
  "bed": { "preset": "paper-minimal", "enabled": true },
  "align_provider": "auto"
}
```
`video_theme` is `paper` for every layer: the app is recorded in its paper look (DP-UI), the figures and titles read the same value, the captions are the compositor's. The `entry_root` is the place of the entry relative to the project folder in the layout where the chassis and the entries sit side by side.

### §3.3 `pause-receipt.json` (literal)

```ts
export interface PauseReceipt {
  version: "1.0.0";
  pausedAt: string;                        // ISO, written by pause.ts when it prints the message of §5.2
  resumedAt: string | null;                // ISO, written by resume.ts; null while the operator has not answered
  pauses: 1;                               // always the number 1; a second pause is a defect
  asked: ["speech", "length", "assets"];   // the three things the one message carried
  estimate: { total_seconds: number; window: [120, 150]; words_to_change: number };
  assets: { id: "cover" | "slide1" | "slide2"; png: string; status: "ok" | "MISS" | "OLD" }[];
  answer: null | { speech_edited: boolean; regenerate: string[]; approved_by: "operator" | "earlier-approval-in-this-session" };
  deviation?: string;                      // required when approved_by is "earlier-approval-in-this-session"
}
```

### §3.4 `run-log.json` and `production-notes.md` (literal)

```ts
export interface RunLogEntry { stage: "gate" | "proofs" | "pause" | "voice" | "tighten" | "cues" | "bed" | "capture" | "storyboard" | "render" | "finalize" | "verify"; startedAt: string; endedAt: string; status: "ok" | "blocked" | "failed"; stops: 0 | 1; note?: string }
```
`stops` is `1` for the pause entry and `0` for every other. The sum of `stops` over the file is the number of times the run stopped for a human, and the finished video's check requires it to be exactly `1`.

`production-notes.md` has these headings in this order: `## Run`, `## Deployed address and build marker`, `## Voice and models`, `## Dataset of the take`, `## Alignment provider`, `## Deviations`, `## Known gaps`. The `## Deviations` section is a bullet list; each bullet starts with a stage id and says what differed and why. When nothing differed the section holds the line `None.`.

### §3.5 Tools (all under `scripts/video/`; each prints one summary line; `lib.ts` is plan 11's)

```
npx vite-node scripts/video/live-gate.ts [--base-url <url>] [--allow-local]    # WU-01: video_gate.py plus the additions of §5.3; prints `live-gate: <n> checks passed` or `BLOCKED (<reason>)` (exit 3)
npx vite-node scripts/video/live-proofs.ts                                      # WU-02: the live run, the proof harvest, the observations; prints `proofs: <n> proven, <m> missing`
npx vite-node scripts/video/fill-live-check.ts                                  # WU-02: replaces the Pending block of feedback.md from video/live-observations.json
npx vite-node scripts/video/pause.ts                                            # WU-03: runs the stages up to the pause, prints the one message of §5.2, writes pause-receipt.json, exits 0 with `pause: awaiting the operator`
npx vite-node scripts/video/resume.ts [--approve-earlier "<reason>"]            # WU-04: folds the operator's edits in, writes resumedAt, prints `resume: edits applied, <n> segments to re-voice`
npx vite-node scripts/video/make-record.ts                                      # WU-05: video/record.mjs from the chassis template and the demo scenario; prints `record: <n> screen beats, <m> actions`
npx vite-node scripts/video/build-video.ts [--from <stage>] [--to <stage>]      # WU-04..07: video_build.py with the run log kept; prints one line per stage
npx vite-node scripts/video/check-final.ts                                      # WU-07: the measured pass of §5.6 over final.mp4; prints `final: <n> checks passed`
```

## §4 Interfaces consumed (copy verbatim)

```ts
import { PROJECT, CHASSIS, readJson, writeJson, runNode, runPy, blocked, check, done, estimate } from "./lib";   // DP-SCRIPT §3.6
import { startServer } from "../../src/server/start";                                                             // DP-API-TRANSPORT §3
import { probeBedrock } from "../../e2e/bedrock-probe";                                                           // DP-E2E-BROWSER-TESTING §3.6
import { harvest } from "../harvest-architecture-proofs";                                                         // DP-API-TRANSPORT §3.10
import { readShowcase } from "../lib/submission";                                                                 // DP-SUBMISSION §3.5
import { readDemoScenario } from "../../hee/src/showcase/scenario";                                              // DP-SHOWCASE §4
```
Chassis commands used as installed (all run from the entry root):

```
python3 ../../hackathons/_useful/scripts/video_gate.py --project <project> --url <deployed> [--json <file>] [--skip-webgl]
python3 ../../hackathons/_useful/scripts/video_build.py <project> --url <deployed> [--from <stage>] [--to <stage>] [--only <stage>] [--force-stage <stage|all>] [--yes] [--no-bed] [--allow-local] [--dry-run]
python3 ../../hackathons/_useful/scripts/render_narration.py --segments <file> --outdir <dir> --cap-seconds 180 [--review] [--apply-review]
python3 ../../hackathons/_useful/scripts/apply_voice.py --check
python3 ../../hackathons/_useful/scripts/build_storyboard.py --project <project> [--pre-capture | --estimate | --check]
python3 ../../hackathons/_useful/scripts/finalize_video.py --video <file> --audio <wav> --out <mp4> --cap-seconds 180 --subtitle-mode soft
python3 ../../hackathons/_useful/scripts/verify_video.py --project <project>
node ../../hackathons/_useful/cinema/scripts/render.mjs <project>
(cd ../../hackathons && node scripts/lint-architecture.ts hackathon-projects/2026-10-amazonDevs)
(cd ../../hackathons && node scripts/lint-cues.ts hackathon-projects/2026-10-amazonDevs)
(cd ../../hackathons && node scripts/lint-stage3d.ts hackathon-projects/2026-10-amazonDevs)
```
`<project>` is `../../hackathons/hackathon-projects/2026-10-amazonDevs`. The chain's stage names, in order, are `gate → plates → pause → voice → cues → capture → storyboard → bed → render → finalize → verify` (the `tighten` and alignment steps run inside `voice`, through `apply_voice.py`, as the chassis wires them).

Files read (never edited): everything plan 11 lists as handed over (§7.1 of DP-SCRIPT), `deploy-record.json`, `event_profile.json`, `design_documents/demo-scenario.json`, `design_documents/showcase.json`, `config/architecture-proofs.json`.

## §5 Algorithms and literal content

### §5.1 The live-run contract (binding; derived from `../../hackathons/templates/demo-live-run-video.spec.md`, which this plan applies and does not restate in full)

1. The gate runs first and declines loudly: a named failure, the address probed, the owning plan and the command to re-run. No localhost footage except under `--allow-local`, which is recorded in `## Deviations`.
2. The footage shows the deployed address. The address comes from `deploy-record.json`, never typed.
3. The finished video is 120–150 s and never over `min(cap − 5 s, 165 s)`, measured on the finished file. An overrun is fixed by cutting words in plan 11's script, never by speeding the voice, never by trimming a hold below its measured audio.
4. The voice is synthesized before the camera rolls and every hold is a measured duration of the audio spoken over it.
5. There is exactly ONE operator pause; it carries the words, the clock and the pictures; after it the run goes to a finished file without stopping.
6. One theme for every layer: `paper`.
7. Every spoken word is on screen: captions are burned in (word highlighted) and shipped as a soft track and a sidecar `.srt`; text the viewer already sees as a hero headline is marked `yield` by the solver and not printed twice.
8. A large pointer is always on screen (drawn by the compositor from the recorder's geometry; the in-page pointer is a fallback behind `--dom-pointer`).
9. The delivery voice is `cesar_voice` through Applio over the pinned Gemini voice and style; a missing Applio fails loudly. No step of this plan asks a person to speak, record or edit a track.
10. The take is captured at a 1280×720 CSS viewport and device scale factor 2 by the CDP screencast, delivered at 1920×1080; the first frame is the calibration flash; `t0_offset` is measured.
11. The score is generated (Lyria on the same project), sits 12 dB under the voice, ducks under phrases, and is declared in the provenance. `--no-bed` is a recorded deviation.
12. Inter-sentence silences are clamped to 0.35–0.65 s by `tighten_gaps.py`; speech is never stretched, sped up or pitch-shifted.
13. The finished file is H.264 High yuv420p CRF 18 at 30 fps with `+faststart`, AAC 192 kbit/s 48 kHz stereo, normalised to −14 LUFS with a true peak under −1.5 dBTP; never a stream copy from WebM.
14. The deliverable's own checker (`finalize_video.py`) and the independent one (`verify_video.py`) both exit `0`; a check that cannot run is reported as skipped, never as passed.
15. The deployed product keeps state per browser session, so a fresh browser context is a fresh sample week; the plan reads `GET <address>/api/status` before the take and records the rung and the build marker in `## Deployed address and build marker`.

### §5.2 The one message of the pause (literal skeleton printed by `pause.ts`; the three asks are one message and the run waits)

```
THE ONE PAUSE — everything a person has to decide about this video is decided here.

(1) THE SPEECH — edit it until it sounds like a person:
    <path of narration-review.md, relative>

(2) THE CLOCK — <n> segments, estimated <mm:ss> against the window 2:00–2:30 and the ceiling <mm:ss>.
    <"inside the window" | "add or cut about <k> words (measured content, never filler)">

(3) THE PICTURES — open the three renders and judge them:
    cover   <relative path>  <size>  <time>  <ok|MISS|OLD>
    slide1  <relative path>  <size>  <time>  <ok|MISS|OLD>
    slide2  <relative path>  <size>  <time>  <ok|MISS|OLD>
    animatic: video/master-animatic.mp4 (480p; labelled colour fields; the arc, the pacing and the camera)

Reply once with: the edited speech (or "speech approved"), and "regenerate <ids>" for any picture to redo (or "pictures approved").
Nothing has been synthesized and no browser has been opened. After your reply the run goes on to final.mp4 without stopping again.
```
The message names no absolute path. When `pitch/` holds an `.svg` that contains a `<text>` element the message adds the line `WARNING: <file> is a hand-drawn SVG with text; regenerate it`.

### §5.3 What the gate checks beyond `video_gate.py` (`live-gate.ts`)

1. `video_gate.py --project <project> --url <deployed> --json video/gate-report.json` (the two probes 30 s apart, the build marker, the toolchain, the architecture lint, the cue lint, the vocabulary check, the Applio check).
2. The smoke suite against the same address: `smoke: 4 passed, 0 failed, 0 skipped`.
3. `check-ledger.ts --base-url <deployed>`: `ledger: <n> facts hold`.
4. `video/script-acceptance.md` exists, every row says `pass`, and no file named there is newer than the page (the page is stale when a script file changed after it was written).
5. The AI ACCESS §2 commands (printed in §0) succeed, and the Vertex project has TTS and the music model available in the configured region (a probe call of one word each, discarded).
6. `video-config.json` exists with the values of §3.2.

### §5.4 The live proofs (procedure of `live-proofs.ts`)

The deployed service keeps its proof log inside its container, so the proofs are produced by running **the deployed commit** (`git rev-parse --short HEAD` equals the build marker's commit part) locally with live credentials: `startServer({ port: 0, config: { staticDir: "dist", proofLog: "video/proofs/proof.log" }, env: { RING_MODE: "live", AGENT_PROVIDER: "bedrock", AGENT_ALLOW_FALLBACK: "0", BUILD_MARKER: "proofs-1", … } })` with the credential variables of the blueprint read from the process environment (names only; never printed, never written). Then:

1. `probeBedrock()`: when it says unavailable the `api-bedrock` proof is reported missing with the probe's error text.
2. A live Ring call needs `RING_ACCESS_TOKEN` (or the refresh trio) in the environment: when absent, the Ring observations are recorded as `not run` with the reason, and `api-ring` and `api-inbox` stay missing.
3. With credentials: call `listDevices`, `getEventHistory` (limit 20) and one webhook delivery signed with `RING_WEBHOOK_SECRET` (the product's own `ALLOW_SIMULATE` route, labelled simulated, is not a live delivery and is not used for `api-inbox`); run one agent review through `POST /api/agent/step`; stop the server.
4. `npx vite-node scripts/harvest-architecture-proofs.ts --dir . --log video/proofs/proof.log --sync --require-sponsor` with `ARCH_SYNC_DIR` set to the project folder. The harvest accepts only the modes of `config/architecture-proofs.json`; a missing proof is reported by name and the file is not weakened.
5. `video/live-observations.json` records, per operation, the date, the operation name, the outcome (`ok` | `error:<code>` | `not run: <reason>`) and one fact worth telling the vendor (a latency, a field that was missing, a limit hit), copied from the proof log or the response, never invented.
6. `fill-live-check.ts` replaces the block between `<!-- live-check:start -->` and `<!-- live-check:end -->` of `design_documents/submission/feedback.md` with a heading `Observed on <date>` and one bullet per observation (each ends with `(evidence: video/proofs/proof.log)` or `(evidence: video/live-observations.json)`); when nothing could be run the block says `Not run on <date>: <reason>` and the file still passes `check-feedback.ts --final`, because the block no longer begins with `Pending:`.

### §5.5 `video/record.mjs` (written by `make-record.ts` from `../../hackathons/_useful/capture/record.template.mjs`)

The generator copies the template, sets `URL` from `DEPLOY_URL` (the script exits with `BLOCKED (DEPLOY_URL is not set)` when it is missing), sets the entry root from `video-config.json`, and replaces the translator so that each `ScreenScene` beat's `actions` come from the scenario steps named by its `sync` cues: for a cue `demo:<step>`, the step of that id in `design_documents/demo-scenario.json`; its `{ "click": "<text>", "role": "<role>" }` actions become `{ at, key: "<step>-<n>", click: "role=<role>[name=\"<text>\"]" }`, its `{ "route": "<path>" }` becomes the beat's `route`, and its `wait_ms` values only space the `at` offsets inside the beat (the solver cuts idle time to the narration). `{ "play3d": "<shot>" }` becomes a call to `window.__demo3d.play`. No pixel coordinate appears anywhere. The generated file is plain data plus the call to the chassis recorder; it holds no absolute path.

### §5.6 The measured pass over the finished file (`check-final.ts`; every number is read from the file, not from a plan)

| Check | Rule | Tool |
|---|---|---|
| Container and streams | one video stream H.264 High yuv420p 1920×1080 30 fps, one AAC stream 48 kHz stereo, one `mov_text` subtitle stream, `+faststart` (the `moov` atom precedes `mdat`) | `ffprobe` |
| Length | 120 s ≤ duration ≤ 150 s and ≤ `min(180 − 5, 165)`; the last spoken word ends at least 3 s before the end | `ffprobe`, `narration-words.json` |
| Loudness | integrated within ±1 LU of −14 LUFS, true peak ≤ −1.5 dBTP | `ffmpeg -af ebur128=peak=true` |
| Voice | the manifest says `voice: "cesar_voice"` with a `voice_convert` block and `tts_voice: "Iapetus"`; the audio of the file is the manifest's track plus the score | manifest |
| Pace | measured words per second × 60 is 145–165; median inter-sentence silence 0.35–0.65 s | manifest, words file |
| Score | `mix-report.json` shows the bed at least 18 dB lower under speech than in the pauses, within 3 dB of the 12 dB-under-voice target | mix report |
| Captions | a still taken inside each of three captions shows legible caption text on screen (OCR when available, otherwise reported `skipped`); `final.srt` text equals the segments' text | `ffmpeg`, OCR |
| Theme | the storyboard theme is `paper`; the mean luminance of twelve stills (one per beat midpoint, the 3D beats included) is at least 0.5 of full scale | storyboard, `ffmpeg` |
| One pause | `run-log.json` stops sum to `1` and `pause-receipt.json` says `pauses: 1` | files |
| No manual voiceover | no file under `video/` is named like a recording (`*voiceover*`, `*mic*`), no step of the run log is `manual`, the narration track hash equals the manifest's | files |
| Independent proof | `verify_video.py --project <project>` exits `0` and writes `video/verify/verify-report.md` | chassis |

### §5.7 The final line (printed by `build-video.ts` at the end; the operator's paste)

```
final: video/final.mp4  <m:ss>  <p>% of cap  <mb> MB  captions: video/final.srt  cover: pitch/cover.png  live: <deployed address>
```
All paths are relative to the project folder; the address is the one the footage shows.

## §6 Failure modes

| Failure | Detection | Handling |
|---|---|---|
| No deploy record, or the address answers non-200, or the build marker is wrong | `video_gate.py`, §5.3 step 1 | `BLOCKED (<failing check, probed address, owner DP-DEPLOY, re-run command>)`, exit `3`; no file of the take exists |
| The smoke suite is not `4 passed, 0 failed, 0 skipped` | §5.3 step 2 | same, owner DP-DEPLOY |
| An `exact` fact of the ledger moved | `check-ledger.ts` | `BLOCKED (ledger: <id> differs)`, owner DP-SCRIPT; the script is corrected and plan 11's gates re-run; the run starts again at WU-01 |
| A word of the script is banned | the gate's vocabulary check | the sentence is rewritten in plan 11's files; the voice has not been synthesized yet, so the cost is one sentence |
| `ffmpeg`, `ffprobe`, Vertex credentials or the music model is missing | the gate | `BLOCKED (<tool>)`; never a partial run |
| Applio, `cesar_voice` weights or index missing | `apply_voice.py --check` | `BLOCKED (Applio …)`; the stock voice is never shipped |
| Live Ring credentials are absent | WU-02 step 2 | `api-ring` and `api-inbox` are reported missing, the observations say `not run: <reason>`, the film makes no live-Ring claim (the narration's rung rule is unchanged), and the gap is a bullet of `## Known gaps` |
| The sponsor's model route is unavailable | `probeBedrock()` | `api-bedrock` missing; the architecture beat's text and the narration do not name the sponsor's model service (`narrationMayNameBedrock` is not changed here) |
| The estimate is outside 120–150 s at the pause | `pause.ts` | the message says how many words to add or cut; the operator decides; the run never edits words itself |
| The operator rejects a picture | the answer at the pause | `resume.ts` runs plan 11's `make-plates.ts --only <ids>` and `render-pitch.ts`, then returns to the same pause message once; this is the same pause continued, not a second stop (the receipt records `regenerate`) |
| The narration exceeds the cap | `render_narration.py` exits non-zero | the run stops, names the overrun in seconds and points at `narration-review.md`; the voice is never sped up |
| A segment is truncated or runs away | the renderer's own check | re-render that segment once; a second failure stops the run |
| Word alignment unavailable | `align_narration.py` | the character-share path, recorded in `## Alignment provider` and `## Deviations`; subtitles and cues still ship |
| The music model is unavailable in the region | `compose_bed.py` | the run stops and names the model and region; the operator's choices are access or a licensed track dropped into the chassis beds folder; `--no-bed` only when the operator says so, recorded as a deviation |
| The browser build does not match the driver | the launch check of WU-05 | the matching build is installed (`npx playwright install chromium` run inside the entry) and the check re-run; a red check stops the run before the take |
| A beat fails mid-take | `take-log.txt` | the cause is fixed and the whole take is re-run; the failed log is kept as `take-log.<n>.txt`; takes are never spliced |
| The theme did not take | the recorder's seeding assertion | the take fails loudly |
| The calibration flash is not found | the recorder | recorded as a deviation; the geometry offset is `0` and the plan says so |
| The solver rejects the storyboard | `build_storyboard.py` | it names the file; beat plan or segments are fixed in plan 11's files and the stages from `cues` re-run |
| `finalize_video.py` or `verify_video.py` exits non-zero | exit code | the report names the measured value; the stage is fixed and re-run; the file is not renamed or edited by hand |
| The finished file is under 120 s or over 150 s | WU-07 | back to plan 11's WU-04 for the words; never a speed change |

## §7 Work units

Prefix `lv-`. One verification script per unit under `scripts/verify/`, each importing `scripts/video/lib.ts` and ending with `done("<name>", <total>, failures)`. The verification summary is §8. Each wrapper appends its stage to `video/run-log.json`.

### WU-LIVE-01 — the health gate and the toolchain
- **Goal:** the run starts only when the deployed product, the words, the tools and the credentials are all proven, and it declines loudly otherwise.
- **Steps:**
  1. Write `scripts/video/live-gate.ts` per §3.5 and §5.3. Create `video-config.json` from the template with the values of §3.2.
  2. Run the commands of AI ACCESS §2 (§0) and `python3 ../../hackathons/_useful/scripts/apply_voice.py --check`; print the resolved checkout and model names relative to the Applio directory variables (never the variables' values).
  3. Run `npx vite-node scripts/video/live-gate.ts` against the address of the deploy record. It writes `video/gate-report.json` and appends the `gate` entry to `run-log.json`.
  4. `--allow-local` is accepted only with `--base-url` pointing at a local server; it writes the first bullet of `## Deviations` in `video/production-notes.md` (`gate: footage of a local server, the operator asked for it`), and the first line of `production-notes.md` says so. Without the flag a local address is refused.
  5. Write `video/production-notes.md` with the headings of §3.4 and the first facts (`## Run` with the date; `## Deployed address and build marker` with the address, the marker read from `/health` and the rung read from `/api/status`). Add the `verify:live` script to `package.json` (runs `lv-01` … `lv-07` in order). Write `scripts/verify/lv-01-gate.ts`.
- **Files:** `scripts/video/live-gate.ts`, `video-config.json`, `video/gate-report.json`, `video/production-notes.md`, `video/run-log.json`, `package.json`, `scripts/verify/lv-01-gate.ts`.
- **Checks (12):**
  1. `live-gate.ts` prints a line matching `^live-gate: \d+ checks passed$` and exits `0`.
  2. `video/gate-report.json` exists, parses, and every check in it has `status` `pass` (or `skipped` only for the optional WebGL render when `--skip-webgl` was given and recorded).
  3. The report holds two address probes at least 25 s apart, both `200`, both with a build marker equal to the deploy record's `buildMarker`.
  4. The smoke result stored by the gate equals `smoke: 4 passed, 0 failed, 0 skipped`.
  5. `check-ledger.ts` was run by the gate and printed `ledger: <n> facts hold`.
  6. `ffmpeg -version` and `ffprobe -version` both exit `0`, and `gcloud auth application-default print-access-token` exits `0` (the token itself is neither printed nor stored; the check reads only the exit code).
  7. `apply_voice.py --check` exits `0`; the gate report names `cesar_voice` as the resolved model and holds no absolute path.
  8. `video-config.json` equals §3.2 (parsed), `video_theme` is `paper`, and the `entry_root` resolves from the project folder to the entry's folder name.
  9. The banned-vocabulary check (`check_banned_words.py --preset video` over the project folder) exits `0` and is recorded in the report as run before any narration exists (`video/narration/` is absent or empty).
  10. A call with a closed port prints a line starting `BLOCKED (`, names `DP-DEPLOY` and a re-run command, exits `3`, and creates no file under `video/narration/`.
  11. Without `--allow-local`, `--base-url http://127.0.0.1:9` is refused with `BLOCKED (`; with it, `production-notes.md` `## Deviations` gains a bullet that starts `gate:` (the check restores the file afterwards from a hash).
  12. `production-notes.md` has the seven headings of §3.4 in order and holds no absolute path, bearer token or variable value; `run-log.json` has a `gate` entry with `stops` `0`.
- **Verify:** `npx vite-node scripts/verify/lv-01-gate.ts`
- **Expected output:** `lv-01-gate: 12 checks OK`
- **Proves:** no footage is made against a dead deploy, a stale script, a missing tool, a missing voice or a banned word, and every refusal names its owner and its re-run command.

### WU-LIVE-02 — the live proofs, the observations, the closed feedback file
- **Goal:** the architecture proofs that need a live service are harvested from a real run of the deployed commit, and the feedback file records what that run observed.
- **Steps:**
  1. Write `scripts/video/live-proofs.ts` and `scripts/video/fill-live-check.ts` per §5.4.
  2. Run `npx vite-node scripts/video/live-proofs.ts`; it prints `proofs: <n> proven, <m> missing`, writes `video/proofs/proof.log`, `video/proofs/harvest.json`, `video/live-observations.json` and, through `--sync`, the proofs into `architecture.json` and the project folder's copy.
  3. Run `npx vite-node scripts/video/fill-live-check.ts`, then `npx vite-node scripts/check-feedback.ts --final`.
  4. Run `(cd ../../hackathons && node scripts/lint-architecture.ts hackathon-projects/2026-10-amazonDevs)`.
  5. Write `## Known gaps` bullets for every missing proof. Write `scripts/verify/lv-02-proofs.ts`.
- **Files:** `scripts/video/live-proofs.ts`, `scripts/video/fill-live-check.ts`, `architecture.json`, `design_documents/submission/feedback.md`, `video/proofs/*`, `video/live-observations.json`, `video/production-notes.md`, `scripts/verify/lv-02-proofs.ts`.
- **Checks (10):**
  1. `live-proofs.ts` prints `proofs: <n> proven, <m> missing` with `<n> + <m>` equal to the number of proof ids of `config/architecture-proofs.json` that require a live or sponsor mode.
  2. `video/proofs/proof.log` holds only lines of the real format (`<ISO time> proof edge=<id> mode=<mode> <text>`), none containing a bearer token, a refresh token or a variable value.
  3. For each proven id, `architecture.json` carries a proof whose `file` exists and whose `line` holds the proof text (read back from the file at that line).
  4. For each missing id, `video/proofs/harvest.json` names it with a reason, `production-notes.md` `## Known gaps` has a bullet for it, and `architecture.json` carries no proof for it.
  5. No proof in `architecture.json` has a mode outside the accepted modes of `config/architecture-proofs.json` (a `mock` or `bundle` line never stands in for `api-ring`).
  6. `lint-architecture.ts` exits `0`; when `api-bedrock` is proven the lint's sponsor-proof rule is satisfied, and when it is not, the lint's finding is the one named in `## Known gaps`.
  7. `video/live-observations.json` has one entry per operation attempted, each with `date`, `operation`, `outcome` matching `^(ok|error:[A-Za-z0-9_]+|not run: .+)$` and (for `ok`) a non-empty `fact`.
  8. The block of `feedback.md` between the live-check markers no longer begins with `Pending:`, begins with `Observed on ` or `Not run on `, and every bullet ends with `(evidence: <existing path>)`.
  9. `npx vite-node scripts/check-feedback.ts --final` exits `0` and prints `feedback: <n> tools, <m> evidence links`.
  10. Outside the live-check block, `feedback.md` is byte-identical to its state before the unit (hash of the text outside the markers), and `architecture.json` differs from its state before only in `proof` fields.
- **Verify:** `npx vite-node scripts/verify/lv-02-proofs.ts`
- **Expected output:** `lv-02-proofs: 10 checks OK`
- **Proves:** a proof drawn in the film's architecture beat came from a real log line at a real line number, a missing live service is reported and never faked, and the feedback file is closed with what was seen.

### WU-LIVE-03 — the one pause
- **Goal:** the run stops once, at the right moment, with the speech, the clock, the pictures and the animatic in front of the operator, and nothing has been synthesized or recorded.
- **Steps:**
  1. Write `scripts/video/pause.ts`: run `build-video.ts --from plates --to pause` (the `plates` stage holds when `pitch/work/plates.json` exists and its images are current; it never regenerates a picture unprompted), which produces `narration-review.md` (kept from plan 11), `video/storyboard-estimate.json` and `video/master-animatic.mp4` (`build_storyboard.py --estimate`, then the compositor in animatic mode).
  2. Read the estimate with `estimate()`, the asset list from `pitch/`, scan `pitch/` for `.svg` files with `<text>`, and print the message of §5.2.
  3. Write `video/pause-receipt.json` (§3.3) with `resumedAt: null`, `answer: null`; append the `pause` entry (`stops: 1`) to `run-log.json`; exit `0` with the line `pause: awaiting the operator`.
  4. **The executing agent ends its turn here and sends the message of §5.2 as its one question.** It does not synthesize, does not open a browser and does not ask again.
  5. Write `scripts/verify/lv-03-pause.ts`.
- **Files:** `scripts/video/pause.ts`, `scripts/video/build-video.ts`, `video/storyboard-estimate.json`, `video/master-animatic.mp4`, `video/pause-receipt.json`, `video/run-log.json`, `scripts/verify/lv-03-pause.ts`.
- **Checks (10):**
  1. `pause.ts` prints `pause: awaiting the operator` as its last line and exits `0`.
  2. `video/pause-receipt.json` has `pauses` `1`, `asked` equal to `["speech","length","assets"]`, `resumedAt` `null` and `answer` `null`.
  3. `video/narration/` holds no `.wav`, `narration-manifest.json` or `.srt` (nothing has been synthesized), and `video/master-silent.mp4` and `video/capture-geometry.json` do not exist (nothing has been recorded).
  4. `video/master-animatic.mp4` exists, is at most 480 lines high, has no audio stream, and its duration is within 10 % of `storyboard-estimate.json` `total_seconds`.
  5. `storyboard-estimate.json` `total_seconds` equals the estimator total of plan 11 plus the gaps (within 1 s), and the receipt's `estimate.window` is `[120, 150]`.
  6. The printed message matches the skeleton of §5.2 line for line: the three numbered asks, three asset lines (`cover`, `slide1`, `slide2`), the animatic line and the closing paragraph; it contains no absolute path.
  7. The receipt's `assets` has three entries whose `png` files exist, and each `status` is `ok` (an `OLD` or `MISS` makes this check fail and names the owner, DP-SCRIPT).
  8. `run-log.json` has exactly one entry with `stops` `1`, its stage is `pause`, and every other entry has `stops` `0`.
  9. A second call of `pause.ts` while the receipt has `resumedAt: null` prints `pause: already waiting for the operator` and does not append a second pause entry or change `pausedAt`.
  10. No file written by this unit holds a bearer token, a variable value or an absolute path.
- **Verify:** `npx vite-node scripts/verify/lv-03-pause.ts`
- **Expected output:** `lv-03-pause: 10 checks OK`
- **Proves:** there is one pause, it carries all three things a person has to decide, it happens before any voice or footage exists, and it cannot be repeated by accident.

### WU-LIVE-04 — the answer, the voice, the cues, the score
- **Goal:** the operator's answer is folded in, the narration is synthesized and re-voiced to the delivery voice, the gaps are tightened, the word times and cues are resolved, and the score exists, all measured.
- **Steps:**
  1. Write `scripts/video/resume.ts`: it refuses to run while the receipt has `answer: null` unless `--approve-earlier "<reason>"` is given (which sets `approved_by` `earlier-approval-in-this-session`, copies the reason into `deviation` and into `production-notes.md` `## Deviations`); with an answer it runs `render_narration.py … --apply-review` for edited speech, runs plan 11's `make-plates.ts --only <ids>` and `render-pitch.ts` for any picture to regenerate (then `check-pitch.ts`), re-runs `lint-cues.ts` and `script-to-segments.ts --check`, and writes `resumedAt`.
  2. Run `npx vite-node scripts/video/build-video.ts --from voice --to bed`. The chassis runs: Gemini synthesis per segment (one voice, one style, cached by content), `apply_voice.py` (Applio `cesar_voice`, then `tighten_gaps.py`, then `align_narration.py`), `resolve_cues.py`, and `compose_bed.py`.
  3. Listen to `video/narration/narration.wav` start to finish and write one line in `production-notes.md` `## Voice and models`: the TTS model and region (read from the manifest), the voice pair, the date, and the sentence `Listened end to end; fixes went through the script.`. A fix to a word goes into `narration-segments.json` through `script-to-segments.ts` and the stage re-runs; the audio is never edited.
  4. Write `## Alignment provider` (the provider named in `narration-words.json`; a degraded provider is also a bullet of `## Deviations`). Write `scripts/verify/lv-04-voice.ts`.
- **Files:** `scripts/video/resume.ts`, `video/narration/*`, `video/cue-timeline.json`, `video/audio/*`, `video/pause-receipt.json`, `video/production-notes.md`, `scripts/verify/lv-04-voice.ts`.
- **Checks (12):**
  1. `resume.ts` without an answer and without the flag exits `1` and prints `resume: no answer recorded`; with an answer it prints `resume: edits applied, <n> segments to re-voice` and the receipt has `resumedAt` set after `pausedAt`.
  2. `narration-manifest.json` has twelve segments with the ids of plan 11, each with measured `seconds` greater than `0`, and `start_seconds` values that are non-decreasing and contiguous with the fixed gap.
  3. The manifest says `voice: "cesar_voice"`, has a `voice_convert` block (with `pitch` `0`, `index_rate` `0.75`, `f0_method` `rmvpe`), `tts_voice` `Iapetus`, a non-empty `tts_model`, and the pinned style string of `narration-segments.json` character for character.
  4. The pre-conversion audio is kept under `video/narration/.gemini-orig/` (twelve files), and a file of the converted track differs from its original (hash).
  5. `total_seconds` of the manifest is at least `105` and at most `147` (the picture adds a close tail of at least 3 s, so the file stays at or under 150 s).
  6. The measured words per second times 60 is between `145` and `165`; the median silence between sentences is between `0.35` and `0.65` s; no silence between sentences exceeds `0.65` s.
  7. `narration.srt`, `narration.vtt` and `narration.ass` exist; the concatenated text of the `.srt` cues equals the concatenated `text` of `narration-segments.json` after whitespace normalisation; every cue lasts at least 1.2 s and has at most 84 characters on at most two lines.
  8. `narration-words.json` exists, names its provider, has `degraded` `false` unless `production-notes.md` `## Deviations` has a bullet starting `voice: character-share`, and its words are in non-decreasing time order.
  9. `video/cue-timeline.json` has an entry for every cue of `narration-segments.json`, each with a non-empty `evidence`; none is unresolved.
  10. `video/audio/bed.wav` exists, `mix-report.json` shows the bed within 3 dB of the 12 dB-under-voice target and at least 18 dB lower under speech than in the pauses, and each of the three kinds of generated asset (the voice, the score, the pictures) is named in the `scope` text of `design_documents/submission/ai_tools.json` or is recorded as a bullet of `## Known gaps` that starts `disclosure:`.
  11. The speech was never time-modified: the manifest has no `speed`, `atempo` or `pitch_shift` field set, and no stage of `run-log.json` is named like one.
  12. `production-notes.md` `## Voice and models` and `## Alignment provider` are filled, hold no absolute path or secret, and `check_banned_words.py --preset video` over `video/narration/` text files (`.srt`, `.vtt`, `.ass`) exits `0`.
- **Verify:** `npx vite-node scripts/verify/lv-04-voice.ts`
- **Expected output:** `lv-04-voice: 12 checks OK`
- **Proves:** the voice that will ship is the operator's delivery voice, produced without a person speaking, its pace and silences are measured, every spoken word is a caption, and the score is under the voice.

### WU-LIVE-05 — the take of the deployed product
- **Goal:** one continuous take of the deployed address in the paper look, at laptop layout and double density, with a measured offset and the geometry of every anchor.
- **Steps:**
  1. Write `scripts/video/make-record.ts` per §5.5 and run it. Run the first-pass solve `python3 ../../hackathons/_useful/scripts/build_storyboard.py --project ../../hackathons/hackathon-projects/2026-10-amazonDevs --pre-capture`.
  2. **Browser check.** Resolve the `playwright-core` version imported by the recorder from the entry's `package.json`, install that build (`npx playwright install chromium` from the entry root), and run a launch-and-close check; a red check stops the run.
  3. **State and theme.** Read `GET <address>/api/status` and `/health`; record the rung and the marker in `## Deployed address and build marker`. The recorder seeds the paper look before the first navigation (the persisted theme key of DP-UI) and asserts it took. Record the dataset in `## Dataset of the take` (`data/bundle/doorstep-14d.json`, the sample week, a fresh browser context).
  4. Run `DEPLOY_URL=<address> npx vite-node scripts/video/build-video.ts --from capture --to capture`; the take log goes to `video/take-log.txt`. A failed beat: fix the cause, re-run the whole take, keep the failed log as `take-log.<n>.txt`.
  5. Extract one still at each beat boundary into a scratch folder and look at three of them (one app beat, the trust beat, the close) with the image reader; write one sentence each in `production-notes.md` under `## Run` about where the pointer was.
  6. Write `scripts/verify/lv-05-take.ts`.
- **Files:** `scripts/video/make-record.ts`, `video/record.mjs`, `video/master-silent.mp4`, `video/capture-geometry.json`, `video/take-log.txt`, `video/production-notes.md`, `scripts/verify/lv-05-take.ts`.
- **Checks (12):**
  1. `make-record.ts` prints `record: <n> screen beats, <m> actions` with `<n>` equal to the number of `ScreenScene` beats of `beat-plan.json` (five) and `<m>` at least `8`.
  2. `video/record.mjs` contains no absolute path, no `localhost`, no digit pair that looks like a pixel coordinate in a `click` (the actions are role selectors), and imports `runTake` from the chassis recorder by relative path.
  3. The browser launch check printed a launched version equal to the installed build of the `playwright-core` the recorder imports.
  4. `video/master-silent.mp4` exists, has one video stream and no audio stream, is H.264 at a constant 30 fps, and is 2560×1440 (device pixels) or, when a fallback is recorded, 1280×720 with a bullet in `## Deviations`.
  5. The take's URL (read from `take-log.txt`) equals the deploy record's address and has no `localhost` unless the gate recorded `--allow-local`.
  6. `capture-geometry.json` parses, has a numeric `t0_offset` that is not `null` (or a recorded deviation says the flash was not found), and has a rectangle and a visibility window for each `data-demo-focus` anchor on each visited route (`workbench` on `/`).
  7. Every `ScreenScene` beat of the storyboard's first pass holds at least the measured seconds of its segments (hold ≥ the sum of `seconds` for its segments in the manifest).
  8. The theme assertion line of `take-log.txt` says `paper`, and the mean luminance of three stills from the master is at least `0.5` of full scale.
  9. Every `sync` event of the screen beats (`state:workbench`) appears in the geometry's event list at a time within 0.25 s of its narration cue in `cue-timeline.json` (reported with the largest difference).
  10. No screen beat is static for more than 6 s: the geometry's event and motion list has no gap larger than 6 s inside a `ScreenScene` window.
  11. The three looked-at stills are recorded as three sentences under `## Run` and none says only `ok`; each names where the pointer stood.
  12. A copy of `record.mjs` with `DEPLOY_URL` unset exits with `BLOCKED (DEPLOY_URL is not set)` and creates no master (checked on a scratch directory).
- **Verify:** `npx vite-node scripts/verify/lv-05-take.ts`
- **Expected output:** `lv-05-take: 12 checks OK`
- **Proves:** the footage is the deployed product in the film's one theme, laid out as a judge's laptop shows it, with every anchor located by measurement and no pixel typed by a person.

### WU-LIVE-06 — the storyboard and the composed picture
- **Goal:** the solver turns the measured voice, the measured take and plan 11's beat plan into a storyboard, and the compositor renders the whole picture, captions included.
- **Steps:**
  1. Run `npx vite-node scripts/video/build-video.ts --from storyboard --to render`; the stages are the final `build_storyboard.py`, the score (already made in WU-04, current by receipt), and `node ../../hackathons/_useful/cinema/scripts/render.mjs <project>`.
  2. Read `video/capture-plan.md` and `video/narration-timestamps.md` (projections); confirm by a script that the timestamps are the manifest's and the lines are the segments' text, with no word-count marker and no visual direction.
  3. Run `lint-stage3d.ts`, `lint-cues.ts` once more. Extract a still from each of the three Stage3D beats and look at them; write one sentence each into `video/production-notes.md` under `## Run` naming the figure's subject as seen.
  4. Write `scripts/verify/lv-06-render.ts`.
- **Files:** `video/storyboard.json`, `video/capture-plan.md`, `video/narration-timestamps.md`, `video/master-cinematic.mp4`, `video/production-notes.md`, `scripts/verify/lv-06-render.ts`.
- **Checks (10):**
  1. `video/storyboard.json` exists and `build_storyboard.py --project … --check` exits `0`.
  2. Every beat of `beat-plan.json` is in the storyboard in the same order; the first is `W1`; every `start` and `end` equals a value in `narration-manifest.json` or the beat boundary that follows from it (no computed durations); beats are contiguous.
  3. The storyboard's `theme` is `paper`, and the total is between `120` and `150` seconds.
  4. The demo beats (`W4a`, `W4b`, `W4c`) are at least 45 % of the total, no two Stage3D beats are adjacent, and `A1` is 8 s or shorter.
  5. Every `geo:<key>` reference of the storyboard resolves against `capture-geometry.json`, and no storyboard shot holds a typed pixel coordinate.
  6. `video/narration-timestamps.md` lines equal the manifest's `text` fields verbatim, each `mm:ss` equals the manifest's `start_mmss`, and the file holds no `(` `words` `—` marker and no `[Visual:` text.
  7. `video/master-cinematic.mp4` exists, is 1920×1080, 30 fps, H.264, has no audio stream, and its duration is within 0.5 s of the storyboard total.
  8. Three stills (one per Stage3D beat) are not blank (their pixel variance is above a floor), and the sentences in `production-notes.md` name each figure's subject (the words `door`, `parts` or `errors`, one per figure).
  9. `lint-stage3d.ts` and `lint-cues.ts` exit `0`.
  10. The chassis receipts show the `capture` stage `current` (the take was not re-run by this unit): the hash of `master-silent.mp4` equals its hash before the unit.
- **Verify:** `npx vite-node scripts/verify/lv-06-render.ts`
- **Expected output:** `lv-06-render: 10 checks OK`
- **Proves:** every beat's window is a measurement, the arc survived contact with real audio and a real take, and fixing a sentence later would not require filming again.

### WU-LIVE-07 — the finished video, proved unsubmittable or not
- **Goal:** `video/final.mp4` exists: narrated by the delivery voice, subtitled, in the paper theme, 120–150 s, produced with exactly one operator pause and without any person speaking, and the two checkers fail to find a reason it cannot be uploaded.
- **Steps:**
  1. Run `npx vite-node scripts/video/build-video.ts --from finalize --to verify`: `finalize_video.py --video video/master-cinematic.mp4 --audio video/narration/narration.wav --out video/final.mp4 --cap-seconds 180 --subtitle-mode soft` (the captions are already burned in, so only the soft track and the sidecar are added), then `verify_video.py --project <project>`.
  2. Copy `video/narration/narration.srt` to `video/final.srt` unchanged.
  3. Write `scripts/video/check-final.ts` (the table of §5.6) and run it. Read `video/verify/verify-report.md` and the contact sheet; write one paragraph under `## Run` in `production-notes.md` that says what was read.
  4. Re-run `npx vite-node scripts/public-readiness.ts --online`; it may print `BLOCKED (…)` rows for the operator's steps (public repository, uploaded video address); it must print no `FAIL` row.
  5. Print the final line of §5.7. Write `scripts/verify/lv-07-final.ts`. Then stop; the operator uploads `final.mp4`, `final.srt` and `cover.png`.
- **Files:** `video/final.mp4`, `video/final.srt`, `video/verify/verify-report.md`, `scripts/video/check-final.ts`, `video/production-notes.md`, `design_documents/submission/public-readiness.md`, `scripts/verify/lv-07-final.ts`.
- **Checks (14):**
  1. `finalize_video.py` exited `0` (read from the run log) and `video/final.mp4` exists and is larger than 5 MB.
  2. `ffprobe` shows exactly one H.264 High yuv420p video stream at 1920×1080, 30 fps, one AAC stream at 48 kHz stereo, and one subtitle stream of codec `mov_text`; the `moov` atom precedes `mdat`.
  3. The duration is at least `120` and at most `150` seconds, and at most `min(180 − 5, 165)`; the last spoken word of `narration-words.json` ends at least 3 s before the end of the file.
  4. The integrated loudness is within 1 LU of −14 LUFS and the true peak is at most −1.5 dBTP (measured).
  5. The audio stream is not silent: the mean volume of the first narrated sentence is at least −40 dB, and the measured drop of the bed under speech (`mix-report.json`) is at least 18 dB.
  6. The manifest says `voice` `cesar_voice` with a `voice_convert` block, `tts_voice` `Iapetus`, and no file under `video/` is named like a recording (`voiceover`, `mic`, `recording`); no stage of `run-log.json` is `manual`. (No manual voiceover.)
  7. `run-log.json` stops sum to exactly `1` (one entry, the pause) and `pause-receipt.json` has `pauses` `1`, a non-null `resumedAt` and a non-null `answer`.
  8. `video/final.srt` text equals `narration-segments.json` text after whitespace normalisation, and a still taken inside each of three captions shows caption text (read by OCR when available; otherwise the check prints `skipped` and does not count it as passed).
  9. The storyboard's theme is `paper` and the mean luminance of twelve stills (one per beat midpoint) is at least 0.5 of full scale; no still is a dark frame.
  10. `verify_video.py` exited `0` and `video/verify/verify-report.md` exists and names every row it ran; a row reported `skipped` is listed in `production-notes.md` `## Known gaps`.
  11. `check-final.ts` prints `final: <n> checks passed` with no failing row.
  12. The words in the video are the words of the segments: `check_banned_words.py --preset video ../../hackathons/hackathon-projects/2026-10-amazonDevs` exits `0`, and the production notes `## Deviations` bullets (if any) each name a stage id.
  13. `public-readiness.ts --online` printed no `FAIL` row; its `BLOCKED` rows are exactly among: no public repository remote, `video_url` not yet an uploaded address, offline gate (the three operator steps of DP-SUBMISSION).
  14. The final line printed by `build-video.ts` matches `^final: video/final\.mp4  \d+:\d\d  \d+% of cap  [\d.]+ MB  captions: video/final\.srt  cover: pitch/cover\.png  live: https://\S+$`.
- **Verify:** `npx vite-node scripts/verify/lv-07-final.ts`
- **Expected output:** `lv-07-final: 14 checks OK`
- **Proves:** the file the operator uploads is the finished video: it speaks in the delivery voice, every word is readable, it is light-themed and inside the cap, one pause produced it, no person voiced or edited it, and two independent checkers could not make it unsubmittable.

### §7.1 Hand-offs to the operator

The plan ends at `final.mp4`. The operator uploads `video/final.mp4` with `video/final.srt` and `pitch/cover.png`; sets `video_url` in `design_documents/showcase.json` (DP-SHOWCASE WU-07); creates the public repository; and then re-runs `npx vite-node scripts/public-readiness.ts --online` (DP-SUBMISSION WU-09), which turns the `BLOCKED` rows green. Pressing Submit is the one human decision left.

## §8 Verification summary

| WU | Verify script | Expected output | Checks |
|---|---|---|---|
| 01 | `lv-01-gate` | `lv-01-gate: 12 checks OK` | 12 |
| 02 | `lv-02-proofs` | `lv-02-proofs: 10 checks OK` | 10 |
| 03 | `lv-03-pause` | `lv-03-pause: 10 checks OK` | 10 |
| 04 | `lv-04-voice` | `lv-04-voice: 12 checks OK` | 12 |
| 05 | `lv-05-take` | `lv-05-take: 12 checks OK` | 12 |
| 06 | `lv-06-render` | `lv-06-render: 10 checks OK` | 10 |
| 07 | `lv-07-final` | `lv-07-final: 14 checks OK` | 14 |

`npm run verify:live` runs the seven in order and ends with `verify:live: 80 checks OK` (the sum of the column above). The units cannot run in one unattended sweep, because WU-03 ends by waiting for the operator; the script `verify:live` therefore stops after `lv-03` with `verify:live: waiting at the pause` while `pause-receipt.json` has `resumedAt: null`, and continues with `lv-04` once it is set.

## §9 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Applio, the voice weights or the operator's Vertex project are not on the machine running the plan | Medium | the gate checks all three before anything is synthesized and names the missing piece; nothing falls back to another voice |
| No live Ring account is available for the proofs | Medium | the proofs and observations are reported as missing or `not run`, the feedback block says so, the narration makes no live-Ring claim, and the architecture beat uses only proven edges |
| The real voice runs slower than plan 11's estimate and the video exceeds 150 s | Medium | plan 11 left headroom; the overrun is fixed by cutting words and re-running from `voice`; the picture's capture is not repeated because the take's beat list is hashed and unchanged |
| The deployed rung changed between plan 11 and the take | Medium | `check-ledger.ts` runs at the gate; a moved `exact` fact stops the run before anything is spent |
| The operator is away at the pause | Medium | the run waits; it never invents an approval; an earlier approval in the same session is accepted only through the recorded `--approve-earlier` deviation |
| OCR is not installed, so the caption read-back cannot run | Medium | reported `skipped`, listed in `## Known gaps`, never counted as passed; the caption text is also checked against the segments |
| The take is slow or a beat fails mid-run | Medium | the whole take is re-run and the failed log kept; content-keyed receipts mean only the take repeats |
| The music model is unavailable in the region | Low | the run stops and names the model and region; access or a licensed track are the two ways forward; `--no-bed` needs the operator's word and is a recorded deviation |
| A sentence the voice says stops being true after a late deploy | Low | the ledger guard at the gate; a later deploy means the gate runs again before any new take |
