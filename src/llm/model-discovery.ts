// Requirement IDs: FR-18
// Runtime model discovery for Amazon Bedrock. NEVER returns a hardcoded id.
export interface ModelCandidate {
  id: string;                    // invocable id or inference-profile id
  provider: string;              // "Anthropic" | "Amazon" | ...
  name: string;                  // human model name, e.g. "Claude Sonnet 4.5"
  inputModalities: string[]; outputModalities: string[];
  active: boolean;
}
export interface DiscoveredModels { fast: string; balanced: string; source: "discovery" | "env"; region: string }
export interface DiscoveryDeps {
  listCandidates?: () => Promise<ModelCandidate[]>;   // default: Bedrock control plane (see §5.1)
  env?: Record<string, string | undefined>;           // default process.env
}

/** Highest version first within a tier; tier "fast" prefers names containing "Haiku" then "Lite"; "balanced" prefers "Sonnet" then "Pro". */
export function rankCandidates(c: ModelCandidate[], tier: "fast" | "balanced"): string | null {
  const allowedProviders = new Set(["anthropic", "amazon"]);
  const excluded = /(opus|mythos|fable)/i;
  let best: { id: string; score: number } | null = null;
  for (const m of c) {
    if (!m.active) continue;
    if (excluded.test(m.name)) continue;
    if (!allowedProviders.has(m.provider.trim().toLowerCase())) continue;
    const lower = m.name.toLowerCase();
    if (!m.inputModalities.map((x) => x.toLowerCase()).includes("text")) continue;
    if (!m.outputModalities.map((x) => x.toLowerCase()).includes("text")) continue;
    let tierRank: number;
    if (tier === "fast") {
      tierRank = lower.includes("haiku") ? 3 : lower.includes("lite") ? 2 : 1;
    } else {
      tierRank = lower.includes("sonnet") ? 3 : lower.includes("pro") ? 2 : 1;
    }
    const ver = m.name.match(/\d+(\.\d+)?/);
    const version = ver ? Number(ver[0]) : 0;
    const score = tierRank * 1000 + version;
    if (
      best === null ||
      score > best.score ||
      (score === best.score && m.id < best.id)
    ) {
      best = { id: m.id, score };
    }
  }
  return best?.id ?? null;
}

function errorText(region: string): string {
  return `No invocable text model is visible in ${region}. Run scripts/probe-bedrock.ts.`;
}

function normalizeName(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inferProvider(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("claude")) return "Anthropic";
  if (lower.includes("nova") || lower.includes("titan")) return "Amazon";
  if (lower.includes("llama")) return "Meta";
  return "Unknown";
}

/** Default control-plane listing: inference profiles first, then foundation models. */
async function defaultListCandidates(region: string): Promise<ModelCandidate[]> {
  const { BedrockClient, ListFoundationModelsCommand, ListInferenceProfilesCommand } = await import(
    "@aws-sdk/client-bedrock"
  );
  const client = new BedrockClient({ region });
  const out: ModelCandidate[] = [];
  const seen = new Map<string, ModelCandidate>();
  let nextToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await client.send(
      new ListInferenceProfilesCommand({ typeEquals: "SYSTEM_DEFINED", ...(nextToken ? { nextToken } : {}) }),
    );
    const summaries = (res as { inferenceProfileSummaries?: unknown }).inferenceProfileSummaries;
    if (Array.isArray(summaries)) {
      for (const s of summaries as Record<string, unknown>[]) {
        const id = typeof s["inferenceProfileId"] === "string" ? (s["inferenceProfileId"] as string) : null;
        if (!id) continue;
        const name = typeof s["inferenceProfileName"] === "string" ? (s["inferenceProfileName"] as string) : id;
        const status = typeof s["status"] === "string" ? (s["status"] as string) : "";
        seen.set(normalizeName(name), {
          id,
          provider: inferProvider(name),
          name,
          inputModalities: ["TEXT"],
          outputModalities: ["TEXT"],
          active: status === "ACTIVE",
        });
      }
    }
    nextToken = typeof (res as Record<string, unknown>)["nextToken"] === "string"
      ? ((res as Record<string, unknown>)["nextToken"] as string)
      : undefined;
    if (!nextToken) break;
  }
  const models = await client.send(new ListFoundationModelsCommand({ byOutputModality: "TEXT" }));
  const summaries = (models as { modelSummaries?: unknown }).modelSummaries;
  if (Array.isArray(summaries)) {
    for (const s of summaries as Record<string, unknown>[]) {
      const id = typeof s["modelId"] === "string" ? (s["modelId"] as string) : null;
      if (!id) continue;
      const name = typeof s["modelName"] === "string" ? (s["modelName"] as string) : id;
      const provider = typeof s["providerName"] === "string" ? (s["providerName"] as string) : inferProvider(name);
      const lifecycle = s["modelLifecycle"] as Record<string, unknown> | undefined;
      const status = typeof lifecycle?.["status"] === "string" ? (lifecycle["status"] as string) : "";
      const inferenceTypes = Array.isArray(s["inferenceTypesSupported"]) ? (s["inferenceTypesSupported"] as unknown[]) : [];
      const key = normalizeName(name);
      if (seen.has(key)) continue; // prefer the profile entry when both exist for the same model
      const input = Array.isArray(s["inputModalities"]) ? (s["inputModalities"] as unknown[]).map(String) : ["TEXT"];
      const output = Array.isArray(s["outputModalities"]) ? (s["outputModalities"] as unknown[]).map(String) : ["TEXT"];
      seen.set(key, {
        id,
        provider,
        name,
        inputModalities: input,
        outputModalities: output,
        active: status === "ACTIVE" && inferenceTypes.includes("ON_DEMAND"),
      });
    }
  }
  for (const v of seen.values()) out.push(v);
  return out;
}

let memo: { at: number; key: string; value: DiscoveredModels } | null = null;
const MEMO_MS = 10 * 60 * 1000;

/** BEDROCK_MODEL_ID (when set) wins for both tiers with source "env". Otherwise lists candidates, ranks, returns
 *  source "discovery". Throws Error("No invocable text model is visible in <region>. Run scripts/probe-bedrock.ts.") when none. */
export async function discoverModels(deps?: DiscoveryDeps): Promise<DiscoveredModels> {
  const env = deps?.env ?? process.env;
  const fromEnv = env["BEDROCK_MODEL_ID"];
  const region = env["AWS_REGION"] ?? "us-east-1";
  if (fromEnv !== undefined && fromEnv !== "") {
    return { fast: fromEnv, balanced: fromEnv, source: "env", region };
  }
  if (!deps?.listCandidates) {
    const key = `default|${region}`;
    if (memo && memo.key === key && Date.now() - memo.at < MEMO_MS) return memo.value;
    const candidates = await defaultListCandidates(region);
    const fast = rankCandidates(candidates, "fast");
    const balanced = rankCandidates(candidates, "balanced");
    if (!fast || !balanced) throw new Error(errorText(region));
    const value: DiscoveredModels = { fast, balanced, source: "discovery", region };
    memo = { at: Date.now(), key, value };
    return value;
  }
  const candidates = await deps.listCandidates();
  const fast = rankCandidates(candidates, "fast");
  const balanced = rankCandidates(candidates, "balanced");
  if (!fast || !balanced) throw new Error(errorText(region));
  return { fast, balanced, source: "discovery", region };
}
