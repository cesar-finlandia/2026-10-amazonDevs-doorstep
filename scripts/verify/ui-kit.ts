// scripts/verify/ui-kit.ts — shared by the sixteen UI scripts (DP-UI §3.4, §8).
// Requirement IDs: FR-19
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { RunningServer } from "src/server/start.js";
import { startTestServer } from "./at-kit.js";

export { createChecker } from "./at-kit.js";

export const PLAN_PATH = "design_documents/design_plans/DP-UI.md";

export function planText(): string {
  return readFileSync(PLAN_PATH, "utf8");
}

/** The text of the first fenced block of language `lang` (or any language when
 *  omitted) that contains `needle`. Throws `no block containing "<needle>"`
 *  otherwise. Strips exactly the opening and closing fence lines and keeps one
 *  trailing newline. */
export function planBlock(needle: string, lang?: string): string {
  const lines = planText().split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^(`{3,})\s*(\w*)\s*$/.exec(lines[i] as string);
    if (!open) continue;
    const fence = open[1] as string;
    const blockLang = open[2] as string;
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j] as string;
      if (/^`{3,}\s*$/.test(line) && (line.match(/`/g) ?? []).length >= fence.length) break;
      j += 1;
    }
    if (j >= lines.length) throw new Error(`no block containing "${needle}"`);
    const inner = lines.slice(i + 1, j).join("\n") + "\n";
    if ((lang === undefined || blockLang === lang) && inner.includes(needle)) return inner;
    i = j;
  }
  throw new Error(`no block containing "${needle}"`);
}

/** The cells, with backticks removed, of the data rows of the first Markdown
 *  table whose header row starts with `headerStart`. */
export function planTable(headerStart: string): string[][] {
  const lines = planText().split("\n");
  for (let i = 0; i + 1 < lines.length; i++) {
    const head = lines[i] as string;
    const norm = head.trim().replace(/^\|\s*/, "");
    if (!norm.startsWith(headerStart) || !head.includes("|")) continue;
    const sep = (lines[i + 1] as string).trim();
    if (!/^\|?[\s:|-]+\|?[\s:|.-]*$/.test(sep) || !sep.includes("-")) continue;
    const rows: string[][] = [];
    for (let k = i + 2; k < lines.length; k++) {
      const row = (lines[k] as string).trim();
      if (!row.startsWith("|")) break;
      const cells = row
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/`/g, ""));
      rows.push(cells);
    }
    return rows;
  }
  throw new Error(`no table starting with "${headerStart}"`);
}

export function sh(cmd: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(cmd, args, { cwd: process.cwd(), encoding: "utf8", shell: true });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { code: r.status ?? 1, out };
}

function newestSourceMs(): number {
  let newest = 0;
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        try {
          const ms = statSync(p).mtimeMs;
          if (ms > newest) newest = ms;
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk("src/ui");
  walk("src/3d");
  for (const f of ["index.html", "vite.config.ts"]) {
    try {
      const ms = statSync(f).mtimeMs;
      if (ms > newest) newest = ms;
    } catch {
      /* ignore */
    }
  }
  walk("public");
  return newest;
}

/** `npx vite build` when dist/index.html is missing or older than any file
 *  under src/ui or src/3d, index.html, vite.config.ts or public/. */
export async function ensureBuilt(): Promise<void> {
  const index = "dist/index.html";
  let built = 0;
  try {
    built = statSync(index).mtimeMs;
  } catch {
    built = 0;
  }
  if (!existsSync(index) || built < newestSourceMs()) {
    const r = spawnSync("npx", ["vite", "build", "--logLevel", "error"], {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: true,
      timeout: 300000,
      env: { ...process.env, VITE_UI_BUILD: "1" },
    });
    if ((r.status ?? 1) !== 0) throw new Error(`vite build failed: ${r.stdout ?? ""}${r.stderr ?? ""}`);
  }
}

export interface UiRun {
  page: Page;
  url: string;
  server: RunningServer;
  close(): Promise<void>;
}

export interface OpenAppOptions {
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  storedTheme?: string | null;
  path?: string;
  env?: Record<string, string | undefined>;
  reducedMotion?: "reduce" | "no-preference";
  overrides?: Record<string, unknown>;
  initScript?: string;
}

/** Reads the browser session's WeekModel (plain JSON) through the test hook. */
export async function readModel(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() =>
    JSON.parse(JSON.stringify((window as unknown as { __doorstep: { session: { store: { getState(): unknown } } } }).__doorstep.session.store.getState())) as Record<string, unknown>,
  );
}

