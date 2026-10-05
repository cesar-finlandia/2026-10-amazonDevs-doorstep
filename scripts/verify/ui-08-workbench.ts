// scripts/verify/ui-08-workbench.ts — DP-UI WU-UI-08 (18 checks).
// Requirement IDs: FR-06, FR-07, FR-08, FR-09
import type { Page } from "@playwright/test";
import type { TraceEntry } from "src/kits/agent-workflow/src/trace/types.js";
import type { WeekModel } from "src/domain/types.js";
import { friendlyEntry } from "src/ui/trace/friendly.js";
import { hexToRgb } from "../lib/color.js";
import { createChecker, openApp, readModel, waitCalm } from "./ui-kit.js";

const c = createChecker("ui-08-workbench");

// 17. The friendly trace maps every entry kind (no browser needed).
{
  const base = { seq: 1, round: 1, input_ref: null, output_ref: null, ok: true, latency_ms: 1 } as const;
  const model = friendlyEntry({ ...base, kind: "model", name: "planner", source: "agent", output_ref: "3 steps" }, {});
  const action = friendlyEntry(
    { ...base, kind: "action", name: "ingest_ring_events", source: "agent", output_ref: "Added 5 events." },
    { ingest_ring_events: "Bring in new events" },
  );
  const approval = friendlyEntry({ ...base, kind: "approval", name: "play_chime_announcement", source: "agent", decision: "rejected" }, {});
  const system = friendlyEntry({ ...base, kind: "system", name: "note", source: "system", output_ref: "kept" }, {});
  const dirty = friendlyEntry(
    {
      ...base, kind: "action", name: "ingest_ring_events", source: "agent",
      output_ref: "Added 5 events from webhook_inbox.",
      state_change: { revision_before: 1, revision_after: 2, entity_ids: ["a", "b"] },
      truth: { errors: 1, warnings: 2 },
    },
    { ingest_ring_events: "Bring in new events" },
  );
  c.ok(
    model.badge === "AGENT" && model.actor === "Planner" && model.title === "Planner drew up the review" &&
      action.title === "Bring in new events" && approval.title.startsWith("Approval · ") && system.badge === "SYSTEM" &&
      !/· ·|^·|·$|undefined|null/.test(dirty.detail) && !/[a-z]+_[a-z_]+/.test(dirty.detail),
    "17 friendly entries for model, action, approval and system",
  );
}

