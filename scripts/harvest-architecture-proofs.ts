// scripts/harvest-architecture-proofs.ts — CLI
//   npx vite-node scripts/harvest-architecture-proofs.ts [--dir <project dir>] [--log <proof log>] [--accept-any] [--sync] [--require-sponsor]
// prints one line per edge: `proof <edge-id>: <log file>:<line> mode=<mode>`  or  `missing <edge-id>: no line from a <accepted modes> run`
// final line: `harvest: <n> proofs, <m> missing`.  Exit 1 when --require-sponsor and no sponsor edge has a proof.
//
// NOTE (WU-API-TRANSPORT-07): the REAL harvest happens in DP-E2E-BROWSER-TESTING
// WU-11 (after a real run) and again in DP-LIVE-RUN-AND-VIDEO (live Ring and
// Bedrock lines); this unit never commits a proof — the skeleton ships clean
// and lint-architecture fails until a real run is harvested.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve, relative, dirname, isAbsolute } from "node:path";

export function harvest(opts: {
  dir: string;
  logPath: string;
  acceptAny?: boolean;
}): {
  proofs: Record<string, { file: string; line: number; text: string; mode: string }>;
  missing: string[];
} {
  const dir = resolve(opts.dir);
  const archPath = join(dir, "architecture.json");
  const doc = JSON.parse(readFileSync(archPath, "utf8")) as {
    nodes?: { id?: string; sponsor?: boolean }[];
    edges?: { id?: string; from?: string; to?: string; proof?: unknown }[];
  };
  const cfgPath = join(dir, "config", "architecture-proofs.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, { accept?: string[] }>;
  const logAbs = isAbsolute(opts.logPath) ? opts.logPath : resolve(opts.logPath);
  let lines: string[] = [];
  try {
    lines = readFileSync(logAbs, "utf8").split(/\r?\n/);
  } catch {
    lines = [];
  }
  const rel = relative(dir, logAbs).split("\\").join("/");

  const proofs: Record<string, { file: string; line: number; text: string; mode: string }> = {};
  const missing: string[] = [];

  for (const edgeId of Object.keys(cfg)) {
    const accept = cfg[edgeId]?.accept ?? [];
    let found: { line: number; text: string; mode: string } | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] as string;
      if (opts.acceptAny) {
        const m = new RegExp(` proof edge=${edgeId} mode=(\\S+) `).exec(line);
        if (m) {
          const mode = m[1] as string;
          const marker = ` proof edge=${edgeId} mode=${mode} `;
          const at = line.indexOf(marker);
          if (at >= 0) {
            found = { line: i + 1, text: line.slice(at + marker.length), mode };
            break;
          }
        }
      } else {
        for (const mode of accept) {
          const marker = ` proof edge=${edgeId} mode=${mode} `;
          const at = line.indexOf(marker);
          if (at >= 0) {
            found = { line: i + 1, text: line.slice(at + marker.length), mode };
            break;
          }
        }
        if (found) break;
      }
    }
    if (found) {
      proofs[edgeId] = { file: rel, line: found.line, text: found.text, mode: found.mode };
    } else {
      missing.push(edgeId);
    }
  }

  const edges = doc.edges ?? [];
  for (const e of edges) {
    if (!e.id || !(e.id in cfg)) continue;
    if (e.id in proofs) {
      (e as Record<string, unknown>)["proof"] = proofs[e.id];
    } else {
      delete (e as Record<string, unknown>)["proof"];
    }
  }
  writeFileSync(archPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
  return { proofs, missing };
}

function parseArgs(argv: string[]): {
  dir: string;
  logPath: string | null;
  acceptAny: boolean;
  sync: boolean;
  requireSponsor: boolean;
} {
  let dir = ".";
  let logPath: string | null = null;
  let acceptAny = false;
  let sync = false;
  let requireSponsor = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--dir" && i + 1 < argv.length) dir = argv[++i] as string;
    else if (a === "--log" && i + 1 < argv.length) logPath = argv[++i] as string;
    else if (a === "--accept-any") acceptAny = true;
    else if (a === "--sync") sync = true;
    else if (a === "--require-sponsor") requireSponsor = true;
  }
  return { dir, logPath, acceptAny, sync, requireSponsor };
}

function readCfg(dir: string): Record<string, { accept?: string[] }> {
  try {
    return JSON.parse(readFileSync(join(resolve(dir), "config", "architecture-proofs.json"), "utf8") as string) as Record<
      string,
      { accept?: string[] }
    >;
  } catch {
    return {};
  }
}

// vite-node strips the script path from process.argv, so argv-based main
// detection cannot work. Instead the CLI runs only when one of its flags is
// present; a bare import (as in scripts/verify/at-07-architecture.ts, whose
// argv carries no harvest flags) only exposes harvest().
const CLI_FLAGS = new Set(["--dir", "--log", "--accept-any", "--sync", "--require-sponsor"]);
const isMain = process.argv.slice(2).some((a) => CLI_FLAGS.has(a));
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const dirAbs = resolve(args.dir);
  const logAbs = args.logPath ? (isAbsolute(args.logPath) ? args.logPath : resolve(args.logPath)) : join(dirAbs, "logs", "proof.log");
  const cfg = readCfg(args.dir);
  const { proofs, missing } = harvest({ dir: dirAbs, logPath: logAbs, acceptAny: args.acceptAny });
  const logRel = relative(dirAbs, logAbs).split("\\").join("/");
  for (const edgeId of Object.keys(cfg)) {
    if (edgeId in proofs) {
      const p = proofs[edgeId] as { line: number; mode: string };
      console.log(`proof ${edgeId}: ${logRel}:${p.line} mode=${p.mode}`);
    } else {
      const accept = (cfg[edgeId]?.accept ?? []).join("/");
      console.log(`missing ${edgeId}: no line from a ${accept} run`);
    }
  }
  console.log(`harvest: ${Object.keys(proofs).length} proofs, ${missing.length} missing`);

  if (args.sync) {
    const target = process.env["ARCH_SYNC_DIR"] ?? join("..", "..", "hackathons", "hackathon-projects", "2026-10-amazonDevs");
    const targetAbs = resolve(target);
    if (!existsSync(targetAbs)) {
      console.log(`sync skipped: ${target} not found`);
    } else {
      mkdirSync(targetAbs, { recursive: true });
      copyFileSync(join(dirAbs, "architecture.json"), join(targetAbs, "architecture.json"));
      const destLog = join(targetAbs, relative(dirAbs, logAbs).split("\\").join("/"));
      mkdirSync(dirname(destLog), { recursive: true });
      try {
        copyFileSync(logAbs, destLog);
      } catch {
        writeFileSync(destLog, "", "utf8");
      }
      console.log("synced");
    }
  }

  if (args.requireSponsor) {
    const doc = JSON.parse(readFileSync(join(dirAbs, "architecture.json"), "utf8")) as {
      nodes?: { id?: string; sponsor?: boolean }[];
      edges?: { from?: string; to?: string; proof?: unknown }[];
    };
    const sponsors = new Set((doc.nodes ?? []).filter((n) => n.sponsor).map((n) => n.id));
    const proven = (doc.edges ?? []).some(
      (e) => e.proof !== undefined && (sponsors.has(e.from) || sponsors.has(e.to)),
    );
    if (!proven) process.exit(1);
  }
}
