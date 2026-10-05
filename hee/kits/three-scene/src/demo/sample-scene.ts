// Requirement IDs: HEE-KIT-01
import type { SceneDescription, Vec3 } from "../core/scene-description.js";

function box(
  id: string, position: Vec3, size: Vec3, token: "primary" | "secondary" | "floor", label?: string,
): SceneDescription["entities"][number] {
  return { id, kind: "box", position, size, material: { token }, label };
}

// Neutral "widget bay" demo scene: a floor, one extruded L-shaped footprint,
// 12 boxes in two rows, 4 cylinders, one instanced group of 30 small boxes.
// 19 entities, well under 80 draw calls.
export function buildSampleScene(): SceneDescription {
  const entities: SceneDescription["entities"] = [];
  entities.push({
    id: "floor",
    kind: "plane",
    position: [-15, 0, -11],
    size: [30, 0, 22],
    material: { token: "floor" },
  });
  entities.push({
    id: "block-l",
    kind: "extrusion",
    position: [-8, 0, -4],
    size: [6, 1.2, 6],
    polygon: [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]],
    material: { token: "secondary" },
    label: "L block",
  });
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      const id = `unit-r${row + 1}c${col + 1}`;
      entities.push(
        box(
          id,
          [-6 + col * 2.2, 0, -6 + row * 3.4],
          [1.6, 0.8 + ((row + col) % 3) * 0.5, 1.1],
          (row + col) % 2 === 0 ? "primary" : "secondary",
          `Unit R${row + 1}C${col + 1}`,
        ),
      );
    }
  }
  const posts: Vec3[] = [[8, 0, -6], [11, 0, -6], [8, 0, 4], [11, 0, 4]];
  posts.forEach((p, i) => {
    entities.push({
      id: `post-${i + 1}`,
      kind: "cylinder",
      position: p,
      size: [0.5, 2.4, 0.5],
      material: { token: "primary" },
      label: `Post ${i + 1}`,
    });
  });
  entities.push({
    id: "fasteners",
    kind: "instanced",
    position: [0, 0, 0],
    size: [0.4, 0.4, 0.4],
    instances: Array.from({ length: 30 }, (_, i) => ({
      position: [-4 + (i % 6) * 0.9, 1.4, 6 + Math.floor(i / 6) * 0.9] as Vec3,
      rotationY: (i % 4) * 0.2,
      scale: 1,
    })),
    material: { token: "secondary" },
    label: "Fasteners",
  });
  return {
    revision: 1,
    bounds: { min: [-15, 0, -11], max: [15, 6, 11] },
    entities,
  };
}
