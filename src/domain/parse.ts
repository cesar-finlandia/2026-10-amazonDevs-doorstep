// Requirement IDs: FR-11, FR-12
// Tolerant Ring payload normalizer: never throws, skips what it cannot read.
import type { EventType, RawDoorEvent } from "src/domain/types.js";

type RecordLike = Record<string, unknown>;

function isRecord(v: unknown): v is RecordLike {
  return typeof v === "object" && v !== null;
}

function asRecord(v: unknown): RecordLike {
  return isRecord(v) ? v : {};
}

/** Map a wire type string to an EventType; null when unknown. */
function mapType(raw: unknown): EventType | null {
  if (typeof raw !== "string") return null;
  switch (raw.toLowerCase()) {
    case "motion":
    case "motion_detected":
      return "motion_detected";
    case "button_press":
    case "doorbell":
    case "ding":
      return "button_press";
    case "device_online":
    case "online":
      return "device_online";
    case "device_offline":
    case "offline":
      return "device_offline";
    default:
      return null;
  }
}

function readType(entry: RecordLike): EventType | null {
  const attrs = asRecord(entry["attributes"]);
  return (
    mapType(entry["type"]) ?? mapType(entry["event_type"]) ?? mapType(entry["eventType"]) ?? mapType(attrs["event_type"])
  );
}

function readSubType(entry: RecordLike, type: EventType): "human" | undefined {
  const attrs = asRecord(entry["attributes"]);
  const sub = attrs["sub_type"] ?? entry["sub_type"] ?? entry["subType"];
  return type === "motion_detected" && sub === "human" ? "human" : undefined;
}

function readComponentId(entry: RecordLike): number {
  const attrs = asRecord(entry["attributes"]);
  const raw =
    (Array.isArray(attrs["component_ids"]) ? (attrs["component_ids"] as unknown[])[0] : undefined) ??
    (Array.isArray(entry["component_ids"]) ? (entry["component_ids"] as unknown[])[0] : undefined) ??
    attrs["component_id"] ??
    entry["component_id"];
  if (raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** ISO-8601 string, or a number (values below 1e12 are seconds); NaN when unreadable. */
function readTsMs(entry: RecordLike, extra: RecordLike): number {
  const raw = entry["timestamp"] ?? extra["time"];
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return NaN;
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === "string") return Date.parse(raw);
  return NaN;
}

/** Tolerant normalizer: one webhook payload (or an array of them) → RawDoorEvent[] with source "webhook".
 *  Unknown types and malformed payloads yield []; never throws. */
export function parseRingPayload(payload: unknown): RawDoorEvent[] {
  const list = Array.isArray(payload) ? payload : [payload];
  const out: RawDoorEvent[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const meta = asRecord(item["meta"]);
    const requestId = meta["request_id"];
    if (typeof requestId !== "string" || requestId === "") continue;
    const deviceId = item["device_id"];
    if (typeof deviceId !== "string" || deviceId === "") continue;
    const type = readType(item);
    if (type === null) continue;
    const tsMs = readTsMs(item, meta);
    if (!Number.isFinite(tsMs)) continue;
    out.push({
      id: `evt:${requestId}`,
      deviceId,
      componentId: readComponentId(item),
      type,
      ...(readSubType(item, type) ? { subType: "human" as const } : {}),
      tsMs,
      requestId,
      source: "webhook",
    });
  }
  return out;
}

/** History page (or its items array) → RawDoorEvent[] with source "history" for one device. Never throws. */
export function parseHistoryPage(page: unknown, deviceId: string): RawDoorEvent[] {
  let items: unknown;
  if (Array.isArray(page)) {
    items = page;
  } else if (isRecord(page)) {
    if (Array.isArray(page["items"])) items = page["items"];
    else if (Array.isArray(page["data"])) items = page["data"];
    else items = [];
  } else {
    items = [];
  }
  const out: RawDoorEvent[] = [];
  for (const entry of items as unknown[]) {
    if (!isRecord(entry)) continue;
    const attrs = asRecord(entry["attributes"]);
    const source: RecordLike = Object.keys(attrs).length > 0 && Object.keys(entry).length <= 2 ? { ...attrs, ...entry } : entry;
    const type = readType(source);
    if (type === null) continue;
    const tsMs = readTsMs(source, attrs);
    if (!Number.isFinite(tsMs)) continue;
    const rawId = entry["id"] ?? attrs["id"];
    const id = typeof rawId === "string" || typeof rawId === "number"
      ? `hist:${rawId}`
      : `hist:${source["timestamp"] as string}:${deviceId}:${type}`;
    out.push({
      id,
      deviceId,
      componentId: readComponentId(source),
      type,
      ...(readSubType(source, type) ? { subType: "human" as const } : {}),
      tsMs,
      requestId: id,
      source: "history",
    });
  }
  return out;
}
