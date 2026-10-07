// src/3d/renderers/incident-arc.tsx — the pencil circle of the paper calendar,
// lying flat on its day strip (DP-3D §5.5). Colour is tokens.materials[token].
import { useRef } from "react";
import type * as THREE from "three";
import type { SceneEntity, ThreeTokens } from "src/kits/three-scene/src/react/index.js";
import { usePulse } from "src/3d/renderers/pulse.js";

export interface ArcProps {
  e: SceneEntity;
  selected: boolean;
  highlighted: boolean;
  tokens: ThreeTokens;
}

export function IncidentArc({ e, selected, highlighted, tokens }: ArcProps): React.JSX.Element {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  usePulse(highlighted, mat, 0);
  const depth = e.size[2];
  const color = tokens.materials[e.material.token];
  return (
    <group>
      {/* The group carries the stretch so the ring lies flat as an ellipse along the strip. */}
      <group scale={[1, 1, depth / 1.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.68, selected ? 0.08 : 0.05, 12, 48]} />
          <meshStandardMaterial
            ref={mat}
            color={color}
            emissive={tokens.accent}
            emissiveIntensity={0}
            roughness={e.material.roughness ?? 0.5}
            metalness={e.material.metalness ?? 0.05}
          />
        </mesh>
      </group>
      {/* Hit proxy: a click on the strip inside the circle selects it. */}
      <mesh visible={false} position={[0, 0.05, 0]}>
        <boxGeometry args={[1.4, 0.1, depth]} />
      </mesh>
    </group>
  );
}
