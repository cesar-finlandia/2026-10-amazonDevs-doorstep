// Requirement IDs: FR-04
// The deterministic truth engine: seven rules over the WeekModel.
import type { Rule } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import type { Issue } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import { dayIndexOf, deviceOutages, findDuplicateClusters } from "src/domain/derive.js";
import { DAY_MS, fmtClock, fmtDay, inWindow, localMinutes, localWeekday } from "src/domain/time.js";
import type { IncidentKind, QuietHours, WeekModel } from "src/domain/types.js";

export const RULE_IDS: readonly ["quiet-hours", "dwell", "outage", "consent", "duplicate-burst", "ledger-integrity", "incident-coverage"] = [
  "quiet-hours", "dwell", "outage", "consent", "duplicate-burst", "ledger-integrity", "incident-coverage",
];
export const DUP_WINDOW_MS: number = 60_000;
export const DWELL_FLOOR_SEC: number = 900;
export const OUTAGE_MIN: number = 30;

/** (start + tolerance, end − tolerance): 1320/420/30 → { startMin: 1350, endMin: 390 } i.e. 22:30–06:30. */
export function EFFECTIVE_QUIET_HOURS(q: QuietHours): { startMin: number; endMin: number } {
  return { startMin: q.startMin + q.toleranceMin, endMin: q.endMin - q.toleranceMin };
}

export interface Candidate {
  kind: IncidentKind; ruleId: (typeof RULE_IDS)[number]; title: string;
  eventIds: string[]; startMs: number; endMs: number; routineId?: string; dayIndex: number;
}

