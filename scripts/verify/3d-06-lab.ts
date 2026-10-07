// scripts/verify/3d-06-lab.ts — DP-3D WU-3D-06 (12 checks).
// The /lab tuning page.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { bannedHits } from "src/llm/guard.js";
import { DEFAULT_LAB_TUNING } from "src/kits/three-scene/src/react/index.js";
import type { LabTuning } from "src/kits/three-scene/src/react/index.js";
import { formatLabValues } from "src/3d/lab-values.js";
import { OVERVIEW, WALK } from "src/3d/shots.js";
import { open3d, settle, waitNear, waitScene } from "./3d-kit.js";
import type { ThreeRun } from "./3d-kit.js";
import { CRAFT_ASSERTIONS, createChecker } from "./ui-kit.js";

const c = createChecker("3d-06-lab");

type Pose = { position: [number, number, number]; target: [number, number, number] };

interface LabWindow {
  __lab: {
    levaStore: { setValueAtPath(path: string, value: unknown, fromPanel?: boolean): void };
    read(): LabTuning;
  };
}

const readLab = (page: Page): Promise<LabTuning> =>
  page.evaluate(() => (window as unknown as LabWindow).__lab.read());

const canvasHash = async (page: Page): Promise<string> =>
  createHash("sha256")
    .update(await page.locator("[data-demo-3d] canvas").first().screenshot())
    .digest("hex");

/** Waits until the lab hook and the 3D scene are ready. */
async function waitLab(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __lab?: unknown }).__lab !== undefined, { timeout: 20000 });
  await waitScene(page);
  // The sample week arrives after mount.
  await page.waitForFunction(
    () => (window as unknown as { __scene3d: { entityCount(): number } }).__scene3d.entityCount() > 10,
    { timeout: 20000 },
  );
}

// 6. formatLabValues keeps DEFAULT_LAB_TUNING's key order, two-space indent, no trailing newline.
{
  const text = formatLabValues(DEFAULT_LAB_TUNING);
  const keys = Object.keys(JSON.parse(text) as Record<string, number>);
  c.ok(
    JSON.stringify(keys) === JSON.stringify(Object.keys(DEFAULT_LAB_TUNING)) &&
      text.split("\n")[1]?.startsWith('  "') === true &&
      !text.endsWith("\n"),
    "6 formatLabValues orders keys like DEFAULT_LAB_TUNING, indents by two, ends without a newline",
  );
}

// 12. The page keeps its default export name and the route keeps its import path.
{
  const lab = readFileSync("src/ui/pages/Lab.tsx", "utf8");
  const routes = readFileSync("src/ui/routes.tsx", "utf8");
  c.ok(
    /export default function LabPage/.test(lab) && /from "\.\/pages\/Lab\.js"/.test(routes),
    "12 Lab.tsx exports default LabPage and the route table still imports pages/Lab.js",
  );
}

const runs: ThreeRun[] = [];
const track = async (opts: Parameters<typeof open3d>[0]): Promise<ThreeRun> => {
  const r = await open3d(opts);
  runs.push(r);
  return r;
};

