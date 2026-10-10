// scripts/verify/sc-03-watch.ts — DP-SHOWCASE WU-SHOWCASE-03 (12 checks).
// Requirement IDs: FR-22
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createChecker, openApp } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
// NOTE: hee-validate-run-trace.ts runs its CLI on import (vite-node argv), so
// it is used through run() only, never imported.

const c = createChecker("sc-03-watch");
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

// 1. Kit installed: name + React export. (The installer records the install
// in INSTALLED.json; the kit source carries kit.json.)
const installed = JSON.parse(readFileSync("src/kits/showcase-replay/INSTALLED.json", "utf8")) as { kit?: string };
const kitIndex = readFileSync("src/kits/showcase-replay/src/react/index.ts", "utf8");
c.ok(installed.kit === "showcase-replay" && kitIndex.includes("ReplayControl"), "kit showcase-replay with ReplayControl");

// 2. Saved trace validates; chassis line; >= 15 action entries with args.
const trace = JSON.parse(readFileSync("data/replay/run-trace.json", "utf8")) as {
  entries?: { kind?: string; args?: unknown }[];
};
const withArgs = (trace.entries ?? []).filter((e) => e.kind === "action" && e.args !== undefined).length;
const chassis = run("npx", ["vite-node", "hee/scripts/hee-validate-run-trace.ts", "data/replay/run-trace.json", "--min-roles", "4", "--min-actions", "15", "--require-verify-repair", "--require-human-checkpoint"]);
const chassisOk = chassis.out.split("\n").some((l) => l.trim().startsWith("trace ok:"));
c.ok(chassisOk && withArgs >= 15, `chassis trace-ok line + ${withArgs} actions with args`);

// 3. Sync prints + byte-identical public copy.
const sync = run("npx", ["vite-node", "scripts/sync-replay.ts"]);
c.ok(
  /replay: synced \d+ entries/.test(sync.out) &&
    readFileSync("public/replay/run-trace.json", "utf8") === readFileSync("data/replay/run-trace.json", "utf8"),
  "sync prints entries + public copy identical",
);

// 4. Page shapes; ReplayView clean of live-agent imports.
const watchSrc = readFileSync("src/ui/pages/Watch.tsx", "utf8");
const viewSrc = readFileSync("src/ui/showcase/ReplayView.tsx", "utf8");
c.ok(
  watchSrc.includes("export default function WatchPage") && watchSrc.includes("SessionProvider") && watchSrc.includes("sessionIdOverride") &&
    viewSrc.includes("src/kits/showcase-replay/src/react") && viewSrc.includes("ReplayControl") &&
    !viewSrc.includes("fetch(\"/api/agent") && !viewSrc.includes("createAppSession") && !viewSrc.includes("registry.call"),
  "WatchPage default + override; ReplayView via kit, no live-agent imports",
);

const beforeSha = sha("data/replay/run-trace.json");
const consoleErrors: string[] = [];
const agentRequests: string[] = [];
const app = await openApp({ path: "/watch?hook=1" });
const page = app.page;
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/agent/")) agentRequests.push(r.url()); });
try {
  const box0 = await page.locator('[data-demo-focus="replay"]').first().boundingBox();

  // 5. Exactly one focus target per route with a non-zero box.
  const replayCount = await page.locator('[data-demo-focus="replay"]').count();
  await page.goto(app.url + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
  const wbCount = await page.locator('[data-demo-focus="workbench"]').count();
  await page.goto(app.url + "/lab", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });
  const labCount = await page.locator('[data-demo-focus="lab"]').count();
  c.ok(
    replayCount === 1 && (box0?.width ?? 0) > 0 && (box0?.height ?? 0) > 0 && wbCount === 1 && labCount === 1,
    `one focus target per route (replay=${replayCount} workbench=${wbCount} lab=${labCount})`,
  );
  await page.goto(app.url + "/watch?hook=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('body[data-app-ready="true"]', { timeout: 15000 });

  // 6. Pre-click: replay banner, enabled button, live-nothing chip.
  const banner = await page.locator('[data-hee-replay="banner"]').first().innerText().catch(() => "");
  const btnEnabled = await page.locator('[data-hee-replay="start"]').first().isEnabled().catch(() => false);
  const chip = await page.getByText("Replay · nothing here is live").first().count();
  c.ok(banner.includes("REPLAY of a recorded run") && btnEnabled && chip > 0, "pre-click banner + enabled button + chip");

  // 7. 4x replay finishes with the closing message, never diverges.
  await page.locator('[data-hee-replay="speed"]').first().selectOption("4");
  await page.locator('[data-hee-replay="start"]').first().click();
  let state = "";
  const deadline = Date.now() + 90000;
  let diverged = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    state = await page.locator('[data-hee-replay="state"]').first().innerText().catch(() => "");
    const body = await page.locator("body").first().innerText().catch(() => "");
    if (/diverged/i.test(body)) { diverged = true; break; }
    if (state.includes("Replay finished. Nothing above was live.")) break;
  }
  c.ok(!diverged && state.includes("Replay finished. Nothing above was live."), `4x replay closes clean (${state.slice(0, 60)})`);

  // 8. Replay session matches the trace: truth errors + incident count.
  const observed = await page.evaluate(() => {
    const host = window as unknown as { __replay?: { session?: {
      checkNow(): { counts: { errors: number } };
      store: { getState(): { incidents?: unknown[] } };
    } } };
    const s = host.__replay?.session;
    if (!s) return null;
    return { errors: s.checkNow().counts.errors, incidents: (s.store.getState().incidents ?? []).length };
  });
  const expected = await (async () => {
    const t = JSON.parse(readFileSync("data/replay/run-trace.json", "utf8")) as {
      entries?: { kind?: string; name?: string; ok?: boolean }[];
      summary?: { final_truth?: { errors?: number } };
    };
    return {
      errors: t.summary?.final_truth?.errors ?? -1,
      incidents: (t.entries ?? []).filter((e) => e.kind === "action" && e.name === "open_incident" && e.ok === true).length,
    };
  })();
  c.ok(
    observed !== null && observed.errors === expected.errors && observed.incidents === expected.incidents,
    `replay matches trace (errors=${observed?.errors}/${expected.errors} incidents=${observed?.incidents}/${expected.incidents})`,
  );

  // 9. Live session untouched: empty ledger + empty live trace.
  const live = await page.evaluate(() => {
    const host = window as unknown as { __doorstep?: { session?: { store: { getState(): { ledger?: unknown[] } } } }; __runTrace?: { get(): { entries: unknown[] } } };
    return {
      ledger: host.__doorstep?.session?.store.getState().ledger?.length ?? -1,
      trace: host.__runTrace?.get().entries.length ?? -1,
    };
  });
  c.ok(live.ledger === 0 && live.trace === 0, `live untouched (ledger=${live.ledger} trace=${live.trace})`);

  // 10. No /api/agent/ traffic during replay.
  c.ok(agentRequests.length === 0, `no agent traffic (${agentRequests.length})`);

  // 11. 390x844: no overflow; zero console errors all run.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const bad: string[] = [];
    for (const el of document.querySelectorAll("*")) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width > 0 && r.right > cw + 0.5) bad.push((el as HTMLElement).tagName);
      if (bad.length >= 3) break;
    }
    return bad;
  });
  c.ok(overflow.length === 0 && consoleErrors.length === 0, `no 390px overflow, no console errors (${consoleErrors.slice(0, 2).join("|") || "clean"})`);
} finally {
  await app.close();
}

// 12. Saved run byte-identical after replay.
c.ok(sha("data/replay/run-trace.json") === beforeSha, "saved run unchanged");

c.done();
