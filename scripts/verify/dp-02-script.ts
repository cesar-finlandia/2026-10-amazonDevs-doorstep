// scripts/verify/dp-02-script.ts — DP-DEPLOY WU-DEPLOY-02 (12 checks).
// Requirement IDs: FR-24, NFR-02, K-9, K-10
// LOW-COST DEVIATIONS from the plan text, both recorded in config/deploy.json:
// (a) run.minInstances 0 (plan §3.1/§5.4: 1); (b) run.memory 512Mi (plan: 1Gi);
// (c) defaultProject hacka-2026-09-agentic-cinema1 (plan: 2026-09-agentic-cinema1,
// which does not exist for this operator). Checks 1, 2 and 6 assert the
// as-built values.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createChecker } from "./at-kit.js";
import { run } from "./e2e-kit.js";
import { buildMarker, imageRef, loadDeployConfig, planCommands } from "../lib/deploy-plan.js";
import type { Opts } from "../lib/deploy-plan.js";

const c = createChecker("dp-02-script");
const { cfg } = loadDeployConfig({ env: {} });

// 1. Keys of §3.1; low-cost run block: min 0, max 1, port 8080; six doorstep- secrets.
c.ok(
  cfg.service === "doorstep-rhythm" &&
    cfg.run.minInstances === 0 &&
    cfg.run.maxInstances === 1 &&
    cfg.run.port === 8080 &&
    Object.values(cfg.secrets).length === 6 &&
    Object.values(cfg.secrets).every((s) => s.id.startsWith("doorstep-")),
  "config/deploy.json has §3.1 keys, min 0 / max 1 / port 8080, six doorstep- secrets",
);

// 2. Project/region resolution: empty env -> corrected default; overrides win.
const dflt = loadDeployConfig({ env: {} });
const over = loadDeployConfig({ env: { GOOGLE_CLOUD_PROJECT: "p-test", GOOGLE_CLOUD_LOCATION: "europe-west1" } });
c.ok(
  dflt.project === "hacka-2026-09-agentic-cinema1" && dflt.region === "us-central1" &&
    over.project === "p-test" && over.region === "europe-west1",
  `project/region resolve (got ${dflt.project}/${dflt.region}, ${over.project}/${over.region})`,
);

// 3. buildMarker shape.
c.ok(
  buildMarker(new Date("2026-10-06T12:00:00Z"), "abc1234") === "abc1234-20261006-1200",
  "buildMarker gives abc1234-20261006-1200",
);

// 4. imageRef shape.
c.ok(
  imageRef(cfg, "p-test", "europe-west1") === "europe-west1-docker.pkg.dev/p-test/doorstep/doorstep-rhythm",
  "imageRef gives region-docker.pkg.dev/project/doorstep/doorstep-rhythm",
);

// 5. Default plan ids in order.
const baseOpts: Opts = { dryRun: true, createSecrets: false, builder: "docker", skipBuild: false, recordOnly: false };
const ids = planCommands({ cfg, project: "p-test", region: "europe-west1", marker: "m-1", opts: baseOpts, env: {} }).map((x) => x.id);
c.ok(
  JSON.stringify(ids) === JSON.stringify(["enable-services", "ensure-repo", "ensure-sa", "bind-roles/aiplatform.user", "bind-roles/secretmanager.secretAccessor", "docker-auth", "build-push", "digest", "deploy", "url"]),
  `default plan ids in order (got ${JSON.stringify(ids)})`,
);

// 6. Deploy command pins the low-cost single instance and env marker.
const deploy = planCommands({ cfg, project: "p-test", region: "europe-west1", marker: "m-1", opts: baseOpts, env: {}, existingSecrets: [] }).find((x) => x.id === "deploy");
const da = (deploy?.argv ?? []).join(" ");
c.ok(
  da.includes("--min-instances 0") && da.includes("--max-instances 1") &&
    da.includes("--allow-unauthenticated") && da.includes("--session-affinity") &&
    da.includes("--port 8080") && da.includes("--timeout 900") &&
    da.includes("--service-account doorstep-run@p-test.iam.gserviceaccount.com") &&
    da.includes("--set-env-vars BUILD_MARKER=m-1,"),
  "deploy pins min 0 / max 1, public, affinity, port, timeout, SA and BUILD_MARKER first",
);

