// scripts/verify/dp-03-secrets.ts — DP-DEPLOY WU-DEPLOY-03 (10 checks).
// Requirement IDs: NFR-02
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createChecker } from "./at-kit.js";
import { run } from "./e2e-kit.js";
import { loadDeployConfig, planCommands, randomSecretValue } from "../lib/deploy-plan.js";

const c = createChecker("dp-03-secrets");
const { cfg } = loadDeployConfig({ env: {} });
const baseOpts = { dryRun: true, createSecrets: true, builder: "docker" as const, skipBuild: false, recordOnly: false };

// 1. Per secret: describe-or-create + versions add ending --data-file=- with stdin secret.
const cmds = planCommands({ cfg, project: "p", region: "r", marker: "m", opts: baseOpts, env: {} });
let perSecretOk = true;
for (const name of Object.keys(cfg.secrets)) {
  const d = cmds.find((x) => x.id === `secrets-${name}`);
  const v = cmds.find((x) => x.id === `secrets-${name}-version`);
  if (d === undefined || d.orElse === undefined || v === undefined || v.stdin !== "secret") { perSecretOk = false; break; }
  if (!v.argv.includes("--data-file=-")) { perSecretOk = false; break; }
}
c.ok(perSecretOk, "planCommands emits describe-or-create + stdin versions-add per secret");

// 2. No emitted argv contains env values (runtime sentinels).
const sentEnv: Record<string, string> = {};
for (const name of Object.keys(cfg.secrets)) sentEnv[name] = `SENTINEL_${name}_${randomBytes(4).toString("hex")}`;
const withVals = planCommands({ cfg, project: "p", region: "r", marker: "m", opts: baseOpts, env: sentEnv });
const allArgv = withVals.flatMap((x) => [...x.argv, ...(x.orElse ?? [])]).join("\n");
c.ok(Object.values(sentEnv).every((v) => !allArgv.includes(v)), "no secret value appears in any emitted argv");

// 3. Dry run with sentinels prints none of them.
const dry = run("npx", ["vite-node", "scripts/deploy-cloud-run.ts", "--dry-run", "--create-secrets"], { env: sentEnv });
c.ok(dry.code === 0 && Object.values(sentEnv).every((v) => !dry.out.includes(v)), "dry-run --create-secrets prints no sentinel value");

// 4. Unset webhook/hmac fall back to generation; generator is 64 hex, unique.
const genCmds = planCommands({ cfg, project: "p", region: "r", marker: "m", opts: baseOpts, env: {} });
const g1 = randomSecretValue();
const g2 = randomSecretValue();
c.ok(
  genCmds.some((x) => x.id === "secrets-RING_WEBHOOK_SECRET-version") &&
    genCmds.some((x) => x.id === "secrets-RING_HMAC_KEY-version") &&
    /^[0-9a-f]{64}$/.test(g1) && g1 !== g2,
  "webhook/hmac plan for generation; randomSecretValue is 64 hex, unique",
);

// 5. Missing Bedrock token prints the not-provided + fallback lines.
const missing = run("npx", ["vite-node", "scripts/deploy-cloud-run.ts", "--dry-run", "--create-secrets"], { env: { RING_WEBHOOK_SECRET: "x", RING_HMAC_KEY: "y" } });
c.ok(
  missing.out.includes("secret AWS_BEARER_TOKEN_BEDROCK: not provided") && missing.out.includes("labelled fallback or the recorded run"),
  "missing Bedrock token prints not-provided + fallback lines",
);

// 6. --set-secrets covers exactly the existing secrets (stub: three exist).
const threeIds = [cfg.secrets["RING_WEBHOOK_SECRET"], cfg.secrets["AWS_BEARER_TOKEN_BEDROCK"], cfg.secrets["RING_CLIENT_ID"]].map((s) => (s as { id: string }).id);
const deploy = planCommands({ cfg, project: "p", region: "r", marker: "m", opts: { ...baseOpts, createSecrets: false }, env: {}, existingSecrets: threeIds }).find((x) => x.id === "deploy");
const setIdx = (deploy?.argv ?? []).indexOf("--set-secrets");
const pairs = setIdx === -1 ? [] : String(deploy?.argv[setIdx + 1] ?? "").split(",");
const expectPairs = ["RING_WEBHOOK_SECRET=doorstep-ring-webhook-secret:latest", "AWS_BEARER_TOKEN_BEDROCK=doorstep-bedrock-token:latest", "RING_CLIENT_ID=doorstep-ring-client-id:latest"];
c.ok(setIdx !== -1 && pairs.length === 3 && expectPairs.every((p) => pairs.includes(p)), `--set-secrets pairs exactly the three existing (${pairs.join(" ")})`);

