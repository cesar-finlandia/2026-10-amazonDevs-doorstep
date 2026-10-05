// scripts/verify/ui-04-shell.ts — DP-UI WU-UI-04 (16 checks).
// Requirement IDs: FR-19
import { existsSync, readFileSync } from "node:fs";
import { createChecker, ensureBuilt, openApp } from "./ui-kit.js";

const c = createChecker("ui-04-shell");

// 1. The build resolves; dist/index.html has the root and the favicon link.
{
  await ensureBuilt();
  const html = readFileSync("dist/index.html", "utf8");
  c.ok(existsSync("dist/index.html") && html.includes('<div id="root">') && html.includes('rel="icon"'), "1 dist builds with root and favicon");
}

// 2. Exactly two font preloads, both as="font" with crossorigin.
{
  const html = readFileSync("index.html", "utf8");
  const preloads = [...html.matchAll(/<link rel="preload"[^>]*>/g)].map((m) => m[0]);
  c.ok(
    preloads.length === 2 && preloads.every((l) => l.includes('as="font"') && l.includes("crossorigin")),
    "2 two font preloads with crossorigin",
  );
}

// 3. First-paint theme: scheme wins without storage; storage wins otherwise.
{
  const dark = await openApp({ theme: "dark", storedTheme: null });
  let noStored = "";
  try {
    noStored = await dark.page.evaluate(() => document.documentElement.dataset["theme"]) ?? "";
  } finally {
    await dark.close();
  }
  const light = await openApp({ theme: "dark", storedTheme: "light" });
  let stored = "";
  try {
    stored = await light.page.evaluate(() => document.documentElement.dataset["theme"]) ?? "";
  } finally {
    await light.close();
  }
  c.ok(noStored === "dark" && stored === "light", "3 scheme without storage, storage otherwise");
}

const run = await openApp();
try {
  // 4. / is ready within 5 s with status 200.
  {
    const res = await run.page.goto(run.url + "/", { waitUntil: "domcontentloaded" });
    await run.page.waitForSelector('body[data-app-ready="true"]', { timeout: 5000 });
    c.ok(res?.status() === 200, "4 home ready with 200");
  }

  // 5. Exactly one demo focus per route.
  {
    const home = await run.page.$$("[data-demo-focus]");
    const homeVals = await Promise.all(home.map((e) => e.getAttribute("data-demo-focus")));
    await run.page.goto(run.url + "/watch", { waitUntil: "domcontentloaded" });
    const watch = await run.page.$$("[data-demo-focus]");
    const watchVals = await Promise.all(watch.map((e) => e.getAttribute("data-demo-focus")));
    await run.page.goto(run.url + "/lab", { waitUntil: "domcontentloaded" });
    const lab = await run.page.$$("[data-demo-focus]");
    const labVals = await Promise.all(lab.map((e) => e.getAttribute("data-demo-focus")));
    c.ok(
      homeVals.length === 1 && homeVals[0] === "workbench" && watchVals.length === 1 && watchVals[0] === "replay" &&
        labVals.length === 1 && labVals[0] === "lab",
      "5 one demo focus per route",
    );
  }

  // 6. Unknown routes redirect to /.
  {
    await run.page.goto(run.url + "/nope", { waitUntil: "domcontentloaded" });
    await run.page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
    c.eq(new URL(run.page.url()).pathname, "/", "6 unknown route redirects home");
  }

  await run.page.goto(run.url + "/", { waitUntil: "domcontentloaded" });

  // 7. The 64 px header starts with the brandmark lockup.
  {
    const header = run.page.locator("header").first();
    const height = await header.evaluate((el) => getComputedStyle(el).height);
    const firstClass = await header.evaluate((el) => (el.firstElementChild as HTMLElement | null)?.className ?? "");
    const text = await header.evaluate((el) => (el.firstElementChild as HTMLElement | null)?.textContent ?? "");
    c.ok(height === "64px" && firstClass.includes("brandmark--header") && text.includes("Doorstep Rhythm"), "7 header 64px with brandmark first");
  }

  // 8. Three-column grid at 1440.
  {
    const cols = await run.page.locator(".page").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    const parts = cols.trim().split(/\s+/);
    c.ok(parts[0] === "240px" && parts[parts.length - 1] === "380px", "8 grid 240 and 380 at 1440");
  }

  // 11. The toggle persists across reloads.
  {
    await run.page.locator('aside [role="radio"]:has-text("Dusk")').click();
    const theme = await run.page.evaluate(() => document.documentElement.dataset["theme"]);
    const stored = await run.page.evaluate(() => localStorage.getItem("dr-theme"));
    await run.page.reload({ waitUntil: "domcontentloaded" });
    await run.page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
    const after = await run.page.evaluate(() => document.documentElement.dataset["theme"]);
    c.ok(theme === "dark" && stored === "dark" && after === "dark", "11 dusk persists across reload");
  }

  // 13 (desktop half). No horizontal spill at 1440 on all three routes; the phone half follows below.
  {
    let spill = 0;
    for (const path of ["/", "/watch", "/lab"]) {
      await run.page.goto(run.url + path, { waitUntil: "domcontentloaded" });
      spill += await run.page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5);
        }).length;
      });
    }
    (globalThis as unknown as { __ui04spill?: number }).__ui04spill = spill;
  }

  // 14. Real typeface loaded.
  {
    const fam = await run.page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const status = await run.page.evaluate(() => document.fonts.status);
    c.ok(fam.startsWith('"Atkinson Hyperlegible Next"') && status === "loaded", "14 real typeface loaded");
  }

  // 15. The test hook exists only with ?hook=1; the run trace hook always exists.
  {
    await run.page.goto(run.url + "/?hook=1", { waitUntil: "domcontentloaded" });
    await run.page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
    const hooked = await run.page.evaluate(() => {
      const w = window as unknown as { __doorstep?: { session?: unknown; openFirstCandidate?: unknown }; __runTrace?: { get(): { entries: unknown[] } } };
      return {
        hasSession: !!w.__doorstep?.session,
        hasOpener: typeof w.__doorstep?.openFirstCandidate === "function",
        traceEntries: Array.isArray(w.__runTrace?.get()?.entries),
      };
    });
    await run.page.goto(run.url + "/", { waitUntil: "domcontentloaded" });
    await run.page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
    const plain = await run.page.evaluate(() => (window as unknown as { __doorstep?: unknown }).__doorstep);
    const plainTrace = await run.page.evaluate(() => {
      const w = window as unknown as { __runTrace?: { get(): { entries: unknown[] } } };
      return Array.isArray(w.__runTrace?.get()?.entries);
    });
    c.ok(hooked.hasSession && hooked.hasOpener && hooked.traceEntries && plain === undefined && plainTrace, "15 hook only with query, trace always");
  }

  // 16. Health and events routes are not shadowed by the SPA fallback.
  {
    const health = await run.page.evaluate(async (base: string) => {
      const r = await fetch(base + "/health");
      return r.json() as Promise<{ ok: boolean }>;
    }, run.url);
    const events = await run.page.evaluate(async (base: string) => fetch(base + "/events").then((r) => r.status), run.url);
    c.ok(health.ok === true && events === 200, "16 health and events served");
  }
} finally {
  await run.close();
}

