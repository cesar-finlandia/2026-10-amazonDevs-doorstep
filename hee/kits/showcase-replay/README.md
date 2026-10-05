<!-- Requirement IDs: HEE-KIT-01, HEE-SHOW-01, HEE-SHOW-04 -->

# showcase-replay kit

## Purpose

The "Watch the agent do it" control for the `/watch` route (`templates/hee-showcase.spec.md`
rule 7). It replays a recorded `run-trace.json` through a second session built
by the app's own `createSession()`, so judges see the real interface animate
without touching the real app state or trace. The control is always labelled
as a replay and adds no `data-demo-focus` attributes.

## Contents

- `src/replay/` — `planReplay(trace)` turns a run trace into replay steps;
  `createReplayPlayer({ session, trace, speed })` plays them back through
  `registry.call` only, showing recorded approvals as banners and restoring
  the approval gate afterwards.
- `src/react/` — `ReplayControl`, the React control.
- `src/demo/` — a neutral demo with an in-kit fake session.
- `tests/unit/` — replay core unit tests. `tests/e2e/replay.spec.ts` drives
  the demo in a browser.

## Install

Through the chassis kit installer (`scripts/install-kit.ts`):

```
npx vite-node scripts/install-kit.ts showcase-replay --to <entry-dir> --variant react
```

## Entry wiring

Mount the live app on `/` and, on `/watch`, a second session with
`ReplayControl`. Copy the saved `run-trace.json` to the public folder and pass
it (or a loader for it) as the `trace` prop.
