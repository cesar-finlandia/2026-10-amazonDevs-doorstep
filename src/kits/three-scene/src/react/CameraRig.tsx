// Requirement IDs: HEE-KIT-01
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type { ShotDef } from "../core/shots.js";
import type { LabTuning } from "./LabPanel.js";

export interface CameraApi {
  play(name: string): void;
  invalidate(): void;
}

interface TransitionControls {
  setLookAt(
    px: number, py: number, pz: number,
    tx: number, ty: number, tz: number,
    enableTransition: boolean,
  ): Promise<void> | void;
  smoothTime: number;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface CameraRigProps {
  shots: ShotDef[];
  selectedId?: string | null;
  apiRef: MutableRefObject<CameraApi | null>;
  tuning?: Pick<LabTuning, "fov">;
}

export function CameraRig({ shots, selectedId, apiRef, tuning }: CameraRigProps): React.JSX.Element {
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as TransitionControls | null;
  const live = useRef({ shots, controls, invalidate });
  live.current = { shots, controls, invalidate };

  useEffect(() => {
    const fov = tuning?.fov;
    if (fov === undefined) return;
    const cam = camera as unknown as { fov?: number; updateProjectionMatrix?: () => void };
    if (typeof cam.fov === "number" && typeof cam.updateProjectionMatrix === "function") {
      cam.fov = fov;
      cam.updateProjectionMatrix();
      invalidate();
    }
  }, [tuning?.fov, camera, invalidate]);

  useEffect(() => {
    apiRef.current = {
      play(name: string): void {
        const { shots: list, controls: ctl, invalidate: inv } = live.current;
        const shot = list.find((s) => s.name === name);
        if (!shot || !ctl) return;
        const duration = (shot.durationMs ?? 900) / 1000;
        const reduce = reducedMotion();
        try {
          ctl.smoothTime = reduce ? 0 : duration / 3;
          const r = ctl.setLookAt(
            shot.position[0], shot.position[1], shot.position[2],
            shot.target[0], shot.target[1], shot.target[2],
            !reduce,
          );
          if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => undefined);
        } catch {
          /* camera move failures never break the scene */
        }
        // On-demand rendering: keep drawing until the move ends.
        const end = performance.now() + duration * 1000 + 400;
        const loop = (): void => {
          inv();
          if (performance.now() < end) requestAnimationFrame(loop);
        };
        loop();
      },
      invalidate(): void {
        live.current.invalidate();
      },
    };
  }, [apiRef]);

  useEffect(() => {
    // Selection from outside: frame the entity (jumps under reduced motion).
    if (selectedId) apiRef.current?.play(`focus:${selectedId}`);
  }, [selectedId, apiRef]);

  // No auto-orbit exists to clamp: under prefers-reduced-motion every move jumps.
  return <CameraControls makeDefault />;
}
