// scripts/verify/sc-01-claims.ts — DP-SHOWCASE WU-SHOWCASE-01 (10 checks).
// Requirement IDs: FR-25 (part)
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChecker } from "./ui-kit.js";
import { run } from "./e2e-kit.js";
import { readLedger } from "../../hee/src/showcase/claims.js";

const c = createChecker("sc-01-claims");

// 1. Facts print the exact line; JSON has exactly the four numeric fields.
const facts = run("npx", ["vite-node", "scripts/gen-showcase-facts.ts"]);
const fj = JSON.parse(readFileSync("design_documents/showcase-facts.json", "utf8")) as Record<string, unknown>;
c.ok(
  facts.code === 0 &&
    facts.out.includes("facts: actions=20 e2eTests=60 ringScenarios=9 evalTasks=10") &&
    JSON.stringify(Object.keys(fj).sort()) === JSON.stringify(["actions", "e2eTests", "evalTasks", "ringScenarios"]) &&
    Object.values(fj).every((v) => typeof v === "number"),
  "facts line exact; JSON has exactly the four numeric fields",
);

// 2. Two runs are byte-identical.
const before = readFileSync("design_documents/showcase-facts.json", "utf8");
run("npx", ["vite-node", "scripts/gen-showcase-facts.ts"]);
c.ok(readFileSync("design_documents/showcase-facts.json", "utf8") === before, "facts rerun byte-identical");

// 3. Ledger exists with no schema problem.
const ledger = readLedger(".");
c.ok(ledger !== null && ledger.version === "1.0.0", "claims.json exists, schema ok");

// 4. C-01 + C-02 shapes; every ceiling >= 20 chars.
const byId = new Map((ledger?.claims ?? []).map((x) => [x.id, x]));
const c01 = byId.get("C-01");
const c02 = byId.get("C-02");
c.ok(
  c01?.match === "20 actions" && (c01?.source as { pointer?: string })?.pointer === "/actions" &&
    c02?.match === "60 tests" && (c02?.source as { pointer?: string })?.pointer === "/e2eTests" &&
    (ledger?.claims ?? []).every((x) => (x.ceiling ?? "").length >= 20),
  "C-01/C-02 sources+match per §5.3; all ceilings >= 20 chars",
);

// 5. claims verify: 0 exit, <n> verified 0 unverified, n >= 2.
const verify = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "verify", "--entry", "."]);
const vm = /claims verify: (\d+) verified, 0 unverified/.exec(verify.out);
c.ok(verify.code === 0 && vm !== null && Number(vm[1]) >= 2, `claims verify green (n>=2, got ${vm?.[1] ?? "?"})`);

// 6. Tamper: actions=19 in temp copies -> 1 exit, n-1 verified 1 unverified.
const tmp = mkdtempSync(join(tmpdir(), "sc01-"));
mkdirSync(join(tmp, "design_documents"), { recursive: true });
const tampered = { ...(fj as Record<string, unknown>), actions: 19 };
writeFileSync(join(tmp, "design_documents", "showcase-facts.json"), JSON.stringify(tampered, null, 2) + "\n", "utf8");
copyFileSync("claims.json", join(tmp, "claims.json"));
const n = Number(vm?.[1] ?? 2);
const tamp = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "verify", "--entry", tmp]);
c.ok(
  tamp.code === 1 && tamp.out.includes(`claims verify: ${n - 1} verified, 1 unverified`),
  `tampered facts fail as ${n - 1} verified, 1 unverified`,
);

// 7. Lint: nothing under src/copy/ or shots/; README lines allowed for now.
const lint = run("npx", ["vite-node", "hee/src/showcase/cli.ts", "claims", "lint", "--entry", "."]);
const bad = lint.out.split("\n").filter((l) => l.startsWith("src/copy/") || l.startsWith("shots/"));
c.ok(bad.length === 0, `lint clean for copy/shots (bad: ${bad.join(";") || "none"})`);

// 8. No retracted claim.
c.ok((ledger?.claims ?? []).every((x) => x.status !== "retracted"), "no retracted claim");

// 9. No absolute path, no 20-hex in facts + ledger.
const both = readFileSync("design_documents/showcase-facts.json", "utf8") + readFileSync("claims.json", "utf8");
c.ok(!/[A-Za-z]:[\\/]/.test(both) && !/[0-9a-f]{20}/.test(both), "no absolute path / 20-hex in facts+ledger");

// 10. Banned-words scan clean.
const banned = run("python3", ["../../hackathons/_useful/scripts/check_banned_words.py", "claims.json", "design_documents/showcase-facts.json"]);
c.ok(banned.code === 0, "banned-words scan exits 0");

c.done();