/** Arrays pass through; records become their values. */
export function listOf<T>(x: T[] | Record<string, T>): T[] {
  return Array.isArray(x) ? x : Object.values(x);
}

/** Waits until the ribbon stops growing (ingests land in sequence). */
export async function waitCalm(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll(".tick").length > 20, { timeout: 30000 });
  let prev = -1;
  for (let i = 0; i < 12; i++) {
    const n = await page.locator(".tick").count();
    if (n === prev) return;
    prev = n;
    await page.waitForTimeout(400);
  }
}

/** Clicks "Review the week", approves every approval request, waits for done (60 s). */
export async function reviewTheWeek(page: Page): Promise<void> {
  await page.locator('[data-slot="agent"] button:has-text("Review the")').click();
  const start = Date.now();
  while (Date.now() - start < 60000) {
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
  const phase = await page.evaluate(() => document.querySelector("[data-run-status]")?.getAttribute("data-run-phase") ?? "?");
  throw new Error(`review did not finish within 60 s; last phase ${phase}`);
}

export interface CraftAssertion {
  name: string;
  ok: boolean;
  detail: string;
}

/** The nine assertions of DP-UI §5.11 (§11 of the craft contract), run in the
 *  rendered page via one page.evaluate. Snippets run unchanged; each result
 *  carries ok (the snippet's "must be" condition) and detail (the first five
 *  offending class names or texts). Reused by WU-14's screenshot manifest. */
export async function CRAFT_ASSERTIONS(page: Page): Promise<CraftAssertion[]> {
  return page.evaluate(() => {
    const first5 = (xs: string[]): string => xs.slice(0, 5).join(" | ");
    const R = (el: Element): DOMRect => el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;

    // 1. Nothing overflows the viewport horizontally (§10).
    const spill = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = R(el);
        return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5);
      })
      .map((el) => el.className || el.tagName); // must be []

    // 2. No element's text overflows its own box (§3, §4) — the "text outside the label" defect.
    const clipped = [...document.querySelectorAll("button,.chip,.badge,.metric__value,h1,h2,h3,td,th,label")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .map((el) => (el.textContent ?? "").trim().slice(0, 40)); // must be []

    // 3. No live number wraps (§4.2).
    const wrapped = [...document.querySelectorAll(".metric__value,[data-metric]")]
      .filter((el) => el.getClientRects().length > 1)
      .map((el) => (el.textContent ?? "").trim()); // must be []

    // 4. Live numbers are tabular (§4.1).
    const notTabular = [...document.querySelectorAll(".metric__value,[data-metric]")]
      .filter((el) => !getComputedStyle(el).fontVariantNumeric.includes("tabular-nums"))
      .map((el) => (el.textContent ?? "").trim()); // must be []

    // 5. Every surface is an object, not a background (§3).
    const flatCards = [...document.querySelectorAll("[data-surface]")]
      .filter((el) => {
        const s = getComputedStyle(el);
        return s.borderStyle === "none" && s.boxShadow === "none";
      })
      .map((el) => (el as HTMLElement).dataset["surface"] ?? el.tagName); // must be []

    // 6. Message templates are total (§5.4).
    const broken = [...document.querySelectorAll('[data-message],[role="status"],[role="alert"]')]
      .map((el) => (el.textContent ?? "").trim())
      .filter((t) => /(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/.test(t)); // must be []

    // 7. Help coverage (§7.4).
    const resultRegions = document.querySelectorAll("[data-result-region]").length;
    const helpButtons = document.querySelectorAll("[data-help-for]").length;
    const explainer = !!document.querySelector("[data-app-explainer]");
    // helpButtons >= resultRegions, and explainer === true

    // 8. A real typeface loaded (§9).
    const bodyFont = getComputedStyle(document.body).fontFamily;
    const realFace = !/^\s*(system-ui|-apple-system|sans-serif|serif)\s*(,|$)/.test(bodyFont);
    // realFace === true, and document.fonts.status === 'loaded'

    // 9. Accent is doing work (§6.2) — at least three elements painted with the accent token.
    // NOTE on the comparison: getPropertyValue('--accent') returns the
    // specified value (hex), while computed color/backgroundColor resolve to
    // rgb(), so the raw strings never match. The token is normalised through
    // a probe element first; the counted elements and the >= 3 bar are the
    // snippet's own.
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    document.body.appendChild(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const accentUses = [...document.querySelectorAll("body *")].filter((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.borderColor].some(
        (v) => v && v !== "none" && v.replace(/\s/g, "") === accent.replace(/\s/g, ""),
      );
    }).length; // >= 3

    return [
      { name: "assertion 1", ok: spill.length === 0, detail: first5(spill.map(String)) },
      { name: "assertion 2", ok: clipped.length === 0, detail: first5(clipped) },
      { name: "assertion 3", ok: wrapped.length === 0, detail: first5(wrapped) },
      { name: "assertion 4", ok: notTabular.length === 0, detail: first5(notTabular) },
      { name: "assertion 5", ok: flatCards.length === 0, detail: first5(flatCards) },
      { name: "assertion 6", ok: broken.length === 0, detail: first5(broken) },
      {
        name: "assertion 7",
        ok: helpButtons >= resultRegions && explainer,
        detail: `help=${helpButtons} regions=${resultRegions} explainer=${explainer}`,
      },
      {
        name: "assertion 8",
        ok: realFace && document.fonts.status === "loaded",
        detail: `${bodyFont} fonts=${document.fonts.status}`,
      },
      { name: "assertion 9", ok: accentUses >= 3, detail: `accentUses=${accentUses}` },
    ];
  });
}

