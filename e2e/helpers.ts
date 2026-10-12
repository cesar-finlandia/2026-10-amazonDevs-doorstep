// e2e/helpers.ts — shared Playwright helpers (DP-E2E-BROWSER-TESTING §3.2).
// Requirement IDs: FR-06, FR-07, FR-09, FR-19
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { WeekModel } from "src/domain/types";
import { saveTraceFromPage } from "../hee/kits/agent-workflow/src/node/saveTrace";

// Where the machine has a graphics API Chromium can drive headless (Windows: Direct3D 11
// through ANGLE, which falls back to WARP without a GPU; macOS: Metal) the page draws
// there: a software rasteriser on the CPU made every review 3-10x slower and two
// parallel workers starve each other (FIX-13). Linux, or E2E_GPU=0, keeps the portable
// software list of DP-3D section 5.10. E2E_GPU=1 forces the hardware list.
const SOFTWARE_GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"];
const HARDWARE_GL: Record<string, string[]> = {
  win32: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl"],
  darwin: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl"],
};
const GPU_PREF = process.env["E2E_GPU"];
export const GL_ARGS: string[] =
  GPU_PREF === "0" ? SOFTWARE_GL : (HARDWARE_GL[process.platform] ?? (GPU_PREF === "1" ? HARDWARE_GL["win32"] ?? SOFTWARE_GL : SOFTWARE_GL));
export const SIZE_DESKTOP: { width: 1280; height: 720 } = { width: 1280, height: 720 };
export const SIZE_WIDE: { width: 1440; height: 900 } = { width: 1440, height: 900 };
export const SIZE_PHONE: { width: 390; height: 844 } = { width: 390, height: 844 };

/** Random lowercase-hex secret from crypto.randomBytes(bytes). Used for webhook and linking keys; never printed. */
export function randomSecret(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}

/** goto(path) with `?hook=1` appended, then waits for body[data-app-ready="true"] and document.fonts.ready. Returns the console collector's page-level state. */
export async function openHome(page: Page, opts?: { path?: string; hook?: boolean }): Promise<void> {
  const base = process.env["BASE_URL"] ?? "";
  const path = opts?.path ?? "/";
  const hook = opts?.hook ?? true;
  const sep = path.includes("?") ? "&" : "?";
  await page.goto(hook ? `${base}${path}${sep}hook=1` : `${base}${path}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
}

/** JSON.parse(await page.evaluate(() => JSON.stringify(window.__doorstep.session.store.getState()))) — needs `?hook=1`. */
export async function readModel(page: Page): Promise<WeekModel> {
  const raw = await page.evaluate(() =>
    JSON.parse(
      JSON.stringify(
        (window as unknown as { __doorstep: { session: { store: { getState(): unknown } } } })
          .__doorstep.session.store.getState(),
      ),
    ),
  );
  return raw as WeekModel;
}

/** Presses "Load the sample week" and waits until at least 21 `.tick` elements exist. */
export async function loadSampleWeek(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Load the sample week" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".tick").length >= 21, {
    timeout: 30000,
  });
}

/** Settles the streaming ingest Load-the-sample-week starts (webhook drain plus
 *  both history channels land in sequence): waits until the event count AND
 *  the rendered tick count stop changing. Ledger-sensitive tests must call
 *  this after loadSampleWeek, or background landings race their before/after
 *  reads (FIX-11). Condition waits only, never a fixed sleep above 250 ms. */
export async function settleSampleWeek(page: Page): Promise<void> {
  let last = -1;
  let lastTicks = -1;
  let stable = 0;
  const settledAt = Date.now();
  for (;;) {
    const n = (await readModel(page)).events.length;
    const t = await page.locator(".tick").count();
    // The history channels land with gaps between them; one quiet poll is not
    // the end of the ingest, six (1.5 s) are.
    stable = n === last && t === lastTicks ? stable + 1 : 0;
    if (stable >= 6) return;
    last = n;
    lastTicks = t;
    if (Date.now() - settledAt > 30000) throw new Error("the sample week did not settle");
    await page.waitForTimeout(250);
  }
}

/** Presses the primary button of the Agent panel ("Review the sample week" or "Review the week"), approves every approval request that appears (button "Approve"), waits for body-level [data-run-status="done"] on the Agent panel's wrapper, and returns the number of approvals given. Settles the streaming ingest first: a review started mid-stream chases moving data (repair never converges while twins land), which is a fixture race, not product behavior (FIX-12). */
export async function reviewTheWeek(page: Page, opts?: { timeoutMs?: number }): Promise<number> {
  // Default ceiling covers the bedrock rung: a live review makes nineteen
  // model turns (minutes). Golden/local runs finish far inside it.
  const timeoutMs = opts?.timeoutMs ?? 600000;
  await settleSampleWeek(page);
  await page.getByRole("button", { name: /Review the (sample )?week/ }).first().click();
  let approvals = 0;
  const start = Date.now();
  for (;;) {
    const status = await page.evaluate(
      () => document.querySelector("[data-run-status]")?.getAttribute("data-run-status"),
    );
    if (status === "done" || status === "stopped") return approvals;
    if (status === "error") {
      const banner = await page.locator(".callout, [role=alert]").first().innerText().catch(() => "");
      throw new Error(`review ended in error: ${banner.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    try {
      // count() never waits (isVisible() can hang on a busy page and burn the
      // 90 s test budget); click with a short timeout so a mid-render detach
      // retries next poll instead of stalling the loop (FIX-4).
      const approve = page.locator('[data-result-region="approval-bar"]').getByRole("button", { name: "Approve" }).first();
      if ((await approve.count()) > 0) {
        await approve.click({ timeout: 3000 });
        approvals += 1;
        continue;
      }
    } catch {
      /* the panel re-renders mid-poll; the next iteration retries */
    }
    if (Date.now() - start > timeoutMs) {
      const phase = await page.evaluate(
        () => document.querySelector("[data-run-status]")?.getAttribute("data-run-phase") ?? "?",
      );
      throw new Error(`review did not finish within ${timeoutMs} ms; last phase ${phase}`);
    }
    await page.waitForTimeout(100);
  }
}

/** Opens an incident without the agent: `await window.__doorstep.openFirstCandidate()`; returns its id or null. */
export async function openFirstCandidate(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    (window as unknown as { __doorstep: { openFirstCandidate(): string | null } }).__doorstep.openFirstCandidate(),
  );
}

