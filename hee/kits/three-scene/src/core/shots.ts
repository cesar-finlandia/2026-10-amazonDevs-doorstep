// Requirement IDs: HEE-KIT-01
import type { SceneDescription, SceneEntity, Vec3 } from "./scene-description.js";

export interface ShotDef { name: string; position: Vec3; target: Vec3; durationMs?: number /* 600–1200, default 900 */ }

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalise(v: Vec3): Vec3 {
  const len = length(v);
  if (len === 0) return [0, 0, 0];
  return scale(v, 1 / len);
}

export function entityCentre(e: SceneEntity): Vec3 {
  return [e.position[0] + e.size[0] / 2, e.position[1] + e.size[1] / 2, e.position[2] + e.size[2] / 2];
}

export function boundsCentre(bounds: SceneDescription["bounds"]): Vec3 {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

export function boundsDiagonal(bounds: SceneDescription["bounds"]): number {
  return length(sub(bounds.max, bounds.min));
}

export function shotForEntity(e: SceneEntity, bounds: SceneDescription["bounds"]): ShotDef {
  void bounds;
  const centre = entityCentre(e);
  const distance = Math.max(e.size[0], e.size[1], e.size[2]) * 3 + 2;
  const position = add(centre, scale(normalise([1, 0.8, 1]), distance));
  return { name: `focus:${e.id}`, position, target: centre, durationMs: 900 };
}

export function defaultShots(bounds: SceneDescription["bounds"]): ShotDef[] {
  const centre = boundsCentre(bounds);
  const diag = boundsDiagonal(bounds);
  const direction = normalise([1, 0.9, 1]);
  const overviewDistance = diag * 0.9;
  return [
    {
      name: "overview",
      position: add(centre, scale(direction, overviewDistance)),
      target: centre,
      durationMs: 900,
    },
    {
      name: "detail",
      position: add(centre, scale(direction, overviewDistance * 0.45)),
      target: centre,
      durationMs: 900,
    },
  ];
}

export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function interpolateCamera(from: { position: Vec3; target: Vec3 }, to: { position: Vec3; target: Vec3 }, t: number): { position: Vec3; target: Vec3 } {
  const e = easeInOutCubic(t);
  return {
    position: [
      lerp(from.position[0], to.position[0], e),
      lerp(from.position[1], to.position[1], e),
      lerp(from.position[2], to.position[2], e),
    ],
    target: [
      lerp(from.target[0], to.target[0], e),
      lerp(from.target[1], to.target[1], e),
      lerp(from.target[2], to.target[2], e),
    ],
  };
}
