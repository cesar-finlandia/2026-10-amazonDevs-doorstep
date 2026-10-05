// Requirement IDs: FR-16
// WU-RING-INTEGRATION-06: the nonce is correct and time-bound, and both
// mandatory linking calls are made.
import { createHmac } from "node:crypto";
import { RingError } from "src/domain/ring-port.js";
import { createRingHttp } from "src/ring/client.js";
import { completeLink, confirmLink, getUserMe, makeNonce, maskIdentifier, nonceTime, verifyNonce } from "src/ring/linking.js";
import { createTokenProvider } from "src/ring/oauth.js";
import { WIRE, WIRE_SAMPLES } from "src/ring/wire.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

interface Call { url: string; method: string; body: string | undefined }

// 1: nonce equals an independently computed base64url HMAC.
{
  const expected = createHmac("sha256", "k").update("1760000000:acct-demo").digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  assert(makeNonce("k", "acct-demo", 1_760_000_000_000) === expected, "nonce matches the independent HMAC");
}
// 2: URL-safe alphabet.
assert(/^[A-Za-z0-9_-]+$/.test(makeNonce("k", "acct-demo", 1_760_000_000_000)), "nonce is base64url without padding");
// 3–7: time bounds and mismatch behaviour.
assert(nonceTime(1_760_000_000_999) === 1760000000, "nonceTime floors to seconds");
{
  const nonce = makeNonce("k", "acct-demo", 1_760_000_000_000);
  assert(verifyNonce("k", "acct-demo", 1760000000, nonce, 1_760_000_000_000 + 599_000) === true, "valid 599 s later");
  assert(verifyNonce("k", "acct-demo", 1760000000, nonce, 1_760_000_000_000 + 601_000) === false, "expired 601 s later");
  assert(verifyNonce("k", "other-acct", 1760000000, nonce, 1_760_000_000_000) === false, "wrong account fails");
  assert(verifyNonce("k", "acct-demo", 1760000000, `${nonce}x`, 1_760_000_000_000) === false, "different length never throws");
}
// 8–10: the three linking calls against a stub.
{
  const calls: Call[] = [];
  const stubFetch: typeof globalThis.fetch = (async (url: unknown, init?: unknown): Promise<unknown> => {
    const request = (init ?? {}) as { method?: string; body?: string };
    calls.push({ url: String(url), method: request.method ?? "GET", body: request.body });
    const target = String(url);
    const reply = (status: number, sample: unknown): unknown => {
      const body = JSON.stringify(sample);
      const bytes = new TextEncoder().encode(body);
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { forEach: (cb: (value: string, name: string) => void): void => { cb("application/json", "content-type"); } },
        arrayBuffer: async (): Promise<ArrayBuffer> => bytes.buffer.slice(0) as ArrayBuffer,
        text: async (): Promise<string> => body,
        json: async (): Promise<unknown> => JSON.parse(body) as unknown,
      };
    };
    if (target.endsWith(WIRE.usersMe)) return reply(200, WIRE_SAMPLES.usersMe);
    if (target.endsWith(WIRE.appIntegrations) && (request.method ?? "GET") === "PATCH") {
      return reply(200, WIRE_SAMPLES.appIntegrationCompleted);
    }
    return reply(200, WIRE_SAMPLES.appIntegrationAwaiting);
  }) as unknown as typeof globalThis.fetch;
  const http = createRingHttp({ tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch: stubFetch });
  const deps = { http };

  const me = await getUserMe(deps);
  assert(me.accountId === "acct-demo" && me.name === "Demo Caretaker", "users/me maps id and name");

  const confirmed = await confirmLink(deps, { accountIdentifier: "user@partner.example.com", nonce: "n-1" });
  const post = calls.find((call) => call.method === "POST") as Call;
  assert(
    post.url.endsWith(WIRE.appIntegrations) &&
      JSON.stringify(JSON.parse(post.body ?? "")) ===
        JSON.stringify({ account_identifier: "user@partner.example.com", nonce: "n-1" }),
    "confirm posts identifier and nonce",
  );
  assert(confirmed.status === "awaiting" && confirmed.accountIdentifier === "u***r@partner.example.com", "confirm returns awaiting with a masked identifier");

  const completed = await completeLink(deps);
  const patch = calls.find((call) => call.method === "PATCH") as Call;
  assert(
    JSON.stringify(JSON.parse(patch.body ?? "")) === JSON.stringify({ status: "completed" }) && completed.status === "completed",
    "complete patches completed",
  );
}
// 11: masking and the mandatory-PATCH refusal.
{
  assert(maskIdentifier("user@partner.example.com") === "u***r@partner.example.com", "identifier is masked");
  const conflictFetch: typeof globalThis.fetch = (async (): Promise<unknown> => {
    const body = JSON.stringify({ errors: [{ status: "409", code: "conflict", detail: "No pending link." }] });
    const bytes = new TextEncoder().encode(body);
    return {
      ok: false,
      status: 409,
      headers: { forEach: (cb: (value: string, name: string) => void): void => { cb("application/json", "content-type"); } },
      arrayBuffer: async (): Promise<ArrayBuffer> => bytes.buffer.slice(0) as ArrayBuffer,
      text: async (): Promise<string> => body,
      json: async (): Promise<unknown> => JSON.parse(body) as unknown,
    };
  }) as unknown as typeof globalThis.fetch;
  const http = createRingHttp({ tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch: conflictFetch });
  let error: unknown = null;
  try {
    await completeLink({ http });
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.code === "bad_request", "409 surfaces as bad_request");
}

console.log("ri-06-linking: 11 checks OK");
