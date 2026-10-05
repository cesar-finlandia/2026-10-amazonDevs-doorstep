// scripts/ui-screenshots.ts — DP-UI WU-UI-14: the twenty acceptance screenshots.
// Writes design_documents/ui-screenshots/*.png + manifest.json, prints each
// written path on its own line and then `screenshots: 20 written`.
// Requirement IDs: FR-19
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";
import { CRAFT_ASSERTIONS, openApp, reviewTheWeek, waitCalm } from "./verify/ui-kit.js";
import type { UiRun } from "./verify/ui-kit.js";

const OUT = "design_documents/ui-screenshots";
mkdirSync(OUT, { recursive: true });

interface Shot {
  file: string;
  width: number;
  height: number;
  theme: string;
  textSeen: string[];
  craft: boolean;
}
const manifest: Shot[] = [];

async function text(page: Page): Promise<string> {
  return (await page.evaluate(() => document.body.innerText ?? "")) as string;
}

async function expectSeen(page: Page, shot: string, ...needles: string[]): Promise<string[]> {
  const body = await text(page);
  const seen: string[] = [];
  for (const n of needles) {
    if (!body.includes(n)) throw new Error(`${shot}: expected text ${JSON.stringify(n)} not on screen`);
    seen.push(n);
  }
  return seen;
}

async function loadSample(page: Page): Promise<void> {
  await page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
  await waitCalm(page);
}

/** The approve-and-wait tail of reviewTheWeek for a run already started. */
async function finishReview(page: Page): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 90000) {
    const approve = page.locator('[data-result-region="approval-bar"] button:has-text("Approve")');
    if ((await approve.count()) > 0) {
      try {
        if (await approve.first().isVisible()) await approve.first().click();
      } catch {
        /* detached mid-render; the next poll retries */
      }
    }
    const status = await page.evaluate(() => document.querySelector("[data-run-status]")?.getAttribute("data-run-status"));
    if (status === "done") return;
    await page.waitForTimeout(100);
  }
  throw new Error("review did not finish within 90 s");
}

async function openIncident(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate(),
  );
  await page.locator('[data-result-region="incident-card"] h2').waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(400);
}

async function save(run: UiRun, file: string, theme: string, textSeen: string[], craft: boolean, clip?: { x: number; y: number; width: number; height: number }): Promise<void> {
  const path = join(OUT, file);
  const shot = clip
    ? await run.page.screenshot({ path, clip })
    : await run.page.screenshot({ path });
  void shot;
  const viewport = run.page.viewportSize() ?? { width: 0, height: 0 };
  manifest.push({ file, width: clip?.width ?? viewport.width, height: clip?.height ?? viewport.height, theme, textSeen, craft });
  console.log(path);
}

// --- Session 1: 1440 paper — empty, working, approval, home, incident, explainer, help, ribbon, appbar.
{
  const run = await openApp({ width: 1440, height: 900, theme: "light", path: "/?hook=1" });
  try {
    await save(run, "empty-paper.png", "paper", await expectSeen(run.page, "empty", "No doorway events yet"), false);
    await loadSample(run.page);
    await run.page.locator('[data-slot="agent"] button:has-text("Review the")').click();
    await run.page
      .waitForFunction(() => (document.querySelector('[data-slot="agent"] [role="status"]')?.textContent ?? "").includes("Reading doorway events"), { timeout: 30000 });
    await save(run, "working-paper.png", "paper", await expectSeen(run.page, "working", "Reading doorway events"), false);
    await run.page.locator('[data-result-region="approval-bar"] button:has-text("Approve")').first().waitFor({ state: "visible", timeout: 90000 });
    await save(run, "approval-pending-paper.png", "paper", await expectSeen(run.page, "approval", "AGENT WANTS TO"), false);
    await finishReview(run.page);
    // The quiet frame first (no incident selected), then the incident card:
    // the two shots must show different states (ui-14 check 4 needs distinct hashes).
    const homeCraft = (await CRAFT_ASSERTIONS(run.page)).every((r) => r.ok);
    await save(run, "home-paper.png", "paper", [], homeCraft);
    await openIncident(run.page);
    await save(run, "incident-selected-paper.png", "paper", [], false);
    await run.page.locator("[data-app-explainer]").first().click();
    await run.page.locator("[data-app-explainer-panel]").waitFor({ state: "visible", timeout: 10000 });
    await save(run, "explainer-open-paper.png", "paper", [], false);
    await run.page.keyboard.press("Escape");
    await run.page.locator('[data-result-region="check-panel"] [data-help-for]').first().click();
    await run.page.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 10000 });
    await save(run, "help-popover-paper.png", "paper", [], false);
    await run.page.keyboard.press("Escape");
    // The ribbon detail is a full 1440x900 frame composed on the ribbon (an
    // element clip cannot satisfy ui-14 check 2's frame sizes).
    const ribbonLoc = run.page.locator('[data-slot="ribbon"]');
    await ribbonLoc.scrollIntoViewIfNeeded();
    await run.page.waitForTimeout(200);
    await save(run, "ribbon-detail-paper.png", "paper", [], false);
    const barLoc = run.page.locator("header.appbar");
    await barLoc.scrollIntoViewIfNeeded();
    await run.page.waitForTimeout(200);
    const barBox = await barLoc.boundingBox();
    if (!barBox) throw new Error("appbar has no box");
    await save(run, "appbar-paper.png", "paper", [], false, { x: barBox.x, y: barBox.y, width: barBox.width, height: barBox.height });
  } finally {
    await run.close();
  }
}

