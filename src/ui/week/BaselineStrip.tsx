// src/ui/week/BaselineStrip.tsx — the usual-rhythm line (DP-UI §6.5).
// Requirement IDs: FR-03
import { useMemo } from "react";
import { useModel } from "../state/hooks.js";

export function BaselineStrip(): React.JSX.Element {
  const model = useModel();
  const text = useMemo(() => {
    const p90 = Math.round(model.baseline.dwellP90Sec / 60);
    const perHour = new Array<number>(24).fill(0);
    for (const row of model.baseline.rhythm) {
      row.forEach((v, h) => {
        perHour[h] = (perHour[h] ?? 0) + v;
      });
    }
    let best = 0;
    for (let h = 1; h < 24; h++) {
      if ((perHour[h] ?? 0) > (perHour[best] ?? 0)) best = h;
    }
    const hour = `${String(best).padStart(2, "0")}:00`;
    return `Usual: visits under ${p90} min; busiest ${hour}`;
  }, [model]);
  return <p className="support baseline-strip">{text}</p>;
}
