// src/ui/panels/ConsentList.tsx — outgoing channels, human-only switches (DP-UI §6.9).
// Requirement IDs: FR-19
import type { ScopeName } from "src/domain/types.js";
import { Surface } from "../primitives/Surface.js";
import { useModel } from "../state/hooks.js";
import { useApp } from "../state/SessionProvider.js";

const LABELS: Record<ScopeName, string> = {
  family_message: "Family messages",
  chime_announcement: "Chime announcements",
  weekly_brief: "Weekly brief",
};

function supportFor(scope: ScopeName, caretaker: string): string {
  const who = caretaker !== "" ? caretaker : "your family";
  if (scope === "family_message") return `${who} by message`;
  if (scope === "chime_announcement") return "Spoken on the hall chime";
  return `${who}, Sunday evening`;
}

export function ConsentList(): React.JSX.Element {
  const model = useModel();
  const { session } = useApp();
  const caretaker = typeof model.household.caretaker === "string" ? model.household.caretaker : "";
  return (
    <Surface eyebrow="Consent" help="consent" resultRegion="consent">
      <ul className="consent-list">
        {model.consent.map((c) => (
          <li key={c.scope} className="consent-row">
            <span className="consent-row__body">
              <span className="subject">{LABELS[c.scope] ?? c.scope}</span>
              <span className="support">{supportFor(c.scope, caretaker)}</span>
            </span>
            <span
              role="switch"
              aria-checked={c.granted ? "true" : "false"}
              aria-label={LABELS[c.scope] ?? c.scope}
              tabIndex={0}
              data-switch={c.granted ? "on" : "off"}
              onClick={() => {
                session.store.dispatch("set_consent", { scope: c.scope, granted: !c.granted, actor: "human" }, "human");
              }}
              onKeyDown={(ev) => {
                if (ev.key === " " || ev.key === "Enter") {
                  ev.preventDefault();
                  session.store.dispatch("set_consent", { scope: c.scope, granted: !c.granted, actor: "human" }, "human");
                }
              }}
            >
              <span className="switch__knob" aria-hidden="true" />
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
