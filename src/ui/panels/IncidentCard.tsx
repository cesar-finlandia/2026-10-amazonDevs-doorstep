// src/ui/panels/IncidentCard.tsx — one moment with its evidence (DP-UI §6.4).
// Requirement IDs: FR-04
import { useState } from "react";
import { fmtDuration } from "src/domain/time.js";
import { ChangedFlash } from "src/kits/agent-workflow/src/react/ChangedFlash.js";
import { Surface } from "../primitives/Surface.js";
import { Metric } from "../primitives/Metric.js";
import { Message } from "../primitives/Message.js";
import { Button } from "../primitives/Button.js";
import { StatusChip } from "../primitives/StatusChip.js";
import { useModel } from "../state/hooks.js";
import { useUiActions } from "../state/useUiActions.js";
import { useApp } from "../state/SessionProvider.js";
import { emptyIncidents, incidentEyebrow } from "../copy/templates.js";

export function IncidentCard(): React.JSX.Element {
  const model = useModel();
  const { session } = useApp();
  const actions = useUiActions();
  const [expanded, setExpanded] = useState(false);
  const selected = model.incidents.find((i) => i.id === model.ui.selectedIncidentId) ?? null;
  const open = model.incidents.filter((i) => i.status === "open").sort((a, b) => (a.id < b.id ? -1 : 1));
  const incident = selected ?? open[0] ?? model.incidents[model.incidents.length - 1] ?? null;
  if (!incident) {
    const empty = emptyIncidents();
    return (
      <Surface eyebrow="Moment" help="incident-card" resultRegion="incident-card">
        <p className="subject">{empty.title}</p>
        <p className="support">{empty.detail}</p>
      </Surface>
    );
  }
  const media = model.media.filter((m) => m.incidentId === incident.id);
  const snap = media.find((m) => m.kind === "snapshot") ?? media[0] ?? null;
  const p90 = Math.round(Math.max(model.baseline.dwellP90Sec, 900) / 60);
  const statusTone = incident.status === "resolved" ? "success" : incident.status === "dismissed" ? "degraded" : "warning";
  const statusWord = incident.status === "open" ? "Needs a look" : incident.status === "explained" ? "Explained" : incident.status === "resolved" ? "Resolved" : "Dismissed";
  return (
    <ChangedFlash store={session.store as never} entityId={incident.id}>
      <Surface eyebrow={incidentEyebrow(incident, model.household.utcOffsetMin)} help="incident-card" resultRegion="incident-card">
        <h2 className="incident-title">{incident.title}</h2>
        {incident.summary ? (
          <>
            <p className={expanded ? undefined : "clamp-3"}>{incident.summary}</p>
            <Button variant="ghost" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : "Show more"}
            </Button>
          </>
        ) : null}
        <Metric label="Stayed" value={fmtDuration(incident.endMs - incident.startMs)} size="md" support={`usual under ${p90} min`} />
        {snap ? (
          <figure className="evidence">
            <img src={`data:${snap.contentType};base64,${snap.dataBase64}`} alt={`Snapshot from ${snap.label}`} />
            <figcaption className="support">{snap.label}</figcaption>
          </figure>
        ) : (
          <Message tier="callout" tone="info" title="No snapshot for this moment" detail="The camera did not keep a still for this moment." />
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <StatusChip tone={statusTone} label={statusWord} />
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button
            variant="ghost"
            onClick={() => void session.store.dispatch("set_incident_status", { incidentId: incident.id, status: "explained" }, "human")}
          >
            Mark as explained
          </Button>
          <Button
            variant="ghost"
            onClick={() => void session.store.dispatch("set_incident_status", { incidentId: incident.id, status: "dismissed" }, "human")}
          >
            Dismiss
          </Button>
          {snap ? (
            <Button variant="ghost" onClick={() => actions.openLiveView(snap.deviceId)}>
              Live view
            </Button>
          ) : null}
        </div>
      </Surface>
    </ChangedFlash>
  );
}
