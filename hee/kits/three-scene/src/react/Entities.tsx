// Requirement IDs: HEE-KIT-01
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import type { SceneDescription, SceneEntity } from "../core/scene-description.js";
import type { ThreeTokens } from "../core/tokens.js";
import { boundsDiagonal, entityCentre } from "../core/shots.js";
import type { LabTuning } from "./LabPanel.js";

export type EntityRenderer = (
  e: SceneEntity,
  ctx: { selected: boolean; highlighted: boolean },
) => React.ReactNode;

export interface MaterialTuning {
  roughness?: number;
  metalness?: number;
}

export interface EntitiesProps {
  scene: SceneDescription;
  tokens: ThreeTokens;
  selectedId?: string | null;
  highlightIds?: string[];
  onSelect?: (id: string | null) => void;
  renderers?: Record<string, EntityRenderer>;
  tuning?: Pick<LabTuning, "roughness" | "metalness">;
}

function materialProps(
  e: SceneEntity,
  tokens: ThreeTokens,
  selected: boolean,
  tuning?: Pick<LabTuning, "roughness" | "metalness">,
): { color: string; roughness: number; metalness: number; emissive: string; emissiveIntensity: number; transparent: boolean; opacity: number } {
  return {
    color: tokens.materials[e.material.token] ?? "#808080",
    roughness: e.material.roughness ?? tuning?.roughness ?? 0.6,
    metalness: e.material.metalness ?? tuning?.metalness ?? 0.05,
    emissive: selected ? tokens.accent : "#000000",
    emissiveIntensity: selected ? 0.35 : 0,
    transparent: (e.material.opacity ?? 1) < 1,
    opacity: e.material.opacity ?? 1,
  };
}

function Pulse({ color }: { color: string }): React.JSX.Element {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const t0 = useRef<number>(-1);
  useFrame((state) => {
    const mat = ref.current;
    if (!mat) return;
    if (t0.current < 0) t0.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - t0.current;
    if (t > 2.4) {
      mat.emissiveIntensity = 0;
      return;
    }
    mat.emissiveIntensity = 0.3 + 0.3 * Math.sin(2 * Math.PI * 1.4 * t);
    state.invalidate();
  });
  return <meshStandardMaterial ref={ref} emissive={color} emissiveIntensity={0} toneMapped={false} />;
}

function EntityLabel({ entity, diag, tokens }: { entity: SceneEntity; diag: number; tokens: ThreeTokens }): React.JSX.Element | null {
  const divRef = useRef<HTMLDivElement>(null);
  const centre = useMemo(() => entityCentre(entity), [entity]);
  useFrame(({ camera }) => {
    const el = divRef.current;
    if (!el) return;
    const d = camera.position.distanceTo(new THREE.Vector3(centre[0], centre[1], centre[2]));
    el.style.display = d <= diag * 0.9 ? "" : "none";
  });
  if (!entity.label) return null;
  return (
    <Html center distanceFactor={10}>
      <div ref={divRef} style={{ color: tokens.text, fontSize: 12, whiteSpace: "nowrap" }}>
        {entity.label}
      </div>
    </Html>
  );
}

const extrusionCache = new WeakMap<SceneEntity, THREE.ExtrudeGeometry>();
function extrusionGeometry(entity: SceneEntity): THREE.ExtrudeGeometry {
  const cached = extrusionCache.get(entity);
  if (cached) return cached;
  const shape = new THREE.Shape();
  const polygon = entity.polygon ?? [];
  polygon.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: entity.size[1], bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  extrusionCache.set(entity, geo);
  return geo;
}

