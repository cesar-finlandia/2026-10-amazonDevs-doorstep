// Requirement IDs: FR-18, FR-21, NFR-14
import type { StepFn } from "src/kits/agent-workflow/src/adapters/inApp.js";
import type { AgentTransport } from "src/agent/transport.js";
import type { RoleName, RoleInput } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome, TransportKind } from "src/llm/roles.js";
import type { CostClient } from "src/llm/cost.js";
import type { EventHub } from "src/server/events.js";

export type Rung = "bedrock" | "golden" | "manual";

export interface RungState {
  kind: TransportKind;
  label: string;
  model: string;
  rung: Rung;
}

export interface AgentServiceDeps {
  env: Record<string, string | undefined>;
  hub: EventHub;
  cost: CostClient;
  makeBedrock: () => (AgentTransport & { onRungChange(fn: (kind: TransportKind, label: string) => void): void }) | null;
  makeGolden: () => (AgentTransport & { remaining(): number; drift(): number }) | null;
  makeManual: () => AgentTransport;
  runMax: number;
  now?: () => number;
  stepTimeoutMs?: number;
}

export interface AgentService {
  state(): RungState;
  role<R extends RoleName>(
    runId: string,
    role: R,
    input: RoleInput[R],
    ctx: RoleCtx,
  ): Promise<RoleOutcome<R> & { rungChanged: boolean; label: string }>;
  step(
    runId: string,
    body: Parameters<StepFn>[0],
  ): Promise<Awaited<ReturnType<StepFn>> & { rungChanged?: boolean; kind: TransportKind; label: string }>;
  descend(reason: string): RungState;
  usedPct(): number;
}

