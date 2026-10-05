// Requirement IDs: FR-03, FR-17
// Derived week: visits, baseline, ribbon, threads, duplicate clusters, outages.
import type { Baseline, DoorEvent, Routine, Visit, WeekModel, Device } from "src/domain/types.js";
import type { RingDevice } from "src/domain/ring-port.js";
import { DAY_MS, fmtDay, fmtDuration, inWindow, localMinutes, localWeekday } from "src/domain/time.js";

export const VISIT_GAP_MS: number = 600_000; // 10 min
export const SINGLE_EVENT_DWELL_SEC: number = 30;

/** Nearest-rank percentile: sorted ascending, index ceil(p·n) − 1. p90(values) === percentile(values, 0.9). Empty → 0. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] as number;
}

export function p90(values: number[]): number {
  return percentile(values, 0.9);
}

/** A visit matches a routine when its start minute falls in the routine window on a routine weekday. */
function matchRoutine(routines: Routine[], startMs: number, utcOffsetMin: number): string | undefined {
  const weekday = localWeekday(startMs, utcOffsetMin);
  const minute = localMinutes(startMs, utcOffsetMin);
  let best: string | undefined;
  let bestWidth = Number.POSITIVE_INFINITY;
  for (const r of routines) {
    if (!r.days.includes(weekday)) continue;
    if (!inWindow(minute, r.windowStartMin, r.windowEndMin)) continue;
    const width = r.windowEndMin >= r.windowStartMin ? r.windowEndMin - r.windowStartMin : r.windowEndMin - r.windowStartMin + 1440;
    if (width < bestWidth) {
      bestWidth = width;
      best = r.id;
    }
  }
  return best;
}

export function deriveVisits(events: DoorEvent[], routines: Routine[], utcOffsetMin: number, overrides: Record<string, string>): Visit[] {
  const relevant = events
    .filter((e) => (e.type === "motion_detected" && e.subType === "human") || e.type === "button_press")
    .sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1));
  const visits: Visit[] = [];
  let current: DoorEvent[] = [];
  for (const e of relevant) {
    const prev = current[current.length - 1];
    if (prev && e.tsMs - prev.tsMs > VISIT_GAP_MS) {
      visits.push(buildVisit(current, routines, utcOffsetMin));
      current = [];
    }
    current.push(e);
  }
  if (current.length > 0) visits.push(buildVisit(current, routines, utcOffsetMin));
  for (const v of visits) {
    const override = overrides[v.id];
    if (override !== undefined) v.routineId = override;
  }
  return visits;
}

function buildVisit(cluster: DoorEvent[], routines: Routine[], utcOffsetMin: number): Visit {
  const sorted = [...cluster].sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1));
  const first = sorted[0] as DoorEvent;
  const last = sorted[sorted.length - 1] as DoorEvent;
  const dwellSec = Math.max(SINGLE_EVENT_DWELL_SEC, (last.tsMs - first.tsMs) / 1000);
  const routineId = matchRoutine(routines, first.tsMs, utcOffsetMin);
  const hasButtonBeforeMotion = sorted.some((b) => b.type === "button_press" &&
    sorted.some((m) => m.type !== "button_press" && m.tsMs >= b.tsMs && m.tsMs - b.tsMs <= 90_000));
  const kind = hasButtonBeforeMotion ? "delivery" : routineId !== undefined ? "arrival" : dwellSec > 420 ? "linger" : "arrival";
  const hops: string[] = [];
  for (const e of sorted) {
    const hop = `${e.deviceId}:${e.componentId}`;
    if (!hops.includes(hop)) hops.push(hop);
  }
  return {
    id: `vis:${first.tsMs}`,
    startMs: first.tsMs,
    endMs: last.tsMs,
    dwellSec,
    eventIds: sorted.map((e) => e.id),
    hops,
    kind,
    ...(routineId !== undefined ? { routineId } : {}),
    label: `Visit · ${fmtDuration(dwellSec * 1000)}`,
  };
}

