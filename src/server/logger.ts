// Requirement IDs: NFR-01, FR-24
import type { RequestHandler } from "express";

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

/** Replaces every occurrence of each non-empty secret, every `Bearer <token>` and every `sha256=<16+ hex>` with "[redacted]". */
export function redact(text: string, secrets?: (string | undefined)[]): string {
  let out = text;
  if (secrets) {
    for (const s of secrets) {
      if (typeof s !== "string" || s.length < 4) continue;
      out = out.split(s).join("[redacted]");
    }
  }
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/g, "Bearer [redacted]");
  out = out.replace(/sha256=[0-9a-fA-F]{16,}/g, "sha256=[redacted]");
  return out;
}

function redactValue(value: unknown, secrets: (string | undefined)[]): unknown {
  if (typeof value === "string") return redact(value, secrets);
  try {
    const json = JSON.stringify(value);
    const red = redact(json, secrets);
    return JSON.parse(red) as unknown;
  } catch {
    return value;
  }
}

/** One JSON object per line: { t: ISO time, level, msg, ...fields }. `secrets` is read on every call (the environment can change). */
export function createLogger(opts?: {
  write?: (line: string) => void;
  secrets?: () => (string | undefined)[];
  now?: () => number;
}): Logger {
  const write = opts?.write ?? ((line: string): void => process.stdout.write(line + "\n"));
  const secretsFn = opts?.secrets ?? ((): (string | undefined)[] => []);
  const now = opts?.now ?? Date.now;
  function emit(level: string, msg: string, fields?: Record<string, unknown>): void {
    const secrets = secretsFn();
    const out: Record<string, unknown> = {
      t: new Date(now()).toISOString(),
      level,
      msg: redact(msg, secrets),
    };
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        out[k] = typeof v === "string" ? redact(v, secrets) : redactValue(v, secrets);
      }
    }
    write(JSON.stringify(out));
  }
  return {
    info: (msg, fields): void => emit("info", msg, fields),
    warn: (msg, fields): void => emit("warn", msg, fields),
    error: (msg, fields): void => emit("error", msg, fields),
  };
}

/** Logs `{ method, path, status, ms }` after the response finishes. Path is `req.path` (no query string). Never logs headers or bodies. */
export function requestLogger(log: Logger, now?: () => number): RequestHandler {
  const clock = now ?? Date.now;
  return (req, res, next): void => {
    const start = clock();
    res.on("finish", () => {
      log.info("request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: clock() - start,
      });
    });
    next();
  };
}
