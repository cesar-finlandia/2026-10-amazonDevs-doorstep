// src/agent/orchestrator.ts — Requirement IDs: FR-06, FR-12, FR-21
import type { Source } from "src/kits/agent-workflow/src/store/domainStore.js";
import type { RunTrace } from "src/kits/agent-workflow/src/trace/types.js";
import { summarizeTrace } from "src/kits/agent-workflow/src/trace/summarize.js";
import { runAgentLoop } from "src/kits/agent-workflow/src/adapters/inApp.js";
import type { DegradedResult } from "src/resilience";
import { makeDegradedResult } from "src/resilience";
import type { RingPort } from "src/domain/ring-port.js";
import { toDomainDevice } from "src/domain/derive.js";
import { HISTORY_OVERLAP_MS, lastWebhookMs } from "src/domain/gaps.js";
import { parseHistoryPage, parseRingPayload } from "src/domain/parse.js";
import { DAY_MS, fmtDay } from "src/domain/time.js";
import type { RawDoorEvent, WeekModel } from "src/domain/types.js";
import type { Session } from "src/domain/session.js";
import { ACTION_NAMES } from "src/agent/actions.js";
import { buildNarratorFacts, numbersGrounded } from "src/agent/brief.js";
import { checkFloors } from "src/agent/floors.js";
import type { FloorReport } from "src/agent/floors.js";
import type { AgentTransport } from "src/agent/transport.js";
import type { RoleName, RoleInput, RoleOutput } from "src/agent/schemas.js";
import type { RoleOutcome, TransportKind } from "src/llm/roles.js";
import { guardCopy } from "src/llm/guard.js";
import { ACT_GOAL, ACTOR_PROMPT, CHECKPOINT_GOAL, REPAIR_GOAL } from "src/prompts/actor.js";
import { ACTOR_PROCEDURES } from "src/prompts/actor.js";

export const PHASES: readonly ["load", "perceive", "plan", "act", "verify", "repair", "explain", "checkpoint", "finish"] = ["load", "perceive", "plan", "act", "verify", "repair", "explain", "checkpoint", "finish"];
export type Phase = (typeof PHASES)[number];
export interface ReviewDeps {
  session: Session; transport: AgentTransport;
  onPhase?: (phase: Phase, info: { round: number; detail: string }) => void;   // UI mirrors this to data-run-phase
  signal?: AbortSignal;
  limits?: { act: number; repair: number; checkpoint: number };               // default 16 / 8 / 8
  autoDecide?: "approve" | "reject-first-then-approve" | null;                 // scripts only; UI passes null so a person decides
  decisionDelayMs?: number;                                                     // default 40 (autoDecide only)
}
export interface ReviewSummary {
  ok: boolean; stoppedAt: Phase | null; rung: TransportKind; label: string;
  counts: { eventsIngested: number; incidentsOpened: number; errorsAfterPerceive: number; errorsAfterAct: number; errorsAfterRepair: number; warningsAfterRepair: number; modelCalls: number; roles: string[] };
  degraded: DegradedResult[]; trace: RunTrace; floors: FloorReport;
}
/** Raw (unparsed) history items since a time, newest page first, at most maxPages pages. Exported for tests. */
export async function fetchRawHistorySince(ring: RingPort, deviceId: string, sinceMs: number, maxPages = 20): Promise<{ rawId: string; record: unknown }[]> {
  const out: { rawId: string; record: unknown; tsMs: number }[] = [];
  for (let page = 0; page < maxPages; page++) {
    const res = await ring.getEventHistory(deviceId, { limit: 50, offset: page * 50 });
    if (res.items.length === 0) break;
    for (const item of res.items) {
      const ts = Date.parse(item.timestamp);
      if (Number.isFinite(ts) && ts >= sinceMs) out.push({ rawId: String(item.id), record: item, tsMs: ts });
    }
    const oldest = Math.min(...res.items.map((it) => Date.parse(it.timestamp)));
    if (!Number.isFinite(oldest) || oldest < sinceMs) break;
  }
  out.sort((a, b) => a.tsMs - b.tsMs || (a.rawId < b.rawId ? -1 : 1));
  return out.map(({ rawId, record }) => ({ rawId, record }));
}

