// src/3d/renderers/camera-frustum.tsx — the door camera's watch volume (DP-3D §5.5).
// A four-sided cone with its apex at the camera and its base 3.4 m out, plus a
// small sphere at the apex. Every colour is the tokens passed to createRenderers.
import * as THREE from "three";
import type { SceneEntity, ThreeTokens } from "src/kits/three-scene/src/react/index.js";

export interface FrustumProps {
  e: SceneEntity;
  selected: boolean;
  highlighted: boolean;
  tokens: ThreeTokens;
}

export function CameraFrustum({ e, selected, highlighted, tokens }: FrustumProps): React.JSX.Element {
  const meta = (e.meta ?? {}) as Record<string, unknown>;
  const online = meta["online"] !== false;
  const color = online ? tokens.materials["frustum"] : tokens.materials["gap"];
  const opacity = (online ? 0.18 : 0.08) + (selected ? 0.06 : 0);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.7]}>
        <coneGeometry args={[0.9, 3.4, 4]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color={tokens.materials["door"]} />
      </mesh>
      {highlighted ? <pointLight color={tokens.accent} intensity={0.6} distance={2.5} /> : null}
    </group>
  );
}
