// Requirement IDs: HEE-KIT-01
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { SceneDescription, SceneEntity, Vec3 } from "../core/scene-description.js";
import type { ThreeTokens } from "../core/tokens.js";
import type { ShotDef } from "../core/shots.js";
import { defaultShots, easeInOutCubic, interpolateCamera, shotForEntity } from "../core/shots.js";
import { installDemoHooks } from "../core/demo-hooks.js";
import { measureFps } from "../core/fps-probe.js";

export interface VanillaSceneHandle {
  update(scene: SceneDescription): void;
  select(id: string | null): void;
  highlight(ids: string[]): void;
  play(shot: string): void;
  fpsProbe(ms: number): Promise<number>;
  dispose(): void;
}

export interface VanillaSceneOptions {
  tokens: ThreeTokens;
  name: string;
  shots?: ShotDef[];
  quality?: "high" | "low";
  onSelect?: (id: string | null) => void;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildMesh(entity: SceneEntity, tokens: ThreeTokens): THREE.Object3D {
  const color = tokens.materials[entity.material.token] ?? "#808080";
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: entity.material.roughness ?? 0.6,
    metalness: entity.material.metalness ?? 0.05,
    transparent: (entity.material.opacity ?? 1) < 1,
    opacity: entity.material.opacity ?? 1,
  });
  const group = new THREE.Group();
  group.position.set(entity.position[0], entity.position[1], entity.position[2]);
  group.rotation.y = entity.rotationY ?? 0;
  group.userData["entityId"] = entity.id;
  const add = (mesh: THREE.Mesh): void => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material = material;
    mesh.userData["entityId"] = entity.id;
    group.add(mesh);
  };
  const [w, h, d] = entity.size;
  switch (entity.kind) {
    case "cylinder":
      add(new THREE.Mesh(new THREE.CylinderGeometry(w, d, h, 24)));
      break;
    case "sphere":
      add(new THREE.Mesh(new THREE.SphereGeometry(w, 24, 18)));
      break;
    case "plane":
      add(new THREE.Mesh(new THREE.PlaneGeometry(w, d)));
      break;
    case "extrusion": {
      const shape = new THREE.Shape();
      (entity.polygon ?? []).forEach(([x, z], i) => {
        if (i === 0) shape.moveTo(x, -z);
        else shape.lineTo(x, -z);
      });
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: entity.size[1], bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      add(new THREE.Mesh(geo));
      break;
    }
    case "instanced": {
      const base = new THREE.BoxGeometry(w, h, d);
      const count = Math.max(entity.instances?.length ?? 0, 1);
      const inst = new THREE.InstancedMesh(base, material, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      (entity.instances ?? []).forEach((item, i) => {
        q.setFromAxisAngle(up, item.rotationY ?? 0);
        const s = item.scale ?? 1;
        m.compose(
          new THREE.Vector3(item.position[0], item.position[1], item.position[2]),
          q,
          new THREE.Vector3(s, s, s),
        );
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.userData["entityId"] = entity.id;
      group.add(inst);
      break;
    }
    case "box":
    default:
      add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d)));
      break;
  }
  if (entity.kind === "custom") {
    // No custom renderers in the vanilla variant: fall back to a box.
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d)));
  }
  return group;
}

