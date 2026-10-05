// Requirement IDs: PGM-12, PGM-13, PGM-05, PGM-11, GOV-RES-01, RES-04, XCUT-08
// `pgm` CLI (DP-K §9.2 command table). Modes:
//   pgm run --brief <file> --out <dir> [--config config/pgm.json]
//           [--refresh-cache] [--with-comments]          full S1→S4 pipeline
//   pgm --stage {1..4} --input <file> --out <dir> [--brief <file>] [--catalog <file>]
//        [--candidates N] [--personas N] [--with-comments]   single stage (PGM-13)
//   pgm stage1|stage2|stage3|stage4 ...                  aliases of --stage
//   pgm --validate <file>                                RES-04 dry-run, NO write
//   pgm --refresh-cache --subreddits a,b --months 6      tier-1 cache refresh
//                                                        (delegates to
//                                                        scripts/refresh-cache.ts;
//                                                        outside event window only)
//   pgm --help
//
// Exit codes: 0 ok/degraded-but-zero (GOV-RES-01 — partial_ceiling and every
// degraded status still exit 0) · 1 usage error or failed validation ·
// 2 environment/dispatch failure.
//
// Help documents three frozen caveats:
//   - PGM-05: Reddit evidence can be stale — check mined_frustrations.json
//     captured_at before trusting hotness judgments.
//   - PGM-11: model routing lives ONLY in config/model-profiles.json (shared
//     role→model_profile file); never hardcoded in src/pgm.
//   - PGM-13: per-stage re-run examples (no upstream re-invocation).
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { validate } from "../resilience/index.js";
import {
  loadPgmConfig,
  runPgm,
  runPgmStage,
} from "./pipeline.js";
import type { RoleCallOptions } from "./resilientCall.js";
import { makeSweepTransport } from "./transports/sweepTransport.js";
import { probeRedditAccess } from "./mining/probe.js";
import { closeBrowserFetch } from "./mining/browserFetch.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DEFAULT_CONFIG = join(REPO_ROOT, "config", "pgm.json");
const DEFAULT_CATALOG = join(REPO_ROOT, "contracts", "component-catalog.json");
// Centralized layout: every hackathon's PGM outputs live under hackathon-projects/<Hackathon-project-name>/
// Callers MUST pass --out hackathon-projects/<name> (the legacy private/pgm default is kept only for backward compat
// with isolated unit tests; pipeline prompts and walkthroughs now use the centralized path).
const DEFAULT_OUT = join("hackathon-projects");

