# hackathon_brief.md — 2026-10-amazonDevs (Build, Ship, Shape: Amazon Developer Hackathon, Devpost) — Ring track

> **Provenance:** transcribed on 2026-10-05 as the DEFINITIVE kickoff-day version from https://amazonappdev2026.devpost.com
> (tabs read: Overview, Resources, Rules at `/rules`, Schedule/Dates at `/details/dates`, FAQs at `/details/faqs`, Updates at `/updates`, Project gallery at `/project-gallery`, Discussions index at `/forum_topics`).
> Binding linked pages consulted: Official Rules text (Sep 16, 2026 code-repository update incorporated); Ring Developer Experience docs at https://developer.amazon.com/docs/ring/get-started.html and https://developer.amazon.com/docs/ring/api-documentation.html; starter sample https://github.com/AmazonAppDev/ring-api-helloworld; Ring Appstore at https://ring.com/appstore; AWS Builder Center at https://builder.aws.com/.
> Convention: items marked `[unconfirmed]` were not published on the event page at transcription time — re-check the event page / office hours / Discord before relying on them.
>
> Purpose: single paste-input for `src/profile` (Event Profile Extractor) and `src/pgm` (Problem Grounding Engine), per TU16 (`docs/tutorials/TU16-mock-hackathon-walkthrough.md`).
>
> Track decision (operator): **Ring primary track**. All annotations below assume a Ring-track entry, optionally layering the AWS Builder and/or Open Source mini-challenges on the same project.

---

# Build, Ship, Shape: Amazon Developer Hackathon — Official Brief

**Build across Amazon Devices and shape what's next.**

🌎 Online Hackathon · 💻 Fully online + public · 📅 Submission window 2026-08-31 → 2026-10-23 · 🏆 $138,000 cash + AWS credits (~$190K total advertised value)

For the first time, Fire TV, Alexa+, Ring, and Bee are all part of one global hackathon. Build for one product or use several to connect the living room, the front door, and the cloud. This entry targets the **Ring track** (primary), optionally layering the AWS Builder and/or Open Source mini-challenges with the same project, and submits a working demo, code repo, and product feedback by the deadline.

## Challenge / tracks / paths (summary — see §4 for verbatim)

Four primary tracks (Fire TV, Alexa+, Bee, Ring) + two stackable mini-challenges (AWS Builder, Open Source); each project can win at most one track prize and one mini-challenge prize. **This entry: Ring primary.** Ring = working app or new feature using any Ring API/SDK/simulator/device, demoed via simulator or real device; no physical device required. Priority categories: access control, business systems, IoT home automation, accessibility, caretaking — see §4 for verbatim.

## Mandated technology + credits/keys (summary — see §4 for verbatim)

Ring mandated tech: any Ring API/SDK/simulator/device listed in Ring developer docs (REST at `https://api.amazonvision.com`, OAuth at `https://oauth.ring.com`, webhooks with HMAC-SHA256, WHEP/RTSP live video, media-clip/image-snapshot download, Event History, sensors/chimes, Developer Playground short-lived token, `ring-api-helloworld` starter). Repo must import-and-call the tech at runtime. $150 AWS credits per individual via request form (two URLs published — see §4), cutoff 2026-10-21 12:00 PDT — see §4 for verbatim.

## Official resources

- Amazon Developer documentation: https://developer.amazon.com/docs/apps-and-games/documentation.html
- Sample code on GitHub: https://github.com/AmazonAppDev (Ring starter: https://github.com/AmazonAppDev/ring-api-helloworld)
- Amazon Devices Builder Tools (MCP server + Agent Skills): https://developer.amazon.com/docs/vega/0.24/mcp-server
- Ring: https://developer.ring.com — Get started https://developer.amazon.com/docs/ring/get-started.html; API reference https://developer.amazon.com/docs/ring/api-documentation.html; UX design guide; live apps https://ring.com/appstore; Developer Playground (short-lived ~30-min token, no app registration needed); Ring community https://community.amazondeveloper.com/c/ring/53
- AWS: https://builder.aws.com/ + https://builder.aws.com/learn
- Community: https://community.amazondeveloper.com/, YouTube https://www.youtube.com/channel/UCT9ApARFgQJOeqD-ygmxnJQ, dev.to https://dev.to/amazonappdev, newsletter https://m.amazonappservices.com/hackathon-subscribe
- Build Session recording https://youtu.be/ws61g53S2b4 (2026-09-03 session)
- Office hours: #1 Tue 2026-10-06 12:30–13:30 CT (10:30 PT) and #2 Mon 2026-10-19 11:00–12:00 CT (09:00 PT), registration via Zoom links on Updates tab (see §4)
- Discord https://discord.gg/devpost
- $150 AWS credit request form: Resources tab prints https://forms.gle/GaHFxSbBQNG9Kti6A; Official Rules print https://forms.gle/5hyhr1u6x3fuV2aW7 — treat as ambiguous, confirm in Discord/office hours (see §4)

## Prizes

$138,000 cash + AWS credits (~$190K total advertised value). 12 prizes: Fire TV 1st $25,000 + $15K credits, 2nd $15,000 + $5K credits, 3rd $4,000 + $1K credits; Alexa+ identical 25K/15K/4K ladder; Bee 1st $12,000 / 2nd $8,000 (no credits); **Ring 1st $12,000 / 2nd $8,000 (no credits)**; AWS Builder $5,000 + $5K credits; Open Source $5,000 + $5K credits. 1st-place track + both mini-challenge winners also get a 1:1 meeting with the Amazon Developer team and featuring on Amazon Developer channels. Max one track + one mini-challenge prize per project.

## Schedule

