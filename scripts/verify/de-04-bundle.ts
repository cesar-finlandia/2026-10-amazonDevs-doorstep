// Requirement IDs: FR-01
// WU-DOMAIN-ENGINE-04: the seeded two-week bundle is deterministic and carries the demo story.
import { DAY_MS, localMinutes } from "src/domain/time.js";
import {
  BUNDLE_START_MS,
  SEED,
  WEBHOOK_SILENCE_MS,
  generateEvents,
  splitChannels,
} from "src/domain/generator.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const dayIndex = (tsMs: number): number => Math.floor((tsMs - BUNDLE_START_MS) / DAY_MS);

const demo1 = generateEvents("demo");
const demo2 = generateEvents("demo");
assert(JSON.stringify(demo1) === JSON.stringify(demo2), "demo variant is deterministic");
const clean1 = generateEvents("clean");
const clean2 = generateEvents("clean");
assert(JSON.stringify(clean1) === JSON.stringify(clean2), "clean variant is deterministic");

{
  const seen = new Map<string, string>();
  const dup = clean1.some((e) => {
    const first = seen.get(e.requestId);
    if (first !== undefined && first !== e.id) return true;
    seen.set(e.requestId, e.id);
    return false;
  });
  assert(!dup, "clean variant has no events with equal requestId and different id");
}

const tueLinger = demo1.filter((e) => dayIndex(e.tsMs) === 8 && e.deviceId === "dev-door" && e.type === "motion_detected");
assert(
  tueLinger.some((e) => localMinutes(e.tsMs, -420) === 134) && tueLinger.length >= 3,
  "demo Tue linger anomaly present",
);
const thuElite = demo1.filter((e) => dayIndex(e.tsMs) === 10 && e.deviceId === "dev-elite");
assert(
  thuElite.some((e) => e.type === "device_offline") && thuElite.some((e) => e.type === "device_online"),
  "demo Thu offline pair present",
);
const friPaper = demo1.filter(
  (e) => dayIndex(e.tsMs) === 11 && e.deviceId === "dev-door" && e.type === "motion_detected" &&
    localMinutes(e.tsMs, -420) >= 465 && localMinutes(e.tsMs, -420) < 500,
);
assert(friPaper.length === 0, "demo Fri has no paper event");
const cleanFriPaper = clean1.filter(
  (e) => dayIndex(e.tsMs) === 11 && e.deviceId === "dev-door" && e.type === "motion_detected" &&
    localMinutes(e.tsMs, -420) >= 465 && localMinutes(e.tsMs, -420) < 500,
);
assert(cleanFriPaper.length === 1, "clean Fri keeps its paper event");

const { inbox, history } = splitChannels(demo1);
assert(inbox.every((p) => Date.parse(p.timestamp) <= WEBHOOK_SILENCE_MS), "webhook inbox stops at WEBHOOK_SILENCE_MS");
assert(Math.max(...inbox.map((p) => Date.parse(p.timestamp))) === WEBHOOK_SILENCE_MS, "inbox reaches WEBHOOK_SILENCE_MS");
const historyCount = Object.values(history).reduce((acc, pages) => acc + pages.reduce((a, p) => a + p.items.length, 0), 0);
assert(historyCount > inbox.length, "history has more events than the inbox");
assert(
  Object.values(history).every((pages) =>
    pages.every((p, i) => p.limit === 50 && p.offset === i * 50 &&
      p.items.every((it, j) => j === 0 || Date.parse(p.items[j - 1]?.timestamp as string) >= Date.parse(it.timestamp)))
  ),
  "history pages are limit-50 and newest-first",
);

{
  // Incidental baseline door events: baseline dev-door human motions outside every
  // routine window and the porch band — exactly 13 (Mon 2, Tue 3, Wed 2, Thu 2, Fri 2, Sat 2).
  const inWin = (m: number, a: number, b: number): boolean => m >= a && m < b;
  const incidental = clean1.filter((e) => {
    const day = dayIndex(e.tsMs);
    if (day < 0 || day > 6) return false;
    if (e.deviceId !== "dev-door" || e.type !== "motion_detected" || e.subType !== "human") return false;
    const m = localMinutes(e.tsMs, -420);
    const weekday = day % 7;
    if (inWin(m, 465, 500) || inWin(m, 905, 970)) return false; // paper, walk: daily
    if (weekday === 2 && inWin(m, 535, 575)) return false; // nurse: Wednesdays
    if (weekday === 6 && inWin(m, 720, 770)) return false; // lunch: Sundays
    if (inWin(m, 1172, 1185)) return false;
    return true;
  });
  assert(incidental.length === 13, `exactly 13 incidental baseline door events (saw ${incidental.length})`);
}

void SEED;

console.log("de-04-bundle: 12 checks OK");
