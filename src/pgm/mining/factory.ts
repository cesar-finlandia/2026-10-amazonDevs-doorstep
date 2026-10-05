// Requirement IDs: PGM-REU-02, PGM-03, 6.12, XCUT-08
// Data-source factory (DP-K §5.5): THE swap point for provider selection.
//
//   provider "tiered" (default) → TieredDataSource(localCache, liveApi)
//   provider "local-cache-only" → LocalCacheDataSource alone
//   provider "live-api-only"    → LiveApiDataSource alone
//   provider "none-skip"        → NullDataSource (unit tests / tier-3-only runs)
//
// Orchestration only ever calls RedditDataSource.search() — it must NEVER
// branch on the provider value itself; swapping is config-only.
// Tier order comes from data_source.tiers and is honored by TieredDataSource.

import { LocalCacheDataSource } from "./localCache.js";
import { LiveApiDataSource } from "./liveApi.js";
export { LocalCacheDataSource } from "./localCache.js";
export { LiveApiDataSource } from "./liveApi.js";
import type {
  RedditDataSource,
  RedditRawSubmission,
  SearchParams,
} from "./types.js";

/** Minimal config slice this factory needs (contracts/pgm-config.schema.json). */
export interface DataSourceConfig {
  provider?: string;
  tiers?: string[];
  local_cache?: { enabled?: boolean; timeout_ms?: number; path?: string };
  live_api?: {
    enabled?: boolean;
    timeout_ms?: number;
    retries?: number;
    provider?: string;
    credentials_env?: string;
  };
  skip_ungrounded?: { enabled?: boolean };
}

/** Always-empty source: models "none-skip" so every persona lands on tier 3. */
export class NullDataSource implements RedditDataSource {
  readonly name = "none_skip" as const;
  async search(_params: SearchParams): Promise<RedditRawSubmission[]> {
    return [];
  }
}

/**
 * Composite chain honoring data_source.tiers as single source of truth.
 * Each tier's search is attempted in configured order; first tier returning
 * ≥1 record wins. Misses/throws fall through — never throws upward.
 * NOTE: resilientCall (RES-01) wrapping happens at the STAGE level around each
 * tier call with per-tier timeout/retry config; this class provides the
 * per-tier sources plus a combined view used by simple callers/tests.
 */
export class TieredDataSource implements RedditDataSource {
  readonly name = "tiered" as const;
  readonly cacheSource: RedditDataSource;
  readonly liveSource: RedditDataSource;
  readonly tierOrder: string[];

  constructor(
    cacheSource: RedditDataSource,
    liveSource: RedditDataSource,
    tierOrder: string[] = ["local_cache", "live_api", "skip_ungrounded"],
  ) {
    this.cacheSource = cacheSource;
    this.liveSource = liveSource;
    this.tierOrder = tierOrder;
  }

  async search(params: SearchParams): Promise<RedditRawSubmission[]> {
    for (const tier of this.tierOrder) {
      if (tier === "skip_ungrounded") return []; // terminal marker handled by stage
      const source = tier === "live_api" ? this.liveSource : this.cacheSource;
      try {
        const hits = await source.search(params);
        if (hits.length > 0) return hits;
      } catch {
        // individual tier failure ⇒ continue to next tier (never blocks)
      }
    }
    return [];
  }
}

/**
 * createDataSource — build the provider named by config.data_source.provider
 * without touching orchestration code (PGM-REU-02 mirrors MED-03).
 */
export function createDataSource(cfg: DataSourceConfig = {}): RedditDataSource {
  const provider = cfg.provider ?? "tiered";
  if (provider === "none-skip") return new NullDataSource();
  if (provider === "local-cache-only") {
    return new LocalCacheDataSource(cfg.local_cache?.path ?? ".cache/pgm/reddit-cache");
  }
  if (provider === "live-api-only") {
    return new LiveApiDataSource({ credentialsEnv: cfg.live_api?.credentials_env });
  }
  // default "tiered": compose both, honoring disabled flags
  const cache =
    cfg.local_cache?.enabled === false
      ? new NullDataSource()
      : new LocalCacheDataSource(cfg.local_cache?.path ?? ".cache/pgm/reddit-cache");
  const live =
    cfg.live_api?.enabled === false
      ? new NullDataSource()
      : new LiveApiDataSource({ credentialsEnv: cfg.live_api?.credentials_env });
  return new TieredDataSource(cache, live, cfg.tiers ?? ["local_cache", "live_api", "skip_ungrounded"]);
}

//#region Per-tier resolution for Stage 2 orchestration

/** Per-tier resilience policy from config/pgm.json resilience.stage2_tier1/2. */
export interface ResolvedTier {
  /** Tier key exactly as named in data_source.tiers. */
  key: string;
  enabled: boolean;
  /** null for skip_ungrounded (pure marker — no I/O) or when disabled. */
  source: RedditDataSource | null;
  timeout_ms: number;
  retries: number;
  backoff_base_ms?: number;
}

export interface ResolveTiersOverrides {
  cacheSource?: RedditDataSource;
  liveSource?: RedditDataSource;
}

/**
 * resolveTiers — map data_source.tiers order onto concrete sources + the
 * DP-K §5.1 resilience table (tier1 {3000ms, retries 0}; tier2 {8000ms,
 * retries 1, exponential backoff base 500}). Provider selection branches ONLY
 * here — stage orchestration consumes ResolvedTier[] and never inspects the
 * provider string (PGM-REU-02 swap point). Overrides exist purely for tests.
 */
export function resolveTiers(
  cfg: DataSourceConfig = {},
  overrides: ResolveTiersOverrides = {},
): ResolvedTier[] {
  const provider = cfg.provider ?? "tiered";
  const order = cfg.tiers ?? ["local_cache", "live_api", "skip_ungrounded"];
  const cacheEnabled = cfg.local_cache?.enabled !== false && provider !== "live-api-only" && provider !== "none-skip";
  const liveEnabled = cfg.live_api?.enabled !== false && provider !== "local-cache-only" && provider !== "none-skip";
  const cachePath = cfg.local_cache?.path ?? ".cache/pgm/reddit-cache";
  return order.map((key) => {
    if (key === "skip_ungrounded") {
      // Terminal tier: pure marker record — always "enabled", never I/O.
      return { key, enabled: true, source: null, timeout_ms: 0, retries: 0 };
    }
    if (key === "live_api") {
      return {
        key,
        enabled: liveEnabled,
        source: overrides.liveSource ?? new LiveApiDataSource({ credentialsEnv: cfg.live_api?.credentials_env }),
        timeout_ms: cfg.live_api?.timeout_ms ?? 8000,
        retries: cfg.live_api?.retries ?? 1,
        backoff_base_ms: 500,
      };
    }
    // default/local_cache
    return {
      key: "local_cache",
      enabled: cacheEnabled,
      source: overrides.cacheSource ?? new LocalCacheDataSource(cachePath),
      timeout_ms: cfg.local_cache?.timeout_ms ?? 3000,
      retries: 0,
    };
  });
}

//#endregion
