// scripts/lib/deploy-plan.ts — DP-DEPLOY pure planners (no side effects on import).
// Requirement IDs: FR-24, NFR-02, K-9, K-10
// Imported by scripts/deploy-cloud-run.ts (the CLI) and by
// scripts/verify/dp-02-script.ts / dp-03-secrets.ts.
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface SecretSpec { id: string; generateIfMissing: boolean }
export interface DeployConfig {
  version: string;
  service: string;
  defaultProject: string;
  projectEnv: string;
  defaultRegion: string;
  regionEnv: string;
  repository: string;
  image: string;
  serviceAccount: string;
  serviceAccountRoles: string[];
  services: string[];
  run: {
    port: number; memory: string; cpu: number; concurrency: number; timeoutSec: number;
    minInstances: number; maxInstances: number; sessionAffinity: boolean; allowUnauthenticated: boolean;
  };
  env: Record<string, string>;
  envFromOperator: string[];
  secrets: Record<string, SecretSpec>;
  record: { dirEnv: string; defaultDir: string; file: string };
}
export interface Cmd { id: string; argv: string[]; stdin?: "secret"; redact?: string[]; orElse?: string[]; capture?: boolean }
export interface Opts { dryRun: boolean; createSecrets: boolean; builder: "docker" | "cloudbuild"; skipBuild: boolean; recordOnly: boolean; url?: string }
export interface DeployRecord {
  url: string; service: string; project: string; region: string; image: string;
  digest: string | null; buildMarker: string; deployedAt: string; builder: string;
  smoke: null | { at: string; smoke: string; depth: string; rung: string; ring: string };
}

export function loadDeployConfig(opts?: { path?: string; env?: Record<string, string | undefined> }): { cfg: DeployConfig; project: string; region: string } {
  const e = opts?.env ?? process.env;
  const cfg = JSON.parse(readFileSync(opts?.path ?? "config/deploy.json", "utf8")) as DeployConfig;
  return {
    cfg,
    project: e[cfg.projectEnv] ?? cfg.defaultProject,
    region: e[cfg.regionEnv] ?? cfg.defaultRegion,
  };
}

export function buildMarker(now: Date, shortSha: string): string {
  const p = (n: number, w: number): string => String(n).padStart(w, "0");
  return `${shortSha}-${now.getUTCFullYear()}${p(now.getUTCMonth() + 1, 2)}${p(now.getUTCDate(), 2)}-${p(now.getUTCHours(), 2)}${p(now.getUTCMinutes(), 2)}`;
}

export function imageRef(cfg: DeployConfig, project: string, region: string): string {
  return `${region}-docker.pkg.dev${String.fromCharCode(47)}${project}${String.fromCharCode(47)}${cfg.repository}${String.fromCharCode(47)}${cfg.image}`;
}

export function randomSecretValue(bytes?: number): string {
  return randomBytes(bytes ?? 32).toString("hex");
}

export function writeRecord(dir: string, rec: DeployRecord): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "deploy-record.json");
  writeFileSync(path, JSON.stringify(rec, null, 2) + "\n", "utf8");
  return path;
}

