// scripts/verify/sb-04-friction.ts — DP-SUBMISSION WU-04 (8 checks).
// Requirement IDs: FR-25 (part)
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { scanBanned } from "../lib/submission.js";

const c = createChecker("sb-04-friction");

// 1. Exit 0, counts line, n + m == source headings.
const r = run("npx", ["vite-node", "scripts/compile-friction.ts"]);
const m = /friction: (\d+) platform entries, (\d+) internal entries kept out/.exec(r.out);
const src = readFileSync(process.env["FRICTION_SOURCE"] ?? "design_documents/friction-log.md", "utf8");
const heads = (src.match(/^## FL-\d+/gm) ?? []).length;
c.ok(r.code === 0 && m !== null && Number(m[1]) + Number(m[2]) === heads, `counts add to ${heads} headings`);

// 2. FL-1 internal, FL-2 platform, FL-3 internal.
const out = readFileSync("design_documents/submission/friction-log-devpost.md", "utf8");
c.ok(out.includes("## FL-2 ") && !out.includes("## FL-1 ") && !out.includes("## FL-3 "), "FL-2 platform; FL-1/FL-3 kept out");

// 3. Six bullets in order per entry.
const blocks = out.split(/^## FL-\d+/m).slice(1);
const want = ["- **Task:**", "- **Steps:**", "- **Expected vs actual:**", "- **Severity:**", "- **Workaround:**", "- **Suggestion:**"];
let orderOk = blocks.length > 0;
for (const b of blocks) {
  let last = -1;
  for (const bullet of want) {
    const i = b.indexOf(bullet);
    if (i === -1 || i < last) { orderOk = false; break; }
    last = i;
  }
}
c.ok(orderOk, "six bullets in order");

// 4. Severity values.
const sevs = [...out.matchAll(/^- \*\*Severity:\*\* (.+)$/gm)].map((x) => (x[1] as string).trim());
c.ok(sevs.length === blocks.length && sevs.every((s) => s === "low" || s === "medium" || s === "high"), `severities ${sevs.join(",")}`);

// 5. Missing Workaround in a temp copy fails loudly.
const tmp = mkdtempSync(join(tmpdir(), "sb04-"));
const tmpSrc = join(tmp, "friction.md");
{
  const lines = src.split("\n");
  const idx = lines.findIndex((l) => l.startsWith("Workaround:") && lines.slice(0, lines.indexOf(l)).join("\n").includes("## FL-2"));
  lines.splice(idx, 1);
  writeFileSync(tmpSrc, lines.join("\n"), "utf8");
}
const bad = run("npx", ["vite-node", "scripts/compile-friction.ts"], { env: { FRICTION_SOURCE: tmpSrc } });
c.ok(bad.code === 1 && bad.out.includes("friction: FL-2 is missing Workaround"), "missing Workaround fails loudly");

// 6. Platform entries carry Suggestion lines.
const platHeads = (src.match(/^## (FL-\d+)/gm) ?? []).map((h) => h.replace("## ", ""));
const withSugg = platHeads.filter((h) => {
  const i = src.indexOf(`## ${h}`);
  const next = src.indexOf("## FL-", i + 1);
  const chunk = next === -1 ? src.slice(i) : src.slice(i, next);
  return /^Suggestion:/m.test(chunk);
});
c.ok(withSugg.includes("FL-2") && out.includes("publish the wire-to-domain value table"), "FL-2 Suggestion compiled");

// 7. Clean scans.
const hits = scanBanned(["design_documents/submission/friction-log-devpost.md"]);
c.ok(hits.length === 0 && !/\/home\/|\/Users\/|C:[\\/]/.test(out), "clean scans");

// 8. No entry removed or renumbered.
c.ok(["## FL-1 ", "## FL-2 ", "## FL-3 "].every((h) => src.includes(h)), "FL-1..3 headings intact");

c.done();
