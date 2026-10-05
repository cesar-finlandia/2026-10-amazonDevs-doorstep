// Requirement IDs: HEE-KIT-02
import type { RunTrace, TraceEntry, TraceWriter } from "./types.js";
import { summarizeTrace } from "./summarize.js";

function defaultRunId(): string {
  return `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export function createTraceWriter(opts?: { runId?: string; now?: () => number }): TraceWriter {
  const run_id = opts?.runId ?? defaultRunId();
  const now = opts?.now ?? Date.now;
  const started_at = new Date(now()).toISOString();
  let list: TraceEntry[] = [];
  const listeners = new Set<(e: TraceEntry) => void>();

  return {
    record(e: Omit<TraceEntry, "seq">): TraceEntry {
      const entry = { ...e, seq: list.length + 1 } as TraceEntry;
      list.push(entry);
      for (const fn of listeners) fn(entry);
      return entry;
    },
    entries(): TraceEntry[] {
      return [...list];
    },
    snapshot(): RunTrace {
      const entries = [...list];
      return { version: "1.0.0", run_id, started_at, entries, summary: summarizeTrace(entries) };
    },
    reset(): void {
      list = [];
    },
    subscribe(fn: (e: TraceEntry) => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

export function installTraceHook(writer: TraceWriter): () => void {
  const host = globalThis as unknown as {
    __runTrace?: { get(): RunTrace; reset(): void };
  };
  const api = {
    get(): RunTrace {
      return writer.snapshot();
    },
    reset(): void {
      writer.reset();
    },
  };
  host.__runTrace = api;
  return () => {
    if ((globalThis as unknown as { __runTrace?: unknown }).__runTrace === api) {
      delete (globalThis as unknown as { __runTrace?: unknown }).__runTrace;
    }
  };
}
