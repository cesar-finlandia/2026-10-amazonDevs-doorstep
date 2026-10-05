// scripts/verify/3d-kit.ts — browser harness for the DP-3D verification scripts.
// Requirement IDs: FR-20 (§3, §5.10)
import type { Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import type { RunningServer } from "src/server/start.js";
import { startTestServer } from "./at-kit.js";
import { ensureBuilt, waitCalm } from "./ui-kit.js";

export const GL_ARGS: string[] = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--enable-webgl",
];

export const FPS_MIN: number = process.env["THREE_D_HEADED"] === "1" ? 50 : 20;
export const VARIANCE_MIN = 40;

export interface ThreeRun {
  page: Page;
  url: string;
  problems: string[];
  /** Console noise excluded from problems (documented below), kept for inspection. */
  notices: string[];
  close(): Promise<void>;
}

/** Third-party framework noise that no entry code can prevent, excluded from
 *  `problems` (which must stay empty) but kept in `notices`:
 *  - three r183 deprecated THREE.Clock, yet the pinned @react-three/fiber
 *    constructs one per Canvas root at mount;
 *  - React/R3F log one root-unmount notice per Canvas mount cycle.
 *  Anything else of type error or warning is a real problem. */
function isFrameworkNotice(text: string): boolean {
  return (
    text.startsWith("THREE.Clock: This module has been deprecated") ||
    text.startsWith("Attempted to synchronously unmount a root")
  );
}

export interface Open3dOptions {
  path?: string;
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  quality?: "low" | "high";
  reducedMotion?: boolean;
  init?: string;
}

interface Scene3dWindow {
  __scene3d: {
    ready(): boolean;
    revision(): number;
    camera(): { position: [number, number, number]; target: [number, number, number] };
    frames(): number;
  };
}

export async function open3d(opts?: Open3dOptions): Promise<ThreeRun> {
  await ensureBuilt();
  const { createLogger } = await import("src/server/logger.js");
  const server: RunningServer = await startTestServer({
    port: 0,
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1", AGENT_PROVIDER: "golden" },
    config: { staticDir: "dist" },
    overrides: { log: createLogger({ write: () => undefined }) } as never,
  });
  const browser = await chromium.launch({ args: GL_ARGS });
  const context = await browser.newContext({
    viewport: { width: opts?.width ?? 1280, height: opts?.height ?? 720 },
    colorScheme: opts?.theme ?? "light",
    reducedMotion: opts?.reducedMotion === true ? "reduce" : "no-preference",
  });
  const theme = opts?.theme ?? "light";
  const extra = opts?.init ?? "";
  await context.addInitScript(
    `try { localStorage.setItem("dr-theme", ${JSON.stringify(theme)}); } catch (e) {}\n${extra}`,
  );
  const page = await context.newPage();
  const problems: string[] = [];
  const notices: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const text = msg.text();
    if (isFrameworkNotice(text)) notices.push(text);
    else problems.push(text);
  });
  page.on("pageerror", (err) => {
    problems.push(`pageerror: ${err.message}`);
  });
  const quality = opts?.quality ?? "low";
  const path = opts?.path ?? `/?hook=1&quality=${quality}`;
  await page.goto(server.url + path, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
  return {
    page,
    url: server.url,
    problems,
    notices,
    close: async (): Promise<void> => {
      try {
        await context.close();
      } catch {
        /* ignore */
      }
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
      await server.close();
    },
  };
}

/** Presses "Load the sample week", waits for the ribbon ticks. */
export async function loadWeek(page: Page): Promise<void> {
  await page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
  await waitCalm(page);
}

/** Waits for window.__scene3d.ready() and a first frame. */
export async function waitScene(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __scene3d?: { ready(): boolean } }).__scene3d?.ready() === true,
    { timeout: 30000 },
  );
  await page.waitForFunction(
    () => (window as unknown as Scene3dWindow).__scene3d.frames() >= 1,
    { timeout: 30000 },
  );
}

/** Luminance variance over a 64×64 grid of a screenshot of the element. */
export async function variance64(page: Page, selector: string): Promise<number> {
  const shot = await page.locator(selector).first().screenshot();
  const data = shot.toString("base64");
  return page.evaluate((b64: string) => {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("screenshot did not decode"));
    });
    img.src = `data:image/png;base64,${b64}`;
    return loaded.then(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0, 64, 64);
      const pixels = ctx.getImageData(0, 0, 64, 64).data;
      const lum: number[] = [];
      for (let i = 0; i < pixels.length; i += 4) {
        lum.push(0.2126 * (pixels[i] as number) + 0.5872 * (pixels[i + 1] as number) + 0.1142 * (pixels[i + 2] as number));
      }
      const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
      return lum.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lum.length;
    });
  }, data);
}

/** Waits until camera() stops changing for 250 ms (default timeout 3000). Under
 *  software GL frames can render slower than the poll interval, so stillness
 *  alone can alias a mid-flight camera as settled: pass `near` (a shot pose)
 *  to additionally require the camera within 0.05 of it before stillness
 *  counts. */
export async function settle(
  page: Page,
  ms = 3000,
  near?: { position: [number, number, number]; target: [number, number, number] },
): Promise<void> {
  const deadline = Date.now() + ms;
  let steadySince = Date.now();
  let prev = "";
  const dist = (a: number[], b: number[]): number =>
    Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] as number)) ** 2, 0));
  while (Date.now() < deadline) {
    const cur = await page.evaluate(() => {
      const w = window as unknown as Scene3dWindow;
      const c = w.__scene3d.camera();
      return { json: JSON.stringify([c.position, c.target]), position: c.position, target: c.target };
    });
    const nearOk =
      !near || (dist(cur.position, near.position) <= 0.05 && dist(cur.target, near.target) <= 0.05);
    if (cur.json === prev && nearOk) {
      if (Date.now() - steadySince >= 250) return;
    } else {
      steadySince = Date.now();
      prev = cur.json;
    }
    await page.waitForTimeout(50);
  }
}
