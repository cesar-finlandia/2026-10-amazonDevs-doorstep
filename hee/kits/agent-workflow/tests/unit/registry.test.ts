// Requirement IDs: HEE-KIT-02
import { describe, expect, it, vi } from "vitest";
import { createDomainStore } from "../../src/store/domainStore.js";
import { createApprovalGate } from "../../src/gate/approvalGate.js";
import { createTraceWriter } from "../../src/trace/traceWriter.js";
import { createTruthEngine } from "../../src/truth/truthEngine.js";
import { createRegistry } from "../../src/registry/registry.js";
import type { ActionDescriptor } from "../../src/registry/types.js";

interface Model {
  items: string[];
}

function harness() {
  const store = createDomainStore<Model>({
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
  const gate = createApprovalGate();
  const trace = createTraceWriter();
  const truth = createTruthEngine<Model>([
    {
      id: "non_empty",
      description: "needs an item",
      check: (m) => (m.items.length === 0 ? [{ id: "empty", severity: "error", entityIds: [], message: "0 items but 1 needed." }] : []),
    },
  ]);
  const registry = createRegistry({ store, gate, trace, truth });
  return { store, gate, trace, registry };
}

function readDescriptor(handler: ActionDescriptor<Model>["handler"]): ActionDescriptor<Model> {
  return {
    name: "list_items",
    title: "List items",
    group: "read",
    description: "Lists every item. Read before changing. Example: list_items({}).",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler,
  };
}

function changeDescriptor(handler: ActionDescriptor<Model>["handler"]): ActionDescriptor<Model> {
  return {
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
    handler,
  };
}

describe("registry", () => {
  it("get_capabilities lists groups", async () => {
    const { registry } = harness();
    registry.register(readDescriptor(() => ({ ok: true, summary: "listed", data: [] })));
    const res = await registry.call("get_capabilities", {}, { source: "agent" });
    expect(res.ok).toBe(true);
    const data = res.data as { groups: Record<string, string[]>; count: number };
    expect(data.groups["read"]).toContain("list_items");
    expect(data.count).toBe(1);
    expect(registry.list().map((d) => d.name)).toContain("get_capabilities");
  });

  it("invalid args never call the handler", async () => {
    const { registry } = harness();
    const handler = vi.fn(() => ({ ok: true as const, summary: "ok" }));
    registry.register(changeDescriptor(handler));
    const res = await registry.call("add_item", { item: 5 }, { source: "agent" });
    expect(res.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(res.error?.next).toMatch(/get_capabilities/);
  });

  it("unknown actions suggest get_capabilities and record ok:false", async () => {
    const { registry, trace } = harness();
    const res = await registry.call("nope_action", {}, { source: "agent" });
    expect(res).toMatchObject({
      ok: false,
      summary: "Unknown action nope_action.",
      error: { message: "unknown action", next: "get_capabilities" },
    });
    expect(trace.entries().at(-1)).toMatchObject({ name: "nope_action", ok: false });
  });

  it("stale expectedRevision fails with the exact message", async () => {
    const { registry } = harness();
    registry.register({
      ...changeDescriptor(() => ({ ok: true, summary: "ok" })),
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: "string", description: "Item name" },
          expectedRevision: { type: "integer", description: "Revision the caller saw" },
        },
        required: ["item"],
      },
    });
    const res = await registry.call("add_item", { item: "a", expectedRevision: 99 }, { source: "agent" });
    expect(res.ok).toBe(false);
    expect(res.error?.message).toMatch(/^stale revision: the model is at 0;/);
    expect(res.error?.next).toMatch(/expectedRevision 0/);
  });

  it("handler failure restores the snapshot", async () => {
    const { registry, store } = harness();
    registry.register({
      ...changeDescriptor(() => {
        throw new Error("handler blew up");
      }),
    });
    const before = store.snapshot();
    const res = await registry.call("add_item", { item: "a" }, { source: "agent" });
    expect(res.ok).toBe(false);
    expect(store.getState()).toEqual(before.model);
    expect(store.revision()).toBe(before.revision);
  });

  it("destructive actions wait for the gate; rejection returns the exact message", async () => {
    const { registry, gate, store } = harness();
    registry.register({
      name: "drop_item",
      title: "Drop item",
      group: "change",
      description: "Drops an item forever. Needs approval. Example: drop_item({\"item\": \"a\"}).",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { item: { type: "string", description: "Item name" } },
        required: ["item"],
      },
      annotations: { readOnly: false, destructive: true, untrustedContent: false },
      summarize: (args) => `drop ${(args as { item: string }).item}`,
      handler: () => ({ ok: true, summary: "dropped" }),
    });
    const pending = registry.call("drop_item", { item: "a" }, { source: "agent" });
    await vi.waitFor(() => expect(gate.pending().length).toBe(1));
    gate.decide(gate.pending()[0]?.id as string, "rejected");
    const res = await pending;
    expect(res.ok).toBe(false);
    expect(res.error?.message).toBe('The human declined "drop a". Ask what to do instead.');
    expect(store.revision()).toBe(0);
  });

  it("verify actions carry truth in data and the entry", async () => {
    const { registry, trace } = harness();
    registry.register({
      name: "check_items",
      title: "Check items",
      group: "verify",
      description: "Checks the model for issues. Run after changes. Example: check_items({}).",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      annotations: { readOnly: true, destructive: false, untrustedContent: false },
      handler: () => ({ ok: true, summary: "checked" }),
    });
    const res = await registry.call("check_items", {}, { source: "agent" });
    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ truth: { errors: 1, warnings: 0 } });
    expect(trace.entries().at(-1)).toMatchObject({ truth: { errors: 1, warnings: 0 } });
  });

  it("validNextActions honours preconditions", async () => {
    const { registry } = harness();
    registry.register({
      ...changeDescriptor(() => ({ ok: true, summary: "ok" })),
      precondition: (m: Model) => m.items.length > 0,
    });
    const empty = await registry.call("get_capabilities", {}, { source: "agent" });
    expect((empty.data as { groups: Record<string, string[]> }).groups).toBeDefined();
    const res = await registry.call("add_item", { item: "a" }, { source: "human" });
    expect(res.validNextActions).not.toContain("get_capabilities");
  });

  it("dynamic actions appear only while dynamicWhile holds and onChange fires", async () => {
    const { registry, store } = harness();
    const seen: string[][] = [];
    registry.onChange((names) => seen.push(names));
    registry.register({
      ...changeDescriptor(() => ({ ok: true, summary: "ok" })),
      name: "act_selected",
      title: "Act selected",
      dynamicWhile: (m: Model) => m.items.length > 0,
    });
    expect(seen.length).toBe(1);
    expect(registry.list().map((d) => d.name)).not.toContain("act_selected");
    store.dispatch("push", { item: "x" }, "human");
    expect(registry.list().map((d) => d.name)).toContain("act_selected");
  });
});