function padMinute(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Every condition the rules flag, before coverage is considered, ordered by startMs. Single source for the rules' issues and for
 *  DP-AGENT-WORKFLOW's compare_to_baseline findings. Kinds produced: quiet_hours_activity, long_dwell, device_outage, missed_routine. */
export function candidateIncidents(model: WeekModel): Candidate[] {
  const out: Candidate[] = [];
  const off = model.household.utcOffsetMin;
  const eff = EFFECTIVE_QUIET_HOURS(model.household.quietHours);
  const revStart = model.window.baselineEndMs;
  const revEnd = model.window.endMs;
  const dwellThreshold = Math.max(model.baseline.dwellP90Sec, DWELL_FLOOR_SEC);
  for (const v of model.visits) {
    if (v.startMs < revStart || v.startMs >= revEnd) continue;
    const inQuiet = inWindow(localMinutes(v.startMs, off), eff.startMin, eff.endMin);
    if (v.routineId === undefined && inQuiet) {
      out.push({
        kind: "quiet_hours_activity", ruleId: "quiet-hours",
        title: `Door activity at ${fmtClock(v.startMs, off)} during quiet hours`,
        eventIds: [...v.eventIds], startMs: v.startMs, endMs: v.endMs, dayIndex: dayIndexOf(model, v.startMs),
      });
    } else if (v.routineId === undefined && !inQuiet && v.dwellSec > dwellThreshold) {
      out.push({
        kind: "long_dwell", ruleId: "dwell",
        title: `Long stay at the door on ${fmtDay(v.startMs, off)}`,
        eventIds: [...v.eventIds], startMs: v.startMs, endMs: v.endMs, dayIndex: dayIndexOf(model, v.startMs),
      });
    }
  }
  for (const o of deviceOutages(model)) {
    if (o.fromMs < revStart || o.fromMs >= revEnd) continue;
    if (o.toMs - o.fromMs <= OUTAGE_MIN * 60_000) continue;
    const mins = Math.round((o.toMs - o.fromMs) / 60_000);
    const desc = model.devices.find((d) => d.id === o.deviceId)?.description ?? o.deviceId;
    out.push({
      kind: "device_outage", ruleId: "outage",
      title: `${desc} offline for ${mins} min`,
      eventIds: [...o.eventIds], startMs: o.fromMs, endMs: o.toMs, dayIndex: dayIndexOf(model, o.fromMs),
    });
  }
  for (let n = 7; n <= 13; n++) {
    const dayStart = model.window.baselineStartMs + n * DAY_MS;
    const weekday = localWeekday(dayStart + 12 * 3_600_000, off);
    if (!model.events.some((e) => e.tsMs >= dayStart && e.tsMs < dayStart + DAY_MS)) continue;
    for (const r of model.routines) {
      if (!r.days.includes(weekday)) continue;
      const matched = model.visits.some(
        (v) => v.routineId === r.id && v.startMs >= dayStart && v.startMs < dayStart + DAY_MS,
      );
      if (matched) continue;
      out.push({
        kind: "missed_routine", ruleId: "incident-coverage",
        title: `${r.name} did not happen on ${fmtDay(dayStart, off)}`,
        eventIds: [], routineId: r.id, startMs: dayStart + r.windowStartMin * 60_000,
        endMs: dayStart + r.windowEndMin * 60_000, dayIndex: n,
      });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs || (a.kind < b.kind ? -1 : 1));
}

type Coverage = "uncovered" | "covered" | "settled";

function coverageOf(model: WeekModel, c: Candidate): Coverage {
  let covered = false;
  for (const x of model.incidents) {
    if (x.kind !== c.kind) continue;
    const linked = x.eventIds.some((id) => c.eventIds.includes(id)) ||
      (c.routineId !== undefined && x.routineId === c.routineId && x.dayIndex === c.dayIndex);
    if (!linked) continue;
    if (x.status === "resolved" || x.status === "dismissed") return "settled";
    if (x.status === "open" || x.status === "explained") covered = true;
  }
  return covered ? "covered" : "uncovered";
}

function messageFor(model: WeekModel, c: Candidate): string {
  const off = model.household.utcOffsetMin;
  switch (c.ruleId) {
    case "quiet-hours": {
      const eff = EFFECTIVE_QUIET_HOURS(model.household.quietHours);
      return `A visit at ${fmtClock(c.startMs, off)} on ${fmtDay(c.startMs, off)} fell inside quiet hours (${padMinute(eff.startMin)}-${padMinute(eff.endMin)}).`;
    }
    case "dwell": {
      const visit = model.visits.find((v) => v.eventIds.includes(c.eventIds[0] as string));
      const mins = Math.round((visit?.dwellSec ?? 0) / 60);
      const usual = Math.round(Math.max(model.baseline.dwellP90Sec, DWELL_FLOOR_SEC) / 60);
      return `A visit on ${fmtDay(c.startMs, off)} lasted ${mins} min, above the usual ${usual} min.`;
    }
    case "outage": {
      const desc = model.devices.find((d) => d.id === model.events.find((e) => e.id === c.eventIds[0])?.deviceId)?.description ??
        model.events.find((e) => e.id === c.eventIds[0])?.deviceId ?? "A device";
      return `${desc} was offline for ${Math.round((c.endMs - c.startMs) / 60_000)} min on ${fmtDay(c.startMs, off)}.`;
    }
    case "incident-coverage": {
      const name = model.routines.find((r) => r.id === c.routineId)?.name ?? c.routineId ?? "A routine";
      return `The ${name} on ${fmtDay(c.startMs, off)} did not show up.`;
    }
    default:
      throw new Error(`no message template for rule ${(c as Candidate).ruleId}`);
  }
}

function candidateRule(ruleId: Candidate["ruleId"], description: string): Rule<WeekModel> {
  return {
    id: ruleId,
    description,
    check(model) {
      const issues: Issue[] = [];
      for (const c of candidateIncidents(model).filter((x) => x.ruleId === ruleId)) {
        const coverage = coverageOf(model, c);
        if (coverage === "settled") continue;
        issues.push({
          id: `${ruleId}:${c.eventIds[0] ?? `${c.routineId}:day-${c.dayIndex}`}`,
          severity: coverage === "covered" ? "warning" : "error",
          entityIds: c.kind === "missed_routine" ? [c.routineId as string, `day-${c.dayIndex}`] : [...c.eventIds],
          message: messageFor(model, c),
          fix: {
            action: "open_incident",
            args: {
              kind: c.kind, title: c.title, eventIds: [...c.eventIds], startMs: c.startMs, endMs: c.endMs,
              ...(c.routineId !== undefined ? { routineId: c.routineId } : {}),
              ...(c.kind === "missed_routine" ? { dayIndex: c.dayIndex } : {}),
            },
          },
        });
      }
      return issues;
    },
  };
}

export const truthRules: Rule<WeekModel>[] = [
  candidateRule("quiet-hours", "A non-routine visit started inside the effective quiet window."),
  candidateRule("dwell", "A non-routine visit outside quiet hours outlasted the baseline p90."),
  candidateRule("outage", "A device stayed offline longer than 30 minutes."),
  {
    id: "consent",
    description: "A nudge or chime was prepared without matching granted consent.",
    check(model) {
      const issues: Issue[] = [];
      for (const n of model.nudges) {
        if (n.status !== "proposed" && n.status !== "approved" && n.status !== "sent") continue;
        const granted = model.consent.some((c) => c.scope === n.scope && c.granted);
        if (granted) continue;
        issues.push({
          id: `consent:${n.id}`,
          severity: "error",
          entityIds: [n.id],
          message: `A ${n.scope === "chime_announcement" ? "chime" : "nudge"} was prepared without consent.`,
        });
      }
      return issues;
    },
  },
  {
    id: "duplicate-burst",
    description: "Two channel copies describe the same moment.",
    check(model) {
      const off = model.household.utcOffsetMin;
      return findDuplicateClusters(model.events).map((cluster) => ({
        id: `duplicate-burst:${cluster[0]?.id}`,
        severity: "error" as const,
        entityIds: cluster.map((e) => e.id),
        message: `${cluster.length} events look like the same moment (${fmtClock(cluster[0]?.tsMs as number, off)}).`,
        fix: { action: "merge_duplicate_events", args: { eventIds: cluster.map((e) => e.id) } },
      }));
    },
  },
  {
    id: "ledger-integrity",
    description: "The activity log sequence is gap-free.",
    check(model) {
      for (let i = 0; i < model.ledger.length; i++) {
        if (model.ledger[i]?.seq !== i + 1) {
          return [{
            id: "ledger-integrity:gap",
            severity: "error" as const,
            entityIds: [],
            message: `The activity log has a gap after entry ${i}.`,
          }];
        }
      }
      return [];
    },
  },
  candidateRule("incident-coverage", "An expected routine left no visit on a day with activity."),
];
