// Requirement IDs: FR-16
// Staging-user account linking: time-bound HMAC nonce plus the mandatory
// POST-then-PATCH app-integration calls (server-side only).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RingHttp } from "src/ring/client.js";
import { RING_LIMITS, WIRE } from "src/ring/wire.js";

export function nonceTime(nowMs: number): number {
  return Math.floor(nowMs / 1000);
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(nonce: string): Buffer {
  const padded = nonce.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (nonce.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

/** base64url, no padding, HMAC-SHA256(key, `${nonceTime}:${accountId}`) */
export function makeNonce(key: string, accountId: string, nowMs: number = Date.now()): string {
  return base64Url(createHmac("sha256", key).update(`${nonceTime(nowMs)}:${accountId}`).digest());
}

/** within 600 s, constant time */
export function verifyNonce(
  key: string,
  accountId: string,
  time: number,
  nonce: string,
  nowMs: number = Date.now(),
): boolean {
  try {
    if (typeof nonce !== "string" || nonce.length === 0) return false;
    if (Math.abs(nonceTime(nowMs) - time) > RING_LIMITS.nonceWindowSec) return false;
    const expected = fromBase64Url(makeNonce(key, accountId, time * 1000));
    const received = fromBase64Url(nonce);
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

/** "u***r@partner.example.com" */
export function maskIdentifier(id: string): string {
  if (typeof id !== "string" || id.length === 0) return "***";
  const at = id.indexOf("@");
  if (at < 0) return `${id.slice(0, 1)}***${id.slice(-1)}`;
  const local = id.slice(0, at);
  return `${local.slice(0, 1)}***${local.slice(-1)}${id.slice(at)}`;
}

export interface LinkDeps { http: RingHttp }

export async function getUserMe(deps: LinkDeps): Promise<{ accountId: string; name?: string }> {
  const res = await deps.http.get(WIRE.usersMe);
  const data = (typeof res.json === "object" && res.json !== null
    ? ((res.json as Record<string, unknown>)["data"] as Record<string, unknown> | undefined)
    : undefined) ?? {};
  const attrs = (typeof data["attributes"] === "object" && data["attributes"] !== null
    ? (data["attributes"] as Record<string, unknown>)
    : {});
  const accountId = typeof data["id"] === "string"
    ? (data["id"] as string)
    : typeof attrs["account_id"] === "string"
      ? (attrs["account_id"] as string)
      : "";
  const out: { accountId: string; name?: string } = { accountId };
  if (typeof attrs["name"] === "string") out.name = attrs["name"] as string;
  return out;
}

export async function confirmLink(
  deps: LinkDeps,
  args: { accountIdentifier: string; nonce: string },
): Promise<{ status: "awaiting" | string; accountIdentifier: string /* masked */ }> {
  const res = await deps.http.post(WIRE.appIntegrations, {
    account_identifier: args.accountIdentifier,
    nonce: args.nonce,
  });
  const attrs = (typeof res.json === "object" && res.json !== null
    ? (((res.json as Record<string, unknown>)["data"] as Record<string, unknown> | undefined)?.["attributes"] as
      | Record<string, unknown>
      | undefined)
    : undefined) ?? {};
  return {
    status: typeof attrs["status"] === "string" ? (attrs["status"] as string) : "awaiting",
    accountIdentifier: maskIdentifier(args.accountIdentifier),
  };
}

export async function completeLink(deps: LinkDeps): Promise<{ status: "completed" | string }> {
  const res = await deps.http.patch(WIRE.appIntegrations, { status: "completed" });
  const attrs = (typeof res.json === "object" && res.json !== null
    ? (((res.json as Record<string, unknown>)["data"] as Record<string, unknown> | undefined)?.["attributes"] as
      | Record<string, unknown>
      | undefined)
    : undefined) ?? {};
  return { status: typeof attrs["status"] === "string" ? (attrs["status"] as string) : "completed" };
}
