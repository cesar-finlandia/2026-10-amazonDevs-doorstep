// src/3d/renderers/index.ts — domain geometry as kit `renderers` entries (DP-3D §5.5).
// createRenderers returns all five keys; incident-arc, evidence-flare and
// visit-thread return null until WU-05 replaces them.
// Requirement IDs: FR-20, FR-17
import type { EntityRenderer, ThreeTokens } from "src/kits/three-scene/src/react/index.js";
import { CameraFrustum } from "src/3d/renderers/camera-frustum.js";
import { ProbeBridge } from "src/3d/renderers/probe-bridge.js";

export type RendererKey = "camera-frustum" | "incident-arc" | "evidence-flare" | "visit-thread" | "probe";

export function createRenderers(deps: { tokens: ThreeTokens }): Record<RendererKey, EntityRenderer> {
  const { tokens } = deps;
  return {
    "camera-frustum": (e, ctx) => (
      <CameraFrustum e={e} selected={ctx.selected} highlighted={ctx.highlighted} tokens={tokens} />
    ),
    "incident-arc": () => null,
    "evidence-flare": () => null,
    "visit-thread": () => null,
    probe: () => <ProbeBridge />,
  };
}
