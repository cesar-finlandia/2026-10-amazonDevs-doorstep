// Requirement IDs: FR-01
// Deterministic synthetic event generator, channel split and bundle builder.
// Every number below comes from DP-DOMAIN-ENGINE §5.3; the schedule table there is normative.
import { DAY_MS } from "src/domain/time.js";
import type { RawDoorEvent, Routine } from "src/domain/types.js";
import type {
  RingDevice,
  RingHistoryPage,
  RingSnapshot,
  RingWebhookPayload,
} from "src/domain/ring-port.js";

export const SEED = 20261005;
export const UTC_OFFSET_MIN = -420;
export const BUNDLE_START_MS: number = Date.UTC(2026, 9, 5, 7, 0, 0); // Monday 5 Oct 2026, 00:00 local
export const WEBHOOK_SILENCE_MS: number = Date.UTC(2026, 9, 15, 21, 2, 30); // Thursday 15 Oct 2026 14:02:30 local (UTC-7)

export const ROUTINES: Routine[] = [
  { id: "rtn-paper", name: "Morning paper", windowStartMin: 465, windowEndMin: 500, days: [0, 1, 2, 3, 4, 5, 6], expect: "visit" },
  { id: "rtn-walk", name: "Afternoon walk", windowStartMin: 905, windowEndMin: 970, days: [0, 1, 2, 3, 4, 5, 6], expect: "visit" },
  { id: "rtn-nurse", name: "Nurse visit", windowStartMin: 535, windowEndMin: 575, days: [2], expect: "visit" },
  { id: "rtn-lunch", name: "Sunday lunch", windowStartMin: 720, windowEndMin: 770, days: [6], expect: "visit" },
];

