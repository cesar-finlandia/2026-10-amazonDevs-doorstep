// Requirement IDs: FR-02, FR-04
// WU-DOMAIN-ENGINE-02: the time maths is timezone-independent.
import { DAY_MS, fmtClock, fmtDay, fmtDuration, inWindow, localMinutes, localWeekday } from "src/domain/time.js";

const BUNDLE_START_MS = Date.UTC(2026, 9, 5, 7, 0, 0);
const OFF = -420;

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

assert(localWeekday(BUNDLE_START_MS, OFF) === 0, "bundle starts on a Monday");
assert(localMinutes(BUNDLE_START_MS + 470 * 60000, OFF) === 470, "localMinutes 470 after midnight");
assert(fmtClock(BUNDLE_START_MS + 470 * 60000, OFF) === "07:50", "fmtClock 07:50");
assert(fmtDay(BUNDLE_START_MS + DAY_MS, OFF) === "Tue 6 Oct", "fmtDay Tue 6 Oct");
assert(fmtDuration(45_000) === "45 s", "fmtDuration seconds");
assert(fmtDuration(22 * 60_000) === "22 min", "fmtDuration minutes");
assert(fmtDuration(65 * 60_000) === "1 h 5 min", "fmtDuration hours");
assert(inWindow(23 * 60, 1350, 390) && inWindow(2 * 60, 1350, 390), "inWindow true at 23:00 and 02:00");
assert(!inWindow(12 * 60, 1350, 390), "inWindow false at 12:00");
assert(
  fmtDay(BUNDLE_START_MS + 14 * DAY_MS - 60000, OFF) === "Sun 18 Oct" &&
    fmtClock(BUNDLE_START_MS + 14 * DAY_MS - 60000, OFF) === "23:59",
  "DEMO_NOW_MS === REVIEW_END_MS - 60000 is Sun 18 Oct 23:59 local",
);

console.log("de-02-time: 10 checks OK");