const runIds: string[] = [];
const run = await openApp({ env: { AGENT_PROVIDER: "golden" }, path: "/?hook=1" });
try {
  const page = run.page;
  page.on("request", (req) => {
    const id = req.headers()["x-run-id"];
    if (typeof id === "string") runIds.push(id);
  });
  const agentBtn = page.locator('[data-slot="agent"] button:has-text("Review the")');

  // 1. The primary panel names the agent; the button follows the model.
  {
    const panel = page.locator('[data-slot="agent"] [data-surface][data-emphasis="primary"]');
    const eyebrow = ((await panel.locator("header .eyebrow").textContent()) ?? "").trim();
    const before = ((await agentBtn.textContent()) ?? "").trim();
    await page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
    await waitCalm(page);
    const after = ((await agentBtn.textContent()) ?? "").trim();
    c.ok(eyebrow === "Agent" && before === "Review the sample week" && after === "Review the week", "1 agent panel with a following button");
  }

  // 2. The golden rung reads as a recorded run.
  {
    const subject = ((await page.locator('[data-slot="agent"] header .subject').textContent()) ?? "").trim();
    c.ok(subject.includes("Recorded run"), "2 agent subject names the recorded run");
  }

  // 3. Idle before the run.
  {
    const status = await page.locator("[data-run-status]").getAttribute("data-run-status");
    const phase = await page.locator("[data-run-status]").getAttribute("data-run-phase");
    c.ok(status === "idle" && phase === "idle", "3 idle before the run");
  }

  await agentBtn.click();

  // 4. Running within two seconds with its indicator and seven phases.
  {
    await page.waitForFunction(() => document.querySelector("[data-run-status]")?.getAttribute("data-run-status") === "running", { timeout: 5000 });
    const indicator = await page.locator('[data-slot="agent"] [role="status"]').count();
    const names = await page.locator("[data-slot='agent'] .phase-list li").allTextContents();
    c.ok(
      indicator >= 1 &&
        JSON.stringify(names.map((t) => t.trim())) ===
          JSON.stringify(["Read the week", "Plan the review", "Check each day", "Run the checks", "Fix what was found", "Write it up", "Your decision"]),
      "4 running with indicator and seven phases",
    );
  }

  // 5, 6, 7, 15. One supervised run: poll phases, approve, watch the nudge.
  const ORDER = ["perceive", "plan", "act", "verify", "repair", "explain", "checkpoint"];
  const seen: string[] = [];
  let sixOk = false;
  let sevenOk = false;
  let fifteenOk = false;
  {
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    const [ar, ag, ab] = hexToRgb(accent);
    const deadline = Date.now() + 180000;
    let done = false;
    while (Date.now() < deadline && !done) {
      const phase = (await page.locator("[data-run-status]").getAttribute("data-run-phase")) ?? "idle";
      if (phase !== "idle" && seen[seen.length - 1] !== phase) seen.push(phase);
      if (!sixOk && ORDER.indexOf(phase) >= 2) {
        sixOk = await page.evaluate(([want]: string[]) => {
          const items = [...document.querySelectorAll("[data-slot='agent'] .phase-list li")];
          const cur = items.findIndex((li) => li.getAttribute("data-current") === "true");
          if (cur < 0) return false;
          const color = getComputedStyle(items[cur] as Element).color;
          const finished = items.slice(0, cur).every((li) => li.querySelector("svg") !== null);
          return color === want && finished;
        }, [`rgb(${ar}, ${ag}, ${ab})`]);
      }
      const approve = page.locator('[data-result-region="approval-bar"] button:has-text("Approve")');
      const approveVisible = (await approve.count()) > 0 &&
        await approve.first().isVisible().catch(() => false);
      if (!sevenOk && approveVisible) {
        try {
          const text = ((await page.locator('[data-result-region="approval-bar"]').innerText()) ?? "");
          const pos = await page.locator('[data-result-region="approval-bar"]').evaluate((el) => getComputedStyle(el).position);
          const warning = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-warning").trim());
          const [wr, wg, wb] = hexToRgb(warning);
          // The band is the pending line itself: the parent of the Approve button.
          await page.waitForFunction(
            (want: string) => {
              const btn = [...document.querySelectorAll('[data-result-region="approval-bar"] button')].find((b) => b.textContent?.trim() === "Approve");
              const band = btn?.parentElement;
              return band !== undefined && band !== null && getComputedStyle(band).backgroundColor === want;
            },
            `rgb(${wr}, ${wg}, ${wb})`,
            { timeout: 3000 },
          );
          sevenOk = text.includes("AGENT WANTS TO") && pos === "sticky";
        } catch {
          /* the request vanished mid-capture; retry next poll */
        }
      }
      if (approveVisible) {
        try {
          await approve.first().click();
        } catch {
          /* detached; retry next poll */
        }
      }
      if (!fifteenOk) {
        const card = page.locator("[data-nudge-card]");
        if ((await card.count()) > 0 && (await card.locator('button:has-text("Approve")').count()) > 0) {
          try {
            const support = ((await card.locator(".support").first().textContent()) ?? "").trim();
            const model = (await readModel(page)) as unknown as WeekModel;
            const consentOn = model.consent.some((k) => k.scope === "family_message" && k.granted);
            if (support === `To ${model.household.caretaker} · family messages ${consentOn ? "on" : "off"}`) {
              await card.locator('button:has-text("Approve")').click();
              await page.waitForTimeout(500);
              const check = await page.evaluate(() => {
                const w = window as unknown as {
                  __doorstep: { session: { store: { getState(): WeekModel } } };
                  __runTrace: { get(): { entries: { name: string; source: string }[] } };
                };
                const m = w.__doorstep.session.store.getState();
                const nud = m.nudges.find((x) => x.scope === "family_message");
                const you = w.__runTrace.get().entries.some((e) => e.source === "human" && e.name.includes("decide"));
                return { approved: nud?.status, you };
              });
              fifteenOk = check.approved === "approved" && check.you === true;
            }
          } catch {
            /* mid-render; retry next poll */
          }
        }
      }
      done = ((await page.locator("[data-run-status]").getAttribute("data-run-status")) ?? "") === "done";
      if (!done) await page.waitForTimeout(50);
    }
    const ordered = seen.filter((p) => ORDER.includes(p));
    const inOrder = ordered.every((p, i) => i === 0 || ORDER.indexOf(p) > ORDER.indexOf(ordered[i - 1] as string));
    c.ok(ordered.length > 0 && ordered.every((p) => ORDER.includes(p)) && inOrder, "5 phases in order");
  }
  c.ok(sixOk, "6 current phase accented, finished checked");
  c.ok(sevenOk, "7 pending approval sticky in the warning band");
  c.ok(fifteenOk, "15 nudge approved by hand with a YOU entry");

  // 8. Quiet approval bar after the run.
  {
    const text = ((await page.locator('[data-result-region="approval-bar"]').innerText()) ?? "");
    c.ok(text.includes("Nothing is waiting for you."), "8 nothing pending after the run");
  }

  // 9. The requirement switch drives the gate.
  {
    const box = page.locator('[data-result-region="approval-bar"] input[type="checkbox"]');
    await box.uncheck();
    const off = await page.evaluate(() => (window as unknown as { __doorstep: { session: { gate: { isEnabled(): boolean } } } }).__doorstep.session.gate.isEnabled());
    await box.check();
    const on = await page.evaluate(() => (window as unknown as { __doorstep: { session: { gate: { isEnabled(): boolean } } } }).__doorstep.session.gate.isEnabled());
    c.ok(off === false && on === true, "9 requirement switch drives the gate");
  }

  // 10. The run lands incidents, circles and zero errors.
  {
    const status = await page.locator("[data-run-status]").getAttribute("data-run-status");
    const model = (await readModel(page)) as unknown as WeekModel;
    const shown = model.incidents.filter((x) => x.status === "open" || x.status === "explained").length;
    const circles = await page.locator(".pencil-circle").count();
    const errors = await page.evaluate(() => {
      const w = window as unknown as { __doorstep: { session: { checkNow(): { counts: { errors: number } } } } };
      return w.__doorstep.session.checkNow().counts.errors;
    });
    c.ok(status === "done" && model.incidents.length >= 1 && circles === shown && errors === 0, "10 done with incidents, circles and zero errors");
  }

  // 11-14. The friendly feed.
  {
    const rows = page.locator('[data-result-region="activity-feed"] li');
    const n = await rows.count();
    const texts = await rows.allTextContents();
    const begins = texts.every((t) => /^(AGENT|YOU|SYSTEM)/.test(t.trim()));
    const raw = texts.some((t) => /[a-z]+_[a-z_]+/.test(t));
    const all = texts.join("\n");
    const phrases = ["Reader read the records", "Planner drew up the review", "Agent chose the next step", "Writer wrote it up"];
    c.ok(n >= 15, "11 feed has fifteen rows");
    c.ok(begins && !raw, "12 rows badged without raw names");
    c.ok(phrases.every((p) => all.includes(p)), "13 role phrases present");
    const heights = await rows.evaluateAll((els) => els.map((el) => getComputedStyle(el).maxHeight));
    const tall = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-result-region="activity-feed"] li')];
      return items.map((el) => ({ over: (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 1 }));
    });
    const idx = tall.findIndex((t) => t.over);
    let expanded = false;
    if (idx >= 0) {
      const more = rows.nth(idx).locator('button:has-text("Show more")');
      if ((await more.count()) === 1) {
        const before = (await rows.nth(idx).boundingBox())?.height ?? 0;
        await more.click();
        const after = (await rows.nth(idx).boundingBox())?.height ?? 0;
        expanded = after > 56 && after > before;
      }
    }
    c.ok(heights.every((h) => h === "56px") && idx >= 0 && expanded, "14 clamped rows expand past 56 px");
  }

  // 16. The manual runner lists the registry.
  {
    const details = page.locator("details.manual-runner");
    const openAttr = await details.getAttribute("open");
    await details.locator("summary").click();
    const options = await details.locator("select").first().locator("option").count();
    c.ok(openAttr === null && options >= 20, "16 manual runner with twenty actions");
  }

  // 18. A second press while running starts no second run (fresh server: the
  // first server's rung stepped down during the supervised run above).
  {
    const fresh = await openApp({ env: { AGENT_PROVIDER: "golden" }, path: "/?hook=1" });
    try {
      const page2 = fresh.page;
      const ids: string[] = [];
      page2.on("request", (req) => {
        const id = req.headers()["x-run-id"];
        if (typeof id === "string") ids.push(id);
      });
      await page2.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
      await waitCalm(page2);
      const btn2 = page2.locator('[data-slot="agent"] button:has-text("Review the")');
      await btn2.click();
      await btn2.click();
      const deadline = Date.now() + 180000;
      let done = false;
      let lastStatus = "";
      while (Date.now() < deadline && !done) {
        const approve = page2.locator('[data-result-region="approval-bar"] button:has-text("Approve")');
        if ((await approve.count()) > 0) {
          try {
            if (await approve.first().isVisible()) await approve.first().click();
          } catch {
            /* retry */
          }
        }
        lastStatus = (await page2.locator("[data-run-status]").getAttribute("data-run-status")) ?? "";
        done = lastStatus === "done";
        if (!done) await page2.waitForTimeout(100);
      }
      const distinct = [...new Set(ids)];
      if (!(done && distinct.length === 1)) console.log(`diagnostic 18: done=${done} status=${lastStatus} runs=${JSON.stringify(distinct)}`);
      c.ok(done && distinct.length === 1, "18 one run id across a double press");
    } finally {
      await fresh.close();
    }
  }
} finally {
  await run.close();
}

c.done();
