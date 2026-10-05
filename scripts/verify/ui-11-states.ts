// scripts/verify/ui-11-states.ts — DP-UI WU-UI-11 (16 checks).
// Requirement IDs: FR-21
// DEVIATION: check 12 scopes the ring failure to every /api/ring/* route
// EXCEPT the two ingest paths (getEventHistory, drainWebhookInbox). Failing
// literally all of them would also break the "Use the sample week" recovery
// the same check must observe, so the check fails the health probe
// (listDevices) while the sample-week path stays open.
import type { WeekModel } from "src/domain/types.js";
import { hexToRgb } from "../lib/color.js";
import { bannedHits } from "src/llm/guard.js";
import { pickBanner } from "src/ui/copy/banner.js";
import type { BannerInput } from "src/ui/copy/banner.js";
import * as T from "src/ui/copy/templates.js";
import { createChecker, openApp } from "./ui-kit.js";

const c = createChecker("ui-11-states");

const base: BannerInput = {
  ringMode: "live",
  ringDegraded: false,
  ringError: null,
  agentKind: "bedrock",
  recordedDate: null,
  tokenMinutes: null,
  usedPct: 0,
  runError: null,
};

// 1. Each ladder row in isolation.
{
  const rows: { input: BannerInput; tone: string; title: string; action?: string }[] = [
    { input: { ...base, ringError: { status: 500 } }, tone: "danger", title: "Couldn't read Ring", action: "use-sample" },
    { input: { ...base, runError: "nope" }, tone: "danger", title: "That didn't work", action: "show-details" },
    { input: { ...base, agentKind: "manual" }, tone: "degraded", title: "Running by hand", action: "open-actions" },
    { input: { ...base, agentKind: "golden" }, tone: "degraded", title: "Replaying a recorded run" },
    { input: { ...base, agentKind: "vertex-fallback" }, tone: "degraded", title: "Using a backup model", action: "show-details" },
    { input: { ...base, ringMode: "bundle", ringDegraded: true }, tone: "degraded", title: "Showing the sample week", action: "connect" },
    { input: { ...base, tokenMinutes: 3 }, tone: "warning", title: "Token ending soon", action: "paste-token" },
    { input: { ...base, usedPct: 90 }, tone: "warning", title: "Demo budget at 90%" },
  ];
  c.ok(
    rows.every((r) => {
      const b = pickBanner(r.input);
      return b !== null && b.tone === r.tone && b.title === r.title && (b.action?.key ?? undefined) === r.action;
    }),
    "1 each ladder row resolves in isolation",
  );
}

// 2. The priority cascade.
{
  const all: BannerInput = { ringMode: "bundle", ringDegraded: true, ringError: { status: 500 }, agentKind: "manual", recordedDate: "x", tokenMinutes: 1, usedPct: 99, runError: "boom" };
  const seq: (BannerInput | null)[] = [all];
  let cur: BannerInput = all;
  const clear: (key: keyof BannerInput) => BannerInput = (key) => {
    const cleared: Record<string, unknown> = { ...cur };
    if (key === "ringError" || key === "runError") cleared[key] = null;
    else if (key === "agentKind") cleared[key] = "bedrock";
    else if (key === "ringDegraded") cleared[key] = false;
    else if (key === "tokenMinutes") cleared[key] = null;
    else if (key === "usedPct") cleared[key] = 0;
    cur = cleared as unknown as BannerInput;
    seq.push(cur);
    return cur;
  };
  clear("ringError");
  clear("runError");
  cur = { ...cur, agentKind: "golden" };
  seq.push(cur);
  cur = { ...cur, agentKind: "vertex-fallback" };
  seq.push(cur);
  cur = { ...cur, agentKind: "bedrock" };
  seq.push(cur);
  clear("ringDegraded");
  clear("tokenMinutes");
  clear("usedPct");
  const titles = seq.map((i) => (i === null ? null : pickBanner(i)?.title ?? null));
  c.ok(
    JSON.stringify(titles) ===
      JSON.stringify(["Couldn't read Ring", "That didn't work", "Running by hand", "Replaying a recorded run", "Using a backup model", "Showing the sample week", "Token ending soon", "Demo budget at 99%", null]),
    "2 priority cascades row by row down to null",
  );
}

// 3. The recorded-run branches.
{
  c.ok(T.recordedRun("12 October").detail.endsWith("saved on 12 October.") && T.recordedRun(null).detail.endsWith("this is a saved run."), "3 recorded run with and without a date");
}

