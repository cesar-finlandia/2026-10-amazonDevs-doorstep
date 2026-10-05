// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { contractHashForActions } from "../../src/registry/manifest.js";
import { createDomainStore } from "../../src/store/domainStore.js";
import { createApprovalGate } from "../../src/gate/approvalGate.js";
import { createTraceWriter } from "../../src/trace/traceWriter.js";
import { createRegistry } from "../../src/registry/registry.js";

const KIT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO_ROOT = join(KIT_ROOT, "..", "..");

describe("action manifest", () => {
  it("the example validates and its hash matches the canonical hash", () => {
    const example = JSON.parse(
      readFileSync(join(REPO_ROOT, "contracts", "hee-action-manifest.example.json"), "utf8"),
    ) as { actions: Parameters<typeof contractHashForActions>[0]; contract_hash: string };
    const schema = JSON.parse(
      readFileSync(join(REPO_ROOT, "contracts", "hee-action-manifest.schema.json"), "utf8"),
    );
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    expect(ajv.compile(schema)(example)).toBe(true);
    expect(contractHashForActions(example.actions)).toBe(example.contract_hash);
  });

  it("hash changes when a description changes and is stable otherwise", () => {
    const store = createDomainStore({ initial: {}, actions: [] });
    const registry = createRegistry({
      store,
      gate: createApprovalGate(),
      trace: createTraceWriter(),
      procedures: [{ name: "p", steps: ["list_items"] }],
    });
    registry.register({
      name: "list_items",
      title: "List items",
      group: "read",
      description: "Lists every item. Read before changing. Example: list_items({}).",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      annotations: { readOnly: true, destructive: false, untrustedContent: false },
      handler: () => ({ ok: true, summary: "ok" }),
    });
    const first = registry.exportManifest().contract_hash;
    expect(registry.exportManifest().contract_hash).toBe(first);
    registry.unregister("list_items");
    registry.register({
      name: "list_items",
      title: "List items",
      group: "read",
      description: "Lists every item twice. Read before changing. Example: list_items({}).",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      annotations: { readOnly: true, destructive: false, untrustedContent: false },
      handler: () => ({ ok: true, summary: "ok" }),
    });
    expect(registry.exportManifest().contract_hash).not.toBe(first);
  });
});
