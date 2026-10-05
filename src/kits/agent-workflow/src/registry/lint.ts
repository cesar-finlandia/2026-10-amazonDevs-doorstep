// Requirement IDs: HEE-KIT-02
import type { ActionDescriptor } from "./types.js";

export const HUMAN_NAME_PROPS = ["target", "entity", "room", "item"];

export function lintDescriptor(d: ActionDescriptor<unknown>): string[] {
  const problems: string[] = [];
  if (!/^[a-z]+(_[a-z0-9]+)+$/.test(d.name)) {
    problems.push(`name "${d.name}" must match ^[a-z]+(_[a-z0-9]+)+$`);
  }
  if (typeof d.title !== "string" || d.title.length === 0) {
    problems.push("title must be non-empty");
  }
  const terminators = (d.description.match(/[.!?]/g) ?? []).length;
  if (terminators < 2 || !d.description.includes("Example:")) {
    problems.push("description needs at least two sentences and an Example: call");
  }
  const schema = d.inputSchema as { type?: unknown; additionalProperties?: unknown; properties?: unknown };
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    problems.push("inputSchema must be a JSON Schema object with additionalProperties:false");
  }
  const properties = (schema.properties ?? {}) as Record<string, { description?: unknown }>;
  for (const [p, prop] of Object.entries(properties)) {
    if (typeof prop !== "object" || prop === null || typeof prop.description !== "string" || prop.description.length === 0) {
      problems.push(`property ${p} needs a non-empty description`);
    }
  }
  for (const p of HUMAN_NAME_PROPS) {
    const prop = properties[p] as { description?: unknown; enum?: unknown } | undefined;
    if (prop && typeof prop === "object") {
      const desc = typeof prop.description === "string" ? prop.description.toLowerCase() : "";
      if (!desc.includes("name") && prop.enum === undefined) {
        problems.push(`property ${p}: accept human names or give an enum`);
      }
    }
  }
  const a = d.annotations as { readOnly?: unknown; destructive?: unknown; untrustedContent?: unknown } | undefined;
  if (
    !a || typeof a.readOnly !== "boolean" ||
    typeof a.destructive !== "boolean" || typeof a.untrustedContent !== "boolean"
  ) {
    problems.push("annotations needs the three booleans readOnly, destructive, untrustedContent");
  } else {
    if (d.group === "read" && a.readOnly !== true) {
      problems.push('group "read" requires readOnly:true');
    }
    if (a.destructive === true && a.readOnly !== false) {
      problems.push("destructive:true requires readOnly:false");
    }
  }
  return problems;
}