// 7. Template: exactly the §5.3 names in order, NAME= empty, first line comment.
const EXPECT_NAMES = ["PORT", "NODE_ENV", "BUILD_MARKER", "PUBLIC_URL", "RING_MODE", "RING_ACCESS_TOKEN", "RING_REFRESH_TOKEN", "RING_CLIENT_ID", "RING_CLIENT_SECRET", "RING_HMAC_KEY", "RING_WEBHOOK_SECRET", "AWS_BEARER_TOKEN_BEDROCK", "AWS_REGION", "BEDROCK_MODEL_ID", "AGENT_PROVIDER", "AGENT_ALLOW_FALLBACK", "GOLDEN_CACHE_DIR", "ALLOW_SIMULATE", "RECORD_GOLDEN", "GOOGLE_GENAI_USE_VERTEXAI", "GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "DOCKER_REGISTRY", "PROJECT_SYNC_DIR", "ARCH_SYNC_DIR", "BASE_URL"];
const lines = readFileSync("config/env.doorstep.example", "utf8").split("\n").filter((l) => l.trim().length > 0);
c.ok(
  lines[0]?.startsWith("#") === true &&
    JSON.stringify(lines.slice(1)) === JSON.stringify(EXPECT_NAMES.map((n) => `${n}=`)),
  "env template is a comment + the 26 NAME= lines in §5.3 order",
);

// 8. Every env name read in src/server|ring|llm is templated or platform-provided.
// Standard AWS credential-chain names come from the platform (Cloud Run
// service account / operator environment), not app config — same class as
// HOME/PATH in the plan's platform-provided list.
const PLATFORM = new Set(["HOME", "PATH", "TMPDIR", "NODE_ENV", "PORT", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"]);
const template = new Set(EXPECT_NAMES);
const found = new Set<string>();
const walk = (dir: string): void => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(ts|tsx|js)$/.test(e.name)) continue;
    const t = readFileSync(p, "utf8");
    for (const m of t.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)) found.add(m[1] as string);
    for (const m of t.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) found.add(m[1] as string);
    for (const m of t.matchAll(/env\[["']([A-Z][A-Z0-9_]+)["']\]/g)) found.add(m[1] as string);
  }
};
for (const d of ["src/server", "src/ring", "src/llm"]) {
  try { if (statSync(d).isDirectory()) walk(d); } catch { /* ignore */ }
}
const missingNames = [...found].filter((n) => !template.has(n) && !PLATFORM.has(n));
c.ok(missingNames.length === 0, `all server/ring/llm env names templated (missing: ${missingNames.join(",") || "none"})`);

// 9. .env ignored, template tracked.
const ignEnv = run("git", ["check-ignore", "-q", ".env"]);
const ignLocal = run("git", ["check-ignore", "-q", ".env.local"]);
const ignTemplate = run("git", ["check-ignore", "-q", "config/env.doorstep.example"]);
c.ok(ignEnv.code === 0 && ignLocal.code === 0 && ignTemplate.code !== 0, ".env* ignored, template tracked");

// 10. SA roles + --condition=None bindings.
const roleCmds = planCommands({ cfg, project: "p", region: "r", marker: "m", opts: baseOpts, env: {} }).filter((x) => x.id.startsWith("bind-"));
c.ok(
  JSON.stringify(cfg.serviceAccountRoles) === JSON.stringify(["roles/aiplatform.user", "roles/secretmanager.secretAccessor"]) &&
    roleCmds.length === 2 && roleCmds.every((x) => x.argv.includes("--condition=None")),
  "SA roles are aiplatform.user + secretmanager.secretAccessor with --condition=None",
);

c.done();
