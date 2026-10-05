// Requirement IDs: FR-10, FR-12…FR-15, FR-17
// LiveRingPort: the RingPort seam answered by the real Ring REST API
// (server-side only). All readers are tolerant: a missing field gets a default.
import type {
  RingCapabilities, RingConfigurations, RingDevice, RingHistoryItem, RingHistoryPage,
  RingLocation, RingPort, RingStatus,
} from "src/domain/ring-port.js";
import { RingError } from "src/domain/ring-port.js";
import type { RingHttp } from "src/ring/client.js";
import type { Inbox } from "src/ring/inbox.js";
import { RING_LIMITS, WIRE } from "src/ring/wire.js";

export interface LiveRingPortDeps { http: RingHttp; inbox: Inbox; sessionId?: string; now?: () => number }
export type LiveRingPort = RingPort & { readonly mode: "live"; openSessions(): string[]; closeAll(): Promise<void> };

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): RecordLike {
  return isRecord(value) ? value : {};
}

function child(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function attributesOf(doc: unknown): RecordLike {
  const fromData = child(child(doc, "data"), "attributes");
  if (isRecord(fromData)) return fromData;
  const direct = child(doc, "attributes");
  return isRecord(direct) ? direct : {};
}

function includedBy(doc: unknown): Map<string, RecordLike> {
  const map = new Map<string, RecordLike>();
  const included = child(doc, "included");
  if (Array.isArray(included)) {
    for (const entry of included) {
      if (isRecord(entry) && typeof entry["type"] === "string" && typeof entry["id"] === "string") {
        const attrs = child(entry, "attributes");
        map.set(`${entry["type"]}:${entry["id"]}`, isRecord(attrs) ? attrs : {});
      }
    }
  }
  return map;
}

function relatedAttributes(doc: unknown, name: string, type: string, id: string): RecordLike {
  const rel = child(child(child(doc, "data"), "relationships"), name);
  const refId = child(child(rel, "data"), "id");
  const index = includedBy(doc);
  if (typeof refId === "string") {
    const byRef = index.get(`${type}:${refId}`);
    if (byRef !== undefined) return byRef;
  }
  return index.get(`${type}:${id}`) ?? {};
}

function mapStatus(attrs: RecordLike): RingStatus {
  const online = attrs["online"];
  const status: RingStatus = {
    online: online === true || online === "online",
    acPower: attrs["ac_power"] === true,
    battery: attrs["battery"] === "full" || attrs["battery"] === "ok" || attrs["battery"] === "low"
      ? (attrs["battery"] as RingStatus["battery"])
      : "unknown",
  };
  if (attrs["chime_snoozed"] !== undefined) status.chimeSnoozed = attrs["chime_snoozed"] as boolean | undefined;
  return status;
}

function mapCapabilities(attrs: RecordLike, fallbackComponents: number[]): RingCapabilities {
  const chime = attrs["chime_audio"];
  const chimeObj = record(chime);
  const supported = chime === true || chimeObj["supported"] === true;
  const slotsRaw = Array.isArray(chimeObj["slots"])
    ? (chimeObj["slots"] as unknown[])
    : Array.isArray(attrs["chime_audio_slots"])
      ? (attrs["chime_audio_slots"] as unknown[])
      : [];
  const componentsRaw = Array.isArray(attrs["components"]) ? (attrs["components"] as unknown[]) : fallbackComponents;
  return {
    motionDetection: attrs["motion_detection"] === true,
    videoCodecs: Array.isArray(attrs["video_codecs"]) ? (attrs["video_codecs"] as string[]) : [],
    nightVision: String(attrs["night_vision"] ?? "unknown"),
    chimeAudio: supported,
    chimeAudioSlots: slotsRaw.map((slot) => String(slot)),
    whep: attrs["whep"] === true,
    snapshot: attrs["snapshot"] === true,
    components: componentsRaw.map((component) => Number(component)),
  };
}

function mapLocation(attrs: RecordLike): RingLocation {
  const state = typeof attrs["state"] === "string" ? (attrs["state"] as string) : "";
  const country = typeof attrs["country"] === "string" ? (attrs["country"] as string) : "";
  const name = [state, country].filter((part) => part.length > 0).join(", ");
  return { name: name.length > 0 ? name : "unknown", utcOffsetMin: Number(attrs["utc_offset_minutes"] ?? 0) };
}

function flattenConfigurations(attrs: RecordLike, prefix: string, out: RingConfigurations): void {
  for (const [key, value] of Object.entries(attrs)) {
    const dotted = prefix.length > 0 ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      flattenConfigurations(value as RecordLike, dotted, out);
    } else if (Array.isArray(value)) {
      out[dotted] = JSON.stringify(value);
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[dotted] = value;
    }
  }
}

