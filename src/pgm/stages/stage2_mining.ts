// Requirement IDs: PGM-03, PGM-04, PGM-05, PGM-06, PGM-08, PGM-REU-02,
// PGM-RES-01, PGM-10, RES-01, GOV-RES-02, XCUT-08
// Stage 2 Market Mining (DP-K §5 / §10): personas.json → mined_frustrations.json
// via the tiered data-source chain, never blocking on any single tier.
//
// Per persona (in data_source.tiers order):
//   Tier 1 local cache  — callTier(...,{timeout_ms:3000, retries:0})
//   Tier 2 live API     — callTier(...,{timeout_ms:8000, retries:1,
//                                     backoff exponential base 500})
//   Tier 3 skip         — MinedRecord{grounded:false, excerpt:null, score:null,
//                         timestamp:null, source_tier:"skip_ungrounded"} + CONTINUE
// Disabled tiers are skipped, not failed (PGM-03). Every query is bounded by
// PGM-04 regardless of archive size: after = now − recency_window_months,
// limit = min(results_cap_per_subreddit, remaining persona cap), stopping at
// results_cap_per_persona then results_cap_global. Subset defaults to
// submissions; comments require env PGM_ENABLE_COMMENTS=1 AND
// mining.include_comments:true, and comment-derived records carry
// source_subset:"comments" + staleness_warning (PGM-05). Malformed payloads are
// a miss for that persona (warn + continue, §10). Output validates against
// contracts/mined-frustrations.schema.json before write (RES-04).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { validate } from "../../resilience/index.js";
import type { DegradedResult } from "../../resilience/index.js";
import { callTier } from "../resilientCall.js";
import { makeUngroundedMarker, toMinedRecord } from "../mining/ingest.js";
import type { MinedRecord } from "../mining/ingest.js";
import { resolveTiers } from "../mining/factory.js";
import type { ResolvedTier } from "../mining/factory.js";
import type { RedditDataSource, SearchParams } from "../mining/types.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
export const MINED_SCHEMA_PATH = join(REPO_ROOT, "contracts", "mined-frustrations.schema.json");

//#region Config slices (contracts/pgm-config.schema.json)

export interface MiningConfig {
  recency_window_months?: number;
  results_cap_per_persona?: number;
  results_cap_global?: number;
  results_cap_per_subreddit?: number;
  subset?: string;
  include_comments?: boolean;
}

export interface Stage2PgmConfig {
  mining?: MiningConfig;
  data_source?: Parameters<typeof resolveTiers>[0];
}

//#endregion

//#region Skeleton — filled in below by subsequent edits

export interface Stage2Options {
  /** personas.json path (Stage 1 output). Required unless personasDoc given. */
  inputPath?: string;
  /** Pre-parsed personas document (tests / in-memory pipelines). */
  personasDoc?: unknown;
  outDir: string;
  /** Full config/pgm.json content (mining + data_source slices). */
  config?: Stage2PgmConfig;
  /** Test injection: replaces the tier-1 cache source. */
  cacheSource?: RedditDataSource;
  /** Test injection: replaces the tier-2 live source. */
  liveSource?: RedditDataSource;
  /** Test injection: fixed clock for deterministic recency windows. */
  now?: Date;
}

export type Stage2Outcome =
  | { ok: true; data: unknown }
  | ({ ok: false } & DegradedResult);

export interface PersonaLike {
  id?: string;
  target_subreddits?: unknown;
  boolean_search_terms?: unknown;
}

export interface PersonasDoc {
  version?: string;
  generated_at?: string;
  source_brief_hash?: string;
  personas?: PersonaLike[];
}

