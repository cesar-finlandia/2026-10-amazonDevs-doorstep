// Requirement IDs: FR-06, FR-21
// WU-AGENT-WORKFLOW-09: golden cache replay (offline verification).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { demoSeed } from "src/domain/seed.js";
import { createAppSession } from "src/agent/app-session.js";
import { runWeekReview } from "src/agent/orchestrator.js";
import { createGoldenTransport } from "src/agent/transport.js";
import { PROMPT_VERSION } from "src/prompts/index.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const meta = JSON.parse(readFileSync(join(process.cwd(), "data", "golden-cache", "doorstep-meta.json"), "utf8")) as {
  provider: string;
  promptVersion: string;
  roles: { extractor: number; planner: number; narrator: number };
};
assert(meta.provider === "bedrock" || meta.provider === "vertex-fallback", "meta provider is a live rung label");
assert(meta.promptVersion === PROMPT_VERSION, "meta prompt version matches");
assert(meta.roles.extractor >= 2 && meta.roles.planner === 1 && meta.roles.narrator === 3, "meta role counts match");

async function replay() {
  const session = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
  const transport = createGoldenTransport();
  const summary = await runWeekReview({ session, transport, autoDecide: "approve", decisionDelayMs: 5 });
  return { summary, transport };
}

const first = await replay();
assert(first.summary.ok === true, "golden replay succeeds");
assert(first.transport.remaining() === 0, "no steps remain after replay");
assert(first.transport.drift() === 0, "replay has no drift");
assert(
  first.summary.counts.errorsAfterAct === 1 && first.summary.counts.errorsAfterRepair === 0 &&
    first.summary.counts.warningsAfterRepair === 3,
  "replay reproduces the 3→1→0 census",
);
assert(first.summary.floors.ok === true, "replayed floors pass");
const second = await replay();
assert(
  JSON.stringify(second.summary.counts) === JSON.stringify(first.summary.counts),
  "a second replay is identical",
);
{
  const tmp = mkdtempSync(join(tmpdir(), "aw09-"));
  const file = join(tmp, "replay-trace.json");
  writeFileSync(file, JSON.stringify(first.summary.trace, null, 2) + "\n", "utf8");
  const res = spawnSync("npx", ["vite-node", "hee/scripts/hee-validate-run-trace.ts", file, "--min-roles", "4", "--min-actions", "15", "--require-verify-repair", "--require-human-checkpoint"], {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf8",
  });
  assert(res.status === 0, `hee validator passes: ${(res.stderr ?? "").slice(0, 300)}`);
}

console.log("aw-09-golden: 10 checks OK");
