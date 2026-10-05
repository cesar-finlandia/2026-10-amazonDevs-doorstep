// Requirement IDs: FR-05, FR-06, FR-09
// WU-AGENT-WORKFLOW-10: floors, manifest, headless golden proof (offline).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { summarizeTrace } from "src/kits/agent-workflow/src/trace/summarize.js";
import type { RunTrace, TraceEntry } from "src/kits/agent-workflow/src/trace/types.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { demoSeed } from "src/domain/seed.js";
import { createAppSession } from "src/agent/app-session.js";
import { runWeekReview } from "src/agent/orchestrator.js";
import { checkFloors } from "src/agent/floors.js";
import { createScriptedTransport } from "scripts/verify/scripted-transport.js";

function assert(cond: unknown, message: string): void {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const root = process.cwd();
const spawn = (args: string[]) => spawnSync("npx", args, { cwd: root, shell: true, encoding: "utf8" });

const manifestCheck = spawn(["vite-node", "scripts/export-manifest.ts", "--check"]);
assert(
  manifestCheck.status === 0 && (manifestCheck.stdout ?? "").split("\n").some((l) => l.startsWith("manifest: 21 actions, hash ")),
  "export-manifest --check passes with the manifest line",
);
const manifest = JSON.parse(readFileSync(join(root, "actions.manifest.json"), "utf8")) as {
  version: string;
  actions: unknown[];
  procedures: unknown[];
};
assert(manifest.version === "1.0.0" && manifest.actions.length === 21 && manifest.procedures.length === 3, "manifest has 21 actions and 3 procedures");

let seq = 0;
const modelEntry = (name: string): TraceEntry => ({
  seq: ++seq, round: 3, kind: "model", name, source: "agent",
  input_ref: name, output_ref: name, ok: true, latency_ms: 0,
});
const build = (models: string[], withCheckpoint: boolean, finalErrors: number | null): RunTrace => {
  seq = 0;
  const entries: TraceEntry[] = models.map(modelEntry);
  if (withCheckpoint) {
    entries.push({
      seq: ++seq, round: 6, kind: "approval", name: "export_weekly_brief", source: "agent",
      input_ref: "args#1", output_ref: null, ok: true, latency_ms: 0, decision: "approved",
    });
  }
  if (finalErrors !== null) {
    entries.push({
      seq: ++seq, round: 6, kind: "action", name: "check_week_model", source: "agent",
      input_ref: "args#2", output_ref: "0 errors", ok: true, latency_ms: 0,
      truth: { errors: finalErrors, warnings: 0 },
    });
  }
  return { version: "1.0.0", run_id: "t", started_at: new Date().toISOString(), entries, summary: summarizeTrace(entries) };
};

const fourteen = build(
  ["extractor", "extractor", "planner", "narrator", "narrator", "narrator",
    "actor", "actor", "actor", "actor", "actor", "actor", "actor", "actor"],
  true, 0,
);
assert(checkFloors(fourteen).problems.some((p) => p.includes("model-entry")), "14 entries name the model-entry floor");
const threeRoles = build(new Array(16).fill("actor"), true, 0);
assert(checkFloors(threeRoles).problems.some((p) => p.includes("role floor")), "three roles name the role floor");
const badEnd = build(
  ["extractor", "extractor", "planner", "narrator", "narrator", "narrator",
    "actor", "actor", "actor", "actor", "actor", "actor", "actor", "actor", "actor", "actor"],
  true, 1,
);
assert(checkFloors(badEnd).problems.some((p) => p.includes("final error")), "a dirty ending names the final error count");

{
  const session = createAppSession({ initial: demoSeed(), ring: createBundleRingPort() });
  const summary = await runWeekReview({
    session,
    transport: createScriptedTransport(session),
    autoDecide: "approve",
    decisionDelayMs: 5,
  });
  assert(checkFloors(summary.trace).ok === true, "the scripted trace passes floors");
}

const review = spawn(["vite-node", "scripts/run-review.ts", "--transport", "golden"]);
const line = (review.stdout ?? "").split("\n").find((l) => l.startsWith("review: ")) ?? "";
assert(
  /^review: ok=true rung=golden modelCalls=\d+ errors 3→1→0 warnings=3$/.test(line),
  `golden headless run prints the census line (got ${JSON.stringify(line)})`,
);
assert(review.status === 0, "the golden headless run exits 0");

console.log("aw-10-floors: 8 checks OK");
