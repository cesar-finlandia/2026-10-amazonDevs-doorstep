// Requirement IDs: HEE-KIT-01
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = join(HERE, "..", "..");

test("demo scene renders non-blank at 20fps in software GL", async ({ page }) => {
  const problems: string[] = [];
  // Known upstream deprecation notices from the pinned stack (see
  // UPSTREAM-NOTICE.md): @react-three/fiber constructs a THREE.Clock
  // internally, which three r183+ reports as deprecated. Everything else
  // containing "THREE" still fails the run.
  const KNOWN_UPSTREAM_NOTICES = [
    "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.",
  ];
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (KNOWN_UPSTREAM_NOTICES.some((known) => text.includes(known))) return;
    if (type === "error") problems.push(`console.error: ${text}`);
    if (type === "warning" && text.includes("THREE")) problems.push(`console.warn: ${text}`);
  });
  page.on("pageerror", (err) => {
    problems.push(`pageerror: ${String(err)}`);
  });

  await page.goto("/?quality=low");
  await page.waitForFunction(() => {
    const api = (window as unknown as { __demo3d?: { ready?: boolean } }).__demo3d;
    return Boolean(api && api.ready);
  });

  const canvas = page.locator('[data-demo-3d="widget-bay"] canvas');
  await expect(canvas).toBeVisible();
  const png = await canvas.screenshot({ type: "png" });
  const img = PNG.sync.read(Buffer.from(png));

  // 64x64 grid sample over the screenshot.
  const samples: number[] = [];
  const colours = new Set<number>();
  const strideX = Math.max(1, Math.floor(img.width / 64));
  const strideY = Math.max(1, Math.floor(img.height / 64));
  for (let y = 0; y < img.height; y += strideY) {
    for (let x = 0; x < img.width; x += strideX) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i] as number;
      const g = img.data[i + 1] as number;
      const b = img.data[i + 2] as number;
      samples.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
      colours.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    }
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) * (b - mean), 0) / samples.length;
  const distinctColours = colours.size;
  expect(variance).toBeGreaterThan(20);
  expect(distinctColours).toBeGreaterThanOrEqual(8);

  const fps = await page.evaluate(async (ms: number) => {
    const api = (window as unknown as { __demo3d: { fpsProbe(m: number): Promise<number> } }).__demo3d;
    return api.fpsProbe(ms);
  }, 3000);
  expect(fps).toBeGreaterThanOrEqual(20);

  const shots = await page.evaluate(() => {
    const api = (window as unknown as { __demo3d: { shots: string[] } }).__demo3d;
    return [...api.shots];
  });
  for (const name of shots) {
    await page.evaluate((shot: string) => {
      (window as unknown as { __demo3d: { play(s: string): void } }).__demo3d.play(name);
    }, name);
    await page.waitForTimeout(1300);
  }

  expect(problems.join("\n")).toBe("");

  const outDir = join(KIT_ROOT, "test-results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "render-report.json"),
    JSON.stringify({ variance, distinctColours, fps, mode: "headless-software-gl", shots }, null, 2) + "\n",
    "utf8",
  );
});
