// Requirement IDs: HEE-KIT-02
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { pickModel } from "./models.js";
import { toVertexSchema } from "./vertexSchema.js";
import { parseJsonLoose, retryPrompt } from "./jsonMode.js";
import type {
  GenerateFail,
  GenerateOk,
  GenerateRequest,
  GenerateResult,
  HttpTransport,
  TokenProvider,
  Usage,
} from "./types.js";

export interface VertexClientOptions {
  project?: string;
  location?: string;
  model?: string;
  token?: () => Promise<string>;
  transport?: HttpTransport;
  sleep?: (ms: number) => Promise<void>;
}

function defaultTransport(): HttpTransport {
  return async (req) => {
    const res = await fetch(req.url, {
      method: req.body ? "POST" : "GET",
      headers: req.headers,
      body: req.body ? req.body : undefined,
    });
    return { status: res.status, text: await res.text() };
  };
}

async function googleAuthToken(): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token: string | null | undefined = await auth.getAccessToken();
  if (!token) throw new Error("ADC: google-auth-library returned no access token");
  return token;
}

async function listPublisherModels(opts: { project: string; location: string; transport: HttpTransport; token: TokenProvider }): Promise<string[]> {
  const base = process.env["HEE_VERTEX_BASE_URL"]?.replace(/\/$/, "") ??
    `https://${opts.location === "global" ? "aiplatform.googleapis.com" : `${opts.location}-aiplatform.googleapis.com`}`;
  const token = await opts.token();
  const out: string[] = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const url = `${base}/v1beta1/publishers/google/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await opts.transport({ url, headers: { Authorization: `Bearer ${token}` }, body: "" });
    if (res.status !== 200) throw new Error(`listPublisherModels http_${res.status}: ${res.text.slice(0, 500)}`);
    const parsed = JSON.parse(res.text) as { models?: { name?: string }[]; nextPageToken?: string };
    for (const m of parsed.models ?? []) {
      const full = m.name ?? "";
      const id = full.includes("/") ? (full.split("/").pop() as string) : full;
      if (id) out.push(id);
    }
    pageToken = parsed.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return out;
}

function compileSchema(schema: object): (data: unknown) => { ok: true } | { ok: false; errors: string[] } {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return (data: unknown) => {
    if (validate(data)) return { ok: true };
    return {
      ok: false,
      errors: (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`),
    };
  };
}

function extractError(text: string): string {
  try {
    const p = JSON.parse(text) as { error?: { message?: string } };
    if (p.error?.message) return String(p.error.message).slice(0, 1000);
  } catch { /* fall through */ }
  return text.slice(0, 1000);
}

