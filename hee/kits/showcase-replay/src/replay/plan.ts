// Requirement IDs: HEE-SHOW-01, HEE-SHOW-04
// DP-W09 §3.5 planReplay: a recorded run trace becomes labelled replay steps.
import type { ReplayStep, TraceLike } from "./types.js";

export const CALL_WAIT_MS = 900;
export const APPROVAL_WAIT_MS = 1200;
export const MODEL_WAIT_MS = 500;
export const CLOSING_WAIT_MS = 1200;

export const CLOSING_TEXT = "Recorded run continues beyond this point; replay stops here.";

/** Walk entries in seq order and emit replay steps. */
export function planReplay(trace: TraceLike): ReplayStep[] {
  const steps: ReplayStep[] = [];
  const entries = [...trace.entries].sort((a, b) => a.seq - b.seq);
  for (const entry of entries) {
    if (entry.kind === "action") {
      if (entry.name === "get_capabilities") continue;
      if (entry.source !== "agent" && entry.source !== "human") continue;
      if (entry.args === undefined) {
        steps.push({ type: "banner", seq: entry.seq, text: CLOSING_TEXT, wait_ms: CLOSING_WAIT_MS });
        break;
      }
      steps.push({
        type: "call",
        seq: entry.seq,
        name: entry.name,
        args: entry.args,
        recorded_ok: entry.ok,
        wait_ms: CALL_WAIT_MS,
      });
    } else if (entry.kind === "approval") {
      if (entry.decision === "approved" || entry.decision === "rejected") {
        const word = entry.decision === "approved" ? "approved" : "declined";
        steps.push({
          type: "banner",
          seq: entry.seq,
          text: `Recorded: a human ${word} the action ${entry.name}.`,
          wait_ms: APPROVAL_WAIT_MS,
        });
      }
    } else if (entry.kind === "model") {
      steps.push({
        type: "banner",
        seq: entry.seq,
        text: `Recorded agent step: ${entry.decision ?? "decided"}`,
        wait_ms: MODEL_WAIT_MS,
      });
    }
  }
  return steps;
}
