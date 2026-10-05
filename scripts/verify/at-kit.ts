// scripts/verify/at-kit.ts — shared by the eight scripts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildDepsOptions } from "src/server/deps.js";
import type { RunningServer } from "src/server/start.js";

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  if (typeof a === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ka = Object.keys(ao).sort();
    const kb = Object.keys(bo).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) => deepEqual(ao[k], bo[k]));
  }
  return false;
}

export function createChecker(name: string): {
  ok(cond: unknown, label: string): void;
  eq(actual: unknown, expected: unknown, label: string): void;
  done(): never;
} {
  let n = 0;
  let failed = 0;
  return {
    ok(cond: unknown, label: string): void {
      n += 1;
      if (!cond) {
        failed += 1;
        console.error(`FAIL ${label}`);
      }
    },
    eq(actual: unknown, expected: unknown, label: string): void {
      n += 1;
      if (!deepEqual(actual, expected)) {
        failed += 1;
        console.error(
          `FAIL ${label}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`,
        );
      }
    },
    done(): never {
      if (failed > 0) {
        console.error(`${name}: ${failed} of ${n} checks FAILED`);
        process.exit(1);
      }
      console.log(`${name}: ${n} checks OK`);
      process.exit(0);
    },
  };
}

export function startTestServer(
  opts?: BuildDepsOptions & { port?: number },
): Promise<RunningServer> {
  const tmp = mkdtempSync(join(tmpdir(), "at-"));
  const proofLog = join(tmp, "proof.log");
  const env = opts?.env ?? { NODE_ENV: "test", BUILD_MARKER: "test-1" };
  const costStub = {
    guard: async <T>(
      _meta: { provider: string; label: string; model: string },
      call: () => Promise<{ result: T; usage: { promptTokens: number; outputTokens: number; totalTokens: number } }>,
    ): Promise<{
      result: T;
      summary: {
        usedPct: number;
        totalTokens: number;
        requests: number;
        warning: "none";
        degraded: boolean;
        text: string;
      };
    }> => {
      const v = await call();
      return { result: v.result, summary: costStub.summary() };
    },
    summary: (): {
      usedPct: number;
      totalTokens: number;
      requests: number;
      warning: "none";
      degraded: boolean;
      text: string;
    } => ({ usedPct: 0, totalTokens: 0, requests: 0, warning: "none", degraded: false, text: "" }),
    reset: (): void => undefined,
    close: (): void => undefined,
  };
  const overrides = { cost: costStub, ...(opts?.overrides ?? {}) };
  const config = { proofLog, ...(opts?.config ?? {}) };
  return import("src/server/start.js").then((m) =>
    m.startServer({ ...(opts ?? {}), env, config, overrides, port: opts?.port ?? 0 }),
  );
}

export async function api(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: unknown; headers: Headers }> {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}
