# Friction log — Ring integration
## FL-1 Committed parser skips the organizer's flat webhook shape
Date: 2026-10-05
Severity: medium
Where: parseRingPayload (DP-DOMAIN-ENGINE) vs WIRE_SAMPLES.webhookFlat
What happened: §0 says the parser accepts both the canonical shape and the organizer's flat `{"event_type","device_id"}` shape, but the committed parser requires `meta.request_id` and a timestamp, so the literal flat sample parses to `[]` (verified by execution). Neither the parser nor the literal sample may change in this plan.
Workaround: WIRE_SAMPLES.webhookFlat stays literal; ri-01 check 14 pins the actual behaviour. Canonical payloads (as the mock server emits) parse normally.
## FL-2 Wire history event_type values are not domain event types
Date: 2026-10-05
Severity: low
Where: GET /v1/history/devices/{id}/events items (`motion.human`, `ding`, …)
What happened: mapping a history item's `attributes.event_type` verbatim into RingHistoryItem.eventType yields values (`motion.human`, `ding`) that parseHistoryPage drops, so history would never ingest (verified by execution).
Workaround: LiveRingPort normalizes wire values to domain types (`motion.human`→`motion_detected` + human subType, `ding`→`button_press`, …); the mock server applies the inverse mapping so the round trip is exact.
## FL-3 Committed port contract requests a 60 s clip; this plan bounds clips at 30 s
Date: 2026-10-05
Severity: medium
Where: runRingPortContract (DP-DOMAIN-ENGINE) vs LiveRingPort.getClip (§5.6)
What happened: the committed contract calls `getClip(deviceId, { startMs: 0, endMs: 60_000 })` and expects success, but §5.6 normatively rejects ranges over clipMaxSec (30 s) with `RingError(400,"bad_request","A clip can be at most 30 seconds.")` before any request — and WU-05 check 11 pins the rejection of a 31 s range. A single threshold cannot both reject 31 s and accept 60 s, and neither the contract nor the bound may change in this plan. Nothing in the committed agent calls getClip with more than 30 s (only snapshots are attached), so the bound is operationally safe.
Workaround: LiveRingPort keeps the literal 30 s bound; ri-07 check 3 runs the contract and accepts exactly that single known divergence, asserting every other contract step passes.
