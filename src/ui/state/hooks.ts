// src/ui/state/hooks.ts — model, issues, status and envelopes (DP-UI §3.2, §6.3 items 2–3).
// Requirement IDs: FR-09
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { WeekModel } from "src/domain/types.js";
import type { Issue } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import type { EventEnvelope } from "src/platform/transport";
import { useApp } from "./SessionProvider.js";

export function useModel(): WeekModel {
  const { session } = useApp();
  return useSyncExternalStore(
    (cb) => session.store.subscribe(() => cb()),
    () => session.store.getState(),
  );
}

export function useIssues(): { issues: Issue[]; errors: number; warnings: number; open: number } {
  const { session } = useApp();
  const rev = useSyncExternalStore(
    (cb) => session.store.subscribe(() => cb()),
    () => session.store.revision(),
  );
  return useMemo(() => {
    const r = session.checkNow();
    return { issues: r.issues, errors: r.counts.errors, warnings: r.counts.warnings, open: r.counts.errors + r.counts.warnings };
  }, [session, rev]);
}

export interface StatusSnapshot {
  ring: { mode: "bundle" | "live"; tokenExpiresInSec: number | null };
  agent: { kind: string; label: string; model: string };
  usedPct: number;
  inboxDefault: number;
  build: string;
  loaded: boolean;
}

const EMPTY_STATUS: StatusSnapshot = {
  ring: { mode: "bundle", tokenExpiresInSec: null },
  agent: { kind: "golden", label: "Recorded run", model: "" },
  usedPct: 0,
  inboxDefault: 0,
  build: "",
  loaded: false,
};

interface SharedStream {
  es: EventSource | null;
  envelopes: EventEnvelope[];
  status: string;
  degraded: boolean;
  listeners: Set<() => void>;
}

// One EventSource per page, shared by every useEnvelopes instance. (A stream
// per consumer exhausts Chromium's six-connections-per-origin budget and then
// no further navigation to the app can start.) Refcounted: the socket closes
// when the last listener unmounts.
let shared: SharedStream | null = null;

function getShared(): SharedStream {
  if (!shared) {
    const s: SharedStream = { es: null, envelopes: [], status: "connecting", degraded: false, listeners: new Set() };
    shared = s;
    const notify = (): void => {
      for (const fn of [...s.listeners]) fn();
    };
    try {
      const es = new EventSource("/events/stream");
      s.es = es;
      es.addEventListener("envelope", (ev) => {
        try {
          const env = JSON.parse((ev as MessageEvent).data as string) as EventEnvelope;
          s.status = "open";
          if (env.degraded === true) s.degraded = true;
          s.envelopes = [...s.envelopes, env];
          notify();
        } catch {
          /* a malformed frame never breaks the feed */
        }
      });
      es.onerror = () => {
        s.status = "error";
        notify();
      };
    } catch {
      s.status = "error";
    }
  }
  return shared;
}

function releaseShared(s: SharedStream): void {
  if (s.listeners.size === 0 && shared === s) {
    try {
      s.es?.close();
    } catch {
      /* ignore */
    }
    shared = null;
  }
}

export function useEnvelopes(): { envelopes: EventEnvelope[]; status: string; degraded: boolean } {
  const [, setTick] = useState(0);
  const s = getShared();
  useEffect(() => {
    const rerender = (): void => setTick((t) => t + 1);
    s.listeners.add(rerender);
    return () => {
      s.listeners.delete(rerender);
      releaseShared(s);
    };
  }, [s]);
  return { envelopes: s.envelopes, status: s.status, degraded: s.degraded };
}

export function useStatus(): StatusSnapshot {
  const { sessionId } = useApp();
  const { envelopes } = useEnvelopes();
  const [snap, setSnap] = useState<Omit<StatusSnapshot, "loaded"> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/status?sessionId=${encodeURIComponent(sessionId)}`);
      const json = (await res.json()) as {
        ring?: { mode?: string; tokenExpiresInSec?: number };
        agent?: { kind?: string; label?: string; model?: string };
        cost?: { usedPct?: number };
        inbox?: { default?: number };
        build?: string;
      };
      setSnap({
        ring: {
          mode: json.ring?.mode === "live" ? "live" : "bundle",
          tokenExpiresInSec: typeof json.ring?.tokenExpiresInSec === "number" ? json.ring.tokenExpiresInSec : null,
        },
        agent: {
          kind: typeof json.agent?.kind === "string" ? json.agent.kind : "golden",
          label: typeof json.agent?.label === "string" ? json.agent.label : "Recorded run",
          model: typeof json.agent?.model === "string" ? json.agent.model : "",
        },
        usedPct: typeof json.cost?.usedPct === "number" ? json.cost.usedPct : 0,
        inboxDefault: typeof json.inbox?.default === "number" ? json.inbox.default : 0,
        build: typeof json.build === "string" ? json.build : "",
      });
      setLoaded(true);
    } catch {
      /* a failed fetch keeps the previous value */
    }
  }, [sessionId]);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 10000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    const last = envelopes[envelopes.length - 1];
    if (last && (last.step_id === "agent-rung" || last.step_id === "ring-mode")) void refresh();
  }, [envelopes, refresh]);
  if (!snap) return { ...EMPTY_STATUS, loaded };
  return { ...snap, loaded };
}
