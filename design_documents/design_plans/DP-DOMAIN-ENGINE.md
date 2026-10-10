# DP-DOMAIN-ENGINE — Household-week domain model, truth engine, Ring port and synthetic bundle

> Plan 1 of 12. Owner of: every domain type, the one store, the 17 store actions, the 7 truth rules, the deterministic synthetic generator and bundle, the `RingPort` interface with its bundle implementation, and the session composition (`createSession`). Nothing in this plan calls a model, a network or a browser.
> Chassis paths are written `../../hackathons/…`. All imports use the `src/…` alias (defined in `vite.config.ts` and `tsconfig.json`); every verification command runs under `vite-node`.

## §0 Context & blockers

**Must already exist before WU-01** (the assembled working copy of the chassis): `src/resilience/`, `src/platform/`, `src/context/`, `src/cost/`, `src/ideation/`, `src/provenance/`, `src/pgm/`, `src/profile/`; `hee/kits/agent-workflow/`, `hee/kits/three-scene/`, `hee/scripts/install-kit.ts`; `package.json` (chassis scaffold), `tsconfig.json`, `vite.config.ts`; Node ≥ 20; network access to the npm registry.

**Preflight (run first; every line must print a path, not an error):**

```bash
ls -d hee/kits/agent-workflow hee/kits/three-scene hee/scripts/install-kit.ts src/resilience src/platform src/context src/cost design_documents/winning_project_plan.md ../../hackathons/templates/banned-words.json
```

**No blockers** other than the above. This plan is first in the build order; it must not import any file written by a later plan.

**Entity ids (fixed, used by every later plan):** household `hh-rosa`; devices `dev-door` (kind `doorbell`, description "Front door", components `[0]`) and `dev-elite` (kind `elite_camera`, description "Hall camera", components `[0, 1]`; component 0 = "Hall", component 1 = "Side gate"); routines `rtn-paper`, `rtn-walk`, `rtn-nurse`, `rtn-lunch`; events `evt:<requestId>` (webhook) and `hist:<historyId>` (history); visits `vis:<startMs>`; incidents `inc-<n>`; nudges `nud-<n>`; notes `note-<n>`; media `med-<n>` (n starts at 1, counted over the current array length + 1).

