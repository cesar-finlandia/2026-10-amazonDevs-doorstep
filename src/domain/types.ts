// Requirement IDs: FR-02, FR-03, FR-04, FR-17
// All domain types of Doorstep Rhythm. Single owner: DP-DOMAIN-ENGINE. Consumers import, never redeclare.

export type EventType = "motion_detected" | "button_press" | "device_online" | "device_offline";
export type EventChannel = "webhook" | "history";
export type ScopeName = "family_message" | "chime_announcement" | "weekly_brief";
export type IncidentKind = "quiet_hours_activity" | "long_dwell" | "device_outage" | "missed_routine" | "duplicate_burst";
export type IncidentStatus = "open" | "explained" | "resolved" | "dismissed";
export type NudgeStatus = "proposed" | "approved" | "rejected" | "sent" | "failed";
export type VisitKind = "arrival" | "delivery" | "linger";

/** Canonical parse target of every Ring payload (webhook or history item). */
export interface RawDoorEvent {
  id: string;                 // "evt:<requestId>" (webhook) | "hist:<historyId>" (history)
  deviceId: string;
  componentId: number;        // default 0
  type: EventType;
  subType?: "human";          // only on motion_detected
  tsMs: number;               // UTC epoch milliseconds
  requestId: string;          // webhook: meta.request_id; history: "hist:<historyId>"
  source: EventChannel;
}
export interface DoorEvent extends RawDoorEvent {
  merged?: string[];          // ids of duplicate events folded into this one by merge_duplicate_events
}

export interface QuietHours { startMin: number; endMin: number; toleranceMin: number } // minutes after local midnight; start 1320 = 22:00, end 420 = 07:00, tolerance 30
export interface Household { id: string; name: string; age: number; caretaker: string; utcOffsetMin: number; quietHours: QuietHours; blurb: string }
export interface Device {
  id: string; kind: string; description: string; online: boolean; acPower: boolean; battery: string;
  componentIds: number[]; chimeAudio: boolean; whep: boolean; snapshot: boolean;
}
export interface Visit {
  id: string;                 // "vis:<startMs>"
  startMs: number; endMs: number; dwellSec: number;
  eventIds: string[];
  hops: string[];             // ordered distinct "<deviceId>:<componentId>" the visit passed through
  kind: VisitKind;
  routineId?: string;
  label: string;              // e.g. "Visit · 6 min"
}
export interface Routine { id: string; name: string; windowStartMin: number; windowEndMin: number; days: number[]; /* 0=Mon..6=Sun */ expect: "visit" }
export interface ConsentScope { scope: ScopeName; granted: boolean; grantedAtMs?: number; grantedBy?: "human" }
export interface Nudge { id: string; scope: ScopeName; incidentId?: string; text: string; status: NudgeStatus; createdMs: number; detail?: string }
export interface Incident {
  id: string; kind: IncidentKind; status: IncidentStatus; title: string;
  eventIds: string[]; routineId?: string; dayIndex?: number;
  startMs: number; endMs: number; summary?: string; createdMs: number;
}
export interface Note { id: string; incidentId?: string; author: "agent" | "human"; text: string; tsMs: number }
export interface MediaRef { id: string; incidentId: string; deviceId: string; componentId: number; kind: "snapshot" | "clip"; contentType: string; dataBase64: string; tsMs: number; label: string; synthetic: boolean }
export interface WebhookReceipt { requestId: string; type: EventType; deviceId: string; tsMs: number; receivedMs: number }
export interface LedgerEntry { seq: number; action: string; entityIds: string[]; summary: string; tsMs: number }
export interface Baseline {
  dwellP90Sec: number; dwellMedianSec: number; sampleVisits: number;
  rhythm: number[][];         // [weekday 0..6][hour 0..23] = average visits per baseline week
  fromMs: number; toMs: number;
}
export interface UiState { selectedDay: number | null; selectedIncidentId: string | null; shotId: string; liveViewDeviceId: string | null }
export interface DataWindow { startMs: number; endMs: number; baselineStartMs: number; baselineEndMs: number }

export interface WeekModel {
  household: Household;
  devices: Device[];
  events: DoorEvent[];
  visits: Visit[];
  visitOverrides: Record<string, string>;   // visitId -> routineId set by link_visit_routine
  routines: Routine[];
  consent: ConsentScope[];                  // exactly three entries, one per ScopeName
  nudges: Nudge[];
  incidents: Incident[];
  notes: Note[];
  media: MediaRef[];
  webhookLedger: WebhookReceipt[];
  ledger: LedgerEntry[];
  baseline: Baseline;
  window: DataWindow;
  clockMs: number;
  ui: UiState;
  synthetic: boolean;                       // true for the bundled sample week
}
