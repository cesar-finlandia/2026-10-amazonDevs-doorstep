# DP-RING-INTEGRATION — Ring REST client, OAuth, signed webhooks, history, live video, snapshot, chime, account linking

> Plan 3 of 12. Owner of everything that talks to Ring from Node: signature check, webhook handler and inbox, OAuth token provider, rate-limited REST client, `LiveRingPort`, account linking, the wire constants and samples, and a local contract server that imitates Ring (always labelled *simulated*). It implements the `RingPort` interface that DP-DOMAIN-ENGINE owns. It contains no Express code (DP-API-TRANSPORT) and no model call.
> Chassis paths are written `../../hackathons/…`. All imports use the `src/…` alias; every verification command runs under `vite-node`. Ring and OAuth calls are server-to-server only (browsers are blocked by CORS): nothing in this plan may be imported by browser code.

## §0 Context & blockers

**Must already exist before WU-01 runs** (DP-DOMAIN-ENGINE): `src/domain/{types,ring-port,parse,derive,gaps,generator,bundle-ring-port,seed,session}.ts`, `data/bundle/doorstep-14d.json`, `scripts/verify/ring-port-contract.ts`. Proof:

```bash
npx vite-node scripts/verify/de-09-session.ts
```
Expected: `de-09-session: 12 checks OK`.

**Preflight (each line must print a path):**
```bash
ls -d src/resilience src/domain/ring-port.ts src/domain/gaps.ts scripts/verify/ring-port-contract.ts design_documents
node --version
```

**Ring access, for the optional live probes only.** Credentials come from the environment and are never written to any file or plan: `RING_ACCESS_TOKEN` (a Developer Playground token, about 30 minutes of life), or the long-lived trio `RING_REFRESH_TOKEN`, `RING_CLIENT_ID`, `RING_CLIENT_SECRET`; `RING_WEBHOOK_SECRET` (webhook signature secret); `RING_HMAC_KEY` (account-linking nonce key). Every verification command in this plan runs offline against stubs and the local contract server; a live probe that cannot run (no token, no network) is skipped, and the unit says so in its notes.

