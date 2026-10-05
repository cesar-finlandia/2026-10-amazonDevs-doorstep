// Requirement IDs: FR-01, FR-10…FR-15
// Shared RingPort contract test, reused by DP-DOMAIN-ENGINE WU-03/05 and by
// DP-RING-INTEGRATION WU-08. Import path is stable: scripts/verify/ring-port-contract.ts.
// Throws on the first contract violation; resolves silently when the port conforms.
import type {
  RingDevice,
  RingPort,
} from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";

function check(cond: unknown, reason: string): void {
  if (!cond) throw new Error(`ring-port contract: ${reason}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Assert every method returns the documented shape and refusals arrive as RingError values. */
export async function runRingPortContract(port: RingPort): Promise<void> {
  check(port.mode === "bundle" || port.mode === "live" || port.mode === "http", "mode is bundle|live|http");

  const devices = await port.listDevices();
  check(Array.isArray(devices) && devices.length > 0, "listDevices returns a non-empty array");
  const first = devices[0] as RingDevice;
  check(typeof first.id === "string" && typeof first.kind === "string", "device has id and kind");
  check(typeof first.status?.online === "boolean", "device status has online");
  check(Array.isArray(first.capabilities?.components), "device capabilities list components");
  const deviceId = first.id;

  const status = await port.getStatus(deviceId);
  check(typeof status.online === "boolean" && typeof status.acPower === "boolean", "getStatus shape");

  const caps = await port.getCapabilities(deviceId);
  check(typeof caps.motionDetection === "boolean" && Array.isArray(caps.videoCodecs), "getCapabilities shape");

  const loc = await port.getLocation(deviceId);
  check(typeof loc.name === "string" && typeof loc.utcOffsetMin === "number", "getLocation shape");

  const conf = await port.getConfigurations(deviceId);
  check(isRecord(conf), "getConfigurations returns a record");

  const page = await port.getEventHistory(deviceId, { limit: 50, offset: 0 });
  check(Array.isArray(page.items) && page.limit === 50 && page.offset === 0 && typeof page.total === "number", "getEventHistory page shape");

  const inbox = await port.drainWebhookInbox();
  check(Array.isArray(inbox), "drainWebhookInbox returns an array");
  for (const p of inbox) {
    check(typeof p.event_id === "string" && typeof p.device_id === "string" && typeof p.meta?.request_id === "string", "webhook payload shape");
  }

  const whep = await port.startWhep(deviceId, "v=0 OFFER");
  check(typeof whep.sessionId === "string" && typeof whep.answerSdp === "string" && typeof whep.maxSeconds === "number", "startWhep shape");
  await port.stopWhep(deviceId, whep.sessionId);

  const snap = await port.getSnapshot(deviceId);
  check(typeof snap.contentType === "string" && typeof snap.dataBase64 === "string", "getSnapshot shape");

  const clip = await port.getClip(deviceId, { startMs: 0, endMs: 60_000 });
  check(typeof clip.contentType === "string" && typeof clip.dataBase64 === "string" && typeof clip.durationSec === "number", "getClip shape");

  const chime = await port.playChime(deviceId, "chime-default");
  check(chime.ok === true && chime.deviceId === deviceId, "playChime shape");

  let refusal: unknown = null;
  try {
    await port.getStatus("dev-does-not-exist");
  } catch (e) {
    refusal = e;
  }
  check(refusal instanceof RingError, "unknown-device refusal is a RingError value");
}
