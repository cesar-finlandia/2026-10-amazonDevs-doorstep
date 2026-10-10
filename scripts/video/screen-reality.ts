// scripts/video/screen-reality.ts — DP-SCRIPT WU-02 step 3.
// Runs the demo-scenario steps with runStep and records, after each step,
// the visible text + bounding rect of the regions the film names.
// Writes video/facts/screen-reality.json + one 1920x1080 PNG per step.
// Prints `screen-reality: <n> steps, <m> regions`.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { readDemoScenario, runStep } from "../../hee/src/showcase/scenario.js";
import { GL_ARGS } from "../../e2e/helpers.js";
import { PROJECT, readJson, writeJson, blocked } from "./lib.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const baseUrl = arg("--base-url") ?? ((): string => {
  try {
    const rec = readJson(`${PROJECT}/deploy-record.json`) as { url?: string };
    if (typeof rec.url === "string" && rec.url !== "") return rec.url;
  } catch { /* ignore */ }
  return "";
})();
if (baseUrl === "") blocked("screen-reality: no address (pass --base-url)");

const REGIONS = ["approval-bar", "week-ribbon", "check-panel", "incident-card", "activity-feed", "scene-3d", "live-view", "open-checks"];
const scenario = readDemoScenario("design_documents/demo-scenario.json");
const browser = await chromium.launch({ args: GL_ARGS });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const record: Record<string, { regions: Record<string, { text: string; rect: { x: number; y: number; width: number; height: number } | null }> }> = {};
try {
  for (const step of scenario.steps) {
    await runStep(page as never, step, baseUrl);
    const regions: Record<string, { text: string; rect: { x: number; y: number; width: number; height: number } | null }> = {};
    for (const region of REGIONS) {
      const loc = page.locator(`[data-result-region="${region}"]`).first();
      const n = await loc.count();
      if (n === 0) continue;
      const text = (await loc.innerText().catch(() => "")).slice(0, 300);
      const box = await loc.boundingBox().catch(() => null);
      regions[region] = {
        text,
        rect: box === null ? null : { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
      };
    }
    // Agent chip (not a result region).
    const chip = page.locator("header.appbar").locator(".status-chip").filter({ hasText: "Agent" }).first();
    if ((await chip.count()) > 0) {
      const text = (await chip.innerText().catch(() => "")).slice(0, 120);
      const box = await chip.boundingBox().catch(() => null);
      regions["agent-chip"] = {
        text,
        rect: box === null ? null : { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
      };
    }
    record[step.id] = { regions };
    const png = await page.screenshot();
    const sized = await sharp(png).resize(1920, 1080, { fit: "fill" }).png().toBuffer();
    mkdirSync(`${PROJECT}/video/facts/reality`, { recursive: true });
    writeFileSync(`${PROJECT}/video/facts/reality/${step.id}.png`, sized);
  }
} finally {
  await browser.close();
}
writeJson(`${PROJECT}/video/facts/screen-reality.json`, record);
const regionCount = new Set(Object.values(record).flatMap((r) => Object.keys(r.regions))).size;
console.log(`screen-reality: ${Object.keys(record).length} steps, ${regionCount} regions`);
