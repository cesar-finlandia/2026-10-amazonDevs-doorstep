# DP-SHOWCASE — claims ledger, demo scenario, `/watch` replay, stills, README, judge kit, operator checklist

> Plan 9 of 12. The single owner of everything a reader sees besides the product itself and the video: the claim ledger that sources every number and comparison, the demo scenario that the stills and a browser test share, the `/watch` replay route, the stills and the hero GIF, the product README, `JUDGES.md`, and the operator's final checklist. Tooling is the vendored showcase tool under `hee/src/showcase/` and the replay kit under `hee/kits/showcase-replay/`; this plan configures and runs them and writes no second implementation of anything they do.
> Chassis paths are written `../../hackathons/…`. Imports use the `src/…` alias; scripts run under `vite-node`. The vendored tool and kit are used as installed and never edited.

## §0 Context & blockers

**Must already exist before WU-01 runs** (plans 1–8). Proof, each prints its own line:

```bash
npx vite-node scripts/verify/at-08-integration.ts
npx vite-node scripts/verify/e2e-12-results.ts
npx vite-node scripts/verify/dp-02-script.ts
```
Expected: `at-08-integration: 15 checks OK`, `e2e-12-results: 10 checks OK`, `dp-02-script: 12 checks OK`. The deploy record (`deploy-record.json`, DP-DEPLOY WU-04) must exist for the live URL; when DP-DEPLOY ended `BLOCKED (…)`, this plan uses the localhost fallbacks named in WU-04 and WU-05, says so in `showcase.json` `known_gaps`, and never invents a URL.

**Preflight (each line must print a path or a version):**
```bash
ls -d hee/src/showcase/cli.ts hee/kits/showcase-replay/kit.json hee/scripts/install-kit.ts hee/contracts/hee-demo-scenario.schema.json hee/contracts/hee-captions.schema.json actions.manifest.json data/golden-cache e2e/artifacts/run-trace.json src/ui/pages/Watch.tsx design_documents/hackathon_brief.md
node --version
npx playwright --version
python3 --version
```
`e2e/artifacts/run-trace.json` is written by the `UC02-4` and `DEPTH-1` tests; if it is missing, run `npx vite-node scripts/e2e-run.ts --label depth e2e/depth.spec.ts` first.

**Live calls here.** The stills (WU-04) press the product's own `Review the week` button on the deployed URL; when the deployed service reaches Amazon Bedrock that is the product's runtime, not this plan's. The AI ACCESS rule is reproduced because those calls happen under this plan's commands; no unit of this plan calls a model directly.

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
**How this plan uses the rule above.** If the deployed review needs a model route that is unreachable, the product steps down its visible ladder (labelled fallback, recorded run); the stills then show that rung as it really was in the agent chip and the caption never says "live Bedrock". Nothing in this plan hides which rung produced an image.

## §1 Purpose & requirement IDs

| ID | This plan's share |
|---|---|
| FR-22 | The `/watch` route: a second, isolated session replays the saved `run-trace.json`, labelled as a replay, never touching the live session or its trace |
| FR-25 (part) | `claims.json`, `demo-scenario.json`, stills, `README.md`, `JUDGES.md`, `operator-final-checks.md` |
| FR-23 | The README and captions use the product's own words; the stills show the explainer-era interface exactly as tested |
| NFR-08 | No banned vocabulary on README, judge kit, captions, scenario text |
| NFR-10 | The repository contains the README, the stills it shows and the ledger; nothing else generated lands in it |
| HEE-SHOW-01 | One scenario file read by both the stills tool and a browser test, so the stills show what the tests prove |
| HEE-SHOW-02 | Stills with one-sentence captions, a hero GIF, `captions.json` |
| HEE-SHOW-03 | README scaffolded, filled and linted; the measured-proof block written only by the evaluation `publish` command |
| HEE-SHOW-04 | `/watch` replay through the replay kit |
| HEE-CLAIM-01 | Every number, comparison and superlative on a surface is in `claims.json` with a source and a ceiling, verified |

## §2 Scope boundaries

**IN — files this plan creates or modifies:**

| Path | Purpose |
|---|---|
| `claims.json` | the claim ledger (written by the tool, filled by WU-01 and WU-05) |
| `scripts/gen-showcase-facts.ts`, `design_documents/showcase-facts.json` | measured facts the claims point at |
| `design_documents/showcase.json`, `scripts/showcase-config.ts` | the tool's configuration, derived from real sources (§3.1) |
| `design_documents/demo-scenario.json` (C-41) | the steps and stills (§3.2) |
| `e2e/showcase/demo-scenario.spec.ts`, `playwright.showcase.config.ts` | the browser test that runs the scenario (kept out of the 60-test E2E suite on purpose) |
| `src/kits/showcase-replay/**` | the installed kit (vendored; never edited) |
| `src/ui/pages/Watch.tsx`, `src/ui/showcase/ReplayView.tsx` | the `/watch` page (replaces the DP-UI shell; keeps the default export `WatchPage`) |
| `data/replay/run-trace.json`, `public/replay/run-trace.json`, `scripts/sync-replay.ts` | the saved run and its public copy |
| `scripts/make-stills.ts`, `shots/showcase/**` | the stills, hero GIF and `captions.json` |
| `README.md`, `JUDGES.md` | the two readers' documents |
| `design_documents/operator-final-checks.md` | the operator's checklist |
| `scripts/verify/sc-01-claims.ts` … `sc-07-operator.ts` | one verification script per work unit |
| `package.json` | scripts `showcase:facts`, `showcase:stills`, `verify:showcase` |

**OUT — named owners:**

| Not here | Owner |
|---|---|
| The product screens, tokens, shell, routes, `SessionProvider`, the panels the replay page reuses | DP-UI (the replay page imports them; none is changed) |
| `LICENSE`, `disclosure.md`, `design_documents/submission_description.md`, the Devpost fields, the deck, the final `gate --online` | DP-SUBMISSION |
| The smoke and depth specs and the 60-test suite | DP-E2E-BROWSER-TESTING |
| Deploying, the deploy record | DP-DEPLOY |
| Narration, slides, the video | DP-SCRIPT, DP-LIVE-RUN-AND-VIDEO |
| The evaluation numbers | DP-E2E-BROWSER-TESTING WU-10 (`evals/report.json`); this plan only runs its `publish` into the README |
| Any change to the chassis `../../hackathons/src/` | nobody: never modified |

## §3 Interfaces owned (literal skeletons)

### §3.1 `design_documents/showcase.json` (written by `scripts/showcase-config.ts`; literal template)

