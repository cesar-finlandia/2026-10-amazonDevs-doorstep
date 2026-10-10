# DP-API-TRANSPORT — Express server, event stream, routes, browser-side clients, architecture skeleton

> Plan 4 of 12. Owner of the one server process: the Express app, the SSE event hub, every route in blueprint §2.6, per-session Ring port selection and the in-memory Playground-token store, the agent service that picks and steps down the model rung, the two browser-safe clients (`HttpRingPort`, `HttpAgentTransport`), the proof log, and the `architecture.json` skeleton with its proof-harvest script. It wires the plans before it (DP-DOMAIN-ENGINE, DP-AGENT-WORKFLOW, DP-RING-INTEGRATION) together and invents no Ring wire logic and no prompt.
> Chassis paths are written `../../hackathons/…`. Imports use the `src/…` alias; every verification command runs under `vite-node`. Express is 5.2.1 (async handler rejections reach the error middleware by themselves; wildcard routes are written `/{*splat}`).

## §0 Context & blockers

**Must already exist before WU-01 runs** (plans 1–3):
`src/domain/*`, `src/agent/*`, `src/llm/*`, `src/prompts/*`, `src/ring/*`, `scripts/mock-ring-server.ts`, `data/bundle/doorstep-14d.json`, `data/golden-cache/*`, `scripts/verify/ring-port-contract.ts`, `config/cost.json`, `scripts/cost_sidecar.py`. Proof (each prints its own line):

```bash
npx vite-node scripts/verify/de-09-session.ts
npx vite-node scripts/verify/aw-10-floors.ts
npx vite-node scripts/verify/ri-08-history.ts
```
Expected: `de-09-session: 12 checks OK`, `aw-10-floors: 8 checks OK`, `ri-08-history: 9 checks OK`.

**Preflight (each line must print a path):**
```bash
ls -d src/resilience src/platform/transport src/ring/live-ring-port.ts src/agent/transport.ts src/llm/roles.ts data/golden-cache design_documents
node --version
```
Node must be 22 or newer (the Strands SDK and the type-stripping linter need it).

