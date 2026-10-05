// src/3d/probe.ts — window.__scene3d, the read-only probe for tests and the
// recorder (DP-3D §5.8). Nothing here mutates the scene and it carries no secret.
// Requirement IDs: NFR-07
import * as THREE from "three";
import type { SceneEntity, ThreeTokens } from "src/kits/three-scene/src/react/index.js";

export interface ProbeData {
  ready: boolean;
  mode: "low" | "high";
  revision: number;
  entities: SceneEntity[];
  selectedId: string | null;
  highlightedIds: string[];
  tokens: ThreeTokens;
}

interface Attached {
  gl: {
    domElement: HTMLCanvasElement;
    info: { render: { calls: number; triangles: number; frame: number }; memory: { geometries: number; textures: number } };
  };
  camera: THREE.Camera;
  controls: { getTarget(target: THREE.Vector3): THREE.Vector3 } | null;
}

let attached: Attached | null = null;

/** Called by renderers/probe-bridge.tsx; the returned function detaches. */
export function attachGl(
  gl: Attached["gl"],
  camera: THREE.Camera,
  controls: unknown,
): () => void {
  const mine: Attached = {
    gl,
    camera,
    controls:
      controls !== null && typeof controls === "object" && "getTarget" in (controls as Record<string, unknown>)
        ? (controls as Attached["controls"])
        : null,
  };
  attached = mine;
  return () => {
    if (attached === mine) attached = null;
  };
}

/** True once the GL bridge has seen a non-null controls object. Camera moves
 *  issued before that instant are silently dropped by the rig, so callers
 *  driving the camera re-issue while this is false. */
export function hasGlControls(): boolean {
  return attached !== null && attached.controls !== null && attached.controls !== undefined;
}

export interface Scene3dProbe {
  ready(): boolean;
  mode(): "low" | "high";
  revision(): number;
  entityCount(): number;
  entityIds(): string[];
  entity(id: string): SceneEntity | undefined;
  selectedId(): string | null;
  highlightedIds(): string[];
  tokens(): ThreeTokens;
  camera(): { position: [number, number, number]; target: [number, number, number] };
  drawCalls(): number;
  triangles(): number;
  frames(): number;
  memory(): { geometries: number; textures: number };
  project(id: string, offset?: [number, number, number]): { x: number; y: number } | null;
}

/** Sets window.__scene3d answering from the latest ProbeData and the attached
 *  GL objects; the returned function removes it. */
export function installProbe(read: () => ProbeData): () => void {
  const build = (): Scene3dProbe => ({
    ready: () => read().ready,
    mode: () => read().mode,
    revision: () => read().revision,
    entityCount: () => read().entities.length,
    entityIds: () => read().entities.map((e) => e.id),
    entity: (id: string) => read().entities.find((e) => e.id === id),
    selectedId: () => read().selectedId,
    highlightedIds: () => [...read().highlightedIds],
    tokens: () => read().tokens,
    camera: () => {
      const a = attached;
      if (!a) return { position: [0, 0, 0], target: [0, 0, 0] };
      const p = a.camera.position;
      const t = a.controls?.getTarget(new THREE.Vector3()) ?? new THREE.Vector3();
      return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
    },
    drawCalls: () => attached?.gl.info.render.calls ?? 0,
    triangles: () => attached?.gl.info.render.triangles ?? 0,
    frames: () => attached?.gl.info.render.frame ?? 0,
    memory: () => ({
      geometries: attached?.gl.info.memory.geometries ?? 0,
      textures: attached?.gl.info.memory.textures ?? 0,
    }),
    project: (id: string, offset?: [number, number, number]) => {
      const a = attached;
      const entity = read().entities.find((e) => e.id === id);
      if (!a || !entity) return null;
      const [ox, oy, oz] = offset ?? [0, 0, 0];
      const point = new THREE.Vector3(
        entity.position[0] + ox,
        entity.position[1] + oy,
        entity.position[2] + oz,
      );
      point.project(a.camera);
      if (point.z > 1 || point.z < -1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return null;
      const rect = a.gl.domElement.getBoundingClientRect();
      // A detached or not-yet-laid-out canvas reports a zero rect: there is no
      // meaningful screen point, so report null instead of a bogus origin.
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: rect.left + ((point.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - point.y) / 2) * rect.height,
      };
    },
  });
  const probe = build();
  (window as unknown as { __scene3d?: Scene3dProbe }).__scene3d = probe;
  return () => {
    const host = window as unknown as { __scene3d?: Scene3dProbe };
    if (host.__scene3d === probe) delete host.__scene3d;
  };
}
