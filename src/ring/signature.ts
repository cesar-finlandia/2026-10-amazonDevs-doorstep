// Requirement IDs: FR-11
// Constant-time HMAC-SHA256 webhook signature check (server-side only).
import { createHmac, timingSafeEqual } from "node:crypto";

function toBytes(rawBody: Buffer | string): Buffer {
  return typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);
}

/** "sha256=<lower-case hex>" over rawBody. Used by the simulate-webhook route, the contract server and tests. */
export function signPayload(rawBody: Buffer | string, secret: string): string {
  const digest = createHmac("sha256", secret).update(toBytes(rawBody)).digest("hex");
  return "sha256=" + digest.toLowerCase();
}

/** Constant-time HMAC-SHA256 check of the raw body. header must be "sha256=<64 hex>" (hex case-insensitive). Never throws; false on any problem. */
export function verifySignature(rawBody: Buffer | string, header: string | undefined, secret: string): boolean {
  try {
    if (typeof secret !== "string" || secret.length === 0) return false;
    if (typeof header !== "string") return false;
    const match = /^sha256=([0-9a-fA-F]{64})$/.exec(header);
    if (match === null || typeof match[1] !== "string") return false;
    const received = Buffer.from(match[1], "hex");
    const expected = createHmac("sha256", secret).update(toBytes(rawBody)).digest();
    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
