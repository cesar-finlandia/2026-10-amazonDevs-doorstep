// Requirement IDs: FR-18, FR-21
import { makeDegradedResult } from "src/resilience";
import type { AgentTransport } from "src/agent/transport.js";
import type { TransportKind } from "src/llm/roles.js";
import type { RoleName, RoleInput } from "src/agent/schemas.js";
import type { RoleCtx, RoleOutcome } from "src/llm/roles.js";

export type BuiltBedrockTransport = AgentTransport & {
  onRungChange(fn: (kind: TransportKind, label: string) => void): void;
};

/** Before the first call: kind "bedrock", label "Amazon Bedrock", model() "". The first role/step call awaits `build()` once (concurrent calls share the promise),
 *  then delegates; kind, label and model() mirror the built transport from then on and onRungChange listeners registered earlier are attached to it.
 *  A rejected build makes role() return { ok:false, degraded:{ degraded:true, reason:"The model could not be set up: <message>", fallback_source:"none", original_error:<message>, data:null }, kind:"bedrock" }
 *  and step() return { ok:false, status:502, message:"The model could not be set up." }; the next call tries build() again. */
export function createLazyBedrockTransport(opts: {
  build: () => Promise<BuiltBedrockTransport>;
}): BuiltBedrockTransport & { ready(): boolean } {
  let built: BuiltBedrockTransport | null = null;
  let inflight: Promise<BuiltBedrockTransport> | null = null;
  const early = new Set<(kind: TransportKind, label: string) => void>();

  async function ensure(): Promise<BuiltBedrockTransport> {
    if (built) return built;
    if (!inflight) {
      inflight = opts.build().then(
        (t) => {
          built = t;
          for (const fn of early) t.onRungChange(fn);
          early.clear();
          inflight = null;
          return t;
        },
        (e: unknown) => {
          inflight = null;
          throw e;
        },
      );
    }
    return inflight;
  }

  const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

  return {
    get kind(): TransportKind {
      return built ? built.kind : "bedrock";
    },
    get label(): string {
      return built ? built.label : "Amazon Bedrock";
    },
    model: () => (built ? built.model() : ""),
    role: (async <R extends RoleName>(
      role: R,
      input: RoleInput[R],
      ctx: RoleCtx,
    ): Promise<RoleOutcome<R>> => {
      try {
        const t = await ensure();
        return t.role(role, input, ctx);
      } catch (e) {
        const m = messageOf(e);
        return {
          ok: false,
          degraded: makeDegradedResult({
            reason: `The model could not be set up: ${m}`,
            fallback_source: "none",
            original_error: m,
          }),
          kind: "bedrock",
        };
      }
    }) as BuiltBedrockTransport["role"],
    step: (async (body: Parameters<BuiltBedrockTransport["step"]>[0]) => {
      try {
        const t = await ensure();
        return t.step(body);
      } catch {
        return { ok: false, status: 502, message: "The model could not be set up." };
      }
    }) as BuiltBedrockTransport["step"],
    onRungChange(fn: (kind: TransportKind, label: string) => void): void {
      if (built) built.onRungChange(fn);
      else early.add(fn);
    },
    ready: () => built !== null,
  };
}
