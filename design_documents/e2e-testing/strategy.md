# E2E testing strategy — use cases, traceability, control inventory

Rule of the E2E spec: every use case gets at least one scenario that runs it start to finish — a use case with no row is a gap, not an omission.

## 1 Use cases

| UC | Use case, in the family member's words | File | Requirements |
|---|---|---|---|
| UC-01 | "I open the page and see my mum's week at a glance" | `uc01-open-the-week` | FR-19, FR-23, NFR-04, NFR-06 |
| UC-02 | "I ask for a review of the week and watch it work" | `uc02-review-the-week` | FR-06, FR-09, FR-18, FR-05 |
| UC-03 | "I see the one moment that did not fit, with a picture" | `uc03-the-moment` | FR-14, FR-17, FR-19 |
| UC-04 | "I decide what to do about that moment" | `uc04-decide-a-moment` | FR-07, FR-19 |
| UC-05 | "Before anything is sent to Maya I approve or turn it down" | `uc05-approve-a-message` | FR-07, FR-15 |
| UC-06 | "I change the quiet hours and what the house agrees to share" | `uc06-the-rail` | FR-19, FR-16, NFR-05 |
| UC-07 | "I can run any step by hand with no model" | `uc07-by-hand` | FR-08, FR-05 |
| UC-08 | "I connect Ring with a token" | `s-ring` (S-RING-4) | FR-01, FR-10, NFR-01 |
| UC-09 | "I look through the door camera for a moment" | `s-ring` (S-RING-5, S-RING-6) | FR-13, FR-14 |
| UC-10 | "Events arrive on their own while I look away" | `s-ring` (S-RING-1, S-RING-2, S-RING-3) | FR-11, FR-12, NFR-12 |
| UC-11 | "When something is down I am told, in plain words, what I am looking at" | `uc11-when-things-fail` | FR-21 |
| UC-12 | "I fly over the week in 3D and the picture follows what I do" | `3d.spec` | FR-20, NFR-07 |
| UC-13 | "I read what each part means and switch the page to the dusk look" | `uc13-help-and-looks` | FR-23, NFR-05 |
| UC-14 | "I see every step that was taken and by whom" | `uc14-activity-and-trace` | FR-09 |
| UC-15 | "The page that judges open is alive and doing real work" | `smoke`, `depth` | FR-24, FR-06 |

## 2 Traceability

`Req` column: requirement IDs. The last column is the **observable assertion**. "Truth" rows compare the screen with the model or the server's own answer.

Note: the design plan's table lists UC07-1 as FR-08 only, but §5.2 maps UC-07 to FR-08 and FR-05 and §1 maps FR-05 to the `uc07` manual runner, so UC07-1 carries FR-05 here; every other row is verbatim.