```json
{
  "version": "1.0.0",
  "title": "Doorstep Rhythm",
  "technology_name": "Ring",
  "license_name": "MIT",
  "live_url": "<url of deploy-record.json>",
  "video_url": "<live_url>/watch",
  "repo_url": "<https form of `git remote get-url origin`>",
  "supported_runtimes": ["Node 22 or newer, with a current Chromium for the browser tests", "A container host (Google Cloud Run is the documented default)"],
  "known_gaps": [
    "Live Ring needs a Playground token; the sample week is bundled so the product opens without one.",
    "Webhooks cannot reach a hosted copy during a demo; signed, labelled simulated deliveries go through the same verifier."
  ],
  "sixty_second_path": [
    { "step": "Open the live page and press Load the sample week.", "expect": "Seven days of Rosa's front door appear as a paper calendar." },
    { "step": "Press Review the week.", "expect": "The agent works through its steps and a request waits for you." },
    { "step": "Press Approve when the request appears.", "expect": "The review finishes and one moment is circled on its day." },
    { "step": "Press Focus above the 3D view.", "expect": "The camera frames the circled moment." },
    { "step": "Open /watch and press Watch the agent do it.", "expect": "A labelled replay of a recorded run plays." }
  ],
  "try_prompts": [
    "Look through the week and put a note on the one moment that doesn't fit her usual routine.",
    "Check the week over, fix anything that doesn't add up, and tell me in two sentences how it looks.",
    "Please play a reassuring message through the door speaker so Mum knows someone is thinking of her."
  ],
  "axes": [
    { "criterion": "Tech Implementation", "evidence": [
      { "label": "Architecture with runtime proof lines", "link": "architecture.json" },
      { "label": "Browser test results", "link": "design_documents/e2e-testing/results.md" },
      { "label": "Measured action-surface evaluation", "link": "evals/report.json" } ] },
    { "criterion": "Design", "evidence": [
      { "label": "Design brief", "link": "design_documents/design_brief.md" },
      { "label": "Hero recording", "link": "shots/showcase/hero.gif" } ] },
    { "criterion": "Potential Impact", "evidence": [
      { "label": "Who it is for and why it matters", "link": "design_documents/winning_project_plan.md" } ] },
    { "criterion": "Quality of the Idea", "evidence": [
      { "label": "The idea and the alternatives weighed", "link": "design_documents/pitch_candidates.md" } ] }
  ]
}
```
`live_url` and `repo_url` are read, never typed: `live_url` from `deploy-record.json` (the directory named by `PROJECT_SYNC_DIR`, default `../../hackathons/hackathon-projects/2026-10-amazonDevs`), `repo_url` from `git remote get-url origin` normalised to `https://github.com/<owner>/<repo>`. When either is unavailable `scripts/showcase-config.ts` stops with `BLOCKED (<named reason>)`. `video_url` is an interim value that resolves (the replay page of the live URL); the operator replaces it after the upload (WU-07 item 3) and the judge kit is rendered again.

### §3.2 `design_documents/demo-scenario.json` (C-41; literal structure; `N` is computed in WU-02)

```json
{
  "version": "1.0.0",
  "base_url": "http://127.0.0.1:8080",
  "viewport": { "width": 1280, "height": 720 },
  "steps": [
    { "id": "open", "title": "Open the page", "actions": [ { "route": "/" }, { "expect_text": "Load the sample week" } ], "settle_ms": 800 },
    { "id": "week", "title": "Load the sample week", "actions": [ { "click": "Load the sample week", "role": "button" }, { "wait_ms": 1500 }, { "expect_text": "Sample week" } ], "settle_ms": 600 },
    { "id": "review", "title": "Start the review", "actions": [ { "click": "Review the week", "role": "button" }, { "wait_ms": 6000 } ], "settle_ms": 500 },
    { "id": "approve", "title": "Approve the request", "actions": [ { "click": "Approve", "role": "button" }, { "wait_ms": 3000 } ], "settle_ms": 800 },
    { "id": "circle", "title": "Open the circled moment", "actions": [ { "click": "Open incident", "role": "button" }, { "wait_ms": 800 } ], "settle_ms": 600 },
    { "id": "walk", "title": "Walk through the door", "actions": [ { "play3d": "walk" }, { "wait_ms": 1500 } ], "settle_ms": 600 },
    { "id": "focus", "title": "Frame the moment", "actions": [ { "click": "Focus", "role": "button" }, { "wait_ms": 1500 } ], "settle_ms": 600 },
    { "id": "dusk", "title": "The evening look", "actions": [ { "click": "Dusk", "role": "radio" }, { "wait_ms": 600 } ], "settle_ms": 600 }
  ],
  "stills": [
    { "id": "week", "after_step": "week", "selector": null, "claim": "Seven days of Rosa's front door drawn as a paper calendar with every visit marked.", "claim_id": null, "alt": "The week as a paper calendar" },
    { "id": "agent", "after_step": "review", "selector": "[data-run-phase]", "claim": "The agent reads the week and checks each day while every step is listed as it happens.", "claim_id": null, "alt": "The agent panel mid-review" },
    { "id": "approval", "after_step": "review", "selector": "[data-result-region=\"approval-bar\"]", "claim": "Before anything reaches Marta the review waits for a person to press Approve or Reject.", "claim_id": null, "alt": "The approval request" },
    { "id": "circle", "after_step": "circle", "selector": null, "claim": "The one moment that did not fit the routine is circled in pencil on its day.", "claim_id": null, "alt": "The circled moment" },
    { "id": "stage", "after_step": "focus", "selector": "[data-result-region=\"scene-3d\"]", "claim": "The same week stands up in three dimensions with the circled moment framed.", "claim_id": null, "alt": "The 3D view focused on the moment" },
    { "id": "dusk", "after_step": "dusk", "selector": null, "claim": "The page has a calmer second look for the evening, switched with one control.", "claim_id": null, "alt": "The page in the evening look" }
  ],
  "hero": { "from_step": "review", "to_step": "approve" }
}
```
In the literal above `approve` has one `click`/`wait` pair; WU-02 repeats the pair `N` times where `N` is the number of approved approvals in the saved golden run (the stills must press exactly as many `Approve` buttons as the run asks for). The hooks used are only routes, visible text, labels and `window.__demo3d.play`; no `data-demo-focus` attribute is added.

### §3.3 `src/ui/pages/Watch.tsx` and `src/ui/showcase/ReplayView.tsx`