// --- Session 2: 1440 dusk — home, appbar.
{
  const run = await openApp({ width: 1440, height: 900, theme: "dark", path: "/?hook=1" });
  try {
    await loadSample(run.page);
    await reviewTheWeek(run.page);
    await openIncident(run.page);
    const homeCraft = (await CRAFT_ASSERTIONS(run.page)).every((r) => r.ok);
    await save(run, "home-dusk.png", "dusk", [], homeCraft);
    const barLoc2 = run.page.locator("header.appbar");
    await barLoc2.scrollIntoViewIfNeeded();
    await run.page.waitForTimeout(200);
    const barBox = await barLoc2.boundingBox();
    if (!barBox) throw new Error("appbar has no box");
    await save(run, "appbar-dusk.png", "dusk", [], false, { x: barBox.x, y: barBox.y, width: barBox.width, height: barBox.height });
  } finally {
    await run.close();
  }
}

// --- Session 3: 1280x720 paper home.
{
  const run = await openApp({ width: 1280, height: 720, theme: "light", path: "/?hook=1" });
  try {
    await loadSample(run.page);
    await reviewTheWeek(run.page);
    await openIncident(run.page);
    await save(run, "home-1280x720-paper.png", "paper", [], false);
  } finally {
    await run.close();
  }
}

// --- Session 4: 390 paper home.
{
  const run = await openApp({ width: 390, height: 844, theme: "light", path: "/?hook=1" });
  try {
    await loadSample(run.page);
    await reviewTheWeek(run.page);
    await openIncident(run.page);
    const homeCraft = (await CRAFT_ASSERTIONS(run.page)).every((r) => r.ok);
    await save(run, "home-390-paper.png", "paper", [], homeCraft);
  } finally {
    await run.close();
  }
}

// --- Session 5: 390 dusk home.
{
  const run = await openApp({ width: 390, height: 844, theme: "dark", path: "/?hook=1" });
  try {
    await loadSample(run.page);
    await reviewTheWeek(run.page);
    await openIncident(run.page);
    const homeCraft = (await CRAFT_ASSERTIONS(run.page)).every((r) => r.ok);
    await save(run, "home-390-dusk.png", "dusk", [], homeCraft);
  } finally {
    await run.close();
  }
}

// --- Session 6: dead ring → error banner.
{
  const run = await openApp({ width: 1440, height: 900, theme: "light", path: "/?hook=1" });
  try {
    await run.page.route("**/api/ring/*", (route) => {
      const url = route.request().url();
      if (url.includes("getEventHistory") || url.includes("drainWebhookInbox")) void route.continue();
      else void route.abort("failed");
    });
    await run.page.reload({ waitUntil: "domcontentloaded" });
    const banner = run.page.locator('[data-message][data-tier="banner"]');
    await banner.getByText("Couldn't read Ring").waitFor({ timeout: 15000 });
    await save(run, "error-paper.png", "paper", await expectSeen(run.page, "error", "Couldn't read Ring"), false);
  } finally {
    await run.close();
  }
}

// --- Session 7: golden banner over a loaded week.
{
  const run = await openApp({ width: 1440, height: 900, theme: "light", path: "/?hook=1" });
  try {
    await loadSample(run.page);
    const banner = run.page.locator('[data-message][data-tier="banner"]');
    await banner.getByText("Replaying a recorded run").waitFor({ timeout: 15000 });
    await save(run, "degraded-paper.png", "paper", await expectSeen(run.page, "degraded", "Replaying a recorded run"), false);
  } finally {
    await run.close();
  }
}

// --- Session 8: the kit page at its widest + the two shells.
{
  const run = await openApp({ width: 1440, height: 900, theme: "light", path: "/__kit" });
  try {
    await run.page.locator('[data-kit="metric"]').scrollIntoViewIfNeeded();
    await run.page.waitForTimeout(300);
    await save(run, "metrics-widest-paper.png", "paper", await expectSeen(run.page, "metrics", "99+", "999", "$99.9999"), false);
    await run.page.goto(run.url + "/lab", { waitUntil: "domcontentloaded" });
    await run.page.waitForTimeout(500);
    await save(run, "lab-paper.png", "paper", [], false);
    await run.page.goto(run.url + "/watch", { waitUntil: "domcontentloaded" });
    await run.page.waitForTimeout(500);
    await save(run, "watch-paper.png", "paper", [], false);
  } finally {
    await run.close();
  }
}

// --- Session 9: the lockup contact sheet (a static brand file, not the app).
{
  const run = await openApp({ width: 1440, height: 900, theme: "light", path: "/" });
  try {
    await run.page.goto(pathToFileURL("brand/lockup.html").href, { waitUntil: "domcontentloaded" });
    await run.page.waitForTimeout(500);
    await save(run, "lockup-contact-sheet.png", "paper", [], false);
  } finally {
    await run.close();
  }
}

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("screenshots: 20 written");
if (manifest.length !== 20) throw new Error(`expected 20 shots, wrote ${manifest.length}`);
