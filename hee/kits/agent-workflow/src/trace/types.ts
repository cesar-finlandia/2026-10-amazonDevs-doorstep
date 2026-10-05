// Requirement IDs: HEE-KIT-02
import type { Source } from "../store/domainStore.js";

export interface TraceEntry {
  seq: number;                              // 1-based, gap-free
  round: number;                            // 0 = setup; increments each plan→act→verify cycle
  kind: "model" | "action" | "approval" | "system";
  name: string;                             // model role or action name
  source: Source;
  input_ref: string | null;                 // e.g. "args#12" or an entity id; free-form, non-empty when there is input
  args?: Record<string, unknown>;           // action entries: the validated arguments, kept so a trace can be replayed (omitted when the JSON is longer than 2000 characters)
  output_ref: string | null;
  ok: boolean;
  tokens?: { prompt: number; output: number; total: number };
  latency_ms: number;
  decision?: string;                        // for approvals: "approved" | "rejected" | "aborted" | "timeout"; for models: what was decided
  state_change?: { revision_before: number; revision_after: number; entity_ids: string[] };
  truth?: { errors: number; warnings: number };   // present on verify actions
}

export interface RunTrace {
  version: "1.0.0";
  run_id: string;
  started_at: string;
  entries: TraceEntry[];
  summary: TraceSummary;
}

export interface TraceSummary {
  model_calls: number;
  actions: number;
  rounds: number;
  model_roles: string[];   // distinct names of kind "model"
  verify_repair_rounds: number;
  human_checkpoints: number;
  approvals: { approved: number; rejected: number };
  final_truth: { errors: number; warnings: number } | null;
}

export interface TraceWriter {
  record(e: Omit<TraceEntry, "seq">): TraceEntry;
  entries(): TraceEntry[];
  snapshot(): RunTrace;
  reset(): void;
  subscribe(fn: (e: TraceEntry) => void): () => void;
}
