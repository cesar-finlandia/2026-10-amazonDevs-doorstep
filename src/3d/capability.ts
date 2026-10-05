// src/3d/capability.ts — WebGL capability detection and render quality (DP-3D §5.9).
// Requirement IDs: NFR-07
/** Module-level cache for the no-factory probe: probing creates a real GL
 *  context, so probing on every render would leak contexts until the browser
 *  starts losing them. Factory calls are never cached. */
let cachedGl: boolean | null = null;

export function canRenderGl(
  canvasFactory?: () => { getContext(kind: string): unknown },
): boolean {
  if (canvasFactory) return probeFactory(canvasFactory);
  if (cachedGl !== null) return cachedGl;
  cachedGl = probeFactory(() => document.createElement("canvas"));
  return cachedGl;
}

function probeFactory(canvasFactory: () => { getContext(kind: string): unknown }): boolean {
  try {
    const canvas = canvasFactory();
    try {
      if (canvas.getContext("webgl2")) return true;
    } catch {
      /* fall through to webgl */
    }
    try {
      if (canvas.getContext("webgl")) return true;
    } catch {
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

/** ?quality=low|high wins, else webdriver ? "low" : "high". */
export function renderQuality(search?: string, webdriver?: boolean): "low" | "high" {
  const query = search ?? (typeof location !== "undefined" ? location.search : "");
  const q = new URLSearchParams(query).get("quality");
  if (q === "low" || q === "high") return q;
  const driver = webdriver ?? (typeof navigator !== "undefined" ? navigator.webdriver : false);
  return driver ? "low" : "high";
}