export const USAGE = `usage:
  pgm run --brief <file> --out <dir> [--config <file>] [--refresh-cache] [--with-comments]
          [--llm sweep --sweep-role <name>] [--llm-timeout-ms <n>] [--ceiling-minutes <n>]
          [--allow-ungrounded]
  pgm (--stage <1|2|3|4>|stage1|stage2|stage3|stage4) --input <file> --out <dir>
      [--brief <file>] [--catalog <file>] [--candidates <n>] [--personas <n>]
      [--config <file>] [--with-comments] [--llm sweep]
  pgm --reddit-only [--subreddits a,b]        probe Reddit reachability ONLY, exit 0/1
  pgm --validate <file>
  pgm --refresh-cache [--subreddits a,b] [--months <n>] [--config <file>]
  pgm --help

Problem Grounding & Market-Discovery Engine (DP-K §9).

modes:
  run              full 4-stage pipeline inside the documented budget
                   (p50 <=22 min, p95 <=25 min; hard ceiling 28 min -> partial
                   outputs + run.json{status:"partial_ceiling"}, exit 0)
  --stage / alias  one stage vs its own input file, NO upstream re-invocation
                   (PGM-13): S1 brief.md · S2 personas.json ·
                   S3 mined_frustrations.json + brief · S4 pitch_candidates.json
                   + brief + catalog — stages 3/4 never fetch Reddit
  --validate       RES-04 schema dry-run against the matching contract; no file
                   is ever written
  --refresh-cache  tier-1 reddit JSONL refresh (PGM-03/6.12) — OUTSIDE event
                   window only; delegates to scripts/refresh-cache.ts

options:
  --brief <file>       hackathon_brief.md (required by run, --stage 1; used by 3/4)
  --input <file>       single-stage input (see mode table above)
  --out <dir>          centralized planning output dir (default hackathon-projects/<Hackathon-project-name>;
                        e.g. hackathon-projects/2026-09-AllThingsAgentic; legacy private/pgm still accepted but deprecated)
  --catalog <file>     component catalog for stage 4
                       (default contracts/component-catalog.json)
  --config <file>      default config/pgm.json (PGM-04/11/12)
  --candidates <n>     override pgm.candidates.count
  --personas <n>       override pgm.personas.count
  --with-comments      request comment evidence — ALSO requires env
                       PGM_ENABLE_COMMENTS=1 AND mining.include_comments:true
                       in config (PGM-05 double opt-in)
  --subreddits a,b     --refresh-cache watchlist override
  --months <n>         --refresh-cache recency window (default 6)
  --llm sweep          dispatch S1/S3/S4 LLM calls through run_sweep.sh --chat
                       (Pi harness / OpenCode fallback; retries + stall +
                       context watchdog owned by the sweep driver). Without it
                       the CLI injects NO transport and degrades at stage 1.
  --sweep-role <name>  models.json role for the chat turns (default "standard"
                       -> opencode-go/ox-alpha-free); pinned on turn 1, must
                       keep matching on follow-ups of the same conversation.
  --llm-timeout-ms <n> per-call resilience budget for S1/S3/S4 when a transport
                       is active (default 900000 = 15 min; DP-K defaults 20/30/45s
                       stay in force without --llm sweep).
  --ceiling-minutes <n> override time_budget.ceiling_minutes for this run
                       (default from config/pgm.json: 28).
  --reddit-only        probe the keyless Reddit endpoint (3 attempts, explicit
                       per-attempt prints) and report tier-1 cache warmth; NO
                       stage runs, exit 0 reachable / 1 blocked.
  --allow-ungrounded   run-mode escape hatch: with Reddit unreachable AND cold
                       cache, proceed anyway (placeholder-only artifacts). The
                       preflight probe always runs and prints what it found.

caveats:
  PGM-05  evidence staleness: verify captured_at in mined_frustrations.json
          before trusting freshness-sensitive outputs; comments carry extra
          identity risk and are off unless doubly opted in.
  PGM-11  roles/models resolve via config/model-profiles.json ONLY
          (pgm_deconstructor / pgm_miner_query / pgm_synthesizer ->
          analyst-balanced; pgm_selector -> strong-reasoning). Never hardcode.
  PGM-13  per-stage examples (centralized layout):
            pgm --stage 2 --input hackathon-projects/<name>/personas.json --out hackathon-projects/<name>
            pgm --stage 3 --input hackathon-projects/<name>/mined_frustrations.json \\
                --brief hackathon-projects/<name>/hackathon_brief.md --out hackathon-projects/<name> --candidates 12
            pgm --stage 4 --input hackathon-projects/<name>/pitch_candidates.json \\
                --brief hackathon-projects/<name>/hackathon_brief.md --out hackathon-projects/<name> \\
                --catalog contracts/component-catalog.json
`;

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

interface CliArgs {
  mode: "run" | "stage" | "validate" | "refresh" | "reddit-only";
  stage?: 1 | 2 | 3 | 4;
  brief?: string;
  input?: string;
  out: string;
  catalog?: string;
  config: string;
  candidates?: number;
  personas?: number;
  withComments: boolean;
  refreshCache: boolean;
  subreddits?: string;
  months?: number;
  validatePath?: string;
  llm?: "sweep";
  sweepRole: string;
  llmTimeoutMs?: number;
  ceilingMinutes?: number;
  allowUngrounded: boolean;
}

