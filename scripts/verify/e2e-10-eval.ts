// scripts/verify/e2e-10-eval.ts — DP-E2E-BROWSER-TESTING WU-E2E-10 (12 checks).
// Requirement IDs: FR-05
// Proves the agent-surface adapter reads application state identically in both
// arms, that the evaluation ran within its budget, and that only measured
// numbers are quoted anywhere. When the evaluation route is blocked after the
// AI ACCESS commands, the named error is printed and the script exits 3.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { listIterations } from "../../hee/src/agent-eval/iterate.js";
import type { EvalReport, Scenarios } from "../../hee/src/agent-eval/types.js";
import adapter from "../../evals/adapter.js";
import { createChecker } from "./ui-kit.js";

if (existsSync("evals/BLOCKED.md")) {
  const text = readFileSync("evals/BLOCKED.md", "utf8");
  const named = /named error:\s*(.+)/i.exec(text)?.[1]?.trim() ?? text.split("\n").find((l) => l.trim() !== "" && !l.startsWith("#"))?.trim() ?? "unnamed";
  console.log(`e2e-10-eval: BLOCKED (${named})`);
  process.exit(3);
}

const c = createChecker("e2e-10-eval");
const scenarios = JSON.parse(readFileSync("evals/scenarios.json", "utf8")) as Scenarios;
const report = JSON.parse(readFileSync("evals/report.json", "utf8")) as EvalReport;

// 1. The adapter's default export.
c.ok(adapter.product === "Doorstep Rhythm" && typeof adapter.createWorld === "function", "adapter default-exports { product, createWorld }");

const treatment = await adapter.createWorld("treatment", "sample-week");
const control = await adapter.createWorld("control", "sample-week");
try {
  // 2. Tool counts.
  c.ok(
    treatment.tools().length === 21 && control.tools().some((t) => t.name === "ui_snapshot"),
    `treatment world exposes ${treatment.tools().length} tools; control exposes ${control.tools().map((t) => t.name).join(", ")}`,
  );

  // 3. A fresh world passes ledger-unchanged and both arms agree on every check.
  const ids = [...new Set(scenarios.tasks.flatMap((t) => [...t.success.check_ids, ...t.safety.check_ids]))];
  const same: string[] = [];
  let allSame = true;
  let ledgerOk = true;
  for (const id of ids) {
    const a = await treatment.verify(id);
    const b = await control.verify(id);
    if (a.passed !== b.passed) {
      allSame = false;
      same.push(id);
    }
    if (id === "ledger-unchanged" && !(a.passed && b.passed)) ledgerOk = false;
  }
  c.ok(ledgerOk && allSame, `ledger-unchanged holds in a fresh world and the arms agree on every check (differing: ${same.join(",") || "none"})`);

  // 4. One call in each arm.
  const dev = await treatment.call("list_devices", {});
  const snap = await control.call("ui_snapshot", {});
  c.ok(dev.ok === true && snap.ok === true && snap.summary.includes("Agent"), "list_devices and ui_snapshot answer ok");

  // 5. describeOutcome.
  c.ok((await treatment.describeOutcome()).length > 0 && (await control.describeOutcome()).length > 0, "describeOutcome is non-empty in both arms");
} finally {
  await treatment.close();
  await control.close();
}

// 6. Every check id resolves on a fresh world of its task's seed.
{
  let resolved = true;
  let why = "";
  for (const seed of [...new Set(scenarios.tasks.map((t) => t.seed))]) {
    const w = await adapter.createWorld("treatment", seed);
    try {
      for (const t of scenarios.tasks.filter((x) => x.seed === seed)) {
        for (const id of [...t.success.check_ids, ...t.safety.check_ids]) {
          try {
            await w.verify(id);
          } catch (e) {
            resolved = false;
            why = `${id}: ${(e as Error).message}`;
          }
        }
      }
    } finally {
      await w.close();
    }
  }
  c.ok(resolved, `every check id resolves through verify (${why || "ok"})`);
}

// 7. Iterations exist and the budget held.
c.ok(listIterations("evals").length >= 1 && report.sessions_used <= 300, `${listIterations("evals").length} iterations, ${report.sessions_used} sessions used of 300`);

// 8. The report compares both arms, measured.
c.ok(report.treatment !== null && report.control !== null && report.comparable === true && report.replayed === false, "report has both arms, comparable, not replayed");

// 9. Shape.
c.ok(report.tasks === 10 && report.repetitions >= 2 && report.sessions_cap === 300, `report: ${report.tasks} tasks, ${report.repetitions} repetitions, cap ${report.sessions_cap}`);

// 10. Only measured numbers are quoted.
{
  const pattern = /(agent|action)[^.\n]{0,60}\b[0-9]+(\.[0-9]+)?\s?%|\b[0-9]+(\.[0-9]+)?\s?%[^.\n]{0,60}(agent|action)/i;
  const files: string[] = [];
  const walk = (p: string): void => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const n of readdirSync(p)) {
        if (n === "iterations" || n === "node_modules" || n === "artifacts") continue;
        walk(join(p, n));
      }
    } else if (/\.(md|json)$/.test(p) && !p.endsWith("report.json") && !p.endsWith("scenarios.json")) {
      files.push(p);
    }
  };
  // The documents this plan writes and publishes; the brief and the engine prompt are inputs, not claims.
  walk("design_documents/e2e-testing");
  walk("evals");
  if (existsSync("README.md")) files.push("README.md");
  const quoted = (report.headline + " " + report.ceiling).match(/[0-9]+(\.[0-9]+)?\s?%/g) ?? [];
  const stray = files.filter((f) => {
    const t = readFileSync(f, "utf8");
    // The markers' own block and the quoted sentences are allowed to carry the report's numbers.
    const hits = t.split("\n").filter((l) => pattern.test(l) && !quoted.some((q) => l.includes(q)) && !/design_plans/.test(f));
    return hits.length > 0 && !f.includes("design_plans");
  });
  c.ok(report.headline.length > 0 && report.ceiling.length > 0 && stray.length === 0, `headline and ceiling present; files with an unreported agent percentage: ${stray.join(", ") || "none"}`);
}

// 11. Publication.
{
  const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
  const block = /<!-- hee-eval:start -->([\s\S]*?)<!-- hee-eval:end -->/.exec(readme)?.[1] ?? "";
  const strategy = readFileSync("design_documents/e2e-testing/strategy.md", "utf8");
  const deferred = /## 4 Agent-surface evaluation[\s\S]*DP-SHOWCASE WU-05/.test(strategy);
  c.ok(block.includes(report.headline) || deferred, "the README block carries the headline, or strategy.md says DP-SHOWCASE WU-05 publishes");
}

// 12. Hygiene and the frozen hash.
{
  const src = readFileSync("evals/adapter.ts", "utf8");
  const frozen = readFileSync("e2e/artifacts/frozen-hash.txt", "utf8").trim();
  c.ok(
    !/[0-9a-f]{20,}/i.test(src) && !src.includes("Bearer ") && !/[A-Za-z]:[\\/]|"\/(Users|home)\//.test(src) && scenarios.frozen_hash !== null && frozen.startsWith(scenarios.frozen_hash.slice(0, 8)),
    "adapter has no secret or absolute path; the frozen hash is unchanged",
  );
}

c.done();
