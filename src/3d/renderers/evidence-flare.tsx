// src/3d/renderers/evidence-flare.tsx — a bright bead above an incident that has
// a snapshot, tied to its strip by a hairline (DP-3D §5.5).
import { useRef } from "react";
import type * as THREE from "three";
import type { SceneEntity, ThreeTokens } from "src/kits/three-scene/src/react/index.js";
import { usePulse } from "src/3d/renderers/pulse.js";

export interface FlareProps {
  e: SceneEntity;
  selected: boolean;
  highlighted: boolean;
  tokens: ThreeTokens;
}

export function EvidenceFlare({ e, highlighted, tokens }: FlareProps): React.JSX.Element {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  usePulse(highlighted, mat, 0.8);
  const color = tokens.materials["arc"];
  const drop = e.position[1] - 0.08;
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <mesh position={[0, -drop / 2, 0]}>
        <cylinderGeometry args={[0.01, 0.01, drop, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
