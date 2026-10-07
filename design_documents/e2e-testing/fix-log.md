# Fix log — E2E browser testing (WU-E2E-08)

Rule (§5.1.7): a red scenario is a defect to fix, never a scenario to delete or
weaken. Entries shaped `## FIX-<n>` with Symptom, Root cause, File changed and
Proving test. `DIAG-<n>` entries are diagnosed but unfixed, with the owner who
must fix them.

## FIX-1 — UC-04/UC-05 plan text named the wrong family member

- Symptom: `strategy.md` and the plan's §5.2 use-case sentence said messages go `To Marta`.
- Root cause: The seed household names the caretaker `Maya` (`src/domain/seed.ts:14`, pinned by `aw-04-roles` and `ui-09-rail`, baked into the golden recording). The E2E plan author confused Maya with Marta (the persona daughter in DP-UI §5.1). The scenario already asserted `To Maya` correctly.
- File changed: `design_documents/design_plans/DP-E2E-BROWSER-TESTING.md` (§5.2 UC-05 sentence), `design_documents/e2e-testing/strategy.md` (§1 UC-05 sentence). Titles and assertions untouched. (T-08's frozen prompt keeps "Marta" as the person's own words; not an assertion.)
- Proving test: UC05-1

## FIX-2 — UC01-3 compared a live calendar against a stale model snapshot

- Symptom: `button[data-day="0"] .tick` rendered 16 while `weekRibbon(model)` said 14.
- Root cause: The scenario settled only on `events.length`, but derived ticks trail the event count by a render during streaming ingest. Both sides were correct at different instants: a re-read after settle shows 16 === 16.
- File changed: `e2e/scenarios/uc01-open-the-week.spec.ts` (settle on events AND rendered tick count; same 250 ms polls, still exact per-day counts).
- Proving test: UC01-3

## FIX-2b — UC01-5 measured the mid-transition frame after a viewport change

- Symptom: 5 elements past `clientWidth + 0.5` at 390 px, unreproducible in isolation.
- Root cause: The R3F canvas resizes on the next frame after `setViewportSize`; measuring synchronously catches the old-width canvas. A bounded `waitForFunction` for canvas quiescence (5 s timeout, still fails on real overflow) measures the settled layout.
- File changed: `e2e/scenarios/uc01-open-the-week.spec.ts` (UC01-5).
- Proving test: UC01-5

## FIX-3 — every browser review reaching explain crashed on node:fs

- Symptom: Run status `error` at phase `explain`: "Module node:fs has been externalized for browser compatibility."
- Root cause: `src/agent/orchestrator.ts` value-imported `guardCopy` from `src/llm/guard.js`, whose `bannedHits` reads `config/banned-patterns.json` via `node:fs`. The browser bundle carries that module; the first narrator-copy guard call threw on the externalized stub. Server-side runs never hit it (real fs).
- File changed: `src/agent/orchestrator.ts` (`ReviewDeps.guard?`, defaults to the Node guard; call site uses `deps.guard ?? nodeGuardCopy`), `src/ui/state/useRun.ts` (passes the browser-safe twin `src/ui/shim/guard-browser.ts`). No behavior change on any existing caller; the first browser review after the fix completed `done` on the golden rung with 0 errors.
- Proving test: UC02-1 (and every review test).

## FIX-4 — approval polling hung on a busy page past the test budget

- Symptom: `approve.isVisible()` never resolved during merge storms; the 90 s test budget fired first.
- Root cause: `isVisible()` waits for actionability; on a main thread saturated by store-driven re-renders it outlasts the budget. `count()` returns without waiting.
- File changed: `e2e/helpers.ts` (`reviewTheWeek`), `e2e/scenarios/uc02-review-the-week.spec.ts` (UC02-1, UC02-2 loops): `count() > 0` plus `click({ timeout: 3000 })` with retry-next-poll.
- Proving test: UC02-1

## FIX-5 — the counting wrapper killed full runs at 15 minutes

- Symptom: `e2e-run --label full` printed partial lines (`full: 1 passed…`, `full: 0 passed, 61 failed…`) read from a half-written report.
- Root cause: `spawnSync` timeout 900 s; 61 tests with a dozen golden reviews need ~25–35 min on two workers. The kill left a partial `report.json` behind.
- File changed: `scripts/e2e-run.ts` (timeout 3 600 000, comment).
- Proving test: UC02-1

