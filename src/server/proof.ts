// Requirement IDs: NFR-01, FR-24
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { redact } from "src/server/logger.js";

export type ProofMode =
  | "live"
  | "bundle"
  | "simulated"
  | "mock"
  | "bedrock"
  | "vertex"
  | "golden"
  | "manual"
  | "sidecar"
  | "server";

/** Appends one line `<ISO time> proof edge=<edge> mode=<mode> <text>` to the proof file (directories created). `text` is flattened to one line,
 *  redacted, and cut to 120 characters. Never throws (a write error is swallowed after one console warning). */
export interface ProofLog {
  (edge: string, mode: ProofMode, text: string): void;
  readonly path: string;
  lineCount(): number;
}

let warned = false;

export function createProofLog(opts?: {
  path?: string;
  now?: () => number;
  secrets?: () => (string | undefined)[];
}): ProofLog {
  const rawPath = opts?.path ?? "logs/proof.log";
  const absPath = isAbsolute(rawPath) ? rawPath : join(process.cwd(), rawPath);
  const now = opts?.now ?? Date.now;
  const secretsFn = opts?.secrets ?? ((): (string | undefined)[] => []);
  const fn = ((edge: string, mode: ProofMode, text: string): void => {
    try {
      const flat = redact(text, secretsFn())
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      const line = `${new Date(now()).toISOString()} proof edge=${edge} mode=${mode} ${flat}`;
      mkdirSync(dirname(absPath), { recursive: true });
      appendFileSync(absPath, line + "\n", "utf8");
    } catch {
      if (!warned) {
        warned = true;
        console.warn("[proof] write failed");
      }
    }
  }) as ProofLog;
  Object.defineProperty(fn, "path", { value: absPath, enumerable: true });
  fn.lineCount = (): number => {
    try {
      if (!existsSync(absPath)) return 0;
      const content = readFileSync(absPath, "utf8");
      if (content === "") return 0;
      const lines = content.split("\n");
      let n = 0;
      for (const l of lines) if (l.length > 0) n += 1;
      return n;
    } catch {
      return 0;
    }
  };
  return fn;
}
