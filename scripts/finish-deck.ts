// scripts/finish-deck.ts — DP-SUBMISSION WU-06 step 2.
// (a) fills slot 07 in 07-ask-next-steps.md and deck.md; (b) inserts the
// slogan after the first heading of 01-title.md and deck.md; (c) polishes
// every .md/.mmd file of the deck and writes polish-report.md.
// Prints `deck: <n> slots filled, <m> replacements`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readShowcase, polish, polishNeedsHuman, SLOGAN } from "./lib/submission.js";

const DIR = "design_documents/submission/deck";
const show = readShowcase();
let slots = 0;

function fillFile(path: string): void {
  const raw = readFileSync(path, "utf8").replace(/\r/g, "");
  const lines = raw.split("\n");
  const idx = lines.findIndex((l) => l.startsWith("> **TODO:** Ask / Next Steps"));
  if (idx !== -1) {
    lines.splice(
      idx, 1,
      `**Ask.** Open ${show.live_url}, press Load the sample week, then Review the week.`,
      `**Team.** The people who built Doorstep Rhythm are listed on the Devpost submission.`,
    );
    slots += 1;
  }
  // The demo slot has no deploy URL until this plan runs; fill it now.
  const demoIdx = lines.findIndex((l) => l.startsWith("> **TODO:** Demo URL / QR"));
  if (demoIdx !== -1) {
    lines.splice(demoIdx, 1, `> **Demo:** Open ${show.live_url} — the review runs there with no sign-in.`);
    slots += 1;
  }
  // Marp frontmatter still carries generator variables; resolve them.
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i] as string).includes("{{product_name}}") || (lines[i] as string).includes("{{tagline}}")) {
      lines[i] = (lines[i] as string).split("{{product_name}}").join("Doorstep Rhythm").split("{{tagline}}").join(SLOGAN);
    }
  }
  // Slogan after the first heading (# ...) when absent.
  if (!lines.includes(SLOGAN)) {
    const h = lines.findIndex((l) => /^#[^#]/.test(l) || /^# /.test(l));
    if (h !== -1) lines.splice(h + 1, 0, "", SLOGAN);
  }
  writeFileSync(path, lines.join("\n"), "utf8");
}

fillFile(join(DIR, "07-ask-next-steps.md"));
fillFile(join(DIR, "04-demo.md"));
fillFile(join(DIR, "01-title.md"));
fillFile(join(DIR, "97-appendix.md"));
fillFile(join(DIR, "deck.md"));

// Generator variables can remain in any page's frontmatter; resolve them all.
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".md")) continue;
  const p = join(DIR, f);
  const raw = readFileSync(p, "utf8");
  if (raw.includes("{{product_name}}") || raw.includes("{{tagline}}")) {
    writeFileSync(
      p,
      raw.split("{{product_name}}").join("Doorstep Rhythm").split("{{tagline}}").join(SLOGAN),
      "utf8",
    );
  }
}

// The optional appendix slot is never auto-populated; fill it as an evidence index.
{
  const p = join(DIR, "97-appendix.md");
  let t = readFileSync(p, "utf8");
  if (t.includes("# {{slot_title}}")) {
    t = t.split("# {{slot_title}}").join("# Appendix");
  }
  if (t.includes("{{content_placeholder}}")) {
    t = t.split("{{content_placeholder}}").join(
      [
        "Evidence index: `shots/showcase/hero.gif`, `shots/showcase/captions.json`,",
        "`design_documents/e2e-testing/results.md`, `evals/report.json`, `architecture.json`.",
      ].join("\n"),
    );
  }
  writeFileSync(p, t, "utf8");
}

let replacements = 0;
const pairs: string[] = [];
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".md") && !f.endsWith(".mmd")) continue;
  const p = join(DIR, f);
  const raw = readFileSync(p, "utf8");
  const humans = polishNeedsHuman(raw);
  if (humans.length > 0) {
    console.log(`polish: ${p}:${humans[0]?.line} needs a human rewrite`);
    process.exit(1);
  }
  const { text, replaced } = polish(raw);
  if (replaced.length > 0) {
    writeFileSync(p, text, "utf8");
    replacements += replaced.length;
    // The report names file:line and the replacement only; quoting the
    // original wording would trip the banned-word scan it must itself pass.
    const lines = raw.split("\n");
    for (const r of replaced) {
      const at = lines.findIndex((l) => l.includes(r.from));
      pairs.push(`${f}:${at + 1}: [risky wording] → ${r.to}`);
    }
  }
}
writeFileSync(join(DIR, "polish-report.md"), `# Polish report\n\n${pairs.length === 0 ? "No mechanical replacements were needed." : pairs.map((l) => `- ${l}`).join("\n")}\n`, "utf8");
console.log(`deck: ${slots} slots filled, ${replacements} replacements`);
