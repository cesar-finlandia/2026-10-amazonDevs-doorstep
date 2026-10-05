// src/ui/state/useRun.ts — starts and watches a week review (DP-UI §3.2, §6.3 item 4).
// Requirement IDs: FR-06, FR-09
import { useCallback, useRef, useState } from "react";
import { runWeekReview } from "src/agent/orchestrator.js";
import type { Phase, ReviewSummary } from "src/agent/orchestrator.js";
import { createHttpAgentTransport } from "src/server/http-agent-transport.js";
import { useApp } from "./SessionProvider.js";

export interface RunState {
  status: "idle" | "running" | "done" | "stopped" | "error";
  phase: Phase | null;
  round: number;
  detail: string;
  summary: ReviewSummary | null;
  error: string | null;
}

const IDLE: RunState = { status: "idle", phase: null, round: 0, detail: "", summary: null, error: null };

// The last review failure, shared with the banner slot (which owns no useRun
// instance of its own). Cleared whenever a new run starts.
let lastRunError: string | null = null;
const runErrorListeners = new Set<() => void>();

export function getLastRunError(): string | null {
  return lastRunError;
}

export function subscribeRunError(fn: () => void): () => void {
  runErrorListeners.add(fn);
  return () => {
    runErrorListeners.delete(fn);
  };
}

function setLastRunError(e: string | null): void {
  lastRunError = e;
  for (const fn of [...runErrorListeners]) fn();
}

export function useRun(): RunState & { start(): Promise<void>; cancel(): void } {
  const { session } = useApp();
  const [state, setState] = useState<RunState>(IDLE);
  const ctrl = useRef<AbortController | null>(null);
  const running = useRef(false);
  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const controller = new AbortController();
    ctrl.current = controller;
    setLastRunError(null);
    setState({ ...IDLE, status: "running" });
    try {
      const transport = createHttpAgentTransport({});
      await transport.refreshStatus();
      const summary = await runWeekReview({
        session,
        transport,
        onPhase: (phase: Phase, info: { round: number; detail: string }) =>
          setState((s) => ({ ...s, phase, round: info.round, detail: info.detail })),
        signal: controller.signal,
        autoDecide: null,
      });
      if (new URLSearchParams(location.search).get("hook") === "1") {
        (window as unknown as { __lastrun?: unknown }).__lastrun = {
          ok: summary.ok,
          stoppedAt: summary.stoppedAt,
          rung: summary.rung,
          counts: summary.counts,
          degraded: summary.degraded.map((d) => d.reason),
        };
      }
      setState((s) => ({ ...s, status: summary.ok ? "done" : "stopped", summary }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setLastRunError(message);
      setState((s) => ({ ...s, status: "error", error: message }));
    } finally {
      running.current = false;
      ctrl.current = null;
    }
  }, [session]);
  const cancel = useCallback(() => {
    ctrl.current?.abort();
  }, []);
  return { ...state, start, cancel };
}
