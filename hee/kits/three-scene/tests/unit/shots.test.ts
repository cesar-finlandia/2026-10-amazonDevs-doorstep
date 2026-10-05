// Requirement IDs: HEE-KIT-01
import { describe, expect, it } from "vitest";
import {
  defaultShots,
  easeInOutCubic,
  interpolateCamera,
  shotForEntity,
} from "../../src/core/shots.js";
import type { SceneEntity } from "../../src/core/scene-description.js";

const bounds = { min: [0, 0, 0] as [number, number, number], max: [10, 4, 8] as [number, number, number] };

const entity: SceneEntity = {
  id: "widget-1",
  kind: "box",
  position: [1, 0, 2],
  size: [2, 1, 1],
  material: { token: "primary" },
};

describe("shots", () => {
  it("easeInOutCubic hits 0, 0.5 and 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it("interpolateCamera at t=0 equals from and t=1 equals to", () => {
    const from = { position: [0, 0, 0] as [number, number, number], target: [1, 1, 1] as [number, number, number] };
    const to = { position: [4, 5, 6] as [number, number, number], target: [7, 8, 9] as [number, number, number] };
    expect(interpolateCamera(from, to, 0)).toEqual(from);
    expect(interpolateCamera(from, to, 1)).toEqual(to);
  });

  it("defaultShots returns overview and detail", () => {
    expect(defaultShots(bounds).map((s) => s.name)).toEqual(["overview", "detail"]);
  });

  it("shotForEntity is named focus:<id>", () => {
    expect(shotForEntity(entity, bounds).name).toBe("focus:widget-1");
  });
});