/** `window.__doorstep.session.checkNow()` serialised: the current issue list of the truth engine. */
export async function checkNow(
  page: Page,
): Promise<{ id: string; severity: "error" | "warning"; message: string }[]> {
  const raw = await page.evaluate(() =>
    JSON.parse(
      JSON.stringify(
        (window as unknown as { __doorstep: { session: { checkNow(): unknown } } }).__doorstep
          .session.checkNow(),
      ),
    ),
  );
  // session.checkNow() answers { issues, counts } (src/domain/session.ts); the
  // scenarios assert over the issue list, so unwrap it here (a bare list is
  // still accepted, for tolerance).
  const list = (raw as { issues?: unknown }).issues ?? raw;
  return list as { id: string; severity: "error" | "warning"; message: string }[];
}

/** Reads window.__runTrace.get() and writes it as JSON to `path` (the kit's saveTraceFromPage). Returns the entry count. */
export async function saveTrace(page: Page, path: string): Promise<number> {
  await saveTraceFromPage(page, path);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { entries?: unknown };
  return Array.isArray(parsed.entries) ? parsed.entries.length : 0;
}

/** Waits until `window.__scene3d.ready()` is true and a first frame has been drawn. */
export async function waitScene(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const hook = (window as unknown as { __scene3d?: { ready(): boolean } }).__scene3d;
      return hook !== undefined && hook !== null && hook.ready() === true;
    },
    undefined,
    { timeout: 30000 },
  );
  await page.waitForFunction(
    () => {
      const hook = (window as unknown as { __scene3d?: { frames?: () => number } }).__scene3d;
      if (!hook || typeof hook.frames !== "function") return true;
      try {
        return hook.frames() > 0;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 30000 },
  );
}

/** Luminance variance over a 64×64 grid of a screenshot of the 3D stage element
 *  (DP-3D §3 variance64, the same grid). */
export async function stageVariance(page: Page): Promise<number> {
  const shot = await page.locator('[data-demo-3d="doorway-week"]').first().screenshot();
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
