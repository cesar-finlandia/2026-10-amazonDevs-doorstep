// scripts/verify/ui-craft.ts — DP-UI WU-UI-13 (37 checks).
// Requirement IDs: FR-19, NFR-05, NFR-06, NFR-08
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Dirent } from "node:fs";
import { bannedHits } from "src/llm/guard.js";
import { CRAFT_ASSERTIONS, createChecker, openApp, reviewTheWeek, waitCalm } from "./ui-kit.js";

const c = createChecker("craft");

const CONFIGS = [
  { label: "1440 × 900 paper", width: 1440, height: 900, theme: "light" },
  { label: "1440 × 900 dusk", width: 1440, height: 900, theme: "dark" },
  { label: "390 × 844 paper", width: 390, height: 844, theme: "light" },
  { label: "390 × 844 dusk", width: 390, height: 844, theme: "dark" },
] as const;

const seenTexts: string[] = [];
for (const cfg of CONFIGS) {
  const run = await openApp({ width: cfg.width, height: cfg.height, theme: cfg.theme, path: "/?hook=1" });
  try {
    // The review needs a loaded week (as in ui-12 check 3): without events
    // the explain phase has nothing to narrate and the run errors.
    await run.page.locator('[data-slot="ribbon"] button:has-text("Load the sample week")').click();
    await waitCalm(run.page);
    await reviewTheWeek(run.page);
    const results = await CRAFT_ASSERTIONS(run.page);
    for (let n = 0; n < 9; n++) {
      const r = results[n]!;
      c.ok(r.ok, `[${cfg.label}] ${r.name}${r.ok ? "" : ": " + r.detail}`);
    }
    seenTexts.push(await run.page.evaluate(() => document.body.innerText ?? ""));
  } finally {
    await run.close();
  }
}

// 37. No banned word in the app's rendered strings or sources (the vocabulary
// check of §5.11; the chassis check_banned_words.py is absent here, so the
// same bannedHits oracle scans the four rendered pages plus src/ui,
// index.html and brand/ — the surfaces the craft spec governs).
{
  const hits: string[] = [];
  for (const t of seenTexts) {
    for (const h of bannedHits(t)) if (!hits.includes(h)) hits.push(h);
  }
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.(tsx?|css|html|md|svg)$/.test(e.name)) continue;
      // The guard oracle names the patterns to match them; it is not UI copy.
      if (p.replace(/\\/g, "/").endsWith("shim/guard-browser.ts")) continue;
      let text = "";
      try {
        text = readFileSync(p, "utf8");
      } catch {
        continue;
      }
      // Skip test ids and code identifiers: only user-visible strings count.
      // A pragmatic cut: strip nothing, bannedHits is substring-based, so
      // report file hits separately for triage.
      for (const h of bannedHits(text)) {
        const tag = `${p}: ${h}`;
        if (!hits.includes(tag)) hits.push(tag);
      }
    }
  };
  walk("src/ui");
  walk("brand");
  for (const f of ["index.html"]) {
    try {
      const text = readFileSync(f, "utf8");
      for (const h of bannedHits(text)) {
        const tag = `${f}: ${h}`;
        if (!hits.includes(tag)) hits.push(tag);
      }
    } catch {
      /* ignore */
    }
  }
  c.ok(hits.length === 0, `37 no banned words in UI strings${hits.length > 0 ? ": " + hits.slice(0, 5).join(" | ") : ""}`);
}

c.done();
