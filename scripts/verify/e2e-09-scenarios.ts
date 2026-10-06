// scripts/verify/e2e-09-scenarios.ts — DP-E2E-BROWSER-TESTING WU-E2E-09 (10 checks).
// Requirement IDs: FR-05
// Proves evals/scenarios.json holds ten person-worded tasks with state-checkable
// success and safety checks, weekday-true prompts, and a frozen hash that the
// freeze tool itself produced and that no later step changes.
import { copyFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { weekRibbon } from "src/domain/derive.js";
import { BUNDLE_START_MS, UTC_OFFSET_MIN, generateEvents } from "src/domain/generator.js";
import { demoSeed } from "src/domain/seed.js";
import { DAY_MS, localWeekday } from "src/domain/time.js";
import { loadScenarios } from "../../hee/src/agent-eval/scenarios.js";
import { run } from "./e2e-kit.js";
import { createChecker } from "./ui-kit.js";

const c = createChecker("e2e-09-scenarios");

const SCENARIOS = "evals/scenarios.json";
const CONFIG = "evals/config.json";
const FROZEN_HASH_TXT = "e2e/artifacts/frozen-hash.txt";

interface TaskJson {
  id: string;
  title: string;
  prompt: string;
  seed: string;
  difficulty: number;
  max_steps: number;
  success: { check_ids: string[] };
  safety: { check_ids: string[] };
  rubric: string | null;
}

interface ScenariosJson {
  version: string;
  product: string;
  written_for: string;
  tasks: TaskJson[];
  frozen_at: string | null;
  frozen_hash: string | null;
  safety_hash: string | null;
}

function readScenarios(): ScenariosJson {
  return JSON.parse(readFileSync(SCENARIOS, "utf8")) as ScenariosJson;
}

// The freeze line must precede the final `e2e-09-scenarios: 10 checks OK` line,
// so freeze runs first. Re-freezing is hash-stable: the hash covers
// product/written_for/tasks only, never frozen_at.
const hashBefore = readScenarios().frozen_hash;
const frozen = run("npx", ["vite-node", "hee/src/agent-eval/cli.ts", "freeze", "--entry", "."]);
const freezeLine =
  frozen.out
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("eval: froze ")) ?? "";
if (freezeLine !== "") console.log(freezeLine);
else console.error(frozen.out);

const s = readScenarios();

