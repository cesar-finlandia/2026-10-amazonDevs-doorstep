// src/3d/renderers/scene-labels.tsx — the label layer (FIX-13).
// Labels are drawn as canvas-textured sprites inside the GL scene instead of
// drei <Html>. <Html> owns one react-dom root per label and unmounts it in a
// layout-effect cleanup keyed on the event-connected element, so every label
// tore its root down inside a commit ("Attempted to synchronously unmount a
// root while React was already rendering"). A sprite has no second React root:
// a label that appears, moves or goes away is an ordinary R3F child.
// Requirement IDs: FR-20
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ThreeTokens } from "src/kits/three-scene/src/react/index.js";

export interface SceneLabel {
  id: string;
  text: string;
  position: [number, number, number];
}

const WORLD_HEIGHT = 0.34;
const LIFT = 0.3;
const textures = new Map<string, { map: THREE.CanvasTexture; aspect: number }>();

function labelTexture(text: string, color: string): { map: THREE.CanvasTexture; aspect: number } {
  const key = `${color}|${text}`;
  const hit = textures.get(key);
  if (hit) return hit;
  const px = 48;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = `600 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  let width = text.length * px * 0.6;
  if (ctx) {
    ctx.font = font;
    width = ctx.measureText(text).width;
  }
  canvas.width = Math.max(8, Math.ceil(width + 16));
  canvas.height = Math.ceil(px * 1.4);
  const c2 = canvas.getContext("2d");
  if (c2) {
    c2.font = font;
    c2.fillStyle = color;
    c2.textBaseline = "middle";
    c2.textAlign = "center";
    c2.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const made = { map, aspect: canvas.width / canvas.height };
  textures.set(key, made);
  return made;
}

function LabelSprite({ label, color, reach }: { label: SceneLabel; color: string; reach: number }): React.JSX.Element {
  const ref = useRef<THREE.Sprite>(null);
  const { map, aspect } = useMemo(() => labelTexture(label.text, color), [label.text, color]);
  const pos = useMemo(
    () => new THREE.Vector3(label.position[0], label.position[1] + LIFT, label.position[2]),
    [label.position],
  );
  useFrame(({ camera }) => {
    const sprite = ref.current;
    if (!sprite) return;
    sprite.visible = camera.position.distanceTo(pos) <= reach;
  });
  return (
    <sprite ref={ref} position={pos} scale={[WORLD_HEIGHT * aspect, WORLD_HEIGHT, 1]} renderOrder={10}>
      <spriteMaterial map={map} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

export function SceneLabels({ labels, tokens, reach }: { labels: SceneLabel[]; tokens: ThreeTokens; reach: number }): React.JSX.Element {
  return (
    <group>
      {labels.map((l) => (
        <LabelSprite key={l.id} label={l} color={tokens.text} reach={reach} />
      ))}
    </group>
  );
}
