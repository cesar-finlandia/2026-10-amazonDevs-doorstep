// Requirement IDs: FR-18, NFR-14
import { spawn, type ChildProcess } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { readFileSync } from "node:fs";
export interface Usage3 { promptTokens: number; outputTokens: number; totalTokens: number }
export interface CostSummary { usedPct: number; totalTokens: number; requests: number; warning: "none" | "warning" | "critical"; degraded: boolean; text: string }
export interface CostClient {
  /** Runs `call`, records its usage under (provider, label, model), returns the result plus the post-call summary. Never throws because of metering. */
  guard<T>(meta: { provider: string; label: string; model: string }, call: () => Promise<{ result: T; usage: Usage3 }>): Promise<{ result: T; summary: CostSummary }>;
  summary(): CostSummary;
  reset(): void;
  close(): void;
}
export interface CostClientOptions { sidecarPath?: string /* default scripts/cost_sidecar.py */; configPath?: string /* default config/cost.json */; spawnSidecar?: boolean /* default true */ }

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function createCostClient(opts?: CostClientOptions): CostClient {
  const sidecarPath = opts?.sidecarPath ?? join(process.cwd(), "scripts", "cost_sidecar.py");
  const configPath = opts?.configPath ?? join(process.cwd(), "config", "cost.json");
  const resolvedSidecar = isAbsolute(sidecarPath) ? sidecarPath : join(process.cwd(), sidecarPath);
  const resolvedConfig = isAbsolute(configPath) ? configPath : join(process.cwd(), configPath);
  let budget = 600000;
  let threshold = 0.8;
  try {
    const cfg = JSON.parse(readFileSync(resolvedConfig, "utf8")) as { global?: { budget?: number; threshold?: number } };
    if (typeof cfg.global?.budget === "number" && cfg.global.budget > 0) budget = cfg.global.budget;
    if (typeof cfg.global?.threshold === "number") threshold = cfg.global.threshold;
  } catch {
    /* keep defaults */
  }
  let degraded = opts?.spawnSidecar === false;
  let closed = false;
  let child: ChildProcess | null = null;
  let stdoutBuf = "";
  type Pending = { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
  const pending: Pending[] = [];
  let localTokens = 0;
  let localRequests = 0;
  let last: CostSummary | null = null;

  function warningFor(usedPct: number): "none" | "warning" | "critical" {
    if (usedPct >= 95) return "critical";
    if (usedPct >= threshold * 100) return "warning";
    return "none";
  }

  function localSummary(): CostSummary {
    const usedPct = budget > 0 ? round1((localTokens / budget) * 100) : 0;
    return {
      usedPct,
      totalTokens: localTokens,
      requests: localRequests,
      warning: warningFor(usedPct),
      degraded: true,
      text: `Approximate usage: ${localTokens} tokens (${usedPct}% of budget)`,
    };
  }

  function markDegraded(reason: string): void {
    void reason;
    if (degraded) return;
    degraded = true;
    for (const p of pending.splice(0)) {
      clearTimeout(p.timer);
      p.reject(new Error("cost sidecar unavailable"));
    }
    try {
      child?.kill();
    } catch {
      /* ignore */
    }
    child = null;
  }

  function onChildData(data: Buffer): void {
    stdoutBuf += data.toString("utf8");
    for (;;) {
      const nl = stdoutBuf.indexOf("\n");
      if (nl < 0) break;
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      const p = pending.shift();
      if (!p) continue;
      clearTimeout(p.timer);
      if (line === "") {
        p.reject(new Error("cost sidecar sent an empty line"));
        markDegraded("empty line");
        continue;
      }
      try {
        p.resolve(JSON.parse(line) as Record<string, unknown>);
      } catch (e) {
        p.reject(e as Error);
        markDegraded("unparseable line");
      }
    }
  }

  function ensureSpawn(): ChildProcess | null {
    if (degraded || closed || opts?.spawnSidecar === false) return null;
    if (child) return child;
    try {
      const proc = spawn("python3", [resolvedSidecar, resolvedConfig], { stdio: ["pipe", "pipe", "ignore"] });
      proc.on("error", () => markDegraded("spawn error"));
      proc.on("exit", () => markDegraded("child exit"));
      proc.stdout?.on("data", onChildData);
      child = proc;
      return proc;
    } catch {
      markDegraded("spawn threw");
      return null;
    }
  }

  function request(obj: Record<string, unknown>): Promise<Record<string, unknown>> {
    const proc = ensureSpawn();
    if (!proc || !proc.stdin) {
      markDegraded("no child");
      return Promise.reject(new Error("cost sidecar unavailable"));
    }
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        const at = pending.findIndex((p) => p.resolve === resolve);
        if (at >= 0) pending.splice(at, 1);
        markDegraded("timeout");
        reject(new Error("cost sidecar timed out"));
      }, 2000);
      pending.push({ resolve, reject, timer });
      try {
        proc.stdin.write(JSON.stringify(obj) + "\n", (err) => {
          if (err) {
            clearTimeout(timer);
            const at = pending.findIndex((p) => p.resolve === resolve);
            if (at >= 0) pending.splice(at, 1);
            markDegraded("write failed");
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      } catch (e) {
        clearTimeout(timer);
        markDegraded("write threw");
        reject(e as Error);
      }
    });
  }

  function recordLocal(usage: Usage3): void {
    localTokens += usage.promptTokens + usage.outputTokens;
    localRequests += 1;
  }

  async function guard<T>(
    meta: { provider: string; label: string; model: string },
    call: () => Promise<{ result: T; usage: Usage3 }>,
  ): Promise<{ result: T; summary: CostSummary }> {
    const value = await call(); // a throwing call rejects with its own error and records nothing
    if (degraded || opts?.spawnSidecar === false) {
      recordLocal(value.usage);
      return { result: value.result, summary: localSummary() };
    }
    try {
      const res = await request({
        op: "record",
        provider: meta.provider,
        label: meta.label,
        model: meta.model,
        input_tokens: value.usage.promptTokens,
        output_tokens: value.usage.outputTokens,
      });
      if (res["ok"] !== true) {
        markDegraded("record not ok");
        recordLocal(value.usage);
        return { result: value.result, summary: localSummary() };
      }
      const totalTokens = typeof res["totalTokens"] === "number" ? res["totalTokens"] : 0;
      const requests = typeof res["requests"] === "number" ? res["requests"] : 0;
      const usedPct = budget > 0 ? round1((totalTokens / budget) * 100) : 0;
      const warning = res["warning"] === "critical" || res["warning"] === "warning" ? res["warning"] : "none";
      const s: CostSummary = {
        usedPct,
        totalTokens,
        requests,
        warning,
        degraded: false,
        text: typeof res["text"] === "string" ? res["text"] : "",
      };
      noteSidecarSummary(s);
      return { result: value.result, summary: s };
    } catch {
      markDegraded("record failed");
      recordLocal(value.usage);
      return { result: value.result, summary: localSummary() };
    }
  }

  function summary(): CostSummary {
    // Synchronous surface: reports the last post-call summary pulled from the
    // sidecar, or the in-process counter once degraded.
    if (degraded) return localSummary();
    return last ?? { usedPct: 0, totalTokens: 0, requests: 0, warning: "none", degraded: false, text: "" };
  }

  function noteSidecarSummary(s: CostSummary): void {
    last = s;
  }

  return {
    guard,
    summary,
    reset(): void {
      localTokens = 0;
      localRequests = 0;
      last = { usedPct: 0, totalTokens: 0, requests: 0, warning: "none", degraded, text: degraded ? localSummary().text : "" };
      if (!degraded && opts?.spawnSidecar !== false) {
        void request({ op: "reset" }).catch(() => markDegraded("reset failed"));
      }
    },
    close(): void {
      closed = true;
      for (const p of pending.splice(0)) {
        clearTimeout(p.timer);
        p.reject(new Error("cost client closed"));
      }
      try {
        child?.kill();
      } catch {
        /* ignore */
      }
      child = null;
    },
  };
}
