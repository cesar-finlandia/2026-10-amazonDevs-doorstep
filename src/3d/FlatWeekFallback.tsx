// src/3d/FlatWeekFallback.tsx — the flat week replica (DP-3D §5.9).
// Shown when WebGL is missing: the same week the doorway scene draws, read from
// the same weekRibbon, as seven columns of ticks, visits and circled moments.
// It sets no window.__demo3d. Colours are the page's custom properties.
// Requirement IDs: NFR-07
import type { WeekModel } from "src/domain/types.js";
import { weekRibbon } from "src/domain/derive.js";

const COL_X = (i: number): number => 10 + 96 * i;
const COL_W = 86;
const Y0 = 30;
const Y_SPAN = 190;
const yOf = (minute: number): number => Y0 + (minute / 1440) * Y_SPAN;

export function FlatWeekFallback(props: { model: WeekModel }): React.JSX.Element {
  const ribbon = weekRibbon(props.model);
  const events = ribbon.reduce((sum, d) => sum + d.eventCount, 0);
  const moments = ribbon.reduce((sum, d) => sum + d.incidents.length, 0);
  return (
    <div data-demo-3d="unavailable" style={{ width: "100%" }}>
      <p>3D view unavailable — showing the flat week.</p>
      <svg
        role="img"
        viewBox="0 0 700 230"
        aria-label={`Flat week: ${events} events across 7 days, ${moments} moments to look at`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {ribbon.map((day) => {
          const x = COL_X(day.dayIndex);
          return (
            <g key={day.dayIndex} data-day={day.dayIndex}>
              <rect x={x} y={Y0 - 4} width={COL_W} height={Y_SPAN + 8} fill="none" stroke="var(--border)" />
              <text x={x + COL_W / 2} y={18} textAnchor="middle" fontSize={11} fill="var(--pencil)">
                {day.dateLabel.slice(0, 3).toUpperCase()}
              </text>
              {day.ticks.map((tick) => (
                <line
                  key={tick.id}
                  className="fb-tick"
                  x1={x + 20}
                  x2={x + 34}
                  y1={yOf(tick.minute)}
                  y2={yOf(tick.minute)}
                  stroke="var(--pencil)"
                />
              ))}
              {day.visits.map((visit) => (
                <rect
                  key={visit.id}
                  className="fb-visit"
                  x={x + 62}
                  y={yOf(visit.fromMin)}
                  width={5}
                  height={Math.max(((visit.toMin - visit.fromMin) / 1440) * Y_SPAN, 2)}
                  fill="var(--pencil)"
                />
              ))}
              {day.incidents.map((inc) => (
                <ellipse
                  key={inc.id}
                  className="fb-circle"
                  cx={x + 43}
                  cy={yOf((inc.fromMin + inc.toMin) / 2)}
                  rx={41}
                  ry={Math.max(8, ((inc.toMin - inc.fromMin) / 2 / 1440) * Y_SPAN + 5)}
                  fill="none"
                  stroke="var(--warning)"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
