// Requirement IDs: HEE-KIT-01
import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetTokenWarningsForTests, NEUTRAL_DEMO_TOKENS, readTokensFromCss } from "../../src/core/tokens.js";

afterEach(() => {
  __resetTokenWarningsForTests();
  vi.unstubAllGlobals();
});

describe("tokens", () => {
  it("falls back to neutral values and warns once for missing properties", () => {
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = { style: { length: 0, item: () => "" } } as unknown as HTMLElement;
    const first = readTokensFromCss(root);
    expect(first.background).toBe(NEUTRAL_DEMO_TOKENS.background);
    expect(first.materials["primary"]).toBe(NEUTRAL_DEMO_TOKENS.materials["primary"]);
    const countAfterFirst = warn.mock.calls.length;
    expect(countAfterFirst).toBeGreaterThan(0);
    readTokensFromCss(root);
    expect(warn.mock.calls.length).toBe(countAfterFirst);
    warn.mockRestore();
  });

  it("reads custom properties when present", () => {
    const values: Record<string, string> = {
      "--scene-bg": "#111111",
      "--scene-ground": "#222222",
      "--scene-accent": "#333333",
      "--scene-text": "#444444",
      "--scene-mat-primary": "#555555",
    };
    vi.stubGlobal("getComputedStyle", () => ({
      getPropertyValue: (name: string) => values[name] ?? "",
    }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = { style: { length: 0, item: () => "" } } as unknown as HTMLElement;
    const tokens = readTokensFromCss(root);
    expect(tokens.background).toBe("#111111");
    expect(tokens.materials["primary"]).toBe("#555555");
    (console.warn as unknown as { mockRestore(): void }).mockRestore();
  });
});
