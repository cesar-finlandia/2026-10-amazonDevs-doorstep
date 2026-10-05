// src/ui/shim/registry-manifest.ts — browser-safe twin of the kit's registry/manifest.js (DP-UI WU-UI-04).
// Only the hash backend differs (FNV-1a instead of sha256); stableStringify,
// contractHashForActions and buildManifest keep their shapes and semantics.
import type { ActionDescriptor, ActionManifest } from "src/kits/agent-workflow/src/registry/types.js";

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function contractHashForActions(actions: ActionManifest["actions"]): string {
  const s = stableStringify(actions);
  return fnv1a(s) + fnv1a(`#2${s}`) + fnv1a(`#3${s}`) + fnv1a(`#4${s}`);
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
