// scripts/verify/scripted-transport.ts — verification tooling only, never shipped
// in the app, never recorded as golden. Deterministic actor + role stubs.
import { makeDegradedResult } from "src/resilience";
import type { Session } from "src/domain/session.js";
import type { Content } from "src/kits/agent-workflow/src/llm/types.js";
import type { StepBody } from "src/kits/agent-workflow/src/server/stepHandler.js";
import { parseHistoryPage, parseRingPayload } from "src/domain/parse.js";
import { buildNarratorFacts } from "src/agent/brief.js";
import type { AgentTransport } from "src/agent/transport.js";
import type { RoleInput, RoleName } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome } from "src/llm/roles.js";

export interface ScriptSwitches {
  degradedPlanner?: boolean;
  wrongExtractorTs?: boolean;
  dirtyNarrator?: boolean;
  ungroundedNarrator?: boolean;
  failingStep?: boolean;
}

type Call = { name: string; args: Record<string, unknown> };

function modelCalls(contents: Content[], name: string): Call[] {
  const out: Call[] = [];
  for (const turn of contents) {
    if (turn.role !== "model") continue;
    for (const p of turn.parts) {
      if (p.functionCall?.name === name) out.push({ name, args: p.functionCall.args });
    }
  }
  return out;
}

function responsesFor(contents: Content[], name: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const turn of contents) {
    if (turn.role !== "user") continue;
    for (const p of turn.parts) {
      if (p.functionResponse?.name === name) out.push(p.functionResponse.response);
    }
  }
  return out;
}