export async function openApp(opts?: OpenAppOptions): Promise<UiRun> {
  await ensureBuilt();
  const { createLogger } = await import("src/server/logger.js");
  const server = await startTestServer({
    env: { NODE_ENV: "test", BUILD_MARKER: "test-1", AGENT_PROVIDER: "golden", ...(opts?.env ?? {}) },
    config: { staticDir: "dist" },
    overrides: { log: createLogger({ write: () => undefined }), ...((opts?.overrides ?? {}) as Record<string, unknown>) } as never,
  });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: opts?.width ?? 1440, height: opts?.height ?? 900 },
    colorScheme: opts?.theme ?? "light",
    reducedMotion: opts?.reducedMotion ?? "no-preference",
  });
  const stored = opts?.storedTheme === undefined ? opts?.theme : opts?.storedTheme;
  if (opts?.initScript) await context.addInitScript(opts.initScript);
  const page = await context.newPage();
  const url = server.url + (opts?.path ?? "/");
  async function load(): Promise<void> {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
  }
  await load();
  // Seed the stored theme AFTER first paint, then load once more, so the
  // inline first-paint script reads it exactly as a returning visitor would.
  // (An init script cannot be used: it would re-apply on every reload and
  // hide real persistence behaviour.)
  if (stored !== undefined && stored !== null) {
    await page.evaluate((t) => localStorage.setItem("dr-theme", t), stored);
    await load();
  }
  return {
    page,
    url: server.url,
    server,
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
