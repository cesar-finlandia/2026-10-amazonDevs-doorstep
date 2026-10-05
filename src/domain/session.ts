// Requirement IDs: FR-02, FR-07, FR-09
// createSession: the store, truth engine, gate, trace, wrapped registry and Ring port as one unit.
import type { DomainStore, Source } from "src/kits/agent-workflow/src/store/domainStore.js";
import { createDomainStore } from "src/kits/agent-workflow/src/store/domainStore.js";
import type { ApprovalGate } from "src/kits/agent-workflow/src/gate/approvalGate.js";
import { createApprovalGate } from "src/kits/agent-workflow/src/gate/approvalGate.js";
import type { TraceWriter } from "src/kits/agent-workflow/src/trace/types.js";
import { createTraceWriter } from "src/kits/agent-workflow/src/trace/traceWriter.js";
import type { Registry, ActionResult } from "src/kits/agent-workflow/src/registry/types.js";
import { createRegistry } from "src/kits/agent-workflow/src/registry/registry.js";
import type { Issue } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import { createTruthEngine } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import type { RingPort } from "src/domain/ring-port.js";
import type { WeekModel } from "src/domain/types.js";
import { storeActions } from "src/domain/actions.js";
import { truthRules } from "src/domain/rules.js";
import { demoSeed } from "src/domain/seed.js";

export type Preflight = (model: WeekModel, args: unknown) => null | { message: string; next?: string };
export interface TruthEngine { check(model: WeekModel): Issue[]; counts(issues: Issue[]): { errors: number; warnings: number } }
export interface SessionCore {
  store: DomainStore<WeekModel>; truth: TruthEngine; gate: ApprovalGate; trace: TraceWriter;
  registry: Registry<WeekModel>;            // the WRAPPED registry (see §5.7)
  ring: RingPort;
  registerPreflight(actionName: string, fn: Preflight): void;
}
export interface Session extends SessionCore {
  checkNow(): { issues: Issue[]; counts: { errors: number; warnings: number } };
  reset(initial?: WeekModel): void;          // store.restore({model: clone, revision: 0}) + trace.reset()
  call(name: string, args: unknown, opts: { source: Source; round?: number; signal?: AbortSignal }): Promise<ActionResult>;  // === registry.call
  snapshot(): { model: WeekModel; revision: number };
  restore(s: { model: WeekModel; revision: number }): void;
}
export interface SessionOptions {
  initial?: WeekModel;                       // default demoSeed()
  ring: RingPort;
  registrar?: (core: SessionCore) => void;   // DP-AGENT-WORKFLOW registers the 20 descriptors here
  gateEnabled?: boolean;                     // default true
  gateTimeoutMs?: number;                    // default 120000
  procedures?: { name: string; steps: string[] }[];   // handed to createRegistry; DP-AGENT-WORKFLOW passes ACTOR_PROCEDURES
  runId?: string; now?: () => number;
}

function clone(model: WeekModel): WeekModel {
  return structuredClone(model);
}

export function createSession(opts: SessionOptions): Session {
  const seed = opts.initial ?? demoSeed();
  const store = createDomainStore<WeekModel>({ initial: seed, actions: storeActions, maxHistory: 200 });
  const truth = createTruthEngine(truthRules);
  const gate = createApprovalGate({ timeoutMs: opts.gateTimeoutMs ?? 120000, now: opts.now });
  gate.setEnabled(opts.gateEnabled ?? true);
  const trace = createTraceWriter({ runId: opts.runId, now: opts.now });
  const core = createRegistry<WeekModel>({
    store,
    gate,
    trace,
    truth,
    procedures: opts.procedures ?? [],
    gateEnabled: () => gate.isEnabled(),
  });
  const preflights = new Map<string, Preflight[]>();

  async function call(
    name: string,
    args: unknown,
    callOpts: { source: Source; round?: number; signal?: AbortSignal },
  ): Promise<ActionResult> {
    for (const fn of preflights.get(name) ?? []) {
      const verdict = fn(store.getState(), args);
      if (verdict !== null) {
        return {
          ok: false,
          summary: verdict.message,
          revision: store.revision(),
          validNextActions: [],
          error: { message: verdict.message, ...(verdict.next !== undefined ? { next: verdict.next } : {}) },
        };
      }
    }
    if (callOpts.source === "human") {
      const was = gate.isEnabled();
      gate.setEnabled(false);
      try {
        return await core.call(name, args, callOpts);
      } finally {
        gate.setEnabled(was);
      }
    }
    return core.call(name, args, callOpts);
  }

  const registry: Registry<WeekModel> = { ...core, call };
  const session: Session = {
    store,
    truth,
    gate,
    trace,
    registry,
    ring: opts.ring,
    registerPreflight(actionName, fn) {
      const list = preflights.get(actionName) ?? [];
      list.push(fn);
      preflights.set(actionName, list);
    },
    checkNow() {
      const issues = truth.check(store.getState());
      return { issues, counts: truth.counts(issues) };
    },
    reset(initial?) {
      store.restore({ model: clone(initial ?? seed), revision: 0 });
      trace.reset();
    },
    call,
    snapshot() {
      return store.snapshot();
    },
    restore(s) {
      store.restore(s);
    },
  };
  opts.registrar?.(session);
  return session;
}