/** The six steps of Procedure A as a fixed fallback plan text. */
export const DEFAULT_PLAN_TEXT: string =
  ACTOR_PROCEDURES.find((p) => p.name === "review_week")?.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") ?? "";

function oneLineSummary(role: RoleName, output: RoleOutput[RoleName]): string {
  if (role === "extractor") {
    const o = output as RoleOutput["extractor"];
    return `${o.events.length} events, ${o.skipped.length} skipped`;
  }
  if (role === "planner") {
    const o = output as RoleOutput["planner"];
    return `${o.steps.length} steps, focus ${(o.focusDays ?? []).join(",")}`;
  }
  const o = output as RoleOutput["narrator"];
  return o.title;
}

function sameEvent(a: RawDoorEvent, b: RawDoorEvent): boolean {
  return a.deviceId === b.deviceId && a.componentId === b.componentId && a.type === b.type &&
    (a.subType ?? null) === (b.subType ?? null) && a.tsMs === b.tsMs && a.requestId === b.requestId;
}

function recordTimestampMs(record: unknown): number {
  const r = record as Record<string, unknown>;
  const raw = r["timestamp"] ?? (r["meta"] as Record<string, unknown> | undefined)?.["time"];
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  if (typeof raw === "string") return Date.parse(raw);
  return NaN;
}

function recordDeviceId(record: unknown, fallback: string): string {
  const r = record as Record<string, unknown>;
  const v = r["device_id"] ?? r["deviceId"];
  return typeof v === "string" && v !== "" ? v : fallback;
}

