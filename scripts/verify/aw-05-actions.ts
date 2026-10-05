// Requirement IDs: FR-05, FR-07, FR-12, FR-15
// WU-AGENT-WORKFLOW-05: the 20 actions and their preflights (offline).
import { lintDescriptor } from "src/kits/agent-workflow/src/registry/lint.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { dayIndexOf, findDuplicateClusters } from "src/domain/derive.js";
import { lastWebhookMs } from "src/domain/gaps.js";
import { demoSeed } from "src/domain/seed.js";
import { ACTION_NAMES, registerDoorstepActions } from "src/agent/actions.js";
import { actionFields, createAppSession } from "src/agent/app-session.js";
import { bannedHits } from "src/llm/guard.js";
import { ACTOR_PROMPT } from "src/prompts/actor.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const fresh = () => createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
const s1 = fresh();
assert(s1.registry.list().length === 21, "registry lists 21 entries");
const names = s1.registry.list().map((d) => d.name).filter((n) => n !== "get_capabilities");
assert(
  ACTION_NAMES.length === 20 && names.length === 20 && ACTION_NAMES.every((n) => names.includes(n)),
  "names minus get_capabilities equal ACTION_NAMES",
);
for (const d of s1.registry.list()) {
  const problems = lintDescriptor(d);
  assert(problems.length === 0, `lint clean for ${d.name}: ${problems.join(";")}`);
}
const groups: Record<string, number> = {};
for (const d of s1.registry.list()) {
  if (d.name === "get_capabilities") continue;
  groups[d.group] = (groups[d.group] ?? 0) + 1;
}
assert(
  groups["read"] === 6 && groups["change"] === 5 && groups["verify"] === 2 &&
    groups["navigate"] === 3 && groups["collaborate"] === 2 && groups["cross_boundary"] === 2,
  "group counts are 6/5/2/3/2/2",
);
const destructive = s1.registry.list().filter((d) => d.annotations.destructive).map((d) => d.name).sort();
assert(JSON.stringify(destructive) === JSON.stringify(["export_weekly_brief", "play_chime_announcement"]), "exactly two destructive actions");
const tokens = new Set(ACTOR_PROMPT.match(/\b(list|get|ingest|merge|reconcile|open|set|check|compare|focus|add|propose|play|export)_[a-z_]+\b/g) ?? []);
for (const t of tokens) {
  assert((ACTION_NAMES as readonly string[]).includes(t) || t === "get_capabilities", `prompt token ${t} is registered`);
}
const caps = await s1.call("get_capabilities", {}, { source: "agent" });
const capData = caps.data as { procedures: unknown[]; contract_hash: string };
assert(
  caps.ok && capData.procedures.length === 3 && /^[0-9a-f]{64}$/.test(capData.contract_hash),
  "get_capabilities returns 3 procedures and a 64-hex hash",
);
assert(s1.registry.list().every((d) => !d.name.includes("consent")), "no action name contains consent");

const badDevice = await s1.call("list_week_events", { deviceId: "nope" }, { source: "agent" });
assert(!badDevice.ok && (badDevice.error?.next ?? "").includes("list_devices"), "unknown device points at list_devices");
const noDevice = await s1.call("ingest_ring_events", { source: "history" }, { source: "agent" });
assert(!noDevice.ok && (noDevice.error?.message ?? "").includes("Pass deviceId"), "history without device refuses");

