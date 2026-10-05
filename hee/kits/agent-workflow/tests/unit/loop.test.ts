// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { createDomainStore } from "../../src/store/domainStore.js";
import { createApprovalGate } from "../../src/gate/approvalGate.js";
import { createTraceWriter } from "../../src/trace/traceWriter.js";
import { createRegistry } from "../../src/registry/registry.js";
import { runAgentLoop } from "../../src/adapters/inApp.js";
import type { StepFn } from "../../src/adapters/inApp.js";

function harness() {
  const store = createDomainStore<{ items: string[] }>({
    initial: { items: [] },
    actions: [
      {
        name: "push",
        apply(model, args) {
          const item = (args as { item: string }).item;
          return { model: { items: [...model.items, item] }, entityIds: [item], summary: `pushed ${item}` };
        },
      },
    ],
  });
  const trace = createTraceWriter();
  const registry = createRegistry({ store, gate: createApprovalGate(), trace });
  registry.register({
    name: "list_items",
    title: "List items",
    group: "read",
    description: "Lists every item. Read before changing. Example: list_items({}).",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: (_args, ctx) => ({ ok: true, summary: `${ctx.store.getState().items.length} items`, data: ctx.store.getState().items }),
  });
  registry.register({
    name: "add_item",
    title: "Add item",
    group: "change",
    description: "Adds an item to the model. Sizes are whole units. Example: add_item({\"item\": \"a\"}).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { item: { type: "string", description: "Item name" } },
      required: ["item"],
    },
    annotations: { readOnly: false, destructive: false, untrustedContent: false },
    handler: (args, ctx) => {
      const item = (args as { item: string }).item;
      const r = ctx.store.dispatch("push", { item }, "agent");
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, summary: `added ${item}`, entityIds: [item] };
    },
  });
  return { store, trace, registry };
}

function usage() {
  return { promptTokens: 10, outputTokens: 5, totalTokens: 15 };
}

describe("runAgentLoop", () => {
  it("calls two functions then ends with text", async () => {
    const { trace, registry } = harness();
    let calls = 0;
    const step: StepFn = async () => {
      calls++;
      if (calls <= 2) {
        return {
          ok: true,
          result: {
            text: "",
            functionCalls: [{ name: "add_item", args: { item: calls === 1 ? "a" : "b" } }],
            usage: usage(),
            model: "test",
            latencyMs: 5,
          },
        };
      }
      return { ok: true, result: { text: "added a and b", functionCalls: [], usage: usage(), model: "test", latencyMs: 5 } };
    };
    const res = await runAgentLoop({
      registry,
      step,
      goal: "add two items",
      productName: "Shelf",
      procedureText: "1. add items.",
      trace,
      modelRole: "actor",
    });
    expect(res.stopped).toBe("done");
    expect(res.finalText).toBe("added a and b");
    const entries = trace.entries();
    expect(entries.filter((e) => e.kind === "model").length).toBe(3);
    expect(entries.filter((e) => e.kind === "model").every((e) => e.name === "actor")).toBe(true);
    const actions = entries.filter((e) => e.kind === "action");
    expect(actions.length).toBe(2);
    expect(actions.every((e) => e.source === "agent")).toBe(true);
  });

  it("max_steps stops the loop", async () => {
    const { trace, registry } = harness();
    const step: StepFn = async () => ({
      ok: true,
      result: { text: "", functionCalls: [{ name: "add_item", args: { item: "x" } }], usage: usage(), model: "t", latencyMs: 1 },
    });
    const res = await runAgentLoop({ registry, step, goal: "g", productName: "P", procedureText: "p", maxSteps: 3, trace });
    expect(res).toMatchObject({ stopped: "max_steps", steps: 3 });
  });

  it("abort stops before the next step", async () => {
    const { trace, registry } = harness();
    const ctl = new AbortController();
    let calls = 0;
    const step: StepFn = async () => {
      calls++;
      ctl.abort();
      return { ok: true, result: { text: "", functionCalls: [{ name: "add_item", args: { item: "z" } }], usage: usage(), model: "t", latencyMs: 1 } };
    };
    const res = await runAgentLoop({ registry, step, goal: "g", productName: "P", procedureText: "p", trace, signal: ctl.signal });
    expect(res.stopped).toBe("aborted");
    expect(calls).toBe(1);
  });

  it("a StepFn failure yields model_error and a system entry", async () => {
    const { trace, registry } = harness();
    const step: StepFn = async () => ({ ok: false, status: 502, message: "down" });
    const res = await runAgentLoop({ registry, step, goal: "g", productName: "P", procedureText: "p", trace });
    expect(res.stopped).toBe("model_error");
    const sys = trace.entries().filter((e) => e.kind === "system");
    expect(sys.length).toBe(1);
    expect(sys[0]?.name).toBe("model_error");
  });
});
