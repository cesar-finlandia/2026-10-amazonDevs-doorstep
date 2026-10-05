// Requirement IDs: HEE-KIT-02
import { describe, expect, it } from "vitest";
import { handleAgentStep } from "../../src/server/stepHandler.js";

function okClient(text = "hello") {
  return {
    generate: async () => ({
      ok: true as const,
      text,
      functionCalls: [],
      usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 },
      model: "test-model",
      location: "us-central1",
      latencyMs: 5,
    }),
  };
}

describe("handleAgentStep", () => {
  it("returns 400 for malformed bodies", async () => {
    expect((await handleAgentStep(null, okClient())).ok).toBe(false);
    expect(await handleAgentStep({ contents: [], tools: [] }, okClient())).toMatchObject({ ok: false, status: 400 });
    expect(await handleAgentStep({ contents: [{ role: "user", parts: [] }] }, okClient())).toMatchObject({ ok: false, status: 400 });
  });

  it("returns 502 with the reason when the model call fails", async () => {
    const failing = {
      generate: async () => ({ ok: false as const, reason: "quota", detail: "slow down", retryable: true }),
    };
    const res = await handleAgentStep({ contents: [{ role: "user", parts: [{ text: "hi" }] }], tools: [] }, failing);
    expect(res).toMatchObject({ ok: false, status: 502 });
    if (!res.ok) expect(res.message).toMatch(/quota/);
  });

  it("returns the step result on success", async () => {
    const res = await handleAgentStep(
      { system: "be nice", contents: [{ role: "user", parts: [{ text: "hi" }] }], tools: [] },
      okClient("ready"),
    );
    expect(res).toMatchObject({ ok: true });
    if (res.ok) {
      expect(res.result.text).toBe("ready");
      expect(res.result.model).toBe("test-model");
    }
  });
});
