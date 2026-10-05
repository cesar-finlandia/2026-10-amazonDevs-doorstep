// src/ui/panels/WeekTitle.tsx (DP-UI §6.4).
// Requirement IDs: FR-03
import { useModel, useStatus } from "../state/hooks.js";
import { weekSupport, weekTitle } from "../copy/templates.js";

export function WeekTitle(): React.JSX.Element {
  const model = useModel();
  const status = useStatus();
  // One tag only: weekSupport already names the sample week, so a second
  // "Sample week · synthetic" chip beside it reads as a duplicate
  // (visual review round 1, defect 7). The rail household card keeps the
  // synthetic chip.
  return (
    <div>
      <h1 style={{ fontSize: "var(--text-h1)", lineHeight: "var(--lh-h1)", fontFamily: "var(--font-display)", margin: 0 }}>
        {weekTitle(model)}
      </h1>
      <p className="support">{weekSupport(model, status.ring.mode)}</p>
    </div>
  );
}
