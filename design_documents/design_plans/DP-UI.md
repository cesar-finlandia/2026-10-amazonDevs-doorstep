# DP-UI — Design brief, brandmark, tokens, shell, components, states

> Plan 5 of 12. The single owner of the entry's visual identity and of every pixel the family member sees on `/`. It builds, in this order: the design brief, the brandmark, the tokens and fonts, the shell, the primitives, the week calendar, the check and incident panels, the workbench (agent, approvals, activity), the rail, live view, every state, the hero slot, the measured craft audit and the screenshot suite. `DP-3D` renders into this plan's hero slot; `DP-SHOWCASE` and `DP-3D` replace the shells of `/watch` and `/lab`.
> Chassis paths are written `../../hackathons/…`. Imports use the `src/…` alias. This plan reproduces the whole of `design_documents/visual_identity_plan.md` (§1–§10) and the binding parts of the craft, brandmark and art-direction contracts **inside §5**, so no value has to be looked up elsewhere. Where the identity text names a path or a word, that is the path or the word.

## §0 Context & blockers

**Must already exist before WU-01 runs** (plans 1–4). Proof, each prints its own line:

```bash
npx vite-node scripts/verify/de-09-session.ts
npx vite-node scripts/verify/aw-10-floors.ts
npx vite-node scripts/verify/at-08-integration.ts
```
Expected: `de-09-session: 12 checks OK`, `aw-10-floors: 8 checks OK`, `at-08-integration: 15 checks OK`.

**Preflight (each line must print a path or a version):**
```bash
ls -d src/domain src/agent src/server src/platform/ui src/platform/transport design_documents/winning_project_plan.md hee/_useful/scripts/visual_review.py
node --version
npx playwright --version
npm ls @playwright/test react react-dom
```
`@playwright/test` must report `1.62.1`; the chassis checkout supplies `../../hackathons/scripts/hee-lint-design-brief.ts` and `../../hackathons/templates/ui-craft.spec.md`.

**Libraries (pinned in §5.8, installed in WU-03):** `react` 19.3.0, `react-dom` 19.3.0, `react-router` 8.4.0, `lucide-react` 1.52.0, `@vitejs/plugin-react` 6.1.2, three `@fontsource-variable/*` packages 5.3.0 (dev). `vite` is already in the repo. Nothing else is installed by this plan.

**The visual review (WU-14)** calls a Gemini vision model through Vertex AI per the AI ACCESS contract; it is the only live step. Every other command is offline and deterministic.

## §1 Purpose & requirement IDs

| ID | This plan's share |
|---|---|
| FR-19 | The product interface: week calendar, checks, incidents, workbench, rail, both themes, explainer and contextual help |
| FR-23 | Brandmark and lockup; the slogan `Know her day without calling.` identical in every place it appears |
| FR-03 | The week calendar renders `weekRibbon(model)`: ticks, visits, quiet bands, outages, the history seam |
| FR-04 | Check panel and incident cards over the truth engine's issues, in plain words |
| FR-07, FR-08, FR-09 | Approval bar, manual runner, review button, live activity feed bound to the trace and the event stream |
| FR-01 | Connect panel (Playground token), sample-week labelling |
| FR-13, FR-14 | Live view (WHEP) and snapshot evidence |
| FR-21 | Every degraded rung as a banner with icon, title and structured detail; every empty, loading and error state as a total template |
| NFR-05 | WCAG AA contrast asserted in both themes (`contrast: 80 pairs OK`) |
| NFR-06 | Reduced motion, focus rings, 390 px layout, camera-readable sizes |
| NFR-08 | No banned word in any rendered string (static copy lint and rendered-text scan) |

## §2 Scope boundaries

**IN — files this plan creates or modifies:**

| Path | Purpose |
|---|---|
| `design_documents/design_brief.md` | art direction (literal in §5.0) |
| `brand/mark.svg`, `brand/brandmark.css`, `brand/lockup.html`, `brand/favicon.svg`, `brand/README.md`; `public/brand/mark.svg`, `public/favicon.svg`, `public/favicon-32.png` | the brandmark (§5.2A) |
| `public/fonts/*.woff2` (three files) | self-hosted typefaces |
| `cinematic-tokens.json` | the video's motion and layout tokens (entry root) |
| `src/ui/tokens/{tokens.css,tokens.ts,fonts.css}` | the only definition of colour, type, space, radius, shadow, motion |
| `src/ui/styles/{base.css,controls.css,layout.css,platform-skin.css,motion.css}` | recipes of §5 turned into classes |
| `index.html` | inline theme script, font preloads, favicon, root element |
| `src/ui/main.tsx`, `src/ui/App.tsx`, `src/ui/routes.tsx` | mount, router, route table |
| `src/ui/theme/theme.ts` | theme persistence and first-paint logic |
| `src/ui/shell/{Shell,AppBar,Rail,ThemeToggle,Brandmark,Banners}.tsx` | shell |
| `src/ui/primitives/*.tsx` | `Surface, Metric, HelpTip, Button, Message, StatusChip, SourceBadge, SyntheticBadge, WorkIndicator, EmptyState, Explainer, Dialog` |
| `src/ui/help/helpContent.ts`, `src/ui/copy/templates.ts`, `src/ui/copy/banner.ts` | help and total message templates |
| `src/ui/state/*.ts(x)` | `SessionProvider`, `useModel`, `useIssues`, `useRun`, `useStatus`, `useEnvelopes`, `useUiActions` |
| `src/ui/week/*.tsx` | `WeekRibbon`, `DayColumn`, `IncidentCircle`, `BaselineStrip` |
| `src/ui/panels/*.tsx` | `WeekTitle, WeekSummary, SceneStage, AgentPanel, CheckPanel, IssueRow, IncidentCard, NudgeCard, ApprovalPanel, ActivityFeedPanel, ManualRunnerPanel, LiveViewPanel, HouseholdCard, DeviceList, QuietHoursEditor, ConsentList, ConnectPanel, ConnectDialog, WebhookInboxPill` |
| `src/ui/trace/friendly.ts` | `createFriendlyTrace` |
| `src/ui/scene/SceneHost.tsx` | the hero slot (loads `src/3d/DoorwayScene.tsx` when it exists) |
| `src/ui/pages/Kit.tsx` | an internal gallery at `/__kit` that renders every primitive in every state (used by WU-05 and WU-11; not linked from the UI, excluded from the craft audit) |
| `src/ui/pages/Home.tsx`; shells `src/ui/pages/Watch.tsx`, `src/ui/pages/Lab.tsx` | route pages (the two shells are replaced by DP-SHOWCASE and DP-3D, which keep the default export names `WatchPage` and `LabPage`) |
| `scripts/gen-tokens-ts.ts`, `scripts/check-contrast.ts`, `scripts/sync-project-copies.ts`, `scripts/ui-screenshots.ts` | generators and checkers |
| `scripts/verify/ui-kit.ts`, `scripts/verify/ui-01-brief.ts` … `ui-14-screenshots.ts`, `scripts/verify/ui-craft.ts` | the verification scripts |
| `design_documents/ui-screenshots/*.png`, `design_documents/visual-review-ui.md`, `design_documents/visual-review/ui-<n>.json` | outputs |
| `package.json`, `vite.config.ts` | scripts, dependencies, the dev proxy |

