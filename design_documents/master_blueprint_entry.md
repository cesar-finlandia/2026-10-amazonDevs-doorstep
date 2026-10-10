# Master Blueprint — Doorstep Rhythm (entry `2026-10-amazonDevs`)

> **Product.** *Doorstep Rhythm* — a caretaking companion for the solo-living doorway. It turns Ring doorway events into a calm household-rhythm timeline, learns what a normal week looks like for one house, and runs a multi-round agent over the moments that break the rhythm — explained in family language, with a human approving every outbound nudge.
> **Slogan (final, identical everywhere — header, cover, both slides, spoken close):** `Know her day without calling.`
> **Event.** Build, Ship, Shape: Amazon Developer Hackathon (Devpost). Primary track: **Ring**. Mini-challenge: **AWS Builder**. Hard deadline: 2026-10-23 12:00 PDT. Video cap: "under 3 minutes" = 180 s (`event_profile.json` → `video_limits.max_seconds`); our target is **120–150 s**, ceiling `min(180 − 5, 165) = 165 s`.
> **Persona (from `../../hackathons/hackathon-projects/2026-10-amazonDevs/personas.json`, `persona-01`):** *Long-distance daughter watching solo-living mum.* Grounded in `mined_frustrations.json` records `frust-0001` (r/AgingParents, 2026-08) and `frust-0002` (r/AgingParents, 2026-09).
> **Goal of this blueprint:** maximise the probability of winning the grand prize AND at least one side-track prize (Ring track + AWS Builder mini-challenge on one codebase).

How to read this file: §1 requirements, §2 architecture and the inter-module contract table, §3 the design-plan map, §3a the boundary rule, §4 submission mapping, §5 risks and the degraded-demo ladder, §6 reconciliation notes (every place the sources disagreed and which side won). Each design plan under `design_documents/design_plans/` is self-contained: an implementor opens one plan and the code it names, never this file.

---

## §0 Compliance extract (disqualification-level — copied from the brief, never invented)

**Mandatory technology (brief §4, verbatim intent):** "Ring: working app or new feature using any Ring API/SDK/simulator/device; demoed via simulator or real device; no physical device required." The repository must show **runtime use of Ring APIs/SDKs "imported and actually called — library import, app/backend entry point, or loaded agent/flow config — not just README mention"**.

| Mandatory item | Exact surface this entry calls (names/methods as published) | Where it is proven |
|---|---|---|
| Ring REST base | `https://api.amazonvision.com` (`/v1/devices`, `/v1/devices/{id}/status`, `/capabilities`, `/location`, `/configurations`, `/v1/history/devices/{id}/events`, `/v1/users/me`) | DP-RING-INTEGRATION WUs, DP-E2E mandatory-technology scenario |
| Ring OAuth | `POST https://oauth.ring.com/oauth/token` (`grant_type=refresh_token`, auth-code grant) | DP-RING-INTEGRATION |
| Webhooks | HTTPS `POST` JSON, `X-Signature: sha256=<hex>` HMAC-SHA256, respond `200` within 5 s, idempotent on `meta.request_id` | DP-RING-INTEGRATION, DP-API-TRANSPORT route `POST /webhooks/ring` |
| Live video | WHEP `POST /v1/devices/{id}/media/streaming/whep/sessions` (SDP offer, `201` with `answer_sdp`), `DELETE` closes | DP-RING-INTEGRATION + DP-UI video panel |
| Snapshot / clip | `POST …/media/image/download`, `POST …/media/video/download` | DP-RING-INTEGRATION |
| Chime | `POST …/media/audio/playback` with `audio_ref` | DP-RING-INTEGRATION, approval-gated |
| Account linking | nonce `base64url-nopad(HMAC-SHA256(key, "time:account_id"))`, 600 s window, `POST`+`PATCH /v1/accounts/me/app-integrations` | DP-RING-INTEGRATION |
| Runtime LLM (AWS Builder) | Amazon Bedrock via the Strands Agents SDK (`@strands-agents/sdk`) and the Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`, `ConverseCommand`) | DP-AGENT-WORKFLOW, DP-E2E |

**Prize tracks (brief table, verbatim figures):** Ring 1st $12,000 / 2nd $8,000 (no credits); AWS Builder mini-challenge $5,000 + $5K credits; Open Source mini-challenge $5,000 + $5K credits (not pursued: "no bonus integration beyond the two focus tracks — not worth track dilution"). A project can win at most one track prize and one mini-challenge prize.

**Judging axes (equally weighted, tie-broken in listed order):** Tech Implementation · Design · Potential Impact · Quality of the Idea; plus a friction-log bonus of up to 10%.

**Submission gate (brief "What to submit", the ten Devpost fields):** (1) project text description; (2) GitHub repository URL — public with an open-source licence file detectable in the About section, with run instructions, showing imported-and-called Ring APIs; (3) demo video on YouTube/Vimeo, public, English, under 3 minutes, showing the project functioning; (4) product feedback for EVERY tool/API/SDK used (AWS services described here too); (5) primary track selection = Ring; (6) mini-challenge opt-ins = AWS Builder (which AWS services and how, inside the feedback answer); (7) pre-existing-project delta; (8) optional feature requests; (9) optional friction-log entries (up to 10% bonus); (10) testing access (free, unrestricted, through the judging period).

**Bonus integrations:** the brief lists none for Ring beyond the mini-challenges. **No bonus integration** (no Gemma/Veo/Lyria *product* integration). Lyria is used only as the video's music bed by the production pipeline and is disclosed.

**Vendor-name guard (AI ACCESS SPEC §2A):** the brief carries no list of forbidden vendor names, so §2A does not apply; Gemini via Vertex AI is used for build/test tooling and as a labelled fallback only (see §6, reconciliation R-1).

---

## §1 Requirements

Every requirement has an ID. "Axis" = the judging axis it evidences (TI = Tech Implementation, D = Design, PI = Potential Impact, QI = Quality of the Idea). "Source" = the section of `design_documents/winning_project_plan.md` (WPP) or the brief.

### §1.1 Functional requirements

| ID | Requirement | Source | Axis | Owning plan |
|---|---|---|---|---|
| FR-01 | **Real input, two ways.** (a) Live: a Ring Developer Playground token (≈30-minute life) pasted into the app lets it read the operator's/judge's own Ring devices, status, capabilities and event history. (b) Bundled: an anonymized synthetic 14-day doorstep event set (MIT, labelled *synthetic* in the UI and README) for deterministic replay. A judge can supply their own token. | WPP "Demo Inputs"; brief §4 | TI, PI | DP-DOMAIN-ENGINE (bundle), DP-RING-INTEGRATION (live), DP-UI (connect panel) |
| FR-02 | **One stateful domain model** — the household week (devices, events, visits, routines, consent scopes, incidents, nudges, notes, webhook ledger, baseline, UI state) with id-addressable entities, a revision number and undo/redo. Every change by human or agent goes through one set of store actions. | WPP "AI Solution"; depth §1.2 | TI | DP-DOMAIN-ENGINE |
| FR-03 | **Rhythm baseline.** Per-household dwell p90 and visits-per-weekday-hour rhythm computed in code from the bundle/live events (rolling weeks). | WPP "AI Solution" cap. (1) | QI, TI | DP-DOMAIN-ENGINE |
| FR-04 | **Deterministic truth engine** `check(model) → Issue[]` with units, rules: quiet hours 22:00–07:00 ±30 min; dwell > 15 min vs personal p90; device offline > 30 min escalates; consent scope; duplicate suppression (same `request_id` or ±60 s same-type bursts); plus ledger integrity and incident-coverage rules. The seed scenario has a regression test asserting zero errors; the demo scenario carries one seeded duplicate burst. | WPP "Truth Engine" | TI | DP-DOMAIN-ENGINE |
| FR-05 | **Typed action surface — 20 registered actions + the kit's `get_capabilities`** in six groups (Read 6, Change 5, Verify 2, Navigate 3, Collaborate 2, Cross-boundary 2). Each passes `lintDescriptor`; `registry.list().length − 1 = 20`. Destructive: `play_chime_announcement`, `export_weekly_brief`. (WPP says "Total actions: 18" but its own table lists 20; see §6 R-2.) | WPP "Action Surface" | TI | DP-AGENT-WORKFLOW |
| FR-06 | **Multi-round agent workflow:** Perceive (extractor ×2) → Plan (planner ×1) → Act (actor, ~14 turns) → Verify (truth engine ×2) → Repair (actor) → Explain (narrator ×1) → Checkpoint (human). ≥ 4 distinct model roles; ≥ 1 verify→repair round where errors drop to 0; ≥ 1 human checkpoint; never "one planner call → steps → one summary". | WPP call graph; depth §2 | TI | DP-AGENT-WORKFLOW |
| FR-07 | **Human checkpoint and consent.** Destructive actions pause behind the approval bar (Approve / Reject). A rejection returns "The human declined … Ask what to do instead." Consent to a contact channel can only be granted by a human; an agent attempt returns an actionable refusal. | WPP "Action Surface", "Truth Engine" (consent) | D, TI | DP-AGENT-WORKFLOW, DP-UI |
| FR-08 | **Manual runner.** Every action can be run from its schema without any model, through the same registry and the same gate. The product is complete with the AI path off. | depth §1.7 | D | DP-AGENT-WORKFLOW, DP-UI |
| FR-09 | **Visible execution.** Activity feed with AGENT / YOU / SYSTEM badges; changed elements animate; every run writes `run-trace.json` via `window.__runTrace`. | depth §1.7, §9 | D, TI | DP-AGENT-WORKFLOW, DP-UI |
| FR-10 | **Ring discovery and health:** OAuth refresh, `GET /v1/devices?include=status,capabilities,location,configurations`, per-device status / capabilities (`?component_id=N`) / location / configurations, `GET /v1/users/me`. Capability gating of chime and stream actions. | WPP leverage map rows 6, 12 | TI | DP-RING-INTEGRATION |
| FR-11 | **Webhook receiver:** HTTPS POST, HMAC-SHA256 verify-before-process (constant-time), `200` within 5 s, async processing, idempotent on `meta.request_id` / `event_id`, tolerant normalizer for `motion_detected` (+`sub_type: human`), `button_press`, `device_online`, `device_offline`. | WPP rows 1–4 | TI | DP-RING-INTEGRATION, DP-API-TRANSPORT |
| FR-12 | **Event History reconciliation:** `GET /v1/history/devices/{id}/events` fills webhook gaps; seam-stitched ribbon in the UI. | WPP row 5 | TI | DP-RING-INTEGRATION, DP-AGENT-WORKFLOW (`reconcile_webhook_gap`) |
| FR-13 | **WHEP live session** start/stop with auto-close discipline (30 s battery / 60 s line-powered windows). | WPP row 7 | TI | DP-RING-INTEGRATION, DP-UI (video panel) |
| FR-14 | **Snapshot and clip download** attached to incidents as evidence. | WPP row 8 | TI | DP-RING-INTEGRATION |
| FR-15 | **Chime playback** (capability-gated, consent-gated, approval-gated) as the "gentle reassurance" actuator. | WPP row 10 | QI, TI | DP-RING-INTEGRATION, DP-AGENT-WORKFLOW |
| FR-16 | **Account linking** (nonce, `POST` + `PATCH /v1/accounts/me/app-integrations`) demonstrated against a staging user; `app_integration_added/removed` webhooks handled as consent changes. | WPP row 11 | TI | DP-RING-INTEGRATION |
| FR-17 | **Multi-camera `component_id` addressing** and visitor threads across cameras. | WPP row 9 | QI, TI | DP-DOMAIN-ENGINE (threads), DP-RING-INTEGRATION (addressing) |
| FR-18 | **Bedrock runtime LLM** — Strands `Agent` + `BedrockModel` for the structured roles (extractor, planner, narrator), Converse tool use for the actor loop; model ids discovered at runtime, never hardcoded; every call wrapped in `withResilience`; context fitted with `fit`; usage metered by the cost guardrail. | WPP "AI Solution", "Sponsored Track Strategy" | TI | DP-AGENT-WORKFLOW |
| FR-19 | **The calm timeline UI** — one household-week view with large type, an incident focus, the Check panel (count badge), the approval bar, the activity feed, quiet-hours/consent settings, a Ring status indicator and an Agent provider badge. | WPP "Executive Pitch" (Design) | D | DP-UI |
| FR-20 | **Signature 3D doorway week** — stoop geometry, camera frustums, event pillars on a time axis; live-bound to every action; named shots `overview`, `focus:<entity>`, `walk`; `/lab` route; capability fallback. | WPP "Signature 3D Experience" | D, QI | DP-3D |
| FR-21 | **Visible degraded ladder** — live Bedrock → labelled Gemini fallback → golden-cache replay → manual runner; Ring live → recorded bundle. Each rung shows a banner with icon, title, structured detail. | brief constraints; WPP "Why this stack" | D | DP-AGENT-WORKFLOW, DP-API-TRANSPORT, DP-UI |
| FR-22 | **Replay route `/watch`** — a second isolated session replays the saved `run-trace.json`; labelled as a replay. | HEE SHOWCASE SPEC §7 | D | DP-SHOWCASE |
| FR-23 | **Brandmark, explainer panel and contextual `?` help** on every result region. | UI CRAFT SPEC §7 | D | DP-UI |
| FR-24 | **Public deployment** with `/health` returning a build marker; deployed URL green on the E2E smoke suite. | brief gate; LIVE spec §3 | TI | DP-DEPLOY |
| FR-25 | **Submission artefacts:** README (product README), `disclosure.md`, `JUDGES.md`, `claims.json`, product feedback per tool, friction log, feature requests, deck, Q&A sheet, golden capture, `architecture.json`. | brief "What to submit" | all | DP-SHOWCASE, DP-SUBMISSION |
| FR-26 | **Demo video** — `video/final.mp4`, narrated, subtitled, one theme (`paper`), 120–150 s, exactly one operator pause. | brief gate; script/live specs | all | DP-SCRIPT, DP-LIVE-RUN-AND-VIDEO |

### §1.2 Non-functional requirements

| ID | Requirement | Evidence |
|---|---|---|
| NFR-01 | Ring and OAuth calls are server-to-server only (CORS blocks browsers). The browser never holds Ring credentials; the Playground token lives in server memory only, per session, and is never logged. | DP-RING-INTEGRATION, DP-API-TRANSPORT |
| NFR-02 | No secret is ever committed or written into a plan. Env names only: `RING_ACCESS_TOKEN`, `RING_REFRESH_TOKEN`, `RING_CLIENT_ID`, `RING_CLIENT_SECRET`, `RING_HMAC_KEY`, `RING_WEBHOOK_SECRET`, `AWS_BEARER_TOKEN_BEDROCK` (or the AWS default credential chain), `AWS_REGION`. | `.gitignore`, hygiene report (DP-SUBMISSION) |
| NFR-03 | Every outbound LLM call and every Ring call is wrapped with `withResilience`; failures become visible `DegradedResult`s, never crashes. | DP-AGENT-WORKFLOW, DP-RING-INTEGRATION |
| NFR-04 | Designed for a 1280×720 laptop viewport; verified also at 1440×900 and 390 px. | DP-UI craft audit |
| NFR-05 | WCAG AA in both themes; visible focus; reduced-motion substitutes; icon-only controls have `aria-label`. | DP-UI |
| NFR-06 | Camera-ready sizes: body ≥ 18 px, numerals ≥ 28 px, hero metric ≥ 64 px; exactly one `data-demo-focus` per demo route; state changes animate in 200–400 ms. | DP-UI §13 assertions |
| NFR-07 | 3D: ≥ 50 fps headed (≥ 20 fps headless software), draw calls < 300, zero renderer console errors. | DP-3D, DP-E2E |
| NFR-08 | Banned vocabulary (`../../hackathons/templates/banned-words.json`, list v1.2.0 at time of writing; re-read at run time) never reaches a judge-visible surface: narration, subtitles, slides, cover, every rendered string, help copy, `aria-label`s. | DP-UI craft audit, DP-SCRIPT, DP-LIVE gate |
| NFR-09 | The chassis `../../hackathons/src/` is never modified; engine code lives only in this repo under new `src/…` directories and `engine/`. | all plans |
| NFR-10 | The entry repo contains the application and nothing else (README, LICENSE, `disclosure.md`, `design_documents/`, `hee/`, evaluation artefacts). Production aids live in `../../hackathons/hackathon-projects/2026-10-amazonDevs/`. | DP-E2E WU-06, DP-SHOWCASE, DP-SUBMISSION |
| NFR-11 | Absolute filesystem paths never appear in plans or code; chassis paths are written `../../hackathons/…`. | all plans |
| NFR-12 | Webhook endpoint responds in ≤ 5 s (target ≤ 300 ms); processing is asynchronous. | DP-RING-INTEGRATION, DP-E2E |
| NFR-13 | Rate-limit discipline: Ring 100 TPS/client with `429` + `Retry-After` honoured, exponential backoff from 1 s. | DP-RING-INTEGRATION |
| NFR-14 | Cost guardrail on every metered model call; a runaway loop cannot burn the demo budget (global budget with an 80% warning surfaced in the UI). | DP-AGENT-WORKFLOW |

### §1.3 Mandated Technology Leverage Map → requirements → axes (TECHNOLOGY LEVERAGE CONTRACT)

Each capability row of WPP `### Mandated Technology Leverage Map` becomes a requirement, is implemented in the plan named, and is exercised by DP-E2E-BROWSER-TESTING scenario `S-RING-<n>`.

