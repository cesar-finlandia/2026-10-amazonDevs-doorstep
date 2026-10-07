// src/3d/adapter.ts — toSceneDescription(model, revision?) and MATERIAL_TOKENS (DP-3D §5.1).
// Pure and deterministic: the same model and revision give a deep-equal result;
// never reads the clock or a random source. Covers every row of the §5.1 table.
// Requirement IDs: FR-20, FR-17
import type { WeekModel, Visit } from "src/domain/types.js";
import { visitorThreads, weekRibbon } from "src/domain/derive.js";
import type { RibbonDay } from "src/domain/derive.js";
import { candidateIncidents } from "src/domain/rules.js";
import { fmtClock } from "src/domain/time.js";
import type { SceneDescription, SceneEntity } from "src/kits/three-scene/src/react/index.js";
import { BOUNDS, DUP_DX, OUTAGE_DX, PILLAR_DX, TICK_DX, dayX, hopPosition, minuteZ, pillarHeight } from "src/3d/layout.js";
import { LOOK } from "src/3d/look.js";

export const SCENE_NAME = "doorway-week";

export const MATERIAL_TOKENS = [
  "wall",
  "door",
  "stoop",
  "frustum",
  "pillar",
  "pillar-warn",
  "pillar-danger",
  "pillar-dup",
  "gap",
  "resolved",
  "arc",
] as const;

export type MaterialToken = (typeof MATERIAL_TOKENS)[number];

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

type PillarFlag = "quiet" | "dwell" | "none";

function material(token: MaterialToken, extra?: { opacity?: number }): SceneEntity["material"] {
  return {
    token,
    roughness: LOOK[token].roughness,
    metalness: LOOK[token].metalness,
    ...(extra?.opacity !== undefined ? { opacity: extra.opacity } : {}),
  };
}

/** "quiet" when a quiet_hours_activity candidate touches the visit, else "dwell"
 *  for a long_dwell candidate, else "none". Depends on the model only, never on
 *  incidents, so a flagged visit stands out before anyone opens an incident. */
function flagOfVisit(visitEventIds: string[], quietIds: ReadonlySet<string>, dwellIds: ReadonlySet<string>): PillarFlag {
  if (visitEventIds.some((id) => quietIds.has(id))) return "quiet";
  if (visitEventIds.some((id) => dwellIds.has(id))) return "dwell";
  return "none";
}

function flagToken(flag: PillarFlag): MaterialToken {
  if (flag === "quiet") return "pillar-danger";
  if (flag === "dwell") return "pillar-warn";
  return "pillar";
}