```tsx
// src/ui/pages/Watch.tsx — Requirement IDs: FR-22
import { SessionProvider } from "src/ui/state/SessionProvider";
import { ReplayView } from "src/ui/showcase/ReplayView";
/** The route "/watch": a second, isolated session (its own random session id; the server keeps bundle sessions apart) replays public/replay/run-trace.json. */
export default function WatchPage(): React.JSX.Element;   // <SessionProvider sessionIdOverride={newReplaySessionId()}><ReplayView /></SessionProvider>

// src/ui/showcase/ReplayView.tsx — Requirement IDs: FR-22, HEE-SHOW-04
export function newReplaySessionId(): string;             // "watch" + 12 characters from [a-z0-9]; matches /^[A-Za-z0-9_-]{8,64}$/
export function ReplayView(): React.JSX.Element;
/** Reads the replay session with useApp(); renders, inside one <section data-demo-focus="replay">:
 *  a StatusChip tone "degraded" with the label "Replay · nothing here is live";
 *  <ReplayControl session={session} trace={loadTrace} speeds={[1, 2, 4]} />;
 *  the product's own WeekRibbon, CheckPanel, ActivityFeedPanel and SceneStage (imported from src/ui, none re-implemented).
 *  Under `?hook=1` it sets window.__replay = { session } in an effect and removes it on cleanup. */
```
`loadTrace = () => fetch("/replay/run-trace.json").then((r) => r.json())`. The kit's `ReplayControl` supplies the banner `REPLAY of a recorded run from <date>. Nothing here is live.`, the button `Watch the agent do it`, the speed selector, `Pause`, `Resume`, `Stop` and the closing message `Replay finished. Nothing above was live.`; it adds no `data-demo-focus`.

### §3.4 Scripts

```
npx vite-node scripts/gen-showcase-facts.ts      # writes design_documents/showcase-facts.json; prints `facts: actions=20 e2eTests=60 ringScenarios=9 evalTasks=10`
npx vite-node scripts/showcase-config.ts         # writes design_documents/showcase.json from §3.1 and real sources; prints `showcase.json: live <url>`
npx vite-node scripts/sync-replay.ts             # copies data/replay/run-trace.json to public/replay/run-trace.json; prints `replay: synced <n> entries`
npx vite-node scripts/make-stills.ts [--base-url <url>]   # the stills tool's makeStills() with the software-GL launch arguments; prints the tool's own `stills: …` line
```

## §4 Interfaces consumed (copy verbatim)

```ts
import { readDemoScenario, runStep } from "../hee/src/showcase/scenario";       // HEE showcase tool: the same reader the stills tool uses
import { makeStills } from "../hee/src/showcase/stills";                         // makeStills({ entryDir, baseUrl?, scenario?, launch? })
import { countGifFrames, captionError } from "../hee/src/showcase/stills";
import { ReplayControl } from "src/kits/showcase-replay/src/react";              // installed by `npx vite-node hee/scripts/install-kit.ts showcase-replay --to . --variant react`
import { SessionProvider, useApp } from "src/ui/state/SessionProvider";          // DP-UI §3.2 (`sessionIdOverride` prop)
import { WeekRibbon } from "src/ui/week"; import { CheckPanel, ActivityFeedPanel, SceneStage } from "src/ui/panels";   // DP-UI §3.3
import { StatusChip } from "src/ui/primitives";
import { validateRunTraceFile } from "../hee/scripts/hee-validate-run-trace";
import { GL_ARGS } from "../e2e/helpers";                                        // DP-E2E-BROWSER-TESTING §3.2
import { test, expect } from "../fixtures";                                       // DP-E2E-BROWSER-TESTING §3.3 (used by e2e/showcase/*.spec.ts as "../fixtures")
```
The showcase command line (all `--entry .`): `npx vite-node hee/src/showcase/cli.ts claims init|verify|lint`, `readme scaffold [--force]|lint`, `stills [--base-url <url>]`, `judge-kit render|lint [--online]`, `gate [--online]`. Output lines the tool prints: `claims init: wrote claims.json`, `claims verify: <n> verified, <m> unverified`, `claims: OK (<n> claims)`, `readme: OK`, `stills: <n> stills, <f> hero frames, wrote shots/showcase/`, `judge-kit: OK`, `showcase gate OK`. Browser globals: `window.__doorstep` (under `?hook=1`), `window.__demo3d.play`, `[data-run-status]`, `[data-run-phase]`, `[data-demo-focus]`, `[data-result-region]`, `[data-hee-replay="start"|"state"|"message"|"progress"]` (the kit).

## §5 Algorithms and literal configuration

### §5.1 The binding rules of the showcase spec (reproduced)

> **Verbatim contract — HEE SHOWCASE SPEC.** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.


#### HEE showcase (binding; sits beside the demo video and never changes it)

Tooling is vendored at hee/src/showcase/ and hee/kits/showcase-replay/. Run commands as `npx vite-node hee/src/showcase/cli.ts <command> --entry .`.

1 Configuration. Write design_documents/showcase.json (title, technology_name, license_name, live_url, video_url, repo_url, supported_runtimes, known_gaps, sixty_second_path, try_prompts (exactly 3), axes (one per judging criterion, each with links to evidence)). Never invent a link; every link must resolve.
2 Demo scenario. Write design_documents/demo-scenario.json. Your end-to-end scenario specs MUST read it and execute its steps with runStep from hee/src/showcase/scenario.ts, so the stills show exactly what the tests prove. Use only these hooks: routes, visible text, labels, window.__demo3d.play. Do not add data-demo-focus attributes beyond the one per route that the UI contract already requires.
3 Stills. After deploy run `stills --base-url <live url>`. Each still carries one claim as its caption (one sentence, at most 140 characters).
4 Claims. Run `claims init`, write claims.json (every number, comparison and superlative on README.md, JUDGES.md, design_documents/submission_description.md, captions and UI copy, each with a source and a ceiling), then `claims verify`. A number from the evaluation comes from evals/report.json by pointer. Remove any sentence you cannot source. The video's own fact ledger is separate and untouched.
5 README. Run `readme scaffold`, fill the prose placeholders, then `readme lint` until clean. The measured-proof block is written only by the evaluation publish command; its ceiling sentence is quoted verbatim.
6 Judge kit. Run `judge-kit render`, then `judge-kit lint --online`.
7 Replay. Build the app's composition root as createSession(); mount the live app on / and, on /watch, a second session with the ReplayControl of hee/kits/showcase-replay. Copy the saved run-trace.json to the public folder. The control is labelled as a replay and never writes the real trace.
8 Gate. Before submission `gate --entry . --online` must print `showcase gate OK`. Then run the judge panel (stage final) from the chassis if available.

