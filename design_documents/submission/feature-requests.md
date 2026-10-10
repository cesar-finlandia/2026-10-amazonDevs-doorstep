# Feature requests

## FEAT-1 Wire value tables beside the endpoint reference
- **Description:** Publish the wire-to-domain value table for history event types next to the endpoint reference, so ports normalize once instead of discovering each value by execution.
- **Why it matters:** Every Ring integration re-discovers values like motion dot human and ding by trial, which wastes the first integration day on mapping instead of product work.
- **Priority:** Important
- **Evidence:** FL-2

## FEAT-2 Longer-lived judging tokens
- **Description:** Offer a judging-scoped Playground token that outlasts the half-hour window, or a one-click re-issue from the token box, so a judging session is never interrupted mid-review.
- **Why it matters:** Judges open many entries in a row, and a token that dies mid-click forces a context switch back to the Playground in the middle of the demo.
- **Priority:** Nice-to-have
- **Evidence:** JUDGES.md

## FEAT-3 Aligned clip-length bounds
- **Description:** Align the documented clip-length bound with the contract samples, so a port does not have to choose between rejecting long ranges and satisfying the sample calls.
- **Why it matters:** A bound that contradicts the sample leaves every entrant guessing which side the certification run checks.
- **Priority:** Nice-to-have
- **Evidence:** `src/ring/live-ring-port.ts`
