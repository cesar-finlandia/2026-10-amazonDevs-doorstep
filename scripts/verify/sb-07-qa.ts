// scripts/verify/sb-07-qa.ts — DP-SUBMISSION WU-07 (10 checks).
// Requirement IDs: FR-25 (part)
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { scanBanned } from "../lib/submission.js";
import { validateSheet } from "../../src/ideation/faqdef/sheet.js";

const c = createChecker("sb-07-qa");
const QA = "design_documents/submission/qa";

// 1. qa-run.json: ADC, project, location, model, api.
const run1 = JSON.parse(readFileSync(`${QA}/qa-run.json`, "utf8")) as {
  adcToken?: boolean; project?: string; location?: string; model?: string; apiEnabled?: boolean;
};
c.ok(
  run1.adcToken === true && (run1.project ?? "") !== "" && (run1.location ?? "") !== "" &&
    (run1.model ?? "") !== "" && run1.apiEnabled === true,
  `qa-run via ${run1.model} in ${run1.project}/${run1.location}`,
);

// 2. Sheet validates, mode generated.
const sheet = JSON.parse(readFileSync(`${QA}/qa-sheet.json`, "utf8")) as unknown;
const v = validateSheet(sheet);
const qs = (sheet as { questions?: unknown[] }).questions ?? [];
c.ok(v.valid && qs.length >= 15, `sheet valid, generated mode (${qs.length} questions)`);

// 3. Fifteen to twenty questions.
c.ok(qs.length >= 15 && qs.length <= 20, `15-20 questions (${qs.length})`);

// 4. Axis floors + Ring/AWS Builder tags (case-insensitive).
{
  const tags = qs.flatMap((q) => ((q as { tags?: string[] }).tags ?? []).map((t) => t.toLowerCase()));
  const has = (axis: string): boolean => tags.filter((t) => t === axis).length >= 2;
  c.ok(
    has("presentation") && has("business_value") && has("application_of_technology") && has("originality") &&
      tags.some((t) => t.includes("ring")) && tags.some((t) => t.includes("aws")),
    "axis floors + Ring/AWS tags",
  );
}

// 5. Grounded or not_stated; rehearsal unverified line.
{
  const entries = qs as { draft_answer?: string; citations?: string[]; source_grounding?: string }[];
  const grounded = entries.every((e) => {
    const text = JSON.stringify(e);
    if (text.includes("not_stated")) return true;
    return (e.draft_answer ?? "").length > 0;
  });
  const reh = readFileSync(`${QA}/rehearsal.md`, "utf8");
  const m = /^unverified: (\d+)\s*$/m.exec(reh);
  const counted = entries.filter((e) => JSON.stringify(e).includes("not_stated")).length;
  c.ok(grounded && m !== null && Number(m[1]) === counted, `grounded/not_stated; unverified=${m?.[1] ?? "?"} (counted ${counted})`);
}

// 6. Banned scan on sheet json/md + rehearsal.
c.ok(scanBanned([`${QA}/qa-sheet.md`, `${QA}/qa-sheet.json`, `${QA}/rehearsal.md`]).length === 0, "qa files banned-clean");

// 7. Rehearsal: 5 answered, 5 scored, five scored blocks.
const reh2 = run("npx", ["vite-node", "scripts/rehearse-qa.ts", "--count", "5"]);
const scored = (readFileSync(`${QA}/rehearsal.md`, "utf8").match(/score=\d/g) ?? []).length;
c.ok(reh2.out.includes("rehearsal: 5 answered, 5 scored") && scored >= 5, "rehearsal 5/5 with scored blocks");

// 8. Provenance holds the vertex Q&A model.
const prov = JSON.parse(readFileSync("design_documents/submission/provenance.json", "utf8")) as {
  models?: { source?: string; id?: string }[];
};
c.ok((prov.models ?? []).some((mm) => mm.source === "vertex" && mm.id === run1.model), "provenance vertex qa model");

// 9. No OPENAI_API_KEY in this unit's scripts.
{
  const search = ["scripts/make-qa.ts", "scripts/rehearse-qa.ts", "scripts/lib/submission-llm.ts"]
    .map((f) => readFileSync(f, "utf8")).join("\n");
  c.ok(!search.includes("OPENAI_API_KEY"), "no OPENAI_API_KEY");
}

// 10. Bogus project: exit 3, BLOCKED line, fallback file in temp dir.
{
  const tmp = mkdtempSync(join(tmpdir(), "sb07-"));
  const bad = run("npx", ["vite-node", "scripts/make-qa.ts", "--out-dir", tmp], {
    env: { GOOGLE_CLOUD_PROJECT: `nope-${Math.random().toString(36).slice(2, 10)}` },
  });
  const { existsSync } = await import("node:fs");
  c.ok(
    bad.code === 3 && bad.out.split("\n").some((l) => l.trim().startsWith("BLOCKED (")) &&
      existsSync(join(tmp, "qa-sheet.fallback.md")),
    "bogus project BLOCKED + fallback file",
  );
}

c.done();
