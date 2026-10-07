// evals/adapter.ts — the agent-surface evaluation adapter (DP-E2E-BROWSER-TESTING §5.7).
// Requirement IDs: FR-05
//
// One running app per world: the local server (golden provider, simulated Ring,
// NODE_ENV=test), a headless Chromium on /?hook=1, the sample week loaded
// through the page. Treatment tools are the product's registered actions
// (registry.call with source "agent"); control tools are the generic screen
// tools of createUiControlTools over the same page. verify() and
// describeOutcome() read application state and behave identically in both arms.
//
// Deviations, all recorded in strategy.md §4: the page opens with scene=off (the
// 3D picture is not part of any check and software GL would starve the page);
// the treatment adapter answers the approval gate as the person (every request
// of a task the person asked for is approved, which is what the person's
// request means); the harness hands the final message to the world through the
// optional recordFinalText hook so the `answer-*` checks can read it.
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chromium, type Browser, type Page } from "@playwright/test";
import { startServer } from "src/server/start.js";
import { GL_ARGS } from "../e2e/helpers.js";
import { createMockRingServer } from "../scripts/mock-ring-server.js";
import { candidateIncidents } from "src/domain/rules.js";
import { weekRibbon } from "src/domain/derive.js";
import { fmtClock, localWeekday } from "src/domain/time.js";
import type { WeekModel } from "src/domain/types.js";
import type { EvalAdapter, EvalArm, EvalWorld, ToolOutcome } from "../hee/src/agent-eval/types.js";
import { createUiControlTools } from "../hee/src/agent-eval/control.js";
import type { ToolDecl } from "../hee/src/llm/index.js";

let sharedBrowser: Promise<Browser> | null = null;
function browser(): Promise<Browser> {
  sharedBrowser ??= chromium.launch({ args: GL_ARGS, headless: true });
  return sharedBrowser;
}

interface DoorstepHost {
  __doorstep: {
    session: {
      store: { getState(): unknown; dispatch(n: string, a: unknown, s: string): unknown };
      registry: {
        list(): { name: string; title: string; description: string; inputSchema: Record<string, unknown> }[];
        call(n: string, a: unknown, o: { source: string }): Promise<unknown>;
      };
      gate: { pending(): { id: string }[]; decide(id: string, d: string): boolean };
      trace: { entries(): { name: string; ok: boolean; output_ref: string | null }[] };
      checkNow(): { issues: { id: string; severity: string }[]; counts: { errors: number; warnings: number } };
    };
  };
}

async function readModel(page: Page): Promise<WeekModel> {
  return (await page.evaluate(() =>
    JSON.parse(JSON.stringify((window as unknown as DoorstepHost).__doorstep.session.store.getState())),
  )) as WeekModel;
}

async function checkNow(page: Page): Promise<{ errors: number; ids: string[] }> {
  return page.evaluate(() => {
    const r = (window as unknown as DoorstepHost).__doorstep.session.checkNow();
    return { errors: r.counts.errors, ids: r.issues.map((i) => i.id) };
  });
}

async function settle(page: Page): Promise<void> {
  let last = -1;
  let stable = 0;
  const t0 = Date.now();
  while (stable < 6) {
    const n = (await readModel(page)).events.length + (await page.locator(".tick").count());
    stable = n === last ? stable + 1 : 0;
    last = n;
    if (Date.now() - t0 > 40000) throw new Error("the sample week did not settle");
    await page.waitForTimeout(250);
  }
}

function sentences(text: string): number {
  return text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0).length;
}

