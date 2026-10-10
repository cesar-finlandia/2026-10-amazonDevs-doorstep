// src/ui/pages/Watch.tsx — Requirement IDs: FR-22
import { SessionProvider } from "src/ui/state/SessionProvider";
import { ReplayView, newReplaySessionId } from "src/ui/showcase/ReplayView";
/** The route "/watch": a second, isolated session (its own random session id; the server keeps bundle sessions apart) replays public/replay/run-trace.json. */
export default function WatchPage(): React.JSX.Element {
  return (
    <SessionProvider sessionIdOverride={newReplaySessionId()}>
      <ReplayView />
    </SessionProvider>
  );
}