// 7. cloudbuild variant replaces repo/docker-auth/docker build-push.
const cbIds = planCommands({ cfg, project: "p-test", region: "europe-west1", marker: "m-1", opts: { ...baseOpts, builder: "cloudbuild" }, env: {} }).map((x) => x.id);
const cbBuild = planCommands({ cfg, project: "p-test", region: "europe-west1", marker: "m-1", opts: { ...baseOpts, builder: "cloudbuild" }, env: {} }).find((x) => x.id === "build-push");
c.ok(
  !cbIds.includes("ensure-repo") && !cbIds.includes("docker-auth") &&
    (cbBuild?.argv.join(" ") ?? "").startsWith("gcloud builds submit --tag"),
  `cloudbuild plan has one gcloud build-push (got ${JSON.stringify(cbIds)})`,
);

// 8. Goes through the chassis adapter; never spawns docker itself.
const src = readFileSync("scripts/deploy-cloud-run.ts", "utf8");
c.ok(
  src.includes("src/platform/deploy/deploy.js") && src.includes("runDeploy") &&
    src.includes("DOCKER_REGISTRY") && src.includes("PUBLIC_URL") &&
    !/spawnSync\(\s*"docker"/.test(src) && !/spawn\(\s*"docker"/.test(src),
  "deploy script uses runDeploy with DOCKER_REGISTRY/PUBLIC_URL and never spawns docker",
);

// 9. Dry run prints one would-run per command, runs nothing, writes nothing.
const nodeDir = process.execPath.split(/[/\\]/).slice(0, -1).join("/");
const tmpProbe = mkdtempSync(join(tmpdir(), "dp02-"));
const dry = run("npx", ["vite-node", "scripts/deploy-cloud-run.ts", "--dry-run"], { env: { PATH: nodeDir, PROJECT_SYNC_DIR: tmpProbe } });
const wouldCount = dry.out.split("\n").filter((l) => l.trim().startsWith("would run:")).length;
c.ok(
  dry.code === 0 && wouldCount === planCommands({ cfg, project: dflt.project, region: dflt.region, marker: "m-1", opts: baseOpts, env: {} }).length,
  `dry run exits 0 with ${wouldCount} would-run lines and writes nothing`,
);

// 10. --record-only writes an external record with no secret content.
const tmpRec = mkdtempSync(join(tmpdir(), "dp02rec-"));
const rec = run("npx", ["vite-node", "scripts/deploy-cloud-run.ts", "--record-only", "--url", "https://example.invalid/app"], { env: { PROJECT_SYNC_DIR: tmpRec } });
let recOk = false;
try {
  const j = JSON.parse(readFileSync(join(tmpRec, "deploy-record.json"), "utf8")) as Record<string, unknown>;
  const txt = JSON.stringify(j);
  recOk = rec.code === 0 && j["url"] === "https://example.invalid/app" &&
    typeof j["service"] === "string" && typeof j["buildMarker"] === "string" &&
    !Number.isNaN(Date.parse(j["deployedAt"] as string)) && j["builder"] === "external" &&
    !/[0-9a-f]{20}/.test(txt) && !txt.includes("Bearer ");
} catch { recOk = false; }
c.ok(recOk, "--record-only writes a clean external record");

// 11. No absolute path and no Bearer in config + script.
const both = readFileSync("config/deploy.json", "utf8") + "\n" + src;
const absHit = /"[^"]*":\s*"(\/|([A-Za-z]:[\\/]))/.test(both) || /['"`]\/(bin|usr|app|home|tmp|etc|opt|var|mnt|data|src|config|scripts|logs|dist|public|contracts)[\\/]/.test(both);
c.ok(!absHit && !both.includes("Bearer "), "no absolute path and no Bearer in config/deploy.json + deploy-cloud-run.ts");

// 12. Vendored deploy files untouched.
const st = run("git", ["status", "--porcelain", "--", "src/platform/deploy", "scripts/deploy.ts", "scripts/smoke-deploy.ts", "config/deploy"]);
c.ok(st.code === 0 && st.out.trim() === "", "vendored deploy files untouched");

c.done();
