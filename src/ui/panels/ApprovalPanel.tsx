// src/ui/panels/ApprovalPanel.tsx — the approval bar wrapper (DP-UI §6.6).
// Requirement IDs: FR-07, FR-09
import { useEffect, useMemo, useState } from "react";
import { ShieldQuestion } from "lucide-react";
import { ApprovalBar } from "src/kits/agent-workflow/src/react/ApprovalBar.js";
import type { ApprovalGate } from "src/kits/agent-workflow/src/gate/approvalGate.js";
import { useApp } from "../state/SessionProvider.js";
import { rejected } from "../copy/templates.js";
import { Message } from "../primitives/Message.js";

export function ApprovalPanel(): React.JSX.Element {
  const { session } = useApp();
  const [pending, setPending] = useState(() => session.gate.pending());
  const [lastRejected, setLastRejected] = useState<string | null>(null);
  useEffect(() => session.gate.subscribe((list) => setPending(list)), [session]);
  const gate = useMemo<ApprovalGate>(
    () => ({
      ...session.gate,
      decide: (id: string, decision: "approved" | "rejected"): boolean => {
        if (decision === "rejected") {
          const req = session.gate.pending().find((r) => r.id === id);
          setLastRejected(req ? req.plainSummary : "the suggestion");
        }
        return session.gate.decide(id, decision);
      },
    }),
    [session],
  );
  const hasPending = pending.length > 0;
  return (
    <div data-slot="approval">
      <div data-surface="" data-elevation="2" data-result-region="approval-bar" className={hasPending ? "approval-pending" : ""}>
        <div className="approval-head">
          <ShieldQuestion size={18} aria-hidden="true" />
          <span className="eyebrow">Approval</span>
        </div>
        <ApprovalBar gate={gate} />
        {lastRejected && !hasPending ? (
          <Message
            tier="callout"
            tone="degraded"
            title={rejected(lastRejected).title}
            detail={rejected(lastRejected).detail}
            onDismiss={() => setLastRejected(null)}
          />
        ) : null}
        {!hasPending ? <p className="support">Nothing is waiting for you.</p> : null}
      </div>
    </div>
  );
}
