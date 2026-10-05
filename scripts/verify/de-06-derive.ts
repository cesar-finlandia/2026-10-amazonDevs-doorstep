// Requirement IDs: FR-03, FR-12, FR-17
// WU-DOMAIN-ENGINE-06: the derived week and the webhook gap are computed, not asserted.
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import {
  computeBaseline,
  deriveVisits,
  deviceOutages,
  findDuplicateClusters,
  visitorThreads,
} from "src/domain/derive.js";
import { HISTORY_OVERLAP_MS, findWebhookGaps, pollHistory } from "src/domain/gaps.js";
import {
  BUNDLE_START_MS,
  ROUTINES,
  WEBHOOK_SILENCE_MS,
  generateEvents,
} from "src/domain/generator.js";
import { parseRingPayload } from "src/domain/parse.js";
import { DAY_MS } from "src/domain/time.js";
import type { WeekModel } from "src/domain/types.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const OFF = -420;
const BASE_START = BUNDLE_START_MS;
const BASE_END = BUNDLE_START_MS + 7 * DAY_MS;
const DEMO_NOW = BUNDLE_START_MS + 14 * DAY_MS - 60_000;

const clean = generateEvents("clean");
const visits = deriveVisits(clean, ROUTINES, OFF, {});
assert(visits.length > 0 && visits.every((v) => v.eventIds.length > 0 && v.dwellSec >= 30), "visits are well-formed");
const baselineNonRoutine = visits.filter(
  (v) => v.routineId === undefined && v.startMs >= BASE_START && v.startMs < BASE_END,
);
assert(baselineNonRoutine.length === 13, `13 non-routine baseline visits (saw ${baselineNonRoutine.length})`);
const baseline = computeBaseline(visits, { baselineStartMs: BASE_START, baselineEndMs: BASE_END }, OFF);
assert(baseline.dwellP90Sec === 420, `expectedP90Sec === 420 (saw ${baseline.dwellP90Sec})`);
assert(baseline.sampleVisits === 13 && baseline.dwellMedianSec === 30, "baseline sample 13, median 30");
assert(baselineNonRoutine.some((v) => v.dwellSec === 420), "Tue triple forms one 420 s visit");
const threads = visitorThreads({ visits } as WeekModel);
assert(threads.length > 0 && threads.every((t) => t.hops.length >= 2), "visitor threads span components");
assert(findDuplicateClusters(clean).length === 0, "clean single-channel events form no cluster");

const port = createBundleRingPort();
const inbox = await port.drainWebhookInbox();
const webhookEvents = parseRingPayload(inbox);
const lastDoor = Math.max(...webhookEvents.filter((e) => e.deviceId === "dev-door").map((e) => e.tsMs));
const polled = await pollHistory(port, "dev-door", lastDoor - HISTORY_OVERLAP_MS);
const clusters = findDuplicateClusters([...webhookEvents, ...polled]);
assert(clusters.length === 1, `one duplicate cluster after the seeded overlap (saw ${clusters.length})`);
assert(
  (clusters[0] as { source: string }[]).some((e) => e.source === "webhook") &&
    (clusters[0] as { source: string }[]).some((e) => e.source === "history"),
  "the cluster spans both channels",
);
const demoModel = { events: generateEvents("demo"), clockMs: DEMO_NOW } as unknown as WeekModel;
const outages = deviceOutages(demoModel);
assert(outages.length === 1 && outages[0]?.deviceId === "dev-elite", "one outage on dev-elite");
assert(
  Math.round(((outages[0]?.toMs as number) - (outages[0]?.fromMs as number)) / 60_000) === 47 &&
    Math.floor(((outages[0]?.fromMs as number) - BUNDLE_START_MS) / DAY_MS) === 10,
  "outage is 47 min on Thu d=10",
);
const gapModel = { events: webhookEvents, clockMs: DEMO_NOW } as unknown as WeekModel;
assert(findWebhookGaps(gapModel, "dev-elite", DEMO_NOW).length === 1, "findWebhookGaps flags dev-elite");
assert(
  polled.length > 0 && polled.every((e, i) => i === 0 || (polled[i - 1]?.tsMs as number) <= e.tsMs) &&
    polled.some((e) => e.tsMs === WEBHOOK_SILENCE_MS),
  "pollHistory overlap is ascending and yields the silence triple",
);

console.log("de-06-derive: 13 checks OK");
