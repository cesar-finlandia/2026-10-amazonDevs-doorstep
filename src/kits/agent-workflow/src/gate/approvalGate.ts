// Requirement IDs: HEE-KIT-02
import type { Source } from "../store/domainStore.js";

export interface ApprovalRequest {
  id: string;
  action: string;
  plainSummary: string;
  source: Source;
  requestedAt: number;
}

export type ApprovalDecision =
  | { decision: "approved" }
  | { decision: "rejected" | "aborted" | "timeout"; message: string };

export interface ApprovalGate {
  setEnabled(on: boolean): void;
  isEnabled(): boolean;                       // default ON
  request(req: Omit<ApprovalRequest, "id" | "requestedAt">, signal?: AbortSignal): Promise<ApprovalDecision>;
  pending(): ApprovalRequest[];
  decide(id: string, decision: "approved" | "rejected"): boolean;
  subscribe(fn: (pending: ApprovalRequest[]) => void): () => void;
}

export function createApprovalGate(opts?: { timeoutMs?: number /* default 120000 */; now?: () => number }): ApprovalGate {
  const timeoutMs = opts?.timeoutMs ?? 120000;
  const now = opts?.now ?? Date.now;
  let enabled = true;
  let counter = 0;
  const waiting = new Map<string, {
    req: ApprovalRequest;
    resolve: (d: ApprovalDecision) => void;
    timer: ReturnType<typeof setTimeout>;
    signal?: AbortSignal;
    onAbort?: () => void;
  }>();
  const listeners = new Set<(pending: ApprovalRequest[]) => void>();

  function notify(): void {
    const list = [...waiting.values()].map((w) => w.req);
    for (const fn of listeners) fn(list);
  }

  function settle(id: string, decision: ApprovalDecision): boolean {
    const w = waiting.get(id);
    if (!w) return false;
    clearTimeout(w.timer);
    if (w.signal && w.onAbort) w.signal.removeEventListener("abort", w.onAbort);
    waiting.delete(id);
    w.resolve(decision);
    notify();
    return true;
  }

  return {
    setEnabled(on: boolean): void {
      enabled = on;
    },
    isEnabled(): boolean {
      return enabled;
    },
    request(req, signal?: AbortSignal): Promise<ApprovalDecision> {
      if (!enabled) return Promise.resolve({ decision: "approved" });
      if (signal?.aborted) {
        return Promise.resolve({
          decision: "aborted",
          message: "The request was cancelled before the human decided. Do not retry the same action; ask the human how to continue.",
        });
      }
      counter += 1;
      const id = `appr-${counter}`;
      return new Promise<ApprovalDecision>((resolve) => {
        const entry = { id, ...req, requestedAt: now() };
        const seconds = timeoutMs / 1000;
        const timer = setTimeout(() => {
          settle(id, {
            decision: "timeout",
            message: `No human decision arrived within ${seconds} seconds. Do not retry the same action; ask the human how to continue.`,
          });
        }, timeoutMs);
        const record: {
          req: ApprovalRequest;
          resolve: (d: ApprovalDecision) => void;
          timer: ReturnType<typeof setTimeout>;
          signal?: AbortSignal;
          onAbort?: () => void;
        } = { req: entry, resolve, timer, signal };
        if (signal) {
          const onAbort = (): void => {
            settle(id, {
              decision: "aborted",
              message: "The request was cancelled before the human decided. Do not retry the same action; ask the human how to continue.",
            });
          };
          record.onAbort = onAbort;
          signal.addEventListener("abort", onAbort, { once: true });
        }
        waiting.set(id, record);
        notify();
      });
    },
    pending(): ApprovalRequest[] {
      return [...waiting.values()].map((w) => w.req);
    },
    decide(id: string, decision: "approved" | "rejected"): boolean {
      const w = waiting.get(id);
      if (!w) return false;
      if (decision === "approved") return settle(id, { decision: "approved" });
      return settle(id, {
        decision: "rejected",
        message: `The human declined "${w.req.plainSummary}". Ask what to do instead.`,
      });
    },
    subscribe(fn: (pending: ApprovalRequest[]) => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
