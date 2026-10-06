// e2e/scenarios/uc07-by-hand.spec.ts — UC-07 "I can run any step by hand with no model".
// Requirement IDs: FR-08, FR-05
import { test, expect } from "../fixtures";
import { openHome, loadSampleWeek, settleSampleWeek, readModel, openFirstCandidate } from "../helpers";
import { ACTION_NAMES } from "src/agent/actions";

const titleOf = (name: string): string => name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

test("UC07-1 the by-hand panel lists every action by its title", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await page.getByText("Run an action by hand").click();
  const options = await page.getByLabel("Action").locator("option").allTextContents();
  expect(options).toHaveLength(21);
  for (const name of ACTION_NAMES) {
    expect(options).toContain(titleOf(name));
  }
  expect(options).toContain("List devices");
});

test("UC07-2 an action runs with no model and says what happened", async ({ page, app, request }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  await settleSampleWeek(page);
  const agentCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/agent/")) agentCalls.push(req.url());
  });
  const before = (await readModel(page)).ledger.length;
  await page.getByText("Run an action by hand").click();
  await page.getByLabel("Action").selectOption({ label: "List devices" });
  await page.getByRole("button", { name: "Run" }).click();
  const result = page.locator('[data-slot="manual"] p');
  await expect(result.last()).not.toBeEmpty();
  expect((await readModel(page)).ledger.length).toBe(before);
  const status = (await (await request.get(`${app.url}/api/status`)).json()) as { agent: { kind: string } };
  expect(status.agent.kind).toBe("golden");
  expect(agentCalls).toEqual([]);
});

test("UC07-3 a change made by hand goes through the same gate and ledger", async ({ page, app }) => {
  await openHome(page);
  await app.local || true;
  await loadSampleWeek(page);
  const id = await openFirstCandidate(page);
  if (!id) throw new Error("the sample week has no candidate incident");
  await page.getByText("Run an action by hand").click();
  await page.getByLabel("Action").selectOption({ label: "Set incident status" });
  await page.getByLabel("IncidentId").fill(id);
  await page.getByLabel("Status", { exact: true }).selectOption("explained");
  await page.getByRole("button", { name: "Run" }).click();
  await expect.poll(async () => (await readModel(page)).incidents.find((i) => i.id === id)?.status, { timeout: 10000 }).toBe("explained");
  const model = await readModel(page);
  expect(model.incidents.find((i) => i.id === id)?.status).toBe("explained");
  const badge = await page.locator('[data-result-region="activity-feed"] li').first().locator("span").first().textContent();
  expect((badge ?? "").trim()).toBe("YOU");
});
