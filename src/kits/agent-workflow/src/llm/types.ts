// Requirement IDs: HEE-KIT-02
// Mirrors src/llm/types.ts of the chassis (Part, Content, ToolDecl,
// GenerateResult); GenerateRequest drops the chassis-only module/key fields.
export interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };          // base64
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
export interface Content { role: "user" | "model"; parts: Part[] }
export interface ToolDecl { name: string; description: string; parameters: Record<string, unknown> }

export interface GenerateRequest {
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
  usage: Usage; model: string; location: string; latencyMs: number;
}
export interface GenerateFail { ok: false; reason: string; detail: string; retryable: boolean }
export type GenerateResult = GenerateOk | GenerateFail;

export type HttpTransport = (req: { url: string; headers: Record<string, string>; body: string })
  => Promise<{ status: number; text: string }>;
export type TokenProvider = () => Promise<string>;
