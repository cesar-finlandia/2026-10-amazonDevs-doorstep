# DP-SUBMISSION — licence, disclosure, Devpost fields, product feedback, friction log, deck, Q&A sheet, golden capture, public-readiness

> Plan 10 of 12. The single owner of what goes into the Devpost form and the public repository besides the product, the README and the video: the `LICENSE`, the provenance record and `disclosure.md`, the ten Devpost fields, the product-feedback answer for every tool, the friction log, the feature requests, the statement of what was built in the window, the deck, the judge Q&A sheet, the golden capture of the demo, and the hygiene checks that decide whether the repository may be made public.
> Chassis paths are written `../../hackathons/…`. Imports use the `src/…` alias; scripts run under `vite-node`. The chassis tools (`provo`, `submit`, `deckgen`) are run from `../../hackathons/src/…` and are never edited; `faqdef` and `demodrive` are run from the vendored copies under `src/ideation/`, never edited either.

## §0 Context & blockers

**Must already exist before WU-01 runs** (plans 1–9). Proof, each prints its own line:

```bash
npx vite-node scripts/verify/e2e-12-results.ts
npx vite-node scripts/verify/sc-05-readme.ts
npx vite-node scripts/verify/sc-06-judges.ts
```
Expected: `e2e-12-results: 10 checks OK`, `sc-05-readme: 12 checks OK`, `sc-06-judges: 8 checks OK`. If one differs, stop: the owning plan is not finished. This plan writes text that quotes the README, the judge kit and the ledger, so it never starts from a red showcase.

**Preflight (each line must print a path or a version):**
```bash
ls -d design_documents/showcase.json design_documents/demo-scenario.json design_documents/winning_project_plan.md design_documents/friction-log.md design_documents/hackathon_brief.md claims.json README.md JUDGES.md assembly.manifest.json architecture.json config/model-profiles.json data/golden-cache src/ideation/faqdef/cli.ts src/ideation/demodrive/cli.ts hee/src/showcase/cli.ts scripts/probe-ring.ts scripts/probe-bedrock.ts scripts/probe-strands.ts
ls -d ../../hackathons/src/provenance/provo/cli.ts ../../hackathons/src/provenance/submit/cli.ts ../../hackathons/src/ideation/deckgen/cli.ts ../../hackathons/templates/pitch-deck/01-title.md ../../hackathons/_useful/scripts/check_banned_words.py
node --version
python3 --version
git --version
```
`git rev-parse --is-inside-work-tree` must print `true` (the hygiene tool needs a repository). The chassis tools are loaded by the entry's `vite-node`; WU-01 step 1 proves that once and records the result.

**Live calls here.** Exactly one unit calls a model directly: WU-07 (the Q&A sheet and its rehearsal) calls Gemini on Vertex AI through the entry's own Vertex client, because the vendored `faqdef` default call needs a key for a different provider. WU-06 runs the deck tool with `--no-llm`; WU-08 drives a local server on the recorded run and calls no model. The AI ACCESS rule is reproduced below because WU-07 happens under this plan's commands.

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
**How this plan uses the rule above.** WU-07 sets the three Vertex environment variables, discovers the model through the entry's `discoverModels()` and records the model name and region in `design_documents/submission/qa/qa-run.json`. If the call fails after §2 has been run, the unit prints `BLOCKED (<the named error>)` and exits `3`; it still writes the fallback checklist the tool produces, and says in the sheet's header that the questions are generic. No other unit needs a model.

**What the operator must do that no plan can** (listed again in `design_documents/operator-final-checks.md`, DP-SHOWCASE WU-07): create the public GitHub repository and push, upload the video, set `repo_url` and `video_url` in `design_documents/showcase.json`, add Devpost team members. WU-09 stops with a named `BLOCKED (…)` line when one of these is missing; it never invents an address.

## §1 Purpose & requirement IDs

| ID | This plan's share |
|---|---|
| FR-25 (part) | `LICENSE`, `disclosure.md`, the ten Devpost fields, `feedback.md`, the friction log, feature requests, the delta statement, deck, Q&A sheet, golden capture |
| NFR-02 | No secret in the repository: the hygiene tool, a second scan of this plan's own, and the `.gitignore` block |
| NFR-08 | No banned vocabulary on any judge-visible text this plan writes (field texts, feedback, deck, Q&A sheet) |
| NFR-09 | The repository is ready to be public: licence detectable, run instructions present, no generated clutter, no absolute path, no secret |
| NFR-10 | The repository holds the application and nothing else; the allowed top-level set is a checked file (`config/entry-layout.json`) |
| Brief item 1 | Project text description (`design_documents/submission_description.md`) |
| Brief item 2 | Repository field: public URL, MIT licence file detectable by GitHub, run instructions |
| Brief item 3 | The video field carries the final address, not the interim `/watch` page |
| Brief item 4 | Product feedback for every tool, API and SDK used; AWS services described |
| Brief items 5–6 | Primary track Ring; mini-challenge AWS Builder with the services and how they are used |
| Brief item 7 | The statement of what was built in the submission window |
| Brief items 8–9 | Feature requests; friction-log entries (up to ten percent of the judging bonus) |
| Brief item 10 | Testing access: the free live URL, no sign-in, the bundled sample week |

## §2 Scope boundaries

**IN — files this plan creates or modifies:**

| Path | Purpose |
|---|---|
| `LICENSE` | MIT, written by WU-01 (§5.1 literal) |
| `.gitignore` | an additive block that lets the judge-facing files of `design_documents/` be committed (§5.8); no existing line is removed |
| `design_documents/submission/ai_tools.json`, `design_documents/submission/provenance.json` | the AI-assistance log and the provenance record (§3.2, §3.3) |
| `design_documents/submission/provo/` | the chassis disclosure generator's outputs (`disclosure.md`, `architecture-summary.md`, `architecture_summary.txt`) |
| `disclosure.md` | the byte-identical copy of the generated disclosure, at the repository root |
| `design_documents/submission_description.md`, `design_documents/submission/devpost-fields.json`, `design_documents/submission/extracted-copy.md` | Devpost field 1 and the field map (§3.7) |
| `design_documents/submission/feedback.md` | field 4 and the AWS Builder answer (§5.3) |
| `design_documents/submission/friction-log-devpost.md` | field 9, compiled (§5.4) |
| `design_documents/submission/feature-requests.md`, `design_documents/submission/delta.md` | fields 8 and 7 |
| `design_documents/submission/deck/` | the populated deck |
| `design_documents/submission/qa/` | the Q&A sheet, the rehearsal record, `qa-run.json` |
| `design_documents/submission/capture/` | the golden capture (video, screenshots, manifest) |
| `design_documents/submission/hygiene-report.json`, `design_documents/submission/hygiene-report.md`, `design_documents/submission/public-readiness.md` | WU-09 outputs |
| `config/entry-layout.json` | the allowed top-level paths (§3.4) |
| `scripts/lib/submission.ts`, `scripts/chassis-tool.ts`, `scripts/gen-provenance.ts`, `scripts/build-devpost-fields.ts`, `scripts/check-feedback.ts`, `scripts/compile-friction.ts`, `scripts/build-delta.ts`, `scripts/polish-copy.ts`, `scripts/make-qa.ts`, `scripts/rehearse-qa.ts`, `scripts/finish-deck.ts`, `scripts/make-capture-script.ts`, `scripts/check-entry-layout.ts`, `scripts/public-readiness.ts` | the scripts of §3.6 |
| `scripts/verify/sb-01-licence.ts` … `scripts/verify/sb-09-hygiene.ts` | one verification script per unit |
| `package.json` | scripts `verify:submission`, `submission:chassis` (additive) |

**OUT — owned elsewhere:**

