// src/3d/bind.ts — selection and highlight rules between the store and the scene (DP-3D §5.4).
// Requirement IDs: FR-20
import type { WeekModel } from "src/domain/types.js";
import { dayIndexOf } from "src/domain/derive.js";
import { DAY_MS } from "src/domain/time.js";

export const HIGHLIGHT_MS = 2400;

/** ui.selectedIncidentId, else "day:<selectedDay>", else null. */
export function selectedIdOf(model: WeekModel): string | null {
  if (model.ui.selectedIncidentId !== null) return model.ui.selectedIncidentId;
  if (model.ui.selectedDay !== null) return `day:${model.ui.selectedDay}`;
  return null;
}

export interface UiPatch {
  selectedDay?: number | null;
  selectedIncidentId?: string | null;
  shotId?: string;
}

/** The store patch for a scene selection, or undefined when not selectable. The
 *  stored incident id is always the incident ("inc-<n>"), never the flare id. */
export function uiPatchForSelection(model: WeekModel, id: string | null): UiPatch | undefined {
  if (id === null) return { selectedIncidentId: null, selectedDay: null };
  if (id.startsWith("day:")) {
    const day = Number(id.slice(4));
    if (!Number.isInteger(day) || day < 0 || day > 6) return undefined;
    return { selectedDay: day, selectedIncidentId: null };
  }
  if (id.startsWith("inc-") || id.startsWith("flare:")) {
    const incidentId = id.startsWith("flare:") ? id.slice("flare:".length) : id;
    const incident = model.incidents.find((x) => x.id === incidentId);
    if (!incident) return undefined;
    return {
      selectedIncidentId: incident.id,
      selectedDay: incident.dayIndex !== undefined ? toRibbonDay(model, incident.dayIndex) : model.ui.selectedDay,
      shotId: `focus:${id}`,
    };
  }
  if (id.startsWith("vis:") || id.startsWith("thread:")) {
    const visitId = id.startsWith("thread:") ? id.slice("thread:".length) : id;
    const visit = model.visits.find((v) => v.id === visitId);
    if (!visit) return undefined;
    const linked = model.incidents
      .filter((x) => x.eventIds.some((eid) => visit.eventIds.includes(eid)))
      .sort((a, b) => incidentRank(a.id) - incidentRank(b.id));
    const newest = linked[linked.length - 1];
    if (newest) {
      return {
        selectedIncidentId: newest.id,
        selectedDay: newest.dayIndex !== undefined ? toRibbonDay(model, newest.dayIndex) : model.ui.selectedDay,
        shotId: `focus:${newest.id}`,
      };
    }
    return {
      selectedDay: Math.max(0, Math.min(6, dayIndexOf(model, visit.startMs) - dayIndexBase(model))),
      selectedIncidentId: null,
    };
  }
  if (id.startsWith("quiet:") || id.startsWith("outage:") || id.startsWith("seam:")) {
    const day = Number(id.split(":")[1]);
    if (!Number.isInteger(day) || day < 0 || day > 6) return undefined;
    return { selectedDay: day, selectedIncidentId: null };
  }
  return undefined;
}

function incidentRank(id: string): number {
  const n = Number(id.slice("inc-".length));
  return Number.isFinite(n) ? n : 0;
}

/** Absolute day index (0..13) of the displayed week's first day: the review
 *  window starts baselineEndMs, i.e. 7 days after the baseline start. */
function dayIndexBase(model: WeekModel): number {
  return Math.round((model.window.baselineEndMs - model.window.baselineStartMs) / DAY_MS);
}

/** Incident dayIndex values are absolute (0..13); the selection state speaks
 *  ribbon (0..6). Values already in ribbon range pass through. */
function toRibbonDay(model: WeekModel, day: number): number {
  if (day >= 0 && day <= 6) return day;
  return Math.max(0, Math.min(6, day - dayIndexBase(model)));
}

/** The union of the new ledger entries' entityIds that are scene ids, and the
 *  new head seq. History (seq <= lastSeq) is never highlighted. */
export function highlightFromLedger(
  model: WeekModel,
  lastSeq: number,
  sceneIds: ReadonlySet<string>,
): { ids: string[]; seq: number } {
  const fresh = model.ledger.filter((e) => e.seq > lastSeq);
  const ids = [...new Set(fresh.flatMap((e) => e.entityIds).filter((id) => sceneIds.has(id)))];
  const seq = fresh.length > 0 ? (fresh[fresh.length - 1] as { seq: number }).seq : lastSeq;
  return { ids, seq };
}