| What | Date/time (as published, America/Los_Angeles) | UTC | Europe/Helsinki |
|---|---|---|---|
| Submissions open | 2026-08-31 10:15 PDT | 2026-08-31 17:15 UTC | 2026-08-31 20:15 EEST |
| Build Session (held) | 2026-09-03 11:00 PDT | 2026-09-03 18:00 UTC | 2026-09-03 21:00 EEST |
| Office hours #1 | 2026-10-06 10:30 PDT | 2026-10-06 17:30 UTC | 2026-10-06 20:30 EEST |
| Office hours #2 | 2026-10-19 09:00 PDT | 2026-10-19 16:00 UTC | 2026-10-19 19:00 EEST |
| AWS credit request cutoff | 2026-10-21 12:00 PDT | 2026-10-21 19:00 UTC | 2026-10-21 22:00 EEST |
| Submissions close (hard deadline) | 2026-10-23 12:00 PDT | 2026-10-23 19:00 UTC | 2026-10-23 22:00 EEST |
| Judging (Schedule tab) | 2026-10-26 12:00 PDT → 2026-11-20 12:00 PST | 2026-10-26 19:00 UTC → 2026-11-20 20:00 UTC | 2026-10-26 21:00 EEST → 2026-11-20 22:00 EET |
| Judging (Rules text §1 — conflicts, see §4) | 2026-11-09 12:00 PST → 2026-11-20 12:00 PST | 2026-11-09 20:00 UTC → 2026-11-20 20:00 UTC | 2026-11-09 22:00 EET → 2026-11-20 22:00 EET |
| Winners announced (on/around) | 2026-12-03 12:00 PST | 2026-12-03 20:00 UTC | 2026-12-03 22:00 EET |

## Teams & participation

- Open to individuals (age of majority in country of residence), teams (no maximum size stated), and organizations; one Representative submits per team/org; one person may join multiple teams and also enter solo.
- Fully online, public, worldwide EXCEPT residents of / orgs domiciled where US or local law prohibits (named: Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea + any OFAC-comprehensively-sanctioned country).
- Excluded: Promotion Entities, their employees/representatives/agents + households, judges and their employers, affiliates, anyone creating a real/apparent conflict of interest.
- Register via "Join Hackathon" on the Devpost page (free Devpost account). 42,106 participants listed on 2026-10-05.

## What to submit (EXACT submission fields via Devpost "Enter a Submission")

1. Project text description (features + functionality).
2. GitHub code repository URL (GitHub ONLY — no GitLab/other hosts) with all source, assets, run instructions; public + open-source license file (detectable in About section) OR private shared with `testing@devpost.com` + 6 Amazon reviewers (chris-trag, knmeiss, giolaq, anishamalde, mosesroth, emersonsklar); add invites near submission (expire after 7 days). Must show runtime use of Ring APIs/SDKs (imported and actually called — library import, app/backend entry point, or loaded agent/flow config — not just README mention); demo via simulator or real device in video.
3. Demo video: YouTube or Vimeo, public, in English (or English translation provided), under 3 minutes (judges not required to watch past 3:00), must show the project functioning on its target platform; no third-party trademarks/copyrighted music/footage without permission.
4. Product feedback for EVERY tool/API/SDK used (what used for, what worked, what needs work, onboarding zero→hello-world, would-you-build-again yes/no + why; AWS services described here too).
5. Primary track selection (this entry: Ring).
6. Mini-challenge opt-ins (zero or more) + their extra fields: AWS Builder → which AWS services + how (in feedback answer); Open Source → contribution URL + repo URL + GitHub username + what/how/why description.
7. If pre-existing project: clear explanation of what was built/changed during the submission window.
8. Optional: feature requests (description, why it matters, priority Critical/Important/Nice-to-have).
9. Optional: friction-log entries (task, steps, expected vs actual, severity, workaround, actionable suggestion) — earns up to 10% judging bonus.
10. Testing access: project free of charge, unrestricted for sponsor/admin/judges through end of Judging Period; include login credentials if private; hardware-gated projects may be asked for physical access.

## Judging criteria

Two stages. Stage 1: pass/fail viability (fits theme + reasonably applies required APIs/SDKs). Stage 2: all passing submissions scored on four EQUALLY weighted axes (no numeric weights published), tie-broken in listed order, plus a friction-log bonus of up to 10% recommended by internal review:

| Axis | What judges look for |
|---|---|
| Tech Implementation | How well built; how effectively it uses the required tech/APIs/SDKs/device capabilities for the Ring track (or mini-challenge) |
| Design | Complete, coherent product experience; intuitive, well-considered interaction model for the target device/platform |
| Potential Impact | Credible, specific case for solving customer needs; could realistically serve an audience beyond the hackathon |
| Quality of the Idea | Creative, imaginative use of required tools; genuine understanding of the developer ecosystem + end-user needs in the Ring track (rules list obvious-vs-creative examples per track — see §4) |

Judges panel selected by sponsor (may be employees or third parties, may change, may not be listed); methodology may include expert panels, peer review, or automated AI-driven analysis. Panel currently reads "A qualified panel of judges will be announced soon!" — no names published 2026-10-05.

## Rules highlights (summary — see §4 for verbatim)

Solo/teams/orgs eligible, no max team size; newly created OR significantly updated projects (must explain + demo the delta); original work solely owned by entrant, open-source reuse allowed per licenses; no financial/preferential sponsor support; IP stays with entrant (+ non-exclusive judging/promotion license); English or English translation; draft saves allowed, no edits after deadline except sponsor-permitted fixes; full liability/release/arbitration terms in Official Rules — see §4 for verbatim.

---

