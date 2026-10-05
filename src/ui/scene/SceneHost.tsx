// src/ui/scene/SceneHost.tsx — the hero slot (DP-UI §6.9).
// DP-3D owns src/3d/* and drops DoorwayScene.tsx into this slot; an empty glob
// (or no WebGL, or ?scene=off) renders the flat-week fallback instead.
// Requirement IDs: FR-19
import { Component, Suspense, lazy, useState } from "react";
import { useApp } from "../state/SessionProvider.js";
import { notSupported3d } from "../copy/templates.js";
import { Message } from "../primitives/Message.js";

type SceneProps = { session: unknown; className?: string };
type SceneLoader = () => Promise<{ default: (props: SceneProps) => React.JSX.Element }>;

/** The DoorwayScene loader when the glob found it, else null. With two
 *  entries the one ending in DoorwayScene.tsx wins. */
export function pickScene(glob: Record<string, SceneLoader>): SceneLoader | null {
  const keys = Object.keys(glob ?? {});
  if (keys.length === 0) return null;
  const hit = keys.find((k) => k.endsWith("DoorwayScene.tsx")) ?? keys[0];
  return (glob[hit as string] as SceneLoader | undefined) ?? null;
}

/** True when a canvas can open a GL context. A factory may be injected (tests). */
export function canWebGL(
  canvasFactory?: () => { getContext: (kind: string) => unknown } | null,
): boolean {
  try {
    const canvas = canvasFactory ? canvasFactory() : document.createElement("canvas");
    if (!canvas) return false;
    return canvas.getContext("webgl") !== null;
  } catch {
    return false;
  }
}

const loaders = import.meta.glob("/src/3d/DoorwayScene.tsx") as Record<string, SceneLoader>;

export function SceneHost(): React.JSX.Element {
  const { session } = useApp();
  const [failed, setFailed] = useState(false);
  const forcedOff = typeof location !== "undefined" && new URLSearchParams(location.search).get("scene") === "off";
  const load = pickScene(loaders);
  if (forcedOff || !load || failed || !canWebGL()) {
    // A structured callout (glyph + title + body), not bare text: the
    // fallback is a system state with a home (visual review round 2,
    // defect 2). Texts and the data-demo-3d marker are unchanged.
    const msg = notSupported3d();
    return (
      <div className="scene-fallback" data-demo-3d="unavailable">
        <Message tier="callout" tone="info" title={msg.title} detail={msg.detail} />
      </div>
    );
  }
  const Scene = lazy(load);
  return (
    <div className="scene-live">
      <SceneErrorBoundary onFail={() => setFailed(true)}>
        <Suspense fallback={null}>
          <Scene session={session} className="scene-host__canvas" />
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: React.ReactNode; onFail(): void }> {
  componentDidCatch(): void {
    this.props.onFail();
  }

  render(): React.ReactNode {
    return this.props.children;
  }
}
