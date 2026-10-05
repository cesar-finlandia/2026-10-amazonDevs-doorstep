// src/3d/look.ts — per-material roughness and metalness (DP-3D §5.2).
// The values the /lab page writes back. Keys are MATERIAL_TOKENS of adapter.ts.
// Requirement IDs: FR-20
import type { MATERIAL_TOKENS } from "src/3d/adapter.js";

export const LOOK: Record<
  (typeof MATERIAL_TOKENS)[number],
  { roughness: number; metalness: number }
> = {
  wall: { roughness: 0.9, metalness: 0.0 },
  door: { roughness: 0.55, metalness: 0.1 },
  stoop: { roughness: 0.85, metalness: 0.0 },
  frustum: { roughness: 0.2, metalness: 0.0 },
  pillar: { roughness: 0.7, metalness: 0.05 },
  "pillar-warn": { roughness: 0.5, metalness: 0.05 },
  "pillar-danger": { roughness: 0.5, metalness: 0.05 },
  "pillar-dup": { roughness: 0.6, metalness: 0.05 },
  gap: { roughness: 0.9, metalness: 0.0 },
  resolved: { roughness: 0.5, metalness: 0.05 },
  arc: { roughness: 0.35, metalness: 0.1 },
};
