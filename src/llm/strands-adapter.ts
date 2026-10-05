// Requirement IDs: FR-18
import type { ZodType } from "zod";
export interface StructuredRun {
  system: string; user: string; schema: ZodType; modelId: string; region?: string; maxTokens?: number; signal?: AbortSignal;
}
export interface StructuredOk { ok: true; output: unknown; usage: { promptTokens: number; outputTokens: number; totalTokens: number } }
export interface StructuredFail { ok: false; reason: string; detail: string }
export interface StrandsAdapter { run(r: StructuredRun): Promise<StructuredOk | StructuredFail> }
/** Lazy: `import("@strands-agents/sdk")` happens on first run(), so importing this module never needs credentials.
 *  new Agent({ model: new BedrockModel({ modelId, region, maxTokens }), systemPrompt: system, structuredOutputSchema: schema, printer: false }),
 *  then result = await agent.invoke(user); output = result.structuredOutput. StructuredOutputError → { ok:false, reason:"structured_output_error" }. */
export function createStrandsAdapter(): StrandsAdapter {
  return {
    async run(r: StructuredRun): Promise<StructuredOk | StructuredFail> {
      if (r.signal?.aborted) {
        return { ok: false, reason: "aborted", detail: "The call was cancelled before it ran." };
      }
      let sdk: typeof import("@strands-agents/sdk");
      try {
        sdk = await import("@strands-agents/sdk");
      } catch (e) {
        return { ok: false, reason: "sdk_import_failed", detail: (e as Error).message ?? String(e) };
      }
      const region = r.region ?? process.env["AWS_REGION"] ?? "us-east-1";
      try {
        const model = new sdk.BedrockModel({ modelId: r.modelId, region, maxTokens: r.maxTokens ?? 2048 });
        const agent = new sdk.Agent({
          model,
          systemPrompt: r.system,
          structuredOutputSchema: r.schema,
          printer: false,
        });
        const result = await agent.invoke(r.user);
        const usageRaw = (result as { metrics?: { accumulatedUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } } }).metrics?.accumulatedUsage;
        const usage = {
          promptTokens: usageRaw?.inputTokens ?? 0,
          outputTokens: usageRaw?.outputTokens ?? 0,
          totalTokens: usageRaw?.totalTokens ?? 0,
        };
        return { ok: true, output: result.structuredOutput, usage };
      } catch (e) {
        const name = (e as { name?: string })?.name ?? "";
        const message = (e as Error).message ?? String(e);
        if (name === "StructuredOutputError" || /structured.?output/i.test(message)) {
          return { ok: false, reason: "structured_output_error", detail: message };
        }
        return { ok: false, reason: name !== "" ? name : "strands_failed", detail: message };
      }
    },
  };
}
