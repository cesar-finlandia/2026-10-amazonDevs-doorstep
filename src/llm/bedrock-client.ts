// Requirement IDs: FR-18
import type { GenerateRequest, GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
export interface BedrockClientOptions {
  modelId: string; region?: string;                  // region default process.env.AWS_REGION
  maxTokens?: number;                                // default 2048
  send?: (command: unknown) => Promise<unknown>;     // test seam; default BedrockRuntimeClient#send
  now?: () => number;
}
export interface BedrockClient { readonly modelId: string; readonly region: string; generate(req: GenerateRequest): Promise<GenerateResult> }

interface ConversePart { text?: string; toolUse?: { toolUseId: string; name: string; input: unknown }; toolResult?: { toolUseId: string; content: { json: unknown }[]; status: "success" } }
interface ConverseMessage { role: "user" | "assistant"; content: ConversePart[] }

/** Pure mapping, exported for tests (see §5.2). */
export function toConverseInput(req: GenerateRequest, modelId: string, maxTokens: number): Record<string, unknown> {
  const system = req.system !== undefined ? [{ text: req.system }] : undefined;
  // 1: map each kit Content to one Converse message, assigning deterministic tool-use ids.
  const mapped: ConverseMessage[] = req.contents.map((c, m) => {
    const parts: ConversePart[] = [];
    let k = 0;
    for (const p of c.parts) {
      if (p.text !== undefined) {
        parts.push({ text: p.text });
      } else if (p.functionCall) {
        parts.push({ toolUse: { toolUseId: `tu-${m}-${k}`, name: p.functionCall.name, input: p.functionCall.args } });
        k += 1;
      } else if (p.functionResponse) {
        parts.push({ toolResult: { toolUseId: "", content: [{ json: p.functionResponse.response }], status: "success" } });
      } else if (p.inlineData) {
        parts.push({ text: `[inline ${p.inlineData.mimeType} omitted]` });
      }
    }
    return { role: c.role === "model" ? "assistant" : "user", content: parts };
  });
  // 2: pair each functionResponse with the oldest unclaimed id from the previous
  // assistant message with the same name (first unclaimed when no name matches).
  const kitNames: (string | null)[][] = req.contents.map((c) =>
    c.parts.map((p) => (p.functionResponse ? p.functionResponse.name : p.functionCall ? p.functionCall.name : null)),
  );
  for (let m = 1; m < mapped.length; m++) {
    const cur = mapped[m] as ConverseMessage;
    const prev = mapped[m - 1] as ConverseMessage;
    if (cur.role !== "user" || prev.role !== "assistant") continue;
    const ids = prev.content.filter((p) => p.toolUse).map((p) => ({ id: (p.toolUse as { toolUseId: string }).toolUseId, name: (p.toolUse as { name: string }).name, used: false }));
    const names = kitNames[m] as (string | null)[];
    cur.content.forEach((part, pi) => {
      if (!part.toolResult) return;
      const want = names[pi] as string | null;
      let slot = ids.find((s) => !s.used && s.name === want);
      if (!slot) slot = ids.find((s) => !s.used);
      if (slot) {
        slot.used = true;
        part.toolResult.toolUseId = slot.id;
      }
    });
  }
  // 3: merge consecutive messages of the same role.
  const merged: ConverseMessage[] = [];
  for (const msg of mapped) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content.push(...msg.content);
    } else {
      merged.push({ role: msg.role, content: [...msg.content] });
    }
  }
  // 4: the first message must be user.
  if (merged.length > 0 && (merged[0] as ConverseMessage).role === "assistant") {
    merged.unshift({ role: "user", content: [{ text: "Continue." }] });
  }
  const input: Record<string, unknown> = {
    modelId,
    messages: merged,
    inferenceConfig: { maxTokens, temperature: req.temperature ?? 0 },
  };
  if (system !== undefined) input["system"] = system;
  const tools = (req.tools ?? []).map((t) => ({
    toolSpec: { name: t.name, description: t.description, inputSchema: { json: t.parameters } },
  }));
  if (req.responseSchema !== undefined) {
    tools.push({
      toolSpec: { name: "emit_result", description: "Return the structured result.", inputSchema: { json: req.responseSchema } },
    });
    input["toolConfig"] = { tools, toolChoice: { tool: { name: "emit_result" } } };
  } else if (tools.length > 0) {
    input["toolConfig"] = { tools };
  }
  return input;
}

export function fromConverseOutput(out: unknown, model: string, region: string, latencyMs: number): GenerateResult {
  const o = out as {
    output?: { message?: { content?: { text?: string; toolUse?: { toolUseId?: string; name?: string; input?: unknown } }[] } };
    stopReason?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  };
  const content = o.output?.message?.content ?? [];
  const texts: string[] = [];
  const functionCalls: { name: string; args: Record<string, unknown> }[] = [];
  let json: unknown = undefined;
  let hasJson = false;
  for (const block of content) {
    if (typeof block.text === "string" && block.text !== "") texts.push(block.text);
    if (block.toolUse && typeof block.toolUse.name === "string") {
      if (block.toolUse.name === "emit_result") {
        json = block.toolUse.input;
        hasJson = true;
      } else {
        functionCalls.push({
          name: block.toolUse.name,
          args: (block.toolUse.input ?? {}) as Record<string, unknown>,
        });
      }
    }
  }
  const text = hasJson ? JSON.stringify(json) : texts.join("");
  const usage = {
    promptTokens: o.usage?.inputTokens ?? 0,
    outputTokens: o.usage?.outputTokens ?? 0,
    totalTokens: o.usage?.totalTokens ?? 0,
  };
  const usable = text !== "" || functionCalls.length > 0 || hasJson;
  if (o.stopReason === "max_tokens" && !usable) {
    return { ok: false, reason: "max_tokens", detail: "The reply was cut off.", retryable: false };
  }
  if (hasJson) {
    return { ok: true, text, json, functionCalls, usage, model, location: region, latencyMs };
  }
  return { ok: true, text, functionCalls, usage, model, location: region, latencyMs };
}

const RETRYABLE = new Set([
  "ThrottlingException",
  "ModelTimeoutException",
  "ServiceUnavailableException",
  "InternalServerException",
]);

export function createBedrockClient(opts: BedrockClientOptions): BedrockClient {
  const region = opts.region ?? process.env["AWS_REGION"] ?? "us-east-1";
  const maxTokens = opts.maxTokens ?? 2048;
  const now = opts.now ?? Date.now;
  async function defaultSend(command: unknown): Promise<unknown> {
    const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const runtime = new BedrockRuntimeClient({ region });
    return runtime.send(command as InstanceType<typeof ConverseCommand>);
  }
  const send = opts.send ?? defaultSend;
  return {
    modelId: opts.modelId,
    region,
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const input = toConverseInput(req, opts.modelId, maxTokens);
      const started = now();
      let raw: unknown;
      try {
        const { ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
        raw = await send(new ConverseCommand(input as Record<string, never>));
      } catch (e) {
        const err = e as { name?: string; message?: string };
        const name = typeof err?.name === "string" && err.name !== "" ? err.name : "Error";
        const message = typeof err?.message === "string" ? err.message : String(e);
        return { ok: false, reason: name, detail: message, retryable: RETRYABLE.has(name) };
      }
      return fromConverseOutput(raw, opts.modelId, region, now() - started);
    },
  };
}