export function createVertexClient(opts?: VertexClientOptions): {
  generate(req: GenerateRequest): Promise<GenerateResult>;
  generateJson<T>(req: GenerateRequest & { responseSchema: object }):
    Promise<{ ok: true; data: T; meta: GenerateOk } | GenerateFail>;
} {
  const transport = opts?.transport ?? defaultTransport();
  const token = opts?.token ?? googleAuthToken;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const project = opts?.project ?? process.env["GOOGLE_CLOUD_PROJECT"] ?? "2026-09-agentic-cinema1";
  const location = opts?.location ?? process.env["GOOGLE_CLOUD_LOCATION"] ?? "us-central1";

  async function resolveModelName(): Promise<string> {
    if (opts?.model) return opts.model;
    const fromEnv = process.env["AGENT_MODEL"];
    if (fromEnv) return fromEnv;
    const names = await listPublisherModels({ project, location, transport, token });
    return pickModel(names, "pro") ?? pickModel(names, "flash") ?? (() => { throw new Error("no pro or flash model visible to project"); })();
  }

  async function generate(req: GenerateRequest): Promise<GenerateResult> {
    let model: string;
    try {
      model = await resolveModelName();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (/^ADC:/.test(msg) || /auth/i.test(msg)) {
        return { ok: false, reason: "auth", detail: msg, retryable: false };
      }
      return { ok: false, reason: "model_or_project_not_found", detail: msg, retryable: false };
    }
    // Request shape identical to src/llm/vertexClient.ts of the chassis.
    const bodyObj: Record<string, unknown> = {
      contents: req.contents.map((c) => ({
        role: c.role,
        parts: c.parts.map((p) => {
          if (p.functionResponse) {
            return { functionResponse: { name: p.functionResponse.name, response: p.functionResponse.response } };
          }
          if (p.functionCall) {
            return { functionCall: { name: p.functionCall.name, args: p.functionCall.args } };
          }
          if (p.inlineData) {
            return { inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } };
          }
          return { text: p.text ?? "" };
        }),
      })),
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 8192,
        ...(req.responseSchema
          ? { responseMimeType: "application/json", responseSchema: toVertexSchema(req.responseSchema) }
          : {}),
      },
    };
    if (req.system) bodyObj["systemInstruction"] = { parts: [{ text: req.system }] };
    if (req.tools) {
      bodyObj["tools"] = [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
    }
    const body = JSON.stringify(bodyObj);
    const base = process.env["HEE_VERTEX_BASE_URL"]?.replace(/\/$/, "") ??
      `https://${location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`}`;
    const url = `${base}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
    let tok: string;
    try {
      tok = await token();
    } catch (e) {
      return { ok: false, reason: "auth", detail: (e as Error).message ?? String(e), retryable: false };
    }
    const started = Date.now();
    const waits = [2000, 5000, 12000, 30000];
    let attempt = 0;
    for (;;) {
      let res: { status: number; text: string };
      try {
        res = await transport({ url, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body });
      } catch (e) {
        return { ok: false, reason: "http_0", detail: (e as Error).message ?? String(e), retryable: true };
      }
      if (res.status === 200) {
        let parsed: {
          candidates?: { content?: { parts?: { text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
        };
        try {
          parsed = JSON.parse(res.text) as typeof parsed;
        } catch (e) {
          return { ok: false, reason: "http_200_invalid_json", detail: (e as Error).message ?? String(e), retryable: false };
        }
        const parts = parsed.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p) => p.text ?? "").join("");
        const functionCalls = parts
          .filter((p) => p.functionCall)
          .map((p) => ({ name: (p.functionCall as { name: string }).name ?? "", args: ((p.functionCall as { args?: Record<string, unknown> }).args ?? {}) as Record<string, unknown> }));
        const usage: Usage = {
          promptTokens: parsed.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: parsed.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: parsed.usageMetadata?.totalTokenCount ?? 0,
        };
        return { ok: true, text, functionCalls, usage, model, location, latencyMs: Date.now() - started };
      }
      if ((res.status === 429 || res.status === 503) && attempt < 4) {
        await sleep(waits[attempt] as number);
        attempt++;
        continue;
      }
      if (res.status === 429) {
        return { ok: false, reason: "quota", detail: extractError(res.text), retryable: true };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "auth", detail: extractError(res.text), retryable: false };
      }
      if (res.status === 404) {
        return { ok: false, reason: "model_or_project_not_found", detail: extractError(res.text), retryable: false };
      }
      return { ok: false, reason: `http_${res.status}`, detail: extractError(res.text), retryable: false };
    }
  }

  async function generateJson<T>(req: GenerateRequest & { responseSchema: object }):
    Promise<{ ok: true; data: T; meta: GenerateOk } | GenerateFail> {
    const first = await generate(req);
    if (!first.ok) return first;
    const check = compileSchema(req.responseSchema);
    const p1 = parseJsonLoose(first.text);
    if (p1.errors.length === 0) {
      const v = check(p1.data);
      if (v.ok) return { ok: true, data: p1.data as T, meta: first };
      return retryOnce(req, first, v.errors);
    }
    return retryOnce(req, first, p1.errors);

    async function retryOnce(
      baseReq: GenerateRequest & { responseSchema: object },
      prev: GenerateOk,
      errors: string[],
    ): Promise<{ ok: true; data: T; meta: GenerateOk } | GenerateFail> {
      const second = await generate({
        ...baseReq,
        contents: [
          ...baseReq.contents,
          { role: "model", parts: [{ text: prev.text }] },
          { role: "user", parts: [{ text: retryPrompt(errors) }] },
        ],
      });
      if (!second.ok) return second;
      const p2 = parseJsonLoose(second.text);
      if (p2.errors.length > 0) {
        return { ok: false, reason: "validation_failed", detail: p2.errors.join("; "), retryable: false };
      }
      const v2 = check(p2.data);
      if (v2.ok) return { ok: true, data: p2.data as T, meta: second };
      return { ok: false, reason: "validation_failed", detail: v2.errors.join("; "), retryable: false };
    }
  }

  return { generate, generateJson };
}
