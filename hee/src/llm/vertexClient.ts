// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveModel } from "./models.js";
import { ReplayMissError, readRecord, writeRecord } from "./replay.js";
import { compileSchema } from "./validate.js";
import { toVertexSchema } from "./vertexSchema.js";
import type {
  GenerateFail,
  GenerateOk,
  GenerateRequest,
  GenerateResult,
  HttpTransport,
  TokenProvider,
  Usage,
} from "./types.js";

const LLM_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(LLM_DIR, "..", "..");

export interface ClientOptions { transport?: HttpTransport; token?: TokenProvider;
  mode?: "live" | "record" | "replay"; recordRoot?: string; sleep?: (ms: number) => Promise<void> }

let cachedToken = "";
let cachedAt = 0;

export function defaultTransport(): HttpTransport {
  return async (req) => {
    const res = await fetch(req.url, {
      method: req.body ? "POST" : "GET",
      headers: req.headers,
      body: req.body ? req.body : undefined,
    });
    return { status: res.status, text: await res.text() };
  };
}

function runGcloud(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const bin = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
    execFile(bin, args, { shell: process.platform === "win32" }, (error, stdout, stderr) => {
      if (error) {
        const code = typeof (error as { code?: unknown }).code === "number"
          ? ((error as { code: number }).code)
          : 1;
        resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? error.message ?? error) });
        return;
      }
      resolve({ code: 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

export async function gcloudToken(): Promise<string> {
  const fake = process.env["HEE_FAKE_TOKEN"];
  if (fake && fake.length > 0) return fake;
  if (cachedToken && Date.now() - cachedAt < 45 * 60 * 1000) return cachedToken;
  const r = await runGcloud(["auth", "application-default", "print-access-token"]);
  if (r.code !== 0) throw new Error("ADC: " + (r.stderr || r.stdout).trim());
  cachedToken = r.stdout.trim();
  cachedAt = Date.now();
  return cachedToken;
}

export function createClient(opts?: ClientOptions): {
  generate(req: GenerateRequest): Promise<GenerateResult>;
  generateJson<T>(req: GenerateRequest & { responseSchema: Record<string, unknown> }):
    Promise<{ ok: true; data: T; meta: GenerateOk } | GenerateFail>;
} {
  const transport = opts?.transport ?? defaultTransport();
  const token = opts?.token ?? gcloudToken;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  async function generate(req: GenerateRequest): Promise<GenerateResult> {
    const mode = opts?.mode ?? (process.env["HEE_LLM_MODE"] as "live" | "record" | "replay" | undefined) ?? "live";
    const root = opts?.recordRoot ?? process.env["HEE_LLM_RECORD_ROOT"] ?? "tests/hee/fixtures/llm";

    if (mode === "replay") {
      try {
        const rec = readRecord(root, req.module, req.key);
        return {
          ok: true, text: rec.response.text, functionCalls: rec.response.functionCalls,
          usage: rec.response.usage, model: rec.model, location: rec.location,
          latencyMs: 0, replayed: true,
        };
      } catch (e) {
        if (e instanceof ReplayMissError) {
          return { ok: false, reason: "replay_miss", detail: (e as Error).message.replace(/^replay miss: /, ""), retryable: false };
        }
        throw e;
      }
    }

    let resolved: { model: string; location: string };
    try {
      resolved = await resolveModel({ role: req.role, transport, token });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (/^ADC:/.test(msg) || /auth/i.test(msg)) {
        return { ok: false, reason: "auth", detail: msg, retryable: false };
      }
      return { ok: false, reason: "model_or_project_not_found", detail: msg, retryable: false };
    }
    const { model, location } = resolved;
    let heeProject = "";
    try {
      heeProject = (JSON.parse(readFileSync(process.env["HEE_LLM_CONFIG_PATH"] ?? join(REPO_ROOT, "config", "hee-llm.json"), "utf8")) as { project?: string }).project ?? "";
    } catch { /* ignore */ }
    const project = process.env["GOOGLE_CLOUD_PROJECT"] ?? heeProject ?? "2026-09-agentic-cinema1";

    const profile = readProfile(req.role);
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
        temperature: req.temperature ?? profile.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? profile.max_tokens ?? 8192,
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
    let sleepCalls = 0;
    void sleepCalls;
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
        const ok: GenerateOk = {
          ok: true, text, functionCalls, usage,
          model, location, latencyMs: Date.now() - started, replayed: false,
        };
        if (mode === "record") {
          writeRecord(root, req.module, req.key, {
            key: req.key, module: req.module, model, location,
            recorded_at: new Date().toISOString(),
            request_hash: createHash("sha256").update(body).digest("hex"),
            response: { text, functionCalls, usage },
          });
        }
        return ok;
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

  async function generateJson<T>(req: GenerateRequest & { responseSchema: Record<string, unknown> }):
    Promise<{ ok: true; data: T; meta: GenerateOk } | GenerateFail> {
    const mode = opts?.mode ?? (process.env["HEE_LLM_MODE"] as "live" | "record" | "replay" | undefined) ?? "live";
    const first = await generate(req);
    if (!first.ok) return first;
    const check = compileSchema(req.responseSchema);
    const attemptParse = (text: string): { data?: unknown; errors: string[] } => {
      const stripped = stripFence(text);
      try {
        return { data: JSON.parse(stripped) as unknown, errors: [] };
      } catch (e) {
        return { errors: [(e as Error).message ?? String(e)] };
      }
    };
    const p1 = attemptParse(first.text);
    if (p1.errors.length === 0) {
      const v = check(p1.data);
      if (v.ok) return { ok: true, data: p1.data as T, meta: first };
      const retry = await retryOnce(req, first, v.errors, mode);
      return retry as { ok: true; data: T; meta: GenerateOk } | GenerateFail;
    }
    const retry = await retryOnce(req, first, p1.errors, mode);
    return retry as { ok: true; data: T; meta: GenerateOk } | GenerateFail;

    async function retryOnce(
      baseReq: GenerateRequest & { responseSchema: Record<string, unknown> },
      prev: GenerateOk,
      errors: string[],
      runMode: string,
    ): Promise<{ ok: true; data: T; meta: GenerateOk } | GenerateFail> {
      const prompt = "Your previous reply did not pass validation. Errors: {{errors}}\nReturn ONLY the corrected JSON document that satisfies the schema. No prose, no code fence, no commentary. Keep every value that was already correct.".replace("{{errors}}", errors.join("; "));
      let second: GenerateResult;
      if (runMode === "replay") {
        second = await generate({
          ...baseReq,
          key: `${baseReq.key}.retry`,
          contents: baseReq.contents,
        });
      } else {
        second = await generate({
          ...baseReq,
          contents: [
            ...baseReq.contents,
            { role: "model", parts: [{ text: prev.text }] },
            { role: "user", parts: [{ text: prompt }] },
          ],
        });
      }
      if (!second.ok) return second;
      const p2 = attemptParse((second as GenerateOk).text);
      if (p2.errors.length > 0) {
        return { ok: false, reason: "validation_failed", detail: p2.errors.join("; "), retryable: false };
      }
      const v2 = check(p2.data);
      if (v2.ok) return { ok: true, data: p2.data as T, meta: second as GenerateOk };
      return { ok: false, reason: "validation_failed", detail: v2.errors.join("; "), retryable: false };
    }
  }

  return { generate, generateJson };
}

function readProfile(role: string): { temperature?: number; max_tokens?: number } {
  try {
    const doc = JSON.parse(readFileSync(join(REPO_ROOT, "config", "model-profiles.json"), "utf8")) as {
      roles?: Record<string, string>; profiles?: Record<string, { temperature?: number; max_tokens?: number }>;
    };
    const name = doc.roles?.[role];
    if (!name) return {};
    return doc.profiles?.[name] ?? {};
  } catch {
    return {};
  }
}

function stripFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1]?.trim() === "```") lines.pop();
    else if (lines.length > 0 && lines[lines.length - 1]?.trim().endsWith("```")) {
      lines[lines.length - 1] = (lines[lines.length - 1] as string).replace(/```\s*$/, "");
    }
    let joined = lines.join("\n").trim();
    if (joined.startsWith("json\n") || joined.startsWith("json\r")) joined = joined.slice(4).trim();
    else if (joined.startsWith("json ")) joined = joined.slice(4).trim();
    return joined;
  }
  return t;
}

function extractError(text: string): string {
  try {
    const p = JSON.parse(text) as { error?: { message?: string } };
    if (p.error?.message) return String(p.error.message).slice(0, 1000);
  } catch { /* fall through */ }
  return text.slice(0, 1000);
}
