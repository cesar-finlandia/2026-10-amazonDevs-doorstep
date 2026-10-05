// Requirement IDs: FR-24
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ServerConfig {
  port: number;
  bodyLimitKb: number;
  webhookAckBudgetMs: number;
  sessionTtlMin: number;
  sessionMax: number;
  eventsKeep: number;
  staticDir: string;
  proofLog: string;
  stepTimeoutMs: number;
  runMax: number;
  ringDegradeAfter: number;
}

const DEFAULTS: ServerConfig = {
  port: 8080,
  bodyLimitKb: 256,
  webhookAckBudgetMs: 4000,
  sessionTtlMin: 120,
  sessionMax: 200,
  eventsKeep: 500,
  staticDir: "dist",
  proofLog: "logs/proof.log",
  stepTimeoutMs: 90000,
  runMax: 50,
  ringDegradeAfter: 2,
};

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

/** Reads config/server.json (or opts.path); the PORT environment variable, when it is an integer 0..65535, overrides `port`.
 *  A missing file or a bad value falls back to the literal defaults of §3.1. Never throws. */
export function loadServerConfig(opts?: { path?: string; env?: Record<string, string | undefined> }): ServerConfig {
  const env = opts?.env ?? process.env;
  const cfgPath = opts?.path ?? join(process.cwd(), "config", "server.json");
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const out: ServerConfig = { ...DEFAULTS };
  if (isInt(raw["port"]) && (raw["port"] as number) >= 0 && (raw["port"] as number) <= 65535) {
    out.port = raw["port"] as number;
  }
  if (isInt(raw["bodyLimitKb"])) out.bodyLimitKb = raw["bodyLimitKb"] as number;
  if (isInt(raw["webhookAckBudgetMs"])) out.webhookAckBudgetMs = raw["webhookAckBudgetMs"] as number;
  if (isInt(raw["sessionTtlMin"])) out.sessionTtlMin = raw["sessionTtlMin"] as number;
  if (isInt(raw["sessionMax"])) out.sessionMax = raw["sessionMax"] as number;
  if (isInt(raw["eventsKeep"])) out.eventsKeep = raw["eventsKeep"] as number;
  if (typeof raw["staticDir"] === "string") out.staticDir = raw["staticDir"] as string;
  if (typeof raw["proofLog"] === "string") out.proofLog = raw["proofLog"] as string;
  if (isInt(raw["stepTimeoutMs"])) out.stepTimeoutMs = raw["stepTimeoutMs"] as number;
  if (isInt(raw["runMax"])) out.runMax = raw["runMax"] as number;
  if (isInt(raw["ringDegradeAfter"])) out.ringDegradeAfter = raw["ringDegradeAfter"] as number;
  const portRaw = env["PORT"];
  if (typeof portRaw === "string" && /^\d+$/.test(portRaw.trim())) {
    const n = Number(portRaw.trim());
    if (Number.isInteger(n) && n >= 0 && n <= 65535) out.port = n;
  }
  return out;
}
