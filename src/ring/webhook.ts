// Requirement IDs: FR-11, NFR-12
// Signed webhook receiver: verify BEFORE parsing, answer fast, enqueue asynchronously
// (server-side only; never logs or echoes the body, the signature or the secret).
import { parseRingPayload } from "src/domain/parse.js";
import type { Inbox, SeenStore } from "src/ring/inbox.js";
import { createSeenStore } from "src/ring/inbox.js";
import { verifySignature } from "src/ring/signature.js";

export interface WebhookEvent { requestId: string; type: string; deviceId: string; tsMs: number; simulated: boolean }
export interface WebhookDeps {
  secret: string | undefined | (() => string | undefined); // RING_WEBHOOK_SECRET; read on every call
  inbox: Inbox; seen?: SeenStore;
  publish?: (e: WebhookEvent) => void; // SSE hub hook (DP-API-TRANSPORT); never receives the secret or the raw body
  sessionId?: string; // default "default"
  now?: () => number;
}
export type WebhookRequest = { rawBody: Buffer; headers: Record<string, string | undefined> };
export type WebhookResponse = { status: number; body: string };
export interface WebhookHandler { (req: WebhookRequest): Promise<WebhookResponse>; flush(): Promise<void> }

/** Verify the signature BEFORE parsing; answer fast; enqueue asynchronously; idempotent on meta.request_id (else event_id). See §5.2. */
export function createWebhookHandler(deps: WebhookDeps): WebhookHandler {
  const inbox = deps.inbox;
  const seen = deps.seen ?? createSeenStore();
  const sessionId = deps.sessionId ?? "default";
  const pending: Promise<void>[] = [];

  const handler = (async (req: WebhookRequest): Promise<WebhookResponse> => {
    try {
      const secret = typeof deps.secret === "function" ? deps.secret() : deps.secret;
      if (typeof secret !== "string" || secret.length === 0) {
        return { status: 503, body: '{"ok":false,"error":"webhook secret not configured"}' };
      }
      let header: string | undefined;
      for (const [name, value] of Object.entries(req.headers)) {
        if (name.toLowerCase() === "x-signature") {
          header = value;
          break;
        }
      }
      if (!verifySignature(req.rawBody, header, secret)) {
        return { status: 401, body: '{"ok":false,"error":"invalid signature"}' };
      }
      let payload: unknown;
      try {
        payload = JSON.parse(req.rawBody.toString("utf8"));
      } catch {
        return { status: 400, body: '{"ok":false,"error":"invalid json"}' };
      }
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        return { status: 400, body: '{"ok":false,"error":"invalid json"}' };
      }
      const record = payload as Record<string, unknown>;
      const meta = (typeof record["meta"] === "object" && record["meta"] !== null
        ? record["meta"]
        : {}) as Record<string, unknown>;
      const requestId = meta["request_id"] ?? record["event_id"];
      if (typeof requestId !== "string" || requestId.length === 0) {
        return { status: 400, body: '{"ok":false,"error":"missing request id"}' };
      }
      if (seen.has(requestId)) {
        return { status: 200, body: '{"ok":true,"duplicate":true}' };
      }
      seen.add(requestId);
      let settle: () => void = () => undefined;
      const work: Promise<void> = new Promise<void>((resolve) => {
        settle = resolve;
      });
      pending.push(work);
      setImmediate(() => {
        try {
          const events = parseRingPayload(record);
          if (events.length > 0) {
            inbox.push(sessionId, record as unknown as import("src/domain/ring-port.js").RingWebhookPayload);
          }
          deps.publish?.({
            requestId,
            type: String(record["type"] ?? record["event_type"] ?? ""),
            deviceId: String(record["device_id"] ?? ""),
            tsMs: events[0]?.tsMs ?? (deps.now ?? Date.now)(),
            simulated: record["simulated"] === true,
          });
        } catch {
          // The ack already went out; async hook failures must not surface.
        } finally {
          settle();
          const at = pending.indexOf(work);
          if (at >= 0) pending.splice(at, 1);
        }
      });
      return { status: 200, body: '{"ok":true}' };
    } catch {
      return { status: 400, body: '{"ok":false,"error":"bad request"}' };
    }
  }) as WebhookHandler;
  handler.flush = async (): Promise<void> => {
    await Promise.allSettled([...pending]);
  };
  return handler;
}
