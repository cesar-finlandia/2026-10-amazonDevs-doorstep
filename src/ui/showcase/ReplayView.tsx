// src/ui/showcase/ReplayView.tsx — DP-SHOWCASE WU-03 (FR-22, HEE-SHOW-04).
// Requirement IDs: FR-22
// A labelled replay of the saved run inside the isolated /watch session.
// The kit's ReplayControl drives every call through the session adapter;
// this view never fetches an agent route and never writes the real trace.
import { useEffect, useMemo } from "react";
import { useApp } from "src/ui/state/SessionProvider.js";
import { ReplayControl } from "src/kits/showcase-replay/src/react";
import type { TraceLike } from "src/kits/showcase-replay/src/react";
import { WeekRibbon } from "src/ui/week/WeekRibbon.js";
import { CheckPanel } from "src/ui/panels/CheckPanel.js";
import { ActivityFeedPanel } from "src/ui/panels/ActivityFeedPanel.js";
import { SceneStage } from "src/ui/panels/SceneStage.js";
import { StatusChip } from "src/ui/primitives/badges.js";
import { adaptSessionToReplay } from "src/ui/showcase/replay-session.js";

export function newReplaySessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "watch";
  const buf = new Uint32Array(12);
  globalThis.crypto.getRandomValues(buf);
  for (const n of buf) out += chars[(n as number) % 36];
  return out;
}

function loadTrace(): Promise<TraceLike> {
  return fetch("/replay/run-trace.json").then((r) => r.json() as Promise<TraceLike>);
}

export function ReplayView(): React.JSX.Element {
  const { session } = useApp();
  const replaySession = useMemo(() => adaptSessionToReplay(session), [session]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("hook") === "1") {
      (window as unknown as { __replay?: unknown }).__replay = { session };
      return () => {
        const host = window as unknown as { __replay?: { session?: unknown } };
        if (host.__replay?.session === session) delete host.__replay;
      };
    }
    return undefined;
  }, [session]);
  return (
    <section data-demo-focus="replay">
      <StatusChip tone="degraded" label="Replay · nothing here is live" />
      <ReplayControl session={replaySession} trace={loadTrace} speeds={[1, 2, 4]} />
      <WeekRibbon />
      <CheckPanel />
      <ActivityFeedPanel />
      <SceneStage />
    </section>
  );
}
