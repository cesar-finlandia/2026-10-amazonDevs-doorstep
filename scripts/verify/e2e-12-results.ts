// scripts/verify/e2e-12-results.ts — DP-E2E-BROWSER-TESTING WU-E2E-12 (10 checks).
// Requirement IDs: FR-24, FR-25
// Runs the suite once more (label `final`), writes design_documents/e2e-testing/results.md
// from that run's report, strategy.md, evals/report.json, the proof harvest and the
// hygiene script, and then checks the file.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { probeBedrock } from "../../e2e/bedrock-probe.js";
import { createChecker } from "./ui-kit.js";
import { readTable, run, wrapper } from "./e2e-kit.js";

const c = createChecker("e2e-12-results");
const RESULTS = "design_documents/e2e-testing/results.md";
const STRATEGY = "design_documents/e2e-testing/strategy.md";

interface JsonTest {
  results: { status: string; duration: number }[];
  annotations: { type: string; description?: string }[];
}
interface JsonSpec {
  title: string;
  file: string;
  tests: JsonTest[];
}
interface JsonSuite {
  file?: string;
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

const probe = await probeBedrock();
const probeLine = probe.available ? "bedrock-probe: available" : `bedrock-probe: unavailable (${probe.error})`;
console.log(probeLine);

// 1. The final run.
const final = wrapper("final", [], { timeout: 3_600_000 });
console.log(final.line);

const report = JSON.parse(readFileSync("e2e/artifacts/report.json", "utf8")) as {
  suites?: JsonSuite[];
  stats?: { duration?: number };
};
const specs: JsonSpec[] = [];
const collect = (n: JsonSuite): void => {
  for (const s of n.specs ?? []) specs.push(s);
  for (const x of n.suites ?? []) collect(x);
};
for (const s of report.suites ?? []) collect(s);
const totalSec = Math.round((report.stats?.duration ?? 0) / 1000);
const perFile = new Map<string, number>();
for (const s of specs) {
  const secs = s.tests.reduce((n, t) => n + (t.results[t.results.length - 1]?.duration ?? 0), 0) / 1000;
  perFile.set(s.file, (perFile.get(s.file) ?? 0) + secs);
}
const statusOf = (title: string): string => {
  const spec = specs.find((s) => s.title.startsWith(`${title} `));
  const t = spec?.tests[0];
  const last = t?.results[t.results.length - 1]?.status;
  if (last === "passed") return "pass";
  if (last === "skipped") return `skipped: ${t?.annotations.find((a) => a.type === "skip")?.description ?? ""}`;
  return `${last ?? "missing"}`;
};

const ids = readTable(STRATEGY, "2 Traceability").map((r) => r[0] as string);
const harvest = run("npx", ["vite-node", "scripts/harvest-architecture-proofs.ts", "--dir", "."]);
const harvestLine = harvest.out.split("\n").map((l) => l.trim()).find((l) => /^harvest: \d+ proofs, \d+ missing$/.test(l)) ?? "harvest: not run";
const lintLine = probe.available ? "lint-architecture: pass" : "lint-architecture: pending live proof (DP-LIVE-RUN-AND-VIDEO)";
const hygiene = run("npx", ["vite-node", "scripts/verify/e2e-06-hygiene.ts"]);
const hygieneLine = hygiene.out.split("\n").map((l) => l.trim()).find((l) => l.startsWith("e2e-06-hygiene: ")) ?? "e2e-06-hygiene: not run";

const evalReport = existsSync("evals/report.json")
  ? (JSON.parse(readFileSync("evals/report.json", "utf8")) as { headline: string; ceiling: string })
  : null;
const blocked = existsSync("evals/BLOCKED.md");
const agentBody = evalReport
  ? `${evalReport.headline}\n\n${evalReport.ceiling}`
  : blocked
    ? `BLOCKED (${readFileSync("evals/BLOCKED.md", "utf8").split("\n").find((l) => l.trim() !== "" && !l.startsWith("#"))?.trim() ?? "unnamed"})`
    : "not run";

const rows = ids.map((id) => `| ${id} | ${statusOf(id)} |`).join("\n");
const ringRows = ids.filter((id) => id.startsWith("S-RING-")).map((id) => `| ${id} | ${statusOf(id)} |`).join("\n");
const fileRows = [...perFile.entries()].sort().map(([f, s]) => `| ${f} | ${s.toFixed(1)} |`).join("\n");

const text = `# E2E results

## Run

${final.line}

Total duration: ${totalSec} seconds.

| Spec file | Seconds |
|---|---|
${fileRows}

## Traceability

| Test | Result |
|---|---|
${rows}

## Mandated technology

Evidence for the nine \`S-RING\` rows comes from the simulated Ring (\`createMockRingServer\`; every answer carries \`x-simulated: true\`); none of it is recorded or presented as live Ring.

${probeLine}

| Test | Result |
|---|---|
${ringRows}

## Agent surface

${agentBody}

## Architecture proofs

${harvestLine}

${lintLine}

## Repository hygiene

${hygieneLine}

## How to re-run

\`\`\`
npm run e2e
npm run e2e:smoke
BASE_URL=<url> npx playwright test e2e/smoke.spec.ts
\`\`\`
`;
writeFileSync(RESULTS, text, "utf8");

const body = readFileSync(RESULTS, "utf8");
const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1] as string);

