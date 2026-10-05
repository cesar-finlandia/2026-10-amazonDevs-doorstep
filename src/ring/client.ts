// Requirement IDs: FR-10, NFR-03, NFR-13
// Rate-limited Ring REST client: token bucket at 100 TPS, 401 refresh-once,
// 429 honour-and-retry, everything inside withResilience (server-side only).
import { isDegradedResult, withResilience } from "src/resilience";
import type { ResilienceConfig } from "src/resilience";
import { RingError } from "src/domain/ring-port.js";
import { redactText } from "src/ring/oauth.js";
import type { TokenProvider } from "src/ring/oauth.js";
import { RING_API_BASE } from "src/ring/wire.js";

export interface RingResponse { status: number; headers: Record<string, string> /* lower-cased names */; json: unknown | null; text: string; bytes: Uint8Array }
export interface RingRequestOptions { query?: Record<string, string | number | undefined>; json?: unknown; body?: string; contentType?: string; accept?: string }
export interface RingHttp {
  request(method: "GET" | "POST" | "PATCH" | "DELETE", pathOrUrl: string, opts?: RingRequestOptions): Promise<RingResponse>;
  get(path: string, query?: Record<string, string | number | undefined>): Promise<RingResponse>;
  post(path: string, json?: unknown, opts?: Omit<RingRequestOptions, "json">): Promise<RingResponse>;
  patch(path: string, json?: unknown): Promise<RingResponse>;
  del(pathOrUrl: string): Promise<RingResponse>;
  readonly baseUrl: string;
}
export interface RingHttpOptions {
  baseUrl?: string; // default RING_API_BASE
  tokens: Pick<TokenProvider, "getToken">;
  fetch?: typeof fetch; tps?: number; // default 100
  maxRetries429?: number; // default 3
  resilience?: ResilienceConfig;
  now?: () => number; sleep?: (ms: number) => Promise<void>;
}

type Settled = { ok: true; res: RingResponse } | { ok: false; error: RingError };

function asRingError(error: unknown): RingError {
  if (error instanceof RingError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new RingError(0, "network", redactText(message, []));
}

function parseRetryAfter(value: string | undefined, nowMs: number): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Math.max(1, Number.parseInt(trimmed, 10));
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) return Math.max(1, Math.ceil((dateMs - nowMs) / 1000));
  return undefined;
}

function jittered(ms: number): number {
  return Math.max(0, Math.round(ms * (0.75 + Math.random() * 0.5)));
}

