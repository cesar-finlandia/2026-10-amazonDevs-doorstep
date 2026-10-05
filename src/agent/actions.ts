// src/agent/actions.ts — Requirement IDs: FR-05, FR-07, FR-12, FR-15
import type { ActionDescriptor } from "src/kits/agent-workflow/src/registry/types.js";
import type { SessionCore } from "src/domain/session.js";
import { DAY_MS, MIN_MS, fmtClock, fmtDay, inWindow, localMinutes, localWeekday } from "src/domain/time.js";
import { DUP_WINDOW_MS, EFFECTIVE_QUIET_HOURS, candidateIncidents } from "src/domain/rules.js";
import type { Candidate } from "src/domain/rules.js";
import { DWELL_FLOOR_SEC } from "src/domain/rules.js";
import { dayIndexOf, findDuplicateClusters } from "src/domain/derive.js";
import { findWebhookGaps, pollHistory } from "src/domain/gaps.js";
import { parseRingPayload } from "src/domain/parse.js";
import type { Device, WeekModel } from "src/domain/types.js";
import { buildWeeklyBrief } from "src/agent/brief.js";

export const ACTION_NAMES: readonly [
  "list_week_events", "get_incident", "get_rhythm_baseline", "list_devices", "get_device_status", "get_device_capabilities",
  "ingest_ring_events", "merge_duplicate_events", "reconcile_webhook_gap", "open_incident", "set_incident_status",
  "check_week_model", "compare_to_baseline",
  "focus_day", "focus_incident", "set_camera_shot",
  "add_incident_note", "propose_family_nudge",
  "play_chime_announcement", "export_weekly_brief"
] = [
  "list_week_events", "get_incident", "get_rhythm_baseline", "list_devices", "get_device_status", "get_device_capabilities",
  "ingest_ring_events", "merge_duplicate_events", "reconcile_webhook_gap", "open_incident", "set_incident_status",
  "check_week_model", "compare_to_baseline",
  "focus_day", "focus_incident", "set_camera_shot",
  "add_incident_note", "propose_family_nudge",
  "play_chime_announcement", "export_weekly_brief",
];

export interface ActionDeps { now?: () => number }

const P = {
  str: (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra }),
  int: (description: string, minimum?: number, maximum?: number) => ({ type: "integer", description, ...(minimum !== undefined ? { minimum } : {}), ...(maximum !== undefined ? { maximum } : {}) }),
  bool: (description: string) => ({ type: "boolean", description }),
  enm: (description: string, values: string[]) => ({ type: "string", enum: values, description }),
  arr: (description: string, items: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ type: "array", description, items, ...extra }),
};
const schema = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: "object", additionalProperties: false, properties, ...(required.length ? { required } : {}) });