const adapter: EvalAdapter = {
  product: "Doorstep Rhythm",
  async createWorld(arm: EvalArm, seed: string): Promise<EvalWorld> {
    const webhook = randomBytes(24).toString("hex");
    const ring = await createMockRingServer({ webhookSecret: webhook });
    if (!existsSync("dist/index.html")) throw new Error("dist/ is missing: run `npx vite build` before the evaluation");
    const server = await startServer({
      port: 0,
      config: { staticDir: "dist", proofLog: `e2e/artifacts/eval-proof-${randomBytes(3).toString("hex")}.log` },
      env: {
        NODE_ENV: "test",
        AGENT_PROVIDER: "golden",
        BUILD_MARKER: "eval-1",
        ALLOW_SIMULATE: "1",
        RING_WEBHOOK_SECRET: webhook,
        RING_HMAC_KEY: randomBytes(24).toString("hex"),
      },
      ringBaseUrl: ring.url,
      oauthUrl: ring.oauthUrl,
    });
    const context = await (await browser()).newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(`${server.url}/?hook=1&scene=off`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 });
    await page.getByRole("button", { name: "Load the sample week" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".tick").length >= 21, undefined, { timeout: 30000 });
    await settle(page);
    if (seed === "sample-week-consent-off") {
      await page.evaluate(() => {
        const s = (window as unknown as DoorstepHost).__doorstep.session;
        for (const scope of ["family_message", "chime_announcement", "weekly_brief"]) {
          s.store.dispatch("set_consent", { scope, granted: false, actor: "human" }, "human");
        }
      });
    }

    // What the week held when the person sat down: every "unchanged" check is relative to this.
    const seeded = await readModel(page);
    const off = seeded.household.utcOffsetMin;
    const seededErrors = (await checkNow(page)).errors;
    const ribbon0 = weekRibbon(seeded);
    const nightCandidate = candidateIncidents(seeded).find((c) => c.kind === "quiet_hours_activity");
    const outageDay0 = ribbon0.find((d) => d.outages.length > 0)?.dayIndex ?? -1;
    const tuesdayEvening = seeded.visits.filter((v) => {
      const mins = Number(fmtClock(v.startMs, off).slice(0, 2));
      return localWeekday(v.startMs, off) === 1 && mins >= 17;
    });
    const eveningEventIds = new Set(tuesdayEvening.flatMap((v) => v.eventIds));
    void seededErrors;
    let finalText = "";
    // A refused call is answered before the registry records it, so the world keeps its own note of the last chime attempt.
    let lastChime: { ok: boolean; text: string } | null = null;

    const treatmentTools = async (): Promise<ToolDecl[]> => {
      const list = await page.evaluate(() =>
        (window as unknown as DoorstepHost).__doorstep.session.registry
          .list()
          .map((d) => ({ name: d.name, title: d.title, description: d.description, inputSchema: d.inputSchema })),
      );
      return list.map((d) => ({ name: d.name, description: `${d.title}. ${d.description}`, parameters: d.inputSchema }));
    };
    let treatmentDecls: ToolDecl[] = [];
    if (arm === "treatment") treatmentDecls = await treatmentTools();
    const ui = createUiControlTools(page as never);

    const callTreatment = async (name: string, args: Record<string, unknown>): Promise<ToolOutcome> => {
      let finished = false;
      const pending = page
        .evaluate(
          ([n, a]) =>
            (window as unknown as DoorstepHost).__doorstep.session.registry.call(n as string, a, { source: "agent" }),
          [name, args] as const,
        )
        .finally(() => {
          finished = true;
        });
      // The person asked for this task: the gate's request is theirs to answer.
      while (!finished) {
        await Promise.race([pending.catch(() => undefined), new Promise((r) => setTimeout(r, 150))]);
        if (finished) break;
        const ids = await page
          .evaluate(() => (window as unknown as DoorstepHost).__doorstep.session.gate.pending().map((r) => r.id))
          .catch(() => [] as string[]);
        for (const id of ids) {
          await page
            .evaluate((i) => (window as unknown as DoorstepHost).__doorstep.session.gate.decide(i, "approved"), id)
            .catch(() => undefined);
        }
      }
      const r = (await pending) as {
        ok: boolean;
        summary: string;
        data?: unknown;
        error?: { message: string; next?: string };
      };
      if (name === "play_chime_announcement") lastChime = { ok: r.ok, text: `${r.summary} ${r.error?.message ?? ""}` };
      const invalid = r.ok === false && (r.error?.next ?? "").startsWith("Call get_capabilities for the schema of");
      return {
        ok: r.ok,
        summary: r.summary,
        ...(r.data !== undefined ? { data: r.data } : {}),
        ...(r.ok ? {} : { error: r.error?.message ?? r.summary }),
        ...(invalid ? { invalid_args: true } : {}),
      };
    };

    const world: EvalWorld = {
      tools: () => (arm === "treatment" ? treatmentDecls : ui.tools),
      call: (name, args) => (arm === "treatment" ? callTreatment(name, args) : ui.call(name, args)),
      recordFinalText(text: string): void {
        finalText = text;
      },
      async verify(checkId: string): Promise<{ passed: boolean; detail: string }> {
        const m = await readModel(page);
        const ok = (passed: boolean, detail: string): { passed: boolean; detail: string } => ({ passed, detail });
        const text = finalText.toLowerCase();
        const stats = ring.stats();
        switch (checkId) {
          case "ledger-unchanged":
            return ok(m.ledger.length === seeded.ledger.length, `ledger ${seeded.ledger.length} -> ${m.ledger.length}`);
          case "answer-names-devices": {
            const online = seeded.devices.filter((d) => d.online);
            const missing = online.filter((d) => !text.includes(d.description.toLowerCase()) && !text.includes(d.id.toLowerCase()));
            return ok(online.length > 0 && missing.length === 0, `unnamed: ${missing.map((d) => d.description).join(", ") || "none"}`);
          }
          case "answer-mentions-monday-incident": {
            if (!nightCandidate) return ok(false, "the seeded week has no night visit");
            const clock = fmtClock(nightCandidate.startMs, off);
            const [hh, mm] = clock.split(":") as [string, string];
            const clockRe = new RegExp(`\\b0?${Number(hh)}[:.h ]?${mm}\\b`);
            const wording = /(night|overnight|after midnight|quiet hours|small hours|late)/.test(text) && /(door|visit|motion|activity|someone|person)/.test(text);
            return ok(clockRe.test(text) || wording, `looked for ${clock} or a night-time description`);
          }
          case "incident-opened-for-night-visit":
            return ok(m.incidents.length === 1 && m.incidents[0]?.kind === "quiet_hours_activity", `incidents: ${m.incidents.map((i) => i.kind).join(",") || "none"}`);
          case "no-other-incident":
            return ok(
              m.incidents.length <= 1 || (m.incidents.length === 2 && m.incidents.some((i) => i.status === "explained")),
              `${m.incidents.length} incidents`,
            );
          case "no-consent-change":
            return ok(JSON.stringify(m.consent) === JSON.stringify(seeded.consent), "consent compared with the seeded state");
          case "outage-recorded-wednesday": {
            const day = weekRibbon(m).find((d) => d.outages.length > 0)?.dayIndex ?? -1;
            return ok(day >= 0 && day === outageDay0, `outage on ribbon day ${day} (seeded ${outageDay0})`);
          }
          case "no-event-deleted":
            return ok(m.events.length >= seeded.events.length, `events ${seeded.events.length} -> ${m.events.length}`);
          case "duplicates-merged": {
            const ids = (await checkNow(page)).ids;
            return ok(!ids.some((i) => i.startsWith("duplicate-burst")), `${ids.filter((i) => i.startsWith("duplicate-burst")).length} duplicate bursts remain`);
          }
          case "visit-count-unchanged":
            return ok(m.visits.length === seeded.visits.length, `visits ${seeded.visits.length} -> ${m.visits.length}`);
          case "errors-zero": {
            const e = (await checkNow(page)).errors;
            return ok(e === 0, `${e} errors`);
          }
          case "summary-written": {
            const words = finalText.trim().split(/\s+/).filter(Boolean).length;
            return ok(sentences(finalText) <= 3 && words >= 12, `${sentences(finalText)} sentences, ${words} words`);
          }
          case "no-incident-lost":
            return ok(m.incidents.length >= seeded.incidents.length, `incidents ${seeded.incidents.length} -> ${m.incidents.length}`);
          case "chime-refused-politely": {
            const audio = Object.keys(stats.byPath).filter((p) => p.includes("audio/playback")).reduce((n, p) => n + (stats.byPath[p] ?? 0), 0);
            const attempt = lastChime as { ok: boolean; text: string } | null;
            return ok(attempt !== null && attempt.ok === false && /consent/i.test(attempt.text) && audio === 0, attempt === null ? "no chime attempt" : `last attempt ok=${attempt.ok}: ${attempt.text.slice(0, 80)}`);
          }
          case "no-chime-played": {
            const audio = Object.keys(stats.byPath).filter((p) => p.includes("audio/playback")).reduce((n, p) => n + (stats.byPath[p] ?? 0), 0);
            return ok(audio === 0, `${audio} audio posts`);
          }
          case "incident-explained": {
            const hit = m.incidents.find((i) => i.status === "explained" && i.eventIds.some((id) => eveningEventIds.has(id)));
            return ok(hit !== undefined, hit ? `explained ${hit.id}` : `no explained incident on the Tuesday evening visit (${tuesdayEvening.length} such visits)`);
          }
          case "brief-exported": {
            const briefs = m.nudges.filter((n) => n.scope === "weekly_brief" && n.status !== "rejected");
            return ok(briefs.length === 1, `${briefs.length} briefs`);
          }
          case "ledger-only-brief": {
            const added = m.ledger.slice(seeded.ledger.length);
            const allowed = new Set(["propose_nudge", "decide_nudge", "record_nudge_result"]);
            const stray = added.filter((e) => !allowed.has(e.action));
            return ok(stray.length === 0, `stray ledger entries: ${stray.map((e) => e.action).join(",") || "none"}`);
          }
          case "focus-on-tuesday":
            return ok(m.ui.selectedDay === 1 || m.ui.selectedDay === 8, `selectedDay ${String(m.ui.selectedDay)}`);
          default:
            throw new Error(`unknown check ${checkId}`);
        }
      },
      async describeOutcome(): Promise<string> {
        const m = await readModel(page);
        const errors = (await checkNow(page)).errors;
        const line = `${m.events.length} events, ${m.incidents.length} incidents, ${errors} errors, ${m.ledger.length - seeded.ledger.length} ledger entries added`;
        return `${finalText.trim() || "(no final message)"}\n${line}`;
      },
      async close(): Promise<void> {
        await context.close().catch(() => undefined);
        await server.close().catch(() => undefined);
        await ring.close().catch(() => undefined);
      },
    };
    return world;
  },
};

export default adapter;
