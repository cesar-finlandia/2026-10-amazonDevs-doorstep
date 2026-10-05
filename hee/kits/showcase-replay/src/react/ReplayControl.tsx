// Requirement IDs: HEE-SHOW-01, HEE-SHOW-04
// DP-W09 §3.5 ReplayControl: a labelled replay of a recorded run.
// Never adds data-demo-focus; never touches the real trace.
import { useRef, useState } from "react";
import { createReplayPlayer, type ReplayPlayer } from "../replay/player.js";
import type { ReplaySession, ReplayState, TraceLike } from "../replay/types.js";

export interface ReplayControlProps {
  session: ReplaySession;
  trace: TraceLike | (() => Promise<TraceLike>);
  speeds?: number[];
}

const IDLE: ReplayState = { status: "idle", index: 0, total: 0, message: "" };

export function ReplayControl({ session, trace, speeds }: ReplayControlProps): JSX.Element {
  const options = speeds ?? [1, 2, 4];
  const [loaded, setLoaded] = useState<TraceLike | null>(typeof trace === "object" ? trace : null);
  const [loadError, setLoadError] = useState("");
  const [replay, setReplay] = useState<ReplayState>(IDLE);
  const [banner, setBanner] = useState("");
  const [speed, setSpeed] = useState(options[0] as number);
  const playerRef = useRef<ReplayPlayer | null>(null);

  const bannerText = loaded
    ? `REPLAY of a recorded run from ${loaded.started_at.slice(0, 10)}. Nothing here is live.`
    : "REPLAY of a recorded run. Nothing here is live.";

  async function start(): Promise<void> {
    let current = loaded;
    if (current === null) {
      if (typeof trace === "function") {
        try {
          current = await trace();
          setLoaded(current);
          setLoadError("");
        } catch {
          setLoadError("The recorded run could not be loaded.");
          return;
        }
      } else {
        return;
      }
    }
    const active: TraceLike = current;
    const player = createReplayPlayer({
      session,
      trace: active,
      speed,
      onState: setReplay,
      onBanner: setBanner,
    });
    playerRef.current = player;
    setBanner("");
    await player.play();
  }

  const busy = replay.status === "playing" || replay.status === "paused";

  return (
    <section aria-label="Recorded run replay">
      <p role="status" data-hee-replay="banner">
        {bannerText}
      </p>
      <div>
        <button type="button" data-hee-replay="start" onClick={() => void start()} disabled={busy}>
          Watch the agent do it
        </button>
        <label>
          Speed
          <select
            data-hee-replay="speed"
            value={speed}
            disabled={busy}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <button type="button" data-hee-replay="pause" onClick={() => playerRef.current?.pause()} disabled={!busy}>
          Pause
        </button>
        <button type="button" data-hee-replay="resume" onClick={() => playerRef.current?.resume()} disabled={!busy}>
          Resume
        </button>
        <button type="button" data-hee-replay="stop" onClick={() => playerRef.current?.stop()} disabled={!busy}>
          Stop
        </button>
      </div>
      {banner !== "" && <p data-hee-replay="message">{banner}</p>}
      {replay.total > 0 && (
        <p data-hee-replay="progress">
          step {replay.index} of {replay.total}
        </p>
      )}
      {replay.message !== "" && <p data-hee-replay="state">{replay.message}</p>}
      {loadError !== "" && <p data-hee-replay="error">{loadError}</p>}
    </section>
  );
}
