// src/ui/panels/QuietHoursEditor.tsx — quiet-hours window with margin (DP-UI §6.9).
// Requirement IDs: FR-19
import { useState } from "react";
import { EFFECTIVE_QUIET_HOURS } from "src/domain/rules.js";
import { Surface } from "../primitives/Surface.js";
import { Message } from "../primitives/Message.js";
import { useModel } from "../state/hooks.js";
import { useApp } from "../state/SessionProvider.js";

export function toClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fromClock(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

export function QuietHoursEditor(): React.JSX.Element {
  const model = useModel();
  const { session } = useApp();
  const [mismatch, setMismatch] = useState(false);
  const q = model.household.quietHours;
  const eff = EFFECTIVE_QUIET_HOURS(q);
  const apply = (startMin: number, endMin: number, toleranceMin: number): void => {
    if (startMin === endMin) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    session.store.dispatch("set_quiet_hours", { startMin, endMin, toleranceMin }, "human");
  };
  const stepMargin = (delta: number): void => {
    const next = Math.max(0, Math.min(120, q.toleranceMin + delta));
    apply(q.startMin, q.endMin, next);
  };
  return (
    <Surface eyebrow="Quiet hours" title={`${toClock(q.startMin)}–${toClock(q.endMin)}`} help="quiet-hours" resultRegion="quiet-hours">
      <p className="support">±{q.toleranceMin} min margin</p>
      <p className="support">
        Counted from {toClock(eff.startMin)} to {toClock(eff.endMin)}
      </p>
      <div className="quiet-grid">
        <label>
          Start
          <input
            type="time"
            value={toClock(q.startMin)}
            onChange={(ev) => {
              const v = fromClock(ev.target.value);
              if (v !== null) apply(v, q.endMin, q.toleranceMin);
            }}
          />
        </label>
        <label>
          End
          <input
            type="time"
            value={toClock(q.endMin)}
            onChange={(ev) => {
              const v = fromClock(ev.target.value);
              if (v !== null) apply(q.startMin, v, q.toleranceMin);
            }}
          />
        </label>
      </div>
      <div className="quiet-margin">
        <span className="support">Margin</span>
        <button type="button" data-variant="ghost" aria-label="Reduce margin" onClick={() => stepMargin(-5)}>
          −
        </button>
        <span className="support">{q.toleranceMin} min</span>
        <button type="button" data-variant="ghost" aria-label="Increase margin" onClick={() => stepMargin(5)}>
          +
        </button>
      </div>
      {mismatch ? <Message tier="callout" tone="warning" title="Pick two different times." detail="Quiet hours need a start and an end that are not the same." /> : null}
    </Surface>
  );
}