export function computeBaseline(visits: Visit[], window: { baselineStartMs: number; baselineEndMs: number }, utcOffsetMin: number): Baseline {
  const dwells = visits
    .filter((v) => v.routineId === undefined && v.startMs >= window.baselineStartMs && v.startMs < window.baselineEndMs)
    .map((v) => v.dwellSec);
  const weeks = Math.max(1, Math.round((window.baselineEndMs - window.baselineStartMs) / (7 * DAY_MS)));
  const rhythm: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const v of visits) {
    if (v.startMs < window.baselineStartMs || v.startMs >= window.baselineEndMs) continue;
    const shifted = new Date(v.startMs + utcOffsetMin * 60_000);
    const row = rhythm[localWeekday(v.startMs, utcOffsetMin)] as number[];
    const hour = shifted.getUTCHours();
    (row as number[])[hour] = ((row as number[])[hour] as number) + 1 / weeks;
  }
  return {
    dwellP90Sec: p90(dwells),
    dwellMedianSec: percentile(dwells, 0.5),
    sampleVisits: dwells.length,
    rhythm,
    fromMs: window.baselineStartMs,
    toMs: window.baselineEndMs,
  };
}

export interface RibbonDay {
  dayIndex: number;                // 0..6 within the displayed week (0 = Monday)
  dayStartMs: number; dateLabel: string;               // "Mon 12 Oct"
  ticks: { id: string; minute: number; type: string; deviceId: string; componentId: number; duplicate: boolean }[];
  visits: { id: string; fromMin: number; toMin: number; routineId?: string }[];
  quietBands: { fromMin: number; toMin: number }[];
  outages: { deviceId: string; fromMin: number; toMin: number; minutes: number }[];
  incidents: { id: string; kind: string; status: string; fromMin: number; toMin: number }[];
  seamMinute: number | null;      // minute at which history took over from webhooks, if on this day
  eventCount: number;
}

export function weekRibbon(model: WeekModel, weekStartMs?: number): RibbonDay[] {
  const weekStart = weekStartMs ?? model.window.baselineEndMs;
  const off = model.household.utcOffsetMin;
  const effStart = model.household.quietHours.startMin + model.household.quietHours.toleranceMin;
  const effEnd = model.household.quietHours.endMin - model.household.quietHours.toleranceMin;
  const quietBands = effStart <= effEnd
    ? [{ fromMin: effStart, toMin: effEnd }]
    : [{ fromMin: effStart, toMin: 1440 }, { fromMin: 0, toMin: effEnd }];
  const dupIds = new Set(findDuplicateClusters(model.events).flatMap((c) => c.map((e) => e.id)));
  const webhookTs = model.events.filter((e) => e.source === "webhook").map((e) => e.tsMs);
  const lastWebhook = webhookTs.length > 0 ? Math.max(...webhookTs) : null;
  const outages = deviceOutages(model);
  const days: RibbonDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = weekStart + i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const dayEvents = model.events.filter((e) => e.tsMs >= dayStart && e.tsMs < dayEnd);
    days.push({
      dayIndex: i,
      dayStartMs: dayStart,
      dateLabel: fmtDay(dayStart, off),
      ticks: dayEvents.map((e) => ({
        id: e.id, minute: localMinutes(e.tsMs, off), type: e.type,
        deviceId: e.deviceId, componentId: e.componentId, duplicate: dupIds.has(e.id),
      })),
      visits: model.visits
        .filter((v) => v.startMs >= dayStart && v.startMs < dayEnd)
        .map((v) => ({
          id: v.id, fromMin: localMinutes(v.startMs, off),
          toMin: v.endMs < dayEnd ? localMinutes(v.endMs, off) : 1440,
          ...(v.routineId !== undefined ? { routineId: v.routineId } : {}),
        })),
      quietBands,
      outages: outages
        .filter((o) => o.fromMs < dayEnd && o.toMs >= dayStart)
        .map((o) => ({
          deviceId: o.deviceId,
          fromMin: localMinutes(Math.max(o.fromMs, dayStart), off),
          toMin: o.toMs < dayEnd ? localMinutes(o.toMs, off) : 1440,
          minutes: Math.round((o.toMs - o.fromMs) / 60_000),
        })),
      incidents: model.incidents
        .filter((x) => x.startMs < dayEnd && x.endMs >= dayStart)
        .map((x) => ({
          id: x.id, kind: x.kind, status: x.status,
          fromMin: localMinutes(Math.max(x.startMs, dayStart), off),
          toMin: x.endMs < dayEnd ? localMinutes(x.endMs, off) : 1440,
        })),
      seamMinute: lastWebhook !== null && lastWebhook >= dayStart && lastWebhook < dayEnd
        ? localMinutes(lastWebhook, off)
        : null,
      eventCount: dayEvents.length,
    });
  }
  return days;
}

