// scripts/verify/sb-05-delta.ts — DP-SUBMISSION WU-05 (8 checks).
// Requirement IDs: FR-25 (part)
import { existsSync, readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { scanBanned } from "../lib/submission.js";

const c = createChecker("sb-05-delta");
const feats = readFileSync("design_documents/submission/feature-requests.md", "utf8").replace(/\r/g, "");
const delta = readFileSync("design_documents/submission/delta.md", "utf8").replace(/\r/g, "");

// 1. Two to six FEAT entries with four bullets in order.
const featHeads = [...feats.matchAll(/^## (FEAT-\d+) .+$/gm)].map((m) => m[1] as string);
const wantBullets = ["- **Description:**", "- **Why it matters:**", "- **Priority:**", "- **Evidence:**"];
let featOk = featHeads.length >= 2 && featHeads.length <= 6;
for (const h of featHeads) {
  const i = feats.indexOf(`## ${h}`);
  const next = feats.indexOf("## FEAT-", i + 1);
  const chunk = next === -1 ? feats.slice(i) : feats.slice(i, next);
  let last = -1;
  for (const b of wantBullets) {
    const j = chunk.indexOf(b);
    if (j === -1 || j < last) { featOk = false; break; }
    last = j;
  }
}
c.ok(featOk, `${featHeads.length} FEAT entries with four bullets`);

// 2. Priorities valid, at most one Critical.
const pris = [...feats.matchAll(/^- \*\*Priority:\*\* (.+)$/gm)].map((m) => (m[1] as string).trim());
c.ok(
  pris.length === featHeads.length && pris.every((p) => p === "Critical" || p === "Important" || p === "Nice-to-have") &&
    pris.filter((p) => p === "Critical").length <= 1,
  `priorities valid, critical<=1 (${pris.join(",")})`,
);

// 3. Evidence resolves (platform FL-n or existing path).
const devpost = readFileSync("design_documents/submission/friction-log-devpost.md", "utf8");
const evs = [...feats.matchAll(/^- \*\*Evidence:\*\* (.+)$/gm)].map((m) => (m[1] as string).trim().replace(/`/g, ""));
let evOk = evs.length === featHeads.length;
for (const e of evs) {
  if (/^FL-\d+$/.test(e)) { if (!devpost.includes(`## ${e} `)) evOk = false; }
  else if (!existsSync(e)) evOk = false;
}
c.ok(evOk, "evidence resolves");

// 4. Delta headings + window date.
c.ok(
  delta.includes("# What was built in the submission window") && delta.includes("## Reused scaffolding") &&
    delta.includes("## Built in the window") && delta.includes("2026-08-31"),
  "delta headings + date",
);

// 5. Reused bullets: each included once, none excluded.
const manifest = JSON.parse(readFileSync("assembly.manifest.json", "utf8")) as { components?: { id?: string; included?: boolean }[] };
const included = (manifest.components ?? []).filter((x) => x.included).map((x) => x.id as string);
const excluded = (manifest.components ?? []).filter((x) => !x.included).map((x) => x.id as string);
const reusedSec = delta.slice(delta.indexOf("## Reused scaffolding"), delta.indexOf("## Built in the window"));
c.ok(
  included.every((id) => reusedSec.includes(`\`${id}\``)) && excluded.every((id) => !reusedSec.includes(`\`${id}\``)),
  "reused names included once, none excluded",
);

// 6. Built paths tracked + in provenance.
const prov = JSON.parse(readFileSync("design_documents/submission/provenance.json", "utf8")) as { authoredInWindow?: string[] };
const builtSec = delta.slice(delta.indexOf("## Built in the window"));
const builtPaths = [...builtSec.matchAll(/^- `([^`]+)` — /gm)].map((m) => m[1] as string);
const ls = run("git", ["ls-files"]);
const tracked = ls.out.split("\n").map((l) => l.trim()).filter((l) => l !== "");
c.ok(
  builtPaths.length > 0 &&
    builtPaths.every((p) => tracked.some((f) => f === p || f.startsWith(`${p}/`)) && (prov.authoredInWindow ?? []).includes(p)),
  `built paths tracked + proven (${builtPaths.length})`,
);

// 7. Clean scans, no TODO.
const hits = scanBanned(["design_documents/submission/feature-requests.md", "design_documents/submission/delta.md"]);
const both = feats + delta;
c.ok(hits.length === 0 && !/\/home\/|\/Users\/|C:[\\/]/.test(both) && !both.includes("TODO"), "clean scans, no TODO");

// 8. Builder line matches manifest count.
const built2 = run("npx", ["vite-node", "scripts/build-delta.ts"]);
const m = /delta: reused (\d+) chassis components, authored (\d+) paths/.exec(built2.out);
c.ok(built2.code === 0 && m !== null && Number(m[1]) === included.length, `builder line matches ${included.length} components`);

c.done();
