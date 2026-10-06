// e2e/scenarios/s-bedrock.spec.ts — S-BEDROCK-1, one real structured role call
// through Bedrock (DP-E2E-BROWSER-TESTING §5.3). When probeBedrock() reports no
// route, the test skips with the probe's named error as the reason; it never
// reports "AI unavailable" without that error and never falls back silently.
// Requirement IDs: FR-18
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { test, expect } from "../fixtures";
import { probeBedrock } from "../bedrock-probe";
import type { BedrockProbe } from "../bedrock-probe";
import { randomSecret } from "../helpers";
import { WIRE_SAMPLES } from "src/ring/wire.js";
import { ExtractorOutputSchema } from "src/agent/schemas.js";

let probe: BedrockProbe | null = null;

test.beforeAll("probe the Bedrock route", async () => {
  probe = await probeBedrock();
});

test("S-BEDROCK-1 one real structured role call goes through Bedrock", async ({ app }) => {
  if (!probe) throw new Error("bedrock probe did not run");
  test.skip(!probe.available, probe.available ? "" : probe.error);
  if (!probe.available) throw new Error("unreachable: skipped above");
  // A separate server with the real (bedrock) provider environment — no golden.
  const { startServer } = await import("src/server/start.js");
  const dir = join(tmpdir(), `e2e-bedrock-${randomSecret(4)}`);
  mkdirSync(dir, { recursive: true });
  const proofLog = join(dir, "proof.log");
  const srv = await startServer({
    port: 0,
    config: { staticDir: "dist", proofLog },
    env: {
      ...process.env,
      NODE_ENV: "test",
      AGENT_PROVIDER: "bedrock",
      AGENT_ALLOW_FALLBACK: "",
      BUILD_MARKER: "e2e-bedrock",
    },
  });
  try {
    const res = await fetch(`${srv.url}/api/agent/role/extractor`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-run-id": "e2e-bedrock" },
      body: JSON.stringify({
        input: {
          kind: "webhook_inbox",
          deviceId: "dev-door",
          records: [{ rawId: "req-0001", record: JSON.stringify(WIRE_SAMPLES.webhookMotion) }],
        },
        round: 1,
      }),
    });
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { ok?: boolean; output?: unknown };
    expect(doc.ok).toBe(true);
    expect(ExtractorOutputSchema.safeParse(doc.output).success).toBe(true);
    const logged = readFileSync(proofLog, "utf8");
    expect(logged).toContain("proof edge=api-bedrock mode=bedrock");
  } finally {
    await srv.close();
  }
  // The app fixture guarantees dist/ is built for the separate server above.
  expect(app.url.length).toBeGreaterThan(0);
});
