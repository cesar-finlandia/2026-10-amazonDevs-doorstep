// Requirement IDs: FR-02
// WU-DOMAIN-ENGINE-07: every mutation is a named, undoable, refusal-friendly action.
import { createWeekStore } from "src/domain/store.js";
import { cleanSeed, demoSeed } from "src/domain/seed.js";
import { REVIEW_START_MS } from "src/domain/seed.js";
import type { RawDoorEvent } from "src/domain/types.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const store = createWeekStore(demoSeed());
const state = () => store.getState();

{
  const door = { ...state().devices[0]!, description: "Front door (edited)" };
  const extra = { ...state().devices[1]!, id: "dev-test", description: "Spare" };
  const r = store.dispatch("set_devices", { devices: [door, extra] }, "human");
  assert(
    r.ok && state().devices.length === 3 && state().devices[0]?.description === "Front door (edited)" &&
      state().devices[2]?.id === "dev-test",
    "set_devices merges by id keeping order",
  );
}
{
  const known = state().events[0] as RawDoorEvent;
  const ts = REVIEW_START_MS + 3_600_000;
  const mk = (id: string, ms: number): RawDoorEvent => ({
    id, deviceId: "dev-door", componentId: 0, type: "motion_detected", tsMs: ms, requestId: id, source: "history",
  });
  const r = store.dispatch("ingest_events", { events: [mk("evt:test-2", ts + 1000), known, mk("evt:test-1", ts)] }, "agent");
  const ids = state().events.map((e) => e.id);
  assert(
    r.ok && r.summary === "Added 2 events (1 already known)." && ids.indexOf("evt:test-1") < ids.indexOf("evt:test-2"),
    "ingest_events appends unknown ids sorted",
  );
}
{
  const pair = state().events.filter((e) => e.deviceId === "dev-door" && e.type === "motion_detected" && e.componentId === 0);
  const before = state().events.length;
  const r = store.dispatch("merge_duplicate_events", { eventIds: [pair[0]?.id, pair[1]?.id] }, "agent");
  const kept = state().events.find((e) => e.id === pair[0]?.id);
  assert(
    r.ok && state().events.length === before - 1 && (kept?.merged ?? []).includes(pair[1]?.id as string),
    "merge_duplicate_events folds into the earliest",
  );
}
{
  const door = state().events.find((e) => e.deviceId === "dev-door" && e.type === "motion_detected");
  const elite = state().events.find((e) => e.deviceId === "dev-elite" && e.type === "motion_detected");
  const r = store.dispatch("merge_duplicate_events", { eventIds: [door?.id, elite?.id] }, "agent");
  assert(!r.ok && r.error === "Pass at least two event ids that belong to the same duplicate cluster.", "merge refusal message");
}
assert(store.dispatch("recompute_derived", {}, "system").ok, "recompute_derived runs");
{
  const evt = state().events.find((e) => e.deviceId === "dev-door" && e.type === "motion_detected");
  const r = store.dispatch(
    "open_incident",
    { kind: "quiet_hours_activity", title: "Night visit", eventIds: [evt?.id], startMs: evt?.tsMs, endMs: evt?.tsMs },
    "agent",
  );
  assert(r.ok && state().incidents[0]?.id === "inc-1" && state().incidents[0]?.status === "open", "open_incident happy path");
}
{
  const r = store.dispatch(
    "open_incident",
    { kind: "quiet_hours_activity", title: "Ghost", eventIds: ["evt:nope"], startMs: 1, endMs: 2 },
    "agent",
  );
  assert(!r.ok && r.error === 'No event "evt:nope" in this week. Call list_week_events to see valid ids.', "open_incident unknown event");
}
{
  const evt = state().events.find((e) => e.deviceId === "dev-door" && e.type === "motion_detected");
  const r = store.dispatch(
    "open_incident",
    { kind: "quiet_hours_activity", title: "Night visit again", eventIds: [evt?.id], startMs: evt?.tsMs, endMs: evt?.tsMs },
    "agent",
  );
  assert(!r.ok && r.error === "An incident for these events already exists (inc-1).", "open_incident duplicate");
}
{
  const ok = store.dispatch("add_note", { incidentId: "inc-1", author: "human", text: "Saw it too." }, "human");
  const bad = store.dispatch("add_note", { incidentId: "inc-99", author: "agent", text: "x" }, "agent");
  assert(
    ok.ok && state().notes[0]?.id === "note-1" && !bad.ok && bad.error === 'No incident "inc-99".',
    "add_note happy path and refusal",
  );
}
{
  const r = store.dispatch("set_incident_status", { incidentId: "inc-1", status: "explained", summary: "Cat." }, "human");
  assert(r.ok && state().incidents[0]?.status === "explained" && state().incidents[0]?.summary === "Cat.", "set_incident_status happy path");
}
{
  const r = store.dispatch("set_incident_status", { incidentId: "inc-1", status: "explained" }, "human");
  assert(!r.ok && r.error === "Incident inc-1 is already explained.", "set_incident_status same-status refusal");
}
{
  const visitId = state().visits[0]?.id as string;
  const r = store.dispatch("link_visit_routine", { visitId, routineId: "rtn-paper" }, "human");
  assert(
    r.ok && state().visitOverrides[visitId] === "rtn-paper" &&
      state().visits.find((v) => v.id === visitId)?.routineId === "rtn-paper",
    "link_visit_routine sets the override",
  );
}
{
  const badVisit = store.dispatch("link_visit_routine", { visitId: "vis:0", routineId: "rtn-paper" }, "human");
  const badRoutine = store.dispatch("link_visit_routine", { visitId: state().visits[0]?.id, routineId: "rtn-nope" }, "human");
  assert(!badVisit.ok && !badRoutine.ok, "link_visit_routine rejects unknown ids");
}
{
  const ok = store.dispatch("set_quiet_hours", { startMin: 1320, endMin: 420, toleranceMin: 30 }, "human");
  const bad = store.dispatch("set_quiet_hours", { startMin: 1500, endMin: 420, toleranceMin: 30 }, "human");
  assert(ok.ok && state().household.quietHours.startMin === 1320 && !bad.ok, "set_quiet_hours happy path and refusal");
}
{
  const r = store.dispatch("set_consent", { scope: "chime_announcement", granted: true, actor: "human" }, "human");
  const entry = state().consent.find((c) => c.scope === "chime_announcement");
  assert(r.ok && entry?.granted && entry?.grantedAtMs === state().clockMs && entry?.grantedBy === "human", "set_consent grant");
}
{
  const r = store.dispatch("set_consent", { scope: "family_message", granted: false, actor: "human" }, "human");
  const entry = state().consent.find((c) => c.scope === "family_message");
  assert(r.ok && !entry?.granted && entry?.grantedAtMs === undefined && entry?.grantedBy === undefined, "set_consent revoke clears");
}
{
  const r = store.dispatch("set_consent", { scope: "weekly_brief", granted: true, actor: "agent" }, "agent");
  assert(!r.ok && r.error === "Consent can only be granted by the family member. Ask them to turn it on.", "set_consent non-human refusal");
}
{
  const r = store.dispatch("propose_nudge", { scope: "family_message", text: "Heads up.", incidentId: "inc-1" }, "agent");
  assert(r.ok && state().nudges[0]?.id === "nud-1" && state().nudges[0]?.status === "proposed", "propose_nudge happy path");
}
{
  const ok = store.dispatch("decide_nudge", { nudgeId: "nud-1", decision: "approved" }, "human");
  const again = store.dispatch("decide_nudge", { nudgeId: "nud-1", decision: "rejected" }, "human");
  assert(
    ok.ok && state().nudges[0]?.status === "approved" && !again.ok && again.error === "Nudge nud-1 is already approved.",
    "decide_nudge happy path and refusal",
  );
}
{
  const ok = store.dispatch("record_nudge_result", { nudgeId: "nud-1", status: "sent", detail: "delivered" }, "agent");
  store.dispatch("propose_nudge", { scope: "weekly_brief", text: "Later." }, "agent");
  const early = store.dispatch("record_nudge_result", { nudgeId: "nud-2", status: "sent" }, "agent");
  assert(ok.ok && state().nudges[0]?.status === "sent" && !early.ok, "record_nudge_result needs approval first");
}
{
  const r = store.dispatch(
    "attach_media",
    {
      incidentId: "inc-1", deviceId: "dev-door", componentId: 0, kind: "snapshot",
      contentType: "image/jpeg", dataBase64: "AA==", tsMs: state().clockMs, label: "Porch", synthetic: true,
    },
    "agent",
  );
  assert(r.ok && state().media[0]?.id === "med-1" && state().media[0]?.incidentId === "inc-1", "attach_media happy path");
}
{
  const first = store.dispatch(
    "record_webhook", { requestId: "req-1", type: "motion_detected", deviceId: "dev-door", tsMs: 1, receivedMs: 2 }, "system",
  );
  const dup = store.dispatch(
    "record_webhook", { requestId: "req-1", type: "motion_detected", deviceId: "dev-door", tsMs: 1, receivedMs: 2 }, "system",
  );
  assert(first.ok && dup.ok && dup.summary === "already recorded" && state().webhookLedger.length === 1, "record_webhook dedups");
}
{
  const ledgerBefore = state().ledger.length;
  const ui = store.dispatch("set_ui", { selectedDay: 3 }, "human");
  const clock = store.dispatch("set_clock", { clockMs: REVIEW_START_MS }, "human");
  const oob = store.dispatch("set_clock", { clockMs: 0 }, "human");
  assert(
    ui.ok && state().ui.selectedDay === 3 && state().ledger.length === ledgerBefore &&
      clock.ok && state().clockMs === REVIEW_START_MS && !oob.ok,
    "set_ui merges ledger-free; set_clock guards the window",
  );
}
{
  const rev = store.revision();
  const undone = store.undo();
  const redone = store.redo();
  const a = demoSeed();
  a.incidents.push({ id: "inc-x", kind: "missed_routine", status: "open", title: "x", eventIds: [], startMs: 1, endMs: 2, createdMs: 1 });
  const b = demoSeed();
  const c = cleanSeed();
  c.household.name = "Changed";
  const seqOk = state().ledger.every((e, i) => e.seq === i + 1);
  assert(
    undone && redone && store.revision() === rev + 2 && b.incidents.length === 0 && cleanSeed().household.name !== "Changed" && seqOk,
    "undo/redo round-trip; seeds deep-clone safe; ledger gap-free",
  );
}

console.log("de-07-actions: 24 checks OK");
