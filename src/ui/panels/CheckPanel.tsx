// src/ui/panels/CheckPanel.tsx (DP-UI §6.4).
// Requirement IDs: FR-04
import { Surface } from "../primitives/Surface.js";
import { useIssues } from "../state/hooks.js";
import { useModel } from "../state/hooks.js";
import { emptyChecks } from "../copy/templates.js";
import { IssueRow } from "./IssueRow.js";

export function CheckPanel(): React.JSX.Element {
  const model = useModel();
  const { issues, open } = useIssues();
  const empty = emptyChecks();
  return (
    <Surface eyebrow="Checks" help="check-panel" resultRegion="check-panel">
      <div className="panel-count">
        <span className="tnum" data-check-count="">
          {open}
        </span>
        <span className="support">open</span>
      </div>
      {issues.length === 0 ? (
        <>
          <p className="subject">{empty.title}</p>
          <p className="support">{empty.detail}</p>
        </>
      ) : (
        issues.map((issue) => <IssueRow key={issue.id} issue={issue} model={model} />)
      )}
    </Surface>
  );
}
