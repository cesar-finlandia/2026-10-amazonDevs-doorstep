// src/ui/shell/Banners.tsx — the one page banner below the app bar (DP-UI §6.3 item 6).
// Requirement IDs: FR-21
import { useEffect, useState, useSyncExternalStore } from "react";
import { RingError } from "src/domain/ring-port.js";
import type { EventEnvelope } from "src/platform/transport";
import { Message } from "../primitives/Message.js";
import { pickBanner } from "../copy/banner.js";
import type { BannerInput } from "../copy/banner.js";
import { useEnvelopes, useStatus } from "../state/hooks.js";
import { getLastRunError, subscribeRunError } from "../state/useRun.js";
import { loadSampleWeek } from "../state/sampleWeek.js";
import { useApp } from "../state/SessionProvider.js";
import { requestConnectDialog } from "../panels/ConnectDialog.js";

function agentOf(kind: string): BannerInput["agentKind"] {
  if (kind === "bedrock" || kind === "vertex-fallback" || kind === "golden" || kind === "manual") return kind;
  return "golden";
}

function envelopeItems(envelopes: EventEnvelope[]): { step: string; text: string }[] {
  const rel = envelopes.filter((e) => e.step_id === "agent-rung" || e.step_id === "system-degraded").slice(-3);
  return rel
    .map((e) => {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const step = typeof payload["label"] === "string" && payload["label"] !== "" ? (payload["label"] as string) : e.step_id;
      const text = typeof payload["reason"] === "string" && payload["reason"] !== ""
        ? (payload["reason"] as string)
        : e.status;
      return { step, text };
    })
    .filter((it) => it.step !== "" && it.text !== "");
}

export function Banners(): React.JSX.Element | null {
  const { session, ring } = useApp();
  const status = useStatus();
  const { envelopes } = useEnvelopes();
  const runError = useSyncExternalStore(subscribeRunError, getLastRunError);
  const [ringErrorState, setRingErrorState] = useState<{ status?: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    ring
      .listDevices()
      .then(() => {
        if (alive) setRingErrorState(null);
      })
      .catch((e) => {
        if (!alive) return;
        setRingErrorState({ ...(e instanceof RingError && typeof e.status === "number" ? { status: e.status } : {}) });
      });
    return () => {
      alive = false;
    };
  }, [ring, status.ring.mode]);

  const tokenMinutes = status.ring.tokenExpiresInSec === null ? null : Math.floor(status.ring.tokenExpiresInSec / 60);
  const input: BannerInput = {
    ringMode: status.ring.mode,
    ringDegraded: status.ring.mode === "bundle" && status.ring.tokenExpiresInSec !== null,
    ringError: ringErrorState,
    agentKind: agentOf(status.agent.kind),
    recordedDate: null,
    tokenMinutes,
    usedPct: status.usedPct,
    runError,
  };
  const spec = pickBanner(input);
  const specId = spec?.id ?? null;
  useEffect(() => {
    setExpanded(false);
  }, [specId]);
  if (!spec) return null;
  const withItems = spec.id === "manual" || spec.id === "recorded" || spec.id === "backup"
    ? { ...spec, items: envelopeItems(envelopes) }
    : spec;
  const label = withItems.action && withItems.action.key === "show-details" && expanded ? "Hide details" : withItems.action?.label;

  const onAction = (): void => {
    const key = withItems.action?.key;
    if (key === "use-sample") {
      void loadSampleWeek(session)
        .then(() => setRingErrorState(null))
        .catch(() => undefined);
    } else if (key === "retry") {
      window.location.reload();
    } else if (key === "connect" || key === "paste-token") {
      requestConnectDialog();
    } else if (key === "show-details") {
      setExpanded((v) => !v);
    } else if (key === "open-actions") {
      window.dispatchEvent(new Event("doorstep:open-manual"));
    }
  };

  return (
    <Message
      tier="banner"
      tone={withItems.tone}
      title={withItems.title}
      detail={withItems.detail}
      {...(withItems.items && withItems.items.length > 0 ? { items: withItems.items } : {})}
      {...(label && withItems.action ? { action: { label, onClick: onAction } } : {})}
    />
  );
}
