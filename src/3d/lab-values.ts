// src/3d/lab-values.ts — read the lab's current values and format them (DP-3D §3).
// The values live in leva's store under paths such as "Light.keyIntensity"; they
// are flattened by the last path segment. Without a mounted panel the store has
// no such paths and the kit's defaults answer.
// Requirement IDs: FR-20
import { levaStore } from "leva";
import { DEFAULT_LAB_TUNING } from "src/kits/three-scene/src/react/index.js";
import type { LabTuning } from "src/kits/three-scene/src/react/index.js";

export function readLabValues(): LabTuning {
  const data = levaStore.getData() as Record<string, { value?: unknown } | undefined>;
  const byLeaf = new Map<string, unknown>();
  for (const [path, entry] of Object.entries(data)) {
    if (entry === undefined || entry.value === undefined) continue;
    byLeaf.set(path.slice(path.lastIndexOf(".") + 1), entry.value);
  }
  const out: LabTuning = { ...DEFAULT_LAB_TUNING };
  for (const key of Object.keys(DEFAULT_LAB_TUNING) as (keyof LabTuning)[]) {
    const v = Number(byLeaf.get(key));
    if (byLeaf.has(key) && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/** JSON, two-space indent, keys in the order of DEFAULT_LAB_TUNING, no trailing newline. */
export function formatLabValues(v: LabTuning): string {
  const ordered: Record<string, number> = {};
  for (const key of Object.keys(DEFAULT_LAB_TUNING) as (keyof LabTuning)[]) ordered[key] = v[key];
  return JSON.stringify(ordered, null, 2);
}
