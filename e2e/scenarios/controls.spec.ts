// e2e/scenarios/controls.spec.ts — CTL-1 + CTL-2, the control inventory sweep.
// Requirement IDs: HEE-E2E-04
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, settleSampleWeek, reviewTheWeek } from "../helpers";

interface ControlRow {
  id: string;
  route: string;
  role?: string;
  name?: string;
  selector?: string;
  covered_by: string;
  optional?: boolean;
  needs_week?: boolean;   // the control exists only once the sample week is loaded
}

interface InertRow {
  id: string;
  route: string;
  selector: string;
  kind: string;
  reason: string;
}

const inventory = JSON.parse(readFileSync("e2e/controls.json", "utf8")) as {
  controls: ControlRow[];
  inert: InertRow[];
};

const REVERSE = 'button, a[href], [role="switch"], [role="radio"], input, select, summary';

/** True when the row's control is visible right now (count() never waits, so a busy page cannot stall it). */
async function present(page: Page, row: ControlRow): Promise<boolean> {
  let loc;
  if (row.role !== undefined && row.name !== undefined) {
    if (row.role === "labelled") loc = page.getByLabel(row.name);
    else if (row.name === "*") loc = page.getByRole(row.role as "button");
    else loc = page.getByRole(row.role as "button", { name: row.name });
  } else if (row.selector !== undefined) {
    loc = page.locator(row.selector);
  } else {
    throw new Error(`control ${row.id} has neither role+name nor selector`);
  }
  if ((await loc.count()) === 0) return false;
  return loc.first().isVisible();
}

async function unlistedControls(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ reverse, controls, inert }: { reverse: string; controls: ControlRow[]; inert: InertRow[] }) => {
      const visible = [...document.querySelectorAll(reverse)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      });
      const out: string[] = [];
      for (const el of visible) {
        const elt = el as HTMLElement;
        if (inert.some((row) => {
          try {
            return elt.matches(row.selector);
          } catch {
            return false;
          }
        })) continue;
        const labelled = elt.getAttribute("aria-label") ?? elt.closest("label")?.textContent ?? "";
        const name = `${elt.getAttribute("aria-label") ?? ""} ${(elt.textContent ?? "").trim()} ${elt.closest("label")?.textContent ?? ""} ${(elt as HTMLInputElement).value ?? ""}`.replace(/\s+/g, " ").trim();
        let role = elt.getAttribute("role") ?? ({ BUTTON: "button", A: "link", INPUT: "textbox", SELECT: "combobox", SUMMARY: "labelled" } as Record<string, string>)[elt.tagName] ?? "";
        if (elt.tagName === "INPUT") {
          const t = elt.getAttribute("type");
          role = t === "checkbox" ? "checkbox" : t === "radio" ? "radio" : "textbox";
        }
        const hit = controls.some((row) => {
          if (row.selector) {
            try {
              return elt.matches(row.selector);
            } catch {
              return false;
            }
          }
          if (row.role === "labelled") return row.name === "*" || (labelled ?? "").includes(row.name ?? "");
          return role === row.role && (row.name === "*" || row.name === undefined || name.includes(row.name ?? ""));
        });
        if (!hit) out.push(`${elt.tagName.toLowerCase()}[${role}] "${name.slice(0, 80)}"`);
      }
      return out;
    },
    { reverse: REVERSE, controls: inventory.controls, inert: inventory.inert },
  );
}

test("CTL-1 every control in the inventory exists and is reachable", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  // A control may live only in one state of the page (the Load button before the
  // week, Merge duplicates while twins remain, the message card's Approve after
  // the review), so each non-optional row must be visible in at least one of
  // the three states, and in every state every visible control is listed.
  const wanted = inventory.controls.filter((r) => r.optional !== true);
  const seen = new Set<string>();
  const sweep = async (): Promise<void> => {
    for (const row of wanted) {
      if (row.route === "/" && !seen.has(row.id) && (await present(page, row))) seen.add(row.id);
    }
  };
  await sweep();
  await loadSampleWeek(page);
  await settleSampleWeek(page);
  await sweep();
  expect(await unlistedControls(page), "controls on the loaded week").toEqual([]);
  await reviewTheWeek(page);
  await sweep();
  expect(await unlistedControls(page), "controls after the review").toEqual([]);
  // The by-hand runner and the Ring token dialog open on demand.
  await page.locator("summary", { hasText: "Run an action by hand" }).click();
  await sweep();
  expect(await unlistedControls(page), "controls with the by-hand runner open").toEqual([]);
  await page.getByRole("button", { name: "Connect Ring" }).first().click();
  await sweep();
  expect(await unlistedControls(page), "controls with the Ring dialog open").toEqual([]);
  await page.getByRole("button", { name: "Cancel" }).first().click();
  await expect(page.locator('[role="dialog"][aria-label="Connect Ring"]')).toBeHidden();
  for (const row of wanted.filter((r) => r.route !== "/")) {
    await openHome(page, { path: row.route });
    if (await present(page, row)) seen.add(row.id);
  }
  const missing = wanted.filter((r) => !seen.has(r.id)).map((r) => `${r.id} ${r.role ?? r.selector} ${r.name ?? ""}`.trim());
  expect(missing, "controls never visible in any state").toEqual([]);
});

test("CTL-2 every control not covered elsewhere is pressed once", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  for (const row of inventory.controls.filter((r) => r.covered_by === "controls-sweep")) {
    // A reload keeps the session id, and the server hands each session its history
    // once: a new session per page load gives every row the full sample week.
    await page.evaluate(() => sessionStorage.clear());
    await openHome(page, { path: row.route });
    if (row.needs_week === true) {
      await loadSampleWeek(page);
      await settleSampleWeek(page);
    }
    if (row.role === "switch" || (row.role === undefined && row.selector?.includes("switch") === true)) {
      const sw = row.selector ? page.locator(row.selector).first() : page.getByRole("switch").first();
      const was = await sw.getAttribute("aria-checked");
      await sw.click();
      await expect(sw).toHaveAttribute("aria-checked", was === "true" ? "false" : "true");
      await sw.click();
      await expect(sw).toHaveAttribute("aria-checked", was ?? "");
    } else {
      const target = row.selector ? page.locator(row.selector).first() : page.getByRole(row.role as "button", { name: row.name }).first();
      await target.click();
      await page.keyboard.press("Escape");
    }
  }
  await page.locator("[data-app-explainer]").click();
  await expect(page.locator("[data-app-explainer-panel]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-app-explainer-panel]")).toBeHidden();
  let openedRoute = "";
  for (const row of inventory.inert) {
    if (row.route !== openedRoute) {
      await page.evaluate(() => sessionStorage.clear());
      await openHome(page, { path: row.route });
      // The marks drawn on the calendar exist only once the week is there.
      if (row.route === "/") {
        await loadSampleWeek(page);
        await settleSampleWeek(page);
      }
      openedRoute = row.route;
    }
    const el = page.locator(row.selector).first();
    // The seam is drawn once the second webhook-inbox drain lands (the page polls every 10 s).
    await expect(el, `inert ${row.id} resolves`).toBeAttached({ timeout: 25000 });
    const tabIndex = await el.evaluate((e) => (e as HTMLElement).tabIndex);
    const tag = await el.evaluate((e) => e.tagName);
    expect(tabIndex < 0 || ["DIV", "H1", "H2", "H3", "P", "SPAN", "HEADER", "MAIN", "ASIDE", "SECTION", "G"].includes(tag), `inert ${row.id} is not focusable`).toBe(true);
  }
});