**Chassis facts this plan relies on (read from `../../hackathons/src/platform/transport/`, unchanged):**
- `createPublisher("sse")` returns a collectable publisher: `publish({ stepId, status, payload, traceId, degraded })`, `asSseStream(req, res)`, `collect(traceId?)` → `{ status, trace_id, events, degraded } | null`, `connectionCount`, `close()`. `stepId` must be kebab-case; `status` is `started | streaming | done | error`; a malformed envelope throws `EnvelopeValidationError`.
- An SSE frame is `id: <sequence>\nevent: envelope\ndata: <json>\n\n`; on attach the adapter writes headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive` and the comment `: connected`.
- The kit's `handleAgentStep(body, client)` answers `{ ok: true, result: { text, functionCalls, usage, model, latencyMs } }` or `{ ok: false, status, message }`; `StepFn` has the same shape.
- `../../hackathons/scripts/lint-architecture.ts <dir>` opens `<dir>/architecture.json`, resolves each proof `file` **relative to that directory**, and fails unless a sponsor node has an edge with a proof whose quoted text appears on the quoted line. Its success line begins `lint:architecture — OK (`.

**Product names used in copy:** none of this plan's user-visible strings use the banned vocabulary; the status labels are fixed in §5.6.

## §1 Purpose & requirement IDs

Make one process serve the browser, Ring and the models, and keep every secret on the server (NFR-01). The browser reaches Ring and the model only through two small clients that implement the same interfaces the engine already codes against, so the review week runs identically in-process (tests), against the server in bundle mode, and against live Ring.

| ID | This plan's share |
|---|---|
| FR-01 | `RingPort` over HTTP: `createHttpRingPort`, all 12 operations, same errors |
| FR-09 | `/events` and `/events/stream` carry the system envelopes the UI shows |
| FR-10 | `/api/ring/*`, per-session live/bundle selection, the Playground-token route |
| FR-11 | `/webhooks/ring` (verify, 200 fast, async queue), inbox draining, signed `SIMULATED` deliveries |
| FR-18 | `/api/agent/step`, `/api/agent/role/:role`, cost surfaced on `/api/status` |
| FR-21 | the degraded ladder on the server side: rung state, step-down, `system-degraded` envelopes |
| FR-24 | `/health` with the build marker; configuration; request logging without secrets |
| NFR-01 | token store in memory per session, never logged; `redact` on every log line |
| NFR-12 | the webhook route answers inside the 5 s budget |
| NFR-14 | cost chip data and warning envelopes |

## §2 Scope boundaries

**IN — files this plan creates:**

| File | Purpose |
|---|---|
| `config/server.json` | port, limits, paths (literal in §3.1) |
| `config/architecture-proofs.json` | which proof-log lines may prove which edge (literal in §5.9) |
| `src/server/config.ts` | `loadServerConfig` |
| `src/server/logger.ts` | `createLogger`, `redact`, `requestLogger` |
| `src/server/proof.ts` | `createProofLog` (the runtime evidence file) |
| `src/server/events.ts` | `createEventHub` |
| `src/server/sessions.ts` | `createSessionRegistry` (per-session Ring port, token store, degrade-to-bundle) |
| `src/server/agent-service.ts` | `createAgentService` (rung state, per-run transports, step-down) |
| `src/server/bedrock-lazy.ts` | `createLazyBedrockTransport` (model discovery and client set-up deferred to the first call) |
| `src/server/simulate.ts` | `buildSimulatedWebhook` |
| `src/server/deps.ts` | `buildServerDeps` (the composition root) |
| `src/server/app.ts` | `createApp` (all routes) |
| `src/server/start.ts`, `src/server/index.ts` | `startServer`, the entry point |
| `src/server/http-ring-port.ts` | `createHttpRingPort` (browser-safe) |
| `src/server/http-agent-transport.ts` | `createHttpAgentTransport` (browser-safe) |
| `architecture.json` | the skeleton (six to twelve nodes, no proofs yet) |
| `scripts/harvest-architecture-proofs.ts` | reads `logs/proof.log`, writes proofs into `architecture.json` |
| `scripts/verify/at-kit.ts`, `scripts/verify/at-01-app.ts` … `at-08-integration.ts` | the verification scripts |

**Also modified:** `package.json` (scripts `server`, `server:dev`; dependencies `express` 5.2.1; devDependency `@types/express` matching), `.gitignore` (`logs/*` except `logs/proof.log`).

**OUT — owned elsewhere (do not write here):**
- Ring wire logic, signature, OAuth, REST client, `LiveRingPort`, linking primitives, mock Ring server — DP-RING-INTEGRATION.
- Prompts, role runners, the 20 actions, orchestrator, transports `createInProcessTransport` / `createGoldenTransport` / `createManualTransport`, cost client — DP-AGENT-WORKFLOW.
- `RingPort`, the bundle port, the session — DP-DOMAIN-ENGINE.
- Every page and component, the proxy line in `vite.config.ts` — DP-UI.
- The container image and `PUBLIC_URL` — DP-DEPLOY.
- The final proof harvest from a real run — DP-E2E-BROWSER-TESTING WU-11 (this plan ships the script and proves it on a fixture log).

## §3 Interfaces owned (literal skeletons)

### §3.1 `config/server.json`

```json
{
  "port": 8080,
  "bodyLimitKb": 256,
  "webhookAckBudgetMs": 4000,
  "sessionTtlMin": 120,
  "sessionMax": 200,
  "eventsKeep": 500,
  "staticDir": "dist",
  "proofLog": "logs/proof.log",
  "stepTimeoutMs": 90000,
  "runMax": 50,
  "ringDegradeAfter": 2
}
```

### §3.2 `src/server/config.ts`

```ts
// Requirement IDs: FR-24
export interface ServerConfig {
  port: number; bodyLimitKb: number; webhookAckBudgetMs: number; sessionTtlMin: number; sessionMax: number;
  eventsKeep: number; staticDir: string; proofLog: string; stepTimeoutMs: number; runMax: number; ringDegradeAfter: number;
}
/** Reads config/server.json (or opts.path); the PORT environment variable, when it is an integer 0..65535, overrides `port`.
 *  A missing file or a bad value falls back to the literal defaults of §3.1. Never throws. */
export function loadServerConfig(opts?: { path?: string; env?: Record<string, string | undefined> }): ServerConfig;
```

### §3.3 `src/server/logger.ts` and `src/server/proof.ts`

```ts
// Requirement IDs: NFR-01, FR-24
import type { RequestHandler } from "express";
export interface Logger { info(msg: string, fields?: Record<string, unknown>): void; warn(msg: string, fields?: Record<string, unknown>): void; error(msg: string, fields?: Record<string, unknown>): void }
/** Replaces every occurrence of each non-empty secret, every `Bearer <token>` and every `sha256=<16+ hex>` with "[redacted]". */
export function redact(text: string, secrets?: (string | undefined)[]): string;
/** One JSON object per line: { t: ISO time, level, msg, ...fields }. `secrets` is read on every call (the environment can change). */
export function createLogger(opts?: { write?: (line: string) => void; secrets?: () => (string | undefined)[]; now?: () => number }): Logger;
/** Logs `{ method, path, status, ms }` after the response finishes. Path is `req.path` (no query string). Never logs headers or bodies. */
export function requestLogger(log: Logger, now?: () => number): RequestHandler;

export type ProofMode = "live" | "bundle" | "simulated" | "mock" | "bedrock" | "vertex" | "golden" | "manual" | "sidecar" | "server";
/** Appends one line `<ISO time> proof edge=<edge> mode=<mode> <text>` to the proof file (directories created). `text` is flattened to one line,
 *  redacted, and cut to 120 characters. Never throws (a write error is swallowed after one console warning). */
export interface ProofLog { (edge: string, mode: ProofMode, text: string): void; readonly path: string; lineCount(): number }
export function createProofLog(opts?: { path?: string; now?: () => number; secrets?: () => (string | undefined)[] }): ProofLog;
```

### §3.4 `src/server/events.ts`

```ts
// Requirement IDs: FR-09, FR-21
import type { IncomingMessage, ServerResponse } from "node:http";
import type { EventEnvelope, EnvelopeStatus } from "src/platform/transport";
export interface EventHub {
  /** Never throws: a bad step id or a validation failure is logged and swallowed (returns false). Step ids are kebab-case. */
  publish(stepId: string, status: EnvelopeStatus, payload?: Record<string, unknown>, opts?: { degraded?: boolean }): Promise<boolean>;
  /** Attaches one SSE response (platform asSseStream) and writes a `: keepalive` comment every 15 s until it closes. */
  stream(req: IncomingMessage, res: ServerResponse): void;
  /** The newest `eventsKeep` envelopes of this process, oldest first, and whether any is degraded. */
  snapshot(): { events: EventEnvelope[]; degraded: boolean };
  connections(): number;
  close(): Promise<void>;
}
export function createEventHub(opts?: { keep?: number; keepaliveMs?: number }): EventHub;
```
Step ids used by this plan (all kebab-case): `ring-webhook`, `ring-mode`, `agent-role`, `agent-step`, `agent-rung`, `cost-warning`, `system-degraded`. Their payloads are fixed in §5.2.

### §3.5 `src/server/sessions.ts`

```ts
// Requirement IDs: FR-10, FR-21, NFR-01
import type { RingPort } from "src/domain/ring-port.js";
import type { RingError } from "src/domain/ring-port.js";
import type { RingHttp } from "src/ring/client.js";
import type { Inbox } from "src/ring/inbox.js";
import type { TokenSource } from "src/ring/oauth.js";
export type RingMode = "live" | "bundle";
export interface SessionRegistryDeps {
  env: Record<string, string | undefined>; inbox: Inbox;
  ttlMs: number; max: number; degradeAfter: number; now?: () => number;
  fetch?: typeof fetch; ringBaseUrl?: string; oauthUrl?: string;       // the mock Ring server in tests
  onRingDegraded?: (sessionId: string, reason: string) => void;       // the app publishes the system-degraded envelope here
  makeBundlePort?: () => RingPort;                                     // default createBundleRingPort()
}
export interface SessionRegistry {
  portFor(sessionId: string): RingPort;                                // creates lazily; refreshes the session's last-seen time
  httpFor(sessionId: string): RingHttp | null;                        // null when the session is on the bundle
  ringMode(sessionId?: string): RingMode;
  setToken(sessionId: string, token: string, ttlSec?: number): { expiresInSec: number | null };
  forgetToken(sessionId: string): void;
  tokenStatus(sessionId?: string): { source: TokenSource; expiresInSec: number | null };
  noteRingResult(sessionId: string, err: RingError | null): boolean;  // true when this call degraded the session to the bundle
  hasEnvCredentials(): boolean;
  count(): number; sweep(): number;                                    // sweep returns how many sessions it dropped
}
export function createSessionRegistry(deps: SessionRegistryDeps): SessionRegistry;
export const SESSION_ID_PATTERN: RegExp;                               // /^[A-Za-z0-9_-]{8,64}$/
```

### §3.6 `src/server/agent-service.ts`

```ts
// Requirement IDs: FR-18, FR-21, NFR-14
import type { StepFn } from "src/kits/agent-workflow/src/adapters/inApp.js";
import type { AgentTransport } from "src/agent/transport.js";
import type { RoleName, RoleInput } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome, TransportKind } from "src/llm/roles.js";
import type { CostClient } from "src/llm/cost.js";
import type { EventHub } from "src/server/events.js";
export type Rung = "bedrock" | "golden" | "manual";
export interface RungState { kind: TransportKind; label: string; model: string; rung: Rung }
export interface AgentServiceDeps {
  env: Record<string, string | undefined>; hub: EventHub; cost: CostClient;
  makeBedrock: () => (AgentTransport & { onRungChange(fn: (kind: TransportKind, label: string) => void): void }) | null;  // null = Bedrock is not configured
  makeGolden: () => (AgentTransport & { remaining(): number; drift(): number }) | null;                                    // null = the cache is empty
  makeManual: () => AgentTransport;
  runMax: number; now?: () => number;
}
export interface AgentService {
  state(): RungState;                                                                 // what /api/status and the UI chip show
  role<R extends RoleName>(runId: string, role: R, input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R> & { rungChanged: boolean; label: string }>;
  step(runId: string, body: Parameters<StepFn>[0]): Promise<Awaited<ReturnType<StepFn>> & { rungChanged?: boolean; kind: TransportKind; label: string }>;
  descend(reason: string): RungState;                                                 // one rung down (bedrock → golden → manual), publishes agent-rung + system-degraded
  usedPct(): number;
}
export function createAgentService(deps: AgentServiceDeps): AgentService;
```

### §3.6b `src/server/bedrock-lazy.ts`

```ts
// Requirement IDs: FR-18, FR-21
import type { AgentTransport } from "src/agent/transport.js";
import type { TransportKind } from "src/llm/roles.js";
export type BuiltBedrockTransport = AgentTransport & { onRungChange(fn: (kind: TransportKind, label: string) => void): void };
/** Before the first call: kind "bedrock", label "Amazon Bedrock", model() "". The first role/step call awaits `build()` once (concurrent calls share the promise),
 *  then delegates; kind, label and model() mirror the built transport from then on and onRungChange listeners registered earlier are attached to it.
 *  A rejected build makes role() return { ok:false, degraded:{ degraded:true, reason:"The model could not be set up: <message>", fallback_source:"none", original_error:<message>, data:null }, kind:"bedrock" }
 *  and step() return { ok:false, status:502, message:"The model could not be set up." }; the next call tries build() again. */
export function createLazyBedrockTransport(opts: { build: () => Promise<BuiltBedrockTransport> }): BuiltBedrockTransport & { ready(): boolean };
```

### §3.7 `src/server/simulate.ts`

```ts
// Requirement IDs: FR-11
export interface SimulateRequest { type: string; deviceId: string; subType?: string; componentId?: number; sessionId?: string }
/** A webhook payload shaped like WIRE_SAMPLES.webhookMotion / webhookButton / webhookOffline (by `type`), with
 *  `simulated: true`, `meta.request_id = "sim-<nowMs>-<counter>"`, event id `evt-sim-<counter>`, and `timestamp`/`meta.time` = now. */
export function buildSimulatedWebhook(req: SimulateRequest, nowMs: number, counter: number): Record<string, unknown>;
export const SIMULATE_TYPES: readonly ["motion_detected", "button_press", "device_online", "device_offline"];
```

### §3.8 `src/server/deps.ts`, `src/server/app.ts`, `src/server/start.ts`

```ts
// src/server/deps.ts — Requirement IDs: FR-24
export interface ServerDeps {
  config: import("src/server/config.js").ServerConfig;
  env: Record<string, string | undefined>;
  log: import("src/server/logger.js").Logger; proof: import("src/server/proof.js").ProofLog;
  hub: import("src/server/events.js").EventHub;
  inbox: import("src/ring/inbox.js").Inbox; seen: import("src/ring/inbox.js").SeenStore;
  sessions: import("src/server/sessions.js").SessionRegistry;
  agent: import("src/server/agent-service.js").AgentService;
  cost: import("src/llm/cost.js").CostClient;
  now: () => number; startedAtMs: number; buildMarker: string;
}
export interface BuildDepsOptions { env?: Record<string, string | undefined>; config?: Partial<import("src/server/config.js").ServerConfig>; overrides?: Partial<ServerDeps>; ringBaseUrl?: string; oauthUrl?: string; fetch?: typeof fetch; goldenDir?: string }
/** The composition root. Reads nothing at import time. Overrides replace any member (tests pass stub agents and a mock Ring URL). */
export function buildServerDeps(opts?: BuildDepsOptions): ServerDeps;

// src/server/app.ts — Requirement IDs: FR-01…FR-24
import type { Express } from "express";
export function createApp(deps: ServerDeps): Express;

// src/server/start.ts
export interface RunningServer { url: string; port: number; app: Express; deps: ServerDeps; close(): Promise<void> }
export function startServer(opts?: BuildDepsOptions & { port?: number }): Promise<RunningServer>;   // port 0 = ephemeral; binds 0.0.0.0
```

### §3.9 `src/server/http-ring-port.ts` and `src/server/http-agent-transport.ts` (browser-safe: no `node:` import, only `import type` from chassis modules)

```ts
// Requirement IDs: FR-01, FR-10
import type { RingPort } from "src/domain/ring-port.js";
export interface HttpRingPortOptions { baseUrl?: string /* default "" (same origin) */; sessionId: string; fetch?: typeof fetch }
export type HttpRingPort = RingPort & {
  readonly mode: "http";
  remoteMode(): Promise<"live" | "bundle">;                                   // GET /api/status?sessionId=…
  setToken(token: string): Promise<{ expiresInSec: number | null }>;         // POST /api/ring/token
  forgetToken(): Promise<void>;                                                // DELETE /api/ring/token
};
export function createHttpRingPort(opts: HttpRingPortOptions): HttpRingPort;

// Requirement IDs: FR-18, FR-21
import type { AgentTransport } from "src/agent/transport.js";
import type { TransportKind } from "src/llm/roles.js";
export interface HttpAgentTransportOptions { baseUrl?: string; runId?: string /* default a random 16-char id */; fetch?: typeof fetch }
export type HttpAgentTransport = AgentTransport & {
  readonly runId: string;
  refreshStatus(): Promise<{ kind: TransportKind; label: string; model: string }>;   // GET /api/status; call before a run
  onRungChange(fn: (kind: TransportKind, label: string) => void): void;
};
export function createHttpAgentTransport(opts?: HttpAgentTransportOptions): HttpAgentTransport;
```

### §3.10 `scripts/harvest-architecture-proofs.ts` and the verification kit

```ts
// scripts/harvest-architecture-proofs.ts — CLI
//   npx vite-node scripts/harvest-architecture-proofs.ts [--dir <project dir>] [--log <proof log>] [--accept-any] [--sync] [--require-sponsor]
// prints one line per edge: `proof <edge-id>: <log file>:<line> mode=<mode>`  or  `missing <edge-id>: no line from a <accepted modes> run`
// final line: `harvest: <n> proofs, <m> missing`.  Exit 1 when --require-sponsor and no sponsor edge has a proof.
export function harvest(opts: { dir: string; logPath: string; acceptAny?: boolean }): { proofs: Record<string, { file: string; line: number; text: string; mode: string }>; missing: string[] };

// scripts/verify/at-kit.ts — shared by the eight scripts
export function createChecker(name: string): { ok(cond: unknown, label: string): void; eq(actual: unknown, expected: unknown, label: string): void; done(): never };  // done() prints `<name>: <n> checks OK` and exits 0; a failed check prints `FAIL <label>` and exits 1 at done()
export function startTestServer(opts?: Parameters<typeof import("src/server/start.js").startServer>[0]): Promise<import("src/server/start.js").RunningServer>;
export function api(base: string, method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; json: any; headers: Headers }>;
```

## §4 Interfaces consumed (copy verbatim)

```ts
import express from "express";
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createPublisher } from "src/platform/transport";
import type { EventEnvelope, EnvelopeStatus } from "src/platform/transport";
import { createGoldenCache, isDegradedResult } from "src/resilience";
import type { DegradedResult } from "src/resilience";
import type { RingPort, RingDevice, RingStatus, RingCapabilities, RingLocation, RingConfigurations, RingHistoryPage, RingWebhookPayload, RingWhepSession, RingSnapshot, RingClip, RingChimeResult } from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { createInbox, createSeenStore } from "src/ring/inbox.js";
import type { Inbox, SeenStore } from "src/ring/inbox.js";
import { createWebhookHandler } from "src/ring/webhook.js";
import { signPayload } from "src/ring/signature.js";
import { createTokenProvider } from "src/ring/oauth.js";
import type { TokenProvider, TokenSource } from "src/ring/oauth.js";
import { createRingHttp } from "src/ring/client.js";
import type { RingHttp } from "src/ring/client.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import { makeNonce, nonceTime, confirmLink, completeLink, getUserMe } from "src/ring/linking.js";
import { WIRE_SAMPLES, RING_API_BASE, RING_OAUTH_URL } from "src/ring/wire.js";
import { createRoleRunners } from "src/llm/roles.js";
import type { RoleCtx, RoleOutcome, TransportKind } from "src/llm/roles.js";
import { createBedrockClient } from "src/llm/bedrock-client.js";
import { discoverModels } from "src/llm/model-discovery.js";
import { createStrandsAdapter } from "src/llm/strands-adapter.js";
import { createVertexFallback } from "src/llm/vertex-fallback.js";
import { createCostClient } from "src/llm/cost.js";
import type { CostClient } from "src/llm/cost.js";
import { createInProcessTransport, createGoldenTransport, createManualTransport } from "src/agent/transport.js";
import type { AgentTransport } from "src/agent/transport.js";
import { ROLE_SCHEMAS } from "src/agent/schemas.js";
import type { RoleName, RoleInput } from "src/agent/schemas.js";
import { runWeekReview } from "src/agent/orchestrator.js";
import { createAppSession } from "src/agent/app-session.js";
import type { StepFn } from "src/kits/agent-workflow/src/adapters/inApp.js";
import type { StepBody } from "src/kits/agent-workflow/src/server/stepHandler.js";
import { createMockRingServer } from "../mock-ring-server.js";        // only from scripts/verify/at-*.ts
import { runRingPortContract } from "./ring-port-contract.js";        // only from scripts/verify/at-*.ts
```
From Node: `node:http`, `node:fs`, `node:path`, `node:crypto`, `node:child_process`. From npm: `express` 5.2.1 (pinned in WU-01).

## §5 Algorithms and literal configuration

### §5.1 Configuration, logging, proof log
1. `loadServerConfig`: read the JSON file, merge over the literal defaults of §3.1 key by key (a value of the wrong type is ignored), then apply `PORT`.
2. `redact(text, secrets)`: for each secret with length ≥ 4 replace all occurrences (split/join) by `[redacted]`; then apply `/Bearer\s+[A-Za-z0-9._~+\/=-]+/g` → `Bearer [redacted]` and `/sha256=[0-9a-fA-F]{16,}/g` → `sha256=[redacted]`.
3. `createLogger` writes `JSON.stringify({ t, level, msg: redact(msg), ...fieldsRedacted })` where string field values are redacted and non-string values are JSON-stringified, redacted and parsed back. Default `write` is `process.stdout.write(line + "\n")`. The secrets thunk used by `buildServerDeps` returns the values of `RING_ACCESS_TOKEN`, `RING_REFRESH_TOKEN`, `RING_CLIENT_SECRET`, `RING_HMAC_KEY`, `RING_WEBHOOK_SECRET`, `AWS_BEARER_TOKEN_BEDROCK` read from the environment on each call.
4. `requestLogger`: record `start = now()`; on `res.on("finish")` log `info("request", { method, path: req.path, status: res.statusCode, ms })`.
5. `createProofLog`: path default `config.proofLog`; the line is `${new Date(now()).toISOString()} proof edge=${edge} mode=${mode} ${flat}` where `flat = redact(text).replace(/\s+/g, " ").trim().slice(0, 120)`. `lineCount()` counts the lines currently in the file (0 when absent).

### §5.2 Event hub and the envelopes
1. `createEventHub({ keep = 500, keepaliveMs = 15000 })` creates one publisher with `createPublisher("sse")` and one process trace id (`randomUUID()`); every `publish` passes that `traceId`.
2. `publish(stepId, status, payload = {}, { degraded } = {})`: `stepId` not matching `/^[a-z0-9]+(-[a-z0-9]+)*$/` → `false`. `try { await pub.publish({ stepId, status, payload, traceId, ...(degraded ? { degraded: true } : {}) }); return true } catch { return false }`.
3. `snapshot()`: `s = pub.collect(traceId)`; `events = (s?.events ?? []).slice(-keep)`; `degraded = events.some(e => e.degraded === true)`.
4. `stream(req, res)`: `res.setHeader("X-Accel-Buffering", "no")` first, then `pub.asSseStream(req, res)`; start `setInterval(() => res.write(": keepalive\n\n"), keepaliveMs)` (call `.unref()`); clear it on `res.on("close")`. A write after the socket closed is caught.
5. Envelope payloads (fixed; the UI reads these keys):

| step id | status | payload keys | `degraded` |
|---|---|---|---|
| `ring-webhook` | `done` | `requestId, type, deviceId, tsMs, simulated` | no |
| `ring-mode` | `done` | `mode` (`live` or `bundle`), `sessionId` | no |
| `agent-role` | `done` or `error` | `role, kind, model, totalTokens, latencyMs, round` | no |
| `agent-step` | `done` or `error` | `n, kind, model, calls (names), latencyMs` | no |
| `agent-rung` | `done` | `kind, label, model` | no |
| `cost-warning` | `done` | `usedPct, warning` | no |
| `system-degraded` | `done` | `layer` (`agent` or `ring`), `kind`, `label`, `reason` | **yes** |

### §5.3 Session registry (`createSessionRegistry`)
State per session id: `{ lastSeenMs, tokens?: TokenProvider, live?: LiveRingPort, http?: RingHttp, bundle?: RingPort, failures: number, degraded: boolean }` in a `Map`, insertion ordered.
1. `hasEnvCredentials()`: `!!env.RING_ACCESS_TOKEN || (!!env.RING_REFRESH_TOKEN && !!env.RING_CLIENT_ID && !!env.RING_CLIENT_SECRET)`.
2. `ringMode(sessionId?)` is `"live"` when the session exists, is not `degraded`, and (has a session token, or `hasEnvCredentials() && env.RING_MODE !== "bundle"`); with no session id: `hasEnvCredentials() && env.RING_MODE !== "bundle" ? "live" : "bundle"`. Otherwise `"bundle"`.
3. `portFor(id)`: create the session on first use (when `count() >= max`, drop the least recently seen first). Live → build once: `tokens = createTokenProvider({ env, fetch, oauthUrl })` (the session's token wins; the provider falls back to the environment by itself), `http = createRingHttp({ baseUrl: ringBaseUrl, tokens, fetch })`, `live = createLiveRingPort({ http, inbox, sessionId: "default" })`. Bundle → `makeBundlePort()` once per session (independent state per visitor).
4. `setToken(id, token, ttlSec)`: create the session if needed, create its `TokenProvider` if absent, call `setPlaygroundToken(token, ttlSec)`, clear `degraded` and `failures`, drop a cached bundle port, return `{ expiresInSec: tokens.status().expiresInSec }`. An empty token → `RingError(400, "bad_request", "Paste a token first.")`. The token value is never stored anywhere but the provider and never returned.
5. `forgetToken(id)`: `tokens.forget()`; the next `ringMode` is recomputed.
6. `noteRingResult(id, err)`: `err === null` → `failures = 0`, return `false`. Otherwise `failures += 1`; degrade when `err.code === "unauthorized"` **or** (`err.status === 0 || err.status >= 500`) and `failures >= degradeAfter`; degrading sets `degraded = true`, calls `onRingDegraded(id, reason)` with reason `"Ring is not answering."` (network or 5xx) or `"The Ring token is missing or expired."` (401), and returns `true`. `404`, `400`, `429` never degrade.
7. `sweep()`: drop sessions idle longer than `ttlMs`; return the count.

### §5.4 Agent service (`createAgentService`)
1. **Start rung.** `available = { bedrock: makeBedrock() !== null, golden: makeGolden() !== null, manual: true }` evaluated lazily once. Wanted rung: `env.AGENT_PROVIDER` when it is `bedrock | golden | manual` **and available**; otherwise the first available of `bedrock, golden, manual`.
2. **Per-run transports.** `runs: Map<string, AgentTransport>` (oldest dropped past `runMax`). `transportFor(runId)`: `bedrock` → one shared in-process transport (created once; its `onRungChange` publishes `agent-rung` and a `system-degraded` envelope with `layer: "agent"`, `kind`, `label`, reason `"The model is answering through the labelled fallback."` when `kind === "vertex-fallback"`); `golden` → a **fresh** `makeGolden()` per run id (its replay cursor is per run); `manual` → one shared transport.
3. **`state()`** = `{ kind: transport.kind, label: transport.label, model: transport.model(), rung }` of the shared transport for the current rung (golden and manual: `kind` equals the rung name).
4. **`role(runId, role, input, ctx)`**:
   a. If `cost.summary().degraded` and `rung === "bedrock"` → `descend("The model budget is used up.")` first.
   b. `out = await transportFor(runId).role(role, input, ctx)`.
   c. `out.ok === false` and `rung !== "manual"` → `descend(out.degraded.reason ?? "The model is not reachable.")` and return `{ ...out, kind: state().kind, label: state().label, rungChanged: true }` (`kind` and `label` always describe the rung **after** any step-down). A `manual` rung never descends.
   d. Success → publish `agent-role` `done` and call `proof(...)` (§5.7); return `{ ...out, rungChanged: false, label }`.
   e. After every call compare `cost.summary().warning` with the last published value; when it changed to `warning` or `critical`, publish `cost-warning`.
5. **`step(runId, body)`**: same shape with `transportFor(runId).step(body)` under an `AbortController` timeout of `stepTimeoutMs`. A kit failure with `status >= 502` on a non-manual rung descends (`rungChanged: true`); `400` never descends. A timeout answers `{ ok:false, status:504, message:"The model took too long." }` and descends. Success publishes `agent-step`. The `step` route answers in the kit's own shape (not the §5.5 error shape), because `StepFn` consumers parse that shape.
6. **`descend(reason)`**: `bedrock → golden` (when available, else `manual`), `golden → manual`; `manual` stays. Publishes `agent-rung` and `system-degraded` (`layer: "agent"`, `kind: "golden"` or `"manual"`, labels `"Recorded run"` and `"Manual"`, the reason). Runs already started keep their transport object; **new run ids** get the new rung. The orchestrator stops at the failed phase (`stoppedAt`), the UI shows the banner, and a second press of "Review the week" starts a new run id on the new rung.

### §5.5 Routes (`createApp`) — middleware order, then the table
Order: `requestLogger` → `X-Content-Type-Options: nosniff` on every response → the webhook route with `express.raw({ type: "*/*", limit: bodyLimitKb + "kb" })` → `express.json({ limit })` → proof middleware for `/api/*` (§5.7) → the API routes → static files → the SPA fallback → the error handler.

| Route | Behaviour (all JSON bodies; errors use the one shape below) |
|---|---|
| `GET /health` | `{ ok: true, build: deps.buildMarker, mode: sessions.ringMode(), provider: agent.state().kind, uptimeSec }` (`uptimeSec` = integer seconds since `startedAtMs`). |
| `GET /events` | `{ events, degraded }` from `hub.snapshot()`; header `Cache-Control: no-store`. |
| `GET /events/stream` | `hub.stream(req, res)`. |
| `POST /webhooks/ring` | body is a `Buffer` (raw); `handler({ rawBody, headers })`; respond `status` with the handler body, `Content-Type: application/json`. Handler built once with `secret: () => env.RING_WEBHOOK_SECRET`, the shared `inbox` and `seen`, and `publish` = hub publish `ring-webhook` + proof line. A body over the limit → `413` `{"ok":false,"error":"too large"}`. |
| `POST /api/ring/token` | `{ sessionId, token }` → `sessions.setToken` → `{ ok: true, expiresInSec }`; publishes `ring-mode`. `DELETE /api/ring/token` with `{ sessionId }` → `forgetToken` → `{ ok: true }`; publishes `ring-mode`. |
| `POST /api/ring/linking/nonce` | live sessions only (§5.6); `RING_HMAC_KEY` unset → `503 not_configured`; `accountId = body.accountId ?? (await getUserMe({ http })).accountId`; `{ ok: true, nonce: makeNonce(key, accountId, now()), time: nonceTime(now()), accountId: maskIdentifier(accountId) }` (masked per §5.6 item 4); records the per-session link `{ nonce, time, accountId }`. |
| `POST /api/ring/linking/confirm` | `{ sessionId, accountIdentifier, nonce }` → the nonce must equal the session's recorded link and verify, else `409 conflict`; `confirmLink({ http }, { accountIdentifier: <recorded id>, nonce })` → `{ ok: true, ...result }` (masked). |
| `POST /api/ring/linking/complete` | `{ sessionId }` → the link must be confirmed and not yet completed, else `409 conflict`; `completeLink({ http })` → `{ ok: true, ...result }`, marks the link completed (one-time). |
| `POST /api/ring/:op` | `op` in the allow-list of §5.6, `{ sessionId, args }`; calls the port; `{ ok: true, data }`. |
| `POST /api/agent/step` | header `x-run-id` (default `"default"`); body = `StepBody`; `agent.step` → the kit shape unchanged plus `kind`, `label`, `rungChanged`; HTTP status 200 on `ok: true`, else the kit `status`. |
| `POST /api/agent/role/:role` | `role` in `extractor, planner, narrator` (else `404 unknown_role`); body `{ input, round, key? }`, header `x-run-id`; success `{ ok: true, output, model, tokens, usage, latencyMs, kind, label, rungChanged: false }`; failure `{ ok: false, degraded, kind, label, rungChanged }` with HTTP 200 (a degraded model is an answer, not a server fault). |
| `GET /api/status` | optional `?sessionId=`; `{ ring: { mode, tokenExpiresInSec? }, agent: { kind, label, model }, cost: { usedPct }, inbox: { default: inbox.size("default") }, build }`. |
| `POST /api/dev/simulate-webhook` | §5.8. |

**Error shape (every non-2xx JSON response):** `{ ok: false, error: { status, code, message, retryAfterSec? } }`. Codes: `bad_request`, `bad_session`, `unknown_op`, `unknown_role`, `unauthorized`, `rate_limited`, `not_found`, `not_live`, `not_configured`, `disabled`, `upstream`, `server_error`. A thrown non-Ring error in a handler returns `500 server_error` with the message `Something went wrong on the server.` (no stack, no cause).

**Static and fallback:** `express.static(staticDir, { index: false, maxAge: "1h" })` for files under the built UI; then `GET /{*splat}` for any path that does not begin with `/api`, `/events`, `/webhooks` or `/health`: when `staticDir/index.html` exists send it (`Cache-Control: no-cache`), otherwise `503` with the text `The interface has not been built. Run: npm run build`. An unknown `/api/*` path → `404 not_found` JSON.

### §5.6 Ring routes in detail
1. **Session id.** `sessionId` must match `SESSION_ID_PATTERN`; else `400 bad_session`.
2. **Allow-list and argument table.** Anything else → `404 unknown_op`.

| op | `args` | port call | `data` |
|---|---|---|---|
| `listDevices` | `{}` | `listDevices()` | `RingDevice[]` |
| `getStatus` | `{ deviceId }` | `getStatus(deviceId)` | `RingStatus` |
| `getCapabilities` | `{ deviceId, componentId? }` | `getCapabilities(deviceId, componentId)` | `RingCapabilities` |
| `getLocation` | `{ deviceId }` | `getLocation(deviceId)` | `RingLocation` |
| `getConfigurations` | `{ deviceId }` | `getConfigurations(deviceId)` | `RingConfigurations` |
| `getEventHistory` | `{ deviceId, limit, offset, type? }` | `getEventHistory(deviceId, { limit, offset, type })` | `RingHistoryPage` |
| `drainWebhookInbox` | `{}` | `drainWebhookInbox()`; **when the port mode is `bundle`**, the result is concatenated with `inbox.drain(sessionId)` (simulated deliveries) | `RingWebhookPayload[]` |
| `startWhep` | `{ deviceId, sdpOffer, componentId? }` | `startWhep(deviceId, sdpOffer, componentId)` | `RingWhepSession` |
| `stopWhep` | `{ deviceId, whepSessionId }` | `stopWhep(deviceId, whepSessionId)` | `null` |
| `getSnapshot` | `{ deviceId, componentId? }` | `getSnapshot(deviceId, componentId)` | `RingSnapshot` |
| `getClip` | `{ deviceId, startMs, endMs, componentId? }` | `getClip(deviceId, { startMs, endMs, componentId })` | `RingClip` |
| `playChime` | `{ deviceId, audioRef }` | `playChime(deviceId, audioRef)` | `RingChimeResult` |

A missing or wrongly typed required argument → `400 bad_request` with `message: "<op>: <name> is required."`. `limit` and `offset` must be integers 0..1000; `startMs`/`endMs` finite numbers.
3. **Failure mapping.** A caught `RingError e` → HTTP `e.status` when it is 400–599, otherwise `502`; body `{ ok:false, error:{ status: e.status, code: e.code, message: e.message, retryAfterSec: e.retryAfterSec } }`. Any other error → wrapped as `RingError(0, "upstream", "Ring did not answer.")`. When the port mode is `live`, call `sessions.noteRingResult(sessionId, err)` on every outcome (`null` on success); when it returns `true`, publish `system-degraded` `{ layer: "ring", kind: "bundle", label: "Recorded week (not live Ring)", reason }` and `ring-mode` `{ mode: "bundle", sessionId }`. The failing call still returns its own error; the next call uses the bundle.
4. **Linking** requires `sessions.httpFor(sessionId) !== null`, else `409 not_live` with message `Connect a Ring token first.`. The linking routes are for the staging user only; the response never contains the raw account identifier (the `nonce` route masks it with `maskIdentifier`, `confirmLink` already masks it). Each session holds one link attempt (`nonce`, `time`, `accountId`, confirmed, completed): `confirm` needs the recorded nonce (else `409 conflict`), `complete` needs a confirmed, not-yet-completed link (else `409 conflict`).

### §5.7 Proof lines (the runtime evidence the architecture diagram quotes)
Each edge id below is an `architecture.json` edge (§5.9). `proof(edge, mode, text)` is called exactly here:

| Edge | Where | mode | text |
|---|---|---|---|
| `ui-api` | proof middleware, after the response of any `/api/*` request except `GET /api/status` | `server` | `<METHOD> <path> <status> <ms>ms` |
| `api-ring` | after a successful Ring op | the port mode (`live` or `bundle`) | `<op> ok <ms>ms` |
| `api-inbox` | the webhook `publish` hook | `simulated` when `simulated`, else `live` | `webhook <type> accepted <requestId>` |
| `api-bedrock` | successful role or step on a transport whose `kind` is `bedrock` or `vertex-fallback` | `bedrock` or `vertex` | `<role or "step"> <model> <latencyMs>ms <totalTokens> tokens` |
| `api-cache` | successful role or step on a `golden` transport | `golden` | `replayed <role or "step"> from the recorded run` |
| `api-cost` | after every agent call | `sidecar` | `used <usedPct>% of the token budget (<totalTokens> tokens)` |

### §5.8 Simulated webhooks
`POST /api/dev/simulate-webhook` with `{ type, deviceId, subType?, componentId?, sessionId? }`:
1. Disabled when `env.NODE_ENV === "production"` and `env.ALLOW_SIMULATE !== "1"` → `404` `disabled`, message `Simulated deliveries are off on this server.`.
2. `type` must be one of `SIMULATE_TYPES`, `deviceId` a non-empty string ≤ 80 characters; else `400 bad_request`.
3. `secret = env.RING_WEBHOOK_SECRET`; empty → `503 not_configured` with message `The webhook secret is not set.`.
4. `payload = buildSimulatedWebhook(body, now(), counter++)`; `raw = Buffer.from(JSON.stringify(payload))`; `signature = signPayload(raw, secret)`; call the **same handler** the real route uses with `{ rawBody: raw, headers: { "x-signature": signature } }`; `status !== 200` → `502 upstream`. The inbox queue for a simulated delivery is `body.sessionId ?? "default"`: because the handler pushes to its own `sessionId` (default `"default"`), the route builds a second handler instance for the requested session when `sessionId` differs (sharing `seen`).
5. Respond `{ ok: true, requestId: payload.meta.request_id }`. The payload carries `"simulated": true`, so the UI labels it `SIMULATED`.

### §5.9 `architecture.json` and the proof harvest
**Skeleton (literal; written in WU-07, at the entry root):**
```json
{
  "version": "1.0.0",
  "lanes": ["client", "service", "data", "model"],
  "nodes": [
    { "id": "ui", "lane": "client", "label": "Family view", "icon": "window" },
    { "id": "engine", "lane": "client", "label": "Truth engine", "icon": "shield", "note": "Runs in the browser" },
    { "id": "api", "lane": "service", "label": "Run server", "icon": "server" },
    { "id": "ring", "lane": "data", "label": "Ring API", "icon": "store", "sponsor": true },
    { "id": "inbox", "lane": "data", "label": "Webhook inbox", "icon": "queue" },
    { "id": "cache", "lane": "data", "label": "Recorded run", "icon": "layers" },
    { "id": "bedrock", "lane": "model", "label": "Amazon Bedrock", "icon": "spark", "sponsor": true },
    { "id": "cost", "lane": "service", "label": "Cost guard", "icon": "clock" }
  ],
  "edges": [
    { "id": "ui-engine", "from": "ui", "to": "engine", "kind": "request", "label": "actions" },
    { "id": "ui-api", "from": "ui", "to": "api", "kind": "request", "label": "HTTPS" },
    { "id": "api-ring", "from": "api", "to": "ring", "kind": "query", "label": "REST" },
    { "id": "api-inbox", "from": "api", "to": "inbox", "kind": "event", "label": "webhooks" },
    { "id": "api-bedrock", "from": "api", "to": "bedrock", "kind": "infer", "label": "Converse" },
    { "id": "api-cache", "from": "api", "to": "cache", "kind": "read", "label": "replay" },
    { "id": "api-cost", "from": "api", "to": "cost", "kind": "write", "label": "tokens" }
  ]
}
```
Every label is at most 22 characters; the skeleton carries **no `proof`** (it fails `lint-architecture` until a real run is harvested, which is the intended state).

**`config/architecture-proofs.json` (literal):**
```json
{
  "ui-api": { "accept": ["server"] },
  "api-ring": { "accept": ["live"] },
  "api-inbox": { "accept": ["live"] },
  "api-bedrock": { "accept": ["bedrock"] },
  "api-cache": { "accept": ["golden"] },
  "api-cost": { "accept": ["sidecar"] }
}
```
**Harvest algorithm.** `harvest({ dir, logPath, acceptAny })`: read `<dir>/architecture.json`; read the proof log as lines; for each edge id present in the config, scan the log **from the end** for the last line that contains ` proof edge=<id> mode=<m> ` with `m` in `accept` (any mode when `acceptAny`); the proof is `{ file: <path of the log relative to dir, forward slashes>, line: <1-based line number>, text: <the part of the line after "mode=<m> "> }`. Edges with no match lose any previous `proof` and are reported missing. `--accept-any` exists **only** so the mechanism can be tested on a fixture log produced by the mock Ring; its mode tag stays in the log line, so a mock line can never pass as live for a reader. Writing the result back preserves every other field and the key order of the file (2-space JSON, trailing newline). `--sync` copies `architecture.json` and the log file to `../../hackathons/hackathon-projects/2026-10-amazonDevs/` (same relative paths) when that directory exists and prints `synced`, otherwise prints `sync skipped: <dir> not found`. `--require-sponsor` exits 1 unless an edge touching a `sponsor: true` node has a proof.

### §5.10 Composition root (`buildServerDeps`) and boot
1. `env = opts.env ?? process.env`; `config = { ...loadServerConfig({ env }), ...opts.config }`; `now = opts.overrides?.now ?? Date.now`; `buildMarker = env.BUILD_MARKER ?? "dev"`.
2. `log = createLogger({ secrets })`, `proof = createProofLog({ path: config.proofLog, secrets })`, `hub = createEventHub({ keep: config.eventsKeep })`, `inbox = createInbox()`, `seen = createSeenStore()`.
3. `cost = createCostClient()` (the Python sidecar is started lazily by the cost client on first use).
4. `sessions = createSessionRegistry({ env, inbox, ttlMs: config.sessionTtlMin * 60000, max: config.sessionMax, degradeAfter: config.ringDegradeAfter, fetch, ringBaseUrl, oauthUrl, onRingDegraded: (id, reason) => { hub.publish("system-degraded", "done", { layer: "ring", kind: "bundle", label: "Recorded week (not live Ring)", reason }, { degraded: true }); hub.publish("ring-mode", "done", { mode: "bundle", sessionId: id }) } })`.
5. `goldenDir = opts.goldenDir ?? env.GOLDEN_CACHE_DIR ?? "data/golden-cache"`; `golden = createGoldenCache(goldenDir)`; `allowFallback = env.AGENT_ALLOW_FALLBACK === "1"`.
6. `agent = createAgentService({ env, hub, cost, runMax: config.runMax, makeManual: () => createManualTransport(), makeGolden: () => golden.list().length === 0 ? null : createGoldenTransport({ cache: golden }), makeBedrock })` where `makeBedrock` returns `null` unless `env.AWS_BEARER_TOKEN_BEDROCK` or `env.AWS_ACCESS_KEY_ID` is set; otherwise `createLazyBedrockTransport({ build })` and `build` does: `models = await discoverModels({ env })`; `bedrock = createBedrockClient({ modelId: models.balanced, region: models.region })`; `vertex = allowFallback ? createVertexFallback() : undefined`; `roles = createRoleRunners({ models, region: models.region, strands: createStrandsAdapter(), bedrock, vertex, allowFallback, cost, cache: golden, recordGolden: env.RECORD_GOLDEN === "1" })`; `return createInProcessTransport({ roles, bedrock, vertex, allowFallback, cost, cache: golden, recordGolden: env.RECORD_GOLDEN === "1" })`.
6b. Each member is replaced by `opts.overrides?.<member>` when given.
7. `startServer`: `deps = buildServerDeps(opts)`; `app = createApp(deps)`; `server = app.listen(opts.port ?? deps.config.port, "0.0.0.0")`; resolve after `listening`; `url = "http://127.0.0.1:<port>"`; start `setInterval(sessions.sweep, 60000).unref()`. `close()` stops the interval, `hub.close()`, `cost.close()`, then `server.close()` (calling `server.closeAllConnections()` first) and resolves when the server has closed.
8. `src/server/index.ts`: `startServer().then(s => log.info("listening", { url: s.url, build, ring: sessions.ringMode(), agent: agent.state().kind }))`; on `SIGTERM`/`SIGINT` call `close()` then `process.exit(0)`. `package.json` scripts: `"server": "vite-node src/server/index.ts"`, `"server:dev": "vite-node --watch src/server/index.ts"`, `"verify:api": "for f in 01-app 02-events 03-ring 04-webhook 05-agent 06-clients 07-architecture 08-integration; do npx vite-node scripts/verify/at-$f.ts || exit 1; done"`.

## §6 Failure modes

| Failure | What the user or judge sees | Handling |
|---|---|---|
| Ring token expires mid-session | the Ring chip turns to "Recorded week", banner `Recorded week (not live Ring)` | `noteRingResult` degrades on the first 401; `ring-mode` and `system-degraded` envelopes; pasting a new token clears it |
| Ring answers 5xx or is unreachable | same banner after two failures in a row | `degradeAfter = 2`; a success in between resets the count |
| Ring answers 429 | the call waits and retries inside the client; the route returns `429` only when retries are exhausted | `rate_limited` with `retryAfterSec`; never degrades |
| Bedrock fails | banner `Fallback model (not Bedrock)` when allowed, otherwise `Recorded run` | in-process transport and `descend`; new runs use the new rung |
| Golden cache empty and Bedrock down | the manual action runner | `manual` rung; `role` returns `manual_mode` |
| Budget used up | banner and the cost chip at 100 % | `cost.summary().degraded` triggers `descend` before the call |
| Webhook with a bad signature | `401`, nothing queued, no log of the body | handler; route only forwards |
| Webhook secret not set | `503` | handler |
| Visitor sends a huge body | `413` | body limit |
| SSE connection drops | the UI polls `GET /events` | `/events` is the same envelope list |
| Server restart | sessions and tokens are gone (by design) | the UI starts a new session id; the bundle is deterministic |
| A route throws | `500 server_error`, plain message | error middleware; the stack goes to the redacted log only |
| `dist/` missing | `503` text with the build command | SPA fallback |

## §7 Work units

Every unit adds one `mount…(app, deps)` function to `src/server/app.ts` and one call to it inside `createApp`, and replaces one `unbuilt("…")` line in `src/server/deps.ts` by the real factory (WU-01 writes those placeholders). `unbuilt(name)` returns a `Proxy` whose every property access throws `Error("<name> is added in a later unit")`, so a unit can only use what it has built or what a test injects through `overrides`. Verification scripts never read the process environment: they pass an explicit `env` object. Port `0` is always used in tests.

### WU-API-TRANSPORT-01 — dependencies, configuration, logging, proof log, the app shell, `/health`
- **Goal:** `createApp` and `startServer` exist with `/health`, the static/fallback handling, the error shape and a log that cannot leak a secret.
- **Steps:**
  1. `npm install express@5.2.1 --save-exact` and `npm install -D @types/express@^5`; add the `.gitignore` lines `logs/*` and `!logs/proof.log`; add the `server`, `server:dev` and `verify:api` scripts of §5.10 item 8.
  2. Write `config/server.json` (§3.1) and `src/server/config.ts` (§5.1 item 1).
  3. Write `src/server/logger.ts` and `src/server/proof.ts` (§3.3, §5.1 items 2–5).
  4. Write `src/server/deps.ts` with the full `ServerDeps` of §3.8 and `buildServerDeps` as §5.10 items 1–3, 6b; `hub`, `sessions` and `agent` are `overrides.<x> ?? unbuilt("<x>")` for now.
  5. Write `src/server/app.ts`: the middleware order of §5.5, `mountHealth`, `mountStatic` (static files, SPA fallback, unknown `/api/*` → `404 not_found`), the error middleware; `src/server/start.ts` and `src/server/index.ts` (§5.10 items 7–8).
  6. Write `scripts/verify/at-kit.ts` (`createChecker`, `startTestServer` with defaults `env: { NODE_ENV: "test", BUILD_MARKER: "test-1" }`, a temporary directory for `proofLog`, and a stub cost client whose `summary()` is `{ usedPct: 0, totalTokens: 0, requests: 0, warning: "none", degraded: false, text: "" }`; `api()` as §3.10) and `scripts/verify/at-01-app.ts`.
- **Files:** `package.json`, `.gitignore`, `config/server.json`, `src/server/{config,logger,proof,deps,app,start,index}.ts`, `scripts/verify/at-kit.ts`, `scripts/verify/at-01-app.ts`.
- **Checks (18):**
  1. `loadServerConfig({ env: {} })` returns `port 8080`, `eventsKeep 500`, `ringDegradeAfter 2`, `proofLog "logs/proof.log"`.
  2. `PORT=9090` gives `9090`; `PORT=abc` and `PORT=70000` give `8080`.
  3. `loadServerConfig({ path: "does-not-exist.json", env: {} })` returns the defaults and does not throw.
  4. `redact("x Bearer abc.def-1 y sha256=0123456789abcdef0123 z")` equals `x Bearer [redacted] y sha256=[redacted] z`.
  5. `redact("tok-SECRET-9 here", ["tok-SECRET-9"])` equals `[redacted] here`, and a two-character secret `"ab"` is not replaced in `"ab cd"`.
  6. A logger line is valid JSON with `t`, `level: "info"`, `msg`, and a field `{ auth: "Bearer abc123" }` appears as `Bearer [redacted]`.
  7. The secrets thunk is read on every call: after the thunk starts returning `"newsecret-77"`, the next line redacts it.
  8. `createProofLog` writes a line matching `/^\d{4}-\d\d-\d\dT[\d:.]+Z proof edge=api-ring mode=live listDevices ok 12ms$/` and `lineCount()` is `1`.
  9. A proof text with a newline and 200 characters becomes one line whose text part is at most 120 characters.
  10. A proof text containing `Bearer zzz` is written as `Bearer [redacted]`.
  11. `GET /health` is `200` with `ok: true`, `build: "test-1"`, `mode: "bundle"`, a string `provider`, and an integer `uptimeSec >= 0`.
  12. The `/health` response has the header `x-content-type-options: nosniff`.
  13. `GET /api/nothing` is `404` with `error.code === "not_found"` and `ok === false`.
  14. With a `staticDir` that has no `index.html`, `GET /watch` is `503` and the text contains `npm run build`; with a directory holding an `index.html` containing `MARK-7`, `GET /watch` is `200`, the body contains `MARK-7` and `cache-control` is `no-cache`.
  15. With `overrides.hub` replaced by an object whose `snapshot` throws, `GET /events` is `500`, `error.code === "server_error"`, `error.message === "Something went wrong on the server."` and the body does not contain `" at "`.
  16. After `GET /health?secret=abc`, the captured log line has `path: "/health"` and the line does not contain `abc`.
  17. `startServer({ port: 0 })` returns a URL with a non-zero port; after `close()` a new `fetch` to it rejects.
  18. `package.json` lists `express` at exactly `5.2.1` under `dependencies` and has the three scripts.
- **Verify:** `npx vite-node scripts/verify/at-01-app.ts`
- **Expected output:** `at-01-app: 18 checks OK`
- **Proves:** a server can start, answers its health check, never writes a secret to a log line or the proof file, and fails with one plain error shape.

### WU-API-TRANSPORT-02 — event hub, `/events`, `/events/stream`
- **Goal:** the process-wide event stream the UI banners and chips read, with a polling fallback.
- **Steps:**
  1. Read `../../hackathons/src/platform/transport/adapters/sse.ts` and `publisher.ts` and confirm the facts in §0 (frame format, `: connected`, `collect`). Where one differs, change §5.2 item 4 and the checks of this unit in the same edit and note it in `design_documents/friction-log.md` only if it was a documentation problem.
  2. Write `src/server/events.ts` (§3.4, §5.2 items 1–4).
  3. Add `mountEvents`: `GET /events` (`Cache-Control: no-store`) and `GET /events/stream`.
  4. In `deps.ts` replace `unbuilt("hub")` by `createEventHub({ keep: config.eventsKeep })`.
  5. Write `scripts/verify/at-02-events.ts`; its SSE client is `node:http` `get` collecting chunks.
- **Files:** `src/server/events.ts`, `src/server/app.ts`, `src/server/deps.ts`, `scripts/verify/at-02-events.ts`.
- **Checks (13):**
  1. `hub.publish("ring-webhook", "done", { requestId: "r1" })` resolves `true` and `snapshot().events` has one event with `step_id "ring-webhook"`, `status "done"` and `payload.requestId "r1"`.
  2. `publish("Bad_Id", "done")` resolves `false` and the snapshot is unchanged.
  3. `snapshot().degraded` is `false`, and `true` after `publish("system-degraded", "done", {}, { degraded: true })`.
  4. With `createEventHub({ keep: 3 })` and five publishes carrying `n: 0…4`, the snapshot holds the payloads `n: 2, 3, 4` in that order and their `sequence` values increase.
  5. `GET /events` is `200` with `{ events, degraded }` and the header `cache-control: no-store`.
  6. `GET /events/stream` answers `200` with `content-type` starting `text/event-stream`, the header `x-accel-buffering: no`, and its first chunk contains `: connected`.
  7. After connecting, a published `agent-rung` envelope arrives as a frame containing `event: envelope` whose `data:` JSON has `step_id "agent-rung"`, within 1 s.
  8. The frame's `id:` line equals the envelope's `sequence`.
  9. `hub.connections()` is `1` while the client is open and `0` within 1 s after the client is destroyed.
  10. A hub built with `keepaliveMs: 50` delivers a chunk containing `: keepalive` within 500 ms.
  11. Three simultaneous clients each receive the same published frame.
  12. `hub.close()` ends every open stream (each client sees `end` within 1 s).
  13. After frames were streamed, `GET /events` lists the same number of envelopes the first client received plus none missing (equal counts).
- **Verify:** `npx vite-node scripts/verify/at-02-events.ts`
- **Expected output:** `at-02-events: 13 checks OK`
- **Proves:** every degraded rung change can reach the browser either by stream or by polling, in one envelope format.

### WU-API-TRANSPORT-03 — Ring routes, Playground token, per-session port selection, linking routes
- **Goal:** the browser reaches Ring only through `/api/ring/*`; each visitor gets their own bundle week, or live Ring when they bring a token; a failing live Ring steps down to the bundle with a banner.
- **Steps:**
  1. Write `src/server/sessions.ts` (§3.5, §5.3).
  2. Add `mountRing` (§5.5 rows for `/api/ring/*`, §5.6) and the proof middleware and `api-ring` proof call of §5.7. Register `/api/ring/token` and the linking routes **before** `/api/ring/:op`.
  3. In `deps.ts` replace `unbuilt("sessions")` by the factory call of §5.10 item 4.
  4. Write `scripts/verify/at-03-ring.ts`: start `createMockRingServer({ accessTokens: ["tok-test-123"], webhookSecret: "whsec-test-1" })`; start the app server with `ringBaseUrl: mock.url` and `oauthUrl: mock.oauthUrl`; capture every log line.
- **Files:** `src/server/sessions.ts`, `src/server/app.ts`, `src/server/deps.ts`, `scripts/verify/at-03-ring.ts`.
- **Checks (26):**
  1. `SESSION_ID_PATTERN` accepts `abcd1234` and rejects `short`, `has space!!` and a 65-character string.
  2. On a bundle session, `POST /api/ring/listDevices` is `200` with `ok: true` and a `data` array that includes the id `dev-door`.
  3. A `sessionId` of `x` gives `400` `bad_session`.
  4. The op `drop` gives `404` `unknown_op`.
  5. `getStatus` without `deviceId` gives `400` `bad_request` with the message `getStatus: deviceId is required.`.
  6. `getEventHistory` with `limit: 5000` gives `400` `bad_request`.
  7. `getEventHistory` for `dev-door` with `limit 10, offset 0` returns a `data.items` array of length `10`.
  8. Two bundle sessions are independent: the first `drainWebhookInbox` of session A returns a non-empty array and its second returns `[]`, while the first call of session B is non-empty again.
  9. `POST /api/ring/token` with `tok-test-123` is `200` with `expiresInSec` between `1700` and `1800`, and the response body text does not contain `tok-test-123`.
  10. After that, `GET /api/status?sessionId=<that session>` reports `ring.mode "live"` and another session reports `"bundle"`.
  11. On the live session `listDevices` is `200` and `mock.stats().byPath["/v1/devices"]` is at least `1`.
  12. A session with the token `bad-token` gets `401` `unauthorized` from `listDevices`.
  13. Right after that `401`, `GET /api/status?sessionId=…` reports `"bundle"` and `GET /events` contains a `system-degraded` envelope with `payload.layer "ring"` and `degraded true`.
  14. The next `listDevices` on that session is `200` with bundle data.
  15. `POST /api/ring/token` again with `tok-test-123` makes the session `"live"` and publishes a `ring-mode` envelope with `mode "live"`.
  16. With `mock.failNext(503)` called twice, the first live call returns `503` and the session is still live; the second returns `503` and the session is then `"bundle"`.
  17. With a fresh live session, a `503` followed by a success, then another `503` followed by a success, leaves the session `"live"` (the failure count resets).
  18. With `mock.failNext(429, 1)` called four times, a live call returns `429` `rate_limited` with `retryAfterSec 1` and the session stays `"live"`.
  19. `DELETE /api/ring/token` (body `{ sessionId }`) makes a token-only session `"bundle"` again.
  20. A server built with `env { RING_ACCESS_TOKEN: "tok-test-123" }` reports `ring.mode "live"` for no session; with `RING_MODE: "bundle"` added it reports `"bundle"`, and a session token still makes that one session live.
  21. `POST /api/ring/linking/nonce` on a bundle session is `409` `not_live` with the message `Connect a Ring token first.`.
  22. On a live session with `RING_HMAC_KEY` unset, the same route is `503` `not_configured`.
  23. With `RING_HMAC_KEY: "k-test-key-123"` set: `nonce` returns `ok`, a `nonce` matching `/^[A-Za-z0-9_-]{43}$/` and `time` within 5 of `Math.floor(Date.now()/1000)`; `confirm` with `accountIdentifier "user@partner.example.com"` returns `status "awaiting"` and an `accountIdentifier` containing `***`; `complete` returns `status "completed"`.
  24. The proof log contains a line with `edge=api-ring mode=live listDevices ok` and a line with `edge=api-ring mode=bundle listDevices ok`.
  25. Bundle `getSnapshot` returns `data.contentType` starting `image/` with `synthetic true`; `playChime` returns `ok true, simulated true`; `stopWhep` returns `ok true, data null`.
  26. Over the whole script, no captured log line and no proof-file line contains `tok-test-123` or `bad-token`.
- **Verify:** `npx vite-node scripts/verify/at-03-ring.ts`
- **Expected output:** `at-03-ring: 26 checks OK`
- **Proves:** a visitor with no credentials sees the recorded week, a visitor with a token sees live data through the server only, and a dead Ring degrades visibly instead of breaking the page.

### WU-API-TRANSPORT-04 — webhook receiver route, inbox draining, simulated deliveries
- **Goal:** Ring can post to `/webhooks/ring`; everything else about the delivery (verify first, answer fast, queue, de-duplicate) is the Ring plan's handler; this unit mounts it on the raw body and adds the signed, labelled simulator.
- **Steps:**
  1. Write `src/server/simulate.ts` (§3.7): the payload template is the matching `WIRE_SAMPLES` entry (`motion_detected` → `webhookMotion`, `button_press` → `webhookButton`, `device_offline` and `device_online` → `webhookOffline` with `type` replaced), cloned, with `device_id`, `attributes.sub_type` (when given), `attributes.component_ids` (`[componentId ?? 0]` except for the two device events, which keep `{}`), `timestamp` and `meta.time` as ISO strings of `nowMs`, `event_id "evt-sim-<counter>"`, `meta.request_id "sim-<nowMs>-<counter>"`, `simulated: true`.
  2. Add `mountWebhook` (before `express.json`, §5.5): one handler instance for the real route (`sessionId "default"`), the `413` mapping, the `publish` hook that publishes `ring-webhook` and writes the `api-inbox` proof line.
  3. Add `mountSimulate` (§5.8), keeping one handler per requested session id in a small `Map` (all sharing `seen`).
  4. Write `scripts/verify/at-04-webhook.ts`.
- **Files:** `src/server/simulate.ts`, `src/server/app.ts`, `scripts/verify/at-04-webhook.ts`.
- **Checks (20):**
  1. A correctly signed `WIRE_SAMPLES.webhookMotion` posted raw returns `200` with body `{"ok":true}` and `content-type` containing `application/json`.
  2. That request took under 300 ms.
  3. Within 500 ms `GET /api/status` reports `inbox.default` `1`.
  4. Posting the identical body again returns `200` with `{"ok":true,"duplicate":true}` and `inbox.default` stays `1`.
  5. A wrong signature returns `401` and `inbox.default` is unchanged.
  6. A missing `X-Signature` header returns `401`.
  7. A server with no `RING_WEBHOOK_SECRET` returns `503`.
  8. A 300 KB body returns `413` with `{"ok":false,"error":"too large"}`.
  9. A signed body that is not JSON returns `400`.
  10. After check 1, `GET /events` holds a `ring-webhook` envelope whose payload keys are exactly `requestId, type, deviceId, tsMs, simulated`.
  11. A signed `device_added` payload returns `200`, publishes an envelope and leaves `inbox.default` unchanged.
  12. The proof log has a line `edge=api-inbox mode=live webhook motion_detected accepted req-0001`.
  13. A payload with extra spaces, a trailing newline and the character `é`, signed over those exact bytes, returns `200` (the route verifies the raw bytes, not a re-serialisation).
  14. `POST /api/dev/simulate-webhook` with `{ type: "motion_detected", deviceId: "dev-door", subType: "human" }` returns `200` and a `requestId` matching `/^sim-\d+-\d+$/`.
  15. With `sessionId: "sess-sim-0001"` the delivery appears in `drainWebhookInbox` of that bundle session as its last item with `simulated: true` and `device_id "dev-door"`, and does not appear in `inbox.default`.
  16. The route answers `400` for an unknown `type`, `503` `not_configured` when `RING_WEBHOOK_SECRET` is unset, `404` `disabled` when `NODE_ENV` is `production`, and `200` when `NODE_ENV` is `production` and `ALLOW_SIMULATE` is `1`.
  17. A simulated delivery publishes a `ring-webhook` envelope with `simulated: true` and writes a proof line with `mode=simulated`.
  18. `parseRingPayload(buildSimulatedWebhook({ type: "motion_detected", deviceId: "dev-door", subType: "human" }, 1760000000000, 7))` yields one event of type `motion_detected`, `subType "human"` and id `evt:sim-1760000000000-7`.
  19. `buildSimulatedWebhook` for `button_press` has `attributes.component_ids` equal to `[0]`, and for `device_offline` has `attributes` equal to `{}`.
  20. On a live session (token set against the mock), `mock.emitWebhook({ type: "motion_detected", deviceId: "dev-door" })` posted to the server is returned by that session's `drainWebhookInbox` within 1 s.
- **Verify:** `npx vite-node scripts/verify/at-04-webhook.ts`
- **Expected output:** `at-04-webhook: 20 checks OK`
- **Proves:** the receiver verifies the exact bytes, answers inside the budget, queues once, and a judge without a public Ring link can still watch the real code path with a clearly labelled signed delivery.

### WU-API-TRANSPORT-05 — agent routes, status, the degraded ladder, cost
- **Goal:** the model path goes through the server, steps down one rung at a time with a visible banner, and shows the cost chip's number.
- **Steps:**
  1. Write `src/server/bedrock-lazy.ts` (§3.6b).
  2. Write `src/server/agent-service.ts` (§3.6, §5.4).
  3. Add `mountAgent` (`POST /api/agent/step`, `POST /api/agent/role/:role`, `GET /api/status`; §5.5): validate the `x-run-id` header (`/^[A-Za-z0-9_-]{1,64}$/`, default `"default"`), validate `input` is an object and `round` an integer ≥ 1 for roles, validate `contents` is a non-empty array and `tools` an array for steps (kit-shape `400` otherwise); add the `api-bedrock`, `api-cache` and `api-cost` proof calls (§5.7).
  4. In `deps.ts` replace `unbuilt("agent")` by the factory of §5.10 item 5.
  5. Write `scripts/verify/at-05-agent.ts` with a `stubTransport(kind, label, behaviour)` helper: `role` and `step` count their calls and answer from a settable behaviour (`ok`, `fail`, `hang`); `onRungChange(fn)` stores `fn` so the script can fire it. The golden rung uses the **real** `createGoldenTransport` over `data/golden-cache`.
- **Files:** `src/server/bedrock-lazy.ts`, `src/server/agent-service.ts`, `src/server/app.ts`, `src/server/deps.ts`, `scripts/verify/at-05-agent.ts`.
- **Checks (26):**
  1. With `AGENT_PROVIDER: "bedrock"` and all three rungs available, `agent.state()` has `rung "bedrock"` and `kind "bedrock"`.
  2. With `AGENT_PROVIDER: "golden"` the rung is `"golden"` and `kind` is `"golden"`.
  3. With `AGENT_PROVIDER: "bedrock"` but `makeBedrock` returning `null`, the rung is `"golden"`.
  4. With `makeBedrock` and `makeGolden` both `null`, the rung is `"manual"`.
  5. `GET /api/status` returns exactly the keys `ring, agent, cost, inbox, build`, with `agent.kind` equal to the state's kind and `inbox.default` a number.
  6. A successful role call over `POST /api/agent/role/extractor` returns `200` with `ok true`, `output`, `model`, `tokens`, `usage`, `latencyMs`, `kind "bedrock"`, a `label` and `rungChanged false`.
  7. `POST /api/agent/role/janitor` is `404` `unknown_role`.
  8. A role call without `input` is `400` `bad_request`.
  9. The role call published an `agent-role` envelope whose payload keys are exactly `role, kind, model, totalTokens, latencyMs, round`.
  10. When the bedrock stub returns `{ ok: false, degraded }`, the response is `200` with `ok false`, `rungChanged true`, `kind "golden"` and `label "Recorded run"`; afterwards `state().rung` is `"golden"`, and `/events` holds an `agent-rung` envelope and a `system-degraded` envelope with `layer "agent"`, `kind "golden"` and `degraded true`.
  11. After that, a new run id calling the role whose key is the first `doorstep-role-` entry listed by the golden cache (key suffix passed as `key`) returns `ok true` with `kind "golden"` and `label "Recorded run"`.
  12. Two different run ids each get the first recorded step from `POST /api/agent/step` (equal `result.text` and equal `functionCalls`), proving the replay cursor is per run.
  13. A successful step on the bedrock stub returns `200`, the kit shape `{ ok: true, result }` plus `kind` and `label`, and the stub saw the `x-run-id` header's value as the run id.
  14. A step body without `contents` returns HTTP `400` in the kit shape `{ ok: false, status: 400, message }`, the stub was not called, and the rung did not change.
  15. A stub step failure `{ ok: false, status: 502, message }` returns HTTP `502`, `rungChanged true`, and the rung is now `"golden"`.
  16. With `stepTimeoutMs: 100` and a step that never answers, the response is HTTP `504` with the message `The model took too long.` and the rung steps down.
  17. On the manual rung a role call returns `ok false` with `degraded.reason` `manual_mode` and `rungChanged false`; a step returns `503` with the message `The AI path is off. Use the action runner.`; the rung stays `"manual"`.
  18. With a cost stub whose `summary().degraded` is `true`, the first role call descends **before** calling the bedrock stub (its call count is `0`) and is answered by the golden rung.
  19. When the cost stub's `warning` changes from `"none"` to `"warning"`, exactly one `cost-warning` envelope with `payload.warning "warning"` is published; a second call with the same warning publishes none.
  20. `GET /api/status` reports `cost.usedPct` equal to the cost stub's value.
  21. The proof log has an `edge=api-bedrock mode=bedrock` line after a bedrock success, an `edge=api-cache mode=golden` line after a golden success, and an `edge=api-cost mode=sidecar` line after each call.
  22. When the bedrock stub fires `onRungChange("vertex-fallback", "Fallback model (not Bedrock)")` (and its `kind` property is changed to match), a `system-degraded` envelope with `kind "vertex-fallback"` is published and `state().kind` is `"vertex-fallback"` while `state().rung` is still `"bedrock"`.
  23. `buildServerDeps({ env: {} })` starts on the `"golden"` rung (the committed cache is non-empty) without any network call.
  24. `buildServerDeps({ env: { AWS_BEARER_TOKEN_BEDROCK: "x", AGENT_PROVIDER: "bedrock" } })` starts on the `"bedrock"` rung with `label "Amazon Bedrock"` and `model() ""` before any call (nothing was discovered yet).
  25. `createLazyBedrockTransport` over a stub `build`: two concurrent role calls call `build` once; afterwards `label`, `model()` and `kind` mirror the built transport; a listener registered before the first call is attached to it.
  26. When `build` rejects with `Error("no model")`, `role` returns `ok false` with a `degraded.reason` starting `The model could not be set up:`, `step` returns `502`, and the next call invokes `build` again (call count `2`).
- **Verify:** `npx vite-node scripts/verify/at-05-agent.ts`
- **Expected output:** `at-05-agent: 26 checks OK`
- **Proves:** a dead or exhausted model never leaves the visitor with a blank screen: the next rung answers, the banner names it, and the cost number the chip shows is the same one the guard uses.

### WU-API-TRANSPORT-06 — `createHttpRingPort` and `createHttpAgentTransport`
- **Goal:** the browser codes against `RingPort` and `AgentTransport` exactly as the engine does; HTTP is hidden behind them.
- **Steps:**
  1. Write `src/server/http-ring-port.ts` (§3.9). Each method posts `{ sessionId, args }` to `<baseUrl>/api/ring/<op>` with `content-type: application/json` (argument names as in the table of §5.6; `undefined` members are omitted from `args`); the reply is parsed as JSON whatever the HTTP status: `ok: true` → return `data`; `ok: false` → `throw new RingError(error.status, error.code, error.message, error.retryAfterSec)`; a fetch rejection → `RingError(0, "network", "The server is not reachable.")`; a body that is not JSON → `RingError(502, "upstream", "The server sent something unexpected.")`. `remoteMode()` is `GET /api/status?sessionId=` → `ring.mode`. `setToken` / `forgetToken` as §3.9. The default `fetch` is `globalThis.fetch.bind(globalThis)`.
  2. Write `src/server/http-agent-transport.ts` (§3.9). Local state `{ kind, label, model }` starts as `{ kind: "bedrock", label: "Amazon Bedrock", model: "" }` and is replaced by every reply that carries `kind`, `label` (and `model`), and by `refreshStatus()`. `role(role, input, ctx)` posts `{ input, round: ctx.round, key: ctx.key }` to `/api/agent/role/<role>` with the header `x-run-id`; `ok: true` → `{ ok: true, output, model, kind, usage, latencyMs }`; `ok: false` → `{ ok: false, degraded, kind }`; when `rungChanged` is true call each `onRungChange` listener once with `(kind, label)`. `step(body)` posts the body to `/api/agent/step` with the same header and returns the parsed JSON unchanged (also for HTTP 400/502/504). Network failures: `role` → `{ ok: false, degraded: { degraded: true, reason: "The server is not reachable.", fallback_source: "none", original_error: <message>, data: null }, kind: <last kind> }`; `step` → `{ ok: false, status: 503, message: "The server is not reachable." }`. Default `runId`: 16 random characters from `[a-z0-9]`.
  3. In `deps.ts` nothing changes. Write `scripts/verify/at-06-clients.ts` (a recording `fetch` stub for the request-shape checks; a real server for the rest).
- **Files:** `src/server/http-ring-port.ts`, `src/server/http-agent-transport.ts`, `scripts/verify/at-06-clients.ts`.
- **Checks (23):**
  1. `runRingPortContract(createHttpRingPort(...))` over a server in bundle mode completes without throwing.
  2. `port.mode` is `"http"`.
  3. `remoteMode()` is `"bundle"`; after `setToken("tok-test-123")` against a server pointing at the mock Ring it is `"live"`.
  4. `listDevices()` deep-equals the bundle port's `listDevices()`.
  5. `getEventHistory("dev-door", { limit: 10, offset: 0 })` deep-equals the bundle port's answer.
  6. `getStatus("nope")` rejects with a `RingError` whose `status` is `404` and `code` is `"not_found"`.
  7. Four `failNext(429, 1)` calls make a live `listDevices()` reject with `code "rate_limited"` and `retryAfterSec 1`.
  8. A client pointed at a closed port rejects with `RingError` `status 0`, `code "network"`.
  9. A client pointed at a tiny server that answers `<html>` rejects with `RingError` `status 502`, `code "upstream"`.
  10. With a recording `fetch`, `getEventHistory("d", { limit: 5, offset: 0 })` posts to `/api/ring/getEventHistory` with `content-type: application/json` and the body `{"sessionId":"sess-clients-1","args":{"deviceId":"d","limit":5,"offset":0}}` (no `type` key).
  11. `stopWhep("d", "w")` posts `args` `{ deviceId: "d", whepSessionId: "w" }`.
  12. `setToken("t")` posts `{ sessionId, token: "t" }` to `/api/ring/token`; `forgetToken()` sends method `DELETE` with `{ sessionId }`.
  13. With no `baseUrl` the recorded URL is `/api/ring/listDevices` (same origin); with `baseUrl: "http://x.test"` it is `http://x.test/api/ring/listDevices`.
  14. The source of both client files contains no `node:` import, no `process.env`, and no non-type import from `src/resilience`.
  15. `createHttpAgentTransport({ runId: "run-aaaa1111" })` → `refreshStatus()` returns the server's `{ kind, label, model }` and `transport.kind`, `transport.label`, `transport.model()` mirror it.
  16. Against a golden-rung server, `role("extractor", input, { round: 1, key })` (key = suffix of the first `doorstep-role-` cache entry) returns `ok true` with `kind "golden"`.
  17. With a recording `fetch`, a role call sends the header `x-run-id: run-aaaa1111` and the body `{"input":…,"round":1,"key":"extractor-1"}`.
  18. `step({ contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [] })` against the golden rung returns `{ ok: true, result }` with a `result.model` string.
  19. Against a bedrock-stub server whose role fails, `role` returns `{ ok: false, degraded, kind: "golden" }` and the `onRungChange` listener was called once with `("golden", "Recorded run")`.
  20. A network failure makes `role` return `ok false` with `degraded.reason "The server is not reachable."` and `fallback_source "none"`, and `step` return `{ ok: false, status: 503, message: "The server is not reachable." }`.
  21. A reply with `rungChanged: true` updates `transport.kind` and `transport.label` immediately, with no further `/api/status` request (recording fetch shows one request).
  22. Two transports created without a `runId` have different ids, each matching `/^[a-z0-9]{16}$/`.
  23. An HTTP `400` answer from `/api/agent/step` is returned unchanged as `{ ok: false, status: 400, message }`.
- **Verify:** `npx vite-node scripts/verify/at-06-clients.ts`
- **Expected output:** `at-06-clients: 23 checks OK`
- **Proves:** the browser-side code is interchangeable with the in-process code, and the contract suite that the bundle and the live port already pass also passes over HTTP.

### WU-API-TRANSPORT-07 — `architecture.json` skeleton and the proof harvest
- **Goal:** the architecture the video draws exists as data from the first build, and its proofs can only come from a real log.
- **Steps:**
  1. Write `architecture.json` at the entry root exactly as §5.9 and `config/architecture-proofs.json` as §5.9.
  2. Write `scripts/harvest-architecture-proofs.ts` (§3.10, §5.9): argument parsing for `--dir` (default `.`), `--log` (default `<dir>/logs/proof.log`), `--accept-any`, `--sync`, `--require-sponsor`; the sync target is the environment variable `ARCH_SYNC_DIR` when set, otherwise `../../hackathons/hackathon-projects/2026-10-amazonDevs`.
  3. Write `scripts/verify/at-07-architecture.ts`. It builds a fixture project directory in a temporary folder: a copy of `architecture.json`, a copy of `config/architecture-proofs.json` placed where the script reads it (`--dir` + `/config/…`), and a proof log written by calling `createProofLog` six times (`ui-api server`, `api-ring live`, `api-inbox live`, `api-bedrock bedrock`, `api-cache golden`, `api-cost sidecar`), so the line format under test is the real one. Lint runs as `node ../../hackathons/scripts/lint-architecture.ts <dir>`.
  4. State in the unit's notes that the **real** harvest happens in DP-E2E-BROWSER-TESTING WU-11 (after a real run) and again in DP-LIVE-RUN-AND-VIDEO (live Ring and Bedrock lines); this unit never commits a proof.
- **Files:** `architecture.json`, `config/architecture-proofs.json`, `scripts/harvest-architecture-proofs.ts`, `scripts/verify/at-07-architecture.ts`.
- **Checks (16):**
  1. `architecture.json` parses, has `8` nodes and `7` edges, and every node and edge id matches `/^[a-z0-9][a-z0-9-]*$/`.
  2. Every label is at most 22 characters and every node's `lane` is listed in `lanes`.
  3. Exactly the nodes `ring` and `bedrock` have `sponsor: true`.
  4. No edge of the committed skeleton has a `proof`.
  5. Every key of `config/architecture-proofs.json` is an edge id of `architecture.json`.
  6. `lint-architecture` on the committed skeleton exits `1` and its output contains `carry no proof edge`.
  7. On the fixture directory, `harvest` returns `6` proofs and `0` missing.
  8. With two `api-ring live` lines in the log, the harvested proof points to the second one (the larger line number).
  9. A log whose only `api-ring` line has `mode=mock` leaves `api-ring` missing; with `acceptAny` it is accepted.
  10. After a harvest, `architecture.json` equals the original once every `proof` key is removed from both (all other fields and the key order are unchanged).
  11. Every harvested `proof.file` is `logs/proof.log` (forward slashes) and `proof.line` is the 1-based number of the line that contains `proof.text`.
  12. `node ../../hackathons/scripts/lint-architecture.ts <fixture dir>` exits `0` and prints a line starting `lint:architecture — OK (8 nodes, 7 edges, 6 proof(s) read and matched, sponsor: ring, bedrock)`.
  13. After changing one proof's `text` in the fixture `architecture.json`, the lint exits `1` and its output contains `does not contain`.
  14. The CLI with `--require-sponsor` exits `1` on a log that has no `live` or `bedrock` line and exits `0` on the fixture log.
  15. `--sync` with `ARCH_SYNC_DIR` pointing at an existing temporary directory copies `architecture.json` and `logs/proof.log` there and prints `synced`.
  16. `--sync` with `ARCH_SYNC_DIR` pointing at a missing directory prints `sync skipped` and exits `0`.
- **Verify:** `npx vite-node scripts/verify/at-07-architecture.ts`
- **Expected output:** `at-07-architecture: 16 checks OK`
- **Proves:** a proof on the architecture slide can only be a line that a real process wrote, and the same file feeds the lint that guards the video.

### WU-API-TRANSPORT-08 — the whole path through the browser-side clients
- **Goal:** one script runs the review week the way the UI does (HTTP clients, no in-process shortcuts) in bundle mode, with a mid-run model failure, and against the simulated live Ring with a signed webhook.
- **Steps:**
  1. Write `scripts/verify/at-08-integration.ts`. Start `createMockRingServer({ accessTokens: ["tok-test-123"], webhookSecret: "whsec-test-1" })`; start the server with `env { RING_WEBHOOK_SECRET: "whsec-test-1", AGENT_PROVIDER: "golden", NODE_ENV: "test" }`, `ringBaseUrl: mock.url`, `oauthUrl: mock.oauthUrl`, and the **real** golden cache; point the mock's `webhookTarget` at `<server url>/webhooks/ring`.
  2. Build the browser-side stack: `createHttpRingPort`, `createHttpAgentTransport`, `createAppSession({ ring: port })`, `runWeekReview({ session, transport, autoDecide })`.
  3. For the mid-run failure, start a second server whose `makeBedrock` returns a wrapper over `createGoldenTransport()` with `kind "bedrock"` that answers the first two role calls and then returns `{ ok: false, degraded }`.
  4. Capture every server log line and every response body the script reads.
  5. Run `npm run verify:api` once at the end; it must print the eight lines of §8 and exit 0.
- **Files:** `scripts/verify/at-08-integration.ts`.
- **Checks (15):**
  1. On the bundle path, `runWeekReview` over the HTTP clients returns `ok true`, `rung "golden"` and `counts.errorsAfterRepair 0`.
  2. `counts.errorsAfterAct` is `1` and `counts.warningsAfterRepair` is `3`.
  3. `floors.ok` is `true` and `floors.humanCheckpoints` is at least `1`.
  4. The summary's trace written to a temporary file passes `npx vite-node hee/scripts/hee-validate-run-trace.ts <file> --min-roles 4 --min-actions 15 --require-verify-repair --require-human-checkpoint` (exit `0`).
  5. `GET /events` holds at least `15` envelopes whose `step_id` is `agent-role` or `agent-step` together.
  6. The proof log has lines for `ui-api` (`mode=server`), `api-ring` (`mode=bundle`), `api-cache` (`mode=golden`) and `api-cost` (`mode=sidecar`).
  7. A second run with `autoDecide: "reject-first-then-approve"`, a fresh session and a fresh run id also returns `ok true`.
  8. After `port.setToken("tok-test-123")`, `remoteMode()` is `"live"` and `listDevices()` raises the mock's `/v1/devices` count.
  9. `mock.emitWebhook({ type: "motion_detected", deviceId: "dev-door" })` returns status `200`, and the live session's `drainWebhookInbox()` returns, within 1 s, a payload whose `meta.request_id` equals the returned `requestId`.
  10. Emitting the same `requestId` again does not add a second copy to the next drain.
  11. On the failing-bedrock server, a review's `summary.degraded.length` is at least `1` and `GET /api/status` then reports `agent.kind "golden"`.
  12. A second review on that server with a new transport (new run id) returns `ok true` and `rung "golden"`.
  13. An SSE client connected before the failing run received a `system-degraded` frame with `layer "agent"` and `kind "golden"`.
  14. No captured log line or response body contains `tok-test-123` or `whsec-test-1`.
  15. `close()` of every server resolves within 2 s and `hub.connections()` is `0` afterwards.
- **Verify:** `npx vite-node scripts/verify/at-08-integration.ts`
- **Expected output:** `at-08-integration: 15 checks OK`
- **Proves:** the product runs end to end through the same seams the browser uses, degrades without losing the run, and keeps its secrets out of every channel.

## §8 Verification summary

| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/at-01-app.ts` | `at-01-app: 18 checks OK` |
| 02 | `npx vite-node scripts/verify/at-02-events.ts` | `at-02-events: 13 checks OK` |
| 03 | `npx vite-node scripts/verify/at-03-ring.ts` | `at-03-ring: 26 checks OK` |
| 04 | `npx vite-node scripts/verify/at-04-webhook.ts` | `at-04-webhook: 20 checks OK` |
| 05 | `npx vite-node scripts/verify/at-05-agent.ts` | `at-05-agent: 26 checks OK` |
| 06 | `npx vite-node scripts/verify/at-06-clients.ts` | `at-06-clients: 23 checks OK` |
| 07 | `npx vite-node scripts/verify/at-07-architecture.ts` | `at-07-architecture: 16 checks OK` |
| 08 | `npx vite-node scripts/verify/at-08-integration.ts` | `at-08-integration: 15 checks OK` |
| all | `npm run verify:api` | the eight lines above, in order, exit 0 |
If a count differs because a check was split or merged while writing a script, change the number in the unit and in this table in the same edit.

## §9 Risks
- **Express 5 differences.** Wildcards must be `/{*splat}`; `req.body` is undefined without a parser. Mitigation: the webhook route is mounted on `express.raw` before `express.json`; WU-01 check 14 and WU-04 check 13 prove both paths.
- **SSE through a proxy.** Cloud Run and some proxies buffer or time out streams. Mitigation: `X-Accel-Buffering: no`, a 15 s keepalive comment, `EventSource` reconnects by itself, and `/events` is a polling fallback; DP-DEPLOY raises the request timeout.
- **Webhooks cannot reach the deployed URL.** Mitigation: signed, `SIMULATED`-labelled deliveries go through the same handler; history polling is the real failover (DP-RING-INTEGRATION).
- **A live proof may not exist.** `api-ring`, `api-inbox` and `api-bedrock` proofs accept only live or Bedrock lines. Mitigation: the harvest reports `missing` instead of weakening the filter; DP-LIVE-RUN-AND-VIDEO harvests again after the real run.
- **Memory growth.** The publisher keeps every envelope of the process. Mitigation: demo-scale traffic; `snapshot()` returns only the newest `eventsKeep`; sessions expire after `sessionTtlMin`.
- **Bedrock set-up cost on the first call.** Discovery and client construction add latency to the first role call. Mitigation: `createLazyBedrockTransport` shares one build; the first call's latency is recorded in the cost chip, not hidden.
- **One server rung for all visitors.** A degraded model affects every visitor until the process restarts. Mitigation: acceptable for a hackathon demo; the banner names the rung, and `AGENT_PROVIDER` can pin it.
- **Secrets in logs.** Mitigation: `redact` on every log and proof line; WU-03 check 26 and WU-08 check 14 scan every captured line and body.
