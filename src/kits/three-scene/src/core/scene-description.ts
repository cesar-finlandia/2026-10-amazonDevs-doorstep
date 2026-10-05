// Requirement IDs: HEE-KIT-01
export type Vec3 = [number, number, number];

export interface SceneEntity {
  id: string;                                   // equals the domain entity id (selection links 3D ↔ 2D ↔ feed)
  kind: "box" | "cylinder" | "sphere" | "plane" | "extrusion" | "instanced" | "custom";
  position: Vec3;                               // metres
  size: Vec3;                                   // box: w,h,d; cylinder: r,h,r; sphere: r,r,r; plane: w,0,d
  rotationY?: number;                           // radians
  polygon?: [number, number][];                 // extrusion footprint (x,z) metres; height = size[1]
  instances?: { position: Vec3; rotationY?: number; scale?: number }[];   // kind "instanced"
  customKey?: string;                           // kind "custom" → props.renderers[customKey]
  material: { token: keyof ThreeTokens["materials"]; roughness?: number; metalness?: number; opacity?: number };
  label?: string;                               // drawn with drei Text/Html, never baked into a texture
  meta?: Record<string, string | number | boolean>;
}

export interface SceneDescription {
  revision: number;                             // equals the domain store revision
  bounds: { min: Vec3; max: Vec3 };
  entities: SceneEntity[];
}

// Imported only as a type; tokens.ts has no runtime dependency on this file.
import type { ThreeTokens } from "./tokens.js";

function isVec3(v: unknown): v is Vec3 {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function validateSceneDescription(s: unknown): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!s || typeof s !== "object") return { ok: false, errors: ["scene must be an object"] };
  const scene = s as Partial<SceneDescription>;
  if (!scene.bounds || typeof scene.bounds !== "object") {
    errors.push("bounds is required");
  } else {
    const { min, max } = scene.bounds as { min?: unknown; max?: unknown };
    if (!isVec3(min) || !isVec3(max)) {
      errors.push("bounds.min and bounds.max must be finite [x, y, z] triples");
    } else {
      const mins = min as [number, number, number];
      const maxs = max as [number, number, number];
      for (const axis of [0, 1, 2] as const) {
        if (mins[axis] > maxs[axis]) {
          errors.push(`bounds.min[${axis}] must be <= bounds.max[${axis}]`);
        }
      }
    }
  }
  if (!Array.isArray(scene.entities)) {
    errors.push("entities must be an array");
    return errors.length === 0 ? { ok: true } : { ok: false, errors };
  }
  const seen = new Set<string>();
  scene.entities.forEach((e, i) => {
    const where = `entities[${i}]`;
    if (!e || typeof e !== "object") {
      errors.push(`${where} must be an object`);
      return;
    }
    if (typeof e.id !== "string" || e.id.length === 0) {
      errors.push(`${where}.id must be a non-empty string`);
    } else if (seen.has(e.id)) {
      errors.push(`${where}.id "${e.id}" is duplicated`);
    } else {
      seen.add(e.id);
    }
    if (!isVec3(e.position)) errors.push(`${where}.position must be a finite [x, y, z] triple`);
    if (!Array.isArray(e.size) || e.size.length !== 3) {
      errors.push(`${where}.size must be a [w, h, d] triple`);
    } else {
      (e.size as unknown[]).forEach((c, axis) => {
        if (typeof c !== "number" || !Number.isFinite(c) || c < 0) {
          errors.push(`${where}.size[${axis}] must be finite and >= 0`);
        }
      });
    }
    if (e.kind === "extrusion") {
      if (!Array.isArray(e.polygon) || e.polygon.length < 3) {
        errors.push(`${where}.polygon must have at least 3 points for kind "extrusion"`);
      }
    }
    if (e.kind === "instanced") {
      if (!Array.isArray(e.instances) || e.instances.length < 1) {
        errors.push(`${where}.instances must have at least 1 instance for kind "instanced"`);
      }
    }
    if (e.kind === "custom") {
      if (typeof e.customKey !== "string" || e.customKey.length === 0) {
        errors.push(`${where}.customKey is required for kind "custom"`);
      }
    }
    if (!e.material || typeof e.material !== "object") {
      errors.push(`${where}.material is required`);
    } else if (typeof (e.material as { token?: unknown }).token !== "string" || ((e.material as { token: string }).token.length === 0)) {
      errors.push(`${where}.material.token must be a non-empty string`);
    }
  });
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
