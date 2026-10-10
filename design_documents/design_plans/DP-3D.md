# DP-3D — The doorway week in three dimensions

> Plan 6 of 12. The single owner of the entry's signature 3D view: the scene description built from the domain model, the mapping of DP-UI's tokens onto materials, the live binding in both directions, the named camera shots, the recorder hooks, the `/lab` tuning page, the capability fallback, the performance probe and the vision-review loop.
> Chassis paths are written `../../hackathons/…`. Imports use the `src/…` alias. This plan reproduces the binding parts of the 3D contract and of the three-scene kit contract inside §5.11, so nothing has to be looked up elsewhere. The installed kit under `src/kits/three-scene/` is vendored: **no file in it is ever edited**; everything this plan adds is under `src/3d/`, `src/ui/pages/Lab.tsx` and `scripts/`.

## §0 Context & blockers

**Reason for the 3D view (one sentence):** the week is a landscape of arrivals over time — seven day-strips running away from the front door, each visit a pillar whose height is how long it lasted — so the one visit that did not belong stands up out of the rhythm and can be circled.

**Must already exist before WU-01 runs** (plans 1–5). Proof, each prints its own line:

```bash
npx vite-node scripts/verify/de-09-session.ts
npx vite-node scripts/verify/at-08-integration.ts
npx vite-node scripts/verify/ui-12-hero.ts
npx vite-node scripts/verify/ui-11-states.ts
```
Expected: `de-09-session: 12 checks OK`, `at-08-integration: 15 checks OK`, `ui-12-hero: 14 checks OK`, `ui-11-states: 16 checks OK`.

**Preflight (each line must print a path or a version):**
```bash
ls -d src/domain src/ui/tokens src/ui/scene hee/scripts/install-kit.ts ../../hackathons/kits/three-scene ../../hackathons/templates/3d-experience.spec.md ../../hackathons/_useful/scripts/visual_review.py
node --version
npx playwright --version
```
`@playwright/test` is already pinned at `1.62.1` by DP-UI. The headless Chromium of this plan has no GPU: every browser script launches it with the software-GL arguments of §5.10 and the page runs the kit's `quality="low"` mode; the headed-GPU numbers of the contract (50 fps) are measured only when the environment variable `THREE_D_HEADED=1` is set and a GPU exists. **CI mode is therefore: headless Chromium, SwiftShader, `quality=low`, fps threshold 20.**

**The visual review (WU-08)** calls a Gemini vision model through Vertex AI per the AI ACCESS contract; it is the only live step. Every other command is offline and deterministic.

**Libraries (installed by the kit, pinned in its manifest, WU-01):** `three` 0.186.1, `@react-three/fiber` 9.8.1, `@react-three/drei` 10.7.9, `@react-three/postprocessing` 3.1.3, `postprocessing` 6.39.5, `leva` 0.10.1 and `@types/three` 0.186.0 (dev). `react` and `react-dom` are already at 19.3.0 from DP-UI.

## §1 Purpose & requirement IDs

| ID | This plan's share |
|---|---|
| FR-20 | The signature 3D view: stoop and door, two camera frustums, seven day strips, visit pillars, incident arcs, evidence flares; live-bound to every action; named shots `overview`, `focus:<entity>`, `walk`; the `/lab` route; the capability fallback |
| FR-17 | Multi-camera visits: a visit whose hops cross more than one camera component is drawn as a thread between the frustums it passed through |
| NFR-07 | At least 50 fps headed (at least 20 fps headless software), fewer than 300 draw calls, zero renderer console errors or warnings |
| NFR-06 | `prefers-reduced-motion` makes camera moves jump and removes the highlight pulse; shots take 600–1200 ms otherwise |
| FR-19 | The hero frame of the product's first screenshot; every colour comes from DP-UI's tokens |
| HEE-KIT-01 | The kit is used as installed: adapter, tokens, renderers entries, hooks, lab and fallback come from the kit or from files in `src/3d/` |

## §2 Scope boundaries

**IN — files this plan creates or modifies:**

