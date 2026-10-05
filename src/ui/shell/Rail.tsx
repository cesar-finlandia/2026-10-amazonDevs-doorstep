// src/ui/shell/Rail.tsx — the household rail (DP-UI §5.6 §6.9).
// Requirement IDs: FR-19
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle.js";
import { HouseholdCard } from "../panels/HouseholdCard.js";
import { DeviceList } from "../panels/DeviceList.js";
import { QuietHoursEditor } from "../panels/QuietHoursEditor.js";
import { ConsentList } from "../panels/ConsentList.js";
import { ConnectPanel } from "../panels/ConnectPanel.js";
import { ConnectDialog } from "../panels/ConnectDialog.js";
import { WebhookInboxPill } from "../panels/WebhookInboxPill.js";

export function Rail(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = (): void => setOpen((v) => !v);
    window.addEventListener("doorstep:toggle-rail", toggle);
    return () => window.removeEventListener("doorstep:toggle-rail", toggle);
  }, []);
  return (
    <aside className="rail" aria-label="Household" {...(open ? { "data-open": "true" } : {})}>
      <HouseholdCard />
      <DeviceList />
      <QuietHoursEditor />
      <ConsentList />
      <ConnectPanel />
      <ConnectDialog />
      <WebhookInboxPill />
      <div className="rail__footer">
        <span className="toggle-rail">
          <ThemeToggle />
        </span>
      </div>
    </aside>
  );
}
