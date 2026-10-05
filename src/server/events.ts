// Requirement IDs: FR-09, FR-21
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createPublisher } from "src/platform/transport";
import type { EventEnvelope, EnvelopeStatus } from "src/platform/transport";

export interface EventHub {
  /** Never throws: a bad step id or a validation failure is logged and swallowed (returns false). Step ids are kebab-case. */
  publish(
    stepId: string,
    status: EnvelopeStatus,
    payload?: Record<string, unknown>,
    opts?: { degraded?: boolean },
  ): Promise<boolean>;
  /** Attaches one SSE response (platform asSseStream) and writes a `: keepalive` comment every 15 s until it closes. */
  stream(req: IncomingMessage, res: ServerResponse): void;
  /** The newest `eventsKeep` envelopes of this process, oldest first, and whether any is degraded. */
  snapshot(): { events: EventEnvelope[]; degraded: boolean };
  connections(): number;
  close(): Promise<void>;
}

export function createEventHub(opts?: { keep?: number; keepaliveMs?: number }): EventHub {
  const keep = opts?.keep ?? 500;
  const keepaliveMs = opts?.keepaliveMs ?? 15000;
  const pub = createPublisher("sse");
  const traceId = randomUUID();
  const timers = new Set<ReturnType<typeof setInterval>>();

  return {
    async publish(stepId, status, payload = {}, opts2): Promise<boolean> {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(stepId)) return false;
      try {
        await pub.publish({
          stepId,
          status,
          payload,
          traceId,
          ...(opts2?.degraded ? { degraded: true } : {}),
        });
        return true;
      } catch {
        return false;
      }
    },
    stream(req: IncomingMessage, res: ServerResponse): void {
      res.setHeader("X-Accel-Buffering", "no");
      pub.asSseStream(req, res);
      const timer = setInterval(() => {
        try {
          res.write(": keepalive\n\n");
        } catch {
          /* socket gone */
        }
      }, keepaliveMs);
      if (typeof (timer as unknown as { unref?: () => void }).unref === "function") {
        (timer as unknown as { unref: () => void }).unref();
      }
      timers.add(timer);
      res.on("close", () => {
        clearInterval(timer);
        timers.delete(timer);
      });
    },
    snapshot(): { events: EventEnvelope[]; degraded: boolean } {
      const s = pub.collect(traceId);
      const events = (s?.events ?? []).slice(-keep);
      return { events, degraded: events.some((e) => e.degraded === true) };
    },
    connections(): number {
      return pub.connectionCount;
    },
    async close(): Promise<void> {
      for (const t of timers) clearInterval(t);
      timers.clear();
      await pub.close();
    },
  };
}
