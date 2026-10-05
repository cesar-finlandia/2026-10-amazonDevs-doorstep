// Requirement IDs: PGM-03, PGM-04, PGM-05, PGM-K2-01..04, 6.12, XCUT-08
// Tier 2 data source (DP-K §5.1 + §5.6; keyless delta DP-K2 §4–§5): Reddit
// JSON search. TWO transport modes, selected per-request by token presence:
//
//   REDDIT_API_TOKEN set (optional fallback, PGM-K2-04 — exactly as pre-DP-K2):
//     GET https://oauth.reddit.com/r/{sub}/search?q={encoded boolean_terms}
//         &after={after}&limit={cap}&sort=relevance&type=link
//     Authorization: Bearer ${credentials_env}   (default REDDIT_API_TOKEN)
//
//   REDDIT_API_TOKEN absent (the permanent normal case, PGM-K2-01):
//     GET https://www.reddit.com/r/{sub}/search.json?q={encoded boolean_terms}
//         &t={hour|day|week|month|year|all}&limit={cap}&sort=relevance
//         &type=link&raw_json=1
//     User-Agent: chassis-pgm/1.0.0 (tier-2 market-mining fetch; personal hackathon research)
//     NO Authorization header is ever sent (PGM-K2-AC-01 guard test).
//
// The public search endpoint has no `after=` param (DP-K2 §4.2), so recency is
// enforced as a coarse `t=` time bucket + client-side created_utc filter.
// The bucket is derived from params.after (= now − mining.recency_window_months,
// computed by stage2_mining.ts), preserving PGM-04 semantics:
//   cutoff_utc = Date.parse(params.after); keep child iff created_utc*1000 >= cutoff.
// Bucket spans: ≤24h→hour · ≤7d→day · ≤31d→week · ≤6mo→month · ≤12mo→year · else all.
//
// Both endpoints return the identical listing envelope ({data:{children[]}}),
// so normalizeChild() and ingest-side author stripping are unchanged (PGM-06).
//
// Comments subset (PGM-05 opt-in) uses the same endpoint with type=comment and
// reads `body` into selftext; callers must have already gated on
// env PGM_ENABLE_COMMENTS=1 AND config mining.include_comments:true — this
// module only shapes the request. All network I/O is executed by the injected
// fetcher so tests never touch the network and orchestration can wrap every
// call in resilientCall (PGM-10: no raw fetch anywhere else in src/pgm).
// Any non-2xx / malformed payload maps to [] (miss) — the tier chain continues.

import type { RedditDataSource, RedditRawSubmission, SearchParams } from "./types.js";
import { browserGet } from "./browserFetch.js";

/** Injectable transport: same shape as global fetch (tests inject mocks). */
export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** Descriptive UA mandated by DP-K2 §4.3 — generic UAs get instant 403s. */
const USER_AGENT = "chassis-pgm/1.0.0 (tier-2 market-mining fetch; personal hackathon research)";

interface RedditListingChild {
  data?: Record<string, unknown>;
}

/** Normalize one Reddit listing child into a RedditRawSubmission; null if unusable. */
function normalizeChild(child: unknown, fallbackSubreddit: string): RedditRawSubmission | null {
  const data = (child as RedditListingChild | undefined)?.data;
  if (!data || typeof data !== "object") return null;
  const subreddit = typeof data.subreddit === "string" ? data.subreddit : fallbackSubreddit;
  const title = typeof data.title === "string" ? data.title : "";
  const body = typeof data.body === "string" ? data.body : "";
  const selftext = typeof data.selftext === "string" ? data.selftext : body;
  const score = typeof data.score === "number" ? data.score : 0;
  const created = typeof data.created_utc === "number" ? data.created_utc : NaN;
  if (!subreddit || Number.isNaN(created)) return null; // malformed payload ⇒ miss
  // Raw passthrough INCLUDING author fields — ingest.ts strips them (PGM-06).
  return {
    subreddit,
    title,
    selftext,
    score,
    created_utc: created,
    author: data.author,
    author_fullname: data.author_fullname,
  };
}

/** Coarse public-search time bucket for a window span (DP-K2 §4.2). */
function timeBucket(windowMs: number): "hour" | "day" | "week" | "month" | "year" | "all" {
  const HOUR_MS = 3_600_000;
  const DAY_MS = 24 * HOUR_MS;
  const MONTH_MS = 30 * DAY_MS;
  if (windowMs <= 24 * HOUR_MS) return "hour";
  if (windowMs <= 7 * DAY_MS) return "day";
  if (windowMs <= 31 * DAY_MS) return "week";
  if (windowMs <= 6 * MONTH_MS) return "month";
  if (windowMs <= 12 * MONTH_MS) return "year";
  return "all";
}