### §5.2 Facts (`scripts/gen-showcase-facts.ts`)

Writes `design_documents/showcase-facts.json` with exactly these numeric fields, each computed from an artefact and never typed:

| Field | Source | Expected |
|---|---|---|
| `actions` | `actions.manifest.json` `actions` entries whose `name` is not `get_capabilities` | `20` |
| `e2eTests` | the `Total: <n> tests` line of `npx playwright test --list` | `60` |
| `ringScenarios` | distinct `S-RING-<n>` ids in `design_documents/e2e-testing/strategy.md` | `9` |
| `evalTasks` | `tasks.length` of `evals/scenarios.json` | `10` |

Output is sorted-key JSON with a trailing newline and no timestamp, so two runs are byte-identical. A field that cannot be computed stops the script with its name.

### §5.3 Claim templates (`claims.json`; the tool writes the file, this plan fills it)

`claims init` creates the ledger. Claims are then added with these literal shapes (ids `C-01…`); a `match` is the exact string the tool's number detector extracts from the surface.

| id | match | kind | source | ceiling |
|---|---|---|---|---|
| C-01 | `20 actions` | number | artifact `design_documents/showcase-facts.json` pointer `/actions` format `{v} actions` | `Counts the typed actions this product registers; the capability listing the kit adds is not counted.` |
| C-02 | `60 tests` | number | artifact `design_documents/showcase-facts.json` pointer `/e2eTests` format `{v} tests` | `Counts the browser tests that are defined; one is skipped in a run that has no Amazon Bedrock route.` |

