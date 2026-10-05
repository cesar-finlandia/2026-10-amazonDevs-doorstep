// Requirement IDs: HEE-KIT-02
import type { DomainStore, Source } from "../store/domainStore.js";

export type ActionGroup = "read" | "change" | "verify" | "navigate" | "collaborate" | "cross_boundary";

export interface ActionDescriptor<M = unknown> {
  name: string;                        // verb_noun, ^[a-z]+(_[a-z0-9]+)+$
  title: string;
  group: ActionGroup;
  description: string;                 // ≥ 2 sentences; contains "Example:" followed by a call
  inputSchema: Record<string, unknown>;// JSON Schema, type object, additionalProperties:false, every property has a description
  annotations: { readOnly: boolean; destructive: boolean; untrustedContent: boolean };
  precondition?: (model: M) => boolean;           // used for validNextActions
  dynamicWhile?: (model: M) => boolean;           // registered only while true (dynamic actions)
  summarize?: (args: unknown) => string;          // plain-language summary for the approval gate
  handler(args: unknown, ctx: ActionContext<M>): Promise<HandlerOutcome> | HandlerOutcome;
}

export interface ActionContext<M> {
  store: DomainStore<M>;
  source: Source;
  signal?: AbortSignal;
  round: number;
}

export type HandlerOutcome =
  | { ok: true; summary: string; data?: unknown; entityIds?: string[] }
  | { ok: false; error: string; next?: string };

export interface ActionResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  revision: number;
  validNextActions: string[];
  error?: { message: string; next?: string };
}

export interface ActionManifestAction {
  name: string;
  title: string;
  group: ActionGroup;
  description: string;
  input_schema: Record<string, unknown>;
  annotations: { readOnly: boolean; destructive: boolean; untrustedContent: boolean };
  dynamic: boolean;
}

export interface ActionManifest {
  version: "1.0.0";
  contract_version: number;
  contract_hash: string;
  generated_at: string;
  actions: ActionManifestAction[];
  procedures: { name: string; steps: string[] }[];
}

export interface Registry<M> {
  register(d: ActionDescriptor<M>): void;
  unregister(name: string): void;
  list(): ActionDescriptor<M>[];                  // includes dynamic actions whose dynamicWhile is true now
  call(name: string, args: unknown, opts: { source: Source; round?: number; signal?: AbortSignal }): Promise<ActionResult>;
  onChange(fn: (names: string[]) => void): () => void;   // fires when the registered set changes
  exportManifest(): ActionManifest;
}
