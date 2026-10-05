// Requirement IDs: PGM-K2-01, PGM-K2-03, PGM-K2-05, PGM-RES-01, GOV-RES-02
// Reddit reachability probe (operator demand, post-DP-K2 field feedback):
// mining is the module's ONLY reason to exist — running stages 1/3/4 while no
// Reddit data source can possibly answer wastes minutes of agentic LLM budget
// and yields placeholder-only artifacts that must never be presented as a
// completed step. The probe contacts the public keyless endpoint FIRST, with
// explicit per-attempt console reporting ("Trying to contact ...",
// "No response - retry NN/MM"), and reports the state of the tier-1 local
// cache so the operator can distinguish "live blocked but cache warm" from
// "nothing to mine from at all".
//
// UA format per DP-K2 §4.3 (descriptive, static, purpose-bearing).

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { browserGet } from "./browserFetch.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
export const PROBE_UA =
  "chassis-pgm/1.0.0 (reddit reachability probe; personal hackathon research)";

export interface ProbeOptions {
  /** Subreddit used for the live check (default: watchlist head / EtsySellers). */
  subreddit?: string;
  attempts?: number;
  timeoutMs?: number;
  cacheDir?: string;
  /**
   * Embedded visible-Chrome fallback after direct attempts fail (default:
   * enabled unless PGM_BROWSER_FETCH=0). Tests disable it explicitly.
   */
  browserFallback?: boolean;
  /** Test injection: same shape as global fetch. */
  fetcher?: (url: string, init?: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
    ok: boolean;
    status: number;
  }>;
  log?: (line: string) => void;
}

export interface ProbeResult {
  reachable: boolean;
  httpStatus: number | null;
  attemptsUsed: number;
  latencyMs: number | null;
  /** Non-empty *.jsonl shards under .cache/pgm/reddit-cache (tier-1 warmth). */
  cacheShards: number;
  lastError?: string;
  /** True when only the embedded visible-Chrome lane could reach Reddit. */
  viaBrowser?: boolean;
}

/** Count non-empty month shards in the tier-1 cache (depth-2 walk). */
export function countCacheShards(cacheDir: string): number {
  let count = 0;
  let subs: string[];
  try {
    subs = readdirSync(cacheDir);
  } catch {
    return 0;
  }
  for (const sub of subs) {
    let months: string[];
    try {
      months = readdirSync(join(cacheDir, sub));
    } catch {
      continue;
    }
    for (const f of months) {
      if (!f.endsWith(".jsonl")) continue;
      try {
        if (statSync(join(cacheDir, sub, f)).size > 0) count += 1;
      } catch {
        /* raced delete — skip */
      }
    }
  }
  return count;
}

/**
 * Probe the keyless public Reddit JSON endpoint with loud per-attempt logging.
 * Never throws — the result carries everything the caller needs to decide.
 */
export async function probeRedditAccess(opts: ProbeOptions = {}): Promise<ProbeResult> {
  const log = opts.log ?? ((line: string): void => console.log(line));
  const subreddit = opts.subreddit ?? "EtsySellers";
  const attempts = Math.max(1, opts.attempts ?? 3);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const cacheDir = opts.cacheDir ?? join(REPO_ROOT, ".cache", "pgm", "reddit-cache");
  const doFetch = opts.fetcher ?? fetch;
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=1&raw_json=1`;

  const cacheShards = countCacheShards(cacheDir);

  let httpStatus: number | null = null;
  let latencyMs: number | null = null;
  let lastError: string | undefined;
  let used = 0;

  for (let i = 1; i <= attempts; i++) {
    used = i;
    process.stdout.write(`[pgm:reddit] Trying to contact Reddit endpoint ${url} ... `);
    const t0 = Date.now();
    try {
      const res = await doFetch(url, {
        headers: { "User-Agent": PROBE_UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      latencyMs = Date.now() - t0;
      httpStatus = res.status;
      if (res.ok) {
        process.stdout.write(`OK\n`);
        log(
          `[pgm:reddit] REDDIT REACHABLE (HTTP ${res.status}, ${latencyMs}ms) after ${i} attempt(s).`,
        );
        return { reachable: true, httpStatus, attemptsUsed: i, latencyMs, cacheShards };
      }
      process.stdout.write(`HTTP ${res.status}\n`);
      lastError = `HTTP ${res.status}${res.status === 403 ? " — Reddit is blocking this IP (datacenter/VPN egress)" : ""}`;
    } catch (err) {
      latencyMs = null;
      lastError = err instanceof Error ? err.message : String(err);
      process.stdout.write(`no response (${lastError})\n`);
    }
    if (i < attempts) {
      log(`[pgm:reddit] No response - retry ${String(i).padStart(2, "0")}/${String(attempts).padStart(2, "0")}`);
    }
  }

  // Final strategy: the embedded VISIBLE-Chrome lane. Field-verified: Reddit's
  // edge hard-blocks every non-interactive fingerprint on flagged IPs (curl,
  // .NET, Node h1/h2, headless browsers) while a visible real-Chrome window
  // passes. See browserFetch.ts for the full evidence matrix.
  const fallbackEnabled = opts.browserFallback ?? process.env.PGM_BROWSER_FETCH !== "0";
  if (fallbackEnabled) {
    process.stdout.write(`[pgm:reddit] Trying via embedded visible Chrome window (fallback) ... `);
    const b = await browserGet(url, timeoutMs + 10_000);
    if (b.ok && b.status === 200) {
      process.stdout.write("OK\n");
      log(
        `[pgm:reddit] REDDIT REACHABLE VIA EMBEDDED CHROME (HTTP 200) — a Chrome window opened; that is expected.`,
      );
      log(`[pgm:reddit] NOTE: direct transports stay blocked from this IP; mining will use this lane.`);
      return { reachable: true, httpStatus: 200, attemptsUsed: used + 1, latencyMs: null, cacheShards, viaBrowser: true };
    }
    process.stdout.write(`${b.status || "no response"}${b.error ? ` (${b.error})` : ""}\n`);
    lastError = `browser lane: HTTP ${b.status || "n/a"}${b.error ? ` — ${b.error}` : ""}`;
  }

  log(`[pgm:reddit] --------------------------------------------------------------`);
  log(
    `[pgm:reddit] ABORT-WORTHY: Reddit NOT reachable after ${attempts} attempt(s) (last: ${lastError ?? "unknown"}).`,
  );
  log(
    `[pgm:reddit] Tier-1 local cache: ${cacheShards} non-empty shard(s) under .cache/pgm/reddit-cache — ` +
      (cacheShards > 0 ? "cache CAN serve mining." : "cache is COLD: nothing to mine from either."),
  );
  log(`[pgm:reddit] Fix: run scripts/refresh-cache.ts from a RESIDENTIAL connection (VPN OFF),`);
  log(`[pgm:reddit] then re-probe: npx vite-node src/pgm/cli.ts --reddit-only`);
  log(`[pgm:reddit] --------------------------------------------------------------`);
  return { reachable: false, httpStatus, attemptsUsed: used, latencyMs, cacheShards, lastError };
}
