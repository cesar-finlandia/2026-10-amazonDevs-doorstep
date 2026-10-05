// Requirement IDs: FR-04
// WU-DOMAIN-ENGINE-08: the verify→repair story and its numbers are produced by rules, not by hand.
import { createTruthEngine } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { createWeekStore } from "src/domain/store.js";
import { deriveVisits } from "src/domain/derive.js";
import { HISTORY_OVERLAP_MS, lastWebhookMs, pollHistory } from "src/domain/gaps.js";
import { BUNDLE_START_MS } from "src/domain/generator.js";
import { parseRingPayload } from "src/domain/parse.js";
import { EFFECTIVE_QUIET_HOURS, RULE_IDS, candidateIncidents, truthRules } from "src/domain/rules.js";
import { cleanSeed, demoSeed } from "src/domain/seed.js";
import { DAY_MS, localMinutes } from "src/domain/time.js";
import type { DoorEvent } from "src/domain/types.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const OFF = -420;
const engine = createTruthEngine(truthRules);

{
  const issues = engine.check(cleanSeed());
  assert(issues.length === 0, "cleanSeed reports zero issues");
}
{
  const issues = engine.check(demoSeed());
  assert(issues.length === 0, "demoSeed reports zero issues");
}

const store = createWeekStore(demoSeed());
const port = createBundleRingPort();
const inbox = await port.drainWebhookInbox();
store.dispatch("ingest_events", { events: parseRingPayload(inbox) }, "system");
const sinceMs = (lastWebhookMs(store.getState(), "dev-door") as number) - HISTORY_OVERLAP_MS;
store.dispatch("ingest_events", { events: await pollHistory(port, "dev-door", sinceMs) }, "system");
// The elite camera went dark after the silence point, so its outage pair is history-only.
// Catch it up from just past its last webhook: no overlap, so already-seen webhook
// moments are not re-fetched as history twins (that would forge extra duplicate clusters).
const lastElite = lastWebhookMs(store.getState(), "dev-elite") as number;
store.dispatch("ingest_events", { events: await pollHistory(port, "dev-elite", lastElite + 1) }, "system");

const perceived = engine.check(store.getState());
assert(engine.counts(perceived).errors === 4, `perceive+reconcile yields 4 errors (saw ${engine.counts(perceived).errors})`);
{
  const prefixes = perceived.filter((i) => i.severity === "error").map((i) => i.id.split(":")[0]).sort();
  assert(
    JSON.stringify(prefixes) === JSON.stringify(["duplicate-burst", "incident-coverage", "outage", "quiet-hours"]),
    "the four errors are dup, quiet, outage and missed routine",
  );
}
const candidates = candidateIncidents(store.getState());
assert(
  candidates.length === 3 &&
    JSON.stringify(candidates.map((c) => c.kind).sort()) ===
      JSON.stringify(["device_outage", "missed_routine", "quiet_hours_activity"]),
  "candidates are quiet, outage and missed routine (dup is not a candidate)",
);
for (const issue of perceived) {
  if (issue.severity === "error" && issue.fix?.action === "open_incident") {
    const r = store.dispatch("open_incident", issue.fix.args, "agent");
    if (!r.ok) {
      console.error(`FAIL: opening incident: ${r.error}`);
      process.exit(1);
    }
  }
}
{
  const counts = engine.counts(engine.check(store.getState()));
  assert(counts.errors === 1 && counts.warnings === 3, "after 3 opens: 1 error, 3 warnings");
}
{
  const dup = engine.check(store.getState()).find((i) => i.id.startsWith("duplicate-burst"));
  const r = store.dispatch("merge_duplicate_events", (dup?.fix?.args ?? {}) as { eventIds: string[] }, "agent");
  const counts = engine.counts(engine.check(store.getState()));
  assert(r.ok && counts.errors === 0 && counts.warnings === 3, "after repair: 0 errors, 3 warnings");
}
for (const inc of store.getState().incidents) {
  store.dispatch("set_incident_status", { incidentId: inc.id, status: "resolved" }, "human");
}
assert(engine.check(store.getState()).length === 0, "after human resolution: 0 issues");

