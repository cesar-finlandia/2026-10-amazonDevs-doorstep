// Requirement IDs: HEE-SHOW-01, HEE-SHOW-04
// DP-W09 §3.5 replay core: plan + player types (kit showcase-replay, original work).
// The player only reads the TraceLike it is given; it never touches the real trace.

export type ReplayStep =
  | { type: "call"; seq: number; name: string; args: Record<string, unknown>; recorded_ok: boolean; wait_ms: number }
  | { type: "banner"; seq: number; text: string; wait_ms: number };

export interface TraceEntryLike {
  seq: number;
  round: number;
  kind: "model" | "action" | "approval" | "system";
  name: string;
  source: "agent" | "human" | "system";
  ok: boolean;
  latency_ms: number;
  decision?: string;
  args?: Record<string, unknown>;
}

export interface TraceLike {
  run_id: string;
  started_at: string;
  entries: TraceEntryLike[];
}

export interface ReplaySession {
  registry: {
    call(
      name: string,
      args: unknown,
      opts: { source: "agent" | "human" | "system"; round?: number },
    ): Promise<{ ok: boolean; summary: string }>;
  };
  gate: { setEnabled(on: boolean): void; isEnabled(): boolean };
}

export type ReplayStatus = "idle" | "playing" | "paused" | "done" | "stopped" | "diverged";

export interface ReplayState {
  status: ReplayStatus;
  index: number;
  total: number;
  message: string;
}

export interface ReplayPlayer {
  play(): Promise<ReplayState>;
  pause(): void;
  resume(): void;
  stop(): void;
  state(): ReplayState;
}
