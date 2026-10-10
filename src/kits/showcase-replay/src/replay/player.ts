// Requirement IDs: HEE-SHOW-01, HEE-SHOW-04
// DP-W09 §3.5 createReplayPlayer: labelled replay over a session's registry.
// Recorded approvals show as banners; the approval gate is disabled during play
// and restored afterwards. The player never writes the real trace.
import { planReplay } from "./plan.js";
import type { ReplayPlayer, ReplaySession, ReplayState, TraceLike } from "./types.js";

export interface ReplayPlayerOpts {
  session: ReplaySession;
  trace: TraceLike;
  speed?: number;
  sleep?: (ms: number) => Promise<void>;
  onState?: (state: ReplayState) => void;
  onBanner?: (text: string) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createReplayPlayer(opts: ReplayPlayerOpts): ReplayPlayer {
  const speed = opts.speed ?? 1;
  const sleep = opts.sleep ?? delay;
  const steps = planReplay(opts.trace);
  let status: ReplayState["status"] = "idle";
  let index = 0;
  let message = "";

  const emit = (): ReplayState => {
    const state: ReplayState = { status, index, total: steps.length, message };
    opts.onState?.(state);
    return state;
  };

  const player: ReplayPlayer = {
    play: async () => {
      if (status === "playing" || status === "paused") return { status, index, total: steps.length, message };
      status = "playing";
      index = 0;
      message = "";
      emit();
      const wasEnabled = opts.session.gate.isEnabled();
      opts.session.gate.setEnabled(false);
      try {
        for (let i = 0; i < steps.length; i++) {
          if (status === "stopped") break;
          while (status === "paused") {
            await delay(50);
          }
          if (status === "stopped") break;
          const step = steps[i] as (typeof steps)[number];
          index = i;
          emit();
          await sleep(step.wait_ms / speed);
          if (status === "stopped") break;
          if (step.type === "banner") {
            opts.onBanner?.(step.text);
          } else {
            const entry = opts.trace.entries.find((e) => e.seq === step.seq);
            const round = entry?.round;
            const result = await opts.session.registry.call(step.name, step.args, {
              source: "agent",
              ...(round !== undefined ? { round } : {}),
            });
            if (result.ok !== step.recorded_ok) {
              status = "diverged";
              index = i + 1;
              message = `Replay diverged at step ${i + 1}: the live application answered differently from the recording.`;
              emit();
              break;
            }
          }
          index = i + 1;
        }
        if (status === "playing") {
          status = "done";
          message = "Replay finished. Nothing above was live.";
          emit();
        } else if (status === "stopped") {
          message = "Replay stopped.";
          emit();
        }
      } finally {
        opts.session.gate.setEnabled(wasEnabled);
      }
      return { status, index, total: steps.length, message };
    },
    pause: () => {
      if (status === "playing") {
        status = "paused";
        emit();
      }
    },
    resume: () => {
      if (status === "paused") {
        status = "playing";
        emit();
      }
    },
    stop: () => {
      if (status === "playing" || status === "paused") {
        status = "stopped";
        emit();
      }
    },
    state: () => ({ status, index, total: steps.length, message }),
  };
  return player;
}
