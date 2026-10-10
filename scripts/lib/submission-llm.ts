// scripts/lib/submission-llm.ts — DP-SUBMISSION WU-07 (§5.7).
// The one model call of this plan: Gemini on Vertex AI through the kit's
// Vertex client (used as the labelled fallback client, per R-12), with a
// transport that attaches the quota project. Raw user-credential tokens carry
// no quota of their own, so the kit's default transport gets http_403
// ("quota project required") on local runs; service accounts in production
// bill automatically. The model is discovered via the kit's pickModel, never
// hardcoded; lastUsedModel() reports the model id of the latest call.
import { withResilience } from "src/resilience/index.js";
import { isDegradedResult } from "src/resilience/degraded.js";
import { createVertexClient } from "src/kits/agent-workflow/src/llm/client.js";
import { pickModel, parseModelName } from "src/kits/agent-workflow/src/llm/models.js";
import type { HttpTransport, TokenProvider } from "src/kits/agent-workflow/src/llm/types.js";
import type { GenerateResult } from "src/kits/agent-workflow/src/llm/types.js";
import { vertexCaller } from "src/llm/vertex-fallback.js";

let lastModel = "";

export function vertexModelId(): string {
  return lastModel !== "" ? lastModel : vertexCaller().modelId;
}

async function googleAuthToken(): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token: string | null | undefined = await auth.getAccessToken();
  if (!token) throw new Error("ADC: google-auth-library returned no access token");
  return token;
}

function quotaTransport(project: string): HttpTransport {
  return async (req) => {
    const res = await fetch(req.url, {
      method: req.body ? "POST" : "GET",
      headers: { ...req.headers, "x-goog-user-project": project },
      body: req.body ? req.body : undefined,
    });
    return { status: res.status, text: await res.text() };
  };
}

async function discoverVertexModels(project: string, location: string, transport: HttpTransport, token: TokenProvider): Promise<string[]> {
  const base = `https://${location}-aiplatform.googleapis.com`;
  const names: string[] = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const url = `${base}/v1beta1/publishers/google/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const tk = await token();
    const res = await transport({ url, headers: { Authorization: `Bearer ${tk}` }, body: "" });
    if (res.status !== 200) throw new Error(`listPublisherModels http_${res.status}: ${res.text.slice(0, 200)}`);
    const parsed = JSON.parse(res.text) as { models?: { name?: string }[]; publisherModels?: { name?: string }[]; nextPageToken?: string };
    for (const m of [...(parsed.models ?? []), ...(parsed.publisherModels ?? [])]) {
      const full = m.name ?? "";
      const id = full.includes("/") ? (full.split("/").pop() as string) : full;
      if (id) names.push(id);
    }
    pageToken = parsed.nextPageToken ?? "";
    if (!pageToken) break;
  }
  // Ranked discovery, no hardcoded version: flash GA first (cheap, regionally
  // served), then pro GA, then previews. A listed name is not always servable
  // in-region, so the caller tries down the ranking.
  const ga = names.filter((n) => {
    const info = parseModelName(n);
    return info !== null && !info.preview;
  });
  const ranked: string[] = [];
  for (const tier of ["flash", "pro"] as const) {
    const pick = pickModel(ga, tier);
    if (pick !== null && !ranked.includes(pick)) ranked.push(pick);
    for (const n of names) {
      const info = parseModelName(n);
      if (info !== null && info.tier === tier && !ranked.includes(n)) ranked.push(n);
    }
  }
  const fallback = pickModel(names, "flash") ?? pickModel(names, "pro");
  if (fallback !== null && !ranked.includes(fallback)) ranked.push(fallback);
  if (ranked.length === 0) throw new Error("no pro or flash model visible to project");
  return ranked;
}

export async function callVertexJson(prompt: string): Promise<string> {
  process.env["GOOGLE_GENAI_USE_VERTEXAI"] = "true";
  const project = process.env["GOOGLE_CLOUD_PROJECT"] ?? "";
  if (project === "") throw new Error("no Google Cloud project (set GOOGLE_CLOUD_PROJECT)");
  const location = process.env["GOOGLE_CLOUD_LOCATION"] ?? "us-central1";
  const token: TokenProvider = googleAuthToken;
  const transport = quotaTransport(project);
  // Discover, don't hardcode: the kit's own list call parses the `models`
  // key, but the API answers `publisherModels`, so the kit sees zero names.
  // List here with both keys and pass the pick explicitly (kit untouched).
  const ranked = await discoverVertexModels(project, location, transport, token);
  let lastError = "no candidate tried";
  for (const model of ranked) {
    const client = createVertexClient({ project, location, model, token, transport });
  const run = withResilience(() => client.generate({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    temperature: 0.2,
    maxOutputTokens: 8192,
  }), {
    // DEVIATION from the §5.7 sketch (60 s): a 15-to-20-question sheet is
    // thousands of output tokens and needs minutes on flash; one attempt,
    // no retry (a slow success must not be billed twice).
    timeout_ms: 300000,
    retries: 0,
    backoff: { policy: "exponential", base_ms: 500 },
    fallback_chain: { order: ["none"] },
  });
    const res = await run();
    if (isDegradedResult(res)) {
      const d = res as unknown as { reason: string; original_error?: string | null };
      lastError = `${d.reason}: ${d.original_error ?? "no detail"}`;
      continue;
    }
    const ok = res as GenerateResult;
    if (ok.ok === false) {
      // Unservable model id: try the next ranked candidate.
      if (ok.reason === "model_or_project_not_found") {
        lastError = `${ok.reason}: ${ok.detail}`;
        continue;
      }
      throw new Error(`${ok.reason}: ${ok.detail}`);
    }
    lastModel = ok.model !== "" ? ok.model : model;
    return ok.text;
  }
  throw new Error(lastError);
}
