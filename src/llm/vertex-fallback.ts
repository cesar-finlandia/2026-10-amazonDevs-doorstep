// Requirement IDs: FR-21
import type { GenerateRequest, GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
export const FALLBACK_LABEL = "Fallback model (not Bedrock)";
export interface VertexFallback { readonly label: string; readonly modelId: string; generate(req: GenerateRequest): Promise<GenerateResult> }
/** Wraps the kit's createVertexClient; picks the model with the kit's pickModel at first use; label is FALLBACK_LABEL. */
interface VertexKitClient {
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
export function createVertexFallback(opts?: { generate?: (req: GenerateRequest) => Promise<GenerateResult> }): VertexFallback {
  if (opts?.generate) {
    const stub = opts.generate;
    return { label: FALLBACK_LABEL, modelId: "", generate: stub };
  }
  let model = "";
  const state: { client: VertexKitClient | null } = { client: null };
  async function ensure(): Promise<VertexKitClient> {
    if (!state.client) {
      const mod = await import("src/kits/agent-workflow/src/llm/client.js");
      state.client = mod.createVertexClient();
    }
    return state.client;
  }
  return {
    label: FALLBACK_LABEL,
    get modelId(): string {
      return model;
    },
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const client = await ensure();
      const res = await client.generate(req);
      if (res.ok && res.model !== "") model = res.model;
      return res;
    },
  };
}
