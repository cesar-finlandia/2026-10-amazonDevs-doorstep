// Requirement IDs: HEE-KIT-01
import { afterEach, describe, expect, it, vi } from "vitest";
import { installDemoHooks } from "../../src/core/demo-hooks.js";

function fakeContainer(): HTMLElement {
  const attrs = new Map<string, string>();
  return {
    setAttribute: (k: string, v: string): void => {
      attrs.set(k, v);
    },
    removeAttribute: (k: string): void => {
      attrs.delete(k);
    },
    getAttribute: (k: string): string | null => attrs.get(k) ?? null,
  } as unknown as HTMLElement;
}

afterEach(() => {
  delete (globalThis as { __demo3d?: unknown }).__demo3d;
  vi.restoreAllMocks();
});

describe("demo hooks", () => {
  it("sets the attribute and exposes shots", () => {
    const container = fakeContainer();
    let names = ["overview"];
    const uninstall = installDemoHooks({
      container,
      name: "widget-bay",
      shots: () => names,
      play: () => undefined,
      fpsProbe: async () => 60,
    });
    expect(container.getAttribute("data-demo-3d")).toBe("widget-bay");
    expect((globalThis as unknown as { __demo3d: { shots: string[] } }).__demo3d.shots).toEqual(["overview"]);
    names = ["overview", "detail"];
    expect((globalThis as unknown as { __demo3d: { shots: string[] } }).__demo3d.shots).toEqual(["overview", "detail"]);
    uninstall();
  });

  it("play on an unknown name does not throw", () => {
    const container = fakeContainer();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const uninstall = installDemoHooks({
      container,
      name: "widget-bay",
      shots: () => ["overview"],
      play: () => undefined,
      fpsProbe: async () => 60,
    });
    expect(() => (globalThis as unknown as { __demo3d: { play(s: string): void } }).__demo3d.play("nope")).not.toThrow();
    expect(warn).toHaveBeenCalledWith("[three-scene] unknown shot: nope");
    uninstall();
  });

  it("uninstall removes window.__demo3d", () => {
    const container = fakeContainer();
    const uninstall = installDemoHooks({
      container,
      name: "widget-bay",
      shots: () => ["overview"],
      play: () => undefined,
      fpsProbe: async () => 60,
    });
    expect((globalThis as { __demo3d?: unknown }).__demo3d).toBeDefined();
    uninstall();
    expect((globalThis as { __demo3d?: unknown }).__demo3d).toBeUndefined();
    expect(container.getAttribute("data-demo-3d")).toBeNull();
  });
});
