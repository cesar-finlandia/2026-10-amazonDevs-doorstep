// src/3d/renderers/index.ts — domain geometry as kit `renderers` entries (DP-3D §5.5).
// createRenderers returns all five keys.
// Requirement IDs: FR-20, FR-17
import type { EntityRenderer, ThreeTokens } from "src/kits/three-scene/src/react/index.js";
import { CameraFrustum } from "src/3d/renderers/camera-frustum.js";
import { EvidenceFlare } from "src/3d/renderers/evidence-flare.js";
import { IncidentArc } from "src/3d/renderers/incident-arc.js";
import { VisitThread } from "src/3d/renderers/visit-thread.js";
import { ProbeBridge } from "src/3d/renderers/probe-bridge.js";
import { SceneLabels } from "src/3d/renderers/scene-labels.js";
import type { SceneLabel } from "src/3d/renderers/scene-labels.js";

export type RendererKey = "camera-frustum" | "incident-arc" | "evidence-flare" | "visit-thread" | "probe" | "scene-labels";

export function createRenderers(deps: { tokens: ThreeTokens; labels?: SceneLabel[]; labelReach?: number }): Record<RendererKey, EntityRenderer> {
  const { tokens, labels = [], labelReach = Infinity } = deps;
  return {
    "camera-frustum": (e, ctx) => (
      <CameraFrustum e={e} selected={ctx.selected} highlighted={ctx.highlighted} tokens={tokens} />
    ),
    "incident-arc": (e, ctx) => (
      <IncidentArc e={e} selected={ctx.selected} highlighted={ctx.highlighted} tokens={tokens} />
    ),
    "evidence-flare": (e, ctx) => (
      <EvidenceFlare e={e} selected={ctx.selected} highlighted={ctx.highlighted} tokens={tokens} />
    ),
    "visit-thread": (e) => <VisitThread e={e} tokens={tokens} />,
    probe: () => <ProbeBridge />,
    "scene-labels": () => <SceneLabels labels={labels} tokens={tokens} reach={labelReach} />,
  };
}
