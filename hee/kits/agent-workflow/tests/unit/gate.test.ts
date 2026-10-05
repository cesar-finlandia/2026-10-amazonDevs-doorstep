// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { createApprovalGate } from "../../src/gate/approvalGate.js";

describe("approvalGate", () => {
  it("is enabled by default and approves immediately when disabled", async () => {
    const gate = createApprovalGate();
    expect(gate.isEnabled()).toBe(true);
    gate.setEnabled(false);
    const res = await gate.request({ action: "remove_widget", plainSummary: "remove alpha", source: "agent" });
    expect(res).toEqual({ decision: "approved" });
    expect(gate.pending()).toEqual([]);
  });

  it("approve and reject round-trip with the exact messages", async () => {
    const gate = createApprovalGate();
    const p1 = gate.request({ action: "remove_widget", plainSummary: "remove alpha", source: "agent" });
    expect(gate.pending().length).toBe(1);
    const id = gate.pending()[0]?.id as string;
    expect(gate.decide("missing", "approved")).toBe(false);
    expect(gate.decide(id, "approved")).toBe(true);
    expect(await p1).toEqual({ decision: "approved" });

    const p2 = gate.request({ action: "remove_widget", plainSummary: "remove beta", source: "agent" });
    const id2 = gate.pending()[0]?.id as string;
    expect(gate.decide(id2, "rejected")).toBe(true);
    expect(await p2).toEqual({
      decision: "rejected",
      message: 'The human declined "remove beta". Ask what to do instead.',
    });
    expect(gate.pending()).toEqual([]);
  });

  it("abort and timeout messages are verbatim", async () => {
    const gate = createApprovalGate({ timeoutMs: 30 });
    const ctl = new AbortController();
    const pAbort = gate.request({ action: "x", plainSummary: "do x", source: "agent" }, ctl.signal);
    ctl.abort();
    expect(await pAbort).toEqual({
      decision: "aborted",
      message: "The request was cancelled before the human decided. Do not retry the same action; ask the human how to continue.",
    });

    const pTimeout = gate.request({ action: "y", plainSummary: "do y", source: "agent" });
    expect(await pTimeout).toEqual({
      decision: "timeout",
      message: "No human decision arrived within 0.03 seconds. Do not retry the same action; ask the human how to continue.",
    });
  });

  it("an already-aborted signal resolves at once", async () => {
    const gate = createApprovalGate();
    const ctl = new AbortController();
    ctl.abort();
    const res = await gate.request({ action: "x", plainSummary: "do x", source: "agent" }, ctl.signal);
    expect(res.decision).toBe("aborted");
    expect(gate.pending()).toEqual([]);
  });
});
