// Requirement IDs: HEE-INFRA-01
// Vertex generateContent accepts an OpenAPI-style subset of JSON Schema. This module converts a
// contract schema into that subset for the wire only; validation of replies always uses the
// original schema (compileSchema), so a stricter contract is never weakened.
//   - "type": ["string","null"]  ->  anyOf: [{type:"string"},{type:"null"}]   (list form is http_400)
//   - allOf / contains / minContains / maxContains / $schema / $id are dropped (http_400 "Unknown name")

const DROPPED_KEYS = new Set(["allOf", "contains", "minContains", "maxContains", "$schema", "$id"]);
const META_KEYS = new Set(["description", "title", "default", "deprecated", "readOnly", "writeOnly"]);

export function toVertexSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toVertexSchema);
  if (!node || typeof node !== "object") return node;
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (DROPPED_KEYS.has(key)) continue;
    converted[key] = toVertexSchema(value);
  }
  if (!Array.isArray(converted["type"])) return converted;
  const branches = (converted["type"] as unknown[]).filter((t) => t !== "null");
  const passthrough: Record<string, unknown> = {};
  const branchKeys: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(converted)) {
    if (key === "type") continue;
    if (META_KEYS.has(key)) passthrough[key] = value;
    else branchKeys[key] = value;
  }
  return {
    ...passthrough,
    anyOf: [...branches.map((t) => ({ type: t, ...branchKeys })), { type: "null" }],
  };
}