/** Clamp helper honoring the DP-K §5.2 allowed ranges. */
function clampRange(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function degraded(reason: string, originalError: string): Stage2Outcome {
  return {
    ok: false,
    degraded: true,
    reason,
    fallback_source: "none",
    original_error: originalError,
    data: null,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
}

/** Operator-facing transparency counters (post-field-feedback requirement:
 *  a mining step that never reached any Reddit source is a FAILURE, not a
 *  completed step — surface every attempt loudly). */
export interface TierStats {
  queries: number;
  attemptsByTier: Record<string, number>;
  hitsByTier: Record<string, number>;
  failuresByTier: Record<string, number>;
}

function emptyStats(): TierStats {
  return { queries: 0, attemptsByTier: {}, hitsByTier: {}, failuresByTier: {} };
}

/**
 * Run ONE bounded query down the tier chain in data_source.tiers order.
 * Disabled tiers are skipped (not failed); every enabled tier's search runs
 * inside callTier (RES-01) with its per-tier policy. First tier returning ≥1
 * raw wins. Returns null when every tier misses/fails (caller decides marker).
 * Every attempt prints a one-line verdict so blocked/broken Reddit access is
 * visible live instead of surfacing as a silent placeholder-only artifact.
 */
async function searchTiers(
  tiers: ResolvedTier[],
  params: SearchParams,
  stats: TierStats,
): Promise<{ tier: string; raws: Awaited<ReturnType<RedditDataSource["search"]>> } | null> {
  stats.queries += 1;
  const label = `r/${params.subreddit}${params.subset === "comments" ? " [comments]" : ""}`;
  for (const tier of tiers) {
    if (!tier.enabled || !tier.source || tier.key === "skip_ungrounded") continue;
    stats.attemptsByTier[tier.key] = (stats.attemptsByTier[tier.key] ?? 0) + 1;
    const outcome = await callTier(() => tier.source!.search(params), {
      timeoutMs: tier.timeout_ms,
      retries: tier.retries,
      ...(tier.backoff_base_ms !== undefined ? { backoffBaseMs: tier.backoff_base_ms } : {}),
    });
    if (outcome.ok && outcome.data.length > 0) {
      stats.hitsByTier[tier.key] = (stats.hitsByTier[tier.key] ?? 0) + 1;
      console.log(`[pgm:stage2] ${label}: tier ${tier.key} -> ${outcome.data.length} raw record(s)`);
      return { tier: tier.key, raws: outcome.data };
    }
    if (outcome.ok) {
      console.log(`[pgm:stage2] ${label}: tier ${tier.key} -> miss (0 results)`);
    } else {
      stats.failuresByTier[tier.key] = (stats.failuresByTier[tier.key] ?? 0) + 1;
      console.log(
        `[pgm:stage2] ${label}: tier ${tier.key} -> NO RESPONSE (${outcome.reason}${outcome.original_error ? `: ${outcome.original_error}` : ""})`,
      );
    }
    // degraded outcome OR empty hit ⇒ continue to next tier (PGM-03)
  }
  return null;
}

export async function runStage2(opts: Stage2Options): Promise<Stage2Outcome> {
  // 1) Personas input — Stage 1 output (PGM-13: re-runnable vs own input file).
  let doc: PersonasDoc;
  try {
    const raw = opts.personasDoc ?? JSON.parse(readFileSync(opts.inputPath as string, "utf8"));
    doc = raw as PersonasDoc;
  } catch (err) {
    return degraded("input_unreadable", `cannot read personas input: ${(err as Error).message}`);
  }
  const personas = Array.isArray(doc.personas) ? doc.personas : [];

  mkdirSync(opts.outDir, { recursive: true });

  // 2) PGM-04 bounds on EVERY query regardless of archive size.
  const mining = opts.config?.mining ?? {};
  const months = clampRange(mining.recency_window_months ?? 6, 1, 12);
  const capGlobal = clampRange(mining.results_cap_global ?? 200, 20, 500);
  const capPersona = clampRange(mining.results_cap_per_persona ?? 30, 5, 50);
  const capSubreddit = clampRange(mining.results_cap_per_subreddit ?? 15, 5, 30);
  const now = opts.now ?? new Date();
  const afterDate = new Date(now);
  afterDate.setUTCMonth(afterDate.getUTCMonth() - months);
  const recencyWindow = {
    months,
    after: afterDate.toISOString(),
    before: now.toISOString(),
  };

  // 3) Subset selection (PGM-05): submissions default; comments require BOTH
  //    env PGM_ENABLE_COMMENTS=1 AND config mining.include_comments:true.
  const commentsEnabled = process.env.PGM_ENABLE_COMMENTS === "1" && mining.include_comments === true;
  const headerSubset = commentsEnabled ? "submissions+comments" : "submissions";

  // 4) Tier chain — provider branching lives ONLY in factory (PGM-REU-02).
  const tiers = resolveTiers(opts.config?.data_source ?? {}, {
    cacheSource: opts.cacheSource,
    liveSource: opts.liveSource,
  });

  // 5) Mine per persona, never blocking on any single tier (PGM-03/RES-01).
  let idCounter = 0;
  const nextId = (): string => `frust-${String(++idCounter).padStart(4, "0")}`;
  const records: MinedRecord[] = [];
  let globalRemaining = capGlobal;
  const stats = emptyStats();

  for (const persona of personas) {
    const personaId = typeof persona.id === "string" ? persona.id : "persona-00";
    if (globalRemaining <= 0) {
      records.push(makeUngroundedMarker(personaId, nextId())); // global cap: no more queries
      continue;
    }
    const subs = Array.isArray(persona.target_subreddits)
      ? (persona.target_subreddits as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    // Models emit boolean_search_terms either as an array of fragments or as
    // one plain string — accept BOTH (string form was silently dropped before,
    // yielding empty queries and guaranteed zero-record mining).
    const rawTerms = persona.boolean_search_terms;
    const terms = Array.isArray(rawTerms)
      ? (rawTerms as unknown[]).filter((t): t is string => typeof t === "string").join(" OR ")
      : typeof rawTerms === "string"
        ? rawTerms
        : "";
    console.log(
      `[pgm:stage2] persona ${personaId}: mining ${subs.length} subreddit(s): ${subs.join(", ") || "(none)"}`,
    );
    let personaRemaining = capPersona;
    let personaGrounded = false;

    for (const subreddit of subs) {
      if (personaRemaining <= 0 || globalRemaining <= 0) break;
      const subsets: Array<"submissions" | "comments"> = commentsEnabled
        ? ["submissions", "comments"]
        : ["submissions"];
      for (const subset of subsets) {
        if (personaRemaining <= 0 || globalRemaining <= 0) break;
        const params: SearchParams = {
          subreddit,
          boolean_terms: terms,
          after: recencyWindow.after,
          limit: Math.min(capSubreddit, personaRemaining, globalRemaining),
          subset,
        };
        const hit = await searchTiers(tiers, params, stats);
        if (!hit) continue; // all tiers missed for this query
        let accepted = 0;
        for (const raw of hit.raws) {
          if (accepted >= params.limit) break;
          const rec = toMinedRecord(raw, personaId, {
            source_tier: hit.tier === "live_api" ? "live_api" : "local_cache",
            source_subset: subset,
            id: nextId(),
          });
          if (!rec) {
            // Malformed payload ⇒ miss for this record (DP-K §10 last row).
            console.warn(`[pgm:stage2] warning: reddit payload malformed, skipping (${subreddit})`);
            continue;
          }
          records.push(rec);
          accepted += 1;
        }
        if (accepted > 0) {
          personaGrounded = true;
          personaRemaining -= accepted;
          globalRemaining -= accepted;
        }
      }
    }
    if (!personaGrounded) {
      // Tier 3: skip grounding for this persona — never blocks (PGM-03.3).
      records.push(makeUngroundedMarker(personaId, nextId(), subs[0]));
    }
  }

  // 6) Header + RES-04 validation BEFORE write.
  const briefHash =
    typeof doc.source_brief_hash === "string" && /^[a-f0-9]{64}$/.test(doc.source_brief_hash)
      ? doc.source_brief_hash
      : createHash("sha256").update("").digest("hex");
  const out = {
    version: "1.0.0" as const,
    generated_at: now.toISOString(),
    source_brief_hash: briefHash,
    recency_window: recencyWindow,
    subset: headerSubset,
    records,
  };
  const schema = JSON.parse(readFileSync(MINED_SCHEMA_PATH, "utf8")) as object;
  const check = validate(schema, out);
  if (!check.valid) {
    // RES-06 salvage: write a schema-valid EMPTY mined document so S3/S4 can
    // still proceed ungrounded (DP-K §12 PGM-AC-02 variant — a stage-2 degrade
    // never blocks the pipeline; nothing survived validation ⇒ fully
    // ungrounded downstream). The DegradedResult still reports the failure.
    const salvaged = { ...out, records: [] };
    if (validate(schema, salvaged).valid) {
      writeFileSync(join(opts.outDir, "mined_frustrations.json"), JSON.stringify(salvaged, null, 2) + "\n");
    }
    return degraded(
      "validation_repair_failed",
      `mined_frustrations failed RES-04: ${check.errors.map((e) => `${e.path} ${e.message}`).join("; ")}`,
    );
  }

  // 7) HONEST verdict + write output + stage manifest.
  // A mining step that never received a single record from any Reddit source
  // (cache cold AND live API unreachable/blocked/empty) is a FAILURE of the
  // mining goal — never report it as a completed step (operator requirement).
  const groundedCount = records.filter((r) => r.grounded).length;
  const noRedditData = groundedCount === 0;
  if (noRedditData) {
    console.error(`[pgm:stage2] ==============================================================`);
    console.error(
      `[pgm:stage2] MINING FAILED: ${personas.length} persona(s), ${stats.queries} quer(y/ies), ZERO evidence records.`,
    );
    const tierLine = Object.keys(stats.attemptsByTier)
      .map((k) => `${k}: ${stats.hitsByTier[k] ?? 0} hit(s) / ${stats.failuresByTier[k] ?? 0} failure(s) / ${stats.attemptsByTier[k]} attempt(s)`)
      .join(" | ");
    console.error(`[pgm:stage2] Per-tier outcome: ${tierLine || "(no enabled tier attempted)"}`);
    console.error(`[pgm:stage2] CAUSE: no Reddit data source returned any content —`);
    console.error(`[pgm:stage2]   local cache cold and/or live API unreachable or IP-blocked.`);
    console.error(`[pgm:stage2] FIX: warm the cache from a RESIDENTIAL connection (VPN OFF):`);
    console.error(`[pgm:stage2]   npx vite-node scripts/refresh-cache.ts --subreddits <a,b> --months 6`);
    console.error(`[pgm:stage2] Probe first: npx vite-node src/pgm/cli.ts --reddit-only`);
    console.error(`[pgm:stage2] Downstream stages will run UNGROUNDED (placeholder evidence).`);
    console.error(`[pgm:stage2] ==============================================================`);
  }

  writeFileSync(join(opts.outDir, "mined_frustrations.json"), JSON.stringify(out, null, 2) + "\n");
  writeFileSync(
    join(opts.outDir, "run.json"),
    JSON.stringify(
      {
        module: "pgm",
        stage: 2,
        status: noRedditData ? "stage2_failed_no_reddit_data" : "stage2_complete",
        flags: { comments_enabled: commentsEnabled },
        grounded_count: groundedCount,
        ungrounded_count: records.filter((r) => !r.grounded).length,
        tier_stats: stats,
        generated_at: now.toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  return { ok: true, data: out };
}

//#endregion
