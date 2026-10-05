// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { createDomainStore } from "../../src/store/domainStore.js";
import { createApprovalGate } from "../../src/gate/approvalGate.js";
import { createTraceWriter } from "../../src/trace/traceWriter.js";
import { createRegistry } from "../../src/registry/registry.js";
import { bindRegistryToTransport } from "../../src/adapters/externalAgent.js";
import type { ExternalAgentTransport } from "../../src/adapters/externalAgent.js";
import type { ActionResult } from "../../src/registry/types.js";

function fakeTransport(): ExternalAgentTransport & { names(): string[]; execute(name: string, args: unknown): Promise<ActionResult> } {
  const fns = new Map<string, (args: unknown) => Promise<ActionResult>>();
  return {
    register(d, execute) {
      fns.set(d.name, execute);
    },
    unregister(name) {
      fns.delete(name);
    },
    names() {
      return [...fns.keys()].sort();
    },
    async execute(name: string, args: unknown) {
      const fn = fns.get(name);
      if (!fn) throw new Error(`not bound: ${name}`);
      return fn(args);
    },
  };
}

function readAction() {
  return {
    name: "list_items",
    title: "List items",
    group: "read" as const,
    description: "Lists every item. Read before changing. Example: list_items({}).",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnly: true, destructive: false, untrustedContent: false },
    handler: () => ({ ok: true as const, summary: "listed" }),
  };
}

describe("bindRegistryToTransport", () => {
  it("registers all, follows adds/removes, and unbinds on abort", async () => {
    const store = createDomainStore({ initial: {}, actions: [] });
    const registry = createRegistry({ store, gate: createApprovalGate(), trace: createTraceWriter() });
    registry.register(readAction());
    const transport = fakeTransport();
    const ctl = new AbortController();
    const unbind = bindRegistryToTransport(registry, transport, ctl.signal);
    expect(transport.names()).toEqual(["get_capabilities", "list_items"]);

    registry.register({
      name: "act_selected",
      title: "Act selected",
      group: "change",
      description: "Acts on the selected item. Needs a selection. Example: act_selected({}).",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      annotations: { readOnly: false, destructive: false, untrustedContent: false },
      dynamicWhile: () => true,
      handler: () => ({ ok: true as const, summary: "acted" }),
    });
    expect(transport.names()).toContain("act_selected");

    registry.unregister("act_selected");
    expect(transport.names()).not.toContain("act_selected");

    const res = await transport.execute("list_items", {});
    expect(res.ok).toBe(true);

    ctl.abort();
    expect(transport.names()).toEqual([]);
    unbind();
  });
});
