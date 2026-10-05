// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { createDomainStore } from "../../src/store/domainStore.js";

interface Counter {
  count: number;
}

function counterStore(maxHistory?: number) {
  return createDomainStore<Counter>({
    initial: { count: 0 },
    maxHistory,
    actions: [
      {
        name: "add",
        apply(model, args) {
          const by = (args as { by?: number }).by ?? 1;
          return { model: { count: model.count + by }, entityIds: ["counter"], summary: `added ${by}` };
        },
      },
      {
        name: "explode",
        apply() {
          throw new Error("boom");
        },
      },
    ],
  });
}

describe("domainStore", () => {
  it("dispatch increments the revision by exactly 1", () => {
    const store = counterStore();
    const r0 = store.revision();
    const res = store.dispatch("add", { by: 2 }, "human");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.revision).toBe(r0 + 1);
    expect(store.revision()).toBe(r0 + 1);
    expect(store.getState()).toEqual({ count: 2 });
  });

  it("a failing apply leaves state and revision unchanged", () => {
    const store = counterStore();
    store.dispatch("add", { by: 5 }, "human");
    const before = store.snapshot();
    const res = store.dispatch("explode", {}, "agent");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("boom");
    expect(store.getState()).toEqual(before.model);
    expect(store.revision()).toBe(before.revision);
  });

  it("unknown names report unknown store action", () => {
    const store = counterStore();
    const res = store.dispatch("nope", {}, "human");
    expect(res).toEqual({ ok: false, error: "unknown store action: nope" });
  });

  it("undo restores the previous model and still increments revision", () => {
    const store = counterStore();
    store.dispatch("add", { by: 3 }, "human");
    const revAfterAdd = store.revision();
    const seen: string[] = [];
    store.subscribe((e) => {
      seen.push(e.actionName);
    });
    expect(store.undo()).toBe(true);
    expect(store.getState()).toEqual({ count: 0 });
    expect(store.revision()).toBe(revAfterAdd + 1);
    expect(seen).toEqual(["undo"]);
  });

  it("redo reapplies", () => {
    const store = counterStore();
    store.dispatch("add", { by: 3 }, "human");
    store.undo();
    expect(store.redo()).toBe(true);
    expect(store.getState()).toEqual({ count: 3 });
    expect(store.canRedo()).toBe(false);
  });

  it("history cap drops the oldest", () => {
    const store = counterStore(3);
    for (let i = 0; i < 5; i++) store.dispatch("add", { by: 1 }, "human");
    expect(store.getState()).toEqual({ count: 5 });
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(false);
    expect(store.getState()).toEqual({ count: 2 });
  });
});
