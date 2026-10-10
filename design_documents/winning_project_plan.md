---
title: Doorstep Rhythm — a caretaking companion for the solo-living doorway
persona: Long-distance daughter watching solo-living mum
sponsor_tracks: ["Ring", "AWS Builder"]
grounded: true
---

## Executive Pitch

**Thesis:** Doorstep life is rhythmic and irregular, which is why a distant daughter cannot judge a quiet day without Ring event streams interpreted over time.

Mum is 84, fiercely independent, and a train ride away. Every quiet day raises the same unanswerable question: is this her normal rhythm, or the start of a crisis? Daily check-in calls feel like surveillance to parents who have managed alone for decades. Doorstep Rhythm answers from the doorway instead of the phone: it turns Ring motion, doorbell-button and device-status events into a calm household-rhythm timeline, learns what normal looks like for THIS house, and has an agent triage the moments that break the rhythm — explained in plain language, with a human approving every outbound nudge. The build runs on the Ring track stack (Amazon Vision REST APIs, signed webhooks, WHEP live video) with triage reasoning on Amazon Bedrock via the Strands SDK, entered primarily in the Ring track and secondarily in the AWS Builder mini-challenge.

On Tech Implementation the repo imports and actually calls the Ring surface (discovery, status, capabilities, event history, webhooks, live sessions) plus Bedrock, all visible in server logs the demo narrates. On Design the product is one calm timeline with large-type accessibility and human checkpoints, proven by a golden demo capture. On Potential Impact one named persona — the long-distance daughter of a solo-living senior — carries a credible per-household subscription and per-door care-operator story. On Quality of the Idea this is the rules' creative side (caretaking monitoring, accessibility aid, event-based triggers), never the obvious motion alert or bare live view.

## Problem Framing

Grounded evidence from r/AgingParents (2026-08): an adult child describes fiercely independent 80-something parents where mum declines fast while dad denies anything changed — from a distance, nobody can distinguish a slow day from an emergency, and the workaround (daily surveillance-style phone calls) erodes the parent's autonomy while still missing silent crises. A second record (r/AgingParents, 2026-09) shows the early-signal problem: a senior with mobility loss leaves small dropped items lying around because picking them up is no longer possible — decline announces itself in tiny ambient signals long before anyone calls for help. Severity: missed days convert directly into late-discovered falls and hospitalizations; workaround cost is daily anxious calling plus periodic emergency trips. This pain maps to the Ring track's judging language exactly: a credible, specific case for solving a customer need (caretaking monitoring for solo-living seniors) that could realistically serve an audience far beyond the hackathon.

## AI Solution

Doorstep Rhythm keeps one stateful model — the household week: expected routines, visitor threads, quiet hours, consent scopes and device health — fed by Ring webhooks (motion_detected with human sub-type, button_press, device_online/offline), backfilled by Event History polling when webhooks drop, and enriched on demand by WHEP live sessions and image snapshots. Capabilities: (1) rhythm learning over rolling weeks on Bedrock; (2) anomaly triage with plain-language explanations; (3) human-gated nudges (family message, gentle chime announcement where the Chime Controls capability exists); (4) visit/incident records the family approves; (5) a 3D doorway timeline rendering the same model.

### Agentic Workflow & Call Graph

| Stage | Role | Model / source | Input → Output | Rounds / fan-out | Stop condition | Visible as |
|---|---|---|---|---|---|---|
| Perceive | extractor | Gemini via Vertex AI | webhook batch + history → typed doorstep events | 2 per incident | events typed or degraded visibly | timeline pulses |
| Plan | planner | Gemini via Vertex AI | typed events + week model → triage plan | 1 per incident | plan references truth-engine check | agent badge reasons |
| Act | actor | Gemini via Vertex AI | plan → store actions (note, flag, clip fetch, snapshot) | 14 across incident | actions applied with revision bump | feed entries stream |
| Verify | deterministic | truth engine (code) | week model → Issue[] with units | 2 per incident | zero errors or listed warnings | badge count drops |
| Repair | actor | Gemini via Vertex AI | Issue[] → corrective actions | 1 per incident | re-verify passes | corrected pillar animates |
| Explain | narrator | Gemini via Vertex AI | resolved incident → family-language summary | 1 per incident | summary approved at checkpoint | summary card renders |
| Checkpoint | human | caretaker in UI | pending nudge → Approve / Reject + reason | 1 per incident | human decides or timeout releases | approval bar |

