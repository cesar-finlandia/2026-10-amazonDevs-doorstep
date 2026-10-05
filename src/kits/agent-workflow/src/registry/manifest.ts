// Requirement IDs: HEE-KIT-02
import { createHash } from "node:crypto";
import type { ActionDescriptor, ActionManifest } from "./types.js";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function contractHashForActions(actions: ActionManifest["actions"]): string {
  return createHash("sha256").update(stableStringify(actions)).digest("hex");
}

export function buildManifest<M>(args: {
  descriptors: ActionDescriptor<M>[];
  procedures?: { name: string; steps: string[] }[];
  contractVersion?: number;
  generatedAt?: string;
}): ActionManifest {
  const actions = args.descriptors.map((d) => ({
    name: d.name,
    title: d.title,
    group: d.group,
    description: d.description,
    input_schema: d.inputSchema,
    annotations: { ...d.annotations },
    dynamic: d.dynamicWhile !== undefined,
  }));
  return {
    version: "1.0.0",
    contract_version: args.contractVersion ?? 1,
    contract_hash: contractHashForActions(actions),
    generated_at: args.generatedAt ?? new Date().toISOString(),
    actions,
    procedures: (args.procedures ?? []).map((p) => ({ name: p.name, steps: [...p.steps] })),
  };
}