function PrimitiveMesh({
  entity,
  tokens,
  selected,
  highlighted,
  onSelect,
  diag,
  tuning,
}: {
  entity: SceneEntity;
  tokens: ThreeTokens;
  selected: boolean;
  highlighted: boolean;
  onSelect?: (id: string | null) => void;
  diag: number;
  tuning?: Pick<LabTuning, "roughness" | "metalness">;
}): React.JSX.Element {
  const mat = materialProps(entity, tokens, selected, tuning);
  const [w, h, d] = entity.size;
  return (
    <mesh
      position={entity.position}
      rotation={[0, entity.rotationY ?? 0, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(entity.id);
      }}
    >
      {entity.kind === "cylinder" ? (
        <cylinderGeometry args={[w, d, h, 24]} />
      ) : entity.kind === "sphere" ? (
        <sphereGeometry args={[w, 24, 18]} />
      ) : entity.kind === "plane" ? (
        <planeGeometry args={[w, d]} />
      ) : entity.kind === "extrusion" ? (
        <primitive object={extrusionGeometry(entity)} attach="geometry" />
      ) : (
        <boxGeometry args={[w, h, d]} />
      )}
      <meshStandardMaterial
        color={mat.color}
        roughness={mat.roughness}
        metalness={mat.metalness}
        emissive={mat.emissive}
        emissiveIntensity={mat.emissiveIntensity}
        transparent={mat.transparent}
        opacity={mat.opacity}
      />
      {highlighted ? <Pulse color={tokens.accent} /> : null}
      {selected ? <Edges color={tokens.accent} /> : null}
      <EntityLabel entity={entity} diag={diag} tokens={tokens} />
    </mesh>
  );
}

function InstancedGroup({
  entity,
  tokens,
  selected,
  onSelect,
  diag,
  tuning,
}: {
  entity: SceneEntity;
  tokens: ThreeTokens;
  selected: boolean;
  onSelect?: (id: string | null) => void;
  diag: number;
  tuning?: Pick<LabTuning, "roughness" | "metalness">;
}): React.JSX.Element {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = entity.instances?.length ?? 0;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    (entity.instances ?? []).forEach((inst, i) => {
      q.setFromAxisAngle(up, inst.rotationY ?? 0);
      const s = inst.scale ?? 1;
      m.compose(
        new THREE.Vector3(inst.position[0], inst.position[1], inst.position[2]),
        q,
        new THREE.Vector3(s, s, s),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [entity]);
  const mat = materialProps(entity, tokens, selected, tuning);
  return (
    <group
      position={entity.position}
      rotation={[0, entity.rotationY ?? 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(entity.id);
      }}
    >
      <instancedMesh ref={ref} args={[undefined, undefined, Math.max(count, 1)]} castShadow receiveShadow>
        <boxGeometry args={[entity.size[0], entity.size[1], entity.size[2]]} />
        <meshStandardMaterial
          color={mat.color}
          roughness={mat.roughness}
          metalness={mat.metalness}
          emissive={mat.emissive}
          emissiveIntensity={mat.emissiveIntensity}
        />
      </instancedMesh>
      {selected ? <Edges color={tokens.accent} /> : null}
      <EntityLabel entity={entity} diag={diag} tokens={tokens} />
    </group>
  );
}

export function Entities({ scene, tokens, selectedId, highlightIds, onSelect, renderers, tuning }: EntitiesProps): React.JSX.Element {
  const diag = boundsDiagonal(scene.bounds);
  return (
    <group>
      {scene.entities.map((e) =>
        e.kind === "custom" && e.customKey && renderers?.[e.customKey] ? (
          <group
            key={e.id}
            position={e.position}
            rotation={[0, e.rotationY ?? 0, 0]}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect?.(e.id);
            }}
          >
            {(renderers[e.customKey] as EntityRenderer)(e, {
              selected: selectedId === e.id,
              highlighted: (highlightIds ?? []).includes(e.id),
            })}
            {selectedId === e.id ? <Edges color={tokens.accent} /> : null}
            <EntityLabel entity={e} diag={diag} tokens={tokens} />
          </group>
        ) : e.kind === "instanced" ? (
          <InstancedGroup
            key={e.id}
            entity={e}
            tokens={tokens}
            selected={selectedId === e.id}
            onSelect={onSelect}
            diag={diag}
            tuning={tuning}
          />
        ) : (
          <PrimitiveMesh
            key={e.id}
            entity={e}
            tokens={tokens}
            selected={selectedId === e.id}
            highlighted={(highlightIds ?? []).includes(e.id)}
            onSelect={onSelect}
            diag={diag}
            tuning={tuning}
          />
        ),
      )}
    </group>
  );
}