## My annotations (NOT part of the official brief)

### Kickoff updates (2026-10-05) — Ring track decision

- What changed versus the prep version (`hackathon-projects/2026-09-amazonDevs/hackathon_brief.md`, 2026-09-22): that brief recommended **Alexa+ primary + AWS Builder** (no-device, pure-software reasoning). Operator has now decided **Ring primary**. All Alexa+ play notes are superseded; Ring play below replaces them.
- Prep-phase guess right: challenge DEFINED (no kickoff-stream reveal pending); submission fields, <3-min video, GitHub-only repo, runtime-tech hook, friction-log bonus, $150 AWS credits, and deadline 2026-10-23 12:00 PDT all re-confirmed fresh today against Overview/Rules/Resources/FAQs/Schedule/Updates tabs.
- Prep-phase guess wrong in one detail: prep brief carried FAQ-era judging dates loosely; fresh read surfaces a **direct conflict** — Rules §1 prints Judging "November 9, 2026" start while the Schedule tab prints "October 26, 2026" start (end 2026-11-20 both). Treat Schedule tab as operational and Rules text as possibly stale; confirm at office hours #1 (2026-10-06). Does not affect build plan.
- New kickoff-only facts logged: 42,106 participants (2026-10-05); gallery still unpublished ("hasn't published this gallery yet"); judges still unnamed; office-hours dates fixed (Oct 6 + Oct 19); Updates tab confirms two AWS-credit form URLs in the wild (Resources vs Rules) — use Resources link, confirm live.
- Feasibility go/no-go: GO on Ring (see participation logic) — simulator/Playground path removes the hardware blocker; `ring-api-helloworld` gives a runnable day-0 baseline; scope fits solo + offline-fallback constraints.

### Prep-phase notes (superseded where contradicted by kickoff facts)

- Prep play was Alexa+ (MCP server + web simulator + Bedrock/Strands, stacking AWS Builder) because Bee required owned hardware and Ring looked weaker on chassis overlap. Retained as fallback: if Ring API onboarding (developer account + Playground token + webhook endpoint) stalls >1 day, pivot to Alexa+ simulated-experience path on the same AWS Builder spine. Otherwise Ring stands.

### Recommended play: Ring primary (+ AWS Builder mini-challenge) — `[GUESS]` product, DEFINED track

**Working title `[GUESS]`:** *Doorstep Care* — a caretaking-first Ring companion for independent-living households.

- **Specific user persona:** an adult child caring for an aging parent living alone, whose front door already has (or can get) a Ring doorbell/camera. Secondary persona: a small assisted-living operator managing 5–20 entrances `[GUESS — to validate in PGM]`.
- **What it does:** a web app + backend that turns raw Ring doorstep signals into a calm caretaking picture: (1) ingests `motion_detected` (with `sub_type` e.g. human), `button_press`, `device_online/offline` webhooks plus Event History polling fallback; (2) an agent triages every event through a stateful **visit/incident model** (expected visit vs unknown linger vs missed check-in vs device outage) with a deterministic truth engine (quiet-hours rules, dwell thresholds, consent scopes); (3) caretaker gets one timeline ("Mum's nurse arrived 09:02, stayed 25 min; unknown linger 14:10 resolved by neighbor confirm"), package/delivery handoffs, and accessibility aids (large-type doorbell announcements, chime audio playback where capability allows); (4) human checkpoints gate every outbound action (notify family, play chime message, open access-control window); (5) multi-camera awareness (`component_id`) for houses with 2+ cameras `[GUESS — product shape, to validate in PGM/PAS]`.
- **Why AI / why now:** Ring exposes events + video but no *meaning*: every entrant can show a motion alert; none answers "is this normal for THIS household?" An agent that holds cross-event state, learns the household rhythm, and explains its triage in plain language is exactly what single-webhook demos cannot do — and the rules explicitly reward it as "creative" (non-security use case: accessibility aid, caretaking monitoring, package/delivery management, business-system access control, multi-camera pipeline, event-based triggers). Ring's first-party Appstore surfaces (business intelligence, home analytics, elderly-care monitoring, pet wellness) prove the demand wedge without shipping this product.
- **Business value:** named user (family caretakers + small care operators); revenue model = B2C subscription per household + B2B per-door licensing to care operators/property managers; TAM anchor = Ring installed base + home-care monitoring market `[figure to pin down during PGM]`.
- **Demo story (under-3-min video):** 0:00 live webhook timeline fires (simulator motion + button press overlay) → agent triages visibly (expected vs unknown) → 1:30 human checkpoint approves a gentle chime announcement + family notify → 2:15 3D doorway timeline + truth-engine badge drops to zero open issues → 2:30 scoreboard of what ran; golden fallback = DEMODRIVE capture + localhost mock-envelope replay if venue Wi-Fi dies.
- **Track choice rationale:** Ring simulator/Playground path is hardware-free for judging (FAQ-confirmed: simulator or real device both OK; Playground issues a ~30-min token with no app registration); priority categories (caretaking, accessibility, access control, business systems) map 1:1 onto the chassis (stateful model + truth engine + checkpoints + 3D timeline); stacks the $5K AWS Builder mini-challenge on the same codebase (Bedrock/Strands triage + AgentCore/webhook infra); Open Source mini-challenge available nearly free (upstream a small Ring webhook-verify or WHEP helper with tests).
- **Depth bar (per `templates/product-depth.spec.md`) `[GUESS]`:** real input = the judge's own Ring Playground events / bundled anonymized event + clip set (synthetic only where real data impossible, labelled); stateful domain = visit/incident model with id-addressable entities, revision + undo, one store-action set shared by UI buttons and agent tools; ≥15 typed actions targeted (read/discover/status/capabilities/location/configurations/history/stream/snapshot/clip/chime-playback/verify-note/escalate/approve); multi-round workflow = perceive → plan → act → verify (truth engine) → repair → explain with ≥1 verify→repair round and ≥1 human checkpoint per incident; truth engine = deterministic quiet-hours/dwell/consent/outage checker with zero-issues regression seed; visible execution = activity feed with AGENT/YOU/SYSTEM badges + manual runner for every action.
- **Signature 3D experience (per `templates/3d-experience.spec.md`) `[GUESS]`:** Subject = the doorway as a data-driven 3D scene — house stoop, camera frustums, event pillars on a time axis (treatment: spatial + time-series height-field per §2). Why 3D: the schedule of doorstep life is spatial — a flat log cannot show *where* and *how long*. Live binding: motion/button/webhook events raise pillars and pulse the camera frustum; agent triage recolors them; human approve/reject animates the gate/chime action. Stack: three.js + R3F + drei (OrbitControls, Environment) + postprocessing (SSAO/Bloom), instanced pillars. Shots: `overview`, `focus:event`, `walk` (eye-level stoop). Hero frame: dusk-lit stoop with one amber unknown-linger pillar pulsing while the agent badge reasons beside it.

