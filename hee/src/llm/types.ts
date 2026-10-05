// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04
export type HeeRole =
  | "hee_recon_extractor" | "hee_harvest_summarizer" | "hee_tournament_generator"
  | "hee_tournament_critic" | "hee_judge_panel" | "hee_visual_review"
  | "hee_eval_agent" | "hee_eval_grader" | "hee_showcase_caption";

export interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };          // base64
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
export interface Content { role: "user" | "model"; parts: Part[] }
export interface ToolDecl { name: string; description: string; parameters: Record<string, unknown> }

export interface GenerateRequest {
  role: HeeRole;
  module: string;                 // e.g. "recon" — names the replay folder
  key: string;                    // stable record key, e.g. "capability-map.acme-site-1"
  system?: string;
  contents: Content[];
  tools?: ToolDecl[];
  responseSchema?: Record<string, unknown>;   // JSON Schema; sets JSON mode
  temperature?: number;
  maxOutputTokens?: number;
}
export interface Usage { promptTokens: number; outputTokens: number; totalTokens: number }
export interface GenerateOk {
  ok: true; text: string; json?: unknown;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  usage: Usage; model: string; location: string; latencyMs: number; replayed: boolean;
}
export interface GenerateFail { ok: false; reason: string; detail: string; retryable: boolean }
export type GenerateResult = GenerateOk | GenerateFail;

export type HttpTransport = (req: { url: string; headers: Record<string, string>; body: string })
  => Promise<{ status: number; text: string }>;
export type TokenProvider = () => Promise<string>;
