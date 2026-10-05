// Requirement IDs: HEE-KIT-02
import type { Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RunTrace } from "../trace/types.js";

export async function saveTraceFromPage(page: Page, path: string): Promise<RunTrace> {
  const trace = await page.evaluate(() => {
    const hook = (window as unknown as { __runTrace?: { get(): unknown } }).__runTrace;
    if (!hook) throw new Error("window.__runTrace is not installed on this page");
    return hook.get() as RunTrace;
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(trace, null, 2) + "\n", "utf8");
  return trace;
}