| # | Capability | Tier | Requirement | Implemented in | Exercised by | Axis |
|---|---|---|---|---|---|---|
| 1 | Webhook `motion_detected` + `sub_type: human` | core | FR-11 | DP-RING-INTEGRATION | S-RING-1 | TI |
| 2 | `button_press` | core | FR-11 | DP-RING-INTEGRATION | S-RING-1 | TI |
| 3 | `device_online` / `device_offline` | advanced | FR-04 (outage rule), FR-11 | DP-RING-INTEGRATION, DP-DOMAIN-ENGINE | S-RING-2 | TI |
| 4 | HMAC-SHA256 verify + idempotency | core | FR-11 | DP-RING-INTEGRATION | S-RING-1 | TI |
| 5 | Event History polling failover | advanced | FR-12 | DP-RING-INTEGRATION, DP-AGENT-WORKFLOW | S-RING-3 | TI |
| 6 | Device discovery + status + capabilities | core | FR-10 | DP-RING-INTEGRATION | S-RING-4 | TI |
| 7 | WHEP live session | core | FR-13 | DP-RING-INTEGRATION, DP-UI | S-RING-5 | TI |
| 8 | Image snapshot download | advanced | FR-14 | DP-RING-INTEGRATION | S-RING-6 | TI |
| 9 | `component_id` multi-camera | frontier | FR-17 | DP-RING-INTEGRATION, DP-DOMAIN-ENGINE, DP-3D | S-RING-7 | QI |
| 10 | Chime audio playback | frontier | FR-15 | DP-RING-INTEGRATION, DP-AGENT-WORKFLOW | S-RING-8 | QI |
| 11 | One-way account linking + staging users | advanced | FR-16 | DP-RING-INTEGRATION | S-RING-9 | TI |
| 12 | Ring Appstore MCP + Playground token | core | FR-01 | DP-RING-INTEGRATION (token flow), DP-SUBMISSION (disclosure of MCP-assisted authoring) | S-RING-4 | TI |

Coverage claimed by the plan: 12/14 product-relevant (86%), advanced 4, frontier 2. **Beyond the sample:** the organizer's sample streams one camera and echoes webhooks; this entry fuses multi-camera threads, learns household rhythm, and gates caring actuators behind a truth engine and human checkpoints. **Necessity thesis:** without Ring's signed event stream and history there is no lawful, resident-consented data to interpret, so the product cannot exist; without Bedrock-driven interpretation over weeks, a threshold can only page at 3 a.m. and cannot say what is normal for this house.

---

## §2 Architecture

### §2.1 Stack (named per the brief — nothing invented)

| Layer | Choice | Call method | Evidence |
|---|---|---|---|
| Mandated technology | Ring (Amazon Vision REST `https://api.amazonvision.com`, OAuth `https://oauth.ring.com`, signed webhooks, WHEP, snapshot/clip, chime, account linking) | `fetch` from the Node server only (browser calls are blocked by CORS); `LiveRingPort` is the importing-and-calling module | DP-RING-INTEGRATION, DP-E2E `S-RING-1…9` |
| Runtime LLM | Amazon Bedrock. Structured roles (extractor, planner, narrator): Strands Agents SDK `Agent` + `BedrockModel` + `structuredOutputSchema`. Actor tool loop: Bedrock Converse (`ConverseCommand`, `toolConfig`). | `@strands-agents/sdk` 1.19.0, `@aws-sdk/client-bedrock-runtime` 3.1146.0, `@aws-sdk/client-bedrock` (model discovery; version pinned by DP-AGENT-WORKFLOW WU-01) | DP-AGENT-WORKFLOW |
| Labelled fallback | Gemini via Vertex (`AGENT_PROVIDER=vertex`, `AGENT_ALLOW_FALLBACK=1`), shown in the UI as "Fallback model (not Bedrock)". Build/test tooling (images, TTS, visual review, evals) also uses Vertex — those are not product runtime. | the hee kit's `createVertexClient` | DP-AGENT-WORKFLOW WU-07 |
| Resilience | `withResilience` on every outbound call; golden cache `data/golden-cache/` committed | `src/resilience` | all |
| Context | `fit(buffer, config)` before every actor turn | `src/context` | DP-AGENT-WORKFLOW |
| Cost | Python-only chassis module → Node calls `scripts/cost_sidecar.py` (JSON lines) | `src/cost` (`with_cost_guardrail`) | DP-AGENT-WORKFLOW WU-02 |
| Server | Express 5.2.1 run by `vite-node` 6 (so the `src/…` import alias resolves identically in dev, tests and the container; no `tsx`), one process serves API + built UI | `npx vite-node src/server/index.ts` | DP-API-TRANSPORT |
| UI | React 19.3.0 + Vite; platform transport hook `useEventStream`; kit primitives re-skinned by wrappers | — | DP-UI |
| 3D | three 0.186.1 / @react-three/fiber 9.8.1 / drei 10.7.9 through the hee `three-scene` kit | — | DP-3D |
| Deploy | Google Cloud Run (documented operator-overridable default) via the chassis docker adapter | `scripts/deploy-cloud-run.ts` | DP-DEPLOY |
| Runtime env var names | `RING_ACCESS_TOKEN`, `RING_REFRESH_TOKEN`, `RING_CLIENT_ID`, `RING_CLIENT_SECRET`, `RING_HMAC_KEY`, `RING_WEBHOOK_SECRET`, `AWS_BEARER_TOKEN_BEDROCK` (or the AWS default credential chain), `AWS_REGION`, `BEDROCK_MODEL_ID` (optional override), `AGENT_PROVIDER`, `AGENT_ALLOW_FALLBACK`, `GOLDEN_CACHE_DIR`, `PUBLIC_URL`, `RING_MODE`, `BUILD_MARKER` | values never written to any file | all |

