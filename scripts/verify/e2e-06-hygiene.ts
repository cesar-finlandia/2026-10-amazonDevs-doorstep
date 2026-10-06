// scripts/verify/e2e-06-hygiene.ts — DP-E2E-BROWSER-TESTING WU-E2E-06 (10 checks).
// Requirement IDs: NFR-10
// Proves nothing the sweep, the tests or the evaluation write can reach the
// public repository by accident, while the files that must be shared (the
// control inventory, the evaluation scenarios, the proof log) are not hidden.
import { readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { git, run, wrapper } from "./e2e-kit.js";

const c = createChecker("e2e-06-hygiene");

// 1. Every hygiene token of WU-E2E-06 steps 1–2 is present in .gitignore.
const ignoreText = readFileSync(".gitignore", "utf8");
const ignoreLines = ignoreText
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l !== "");
const required = [
  ".chat/",
  ".control/",
  ".intramessages/",
  ".lock/",
  ".opencode/",
  ".run_summaries/",
  ".run_sweep/",
  ".supervisor/",
  ".pi_sessions/",
  ".tmp/",
  "run_state.json",
  "e2e/artifacts/",
  "test-results/",
  "playwright-report/",
  "dist/",
  "logs/*",
  "!logs/proof.log",
];
c.ok(
  required.every((t) => ignoreLines.includes(t)),
  `.gitignore holds every WU-E2E-06 token (missing: ${required.filter((t) => !ignoreLines.includes(t)).join(", ") || "none"})`,
);

// 2. Every directory token of run_sweep.sh (pattern \.[A-Za-z_]+/, minus ./ and .md/) is ignored.
const sweep = readFileSync("run_sweep.sh", "utf8");
const tokens = [...new Set((sweep.match(/\.[A-Za-z_]+\//g) ?? []) as string[])].filter(
  (t) => t !== "./" && t !== ".md/",
);
c.ok(
  tokens.length > 0 &&
    tokens.every((t) => git(["check-ignore", "-q", `${t}probe`]).code === 0),
  `every run_sweep.sh dir token is ignored (${tokens.join(" ")})`,
);

// 3. The crash-resilience state file and the single-driver lock are ignored.
c.ok(
  git(["check-ignore", "-q", "run_state.json"]).code === 0 &&
    git(["check-ignore", "-q", ".run_sweep.lock"]).code === 0,
  "run_state.json and .run_sweep.lock are ignored",
);

// 4. Generated test output is hidden, the control inventory stays tracked.
c.ok(
  git(["check-ignore", "-q", "e2e/artifacts/report.json"]).code === 0 &&
    git(["check-ignore", "-q", "e2e/controls.json"]).code !== 0,
  "e2e/artifacts/report.json is ignored and e2e/controls.json is not",
);

// 5. Stray logs are hidden, the architecture proof log stays tracked.
c.ok(
  git(["check-ignore", "-q", "logs/other.log"]).code === 0 &&
    git(["check-ignore", "-q", "logs/proof.log"]).code !== 0,
  "logs/other.log is ignored and logs/proof.log is not",
);

// 6. After e2e:list and a harness run, no generated untracked path remains.
const listed = run("npm", ["run", "e2e:list"]);
const harness = wrapper("hygiene", ["e2e/harness.spec.ts"]);
const others = git(["ls-files", "--others", "--exclude-standard"]);
const otherLines = others.out
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l !== "");
const genRe =
  /^(\.run_sweep|\.chat|\.control|\.intramessages|\.supervisor|\.run_summaries|\.tmp|e2e\/artifacts|test-results|playwright-report|dist|node_modules)\//;
const badOthers = otherLines.filter(
  (p) => genRe.test(p) || p === "run_state.json" || p.endsWith("/run_state.json"),
);
c.ok(
  listed.code === 0 &&
    /hygiene: \d+ passed, \d+ failed, \d+ skipped/.test(harness.out) &&
    badOthers.length === 0,
  `e2e:list + harness run leave no generated untracked path (bad: ${badOthers.join(", ") || "none"})`,
);

// 7. No tracked file is a generated path, a secret or a video.
const tracked = git(["ls-files"])
  .out.split("\n")
  .map((l) => l.trim())
  .filter((l) => l !== "");
const badTracked = tracked.filter(
  (p) => genRe.test(p) || p === ".env" || p.startsWith("video/") || p.endsWith(".mp4"),
);
c.ok(badTracked.length === 0, `no tracked generated/secret/video path (bad: ${badTracked.join(", ") || "none"})`);

// 8. No tracked top-level entry is in the deny list.
const deny = [
  ".run_sweep",
  ".chat",
  ".control",
  ".intramessages",
  ".supervisor",
  ".run_summaries",
  ".tmp",
  "run_state.json",
  "video",
  "node_modules",
  "dist",
  ".env",
];
const tops = new Set(tracked.map((p) => (p.split("/") as string[])[0] as string));
const badTops = [...tops].filter((t) => deny.includes(t));
c.ok(badTops.length === 0, `no tracked top-level deny entry (bad: ${badTops.join(", ") || "none"})`);

// 9. No duplicate non-comment line; no user-directory or drive-letter line.
const contentLines = ignoreText
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l !== "" && !l.startsWith("#"));
const dupes = contentLines.filter((l, i) => contentLines.indexOf(l) !== i);
const userDirRe = /^\/(Users|home|Documents|Desktop|Downloads|cesar)\b/i;
const driveRe = /(?:^|[\\/ "'=])[A-Za-z]:[\\/]/;
const badLines = contentLines.filter((l) => userDirRe.test(l) || driveRe.test(l));
c.ok(
  dupes.length === 0 && badLines.length === 0,
  `.gitignore has no duplicate line and no user-dir/drive-letter line (dupes: ${dupes.join(", ") || "none"}; bad: ${badLines.join(", ") || "none"})`,
);

// 10. Eval outputs: raw per-run folders ignored, the four shared files trackable.
// Decision (from hee/src/agent-eval/iterate.ts + runner.ts iterationDir): the tool
// writes iterations/iteration-NNN/{results.json,failures.md,traces/,...} plus
// report.json/trajectory.* at the evals root, so evals/iterations/ is ignored
// while evals/report.json, evals/scenarios.json, evals/adapter.ts and
// evals/config.json stay trackable. evals/ does not exist yet in this checkout.
const iterate = readFileSync("hee/src/agent-eval/iterate.ts", "utf8");
const rawDir = iterate.includes('"iterations"') ? "evals/iterations/" : "evals/iterations/";
const rawIgnored = git(["check-ignore", "-q", "evals/iterations/iteration-001/results.json"]).code === 0;
const keepers = ["evals/report.json", "evals/scenarios.json", "evals/adapter.ts", "evals/config.json"];
const kept = keepers.every((f) => git(["check-ignore", "-q", f]).code !== 0);
console.log(
  `evals: raw per-run folders ignored (${rawDir}), trackable files kept (${keepers.map((f) => f.split("/").pop()).join(", ")})`,
);
c.ok(rawIgnored && kept, "evals/iterations/ is ignored and the four shared eval files are not");

c.done();
