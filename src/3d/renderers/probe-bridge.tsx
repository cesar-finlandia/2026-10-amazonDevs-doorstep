// src/3d/renderers/probe-bridge.tsx — mounts the GL probe (DP-3D §5.5, §5.8).
// Calls attachGl(gl, camera, controls) from useThree and returns its cleanup;
// renders nothing.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { attachGl } from "src/3d/probe.js";

export function ProbeBridge(): React.JSX.Element | null {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  useEffect(() => attachGl(gl, camera as THREE.Camera, controls), [gl, camera, controls]);
  return null;
}
