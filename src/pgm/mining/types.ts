// Requirement IDs: PGM-03, PGM-REU-02, 6.12, XCUT-08
// Reddit data-source abstraction for Stage 2 Market Mining (DP-K §5).
// Every tier (local cache / live API) implements the SAME RedditDataSource
// interface so the provider swap in factory.ts is config-only (PGM-REU-02):
// orchestration calls search() and never branches on the concrete provider.
//
// Raw shape mirrors what the Reddit JSON API actually returns — INCLUDING
// author/author_fullname. Identity stripping happens exclusively at ingest
// time (src/pgm/mining/ingest.ts toMinedRecord), never inside a source.

/** Which Reddit subset a query targets (PGM-05: submissions default). */
export type RedditSubset = "submissions" | "comments";

/** Per-persona, per-subreddit query parameters bounded by PGM-04 caps. */
export interface SearchParams {
  /** Subreddit name without the r/ prefix, e.g. "EtsySellers". */
  subreddit: string;
  /** Boolean search string from the persona, e.g. "(a AND b) OR c NOT d". */
  boolean_terms: string;
  /** Recency window lower bound (ISO date-time); queries never look earlier. */
  after: string;
  /** Max results this call may return (already min-ed with remaining cap). */
  limit: number;
  /** Submissions by default; comments only via explicit opt-in (PGM-05). */
  subset: RedditSubset;
}

/**
 * Raw submission record as returned by a source BEFORE ingestion. Carries
 * author/author_fullname because that is what the raw API/cache line holds;
// ingest.ts destructures them out FIRST so they are never stored or logged.
 */
export interface RedditRawSubmission {
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  /** Unix epoch seconds, as the Reddit API returns. */
  created_utc: number;
  author?: unknown;
  author_fullname?: unknown;
}

/**
 * The single data-source contract (DP-K §5.5). Implementations:
 *   LocalCacheDataSource — tier 1 file-based JSONL shards (6.12)
 *   LiveApiDataSource    — tier 2 Reddit JSON API
 *   TieredDataSource     — composite chain used by orchestration
 *   NullDataSource       — "none-skip" provider for unit tests
 */
export interface RedditDataSource {
  search(params: SearchParams): Promise<RedditRawSubmission[]>;
}
