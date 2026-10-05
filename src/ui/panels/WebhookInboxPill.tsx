// src/ui/panels/WebhookInboxPill.tsx — webhooks still waiting (DP-UI §6.9).
// Requirement IDs: FR-19
import { Surface } from "../primitives/Surface.js";
import { Metric } from "../primitives/Metric.js";
import { Button } from "../primitives/Button.js";
import { useModel, useStatus } from "../state/hooks.js";

export function WebhookInboxPill(): React.JSX.Element {
  const model = useModel();
  const status = useStatus();
  const loaded = model.events.length > 0;
  const n = loaded ? 0 : status.inboxDefault;
  const simulate = (status as unknown as { simulate?: unknown }).simulate === true;
  return (
    <Surface eyebrow="Webhooks">
      <Metric label="Webhook inbox" value={n} unit="waiting" size="md" />
      <p className="support">{`Webhook inbox · ${n} waiting`}</p>
      {simulate ? <Button variant="ghost">Simulate a doorbell press</Button> : null}
    </Surface>
  );
}
