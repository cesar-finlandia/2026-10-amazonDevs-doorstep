// src/ui/pages/Kit.tsx — internal gallery of every primitive in every state (DP-UI WU-UI-05).
// Not linked from the UI; excluded from the craft audit.
// Requirement IDs: FR-19
import { useState } from "react";
import { Surface } from "../primitives/Surface.js";
import { Metric } from "../primitives/Metric.js";
import { Button } from "../primitives/Button.js";
import { Message } from "../primitives/Message.js";
import { StatusChip } from "../primitives/StatusChip.js";
import { SourceBadge } from "../primitives/SourceBadge.js";
import { SyntheticBadge } from "../primitives/SyntheticBadge.js";
import { WorkIndicator } from "../primitives/WorkIndicator.js";
import { EmptyState } from "../primitives/EmptyState.js";
import { Dialog } from "../primitives/Dialog.js";
import { Explainer } from "../primitives/Explainer.js";
import type { Tone } from "../copy/banner.js";

const TONES: Tone[] = ["info", "success", "warning", "danger", "degraded"];
const TIERS: ("banner" | "callout" | "toast")[] = ["banner", "callout", "toast"];

export default function KitPage(): React.JSX.Element {
  const [calls, setCalls] = useState(0);
  const bump = (): void => setCalls((n) => n + 1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  return (
    <div className="page">
      <div data-kit-calls={calls} style={{ display: "flex", flexDirection: "column", gap: "16px", gridColumn: "1 / -1" }}>
        <section data-kit="surface">
          <h2>Surfaces</h2>
          <Surface title="Titled surface" eyebrow="Sample" help="check-panel">
            <p>A surface with a header row and a help control.</p>
          </Surface>
          <Surface>
            <p>A surface without a title renders no header row.</p>
          </Surface>
          <Surface title="Sunken well" well>
            <p>A well for logs and long text.</p>
          </Surface>
          <Surface title="Primary panel" emphasis="primary">
            <p>The one accent-rule surface in its column.</p>
          </Surface>
          <Surface title="Floating panel" elevation={2}>
            <p>Elevation two for popovers and sticky bars.</p>
          </Surface>
        </section>
        <section data-kit="metric">
          <h2>Metrics</h2>
          <Metric label="Open checks" value={4} size="xl" unit="to look at" />
          <Metric label="Stay length" value={22} size="lg" unit="min" />
          <Metric label="Visits today" value={7} size="md" />
          <Metric label="Wide value" value={12800} size="lg" />
          <Metric label="Capped value" value={150} size="lg" max={99} />
          <Metric label="Nothing recorded" value={null} size="lg" />
          <Metric label="Loading value" value={3} size="lg" loading />
          <div style={{ width: "120px" }}>
            <Metric label="Narrow value" value={88800} size="lg" />
          </div>
          <Metric label="Hero at its widest" value={150} size="xl" max={99} />
          <Metric label="Stay at its longest" value={999} size="lg" unit="min" />
          <Metric label="Cost at its highest" value="$99.9999" size="lg" />
        </section>
        <section data-kit="button">
          <h2>Buttons</h2>
          <Button variant="primary">Run report</Button>
          <Button>Run report</Button>
          <Button loading>Run report</Button>
          <Button variant="ghost">Save for later</Button>
          <Button variant="danger">Remove</Button>
          <Button disabled>Unavailable</Button>
        </section>
        <section data-kit="message">
          <h2>Messages</h2>
          {TONES.map((tone) => (
            <div key={tone}>
              {TIERS.map((tier) => (
                <Message
                  key={`${tone}-${tier}`}
                  tier={tier}
                  tone={tone}
                  title={`${tone} ${tier} title`}
                  detail={`A ${tone} message in the ${tier} tier with a full sentence.`}
                />
              ))}
            </div>
          ))}
          <Message
            tier="callout"
            tone="info"
            title="Steps and outcomes"
            detail="Two steps with their outcomes."
            items={[
              { step: "First step", text: "The week was read end to end." },
              { step: "Second step", text: "Each day was compared with the usual rhythm." },
            ]}
          />
          <Message tier="callout" tone="success" title="Plain callout" detail="No structured detail here." />
        </section>
        <section data-kit="badge">
          <h2>Badges</h2>
          <SourceBadge source="agent" />
          <SourceBadge source="human" />
          <SourceBadge source="system" />
          <SyntheticBadge />
          <StatusChip tone="success" label="Resolved" />
          <StatusChip tone="warning" label="Needs a look" />
          <StatusChip tone="danger" label="Failed" />
          <StatusChip tone="degraded" label="Backup" />
        </section>
        <section data-kit="indicator">
          <h2>Work indicator</h2>
          <WorkIndicator label="Reading doorway events" />
        </section>
        <section data-kit="empty">
          <h2>Empty state</h2>
          <EmptyState
            title="Nothing here yet"
            detail="Load the sample week to see the calendar fill in."
            action={{ label: "Load the sample week", onClick: bump }}
            secondary={{ label: "Connect Ring", onClick: () => undefined }}
          />
        </section>
        <section data-kit="dialog">
          <h2>Dialog</h2>
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} label="Kit dialog">
            <h2>Kit dialog</h2>
            <p>A dialog traps focus until it closes.</p>
            <Button onClick={() => setDialogOpen(false)}>Close dialog</Button>
          </Dialog>
        </section>
        <section data-kit="explainer">
          <h2>Explainer</h2>
          <Button onClick={() => setExplainerOpen(true)}>Open explainer</Button>
          <Explainer open={explainerOpen} onClose={() => setExplainerOpen(false)} onTry={bump} />
        </section>
      </div>
    </div>
  );
}
