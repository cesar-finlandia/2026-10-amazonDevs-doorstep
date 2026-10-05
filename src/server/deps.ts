// src/server/deps.ts — Requirement IDs: FR-24
import { loadServerConfig } from "src/server/config.js";
import type { ServerConfig } from "src/server/config.js";
import { createLogger } from "src/server/logger.js";
import type { Logger } from "src/server/logger.js";
import { createProofLog } from "src/server/proof.js";
import type { ProofLog } from "src/server/proof.js";
import type { EventHub } from "src/server/events.js";
import { createEventHub } from "src/server/events.js";
import { createInbox } from "src/ring/inbox.js";
import type { Inbox, SeenStore } from "src/ring/inbox.js";
import { createSeenStore } from "src/ring/inbox.js";
import type { SessionRegistry } from "src/server/sessions.js";
import { createSessionRegistry } from "src/server/sessions.js";
import type { AgentService } from "src/server/agent-service.js";
import { createAgentService } from "src/server/agent-service.js";
import { createLazyBedrockTransport } from "src/server/bedrock-lazy.js";
import { createGoldenCache } from "src/resilience";
import { createCostClient } from "src/llm/cost.js";
import type { CostClient } from "src/llm/cost.js";
import { createInProcessTransport, createGoldenTransport, createManualTransport } from "src/agent/transport.js";
import { createRoleRunners } from "src/llm/roles.js";
import { createBedrockClient } from "src/llm/bedrock-client.js";
import { discoverModels } from "src/llm/model-discovery.js";
import { createStrandsAdapter } from "src/llm/strands-adapter.js";
import { createVertexFallback } from "src/llm/vertex-fallback.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ServerDeps {
  config: ServerConfig;
  env: Record<string, string | undefined>;
  log: Logger;
  proof: ProofLog;
  hub: EventHub;
  inbox: Inbox;
  seen: SeenStore;
  sessions: SessionRegistry;
  agent: AgentService;
  cost: CostClient;
  now: () => number;
  startedAtMs: number;
  buildMarker: string;
}

export interface BuildDepsOptions {
  env?: Record<string, string | undefined>;
  config?: Partial<ServerConfig>;
  overrides?: Partial<ServerDeps>;
  ringBaseUrl?: string;
  oauthUrl?: string;
  fetch?: typeof fetch;
  goldenDir?: string;
}

/** Sync emptiness check for the golden cache (the async list() cannot gate the sync rung choice).
 *  NOTE: §5.10 phrases this as `golden.list().length === 0`, but list() is async; the intent — null when the
 *  committed cache holds no doorstep entries — is implemented with a sync read of golden-index.json. */
function goldenDirIsEmpty(dir: string): boolean {
  try {
    const idx = JSON.parse(readFileSync(join(dir, "golden-index.json"), "utf8")) as {
      entries?: Record<string, { explicit_key?: string }>;
    };
    const entries = idx.entries ?? {};
    return !Object.values(entries).some(
      (e) => typeof e.explicit_key === "string" && e.explicit_key.startsWith("doorstep-"),
    );
  } catch {
    return true;
  }
}

function unbuilt(name: string): never {  return new Proxy(
    {},
    {
      get(): never {
        throw new Error(`${name} is added in a later unit`);
      },
    },
  ) as never;
}

/** The composition root. Reads nothing at import time. Overrides replace any member (tests pass stub agents and a mock Ring URL). */
export function buildServerDeps(opts?: BuildDepsOptions): ServerDeps {
  const env = opts?.env ?? process.env;
  const config = { ...loadServerConfig({ env }), ...opts?.config };
  const now = opts?.overrides?.now ?? Date.now;
  const buildMarker = env["BUILD_MARKER"] ?? "dev";
  const secrets = (): (string | undefined)[] => [
    env["RING_ACCESS_TOKEN"],
    env["RING_REFRESH_TOKEN"],
    env["RING_CLIENT_SECRET"],
    env["RING_HMAC_KEY"],
    env["RING_WEBHOOK_SECRET"],
    env["AWS_BEARER_TOKEN_BEDROCK"],
  ];
  const log = opts?.overrides?.log ?? createLogger({ secrets });
  const proof = opts?.overrides?.proof ?? createProofLog({ path: config.proofLog, secrets });
  const hub = opts?.overrides?.hub ?? createEventHub({ keep: config.eventsKeep });
  const inbox = opts?.overrides?.inbox ?? createInbox();
  const seen = opts?.overrides?.seen ?? createSeenStore();
  const sessions =    opts?.overrides?.sessions ??
    createSessionRegistry({
      env,
      inbox,
      ttlMs: config.sessionTtlMin * 60000,
      max: config.sessionMax,
      degradeAfter: config.ringDegradeAfter,
      fetch: opts?.fetch,
      ringBaseUrl: opts?.ringBaseUrl,
      oauthUrl: opts?.oauthUrl,
      now,
      onRingDegraded: (id, reason) => {
        try {
          void hub.publish(
            "system-degraded",
            "done",
            { layer: "ring", kind: "bundle", label: "Recorded week (not live Ring)", reason },
            { degraded: true },
          );
          void hub.publish("ring-mode", "done", { mode: "bundle", sessionId: id });
        } catch {
          /* ignore */
        }
      },
    });
  const goldenDir = opts?.goldenDir ?? env["GOLDEN_CACHE_DIR"] ?? join(process.cwd(), "data", "golden-cache");
  const golden = createGoldenCache(goldenDir);
  const allowFallback = env["AGENT_ALLOW_FALLBACK"] === "1";
  const cost = opts?.overrides?.cost ?? createCostClient();
  const agent =
    opts?.overrides?.agent ??
    createAgentService({
      env,
      hub,
      cost,
      runMax: config.runMax,
      stepTimeoutMs: config.stepTimeoutMs,
      now,
      makeManual: () => createManualTransport(),
      makeGolden: () => {
        if (goldenDirIsEmpty(goldenDir)) return null;
        return createGoldenTransport({ cache: golden });
      },
      makeBedrock: () => {
        if (!env["AWS_BEARER_TOKEN_BEDROCK"] && !env["AWS_ACCESS_KEY_ID"]) return null;
        return createLazyBedrockTransport({
          build: async () => {
            const models = await discoverModels({ env });
            const bedrock = createBedrockClient({ modelId: models.balanced, region: models.region });
            const vertex = allowFallback ? createVertexFallback() : undefined;
            const roles = createRoleRunners({
              models,
              region: models.region,
              strands: createStrandsAdapter(),
              bedrock,
              vertex,
              allowFallback,
              cost,
              cache: golden,
              recordGolden: env["RECORD_GOLDEN"] === "1",
            });
            return createInProcessTransport({
              roles,
              bedrock,
              vertex,
              allowFallback,
              cost,
              cache: golden,
              recordGolden: env["RECORD_GOLDEN"] === "1",
            });
          },
        });
      },
    });
  const startedAtMs = opts?.overrides?.startedAtMs ?? now();
  const buildMarkerFinal = opts?.overrides?.buildMarker ?? buildMarker;
  return {
    config,
    env,
    log,
    proof,
    hub,
    inbox,
    seen,
    sessions,
    agent,
    cost,
    now,
    startedAtMs,
    buildMarker: buildMarkerFinal,
  };
}