Every other number or superlative the tool detects on a surface (README, `JUDGES.md`, `shots/showcase/captions.json`, `src/copy/**/*`, `design_documents/submission_description.md`) is handled in one of three ways, in this order: **remove or reword the sentence** (the prose of this plan's own documents); **add a claim** whose source is an artefact that really contains it (`pointer` into `evals/report.json` for an evaluation figure, `design_documents/showcase-facts.json` for a count, or `contains` for a rule constant shown in the interface, with the ceiling `A limit the product applies, not a measured result.`); never reword copy in `src/copy/**`, which DP-UI owns: add the claim instead. No superlative (`first`, `only`, `best`, `fastest`, `never`, `always`, `guaranteed`, `unique`, `state-of-the-art`, `unprecedented`, `no other`) is written in this plan's documents.

### §5.4 The README content rules (the tool's template order is fixed; the headings are `Live demo`, `Video`, `See it`, `Try it in 2 minutes`, `Why Ring is the point`, `What the agent can do`, `The truth engine`, `Measured proof`, `Evidence`, `Architecture`, `What building this taught us about Ring`, `Develop, test, deploy`, `Licence and credits`)

- **Title and thesis (literal):** `# Doorstep Rhythm`, then the one-line paragraph `Know her day without calling. Doorstep Rhythm circles the one moment at her front door that did not fit the week.`
- **Live demo / Video:** the two URLs of `showcase.json`, each on its own line, each resolving.
- **See it:** the hero GIF first (`shots/showcase/hero.gif`), then the readme-size stills of `captions.json` in its grid, each followed by its caption line.
- **Try it in 2 minutes:** three to six numbered steps = the `sixty_second_path` steps; then the three `try_prompts` as a quoted list.
- **Why Ring is the point:** one paragraph naming the capabilities used (signed webhooks, event history, live view, snapshot, chime, account linking, more than one camera) and what the product could not do without them; numbers only in words except those backed by claims.
- **What the agent can do:** the action table generated by the tool from `actions.manifest.json` (header `| Action | Group | What it does |`, one row per action) plus two sentences on approvals.
- **The truth engine:** the rules by their words (`quiet hours`, `long visits`, `device offline`, `consent`, `duplicate events`, `change history`, `moments without a write-up`) and the verify-then-repair loop, in five sentences at most.
- **Measured proof:** only the block written between `<!-- hee-eval:start -->` and `<!-- hee-eval:end -->` by `npx vite-node hee/src/agent-eval/cli.ts publish --entry .`, with its ceiling sentence verbatim; if no comparable report exists the block states `The action-surface evaluation has not been measured for this build.`
- **Evidence:** at least three links, relative and existing (`architecture.json`, `design_documents/e2e-testing/results.md`, `shots/showcase/captions.json`, `evals/report.json`).
- **Architecture:** a fenced diagram of at least five lines (text boxes and arrows) matching `architecture.json`'s nodes.
- **What building this taught us about Ring:** three short paragraphs drawn from `design_documents/friction-log.md` (shapes that differed from the documentation, the 30-minute Playground token, webhooks not reaching a hosted copy).
- **Develop, test, deploy:** exactly these commands in fenced blocks, in this order: `npm install`, `npm run build`, `npm run server`, `npm run e2e`, `BASE_URL=<url> npx playwright test e2e/smoke.spec.ts`, `npm run deploy:cloud-run`.
- **Licence and credits:** `MIT`, the upstream credit line of the vendored kits (read from `hee/VENDOR.json` and each kit's `UPSTREAM-NOTICE.md`), and the Ring and Amazon Bedrock names as used.

### §5.5 The replay trace (`data/replay/run-trace.json`)

Copied from `e2e/artifacts/run-trace.json` after a golden run that passed `validateRunTraceFile`. It must have at least 15 action entries with `args` (the replay plan skips an action entry without `args` and ends with the closing banner). `scripts/sync-replay.ts` copies it unchanged to `public/replay/run-trace.json`; the two files are byte-identical at all times (a verification script asserts it). The trace contains the seeded sample week's action arguments only; no credential, no token, no personal data.

### §5.6 Stills: software-GL launch

The stills tool's own CLI launches Chromium without graphics flags; on a machine without a GPU the 3D view would then show its unavailable message. `scripts/make-stills.ts` therefore calls the same `makeStills()` with `launch: () => chromium.launch({ args: GL_ARGS })` and, before it starts, opens one throwaway page and prints `stills: webgl yes` (or `stills: webgl no` and stops with exit `1`). The scenario, the steps and the files written are the tool's own.

## §6 Failure modes

| Situation | What happens |
|---|---|
| No deploy record | `scripts/showcase-config.ts` stops with `BLOCKED (no deploy record: <DP-DEPLOY result>)`; WU-04 and WU-05 use a local server (`PORT=<free> AGENT_PROVIDER=golden npm run server`) and add the known gap `The stills were captured from a local copy that uses the recorded run.` |
| No git remote | `BLOCKED (no remote named origin)`; the operator adds it (WU-07 item 1) and `showcase-config.ts` is rerun |
| The deployed rung differs from the recorded run's approvals | the `approve` step of the scenario fails with `no element named "Approve"`; the stills are captured against a local golden server instead and the caption of the agent still says nothing about the rung |
| The kit's replay diverges | the kit prints `Replay diverged at step <n>…`; WU-03 check 7 fails; the cause is a recorded call whose live answer changed: re-record the trace |
| The claims tool finds an unsourced number | `claims lint` lists `file:line: "<number>" is not in claims.json`; handled by §5.3 |
| A link in the judge kit does not resolve online | `judge-kit lint --online` names it; fix the link or the page |
| The 3D still is blank | WU-04 check 8 fails; the cause is the launch arguments or the `focus` step order |

## §7 Work units

Conventions for every unit: scripts live in `scripts/verify/`, start with `import { createChecker } from "./ui-kit.js"` (`done()` prints `<name>: N checks OK` and exits `0`, or prints the first failing label and exits `1`), and may use `run(cmd, args, opts?) → { code, out }` from `scripts/verify/e2e-kit.ts`. Browser checks use `openApp` and `readModel` of `scripts/verify/ui-kit.ts` (DP-UI §3.4). A unit's check count in its header, its list and its Expected output must be the same number; if a script is written with another count, change all three in the same edit. Every unit runs from the entry root. The tool is called as `npx vite-node hee/src/showcase/cli.ts <command> --entry .`.

### WU-SHOWCASE-01 — facts, claim ledger, verification
- **Goal:** `claims.json` exists, holds the sourced claims of §5.3, verifies, and the surfaces that already exist produce no unsourced claim except those of the README that WU-05 replaces.
- **Steps:**
  1. Write `scripts/gen-showcase-facts.ts` (§5.2) and run it; add `"showcase:facts": "vite-node scripts/gen-showcase-facts.ts"` to `package.json`.
  2. Run `claims init`. It prints `claims init: wrote claims.json` (or `claims.json exists`) and lists candidates. Add claims `C-01` and `C-02` (§5.3 shapes) to `claims.json`; for every candidate the tool lists under `src/copy/` add a claim by the third rule of §5.3 (source: the copy file, `contains` the quoted phrase; ceiling `A limit the product applies, not a measured result.`).
  3. Run `claims verify` (`claims verify: <n> verified, 0 unverified`).
  4. Write `scripts/verify/sc-01-claims.ts`; it works on temporary copies for the tamper check and never edits the real ledger.
- **Files:** `scripts/gen-showcase-facts.ts`, `design_documents/showcase-facts.json`, `claims.json`, `package.json`, `scripts/verify/sc-01-claims.ts`.
- **Checks (10):**
  1. `npx vite-node scripts/gen-showcase-facts.ts` prints `facts: actions=20 e2eTests=60 ringScenarios=9 evalTasks=10` and the JSON has exactly the four numeric fields.
  2. Running it twice gives byte-identical files.
  3. `claims.json` exists and `lintClaims` reports no schema problem (the first problem line, if any, does not mention `schema`).
  4. `claims.json` has `C-01` and `C-02` with the sources and `match` strings of §5.3, and every claim has a `ceiling` of at least 20 characters.
  5. `claims verify` exits `0` and prints `claims verify: <n> verified, 0 unverified` with `n` at least 2.
  6. In a temporary copy of the entry's `claims.json` and facts file where `actions` is changed to `19`, `claims verify --entry <tmp>` exits `1` and prints `claims verify: <n-1> verified, 1 unverified`.
  7. `claims lint` output has no problem line that starts with `src/copy/` or `shots/` (copy figures are covered); problem lines that start with `README.md:` are allowed at this point and are the ones WU-05 clears.
  8. No claim has status `retracted`.
  9. `design_documents/showcase-facts.json` and `claims.json` contain no absolute path and no 20-hex string.
  10. `python3 ../../hackathons/_useful/scripts/check_banned_words.py claims.json design_documents/showcase-facts.json` exits `0`.
- **Verify:** `npx vite-node scripts/verify/sc-01-claims.ts`
- **Expected output:** `sc-01-claims: 10 checks OK`
- **Proves:** each figure the product's documents will quote has a source that a script can re-check, and a changed fact turns the claim red instead of staying quoted.

### WU-SHOWCASE-02 — the demo scenario and the browser test that reads it
- **Goal:** `design_documents/demo-scenario.json` is valid, presses exactly as many `Approve` buttons as the saved golden run asks for, and a browser test runs its steps with `runStep` so the stills show what the tests prove.
- **Steps:**
  1. Count `N`: in `e2e/artifacts/run-trace.json` the entries with `kind` `approval` and `decision` `approved` (run the depth test first if the file is missing).
  2. Write `design_documents/demo-scenario.json` from §3.2, repeating the `click Approve` / `wait_ms 3000` pair `N` times in the `approve` step (at least once).
  3. Write `playwright.showcase.config.ts` (`import base from "./playwright.config"; export default { ...base, testMatch: ["showcase/**/*.spec.ts"] }`) and `e2e/showcase/demo-scenario.spec.ts`: one test titled `SHOWCASE-1 the demo scenario runs`; it opens `app.url`, reads the scenario with `readDemoScenario`, runs each step with `runStep(page, step, app.url)`, and then asserts `[data-run-status]` becomes `done`, the incident circle exists and `guard.errors()` is empty. It lives outside `e2e/scenarios/` so the 60-test suite of DP-E2E-BROWSER-TESTING keeps its count.
  4. Write `scripts/verify/sc-02-scenario.ts`.
- **Files:** `design_documents/demo-scenario.json`, `playwright.showcase.config.ts`, `e2e/showcase/demo-scenario.spec.ts`, `scripts/verify/sc-02-scenario.ts`.
- **Checks (12):**
  1. `readDemoScenario("design_documents/demo-scenario.json")` returns without throwing (it validates against `hee/contracts/hee-demo-scenario.schema.json`).
  2. The step ids are exactly `open, week, review, approve, circle, walk, focus, dusk`, each with `settle_ms` at least `300`.
  3. The `approve` step contains exactly `N` actions of the form `{ "click": "Approve", "role": "button" }`, `N` computed by the script from `e2e/artifacts/run-trace.json`, and `N` is at least `1`.
  4. There are six stills with ids `week, agent, approval, circle, stage, dusk`; each `after_step` is a step id; each `claim` has `captionError(claim) === null`.
  5. `hero` is `{ "from_step": "review", "to_step": "approve" }`.
  6. Every action in the file uses one of the keys `route`, `click`, `type`, `press`, `wait_ms`, `play3d`, `expect_text`; every `play3d` value is `overview` or `walk`.
  7. Neither the scenario nor the spec contains the text `data-demo-focus`.
  8. `playwright.showcase.config.ts` has `testMatch` equal to `["showcase/**/*.spec.ts"]`, and `git diff --quiet -- playwright.config.ts` succeeds (the E2E config is untouched).
  9. `npx playwright test -c playwright.showcase.config.ts` exits `0` and its output contains `1 passed`.
  10. `npx vite-node scripts/e2e-run.ts --label full --list` still prints `full: 60 tests in 17 files`.
  11. The spec imports `readDemoScenario` and `runStep` from the showcase tool and does not re-implement a click or a wait (scan: no `waitForTimeout` and no `getByRole("button", { name: "Approve"` in the spec).
  12. `python3 ../../hackathons/_useful/scripts/check_banned_words.py design_documents/demo-scenario.json` exits `0`.
- **Verify:** `npx vite-node scripts/verify/sc-02-scenario.ts`
- **Expected output:** `sc-02-scenario: 12 checks OK`
- **Proves:** the pictures in the README come from steps that a test also executes, with no more and no fewer approvals than the recorded run needs.

### WU-SHOWCASE-03 — the `/watch` replay
- **Goal:** `/watch` plays the saved run through a second, isolated session, labelled as a replay, and the live session and its trace are never touched.
- **Steps:**
  1. Install the kit: `npx vite-node hee/scripts/install-kit.ts showcase-replay --to . --variant react` (writes `src/kits/showcase-replay/`; no file in it is edited).
  2. Save the run: copy `e2e/artifacts/run-trace.json` to `data/replay/run-trace.json` after `validateRunTraceFile` accepts it and `npx vite-node hee/scripts/hee-validate-run-trace.ts data/replay/run-trace.json --min-roles 4 --min-actions 15 --require-verify-repair --require-human-checkpoint` prints a line starting `trace ok:`. Write `scripts/sync-replay.ts` (§3.4) and run it.
  3. Write `src/ui/showcase/ReplayView.tsx` and replace the body of `src/ui/pages/Watch.tsx` (§3.3), keeping the default export `WatchPage` and the single `data-demo-focus="replay"` that DP-UI's shell already promises.
  4. Add to `package.json`: `"showcase:stills": "vite-node scripts/make-stills.ts"`, `"verify:showcase": "vite-node scripts/verify/sc-01-claims.ts && …"` (the seven scripts, extended unit by unit).
  5. Write `scripts/verify/sc-03-watch.ts` with `openApp({ path: "/watch?hook=1" })`; the replay at `4×` is started by selecting the option whose value is `4` in the kit's `[data-hee-replay="speed"]` and pressing `Watch the agent do it`.
- **Files:** `src/kits/showcase-replay/**` (installed), `data/replay/run-trace.json`, `public/replay/run-trace.json`, `scripts/sync-replay.ts`, `src/ui/showcase/ReplayView.tsx`, `src/ui/pages/Watch.tsx`, `package.json`, `scripts/verify/sc-03-watch.ts`.
- **Checks (12):**
  1. `src/kits/showcase-replay/kit.json` has `name` `showcase-replay` and `src/kits/showcase-replay/src/react/index.ts` exports `ReplayControl`.
  2. `validateRunTraceFile("data/replay/run-trace.json")` is ok and the chassis validator prints a line starting `trace ok:`; at least 15 action entries have `args`.
  3. `npx vite-node scripts/sync-replay.ts` prints `replay: synced <n> entries` and `public/replay/run-trace.json` is byte-identical to `data/replay/run-trace.json`.
  4. `Watch.tsx` default-exports `WatchPage`, imports `SessionProvider` and uses the prop `sessionIdOverride`; `ReplayView.tsx` imports `ReplayControl` from `src/kits/showcase-replay/src/react` and none of `fetch("/api/agent`, `createAppSession`, `registry.call` (the replay goes through the kit).
  5. `/watch` has exactly one `[data-demo-focus="replay"]` with a non-zero box, `/` exactly one `workbench`, `/lab` exactly one `lab`.
  6. Before any click `/watch` shows the text `REPLAY of a recorded run` and the button `Watch the agent do it` is enabled; the chip text `Replay · nothing here is live` is present.
  7. After choosing `4×` and pressing the button, `[data-hee-replay="state"]` reads `Replay finished. Nothing above was live.` within 90 s and no text containing `diverged` ever appears.
  8. After the replay, `window.__replay.session` has `checkNow()` errors equal to the saved trace's `summary.final_truth.errors` and its incident count equals the number of `open_incident` action entries with `ok: true` in the trace.
  9. The live session of the same page is untouched: `window.__doorstep.session.store.getState().ledger` is empty and `window.__runTrace.get().entries` is empty.
  10. The browser made no request whose path starts `/api/agent/` during the replay.
  11. At 390 × 844 no element extends beyond `clientWidth + 0.5`, and the page has zero console errors during the whole run.
  12. `data/replay/run-trace.json` has the same SHA-256 before and after the replay.
- **Verify:** `npx vite-node scripts/verify/sc-03-watch.ts`
- **Expected output:** `sc-03-watch: 12 checks OK`
- **Proves:** a visitor can watch a recorded agent run animate the real interface from a second session, and nothing in the live session, the live trace or the saved run changes.

### WU-SHOWCASE-04 — stills and the hero GIF
- **Goal:** six stills (each in two sizes), a hero GIF and `captions.json` exist in `shots/showcase/`, captured from the deployed URL.
- **Steps:**
  1. Write `scripts/make-stills.ts` (§5.6, §3.4).
  2. Read the base URL from `deploy-record.json`. Run `npx vite-node scripts/make-stills.ts --base-url <url>`. If the `approve` step reports `no element named "Approve"` (the deployed rung asked for a different number of approvals) or no deploy record exists, start a local server with `PORT=<free> AGENT_PROVIDER=golden BUILD_MARKER=local npm run server`, rerun against `http://127.0.0.1:<port>`, and add the known gap of §6 to `design_documents/showcase.json` (WU-05 step 1 writes that file; this unit records the choice in its notes).
  3. Write `scripts/verify/sc-04-stills.ts`.
- **Files:** `scripts/make-stills.ts`, `shots/showcase/*.png`, `shots/showcase/hero.gif`, `shots/showcase/captions.json`, `scripts/verify/sc-04-stills.ts`.
- **Checks (10):**
  1. The script prints `stills: base <url>` and the run printed `stills: webgl yes`.
  2. The tool's line is `stills: 6 stills, <f> hero frames, wrote shots/showcase/` with `f` at least `8`.
  3. `shots/showcase/` contains `gallery-<id>.png` and `readme-<id>.png` for each of the six ids, `hero.gif` and `captions.json`.
  4. Every gallery PNG is 1500 × 1000 and every readme PNG is 1000 × 667 (read with `sharp`).
  5. `hero.gif` is at most 6 000 000 bytes and `countGifFrames` returns at least 8.
  6. `captions.json` validates against `hee/contracts/hee-captions.schema.json`, has 13 entries (12 stills and the hero), and every caption has `captionError(caption) === null`.
  7. Every still has a luminance standard deviation of at least 8 (`sharp(file).stats()`), so none is blank.
  8. `gallery-stage.png` and `gallery-week.png` differ (different SHA-256) and the stage still's standard deviation is at least 8, which a stage that shows its unavailable message would not reach with the flat replica absent.
  9. `claims lint` has no problem line starting `shots/showcase/captions.json`.
  10. `python3 ../../hackathons/_useful/scripts/check_banned_words.py shots/showcase/captions.json` exits `0`.
- **Verify:** `npx vite-node scripts/verify/sc-04-stills.ts`
- **Expected output:** `sc-04-stills: 10 checks OK` (after the lines `stills: base <url>`, `stills: webgl yes` and the tool's `stills: 6 stills, <f> hero frames, wrote shots/showcase/`)
- **Proves:** the pictures are of the running product, taken by the same steps a test executes, with one plain sentence each, and the 3D one really shows the 3D.

### WU-SHOWCASE-05 — configuration, README, evaluation block
- **Goal:** `README.md` passes the tool's lint, every figure on it is in the ledger, its commands work, and the measured-proof block is the one the evaluation command wrote.
- **Steps:**
  1. Write `scripts/showcase-config.ts` and run it: it produces `design_documents/showcase.json` from §3.1 (stops with `BLOCKED (…)` per §3.1 when a source is missing).
  2. `npx vite-node hee/src/showcase/cli.ts readme scaffold --entry . --force` (prints `wrote README.md`); fill every placeholder by the content rules of §5.4; run `readme lint` until it prints `readme: OK`.
  3. When `evals/report.json` exists and the evaluation was comparable and measured, run `npx vite-node hee/src/agent-eval/cli.ts publish --entry .` (DP-E2E-BROWSER-TESTING WU-10 step 4 defers this run to here); otherwise write the sentence of §5.4 into the block.
  4. Run `claims init` to list new candidates and add claims by §5.3 until `claims lint` prints `claims: OK (<n> claims)`; run `claims verify`.
  5. Write `scripts/verify/sc-05-readme.ts`; it executes the commands of the README's `Develop, test, deploy` section named in check 8.
- **Files:** `scripts/showcase-config.ts`, `design_documents/showcase.json`, `README.md`, `claims.json`, `scripts/verify/sc-05-readme.ts`.
- **Checks (12):**
  1. `design_documents/showcase.json` has `technology_name` `Ring`, `license_name` `MIT`, exactly three `try_prompts` of 8–200 characters, 3–6 `sixty_second_path` steps, at least three `axes`, each with at least one existing relative evidence link.
  2. `live_url` equals the `url` of the deploy record (or is the local fallback named in the known gaps), `repo_url` starts `https://github.com/`, and `video_url` starts `https://`.
  3. `README.md` contains neither `{{` nor `TODO`.
  4. `readme lint` exits `0` and prints `readme: OK`.
  5. The line after the title is exactly `Know her day without calling. Doorstep Rhythm circles the one moment at her front door that did not fit the week.` and that sentence `Know her day without calling.` appears once in `README.md`.
  6. `claims lint` exits `0` and prints `claims: OK (<n> claims)` with `n` at least `2`; `claims verify` prints `<n> verified, 0 unverified`.
  7. Every relative link in `README.md` points to an existing file, and `GET <live_url>` answers `200` (or the local fallback is running and answers `200` during the check).
  8. `npm run build` exits `0`; with `PORT=<free>` set, `npm run server` answers `GET /health` with `ok: true` within 20 s and ends on `SIGTERM`.
  9. The `Develop, test, deploy` section contains the six fenced commands of §5.4, in that order, and every script name they use (`build`, `server`, `e2e`, `deploy:cloud-run`) exists in `package.json`.
  10. The block between `<!-- hee-eval:start -->` and `<!-- hee-eval:end -->` exists and, when `evals/report.json` has non-null `treatment` and `control`, contains `report.ceiling` verbatim; otherwise it contains the sentence `The action-surface evaluation has not been measured for this build.`
  11. `README.md` contains no absolute path, no `Bearer `, no 20-hex string.
  12. `python3 ../../hackathons/_useful/scripts/check_banned_words.py README.md design_documents/showcase.json` exits `0`.
- **Verify:** `npx vite-node scripts/verify/sc-05-readme.ts`
- **Expected output:** `sc-05-readme: 12 checks OK`
- **Proves:** a stranger can read the README, run what it says, see what the product did, and find a source for every figure; the evaluation result shown is the one that was measured.

### WU-SHOWCASE-06 — the judge kit
- **Goal:** `JUDGES.md` is rendered by the tool from `showcase.json`, lints clean offline and online, and tells a judge how to test the product without a Ring device.
- **Steps:**
  1. `npx vite-node hee/src/showcase/cli.ts judge-kit render --entry .`; never edit `JUDGES.md` by hand (the lint detects it).
  2. `judge-kit lint --entry .` then `judge-kit lint --entry . --online`; fix `showcase.json` (never the rendered file) until both print `judge-kit: OK`.
  3. Write `scripts/verify/sc-06-judges.ts`.
- **Files:** `JUDGES.md`, `design_documents/showcase.json` (only if a link needs fixing), `scripts/verify/sc-06-judges.ts`.
- **Checks (8):**
  1. `judge-kit render` exits `0` and `JUDGES.md` exists.
  2. `judge-kit lint` (offline) exits `0` and prints `judge-kit: OK`.
  3. `judge-kit lint --online` exits `0` and prints `judge-kit: OK`; when a link cannot be fetched the script prints the tool's problem line and the unit fails with it as the named error.
  4. `JUDGES.md` contains `live_url`, each of the three `try_prompts` verbatim and each `sixty_second_path` step.
  5. `JUDGES.md` contains the words `Playground token` and `sample week` (testing without a device).
  6. Appending one line to a temporary copy of `JUDGES.md` makes `judge-kit lint --entry <tmp>` exit `1` with a problem naming `hand-edited`.
  7. `claims lint` still prints `claims: OK (<n> claims)` (the judge kit is a surface).
  8. `python3 ../../hackathons/_useful/scripts/check_banned_words.py JUDGES.md` exits `0`.
- **Verify:** `npx vite-node scripts/verify/sc-06-judges.ts`
- **Expected output:** `sc-06-judges: 8 checks OK`
- **Proves:** a judge with no device and no token is given the shortest path to see the product work, every link on that page resolves, and the page cannot drift from its source.

### WU-SHOWCASE-07 — the operator's final checks
- **Goal:** `design_documents/operator-final-checks.md` lists, in order, the few steps only the operator can do, each with the command or place that proves it.
- **Steps:**
  1. Write the file as a checklist (`- [ ] …`), in this order, each item followed by an indented line `Proof:` with a command from this entry or a place to look:
     1. Create the public repository, push, confirm the `About` panel shows the licence; proof: `git remote get-url origin` prints an `https://github.com/` URL.
     2. Confirm `design_documents/showcase.json` `repo_url` and `live_url` are the real ones; proof: `npx vite-node scripts/showcase-config.ts` prints `showcase.json: live <url>`.
     3. After uploading the video, replace `video_url` in `showcase.json` with its address, then run `judge-kit render`, `readme lint` and `claims lint`; proof: the three tools print `judge-kit: OK`, `readme: OK`, `claims: OK (<n> claims)`.
     4. Run the deployed gate once more; proof: `BASE_URL=<live_url> npx playwright test e2e/smoke.spec.ts` shows `4 passed`.
     5. Run the whole browser suite once on the final commit; proof: `npm run e2e` prints `full: 59 passed, 0 failed, 1 skipped` (or `60 passed, 0 failed, 0 skipped` with a Bedrock route).
     6. Run the showcase gate online (DP-SUBMISSION runs it as its last step); proof: `npx vite-node hee/src/showcase/cli.ts gate --entry . --online` prints `showcase gate OK`.
     7. Open the live URL in a private window with no sign-in and press `Load the sample week` and `Review the week`; proof: the page shows the calendar and the review ends.
  2. Write `scripts/verify/sc-07-operator.ts`.
- **Files:** `design_documents/operator-final-checks.md`, `scripts/verify/sc-07-operator.ts`.
- **Checks (8):**
  1. The file exists and has seven checklist items in the order above, each followed by a `Proof:` line.
  2. Every command named in a `Proof:` line starts with `git `, `npx `, `npm run ` or `BASE_URL=`, and each `npm run <name>` exists in `package.json` and each `npx vite-node <path>` path exists.
  3. The `Develop, test, deploy` commands of `README.md` and the commands of this file do not contradict (the script checks that each `npm run <name>` appears in `package.json`).
  4. Item 3 names `video_url`, `judge-kit render`, `readme lint` and `claims lint`.
  5. Item 6 names `gate --entry . --online` and `showcase gate OK`.
  6. The file contains no absolute path, no `Bearer `, no 20-hex string.
  7. `python3 ../../hackathons/_useful/scripts/check_banned_words.py design_documents/operator-final-checks.md` exits `0`.
  8. `npm run verify:showcase` names the seven scripts `sc-01-claims.ts` … `sc-07-operator.ts` in order.
- **Verify:** `npx vite-node scripts/verify/sc-07-operator.ts`
- **Expected output:** `sc-07-operator: 8 checks OK`
- **Proves:** the few things no script can do for the operator are written down in order, each with a way to tell it is done.

## §8 Verification summary

| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/sc-01-claims.ts` | `sc-01-claims: 10 checks OK` |
| 02 | `npx vite-node scripts/verify/sc-02-scenario.ts` | `sc-02-scenario: 12 checks OK` |
| 03 | `npx vite-node scripts/verify/sc-03-watch.ts` | `sc-03-watch: 12 checks OK` |
| 04 | `npx vite-node scripts/verify/sc-04-stills.ts` | `sc-04-stills: 10 checks OK` |
| 05 | `npx vite-node scripts/verify/sc-05-readme.ts` | `sc-05-readme: 12 checks OK` |
| 06 | `npx vite-node scripts/verify/sc-06-judges.ts` | `sc-06-judges: 8 checks OK` |
| 07 | `npx vite-node scripts/verify/sc-07-operator.ts` | `sc-07-operator: 8 checks OK` |
| all | `npm run verify:showcase` | the seven results above, in order, exit 0 |

If a count differs because a check was split or merged while writing a script, change the number in the unit and in this table in the same edit.

## §9 Risks

- **The replay diverges from the live answers.** Mitigation: the saved trace comes from the golden run, which is deterministic; WU-03 check 7 fails loudly if it does not; re-record the trace and rerun `sync-replay`.
- **The nested `SessionProvider` of `/watch` changes the page's global hooks.** The effects of the outer provider run last, so `window.__doorstep` and `window.__runTrace` stay those of the live session; the replay session is exposed separately as `window.__replay` (WU-03 checks 8 and 9). A later change to the order of providers must keep that, and a client-side navigation from `/watch` to `/` leaves the live hooks in place.
- **The stills differ between the deployed rung and the recorded run.** Mitigation: the `Approve` count is computed from the golden trace; a mismatch is detected by the step error and handled by the local-golden fallback with a stated known gap.
- **The 3D still is blank on a machine with no GPU.** Mitigation: `scripts/make-stills.ts` passes the software-GL arguments and refuses to run without WebGL.
- **A number slips onto a surface without a claim.** Mitigation: `claims lint` is run in WU-01, 04, 05 and 06 and again by DP-SUBMISSION; numbers in prose are words unless a claim exists.
- **The interim `video_url` is mistaken for the final one.** Mitigation: it resolves, it is listed as item 3 of the operator's checklist, and DP-SUBMISSION's last unit checks that `video_url` no longer ends with `/watch`.
- **The README runs commands that rot.** Mitigation: WU-05 check 8 executes the build and the server start, and check 9 ties every script name to `package.json`.
- **The judge kit is edited by hand.** Mitigation: the tool's lint detects it; the check of WU-06 proves the detection works.