Expected total for one core demo run: 2 perceive + 1 plan + 14 act + 2 verify + 1 repair + 1 explain = 21 model calls, plus 1 human checkpoint. Three distinct model roles (extractor, planner, actor/narrator), one verify → repair round driven by the truth engine, one human checkpoint: the depth floor is cleared with margin, and the shape is never one-planner-plus-summary.

### Action Surface

| Group | Actions |
|---|---|
| Read | list_devices, get_device_status, get_capabilities, get_configurations, get_event_history, get_issue_summary |
| Create/Change | file_incident_note, set_quiet_hours, grant_weekly_consent, request_live_session, fetch_snapshot |
| Verify | check_week_model, reconcile_webhook_gap |
| Navigate/View | focus_event, set_view, list_incidents |
| Collaborate | propose_family_nudge, record_checkpoint_decision |
| Cross-boundary | play_chime_announcement (destructive, approval-gated), export_weekly_brief |

Total actions: 18. Destructive actions (play_chime_announcement, export_weekly_brief) pause behind the approval bar with Approve / Reject; rejection returns an actionable sentence the agent continues from. The onboarding procedure (Playground token → device discovery → webhook registration → baseline week) rides in the description of the first-called read action and is also returned by a get_capabilities-style read action.

Why this stack wins the chosen track(s): every Ring capability above maps to a track requirement — discovery/status/capabilities prove runtime use of the required APIs; webhooks with HMAC verification plus history failover prove event-based triggers; WHEP sessions and snapshots prove device-capability leverage; chime playback proves the accessibility-aid creative category; Bedrock triage with documented integration proves the AWS Builder mini-challenge.

## Why Now

Could this have been built 2y ago with forms+DB and no AI? No — static thresholds cannot learn a household's irregular rhythm or explain an anomaly in plain language across weeks of messy doorstep events, and without the now-public Ring developer platform (documented webhooks, component addressing, simulator-tested onboarding) there was no lawful resident-data stream to reason over at all. The sponsor timing is uniquely winnable because this is the first hackathon where Ring is open to outside developers, so caretaking depth on Ring has no entrenched prior art.

## Target Persona

A long-distance daughter (40s–50s) whose mother (80s) lives alone and refuses anything that smells like surveillance — grounded in r/AgingParents records from 2026-08 and 2026-09 showing independent parents, denied decline, and ambient early signals. Her situation, not her demographics, defines her: she needs to know the difference between a quiet Tuesday and a crisis Tuesday without calling every day. Focusing on this ONE persona maximizes Potential Impact because she is the buyer (subscription), the distributor (recommends to siblings and care circles), and the template for the operator tier (assisted-living doors). Track fit: she is precisely the caretaking-monitoring customer the Ring track's creative categories describe.

## Business Value

- specific_user: Long-distance adult children of solo-living seniors in Ring-camera households.
- tam_figure: estimate — validate during build (anchor: Ring installed base plus home-care monitoring spend; no invented figure carried).
- revenue_model: B2C per-household monthly subscription plus B2B per-door licensing to small assisted-living and property-management operators.
- why_ai: Only an agent holding cross-week state can separate rhythm from anomaly and explain it kindly; thresholds page at 3am, humans burn out, and no static rule knows that Mrs. Alvarez never answers the door before her Thursday program ends.

Track ROI: focusing on Ring plus AWS Builder maximizes prize EV because the same Bedrock-powered triage that evidences Tech Implementation also satisfies the AWS Builder documented-integration rule on the identical codebase — one build, two prize pools, zero dilution — while a third track would split the demo story and halve rehearsal time for no additional reachable prize (Open Source stays a free side artifact, not a focus).

