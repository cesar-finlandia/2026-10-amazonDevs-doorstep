# Friction log for Devpost

## FL-2 Wire history event_type values are not domain event types
- **Task:** GET /v1/history/devices/{id}/events items (`motion.human`, `ding`, …)
- **Steps:** mapping a history item's `attributes.event_type` verbatim into RingHistoryItem.eventType yields values (`motion.human`, `ding`) that parseHistoryPage drops, so history would never ingest (verified by execution).
- **Expected vs actual:** mapping a history item's `attributes.event_type` verbatim into RingHistoryItem.eventType yields values (`motion.human`, `ding`) that parseHistoryPage drops — actual: history would never ingest (verified by execution).
- **Severity:** low
- **Workaround:** LiveRingPort normalizes wire values to domain types (`motion.human`→`motion_detected` + human subType, `ding`→`button_press`, …); the mock server applies the inverse mapping so the round trip is exact.
- **Suggestion:** publish the wire-to-domain value table beside the endpoint reference so ports normalize once instead of discovering each value by execution.