//#region Query relaxation ladder (field finding: LLM-written Google-style
//#region AND-chains return ZERO results on Reddit's pseudo-boolean search even
// in huge subreddits; recall requires progressively looser variants).

/** Drop every `NOT <term>` clause — exclusions are the cheapest thing to lose. */
function relaxDropNot(q: string): string {
  return q
    .replace(/\bNOT\s+(?:"[^"]*"|[\w"-]+)/gi, "")
    .replace(/\bAND\b\s*(?=\()/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Flatten to an OR of core terms: quoted phrases kept whole, long AND-chains
 *  collapsed so ANY term matches (Reddit treats most syntax loosely anyway). */
function relaxOrTerms(q: string): string {
  const terms: string[] = [];
  const push = (t: string): void => {
    const v = t.trim();
    if (v.length > 1 && !terms.some((x) => x.toLowerCase() === v.toLowerCase())) terms.push(v);
  };
  for (const m of q.matchAll(/"([^"]+)"/g)) push(`"${m[1]}"`);
  const bare = q.replace(/"[^"]*"/g, " ").replace(/\b(?:AND|OR|NOT)\b/gi, " ");
  for (const w of bare.split(/[^A-Za-z0-9_+-]+/)) if (w.length > 2) push(w);
  return terms.slice(0, 8).join(" OR ");
}

/** Variants tried in order until one returns ≥1 child (keyless path only). */
export function queryVariants(booleanTerms: string): string[] {
  const full = booleanTerms.trim();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [full, relaxDropNot(full), relaxOrTerms(full)]) {
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

//#endregion

export class LiveApiDataSource implements RedditDataSource {
  readonly name = "live_api" as const;
  private readonly credentialsEnv: string;
  private readonly fetcher: FetchLike | undefined;
  /** Set once the embedded-Chrome fallback has been engaged this process. */
  private browserFallbackAnnounced = false;

  constructor(opts: { credentialsEnv?: string; fetcher?: FetchLike } = {}) {
    this.credentialsEnv = opts.credentialsEnv ?? "REDDIT_API_TOKEN";
    // fetcher omitted ⇒ production (global fetch); injected ⇒ tests, and the
    // browser fallback must NEVER engage under mocks.
    this.fetcher = opts.fetcher ?? globalThis.fetch;
    this.browserEligible = opts.fetcher === undefined;
  }
  private readonly browserEligible: boolean;

  async search(params: SearchParams): Promise<RedditRawSubmission[]> {
    const token = process.env[this.credentialsEnv];
    if (typeof this.fetcher !== "function") return []; // no transport ⇒ miss, not throw
    const type = params.subset === "comments" ? "comment" : "link";
    const limit = Math.max(1, Math.min(100, Math.round(params.limit)));
    // Token present → optional authenticated fallback (PGM-K2-04), unchanged.
    // Absent → silent keyless default (PGM-K2-01); never an error or warning.
    const useOAuth = Boolean(token);
    // Keyless Reddit search is pseudo-boolean: LLM-written AND-chains of rare
    // phrases deterministically return ZERO children. Try the full query, then
    // progressively looser variants until something answers (recall ladder).
    const variants = useOAuth
      ? [params.boolean_terms]
      : queryVariants(params.boolean_terms);

    // Build one URL per relaxation variant up front: the direct pass runs the
    // ladder first; if it yields NOTHING (Reddit's soft-throttle serves
    // HTTP 200 + empty listings to flagged fingerprints — field-verified), the
    // embedded visible-Chrome lane replays the same ladder with a different
    // client fingerprint.
    const urls = variants.map(
      (qText) =>
        useOAuth
          ? `https://oauth.reddit.com/r/${encodeURIComponent(params.subreddit)}/search` +
            `?q=${encodeURIComponent(qText)}&after=${encodeURIComponent(params.after.slice(0, 10))}` +
            `&limit=${limit}&sort=relevance&type=${type}`
          : `https://www.reddit.com/r/${encodeURIComponent(params.subreddit)}/search.json` +
            `?q=${encodeURIComponent(qText)}&t=${timeBucket(Math.max(0, Date.now() - Date.parse(params.after)))}` +
            `&limit=${limit}&sort=relevance&type=${type}&raw_json=1`,
    );

    let sawDirectEmpty = false;
    let sawHardBlock = false;
    for (let vi = 0; vi < variants.length; vi++) {
      try {
        const res = await this.fetcher(urls[vi]!, {
          headers: useOAuth
            ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
            : { "User-Agent": USER_AGENT, Accept: "application/json" },
        });
        if (!res.ok) {
          sawHardBlock = true;
          continue; // hard block / rate limit ⇒ next variant; lane pass handles it
        }
        const payload = await res.json();
        const out = this.filterChildren(payload, params, useOAuth);
        if (out.length > 0) return this.reportRelaxed(out, params, vi, limit);
        sawDirectEmpty = true; // 200 but zero children — soft-throttle signature
      } catch {
        sawHardBlock = true; // network error — the lane may still get through
        continue;
      }
    }

    // Direct pass produced nothing. Keyless production only: replay the SAME
    // ladder through the visible-Chrome lane (different fingerprint). OAuth
    // mode and injected test fetchers never reach this.
    if (!useOAuth && this.browserEligible && (sawDirectEmpty || sawHardBlock)) {
      if (!this.browserFallbackAnnounced) {
        console.warn(
          `[pgm:stage2] direct Reddit returned ONLY empty listings (soft-throttle) — replaying the query ladder through embedded VISIBLE Chrome window (disable: PGM_BROWSER_FETCH=0)`,
        );
        this.browserFallbackAnnounced = true;
      }
      for (let vi = 0; vi < variants.length; vi++) {
        const bodyText = await this.browserFallback(urls[vi]!);
        if (bodyText === null) continue;
        const out = this.parseListing(bodyText, params);
        if (out.length > 0) return this.reportRelaxed(out, params, vi, limit);
      }
    }
    console.warn(
      `[pgm:stage2] r/${params.subreddit}: live_api exhausted — variants=${variants.length} direct_empty=${sawDirectEmpty} direct_block=${sawHardBlock} lane_eligible=${this.browserEligible}`,
    );
    return []; // every variant × every transport missed ⇒ miss; chain continues
  }

  private reportRelaxed(
    out: RedditRawSubmission[],
    params: SearchParams,
    variantIndex: number,
    limit: number,
  ): RedditRawSubmission[] {
    if (variantIndex > 0) {
      console.log(
        `[pgm:stage2] r/${params.subreddit}: full query returned nothing — relaxed (level ${variantIndex}) -> ${out.length} raw record(s)`,
      );
    }
    return out.slice(0, limit);
  }

  /** Embedded visible-Chrome fallback; returns raw body text or null (loudly). */
  private async browserFallback(url: string): Promise<string | null> {
    if (!this.browserFallbackAnnounced) {
      console.warn(
        `[pgm:stage2] direct Reddit fetch blocked (403/429) — falling back to embedded VISIBLE Chrome window (disable: PGM_BROWSER_FETCH=0)`,
      );
      this.browserFallbackAnnounced = true;
    }
    const b = await browserGet(url);
    if (!b.ok || typeof b.text !== "string") {
      // NEVER swallow a lane failure silently: a silent miss is indistinguishable
      // from "subreddit has no posts" and corrupts the operator's mental model.
      console.warn(
        `[pgm:stage2] browser lane FAILED for ${url.slice(0, 90)}… — HTTP ${b.status || "n/a"}${b.error ? ` (${b.error})` : ""}`,
      );
      return null;
    }
    return b.text;
  }

  private parseListing(bodyText: string, params: SearchParams): RedditRawSubmission[] {
    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      // HTTP 200 but NOT Reddit JSON — typically a soft-block/rate-limit
      // interstitial served as HTML after rapid automated hits. Never silent:
      // a quiet miss is indistinguishable from "no posts" and hides the cause.
      const snippet = bodyText.trim().slice(0, 80).replace(/\s+/g, " ");
      console.warn(
        `[pgm:stage2] browser-lane payload was not Reddit JSON (starts "${snippet}") — treating as miss; slow down / wait a minute and retry`,
      );
      return []; // malformed payload ⇒ miss (DP-K §10)
    }
    return this.filterChildren(payload, params, false);
  }

  private filterChildren(
    payload: unknown,
    params: SearchParams,
    useOAuth: boolean,
  ): RedditRawSubmission[] {
    const children = Array.isArray((payload as { data?: { children?: unknown[] } })?.data?.children)
      ? ((payload as { data: { children: unknown[] } }).data.children as unknown[])
      : [];
    // Client-side recency filter restores exact PGM-04 semantics that the
    // coarse t= bucket over-fetches (public search has no after=, DP-K2 §4.2).
    const cutoffMs = Date.parse(params.after);
    const out: RedditRawSubmission[] = [];
    for (const child of children) {
      const raw = normalizeChild(child, params.subreddit);
      if (!raw) continue;
      if (!useOAuth && Number.isFinite(cutoffMs) && raw.created_utc * 1000 < cutoffMs) continue;
      out.push(raw);
    }
    return out.slice(0, params.limit);
  }
}