export function planCommands(input: {
  cfg: DeployConfig; project: string; region: string; marker: string; opts: Opts;
  env: Record<string, string | undefined>; digest?: string; existingSecrets?: string[];
}): Cmd[] {
  const { cfg, project, region, marker, opts, env } = input;
  const cmds: Cmd[] = [];
  if (opts.recordOnly) return cmds;
  cmds.push({ id: "enable-services", argv: ["gcloud", "services", "enable", ...cfg.services, "--project", project] });
  const saEmail = `${cfg.serviceAccount}@${project}.iam.gserviceaccount.com`;
  if (opts.builder === "docker") {
    cmds.push({
      id: "ensure-repo",
      argv: ["gcloud", "artifacts", "repositories", "describe", cfg.repository, "--location", region, "--project", project],
      orElse: ["gcloud", "artifacts", "repositories", "create", cfg.repository, "--repository-format=docker", "--location", region, "--project", project],
    });
  }
  cmds.push({
    id: "ensure-sa",
    argv: ["gcloud", "iam", "service-accounts", "describe", saEmail],
    orElse: ["gcloud", "iam", "service-accounts", "create", cfg.serviceAccount, "--display-name", "Doorstep Rhythm"],
  });
  for (const role of cfg.serviceAccountRoles) {
    cmds.push({
      id: `bind-${role}`,
      argv: ["gcloud", "projects", "add-iam-policy-binding", project, "--member", `serviceAccount:${saEmail}`, "--role", role, "--condition=None"],
    });
  }
  if (opts.createSecrets) {
    for (const [name, spec] of Object.entries(cfg.secrets)) {
      cmds.push({
        id: `secrets-${name}`,
        argv: ["gcloud", "secrets", "describe", spec.id, "--project", project],
        orElse: ["gcloud", "secrets", "create", spec.id, "--replication-policy=automatic", "--project", project],
      });
      cmds.push({ id: `secrets-${name}-version`, argv: ["gcloud", "secrets", "versions", "add", spec.id, "--data-file=-", "--project", project], stdin: "secret" });
    }
  }
  const image = imageRef(cfg, project, region);
  if (opts.builder === "docker") {
    cmds.push({ id: "docker-auth", argv: ["gcloud", "auth", "configure-docker", `${region}-docker.pkg.dev`, "--quiet"] });
    if (!opts.skipBuild) cmds.push({ id: "build-push", argv: ["chassis-docker-adapter", image] });
  } else if (!opts.skipBuild) {
    cmds.push({ id: "build-push", argv: ["gcloud", "builds", "submit", "--tag", `${image}:latest`, "--project", project, "."] });
  }
  if (!opts.skipBuild) {
    cmds.push({ id: "digest", argv: ["gcloud", "artifacts", "docker", "images", "describe", `${image}:latest`, "--project", project, "--format=value(image_summary.digest)"], capture: true });
  }
  const digest = input.digest ?? "latest";
  const envPairs = [`BUILD_MARKER=${marker}`, ...Object.entries(cfg.env).map(([k, v]) => `${k}=${v}`)];
  for (const k of cfg.envFromOperator) {
    if (env[k] !== undefined && env[k] !== "") envPairs.push(`${k}=${env[k]}`);
  }
  const existing = new Set(input.existingSecrets ?? []);
  const secretPairs = Object.entries(cfg.secrets)
    .filter(([, spec]) => existing.has(spec.id))
    .map(([name, spec]) => `${name}=${spec.id}:latest`);
  const deployArgv = [
    "gcloud", "run", "deploy", cfg.service,
    "--image", `${image}@${digest}`,
    "--region", region, "--project", project, "--platform", "managed",
    "--service-account", saEmail,
    "--port", String(cfg.run.port),
    "--memory", cfg.run.memory,
    "--cpu", String(cfg.run.cpu),
    "--concurrency", String(cfg.run.concurrency),
    "--timeout", String(cfg.run.timeoutSec),
    "--min-instances", String(cfg.run.minInstances),
    "--max-instances", String(cfg.run.maxInstances),
    ...(cfg.run.sessionAffinity ? ["--session-affinity"] : []),
    ...(cfg.run.allowUnauthenticated ? ["--allow-unauthenticated"] : []),
    "--set-env-vars", envPairs.join(","),
  ];
  if (secretPairs.length > 0) deployArgv.push("--set-secrets", secretPairs.join(","));
  cmds.push({ id: "deploy", argv: deployArgv });
  cmds.push({ id: "url", argv: ["gcloud", "run", "services", "describe", cfg.service, "--region", region, "--project", project, "--format=value(status.url)"], capture: true });
  return cmds;
}
