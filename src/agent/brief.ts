// Requirement IDs: FR-15
import { DAY_MS, fmtClock, fmtDay, localMinutes, localWeekday } from "src/domain/time.js";
import { REVIEW_START_MS, REVIEW_END_MS } from "src/domain/seed.js";
import type { IncidentKind, WeekModel } from "src/domain/types.js";

/** Deterministic plain-language brief for the review week: counts, kept routines, incidents with their explanations. Banned-vocabulary free. */
export function buildWeeklyBrief(model: WeekModel): { title: string; body: string; lines: string[] } {
  const off = model.household.utcOffsetMin;
  const reviewVisits = model.visits.filter((v) => v.startMs >= REVIEW_START_MS && v.startMs < REVIEW_END_MS);
  const routineVisits = reviewVisits.filter((v) => v.routineId !== undefined).length;
  let expected = 0;
  let kept = 0;
  for (let n = 7; n <= 13; n++) {
    const dayStart = model.window.baselineStartMs + n * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    if (!model.events.some((e) => e.tsMs >= dayStart && e.tsMs < dayEnd)) continue;
    const weekday = localWeekday(dayStart + 12 * 3_600_000, off);
    for (const r of model.routines) {
      if (!r.days.includes(weekday)) continue;
      expected += 1;
      if (model.visits.some((v) => v.routineId === r.id && v.startMs >= dayStart && v.startMs < dayEnd)) kept += 1;
    }
  }
  const lines: string[] = [
    `${reviewVisits.length} visits at the front door, ${routineVisits} of them part of the usual routines.`,
    `Routines kept: ${kept} of ${expected}.`,
  ];
  for (const inc of model.incidents.slice(0, 5)) {
    lines.push(`${inc.title}: ${inc.summary ?? "needs a look"}`);
  }
  const q = model.household.quietHours;
  const anchor = REVIEW_START_MS;
  const anchorMin = localMinutes(anchor, off);
  const startTs = anchor - anchorMin * 60_000 + q.startMin * 60_000;
  const endTs = anchor - anchorMin * 60_000 + q.endMin * 60_000;
  lines.push(`Quiet hours: ${fmtClock(startTs, off)} to ${fmtClock(endTs, off)}.`);
  const title = `Week of ${fmtDay(REVIEW_START_MS, off)}`;
  return { title, body: lines.join("\n"), lines };
}

const TEMPLATES: Record<IncidentKind, (v: { clock: string; day: string; mins: number; p90: number; device: string; routine: string }) => string> = {
  quiet_hours_activity: (v) => `There was door activity at ${v.clock} on ${v.day}, during quiet hours. A gentle check-in could be worth it.`,
  long_dwell: (v) => `Someone stayed at the door for ${v.mins} min on ${v.day}, longer than the usual ${v.p90} min.`,
  device_outage: (v) => `${v.device} stopped reporting for ${v.mins} min on ${v.day}, so activity in that time may be missing.`,
  missed_routine: (v) => `The ${v.routine} did not happen on ${v.day}. It usually does.`,
  duplicate_burst: () => `Several events were the same moment seen twice.`,
};

export interface NarratorFacts {
  facts: string[];
  factsText: string;
  template: string;
  clock: string;
  day: string;
  mins: number;
  p90: number;
}

/** Facts for one incident, built from the model (§5.10), plus the fallback template. */
export function buildNarratorFacts(
  incident: { id: string; kind: IncidentKind; title: string; startMs: number; endMs: number; eventIds: string[]; routineId?: string },
  model: WeekModel,
): NarratorFacts {
  const off = model.household.utcOffsetMin;
  const clock = fmtClock(incident.startMs, off);
  const day = fmtDay(incident.startMs, off);
  const mins = Math.max(1, Math.round((incident.endMs - incident.startMs) / 60_000));
  const p90 = Math.round(Math.max(model.baseline.dwellP90Sec, 900) / 60);
  const device = model.devices.find((d) => d.id === (model.events.find((e) => e.id === incident.eventIds[0])?.deviceId ?? ""))?.description ??
    (model.events.find((e) => e.id === incident.eventIds[0])?.deviceId ?? "A device");
  const routine = model.routines.find((r) => r.id === incident.routineId)?.name ?? incident.routineId ?? "A routine";
  const facts = [
    `Day: ${day}`,
    `Time: ${clock}`,
    `Duration: ${mins} min`,
    `Usual longest stay: ${p90} min`,
    `Events: ${incident.eventIds.length}`,
  ];
  if (incident.kind === "device_outage") facts.push(`Device: ${device}`);
  if (incident.kind === "missed_routine") facts.push(`Routine: ${routine}`);
  const factsText = facts.join("\n");
  const template = TEMPLATES[incident.kind]({ clock, day, mins, p90, device, routine });
  return { facts, factsText, template, clock, day, mins, p90 };
}

/** Every digit run in `text` must occur in `factsText`. */
export function numbersGrounded(text: string, factsText: string): boolean {
  const runs = text.match(/\d+/g) ?? [];
  return runs.every((run) => factsText.includes(run));
}
