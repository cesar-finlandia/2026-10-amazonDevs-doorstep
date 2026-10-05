// Requirement IDs: HEE-KIT-01
import { describe, expect, it } from "vitest";
import { validateSceneDescription } from "../../src/core/scene-description.js";
import type { SceneDescription } from "../../src/core/scene-description.js";

function valid(): SceneDescription {
  return {
    revision: 1,
    bounds: { min: [0, 0, 0], max: [10, 4, 8] },
    entities: [
      { id: "a", kind: "box", position: [0, 0, 0], size: [1, 1, 1], material: { token: "primary" } },
    ],
  };
}

describe("validateSceneDescription", () => {
  it("accepts a valid scene", () => {
    expect(validateSceneDescription(valid())).toEqual({ ok: true });
  });

  it("rejects empty and duplicated ids", () => {
    const s = valid();
    s.entities.push({ id: "", kind: "box", position: [0, 0, 0], size: [1, 1, 1], material: { token: "primary" } });
    expect(validateSceneDescription(s).ok).toBe(false);
    const d = valid();
    d.entities.push({ id: "a", kind: "box", position: [0, 0, 0], size: [1, 1, 1], material: { token: "primary" } });
    const r = validateSceneDescription(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/duplicat/i);
  });

  it("rejects negative and non-finite sizes", () => {
    const s = valid();
    s.entities[0] = { ...s.entities[0]!, size: [1, -2, 1] };
    expect(validateSceneDescription(s).ok).toBe(false);
    const t = valid();
    t.entities[0] = { ...t.entities[0]!, size: [1, Number.NaN, 1] };
    expect(validateSceneDescription(t).ok).toBe(false);
  });

  it("rejects extrusions with fewer than 3 polygon points", () => {
    const s = valid();
    s.entities[0] = {
      id: "e", kind: "extrusion", position: [0, 0, 0], size: [4, 1, 4],
      polygon: [[0, 0], [1, 0]], material: { token: "primary" },
    };
    expect(validateSceneDescription(s).ok).toBe(false);
  });

  it("rejects instanced kinds without instances", () => {
    const s = valid();
    s.entities[0] = {
      id: "i", kind: "instanced", position: [0, 0, 0], size: [1, 1, 1],
      instances: [], material: { token: "primary" },
    };
    expect(validateSceneDescription(s).ok).toBe(false);
  });

  it("rejects custom kinds without customKey", () => {
    const s = valid();
    s.entities[0] = {
      id: "c", kind: "custom", position: [0, 0, 0], size: [1, 1, 1],
      material: { token: "primary" },
    };
    expect(validateSceneDescription(s).ok).toBe(false);
  });

  it("rejects inverted bounds", () => {
    const s = valid();
    s.bounds = { min: [5, 0, 0], max: [1, 4, 8] };
    expect(validateSceneDescription(s).ok).toBe(false);
  });

  it("rejects empty material tokens", () => {
    const s = valid();
    s.entities[0] = {
      id: "a", kind: "box", position: [0, 0, 0], size: [1, 1, 1],
      material: { token: "" as unknown as "primary" },
    };
    expect(validateSceneDescription(s).ok).toBe(false);
  });
});
