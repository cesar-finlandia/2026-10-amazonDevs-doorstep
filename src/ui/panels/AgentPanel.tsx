// src/ui/panels/AgentPanel.tsx — the review starter (DP-UI §6.6).
// Requirement IDs: FR-07, FR-09
import { Check } from "lucide-react";
import { PHASES } from "src/agent/orchestrator.js";
import { Surface } from "../primitives/Surface.js";
import { Button } from "../primitives/Button.js";
import { WorkIndicator } from "../primitives/WorkIndicator.js";
import { useModel, useStatus } from "../state/hooks.js";
import { useRun } from "../state/useRun.js";
import { phaseLabel } from "../copy/templates.js";

const PHASE_NAMES: { phase: string; name: string }[] = [
  { phase: "perceive", name: "Read the week" },
  { phase: "plan", name: "Plan the review" },
  { phase: "act", name: "Check each day" },
  { phase: "verify", name: "Run the checks" },
  { phase: "repair", name: "Fix what was found" },
  { phase: "explain", name: "Write it up" },
  { phase: "checkpoint", name: "Your decision" },
];

const PHASE_TO_ROLE: Record<string, string> = {
  perceive: "reader",
  plan: "planner",
  act: "actor",
  verify: "verify",
  repair: "repair",
  explain: "narrator",
  checkpoint: "checkpoint",
};

void PHASES;

export function AgentPanel(): React.JSX.Element {
  const model = useModel();
  const status = useStatus();
  const run = useRun();
  const running = run.status === "running";
  const hasReviewEvents = model.events.some((e) => e.tsMs >= model.window.baselineStartMs + 7 * 86400000);
  const subject =
    status.agent.kind === "bedrock" && status.agent.model !== "" ? `Amazon Bedrock · ${status.agent.model}` : status.agent.label;
  const currentIdx = PHASE_NAMES.findIndex((p) => p.phase === run.phase);
  // A finished review leaves every step checked: seven identical muted lines
  // say nothing about the outcome (visual review round 2, defect 1).
  return (
    <div data-slot="agent" data-run-status={run.status} data-run-phase={run.phase ?? "idle"}>
      <Surface eyebrow="Agent" title={subject} emphasis="primary" help="agent-status">
        <Button variant="primary" onClick={() => void run.start()} data-agent-primary="" className="agent-primary">
          {hasReviewEvents ? "Review the week" : "Review the sample week"}
        </Button>
        {running ? <WorkIndicator label={phaseLabel(run.phase ? (PHASE_TO_ROLE[run.phase] as string) : null)} /> : null}
        <ol className="phase-list">
          {PHASE_NAMES.map((p, i) => {
            const done = run.status === "done" || (currentIdx >= 0 && i < currentIdx);
            const current = p.phase === run.phase;
            // Two axes separate the states (visual review round 1, defect 1):
            // the current step is accent + semibold, finished steps are body
            // text with a check, upcoming steps stay muted.
            return (
              <li
                key={p.phase}
                data-phase={p.phase}
                {...(current ? { "data-current": "true" } : {})}
                style={current ? { color: "var(--accent)", fontWeight: 600 } : done ? { color: "var(--text)" } : undefined}
              >
                {done ? <Check size={16} aria-hidden="true" /> : current ? <span className="phase-dot" aria-hidden="true" /> : null}
                <span>{p.name}</span>
              </li>
            );
          })}
        </ol>
      </Surface>
    </div>
  );
}
