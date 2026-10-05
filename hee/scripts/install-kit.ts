// Requirement IDs: HEE-KIT-01
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globToRegExp } from "./hee-glob.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

export interface InstallKitArgs {
  kit: string;
  to: string;
  variant?: "react" | "vanilla" | "both";
  withTests?: boolean;
  force?: boolean;
  dryRun?: boolean;
  repoRoot?: string;
}

export interface InstallKitResult {
  ok: boolean;
  exitCode: number;
  files: string[];
  messages: string[];
}

interface KitManifest {
  name: string;
  version: string;
  dest: string;
  files: { common?: string[]; react?: string[]; vanilla?: string[]; tests?: string[] };
  dependencies?: { common?: Record<string, string>; react?: Record<string, string>; vanilla?: Record<string, string> };
  devDependencies?: Record<string, string>;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFilesRecursive(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listFilesRecursive(full, out);
    else out.push(full);
  }
  return out;
}

function expandPatterns(kitDir: string, patterns: string[]): string[] {
  const regexes = patterns.map(globToRegExp);
  const picked: string[] = [];
  for (const abs of listFilesRecursive(kitDir)) {
    const rel = abs.slice(kitDir.length + 1).replace(/\\/g, "/");
    if (regexes.some((r) => r.test(rel))) picked.push(rel);
  }
  return picked.sort();
}

export function installKit(args: InstallKitArgs): InstallKitResult {
  const messages: string[] = [];
  const root = args.repoRoot ?? REPO_ROOT;
  const variant = args.variant ?? "react";
  const registryPath = join(root, "kits", "kit-registry.json");
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
    kits?: { name: string; path: string }[];
  };
  const known = (registry.kits ?? []).map((k) => k.name);
  const entry = (registry.kits ?? []).find((k) => k.name === args.kit);
  if (!entry) {
    return { ok: false, exitCode: 2, files: [], messages: [`unknown kit: ${args.kit}; known: ${known.join(", ")}`] };
  }
  const kitDir = join(root, ...entry.path.split("/"));
  const manifest = JSON.parse(readFileSync(join(kitDir, "kit.json"), "utf8")) as KitManifest;

  const patterns = [...(manifest.files.common ?? [])];
  const variants = variant === "both" ? ["react", "vanilla"] as const : [variant];
  for (const v of variants) patterns.push(...(manifest.files[v] ?? []));
  if (args.withTests) patterns.push(...(manifest.files.tests ?? []));
  const files = expandPatterns(kitDir, patterns);

  if (args.dryRun) {
    messages.push(`dry run: would install ${files.length} files`);
    for (const f of files) messages.push(`  ${f}`);
    return { ok: true, exitCode: 0, files, messages };
  }

  const destDir = join(args.to, ...manifest.dest.split("/"));
  const conflicts: string[] = [];
  for (const rel of files) {
    const dest = join(destDir, ...rel.split("/"));
    if (existsSync(dest)) {
      const same = sha256File(join(kitDir, ...rel.split("/"))) === sha256File(dest);
      if (!same && !args.force) conflicts.push(rel);
    }
  }
  if (conflicts.length > 0) {
    messages.push(`refusing to overwrite ${conflicts.length} modified file(s) without --force:`);
    for (const c of conflicts) messages.push(`  ${c}`);
    return { ok: false, exitCode: 1, files, messages };
  }

  for (const rel of files) {
    const dest = join(destDir, ...rel.split("/"));
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(kitDir, ...rel.split("/")), dest);
  }
  const installed = files.map((rel) => ({ path: rel, sha256: sha256File(join(destDir, ...rel.split("/"))) }));
  writeFileSync(
    join(destDir, "INSTALLED.json"),
    JSON.stringify(
      { kit: manifest.name, version: manifest.version, variant, installed_at: new Date().toISOString(), files: installed },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const deps: Record<string, string> = { ...(manifest.dependencies?.common ?? {}) };
  for (const v of variants) Object.assign(deps, manifest.dependencies?.[v] ?? {});
  const devDeps: Record<string, string> = { ...(manifest.devDependencies ?? {}) };
  const pkgPath = join(args.to, "package.json");
  if (!existsSync(pkgPath)) {
    messages.push(`no package.json in ${args.to}; add manually:`);
    messages.push(JSON.stringify({ dependencies: deps, devDependencies: devDeps }, null, 2));
  } else {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    pkg.dependencies ??= {};
    pkg.devDependencies ??= {};
    for (const [name, version] of Object.entries(deps)) {
      if (pkg.dependencies[name] === undefined) pkg.dependencies[name] = version;
      else messages.push(`kept ${name} ${pkg.dependencies[name]}`);
    }
    for (const [name, version] of Object.entries(devDeps)) {
      if (pkg.devDependencies[name] === undefined) pkg.devDependencies[name] = version;
      else messages.push(`kept ${name} ${pkg.devDependencies[name]}`);
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }

  messages.unshift(`installed ${manifest.name}@${manifest.version} (${variant}) into ${manifest.dest}: ${files.length} files`);
  messages.push("next: npm install");
  return { ok: true, exitCode: 0, files, messages };
}

function parseArgv(argv: string[]): InstallKitArgs | { error: string } {
  const positional: string[] = [];
  let to = "";
  let variant: "react" | "vanilla" | "both" = "react";
  let withTests = false;
  let force = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--to" && i + 1 < argv.length) {
      to = argv[++i] as string;
    } else if (a === "--variant" && i + 1 < argv.length) {
      const v = argv[++i] as string;
      if (v !== "react" && v !== "vanilla" && v !== "both") return { error: `unknown variant: ${v}` };
      variant = v;
    } else if (a === "--with-tests") withTests = true;
    else if (a === "--force") force = true;
    else if (a === "--dry-run") dryRun = true;
    else if (!a.startsWith("--")) positional.push(a);
    else return { error: `unknown flag: ${a}` };
  }
  if (positional.length === 0) return { error: "usage: install-kit.ts <kit> --to <entry-dir> [--variant react|vanilla|both] [--with-tests] [--force] [--dry-run]" };
  if (!to) return { error: "usage: install-kit.ts <kit> --to <entry-dir> [--variant react|vanilla|both] [--with-tests] [--force] [--dry-run]" };
  return { kit: positional[0] as string, to, variant, withTests, force, dryRun };
}

function main(): void {
  const parsed = parseArgv(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(2);
  }
  let result: InstallKitResult;
  try {
    result = installKit(parsed);
  } catch (e) {
    console.error((e as Error).message ?? String(e));
    process.exit(1);
  }
  for (const m of result.messages) console.log(m);
  process.exit(result.exitCode);
}

if (!process.env["VITEST"] && !process.env["VITEST_WORKER_ID"]) main();