const s2 = fresh();
const inboxSize = (await createBundleRingPort().drainWebhookInbox()).length;
const ingested = await s2.call("ingest_ring_events", { source: "webhook_inbox" }, { source: "agent" });
assert(ingested.ok && s2.store.getState().webhookLedger.length === inboxSize, "inbox ingest fills the webhook ledger");
const since = (lastWebhookMs(s2.store.getState(), "dev-door") as number) - 600000;
const histIngest = await s2.call("ingest_ring_events", { source: "history", deviceId: "dev-door", sinceMs: since }, { source: "agent" });
assert(histIngest.ok && findDuplicateClusters(s2.store.getState().events).length >= 1, "history overlap leaves a duplicate cluster");
const cluster = findDuplicateClusters(s2.store.getState().events)[0] as { id: string }[];
const merged = await s2.call("merge_duplicate_events", { eventIds: cluster.map((e) => e.id) }, { source: "agent" });
assert(merged.ok && findDuplicateClusters(s2.store.getState().events).length === 0, "merge folds the cluster");
const mergedAgain = await s2.call("merge_duplicate_events", { eventIds: cluster.map((e) => e.id) }, { source: "agent" });
assert(!mergedAgain.ok, "repeating a merge refuses");
const beforeRec = findDuplicateClusters(s2.store.getState().events).length;
const reconciled = await s2.call("reconcile_webhook_gap", { deviceId: "Hall camera", overlapMinutes: 0 }, { source: "agent" });
assert(
  reconciled.ok && findDuplicateClusters(s2.store.getState().events).length === beforeRec &&
    !(reconciled.summary.includes("0 events") && reconciled.summary.includes("Recovered")),
  "reconcile by name adds events without new clusters",
);
const reconciledAgain = await s2.call("reconcile_webhook_gap", { deviceId: "dev-elite", overlapMinutes: 0 }, { source: "agent" });
assert(reconciledAgain.ok && reconciledAgain.summary.includes("already known"), "repeating a reconcile reports already known");

const s3 = fresh();
await s3.call("ingest_ring_events", { source: "webhook_inbox" }, { source: "agent" });
const lastDoor = lastWebhookMs(s3.store.getState(), "dev-door") as number;
await s3.call("ingest_ring_events", { source: "history", deviceId: "dev-door", sinceMs: lastDoor - 600000 }, { source: "agent" });
await s3.call("reconcile_webhook_gap", { deviceId: "dev-elite", overlapMinutes: 0 }, { source: "agent" });
type Finding = { kind: string; title: string; eventIds: string[]; startMs: number; endMs: number; routineId?: string; dayIndex: number };
const findingsOf = async (day: number): Promise<Finding[]> => {
  const r = await s3.call("compare_to_baseline", { day }, { source: "agent" });
  assert(r.ok, `compare day ${day} succeeds`);
  return (r.data as { findings: Finding[] }).findings;
};
const f8 = await findingsOf(8);
const f11 = await findingsOf(11);
const f10 = await findingsOf(10);
assert(f8.some((f) => f.kind === "quiet_hours_activity" && f.eventIds.length > 0), "day 8 has a quiet-hours finding");
assert(f11.some((f) => f.kind === "missed_routine" && f.eventIds.length === 0), "day 11 has a missed-routine finding");
assert(f10.some((f) => f.kind === "device_outage"), "day 10 has a device-outage finding");
const openArgs = (f: Finding) => ({
  kind: f.kind, title: f.title, eventIds: f.eventIds, startMs: f.startMs, endMs: f.endMs,
  ...(f.routineId !== undefined ? { routineId: f.routineId } : {}), dayIndex: f.dayIndex,
});
const firstFinding = f8.find((f) => f.kind === "quiet_hours_activity") as Finding;
const opened = await s3.call("open_incident", openArgs(firstFinding), { source: "agent" });
assert(opened.ok, "open_incident succeeds");
const got = await s3.call("get_incident", { incidentId: "inc-1" }, { source: "agent" });
const gotData = got.data as { incident: { status: string }; media: { label: string }[] };
assert(got.ok && gotData.incident.status === "open" && gotData.media.length === 1 && gotData.media[0]?.label.startsWith("Snapshot ·"), "incident opens with one snapshot");
const dup = await s3.call("open_incident", openArgs(firstFinding), { source: "agent" });
assert(!dup.ok && (dup.error?.message ?? "").includes("already exists"), "reopening refuses as already exists");
for (const f of [...f10.filter((x) => x.kind === "device_outage"), ...f11.filter((x) => x.kind === "missed_routine")]) {
  const r = await s3.call("open_incident", openArgs(f), { source: "agent" });
  assert(r.ok, `open ${f.kind} succeeds`);
}
const checked = await s3.call("check_week_model", {}, { source: "agent" });
const truth = (checked.data as { truth: { errors: number }; issues: { severity: string; fix?: { action: string } }[] });
const errs = truth.issues.filter((i) => i.severity === "error");
assert(checked.ok && truth.truth.errors === 1 && errs.length === 1 && errs[0]?.fix?.action === "merge_duplicate_events", "one error left with the merge fix");
const focused = await s3.call("focus_incident", { incidentId: "inc-1" }, { source: "agent" });
assert(
  focused.ok && s3.store.getState().ui.selectedIncidentId === "inc-1" && s3.store.getState().ui.shotId === "focus:inc-1",
  "focus_incident frames the incident",
);
const noShot = await s3.call("set_camera_shot", { shot: "focus" }, { source: "agent" });
assert(!noShot.ok, "focus shot without an incident refuses");

