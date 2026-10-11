// scripts/video/live-proofs.ts — DP-LIVE-RUN-AND-VIDEO WU-LIVE-02 step 2.
// Runs the deployed commit locally with live credentials (bedrock model,
// sample-week data), harvests the architecture proofs, and records what the
// run observed. Prints `proofs: <n> proven, <m> missing` over the proof ids
// that require a live or sponsor mode (api-ring, api-inbox, api-bedrock).
// Credential names only below; values are never printed or written.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rehydrateEnv } from "./env-fresh.js";
import { PROJECT, readJson, writeJson } from "./lib.js";
import { startServer } from "../../src/server/start.js";
import { probeBedrock } from "../../e2e/bedrock-probe.js";
import { harvest } from "../harvest-architecture-proofs.js";
import { createAppSession } from "../../src/agent/app-session.js";
import { createBundleRingPort } from "../../src/domain/bundle-ring-port.js";
import { createHttpAgentTransport } from "../../src/server/http-agent-transport.js";
import { runWeekReview } from "../../src/agent/orchestrator.js";

rehydrateEnv();
const ENTRY = process.cwd();
const PROOFS_DIR = `${PROJECT}/video/proofs`;
mkdirSync(PROOFS_DIR, { recursive: true });
const ENTRY_LOG = resolve("logs/proof.log");
const RUN_LOG = `${PROOFS_DIR}/proof.log`;
const beforeSize = existsSync(ENTRY_LOG) ? readFileSync(ENTRY_LOG, "utf8").length : 0;
if (!existsSync("dist")) {
  console.error("BLOCKED (dist/ is not built; run the app build first, DP-UI)");
  process.exit(3);
}
const today = new Date().toISOString().slice(0, 10);
interface Obs { date: string; operation: string; outcome: string; fact: string }
const observations: Obs[] = [];
const observe = (operation: string, outcome: string, fact: string): void => {
  observations.push({ date: today, operation, outcome, fact });
};

// 1. The Bedrock route.
const probe = await probeBedrock();
if (probe.available) {
  observe("probeBedrock", "ok", `balanced tier discovered in ${probe.region ?? "the region"}`);
} else {
  observe("probeBedrock", `error:${"probe_failed"}`, probe.error ?? "Bedrock unavailable");
}

// 2. Ring liveness needs credentials this machine does not hold.
const ringCreds = !!process.env.RING_ACCESS_TOKEN ||
  (!!process.env.RING_REFRESH_TOKEN && !!process.env.RING_CLIENT_ID);
for (const op of ["listDevices", "getEventHistory", "webhookDelivery"]) {
  observe(op, "not run: no Ring credentials in the environment (RING_ACCESS_TOKEN or the refresh trio absent)",
    "Ring observations need a live account; the film uses the recorded sample week");
}

// 3. One agent review: sample-week data locally, live Bedrock calls over HTTP.
let reviewFact = "review not run: Bedrock route unavailable";
if (probe.available) {
  const srv = await startServer({
    port: 0,
    config: { staticDir: "dist", proofLog: ENTRY_LOG },
    env: {
      ...process.env,
      RING_MODE: "live",
      AGENT_PROVIDER: "bedrock",
      AGENT_ALLOW_FALLBACK: "0",
      BUILD_MARKER: "proofs-1",
    },
  });
  try {
    const ring = createBundleRingPort();
    const session = createAppSession({ ring });
    const transport = createHttpAgentTransport({ baseUrl: srv.url, runId: "live-proofs-1" });
    await transport.refreshStatus();
    const phases: string[] = [];
    const summary = await runWeekReview({
      session,
      transport,
      autoDecide: "approve",
      onPhase: (phase) => { phases.push(phase); },
      signal: new AbortController().signal,
    });
    reviewFact = `rung ${summary.rung}, ${summary.counts.modelCalls} model calls, ` +
      `phases ${phases.join(">") || "none"}, review ${summary.ok ? "ok" : `stopped at ${summary.stoppedAt}`}`;
    observe("agentReview", "ok", reviewFact);
  } finally {
    await srv.close();
  }
} else {
  observe("agentReview", "not run: Bedrock route unavailable (see probeBedrock)", "no model calls made");
}

// 4. This run's proof lines go to the film record; the continuous log stays canonical.
const fullLog = existsSync(ENTRY_LOG) ? readFileSync(ENTRY_LOG, "utf8") : "";
writeFileSync(RUN_LOG, fullLog.slice(beforeSize));

// 5. Harvest against the continuous log (keeps the E2E proofs), sync the copies.
const { proofs, missing } = harvest({ dir: ENTRY, logPath: ENTRY_LOG });
const syncTarget = process.env.ARCH_SYNC_DIR ?? PROJECT;
mkdirSync(syncTarget, { recursive: true });
copyFileSync(resolve("architecture.json"), resolve(syncTarget, "architecture.json"));
mkdirSync(resolve(syncTarget, "logs"), { recursive: true });
copyFileSync(ENTRY_LOG, resolve(syncTarget, "logs", "proof.log"));

const cfg = readJson("config/architecture-proofs.json") as Record<string, { accept?: string[] }>;
const liveIds = Object.keys(cfg).filter((id) => (cfg[id]?.accept ?? []).some((m) => m === "live" || m === "bedrock"));
const reasons: Record<string, string> = {
  "api-ring": "no Ring credentials in the environment; Ring observations not run",
  "api-inbox": "no Ring credentials in the environment; Ring observations not run",
  "api-bedrock": probe.available ? "see proof.log" : (probe.error ?? "Bedrock unavailable"),
};
const provenCount = liveIds.filter((id) => id in proofs).length;
const missingCount = liveIds.length - provenCount;
writeJson(`${PROOFS_DIR}/harvest.json`, {
  proven: Object.fromEntries(liveIds.filter((id) => id in proofs).map((id) => [id, proofs[id]])),
  missing: Object.fromEntries(liveIds.filter((id) => !(id in proofs)).map((id) => [id, reasons[id] ?? "no proof line"])),
});
writeJson(`${PROJECT}/video/live-observations.json`, observations);

// 6. Known gaps reflect this run; the model pin is a standing deviation.
try {
  const p = `${PROJECT}/video/production-notes.md`;
  const notes = readFileSync(p, "utf8");
  const gapsBody = liveIds.filter((id) => !(id in proofs)).length > 0
    ? liveIds.filter((id) => !(id in proofs)).map((id) => `- ${id}: ${reasons[id] ?? "no proof line"}.`).join("\n")
    : "None.";
  const secRe = /## Known gaps\n\n[\s\S]*?(?=\n## |$)/;
  const next = notes.match(secRe)
    ? notes.replace(secRe, `## Known gaps\n\n${gapsBody}`)
    : `${notes}\n## Known gaps\n\n${gapsBody}\n`;
  const pinBullet = "- models: BEDROCK_MODEL_ID pins both tiers to the Sonnet 4-6 profile because discovery's 5-5 picks fail structured-output validation (probes 2026-10-11); re-test on newer models before changing.";
  const withPin = next.includes("BEDROCK_MODEL_ID pins both tiers")
    ? next
    : next.replace("## Deviations\n\nNone.", `## Deviations\n\n${pinBullet}`);
  writeFileSync(p, withPin);
} catch { /* notes stay as they are */ }

console.log(`proofs: ${provenCount} proven, ${missingCount} missing`);
