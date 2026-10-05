// Requirement IDs: FR-18, NFR-08, NFR-14
// WU-AGENT-WORKFLOW-02: metering, vocabulary guard, context fitting (offline).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCostClient } from "src/llm/cost.js";
import { bannedHits, guardCopy } from "src/llm/guard.js";
import { fitTurns } from "src/llm/context.js";
import type { Content } from "src/kits/agent-workflow/src/llm/types.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const root = process.cwd();
const patternsRaw = JSON.parse(readFileSync(join(root, "config", "banned-patterns.json"), "utf8")) as {
  version: unknown;
  patterns: { id: string; pattern: string; flags: string }[];
};
assert(typeof patternsRaw.version === "string" && patternsRaw.patterns.length >= 2, "banned-patterns has a version and 2+ patterns");
for (const p of patternsRaw.patterns) {
  let ok = true;
  try {
    new RegExp(p.pattern, p.flags);
  } catch {
    ok = false;
  }
  assert(ok, `pattern ${p.id} compiles as a RegExp`);
}

const chassis = JSON.parse(
  readFileSync(join(root, "..", "..", "hackathons", "templates", "banned-words.json"), "utf8"),
) as { entries: { id: string; pattern: string; examples?: string[]; presets?: string[] }[] };
const haveIds = new Set(patternsRaw.patterns.map((p) => p.id));
for (const e of chassis.entries) {
  if (e.presets && !e.presets.includes("ui")) {
    assert(!haveIds.has(e.id), `video-only entry ${e.id} is not synced`);
  }
}
for (const e of chassis.entries.filter((x) => !x.presets)) {
  for (const ex of e.examples ?? []) {
    assert(bannedHits(ex).length > 0, `chassis example ${JSON.stringify(ex)} is caught`);
  }
}
assert(bannedHits("A calm note about Tuesday.").length === 0, "clean text has no hits");

const clean = await guardCopy("A calm note about Tuesday.", () => Promise.resolve("unused"), "TEMPLATE");
assert(clean.text === "A calm note about Tuesday." && clean.rewritten === false, "clean text returns unchanged");
const fixed = await guardCopy("honestly, it was fine", () => Promise.resolve("It was fine."), "TEMPLATE");
assert(fixed.text === "It was fine." && fixed.rewritten === true && fixed.usedTemplate === false, "dirty text with clean rewrite returns the rewrite");
const dirty = await guardCopy("honestly, it was fine", () => Promise.resolve("honestly still here"), "TEMPLATE");
assert(dirty.text === "TEMPLATE" && dirty.usedTemplate === true, "a dirty rewrite falls back to the template");
const throwing = await guardCopy("honestly, it was fine", () => Promise.reject(new Error("nope")), "TEMPLATE");
assert(throwing.text === "TEMPLATE" && throwing.usedTemplate === true, "a throwing rewrite falls back to the template");

const short: Content[] = [
  { role: "user", parts: [{ text: "goal here" }] },
  { role: "model", parts: [{ text: "reading" }] },
  { role: "user", parts: [{ text: "data" }] },
  { role: "model", parts: [{ text: "acting" }] },
  { role: "user", parts: [{ text: "done" }] },
];
const kept = fitTurns(short);
assert(kept.contents === short && kept.evicted === 0, "a 5-turn history fits with nothing evicted");

const long = (label: string): string => `${label} ${"abcdefghijklmnopqrstuvwxyz ".repeat(7)}`;
const history: Content[] = [{ role: "user", parts: [{ text: long("goal") }] }];
for (let i = 0; i < 7; i++) {
  history.push({ role: "model", parts: [{ functionCall: { name: "list_week_events", args: { day: 8 } } }, { text: long(`model-${i}`) }] });
  history.push({ role: "user", parts: [{ functionResponse: { name: "list_week_events", response: { ok: true } } }, { text: long(`user-${i}`) }] });
}
const fitted = fitTurns(history, { contextWindow: 400, reservedOutput: 100 });
assert(fitted.evicted >= 1 && fitted.contents[0] === history[0], "a tiny window evicts units but keeps the first user turn");
for (let i = 0; i < fitted.contents.length; i++) {
  const turn = fitted.contents[i] as Content;
  if (turn.role === "model" && turn.parts.some((p) => p.functionCall)) {
    const next = fitted.contents[i + 1] as Content | undefined;
    assert(
      next !== undefined && next.role === "user" && next.parts.some((p) => p.functionResponse),
      "a kept functionCall is followed by its functionResponse",
    );
  }
}

const cost = createCostClient();
const first = await cost.guard(
  { provider: "bedrock", label: "actor", model: "m" },
  () => Promise.resolve({ result: 1, usage: { promptTokens: 1000, outputTokens: 500, totalTokens: 1500 } }),
);
assert(first.summary.totalTokens === 1500 && first.summary.usedPct === 0.3 && first.summary.degraded === false, "metering records 1500 tokens at 0.3%");
const second = await cost.guard(
  { provider: "bedrock", label: "actor", model: "m" },
  () => Promise.resolve({ result: 2, usage: { promptTokens: 300000, outputTokens: 180000, totalTokens: 480000 } }),
);
assert(second.summary.warning === "warning", "480k more tokens raise the warning");
cost.reset();
assert(cost.summary().usedPct === 0, "reset returns usage to zero");
cost.close();

const missing = createCostClient({ sidecarPath: join(root, "scripts", "does-not-exist.py") });
const fell = await missing.guard(
  { provider: "bedrock", label: "actor", model: "m" },
  () => Promise.resolve({ result: "kept", usage: { promptTokens: 1000, outputTokens: 500, totalTokens: 1500 } }),
);
assert(fell.result === "kept", "a missing sidecar still returns the call result");
assert(missing.summary().degraded === true && missing.summary().text.startsWith("Approximate usage:"), "a missing sidecar degrades to the approximate counter");
const before = missing.summary().totalTokens;
const boom = await missing.guard(
  { provider: "bedrock", label: "actor", model: "m" },
  () => Promise.reject(new Error("boom")),
).then(
  () => null,
  (e: Error) => e,
);
assert(boom !== null && boom.message === "boom" && missing.summary().totalTokens === before, "a throwing call rejects and records nothing");
missing.close();

console.log("aw-02-wrappers: 15 checks OK");
