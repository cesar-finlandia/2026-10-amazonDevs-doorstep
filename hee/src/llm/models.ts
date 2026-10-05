// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HeeRole, HttpTransport, TokenProvider } from "./types.js";

const LLM_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(LLM_DIR, "..", "..");

export interface ModelInfo { name: string; version: number; tier: "pro" | "flash"; preview: boolean }

export function parseModelName(name: string): ModelInfo | null {
  const lower = name.toLowerCase();
  for (const banned of ["lite", "image", "tts", "live", "audio", "embedding", "thinking-exp"]) {
    if (lower.includes(banned)) return null;
  }
  const m = /^gemini-(\d+(?:\.\d+)?)-(pro|flash)(-preview(?:-[\w.]+)?)?$/.exec(name);
  if (!m) return null;
  return { name, version: Number(m[1]), tier: m[2] as "pro" | "flash", preview: Boolean(m[3]) };
}

export function pickModel(names: string[], tier: "pro" | "flash"): string | null {
  const parsed: ModelInfo[] = [];
  for (const n of names) {
    const info = parseModelName(n);
    if (info && info.tier === tier) parsed.push(info);
  }
  parsed.sort((a, b) => {
    if (b.version !== a.version) return b.version - a.version;
    if (a.preview !== b.preview) return a.preview ? 1 : -1;
    return 0;
  });
  return parsed.length > 0 ? (parsed[0] as ModelInfo).name : null;
}

export async function listPublisherModels(opts: { project: string; location: string;
  transport: HttpTransport; token: TokenProvider }): Promise<string[]> {
  const base = process.env["HEE_VERTEX_BASE_URL"]?.replace(/\/$/, "") ??
    `https://${opts.location === "global" ? "aiplatform.googleapis.com" : `${opts.location}-aiplatform.googleapis.com`}`;
  const token = await opts.token();
  const out: string[] = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const url = `${base}/v1beta1/publishers/google/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await opts.transport({ url, headers: { Authorization: `Bearer ${token}` }, body: "" });
    if (res.status === 403 || res.status === 404) {
      const err = new Error(`listPublisherModels http_${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    if (res.status !== 200) throw new Error(`listPublisherModels http_${res.status}: ${res.text.slice(0, 500)}`);
    let parsed: { models?: { name?: string }[]; nextPageToken?: string };
    try {
      parsed = JSON.parse(res.text) as { models?: { name?: string }[]; nextPageToken?: string };
    } catch {
      throw new Error("listPublisherModels invalid JSON");
    }
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

function readJsonFile(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export async function resolveModel(opts: { role: HeeRole; transport?: HttpTransport; token?: TokenProvider;
  refresh?: boolean; configPath?: string }): Promise<{ model: string; location: string; discoveredAt: string }> {
  const profilesPath = join(REPO_ROOT, "config", "model-profiles.json");
  const profilesDoc = readJsonFile(profilesPath) as {
    roles?: Record<string, string>; profiles?: Record<string, { model?: string }>;
  };
  const profileName = profilesDoc.roles?.[opts.role];
  if (!profileName) throw new Error("unknown HEE role: " + opts.role);
  const profile = profilesDoc.profiles?.[profileName] as { model?: string; temperature?: number; max_tokens?: number } | undefined;
  if (!profile || typeof profile.model !== "string") throw new Error("unknown HEE role: " + opts.role);

  const heePath = opts.configPath ?? process.env["HEE_LLM_CONFIG_PATH"] ?? join(REPO_ROOT, "config", "hee-llm.json");
  let hee: { project?: string; location?: string; resolved?: Record<string, { model?: string; discovered_at?: string }>; fallback_candidates?: string[] };
  try {
    hee = readJsonFile(heePath) as typeof hee;
  } catch {
    hee = {};
  }
  const location = process.env["GOOGLE_CLOUD_LOCATION"] ?? hee.location ?? "us-central1";
  const project = process.env["GOOGLE_CLOUD_PROJECT"] ?? hee.project ?? "2026-09-agentic-cinema1";

  if (!profile.model.startsWith("auto:")) {
    return { model: profile.model, location, discoveredAt: "static" };
  }
  const tier = profile.model.slice(5);
  if (tier !== "pro" && tier !== "flash") throw new Error("unknown HEE role: " + opts.role);
  const existing = hee.resolved?.[tier];
  if (existing?.model && !opts.refresh) {
    return { model: existing.model, location, discoveredAt: existing.discovered_at ?? "static" };
  }

  let transport = opts.transport;
  let token = opts.token;
  if (!transport || !token) {
    const vc = await import("./vertexClient.js") as { defaultTransport(): HttpTransport; gcloudToken(): Promise<string> };
    transport ??= vc.defaultTransport();
    token ??= vc.gcloudToken;
  }

  let names: string[] | null = null;
  let listStatus: number | null = null;
  try {
    names = await listPublisherModels({ project, location, transport: transport as HttpTransport, token: token as TokenProvider });
  } catch (e) {
    const err = e as Error & { status?: number };
    listStatus = err.status ?? null;
    const msg = String((e as Error).message ?? e);
    const m = /http_(\d+)/.exec(msg);
    if (m) listStatus = Number(m[1]);
    if (listStatus !== 403 && listStatus !== 404) {
      // Non-refusal failure: surface it unless we can fall back.
      const fallbacks = (hee.fallback_candidates ?? []).filter((c) => tier === "pro" ? c.includes("pro") : c.includes("flash"));
      if (fallbacks.length === 0) throw e;
      names = null;
    } else {
      names = null;
    }
  }

  if (names) {
    const picked = pickModel(names, tier);
    if (!picked) throw new Error(`no ${tier} model visible to project`);
    writeResolved(heePath, hee, tier, picked);
    return { model: picked, location, discoveredAt: new Date().toISOString() };
  }

  // Step 5: probe fallback_candidates filtered to tier.
  const candidates = (hee.fallback_candidates ?? []).filter((c) => tier === "pro" ? c.includes("pro") : c.includes("flash"));
  const base = process.env["HEE_VERTEX_BASE_URL"]?.replace(/\/$/, "") ??
    `https://${location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`}`;
  const tok = await (token as TokenProvider)();
  for (const cand of candidates) {
    const url = `${base}/v1/projects/${project}/locations/${location}/publishers/google/models/${cand}:generateContent`;
    const body = JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 1 } });
    const res = await (transport as HttpTransport)({ url, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body });
    if (res.status === 200) {
      writeResolved(heePath, hee, tier, cand);
      return { model: cand, location, discoveredAt: new Date().toISOString() };
    }
  }
  throw new Error(`no ${tier} model visible to project`);
}

function writeResolved(heePath: string, hee: { project?: string; location?: string; resolved?: Record<string, { model?: string; discovered_at?: string }>; fallback_candidates?: string[] }, tier: string, model: string): void {
  const now = new Date().toISOString();
  const next = {
    version: "1.0.0",
    project: hee.project ?? process.env["GOOGLE_CLOUD_PROJECT"] ?? "2026-09-agentic-cinema1",
    location: hee.location ?? process.env["GOOGLE_CLOUD_LOCATION"] ?? "us-central1",
    resolved: { ...(hee.resolved ?? {}), [tier]: { model, discovered_at: now } },
    fallback_candidates: hee.fallback_candidates ?? ["gemini-2.5-pro", "gemini-2.5-flash"],
  };
  try {
    mkdirSync(dirname(heePath), { recursive: true });
  } catch { /* ignore */ }
  writeFileSync(heePath, JSON.stringify(next, null, 2) + "\n", "utf8");
  hee.resolved = next.resolved;
}
