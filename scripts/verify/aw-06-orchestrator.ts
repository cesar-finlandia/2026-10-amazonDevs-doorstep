// Requirement IDs: FR-06, FR-12, FR-21
// WU-AGENT-WORKFLOW-06: the week-review orchestrator (offline, scripted transport).
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { lastWebhookMs, HISTORY_OVERLAP_MS } from "src/domain/gaps.js";
import { parseRingPayload } from "src/domain/parse.js";
import { demoSeed } from "src/domain/seed.js";
import { createAppSession } from "src/agent/app-session.js";
import { fetchRawHistorySince, runWeekReview } from "src/agent/orchestrator.js";
import type { Phase } from "src/agent/orchestrator.js";
import { buildNarratorFacts } from "src/agent/brief.js";
import { bannedHits } from "src/llm/guard.js";
import { createManualTransport } from "src/agent/transport.js";
import { createScriptedTransport } from "scripts/verify/scripted-transport.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const run = (
  switches?: Parameters<typeof createScriptedTransport>[1],
  autoDecide: "approve" | "reject-first-then-approve" = "approve",
) => {
  const session = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
  const transport = createScriptedTransport(session, switches);
  const phases: Phase[] = [];
  const details: Record<string, string> = {};
  return runWeekReview({
    session,
    transport,
    autoDecide,
    decisionDelayMs: 5,
    onPhase: (p, info) => {
      phases.push(p);
      details[p] = info.detail;
    },
  }).then((summary) => ({ summary, session, phases, details }));
};

const main = await run();
assert(main.summary.ok === true, "scripted run succeeds");
assert(
  JSON.stringify(main.phases) === JSON.stringify(["load", "perceive", "plan", "act", "verify", "repair", "explain", "checkpoint", "finish"]),
  `phases run in order: ${main.phases.join(",")}`,
);
assert(main.summary.counts.errorsAfterPerceive === 3, `perceive leaves 3 errors (got ${main.summary.counts.errorsAfterPerceive})`);
assert(main.summary.counts.errorsAfterAct === 1, `act leaves 1 error (got ${main.summary.counts.errorsAfterAct})`);
assert(
  main.summary.counts.errorsAfterRepair === 0 && main.summary.counts.warningsAfterRepair === 3,
  "repair reaches 0 errors and 3 warnings",
);
assert(main.summary.counts.incidentsOpened === 3, `3 incidents opened (got ${main.summary.counts.incidentsOpened})`);
{
  const byName: Record<string, number> = {};
  for (const e of main.summary.trace.entries) {
    if (e.kind === "model") byName[e.name] = (byName[e.name] ?? 0) + 1;
  }
  assert((byName["extractor"] ?? 0) >= 2 && (byName["planner"] ?? 0) === 1 && (byName["narrator"] ?? 0) === 3, "extractor x2+, planner x1, narrator x3");
}
assert(
  JSON.stringify(main.summary.counts.roles) === JSON.stringify(["actor", "extractor", "narrator", "planner"]),
  "four model roles in trace",
);
assert(main.summary.counts.modelCalls >= 15, `at least 15 model calls (got ${main.summary.counts.modelCalls})`);
assert(main.summary.floors.ok === true && main.summary.floors.problems.length === 0, "floors pass");
{
  const incidents = main.session.store.getState().incidents;
  assert(
    incidents.length === 3 && incidents.every((i) => i.status === "explained" && (i.summary ?? "") !== ""),
    "every incident is explained with a summary",
  );
}
{
  const approved = main.summary.trace.entries.filter((e) => e.kind === "approval" && e.decision === "approved");
  const failedChime = main.summary.trace.entries.filter(
    (e) => e.kind === "action" && e.name === "play_chime_announcement" && e.ok === false,
  );
  assert(approved.length === 1, `one approved approval (got ${approved.length})`);
  assert(
    failedChime.length >= 1 && (failedChime[0]?.output_ref ?? "").includes("Chime announcements are off"),
    "the refused chime is traced with its message",
  );
}
const rejected = await run(undefined, "reject-first-then-approve");
{
  const rej = rejected.summary.trace.entries.filter((e) => e.kind === "approval" && e.decision === "rejected");
  const acted = rejected.summary.trace.entries.filter(
    (e) => e.kind === "action" && e.ok === false && (e.output_ref ?? "").includes("The human declined"),
  );
  assert(rej.length === 1 && acted.length >= 1, "one rejection is traced on approval and action");
}
const wrongTs = await run({ wrongExtractorTs: true });
{
  const ring = createBundleRingPort();
  const firstPayload = (await ring.drainWebhookInbox())[0] as unknown;
  const ground = parseRingPayload([firstPayload])[0] as { id: string; tsMs: number };
  const kept = wrongTs.session.store.getState().events.find((e) => e.id === ground.id);
  assert(kept !== undefined && kept.tsMs === ground.tsMs, "a wrong extractor tsMs is corrected by the parser");
}
const noPlan = await run({ degradedPlanner: true });
assert(
  (noPlan.details["plan"] ?? "").includes("used the default plan") &&
    noPlan.summary.degraded.length === 1 && noPlan.summary.ok === true,
  "a degraded planner falls back to the default plan",
);
for (const [label, sw] of [["dirty", { dirtyNarrator: true }], ["ungrounded", { ungroundedNarrator: true }]] as const) {
  const r = await run(sw);
  const model = r.session.store.getState();
  for (const inc of model.incidents) {
    const expected = buildNarratorFacts(inc, model).template;
    assert(inc.summary === expected && bannedHits(inc.summary ?? "").length === 0, `${label} narration ends with the template`);
  }
}
const failedStep = await run({ failingStep: true });
assert(failedStep.summary.ok === false && failedStep.summary.stoppedAt === "act", "a failing step stops at act");
{
  const session = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
  const manual = await runWeekReview({ session, transport: createManualTransport() });
  assert(manual.ok === false && manual.stoppedAt === "load" && session.trace.entries().length === 0, "manual transport stops at load");
}
{
  const ring = createBundleRingPort();
  let calls = 0;
  const counting = { ...ring, getEventHistory: (...a: Parameters<typeof ring.getEventHistory>) => { calls += 1; return ring.getEventHistory(...a); } };
  const inbox = await counting.drainWebhookInbox();
  const parsed = parseRingPayload(inbox);
  const last = Math.max(...parsed.filter((e) => e.deviceId === "dev-door").map((e) => e.tsMs));
  void lastWebhookMs;
  void HISTORY_OVERLAP_MS;
  const items = await fetchRawHistorySince(counting, "dev-door", last - 600000);
  const tsList = items.map((i) => Date.parse((i.record as { timestamp: string }).timestamp));
  assert(
    items.length > 0 && tsList.every((t) => t >= last - 600000) && tsList.every((t, i) => i === 0 || (tsList[i - 1] as number) <= t) && calls <= 3,
    "history fetch is ascending, filtered and paged",
  );
}

console.log("aw-06-orchestrator: 20 checks OK");
