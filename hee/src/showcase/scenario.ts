// Requirement IDs: HEE-SHOW-01, HEE-SHOW-02, HEE-SHOW-03, HEE-SHOW-04, HEE-CLAIM-01
// DP-W09 §3.3 scenario reader: runStep executes one demo-scenario step on a
// Playwright-like page. The E2E suite and the stills generator share this file.
import { readFileSync } from "node:fs";
import { compileSchema, loadSchema } from "../llm/index.js";
import type { DemoAction, DemoScenario, DemoStep } from "./types.js";

export class ScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioError";
  }
}

export interface LocatorLike {
  first(): LocatorLike;
  count(): Promise<number>;
  click(o?: { timeout?: number }): Promise<void>;
  fill(v: string, o?: { timeout?: number }): Promise<void>;
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
  screenshot(o?: object): Promise<Buffer>;
}

export interface PageLike {
  goto(url: string): Promise<unknown>;
  getByRole(role: string, o: { name: string; exact?: boolean }): LocatorLike;
  getByLabel(text: string, o?: { exact?: boolean }): LocatorLike;
  getByText(text: string, o?: { exact?: boolean }): LocatorLike;
  locator(sel: string): LocatorLike;
  keyboard: { press(k: string): Promise<void> };
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: (arg: unknown) => T, arg?: unknown): Promise<T>;
  screenshot(o?: { clip?: { x: number; y: number; width: number; height: number } }): Promise<Buffer>;
  viewportSize(): { width: number; height: number } | null;
}

/** Read a demo-scenario file and validate it against the contract. */
export function readDemoScenario(path: string): DemoScenario {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new ScenarioError(`invalid scenario ${path}: ${(e as Error).message}`);
  }
  const result = compileSchema(loadSchema("contracts/hee-demo-scenario.schema.json"))(doc);
  if (!result.ok) {
    throw new ScenarioError(`invalid scenario ${path}: ${result.errors.join("; ")}`);
  }
  return doc as DemoScenario;
}

/** Execute a single action of a step. Exported so the stills hero loop can
 *  capture a frame after every action without duplicating step logic. */
export async function runAction(page: PageLike, step: DemoStep, action: DemoAction, baseUrl: string): Promise<void> {
  if ("route" in action) {
    await page.goto(baseUrl + action.route);
  } else if ("click" in action) {
    const target =
      action.role !== undefined
        ? page.getByRole(action.role, { name: action.click }).first()
        : page.getByText(action.click, { exact: false }).first();
    if ((await target.count()) === 0) {
      throw new ScenarioError(`step ${step.id}: no element named "${action.click}"`);
    }
    await target.click({ timeout: 4000 });
  } else if ("type" in action) {
    await page.getByLabel(action.type.label, { exact: false }).first().fill(action.type.value);
  } else if ("press" in action) {
    await page.keyboard.press(action.press);
  } else if ("wait_ms" in action) {
    await page.waitForTimeout(action.wait_ms);
  } else if ("play3d" in action) {
    const available = await page.evaluate(
      () =>
        typeof (window as unknown as { __demo3d?: { play?: unknown } }).__demo3d?.play === "function",
      undefined,
    );
    if (!available) {
      throw new ScenarioError(`step ${step.id}: window.__demo3d is not available`);
    }
    await page.evaluate(
      (shot) => {
        (window as unknown as { __demo3d: { play: (s: unknown) => void } }).__demo3d.play(shot);
      },
      action.play3d,
    );
  } else if ("expect_text" in action) {
    const found = await page.getByText(action.expect_text, { exact: false }).first().count();
    if (found === 0) {
      throw new ScenarioError(`step ${step.id}: expected text "${action.expect_text}" not on screen`);
    }
  }
}

export async function runStep(page: PageLike, step: DemoStep, baseUrl: string): Promise<void> {
  for (const action of step.actions) {
    await runAction(page, step, action, baseUrl);
  }
  await page.waitForTimeout(step.settle_ms);
}
