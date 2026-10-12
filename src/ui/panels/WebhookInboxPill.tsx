// src/ui/panels/WebhookInboxPill.tsx — webhooks still waiting (DP-UI §6.9).
// Requirement IDs: FR-19
import { Surface } from "../primitives/Surface.js";
import { Metric } from "../primitives/Metric.js";
import { Button } from "../primitives/Button.js";
import { useModel, useStatus } from "../state/hooks.js";

export function WebhookInboxPill(): React.JSX.Element {
  const model = useModel();
  const status = useStatus();
  // The live server count, always: after ingest it drains to zero on its
  // own, and a new arrival (live or simulated) must read on the badge.
  const n = status.inboxDefault;
  // Delivers a signed simulated doorbell press through the production
  // /api/dev/simulate-webhook path (same HMAC verifier as live), the way a
  // live Ring delivery arrives: with no session affinity, into the default
  // inbox the badge reads. The server enables the route exactly when
  // status.simulate is true.
  const press = (): void => {
    const first = model.events.find((e) => typeof e.deviceId === "string" && e.deviceId !== "");
    void fetch("/api/dev/simulate-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "button_press", deviceId: first?.deviceId ?? "dev-door" }),
    }).catch(() => undefined);
  };
  return (
    <Surface eyebrow="Webhooks">
      <Metric label="Webhook inbox" value={n} unit="waiting" size="md" />
      <p className="support">{`Webhook inbox · ${n} waiting`}</p>
      {status.simulate ? <Button variant="ghost" onClick={press}>Simulate a doorbell press</Button> : null}
    </Surface>
  );
}
