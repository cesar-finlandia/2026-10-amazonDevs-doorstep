// Requirement IDs: FR-10…FR-16
// Wire constants and samples. The only file to edit when the documentation differs from §5.1.
export const RING_API_BASE = "https://api.amazonvision.com";
export const RING_OAUTH_URL = "https://oauth.ring.com/oauth/token";
export const RING_LIMITS: {
  tps: 100; webhookAckMs: 5000; nonceWindowSec: 600;
  whepMaxSecBattery: 30; whepMaxSecLine: 60; clipMaxSec: 30;
} = { tps: 100, webhookAckMs: 5000, nonceWindowSec: 600, whepMaxSecBattery: 30, whepMaxSecLine: 60, clipMaxSec: 30 };

export const WIRE: {
  devices: string; deviceInclude: string; usersMe: string; appIntegrations: string; signaturePrefix: "sha256=";
  status(id: string): string; capabilities(id: string): string; location(id: string): string; configurations(id: string): string;
  history(id: string): string; whepSessions(id: string): string; imageDownload(id: string): string; videoDownload(id: string): string; audioPlayback(id: string): string;
} = {
  devices: "/v1/devices",
  deviceInclude: "status,capabilities,location,configurations",
  usersMe: "/v1/users/me",
  appIntegrations: "/v1/accounts/me/app-integrations",
  signaturePrefix: "sha256=",
  status: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/status`,
  capabilities: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/capabilities`,
  location: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/location`,
  configurations: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/configurations`,
  history: (id: string): string => `/v1/history/devices/${encodeURIComponent(id)}/events`,
  whepSessions: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/media/streaming/whep/sessions`,
  imageDownload: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/media/image/download`,
  videoDownload: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/media/video/download`,
  audioPlayback: (id: string): string => `/v1/devices/${encodeURIComponent(id)}/media/audio/playback`,
};

// WIRE NOTES (WU-01): re-verified 2026-10-05 against
// https://developer.amazon.com/docs/ring/api-documentation.html and the organizer's
// sample https://github.com/AmazonAppDev/ring-api-helloworld (README + scripts layout).
// Confirmed, no builder or sample change needed:
// - REST base https://api.amazonvision.com; OAuth POST https://oauth.ring.com/oauth/token
//   with grant_type=refresh_token form fields; reply { access_token, refresh_token, scope,
//   expires_in: 14400, token_type }; access ~4 h, refresh ~30 days, auth code 60 s.
// - Authorization: Bearer <token> on every REST call; 100 TPS per client id; 429 with
//   Retry-After; headers X-RateLimit-Limit / X-RateLimit-Remaining; JSON:API errors.
// - Webhooks: HTTPS POST, X-Signature HMAC-SHA256, 200 within 5 s, async processing,
//   repeats/out-of-order (de-duplicate on meta.request_id). The sample receiver posts the
//   flat { "event_type": "motion_detected", "device_id": "camera-1" } shape (kept verbatim
//   as WIRE_SAMPLES.webhookFlat; see friction log FL-1 — the committed parser skips it).
// - Event History GET /v1/history/devices/{id}/events with event_types query; items carry
//   attributes.event_type / attributes.start (wire values motion.human, ding, … are
//   normalized to domain types by LiveRingPort; see friction log FL-2).
// - Devices GET /v1/devices?include=status,capabilities,location,configurations (JSON:API)
//   plus per-device /status /capabilities[?component_id] /location /configurations.
// - WHEP POST SDP offer (Content-Type: application/sdp) → SDP answer + Location header,
//   DELETE closes; 30 s battery / 60 s line-powered. component_id query on multi-camera.
// - Snapshot POST …/media/image/download and clip POST …/media/video/download take a
//   components array in the body; chime POST …/media/audio/playback takes audio_ref.
// - Linking: GET /v1/users/me → account id; POST then PATCH /v1/accounts/me/app-integrations
//   with { account_identifier, nonce } / { status }. HMAC nonce, 600 s window.
export const WIRE_SAMPLES: Record<
  | "webhookMotion" | "webhookButton" | "webhookOffline" | "webhookFlat"
  | "devices" | "status" | "capabilitiesElite" | "capabilitiesDoorbell"
  | "location" | "configurations" | "history" | "token" | "usersMe"
  | "appIntegrationAwaiting" | "appIntegrationCompleted"
  | "errorUnauthorized" | "errorRateLimited",
  unknown
> = {
  webhookMotion: {
    event_id: "evt-0001", timestamp: "2026-10-13T09:14:05Z", type: "motion_detected",
    account_id: "acct-demo", device_id: "dev-door",
    attributes: { sub_type: "human", component_ids: [0] },
    meta: { request_id: "req-0001", time: "2026-10-13T09:14:06Z" },
  },
  webhookButton: {
    event_id: "evt-0002", timestamp: "2026-10-13T09:20:00Z", type: "button_press",
    account_id: "acct-demo", device_id: "dev-door",
    attributes: { component_ids: [0] },
    meta: { request_id: "req-0002", time: "2026-10-13T09:20:01Z" },
  },
  webhookOffline: {
    event_id: "evt-0003", timestamp: "2026-10-15T21:05:00Z", type: "device_offline",
    account_id: "acct-demo", device_id: "dev-elite",
    attributes: {},
    meta: { request_id: "req-0003", time: "2026-10-15T21:05:02Z" },
  },
  webhookFlat: { event_type: "motion_detected", device_id: "camera-1" },
  devices: {
    data: [
      {
        type: "device", id: "dev-door",
        attributes: { device_type: "doorbell", description: "Front door", owned: true, subscribed: true, component_ids: [0] },
        relationships: {
          status: { data: { type: "status", id: "dev-door" } },
          capabilities: { data: { type: "capabilities", id: "dev-door" } },
          location: { data: { type: "location", id: "dev-door" } },
          configurations: { data: { type: "configurations", id: "dev-door" } },
        },
      },
      {
        type: "device", id: "dev-elite",
        attributes: { device_type: "elite_camera", description: "Hall camera", owned: true, subscribed: true, component_ids: [0, 1] },
        relationships: {
          status: { data: { type: "status", id: "dev-elite" } },
          capabilities: { data: { type: "capabilities", id: "dev-elite" } },
          location: { data: { type: "location", id: "dev-elite" } },
          configurations: { data: { type: "configurations", id: "dev-elite" } },
        },
      },
    ],
    included: [
      { type: "status", id: "dev-door", attributes: { online: true, ac_power: false, battery: "ok" } },
      {
        type: "capabilities", id: "dev-door",
        attributes: {
          motion_detection: true, video_codecs: ["h264"], night_vision: "auto",
          chime_audio: { supported: true, slots: ["gentle_hello", "check_in_chime"] },
          whep: true, snapshot: true, components: [0],
        },
      },
      { type: "location", id: "dev-door", attributes: { country: "US", state: "CA", utc_offset_minutes: -420 } },
      {
        type: "configurations", id: "dev-door",
        attributes: { motion: { zones: 2 }, privacy: { zones: 1 }, chime: { volume: 5 } },
      },
      { type: "status", id: "dev-elite", attributes: { online: true, ac_power: true, battery: "full" } },
      {
        type: "capabilities", id: "dev-elite",
        attributes: {
          motion_detection: true, video_codecs: ["h264", "h265"], night_vision: "auto",
          chime_audio: { supported: false, slots: [] }, whep: true, snapshot: true, components: [0, 1],
        },
      },
      { type: "location", id: "dev-elite", attributes: { country: "US", state: "CA", utc_offset_minutes: -420 } },
      { type: "configurations", id: "dev-elite", attributes: { motion: { zones: 1 }, privacy: { zones: 0 } } },
    ],
  },
  status: {
    data: {
      type: "status", id: "dev-door",
      attributes: { online: "online", ac_power: false, battery: "low", chime_snoozed: false },
    },
  },
  capabilitiesElite: {
    data: {
      type: "capabilities", id: "dev-elite",
      attributes: {
        motion_detection: true, video_codecs: ["h264", "h265"], night_vision: "auto",
        chime_audio: false, whep: true, snapshot: true, components: [0, 1],
      },
    },
  },
  capabilitiesDoorbell: {
    data: {
      type: "capabilities", id: "dev-door",
      attributes: {
        motion_detection: true, video_codecs: ["h264"], night_vision: "auto",
        chime_audio: { supported: true, slots: ["gentle_hello", "check_in_chime"] },
        whep: true, snapshot: true, components: [0],
      },
    },
  },
  location: {
    data: { type: "location", id: "dev-door", attributes: { country: "US", state: "CA" } },
  },
  configurations: {
    data: {
      type: "configurations", id: "dev-door",
      attributes: { motion: { zones: 2 }, privacy: { zones: 1 }, label: "porch", enhanced: true },
    },
  },
  history: {
    data: [
      { type: "event", id: "h-3", attributes: { event_type: "motion.human", start: "2026-10-13T09:14:05Z", component_ids: [0] } },
      { type: "event", id: "h-2", attributes: { event_type: "ding", start: "2026-10-13T09:10:00Z" } },
      { type: "event", id: "h-1", attributes: { event_type: "motion.other", start: "2026-10-13T08:00:00Z", component_ids: [1] } },
    ],
    meta: { pagination: { limit: 50, offset: 0, total: 3 } },
  },
  token: { access_token: "access-A", refresh_token: "refresh-B", scope: "devices", expires_in: 14400, token_type: "Bearer" },
  usersMe: {
    data: { type: "user", id: "acct-demo", attributes: { name: "Demo Caretaker", email: "u***r@partner.example.com" } },
  },
  appIntegrationAwaiting: {
    data: { type: "app_integration", id: "ai-1", attributes: { status: "awaiting" } },
  },
  appIntegrationCompleted: {
    data: { type: "app_integration", id: "ai-1", attributes: { status: "completed" } },
  },
  errorUnauthorized: {
    errors: [{ status: "401", code: "unauthorized", title: "Unauthorized", detail: "The access token is missing or expired." }],
  },
  errorRateLimited: {
    errors: [{ status: "429", code: "rate_limited", title: "Too Many Requests", detail: "Slow down and retry after the indicated time." }],
  },
};
