// src/ui/panels/ConnectPanel.tsx — the Ring connection row (DP-UI §6.9).
// Requirement IDs: FR-01
import { Surface } from "../primitives/Surface.js";
import { Button } from "../primitives/Button.js";
import { useStatus } from "../state/hooks.js";
import { requestConnectDialog } from "./ConnectDialog.js";

export function ConnectPanel(): React.JSX.Element {
  const status = useStatus();
  const live = status.ring.mode === "live";
  const minutes = status.ring.tokenExpiresInSec === null ? null : Math.floor(status.ring.tokenExpiresInSec / 60);
  return (
    <Surface eyebrow="Ring connection">
      <Button variant="ghost" onClick={() => requestConnectDialog()}>
        Connect Ring
      </Button>
      {live ? (
        <p className="support">{minutes === null ? "Token active." : `Token expires in ${minutes} min.`}</p>
      ) : (
        <p className="support">Using the sample week.</p>
      )}
    </Surface>
  );
}