try {
  const main = await track({ path: "/?hook=1&quality=low" });
  const page = main.page;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: main.url });

  // 7. The product's home page does not link to the lab and mounts no leva panel.
  {
    const links = await page.locator('a[href="/lab"]').count();
    const leva = await page.locator('[class*="leva"]').count();
    c.ok(links === 0 && leva === 0, `7 / has no link to /lab and no leva element (${links}, ${leva})`);
  }

  await page.goto(`${main.url}/lab?hook=1&quality=low`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
  await waitLab(page);

  // 1. One lab root, one scene marker, a canvas, a populated scene.
  {
    const lab = await page.locator('[data-demo-focus="lab"]').count();
    const marker = await page.locator("[data-demo-3d]").count();
    const canvas = await page.locator("canvas").count();
    const entities = await page.evaluate(() =>
      (window as unknown as { __scene3d: { entityCount(): number } }).__scene3d.entityCount(),
    );
    c.ok(lab === 1 && marker === 1 && canvas >= 1 && entities > 10, `1 one lab root, one scene, a canvas, ${entities} entities`);
  }

  // 2. The panel lists the nine controls.
  {
    const text = await page.evaluate(() =>
      [...document.querySelectorAll('[class*="leva-c"]')].map((el) => el.textContent ?? "").join(" "),
    );
    const names = ["keyIntensity", "keyAzimuth", "keyElevation", "hemisphere", "roughness", "metalness", "fov", "aoIntensity", "aoRadius"];
    const missing = names.filter((n) => !text.includes(n));
    c.ok(missing.length === 0, `2 the leva panel shows all nine controls (missing: ${missing.join(", ") || "none"})`);
  }

  // 3. Untouched, the values are the kit's defaults.
  c.eq(await readLab(page), { ...DEFAULT_LAB_TUNING }, "3 read() equals DEFAULT_LAB_TUNING before any change");

  // 4. Setting a value reaches read(), the values well and the pixels.
  {
    await settle(page, 5000, OVERVIEW);
    const before = await canvasHash(page);
    await page.evaluate(() => (window as unknown as LabWindow).__lab.levaStore.setValueAtPath("Light.keyIntensity", 4, true));
    const read = (await readLab(page)).keyIntensity;
    const shown = await page
      .waitForFunction(() => document.querySelector("[data-lab-values]")?.textContent?.includes('"keyIntensity": 4') === true, undefined, { timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(800);
    const after = await canvasHash(page);
    c.ok(read === 4 && shown && before !== after, `4 keyIntensity 4 reaches read() (${read}), the values well (${shown}) and the canvas (${before !== after})`);
  }

  // 5. Copy values puts nine numeric keys, equal to read(), on the clipboard.
  {
    await page.locator("[data-lab-copy]").click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const parsed = JSON.parse(clip) as Record<string, unknown>;
    const expected = await readLab(page);
    const copied = await page.locator(".lab__copied").textContent();
    c.ok(
      Object.keys(parsed).length === 9 &&
        Object.values(parsed).every((v) => typeof v === "number") &&
        JSON.stringify(parsed) === JSON.stringify(expected) &&
        copied === "Copied.",
      "5 Copy values leaves the nine numeric values on the clipboard and says Copied.",
    );
  }

  // 8. The heading, and the shot buttons move the camera within 1.5 s.
  {
    const h1 = (await page.locator("h1").first().textContent())?.trim();
    const click = (name: string): Promise<unknown> =>
      page.evaluate((n: string) => {
        const btn = [...document.querySelectorAll(".lab__shots button")].find((b) => b.textContent?.trim() === n);
        (btn as HTMLElement).click();
      }, name);
    const leg = async (from: Pose, name: string, to: Pose): Promise<boolean> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.evaluate((s: string) => (window as unknown as { __demo3d: { play(x: string): void } }).__demo3d.play(s), from === OVERVIEW ? "overview" : "walk");
        await settle(page, 5000, from);
        const t0 = Date.now();
        await click(name);
        if (await waitNear(page, to, 1500 - (Date.now() - t0))) return true;
      }
      return false;
    };
    const walk = await leg(OVERVIEW, "Walk", WALK);
    const over = await leg(WALK, "Overview", OVERVIEW);
    c.ok(h1 === "Tuning lab" && walk && over, `8 the heading reads Tuning lab and Walk (${walk}) and Overview (${over}) frame their poses`);
  }

  // 9, 10, 11. At 1440 × 900 in both themes.
  const crafted: boolean[] = [];
  const wells: string[] = [];
  const texts: string[] = [];
  const craftFailures: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    const t = await track({ path: "/lab?hook=1&quality=low", width: 1440, height: 900, theme });
    await waitLab(t.page);
    const box = await t.page.evaluate(() => {
      const well = document.querySelector(".lab__stage") as HTMLElement;
      const r = well.getBoundingClientRect();
      return { w: r.width, h: r.height, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    wells.push(`${theme} ${Math.round(box.w)}x${Math.round(box.h)}${box.overflow ? " overflow" : ""}`);
    if (box.w < 900 || box.h < 540 || box.overflow) crafted.push(false);
    else crafted.push(true);
    const results = await CRAFT_ASSERTIONS(t.page);
    if (results.length !== 9) craftFailures.push(`${theme}: ${results.length} assertions`);
    craftFailures.push(...results.filter((r) => !r.ok).map((r) => `${theme} ${r.name}: ${r.detail}`));
    texts.push(await t.page.evaluate(() => document.body.innerText ?? ""));
  }
  c.ok(crafted.every(Boolean), `9 the scene well is at least 900 x 540 with no horizontal overflow (${wells.join("; ")})`);
  c.ok(craftFailures.length === 0, `10 all nine craft assertions pass on /lab in both themes ${craftFailures.join(" | ")}`);
  c.ok(texts.every((t) => bannedHits(t).length === 0), `11 the visible text of /lab has no banned words (${texts.flatMap((t) => bannedHits(t)).join(", ")})`);
} finally {
  for (const r of runs.reverse()) await r.close();
}

c.done();