## Architecture

The engine layer is a backend service (server-to-server only, per Ring CORS rules) with a webhook receiver, an Event History reconciler, a Bedrock/Strands triage agent operating the visit/incident store through the 18 typed actions, a deterministic truth engine consulted after every act batch, a web timeline UI plus the signature 3D doorway view, and a DEMODRIVE-captured golden path with mock-envelope replay for offline survival. Agent/LLM responsibilities: extractor types events, planner proposes triage, actor mutates only through store actions, narrator explains; validity, arithmetic, quiet-hours math and consent all live in code. Prompt boundaries: one full prompt per model role, JSON-schema-validated outputs, one retry with validation errors, then visible degradation. Corpus: the brief's capability map plus Ring API docs; no RAG corpus needed beyond docs. UI states: live timeline, incident focus, approval bar, 3D overview/focus shots, degraded banner. Deploy proof: localhost runnable plus an optional public URL; the video shows the Playground-token run against simulator events, satisfying the platform proof rule.

### Truth Engine

Pure functions over the week model producing Issue[] with id, severity, entity ids, human message with units, and suggested fix action. Rules: quiet-hours violation (events during 22:00–07:00 local ±30 min tolerance); dwell anomaly (linger >15 min vs personal baseline p90); outage vs quiet (device_offline >30 min escalates, else informational); consent scope (unapproved contact methods blocked); duplicate suppression (same request_id or ±60 s same-type bursts merged). The agent calls check_week_model after every act batch and repairs what it reports; the human sees a Check panel with a count badge. The demo's deliberate error: a seeded duplicate motion burst that the engine merges while the agent narrates the repair.

### Demo Inputs

- Live Ring Developer Playground events (motion_detected with human sub-type, button_press, device_online/offline) via short-lived Playground token — source: operator's own Playground session at https://developer.amazon.com/ring/console/playground; terms: personal testing token, ~30 min life, regenerated live; the judge can generate their own token the same way.
- Bundled anonymized 14-day doorstep event set (JSON) — source: synthesized from the shape of real Playground payloads for deterministic replay; licence: created for this entry, MIT, labelled synthetic in UI and README because no real senior's doorway data may ship.
- Seeded duplicate-burst error case — source: same bundle; used only for the verify → repair beat.

### Mandated Technology Leverage Map

| Capability | Tier | Used for (product reason) | Visible where (screen / feed / video beat) |
|---|---|---|---|
| Webhook motion_detected + sub_type human | core | primary rhythm signal | timeline pulses / 0:20 beat |
| button_press | core | visit/check-in affordance | incident cards / 0:45 beat |
| device_online/offline webhooks | advanced | outage-vs-quiet truth rule | health strip / 1:10 beat |
| HMAC-SHA256 webhook verify + idempotency | core | tamper-proof ingest | feed badge per event / code walk |
| Event History polling failover | advanced | gap-night coverage | seam-stitched ribbon / 1:30 beat |
| Device discovery + status + capabilities | core | capability gating + health | setup screen / code walk |
| WHEP live session start/stop | core | on-demand visual check | video panel / 1:50 beat |
| Image snapshot download | advanced | low-bandwidth triage | incident thumbnails |
| component_id multi-camera | frontier | visitor threads across cameras | 3D arcs / 2:00 beat |
| Chime audio playback | frontier | gentle reassurance actuator | checkpoint-gated play / 2:10 beat |
| One-way account linking + staging users | advanced | lawful consent + test parity | consent screen |
| Ring Appstore MCP + Playground token | core | build velocity + day-0 run | README + 0:00 beat |

Coverage: 12/14 product-relevant (86%) — advanced: 4, frontier/open-question: 2. Beyond the sample: the organizer's sample streams one camera and echoes webhooks, while this entry fuses multi-camera threads, learns household rhythm, and gates caring actuators behind a truth engine and human checkpoints.

### Signature 3D Experience

