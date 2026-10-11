// scripts/video/fill-live-check.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-02 step 3.
// Replaces the Pending block of feedback.md with what the live run observed.
// Evidence paths resolve from the entry first, then the project folder
// (film artifacts live under project video/); lv-02-proofs.ts checks both.
import { readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { PROJECT, readJson } from "./lib.js";

const observations = readJson(`${PROJECT}/video/live-observations.json`) as {
  date?: string; operation?: string; outcome?: string; fact?: string;
}[];
const date = observations[0]?.date ?? new Date().toISOString().slice(0, 10);
const evidenceFor = (op: string, outcome: string): string => {
  if (op === "agentReview" || op === "probeBedrock") return "logs/proof.log";
  return "video/live-observations.json";
};
const lines = [`Observed on ${date}`];
for (const o of observations) {
  const ev = evidenceFor(o.operation ?? "", o.outcome ?? "");
  const resolved = existsSync(ev) || existsSync(`${PROJECT}/${ev}`);
  lines.push(`- ${o.operation}: ${o.outcome} — ${o.fact} (evidence: ${ev})`);
  if (!resolved) {
    console.error(`fill-live-check: evidence path missing for ${o.operation}: ${ev}`);
    process.exit(1);
  }
}
const p = "design_documents/submission/feedback.md";
const text = readFileSync(p, "utf8");
const si = text.indexOf("<!-- live-check:start -->");
const ei = text.indexOf("<!-- live-check:end -->");
if (si === -1 || ei === -1 || ei <= si) {
  console.error("fill-live-check: live-check markers not found");
  process.exit(1);
}
const block = `<!-- live-check:start -->\n${lines.join("\n")}\n<!-- live-check:end -->`;
writeFileSync(p, text.slice(0, si) + block + text.slice(ei + "<!-- live-check:end -->".length));
console.log(`fill-live-check: ${observations.length} observations into feedback.md`);
