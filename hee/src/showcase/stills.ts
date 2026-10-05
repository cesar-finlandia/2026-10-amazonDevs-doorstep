// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §3.3 stills: gallery + readme PNGs from the demo scenario, hero GIF,
// captions.json. The same scenario file and runStep the E2E suite uses.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { readDemoScenario, runAction, type PageLike } from "./scenario.js";
import type { CaptionEntry, DemoScenario } from "./types.js";
import { compileSchema, loadSchema } from "../llm/index.js";

export const GALLERY_WIDTH = 1500;
export const GALLERY_HEIGHT = 1000;
export const README_WIDTH = 1000;
export const README_HEIGHT = 667;
export const HERO_WIDTH = 800;
export const HERO_RETRY_WIDTH = 640;
export const HERO_MAX_BYTES = 6000000;
export const HERO_MIN_FRAMES = 8;
export const HERO_MAX_FRAMES = 150;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrowserLike {
  newPage(opts?: { viewport?: { width: number; height: number } }): Promise<PageLike>;
  close(): Promise<void>;
}

export interface MakeStillsOpts {
  entryDir: string;
  baseUrl?: string;
  scenario?: string;
  launch?: () => Promise<BrowserLike>;
}

/** Expand by 16px, grow to 3:2, clamp inside the viewport. Too small → viewport. */
export function clipFor(box: Box | null, viewport: { width: number; height: number }): Box {
  if (box === null) return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  let w = box.width + 32;
  let h = box.height + 32;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (w / h < 1.5) w = h * 1.5;
  else h = w / 1.5;
  let x = cx - w / 2;
  let y = cy - h / 2;
  if (w >= viewport.width) {
    x = 0;
    w = viewport.width;
  } else {
    x = Math.min(Math.max(x, 0), viewport.width - w);
  }
  if (h >= viewport.height) {
    y = 0;
    h = viewport.height;
  } else {
    y = Math.min(Math.max(y, 0), viewport.height - h);
  }
  const clip = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
  if (clip.x + clip.width > viewport.width) clip.x = viewport.width - clip.width;
  if (clip.y + clip.height > viewport.height) clip.y = viewport.height - clip.height;
  if (clip.width < 480 || clip.height < 320) {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  }
  return clip;
}

/** Count image-descriptor blocks of a GIF buffer. */
export function countGifFrames(buf: Buffer): number {
  const head = buf.subarray(0, 6).toString("ascii");
  if (head !== "GIF89a" && head !== "GIF87a") return 0;
  if (buf.length < 13) return 0;
  const packed = buf[10] as number;
  let pos = 13 + ((packed & 0x80) !== 0 ? 3 * 2 ** ((packed & 0x07) + 1) : 0);
  let count = 0;
  while (pos < buf.length) {
    const sep = buf[pos] as number;
    if (sep === 0x3b) break;
    if (sep === 0x21) {
      pos += 2;
      while (pos < buf.length) {
        const n = buf[pos] as number;
        pos += 1;
        if (n === 0) break;
        pos += n;
      }
    } else if (sep === 0x2c) {
      count += 1;
      pos += 1 + 8;
      const descriptorPacked = buf[pos] as number;
      pos += 1;
      if ((descriptorPacked & 0x80) !== 0) pos += 3 * 2 ** ((descriptorPacked & 0x07) + 1);
      pos += 1;
      while (pos < buf.length) {
        const n = buf[pos] as number;
        pos += 1;
        if (n === 0) break;
        pos += n;
      }
    } else {
      break;
    }
  }
  return count;
}

/** Caption rule of §2.4: one sentence, ends with ".", ≤ 140 chars, no semicolon. */
export function captionError(caption: string): string | null {
  const body = caption.endsWith(".") ? caption.slice(0, -1) : null;
  if (
    body === null ||
    body.length === 0 ||
    caption.length > 140 ||
    caption.includes(";") ||
    /[.?!]/.test(body)
  ) {
    return "caption must be one sentence of at most 140 characters";
  }
  return null;
}

/** Caption rule of §2.4: one sentence, ends with ".", ≤ 140 chars, no semicolon. */
export function checkCaption(stillId: string, caption: string): void {
  const problem = captionError(caption);
  if (problem !== null) {
    throw new Error(`still ${stillId}: ${problem}`);
  }
}

function evenHeight(width: number, viewport: { width: number; height: number }): number {
  const h = Math.round((width * viewport.height) / viewport.width);
  const even = h % 2 === 1 ? h - 1 : h;
  return Math.max(2, even);
}

interface RawFrame {
  data: Buffer;
  width: number;
  height: number;
}

async function toRawFrame(png: Buffer, width: number, viewport: { width: number; height: number }): Promise<RawFrame> {
  const height = evenHeight(width, viewport);
  const { data, info } = await sharp(png)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function encodeGif(frames: RawFrame[], repeat: number): Buffer {
  const gif = GIFEncoder();
  frames.forEach((frame, i) => {
    const rgba = new Uint8Array(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: 100,
      ...(i === 0 ? { repeat } : {}),
    });
  });
  gif.finish();
  return Buffer.from(gif.bytes());
}

function validateCaptions(entries: CaptionEntry[]): void {
  const result = compileSchema(loadSchema("contracts/hee-captions.schema.json"))(entries);
  if (!result.ok) {
    throw new Error(`invalid captions.json: ${result.errors.join("; ")}`);
  }
}

export interface MakeStillsResult {
  stills: number;
  heroFrames: number;
  warning?: string;
}

