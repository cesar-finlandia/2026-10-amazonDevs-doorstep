// scripts/video/render-pitch.ts — DP-SCRIPT WU-07 step 4 (extended WU-08).
// Renders each existing pitch layer (cover, slide1, slide2) to PNG at
// 1920x1080 with Playwright and records the measured text rectangles.
// Prints `pitch: <n> rendered`.
import { pathToFileURL } from "node:url";
import { check, done } from "./lib.js";
import { PROJECT, writeJson } from "./lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};

const { chromium } = await import("playwright");
const layers = ["cover", "slide1", "slide2"];
const { existsSync } = await import("node:fs");
const todo = layers.filter((id) => existsSync(`${PROJECT}/pitch/${id}.html`));

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
for (const id of todo) {
  const url = pathToFileURL(`${PROJECT}/pitch/${id}.html`).href;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${PROJECT}/pitch/${id}.png` });
  const layout = await page.evaluate(() => {
    const texts: { tag: string; cls: string; text: string; px: number; rect: { x: number; y: number; w: number; h: number } }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const s = (node.textContent ?? "").trim();
      if (!s) continue;
      const el = node.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      texts.push({
        tag: el.tagName.toLowerCase(), cls: el.className?.toString?.() ?? "", text: s.slice(0, 60),
        px: Number.parseFloat(cs.fontSize),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      });
    }
    const rectOf = (sel: string): { x: number; y: number; w: number; h: number } | null => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      texts,
      appName: rectOf(".app-name"),
      titleBlock: rectOf(".title-block"),
      stage: rectOf(".stage"),
    };
  });
  writeJson(`${PROJECT}/pitch/${id}-layout.json`, layout);
  t(true, `${id} rendered`);
}
await browser.close();
console.log(`pitch: ${todo.length} rendered`);
done("render-pitch", n, failures);
