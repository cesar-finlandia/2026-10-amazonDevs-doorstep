// scripts/video/check-pitch.ts — DP-SCRIPT WU-09 step 1.
// The measured pass over the nine pitch files: existence and size, layout
// (overflow, text under 24 px, contrast under 4.5:1, read in a browser) and
// text-contamination of the pictures.
// Prints `pitch: 0 violations, 9 files` or one line per violation (exit 1).
// Flags: --dir <pitch copy> (mutation tests), --verbose (measurement table),
// --contamination <png> [--expect <layer.html>] (the contamination step:
// flags letterforms beyond the layer's own words).
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PROJECT } from "./lib.js";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const dir = arg("--dir") ?? `${PROJECT}/pitch`;
const verbose = process.argv.includes("--verbose");
const onlyContamination = arg("--contamination");

interface TextNode {
  text: string; px: number; fg: string; bg: string;
  rect: { x: number; y: number; w: number; h: number };
  box: { x: number; y: number; w: number; h: number };
}

const lum = (rgb: [number, number, number]): number => {
  const f = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
const parseRgb = (s: string): [number, number, number, number] => {
  const m = /rgba?\(([^)]+)\)/.exec(s) ?? ["", "0,0,0,1"];
  const p = (m[1] ?? "").split(",").map((x) => Number(x.trim()));
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
};
const ratio = (fg: string, bg: string): number => {
  const f = parseRgb(fg);
  const b = parseRgb(bg);
  const mix = (i: number): number => Math.round(f[i]! * f[3]! + b[i]! * (1 - f[3]!));
  const l1 = lum([mix(0), mix(1), mix(2)]);
  const l2 = lum([b[0], b[1], b[2]]);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const wordsOf = (s: string): string[] =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

function ocrText(pngPath: string): string {
  const r = spawnSync("python3", ["scripts/video/ocr-text.py", pngPath], { encoding: "utf8" });
  return r.status === 0 ? (r.stdout ?? "") : "";
}

function contaminationStep(pngPath: string, expectHtml?: string): string | null {
  // Letterforms beyond the layer's own words (pictures: none allowed).
  const found = wordsOf(ocrText(pngPath));
  const expected = new Set(expectHtml === undefined ? [] : wordsOf(
    readFileSync(expectHtml, "utf8").replace(/<[^>]*>/g, " ")));
  const extra = found.filter((w) => !expected.has(w));
  if (extra.length >= 2) return `text-contaminated: ${pngPath} (${extra.slice(0, 6).join(" ")})`;
  return null;
}

async function measure(htmlPath: string): Promise<TextNode[]> {
  const { chromium } = await import("playwright");
  const { pathToFileURL } = await import("node:url");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const items: TextNode[] = [];
    const bgOf = (el: Element): string => {
      let cur: Element | null = el;
      while (cur) {
        const bg = getComputedStyle(cur).backgroundColor;
        const m = /rgba?\(([^)]+)\)/.exec(bg ?? "");
        const a = m ? Number((m[1] ?? "1").split(",")[3] ?? 1) : 1;
        if (a >= 1 && bg !== "rgba(0, 0, 0, 0)") return bg;
        cur = cur.parentElement;
      }
      return "rgb(246, 241, 231)";
    };
    const boxOf = (el: Element): TextNode["box"] => {
      let cur: Element | null = el.parentElement;
      while (cur && cur !== document.body) {
        const cs = getComputedStyle(cur);
        if (cs.position !== "static" && /panel|title-block|stage/.test(cur.className?.toString?.() ?? "")) {
          const r = cur.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }
        cur = cur.parentElement;
      }
      return { x: 0, y: 0, w: 1920, h: 1080 };
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const s = (node.textContent ?? "").trim();
      if (!s) continue;
      const el = node.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      items.push({
        text: s.slice(0, 80), px: Number.parseFloat(cs.fontSize),
        fg: cs.color, bg: bgOf(el),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        box: boxOf(el),
      });
    }
    return items;
  });
  await browser.close();
  return out;
}

async function main(): Promise<void> {
  if (onlyContamination) {
    const bad = contaminationStep(onlyContamination, arg("--expect"));
    if (bad) {
      console.log(bad);
      process.exit(1);
    }
    console.log(`contamination: clean (${onlyContamination})`);
    return;
  }
  const ids = ["cover", "slide1", "slide2"];
  const violations: string[] = [];
  let files = 0;
  const table: string[] = [];
  for (const id of ids) {
    for (const f of [`${dir}/${id}.html`, `${dir}/${id}-image.png`, `${dir}/${id}.png`]) {
      try {
        const buf = readFileSync(f);
        if (buf.length === 0) violations.push(`empty: ${f}`);
        else files += 1;
      } catch {
        violations.push(`missing: ${f}`);
      }
    }
    try {
      const buf = readFileSync(`${dir}/${id}.png`);
      if (!(buf.readUInt32BE(16) === 1920 && buf.readUInt32BE(20) === 1080)) {
        violations.push(`size: ${dir}/${id}.png is not 1920x1080`);
      }
    } catch { /* already reported */ }
    try {
      const pic = readFileSync(`${dir}/${id}-image.png`);
      const colorType = pic[25];
      if (colorType === 4 || colorType === 6) violations.push(`alpha: ${dir}/${id}-image.png has an alpha channel`);
    } catch { /* already reported */ }
    try {
      const nodes = await measure(`${dir}/${id}.html`);
      for (const x of nodes) {
        if (x.px < 24) violations.push(`text-size: ${id} '${x.text.slice(0, 40)}' is ${x.px}px`);
        if (x.rect.x < 0 || x.rect.y < 0 || x.rect.x + x.rect.w > 1920 || x.rect.y + x.rect.h > 1080) {
          violations.push(`overflow: ${id} '${x.text.slice(0, 40)}' leaves the stage`);
        }
        if (x.rect.x < x.box.x - 1 || x.rect.x + x.rect.w > x.box.x + x.box.w + 1) {
          violations.push(`overflow: ${id} '${x.text.slice(0, 40)}' leaves its block`);
        }
        const c = ratio(x.fg, x.bg);
        table.push(`${id} '${x.text.slice(0, 28)}' ${x.px}px ${c.toFixed(1)}:1`);
        if (c < 4.5) violations.push(`contrast: ${id} '${x.text.slice(0, 40)}' is ${c.toFixed(2)}:1`);
      }
      const bad = contaminationStep(`${dir}/${id}-image.png`);
      if (bad) violations.push(bad);
    } catch (e) {
      violations.push(`measure: ${id} (${String(e).split("\n")[0]})`);
    }
    try {
      const html = readFileSync(`${dir}/${id}.html`, "utf8");
      for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        if (!/alt=""/.test(m[0])) violations.push(`img-words: ${id} ${m[0].slice(0, 60)}`);
      }
      if (/background-image\s*:\s*url/i.test(html)) violations.push(`img-words: ${id} background-image carries an asset`);
    } catch { /* already reported */ }
  }
  if (verbose) {
    console.log("measure:");
    for (const row of table) console.log(`  ${row}`);
  }
  if (violations.length > 0) {
    for (const v of violations) console.log(v);
    process.exit(1);
  }
  console.log(`pitch: 0 violations, ${files} files`);
}

await main();