const s4 = fresh();
s4.store.dispatch("set_consent", { scope: "family_message", granted: false, actor: "human" }, "human");
const nudgeOff = await s4.call("propose_family_nudge", { text: "Maybe a quick call this evening?" }, { source: "agent" });
assert(!nudgeOff.ok && (nudgeOff.error?.message ?? "").includes("Consent panel"), "nudge without consent points at the Consent panel");
s4.store.dispatch("set_consent", { scope: "family_message", granted: true, actor: "human" }, "human");
const nudgeOn = await s4.call("propose_family_nudge", { incidentId: undefined, text: "Maybe a quick call this evening?" }, { source: "agent" });
assert(
  nudgeOn.ok && s4.store.getState().nudges.filter((n) => n.status === "proposed").length === 1,
  "nudge with consent proposes one nudge",
);
const chimeOff = await s4.call("play_chime_announcement", { deviceId: "dev-door", audioRef: "gentle_hello" }, { source: "agent" });
assert(
  !chimeOff.ok && (chimeOff.error?.message ?? "").includes("Chime announcements are off") && s4.gate.pending().length === 0,
  "chime without consent refuses before the gate",
);
s4.store.dispatch("set_consent", { scope: "chime_announcement", granted: true, actor: "human" }, "human");
const held = s4.call("play_chime_announcement", { deviceId: "dev-door", audioRef: "gentle_hello" }, { source: "agent" });
assert(s4.gate.pending().length === 1, "the agent chime waits at the gate");
s4.gate.decide(s4.gate.pending()[0]?.id as string, "approved");
const played = await held;
assert(
  played.ok && s4.store.getState().nudges.some((n) => n.scope === "chime_announcement" && n.status === "sent"),
  "an approved chime plays and records sent",
);
const heldSecond = s4.call("play_chime_announcement", { deviceId: "dev-door", audioRef: "gentle_hello" }, { source: "agent" });
s4.gate.decide(s4.gate.pending()[0]?.id as string, "rejected");
const declined = await heldSecond;
assert(
  !declined.ok && declined.summary === 'The human declined "play a gentle chime on the Front door". Ask what to do instead.',
  "a rejected chime returns the kit sentence",
);
const heldBrief = s4.call("export_weekly_brief", { includeNotes: true }, { source: "agent" });
s4.gate.decide(s4.gate.pending()[0]?.id as string, "approved");
const briefed = await heldBrief;
const brief = (briefed.data as { brief: { title: string; body: string } }).brief;
assert(briefed.ok && brief.title.startsWith("Week of") && bannedHits(brief.body).length === 0, "the brief shares clean copy");
const fields = actionFields(s4, "open_incident");
for (const req of ["kind", "title", "eventIds", "startMs", "endMs"]) {
  assert(fields.some((f) => f.name === req && f.required), `open_incident marks ${req} required`);
}
const audio = actionFields(s4, "play_chime_announcement").find((f) => f.name === "audioRef");
assert(audio !== undefined && (audio.enum ?? []).length === 2, "audioRef lists 2 enum values");

void registerDoorstepActions;
void dayIndexOf;
console.log("aw-05-actions: 26 checks OK");
