// src/ui/state/sampleWeek.ts — loads the bundled sample week (DP-UI §6.3 item 5).
// Requirement IDs: FR-01
import type { Session } from "src/domain/session.js";

/** Adds events only; opens no incident. */
export async function loadSampleWeek(session: Session): Promise<void> {
  await session.call("ingest_ring_events", { source: "webhook_inbox" }, { source: "human" });
  await session.call("ingest_ring_events", { source: "history", deviceId: "dev-door" }, { source: "human" });
  await session.call("ingest_ring_events", { source: "history", deviceId: "dev-elite" }, { source: "human" });
}
