// scripts/verify/ui-06-ribbon.ts — DP-UI WU-UI-06 (16 checks).
// Requirement IDs: FR-03
import { dayIndexOf, weekRibbon } from "src/domain/derive.js";
import type { WeekModel } from "src/domain/types.js";
import { hexToRgb } from "../lib/color.js";
import { createChecker, listOf, openApp, readModel, waitCalm } from "./ui-kit.js";

const c = createChecker("ui-06-ribbon");
const run = await openApp({ path: "/?hook=1" });
try {
  const page = run.page;
  const rgb = (hex: string): string => {
    const [r, g, b] = hexToRgb(hex);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // 1. A fresh week shows seven unpressed day columns and the empty state.
  {
    const count = await page.locator("[data-day]").count();
    const pressed = await page.locator('[data-day][aria-pressed="true"]').count();
    const empty = await page.getByText("No doorway events yet").isVisible();
    c.ok(count === 7 && pressed === 0 && empty, "1 seven columns, none pressed, empty state shown");
  }

  await page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
  await waitCalm(page);

  // 2. The sample week fills the columns.
  {
    const empty = await page.getByText("No doorway events yet").count();
    const ticks = await page.locator(".tick").count();
    c.ok(empty === 0 && ticks > 20, "2 empty gone, ticks drawn");
  }

  const model = (await readModel(page)) as unknown as WeekModel;
  const ribbon = weekRibbon(model);

  // 3. Eyebrows run MON–SUN; subjects match the domain day numbers.
  {
    const heads = await page.evaluate(() =>
      [...document.querySelectorAll("[data-day]")].map((el) => ({
        eyebrow: el.querySelector(".eyebrow")?.textContent?.trim() ?? "",
        num: el.querySelector(".day-num")?.textContent?.trim() ?? "",
      })),
    );
    const eyebrows = heads.map((h) => h.eyebrow);
    const expectedNums = ribbon.map((d) => (/\b(\d{1,2})\b/.exec(d.dateLabel)?.[1] ?? ""));
    c.ok(
      JSON.stringify(eyebrows) === JSON.stringify(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) &&
        JSON.stringify(heads.map((h) => h.num)) === JSON.stringify(expectedNums),
      "3 eyebrows in week order, subjects match the domain",
    );
  }

  // 4. Every column renders the domain derivation exactly.
  {
    const counts = await page.evaluate(() =>
      [...document.querySelectorAll("[data-day]")].map((el) => ({
        ticks: el.querySelectorAll(".tick").length,
        visits: el.querySelectorAll(".visit").length,
        quiet: el.querySelectorAll(".quiet-band").length,
        outages: el.querySelectorAll(".outage-band").length,
        circles: el.parentElement?.querySelectorAll(".pencil-circle").length ?? 0,
      })),
    );
    c.ok(
      counts.every(
        (k, i) =>
          k.ticks === (ribbon[i] as (typeof ribbon)[number]).ticks.length &&
          k.visits === (ribbon[i] as (typeof ribbon)[number]).visits.length &&
          k.quiet === (ribbon[i] as (typeof ribbon)[number]).quietBands.length &&
          k.outages === (ribbon[i] as (typeof ribbon)[number]).outages.length &&
          k.circles === (ribbon[i] as (typeof ribbon)[number]).incidents.length,
      ),
      "4 columns match weekRibbon counts",
    );
  }

  // 5. Tick position follows minute / 14.4.
  {
    const idx = ribbon.findIndex((d) => d.ticks.length > 0);
    const minute = ribbon[idx]?.ticks[0]?.minute ?? 0;
    const top = await page.locator("[data-day]").nth(idx).locator(".tick").first().evaluate((el) => parseFloat((el as HTMLElement).style.top));
    c.ok(Math.abs(top - minute / 14.4) <= 0.05, "5 tick top follows its minute");
  }

  // 6. Quiet-band height follows the effective window.
  {
    const band = ribbon[0]?.quietBands[0];
    const height = await page.locator(".quiet-band").first().evaluate((el) => parseFloat((el as HTMLElement).style.height));
    c.ok(band !== undefined && Math.abs(height - (band.toMin - band.fromMin) / 14.4) <= 0.05, "6 quiet band height follows its window");
  }

  // 7. The history seam sits in its day, dashed and labelled.
  {
    const idx = ribbon.findIndex((d) => d.seamMinute !== null);
    const seams = await page.locator(".seam").count();
    const inDay = idx >= 0 ? await page.locator("[data-day]").nth(idx).locator(".seam").count() : 0;
    const label = idx >= 0 ? ((await page.locator("[data-day]").nth(idx).locator(".seam").textContent()) ?? "") : "";
    const dashed = idx >= 0
      ? await page.locator("[data-day]").nth(idx).locator(".seam").evaluate((el) => {
        const s = getComputedStyle(el);
        return s.borderTopStyle === "dashed" || s.borderLeftStyle === "dashed";
      })
      : false;
    c.ok(seams === (idx >= 0 ? 1 : 0) && inDay === (idx >= 0 ? 1 : 0) && label.includes("from history") && (idx < 0 || dashed), "7 seam in its day, dashed, labelled");
  }

  // 8. Duplicates draw doubled in the degraded colour.
  {
    const n = await page.locator('.tick[data-dup="true"]').count();
    const color = n > 0 ? await page.locator('.tick[data-dup="true"]').first().evaluate((el) => getComputedStyle(el).backgroundColor) : "";
    const degraded = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--degraded").trim());
    c.ok(n >= 1 && color === rgb(degraded), "8 duplicate ticks in degraded colour");
  }

  // 9. Outage bands are hatched and labelled with minutes.
  {
    const r = await page.evaluate(() =>
      [...document.querySelectorAll(".outage-band")].map((el) => ({
        title: el.getAttribute("title") ?? "",
        bg: getComputedStyle(el).backgroundImage,
      })),
    );
    c.ok(r.length >= 1 && r.every((o) => o.title.includes("min offline") && o.bg.includes("gradient")), "9 outage bands hatched and titled");
  }

  // 10. Clicking the third column selects it with the accent rule.
  {
    await page.locator("[data-day]").nth(2).click();
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    const [r, g, b] = hexToRgb(accent);
    // The border colour transitions in; wait for it to settle.
    await page.waitForFunction(
      (want: string) => getComputedStyle(document.querySelectorAll("[data-day]")[2] as Element).borderBottomColor === want,
      `rgb(${r}, ${g}, ${b})`,
      { timeout: 5000 },
    );
    const pressed = await page.locator('[data-day][aria-pressed="true"]').count();
    const which = await page.locator('[data-day][aria-pressed="true"]').getAttribute("data-day");
    const style = await page.locator("[data-day]").nth(2).evaluate((el) => {
      const s = getComputedStyle(el);
      return { w: s.borderBottomWidth, c: s.borderBottomColor };
    });
    c.ok(pressed === 1 && which === "2" && style.w === "2px" && style.c === `rgb(${r}, ${g}, ${b})`, "10 third column selected with accent rule");
  }

  // 11. Keyboard selection works and shows a focus ring.
  {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-day"));
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    await page.keyboard.press("Enter");
    const pressed = await page.locator(`[data-day="${focused}"][aria-pressed="true"]`).count();
    c.ok(focused === "3" && outline !== "none" && pressed === 1, "11 keyboard selects the fourth column with a ring");
  }

  // 12. The first candidate opens a pencil circle in its column.
  {
    const id = await page.evaluate(() => (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate());
    await page.locator(".pencil-circle").waitFor({ state: "visible", timeout: 30000 });
    const count = await page.locator(".pencil-circle").count();
    const circle = page.locator(".pencil-circle").first();
    const label = (await circle.getAttribute("aria-label")) ?? "";
    const box = await circle.boundingBox();
    const pathLength = await circle.locator("ellipse").getAttribute("pathLength");
    const model2 = (await readModel(page)) as unknown as WeekModel;
    const inc = model2.incidents.find((x) => x.id === id);
    const abs = inc ? (inc.dayIndex ?? dayIndexOf(model2, inc.startMs)) : -1;
    const col = await circle.evaluate((el) => el.closest("[data-col]")?.getAttribute("data-col"));
    c.ok(
      typeof id === "string" && count === 1 && label.startsWith("Open incident: ") && (box?.height ?? 0) >= 44 && pathLength === "1" &&
        col === String(abs - 7),
      "12 pencil circle in the candidate column",
    );
  }

  // 13. The circle stroke follows the incident status.
  {
    const stroke = async (): Promise<string> => page.locator(".pencil-circle ellipse").evaluate((el) => getComputedStyle(el).stroke);
    const warn = rgb("#8F4B00");
    const ok = (await stroke()) === warn;
    const id = await page.locator(".pencil-circle").getAttribute("data-incident-id");
    await page.evaluate((incId: string) =>
      (window as unknown as { __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } } }).__doorstep.session.call(
        "set_incident_status",
        { incidentId: incId, status: "resolved" },
        { source: "human" },
      ), id);
    const resolvedOk = (await stroke()) === rgb("#3B6A2B");
    await page.evaluate((incId: string) =>
      (window as unknown as { __doorstep: { session: { call(n: string, a: unknown, o: unknown): Promise<unknown> } } }).__doorstep.session.call(
        "set_incident_status",
        { incidentId: incId, status: "dismissed" },
        { source: "human" },
      ), id);
    const dismissedOk = (await stroke()) === rgb("#857758");
    c.ok(ok && resolvedOk && dismissedOk, "13 circle stroke follows status");
  }

  // 15. Clicking the circle selects it and its day.
  {
    await page.locator(".pencil-circle").first().click();
    const pressed = await page.locator('.pencil-circle[aria-pressed="true"]').count();
    const dayPressed = await page.locator('[data-day][aria-pressed="true"]').count();
    c.ok(pressed === 1 && dayPressed === 1, "15 circle click selects circle and day");
  }

  // 16. The baseline strip states the p90 and the busiest hour.
  {
    const text = ((await page.getByText(/^Usual: visits under \d+ min; busiest \d\d:00$/).textContent()) ?? "").trim();
    const m = /^Usual: visits under (\d+) min; busiest (\d\d):00$/.exec(text);
    const p90 = Math.round(model.baseline.dwellP90Sec / 60);
    const perHour = new Array<number>(24).fill(0);
    for (const row of model.baseline.rhythm) row.forEach((v: number, h: number) => { perHour[h] = (perHour[h] ?? 0) + v; });
    let best = 0;
    for (let h = 1; h < 24; h++) if ((perHour[h] ?? 0) > (perHour[best] ?? 0)) best = h;
    c.ok(m !== null && Number(m[1]) === p90 && m[2] === String(best).padStart(2, "0"), "16 baseline strip states p90 and busiest hour");
  }
} finally {
  await run.close();
}