export async function runWeekReview(deps: ReviewDeps): Promise<ReviewSummary> {
  const { session, transport } = deps;
  const model = session.store.getState();
  const ring = session.ring;
  const degraded: DegradedResult[] = [];
  const counter: Record<string, number> = {};
  const limits = { act: 16, repair: 8, checkpoint: 8, ...deps.limits };
  const phase = (p: Phase, round: number, detail: string): void => {
    deps.onPhase?.(p, { round, detail });
  };
  const incidentsAtStart = model.incidents.length;
  let eventsIngested = 0;
  let stoppedAt: Phase | null = null;

  const finish = (): ReviewSummary => {
    const trace = session.trace.snapshot();
    const summary = summarizeTrace(trace.entries);
    const floors = checkFloors(trace);
    return {
      ok: floors.ok && stoppedAt === null,
      stoppedAt,
      rung: transport.kind,
      label: transport.label,
      counts: {
        eventsIngested,
        incidentsOpened: session.store.getState().incidents.length - incidentsAtStart,
        errorsAfterPerceive,
        errorsAfterAct,
        errorsAfterRepair,
        warningsAfterRepair,
        modelCalls: summary.model_calls,
        roles: summary.model_roles,
      },
      degraded,
      trace,
      floors,
    };
  };

  async function callRole<R extends RoleName>(role: R, input: RoleInput[R], round: number): Promise<RoleOutcome<R>> {
    const n = (counter[role] ?? 0) + 1;
    counter[role] = n;
    const key = `${role}-${n}`;
    const outcome = await transport.role(role, input, { round, key, signal: deps.signal });
    if (!outcome.ok) {
      degraded.push(outcome.degraded);
      session.trace.record({
        round, kind: "model", name: role, source: "agent",
        input_ref: key, output_ref: outcome.degraded.reason, ok: false, latency_ms: 0, decision: outcome.kind,
      });
    } else {
      session.trace.record({
        round, kind: "model", name: role, source: "agent",
        input_ref: key, output_ref: oneLineSummary(role, outcome.output), ok: true,
        tokens: { prompt: outcome.usage.promptTokens, output: outcome.usage.outputTokens, total: outcome.usage.totalTokens },
        latency_ms: outcome.latencyMs, decision: outcome.kind,
      });
    }
    return outcome;
  }

  function dispatchTraced(name: string, args: unknown, round: number, source: Source): boolean {
    const before = session.store.snapshot();
    const r = session.store.dispatch(name, args, source);
    const after = session.store.snapshot();
    if (!r.ok) {
      session.trace.record({
        round, kind: "action", name, source, input_ref: null, output_ref: r.error, ok: false, latency_ms: 0,
      });
      return false;
    }
    session.trace.record({
      round, kind: "action", name, source, input_ref: null, output_ref: r.summary, ok: true, latency_ms: 0,
      state_change: { revision_before: before.revision, revision_after: after.revision, entity_ids: r.entityIds },
    });
    return true;
  }

  let errorsAfterPerceive = 0;
  let errorsAfterAct = 0;
  let errorsAfterRepair = 0;
  let warningsAfterRepair = 0;

  // 0. Manual guard.
  if (transport.kind === "manual") {
    const trace = session.trace.snapshot();
    const floors = checkFloors(trace);
    floors.problems.push("The AI path is off.");
    floors.ok = false;
    return {
      ok: false, stoppedAt: "load", rung: transport.kind, label: transport.label,
      counts: {
        eventsIngested: 0, incidentsOpened: 0, errorsAfterPerceive: 0, errorsAfterAct: 0,
        errorsAfterRepair: 0, warningsAfterRepair: 0, modelCalls: 0, roles: [],
      },
      degraded, trace, floors,
    };
  }

  // 1. load.
  phase("load", 0, "reading devices");
  try {
    const devices = await ring.listDevices();
    session.store.dispatch("set_devices", { devices: devices.map(toDomainDevice) }, "system");
  } catch (e) {
    degraded.push(makeDegradedResult({ reason: "ring_unreachable", fallback_source: "none", original_error: (e as Error).message }));
  }

  // 2. perceive. The single onPhase fire carries the outcome detail.
  const doorId = (() => {
    const devices = session.store.getState().devices;
    return devices.find((d) => d.kind === "doorbell")?.id ?? devices[0]?.id ?? "dev-door";
  })();
  let perceiveDetail = "";
  const ingestChunk = (
    records: { rawId: string; record: unknown }[],
    kind: "webhook_inbox" | "history_page",
    deviceId: string,
    outcome: RoleOutcome<"extractor"> | null,
  ): { corrected: number; filled: number } => {
    let events: RawDoorEvent[];
    let corrected = 0;
    let filled = 0;
    if (!outcome || !outcome.ok) {
      events = records.flatMap((r) =>
        kind === "webhook_inbox" ? parseRingPayload([r.record]) : parseHistoryPage([r.record], deviceId),
      );
    } else {
      const byRaw = new Map<string, RawDoorEvent[]>();
      for (const e of outcome.output.events) {
        const list = byRaw.get(e.rawId) ?? [];
        list.push({ ...e, source: kind === "webhook_inbox" ? "webhook" : "history" } as RawDoorEvent);
        byRaw.set(e.rawId, list);
      }
      const skipped = new Set(outcome.output.skipped.map((s) => s.rawId));
      void skipped;
      events = [];
      for (const r of records) {
        const ground = kind === "webhook_inbox" ? parseRingPayload([r.record]) : parseHistoryPage([r.record], deviceId);
        const mine = byRaw.get(r.rawId) ?? [];
        if (ground.length > 0) {
          for (const g of ground) {
            const match = mine.find((m) => m.requestId === g.requestId || (m.deviceId === g.deviceId && m.tsMs === g.tsMs));
            if (!match) filled += 1;
            else if (!sameEvent(match, g)) corrected += 1;
          }
          events.push(...ground);
        } else {
          const ts = recordTimestampMs(r.record);
          const dev = recordDeviceId(r.record, deviceId);
          for (const m of mine) {
            if (m.tsMs === ts && m.deviceId === dev) events.push(m);
          }
        }
      }
    }
    const before = session.store.getState().events.length;
    dispatchTraced("ingest_events", { events }, 1, "agent");
    eventsIngested += session.store.getState().events.length - before;
    return { corrected, filled };
  };

  const inbox = await ring.drainWebhookInbox();
  const inboxRecords = inbox.map((p) => ({ rawId: `evt:${p.meta.request_id}`, record: p as unknown }));
  let usedReader = false;
  for (let i = 0; i < inboxRecords.length; i += 60) {
    const chunk = inboxRecords.slice(i, i + 60);
    const outcome = await callRole("extractor", { kind: "webhook_inbox", deviceId: "all", records: chunk }, 1);
    if (!outcome.ok) usedReader = true;
    const { corrected, filled } = ingestChunk(chunk, "webhook_inbox", "all", outcome.ok ? outcome : null);
    void corrected;
    void filled;
  }
  for (const p of inbox) {
    const parsed = parseRingPayload([p]);
    for (const e of parsed) {
      session.store.dispatch("record_webhook", {
        requestId: e.requestId, type: e.type, deviceId: e.deviceId, tsMs: e.tsMs, receivedMs: session.store.getState().clockMs,
      }, "agent");
    }
  }
  {
    const afterInbox = session.store.getState();
    const since = (lastWebhookMs(afterInbox, doorId) ?? afterInbox.window.startMs) - HISTORY_OVERLAP_MS;
    const rawHistory = await fetchRawHistorySince(ring, doorId, since);
    const outcome = await callRole(
      "extractor",
      { kind: "history_page", deviceId: doorId, records: rawHistory },
      1,
    );
    if (!outcome.ok) usedReader = true;
    ingestChunk(rawHistory, "history_page", doorId, outcome.ok ? outcome : null);
  }
  errorsAfterPerceive = session.checkNow().counts.errors;
  perceiveDetail = usedReader ? `ingested with ${eventsIngested} events; used the built-in reader` : `ingested ${eventsIngested} events`;
  phase("perceive", 1, perceiveDetail);

  // 3. plan. The single onPhase fire carries the outcome detail.
  const planModel = session.store.getState();
  const off = planModel.household.utcOffsetMin;
  const dayCounts = [];
  for (let day = 7; day <= 13; day++) {
    const start = planModel.window.baselineStartMs + day * DAY_MS;
    dayCounts.push({
      day,
      label: fmtDay(start, off),
      events: planModel.events.filter((e) => e.tsMs >= start && e.tsMs < start + DAY_MS).length,
    });
  }
  const planInput = {
    goal: "Review the week and decide what to tell the family.",
    household: {
      name: planModel.household.name,
      age: planModel.household.age,
      caretaker: planModel.household.caretaker,
      quietHours: "22:00 to 07:00",
    },
    baseline: {
      dwellP90Min: Math.round(planModel.baseline.dwellP90Sec / 60),
      visitsPerDay: 3,
    },
    dayCounts,
    actions: session.registry.list().map((d) => ({ name: d.name, purpose: d.title })),
  };
  const planOutcome = await callRole("planner", planInput, 2);
  let planText: string;
  let planDetail: string;
  if (!planOutcome.ok) {
    planText = DEFAULT_PLAN_TEXT;
    planDetail = "planner degraded; used the default plan";
  } else {
    const allowed = new Set(ACTION_NAMES as readonly string[]);
    const steps = planOutcome.output.steps.map((s) => ({
      ...s,
      actions: s.actions.filter((a) => allowed.has(a)),
    }));
    planText = `${steps.map((s) => `${s.order}. ${s.goal} (${s.actions.join(", ")}) — ${s.why}`).join("\n")}\nWatch for: ${planOutcome.output.watchFor.join("; ")}`;
    planDetail = `planned ${steps.length} steps`;
  }
  phase("plan", 2, planDetail);

  // 4. act.
  phase("act", 3, "reviewing the week");
  const actRes = await runAgentLoop({
    registry: session.registry,
    step: transport.step,
    goal: ACT_GOAL(planText),
    productName: "Doorstep Rhythm",
    procedureText: ACTOR_PROMPT,
    maxSteps: limits.act,
    trace: session.trace,
    round: () => 3,
    signal: deps.signal,
    modelRole: "actor",
  });
  if (actRes.stopped === "model_error") {
    stoppedAt = "act";
    errorsAfterAct = session.checkNow().counts.errors;
    errorsAfterRepair = errorsAfterAct;
    warningsAfterRepair = session.checkNow().counts.warnings;
    return finish();
  }
  errorsAfterAct = session.checkNow().counts.errors;

  // 5. verify.
  phase("verify", 3, "checking the record");
  {
    const entries = session.trace.entries();
    let lastChange = -1;
    let lastCheck = -1;
    entries.forEach((e, i) => {
      if (e.state_change && e.state_change.revision_after > e.state_change.revision_before) lastChange = i;
      if (e.kind === "action" && e.name === "check_week_model" && e.ok) lastCheck = i;
    });
    if (lastCheck < lastChange) {
      await session.call("check_week_model", {}, { source: "agent", round: 3 });
    }
  }

  // 6. repair. The single onPhase fire carries the outcome detail.
  let repairDetail = "no errors to repair";
  {
    let errors = session.checkNow().counts.errors;
    while (errors > 0) {
      const revBefore = session.store.snapshot().revision;
      await runAgentLoop({
        registry: session.registry,
        step: transport.step,
        goal: REPAIR_GOAL,
        productName: "Doorstep Rhythm",
        procedureText: ACTOR_PROMPT,
        maxSteps: limits.repair,
        trace: session.trace,
        round: () => 4,
        signal: deps.signal,
        modelRole: "actor",
      });
      errors = session.checkNow().counts.errors;
      if (errors === 0) {
        repairDetail = "agent repaired all errors";
        break;
      }
      if (session.store.snapshot().revision === revBefore) break; // no progress: system repair takes over
    }
    errors = session.checkNow().counts.errors;
    if (errors > 0) {
      const issues = session.checkNow().issues.filter((i) => i.severity === "error" && i.fix);
      for (const issue of issues) {
        const fix = (issue.fix as { action: string; args: Record<string, unknown> });
        await session.call(fix.action, fix.args, { source: "system", round: 4 });
      }
      await session.call("check_week_model", {}, { source: "system", round: 4 });
      repairDetail = "repaired by the system after the agent stopped";
    }
  }
  phase("repair", 4, repairDetail);
  errorsAfterRepair = session.checkNow().counts.errors;
  warningsAfterRepair = session.checkNow().counts.warnings;

  // 7. explain.
  phase("explain", 5, "writing family notes");
  {
    const explainModel = session.store.getState();
    const open = explainModel.incidents.filter((x) => x.status === "open").sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const inc of open) {
      const facts = buildNarratorFacts(inc, session.store.getState());
      const input = {
        incident: {
          id: inc.id, kind: inc.kind, title: inc.title,
          whenLocal: `${facts.day} ${facts.clock}`,
          durationMin: facts.mins, facts: facts.facts,
        },
        household: { name: session.store.getState().household.name, caretaker: session.store.getState().household.caretaker },
        baseline: { dwellP90Min: facts.p90 },
      };
      const out = await callRole("narrator", input, 5);
      let text: string;
      if (!out.ok) {
        text = facts.template;
      } else {
        const guarded = await guardCopy(out.output.explanation, async (t, hits) => {
          const retry = await callRole("narrator", {
            ...input,
            incident: { ...input.incident, facts: [...input.incident.facts, `Avoid these words: ${hits.join(", ")}`] },
          }, 5);
          if (!retry.ok) return t;
          return retry.output.explanation;
        }, facts.template);
        text = guarded.text;
        if (!numbersGrounded(text, facts.factsText)) text = facts.template;
      }
      await session.call("set_incident_status", { incidentId: inc.id, status: "explained", summary: text }, { source: "agent", round: 5 });
    }
  }

  // 8. checkpoint.
  phase("checkpoint", 6, "preparing the family update");
  {
    const decided = new Set<string>();
    let rejectedFirst = false;
    let unsub: (() => void) | null = null;
    if (deps.autoDecide) {
      const mode = deps.autoDecide;
      const delay = deps.decisionDelayMs ?? 40;
      unsub = session.gate.subscribe((pending) => {
        for (const req of pending) {
          if (decided.has(req.id)) continue;
          decided.add(req.id);
          setTimeout(() => {
            if (mode === "approve") session.gate.decide(req.id, "approved");
            else if (!rejectedFirst) {
              rejectedFirst = true;
              session.gate.decide(req.id, "rejected");
            } else session.gate.decide(req.id, "approved");
          }, delay);
        }
      });
    }
    try {
      await runAgentLoop({
        registry: session.registry,
        step: transport.step,
        goal: CHECKPOINT_GOAL(session.store.getState().household.caretaker),
        productName: "Doorstep Rhythm",
        procedureText: ACTOR_PROMPT,
        maxSteps: limits.checkpoint,
        trace: session.trace,
        round: () => 6,
        signal: deps.signal,
        modelRole: "actor",
      });
    } finally {
      unsub?.();
    }
  }

  // 9. finish.
  phase("finish", 6, "done");
  await session.call("check_week_model", {}, { source: "agent", round: 6 });
  return finish();
}
