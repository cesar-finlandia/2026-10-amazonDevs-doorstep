// Requirement IDs: HEE-SHOW-01, HEE-SHOW-04
// Neutral in-kit demo: ReplayControl over an in-kit fake session whose
// registry appends one row per recorded call. Nothing here is live.
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReplayControl } from "../react/index.js";
import type { ReplaySession, TraceLike } from "../replay/types.js";

const TRACE: TraceLike = {
  run_id: "showcase-shelf-run-1",
  started_at: "2026-10-04T12:00:00.000Z",
  entries: [
    { seq: 1, round: 1, kind: "model", name: "planner", source: "agent", ok: true, latency_ms: 900, decision: "list_widgets" },
    { seq: 2, round: 1, kind: "action", name: "get_capabilities", source: "agent", ok: true, latency_ms: 5, args: {} },
    { seq: 3, round: 1, kind: "action", name: "list_widgets", source: "agent", ok: true, latency_ms: 12, args: {} },
    { seq: 4, round: 1, kind: "model", name: "actor", source: "agent", ok: true, latency_ms: 1100, decision: "add_widget" },
    { seq: 5, round: 1, kind: "action", name: "add_widget", source: "agent", ok: true, latency_ms: 15, args: { name: "blue", shelfId: "shelf-a", size: 1 } },
    { seq: 6, round: 2, kind: "approval", name: "move_widget", source: "agent", ok: true, latency_ms: 4500, decision: "approved" },
    { seq: 7, round: 2, kind: "action", name: "move_widget", source: "agent", ok: false, latency_ms: 16, args: { name: "blue", shelfId: "shelf-b" } },
    { seq: 8, round: 2, kind: "action", name: "check_shelves", source: "agent", ok: true, latency_ms: 19 },
  ],
};

function useFakeSession(addRow: (row: string) => void): ReplaySession {
  const ref = useRef<ReplaySession | null>(null);
  if (ref.current === null) {
    let enabled = true;
    let n = 0;
    ref.current = {
      registry: {
        call: async (name: string, _args: unknown) => {
          n += 1;
          addRow(`${n}. ${name}`);
          return { ok: name !== "move_widget", summary: `${name} replayed` };
        },
      },
      gate: {
        setEnabled: (on: boolean): void => {
          enabled = on;
        },
        isEnabled: (): boolean => enabled,
      },
    };
  }
  return ref.current;
}

function Demo(): JSX.Element {
  const [rows, setRows] = useState<string[]>([]);
  const session = useFakeSession((row) => setRows((prev) => [...prev, row]));
  return (
    <main>
      <h1>Showcase replay demo</h1>
      <ReplayControl session={session} trace={TRACE} />
      <ul data-testid="replay-rows">
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </main>
  );
}

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(<Demo />);
}