function parseArgv(argv: string[]): CliArgs {
  const args: CliArgs = { mode: "run", out: DEFAULT_OUT, config: DEFAULT_CONFIG, withComments: false, refreshCache: false, sweepRole: "standard", allowUngrounded: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "run":
        args.mode = "run";
        break;
      case "--stage": {
        const v = argv[++i];
        if (!v) fail("--stage requires a value (1|2|3|4)");
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 4) fail(`invalid --stage ${v} (expected 1|2|3|4)`);
        args.mode = "stage";
        args.stage = n as 1 | 2 | 3 | 4;
        break;
      }
      case "stage1":
      case "stage2":
      case "stage3":
      case "stage4":
        args.mode = "stage";
        args.stage = Number(a[5]) as 1 | 2 | 3 | 4; // alias form (PGM-13)
        break;
      case "--brief":
        args.brief = argv[++i];
        if (!args.brief) fail("--brief requires a path");
        break;
      case "--input":
        args.input = argv[++i];
        if (!args.input) fail("--input requires a path");
        break;
      case "--out":
        args.out = argv[++i] ?? fail("--out requires a path");
        break;
      case "--catalog":
        args.catalog = argv[++i] ?? fail("--catalog requires a path");
        break;
      case "--config":
        args.config = argv[++i] ?? fail("--config requires a path");
        break;
      case "--candidates": {
        const n = Number(argv[++i]);
        if (!Number.isInteger(n) || n <= 0) fail("--candidates requires a positive integer");
        args.candidates = n;
        break;
      }
      case "--personas": {
        const n = Number(argv[++i]);
        if (!Number.isInteger(n) || n <= 0) fail("--personas requires a positive integer");
        args.personas = n;
        break;
      }
      case "--with-comments":
        args.withComments = true;
        break;
      case "--refresh-cache":
        args.refreshCache = true;
        if (args.mode === "run") break; // allowed pre-step of `pgm run`
        args.mode = "refresh";
        break;
      case "--subreddits":
        args.subreddits = argv[++i] ?? fail("--subreddits requires a comma list");
        break;
      case "--months": {
        const n = Number(argv[++i]);
        if (!Number.isInteger(n) || n <= 0) fail("--months requires a positive integer");
        args.months = n;
        break;
      }
      case "--llm": {
        const v = argv[++i];
        if (v !== "sweep") fail(`invalid --llm ${v ?? "(missing)"} (only "sweep" is supported)`);
        args.llm = v;
        break;
      }
      case "--sweep-role":
        args.sweepRole = argv[++i] ?? fail("--sweep-role requires a models.json role name");
        break;
      case "--llm-timeout-ms": {
        const n = Number(argv[++i]);
        if (!Number.isInteger(n) || n < 60_000) fail("--llm-timeout-ms requires an integer >= 60000");
        args.llmTimeoutMs = n;
        break;
      }
      case "--ceiling-minutes": {
        const n = Number(argv[++i]);
        if (!Number.isInteger(n) || n <= 0) fail("--ceiling-minutes requires a positive integer");
        args.ceilingMinutes = n;
        break;
      }
      case "--validate":
        args.mode = "validate";
        args.validatePath = argv[++i] ?? fail("--validate requires a path");
        break;
      case "--reddit-only":
        args.mode = "reddit-only";
        break;
      case "--allow-ungrounded":
        args.allowUngrounded = true;
        break;
      default:
        fail(`unknown flag ${a} (see pgm --help)`);
    }
  }
  return args;
}

//#region --validate mode (RES-04 dry-run, NO write)

const SCHEMA_BY_SHAPE: Array<{ file: string; probe: (doc: unknown) => boolean }> = [
  { file: "pgm-personas.schema.json", probe: (d) => Array.isArray((d as { personas?: unknown })?.personas) },
  { file: "mined-frustrations.schema.json", probe: (d) => Array.isArray((d as { records?: unknown })?.records) },
  { file: "pitch-candidates.schema.json", probe: (d) => Array.isArray((d as { candidates?: unknown })?.candidates) },
];

export function validateArtifact(path: string): { valid: boolean; schema: string | null; errors: string[] } {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { valid: false, schema: null, errors: [`cannot read/parse ${path}: ${(err as Error).message}`] };
  }
  const match = SCHEMA_BY_SHAPE.find((m) => m.probe(doc));
  if (!match) {
    return { valid: false, schema: null, errors: ["unrecognized PGM artifact shape (expected personas|records|candidates array)"] };
  }
  const schemaPath = join(REPO_ROOT, "contracts", match.file);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
  const check = validate(schema, doc);
  return {
    valid: check.valid,
    schema: match.file,
    errors: check.errors.map((e) => `${e.path} ${e.message}`),
  };
}

