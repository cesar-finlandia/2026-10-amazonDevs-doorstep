// Requirement IDs: HEE-KIT-02
import { useEffect, useState } from "react";
import type { TraceEntry, TraceWriter } from "../trace/types.js";

function badge(source: TraceEntry["source"]): string {
  if (source === "agent") return "AGENT";
  if (source === "human") return "YOU";
  return "SYSTEM";
}

export interface ActivityFeedProps {
  trace: TraceWriter;
  demoFocus?: string;
}

export function ActivityFeed({ trace, demoFocus }: ActivityFeedProps): React.JSX.Element {
  const [entries, setEntries] = useState<TraceEntry[]>(() => trace.entries());
  useEffect(() => trace.subscribe(() => setEntries(trace.entries())), [trace]);
  return (
    <ol {...(demoFocus ? { "data-demo-focus": demoFocus } : {})}>
      {entries.map((e) => (
        <li key={e.seq} className="feed-in">
          <span>{badge(e.source)}</span> <strong>{e.name}</strong>
          {e.output_ref ? <span> {e.output_ref}</span> : null}
          {e.state_change ? (
            <span> rev {e.state_change.revision_before}→{e.state_change.revision_after}</span>
          ) : null}
          {e.truth ? (
            <span> errors {e.truth.errors} · warnings {e.truth.warnings}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