/** Wire event_type → domain event type (FL-2: wire values like motion.human/ding are not domain types). */
export function wireEventType(raw: unknown): string {
  if (typeof raw !== "string") return "";
  switch (raw.toLowerCase()) {
    case "motion":
    case "motion_detected":
    case "motion.human":
    case "motion.other":
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
      return raw;
  }
}

/** Domain event type → wire event_types filter value. */
export function wireEventFilter(type: string): string {
  switch (type) {
    case "motion_detected":
      return "motion";
    case "button_press":
      return "ding";
    case "device_online":
      return "online";
    case "device_offline":
      return "offline";
    default:
      return type;
  }
}

function mapHistoryItem(item: unknown): RingHistoryItem {
  const entry = record(item);
  const attrs = record(entry["attributes"]);
  const wireType = typeof attrs["event_type"] === "string" ? (attrs["event_type"] as string) : "";
  const subType = wireType.endsWith(".human") || attrs["sub_type"] === "human" ? "human" as const : undefined;
  const componentIds = Array.isArray(attrs["component_ids"])
    ? (attrs["component_ids"] as unknown[]).map((component) => Number(component))
    : [0];
  const timestamp = typeof attrs["start"] === "string"
    ? (attrs["start"] as string)
    : typeof attrs["timestamp"] === "string"
      ? (attrs["timestamp"] as string)
      : "";
  const mapped: RingHistoryItem = {
    id: typeof entry["id"] === "string" ? (entry["id"] as string) : "",
    eventType: wireEventType(wireType),
    timestamp,
    componentIds,
  };
  if (subType !== undefined) mapped.subType = subType;
  return mapped;
}

function mapDevice(item: unknown, doc: unknown): RingDevice {
  const entry = record(item);
  const id = String(entry["id"] ?? "");
  const attrs = record(entry["attributes"]);
  const capsAttrs = relatedAttributes(doc, "capabilities", "capabilities", id);
  const componentIds = Array.isArray(attrs["component_ids"])
    ? (attrs["component_ids"] as unknown[]).map((component) => Number(component))
    : Array.isArray(capsAttrs["components"])
      ? ((capsAttrs["components"] as unknown[]).map((component) => Number(component)) as number[])
      : [0];
  const statusAttrs = relatedAttributes(doc, "status", "status", id);
  const locationAttrs = relatedAttributes(doc, "location", "location", id);
  const configurationsAttrs = relatedAttributes(doc, "configurations", "configurations", id);
  const configurations: RingConfigurations | null = Object.keys(configurationsAttrs).length > 0
    ? (() => {
      const out: RingConfigurations = {};
      flattenConfigurations(configurationsAttrs, "", out);
      return out;
    })()
    : null;
  return {
    id,
    kind: String(attrs["device_type"] ?? attrs["type"] ?? entry["type"] ?? id),
    description: String(attrs["description"] ?? attrs["name"] ?? id),
    owned: attrs["owned"] === undefined ? true : attrs["owned"] === true,
    subscribed: attrs["subscribed"] === undefined ? true : attrs["subscribed"] === true,
    status: Object.keys(statusAttrs).length > 0 ? mapStatus(statusAttrs) : { online: true, acPower: false, battery: "unknown" },
    capabilities: Object.keys(capsAttrs).length > 0
      ? mapCapabilities(capsAttrs, componentIds)
      : {
        motionDetection: false, videoCodecs: [], nightVision: "unknown", chimeAudio: false,
        chimeAudioSlots: [], whep: false, snapshot: false, components: componentIds,
      },
    location: Object.keys(locationAttrs).length > 0 ? mapLocation(locationAttrs) : null,
    configurations,
    componentIds,
  };
}

