// src/3d/FlatWeekFallback.tsx — the flat week replica (DP-3D §5.9).
// Shown when WebGL is missing. WU-03 contributes the unavailable root and the
// message; WU-07 completes the flat replica.
// Requirement IDs: NFR-07
import type { WeekModel } from "src/domain/types.js";

export function FlatWeekFallback(props: { model: WeekModel }): React.JSX.Element {
  void props.model;
  return (
    <div data-demo-3d="unavailable">
      <p>3D view unavailable — showing the flat week.</p>
    </div>
  );
}