// 4. Every template is total over hostile inputs.
{
  const inputs: unknown[] = [undefined, null, "", NaN, -5, 0, 1, 2];
  const fns = [T.leadSentence, T.weekTitle, T.weekSupport, T.emptyEvents, T.emptyIncidents, T.emptyChecks, T.ringError, T.actionError, T.backupModel, T.recordedRun, T.runningByHand, T.sampleWeek, T.tokenWarning, T.budgetWarning, T.notSupported3d, T.rejected, T.phaseLabel, T.ariaDayLabel, T.incidentEyebrow, T.issueTitle];
  const bad = /(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b|\bNaN\b)/;
  let ok = true;
  for (const fn of fns) {
    for (const v of inputs) {
      let out: unknown;
      try {
        out = (fn as (x: never) => unknown)(v as never);
      } catch {
        ok = false;
        break;
      }
      const texts = typeof out === "string" ? [out] : [ (out as T.Msg).title, (out as T.Msg).detail ];
      if (texts.some((t) => typeof t !== "string" || t === "" || bad.test(t))) ok = false;
    }
  }
  c.ok(ok, "4 every template total over hostile inputs");
}

// 5. Token wording branches.
{
  c.ok(
    T.tokenWarning(0).detail.includes("less than a minute") && T.tokenWarning(null).detail.includes("less than a minute") &&
      T.tokenWarning(1).detail.includes("1 minute") && !T.tokenWarning(1).detail.includes("1 minutes") &&
      T.tokenWarning(7).detail.includes("7 minutes"),
    "5 token warning singular, plural and under-a-minute",
  );
}

// 6. Budget clamps.
{
  c.ok(
    T.budgetWarning(85).title === "Demo budget at 85%" && T.budgetWarning(NaN).title === "Demo budget at 0%" &&
      T.budgetWarning(140).title === "Demo budget at 100%",
    "6 budget warning clamps to 0-100",
  );
}

// 7. Moment singular and plural.
{
  c.ok(T.leadSentence(1).includes("1 moment") && !T.leadSentence(1).includes("1 moments") && T.leadSentence(5).includes("5 moments"), "7 lead sentence singular and plural");
}

// 8. Empty-model titles stay total.
{
  const empty = { household: { name: "" } } as unknown as WeekModel;
  c.ok(T.weekTitle(empty).startsWith("The week of ") && T.weekSupport(empty, "bundle") === "The front door · Sample week", "8 empty-model titles with no empty slot");
}

const bannerTexts: string[] = [];

// 9. The golden rung names its banner, aligned to the grid.
{
  const run = await openApp({ path: "/?hook=1" });
  try {
    await run.page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
    await run.page.waitForFunction(() => document.querySelectorAll(".tick").length > 20, { timeout: 30000 });
    const banners = run.page.locator('[data-message][data-tier="banner"]');
    const count = await banners.count();
    const text = count > 0 ? ((await banners.first().innerText()) ?? "") : "";
    const edges = await run.page.evaluate(() => {
      const inner = document.querySelector('[data-message][data-tier="banner"] .message__inner');
      const grid = document.querySelector(".page");
      if (!inner || !grid) return null;
      return Math.abs(inner.getBoundingClientRect().left - grid.getBoundingClientRect().left);
    });
    bannerTexts.push(text);
    c.ok(count === 1 && text.includes("Replaying a recorded run") && (edges ?? 99) <= 1, "9 golden banner alone and grid-aligned");
  } finally {
    await run.close();
  }
}

// 10. By hand names its banner and opens the action list.
{
  const run = await openApp({ path: "/?hook=1", env: { AGENT_PROVIDER: "manual" } });
  try {
    const banner = run.page.locator('[data-message][data-tier="banner"]');
    await banner.getByText("Running by hand").waitFor({ timeout: 15000 });
    bannerTexts.push((await banner.innerText()) ?? "");
    await banner.locator('button:has-text("Open the action list")').click();
    const open = await run.page.locator("details.manual-runner").evaluate((el) => (el as HTMLDetailsElement).open);
    c.ok(open === true, "10 by-hand banner opens the action list");
  } finally {
    await run.close();
  }
}

// 11. The status chips name their rungs.
{
  const run = await openApp({ path: "/?hook=1" });
  try {
    const degraded = await run.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-degraded").trim());
    const [dr, dg, db] = hexToRgb(degraded);
    const agent = run.page.locator('.appbar__cluster .status-chip:has-text("Agent")');
    const subject = ((await agent.innerText()) ?? "").replace(/\s+/g, " ");
    const glyph = await agent.locator("svg").count();
    const bg = await agent.evaluate((el) => getComputedStyle(el).backgroundColor);
    const ring = ((await run.page.locator('.appbar__cluster .status-chip:has-text("Ring")').innerText()) ?? "").replace(/\s+/g, " ");
    bannerTexts.push(subject + " " + ring);
    c.ok(subject.includes("Recorded run") && glyph >= 1 && bg === `rgb(${dr}, ${dg}, ${db})` && ring.includes("Sample week"), "11 chips name both rungs in the degraded tint");
  } finally {
    await run.close();
  }
}

