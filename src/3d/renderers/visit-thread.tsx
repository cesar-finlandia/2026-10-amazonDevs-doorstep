// src/3d/renderers/visit-thread.tsx — the path of a visit across the cameras it
// passed through, as a lifted curve between the first and last frustum apex
// (DP-3D §5.5).
// Drawn as a thin tube with a basic material, not a drei fat line: a fat line's
// LineMaterial program is freed whenever the last thread goes and recompiled
// whenever one comes back (~26 compiles in one review, 0.5-1.5 s each on a
// software rasteriser, FIX-13); a basic-material mesh shares a program the
// scene already has.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { SceneEntity, ThreeTokens } from "src/kits/three-scene/src/react/index.js";

export interface ThreadProps {
  e: SceneEntity;
  tokens: ThreeTokens;
}

export function VisitThread({ e, tokens }: ThreadProps): React.JSX.Element {
  const m = (e.meta ?? {}) as Record<string, number>;
  const [px, py, pz] = e.position;
  const sx = (m["sx"] ?? 0) - px;
  const sy = (m["sy"] ?? 0) - py;
  const sz = (m["sz"] ?? 0) - pz;
  const ex = (m["ex"] ?? 0) - px;
  const ey = (m["ey"] ?? 0) - py;
  const ez = (m["ez"] ?? 0) - pz;
  const geometry = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sx, sy, sz),
      new THREE.Vector3(0, 0.8, 0),
      new THREE.Vector3(ex, ey, ez),
    );
    return new THREE.TubeGeometry(curve, 24, 0.02, 5, false);
  }, [sx, sy, sz, ex, ey, ez]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={tokens.materials["arc"]} transparent opacity={0.8} />
    </mesh>
  );
}
