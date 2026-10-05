// src/ui/week/DayColumn.tsx — one paper day (DP-UI §6.5).
// Requirement IDs: FR-03
import type { RibbonDay } from "src/domain/derive.js";
import type { WeekModel } from "src/domain/types.js";
import { ariaDayLabel } from "../copy/templates.js";
import { IncidentCircle } from "./IncidentCircle.js";

const SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function DayColumn(props: {
  day: RibbonDay;
  model: WeekModel;
  titles: Map<string, string>;
  pressed: boolean;
  onSelect(day: RibbonDay): void;
  onOpenIncident(day: RibbonDay, id: string): void;
}): React.JSX.Element {
  const { day } = props;
  const num = /\b(\d{1,2})\b/.exec(day.dateLabel)?.[1] ?? "";
  return (
    <div className="day-col" data-col={day.dayIndex}>
      <button
        type="button"
        className="day-btn"
        data-day={day.dayIndex}
        aria-pressed={props.pressed}
        aria-label={ariaDayLabel(day)}
        onClick={() => props.onSelect(day)}
      >
        <span className="day-head">
          <span className="eyebrow">{SHORT[((day.dayIndex % 7) + 7) % 7]}</span>
          <span className="day-num">{num}</span>
        </span>
        <span className="day-body">
          {[0, 360, 720, 1080].map((m) => (
            <span key={m} className="hour-line" style={{ top: `${m / 14.4}%` }} />
          ))}
          {day.quietBands.map((b, i) => (
            <span
              key={i}
              className="quiet-band"
              style={{ top: `${b.fromMin / 14.4}%`, height: `${(b.toMin - b.fromMin) / 14.4}%` }}
            />
          ))}
          {day.visits.map((v) => (
            <span
              key={v.id}
              className="visit"
              title={v.id}
              style={{ top: `${v.fromMin / 14.4}%`, height: `${(v.toMin - v.fromMin) / 14.4}%` }}
            />
          ))}
          {day.ticks.map((t) => (
            <span
              key={t.id}
              className="tick"
              title={t.id}
              {...(t.duplicate ? { "data-dup": "true" } : {})}
              style={{ top: `${t.minute / 14.4}%` }}
            />
          ))}
          {day.outages.map((o, i) => (
            <span
              key={`${o.deviceId}-${i}`}
              className="outage-band"
              title={`${o.minutes} min offline`}
              style={{ top: `${o.fromMin / 14.4}%`, height: `${(o.toMin - o.fromMin) / 14.4}%` }}
            >
              <span className="outage-text support">{`${o.minutes} min offline`}</span>
            </span>
          ))}
          {day.seamMinute !== null ? (
            <span className="seam" style={{ top: `${day.seamMinute / 14.4}%` }}>
              <span className="eyebrow">from history</span>
            </span>
          ) : null}
        </span>
      </button>
      {day.incidents.map((inc) => (
        <IncidentCircle
          key={inc.id}
          day={day}
          incident={inc}
          title={props.titles.get(inc.id) ?? inc.id}
          selected={props.model.ui.selectedIncidentId === inc.id}
          onOpen={() => props.onOpenIncident(day, inc.id)}
        />
      ))}
    </div>
  );
}