export function createScriptedTransport(session: Session, switches?: ScriptSwitches): AgentTransport {
  const sw = switches ?? {};
  const mirrored = new Set<string>();

  function mirrorRefusals(contents: Content[]): void {
    for (const turn of contents) {
      if (turn.role !== "user") continue;
      for (const p of turn.parts) {
        const fr = p.functionResponse;
        if (!fr) continue;
        const out = fr.response as { ok?: boolean; summary?: string };
        if (out.ok !== false) continue;
        const summary = typeof out.summary === "string" ? out.summary : "refused";
        const key = `${fr.name}::${summary}`;
        if (mirrored.has(key)) continue;
        const exists = session.trace.entries().some(
          (e) => e.kind === "action" && e.name === fr.name && e.ok === false && e.output_ref === summary,
        );
        if (exists) continue;
        mirrored.add(key);
        // Preflight refusals never reach the registry, so they leave no trace
        // entry; mirror the refused outcome so the offline trace shows it.
        session.trace.record({
          round: 0, kind: "action", name: fr.name, source: "agent",
          input_ref: null, output_ref: summary, ok: false, latency_ms: 0,
        });
      }
    }
  }

  async function role<R extends RoleName>(role: R, input: RoleInput[R], ctx: RoleCtx): Promise<RoleOutcome<R>> {
    void ctx;
    const usage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
    if (role === "extractor") {
      const inputEx = input as RoleInput["extractor"];
      const events: Record<string, unknown>[] = [];
      const skipped: { rawId: string; reason: string }[] = [];
      for (const r of inputEx.records) {
        const ground = inputEx.kind === "webhook_inbox"
          ? parseRingPayload([r.record])
          : parseHistoryPage([r.record], inputEx.deviceId);
        if (ground.length === 0) {
          skipped.push({ rawId: r.rawId, reason: "unreadable record" });
          continue;
        }
        for (const g of ground) {
          events.push({
            rawId: r.rawId, deviceId: g.deviceId, componentId: g.componentId, type: g.type,
            subType: g.subType ?? null, tsMs: g.tsMs, requestId: g.requestId,
          });
        }
      }
      if (sw.wrongExtractorTs && events.length > 0) {
        (events[0] as { tsMs: number }).tsMs += 60000;
      }
      return { ok: true, output: { events, skipped } as never, model: "scripted", kind: "bedrock", usage, latencyMs: 0 };
    }
    if (role === "planner") {
      if (sw.degradedPlanner) {
        return {
          ok: false,
          degraded: makeDegradedResult({ reason: "scripted_planner_failed", fallback_source: "none" }),
          kind: "bedrock",
        };
      }
      const plan = {
        steps: [
          { order: 1, goal: "Read the record and reconcile every device cleanly.", actions: ["list_week_events", "reconcile_webhook_gap"], why: "The counts need a fresh read first." },
          { order: 2, goal: "Compare each focus day with the baseline rhythm.", actions: ["compare_to_baseline"], why: "Day counts point at the odd days." },
          { order: 3, goal: "Record every real change as an incident now.", actions: ["open_incident", "add_incident_note"], why: "Findings fade unless recorded." },
          { order: 4, goal: "Verify the record until zero errors remain.", actions: ["check_week_model"], why: "Only a clean check ends doubt." },
          { order: 5, goal: "Prepare the family message and weekly brief.", actions: ["propose_family_nudge", "export_weekly_brief"], why: "The family waits on the word." },
        ],
        focusDays: [8, 10, 11],
        watchFor: ["a visit after quiet hours begin", "a device that stopped reporting"],
      };
      return { ok: true, output: plan as never, model: "scripted", kind: "bedrock", usage, latencyMs: 0 };
    }
    const inputNa = input as RoleInput["narrator"];
    const model = session.store.getState();
    const inc = model.incidents.find((x) => x.id === inputNa.incident.id);
    const facts = inc
      ? buildNarratorFacts(inc, model)
      : { template: "Several events were the same moment seen twice.", factsText: (inputNa.incident.facts ?? []).join("\n") };
    const isRewrite = (inputNa.incident.facts ?? []).some((f) => f.startsWith("Avoid these words:"));
    let explanation = facts.template;
    if (sw.dirtyNarrator) {
      explanation = isRewrite
        ? "Honestly, it still needs triage at 02:14."
        : "Honestly, there was triage at 02:14 on Tue 13 Oct.";
    } else if (sw.ungroundedNarrator) {
      explanation = "There was door activity at 02:14 on Tue 13 Oct. It lasted 99 min in total.";
    }
    return {
      ok: true,
      output: {
        incidentId: inputNa.incident.id,
        title: inc?.title ?? "Door activity",
        explanation,
        tone: "calm",
        suggestedNudge: null,
      } as never,
      model: "scripted",
      kind: "bedrock",
      usage,
      latencyMs: 0,
    };
  }

  function procedureOf(contents: Content[]): "A" | "B" | "C" | null {
    const first = contents[0];
    const text = first && first.role === "user" ? first.parts.map((p) => p.text ?? "").join("\n") : "";
    if (text.includes("Procedure A")) return "A";
    if (text.includes("Procedure B")) return "B";
    if (text.includes("Procedure C")) return "C";
    return null;
  }

  const step: AgentTransport["step"] = async (body: StepBody) => {
    const contents = body.contents;
    mirrorRefusals(contents);
    const proc = procedureOf(contents);
    if (sw.failingStep && proc === "A" && modelCalls(contents, "list_week_events").length === 0 && modelCalls(contents, "get_rhythm_baseline").length === 0) {
      return { ok: false, status: 502, message: "scripted step failure" };
    }
    const done = (calls: Call[], text: string) => ({
      ok: true as const,
      result: {
        text,
        functionCalls: calls.map((c) => ({ name: c.name, args: c.args })),
        usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: "scripted",
        latencyMs: 0,
      },
    });
    if (proc === "A") {
      const devRes = responsesFor(contents, "list_devices");
      if (devRes.length === 0) {
        return done(
          [{ name: "get_rhythm_baseline", args: {} }, { name: "list_devices", args: {} }],
          "Reading the baseline and devices.",
        );
      }
      const devices = ((devRes[0] as { data?: { devices?: { id: string }[] } }).data?.devices ??
        session.store.getState().devices) as { id: string }[];
      const reconciled = new Set(modelCalls(contents, "reconcile_webhook_gap").map((c) => String(c.args["deviceId"])));
      const missingDevices = devices.filter((d) => !reconciled.has(d.id));
      if (missingDevices.length > 0) {
        return done(
          missingDevices.map((d) => ({ name: "reconcile_webhook_gap", args: { deviceId: d.id, overlapMinutes: 0 } })),
          "Reconciling quiet devices.",
        );
      }
      const compared = new Set(modelCalls(contents, "compare_to_baseline").map((c) => Number(c.args["day"])));
      const missingDays = [7, 8, 9, 10, 11, 12, 13].filter((d) => !compared.has(d));
      if (missingDays.length > 0) {
        return done(missingDays.map((day) => ({ name: "compare_to_baseline", args: { day } })), "Comparing days.");
      }
      const findings = responsesFor(contents, "compare_to_baseline").flatMap(
        (r) => ((r as { data?: { findings?: Record<string, unknown>[] } }).data?.findings ?? []),
      );
      const openedKeys = new Set(
        modelCalls(contents, "open_incident").map((c) => `${String(c.args["kind"])}::${JSON.stringify(c.args["eventIds"])}`),
      );
      const pending = findings.filter(
        (f) => !openedKeys.has(`${String(f["kind"])}::${JSON.stringify(f["eventIds"])}`),
      );
      if (pending.length > 0) {
        return done(
          pending.map((f) => {
            const { covered: _covered, ...rest } = f;
            void _covered;
            return { name: "open_incident", args: rest };
          }),
          "Opening incidents.",
        );
      }
      const openIds = responsesFor(contents, "open_incident").map(
        (r) => (r as { data?: { incident?: { id?: string; title?: string } } }).data?.incident,
      );
      const noted = new Set(modelCalls(contents, "add_incident_note").map((c) => String(c.args["incidentId"])));
      const unnoted = openIds.filter((i) => i?.id && !noted.has(i.id));
      if (unnoted.length > 0) {
        return done(
          unnoted.map((i) => ({ name: "add_incident_note", args: { incidentId: i?.id as string, text: `Recorded: ${i?.title as string}.` } })),
          "Noting incidents.",
        );
      }
      if (responsesFor(contents, "check_week_model").length === 0) {
        return done([{ name: "check_week_model", args: {} }], "Verifying.");
      }
      return done([], "Reviewed the week and recorded the findings. check_week_model reports the final counts.");
    }
    if (proc === "B") {
      const calls = modelCalls(contents, "open_incident").length + modelCalls(contents, "merge_duplicate_events").length;
      if (calls === 0) {
        const fixes = session.checkNow().issues
          .filter((i) => i.severity === "error" && i.fix)
          .map((i) => ({ name: (i.fix as { action: string }).action, args: (i.fix as { args: Record<string, unknown> }).args }));
        if (fixes.length > 0) return done(fixes, "Applying fixes.");
      }
      if (responsesFor(contents, "check_week_model").length === 0) {
        return done([{ name: "check_week_model", args: {} }], "Verifying repairs.");
      }
      return done([], "Repaired the errors and verified zero remain.");
    }
    if (proc === "C") {
      if (modelCalls(contents, "propose_family_nudge").length === 0) {
        const open = session.store.getState().incidents.find((x) => x.status === "open") ??
          session.store.getState().incidents[0];
        return done(
          [{
            name: "propose_family_nudge",
            args: {
              text: "Maybe a quick call this evening to check in.",
              ...(open ? { incidentId: open.id } : {}),
            },
          }],
          "Proposing a family message.",
        );
      }
      if (modelCalls(contents, "export_weekly_brief").length === 0) {
        return done([{ name: "export_weekly_brief", args: { includeNotes: true } }], "Sharing the brief.");
      }
      if (modelCalls(contents, "play_chime_announcement").length === 0) {
        const chiming = session.store.getState().devices.find((d) => d.chimeAudio)?.id ?? "dev-door";
        return done(
          [{ name: "play_chime_announcement", args: { deviceId: chiming, audioRef: "gentle_hello" } }],
          "Trying the chime.",
        );
      }
      return done([], "Prepared the family update and noted what needs consent.");
    }
    return done([], "No procedure matched; stopping.");
  };

  return { kind: "bedrock", label: "Scripted", model: () => "scripted", role, step };
}