| Path | Purpose |
|---|---|
| `src/kits/three-scene/**` | the installed kit (written by `hee/scripts/install-kit.ts`, never edited) |
| `src/3d/layout.ts` | coordinates, pitches and the pillar-height rule |
| `src/3d/adapter.ts` | `toSceneDescription(model, revision?)` and `MATERIAL_TOKENS` |
| `src/3d/look.ts` | per-material roughness and metalness (the values the lab writes back) |
| `src/3d/tokens.ts` | `tokensFromRecord`, `readSceneTokens`, `useSceneTokens` |
| `src/3d/shots.ts` | `SHOT_IDS`, `OVERVIEW`, `WALK`, `shotsForScene`, `shotList` |
| `src/3d/bind.ts` | selection and highlight rules between the store and the scene |
| `src/3d/capability.ts` | `canRenderGl`, `renderQuality` |
| `src/3d/probe.ts` | `window.__scene3d` (read-only probe for tests and the recorder) |
| `src/3d/renderers/{camera-frustum,incident-arc,evidence-flare,visit-thread,probe-bridge}.tsx`, `src/3d/renderers/index.ts` | domain geometry as kit `renderers` entries |
| `src/3d/DoorwayScene.tsx` | the component DP-UI's hero slot loads |
| `src/3d/FlatWeekFallback.tsx` | the flat replica shown when WebGL is missing |
| `src/3d/lab-values.ts` | read the lab's current values and format them |
| `src/ui/pages/Lab.tsx` | the `/lab` page body (replaces DP-UI's shell; default export `LabPage`) |
| `scripts/verify/3d-kit.ts`, `scripts/verify/3d-01-adapter.ts` … `3d-08-review.ts` | verification |
| `scripts/3d-screenshots.ts` | the two review screenshots and their manifest |
| `design_documents/3d-screenshots/{overview,focus}.png`, `design_documents/3d-screenshots/manifest.json`, `design_documents/visual-review-3d.md`, `design_documents/visual-review/3d-<n>.json` | outputs |
| `package.json` | scripts `verify:3d`, `screenshots:3d`; the kit's dependencies (written by the install step and `npm install`) |

**OUT — owned elsewhere (do not write here):**
- Colours, fonts, radii, shadows, the `--scene-*` custom properties — DP-UI (this plan only reads them through `src/ui/tokens/tokens.ts` and the kit's `readTokensFromCss`).
- The hero slot, `SceneHost`, the stage toolbar and `data-demo-3d="unavailable"` for a missing module — DP-UI (`src/ui/scene/SceneHost.tsx`, `src/ui/panels/SceneStage.tsx`).
- The camera framing of the demo video — DP-SCRIPT (it only calls `window.__demo3d.play`).
- The browser-test harness and the acceptance run of items 1–5 of the 3D contract — DP-E2E-BROWSER-TESTING (this plan provides the hooks and the probe it reads).
- Domain rules, derivations and actions — DP-DOMAIN-ENGINE and DP-AGENT-WORKFLOW (this plan only reads the model and calls `set_ui`).

## §3 Interfaces owned (literal skeletons)

```ts
// src/3d/layout.ts — Requirement IDs: FR-20
import type { Vec3 } from "src/kits/three-scene/src/react/index.js";
export const DAY_PITCH = 1.6;            // metres between day-strip centres
export const DAY_W = 1.4;                // width of a day strip
export const STRIP_LEN = 8;              // metres for 24 hours; z = minute / 1440 * STRIP_LEN
export const WALL_Z = -0.5;              // the front wall (the street is on its +z side)
export const STRIP_Z0 = 1.6;             // z of midnight; the stoop and its step end at z = 1.55
export const PILLAR_DX = 0.2; export const TICK_DX = -0.45; export const DUP_DX = -0.2; export const OUTAGE_DX = 0.55;
export const BOUNDS: { min: Vec3; max: Vec3 };   // { min: [-6.5, 0, -1.0], max: [6.5, 3.6, 10.0] }
export function dayX(dayIndex: number): number;                 // (dayIndex - 3) * DAY_PITCH
export function minuteZ(minute: number): number;                // STRIP_Z0 + minute / 1440 * STRIP_LEN
export function pillarHeight(dwellMin: number): number;         // clamp(0.35 + 0.12 * dwellMin, 0.5, 3.0)
export function hopPosition(hop: string, deviceIds: string[]): Vec3;   // the apex of the frustum a "<deviceId>:<componentId>" hop belongs to

// src/3d/adapter.ts — Requirement IDs: FR-20, FR-17
import type { WeekModel } from "src/domain/types.js";
import type { SceneDescription } from "src/kits/three-scene/src/react/index.js";
export const SCENE_NAME = "doorway-week";
export const MATERIAL_TOKENS: readonly ["wall", "door", "stoop", "frustum", "pillar", "pillar-warn", "pillar-danger", "pillar-dup", "gap", "resolved", "arc"];
/** Pure and deterministic: the same model and revision give a deep-equal result; never reads the clock or a random source. */
export function toSceneDescription(model: WeekModel, revision?: number): SceneDescription;

// src/3d/look.ts — Requirement IDs: FR-20
export const LOOK: Record<(typeof import("src/3d/adapter.js").MATERIAL_TOKENS)[number], { roughness: number; metalness: number }>;

// src/3d/tokens.ts — Requirement IDs: FR-19, FR-20
import type { ThreeTokens } from "src/kits/three-scene/src/react/index.js";
/** Map the flat record of src/ui/tokens/tokens.ts (keys without "--") onto the kit's palette. A missing key falls back to the record's `accent` and warns once. */
export function tokensFromRecord(record: Record<string, string>): ThreeTokens;
export function readSceneTokens(root?: HTMLElement): ThreeTokens;       // the kit's readTokensFromCss over document.documentElement
export function useSceneTokens(): ThreeTokens;                           // re-reads when <html data-theme> changes (MutationObserver)

// src/3d/shots.ts — Requirement IDs: FR-20
import type { ShotDef, SceneDescription } from "src/kits/three-scene/src/react/index.js";
export const SHOT_IDS: readonly ["overview", "walk"];
export const OVERVIEW: ShotDef;   // name "overview", position [0, 4.2, 13.0], target [0, 0.5, 4.2], durationMs 900   // review round 1 fix: the 16:5 hero canvas shows the week at a low three-quarter angle instead of a distant high one
export const WALK: ShotDef;       // name "walk",     position [0, 1.65, 0.7],   target [0, 1.2, 8.0], durationMs 900
export function shotsForScene(scene: SceneDescription): ShotDef[];      // [OVERVIEW, WALK, ...one "focus:<id>" per entity, rules of §5.3]
export function shotList(model: WeekModel): ShotDef[];                   // shotsForScene(toSceneDescription(model))

// src/3d/bind.ts — Requirement IDs: FR-20
export function selectedIdOf(model: WeekModel): string | null;           // ui.selectedIncidentId, else "day:<selectedDay>", else null
export interface UiPatch { selectedDay?: number | null; selectedIncidentId?: string | null; shotId?: string }
export function uiPatchForSelection(model: WeekModel, id: string | null): UiPatch | undefined;   // undefined = not selectable
export function highlightFromLedger(model: WeekModel, lastSeq: number, sceneIds: ReadonlySet<string>): { ids: string[]; seq: number };
export const HIGHLIGHT_MS = 2400;

// src/3d/capability.ts — Requirement IDs: NFR-07
export function canRenderGl(canvasFactory?: () => { getContext(kind: string): unknown }): boolean;
export function renderQuality(search?: string, webdriver?: boolean): "low" | "high";   // ?quality=low|high wins, else webdriver ? "low" : "high"

// src/3d/probe.ts — Requirement IDs: NFR-07 (installed on window.__scene3d by DoorwayScene)
export interface ProbeData { ready: boolean; mode: "low" | "high"; revision: number; entities: import("src/kits/three-scene/src/react/index.js").SceneEntity[]; selectedId: string | null; highlightedIds: string[]; tokens: ThreeTokens }
export function installProbe(read: () => ProbeData): () => void;                       // sets window.__scene3d; the returned function removes it
export function attachGl(gl: import("three").WebGLRenderer, camera: import("three").Camera, controls: unknown): () => void;   // called by renderers/probe-bridge.tsx
export interface Scene3dProbe {
  ready(): boolean; mode(): "low" | "high"; revision(): number;
  entityCount(): number; entityIds(): string[]; entity(id: string): import("src/kits/three-scene/src/react/index.js").SceneEntity | undefined;
  selectedId(): string | null; highlightedIds(): string[]; tokens(): ThreeTokens;
  camera(): { position: [number, number, number]; target: [number, number, number] };
  drawCalls(): number; triangles(): number; frames(): number; memory(): { geometries: number; textures: number };
  project(id: string, offset?: [number, number, number]): { x: number; y: number } | null;   // client-space pixels of a point on an entity, or null when it is off screen
}

// src/3d/renderers/index.ts — Requirement IDs: FR-20, FR-17
import type { EntityRenderer } from "src/kits/three-scene/src/react/index.js";
export function createRenderers(deps: { tokens: ThreeTokens }): Record<"camera-frustum" | "incident-arc" | "evidence-flare" | "visit-thread" | "probe", EntityRenderer>;

// src/3d/DoorwayScene.tsx — Requirement IDs: FR-20 (props of blueprint C-39; showLab is additive)
export function DoorwayScene(props: { session: import("src/domain/session.js").Session; className?: string; showLab?: boolean }): React.JSX.Element;

// src/3d/FlatWeekFallback.tsx — Requirement IDs: NFR-07
export function FlatWeekFallback(props: { model: WeekModel }): React.JSX.Element;      // root carries data-demo-3d="unavailable"

// src/3d/lab-values.ts — Requirement IDs: FR-20
export function readLabValues(): import("src/kits/three-scene/src/react/index.js").LabTuning;      // from leva's store, flattened by the last path segment; DEFAULT_LAB_TUNING when the panel is not mounted
export function formatLabValues(v: import("src/kits/three-scene/src/react/index.js").LabTuning): string;   // JSON, two-space indent, keys in the order of DEFAULT_LAB_TUNING

// src/ui/pages/Lab.tsx
export default function LabPage(): React.JSX.Element;                                  // keeps the default export name that DP-UI's route table imports

// scripts/verify/3d-kit.ts
export const GL_ARGS: string[];                                                       // §5.10
export const FPS_MIN: number;                                                         // THREE_D_HEADED === "1" ? 50 : 20
export const VARIANCE_MIN: number;                                                    // 40
export interface ThreeRun { page: import("@playwright/test").Page; url: string; problems: string[]; close(): Promise<void> }   // problems = console messages of type error or warning
export function open3d(opts?: { path?: string; width?: number; height?: number; theme?: "light" | "dark"; quality?: "low" | "high"; reducedMotion?: boolean; init?: string }): Promise<ThreeRun>;
export function loadWeek(page: import("@playwright/test").Page): Promise<void>;          // presses "Load the sample week", waits for the ribbon ticks
export function waitScene(page: import("@playwright/test").Page): Promise<void>;         // waits for window.__scene3d.ready() and a first frame
export function variance64(page: import("@playwright/test").Page, selector: string): Promise<number>;   // luminance variance over a 64×64 grid of a screenshot of the element
export function settle(page: import("@playwright/test").Page, ms?: number): Promise<void>;   // waits until camera() stops changing for 250 ms (default timeout 3000)
```

## §4 Interfaces consumed (copy verbatim)

```ts
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import * as THREE from "three";
import { levaStore } from "leva";

import {
  ThreeScene, readTokensFromCss, defaultShots, validateSceneDescription, DEFAULT_LAB_TUNING, NEUTRAL_DEMO_TOKENS,
} from "src/kits/three-scene/src/react/index.js";
import type {
  SceneDescription, SceneEntity, Vec3, ThreeTokens, ShotDef, EntityRenderer, LabTuning, Demo3dApi,
} from "src/kits/three-scene/src/react/index.js";
import { detectRenderCapability } from "src/kits/three-scene/src/core/capability.js";

import type { WeekModel, Incident, Device, DoorEvent, Visit } from "src/domain/types.js";
import { weekRibbon, visitorThreads, dayIndexOf } from "src/domain/derive.js";
import type { RibbonDay } from "src/domain/derive.js";
import { candidateIncidents } from "src/domain/rules.js";
import { fmtClock, DAY_MS, MIN_MS } from "src/domain/time.js";
import { demoSeed, cleanSeed } from "src/domain/seed.js";
import type { Session } from "src/domain/session.js";

import { tokens as uiTokens, sceneTokenNames } from "src/ui/tokens/tokens.js";
import { useApp } from "src/ui/state/SessionProvider.js";
import { loadSampleWeek } from "src/ui/state/sampleWeek.js";
import { Surface, Button } from "src/ui/primitives/index.js";
```
Test-only: `import { chromium } from "@playwright/test"`, `import { ensureBuilt, createChecker, planBlock } from "./ui-kit.js"`, `import { CRAFT_ASSERTIONS } from "./ui-kit.js"`, `node:child_process`, `node:fs`, `node:crypto`.

Facts about the installed kit that the plan depends on (all read from `../../hackathons/kits/three-scene/src/`, none assumed):
- `ThreeScene` props: `scene, tokens, name, selectedId, highlightIds, onSelect, shots, renderers, quality ("high"|"low"), showLab, fallback, onReady`. The canvas uses `frameloop="demand"`; `quality="low"` drops the effect composer and the ambient occlusion.
- Every entity is drawn **centred on `position`** (box, cylinder, sphere, plane) and an `instanced` entity is a group at `position` whose instances are relative to it, each a box of the entity's `size`. A `custom` entity is a group at `position` with the click handler of the kit, whose children come from `renderers[customKey](entity, { selected, highlighted })` and nothing else.
- The kit appends a `focus:<id>` shot for **every** entity after the shots it is given, and its own are targeted at `position + size/2`. `CameraRig.play` uses `list.find`, so **the first shot with a name wins**: this plan passes its own `focus:<id>` shots first (§5.3); the kit's duplicates stay in `window.__demo3d.shots` and are never reached.
- `installDemoHooks` sets `data-demo-3d="<name>"` on the kit's wrapper element and installs `window.__demo3d = { play, shots, fpsProbe, ready }`; with no WebGL, `shots` is `[]`.
- Selecting from outside (`selectedId` changing) makes the kit play `focus:<selectedId>`.
- Under `prefers-reduced-motion` the kit's camera jumps (no smoothing).

## §5 Algorithms and literal configuration

### §5.1 Coordinates and the entity table (literal)

Metres. The front wall stands at `z = -0.5`; the street is on its `+z` side. The stoop and its step sit in front of the door; the week lies beyond them as seven strips running away from the door, one per day (Monday at `x = -4.8`, Sunday at `x = +4.8`), with midnight at `z = 1.6` and 24:00 at `z = 9.6` (so a calendar read top to bottom is the scene read from the door outwards). Everything is a function of `weekRibbon(model)` (a day is `RibbonDay`, minutes are minutes after local midnight) so that the 3D view and the paper calendar can never disagree.

| Entity id | kind | position (centre) | size | material token | Rule |
|---|---|---|---|---|---|
| `door-wall` | box | `[0, 1.6, -0.5]` | `[13, 3.2, 0.3]` | `wall` | always |
| `door` | box | `[0, 1.25, -0.3]` | `[1.3, 2.5, 0.12]` | `door` | always |
| `door-frame-left`, `door-frame-right` | box | `[∓0.75, 1.3, -0.32]` | `[0.2, 2.6, 0.2]` | `door` | always |
| `door-lintel` | box | `[0, 2.65, -0.32]` | `[1.7, 0.2, 0.2]` | `door` | always |
| `stoop` | box | `[0, 0.15, 0.35]` | `[3.0, 0.3, 1.4]` | `stoop` | always |
| `stoop-step` | box | `[0, 0.075, 1.3]` | `[3.0, 0.15, 0.5]` | `stoop` | always |
| `dev-<deviceId>` | custom `camera-frustum` | `[fx, 2.3, -0.2]` | `[1.8, 1.4, 3.4]` | `frustum` | one per device with `snapshot: true`, in `model.devices` order; `fx = (i − (n − 1) / 2) × 1.6`; `meta`: `deviceId`, `online`, `name` (the device description) |
| `day:<i>` (i = 0…6) | box | `[dayX(i), 0.02, 5.6]` | `[1.4, 0.04, 8]` | `stoop` | always; `label` = `MON`…`SUN`; `meta.dayIndex` |
| `quiet:<i>:<k>` | box | `[dayX(i), 0.045, minuteZ(mid)]` | `[1.4, 0.05, (to − from) / 1440 × 8]` | `gap` | one per `quietBands[k]` of day i; `opacity 0.55` |
| `ticks` | instanced | `[0, 0, 0]` | `[0.18, 0.02, 0.04]` | `pillar` | one instance per `ticks` entry of every day at `[dayX(i) + TICK_DX, 0.05, minuteZ(minute)]`; omitted when there are none |
| `dups` | instanced | `[0, 0, 0]` | `[0.12, 0.24, 0.12]` | `pillar-dup` | one instance per tick with `duplicate: true` at `[dayX(i) + DUP_DX, 0.12, minuteZ(minute)]`; omitted when there are none |
| `visits-routine` | instanced | `[0, 0, 0]` | `[0.2, 0.5, 0.2]` | `pillar` | one instance per ribbon visit **with** a `routineId` at `[dayX(i) + PILLAR_DX, 0.25, minuteZ((from + to) / 2)]`; omitted when there are none |
| `vis:<ms>` (the ribbon visit's id) | box | `[dayX(i) + PILLAR_DX, h / 2, minuteZ((from + to) / 2)]` | `[0.22, h, 0.22]` with `h = pillarHeight(to − from)` | `pillar-danger`, `pillar-warn` or `pillar` (§5.2) | one per ribbon visit **without** a `routineId`; `label` = `fmtClock(startMs, utcOffsetMin)` only when flagged; `meta`: `visitId`, `dwellMin`, `flag` (`"quiet"`, `"dwell"` or `"none"`) |
| `outage:<deviceId>:<i>:<fromMin>` | box | `[dayX(i) + OUTAGE_DX, 0.06, minuteZ(mid)]` | `[0.5, 0.06, minutes / 1440 × 8]` | `gap` | one per `outages` entry; `opacity 0.5`; `meta`: `deviceId`, `minutes` |
| `seam:<i>` | box | `[dayX(i), 0.06, minuteZ(seamMinute)]` | `[1.5, 0.08, 0.05]` | `frustum` | on the day whose `seamMinute` is not null; `label` = `from history` |
| `inc-<n>` | custom `incident-arc` | `[dayX(i), 0.08, minuteZ((from + to) / 2)]` | `[1.4, 0.2, max((to − from) / 1440 × 8 + 0.6, 1.0)]` | `pillar-warn` for `open` and `explained`, `resolved` for `resolved`, `gap` for `dismissed` | one per incident, at its **first** ribbon day; `meta`: `status`, `kind`, `dayIndex`, `title` |
| `flare:<incidentId>` | custom `evidence-flare` | `[dayX(i), 3.3, minuteZ((from + to) / 2)]` | `[0.3, 0.3, 0.3]` | `arc` | one per incident that has a `MediaRef`; `meta`: `incidentId`, `mediaId` |
| `thread:<visitId>` | custom `visit-thread` | `[dayX(i) + PILLAR_DX, 1.0, minuteZ(mid)]` | `[0, 0, 0]` | `arc` | one per `visitorThreads(model)` entry (visit with at least two distinct hops); `meta`: `visitId`, `hops` (joined by `,`), `sx sy sz ex ey ez` = the apexes of its first and last hop (`hopPosition`) |

`dayX`, `minuteZ`, `pillarHeight` and `hopPosition` are in `layout.ts`. `hopPosition(hop, deviceIds)` is `[(index − (n − 1) / 2) × 1.6 + ((componentId % 4) − 1.5) × 0.2, 2.3, -0.2]`, where `index` is the position of the hop's device among the frustum devices (a device that has no frustum maps to index 0). `bounds` is `BOUNDS`; `revision` is the second argument (default `0`). Entity order is the order of the table, with the entities of one row sorted by id. A model with no events yields every "always" row and the 14 `quiet` rows, so even an empty week has well over ten entities.

### §5.2 Pillar classification

`candidates = candidateIncidents(model)`. A non-routine visit is flagged `"quiet"` (material `pillar-danger`) when some candidate of kind `quiet_hours_activity` has an `eventIds` entry that is in the visit's `eventIds`; else `"dwell"` (`pillar-warn`) when some candidate of kind `long_dwell` does; else `"none"` (`pillar`). The visit's `eventIds` come from `model.visits` (matched by id). The classification depends on the model only, never on incidents, so a flagged visit stands out before anyone has opened an incident. Material `roughness` and `metalness` of every entity come from `LOOK[token]` (`look.ts`), except where a row names its own opacity.

`LOOK` (literal): `wall` 0.9 / 0.0, `door` 0.55 / 0.1, `stoop` 0.85 / 0.0, `frustum` 0.2 / 0.0, `pillar` 0.7 / 0.05, `pillar-warn` 0.5 / 0.05, `pillar-danger` 0.5 / 0.05, `pillar-dup` 0.6 / 0.05, `gap` 0.9 / 0.0, `resolved` 0.5 / 0.05, `arc` 0.35 / 0.1 (roughness / metalness).

### §5.3 Shots (literal)

`OVERVIEW` and `WALK` are the constants of §3. `shotsForScene(scene)` returns `[OVERVIEW, WALK, …focus]` with one `focus:<id>` shot per entity of the scene, each `durationMs: 900`, computed as follows (`c` is the entity's position, which is its centre):

| Entity id | target | position |
|---|---|---|
| `day:<i>` | `[dayX(i), 0.4, 5.6]` | `[dayX(i) + 4.2, 4.0, 0.6]` |
| `inc-<n>` | `c + [0, 0.3, 0]` | `target + [3.0, 2.8, 3.4]` |
| `vis:<ms>` | `c` | `c + [1.8, 1.6, 2.4]` |
| `flare:*`, `thread:*` | `c` | `c + [2.2, 1.8, 2.6]` |
| `dev-*` | `[c.x, 2.3, 1.4]` | `[c.x + 2.4, 3.0, 3.2]` |
| every other id | `c` | `c + normalise([0.6, 0.45, 0.65]) × min(max(size) × 2 + 3, 14)` |

The kit's own `focus:<id>` shots come after these in the list and are never reached (§4), which is why a stage's `window.__demo3d.shots` shows each focus name twice; both are harmless and the recorder's `play` takes the first.

### §5.4 Binding between the store and the scene

1. **Scene from the model.** `sceneKey(model) = ledger.length + ":" + (last ledger seq ?? 0) + ":" + events.length + ":" + incidents.length`. `DoorwayScene` rebuilds the description only when the key changes, so a selection (`set_ui`, which writes no ledger entry) never rebuilds it.
2. **Selection, scene to store.** `onSelect(id)` calls `uiPatchForSelection(model, id)`; `undefined` is ignored; otherwise `session.call("set_ui", patch, { source: "human" })`. The patch table: `null` → `{ selectedIncidentId: null, selectedDay: null }`; `day:<i>` → `{ selectedDay: i, selectedIncidentId: null }`; `inc-<n>` or `flare:inc-<n>` → `{ selectedIncidentId: id, selectedDay: incident.dayIndex ?? current, shotId: "focus:" + id }`; `vis:<ms>` or `thread:vis:<ms>` → the incident whose `eventIds` meet the visit's `eventIds` (newest id wins) treated as above, else `{ selectedDay: dayIndexOf(model, visit.startMs), selectedIncidentId: null }`; `quiet:<i>:*`, `outage:<d>:<i>:*` and `seam:<i>` → `{ selectedDay: i, selectedIncidentId: null }`; every other id (`door-*`, `stoop*`, `dev-*`, `ticks`, `dups`, `visits-routine`, `probe`) → `undefined`.
3. **Selection, store to scene.** `selectedId = selectedIdOf(model)`. Because the kit plays `focus:<selectedId>` whenever that value changes, selecting an incident or a day in the 2D page moves the camera with no further code.
4. **Camera, store to scene.** An effect on `model.ui.shotId` plays it with `window.__demo3d.play` when `window.__demo3d.shots` contains it (`overview`, `walk`, `focus:<id>`); an unknown shot is ignored silently. On first ready the effect plays `overview`.
5. **Highlight.** A ref keeps `lastSeq`, initialised to the current last ledger `seq` (history is never highlighted). When the ledger grows, `highlightFromLedger` returns the union of the new entries' `entityIds` that are scene ids and the new `seq`; `highlightIds` is set to it and cleared after `HIGHLIGHT_MS` (2400 ms; a new batch restarts the timer). Under `prefers-reduced-motion` `highlightIds` stays `[]`. The kit draws the emissive pulse on boxes and passes `highlighted` to custom renderers (§5.5).

### §5.5 Renderers (`createRenderers({ tokens })`; every colour is `tokens.materials[…]`, `tokens.accent` or `tokens.text`)

- **`camera-frustum`.** A four-sided cone of radius `0.9` and height `3.4`, `rotation [-π/2, 0, 0]`, `position [0, 0, 1.7]` (apex at the camera, base 3.4 m out), material `tokens.materials.frustum`, `transparent`, `opacity 0.18` when `meta.online` is true and `0.08` with colour `tokens.materials.gap` when false, `depthWrite false`; a small sphere of radius `0.07` at the apex in `tokens.materials.door`.
- **`incident-arc`.** A group at the entity's origin: a torus (`radius 0.68`, `tube 0.05`, `rotation [π/2, 0, 0]`, scaled `[1, 1, size[2] / 1.4]`, so it lies flat on the strip as an ellipse, the pencil circle of the paper calendar) in `tokens.materials[e.material.token]`; and a hit proxy `<mesh visible={false}>` box `[1.4, 0.1, size[2]]` at `y = 0.05` so a click on the strip inside the circle selects it. When `selected` the torus tube is `0.08`; when `highlighted` its emissive intensity pulses `0.3 + 0.3 sin(2π · 1.4 t)` for 2.4 s and keeps the frame loop alive with `invalidate`.
- **`evidence-flare`.** A sphere of radius `0.12` in `tokens.materials.arc`, `toneMapped false`, emissive intensity `0.8`; when `highlighted` the same pulse; a thin cylinder (`radius 0.01`) from it down to the strip.
- **`visit-thread`.** `QuadraticBezierLine` from `meta.s*` to `meta.e*` (absolute apexes minus the entity position) with its mid-point at the origin raised by `0.8`, `lineWidth 2`, colour `tokens.materials.arc`, `transparent`, `opacity 0.8`.
- **`probe`.** Renders `<ProbeBridge />`, which in an effect calls `attachGl(gl, camera, controls)` from `useThree` and returns its cleanup; it renders nothing.

### §5.6 Tokens

`tokensFromRecord(r)`: `background = r["scene-bg"]`, `ground = r["scene-ground"]`, `accent = r["scene-accent"]`, `text = r["scene-text"]`, `materials[name] = r["scene-mat-" + name]` for each of the eleven `MATERIAL_TOKENS`; a missing key takes `r.accent` and logs one `console.warn` per key. `readSceneTokens(root)` is `readTokensFromCss(root ?? document.documentElement)`. `useSceneTokens()` holds the result in state, and a `MutationObserver` on `document.documentElement` (attribute `data-theme`) reads again; the observer is disconnected on unmount. No hex literal appears anywhere under `src/3d/`.

### §5.7 `DoorwayScene` composition (in this order)

1. `model` through `useSyncExternalStore(session.store.subscribe, session.store.getState)`.
2. `desc = useMemo(() => toSceneDescription(model, session.store.revision()), [sceneKey(model)])`; `validateSceneDescription(desc)` is called in development and a failure throws with its first error.
3. `scene = { ...desc, entities: [...desc.entities, PROBE_ENTITY] }` with `PROBE_ENTITY = { id: "probe", kind: "custom", customKey: "probe", position: [0, 0, 0], size: [0, 0, 0], material: { token: "wall" } }`. The probe is not part of the description and is not counted by the probe's `entityCount`.
4. `shots = useMemo(() => shotsForScene(desc), [desc])`; `tokens = useSceneTokens()`; `renderers = useMemo(() => createRenderers({ tokens }), [tokens])`; `quality = renderQuality(location.search, navigator.webdriver)`.
5. `if (!canRenderGl()) return <FlatWeekFallback model={model} />`.
6. `<ThreeScene scene tokens name="doorway-week" selectedId={selectedIdOf(model)} highlightIds onSelect shots renderers quality showLab={props.showLab} fallback={<FlatWeekFallback model={model} />} onReady />` inside `<div className={props.className} style={{ width: "100%", height: "100%" }}>`.
7. `installProbe(() => ({ ready, mode: quality, revision, entities: desc.entities, selectedId, highlightedIds, tokens }))` in an effect; cleanup removes `window.__scene3d`.
8. The shot effect of §5.4 item 4.

### §5.8 The probe

`installProbe` sets `window.__scene3d` to an object that answers from the latest `ProbeData` and from the GL objects attached by `ProbeBridge`. `camera()` is the camera position and the controls' target (`controls.getTarget(new THREE.Vector3())`). `drawCalls()`, `triangles()` and `frames()` are `gl.info.render.calls`, `.triangles` and `.frame`; `memory()` is `gl.info.memory.geometries` and `.textures`. `project(id, offset)` finds the entity, takes `position + offset` (default `[0, 0, 0]`), projects it with the camera, converts to client pixels with the canvas's bounding rectangle and returns `null` when the point is outside `[-1, 1]` in clip space or behind the camera. Nothing here mutates the scene; the probe is read-only and carries no secret.

### §5.9 Capability and the flat fallback

`canRenderGl(factory = () => document.createElement("canvas"))` is true when the factory's `getContext("webgl2")` or `getContext("webgl")` returns a truthy value, false when both return null or either throws. `FlatWeekFallback({ model })`: `ribbon = weekRibbon(model)`; a `<div data-demo-3d="unavailable">` holding a paragraph `3D view unavailable — showing the flat week.` and an `<svg role="img" viewBox="0 0 700 230">` with `aria-label` `Flat week: {events} events across 7 days, {moments} moments to look at` (`events` = the sum of `eventCount`, `moments` = the total number of ribbon incidents). Column `i` is a `<g data-day={i}>` at `x = 10 + 96 i`, width 86, with the weekday text; per tick a `<line class="fb-tick">` from `x + 20` to `x + 34` at `y = 30 + minute / 1440 × 190`; per visit a `<rect class="fb-visit">` at `x + 62`, width 5; per ribbon incident an `<ellipse class="fb-circle">` at `cx = x + 43`, `rx = 41`, `ry = max(8, (to − from) / 2 / 1440 × 190 + 5)`. Colours are `var(--pencil)`, `var(--border)`, `var(--warning)` set as `stroke` or `fill` attributes; no hex literal. It sets no `window.__demo3d`.

### §5.10 Browser harness for the verification scripts

`GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]`. `open3d` calls `ensureBuilt()`, starts `startServer({ port: 0, config: { staticDir: "dist" }, env: { NODE_ENV: "test", AGENT_PROVIDER: "golden" } })`, launches `chromium.launch({ args: GL_ARGS })`, creates a context (viewport default 1280 × 720, `colorScheme` from `theme`, `reducedMotion` from the option) with an init script that sets `localStorage["dr-theme"]` and any `init` text, records every console message of type `error` or `warning` into `problems`, and goes to `path` (default `/?hook=1&quality=low`). `variance64` takes a PNG screenshot of the element, draws it into a canvas inside the page, samples a 64 × 64 grid, converts to luminance and returns the variance. `settle` polls `__scene3d.camera()` every 50 ms until it has not moved by more than `0.005` for 250 ms. The kit is installed with `npx vite-node hee/scripts/install-kit.ts three-scene --to . --variant react` followed by `npm install` (WU-01).

### §5.11 The binding contracts (reproduced)

> **Verbatim contract — 3D EXPERIENCE SPEC (§1,§4,§5,§7).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §1 The requirement

Every entry ships **at least one signature real-time 3D view** that:

1. renders the product's **own domain state** (the user's input, the agent's work, the result) and
   updates **live** when the human or the agent acts;
2. is **interactive**: orbit/zoom at minimum; selecting an object highlights the same entity
   in the 2D UI and the activity feed, and the reverse;
3. is reachable within **one click** of the landing screen and appears in the hero screenshot;
4. has a **reason to exist** in one sentence in the plan ("the plan is spatial", "the schedule is a
   landscape of load over time", "the evidence graph has depth and clusters").

##### §4 Quality floor (what makes 3D look professional, not like a tutorial)

1. **Light and colour:** ACES filmic (or AgX) tone mapping, sRGB output, an HDRI or `RoomEnvironment`
   image-based light, plus one key light that casts soft shadows. Never only an ambient light.
2. **Materials:** physically based (`MeshStandardMaterial` / `MeshPhysicalMaterial`), with roughness and
   metalness chosen per material. Colours come from the entry's token set (`cinematic-tokens.json` /
   the visual identity plan), so the 3D view and the UI share one palette.
3. **Depth cues:** contact shadows or SSAO, a ground plane, and at most a subtle fog. Antialiasing
   on (SMAA/MSAA).
4. **Camera:** named shots (`overview`, `focus:<entity>`, `walk`/`detail`) with eased transitions of
   600–1200 ms. On selection the camera frames the selected entity. No abrupt cuts.
5. **Performance:** ≥ 50 fps at 1280×720 on a mid-range laptop GPU for the demo scene. Repeated
   geometry is instanced. Draw calls stay under 300 for the demo scene. Rendering runs on demand
   (render on change) when idle.
6. **Robustness:** capability detection with a static fallback image and a clear message when WebGL/WebGPU is
   unavailable; a loading state with progress; `prefers-reduced-motion` disables auto-orbit and
   shortens transitions; zero console errors or warnings from the renderer.
7. **Labels:** text in the 3D view uses drei `Text`/`Html` or an HTML overlay. Text is never baked
   into textures.
8. **A tuning lab:** a hidden `/lab` route with live controls (`lil-gui` or `leva`) for lights,
   materials and camera, so the look is tuned by eye and the chosen values are copied back into code.

##### §5 Agent ↔ 3D link and recorder hooks

- Agent and human actions change the 3D scene visibly: a new or changed entity animates in, and the
  entity being worked on is highlighted with an accent outline or emissive pulse.
- The action surface (PRODUCT DEPTH SPEC §3) includes a view action (e.g. `set_view` / `focus_entity`)
  so the agent can show the human what it did.
- The canvas container carries `data-demo-3d="<name>"`, and the page exposes
  `window.__demo3d = { play(shot: string): void, shots: string[] }` so the existing video recorder can
  trigger smooth, repeatable camera moves. These are the hooks `../../hackathons/_useful/capture/recorder.mjs` already
  reads. Nothing in the video pipeline changes.

##### §7 What the entry must contain (design plan and acceptance)

- Exactly one design plan, `DP-3D`, owns the 3D view: the scene graph built from the domain model,
  the materials (derived from the DP-UI token set; DP-3D defines no new brand colours), the camera
  shots, the `window.__demo3d` hooks, the `/lab` route and the fallback. It imports the domain store
  from `DP-DOMAIN-ENGINE` and selection state from DP-UI. It sits immediately after DP-UI in the plan
  map.
- **Acceptance, run by DP-E2E-BROWSER-TESTING:** (1) the canvas renders non-blank: pixel variance
  above threshold across a 64×64 grid sample; (2) after a scripted agent action, the scene's entity
  count or a highlighted entity changes; (3) every named shot plays via `window.__demo3d.play` without
  errors; (4) an fps probe over 3 s in headed Chromium with GPU reports ≥ 50 (≥ 20 is accepted
  in headless software rendering, and the plan names which mode CI uses); (5) screenshots of the
  overview and one focus shot at 1280×720 are saved for the visual review.
- **Visual review:** DP-3D's final work unit sends those screenshots, the design brief and
  §4 of this spec to a Gemini vision model via Vertex (AI ACCESS SPEC). It asks for a 1–10 score
  and a ranked defect list against §4. Below 8, it fixes the top three defects and repeats, at most
  three rounds. Each round's screenshots, score and defects are recorded in
  `design_documents/visual-review-3d.md`.
> **Verbatim contract — HEE KIT THREE-SCENE SPEC.** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.


<!-- Requirement IDs: HEE-KIT-01 -->

#### SPEC — three-scene kit use in entries (DP-3D)

> Binding on every entry's DP-3D. The kit is vendored read-only under
> `hee/`; the entry never edits installed kit files.

1. Install the kit with `npx vite-node hee/scripts/install-kit.ts three-scene --to . --variant react`
   (or `--variant vanilla` for a non-React app), then run `npm install`.
2. Do not author the renderer, lights, effects, camera rig, fallback, lab
   panel or hooks from scratch: use the installed kit's components.
3. Write `src/3d/adapter.ts` exporting `toSceneDescription(model): SceneDescription`
   from the domain store, with a unit test proving the seed scenario yields at
   least 10 entities and passes `validateSceneDescription`.
4. Map the DP-UI token set onto the `--scene-*` custom properties in one CSS
   block (`--scene-bg`, `--scene-ground`, `--scene-accent`, `--scene-text` and
   every `--scene-mat-<name>` the scene uses).
5. Domain-specific geometry goes in `renderers` entries under
   `src/3d/renderers/`; never as edits to the installed kit files.
6. The `name` prop equals the plan's `### Signature 3D Experience` subject
   slug (e.g. `widget-bay`).
7. The hero layout mounts `ThreeScene` within one click of the landing screen.
8. Acceptance items 1–5 of `../../hackathons/templates/3d-experience.spec.md` §7 are asserted by
   DP-E2E-BROWSER-TESTING using `window.__demo3d.fpsProbe` (headless software
   rendering is the CI mode: Chromium with SwiftShader, `quality=low`,
   threshold 20 fps).
9. The visual review of DP-W07 runs on the overview and one focus shot.

> **Verbatim contract — HEE ART DIRECTION SPEC (Part B).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### Part B — visual review (DP-UI and DP-3D final work units)

5. DP-UI's last work unit runs
   `python hee/_useful/scripts/visual_review.py --screenshots <hero desktop> <one state> <mobile> --brief design_documents/design_brief.md --rules ../../hackathons/templates/ui-craft.spec.md --unit ui --round <n> --out design_documents/visual-review/ui-<n>.json --log-md design_documents/visual-review-ui.md`.
   DP-3D's final work unit runs
   `python hee/_useful/scripts/visual_review.py --screenshots <overview> <focus shot> --brief design_documents/design_brief.md --rules <the entry's inlined copy of the 3D spec> --rules-section "Quality floor" --unit 3d --round <n> --out design_documents/visual-review/3d-<n>.json --log-md design_documents/visual-review-3d.md`
   (the log file the 3D spec names). Images are sent as inline bytes; nothing
   is uploaded to a third party.
6. exit code 3 (score below threshold) → fix the top three defects and repeat,
   at most three rounds. exit code 3 is the deterministic signal from the
   caller-side threshold check; the tool itself only reports.
7. Each round's screenshots, score and defects are recorded in
   `design_documents/visual-review-ui.md` (DP-UI) and
   `design_documents/visual-review-3d.md` (DP-3D) via `--log-md`.
8. The model's score never gates anything by itself: the caller applies the
   threshold, and the report always carries the defects so a human can
   overrule a pass or a fix.
## §6 Failure modes

| Failure | What the visitor sees | Handling |
|---|---|---|
| No WebGL in the browser | the stage message `3D view unavailable` of DP-UI, or on `/lab` the flat week replica with `3D view unavailable — showing the flat week.` | `canRenderGl()` before `ThreeScene` is mounted; `data-demo-3d="unavailable"`; no `window.__demo3d` |
| The module `src/3d/DoorwayScene.tsx` throws on import or render | DP-UI's stage message; the flat week below it stays | `SceneHost` catches (DP-UI §6.9) |
| A `custom` entity has no renderer | the kit draws nothing for it | `createRenderers` returns all five keys, WU-05 check 1 asserts them |
| A shot name is unknown | nothing moves | the kit warns once and ignores; `shots` is checked before `play` in the store effect |
| The incident of `ui.shotId` no longer exists (undo) | the camera stays where it is | the effect plays only shots that are listed |
| A token is missing from the CSS | the value of `accent` is used and one warning is logged | `tokensFromRecord`; WU-02 check 6 |
| Theme switched while the scene is mounted | colours change within a second | `useSceneTokens` observer; WU-03 check 11 |
| The week has no events | the door, stoop, strips and quiet bands are drawn; no pillars | the "always" rows of §5.1 |
| An incident spans midnight | one arc, on its first day | the first-occurrence rule of §5.1 |
| Two entities would share an id | the description is rejected | `validateSceneDescription` in development; WU-01 check 3 |
| Reduced motion | the camera jumps, no pulse | kit behaviour plus `highlightIds = []` |
| Software GL is slow | the headless fps threshold is 20, `quality=low` | `renderQuality`, WU-07 |
| The review tool is unavailable | the unit is reported blocked, not passed | WU-08 check 8 |

## §7 Work units

Conventions for every unit: scripts live in `scripts/verify/`, start with `import { createChecker } from "./ui-kit.js"`, call `const c = createChecker("3d-NN-name")`, end with `c.done()` (which prints `<name>: N checks OK` and exits 0, or prints `FAIL <label>` lines and exits 1). Browser scripts use `open3d` from `./3d-kit.js` and call `await run.close()` in a `finally`. The check lists below are the contract: every numbered check is one `c.ok` or `c.eq` call whose label starts with that number. A script written in an earlier unit must keep passing after every later unit (so a check never asserts that something added later is absent). The model in a browser script is read with `readModel(page)` of `ui-kit.ts`, and `loadWeek`, `waitScene` and `settle` come from `3d-kit.ts`.

### WU-3D-01 — the kit, the layout and `toSceneDescription`
- **Goal:** the three-scene kit is installed as shipped, and `toSceneDescription` turns any `WeekModel` into a valid scene of the door, the stoop, seven day strips, the camera frustums, quiet bands, ticks, pillars, outages and the history seam.
- **Steps:**
  1. Run `npx vite-node hee/scripts/install-kit.ts three-scene --to . --variant react`, then `npm install`. Confirm `src/kits/three-scene/src/react/index.ts` exists. Do not edit anything under `src/kits/`.
  2. Write `src/3d/layout.ts` (§3, §5.1), `src/3d/look.ts` (the table of §5.2) and `src/3d/adapter.ts` with every row of the §5.1 table **except** `inc-*`, `flare:*` and `thread:*` (WU-05 adds them) and `MATERIAL_TOKENS`, `SCENE_NAME`.
  3. Write `scripts/verify/3d-01-adapter.ts`: pure Node, no browser. It builds the models `demoSeed()`, `cleanSeed()` and `{ ...demoSeed(), events: [], visits: [] }`.
- **Files:** `src/kits/three-scene/**` (installed), `package.json`, `package-lock.json`, `src/3d/{layout,look,adapter}.ts`, `scripts/verify/3d-01-adapter.ts`.
- **Checks (15):**
  1. `src/kits/three-scene/src/react/index.ts`, `src/kits/three-scene/src/core/scene-description.ts` and `src/kits/three-scene/UPSTREAM-NOTICE.md` exist.
  2. `package.json` lists `three` `0.186.1`, `@react-three/fiber` `9.8.1`, `@react-three/drei` `10.7.9`, `@react-three/postprocessing` `3.1.3`, `postprocessing` `6.39.5` and `leva` `0.10.1` under `dependencies`, and `@types/three` `0.186.0` under `devDependencies`, each with no range prefix.
  3. `validateSceneDescription(toSceneDescription(m))` is `{ ok: true }` for the demo, clean and empty models.
  4. The three scenes each have at least 10 entities, and the empty-week scene has no entity whose id is `ticks`, `dups` or `visits-routine` or starts with `vis:`.
  5. Every entity id of the demo scene matches `^(door-wall|door|door-frame-left|door-frame-right|door-lintel|stoop|stoop-step|day:[0-6]|quiet:[0-6]:\d+|vis:\d+|visits-routine|ticks|dups|outage:[\w-]+:[0-6]:\d+|seam:[0-6]|dev-[\w-]+)$` (WU-05 widens the pattern in its own script, not here).
  6. The seven door and stoop entities equal the literal rows of §5.1 (position, size, material token) by deep equality.
  7. The seven `day:<i>` entities have position `[(i − 3) × 1.6, 0.02, 5.6]`, size `[1.4, 0.04, 8]`, and labels `MON` to `SUN` in order.
  8. There is one `dev-<id>` entity per device with `snapshot: true`, each `custom` with `customKey: "camera-frustum"`, `meta.deviceId` equal to the device id, `meta.online` equal to the device's `online`, and `position[0]` equal to `(i − (n − 1) / 2) × 1.6`.
  9. The `ticks` instance count equals the sum of `ticks.length` over `weekRibbon(demoSeed())`, the `dups` count equals the number of ticks with `duplicate: true` (at least 1), and the first tick's instance position is `[dayX(i) − 0.45, 0.05, minuteZ(minute)]`.
  10. The number of `vis:*` entities equals the ribbon visits without a `routineId`, the `visits-routine` instance count equals those with one, and the two add up to the ribbon's visit total.
  11. The first `vis:*` entity has `position[0] = dayX(i) + 0.2`, `position[1] = size[1] / 2`, `size[1] = pillarHeight(dwell)` and `position[2] = minuteZ(mid)`; `pillarHeight(0)` is `0.5`, `pillarHeight(5)` is `0.95` and `pillarHeight(30)` is `3`.
  12. For every candidate of kind `quiet_hours_activity` the pillar of its visit has material `pillar-danger` and `meta.flag` `quiet`; for every `long_dwell` candidate (and not a quiet one) `pillar-warn` and `dwell`; every other pillar has `pillar` and `none`.
  13. The `outage:*` entity count equals the sum of `outages.length` over the ribbon, each has `size[2]` equal to `minutes / 1440 × 8`, material `gap` and `opacity` below 1; there is exactly one `seam:*` entity, at `z = minuteZ(seamMinute)`, with label `from history`, when exactly one day has a non-null `seamMinute`.
  14. Two calls with the same model and revision are deep-equal as JSON, the model's JSON is unchanged by the call, and `src/3d/adapter.ts` and `src/3d/layout.ts` contain none of `Math.random`, `Date.now`, `new Date` and `performance.now`.
  15. `bounds` equals `BOUNDS` (`[-6.5, 0, -1.0]` to `[6.5, 3.6, 10.0]`), every entity position lies inside it, and `revision` is `0` by default and `7` when `7` is passed.
- **Verify:** `npx vite-node scripts/verify/3d-01-adapter.ts`
- **Expected output:** `3d-01-adapter: 15 checks OK`
- **Proves:** the kit is present exactly as shipped and pinned, and the scene is a pure function of the week the paper calendar already draws, so the two cannot disagree.

### WU-3D-02 — tokens become materials
- **Goal:** the scene's palette is DP-UI's palette, read from the same custom properties in both themes, and no colour is invented in `src/3d/`.
- **Steps:**
  1. Write `src/3d/tokens.ts` (§5.6).
  2. Write `scripts/verify/3d-02-tokens.ts` (pure Node: it reads `src/ui/tokens/tokens.ts`, `src/ui/tokens/tokens.css` and the source files).
- **Files:** `src/3d/tokens.ts`, `scripts/verify/3d-02-tokens.ts`.
- **Checks (12):**
  1. `MATERIAL_TOKENS` equals `wall, door, stoop, frustum, pillar, pillar-warn, pillar-danger, pillar-dup, gap, resolved, arc`, in that order.
  2. In both themes of `uiTokens`, the four keys `scene-bg`, `scene-ground`, `scene-accent`, `scene-text` and the eleven keys `scene-mat-<name>` exist, and every one is listed in `sceneTokenNames`.
  3. In `src/ui/tokens/tokens.css`, the second `:root` block and the `[data-theme="dark"]` block each contain both `--scene-bg` and `--accent` (the scene palette is written in the same block as the brand tokens).
  4. `tokensFromRecord(uiTokens.light)` has background `#EBE4D3`, ground `#D8CDB6`, accent `#1B6A62`, text `#221D16`; for `uiTokens.dark` they are `#0C1012`, `#2A343A`, `#5CC0B3`, `#EFE9DC`.
  5. `tokensFromRecord(r).materials` has exactly the eleven keys of check 1 and each value equals `r["scene-mat-" + key]`, in both themes.
  6. With `scene-mat-arc` removed from the record, `materials.arc` equals the record's `accent`, and calling the function twice logs exactly one `console.warn`.
  7. `LOOK` equals the table of §5.2 value for value, and every roughness and metalness is within `[0, 1]`.
  8. Every entity of `toSceneDescription(demoSeed())` has `material.roughness` equal to `LOOK[token].roughness` and `material.metalness` equal to `LOOK[token].metalness`.
  9. In each theme the six colours of `pillar`, `pillar-warn`, `pillar-danger`, `pillar-dup`, `resolved` and `arc` are pairwise different.
  10. In each theme the same six colours have a contrast of at least `3` against `scene-ground` (`contrast` of `scripts/lib/color.ts`).
  11. No file under `src/3d/` contains a colour literal (`#` followed by 3, 4, 6 or 8 hexadecimal digits) once comments are removed.
  12. No file under `src/3d/` imports from `src/ui/` except `src/ui/tokens/tokens.js`.
- **Verify:** `npx vite-node scripts/verify/3d-02-tokens.ts`
- **Expected output:** `3d-02-tokens: 12 checks OK`
- **Proves:** one palette serves the page and the scene in both themes, every scene colour is distinguishable and readable against the ground, and the 3D code owns no colour of its own.

### WU-3D-03 — the scene mounts, follows the store and selects in both directions
- **Goal:** `DoorwayScene` fills the hero slot, renders the demo week, rebuilds only when the week changes, recolours on a theme change, and keeps the 2D selection and the 3D selection in step.
- **Steps:**
  1. Write `src/3d/capability.ts`, `src/3d/bind.ts`, `src/3d/probe.ts`, `src/3d/renderers/{probe-bridge,camera-frustum}.tsx`, `src/3d/renderers/index.ts` (all five keys; `incident-arc`, `evidence-flare` and `visit-thread` return `null` until WU-05), `src/3d/FlatWeekFallback.tsx` (the unavailable root and message only; WU-07 completes it) and `src/3d/DoorwayScene.tsx` per §5.4 items 1–3 and 5, §5.7 items 1–7 (without `shots`; WU-04 adds them).
  2. Write `scripts/verify/3d-kit.ts` (§3 and §5.10) and `scripts/verify/3d-03-mount.ts`.
- **Files:** `src/3d/{capability,bind,probe}.ts`, `src/3d/renderers/*`, `src/3d/FlatWeekFallback.tsx`, `src/3d/DoorwayScene.tsx`, `scripts/verify/3d-kit.ts`, `scripts/verify/3d-03-mount.ts`.
- **Checks (15):**
  1. After `loadWeek`, exactly one element has `[data-demo-3d]`, its value is `doorway-week`, and the page has a `canvas` at least 600 px wide; the probe's `mode()` is `low` by default.
  2. The stage no longer shows the text `3D view unavailable`.
  3. `__scene3d.entityCount()` equals the entity count of `toSceneDescription(model)` computed in Node from the same model, and the sorted `entityIds()` are equal.
  4. After a 3 s idle and two theme switches `problems` is `[]` (no renderer console error or warning).
  5. `variance64(page, "canvas")` is at least `VARIANCE_MIN`.
  6. After `openFirstCandidate()` the probe's `revision()` is larger than before it.
  7. Clicking the screen point returned by `project("day:2", [-0.65, 0.05, 0])` sets `ui.selectedDay` to `2` and `[data-day="2"]` has `aria-pressed="true"`.
  8. After `openFirstCandidate()`, clicking `project(<the pillar of the first candidate's visit>, [0, h / 2, 0])` sets `ui.selectedIncidentId` to the id that call returned, and the `.pencil-circle` of that incident has `aria-pressed="true"`.
  9. Pressing that `.pencil-circle` makes `__scene3d.selectedId()` equal the incident id; after `set_ui { selectedIncidentId: null }`, pressing `[data-day="4"]` makes it `day:4`.
  10. After `set_ui { selectedDay: null, selectedIncidentId: null }`, `selectedId()` is `null`.
  11. Clicking `Dusk` makes `__scene3d.tokens().background` equal `#0C1012` within 1 s without a reload, and clicking `Paper` makes it `#EBE4D3`.
  12. `revision()` is unchanged by a `set_ui` action (selection never rebuilds the scene).
  13. Navigating by the history API from `/` to `/watch` and back leaves exactly one `[data-demo-3d]` and a defined `window.__demo3d`, and `problems` stays `[]`.
  14. Changing the viewport from 1280 × 720 to 1024 × 700 keeps the canvas width within 2 px of the stage well's inner width.
  15. With `?quality=high` the scene renders with `mode()` equal to `high`, `variance64` at least `VARIANCE_MIN` and `problems` `[]`.
- **Verify:** `npx vite-node scripts/verify/3d-03-mount.ts`
- **Expected output:** `3d-03-mount: 15 checks OK`
- **Proves:** the hero slot shows the product's own week, stays in step with every action without rebuilding on a click, and a selection made in the page or in the canvas reaches the other.

### WU-3D-04 — named shots and the recorder hooks
- **Goal:** `overview`, `walk` and `focus:<entity>` exist with eased 600–1200 ms moves, are reachable through `window.__demo3d.play`, the stage toolbar and the agent's `set_camera_shot`, and `data-demo-3d` carries the scene's name.
- **Steps:**
  1. Write `src/3d/shots.ts` (§3, §5.3), pass `shots` to `ThreeScene`, and add the `ui.shotId` effect of §5.4 item 4 (play `overview` on first ready).
  2. Write `scripts/verify/3d-04-shots.ts`.
- **Files:** `src/3d/shots.ts`, `src/3d/DoorwayScene.tsx`, `scripts/verify/3d-04-shots.ts`.
- **Checks (14):**
  1. `SHOT_IDS` equals `["overview", "walk"]`, and `OVERVIEW` and `WALK` equal the literals of §3 with `durationMs` `900`.
  2. `shotsForScene(scene)` has `2 + entities.length` entries, unique names, `overview` first and `walk` second, one `focus:<id>` per entity, and only finite coordinates.
  3. For `day:3` the shot is position `[4.2, 4, 0.6]`, target `[0, 0.4, 5.6]`; for the first `dev-*` entity the target is `[c.x, 2.3, 1.4]`; for `door` the distance from position to centre is `8` within `1e-6`.
  4. `shotList(model)` deep-equals `shotsForScene(toSceneDescription(model))`.
  5. In the browser `window.__demo3d.ready` is `true` and `shots` starts with `overview` then `walk`.
  6. Playing `overview`, `walk`, `focus:day:3` and `focus:door` produces no new `problems`, and after `settle` the camera is within `0.05` of each shot's position and target.
  7. From `overview`, `play("walk")` brings the camera within `0.05` of the walk pose between 500 ms and 1400 ms after the call (polled every 50 ms).
  8. In a context with `reducedMotion: "reduce"`, `play("walk")` reaches the walk pose within 250 ms.
  9. `play("nonsense")` leaves the camera where it was, logs exactly one warning containing `unknown shot`, and does not throw (that one warning is removed from `problems` before the check of no problems).
  10. The scene name is `doorway-week`: `SCENE_NAME`, the `data-demo-3d` value and the slug named in `design_documents/master_blueprint_entry.md` agree, and `design_documents/winning_project_plan.md` contains `### Signature 3D Experience`.
  11. `session.call("set_camera_shot", { shot: "walk" }, { source: "human" })` brings the camera to the walk pose within 1.5 s, and `{ shot: "overview" }` back to the overview pose.
  12. The stage buttons `Walk` and `Overview` bring the camera to their poses within 1.5 s.
  13. Setting `ui.shotId` to `focus:` followed by the id of a flagged visit pillar moves the camera target to within `0.05` of that pillar's centre.
  14. On first load, with no interaction, the camera reaches the overview pose within 1.5 s.
- **Verify:** `npx vite-node scripts/verify/3d-04-shots.ts`
- **Expected output:** `3d-04-shots: 14 checks OK`
- **Proves:** every shot the video, the agent or a visitor can ask for exists, moves smoothly (or jumps under reduced motion), and an unknown name does nothing.

### WU-3D-05 — incident arcs, evidence flares, visit threads and the highlight
- **Goal:** the moments the agent opens are drawn on the week as pencil circles, with an evidence flare when a snapshot exists and a thread across the cameras for a multi-camera visit; the entity being worked on pulses.
- **Steps:**
  1. Add the rows `inc-*`, `flare:*` and `thread:*` of §5.1 to `adapter.ts` (the first-occurrence rule included) and write `src/3d/renderers/{incident-arc,evidence-flare,visit-thread}.tsx` per §5.5, replacing the `null` renderers.
  2. Write `scripts/verify/3d-05-arcs.ts` (Node checks first, then the browser).
- **Files:** `src/3d/adapter.ts`, `src/3d/renderers/{incident-arc,evidence-flare,visit-thread,index}.tsx`, `scripts/verify/3d-05-arcs.ts`.
- **Checks (14):**
  1. After `openFirstCandidate()` the scene has an entity `inc-<id>` with `kind: "custom"`, `customKey: "incident-arc"`, material `pillar-warn`, `meta.status` `open`, `meta.title` equal to the incident's title, `position[0]` equal to `dayX(dayIndex)`, `position[2]` equal to `minuteZ(mid)` and `size[2]` equal to `max((to − from) / 1440 × 8 + 0.6, 1)`.
  2. `createRenderers({ tokens })` has the keys `camera-frustum`, `incident-arc`, `evidence-flare`, `visit-thread` and `probe`, each a function.
  3. After `set_incident_status` to `resolved` the arc's material is `resolved`, to `dismissed` it is `gap`, and to `explained` it is `pillar-warn`.
  4. An incident opened with `withSnapshot: true` has an entity `flare:<id>` with material `arc` and `position[1]` `3.3`; one opened with `withSnapshot: false` has none.
  5. In Node, for the demo model the number of `thread:*` entities equals `visitorThreads(model).length`, and each entity's `meta.hops` equals that thread's hops joined by `,` and its id is `thread:` followed by the visit id.
  6. In Node, a model whose incident runs from 23:30 on one day to 00:30 on the next has exactly one `inc-*` entity for it, on the first day, and the description validates.
  7. In the browser the entity count rises by exactly 2 after `openFirstCandidate()` (arc and flare) and by exactly 1 after an `open_incident` with `withSnapshot: false`.
  8. Clicking `project(<arc id>, [-0.1, 0.05, 0])` sets `ui.selectedIncidentId` to the arc's incident, `ui.shotId` to `focus:<id>`, the matching `.pencil-circle` to `aria-pressed="true"`, and the camera target within `0.05` of the arc's focus target.
  9. After `set_incident_status` the arc's id is in `highlightedIds()` within 300 ms, still in it at 2.0 s, and the list is empty by 3.2 s.
  10. In a context with `reducedMotion: "reduce"` the same action leaves `highlightedIds()` empty.
  11. The canvas screenshot at `overview` and at `walk` have different SHA-256 values and each has `variance64` at least `VARIANCE_MIN`.
  12. After `play("walk")` and `settle`, the camera's `y` is between `1.5` and `1.8` and `target.z − position.z` is greater than `5`.
  13. Each additional incident adds at most 6 draw calls (measured on a settled frame before and after opening three).
  14. `problems` is `[]` throughout.
- **Verify:** `npx vite-node scripts/verify/3d-05-arcs.ts`
- **Expected output:** `3d-05-arcs: 14 checks OK`
- **Proves:** the one visit that did not belong becomes a pencil circle in the landscape, evidence and cross-camera paths are visible, and what the agent touches lights up for a moment and then stops.

### WU-3D-06 — the `/lab` tuning page
- **Goal:** `/lab` shows the scene large with the kit's live controls and a way to copy the chosen values back into code, and is reachable only by its address.
- **Steps:**
  1. Write `src/3d/lab-values.ts` (§3) and `src/ui/pages/Lab.tsx`: `<main data-demo-focus="lab">` with the `h1` `Tuning lab`, the sentence `Adjust the light, materials and camera by eye, then copy the values into src/3d/look.ts.`, a `Surface` well (aspect 16:9, min-height 540 px) holding `<DoorwayScene session showLab />`, a side column with the `Overview` and `Walk` buttons (calling `window.__demo3d.play`), a `Surface` well `<pre data-lab-values>` showing `formatLabValues(readLabValues())` refreshed every 250 ms, and a primary `Copy values` button that writes it to the clipboard and shows `Copied.` for two seconds. On mount the page calls `loadSampleWeek(session)` when the model has no events. With `?hook=1` it sets `window.__lab = { levaStore, read: readLabValues }`.
  2. Write `scripts/verify/3d-06-lab.ts`.
- **Files:** `src/3d/lab-values.ts`, `src/ui/pages/Lab.tsx`, `scripts/verify/3d-06-lab.ts`.
- **Checks (12):**
  1. `/lab?hook=1&quality=low` has exactly one `[data-demo-focus="lab"]`, exactly one `[data-demo-3d]`, a `canvas`, and `__scene3d.entityCount()` above 10.
  2. The Leva panel's text contains `keyIntensity`, `keyAzimuth`, `keyElevation`, `hemisphere`, `roughness`, `metalness`, `fov`, `aoIntensity` and `aoRadius`.
  3. `window.__lab.read()` deep-equals `DEFAULT_LAB_TUNING` before any change.
  4. After `window.__lab.levaStore.setValueAtPath("Light.keyIntensity", 4, true)`, `read().keyIntensity` is `4`, `[data-lab-values]` contains `"keyIntensity": 4` within 1 s, and the canvas screenshot's SHA-256 differs from the one taken before.
  5. Pressing `Copy values` (with clipboard permission granted) leaves in the clipboard JSON with exactly nine numeric keys equal to `read()`.
  6. In Node, `formatLabValues(DEFAULT_LAB_TUNING)` has its keys in the order of `DEFAULT_LAB_TUNING`, uses two-space indentation and has no trailing newline.
  7. On `/` there is no `a[href="/lab"]` and no element whose class contains `leva`.
  8. The page's `h1` reads `Tuning lab`, and pressing `Overview` and `Walk` moves the camera to the two poses within 1.5 s.
  9. At 1440 × 900, in both themes, the scene well is at least 900 px wide and 540 px tall and nothing overflows horizontally.
  10. All nine assertions of `CRAFT_ASSERTIONS` pass on `/lab` at 1440 × 900 in both themes.
  11. The visible text of `/lab` has no `bannedHits`.
  12. `src/ui/pages/Lab.tsx` has `export default function LabPage` and `src/ui/routes.tsx` still imports it by the path `src/ui/pages/Lab.js` with no change.
- **Verify:** `npx vite-node scripts/verify/3d-06-lab.ts`
- **Expected output:** `3d-06-lab: 12 checks OK`
- **Proves:** the look can be tuned by eye in the real scene, the chosen numbers can be carried into code, and the page stays out of the product's navigation.

### WU-3D-07 — the capability fallback and the performance probe
- **Goal:** without WebGL the visitor gets the flat week instead of a blank box, and with it the scene meets the frame-rate, draw-call, idle-render and leak limits of the contract in CI mode.
- **Steps:**
  1. Complete `src/3d/FlatWeekFallback.tsx` per §5.9.
  2. Write `scripts/verify/3d-07-capability.ts`. The no-WebGL cases use the init script `HTMLCanvasElement.prototype.getContext = function () { return null }`.
- **Files:** `src/3d/FlatWeekFallback.tsx`, `scripts/verify/3d-07-capability.ts`.
- **Checks (12):**
  1. `canRenderGl` returns `false` for a factory whose `getContext` returns `null`, `true` for one that returns an object for `"webgl2"` only, and `false` for one that throws.
  2. `renderQuality("?quality=high", true)` is `high`, `renderQuality("?quality=low", false)` is `low`, `renderQuality("", true)` is `low`, `renderQuality("", false)` is `high`, and `renderQuality("?quality=x", true)` is `low`.
  3. With no WebGL, `/` shows the stage message `3D view unavailable`, the stage has `data-demo-3d="unavailable"`, and `window.__demo3d` is undefined.
  4. With no WebGL, `/lab?hook=1` shows a root `[data-demo-3d="unavailable"]` with the text `3D view unavailable — showing the flat week.` and an `svg[role="img"]` whose `aria-label` starts `Flat week: `.
  5. In that view, after `openFirstCandidate()`, the counts of `.fb-tick`, `.fb-visit` and `.fb-circle` equal the sums of ticks, visits and incident entries of `weekRibbon(model)`.
  6. The replica contains no `#` colour literal in its markup, and at 390 px wide it does not overflow horizontally.
  7. `await __demo3d.fpsProbe(3000)` is at least `FPS_MIN` (the label includes the measured value; `FPS_MIN` is 20, and 50 when `THREE_D_HEADED` is `1`).
  8. With the demo week and three incidents open, `drawCalls()` after a settled frame is below 300.
  9. After one idle second `frames()` has grown by at most 2 (rendering is on demand).
  10. Toggling one incident between `open` and `explained` 20 times grows `memory().geometries` by at most 10 and leaves `drawCalls()` within 2 of its earlier value.
  11. A low-quality frame has `triangles()` between 1 and 200 000.
  12. `problems` is `[]` across every shot, both themes, a viewport change and the fps probe.
- **Verify:** `npx vite-node scripts/verify/3d-07-capability.ts`
- **Expected output:** `3d-07-capability: 12 checks OK`
- **Proves:** a browser that cannot draw the doorway still shows the week, and the scene stays within the frame-rate, draw-call and memory limits in the mode CI uses.

### WU-3D-08 — the vision review loop
- **Goal:** the overview and one focus shot at 1280 × 720 are saved, and an independent vision-model review scores them at least 8 within three rounds, each round logged.
- **Steps:**
  1. Write `scripts/3d-screenshots.ts`: `open3d({ path: "/?hook=1&quality=high", width: 1280, height: 720, theme: "light" })`, `loadWeek`, `openFirstCandidate()`, `play("overview")`, `settle`, full-page screenshot to `design_documents/3d-screenshots/overview.png`; then `set_camera_shot` with `shot: "focus"` and that incident, `settle`, `focus.png`. It writes `design_documents/3d-screenshots/manifest.json` (`[{ file, width, height, shot, quality, camera, stageVisible, daysInView, consoleErrors }]`, `daysInView` = the number of `day:<i>` ids for which `project` is not `null`) and prints each path then `3d-screenshots: 2 written`. Add the package scripts `screenshots:3d` and `verify:3d` (the eight scripts of this plan in order, joined by `&&`).
  2. Write `scripts/verify/3d-08-review.ts`: runs the screenshot script, checks the files and the manifest, then runs `python3 hee/_useful/scripts/visual_review.py --screenshots design_documents/3d-screenshots/overview.png design_documents/3d-screenshots/focus.png --brief design_documents/design_brief.md --rules ../../hackathons/templates/3d-experience.spec.md --rules-section "Quality floor" --unit 3d --round <n> --out design_documents/visual-review/3d-<n>.json --log-md design_documents/visual-review-3d.md` with `n` from `UI_REVIEW_ROUND` (default `1`). Exit `0` passes; exit `3` (score below 8.0) means: fix the top three defects named in `design_documents/visual-review-3d.md` in `src/3d/` (usually the camera poses, the pillar heights, `LOOK`, or the lab values) and re-run with `n` increased, at most three rounds; exit `1` prints `visual review unavailable: <reason>` and marks the unit blocked, not passed.
- **Files:** `scripts/3d-screenshots.ts`, `scripts/verify/3d-08-review.ts`, `design_documents/3d-screenshots/*`, `design_documents/visual-review-3d.md`, `design_documents/visual-review/3d-<n>.json`, `package.json`.
- **Checks (10):**
  1. The screenshot script writes `overview.png` and `focus.png`, each starting with the PNG signature and each `1280 × 720`.
  2. Each image has `variance64` of at least `VARIANCE_MIN` (the image is drawn into a canvas in the browser), and the two SHA-256 values differ.
  3. The manifest entry for `overview.png` has `shot` `overview` and a camera within `0.05` of `OVERVIEW`; the entry for `focus.png` has `shot` starting `focus:inc-` and a camera target within `0.05` of that incident's focus target.
  4. Both entries have `quality` `high` and `consoleErrors` `0`.
  5. Both entries have `stageVisible` `true` and `daysInView` `7`.
  6. `UI_REVIEW_ROUND=4` makes the script exit `1` with the text `at most three rounds` without calling the review tool.
  7. The review command exits `0` and prints a line matching `/^visual review 3d round [1-3]: \d+(\.\d)?\/10 -> pass; \d+ defects$/`; exit `3`, exit `1` and any other code fail the check with the tool's own output (exit `1` reported as `BLOCKED`).
  8. `design_documents/visual-review/3d-<n>.json` exists with a numeric `score` of at least `8`, and `design_documents/visual-review-3d.md` contains the text `round <n>` and `overview.png`.
  9. `package.json` has `verify:3d`, which names all eight scripts of this plan in order, and `screenshots:3d`.
  10. The two screenshots show different shot kinds: the focus camera is closer to its target than the overview camera is to its own (distance from position to target is smaller for `focus.png`).
- **Verify:** `npx vite-node scripts/verify/3d-08-review.ts`
- **Expected output:** `3d-08-review: 10 checks OK` (the two paths and `3d-screenshots: 2 written` are printed before it, and the review's own result line appears between them and the last line)
- **Proves:** the first frame a judge sees is an overview of the whole week standing above the calendar, the focus shot frames the circled moment, and an independent reviewer scored both at the bar.

## §8 Verification summary

| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/3d-01-adapter.ts` | `3d-01-adapter: 15 checks OK` |
| 02 | `npx vite-node scripts/verify/3d-02-tokens.ts` | `3d-02-tokens: 12 checks OK` |
| 03 | `npx vite-node scripts/verify/3d-03-mount.ts` | `3d-03-mount: 15 checks OK` |
| 04 | `npx vite-node scripts/verify/3d-04-shots.ts` | `3d-04-shots: 14 checks OK` |
| 05 | `npx vite-node scripts/verify/3d-05-arcs.ts` | `3d-05-arcs: 14 checks OK` |
| 06 | `npx vite-node scripts/verify/3d-06-lab.ts` | `3d-06-lab: 12 checks OK` |
| 07 | `npx vite-node scripts/verify/3d-07-capability.ts` | `3d-07-capability: 12 checks OK` |
| 08 | `npx vite-node scripts/verify/3d-08-review.ts` | `3d-08-review: 10 checks OK` |
| all | `npm run verify:3d` | the eight results above, in order, exit 0 |

If a count differs because a check was split or merged while writing a script, change the number in the unit and in this table in the same edit.

## §9 Risks

- **Software GL is slow or missing.** Headless Chromium without a GPU draws with SwiftShader. Mitigation: `quality=low` (no composer), the CI fps floor of 20, an explicit launch-argument list, and the headed threshold of 50 only when `THREE_D_HEADED=1`.
- **The kit's own focus shots are offset.** The kit aims `focus:<id>` at `position + size/2`, but boxes are centred on `position`. Mitigation: this plan lists its own focus shots first and the kit's `find` takes the first match; WU-04 checks 6 and 13 measure the camera target.
- **Duplicate shot names.** The kit appends its shots after ours, so `window.__demo3d.shots` lists each focus name twice and contains a harmless `focus:probe`. Mitigation: documented in §5.3; the recorder plays by name.
- **Pointer picking misses a thin or hidden object.** Mitigation: the arc has an invisible hit proxy on the strip, the tests click points that are not covered by a pillar, and WU-05 check 8 fails loudly if the proxy is not hit.
- **A custom entity throws inside the canvas.** The scene would blank. Mitigation: the renderers are small and pure, `SceneHost` catches a module error (DP-UI), and every script asserts zero console errors.
- **Selection ping-pong.** A click sets the store and the store sets the scene's selection. Mitigation: the scene is rebuilt only when the week changes (§5.4 item 1), and the click handler writes the store once.
- **The scene drifts from the calendar.** Mitigation: both are computed from `weekRibbon`, and WU-01 checks 9, 10 and 13 compare counts and positions with it.
- **A colour is invented in `src/3d/`.** Mitigation: WU-02 checks 11 and 12 scan the sources.
- **The review scores below 8.** Mitigation: three rounds, fixes confined to camera poses, heights, `LOOK` and lab values, and the deterministic checks of WU-01 to WU-07 as the gate that does not depend on a model.
- **The recording machine has no GPU.** Mitigation: the stage's fallback message and the flat replica; DP-LIVE-RUN-AND-VIDEO checks for a WebGL context before it starts recording.