/** FNV-1a (32-bit) string hash: the stream key for one (day, block) schedule. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 seeded PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RingBundle {
  meta: { synthetic: true; generator: string; seed: number; startMs: number; days: number; license: "MIT"; description: string };
  devices: RingDevice[];
  inbox: RingWebhookPayload[];                       // webhook channel, review window only, tsMs <= WEBHOOK_SILENCE_MS
  history: Record<string, RingHistoryPage[]>;        // deviceId -> pages of limit 50, newest first, whole 14 days
  snapshots: Record<string, RingSnapshot>;           // key "<deviceId>:<componentId>"
}

/** Deterministic: same input, same output, byte for byte. */
export function generateEvents(variant: "clean" | "demo"): RawDoorEvent[] {
  const events: RawDoorEvent[] = [];
  let n = 0;
  const push = (
    day: number,
    minute: number,
    sec: number,
    deviceId: string,
    componentId: number,
    type: RawDoorEvent["type"],
    human: boolean,
    extraMs = 0,
  ): void => {
    const tsMs = BUNDLE_START_MS + day * DAY_MS + (minute * 60 + sec) * 1000 + extraMs;
    n += 1;
    events.push({
      id: `evt:req-${n}`,
      deviceId,
      componentId,
      type,
      ...(human && type === "motion_detected" ? { subType: "human" as const } : {}),
      tsMs,
      requestId: `req-${n}`,
      source: "webhook",
    });
  };
  // Incidental second-motion dwell offsets (minutes) per weekday; the visit they form
  // carries the dwell, so the baseline p90 lands exactly on 420 s (§5.4).
  const INCIDENTAL: Record<number, { base: number; offsets: number[] }> = {
    0: { base: 680, offsets: [0, 2] }, // Mon 11:20
    1: { base: 1025, offsets: [0, 3, 7] }, // Tue 17:05 (t, t+3, t+7)
    2: { base: 760, offsets: [0, 3] }, // Wed 12:40
    3: { base: 630, offsets: [0, 4] }, // Thu 10:30
    4: { base: 790, offsets: [0, 5] }, // Fri 13:10
    5: { base: 660, offsets: [0, 9] }, // Sat 11:00
  };

  for (let d = 0; d < 14; d++) {
    const weekday = d % 7;
    if (d === 0) {
      push(0, 420, 0, "dev-door", 0, "device_online", false);
      push(0, 420, 0, "dev-elite", 0, "device_online", false);
    }
    const demo = variant === "demo";
    if (!(demo && d === 11)) {
      // paper: 07:50 + 0–25 min, dev-door 0, motion ×1
      const rng = mulberry32(fnv1a(`${SEED}:${d}:paper`));
      const sec = Math.floor(rng() * 50) + 5;
      push(d, 470 + Math.floor(rng() * 26), sec, "dev-door", 0, "motion_detected", true);
    }
    {
      // walk-out: 15:10 + 0–10; return +33–45 min; hall mirror +20 s on dev-elite 0
      const rng = mulberry32(fnv1a(`${SEED}:${d}:walk`));
      const sec = Math.floor(rng() * 50) + 5;
      const outMin = 910 + Math.floor(rng() * 11);
      const retMin = outMin + 33 + Math.floor(rng() * 13);
      push(d, outMin, sec, "dev-door", 0, "motion_detected", true);
      push(d, retMin, sec, "dev-door", 0, "motion_detected", true);
      push(d, retMin, sec, "dev-elite", 0, "motion_detected", true, 20_000);
    }
    {
      // incidental: literal times, dev-door 0
      const spec = INCIDENTAL[weekday];
      if (spec) {
        const rng = mulberry32(fnv1a(`${SEED}:${d}:incidental`));
        const sec = Math.floor(rng() * 50) + 5;
        for (const off of spec.offsets) push(d, spec.base + off, sec, "dev-door", 0, "motion_detected", true);
      }
    }
    {
      // evening porch: 19:32 + 0–8, dev-door 0, motion ×1
      const rng = mulberry32(fnv1a(`${SEED}:${d}:porch`));
      const sec = Math.floor(rng() * 50) + 5;
      push(d, 1172 + Math.floor(rng() * 9), sec, "dev-door", 0, "motion_detected", true);
    }
    {
      // gate: 17:40 + 0–20, dev-elite 1, non-human motion (cat/wind)
      const rng = mulberry32(fnv1a(`${SEED}:${d}:gate`));
      const sec = Math.floor(rng() * 50) + 5;
      push(d, 1060 + Math.floor(rng() * 21), sec, "dev-elite", 1, "motion_detected", false);
    }
    if (weekday === 2) {
      // nurse: Wed 09:02 + {0, +7, +14, +25 min}, dev-door 0
      const rng = mulberry32(fnv1a(`${SEED}:${d}:nurse`));
      const sec = Math.floor(rng() * 50) + 5;
      for (const off of [0, 7, 14, 25]) push(d, 542 + off, sec, "dev-door", 0, "motion_detected", true);
    }
    if (weekday === 6) {
      // lunch: Sun 12:05 + {0, +10 … +40 min}, dev-door 0
      const rng = mulberry32(fnv1a(`${SEED}:${d}:lunch`));
      const sec = Math.floor(rng() * 50) + 5;
      for (const off of [0, 10, 20, 30, 40]) push(d, 725 + off, sec, "dev-door", 0, "motion_detected", true);
    }
    if (d === 10) {
      // engineer: Thu 14:01:50, 14:02:10, 14:02:30, dev-door 0 — both variants; last webhook
      push(10, 841, 50, "dev-door", 0, "motion_detected", true);
      push(10, 842, 10, "dev-door", 0, "motion_detected", true);
      push(10, 842, 30, "dev-door", 0, "motion_detected", true);
    }
    if (demo && d === 8) {
      // Tue linger: dev-door 02:14:05, 02:19:40, 02:36:15 and dev-elite comp 1 at 02:27:10
      push(8, 134, 5, "dev-door", 0, "motion_detected", true);
      push(8, 139, 40, "dev-door", 0, "motion_detected", true);
      push(8, 156, 15, "dev-door", 0, "motion_detected", true);
      push(8, 147, 10, "dev-elite", 1, "motion_detected", true);
    }
    if (demo && d === 10) {
      // Thu dev-elite offline 14:05:00 and online 14:52:00
      push(10, 845, 0, "dev-elite", 0, "device_offline", false);
      push(10, 892, 0, "dev-elite", 0, "device_online", false);
    }
  }
  return events;
}

/** Absolute day index of an instant within the 14-day window (0..13). */
function bundleDayIndex(tsMs: number): number {
  return Math.floor((tsMs - BUNDLE_START_MS) / DAY_MS);
}

