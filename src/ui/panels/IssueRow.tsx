// src/ui/panels/IssueRow.tsx — one check row with its fix (DP-UI §6.4).
// Requirement IDs: FR-04
import { OctagonX, TriangleAlert } from "lucide-react";
import { fmtDay } from "src/domain/time.js";
import type { WeekModel } from "src/domain/types.js";
import type { Issue } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import { RULE_IDS } from "src/domain/rules.js";
import { RULE_WORDS, issueTitle } from "../copy/templates.js";
import { Button } from "../primitives/Button.js";
import { useApp } from "../state/SessionProvider.js";

function ruleOf(id: string): string {
  let best = "";
  for (const rid of RULE_IDS) {
    if (id.startsWith(rid) && rid.length > best.length) best = rid;
  }
  return best !== "" ? (RULE_WORDS[best as keyof typeof RULE_WORDS] ?? "Check") : "Check";
}

export function IssueRow(props: { issue: Issue; model: WeekModel }): React.JSX.Element {
  const { session } = useApp();
  const { issue, model } = props;
  const error = issue.severity === "error";
  const dayId = issue.entityIds.find((id) => model.events.some((e) => e.id === id));
  const dayEvent = dayId ? model.events.find((e) => e.id === dayId) : undefined;
  const support = dayEvent ? `${ruleOf(issue.id)} · ${fmtDay(dayEvent.tsMs, model.household.utcOffsetMin)}` : ruleOf(issue.id);
  const fix = (issue.fix ?? null) as { action: string; args: Record<string, unknown> } | null;
  const fixLabel = fix?.action === "merge_duplicate_events" ? "Merge duplicates" : fix?.action === "open_incident" ? "Open an incident" : null;
  return (
    <div className="issue-row" data-severity={error ? "error" : "warning"}>
      <span className="chip" data-tone={error ? "danger" : "warning"}>
        {error ? <OctagonX aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
        {error ? "Error" : "Warning"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="subject">{issueTitle(issue)}</span>
        <br />
        <span className="support">{support}</span>
      </span>
      {fix && fixLabel ? (
        <Button
          variant="ghost"
          onClick={() => void session.call(fix.action, fix.args, { source: "human" }).catch(() => undefined)}
        >
          {fixLabel}
        </Button>
      ) : null}
    </div>
  );
}
