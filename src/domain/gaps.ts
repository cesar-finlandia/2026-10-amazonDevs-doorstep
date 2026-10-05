// Requirement IDs: FR-12
// Webhook-gap finder and Event-History poller (pure over RingPort).
import type { RingPort } from "src/domain/ring-port.js";
import type { RawDoorEvent, WeekModel } from "src/domain/types.js";
import { parseHistoryPage } from "src/domain/parse.js";

export const HISTORY_OVERLAP_MS: number = 600_000;              // 600_000 — the safety overlap the Perceive stage uses for the door device
export const WEBHOOK_SILENCE_THRESHOLD_MS: number = 21_600_000;    // 6 h

/** Latest tsMs among model events with source "webhook" for the device; null when none. */
export function lastWebhookMs(model: WeekModel, deviceId: string): number | null {
  let latest: number | null = null;
  for (const e of model.events) {
    if (e.source !== "webhook" || e.deviceId !== deviceId) continue;
    if (latest === null || e.tsMs > latest) latest = e.tsMs;
  }
  return latest;
}

/** One interval {fromMs: lastWebhook − overlapMs, toMs: nowMs} when nowMs − lastWebhook > WEBHOOK_SILENCE_THRESHOLD_MS; otherwise []. */
export function findWebhookGaps(
  model: WeekModel,
  deviceId: string,
  nowMs: number,
  overlapMs: number = HISTORY_OVERLAP_MS,
): { fromMs: number; toMs: number }[] {
  const last = lastWebhookMs(model, deviceId);
  if (last === null) return [];
  if (nowMs - last <= WEBHOOK_SILENCE_THRESHOLD_MS) return [];
  return [{ fromMs: last - overlapMs, toMs: nowMs }];
}

/** Pages port.getEventHistory (limit 50, offset += 50) newest-first, stops when a page's oldest item is older than sinceMs
 *  or after 20 pages; returns parseHistoryPage events with tsMs ≥ sinceMs, sorted ascending by tsMs. */
export async function pollHistory(port: RingPort, deviceId: string, sinceMs: number): Promise<RawDoorEvent[]> {
  const out: RawDoorEvent[] = [];
  for (let page = 0; page < 20; page++) {
    const res = await port.getEventHistory(deviceId, { limit: 50, offset: page * 50 });
    if (res.items.length === 0) break;
    for (const e of parseHistoryPage(res, deviceId)) {
      if (e.tsMs >= sinceMs) out.push(e);
    }
    const oldest = Math.min(...res.items.map((it) => Date.parse(it.timestamp)));
    if (oldest < sinceMs) break;
  }
  return out.sort((a, b) => a.tsMs - b.tsMs || (a.id < b.id ? -1 : 1));
}
