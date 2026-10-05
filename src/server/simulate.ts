// Requirement IDs: FR-11
import { WIRE_SAMPLES } from "src/ring/wire.js";

export interface SimulateRequest {
  type: string;
  deviceId: string;
  subType?: string;
  componentId?: number;
  sessionId?: string;
}

/** A webhook payload shaped like WIRE_SAMPLES.webhookMotion / webhookButton / webhookOffline (by `type`), with
 *  `simulated: true`, `meta.request_id = "sim-<nowMs>-<counter>"`, event id `evt-sim-<counter>`, and `timestamp`/`meta.time` = now. */
export function buildSimulatedWebhook(
  req: SimulateRequest,
  nowMs: number,
  counter: number,
): Record<string, unknown> {
  const template =
    req.type === "motion_detected"
      ? WIRE_SAMPLES.webhookMotion
      : req.type === "button_press"
        ? WIRE_SAMPLES.webhookButton
        : WIRE_SAMPLES.webhookOffline;
  const p = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;
  p["device_id"] = req.deviceId;
  if (req.type === "motion_detected" || req.type === "button_press") {
    const attrs: Record<string, unknown> = { component_ids: [req.componentId ?? 0] };
    if (req.subType !== undefined) attrs["sub_type"] = req.subType;
    p["attributes"] = attrs;
    p["type"] = req.type;
  } else {
    p["attributes"] = {};
    p["type"] = req.type;
  }
  const iso = new Date(nowMs).toISOString();
  p["timestamp"] = iso;
  p["event_id"] = `evt-sim-${counter}`;
  const meta = (p["meta"] as Record<string, unknown>) ?? {};
  meta["request_id"] = `sim-${nowMs}-${counter}`;
  meta["time"] = iso;
  p["meta"] = meta;
  p["simulated"] = true;
  return p;
}

export const SIMULATE_TYPES: readonly ["motion_detected", "button_press", "device_online", "device_offline"] = [
  "motion_detected",
  "button_press",
  "device_online",
  "device_offline",
];
