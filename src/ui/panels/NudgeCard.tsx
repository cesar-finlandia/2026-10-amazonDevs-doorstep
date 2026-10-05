// src/ui/panels/NudgeCard.tsx — the suggested-message decision card (DP-UI §6.4).
// Requirement IDs: FR-04
import { Surface } from "../primitives/Surface.js";
import { Button } from "../primitives/Button.js";
import { useModel } from "../state/hooks.js";
import { useApp } from "../state/SessionProvider.js";
import { rejected } from "../copy/templates.js";

export function NudgeCard(): React.JSX.Element | null {
  const model = useModel();
  const { session } = useApp();
  const proposed = model.nudges.filter((n) => n.status === "proposed" && n.scope === "family_message").sort((a, b) => (a.createdMs < b.createdMs ? 1 : -1));
  const nudge = proposed[0];
  if (!nudge) return null;
  const consentOn = model.consent.some((c) => c.scope === "family_message" && c.granted);
  const decide = (decision: "approved" | "rejected"): void => {
    session.store.dispatch("decide_nudge", { nudgeId: nudge.id, decision }, "human");
    session.trace.record({
      round: 0,
      kind: "action",
      name: "decide_nudge",
      source: "human",
      input_ref: null,
      output_ref: decision === "approved" ? `Approved message ${nudge.id}.` : rejected(nudge.text).detail,
      ok: true,
      latency_ms: 0,
      state_change: { revision_before: session.store.revision(), revision_after: session.store.revision(), entity_ids: [nudge.id] },
    });
  };
  return (
    <div data-nudge-card={nudge.id}>
      <Surface eyebrow="Suggested message" help="nudge-card" resultRegion="nudge-card">
        <p className="subject clamp-3">{nudge.text}</p>
        <p className="support">{`To ${model.household.caretaker} · family messages ${consentOn ? "on" : "off"}`}</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button variant="primary" onClick={() => decide("approved")}>
            Approve
          </Button>
          <Button variant="ghost" onClick={() => decide("rejected")}>
            Reject
          </Button>
        </div>
      </Surface>
    </div>
  );
}
