// scripts/video/preflight.ts — DP-SCRIPT WU-01 step 1.
// Runs the §0 prerequisite verifiers + environment checks.
// Prints `preflight: <n> checks passed` or `BLOCKED (<named reason>)`.
import { existsSync } from "node:fs";
import { check, runNode } from "./lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};

const e2e = runNode(["scripts/verify/e2e-12-results.ts"]);
t(e2e.code === 0 && e2e.out.includes("e2e-12-results: 10 checks OK"), "e2e-12-results green");
const sc05 = runNode(["scripts/verify/sc-05-readme.ts"]);
t(sc05.code === 0 && sc05.out.includes("sc-05-readme: 12 checks OK"), "sc-05-readme green");
const sb02 = runNode(["scripts/verify/sb-02-fields.ts"]);
t(sb02.code === 0 && sb02.out.includes("sb-02-fields: 10 checks OK"), "sb-02-fields green");
const sb05 = runNode(["scripts/verify/sb-05-delta.ts"]);
t(sb05.code === 0 && sb05.out.includes("sb-05-delta: 8 checks OK"), "sb-05-delta green");

const files = [
  "design_documents/showcase.json", "design_documents/showcase-facts.json",
  "design_documents/demo-scenario.json", "design_documents/submission/provenance.json",
  "actions.manifest.json", "architecture.json", "cinematic-tokens.json",
  "brand/mark.svg", "brand/brandmark.css", "data/bundle/doorstep-14d.json",
  "e2e/depth.spec.ts", "e2e/smoke.spec.ts", "scripts/e2e-run.ts",
  "hee/src/showcase/scenario.ts",
];
for (const f of files) t(existsSync(f), `present ${f}`);

const projFiles = [
  "../../hackathons/hackathon-projects/2026-10-amazonDevs/event_profile.json",
  "../../hackathons/hackathon-projects/2026-10-amazonDevs/mined_frustrations.json",
  "../../hackathons/hackathon-projects/2026-10-amazonDevs/personas.json",
  "../../hackathons/hackathon-projects/2026-10-amazonDevs/hackathon_brief.md",
];
for (const f of projFiles) t(existsSync(f), `present ${f}`);

t(process.versions.node !== "", "node runs");
{
  const { spawnSync } = await import("node:child_process");
  const r3 = spawnSync("python3", ["--version"], { encoding: "utf8", shell: true });
  t((r3.status ?? 1) === 0, "python3 runs");
  const r4 = spawnSync("python", ["--version"], { encoding: "utf8", shell: true });
  t((r4.status ?? 1) === 0, "python runs (chassis lint needs the name)");
  const r5 = spawnSync("gcloud", ["--version"], { encoding: "utf8", shell: true });
  t((r5.status ?? 1) === 0, "gcloud runs");
  const r6 = spawnSync("npx", ["playwright", "--version"], { encoding: "utf8", shell: true });
  t((r6.status ?? 1) === 0 && r6.stdout.includes("Version"), "playwright runs");
}

if (failures.length > 0) {
  console.log(`BLOCKED (preflight: ${failures[0]})`);
  process.exit(3);
}
console.log(`preflight: ${n} checks passed`);
