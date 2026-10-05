// scripts/verify/ui-07-checks.ts — DP-UI WU-UI-07 (16 checks).
// Requirement IDs: FR-03, FR-04, FR-21
import type { WeekModel } from "src/domain/types.js";
import { bannedHits } from "src/llm/guard.js";
import { leadSentence, weekTitle } from "src/ui/copy/templates.js";
import { createChecker, openApp, readModel, waitCalm } from "./ui-kit.js";

const c = createChecker("ui-07-checks");
const run = await openApp({ path: "/?hook=1" });
try {
  const page = run.page;
  await page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
  await waitCalm(page);

  const counts = await page.evaluate(() => {
    const w = window as unknown as { __doorstep: { session: { checkNow(): { counts: { errors: number; warnings: number } } } } };
    return w.__doorstep.session.checkNow().counts;
  });
  const open = counts.errors + counts.warnings;
  const model = (await readModel(page)) as unknown as WeekModel;

  // 1. The title names the week; the support names the door and the source.
  {
    const h1 = ((await page.locator('[data-slot="title"] h1').textContent()) ?? "").trim();
    const support = ((await page.locator('[data-slot="title"] .support').first().textContent()) ?? "").trim();
    c.ok(h1 === weekTitle(model) && h1.startsWith("The week of ") && support.startsWith("Rosa's front door · Sample week"), "1 title and support name the week");
  }

  // 2. The hero counts errors plus warnings in the danger tone.
  {
    const hero = page.locator('[data-result-region="open-checks"] [data-metric]');
    const value = ((await hero.textContent()) ?? "").trim();
    const unit = ((await page.locator('[data-result-region="open-checks"] .metric__unit').textContent()) ?? "").trim();
    const tone = await hero.getAttribute("data-tone");
    c.ok(value === String(open) && unit === "to look at" && tone === "danger", "2 hero counts open checks in danger tone");
  }

  // 3. The hero is camera-readable.
  {
    const px = await page.locator('[data-result-region="open-checks"] [data-metric]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    c.ok(px >= 64, "3 hero at 64 px or larger");
  }

  // 4. The lead sentence matches the template.
  {
    const lead = ((await page.locator('[data-result-region="open-checks"] .lead').textContent()) ?? "").trim();
    c.eq(lead, leadSentence(open), "4 lead sentence matches the template");
  }

  // 5. The check panel header names Checks with its badge and help.
  {
    const panel = page.locator('[data-result-region="check-panel"]');
    const eyebrow = ((await panel.locator("header .eyebrow").textContent()) ?? "").trim();
    const badge = Number(((await panel.locator("[data-check-count]").textContent()) ?? "").trim());
    const help = await panel.locator('[data-help-for="check-panel"]').count();
    c.ok(eyebrow === "Checks" && badge === open && help === 1, "5 check panel header with badge and help");
  }

  // 6. One tinted row per issue with a state chip.
  {
    const total = await page.evaluate(() => {
      const w = window as unknown as { __doorstep: { session: { checkNow(): { issues: unknown[] } } } };
      return w.__doorstep.session.checkNow().issues.length;
    });
    const rows = await page.locator('[data-result-region="check-panel"] .issue-row').count();
    const chips = await page.locator('[data-result-region="check-panel"] .issue-row .chip').allTextContents();
    const left = await page.locator('[data-result-region="check-panel"] .issue-row').first().evaluate((el) => getComputedStyle(el).borderLeftWidth);
    c.ok(rows === total && rows === open && chips.every((t) => t.trim() === "Error" || t.trim() === "Warning") && left === "3px", "6 one tinted row per issue");
  }

  // 7. Every row names its rule in plain words.
  {
    const words = ["Quiet hours", "Long visits", "Device offline", "Consent", "Duplicate events", "Change history", "Moments without a write-up", "Check"];
    const supports = await page.locator('[data-result-region="check-panel"] .issue-row .support').allTextContents();
    c.ok(supports.length > 0 && supports.every((t) => words.some((w) => t.trim().startsWith(w))), "7 rows name their rule in plain words");
  }

  // 8. Merging duplicates lowers the error count and the badge within a second.
  {
    const before = await page.evaluate(() => {
      const w = window as unknown as { __doorstep: { session: { checkNow(): { counts: { errors: number } } } } };
      return w.__doorstep.session.checkNow().counts.errors;
    });
    const merge = page.locator('[data-result-region="check-panel"] button:has-text("Merge duplicates")');
    const n = await merge.count();
    let ok = n >= 1 && before > 0;
    if (ok) {
      await merge.first().click();
      await page.waitForTimeout(1000);
      const after = await page.evaluate(() => {
        const w = window as unknown as { __doorstep: { session: { checkNow(): { counts: { errors: number; warnings: number } } } } };
        const k = w.__doorstep.session.checkNow().counts;
        return k.errors + k.warnings;
      });
      const badge = Number(((await page.locator("[data-check-count]").textContent()) ?? "").trim());
      ok = after < before && badge === after;
    }
    c.ok(ok, "8 merging duplicates lowers the count");
  }

  // 9. Pressing every merge leaves no merge button.
  {
    for (let i = 0; i < 300; i++) {
      const btn = page.locator('[data-result-region="check-panel"] button:has-text("Merge duplicates")');
      if ((await btn.count()) === 0) break;
      await btn.first().click();
      await page.waitForTimeout(300);
    }
    c.eq(await page.locator('[data-result-region="check-panel"] button:has-text("Merge duplicates")').count(), 0, "9 no merge button remains");
  }

  // 10. With no incident the card rests on the calm template.
  {
    const title = ((await page.locator('[data-result-region="incident-card"] .subject').textContent()) ?? "").trim();
    c.eq(title, "Nothing broke the rhythm", "10 calm template without incidents");
  }

  // 11. The candidate incident opens a dated card with its headline.
  let incidentId: string | null = null;
  {
    incidentId = await page.evaluate(() => (window as unknown as { __doorstep: { openFirstCandidate(): Promise<string | null> } }).__doorstep.openFirstCandidate());
    await page.locator('[data-result-region="incident-card"] h2').waitFor({ state: "visible", timeout: 30000 });
    const eyebrow = ((await page.locator('[data-result-region="incident-card"] header .eyebrow').textContent()) ?? "").trim();
    const h2 = ((await page.locator('[data-result-region="incident-card"] h2').textContent()) ?? "").trim();
    const model3 = (await readModel(page)) as unknown as WeekModel;
    const inc = model3.incidents.find((x) => x.id === model3.ui.selectedIncidentId) ?? model3.incidents[0];
    c.ok(/^[A-Z]{3} \d{1,2} [A-Z]{3} · \d\d:\d\d$/.test(eyebrow) && h2 === (inc?.title ?? ""), "11 incident card dated with its headline");
  }

  // 12. The evidence snapshot sits in a 16:9 well.
  {
    const img = page.locator('[data-result-region="incident-card"] .evidence img');
    const src = (await img.getAttribute("src")) ?? "";
    const alt = (await img.getAttribute("alt")) ?? "";
    const box = await img.boundingBox();
    const ratio = box ? box.width / box.height : 0;
    c.ok(src.startsWith("data:image/") && alt.startsWith("Snapshot from ") && Math.abs(ratio - 16 / 9) <= 0.01 * (16 / 9), "12 snapshot in a 16:9 well");
  }

  // 13. Explaining keeps the card; dismissing greys the circle.
  {
    await page.locator('[data-result-region="incident-card"] button:has-text("Mark as explained")').click();
    await page.waitForTimeout(400);
    const status = await page.evaluate((id: string | null) => {
      const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
      return w.__doorstep.session.store.getState().incidents.find((x) => x.id === id)?.status ?? "";
    }, incidentId);
    const kept = (await page.locator('[data-result-region="incident-card"] h2').count()) === 1;
    await page.locator('[data-result-region="incident-card"] button:has-text("Dismiss")').click();
    await page.waitForTimeout(400);
    const dismissed = await page.evaluate((id: string | null) => {
      const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
      return w.__doorstep.session.store.getState().incidents.find((x) => x.id === id)?.status ?? "";
    }, incidentId);
    const stroke = await page.locator(".pencil-circle ellipse").evaluate((el) => getComputedStyle(el).stroke);
    c.ok(status === "explained" && kept && dismissed === "dismissed" && stroke === "rgb(133, 119, 88)", "13 explain keeps, dismiss greys");
  }

  // 14. No decision card without a proposed nudge.
  {
    c.eq(await page.locator("[data-nudge-card]").count(), 0, "14 no nudge card without proposals");
  }

  // 15. The week's words are clean.
  {
    const text = await page.evaluate(() =>
      ["summary", "check", "incident"].map((s) => document.querySelector(`[data-slot="${s}"]`)?.textContent ?? "").join("\n"),
    );
    c.ok(
      bannedHits(text).length === 0 && !/(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/.test(text),
      "15 week copy is clean",
    );
  }

  // 16. Tab walks the fix buttons and the card actions in order with rings.
  {
    await page.locator('[data-result-region="check-panel"]').click({ position: { x: 4, y: 4 } });
    const want = await page.evaluate(() =>
      [...document.querySelectorAll('[data-result-region="check-panel"] button, [data-result-region="incident-card"] button')].map((el) => el.textContent?.trim() ?? ""),
    );
    const seen: string[] = [];
    let rings = true;
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? "");
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
      if (label !== "") seen.push(label);
      if (outline === "none") rings = false;
      let at = 0;
      for (const s of seen) if (s === want[at]) at += 1;
      if (at === want.length) break;
    }
    let at = 0;
    for (const label of seen) {
      if (label === want[at]) at += 1;
    }
    c.ok(want.length > 0 && at === want.length && rings, "16 tab walks actions in order with rings");
  }
} finally {
  await run.close();
}

c.done();