### Judging-axis strategy (how each axis gets evidenced via DECKGEN/SCRIPT/FAQDEF/SUBMIT)

- **Tech Implementation:** repo shows imported-and-called Ring surface (device discovery + status + capabilities + event-history + WHEP session start/stop + webhook HMAC verify + chime playback where entitled) with logs; SCRIPT narrates the live webhook→triage trace; FAQDEF pre-answers "is this just a README mention?" with code pointers + Playground token flow.
- **Design:** one caretaking timeline (large-type, calm, accessibility-checked against the Ring UX design guide); DECKGEN slot for interaction model + screenshots; DEMODRIVE golden capture proves it.
- **Potential Impact:** one named caretaker persona + Ring Appstore distribution analogy (elderly-care monitoring tile exists); SUBMIT description carries the credible-customer paragraph; FAQDEF holds the beyond-hackathon answer (per-door licensing).
- **Quality of the Idea:** frame against the rules' obvious-vs-creative list (caretaking/accessibility/package/business-system/multi-camera/event-triggers, NOT motion alert or bare live view); prior-art scan (PAS/harvest) must confirm distinctness within Ring gallery once published.
- **Bonus:** file friction-log entries from day 1 (every cryptic OAuth/nonce/HMAC/WHEP error with severity + workaround) — up to +10% for near-zero extra build cost; PROVO disclosure stays clean.

### Chassis module mapping (grounded in `contracts/component-catalog.json`)

- Mandated tech → modules: Ring REST + webhooks + WHEP video → `platform` (deploy/transport/UI for timeline + video panel + 3D view; needs `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` only if public URL path chosen — else localhost + video suffices); triage LLM (Bedrock/Strands) → `context` (session buffer) + `cost` (guardrail every LLM call) + `resilience` (`withResilience` on every Ring/AWS call, golden cache for offline demo); video-frame understanding only if added → `media/vision` (needs `OPENAI_API_KEY` / Replicate key per catalog, optional — skip unless demo needs it); packaging → `provenance` (PROVO disclosure + SUBMIT formatter for the Devpost fields) + `ideation` (deckgen/script/demodrive/faqdef); verification → `dev-tooling` (mock/eval/doctor/track/bench); synthetic clips only if real Playground data insufficient → `data` (watermarked, labelled).
- Env/provider keys required: `OPENAI_API_KEY` (profile/pgm/deckgen/faqdef + optional media/data paths); AWS credentials for Bedrock/AgentCore work (covered by $150 promo credits); `RING_CLIENT_ID` / `RING_CLIENT_SECRET` / `RING_HMAC_KEY` (from Ring Developer Portal app creation — shown once, never commit) + short-lived `RING_ACCESS_TOKEN` (Playground) and `RING_REFRESH_TOKEN` (OAuth linking) for runtime; GitHub account (repo must be GitHub-hosted); YouTube/Vimeo account (public <3-min video); no Bee/Fire hardware keys under this play.
- PGM note: brief is Devpost-format (not lablab) — PROFILE/SUBMIT field map must target the Devpost fields above, not the lablab template; product-feedback + friction-log answers are first-class submission content, so PGM plan must allocate writing time for them.

### Constraints I care about this event (my notes)

- Solo entry. Online participation from Finland (EEST/EET conversions in schedule table above).
- Demo must survive bad Wi-Fi: localhost timeline + mock-envelope replay + early DEMODRIVE capture; Ring/AWS calls stubbed with golden cache, live API hit only to validate (Playground token + simulator webhooks).
- Sponsor-credit claiming: $150 AWS credits per individual (each teammate separately) via the Resources-tab form https://forms.gle/GaHFxSbBQNG9Kti6A (Rules also print https://forms.gle/5hyhr1u6x3fuV2aW7) — request ASAP, cutoff 2026-10-21 12:00 PDT, while supplies last, subject to https://aws.amazon.com/awscredits/; monitor usage; spin Bedrock resources up only for testing, tear down after (CDK/CloudFormation/Terraform). Ring access itself is free (Playground token; publishing free, 10% revenue share only if monetized per Ring docs).
- Hard deadline (absolute): **2026-10-23 12:00 PDT = 2026-10-23 19:00 UTC = 2026-10-23 22:00 EEST**; add GitHub collaborators near submission (7-day invite expiry); video <3 min or judges stop watching.
- Ring-specific gates: Ring Developer account identity verification (government ID, name must match Company Profile exactly, ≤3 attempts) before app submission features unlock; app credentials shown once; webhook endpoint must be HTTPS, accept POST JSON, verify HMAC, return 200 within 5 s; all Amazon Vision/Ring OAuth calls server-to-server (browser calls blocked by CORS); access token ~4 h, refresh ~30 d, auth code 60 s; rate limit 100 req/s per client_id (429 + Retry-After, exponential backoff from 1 s).