**OUT — owned elsewhere (do not write here):**
- The 3D scene, `/lab` body, `src/3d/*`, the token-to-material mapping — DP-3D (it reads `--scene-*` through the kit's `readTokensFromCss`).
- `/watch` body, README, stills, `demo-scenario.json` — DP-SHOWCASE.
- Server routes and the browser-side clients — DP-API-TRANSPORT (this plan only imports them).
- Prompts, actions, orchestrator, floors — DP-AGENT-WORKFLOW (this plan only calls `runWeekReview` and renders its trace).
- The browser-test harness and `e2e/*` — DP-E2E-BROWSER-TESTING (it reuses this plan's pinned Playwright).
- Slides and cover (they import `brand/*` and `cinematic-tokens.json`) — DP-SCRIPT.

## §3 Interfaces owned (literal skeletons)

### §3.1 Tokens, theme, copy

```ts
// src/ui/tokens/tokens.ts — GENERATED by scripts/gen-tokens-ts.ts from tokens.css; header comment "GENERATED — do not edit".
// Requirement IDs: FR-19, NFR-05
export type ThemeName = "light" | "dark";
export const tokens: { light: Record<string, string>; dark: Record<string, string> };   // keys without the leading "--" (e.g. "bg-elevated")
export const sceneTokenNames: string[];                                                    // every key starting "scene-"
export function cssVar(name: string): string;                                              // "var(--name)"
export function tokenCssText(): string;                                                    // the full tokens.css text (imported with ?raw) — DP-3D passes it to the kit's readTokensFromCss

// src/ui/theme/theme.ts — Requirement IDs: FR-19
export const THEME_KEY = "dr-theme";
export function initialTheme(prefersDark: boolean, stored: string | null): ThemeName;     // stored "light"|"dark" wins, else prefersDark ? "dark" : "light"
export function readStoredTheme(storage?: Pick<Storage, "getItem">): string | null;       // try/catch, null on failure
export function persistTheme(t: ThemeName, storage?: Pick<Storage, "setItem">): void;     // try/catch
export function applyTheme(t: ThemeName, root?: HTMLElement): void;                       // root.dataset.theme = t
export function useTheme(): { theme: ThemeName; set(t: ThemeName): void };

// src/ui/help/helpContent.ts — Requirement IDs: FR-19 (copy is §5.6A, verbatim)
export type HelpRegionId = "week-ribbon" | "open-checks" | "check-panel" | "incident-card" | "nudge-card" | "activity-feed" | "approval-bar" | "baseline" | "scene-3d" | "live-view" | "ring-status" | "agent-status" | "consent" | "quiet-hours";
export const helpContent: Record<HelpRegionId, { label: string; body: string }>;          // label = the `?` aria-label
export const explainerCopy: { title: string; what: string; who: string; flow: string[]; read: string; tryIt: string };

// src/ui/copy/templates.ts — every function is TOTAL: any input (undefined, null, "", NaN, negative) yields a sentence with no empty slot.
// Requirement IDs: FR-21, NFR-08
export interface Msg { title: string; detail: string }
export function leadSentence(openChecks: number | null | undefined): string;
export function weekTitle(model: import("src/domain/types.js").WeekModel): string;           // "The week of 12 October"
export function weekSupport(model: import("src/domain/types.js").WeekModel, ringMode: "bundle" | "live" | "http" | string | undefined): string;
export function emptyEvents(): Msg; export function emptyIncidents(): Msg; export function emptyChecks(): Msg;
export function ringError(status?: number | null): Msg;
export function actionError(message?: string | null): Msg;
export function backupModel(): Msg; export function recordedRun(dateLabel?: string | null): Msg; export function runningByHand(): Msg; export function sampleWeek(): Msg;
export function tokenWarning(minutes?: number | null): Msg;
export function budgetWarning(pct?: number | null): Msg;
export function notSupported3d(): Msg;
export function rejected(summary?: string | null): Msg;
export function phaseLabel(role?: string | null): string;                                    // table of §5.9, fallback "Working on the week"
export function ariaDayLabel(day: import("src/domain/derive.js").RibbonDay): string;        // "Tuesday 13 October, 3 events, 1 moment to look at"
export function incidentEyebrow(inc: import("src/domain/types.js").Incident, utcOffsetMin: number): string;   // "TUE 13 OCT · 02:14"
export function issueTitle(issue: { message: string }): string;
export const RULE_WORDS: Record<(typeof import("src/domain/rules.js").RULE_IDS)[number], string>;   // plain-words rule names (§6.4)

// src/ui/copy/banner.ts — Requirement IDs: FR-21
export type Tone = "info" | "success" | "warning" | "danger" | "degraded";
export interface BannerSpec { id: string; tone: Tone; title: string; detail: string; items?: { step: string; text: string }[]; action?: { label: string; key: "use-sample" | "retry" | "connect" | "show-details" | "open-actions" | "paste-token" } }
export interface BannerInput {
  ringMode: "bundle" | "live"; ringDegraded: boolean; ringError: { status?: number } | null;
  agentKind: "bedrock" | "vertex-fallback" | "golden" | "manual"; recordedDate?: string | null;
  tokenMinutes: number | null; usedPct: number; runError: string | null;
}
/** One banner at a time. Priority: ring error > agent manual > agent golden > agent vertex-fallback > ring degraded to the sample week > token ending > budget ≥ 80 > null. */
export function pickBanner(i: BannerInput): BannerSpec | null;
```

### §3.2 State, run and trace

```ts
// src/ui/state/SessionProvider.tsx — Requirement IDs: FR-01, FR-09
export interface AppContext { session: import("src/domain/session.js").Session; ring: import("src/server/http-ring-port.js").HttpRingPort; sessionId: string }
export function SessionProvider(props: { children: React.ReactNode; baseUrl?: string; sessionIdOverride?: string }): React.JSX.Element;
export function useApp(): AppContext;                                                      // throws outside the provider
/** sessionId = sessionStorage["dr-session"] or a new 16-char id (stored); session = createAppSession({ ring: httpRingPort }). */

// src/ui/state/hooks.ts — Requirement IDs: FR-09
export function useModel(): import("src/domain/types.js").WeekModel;                       // useSyncExternalStore over store.subscribe / store.getState
export function useIssues(): { issues: import("src/kits/agent-workflow/src/truth/truthEngine.js").Issue[]; errors: number; warnings: number; open: number };   // session.checkNow() memoised per store revision
export function useStatus(): { ring: { mode: "bundle" | "live"; tokenExpiresInSec: number | null }; agent: { kind: string; label: string; model: string }; usedPct: number; inboxDefault: number; build: string; loaded: boolean };   // GET /api/status?sessionId=, refreshed every 10 s and on agent-rung / ring-mode envelopes
export function useEnvelopes(): { envelopes: import("src/platform/transport").EventEnvelope[]; status: string; degraded: boolean };   // platform useEventStream()
export function useUiActions(): { selectDay(i: number | null): void; selectIncident(id: string | null): void; setShot(id: string): void; openLiveView(deviceId: string | null): void };   // each = session.call("set_ui", …, { source: "human" })

// src/ui/state/useRun.ts — Requirement IDs: FR-06, FR-09
import type { Phase, ReviewSummary } from "src/agent/orchestrator.js";
export interface RunState { status: "idle" | "running" | "done" | "stopped" | "error"; phase: Phase | null; round: number; detail: string; summary: ReviewSummary | null; error: string | null }
export function useRun(): RunState & { start(): Promise<void>; cancel(): void };           // start(): new HttpAgentTransport (new runId), refreshStatus(), runWeekReview({ session, transport, onPhase, signal, autoDecide: null })

// src/ui/trace/friendly.ts — Requirement IDs: FR-09
export interface FriendlyEntry { seq: number; badge: "AGENT" | "YOU" | "SYSTEM"; actor: "Reader" | "Planner" | "Agent" | "Writer" | "You" | "System"; title: string; detail: string; ok: boolean; entityIds: string[] }
export function friendlyEntry(e: import("src/kits/agent-workflow/src/trace/types.js").TraceEntry, titles: Record<string, string>): FriendlyEntry;
export function createFriendlyTrace(trace: import("src/kits/agent-workflow/src/trace/types.js").TraceWriter, registry: import("src/kits/agent-workflow/src/registry/types.js").Registry<unknown>): { entries(): FriendlyEntry[]; subscribe(fn: () => void): () => void };
```

### §3.3 Primitives and panels (props are literal; every component sets the data attributes the audit reads)

```ts
// src/ui/primitives
Surface(props: { title?: string; eyebrow?: string; emphasis?: "primary"; elevation?: 2 | 3; well?: boolean; help?: HelpRegionId; resultRegion?: string; as?: "section" | "div" | "aside"; className?: string; children: React.ReactNode })
  // renders [data-surface] (+ data-emphasis, data-elevation, data-well), header only when title or eyebrow, HelpTip at the header end when `help`, data-result-region when resultRegion
Metric(props: { label: string; value: number | string | null; unit?: string; support?: string; size: "md" | "lg" | "xl"; tone?: "default" | "accent" | "warning" | "danger" | "success"; loading?: boolean; max?: number; title?: string })
  // classes .metric .metric__value[--md|--lg|--xl] .metric__unit .metric__sep; data-metric on the value; numbers above 9 999 abbreviated 12.8k with the exact value in `title`; `max` shows "99+" past the budget
HelpTip(props: { region: HelpRegionId })              // button[data-help-for], popover role="dialog"
Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger"; loading?: boolean; icon?: React.ReactNode })
Message(props: { tier: "banner" | "callout" | "toast"; tone: Tone; title: string; detail?: string; items?: { step: string; text: string }[]; action?: { label: string; onClick(): void }; onDismiss?(): void })   // [data-message]
StatusChip(props: { tone: Tone; label: string }); SourceBadge(props: { source: "agent" | "human" | "system" }); SyntheticBadge()
WorkIndicator(props: { label: string })               // role="status" aria-live="polite", three ticks
EmptyState(props: { title: string; detail: string; action?: { label: string; onClick(): void }; secondary?: { label: string; onClick(): void } })
Dialog(props: { open: boolean; onClose(): void; label: string; elevation?: 3; children: React.ReactNode })   // focus trap, Esc, backdrop
Explainer(props: { open: boolean; onClose(): void; onTry(): void })                       // [data-app-explainer-panel]; the app-bar trigger carries [data-app-explainer]

// src/ui/shell
AppBar(): header — Brandmark, explainer ghost button, spacer, ring chip, agent chip, (below 1024 px) ThemeToggle
Rail(): aside — HouseholdCard, DeviceList, QuietHoursEditor, ConsentList, ConnectPanel, WebhookInboxPill, ThemeToggle footer
ThemeToggle(): role="radiogroup" "Paper" | "Dusk"
Brandmark(props: { size?: "header" | "slide" | "cover"; markOnly?: boolean }): the lockup of §5.2A.6

// src/ui/week
WeekRibbon(): the seven-column paper calendar over weekRibbon(model); BaselineStrip(); IncidentCircle(props: { day: RibbonDay; incident: RibbonDay["incidents"][number] })

// src/ui/panels (each is a Surface with the region id of §5.6A where it shows a result)
WeekTitle, WeekSummary, SceneStage, AgentPanel, CheckPanel, IssueRow, IncidentCard, NudgeCard, ApprovalPanel, ActivityFeedPanel, ManualRunnerPanel, LiveViewPanel,
HouseholdCard, DeviceList, QuietHoursEditor, ConsentList, ConnectPanel, ConnectDialog, WebhookInboxPill

// src/ui/scene/SceneHost.tsx — the hero slot
SceneHost(): loads src/3d/DoorwayScene.tsx through import.meta.glob("/src/3d/DoorwayScene.tsx") (an empty glob is fine); renders it with { session, className: "scene-host__canvas" } inside React.Suspense;
  no module, or a thrown error, or no WebGL → the `notSupported3d` message with data-demo-3d="unavailable". DP-3D's component root is the element that carries data-demo-3d.

// src/ui/pages
export default function HomePage(): the route "/" (full product); export default function WatchPage(): shell; export default function LabPage(): shell
```

### §3.4 Verification kit (`scripts/verify/ui-kit.ts`)

```ts
export function createChecker(name: string): { ok(cond: unknown, label: string): void; eq(a: unknown, b: unknown, label: string): void; done(): never };   // re-exported from at-kit.ts
export function ensureBuilt(): Promise<void>;     // `npx vite build --logLevel error` when dist/index.html is missing or older than any file under src/ui, index.html or public/
export interface UiRun { page: import("@playwright/test").Page; url: string; server: import("src/server/start.js").RunningServer; close(): Promise<void> }
export function openApp(opts?: { width?: number; height?: number; theme?: "light" | "dark"; path?: string; env?: Record<string, string>; reducedMotion?: boolean; overrides?: Record<string, unknown> }): Promise<UiRun>;
   // ensureBuilt(); startServer({ port: 0, config: { staticDir: "dist" }, env: { NODE_ENV: "test", AGENT_PROVIDER: "golden", ...env } }); chromium.launch(); context with the viewport, colorScheme from `theme`,
   // an init script that sets localStorage["dr-theme"]; page.goto(url + path); waits for document.fonts.ready and for [data-app-ready="true"] on <body>.
export function reviewTheWeek(page: import("@playwright/test").Page): Promise<void>;   // clicks "Review the week", approves every approval request, waits for [data-run-status="done"]
export const CRAFT_ASSERTIONS: (page: import("@playwright/test").Page) => Promise<{ name: string; ok: boolean; detail: string }[]>;   // the nine assertions of §5.11 (written in WU-13, reused by WU-14)
```
`<body data-app-ready="true">` is set by `App` once the session exists and the first paint of the shell has happened; `Home` sets `data-run-status` (`idle|running|done|stopped|error`) and `data-run-phase` on the Agent panel.

## §4 Interfaces consumed (copy verbatim)

```ts
import { createRoot } from "react-dom/client";
import { useState, useEffect, useMemo, useRef, useSyncExternalStore, useCallback, Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider, Outlet, NavLink, useNavigate } from "react-router";
import { CircleHelp, Sun, Moon, Info, CircleCheck, TriangleAlert, OctagonX, Layers, ShieldQuestion, Video, Check } from "lucide-react";

import type { WeekModel, Incident, Nudge, Device, DoorEvent, ScopeName, IncidentKind } from "src/domain/types.js";
import { localMinutes, localDayNumber, localWeekday, fmtClock, fmtDay, fmtDuration, DAY_MS, MIN_MS } from "src/domain/time.js";
import { weekRibbon, visitorThreads, findDuplicateClusters, deviceOutages, dayIndexOf } from "src/domain/derive.js";
import type { RibbonDay } from "src/domain/derive.js";
import { RULE_IDS, EFFECTIVE_QUIET_HOURS } from "src/domain/rules.js";
import { demoSeed, cleanSeed, DEMO_NOW_MS, REVIEW_START_MS, REVIEW_END_MS } from "src/domain/seed.js";
import type { Session } from "src/domain/session.js";
import { RingError } from "src/domain/ring-port.js";
import type { RingStatus, RingSnapshot, RingWhepSession } from "src/domain/ring-port.js";

import { createAppSession, actionFields } from "src/agent/app-session.js";
import { runWeekReview, PHASES } from "src/agent/orchestrator.js";
import type { Phase, ReviewSummary } from "src/agent/orchestrator.js";
import { bannedHits } from "src/llm/guard.js";

import { createHttpRingPort } from "src/server/http-ring-port.js";
import type { HttpRingPort } from "src/server/http-ring-port.js";
import { createHttpAgentTransport } from "src/server/http-agent-transport.js";

import { ActivityFeed, ApprovalBar, ManualRunner, ChangedFlash } from "src/kits/agent-workflow/src/react/index.js";
import type { TraceEntry, TraceWriter } from "src/kits/agent-workflow/src/trace/types.js";
import { installTraceHook } from "src/kits/agent-workflow/src/trace/traceWriter.js";
import type { Registry } from "src/kits/agent-workflow/src/registry/types.js";
import type { ApprovalRequest } from "src/kits/agent-workflow/src/gate/approvalGate.js";

import { useEventStream } from "src/platform/transport";
import type { EventEnvelope } from "src/platform/transport";
import { StepStatusIndicator, degradedResultOf, isDegradedEnvelope } from "src/platform/ui";
```
(`ActivityFeed`, `ApprovalBar`, `ManualRunner` and `ChangedFlash` render unstyled markup: the kit's `<ol><li class="feed-in"><span>BADGE</span> <strong>name</strong>…` and `<div><label><input type="checkbox">Require approval</label><div><span>AGENT WANTS TO …</span><button>Approve</button><button>Reject</button></div></div>`. This plan styles them only through wrappers and descendant selectors, and replaces the activity feed's raw names with the friendly trace by feeding the kit component a trace-shaped adapter, §6.7.)
Test-only: `import { chromium } from "@playwright/test"`, `node:child_process`, `node:fs`, `node:path` (screenshots are checked with `fs.statSync`).

## §5 Design tokens and contracts (verbatim)

Everything in this section is copied unchanged from the identity plan and the three contracts; **it is the single source for the implementor**. Subsection `§5.N` carries identity-plan section `§N` (`§5.2A` carries `§2A`, `§5.6A` carries `§6A`), so a reference such as "§5.9" means the states table, "§5.8" the library table and "§5.3" the typography. The two blocks marked *machine-read* are compared byte for byte with the files this plan writes (WU-03).

### §5.0 Design brief (literal content of `design_documents/design_brief.md`)

WU-01 writes this block into the file, unchanged except that nothing may be added above the title.

````markdown
# Design brief — Doorstep Rhythm

Slogan, identical everywhere it appears: Know her day without calling.

## Concept

**Concept sentence:** A paper wall calendar hung beside a front door, where every arrival is a pencil tick and the one visit that did not belong is circled, so a daughter can read her mother's week at a glance.
**Material:** Warm cotton paper, graphite pencil ticks, and one verdigris ink used for everything that can be pressed.
**Light:** Soft low morning daylight from a hallway window, warm and slightly yellow, with a dusk-lamp variant for the evening theme.
**Era:** Mid-century household almanacs and printed family wall calendars.
**Emotion:** Settled, like coming home and finding things as they should be.
**Hero frame:** The 3D doorway scene of the whole week standing above the paper calendar, with one pencil circle drawn round the visit that did not belong.
**Not this:** A black grid of live camera feeds with red recording dots, or a glowing neon agent dashboard.

## Audience and register

The reader is a daughter or son who lives a train ride from a parent who lives alone. She is not a technician, opens the page in the evening on a laptop, wants to know within ten seconds whether this was an ordinary week, and distrusts anything that feels like surveillance. The register is warm-editorial: a household almanac, not a security console. The memorable idea: the week is a paper calendar by the door, and the one tick that does not belong gets a pencil circle that draws itself.

## Derivation of the tokens

- `--bg` and `--bg-elevated` (cream paper, lighter card stock) — from Material: the wall and the calendar sheet.
- `--bg-sunken` (a darker paper well) — from Material: the shadow a thick page casts on the wall.
- `--pencil`, `--text` (graphite, warm near-black) — from Material: pencil ticks and ink on paper, never pure black.
- `--text-muted` (faded graphite) — from Material: pencil pressed lightly.
- `--accent` (verdigris, a copper-green) — from Material: the one ink used for everything that can be pressed.
- `--warning` (burnt amber) — from Light: low sun on the page, meaning "look here", not alarm.
- `--danger` (brick red) — from Era: the red pencil of a printed almanac proof.
- `--degraded` (slate blue) — from Era: the blue of a carbon-copy form, meaning "this is a copy".
- `--success` (leaf green) — from Emotion: things as they should be.
- Dark theme grounds `#12171A`, `#1B2226` — from Light: the room after the lamp is turned down, a blue-black night window.
- Dark `--accent` (lifted verdigris) — from Light: the lamp on the same copper-green ink.
- `--font-display` Fraunces — from Era: the warm, soft-serif voice of printed almanacs.
- `--font-text` Atkinson Hyperlegible Next — from Emotion: unhurried legibility at a glance.
- Hairline borders and the pencil-circle motion — from Material: a ruled calendar and a pencil drawn on it.

## Placement of the theme toggle

The theme toggle lives in the footer of the sticky household rail at 1024 px and wider, because it is a quiet household preference that is always in view without opening a menu; below 1024 px it moves into the app bar.

## Review

### Pass 1 — the nine defects of the craft contract, checked against this identity

- Defect 1 (status printed over the layout): every state has a home in the banner, callout or toast of the identity plan section 6.7.
- Defect 2 (a broken message template): every message is a total template written in section 9 and asserted by a script.
- Defect 3 (cards that are not containers): one surface recipe with border, radius, elevation and a header row.
- Defect 4 (numbers that wrap): one metric component with a stated digit budget and tabular figures.
- Defect 5 (every line identical): the eyebrow, subject and support roles are fixed for every group.
- Defect 6 (a monochrome screen): the accent appears in at least three roles and each state is a tinted surface with a glyph and a word.
- Defect 7 (no way to learn what anything does): an explainer button beside the title and a question-mark popover on every result region.
- Defect 8 (raw text dumped into a panel): every long text is clamped with a Show more control, and logs sit in a sunken well.
- Defect 9 (the system font everywhere): three self-hosted variable typefaces with stated roles.

### Pass 2 — accessibility and the camera

- Check 1: body text and muted text meet 4.5:1 on every surface in both themes, asserted by a script.
- Check 2: every control shows a focus ring, and no state is carried by colour alone.
- Check 3: every motion has a reduced-motion substitute.
- Check 4: anything the camera must read is 18 px or larger, numerals 28 px or larger, the hero metric 64 px.
- Check 5: the layout holds at 1440, 1280, 1024 and 390 px without horizontal scrolling.
````

### §5.1 Audience, register, references, memorable idea (identity §1)

#### §1 Audience, register, references, memorable idea

**Who it is for.** A daughter or son who lives a train ride from a parent who lives alone (persona-01 in `../../hackathons/hackathon-projects/2026-10-amazonDevs/personas.json`: *long-distance daughter watching solo-living mum*, grounded in mined posts `frust-0001` and `frust-0002`). She is not a technician. She opens the page on a laptop in the evening, wants to know in ten seconds whether this was an ordinary week for her mother, and distrusts anything that feels like surveillance. In the demo the household is a labelled synthetic one ("Rosa Alvarez, 84"; the daughter is "Marta").

**Visual register: warm-editorial.** A household almanac, not a security console. Justification: the audience trusts the look of a printed family calendar and a well-set magazine page — unhurried, legible, personal — and distrusts the black-grid, red-dot look of camera software. The palette is a consequence of the register: paper ground, pencil ink, one verdigris accent, and amber that means "look here" rather than "alarm".

**The one feeling: settled.** The page should feel like coming home and finding things as they should be; when something is off, it is still said in a calm sentence with a pencil circle around it.

**Subject-matter anchor outside software.** A paper wall calendar hung by the front door with a pencil on a string: one column per day, a tick for every arrival, a circle round the one that did not belong. The paper ground, the pencil-ink ticks, the serif headings and the hairline grid all descend from it.

**Three references, with the property borrowed from each.**
1. *Aeon (the magazine's article pages)* — a serif display face against a humane sans text face on a warm light page. Borrowed: the pairing and the generous leading; not its layout or wordmark.
2. *Apple Health "Highlights"* — a plain-language sentence that states what changed before any chart. Borrowed: the lead sentence above the data (the week summary line).
3. *Fantastical's week strip* — the day columns as the primary object you navigate by. Borrowed: the week as seven named columns that double as navigation.

**Three anti-references.** (1) A network-video-recorder wall — black grid of live feeds with red recording dots. (2) A hospital telemetry console — clinical blue, dense alarm lists. (3) The generic dark "AI agent dashboard" — glowing gradients, neon accents, glass cards.

**The one thing a judge will remember.** The week is a paper calendar by the door: a column of pencil ticks per day, and the one tick that does not belong gets a pencil circle that draws itself.
### §5.2A Brandmark (identity §2A)

#### §2A Brandmark

**§2A.1 The idea.** The rhythm of one door: three pencil strokes of different heights standing under a door arch, on a threshold line — arrivals and departures as ticks, the arch as the doorway they belong to. (A mechanism, not an industry: the product's central claim is "a week has a shape; learn it".)

**§2A.2 The geometry (viewBox `0 0 32 32`, one stroke weight 2.5, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`, every stroke `currentColor`).** Three paths:
- Arch: `M5 23V14A11 11 0 0 1 27 14V23` — two vertical legs 22 units apart joined by a semicircle of radius 11 centred at (16, 14).
- Ticks: `M11 23V18M16 23V12M21 23V16` — three vertical strokes 5 units apart, heights 5, 11 and 7 (the middle tick is the tallest; none touches the arch: the gap between the tallest tick's top (y 12) and the arch's inner top (y 3) is 9 units; the gap between a leg and its nearest tick is 6 units, between ticks 5 units, so negative space stays open at 16 px).
- Threshold: `M3 29H29` — a horizontal stroke, 26 units wide, 6 units below the feet of the ticks.
The mark is optically centred with a 1.75-unit margin on all four sides (1.75 to 30.25 on both axes, stroke included). It contains no `<text>`, no gradient, no filter, no mask and no literal hex. Rendered at 16, 24, 32, 64 and 256 px in both themes during planning; at 16 px the arch, the three ticks and the threshold remain distinct.

**§2A.3 The wordmark.** `Doorstep Rhythm` — capital D, capital R, one space, no hyphen. Family `var(--font-display)` (Fraunces), weight 700, letter-spacing `-0.012em`, colour `--text`. Both words identical in weight and colour.

**§2A.3b The slogan.** `Know her day without calling.` (five words, sentence case, one full stop). Family `var(--font-text)`, weight 500, letter-spacing `0.01em`, colour `--text-muted`, set at 0.62 of the name's size (13.6 px under a 22 px name).

**§2A.3c The designer's device: one hairline** — a 1 px vertical rule in `--border-strong` between the mark and the text stack, as high as the stack. No other device in the lockup.

**§2A.4 Colour.** Mark colour is `--accent`. Header surface is `--bg-elevated`. Light: `#1B6A62` on `#FFFDF8` = **6.29:1**. Dark: `#5CC0B3` on `#1B2226` = **7.40:1**. Slogan `--text-muted` on `--bg-elevated`: **7.65:1** light, **6.26:1** dark. Hairline `--border-strong` on `--bg-elevated`: **4.32:1** light, **3.87:1** dark. Every graphical ratio is ≥ 3:1.

**§2A.5 Clear space and minimum sizes.** Clear space 0.5× the mark's rendered height on all four sides. Minimum mark: 16 px. Minimum full lockup: name at 16 px (slogan 9.9 px); below a 480 px viewport the app bar shows the mark alone (its `aria-label` is `Doorstep Rhythm`) and the slogan is not rendered.

**§2A.6 Lockup CSS (verbatim; one `font-size` scales everything).**

```css
.brandmark { display: inline-flex; align-items: center; gap: 0.5em; line-height: 1;
  color: var(--accent); white-space: nowrap; }
.brandmark__mark { width: 2.05em; height: 2.05em; flex: none; display: block; }
.brandmark__stack { display: flex; flex-direction: column; gap: 0.18em;
  padding-left: 0.5em; border-left: 1px solid var(--border-strong); }
.brandmark__word { font-family: var(--font-display); font-size: 1em; font-weight: 700;
  letter-spacing: -0.012em; color: var(--text); }
.brandmark__slogan { font-family: var(--font-text); font-size: 0.62em; font-weight: 500;
  letter-spacing: 0.01em; color: var(--text-muted); }
.brandmark--header { font-size: 22px; }
.brandmark--slide { font-size: 34px; }
.brandmark--cover { font-size: 64px; }
```

**§2A.7 `brand/mark.svg` (verbatim).**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" role="img" aria-label="Doorstep Rhythm mark">
  <path d="M5 23V14A11 11 0 0 1 27 14V23" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 23V18M16 23V12M21 23V16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 29H29" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**§2A.8 Placement.** The lockup is the first element of the app bar on every route in both themes (`.brandmark--header`); it is the favicon (`public/brand/mark.svg` referenced by `<link rel="icon" type="image/svg+xml">`, plus a 32 px PNG fallback exported by DP-UI WU-02); the cover carries the *mark alone* above the title block; slide 1 and slide 2 carry the small lockup (`.brandmark--slide`) in the **top-left** corner at the same size, over the flat slide background. The portable copies live at `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/mark.svg` and `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/brandmark.css` and are byte-identical to the entry copies.
### §5.2 Colour system (identity §2) — contains the *machine-read* token stylesheet and cinematic tokens

#### §2 Colour system

Two themes, designed separately: **light "paper"** (the video's theme) and **dark "dusk"**. The page never uses pure `#000` or `#FFF`. Dark mode lifts the accent and gets its elevation from lighter surfaces, not heavier shadows.

| Token | Light (paper) | Dark (dusk) | Usage | Contrast light | Contrast dark |
|---|---|---|---|---|---|
| `--bg` | `#F6F1E7` | `#12171A` | Page ground (the wall the calendar hangs on) | `--text` 14.86:1 | `--text` 14.92:1 |
| `--bg-elevated` | `#FFFDF8` | `#1B2226` | Cards, app bar, rail, workbench panels | `--text` on it 16.46:1 | `--text` on it 13.32:1 |
| `--bg-sunken` | `#EBE4D3` | `#0C1012` | Wells: activity feed, logs, code, the 3D stage ground | `--text` on it 13.20:1 | `--text` on it 15.80:1 |
| `--bg-overlay` | `#FFFEFB` | `#222B30` | Popovers, dialogs, toasts (elevation 2 and 3) | `--text` on it 16.59:1 | `--text` on it 11.92:1 |
| `--border` | `#D8CDB6` | `#2A343A` | Hairline around every surface (decorative, not the only cue) | decorative (never the only cue) | decorative (never the only cue) |
| `--border-strong` | `#857758` | `#6C7F8A` | Control borders, the lockup hairline, focus-adjacent edges (≥3:1) | on `--bg-elevated` 4.32:1 | on `--bg-elevated` 3.87:1 |
| `--pencil` | `#3D372D` | `#CFC8B8` | Event ticks, day numerals, calendar grid ink | on `--bg-elevated` 11.59:1 | on `--bg-elevated` 9.67:1 |
| `--text` | `#221D16` | `#EFE9DC` | Body and subject text | on `--bg` 14.86:1 | on `--bg` 14.92:1 |
| `--text-muted` | `#5B5142` | `#A8A190` | Support and eyebrow roles only | on `--bg` 6.91:1 | on `--bg` 7.02:1 |
| `--text-inverse` | `#FFFDF8` | `#12171A` | Label on a `--text`-filled chip (YOU badge) | on `--text` 16.46:1 | on `--text` 14.92:1 |
| `--accent` | `#1B6A62` | `#5CC0B3` | Primary action fill, active day, selected event, mark, links, focus ring | on `--bg-elevated` 6.29:1 | on `--bg-elevated` 7.40:1 |
| `--accent-hover` | `#145650` | `#7ED3C8` | Primary action hover fill | n/a (hover state of `--accent`) | n/a (hover state of `--accent`) |
| `--accent-contrast` | `#FFFDF8` | `#0C1012` | Label on an accent fill | on `--accent` 6.29:1 | on `--accent` 8.78:1 |
| `--success` | `#3B6A2B` | `#8CC274` | Resolved / approved glyph and word | on `--bg-success` 5.35:1 | on `--bg-success` 6.49:1 |
| `--warning` | `#8F4B00` | `#F0A24A` | Needs-a-look glyph and word; the pencil circle on the ribbon | on `--bg-warning` 5.45:1 | on `--bg-warning` 6.56:1 |
| `--danger` | `#A32D2A` | `#F08077` | Error glyph and word; unresolved check | on `--bg-danger` 5.44:1 | on `--bg-danger` 5.73:1 |
| `--degraded` | `#3F5E85` | `#8FB0DC` | Degraded-mode glyph and word; fallback rung; duplicate burst | on `--bg-degraded` 5.25:1 | on `--bg-degraded` 6.31:1 |
| `--bg-accent` | `#D9EAE6` | `#183B38` | Tint behind an accent state (selected row, AGENT badge) | `--accent` on it 5.13:1 | `--accent` on it 5.60:1 |
| `--bg-success` | `#E4EEDC` | `#1F3320` | Tint behind success | `--success` on it 5.35:1 | `--success` on it 6.49:1 |
| `--bg-warning` | `#F8E7CC` | `#3A2A12` | Tint behind warning | `--warning` on it 5.45:1 | `--warning` on it 6.56:1 |
| `--bg-danger` | `#F6DCD8` | `#3C1F1D` | Tint behind danger | `--danger` on it 5.44:1 | `--danger` on it 5.73:1 |
| `--bg-degraded` | `#DDE5F0` | `#1D2C42` | Tint behind degraded | `--degraded` on it 5.25:1 | `--degraded` on it 6.31:1 |
| `--chart-1` | `#0B6FA8` | `#56B4E9` | Series 1 (also: device `dev-door`) | on `--bg-elevated` 5.36:1 | on `--bg-elevated` 6.98:1 |
| `--chart-2` | `#B84F00` | `#F08A3C` | Series 2 (also: device `dev-elite` component 0) | on `--bg-elevated` 4.97:1 | on `--bg-elevated` 6.45:1 |
| `--chart-3` | `#00735A` | `#3FC9A0` | Series 3 (also: device `dev-elite` component 1) | on `--bg-elevated` 5.74:1 | on `--bg-elevated` 7.73:1 |
| `--chart-4` | `#9C4F7D` | `#E08FBF` | Series 4 | on `--bg-elevated` 5.40:1 | on `--bg-elevated` 6.79:1 |
| `--chart-5` | `#8A6A00` | `#E6C84A` | Series 5 | on `--bg-elevated` 4.99:1 | on `--bg-elevated` 9.76:1 |
| `--chart-6` | `#4B4B9C` | `#A6A6F2` | Series 6 | on `--bg-elevated` 7.42:1 | on `--bg-elevated` 7.18:1 |
Charts use an Okabe-Ito-derived sequence, darkened for the paper ground and lightened for dusk. Series are never separated by hue alone: every series also gets a marker shape (circle, square, triangle, diamond, cross, ring) and lines a dash pattern, which keeps the six distinguishable under deuteranopia.

Contrast pairs asserted by `DP-UI` WU-03 (`contrast: N pairs OK`, exit non-zero on any failure), each computed in both themes:

| Pair (text on surface) | Needs | Light | Dark | Used for |
|---|---|---|---|---|
| `--text` on `--bg` | 4.5:1 | 14.86 | 14.92 | body |
| `--text-muted` on `--bg` | 4.5:1 | 6.91 | 7.02 | support text |
| `--accent` on `--bg` | 4.5:1 | 5.68 | 8.29 | accent text and links |
| `--border-strong` on `--bg` | 3.0:1 | 3.91 | 4.33 | control borders, focus |
| `--text` on `--bg-elevated` | 4.5:1 | 16.46 | 13.32 | body |
| `--text-muted` on `--bg-elevated` | 4.5:1 | 7.65 | 6.26 | support text |
| `--accent` on `--bg-elevated` | 4.5:1 | 6.29 | 7.40 | accent text and links |
| `--border-strong` on `--bg-elevated` | 3.0:1 | 4.32 | 3.87 | control borders, focus |
| `--text` on `--bg-sunken` | 4.5:1 | 13.20 | 15.80 | body |
| `--text-muted` on `--bg-sunken` | 4.5:1 | 6.14 | 7.43 | support text |
| `--accent` on `--bg-sunken` | 4.5:1 | 5.04 | 8.78 | accent text and links |
| `--border-strong` on `--bg-sunken` | 3.0:1 | 3.47 | 4.59 | control borders, focus |
| `--text` on `--bg-overlay` | 4.5:1 | 16.59 | 11.92 | body |
| `--text-muted` on `--bg-overlay` | 4.5:1 | 7.71 | 5.61 | support text |
| `--accent` on `--bg-overlay` | 4.5:1 | 6.34 | 6.62 | accent text and links |
| `--border-strong` on `--bg-overlay` | 3.0:1 | 4.36 | 3.46 | control borders, focus |
| `--success` on `--bg-elevated` | 4.5:1 | 6.29 | 7.74 | success glyph and word on card |
| `--success` on `--bg-success` | 4.5:1 | 5.35 | 6.49 | success word on its tint |
| `--text` on `--bg-success` | 4.5:1 | 13.99 | 11.18 | body on success tint |
| `--warning` on `--bg-elevated` | 4.5:1 | 6.51 | 7.65 | warning glyph and word on card |
| `--warning` on `--bg-warning` | 4.5:1 | 5.45 | 6.56 | warning word on its tint |
| `--text` on `--bg-warning` | 4.5:1 | 13.78 | 11.42 | body on warning tint |
| `--danger` on `--bg-elevated` | 4.5:1 | 6.96 | 6.18 | danger glyph and word on card |
| `--danger` on `--bg-danger` | 4.5:1 | 5.44 | 5.73 | danger word on its tint |
| `--text` on `--bg-danger` | 4.5:1 | 12.86 | 12.35 | body on danger tint |
| `--degraded` on `--bg-elevated` | 4.5:1 | 6.56 | 7.22 | degraded glyph and word on card |
| `--degraded` on `--bg-degraded` | 4.5:1 | 5.25 | 6.31 | degraded word on its tint |
| `--text` on `--bg-degraded` | 4.5:1 | 13.18 | 11.64 | body on degraded tint |
| `--pencil` on `--bg-elevated` | 4.5:1 | 11.59 | 9.67 | event ticks and day numerals |
| `--accent` on `--bg-accent` | 4.5:1 | 5.13 | 5.60 | accent on accent tint |
| `--text` on `--bg-accent` | 4.5:1 | 13.43 | 10.08 | body on accent tint |
| `--accent-contrast` on `--accent` | 4.5:1 | 6.29 | 8.78 | primary button label |
| `--accent-contrast` on `--accent-hover` | 4.5:1 | 8.34 | 10.96 | primary button hover label |
| `--text-inverse` on `--text` | 4.5:1 | 16.46 | 14.92 | inverse chip |
| `--chart-1` on `--bg-elevated` | 3.0:1 | 5.36 | 6.98 | chart mark vs card |
| `--chart-2` on `--bg-elevated` | 3.0:1 | 4.97 | 6.45 | chart mark vs card |
| `--chart-3` on `--bg-elevated` | 3.0:1 | 5.74 | 7.73 | chart mark vs card |
| `--chart-4` on `--bg-elevated` | 3.0:1 | 5.40 | 6.79 | chart mark vs card |
| `--chart-5` on `--bg-elevated` | 3.0:1 | 4.99 | 9.76 | chart mark vs card |
| `--chart-6` on `--bg-elevated` | 3.0:1 | 7.42 | 7.18 | chart mark vs card |
**The complete token stylesheet, exactly as it appears in `src/ui/tokens/tokens.css`** (includes the type, spacing, radius, motion, layout and scene tokens of §3–§5 and §7):

```css
:root {
  /* typography — families */
  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-text: "Atkinson Hyperlegible Next", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  /* typography — sizes and line heights */
  --text-eyebrow: 12px;  --lh-eyebrow: 16px;
  --text-support: 14px;  --lh-support: 20px;
  --text-body: 18px;     --lh-body: 28px;
  --text-subject: 18px;  --lh-subject: 24px;
  --text-h3: 22px;       --lh-h3: 30px;
  --text-h2: 28px;       --lh-h2: 36px;
  --text-h1: 36px;       --lh-h1: 44px;
  --text-display: 56px;  --lh-display: 60px;
  --metric-md: 28px;     --metric-lg: 40px;   --metric-xl: 64px;
  --track-eyebrow: 0.07em;  --track-heading: -0.01em;  --track-metric: -0.02em;
  /* spacing scale */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  /* radius */
  --radius-control: 8px;  --radius-card: 14px;  --radius-dialog: 18px;  --radius-chip: 999px;
  /* motion */
  --dur-fast: 200ms;  --dur-base: 280ms;  --dur-slow: 400ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-inout: cubic-bezier(0.4, 0, 0.2, 1);
  /* layout */
  --rail-w: 208px;  --workbench-w: 360px;  --gutter: 16px;  --container-max: 1680px;
  --appbar-h: 64px;
  /* focus */
  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}
@media (min-width: 1440px) { :root { --rail-w: 240px; --workbench-w: 380px; --gutter: 24px; } }
@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 1ms; --dur-base: 1ms; --dur-slow: 1ms; } }

:root {   /* light "paper" */
  color-scheme: light;
  --bg: #F6F1E7;
  --bg-elevated: #FFFDF8;
  --bg-sunken: #EBE4D3;
  --bg-overlay: #FFFEFB;
  --border: #D8CDB6;
  --border-strong: #857758;
  --pencil: #3D372D;
  --text: #221D16;
  --text-muted: #5B5142;
  --text-inverse: #FFFDF8;
  --accent: #1B6A62;
  --accent-hover: #145650;
  --accent-contrast: #FFFDF8;
  --success: #3B6A2B;
  --warning: #8F4B00;
  --danger: #A32D2A;
  --degraded: #3F5E85;
  --bg-accent: #D9EAE6;
  --bg-success: #E4EEDC;
  --bg-warning: #F8E7CC;
  --bg-danger: #F6DCD8;
  --bg-degraded: #DDE5F0;
  --chart-1: #0B6FA8;
  --chart-2: #B84F00;
  --chart-3: #00735A;
  --chart-4: #9C4F7D;
  --chart-5: #8A6A00;
  --chart-6: #4B4B9C;
  --scene-bg: #EBE4D3;
  --scene-ground: #D8CDB6;
  --scene-accent: #1B6A62;
  --scene-text: #221D16;
  --scene-mat-wall: #FFFDF8;
  --scene-mat-door: #857758;
  --scene-mat-stoop: #D8CDB6;
  --scene-mat-frustum: #3F5E85;
  --scene-mat-pillar: #3D372D;
  --scene-mat-pillar-warn: #8F4B00;
  --scene-mat-pillar-danger: #A32D2A;
  --scene-mat-pillar-dup: #3F5E85;
  --scene-mat-gap: #857758;
  --scene-mat-resolved: #3B6A2B;
  --scene-mat-arc: #1B6A62;
  --elev-1: 0 1px 2px rgba(34,29,22,0.06);
  --elev-2: 0 4px 14px rgba(34,29,22,0.10), 0 1px 3px rgba(34,29,22,0.08);
  --elev-3: 0 18px 44px rgba(34,29,22,0.20), 0 2px 8px rgba(34,29,22,0.10);
}

[data-theme="dark"] {   /* dark "dusk" */
  color-scheme: dark;
  --bg: #12171A;
  --bg-elevated: #1B2226;
  --bg-sunken: #0C1012;
  --bg-overlay: #222B30;
  --border: #2A343A;
  --border-strong: #6C7F8A;
  --pencil: #CFC8B8;
  --text: #EFE9DC;
  --text-muted: #A8A190;
  --text-inverse: #12171A;
  --accent: #5CC0B3;
  --accent-hover: #7ED3C8;
  --accent-contrast: #0C1012;
  --success: #8CC274;
  --warning: #F0A24A;
  --danger: #F08077;
  --degraded: #8FB0DC;
  --bg-accent: #183B38;
  --bg-success: #1F3320;
  --bg-warning: #3A2A12;
  --bg-danger: #3C1F1D;
  --bg-degraded: #1D2C42;
  --chart-1: #56B4E9;
  --chart-2: #F08A3C;
  --chart-3: #3FC9A0;
  --chart-4: #E08FBF;
  --chart-5: #E6C84A;
  --chart-6: #A6A6F2;
  --scene-bg: #0C1012;
  --scene-ground: #2A343A;
  --scene-accent: #5CC0B3;
  --scene-text: #EFE9DC;
  --scene-mat-wall: #1B2226;
  --scene-mat-door: #6C7F8A;
  --scene-mat-stoop: #2A343A;
  --scene-mat-frustum: #8FB0DC;
  --scene-mat-pillar: #CFC8B8;
  --scene-mat-pillar-warn: #F0A24A;
  --scene-mat-pillar-danger: #F08077;
  --scene-mat-pillar-dup: #8FB0DC;
  --scene-mat-gap: #6C7F8A;
  --scene-mat-resolved: #8CC274;
  --scene-mat-arc: #5CC0B3;
  --elev-1: 0 1px 2px rgba(0,0,0,0.40);
  --elev-2: 0 6px 18px rgba(0,0,0,0.50);
  --elev-3: 0 20px 48px rgba(0,0,0,0.60);
}
```
**Scene tokens.** The `--scene-*` custom properties are literal copies of existing tokens (generated from the same table), so the 3D view can never introduce a colour the design system does not own. `DP-3D` reads them with `readTokensFromCss` and defines no colour of its own.

**Cinematic tokens.** `DP-UI` WU-03 writes `cinematic-tokens.json` at the entry root and a byte-identical copy at `../../hackathons/hackathon-projects/2026-10-amazonDevs/cinematic-tokens.json`. Contents (verbatim):

```json
{
  "version": "1.0.0",
  "product": "Doorstep Rhythm",
  "slogan": "Know her day without calling.",
  "video_theme": "paper",
  "themes": {
    "paper": {
      "bg": "#F6F1E7",
      "bg-elevated": "#FFFDF8",
      "bg-sunken": "#EBE4D3",
      "bg-overlay": "#FFFEFB",
      "border": "#D8CDB6",
      "border-strong": "#857758",
      "pencil": "#3D372D",
      "text": "#221D16",
      "text-muted": "#5B5142",
      "text-inverse": "#FFFDF8",
      "accent": "#1B6A62",
      "accent-hover": "#145650",
      "accent-contrast": "#FFFDF8",
      "success": "#3B6A2B",
      "warning": "#8F4B00",
      "danger": "#A32D2A",
      "degraded": "#3F5E85",
      "bg-accent": "#D9EAE6",
      "bg-success": "#E4EEDC",
      "bg-warning": "#F8E7CC",
      "bg-danger": "#F6DCD8",
      "bg-degraded": "#DDE5F0",
      "chart-1": "#0B6FA8",
      "chart-2": "#B84F00",
      "chart-3": "#00735A",
      "chart-4": "#9C4F7D",
      "chart-5": "#8A6A00",
      "chart-6": "#4B4B9C"
    },
    "dusk": {
      "bg": "#12171A",
      "bg-elevated": "#1B2226",
      "bg-sunken": "#0C1012",
      "bg-overlay": "#222B30",
      "border": "#2A343A",
      "border-strong": "#6C7F8A",
      "pencil": "#CFC8B8",
      "text": "#EFE9DC",
      "text-muted": "#A8A190",
      "text-inverse": "#12171A",
      "accent": "#5CC0B3",
      "accent-hover": "#7ED3C8",
      "accent-contrast": "#0C1012",
      "success": "#8CC274",
      "warning": "#F0A24A",
      "danger": "#F08077",
      "degraded": "#8FB0DC",
      "bg-accent": "#183B38",
      "bg-success": "#1F3320",
      "bg-warning": "#3A2A12",
      "bg-danger": "#3C1F1D",
      "bg-degraded": "#1D2C42",
      "chart-1": "#56B4E9",
      "chart-2": "#F08A3C",
      "chart-3": "#3FC9A0",
      "chart-4": "#E08FBF",
      "chart-5": "#E6C84A",
      "chart-6": "#A6A6F2"
    }
  },
  "fonts": {
    "display": "Fraunces",
    "text": "Atkinson Hyperlegible Next",
    "mono": "JetBrains Mono"
  },
  "motion": {
    "fast_ms": 200,
    "base_ms": 280,
    "slow_ms": 400,
    "ease_out": "cubic-bezier(0.2, 0, 0, 1)"
  },
  "radius": {
    "control": 8,
    "card": 14,
    "dialog": 18
  }
}
```
### §5.3 Typography (identity §3) — contains the *machine-read* `@font-face` lines

#### §3 Typography

Two families plus one mono, all **self-hosted variable `woff2`** (SIL OFL), copied by `DP-UI` WU-03 from the pinned fontsource packages: `@fontsource-variable/fraunces@5.3.0`, `@fontsource-variable/atkinson-hyperlegible-next@5.3.0`, `@fontsource-variable/jetbrains-mono@5.3.0` (files `files/<name>-latin-wght-normal.woff2`) into `public/fonts/`.

| Role | Family | Why |
|---|---|---|
| Display / headings | **Fraunces** (variable, wght 100–900) | The magazine-and-almanac voice; used for words only — Fraunces has no tabular figures, so it never sets a number that updates |
| Text, controls, **all numerals and metrics** | **Atkinson Hyperlegible Next** (variable, wght 200–800) | Designed for legibility at a glance; verified at plan time to carry the `tnum` feature, so live numbers align |
| Identifiers, ids, request ids, trace lines | **JetBrains Mono** (variable, wght 100–800) | Third role, used only for identifiers and code wells |

**`@font-face` lines (verbatim, in `src/ui/tokens/fonts.css`):**

```css
@font-face { font-family: "Fraunces"; src: url("/fonts/fraunces-latin-wght-normal.woff2") format("woff2");
  font-weight: 100 900; font-style: normal; font-display: swap; }
@font-face { font-family: "Atkinson Hyperlegible Next"; src: url("/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2") format("woff2");
  font-weight: 200 800; font-style: normal; font-display: swap; }
@font-face { font-family: "JetBrains Mono"; src: url("/fonts/jetbrains-mono-latin-wght-normal.woff2") format("woff2");
  font-weight: 100 800; font-style: normal; font-display: swap; }
```

`index.html` `<head>` preloads the first two files (`<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/…">`). The fallback stacks (`Georgia`; `Segoe UI`/`system-ui`) are metrically close enough that the swap does not reflow the 1280×720 layout. Body rule: `body { font-family: var(--font-text); font-size: var(--text-body); line-height: var(--lh-body); font-feature-settings: "tnum" 1; }` is **not** applied globally — `tnum` is applied by the metric and by any element with `data-metric` or class `tnum` (`font-variant-numeric: tabular-nums`).

**Type scale (literal):**

| Role | Token / size | Line height | Weight | Tracking | Family | Colour | Used for |
|---|---|---|---|---|---|---|---|
| display | `--text-display` 56 px | 60 px | 700 | `-0.01em` | Fraunces | `--text` | empty-state headline, explainer title |
| h1 | `--text-h1` 36 px | 44 px | 650 | `-0.01em` | Fraunces | `--text` | page title "The week of 12 October" |
| h2 | `--text-h2` 28 px | 36 px | 650 | `-0.01em` | Fraunces | `--text` | incident headline |
| h3 | `--text-h3` 22 px | 30 px | 650 | `-0.01em` | Fraunces | `--text` | surface titles |
| body | `--text-body` 18 px | 28 px | 400 | 0 | Atkinson | `--text` | paragraphs, lead sentence, list items |
| **subject** | `--text-subject` 18 px | 24 px | 650 | `-0.01em` | Atkinson | `--text` | the value or name in a group |
| **support** | `--text-support` 14 px | 20 px | 400 | 0 | Atkinson | `--text-muted` | qualifier, time, source, unit |
| **eyebrow** | `--text-eyebrow` 12 px | 16 px | 700 | `+0.07em`, uppercase | Atkinson | `--text-muted` | what this thing is |
| control | 16 px | 24 px | 600 | 0 | Atkinson | `--text` | buttons, inputs, switches |
| primary control | 18 px | 24 px | 650 | 0 | Atkinson | `--accent-contrast` | the one filled primary per region |
| mono | 14 px | 20 px | 400 | 0 | JetBrains Mono | `--text` | ids, request ids, code wells |
| **metric-md** | `--metric-md` 28 px | 1.05 | 700 | `-0.02em` | Atkinson, `tnum` | `--text` | per-device and per-day counts |
| **metric-lg** | `--metric-lg` 40 px | 1.05 | 700 | `-0.02em` | Atkinson, `tnum` | `--text` | dwell minutes in the incident card |
| **metric-xl** | `--metric-xl` 64 px | 1.05 | 700 | `-0.02em` | Atkinson, `tnum` | `--text` (accent when 0) | the hero metric: open checks |

**Camera rule inside `[data-demo-focus]`:** any string the camera must read is body size (18 px) or larger; eyebrow and support text never carry the only copy of a fact. Numerals the camera reads are ≥ 28 px; the hero metric is 64 px.

**Digit budgets.** Hero metric (open checks): budget `99` plus a unit word — at 64 px Atkinson tabular figures a 3-digit value is ≈ 120 px, inside the 164 px minimum metric cell; ≥ 100 shows `99+` with the exact value in `title`. Dwell minutes: budget `999` (`999 min`); counts above 9 999 abbreviate (`12.8k`). Tokens/cost: `$0.0000`–`$99.9999`. Clock times are `HH:MM` (24-hour, tabular).
### §5.4 Spacing, radius, elevation, borders (identity §4)

#### §4 Spacing, radius, elevation, borders

**Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px = `--space-1…--space-8`. Rules: gap between a label and its value 4 px; between lines inside a group 8 px; between groups inside a surface 16 px; surface padding 24 px (never below 16 px); between surfaces 16 px at < 1440 px and 24 px at ≥ 1440 px (`--gutter`); between page sections 32 px. No other spacing number appears.

**Radius:** `--radius-control` 8 px (buttons, inputs, chips' containers), `--radius-card` 14 px (every surface), `--radius-dialog` 18 px (dialogs, popovers), `--radius-chip` 999 px (chips, badges, the switch track).

**Elevation — three steps, named (literal values are the `--elev-*` tokens in §2):**

| Step | Token | Use | Light | Dark |
|---|---|---|---|---|
| 1 rest | `--elev-1` | every resting surface | `0 1px 2px rgba(34,29,22,0.06)` + 1 px `--border` | `0 1px 2px rgba(0,0,0,0.40)` + 1 px `--border`, surface `--bg-elevated` |
| 2 float | `--elev-2` | popovers, sticky approval bar, toasts, dropdowns | `0 4px 14px rgba(34,29,22,0.10), 0 1px 3px rgba(34,29,22,0.08)` on `--bg-overlay` | `0 6px 18px rgba(0,0,0,0.50)` on `--bg-overlay` (lighter than `--bg-elevated`) |
| 3 modal | `--elev-3` | dialogs (explainer panel), the Connect dialog | `0 18px 44px rgba(34,29,22,0.20), 0 2px 8px rgba(34,29,22,0.10)` | `0 20px 48px rgba(0,0,0,0.60)` on `--bg-overlay` |

**Surface recipe — every card obeys it (`[data-surface]`, verbatim):**

```css
[data-surface] { background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-card); padding: var(--space-5); box-shadow: var(--elev-1);
  min-width: 0; }
[data-surface] > header { display: flex; align-items: center; gap: var(--space-2);
  padding-bottom: var(--space-3); margin-bottom: var(--space-4); border-bottom: 1px solid var(--border); }
[data-surface][data-well] { background: var(--bg-sunken); border-radius: var(--radius-control);
  padding: var(--space-4); box-shadow: none; }                /* nested wells: bg-sunken inside bg-elevated, border kept */
[data-surface][data-elevation="2"] { background: var(--bg-overlay); box-shadow: var(--elev-2); }
[data-surface][data-elevation="3"] { background: var(--bg-overlay); box-shadow: var(--elev-3);
  border-radius: var(--radius-dialog); }
/* THE ONE DEVICE: a 3 px accent rule on the leading edge of the primary panel — at most one per column */
[data-surface][data-emphasis="primary"] { border-left: 3px solid var(--accent); }
```

A card never sits on a card of the same token; nested wells step to `--bg-sunken`; two cards never touch (a `--space-4` or `--space-5` gap). Titled surfaces use a header row: eyebrow above subject/h3, divider below.

**Calendar grid hairlines (the ribbon only):** 1 px `--border`, `--pencil` ticks 2 px thick with round caps.
### §5.5 Motion (identity §5)

#### §5 Motion

All durations come from `--dur-fast` 200 ms, `--dur-base` 280 ms, `--dur-slow` 400 ms; easings `--ease-out` `cubic-bezier(0.2, 0, 0, 1)` and `--ease-inout` `cubic-bezier(0.4, 0, 0.2, 1)`. Motion is reserved for state change; nothing animates on load except the section enter. Under `prefers-reduced-motion: reduce` the three duration tokens become 1 ms (so every transition below collapses to an instant change) and the loops in the work indicator become static.

| Name | What moves | Trigger | Duration / easing | Reduced-motion substitute |
|---|---|---|---|---|
| `section-enter` | opacity 0→1, translateY 8px→0 on a route's surfaces | route change | 280 ms `--ease-out`, 40 ms stagger (max 4 children) | instant |
| `feed-in` | a new activity row: height 0→auto (via grid-rows 0fr→1fr), opacity 0→1 | trace entry appended (`li.feed-in`) | 280 ms `--ease-out` | instant |
| `changed-flash` | background tint `--bg-accent` → transparent behind the changed entity (kit `ChangedFlash` class `changed-flash`) | store entity changed | 400 ms `--ease-inout` (the kit holds the class for 900 ms; the CSS animation is 400 ms) | instant, tint held 900 ms |
| `count-up` | metric value tweens from previous to next | metric value changes | 360 ms `--ease-out` (JS tween, integers only) | instant |
| `pencil-circle` | SVG circle `stroke-dashoffset` from full length → 0 around an incident cluster | incident opened or selected | 360 ms `--ease-out` | full circle, no draw |
| `tick-in` | a new event tick scales Y 0→1 from its baseline | event ingested | 240 ms `--ease-out` (within 200–400 ms) | instant |
| `work-indicator` | three pencil ticks pulse in sequence | an action or model call in flight > 400 ms | 1200 ms loop (ambient, allowed) | static three ticks and the text |
| `success-confirm` | border-colour and tint flash to `--success`/`--bg-success` then settle | approval accepted, check at 0 | 400 ms `--ease-inout` | tint held 400 ms |
| `error-flash` | border-colour and tint flash to `--danger`/`--bg-danger` then settle (no shake) | action failed | 360 ms `--ease-inout` | tint held 360 ms |
| `theme-fade` | `background-color`, `color`, `border-color` on `body` and surfaces | theme toggle | 240 ms `--ease-inout` | instant |
| `dialog-enter` | dialog opacity 0→1 and scale 0.98→1; backdrop opacity 0→0.5 | explainer / connect dialog | 280 ms `--ease-out` | instant |
| `popover-enter` | opacity 0→1 and translateY 4px→0 | `?` popover | 200 ms `--ease-out` | instant |
| `scene-rise` | 3D pillar height 0→h and camera shot transition | store change / shot call | the scene reads `--dur-slow` for pillars and 800 ms for shot moves (the 3D contract's 600–1200 ms) | instant cut |
### §5.6 Component specs (identity §6)

#### §6 Component specs

**§6.0 The interactive-state recipe (every control).** Default: 1 px `--border-strong` border, transparent background, `--text` label, `--radius-control`, min-height 40 px (44 px at ≤ 1024 px). Hover: background `--bg-sunken`. Focus-visible: `box-shadow: var(--focus-ring)` (never `outline: none` without it). Active: `transform: translateY(1px)`. Disabled: `--text-muted` label on `--bg-sunken`, `aria-disabled="true"`, `cursor: not-allowed`. Loading: the label stays, a 14 px spinner glyph (three ticks) replaces the leading icon, `aria-busy="true"`. **Primary** (one per region): `--accent` fill, `--accent-contrast` label at 18/650, hover `--accent-hover`, border none. **Ghost**: no border, `--text` label, hover `--bg-sunken`. **Danger**: border and label `--danger`, hover fill `--bg-danger`. Icons are `lucide-react` 18 px, stroke 2, `aria-hidden` unless icon-only (then `aria-label` is mandatory).

**§6.1 AppBar** — purpose: identity and the three global controls. Anatomy: `header` height 64 px, `--bg-elevated`, bottom border 1 px `--border`, content inset to the page grid. Left to right: **Brandmark lockup** (`.brandmark--header`), **"How this works"** (ghost button with a `CircleHelp` icon, `data-app-explainer`), spacer, **Ring status chip**, **Agent status chip**, and — below 1024 px only — the **ThemeToggle**. Below 480 px the lockup collapses to the mark. Roles: chips are eyebrow (label) + subject (value). States: default only; chips show the degraded tint (§9A) when not on the top rung. Motion: `theme-fade`.

**§6.2 ThemeToggle** — placement: the **rail footer at ≥ 1024 px** (the rail is sticky to the viewport bottom, so the toggle is always visible without scrolling or opening a menu; it sits there because it is a quiet setting belonging with the household preferences), and in the app bar's right cluster below 1024 px where the rail becomes a drawer. Anatomy: a two-segment control "Paper" / "Dusk" (`role="radiogroup"`, each segment a `button role="radio"` with `aria-checked`), icons `Sun` and `Moon`. Persists to `localStorage` key `dr-theme` (`"light"` or `"dark"`); first load honours `prefers-color-scheme` through an inline script in `index.html` that sets `document.documentElement.dataset.theme` before first paint. States: selected segment `--bg-accent` fill, `--accent` label and a 2 px `--accent` bottom rule; focus ring per §6.0. Motion: `theme-fade`.

**§6.3 Surface** — §4 recipe; component `Surface({ title?, eyebrow?, emphasis?, elevation?, well?, help?, children })` renders `[data-surface]`, an optional `header` (eyebrow above the title, `HelpTip` at the end), and sets `data-result-region="<id>"` when it renders a result.

**§6.4 Metric** — `Metric({ label, value, unit?, support?, size, tone? })`. Anatomy (three roles): `eyebrow` label; value at `--metric-md|lg|xl`, weight 700, `font-variant-numeric: tabular-nums`, `white-space: nowrap`; unit as a separate muted 14/500 element; optional `support`. Paired values use `<span class="metric__sep">/</span>`. Class names: `.metric`, `.metric__value`, `.metric__unit`, `.metric__sep`; `data-metric` on the value. Abbreviate past 10 000 (`12.8k`), exact value in `title`. The hero metric's colour is `--accent` when the value is 0, `--warning` when > 0 and ≤ 5 errors-and-warnings, `--danger` when the check has errors. States: default; loading (value replaced by three muted ticks, same box so the layout does not jump); empty (`—`); error (value `—` plus an inline callout in the owning surface). Motion: `count-up`.

```css
.metric{display:flex;flex-direction:column;gap:var(--space-1);min-width:0}
.metric__value{font-family:var(--font-text);font-variant-numeric:tabular-nums;white-space:nowrap;
  font-size:var(--metric-lg);font-weight:700;letter-spacing:var(--track-metric);line-height:1.05;color:var(--text)}
.metric__value--xl{font-size:var(--metric-xl)} .metric__value--md{font-size:var(--metric-md)}
.metric__sep{color:var(--text-muted);font-weight:400;padding:0 0.25em}
.metric__unit{font-size:var(--text-support);font-weight:500;letter-spacing:0;color:var(--text-muted);margin-left:var(--space-2)}
```

**§6.5 HelpTip (`?`)** — a 20 px circular glyph inside a 44 px touch target (32 px visual button at ≥ 1024), `--text-muted`, `--accent` on hover and focus, placed at the end of a surface header. Click-activated popover (`role="dialog"`, `data-elevation="2"`, max-width 320 px, support-size copy), closes on `Esc`, on outside click and on a second press. `aria-label` is the subject-naming string from §6A (never "Help"). `data-help-for="<region id>"`. States: default, hover, focus-visible, open. Motion: `popover-enter`.

**§6.6 WorkIndicator** — three pencil ticks (the brand's own shape) pulsing, plus a text line from the live step: `{label}` from the phase table in §9 (fallback sentence "Working on the week"). It lives **inside the surface that owns the work** (the Agent panel header while a review runs; the Check panel while the check runs), `role="status"`, `aria-live="polite"`. Motion: `work-indicator`.

**§6.7 System messages (three tiers, craft §5)** — *Banner*: directly beneath the app bar, full-bleed tint background, content inset to the page grid (same left edge as the main column), anatomy: glyph (shape, 20 px) + subject-weight title + support-role detail (a sentence or a `dl` of "step → what happened") + optional single action button; `role="status"` (or `role="alert"` for errors); tint/border/glyph per tone (§9A). *Callout*: inside the owning surface above its body, same anatomy, `--radius-control`, 3 px left rule in the tone colour. *Toast*: bottom-right, `data-elevation="2"`, auto-dismiss 4 s, `role="status"`, never the only carrier of information. Tones: info (accent), success, warning, danger, degraded — glyphs `Info`, `CircleCheck`, `TriangleAlert`, `OctagonX`, `Layers`. All copy is a total template (§9).

**§6.8 Badge / chip** — `SourceBadge`: eyebrow type, `--radius-chip`, 1 px border; AGENT = `--bg-accent` fill, `--accent` text and border; YOU = `--text` fill, `--text-inverse` text; SYSTEM = `--bg-sunken` fill, `--text-muted` text, `--border-strong` border. `StatusChip`: tone tint + border + glyph + word (needs a look / resolved / failed / degraded / simulated). `SyntheticBadge`: the words "Sample week · synthetic" in `--bg-sunken` with `--border-strong`, shown on the household card and beside the page title whenever `ring.mode === "bundle"`.

**§6.9 Rail** (240 px at ≥ 1440, 208 px at 1280–1439, drawer below 1024 px; `--bg` ground, no outer card; sticky; the theme toggle is its footer). Surfaces, top to bottom:
- *HouseholdCard*: eyebrow "Household", subject "Rosa Alvarez · 84" (display name from `WeekModel.household`), support "Front door and hall camera", the `SyntheticBadge`.
- *DeviceList*: two rows (doorbell, hall camera); each row = state chip (online / offline word + glyph), subject name, support "2 cameras" for the Elite device; the offline row gets `--bg-danger` + `--danger` left rule only when truly offline.
- *QuietHoursEditor* (`data-result-region="quiet-hours"`, with `HelpTip`): eyebrow "Quiet hours", subject "22:00–07:00", support "±30 min margin"; two `input type="time"` controls and a margin stepper; changes dispatch `set_quiet_hours`; shows the effective window as support text ("Checks from 22:30 to 06:30").
- *ConsentList* (`data-result-region="consent"`): three rows with `role="switch"` controls — "Family messages", "Chime announcements", "Weekly brief"; each row: subject label, support line saying who it reaches ("Marta by message", "Spoken on the hall chime", "Marta, Sunday evening"), switch; switching on dispatches `set_consent` with `actor: "human"`; the agent can never do it.
- *ConnectPanel*: primary-less ghost button "Connect Ring" opening the Connect dialog (paste a Playground token; shows "Token expires in {m} min" afterwards); disabled-state copy "Using the sample week".
- *WebhookInboxPill*: eyebrow "Webhooks", metric-md count, support "waiting"; a "Simulate a doorbell press" ghost button appears only when the server reports `simulate: true`.
- *ThemeToggle* (footer).

**§6.10 Main column** (flex, min 560 px), top to bottom:
- *WeekTitle*: h1 "The week of 12 October" (date computed from the model; template total), support line "Rosa's front door · {sourceLabel}" with the `SyntheticBadge` when applicable.
- *WeekSummary* (`data-result-region="open-checks"`, `HelpTip`): left, the **hero Metric** (`xl`, label "Open checks", unit "to look at" or "all clear"); right, the **lead sentence** in body size (Apple-Health-Highlights borrowing), composed by a total template from the check counts: `0` → "All clear — the week matched the usual rhythm."; `n` → "{n} moment(s) broke the usual rhythm. Start with the first circled day." (singular/plural branch).
- *SceneStage* (`DP-3D` renders here): a `[data-surface][data-well]` of fixed aspect 16:5 (min-height 240 px at 1280, 300 px at ≥ 1440), carries `data-demo-3d`, `data-result-region="scene-3d"`, `HelpTip`, and a toolbar of three shot buttons (Overview, Focus, Walk) — ghost buttons, `aria-pressed`.
- *WeekRibbon* (`data-result-region="week-ribbon"`, `HelpTip`): the paper calendar — see §6.11.

**§6.11 WeekRibbon (the memorable object).** Seven day columns Mon–Sun, each a button (`aria-label="Tuesday 13 October, 3 events, 1 moment to look at"`; selecting dispatches `set_ui` and the day gets a 2 px `--accent` bottom rule and `--bg-accent` header band). Column header: eyebrow weekday (`MON`), subject day number (tabular, `--pencil`). Column body: height 200 px at 1280 (240 px at ≥ 1440), time axis top = 00:00, bottom = 24:00; hour hairlines every 6 hours (`--border`); **quiet-hours bands** (`--bg-sunken` fill, 0–06:30 and 22:30–24:00 for the effective window); **event ticks** — 2 px `--pencil` horizontal strokes 14 px wide at the event's time; **visits** — 6 px wide `--pencil` vertical bars spanning arrival→departure; **duplicate marks** — a tick drawn in `--degraded` and doubled (appears only before repair); **outage band** — diagonal hatch (`repeating-linear-gradient(135deg, var(--degraded) 0 2px, transparent 2px 6px)`) at 40 % opacity over the offline interval, labelled with the duration in support text ("47 min offline"); **webhook/history seam** — a 1 px dashed `--degraded` line at the instant the history poll took over, with an eyebrow label "from history". **Incident circle** — an SVG ellipse in `--warning` (error: `--danger`; resolved: `--success`) 2.5 px stroke, drawn around the incident's cluster, `pencil-circle` motion, a 44 px target that selects the incident. Row below the columns: baseline strip — support text "Usual: visits under {p90} min; busiest {hour}". States: default; day selected; loading (columns show three muted ticks); empty (columns blank with the empty-state surface below); error (callout above the grid); degraded (outage hatch and seam are the degraded indicators). Digit rule: counts ≤ 99 per day column.

**§6.12 Workbench** (360 px at 1280–1439, 380 px at ≥ 1440; carries the route's single `data-demo-focus="workbench"` on its container; stacks, `--space-4` between):
- *AgentPanel* (`data-surface`, `data-emphasis="primary"` — the one accent-rule surface in this column): header = eyebrow "Agent" + subject provider label ("Amazon Bedrock · {modelLabel}") + `HelpTip` (`agent-status`); body = the **primary button "Review the week"** (18/650, full width), the `WorkIndicator` line while running, and, below, the phase list (7 phase names, the current one in `--accent` with a filled tick, finished ones with a check glyph — each phase also has its word, so colour is never the only cue).
- *CheckPanel* (`data-result-region="check-panel"`): header eyebrow "Checks" + count badge (`errors + warnings`, tabular) + `HelpTip`; body = `IssueRow`s — each row: state chip (Error / Warning with glyph), subject = the issue message with units ("2 duplicate events within 38 s at the front door"), support = rule name in plain words ("Duplicate events") and the day/time; a row with `fix` shows a ghost button "Merge duplicates" (runs the fix action as `source: "human"`); tinted row background (`--bg-danger` / `--bg-warning`) + left rule; when the list is empty, the template "No open checks — the last run found nothing to fix."
- *IncidentCard* (`data-result-region="incident-card"`): eyebrow = day and time ("TUE 13 OCT · 02:14"), h2 headline (narrator's one-line title), body (≤ 3 lines, clamped with Show more), a support line with the facts (duration `Metric md` "22 min", "usual under 6 min", "quiet hours"), the evidence snapshot (aspect 16:9, `--bg-sunken` well, caption "Snapshot · hall camera · {time}" — or the callout "No snapshot for this moment" ), notes list, status chip, and the actions "Mark as explained", "Dismiss" (ghost). `ChangedFlash` wraps it.
- *NudgeCard* (`data-result-region="nudge-card"`): eyebrow "Suggested message", subject the proposed text (clamped), support "To Marta · family messages {on|off}", actions "Approve" (primary) / "Reject" (ghost) which dispatch `decide_nudge` as `source: "human"`.
- *ApprovalBar* (kit `ApprovalBar` in a wrapper `[data-surface][data-elevation="2"]`, `data-result-region="approval-bar"`, sticky to the bottom of the workbench while a request is pending): the kit's "AGENT WANTS TO {summary}" line at subject weight in a `--bg-warning` band with a `ShieldQuestion` glyph, **Approve** (primary) and **Reject** (danger-ghost) buttons side by side, the "Require approval" checkbox restyled as a switch in the surface footer. When nothing is pending the wrapper collapses to the footer row (support text "Nothing is waiting for you.").
- *ActivityFeedPanel* (`data-result-region="activity-feed"`, flex-fill): `[data-surface][data-well]` containing the kit's `ActivityFeed` fed by a **friendly trace view** (`createFriendlyTrace`, DP-UI): action names replaced by their descriptor titles, role names by "Reader / Planner / Agent / Writer", `state_change` and `truth` folded into the sentence. Row anatomy by descendant selectors on the kit markup (`li > span:first-child` = source badge in eyebrow type with a 1 px border; `li > strong` = subject; remaining `span` = support): grid `auto 1fr`, 8 px gap, rows separated by 1 px `--border`, 56 px max height clamp with Show more. Newest at the bottom; the well scrolls (`max-height` fills the column; `overflow: auto`). Motion `feed-in`, `changed-flash`.
- *ManualRunner* (kit `ManualRunner` in a `<details>` surface titled "Run an action by hand", closed by default; the field labels come from the schema; result line in support type; `data-result-region="manual-runner"` is **not** set because it shows no verdict).
- *LiveViewPanel* (`data-result-region="live-view"`): shown only after "Live view" is pressed in the incident card or the device row; a `<video>` in a 16:9 `--bg-sunken` well, an eyebrow "Live · hall camera", a countdown metric-md "{n} s left", ghost "Close" button. Auto-closes at 30 s (battery) / 60 s (line-powered), per `RingStatus`.

**§6.13 Dialogs.** *ExplainerPanel* (`data-app-explainer-panel`, §6A copy; `data-surface data-elevation="3"`, max-width 640 px, scrolls past 90 vh, `role="dialog" aria-modal="true"`, traps focus, closes on `Esc` and backdrop). *ConnectDialog* (paste a Playground token into a mono `input`, "Use this token" primary, "Cancel" ghost; helper text "The token stays in this tab's memory and is never written to a file."). Motion `dialog-enter`.

**§6.14 EmptyState** — a `[data-surface]` with a display-size headline, body sentence and the one primary action; includes a single 120 px pencil-circle motif (SVG, `--border-strong` stroke, the only decoration, confined to empty states).
### §5.6A Help content (identity §6A)

#### §6A Help content (`src/ui/help/helpContent.ts`, one module, keyed by region id)

| Region id | `aria-label` of the `?` | Popover copy |
|---|---|---|
| `week-ribbon` | What is the week calendar? | One column per day, from midnight at the top to midnight at the bottom. Each pencil tick is something at the door; a circle means the usual rhythm broke there. Shaded bands are quiet hours. |
| `open-checks` | What does the open checks number mean? | How many things the checker still wants a person to look at, counting errors and warnings from the latest check. A calm week reads 0. |
| `check-panel` | What is the check panel? | A fixed set of rules runs over the week every time anything changes: quiet hours, long visits, a device that went quiet, consent and duplicate events. Each line says what it found, in minutes. |
| `incident-card` | What is an incident? | A moment that broke the usual rhythm, written up in plain words. The agent drafts it, a person reads it, and nothing leaves this app until a person says so. |
| `nudge-card` | What is a suggested message? | A short note the agent proposes to send. It stays a suggestion until you approve it, and only reaches channels you have switched on. |
| `activity-feed` | What is the activity feed? | Every step in order: who did it (AGENT, YOU or SYSTEM), what it was and whether it worked. The same list is saved as the run trace. |
| `approval-bar` | What is the approval bar? | Anything that reaches outside this app waits here until you press Approve or Reject. If you reject, the agent is told and asks what to do instead. |
| `baseline` | What is the usual rhythm? | The household's own normal, learned from the earlier days: how long visits usually last and when the door is busy. Each day is compared with it. |
| `scene-3d` | What is the doorway view? | The same week drawn as a doorway with a column for each day. Pillars mark events and rise as new ones arrive. Pick one to see it in the calendar. |
| `live-view` | What is live view? | A short look through the camera, opened only when you press the button and closed by itself after 30 seconds. |
| `ring-status` | What does the Ring status show? | Whether this page is reading the sample week or a real Ring account, and how long a pasted token has left. |
| `agent-status` | What does the agent status show? | Which model is doing the thinking right now and how much of the demo budget is used. If it falls back to another model, this says so. |
| `consent` | What are the consent switches? | Each outgoing channel is off until a person turns it on here. The agent cannot switch these on. |
| `quiet-hours` | What are quiet hours? | The hours when activity at the door is unusual for this house. They start as 10 pm to 7 am with a 30-minute margin on each side. |

**Primary explainer panel copy (verbatim).**
- Title (display): **How Doorstep Rhythm works**
- *What it does:* Doorstep Rhythm turns a doorway's comings and goings into a calm week you can read at a glance, and points out only the moments that broke the household's usual rhythm.
- *Who it is for:* Someone who lives far from a parent who lives alone. A daily check-in call can feel like surveillance; the doorway can answer the same question without a call.
- *How it flows:* 1. Events from the Ring doorbell and camera arrive and are placed on the week. 2. An agent reads the week, opens an incident for each broken rhythm and runs the checker. 3. It fixes what the checker finds, then explains each incident in plain words. 4. Anything that would leave the app, such as a message or a chime, waits for your approval.
- *How to read it:* Ticks are events. A pencil circle is a moment worth a look. The number at the top is how many checks are still open; the goal is zero.
- *Try it:* primary button **Review the sample week** (loads the sample week if needed and starts the review).
### §5.7 Layout (identity §7)

#### §7 Layout

**Grid.** One container, `max-width: var(--container-max)` (1680 px), centred, side padding `--gutter`; three columns `var(--rail-w) minmax(0, 1fr) var(--workbench-w)` with `--gutter` gaps. Every banner, card and header shares the same left edge as its column.

| Width | Behaviour |
|---|---|
| **≥ 1440 px** (the judge's screen) | rail 240, main flexible, workbench 380; gutters 24; ribbon columns 240 px tall; scene stage 300 px min height |
| **1280×720** (the recording viewport) | rail 208, main ≈ 656, workbench 360; gutters 16; ribbon columns 200 px tall; scene stage 240 px min height; the route's single demo focus is the workbench |
| **1024 px** | rail becomes a left drawer opened by a "Household" ghost button in the app bar; main and workbench two columns (workbench 340); the ThemeToggle moves into the app bar |
| **390 px** | single column in this order: title, summary, ribbon (horizontally scrollable columns, 72 px each, snap), scene stage (16:9), Agent panel, Check panel, incident card, nudge card, activity feed; the primary "Review the week" button is sticky to the bottom; the rail is a drawer; the app bar shows the mark alone |

**Which region carries the memorable idea:** the WeekRibbon, directly under the 3D stage, with the hero metric above it; the camera's focus on `/` is the workbench (where the agent's work is visible), the 3D stage carries `data-demo-3d`.

**Routes.** `/` — the full product. `/watch` — a replay of the saved run (owned by DP-SHOWCASE; same shell, a labelled "Replay" banner, its own single `data-demo-focus="replay"`). `/lab` — the 3D tuning page (owned by DP-3D; its own single `data-demo-focus="lab"`).

**Quiet frame per route.** `/`: the state after a finished review with all checks at 0, no toast, no running indicator, no pending approval. `/watch`: the replay paused at its end. `/lab`: the scene idle with the panel closed.
### §5.8 Library stack (identity §8)

#### §8 Library stack

| Package | Pinned version | Used for | If it fails to load |
|---|---|---|---|
| `react`, `react-dom` | 19.3.0 | UI | n/a (required) |
| `vite` | ^8.3.2 (already ^8.2.2 in the repo; kept) | dev server and build | n/a |
| `@vitejs/plugin-react` | 6.1.2 | JSX | n/a |
| `react-router` | 8.4.0 | routes `/`, `/watch`, `/lab` | n/a |
| `lucide-react` | 1.52.0 | 18 px icons (tree-shaken) | glyphs absent; every control keeps its text label or `aria-label` |
| `@fontsource-variable/fraunces`, `…/atkinson-hyperlegible-next`, `…/jetbrains-mono` | 5.3.0 each (dev dependencies; files copied to `public/fonts/`) | typefaces | fallback stacks of §3 |
| `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, `leva` | 0.186.1, 9.8.1, 10.7.9, 3.1.3, 6.39.5, 0.10.1 | the 3D view via the hee `three-scene` kit | capability fallback (§9) |
| `@playwright/test` | 1.62.1 (the repo's existing pin; shared with DP-E2E) | screenshots and measurements | n/a |

No CSS framework, no animation library (CSS transitions plus one 25-line JS tween for `count-up`), no chart library (the ribbon is hand-built SVG/CSS). Zero-dependency CSS: the token stylesheet is the whole styling system.
### §5.9 Empty, loading, error and degraded states (identity §9)

#### §9 Empty, loading, error and degraded states (total templates)

Every template below is a function of typed inputs with a branch for each optional input; no slot can render empty, and no rendered message matches `/(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/`.

| State | Title | Detail (support role) | Action |
|---|---|---|---|
| Empty — no events | **No doorway events yet** | Load the sample week, or paste a Ring Playground token to read your own devices. | Primary "Load the sample week"; ghost "Connect Ring" |
| Empty — no incidents | **Nothing broke the rhythm** | Every visit this week matched the usual pattern. | — |
| Empty — no checks | **No open checks** | The last run found nothing to fix. | — |
| Loading (phase) | *Work indicator text:* `{label}` | `reader` → "Reading doorway events"; `planner` → "Planning the review"; `actor` → "Checking each day against the usual rhythm"; `verify` → "Running the checks"; `repair` → "Fixing what the checks found"; `narrator` → "Writing plain-language notes"; `checkpoint` → "Waiting for your decision"; any other or missing → "Working on the week" | — |
| Error — Ring | **Couldn't read Ring** | with a status: "Ring answered with an error ({status}). The sample week is still available." / without: "Ring didn't answer. The sample week is still available." | "Use the sample week"; "Try again" |
| Error — action | **That didn't work** | `{message}` (the registry's sentence) / when absent: "The action stopped before it finished. Nothing was changed." | "Show details" |
| Degraded — backup model | **Using a backup model** | Amazon Bedrock isn't answering, so a different model is doing this review. Its notes are labelled. | "Show details" |
| Degraded — recorded run | **Replaying a recorded run** | with a date: "The live model isn't reachable, so this is the run saved on {date}." / without: "The live model isn't reachable, so this is a saved run." | — |
| Degraded — by hand | **Running by hand** | No model is available. Every action still works from the action list. | "Open the action list" |
| Degraded — sample week | **Showing the sample week** | Ring couldn't be reached with that token, so this is the synthetic sample week. | "Connect Ring" |
| Warning — token | **Token ending soon** | with minutes ≥ 1: "Your Playground token has {minutes} minutes left." / under one: "Your Playground token has less than a minute left." (singular for 1: "1 minute") | "Paste a new token" |
| Warning — budget | **Demo budget at {pct}%** | The review will stop at the limit. | — |
| Not supported — 3D | **3D view unavailable** | This browser can't draw the doorway, so the flat week below shows the same events. | — |
| Rejected | **Declined** | You declined "{summary}". The agent will ask what to do instead. | — |
### §5.9A Colour deployment (identity §9A)

#### §9A Colour deployment

| Screen | Accent roles (≥ 3) | Semantic states |
|---|---|---|
| `/` | (1) the primary "Review the week" fill; (2) the active day's bottom rule and header band, and the Agent panel's leading rule; (3) data emphasis — the hero metric at 0, the selected event tick and the scene's selected pillar, the AGENT badge | a failed or unresolved check: `--bg-danger` row + `--danger` left rule + glyph + word "Error"; needs-a-look: `--bg-warning` + `--warning` + `TriangleAlert` + "Warning"; resolved: `--bg-success` + `--success` + `CircleCheck` + "Resolved"; degraded: `--bg-degraded` + `--degraded` + `Layers` + "Backup" / "Replay" |
| `/watch` | the paused-end marker, the AGENT badge, the replay control's play fill | degraded banner "Replaying a recorded run" always shown |
| `/lab` | the selected control, the scene accent, the reset button | none |
### §5.10 Screenshot acceptance list (identity §10)

#### §10 Screenshot acceptance list (DP-UI WU-14 writes all to `design_documents/ui-screenshots/`, 1440×900 unless stated)

`home-paper.png`, `home-dusk.png`, `home-1280x720-paper.png` (the recording viewport), `appbar-paper.png`, `appbar-dusk.png`, `explainer-open-paper.png`, `help-popover-paper.png`, `working-paper.png` (in-flight indicator with its text), `empty-paper.png`, `error-paper.png`, `degraded-paper.png` (banner with icon, title, detail), `metrics-widest-paper.png` (hero metric at `99+`, dwell at `999`, cost at `$99.9999`), `approval-pending-paper.png`, `incident-selected-paper.png`, `ribbon-detail-paper.png`, `lockup-contact-sheet.png` (mark at 16/24/32/64/512 px in both themes), `home-390-paper.png`, `home-390-dusk.png`, `lab-paper.png`, `watch-paper.png` — 20 files; the command prints the list and `screenshots: 20 written`.
### §5.11 The UI craft contract (§2–§8, §10 and §11 reproduced; §11 is the assertion block)

> **Verbatim contract — UI CRAFT SPEC (§2,§3,§4,§5,§6,§7,§8,§10,§11).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §2 Typographic hierarchy — no two lines in a group look the same

The single largest difference between a designed screen and a debug screen is that on a designed
screen, **every line's treatment tells you what kind of line it is** before you read it.

**The two-axis rule.** Whenever two or more text elements sit in one group and carry *different kinds
of meaning*, they MUST differ on at least **two** of these axes:

- size (a step on the type scale, not 1px),
- weight (≥200 units apart: 400 vs 650, not 500 vs 550),
- colour (`--text` vs `--text-muted` vs `--accent`),
- case + tracking (uppercase at +0.06em is a different object from sentence case at 0),
- family (text vs mono — mono earns its place on identifiers, hashes, code and paths).

One axis is not enough: grey-and-slightly-smaller still reads as one undifferentiated block.

**The canonical three-role stack.** Most groups in a data product are one of these; specify all three
in the identity plan's type scale and reuse them everywhere:

| Role | Treatment | Carries |
|---|---|---|
| **eyebrow** | 11–12px, weight 650, uppercase, +0.06–0.08em, `--text-muted` | what this thing IS — the label, the column head, the category |
| **subject** | the group's largest step, weight 650–800, `--text`, tight tracking (−0.01em) | the value, the name, the answer |
| **support** | 13–14px, weight 400, `--text-muted`, normal tracking | the qualifier, the timestamp, the source, the unit |

```html
<div class="metric">
  <span class="eyebrow">Tokens in / out</span>
  <span class="metric__value">4 586 <span class="metric__sep">/</span> 2 863</span>
  <span class="support">replay run · both passes agreed</span>
</div>
```

**Lists are groups too.** A rail of ten status rows is not ten identical lines: the *state* is an
eyebrow-weight chip, the *name* is subject-weight, and a row whose state differs from its neighbours
(the one error among nine successes) is additionally differentiated by a tinted row background and a
border — §6. If every row in a list looks identical, the list is telling the judge nothing, and the
one row that matters is invisible.

**Never differentiate by colour alone**, in either direction: a colour difference always comes with a
second axis, because 8% of male judges cannot see the first one.

---

##### §3 Surfaces — what a container actually is

A container is a **defined object**. A `<div>` whose only distinction is `background: #F9FAFB` is not
a card; it is a smudge, and the eye does not register an edge where there is none.

**Anatomy — every surface has all of these, literally specified in the identity plan:**

1. a background token that is *not* the page ground (`--bg-elevated` over `--bg`, or `--bg-sunken`
   for wells, logs and code);
2. **a border**: 1px `--border` in light, and in dark a border *plus* a lighter surface, because
   shadows do not read on dark ground;
3. a **radius** token — one radius for cards, a smaller one for controls and chips, used consistently;
4. an **elevation** step where the surface floats (dialogs, popovers, sticky bars) — from the shadow
   ladder, never an ad-hoc `box-shadow`;
5. **internal padding** from the spacing scale, never a bare number, and never less than 16px on a
   card at desktop;
6. a **header treatment** when the surface is titled: a title row with its own eyebrow or subject
   role, separated from the body by a 1px divider or a tinted band — so the card reads as
   *titled content*, not as a title that happens to be first.

**Nested surfaces step one level, and never sit same-on-same.** A well inside a card is `--bg-sunken`
inside `--bg-elevated`; two cards never touch without a gap from the spacing scale; a card never sits
directly on another card of the same token.

**Give surfaces a hairline of character, not a texture.** One restrained device, chosen once and
applied consistently: a 2–3px accent rule on the leading edge of the primary panel, a subtle
tinted header band, a 1px inner highlight at the top edge in dark mode, or a very low-contrast
pattern confined to empty states. **One device, not four.** Gradients on every card, glassmorphism
everywhere, and animated borders all read as a template, not as design.

---

##### §4 Numbers — the metric component

Numbers are the one element whose *content length changes at runtime*, which is why they are the
element that breaks layouts. A number is never just text with a big font size.

**The contract:**

1. **`font-variant-numeric: tabular-nums` on every number that can change.** Without it, digits have
   different widths, values jitter as they update, and columns fail to align.
2. **`white-space: nowrap` on the value.** A metric that wraps is a defect, not a responsive
   behaviour. §11 asserts it.
3. **Size the value for its worst case, not its current one.** Decide the **digit budget** — the
   largest plausible value, including separators and any paired second value — and pick the size that
   fits that string in the narrowest column the component appears in. A counter showing `7` today must
   still fit `1 284 601` tomorrow. A value that is currently three characters does not get a 96px
   display size because it "looks better" at three characters.
4. **Abbreviate past the budget rather than shrinking:** ≥10 000 → `12.8k`, ≥1 000 000 → `1.28M`, two
   significant decimals, with the exact value in a `title` attribute and in the receipt/ledger view.
   Money and durations keep their own conventions (`$0.0010`, `38.0s`).
5. **The unit is a separate, smaller, muted element** — never part of the value string, never the same
   size. `4 586` at subject size, `tokens` at support size beside or beneath it.
6. **Paired values get a separator element**, not a bare slash inside the number: the `/` is muted and
   has its own horizontal padding, so `4 586 / 2 863` reads as two numbers and one relationship.
7. **A metric never inherits a heading role.** Headline sizes are for words. A metric's size comes
   from a dedicated `--metric-*` step in the type scale, chosen against the digit budget.
8. **Right-align numeric columns** in tables; left-align their headers with them.

```css
.metric__value{font-variant-numeric:tabular-nums;white-space:nowrap;
  font-size:var(--metric-lg);font-weight:700;letter-spacing:-0.02em;color:var(--text)}
.metric__sep{color:var(--text-muted);font-weight:400;padding:0 0.25em}
.metric__unit{font-size:var(--text-sm);font-weight:500;color:var(--text-muted)}
```

---

##### §5 System messages — status has a home

Run state, degradation, errors and progress are **first-class UI**, not console output that happens to
have reached the DOM. They get a surface, an anatomy and a place in the layout.

**§5.1 Three tiers, and a rule for choosing.**

| Tier | Use for | Placement |
|---|---|---|
| **Page banner** | a condition affecting the whole run or session: degraded mode, offline, a failed deploy | directly beneath the app bar, full-bleed background if you like, but its **content inset to the same grid and left edge as the main column** |
| **Inline callout** | a condition owned by one panel: this step failed, this section has no data | inside the owning surface, above its body |
| **Toast** | a transient acknowledgement: copied, saved, re-run queued | a fixed corner, auto-dismissing, never carrying information needed later |

Never a fourth thing floating over the layout.

**§5.2 Anatomy — all of these, every time.** A status icon (shape, not colour alone); a **one-line
title in subject weight** naming the condition (*"Running in degraded mode"*); the detail in support
role, as structured content — a short sentence, or a definition list of *which step → what happened*,
never a bare bullet of internal identifiers; and, where the user can act, one button
(*"Retry"*, *"Show details"*). A banner with no title is a shout with no subject.

**§5.3 It is inside the grid.** The banner's content aligns to the same left edge and max-width as
everything else on the page. Text touching the viewport edge is the single clearest signal that a
screen was never laid out.

**§5.4 Message templates must be total.** *"Step draft-1 degraded via none: ."* shipped. Every
template obeys:

- **no empty interpolation slots** — if a value may be absent, the sentence has a variant without it,
  chosen by a branch, not by string concatenation that leaves `: .` behind;
- **no internal identifiers in user-facing prose** unless they are also on screen — `draft-1` is fine
  when the rail shows `draft-1`, `via none` is not;
- **no trailing punctuation from a missing value**; assert it: no rendered message matches
  `/(:\s*[.。]|\s\.\s*$|\bnone\b\s*[:.])/` in the states pass;
- **written as product copy**, sentence case, plain language, no stack-trace fragments.

**§5.5 Every wait says what is happening.** The identity spec already requires a moving indicator with
live text; this spec adds that the indicator lives **in the surface that owns the work** — inside the
panel that will show the result, not floating over the page — and that its text comes from the live
step, with a fallback sentence when no step name exists yet.

---

##### §6 Colour does work

A token table is not a palette until the colours appear on screen. The observed failure is a screen of
grey text on grey surfaces with one accent chip — every semantic colour defined, none of them used.

1. **State is carried by a tinted surface, a border and a glyph — not by coloured text alone.** A
   failed row gets `--bg-fail` behind it, a `--fail` left border or glyph, and the word *failed*. The
   identity spec's "never by colour alone" rule means *add* the non-colour cue, not *remove* the
   colour.
2. **Accent appears in at least three distinct roles per primary screen** — for example the primary
   action, the active navigation state, and a data emphasis (a chart series, a selected row, a
   progress fill). One purple chip on an otherwise grey page means the palette is decoration.
3. **Muted is not the default.** `--text-muted` is for support role text only. When most text on a
   screen is muted, nothing is emphasised and everything looks provisional.
4. **The primary action is unmistakable**: filled with `--accent`, `--accent-contrast` label, the
   largest control on the screen. Secondary actions are outlined or ghost. Never two filled primaries
   in one region.
5. **Dark mode is not inverted light mode.** Elevation comes from lighter surfaces, accents are
   lifted for contrast against dark ground, and pure `#000`/`#FFF` never appear.

---

##### §7 The product explains itself

A judge scoring twenty entries did not build this and will not read the README. An entry that explains
itself on screen is scored on what it does; one that does not is scored on what the judge could guess.
**This is also a Design-axis point for free, and almost nobody does it.**

**§7.1 The primary explainer — a labelled button beside the app title.** Not an icon, not a tooltip:
a real button with a real label — *"How this works"*, *"What is <App>?"* — in the app bar, next to the
brandmark. It opens a dialog or side panel containing, in this order:

1. one sentence on what the product does, in the user's language, not the architecture's;
2. who it is for and the problem it removes;
3. the flow in three to five numbered steps, matching what the UI actually shows;
4. what the main outputs mean — how to read the primary result surface;
5. one action that starts a demo run with seeded data.

It is keyboard reachable, closes on `Esc` and on backdrop click, traps focus while open, scrolls when
it exceeds the viewport, and is at most a screen and a half of reading.

**§7.2 Contextual help — a `?` on everything that shows a result.** Every region that displays a
result, a verdict, a metric group or a control whose effect is not obvious gets a small circular `?`
button:

- **16–20px glyph in a ≥32px control with a ≥44px touch target**, `--text-muted`, `--accent` on hover
  and focus, sitting beside the region's title, never overlapping content;
- **click-activated** (not hover-only — hover does not exist on touch and is not keyboard reachable),
  opening a popover of one to three sentences: what this shows, how to read it, and what a good result
  looks like. It may end with a link that opens the §7.1 panel at the matching section;
- **`aria-label` naming the subject**: `aria-label="What is the sandbox matrix?"` — never a bare
  `aria-label="Help"`;
- dismissed by `Esc`, by clicking away, and by pressing the button again.

**§7.3 One source of copy.** All help text lives in a single module — a `helpContent` map keyed by
region id — so it is reviewable in one place, cannot drift from the UI, and can be reused by the
§7.1 panel. Help copy is written as product prose, and the same voice as the empty and error states.

**§7.4 Coverage rule.** Every surface named in the identity plan's component spec that renders a
*result* or a *verdict* has an entry in `helpContent` and a `?` on screen. §11 asserts the count.

---

##### §8 Nothing renders raw

External or generated text — search results, retrieved documents, model output, logs — is **content to
be presented**, not a string to be printed.

1. **Strip or render markup.** If the source carries markdown, either render it properly or strip it.
   Visible ``` fences, `###` and `[...]` in a panel say nobody looked at the screen.
2. **Clamp long text** to two or three lines with `-webkit-line-clamp` and a *Show more* control.
   No block of body copy runs past ~80 characters per line or past its clamp.
3. **Give retrieved items a structure**: a title (a link when there is a URL), a clamped snippet, and
   a source chip — domain, date, score. Three roles, §2's two-axis rule between them.
4. **Logs and code go in a `--bg-sunken` well** in the mono family, with `overflow:auto`, their own
   max-height, and a copy control. They never set the page's typography.
5. **Every piece of text has a maximum.** Decide it, and either clamp or scroll. A panel whose height
   is decided by whatever the model returned is not a layout.

---

##### §10 Alignment, density and rhythm

1. **Everything aligns to one grid.** One container max-width, one gutter, one column system; every
   region, banner and card shares the same left edge. §11 asserts it.
2. **Spacing comes from the scale, always.** No `margin: 7px`. Vertical rhythm between sections is one
   step larger than rhythm within a section, so grouping is visible without borders.
3. **Related things are closer than unrelated things.** A label sits nearer its value than the next
   group does. Most "cluttered" screens are a proximity failure, not a density failure.
4. **A screen has one focal point.** Decide what it is per screen and make it the largest, highest
   contrast element. If everything is emphasised, the judge's eye lands nowhere.
5. **Optical alignment beats mathematical alignment** for icons against text: centre on the cap
   height, not the bounding box.

---

##### §11 Verification — measured, then looked at

DP-UI's audit work unit runs these **in the rendered page**, at 1440×900 and at 390px, in both themes.
Every one that fails, fails the work unit. They are cheap, and every defect in §0 would have been
caught by one of them.

```js
const R = el => el.getBoundingClientRect();
const vw = document.documentElement.clientWidth;

// 1. Nothing overflows the viewport horizontally (§10).
const spill = [...document.querySelectorAll('body *')]
  .filter(el => { const r = R(el); return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5); })
  .map(el => el.className || el.tagName);                                   // must be []

// 2. No element's text overflows its own box (§3, §4) — the "text outside the label" defect.
const clipped = [...document.querySelectorAll(
    'button,.chip,.badge,.metric__value,h1,h2,h3,td,th,label')]
  .filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
  .map(el => el.textContent.trim().slice(0, 40));                           // must be []

// 3. No live number wraps (§4.2).
const wrapped = [...document.querySelectorAll('.metric__value,[data-metric]')]
  .filter(el => el.getClientRects().length > 1)
  .map(el => el.textContent.trim());                                        // must be []

// 4. Live numbers are tabular (§4.1).
const notTabular = [...document.querySelectorAll('.metric__value,[data-metric]')]
  .filter(el => !getComputedStyle(el).fontVariantNumeric.includes('tabular-nums'))
  .map(el => el.textContent.trim());                                        // must be []

// 5. Every surface is an object, not a background (§3).
const flatCards = [...document.querySelectorAll('[data-surface]')].filter(el => {
  const s = getComputedStyle(el);
  return s.borderStyle === 'none' && s.boxShadow === 'none';
}).map(el => el.dataset.surface);                                           // must be []

// 6. Message templates are total (§5.4).
const broken = [...document.querySelectorAll('[data-message],[role="status"],[role="alert"]')]
  .map(el => el.textContent.trim())
  .filter(t => /(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/.test(t)); // must be []

// 7. Help coverage (§7.4).
const resultRegions = document.querySelectorAll('[data-result-region]').length;
const helpButtons  = document.querySelectorAll('[data-help-for]').length;
const explainer    = !!document.querySelector('[data-app-explainer]');
// helpButtons >= resultRegions, and explainer === true

// 8. A real typeface loaded (§9).
const bodyFont = getComputedStyle(document.body).fontFamily;
const realFace = !/^\s*(system-ui|-apple-system|sans-serif|serif)\s*(,|$)/.test(bodyFont);
// realFace === true, and document.fonts.status === 'loaded'

// 9. Accent is doing work (§6.2) — at least three elements painted with the accent token.
const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
const accentUses = [...document.querySelectorAll('body *')].filter(el => {
  const s = getComputedStyle(el);
  return [s.color, s.backgroundColor, s.borderColor].some(v => v && v !== 'none' &&
    v.replace(/\s/g,'') === accent.replace(/\s/g,''));
}).length;                                                                  // >= 3
```

**And the vocabulary check.** The craft audit also runs
`check_banned_words.py --preset app`, because a banned word in a button label or a help popover is a
craft defect on exactly the surface this spec governs.

**Then look at the screenshots.** The assertions catch the mechanical defects; only eyes catch a
screen that is technically correct and still lifeless. The screenshot list from the identity spec
gains: the app bar with the brandmark and the explainer button; the explainer panel open; one
contextual help popover open; the degraded banner; a metric group at its widest plausible value.

---
### §5.12 The brandmark contract (§1, §3–§8 reproduced)

> **Verbatim contract — BRANDMARK SPEC (§1,§3,§4,§5,§6,§7,§8).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### §1 Non-negotiables

1. **One mark, one lockup, one definition.** A single `mark.svg` and a single lockup component. Two
   files that both draw the logo will drift; the drift is what a judge notices.
1a. **The lockup is three parts: the mark, the name, and the slogan beneath it.** §3.2 governs the
   anatomy. Not a bare wordmark and not a floating icon — the visual element, the product's name, and
   the one line that says what it is, set as a single locked object with fixed relationships. The
   slogan is part of the lockup, not a caption that happens to sit nearby.
2. **The mark is authored vector geometry. The name and slogan are live text.** §3 governs. The mark
   is shapes only and contains no `<text>` element ever; the words are rendered by a real text engine
   (the app's DOM, the slide's HTML) so they are spelled correctly and laid out correctly, always.
3. **Never generated by an image model.** Image models misspell wordmarks and cannot produce clean,
   flat, scalable geometry. The brandmark is the one graphical asset that is authored rather than
   generated — and the visual-assets spec's ban on hand-drawn SVG does not apply to it, because a
   mark is pure geometry with no text and no pretence of being an illustration.
4. **One file serves both themes.** §4 governs: `currentColor` and CSS custom properties, never a
   `mark-light.svg` and a `mark-dark.svg` that can fall out of sync.
5. **It appears everywhere the entry is seen:** the app header on every page, in both themes; the
   cover image; slide 1; slide 2. §6 governs placement.
6. **It survives 16px.** §3.3 governs. A mark that turns to mud in a browser tab is not a mark.
7. **Verification is measured.** §7 governs — file assertions, contrast maths and rendered
   screenshots, not "it looks fine".

---

##### §3 The two layers — the same rule as everywhere else

###### §3.1 `brand/mark.svg` — geometry only

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"
     role="img" aria-label="<App> mark">
  <!-- shapes only: path, rect, circle, polygon. currentColor, never a literal hex. -->
  <path d="…" fill="currentColor"/>
  <path d="…" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
</svg>
```

Rules the file obeys:

- **Square `viewBox`**, `0 0 32 32` or `0 0 48 48`. A non-square mark cannot be dropped into a square
  slot (tab icon, avatar, app tile) without being re-drawn.
- **No `<text>`, ever.** Not for the wordmark, not for a letter, not for a tagline. A letterform
  inside the mark is drawn as paths or it is not in the file.
- **`currentColor` for every fill and stroke**, so one file themes itself. A second colour, if the
  design has one, comes from `var(--brand-accent)` with a value defined per theme — never a hardcoded
  hex inside the SVG.
- **One stroke weight**, with `stroke-linecap="round"` and `stroke-linejoin="round"` if stroked. At a
  32px `viewBox`, strokes are ≥2 units so they survive scaling down.
- **No filters, no masks, no gradients, no embedded raster, no external font reference.** Each of
  those breaks somewhere — in a favicon, in a `file://` slide, or in a headless screenshot.
- **Optically centred** in its `viewBox` with a small margin, so the lockup's spacing maths is
  predictable.

###### §3.2 The lockup — mark, name, slogan, and one device

The lockup is a **component, not a file**: the mark inline, the app name as real text beside it, and
the slogan directly beneath the name. This is the same two-layer rule the video's graphical assets
follow, for the same reason — text laid out by a layout engine is spelled right, measured, themeable
and fixable in one second.

**Anatomy, fixed:** the mark on the left, vertically centred against the whole text stack; a hairline
device separating it from the text; the name on the first line; the slogan on the second, its
baseline locked to the name's, left edges aligned. Nothing else enters the lockup.

```html
<span class="brandmark brandmark--header">
  <svg class="brandmark__mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><!-- paths --></svg>
  <span class="brandmark__stack">
    <span class="brandmark__word">AppName</span>
    <span class="brandmark__slogan">Evidence, not promises.</span>
  </span>
</span>
```

```css
.brandmark{display:inline-flex;align-items:center;gap:0.5em;line-height:1;
  color:var(--accent);white-space:nowrap}
.brandmark__mark{width:2.05em;height:2.05em;flex:none;display:block}
/* the device: one hairline, and only one */
.brandmark__stack{display:flex;flex-direction:column;gap:0.18em;
  padding-left:0.5em;border-left:1px solid var(--border-strong)}
.brandmark__word{font-family:var(--font-display);font-size:1em;font-weight:700;
  letter-spacing:-0.012em;color:var(--text)}
.brandmark__slogan{font-size:0.46em;font-weight:500;letter-spacing:0.01em;
  color:var(--text-muted)}
/* one size knob: set font-size on .brandmark and the whole lockup scales */
.brandmark--header{font-size:20px}
.brandmark--slide{font-size:34px}
.brandmark--cover{font-size:64px}
```

**Everything scales from one `font-size`.** `em` units throughout mean the lockup is never re-tuned
per context: the mark, the gap, the hairline, the name and the slogan all move together, and the
proportions a designer chose survive every size.

**The slogan stays.** It is in the lockup at header size too — at roughly 9px against a 20px name it
is still legible, and it is the line a judge reads on every screen of the demo. Drop it only below
the minimum lockup size in §2A.5, where the mark stands alone.

###### §3.3 It has to work at 16px

Render the mark alone at 16, 24, 32, 64 and 512 px and look at all five. At 16px the silhouette must
still be distinguishable — if two of your shapes merge into a blob, remove one. This is also the
favicon: export or reference the mark at `favicon.svg`, with a 32px PNG fallback, and put it in the
app's `<head>`. A judge's browser tab is a surface most entries leave blank.

---

##### §4 Both themes, one file

`currentColor` means the mark inherits whatever colour the lockup sets, so the theme switch is free:

```css
.brandmark{color:var(--accent)}                    /* light: e.g. #5B4BD6 */
[data-theme="dark"] .brandmark{color:var(--accent)}/* dark token resolves to e.g. #8B7CFF */
```

Both values come from the identity plan's colour table and both must clear **3:1 against the surface
the header sits on** in that theme — a mark is a graphical object under WCAG, so 3:1 is the floor.
State both ratios in §2A.4.

**Never ship `mark-light.svg` and `mark-dark.svg`.** Two files mean two edits, and the second one gets
forgotten the day the mark changes.

---

##### §5 Where the files live

| File | Path | Owner | Consumed by |
|---|---|---|---|
| The mark | `<entry>/public/brand/mark.svg` (or the framework's static dir) | DP-UI | the app header, the favicon |
| The lockup component | the app's own component language (`Brandmark.tsx`, a partial, a CSS class) | DP-UI | every page of the app |
| Portable copy | `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/mark.svg` | DP-UI | the cover and both slides, which live outside the entry repo |
| Portable styles | `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/brandmark.css` | DP-UI | the same |

DP-UI's brandmark work unit (its second) writes **all four**. The out-of-repo copy exists because `pitch/*.html` is
rendered from the chassis' project folder by a `file://` URL and cannot reach into the entry repo; the
copy is made by the same work unit that authors the original, in the same commit, so they cannot
drift. **DP-SCRIPT imports these; it never draws its own.**

---

##### §6 Placement

**In the app:** the lockup sits in the header, on every page, in both themes, at
`.brandmark--header` size. It is the first thing in the DOM's header region and the first thing read
by a screen reader. It is never a link to nowhere and never a decorative duplicate of the page title.

**On the cover:** part of the title block, large (`--cover`), above or beside the app name treatment —
if the cover's title block already sets the app name at display size, the *mark alone* goes there and
the wordmark is the title itself. Never both a giant wordmark and a giant lockup: that reads as a
mistake.

**On slide 1 and slide 2:** small and quiet, in a consistent corner on both slides — the same corner,
the same size, the same clear space. It is a signature, not a headline. It must not compete with the
evidence quote or the before/after figures, and it must not sit on top of the generated picture where
the background is unpredictable; put it over the flat slide background.

**In the footage:** nothing extra to do — it is in the app header, so it is in every demo frame. That
is the point: the cover, the slides and the product all carry the same mark, so the judge who moves
between them is looking at one thing.

---

##### §7 Verification — measured, then looked at

**File assertions (must pass, in DP-UI's work unit):**

- `brand/mark.svg` exists in both locations, is non-empty, parses as XML, and **contains no `<text`**.
- It contains `currentColor` and **no literal hex colour**.
- Its `viewBox` is square.
- The lockup CSS defines `.brandmark`, `.brandmark__mark`, `.brandmark__stack`, `.brandmark__word`
  and `.brandmark__slogan`.
- The slogan string in the CSS/markup is byte-identical everywhere it appears — header component,
  `cover.html`, `slide1.html`, `slide2.html`.
- `cover.html`, `slide1.html` and `slide2.html` each contain a `brandmark` element.
- The app's header component renders the lockup, and `<head>` references the favicon.

**Contrast maths:** compute the mark colour against its header surface in each theme; both ≥3:1.
Print both numbers.

**Rendered proof:** the mark alone at 16/24/32/64/512 px as a contact sheet PNG, plus the header in
light and dark, added to DP-UI's screenshot acceptance list (identity spec §5). **Then look at the
contact sheet** and confirm the 16px cell still reads.

---

##### §8 Acceptance checks

- [ ] `visual_identity_plan.md` §2A specifies the idea, the geometry, the wordmark, the slogan, the
  one designer's device, the colours with contrast ratios, the clear space and the minimum sizes —
  all literal.
- [ ] `brand/mark.svg` exists in the entry repo and in the project folder, byte-identical.
- [ ] The mark contains no `<text>` element and no literal hex colour; its `viewBox` is square.
- [ ] One file serves both themes via `currentColor`; there is no `mark-dark.svg`.
- [ ] The lockup is mark + name + slogan + exactly one device, scaling from a single `font-size`.
- [ ] The slogan is three to six words, says what the product does rather than its category, and is
  the same string in the app header, on the cover and on both slides.
- [ ] The mark's contrast against the header surface is ≥3:1 in BOTH themes, with both ratios stated.
- [ ] The lockup is in the app header on every page, in both themes.
- [ ] The lockup is on the cover, on slide 1 and on slide 2 — same corner, same size on both slides.
- [ ] The favicon is the mark, and it is referenced in `<head>`.
- [ ] The 16/24/32/64/512 contact sheet was rendered and looked at, and the 16px cell is legible.
- [ ] No image model was used to produce any part of the brandmark.
### §5.13 The art-direction and visual-review contract (Parts A and B)

> **Verbatim contract — HEE ART DIRECTION SPEC (Part A,Part B).** Reproduced unchanged from the engine-building prompt; where it names a path, the path is as written there.

##### Part A — art direction before tokens (DP-UI)

1. DP-UI's design brief (`design_documents/design_brief.md`, its first work
   unit) gains a `## Concept` section **before** any token is chosen, with
   seven labelled lines, each as `**<Label>:** <text>`:
   `Concept sentence` (what the product *feels like* in 12–45 words, derived
   from the domain), `Material` (what it is made of: paper, brushed metal,
   lacquer, glass, felt…), `Light` (where light comes from and its colour
   temperature), `Era` (a period or craft tradition the visual language
   borrows from), `Emotion` (the single feeling on first sight),
   `Hero frame` (the first frame a judge sees, naming the 3D view),
   `Not this` (the generic default it rejects).
2. The token set is derived from the concept: DP-UI's §5 records for each
   colour and the type pairing one clause "from <Material|Light|Era|Emotion>".
3. The brief must pass
   `npx vite-node hee/scripts/hee-lint-design-brief.ts design_documents/design_brief.md --plan design_documents/winning_project_plan.md`
   before the first screen is styled. A failing Concept sentence is rewritten,
   not overruled: the hee-lint-design-brief report names every problem.
4. The `--scene-*` mapping of the 3D kit is written in the same CSS block as
   the brand tokens, so the 3D view and the UI share one palette.

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
## §6 Algorithms and literal configuration (what the identity text does not already fix)

### §6.1 Build order (components, in dependency order; each step names the states it must render)

1. `theme.ts`, `tokens.css`, `fonts.css`, `base.css` (default, no state).
2. `Brandmark` (header, slide, cover sizes; mark-only below 480 px).
3. `AppBar` with the two status chips (default; degraded tint when the rung is not the top one).
4. `Message` (banner, callout, toast; five tones; default only) — **before any feature panel**.
5. `Metric` (default, loading, empty, error) — **before any feature panel**.
6. `Surface`, `Button` (default, hover, focus-visible, active, disabled, loading; primary, ghost, danger), `HelpTip` (default, hover, focus-visible, open), `Dialog`, `Explainer`.
7. `WorkIndicator`, `StatusChip`, `SourceBadge`, `SyntheticBadge`, `EmptyState`.
8. Shell: `Shell`, `Rail` slots, `ThemeToggle`, route table, `Banners`.
9. `WeekRibbon` (default, day selected, loading, empty, error, degraded).
10. `WeekTitle`, `WeekSummary`, `CheckPanel` with `IssueRow`, `IncidentCard`, `NudgeCard`.
11. `AgentPanel`, `ApprovalPanel`, `ActivityFeedPanel`, `ManualRunnerPanel`.
12. Rail panels: `HouseholdCard`, `DeviceList`, `QuietHoursEditor`, `ConsentList`, `ConnectPanel`/`ConnectDialog`, `WebhookInboxPill`.
13. `LiveViewPanel`, `SceneStage`/`SceneHost`.
14. The states pass (§5.9 for every component) and the audit.

### §6.2 CSS recipes that the identity text leaves to the implementor (literal; every value is a token)

`src/ui/styles/controls.css` (the interactive-state recipe of §5.6, turned into rules):
```css
button { font: 600 16px/24px var(--font-text); min-height: 40px; padding: 0 var(--space-4); display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  border: 1px solid var(--border-strong); background: transparent; color: var(--text); border-radius: var(--radius-control); cursor: pointer; white-space: nowrap;
  transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
button:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--bg-sunken); }
button:active:not(:disabled) { transform: translateY(1px); }
button:focus-visible, [role="radio"]:focus-visible, [role="switch"]:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, a:focus-visible { outline: none; box-shadow: var(--focus-ring); }
button:disabled, button[aria-disabled="true"] { color: var(--text-muted); background: var(--bg-sunken); cursor: not-allowed; }
button[data-variant="primary"] { background: var(--accent); color: var(--accent-contrast); border-color: transparent; font-size: 18px; font-weight: 650; }
button[data-variant="primary"]:hover:not(:disabled) { background: var(--accent-hover); }
button[data-variant="ghost"] { border-color: transparent; }
button[data-variant="danger"] { border-color: var(--danger); color: var(--danger); }
button[data-variant="danger"]:hover:not(:disabled) { background: var(--bg-danger); }
button[aria-busy="true"] .btn__icon { display: none; }
.btn__spinner { width: 14px; height: 14px; display: none; }
button[aria-busy="true"] .btn__spinner { display: inline-block; }
input, select { font: 400 16px/24px var(--font-text); min-height: 40px; padding: 0 var(--space-3); color: var(--text); background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-control); }
@media (max-width: 1024px) { button, input, select { min-height: 44px; } }
```

`src/ui/styles/layout.css` (the grid of §5.7):
```css
body { margin: 0; background: var(--bg); color: var(--text); font: 400 var(--text-body)/var(--lh-body) var(--font-text); }
.page { max-width: var(--container-max); margin: 0 auto; padding: var(--space-5) var(--gutter) var(--space-8); display: grid;
  grid-template-columns: var(--rail-w) minmax(0, 1fr) var(--workbench-w); gap: var(--gutter); align-items: start; }
.rail { position: sticky; top: calc(var(--appbar-h) + var(--space-4)); max-height: calc(100vh - var(--appbar-h) - var(--space-6)); overflow: auto; display: flex; flex-direction: column; gap: var(--space-4); }
.rail__footer { margin-top: auto; position: sticky; bottom: 0; background: var(--bg); padding-top: var(--space-3); }
.main, .workbench { min-width: 0; display: flex; flex-direction: column; gap: var(--space-4); }
@media (max-width: 1023px) {
  .page { grid-template-columns: minmax(0, 1fr) 340px; }
  .rail { display: none; }
  .rail[data-open="true"] { display: flex; position: fixed; z-index: 30; top: var(--appbar-h); bottom: 0; left: 0; width: 280px; padding: var(--space-4); background: var(--bg-overlay); box-shadow: var(--elev-3); }
}
@media (max-width: 719px) {
  .page { display: flex; flex-direction: column; gap: var(--space-4); }
  .main, .workbench { display: contents; }
  [data-slot="title"] { order: 10; } [data-slot="summary"] { order: 20; } [data-slot="ribbon"] { order: 30; } [data-slot="stage"] { order: 40; }
  [data-slot="agent"] { order: 50; } [data-slot="approval"] { order: 55; } [data-slot="check"] { order: 60; } [data-slot="incident"] { order: 70; }
  [data-slot="nudge"] { order: 80; } [data-slot="feed"] { order: 90; } [data-slot="manual"] { order: 95; } [data-slot="live"] { order: 45; }
  .agent-primary { position: sticky; bottom: var(--space-3); z-index: 5; }
}
```
Every region element in `Home` carries its `data-slot` (`title, summary, stage, ribbon, agent, approval, check, incident, nudge, feed, manual, live`).

`src/ui/styles/base.css` also holds, verbatim from §5.2A.6, §5.4 (surface recipe) and §5.6 (§6.4 metric block), the lockup, surface and metric CSS, plus:
```css
[data-message] { --tone: var(--accent); --tone-bg: var(--bg-accent); display: block; background: var(--tone-bg); border: 1px solid var(--tone); color: var(--text); }
[data-message][data-tone="success"] { --tone: var(--success); --tone-bg: var(--bg-success); }
[data-message][data-tone="warning"] { --tone: var(--warning); --tone-bg: var(--bg-warning); }
[data-message][data-tone="danger"] { --tone: var(--danger); --tone-bg: var(--bg-danger); }
[data-message][data-tone="degraded"] { --tone: var(--degraded); --tone-bg: var(--bg-degraded); }
.message__inner { display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-3); align-items: start; }
.message__glyph { color: var(--tone); width: 20px; height: 20px; }
.message__title { font-size: var(--text-subject); line-height: var(--lh-subject); font-weight: 650; color: var(--text); }
.message__detail, .message__items { font-size: var(--text-support); line-height: var(--lh-support); color: var(--text); }
[data-message][data-tier="banner"] { border-width: 0 0 1px; border-radius: 0; padding: var(--space-3) 0; }
[data-message][data-tier="banner"] .message__inner { max-width: var(--container-max); margin: 0 auto; padding: 0 var(--gutter); }
[data-message][data-tier="callout"] { border-width: 1px 1px 1px 3px; border-radius: var(--radius-control); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4); }
[data-message][data-tier="toast"] { position: fixed; right: var(--space-5); bottom: var(--space-5); max-width: 380px; z-index: 40; border-radius: var(--radius-card); padding: var(--space-3) var(--space-4); box-shadow: var(--elev-2); background: var(--bg-overlay); }
.eyebrow { font-size: var(--text-eyebrow); line-height: var(--lh-eyebrow); font-weight: 700; letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-muted); }
.subject { font-size: var(--text-subject); line-height: var(--lh-subject); font-weight: 650; letter-spacing: var(--track-heading); color: var(--text); }
.support { font-size: var(--text-support); line-height: var(--lh-support); font-weight: 400; color: var(--text-muted); }
.clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.well-mono { font-family: var(--font-mono); font-size: 14px; line-height: 20px; max-height: 220px; overflow: auto; }
```
`src/ui/styles/motion.css` implements the 13 rows of §5.5 as keyframes and transitions; its last block is
```css
@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 1ms; --dur-base: 1ms; --dur-slow: 1ms; } .work-indicator__tick { animation: none; } .pencil-circle ellipse { stroke-dashoffset: 0 !important; animation: none !important; } }
```
`src/ui/styles/platform-skin.css` restyles the platform step indicator by its class names only: `.ui-step-status` (a `[data-surface]`-like block: `--bg-sunken`, 1 px `--border`, `--radius-control`, `--space-3` padding), `.ui-step-status__title` (eyebrow role), `.ui-step` rows (support role, `--space-2` gap), `.ui-step--current` (`--accent` text, `font-weight: 650`), `.ui-step--done` (`--success`), `.ui-step--error` (`--danger`), `.ui-badge--skeleton` (a `--border` pill). It never copies or edits the platform component.

`index.html` (literal head additions): `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`, `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`, the two font preloads of §5.3, `<title>Doorstep Rhythm</title>`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, and before any stylesheet this inline script (literal):
```html
<script>try{var t=localStorage.getItem("dr-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}</script>
```
`vite.config.ts` gains only: the `@vitejs/plugin-react` plugin, and `server.proxy` entries `"/api"`, `"/events"`, `"/webhooks"`, `"/health"` → `http://localhost:8080`.

### §6.3 Session, run, status and banners

1. **`SessionProvider`.** `sessionId = sessionStorage.getItem("dr-session") ?? random 16 characters from [a-z0-9]` (stored back; a failing storage falls back to a module variable). `ring = createHttpRingPort({ baseUrl, sessionId })`; `session = createAppSession({ ring })` created once in `useMemo` (never recreated on re-render). Sets `document.body.dataset.appReady = "true"` in an effect after the first render. In the same effect it calls `installTraceHook(session.trace)` and returns the function it gives back as the cleanup, so `window.__runTrace.get()` returns the run trace (FR-09; the recorder, the E2E suite and the replay read it).
2. **`useModel`** = `useSyncExternalStore((cb) => session.store.subscribe(() => cb()), () => session.store.getState())`. `useIssues` memoises `session.checkNow()` on `session.store.revision()`; `open = errors + warnings`.
3. **`useStatus`** fetches `GET /api/status?sessionId=<id>` on mount, every 10 s, and whenever `useEnvelopes()` receives an envelope whose `step_id` is `agent-rung` or `ring-mode`; a failed fetch keeps the previous value and sets `loaded: false` only before the first success. `tokenMinutes = ring.tokenExpiresInSec === null ? null : Math.floor(ring.tokenExpiresInSec / 60)`.
4. **`useRun.start()`** (guard: ignore while `status === "running"`): `status "running"`; `transport = createHttpAgentTransport({ runId })` with a new run id; `await transport.refreshStatus()`; `summary = await runWeekReview({ session, transport, onPhase, signal, autoDecide: null })` where `onPhase(phase, { round, detail })` stores `phase`, `round`, `detail`; on return `status = summary.ok ? "done" : "stopped"`; an exception sets `status "error"` and `error = <message, never a stack>`. `cancel()` aborts the signal.
5. **`loadSampleWeek()`** (the EmptyState action): `session.call("ingest_ring_events", { source: "webhook_inbox" }, { source: "human" })`, then `{ source: "history", deviceId: "dev-door" }` and `{ source: "history", deviceId: "dev-elite" }`, all as `source: "human"`. It adds events only; it opens no incident.
6. **`pickBanner` priority table (literal).**

| Order | Condition | Banner (tone · title · detail · action) |
|---|---|---|
| 1 | `ringError !== null` | danger · `ringError(status).title` · its detail · `use-sample` |
| 2 | `runError !== null` | danger · `actionError(runError).title` · its detail · `show-details` |
| 3 | `agentKind === "manual"` | degraded · `runningByHand().title` · its detail · `open-actions` |
| 4 | `agentKind === "golden"` | degraded · `recordedRun(recordedDate).title` · its detail · none |
| 5 | `agentKind === "vertex-fallback"` | degraded · `backupModel().title` · its detail · `show-details` |
| 6 | `ringDegraded` | degraded · `sampleWeek().title` · its detail · `connect` |
| 7 | `tokenMinutes !== null && tokenMinutes <= 5` | warning · `tokenWarning(tokenMinutes).title` · its detail · `paste-token` |
| 8 | `usedPct >= 80` | warning · `budgetWarning(usedPct).title` · its detail · none |
| 9 | otherwise | `null` |

   `items` (the structured detail of §5.6 "step → what happened") is filled for rows 3–5 from the last three `agent-rung` / `system-degraded` envelopes (`step` = the envelope's label, `text` = its reason); an empty list renders no `dl`.
7. **Status chips** (app bar; eyebrow label + subject value): Ring chip subject `Sample week` (bundle) or `Live · {m} min` (live with a token, `m` omitted when unknown); Agent chip subject `Bedrock`, `Backup model`, `Recorded run` or `By hand` (from `agent.kind`), support `{usedPct}% of budget` when `usedPct > 0`. A chip whose rung is not the top one is tinted `--bg-degraded` with the `Layers` glyph and the word, per §5.9A.
8. **Phase list** (AgentPanel): the seven names, in order, from `PHASES` minus `load` and `finish`: `perceive` "Read the week", `plan` "Plan the review", `act` "Check each day", `verify` "Run the checks", `repair` "Fix what was found", `explain` "Write it up", `checkpoint` "Your decision". The current phase is accent-coloured with a filled tick, finished ones have `Check`; `data-run-phase` on the panel is the phase name or `idle`.
9. **`phaseLabel(role)`** is the table of §5.9 (reader, planner, actor, verify, repair, narrator, checkpoint; anything else or missing → `Working on the week`). The WorkIndicator maps the current phase to a role: `perceive → reader`, `plan → planner`, `act → actor`, `verify → verify`, `repair → repair`, `explain → narrator`, `checkpoint → checkpoint`, anything else → no role.

10. **Test hook.** When `new URLSearchParams(location.search).get("hook") === "1"`, `SessionProvider` sets `window.__doorstep = { session, ring, openFirstCandidate }` where `openFirstCandidate(): Promise<string | null>` takes `candidateIncidents(session.store.getState())[0]` (from `src/domain/rules.js`), calls `session.call("open_incident", { kind, title, eventIds, startMs, endMs, routineId, dayIndex, withSnapshot: true }, { source: "human" })` and returns the new incident id, or `null` when there is no candidate. Without the query parameter nothing is set. The verification scripts use it (`/?hook=1`) to put an incident on the week without running the agent.

### §6.4 Check panel, issue rows, incident and nudge cards

1. `RULE_WORDS` (literal): `quiet-hours` "Quiet hours", `dwell` "Long visits", `outage` "Device offline", `consent` "Consent", `duplicate-burst` "Duplicate events", `ledger-integrity` "Change history", `incident-coverage` "Moments without a write-up". An issue's rule is the longest `RULE_IDS` entry that its `id` starts with; none → `Check`.
2. `IssueRow`: chip (Error with `OctagonX` / Warning with `TriangleAlert`), subject = `issue.message` (already a sentence with units), support = `{RULE_WORDS[rule]} · {day label of the first entity}` (omit the day when no entity resolves), tint and 3 px left rule per tone. A fix button appears only when `issue.fix` exists and `issue.fix.action === "merge_duplicate_events"` (label `Merge duplicates`) or `"open_incident"` (label `Open an incident`); it runs `session.call(fix.action, fix.args, { source: "human" })`.
3. `CheckPanel` header: eyebrow `Checks`, a count badge `errors + warnings` (tabular), `HelpTip` `check-panel`. Empty list → `emptyChecks()`. While the check runs the panel shows `WorkIndicator` `Running the checks`.
4. `IncidentCard` shows the selected incident (`ui.selectedIncidentId`), else the first open one, else `emptyIncidents()`. Eyebrow `incidentEyebrow`, h2 = `incident.title`, body = `incident.summary` clamped (`.clamp-3`, `Show more` toggles), facts as `Metric md` for dwell when the incident has a duration (`fmtDuration`) plus support `usual under {p90} min`, evidence = the incident's first `MediaRef` rendered as `<img src="data:{contentType};base64,{dataBase64}" alt="Snapshot from {label}">` in a 16:9 well with caption `label`; no media → callout `No snapshot for this moment`. Actions: `Mark as explained` (`set_incident_status` `explained`, summary kept) and `Dismiss` (`dismissed`), both `source: "human"`; `Live view` opens the live view for the media's device. `ChangedFlash` wraps the card with `entityId = incident.id`.
5. `NudgeCard` shows the newest nudge with `status "proposed"` and scope `family_message`; `Approve` / `Reject` call `decide_nudge` (`approved` / `rejected`) with `source: "human"`; support `To {caretaker} · family messages {on|off}`. No proposed nudge → the card is not rendered.
6. `WeekSummary` hero metric: value `useIssues().open`, `size "xl"`, `max 99`, tone `accent` when 0, `warning` when 1–5 and no errors, `danger` when any error; unit `all clear` when 0 else `to look at`; lead sentence `leadSentence(open)`.

### §6.5 Week ribbon

`WeekRibbon` renders `weekRibbon(model)` (seven `RibbonDay`s). Per day: a `<button data-day="<dayIndex>" aria-pressed aria-label={ariaDayLabel(day)}>` column; header = eyebrow `MON`…`SUN` (by `dayIndex`) and subject = the day-of-month number parsed from `dateLabel` (`/\b(\d{1,2})\b/`); body of height `--ribbon-h` (200 px; 240 px at ≥ 1440 px; both set in `base.css`), position relative. Children, all absolutely positioned with `top = minute / 14.4 %`:
- `.hour-line` at minutes 0, 360, 720, 1080 (1 px `--border`);
- `.quiet-band` per `quietBands` entry (`--bg-sunken`, `top`, `height = (toMin − fromMin) / 14.4 %`);
- `.visit` per `visits` entry: 6 px wide `--pencil` bar at `left: 68 %`, height `max(2 px, …)`;
- `.tick` per `ticks` entry: 14 px × 2 px `--pencil` bar at `left: 22 %` with round ends and the `tick-in` motion; `.tick[data-dup="true"]` is `--degraded` with a second bar 3 px below (the doubled mark);
- `.outage-band` per `outages` entry: the 135° hatch of §5.6 at 40 % opacity, `title` and visible support text `"{minutes} min offline"` (the text is hidden below 480 px; the `title` stays);
- `.seam` when `seamMinute !== null`: a 1 px dashed `--degraded` line with the eyebrow `from history`;
- `.pencil-circle` button per `incidents` entry (the incident circle): `left 2 %`, `width 96 %`, centre `cy = (fromMin + toMin) / 2 / 14.4 %`, half-height `ry = max(4 %, (toMin − fromMin) / 2 / 14.4 + 3 %)`, `min-height 44 px`, containing `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="46" ry="46" pathLength="1" vector-effect="non-scaling-stroke"/></svg>`; stroke 2.5 px, colour by status: `open` and `explained` → `--warning`, `resolved` → `--success`, `dismissed` → `--border-strong`; the draw-in (`stroke-dasharray: 1; stroke-dashoffset: 1 → 0`, 360 ms) runs once when the incident is created or selected; click → `selectIncident(id)` and `selectDay`; `data-incident-id`, `aria-label="Open incident: <title>"` (title from the model's incident).
Below the seven columns, `BaselineStrip`: support text `Usual: visits under {p90} min; busiest {hour}` with `p90 = round(baseline.dwellP90Sec / 60)` and `hour` the busiest hour of `baseline.rhythm` (sum over weekdays) formatted `"08:00"`. Selecting a day gives the column the `--bg-accent` header band and the 2 px `--accent` bottom rule and dispatches `set_ui` through `useUiActions`. A day with more than 99 events shows `99+` in its aria label only.
Loading: while `useRun().status === "running"` and the model has no events, each column shows three muted ticks. Empty: `emptyEvents()` as an `EmptyState` below the columns (columns stay blank). Error: a callout above the grid.

### §6.6 Workbench wiring

1. `AgentPanel`: `Surface emphasis="primary"`, header eyebrow `Agent`, subject = `status.agent.label` (`Amazon Bedrock · {model}` when the kind is `bedrock` and a model is known, else the label), `HelpTip` `agent-status`; body: the primary `Review the week` button (`Review the sample week` while the model has no events), the `WorkIndicator` while running, the phase list. `data-run-phase`, and the wrapper `Home` sets `data-run-status`.
2. `ApprovalPanel` wraps the kit `ApprovalBar` (`gate = session.gate`) in `[data-surface][data-elevation="2"]` with `data-result-region="approval-bar"`; a `ShieldQuestion` glyph and the `--bg-warning` band are applied by descendant selector `[data-result-region="approval-bar"] > div > div`; the pending state sticks to the bottom of the workbench; with nothing pending it shows the footer row and the support text `Nothing is waiting for you.`.
3. `ActivityFeedPanel` renders the kit `ActivityFeed` with `trace` replaced by the friendly adapter of §6.7 (so the kit's markup is unchanged and the words are friendly). Clamp: rows are `max-height: 56px; overflow: hidden` with a `Show more` button per row when the text is longer than two lines.
4. `ManualRunnerPanel`: `<details>` titled `Run an action by hand` around the kit `ManualRunner` (`registry = session.registry`).

### §6.7 Friendly trace

`friendlyEntry(e, titles)`: `badge` = `AGENT | YOU | SYSTEM` from `e.source`; `actor`: model entries by role (`extractor` → `Reader`, `planner` → `Planner`, `actor` → `Agent`, `narrator` → `Writer`), human `You`, system `System`; `title` = `titles[e.name]` for actions (descriptor titles, built from `registry.list()`), the role's phrase for model entries (`Reader read the records`, `Planner drew up the review`, `Agent chose the next step`, `Writer wrote it up`), approvals `Approval · {decision}`; `detail` = the sentence assembled from `e.output_ref` (when it is a sentence), `e.state_change` (`changed {n} item(s)`) and `e.truth` (`{errors} errors, {warnings} warnings`), joined with ` · ` and never containing an empty piece; `ok` = `e.ok`. `createFriendlyTrace(trace, registry)` returns an object with the **same shape as `TraceWriter`** that the kit `ActivityFeed` reads (`entries()` returning `TraceEntry`-shaped records whose `name` is the friendly title, whose `output_ref` is the friendly detail and whose `state_change` and `truth` are omitted, and `subscribe`), so the kit component renders friendly text without being forked.

### §6.8 Live view (WHEP) and snapshot

`LiveViewPanel` opens when `ui.liveViewDeviceId` is set. Algorithm: `pc = new RTCPeerConnection()`; `pc.addTransceiver("video", { direction: "recvonly" })`; `offer = await pc.createOffer(); await pc.setLocalDescription(offer)`; `session = await ring.startWhep(deviceId, offer.sdp)`; **when `session.answerSdp` contains `SIMULATED`** skip `setRemoteDescription` and render the device's newest snapshot with the callout `Simulated live view — the sample week has no camera stream.`; otherwise `await pc.setRemoteDescription({ type: "answer", sdp: session.answerSdp })` and attach the first remote stream to the `<video autoplay playsinline muted>`. The countdown metric counts down from `session.maxSeconds` (30 or 60) once per second; at zero or on `Close` the panel calls `ring.stopWhep(deviceId, session.sessionId)`, closes the peer connection and sets `liveViewDeviceId` to `null`. Any failure shows the callout `Live view didn't start` / `Ring didn't answer. Try again in a moment.` and never leaves a connection open. Snapshots in the incident card are `data:` images; nothing is fetched from a Ring URL by the browser.

### §6.9 Hero slot and demo hooks

`SceneStage` is `Surface well` of fixed aspect 16:5 (min-height 240 px at 1280, 300 px at ≥ 1440) with `data-slot="stage"`, `data-result-region="scene-3d"`, `HelpTip` `scene-3d`, a toolbar of three ghost buttons `Overview`, `Focus`, `Walk` (`data-shot` `overview`, `focus`, `walk`; `aria-pressed` is true when `ui.shotId` is `overview`, starts with `focus:` or is `walk` respectively; each calls `set_camera_shot` as `source: "human"`, and `Focus` passes `incidentId` = the selected incident or else the first open one, and is `aria-disabled` with the title `Open a moment first` when there is none), and `SceneHost` filling the well. `data-demo-3d` is set by DP-3D's component on its root; the fallback sets `data-demo-3d="unavailable"` (this refines §5.6's wording without changing a value). The route `/` has exactly one `data-demo-focus="workbench"` (on the workbench container); `/watch` has `"replay"`, `/lab` has `"lab"`, each on its page shell. The quiet frame of `/` is reached by `reviewTheWeek` finishing with no open checks, no toast, no running indicator and no pending approval.

### §6.10 Total templates (the copy of §5.9 as functions)

Each function in `copy/templates.ts` normalises its input first (`null`/`undefined`/`NaN`/`""` → the "without" branch; negatives clamp to 0; minutes round down) and then returns the sentence of §5.9 for that branch. Plurals: `1 minute`, `n minutes`; `moment`/`moments` in `leadSentence` and `ariaDayLabel`. `weekTitle(model)` = `The week of {d} {Month}` from the first day of `weekRibbon(model)` (English month table, no `Intl`); `weekSupport` = `Rosa's front door · Sample week` for `bundle` and `…· Live from Ring` for `live`, using `model.household.name`'s first word; an empty name gives `The front door · …`. `incidentEyebrow` = `{WEEKDAY} {d} {MON} · {HH:MM}` from `fmtDay`/`fmtClock`, uppercased.

## §7 Failure modes

| Failure | What the visitor sees | Handling |
|---|---|---|
| The server is not reachable | banner `Couldn't read Ring` with `Use the sample week` | `HttpRingPort` rejects with `RingError(0, "network")`; the app keeps its own seed and offers `loadSampleWeek` only when the server answers; otherwise the empty state explains |
| The model rung steps down mid-review | the banner of §6.3 table rows 3–5; the run stops at that phase | `summary.degraded` and `status` poll; pressing `Review the week` again starts a new run id on the new rung |
| The review throws | `That didn't work` banner with `Show details`, no stack | `useRun` stores the message only |
| WebGL unavailable or `src/3d/DoorwayScene.tsx` missing | `3D view unavailable` message in the stage; the flat week stays | `SceneHost` fallback |
| WHEP session fails or is simulated | callout, snapshot instead of video | §6.8 |
| `localStorage` or `sessionStorage` blocked | theme falls back to `prefers-color-scheme`; a new session id each load | every storage access is in try/catch |
| A font file fails to load | fallback stacks of §5.3 | `font-display: swap` |
| `prefers-reduced-motion` | no draw-in, no pulse, instant changes | §5.5 substitutes |
| A very long text arrives from the model | clamped with `Show more`, mono wells scroll | §5.11 rule 8, `.clamp-3`, `.well-mono` |
| A third party class names change in the kit | the audit's selectors fail loudly | descendant selectors are asserted in WU-08 |


## §8 Work units

Conventions for every unit: scripts live in `scripts/verify/`, start with `import { createChecker } from "./ui-kit.js"`, call `const c = createChecker("ui-NN-name")`, end with `c.done()` (which prints `<name>: N checks OK` and exits 0, or prints `FAIL <label>` lines and exits 1), and never write outside `design_documents/ui-screenshots/`, `dist/` and a temporary directory. Browser scripts use `openApp` from the same kit and call `await run.close()` in a `finally`. The check lists below are the contract for each script; a script may contain more assertions, but every numbered check must be one `c.ok` or `c.eq` call whose label starts with that number. A unit may rely on files of earlier units only.

### WU-UI-01 — the design brief and the verification kit's plan readers
- **Goal:** `design_documents/design_brief.md` exists as the literal text of §5.0, passes the chassis brief lint, and `scripts/verify/ui-kit.ts` can read machine-checked blocks out of this plan.
- **Steps:**
  1. Run the preflight of §0 and stop on any missing path. Read `design_documents/winning_project_plan.md` once, to confirm the slogan line is the same.
  2. Write `design_documents/design_brief.md` as the fenced block of §5.0, without the fence lines and with nothing above the title.
  3. Write `scripts/verify/ui-kit.ts` with `createChecker` re-exported from `./at-kit.js`, `PLAN_PATH = "design_documents/design_plans/DP-UI.md"`, `planText(): string`, `planBlock(needle: string, lang?: string): string` (the text of the first fenced block of that language, or of any language when `lang` is omitted, that contains `needle`; it throws `no block containing "<needle>"` otherwise and strips exactly the opening and closing fence lines and one trailing newline), `planTable(headerStart: string): string[][]` (the cells, with backticks removed, of the data rows of the first Markdown table whose header row starts with `headerStart`), and `sh(cmd: string, args: string[]): { code: number; out: string }` (`spawnSync`, UTF-8, both streams joined).
  4. Write `scripts/verify/ui-01-brief.ts` with the nine checks below. Run `npx vite-node ../../hackathons/scripts/hee-lint-design-brief.ts design_documents/design_brief.md --plan design_documents/winning_project_plan.md` from inside the script through `sh`.
- **Files:** `design_documents/design_brief.md`, `scripts/verify/ui-kit.ts`, `scripts/verify/ui-01-brief.ts`.
- **Checks (9):**
  1. The first line of the brief is `# Design brief — Doorstep Rhythm`.
  2. The chassis lint exits `0` and its output contains `design brief concept OK`.
  3. The brief contains the line `Slogan, identical everywhere it appears: Know her day without calling.` exactly once.
  4. The brief has exactly nine lines starting `- Defect ` and their numbers are 1 to 9 in order.
  5. The brief has exactly five lines starting `- Check ` and their numbers are 1 to 5 in order.
  6. `bannedHits(briefText)` from `src/llm/guard.js` returns `[]`.
  7. The line starting `**Concept sentence:**` holds one sentence: after the label it has exactly one full stop, at the end of the line.
  8. The brief has a `## Placement of the theme toggle` section whose text contains `1024 px`.
  9. The brief contains no `/home/`, `/Users/` or `C:\` and no text matching `(sk-|AKIA)[A-Za-z0-9]{8,}`.
- **Verify:** `npx vite-node scripts/verify/ui-01-brief.ts`
- **Expected output:** `ui-01-brief: 9 checks OK`
- **Proves:** the art direction is a file the chassis lint accepts, it carries the slogan and the nine-defect review, and every later script can read this plan's literal blocks.

### WU-UI-02 — the brandmark and its files
- **Goal:** the mark, favicon set, lockup stylesheet, lockup page and README exist, the copies are identical, and the six contrast ratios stated for the mark are computed from the tokens.
- **Steps:**
  1. Write `scripts/lib/color.ts`: `hexToRgb(hex)`, `relativeLuminance(hex)`, `contrast(a, b)` (WCAG 2 formula, returns a number, not rounded).
  2. Write `brand/mark.svg` as the verbatim block of §5.2A (the identity text `§2A.7`), copy it to `public/brand/mark.svg`, and write `brand/favicon.svg` as the same file with each `currentColor` replaced by `#1B6A62`, copied to `public/favicon.svg`.
  3. Write `scripts/export-favicon.ts`: opens `brand/favicon.svg` in Playwright Chromium at a 32 × 32 viewport on a transparent background (`omitBackground: true`) and writes `public/favicon-32.png`.
  4. Write `brand/brandmark.css` (classes `.brandmark`, `.brandmark--header`, `.brandmark--slide`, `.brandmark--cover`, `.brandmark__mark`, `.brandmark__word`, `.brandmark__slogan`, and the rule that hides `.brandmark__word` and `.brandmark__slogan` below 480 px) from §5.2A.6 and §5.12; every value is a `var(--…)` with a fallback equal to the light-theme token.
  5. Write `brand/lockup.html` (a static page that links `brand/brandmark.css` and `src/ui/tokens/tokens.css`, shows the three sizes in both themes, and contains the slogan once in the header lockup) and `brand/README.md` (what each file is, which plan imports it, the single colour rule).
  6. Write `scripts/verify/ui-02-brand.ts`. It reads the tokens by parsing `src/ui/tokens/tokens.css` only if that file exists and otherwise by the literal hex values of §5.2 (`#1B6A62` on `#FFFDF8`, and so on); WU-03 later makes the file exist, and the six ratio checks must pass either way.
- **Files:** `brand/{mark.svg,favicon.svg,brandmark.css,lockup.html,README.md}`, `public/brand/mark.svg`, `public/favicon.svg`, `public/favicon-32.png`, `scripts/lib/color.ts`, `scripts/export-favicon.ts`, `scripts/verify/ui-02-brand.ts`.
- **Checks (16):**
  1. `brand/mark.svg` equals the verbatim block of the plan (`planBlock("<svg", "svg")`) byte for byte.
  2. `public/brand/mark.svg` is byte-identical to `brand/mark.svg`.
  3. `public/favicon.svg` is byte-identical to `brand/favicon.svg`, and `brand/favicon.svg` contains `#1B6A62` and no `currentColor`.
  4. `brand/mark.svg` is well-formed XML with a `viewBox` and a `<title>`, contains `currentColor`, and contains no `<image`, no `<script` and no `href=` pointing outside the file.
  5. `public/favicon-32.png` starts with the PNG signature and its IHDR width and height are both `32`.
  6. `contrast("#1B6A62", "#FFFDF8")` rounded to two decimals is `6.29`.
  7. `contrast("#5CC0B3", "#1B2226")` rounded to two decimals is `7.40`.
  8. `contrast("#5B5142", "#FFFDF8")` rounded to two decimals is `7.65`.
  9. The dark slogan pair, `--text-muted` dark on `#1B2226`, rounds to `6.26`.
  10. `--border-strong` light (`#857758`) on `#FFFDF8` rounds to `4.32`, and the dark pair rounds to `3.87`.
  11. `brand/brandmark.css` defines `.brandmark--header`, `.brandmark--slide` and `.brandmark--cover`.
  12. Every colour in `brand/brandmark.css` is written as `var(--…)`, and the only literal hex values are inside `var(` fallbacks.
  13. `brand/lockup.html`, opened over `file://` at 1280 px, has a visible `.brandmark--header` whose `.brandmark__mark` is taller than 24 px and whose `.brandmark__word` text is `Doorstep Rhythm`.
  14. The same page at 390 px has `.brandmark__word` and `.brandmark__slogan` with computed `display: none` inside `.brandmark--header` and the mark still visible.
  15. `brand/lockup.html` contains `Know her day without calling.` exactly once, and `brand/README.md` mentions `mark.svg` and the slogan.
  16. `bannedHits` returns `[]` for the text of `brand/README.md` and for the visible text of `brand/lockup.html`.
- **Verify:** `npx vite-node scripts/verify/ui-02-brand.ts`
- **Expected output:** `ui-02-brand: 16 checks OK`
- **Proves:** the mark is a single-colour vector with identical copies, the stated contrast ratios are computed rather than quoted, and the lockup collapses to the mark on a phone.

### WU-UI-03 — fonts, tokens, cinematic tokens, theme logic and the contrast gate
- **Goal:** the three typefaces are self-hosted, `tokens.css` and `cinematic-tokens.json` equal the plan's blocks, `tokens.ts` is generated from the CSS, the theme logic is correct and total, and 40 pairs in both themes pass.
- **Steps:**
  1. `npm install -D @fontsource-variable/fraunces@5.3.0 @fontsource-variable/atkinson-hyperlegible-next@5.3.0 @fontsource-variable/jetbrains-mono@5.3.0 --save-exact`. Copy `node_modules/@fontsource-variable/<name>/files/<name>-latin-wght-normal.woff2` for the three names into `public/fonts/` (create it).
  2. Write `src/ui/tokens/fonts.css` from the `@font-face` block of §5.3 and `src/ui/tokens/tokens.css` from the CSS block of §5.2, each byte for byte.
  3. Write `cinematic-tokens.json` from the JSON block of §5.2, byte for byte.
  4. Write `scripts/gen-tokens-ts.ts`: reads `tokens.css`, takes the declarations of the second `:root` block as `light` and of `[data-theme="dark"]` as `dark` (names without `--`), derives `sceneTokenNames`, writes `src/ui/tokens/tokens.ts` with the header comment `GENERATED — do not edit` and `tokenCssText()` implemented as `import css from "./tokens.css?raw"; return css;`. Add `package.json` script `gen:tokens`.
  5. Write `scripts/check-contrast.ts`: reads the pair table with `planTable("Pair (text on surface)")`, resolves each side to a token of both themes (the table's first column is `` `--a` on `--b` ``), computes `contrast` from `scripts/lib/color.ts`, requires each ratio to be at least the `Needs` column, requires the computed value to be within 0.01 of the table's `Light` and `Dark` columns, prints `FAIL <pair> <theme> <ratio>` for each problem and `contrast: <n> pairs OK` (n = rows × 2 = 80), accepts `--tokens <file.css>` to read another tokens file. Add `package.json` script `check:contrast`.
  6. Write `src/ui/theme/theme.ts` (§3.1), `scripts/sync-project-copies.ts` (copies `cinematic-tokens.json`, `brand/mark.svg` and `design_documents/design_brief.md` into `PROJECT_SYNC_DIR` or `../../hackathons/hackathon-projects/2026-10-amazonDevs`, never anywhere under `../../hackathons/src/`, prints `synced <n> files to <dir>`, exits 1 with `target directory missing` when the directory does not exist) and `scripts/verify/ui-03-tokens.ts`, which also runs `check-contrast.ts` through `sh` and prints its last line first.
- **Files:** `public/fonts/*.woff2`, `src/ui/tokens/{fonts.css,tokens.css,tokens.ts}`, `cinematic-tokens.json`, `scripts/{gen-tokens-ts,check-contrast,sync-project-copies}.ts`, `src/ui/theme/theme.ts`, `scripts/verify/ui-03-tokens.ts`, `package.json`.
- **Checks (16):**
  1. The three files in `public/fonts/` exist, are each larger than 20 000 bytes, and start with the bytes `wOF2`.
  2. `src/ui/tokens/fonts.css` equals `planBlock("@font-face", "css")` byte for byte, and every `url(` path in it resolves to an existing file under `public/`.
  3. `src/ui/tokens/tokens.css` equals `planBlock("--rail-w: 208px", "css")` byte for byte.
  4. `cinematic-tokens.json` equals `planBlock('"video_theme"', "json")` byte for byte and parses with `video_theme === "paper"` and the slogan `Know her day without calling.`.
  5. `src/ui/tokens/tokens.ts` starts with a comment containing `GENERATED — do not edit`, and running `npm run gen:tokens` a second time leaves it byte-identical.
  6. `tokens.light` and `tokens.dark` have identical key sets.
  7. `tokens.light.bg` is `#F6F1E7` and `tokens.dark.bg` is `#12171A`.
  8. `sceneTokenNames` is not empty, every name starts with `scene-`, and it contains `scene-bg` and `scene-mat-arc`.
  9. `cssVar("accent")` is `var(--accent)` and `tokenCssText()` contains `--accent: #1B6A62`.
  10. `cinematic.themes.paper.bg` equals `tokens.light.bg` and `cinematic.themes.dusk.bg` equals `tokens.dark.bg`, and the same equality holds for `accent` in both themes.
  11. `npm run check:contrast` exits `0` and its last line is `contrast: 80 pairs OK`.
  12. Running `check-contrast.ts --tokens <fixture>` on a copy of `tokens.css` whose light `--accent` is changed to `#8FB5AF` exits `1` and prints a line starting `FAIL ` that names `--accent`.
  13. `initialTheme(true, null)` is `"dark"`, `initialTheme(true, "light")` is `"light"`, `initialTheme(false, "dark")` is `"dark"`, `initialTheme(false, "junk")` is `"light"`.
  14. `readStoredTheme` with a storage whose `getItem` throws returns `null`, and `persistTheme("dark", { setItem() { throw new Error("x") } })` does not throw.
  15. `applyTheme("dark", fakeRoot)` sets `fakeRoot.dataset.theme` to `dark`.
  16. `sync-project-copies.ts` with `PROJECT_SYNC_DIR` set to a fresh temporary directory exits `0`, prints `synced 3 files to`, and the three copies are byte-identical to the sources; with a directory that does not exist it exits `1` and prints `target directory missing`.
- **Verify:** `npx vite-node scripts/verify/ui-03-tokens.ts`
- **Expected output:** `ui-03-tokens: 16 checks OK` (the line `contrast: 80 pairs OK` is printed immediately before it)
- **Proves:** the one definition of colour, type, space and motion is the plan's own text, the dark and light themes cannot drift apart, and no pair of text and surface falls below its contrast floor.

### WU-UI-04 — the build, the shell, the routes, the theme toggle and the browser kit
- **Goal:** `npm run build` produces `dist/`, the server serves it, `/`, `/watch` and `/lab` render inside one shell with the brandmark, the three-column grid and a working theme toggle, and `openApp` exists for every later script.
- **Steps:**
  1. `npm install react@19.3.0 react-dom@19.3.0 react-router@8.4.0 lucide-react@1.52.0 --save-exact`; `npm install -D @vitejs/plugin-react@6.1.2 @types/react@^19 @types/react-dom@^19`; add scripts `build` (`vite build`) and `dev:ui` (`vite`).
  2. Write `vite.config.ts` as in §6.2 (React plugin, alias `src` to `./src`, dev proxy for `/api`, `/events`, `/health` and `/webhooks` to `http://localhost:8080`, `build.outDir: "dist"`, `build.target: "es2022"`), and `index.html` with the head and the inline theme script of §6.2: font preloads, favicon links, `<div id="root">`.
  3. Write `src/ui/main.tsx`, `src/ui/App.tsx` (wraps `SessionProvider`, `RouterProvider`), `src/ui/routes.tsx` (`/` Home, `/watch` Watch, `/lab` Lab, `/__kit` lazy Kit once WU-05 exists, `*` redirects to `/`), `src/ui/state/{SessionProvider.tsx,hooks.ts}` (§3.2, §6.3 items 1–3, 10), `src/ui/shell/{Shell,AppBar,Rail,ThemeToggle,Brandmark,Banners}.tsx` (`Banners` renders `null` for now; WU-11 fills it) and `src/ui/pages/{Home,Watch,Lab}.tsx`.
  4. `Home` renders the grid of §5.7 with three slot elements, `data-slot="rail"`, `data-slot="center"` and `data-slot="workbench"`, and puts `data-demo-focus="workbench"` on the workbench slot; `Watch` renders `data-demo-focus="replay"`, `Lab` `data-demo-focus="lab"`, each with a title and one sentence.
  5. Extend `scripts/verify/ui-kit.ts` with `ensureBuilt` and `openApp` (§3.4) and write `scripts/verify/ui-04-shell.ts`.
- **Files:** `package.json`, `vite.config.ts`, `index.html`, `src/ui/{main,App,routes}.tsx`, `src/ui/state/{SessionProvider.tsx,hooks.ts}`, `src/ui/shell/*.tsx`, `src/ui/pages/{Home,Watch,Lab}.tsx`, `src/ui/styles/{base,layout,controls,platform-skin,motion}.css`, `scripts/verify/ui-kit.ts`, `scripts/verify/ui-04-shell.ts`.
- **Checks (16):**
  1. `ensureBuilt()` resolves, `dist/index.html` exists and contains `<div id="root">` and `rel="icon"`.
  2. `index.html` has exactly two `rel="preload"` font links, both `as="font"` with `crossorigin`.
  3. With the colour scheme `dark` and no stored value, `document.documentElement.dataset.theme` is `dark` after load; with `localStorage["dr-theme"] = "light"` it is `light`.
  4. `/` reaches `body[data-app-ready="true"]` within 5 s and the response status was `200`.
  5. `/` has exactly one `[data-demo-focus]` and its value is `workbench`; `/watch` has exactly one and it is `replay`; `/lab` exactly one and it is `lab`.
  6. Loading `/nope` ends at the path `/` (the route table redirects).
  7. At 1440 × 900 the `header` is `64px` tall and its first child has the class `brandmark--header` and the text `Doorstep Rhythm`.
  8. At 1440 the grid container's `grid-template-columns` computes to a first column `240px` and a last column `380px`.
  9. At 1280 the first column is `208px` and the last is `360px`.
  10. At 1024 the radiogroup `Paper | Dusk` is inside `aside`, and at 900 it is inside `header`, never in both.
  11. Clicking `Dusk` sets `data-theme="dark"` and `localStorage["dr-theme"]` to `dark`, and after a reload the theme is still `dark`.
  12. With `Storage.prototype.getItem` replaced by a function that throws (added through an init script) the page still reaches `data-app-ready` and the theme follows the colour scheme.
  13. At 390 × 844 and at 1440 × 900 no element on `/`, `/watch` or `/lab` has `getBoundingClientRect().right` beyond `clientWidth + 0.5` (the first assertion of §5.11).
  14. `document.body` computed `font-family` begins with `"Atkinson Hyperlegible Next"` and `document.fonts.status` is `loaded`.
  15. `/?hook=1` defines `window.__doorstep` with a `session` and a function `openFirstCandidate`; `/` without the query leaves `window.__doorstep` undefined, and on both pages `window.__runTrace.get()` returns an object with an `entries` array.
  16. `GET /health` on the same server returns `ok: true`, and `GET /events` returns `200` (the SPA fallback does not shadow API routes).
- **Verify:** `npx vite-node scripts/verify/ui-04-shell.ts`
- **Expected output:** `ui-04-shell: 16 checks OK`
- **Proves:** the product builds and is served by the same server that holds the secrets, the shell has the brandmark first and the grid of the identity, the theme is correct before the first paint even when storage is blocked, and each demo route has exactly one focus element.

### WU-UI-05 — the primitives and the internal gallery
- **Goal:** every primitive of §3.3 exists with all of its states, styled only through tokens, and the gallery at `/__kit` shows them for the measured checks.
- **Steps:**
  1. Write `src/ui/help/helpContent.ts` (copy of §5.6A, verbatim, `explainerCopy` included) and the type part of `src/ui/copy/banner.ts` (`Tone`, `BannerSpec`, `BannerInput`; `pickBanner` arrives in WU-11).
  2. Write `src/ui/primitives/{Surface,Metric,HelpTip,Button,Message,StatusChip,SourceBadge,SyntheticBadge,WorkIndicator,EmptyState,Dialog,Explainer}.tsx` in the build order of §6.1 items 4–7 (`Message` and `Metric` first) and `src/ui/primitives/index.ts`.
  3. Write `src/ui/styles/controls.css` and `src/ui/styles/message.css` from the recipes of §6.2 and import them, with `base.css`, `layout.css`, `motion.css` and `platform-skin.css`, in `src/ui/main.tsx` (nothing is imported from a component).
  4. Write `src/ui/pages/Kit.tsx` (rendered at `/__kit`, registered in `routes.tsx`): one section per primitive with `data-kit="<name>"`, every state side by side, `Dialog` and `Explainer` opened by buttons, and a counter element `data-kit-calls` that each callback increments.
  5. Write `scripts/verify/ui-05-primitives.ts`.
- **Files:** `src/ui/help/helpContent.ts`, `src/ui/copy/banner.ts`, `src/ui/primitives/*`, `src/ui/styles/{controls,message}.css`, `src/ui/pages/Kit.tsx`, `src/ui/routes.tsx`, `src/ui/main.tsx`, `scripts/verify/ui-05-primitives.ts`.
- **Checks (18):**
  1. Every `[data-kit="surface"] [data-surface]` has a computed border style other than `none` and a `box-shadow` other than `none`, and a surface without `title` and `eyebrow` renders no header element.
  2. A surface with `help="check-panel"` contains one `button[data-help-for="check-panel"]` whose `aria-label` equals `helpContent["check-panel"].label`.
  3. Clicking a help button opens an element with `role="dialog"` containing the matching `body` text, and pressing Escape closes it and returns focus to the button.
  4. At 1440 px the computed font size of `[data-metric]` in the `xl` metric is at least `64px`, in `lg` at least `28px`, and all three sizes have `font-variant-numeric` containing `tabular-nums`.
  5. A metric of `12800` shows `12.8k` with `title="12800"`, and a metric of `150` with `max=99` shows `99+`.
  6. A metric of `null` shows `—`, and a loading metric has `aria-busy="true"` and no digit characters.
  7. The value `88.8k` placed in a 120 px wide container reports exactly one client rect (no wrap).
  8. For each of the five tones and three tiers the message has an `svg` glyph and a non-empty title, so no tone is carried by colour alone.
  9. A `danger` message has `role="alert"`, and the other four tones have `role="status"`.
  10. A message with two `items` renders one `dl` with two `dt` and two `dd`; with `items` empty or absent no `dl` exists.
  11. A primary button's computed background equals the computed `--accent`; a ghost button's background is transparent; after pressing Tab to a button its `outline-style` is not `none` and its outline width is at least `2px`.
  12. A loading button is disabled, has `aria-busy="true"`, and its width is within 1 px of the same button not loading.
  13. `SourceBadge` renders the texts `AGENT`, `YOU` and `SYSTEM` for `agent`, `human` and `system`, and `SyntheticBadge` text matches `/sample|synthetic/i`.
  14. `WorkIndicator` has `role="status"`, `aria-live="polite"`, the given label and exactly three `.work-indicator__tick` children.
  15. `EmptyState` shows title and detail, and pressing its primary action increments `data-kit-calls` by exactly one.
  16. After opening the dialog, `document.activeElement` is inside it; five presses of Tab keep the focus inside; Escape and a click on the backdrop each close it.
  17. The explainer panel `[data-app-explainer-panel]` shows `explainerCopy.title` and five labelled sections, and its `Try it` button increments `data-kit-calls`; the app-bar trigger `[data-app-explainer]` exists on `/`.
  18. The visible text of `/__kit` has no `bannedHits` and matches none of the broken-template patterns of §5.11 assertion 6.
- **Verify:** `npx vite-node scripts/verify/ui-05-primitives.ts`
- **Expected output:** `ui-05-primitives: 18 checks OK`
- **Proves:** the building blocks never render an empty slot or a colour-only state, numbers never wrap and stay tabular, and every control shows a focus ring and can be driven by keyboard.

### WU-UI-06 — the week calendar
- **Goal:** `WeekRibbon` draws `weekRibbon(model)` as a paper calendar with ticks, visits, quiet bands, outages, the history seam and the pencil circle, and a person can select a day.
- **Steps:**
  1. Write `src/ui/state/sampleWeek.ts` (`loadSampleWeek(session)` of §6.3 item 5) and `src/ui/state/useUiActions.ts`.
  2. Write `src/ui/week/{WeekRibbon,DayColumn,IncidentCircle,BaselineStrip}.tsx` per §6.5, `ariaDayLabel` is written here in `src/ui/copy/templates.ts`; the file's other functions are left to WU-07.
  3. Add the ribbon recipes (`.hour-line`, `.quiet-band`, `.visit`, `.tick`, `.outage-band`, `.seam`, `.pencil-circle`, the `tick-in` and `draw` keyframes with their reduced-motion substitutes) to `layout.css` and `motion.css`, and mount `WeekRibbon` and `BaselineStrip` in the `center` slot of `Home`.
  3a. Add `readModel(page)` to `scripts/verify/ui-kit.ts`: evaluates `JSON.stringify(window.__doorstep.session.store.getState())` and returns the parsed `WeekModel`; `listOf(x)` returns `x` when it is an array and `Object.values(x)` otherwise. (`WeekModel` is plain JSON, DP-DOMAIN-ENGINE §3.)
  4. Write `scripts/verify/ui-06-ribbon.ts`; it opens `/?hook=1`, presses `Load the sample week`, reads the model with `readModel` and computes `weekRibbon(model)` in Node for comparison.
- **Files:** `src/ui/state/{sampleWeek,useUiActions}.ts`, `src/ui/week/*.tsx`, `src/ui/copy/templates.ts`, `src/ui/styles/{layout,motion}.css`, `src/ui/pages/Home.tsx`, `scripts/verify/ui-kit.ts`, `scripts/verify/ui-06-ribbon.ts`.
- **Checks (16):**
  1. On a fresh `/?hook=1` seven `[data-day]` buttons exist, none has `aria-pressed="true"`, and the empty state `No doorway events yet` is visible below them.
  2. After pressing `Load the sample week` the empty state is gone and more than 20 `.tick` elements exist.
  3. The seven column eyebrows are distinct values from `MON` to `SUN`, each follows the previous one in week order, and the subject numbers equal the day of month of each `weekRibbon(model)` entry's `dateLabel`.
  4. For every day, the counts of `.tick`, `.visit`, `.quiet-band` and `.outage-band` equal the lengths of `ticks`, `visits`, `quietBands` and `outages` of the Node-computed ribbon, and `.pencil-circle` count equals `incidents.length` (zero at this point).
  5. The first `.tick` of the first day that has ticks has `top` equal to `minute / 14.4` per cent within `0.05`, where `minute` is the first tick's minute from the Node ribbon.
  6. A `.quiet-band`'s `height` per cent equals `(toMin − fromMin) / 14.4` within `0.05`.
  7. The `.seam` element exists in exactly the day with a non-null `seamMinute`, contains the text `from history`, and has a computed `border-top-style` or `border-left-style` of `dashed`.
  8. At least one `.tick[data-dup="true"]` exists, and its computed colour equals the computed `--degraded` of the page.
  9. Every `.outage-band` has a `title` containing `min offline` and a computed `background-image` containing `gradient`.
  10. Clicking the third column leaves exactly one `[data-day]` with `aria-pressed="true"`, its bottom border is `2px` and its colour equals the computed `--accent`.
  11. Pressing Tab until a day column has focus and then Enter selects it, and the focused column shows an `outline-style` other than `none`.
  12. After `openFirstCandidate()` exactly one `.pencil-circle` exists, inside the column of its `dayIndex`, its `aria-label` starts `Open incident: `, its height is at least `44px`, and its `ellipse` has `pathLength="1"`.
  13. The circle's stroke equals the computed `--warning` while the incident is `open`, `--success` after `set_incident_status` `resolved`, and `--border-strong` after `dismissed`.
  14. With the default motion preference the circle's ellipse has a computed `animation-name` other than `none`; in a context with `reducedMotion: "reduce"` it is `none` or its duration is at most `0.001s`, and its `stroke-dashoffset` is `0`.
  15. Clicking the circle gives it `aria-pressed="true"` and selects its day column.
  16. The baseline text matches `/^Usual: visits under \d+ min; busiest \d\d:00$/` and its two numbers equal `round(baseline.dwellP90Sec / 60)` and the busiest hour of the model's `baseline.rhythm`.
- **Verify:** `npx vite-node scripts/verify/ui-06-ribbon.ts`
- **Expected output:** `ui-06-ribbon: 16 checks OK`
- **Proves:** the calendar is a pure rendering of the domain's own derivation, the one moment that does not belong gets a pencil circle that draws itself and honours reduced motion, and a day can be chosen by mouse or keyboard.

### WU-UI-07 — the week summary, the checks, the incident card and the total templates
- **Goal:** the person sees a hero count in plain words, every check as a row with a fix where one exists, and one incident card with its snapshot; all message text comes from total templates.
- **Steps:**
  1. Complete `src/ui/copy/templates.ts` (§3.1 and §6.10; every function total) including `RULE_WORDS`.
  2. Write `src/ui/state/hooks.ts` additions `useIssues` (§6.3 item 2) if not yet complete, and `src/ui/panels/{WeekTitle,WeekSummary,CheckPanel,IssueRow,IncidentCard,NudgeCard}.tsx` per §6.4. `NudgeCard` is built here and verified in WU-08.
  3. Put `WeekTitle`, `WeekSummary` above the ribbon and `CheckPanel`, `IncidentCard` in the `workbench` slot of `Home` (WU-08 adds the agent panels above them).
  4. Write `scripts/verify/ui-07-checks.ts`.
- **Files:** `src/ui/copy/templates.ts`, `src/ui/state/hooks.ts`, `src/ui/panels/{WeekTitle,WeekSummary,CheckPanel,IssueRow,IncidentCard,NudgeCard}.tsx`, `src/ui/pages/Home.tsx`, `scripts/verify/ui-07-checks.ts`.
- **Checks (16):**
  1. After loading the sample week, `WeekTitle` text equals `weekTitle(model)` (`The week of {d} {Month}`) and its support text starts `Rosa's front door · Sample week`.
  2. The `WeekSummary` hero value equals `errors + warnings` of `window.__doorstep.session.checkNow()`, its unit is `to look at`, and its tone is `danger` while any error exists.
  3. The hero value's computed font size at 1440 px is at least `64px`.
  4. The lead sentence under the hero equals `leadSentence(open)`.
  5. The `CheckPanel` eyebrow is `Checks`, its count badge equals the hero value, and it contains `[data-help-for="check-panel"]`.
  6. The number of issue rows equals the number of issues, each has a chip reading `Error` or `Warning`, and each row's computed `border-left-width` is `3px`.
  7. Each row's support text starts with one of `Quiet hours`, `Long visits`, `Device offline`, `Consent`, `Duplicate events`, `Change history`, `Moments without a write-up` or `Check`.
  8. The sample week has at least one `Merge duplicates` button, and pressing it lowers the error count of `checkNow()` and updates the panel count within 1 s.
  9. After pressing every `Merge duplicates` button no row has that button.
  10. With no incident the incident card shows the title `Nothing broke the rhythm`.
  11. After `openFirstCandidate()` the card eyebrow matches `/^[A-Z]{3} \d{1,2} [A-Z]{3} · \d\d:\d\d$/` and the `h2` text equals the new incident's `title` in the model.
  12. The card shows one `img` whose `src` starts `data:image/`, whose `alt` starts `Snapshot from `, inside a well whose width to height ratio is `16:9` within 1 %.
  13. Pressing `Mark as explained` sets the incident to `explained` in the model and keeps the card; pressing `Dismiss` sets it to `dismissed` and the circle stroke becomes `--border-strong`.
  14. No element `[data-nudge-card]` exists while no nudge has status `proposed`.
  15. The visible text of the week summary, the check panel and the incident card has no `bannedHits` and matches none of the broken-template patterns.
  16. Pressing Tab from the first row reaches each fix button and each button of the incident card in document order, and each shows an `outline-style` other than `none`.
- **Verify:** `npx vite-node scripts/verify/ui-07-checks.ts`
- **Expected output:** `ui-07-checks: 16 checks OK`
- **Proves:** the family member reads the week's state in one number and one sentence, each check is a plain row with the right fix, and a pencil-circled moment opens a card with its evidence.

### WU-UI-08 — the workbench: agent panel, approvals, activity, manual runner and the friendly trace
- **Goal:** a person can start the review, watch it in plain words, decide every approval, and run any action by hand, all from the right-hand column.
- **Steps:**
  1. Write `src/ui/trace/friendly.ts` (§3.2, §6.7) and `src/ui/state/useRun.ts` (§6.3 item 4).
  2. Write `src/ui/panels/{AgentPanel,ApprovalPanel,ActivityFeedPanel,ManualRunnerPanel}.tsx` per §6.6, with `data-run-status` on the wrapper in `Home` and `data-run-phase` on `AgentPanel`; the phase list and the `WorkIndicator` mapping are §6.3 items 8–9.
  3. Complete `phaseLabel` in `templates.ts`, add the wrapper and descendant selectors of §6.6 items 2–3 to `platform-skin.css` (`[data-result-region="approval-bar"] > div > div`, `.feed-in` clamp, the `<ol>` reset) and mount the four panels above `CheckPanel` in the `workbench` slot of `Home`.
  4. Extend `scripts/verify/ui-kit.ts` with `reviewTheWeek` (§3.4): clicks the button whose name starts `Review the`, then loops every 100 ms: if `button:has-text("Approve")` inside `[data-result-region="approval-bar"]` is visible, click it; stops when `[data-run-status="done"]` appears (60 s limit, failing with the last `data-run-phase` in the message).
  5. Write `scripts/verify/ui-08-workbench.ts`. It uses `openApp({ env: { AGENT_PROVIDER: "golden" }, path: "/?hook=1" })` and `page.on("request")` to record request headers.
- **Files:** `src/ui/trace/friendly.ts`, `src/ui/state/useRun.ts`, `src/ui/panels/{AgentPanel,ApprovalPanel,ActivityFeedPanel,ManualRunnerPanel}.tsx`, `src/ui/copy/templates.ts`, `src/ui/styles/platform-skin.css`, `src/ui/pages/Home.tsx`, `scripts/verify/ui-kit.ts`, `scripts/verify/ui-08-workbench.ts`.
- **Checks (18):**
  1. The agent panel is a `[data-surface][data-emphasis="primary"]` with the eyebrow `Agent`; on an empty model its button reads `Review the sample week`, and after the sample week is loaded it reads `Review the week`.
  2. The agent subject text contains `Recorded run` when the server runs the golden rung.
  3. Before any run `data-run-status` is `idle` and `data-run-phase` is `idle`.
  4. Within 2 s of pressing the button `data-run-status` is `running`, a `role="status"` indicator is visible, and the phase list has seven items named, in order, `Read the week`, `Plan the review`, `Check each day`, `Run the checks`, `Fix what was found`, `Write it up`, `Your decision`.
  5. Polling `data-run-phase` every 50 ms during the run observes only names from `perceive, plan, act, verify, repair, explain, checkpoint`, and the sequence of distinct values is in that order.
  6. The current phase item has the computed colour `--accent`, and every finished item contains an `svg` check glyph.
  7. When an approval is pending the panel text contains `AGENT WANTS TO`, the panel has `data-result-region="approval-bar"`, its computed `position` is `sticky`, and the inner band's background equals the computed `--bg-warning`.
  8. While nothing is pending the panel text contains `Nothing is waiting for you.`.
  9. Unchecking `Require approval` makes `session.gate.isEnabled()` false and checking it again makes it true (read through `window.__doorstep.session`).
  10. After `reviewTheWeek` the status is `done`, the model has at least one incident, the number of `.pencil-circle` elements equals the number of incidents with status `open` or `explained`, and `checkNow()` reports zero errors.
  11. The activity feed has at least 15 rows after the run.
  12. Every row begins with `AGENT`, `YOU` or `SYSTEM`, and no row's text matches `/[a-z]+_[a-z_]+/` (no raw action names).
  13. The feed contains the four role phrases `Reader read the records`, `Planner drew up the review`, `Agent chose the next step` and `Writer wrote it up`.
  14. A feed row has computed `max-height` `56px`; a row whose `scrollHeight` exceeds its `clientHeight` has a `Show more` button, and pressing it makes the row taller than 56 px.
  15. During the run an element `[data-nudge-card]` appears at least once, its support text matches `/^To Marta · family messages (on|off)$/`, and pressing its `Approve` sets the nudge to `approved` in the model with a trace entry whose badge is `YOU`.
  16. The `details` titled `Run an action by hand` is closed by default; opened, the kit runner offers at least 20 actions.
  17. `friendlyEntry` maps a model entry with `name: "planner"` to badge `AGENT`, actor `Planner`, title `Planner drew up the review`; an action entry to the descriptor title; an approval entry to a title starting `Approval · `; a system entry to badge `SYSTEM`; and no `detail` ever contains `· ·`, a leading or trailing `·`, `undefined` or `null`.
  18. Pressing the review button a second time while running sends no new run: across the whole run the recorded `x-run-id` request headers have exactly one distinct value.
- **Verify:** `npx vite-node scripts/verify/ui-08-workbench.ts`
- **Expected output:** `ui-08-workbench: 18 checks OK`
- **Proves:** the review can be started, watched and decided from the page alone, the agent's trace reads as plain sentences, and the unstyled kit components are skinned through wrappers without being forked.

### WU-UI-09 — the household rail
- **Goal:** the left column shows the household, devices, quiet hours, consent, the Ring connection and the inbox, every control changes the model through an action with `source: "human"`, and a pasted token is never echoed.
- **Steps:**
  1. Write `src/ui/panels/{HouseholdCard,DeviceList,QuietHoursEditor,ConsentList,ConnectPanel,ConnectDialog,WebhookInboxPill}.tsx`; fill the `rail` slot in `Rail.tsx` in that order with the `ThemeToggle` as footer.
  2. `QuietHoursEditor`: two `<input type="time">` (`Start`, `End`) bound to the model's quiet hours, a support line `Counted from {HH:MM} to {HH:MM}` from `EFFECTIVE_QUIET_HOURS`, and a callout `Pick two different times.` when start equals end (no action is called).
  3. `ConsentList`: one `role="switch"` per scope present in the model, calling `set_consent { scope, granted, actor: "human" }`.
  4. `ConnectDialog`: a `Dialog` labelled `Connect Ring` with `<input type="password" autocomplete="off">` labelled `Playground token`; empty submit shows `Paste a token first.`; submit calls the browser client's link method, clears the field in every outcome, and shows `ringError(status)` on failure. The token is held in a local variable only: never in state that is rendered, never in storage, never logged.
  5. `WebhookInboxPill` text is `Webhook inbox · {n} waiting` with `n = status.inboxDefault` until the sample week has been loaded and `0` after.
  6. Write `scripts/verify/ui-09-rail.ts`.
- **Files:** `src/ui/panels/{HouseholdCard,DeviceList,QuietHoursEditor,ConsentList,ConnectPanel,ConnectDialog,WebhookInboxPill}.tsx`, `src/ui/shell/Rail.tsx`, `src/ui/styles/layout.css`, `scripts/verify/ui-09-rail.ts`.
- **Checks (16):**
  1. After the sample week is loaded the household card has the eyebrow `Household` and shows `Rosa Alvarez`, `84` and `Marta`.
  2. Before the sample week is loaded the rail text contains no `undefined`, `null` or `NaN` and has no `bannedHits`.
  3. The device list has one row per device of the model, each with a description and a chip reading `Online` or `Offline`.
  4. A device with an outage shows `{n} min offline`, where `n` equals the sum of that device's outage minutes from `deviceOutages(model)` computed in Node.
  5. The quiet-hours inputs have the values `22:00` and `07:00`, and the support line contains the two clock strings computed from `EFFECTIVE_QUIET_HOURS` in Node.
  6. Setting the start to `23:00` updates the model's quiet hours through `set_quiet_hours` and the support line changes.
  7. Setting the end equal to the start shows `Pick two different times.` and leaves the model's quiet hours unchanged.
  8. The consent list has one `role="switch"` per scope in the model, each with `aria-checked`, and clicking one flips the model's `granted` flag.
  9. Focusing a consent switch and pressing Space flips it again.
  10. `Connect Ring` opens a dialog with `role="dialog"` named `Connect Ring` containing an input of `type="password"` with `autocomplete="off"`.
  11. Submitting an empty field shows `Paste a token first.` and issues no request to a `/api/ring/` link route.
  12. With the link route answering `401`, submitting `tok-SECRET-123` shows the `Couldn't read Ring` message, empties the field, and the string `tok-SECRET-123` appears nowhere in `document.documentElement.outerHTML`, in `localStorage`, in `sessionStorage` or in any console message.
  13. The inbox pill text matches `/^Webhook inbox · \d+ waiting$/`, and after the sample week is loaded it reads `Webhook inbox · 0 waiting`.
  14. At 1440 × 900 the rail has computed `position: sticky`, its `top` equals `appbar-h + gutter` (88 px), and with a 600 px tall viewport its `overflow-y` is `auto`.
  15. The theme toggle is the last child of the rail, and its two radios `Paper` and `Dusk` carry `aria-checked`, exactly one being `true`.
  16. At 390 px the page grid has one column and the rail's top is below the workbench's bottom.
- **Verify:** `npx vite-node scripts/verify/ui-09-rail.ts`
- **Expected output:** `ui-09-rail: 16 checks OK`
- **Proves:** the household's facts and settings are editable only through logged actions, the token field cannot leak the secret it receives, and the column reorders on a phone.

### WU-UI-10 — the live view
- **Goal:** `Live view` opens a WHEP session through the server, shows a labelled snapshot when the answer is simulated, shows the stream when it is real, counts down, and always closes the connection.
- **Steps:**
  1. Write `src/ui/panels/LiveViewPanel.tsx` per §6.8, mount it in the `center` slot below the ribbon when `ui.liveViewDeviceId` is set, and wire the `Live view` button of `IncidentCard` to `useUiActions().openLiveView`.
  2. Write `scripts/verify/ui-10-liveview.ts`. A page init script replaces `RTCPeerConnection` with a stub class that records `createOffer`, `setLocalDescription`, `setRemoteDescription`, `close` and `ontrack`, and exposes its calls on `window.__pc`; the script answers the server routes with `page.route` for the failure, `maxSeconds` and real-answer cases.
- **Files:** `src/ui/panels/LiveViewPanel.tsx`, `src/ui/panels/IncidentCard.tsx`, `src/ui/pages/Home.tsx`, `scripts/verify/ui-10-liveview.ts`.
- **Checks (12):**
  1. Pressing `Live view` in the incident card opens `[data-live-view]` and the model's `ui.liveViewDeviceId` equals the snapshot's device id.
  2. The simulated answer shows the callout text `Simulated live view — the sample week has no camera stream.`.
  3. The panel shows an `img` whose `src` starts `data:image/`, and no `video` element has a non-null `srcObject`.
  4. The countdown metric starts at 30 or less and is at least 1 lower after 1.5 s.
  5. Exactly one start request is sent when the panel opens and exactly one stop request, carrying the same session id, when `Close` is pressed.
  6. After `Close` the model's `ui.liveViewDeviceId` is `null`, the panel is gone, and the stub's `close` count equals the number of peer connections created.
  7. With the start route answering `maxSeconds: 2` the panel closes by itself within 4 s and a stop request was sent.
  8. With the start route answering `502` the panel shows `Live view didn't start` and `Ring didn't answer. Try again in a moment.`, no stop request is sent, and every created peer connection is closed.
  9. With a non-simulated answer `setRemoteDescription` is called once with `type: "answer"`, the stub's `ontrack` handler attaches a stream, the `video` has a non-null `srcObject`, and the simulated callout is absent.
  10. Every request made by the page during these cases has the page's own origin.
  11. The `video` element has the `autoplay`, `playsinline` and `muted` attributes.
  12. Pressing Escape closes the panel and returns focus to the `Live view` button, and the panel has `data-result-region="live-view"` with a help button `[data-help-for="live-view"]`.
- **Verify:** `npx vite-node scripts/verify/ui-10-liveview.ts`
- **Expected output:** `ui-10-liveview: 12 checks OK`
- **Proves:** the browser never talks to Ring itself, a simulated stream is labelled as such, and no live-view connection survives a close, a timeout or a failure.

### WU-UI-11 — every state, the banners and the total templates
- **Goal:** each rung of the degraded ladder, each error and each warning has one banner with icon, title and detail, and every template is total.
- **Steps:**
  1. Complete `src/ui/copy/banner.ts` with `pickBanner` and the table of §6.3 item 6, and fill `src/ui/shell/Banners.tsx` (one `Message` of tier `banner` below the app bar, aligned to the grid's left edge, actions wired as §6.3 and §5.6: `use-sample` → `loadSampleWeek`, `retry` → refresh status, `connect` and `paste-token` → open `ConnectDialog`, `show-details` → expand the message in place, `open-actions` → open the manual runner `details`).
  2. Complete the app-bar status chips of §6.3 item 7 in `AppBar.tsx`.
  3. Write `scripts/verify/ui-11-states.ts`; the browser cases use `page.route` to fail or alter `/api/status`, `/api/ring/*` and the role route.
- **Files:** `src/ui/copy/banner.ts`, `src/ui/copy/templates.ts`, `src/ui/shell/{Banners,AppBar}.tsx`, `src/ui/pages/Home.tsx`, `scripts/verify/ui-11-states.ts`.
- **Checks (16):**
  1. `pickBanner` returns, for an input that makes only the condition of row N of §6.3 item 6 true, the banner of that row (tone, title and action key), for N = 1 to 8.
  2. For an input with every condition true `pickBanner` returns row 1; clearing row 1's condition returns row 2, and so on down to row 8, then `null`.
  3. `recordedRun("12 October")` ends `saved on 12 October.` and `recordedRun(null)` ends `this is a saved run.`.
  4. Every function of `templates.ts` called with each of `undefined`, `null`, `""`, `NaN`, `-5`, `0`, `1`, `2` returns a title and detail (or a sentence) that are non-empty strings and match none of `/(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b|\bNaN\b)/`.
  5. `tokenWarning(0)` and `tokenWarning(null)` say `less than a minute`; `tokenWarning(1)` says `1 minute`; `tokenWarning(7)` says `7 minutes`.
  6. `budgetWarning(85).title` is `Demo budget at 85%`, `budgetWarning(NaN).title` is `Demo budget at 0%` and `budgetWarning(140).title` is `Demo budget at 100%`.
  7. `leadSentence(1)` contains `1 moment` and not `1 moments`, and `leadSentence(5)` contains `5 moments`.
  8. `weekTitle` and `weekSupport` for a model with no events and an empty household name return `The week of …` text with no empty slot and `The front door · Sample week`.
  9. With the golden rung, exactly one `[data-message][data-tier="banner"]` is visible, it reads `Replaying a recorded run`, and its left edge is within 1 px of the grid's left edge.
  10. With `AGENT_PROVIDER=manual` the banner reads `Running by hand` and its `Open the action list` button opens the `details` titled `Run an action by hand`.
  11. The agent chip reads `Recorded run`, has the `Layers` glyph and a computed background equal to `--bg-degraded`; the Ring chip reads `Sample week`.
  12. With `/api/ring/*` failing at the network level the banner reads `Couldn't read Ring` with `Use the sample week`; pressing it loads events into the ribbon and the banner changes to `Replaying a recorded run`.
  13. With the role route answering `500` and the review started, the banner reads `That didn't work`, `Show details` expands the message, and the banner text matches no `/\bat \S+:\d+/` stack pattern.
  14. With `/api/status` answering a live ring with `tokenExpiresInSec: 120` the banner reads `Token ending soon` with `Your Playground token has 2 minutes left.`, and `Paste a new token` opens the connect dialog.
  15. With `/api/status` answering `usedPct: 85` and no other condition, the banner reads `Demo budget at 85%` with `The review will stop at the limit.`.
  16. The text of every banner of checks 9 to 15 has no `bannedHits`.
- **Verify:** `npx vite-node scripts/verify/ui-11-states.ts`
- **Expected output:** `ui-11-states: 16 checks OK`
- **Proves:** no state is printed over the layout, none is carried by colour alone, no template can render an empty slot, and a degraded rung is always named on screen.

### WU-UI-12 — the hero slot, the demo-focus hooks, motion and camera-ready sizes
- **Goal:** the stage is ready for DP-3D without waiting for it, each demo route has one focus element, the quiet frame is reachable, and motion and size rules hold.
- **Steps:**
  1. Write `src/ui/scene/SceneHost.tsx` per §6.9 exporting `pickScene(glob)` and `canWebGL(canvasFactory?)`, and `src/ui/panels/SceneStage.tsx`; mount the stage in the `center` slot between the week title and the ribbon. `SceneHost` honours the query `?scene=off` (forces the fallback).
  2. Add the motion tokens' substitutes to `motion.css` (§5.5) and check that no component sets its own duration.
  3. Write `scripts/verify/ui-12-hero.ts`.
- **Files:** `src/ui/scene/SceneHost.tsx`, `src/ui/panels/SceneStage.tsx`, `src/ui/pages/Home.tsx`, `src/ui/styles/motion.css`, `scripts/verify/ui-12-hero.ts`.
- **Checks (14):**
  1. At 1440 px the stage's width to height ratio is `16:5` within 1 %, and its height is at least `300px`; at 1280 px it is at least `240px`.
  2. The stage has `data-slot="stage"` and `data-result-region="scene-3d"`, and contains `[data-help-for="scene-3d"]`.
  3. The toolbar has the buttons `Overview`, `Focus` and `Walk`; `Focus` is `aria-disabled` while there is no incident; after `openFirstCandidate()` pressing `Focus` sets its `aria-pressed` to `true` and the others to `false`, and the model's `ui.shotId` equals `focus:<id of that incident>`; pressing `Walk` makes `ui.shotId` equal `walk`.
  4. With `?scene=off` the stage shows `3D view unavailable`, carries `data-demo-3d="unavailable"`, and the ribbon still has seven day columns.
  5. `pickScene({})` is `null`; `pickScene({ "/src/3d/DoorwayScene.tsx": f })` is `f`; with two entries it returns the one whose key ends `DoorwayScene.tsx`.
  6. `canWebGL(() => ({ getContext: () => null }))` is `false`, and `canWebGL(() => ({ getContext: () => ({}) }))` is `true`.
  7. At 1440, 1024 and 390 px `/` has exactly one `[data-demo-focus]`, its value is `workbench`, and it has a non-zero size.
  8. `/watch` has exactly one `[data-demo-focus="replay"]` and `/lab` exactly one `[data-demo-focus="lab"]`, each with non-zero size.
  9. After `reviewTheWeek` the page is in its quiet frame: `data-run-status` is `done`, no `[data-message][data-tier="toast"]`, no visible `[role="status"][aria-busy="true"]`, the approval panel reads `Nothing is waiting for you.`, and the hero metric reads `0` with the unit `all clear`.
  10. In a context with `reducedMotion: "reduce"` no element has a computed `animation-duration` above `0.01s` together with an `animation-name` other than `none`, and no `button` has a `transition-duration` above `0.01s`.
  11. By default the computed `--dur-base` and `--dur-slow` parse to values between 200 ms and 400 ms, and a `.tick` has an `animation-duration` in the same range.
  12. At 1440 × 900 the body font size is at least `18px`, the hero metric at least `64px`, and every `.metric__value--lg` and `.metric__value--xl` at least `28px`.
  13. `[data-demo-3d]` exists on the stage whenever the page is loaded (value `unavailable` while no scene is present).
  14. Switching shots changes the stage's height by no more than 1 px.
- **Verify:** `npx vite-node scripts/verify/ui-12-hero.ts`
- **Expected output:** `ui-12-hero: 14 checks OK`
- **Proves:** the hero slot degrades to a message without breaking the flat week, DP-3D can drop a component into a stable frame, and the demo routes expose exactly the focus the recording needs.

### WU-UI-13 — the measured craft audit
- **Goal:** the nine mechanical assertions of the craft contract hold in the rendered page in both themes at 1440 and 390 px, with the review run finished, and the app's own strings carry no banned word.
- **Steps:**
  1. Add `CRAFT_ASSERTIONS(page)` to `scripts/verify/ui-kit.ts`: one `page.evaluate` that runs the nine JavaScript snippets of §5.11 (§11 of the contract) unchanged, and returns the nine `{ name, ok, detail }` objects in the order of the contract, with `ok` true exactly when the snippet's "must be" condition holds and `detail` the first five offending class names or texts.
  2. Write `scripts/verify/ui-craft.ts`: for each of the four configurations `1440 × 900 paper`, `1440 × 900 dusk`, `390 × 844 paper`, `390 × 844 dusk` call `openApp` (path `/?hook=1`), run `reviewTheWeek`, run `CRAFT_ASSERTIONS`, report one check per assertion (label `[<config>] assertion <n>`, the detail on failure), then run the banned-word scan once.
  3. Run it, fix every failure at its source (the component or the stylesheet, never the assertion), and re-run until it prints the expected line. Typical fixes, in the order they usually appear: a metric without `white-space: nowrap`, a chip with a fixed height and a long label, a surface without its shadow token, a rail control wider than 390 px minus the gutters.
- **Files:** `scripts/verify/ui-kit.ts`, `scripts/verify/ui-craft.ts`, and whichever component or stylesheet a failure points to.
- **Checks (37):**
  1. [1440 × 900 paper] assertion 1: no element overflows the viewport horizontally.
  2. [1440 × 900 paper] assertion 2: no button, chip, metric, heading or table cell clips its own text.
  3. [1440 × 900 paper] assertion 3: no metric value wraps onto a second line.
  4. [1440 × 900 paper] assertion 4: every metric value uses tabular figures.
  5. [1440 × 900 paper] assertion 5: no `[data-surface]` is flat (each has a border or a shadow).
  6. [1440 × 900 paper] assertion 6: no message, status or alert text matches a broken-template pattern.
  7. [1440 × 900 paper] assertion 7: help buttons are at least as many as result regions and the explainer trigger exists.
  8. [1440 × 900 paper] assertion 8: the body uses a real typeface and `document.fonts.status` is `loaded`.
  9. [1440 × 900 paper] assertion 9: at least three elements are painted with the accent token.
  10. [1440 × 900 dusk] assertion 1: no element overflows the viewport horizontally.
  11. [1440 × 900 dusk] assertion 2: no button, chip, metric, heading or table cell clips its own text.
  12. [1440 × 900 dusk] assertion 3: no metric value wraps onto a second line.
  13. [1440 × 900 dusk] assertion 4: every metric value uses tabular figures.
  14. [1440 × 900 dusk] assertion 5: no `[data-surface]` is flat (each has a border or a shadow).
  15. [1440 × 900 dusk] assertion 6: no message, status or alert text matches a broken-template pattern.
  16. [1440 × 900 dusk] assertion 7: help buttons are at least as many as result regions and the explainer trigger exists.
  17. [1440 × 900 dusk] assertion 8: the body uses a real typeface and `document.fonts.status` is `loaded`.
  18. [1440 × 900 dusk] assertion 9: at least three elements are painted with the accent token.
  19. [390 × 844 paper] assertion 1: no element overflows the viewport horizontally.
  20. [390 × 844 paper] assertion 2: no button, chip, metric, heading or table cell clips its own text.
  21. [390 × 844 paper] assertion 3: no metric value wraps onto a second line.
  22. [390 × 844 paper] assertion 4: every metric value uses tabular figures.
  23. [390 × 844 paper] assertion 5: no `[data-surface]` is flat (each has a border or a shadow).
  24. [390 × 844 paper] assertion 6: no message, status or alert text matches a broken-template pattern.
  25. [390 × 844 paper] assertion 7: help buttons are at least as many as result regions and the explainer trigger exists.
  26. [390 × 844 paper] assertion 8: the body uses a real typeface and `document.fonts.status` is `loaded`.
  27. [390 × 844 paper] assertion 9: at least three elements are painted with the accent token.
  28. [390 × 844 dusk] assertion 1: no element overflows the viewport horizontally.
  29. [390 × 844 dusk] assertion 2: no button, chip, metric, heading or table cell clips its own text.
  30. [390 × 844 dusk] assertion 3: no metric value wraps onto a second line.
  31. [390 × 844 dusk] assertion 4: every metric value uses tabular figures.
  32. [390 × 844 dusk] assertion 5: no `[data-surface]` is flat (each has a border or a shadow).
  33. [390 × 844 dusk] assertion 6: no message, status or alert text matches a broken-template pattern.
  34. [390 × 844 dusk] assertion 7: help buttons are at least as many as result regions and the explainer trigger exists.
  35. [390 × 844 dusk] assertion 8: the body uses a real typeface and `document.fonts.status` is `loaded`.
  36. [390 × 844 dusk] assertion 9: at least three elements are painted with the accent token.
  37. `python3 ../../hackathons/_useful/scripts/check_banned_words.py --preset app src/ui index.html brand` exits `0` and prints no hit.
- **Verify:** `npx vite-node scripts/verify/ui-craft.ts`
- **Expected output:** `craft: 37 checks OK`
- **Proves:** the nine defects that shipped in an earlier build cannot appear in this one: nothing spills, clips, wraps, floats flat, prints a broken sentence, goes unexplained or falls back to a system font, in either theme, on a laptop or a phone.

### WU-UI-14 — the twenty screenshots and the live visual review
- **Goal:** the 20 acceptance screenshots exist, each shows what its name says, the screenshot-time craft assertions pass, and a vision-model review of three of them scores at least 8 within three rounds.
- **Steps:**
  1. Write `scripts/ui-screenshots.ts`. It opens the app with `openApp`, and for each name of §5.10 reaches the state below, takes the PNG into `design_documents/ui-screenshots/`, and appends an entry to `design_documents/ui-screenshots/manifest.json` (`{ file, width, height, theme, textSeen: string[], craft: boolean }`, `textSeen` being the visible strings the script looked for, `craft` the result of `CRAFT_ASSERTIONS` for the four `home-*` files). It prints each written path on its own line and then `screenshots: 20 written`.

     | File | State reached |
     |---|---|
     | `home-paper.png`, `home-dusk.png` | the quiet frame after `reviewTheWeek` with the incident selected |
     | `home-1280x720-paper.png` | the same at 1280 × 720 |
     | `appbar-paper.png`, `appbar-dusk.png` | clip of the app bar, full width, 64 px tall |
     | `explainer-open-paper.png` | the explainer panel open |
     | `help-popover-paper.png` | the `check-panel` help popover open |
     | `working-paper.png` | the review running, the indicator reading `Reading doorway events` |
     | `empty-paper.png` | the fresh page, `No doorway events yet` |
     | `error-paper.png` | `/api/ring/*` failing, banner `Couldn't read Ring` |
     | `degraded-paper.png` | the golden banner `Replaying a recorded run` over a loaded week |
     | `metrics-widest-paper.png` | the kit page with the hero at `99+`, dwell `999` and cost `$99.9999` |
     | `approval-pending-paper.png` | a pending approval, `AGENT WANTS TO` visible |
     | `incident-selected-paper.png` | the incident card open with its snapshot |
     | `ribbon-detail-paper.png` | clip of the week ribbon with a pencil circle |
     | `lockup-contact-sheet.png` | `brand/lockup.html` with the mark at 16, 24, 32, 64 and 512 px in both themes |
     | `home-390-paper.png`, `home-390-dusk.png` | the quiet frame at 390 × 844 |
     | `lab-paper.png`, `watch-paper.png` | the two route shells |
  2. Write `scripts/verify/ui-14-screenshots.ts`: runs the screenshot script, checks files and manifest, then runs the review with `UI_REVIEW_ROUND` (default `1`) as described in check 10.
  3. The review command is `python3 hee/_useful/scripts/visual_review.py --screenshots design_documents/ui-screenshots/home-paper.png design_documents/ui-screenshots/incident-selected-paper.png design_documents/ui-screenshots/home-390-paper.png --brief design_documents/design_brief.md --rules ../../hackathons/templates/ui-craft.spec.md --unit ui --round <n> --out design_documents/visual-review/ui-<n>.json --log-md design_documents/visual-review-ui.md`. Exit `0` is a pass; exit `3` means below threshold 8.0: fix the top three defects named in `design_documents/visual-review-ui.md` in the components or stylesheets and re-run with `UI_REVIEW_ROUND` increased, at most three rounds; exit `1` prints `visual review unavailable: <reason>` and marks the unit blocked, not passed.
  4. Add the package scripts `verify:ui` (the fourteen scripts of this plan in order, joined by `&&`) and `screenshots`; run `npx vite-node scripts/sync-project-copies.ts` once so the chassis project directory holds the brandmark, the cinematic tokens and the brief.
- **Files:** `scripts/ui-screenshots.ts`, `scripts/verify/ui-14-screenshots.ts`, `design_documents/ui-screenshots/*.png`, `design_documents/ui-screenshots/manifest.json`, `design_documents/visual-review-ui.md`, `design_documents/visual-review/ui-<n>.json`, `package.json`.
- **Checks (12):**
  1. The screenshot script writes exactly the 20 file names of §5.10 and each file starts with the PNG signature.
  2. `home-1280x720-paper.png` is `1280 × 720`, both `home-390-*` files are `390` wide, both `appbar-*` files are at most `120` px tall and at least `1000` px wide, and every other file except the contact sheet is `1440 × 900`.
  3. Every file is larger than 15 000 bytes (the two app-bar clips larger than 5 000).
  4. The SHA-256 of the 20 files are 20 distinct values.
  5. The mean luminance (a canvas read in the browser, 0–255) of `home-paper.png` exceeds that of `home-dusk.png` by more than 60, and the same holds for the two `home-390-*` files.
  6. The manifest has 20 entries, and the `textSeen` of `metrics-widest-paper.png` contains `99+`, `999` and `$99.9999`.
  7. The `textSeen` of `working-paper.png` contains `Reading doorway events`, of `approval-pending-paper.png` `AGENT WANTS TO`, of `error-paper.png` `Couldn't read Ring`, of `degraded-paper.png` `Replaying a recorded run`, and of `empty-paper.png` `No doorway events yet`.
  8. The manifest entries of the four `home-*` files have `craft: true`.
  9. `UI_REVIEW_ROUND=4` makes the script exit `1` with the text `at most three rounds` without calling the review tool.
  10. The review command exits `0` and prints a line matching `/^visual review ui round [1-3]: \d+(\.\d)?\/10 -> pass; \d+ defects$/`; exit `3`, exit `1` and any other code fail the check with the tool's own output.
  11. `design_documents/visual-review/ui-<n>.json` exists, has a numeric `score` of at least `8`, and `design_documents/visual-review-ui.md` contains the text `round <n>`.
  12. `package.json` has a `verify:ui` script that names all fourteen scripts of this plan, in order.
- **Verify:** `npx vite-node scripts/verify/ui-14-screenshots.ts`
- **Expected output:** `ui-14-screenshots: 12 checks OK` (the 20 paths and `screenshots: 20 written` are printed before it, and the review's own result line appears between them and the last line)
- **Proves:** the interface looks like the brief in both themes and on a phone, each state exists as evidence a judge can see, and an independent reviewer scored it at the bar.

## §9 Verification summary

| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/ui-01-brief.ts` | `ui-01-brief: 9 checks OK` |
| 02 | `npx vite-node scripts/verify/ui-02-brand.ts` | `ui-02-brand: 16 checks OK` |
| 03 | `npx vite-node scripts/verify/ui-03-tokens.ts` | `ui-03-tokens: 16 checks OK` (after `contrast: 80 pairs OK`) |
| 04 | `npx vite-node scripts/verify/ui-04-shell.ts` | `ui-04-shell: 16 checks OK` |
| 05 | `npx vite-node scripts/verify/ui-05-primitives.ts` | `ui-05-primitives: 18 checks OK` |
| 06 | `npx vite-node scripts/verify/ui-06-ribbon.ts` | `ui-06-ribbon: 16 checks OK` |
| 07 | `npx vite-node scripts/verify/ui-07-checks.ts` | `ui-07-checks: 16 checks OK` |
| 08 | `npx vite-node scripts/verify/ui-08-workbench.ts` | `ui-08-workbench: 18 checks OK` |
| 09 | `npx vite-node scripts/verify/ui-09-rail.ts` | `ui-09-rail: 16 checks OK` |
| 10 | `npx vite-node scripts/verify/ui-10-liveview.ts` | `ui-10-liveview: 12 checks OK` |
| 11 | `npx vite-node scripts/verify/ui-11-states.ts` | `ui-11-states: 16 checks OK` |
| 12 | `npx vite-node scripts/verify/ui-12-hero.ts` | `ui-12-hero: 14 checks OK` |
| 13 | `npx vite-node scripts/verify/ui-craft.ts` | `craft: 37 checks OK` |
| 14 | `npx vite-node scripts/verify/ui-14-screenshots.ts` | `ui-14-screenshots: 12 checks OK` |
| all | `npm run verify:ui` | the fourteen results above, in order, exit 0 |

If a count differs because a check was split or merged while writing a script, change the number in the unit and in this table in the same edit.

## §10 Risks

- **The kit's unstyled markup changes.** A kit update could rename the descendants the wrappers select. Mitigation: the selectors are listed in §6.6, WU-08 checks 7, 11 to 14 fail loudly on a change, and the kit is never edited.
- **Fonts fail to load or differ in metrics.** Mitigation: three self-hosted files with `font-display: swap`, close fallback stacks, WU-03 check 1 and WU-13 assertion 8 (`document.fonts.status`).
- **A tabular number still wraps at 390 px.** Mitigation: one `Metric` component with `white-space: nowrap`, an abbreviation rule, and assertion 3 in all four configurations.
- **The golden run changes shape.** The scripts that call `reviewTheWeek` depend on the recorded run. Mitigation: they read the model rather than fixed counts wherever possible, and a re-recorded run only needs the phase names of §6.3 item 8.
- **The test hook ships in production.** `window.__doorstep` appears only with `?hook=1`; WU-04 check 15 proves it is absent without the query, and it exposes the same session the page already holds, never a secret.
- **A pasted token is echoed.** Mitigation: the token lives in a local variable, the field is cleared in every outcome, and WU-09 check 12 scans the DOM, storage and console for it.
- **WebGL is unavailable in the recording browser.** Mitigation: the stage falls back to a message and the flat week; DP-3D's recording step checks for a context before starting.
- **The visual review is unavailable or scores low.** The tool needs Vertex AI. Mitigation: exit `1` is reported as blocked rather than passed, three rounds are allowed, and the deterministic craft audit (WU-13) is the gate that does not depend on a model.
- **Contrast drifts when a token is edited.** Mitigation: the table in this plan is the oracle for `check-contrast`, so editing a token without editing the table fails WU-03 check 11.
- **A word on the banned list reaches the screen.** Mitigation: `bannedHits` in every text check, the static scan in WU-13 check 37, and the model-facing guard of DP-AGENT-WORKFLOW for generated text.
