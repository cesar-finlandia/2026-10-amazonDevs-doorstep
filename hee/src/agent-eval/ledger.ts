// Requirement IDs: HEE-EVAL-01, HEE-EVAL-02, HEE-EVAL-03
// DP-W08 §3.5 session budget ledger.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EvalConfig } from "./types.js";

export interface EvalLedger {
  sessions: number;
}

export class BudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}

export function ledgerPath(dir: string): string {
  return join(dir, "ledger.json");
}

export function readLedger(dir: string): EvalLedger {
  const path = ledgerPath(dir);
  if (!existsSync(path)) return { sessions: 0 };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<EvalLedger>;
    return { sessions: typeof raw.sessions === "number" ? raw.sessions : 0 };
  } catch {
    return { sessions: 0 };
  }
}

export function reserve(dir: string, n: number, cfg: EvalConfig): EvalLedger {
  const ledger = readLedger(dir);
  if (ledger.sessions + n > cfg.max_sessions) {
    const remaining = cfg.max_sessions - ledger.sessions;
    throw new BudgetError(`eval: this iteration needs ${n} sessions but only ${remaining} of ${cfg.max_sessions} remain`);
  }
  mkdirSync(dir, { recursive: true });
  const next = { sessions: ledger.sessions + n };
  writeFileSync(ledgerPath(dir), JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

export function commit(dir: string, _n: number): EvalLedger {
  mkdirSync(dir, { recursive: true });
  if (!existsSync(ledgerPath(dir))) {
    writeFileSync(ledgerPath(dir), JSON.stringify({ sessions: 0 }, null, 2) + "\n", "utf8");
  }
  return readLedger(dir);
}