| Test id | File | Title | UC | Req | Observable assertion |
|---|---|---|---|---|---|
| H-1 | `harness.spec.ts` | the app boots and says its build | — | NFR-12 | `body[data-app-ready="true"]`; `GET /health` is `{ ok: true, build: "e2e-1" }` when local; `guard.errors()` is empty |
| UC01-1 | `uc01` | the first screen is empty, labelled and calm | UC-01 | FR-19 | with no events the empty state shows `emptyEvents().title`; the header's first child is the brandmark; exactly one `[data-demo-focus="workbench"]` |
| UC01-2 | `uc01` | loading the sample week fills the calendar | UC-01 | FR-19 | after `Load the sample week`: seven `button[data-day]`, more than 20 `.tick`, `WeekTitle` text equals `weekTitle(model)` (Truth), its support starts `Rosa's front door · Sample week` |
| UC01-3 | `uc01` | every day shows the ticks the model holds | UC-01 | FR-19 | for each `i` in 0..6 the count of `.tick` in column `i` equals `weekRibbon(model)[i].ticks.length` (Truth) |
| UC01-4 | `uc01` | choosing a day marks it and tells the model | UC-01 | FR-19 | click the Wednesday column: `aria-pressed="true"` on it only, `model.ui.selectedDay === 2` (Truth) |
| UC01-5 | `uc01` | the page fits a laptop and a phone | UC-01 | NFR-04, NFR-06 | at 1280×720 and 390×844 no element extends beyond `clientWidth + 0.5`; at 1280×720 the hero metric's computed font size is at least 64 px |
| UC02-1 | `uc02` | the review starts and shows its phases in order | UC-02 | FR-06 | click the primary button: `[data-run-status]` becomes `running`; the phase list names, in order, `Read the week`, `Plan the review`, `Check each day`, `Run the checks`, `Fix what was found`, `Write it up`, `Your decision` |
| UC02-2 | `uc02` | the run waits for the person and then finishes | UC-02 | FR-07 | an approval request appears (`Approve` and `Reject` buttons, `Nothing is waiting for you.` gone); after approving each request `[data-run-status]` is `done` |
| UC02-3 | `uc02` | the numbers on screen are the engine's numbers | UC-02 | FR-06 | the Check panel's count badge equals `errors + warnings` of `checkNow()`; the hero metric's value equals the same number (Truth); zero errors remain |
| UC02-4 | `uc02` | the run leaves a valid trace | UC-02 | FR-09 | `saveTrace` writes `e2e/artifacts/run-trace.json`; `validateRunTraceFile` is ok; at least 4 distinct model roles, at least 15 action entries, at least one verify→repair, at least one human checkpoint |
| UC03-1 | `uc03` | a moment that did not fit is circled on its day | UC-03 | FR-19 | after `openFirstCandidate()` exactly one `.pencil-circle` exists, inside the column of the incident's `dayIndex`, its `aria-label` starts `Open incident: ` |
| UC03-2 | `uc03` | the card shows the picture from that moment | UC-03 | FR-14 | the incident card has an `img` whose `alt` starts `Snapshot from ` and whose natural width is greater than 0 |
| UC03-3 | `uc03` | the dwell time shown is the time recorded | UC-03 | FR-17 | the card's dwell metric equals `fmtDuration` of the incident's `endMs − startMs` (Truth); the support text says `usual under {p90} min` with `p90` from the baseline |
| UC04-1 | `uc04` | marking a moment explained keeps its write-up | UC-04 | FR-07 | `Mark as explained`: the incident's status is `explained` in the model, `summary` unchanged (Truth), the circle keeps the warning colour class |
| UC04-2 | `uc04` | dismissing a moment is recorded as the person's act | UC-04 | FR-07 | `Dismiss`: status `dismissed`; the last ledger entry has action `set_incident_status` and the activity feed's first row shows the badge `YOU` |
| UC04-3 | `uc04` | a duplicate burst is merged from the Check panel | UC-04 | FR-19 | the sample week has a `Merge duplicates` button; pressing it lowers `checkNow()` errors by at least one and updates the badge within 1 s |
| UC04-4 | `uc04` | a moment with no picture says so | UC-04 | FR-19 | an incident opened with `withSnapshot: false` shows the callout `No snapshot for this moment` and no `img` |
| UC05-1 | `uc05` | a proposed message to the caretaker shows its audience | UC-05 | FR-07 | after the review, the nudge card shows `Approve`, `Reject` and a support line starting `To Maya` |
| UC05-2 | `uc05` | approving sends nothing until the person says so | UC-05 | FR-07 | before `Approve` the nudge's status is `proposed`; after it `approved`; the ledger has one `decide_nudge` entry for that message (Truth; the recorded run's chime and brief carry their own) |
| UC05-3 | `uc05` | turning a message down returns a sentence | UC-05 | FR-07 | `Reject`: status `rejected`; the feed shows the decline sentence of the message card (`You declined "…"`, DP-UI `rejected()`; the registry's agent-facing `The human declined` belongs to the approval bar) |
| UC06-1 | `uc06` | quiet hours can be changed and the page says what it counts | UC-06 | FR-19 | set `Start` 21:30 and `End` 05:30: the support line equals `Counted from 22:00 to 05:00`; `EFFECTIVE_QUIET_HOURS` of the model matches (Truth) |
| UC06-2 | `uc06` | two equal times are refused in words | UC-06 | FR-19 | `Start` = `End`: the callout `Pick two different times.` appears and the ledger length is unchanged |
| UC06-3 | `uc06` | consent switches work and survive a reload of the page state | UC-06 | FR-16 | toggling a `role="switch"` calls `set_consent` with `actor: "human"` (ledger); `aria-checked` equals `model.consent[scope].granted` (Truth) |
| UC06-4 | `uc06` | the theme can be switched and is remembered | UC-06 | NFR-05 | `Dusk` sets `document.documentElement.dataset.theme` to `dark`; after `page.reload()` it is still `dark`; `Paper` restores `light` |
| UC06-5 | `uc06` | the webhook pill counts what is waiting | UC-06 | FR-11 | `Webhook inbox · n waiting` equals `GET /api/status` `inbox.default`; after the sample week is loaded it reads `0` |
| UC07-1 | `uc07` | the by-hand panel lists every action by its title | UC-07 | FR-05, FR-08 | opening `Run an action by hand`: the `Action` select has 21 options; the 20 titles are the action names with underscores as spaces and a capital first letter (e.g. `List devices`) |
| UC07-2 | `uc07` | an action runs with no model and says what happened | UC-07 | FR-08 | choose `List devices`, press `Run`: the result `<p>` is non-empty; the ledger gets no entry for a read; `AGENT_PROVIDER` for this server is `golden` and no `/api/agent/*` request was made (network log) |
| UC07-3 | `uc07` | a change made by hand goes through the same gate and ledger | UC-07 | FR-08 | choose `Set incident status` with a real id and `explained`: the model's status changes (Truth) and the feed's first row has the badge `YOU` |
| UC11-1 | `uc11` | by-hand mode is named in words | UC-11 | FR-21 | with `/api/status` answering `agent.kind: "manual"`: banner title equals `runningByHand().title` |
| UC11-2 | `uc11` | the recorded run is named in words | UC-11 | FR-21 | `golden`: banner title equals `recordedRun(date).title`; the agent chip reads `Recorded run` |
| UC11-3 | `uc11` | a failing step is shown without a stack | UC-11 | FR-21 | the role route answering `500`: banner `That didn't work`; the text matches no `/\bat \S+:\d+/`; `Show details` expands it; the one expected browser error is allowed by exact text |
| UC13-1 | `uc13` | every result region has a working `?` | UC-13 | FR-23 | for each region id of `helpContent` present on `/`, the `button[data-help-for]` has the aria-label `helpContent[id].label`, opens a `role="dialog"` with the body text, and `Esc` closes it |
| UC13-2 | `uc13` | the explainer explains and lets the person try | UC-13 | FR-23 | `[data-app-explainer]` opens `[data-app-explainer-panel]` with five labelled sections; `Try it` runs one action (ledger or feed grows) |
| UC13-3 | `uc13` | the page reads well in both looks | UC-13 | NFR-05 | in `light` and `dark` the body text contrast against its background is at least 4.5 : 1 (computed in the page from the resolved colours) |
| UC14-1 | `uc14` | every step appears in the feed with its badge | UC-14 | FR-09 | after the review the feed has at least 15 rows; each row has one of `AGENT`, `YOU`, `SYSTEM` |
| UC14-2 | `uc14` | the feed rows use friendly titles | UC-14 | FR-09 | no row text contains an underscore-joined action name; row titles include `List devices` or `Open incident` |
| UC14-3 | `uc14` | a changed item flashes | UC-14 | FR-09 | after an action that changes a day, the changed element carries the kit's flash class (its animation lasts 200–400 ms; the kit holds the class 900 ms, DP-UI motion table) then loses it |
| UC14-4 | `uc14` | long rows can be opened | UC-14 | FR-09 | a row longer than two lines shows `Show more`; pressing it removes the clamp |
| CTL-1 | `controls` | every control in the inventory exists and is reachable | — | HEE-E2E-04 | for each non-optional `controls[]` row the locator resolves to at least one visible element on its route; **and in reverse**, after the sample week is loaded and the review is done, every visible `button`, `a[href]`, `[role=switch]`, `[role=radio]`, `input`, `select`, `summary` on `/` is matched by a `controls[]` row or an `inert[]` row, else the test names the unlisted control |
| CTL-2 | `controls` | every control not covered elsewhere is pressed once | — | HEE-E2E-04 | rows with `covered_by: "controls-sweep"` are pressed (or toggled and restored); zero console errors; every `inert[]` selector resolves and is not focusable |
| S-RING-1 | `s-ring` | signed webhooks are accepted once and bad ones are refused | UC-10 | FR-11, NFR-12 | a delivery signed with the fixture secret answers `200` in under 5 s; the same `request_id` again does not add an event; a wrong signature answers `401`; a `motion_detected` `human` and a `button_press` appear as ticks on the right day |
| S-RING-2 | `s-ring` | offline and online make an outage band | UC-10 | FR-04, FR-11 | `device_offline` then `device_online` for `dev-door` 40 simulated minutes apart: one `.outage-band` whose text says `40 min offline` (Truth with `weekRibbon`) |
| S-RING-3 | `s-ring` | history fills a webhook gap and the seam shows | UC-10 | FR-12 | after `reconcile_webhook_gap` the mock's `byPath` has `/v1/history/devices/dev-door/events`; one `.seam` with the text `from history` |
| S-RING-4 | `s-ring` | a token links the live Ring and is never echoed | UC-08 | FR-01, FR-10, NFR-01 | `Connect Ring` with a random token the mock accepts: Ring chip says `Live`; the device list shows the devices the mock holds (Truth); the token text appears nowhere in the DOM, storage or console; a wrong token shows `Couldn't read Ring` |
| S-RING-5 | `s-ring` | the live view opens, counts down and closes | UC-09 | FR-13 | `LiveViewPanel` opens for `dev-door`; the simulated callout `Simulated live view — the sample week has no camera stream.` shows; the mock saw one `POST …/whep/sessions` and, on close, one `DELETE` |
| S-RING-6 | `s-ring` | a snapshot becomes the picture on a moment | UC-09 | FR-14 | with a live session, `openFirstCandidate()` attaches a snapshot: the mock's `byPath` has `…/media/image/download` and the card's `img` is non-empty |
| S-RING-7 | `s-ring` | two cameras make one thread | UC-10 | FR-17 | events from `dev-door` and `dev-elite` within the thread window give a visit whose hops cross two components (model, Truth); the 3D scene has one `thread:<visitId>` entity |
| S-RING-8 | `s-ring` | the chime needs consent and approval | UC-10 | FR-15 | with consent off the agent's `play_chime_announcement` is refused with an actionable sentence; with consent granted by the person it waits for approval; after `Approve` the mock saw one `POST …/media/audio/playback` |
| S-RING-9 | `s-ring` | account linking runs nonce, confirm, complete | UC-10 | FR-16 | the three linking calls succeed in order; the response never contains the raw account identifier; `PATCH` before `POST` is refused with `409` by the mock |
| S-BEDROCK-1 | `s-bedrock` | one real structured role call goes through Bedrock | UC-02 | FR-18 | when `probeBedrock()` is available: the extractor output validates against its schema and the server's proof log has an `api-bedrock` line; otherwise the test is skipped with the probe's named error as the reason |
| SMOKE-1 | `smoke` | health answers with a build marker | UC-15 | FR-24 | `GET /health` is `200` with `ok: true` and a non-empty `build` |
| SMOKE-2 | `smoke` | the home page loads clean | UC-15 | FR-24 | `body[data-app-ready="true"]`; the brandmark is present; `guard.errors()` is empty |
| SMOKE-3 | `smoke` | a week review runs to the end | UC-15 | FR-06, FR-24 | `Load the sample week`, run the review, approve what is asked, `[data-run-status]` is `done`; the badge equals `checkNow()` (Truth); the agent chip names the rung |
| SMOKE-4 | `smoke` | the three routes render | UC-15 | FR-24 | `/` has `[data-demo-focus="workbench"]`, `/watch` has `replay`, `/lab` has `lab`; `/nope` ends at `/` |
| DEPTH-1 | `depth` | one run of the core demo meets the depth bar | UC-15 | FR-06, FR-07, FR-09 | from `run-trace.json`: model roles ≥ 4, actions ≥ 15, ≥ 1 verify→repair with errors dropping to 0, ≥ 1 human checkpoint resolved through the UI, every on-screen metric equals the trace's number, final `checkNow()` has zero errors |
| 3D-1 | `3d.spec` | the stage draws the week | UC-12 | FR-20 | `[data-demo-3d="doorway-week"]`; `window.__scene3d.ready()`; canvas variance at least 40; zero `problems` |
| 3D-2 | `3d.spec` | the picture has the same days as the calendar | UC-12 | FR-20 | `__scene3d.entityIds()` has seven `day:<i>`; the visit-pillar count equals the sum of `weekRibbon(model)[i].visits` without a `routineId` (Truth; routine visits are the instances of the one `visits-routine` entity, DP-3D §5.1, present exactly when some visit has a `routineId`) |
| 3D-3 | `3d.spec` | the shots move the camera | UC-12 | FR-20 | `Walk`, `Overview`, `Focus` each bring the camera within 0.05 of the shot's pose within 5 s (measured 2.5–3 s to converge under headless SwiftShader; DP-3D's own `waitNear` allows 8 s); `ui.shotId` follows |
| 3D-4 | `3d.spec` | an agent action moves the picture | UC-12 | FR-20 | `set_camera_shot` through the by-hand panel changes the camera; `open_incident` adds one `inc-<n>` entity |
| 3D-5 | `3d.spec` | the picture is fast enough and survives no WebGL | UC-12 | NFR-07 | in this headless mode the frames drawn across a 2 s shot transition (`frames()` before and after starting `Walk`) are at least 40 (20 fps; idle pages draw ~0 by demand-frameloop design, so an idle window cannot measure speed) and `drawCalls()` is under 300; with WebGL disabled by launch argument the flat replica `FlatWeekFallback` and `data-demo-3d="unavailable"` show |

