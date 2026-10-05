// Requirement IDs: FR-01, FR-10…FR-15
// The ONE seam between the product and Ring. Implementations: BundleRingPort (this plan),
// LiveRingPort (DP-RING-INTEGRATION, Node only), HttpRingPort (DP-API-TRANSPORT, browser→server).
export class RingError extends Error {
  readonly status: number;          // HTTP status, or 0 for a network failure
  readonly code: string;            // "unauthorized" | "rate_limited" | "not_found" | "bad_request" | "network" | "unsupported" | "upstream"
  readonly retryAfterSec?: number;
  constructor(status: number, code: string, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "RingError";
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}
export interface RingStatus { online: boolean; acPower: boolean; battery: "full" | "ok" | "low" | "unknown"; chimeSnoozed?: boolean }
export interface RingCapabilities {
  motionDetection: boolean; videoCodecs: string[]; nightVision: string;
  chimeAudio: boolean; chimeAudioSlots: string[]; whep: boolean; snapshot: boolean; components: number[];
}
export interface RingLocation { name: string; utcOffsetMin: number }
export type RingConfigurations = Record<string, string | number | boolean>;
export interface RingDevice {
  id: string; kind: string; description: string; owned: boolean; subscribed: boolean;
  status: RingStatus; capabilities: RingCapabilities; location: RingLocation | null; configurations: RingConfigurations | null;
  componentIds: number[];
}
export interface RingHistoryItem { id: string; eventType: string; timestamp: string; subType?: string; componentIds: number[] }
export interface RingHistoryPage { items: RingHistoryItem[]; limit: number; offset: number; total: number }
export interface RingWebhookPayload {
  event_id: string; timestamp: string; type: string; account_id?: string; device_id: string;
  attributes?: { sub_type?: string; component_ids?: number[] };
  meta: { request_id: string; time?: string };
  simulated?: boolean;
}
export interface RingWhepSession { sessionId: string; answerSdp: string; sessionUri?: string; expiresInSec: number; maxSeconds: number }
export interface RingSnapshot { contentType: string; dataBase64: string; capturedAtMs: number; componentId: number; synthetic: boolean }
export interface RingClip { contentType: string; dataBase64: string; durationSec: number; synthetic: boolean }
export interface RingChimeResult { ok: true; audioRef: string; deviceId: string; simulated: boolean }

export interface RingPort {
  readonly mode: "bundle" | "live" | "http";
  /** GET /v1/devices?include=status,capabilities,location,configurations */
  listDevices(): Promise<RingDevice[]>;
  getStatus(deviceId: string): Promise<RingStatus>;
  /** GET /v1/devices/{id}/capabilities[?component_id=N] */
  getCapabilities(deviceId: string, componentId?: number): Promise<RingCapabilities>;
  getLocation(deviceId: string): Promise<RingLocation>;
  getConfigurations(deviceId: string): Promise<RingConfigurations>;
  /** GET /v1/history/devices/{id}/events — newest first. */
  getEventHistory(deviceId: string, q: { limit: number; offset: number; type?: string }): Promise<RingHistoryPage>;
  /** Webhook payloads received since the last drain (empties the inbox). */
  drainWebhookInbox(): Promise<RingWebhookPayload[]>;
  startWhep(deviceId: string, sdpOffer: string, componentId?: number): Promise<RingWhepSession>;
  stopWhep(deviceId: string, sessionId: string): Promise<void>;
  getSnapshot(deviceId: string, componentId?: number): Promise<RingSnapshot>;
  getClip(deviceId: string, q: { startMs: number; endMs: number; componentId?: number }): Promise<RingClip>;
  playChime(deviceId: string, audioRef: string): Promise<RingChimeResult>;
}
