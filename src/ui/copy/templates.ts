// src/ui/copy/templates.ts — every function is TOTAL: any input (undefined,
// null, "", NaN, negative) yields a sentence with no empty slot (DP-UI §3.1, §6.10).
// Requirement IDs: FR-21, NFR-08
import { fmtClock, fmtDay } from "src/domain/time.js";
import { weekRibbon } from "src/domain/derive.js";
import type { RibbonDay } from "src/domain/derive.js";
import { RULE_IDS } from "src/domain/rules.js";
import type { Incident, WeekModel } from "src/domain/types.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MON_SHORT: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
};

export interface Msg {
  title: string;
  detail: string;
}

function cleanLine(v: unknown): string {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : "";
}

function countOf(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** "All clear …" at 0, otherwise "{n} moment(s) broke the usual rhythm. …". */
export function leadSentence(openChecks: number | null | undefined): string {
  const n = countOf(openChecks);
  if (n === 0) return "All clear — the week matched the usual rhythm.";
  return `${n} ${n === 1 ? "moment" : "moments"} broke the usual rhythm. Start with the first circled day.`;
}

/** "The week of 12 October" from the first day of weekRibbon(model). */
export function weekTitle(model: WeekModel): string {
  try {
    const first = weekRibbon(model as WeekModel)[0];
    const label = first?.dateLabel ?? "";
    const m = /\b(\d{1,2})\b\s*([A-Za-z]+)/.exec(label);
    if (m) {
      const month = MON_SHORT[(m[2] as string).slice(0, 3).toLowerCase()] ?? m[2];
      return `The week of ${m[1]} ${month}`;
    }
  } catch {
    /* fall through to the total fallback */
  }
  return "The week of the sample week";
}

/** "Rosa's front door · Sample week" (first word of the household name). */
export function weekSupport(model: WeekModel, ringMode: "bundle" | "live" | "http" | string | undefined): string {
  const name = (model as WeekModel | null)?.household?.name ?? "";
  const first = cleanLine(name).split(/\s+/)[0] ?? "";
  const head = first !== "" ? `${first}'s front door` : "The front door";
  const source = ringMode === "live" ? "Live from Ring" : "Sample week";
  return `${head} · ${source}`;
}

export function emptyEvents(): Msg {
  return {
    title: "No doorway events yet",
    detail: "Load the sample week, or paste a Ring Playground token to read your own devices.",
  };
}

export function emptyIncidents(): Msg {
  return {
    title: "Nothing broke the rhythm",
    detail: "Every visit this week matched the usual pattern.",
  };
}

export function emptyChecks(): Msg {
  return {
    title: "No open checks",
    detail: "The last run found nothing to fix.",
  };
}

export function ringError(status?: number | null): Msg {
  if (typeof status === "number" && Number.isFinite(status) && status > 0) {
    return {
      title: "Couldn't read Ring",
      detail: `Ring answered with an error (${Math.floor(status)}). The sample week is still available.`,
    };
  }
  return {
    title: "Couldn't read Ring",
    detail: "Ring didn't answer. The sample week is still available.",
  };
}

export function actionError(message?: string | null): Msg {
  const m = cleanLine(message);
  return {
    title: "That didn't work",
    detail: m !== "" ? m : "The action stopped before it finished. Nothing was changed.",
  };
}

export function backupModel(): Msg {
  return {
    title: "Using a backup model",
    detail: "Amazon Bedrock isn't answering, so a different model is doing this review. Its notes are labelled.",
  };
}

export function recordedRun(dateLabel?: string | null): Msg {
  const d = cleanLine(dateLabel);
  return {
    title: "Replaying a recorded run",
    detail: d !== "" ? `The live model isn't reachable, so this is the run saved on ${d}.` : "The live model isn't reachable, so this is a saved run.",
  };
}

export function runningByHand(): Msg {
  return {
    title: "Running by hand",
    detail: "No model is available. Every action still works from the action list.",
  };
}

export function sampleWeek(): Msg {
  return {
    title: "Showing the sample week",
    detail: "Ring couldn't be reached with that token, so this is the synthetic sample week.",
  };
}

export function tokenWarning(minutes?: number | null): Msg {
  const m = typeof minutes === "number" && Number.isFinite(minutes) ? Math.floor(minutes) : 0;
  if (m >= 1) {
    return {
      title: "Token ending soon",
      detail: `Your Playground token has ${m} ${m === 1 ? "minute" : "minutes"} left.`,
    };
  }
  return {
    title: "Token ending soon",
    detail: "Your Playground token has less than a minute left.",
  };
}

export function budgetWarning(pct?: number | null): Msg {
  const p = typeof pct === "number" && Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
  return {
    title: `Demo budget at ${p}%`,
    detail: "The review will stop at the limit.",
  };
}

export function notSupported3d(): Msg {
  return {
    title: "3D view unavailable",
    detail: "This browser can't draw the doorway, so the flat week below shows the same events.",
  };
}

export function rejected(summary?: string | null): Msg {
  const s = cleanLine(summary);
  return {
    title: "Declined",
    detail: s !== "" ? `You declined "${s}". The agent will ask what to do instead.` : "You declined the suggestion. The agent will ask what to do instead.",
  };
}

/** Phase name to work-indicator line; anything else → "Working on the week". */
export function phaseLabel(role?: string | null): string {
  switch (role) {
    case "reader":
      return "Reading doorway events";
    case "planner":
      return "Planning the review";
    case "actor":
      return "Checking each day against the usual rhythm";
    case "verify":
      return "Running the checks";
    case "repair":
      return "Fixing what the checks found";
    case "narrator":
      return "Writing plain-language notes";
    case "checkpoint":
      return "Waiting for your decision";
    default:
      return "Working on the week";
  }
}

/** "Tuesday 13 October, 3 events, 1 moment to look at". */
export function ariaDayLabel(day: RibbonDay): string {
  if (!day || typeof (day as RibbonDay).dayIndex !== "number" || typeof (day as RibbonDay).dateLabel !== "string") {
    return "A day with no recorded events";
  }
  const weekday = WEEKDAYS[((day.dayIndex % 7) + 7) % 7] ?? "Day";
  const m = /\b(\d{1,2})\b\s*([A-Za-z]+)/.exec(day.dateLabel);
  const date = m ? `${m[1]} ${MON_SHORT[(m[2] as string).slice(0, 3).toLowerCase()] ?? m[2]}` : day.dateLabel;
  const events = typeof day.eventCount === "number" ? day.eventCount : day.ticks.length;
  const moments = day.incidents.length;
  const ev = events <= 0 ? "no events" : events === 1 ? "1 event" : `${events} events`;
  const mo = moments <= 0 ? "no moments to look at" : moments === 1 ? "1 moment to look at" : `${moments} moments to look at`;
  return `${weekday} ${date}, ${ev}, ${mo}`;
}

/** "TUE 13 OCT · 02:14". */
export function incidentEyebrow(inc: Incident, utcOffsetMin: number): string {
  try {
    const start = (inc as Incident | null)?.startMs;
    const off = typeof utcOffsetMin === "number" && Number.isFinite(utcOffsetMin) ? utcOffsetMin : 0;
    if (typeof start !== "number" || !Number.isFinite(start)) return "A moment to look at";
    return `${fmtDay(start, off)} · ${fmtClock(start, off)}`.toUpperCase();
  } catch {
    return "A moment to look at";
  }
}

/** The issue's own sentence, never empty. */
export function issueTitle(issue: { message: string }): string {
  const m = cleanLine((issue as { message?: unknown } | null)?.message);
  return m !== "" ? m : "A check found something worth a look.";
}

export const RULE_WORDS: Record<(typeof RULE_IDS)[number], string> = {
  "quiet-hours": "Quiet hours",
  dwell: "Long visits",
  outage: "Device offline",
  consent: "Consent",
  "duplicate-burst": "Duplicate events",
  "ledger-integrity": "Change history",
  "incident-coverage": "Moments without a write-up",
};
