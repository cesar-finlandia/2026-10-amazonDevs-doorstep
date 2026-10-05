// Requirement IDs: FR-01, FR-10…FR-15
// WU-DOMAIN-ENGINE-03: the RingPort interface with a reusable contract helper,
// exercised here against a stub port.
import type { RingDevice, RingPort } from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import { runRingPortContract } from "./ring-port-contract.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const device: RingDevice = {
  id: "dev-door", kind: "doorbell", description: "Front door", owned: true, subscribed: true,
  status: { online: true, acPower: true, battery: "full" },
  capabilities: {
    motionDetection: true, videoCodecs: ["h264"], nightVision: "on",
    chimeAudio: true, chimeAudioSlots: ["chime-default"], whep: true, snapshot: true, components: [0],
  },
  location: { name: "Home", utcOffsetMin: -420 },
  configurations: { sensitivity: "high" },
  componentIds: [0],
};

const stub: RingPort = {
  mode: "bundle",
  listDevices: () => Promise.resolve([device]),
  getStatus: (id) => (id === device.id ? Promise.resolve(device.status) : Promise.reject(new RingError(404, "not_found", `unknown device ${id}`))),
  getCapabilities: () => Promise.resolve(device.capabilities),
  getLocation: () => Promise.resolve(device.location as { name: string; utcOffsetMin: number }),
  getConfigurations: () => Promise.resolve(device.configurations as Record<string, string | number | boolean>),
  getEventHistory: () => Promise.resolve({ items: [], limit: 50, offset: 0, total: 0 }),
  drainWebhookInbox: () => Promise.resolve([]),
  startWhep: () => Promise.resolve({ sessionId: "whep-1", answerSdp: "v=0 SIMULATED", expiresInSec: 60, maxSeconds: 30 }),
  stopWhep: () => Promise.resolve(),
  getSnapshot: () => Promise.resolve({ contentType: "image/jpeg", dataBase64: "AA==", capturedAtMs: 1, componentId: 0, synthetic: true }),
  getClip: () => Promise.resolve({ contentType: "video/mp4", dataBase64: "AA==", durationSec: 10, synthetic: true }),
  playChime: (deviceId, audioRef) => Promise.resolve({ ok: true as const, audioRef, deviceId, simulated: true }),
};

assert(stub.mode === "bundle", "stub mode is bundle");
const listed = await stub.listDevices();
assert(listed.length === 1 && listed[0]?.id === "dev-door", "listDevices returns dev-door");
const page = await stub.getEventHistory("dev-door", { limit: 50, offset: 0 });
assert(page.limit === 50 && page.offset === 0 && page.total === 0, "history page shape");
const snap = await stub.getSnapshot("dev-door");
assert(snap.contentType === "image/jpeg" && typeof snap.dataBase64 === "string", "snapshot shape");
const chime = await stub.playChime("dev-door", "chime-default");
assert(chime.ok === true && chime.simulated === true, "playChime simulated");
const err = new RingError(404, "not_found", "nope", 30);
assert(err.status === 404, "RingError keeps status");
assert(err.code === "not_found", "RingError keeps code");
assert(err.retryAfterSec === 30, "RingError keeps retryAfterSec");
await runRingPortContract(stub);
assert(true, "stub passes runRingPortContract");

console.log("de-03-port: 9 checks OK");
