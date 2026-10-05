// Requirement IDs: FR-11, NFR-12
// Per-session webhook queues and the idempotency set (server-side only).
import type { RingWebhookPayload } from "src/domain/ring-port.js";

export interface Inbox {
  push(sessionId: string, payload: RingWebhookPayload): void;
  drain(sessionId: string): RingWebhookPayload[]; // returns oldest first and empties the session's queue
  size(sessionId: string): number;
  clear(sessionId: string): void;
}

/** Per-session queues; "default" holds real webhooks. Each queue keeps the newest maxPerSession (default 500) payloads. */
export function createInbox(opts?: { maxPerSession?: number }): Inbox {
  const max = opts?.maxPerSession ?? 500;
  const queues = new Map<string, RingWebhookPayload[]>();
  return {
    push(sessionId: string, payload: RingWebhookPayload): void {
      const queue = queues.get(sessionId) ?? [];
      queue.push(payload);
      while (queue.length > max) queue.shift();
      queues.set(sessionId, queue);
    },
    drain(sessionId: string): RingWebhookPayload[] {
      const queue = queues.get(sessionId) ?? [];
      queues.set(sessionId, []);
      return queue;
    },
    size(sessionId: string): number {
      return queues.get(sessionId)?.length ?? 0;
    },
    clear(sessionId: string): void {
      queues.set(sessionId, []);
    },
  };
}

export interface SeenStore { has(id: string): boolean; add(id: string): void; size(): number }

/** Insertion-ordered set; the oldest id is evicted when more than max (default 5000) are held. */
export function createSeenStore(max?: number): SeenStore {
  const limit = max ?? 5000;
  const ids = new Set<string>();
  return {
    has(id: string): boolean {
      return ids.has(id);
    },
    add(id: string): void {
      if (ids.has(id)) return;
      ids.add(id);
      while (ids.size > limit) {
        const first = ids.values().next().value as string | undefined;
        if (typeof first !== "string") break;
        ids.delete(first);
      }
    },
    size(): number {
      return ids.size;
    },
  };
}
