// Requirement IDs: FR-02, FR-07, FR-09
// WU-DOMAIN-ENGINE-01: the agent-workflow kit is installed, the src/ alias
// resolves under vite-node, and the pinned dependencies resolve.
import { existsSync } from "node:fs";
import { z } from "zod";
import { createDomainStore } from "src/kits/agent-workflow/src/store/domainStore.js";
import { createTruthEngine } from "src/kits/agent-workflow/src/truth/truthEngine.js";
import { createRegistry } from "src/kits/agent-workflow/src/registry/registry.js";
import { createApprovalGate } from "src/kits/agent-workflow/src/gate/approvalGate.js";
import { createTraceWriter } from "src/kits/agent-workflow/src/trace/traceWriter.js";
import { withResilience } from "src/resilience/index.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

assert(typeof createDomainStore === "function", "createDomainStore is a function");
assert(typeof createTruthEngine === "function", "createTruthEngine is a function");
assert(typeof createRegistry === "function", "createRegistry is a function");
assert(typeof createApprovalGate === "function", "createApprovalGate is a function");
assert(typeof createTraceWriter === "function", "createTraceWriter is a function");
assert(typeof withResilience === "function", "withResilience is a function");
assert(existsSync("src/kits/agent-workflow/INSTALLED.json"), "INSTALLED.json exists");
assert(z.object({ a: z.number() }).parse({ a: 1 }).a === 1, "zod parses {a:1}");

console.log("de-01-kits: 8 checks OK");
