// Requirement IDs: FR-10, NFR-01
// Layered Ring credential provider: playground token, then env access token,
// then the OAuth refresh flow. Secrets come from the environment only and are
// never written anywhere; every error message goes through redact (server-side only).
import { RingError } from "src/domain/ring-port.js";
import { RING_OAUTH_URL } from "src/ring/wire.js";

export type TokenSource = "playground" | "env_access" | "refresh" | "none";
export interface TokenProvider {
  getToken(opts?: { force?: boolean }): Promise<string>; // throws RingError(401,"unauthorized", …) when no credential exists
  setPlaygroundToken(token: string, ttlSec?: number): void; // default ttl 1800 s
  forget(): void; // drops the playground token
  status(): { source: TokenSource; expiresInSec: number | null };
}
export interface TokenProviderOptions {
  env?: Record<string, string | undefined>; // default process.env
  fetch?: typeof fetch; now?: () => number;
  oauthUrl?: string; // default RING_OAUTH_URL
  refreshSkewSec?: number; // default 300
}

/** Replaces Bearer credentials, token-shaped fields and exact known values with [redacted]. */
export function redactText(text: string, known: string[]): string {
  let out = text;
  out = out.replace(/Bearer\s+\S+/g, "Bearer [redacted]");
  out = out.replace(
    /(access_token|refresh_token|client_secret|token)["'=\s:]+[^\s&"',}]+/gi,
    (_m, key: string) => `${key}=[redacted]`,
  );
  for (const value of known) {
    if (value.length === 0) continue;
    out = out.split(value).join("[redacted]");
  }
  return out;
}

interface CachedToken { token: string; expiresAt: number }

export function createTokenProvider(opts?: TokenProviderOptions): TokenProvider {
  const env = opts?.env ?? process.env;
  const fetchFn = opts?.fetch ?? globalThis.fetch;
  const now = opts?.now ?? Date.now;
  const oauthUrl = opts?.oauthUrl ?? RING_OAUTH_URL;
  const skewSec = opts?.refreshSkewSec ?? 300;
  let playground: CachedToken | null = null;
  let cached: CachedToken | null = null;
  let refreshOverride: string | undefined;
  let inflight: Promise<string> | null = null;

  function knownValues(): string[] {
    const values: string[] = [];
    if (playground !== null) values.push(playground.token);
    if (cached !== null) values.push(cached.token);
    for (const key of ["RING_ACCESS_TOKEN", "RING_REFRESH_TOKEN", "RING_CLIENT_ID", "RING_CLIENT_SECRET"] as const) {
      const value = env[key];
      if (typeof value === "string" && value.length > 0) values.push(value);
    }
    if (typeof refreshOverride === "string" && refreshOverride.length > 0) values.push(refreshOverride);
    return values;
  }
  const redact = (text: string): string => redactText(text, knownValues());

  function readTrio(): { refreshToken: string; clientId: string; clientSecret: string } | null {
    const refreshToken = refreshOverride ?? env["RING_REFRESH_TOKEN"];
    const clientId = env["RING_CLIENT_ID"];
    const clientSecret = env["RING_CLIENT_SECRET"];
    if (
      typeof refreshToken !== "string" || refreshToken.length === 0 ||
      typeof clientId !== "string" || clientId.length === 0 ||
      typeof clientSecret !== "string" || clientSecret.length === 0
    ) {
      return null;
    }
    return { refreshToken, clientId, clientSecret };
  }

  function refresh(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
    if (inflight !== null) return inflight;
    const started: Promise<string> = (async (): Promise<string> => {
      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString();
      let res: Response;
      try {
        res = await fetchFn(oauthUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
      } catch (error) {
        throw new RingError(0, "network", redact(error instanceof Error ? error.message : String(error)));
      }
      let json: Record<string, unknown> | null = null;
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = null;
      }
      const access = json?.["access_token"];
      if (!res.ok || typeof access !== "string" || access.length === 0) {
        throw new RingError(res.status === 0 ? 401 : res.status, "unauthorized", "Ring did not accept the refresh token.");
      }
      const expiresIn = Number(json?.["expires_in"]);
      const ttlSec = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 14400;
      cached = { token: access, expiresAt: now() + ttlSec * 1000 };
      const rotated = json?.["refresh_token"];
      if (typeof rotated === "string" && rotated.length > 0) refreshOverride = rotated;
      return access;
    })();
    inflight = started;
    return started.then(
      (token) => {
        if (inflight === started) inflight = null;
        return token;
      },
      (error: unknown) => {
        if (inflight === started) inflight = null;
        throw error;
      },
    );
  }

  return {
    getToken: async (getOpts?: { force?: boolean }): Promise<string> => {
      const force = getOpts?.force === true;
      const at = now();
      if (!force && playground !== null && at < playground.expiresAt) return playground.token;
      const envAccess = env["RING_ACCESS_TOKEN"];
      if (!force && typeof envAccess === "string" && envAccess.length > 0) return envAccess;
      const trio = readTrio();
      if (trio !== null) {
        if (!force && cached !== null && cached.expiresAt - at > skewSec * 1000) return cached.token;
        return refresh(trio.refreshToken, trio.clientId, trio.clientSecret);
      }
      throw new RingError(401, "unauthorized", "No Ring credentials. Paste a Playground token or set RING_REFRESH_TOKEN.");
    },
    setPlaygroundToken: (token: string, ttlSec = 1800): void => {
      playground = { token, expiresAt: now() + ttlSec * 1000 };
    },
    forget: (): void => {
      playground = null;
    },
    status: (): { source: TokenSource; expiresInSec: number | null } => {
      const at = now();
      if (playground !== null && at < playground.expiresAt) {
        return { source: "playground", expiresInSec: Math.ceil((playground.expiresAt - at) / 1000) };
      }
      const envAccess = env["RING_ACCESS_TOKEN"];
      if (typeof envAccess === "string" && envAccess.length > 0) return { source: "env_access", expiresInSec: null };
      if (readTrio() !== null) {
        if (cached !== null && cached.expiresAt > at) {
          return { source: "refresh", expiresInSec: Math.ceil((cached.expiresAt - at) / 1000) };
        }
        return { source: "refresh", expiresInSec: null };
      }
      return { source: "none", expiresInSec: null };
    },
  };
}
