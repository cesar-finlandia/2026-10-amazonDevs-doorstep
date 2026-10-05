// src/ui/week/IncidentCircle.tsx — the pencil circle (DP-UI §6.5).
// Requirement IDs: FR-03
import type { RibbonDay } from "src/domain/derive.js";

export function IncidentCircle(props: {
  day: RibbonDay;
  incident: RibbonDay["incidents"][number];
  title: string;
  selected: boolean;
  onOpen(): void;
}): React.JSX.Element {
  const { incident } = props;
  const cy = (incident.fromMin + incident.toMin) / 2 / 14.4;
  const ry = Math.max(4, (incident.toMin - incident.fromMin) / 2 / 14.4 + 3);
  return (
    <button
      type="button"
      className="pencil-circle"
      data-incident-id={incident.id}
      data-status={incident.status}
      aria-pressed={props.selected}
      aria-label={`Open incident: ${props.title}`}
      style={{ top: `${cy - ry}%`, height: `${ry * 2}%` }}
      onClick={props.onOpen}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" key={props.selected ? "sel" : "un"}>
        <ellipse cx="50" cy="50" rx="46" ry="46" pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>
    </button>
  );
}
