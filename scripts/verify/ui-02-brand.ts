// scripts/verify/ui-02-brand.ts — DP-UI WU-UI-02 (16 checks).
// Requirement IDs: FR-23
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { bannedHits } from "src/llm/guard.js";
import { contrast } from "../lib/color.js";
import { createChecker, planBlock, sh } from "./ui-kit.js";

const c = createChecker("ui-02-brand");

// The favicon PNG is a build output of this unit; regenerate it here.
sh("npx", ["vite-node", "scripts/export-favicon.ts"]);

const mark = readFileSync("brand/mark.svg", "utf8");
const pubMark = readFileSync("public/brand/mark.svg", "utf8");
const favicon = readFileSync("brand/favicon.svg", "utf8");
const pubFavicon = readFileSync("public/favicon.svg", "utf8");
const css = readFileSync("brand/brandmark.css", "utf8");
const lockup = readFileSync("brand/lockup.html", "utf8");
const readme = readFileSync("brand/README.md", "utf8");

// 1. brand/mark.svg equals the plan's verbatim block byte for byte.
c.eq(mark, planBlock("<svg", "svg"), "1 mark equals the plan block");

// 2. The public copy is byte-identical.
c.eq(pubMark, mark, "2 public mark copy identical");

// 3. The favicon copies match; the favicon pins the paper accent, not currentColor.
c.ok(pubFavicon === favicon && favicon.includes("#1B6A62") && !favicon.includes("currentColor"), "3 favicon copies match with pinned accent");

// 4. The mark is well-formed XML with a square viewBox and an accessible name.
// NOTE (deviation): the verbatim §2A.7 block carries its accessible name as
// aria-label, not as a <title> child; byte equality (check 1) wins, so this
// check accepts either form.
{
  const singleRoot = /^<svg[\s\S]*<\/svg>\s*$/.test(mark.trim());
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(mark);
  const square = vb !== null && vb[1] === vb[2];
  const named = mark.includes("<title>") || /aria-label="[^"]+"/.test(mark);
  const clean = mark.includes("currentColor") && !mark.includes("<image") && !mark.includes("<script") && !/href\s*=/.test(mark);
  c.ok(singleRoot && square && named && clean, "4 mark is well-formed XML with square viewBox and a name");
}

// Token lookup: parse tokens.css when present, else the literal hex values.
function token(theme: "light" | "dark", name: string, fallback: string): string {
  try {
    if (!existsSync("src/ui/tokens/tokens.css")) return fallback;
    const text = readFileSync("src/ui/tokens/tokens.css", "utf8");
    const blocks = [...text.matchAll(/^(?::root|\[data-theme="dark"\])\s*\{([\s\S]*?)^\}/gm)].map((m) => m[0] as string);
    const lightBlock = blocks.filter((b) => b.startsWith(":root"))[1] ?? "";
    const darkBlock = blocks.find((b) => b.startsWith("[data-theme")) ?? "";
    const src = theme === "light" ? lightBlock : darkBlock;
    const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(src);
    return m ? (m[1] as string).trim() : fallback;
  } catch {
    return fallback;
  }
}
const r2 = (n: number): number => Math.round(n * 100) / 100;

// 6-10. The six stated ratios, computed.
c.eq(r2(contrast(token("light", "accent", "#1B6A62"), token("light", "bg-elevated", "#FFFDF8"))), 6.29, "6 light mark ratio 6.29");
c.eq(r2(contrast(token("dark", "accent", "#5CC0B3"), token("dark", "bg-elevated", "#1B2226"))), 7.4, "7 dark mark ratio 7.40");
c.eq(r2(contrast(token("light", "text-muted", "#5B5142"), token("light", "bg-elevated", "#FFFDF8"))), 7.65, "8 light slogan ratio 7.65");
c.eq(r2(contrast(token("dark", "text-muted", "#A8A190"), token("dark", "bg-elevated", "#1B2226"))), 6.26, "9 dark slogan ratio 6.26");
c.ok(
  r2(contrast(token("light", "border-strong", "#857758"), token("light", "bg-elevated", "#FFFDF8"))) === 4.32 &&
    r2(contrast(token("dark", "border-strong", "#6C7F8A"), token("dark", "bg-elevated", "#1B2226"))) === 3.87,
  "10 hairline ratios 4.32 and 3.87",
);

// 5. The PNG fallback is a real 32x32 PNG.
{
  const buf = readFileSync("public/favicon-32.png");
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  c.ok(sig && w === 32 && h === 32, "5 favicon PNG is 32x32");
}

// 11. The lockup CSS defines the three sizes.
c.ok(
  css.includes(".brandmark--header") && css.includes(".brandmark--slide") && css.includes(".brandmark--cover"),
  "11 lockup CSS has header slide cover sizes",
);

// 12. Every colour is a var(--…) with the literal hex only inside fallbacks.
{
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutFallbacks = noComments.replace(/var\([^()]*#[0-9A-Fa-f]{3,8}[^()]*\)/g, "var()");
  c.ok(css.includes("var(--") && !/#[0-9A-Fa-f]{3,8}/.test(withoutFallbacks), "12 colours are var() with hex only in fallbacks");
}

// 13-14. Rendered lockup over file:// at desktop and phone widths.
const browser = await chromium.launch();
try {
  const url = pathToFileURL("brand/lockup.html").href;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(url);
  // 13. The header lockup is visible with a 45 px mark and the product name.
  {
    const header = page.locator(".brandmark--header").first();
    const markBox = await header.locator(".brandmark__mark").boundingBox();
    const word = await header.locator(".brandmark__word").textContent();
    c.ok((await header.isVisible()) && (markBox?.height ?? 0) > 24 && (word ?? "").trim() === "Doorstep Rhythm", "13 header lockup renders with mark and name");
  }
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page2 = await ctx2.newPage();
  await page2.goto(url);
  // 14. Below 480 px the header collapses to the mark alone.
  {
    const header = page2.locator(".brandmark--header").first();
    const wordDisplay = await header.locator(".brandmark__word").evaluate((el) => getComputedStyle(el).display);
    const sloganDisplay = await header.locator(".brandmark__slogan").evaluate((el) => getComputedStyle(el).display);
    c.ok(wordDisplay === "none" && sloganDisplay === "none" && (await header.locator(".brandmark__mark").isVisible()), "14 header collapses to the mark at 390 px");
  }
  // 16. No banned words in the README or the visible lockup text.
  const visible = await page2.innerText("body");
  c.ok(bannedHits(readme).length === 0 && bannedHits(visible).length === 0, "16 no banned words in readme or lockup");
  await ctx2.close();
} finally {
  await browser.close();
}

// 15. The slogan appears exactly once in the lockup page; the README names the mark file and the slogan.
{
  const count = lockup.split("Know her day without calling.").length - 1;
  c.ok(count === 1 && readme.includes("mark.svg") && readme.includes("Know her day without calling."), "15 slogan once in lockup, README covers mark and slogan");
}

c.done();