export function createThreeScene(container: HTMLElement, opts: VanillaSceneOptions): VanillaSceneHandle {
  const quality = opts.quality ?? "high";
  let tokens = opts.tokens;
  let scene: SceneDescription | null = null;
  let selectedId: string | null = null;
  let highlighted: string[] = [];
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(quality === "low" ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // PCFShadowMap: PCFSoftShadowMap was removed in three r183+, setting it only
  // warns (see UPSTREAM-NOTICE.md). PCF is the closest available soft-ish map.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
  container.appendChild(renderer.domElement);

  const view = new THREE.Scene();
  view.background = new THREE.Color(tokens.background);
  const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 1000);

  const pmrem = new THREE.PMREMGenerator(renderer);
  view.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  view.add(key);
  view.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.35));

  const groundMat = new THREE.MeshStandardMaterial({ color: tokens.ground, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  view.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);

  let composer: EffectComposer | null = null;
  function setupComposer(): void {
    if (quality !== "high") {
      composer = null;
      return;
    }
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(view, camera));
    composer.addPass(new SMAAPass());
    composer.addPass(new OutputPass());
  }
  setupComposer();

  const entityRoot = new THREE.Group();
  view.add(entityRoot);
  const materials = new Map<string, THREE.MeshStandardMaterial[]>();

  function fitLights(bounds: SceneDescription["bounds"]): void {
    const centre: Vec3 = [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ];
    const diag = Math.sqrt(
      (bounds.max[0] - bounds.min[0]) ** 2 +
        (bounds.max[1] - bounds.min[1]) ** 2 +
        (bounds.max[2] - bounds.min[2]) ** 2,
    );
    key.position.set(centre[0] + diag * 0.5, centre[1] + diag * 0.8, centre[2] + diag * 0.35);
    key.target.position.set(centre[0], centre[1], centre[2]);
    key.target.updateMatrixWorld();
    const half = diag / 2;
    Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: diag * 3 });
    key.shadow.camera.updateProjectionMatrix();
    ground.position.y = bounds.min[1];
    const first = allShots()[0];
    if (first) {
      camera.position.set(first.position[0], first.position[1], first.position[2]);
      controls.target.set(first.target[0], first.target[1], first.target[2]);
      camera.aspect = (container.clientWidth || 800) / (container.clientHeight || 600);
      camera.updateProjectionMatrix();
      controls.update();
    }
  }

  function allShots(): ShotDef[] {
    if (!scene) return [];
    return [...(opts.shots ?? defaultShots(scene.bounds)), ...scene.entities.map((e) => shotForEntity(e, (scene as SceneDescription).bounds))];
  }

  function render(): void {
    if (disposed) return;
    if (composer) composer.render();
    else renderer.render(view, camera);
  }

  let rafId = 0;
  const t0 = performance.now();
  let pulseT0 = -1;
  function loop(): void {
    if (disposed) return;
    rafId = requestAnimationFrame(loop);
    const t = (performance.now() - t0) / 1000;
    if (highlighted.length > 0) {
      if (pulseT0 < 0) pulseT0 = t;
      const dt = t - pulseT0;
      const intensity = dt > 2.4 ? 0 : 0.3 + 0.3 * Math.sin(2 * Math.PI * 1.4 * dt);
      for (const id of highlighted) {
        for (const mat of materials.get(id) ?? []) {
          mat.emissive.set(tokens.accent);
          mat.emissiveIntensity = intensity;
        }
      }
    } else {
      pulseT0 = -1;
    }
    controls.update();
    render();
  }

  function rebuild(next: SceneDescription): void {
    scene = next;
    entityRoot.clear();
    materials.clear();
    for (const e of next.entities) {
      const obj = buildMesh(e, tokens);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          const list = materials.get(e.id) ?? [];
          list.push(mat);
          materials.set(e.id, list);
        }
      });
      entityRoot.add(obj);
    }
    applySelection();
    fitLights(next.bounds);
    render();
  }

  function applySelection(): void {
    for (const [id, list] of materials) {
      for (const mat of list) {
        if (id === selectedId) {
          mat.emissive.set(tokens.accent);
          mat.emissiveIntensity = 0.35;
        } else if (!highlighted.includes(id)) {
          mat.emissive.set("#000000");
          mat.emissiveIntensity = 0;
        }
      }
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function onClick(ev: MouseEvent): void {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(entityRoot.children, true);
    let id: string | null = null;
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData["entityId"]) obj = obj.parent;
      const found = (obj?.userData["entityId"] as string | undefined) ?? null;
      if (found) {
        id = found;
        break;
      }
    }
    selectedId = id;
    applySelection();
    render();
    opts.onSelect?.(id);
  }
  renderer.domElement.addEventListener("click", onClick);

  function onResize(): void {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer?.setSize(w, h);
    render();
  }
  window.addEventListener("resize", onResize);

  let tweenCancel = false;
  function play(shotName: string): void {
    const shot = allShots().find((s) => s.name === shotName);
    if (!shot) {
      console.warn(`[three-scene] unknown shot: ${shotName}`);
      return;
    }
    const duration = shot.durationMs ?? 900;
    if (reducedMotion()) {
      camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
      controls.target.set(shot.target[0], shot.target[1], shot.target[2]);
      controls.update();
      render();
      return;
    }
    tweenCancel = true;
    tweenCancel = false;
    const from = {
      position: [camera.position.x, camera.position.y, camera.position.z] as Vec3,
      target: [controls.target.x, controls.target.y, controls.target.z] as Vec3,
    };
    const to = { position: shot.position, target: shot.target };
    const t0 = performance.now();
    controls.enabled = false;
    const step = (): void => {
      if (disposed || tweenCancel) {
        controls.enabled = true;
        return;
      }
      const t = Math.min((performance.now() - t0) / duration, 1);
      const pose = interpolateCamera(from, to, easeInOutCubic(t));
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
      controls.update();
      render();
      if (t < 1) requestAnimationFrame(step);
      else controls.enabled = true;
    };
    requestAnimationFrame(step);
  }

  const uninstall = installDemoHooks({
    container,
    name: opts.name,
    shots: () => allShots().map((s) => s.name),
    play,
    fpsProbe: (ms: number): Promise<number> =>
      measureFps(ms, (cb) => requestAnimationFrame(cb), render),
  });

  function update(next: SceneDescription): void {
    tokens = opts.tokens;
    rebuild(next);
  }

  loop();

  return {
    update,
    select(id: string | null): void {
      selectedId = id;
      applySelection();
      render();
    },
    highlight(ids: string[]): void {
      highlighted = [...ids];
      pulseT0 = -1;
      applySelection();
    },
    play,
    fpsProbe: (ms: number): Promise<number> =>
      measureFps(ms, (cb) => requestAnimationFrame(cb), render),
    dispose(): void {
      disposed = true;
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      uninstall();
      controls.dispose();
      composer?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
