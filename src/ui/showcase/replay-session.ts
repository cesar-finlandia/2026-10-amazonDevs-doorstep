// src/ui/showcase/replay-session.ts — DP-SHOWCASE WU-03.
// Adapts the app Session to the showcase-replay kit's ReplaySession input.
// The player drives every call through this adapter; the live trace is never
// touched by the replay path.
import type { Session } from "src/domain/session.js";
import type { ReplaySession } from "src/kits/showcase-replay/src/react";

export function adaptSessionToReplay(session: Session): ReplaySession {
  return {
    registry: {
      call: async (name, args, opts) => {
        const r = await session.call(name, args, { source: opts.source, round: opts.round });
        return { ok: r.ok, summary: r.summary };
      },
    },
    gate: session.gate,
  };
}
