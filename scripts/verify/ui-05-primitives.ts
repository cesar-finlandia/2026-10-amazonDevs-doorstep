// scripts/verify/ui-05-primitives.ts — DP-UI WU-UI-05 (18 checks).
// Requirement IDs: FR-19, FR-21
import { bannedHits } from "src/llm/guard.js";
import { hexToRgb } from "../lib/color.js";
import { explainerCopy, helpContent } from "src/ui/help/helpContent.js";
import { createChecker, openApp } from "./ui-kit.js";

const c = createChecker("ui-05-primitives");
const run = await openApp({ path: "/__kit" });
try {
  const page = run.page;
  await page.waitForSelector('[data-kit="surface"]', { timeout: 15000 });

  // 1. No surface is flat (border or shadow, per the craft contract — wells
  // keep the recipe's shadowless sunken look but always carry a border);
  // an untitled surface renders no header.
  {
    const flat = await page.evaluate(() =>
      [...document.querySelectorAll('[data-kit="surface"] [data-surface]')].filter((el) => {
        const s = getComputedStyle(el);
        return s.borderStyle === "none" && s.boxShadow === "none";
      }).length,
    );
    const headers = await page.locator('[data-kit="surface"] [data-surface] header').count();
    const surfaces = await page.locator('[data-kit="surface"] [data-surface]').count();
    c.ok(flat === 0 && headers < surfaces, "1 no flat surface, untitled has no header");
  }

  // 2. The check-panel surface carries a labelled help button.
  {
    const btn = page.locator('[data-kit="surface"] button[data-help-for="check-panel"]');
    c.ok((await btn.count()) === 1 && (await btn.getAttribute("aria-label")) === helpContent["check-panel"].label, "2 help button labelled by region");
  }

  // 3. Help opens a dialog with the region body; Escape closes and refocuses.
  {
    const btn = page.locator('[data-kit="surface"] button[data-help-for="check-panel"]');
    await btn.click();
    const pop = page.locator('[role="dialog"]', { hasText: helpContent["check-panel"].body.slice(0, 40) });
    const opened = (await pop.count()) >= 1;
    await page.keyboard.press("Escape");
    const closed = (await page.locator('[role="dialog"]').count()) === 0;
    const refocused = await page.evaluate(() => document.activeElement?.getAttribute("data-help-for"));
    c.ok(opened && closed && refocused === "check-panel", "3 help opens, escapes and refocuses");
  }

  // 4. Metric sizes and tabular figures.
  {
    const r = await page.evaluate(() => {
      const px = (sel: string): number => {
        const el = document.querySelector(sel);
        return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
      };
      const tabular = [...document.querySelectorAll('[data-kit="metric"] [data-metric]')].every((el) =>
        getComputedStyle(el).fontVariantNumeric.includes("tabular-nums"),
      );
      return { xl: px('[data-kit="metric"] .metric__value--xl'), lg: px('[data-kit="metric"] .metric__value--lg'), tabular };
    });
    c.ok(r.xl >= 64 && r.lg >= 28 && r.tabular, "4 metric sizes and tabular figures");
  }

  // 5. Abbreviation and the max budget.
  {
    const wide = page.getByText("12.8k");
    const capped = page.locator('[data-kit="metric"] [data-metric]', { hasText: "99+" }).first();
    c.ok((await wide.getAttribute("title")) === "12800" && (await capped.textContent()) === "99+" && (await capped.getAttribute("title")) === "150", "5 abbreviation and cap");
  }

  // 6. Empty and loading metrics.
  {
    const empty = (await page.getByText("—", { exact: true }).count()) >= 1;
    const loading = await page.evaluate(() => {
      const el = document.querySelector('[data-kit="metric"] [data-metric][aria-busy="true"]');
      return el !== null && !/\d/.test(el.textContent ?? "");
    });
    c.ok(empty && loading, "6 empty dash and busy metric without digits");
  }

  // 7. A wide value in a narrow box never wraps.
  {
    const rects = await page.getByText("88.8k").evaluate((el) => el.getClientRects().length);
    c.eq(rects, 1, "7 narrow metric does not wrap");
  }

  // 8. Every tone and tier has a glyph and a title.
  {
    const tones = ["info", "success", "warning", "danger", "degraded"];
    const tiers = ["banner", "callout", "toast"];
    let ok = true;
    for (const tone of tones) {
      for (const tier of tiers) {
        const m = page.locator(`[data-kit="message"] [data-message][data-tone="${tone}"][data-tier="${tier}"]`).first();
        const glyph = await m.locator("svg").count();
        const title = ((await m.locator(".message__title").textContent()) ?? "").trim();
        if (glyph < 1 || title === "") ok = false;
      }
    }
    c.ok(ok, "8 every tone and tier has glyph and title");
  }

  // 9. Danger alerts; everything else reports status.
  {
    const dangerRole = await page.locator('[data-kit="message"] [data-message][data-tone="danger"]').first().getAttribute("role");
    const others = await page.evaluate(() =>
      [...document.querySelectorAll('[data-kit="message"] [data-message]')]
        .filter((el) => el.getAttribute("data-tone") !== "danger")
        .every((el) => el.getAttribute("role") === "status"),
    );
    c.ok(dangerRole === "alert" && others, "9 danger alerts, others report status");
  }

  // 10. Structured detail renders one dl; plain messages render none.
  {
    const r = await page.evaluate(() => {
      const rich = [...document.querySelectorAll('[data-kit="message"] [data-message]')].find((el) =>
        (el.textContent ?? "").includes("Steps and outcomes"),
      );
      const plain = [...document.querySelectorAll('[data-kit="message"] [data-message]')].find((el) =>
        (el.textContent ?? "").includes("Plain callout"),
      );
      const dl = rich?.querySelectorAll("dl");
      return {
        one: dl?.length === 1,
        dt: rich?.querySelectorAll("dt").length === 2,
        dd: rich?.querySelectorAll("dd").length === 2,
        none: (plain?.querySelectorAll("dl").length ?? 1) === 0,
      };
    });
    c.ok(r.one && r.dt && r.dd && r.none, "10 structured detail in one dl");
  }

  // 11. Primary fill, ghost transparency and a visible focus ring.
  {
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    const [r, g, b] = hexToRgb(accent);
    const primaryBg = await page.locator('[data-kit="button"] button[data-variant="primary"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const ghostBg = await page.locator('[data-kit="button"] button[data-variant="ghost"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.locator('[data-kit="surface"]').first().click({ position: { x: 2, y: 2 } });
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { tag: "", style: "none", width: "0px" };
      const s = getComputedStyle(el);
      return { tag: el.tagName, style: s.outlineStyle, width: s.outlineWidth };
    });
    c.ok(
      primaryBg === `rgb(${r}, ${g}, ${b})` && ghostBg === "rgba(0, 0, 0, 0)" && focus.tag === "BUTTON" && focus.style !== "none" &&
        parseFloat(focus.width) >= 2,
      "11 primary fill, ghost clear, focus ring",
    );
  }

  // 12. A loading button keeps its width, disables and reports busy.
  {
    const btns = page.locator('[data-kit="button"] button', { hasText: "Run report" });
    const wIdle = (await btns.nth(1).boundingBox())?.width ?? 0;
    const wBusy = (await btns.nth(2).boundingBox())?.width ?? 0;
    const busy = btns.nth(2);
    c.ok(Math.abs(wIdle - wBusy) <= 1 && (await busy.isDisabled()) && (await busy.getAttribute("aria-busy")) === "true", "12 loading button stable and busy");
  }

  // 13. Source and synthetic badges read correctly.
  {
    const texts = await page.locator('[data-kit="badge"]').innerText();
    c.ok(texts.includes("AGENT") && texts.includes("YOU") && texts.includes("SYSTEM") && /sample|synthetic/i.test(texts), "13 badges carry AGENT YOU SYSTEM and synthetic");
  }

  // 14. The work indicator owns its status.
  {
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-kit="indicator"] [role="status"]');
      return {
        live: el?.getAttribute("aria-live"),
        label: el?.textContent ?? "",
        ticks: el?.querySelectorAll(".work-indicator__tick").length ?? 0,
      };
    });
    c.ok(r.live === "polite" && r.label.includes("Reading doorway events") && r.ticks === 3, "14 work indicator with label and three ticks");
  }

  // 15. The empty-state action fires exactly once.
  {
    const before = Number(await page.locator("[data-kit-calls]").getAttribute("data-kit-calls"));
    await page.locator('[data-kit="empty"] button:has-text("Load the sample week")').click();
    const after = Number(await page.locator("[data-kit-calls]").getAttribute("data-kit-calls"));
    c.eq(after - before, 1, "15 empty action fires once");
  }

  // 16. The dialog traps focus and closes both ways.
  {
    await page.locator('[data-kit="dialog"] button:has-text("Open dialog")').click();
    const dlg = page.locator('[role="dialog"]');
    await dlg.waitFor({ state: "visible" });
    const inside = await page.evaluate(() => (document.querySelector('[role="dialog"]')?.contains(document.activeElement)) === true);
    let trapped = inside;
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      trapped = trapped && (await page.evaluate(() => (document.querySelector('[role="dialog"]')?.contains(document.activeElement)) === true));
    }
    await page.keyboard.press("Escape");
    const escClosed = (await page.locator('[role="dialog"]').count()) === 0;
    await page.locator('[data-kit="dialog"] button:has-text("Open dialog")').click();
    await page.locator('[role="dialog"]').waitFor({ state: "visible" });
    await page.locator(".dialog__backdrop").click({ position: { x: 5, y: 5 } });
    const backdropClosed = (await page.locator('[role="dialog"]').count()) === 0;
    c.ok(trapped && escClosed && backdropClosed, "16 dialog traps focus and closes both ways");
  }

  // 17. The explainer carries the brief copy; the app bar triggers it on /.
  {
    await page.locator('[data-kit="explainer"] button:has-text("Open explainer")').click();
    const panel = page.locator("[data-app-explainer-panel]");
    const title = ((await panel.locator("h1").textContent()) ?? "").trim();
    const sections = await panel.locator("h2").count();
    const before = Number(await page.locator("[data-kit-calls]").getAttribute("data-kit-calls"));
    await panel.locator('button:has-text("Review the sample week")').click();
    const after = Number(await page.locator("[data-kit-calls]").getAttribute("data-kit-calls"));
    await page.goto(run.url + "/", { waitUntil: "domcontentloaded" });
    const trigger = await page.locator("[data-app-explainer]").count();
    c.ok(title === explainerCopy.title && sections === 5 && after - before === 1 && trigger >= 1, "17 explainer copy, try action and app trigger");
  }

  // 18. The gallery prints no banned word and no broken template.
  {
    await page.goto(run.url + "/__kit", { waitUntil: "domcontentloaded" });
    const text = await page.innerText("body");
    c.ok(
      bannedHits(text).length === 0 && !/(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/.test(text),
      "18 gallery copy is clean",
    );
  }
} finally {
  await run.close();
}

c.done();
