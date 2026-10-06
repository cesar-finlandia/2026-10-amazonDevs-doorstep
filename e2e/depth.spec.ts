// e2e/depth.spec.ts — the depth acceptance (DP-E2E-BROWSER-TESTING WU-E2E-05; assertion §5.3 DEPTH-1).
// Requirement IDs: FR-06, FR-07, FR-09
// Like smoke.spec.ts it honours BASE_URL: only app.url, openHome,
// loadSampleWeek, reviewTheWeek, checkNow, saveTrace and guard are used.
import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { openHome, loadSampleWeek, reviewTheWeek, checkNow, saveTrace } from "./helpers";

const TRACE_PATH = "e2e/artifacts/run-trace.json";

test.beforeAll(async ({ app }) => {
  console.log(`depth: base ${app.url}`);
});

type Issue = { id: string; severity: "error" | "warning"; message: string };

/** helpers.checkNow is typed as the issue list, but session.checkNow()
//  answers { issues, counts }: accept both shapes (recorded for WU-08). */
function issuesOf(res: unknown): Issue[] {
  if (Array.isArray(res)) return res as Issue[];
  if (typeof res === "object" && res !== null && Array.isArray((res as { issues?: unknown }).issues)) {
    return (res as { issues: Issue[] }).issues;
  }
  throw new Error(`checkNow() answered neither a list nor { issues }: ${String(JSON.stringify(res)).slice(0, 120)}`);
}

test("DEPTH-1 one run of the core demo meets the depth bar", async ({ page, guard }) => {
  await openHome(page);
  await loadSampleWeek(page);
  const before = issuesOf(await checkNow(page));
  const beforeErrors = before.filter((i) => i.severity === "error").length;
  const approvals = await reviewTheWeek(page);
  expect(approvals).toBeGreaterThanOrEqual(1);
  const after = issuesOf(await checkNow(page));
  const afterErrors = after.filter((i) => i.severity === "error").length;
  expect(afterErrors).toBeLessThanOrEqual(beforeErrors);
  expect(afterErrors).toBe(0);

  const entryCount = await saveTrace(page, TRACE_PATH);
  expect(entryCount).toBeGreaterThan(0);
  // The validator module runs its CLI main() on import outside Vitest, so it
  // is loaded dynamically with the Vitest guard set for this worker only.
  process.env["VITEST"] = "1";
  const { validateRunTraceFile } = await import("../hee/scripts/hee-validate-run-trace.js");
  delete process.env["VITEST"];
  const checked = validateRunTraceFile(TRACE_PATH);
  expect(checked.ok).toBe(true);
  if (!checked.ok) throw new Error(`run trace invalid: ${checked.reason}`);
  const traceSummary = checked.summary;
  expect(traceSummary.model_roles.length).toBeGreaterThanOrEqual(4);
  expect(traceSummary.actions).toBeGreaterThanOrEqual(15);
  expect(traceSummary.verify_repair_rounds).toBeGreaterThanOrEqual(1);
  expect(traceSummary.human_checkpoints).toBeGreaterThanOrEqual(1);

  // Every on-screen metric equals the trace's number: the Check panel badge
  // and the hero metric equal the open issues of checkNow().
  const openIssues = after.filter((i) => i.severity === "error" || i.severity === "warning").length;
  const badge = Number((await page.locator("[data-check-count]").innerText()).trim());
  expect(badge).toBe(openIssues);
  const hero = Number(
    (await page.locator('[data-result-region="open-checks"] [data-metric]').innerText()).trim(),
  );
  expect(hero).toBe(openIssues);

  // The feed rows use the friendly adapter, which shows every trace entry, so
  // the feed row count equals the trace entry count (action entries plus
  // model calls plus the human-checkpoint entries).
  const traceFile = JSON.parse(readFileSync(TRACE_PATH, "utf8")) as {
    entries: { kind: string; name: string }[];
  };
  const traceActions = traceFile.entries.filter((e) => e.kind === "action" && e.name !== "get_capabilities").length;
  const traceModels = traceFile.entries.filter((e) => e.kind === "model").length;
  expect(traceActions).toBe(traceSummary.actions);
  expect(traceModels).toBe(traceSummary.model_calls);
  const feedRows = await page.locator('[data-result-region="activity-feed"] li').count();
  expect(feedRows).toBe(traceFile.entries.length);
  expect(guard.errors()).toEqual([]);
});