**Wire facts known at plan time (confirmed from the organizer's documentation pages and sample repository; WU-01 re-checks every one before code depends on it):**
- REST base `https://api.amazonvision.com`; OAuth `POST https://oauth.ring.com/oauth/token` (form body `grant_type=refresh_token&refresh_token=…&client_id=…&client_secret=…`; reply `{ access_token, refresh_token, scope, expires_in, token_type }`, `expires_in` about 14400). Access token about 4 h, refresh token about 30 days, authorization code 60 s.
- Authorization header `Authorization: Bearer <token>` on every REST call. Rate limit 100 requests/s per client id; `429` with `Retry-After`; headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`; errors follow JSON:API.
- Webhooks: HTTPS `POST` with a JSON body, header `X-Signature: sha256=<hex>` (HMAC-SHA256 over the raw body), reply `200` within 5 s, process asynchronously, delivery may repeat and arrive out of order, so de-duplicate on `meta.request_id`. The organizer's sample receiver posts a flat `{ "event_type": "motion_detected", "device_id": "camera-1" }`; the parser in DP-DOMAIN-ENGINE accepts both.
- Event History: `GET /v1/history/devices/{id}/events`, optional query `event_types` (comma separated, for example `motion.human,ding`); the sample reads `data[]` with `attributes.event_type` and `attributes.start`.
- Devices: `GET /v1/devices` with `?include=status,capabilities,location,configurations` (JSON:API); also `/v1/devices/{id}/status|capabilities|location|configurations`, capabilities accept `?component_id=N`.
- Live video (WHEP): `POST /v1/devices/{id}/media/streaming/whep/sessions` with `Content-Type: application/sdp` and the SDP offer as the body; the SDP answer is the response body and the session URL is in the `Location` header; `DELETE <session URL>` closes it. Sessions last 30 s on battery devices and 60 s on line-powered devices.
- Snapshot `POST /v1/devices/{id}/media/image/download` with a body that carries a `components` array; clip `POST /v1/devices/{id}/media/video/download`; chime `POST /v1/devices/{id}/media/audio/playback` with `audio_ref` in the body (needs the chime-audio capability).
- Account linking: nonce = URL-safe base64 without padding of `HMAC-SHA256(key, "<time>:<account_id>")`, valid 600 s; `GET /v1/users/me` returns the account id; `POST /v1/accounts/me/app-integrations` body `{ "account_identifier": "…", "nonce": "…" }`, then `PATCH` the same path with `{ "status": "completed" }`.
Where the documentation shows no literal body (webhook JSON, history item fields beyond `attributes.event_type` and `attributes.start`, status, capabilities, snapshot and clip request bodies), the shapes in §5.1 are **assumed**, every reader of them is tolerant, and WU-01 records any difference in `design_documents/friction-log.md`.

## §1 Purpose & requirement IDs

Make the product's Ring surface real, safe and testable. Requirements (blueprint §1): **FR-10** (discovery, status, capabilities, location, configurations, users), **FR-11** (signed webhook receiver, idempotency, tolerant normalizer), **FR-12** (history as the failover channel), **FR-13** (WHEP start/stop with auto-close), **FR-14** (snapshot and clip evidence), **FR-15** (chime, capability-gated), **FR-16** (account linking against a staging user), **FR-17** (`component_id` addressing), **NFR-01** (server-side only, tokens never logged), **NFR-03** (`withResilience`), **NFR-12** (webhook ack ≤ 5 s), **NFR-13** (100 TPS, 429 handling).

Mandated-technology rows this plan implements (technology leverage map, exercised by DP-E2E scenarios `S-RING-n`): row 1–4 webhooks and signature (S-RING-1, 2), row 5 history failover (S-RING-3), row 6 discovery (S-RING-4), row 7 WHEP (S-RING-5), row 8 snapshot (S-RING-6), row 9 `component_id` (S-RING-7), row 10 chime (S-RING-8), row 11 linking (S-RING-9), row 12 token flow (S-RING-4).

## §2 Scope boundaries

**IN — files this plan creates (exactly):**

| Path | What |
|---|---|
| `src/ring/wire.ts` | endpoint builders, limits, literal wire samples (single place to adjust after WU-01) |
| `src/ring/signature.ts` | `verifySignature`, `signPayload` |
| `src/ring/inbox.ts` | `createInbox`, `createSeenStore` |
| `src/ring/webhook.ts` | `createWebhookHandler` |
| `src/ring/oauth.ts` | `createTokenProvider` |
| `src/ring/client.ts` | `createRingHttp` |
| `src/ring/live-ring-port.ts` | `createLiveRingPort` |
| `src/ring/linking.ts` | nonce, `getUserMe`, `confirmLink`, `completeLink`, `maskIdentifier` |
| `scripts/mock-ring-server.ts` | `createMockRingServer` (simulated Ring) |
| `scripts/probe-ring.ts` | optional live probe |
| `design_documents/friction-log.md` | friction entries appended by each unit |
| `scripts/verify/ri-01-signature.ts` … `ri-08-history.ts` | the eight verification scripts |

**OUT — owned elsewhere:** `RingPort`, `RingError`, parsers, `findWebhookGaps`, `pollHistory`, the bundle port and contract helper (DP-DOMAIN-ENGINE); the Express routes `POST /webhooks/ring`, `/api/ring/*`, the SSE hub and `HttpRingPort` (DP-API-TRANSPORT); the WHEP video element and the connect panel (DP-UI); scenarios `S-RING-1…9` (DP-E2E-BROWSER-TESTING).

## §3 Interfaces owned (literal skeletons)

### §3.1 `src/ring/wire.ts`
```ts
// Requirement IDs: FR-10…FR-16
// Wire constants and samples. The only file to edit when the documentation differs from §5.1.
export const RING_API_BASE = "https://api.amazonvision.com";
export const RING_OAUTH_URL = "https://oauth.ring.com/oauth/token";
export const RING_LIMITS: { tps: 100; webhookAckMs: 5000; nonceWindowSec: 600; whepMaxSecBattery: 30; whepMaxSecLine: 60; clipMaxSec: 30 };
export const WIRE: {
  devices: string; deviceInclude: string; usersMe: string; appIntegrations: string; signaturePrefix: "sha256=";
  status(id: string): string; capabilities(id: string): string; location(id: string): string; configurations(id: string): string;
  history(id: string): string; whepSessions(id: string): string; imageDownload(id: string): string; videoDownload(id: string): string; audioPlayback(id: string): string;
};
export const WIRE_SAMPLES: Record<"webhookMotion" | "webhookButton" | "webhookOffline" | "webhookFlat" | "devices" | "status" | "capabilitiesElite" | "capabilitiesDoorbell" | "location" | "configurations" | "history" | "token" | "usersMe" | "appIntegrationAwaiting" | "appIntegrationCompleted" | "errorUnauthorized" | "errorRateLimited", unknown>;
```

### §3.2 `src/ring/signature.ts`
```ts
// Requirement IDs: FR-11
/** Constant-time HMAC-SHA256 check of the raw body. header must be "sha256=<64 hex>" (hex case-insensitive). Never throws; false on any problem. */
export function verifySignature(rawBody: Buffer | string, header: string | undefined, secret: string): boolean;
/** "sha256=<lower-case hex>" over rawBody. Used by the simulate-webhook route, the contract server and tests. */
export function signPayload(rawBody: Buffer | string, secret: string): string;
```

### §3.3 `src/ring/inbox.ts`
```ts
// Requirement IDs: FR-11, NFR-12
import type { RingWebhookPayload } from "src/domain/ring-port.js";
export interface Inbox {
  push(sessionId: string, payload: RingWebhookPayload): void;
  drain(sessionId: string): RingWebhookPayload[];     // returns oldest first and empties the session's queue
  size(sessionId: string): number;
  clear(sessionId: string): void;
}
/** Per-session queues; "default" holds real webhooks. Each queue keeps the newest maxPerSession (default 500) payloads. */
export function createInbox(opts?: { maxPerSession?: number }): Inbox;
export interface SeenStore { has(id: string): boolean; add(id: string): void; size(): number }
/** Insertion-ordered set; the oldest id is evicted when more than max (default 5000) are held. */
export function createSeenStore(max?: number): SeenStore;
```

### §3.4 `src/ring/webhook.ts`
```ts
// Requirement IDs: FR-11, NFR-12
import type { Inbox, SeenStore } from "src/ring/inbox.js";
export interface WebhookEvent { requestId: string; type: string; deviceId: string; tsMs: number; simulated: boolean }
export interface WebhookDeps {
  secret: string | undefined | (() => string | undefined);   // RING_WEBHOOK_SECRET; read on every call
  inbox: Inbox; seen?: SeenStore;
  publish?: (e: WebhookEvent) => void;                        // SSE hub hook (DP-API-TRANSPORT); never receives the secret or the raw body
  sessionId?: string;                                         // default "default"
  now?: () => number;
}
export type WebhookRequest = { rawBody: Buffer; headers: Record<string, string | undefined> };
export type WebhookResponse = { status: number; body: string };
export interface WebhookHandler { (req: WebhookRequest): Promise<WebhookResponse>; flush(): Promise<void> }
/** Verify the signature BEFORE parsing; answer fast; enqueue asynchronously; idempotent on meta.request_id (else event_id). See §5.2. */
export function createWebhookHandler(deps: WebhookDeps): WebhookHandler;
```

### §3.5 `src/ring/oauth.ts`
```ts
// Requirement IDs: FR-10, NFR-01
export type TokenSource = "playground" | "env_access" | "refresh" | "none";
export interface TokenProvider {
  getToken(opts?: { force?: boolean }): Promise<string>;      // throws RingError(401,"unauthorized", …) when no credential exists
  setPlaygroundToken(token: string, ttlSec?: number): void;   // default ttl 1800 s
  forget(): void;                                              // drops the playground token
  status(): { source: TokenSource; expiresInSec: number | null };
}
export interface TokenProviderOptions {
  env?: Record<string, string | undefined>;                   // default process.env
  fetch?: typeof fetch; now?: () => number;
  oauthUrl?: string;                                          // default RING_OAUTH_URL
  refreshSkewSec?: number;                                    // default 300
}
export function createTokenProvider(opts?: TokenProviderOptions): TokenProvider;
```

### §3.6 `src/ring/client.ts`
```ts
// Requirement IDs: FR-10, NFR-03, NFR-13
export interface RingResponse { status: number; headers: Record<string, string> /* lower-cased names */; json: unknown | null; text: string; bytes: Uint8Array }
export interface RingRequestOptions { query?: Record<string, string | number | undefined>; json?: unknown; body?: string; contentType?: string; accept?: string }
export interface RingHttp {
  request(method: "GET" | "POST" | "PATCH" | "DELETE", pathOrUrl: string, opts?: RingRequestOptions): Promise<RingResponse>;
  get(path: string, query?: Record<string, string | number | undefined>): Promise<RingResponse>;
  post(path: string, json?: unknown, opts?: Omit<RingRequestOptions, "json">): Promise<RingResponse>;
  patch(path: string, json?: unknown): Promise<RingResponse>;
  del(pathOrUrl: string): Promise<RingResponse>;
  readonly baseUrl: string;
}
export interface RingHttpOptions {
  baseUrl?: string;                                           // default RING_API_BASE
  tokens: Pick<import("src/ring/oauth.js").TokenProvider, "getToken">;
  fetch?: typeof fetch; tps?: number;                         // default 100
  maxRetries429?: number;                                     // default 3
  resilience?: import("src/resilience").ResilienceConfig;
  now?: () => number; sleep?: (ms: number) => Promise<void>;
}
/** Failures are thrown as RingError (src/domain/ring-port.ts). Every request is wrapped in withResilience (§5.4). */
export function createRingHttp(opts: RingHttpOptions): RingHttp;
```

### §3.7 `src/ring/live-ring-port.ts`
```ts
// Requirement IDs: FR-10, FR-12…FR-15, FR-17
import type { RingPort } from "src/domain/ring-port.js";
export interface LiveRingPortDeps { http: import("src/ring/client.js").RingHttp; inbox: import("src/ring/inbox.js").Inbox; sessionId?: string; now?: () => number }
export type LiveRingPort = RingPort & { readonly mode: "live"; openSessions(): string[]; closeAll(): Promise<void> };
export function createLiveRingPort(deps: LiveRingPortDeps): LiveRingPort;
```

### §3.8 `src/ring/linking.ts`
```ts
// Requirement IDs: FR-16
export function nonceTime(nowMs: number): number;                                   // Math.floor(nowMs / 1000)
export function makeNonce(key: string, accountId: string, nowMs?: number): string;  // base64url, no padding, HMAC-SHA256(key, `${nonceTime}:${accountId}`)
export function verifyNonce(key: string, accountId: string, time: number, nonce: string, nowMs?: number): boolean; // within 600 s, constant time
export function maskIdentifier(id: string): string;                                 // "u***r@partner.example.com"
export interface LinkDeps { http: import("src/ring/client.js").RingHttp }
export function getUserMe(deps: LinkDeps): Promise<{ accountId: string; name?: string }>;
export function confirmLink(deps: LinkDeps, args: { accountIdentifier: string; nonce: string }): Promise<{ status: "awaiting" | string; accountIdentifier: string /* masked */ }>;
export function completeLink(deps: LinkDeps): Promise<{ status: "completed" | string }>;
```

### §3.9 `scripts/mock-ring-server.ts`
```ts
// Requirement IDs: FR-10…FR-17 — a SIMULATED Ring. Every response carries the header "x-simulated: true".
export interface MockRingOptions {
  port?: number;                       // default 0 (ephemeral)
  bundle?: import("src/domain/generator.js").RingBundle;   // default the committed bundle
  webhookSecret?: string; webhookTarget?: string;           // emitWebhook posts here
  clientId?: string; clientSecret?: string; refreshToken?: string;
  accessTokens?: string[];             // accepted bearer tokens; default ["mock-access-token"] and every token the mock issues
  rateLimitPerSec?: number;            // when set, the (n+1)th request within one second gets 429 Retry-After: 1
}
export interface MockRing {
  readonly url: string; readonly oauthUrl: string;
  close(): Promise<void>;
  stats(): { requests: number; byPath: Record<string, number>; rateLimited: number };
  failNext(status: number, retryAfterSec?: number): void;
  emitWebhook(partial: { type: string; deviceId: string; subType?: string; componentId?: number; requestId?: string }): Promise<{ requestId: string; status: number }>;
}
export function createMockRingServer(opts?: MockRingOptions): Promise<MockRing>;
```

## §4 Interfaces consumed (copy verbatim)

From DP-DOMAIN-ENGINE:
```ts
import type { RingPort, RingDevice, RingStatus, RingCapabilities, RingLocation, RingConfigurations, RingHistoryItem, RingHistoryPage, RingWebhookPayload, RingWhepSession, RingSnapshot, RingClip, RingChimeResult } from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import { parseRingPayload, parseHistoryPage } from "src/domain/parse.js";
import { findWebhookGaps, pollHistory, HISTORY_OVERLAP_MS } from "src/domain/gaps.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import type { RingBundle } from "src/domain/generator.js";
import { runRingPortContract } from "./ring-port-contract.js";   // only from scripts/verify/ri-*.ts (the `src/…` alias covers src/ only)
import { createAppSession } from "src/agent/app-session.js";   // used by WU-08 only, from DP-AGENT-WORKFLOW (plan 2, already written)
import { demoSeed, DEMO_NOW_MS } from "src/domain/seed.js";
import { MIN_MS } from "src/domain/time.js";
```
From the chassis (curated index only): `import { withResilience, isDegradedResult } from "src/resilience"; import type { ResilienceConfig } from "src/resilience";`. The mock server script and the verify scripts import the mock as `../mock-ring-server.js` (from `scripts/verify/`). From Node: `node:crypto` (`createHmac`, `timingSafeEqual`), `node:http`, `node:url`.

## §5 Algorithms and literal configuration

### §5.1 Wire samples (literal content of `WIRE_SAMPLES`; shapes marked ASSUMED are confirmed or corrected by WU-01)
```json
{
  "webhookMotion": { "event_id": "evt-0001", "timestamp": "2026-10-13T09:14:05Z", "type": "motion_detected", "account_id": "acct-demo", "device_id": "dev-door",
    "attributes": { "sub_type": "human", "component_ids": [0] }, "meta": { "request_id": "req-0001", "time": "2026-10-13T09:14:06Z" } },
  "webhookButton": { "event_id": "evt-0002", "timestamp": "2026-10-13T09:20:00Z", "type": "button_press", "account_id": "acct-demo", "device_id": "dev-door",
    "attributes": { "component_ids": [0] }, "meta": { "request_id": "req-0002", "time": "2026-10-13T09:20:01Z" } },
  "webhookOffline": { "event_id": "evt-0003", "timestamp": "2026-10-15T21:05:00Z", "type": "device_offline", "account_id": "acct-demo", "device_id": "dev-elite",
    "attributes": {}, "meta": { "request_id": "req-0003", "time": "2026-10-15T21:05:02Z" } },
  "webhookFlat": { "event_type": "motion_detected", "device_id": "camera-1" },
  "devices": {
    "data": [
      { "type": "device", "id": "dev-door", "attributes": { "device_type": "doorbell", "description": "Front door", "owned": true, "subscribed": true, "component_ids": [0] },
        "relationships": { "status": { "data": { "type": "status", "id": "dev-door" } }, "capabilities": { "data": { "type": "capabilities", "id": "dev-door" } },
          "location": { "data": { "type": "location", "id": "dev-door" } }, "configurations": { "data": { "type": "configurations", "id": "dev-door" } } } },
      { "type": "device", "id": "dev-elite", "attributes": { "device_type": "elite_camera", "description": "Hall camera", "owned": true, "subscribed": true, "component_ids": [0, 1] },
        "relationships": { "status": { "data": { "type": "status", "id": "dev-elite" } }, "capabilities": { "data": { "type": "capabilities", "id": "dev-elite" } },
          "location": { "data": { "type": "location", "id": "dev-elite" } }, "configurations": { "data": { "type": "configurations", "id": "dev-elite" } } } }
    ],
    "included": [
      { "type": "status", "id": "dev-door", "attributes": { "online": true, "ac_power": false, "battery": "ok" } },
      { "type": "capabilities", "id": "dev-door", "attributes": { "motion_detection": true, "video_codecs": ["h264"], "night_vision": "auto", "chime_audio": { "supported": true, "slots": ["gentle_hello", "check_in_chime"] }, "whep": true, "snapshot": true, "components": [0] } },
      { "type": "location", "id": "dev-door", "attributes": { "country": "US", "state": "CA", "utc_offset_minutes": -420 } },
      { "type": "configurations", "id": "dev-door", "attributes": { "motion": { "zones": 2 }, "privacy": { "zones": 1 }, "chime": { "volume": 5 } } },
      { "type": "status", "id": "dev-elite", "attributes": { "online": true, "ac_power": true, "battery": "full" } },
      { "type": "capabilities", "id": "dev-elite", "attributes": { "motion_detection": true, "video_codecs": ["h264", "h265"], "night_vision": "auto", "chime_audio": { "supported": false, "slots": [] }, "whep": true, "snapshot": true, "components": [0, 1] } },
      { "type": "location", "id": "dev-elite", "attributes": { "country": "US", "state": "CA", "utc_offset_minutes": -420 } },
      { "type": "configurations", "id": "dev-elite", "attributes": { "motion": { "zones": 1 }, "privacy": { "zones": 0 } } }
    ]
  },
  "status": { "data": { "type": "status", "id": "dev-door", "attributes": { "online": "online", "ac_power": false, "battery": "low", "chime_snoozed": false } } },
  "capabilitiesElite": { "data": { "type": "capabilities", "id": "dev-elite", "attributes": { "motion_detection": true, "video_codecs": ["h264", "h265"], "night_vision": "auto", "chime_audio": false, "whep": true, "snapshot": true, "components": [0, 1] } } },
  "capabilitiesDoorbell": { "data": { "type": "capabilities", "id": "dev-door", "attributes": { "motion_detection": true, "video_codecs": ["h264"], "night_vision": "auto", "chime_audio": { "supported": true, "slots": ["gentle_hello", "check_in_chime"] }, "whep": true, "snapshot": true, "components": [0] } } },
  "location": { "data": { "type": "location", "id": "dev-door", "attributes": { "country": "US", "state": "CA" } } },
  "configurations": { "data": { "type": "configurations", "id": "dev-door", "attributes": { "motion": { "zones": 2 }, "privacy": { "zones": 1 }, "label": "porch", "enhanced": true } } },
  "history": {
    "data": [
      { "type": "event", "id": "h-3", "attributes": { "event_type": "motion.human", "start": "2026-10-13T09:14:05Z", "component_ids": [0] } },
      { "type": "event", "id": "h-2", "attributes": { "event_type": "ding", "start": "2026-10-13T09:10:00Z" } },
      { "type": "event", "id": "h-1", "attributes": { "event_type": "motion.other", "start": "2026-10-13T08:00:00Z", "component_ids": [1] } }
    ],
    "meta": { "pagination": { "limit": 50, "offset": 0, "total": 3 } }
  },
  "token": { "access_token": "access-A", "refresh_token": "refresh-B", "scope": "devices", "expires_in": 14400, "token_type": "Bearer" },
  "usersMe": { "data": { "type": "user", "id": "acct-demo", "attributes": { "name": "Demo Caretaker", "email": "u***r@partner.example.com" } } },
  "appIntegrationAwaiting": { "data": { "type": "app_integration", "id": "ai-1", "attributes": { "status": "awaiting" } } },
  "appIntegrationCompleted": { "data": { "type": "app_integration", "id": "ai-1", "attributes": { "status": "completed" } } },
  "errorUnauthorized": { "errors": [ { "status": "401", "code": "unauthorized", "title": "Unauthorized", "detail": "The access token is missing or expired." } ] },
  "errorRateLimited": { "errors": [ { "status": "429", "code": "rate_limited", "title": "Too Many Requests", "detail": "Slow down and retry after the indicated time." } ] }
}
```
`WIRE` builders: `status(id) = "/v1/devices/" + encodeURIComponent(id) + "/status"` and likewise `capabilities`, `location`, `configurations`; `history(id) = "/v1/history/devices/<id>/events"`; `whepSessions(id) = "/v1/devices/<id>/media/streaming/whep/sessions"`; `imageDownload(id) = "/v1/devices/<id>/media/image/download"`; `videoDownload(id) = "/v1/devices/<id>/media/video/download"`; `audioPlayback(id) = "/v1/devices/<id>/media/audio/playback"`; `devices = "/v1/devices"`; `deviceInclude = "status,capabilities,location,configurations"`; `usersMe = "/v1/users/me"`; `appIntegrations = "/v1/accounts/me/app-integrations"`; `signaturePrefix = "sha256="`; `RING_LIMITS = { tps: 100, webhookAckMs: 5000, nonceWindowSec: 600, whepMaxSecBattery: 30, whepMaxSecLine: 60, clipMaxSec: 30 }`.

### §5.2 Signature and webhook handler
1. `verifySignature`: if `secret` is empty or `header` is not a string → `false`. `header` must match `/^sha256=([0-9a-fA-F]{64})$/`; decode the hex to a 32-byte buffer; `expected = createHmac("sha256", secret).update(rawBody).digest()`; return `timingSafeEqual(received, expected)`. Wrap everything in `try/catch` → `false`. `signPayload` returns `"sha256=" + hmac.digest("hex")`.
2. `createWebhookHandler(deps)` returns `handler(req)`. Steps, in this order:
   a. `secret = typeof deps.secret === "function" ? deps.secret() : deps.secret`; empty → `{ status: 503, body: '{"ok":false,"error":"webhook secret not configured"}' }`.
   b. Header lookup is case-insensitive (`x-signature`). `verifySignature(req.rawBody, header, secret)` false → `{ status: 401, body: '{"ok":false,"error":"invalid signature"}' }`. **Nothing is parsed or logged before this check passes.**
   c. `JSON.parse(req.rawBody.toString("utf8"))`; failure or a non-object → `{ status: 400, body: '{"ok":false,"error":"invalid json"}' }`.
   d. `requestId = payload.meta?.request_id ?? payload.event_id`; neither a non-empty string → `{ status: 400, body: '{"ok":false,"error":"missing request id"}' }`.
   e. `seen.has(requestId)` → `{ status: 200, body: '{"ok":true,"duplicate":true}' }` (no enqueue, no publish). Otherwise `seen.add(requestId)`.
   f. Schedule the asynchronous work with `setImmediate` and keep the promise for `flush()`: `events = parseRingPayload(payload)`; `payload.type` is one of the four supported event types (parse result non-empty) → `inbox.push(sessionId, payload)`; in every case call `deps.publish?.({ requestId, type: String(payload.type ?? payload.event_type), deviceId: String(payload.device_id ?? ""), tsMs: events[0]?.tsMs ?? (deps.now ?? Date.now)(), simulated: payload.simulated === true })`. Unsupported types (device_added, app_integration_removed, subscription events) are acknowledged and published, never queued.
   g. Return `{ status: 200, body: '{"ok":true}' }` without waiting for step f. The whole handler path before returning does no I/O, so it answers in well under 5 s (target ≤ 300 ms).
   h. Any unexpected exception inside the handler → `{ status: 400, body: '{"ok":false,"error":"bad request"}' }`; the handler never throws and never echoes the body, the signature or the secret.
3. `flush()` resolves when every scheduled step f has run.

### §5.3 Inbox and seen-store
`createInbox`: `Map<string, RingWebhookPayload[]>`; `push` appends and, when the queue exceeds `maxPerSession`, drops from the front; `drain` returns the queue and replaces it with `[]`; `size`/`clear` as named. `createSeenStore(max = 5000)`: a `Set<string>` in insertion order; `add` of a new id beyond `max` deletes the first element; `add` of a known id is a no-op.

### §5.4 REST client (`createRingHttp`)
1. **URL.** `pathOrUrl` starting with `http` is used as is (session URLs from `Location`); otherwise `baseUrl + path`; `query` entries with `undefined` are dropped and the rest are encoded with `URLSearchParams` (`include=status,capabilities,location,configurations` keeps its commas, which Ring accepts unencoded; the client replaces `%2C` with `,`).
2. **Token bucket.** Capacity and refill rate `tps` per second (default 100), tracked with `now()`; before each attempt `acquire()` sleeps `ceil(1000 / tps)` ms steps until a token is free.
3. **One attempt** (`attempt(token)`): `fetch(url, { method, headers: { Authorization: "Bearer " + token, Accept: opts.accept ?? "application/json", ...(body ? { "Content-Type": opts.contentType ?? "application/json" } : {}) }, body })`; the body is `JSON.stringify(opts.json)` or `opts.body`. The response is read once as `arrayBuffer`; `text` is its UTF-8 decoding, `json` is `JSON.parse(text)` when the response content type contains `json` (else `null`; a parse failure gives `null`), `headers` are lower-cased, `bytes` the raw bytes.
4. **Classification** of `res.status`: `< 400` → return the `RingResponse`. `400` → `RingError(400,"bad_request")`; `401` and `403` → `RingError(status,"unauthorized")`; `404` → `"not_found"`; `409`, `422` → `"bad_request"`; `429` → `"rate_limited"` with `retryAfterSec` from `Retry-After` (integer seconds, or an HTTP date converted to seconds from now, minimum 1); `>= 500` → `"upstream"`. The message is `errors[0].detail ?? errors[0].title ?? "Ring returned <status>"` from the JSON:API body, passed through `redact` (§5.5). A thrown `fetch` error → `RingError(0,"network", redact(message))`.
5. **401 once.** On `401`, call `tokens.getToken({ force: true })` and retry the same request exactly once; a second `401` is thrown.
6. **429 loop.** On `429`, up to `maxRetries429` (default 3) times: wait `max(retryAfterSec·1000, backoff)` where `backoff = 1000 · 2^n` ms (n = 0, 1, 2) with ±25 % jitter, then retry; after the last retry throw the `rate_limited` error carrying `retryAfterSec`.
7. **Resilience.** The attempt sequence runs inside `withResilience(primary, { timeout_ms: 15000, retries: 1, backoff: { base_ms: 300 }, fallback_chain: { order: ["none"] }, ...opts.resilience })`. `primary` returns `{ ok: true, res }` or `{ ok: false, error }` for client-side errors (400, 401, 403, 404, 409, 422, 429 after the loop) so they are not retried by the wrapper, and **throws** for network failures and `>= 500` so the wrapper retries once. After the wrapper: `isDegradedResult(r)` → throw `RingError(0, "network" , r.original_error ?? "Ring request failed")` (or the last `upstream` error when the original error text starts with `Ring returned 5`); `{ ok:false }` → throw its error; `{ ok:true }` → return `res`.
8. Helpers: `get(path, query)` = `request("GET", path, { query })`; `post(path, json, opts)`; `patch(path, json)`; `del(pathOrUrl)`.

### §5.5 Token provider (`createTokenProvider`)
Resolution order on each `getToken()`:
1. A playground token set by `setPlaygroundToken(token, ttlSec = 1800)` that has not expired (`now() < expiresAt`) → return it; `status()` = `{ source: "playground", expiresInSec: ceil((expiresAt − now()) / 1000) }`.
2. `env.RING_ACCESS_TOKEN` non-empty → return it; `status()` = `{ source: "env_access", expiresInSec: null }`. When `getToken({ force: true })` is called (a 401 happened) this source is skipped and the provider continues to step 3.
3. `env.RING_REFRESH_TOKEN`, `env.RING_CLIENT_ID` and `env.RING_CLIENT_SECRET` all present → refresh flow: a cached access token that is valid for more than `refreshSkewSec` seconds is returned; otherwise `POST oauthUrl` with `Content-Type: application/x-www-form-urlencoded` and a body built with `URLSearchParams({ grant_type: "refresh_token", refresh_token, client_id, client_secret })`. Success parses `{ access_token, refresh_token?, expires_in }`: the new access token is cached until `now() + expires_in·1000`, and a returned `refresh_token` replaces the one in memory (the rotated token is never written to disk and never logged). Concurrent callers share one in-flight promise. Failure → `RingError(status, "unauthorized", "Ring did not accept the refresh token.")` (the response body is never included). `status()` = `{ source: "refresh", expiresInSec }`.
4. Nothing available → `RingError(401, "unauthorized", "No Ring credentials. Paste a Playground token or set RING_REFRESH_TOKEN.")`; `status()` = `{ source: "none", expiresInSec: null }`.
`redact(text)` replaces `Bearer\s+\S+`, `(access_token|refresh_token|client_secret|token)["'=:\s]+[^\s&"',}]+` and any exact current token value with `[redacted]`; every error message produced in this plan goes through it. Tokens never appear in logs, errors, SSE payloads or files.

### §5.6 `LiveRingPort` — mapping and behaviour (all readers tolerant: a missing field gets the default shown)
- **`listDevices`**: `http.get(WIRE.devices, { include: WIRE.deviceInclude })`. For each `data[i]`: `id`; `kind = attributes.device_type ?? attributes.type ?? item.type`; `description = attributes.description ?? attributes.name ?? id`; `owned`/`subscribed` default `true`; `componentIds = attributes.component_ids ?? capabilities.components ?? [0]`. Included resources are indexed by `type + ":" + id`; `status`, `capabilities`, `location`, `configurations` come from the item's `relationships.<name>.data` reference, else from the `included` entry with the same `id` and `type`. Missing status → `{ online: true, acPower: false, battery: "unknown" }`; missing capabilities → all `false`, `components` = `componentIds`; missing location/configurations → `null`.
- **Status mapping**: `online` = `true` when `attributes.online` is `true` or the string `"online"`; `acPower = attributes.ac_power === true`; `battery` ∈ `full|ok|low` when the string matches, else `unknown`; `chimeSnoozed = attributes.chime_snoozed`.
- **Capabilities mapping**: `motionDetection = attributes.motion_detection === true`; `videoCodecs = attributes.video_codecs ?? []`; `nightVision = String(attributes.night_vision ?? "unknown")`; `chimeAudio` = `chime_audio === true` or `chime_audio.supported === true`; `chimeAudioSlots = chime_audio.slots ?? attributes.chime_audio_slots ?? []`; `whep`, `snapshot` booleans; `components = attributes.components ?? [0]`.
- **`getStatus` / `getCapabilities(id, componentId?)` / `getLocation` / `getConfigurations`**: `GET WIRE.<name>(id)`; `getCapabilities` adds `component_id` when given; the body's `data.attributes` is mapped as above. `getLocation` → `{ name: [state, country].filter(Boolean).join(", ") || "unknown", utcOffsetMin: Number(attributes.utc_offset_minutes ?? 0) }`. `getConfigurations` flattens nested objects to dotted keys (`motion.zones`), arrays to JSON strings.
- **`getEventHistory(id, { limit, offset, type })`**: `GET WIRE.history(id)` with `limit`, `offset` and, when `type` is given, `event_types` = `motion` for `motion_detected`, `ding` for `button_press`, `online` / `offline` for the connectivity types. Each `data[]` item maps to `RingHistoryItem { id, eventType: attributes.event_type, timestamp: attributes.start ?? attributes.timestamp, subType: event_type ends with ".human" || attributes.sub_type === "human" ? "human" : undefined, componentIds: attributes.component_ids ?? [0] }`; items are sorted newest first; `total = meta.pagination.total ?? offset + items.length`.
- **`drainWebhookInbox`**: `inbox.drain(sessionId ?? "default")`.
- **`startWhep(id, sdpOffer, componentId?)`**: `status = await getStatus(id)` (failure → treated as battery); `maxSeconds = status.acPower ? 60 : 30`; `http.post(WIRE.whepSessions(id), undefined, { body: sdpOffer, contentType: "application/sdp", accept: "application/sdp", query: componentId === undefined ? undefined : { component_id: componentId } })` — the `post` helper accepts `body` through its `opts`. Status `200` or `201` expected; `answerSdp = res.text`; `sessionUri` = `Location` header resolved against `baseUrl`; `sessionId` = last path segment of `sessionUri`; the pair is remembered in `sessions: Map`. Returns `{ sessionId, answerSdp, sessionUri, expiresInSec: maxSeconds, maxSeconds }`. A response without a `Location` header is a `RingError(502, "upstream", "Ring did not return a session address.")`.
- **`stopWhep(id, sessionId)`**: `del(sessions.get(sessionId) ?? WIRE.whepSessions(id) + "/" + sessionId)`; a `404` means already closed and is swallowed; the map entry is removed. **`openSessions()`** lists remembered ids; **`closeAll()`** stops all of them (auto-close discipline).
- **`getSnapshot(id, componentId = 0)`**: `post(WIRE.imageDownload(id), { format: "jpeg", components: [componentId] }, { accept: "image/jpeg, image/png, application/json" })` (assumed body; WU-01 may change it in `wire.ts` notes). When the response `content-type` starts with `image/` → `dataBase64 = base64(bytes)`, `contentType` from the header; when it is JSON with a base64 string at `data.attributes.image` or `data.attributes.content` → use that and `contentType = attributes.content_type ?? "image/jpeg"`. Returns `{ contentType, dataBase64, capturedAtMs: now(), componentId, synthetic: false }`. Anything else → `RingError(502, "upstream", "Ring returned no image.")`.
- **`getClip(id, { startMs, endMs, componentId })`**: `endMs − startMs` over `clipMaxSec` (30 s) or not positive → `RingError(400, "bad_request", "A clip can be at most 30 seconds.")` **before any request**; else `post(WIRE.videoDownload(id), { start: iso(startMs), end: iso(endMs), components: [componentId ?? 0] }, { accept: "video/mp4, application/json" })`; bytes → base64 → `{ contentType: "video/mp4", dataBase64, durationSec: (endMs − startMs) / 1000, synthetic: false }`.
- **`playChime(id, audioRef)`**: `caps = capabilityCache.get(id)` (valid 60 s) else `getCapabilities(id)`; `!caps.chimeAudio` → `RingError(400, "unsupported", "This device cannot play audio.")` with no POST; else `post(WIRE.audioPlayback(id), { audio_ref: audioRef })`; success (`200`, `202`, `204`) → `{ ok: true, audioRef, deviceId: id, simulated: false }`.
- `mode` is `"live"`. Unknown device (`404`) surfaces as `RingError(404, "not_found")`.

### §5.7 Account linking
`nonceTime(nowMs) = Math.floor(nowMs / 1000)`. `makeNonce(key, accountId, nowMs = Date.now())` = base64url (RFC 4648 §5, `=` stripped) of `createHmac("sha256", key).update(nonceTime + ":" + accountId).digest()`. `verifyNonce(key, accountId, time, nonce, nowMs = Date.now())`: `Math.abs(nonceTime(nowMs) − time) <= 600` and `timingSafeEqual` of the decoded buffers (different lengths → `false`; never throws). `maskIdentifier("user@partner.example.com")` = first character + `***` + last character of the local part + `@` + domain (`u***r@partner.example.com`); a string without `@` becomes first + `***` + last. `getUserMe` → `GET WIRE.usersMe` → `{ accountId: data.id ?? data.attributes.account_id, name: data.attributes.name }`. `confirmLink` → `POST WIRE.appIntegrations` with `{ account_identifier, nonce }` → `{ status: data.attributes.status ?? "awaiting", accountIdentifier: maskIdentifier(...) }`. `completeLink` → `PATCH WIRE.appIntegrations` with `{ status: "completed" }` → `{ status }`. The PATCH is mandatory in Ring's flow and is easy to forget; the E2E scenario S-RING-9 asserts both calls happened. Linking is only ever run against a staging user.

### §5.8 Contract server routes (`createMockRingServer`; simulated, built on `node:http`)
| Request | Behaviour |
|---|---|
| any `/v1/*` without a valid bearer | `401` with `WIRE_SAMPLES.errorUnauthorized` |
| `GET /v1/devices` | JSON:API built from `bundle.devices` (inverse of §5.6 mapping; `include` honoured) |
| `GET /v1/devices/{id}/status`, `/capabilities[?component_id]`, `/location`, `/configurations` | built from the bundle device; unknown id → `404` JSON:API error |
| `GET /v1/history/devices/{id}/events?limit&offset&event_types` | `bundle.history[id][page]` re-mapped to wire items (`motion_detected` + human → `motion.human`, `button_press` → `ding`, connectivity types as `device_online` / `device_offline`), `meta.pagination` |
| `POST /v1/devices/{id}/media/streaming/whep/sessions` | requires `Content-Type: application/sdp`; `201`, body `v=0 SIMULATED`, `Location: <url>/v1/devices/{id}/media/streaming/whep/sessions/sess-<n>`; `DELETE` that URL → `204`, a second `DELETE` → `404` |
| `POST /v1/devices/{id}/media/image/download` | `200 image/jpeg` with the bundle snapshot bytes for the requested component |
| `POST /v1/devices/{id}/media/video/download` | `200 video/mp4` with a small fixed byte string |
| `POST /v1/devices/{id}/media/audio/playback` | `202` when the device supports chime audio, else `400` JSON:API error |
| `GET /v1/users/me` | `WIRE_SAMPLES.usersMe` |
| `POST /v1/accounts/me/app-integrations` | `{ account_identifier, nonce }` required → `200 awaiting`; `PATCH` after a POST → `200 completed`; `PATCH` before any POST → `409` |
| `POST /oauth/token` (form) | `refresh_token` + client id/secret must match the options, else `401`; replies with a fresh access token and a rotated refresh token |
| `emitWebhook(...)` | builds a payload like `WIRE_SAMPLES.webhookMotion`, adds `"simulated": true`, signs it with `signPayload(raw, webhookSecret)` and `POST`s it to `webhookTarget` |
`rateLimitPerSec`: the (n+1)th request inside one second gets `429` with `Retry-After: 1` and the sample rate-limit body. `failNext(status, retryAfterSec?)` makes exactly the next request fail. Every response has `x-simulated: true`. The server logs nothing that contains a token or a signature.

## §6 Failure modes
| Failure | What the code does | What the person sees |
|---|---|---|
| No credential | `getToken` throws `RingError(401)` with the paste-a-token message | the connect panel offers the sample week instead (DP-UI) |
| Playground token expires | next call gets `401`, one forced refresh finds nothing, `RingError(401)` | countdown chip reads "expired"; bundle mode stays |
| `429` | wait for `Retry-After` or backoff, up to 3 retries, then `rate_limited` | the call returns late, or a banner names the limit |
| Ring `5xx` or network error | one retry through `withResilience`, then `upstream` / `network` | the Ring status chip turns "unreachable"; bundle mode available |
| Bad webhook signature | `401`, nothing parsed or queued | none (a count of rejected deliveries appears in `/api/status`) |
| Repeated webhook delivery | `200` with `duplicate:true`, nothing queued twice | none |
| Unknown webhook type | acknowledged and published, never queued | the inbox pill ignores it |
| WHEP answer without `Location` | `RingError(502)` and no session remembered | "Live view could not start" with the message |
| Snapshot or clip refused | `RingError`, the incident opens without media | "no snapshot" with the reason |
| Chime on a device without audio | refused locally, no request sent | the refusal sentence |

## §7 Work units

Every verify script is `scripts/verify/ri-NN-<name>.ts`, run as `npx vite-node scripts/verify/<file>`, with the same conventions as the other plans: numbered checks, local `assert`, and a final line `<file stem>: N checks OK`. Stubs implement `fetch` with a scripted queue of `{ status, headers, body }` and a fake clock and `sleep` that record calls.

### WU-RING-INTEGRATION-01 — re-verify the wire shapes; wire constants; signature
- **Goal:** the published documentation and the organizer's sample agree with §0/§5.1, or the differences are recorded; `verifySignature` and `signPayload` exist.
- **Steps:**
  1. With WebFetch, read `https://developer.amazon.com/docs/ring/api-documentation.html` (sections: notifications/webhooks, event history, device discovery, status, capabilities, WHEP, image snapshots, media clips, chimes, account linking, users) and the organizer's sample `https://github.com/AmazonAppDev/ring-api-helloworld` (its `scripts/*.py` and `app/api/**/route.ts`). For each item in §0 and each ASSUMED shape in §5.1 write one line in a scratch note: *confirmed*, or *differs: <what the page shows>*.
  2. Create `design_documents/friction-log.md` with the header `# Friction log — Ring integration` and the entry format below. Append an entry **only** for a problem actually met (a page that omits a body, a field name that differs, an error message that does not say what to change). If every shape was confirmed and nothing was hard, append no entry.
  3. Write `src/ring/wire.ts` (§3.1, §5.1), changing a sample or a builder wherever step 1 found a difference, and add a comment block `// WIRE NOTES (WU-01): …` listing the differences.
  4. Write `src/ring/signature.ts` (§3.2, §5.2.1).
  5. Write `scripts/verify/ri-01-signature.ts`.
  Entry format (each field on its own line): `## FL-<n> <short title>` · `Date:` · `Severity: low|medium|high` · `Where:` (endpoint or page) · `What happened:` · `Workaround:`.
- **Files:** `design_documents/friction-log.md`, `src/ring/wire.ts`, `src/ring/signature.ts`, `scripts/verify/ri-01-signature.ts`.
- **Checks (14):**
  1. `verifySignature(Buffer, signPayload(...))` is true for a Buffer body.
  2. True for a string body.
  3. False for a different secret.
  4. False when one byte of the body changes.
  5. False when the header is `undefined`.
  6. False when the header lacks the `sha256=` prefix.
  7. True when the hex digits are upper-cased.
  8. False when the hex is 63 or 65 characters long.
  9. False for an empty secret.
  10. Does not throw for `verifySignature("x", {} as any, "s")` (returns false).
  11. The source of `signature.ts` calls `timingSafeEqual` and contains no `===` or `==` comparison of two digests.
  12. `WIRE.whepSessions("a b")` equals `/v1/devices/a%20b/media/streaming/whep/sessions` and `WIRE.history("dev-door")` equals `/v1/history/devices/dev-door/events`.
  13. `parseRingPayload(WIRE_SAMPLES.webhookMotion)` returns one event of type `motion_detected` with `subType: "human"` and id `evt:req-0001`.
  14. `parseRingPayload(WIRE_SAMPLES.webhookFlat)` returns one `motion_detected` event for `camera-1` (the organizer's flat shape).
- **Verify:** `npx vite-node scripts/verify/ri-01-signature.ts`
- **Expected output:** `ri-01-signature: 14 checks OK`
- **Proves:** the signature gate is constant-time and strict, and the wire facts the rest of the plan relies on are written down in one file.

### WU-RING-INTEGRATION-02 — inbox, idempotency, webhook handler
- **Goal:** `createInbox`, `createSeenStore`, `createWebhookHandler` per §5.2–§5.3.
- **Steps:** write `src/ring/inbox.ts`, `src/ring/webhook.ts`; write the verify script (it signs bodies with `signPayload` and a fixed test secret defined inside the script).
- **Files:** `src/ring/inbox.ts`, `src/ring/webhook.ts`, `scripts/verify/ri-02-webhook.ts`.
- **Checks (15):**
  1. A correctly signed `webhookMotion` returns `status 200` and body `{"ok":true}` in under 50 ms of wall time, and after `flush()` the default inbox has size 1.
  2. The same request id again returns `200` with `"duplicate":true` and the inbox still has size 1.
  3. A wrong signature returns `401`, the inbox is unchanged and `publish` was not called.
  4. A missing signature header returns `401`.
  5. A valid signature over invalid JSON returns `400`.
  6. A payload with neither `meta.request_id` nor `event_id` returns `400`.
  7. A signed `device_added` payload returns `200`, the inbox is unchanged and `publish` was called once.
  8. A signed `app_integration_removed` payload returns `200` and `publish` received `type: "app_integration_removed"`.
  9. The object passed to `publish` has exactly the keys `requestId, type, deviceId, tsMs, simulated`.
  10. Queues are per session: after `push("s1", a)` and `push("default", b)`, `drain("s1")` returns `[a]`, `drain("default")` returns `[b]`, and a second drain of either returns `[]`.
  11. With `maxPerSession: 500`, pushing 501 payloads keeps the newest 500 (the first one is gone).
  12. A handler whose secret function returns `undefined` answers `503` with a body containing `webhook secret not configured`.
  13. No response body in this script contains the test secret.
  14. A seen-store with `max: 3` accepts a fourth id and then reports the first id as unknown again.
  15. A non-UTF-8 `Buffer` body with a valid signature returns `400` and the handler does not throw.
- **Verify:** `npx vite-node scripts/verify/ri-02-webhook.ts`
- **Expected output:** `ri-02-webhook: 15 checks OK`
- **Proves:** the receiver verifies before parsing, answers fast, is idempotent and never leaks the secret.

### WU-RING-INTEGRATION-03 — token provider and REST client
- **Goal:** `createTokenProvider` and `createRingHttp` per §5.4–§5.5.
- **Steps:** write `src/ring/oauth.ts` and `src/ring/client.ts`; write the verify script with a stub `fetch`, fake clock and recording `sleep`.
- **Files:** `src/ring/oauth.ts`, `src/ring/client.ts`, `scripts/verify/ri-03-client.ts`.
- **Checks (20):**
  1. A playground token set with the default ttl is returned first and `status()` is `{ source: "playground", expiresInSec: 1800 }` at the moment it is set.
  2. After the clock passes its expiry, the env access token is returned (`source: "env_access"`).
  3. With no credentials `getToken()` rejects with a `RingError` of status 401 whose message contains `Paste a Playground token`.
  4. The refresh flow posts a form body containing `grant_type=refresh_token`, the refresh token, the client id and the client secret to the OAuth URL, and returns `access-A`.
  5. A second `getToken()` does not call `fetch` again.
  6. After the clock moves past `expires_in − 300` seconds, a new refresh request is made.
  7. The rotated refresh token from the first reply is used in the second request.
  8. Two concurrent `getToken()` calls produce exactly one refresh request.
  9. When the refresh endpoint answers `400` with a body that echoes the client secret, the thrown message does not contain the secret.
  10. `forget()` drops the playground token (`getToken` then falls through to the next source).
  11. `get("/v1/devices", { include: "a,b" })` sends `Authorization: Bearer <token>` and the URL ends with `?include=a,b` (commas unencoded).
  12. A `429` with `Retry-After: 1` makes the client sleep at least 1000 ms and then succeed.
  13. Four consecutive `429` replies end in a `RingError` with code `rate_limited` and `retryAfterSec` 1 after exactly 3 retries.
  14. Without `Retry-After` the recorded sleeps are within ±25 % of 1000, 2000 and 4000 ms.
  15. A `401` triggers one `getToken({ force: true })` and exactly one retry; a second `401` throws `unauthorized`.
  16. A JSON:API error body gives the `RingError` message `errors[0].detail`.
  17. `404` → `not_found`, `400` → `bad_request`; `500` → `upstream` after exactly 2 `fetch` calls (one wrapper retry).
  18. A rejected `fetch` → code `network` (status 0).
  19. 150 calls with `tps: 100` and the fake clock record at least 500 ms of total sleep.
  20. With `resilience: { forced_degraded: true }`, `request` rejects with code `network` and `fetch` is never called; a `200` with `Content-Type: application/sdp` returns `json: null`, the SDP in `text`, and a lower-cased `location` header.
- **Verify:** `npx vite-node scripts/verify/ri-03-client.ts`
- **Expected output:** `ri-03-client: 20 checks OK`
- **Proves:** credentials are layered, tokens never leak, 429 is respected and every request is inside `withResilience`.

### WU-RING-INTEGRATION-04 — `LiveRingPort`: devices, status, capabilities, location, configurations, history, inbox
- **Goal:** the read side of `createLiveRingPort` per §5.6.
- **Steps:** write `src/ring/live-ring-port.ts` (read methods; the media methods throw `RingError(0,"unsupported","not yet")` until WU-05); write `scripts/probe-ring.ts` (optional live probe: with `RING_ACCESS_TOKEN` or the refresh trio it lists devices, reads status and one history page and prints `ring-live: devices=<n> statusOk=<true|false> history=<n>`, or `ring-live: skipped (no credentials)`); write the verify script using `WIRE_SAMPLES` through the stub `fetch`.
- **Files:** `src/ring/live-ring-port.ts`, `scripts/probe-ring.ts`, `scripts/verify/ri-04-live-port.ts`.
- **Checks (15):**
  1. `listDevices` over `WIRE_SAMPLES.devices` returns 2 devices with ids `dev-door` and `dev-elite`.
  2. The request query is exactly `include=status,capabilities,location,configurations`.
  3. `dev-elite.componentIds` is `[0, 1]` and `dev-door.capabilities.chimeAudio` is true with slots `gentle_hello` and `check_in_chime`; `dev-elite.capabilities.chimeAudio` is false.
  4. `dev-door.status` is `{ online: true, acPower: false, battery: "ok" }`.
  5. `getStatus` of `WIRE_SAMPLES.status` maps `online: "online"` to `true` and `battery: "low"`.
  6. `getCapabilities("dev-elite", 1)` requests `component_id=1`.
  7. `getLocation` returns a `name` of `CA, US`.
  8. `getConfigurations` returns `motion.zones: 2`, `privacy.zones: 1`, `label: "porch"`, `enhanced: true`.
  9. `getEventHistory("dev-door", { limit: 50, offset: 0 })` returns 3 items newest first with `timestamp` taken from `attributes.start`, and `total` 3.
  10. `{ type: "button_press" }` adds `event_types=ding` to the query.
  11. `parseHistoryPage(page.items, "dev-door")` yields a `motion_detected` event with `subType: "human"` for `h-3` and a `button_press` for `h-2`.
  12. `drainWebhookInbox` returns the pushed payloads and empties the queue.
  13. A `404` from Ring surfaces as `RingError` with code `not_found`.
  14. A `401` surfaces as code `unauthorized`.
  15. `mode` is `"live"`, and an empty `data: []` history response returns an empty page without throwing.
- **Verify:** `npx vite-node scripts/verify/ri-04-live-port.ts`
- **Expected output:** `ri-04-live-port: 15 checks OK`
- **Proves:** Ring's JSON:API is mapped into the domain port types with tolerant readers, and component addressing works.

### WU-RING-INTEGRATION-05 — live video, snapshot, clip, chime
- **Goal:** the media half of `createLiveRingPort` per §5.6.
- **Steps:** extend `src/ring/live-ring-port.ts`; write the verify script with a stub `fetch`.
- **Files:** `src/ring/live-ring-port.ts` (completed), `scripts/verify/ri-05-media.ts`.
- **Checks (14):**
  1. `startWhep` posts `Content-Type: application/sdp` with the offer text as the body and returns the SDP answer in `answerSdp`.
  2. The returned `sessionUri` is the absolute `Location` and `sessionId` is its last path segment.
  3. `maxSeconds` is 30 for a battery device (`acPower: false`) and 60 for a line-powered one.
  4. `startWhep(…, 1)` adds `component_id=1` to the request.
  5. `stopWhep` sends `DELETE` to the remembered `sessionUri`.
  6. A `404` on `DELETE` resolves without throwing.
  7. `stopWhep` of an unknown session id deletes `…/whep/sessions/<id>`.
  8. A response without `Location` rejects with `RingError` status 502.
  9. `getSnapshot("dev-elite", 1)` posts `{ format: "jpeg", components: [1] }` and an `image/jpeg` reply becomes base64 equal to the stub bytes.
  10. A JSON reply carrying a base64 string at `data.attributes.image` also works.
  11. `getClip` with a 31 s range rejects with `bad_request` and `fetch` was not called; a 20 s range posts ISO start/end and returns `durationSec: 20`.
  12. `playChime("dev-door", "gentle_hello")` posts `{ "audio_ref": "gentle_hello" }` and returns `{ ok: true, simulated: false }`.
  13. `playChime("dev-elite", …)` rejects with code `unsupported` and no POST was made.
  14. After two `startWhep` calls, `openSessions()` has 2 ids and `closeAll()` sends 2 `DELETE` requests and empties it; capability data is cached (a second `playChime` within 60 s of fake time makes no capabilities request).
- **Verify:** `npx vite-node scripts/verify/ri-05-media.ts`
- **Expected output:** `ri-05-media: 14 checks OK`
- **Proves:** live sessions are always closable, evidence calls are bounded, and the chime is capability-gated before any request leaves.

### WU-RING-INTEGRATION-06 — account linking
- **Goal:** `src/ring/linking.ts` per §5.7.
- **Steps:** write the file; write the verify script (stub `fetch`; the independent HMAC expectation is computed inside the script with `node:crypto`).
- **Files:** `src/ring/linking.ts`, `scripts/verify/ri-06-linking.ts`.
- **Checks (11):**
  1. `makeNonce("k", "acct-demo", 1_760_000_000_000)` equals an independently computed base64url HMAC of `1760000000:acct-demo`.
  2. The nonce contains no `=`, `+` or `/`.
  3. `nonceTime(1_760_000_000_999)` is 1760000000.
  4. `verifyNonce` is true 599 s later.
  5. `verifyNonce` is false 601 s later.
  6. `verifyNonce` is false for a different account id.
  7. `verifyNonce` is false (and does not throw) for a nonce of a different length.
  8. `getUserMe` maps `data.id` to `accountId` and `attributes.name` to `name`.
  9. `confirmLink` sends `POST /v1/accounts/me/app-integrations` with `{ account_identifier, nonce }` and returns `status: "awaiting"` and a masked identifier.
  10. `completeLink` sends `PATCH` with `{ "status": "completed" }` and returns `completed`.
  11. `maskIdentifier("user@partner.example.com")` is `u***r@partner.example.com`, and a `409` reply to `completeLink` surfaces as a `RingError` with code `bad_request`.
- **Verify:** `npx vite-node scripts/verify/ri-06-linking.ts`
- **Expected output:** `ri-06-linking: 11 checks OK`
- **Proves:** the nonce is correct and time-bound, and both mandatory linking calls are made.

### WU-RING-INTEGRATION-07 — the contract server and the provider-consumer contract test
- **Goal:** `createMockRingServer` per §5.8; `LiveRingPort` over it passes the domain's port contract and matches the bundle port.
- **Steps:** write `scripts/mock-ring-server.ts` (builds wire JSON from the bundle; the inverse of §5.6); write the verify script.
- **Files:** `scripts/mock-ring-server.ts`, `scripts/verify/ri-07-mock.ts`.
- **Checks (14):**
  1. The server starts on an ephemeral port and `GET /v1/devices` without a token returns `401` with the sample error body.
  2. With the bearer `mock-access-token` it returns a JSON:API document with `data` and `included`.
  3. `runRingPortContract(createLiveRingPort(...))` over the server reports zero failures.
  4. The OAuth endpoint issues an access token for the right refresh token and client credentials and rotates the refresh token; a wrong secret gets `401`.
  5. With `rateLimitPerSec: 5`, a burst of 8 requests produces at least one `429` and the real client still completes all 8.
  6. `emitWebhook` posts a payload signed with `signPayload` to a handler served by `createWebhookHandler` on a second local server, and the inbox receives it.
  7. WHEP: `POST` returns `201` with a `Location`; `DELETE` returns `204`; a second `DELETE` returns `404`.
  8. The snapshot reply has `content-type: image/jpeg` and its bytes equal the bundle snapshot for the requested component.
  9. Chime returns `202` for `dev-door` and `400` for `dev-elite`.
  10. Linking: `POST` then `PATCH` succeed; `PATCH` first returns `409`.
  11. Every response carries `x-simulated: true`.
  12. `close()` frees the port: a new server can listen on the same port.
  13. `failNext(503)` produces exactly one `503` and then normal answers.
  14. Parity: `listDevices()` through the live port equals `createBundleRingPort().listDevices()` on ids, component ids and capability flags, and `getEventHistory("dev-door", { limit: 50, offset: 0 })` equals the bundle port's page on item ids and timestamps.
- **Verify:** `npx vite-node scripts/verify/ri-07-mock.ts`
- **Expected output:** `ri-07-mock: 14 checks OK`
- **Proves:** the live client and the bundle agree on the same story, so every later test can run against the simulated Ring and the demo can run against the real one.

### WU-RING-INTEGRATION-08 — history failover over the live port; friction-log check
- **Goal:** the domain's `findWebhookGaps` and `pollHistory` work over `LiveRingPort`; the friction log is well-formed.
- **Steps:** write `scripts/verify/ri-08-history.ts` (no new product file); the script starts the mock server (with a `rateLimitPerSec` low enough to hit one `429` during paging), builds `createLiveRingPort`, and builds a session with `createAppSession({ initial: demoSeed(), ring: livePort })`.
- **Files:** `scripts/verify/ri-08-history.ts`, `design_documents/friction-log.md` (final tidy).
- **Checks (9):**
  1. `pollHistory(live, "dev-door", since)` returns the same event ids as `pollHistory(bundlePort, "dev-door", since)`.
  2. After the webhook inbox (drained from the live port) and that history are ingested with `ingest_events`, `findWebhookGaps(model, "dev-door", DEMO_NOW_MS)` returns one interval.
  3. The same flow leaves exactly one duplicate cluster (the seeded overlap).
  4. Paging stops once a page's oldest item is older than `since` (the number of `getEventHistory` requests seen by the mock equals the expected page count).
  5. A history call for an unknown device rejects with `RingError` code `not_found`.
  6. A `429` during paging is waited out and `pollHistory` still returns the full set.
  7. `ingest_ring_events({ source: "history", deviceId: "dev-door" })` through the registry over the live port adds the same number of events as with the bundle port.
  8. `design_documents/friction-log.md` exists and every `## FL-` heading is followed by `Date:`, `Severity:`, `Where:`, `What happened:` and `Workaround:` lines (vacuously true when there are no entries).
  9. `grep`-style scan of `src/ring/*.ts` and `scripts/mock-ring-server.ts` finds no `console.log(` of a variable named `token`, `secret` or `authorization` and no hardcoded bearer string longer than 20 characters.
- **Verify:** `npx vite-node scripts/verify/ri-08-history.ts`
- **Expected output:** `ri-08-history: 9 checks OK`
- **Proves:** webhook loss is recoverable through history on the real client path, and the integration leaks nothing.

## §8 Verification summary
| WU | Command | Expected |
|---|---|---|
| 01 | `npx vite-node scripts/verify/ri-01-signature.ts` | `ri-01-signature: 14 checks OK` |
| 02 | `npx vite-node scripts/verify/ri-02-webhook.ts` | `ri-02-webhook: 15 checks OK` |
| 03 | `npx vite-node scripts/verify/ri-03-client.ts` | `ri-03-client: 20 checks OK` |
| 04 | `npx vite-node scripts/verify/ri-04-live-port.ts` | `ri-04-live-port: 15 checks OK` |
| 05 | `npx vite-node scripts/verify/ri-05-media.ts` | `ri-05-media: 14 checks OK` |
| 06 | `npx vite-node scripts/verify/ri-06-linking.ts` | `ri-06-linking: 11 checks OK` |
| 07 | `npx vite-node scripts/verify/ri-07-mock.ts` | `ri-07-mock: 14 checks OK` |
| 08 | `npx vite-node scripts/verify/ri-08-history.ts` | `ri-08-history: 9 checks OK` |
If a count differs because a check was split or merged while writing a script, change the number in the unit and in this table in the same edit.

## §9 Risks
- **Documentation shapes differ from the assumed ones.** Mitigation: WU-01; every reader is tolerant; `wire.ts` is the only place to edit; differences go to the friction log, which also earns the friction-log bonus.
- **Playground token lasts about 30 minutes.** Mitigation: the token provider reports its remaining time; the bundle week is the default for judges.
- **Webhooks cannot reach the deployed URL.** Mitigation: signed, `SIMULATED`-labelled deliveries through the same handler; history polling is the real failover.
- **A real snapshot or clip request body is rejected.** Mitigation: the incident opens without media; the body lives in `getSnapshot` / `getClip` and is adjusted from the friction-log finding.
- **Rate limits during demos.** Mitigation: token bucket at 100 TPS, `Retry-After` honoured, bounded retries.
- **Secrets in logs.** Mitigation: `redact` on every message; WU-08 scans for logging of token-like variables.
