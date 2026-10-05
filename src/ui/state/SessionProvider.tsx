// src/ui/state/SessionProvider.tsx — one session per tab (DP-UI §3.2, §6.3 items 1, 10).
// Requirement IDs: FR-01, FR-09
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "src/domain/session.js";
import { createAppSession } from "src/agent/app-session.js";
import { createHttpRingPort } from "src/server/http-ring-port.js";
import type { HttpRingPort } from "src/server/http-ring-port.js";
import { installTraceHook } from "src/kits/agent-workflow/src/trace/traceWriter.js";
import { candidateIncidents } from "src/domain/rules.js";

export interface AppContext {
  session: Session;
  ring: HttpRingPort;
  sessionId: string;
}

const Ctx = createContext<AppContext | null>(null);

let fallbackSessionId = "";

function randomSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    const buf = new Uint32Array(16);
    globalThis.crypto.getRandomValues(buf);
    for (const n of buf) out += chars[(n as number) % 36];
  } else {
    for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * 36)];
  }
  return out;
}

export function SessionProvider(props: {
  children: React.ReactNode;
  baseUrl?: string;
  sessionIdOverride?: string;
}): React.JSX.Element {
  const [sessionId] = useState<string>(() => {
    if (props.sessionIdOverride) return props.sessionIdOverride;
    try {
      const store = sessionStorage;
      const prev = store.getItem("dr-session");
      if (prev) return prev;
      const id = randomSessionId();
      store.setItem("dr-session", id);
      return id;
    } catch {
      if (!fallbackSessionId) fallbackSessionId = randomSessionId();
      return fallbackSessionId;
    }
  });
  const value = useMemo<AppContext>(() => {
    const ring = createHttpRingPort({ baseUrl: props.baseUrl ?? "", sessionId });
    const session = createAppSession({ ring });
    return { session, ring, sessionId };
  }, [props.baseUrl, sessionId]);
  useEffect(() => {
    document.body.dataset["appReady"] = "true";
    const off = installTraceHook(value.session.trace);
    if (new URLSearchParams(location.search).get("hook") === "1") {
      (window as unknown as { __doorstep?: unknown }).__doorstep = {
        session: value.session,
        ring: value.ring,
        openFirstCandidate: async (): Promise<string | null> => {
          const first = candidateIncidents(value.session.store.getState())[0];
          if (!first) return null;
          const res = await value.session.call(
            "open_incident",
            {
              kind: first.kind,
              title: first.title,
              eventIds: [...first.eventIds],
              startMs: first.startMs,
              endMs: first.endMs,
              ...(first.routineId !== undefined ? { routineId: first.routineId } : {}),
              ...(first.dayIndex !== undefined ? { dayIndex: first.dayIndex } : {}),
              withSnapshot: true,
            },
            { source: "human" },
          );
          if (!res.ok) return null;
          const incident = (res.data as { incident?: { id?: string } } | undefined)?.incident;
          return incident?.id ?? null;
        },
      };
    }
    return () => {
      off();
      const host = window as unknown as { __doorstep?: { session?: Session } };
      if (host.__doorstep?.session === value.session) delete host.__doorstep;
    };
  }, [value]);
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useApp(): AppContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside SessionProvider");
  return v;
}
