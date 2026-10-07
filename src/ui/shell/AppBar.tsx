// src/ui/shell/AppBar.tsx — identity and the global controls (DP-UI §5.6 §6.1).
// Requirement IDs: FR-19
import { useState } from "react";
import { CircleHelp, Layers } from "lucide-react";
import { Brandmark } from "./Brandmark.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { Explainer } from "../primitives/Explainer.js";
import { useApp } from "../state/SessionProvider.js";
import { useStatus } from "../state/hooks.js";
import { loadSampleWeek } from "../state/sampleWeek.js";

function agentSubject(kind: string): string {
  if (kind === "bedrock") return "Bedrock";
  if (kind === "vertex-fallback") return "Backup model";
  if (kind === "golden") return "Recorded run";
  return "By hand";
}

export function AppBar(): React.JSX.Element {
  const status = useStatus();
  const { session } = useApp();
  const [explainerOpen, setExplainerOpen] = useState(false);
  // "Try it" (DP-UI §5.6: loads the sample week if needed and starts the
  // review): close the panel, make sure there is a week to review, then ask
  // the Agent panel to start through the doorstep:start-review event (the
  // same run path as its primary button, so the trace and feed grow).
  const onTry = (): void => {
    setExplainerOpen(false);
    void (async () => {
      const state = session.store.getState();
      const hasWeek = state.events.some((e) => e.tsMs >= state.window.baselineStartMs + 7 * 86400000);
      if (!hasWeek) await loadSampleWeek(session);
      window.dispatchEvent(new Event("doorstep:start-review"));
    })();
  };
  const live = status.ring.mode === "live";
  const ringSubject = live
    ? status.ring.tokenExpiresInSec === null
      ? "Live"
      : `Live · ${Math.floor(status.ring.tokenExpiresInSec / 60)} min`
    : "Sample week";
  const agentTop = status.agent.kind === "bedrock";
  return (
    <header className="appbar">
      <Brandmark size="header" />
      <button
        type="button"
        data-variant="ghost"
        className="household-btn"
        onClick={() => window.dispatchEvent(new Event("doorstep:toggle-rail"))}
      >
        Household
      </button>
      <button type="button" data-variant="ghost" data-app-explainer="" onClick={() => setExplainerOpen(true)}>
        <CircleHelp size={18} aria-hidden="true" />
        How this works
      </button>
      <Explainer open={explainerOpen} onClose={() => setExplainerOpen(false)} onTry={onTry} />
      <div className="appbar__spacer" />
      <div className="appbar__cluster">
        <div className="status-chip" data-degraded={live ? undefined : "true"}>
          {!live ? <Layers size={14} aria-hidden="true" /> : null}
          <span className="eyebrow">Ring</span>
          <span className="subject">{ringSubject}</span>
        </div>
        <div className="status-chip" data-degraded={agentTop ? undefined : "true"}>
          {!agentTop ? <Layers size={14} aria-hidden="true" /> : null}
          <span className="eyebrow">Agent</span>
          <span className="subject">{agentSubject(status.agent.kind)}</span>
          {status.usedPct > 0 ? <span className="support">{status.usedPct}% of budget</span> : null}
        </div>
        <span className="toggle-bar">
          <ThemeToggle />
        </span>
      </div>
    </header>
  );
}