### §2.2 Where each thing runs

```
BROWSER (owns the model state)                          SERVER (Node, Express 5)                 EXTERNAL
┌──────────────────────────────────────────────┐       ┌───────────────────────────────┐       ┌─────────────────────┐
│ React UI (DP-UI) + 3D view (DP-3D)           │       │ GET  /health                  │       │ Ring REST + OAuth   │
│  ├─ Session (DP-DOMAIN-ENGINE createSession) │  HTTP │ GET  /events/stream  (SSE)    │       │  api.amazonvision   │
│  │   store · truth · gate · trace · registry │◄─────►│ GET  /events (fallback)       │◄─────►│  oauth.ring.com     │
│  ├─ Action registry (20 + get_capabilities)  │       │ POST /webhooks/ring  ◄────────┼───────┤ signed webhooks     │
│  ├─ Orchestrator runWeekReview (AGENT-WF)    │       │ POST /api/ring/:op            │       └─────────────────────┘
│  ├─ HttpRingPort (API-TRANSPORT)             │       │ POST /api/ring/token          │       ┌─────────────────────┐
│  ├─ HttpAgentTransport (API-TRANSPORT)       │       │ POST /api/agent/step          │◄─────►│ Amazon Bedrock      │
│  └─ window.__runTrace · window.__demo3d      │       │ POST /api/agent/role/:role    │       │  Strands + Converse │
└──────────────────────────────────────────────┘       │ GET  /api/status              │       └─────────────────────┘
                                                       │ POST /api/dev/simulate-webhook│       ┌─────────────────────┐
 Node scripts (verify, harvest, golden record,         │ LiveRingPort · BundleRingPort │       │ cost sidecar (py)   │
 evals) use InProcessTransport + BundleRingPort        │ cost sidecar · golden cache   │       └─────────────────────┘
```