| What | Owner |
|---|---|
| The README, `JUDGES.md`, `claims.json`, `showcase.json`, the stills, `/watch`, `operator-final-checks.md` | DP-SHOWCASE (this plan reads them and re-runs `claims lint` on the description it writes) |
| `Dockerfile`, the deploy record, the deployed-URL smoke | DP-DEPLOY |
| `design_documents/friction-log.md` entries about Ring (appended by the Ring plan's units) | DP-RING-INTEGRATION (this plan only reads and compiles them) |
| The video script, narration segments, the three pitch assets | DP-SCRIPT |
| The live Ring run, the live architecture proofs, the narrated video, the live-check block of `feedback.md` | DP-LIVE-RUN-AND-VIDEO |
| Colours, fonts, interface copy | DP-UI (the deck and the description use the product's words, never new copy for the interface) |
| `architecture.json` | DP-API-TRANSPORT (proofs by DP-E2E-BROWSER-TESTING WU-11 and DP-LIVE-RUN-AND-VIDEO) |

**Not done by any plan:** pressing Devpost's Submit button, creating the GitHub repository, uploading the video, adding team members.

## §3 Interfaces owned (literal skeletons)

### §3.1 The submission folder

```
design_documents/submission/
  ai_tools.json            provo input (§3.2)
  provenance.json          the provenance record (§3.3)
  provo/                   disclosure.md · architecture-summary.md · architecture_summary.txt   (written by the chassis tool)
  extracted-copy.md        what `submit format` extracted mechanically (never published as is)
  devpost-fields.json      the ten fields (§3.7)
  feedback.md              field 4 (+ the AWS Builder answer)
  friction-log-devpost.md  field 9
  feature-requests.md      field 8
  delta.md                 field 7
  deck/                    deck.md · slide files · diagram.mmd
  qa/                      qa-sheet.json · qa-sheet.md · rehearsal.md · qa-run.json
  capture/                 video.webm · <step-id>/screenshot.png · capture-script.json · capture-run.json
  hygiene-report.json · hygiene-report.md · public-readiness.md
```

### §3.2 `design_documents/submission/ai_tools.json` (literal; the chassis tool's input is an array of `{ tool, scope }`)

```json
[
  { "tool": "Claude Code", "scope": "wrote the design plans and implemented the engine, the interface, the tests and the deployment scripts from them" },
  { "tool": "Ring Appstore MCP", "scope": "looked up Ring API shapes and the Developer Playground token flow while the Ring port was written" },
  { "tool": "Gemini on Vertex AI", "scope": "generated the three text-free pitch pictures, the Q&A sheet draft and its rehearsal feedback, and served as the labelled fallback model of the product" },
  { "tool": "Amazon Bedrock", "scope": "is the product's runtime model route (the agent's extractor, planner, actor and narrator calls)" }
]
```
The file is exactly this array until a unit proves a different tool was used (a tool is added only with the date and the unit that used it in `provenance.json`). The tool name strings are the ones printed in `disclosure.md`.

### §3.3 `design_documents/submission/provenance.json` (written by `scripts/gen-provenance.ts`; literal shape)

```ts
export interface ProvenanceRecord {
  version: "1.0.0";
  entry: "2026-10-amazonDevs";
  generatedAt: string;                                  // ISO timestamp
  chassis: { version: string; includedComponents: string[]; excludedComponents: string[] };   // from assembly.manifest.json
  windowStartsOn: "2026-08-31";                         // the brief's submission window
  authoredInWindow: string[];                           // top-level paths under src/, scripts/, e2e/ that exist and are not chassis components
  aiTools: { tool: string; scope: string }[];           // the content of ai_tools.json
  dependencies: { name: string; version: string }[];    // the pinned runtime dependencies named in §4 that package.json holds
  models: { role: string; id: string; region: string; source: "bedrock" | "vertex" }[];  // the `doorstep-meta` entry of data/golden-cache (role "recorded-run"), plus the Q&A model of WU-07 (role "qa-draft") once qa-run.json exists
}
```
`authoredInWindow` is computed, never typed: it lists `src/agent`, `src/domain`, `src/ring`, `src/server`, `src/ui`, `src/llm`, `src/prompts`, `scripts`, `e2e` and every other directory that `git ls-files` shows and that is not a chassis component directory named in the manifest as included (`src/context`, `src/cost`, `src/ideation`, `src/pgm`, `src/platform`, `src/profile`, `src/provenance`, `src/resilience`).

### §3.4 `config/entry-layout.json` (literal; the allowed top level of the public repository, NFR-10)

```json
{
  "version": "1.0.0",
  "allowedFiles": [
    ".dockerignore", ".gitignore", ".nvmrc", ".python-version", "Dockerfile", "JUDGES.md", "LICENSE", "README.md",
    "actions.manifest.json", "architecture.json", "assembly.manifest.json", "cinematic-tokens.json", "claims.json",
    "disclosure.md", "index.html", "models.json", "package-lock.json", "package.json", "playwright.config.ts",
    "playwright.showcase.config.ts", "pyproject.toml", "run_sweep.sh", "tsconfig.json", "vite.config.ts"
  ],
  "allowedDirs": [
    "brand", "config", "contracts", "data", "design_documents", "docs", "e2e", "engine", "evals", "hee", "logs",
    "public", "scripts", "shots", "src"
  ],
  "ignoredButPresent": ["node_modules", "dist", "test-results", "playwright-report", ".git"]
}
```
`public/` holds the favicon and the replay trace; `logs/` holds only `proof.log` (the rest is ignored). A path the check finds that is in neither list is a failure that names it; the fix is to remove it or, when it is a product file, to add it here **and** to the blueprint's file table in the same edit.

### §3.5 `scripts/lib/submission.ts` (literal exports; every script of this plan imports these)

```ts
export interface Showcase { title: string; technology_name: string; license_name: string; live_url: string; video_url: string; repo_url: string; known_gaps: string[] }
export function readShowcase(): Showcase;                          // parses design_documents/showcase.json; throws `showcase.json: <reason>` on a missing key
export const SLOGAN = "Know her day without calling.";
export const SUBMISSION_DIR = "design_documents/submission";
export function chassisToolPath(tool: "provo" | "submit" | "deckgen"): string;   // "../../hackathons/src/provenance/provo/cli.ts" | ".../submit/cli.ts" | "../../hackathons/src/ideation/deckgen/cli.ts"
export function runChassisTool(tool: "provo" | "submit" | "deckgen", args: string[]): { status: number; stdout: string; stderr: string };   // spawnSync("npx", ["vite-node", path, ...args], { cwd: ".", encoding: "utf8" }); never throws
export interface BannedHit { file: string; line: number; word: string }
export function scanBanned(files: string[]): BannedHit[];          // runs `python3 ../../hackathons/_useful/scripts/check_banned_words.py <files>` and parses its `file:line` hits; [] when the checker exits 0
export const BANNED_REWRITES: ReadonlyArray<readonly [RegExp, string]>;   // §5.5
export function polish(text: string): { text: string; replaced: { from: string; to: string }[] };
export function blocked(reason: string): never;                    // prints `BLOCKED (<reason>)` and exits 3
export function check(n: number, ok: boolean, label: string, failures: string[]): void;   // the same shape as the other plans' verification scripts
export function done(name: string, total: number, failures: string[]): never;             // prints `<name>: <total> checks OK` and exits 0, or the failing labels and exits 1
```
`scanBanned` and `polish` are the one place in this plan that names the banned words; no other file of this plan repeats them.

### §3.6 Scripts (what each prints)

```
npx vite-node scripts/chassis-tool.ts <provo|submit|deckgen> -- <args>   # runs the chassis tool through runChassisTool; echoes its output; exits with its status; prints `BLOCKED (chassis tool not found: <path>)` and exits 3 when the file is missing
npx vite-node scripts/gen-provenance.ts            # writes provenance.json; prints `provenance: <n> authored paths, <m> chassis components`
npx vite-node scripts/build-devpost-fields.ts      # writes devpost-fields.json; prints `fields: 10 of 10 present`
npx vite-node scripts/check-feedback.ts [--final]  # prints `feedback: <n> tools, <m> evidence links` ; with --final also fails while the live-check block says `Pending:`
npx vite-node scripts/compile-friction.ts          # writes friction-log-devpost.md; prints `friction: <n> platform entries, <m> internal entries kept out`
npx vite-node scripts/build-delta.ts               # writes delta.md; prints `delta: reused <n> chassis components, authored <m> paths`
npx vite-node scripts/polish-copy.ts <file…>       # applies §5.5 in place; prints `polish: <n> replacements in <k> files`
npx vite-node scripts/finish-deck.ts                # WU-06: fills slot 07, adds the slogan, polishes the deck; prints `deck: <n> slots filled, <m> replacements`
npx vite-node scripts/make-qa.ts                   # WU-07: generates the sheet through Vertex; prints `qa: <n> questions via <model>` or `BLOCKED (…)`
npx vite-node scripts/rehearse-qa.ts [--count 5]   # WU-07: scripted rehearsal; prints `rehearsal: <n> answered, <m> scored`
npx vite-node scripts/make-capture-script.ts       # WU-08: demo-scenario.json → capture-script.json; prints `capture script: <n> steps`
npx vite-node scripts/check-entry-layout.ts        # prints `layout: OK` or `layout: <path> is not allowed`
npx vite-node scripts/public-readiness.ts [--online]   # WU-09: writes public-readiness.md; prints `public-readiness: <n> checks passed, <m> blocked, <k> failed`
```

### §3.7 `design_documents/submission/devpost-fields.json` (literal shape)

```json
{
  "version": "1.0.0",
  "fields": {
    "1_description": { "file": "design_documents/submission_description.md" },
    "2_repository": { "url": "<showcase.repo_url>", "licence": "MIT", "licence_file": "LICENSE", "run_instructions": "README.md" },
    "3_video": { "url": "<showcase.video_url>" },
    "4_feedback": { "file": "design_documents/submission/feedback.md" },
    "5_primary_track": "Ring",
    "6_mini_challenges": [
      { "name": "AWS Builder", "services": ["Amazon Bedrock"], "also_used": ["Strands Agents SDK"], "how": "design_documents/submission/feedback.md#aws-builder" }
    ],
    "7_delta": { "file": "design_documents/submission/delta.md" },
    "8_feature_requests": { "file": "design_documents/submission/feature-requests.md" },
    "9_friction_log": { "file": "design_documents/submission/friction-log-devpost.md" },
    "10_testing_access": { "url": "<showcase.live_url>", "judge_kit": "JUDGES.md", "text": "<§5.2 literal 10>" }
  }
}
```
The three angle-bracket values are filled by the script from `design_documents/showcase.json` and §5.2; a field whose source is missing is written as `{ "missing": "<reason>" }` and the script prints `fields: <n> of 10 present` with `n` below 10. The Open Source mini-challenge is not entered.

### §3.8 `design_documents/submission/capture/capture-script.json` (generated; the vendored `demodrive` script schema)

```ts
// scripts/make-capture-script.ts maps design_documents/demo-scenario.json to ../../hackathons/contracts/demodrive-script.schema.json
// scenario action            → demodrive action
// { route: "/x" }            → { action: "navigate", value: "<base_url>/x" }
// { click: "T", role: "r" }  → { action: "click", selector: "getByRole('<r>', {name: 'T'})" }
// { expect_text: "T" }       → { action: "wait_for", selector: "text=T" }
// { wait_ms: n }             → { action: "wait_ms", value: "<n>" }
// { play3d: "walk" }         → { action: "wait_ms", value: "1500" }   (the 3D hook is page-internal; the capture waits instead and the still shows the result)
// { type: …} / { press: …}   → { action: "fill", … } / dropped with a note in capture-run.json when no equivalent exists
export function toCaptureScript(scenario: unknown, baseUrl: string): object;   // { version: "1.0.0", base_url, viewport: {width:1280,height:720,device_scale_factor:1}, layout: "single-focus", data_source: { kind: "cache", cache_key: "doorstep-meta", mock_script: null }, steps: [...] }
```
Step ids are the scenario's step ids, which already match the schema's kebab-case pattern.

## §4 Interfaces consumed (copy verbatim)

```ts
import { readShowcase, runChassisTool, polish, scanBanned, check, done, blocked, SLOGAN } from "./lib/submission";                   // this plan §3.5 (scripts/lib/submission.ts; scripts import it by relative path)
import { generateFaqdefSheet } from "src/ideation/faqdef/generate";            // generateFaqdefSheet({ planPath, manifestPath, disclosurePath, outDir, callLlm })
import { runRehearsal, createNodeRehearsalIo } from "src/ideation/faqdef/rehearse";   // runRehearsal({ qaPath, count, budgetS, callLlm, io, logPath })
import { createVertexFallback } from "src/llm/vertex-fallback";                // DP-AGENT-WORKFLOW: .generate(req) → { ok: true, text, model, location } | { ok: false, reason, detail }
import { discoverModels } from "src/llm/model-discovery";                      // DP-AGENT-WORKFLOW: { fast, balanced, source, region }
import { withResilience } from "src/resilience/index";                         // chassis, vendored: the one wrapper for an outbound model call
import { readDemoScenario } from "../hee/src/showcase/scenario";               // DP-SHOWCASE §4
import { createGoldenCache } from "src/resilience/cache/index";                // chassis RES-05 cache: createGoldenCache("data/golden-cache")
```
Command-line tools used as installed:

```
npx vite-node ../../hackathons/src/provenance/provo/cli.ts generate --manifest assembly.manifest.json --ai-log <ai_tools.json> --out <path>
npx vite-node ../../hackathons/src/provenance/submit/cli.ts format --plan design_documents/winning_project_plan.md --manifest assembly.manifest.json --disclosure <path> --out <path>
npx vite-node ../../hackathons/src/provenance/submit/cli.ts hygiene --manifest assembly.manifest.json --out <path-without-extension>
npx vite-node ../../hackathons/src/ideation/deckgen/cli.ts populate --plan <p> --manifest <m> --disclosure <d> --out <dir> --no-llm --validate
npx vite-node src/ideation/demodrive/cli.ts capture --script <file> --data-source cache --cache-key <key> --out <dir>
npx vite-node hee/src/showcase/cli.ts claims lint --entry .          # and: gate --entry . [--online]
python3 ../../hackathons/_useful/scripts/check_banned_words.py <files…>
```

## §5 Algorithms and literal content

### §5.1 `LICENSE` (literal; MIT)

```
MIT License

Copyright (c) 2026 the Doorstep Rhythm authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
GitHub detects MIT from this exact text (the copyright line is the only part that varies). The operator may replace the holder name in the copyright line with a personal name; nothing else changes. `design_documents/showcase.json` already says `license_name` `MIT`.

### §5.2 Literal field texts

**1 — `design_documents/submission_description.md`** (a claims surface: it holds no digit, no comparison and none of the superlative words of DP-SHOWCASE §5.3):

```markdown
# Doorstep Rhythm

Know her day without calling.

Doorstep Rhythm is a web app for the daughter who lives far from her mum. It reads the week at the front door of a sample household through the Ring APIs, learns what an ordinary day looks like there, and circles the one moment that did not fit.

## What it does

- Reads a week of doorstep events from Ring: motion, button presses and device status. Signed webhooks bring new events in, and Event History fills the gaps when a webhook goes missing.
- Draws the week as a paper calendar with every visit marked, next to a plain timeline for large type and screen readers.
- Starts a review on Amazon Bedrock through the Strands Agents SDK. The agent works through a fixed list of actions, and every step it takes is listed on screen as it happens.
- Checks the agent's work with a truth engine written in code, and sends the agent back to repair whatever the engine rejects.
- Stops at a checkpoint. Marta, the caretaker, presses Approve or Reject before any message leaves the app.
- Stands the same week up in three dimensions, so the circled moment can be seen from the door.

## How it uses Ring

Every Ring call goes through one port with two faces: a live one that calls the Ring APIs, and a recorded sample week. The live face covers device discovery, status, capabilities, Event History, signed webhooks, image snapshots, short clips and live sessions over WHEP. The page says plainly which face it is showing.

## Try it

The live page needs no sign-in. Press Load the sample week, then Review the week. To read a real account, paste a Ring Developer Playground token on the same page.

## Reused code and AI help

The reused scaffolding and every AI tool that helped are listed in `disclosure.md` in the repository.
```

**5 — track:** `Ring`. **6 — mini-challenge text** (also the first lines of the `## AWS Builder` section of `feedback.md`): `Amazon Bedrock runs the agent's four model roles through the Converse API with a Bedrock API key; the Strands Agents SDK drives the tool loop. Both are called at runtime from src/llm and src/agent, and the architecture file records the call.`

**7 — delta:** written by `scripts/build-delta.ts` from the template in §5.6; **10 — testing access text:**

```
The product is free to use and needs no account. Open the live address, press Load the sample week, then Review the week. The sample week is bundled with the app, so a Ring device is not needed. To read a real Ring account, paste a short-lived token from the Ring Developer Playground into the box on the page. The page stays up through the judging period. JUDGES.md in the repository repeats these steps.
```

### §5.3 `feedback.md` (field 4): structure, rules, evidence

Literal skeleton (the implementor fills each `<…>` from the evidence column, never from memory):

```markdown
# Product feedback

<!-- live-check:start -->
Pending: the observations from a run against a live Ring account are written here by the live run before submission.
<!-- live-check:end -->

## Ring REST API and OAuth
### Used for
### What worked
### What needs work
### Zero to hello-world
### Would I build with it again
(the same five headings repeat for every tool below)

## Ring webhooks
## Ring live sessions (WHEP)
## Ring Developer Playground token
## Ring Appstore MCP
## Amazon Bedrock
## Strands Agents SDK
## Amazon Bedrock AgentCore
## AWS Builder
## Other tools
```

| Section | Used for (source of the sentence) | What worked / what needs work (evidence) | Zero to hello-world (source) |
|---|---|---|---|
| Ring REST API and OAuth | `src/ring/live-ring-port.ts`, `src/ring/wire.ts` | the verification lines of the Ring plan (`ri-0N`), `design_documents/friction-log.md` entries `FL-n` whose `Where` names the REST surface | the steps of `scripts/probe-ring.ts` |
| Ring webhooks | `src/ring/webhook.ts` | scenarios `S-RING-1…9` in `design_documents/e2e-testing/results.md`; friction entries about the payload | the first signed request of `scripts/mock-ring-server.ts` |
| Ring live sessions (WHEP) | the `whepSessionId` path of the API plan | the 3D/stream scenarios; friction entries | the call sequence of `src/ring/live-ring-port.ts` |
| Ring Developer Playground token | the token box of the UI | `JUDGES.md` instructions; friction entries | paste-and-read steps of `JUDGES.md` |
| Ring Appstore MCP | `design_documents/submission/ai_tools.json` entry | what the lookups returned during the Ring plan (friction or fix-log entries) | install and first query |
| Amazon Bedrock | `src/llm/bedrock-client.ts` | `scripts/probe-bedrock.ts`, `design_documents/e2e-testing/results.md` scenario `S-BEDROCK-1` | the steps of `scripts/probe-bedrock.ts` |
| Strands Agents SDK | `src/llm/strands-adapter.ts` | `scripts/probe-strands.ts` | the steps of `scripts/probe-strands.ts` |
| Amazon Bedrock AgentCore | not used; the section says so in one sentence and gives the reason (the app keeps its sessions in one process and the review is one bounded run) | none | none |
| AWS Builder | the six-line answer of §5.2 field 6 plus the AWS services table: service, call, file | `architecture.json` proof ids for `api-bedrock` | none |
| Other tools | one table row each: Gemini on Vertex AI (fallback model), Google Cloud Run (hosting), Playwright (tests), three and React Three Fiber (3D), Express (server) | one clause each | none |

**Rules `scripts/check-feedback.ts` enforces:**

1. Each of the first eight tool sections has exactly the five headings above, in that order, each with at least one sentence.
2. The `Would I build with it again` text starts with `Yes` or `No` followed by a comma or a colon and a reason of at least six words.
3. Every bullet under `What needs work` ends with `(evidence: <ref>)` where `<ref>` is an `FL-n` that exists in `design_documents/friction-log.md`, or a relative file path that exists. The script counts these links.
4. `Zero to hello-world` lists at most six numbered steps and names a probe script or a document that exists; it holds no duration that is not read from a file.
5. No text in the file holds a banned word (§5.5) or the strings `TODO` or `{{`.
6. `--final` additionally fails while the block between `<!-- live-check:start -->` and `<!-- live-check:end -->` begins with `Pending:`.

### §5.4 The friction log for Devpost (field 9)

`design_documents/friction-log.md` (the repository's own log, entries `## FL-<n> <title>` with the lines `Date`, `Severity`, `Where`, `What happened`, `Workaround`) mixes two kinds of entry. **Platform entries** are about the Ring or AWS surface (a wire value, a payload shape, a token flow); **internal entries** are about a mismatch between this repository's own documents or contracts. Devpost's field is for platform friction, so `scripts/compile-friction.ts` classifies an entry as platform when its `Where` line names one of `Ring`, `webhook`, `history`, `GET /v1`, `WHEP`, `Playground`, `OAuth`, `Bedrock`, `Strands`, `AgentCore`, and as internal otherwise. Platform entries are written to `friction-log-devpost.md` in the six-part shape the brief asks for:

```markdown
## FL-<n> <title>
- **Task:** <the `Where` line>
- **Steps:** <the sentences of `What happened` up to the first one that states a result>
- **Expected vs actual:** <expected (the sentence that begins "§" or "says" or "expects") — actual (the remaining sentences)>
- **Severity:** <Severity line: low | medium | high>
- **Workaround:** <Workaround line>
- **Suggestion:** <the line `Suggestion:` of the entry when present; otherwise the text `none stated`>
```
An entry that lacks `What happened` or `Workaround` stops the script with `friction: FL-<n> is missing <line>`. The suggestions are added by editing the entry in `design_documents/friction-log.md` (one `Suggestion:` line each, written from what the entry itself found, with the same sentence-level evidence), then rerunning the script. Internal entries stay in the repository log and are counted in the output line.

### §5.5 The banned-word rewrite (judge-visible text this plan generates from sources it does not own)

The chassis tools copy sentences of `design_documents/winning_project_plan.md` and generate Q&A text; those sentences can hold words the project bans from judge-visible copy. `polish` applies this table, in order, and records each replacement; the changed file is then re-scanned by `scanBanned`, which must return no hit.

| Pattern (word boundary, case preserved) | Replacement |
|---|---|
| the verb forms of the first banned stem: base, `…s`, `…d`, `…ing` | `sort`, `sorts`, `sorted`, `sorting` |
| the adverb form of the second banned stem | `plainly` |
| any other form of the second banned stem | no replacement: the script prints `polish: <file>:<line> needs a human rewrite` and exits `1` |

The table lives in `BANNED_REWRITES` (the only place that spells the words). `polish-copy.ts` prints each `from → to` pair, and a human rewrite is made in the file itself; a human reads those pairs once (WU-06 and WU-07 say when) because a mechanical rewrite can produce an awkward sentence. Files this plan writes by hand never need it.

### §5.6 `delta.md` (literal template; the script fills the bracketed lists)

```markdown
# What was built in the submission window

The submission window opened on 2026-08-31. Doorstep Rhythm was started inside it, as a new project on a reusable hackathon scaffold. Nothing in this repository was submitted to another event.

## Reused scaffolding

<one bullet per included chassis component of assembly.manifest.json: "<id> — <one-line role from the generated disclosure.md>">

The full list, the scaffold version and the AI tools that helped are in `disclosure.md`.

## Built in the window

<one bullet per path of provenance.json authoredInWindow, each with the sentence that the owning plan's §1 gives for it>
```
The bracketed lists are computed from `provenance.json` and the generated `disclosure.md`; the script refuses to write a bullet whose component or path does not exist.

### §5.7 The Vertex call for the Q&A sheet (`scripts/make-qa.ts`, `scripts/rehearse-qa.ts`)

```ts
// scripts/lib/submission-llm.ts — the one model call of this plan
export async function callVertexJson(prompt: string): Promise<string>;
// 1. process.env GOOGLE_GENAI_USE_VERTEXAI="true", GOOGLE_CLOUD_PROJECT (default value from AI ACCESS §2), GOOGLE_CLOUD_LOCATION (default "us-central1")
// 2. const fb = createVertexFallback(); const res = await withResilience(() => fb.generate({ contents:[{ role:"user", parts:[{ text: prompt }] }], temperature: 0.2, maxOutputTokens: 8192 }), { timeout_ms: 60000, retries: 1, backoff: { policy: "exponential", base_ms: 500 }, fallback_chain: { order: ["none"] } })
// 3. res.ok === false → throw new Error(`${res.reason}: ${res.detail}`)  (the vendored faqdef wrapper turns the throw into its fallback checklist)
// 4. return res.text
```
`make-qa.ts` first runs the commands of AI ACCESS §2 (token, project, `aiplatform.googleapis.com` enabled, `discoverModels()`), writes the model name and region to `qa-run.json`, and only then calls `generateFaqdefSheet({ planPath: "design_documents/winning_project_plan.md", manifestPath: "assembly.manifest.json", disclosurePath: "design_documents/submission/provo/disclosure.md", outDir: "design_documents/submission/qa", callLlm: callVertexJson })`.

### §5.8 `.gitignore` block (additive; judge-facing documents become committable)

The chassis `.gitignore` ignores `/design_documents/*` except the screenshots folder. A judge who clones the repository would find the README's evidence links, the claim sources, the feedback and the field map missing. WU-01 appends this block **after** the existing lines (no existing line is removed or reordered):

```
# DP-SUBMISSION: judge-facing documents are part of the public repository
!/design_documents/showcase.json
!/design_documents/showcase-facts.json
!/design_documents/demo-scenario.json
!/design_documents/operator-final-checks.md
!/design_documents/submission_description.md
!/design_documents/friction-log.md
!/design_documents/winning_project_plan.md
!/design_documents/hackathon_brief.md
!/design_documents/master_blueprint_entry.md
!/design_documents/visual_identity_plan.md
!/design_documents/design_plans/
!/design_documents/e2e-testing/
!/design_documents/submission/
```
`design_documents/submission/capture/` may hold a recording; WU-08 decides by size whether the video stays (§6). The `/deck/` and `/templates/` lines of the chassis block stay as they are because this plan writes the deck under `design_documents/submission/deck/`.

## §6 Failure modes

| Failure | What the plan does |
|---|---|
| The chassis tools cannot be loaded by the entry's `vite-node` (a missing module on the chassis side) | `scripts/chassis-tool.ts` prints `BLOCKED (chassis tool not found: <path>)` or the tool's own error and exits `3`; WU-01 records it in `public-readiness.md`; no unit writes a substitute for the tool's output |
| `provo generate` exits `1` (manifest or catalog problem) | the unit stops; the manifest is the chassis's own and is not repaired here; the named error goes into the unit's notes |
| `submit hygiene` reports `flagged` | WU-09 stops with the report path; the remediation steps are the tool's own (remove from the index, ignore, rotate the key at its provider); no unit rewrites history |
| The repository has no remote, no public address, or `video_url` still ends `/watch` | WU-09 prints `BLOCKED (<which>)` for that check, exits `3`, and lists the operator step; the other checks still run and are reported |
| `check_banned_words.py` finds a word in a file that a tool generated | `polish` rewrites it by §5.5 and prints the pair; a hit that cannot be rewritten stops the unit with `polish: <file>:<line> needs a human rewrite` |
| Vertex is unreachable for WU-07 | `BLOCKED (<named error>)` per AI ACCESS §1; the fallback checklist is written, the sheet header says the questions are generic, and WU-07's check 2 reports it as blocked rather than passing |
| The golden capture video is larger than 15 MB | WU-08 keeps the screenshots and `capture-run.json`, deletes the video from the repository folder, writes `capture-run.json.videoKept` as `false` and says so; the screenshots are the committed evidence |
| `design_documents/friction-log.md` has no platform entry | `compile-friction.ts` writes one line `No platform friction was recorded in this build.` and prints `friction: 0 platform entries, <m> internal entries kept out`; the feature-request unit then needs at least two requests that cite a probe or a verification line instead, and says so |
| A text this plan wrote holds a number without a claim | `claims lint` (WU-02) lists the line; the sentence is reworded to words or a claim is added by the DP-SHOWCASE §5.3 rules; never ignored |

## §7 Work units

Every unit ends with one verification script. Each script prints its own `<name>: <n> checks OK` line on success, or the failing check labels and exit `1`; a check that cannot run because something outside the repository is missing prints `BLOCKED (<named reason>)` and exits `3`.

### WU-SUBMISSION-01 — licence, AI-assistance log, provenance record, disclosure, `.gitignore`
- **Goal:** `LICENSE` is detectable as MIT, `disclosure.md` is the chassis tool's own output (copied byte for byte to the root), `provenance.json` is computed from real sources, and the judge-facing documents are no longer ignored by git.
- **Steps:**
  1. Write `scripts/lib/submission.ts` (§3.5) and `scripts/chassis-tool.ts` (§3.6). Run `npx vite-node scripts/chassis-tool.ts provo -- --help`; it must print a first line that starts `provo — Disclosure Generator`. When it does not, stop with the printed `BLOCKED (…)`.
  2. Write `LICENSE` from §5.1. Write `design_documents/submission/ai_tools.json` from §3.2.
  3. Append the block of §5.8 to `.gitignore` (once; if the first line of the block is already there, do nothing).
  4. Run `npx vite-node scripts/chassis-tool.ts provo -- generate --manifest assembly.manifest.json --ai-log design_documents/submission/ai_tools.json --out design_documents/submission/provo/disclosure.md`; copy `design_documents/submission/provo/disclosure.md` to `disclosure.md` unchanged.
  5. Write `scripts/gen-provenance.ts` and run it (§3.3): chassis block from `assembly.manifest.json`; `authoredInWindow` from `git ls-files`; `dependencies` from `package.json` for the names `express`, `react`, `three`, `@strands-agents/sdk`, `@aws-sdk/client-bedrock-runtime`, `@playwright/test`; `models` from the `doorstep-meta` entry read through `createGoldenCache("data/golden-cache")` (`provider` `bedrock` gives source `bedrock`, `vertex-fallback` gives `vertex`; the entry's `model` and `region`).
  6. Add the `package.json` scripts `verify:submission` (runs `sb-01` … `sb-09` in order) and `submission:chassis`; write `scripts/verify/sb-01-licence.ts`.
- **Files:** `LICENSE`, `.gitignore`, `disclosure.md`, `design_documents/submission/ai_tools.json`, `design_documents/submission/provenance.json`, `design_documents/submission/provo/*`, `scripts/lib/submission.ts`, `scripts/chassis-tool.ts`, `scripts/gen-provenance.ts`, `package.json`, `scripts/verify/sb-01-licence.ts`.
- **Checks (12):**
  1. `LICENSE` starts with `MIT License`, its third line starts `Copyright (c) 2026 `, and the remaining lines equal §5.1 character for character.
  2. `design_documents/submission/ai_tools.json` is an array of exactly four objects, each with a non-empty `tool` and a `scope` of at least eight words.
  3. `runChassisTool("provo", ["--help"])` exits `0` and its output contains `provo — Disclosure Generator`.
  4. The `provo generate` command of step 4 exits `0` and `design_documents/submission/provo/` then holds `disclosure.md`, `architecture-summary.md` and `architecture_summary.txt`.
  5. `disclosure.md` and `design_documents/submission/provo/disclosure.md` are byte-identical.
  6. `disclosure.md` contains the heading `## Reused components (<n>)` where `<n>` equals the number of components with `included: true` in `assembly.manifest.json`, and holds `**<id>**` for each of them.
  7. `disclosure.md` holds no `**<id>**` for any component with `included: false`.
  8. `disclosure.md` contains `## AI assistance` and the four tool names of `ai_tools.json`.
  9. `provenance.json` has `version` `1.0.0`, `windowStartsOn` `2026-08-31`, `chassis.includedComponents` equal to the manifest's included ids, and at least one `models` entry with a non-empty `id` and `region`.
  10. `provenance.json` `authoredInWindow` contains `src/ring`, `src/domain`, `src/ui`, `src/server`, `scripts` and `e2e`, and contains none of `src/context`, `src/cost`, `src/ideation`, `src/pgm`, `src/platform`, `src/profile`, `src/provenance`, `src/resilience`.
  11. `.gitignore` contains the first line of the §5.8 block exactly once, has no duplicate non-comment line, and `git check-ignore -q design_documents/submission/feedback.md` exits `1` while `git check-ignore -q design_documents/engine-building-prompt.md` exits `0`.
  12. `scanBanned(["disclosure.md", "design_documents/submission/ai_tools.json"])` returns no hit, and neither file holds an absolute path (a Unix home prefix, a macOS users prefix, a drive letter) or `Bearer `.
- **Verify:** `npx vite-node scripts/verify/sb-01-licence.ts`
- **Expected output:** `sb-01-licence: 12 checks OK`
- **Proves:** the repository carries a licence GitHub can detect, a disclosure that comes from the chassis tool and matches the manifest, a provenance record computed from real files, and a `.gitignore` that lets a judge see the documents the README points to.

### WU-SUBMISSION-02 — the description, the mechanical extraction, the ten fields
- **Goal:** Devpost field 1 is a short text with no unsourced number, the chassis formatter's extraction is saved and proven to quote the disclosure verbatim, and `devpost-fields.json` maps all ten fields to real files and values.
- **Steps:**
  1. Run `npx vite-node scripts/chassis-tool.ts submit -- format --plan design_documents/winning_project_plan.md --manifest assembly.manifest.json --disclosure design_documents/submission/provo/disclosure.md --out design_documents/submission/extracted-copy.md`. Exit `0` is required (exit `1` means the secret scan flagged something: stop, WU-09 explains the remedy).
  2. Write `design_documents/submission_description.md` from §5.2 field 1.
  3. Write `scripts/build-devpost-fields.ts` and run it (§3.7). Field 3 and field 2 come from `design_documents/showcase.json`; when `repo_url` is empty or `video_url` is empty the field is written as missing and `known_gaps` of the showcase file already says why.
  4. Run `npx vite-node hee/src/showcase/cli.ts claims lint --entry .`; reword any flagged line of the description to words, or add a claim by DP-SHOWCASE §5.3.
  5. Write `scripts/verify/sb-02-fields.ts`.
- **Files:** `design_documents/submission/extracted-copy.md`, `design_documents/submission_description.md`, `design_documents/submission/devpost-fields.json`, `scripts/build-devpost-fields.ts`, `scripts/verify/sb-02-fields.ts`.
- **Checks (10):**
  1. `extracted-copy.md` starts with the comment line that holds `generated_at` and the line `# Submission copy`, and its `## Disclosure / Provenance` section body equals `disclosure.md` after trimming.
  2. The `submit format` command of step 1 exits `0`.
  3. `design_documents/submission_description.md` has the headings `# Doorstep Rhythm`, `## What it does`, `## How it uses Ring`, `## Try it`, `## Reused code and AI help` in that order, and its third non-empty line equals the slogan `Know her day without calling.`
  4. `submission_description.md` holds no digit character and none of the words `first`, `only`, `best`, `fastest`, `never`, `always`, `guaranteed`, `unique`, `state-of-the-art`, `unprecedented`, `no other`.
  5. `claims lint --entry .` exits `0` and prints `claims: OK (<n> claims)`; `claims verify --entry .` prints `<n> verified, 0 unverified`.
  6. `scanBanned(["design_documents/submission_description.md", "design_documents/submission/devpost-fields.json"])` returns no hit.
  7. `devpost-fields.json` has exactly the keys `1_description` … `10_testing_access` and the number printed by `build-devpost-fields.ts` (`fields: <n> of 10 present`) equals the count of fields that carry no `missing` key.
  8. Field `5_primary_track` is `Ring`; field `6_mini_challenges` has one entry named `AWS Builder` with `services` equal to `["Amazon Bedrock"]` and no entry named `Open Source`.
  9. Field `10_testing_access.text` equals the §5.2 literal for field 10 and its `url` equals `showcase.live_url`; field `2_repository.licence` is `MIT`.
  10. Every `file` value in the map is a path under `design_documents/` and the files `README.md` and `JUDGES.md` exist (the later units of this plan create the remaining targets; WU-09 re-checks all of them).
- **Verify:** `npx vite-node scripts/verify/sb-02-fields.ts`
- **Expected output:** `sb-02-fields: 10 checks OK`
- **Proves:** the form text is short, plain and sourced, the chassis formatter ran and agrees with the disclosure, and every one of the ten Devpost items has a defined home.

### WU-SUBMISSION-03 — product feedback for every tool
- **Goal:** `feedback.md` answers the brief's five questions for each Ring and AWS tool used, each answer tied to a file or a friction entry, and carries the AWS Builder answer.
- **Steps:**
  1. Read the evidence of §5.3: the Ring plan's verification lines, `design_documents/friction-log.md`, the three probe scripts, `design_documents/e2e-testing/results.md`, `architecture.json` proof ids, `design_documents/submission/ai_tools.json`.
  2. Write `design_documents/submission/feedback.md` to the skeleton of §5.3, every sentence from the evidence column. When a tool has nothing to report, the `What needs work` text is `No friction found in this build (evidence: <the file that exercises it>)`.
  3. Write `scripts/check-feedback.ts` with the six rules of §5.3 and run it.
  4. Write `scripts/verify/sb-03-feedback.ts`.
- **Files:** `design_documents/submission/feedback.md`, `scripts/check-feedback.ts`, `scripts/verify/sb-03-feedback.ts`.
- **Checks (10):**
  1. `feedback.md` has the level-two headings `Ring REST API and OAuth`, `Ring webhooks`, `Ring live sessions (WHEP)`, `Ring Developer Playground token`, `Ring Appstore MCP`, `Amazon Bedrock`, `Strands Agents SDK`, `Amazon Bedrock AgentCore`, `AWS Builder`, `Other tools`, in that order.
  2. Each of the first eight sections has the five level-three headings `Used for`, `What worked`, `What needs work`, `Zero to hello-world`, `Would I build with it again`, in that order, each with at least one sentence.
  3. Each `Would I build with it again` text starts `Yes` or `No` followed by a comma or colon and a reason of at least six words (the `AgentCore` section answers for the service it considered).
  4. Each of the first eight sections has at least one bullet under `What needs work`, each bullet ends `(evidence: <ref>)`, and every `<ref>` is an `FL-n` found in `design_documents/friction-log.md` or an existing relative path.
  5. Each `Zero to hello-world` has between one and six numbered steps and names a script or document that exists.
  6. The `Amazon Bedrock AgentCore` section contains `not used` and a reason of at least ten words.
  7. The `AWS Builder` section begins with the six-line answer of §5.2 field 6 verbatim, and its services table has rows `Amazon Bedrock` and `Strands Agents SDK` whose file paths exist; `src/llm/bedrock-client.ts` contains `@aws-sdk/client-bedrock-runtime` and `src/llm/strands-adapter.ts` contains `@strands-agents/sdk`.
  8. The `Other tools` table has a row for each of `Gemini on Vertex AI`, `Google Cloud Run`, `Playwright`, `React Three Fiber`, `Express`.
  9. `feedback.md` holds no `TODO`, no `{{`, no absolute path, no `Bearer `, and `scanBanned(["design_documents/submission/feedback.md"])` returns no hit.
  10. `npx vite-node scripts/check-feedback.ts` exits `0` and prints `feedback: 8 tools, <n> evidence links` with `<n>` at least `8`; `npx vite-node scripts/check-feedback.ts --final` exits `1` and prints `feedback: live-check still pending` (the live run clears it).
- **Verify:** `npx vite-node scripts/verify/sb-03-feedback.ts`
- **Expected output:** `sb-03-feedback: 10 checks OK`
- **Proves:** the feedback is complete, tied to evidence, and structured so a reviewer can check each claim; the one thing that needs a live account is visibly pending and has a script that refuses it at the end.

### WU-SUBMISSION-04 — the friction log
- **Goal:** the repository's friction log is compiled into the six-part Devpost shape, with platform entries separated from internal ones.
- **Steps:**
  1. Add one `Suggestion:` line to each platform entry of `design_documents/friction-log.md` (§5.4), worded from what the entry already found.
  2. Write `scripts/compile-friction.ts` and run it. `FRICTION_SOURCE` (default `design_documents/friction-log.md`) lets the verification point it at a temporary copy.
  3. Write `scripts/verify/sb-04-friction.ts`.
- **Files:** `design_documents/friction-log.md` (suggestion lines only), `design_documents/submission/friction-log-devpost.md`, `scripts/compile-friction.ts`, `scripts/verify/sb-04-friction.ts`.
- **Checks (8):**
  1. `npx vite-node scripts/compile-friction.ts` exits `0` and prints `friction: <n> platform entries, <m> internal entries kept out`, and `<n>` plus `<m>` equals the number of `## FL-` headings in the source.
  2. For the three entries present when this plan was written, the classifier returns FL-1 internal, FL-2 platform, FL-3 internal; entries added later are classified by the rule of §5.4 and listed.
  3. Every entry of the output has the six bullets `Task`, `Steps`, `Expected vs actual`, `Severity`, `Workaround`, `Suggestion`, in that order.
  4. Every `Severity` value is `low`, `medium` or `high`.
  5. With `FRICTION_SOURCE` pointing at a temporary copy whose first platform entry lost its `Workaround` line, the script exits `1` and prints `friction: FL-<n> is missing Workaround`.
  6. Every platform entry of the source has a `Suggestion:` line and the output carries it.
  7. `scanBanned(["design_documents/submission/friction-log-devpost.md"])` returns no hit; the file holds no absolute path.
  8. The source file `design_documents/friction-log.md` still holds every `## FL-` heading it held before this unit (no entry removed or renumbered).
- **Verify:** `npx vite-node scripts/verify/sb-04-friction.ts`
- **Expected output:** `sb-04-friction: 8 checks OK`
- **Proves:** field 9 lists real platform friction in the shape the brief asks for, and internal contract mismatches are not presented to the sponsor as theirs.

### WU-SUBMISSION-05 — feature requests and the statement of what was built
- **Goal:** fields 8 and 7 exist, each request is tied to a recorded friction entry, and the statement of the window lists the reused and the authored parts from computed lists.
- **Steps:**
  1. Write `design_documents/submission/feature-requests.md`: between two and six requests, each in the shape `## FEAT-<n> <title>` with the bullets `Description`, `Why it matters`, `Priority` (one of `Critical`, `Important`, `Nice-to-have`) and `Evidence` (a platform `FL-n`, or a probe script path when there is none). At most one request is `Critical`.
  2. Write `scripts/build-delta.ts` and run it (§5.6).
  3. Write `scripts/verify/sb-05-delta.ts`.
- **Files:** `design_documents/submission/feature-requests.md`, `design_documents/submission/delta.md`, `scripts/build-delta.ts`, `scripts/verify/sb-05-delta.ts`.
- **Checks (8):**
  1. `feature-requests.md` has between two and six `## FEAT-` entries, each with the four bullets in order.
  2. Every `Priority` is one of the three allowed words and at most one is `Critical`.
  3. Every `Evidence` value is a platform entry of `friction-log-devpost.md` or a relative path that exists.
  4. `delta.md` has the headings `# What was built in the submission window`, `## Reused scaffolding`, `## Built in the window` and contains `2026-08-31`.
  5. The `Reused scaffolding` bullets name each included component of the manifest once and none of the excluded ones.
  6. Every path named in `Built in the window` is in `git ls-files` output (as a prefix) and appears in `provenance.json` `authoredInWindow`.
  7. `scanBanned` returns no hit for both files, and neither contains an absolute path or the text `TODO`.
  8. `npx vite-node scripts/build-delta.ts` prints `delta: reused <n> chassis components, authored <m> paths` with `<n>` equal to the manifest's included count.
- **Verify:** `npx vite-node scripts/verify/sb-05-delta.ts`
- **Expected output:** `sb-05-delta: 8 checks OK`
- **Proves:** the optional bonus fields are present and grounded, and the statement of what was built in the window is computed from the repository, not remembered.

### WU-SUBMISSION-06 — the deck
- **Goal:** the chassis deck skeleton is populated from the winning plan, the manifest and the generated disclosure, with no unresolved slot and no banned word, and the title slide carries the slogan.
- **Steps:**
  1. Run `npx vite-node scripts/chassis-tool.ts deckgen -- populate --plan design_documents/winning_project_plan.md --manifest assembly.manifest.json --disclosure design_documents/submission/provo/disclosure.md --out design_documents/submission/deck --no-llm --validate`.
  2. Write `scripts/finish-deck.ts` and run it. It does three things and nothing else: (a) in `07-ask-next-steps.md` and in `deck.md` it replaces the line that starts `> **TODO:** Ask / Next Steps` with the two paragraphs `**Ask.** Open <live_url>, press Load the sample week, then Review the week.` and `**Team.** The people who built Doorstep Rhythm are listed on the Devpost submission.` (`<live_url>` from `readShowcase()`); (b) in `01-title.md` and in `deck.md` it inserts the slogan as its own line directly after the first heading when that line is not already there; (c) it runs `polish` on every `.md` and `.mmd` file of the deck and writes the pairs to `design_documents/submission/deck/polish-report.md`.
  3. Read `polish-report.md` once. When a replacement reads awkwardly, reword that sentence in the slide file and rerun `scanBanned`.
  4. Write `scripts/verify/sb-06-deck.ts`.
- **Files:** `design_documents/submission/deck/*`, `scripts/finish-deck.ts`, `scripts/verify/sb-06-deck.ts`.
- **Checks (10):**
  1. The populate command exits `0` and `design_documents/submission/deck/` holds `deck.md`, `01-title.md`, `02-problem.md`, `03-user.md`, `04-demo.md`, `05-architecture.md`, `06-business-value.md`, `07-ask-next-steps.md`, `08-disclosure.md` and `diagram.mmd`.
  2. The text between `<!-- PROV-01:BEGIN -->` and `<!-- PROV-01:END -->` in `08-disclosure.md` equals `disclosure.md` after trimming.
  3. `diagram.mmd` starts with `graph TD` and holds each included component id of the manifest.
  4. No line of any `.md` file of the deck starts with `> **TODO:`.
  5. `07-ask-next-steps.md` contains the two literal paragraphs of step 2 with the live address of `design_documents/showcase.json`.
  6. `01-title.md` contains the line `Know her day without calling.` exactly once.
  7. `deck.md` contains `LIVE DEMO` and the live address of `design_documents/showcase.json`.
  8. `scanBanned` over every file of the deck returns no hit, and `polish-report.md` exists.
  9. No file of the deck holds `{{`, an absolute path or `Bearer `.
  10. Running the populate command and `finish-deck.ts` a second time leaves `deck.md` byte-identical.
- **Verify:** `npx vite-node scripts/verify/sb-06-deck.ts`
- **Expected output:** `sb-06-deck: 10 checks OK`
- **Proves:** a presenter can open the deck without a gap to fill, the disclosure slide is the generated text, and the deck can be rebuilt from its sources.

### WU-SUBMISSION-07 — the judge Q&A sheet and its rehearsal (the one live model call of this plan)
- **Goal:** a sheet of anticipated judge questions with answers grounded in the plan, the manifest and the disclosure exists, was generated through Gemini on Vertex AI under the AI ACCESS rule, and was rehearsed with scored feedback.
- **Steps:**
  1. Write `scripts/lib/submission-llm.ts` (§5.7) and `scripts/make-qa.ts`. `make-qa.ts` begins with the commands of AI ACCESS §2 (`gcloud auth application-default print-access-token`, the project, `gcloud services list --enabled --filter="name:aiplatform.googleapis.com"`, `discoverModels()`) and writes their outcome to `design_documents/submission/qa/qa-run.json` as `{ "adcToken": true, "project": "<id>", "location": "<region>", "apiEnabled": true, "model": "<discovered id>", "generatedAt": "<ISO>" }`. A failure of any of them is printed as `BLOCKED (<named error>)` with exit `3`, after the fallback checklist is written.
  2. Run it. Then apply `polish` to every string of `qa-sheet.json`, validate with `validateSheet`, and rewrite `qa-sheet.md` with `renderSheetMarkdown`.
  3. Write `scripts/rehearse-qa.ts`: `runRehearsal({ qaPath: "design_documents/submission/qa/qa-sheet.md", count: 5, budgetS: 90, callLlm: callVertexJson, io, logPath: "design_documents/submission/qa/rehearsal.md" })` where `io.ask` returns the drafted answer of the question named in the prompt (so the run needs no person) and `io.write` appends to the log. It prints `rehearsal: <n> answered, <m> scored`.
  4. Rerun `scripts/gen-provenance.ts` so that `provenance.json` `models` also holds the Q&A model with source `vertex`.
  5. Write `scripts/verify/sb-07-qa.ts`.
- **Files:** `design_documents/submission/qa/*`, `scripts/lib/submission-llm.ts`, `scripts/make-qa.ts`, `scripts/rehearse-qa.ts`, `scripts/verify/sb-07-qa.ts`.
- **Checks (10):**
  1. `qa-run.json` has `adcToken` `true`, a non-empty `project`, `location` and `model`, and `apiEnabled` `true` (a `BLOCKED (…)` here ends the script with exit `3` and the named error).
  2. `qa-sheet.json` validates with `validateSheet` and its generation mode is `generated`, not `fallback`.
  3. The sheet holds between 15 and 20 questions.
  4. Each of the four axes `presentation`, `business_value`, `application_of_technology`, `originality` has at least two questions, and at least one question is tagged with each of `Ring` and `AWS Builder`.
  5. Every answer is either grounded in the inputs or marked `not_stated`; `rehearsal.md` starts with the line `unverified: <n>` giving the count of `not_stated` answers.
  6. `scanBanned(["design_documents/submission/qa/qa-sheet.md", "design_documents/submission/qa/qa-sheet.json", "design_documents/submission/qa/rehearsal.md"])` returns no hit.
  7. `npx vite-node scripts/rehearse-qa.ts --count 5` prints `rehearsal: 5 answered, 5 scored`, and `rehearsal.md` holds five judge feedback blocks, each with a numeric score.
  8. `provenance.json` `models` holds an entry whose `source` is `vertex` and whose `id` equals `qa-run.json` `model`.
  9. No file of this unit reads `OPENAI_API_KEY` (a search of `scripts/make-qa.ts`, `scripts/rehearse-qa.ts`, `scripts/lib/submission-llm.ts` finds nothing).
  10. With `GOOGLE_CLOUD_PROJECT` set to a project id built from random characters at runtime and `--out-dir <a temporary folder>`, `make-qa.ts` exits `3`, prints a line that starts `BLOCKED (`, and the temporary folder holds `qa-sheet.fallback.md`.
- **Verify:** `npx vite-node scripts/verify/sb-07-qa.ts`
- **Expected output:** `sb-07-qa: 10 checks OK`
- **Proves:** the team has rehearsed the questions a judge will ask, with answers that cite only the project's own documents, through the model route the AI ACCESS rule requires, and a failure of that route is named instead of hidden.

### WU-SUBMISSION-08 — the golden capture
- **Goal:** the demo scenario is replayed against a local server running on the recorded run, and the driver's video and one screenshot per step are kept as evidence that the recorded path works from a clean start.
- **Steps:**
  1. Write `scripts/make-capture-script.ts` (§3.8) and run it with the base address of the local server (`http://127.0.0.1:<port>`, a free port chosen by the script).
  2. Start the server: `PORT=<free> AGENT_PROVIDER=golden BUILD_MARKER=capture npm run server`; wait for `GET /health` to answer `ok: true` (20 s limit).
  3. Run `npx vite-node src/ideation/demodrive/cli.ts validate --script design_documents/submission/capture/capture-script.json`, then `npx vite-node src/ideation/demodrive/cli.ts capture --script design_documents/submission/capture/capture-script.json --data-source cache --cache-key doorstep-meta --out design_documents/submission/capture/run`.
  4. Read `GET /api/status` once before stopping the server (it must say the agent kind is `golden` and the Ring mode is `bundle`), stop the server with `SIGTERM`, and write `design_documents/submission/capture/capture-run.json`: `{ "base": "<url>", "dir": "run/<timestamp>", "steps": [<ids>], "videoKept": true, "videoBytes": <n>, "expectedWarning": true, "notes": [<dropped actions>] }`.
  5. When `video.webm` is larger than 15 MB, delete it, set `videoKept` to `false` and keep the screenshots (§6). Delete older folders under `capture/run/` so one run remains.
  6. Write `scripts/verify/sb-08-capture.ts`.
- **Files:** `design_documents/submission/capture/*`, `scripts/make-capture-script.ts`, `scripts/verify/sb-08-capture.ts`.
- **Checks (10):**
  1. `capture-script.json` passes `demodrive validate` (exit `0`).
  2. Its step ids equal the step ids of `design_documents/demo-scenario.json`, in order.
  3. Its `data_source` is `{ "kind": "cache", "cache_key": "doorstep-meta", "mock_script": null }` and its `base_url` starts `http://127.0.0.1:`.
  4. The capture command exits `0`.
  5. The run folder holds `<step-id>/screenshot.png` for every step id and no `demodrive-error.json`.
  6. The capture output holds the line `cache_miss: key doorstep-meta` (the product does not read the chassis event feed, so the driver's feeder finds no envelope and continues; the warning is expected) and `capture-run.json` records `expectedWarning` `true`.
  7. The `GET /api/status` read of step 4 had `agent.kind` equal to `golden` and `ring.mode` equal to `bundle`; the script stores both values in `capture-run.json`.
  8. The screenshot of step `approve` is not byte-identical to the screenshot of step `review`, and the screenshot of step `week` is larger than 20 000 bytes (not a blank page).
  9. `video.webm` exists in the run folder, or `capture-run.json` has `videoKept` `false` with the recorded size above 15 MB.
  10. `capture-run.json` lists every dropped action in `notes`, and the server process is no longer running (`GET /health` on the port fails).
- **Verify:** `npx vite-node scripts/verify/sb-08-capture.ts`
- **Expected output:** `sb-08-capture: 10 checks OK`
- **Proves:** the recorded demo path runs from a clean server with no network model call and no Ring device, and there is a recording of it the team can show if a live run cannot be made.

### WU-SUBMISSION-09 — hygiene and public-readiness
- **Goal:** the repository is checked against the layout rule, the secret scan, the banned-word scan, the absolute-path scan and the showcase gate, and a single report says whether it may be made public and what the operator must still do.
- **Steps:**
  1. Write `config/entry-layout.json` (§3.4) and `scripts/check-entry-layout.ts`.
  2. Run `npx vite-node scripts/chassis-tool.ts submit -- hygiene --manifest assembly.manifest.json --out design_documents/submission/hygiene-report`. It writes `hygiene-report.json` and `hygiene-report.md`. Exit `1` means a secret was flagged: stop and follow the tool's remedy (remove from the index, ignore the path, rotate the key at its provider).
  3. Write `scripts/public-readiness.ts`. It runs, in this order, and records `PASS`, `BLOCKED (<reason>)` or `FAIL <reason>` for each: licence file; README `## Develop, test, deploy` section; layout; hygiene report status `clean`; absolute-path scan of every tracked or unignored text file outside `node_modules`; `check_banned_words.py --preset app .`; the advisory `--preset plans .` count; `claims lint`; `showcase gate --entry .`; the ten fields present; every pointer of `devpost-fields.json` existing and non-empty; `git remote get-url origin` (BLOCKED when there is none); `video_url` not ending `/watch` (BLOCKED when it does); `showcase gate --entry . --online` (BLOCKED when the previous two are blocked or the network is unreachable); `check-feedback.ts` (the non-final run). It writes `design_documents/submission/public-readiness.md` (one table row per check) and prints `public-readiness: <n> checks passed, <m> blocked, <k> failed`. Exit `0` when every check passes, `3` when none failed and some are blocked, `1` otherwise.
  4. Write `scripts/verify/sb-09-hygiene.ts`. Its fault injections generate their fake secret from random characters at runtime and remove what they created in a `finally` block.
- **Files:** `config/entry-layout.json`, `scripts/check-entry-layout.ts`, `scripts/public-readiness.ts`, `design_documents/submission/hygiene-report.json`, `design_documents/submission/hygiene-report.md`, `design_documents/submission/public-readiness.md`, `scripts/verify/sb-09-hygiene.ts`.
- **Checks (12):**
  1. `npx vite-node scripts/check-entry-layout.ts` prints `layout: OK` (every top-level path of `git ls-files` plus unignored untracked files is in `allowedFiles` or `allowedDirs`).
  2. After creating `zz-extra.txt` at the root, the same command exits `1` and prints `layout: zz-extra.txt is not allowed`; the file is removed afterwards.
  3. The `submit hygiene` command of step 2 exits `0` and `hygiene-report.json` has `secret_scan.status` equal to `clean`.
  4. After creating an untracked file that holds a fake key built from random characters at runtime in the shape of a cloud access key, `submit hygiene --include-unstaged` exits `1`, the report's status is `flagged`, and the printed match is cut to its first four characters followed by `...REDACTED`; the file is removed and a rerun is `clean` again.
  5. No tracked or unignored text file outside `node_modules` contains a Unix home prefix, a macOS users prefix, a sandbox session prefix or a drive-letter path (the patterns live in `scripts/public-readiness.ts`).
  6. `python3 ../../hackathons/_useful/scripts/check_banned_words.py --preset app .` exits `0`, and the advisory `--preset plans .` run is recorded in `public-readiness.md` with its hit count.
  7. `LICENSE` exists, `README.md` contains `## Develop, test, deploy`, and `package.json` has the scripts `build` and `server`.
  8. `claims lint --entry .` prints `claims: OK (<n> claims)` and `showcase gate --entry .` prints `showcase gate OK`.
  9. `npx vite-node scripts/build-devpost-fields.ts` prints `fields: 10 of 10 present`; when `repo_url` or `video_url` of `design_documents/showcase.json` is empty this check prints `BLOCKED (the field needs the operator's repository or video address)` and the script exits `3` after the other checks have run.
  10. Every `file` pointer of `devpost-fields.json` exists and is not empty, and `npx vite-node scripts/check-feedback.ts` exits `0`.
  11. `video_url` of `design_documents/showcase.json` does not end with `/watch`; when it does, the check prints `BLOCKED (video_url is still the interim /watch page)` and exits `3`. When it is final and the repository is public, `showcase gate --entry . --online` prints `showcase gate OK`.
  12. `public-readiness.md` has one row per check of step 3 and the summary line printed by `public-readiness.ts` equals the counts of its rows.
- **Verify:** `npx vite-node scripts/verify/sb-09-hygiene.ts`
- **Expected output:** `sb-09-hygiene: 12 checks OK`
- **Proves:** the repository follows the layout rule, holds no secret and no machine-specific path, passes the showcase gate, and has a written, checkable list of what is still the operator's to do before it goes public.

### §7.1 What this plan hands to the plans after it

| To | What | How it is checked |
|---|---|---|
| DP-SCRIPT | `disclosure.md`, `design_documents/submission/provenance.json` (the model names and regions the narration may state), `design_documents/submission/deck/` (the deck's wording), `design_documents/submission/capture/` (a fallback recording) | the script plan's fact ledger reads `provenance.json` and `devpost-fields.json` by path |
| DP-LIVE-RUN-AND-VIDEO | the live-check block of `feedback.md`; the `Pending:` line it must replace; the final `check-feedback.ts --final`; a rerun of `scripts/public-readiness.ts --online` after the video is uploaded and `video_url` is final | the last unit of that plan runs both scripts and expects exit `0` |
| The operator | creating the public repository, uploading the video, setting `repo_url` and `video_url`, pressing Submit | `public-readiness.md` names each as `BLOCKED (…)` until done |

## §8 Verification summary

| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/sb-01-licence.ts` | `sb-01-licence: 12 checks OK` |
| 02 | `npx vite-node scripts/verify/sb-02-fields.ts` | `sb-02-fields: 10 checks OK` |
| 03 | `npx vite-node scripts/verify/sb-03-feedback.ts` | `sb-03-feedback: 10 checks OK` |
| 04 | `npx vite-node scripts/verify/sb-04-friction.ts` | `sb-04-friction: 8 checks OK` |
| 05 | `npx vite-node scripts/verify/sb-05-delta.ts` | `sb-05-delta: 8 checks OK` |
| 06 | `npx vite-node scripts/verify/sb-06-deck.ts` | `sb-06-deck: 10 checks OK` |
| 07 | `npx vite-node scripts/verify/sb-07-qa.ts` | `sb-07-qa: 10 checks OK` (or `BLOCKED (<named error>)`, exit `3`) |
| 08 | `npx vite-node scripts/verify/sb-08-capture.ts` | `sb-08-capture: 10 checks OK` |
| 09 | `npx vite-node scripts/verify/sb-09-hygiene.ts` | `sb-09-hygiene: 12 checks OK` (or `BLOCKED (<named reason>)`, exit `3`, until the operator's steps are done) |
| all | `npm run verify:submission` | the nine results above, in order; exit `0`, or `3` when a named block remains |

If a count differs because a check was split or merged while writing a script, change the number in the unit and in this table in the same edit.

## §9 Risks

- **A mechanical rewrite makes a sentence awkward.** Mitigation: `polish` prints every pair, WU-06 and WU-07 each include one human read of the pairs, and the rescan must stay clean after the fix.
- **The chassis tools fail to load under the entry's `vite-node`.** Mitigation: WU-01 step 1 proves it before anything depends on it; the failure is a named block, not a silent skip.
- **`design_documents/` stays ignored and the public repository lacks the documents the README links to.** Mitigation: the §5.8 block, proven in WU-01 check 11 and again by the layout and pointer checks of WU-09.
- **The friction log holds only internal entries.** Mitigation: §6 row; the feature requests then cite probe scripts, and the feedback says no friction was found with its evidence file.
- **The feedback is written from memory.** Mitigation: rule 3 of §5.3 makes every `What needs work` bullet end with a resolvable reference; the script counts them.
- **The Q&A model call fails on quota.** Mitigation: AI ACCESS §3 (a per-minute quota is a wait-and-retry, not a missing key); the unit waits and retries once, then prints the named error.
- **The golden capture shows the product's own message in place of the 3D view on a machine without graphics.** Mitigation: the stills of DP-SHOWCASE are the 3D evidence; `capture-run.json` `notes` records that the driver launches without graphics flags.
- **The demodrive feeder warning is read as a failure.** Mitigation: check 6 of WU-08 expects it and records it.
- **The video address stays the interim page.** Mitigation: WU-09 check 11 blocks with that exact reason.
- **The licence holder name is generic.** Mitigation: §5.1 says the operator may replace the name in the copyright line; no check depends on it.