- **Subject:** the household doorway week — stoop geometry, camera frustums, and event pillars on a time axis (spatial + time-series height-field treatment).
- **Why 3D:** the schedule of doorstep life is spatial — a flat log cannot show where visitors lingered and for how long.
- **Live binding:** webhook arrivals raise pillars and pulse frustums; triage recolors them; approve/reject animates the chime/notify action; selection syncs both ways with the 2D timeline and feed.
- **Stack:** three.js via @react-three/fiber + drei (OrbitControls, Environment) + postprocessing (SSAO/Bloom); instanced pillars; no new brand colors beyond the UI token set.
- **Shots:** overview, focus:event, walk (eye-level stoop), with 600–1200 ms eased transitions exposed on window.__demo3d.
- **Hero frame:** a dusk-lit stoop with one amber unknown-linger pillar pulsing while the agent's reasoning badge rests beside it.

### Hackathon Requirements & Compliance Matrix

| Requirement | Brief Verbatim | How This Plan Satisfies It | Judging Axis Evidenced |
|---|---|---|---|
| Mandatory Technologies | Ring APIs/SDKs/simulators/devices; repo must import and actually call them | Backend imports Ring REST, verifies webhooks, opens WHEP sessions; AWS Bedrock via Strands called for triage | Tech Implementation |
| Prize Tracks | Ring 1st $12,000 / 2nd $8,000; AWS Builder $5,000 + $5K credits | Primary Ring, secondary AWS Builder with documented integration | Quality of the Idea |
| Judging Axes + Weights | Tech Implementation, Design, Potential Impact, Quality of the Idea, equally weighted | Axis strategy per section; friction-log bonus pursued | All four |
| Submission Gate | Text description; GitHub repo; <3-min video; product feedback; track selection; pre-existing delta; optional feature requests + friction logs; testing access | Public GitHub repo with run instructions; Playground-token video <3 min; feedback + friction logs drafted from day 1 | Presentation via video |
| Rules | New or significantly updated; original work; IP stays with entrant; English; no post-deadline edits | Fresh repo, window-spread commits, PROVO disclosure of chassis reuse + AI assistance | Eligibility |

### Sponsored Track Strategy (1–2 tracks)

Focus: 2 tracks — Ring plus AWS Builder, justified because the Bedrock triage that carries the product's intelligence simultaneously satisfies the AWS Builder documented-integration rule on the same codebase, so the second track costs writing time only and doubles reachable prize. Ring: highest win-probability fit because caretaking monitoring plus accessibility aid plus event-based triggers are the rules' named creative categories; the imported-and-called surface is the Amazon Vision REST API (devices, status, capabilities, history, WHEP sessions) with HMAC-verified webhooks; the demo makes Ring the co-star with live event overlays and a status indicator on screen. AWS Builder: Bedrock (via Strands SDK) powers every triage call with the integration documented in the feedback answer; the demo's agent-reasoning badges name Bedrock on each call. Open Source is deliberately not a focus: a small upstream helper may ship, but chasing it would dilute rehearsal.

Bonus/Submission Gate: repo public on GitHub with license, setup/run instructions and Playground-token flow; video under 3 minutes opening on the working timeline; product feedback per SDK plus friction-log entries filed from day 1 for the bonus; testing access via locally runnable repo; no bonus integration beyond the two focus tracks — no bonus-chasing dilution.

## Suggested Module Emphasis

Consider the platform layer for the timeline UI, typed event-streaming bus and one-command deploy helper, because the judges must see live state and a public URL strengthens the Design axis. Consider the context buffer for the multi-week household model that must stay inside model context during long triage runs. Consider the cost guardrail because every triage call is metered and a runaway loop must never burn the demo budget. Consider the resilience wrapper for every Ring and Bedrock call with golden-cache replay, because the demo must survive venue Wi-Fi via the degraded ladder. Consider media/vision only if frame understanding joins the demo, since snapshots alone need no model. Consider provenance and ideation tooling for disclosure, deck, script, golden capture and Q&A, because packaging is judged. Suggest nothing else: the product's depth lives in its own visit model, truth engine, agent workflow and 3D doorway, not in chassis plumbing.
