// Requirement IDs: PGM-K2-01, PGM-K2-03, PGM-K2-05, PGM-RES-01; PAS-M1 §6.3
// Embedded-browser fetch fallback for Reddit — now a THIN WRAPPER over the
// generalized shared lane (src/shared/browserLane.ts), which preserves the
// field-proven mechanism verbatim:
//
//   Reddit's edge 403s EVERY non-interactive client fingerprint from flagged
//   IP ranges. The ONLY passing client observed is a VISIBLE real-Chrome
//   window (`channel:"chrome", headless:false`) doing a seeded landing-page
//   visit followed by an address-bar-style request-context GET.
//
// One such window per process; a visible Chrome window appears while the
// fallback is active (it is the mechanism, not a bug); requires Google Chrome
// installed; disable entirely with env PGM_BROWSER_FETCH=0.

import { join } from "node:path";
import { createBrowserLane } from "../../shared/browserLane.js";

export type { BrowserGetResult } from "../../shared/browserLane.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** Operator-cleared Reddit session (cookies/localStorage) saved by
 *  scripts/reddit-clear.ts after a manual challenge solve; loaded into the
 *  lane context when present so the clearance survives process restarts. */
export const REDDIT_STORAGE_STATE_PATH = join(
  REPO_ROOT, ".cache", "pgm", "reddit-storage-state.json",
);

/** Landing-page seed so Reddit issues its own cookies before API hits. */
function redditSeedUrlFor(url: string): string {
  const m = url.match(/^https:\/\/[^/]+\/r\/([^/?#]+)/);
  return m ? `https://www.reddit.com/r/${m[1]}/` : "https://www.reddit.com/";
}

const lane = createBrowserLane({
  laneId: "pgm",
  envFlag: "PGM_BROWSER_FETCH",
  seedUrlFor: redditSeedUrlFor,
  storageStatePath: REDDIT_STORAGE_STATE_PATH,
});

/** One JSON GET through the visible-Chrome lane. Never throws. */
export const browserGet: (url: string, timeoutMs?: number) => ReturnType<typeof lane.get> = lane.get;

/** Best-effort teardown (tests / CLI shutdown). */
export const closeBrowserFetch: () => Promise<void> = lane.close;
