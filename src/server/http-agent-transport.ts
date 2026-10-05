// Requirement IDs: FR-18, FR-21
import type { AgentTransport } from "src/agent/transport.js";
import type { RoleName, RoleInput } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome, TransportKind } from "src/llm/roles.js";

export interface HttpAgentTransportOptions {
  baseUrl?: string;
  runId?: string;
  fetch?: typeof fetch;
}

export type HttpAgentTransport = AgentTransport & {
  readonly runId: string;
  refreshStatus(): Promise<{ kind: TransportKind; label: string; model: string }>;
  onRungChange(fn: (kind: TransportKind, label: string) => void): void;
};

function randomRunId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const buf = new Uint32Array(16);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(buf);
    for (const n of buf) out += chars[(n as number) % 36];
  } else {
    for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * 36)];
  }
  return out;
}

export function createHttpAgentTransport(opts?: HttpAgentTransportOptions): HttpAgentTransport {
  const baseUrl = opts?.baseUrl ?? "";
  const runId = opts?.runId ?? randomRunId();
  const fetchFn = opts?.fetch ?? globalThis.fetch.bind(globalThis);
  let kind: TransportKind = "bedrock";
  let label = "Amazon Bedrock";
  let model = "";
  const listeners = new Set<(kind: TransportKind, label: string) => void>();

  function absorb(reply: { kind?: unknown; label?: unknown; model?: unknown }): void {
    if (typeof reply.kind === "string") kind = reply.kind as TransportKind;
    if (typeof reply.label === "string") label = reply.label;
    if (typeof reply.model === "string") model = reply.model;
  }

  function fire(nextKind: TransportKind, nextLabel: string): void {
    for (const fn of listeners) fn(nextKind, nextLabel);
  }

  function netRole(message: string): { ok: false; degraded: RoleOutcome<RoleName> extends never ? never : unknown; kind: TransportKind } {
    return {
      ok: false,
      degraded: {
        degraded: true,
        reason: "The server is not reachable.",
        fallback_source: "none",
        original_error: message,
        data: null,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
      kind,
    } as never;
  }

  const transport: HttpAgentTransport = {
    runId,
    get kind(): TransportKind {
      return kind;
    },
    get label(): string {
      return label;
    },
    model: () => model,
    role: (async <R extends RoleName>(
      role: R,
      input: RoleInput[R],
      ctx: RoleCtx,
    ): Promise<RoleOutcome<R>> => {
      let res: Response;
      try {
        res = await fetchFn(baseUrl + "/api/agent/role/" + role, {
          method: "POST",
          headers: { "content-type": "application/json", "x-run-id": runId },
          body: JSON.stringify({ input, round: ctx.round, key: ctx.key }),
        });
      } catch (e) {
        return netRole(e instanceof Error ? e.message : String(e)) as RoleOutcome<R>;
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        return netRole("unexpected response") as RoleOutcome<R>;
      }
      const doc = json as {
        ok?: boolean;
        output?: unknown;
        model?: unknown;
        kind?: unknown;
        usage?: unknown;
        latencyMs?: unknown;
        label?: unknown;
        degraded?: unknown;
        rungChanged?: unknown;
      };
      if (doc.ok === true) {
        absorb(doc);
        if (doc.rungChanged === true) fire(kind, label);
        return {
          ok: true,
          output: doc.output,
          model: doc.model,
          kind,
          usage: doc.usage,
          latencyMs: doc.latencyMs,
        } as RoleOutcome<R>;
      }
      absorb(doc);
      if (doc.rungChanged === true) fire(kind, label);
      return { ok: false, degraded: doc.degraded, kind } as RoleOutcome<R>;
    }) as HttpAgentTransport["role"],
    step: (async (body: Parameters<AgentTransport["step"]>[0]) => {
      let res: Response;
      try {
        res = await fetchFn(baseUrl + "/api/agent/step", {
          method: "POST",
          headers: { "content-type": "application/json", "x-run-id": runId },
          body: JSON.stringify(body),
        });
      } catch (e) {
        return { ok: false, status: 503, message: "The server is not reachable." };
      }
      const text = await res.text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return { ok: false, status: 503, message: "The server is not reachable." };
      }
    }) as HttpAgentTransport["step"],
    refreshStatus: async (): Promise<{ kind: TransportKind; label: string; model: string }> => {
      const res = await fetchFn(baseUrl + "/api/status");
      const json = (await res.json()) as { agent?: { kind?: TransportKind; label?: string; model?: string } };
      if (json.agent?.kind !== undefined) kind = json.agent.kind;
      if (typeof json.agent?.label === "string") label = json.agent.label;
      if (typeof json.agent?.model === "string") model = json.agent.model;
      return { kind, label, model };
    },
    onRungChange(fn: (kind: TransportKind, label: string) => void): void {
      listeners.add(fn);
    },
  };
  return transport;
}
