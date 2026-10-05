// src/ui/week/WeekRibbon.tsx — the paper calendar (DP-UI §5.6 §6.11, §6.5).
// Requirement IDs: FR-03
import { useMemo } from "react";
import { dayIndexOf, weekRibbon } from "src/domain/derive.js";
import type { RibbonDay } from "src/domain/derive.js";
import { Surface } from "../primitives/Surface.js";
import { EmptyState } from "../primitives/EmptyState.js";
import { useModel } from "../state/hooks.js";
import { loadSampleWeek } from "../state/sampleWeek.js";
import { useUiActions } from "../state/useUiActions.js";
import { useApp } from "../state/SessionProvider.js";
import { DayColumn } from "./DayColumn.js";

export function WeekRibbon(): React.JSX.Element {
  const model = useModel();
  const { session } = useApp();
  const actions = useUiActions();
  const ribbon = useMemo(() => weekRibbon(model), [model]);
  const titles = useMemo(() => new Map(model.incidents.map((i) => [i.id, i.title])), [model]);
  const empty = model.events.every((e) => e.tsMs < model.window.baselineEndMs);
  const select = (day: RibbonDay): void => {
    // Ribbon index (0..6): matches data-day and the 3D scene's day ids. (The
    // agent's focus_day/focus_incident continue to write absolute indices;
    // the pressed comparison below accepts both.)
    actions.selectDay(day.dayIndex);
  };
  const open = (day: RibbonDay, id: string): void => {
    actions.selectIncident(id);
    actions.selectDay(day.dayIndex);
  };
  return (
    <Surface title="Week calendar" eyebrow="Seven days" help="week-ribbon" resultRegion="week-ribbon">
      <div className="ribbon">
        {ribbon.map((day) => (
          <DayColumn
            key={day.dayIndex}
            day={day}
            model={model}
            titles={titles}
            pressed={
              model.ui.selectedDay === day.dayIndex ||
              model.ui.selectedDay === dayIndexOf(model, day.dayStartMs)
            }
            onSelect={select}
            onOpenIncident={open}
          />
        ))}
      </div>
      {empty ? (
        <EmptyState
          title="No doorway events yet"
          detail="Load the sample week, or paste a Ring Playground token to read your own devices."
          action={{ label: "Load the sample week", onClick: () => void loadSampleWeek(session) }}
        />
      ) : null}
    </Surface>
  );
}
