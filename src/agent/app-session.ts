// src/agent/app-session.ts — Requirement IDs: FR-02, FR-05, FR-08, FR-09
import { createSession } from "src/domain/session.js";
import type { Session, SessionOptions } from "src/domain/session.js";
import { registerDoorstepActions } from "src/agent/actions.js";
import { ACTOR_PROCEDURES } from "src/prompts/actor.js";

export interface AppSessionOptions extends Omit<SessionOptions, "registrar" | "procedures"> {}
/** createSession({ ...opts, procedures: ACTOR_PROCEDURES, registrar: core => registerDoorstepActions(core) }).
 *  The composition root used by `/`, `/watch`, scripts and the evals. */
export function createAppSession(opts: AppSessionOptions): Session {
  return createSession({ ...opts, procedures: ACTOR_PROCEDURES, registrar: (core) => registerDoorstepActions(core) });
}
/** Manual-runner helper: JSON-Schema property list of an action (name, type, enum, description, required) for DP-UI's form. */
export function actionFields(session: Session, name: string): { name: string; type: string; enum?: string[]; description: string; required: boolean }[] {
  const found = session.registry.list().find((d) => d.name === name);
  if (!found) throw new Error(`Unknown action ${name}.`);
  const inputSchema = found.inputSchema as { properties?: Record<string, { type?: string | string[]; enum?: string[]; description?: string }>; required?: string[] };
  const properties = inputSchema.properties ?? {};
  const required = new Set(inputSchema.required ?? []);
  return Object.entries(properties).map(([prop, propSchema]) => ({
    name: prop,
    type: Array.isArray(propSchema.type) ? propSchema.type.join("|") : (propSchema.type ?? "string"),
    ...(propSchema.enum !== undefined ? { enum: propSchema.enum } : {}),
    description: propSchema.description ?? "",
    required: required.has(prop),
  }));
}
