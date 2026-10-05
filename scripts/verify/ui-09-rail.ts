// scripts/verify/ui-09-rail.ts — DP-UI WU-UI-09 (16 checks).
// Requirement IDs: FR-19, FR-01
// DEVIATIONS from DP-UI §8 WU-UI-09 (plan text assumed the identity draft
// household "Rosa Alvarez, 84 / Marta"; the domain implementation in plans 1–4
// holds "Rosa / 78 / Maya", which this plan must not change):
// - check 1 asserts the card shows the MODEL's household name, age and
//   caretaker (the plan's "(display name from WeekModel.household)"), not the
//   literal draft strings.
// - check 16 accepts the closed drawer (display:none, zero box) as well as a
//   rail laid out below the workbench: at 390 px the rail is a drawer per §5.7,
//   so a closed drawer cannot have a top below the workbench.
import type { WeekModel } from "src/domain/types.js";
import { deviceOutages } from "src/domain/derive.js";
import { EFFECTIVE_QUIET_HOURS } from "src/domain/rules.js";
import { bannedHits } from "src/llm/guard.js";
import { createChecker, openApp, readModel } from "./ui-kit.js";

const c = createChecker("ui-09-rail");
const messages: string[] = [];
const run = await openApp({ path: "/?hook=1" });
try {
  const page = run.page;
  page.on("console", (m) => messages.push(m.text()));
  page.on("pageerror", (e) => messages.push(String(e)));

  const railText = async (): Promise<string> => (await page.locator("aside.rail").innerText()) ?? "";

  // 2. A fresh rail never prints an empty slot.
  {
    const t = await railText();
    c.ok(
      !/undefined|null|NaN/.test(t) && bannedHits(t).length === 0,
      "2 fresh rail has no empty slots and no banned words",
    );
  }

  // 5 (before load). Quiet-hours inputs carry the seed window.
  {
    const region = page.locator('[data-result-region="quiet-hours"]');
    const start = await region.locator('label:has-text("Start") input').inputValue();
    const end = await region.locator('label:has-text("End") input').inputValue();
    const support = await region.locator(".support").first().innerText();
    const eff = EFFECTIVE_QUIET_HOURS({ startMin: 1320, endMin: 420, toleranceMin: 30 });
    const pad = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const full = await region.innerText();
    c.ok(
      start === "22:00" && end === "07:00" && support.includes("±30 min margin") &&
        full.includes(`Counted from ${pad(eff.startMin)} to ${pad(eff.endMin)}`),
      "5 quiet inputs 22:00 and 07:00 with the effective window",
    );
  }

  // 13 (before-load half). Record the waiting count; asserted after the load.
  const pillBefore = await page.locator("aside.rail").getByText(/^Webhook inbox · \d+ waiting$/).first().innerText().catch(() => "");

  await page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
  await page.waitForFunction(() => document.querySelectorAll(".tick").length > 20, { timeout: 30000 });

  // 1. The household card shows the model's own household.
  {
    const model = (await readModel(page)) as unknown as WeekModel;
    const t = await railText();
    const eyebrow = await page.locator("aside.rail").getByText("Household", { exact: true }).count();
    c.ok(
      eyebrow >= 1 && t.includes(model.household.name) && t.includes(String(model.household.age)) &&
        t.includes(model.household.caretaker),
      "1 household card shows the model household",
    );
  }

  // 3. One device row per model device, each described with an Online/Offline chip.
  {
    const model = (await readModel(page)) as unknown as WeekModel;
    const rows = await page.locator("aside.rail .device-row").count();
    const chips = await page.locator("aside.rail .device-row .chip").allInnerTexts();
    const t = await railText();
    c.ok(
      rows === model.devices.length && chips.every((x) => x.trim().toLowerCase() === "online" || x.trim().toLowerCase() === "offline") &&
        model.devices.every((d) => t.includes(d.description)),
      "3 one described row per device with an Online or Offline chip",
    );
  }

  // 4. The outage device names its summed offline minutes.
  {
    const model = (await readModel(page)) as unknown as WeekModel;
    const perDevice = new Map<string, number>();
    for (const o of deviceOutages(model)) {
      perDevice.set(o.deviceId, (perDevice.get(o.deviceId) ?? 0) + (o.toMs - o.fromMs) / 60000);
    }
    const ids = [...perDevice.entries()].filter(([, ms]) => Math.round(ms) > 0).map(([id]) => id);
    const t = await railText();
    c.ok(
      ids.length > 0 && ids.every((id) => t.includes(`${Math.round(perDevice.get(id) as number)} min offline`)),
      "4 outage device shows its summed offline minutes",
    );
  }

  // 6. Moving the start dispatches set_quiet_hours and moves the support line.
  {
    const region = page.locator('[data-result-region="quiet-hours"]');
    const before = await region.innerText();
    await region.locator('label:has-text("Start") input').fill("23:00");
    await page.waitForFunction(() => {
      const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
      return w.__doorstep.session.store.getState().household.quietHours.startMin === 1380;
    }, { timeout: 5000 });
    const after = await region.innerText();
    c.ok(before !== after && after.includes("23:00"), "6 start 23:00 updates the model and the support line");
  }

  // 7. Equal start and end warn and change nothing.
  {
    const before = ((await readModel(page)) as unknown as WeekModel).household.quietHours;
    const region = page.locator('[data-result-region="quiet-hours"]');
    await region.locator('label:has-text("End") input').fill("23:00");
    await page.getByText("Pick two different times.").waitFor({ timeout: 5000 });
    const after = ((await readModel(page)) as unknown as WeekModel).household.quietHours;
    c.ok(JSON.stringify(before) === JSON.stringify(after), "7 equal times warn and leave the model unchanged");
    await region.locator('label:has-text("End") input').fill("07:00");
  }

  // 8. One switch per consent scope; clicking flips the grant.
  {
    const model = (await readModel(page)) as unknown as WeekModel;
    const switches = page.locator('aside.rail [role="switch"]');
    const count = await switches.count();
    const labelled = await switches.evaluateAll((els) => els.every((el) => el.getAttribute("aria-checked") !== null));
    const first = switches.first();
    const was = model.consent[0]?.granted;
    await first.click();
    await page.waitForFunction(
      (prev) => {
        const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
        return w.__doorstep.session.store.getState().consent.some((k) => k.granted !== prev);
      },
      was,
      { timeout: 5000 },
    );
    const now = (await readModel(page)) as unknown as WeekModel;
    const flipped = now.consent[0]?.granted;
    c.ok(count === model.consent.length && labelled && flipped === !was, "8 one switch per scope, click flips the grant");
  }

  // 9. Space on a focused switch flips it back.
  {
    const first = page.locator('aside.rail [role="switch"]').first();
    const was = ((await readModel(page)) as unknown as WeekModel).consent[0]?.granted;
    await first.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(
      (prev) => {
        const w = window as unknown as { __doorstep: { session: { store: { getState(): WeekModel } } } };
        return w.__doorstep.session.store.getState().consent[0]?.granted !== prev;
      },
      was,
      { timeout: 5000 },
    );
    c.ok(true, "9 space on a focused switch flips it again");
  }

  // 10. Connect Ring opens the token dialog.
  {
    await page.locator('aside.rail button:has-text("Connect Ring")').click();
    const dialog = page.locator('[role="dialog"][aria-label="Connect Ring"]');
    await dialog.waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    const input = dialog.locator("input");
    const type = await input.getAttribute("type");
    const autocomplete = await input.getAttribute("autocomplete");
    c.ok(type === "password" && autocomplete === "off", "10 connect dialog with a private token field");
  }

  // 11. An empty field warns and sends no link request.
  {
    let linkCalls = 0;
    await page.route("**/api/ring/token", (route) => {
      linkCalls += 1;
      void route.continue();
    });
    const dialog = page.locator('[role="dialog"][aria-label="Connect Ring"]');
    await dialog.locator('button:has-text("Use this token")').click();
    await dialog.getByText("Paste a token first.").waitFor({ timeout: 5000 });
    c.ok(linkCalls === 0, "11 empty token warns without a link request");
  }

  // 12. A rejected token never leaks.
  {
    await page.route("**/api/ring/token", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: { status: 401, code: "bad_token", message: "That token was not accepted." } }) })
    );
    const dialog = page.locator('[role="dialog"][aria-label="Connect Ring"]');
    await dialog.locator("input").fill("tok-SECRET-123");
    await dialog.locator('button:has-text("Use this token")').click();
    await dialog.getByText("Couldn't read Ring").waitFor({ timeout: 10000 });
    const field = await dialog.locator("input").inputValue();
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    const stores = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    const leak = html.includes("tok-SECRET-123") || JSON.stringify(stores).includes("tok-SECRET-123") ||
      messages.some((m) => m.includes("tok-SECRET-123"));
    c.ok(field === "" && !leak, "12 rejected token emptied and never echoed");
    await page.unroute("**/api/ring/token");
    await page.keyboard.press("Escape");
  }

  // 13. The pill names its count before the load and reads zero after it.
  {
    const pill = await page.locator("aside.rail").getByText("Webhook inbox · 0 waiting").count();
    c.ok(/^Webhook inbox · \d+ waiting$/.test(pillBefore) && pill >= 1, "13 inbox pill counted before, zero after the sample week loads");
  }

  // 14. The rail sticks below the app bar and scrolls.
  {
    const box = await page.locator("aside.rail").evaluate((el) => {
      const s = getComputedStyle(el);
      return { position: s.position, top: s.top, overflowY: s.overflowY };
    });
    c.ok(box.position === "sticky" && box.top === "88px" && box.overflowY === "auto", "14 rail sticky at 88px with its own scroll");
  }

  // 15. The theme toggle closes the rail; exactly one radio is checked.
  {
    const last = await page.locator("aside.rail").evaluate((el) => {
      const lastChild = el.lastElementChild;
      return lastChild?.className ?? "";
    });
    const radios = page.locator('aside.rail [role="radio"]');
    const names = (await radios.allInnerTexts()).map((t) => t.trim());
    const checked = await radios.evaluateAll((els) => els.map((el) => el.getAttribute("aria-checked")));
    c.ok(
      last.includes("rail__footer") && names.includes("Paper") && names.includes("Dusk") &&
        checked.filter((v) => v === "true").length === 1,
      "15 theme toggle last in the rail with one checked radio",
    );
  }
} finally {
  await run.close();
}

// 16. At 390 px the grid is one column and the rail stays out of the way.
{
  const phone = await openApp({ width: 390, height: 844, path: "/?hook=1" });
  try {
    const display = await phone.page.locator(".page").first().evaluate((el) => getComputedStyle(el).display);
    const rail = await phone.page.locator("aside.rail").boundingBox();
    const bench = await phone.page.locator('[data-slot="workbench"]').boundingBox();
    const clear = rail === null || rail.height === 0 || (bench !== null && rail.y >= bench.y + bench.height);
    c.ok(display !== "grid" && clear, "16 one column at 390px with the rail out of the way");
  } finally {
    await phone.close();
  }
}

c.done();