Counts: harness 1, uc01 5, uc02 4, uc03 3, uc04 4, uc05 3, uc06 5, uc07 3, uc11 3, uc13 3, uc14 4, controls 2, s-ring 9, s-bedrock 1, smoke 4, depth 1, 3d 5 → **60 tests**.

## 4 Smoke gate

`e2e/smoke.spec.ts` is the single deployed-URL gate: DP-DEPLOY runs it as its final work unit, DP-SCRIPT runs it before harvesting any fact, and DP-LIVE-RUN-AND-VIDEO runs it as its health gate, each with its own `BASE_URL`. No plan writes a second smoke test.

## 3 Control inventory

One row per `controls[]` entry of `e2e/controls.json`.

| id | route | locator | covered by | optional |
|---|---|---|---|---|
| ctl-001 | `/` | button "Review the sample week" | UC02-1 | false |
| ctl-002 | `/` | button "Load the sample week" | UC01-2 | false |
| ctl-003 | `/` | button "Approve" | UC02-2 | false |
| ctl-004 | `/` | button "Reject" | UC05-3 | false |
| ctl-005 | `/` | button "Mark as explained" | UC04-1 | false |
| ctl-006 | `/` | button "Dismiss" | UC04-2 | false |
| ctl-007 | `/` | button "Merge duplicates" | UC04-3 | false |
| ctl-008 | `/` | button "Overview" | 3D-3 | false |
| ctl-009 | `/` | button "Focus" | 3D-3 | false |
| ctl-010 | `/` | button "Walk" | 3D-3 | false |
| ctl-011 | `/` | radio "Paper" | UC06-4 | false |
| ctl-012 | `/` | radio "Dusk" | UC06-4 | false |
| ctl-013 | `/` | combobox "Action" | UC07-2 | false |
| ctl-014 | `/` | button "Run" | UC07-2 | false |
| ctl-015 | `/` | labelled "Start" | UC06-1 | false |
| ctl-016 | `/` | labelled "End" | UC06-1 | false |
| ctl-017 | `/` | switch "*" | UC06-3 | false |
| ctl-018 | `/` | button "Connect Ring" | S-RING-4 | false |
| ctl-019 | `/` | `button[data-help-for]` | UC13-1 | false |
| ctl-020 | `/` | `[data-app-explainer]` | UC13-2 | false |
| ctl-021 | `/` | button "Try it" | UC13-2 | true |
| ctl-022 | `/` | `summary` ("Run an action by hand") | UC07-1 | false |
| ctl-023 | `/` | button "Show details" | UC11-3 | true |
| ctl-024 | `/` | button "Use the sample week" | S-RING-4 | true |
| ctl-025 | `/` | button "Show more" | UC14-4 | true |
| ctl-026 | `/` | button "Review the week" | UC02-1 | false |
| ctl-027 | `/` | textbox "Playground token" | S-RING-4 | false |
| ctl-028 | `/` | button "Use this token" | S-RING-4 | false |
| ctl-029 | `/` | `button[data-day]` | UC01-4 | false |
| ctl-030 | `/` | button "Reduce margin" | controls-sweep | false |
| ctl-031 | `/` | button "Increase margin" | controls-sweep | false |
| ctl-032 | `/` | checkbox "Require approval" | controls-sweep | false |
| ctl-033 | `/` | button "Open an incident" | controls-sweep | false |
| ctl-034 | `/` | `button[aria-label^="Open incident"]` | UC03-1 | true |
| ctl-035 | `/` | button "Cancel" | CTL-1 | false |