function minimal(): ReturnType<typeof cleanSeed> {
  return cleanSeed();
}
{
  const m = minimal();
  const startMs = BUNDLE_START_MS + 8 * DAY_MS + 134 * 60_000;
  m.visits.push({
    id: "vis:t", startMs, endMs: startMs + 300_000, dwellSec: 300, eventIds: ["evt:t"],
    hops: ["dev-door:0"], kind: "arrival", label: "t",
  });
  assert(engine.check(m).some((i) => i.id.startsWith("quiet-hours")), "quiet-hours fires");
}
{
  const m = minimal();
  const startMs = BUNDLE_START_MS + 9 * DAY_MS + 600 * 60_000;
  m.visits.push({
    id: "vis:t", startMs, endMs: startMs + 1_200_000, dwellSec: 1200, eventIds: ["evt:t"],
    hops: ["dev-door:0"], kind: "linger", label: "t",
  });
  assert(engine.check(m).some((i) => i.id.startsWith("dwell")), "dwell fires");
}
{
  const m = minimal();
  const at = BUNDLE_START_MS + 9 * DAY_MS + 600 * 60_000;
  const mk = (id: string, type: "device_offline" | "device_online", tsMs: number): DoorEvent => ({
    id, deviceId: "dev-door", componentId: 0, type, tsMs, requestId: id, source: "history",
  });
  m.events.push(mk("hist:off", "device_offline", at), mk("hist:on", "device_online", at + 40 * 60_000));
  assert(engine.check(m).some((i) => i.id.startsWith("outage")), "outage fires");
}
{
  const m = minimal();
  m.nudges.push({ id: "nud-1", scope: "family_message", text: "Hi.", status: "proposed", createdMs: 1 });
  assert(engine.check(m).some((i) => i.id.startsWith("consent")), "consent fires");
}
{
  const m = minimal();
  const at = BUNDLE_START_MS + 9 * DAY_MS + 600 * 60_000;
  m.events.push(
    { id: "evt:dup-1", deviceId: "dev-door", componentId: 0, type: "motion_detected", subType: "human", tsMs: at, requestId: "req-dup", source: "webhook" },
    { id: "hist:dup-1", deviceId: "dev-door", componentId: 0, type: "motion_detected", subType: "human", tsMs: at, requestId: "hist:dup", source: "history" },
  );
  assert(engine.check(m).some((i) => i.id.startsWith("duplicate-burst")), "duplicate-burst fires");
}
{
  const m = minimal();
  m.ledger.push({ seq: 5, action: "x", entityIds: [], summary: "x", tsMs: 1 });
  assert(engine.check(m).some((i) => i.id.startsWith("ledger-integrity")), "ledger-integrity fires");
}
{
  const m = minimal();
  m.events = m.events.filter((e) => {
    const day = Math.floor((e.tsMs - BUNDLE_START_MS) / DAY_MS);
    return !(day === 11 && e.deviceId === "dev-door" && e.type === "motion_detected" &&
      localMinutes(e.tsMs, OFF) >= 465 && localMinutes(e.tsMs, OFF) < 500);
  });
  m.visits = deriveVisits(m.events, m.routines, OFF, {});
  assert(engine.check(m).some((i) => i.id.startsWith("incident-coverage")), "incident-coverage fires");
}
assert(
  JSON.stringify(EFFECTIVE_QUIET_HOURS({ startMin: 1320, endMin: 420, toleranceMin: 30 })) ===
    JSON.stringify({ startMin: 1350, endMin: 390 }),
  "effective quiet hours 22:30–06:30",
);
assert(
  RULE_IDS.join(",") === "quiet-hours,dwell,outage,consent,duplicate-burst,ledger-integrity,incident-coverage",
  "seven rules in order",
);
assert(
  perceived.find((i) => i.id.startsWith("quiet-hours"))?.fix?.action === "open_incident",
  "quiet-hours issue carries an open_incident fix",
);
{
  const dup = perceived.find((i) => i.id.startsWith("duplicate-burst"));
  assert(
    dup?.fix?.action === "merge_duplicate_events" && (dup?.fix?.args["eventIds"] as string[]).length === 6,
    "duplicate-burst fix merges the six clustered ids",
  );
}
{
  const m = minimal();
  m.nudges.push({ id: "nud-1", scope: "family_message", text: "Hi.", status: "proposed", createdMs: 1 });
  m.ledger.push({ seq: 5, action: "x", entityIds: [], summary: "x", tsMs: 1 });
  const flagged = engine.check(m);
  assert(
    flagged.find((i) => i.id.startsWith("consent"))?.fix === undefined &&
      flagged.find((i) => i.id.startsWith("ledger-integrity"))?.fix === undefined,
    "consent and ledger-integrity carry no fix",
  );
}
assert(
  candidates.every((c, i) => i === 0 || (candidates[i - 1]?.startMs as number) <= c.startMs),
  "candidates are ordered by startMs",
);

console.log("de-08-rules: 21 checks OK");
