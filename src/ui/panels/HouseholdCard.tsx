// src/ui/panels/HouseholdCard.tsx — who lives here (DP-UI §6.9).
// Requirement IDs: FR-19
import { Surface } from "../primitives/Surface.js";
import { SyntheticBadge } from "../primitives/SyntheticBadge.js";
import { useModel, useStatus } from "../state/hooks.js";

export function HouseholdCard(): React.JSX.Element {
  const model = useModel();
  const status = useStatus();
  const name = typeof model.household.name === "string" && model.household.name !== "" ? model.household.name : "Your household";
  const age = typeof model.household.age === "number" && Number.isFinite(model.household.age) ? model.household.age : null;
  const blurb = typeof model.household.blurb === "string" && model.household.blurb !== "" ? model.household.blurb : "Front door and hall camera";
  return (
    <Surface eyebrow="Household">
      <p className="subject">
        {name}
        {age !== null ? ` · ${age}` : null}
      </p>
      <p className="support">{blurb}</p>
      {status.ring.mode === "bundle" ? <SyntheticBadge /> : null}
    </Surface>
  );
}
