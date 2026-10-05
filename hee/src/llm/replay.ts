// Requirement IDs: HEE-INFRA-01, HEE-INFRA-02, HEE-INFRA-03, HEE-INFRA-04
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Usage } from "./types.js";

export class ReplayMissError extends Error {
  constructor(path: string) {
    super(`replay miss: ${path}`);
    this.name = "ReplayMissError";
  }
}

export interface RecordedResponse { key: string; module: string; model: string; location: string;
  recorded_at: string; request_hash: string;
  response: { text: string; functionCalls: { name: string; args: Record<string, unknown> }[]; usage: Usage } }

const KEY_RE = /^[a-z0-9][a-z0-9._-]{2,80}$/;

export function recordPath(root: string, module: string, key: string): string {
  if (!KEY_RE.test(key)) throw new Error(`invalid record key: ${key}`);
  if (!/^[a-z0-9][a-z0-9._-]{1,60}$/.test(module)) throw new Error(`invalid record module: ${module}`);
  return join(root, module, `${key}.json`);
}

export function readRecord(root: string, module: string, key: string): RecordedResponse {
  const path = recordPath(root, module, key);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RecordedResponse;
  } catch {
    throw new ReplayMissError(path);
  }
}

export function writeRecord(root: string, module: string, key: string, rec: RecordedResponse): void {
  const path = recordPath(root, module, key);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec, null, 2) + "\n", "utf8");
}
