// Requirement IDs: HEE-KIT-01
export interface RenderCapability {
  webgl2: boolean;
  webgl: boolean;
  webgpu: boolean;
}

export function detectRenderCapability(): RenderCapability {
  let webgl2 = false;
  let webgl = false;
  try {
    const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (canvas) {
      try {
        webgl2 = canvas.getContext("webgl2") !== null;
      } catch {
        webgl2 = false;
      }
      try {
        webgl = canvas.getContext("webgl") !== null;
      } catch {
        webgl = false;
      }
    }
  } catch {
    webgl2 = false;
    webgl = false;
  }
  let webgpu = false;
  try {
    webgpu = typeof navigator !== "undefined" && "gpu" in navigator;
  } catch {
    webgpu = false;
  }
  return { webgl2, webgl, webgpu };
}