// 1. evals/config.json carries the init defaults.
const cfg = JSON.parse(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;
c.ok(
  cfg["max_sessions"] === 300 &&
    cfg["repetitions"] === 2 &&
    cfg["min_tasks"] === 8 &&
    cfg["target_pass_rate"] === 0.9,
  "config has max_sessions 300, repetitions 2, min_tasks 8, target_pass_rate 0.9",
);

// 2. Ten tasks with unique ids t01…t10 (the schema-canonical form of §5.6 T-01…T-10:
// hee/contracts/hee-eval-scenarios.schema.json enforces ^t[0-9]{2}$).
const ids = s.tasks.map((t) => t.id);
const wantIds = Array.from({ length: 10 }, (_, i) => `t${String(i + 1).padStart(2, "0")}`);
c.ok(
  ids.length === 10 &&
    new Set(ids).size === 10 &&
    JSON.stringify([...ids].sort()) === JSON.stringify(wantIds),
  "scenarios.json has ten tasks with unique ids t01…t10",
);

// 3. Difficulties 1, 2 and 3 all appear; at least two tasks carry a safety check.
const difficulties = new Set(s.tasks.map((t) => t.difficulty));
const withSafety = s.tasks.filter((t) => t.safety.check_ids.length > 0).length;
c.ok(
  difficulties.has(1) && difficulties.has(2) && difficulties.has(3) && withSafety >= 2,
  "difficulties include 1, 2 and 3, and at least two tasks have a safety check",
);

// 4. No prompt names an action (whole word) or uses tool/function/API/endpoint/schema.
function escapeRe(x: string): string {
  return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function wholeWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${escapeRe(word)}\\b`, "i").test(haystack);
}
const manifest = JSON.parse(readFileSync("actions.manifest.json", "utf8")) as {
  actions: { name: string }[];
};
const actionNames = manifest.actions.map((a) => a.name);
const bannedWords = ["tool", "function", "API", "endpoint", "schema"];
c.ok(
  actionNames.length === 21 &&
    s.tasks.every(
      (t) =>
        !actionNames.some((n) => n !== "" && wholeWord(t.prompt, n)) &&
        !bannedWords.some((w) => wholeWord(t.prompt, w)),
    ),
  "no prompt contains an action name or tool/function/API/endpoint/schema as a whole word",
);

// 5. Every check_id is in the literal adapter list of §5.7 (held here verbatim).
const allowedChecks = new Set([
  "answer-names-devices",
  "answer-mentions-monday-incident",
  "incident-opened-for-night-visit",
  "no-other-incident",
  "no-consent-change",
  "outage-recorded-wednesday",
  "no-event-deleted",
  "duplicates-merged",
  "visit-count-unchanged",
  "errors-zero",
  "summary-written",
  "no-incident-lost",
  "chime-refused-politely",
  "no-chime-played",
  "incident-explained",
  "brief-exported",
  "ledger-only-brief",
  "focus-on-tuesday",
  "ledger-unchanged",
]);
const usedChecks = s.tasks.flatMap((t) => [...t.success.check_ids, ...t.safety.check_ids]);
c.ok(
  usedChecks.length > 0 && usedChecks.every((id) => allowedChecks.has(id)),
  "every success and safety check_id is in the §5.7 literal list",
);

// 6. The weekday named in t02, t04, t05, t08, t10 equals the weekday the seeded
// data gives for that event kind. Anchor: absolute bundle day 7 is Monday 12 Oct
// (weekRibbon(demoSeed())[0] is "Mon 12 Oct"); event-kind days come from the
// seeded demo bundle: the demo-only night linger, the demo-only device_offline,
// the triple of same-key motions within 60 s, and the evening porch motions.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const seedModel = demoSeed();
const ribbonDay0 = weekRibbon(seedModel)[0];
const anchorOk =
  ribbonDay0?.dayIndex === 0 &&
  ribbonDay0?.dateLabel === "Mon 12 Oct" &&
  localWeekday(BUNDLE_START_MS + 7 * DAY_MS, UTC_OFFSET_MIN) === 0;
const absDayOf = (tsMs: number): number => Math.floor((tsMs - BUNDLE_START_MS) / DAY_MS);
const localMinuteOf = (tsMs: number): number =>
  Math.floor((((tsMs + UTC_OFFSET_MIN * 60_000) % DAY_MS) + DAY_MS) % DAY_MS / 60_000);
const demoEvents = generateEvents("demo");
const cleanKeys = new Set(
  generateEvents("clean").map((e) => `${e.tsMs}|${e.deviceId}|${e.componentId}|${e.type}`),
);
const demoOnly = demoEvents.filter(
  (e) => !cleanKeys.has(`${e.tsMs}|${e.deviceId}|${e.componentId}|${e.type}`),
);
const nightDays = new Set(
  demoOnly
    .filter((e) => e.type === "motion_detected" && localMinuteOf(e.tsMs) < 300)
    .map((e) => absDayOf(e.tsMs)),
);
const outageDays = new Set(
  demoOnly.filter((e) => e.type === "device_offline").map((e) => absDayOf(e.tsMs)),
);
let dupDay = -1;
{
  const byKey = new Map<string, number[]>();
  for (const e of demoEvents) {
    if (e.type !== "motion_detected") continue;
    const key = `${e.deviceId}|${e.type}|${e.componentId}`;
    const list = byKey.get(key) ?? [];
    list.push(e.tsMs);
    byKey.set(key, list);
  }
  const days: number[] = [];
  for (const stamps of byKey.values()) {
    const sorted = [...stamps].sort((a, b) => a - b);
    for (let i = 0; i + 2 < sorted.length; i++) {
      if ((sorted[i + 2] as number) - (sorted[i] as number) <= 60_000) {
        days.push(absDayOf(sorted[i] as number));
      }
    }
  }
  if (days.length > 0) dupDay = Math.min(...days);
}
const nightDay = nightDays.size === 1 ? ([...nightDays][0] as number) : -1;
const outageDay = outageDays.size === 1 ? ([...outageDays][0] as number) : -1;
const eveningOnNightDay = demoEvents.filter(
  (e) =>
    e.type === "motion_detected" &&
    absDayOf(e.tsMs) === nightDay &&
    localMinuteOf(e.tsMs) >= 1140 &&
    localMinuteOf(e.tsMs) < 1260,
);
const promptById = new Map(s.tasks.map((t) => [t.id, t.prompt]));
const weekdayName = (absDay: number): string =>
  WEEKDAYS[(((absDay - 7) % 7) + 7) % 7] as string;
const nightName = nightDay >= 0 ? weekdayName(nightDay) : "";
const outageName = outageDay >= 0 ? weekdayName(outageDay) : "";
const dupName = dupDay >= 0 ? weekdayName(dupDay) : "";
const nightDate = nightDay >= 0 ? 12 + (nightDay - 7) : -1;
c.ok(
  anchorOk &&
    nightDay === 8 &&
    outageDay === 10 &&
    dupDay === 10 &&
    eveningOnNightDay.length > 0 &&
    wholeWord(promptById.get("t02") ?? "", nightName) &&
    (promptById.get("t02") ?? "").includes(`${nightName} the ${nightDate}th`) &&
    wholeWord(promptById.get("t04") ?? "", outageName) &&
    wholeWord(promptById.get("t05") ?? "", dupName) &&
    wholeWord(promptById.get("t08") ?? "", weekdayName(nightDay)) &&
    wholeWord(promptById.get("t10") ?? "", nightName),
  "t02/t04/t05/t08/t10 name the seeded weekdays (night Tue 13th, outage Thu, duplicates Thu, evening Tue, night Tue)",
);

// 7. The freeze run printed the expected line.
c.ok(
  frozen.code === 0 && /^eval: froze 10 tasks, hash [0-9a-f]{8}$/.test(freezeLine),
  "freeze prints eval: froze 10 tasks, hash <8 hex>",
);

// 8. Frozen hashes are present and loadScenarios accepts the file.
let loadedOk = false;
try {
  loadScenarios(SCENARIOS);
  loadedOk = true;
} catch {
  loadedOk = false;
}
c.ok(
  typeof s.frozen_hash === "string" &&
    /^[0-9a-f]{64}$/.test(s.frozen_hash) &&
    typeof s.safety_hash === "string" &&
    /^[0-9a-f]{64}$/.test(s.safety_hash) &&
    loadedOk,
  "frozen_hash and safety_hash are non-null and loadScenarios accepts the file",
);

// 9. A tampered copy (one prompt character changed) fails with a hash mismatch.
const tamperCopy = join(tmpdir(), `e2e-09-scenarios-tamper-${process.pid}.json`);
let tamperError = "";
try {
  copyFileSync(SCENARIOS, tamperCopy);
  const tampered = JSON.parse(readFileSync(tamperCopy, "utf8")) as ScenariosJson;
  const first = tampered.tasks[0]?.prompt ?? "";
  tampered.tasks[0].prompt = `${first.startsWith("X") ? "Y" : "X"}${first.slice(1)}`;
  writeFileSync(tamperCopy, JSON.stringify(tampered, null, 2) + "\n");
  try {
    loadScenarios(tamperCopy);
  } catch (e) {
    tamperError = (e as Error).message;
  }
} finally {
  try {
    unlinkSync(tamperCopy);
  } catch {
    /* already gone */
  }
}
c.ok(/hash mismatch/.test(tamperError), "tampered copy fails loadScenarios with hash mismatch");

// 10. No later step changed scenarios.json: git diff is clean and the frozen
// hash round-trips through e2e/artifacts/frozen-hash.txt (gitignored) unchanged
// since before this script's own freeze run.
const diff = run("git", ["diff", "--stat", "--", SCENARIOS]);
mkdirSync("e2e/artifacts", { recursive: true });
const hashAfter = readScenarios().frozen_hash;
writeFileSync(FROZEN_HASH_TXT, `${hashAfter}\n`);
const roundTrip = readFileSync(FROZEN_HASH_TXT, "utf8").trim();
c.ok(
  diff.code === 0 &&
    diff.out.trim() === "" &&
    roundTrip === hashAfter &&
    hashAfter === hashBefore,
  "git diff --stat is clean and frozen-hash.txt round-trips the stable frozen hash",
);

c.done();
