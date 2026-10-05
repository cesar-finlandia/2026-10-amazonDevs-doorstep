// src/3d/layout.ts — coordinates, pitches and the pillar-height rule (DP-3D §5.1).
// Requirement IDs: FR-20
import type { Vec3 } from "src/kits/three-scene/src/react/index.js";

export const DAY_PITCH = 1.6; // metres between day-strip centres
export const DAY_W = 1.4; // width of a day strip
export const STRIP_LEN = 8; // metres for 24 hours; z = minute / 1440 * STRIP_LEN
export const WALL_Z = -0.5; // the front wall (the street is on its +z side)
export const STRIP_Z0 = 1.6; // z of midnight; the stoop and its step end at z = 1.55
export const PILLAR_DX = 0.2;
export const TICK_DX = -0.45;
export const DUP_DX = -0.2;
export const OUTAGE_DX = 0.55;
export const BOUNDS: { min: Vec3; max: Vec3 } = {
  min: [-6.5, 0, -1.0],
  max: [6.5, 3.6, 10.0],
};

/** (dayIndex - 3) * DAY_PITCH: Monday at x = -4.8, Sunday at x = +4.8. */
export function dayX(dayIndex: number): number {
  return (dayIndex - 3) * DAY_PITCH;
}

/** STRIP_Z0 + minute / 1440 * STRIP_LEN: midnight at z = 1.6, 24:00 at z = 9.6. */
export function minuteZ(minute: number): number {
  return STRIP_Z0 + (minute / 1440) * STRIP_LEN;
}

/** clamp(0.35 + 0.12 * dwellMin, 0.5, 3.0): how long a visit lasted, as pillar height. */
export function pillarHeight(dwellMin: number): number {
  return Math.min(3.0, Math.max(0.5, 0.35 + 0.12 * dwellMin));
}

/** The apex of the frustum a "<deviceId>:<componentId>" hop belongs to. A device
 *  that has no frustum maps to index 0. */
export function hopPosition(hop: string, deviceIds: string[]): Vec3 {
  const sep = hop.lastIndexOf(":");
  const deviceId = sep < 0 ? hop : hop.slice(0, sep);
  const componentId = sep < 0 ? 0 : Number(hop.slice(sep + 1));
  const n = deviceIds.length;
  const rawIndex = deviceIds.indexOf(deviceId);
  const index = rawIndex < 0 ? 0 : rawIndex;
  const comp = Number.isFinite(componentId) ? componentId : 0;
  const x = (index - (n - 1) / 2) * 1.6 + ((comp % 4) - 1.5) * 0.2;
  return [x, 2.3, -0.2];
}