//#endregion

//#region dispatch

/** Delegate refresh to the single owner of cache-refresh logic (§5.6). */
function runRefreshCache(args: CliArgs): number {
  const script = join(REPO_ROOT, "scripts", "refresh-cache.ts");
  if (!existsSync(script)) fail("refresh-cache helper scripts/refresh-cache.ts not found");
  const passthrough = [
    "--config",
    args.config,
    ...(args.subreddits ? ["--subreddits", args.subreddits] : []),
    ...(args.months !== undefined ? ["--months", String(args.months)] : []),
  ];
  console.log(`[pgm] refreshing tier-1 cache via scripts/refresh-cache.ts ...`);
  const r = spawnSync(process.execPath, [join(REPO_ROOT, "node_modules", "vite-node", "vite-node.mjs"), script, ...passthrough], {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });
  if (r.error) fail(`refresh-cache failed to launch: ${r.error.message}`);
  return r.status ?? 1;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    console.log(USAGE);
    return;
  }
  const args = parseArgv(argv);

  if (args.mode === "validate") {
    if (!args.validatePath) fail("--validate requires a file path");
    const result = validateArtifact(args.validatePath);
    if (result.valid) {
      console.log(`ok: ${args.validatePath} conforms to contracts/${result.schema}`);
      return;
    }
    console.error(`invalid: ${args.validatePath} (${result.schema ?? "no schema matched"})`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (args.mode === "refresh") {
    process.exit(runRefreshCache(args));
  }

  if (args.mode === "reddit-only") {
    // Reddit-only probe: mining is the module's reason to exist — verify the
    // endpoint (and report cache warmth) BEFORE any other work or LLM spend.
    console.log("[pgm] reddit-only probe: no stages will run, nothing else will be spent.");
    const firstSub = args.subreddits?.split(",")[0]?.trim();
    const result = await probeRedditAccess(firstSub ? { subreddit: firstSub } : {});
    if (!result.reachable) {
      console.error(`[pgm] RESULT: FAILED — Reddit unreachable; mining cannot produce evidence.`);
      process.exit(1);
    }
    console.log(
      `[pgm] RESULT: OK — Reddit reachable. Cache shards: ${result.cacheShards}` +
        (result.cacheShards === 0 ? " (cold — live API only; consider refresh-cache.ts)" : ""),
    );
    await closeBrowserFetch().catch(() => {}); // visible-Chrome lane: release the window
    return;
  }

  const overrides = {
    ...(args.personas !== undefined ? { personas: args.personas } : {}),
    ...(args.candidates !== undefined ? { candidates: args.candidates } : {}),
    withComments: args.withComments,
  };

  // --llm sweep: real LLM transport via run_sweep.sh --chat turns (Pi harness).
  // The child-turn budget stays 30s under the resilience cap so withResilience's
  // timeout never races a live driver process. Agentic turns take minutes — the
  // 15-minute per-call default ALWAYS applies on the sweep path (the DP-K §7.4
  // frozen 20/30/45 s defaults would time out every real turn).
  let transport: RoleCallOptions["transport"];
  let effectiveLlmTimeoutMs: number | undefined;
  if (args.llm === "sweep") {
    effectiveLlmTimeoutMs = args.llmTimeoutMs ?? 900_000;
    const childTimeoutMs = Math.max(60_000, effectiveLlmTimeoutMs - 30_000);
    console.log(
      `[pgm] llm=sweep role=${args.sweepRole} per_call_timeout_ms=${effectiveLlmTimeoutMs} turn_budget_ms=${childTimeoutMs}`,
    );
    transport = makeSweepTransport({ role: args.sweepRole, timeoutMs: childTimeoutMs });
  }

  if (args.mode === "run") {
    // `pgm run` requires the brief; stages resolve everything else from config.
    if (!args.brief && !existsSync(args.input ?? "")) fail("run requires --brief <file>");

    // PREFLIGHT (operator requirement): try Reddit BEFORE any other work —
    // mining is the module's goal; burning stage-1 LLM budget while no data
    // source can answer is waste. Abort unless explicitly overridden AND the
    // tier-1 cache has something to serve.
    const firstSub = args.subreddits?.split(",")[0]?.trim();
    const probe = await probeRedditAccess(firstSub ? { subreddit: firstSub } : {});
    if (!probe.reachable && probe.cacheShards === 0) {
      console.error(`[pgm] ABORTING before stage 1: Reddit unreachable AND local cache cold.`);
      console.error(`[pgm] Nothing can be mined — the run would produce placeholder-only artifacts.`);
      console.error(`[pgm] Fix options:`);
      console.error(`[pgm]   1. Disable VPN / use a residential connection, re-run.`);
      console.error(`[pgm]   2. Warm the cache: npx vite-node scripts/refresh-cache.ts --subreddits <a,b> --months 6`);
      console.error(`[pgm]   3. Force an ungrounded run anyway: add --allow-ungrounded`);
      process.exit(1);
    }
    if (!probe.reachable) {
      console.error(
        `[pgm] WARNING: live Reddit unreachable — proceeding on ${probe.cacheShards} warm cache shard(s) only.` +
          ` Add --allow-ungrounded to silence preflight strictness.`,
      );
    }

    if (args.refreshCache) process.exitCode = runRefreshCache(args); // best-effort pre-step; pipeline proceeds regardless
    const manifest = await runPgm({
      briefPath: args.brief,
      outDir: args.out,
      configPath: args.config,
      overrides,
      ...(transport ? { transport } : {}),
      ...(effectiveLlmTimeoutMs !== undefined ? { llmTimeoutMs: effectiveLlmTimeoutMs } : {}),
      ...(args.ceilingMinutes !== undefined
        ? { hardCeilingMs: args.ceilingMinutes * 60_000 }
        : {}),
    });
    console.log(
      `[pgm] status=${manifest.status} completed_stages=[${manifest.completed_stages}] grounded_fraction=${manifest.grounded_fraction} elapsed_ms=${manifest.elapsed_ms} -> ${join(args.out, "run.json")}`,
    );
    await closeBrowserFetch().catch(() => {}); // release the visible-Chrome lane, if engaged
    return; // degraded-but-zero: even partial_ceiling exits 0 (GOV-RES-01)
  }

  // Single-stage mode (PGM-13).
  if (args.stage === undefined || !args.input) fail("--stage and --input are both required to run a stage");
  if ((args.stage === 3 || args.stage === 4) && !args.brief) fail(`--stage ${args.stage} also requires --brief <file>`);
  const result = await runPgmStage({
    stage: args.stage,
    input: args.input,
    outDir: args.out,
    briefPath: args.brief,
    catalogPath: args.catalog,
    configPath: args.config,
    overrides,
    ...(transport ? { transport } : {}),
    ...(effectiveLlmTimeoutMs !== undefined ? { llmTimeoutMs: effectiveLlmTimeoutMs } : {}),
  });
  console.log(`[pgm] stage ${args.stage}: status=${result.status} -> ${join(args.out, "run.json")}`);
  await closeBrowserFetch().catch(() => {}); // release the visible-Chrome lane, if engaged
}

//#endregion

// Entry guard mirroring src/dev/mock/cli.ts: handles both node (argv[1] is this
// file) and vite-node (argv[1] is vite-node's cli.mjs; user args still start at
// index 2). VITEST workers are excluded so suites can import main() safely.
const argv1 = process.argv[1]?.replace(/\\/g, "/") ?? "";
const invokedDirectly = argv1.endsWith("src/pgm/cli.ts");
const invokedViaViteNode =
  argv1.includes("vite-node") &&
  process.env["CHASSIS_DISPATCH"] === undefined &&
  process.env["VITEST"] === undefined;
if (invokedDirectly || invokedViaViteNode) {
  main().catch((err) => {
    console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  });
}
