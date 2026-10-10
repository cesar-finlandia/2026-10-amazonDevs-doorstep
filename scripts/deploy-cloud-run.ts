// scripts/deploy-cloud-run.ts — DP-DEPLOY WU-DEPLOY-02/03 CLI.
// Requirement IDs: FR-24, NFR-02, K-9, K-10
// Plans, prints and executes the Cloud Run command list of §5.4 through the
// chassis Docker adapter (src/platform/deploy/deploy.ts, never edited).
// Secrets travel on stdin into Secret Manager only; values never appear in
// argv, logs or the deploy record. Pure planners live in scripts/lib/deploy-plan.ts.
import { spawnSync } from "node:child_process";
import { loadDeployConfig, buildMarker, imageRef, randomSecretValue, writeRecord, planCommands } from "./lib/deploy-plan.js";
import type { Cmd, DeployConfig, DeployRecord, Opts } from "./lib/deploy-plan.js";

function gitSha(): string {
  try {
    const r = spawnSync(cmdString(["git", "rev-parse", "--short", "HEAD"]), { encoding: "utf8", shell: true });
    const sha = `${r.stdout ?? ""}`.trim();
    if ((r.status ?? 1) === 0 && sha !== "") return sha;
  } catch { /* ignore */ }
  return "nogit";
}

function secretExists(id: string, project: string): boolean {
  // A secret shell may exist with no versions (skipped values). Only a
  // secret with at least one ENABLED version can be mounted with :latest.
  // versions-list prints names only, never values.
  const r = spawnSync(
    cmdString(["gcloud", "secrets", "versions", "list", id, "--project", project, "--filter=state:ENABLED", "--format=value(name)"]),
    { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "ignore"] },
  );
  return (r.status ?? 1) === 0 && `${r.stdout ?? ""}`.trim() !== "";
}

/** Quote one argv element for shell:true execution (Windows splits on
 *  spaces: `--display-name Doorstep Rhythm` would become two args). */
