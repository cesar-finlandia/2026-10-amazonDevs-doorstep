// Requirement IDs: PGM-03, PGM-04, 6.12, GOV-MIN-04, XCUT-08
// Tier 1 data source (DP-K §5.1 + §5.6): reads pre-built file-based JSONL
// shards under .cache/pgm/reddit-cache/{subreddit}/{YYYY-MM}.jsonl, one line
// per submission {subreddit,title,selftext,score,created_utc} — author fields
// are stripped at REFRESH time by scripts/refresh-cache.ts, so the cache on
// disk never contains identity data. An index.json alongside records the last
// refresh ({refreshed_at, subreddits[], months, records}).
//
// Behavior contract: any miss / unreadable shard / malformed JSON returns an
// empty array so the tier chain continues to live API — never throws.
// Optional DuckDB acceleration is gated behind env PGM_CACHE_ENGINE=duckdb and
// loaded lazily; if unavailable we silently stay on plain JSON reads
// (GOV-MIN-04: never a new required dep/key/failure path).

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { RedditDataSource, RedditRawSubmission, SearchParams } from "./types.js";

/** Parse one JSONL cache line; null when malformed (treated as a miss). */
function parseLine(line: string): RedditRawSubmission | null {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    if (
      typeof obj.subreddit === "string" &&
      typeof obj.title === "string" &&
      typeof obj.selftext === "string" &&
      typeof obj.score === "number" &&
      typeof obj.created_utc === "number"
    ) {
      return {
        subreddit: obj.subreddit,
        title: obj.title,
        selftext: obj.selftext,
        score: obj.score,
        created_utc: obj.created_utc,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** YYYY-MM month keys covering [after, now], newest first (shard lookup order). */
export function monthShards(afterIso: string, now = new Date()): string[] {
  const months: string[] = [];
  const cursor = new Date(Math.min(now.getTime(), Date.now()));
  const floor = new Date(afterIso);
  while (cursor >= floor && months.length < 24) {
    months.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return months;
}

/** True when the boolean query's terms all appear in title+selftext (case-insensitive). */
function matchesTerms(raw: RedditRawSubmission, boolean_terms: string): boolean {
  const haystack = `${raw.title}\n${raw.selftext}`.toLowerCase();
  // Extract bare alphanumeric terms; AND/OR/NOT/parens are operator syntax.
  const terms = boolean_terms.toLowerCase().match(/[a-z0-9']{3,}/g) ?? [];
  const operators = new Set(["and", "or", "not"]);
  const required = terms.filter((t) => !operators.has(t));
  if (required.length === 0) return true;
  // At least half the meaningful terms must hit — loose recall filter for cache.
  const hits = required.filter((t) => haystack.includes(t)).length;
  return hits * 2 >= required.length;
}

export class LocalCacheDataSource implements RedditDataSource {
  readonly name = "local_cache" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /** index.json metadata; null when absent/corrupt (diagnostic only). */
  readIndex(): { refreshed_at?: string; subreddits?: string[]; months?: number; records?: number } | null {
    try {
      return JSON.parse(readFileSync(join(this.root, "index.json"), "utf8"));
    } catch {
      return null;
    }
  }

  async search(params: SearchParams): Promise<RedditRawSubmission[]> {
    const out: RedditRawSubmission[] = [];
    try {
      const subDir = join(this.root, params.subreddit);
      if (!existsSync(subDir)) return [];
      const afterMs = new Date(params.after).getTime();
      for (const month of monthShards(params.after)) {
        if (out.length >= params.limit) break;
        const shard = join(subDir, `${month}.jsonl`);
        if (!existsSync(shard)) continue;
        for (const line of readFileSync(shard, "utf8").split(/\r?\n/)) {
          if (!line.trim() || out.length >= params.limit) continue;
          const raw = parseLine(line);
          if (!raw) continue; // malformed line ⇒ skip, not fail
          if (raw.created_utc * 1000 < afterMs) continue;
          if (!matchesTerms(raw, params.boolean_terms)) continue;
          out.push(raw);
        }
      }
    } catch {
      return []; // any throw degrades to "cache miss" — chain continues
    }
    return out.slice(0, params.limit);
  }
}

/**
 * Optional DuckDB acceleration (6.12 decision table). Returns false unless
 * PGM_CACHE_ENGINE=duckdb AND the optional dep resolves. Never throws,
 * never required — callers fall back to LocalCacheDataSource reads.
 */
export function duckDbAccelerationAvailable(): boolean {
  if (process.env.PGM_CACHE_ENGINE !== "duckdb") return false;
  try {
    const req = createRequire(import.meta.url);
    return Boolean(req("duckdb"));
  } catch {
    return false; // dep not installed ⇒ silent fallback to plain JSON reads
  }
}