export interface VisitorThread { visitId: string; hops: string[]; startMs: number; endMs: number }
export function visitorThreads(model: WeekModel): VisitorThread[] {   // visits with ≥ 2 distinct hops
  return model.visits
    .filter((v) => v.hops.length >= 2)
    .map((v) => ({ visitId: v.id, hops: [...v.hops], startMs: v.startMs, endMs: v.endMs }));
}

export function toDomainDevice(d: RingDevice): Device {
  return {
    id: d.id,
    kind: d.kind,
    description: d.description,
    online: d.status.online,
    acPower: d.status.acPower,
    battery: d.status.battery,
    componentIds: [...d.componentIds],
    chimeAudio: d.capabilities.chimeAudio,
    whep: d.capabilities.whep,
    snapshot: d.capabilities.snapshot,
  };
}

export const DUP_WINDOW_MS: number = 60_000;
/** Clusters of duplicate events: same deviceId+type+componentId and (equal requestId with different id) OR
 *  (|Δt| ≤ DUP_WINDOW_MS and different source); connected components of size ≥ 2, each sorted by tsMs. */
export function findDuplicateClusters(events: DoorEvent[]): DoorEvent[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) as string;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string): void => {
    parent.set(find(a), find(b));
  };
  for (const e of events) parent.set(e.id, e.id);
  const byKey = new Map<string, DoorEvent[]>();
  for (const e of events) {
    const key = `${e.deviceId}|${e.type}|${e.componentId}`;
    const list = byKey.get(key) ?? [];
    list.push(e);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i] as DoorEvent;
        const b = list[j] as DoorEvent;
        if (a.requestId === b.requestId && a.id !== b.id) union(a.id, b.id);
        else if (a.source !== b.source && Math.abs(a.tsMs - b.tsMs) <= DUP_WINDOW_MS) union(a.id, b.id);
      }
    }
  }
  const groups = new Map<string, DoorEvent[]>();
  for (const e of events) {
    const root = find(e.id);
    const list = groups.get(root) ?? [];
    list.push(e);
    groups.set(root, list);
  }
  return [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => [...g].sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1)));
}

export interface Outage { deviceId: string; fromMs: number; toMs: number; openEnded: boolean; eventIds: string[] /* [offlineId, onlineId?] */ }
export function deviceOutages(model: WeekModel): Outage[] {
  const out: Outage[] = [];
  const byDevice = new Map<string, DoorEvent[]>();
  for (const e of model.events) {
    if (e.type !== "device_online" && e.type !== "device_offline") continue;
    const list = byDevice.get(e.deviceId) ?? [];
    list.push(e);
    byDevice.set(e.deviceId, list);
  }
  for (const [deviceId, list] of byDevice) {
    const sorted = [...list].sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1));
    let pending: DoorEvent | null = null;
    for (const e of sorted) {
      if (e.type === "device_offline" && pending === null) pending = e;
      else if (e.type === "device_online" && pending !== null) {
        if (e.tsMs - pending.tsMs > 30 * 60_000) {
          out.push({ deviceId, fromMs: pending.tsMs, toMs: e.tsMs, openEnded: false, eventIds: [pending.id, e.id] });
        }
        pending = null;
      }
    }
    if (pending !== null && model.clockMs - pending.tsMs > 30 * 60_000) {
      out.push({ deviceId, fromMs: pending.tsMs, toMs: model.clockMs, openEnded: true, eventIds: [pending.id] });
    }
  }
  return out.sort((a, b) => a.fromMs - b.fromMs);
}

/** Absolute day index of an instant within the 14-day window: floor((tsMs − model.window.baselineStartMs) / DAY_MS) (0..13). */
export function dayIndexOf(model: WeekModel, tsMs: number): number {
  return Math.floor((tsMs - model.window.baselineStartMs) / DAY_MS);
}
