// Requirement IDs: HEE-KIT-02
import type { Content, ToolDecl, Usage } from "../llm/types.js";
import type { GenerateResult } from "../llm/types.js";

export interface StepBody {
  system?: string;
  contents: Content[];
  tools: ToolDecl[];
}

export interface StepResult {
  text: string;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  usage: Usage;
  model: string;
  latencyMs: number;
}

export async function handleAgentStep(
  body: unknown,
  client: Pick<ReturnType<typeof import("../llm/client.js").createVertexClient>, "generate">,
): Promise<{ ok: true; result: StepResult } | { ok: false; status: number; message: string }> {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, message: "body must be an object with contents and tools" };
  }
  const b = body as { system?: unknown; contents?: unknown; tools?: unknown };
  if (!Array.isArray(b.contents) || b.contents.length === 0) {
    return { ok: false, status: 400, message: "contents must be a non-empty array" };
  }
  if (!Array.isArray(b.tools)) {
    return { ok: false, status: 400, message: "tools must be an array" };
  }
  const res: GenerateResult = await client.generate({
    ...(typeof b.system === "string" ? { system: b.system } : {}),
    contents: b.contents as Content[],
    tools: b.tools as ToolDecl[],
  });
  if (!res.ok) {
    return { ok: false, status: 502, message: `model call failed (${res.reason}): ${res.detail}` };
  }
  return {
    ok: true,
    result: {
      text: res.text,
      functionCalls: res.functionCalls,
      usage: res.usage,
      model: res.model,
      latencyMs: res.latencyMs,
    },
  };
}
