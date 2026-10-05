// Requirement IDs: HEE-KIT-02
import { useEffect, useState } from "react";
import type { ApprovalGate, ApprovalRequest } from "../gate/approvalGate.js";

export interface ApprovalBarProps {
  gate: ApprovalGate;
  demoFocus?: string;
}

export function ApprovalBar({ gate, demoFocus }: ApprovalBarProps): React.JSX.Element {
  const [pending, setPending] = useState<ApprovalRequest[]>(() => gate.pending());
  const [required, setRequired] = useState<boolean>(() => gate.isEnabled());
  useEffect(() => gate.subscribe((list) => setPending(list)), [gate]);
  const current = pending[0];
  return (
    <div {...(demoFocus ? { "data-demo-focus": demoFocus } : {})}>
      <label>
        <input
          type="checkbox"
          checked={required}
          onChange={(ev) => {
            setRequired(ev.target.checked);
            gate.setEnabled(ev.target.checked);
          }}
        />
        Require approval
      </label>
      {current ? (
        <div>
          <span>AGENT WANTS TO {current.plainSummary}</span>
          <button type="button" onClick={() => gate.decide(current.id, "approved")}>
            Approve
          </button>
          <button type="button" onClick={() => gate.decide(current.id, "rejected")}>
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}
