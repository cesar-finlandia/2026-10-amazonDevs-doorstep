// Requirement IDs: HEE-KIT-02
import type { Registry } from "../registry/types.js";
import { toToolDecl } from "../registry/capabilities.js";
import type { TraceWriter } from "../trace/types.js";
import type { Content, Part } from "../llm/types.js";
import type { StepBody, StepResult } from "../server/stepHandler.js";
import { fillAgentSystemPrompt } from "../prompts/index.js";

export type StepFn = (body: StepBody) => Promise<{ ok: true; result: StepResult } | { ok: false; status: number; message: string }>;

export async function runAgentLoop<M>(args: {
  registry: Registry<M>;
  step: StepFn;
  goal: string;
  productName: string;
  procedureText: string;
  maxSteps?: number /* default 40 */;
  trace: TraceWriter;
  round?: () => number;
  signal?: AbortSignal;
  modelRole?: string /* trace name, default "actor" */;
}): Promise<{ stopped: "done" | "max_steps" | "aborted" | "model_error"; steps: number; finalText: string }> {
  const maxSteps = args.maxSteps ?? 40;
  const modelRole = args.modelRole ?? "actor";
  const system = fillAgentSystemPrompt({
    product_name: args.productName,
    procedure_text: args.procedureText,
    max_steps: maxSteps,
  });
  const contents: Content[] = [{ role: "user", parts: [{ text: args.goal }] }];
  let finalText = "";

  for (let i = 0; i < maxSteps; i++) {
    if (args.signal?.aborted) return { stopped: "aborted", steps: i, finalText };
    const round = args.round ? args.round() : i + 1;
    const tools = args.registry.list().map((d) => toToolDecl(d as Parameters<typeof toToolDecl>[0]));
    const started = performance.now();
    const res = await args.step({ system, contents, tools });
    if (!res.ok) {
      args.trace.record({
        round, kind: "system", name: "model_error", source: "agent",
        input_ref: null, output_ref: null, ok: false,
        latency_ms: performance.now() - started,
        decision: `status ${res.status}`,
      });
      return { stopped: "model_error", steps: i + 1, finalText };
    }
    const { result } = res;
    const names = result.functionCalls.map((c) => c.name);
    args.trace.record({
      round, kind: "model", name: modelRole, source: "agent",
      input_ref: null, output_ref: result.text || null, ok: true,
      tokens: { prompt: result.usage.promptTokens, output: result.usage.outputTokens, total: result.usage.totalTokens },
      latency_ms: result.latencyMs,
      decision: names.length > 0 ? names.join(",") : "final",
    });
    const modelParts: Part[] = [];
    if (result.text) modelParts.push({ text: result.text });
    for (const c of result.functionCalls) modelParts.push({ functionCall: { name: c.name, args: c.args } });
    contents.push({ role: "model", parts: modelParts });
    if (result.functionCalls.length === 0) {
      finalText = result.text;
      return { stopped: "done", steps: i + 1, finalText };
    }
    const responseParts: Part[] = [];
    for (const c of result.functionCalls) {
      const out = await args.registry.call(c.name, c.args, { source: "agent", round });
      responseParts.push({ functionResponse: { name: c.name, response: out as unknown as Record<string, unknown> } });
      if (out.ok === false && out.summary) finalText = out.summary;
    }
    contents.push({ role: "user", parts: responseParts });
    finalText = result.text;
  }
  return { stopped: "max_steps", steps: maxSteps, finalText };
}