function titleFor(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function resolveDevice(model: WeekModel, text: string): Device | null {
  const exact = model.devices.find((d) => d.id === text);
  if (exact) return exact;
  const lower = text.toLowerCase();
  return model.devices.find((d) => d.description.toLowerCase() === lower) ?? null;
}

function unknownDevice(text: string): { ok: false; error: string; next: string } {
  return { ok: false as const, error: `No device "${text}". Call list_devices to see valid ids.`, next: "list_devices" };
}

function consentGranted(model: WeekModel, scope: "family_message" | "chime_announcement" | "weekly_brief"): boolean {
  return model.consent.some((c) => c.scope === scope && c.granted);
}

function coverageOf(model: WeekModel, c: Candidate): boolean {
  return model.incidents.some((x) => {
    if (x.kind !== c.kind) return false;
    const linked = x.eventIds.some((id) => c.eventIds.includes(id)) ||
      (c.routineId !== undefined && x.routineId === c.routineId && x.dayIndex === c.dayIndex);
    if (!linked) return false;
    return x.status === "open" || x.status === "explained";
  });
}

/** Registers the 20 descriptors on core.registry and the three preflights on core (see §5.4). */
export function registerDoorstepActions(core: SessionCore, deps?: ActionDeps): void {
  void deps;
  const R = core.registry;

  R.register({
    name: "list_week_events", title: titleFor("list_week_events"), group: "read",
    description: `Lists door events and the visits built from them for one day or the whole record, oldest first. Use it to read a day before deciding what to open; it never changes anything, and all times are local to the household. Example: list_week_events({"day": 8, "limit": 20}).`,
    inputSchema: schema({
      day: P.int("Absolute day index: 0 = Mon 5 Oct, 7 = Mon 12 Oct, 13 = Sun 18 Oct.", 0, 13),
      deviceId: P.str("Device id such as dev-door, or its name such as Front door."),
      type: P.enm("Event type to keep; omit for all types.", ["motion_detected", "button_press", "device_online", "device_offline"]),
      limit: P.int("Maximum events returned, default 40.", 1, 100),
    }),
    annotations: { readOnly: true, destructive: false, untrustedContent: true },
    handler: (args) => {
      const a = args as { day?: number; deviceId?: string; type?: string; limit?: number };
      const model = core.store.getState();
      let device: Device | null = null;
      if (a.deviceId !== undefined) {
        device = resolveDevice(model, a.deviceId);
        if (!device) return unknownDevice(a.deviceId);
      }
      const dup = new Set(findDuplicateClusters(model.events).flatMap((c) => c.map((e) => e.id)));
      const events = model.events
        .filter((e) => (a.day === undefined || dayIndexOf(model, e.tsMs) === a.day))
        .filter((e) => (!device || e.deviceId === device.id))
        .filter((e) => (a.type === undefined || e.type === a.type))
        .sort((x, y) => x.tsMs - y.tsMs || (x.id < y.id ? -1 : 1));
      const limited = events.slice(0, a.limit ?? 40);
      const visitList = model.visits.filter((v) => a.day === undefined || dayIndexOf(model, v.startMs) === a.day);
      const label = a.day === undefined ? "the whole record" : `day ${a.day}`;
      return {
        ok: true as const,
        summary: `${limited.length} events for ${label}.`,
        data: {
          events: limited.map((e) => ({ ...e, duplicate: dup.has(e.id) })),
          visits: visitList.map((v) => ({ ...v })),
        },
      };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "get_incident", title: titleFor("get_incident"), group: "read",
    description: `Returns one incident with its notes and attached evidence (labels only, not image data). Use it before changing an incident's status. Example: get_incident({"incidentId": "inc-1"}).`,
    inputSchema: schema({ incidentId: P.str("Incident id such as inc-1.") }, ["incidentId"]),
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    precondition: (model) => model.incidents.length > 0,
    handler: (args) => {
      const a = args as { incidentId: string };
      const model = core.store.getState();
      const inc = model.incidents.find((x) => x.id === a.incidentId);
      if (!inc) return { ok: false as const, error: `No incident "${a.incidentId}".`, next: "Call list_week_events to see the record first." };
      const notes = model.notes.filter((n) => n.incidentId === inc.id);
      const media = model.media
        .filter((m) => m.incidentId === inc.id)
        .map((m) => ({ id: m.id, label: m.label, kind: m.kind, deviceId: m.deviceId, tsMs: m.tsMs }));
      return { ok: true as const, summary: `Incident ${inc.id}: ${inc.title}.`, data: { incident: { ...inc }, notes, media } };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "get_rhythm_baseline", title: titleFor("get_rhythm_baseline"), group: "read",
    description: `Returns the household's usual rhythm from the baseline week: the longest-stay figure (90th percentile, in minutes), the median stay, the number of visits it is based on, the busiest hours and the daily routines. Call it once before comparing days. Example: get_rhythm_baseline({}).`,
    inputSchema: schema({}),
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: () => {
      const model = core.store.getState();
      const dwellP90Min = Math.round(model.baseline.dwellP90Sec / 60);
      const dwellMedianMin = Math.round(model.baseline.dwellMedianSec / 60);
      const hourSums: number[] = new Array(24).fill(0);
      for (const row of model.baseline.rhythm) {
        row.forEach((v, h) => {
          (hourSums[h] as number) += v;
        });
      }
      const busiestHours = hourSums
        .map((v, h) => ({ v, h }))
        .sort((a, b) => b.v - a.v || a.h - b.h)
        .slice(0, 3)
        .map(({ h }) => `${String(h).padStart(2, "0")}:00`);
      return {
        ok: true as const,
        summary: `Usual longest stay ${dwellP90Min} min over ${model.baseline.sampleVisits} visits.`,
        data: {
          dwellP90Min,
          dwellMedianMin,
          sampleVisits: model.baseline.sampleVisits,
          busiestHours,
          routines: model.routines.map((r) => ({ ...r, days: [...r.days] })),
        },
      };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "list_devices", title: titleFor("list_devices"), group: "read",
    description: `Lists the household's Ring devices with their components and whether each can play audio, show live video or take a snapshot. Use it to find device ids and to check a capability before proposing an action that needs it. Example: list_devices({}).`,
    inputSchema: schema({}),
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: () => {
      const model = core.store.getState();
      return { ok: true as const, summary: `${model.devices.length} devices.`, data: { devices: model.devices.map((d) => ({ ...d })) } };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "get_device_status", title: titleFor("get_device_status"), group: "read",
    description: `Reads a device's current status from Ring: online or offline, power source and battery level. Use it when a device looks silent in the record. Example: get_device_status({"deviceId": "dev-elite"}).`,
    inputSchema: schema({ deviceId: P.str("Device id or name.") }, ["deviceId"]),
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: async (args) => {
      const a = args as { deviceId: string };
      const model = core.store.getState();
      const device = resolveDevice(model, a.deviceId);
      if (!device) return unknownDevice(a.deviceId);
      try {
        const status = await core.ring.getStatus(device.id);
        return { ok: true as const, summary: `${device.description} is ${status.online ? "online" : "offline"}.`, data: { deviceId: device.id, status } };
      } catch (e) {
        return { ok: false as const, error: (e as Error).message, next: "Call list_devices, then retry." };
      }
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "get_device_capabilities", title: titleFor("get_device_capabilities"), group: "read",
    description: `Reads what a device, or one of its components, can do: motion detection, live video, snapshot and chime audio. Use it before relying on a capability. Example: get_device_capabilities({"deviceId": "dev-elite", "componentId": 1}).`,
    inputSchema: schema({
      deviceId: P.str("Device id or name."),
      componentId: P.int("Camera component, 0 or 1 on the hall camera.", 0),
    }, ["deviceId"]),
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: async (args) => {
      const a = args as { deviceId: string; componentId?: number };
      const model = core.store.getState();
      const device = resolveDevice(model, a.deviceId);
      if (!device) return unknownDevice(a.deviceId);
      try {
        const capabilities = await core.ring.getCapabilities(device.id, a.componentId);
        return {
          ok: true as const,
          summary: `Capabilities of ${device.description} read.`,
          data: { deviceId: device.id, ...(a.componentId !== undefined ? { componentId: a.componentId } : {}), capabilities },
        };
      } catch (e) {
        return { ok: false as const, error: (e as Error).message, next: "Call list_devices, then retry." };
      }
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "ingest_ring_events", title: titleFor("ingest_ring_events"), group: "change",
    description: `Brings new events into the record, either the webhooks waiting in the inbox or a device's event history. Events are added by id only, so the same moment seen on both channels stays as two events until merge_duplicate_events folds them. Example: ingest_ring_events({"source": "history", "deviceId": "dev-door"}).`,
    inputSchema: schema({
      source: P.enm("Where to bring events from.", ["webhook_inbox", "history"]),
      deviceId: P.str("Device id or name; required when source is history."),
      sinceMs: P.int("Only events at or after this UTC millisecond time; default the start of the record."),
    }, ["source"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: true },
    handler: async (args, ctx) => {
      const a = args as { source: "webhook_inbox" | "history"; deviceId?: string; sinceMs?: number };
      const model = core.store.getState();
      if (a.source === "webhook_inbox") {
        const payloads = await core.ring.drainWebhookInbox();
        const events = parseRingPayload(payloads);
        const known = new Set(model.events.map((e) => e.id));
        const fresh = events.filter((e) => !known.has(e.id));
        const r = ctx.store.dispatch("ingest_events", { events }, ctx.source);
        if (!r.ok) return { ok: false as const, error: r.error };
        for (const e of events) {
          ctx.store.dispatch("record_webhook", {
            requestId: e.requestId, type: e.type, deviceId: e.deviceId, tsMs: e.tsMs, receivedMs: model.clockMs,
          }, ctx.source);
        }
        return {
          ok: true as const,
          summary: `Added ${fresh.length} events from webhook_inbox (${events.length - fresh.length} already known).`,
          entityIds: r.entityIds,
        };
      }
      if (a.deviceId === undefined) return { ok: false as const, error: "Pass deviceId when source is history." };
      const device = resolveDevice(model, a.deviceId);
      if (!device) return unknownDevice(a.deviceId);
      const events = await pollHistory(core.ring, device.id, a.sinceMs ?? model.window.startMs);
      const known = new Set(model.events.map((e) => e.id));
      const fresh = events.filter((e) => !known.has(e.id));
      const r = ctx.store.dispatch("ingest_events", { events }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return {
        ok: true as const,
        summary: `Added ${fresh.length} events from history (${events.length - fresh.length} already known).`,
        entityIds: r.entityIds,
      };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "merge_duplicate_events", title: titleFor("merge_duplicate_events"), group: "change",
    description: `Folds events that are the same moment seen twice into the earliest one. Use it on the ids named by a duplicate issue from check_week_model, and only on ids that belong to one duplicate group. Example: merge_duplicate_events({"eventIds": ["evt:req-a", "hist:b"]}).`,
    inputSchema: schema({
      eventIds: P.arr("Ids of events that are the same moment seen twice.", { type: "string" }, { minItems: 2 }),
    }, ["eventIds"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    precondition: (model) => findDuplicateClusters(model.events).length > 0,
    handler: (args, ctx) => {
      const a = args as { eventIds: string[] };
      const r = ctx.store.dispatch("merge_duplicate_events", { eventIds: a.eventIds }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: r.summary, entityIds: r.entityIds };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "reconcile_webhook_gap", title: titleFor("reconcile_webhook_gap"), group: "change",
    description: `Fills the gap left when a device's webhooks went quiet by reading its event history from the last webhook onward, skipping events already in the record. Use it for each device before comparing days; with overlapMinutes 0 nothing already known is read again. Example: reconcile_webhook_gap({"deviceId": "dev-elite", "overlapMinutes": 0}).`,
    inputSchema: schema({
      deviceId: P.str("Device id or name."),
      overlapMinutes: P.int("Minutes before the last webhook to start reading, default 10.", 0, 60),
    }, ["deviceId"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: true },
    handler: async (args, ctx) => {
      const a = args as { deviceId: string; overlapMinutes?: number };
      const model = core.store.getState();
      const device = resolveDevice(model, a.deviceId);
      if (!device) return unknownDevice(a.deviceId);
      const overlapMs = (a.overlapMinutes ?? 10) * MIN_MS;
      const gaps = findWebhookGaps(model, device.id, model.clockMs, overlapMs);
      if (gaps.length === 0) {
        return { ok: true as const, summary: `No webhook gap for ${device.description}: its last webhook is recent.`, data: { gaps: [] } };
      }
      const polled = await pollHistory(core.ring, device.id, (gaps[0] as { fromMs: number }).fromMs);
      const existing = model.events;
      const fresh = polled.filter((e) => {
        if (existing.some((x) => x.id === e.id)) return false;
        return !existing.some((x) =>
          x.deviceId === e.deviceId && x.type === e.type && x.componentId === e.componentId &&
          Math.abs(x.tsMs - e.tsMs) <= DUP_WINDOW_MS);
      });
      const r = ctx.store.dispatch("ingest_events", { events: fresh }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return {
        ok: true as const,
        summary: `Recovered ${fresh.length} events for ${device.description} from the event history (${polled.length - fresh.length} already known).`,
        entityIds: r.entityIds,
        data: { gaps },
      };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "open_incident", title: titleFor("open_incident"), group: "change",
    description: `Opens an incident for something that stood out and, by default, attaches a snapshot from the device as evidence. Use the kind, title, eventIds, startMs, endMs, routineId and dayIndex exactly as a finding or an issue fix gives them. Example: open_incident({"kind": "quiet_hours_activity", "title": "Door activity at 02:14 during quiet hours", "eventIds": ["evt:req-9"], "startMs": 1791000000000, "endMs": 1791001000000, "dayIndex": 8}).`,
    inputSchema: schema({
      kind: P.enm("Kind of incident.", ["quiet_hours_activity", "long_dwell", "device_outage", "missed_routine", "duplicate_burst"]),
      title: P.str("Short title.", { minLength: 4, maxLength: 80 }),
      eventIds: P.arr("Event ids behind the incident; empty only for missed_routine.", { type: "string" }),
      routineId: P.str("Routine id for a missed routine."),
      dayIndex: P.int("Absolute day index.", 0, 13),
      startMs: P.int("Start of the incident in UTC milliseconds."),
      endMs: P.int("End of the incident in UTC milliseconds."),
      withSnapshot: P.bool("Attach a snapshot from the device as evidence, default true."),
    }, ["kind", "title", "eventIds", "startMs", "endMs"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: async (args, ctx) => {
      const a = args as {
        kind: "quiet_hours_activity" | "long_dwell" | "device_outage" | "missed_routine" | "duplicate_burst";
        title: string; eventIds: string[]; routineId?: string; dayIndex?: number;
        startMs: number; endMs: number; withSnapshot?: boolean;
      };
      const model = core.store.getState();
      const r = ctx.store.dispatch("open_incident", {
        kind: a.kind, title: a.title, eventIds: a.eventIds,
        ...(a.routineId !== undefined ? { routineId: a.routineId } : {}),
        ...(a.dayIndex !== undefined ? { dayIndex: a.dayIndex } : {}),
        startMs: a.startMs, endMs: a.endMs,
      }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      const incidentId = r.entityIds[0] as string;
      let summary = `Opened ${incidentId}: ${a.title}.`;
      const entityIds = [...r.entityIds];
      if (a.withSnapshot !== false && a.eventIds.length > 0) {
        const first = model.events.find((e) => e.id === a.eventIds[0]);
        const dev = first ? model.devices.find((d) => d.id === first.deviceId) : undefined;
        if (first && dev && dev.snapshot) {
          try {
            const snap = await core.ring.getSnapshot(first.deviceId, first.componentId);
            const off = model.household.utcOffsetMin;
            const label = `Snapshot · ${dev.description} · ${fmtDay(a.startMs, off)} ${fmtClock(a.startMs, off)}`;
            const m = ctx.store.dispatch("attach_media", {
              incidentId, deviceId: first.deviceId, componentId: first.componentId, kind: "snapshot",
              contentType: snap.contentType, dataBase64: snap.dataBase64, tsMs: snap.capturedAtMs, label, synthetic: snap.synthetic,
            }, ctx.source);
            if (m.ok) entityIds.push(...m.entityIds);
          } catch (e) {
            summary += ` (no snapshot: ${(e as Error).message})`;
          }
        }
      }
      const incident = ctx.store.getState().incidents.find((x) => x.id === incidentId);
      return { ok: true as const, summary, entityIds, data: { incident } };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "set_incident_status", title: titleFor("set_incident_status"), group: "change",
    description: `Moves an incident to a new status and, when given, stores the explanation the family will read. Use explained once a note has been written, resolved when the family member has dealt with it, and dismissed when it was not a concern. Example: set_incident_status({"incidentId": "inc-1", "status": "explained", "summary": "A visit at 02:14 lasted 22 min."}).`,
    inputSchema: schema({
      incidentId: P.str("Incident id such as inc-1."),
      status: P.enm("New status.", ["open", "explained", "resolved", "dismissed"]),
      summary: P.str("Plain-language explanation shown to the family.", { maxLength: 320 }),
    }, ["incidentId", "status"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    precondition: (model) => model.incidents.length > 0,
    handler: (args, ctx) => {
      const a = args as { incidentId: string; status: "open" | "explained" | "resolved" | "dismissed"; summary?: string };
      const r = ctx.store.dispatch("set_incident_status", {
        incidentId: a.incidentId, status: a.status, ...(a.summary !== undefined ? { summary: a.summary } : {}),
      }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: r.summary, entityIds: r.entityIds };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "check_week_model", title: titleFor("check_week_model"), group: "verify",
    description: `Runs every rule over the record and returns the issues with a suggested fix for each, plus the error and warning counts. Call it after reading and recording, and again after every repair until it reports zero errors. Example: check_week_model({}).`,
    inputSchema: schema({}),
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: () => {
      const model = core.store.getState();
      const issues = core.truth.check(model);
      const counts = core.truth.counts(issues);
      return {
        ok: true as const,
        summary: `${counts.errors} errors, ${counts.warnings} warnings.`,
        data: {
          issues: issues.map((i) => ({
            id: i.id, severity: i.severity, message: i.message, entityIds: i.entityIds, ...(i.fix ? { fix: i.fix } : {}),
          })),
        },
      };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "compare_to_baseline", title: titleFor("compare_to_baseline"), group: "verify",
    description: `Compares one day with the household's baseline and returns the visit count, the longest stay against the usual figure, quiet-hours visits, routines kept and missed, and a list of findings that could become incidents. Use the findings' fields as they are when opening an incident. Example: compare_to_baseline({"day": 8}).`,
    inputSchema: schema({ day: P.int("Absolute day index; review days are 7 to 13.", 0, 13) }, ["day"]),
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: (args) => {
      const a = args as { day: number };
      const model = core.store.getState();
      const off = model.household.utcOffsetMin;
      const dayStart = model.window.baselineStartMs + a.day * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const label = fmtDay(dayStart, off);
      const dayVisits = model.visits.filter((v) => v.startMs >= dayStart && v.startMs < dayEnd);
      const hasEvents = model.events.some((e) => e.tsMs >= dayStart && e.tsMs < dayEnd);
      const longestStayMin = dayVisits.length > 0 ? Math.round(Math.max(...dayVisits.map((v) => v.dwellSec)) / 60) : 0;
      const usualLongestStayMin = Math.round(Math.max(model.baseline.dwellP90Sec, DWELL_FLOOR_SEC) / 60);
      const eff = EFFECTIVE_QUIET_HOURS(model.household.quietHours);
      const quietHourVisits = dayVisits.filter((v) => inWindow(localMinutes(v.startMs, off), eff.startMin, eff.endMin)).length;
      const weekday = localWeekday(dayStart + 12 * 3_600_000, off);
      const routinesKept: string[] = [];
      const routinesMissed: string[] = [];
      if (hasEvents) {
        for (const r of model.routines) {
          if (!r.days.includes(weekday)) continue;
          if (dayVisits.some((v) => v.routineId === r.id)) routinesKept.push(r.id);
          else routinesMissed.push(r.id);
        }
      }
      const findings = candidateIncidents(model)
        .filter((c) => c.dayIndex === a.day)
        .map((c) => ({
          kind: c.kind, title: c.title, eventIds: [...c.eventIds], startMs: c.startMs, endMs: c.endMs,
          ...(c.routineId !== undefined ? { routineId: c.routineId } : {}),
          dayIndex: c.dayIndex, covered: coverageOf(model, c),
        }));
      return {
        ok: true as const,
        summary: `${label}: ${dayVisits.length} visits, ${findings.length} findings.`,
        data: {
          day: a.day, label, visits: dayVisits.length, longestStayMin, usualLongestStayMin,
          quietHourVisits, routinesKept, routinesMissed, findings,
        },
      };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "focus_day", title: titleFor("focus_day"), group: "navigate",
    description: `Moves the view to one day so the person watching sees what you are reading. It changes nothing in the record. Example: focus_day({"day": 8}).`,
    inputSchema: schema({ day: { type: ["integer", "null"], description: "Day to show, or null to show the whole week." } }),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: (args, ctx) => {
      const a = args as { day?: number | null };
      const r = ctx.store.dispatch("set_ui", { selectedDay: a.day ?? null }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: a.day === undefined || a.day === null ? "Showing the whole week." : `Showing day ${a.day}.` };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "focus_incident", title: titleFor("focus_incident"), group: "navigate",
    description: `Selects an incident in the view, moves to its day and frames it in the 3D scene. Use it when you start working on an incident. Example: focus_incident({"incidentId": "inc-1"}).`,
    inputSchema: schema({ incidentId: P.str("Incident id such as inc-1.") }, ["incidentId"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    precondition: (model) => model.incidents.length > 0,
    handler: (args, ctx) => {
      const a = args as { incidentId: string };
      const model = core.store.getState();
      const inc = model.incidents.find((x) => x.id === a.incidentId);
      if (!inc) return { ok: false as const, error: `No incident "${a.incidentId}".`, next: "Call list_week_events to see the record first." };
      const r = ctx.store.dispatch("set_ui", {
        selectedIncidentId: inc.id,
        selectedDay: inc.dayIndex ?? dayIndexOf(model, inc.startMs),
        shotId: `focus:${inc.id}`,
      }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: `Framed incident ${inc.id}.` };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "set_camera_shot", title: titleFor("set_camera_shot"), group: "navigate",
    description: `Chooses the camera shot of the 3D doorway view: the whole week, a walk along a visitor's path, or a close frame on one incident. It changes only the view. Example: set_camera_shot({"shot": "overview"}).`,
    inputSchema: schema({
      shot: P.enm("Camera shot.", ["overview", "walk", "focus"]),
      incidentId: P.str("Required when shot is focus."),
    }, ["shot"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: (args, ctx) => {
      const a = args as { shot: "overview" | "walk" | "focus"; incidentId?: string };
      if (a.shot === "focus") {
        if (!a.incidentId) return { ok: false as const, error: "Pass incidentId when shot is focus." };
        const model = core.store.getState();
        if (!model.incidents.some((x) => x.id === a.incidentId)) {
          return { ok: false as const, error: `No incident "${a.incidentId}".`, next: "Call list_week_events to see the record first." };
        }
      }
      const r = ctx.store.dispatch("set_ui", { shotId: a.shot === "focus" ? `focus:${a.incidentId as string}` : a.shot }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: `Camera shot is ${a.shot}.` };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "add_incident_note", title: titleFor("add_incident_note"), group: "collaborate",
    description: `Adds a short note to an incident so the family can see what you saw. Write one plain sentence using only facts from function results. Example: add_incident_note({"incidentId": "inc-1", "text": "The front door saw activity at 02:14, inside quiet hours."}).`,
    inputSchema: schema({
      incidentId: P.str("Incident id such as inc-1."),
      text: P.str("One plain sentence about what was seen.", { minLength: 8, maxLength: 280 }),
    }, ["incidentId", "text"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    precondition: (model) => model.incidents.length > 0,
    handler: (args, ctx) => {
      const a = args as { incidentId: string; text: string };
      const r = ctx.store.dispatch("add_note", { incidentId: a.incidentId, author: "agent", text: a.text }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: `Noted on ${a.incidentId}.`, entityIds: r.entityIds };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "propose_family_nudge", title: titleFor("propose_family_nudge"), group: "collaborate",
    description: `Prepares one gentle message for the family member to send, shown as a decision card. It is only a proposal: the family member approves or rejects it, and it needs the Family message consent to be on. Example: propose_family_nudge({"incidentId": "inc-1", "text": "Maybe a quick call this evening?"}).`,
    inputSchema: schema({
      text: P.str("One short, kind message for the family member to approve.", { minLength: 8, maxLength: 200 }),
      incidentId: P.str("Incident the message is about."),
      scope: P.enm("Message channel, default family_message.", ["family_message"]),
    }, ["text"]),
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    precondition: (model) => consentGranted(model, "family_message"),
    handler: (args, ctx) => {
      const a = args as { text: string; incidentId?: string; scope?: "family_message" };
      const model = core.store.getState();
      if (a.incidentId !== undefined && !model.incidents.some((x) => x.id === a.incidentId)) {
        return { ok: false as const, error: `No incident "${a.incidentId}".`, next: "Call list_week_events to see the record first." };
      }
      const r = ctx.store.dispatch("propose_nudge", {
        scope: "family_message", text: a.text, ...(a.incidentId !== undefined ? { incidentId: a.incidentId } : {}),
      }, ctx.source);
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: `Proposed a family message for approval (${r.entityIds[0] as string}).`, entityIds: r.entityIds };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "play_chime_announcement", title: titleFor("play_chime_announcement"), group: "cross_boundary",
    description: `Plays a short chime on the front-door device so someone at home hears a gentle sound. It reaches a person, so it needs the Chime announcement consent and the family member's approval each time, and it works only on a device that can play audio. Example: play_chime_announcement({"deviceId": "dev-door", "audioRef": "gentle_hello"}).`,
    inputSchema: schema({
      deviceId: P.str("Device id or name; must support chime audio."),
      audioRef: P.enm("Audio slot to play.", ["gentle_hello", "check_in_chime"]),
      incidentId: P.str("Incident the chime relates to."),
    }, ["deviceId", "audioRef"]),
    annotations: { readOnly: false, destructive: true, untrustedContent: false },
    precondition: (model) => consentGranted(model, "chime_announcement") && model.devices.some((d) => d.chimeAudio),
    summarize: (args) => {
      const a = args as { deviceId: string };
      const d = resolveDevice(core.store.getState(), a.deviceId);
      return `play a gentle chime on the ${d?.description ?? a.deviceId}`;
    },
    handler: async (args, ctx) => {
      const a = args as { deviceId: string; audioRef: string; incidentId?: string };
      const model = core.store.getState();
      const device = resolveDevice(model, a.deviceId);
      if (!device) return unknownDevice(a.deviceId);
      let chime: { audioRef: string };
      try {
        chime = await core.ring.playChime(device.id, a.audioRef);
      } catch (e) {
        const message = (e as Error).message;
        const p = ctx.store.dispatch("propose_nudge", {
          scope: "chime_announcement", text: `Played "${a.audioRef}" on ${device.description}`,
          ...(a.incidentId !== undefined ? { incidentId: a.incidentId } : {}),
        }, ctx.source);
        if (p.ok) {
          ctx.store.dispatch("decide_nudge", { nudgeId: p.entityIds[0], decision: "approved" }, ctx.source);
          ctx.store.dispatch("record_nudge_result", { nudgeId: p.entityIds[0], status: "failed", detail: message }, ctx.source);
        }
        return { ok: false as const, error: message };
      }
      const p = ctx.store.dispatch("propose_nudge", {
        scope: "chime_announcement", text: `Played "${chime.audioRef}" on ${device.description}`,
        ...(a.incidentId !== undefined ? { incidentId: a.incidentId } : {}),
      }, ctx.source);
      if (!p.ok) return { ok: false as const, error: p.error };
      const nudgeId = p.entityIds[0] as string;
      ctx.store.dispatch("decide_nudge", { nudgeId, decision: "approved" }, ctx.source);
      ctx.store.dispatch("record_nudge_result", { nudgeId, status: "sent" }, ctx.source);
      return { ok: true as const, summary: `Played "${chime.audioRef}" on ${device.description}.`, entityIds: [nudgeId] };
    },
  } as ActionDescriptor<WeekModel>);

  R.register({
    name: "export_weekly_brief", title: titleFor("export_weekly_brief"), group: "cross_boundary",
    description: `Builds the weekly brief from the record and shares it with the family. It leaves the product, so it needs the Weekly brief consent and the family member's approval each time. Example: export_weekly_brief({"includeNotes": true}).`,
    inputSchema: schema({ includeNotes: P.bool("Include the incident notes in the brief.") }, ["includeNotes"]),
    annotations: { readOnly: false, destructive: true, untrustedContent: false },
    precondition: (model) => consentGranted(model, "weekly_brief"),
    summarize: () => `share the weekly brief with ${core.store.getState().household.caretaker}`,
    handler: (args, ctx) => {
      const a = args as { includeNotes: boolean };
      const model = core.store.getState();
      const brief = buildWeeklyBrief(model);
      const lines = [...brief.lines];
      if (a.includeNotes) {
        for (const n of model.notes) lines.push(n.text);
      }
      const body = lines.join("\n");
      const p = ctx.store.dispatch("propose_nudge", { scope: "weekly_brief", text: body }, ctx.source);
      if (!p.ok) return { ok: false as const, error: p.error };
      const nudgeId = p.entityIds[0] as string;
      ctx.store.dispatch("decide_nudge", { nudgeId, decision: "approved" }, ctx.source);
      ctx.store.dispatch("record_nudge_result", { nudgeId, status: "sent" }, ctx.source);
      return {
        ok: true as const,
        summary: `Shared the weekly brief with ${model.household.caretaker}.`,
        entityIds: [nudgeId],
        data: { brief: { title: brief.title, body, lines } },
      };
    },
  } as ActionDescriptor<WeekModel>);

  core.registerPreflight("propose_family_nudge", (model) => {
    if (consentGranted(model, "family_message")) return null;
    return {
      message: `Family messages are off. ${model.household.caretaker} can turn on "Family message" in the Consent panel.`,
      next: "Say in your reply that consent is off, and continue.",
    };
  });
  core.registerPreflight("play_chime_announcement", (model, args) => {
    if (!consentGranted(model, "chime_announcement")) {
      return {
        message: `Chime announcements are off. ${model.household.caretaker} can turn on "Chime announcement" in the Consent panel.`,
        next: "Say in your reply that consent is off, and continue.",
      };
    }
    const a = args as { deviceId: string };
    const device = resolveDevice(model, a.deviceId);
    if (!device || !device.chimeAudio) {
      return {
        message: `${a.deviceId} cannot play audio, so no chime was sent.`,
        next: "Call list_devices to see which device can play audio.",
      };
    }
    return null;
  });
  core.registerPreflight("export_weekly_brief", (model) => {
    if (consentGranted(model, "weekly_brief")) return null;
    return {
      message: `The weekly brief is off. ${model.household.caretaker} can turn on "Weekly brief" in the Consent panel.`,
      next: "Say in your reply that consent is off, and continue.",
    };
  });
}
