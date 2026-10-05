// Requirement IDs: FR-01, FR-12
// BundleRingPort: the RingPort seam answered from the committed synthetic bundle.
import { readFileSync } from "node:fs";
import type { RingBundle } from "src/domain/generator.js";
import type { RingPort } from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";

function loadBundleFromDisk(): RingBundle {
  const url = new URL("../../data/bundle/doorstep-14d.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as RingBundle;
}

/** Reads data/bundle/doorstep-14d.json when no bundle is passed. mode "bundle".
 *  - drainWebhookInbox returns the inbox once, then [] (a second call after reset() returns it again).
 *  - Every other method answers from the bundle; unknown device → RingError(404,"not_found").
 *  - startWhep returns a synthetic answer (answerSdp "v=0 SIMULATED"), maxSeconds 30.
 *  - playChime returns { ok: true, simulated: true }. */
export function createBundleRingPort(bundle?: RingBundle): RingPort & { reset(): void } {
  const data = bundle ?? loadBundleFromDisk();
  const byId = new Map(data.devices.map((d) => [d.id, d]));
  let drained = false;
  let whepCounter = 0;

  function need(deviceId: string): asserts deviceId {
    if (!byId.has(deviceId)) throw new RingError(404, "not_found", `unknown device ${deviceId}`);
  }

  return {
    mode: "bundle",
    listDevices: () => Promise.resolve(data.devices),
    getStatus: (deviceId) => {
      const d = byId.get(deviceId);
      if (!d) return Promise.reject(new RingError(404, "not_found", `unknown device ${deviceId}`));
      return Promise.resolve(d.status);
    },
    getCapabilities: (deviceId) => {
      const d = byId.get(deviceId);
      if (!d) return Promise.reject(new RingError(404, "not_found", `unknown device ${deviceId}`));
      return Promise.resolve(d.capabilities);
    },
    getLocation: (deviceId) => {
      const d = byId.get(deviceId);
      if (!d || !d.location) return Promise.reject(new RingError(404, "not_found", `unknown device ${deviceId}`));
      return Promise.resolve(d.location);
    },
    getConfigurations: (deviceId) => {
      const d = byId.get(deviceId);
      if (!d || !d.configurations) return Promise.reject(new RingError(404, "not_found", `unknown device ${deviceId}`));
      return Promise.resolve(d.configurations);
    },
    getEventHistory: (deviceId, q) => {
      const pages = data.history[deviceId];
      if (!pages) return Promise.reject(new RingError(404, "not_found", `unknown device ${deviceId}`));
      const all = pages.flatMap((p) => p.items);
      const items = (q.type ? all.filter((it) => it.eventType === q.type) : all).slice(q.offset, q.offset + q.limit);
      return Promise.resolve({ items, limit: q.limit, offset: q.offset, total: all.length });
    },
    drainWebhookInbox: () => {
      if (drained) return Promise.resolve([]);
      drained = true;
      return Promise.resolve([...data.inbox]);
    },
    startWhep: (deviceId) => {
      need(deviceId);
      whepCounter += 1;
      return Promise.resolve({
        sessionId: `whep-${deviceId}-${whepCounter}`,
        answerSdp: "v=0 SIMULATED",
        expiresInSec: 60,
        maxSeconds: 30,
      });
    },
    stopWhep: (deviceId) => {
      need(deviceId);
      return Promise.resolve();
    },
    getSnapshot: (deviceId, componentId = 0) => {
      need(deviceId);
      const snap = data.snapshots[`${deviceId}:${componentId}`];
      if (!snap) return Promise.reject(new RingError(404, "not_found", `no snapshot for ${deviceId}:${componentId}`));
      return Promise.resolve(snap);
    },
    getClip: (deviceId, q) => {
      need(deviceId);
      return Promise.resolve({
        contentType: "video/mp4",
        dataBase64: "AA==",
        durationSec: Math.max(0, Math.round((q.endMs - q.startMs) / 1000)),
        synthetic: true,
      });
    },
    playChime: (deviceId, audioRef) => {
      need(deviceId);
      return Promise.resolve({ ok: true as const, audioRef, deviceId, simulated: true });
    },
    reset: () => {
      drained = false;
    },
  };
}
