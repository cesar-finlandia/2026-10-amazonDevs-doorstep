// Requirement IDs: FR-10, FR-21, NFR-01
import type { RingPort } from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import type { RingHttp } from "src/ring/client.js";
import { createRingHttp } from "src/ring/client.js";
import type { Inbox } from "src/ring/inbox.js";
import type { TokenProvider, TokenSource } from "src/ring/oauth.js";
import { createTokenProvider } from "src/ring/oauth.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import type { LiveRingPort } from "src/ring/live-ring-port.js";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";

export type RingMode = "live" | "bundle";

export interface SessionRegistryDeps {
  env: Record<string, string | undefined>;
  inbox: Inbox;
  ttlMs: number;
  max: number;
  degradeAfter: number;
  now?: () => number;
  fetch?: typeof fetch;
  ringBaseUrl?: string;
  oauthUrl?: string;
  onRingDegraded?: (sessionId: string, reason: string) => void;
  makeBundlePort?: () => RingPort;
}

export interface SessionRegistry {
  portFor(sessionId: string): RingPort;
  httpFor(sessionId: string): RingHttp | null;
  ringMode(sessionId?: string): RingMode;
  setToken(sessionId: string, token: string, ttlSec?: number): { expiresInSec: number | null };
  forgetToken(sessionId: string): void;
  tokenStatus(sessionId?: string): { source: TokenSource; expiresInSec: number | null };
  noteRingResult(sessionId: string, err: RingError | null): boolean;
  hasEnvCredentials(): boolean;
  count(): number;
  sweep(): number;
}

export const SESSION_ID_PATTERN: RegExp = /^[A-Za-z0-9_-]{8,64}$/;

interface Entry {
  lastSeenMs: number;
  tokens?: TokenProvider;
  live?: LiveRingPort;
  http?: RingHttp;
  bundle?: RingPort;
  failures: number;
  degraded: boolean;
}

export function createSessionRegistry(deps: SessionRegistryDeps): SessionRegistry {
  const env = deps.env;
  const inbox = deps.inbox;
  const now = deps.now ?? Date.now;
  const map = new Map<string, Entry>();

  function hasEnvCredentials(): boolean {
    return (
      !!env["RING_ACCESS_TOKEN"] ||
      (!!env["RING_REFRESH_TOKEN"] && !!env["RING_CLIENT_ID"] && !!env["RING_CLIENT_SECRET"])
    );
  }

  function ensure(id: string): Entry {
    let e = map.get(id);
    if (!e) {
      if (map.size >= deps.max) {
        let oldest: string | null = null;
        let oldestT = Infinity;
        for (const [k, v] of map) {
          if (v.lastSeenMs < oldestT) {
            oldestT = v.lastSeenMs;
            oldest = k;
          }
        }
        if (oldest !== null) map.delete(oldest);
      }
      e = { lastSeenMs: now(), failures: 0, degraded: false };
      map.set(id, e);
    }
    return e;
  }

  function ringMode(sessionId?: string): RingMode {
    if (sessionId === undefined) {
      return hasEnvCredentials() && env["RING_MODE"] !== "bundle" ? "live" : "bundle";
    }
    const e = map.get(sessionId);
    if (!e || e.degraded) return "bundle";
    const sessionToken = e.tokens !== undefined && e.tokens.status().source === "playground";
    if (sessionToken) return "live";
    if (hasEnvCredentials() && env["RING_MODE"] !== "bundle") return "live";
    return "bundle";
  }

  function portFor(sessionId: string): RingPort {
    const e = ensure(sessionId);
    e.lastSeenMs = now();
    if (ringMode(sessionId) === "live") {
      if (!e.tokens) {
        e.tokens = createTokenProvider({ env, fetch: deps.fetch, oauthUrl: deps.oauthUrl });
      }
      if (!e.http) {
        e.http = createRingHttp({ baseUrl: deps.ringBaseUrl, tokens: e.tokens, fetch: deps.fetch });
      }
      if (!e.live) {
        e.live = createLiveRingPort({ http: e.http, inbox, sessionId: "default" });
      }
      return e.live;
    }
    if (!e.bundle) {
      e.bundle = deps.makeBundlePort ? deps.makeBundlePort() : createBundleRingPort();
    }
    return e.bundle;
  }

  function httpFor(sessionId: string): RingHttp | null {
    const e = map.get(sessionId);
    if (!e) return null;
    if (ringMode(sessionId) !== "live") return null;
    if (!e.tokens) {
      e.tokens = createTokenProvider({ env, fetch: deps.fetch, oauthUrl: deps.oauthUrl });
    }
    if (!e.http) {
      e.http = createRingHttp({ baseUrl: deps.ringBaseUrl, tokens: e.tokens, fetch: deps.fetch });
    }
    return e.http;
  }

  function setToken(sessionId: string, token: string, ttlSec?: number): { expiresInSec: number | null } {
    if (typeof token !== "string" || token.length === 0) {
      throw new RingError(400, "bad_request", "Paste a token first.");
    }
    const e = ensure(sessionId);
    e.lastSeenMs = now();
    if (!e.tokens) {
      e.tokens = createTokenProvider({ env, fetch: deps.fetch, oauthUrl: deps.oauthUrl });
    }
    e.tokens.setPlaygroundToken(token, ttlSec);
    e.degraded = false;
    e.failures = 0;
    e.bundle = undefined;
    return { expiresInSec: e.tokens.status().expiresInSec };
  }

  function forgetToken(sessionId: string): void {
    const e = map.get(sessionId);
    if (e) {
      e.tokens?.forget();
      e.lastSeenMs = now();
    }
  }

  function tokenStatus(sessionId?: string): { source: TokenSource; expiresInSec: number | null } {
    const e = sessionId !== undefined ? map.get(sessionId) : undefined;
    if (e?.tokens) return e.tokens.status();
    return createTokenProvider({ env, fetch: deps.fetch, oauthUrl: deps.oauthUrl }).status();
  }

  function noteRingResult(sessionId: string, err: RingError | null): boolean {
    const e = ensure(sessionId);
    if (err === null) {
      e.failures = 0;
      return false;
    }
    if (e.degraded) return false;
    e.failures += 1;
    const net = err.status === 0 || err.status >= 500;
    if (err.code === "unauthorized" || (net && e.failures >= deps.degradeAfter)) {
      e.degraded = true;
      const reason =
        err.code === "unauthorized" ? "The Ring token is missing or expired." : "Ring is not answering.";
      try {
        deps.onRingDegraded?.(sessionId, reason);
      } catch {
        /* ignore */
      }
      return true;
    }
    return false;
  }

  function sweep(): number {
    const at = now();
    let dropped = 0;
    for (const [k, v] of [...map]) {
      if (at - v.lastSeenMs > deps.ttlMs) {
        map.delete(k);
        dropped += 1;
      }
    }
    return dropped;
  }

  return {
    portFor,
    httpFor,
    ringMode,
    setToken,
    forgetToken,
    tokenStatus,
    noteRingResult,
    hasEnvCredentials,
    count: () => map.size,
    sweep,
  };
}