/** Failures are thrown as RingError (src/domain/ring-port.ts). Every request is wrapped in withResilience (§5.4). */
export function createRingHttp(opts: RingHttpOptions): RingHttp {
  const baseUrl = opts.baseUrl ?? RING_API_BASE;
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const tps = opts.tps ?? 100;
  const maxRetries429 = opts.maxRetries429 ?? 3;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)));

  let tokensAvailable = tps;
  let lastRefill = now();
  async function acquire(): Promise<void> {
    for (;;) {
      const at = now();
      const elapsed = at - lastRefill;
      if (elapsed > 0) {
        tokensAvailable = Math.min(tps, tokensAvailable + (elapsed * tps) / 1000);
        lastRefill = at;
      }
      if (tokensAvailable >= 1) {
        tokensAvailable -= 1;
        return;
      }
      await sleep(Math.ceil(1000 / tps));
    }
  }

  function buildUrl(pathOrUrl: string, query?: Record<string, string | number | undefined>): string {
    const base = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : baseUrl + pathOrUrl;
    if (query === undefined) return base;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.append(key, String(value));
    }
    const encoded = params.toString().replace(/%2C/gi, ",");
    if (encoded.length === 0) return base;
    return base + (base.includes("?") ? "&" : "?") + encoded;
  }

  function classify(status: number, json: unknown, headers: Record<string, string>): RingError {
    let message = `Ring returned ${status}`;
    if (typeof json === "object" && json !== null && Array.isArray((json as Record<string, unknown>)["errors"])) {
      const first = ((json as Record<string, unknown>)["errors"] as unknown[])[0] as Record<string, unknown> | undefined;
      const detail = first?.["detail"];
      const title = first?.["title"];
      if (typeof detail === "string" && detail.length > 0) message = detail;
      else if (typeof title === "string" && title.length > 0) message = title;
    }
    message = redactText(message, []);
    if (status === 400) return new RingError(400, "bad_request", message);
    if (status === 401 || status === 403) return new RingError(status, "unauthorized", message);
    if (status === 404) return new RingError(404, "not_found", message);
    if (status === 409 || status === 422) return new RingError(status, "bad_request", message);
    if (status === 429) {
      const retryAfterSec = parseRetryAfter(headers["retry-after"], now());
      return new RingError(429, "rate_limited", message, retryAfterSec);
    }
    if (status >= 500) return new RingError(status, "upstream", message);
    return new RingError(status, "bad_request", message);
  }

  async function attempt(token: string, method: string, url: string, reqOpts?: RingRequestOptions): Promise<RingResponse> {
    await acquire();
    const body = reqOpts?.json !== undefined ? JSON.stringify(reqOpts.json) : reqOpts?.body;
    let res: Response;
    try {
      res = await fetchFn(url, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          Accept: reqOpts?.accept ?? "application/json",
          ...(body !== undefined ? { "Content-Type": reqOpts?.contentType ?? "application/json" } : {}),
        },
        ...(body !== undefined ? { body } : {}),
      });
    } catch (error) {
      throw new RingError(0, "network", redactText(error instanceof Error ? error.message : String(error), []));
    }
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder().decode(bytes);
    const headers: Record<string, string> = {};
    res.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    const contentType = headers["content-type"] ?? "";
    let json: unknown | null = null;
    if (contentType.includes("json")) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    return { status: res.status, headers, json, text, bytes };
  }

  async function request(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    pathOrUrl: string,
    reqOpts?: RingRequestOptions,
  ): Promise<RingResponse> {
    const url = buildUrl(pathOrUrl, reqOpts?.query);
    let lastUpstream: RingError | null = null;
    const primary = async (): Promise<Settled> => {
      let token: string;
      try {
        token = await opts.tokens.getToken();
      } catch (error) {
        return { ok: false, error: asRingError(error) };
      }
      let res = await attempt(token, method, url, reqOpts);
      if (res.status === 401) {
        try {
          token = await opts.tokens.getToken({ force: true });
        } catch (error) {
          return { ok: false, error: asRingError(error) };
        }
        res = await attempt(token, method, url, reqOpts);
        if (res.status === 401) return { ok: false, error: classify(res.status, res.json, res.headers) };
      }
      if (res.status === 429) {
        let limited = classify(res.status, res.json, res.headers);
        for (let n = 0; n < maxRetries429; n += 1) {
          const waitMs = Math.max((limited.retryAfterSec ?? 0) * 1000, jittered(1000 * 2 ** n));
          await sleep(waitMs);
          res = await attempt(token, method, url, reqOpts);
          if (res.status !== 429) break;
          limited = classify(res.status, res.json, res.headers);
        }
        if (res.status === 429) return { ok: false, error: limited };
      }
      if (res.status >= 500) {
        lastUpstream = classify(res.status, res.json, res.headers);
        throw lastUpstream;
      }
      if (res.status >= 400) return { ok: false, error: classify(res.status, res.json, res.headers) };
      return { ok: true, res };
    };
    const guarded = withResilience(primary, {
      timeout_ms: 15000,
      retries: 1,
      backoff: { base_ms: 300 },
      fallback_chain: { order: ["none"] },
      ...opts.resilience,
    });
    const settled = await guarded();
    if (isDegradedResult(settled)) {
      const original = typeof settled.original_error === "string" ? settled.original_error : null;
      if (original !== null && original.startsWith("Ring returned 5") && lastUpstream !== null) throw lastUpstream;
      throw new RingError(0, "network", original ?? "Ring request failed");
    }
    if (!settled.ok) throw settled.error;
    return settled.res;
  }

  const http: RingHttp = {
    request,
    get: (path, query) => request("GET", path, { query }),
    post: (path, json, postOpts) => request("POST", path, { ...postOpts, json }),
    patch: (path, json) => request("PATCH", path, { json }),
    del: (pathOrUrl) => request("DELETE", pathOrUrl),
    baseUrl,
  };
  return http;
}