### Mandated technology capability map (per `templates/tech-leverage.spec.md` §1)

Source docs: Ring Partner API Documentation (https://developer.amazon.com/docs/ring/api-documentation.html), Get Started (https://developer.amazon.com/docs/ring/get-started.html), Develop/Configure/Certify/Publish guides, Developer FAQ, UX Design Guide, Ring Appstore MCP Server doc, and the organizer sample https://github.com/AmazonAppDev/ring-api-helloworld. Rows the organizer sample uses are marked — that is where every other entrant stops.

| Capability | Tier (core / advanced / frontier / open-question) | Doc link | Used by the organizer's sample? | Product-relevant? | Notes |
|---|---|---|---|---|---|
| OAuth token exchange (`POST oauth.ring.com/oauth/token`, auth-code grant, 60-s code life) | core | https://developer.amazon.com/docs/ring/api-documentation.html#authentication-endpoints | No (sample uses Playground access token) | Yes | Entry must implement exchange to outlast 30-min Playground tokens; cite token-lifecycle §5. |
| Token refresh (`grant_type=refresh_token`, access ~4 h / refresh ~30 d) | core | https://developer.amazon.com/docs/ring/api-documentation.html#authentication-endpoints | Yes (refresh-token mode) | Yes | Sample auto-refreshes; entry reuses pattern for judging-week survival. |
| One-way (Ring-driven) account linking + HMAC nonce (`HMAC-SHA256(K,"time:account_id")`, urlsafe-b64 no-pad, 600-s window, mandatory partner sign-in, POST+PATCH to `/v1/accounts/me/app-integrations`) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#6-account-linking-flow-one-way-account-linking | No | Yes | Core differentiator: most entrants never implement linking; entry demos full link flow against staging user. |
| Partner-initiated OAuth 2.0 + PKCE (invitation-only) | frontier | https://developer.amazon.com/docs/ring/api-documentation.html#authentication | No | No (gated) | Track as open-question: availability for hackathon entrants unconfirmed. |
| Users API (`GET /v1/users/me` → Account ID for nonce matching + event correlation) | core | https://developer.amazon.com/docs/ring/api-documentation.html#users-api | Yes (via scripts) | Yes | Required before nonce matching; trusted-backend channel only. |
| App-integration confirm/update (`POST` + `PATCH /v1/accounts/me/app-integrations`, `awaiting`→`completed`) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#app-integration | No | Yes | Mandatory PATCH often missed; entry exercises both steps. |
| Device discovery (`GET /v1/devices`, `?include=status,capabilities,location,configurations`, JSON:API) | core | https://developer.amazon.com/docs/ring/api-documentation.html#device-discovery | Yes | Yes | Sample lists devices; entry adds include-expansion + caching. |
| Device status (`GET /v1/devices/{id}/status`, online/offline + chime snooze) | core | https://developer.amazon.com/docs/ring/api-documentation.html#status | Yes | Yes | Feeds outage-vs-quiet truth-engine rule. |
| Device capabilities (`GET /v1/devices/{id}/capabilities`, codecs/motion/enhancements, `?component_id=N`, chime audio slots) | core | https://developer.amazon.com/docs/ring/api-documentation.html#capabilities | Yes | Yes | Entry capability-gates chime playback + stream choices. |
| Device location (coarse country/state, compliance) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#locations | Yes (script) | Yes | Used for quiet-hours timezone + compliance note. |
| Device configurations (motion/privacy zones, image settings, chime volume read-only) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#configurations | Yes (script) | Yes | Privacy-zone awareness = caretaking trust story. |
| Multi-camera addressing (`?component_id=N` / `components[]` body on Elite) | frontier | https://developer.amazon.com/docs/ring/api-documentation.html#multi-camera-devices | No | Yes | Rules reward multi-camera pipelines; sample never touches it. |
| Webhook endpoint contract (HTTPS POST JSON, HMAC-SHA256 hex `X-Signature`, 200 ≤5 s, async processing, `meta.request_id` idempotency, retry, unordered) | core | https://developer.amazon.com/docs/ring/api-documentation.html#notifications | Partial (sample receives + SSE-broadcasts; HMAC secret optional) | Yes | Entry enforces verify-before-process + idempotent store. |
| Webhook event: `motion_detected` (+ `attributes.sub_type` human, `component_ids`) | core | https://developer.amazon.com/docs/ring/api-documentation.html#motion-detection | Yes (dashboard) | Yes | Primary caretaking signal; sub_type drives triage. |
| Webhook event: `button_press` | core | https://developer.amazon.com/docs/ring/api-documentation.html#button-press | Yes | Yes | Check-in/consent affordance (visitor announces). |
| Webhook events: `device_added` / `device_removed` / `device_online` / `device_offline` | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#device-addition | No | Yes | Fleet-health truth-engine inputs; most entrants ignore. |
| Webhook events: `app_integration_added` / `removed` | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#app-integration-added | No | Yes | Consent-revocation handling = trust story. |
| Webhook events: `subscription_activated` / `deactivated` | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#subscription-activated | No | Maybe | Only if monetized path demoed. |
| Event History polling (`GET /v1/history/devices/{device_id}/events`) as webhook alternative | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#event-history | Yes (script) | Yes | Offline/degraded fallback when webhooks unreachable. |
| WHEP live video (`POST /v1/devices/{id}/media/streaming/whep/sessions`, SDP, 30-s battery / 60-s line-powered; `DELETE` closes) | core | https://developer.amazon.com/docs/ring/api-documentation.html#whep-live-video-streaming | Yes | Yes | Sample streams; entry adds snapshot-on-triage + auto-close discipline. |
| RTSP/RTSPS live stream (`rtsps://video.rtsp.amazonvision.com:322/...`) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#rtsp-live-video-streaming | No | Maybe | Fallback player path; evaluate vs WHEP complexity. |
| Media-clip download (MP4, `POST .../media/video/download`) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#media-clips | No | Yes | Evidence clips attached to incidents; sample omits. |
| Image-snapshot download (JPEG/PNG, `POST .../media/image/download`) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#image-snapshots | No | Yes | Low-bandwidth triage + 3D pillar thumbnails. |
| Chime audio playback (`POST .../media/audio/playback`, `audio_ref`, needs Chime Controls capability) + chime discovery/capabilities/status/events | frontier | https://developer.amazon.com/docs/ring/api-documentation.html#chimes | No | Yes | Gentle announcement actuator behind human checkpoint. |
| Contact / flood-freeze / temp-humidity / air-quality sensors | frontier | https://developer.amazon.com/docs/ring/api-documentation.html#sensors | No | Maybe | Whole-home caretaking extension if time allows. |
| Subscriptions Query API (`GET /v1/accounts/me/subscriptions`) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#subscriptions-query-api | No | Maybe | Entitlement gating if monetized. |
| Rate limiting (100 TPS/client_id, `X-RateLimit-*`, 429 + `Retry-After`, backoff from 1 s) + JSON:API error model (400/401/403/404/429/500/503) | core | https://developer.amazon.com/docs/ring/api-documentation.html#rate-limiting | No | Yes | Resilience wrapper + cost/eval harness hooks. |
| CORS block on browser-initiated Vision/OAuth calls (server-to-server only) | core | https://developer.amazon.com/docs/ring/api-documentation.html#overview | Implicit (sample proxies via Next.js API routes) | Yes | Architecture forcing function: backend required. |
| Endpoint configuration set (Token Exchange + Account Link + Webhook + Homepage URLs, HTTPS, staging→production) | advanced | https://developer.amazon.com/docs/ring/api-documentation.html#4-endpoint-configuration | No | Yes | Day-0 setup checklist; staging users (≤10) for test. |
| Ring Developer Playground (console token generator, ~30-min token, no registration) | core | https://github.com/AmazonAppDev/ring-api-helloworld#step-1-get-your-token | Yes | Yes | Day-0 unblocked path;-simulator equivalent for judging. |
| Ring Appstore MCP Server (AI-assisted Ring codegen in Kiro/Cursor/VS Code) | frontier | https://developer.amazon.com/docs/ring/ring-mcp.html | No | Yes | Accelerates build; disclose as AI assistance per rules. |
| UX Design Guide patterns (incl. passwordless-linking drop-off guidance) + certification bar (security/privacy/functionality, ~90% <48 h, resubmit unlimited) + publish lanes (beta/controlled/full) | advanced | https://developer.amazon.com/docs/ring/ux-design-guide.html + https://developer.amazon.com/docs/ring/get-started.html | No | Yes | Design-axis evidence + submission-risk reducer. |
| Staging test harness (≤10 staging users, Login-with-Ring, 2FA, device auth) + no official Partner SDK (curl/Postman/Bruno + fetch/requests/axios) | core | https://developer.amazon.com/docs/ring/develop.html | Partial (sample is the de-facto SDK) | Yes | Test plan + disclosure note (sample reuse disclosed). |
| Open questions / known gaps `[open-question]` | open-question | Ring docs + FAQ + community | No | Track | Partner-initiated OAuth availability; later MCP-spec analogues N/A to Ring; exact simulator device list vs "any listed simulator"; credit-form URL alias question; judging-start date conflict (Oct 26 vs Nov 9). |

### Judges dossier

Every named judge with organization, role and 1–3 linked public artefacts — then up to three `[GUESS]` bullets on what each is likely to reward. Only judges the event page names.

- No named judges published as of 2026-10-05. Event page Judges section reads: *"A qualified panel of judges will be announced soon!"* (Overview tab). Methodology note (Rules §6): judges may be sponsor employees or third parties, may change, may not be listed; evaluation may use expert panels, peer review, or automated AI-driven analysis.
- `[GUESS]` Once named, expect Ring/Amazon Developer relations staff + device-partner engineers: likely to reward runtime-called Ring APIs (not README mentions), simulator-or-device video proof, and strong product-feedback/friction-log writing (their stated goal is shaping the platform).
- `[GUESS]` Expect a "creative over obvious" enforcement bias on Ring (rules spell out motion-alert/live-view as obvious): caretaking/accessibility/package/business-system angles will score higher on Quality of the Idea.
- `[GUESS]` Expect Design weight to favor calm, accessible doorstep UX (large type, consent clarity) given Ring's UX guide + certification privacy bar.

### Crowded ideas (penalized downstream — do NOT land here without a distinct angle)

1. Motion-detection push alert (SMS/push on `motion_detected`) — the rules' canonical "obvious" example; sample dashboard already streams it. Evidence: Rules §6 Ring obvious list; https://github.com/AmazonAppDev/ring-api-helloworld.
2. Bare doorbell live viewer (WHEP stream in a page) — sample's access-token mode is exactly this. Evidence: sample README "Live Video Stream (Web App)"; Rules §6 obvious "basic doorbell live view".
3. Doorbell-press → chime/notification relay — trivial webhook echo. Evidence: Rules §6; Ring webhook docs `button_press`.
4. Package-theft siren / clip saver — single-event clip download with no triage. Evidence: Ring Appstore "package room management" theme; media-clip docs.
5. Visitor log spreadsheet (event history dumped to table) — no agent, no truth engine. Evidence: Event History docs; sample `event_history.py`.
6. Multi-camera grid with no reasoning (tile wall of streams) — uses `component_id` but no verify→repair or checkpoints. Evidence: multi-camera docs; gallery pattern from prior vision events (unpublished gallery — `[unconfirmed]` until gallery opens).
7. Business access-control keypad clone (generic PIN door) without Ring event grounding — misses runtime-tech hook. Evidence: Ring priority category "access control" + repo-hook rule.
8. Pet-cam highlight reel (motion clips stitched) — adjacent Appstore tile ("pet wellness assessment") without caretaking depth. Evidence: https://ring.com/appstore.
9. Offline face-recognition gate (biometric allow/deny on doorbell) — high certification/privacy risk, likely to fail Ring content policy. Evidence: Ring content policy + certification docs.
10. Generic "Ring + Alexa routine" wrapper with no Ring-side state — judges will read as Alexa+ entry misfiled under Ring. Evidence: Rules track definitions; Alexa+ vs Ring tech hooks.

---

## Hackathon Rules - Requirements - Tracks

*Sole source-of-truth for the binding challenge, tracks, requirements and rules as published on https://amazonappdev2026.devpost.com and its binding linked pages. Verbatim excerpts are quoted; everything else is summary. Do not duplicate this section's verbatim text elsewhere — other sections contain only summaries with cross-references here. Checklist/descriptive items already covered in §2 (prizes, schedule table, teams, submission fields checklist, judging criteria table, official resources) are not re-listed in full here.*

**Classification: DEFINED** — the binding challenge is published on the Overview + Rules tabs (quoted below). No kickoff-stream reveal is pending; submissions have been open since 2026-08-31. Gallery is still unpublished; judges still unnamed — both `[unconfirmed]` until posted.

> "Welcome to the Amazon Developer Hackathon — For the first time, Fire TV, Alexa+, Ring, and Bee are all part of one global hackathon. Build for one product or use several to connect the living room, the front door, and the cloud."

> "Pick a primary track and ship a working demo. You can layer a mini challenge onto the same project for extra ways to win, but each project can only win one track prize and one mini challenge prize."

> "**Build or significantly update working applications using Amazon Developer tools into the following primary tracks:**"

Primary tracks (verbatim summaries from Overview/Rules):

> "- **Fire TV** Launch a demo-ready app on Fire OS or Vega OS. Use React Native, web technologies, or Android (Kotlin/Java), any framework is fine, as long as it runs on Fire OS or Vega OS. Priority categories: AI-enhanced viewing, sports, fitness, family entertainment, multi-modal UX, and computer vision."

> "- **Alexa+** Experience how brands in Preview are building and shipping experiences on Alexa+ that our customers love: Build a self-hosted MCP server (spec 2025-11-25 or later, Streamable HTTP) or an Agent Skill. MCP is the open standard that powers Alexa+ integrations. New to MCP? Build a simulated Alexa+ experience in a web app using your preferred agentic tool."

> "- **Bee (Wearable AI)** Build a project that connects to real data recorded and processed through a Bee device or an Apple Watch running Bee software, using Bee's CLI, MCP, or Agent Skills. Your demo needs to show your project actually using that data to do something useful for a person. Priority use cases: education, developer experience, and personal productivity."

> "- **Ring** Build a new app or extend an existing one using Ring APIs, SDKs, simulators, or devices. A physical Ring device is not required. Priority categories: access control, business systems, IoT home automation, accessibility, and caretaking." (Rules §4 phrasing: "A working app or new feature that utilizes Ring APIs, SDKs, simulators, or devices, demonstrated through a simulator or an actual device.")

Mini-challenges (verbatim):

> "- **AWS Builder** Use AWS services (Bedrock, AgentCore, Strands SDK, Kiro Crew, SageMaker, etc.) in your project with documented integrations, and you're in. Building with Kiro Crew qualifies on its own, you don't also need to call a separate AWS runtime service."

> "- **Open Source** Ship a new, additional open-source project (include an open-source license) or a contribution (a branch, a fork, or a pull request) to a public repository during the hackathon window, alongside your primary-track submission. PRs don't need to be merged; a forked, unmerged version is fine. Include the contribution URL, your repo URL, your GitHub username, and a short description of what you did, how it works, and why it matters."

Submission requirements (verbatim core):

> "- **A text description of your project:** explain what it does and how it works."
> "- **A GitHub code repository:** must contain all source code, assets, and instructions needed to run your project. The repository must be either public and open source by including an open source license file OR private and shared with **testing@devpost.com** and **the Amazon team**" (collaborators: chris-trag, knmeiss, giolaq, anishamalde, mosesroth, emersonsklar; "GitHub invitations expire after 7 days. Add the reviewers when you submit rather than weeks in advance").
> "- **A demo video under 3 minutes:** YouTube or Vimeo, public and in English." / "Judges aren't required to watch past the 3-minute mark, so lead with your best material."
> "- **Product feedback on every tool, API, or SDK you used:** what you used it for, what worked well, what needs work, how onboarding felt, and whether you'd build with it again."
> "- **If your project existed before the hackathon,** a clear explanation of what you built or changed during the submission window."
> "- **Optional: Friction log entries for each one** … Submissions with friction logs can earn up to a 10% judging bonus."

Runtime-technology hooks (Rules verbatim, condensed): "For Alexa+, Bee, and Ring: The repository must demonstrate use of your track's required technology at runtime in your code — imported and actually called (a library import, an app/backend entry point, or a loaded agent/flow/MCP config), not just named in the README. Fire TV is the exception" (any framework; video must show it running on a real Fire TV device or simulator). "Ring: Any Ring API, SDK, simulator, or device listed in Ring's developer documentation is acceptable" (demo via simulator or real device). Full Ring deployment contract (docs): server-to-server calls only (browser calls blocked by CORS); Token Exchange + Account Link + Webhook + Homepage URLs required; access ~4 h / refresh ~30 d / auth code 60 s; webhook HTTPS POST, HMAC-SHA256 verify, 200 ≤5 s, idempotent on `request_id`; 100 TPS/client_id, 429 + Retry-After with backoff from 1 s.

Official Rules highlights (verbatim/condensed): Submission Period "Monday, August 31, 2026 (10:15 am Pacific Time) – Friday, October 23, 2026 (12:00 pm Pacific Time)"; Winners "On or around Thursday, December 3, 2026". Eligibility: "Individuals who are at least the age of majority where they reside", "Teams of Eligible Individuals", Organizations; NOT open to residents of "Brazil, Quebec, Russia, Crimea, Cuba, Iran, and North Korea and any other country which is comprehensively sanctioned by the U.S. Treasury's Office of Foreign Assets Control", Promotion Entities and their staff/agents/households, judges and employers, affiliates, conflicts of interest. Credits: "Entrants may request $150 in AWS Promotional Credits … while supplies last … complete the form … by October 21st at 12pm PT" subject to https://aws.amazon.com/awscredits/ — form URL prints as https://forms.gle/5hyhr1u6x3fuV2aW7 in Rules vs https://forms.gle/GaHFxSbBQNG9Kti6A on Resources tab (ambiguous — confirm live); "Additional charges incurred by the Entrant for the use of AWS products are the responsibility of the Entrant." Projects: "must be either newly created by the Entrant or, if the Entrant's Project existed prior to the Hackathon Submission Period, must have been significantly updated after the start of the Hackathon Submission Period"; "must include clear setup and run instructions, and the Project must be shown functioning in the demonstration video"; "All Submission materials … must be in English or … provide an English translation"; "A project can only win one (1) track prize and one (1) mini challenge prize." IP: "All Submissions remain the intellectual property of the individuals or organizations that developed them" with a non-exclusive judging/promotion license to sponsor/Devpost.

Judging methodology (Rules verbatim): "Stage One) The first stage will determine via pass/fail whether the ideas meet a baseline level of viability, in that the Project reasonably fits the theme and reasonably applies the required APIs/SDKs featured in the Hackathon." / "Stage Two) All Submissions that pass Stage Two will be evaluated in Stage Two based on the following equally weighted criteria" (Tech Implementation, Design, Potential Impact, Quality of the Idea — full per-track obvious-vs-creative guidance in Rules §6, summarized in §2 table). Ring creative-vs-obvious (Rules §6, verbatim substance): "Ring: Obvious: motion detection alert, basic doorbell live view. Creative: non-security use case (accessibility aid, care-taking monitoring, package/delivery management), business system integration (access control for commercial spaces), multi-camera pipeline, event-based triggers for app functionality)." "Bonus Points: During Stage 1 downselection, Amazon's internal review team assesses each submission's friction log entries (if provided) and passes a recommended bonus — up to 10% — to the Stage 2 judging panel along with the shortlisted projects."

FAQ clarifications captured (binding-adjacent, from `/details/faqs`): gated Alexa+ partner tools NOT available (irrelevant to Ring except as context); AWS credits requested per individual via form; to save cost, mock/stub Bedrock early and run live only to validate (no official Bedrock offline emulator); no max team size; hardware: Ring simulator (e.g. Developer Playground) or device OK — "any Ring API, SDK, simulator, or device listed in Ring's developer docs is acceptable (for example, Ring Indoor Cam)"; private repos add the 6 Amazon collaborators + testing@devpost.com near deadline; repo MUST be GitHub-hosted; locally runnable public repo + video suffices for judging (hosting not required).

Office-hours / kickoff-day-only information (Updates tab, fresh 2026-10-05): Office Hours #1 Tue 2026-10-06 12:30–13:30 CT (10:30 PT) at https://amazon.zoom.us/webinar/register/WN_ny5v5N4GQNGeMMaJRLKerQ; Office Hours #2 Mon 2026-10-19 11:00–12:00 CT (09:00 PT) at https://amazon.zoom.us/webinar/register/WN_kh9CSYi0QtuN31d8nsTuOQ. Build Session recording https://youtu.be/ws61g53S2b4 (2026-09-03). No Discord kickoff-day announcements found (event is mid-window); gallery filter shows Fire TV / Alexa+ / Bee / Ring but body reads "The hackathon managers haven't published this gallery yet".

Could not verify / open questions for office hours #1 / Discord `[unconfirmed]`: (1) Judging start conflict — Rules §1 "November 9, 2026" vs Schedule tab "October 26, 2026" (end 2026-11-20 both); (2) whether the two credit-form URLs are aliases or distinct; (3) exact Ring simulator device list acceptable for video proof (Indoor Cam named; full list unconfirmed); (4) gallery open date + judge-name announcement date; (5) translation scope for non-English code comments; (6) Partner-initiated OAuth PKCE availability to hackathon entrants; (7) whether later Ring API versions mid-window will be accepted (stated for MCP spec, unconfirmed for Ring).
