// src/ui/panels/WeekSummary.tsx — hero metric and lead sentence (DP-UI §6.4).
// Requirement IDs: FR-03, FR-04
import { Surface } from "../primitives/Surface.js";
import { Metric } from "../primitives/Metric.js";
import { useIssues } from "../state/hooks.js";
import { leadSentence } from "../copy/templates.js";

export function WeekSummary(): React.JSX.Element {
  const { open, errors } = useIssues();
  const tone = open === 0 ? "accent" : errors > 0 ? "danger" : "warning";
  return (
    <Surface eyebrow="This week" help="open-checks" resultRegion="open-checks">
      <div className="summary-flex">
        <Metric label="Open checks" value={open} unit={open === 0 ? "all clear" : "to look at"} size="xl" tone={tone} max={99} />
        <p className="lead">{leadSentence(open)}</p>
      </div>
    </Surface>
  );
}