export function createLiveRingPort(deps: LiveRingPortDeps): LiveRingPort {
  const http = deps.http;
  const inbox = deps.inbox;
  const sessionId = deps.sessionId ?? "default";
  const now = deps.now ?? Date.now;
  const sessions = new Map<string, string>();
  const capabilityCache = new Map<string, { caps: RingCapabilities; atMs: number }>();

  async function getCapabilities(deviceId: string, componentId?: number): Promise<RingCapabilities> {
    const res = await http.get(WIRE.capabilities(deviceId), componentId === undefined ? undefined : { component_id: componentId });
    return mapCapabilities(attributesOf(res.json), [0]);
  }

  async function cachedCapabilities(deviceId: string): Promise<RingCapabilities> {
    const held = capabilityCache.get(deviceId);
    if (held !== undefined && now() - held.atMs < 60_000) return held.caps;
    const caps = await getCapabilities(deviceId);
    capabilityCache.set(deviceId, { caps, atMs: now() });
    return caps;
  }

  const port: LiveRingPort = {
    mode: "live",
    listDevices: async (): Promise<RingDevice[]> => {
      const res = await http.get(WIRE.devices, { include: WIRE.deviceInclude });
      const data = child(res.json, "data");
      if (!Array.isArray(data)) return [];
      return data.map((item) => mapDevice(item, res.json));
    },
    getStatus: async (deviceId: string): Promise<RingStatus> => {
      const res = await http.get(WIRE.status(deviceId));
      return mapStatus(attributesOf(res.json));
    },
    getCapabilities,
    getLocation: async (deviceId: string): Promise<RingLocation> => {
      const res = await http.get(WIRE.location(deviceId));
      return mapLocation(attributesOf(res.json));
    },
    getConfigurations: async (deviceId: string): Promise<RingConfigurations> => {
      const res = await http.get(WIRE.configurations(deviceId));
      const out: RingConfigurations = {};
      flattenConfigurations(attributesOf(res.json), "", out);
      return out;
    },
    getEventHistory: async (deviceId: string, q: { limit: number; offset: number; type?: string }): Promise<RingHistoryPage> => {
      const query: Record<string, string | number | undefined> = { limit: q.limit, offset: q.offset };
      if (q.type !== undefined) query["event_types"] = wireEventFilter(q.type);
      const res = await http.get(WIRE.history(deviceId), query);
      const data = child(res.json, "data");
      const items = Array.isArray(data) ? data.map((item) => mapHistoryItem(item)) : [];
      items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
      const pagination = child(child(res.json, "meta"), "pagination");
      const totalRaw = child(pagination, "total");
      const total = typeof totalRaw === "number" ? totalRaw : q.offset + items.length;
      return { items, limit: q.limit, offset: q.offset, total };
    },
    drainWebhookInbox: (): Promise<import("src/domain/ring-port.js").RingWebhookPayload[]> =>
      Promise.resolve(inbox.drain(sessionId)),
    startWhep: async (deviceId: string, sdpOffer: string, componentId?: number) => {
      let maxSeconds: number = RING_LIMITS.whepMaxSecBattery;
      try {
        const status = await port.getStatus(deviceId);
        maxSeconds = status.acPower ? RING_LIMITS.whepMaxSecLine : RING_LIMITS.whepMaxSecBattery;
      } catch {
        maxSeconds = RING_LIMITS.whepMaxSecBattery;
      }
      const res = await http.post(WIRE.whepSessions(deviceId), undefined, {
        body: sdpOffer,
        contentType: "application/sdp",
        accept: "application/sdp",
        query: componentId === undefined ? undefined : { component_id: componentId },
      });
      if (res.status !== 200 && res.status !== 201) {
        throw new RingError(res.status, "upstream", "Ring did not start a live session.");
      }
      const location = res.headers["location"] ?? "";
      if (location.length === 0) {
        throw new RingError(502, "upstream", "Ring did not return a session address.");
      }
      const sessionUri = new URL(location, http.baseUrl).toString();
      const segments = sessionUri.split("/");
      const createdId = segments[segments.length - 1] as string;
      sessions.set(createdId, sessionUri);
      return { sessionId: createdId, answerSdp: res.text, sessionUri, expiresInSec: maxSeconds, maxSeconds };
    },
    stopWhep: async (deviceId: string, stopSessionId: string): Promise<void> => {
      const uri = sessions.get(stopSessionId) ?? `${WIRE.whepSessions(deviceId)}/${stopSessionId}`;
      try {
        await http.del(uri);
      } catch (error) {
        if (!(error instanceof RingError && error.code === "not_found")) throw error;
      }
      sessions.delete(stopSessionId);
    },
    getSnapshot: async (deviceId: string, componentId = 0) => {
      const res = await http.post(
        WIRE.imageDownload(deviceId),
        { format: "jpeg", components: [componentId] },
        { accept: "image/jpeg, image/png, application/json" },
      );
      const contentType = res.headers["content-type"] ?? "";
      if (contentType.startsWith("image/")) {
        return {
          contentType,
          dataBase64: Buffer.from(res.bytes).toString("base64"),
          capturedAtMs: now(),
          componentId,
          synthetic: false,
        };
      }
      if (res.json !== null) {
        const attrs = attributesOf(res.json);
        const embedded = attrs["image"] ?? attrs["content"];
        if (typeof embedded === "string" && embedded.length > 0) {
          return {
            contentType: typeof attrs["content_type"] === "string" ? (attrs["content_type"] as string) : "image/jpeg",
            dataBase64: embedded,
            capturedAtMs: now(),
            componentId,
            synthetic: false,
          };
        }
      }
      throw new RingError(502, "upstream", "Ring returned no image.");
    },
    getClip: async (deviceId: string, clipQuery: { startMs: number; endMs: number; componentId?: number }) => {
      const durationMs = clipQuery.endMs - clipQuery.startMs;
      if (!(durationMs > 0) || durationMs > RING_LIMITS.clipMaxSec * 1000) {
        throw new RingError(400, "bad_request", "A clip can be at most 30 seconds.");
      }
      const res = await http.post(
        WIRE.videoDownload(deviceId),
        {
          start: new Date(clipQuery.startMs).toISOString(),
          end: new Date(clipQuery.endMs).toISOString(),
          components: [clipQuery.componentId ?? 0],
        },
        { accept: "video/mp4, application/json" },
      );
      return {
        contentType: "video/mp4",
        dataBase64: Buffer.from(res.bytes).toString("base64"),
        durationSec: durationMs / 1000,
        synthetic: false,
      };
    },
    playChime: async (deviceId: string, audioRef: string) => {
      const caps = await cachedCapabilities(deviceId);
      if (!caps.chimeAudio) {
        throw new RingError(400, "unsupported", "This device cannot play audio.");
      }
      const res = await http.post(WIRE.audioPlayback(deviceId), { audio_ref: audioRef });
      if (res.status !== 200 && res.status !== 202 && res.status !== 204) {
        throw new RingError(res.status, "upstream", `Ring returned ${res.status}`);
      }
      return { ok: true as const, audioRef, deviceId, simulated: false };
    },
    openSessions: (): string[] => [...sessions.keys()],
    closeAll: async (): Promise<void> => {
      for (const id of [...sessions.keys()]) {
        const uri = sessions.get(id) as string;
        try {
          await http.del(uri);
        } catch (error) {
          if (!(error instanceof RingError && error.code === "not_found")) throw error;
        }
        sessions.delete(id);
      }
    },
  };
  return port;
}
