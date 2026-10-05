// Requirement IDs: FR-01, FR-10
import type { RingPort } from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import type {
  RingCapabilities,
  RingChimeResult,
  RingClip,
  RingConfigurations,
  RingDevice,
  RingHistoryPage,
  RingLocation,
  RingSnapshot,
  RingStatus,
  RingWebhookPayload,
  RingWhepSession,
} from "src/domain/ring-port.js";

export interface HttpRingPortOptions {
  baseUrl?: string;
  sessionId: string;
  fetch?: typeof fetch;
}

export type HttpRingPort = RingPort & {
  readonly mode: "http";
  remoteMode(): Promise<"live" | "bundle">;
  setToken(token: string): Promise<{ expiresInSec: number | null }>;
  forgetToken(): Promise<void>;
};

function omitUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function createHttpRingPort(opts: HttpRingPortOptions): HttpRingPort {
  const baseUrl = opts.baseUrl ?? "";
  const sessionId = opts.sessionId;
  const fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis);

  async function call<T>(op: string, args: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(baseUrl + "/api/ring/" + op, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, args }),
      });
    } catch (e) {
      throw new RingError(0, "network", "The server is not reachable.");
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new RingError(502, "upstream", "The server sent something unexpected.");
    }
    const doc = json as { ok?: boolean; data?: T; error?: { status?: unknown; code?: unknown; message?: unknown; retryAfterSec?: unknown } };
    if (doc.ok === true) return (doc.data ?? null) as T;
    if (doc.ok === false && typeof doc.error === "object" && doc.error !== null) {
      const err = doc.error;
      const status = typeof err.status === "number" ? err.status : 502;
      const code = typeof err.code === "string" ? err.code : "upstream";
      const message = typeof err.message === "string" ? err.message : "The server sent something unexpected.";
      const retry = typeof err.retryAfterSec === "number" ? err.retryAfterSec : undefined;
      throw new RingError(status, code, message, retry);
    }
    throw new RingError(502, "upstream", "The server sent something unexpected.");
  }

  const port: HttpRingPort = {
    mode: "http",
    listDevices: (): Promise<RingDevice[]> => call("listDevices", {}),
    getStatus: (deviceId: string): Promise<RingStatus> => call("getStatus", { deviceId }),
    getCapabilities: (deviceId: string, componentId?: number): Promise<RingCapabilities> =>
      call("getCapabilities", omitUndefined({ deviceId, componentId })),
    getLocation: (deviceId: string): Promise<RingLocation> => call("getLocation", { deviceId }),
    getConfigurations: (deviceId: string): Promise<RingConfigurations> =>
      call("getConfigurations", { deviceId }),
    getEventHistory: (deviceId: string, q: { limit: number; offset: number; type?: string }): Promise<RingHistoryPage> =>
      call("getEventHistory", omitUndefined({ deviceId, limit: q.limit, offset: q.offset, type: q.type })),
    drainWebhookInbox: (): Promise<RingWebhookPayload[]> => call("drainWebhookInbox", {}),
    startWhep: (deviceId: string, sdpOffer: string, componentId?: number): Promise<RingWhepSession> =>
      call("startWhep", omitUndefined({ deviceId, sdpOffer, componentId })),
    stopWhep: (deviceId: string, whepSessionId: string): Promise<void> =>
      call("stopWhep", { deviceId, whepSessionId }) as Promise<void>,
    getSnapshot: (deviceId: string, componentId?: number): Promise<RingSnapshot> =>
      call("getSnapshot", omitUndefined({ deviceId, componentId })),
    getClip: (
      deviceId: string,
      q: { startMs: number; endMs: number; componentId?: number },
    ): Promise<RingClip> =>
      call("getClip", omitUndefined({ deviceId, startMs: q.startMs, endMs: q.endMs, componentId: q.componentId })),
    playChime: (deviceId: string, audioRef: string): Promise<RingChimeResult> =>
      call("playChime", { deviceId, audioRef }),
    remoteMode: async (): Promise<"live" | "bundle"> => {
      let res: Response;
      try {
        res = await fetchFn(baseUrl + "/api/status?sessionId=" + encodeURIComponent(sessionId));
      } catch {
        throw new RingError(0, "network", "The server is not reachable.");
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        throw new RingError(502, "upstream", "The server sent something unexpected.");
      }
      const mode = (json as { ring?: { mode?: unknown } }).ring?.mode;
      if (mode !== "live" && mode !== "bundle") {
        throw new RingError(502, "upstream", "The server sent something unexpected.");
      }
      return mode;
    },
    setToken: async (token: string): Promise<{ expiresInSec: number | null }> => {
      let res: Response;
      try {
        res = await fetchFn(baseUrl + "/api/ring/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, token }),
        });
      } catch {
        throw new RingError(0, "network", "The server is not reachable.");
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        throw new RingError(502, "upstream", "The server sent something unexpected.");
      }
      const doc = json as { ok?: boolean; expiresInSec?: unknown; error?: { status?: unknown; code?: unknown; message?: unknown } };
      if (doc.ok === true) {
        return { expiresInSec: typeof doc.expiresInSec === "number" ? doc.expiresInSec : null };
      }
      const err = (doc.error ?? {}) as { status?: unknown; code?: unknown; message?: unknown };
      throw new RingError(
        typeof err.status === "number" ? err.status : 502,
        typeof err.code === "string" ? err.code : "upstream",
        typeof err.message === "string" ? err.message : "The server sent something unexpected.",
      );
    },
    forgetToken: async (): Promise<void> => {
      let res: Response;
      try {
        res = await fetchFn(baseUrl + "/api/ring/token", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        throw new RingError(0, "network", "The server is not reachable.");
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        throw new RingError(502, "upstream", "The server sent something unexpected.");
      }
      const doc = json as { ok?: boolean; error?: { status?: unknown; code?: unknown; message?: unknown } };
      if (doc.ok === true) return;
      const err = (doc.error ?? {}) as { status?: unknown; code?: unknown; message?: unknown };
      throw new RingError(
        typeof err.status === "number" ? err.status : 502,
        typeof err.code === "string" ? err.code : "upstream",
        typeof err.message === "string" ? err.message : "The server sent something unexpected.",
      );
    },
  };
  return port;
}
