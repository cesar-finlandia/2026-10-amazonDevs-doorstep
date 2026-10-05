// Requirement IDs: HEE-KIT-02
import type { ActionDescriptor, ActionGroup } from "./types.js";

export interface CapabilityData {
  groups: Record<string, string[]>;
  count: number;
  procedures: { name: string; steps: string[] }[];
  contract_hash: string;
  revision: number;
}

export function toToolDecl(d: ActionDescriptor<unknown>): { name: string; description: string; parameters: Record<string, unknown> } {
  return { name: d.name, description: `${d.title}. ${d.description}`, parameters: d.inputSchema };
}

export function groupNames<M>(descriptors: ActionDescriptor<M>[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const d of descriptors) {
    const list = groups[d.group] ?? [];
    list.push(d.name);
    groups[d.group] = list;
  }
  return groups;
}

export const ACTION_GROUPS: ActionGroup[] = ["read", "change", "verify", "navigate", "collaborate", "cross_boundary"];