export async function makeStills(opts: MakeStillsOpts): Promise<MakeStillsResult> {
  const scenarioPath = opts.scenario ?? join(opts.entryDir, "design_documents", "demo-scenario.json");
  const scenario: DemoScenario = readDemoScenario(scenarioPath);
  for (const still of scenario.stills) checkCaption(still.id, still.claim);
  const baseUrl = opts.baseUrl ?? scenario.base_url;

  const outDir = join(opts.entryDir, "shots", "showcase");
  mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    if (/\.png$/i.test(entry) || /\.gif$/i.test(entry) || entry === "captions.json") {
      rmSync(join(outDir, entry));
    }
  }

  const launch =
    opts.launch ??
    (async (): Promise<BrowserLike> => {
      const { chromium } = await import("@playwright/test");
      return (await chromium.launch()) as unknown as BrowserLike;
    });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { ...scenario.viewport } });
    const viewport = page.viewportSize() ?? { ...scenario.viewport };
    const heroRange = scenario.hero
      ? (() => {
          const ids = scenario.steps.map((s) => s.id);
          const from = ids.indexOf(scenario.hero.from_step);
          const to = ids.indexOf(scenario.hero.to_step);
          return { from, to };
        })()
      : null;
    const framePngs: Buffer[] = [];
    const capturing = (stepIdx: number): boolean =>
      heroRange !== null && stepIdx >= heroRange.from && stepIdx <= heroRange.to && framePngs.length < HERO_MAX_FRAMES;
    const capture = async (): Promise<void> => {
      if (framePngs.length < HERO_MAX_FRAMES) framePngs.push(await page.screenshot());
    };
    const slicedWait = async (ms: number, stepIdx: number): Promise<void> => {
      if (!capturing(stepIdx)) {
        await page.waitForTimeout(ms);
        return;
      }
      const slices = Math.max(1, Math.round(ms / 100));
      for (let k = 0; k < slices; k++) {
        await page.waitForTimeout(ms / slices);
        await capture();
      }
    };

    const captions: CaptionEntry[] = [];
    let processedStills = 0;
    for (let stepIdx = 0; stepIdx < scenario.steps.length; stepIdx++) {
      const step = scenario.steps[stepIdx] as DemoScenario["steps"][number];
      for (const action of step.actions) {
        if ("wait_ms" in action && capturing(stepIdx)) {
          const slices = Math.max(1, Math.round(action.wait_ms / 100));
          for (let k = 0; k < slices; k++) {
            await page.waitForTimeout(action.wait_ms / slices);
            await capture();
          }
        } else {
          await runAction(page, step, action, baseUrl);
          if (capturing(stepIdx)) await capture();
        }
      }
      await slicedWait(step.settle_ms, stepIdx);
      for (const still of scenario.stills.filter((s) => s.after_step === step.id)) {
        const box = still.selector ? await page.locator(still.selector).first().boundingBox() : null;
        const clip = box ? clipFor(box, viewport) : { x: 0, y: 0, width: viewport.width, height: viewport.height };
        const png = await page.screenshot({ clip });
        const gallery = await sharp(png).resize(GALLERY_WIDTH, GALLERY_HEIGHT, { fit: "cover" }).png().toBuffer();
        const readme = await sharp(png).resize(README_WIDTH, README_HEIGHT, { fit: "cover" }).png().toBuffer();
        const galleryFile = `gallery-${still.id}.png`;
        const readmeFile = `readme-${still.id}.png`;
        writeFileSync(join(outDir, galleryFile), gallery);
        writeFileSync(join(outDir, readmeFile), readme);
        captions.push(
          { file: galleryFile, caption: still.claim, alt: still.alt, claim_id: still.claim_id, size: "gallery" },
          { file: readmeFile, caption: still.claim, alt: still.alt, claim_id: still.claim_id, size: "readme" },
        );
        processedStills += 1;
      }
    }

    let heroFrames = 0;
    let warning: string | undefined;
    if (heroRange !== null && framePngs.length >= HERO_MIN_FRAMES) {
      let raws: RawFrame[] = [];
      for (const png of framePngs) raws.push(await toRawFrame(png, HERO_WIDTH, viewport));
      let hero = encodeGif(raws, 0);
      if (hero.length > HERO_MAX_BYTES) {
        const half = framePngs.filter((_, i) => i % 2 === 0);
        raws = [];
        for (const png of half) raws.push(await toRawFrame(png, HERO_RETRY_WIDTH, viewport));
        hero = encodeGif(raws, 0);
      }
      heroFrames = countGifFrames(hero);
      if (hero.length <= HERO_MAX_BYTES) {
        writeFileSync(join(outDir, "hero.gif"), hero);
        captions.push({
          file: "hero.gif",
          caption: "A recorded run of the product doing its job.",
          alt: "Recorded run of the product",
          claim_id: null,
          size: "hero",
        });
      } else {
        warning = `hero gif still exceeds ${HERO_MAX_BYTES} bytes; omitted`;
        heroFrames = 0;
      }
    } else if (heroRange !== null) {
      warning = `only ${framePngs.length} hero frames; need at least ${HERO_MIN_FRAMES}; omitted the GIF`;
    }

    validateCaptions(captions);
    if (existsSync(join(outDir, "captions.json"))) rmSync(join(outDir, "captions.json"));
    writeFileSync(join(outDir, "captions.json"), JSON.stringify(captions, null, 2) + "\n", "utf8");
    console.log(`stills: ${processedStills} stills, ${heroFrames} hero frames, wrote shots/showcase/`);
    return warning !== undefined ? { stills: processedStills, heroFrames, warning } : { stills: processedStills, heroFrames };
  } finally {
    await browser.close();
  }
}
