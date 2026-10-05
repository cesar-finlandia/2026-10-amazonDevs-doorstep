// Requirement IDs: HEE-KIT-02
import type { TraceEntry, TraceSummary } from "./types.js";

export function summarizeTrace(entries: TraceEntry[]): TraceSummary {
  let model_calls = 0;
  let actions = 0;
  let rounds = 0;
  const roles = new Set<string>();
  for (const e of entries) {
    if (e.kind === "model") {
      model_calls++;
      roles.add(e.name);
    }
    if (e.kind === "action" && e.name !== "get_capabilities") actions++;
    if (e.round > rounds) rounds = e.round;
  }

  let verify_repair_rounds = 0;
  let lastErrors = 0;
  let changedSince = false;
  let final_truth: { errors: number; warnings: number } | null = null;
  for (const e of entries) {
    if (
      e.kind === "action" && e.ok &&
      e.state_change && e.state_change.revision_after > e.state_change.revision_before
    ) {
      changedSince = true;
    }
    if (e.truth) {
      if (lastErrors > 0 && changedSince && e.truth.errors < lastErrors) verify_repair_rounds++;
      lastErrors = e.truth.errors;
      changedSince = false;
      final_truth = { errors: e.truth.errors, warnings: e.truth.warnings };
    }
  }

  let human_checkpoints = 0;
  let approved = 0;
  let rejected = 0;
  for (const e of entries) {
    if (e.kind === "approval" && (e.decision === "approved" || e.decision === "rejected")) {
      human_checkpoints++;
      if (e.decision === "approved") approved++;
      else rejected++;
    }
  }

  return {
    model_calls,
    actions,
    rounds,
    model_roles: [...roles].sort(),
    verify_repair_rounds,
    human_checkpoints,
    approvals: { approved, rejected },
    final_truth,
  };
}
