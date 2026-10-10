// scripts/verify/sb-02-fields.ts — DP-SUBMISSION WU-02 (10 checks).
// Requirement IDs: FR-25 (part)
import { existsSync, readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { readShowcase, scanBanned, SLOGAN } from "../lib/submission.js";

const c = createChecker("sb-02-fields");

// 1. Extracted copy: frontmatter holds generated_at + the title; every
// non-empty line of disclosure.md appears in order (the tool splices the
// disclosure's own sections as siblings after ## Disclosure / Provenance,
// so a single-section equality cannot hold; subsequence is the verbatim proof).
const extracted = readFileSync("design_documents/submission/extracted-copy.md", "utf8");
const headBlock = extracted.split("\n").slice(0, 8).join("\n");
const discLines = readFileSync("disclosure.md", "utf8").split("\n").map((l) => l.trim()).filter((l) => l !== "");
const extLines = extracted.split("\n").map((l) => l.trim());
let cursor = 0;
let inOrder = true;
for (const dl of discLines) {
  const found = extLines.indexOf(dl, cursor);
  if (found === -1) { inOrder = false; break; }
  cursor = found + 1;
}
c.ok(
  headBlock.includes("generated_at") && extracted.includes("# Submission copy") &&
    extracted.includes("## Disclosure / Provenance") && inOrder,
  "extracted copy header + disclosure quoted verbatim in order",
);

// 2. submit format exits 0.
const fmt = run("npx", ["vite-node", "scripts/chassis-tool.ts", "submit", "--", "format", "--plan", "design_documents/winning_project_plan.md", "--manifest", "assembly.manifest.json", "--disclosure", "design_documents/submission/provo/disclosure.md", "--out", "design_documents/submission/extracted-copy.md"]);
c.ok(fmt.code === 0, "submit format exits 0");

// 3. Description headings + slogan third non-empty line.
const desc = readFileSync("design_documents/submission_description.md", "utf8");
const heads = ["# Doorstep Rhythm", "## What it does", "## How it uses Ring", "## Try it", "## Reused code and AI help"];
let last = -1;
let headsOk = true;
for (const h of heads) {
  const i = desc.indexOf(h, last + 1);
  if (i === -1 || i < last) { headsOk = false; break; }
  last = i;
}
const splitLines = desc.split("\n");
c.ok(headsOk && splitLines.length >= 3 && (splitLines[2] ?? "").trim() === SLOGAN, "description headings + slogan line");

// 4. No digit, no risky word.
const RISKY = ["first", "only", "best", "fastest", "never", "always", "guaranteed", "unique", "state-of-the-art", "unprecedented", "no other"];
const low = desc.toLowerCase();
c.ok(!/\d/.test(desc) && RISKY.every((w) => !new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(low)), "description digit-free + risk-free");

// 5. claims lint + verify green.
const lint = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "lint", "--entry", "."]);
const verify = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "verify", "--entry", "."]);
c.ok(/claims: OK \(\d+ claims\)/.test(lint.out) && /(\d+) verified, 0 unverified/.test(verify.out), "claims lint+verify green");

// 6. Banned scan on description + fields.
c.ok(scanBanned(["design_documents/submission_description.md", "design_documents/submission/devpost-fields.json"]).length === 0, "banned scan clean");

// 7. Ten keys; printed count equals non-missing count.
const built = run("npx", ["vite-node", "scripts/build-devpost-fields.ts"]);
const fields = JSON.parse(readFileSync("design_documents/submission/devpost-fields.json", "utf8")) as { fields?: Record<string, unknown> };
const keys = Object.keys(fields.fields ?? {});
const expectedKeys = ["1_description", "2_repository", "3_video", "4_feedback", "5_primary_track", "6_mini_challenges", "7_delta", "8_feature_requests", "9_friction_log", "10_testing_access"];
const nonMissing = keys.filter((k) => {
  const v = (fields.fields ?? {})[k];
  return !(typeof v === "object" && v !== null && "missing" in (v as Record<string, unknown>));
}).length;
const m = /fields: (\d+) of 10 present/.exec(built.out);
c.ok(
  JSON.stringify(keys.sort()) === JSON.stringify(expectedKeys.sort()) && m !== null && Number(m[1]) === nonMissing,
  `ten keys; printed ${m?.[1] ?? "?"} == non-missing ${nonMissing}`,
);

// 8. Track Ring; AWS Builder only.
const f = fields.fields as Record<string, unknown>;
const five = f["5_primary_track"];
const six = f["6_mini_challenges"] as { name?: string; services?: string[] }[];
c.ok(
  five === "Ring" && six.length === 1 && six[0]?.name === "AWS Builder" &&
    JSON.stringify(six[0]?.services) === JSON.stringify(["Amazon Bedrock"]) &&
    !six.some((x) => x.name === "Open Source"),
  "track Ring, AWS Builder only",
);

// 9. Testing access literal + live URL; repo licence MIT.
const showcase = readShowcase();
const ten = f["10_testing_access"] as { text?: string; url?: string };
const two = f["2_repository"] as { licence?: string };
const LITERAL_10 = "The product is free to use and needs no account. Open the live address, press Load the sample week, then Review the week. The sample week is bundled with the app, so a Ring device is not needed. To read a real Ring account, paste a short-lived token from the Ring Developer Playground into the box on the page. The page stays up through the judging period. JUDGES.md in the repository repeats these steps.";
c.ok(ten.text === LITERAL_10 && ten.url === showcase.live_url && two.licence === "MIT", "field 10 literal + live URL; repo MIT");

// 10. File pointers under design_documents; README + JUDGES exist.
const fileVals: string[] = [];
for (const v of Object.values(f)) {
  const rec = v as Record<string, unknown>;
  if (typeof rec.file === "string") fileVals.push(rec.file);
}
c.ok(
  fileVals.length > 0 && fileVals.every((p) => p.startsWith("design_documents/")) &&
    existsSync("README.md") && existsSync("JUDGES.md"),
  "file pointers under design_documents; README+JUDGES exist",
);

c.done();