## 4 Agent-surface evaluation

Measured by `hee/src/agent-eval` with `evals/adapter.ts` against the running app, on the Vertex route of the AI ACCESS rule (model `gemini-2.5-flash`, location `us-central1`).

**Headline (verbatim from `evals/report.json`):** 95.0% task success (19/20) with the product's action surface against 35.0% (7/20) with generic screen actions only; 44527.3 tokens and 34.2 s per try with the surface.

**Ceiling (verbatim):** Measured on 10 frozen tasks, 2 repetitions each, with gemini-2.5-flash; this shows success on those tasks only.

| Iteration | What changed | Treatment passed | Kept |
|---|---|---|---|
| 1 | baseline, both arms | 8/20 (control 5/20) | yes |
| 2 | descriptions: read the record yourself, day numbers, batch merges | 13/20 | no: a read-only question opened an incident (safety) |
| 3 | descriptions v2: questions are answered from reads | 14/20 | no: a second incident was opened unasked (safety) |
| 4 | descriptions v3: show-me means `focus_day`, recipe for marking a named visit, findings are candidates | 19/20 | yes, target reached |
| 5 | final re-run of both arms, surface unchanged | 19/20 (control 7/20) | surface identical to iteration 4 |

Only the `descriptions` aspect was changed, one iteration at a time; the final run uses the same model for both arms. 220 of 300 sessions were used; 80 of them were spent before a single model turn, on two failures that are named below, and are counted in the budget.

