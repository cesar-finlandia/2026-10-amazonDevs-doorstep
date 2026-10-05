// Requirement IDs: HEE-KIT-02
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { DomainStore, Source } from "../store/domainStore.js";
import type { ApprovalGate } from "../gate/approvalGate.js";
import type { TraceWriter } from "../trace/types.js";
import type { createTruthEngine } from "../truth/truthEngine.js";
import type { ActionDescriptor, ActionResult, Registry } from "./types.js";
import { lintDescriptor } from "./lint.js";
import { buildManifest } from "./manifest.js";
import { groupNames } from "./capabilities.js";

export interface RegistryOptions<M> {
  store: DomainStore<M>;
  gate: ApprovalGate;
  trace: TraceWriter;
  truth?: ReturnType<typeof createTruthEngine<M>>;
  procedures?: { name: string; steps: string[] }[];
  gateEnabled?: () => boolean;
}

function compileInputSchema(schema: Record<string, unknown>): (data: unknown) => { ok: true } | { ok: false; errors: string[] } {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return (data: unknown) => {
    if (validate(data)) return { ok: true };
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
    return { ok: false, errors };
  };
}

export function createRegistry<M>(opts: RegistryOptions<M>): Registry<M> {
  const { store, gate, trace } = opts;
  const gateEnabled = opts.gateEnabled ?? (() => gate.isEnabled());
  const procedures = opts.procedures ?? [];
  const descriptors = new Map<string, ActionDescriptor<M>>();
  const listeners = new Set<(names: string[]) => void>();
  let argsCounter = 0;

  function notify(): void {
    const names = [...descriptors.keys()];
    for (const fn of listeners) fn(names);
  }

  function active(descriptors_: ActionDescriptor<M>[]): ActionDescriptor<M>[] {
    const state = store.getState();
    return descriptors_.filter((d) => (d.dynamicWhile ? d.dynamicWhile(state) : true));
  }

  function currentList(): ActionDescriptor<M>[] {
    return active([...descriptors.values()]);
  }

  function validNextActions(): string[] {
    const state = store.getState();
    return currentList()
      .filter((d) => d.name !== "get_capabilities" && (!d.precondition || d.precondition(state)))
      .map((d) => d.name);
  }

  function manifestHash(): string {
    return buildManifest({ descriptors: currentList(), procedures }).contract_hash;
  }

  const capabilities: ActionDescriptor<M> = {
    name: "get_capabilities",
    title: "List capabilities",
    group: "read",
    description:
      "Lists every registered action grouped by group, with the procedures and the contract hash. Call this first when you have not yet seen this product's procedures. Example: get_capabilities({}).",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: () => {
      const list = currentList();
      return {
        ok: true as const,
        summary: `${list.length} actions available`,
        data: {
          groups: groupNames(list),
          count: list.length,
          procedures,
          contract_hash: manifestHash(),
          revision: store.revision(),
        },
      };
    },
  };

  async function call(
    name: string,
    args: unknown,
    callOpts: { source: Source; round?: number; signal?: AbortSignal },
  ): Promise<ActionResult> {
    const round = callOpts.round ?? 0;
    const started = performance.now();
    const state = store.getState();
    const found = name === "get_capabilities" ? capabilities : descriptors.get(name);
    const usable = found && (found.dynamicWhile ? found.dynamicWhile(state) : true) ? found : undefined;
    if (!usable) {
      trace.record({
        round, kind: "action", name, source: callOpts.source,
        input_ref: null, output_ref: `Unknown action ${name}.`, ok: false, latency_ms: 0,
      });
      return {
        ok: false,
        summary: `Unknown action ${name}.`,
        revision: store.revision(),
        validNextActions: validNextActions(),
        error: { message: "unknown action", next: "get_capabilities" },
      };
    }

    const input_ref = `args#${++argsCounter}`;
    const check = compileInputSchema(usable.inputSchema);
    const checked = check(args);
    if (!checked.ok) {
      const message = checked.errors.join("; ");
      trace.record({
        round, kind: "action", name, source: callOpts.source,
        input_ref, output_ref: message, ok: false, latency_ms: 0,
      });
      return {
        ok: false,
        summary: message,
        revision: store.revision(),
        validNextActions: validNextActions(),
        error: { message, next: `Call get_capabilities for the schema of ${name}.` },
      };
    }

    if (
      typeof args === "object" && args !== null &&
      Number.isInteger((args as Record<string, unknown>)["expectedRevision"]) &&
      (args as Record<string, unknown>)["expectedRevision"] !== store.revision()
    ) {
      const n = store.revision();
      const message = `stale revision: the model is at ${n}; re-read before changing it.`;
      trace.record({
        round, kind: "action", name, source: callOpts.source,
        input_ref, output_ref: message, ok: false, latency_ms: 0,
      });
      return {
        ok: false,
        summary: message,
        revision: n,
        validNextActions: validNextActions(),
        error: { message, next: `Call a read action, then retry with expectedRevision ${n}.` },
      };
    }

    if (usable.annotations.destructive && gateEnabled()) {
      const plainSummary = usable.summarize ? usable.summarize(args) : `${usable.title} ${JSON.stringify(args)}`;
      const decision = await gate.request({ action: name, plainSummary, source: callOpts.source }, callOpts.signal);
      trace.record({
        round, kind: "approval", name, source: callOpts.source,
        input_ref, output_ref: null, ok: decision.decision === "approved",
        latency_ms: 0, decision: decision.decision,
      });
      if (decision.decision !== "approved") {
        const message = (decision as { message: string }).message;
        trace.record({
          round, kind: "action", name, source: callOpts.source,
          input_ref, output_ref: message, ok: false, latency_ms: performance.now() - started,
        });
        return {
          ok: false,
          summary: message,
          revision: store.revision(),
          validNextActions: validNextActions(),
          error: { message },
        };
      }
    }

    const before = store.snapshot();
    let outcome: Awaited<ReturnType<ActionDescriptor<M>["handler"]>>;
    try {
      outcome = await usable.handler(args, { store, source: callOpts.source, signal: callOpts.signal, round });
    } catch (e) {
      store.restore(before);
      const message = (e as Error).message ?? String(e);
      trace.record({
        round, kind: "action", name, source: callOpts.source,
        input_ref, output_ref: message, ok: false, latency_ms: performance.now() - started,
      });
      return {
        ok: false,
        summary: message,
        revision: store.revision(),
        validNextActions: validNextActions(),
        error: { message },
      };
    }
    if (!outcome.ok) {
      store.restore(before);
      trace.record({
        round, kind: "action", name, source: callOpts.source,
        input_ref, output_ref: outcome.error, ok: false, latency_ms: performance.now() - started,
      });
      return {
        ok: false,
        summary: outcome.error,
        revision: store.revision(),
        validNextActions: validNextActions(),
        error: { message: outcome.error, next: outcome.next },
      };
    }

    const changed = store.revision() !== before.revision;
    const next = validNextActions();
    let data = outcome.data;
    let truth: { errors: number; warnings: number } | undefined;
    if (usable.group === "verify" && opts.truth) {
      const counts = opts.truth.counts(opts.truth.check(store.getState()));
      truth = counts;
      data = { ...((data as Record<string, unknown> | undefined) ?? {}), truth: counts };
    }
    const argsJson = JSON.stringify(args);
    const keepArgs = argsJson.length <= 2000;
    trace.record({
      round, kind: "action", name, source: callOpts.source,
      input_ref: keepArgs ? input_ref : "args-omitted",
      ...(keepArgs ? { args: args as Record<string, unknown> } : {}),
      output_ref: outcome.summary,
      ok: true,
      latency_ms: performance.now() - started,
      ...(changed
        ? { state_change: { revision_before: before.revision, revision_after: store.revision(), entity_ids: outcome.entityIds ?? [] } }
        : {}),
      ...(truth ? { truth } : {}),
    });
    return { ok: true, summary: outcome.summary, data, revision: store.revision(), validNextActions: next };
  }

  return {
    register(d: ActionDescriptor<M>): void {
      const problems = lintDescriptor(d as ActionDescriptor<unknown>);
      if (problems.length > 0) throw new Error(`descriptor ${d.name}: ${problems.join("; ")}`);
      descriptors.set(d.name, d);
      notify();
    },
    unregister(name: string): void {
      descriptors.delete(name);
      notify();
    },
    list(): ActionDescriptor<M>[] {
      return [capabilities, ...currentList()];
    },
    call,
    onChange(fn: (names: string[]) => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    exportManifest(): ReturnType<Registry<M>["exportManifest"]> {
      return buildManifest({ descriptors: currentList(), procedures });
    },
  };
}