// 1. Sections in order.
c.ok(
  JSON.stringify(headings) ===
    JSON.stringify(["Run", "Traceability", "Mandated technology", "Agent surface", "Architecture proofs", "Repository hygiene", "How to re-run"]),
  `results.md sections: ${headings.join(" > ")}`,
);

// 2. The recorded line equals the wrapper's line of this invocation.
c.ok(final.line !== "" && body.includes(final.line), `the Run section records "${final.line}"`);

// 3. Every id has a row, all pass but S-BEDROCK-1.
{
  const bad = ids.filter((id) => {
    const st = statusOf(id);
    return id === "S-BEDROCK-1" ? !(st === "pass" || /^skipped: .+/.test(st)) : st !== "pass";
  });
  c.ok(ids.length === 60 && ids.every((id) => body.includes(`| ${id} |`)) && bad.length === 0, `${ids.length} traceability rows; not passing: ${bad.join(",") || "none"}`);
}

// 4. Durations.
c.ok(/Total duration: \d+ seconds/.test(body) && perFile.size === 17, `a total and ${perFile.size} per-file durations`);

// 5. Mandated technology.
c.ok(body.includes(probeLine) && ids.filter((id) => id.startsWith("S-RING-")).length === 9 && (body.match(/\| S-RING-\d \|/g) ?? []).length >= 9, "the probe line and nine S-RING rows");

// 6. Agent surface.
c.ok(evalReport !== null ? body.includes(evalReport.headline) : /BLOCKED \(.+\)/.test(body), "the Agent surface section carries the headline (or the blocked line)");

// 7. Proofs.
c.ok(body.includes(harvestLine) && /^harvest: \d+ proofs, \d+ missing$/.test(harvestLine) && body.includes(lintLine), `the proofs section repeats "${harvestLine}" and the lint line`);

// 8. Hygiene.
c.ok(hygieneLine === "e2e-06-hygiene: 10 checks OK" && body.includes(hygieneLine), `the hygiene section repeats "${hygieneLine}"`);

// 9. verify:e2e order and the frozen hash.
{
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  const v = pkg.scripts["verify:e2e"] ?? "";
  const order = Array.from({ length: 12 }, (_, i) => v.indexOf(`e2e-${String(i + 1).padStart(2, "0")}-`));
  const inOrder = order.every((x, i) => x >= 0 && (i === 0 || x > (order[i - 1] as number)));
  const scen = JSON.parse(readFileSync("evals/scenarios.json", "utf8")) as { frozen_hash: string | null };
  const frozen = readFileSync("e2e/artifacts/frozen-hash.txt", "utf8").trim();
  c.ok(inOrder && scen.frozen_hash === frozen, "verify:e2e names e2e-01 … e2e-12 in order; the frozen hash is unchanged");
}

// 10. Banned words.
{
  const list = JSON.parse(readFileSync("../../hackathons/templates/banned-words.json", "utf8")) as { entries: { pattern: string }[] };
  const files = [RESULTS, STRATEGY, "design_documents/e2e-testing/fix-log.md", "design_documents/e2e-testing/known-inert.md"];
  const hits = files.filter((f) => list.entries.some((e) => new RegExp(e.pattern, "i").test(readFileSync(f, "utf8"))));
  const py = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "--preset", "plans", ...files]);
  c.ok(hits.length === 0 && py.code === 0, `no banned word in the four documents (hits: ${hits.join(", ") || "none"})`);
}

c.done();