export function toSceneDescription(model: WeekModel, revision = 0): SceneDescription {
  const ribbon: RibbonDay[] = weekRibbon(model);
  const byVisitId = new Map<string, Visit>(model.visits.map((v) => [v.id, v]));
  const candidates = candidateIncidents(model);
  const quietIds = new Set<string>();
  const dwellIds = new Set<string>();
  for (const c of candidates) {
    if (c.kind === "quiet_hours_activity") for (const id of c.eventIds) quietIds.add(id);
    else if (c.kind === "long_dwell") for (const id of c.eventIds) dwellIds.add(id);
  }
  const off = model.household.utcOffsetMin;
  const entities: SceneEntity[] = [];

  // The door and the stoop (always rows).
  entities.push(
    { id: "door-wall", kind: "box", position: [0, 1.6, -0.5], size: [13, 3.2, 0.3], material: material("wall") },
    { id: "door", kind: "box", position: [0, 1.25, -0.3], size: [1.3, 2.5, 0.12], material: material("door") },
    { id: "door-frame-left", kind: "box", position: [-0.75, 1.3, -0.32], size: [0.2, 2.6, 0.2], material: material("door") },
    { id: "door-frame-right", kind: "box", position: [0.75, 1.3, -0.32], size: [0.2, 2.6, 0.2], material: material("door") },
    { id: "door-lintel", kind: "box", position: [0, 2.65, -0.32], size: [1.7, 0.2, 0.2], material: material("door") },
    { id: "stoop", kind: "box", position: [0, 0.15, 0.35], size: [3.0, 0.3, 1.4], material: material("stoop") },
    { id: "stoop-step", kind: "box", position: [0, 0.075, 1.3], size: [3.0, 0.15, 0.5], material: material("stoop") },
  );

  // One frustum per device with snapshot, in model.devices order.
  const frustumDevices = model.devices.filter((d) => d.snapshot);
  frustumDevices.forEach((d, i) => {
    entities.push({
      id: `dev-${d.id}`,
      kind: "custom",
      customKey: "camera-frustum",
      position: [(i - (frustumDevices.length - 1) / 2) * 1.6, 2.3, -0.2],
      size: [1.8, 1.4, 3.4],
      material: material("frustum"),
      meta: { deviceId: d.id, online: d.online, name: d.description },
    });
  });

  // Day strips, quiet bands, ticks, duplicates, routine pillars, visit pillars,
  // outages and the history seam.
  const tickInstances: { position: [number, number, number] }[] = [];
  const dupInstances: { position: [number, number, number] }[] = [];
  const routineInstances: { position: [number, number, number] }[] = [];
  for (const day of ribbon) {
    entities.push({
      id: `day:${day.dayIndex}`,
      kind: "box",
      position: [dayX(day.dayIndex), 0.02, 5.6],
      size: [1.4, 0.04, 8],
      material: material("stoop"),
      label: DAY_LABELS[day.dayIndex] ?? `D${day.dayIndex}`,
      meta: { dayIndex: day.dayIndex },
    });
    day.quietBands.forEach((band, k) => {
      const mid = (band.fromMin + band.toMin) / 2;
      entities.push({
        id: `quiet:${day.dayIndex}:${k}`,
        kind: "box",
        position: [dayX(day.dayIndex), 0.045, minuteZ(mid)],
        size: [1.4, 0.05, ((band.toMin - band.fromMin) / 1440) * 8],
        material: material("gap", { opacity: 0.55 }),
      });
    });
    for (const tick of day.ticks) {
      tickInstances.push({ position: [dayX(day.dayIndex) + TICK_DX, 0.05, minuteZ(tick.minute)] });
      if (tick.duplicate) {
        dupInstances.push({ position: [dayX(day.dayIndex) + DUP_DX, 0.12, minuteZ(tick.minute)] });
      }
    }
    for (const visit of day.visits) {
      const mid = (visit.fromMin + visit.toMin) / 2;
      if (visit.routineId !== undefined) {
        routineInstances.push({ position: [dayX(day.dayIndex) + PILLAR_DX, 0.25, minuteZ(mid)] });
        continue;
      }
      const dwellMin = visit.toMin - visit.fromMin;
      const h = pillarHeight(dwellMin);
      const full = byVisitId.get(visit.id);
      const flag = flagOfVisit(full?.eventIds ?? [], quietIds, dwellIds);
      entities.push({
        id: visit.id,
        kind: "box",
        position: [dayX(day.dayIndex) + PILLAR_DX, h / 2, minuteZ(mid)],
        size: [0.22, h, 0.22],
        material: material(flagToken(flag)),
        ...(flag !== "none" && full !== undefined ? { label: fmtClock(full.startMs, off) } : {}),
        meta: { visitId: visit.id, dwellMin, flag },
      });
    }
    for (const outage of day.outages) {
      const mid = (outage.fromMin + outage.toMin) / 2;
      entities.push({
        id: `outage:${outage.deviceId}:${day.dayIndex}:${outage.fromMin}`,
        kind: "box",
        position: [dayX(day.dayIndex) + OUTAGE_DX, 0.06, minuteZ(mid)],
        size: [0.5, 0.06, (outage.minutes / 1440) * 8],
        material: material("gap", { opacity: 0.5 }),
        meta: { deviceId: outage.deviceId, minutes: outage.minutes },
      });
    }
    if (day.seamMinute !== null) {
      entities.push({
        id: `seam:${day.dayIndex}`,
        kind: "box",
        position: [dayX(day.dayIndex), 0.06, minuteZ(day.seamMinute)],
        size: [1.5, 0.08, 0.05],
        material: material("frustum"),
        label: "from history",
      });
    }
  }
  if (tickInstances.length > 0) {
    entities.push({
      id: "ticks",
      kind: "instanced",
      position: [0, 0, 0],
      size: [0.18, 0.02, 0.04],
      material: material("pillar"),
      instances: tickInstances,
    });
  }
  if (dupInstances.length > 0) {
    entities.push({
      id: "dups",
      kind: "instanced",
      position: [0, 0, 0],
      size: [0.12, 0.24, 0.12],
      material: material("pillar-dup"),
      instances: dupInstances,
    });
  }
  if (routineInstances.length > 0) {
    entities.push({
      id: "visits-routine",
      kind: "instanced",
      position: [0, 0, 0],
      size: [0.2, 0.5, 0.2],
      material: material("pillar"),
      instances: routineInstances,
    });
  }

  // Incident arcs and evidence flares: one per incident, on its first ribbon day.
  const arcToken = (status: string): MaterialToken =>
    status === "resolved" ? "resolved" : status === "dismissed" ? "gap" : "pillar-warn";
  for (const inc of model.incidents) {
    const day = ribbon.find((d) => d.incidents.some((x) => x.id === inc.id));
    const ribbonInc = day?.incidents.find((x) => x.id === inc.id);
    if (day === undefined || ribbonInc === undefined) continue;
    const mid = (ribbonInc.fromMin + ribbonInc.toMin) / 2;
    entities.push({
      id: inc.id,
      kind: "custom",
      customKey: "incident-arc",
      position: [dayX(day.dayIndex), 0.08, minuteZ(mid)],
      size: [1.4, 0.2, Math.max(((ribbonInc.toMin - ribbonInc.fromMin) / 1440) * 8 + 0.6, 1.0)],
      material: material(arcToken(inc.status)),
      meta: { status: inc.status, kind: inc.kind, dayIndex: day.dayIndex, title: inc.title },
    });
    const media = model.media.find((m) => m.incidentId === inc.id);
    if (media !== undefined) {
      entities.push({
        id: `flare:${inc.id}`,
        kind: "custom",
        customKey: "evidence-flare",
        position: [dayX(day.dayIndex), 3.3, minuteZ(mid)],
        size: [0.3, 0.3, 0.3],
        material: material("arc"),
        meta: { incidentId: inc.id, mediaId: media.id },
      });
    }
  }

  // Visit threads: a visit that crossed more than one camera component, on the
  // visit's own day. Like every other row it is a function of the week the
  // ribbon draws, so a visit the calendar does not show (a baseline week) has
  // no thread.
  const frustumIds = frustumDevices.map((d) => d.id);
  for (const thread of visitorThreads(model)) {
    const day = ribbon.find((d) => d.visits.some((v) => v.id === thread.visitId));
    const rv = day?.visits.find((v) => v.id === thread.visitId);
    if (day === undefined || rv === undefined) continue;
    const first = hopPosition(thread.hops[0] as string, frustumIds);
    const last = hopPosition(thread.hops[thread.hops.length - 1] as string, frustumIds);
    entities.push({
      id: `thread:${thread.visitId}`,
      kind: "custom",
      customKey: "visit-thread",
      position: [dayX(day.dayIndex) + PILLAR_DX, 1.0, minuteZ((rv.fromMin + rv.toMin) / 2)],
      size: [0, 0, 0],
      material: material("arc"),
      meta: {
        visitId: thread.visitId,
        hops: thread.hops.join(","),
        sx: first[0], sy: first[1], sz: first[2],
        ex: last[0], ey: last[1], ez: last[2],
      },
    });
  }

  entities.sort((a, b) => {
    const order = entityOrder(a.id);
    const ob = entityOrder(b.id);
    if (order !== ob) return order - ob;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { revision, bounds: BOUNDS, entities };
}

/** Table-row order of §5.1: door and stoop rows, frustums, day strips with
 *  their bands, instanced groups, visit pillars, outages, seams. */
function entityOrder(id: string): number {
  if (id === "door-wall" || id === "door" || id.startsWith("door-frame") || id === "door-lintel" || id === "stoop" || id === "stoop-step") return 0;
  if (id.startsWith("dev-")) return 1;
  if (id.startsWith("day:")) return 2;
  if (id.startsWith("quiet:")) return 3;
  if (id === "ticks" || id === "dups" || id === "visits-routine") return 4;
  if (id.startsWith("vis:")) return 5;
  if (id.startsWith("outage:")) return 6;
  if (id.startsWith("seam:")) return 7;
  if (id.startsWith("inc-")) return 8;
  if (id.startsWith("flare:")) return 9;
  if (id.startsWith("thread:")) return 10;
  return 11;
}
