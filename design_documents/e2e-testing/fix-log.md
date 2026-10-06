# Fix log — E2E browser testing (WU-E2E-08)

Rule (§5.1.7): a red scenario is a defect to fix, never a scenario to delete or
weaken. Entries shaped `## FIX-<n>` with Symptom, Root cause, File changed and
Proving test. `DIAG-<n>` entries are diagnosed but unfixed, with the owner who
must fix them.

## FIX-1 — UC-04/UC-05 plan text named the wrong family member

- Symptom: `strategy.md` and the plan's §5.2 use-case sentence said messages go `To Marta`.
- Root cause: The seed household names the caretaker `Maya` (`src/domain/seed.ts:14`, pinned by `aw-04-roles` and `ui-09-rail`, baked into the golden recording). The E2E plan author confused Maya with Marta (the persona daughter in DP-UI §5.1). The scenario already asserted `To Maya` correctly.
- File changed: `design_documents/design_plans/DP-E2E-BROWSER-TESTING.md` (§5.2 UC-05 sentence), `design_documents/e2e-testing/strategy.md` (§1 UC-05 sentence). Titles and assertions untouched. (T-08's frozen prompt keeps "Marta" as the person's own words; not an assertion.)
- Proving test: UC05-1.

## FIX-2 — UC01-3 compared a live calendar against a stale model snapshot

- Symptom: `button[data-day="0"] .tick` rendered 16 while `weekRibbon(model)` said 14.
- Root cause: The scenario settled only on `events.length`, but derived ticks trail the event count by a render during streaming ingest. Both sides were correct at different instants: a re-read after settle shows 16 === 16.
- File changed: `e2e/scenarios/uc01-open-the-week.spec.ts` (settle on events AND rendered tick count; same 250 ms polls, still exact per-day counts).
- Proving test: UC01-3.

## FIX-2b — UC01-5 measured the mid-transition frame after a viewport change

- Symptom: 5 elements past `clientWidth + 0.5` at 390 px, unreproducible in isolation.
- Root cause: The R3F canvas resizes on the next frame after `setViewportSize`; measuring synchronously catches the old-width canvas. A bounded `waitForFunction` for canvas quiescence (5 s timeout, still fails on real overflow) measures the settled layout.
- File changed: `e2e/scenarios/uc01-open-the-week.spec.ts` (UC01-5).
- Proving test: UC01-5.

## FIX-3 — every browser review reaching explain crashed on node:fs

- Symptom: Run status `error` at phase `explain`: "Module node:fs has been externalized for browser compatibility."
- Root cause: `src/agent/orchestrator.ts` value-imported `guardCopy` from `src/llm/guard.js`, whose `bannedHits` reads `config/banned-patterns.json` via `node:fs`. The browser bundle carries that module; the first narrator-copy guard call threw on the externalized stub. Server-side runs never hit it (real fs).
- File changed: `src/agent/orchestrator.ts` (`ReviewDeps.guard?`, defaults to the Node guard; call site uses `deps.guard ?? nodeGuardCopy`), `src/ui/state/useRun.ts` (passes the browser-safe twin `src/ui/shim/guard-browser.ts`). No behavior change on any existing caller; the first browser review after the fix completed `done` on the golden rung with 0 errors.
- Proving test: UC02-1 (and every review test).

## FIX-4 — approval polling hung on a busy page past the test budget

- Symptom: `approve.isVisible()` never resolved during merge storms; the 90 s test budget fired first.
- Root cause: `isVisible()` waits for actionability; on a main thread saturated by store-driven re-renders it outlasts the budget. `count()` returns without waiting.
- File changed: `e2e/helpers.ts` (`reviewTheWeek`), `e2e/scenarios/uc02-review-the-week.spec.ts` (UC02-1, UC02-2 loops): `count() > 0` plus `click({ timeout: 3000 })` with retry-next-poll.
- Proving test: UC02-1.

## FIX-5 — the counting wrapper killed full runs at 15 minutes

- Symptom: `e2e-run --label full` printed partial lines (`full: 1 passed…`, `full: 0 passed, 61 failed…`) read from a half-written report.
- Root cause: `spawnSync` timeout 900 s; 61 tests with a dozen golden reviews need ~25–35 min on two workers. The kill left a partial `report.json` behind.
- File changed: `scripts/e2e-run.ts` (timeout 3 600 000, comment).
- Proving test: WU-E2E-08 full runs.

## FIX-6 — UC03-1 addressed the incident column by the wrong index scheme

