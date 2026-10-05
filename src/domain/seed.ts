// Seeds: the regression-clean week and the demo starting point.
import { DAY_MS } from "src/domain/time.js";
import { computeBaseline, deriveVisits, toDomainDevice } from "src/domain/derive.js";
import { BUNDLE_START_MS, ROUTINES, UTC_OFFSET_MIN, buildDevices, generateEvents } from "src/domain/generator.js";
import type { ConsentScope, WeekModel } from "src/domain/types.js";

export const REVIEW_START_MS: number = BUNDLE_START_MS + 7 * DAY_MS;
export const REVIEW_END_MS: number = BUNDLE_START_MS + 14 * DAY_MS;
export const DEMO_NOW_MS: number = REVIEW_END_MS - 60000;

function baseModel(): WeekModel {
  return {
    household: {
      id: "hh-rosa", name: "Rosa", age: 78, caretaker: "Maya", utcOffsetMin: UTC_OFFSET_MIN,
      quietHours: { startMin: 1320, endMin: 420, toleranceMin: 30 },
      blurb: "Rosa's front door and hall camera.",
    },
    devices: buildDevices().map(toDomainDevice),
    events: [],
    visits: [],
    visitOverrides: {},
    routines: ROUTINES.map((r) => ({ ...r, days: [...r.days] })),
    consent: [],
    nudges: [],
    incidents: [],
    notes: [],
    media: [],
    webhookLedger: [],
    ledger: [],
    baseline: { dwellP90Sec: 0, dwellMedianSec: 0, sampleVisits: 0, rhythm: [], fromMs: 0, toMs: 0 },
    window: {
      startMs: BUNDLE_START_MS, endMs: REVIEW_END_MS,
      baselineStartMs: BUNDLE_START_MS, baselineEndMs: REVIEW_START_MS,
    },
    clockMs: DEMO_NOW_MS,
    ui: { selectedDay: null, selectedIncidentId: null, shotId: "overview", liveViewDeviceId: null },
    synthetic: true,
  };
}

function ingestClean(model: WeekModel, variant: "clean" | "demo", uptoDay: number): void {
  model.events = generateEvents(variant)
    .filter((e) => Math.floor((e.tsMs - BUNDLE_START_MS) / DAY_MS) <= uptoDay)
    .sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1));
  model.visits = deriveVisits(model.events, model.routines, model.household.utcOffsetMin, model.visitOverrides);
  model.baseline = computeBaseline(
    model.visits,
    { baselineStartMs: model.window.baselineStartMs, baselineEndMs: model.window.baselineEndMs },
    model.household.utcOffsetMin,
  );
}

/** 14 days, every event ingested, no anomalies: the truth engine reports ZERO issues (regression seed). */
export function cleanSeed(): WeekModel {
  const model = baseModel();
  model.consent = [
    { scope: "family_message", granted: false },
    { scope: "chime_announcement", granted: false },
    { scope: "weekly_brief", granted: false },
  ] as ConsentScope[];
  model.clockMs = REVIEW_END_MS;
  ingestClean(model, "clean", 13);
  return model;
}

/** Baseline week ingested; review window EMPTY (events arrive through the Ring port). clock = DEMO_NOW_MS.
 *  consent: family_message granted, weekly_brief granted, chime_announcement NOT granted. synthetic = true. */
export function demoSeed(): WeekModel {
  const model = baseModel();
  model.consent = [
    { scope: "family_message", granted: true, grantedAtMs: BUNDLE_START_MS, grantedBy: "human" },
    { scope: "chime_announcement", granted: false },
    { scope: "weekly_brief", granted: true, grantedAtMs: BUNDLE_START_MS, grantedBy: "human" },
  ] as ConsentScope[];
  model.clockMs = DEMO_NOW_MS;
  ingestClean(model, "demo", 6);
  return model;
}
