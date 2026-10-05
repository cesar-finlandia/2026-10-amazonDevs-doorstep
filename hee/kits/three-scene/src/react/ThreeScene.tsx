// Requirement IDs: HEE-KIT-01
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneDescription } from "../core/scene-description.js";
import type { ThreeTokens } from "../core/tokens.js";
import type { ShotDef } from "../core/shots.js";
import { defaultShots, shotForEntity } from "../core/shots.js";
import { detectRenderCapability } from "../core/capability.js";
import { installDemoHooks } from "../core/demo-hooks.js";
import { measureFps } from "../core/fps-probe.js";
import type { EntityRenderer } from "./Entities.js";
import { Entities } from "./Entities.js";
import { Lights } from "./Lights.js";
import { Effects } from "./Effects.js";
import type { CameraApi } from "./CameraRig.js";
import { CameraRig } from "./CameraRig.js";
import { Fallback } from "./Fallback.js";
import type { LabTuning } from "./LabPanel.js";
import { LabPanel } from "./LabPanel.js";

export interface ThreeSceneProps {
  scene: SceneDescription;
  tokens: ThreeTokens;
  name: string;                         // value of data-demo-3d
  selectedId?: string | null;
  highlightIds?: string[];              // entities the agent just touched: emissive pulse
  onSelect?: (id: string | null) => void;
  shots?: ShotDef[];                    // defaults to [overview, focus] built from the scene bounds
  renderers?: Record<string, (e: SceneDescription["entities"][number], ctx: { selected: boolean; highlighted: boolean }) => React.ReactNode>;
  quality?: "high" | "low";             // low: no ambient occlusion, dpr 1 (used in headless software GL)
  showLab?: boolean;                    // true on the /lab route
  fallback?: React.ReactNode;           // static image or message
  onReady?: () => void;
}

export function ThreeScene(props: ThreeSceneProps): React.JSX.Element {
  const {
    scene, tokens, name, selectedId, highlightIds, onSelect,
    quality = "high", showLab = false, fallback, onReady,
  } = props;
  const renderers = props.renderers as Record<string, EntityRenderer> | undefined;
  const wrapRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<CameraApi | null>(null);
  const [created, setCreated] = useState(false);
  const [tuning, setTuning] = useState<LabTuning | undefined>(undefined);

  const capability = useMemo(() => detectRenderCapability(), []);
  const hasGl = capability.webgl2 || capability.webgl;

  const baseShots = useMemo(
    () => props.shots ?? defaultShots(scene.bounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.shots, scene.bounds.min[0], scene.bounds.min[1], scene.bounds.min[2], scene.bounds.max[0], scene.bounds.max[1], scene.bounds.max[2]],
  );
  const allShots = useMemo<ShotDef[]>(
    () => [...baseShots, ...scene.entities.map((e) => shotForEntity(e, scene.bounds))],
    [baseShots, scene],
  );
  const shotNames = useMemo(() => allShots.map((s) => s.name), [allShots]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    return installDemoHooks({
      container: el,
      name,
      shots: () => (hasGl ? [...shotNames] : []),
      play: (shot: string): void => {
        apiRef.current?.play(shot);
      },
      fpsProbe: (ms: number): Promise<number> =>
        measureFps(ms, (cb) => requestAnimationFrame(cb), () => apiRef.current?.invalidate()),
    });
  }, [name, hasGl, shotNames]);

  useEffect(() => {
    if (hasGl) onReady?.();
  }, [hasGl, onReady]);

  if (!hasGl) {
    return (
      <div ref={wrapRef}>
        <Fallback custom={fallback} />
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {!created ? <div style={{ color: tokens.text, padding: 16 }}>Loading 3D view…</div> : null}
      {showLab ? <LabPanel onChange={setTuning} /> : null}
      <Canvas
        // "percentage" (PCFShadowMap): three r183+ removed PCFSoftShadowMap,
        // and R3F maps both `shadows` and `shadows="soft"` onto it, which only
        // warns. See UPSTREAM-NOTICE.md.
        shadows="percentage"
        dpr={quality === "low" ? 1 : [1, 2]}
        frameloop="demand"
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          setCreated(true);
          if (quality === "low") {
            // No effect composer in low mode: tone-map on the renderer.
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }
          // High mode keeps NoToneMapping on the renderer: the ToneMapping
          // effect (ACES filmic) in the composer does the mapping instead.
        }}
        onPointerMissed={() => onSelect?.(null)}
      >
        <Suspense fallback={null}>
          {tokens.fog ? <fog attach="fog" args={[tokens.fog.color, tokens.fog.near, tokens.fog.far]} /> : null}
          <color attach="background" args={[tokens.background]} />
          <Lights bounds={scene.bounds} quality={quality} tuning={tuning} />
          <mesh position={[0, scene.bounds.min[1], 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color={tokens.ground} roughness={0.95} metalness={0} />
          </mesh>
          <Entities
            scene={scene}
            tokens={tokens}
            selectedId={selectedId}
            highlightIds={highlightIds}
            onSelect={onSelect}
            renderers={renderers}
            tuning={tuning}
          />
          {quality === "high" ? (
            <Effects
              tuning={tuning}
              diag={Math.sqrt(
                (scene.bounds.max[0] - scene.bounds.min[0]) ** 2 +
                  (scene.bounds.max[1] - scene.bounds.min[1]) ** 2 +
                  (scene.bounds.max[2] - scene.bounds.min[2]) ** 2,
              )}
            />
          ) : null}
          <CameraRig shots={allShots} selectedId={selectedId} apiRef={apiRef} tuning={tuning} />
        </Suspense>
      </Canvas>
    </div>
  );
}