// 12. A dead ring falls back to the sample week.
{
  const run = await openApp({ path: "/?hook=1" });
  try {
    await run.page.route("**/api/ring/*", (route) => {
      const url = route.request().url();
      if (url.includes("getEventHistory") || url.includes("drainWebhookInbox")) void route.continue();
      else void route.abort("failed");
    });
    await run.page.reload({ waitUntil: "domcontentloaded" });
    const banner = run.page.locator('[data-message][data-tier="banner"]');
    await banner.getByText("Couldn't read Ring").waitFor({ timeout: 15000 });
    bannerTexts.push((await banner.innerText()) ?? "");
    await banner.locator('button:has-text("Use the sample week")').click();
    await run.page.waitForFunction(() => document.querySelectorAll(".tick").length > 20, { timeout: 30000 });
    await banner.getByText("Replaying a recorded run").waitFor({ timeout: 15000 });
    c.ok(true, "12 dead ring recovers through the sample week");
  } finally {
    await run.close();
  }
}

// 13. A failed review says so without a stack.
{
  const run = await openApp({ path: "/?hook=1" });
  try {
    await run.page.route("**/api/agent/role/*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false }) })
    );
    await run.page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
    await run.page.waitForFunction(() => document.querySelectorAll(".tick").length > 20, { timeout: 30000 });
    await run.page.locator('[data-slot="agent"] button:has-text("Review the")').click();
    const banner = run.page.locator('[data-message][data-tier="banner"]');
    await banner.getByText("That didn't work").waitFor({ timeout: 45000 });
    bannerTexts.push((await banner.innerText()) ?? "");
    await banner.locator('button:has-text("Show details")').click();
    await banner.locator('button:has-text("Hide details")').waitFor({ timeout: 5000 });
    const text = (await banner.innerText()) ?? "";
    c.ok(!/\bat \S+:\d+/.test(text), "13 failed review expands without a stack trace");
  } finally {
    await run.close();
  }
}

// 14. An expiring token warns and offers the dialog.
{
  const run = await openApp({ path: "/?hook=1" });
  try {
    await run.page.route("**/api/status**", async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as Record<string, unknown>;
      json["ring"] = { mode: "live", tokenExpiresInSec: 120 };
      json["agent"] = { kind: "bedrock", label: "Amazon Bedrock", model: "sonnet" };
      await route.fulfill({ response: res, json });
    });
    await run.page.reload({ waitUntil: "domcontentloaded" });
    const banner = run.page.locator('[data-message][data-tier="banner"]');
    await banner.getByText("Token ending soon").waitFor({ timeout: 20000 });
    const text = (await banner.innerText()) ?? "";
    bannerTexts.push(text);
    await banner.locator('button:has-text("Paste a new token")').click();
    await run.page.locator('[role="dialog"][aria-label="Connect Ring"]').waitFor({ timeout: 5000 });
    c.ok(text.includes("Your Playground token has 2 minutes left."), "14 expiring token warns with the dialog");
  } finally {
    await run.close();
  }
}

// 15. A spent budget warns.
{
  const run = await openApp({ path: "/?hook=1" });
  try {
    await run.page.route("**/api/status**", async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as Record<string, unknown>;
      json["agent"] = { kind: "bedrock", label: "Amazon Bedrock", model: "sonnet" };
      (json["cost"] as Record<string, unknown>)["usedPct"] = 85;
      await route.fulfill({ response: res, json });
    });
    await run.page.reload({ waitUntil: "domcontentloaded" });
    const banner = run.page.locator('[data-message][data-tier="banner"]');
    await banner.getByText("Demo budget at 85%").waitFor({ timeout: 20000 });
    const text = (await banner.innerText()) ?? "";
    bannerTexts.push(text);
    c.ok(text.includes("The review will stop at the limit."), "15 spent budget warns at 85%");
  } finally {
    await run.close();
  }
}

// 16. No banner carries a banned word.
{
  c.ok(bannerTexts.length === 7 && bannerTexts.every((t) => t !== "" && bannedHits(t).length === 0), "16 every banner free of banned words");
}

c.done();