// 9. Grid at 1280.
{
  const small = await openApp({ width: 1280, height: 720 });
  try {
    const cols = await small.page.locator(".page").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    const parts = cols.trim().split(/\s+/);
    c.ok(parts[0] === "208px" && parts[parts.length - 1] === "360px", "9 grid 208 and 360 at 1280");
  } finally {
    await small.close();
  }
}

// 10. The toggle moves from the rail into the bar below 1024 px.
{
  let wideOk = false;
  const wide = await openApp({ width: 1024, height: 800 });
  try {
    const asideVisible = await wide.page.locator("aside [role='radiogroup']").first().isVisible().catch(() => false);
    const headerCount = await wide.page.locator("header [role='radiogroup']").count();
    const headerVisible = headerCount > 0 && (await wide.page.locator("header [role='radiogroup']").first().isVisible().catch(() => false));
    wideOk = asideVisible && !headerVisible;
  } finally {
    await wide.close();
  }
  let narrowOk = false;
  const narrow = await openApp({ width: 900, height: 800 });
  try {
    const asideCount = await narrow.page.locator("aside [role='radiogroup']").count();
    const asideVisible = asideCount > 0 && (await narrow.page.locator("aside [role='radiogroup']").first().isVisible().catch(() => false));
    const headerVisible = await narrow.page.locator("header [role='radiogroup']").first().isVisible();
    narrowOk = !asideVisible && headerVisible;
  } finally {
    await narrow.close();
  }
  c.ok(wideOk && narrowOk, "10 toggle in the rail at 1024, in the bar at 900");
}

// 12. Blocked storage still reaches ready with the scheme theme.
{
  const blocked = await openApp({
    theme: "dark",
    storedTheme: null,
    initScript: "Storage.prototype.getItem = function () { throw new Error('blocked'); };",
  });
  try {
    const ready = await blocked.page.evaluate(() => document.body.dataset["appReady"]);
    const theme = await blocked.page.evaluate(() => document.documentElement.dataset["theme"]);
    c.ok(ready === "true" && theme === "dark", "12 blocked storage follows the scheme");
  } finally {
    await blocked.close();
  }
}

// 13. No horizontal spill at 390 or 1440 on any route (§5.11 assertion 1).
{
  const phone = await openApp({ width: 390, height: 844 });
  try {
    let spill = (globalThis as unknown as { __ui04spill?: number }).__ui04spill ?? 0;
    for (const path of ["/", "/watch", "/lab"]) {
      await phone.page.goto(phone.url + path, { waitUntil: "domcontentloaded" });
      spill += await phone.page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5);
        }).length;
      });
    }
    c.eq(spill, 0, "13 no element spills horizontally");
  } finally {
    await phone.close();
  }
}

c.done();
