// e2e/scenarios/controls.spec.ts — CTL-1 + CTL-2, the control inventory sweep.
// Requirement IDs: HEE-E2E-04
import { readFileSync } from "node:fs";
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, reviewTheWeek } from "../helpers";

interface ControlRow {
  id: string;
  route: string;
  role?: string;
  name?: string;
  selector?: string;
  covered_by: string;
  optional?: boolean;
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

test("CTL-1 every control in the inventory exists and is reachable", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await reviewTheWeek(page);
  for (const row of inventory.controls) {
    if (row.optional === true) continue;
    await openHome(page, { path: row.route });
    if (row.role !== undefined && row.name !== undefined) {
      if (row.role === "labelled") {
        await expect(page.getByLabel(row.name).first(), `control ${row.id} labelled ${row.name}`).toBeVisible();
      } else if (row.name === "*") {
        await expect(page.getByRole(row.role as "button").first(), `control ${row.id} role ${row.role}`).toBeVisible();
      } else {
        await expect(page.getByRole(row.role as "button", { name: row.name }).first(), `control ${row.id} ${row.role} ${row.name}`).toBeVisible();
      }
    } else if (row.selector !== undefined) {
      await expect(page.locator(row.selector).first(), `control ${row.id} ${row.selector}`).toBeVisible();
    } else {
      throw new Error(`control ${row.id} has neither role+name nor selector`);
    }
  }
  await openHome(page, { path: "/" });
  const unmatched = await page.evaluate(
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
        const name = `${elt.getAttribute("aria-label") ?? ""} ${(elt.textContent ?? "").trim()} ${(elt as HTMLInputElement).value ?? ""}`.replace(/\s+/g, " ").trim();
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
  expect(unmatched).toEqual([]);
});

test("CTL-2 every control not covered elsewhere is pressed once", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  for (const row of inventory.controls.filter((r) => r.covered_by === "controls-sweep")) {
    await openHome(page, { path: row.route });
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
  for (const row of inventory.inert) {
    await openHome(page, { path: row.route });
    const el = page.locator(row.selector).first();
    await expect(el, `inert ${row.id} resolves`).toBeAttached();
    const tabIndex = await el.evaluate((e) => (e as HTMLElement).tabIndex);
    const tag = await el.evaluate((e) => e.tagName);
    expect(tabIndex < 0 || ["DIV", "H1", "H2", "H3", "P", "SPAN", "HEADER", "MAIN", "ASIDE", "SECTION", "G"].includes(tag), `inert ${row.id} is not focusable`).toBe(true);
  }
});
