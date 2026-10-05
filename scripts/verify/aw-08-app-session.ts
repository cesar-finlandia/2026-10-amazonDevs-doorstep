// Requirement IDs: FR-02, FR-05, FR-08, FR-09
// WU-AGENT-WORKFLOW-08: app session and manual runner (offline).
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { demoSeed } from "src/domain/seed.js";
import { ACTION_NAMES } from "src/agent/actions.js";
import { actionFields, createAppSession } from "src/agent/app-session.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const s1 = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
const caps = await s1.call("get_capabilities", {}, { source: "human" });
const procedures = (caps.data as { procedures: { name: string }[] }).procedures.map((p) => p.name);
assert(
  s1.registry.list().length === 21 &&
    JSON.stringify(procedures) === JSON.stringify(["review_week", "repair_errors", "prepare_family_update"]),
  "session lists 21 entries with the 3 procedures",
);

const s2 = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
await s1.call("focus_day", { day: 8 }, { source: "human" });
assert(s1.store.getState().ui.selectedDay === 8 && s2.store.getState().ui.selectedDay === null, "sessions are isolated");

for (const name of ACTION_NAMES) {
  const fields = actionFields(s1, name);
  assert(Array.isArray(fields) && fields.length >= 0, `actionFields lists ${name}`);
}

const firstEvent = s1.store.getState().events[0] as { id: string; tsMs: number };
await s1.call("open_incident", {
  kind: "long_dwell", title: "Manual check note", eventIds: [firstEvent.id],
  startMs: firstEvent.tsMs, endMs: firstEvent.tsMs,
}, { source: "human" });
const table: [string, Record<string, unknown>][] = [
  ["list_week_events", {}],
  ["get_incident", { incidentId: "inc-1" }],
  ["get_rhythm_baseline", {}],
  ["list_devices", {}],
  ["get_device_status", { deviceId: "dev-door" }],
  ["get_device_capabilities", { deviceId: "dev-elite" }],
  ["check_week_model", {}],
  ["compare_to_baseline", { day: 8 }],
  ["focus_day", {}],
  ["set_camera_shot", { shot: "overview" }],
];
for (const [name, args] of table) {
  const r = await s1.call(name, args, { source: "human" });
  assert(r.ok, `human ${name} succeeds`);
}

s1.store.dispatch("set_consent", { scope: "chime_announcement", granted: true, actor: "human" }, "human");
const humanChime = await s1.call("play_chime_announcement", { deviceId: "dev-door", audioRef: "gentle_hello" }, { source: "human" });
assert(humanChime.ok && s1.gate.pending().length === 0, "a human chime needs no approval");
const humanEntries = s1.trace.entries();
assert(humanEntries.length > 0 && humanEntries.every((e) => e.source === "human"), "human calls trace as human");
const held = s1.call("play_chime_announcement", { deviceId: "dev-door", audioRef: "gentle_hello" }, { source: "agent" });
assert(s1.gate.pending().length === 1, "an agent chime waits at the gate");
s1.gate.decide(s1.gate.pending()[0]?.id as string, "approved");
await held;

s1.reset();
assert(s1.store.revision() === 0 && s1.trace.entries().length === 0, "reset restores revision 0 and clears the trace");

console.log("aw-08-app-session: 8 checks OK");