// 14. Default motion draws the circle in; reduced motion stills it with a full circle.
{
  let reducedOk = false;
  const reduced = await openApp({ path: "/?hook=1", reducedMotion: "reduce" });
  try {
    await reduced.page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
    await waitCalm(reduced.page);
    await reduced.page.evaluate(() => (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate());
    await reduced.page.locator(".pencil-circle").waitFor({ state: "visible", timeout: 30000 });
    const r = await reduced.page.locator(".pencil-circle ellipse").evaluate((el) => {
      const s = getComputedStyle(el);
      return { name: s.animationName, dur: parseFloat(s.animationDuration) * 1000, dash: s.strokeDashoffset };
    });
    reducedOk = (r.name === "none" || r.dur <= 1) && r.dash.startsWith("0");
  } finally {
    await reduced.close();
  }
  let defaultOk = false;
  const full = await openApp({ path: "/?hook=1" });
  try {
    await full.page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
    await waitCalm(full.page);
    await full.page.evaluate(() => (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate());
    await full.page.locator(".pencil-circle").waitFor({ state: "visible", timeout: 30000 });
    const name = await full.page.locator(".pencil-circle ellipse").evaluate((el) => getComputedStyle(el).animationName);
    defaultOk = name !== "none";
  } finally {
    await full.close();
  }
  c.ok(reducedOk && defaultOk, "14 draw-in by default, instant with reduced motion");
}

c.done();
