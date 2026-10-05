// Requirement IDs: FR-02
// The 17 store actions: the ONE set of mutations every change goes through.
import type { StoreAction } from "src/kits/agent-workflow/src/store/domainStore.js";
import { computeBaseline, deriveVisits } from "src/domain/derive.js";
import type {
  Device,
  EventType,
  IncidentKind,
  IncidentStatus,
  Nudge,
  NudgeStatus,
  RawDoorEvent,
  ScopeName,
  WeekModel,
} from "src/domain/types.js";

export const STORE_ACTION_NAMES: readonly [
  "set_devices", "ingest_events", "merge_duplicate_events", "recompute_derived", "open_incident", "add_note",
  "set_incident_status", "link_visit_routine", "set_quiet_hours", "set_consent", "propose_nudge", "decide_nudge",
  "record_nudge_result", "attach_media", "record_webhook", "set_ui", "set_clock"
] = [
  "set_devices", "ingest_events", "merge_duplicate_events", "recompute_derived", "open_incident", "add_note",
  "set_incident_status", "link_visit_routine", "set_quiet_hours", "set_consent", "propose_nudge", "decide_nudge",
  "record_nudge_result", "attach_media", "record_webhook", "set_ui", "set_clock",
];

function appendLedger(model: WeekModel, action: string, entityIds: string[], summary: string): void {
  model.ledger.push({ seq: model.ledger.length + 1, action, entityIds, summary, tsMs: model.clockMs });
}

function recomputeDerived(model: WeekModel): void {
  model.visits = deriveVisits(model.events, model.routines, model.household.utcOffsetMin, model.visitOverrides);
  model.baseline = computeBaseline(
    model.visits,
    { baselineStartMs: model.window.baselineStartMs, baselineEndMs: model.window.baselineEndMs },
    model.household.utcOffsetMin,
  );
}

function sameIdSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

const MERGE_REFUSAL = "Pass at least two event ids that belong to the same duplicate cluster.";

