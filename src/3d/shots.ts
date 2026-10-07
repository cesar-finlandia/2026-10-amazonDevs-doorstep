// src/3d/shots.ts — named camera shots (DP-3D §5.3). OVERVIEW and WALK are the
// literals of §3; shotsForScene adds one focus:<id> shot per entity. This plan
// passes its own focus shots first, so the kit's duplicates (appended after)
// are never reached by play.
// Requirement IDs: FR-20
import type { SceneDescription, SceneEntity, ShotDef, Vec3 } from "src/kits/three-scene/src/react/index.js";
import type { WeekModel } from "src/domain/types.js";
import { toSceneDescription } from "src/3d/adapter.js";
import { dayX } from "src/3d/layout.js";

export const SHOT_IDS = ["overview", "walk"] as const;

export const OVERVIEW: ShotDef = {
  name: "overview",
  // Review round 1: the hero canvas is 16:5, so the week reads best from low and
  // in front of the door, filling the width, rather than from a distant height.
  position: [0, 4.2, 13.0],
  target: [0, 0.5, 4.2],
  durationMs: 900,
};

export const WALK: ShotDef = {
  name: "walk",
  position: [0, 1.65, 0.7],
  target: [0, 1.2, 8.0],
  durationMs: 900,
};

function normalise(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function focusFor(entity: SceneEntity): ShotDef {
  const c = entity.position;
  const at = (dx: number, dy: number, dz: number, tx: number, ty: number, tz: number): ShotDef => ({
    name: `focus:${entity.id}`,
    position: [c[0] + dx, c[1] + dy, c[2] + dz],
    target: [tx, ty, tz],
    durationMs: 900,
  });
  const id = entity.id;
  if (id.startsWith("day:")) {
    const i = Number(id.slice(4));
    return { name: `focus:${id}`, position: [dayX(i) + 4.2, 4.0, 0.6], target: [dayX(i), 0.4, 5.6], durationMs: 900 };
  }
  if (id.startsWith("inc-")) {
    return at(3.0, 2.8 + 0.3, 3.4, c[0], c[1] + 0.3, c[2]);
  }
  if (id.startsWith("vis:")) {
    return at(1.8, 1.6, 2.4, c[0], c[1], c[2]);
  }
  if (id.startsWith("flare:") || id.startsWith("thread:")) {
    return at(2.2, 1.8, 2.6, c[0], c[1], c[2]);
  }
  if (id.startsWith("dev-")) {
    return {
      name: `focus:${id}`,
      position: [c[0] + 2.4, 3.0, 3.2],
      target: [c[0], 2.3, 1.4],
      durationMs: 900,
    };
  }
  const n = normalise([0.6, 0.45, 0.65]);
  const distance = Math.min(Math.max(entity.size[0], entity.size[1], entity.size[2]) * 2 + 3, 14);
  return {
    name: `focus:${id}`,
    position: [c[0] + n[0] * distance, c[1] + n[1] * distance, c[2] + n[2] * distance],
    target: [c[0], c[1], c[2]],
    durationMs: 900,
  };
}

/** [OVERVIEW, WALK, ...one focus:<id> per entity]. */
export function shotsForScene(scene: SceneDescription): ShotDef[] {
  return [OVERVIEW, WALK, ...scene.entities.map(focusFor)];
}

export function shotList(model: WeekModel): ShotDef[] {
  return shotsForScene(toSceneDescription(model));
}