The browser owns the **domain model, truth engine, approval gate, trace and action registry** (the hee kit's design: `window.__runTrace` and the activity feed read the same in-memory objects). The server owns **secrets, Ring access, Bedrock access, the webhook inbox, cost metering and the golden cache**. The two meet at three typed seams: `RingPort` (browser `HttpRingPort` ⇄ server `LiveRingPort`/`BundleRingPort`), `AgentTransport` (browser `HttpAgentTransport` ⇄ server role runners and `handleAgentStep`) and the SSE envelope stream.

### §2.3 Data flow of the core demo ("Review the week")

1. **Load.** `createAppSession({ ring })` builds the session over the demo seed (DP-DOMAIN-ENGINE `demoSeed()`); `ring.listDevices()` fills `devices` through the `set_devices` store action.
2. **Perceive ×2.** Extractor role reads the raw webhook inbox batch (`ring.drainWebhookInbox()`) and one raw Event-History page (`ring.getEventHistory`) and returns `RawDoorEvent[]`; code guards every returned event by mapping it back to a raw id; both batches enter the store through `ingest_ring_events` (id-only dedupe — deliberately naive, which creates the seeded duplicate burst).
3. **Plan ×1.** Planner role returns an ordered review plan (`ReviewPlan`); it never sees truth issues.
4. **Act (actor loop, ≤ 16 turns).** The actor reads, opens incidents (with snapshot evidence), compares days to the baseline, reconciles the webhook gap, and calls `check_week_model`.
5. **Verify.** `check_week_model` returns issues with `fix` hints (the duplicate burst is the seeded error). The trace records `truth: {errors, warnings}`.
6. **Repair (actor loop, ≤ 8 turns).** The actor applies the fixes (`merge_duplicate_events`) and re-verifies until errors = 0.
7. **Explain ×3.** Narrator role writes one family-language explanation per incident; **code** applies it with `set_incident_status`; the banned-vocabulary guard rewrites once, then a template.
8. **Checkpoint (actor loop ≤ 8 turns).** `propose_family_nudge` → human decision card; `export_weekly_brief` and `play_chime_announcement` pause at the approval bar; consent is human-only.
9. **Finish.** `run-trace.json` is saved through `saveTraceFromPage` (kit) and the UI Check panel shows the final counts.

### §2.4 Event envelope and live updates

The platform transport module is included, so progress and arrivals use the platform `EventEnvelope` and the `useEventStream()` hook. `step_id` values (kebab-case, stable): `ring-webhook` (a signed webhook was accepted; payload `{ requestId, type, deviceId, tsMs, signature: "verified" }`), `ring-status` (payload `{ mode, tokenExpiresInSec }`), `agent-provider` (payload `{ kind, label, model }`), `system-degraded` (carries `degraded: true`, payload a `DegradedResult`), `cost-warning` (payload `{ usedPct }`). The UI subscribes once (`useEventStream({ url: "/events/stream" })`); `ring-webhook` envelopes make the Webhook inbox pill count up and trigger an `ingest` through the registry with `source: "system"`. The domain store's own `subscribe` drives every domain redraw (timeline, 3D, Check panel).

### §2.5 Inter-module contract table (single owner, N consumers)

Rule: a consumer **imports** the export named here. It never re-declares the type, re-implements the function or stubs it. Paths are relative to the entry root.

| # | File (owner plan) | Export | Shape / signature | Consumers |
|---|---|---|---|---|
| C-01 | `src/domain/types.ts` (DP-DOMAIN-ENGINE) | `WeekModel`, `Household`, `Device`, `DoorEvent`, `RawDoorEvent`, `Visit`, `Routine`, `ConsentScope`, `Nudge`, `Incident`, `Note`, `LedgerEntry`, `Baseline`, `UiState`, `ScopeName`, `IncidentKind`, `IncidentStatus`, `NudgeStatus`, `EventType` | literal interfaces in DP-DOMAIN-ENGINE §3 | every plan |
| C-02 | `src/domain/time.ts` (DP-DOMAIN-ENGINE) | `localMinutes`, `localDayIndex`, `fmtClock`, `fmtDay`, `inWindow`, `DAY_MS`, `MIN_MS` | `(tsMs:number, utcOffsetMin:number) => number|string` | AGENT-WORKFLOW, UI, 3D, SCRIPT |
| C-03 | `src/domain/ring-port.ts` (DP-DOMAIN-ENGINE) | `RingPort`, `RingError`, `RingDevice`, `RingStatus`, `RingCapabilities`, `RingLocation`, `RingConfigurations`, `RingHistoryPage`, `RingWebhookPayload`, `RingWhepSession`, `RingSnapshot`, `RingChimeResult` | interface + wire types; failures throw `RingError{status, code, retryAfterSec?}` | RING-INTEGRATION (implements `LiveRingPort`), API-TRANSPORT (`HttpRingPort`, routes), AGENT-WORKFLOW, UI |
| C-04 | `src/domain/bundle-ring-port.ts` (DP-DOMAIN-ENGINE) | `createBundleRingPort(bundle?: RingBundle): RingPort` | reads `data/bundle/doorstep-14d.json`; `mode: "bundle"` | AGENT-WORKFLOW, API-TRANSPORT, scripts, E2E |
| C-05 | `src/domain/parse.ts` (DP-DOMAIN-ENGINE) | `parseRingPayload(payload: unknown): RawDoorEvent[]`, `parseHistoryPage(page: unknown, deviceId: string): RawDoorEvent[]` | tolerant normalizer; returns `[]` for unknown types, never throws | RING-INTEGRATION webhook handler, AGENT-WORKFLOW guard + `reconcile_webhook_gap`, BundleRingPort |
| C-06 | `src/domain/derive.ts` (DP-DOMAIN-ENGINE) | `deriveVisits`, `computeBaseline`, `weekRibbon`, `visitorThreads`, `p90` | pure functions over `WeekModel` | rules, actions, UI ribbon, 3D |
| C-07 | `src/domain/seed.ts` (DP-DOMAIN-ENGINE) | `cleanSeed(): WeekModel`, `demoSeed(): WeekModel`, `DEMO_NOW_MS`, `REVIEW_START_MS`, `REVIEW_END_MS` | deterministic | tests, session, UI, E2E |
| C-08 | `src/domain/actions.ts` (DP-DOMAIN-ENGINE) | `storeActions: StoreAction<WeekModel>[]`, `STORE_ACTION_NAMES` | 17 store actions | `createWeekStore`, AGENT-WORKFLOW handlers (via `store.dispatch`), UI (human dispatch) |
| C-09 | `src/domain/rules.ts` (DP-DOMAIN-ENGINE) | `truthRules: Rule<WeekModel>[]`, `RULE_IDS`, `EFFECTIVE_QUIET_HOURS`, `candidateIncidents(model: WeekModel): Candidate[]` | 7 rules | session, AGENT-WORKFLOW (`check_week_model`), UI Check panel |
| C-10 | `src/domain/session.ts` (DP-DOMAIN-ENGINE) | `createSession(opts: SessionOptions): Session`, `Session`, `SessionOptions` | store + truth + gate + trace + wrapped registry | AGENT-WORKFLOW (`createAppSession`), tests |
| C-11 | `src/kits/agent-workflow/src/**` (installed by DP-DOMAIN-ENGINE WU-01 from `hee/kits/agent-workflow`) | `createDomainStore`, `createTruthEngine`, `createRegistry`, `createApprovalGate`, `createTraceWriter`, `installTraceHook`, `runAgentLoop`, `handleAgentStep`, `lintDescriptor`, `ActivityFeed`, `ApprovalBar`, `ManualRunner`, `ChangedFlash`, `saveTraceFromPage` | the kit API, unchanged | DOMAIN-ENGINE, AGENT-WORKFLOW, UI |
| C-12 | `src/agent/app-session.ts` (DP-AGENT-WORKFLOW) | `createAppSession(opts: AppSessionOptions): Session` | `createSession` + `registerDoorstepActions` | UI, SHOWCASE `/watch`, scripts, E2E |
| C-13 | `src/agent/actions.ts` (DP-AGENT-WORKFLOW) | `registerDoorstepActions(core: SessionCore, deps: ActionDeps): void`, `ACTION_NAMES` | 20 descriptors | `createAppSession`, evals |
| C-14 | `src/prompts/{extractor,planner,actor,narrator}.ts`, `src/prompts/index.ts` (DP-AGENT-WORKFLOW) | `EXTRACTOR_PROMPT`, `PLANNER_PROMPT`, `ACTOR_PROMPT`, `NARRATOR_PROMPT`, `PROMPT_VERSION` | literal text | role runners |
| C-15 | `src/agent/schemas.ts` (DP-AGENT-WORKFLOW) | `ExtractorOutputSchema`, `ReviewPlanSchema`, `NarrationSchema` (zod) + JSON-Schema exports; `RoleName`, `RoleInput`, `RoleOutput` | zod 4.6.5 | role runners, `engine/schema/*.json` |
| C-16 | `src/llm/bedrock-client.ts` (DP-AGENT-WORKFLOW) | `createBedrockClient(opts): { generate(req: GenerateRequest): Promise<GenerateResult> }` | kit `GenerateRequest/Result` | `handleAgentStep`, role runners (fallback runner) |
| C-17 | `src/llm/model-discovery.ts` (DP-AGENT-WORKFLOW) | `discoverModels(deps?): Promise<{ fast: string; balanced: string; source: "discovery" \| "env" }>` | never a hardcoded id | server, scripts |
| C-18 | `src/llm/roles.ts` (DP-AGENT-WORKFLOW) | `createRoleRunners(deps): RoleRunners` where `RoleRunners = { [R in RoleName]: (input: RoleInput[R], ctx: RoleCtx) => Promise<RoleOutcome<R>> }` | every call goes through `withResilience`, `fit`, cost, guard | transports, API-TRANSPORT |
| C-19 | `src/llm/guard.ts` (DP-AGENT-WORKFLOW) | `bannedHits(text): string[]`, `guardCopy(text, rewrite): Promise<string>` | reads `config/banned-patterns.json` | roles, UI (static copy lint) |
| C-20 | `src/agent/transport.ts` (DP-AGENT-WORKFLOW) | `AgentTransport`, `createInProcessTransport(deps)`, `createGoldenTransport(dir)` | interface in DP-AGENT-WORKFLOW §3 | orchestrator, API-TRANSPORT (`HttpAgentTransport` implements it), scripts, SHOWCASE |
| C-21 | `src/agent/orchestrator.ts` (DP-AGENT-WORKFLOW) | `runWeekReview(deps: ReviewDeps): Promise<ReviewSummary>`, `PHASES` | the call graph | UI "Review the week", scripts, E2E, SHOWCASE |
| C-22 | `src/ring/signature.ts` (DP-RING-INTEGRATION) | `verifySignature(rawBody: Buffer \| string, header: string \| undefined, secret: string): boolean`, `signPayload(rawBody: Buffer \| string, secret: string): string` | constant-time HMAC-SHA256 hex, `sha256=` prefix | `handleWebhook`, API-TRANSPORT |
| C-23 | `src/ring/webhook.ts` (DP-RING-INTEGRATION) | `createWebhookHandler(deps): (req: { rawBody: Buffer; headers: Record<string,string \| undefined> }) => Promise<{ status: number; body: string }>` | verify → `200` fast → async enqueue; idempotent on `meta.request_id` | API-TRANSPORT route `POST /webhooks/ring` |
| C-24 | `src/ring/inbox.ts` (DP-RING-INTEGRATION) | `createInbox(opts?)`: `{ push(sessionId, payload), drain(sessionId): RingWebhookPayload[], size(sessionId): number }` | per-session; `default` for real webhooks | webhook handler, API-TRANSPORT, `LiveRingPort.drainWebhookInbox` |
| C-25 | `src/ring/client.ts` (DP-RING-INTEGRATION) | `createRingHttp(opts): RingHttp` with `get/post/del` returning parsed JSON or throwing `RingError`; handles `429 Retry-After`, backoff from 1 s, 100 TPS token bucket, wraps in `withResilience` | — | `LiveRingPort`, linking |
| C-26 | `src/ring/oauth.ts` (DP-RING-INTEGRATION) | `createTokenProvider(opts): { getToken(): Promise<string>; setPlaygroundToken(t: string, ttlSec?: number): void; status(): { source; expiresInSec } }` | refresh via `https://oauth.ring.com/oauth/token`; never logs a token | `createRingHttp` |
| C-27 | `src/ring/live-ring-port.ts` (DP-RING-INTEGRATION) | `createLiveRingPort(deps): RingPort` (`mode: "live"`, Node only) | implements C-03 | API-TRANSPORT, scripts |
| C-28 | `src/ring/linking.ts` (DP-RING-INTEGRATION) | `nonceTime(nowMs: number): number`, `makeNonce(key: string, accountId: string, nowMs?: number): string`, `verifyNonce(key: string, accountId: string, time: number, nonce: string, nowMs?: number): boolean`, `maskIdentifier(id: string): string`, `confirmLink(deps, args)`, `completeLink(deps, args)`, `getUserMe(deps)` | nonce = base64url-no-pad(HMAC-SHA256(key, `${time}:${accountId}`)) | API-TRANSPORT route `POST /api/ring/linking/*`, E2E |
| C-29 | `src/domain/gaps.ts` (DP-DOMAIN-ENGINE) | `findWebhookGaps(model: WeekModel, deviceId: string, sinceMs: number): { fromMs: number; toMs: number }[]`, `pollHistory(port: RingPort, deviceId: string, sinceMs: number): Promise<RawDoorEvent[]>` | pure gap finder + paging poller over `RingPort` (lives with the domain so the agent plan can import it before `src/ring/*` exists) | `reconcile_webhook_gap`, RING WU-08 history failover |
| C-30 | `src/server/app.ts` (DP-API-TRANSPORT) | `createApp(deps: ServerDeps): express.Express` | routes in §2.6 | `src/server/index.ts`, E2E harness, tests |
| C-31 | `src/server/http-ring-port.ts` (DP-API-TRANSPORT) | `createHttpRingPort(opts: { baseUrl?: string; sessionId: string; fetch?: typeof fetch }): RingPort` (`mode: "http"`; `remoteMode()` reads `/api/status`) | browser-safe | UI, `/watch` |
| C-32 | `src/server/http-agent-transport.ts` (DP-API-TRANSPORT) | `createHttpAgentTransport(opts): AgentTransport` | calls `/api/agent/step`, `/api/agent/role/:role` | UI, E2E |
| C-33 | `src/server/events.ts` (DP-API-TRANSPORT) | `createEventHub(): EventHub` with `publish(stepId, status, payload, opts?)`, `stream(res)`, `snapshot()`; built on platform `createPublisher` + `asSseStream` | — | routes, tests |
| C-34 | `architecture.json` at `../../hackathons/hackathon-projects/2026-10-amazonDevs/architecture.json` (DP-API-TRANSPORT writes the skeleton; DP-E2E-BROWSER-TESTING harvests proof lines) | contract `../../hackathons/contracts/architecture.schema.json` | 6–12 nodes, one `sponsor: true`, `proof` on a sponsor edge | DP-SCRIPT, video |
| C-35 | `src/ui/tokens/tokens.css`, `src/ui/tokens/tokens.ts`, `cinematic-tokens.json` (DP-UI) | CSS variables + `tokens` object + `readTokensFromCss` input | the only definition of colour/type/space/radius/shadow/motion | DP-3D (via `readTokensFromCss`), DP-SCRIPT slides, video motion graphics |
| C-36 | `brand/mark.svg`, `brand/lockup.html`, `brand/README.md` (DP-UI) plus the copy at `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/` | one `currentColor` mark | — | DP-SCRIPT cover/slides, DP-SHOWCASE |
| C-37 | `src/ui/App.tsx`, `src/ui/routes.tsx` (DP-UI) | `<App/>`, route table `/`, `/watch`, `/lab` | `/watch` page component is `src/ui/pages/Watch.tsx` (owned by DP-SHOWCASE), `/lab` is `src/ui/pages/Lab.tsx` (owned by DP-3D); DP-UI imports them by path; with `?hook=1` the page defines `window.__doorstep` (test hook), and every page defines `window.__runTrace` | DP-3D, DP-SHOWCASE, E2E |
| C-38 | `src/3d/adapter.ts` and `src/3d/shots.ts` (DP-3D) | `toSceneDescription(model: WeekModel): SceneDescription`; `SHOT_IDS = ["overview", "walk"]`, `shotList(model): ShotDef[]` (the kit appends `focus:<id>` shots) | pure; scene name slug `doorway-week` | `src/3d/DoorwayScene.tsx`, DP-UI hero slot |
| C-39 | `src/3d/DoorwayScene.tsx`, `src/3d/renderers/*` (DP-3D) | `DoorwayScene(props: { session: Session; className?: string; showLab?: boolean })` (`showLab` is additive) | mounts kit `ThreeScene`, binds store subscription, sets `data-demo-3d`, installs `window.__demo3d` | DP-UI hero slot, `/lab`, `/watch` |
| C-40 | `e2e/smoke.spec.ts` (DP-E2E-BROWSER-TESTING) | Playwright spec reading `BASE_URL` | the only smoke test | DP-DEPLOY WU-last, DP-SCRIPT WU-01, DP-LIVE WU-01 |
| C-41 | `design_documents/demo-scenario.json` (DP-SHOWCASE) | beats consumed by stills and by `demodrive` | — | DP-SUBMISSION, DP-SCRIPT |
| C-42 | `data/bundle/doorstep-14d.json` (DP-DOMAIN-ENGINE via `scripts/gen-bundle.ts`) | `RingBundle` | deterministic, labelled `synthetic: true` | BundleRingPort, golden cache, UI banner |
| C-43 | `data/golden-cache/*` (DP-AGENT-WORKFLOW WU-09) | resilience golden-cache entries | committed | `createGoldenTransport`, `withResilience` cache rung |
| C-44 | `config/cost.json`, `scripts/cost_sidecar.py`, `src/llm/cost.ts` (DP-AGENT-WORKFLOW) | `createCostClient(): { guard<T>(model: string, call: () => Promise<{ result: T; usage: Usage }>): Promise<...>; summary(): CostSummary }` | — | role runners, step route, UI cost chip |
| C-46 | `src/domain/generator.ts` (DP-DOMAIN-ENGINE) | `generateEvents(variant: "clean" \| "demo"): RawDoorEvent[]`, `splitChannels(events): { inbox: RingWebhookPayload[]; history: Record<string, RingHistoryPage[]> }`, `buildBundle(): RingBundle`, `BUNDLE_START_MS`, `ROUTINES` | deterministic (seeded PRNG), the only source of synthetic events | seeds, `scripts/gen-bundle.ts`, tests |
| C-45 | `config/banned-patterns.json`, `scripts/sync-banned-words.ts` (DP-AGENT-WORKFLOW) | generated list for the runtime guard | synced from `../../hackathons/templates/banned-words.json` | guard, UI craft audit |
| C-47 | `src/ring/wire.ts` (DP-RING-INTEGRATION) | `WIRE` endpoint builders, limits, `WIRE_SAMPLES` literal wire samples | the single place to adjust a path or a body shape after the documentation re-check | `LiveRingPort`, `createRingHttp`, the contract server |
| C-48 | `scripts/mock-ring-server.ts` (DP-RING-INTEGRATION WU-07) | a local Ring contract server labelled *simulated* with `emitWebhook(...)` | used by the contract test, the E2E harness and the API integration test | E2E, API-TRANSPORT tests |
| C-49 | `scripts/verify/ring-port-contract.ts` (DP-DOMAIN-ENGINE) | `runRingPortContract(port: RingPort)` | the one provider→consumer contract; run against the bundle port, the live port (against C-48) and the HTTP port | RING-INTEGRATION, API-TRANSPORT |
| C-50 | `config/deploy.json`, `config/env.doorstep.example`, `scripts/deploy-gate.ts`, `scripts/deploy-cloud-run.ts` (DP-DEPLOY) | deploy configuration (variable names only), the deployed-URL gate, the deploy script | the deploy record is written outside the repository | SHOWCASE, SUBMISSION, SCRIPT, LIVE |
| C-51 | `playwright.config.ts`, `e2e/helpers.ts`, `e2e/fixtures.ts`, `e2e/bedrock-probe.ts`, `scripts/e2e-run.ts`, `e2e/` layout (DP-E2E-BROWSER-TESTING) | the one Playwright root config, `GL_ARGS`, `probeBedrock()`, the counting wrapper | `npx playwright test e2e/smoke.spec.ts` works unchanged from the repository root | DEPLOY, SHOWCASE, SCRIPT, LIVE |
| C-52 | `playwright.showcase.config.ts`, `e2e/showcase/`, `design_documents/showcase-facts.json`, `scripts/make-stills.ts`, `src/ui/showcase/ReplayView.tsx` (DP-SHOWCASE) | stills runner, measured facts (actions 20, e2e tests 60, Ring scenarios 9, eval tasks 10), the `/watch` replay view | the README markers are written by SHOWCASE and the eval `publish` step is run by it | SUBMISSION, SCRIPT |
| C-53 | `scripts/lib/submission.ts`, `scripts/chassis-tool.ts`, `config/entry-layout.json`, `scripts/check-feedback.ts`, `scripts/public-readiness.ts` (DP-SUBMISSION) | `readShowcase()`, the chassis-tool runner, the allowed top-level list, the feedback checker, the readiness report | `.gitignore` carries an additive negation block so judge-facing documents are not ignored | SCRIPT, LIVE |
| C-54 | `src/server/bedrock-lazy.ts` (DP-API-TRANSPORT) | `createLazyBedrockTransport(...)` (discovery and client set-up deferred to the first call) | one shared build | the agent routes |
| C-55 | `scripts/video/*`, `scripts/verify/sk-*.ts`, `scripts/verify/lv-*.ts` (DP-SCRIPT, DP-LIVE-RUN-AND-VIDEO) | production aids: harvest, ledger, segments, arc check, plates, pitch check, live gate, proofs, pause, record, final check | the files the film is made from live in the project folder, never in the entry | each other |

### §2.6 Server routes (DP-API-TRANSPORT owns all of them)

| Route | Method | Request | Response | Notes |
|---|---|---|---|---|
| `/health` | GET | — | `{ ok: true, build: string, mode: "bundle" \| "live", provider: string, uptimeSec: number }` | `build` is the `BUILD_MARKER` build-arg |
| `/events/stream` | GET (SSE) | — | `EventEnvelope` per event | platform `asSseStream` |
| `/events` | GET | — | `{ events: EventEnvelope[], degraded: boolean }` | transport fallback |
| `/webhooks/ring` | POST | raw JSON body + `X-Signature` | `200 {"ok":true}` ≤ 5 s | C-23 |
| `/api/ring/:op` | POST | `{ sessionId, args }` | `{ ok: true, data }` or `{ ok: false, error: { status, code, retryAfterSec? } }` | `op` ∈ `listDevices getStatus getCapabilities getLocation getConfigurations getEventHistory drainWebhookInbox startWhep stopWhep getSnapshot getClip playChime`; `stopWhep` takes `args { deviceId, whepSessionId }` |
| `/api/ring/token` | POST | `{ sessionId, token }` | `{ ok: true, expiresInSec }` | in-memory per session; never logged; `DELETE` forgets it |
| `/api/ring/linking/nonce`, `/confirm`, `/complete` | POST | per C-28 | per C-28 | staging user only |
| `/api/agent/step` | POST | header `x-run-id` (default `default`); `StepBody` | kit `{ ok, result }` plus `kind`, `label`, `rungChanged` | `handleAgentStep` + Bedrock client + cost |
| `/api/agent/role/:role` | POST | header `x-run-id` (default `default`); body `{ input, round, key? }` | `{ ok: true, output, model, tokens, kind, label, rungChanged } \| { ok: false, degraded: DegradedResult, kind, label, rungChanged }` | `role` ∈ extractor, planner, narrator |
| `/api/status` | GET | optional `?sessionId=` (selects that session's Ring mode) | `{ ring: { mode, tokenExpiresInSec? }, agent: { kind, label, model }, cost: { usedPct }, inbox: { default: number } }` | UI status chips |
| `/api/dev/simulate-webhook` | POST | `{ type, deviceId, subType?, sessionId? }` | `{ ok: true, requestId }` | signs with `RING_WEBHOOK_SECRET`; payload labelled `SIMULATED`; disabled when `NODE_ENV=production` unless `ALLOW_SIMULATE=1` |

### §2.7 Degraded-demo wiring (summary; full ladder in §5)

`AgentTransport.kind` tells the UI which rung it is on: `bedrock` → `vertex-fallback` → `golden` → `manual`. `RingPort.mode`: `live` → `bundle`. Each rung change publishes a `system-degraded` envelope and the UI renders a banner with an icon, a title and structured detail. Nothing is hidden: the banner names the rung in plain words.

---

## §3 Design-plan map

**Plan order (build order = file order):**
`DP-DOMAIN-ENGINE → DP-AGENT-WORKFLOW → DP-RING-INTEGRATION → DP-API-TRANSPORT → DP-UI → DP-3D → DP-E2E-BROWSER-TESTING → DP-DEPLOY → DP-SHOWCASE → DP-SUBMISSION → DP-SCRIPT → DP-LIVE-RUN-AND-VIDEO`

Ordering rules honoured: `DP-DOMAIN-ENGINE` and `DP-AGENT-WORKFLOW` are the first two; `DP-UI` appears exactly once and `DP-3D` is immediately after it; `DP-E2E-BROWSER-TESTING` is immediately before the deploy plan (`DP-DEPLOY`); `DP-SHOWCASE` is immediately after `DP-DEPLOY`; `DP-SCRIPT` is second-to-last; `DP-LIVE-RUN-AND-VIDEO` is last.

Dependency note: `DP-AGENT-WORKFLOW` (position 2) imports `RingPort` from `DP-DOMAIN-ENGINE` and uses `BundleRingPort` in all its verification commands; it never imports `src/ring/*` (position 3). `LiveRingPort` is plugged in at runtime by `DP-API-TRANSPORT`. This is why the Ring plan can come after the agent plan without a forward import.

### §3.0 Summary table

| # | Plan | Title | Owns (paths) | Consumed by | Depends on |
|---|---|---|---|---|---|
| 1 | DP-DOMAIN-ENGINE | Household-week domain model, truth engine, Ring port, bundle | `src/domain/*`, `src/kits/agent-workflow/**` (installed), `src/kits/three-scene/**` (installed), `scripts/gen-bundle.ts`, `data/bundle/*`, `scripts/verify/de-*.ts` | all | chassis + kits |
| 2 | DP-AGENT-WORKFLOW | Bedrock roles, prompts, 20-action registry, orchestrator, transports | `src/agent/*`, `src/llm/*`, `src/prompts/*`, `engine/schema/*`, `config/cost.json`, `config/banned-patterns.json`, `scripts/cost_sidecar.py`, `scripts/sync-banned-words.ts`, `data/golden-cache/*`, `scripts/verify/aw-*.ts` | UI, API-TRANSPORT, E2E, SCRIPT | 1 |
| 3 | DP-RING-INTEGRATION | Ring REST client, OAuth, webhooks, history, WHEP, snapshot, chime, linking | `src/ring/*`, `scripts/mock-ring-server.ts`, `design_documents/friction-log.md` (appends), `scripts/verify/ri-*.ts` | API-TRANSPORT, E2E | 1 |
| 4 | DP-API-TRANSPORT | Express server, SSE hub, routes, HTTP clients, architecture skeleton | `src/server/*`, `config/server.json`, `scripts/harvest-architecture-proofs.ts`, `architecture.json` skeleton, `scripts/verify/at-*.ts` | UI, E2E, DEPLOY | 1, 2, 3 |
| 5 | DP-UI | Design brief, brandmark, tokens, shell, components, states | `design_documents/design_brief.md`, `brand/*`, `src/ui/**` (except `pages/Lab.tsx`, `pages/Watch.tsx`), `cinematic-tokens.json`, `index.html`, `public/fonts/*`, `scripts/verify/ui-*.ts` | 3D, E2E, SHOWCASE | 1, 2, 4 |
| 6 | DP-3D | Doorway-week 3D scene, shots, `/lab`, fallback, visual review | `src/3d/*`, `src/ui/pages/Lab.tsx`, `scripts/verify/3d-*.ts` | UI hero slot, E2E, SCRIPT | 1, 5 |
| 7 | DP-E2E-BROWSER-TESTING | Real-browser proof of every use case, depth, 3D, mandated technology; agent eval | `e2e/**`, `design_documents/e2e-testing/*`, `.gitignore` additions, agent-eval artefacts under `evals/` (`scenarios.json`, `adapter.ts`, `report.json`) | DEPLOY, SCRIPT, LIVE | 1–6 |
| 8 | DP-DEPLOY | Container image, Cloud Run deploy, deployed-URL smoke | `Dockerfile`, `.dockerignore`, `scripts/deploy-cloud-run.ts`, `config/deploy.json`, `scripts/verify/dp-*.ts` | SHOWCASE, SUBMISSION, SCRIPT, LIVE | 7 |
| 9 | DP-SHOWCASE | README, stills, JUDGES.md, claims ledger, `/watch`, operator final checks | `README.md`, `JUDGES.md`, `claims.json`, `design_documents/showcase.json`, `design_documents/demo-scenario.json`, `design_documents/operator-final-checks.md`, `src/ui/pages/Watch.tsx`, `showcase/stills/*`, `data/replay/run-trace.json` | SUBMISSION, SCRIPT | 8 |
| 10 | DP-SUBMISSION | Disclosure, Devpost fields, feedback, friction log, deck, Q&A, golden capture | `disclosure.md`, `LICENSE`, `design_documents/submission/*`, provenance manifest + disclosure outputs | SCRIPT | 9 |
| 11 | DP-SCRIPT | Measured facts, 120–150 s winner-arc script, narration segments, beat plan, three 3D figures, three generated assets | `../../hackathons/hackathon-projects/2026-10-amazonDevs/{demo-video-script.md, narration-segments.json, beat-plan.json, narration-review.md, stage3d*.json, fact-ledger.json, video/facts/*, video/stage3d/*, pitch/*}`, `scripts/video/*`, `scripts/verify/sk-*.ts` | LIVE | 10 |
| 12 | DP-LIVE-RUN-AND-VIDEO | Live gate and proofs, one pause, narration render, recorded take, composed picture, mux → `video/final.mp4` | `../../hackathons/hackathon-projects/2026-10-amazonDevs/video/*`, `video-config.json`, `scripts/video/live-*.ts`, `scripts/verify/lv-*.ts` | submission | 11 |

### §3.1 DP-DOMAIN-ENGINE — Household-week domain model, truth engine, Ring port, bundle

- **Scope IN:** `WeekModel` and all entity types; time helpers; 17 store actions and the `createWeekStore` wrapper; the 7 truth rules; `deriveVisits`/`computeBaseline`/`weekRibbon`/`visitorThreads`; `RingPort` + wire types + `RingError`; `BundleRingPort`; the tolerant payload parser; the deterministic bundle generator and `data/bundle/doorstep-14d.json`; `createSession` (store + truth + gate + trace + wrapped registry with human gate bypass and preflight hook); installation of the two hee kits.
- **Scope OUT:** model prompts, actions registered to the registry (DP-AGENT-WORKFLOW); any HTTP (DP-RING-INTEGRATION, DP-API-TRANSPORT); any styling (DP-UI).
- **Owns:** C-01…C-10, C-29, C-42, C-46, C-49.
- **Consumers:** every plan. **Depends on:** chassis only.

| WU | Goal | Requirements |
|---|---|---|
| 01 | Install the two kits, pin dependencies, TypeScript paths, `vite-node` verify harness | NFR-09, FR-02 |
| 02 | `types.ts`, `time.ts` | FR-02 |
| 03 | `ring-port.ts` interface, wire types, `RingError` | FR-10, FR-11, FR-13, FR-14, FR-15 |
| 04 | `scripts/gen-bundle.ts` + generated bundle | FR-01 |
| 05 | `parse.ts` + `BundleRingPort` | FR-01, FR-11, FR-12, FR-17 |
| 06 | `derive.ts` (visits, baseline, ribbon, threads) | FR-03, FR-17 |
| 07 | `actions.ts`, `store.ts`, `seed.ts` | FR-02 |
| 08 | `rules.ts` + zero-error clean-seed regression + demo-seed issue census | FR-04 |
| 09 | `session.ts` composition | FR-02, FR-07, FR-09 |

### §3.2 DP-AGENT-WORKFLOW — Bedrock roles, prompts, 20-action registry, orchestrator, transports

- **Scope IN:** Bedrock model discovery; `createBedrockClient`; the four role prompts (literal); zod schemas; structured-role runner (Strands + Converse forced-tool fallback); resilience/context/cost/guard wrappers; the 20 action descriptors and preflights; `runWeekReview`; `AgentTransport` and its in-process and golden implementations; `createAppSession`; golden recording and replay; trace floors validator; `engine/schema/*.json`.
- **Scope OUT:** HTTP server and HTTP transport (DP-API-TRANSPORT); Ring HTTP (DP-RING-INTEGRATION); UI (DP-UI).
- **Owns:** C-12…C-21, C-43…C-45. **Consumers:** UI, API-TRANSPORT, E2E, SHOWCASE, SCRIPT. **Depends on:** DP-DOMAIN-ENGINE.

| WU | Goal | Requirements |
|---|---|---|
| 01 | Dependencies, `discoverModels`, `createBedrockClient`, Strands result-shape probe | FR-18 |
| 02 | Cost sidecar + client, banned-pattern sync + guard, `withResilience`/`fit` wrappers | FR-18, NFR-08, NFR-14 |
| 03 | Zod schemas, four literal prompts, `engine/schema/*.json` | FR-06, FR-18 |
| 04 | `createRoleRunners` (Strands primary, Converse forced-tool fallback, raw-id guard) | FR-18, FR-21 |
| 05 | The 20 descriptors, preflights, `registerDoorstepActions` | FR-05, FR-07, FR-15 |
| 06 | `runWeekReview` (perceive, plan, act, verify, repair, explain, checkpoint) | FR-06, FR-12 |
| 07 | `AgentTransport`, `createInProcessTransport` (Bedrock → labelled Vertex), `createGoldenTransport` | FR-21 |
| 08 | `createAppSession`, manual runner field helper, trace save | FR-08, FR-09 |
| 09 | Record the golden cache from a live Bedrock run and replay it offline | FR-21 |
| 10 | Trace floors validator + action manifest export | FR-05, FR-06, FR-09 |

### §3.3 DP-RING-INTEGRATION — Ring REST client, OAuth, webhooks, history, WHEP, snapshot, chime, linking

- **Scope IN:** everything under `src/ring/*`; a local Ring contract server (`scripts/mock-ring-server.ts`, labelled *simulated*) used by contract tests and the E2E harness; friction-log entries appended as each WU hits real errors.
- **Scope OUT:** Express routes (DP-API-TRANSPORT); `RingPort` interface (DP-DOMAIN-ENGINE).
- **Owns:** C-22…C-28, C-47, C-48. **Consumers:** API-TRANSPORT, E2E, scripts. **Depends on:** DP-DOMAIN-ENGINE.

| WU | Goal | Requirements |
|---|---|---|
| 01 | Re-verify wire shapes against the published docs; `verifySignature` | FR-11 |
| 02 | Inbox + idempotency + `createWebhookHandler` | FR-11, NFR-12 |
| 03 | `createTokenProvider` + `createRingHttp` (429, backoff, TPS bucket, resilience) | FR-10, NFR-13 |
| 04 | `createLiveRingPort`: devices, status, capabilities, location, configurations, history | FR-10, FR-12, FR-17 |
| 05 | WHEP start/stop, snapshot, clip, chime | FR-13, FR-14, FR-15 |
| 06 | Account linking: nonce, `POST`/`PATCH app-integrations`, `users/me` | FR-16 |
| 07 | Contract server (`scripts/mock-ring-server.ts`) and the full provider→consumer contract test | FR-10…FR-17 |
| 08 | History failover over the live port (uses `pollHistory` of C-29) and the friction-log check | FR-12 |

### §3.4 DP-API-TRANSPORT — Express server, SSE hub, routes, HTTP clients, architecture skeleton

- **Scope IN:** `src/server/*`; routes in §2.6; per-session Ring port selection and Playground-token store; role routes with cost, degraded ladder; `HttpRingPort`, `HttpAgentTransport`; `architecture.json` skeleton and the proof-harvest script.
- **Scope OUT:** page components (DP-UI); Bedrock logic (DP-AGENT-WORKFLOW); Ring wire logic (DP-RING-INTEGRATION).
- **Owns:** C-30…C-34, C-54. **Consumers:** UI, E2E, DEPLOY. **Depends on:** DP-DOMAIN-ENGINE, DP-AGENT-WORKFLOW, DP-RING-INTEGRATION.

| WU | Goal | Requirements |
|---|---|---|
| 01 | `createApp`, `/health`, config, request logging without secrets | FR-24 |
| 02 | Event hub, `/events`, `/events/stream` | FR-09, FR-21 |
| 03 | `/api/ring/*` and `/api/ring/token`, per-session port selection | FR-01, FR-10 |
| 04 | `/webhooks/ring`, inbox draining, `/api/dev/simulate-webhook` | FR-11, NFR-12 |
| 05 | `/api/agent/step`, `/api/agent/role/:role`, `/api/status`, degraded ladder, cost | FR-18, FR-21, NFR-14 |
| 06 | `createHttpRingPort`, `createHttpAgentTransport` | FR-01, FR-21 |
| 07 | `architecture.json` skeleton + `harvest-architecture-proofs.ts` | §3f of the engine prompt |
| 08 | Server integration test through the browser-side clients | FR-01…FR-21 |

### §3.5 DP-UI — Design brief, brandmark, tokens, shell, components, states

- **Scope IN:** the whole UI and the whole visual identity; first WU = design brief; second WU = brandmark; both themes; `cinematic-tokens.json`; the routes' shells for `/` (full) and the layout slots for `/watch` and `/lab`; wrappers that re-skin the kit's `ActivityFeed`, `ApprovalBar`, `ManualRunner`, `ChangedFlash`; the DOM measurement block; the visual review loop.
- **Scope OUT:** the 3D scene (DP-3D renders into DP-UI's hero slot); the `/watch` page body (DP-SHOWCASE); the `/lab` page body (DP-3D).
- **Owns:** C-35…C-37 (and the single definition of every colour, font, radius, shadow and animation). **Consumers:** DP-3D, DP-E2E, DP-SHOWCASE. **Depends on:** DP-DOMAIN-ENGINE, DP-AGENT-WORKFLOW, DP-API-TRANSPORT.

| WU | Goal | Requirements |
|---|---|---|
| 01 | Design brief + two-pass `frontend-design` review recorded | FR-19, FR-23 |
| 02 | Brandmark (`brand/mark.svg`, lockup, favicon, copy to production folder) | FR-23 |
| 03 | Fonts, tokens CSS/TS, `cinematic-tokens.json`, contrast script | FR-19, NFR-05, NFR-06 |
| 04 | App shell, routes, theme toggle, layout at 1280×720 | FR-19 |
| 05 | Primitives: Surface, Metric, Badge, StatusMessage, Explainer, HelpTip | FR-19, FR-23 |
| 06 | Week ribbon + timeline + day focus | FR-19, FR-03 |
| 07 | Check panel + incident card + nudge cards | FR-04, FR-19 |
| 08 | Workbench: skinned activity feed, approval bar, manual runner, review button | FR-07, FR-08, FR-09 |
| 09 | Rail: household, quiet hours, consent, connect panel, provider/cost chips | FR-01, FR-07, FR-21 |
| 10 | Live view panel (WHEP) + snapshot evidence | FR-13, FR-14 |
| 11 | Empty/loading/error/degraded states and banners | FR-21 |
| 12 | Hero slot + `data-demo-focus` + quiet frames + motion + reduced motion | NFR-06 |
| 13 | DOM measurement block (UI CRAFT §11) + banned-vocabulary scan of rendered text | NFR-05, NFR-06, NFR-08 |
| 14 | Visual review loop (Gemini vision via Vertex), screenshot acceptance list | FR-19 |

### §3.6 DP-3D — Doorway-week 3D scene

- **Scope IN:** `src/3d/*`; the scene built from `WeekModel`; materials from DP-UI tokens through `readTokensFromCss`; live binding; named shots; `[data-demo-3d]` and `window.__demo3d`; `/lab`; capability fallback; the vision-review loop.
- **Scope OUT:** colours/fonts (DP-UI); camera-framing choices of the video (DP-SCRIPT).
- **Owns:** C-38, C-39, `src/ui/pages/Lab.tsx`. **Consumers:** UI, E2E, SCRIPT. **Depends on:** DP-DOMAIN-ENGINE, DP-UI.

| WU | Goal | Requirements |
|---|---|---|
| 01 | `toSceneDescription` (stoop, door arch, two camera frustums, day columns, event pillars) | FR-20, FR-17 |
| 02 | Token → material mapping; scene CSS variables | FR-20 |
| 03 | `DoorwayScene` mount + store binding + selection both ways | FR-20 |
| 04 | Named shots, `window.__demo3d`, `data-demo-3d` | FR-20 |
| 05 | Incident arcs / evidence flares / 'walk' shot | FR-20, FR-17 |
| 06 | `/lab` page + Leva panel | FR-20 |
| 07 | Capability fallback + fps/draw-call probe | NFR-07 |
| 08 | Vision review loop | FR-20 |

### §3.7 DP-E2E-BROWSER-TESTING — Real-browser proof

- **Scope IN:** `e2e/**`; strategy/results/fix-log/known-inert; `e2e/smoke.spec.ts`; use-case scenarios; scenarios `S-RING-1…9`; the depth acceptance; the 3D acceptance; the agent-surface evaluation; `.gitignore` hygiene; the architecture proof harvest; running with BASE_URL.
- **Owns:** C-40, C-51. **Consumers:** DP-DEPLOY, DP-SCRIPT, DP-LIVE. **Depends on:** plans 1–6.

| WU | Goal | Requirements |
|---|---|---|
| 01 | Strategy + traceability table | all |
| 02 | Harness (Playwright pin and root config, fixture booting server + UI on the bundle, uses the mock Ring server of RING WU-07) | NFR-12 |
| 03 | Use-case scenarios | FR-01…FR-26 observable |
| 04 | `S-RING-1…9` scenarios | leverage map |
| 05 | `smoke.spec.ts` + `depth.spec.ts` | FR-06, FR-24 |
| 06 | Hygiene: `.gitignore` for every sweep artefact | NFR-10 |
| 07 | `3d.spec.ts` acceptance | FR-20, NFR-07 |
| 08 | Fix loop to two consecutive green runs | all |
| 09 | Agent-surface eval scenarios | FR-05 |
| 10 | Agent-surface eval adapter and run | FR-05 |
| 11 | Architecture proof harvest into `architecture.json` | §3f |
| 12 | `results.md` | all |

### §3.8 DP-DEPLOY — Container, Cloud Run, deployed-URL smoke

- **Owns:** `Dockerfile`, `.dockerignore`, `scripts/deploy-cloud-run.ts`, `config/deploy.json`, deploy record outside the repo. **Consumers:** SHOWCASE, SUBMISSION, SCRIPT, LIVE. **Depends on:** DP-E2E-BROWSER-TESTING.

| WU | Goal | Requirements |
|---|---|---|
| 01 | `Dockerfile` (Node + python3), `.dockerignore`, local image build + `/health` | FR-24 |
| 02 | `deploy-cloud-run.ts` wiring the chassis docker adapter | FR-24 |
| 03 | Secrets via Secret Manager; env template | NFR-09 |
| 04 | Deploy + record the URL (deploy record outside the repo) | FR-24 |
| 05 | Run `BASE_URL=<url> npx playwright test e2e/smoke.spec.ts` and `e2e/depth.spec.ts`; fail the deploy if red | FR-24, FR-06 |

### §3.9 DP-SHOWCASE — README, stills, JUDGES.md, claims ledger, `/watch`

- **Owns:** C-41, C-52, `README.md`, `JUDGES.md`, `claims.json`, `/watch`, stills, `operator-final-checks.md`. **Consumers:** DP-SUBMISSION, DP-SCRIPT. **Depends on:** DP-DEPLOY.

| WU | Goal | Requirements |
|---|---|---|
| 01 | `claims.json` init + verify + lint | FR-25 |
| 02 | `demo-scenario.json` | FR-25 |
| 03 | `/watch` replay page + saved `data/replay/run-trace.json` | FR-22 |
| 04 | Stills from the deployed URL | FR-25 |
| 05 | README scaffold → content → lint | FR-25 |
| 06 | JUDGES.md (judge-kit render + lint) | FR-25 |
| 07 | `operator-final-checks.md` | FR-25 |

### §3.10 DP-SUBMISSION — Disclosure, Devpost fields, feedback, friction log, deck, Q&A

- **Owns:** C-53, `disclosure.md`, `LICENSE`, `design_documents/submission/*`, `config/entry-layout.json`, an additive `.gitignore` block. **Depends on:** DP-SHOWCASE.

| WU | Goal | Requirements |
|---|---|---|
| 01 | `LICENSE`, AI-assistance log, `.gitignore` negation block, provenance record, `provo generate` → `disclosure.md` | FR-25 |
| 02 | Devpost fields 1–10 via `submit format` | FR-25 |
| 03 | Product feedback per tool (Ring, Bedrock, Strands, AgentCore note, Playground, Appstore MCP) | FR-25 |
| 04 | Friction log compiled from RING WUs | FR-25 |
| 05 | Feature requests + pre-existing-project delta | FR-25 |
| 06 | Deck via `deckgen populate` | FR-25 |
| 07 | Q&A sheet via `faqdef generate` + `rehearse` | FR-25 |
| 08 | Golden capture via `demodrive capture --data-source cache` | FR-25 |
| 09 | Hygiene and public-readiness (`check-entry-layout.ts`, `submit hygiene`, banned scan, no-secrets scan, `public-readiness.ts`) | NFR-09, NFR-10 |

### §3.11 DP-SCRIPT — The demo-video script, narration segments, three generated assets

- **Owns:** C-55 (with the next plan), `demo-video-script.md`, `stage3d-2.json`, `stage3d-3.json`, `video/facts/*`, `video/stage3d/*`, `scripts/video/*` tools, `narration-segments.json`, `beat-plan.json`, `narration-review.md`, `stage3d.json`, `fact-ledger.json`, `pitch/cover.png`, `pitch/slide1.png`, `pitch/slide2.png` (+ their HTML layers and generated pictures with zero text). **Depends on:** DP-SUBMISSION.

| WU | Goal | Requirements |
|---|---|---|
| 01 | Preflight, smoke gate against the deployed URL, then two measured depth runs (`harvest.json`) | FR-26 |
| 02 | Fact ledger + screen-reality check | FR-26 |
| 03 | Winner-arc script (W1–W7) | FR-26 |
| 04 | `narration-segments.json` + parity check + estimator | FR-26 |
| 05 | `beat-plan.json` | FR-26 |
| 06 | `stage3d.json`, `stage3d-2.json`, `stage3d-3.json` (radial, constellation, ribbon) + harvested data | FR-26 |
| 07 | Brandmark copy, image-model route under AI ACCESS §2, cover picture + HTML layer | FR-26 |
| 08 | Slide 1 (sourced problem evidence) + Slide 2 (quantified outcome) | FR-26 |
| 09 | Asset verification (measured, then looked at) | FR-26 |
| 10 | `narration-review.md` + `video/script-acceptance.md` (every gate of the script spec §10) | FR-26 |

### §3.12 DP-LIVE-RUN-AND-VIDEO — Narrated, subtitled `video/final.mp4`

- **Owns:** everything under `../../hackathons/hackathon-projects/2026-10-amazonDevs/video/` (except `video/facts/` and `video/stage3d/`, owned by DP-SCRIPT), `video-config.json`, the live-check block of `design_documents/submission/feedback.md`, and the proofs of `architecture.json`. **Depends on:** DP-SCRIPT and a deployed product.

| WU | Goal | Requirements |
|---|---|---|
| 01 | Health gate (loud decline), toolchain, delivery-voice and credential checks, vocabulary check, ledger guard | FR-26, FR-24 |
| 02 | Live architecture proofs (`api-ring`, `api-inbox`, `api-bedrock`), live observations, the feedback live-check block, `check-feedback.ts --final` | FR-25, FR-26 |
| 03 | THE ONE PAUSE: speech, clock, three pictures and the animatic in one message | FR-26 |
| 04 | The answer folded in; narration (Iapetus + pinned style) re-voiced to the delivery voice, tightened gaps, word times, cues, the score | FR-26 |
| 05 | One continuous take of the deployed address, 1280×720 @ DPR 2, paper theme, measured offset and geometry | FR-26 |
| 06 | Storyboard from measured audio and geometry, composed picture | FR-26 |
| 07 | Finalize → `video/final.mp4` (120–150 s, subtitled, paper theme), independent verification, the printed final line | FR-26 |

---

## §3a Inter-module boundary rule

§2.5 and §3 together are the only contract between plans. Provider-consumer pairs are named once: **one owner, N consumers, consumers import**. Concretely:

1. A type, function or file listed in §2.5 is *defined* only in its owner's plan and file. A plan that needs it copies the import line from its own §4 (which was copied from the owner's §3).
2. If a plan needs something not listed, it is a new row in §2.5 *before* it is written; no plan invents a helper that already exists (for example: no second webhook parser — `parseRingPayload` is the one; no second consent check — the preflight table in `createSession` is the one; no second smoke test — `e2e/smoke.spec.ts` is the one).
3. Verification commands of a consumer plan exercise the real import (`vite-node` scripts import from the owner's file), never a copy.
4. No plan defines a colour, a font, a radius, a shadow or an animation except DP-UI. DP-3D reads tokens through `readTokensFromCss`. DP-SCRIPT's slides import `cinematic-tokens.json` and the brandmark.
5. The only way a plan may differ from its row here is by a recorded entry in §6 (reconciliation).

---

## §4 Submission checklist mapping

| Devpost item | Produced by | Proof |
|---|---|---|
| Deployed public URL (hosted, free, no login, unrestricted access through judging) | DP-DEPLOY WU-04; claimed only after WU-05 (smoke + depth green against it) | `deploy record` + `BASE_URL=<url> npx playwright test e2e/smoke.spec.ts` |
| Public GitHub repository + licence file + run instructions | LICENSE (DP-SUBMISSION WU-01), README (DP-SHOWCASE WU-05), hygiene (DP-E2E WU-06, DP-SUBMISSION WU-09) | `README.md` run section executed by DP-SHOWCASE WU-05 |
| Imported-and-called Ring APIs | `src/ring/live-ring-port.ts` + `src/ring/webhook.ts`; scenario `S-RING-1…9` | `claims.json` rows with file+line proofs |
| Architecture diagram | `architecture.json` (DP-API-TRANSPORT WU-07; proofs harvested by DP-E2E WU-11) | `node ../../hackathons/scripts/lint-architecture.ts ../../hackathons/hackathon-projects/2026-10-amazonDevs` |
| Disclosure | DP-SUBMISSION WU-01 | `disclosure.md` |
| Demo video (YouTube/Vimeo, public, English, < 3 min, shows the project running) | script + three assets: DP-SCRIPT; narrated, subtitled `video/final.mp4`: DP-LIVE-RUN-AND-VIDEO WU-06 | `verify_video.py` exit 0 |
| Product feedback for every tool/API/SDK (AWS services described here, incl. Bedrock + Strands) | DP-SUBMISSION WU-03 | `design_documents/submission/feedback.md` |
| Track = Ring; mini-challenge = AWS Builder | DP-SUBMISSION WU-02 | fields file |
| Delta vs pre-existing project | DP-SUBMISSION WU-05 | field text |
| Optional: feature requests; friction log (up to +10%) | DP-SUBMISSION WU-05, WU-04 | files |
| Testing access | DP-SHOWCASE WU-06 (`JUDGES.md`: deployed URL, bundled data, how to paste a Playground token) | `JUDGES.md` |

The E2E smoke suite is wired into **three** places: DP-DEPLOY WU-05, DP-SCRIPT WU-01, DP-LIVE-RUN-AND-VIDEO WU-01. All three call `e2e/smoke.spec.ts` with a different `BASE_URL`.

---

## §5 Risks and degraded-demo ladder

| # | Risk | Likelihood / impact | Mitigation | What the viewer sees |
|---|---|---|---|---|
| K-1 | Ring Playground token expires mid-demo (≈30 min) | M / H | `createTokenProvider` reports `expiresInSec`; UI shows a countdown chip; the bundled synthetic week is the primary path for judges; recorded take uses the bundle plus a live read-only probe | chip "Playground token · 18 min left" → "Sample week (synthetic)" |
| K-2 | Webhooks cannot reach the deployed URL during the video | M / M | `/api/dev/simulate-webhook` sends a **signed, SIMULATED-labelled** payload through the same verify path; history polling failover is real | inbox pill labelled "simulated" |
| K-3 | Bedrock throttling / credentials missing | M / H | rung 1 Bedrock → rung 2 labelled Vertex fallback (`AGENT_ALLOW_FALLBACK=1`) → rung 3 golden-cache replay → rung 4 manual runner | banner "Replaying a recorded run" etc. |
| K-4 | Strands result shape differs from the plan | M / M | WU-01 probe; Converse forced-tool fallback runner behind the same interface | none (internal) |
| K-5 | Bedrock model ids differ per account/region | H / M | `discoverModels` at runtime; `BEDROCK_MODEL_ID` override; never a literal id | provider badge shows the discovered id |
| K-6 | `withResilience` returns a `DegradedResult` instead of data | M / M | every caller narrows with `isDegradedResult`; orchestrator maps to rung change | banner |
| K-7 | WebGL unavailable on the recording machine/headless | M / M | capability fallback in DP-3D (SVG ribbon replica); headless gate at ≥ 20 fps | "3D view unavailable — showing the flat week" |
| K-8 | Real-browser tests flaky on SSE | M / M | harness waits on DOM markers (`data-run-phase`), never sleeps | none |
| K-9 | Python missing in the deploy image (cost sidecar) | L / M | Dockerfile installs python3; degraded usage-counter fallback in `src/llm/cost.ts` | cost chip "approximate" |
| K-10 | Deploy target access (Cloud Run) not available to the operator | M / H | the deploy plan documents the default and the override: any container host that serves `PUBLIC_URL` and `/health`; all downstream plans read only the URL | none |
| K-11 | Banned vocabulary leaks through model-generated copy | M / H | runtime guard + one rewrite + template fallback; static scan over rendered DOM | none |
| K-12 | Video overruns 165 s | M / H | estimator in DP-SCRIPT WU-04; the ONE PAUSE shows the per-segment estimate; finalizer fails loudly rather than speeding audio | operator message |
| K-13 | Privacy optics of "watching Mum" | M / H | consent scopes, human-only grants, approval gates, quiet-hours wording, no face recognition, bundled data labelled synthetic | Consent panel |

**Degraded-demo ladder (each rung is visible, never silent):**
1. Live Ring + live Bedrock. 2. Live Ring + Vertex fallback (labelled). 3. Bundled week + live Bedrock. 4. Bundled week + golden-cache replay of the last real Bedrock run (labelled "replaying a recorded run"). 5. Manual runner — every one of the 20 actions runs from its schema with no model at all.

---

## §6 Reconciliation notes (where sources disagreed, which side won)

- **R-1 LLM provider.** The engine prompt says an embedded LLM is "Gemini via Vertex AI where the brief does not mandate one". The brief mandates Ring and the winning plan mandates Amazon Bedrock/Strands for the AWS Builder mini-challenge (a documented-integration requirement). **Bedrock wins for the product runtime**. Gemini via Vertex remains (a) the labelled fallback rung and (b) build/test tooling (images, TTS, visual review, evals), exactly as AI ACCESS SPEC §3 allows.
- **R-2 Action count.** WPP prose says 18, its own table lists 20. **20 wins** (Read 6, Change 5, Verify 2, Navigate 3, Collaborate 2, Cross-boundary 2).
- **R-3 Quiet hours.** WPP: 22:00–07:00 ±30 min. The effective window used by the rule is **22:30–06:30** (inner edge after tolerance), stated once in `EFFECTIVE_QUIET_HOURS` and shown in the UI as "22:00–07:00 (±30 min)".
- **R-4 Theme.** The product ships a light "paper" and a dark "dusk" theme; the **video theme is `paper`** (video-config default, DP-V9).
- **R-5 Narrator voice.** The live spec pins `--voice Iapetus --style "Confident documentary narrator."`; the script spec's recommended style text is the pinned one.
- **R-6 Call arithmetic.** Model calls in the core run: extractor 2 + planner 1 + actor ≈ 8 (act) + 3 (repair) + 4 (checkpoint) + narrator 3 = ≈ 21 entries; floors are ≥ 15 model entries and ≥ 4 roles (extractor, planner, actor, narrator).
- **R-7 Slide 1 evidence.** Slide 1 quotes `frust-0001` or `frust-0002` from `mined_frustrations.json` (dated, attributed, with community and score) and names persona-01; DP-SCRIPT WU-08 reads the file rather than relying on any copy in this blueprint.
- **R-8 Cost module language.** The chassis cost module is Python-only; the Node product reaches it through a JSON-lines sidecar, with a degraded counter when python is absent.
- **R-9 `/watch` and `/lab` ownership.** DP-UI owns the shell and routes; DP-SHOWCASE owns the `/watch` page body; DP-3D owns the `/lab` page body. DP-UI imports both by path and ships temporary one-line placeholder components in its WU-04 that the owners **replace in place**.
- **R-10 Webhook payload shape.** The published docs were summarised at plan time; the normalizer is deliberately tolerant (reads `type` or `event_type`, `timestamp` or `meta.time`, `attributes.component_ids` default `[0]`) and DP-RING-INTEGRATION WU-01 re-checks the shapes against the live docs and the `ring-api-helloworld` sample before anything else is built.
- **R-11 Composition root.** The showcase spec says "build the app's composition root as `createSession()`". `createAppSession` (DP-AGENT-WORKFLOW) is that composition root: it calls `createSession` (DP-DOMAIN-ENGINE) with `registerDoorstepActions`. `/` and `/watch` both call `createAppSession`.
- **R-12 Model client of the hee agent-workflow spec.** The kit spec says the model route uses `handleAgentStep` and `createVertexClient`. `handleAgentStep` is used unchanged; the client passed to it is the Bedrock client (same `generate` signature), per R-1. `createVertexClient` is used only as the labelled fallback client.
- **R-13 Server runner.** The server runs under `vite-node` (not `tsx`), because the chassis modules and kits import through the `src/…` alias that `vite.config.ts` defines; `vite-node` is already pinned in the repo, `tsx` would add a second resolver to keep in sync.
- **R-14 Webhook outage story used by the bundle.** The bundle tells one coherent story: webhooks arrive Monday to Thursday 14:02; from then on the receiver is silent; the poller recovers Thursday 13:52 onward from Event History with a deliberate 10-minute overlap, which is what creates the seeded duplicate burst (three events seen by both channels). The recovery code is `pollHistory` of `src/domain/gaps.ts` (C-29); the contract server (C-48) replays the same story, and RING WU-08 proves the failover over the live port against it.
- **R-15 Architecture proofs in `architecture.json`.** DP-API-TRANSPORT's `at-07` check 4 asserted the skeleton ships zero proofs, but §3.7 WU-11 harvests proof lines INTO `architecture.json`. **E2E wins after it runs:** the contract is that every proof present is a harvested one (`{ file: logs/proof.log }` with its text on its own log line, the same assertion as `e2e-11` check 8). `at-07` check 4 was updated to that wording; hand-written proofs still fail. Recorded 2026-10-10 during DP-SHOWCASE entry (blocker triage).
- **R-16 Replayable perceive ingests.** The orchestrator's perceive-phase `ingest_events` store dispatch recorded an argless `agent`-sourced trace entry for an action no registry implements, so the showcase-replay kit (which replays agent/human registry calls and stops at the first argless one) could never replay a `runWeekReview` trace past its sixth entry. **SHOWCASE wins the replay contract:** (a) `dispatchTraced` now keeps `args` on the entry, mirroring the registry's keep-under-2000-chars convention from the kit's own trace types; (b) the perceive ingest is sourced `"system"` like `set_devices` and the background merges — it is deterministic plumbing, not an agent decision, and the replay skips system effects; (c) the repair phase's deterministic tail (bulk merges + re-verify, ~90 calls) is sourced `"agent"` — it is part of the agent workflow, and sourced `"system"` the replay skipped it and could never converge to the recorded end state (91 errors remained). Floors, depth bar, validator, proof-pointer checks and the activity-feed workbench audit are all kind-based or synthetic and unaffected (re-verified by `aw-10`, `e2e-12`, `ui-08`, `sc-03`). Recorded 2026-10-10 in DP-SHOWCASE WU-03.