/** Splits the demo events into the webhook inbox payloads and the paged history. */
export function splitChannels(events: RawDoorEvent[]): { inbox: RingWebhookPayload[]; history: Record<string, RingHistoryPage[]> } {
  const inbox: RingWebhookPayload[] = [];
  const byDevice = new Map<string, RawDoorEvent[]>();
  for (const e of events) {
    const day = bundleDayIndex(e.tsMs);
    if (day >= 7 && day <= 13 && e.tsMs <= WEBHOOK_SILENCE_MS) {
      inbox.push({
        event_id: `wh-${e.requestId}`,
        timestamp: new Date(e.tsMs).toISOString(),
        type: e.type,
        device_id: e.deviceId,
        attributes: {
          ...(e.subType ? { sub_type: e.subType } : {}),
          component_ids: [e.componentId],
        },
        meta: { request_id: e.requestId },
        simulated: true,
      });
    }
    const list = byDevice.get(e.deviceId) ?? [];
    list.push(e);
    byDevice.set(e.deviceId, list);
  }
  const history: Record<string, RingHistoryPage[]> = {};
  for (const [deviceId, list] of byDevice) {
    const sorted = [...list].sort((a, b) => b.tsMs - a.tsMs || (a.id < b.id ? 1 : -1));
    const pages: RingHistoryPage[] = [];
    for (let i = 0; i < sorted.length; i += 50) {
      const items = sorted.slice(i, i + 50).map((e) => ({
        id: e.requestId,
        eventType: e.type,
        timestamp: new Date(e.tsMs).toISOString(),
        ...(e.subType ? { subType: e.subType } : {}),
        componentIds: [e.componentId],
      }));
      pages.push({ items, limit: 50, offset: i, total: sorted.length });
    }
    history[deviceId] = pages;
  }
  return { inbox, history };
}

export function buildDevices(): RingDevice[] {
  return [
    {
      id: "dev-door", kind: "doorbell", description: "Front door", owned: true, subscribed: true,
      status: { online: true, acPower: true, battery: "full" },
      capabilities: {
        motionDetection: true, videoCodecs: ["h264"], nightVision: "infrared",
        chimeAudio: true, chimeAudioSlots: ["default", "delivery", "custom"], whep: true, snapshot: true, components: [0],
      },
      location: { name: "Home", utcOffsetMin: UTC_OFFSET_MIN },
      configurations: { motionSensitivity: "high", nightVision: true },
      componentIds: [0],
    },
    {
      id: "dev-elite", kind: "elite_camera", description: "Hall camera", owned: true, subscribed: true,
      status: { online: true, acPower: true, battery: "full" },
      capabilities: {
        motionDetection: true, videoCodecs: ["h264"], nightVision: "infrared",
        chimeAudio: false, chimeAudioSlots: [], whep: true, snapshot: true, components: [0, 1],
      },
      location: { name: "Home", utcOffsetMin: UTC_OFFSET_MIN },
      configurations: { motionSensitivity: "medium", nightVision: true },
      componentIds: [0, 1],
    },
  ];
}

export function buildBundle(): RingBundle {
  const events = generateEvents("demo");
  const { inbox, history } = splitChannels(events);
  const snapshots: Record<string, RingSnapshot> = {};
  snapshots["dev-door:0"] = {
    contentType: "image/jpeg",
    dataBase64: "AA==",
    capturedAtMs: BUNDLE_START_MS + 7 * DAY_MS,
    componentId: 0,
    synthetic: true,
  };
  snapshots["dev-elite:0"] = {
    contentType: "image/jpeg",
    dataBase64: "AA==",
    capturedAtMs: BUNDLE_START_MS + 7 * DAY_MS,
    componentId: 0,
    synthetic: true,
  };
  snapshots["dev-elite:1"] = {
    contentType: "image/jpeg",
    dataBase64: "AA==",
    capturedAtMs: BUNDLE_START_MS + 7 * DAY_MS,
    componentId: 1,
    synthetic: true,
  };
  return {
    meta: {
      synthetic: true,
      generator: "dp-domain-engine-generator/1",
      seed: SEED,
      startMs: BUNDLE_START_MS,
      days: 14,
      license: "MIT",
      description: "Synthetic two-week doorstep rhythm: no real household data exists, so the demo story is data.",
    },
    devices: buildDevices(),
    inbox,
    history,
    snapshots,
  };
}
