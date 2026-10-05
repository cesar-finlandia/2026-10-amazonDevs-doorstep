// Requirement IDs: HEE-KIT-01
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { SceneDescription } from "../core/scene-description.js";
import type { LabTuning } from "./LabPanel.js";

export interface LightsProps {
  bounds: SceneDescription["bounds"];
  quality: "high" | "low";
  tuning?: Pick<LabTuning, "keyIntensity" | "keyAzimuth" | "keyElevation" | "hemisphere">;
}

export function Lights({ bounds, quality, tuning }: LightsProps): React.JSX.Element {
  const diag = Math.sqrt(
    (bounds.max[0] - bounds.min[0]) ** 2 +
      (bounds.max[1] - bounds.min[1]) ** 2 +
      (bounds.max[2] - bounds.min[2]) ** 2,
  );
  const centre: [number, number, number] = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const half = diag / 2;
  const keyIntensity = tuning?.keyIntensity ?? 2.2;
  const az = ((tuning?.keyAzimuth ?? 35) * Math.PI) / 180;
  const el = ((tuning?.keyElevation ?? 50) * Math.PI) / 180;
  const keyDir: [number, number, number] = [
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az),
  ];
  return (
    <group>
      {/* Offline image-based light: Lightformer children render into an env
          map locally. No Environment preset (presets fetch HDR files). */}
      <Environment resolution={256}>
        <Lightformer intensity={1.1} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer intensity={0.4} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer intensity={0.4} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>
      <directionalLight
        castShadow
        position={[centre[0] + keyDir[0] * diag, centre[1] + keyDir[1] * diag, centre[2] + keyDir[2] * diag]}
        intensity={keyIntensity}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={0.5}
        shadow-camera-far={diag * 3}
        target-position={centre}
      />
      <hemisphereLight intensity={tuning?.hemisphere ?? 0.35} />
      {quality === "high" ? (
        <ContactShadows position={[centre[0], bounds.min[1] + 0.01, centre[2]]} scale={diag * 1.6} blur={2.4} far={diag} resolution={512} frames={1} />
      ) : null}
    </group>
  );
}