What the numbers do not say, and how the adapter differs from the plan text:

- The page opens with `scene=off`: no check reads the 3D picture and a software-drawn scene starves a page that a model drives.
- The treatment adapter answers the approval gate as the person; every request belongs to a task the person asked for. The control arm cannot be asked for approval and works through the screen.
- The harness does not hand the model's final message to the world, so the `answer-*` and `summary-written` checks could not read it. The vendored runner gained one optional hook, `recordFinalText`, called before grading (`hee/src/agent-eval/runner.ts`, `types.ts`).
- `outage-recorded-wednesday` holds in the seeded week before any step, so task t04 measures only that nothing was deleted. `chime-refused-politely` can only pass in the treatment arm: the screen has no chime control.
- The surface edit is in `src/agent/actions.ts` descriptions and `actions.manifest.json`; the browser bundle was rebuilt for every iteration.
- AI ACCESS: the default project of the rule answered `403 Permission denied on resource project`; the operator's own gcloud project (`hacka-2026-09-agentic-cinema1`) answered. The first 40 sessions never reached a model for that reason, the next 40 because the vendored Vertex client sent tool parameter schemas without its own `toVertexSchema` conversion (HTTP 400 on every tool-calling request). Both are fixed in `hee/src/llm/vertexClient.ts` and in the pipeline.

Publication: the README carries no `hee-eval` markers yet, so `publish` is run by DP-SHOWCASE WU-05 after it writes them; only the headline and ceiling above may be quoted.
