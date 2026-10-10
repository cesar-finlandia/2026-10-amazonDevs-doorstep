// scripts/verify/sb-06-deck.ts — DP-SUBMISSION WU-06 (10 checks).
// Requirement IDs: FR-25 (part)
import { existsSync, readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { readShowcase, scanBanned, SLOGAN } from "../lib/submission.js";

const c = createChecker("sb-06-deck");
const DIR = "design_documents/submission/deck";
const show = readShowcase();

// 1. Populate exits 0; ten files present.
const pop = run("npx", ["vite-node", "scripts/chassis-tool.ts", "deckgen", "--", "populate", "--plan", "design_documents/winning_project_plan.md", "--manifest", "assembly.manifest.json", "--disclosure", "design_documents/submission/provo/disclosure.md", "--out", DIR, "--no-llm", "--validate"]);
const need = ["deck.md", "01-title.md", "02-problem.md", "03-user.md", "04-demo.md", "05-architecture.md", "06-business-value.md", "07-ask-next-steps.md", "08-disclosure.md", "diagram.mmd"];
c.ok(pop.code === 0 && need.every((f) => existsSync(`${DIR}/${f}`)), "populate exits 0, ten files present");

// 2. PROV-01 block equals disclosure.md trimmed.
const eight = readFileSync(`${DIR}/08-disclosure.md`, "utf8");
const bStart = "<!-- PROV-01:BEGIN -->";
const bEnd = "<!-- PROV-01:END -->";
const si = eight.indexOf(bStart);
const ei = eight.indexOf(bEnd);
const block = si !== -1 && ei > si ? eight.slice(si + bStart.length, ei).trim() : "";
c.ok(si !== -1 && block === readFileSync("disclosure.md", "utf8").trim(), "PROV-01 block verbatim");

// 3. diagram.mmd graph TD + included ids.
const manifest = JSON.parse(readFileSync("assembly.manifest.json", "utf8")) as { components?: { id?: string; included?: boolean }[] };
const included = (manifest.components ?? []).filter((x) => x.included).map((x) => x.id as string);
const mmd = readFileSync(`${DIR}/diagram.mmd`, "utf8");
const mmdLow = mmd.toLowerCase();
c.ok(mmd.startsWith("graph TD") && included.every((id) => mmdLow.includes(id.toLowerCase())), "diagram graph TD + components");

// 4. No TODO slot lines.
{
  const { readdirSync } = await import("node:fs");
  const bad = readdirSync(DIR).filter((f) => f.endsWith(".md")).filter((f) => readFileSync(`${DIR}/${f}`, "utf8").split("\n").some((l) => l.startsWith("> **TODO:")));
  c.ok(bad.length === 0, `no TODO slots (${bad.join(",") || "none"})`);
}

// 5. Slot 07 literal paragraphs with live URL.
const seven = readFileSync(`${DIR}/07-ask-next-steps.md`, "utf8");
c.ok(
  seven.includes(`**Ask.** Open ${show.live_url}, press Load the sample week, then Review the week.`) &&
    seven.includes("**Team.** The people who built Doorstep Rhythm are listed on the Devpost submission."),
  "slot 07 paragraphs",
);

// 6. Slogan exactly once as its own body line (frontmatter header carries
// the tagline value separately, so the header is excluded from the count).
const title = readFileSync(`${DIR}/01-title.md`, "utf8");
const titleBody = title.includes("---") ? title.split("---").slice(2).join("---") : title;
const sloganLines = titleBody.split("\n").filter((l) => l.trim() === SLOGAN);
c.ok(sloganLines.length === 1, "slogan once in title");

// 7. deck.md LIVE DEMO + live URL.
const deck = readFileSync(`${DIR}/deck.md`, "utf8");
c.ok(deck.includes("LIVE DEMO") && deck.includes(show.live_url), "deck LIVE DEMO + URL");

// 8. Banned scan clean + polish report exists.
{
  const { readdirSync } = await import("node:fs");
  const hits = scanBanned(readdirSync(DIR).filter((f) => f.endsWith(".md") || f.endsWith(".mmd")).map((f) => `${DIR}/${f}`));
  c.ok(hits.length === 0 && existsSync(`${DIR}/polish-report.md`), `deck banned-clean (${hits.map((h) => `${h.file}:${h.line}`).join(",") || "no hits"})`);
}

// 9. No placeholders/paths/secrets.
{
  const { readdirSync } = await import("node:fs");
  let bad = "";
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith(".md") && !f.endsWith(".mmd")) continue;
    const t = readFileSync(`${DIR}/${f}`, "utf8");
    const noUrls = t.replace(/https?:\/\/\S+/g, "URL");
    if (t.includes("{{") || /[A-Za-z]:[\\/]/.test(noUrls) || t.includes("Bearer ")) bad = f;
  }
  c.ok(bad === "", `deck has no placeholders/paths/secrets (${bad || "clean"})`);
}

// 10. Second populate + finish leaves deck.md identical.
{
  const before = readFileSync(`${DIR}/deck.md`, "utf8");
  const p2 = run("npx", ["vite-node", "scripts/chassis-tool.ts", "deckgen", "--", "populate", "--plan", "design_documents/winning_project_plan.md", "--manifest", "assembly.manifest.json", "--disclosure", "design_documents/submission/provo/disclosure.md", "--out", DIR, "--no-llm"]);
  const f2 = run("npx", ["vite-node", "scripts/finish-deck.ts"]);
  const after = readFileSync(`${DIR}/deck.md`, "utf8");
  c.ok(p2.code === 0 && f2.code === 0 && before === after, "repopulate idempotent");
}

c.done();
