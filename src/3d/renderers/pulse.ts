// src/3d/renderers/pulse.ts — the highlight pulse shared by the arc and the flare
// (DP-3D §5.5): emissive intensity 0.3 + 0.3 sin(2π · 1.4 t) for 2.4 s from the
// moment `highlighted` turns true, keeping the on-demand frame loop alive.
// Requirement IDs: FR-20
import { useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

export const PULSE_HZ = 1.4;
export const PULSE_SECONDS = 2.4;

export function usePulse(
  highlighted: boolean,
  ref: RefObject<THREE.MeshStandardMaterial | null>,
  rest: number,
): void {
  const t0 = useRef<number | null>(null);
  useFrame(({ clock, invalidate }) => {
    const mat = ref.current;
    if (!mat) return;
    if (!highlighted) {
      t0.current = null;
      mat.emissiveIntensity = rest;
      return;
    }
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    if (t > PULSE_SECONDS) {
      mat.emissiveIntensity = rest;
      return;
    }
    mat.emissiveIntensity = 0.3 + 0.3 * Math.sin(2 * Math.PI * PULSE_HZ * t);
    invalidate();
  });
}
