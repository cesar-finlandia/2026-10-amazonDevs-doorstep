// scripts/verify/sc-07-operator.ts — DP-SHOWCASE WU-SHOWCASE-07 (8 checks).
// Requirement IDs: FR-25 (part)
import { existsSync, readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";

const c = createChecker("sc-07-operator");
const text = readFileSync("design_documents/operator-final-checks.md", "utf8");
const items = text.split("\n").filter((l) => l.startsWith("- [ ] "));
const proofs = text.split("\n").filter((l) => l.trim().startsWith("Proof:"));

// 1. Seven items in order, each with a Proof line.
const order = ["public repository", "repo_url", "video_url", "deployed gate", "whole browser suite", "showcase gate online", "private window"];
c.ok(
  items.length === 7 && proofs.length === 7 &&
    order.every((k, i) => (items[i] ?? "").toLowerCase().includes(k)),
  `seven ordered items each with Proof (${items.length} items, ${proofs.length} proofs)`,
);

// 2. Command-like Proof spans resolve: npm run names exist in package.json,
// npx vite-node paths exist. Output literals (judge-kit: OK, 4 passed, URLs)
// are not commands and are skipped.
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
let cmdsOk = true;
let sawCommand = false;
for (const p of proofs) {
  // A proof is a command or a place (plan WU-07 step 1); only command-like
  // spans are resolved, output literals and place descriptions are skipped.
  const spans = p.split("`").filter((_, i) => i % 2 === 1);
  for (const s of spans) {
    const t = s.trim();
    const npm = /^npm run ([\w:-]+)/.exec(t);
    if (npm) {
      sawCommand = true;
      if (typeof pkg.scripts?.[npm[1]] !== "string") cmdsOk = false;
      continue;
    }
    const nx = /^npx vite-node (\S+)/.exec(t);
    if (nx) {
      sawCommand = true;
      if (!existsSync(nx[1] as string)) cmdsOk = false;
      continue;
    }
    if (/^(git|BASE_URL=)/.test(t)) {
      sawCommand = true;
      continue;
    }
  }
}
c.ok(cmdsOk && sawCommand, "Proof command spans resolve to package scripts and files");

// 3. README develop commands and these commands agree on package scripts.
const readme = readFileSync("README.md", "utf8");
const allText = `${readme}\n${text}`;
const names = new Set<string>();
for (const m of allText.matchAll(/npm run ([\w:-]+)/g)) names.add(m[1] as string);
c.ok([...names].every((n) => typeof pkg.scripts?.[n] === "string"), "every npm run name exists in package.json");

// 4. Item 3 runs the three tools after the video_url swap; proof is their OK lines.
c.ok(
  (items[2] ?? "").includes("video_url") && (items[2] ?? "").includes("judge-kit render") &&
    (proofs[2] ?? "").includes("judge-kit: OK") && (proofs[2] ?? "").includes("readme: OK") && (proofs[2] ?? "").includes("claims: OK"),
  "item 3 names video_url + three tools",
);

// 5. Item 6 is the online gate; proof names the command and its OK line.
c.ok(
  (items[5] ?? "").toLowerCase().includes("showcase gate online") &&
    (proofs[5] ?? "").includes("gate --entry . --online") && (proofs[5] ?? "").includes("showcase gate OK"),
  "item 6 names online gate",
);

// 6. No path / Bearer / blob.
c.ok(!/[A-Za-z]:[\\/]/.test(text.replace(/https?:\/\/\S+/g, "URL")) && !text.includes("Bearer ") && !/[0-9a-f]{20}/.test(text), "no path/secret/blob");

// 7. Banned-words scan.
const banned = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "design_documents/operator-final-checks.md"]);
c.ok(banned.code === 0, "banned-words scan exits 0");

// 8. verify:showcase names all seven scripts in order.
const chain = pkg.scripts?.["verify:showcase"] ?? "";
const ids = ["sc-01-claims.ts", "sc-02-scenario.ts", "sc-03-watch.ts", "sc-04-stills.ts", "sc-05-readme.ts", "sc-06-judges.ts", "sc-07-operator.ts"];
let last = -1;
let chainOk = true;
for (const id of ids) {
  const i = chain.indexOf(id, last + 1);
  if (i === -1 || i < last) { chainOk = false; break; }
  last = i;
}
c.ok(chainOk, "verify:showcase names sc-01..sc-07 in order");

c.done();