## FIX-6 — UC03-1 addressed the incident column by the wrong index scheme

- Symptom: `div.day-col[data-col="8"] .pencil-circle` count 0 (exactly one circle exists).
- Root cause: `incident.dayIndex` is absolute over the 14-day window (8 = Tue 13 Oct) while ribbon `data-col` is the display index (0..6). The scenario assumed one scheme.
- File changed: `e2e/scenarios/uc03-the-moment.spec.ts` (locate the incident through its own event tick's column; no hardcoded offset; strictly stronger Truth link).
- Proving test: UC03-1

## FIX-7 — bundle snapshots were undecodable bytes, failing naturalWidth

- Symptom: UC03-2 `naturalWidth` 0 (plan-literal: the picture must decode).
- Root cause: The committed bundle carried 1-byte `"AA=="` snapshots while the generator emitted an invalid hand-typed JPEG; neither decodes. A synthetic picture must still be a picture.
- File changed: `src/domain/generator.ts` (1×1 valid JPEG bytes, sharp-generated, deterministic constant), `data/bundle/doorstep-14d.json` (regenerated). `de-04-bundle`, `de-06-derive`, `de-08-rules` still green (no snapshot-content assertions exist).
- Proving test: UC03-2

## FIX-8 — S-RING-6 asserted beyond the plan over mock placeholder bytes

- Symptom: `(src ?? "").length` greater than 100 failed on a 27-char data URL.
- Root cause: The worker over-specified; §5.3 S-RING-6 requires a non-empty `img`. With FIX-7 the bytes are now a real (tiny) JPEG.
- File changed: `e2e/scenarios/s-ring.spec.ts` (plan-literal non-empty data URL + download counter).
- Proving test: S-RING-6

## FIX-9 — 3D-5 measured speed across an idle window that draws nothing by design

- Symptom: `frames1 - frames0` over a 2 s idle wait was 2–32, need 40.
- Root cause: `ThreeScene` uses `frameloop="demand"`: an idle page draws ~0 frames by design (DP-3D's own harness uses `fpsProbe`/`pumpFrames` for this reason). The budget was wrong for the product's design, with that evidence.
- File changed: `e2e/scenarios/3d.spec.ts` (start the `Walk` shot, measure across the 2 s transition), plan §5.3 3D-5 row + `strategy.md` identically.
- Proving test: 3D-5

## FIX-10 — 3D-3 camera budget too tight for headless software GL

- Symptom: Camera not within 0.05 in 1.5 s under SwiftShader (converges at 2.5–3 s; DP-3D's own `waitNear` allows 8 s).
- Root cause: Budget wrong for the headless mode, with probe evidence in the entry; the pose requirement itself is unchanged.
- File changed: `e2e/scenarios/3d.spec.ts` (4 polls 1.5 s → 5 s), plan WU-E2E-07 step 4 + §5.3 3D-3 row + `strategy.md` identically.
- Proving test: 3D-3

## FIX-11 — ledger-sensitive tests raced background ingest landings

- Symptom: UC07-2 ledger 42 vs 41, UC06-2 ledger growth on a refused change.
- Root cause: `loadSampleWeek` returns after the first ticks paint while webhook drain + both history channels still land (`record_webhook`, `ingest_events` entries). Tests reading `ledger.length` as `before` captured a mid-stream count.
- File changed: `e2e/helpers.ts` (new `settleSampleWeek`: events AND ticks stable), `uc06-the-rail.spec.ts` (UC06-2), `uc07-by-hand.spec.ts` (UC07-2). Same pattern as FIX-2.
- Proving test: UC07-2

## FIX-12 — reviews started mid-stream chased moving data and crashed the render

- Symptom: Review tests failed variously (stuck at `verify` past test budgets; intermittent React error #185 at `verify`; 56 feed rows in 9 s).
- Root cause: `loadSampleWeek` returns after the first ticks paint while webhook drain + both history channels still land. A review started then repairs a moving target: ~95 duplicate-burst errors arrive during act/repair, the repair storm dispatches dozens of store updates per second, and the scene subtree tears down label roots inside the commit (DIAG-1) or nests past React's update limit (DIAG-2). A settled review completes `done` on golden with 0 errors.
- File changed: `e2e/helpers.ts` (`reviewTheWeek` settles first), `uc02` (both direct review clicks settle), `uc13` (Try-it settles). Fixture stability only; assertions untouched.
- Proving test: UC02-1

## FIX-13 — a review with the 3D scene mounted crashed (React #185), took 40–100 s, and drew labels with extra React roots

- Symptom: `Attempted to synchronously unmount a root while React was already rendering` (0–9 per test); run status `error` with `Maximum update depth exceeded` in 10–15 % of reviews (more when the machine was faster); a golden review took 40–100 s with the scene mounted and 2–3 s with `scene=off`.
- Root cause: four separate defects, each measured. (a) drei `Html` makes one react-dom root per label and unmounts it in a commit. (b) The repair pass and a batch of tool calls run as one unbroken chain of microtasks: every store update committed on React's sync lane while the feed's and the run's default-lane updates stayed queued behind it, and React aborts the page past 50 such commits. (c) `DoorwayScene` set a fresh highlight array from an effect on every ledger step, chaining a commit per step. (d) The visit thread (drei `QuadraticBezierLine`, a `LineMaterial`) was mounted and dropped as visits came and went; three frees a shader program with its last user, so each reappearing thread recompiled it: 26 compiles, 0.5–1.5 s each on a software rasteriser (a CPU profile showed `getProgramInfoLog` at 19 s of a 35 s review).
- File changed: `src/3d/renderers/scene-labels.tsx` (new: labels as canvas-textured sprites), `src/3d/renderers/index.tsx`, `src/3d/DoorwayScene.tsx` (kit never sees `label`; the highlight setter only renders on a change and skips a burst of more than 12 ledger entries), `src/3d/renderers/visit-thread.tsx` (a tube mesh with a basic material that shares an existing program), `src/domain/session.ts` (`call` hands the event loop back after each call in a browser), `scripts/verify/3d-05-arcs.ts` (six renderer keys). A frame-throttled model, coalesced store subscriptions, a transition feed and a yield in the repair loop were each tried and measured, and each either made it worse or broke a UI verify; none is in the tree.
- Proving test: UC02-1

## FIX-14 — 3D-2 counted routine visits as pillars

- Symptom: `__scene3d` exposed 15 `vis:` ids against 38 ribbon visits.
- Root cause: DP-3D §5.1 folds every visit with a `routineId` into one instanced `visits-routine` entity (3d-01 check 10 pins the partition); the E2E row assumed one entity per visit. The plan text, not the scene, was wrong.
- File changed: `e2e/scenarios/3d.spec.ts` (pillars equal the ribbon visits without a `routineId`; `visits-routine` present exactly when one exists), plan §5.3 3D-2 row and WU-E2E-07 step 3, `strategy.md` identically.
- Proving test: 3D-2

## FIX-15 — 3D-5 counted frames from after the click returned

- Symptom: frames across the Walk transition read 0–39 against 40, run to run.
- Root cause: `frames0` was read after `click()`, which returns only once the busy page settles, often after the transition had already drawn.
- File changed: `e2e/scenarios/3d.spec.ts` (read `frames0` before the click, count until the camera reaches the pose).
- Proving test: 3D-5

## FIX-16 — UC04-3 read its `before` count mid-ingest

- Symptom: errors 94 after the merge against `before` 83.
- Root cause: same race as FIX-2/FIX-11; the sample week was still streaming in.
- File changed: `e2e/scenarios/uc04-decide-a-moment.spec.ts` (`settleSampleWeek`).
- Proving test: UC04-3

## FIX-17 — an inert selector named an element the page does not render

- Symptom: `[data-surface] header h2` never resolves; the surface header carries `span.eyebrow` / `span.subject` (DP-UI primitive), the h2 belongs to the incident card.
- Root cause: wrong selector in the inventory; also the calendar marks exist only once the week is loaded.
- File changed: `e2e/controls.json`, `known-inert.md`, plan WU-E2E-01 step 3 (`[data-surface] header .eyebrow`); `controls.spec.ts` loads and settles the week before resolving the calendar marks.
- Proving test: CTL-2

## FIX-18 — UC06-3 asserted consent survives a reload

- Symptom: after a reload the switch read `true` while the test expected the toggled `false`.
- Root cause: only the theme is stored (DP-UI §6.2); a reload starts a new session on the sample household. The scenario over-asserted beyond plan §5.3.
- File changed: `e2e/scenarios/uc06-the-rail.spec.ts` (after the reload the switch equals the new model, Truth).
- Proving test: UC06-3

## FIX-19 — UC14-3 timed the class where the plan and DP-UI disagree

- Symptom: class held 755 ms against the 200–400 ms row.
- Root cause: the kit holds `changed-flash` 900 ms; the visible tint is its 400 ms animation (DP-UI motion table). The end user sees the animation.
- File changed: `e2e/scenarios/uc14-activity-and-trace.spec.ts` (animation duration 200–400 ms; class lost within 1.5 s), plan §5.3 row, WU-E2E-03 technique and `strategy.md` identically.
- Proving test: UC14-3

## FIX-20 — UC14-4 re-resolved a removed button

- Symptom: after pressing `Show more` the locator matched the next row's button and stayed visible.
- Root cause: `.first()` is lazy; the pressed button removes itself.
- File changed: `e2e/scenarios/uc14-activity-and-trace.spec.ts` (button count drops by one and that row is unclamped).
- Proving test: UC14-4

## FIX-21 — the review helper approved the message card instead of the gate

- Symptom: UC05 found no proposed nudge, or two `decide_nudge` entries.
- Root cause: `getByRole("button", { name: "Approve" }).first()` also matches the suggested-message card, so the helper decided the family message that UC05 must decide itself; the recorded run also plays a chime and shares the brief, which carry their own `decide_nudge`. The decline sentence the card shows is `You declined "…"` (DP-UI `rejected()`); `The human declined` is the approval bar's agent-facing text.
- File changed: `e2e/helpers.ts`, `uc02` (approve through the approval bar only), `uc05` (decisions counted for that message; decline sentence), plan §5.3 UC05-2/UC05-3 rows and `strategy.md`.
- Proving test: UC05-2

## FIX-22 — a wrong Ring token closed the dialog and the error banner vanished a moment later

- Symptom: S-RING-4 never saw `Couldn't read Ring` once pages were fast; a person would see the banner flash and disappear.
- Root cause: the server stores a token without testing it, so the dialog closed as if it had worked; the 401 came from the next call, raised a banner, and the fallback to the sample week cleared the banner within a moment.
- File changed: `src/ui/panels/ConnectDialog.tsx` (try the token with `listDevices()`; on failure forget it, empty the field and keep the message in the dialog), `e2e/scenarios/s-ring.spec.ts` (the message is read where it now stays; the settle before the flow).
- Proving test: S-RING-4

## FIX-23 — the control inventory missed controls and CTL-1 looked for all of them in one state

- Symptom: CTL-1 listed 15 visible controls that were in no inventory row (day buttons, margin buttons, the approval checkbox, `Open an incident`, the incident circles, `Cancel`); `Approve`, `Merge duplicates`, `Action`, `Run` and the token field are visible only in one state of the page each; CTL-2 reloaded inside one session, so the history it needs never came again.
- Root cause: the inventory was written from the plan's list, not from the page; the forward check demanded every row at once after a reload; the sweep reused one session id.
- File changed: `e2e/controls.json` (eight rows, `needs_week` on one), `e2e/scenarios/controls.spec.ts` (each non-optional row must be visible in at least one of: fresh page, loaded week, review done, by-hand runner open, Ring dialog open; the reverse listing is checked in every state; a new session per page load in the sweep), `src/ui/week/BaselineStrip.tsx` (the `baseline-strip` class DP-UI names).
- Proving test: CTL-1

## FIX-24 — UC13-3 measured contrast while the theme switch was still transitioning

- Symptom: contrast 1.28 : 1 right after pressing `Dusk`.
- Root cause: the body colours run a transition; the first read caught the interpolation.
- File changed: `e2e/scenarios/uc13-help-and-looks.spec.ts` (read the resolved colours until three reads 100 ms apart agree).
- Proving test: UC13-3

## FIX-25 — the suite drew the 3D scene on the CPU and starved itself

- Symptom: with two parallel workers every review test sat at 70–100 s of a 90 s budget; the laptop's CPU was at 100 % while its GPU idled.
- Root cause: `GL_ARGS` forced the software rasteriser (SwiftShader). Chromium headless can use Direct3D 11 (Windows) or Metal (macOS) through ANGLE; the machine's RTX 2060 rendered a 3 s review where SwiftShader needed 10–40 s.
- File changed: `e2e/helpers.ts` (hardware list by platform, `E2E_GPU=0` forces the portable software list of DP-3D §5.10, `E2E_GPU=1` forces hardware), `evals/adapter.ts` (uses the same list), plan §3.2.
- Proving test: SMOKE-3