- Symptom: `div.day-col[data-col="8"] .pencil-circle` count 0 (exactly one circle exists).
- Root cause: `incident.dayIndex` is absolute over the 14-day window (8 = Tue 13 Oct) while ribbon `data-col` is the display index (0..6). The scenario assumed one scheme.
- File changed: `e2e/scenarios/uc03-the-moment.spec.ts` (locate the incident through its own event tick's column; no hardcoded offset; strictly stronger Truth link).
- Proving test: UC03-1.

## FIX-7 — bundle snapshots were undecodable bytes, failing naturalWidth

- Symptom: UC03-2 `naturalWidth` 0 (plan-literal: the picture must decode).
- Root cause: The committed bundle carried 1-byte `"AA=="` snapshots while the generator emitted an invalid hand-typed JPEG; neither decodes. A synthetic picture must still be a picture.
- File changed: `src/domain/generator.ts` (1×1 valid JPEG bytes, sharp-generated, deterministic constant), `data/bundle/doorstep-14d.json` (regenerated). `de-04-bundle`, `de-06-derive`, `de-08-rules` still green (no snapshot-content assertions exist).
- Proving test: UC03-2.

## FIX-8 — S-RING-6 asserted beyond the plan over mock placeholder bytes

- Symptom: `(src ?? "").length` greater than 100 failed on a 27-char data URL.
- Root cause: The worker over-specified; §5.3 S-RING-6 requires a non-empty `img`. With FIX-7 the bytes are now a real (tiny) JPEG.
- File changed: `e2e/scenarios/s-ring.spec.ts` (plan-literal non-empty data URL + download counter).
- Proving test: S-RING-6.

## FIX-9 — 3D-5 measured speed across an idle window that draws nothing by design

- Symptom: `frames1 - frames0` over a 2 s idle wait was 2–32, need 40.
- Root cause: `ThreeScene` uses `frameloop="demand"`: an idle page draws ~0 frames by design (DP-3D's own harness uses `fpsProbe`/`pumpFrames` for this reason). The budget was wrong for the product's design, with that evidence.
- File changed: `e2e/scenarios/3d.spec.ts` (start the `Walk` shot, measure across the 2 s transition), plan §5.3 3D-5 row + `strategy.md` identically.
- Proving test: 3D-5.

## FIX-10 — 3D-3 camera budget too tight for headless software GL

- Symptom: Camera not within 0.05 in 1.5 s under SwiftShader (converges at 2.5–3 s; DP-3D's own `waitNear` allows 8 s).
- Root cause: Budget wrong for the headless mode, with probe evidence in the entry; the pose requirement itself is unchanged.
- File changed: `e2e/scenarios/3d.spec.ts` (4 polls 1.5 s → 5 s), plan WU-E2E-07 step 4 + §5.3 3D-3 row + `strategy.md` identically.
- Proving test: 3D-3.

## FIX-11 — ledger-sensitive tests raced background ingest landings

- Symptom: UC07-2 ledger 42 vs 41, UC06-2 ledger growth on a refused change.
- Root cause: `loadSampleWeek` returns after the first ticks paint while webhook drain + both history channels still land (`record_webhook`, `ingest_events` entries). Tests reading `ledger.length` as `before` captured a mid-stream count.
- File changed: `e2e/helpers.ts` (new `settleSampleWeek`: events AND ticks stable), `uc06-the-rail.spec.ts` (UC06-2), `uc07-by-hand.spec.ts` (UC07-2). Same pattern as FIX-2.
- Proving test: UC07-2.

## FIX-12 — reviews started mid-stream chased moving data and crashed the render

- Symptom: Review tests failed variously (stuck at `verify` past test budgets; intermittent React error #185 at `verify`; 56 feed rows in 9 s).
- Root cause: `loadSampleWeek` returns after the first ticks paint while webhook drain + both history channels still land. A review started then repairs a moving target: ~95 duplicate-burst errors arrive during act/repair, the repair storm dispatches dozens of store updates per second, and the scene subtree tears down label roots inside the commit (DIAG-1) or nests past React's update limit (DIAG-2). A settled review completes `done` on golden with 0 errors.
- File changed: `e2e/helpers.ts` (`reviewTheWeek` settles first), `uc02` (both direct review clicks settle), `uc13` (Try-it settles). Fixture stability only; assertions untouched.
- Proving test: UC02-1.

## DIAG-1 — React root-unmount noise during scene data churn (OWNER: DP-3D)

- Symptom: `Attempted to synchronously unmount a root while React was already rendering` (0–9 per test) whenever labeled scene entities churn; `scene=off` runs are always clean (0 errors).
- Root cause (chain, all verified): kit `Entities.tsx` renders one drei `<Html>` (one react-dom root) per labeled entity; `src/3d/adapter.ts` labels day strips, flagged visits and the seam; streaming ingest rebuilds entity identities across dispatches, tearing those roots down inside the commit (the DP-3D worker's own `SceneHost.tsx` comment names this mechanism). UC01-1 (empty model, stable entities) never trips it.
- Not fixed here: the rendering pipeline (`src/3d/*`, kit usage) belongs to the in-flight DP-3D worker (see `HANDOFF-DP-3D-SONNET.md`); editing it from this loop risks their WU-04..08 verifies. Recommended fix for the owner: a stable label layer (drei `Text` instead of `Html`, or label identity memoized across desc rebuilds).
- Proving test (blocked): every scenario via the console guard.

## DIAG-2 — intermittent "Maximum update depth exceeded" at verify (OWNER: DP-3D, same family as DIAG-1)

- Symptom: Run status `error` at phase `verify` with React error #185; flaky across identical runs (done / error-verify / error-explain observed); absent with `scene=off`.
- Root cause: Unconfirmed; strongest evidence is scene-gated update churn under merge storms (95 duplicate-burst errors repaired in seconds). Ruled out: `useModel`/`useIssues` snapshots (stable refs), `SessionProvider`/`useRun`/panel effects (bounded, event-driven), kit `ActivityFeed` subscription (useState, no snapshot loop), `useEnvelopes` (per-envelope setState, not nested), `__flushUi` (defined, never called).
- Not fixed here: same ownership as DIAG-1.
- Proving test (blocked): UC02-1 (and every review test when it trips).

## DIAG-3 — 3D-2 visit-entity folding (OWNER: DP-3D)

- Symptom: `__scene3d` exposes 15 `vis:` ids vs 38 `weekRibbon` visits.
- Root cause: `src/3d/adapter.ts` folds routine visits into one `visits-routine` instanced entity instead of individual `vis:<tsMs>` entities.
- Proving test (blocked): 3D-2.