function quoteArg(a: string): string {
  if (/[\s"']/.test(a)) return `"${a.replace(/"/g, '\\"')}"`;
  return a;
}

function cmdString(argv: string[]): string {
  return argv.map(quoteArg).join(" ");
}

export async function main(argv: string[]): Promise<number> {
  const opts: Opts = { dryRun: false, createSecrets: false, builder: "docker", skipBuild: false, recordOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--create-secrets") opts.createSecrets = true;
    else if (a === "--builder") { opts.builder = (argv[i + 1] as "docker" | "cloudbuild") ?? "docker"; i += 1; }
    else if (a === "--skip-build") opts.skipBuild = true;
    else if (a === "--record-only") opts.recordOnly = true;
    else if (a === "--url") { opts.url = argv[i + 1] ?? ""; i += 1; }
  }
  const { cfg, project, region } = loadDeployConfig();
  const env: Record<string, string | undefined> = { ...process.env };
  const marker = buildMarker(new Date(), gitSha());
  const image = imageRef(cfg, project, region);

  if (opts.recordOnly) {
    if (!opts.url) { console.error("BLOCKED (--record-only needs --url <https url>)"); return 3; }
    const rec: DeployRecord = {
      url: opts.url, service: cfg.service, project, region, image,
      digest: null, buildMarker: marker, deployedAt: new Date().toISOString(), builder: "external", smoke: null,
    };
    const dir = env[cfg.record.dirEnv] ?? cfg.record.defaultDir;
    const path = writeRecord(dir, rec);
    console.log(`record: ${path} ${opts.url}`);
    return 0;
  }

  // Resolve secret values for stdin commands (values never enter argv).
  const secretValues = new Map<string, string>();
  if (opts.createSecrets) {
    for (const [name, spec] of Object.entries(cfg.secrets)) {
      const v = env[name];
      if (v !== undefined && v !== "") secretValues.set(name, v);
      else if (spec.generateIfMissing) secretValues.set(name, randomSecretValue());
      else {
        console.log(`secret ${name}: not provided`);
        if (name === "AWS_BEARER_TOKEN_BEDROCK") console.log("(the deployed app will use the labelled fallback or the recorded run)");
      }
    }
  }

  if (opts.dryRun) {
    const cmds = planCommands({ cfg, project, region, marker, opts, env });
    for (const c of cmds) {
      if (c.id === "build-push" && opts.builder === "docker") {
        console.log(`would run: chassis docker adapter (DOCKER_REGISTRY=${image})`);
      } else {
        console.log(`would run: ${c.argv.join(" ")}`);
      }
      if (c.orElse !== undefined) console.log(`would run (if needed): ${c.orElse.join(" ")}`);
    }
    return 0;
  }

  const existing = Object.values(cfg.secrets).map((sp) => sp.id).filter((id) => secretExists(id, project));
  const cmds = planCommands({ cfg, project, region, marker, opts, env, existingSecrets: existing });

  let digest = "latest";
  let url = "";
  for (const c of cmds) {
    if (c.id === "build-push" && opts.builder === "docker") {
      process.env.DOCKER_REGISTRY = image;
      try {
        process.env.PUBLIC_URL = await currentServiceUrl(cfg, project, region);
      } catch {
        process.env.PUBLIC_URL = "https://pending.invalid";
      }
      const { runDeploy } = await import("src/platform/deploy/deploy.js");
      try {
        await runDeploy("docker");
      } catch (e) {
        console.error((e as Error).message);
        return 1;
      }
      continue;
    }
    if (c.orElse !== undefined) {
      const probe = spawnSync(cmdString(c.argv), { stdio: "inherit", shell: true });
      const stepArgv = (probe.status ?? 1) === 0 ? null : c.orElse;
      if (stepArgv !== null) {
        const r = execCmd(stepArgv, c, secretValues, cfg);
        if (r !== 0) return 1;
      }
      continue;
    }
    if (c.id === "digest" || c.id === "url") {
      const r = spawnSync(cmdString(c.argv), { encoding: "utf8", shell: true });
      const out = `${r.stdout ?? ""}`.trim();
      if ((r.status ?? 1) !== 0) { console.error(`command failed: ${c.argv.join(" ")}`); return 1; }
      console.log(out);
      if (c.id === "digest" && out !== "") digest = out;
      if (c.id === "url") url = out;
      continue;
    }
    if (c.id === "deploy" && digest !== "latest") {
      const fixed = c.argv.map((t) => (t.startsWith(`${image}@`) ? `${image}@${digest}` : t));
      const r = execCmd(fixed, c, secretValues, cfg);
      if (r !== 0) return 1;
      continue;
    }
    const r = execCmd(c.argv, c, secretValues, cfg);
    if (r !== 0) return 1;
  }
  if (url === "") {
    try { url = await currentServiceUrl(cfg, project, region); } catch { url = ""; }
  }
  const rec: DeployRecord = {
    url, service: cfg.service, project, region, image,
    digest: digest === "latest" ? null : digest, buildMarker: marker,
    deployedAt: new Date().toISOString(), builder: opts.builder, smoke: null,
  };
  const dir = env[cfg.record.dirEnv] ?? cfg.record.defaultDir;
  const path = writeRecord(dir, rec);
  console.log(`record: ${path} ${url}`);
  console.log(`deployed ${cfg.service} ${marker} -> ${url}`);
  return 0;
}

function execCmd(argv: string[], c: Cmd, secretValues: Map<string, string>, cfg: DeployConfig): number {
  if (c.stdin === "secret") {
    const name = Object.keys(cfg.secrets).find((n) => c.id === `secrets-${n}-version`) ?? "";
    const value = secretValues.get(name) ?? "";
    if (value === "") return 0;
    const r = spawnSync(cmdString(argv), { input: value, encoding: "utf8", shell: true, stdio: ["pipe", "inherit", "inherit"] });
    return r.status ?? 1;
  }
  const r = spawnSync(cmdString(argv), { stdio: "inherit", shell: true });
  return r.status ?? 1;
}

async function currentServiceUrl(cfg: DeployConfig, project: string, region: string): Promise<string> {
  const r = spawnSync(cmdString(["gcloud", "run", "services", "describe", cfg.service, "--region", region, "--project", project, "--format=value(status.url)"]), { encoding: "utf8", shell: true });
  const url = `${r.stdout ?? ""}`.trim();
  if ((r.status ?? 1) !== 0 || url === "") throw new Error("no current service URL");
  return url;
}

const code = await main(process.argv.slice(2));
process.exit(code);