export function createAgentService(deps: AgentServiceDeps): AgentService {
  const stepTimeoutMs = deps.stepTimeoutMs ?? 90000;
  let rung: Rung | null = null;
  let availBedrock: (AgentTransport & { onRungChange(fn: (kind: TransportKind, label: string) => void): void }) | null =
    null;
  let availGolden: ((AgentTransport & { remaining(): number; drift(): number }) | null) | undefined;
  let availReady = false;
  let sharedManual: AgentTransport | null = null;
  const runs = new Map<string, AgentTransport>();
  const stepCounts = new Map<string, number>();
  let lastWarning = "none";

  function ensureAvailable(): void {
    if (availReady) return;
    availReady = true;
    availBedrock = deps.makeBedrock();
    availGolden = deps.makeGolden();
    const want = deps.env["AGENT_PROVIDER"];
    const available = (r: Rung): boolean =>
      r === "bedrock" ? availBedrock !== null : r === "golden" ? availGolden !== null : true;
    if ((want === "bedrock" || want === "golden" || want === "manual") && available(want)) {
      rung = want;
    } else {
      rung = availBedrock !== null ? "bedrock" : availGolden !== null ? "golden" : "manual";
    }
    if (availBedrock) {
      availBedrock.onRungChange((kind, label) => {
        const st = state();
        void deps.hub.publish("agent-rung", "done", { kind, label, model: st.model });
        if (kind === "vertex-fallback") {
          void deps.hub.publish(
            "system-degraded",
            "done",
            {
              layer: "agent",
              kind,
              label,
              reason: "The model is answering through the labelled fallback.",
            },
            { degraded: true },
          );
        }
      });
    }
  }

  function manual(): AgentTransport {
    if (!sharedManual) sharedManual = deps.makeManual();
    return sharedManual;
  }

  function state(): RungState {
    ensureAvailable();
    const r = rung as Rung;
    if (r === "bedrock" && availBedrock) {
      return { kind: availBedrock.kind, label: availBedrock.label, model: availBedrock.model(), rung: r };
    }
    if (r === "golden" && availGolden) {
      return { kind: "golden", label: availGolden.label, model: availGolden.model(), rung: r };
    }
    const m = manual();
    return { kind: m.kind, label: m.label, model: m.model(), rung: r };
  }

  function transportFor(runId: string): AgentTransport {
    ensureAvailable();
    const r = rung as Rung;
    if (r === "bedrock" && availBedrock) return availBedrock;
    if (r === "golden") {
      const held = runs.get(runId);
      if (held) return held;
      const fresh = deps.makeGolden();
      const t = fresh ?? manual();
      runs.set(runId, t);
      while (runs.size > deps.runMax) {
        const first = runs.keys().next().value as string | undefined;
        if (first === undefined) break;
        runs.delete(first);
      }
      return t;
    }
    return manual();
  }

  function noteWarning(): void {
    const w = deps.cost.summary().warning;
    if (w !== lastWarning && (w === "warning" || w === "critical")) {
      lastWarning = w;
      void deps.hub.publish("cost-warning", "done", {
        usedPct: deps.cost.summary().usedPct,
        warning: w,
      });
    } else if (w !== lastWarning) {
      lastWarning = w;
    }
  }

  function descend(reason: string): RungState {
    ensureAvailable();
    const r = rung as Rung;
    if (r === "bedrock") {
      rung = availGolden ? "golden" : "manual";
    } else if (r === "golden") {
      rung = "manual";
    } else {
      return state();
    }
    const st = state();
    void deps.hub.publish("agent-rung", "done", { kind: st.kind, label: st.label, model: st.model });
    void deps.hub.publish(
      "system-degraded",
      "done",
      { layer: "agent", kind: st.kind, label: st.label, reason },
      { degraded: true },
    );
    return st;
  }

  async function role<R extends RoleName>(
    runId: string,
    role: R,
    input: RoleInput[R],
    ctx: RoleCtx,
  ): Promise<RoleOutcome<R> & { rungChanged: boolean; label: string }> {
    ensureAvailable();
    if (deps.cost.summary().degraded && (rung as Rung) === "bedrock") {
      descend("The model budget is used up.");
    }
    const out = await transportFor(runId).role(role, input, ctx);
    noteWarning();
    if (out.ok === false) {
      if ((rung as Rung) === "manual") {
        return { ...out, rungChanged: false, label: state().label };
      }
      const st = descend(out.degraded.reason ?? "The model is not reachable.");
      return { ...out, kind: st.kind, label: st.label, rungChanged: true };
    }
    void deps.hub.publish("agent-role", "done", {
      role,
      kind: out.kind,
      model: out.model,
      totalTokens: out.usage.totalTokens,
      latencyMs: out.latencyMs,
      round: ctx.round,
    });
    return { ...out, rungChanged: false, label: state().label };
  }

  async function step(
    runId: string,
    body: Parameters<StepFn>[0],
  ): Promise<Awaited<ReturnType<StepFn>> & { rungChanged?: boolean; kind: TransportKind; label: string }> {
    ensureAvailable();
    if (deps.cost.summary().degraded && (rung as Rung) === "bedrock") {
      descend("The model budget is used up.");
    }
    const transport = transportFor(runId);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutP = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          /* ignore */
        }
        reject(new Error("step timeout"));
      }, stepTimeoutMs);
    });
    let out: Awaited<ReturnType<StepFn>>;
    try {
      out = await Promise.race([transport.step(body), timeoutP]);
    } catch {
      if (timer !== undefined) clearTimeout(timer);
      const st = descend("The model took too long.");
      return { ok: false, status: 504, message: "The model took too long.", rungChanged: true, kind: st.kind, label: st.label };
    }
    if (timer !== undefined) clearTimeout(timer);
    void controller.signal;
    noteWarning();
    if (out.ok === true) {
      const n = (stepCounts.get(runId) ?? 0) + 1;
      stepCounts.set(runId, n);
      const names = out.result.functionCalls.map((c) => c.name);
      void deps.hub.publish("agent-step", "done", {
        n,
        kind: transport.kind,
        model: out.result.model,
        calls: names,
        latencyMs: out.result.latencyMs,
      });
      return { ...out, rungChanged: false, kind: transport.kind, label: state().label };
    }
    if ((out.status >= 502 || out.status === 504) && (rung as Rung) !== "manual") {
      const st = descend(out.message ?? "The model is not reachable.");
      return { ...out, rungChanged: true, kind: st.kind, label: st.label };
    }
    return { ...out, rungChanged: false, kind: state().kind, label: state().label };
  }

  return {
    state,
    role,
    step,
    descend,
    usedPct: () => deps.cost.summary().usedPct,
  };
}