**Constants (fixed):** `UTC_OFFSET_MIN = -420` (Pacific daylight time, the household's offset); `BUNDLE_START_MS = Date.UTC(2026, 9, 5, 7, 0, 0)` (Monday 5 October 2026, 00:00 local); bundle length 14 days (day index 0 = Monday 5 October … 13 = Sunday 18 October); baseline window = days 0–6; review window = days 7–13 (Monday 12 October – Sunday 18 October); `REVIEW_START_MS = BUNDLE_START_MS + 7·DAY_MS`; `REVIEW_END_MS = BUNDLE_START_MS + 14·DAY_MS`; `DEMO_NOW_MS = REVIEW_END_MS − 60000` (Sunday 18 October 23:59 local).

## §1 Purpose & requirement IDs

Own the product's single source of truth and its deterministic judge. Requirements (blueprint §1): **FR-01** (bundled synthetic input), **FR-02** (one stateful model, revisions, undo, one action set), **FR-03** (rhythm baseline), **FR-04** (truth engine with units, seed regression), **FR-17** (visitor threads across `component_id`), **FR-07/FR-09** (gate and trace plumbing in `createSession`), **NFR-09** (chassis untouched), **NFR-11** (no absolute paths).

> **Verbatim contract — PRODUCT DEPTH SPEC (§1,§4,§5,§6,§7).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §1 The seven depth properties (every entry must have all seven)

1. **Real input.** The core demo starts from a real artefact supplied by the user or taken from a public
   source: an image, a PDF, a recording, a URL, a public dataset, a repository, free text in the
   user's own words. Synthetic data is allowed only when nothing real can be used. It must then be
   labelled in the UI and the README, and the plan must say why real data was impossible.
2. **A stateful domain model.** The product owns a structured model of the problem (a plan, a board,
   a case file, a schedule, a graph, a document set) with an id-addressable structure, a revision
   number and an undo history. Every change, by human or agent, goes through **one set of store
   actions**. The UI buttons and the agent's tools call the same functions.
3. **A broad action surface.** The agent can read, change, verify, navigate and annotate that model
   through typed actions (§3). Target **≥ 15 actions** when the domain supports it. Fewer is allowed
   only with a written reason in the plan.
4. **A multi-round agent workflow.** The core demo flow is an explicit call graph (§2) with at least
   one **verify → repair** round driven by the truth engine and at least one human checkpoint.
5. **A deterministic truth engine.** Code, not a model, decides whether the current state is valid:
   a constraint checker, rules engine, simulator, validator, scorer or compiler. The agent calls it
   after acting and repairs what it reports. The seed scenario has a regression test asserting zero
   issues.
6. **Human authorship.** The human acts on the same model directly (edit, move, choose, draw). Destructive or
   consent-requiring actions pause as a visible request with Approve / Reject. A rejection returns a
   sentence the agent can act on ("the human declined X; ask what to do instead"). Turn-based products
   may let the agent **wait for the human's move** and continue from it.
7. **Visible execution.** Every agent action appears on the page as it happens. An activity feed
   shows each action with a source badge (AGENT / YOU / SYSTEM), and the changed element animates.
   The product stays complete when the AI path is unavailable: a manual runner can execute every
   action from its schema.

##### §4 Truth engine standard

- Pure functions over the domain model: `check(model) → Issue[]`. Each issue has `id`, `severity`
  (`error|warning`), `entityIds`, a human message **with units**, and a suggested fix action.
- Exposed to the agent as a read action (e.g. `get_issues`) and to the human as a visible
  "Check" panel with a count badge.
- Unit tests per rule. A regression test proves the seed or demo scenario produces zero errors.
- The core demo shows one deliberate error being found and repaired.

##### §5 Human checkpoints standard

- An approval bar shows "AGENT WANTS TO <plain-language action>" with Approve and Reject. The
  agent's call stays pending until a human decides, and abort or timeout releases it.
- A toggle (default ON) controls the gate. The manual runner goes through the same gate.
- Rejection returns `ok:false` and a sentence the agent can act on, and the activity feed logs it.

##### §6 Real-input standard

- The plan's `### Demo Inputs` names each input, where it comes from (URL or "user-supplied"), its
  licence or terms, and how the judge can try their own.
- The product accepts the judge's own input of the same kind (upload, paste, URL) as well as the
  bundled sample.

##### §7 Anti-patterns that fail this contract

- A dashboard of synthetic rows with an "Ask AI" box.
- A metric that celebrates time saved while the session shows zero actions. **Every on-screen
  metric is computed from the actual session.**
- A chat panel that is the only way to use the product.
- An embedded assistant that competes with the mandated agent technology (§2B).
- Runtime plumbing (buffers, envelopes, cost meters) that no judge can see, built at the cost of
  domain depth.
## §2 Scope boundaries

**IN — files this plan creates (exactly):**

| Path | What |
|---|---|
| `src/kits/agent-workflow/**` | installed by command (not authored) |
| `src/kits/three-scene/**` | installed by command (not authored) |
| `src/domain/types.ts` | all domain types |
| `src/domain/time.ts` | time helpers |
| `src/domain/ring-port.ts` | `RingPort`, wire types, `RingError` |
| `src/domain/parse.ts` | tolerant Ring payload normalizer |
| `src/domain/generator.ts` | deterministic synthetic event generator, channel split, bundle builder |
| `src/domain/bundle-ring-port.ts` | `createBundleRingPort` |
| `src/domain/derive.ts` | visits, baseline, ribbon, threads, duplicate clusters, outages, `p90`, `toDomainDevice` |
| `src/domain/gaps.ts` | webhook-gap finder and Event-History poller (pure over `RingPort`) |
| `src/domain/actions.ts` | the 17 store actions |
| `src/domain/store.ts` | `createWeekStore` |
| `src/domain/seed.ts` | `cleanSeed`, `demoSeed`, constants |
| `src/domain/rules.ts` | the 7 truth rules |
| `src/domain/session.ts` | `createSession` |
| `data/bundle/doorstep-14d.json` | generated bundle (committed) |
| `scripts/gen-bundle.ts` | writes the bundle |
| `scripts/verify/de-01-kits.ts` … `de-09-session.ts` | the nine verification scripts |
| `scripts/verify/ring-port-contract.ts` | `runRingPortContract(port)` shared by this plan's WU-03/05 and by DP-RING-INTEGRATION WU-08 |

**Also modified (configuration only):** `package.json` (scripts, dependencies added by the kit installer), `tsconfig.json` (`include`/`exclude`), `.gitignore`.

**OUT — owned elsewhere:** prompts, role runners, the 20 agent actions and their registry registration (DP-AGENT-WORKFLOW); any HTTP and `LiveRingPort` (DP-RING-INTEGRATION); `HttpRingPort` and the server (DP-API-TRANSPORT); every component, colour, font (DP-UI); the 3D scene (DP-3D).

## §3 Interfaces owned (literal skeletons)

### §3.1 `src/domain/types.ts`

```ts
// Requirement IDs: FR-02, FR-03, FR-04, FR-17
// All domain types of Doorstep Rhythm. Single owner: DP-DOMAIN-ENGINE. Consumers import, never redeclare.

export type EventType = "motion_detected" | "button_press" | "device_online" | "device_offline";
export type EventChannel = "webhook" | "history";
export type ScopeName = "family_message" | "chime_announcement" | "weekly_brief";
export type IncidentKind = "quiet_hours_activity" | "long_dwell" | "device_outage" | "missed_routine" | "duplicate_burst";
export type IncidentStatus = "open" | "explained" | "resolved" | "dismissed";
export type NudgeStatus = "proposed" | "approved" | "rejected" | "sent" | "failed";
export type VisitKind = "arrival" | "delivery" | "linger";

/** Canonical parse target of every Ring payload (webhook or history item). */
export interface RawDoorEvent {
  id: string;                 // "evt:<requestId>" (webhook) | "hist:<historyId>" (history)
  deviceId: string;
  componentId: number;        // default 0
  type: EventType;
  subType?: "human";          // only on motion_detected
  tsMs: number;               // UTC epoch milliseconds
  requestId: string;          // webhook: meta.request_id; history: "hist:<historyId>"
  source: EventChannel;
}
export interface DoorEvent extends RawDoorEvent {
  merged?: string[];          // ids of duplicate events folded into this one by merge_duplicate_events
}

export interface QuietHours { startMin: number; endMin: number; toleranceMin: number } // minutes after local midnight; start 1320 = 22:00, end 420 = 07:00, tolerance 30
export interface Household { id: string; name: string; age: number; caretaker: string; utcOffsetMin: number; quietHours: QuietHours; blurb: string }
export interface Device {
  id: string; kind: string; description: string; online: boolean; acPower: boolean; battery: string;
  componentIds: number[]; chimeAudio: boolean; whep: boolean; snapshot: boolean;
}
export interface Visit {
  id: string;                 // "vis:<startMs>"
  startMs: number; endMs: number; dwellSec: number;
  eventIds: string[];
  hops: string[];             // ordered distinct "<deviceId>:<componentId>" the visit passed through
  kind: VisitKind;
  routineId?: string;
  label: string;              // e.g. "Visit · 6 min"
}
export interface Routine { id: string; name: string; windowStartMin: number; windowEndMin: number; days: number[]; /* 0=Mon..6=Sun */ expect: "visit" }
export interface ConsentScope { scope: ScopeName; granted: boolean; grantedAtMs?: number; grantedBy?: "human" }
export interface Nudge { id: string; scope: ScopeName; incidentId?: string; text: string; status: NudgeStatus; createdMs: number; detail?: string }
export interface Incident {
  id: string; kind: IncidentKind; status: IncidentStatus; title: string;
  eventIds: string[]; routineId?: string; dayIndex?: number;
  startMs: number; endMs: number; summary?: string; createdMs: number;
}
export interface Note { id: string; incidentId?: string; author: "agent" | "human"; text: string; tsMs: number }
export interface MediaRef { id: string; incidentId: string; deviceId: string; componentId: number; kind: "snapshot" | "clip"; contentType: string; dataBase64: string; tsMs: number; label: string; synthetic: boolean }
export interface WebhookReceipt { requestId: string; type: EventType; deviceId: string; tsMs: number; receivedMs: number }
export interface LedgerEntry { seq: number; action: string; entityIds: string[]; summary: string; tsMs: number }
export interface Baseline {
  dwellP90Sec: number; dwellMedianSec: number; sampleVisits: number;
  rhythm: number[][];         // [weekday 0..6][hour 0..23] = average visits per baseline week
  fromMs: number; toMs: number;
}
export interface UiState { selectedDay: number | null; selectedIncidentId: string | null; shotId: string; liveViewDeviceId: string | null }
export interface DataWindow { startMs: number; endMs: number; baselineStartMs: number; baselineEndMs: number }

export interface WeekModel {
  household: Household;
  devices: Device[];
  events: DoorEvent[];
  visits: Visit[];
  visitOverrides: Record<string, string>;   // visitId -> routineId set by link_visit_routine
  routines: Routine[];
  consent: ConsentScope[];                  // exactly three entries, one per ScopeName
  nudges: Nudge[];
  incidents: Incident[];
  notes: Note[];
  media: MediaRef[];
  webhookLedger: WebhookReceipt[];
  ledger: LedgerEntry[];
  baseline: Baseline;
  window: DataWindow;
  clockMs: number;
  ui: UiState;
  synthetic: boolean;                       // true for the bundled sample week
}
```

### §3.2 `src/domain/time.ts`

```ts
// Requirement IDs: FR-02, FR-04
export const MIN_MS = 60_000;
export const DAY_MS = 86_400_000;
/** Minutes after local midnight (0..1439) for a UTC instant. */
export function localMinutes(tsMs: number, utcOffsetMin: number): number;
/** Whole days since the Unix epoch in local time (floor((tsMs + offset·60000) / DAY_MS)). */
export function localDayNumber(tsMs: number, utcOffsetMin: number): number;
/** Weekday 0 = Monday … 6 = Sunday, local. */
export function localWeekday(tsMs: number, utcOffsetMin: number): number;
/** "HH:MM" (24-hour, zero padded), local. */
export function fmtClock(tsMs: number, utcOffsetMin: number): string;
/** "Tue 13 Oct", local, English short names. */
export function fmtDay(tsMs: number, utcOffsetMin: number): string;
/** "22 min" | "1 h 5 min" | "45 s": the product's duration phrase. */
export function fmtDuration(ms: number): string;
/** True when minute m lies in [fromMin, toMin) allowing the window to wrap midnight (fromMin > toMin). */
export function inWindow(m: number, fromMin: number, toMin: number): boolean;
```

### §3.3 `src/domain/ring-port.ts`

```ts
// Requirement IDs: FR-01, FR-10…FR-15
// The ONE seam between the product and Ring. Implementations: BundleRingPort (this plan),
// LiveRingPort (DP-RING-INTEGRATION, Node only), HttpRingPort (DP-API-TRANSPORT, browser→server).
export class RingError extends Error {
  readonly status: number;          // HTTP status, or 0 for a network failure
  readonly code: string;            // "unauthorized" | "rate_limited" | "not_found" | "bad_request" | "network" | "unsupported" | "upstream"
  readonly retryAfterSec?: number;
  constructor(status: number, code: string, message: string, retryAfterSec?: number);
}
export interface RingStatus { online: boolean; acPower: boolean; battery: "full" | "ok" | "low" | "unknown"; chimeSnoozed?: boolean }
export interface RingCapabilities {
  motionDetection: boolean; videoCodecs: string[]; nightVision: string;
  chimeAudio: boolean; chimeAudioSlots: string[]; whep: boolean; snapshot: boolean; components: number[];
}
export interface RingLocation { name: string; utcOffsetMin: number }
export type RingConfigurations = Record<string, string | number | boolean>;
export interface RingDevice {
  id: string; kind: string; description: string; owned: boolean; subscribed: boolean;
  status: RingStatus; capabilities: RingCapabilities; location: RingLocation | null; configurations: RingConfigurations | null;
  componentIds: number[];
}
export interface RingHistoryItem { id: string; eventType: string; timestamp: string; subType?: string; componentIds: number[] }
export interface RingHistoryPage { items: RingHistoryItem[]; limit: number; offset: number; total: number }
export interface RingWebhookPayload {
  event_id: string; timestamp: string; type: string; account_id?: string; device_id: string;
  attributes?: { sub_type?: string; component_ids?: number[] };
  meta: { request_id: string; time?: string };
  simulated?: boolean;
}
export interface RingWhepSession { sessionId: string; answerSdp: string; sessionUri?: string; expiresInSec: number; maxSeconds: number }
export interface RingSnapshot { contentType: string; dataBase64: string; capturedAtMs: number; componentId: number; synthetic: boolean }
export interface RingClip { contentType: string; dataBase64: string; durationSec: number; synthetic: boolean }
export interface RingChimeResult { ok: true; audioRef: string; deviceId: string; simulated: boolean }

export interface RingPort {
  readonly mode: "bundle" | "live" | "http";
  /** GET /v1/devices?include=status,capabilities,location,configurations */
  listDevices(): Promise<RingDevice[]>;
  getStatus(deviceId: string): Promise<RingStatus>;
  /** GET /v1/devices/{id}/capabilities[?component_id=N] */
  getCapabilities(deviceId: string, componentId?: number): Promise<RingCapabilities>;
  getLocation(deviceId: string): Promise<RingLocation>;
  getConfigurations(deviceId: string): Promise<RingConfigurations>;
  /** GET /v1/history/devices/{id}/events — newest first. */
  getEventHistory(deviceId: string, q: { limit: number; offset: number; type?: string }): Promise<RingHistoryPage>;
  /** Webhook payloads received since the last drain (empties the inbox). */
  drainWebhookInbox(): Promise<RingWebhookPayload[]>;
  startWhep(deviceId: string, sdpOffer: string, componentId?: number): Promise<RingWhepSession>;
  stopWhep(deviceId: string, sessionId: string): Promise<void>;
  getSnapshot(deviceId: string, componentId?: number): Promise<RingSnapshot>;
  getClip(deviceId: string, q: { startMs: number; endMs: number; componentId?: number }): Promise<RingClip>;
  playChime(deviceId: string, audioRef: string): Promise<RingChimeResult>;
}
```

### §3.4 `src/domain/parse.ts`

```ts
// Requirement IDs: FR-11, FR-12
/** Tolerant normalizer: one webhook payload (or an array of them) → RawDoorEvent[] with source "webhook".
 *  Unknown types and malformed payloads yield []; never throws. */
export function parseRingPayload(payload: unknown): RawDoorEvent[];
/** History page (or its items array) → RawDoorEvent[] with source "history" for one device. Never throws. */
export function parseHistoryPage(page: unknown, deviceId: string): RawDoorEvent[];
```

### §3.5 `src/domain/generator.ts`

```ts
// Requirement IDs: FR-01
export const SEED = 20261005;
export const UTC_OFFSET_MIN = -420;
export const BUNDLE_START_MS: number;      // Date.UTC(2026, 9, 5, 7, 0, 0)
export const WEBHOOK_SILENCE_MS: number;   // Thursday 15 Oct 2026 14:02:30 local — last webhook the receiver saw in the demo variant
export const ROUTINES: Routine[];          // rtn-paper, rtn-walk, rtn-nurse, rtn-lunch (see §5.3)
export interface RingBundle {
  meta: { synthetic: true; generator: string; seed: number; startMs: number; days: number; license: "MIT"; description: string };
  devices: RingDevice[];
  inbox: RingWebhookPayload[];                       // webhook channel, review window only, tsMs <= WEBHOOK_SILENCE_MS
  history: Record<string, RingHistoryPage[]>;        // deviceId -> pages of limit 50, newest first, whole 14 days
  snapshots: Record<string, RingSnapshot>;           // key "<deviceId>:<componentId>"
}
/** Deterministic: same input, same output, byte for byte. */
export function generateEvents(variant: "clean" | "demo"): RawDoorEvent[];
/** Splits the demo events into the webhook inbox payloads and the paged history. */
export function splitChannels(events: RawDoorEvent[]): { inbox: RingWebhookPayload[]; history: Record<string, RingHistoryPage[]> };
export function buildDevices(): RingDevice[];
export function buildBundle(): RingBundle;
```

### §3.6 `src/domain/bundle-ring-port.ts`

```ts
// Requirement IDs: FR-01, FR-12
import type { RingBundle } from "src/domain/generator.js";
import type { RingPort } from "src/domain/ring-port.js";
/** Reads data/bundle/doorstep-14d.json when no bundle is passed. mode "bundle".
 *  - drainWebhookInbox returns the inbox once, then [] (a second call after reset() returns it again).
 *  - Every other method answers from the bundle; unknown device → RingError(404,"not_found").
 *  - startWhep returns a synthetic answer (answerSdp "v=0 SIMULATED"), maxSeconds 30.
 *  - playChime returns { ok: true, simulated: true }. */
export function createBundleRingPort(bundle?: RingBundle): RingPort & { reset(): void };
```

### §3.7 `src/domain/derive.ts`

```ts
// Requirement IDs: FR-03, FR-17
import type { Baseline, DoorEvent, Routine, Visit, WeekModel, Device } from "src/domain/types.js";
import type { RingDevice } from "src/domain/ring-port.js";
export const VISIT_GAP_MS: number;           // 10 min
export const SINGLE_EVENT_DWELL_SEC: number; // 30
/** Nearest-rank percentile: sorted ascending, index ceil(p·n) − 1. p90(values) === percentile(values, 0.9). Empty → 0. */
export function percentile(values: number[], p: number): number;
export function p90(values: number[]): number;
export function deriveVisits(events: DoorEvent[], routines: Routine[], utcOffsetMin: number, overrides: Record<string, string>): Visit[];
export function computeBaseline(visits: Visit[], window: { baselineStartMs: number; baselineEndMs: number }, utcOffsetMin: number): Baseline;
export interface RibbonDay {
  dayIndex: number;                // 0..6 within the displayed week (0 = Monday)
  dayStartMs: number; dateLabel: string;               // "Mon 12 Oct"
  ticks: { id: string; minute: number; type: string; deviceId: string; componentId: number; duplicate: boolean }[];
  visits: { id: string; fromMin: number; toMin: number; routineId?: string }[];
  quietBands: { fromMin: number; toMin: number }[];
  outages: { deviceId: string; fromMin: number; toMin: number; minutes: number }[];
  incidents: { id: string; kind: string; status: string; fromMin: number; toMin: number }[];
  seamMinute: number | null;      // minute at which history took over from webhooks, if on this day
  eventCount: number;
}
export function weekRibbon(model: WeekModel, weekStartMs?: number): RibbonDay[];
export interface VisitorThread { visitId: string; hops: string[]; startMs: number; endMs: number }
export function visitorThreads(model: WeekModel): VisitorThread[];   // visits with ≥ 2 distinct hops
export function toDomainDevice(d: RingDevice): Device;
export const DUP_WINDOW_MS: number;          // 60_000
/** Clusters of duplicate events: same deviceId+type+componentId and (equal requestId with different id) OR
 *  (|Δt| ≤ DUP_WINDOW_MS and different source); connected components of size ≥ 2, each sorted by tsMs. */
export function findDuplicateClusters(events: DoorEvent[]): DoorEvent[][];
export interface Outage { deviceId: string; fromMs: number; toMs: number; openEnded: boolean; eventIds: string[] /* [offlineId, onlineId?] */ }
export function deviceOutages(model: WeekModel): Outage[];
/** Absolute day index of an instant within the 14-day window: floor((tsMs − model.window.baselineStartMs) / DAY_MS) (0..13). */
export function dayIndexOf(model: WeekModel, tsMs: number): number;
```

### §3.7b `src/domain/gaps.ts`

```ts
// Requirement IDs: FR-12
import type { RingPort } from "src/domain/ring-port.js";
import type { RawDoorEvent, WeekModel } from "src/domain/types.js";
export const HISTORY_OVERLAP_MS: number;              // 600_000 — the safety overlap the Perceive stage uses for the door device
export const WEBHOOK_SILENCE_THRESHOLD_MS: number;    // 6 h
/** Latest tsMs among model events with source "webhook" for the device; null when none. */
export function lastWebhookMs(model: WeekModel, deviceId: string): number | null;
/** One interval {fromMs: lastWebhook − overlapMs, toMs: nowMs} when nowMs − lastWebhook > WEBHOOK_SILENCE_THRESHOLD_MS; otherwise []. */
export function findWebhookGaps(model: WeekModel, deviceId: string, nowMs: number, overlapMs?: number): { fromMs: number; toMs: number }[];
/** Pages port.getEventHistory (limit 50, offset += 50) newest-first, stops when a page's oldest item is older than sinceMs
 *  or after 20 pages; returns parseHistoryPage events with tsMs ≥ sinceMs, sorted ascending by tsMs. */
export function pollHistory(port: RingPort, deviceId: string, sinceMs: number): Promise<RawDoorEvent[]>;
```

### §3.8 `src/domain/actions.ts`

```ts
// Requirement IDs: FR-02
import type { StoreAction } from "src/kits/agent-workflow/src/store/domainStore.js";
import type { WeekModel } from "src/domain/types.js";
export const STORE_ACTION_NAMES: readonly [
  "set_devices", "ingest_events", "merge_duplicate_events", "recompute_derived", "open_incident", "add_note",
  "set_incident_status", "link_visit_routine", "set_quiet_hours", "set_consent", "propose_nudge", "decide_nudge",
  "record_nudge_result", "attach_media", "record_webhook", "set_ui", "set_clock"
];
export const storeActions: StoreAction<WeekModel>[];   // 17 entries, in the order above
```

### §3.9 `src/domain/store.ts`

```ts
import type { DomainStore } from "src/kits/agent-workflow/src/store/domainStore.js";
import type { WeekModel } from "src/domain/types.js";
/** createDomainStore({ initial, actions: storeActions, maxHistory: 200 }) */
export function createWeekStore(initial: WeekModel): DomainStore<WeekModel>;
```

### §3.10 `src/domain/seed.ts`

```ts
export const REVIEW_START_MS: number; export const REVIEW_END_MS: number; export const DEMO_NOW_MS: number;
/** 14 days, every event ingested, no anomalies: the truth engine reports ZERO issues (regression seed). */
export function cleanSeed(): WeekModel;
/** Baseline week ingested; review window EMPTY (events arrive through the Ring port). clock = DEMO_NOW_MS.
 *  consent: family_message granted, weekly_brief granted, chime_announcement NOT granted. synthetic = true. */
export function demoSeed(): WeekModel;
```

### §3.11 `src/domain/rules.ts`

```ts
import type { Rule } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import type { WeekModel, QuietHours, IncidentKind } from "src/domain/types.js";
export const RULE_IDS: readonly ["quiet-hours", "dwell", "outage", "consent", "duplicate-burst", "ledger-integrity", "incident-coverage"];
export const DUP_WINDOW_MS: number;               // 60_000
export const DWELL_FLOOR_SEC: number;             // 900
export const OUTAGE_MIN: number;                  // 30
/** (start + tolerance, end − tolerance): 1320/420/30 → { startMin: 1350, endMin: 390 } i.e. 22:30–06:30. */
export function EFFECTIVE_QUIET_HOURS(q: QuietHours): { startMin: number; endMin: number };
export const truthRules: Rule<WeekModel>[];        // 7 rules in RULE_IDS order
export interface Candidate {
  kind: IncidentKind; ruleId: (typeof RULE_IDS)[number]; title: string;
  eventIds: string[]; startMs: number; endMs: number; routineId?: string; dayIndex: number;
}
/** Every condition the rules flag, before coverage is considered, ordered by startMs. Single source for the rules' issues and for
 *  DP-AGENT-WORKFLOW's compare_to_baseline findings. Kinds produced: quiet_hours_activity, long_dwell, device_outage, missed_routine. */
export function candidateIncidents(model: WeekModel): Candidate[];
```

### §3.12 `src/domain/session.ts`

```ts
// Requirement IDs: FR-02, FR-07, FR-09
import type { DomainStore, Source } from "src/kits/agent-workflow/src/store/domainStore.js";
import type { ApprovalGate } from "src/kits/agent-workflow/src/gate/approvalGate.js";
import type { TraceWriter } from "src/kits/agent-workflow/src/trace/types.js";
import type { Registry, ActionResult } from "src/kits/agent-workflow/src/registry/types.js";
import type { Issue } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import type { RingPort } from "src/domain/ring-port.js";
import type { WeekModel } from "src/domain/types.js";

export type Preflight = (model: WeekModel, args: unknown) => null | { message: string; next?: string };
export interface TruthEngine { check(model: WeekModel): Issue[]; counts(issues: Issue[]): { errors: number; warnings: number } }
export interface SessionCore {
  store: DomainStore<WeekModel>; truth: TruthEngine; gate: ApprovalGate; trace: TraceWriter;
  registry: Registry<WeekModel>;            // the WRAPPED registry (see §5.7)
  ring: RingPort;
  registerPreflight(actionName: string, fn: Preflight): void;
}
export interface Session extends SessionCore {
  checkNow(): { issues: Issue[]; counts: { errors: number; warnings: number } };
  reset(initial?: WeekModel): void;          // store.restore({model: clone, revision: 0}) + trace.reset()
  call(name: string, args: unknown, opts: { source: Source; round?: number; signal?: AbortSignal }): Promise<ActionResult>;  // === registry.call
}
export interface SessionOptions {
  initial?: WeekModel;                       // default demoSeed()
  ring: RingPort;
  registrar?: (core: SessionCore) => void;   // DP-AGENT-WORKFLOW registers the 20 descriptors here
  gateEnabled?: boolean;                     // default true
  gateTimeoutMs?: number;                    // default 120000
  procedures?: { name: string; steps: string[] }[];   // handed to createRegistry; DP-AGENT-WORKFLOW passes ACTOR_PROCEDURES
  runId?: string; now?: () => number;
}
export function createSession(opts: SessionOptions): Session;
```

## §4 Interfaces consumed (copy verbatim)

From the installed hee agent-workflow kit (installed by WU-01; owner: hee kit, vendored read-only under `hee/`):

```ts
import { createDomainStore } from "src/kits/agent-workflow/src/store/domainStore.js";
import type { DomainStore, StoreAction, Source } from "src/kits/agent-workflow/src/store/domainStore.js";
import { createTruthEngine } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import type { Rule, Issue } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import { createRegistry } from "src/kits/agent-workflow/src/registry/registry.js";
import type { ActionResult, Registry } from "src/kits/agent-workflow/src/registry/types.js";
import { createApprovalGate } from "src/kits/agent-workflow/src/gate/approvalGate.js";
import type { ApprovalGate } from "src/kits/agent-workflow/src/gate/approvalGate.js";
import { createTraceWriter } from "src/kits/agent-workflow/src/trace/traceWriter.js";
import type { TraceWriter } from "src/kits/agent-workflow/src/trace/types.js";
```

No other plan's exports are consumed (this is plan 1). Node built-ins only: `node:fs`, `node:path`, `node:url`, `node:crypto` (generator ids use a seeded PRNG, not `crypto`).

## §5 Algorithms (literal)

### §5.1 Time helpers (the §3.2 functions, exactly)
- `localMinutes(ts, off) = floor(((ts + off·60000) mod DAY_MS + DAY_MS) mod DAY_MS / 60000)`; `localDayNumber(ts, off) = floor((ts + off·60000) / DAY_MS)`; `localWeekday` = `(localDayNumber + 3) mod 7` (epoch day 0 was a Thursday, so Monday = 0).
- `fmtClock` pads `HH:MM`; `fmtDay` prints `Tue 13 Oct` from a fixed English table (no `Intl`, no locale), so output is identical in every timezone.
- `fmtDuration(ms)`: under 60 s → `"45 s"`; under 60 min → `"22 min"` (rounded to the nearest minute); otherwise `"1 h 5 min"` (a whole hour prints `"2 h"`).
- `inWindow(m, from, to)`: `from <= to ? m >= from && m < to : m >= from || m < to`.
- Quiet hours use `EFFECTIVE_QUIET_HOURS(household.quietHours)` with `inWindow(localMinutes(...), startMin, endMin)`.

### §5.2 Parsing (tolerant, never throws)
`parseRingPayload(payload)` accepts one payload or an array; `parseHistoryPage(page, deviceId)` accepts a `RingHistoryPage`, its `items` array or the doc's `{data:[{attributes}]}` JSON:API shape. Rules:
1. Id: webhook `evt:<meta.request_id>`; history `hist:<item.id>` (fallback `hist:<timestamp>:<deviceId>:<type>`). `requestId` is `meta.request_id` or `hist:<id>`.
2. Type: read `type` or `event_type` (also `attributes.event_type`); lower-case; map `motion`, `motion_detected` → `motion_detected`; `button_press`, `doorbell`, `ding` → `button_press`; `device_online`, `online` → `device_online`; `device_offline`, `offline` → `device_offline`. Anything else → the item is skipped.
3. `subType` is `"human"` only when `attributes.sub_type` (or `sub_type`) equals `human` and the type is `motion_detected`.
4. `componentId` is `attributes.component_ids[0]` coerced to a number, default 0.
5. `tsMs` from `timestamp` (ISO-8601) or `meta.time`; numbers below 1e12 are seconds and are multiplied by 1000; a non-finite result skips the item.
6. Output order equals input order; `source` is `"webhook"` or `"history"`.

### §5.3 Generator (exact schedule)
Per day `d` (0–13) and block, `rng = mulberry32(fnv1a(`${SEED}:${d}:${blockName}`))`; one seconds value per block (`sec = floor(rng()*50)+5`), every event in a block shares it. Minute offsets below are `a + floor(rng()*(b-a+1))` unless a literal. Event ids are `evt:req-<n>` for webhook-sourced (n increments in generation order) and `hist:<n>` for the same events on the history channel.
| Block | Time (local) | Device / comp | Notes |
|---|---|---|---|
| paper | 07:50 + 0–25 min | dev-door 0 | motion ×1 |
| walk-out | 15:10 + 0–10 | dev-door 0 | out; return +33–45 min; hall mirror +20 s on dev-elite 0 |
| incidental | Mon 11:20, Tue 17:05 (t, t+3, t+7), Wed 12:40, Thu 10:30, Fri 13:10, Sat 11:00, Sun none | dev-door 0 | 13 incidental visits across the baseline week (exactly) |
| evening porch | 19:32 + 0–8 | dev-door 0 | motion ×1 |
| gate | 17:40 + 0–20 | dev-elite 1 | non-human motion (cat/wind) |
| nurse | Wed 09:02 + {0, +7, +14, +25 min} | dev-door 0 | matches `rtn-nurse` |
| lunch | Sun 12:05 + {0, +10 … +40 min} | dev-door 0 | matches `rtn-lunch` |
| engineer | Thu 14:01:50, 14:02:10, 14:02:30 | dev-door 0 | both variants; last webhook |
| bootstrap | day 0 07:00 | both | device_online ×2 |
Demo-only anomalies (review week only): Tue d=8 linger (dev-door 02:14:05, 02:19:40, 02:36:15 and dev-elite comp 1 at 02:27:10); Thu d=10 dev-elite offline 14:05:00 and online 14:52:00; Fri d=11 no paper event.
The webhook channel stops at `WEBHOOK_SILENCE_MS` (Thu d=10 14:02:30). The history channel keeps everything. `generateEvents("clean")` has no anomalies, no gap and no duplicates; `generateEvents("demo")` adds the three anomalies; `splitChannels` writes the review-window webhook payloads (tsMs ≤ `WEBHOOK_SILENCE_MS`) to `inbox` and every event to paged history (limit 50, newest first); `buildBundle()` assembles `RingBundle` and `scripts/gen-bundle.ts` writes it to `data/bundle/doorstep-14d.json`.

### §5.4 Derivation
1. `deriveVisits(events, routines, utcOffsetMin, overrides)` (gap `VISIT_GAP_MS` = 10 min): sort human-relevant door events (motion on dev-door comp 0, button_press), cluster with a 10-min gap, `dwellSec = max(30, (last-first)/1000)`; kind from the nearest routine or heuristic (`delivery` if a button_press precedes motion within 90 s; `linger` if dwell > 420 s and no routine; else `arrival`). Apply `visitOverrides[visitId]` last.
2. Routine matching uses the smallest enclosing window (nurse over paper).
3. `computeBaseline(visits)`: p90 by nearest rank over non-routine visits in days 0–6. `expectedP90Sec` is exactly 420 s on the bundle (13 incidental visits).
4. `findDuplicateClusters(events)`: edges between events with same device/type/component and (equal `requestId` but different id, or within `DUP_WINDOW_MS` = 60 s from different sources); union-find; clusters of size ≥ 2 are returned.
5. `deviceOutages(events)`: pair offline→online per device; unpaired offline extends to `clockMs`; outage when gap > 30 min.

### §5.5 Store actions (literal argument shapes)
Every action returns `{model, entityIds, summary}` and throws `Error(message)` with an actionable sentence on invalid input. Every action except `set_ui` and `set_clock` ends by appending `{seq: ledger.length + 1, action, entityIds, summary, tsMs: model.clockMs}` to `model.ledger`. Actions marked ⟳ end by recomputing `visits`, `baseline` (pure functions of §5.4; `window` is the fixed 14-day window from the seed).
| Action | `args` | Effect and refusals |
|---|---|---|
| `set_devices` | `{ devices: Device[] }` | replaces/merges by id, keeps order of first appearance |
| `ingest_events` ⟳ | `{ events: RawDoorEvent[] }` | appends events whose `id` is unknown, sorted by `tsMs` then `id`; summary `Added {n} events ({m} already known).`; never merges duplicate clusters |
| `merge_duplicate_events` ⟳ | `{ eventIds: string[] }` | ≥ 2 ids, all present, same device/type/component, else throws `Pass at least two event ids that belong to the same duplicate cluster.`; keeps the earliest (ties by id), sets `merged` to the union of the folded ids, removes the rest |
| `recompute_derived` ⟳ | `{}` | explicit recompute |
| `open_incident` | `{ kind: IncidentKind, title: string, eventIds: string[] /* empty only for missed_routine */, routineId?: string, dayIndex?: number, startMs: number, endMs: number }` | id `inc-<n>`, status `open`, `createdMs = clockMs`; unknown event id throws `No event "<id>" in this week. Call list_week_events to see valid ids.`; an open incident of the same kind with identical `eventIds` throws `An incident for these events already exists (<id>).` |
| `add_note` | `{ incidentId?: string, author: "agent" \| "human", text: string }` | id `note-<n>`; unknown incident throws `No incident "<id>".` |
| `set_incident_status` | `{ incidentId: string, status: IncidentStatus, summary?: string }` | any transition except to the same status (throws `Incident <id> is already <status>.`); `summary` replaces `incident.summary` when given |
| `link_visit_routine` ⟳ | `{ visitId: string, routineId: string \| null }` | sets or clears `visitOverrides[visitId]`; unknown ids throw |
| `set_quiet_hours` | `{ startMin: number, endMin: number, toleranceMin: number }` | integers, 0–1439, tolerance 0–120 |
| `set_consent` | `{ scope: ScopeName, granted: boolean, actor: "human" \| "agent" \| "system" }` | `actor !== "human"` throws `Consent can only be granted by the family member. Ask them to turn it on.`; granting sets `grantedAtMs = clockMs`, `grantedBy = "human"`; revoking clears both |
| `propose_nudge` | `{ scope: ScopeName, text: string, incidentId?: string }` | id `nud-<n>`, status `proposed` |
| `decide_nudge` | `{ nudgeId: string, decision: "approved" \| "rejected" }` | only from `proposed`, else throws `Nudge <id> is already <status>.` |
| `record_nudge_result` | `{ nudgeId: string, status: "sent" \| "failed", detail?: string }` | only from `approved` |
| `attach_media` | `{ incidentId: string, deviceId: string, componentId: number, kind: "snapshot" \| "clip", contentType: string, dataBase64: string, tsMs: number, label: string, synthetic: boolean }` | id `med-<n>` |
| `record_webhook` | `{ requestId: string, type: EventType, deviceId: string, tsMs: number, receivedMs: number }` | no-op (summary `already recorded`) when `requestId` is known |
| `set_ui` | `{ selectedDay?: number \| null, selectedIncidentId?: string \| null, shotId?: string, liveViewDeviceId?: string \| null }` | partial merge |
| `set_clock` | `{ clockMs: number }` | must lie in `[window.startMs, window.endMs]`, else throws |

### §5.6 Rules (message literals)
| Rule | Fires when | Message template |
|---|---|---|
| `quiet-hours` | a visit starts in the effective quiet window and is not routine-matched | `A visit at {clock} on {day} fell inside quiet hours ({qh}).` |
| `dwell` | a non-routine visit outside quiet hours has dwell > baseline p90 | `A visit on {day} lasted {mins} min, above the usual {p90} min.` |
| `outage` | device offline > 30 min | `{device} was offline for {mins} min on {day}.` |
| `consent` | a nudge or chime exists without matching granted consent | `A {kind} was prepared without consent.` |
| `duplicate-burst` | duplicate cluster present | `{n} events look like the same moment ({clock}).` |
| `ledger-integrity` | ledger `seq` values are not exactly 1, 2, 3 … in order | `The activity log has a gap after entry {n}.` |
| `incident-coverage` | routine with at least one event that day is missing | `The {routine} on {day} did not show up.` |
Candidates and coverage. `candidateIncidents(model)` finds, over the review window only: **quiet_hours_activity** (a non-routine visit whose `startMs` is inside the effective quiet window; `eventIds` = the visit's event ids; title `Door activity at {clock} during quiet hours`), **long_dwell** (a non-routine visit outside quiet hours with `dwellSec` above `max(baseline.dwellP90Sec, DWELL_FLOOR_SEC)`; title `Long stay at the door on {day}`), **device_outage** (each `Outage` from `deviceOutages`, longer than `OUTAGE_MIN`; `eventIds` = `Outage.eventIds`; title `{device description} offline for {mins} min`) and **missed_routine** (a routine expected that weekday, with at least one model event that day, and no visit matched to it; `eventIds` = `[]`, `routineId`, `dayIndex`, `startMs/endMs` = the routine window that day; title `{routine name} did not happen on {day}`). A candidate is **covered** when some incident has the same `kind`, status `open` or `explained`, and (shares at least one event id with the candidate, or has the same `routineId` and `dayIndex`); it is **settled** when such an incident is `resolved` or `dismissed`. Each rule maps its candidates to issues with id `<ruleId>:<first event id, or routineId:day-N>`, `entityIds` = the candidate's `eventIds` (missed routine: `[routineId, "day-<N>"]`), and `fix = { action: "open_incident", args: { kind, title, eventIds, startMs, endMs, routineId?, dayIndex } }`. The `duplicate-burst` rule emits one error per cluster with `fix = { action: "merge_duplicate_events", args: { eventIds: <cluster ids> } }`. The `consent` and `ledger-integrity` rules carry no `fix`.
Severity: `error` when uncovered; `warning` when covered by an open or explained incident; no issue when resolved or dismissed. `quiet-hours` subsumes `dwell` for visits starting in quiet hours; `dwell` skips routine-matched visits; a routine day counts only if the model has at least one event that day.
Expected census on the demo flow: after perceive + reconcile, errors 4 (duplicate-burst 1, quiet-hours 1, outage 1, missed routine 1); after the agent opens 3 incidents, errors 1; after repair, errors 0 and warnings 3; after the human resolves them, 0.

### §5.7 Session wrapper
`createSession(opts)` builds `createWeekStore`, `createTruthEngine(rules)`, `createApprovalGate`, `createTrace`, and a core registry (`createRegistry({store, gate, trace, truth, procedures: opts.procedures, gateEnabled})`); the returned `registry.call` wrapper: (1) runs `registerPreflight` checks (consent refusal, capability refusal) and returns `{ok:false, error}` with an actionable message before the gate is touched; (2) when `ctx.source === "human"` sets the gate-bypass flag synchronously around `core.call` so a human clicking Export is not asked to approve their own click; (3) otherwise delegates unchanged. `session.snapshot()` and `restore()` pass through to the store.

### §5.8 Seeds
`cleanSeed()` is the clean bundle ingested and derived (zero issues). `demoSeed()` is the baseline week only (days 0–6) with consent `family_message` and `weekly_brief` granted and `chime` not granted; zero issues. The review week arrives only through ingestion, never in the seed.

## §6 Failure modes
| Failure | Behaviour | Recovery |
|---|---|---|
| Unparseable webhook/history item | skipped, counted in `parse.skipped`; never throws | shown in the ledger as `skipped` |
| Duplicate ingest of the same id | no-op for that id | idempotent |
| Action given unknown id | refusal with `Call <read-action> to see valid ids.` | agent retries |
| Truth engine throws | `check` returns an `error` issue `rule-crashed:<id>` | rule fix, not user-visible |
| Store handler throws mid-change | pre-call snapshot restored (kit) | none needed |
| Clock past review end | `clockMs` clamped to `REVIEW_END_MS` | none |
| Consent flipped by an agent | refused in preflight | the human toggles it |

## §7 Work units

Every verify script is `scripts/verify/de-0N-*.ts`, run as `npx vite-node scripts/verify/<file>`, and ends with `console.log("<name>: N checks OK")` after N sequential `assert()` calls (a failed assert prints `FAIL: <reason>` and exits 1).

### WU-DOMAIN-ENGINE-01 — install the kit and pin the toolchain
- **Goal:** the agent-workflow kit is present and the pinned dependencies resolve.
- **Steps:** run `npx vite-node hee/scripts/install-kit.ts agent-workflow --to .`; add dependencies at the versions in §0; create `scripts/verify/de-01-kits.ts` that imports `createStore`, `createTruthEngine`, `createRegistry`, `createApprovalGate`, `createTrace` from the installed kit and `withResilience` from `src/resilience`, and asserts each is a function, `INSTALLED.json` exists, and zod parses `{a:1}` with `z.object({a:z.number()})`.
- **Files:** `package.json`, `src/kits/agent-workflow/**`, `scripts/verify/de-01-kits.ts`.
- **Verify:** `npx vite-node scripts/verify/de-01-kits.ts`
- **Expected output:** `de-01-kits: 8 checks OK`
- **Proves:** the kit installs, the alias resolves under vite-node, and later units can import it.

### WU-DOMAIN-ENGINE-02 — types and time
- **Goal:** `types.ts` and `time.ts` per §3.1–§3.2 and §5.1.
- **Steps:** write both files; the verify asserts `localWeekday(BUNDLE_START_MS, -420) === 0` (Monday), `localMinutes(BUNDLE_START_MS + 470*60000, -420) === 470`, `fmtClock` of 07:50 local is `"07:50"`, `fmtDay(BUNDLE_START_MS + DAY_MS, -420) === "Tue 6 Oct"`, `fmtDuration` for 45 s / 22 min / 65 min, `inWindow` true at 23:00 and 02:00 and false at 12:00 for the wrapped window 1350→390, and that `DEMO_NOW_MS === REVIEW_END_MS - 60000` (imported from `seed.ts` once WU-07 exists; here compared to the formula).
- **Files:** `src/domain/types.ts`, `src/domain/time.ts`, `scripts/verify/de-02-time.ts`.
- **Verify:** `npx vite-node scripts/verify/de-02-time.ts`
- **Expected output:** `de-02-time: 10 checks OK`
- **Proves:** the time maths is timezone-independent.

### WU-DOMAIN-ENGINE-03 — the Ring port contract
- **Goal:** `ring-port.ts` with `RingPort` and request/response types, and the reusable contract-test helper `runRingPortContract(port)` in `scripts/verify/ring-port-contract.ts`.
- **Steps:** write the interface per §3.3; the helper asserts every method returns the documented shape and refusals are values, not throws; the verify runs the helper against a stub port.
- **Files:** `src/domain/ring-port.ts`, `scripts/verify/ring-port-contract.ts`, `scripts/verify/de-03-port.ts`.
- **Verify:** `npx vite-node scripts/verify/de-03-port.ts`
- **Expected output:** `de-03-port: 9 checks OK`
- **Proves:** DP-RING-INTEGRATION has a contract to implement against.

### WU-DOMAIN-ENGINE-04 — bundle generator
- **Goal:** the seeded two-week bundle per §5.3.
- **Steps:** write `generator.ts`; the verify asserts determinism (two runs deep-equal), clean variant has no events with equal `requestId` and different id, demo variant has the three anomalies (Tue linger, Thu offline pair, Fri no paper), webhook inbox stops at `WEBHOOK_SILENCE_MS`, history has more events than the inbox, and exactly 13 incidental baseline visits' worth of door events.
- **Files:** `src/domain/generator.ts`, `scripts/verify/de-04-bundle.ts`.
- **Verify:** `npx vite-node scripts/verify/de-04-bundle.ts`
- **Expected output:** `de-04-bundle: 12 checks OK`
- **Proves:** the demo story is data, and it is deterministic.

### WU-DOMAIN-ENGINE-05 — parse and the bundle port
- **Goal:** tolerant parsers and `BundleRingPort`.
- **Steps:** write `parse.ts`, `bundle-ring-port.ts`; verify `parseRingPayload` and `parseHistoryPage` on documented and flat shapes, skips unknown types without throwing, paginates `historyPages`, and passes `runRingPortContract`.
- **Files:** `src/domain/parse.ts`, `src/domain/bundle-ring-port.ts`, `scripts/verify/de-05-parse.ts`.
- **Verify:** `npx vite-node scripts/verify/de-05-parse.ts`
- **Expected output:** `de-05-parse: 11 checks OK`
- **Proves:** the same code path reads fixtures now and live payloads later.

### WU-DOMAIN-ENGINE-06 — derive and gaps
- **Goal:** `derive.ts`, `gaps.ts` per §5.4.
- **Steps:** write both; verify visits from the clean bundle, `expectedP90Sec === 420`, one duplicate cluster after the seeded overlap, one outage on Thu d=10, `findWebhookGaps` flags dev-elite and `pollHistory` with overlap 600 000 ms yields the duplicate cluster.
- **Files:** `src/domain/derive.ts`, `src/domain/gaps.ts`, `scripts/verify/de-06-derive.ts`.
- **Verify:** `npx vite-node scripts/verify/de-06-derive.ts`
- **Expected output:** `de-06-derive: 13 checks OK`
- **Proves:** the derived week and the webhook gap are computed, not asserted.

### WU-DOMAIN-ENGINE-07 — actions, store, seeds
- **Goal:** the 17 store actions, `createWeekStore`, and both seeds (`cleanSeed`, `demoSeed`).
- **Steps:** write `actions.ts`, `store.ts`, `seed.ts`; verify each action's happy path and its refusal message, `set_consent` refused for actors other than human, undo/redo round-trip, `cleanSeed` and `demoSeed` deep-clone safe.
- **Files:** `src/domain/actions.ts`, `src/domain/store.ts`, `src/domain/seed.ts`, `scripts/verify/de-07-actions.ts`.
- **Verify:** `npx vite-node scripts/verify/de-07-actions.ts`
- **Expected output:** `de-07-actions: 24 checks OK`
- **Proves:** every mutation is a named, undoable, refusal-friendly action.

### WU-DOMAIN-ENGINE-08 — truth rules and the census
- **Goal:** the 7 rules and the zero-error regression.
- **Steps:** write `rules.ts`; verify `cleanSeed` and `demoSeed` have zero issues, then drive the demo flow with direct store calls and assert the census 4 → 1 → 0 errors (warnings 3) and the final 0 after human resolution; each rule fires on a hand-built minimal model; `candidateIncidents` on the demo week after perceive and reconcile returns exactly 3 candidates (one each of quiet_hours_activity, device_outage and missed_routine); the fourth error is the duplicate cluster, which is not a candidate.
- **Files:** `src/domain/rules.ts`, `scripts/verify/de-08-rules.ts`.
- **Verify:** `npx vite-node scripts/verify/de-08-rules.ts`
- **Expected output:** `de-08-rules: 21 checks OK`
- **Proves:** the verify→repair story and its numbers are produced by rules, not by hand.

### WU-DOMAIN-ENGINE-09 — session
- **Goal:** `createSession` with preflight and the human bypass.
- **Steps:** write `session.ts`; verify a destructive call by the agent is held at the gate, the same call with `source:"human"` runs, a chime without consent returns the preflight refusal before the gate, a rejected approval yields the kit's `The human declined "<summary>". Ask what to do instead.`, and `summarizeTrace` counts `human_checkpoints`.
- **Files:** `src/domain/session.ts`, `scripts/verify/de-09-session.ts`.
- **Verify:** `npx vite-node scripts/verify/de-09-session.ts`
- **Expected output:** `de-09-session: 12 checks OK`
- **Proves:** the human checkpoint and consent boundary hold at the code level.

## §8 Verification summary
| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/de-01-kits.ts` | `de-01-kits: 8 checks OK` |
| 02 | `npx vite-node scripts/verify/de-02-time.ts` | `de-02-time: 10 checks OK` |
| 03 | `npx vite-node scripts/verify/de-03-port.ts` | `de-03-port: 9 checks OK` |
| 04 | `npx vite-node scripts/verify/de-04-bundle.ts` | `de-04-bundle: 12 checks OK` |
| 05 | `npx vite-node scripts/verify/de-05-parse.ts` | `de-05-parse: 11 checks OK` |
| 06 | `npx vite-node scripts/verify/de-06-derive.ts` | `de-06-derive: 13 checks OK` |
| 07 | `npx vite-node scripts/verify/de-07-actions.ts` | `de-07-actions: 24 checks OK` |
| 08 | `npx vite-node scripts/verify/de-08-rules.ts` | `de-08-rules: 21 checks OK` |
| 09 | `npx vite-node scripts/verify/de-09-session.ts` | `de-09-session: 12 checks OK` |
Check counts are the number of `assert()` calls the script contains; if a script is written with a different count, update this table and the unit in the same commit.

## §9 Risks
- **Doc shapes drift from the real API.** Mitigation: the parser is tolerant and DP-RING-INTEGRATION WU-01 re-verifies against the published docs.
- **Seeded counts drift when the generator changes.** Mitigation: the census assertions in WU-08 are the single regression guard; change the generator and the census together.
- **Clock-dependent rules.** Mitigation: all rules read `model.clockMs`, never `Date.now()`.
- **Alias resolution under vite-node.** Mitigation: WU-01 proves it before any other work.