export const storeActions: StoreAction<WeekModel>[] = [
  {
    name: "set_devices",
    apply(model, args) {
      const { devices } = args as { devices: Device[] };
      if (!Array.isArray(devices)) throw new Error("set_devices needs { devices: Device[] }.");
      const ids = new Set(model.devices.map((d) => d.id));
      for (const d of devices) {
        const at = model.devices.findIndex((old) => old.id === d.id);
        if (at >= 0) model.devices[at] = d;
        else {
          model.devices.push(d);
          ids.add(d.id);
        }
      }
      const entityIds = devices.map((d) => d.id);
      const summary = `Set ${devices.length} devices.`;
      appendLedger(model, "set_devices", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "ingest_events",
    apply(model, args) {
      const { events } = args as { events: RawDoorEvent[] };
      if (!Array.isArray(events)) throw new Error("ingest_events needs { events: RawDoorEvent[] }.");
      const known = new Set(model.events.map((e) => e.id));
      const added = events.filter((e) => !known.has(e.id));
      for (const e of added) known.add(e.id);
      model.events = [...model.events, ...added].sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1));
      recomputeDerived(model);
      const entityIds = added.map((e) => e.id);
      const summary = `Added ${added.length} events (${events.length - added.length} already known).`;
      appendLedger(model, "ingest_events", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "merge_duplicate_events",
    apply(model, args) {
      const { eventIds } = args as { eventIds: string[] };
      if (!Array.isArray(eventIds) || eventIds.length < 2) throw new Error(MERGE_REFUSAL);
      const byId = new Map(model.events.map((e) => [e.id, e]));
      const members = eventIds.map((id) => byId.get(id));
      if (members.some((m) => m === undefined)) throw new Error(MERGE_REFUSAL);
      const first = members[0] as RawDoorEvent;
      if (!members.every((m) => m?.deviceId === first.deviceId && m?.type === first.type && m?.componentId === first.componentId)) {
        throw new Error(MERGE_REFUSAL);
      }
      const sorted = [...(members as RawDoorEvent[])].sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1));
      const kept = sorted[0] as RawDoorEvent;
      const folded = sorted.slice(1);
      const merged = new Set([...(kept as { merged?: string[] }).merged ?? [], ...folded.map((e) => e.id)]);
      for (const f of folded) for (const id of (f as { merged?: string[] }).merged ?? []) merged.add(id);
      (kept as { merged?: string[] }).merged = [...merged];
      const foldedIds = new Set(folded.map((e) => e.id));
      model.events = model.events.filter((e) => !foldedIds.has(e.id));
      recomputeDerived(model);
      const entityIds = [kept.id];
      const summary = `Merged ${folded.length} events into ${kept.id}.`;
      appendLedger(model, "merge_duplicate_events", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "recompute_derived",
    apply(model) {
      recomputeDerived(model);
      const entityIds: string[] = [];
      const summary = "Recomputed visits and baseline.";
      appendLedger(model, "recompute_derived", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "open_incident",
    apply(model, args) {
      const a = args as {
        kind: IncidentKind; title: string; eventIds: string[]; routineId?: string; dayIndex?: number;
        startMs: number; endMs: number;
      };
      if (!Array.isArray(a.eventIds)) throw new Error("open_incident needs { kind, title, eventIds, startMs, endMs }.");
      if (a.eventIds.length === 0 && a.kind !== "missed_routine") {
        throw new Error(`An incident of kind "${a.kind}" needs at least one event.`);
      }
      const known = new Set(model.events.map((e) => e.id));
      for (const id of a.eventIds) {
        if (!known.has(id)) throw new Error(`No event "${id}" in this week. Call list_week_events to see valid ids.`);
      }
      const clash = model.incidents.find((x) =>
        x.status === "open" && x.kind === a.kind && sameIdSet(x.eventIds, a.eventIds) &&
        (a.eventIds.length > 0 || (x.routineId === a.routineId && x.dayIndex === a.dayIndex))
      );
      if (clash) throw new Error(`An incident for these events already exists (${clash.id}).`);
      const id = `inc-${model.incidents.length + 1}`;
      model.incidents.push({
        id, kind: a.kind, status: "open", title: a.title, eventIds: [...a.eventIds],
        ...(a.routineId !== undefined ? { routineId: a.routineId } : {}),
        ...(a.dayIndex !== undefined ? { dayIndex: a.dayIndex } : {}),
        startMs: a.startMs, endMs: a.endMs, createdMs: model.clockMs,
      });
      const entityIds = [id];
      const summary = `Opened incident ${id}.`;
      appendLedger(model, "open_incident", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "add_note",
    apply(model, args) {
      const a = args as { incidentId?: string; author: "agent" | "human"; text: string };
      if (a.incidentId !== undefined && !model.incidents.some((x) => x.id === a.incidentId)) {
        throw new Error(`No incident "${a.incidentId}".`);
      }
      const id = `note-${model.notes.length + 1}`;
      model.notes.push({
        id,
        ...(a.incidentId !== undefined ? { incidentId: a.incidentId } : {}),
        author: a.author, text: a.text, tsMs: model.clockMs,
      });
      const entityIds = a.incidentId !== undefined ? [a.incidentId, id] : [id];
      const summary = `Added note ${id}.`;
      appendLedger(model, "add_note", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "set_incident_status",
    apply(model, args) {
      const a = args as { incidentId: string; status: IncidentStatus; summary?: string };
      const inc = model.incidents.find((x) => x.id === a.incidentId);
      if (!inc) throw new Error(`No incident "${a.incidentId}".`);
      if (inc.status === a.status) throw new Error(`Incident ${a.incidentId} is already ${a.status}.`);
      inc.status = a.status;
      if (a.summary !== undefined) inc.summary = a.summary;
      const entityIds = [a.incidentId];
      const summary = `Set incident ${a.incidentId} to ${a.status}.`;
      appendLedger(model, "set_incident_status", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "link_visit_routine",
    apply(model, args) {
      const a = args as { visitId: string; routineId: string | null };
      if (!model.visits.some((v) => v.id === a.visitId)) {
        throw new Error(`No visit "${a.visitId}" in this week. Call list_week_events to see valid ids.`);
      }
      if (a.routineId !== null && !model.routines.some((r) => r.id === a.routineId)) {
        throw new Error(`No routine "${a.routineId}" in this week.`);
      }
      if (a.routineId === null) delete model.visitOverrides[a.visitId];
      else model.visitOverrides[a.visitId] = a.routineId;
      recomputeDerived(model);
      const entityIds = [a.visitId];
      const summary = `Linked visit ${a.visitId} to ${a.routineId ?? "no routine"}.`;
      appendLedger(model, "link_visit_routine", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "set_quiet_hours",
    apply(model, args) {
      const a = args as { startMin: number; endMin: number; toleranceMin: number };
      const okMinute = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1439;
      if (!okMinute(a.startMin) || !okMinute(a.endMin) ||
        typeof a.toleranceMin !== "number" || !Number.isInteger(a.toleranceMin) || a.toleranceMin < 0 || a.toleranceMin > 120) {
        throw new Error("Quiet hours need whole minutes 0–1439 and tolerance 0–120.");
      }
      model.household.quietHours = { startMin: a.startMin, endMin: a.endMin, toleranceMin: a.toleranceMin };
      const entityIds: string[] = [];
      const summary = `Set quiet hours ${a.startMin}–${a.endMin} ±${a.toleranceMin}.`;
      appendLedger(model, "set_quiet_hours", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "set_consent",
    apply(model, args) {
      const a = args as { scope: ScopeName; granted: boolean; actor: "human" | "agent" | "system" };
      if (a.actor !== "human") throw new Error("Consent can only be granted by the family member. Ask them to turn it on.");
      const entry = model.consent.find((c) => c.scope === a.scope);
      if (!entry) throw new Error(`Unknown consent scope "${a.scope}".`);
      if (a.granted) {
        entry.granted = true;
        entry.grantedAtMs = model.clockMs;
        entry.grantedBy = "human";
      } else {
        entry.granted = false;
        delete entry.grantedAtMs;
        delete entry.grantedBy;
      }
      const entityIds = [a.scope];
      const summary = `${a.granted ? "Granted" : "Revoked"} ${a.scope}.`;
      appendLedger(model, "set_consent", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "propose_nudge",
    apply(model, args) {
      const a = args as { scope: ScopeName; text: string; incidentId?: string };
      if (a.incidentId !== undefined && !model.incidents.some((x) => x.id === a.incidentId)) {
        throw new Error(`No incident "${a.incidentId}".`);
      }
      const id = `nud-${model.nudges.length + 1}`;
      const nudge: Nudge = {
        id, scope: a.scope, text: a.text, status: "proposed", createdMs: model.clockMs,
        ...(a.incidentId !== undefined ? { incidentId: a.incidentId } : {}),
      };
      model.nudges.push(nudge);
      const entityIds = [id];
      const summary = `Proposed nudge ${id}.`;
      appendLedger(model, "propose_nudge", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "decide_nudge",
    apply(model, args) {
      const a = args as { nudgeId: string; decision: "approved" | "rejected" };
      const nudge = model.nudges.find((x) => x.id === a.nudgeId);
      if (!nudge) throw new Error(`No nudge "${a.nudgeId}".`);
      if (nudge.status !== "proposed") throw new Error(`Nudge ${a.nudgeId} is already ${nudge.status}.`);
      nudge.status = a.decision;
      const entityIds = [a.nudgeId];
      const summary = `${a.decision === "approved" ? "Approved" : "Rejected"} nudge ${a.nudgeId}.`;
      appendLedger(model, "decide_nudge", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "record_nudge_result",
    apply(model, args) {
      const a = args as { nudgeId: string; status: "sent" | "failed"; detail?: string };
      const nudge = model.nudges.find((x) => x.id === a.nudgeId);
      if (!nudge) throw new Error(`No nudge "${a.nudgeId}".`);
      if (nudge.status !== "approved") {
        throw new Error(`Nudge ${a.nudgeId} is ${nudge.status}; only an approved nudge can be recorded.`);
      }
      nudge.status = a.status as NudgeStatus;
      if (a.detail !== undefined) nudge.detail = a.detail;
      const entityIds = [a.nudgeId];
      const summary = `Recorded nudge ${a.nudgeId} as ${a.status}.`;
      appendLedger(model, "record_nudge_result", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "attach_media",
    apply(model, args) {
      const a = args as {
        incidentId: string; deviceId: string; componentId: number; kind: "snapshot" | "clip";
        contentType: string; dataBase64: string; tsMs: number; label: string; synthetic: boolean;
      };
      if (!model.incidents.some((x) => x.id === a.incidentId)) throw new Error(`No incident "${a.incidentId}".`);
      const id = `med-${model.media.length + 1}`;
      model.media.push({
        id, incidentId: a.incidentId, deviceId: a.deviceId, componentId: a.componentId, kind: a.kind,
        contentType: a.contentType, dataBase64: a.dataBase64, tsMs: a.tsMs, label: a.label, synthetic: a.synthetic,
      });
      const entityIds = [id];
      const summary = `Attached media ${id}.`;
      appendLedger(model, "attach_media", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "record_webhook",
    apply(model, args) {
      const a = args as { requestId: string; type: EventType; deviceId: string; tsMs: number; receivedMs: number };
      if (model.webhookLedger.some((w) => w.requestId === a.requestId)) {
        return { model, entityIds: [a.requestId], summary: "already recorded" };
      }
      model.webhookLedger.push({
        requestId: a.requestId, type: a.type, deviceId: a.deviceId, tsMs: a.tsMs, receivedMs: a.receivedMs,
      });
      const entityIds = [a.requestId];
      const summary = `Recorded webhook ${a.requestId}.`;
      appendLedger(model, "record_webhook", entityIds, summary);
      return { model, entityIds, summary };
    },
  },
  {
    name: "set_ui",
    apply(model, args) {
      const a = args as {
        selectedDay?: number | null; selectedIncidentId?: string | null; shotId?: string; liveViewDeviceId?: string | null;
      };
      if (a.selectedDay !== undefined) model.ui.selectedDay = a.selectedDay;
      if (a.selectedIncidentId !== undefined) model.ui.selectedIncidentId = a.selectedIncidentId;
      if (a.shotId !== undefined) model.ui.shotId = a.shotId;
      if (a.liveViewDeviceId !== undefined) model.ui.liveViewDeviceId = a.liveViewDeviceId;
      return { model, entityIds: [] as string[], summary: "Updated selection." };
    },
  },
  {
    name: "set_clock",
    apply(model, args) {
      const a = args as { clockMs: number };
      if (typeof a.clockMs !== "number" || a.clockMs < model.window.startMs || a.clockMs > model.window.endMs) {
        throw new Error("Clock must stay inside the bundled two weeks.");
      }
      model.clockMs = a.clockMs;
      return { model, entityIds: [] as string[], summary: "Updated clock." };
    },
  },
];
