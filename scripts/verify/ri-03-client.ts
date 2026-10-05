// Requirement IDs: FR-10, NFR-01, NFR-03, NFR-13
// WU-RING-INTEGRATION-03: credentials are layered, tokens never leak,
// 429 is respected and every request is inside withResilience.
import { RingError } from "src/domain/ring-port.js";
import { createRingHttp } from "src/ring/client.js";
import { createTokenProvider } from "src/ring/oauth.js";
import { RING_API_BASE, RING_OAUTH_URL } from "src/ring/wire.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

interface ScriptedReply { status: number; headers?: Record<string, string>; body?: string }
interface Call { url: string; method: string; headers: Record<string, string>; body: string | undefined }

class StubHeaders {
  private entries: Array<[string, string]>;
  constructor(init?: Record<string, string>) {
    this.entries = Object.entries(init ?? {});
  }
  get(name: string): string | null {
    const found = this.entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found?.[1] ?? null;
  }
  forEach(cb: (value: string, name: string) => void): void {
    for (const [key, value] of this.entries) cb(value, key);
  }
}

function scriptedFetch(queue: ScriptedReply[], calls: Call[], failWith?: Error): typeof fetch {
  return (async (url: unknown, init?: unknown): Promise<unknown> => {
    const request = (init ?? {}) as { method?: string; headers?: Record<string, string>; body?: string };
    calls.push({
      url: String(url),
      method: request.method ?? "GET",
      headers: request.headers ?? {},
      body: request.body,
    });
    if (failWith !== undefined) throw failWith;
    const next = queue.shift() ?? { status: 200, headers: { "content-type": "application/json" }, body: "{}" };
    const bytes = new TextEncoder().encode(next.body ?? "");
    const headers = new StubHeaders(next.headers ?? { "content-type": "application/json" });
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers,
      arrayBuffer: async (): Promise<ArrayBuffer> => bytes.buffer.slice(0) as ArrayBuffer,
      text: async (): Promise<string> => next.body ?? "",
      json: async (): Promise<unknown> => JSON.parse(next.body ?? "null") as unknown,
    };
  }) as unknown as typeof fetch;
}

function clock() {
  const state = { at: 1_000_000, slept: [] as number[] };
  return {
    state,
    now: (): number => state.at,
    sleep: (ms: number): Promise<void> => {
      state.slept.push(ms);
      state.at += ms;
      return Promise.resolve();
    },
  };
}

const tokenBody = (access: string, refresh: string): string =>
  JSON.stringify({ access_token: access, refresh_token: refresh, scope: "devices", expires_in: 14400, token_type: "Bearer" });

// 1: playground token first with the default ttl.
{
  const time = clock();
  const provider = createTokenProvider({ env: {}, now: time.now });
  provider.setPlaygroundToken("pg-token");
  assert((await provider.getToken()) === "pg-token", "playground token is returned");
  assert(JSON.stringify(provider.status()) === JSON.stringify({ source: "playground", expiresInSec: 1800 }), "playground status");
}
// 2: expired playground falls through to the env access token.
{
  const time = clock();
  const provider = createTokenProvider({ env: { RING_ACCESS_TOKEN: "env-token" }, now: time.now });
  provider.setPlaygroundToken("pg-token");
  time.state.at += 1800 * 1000 + 1;
  assert((await provider.getToken()) === "env-token", "env access token after playground expiry");
  assert(provider.status().source === "env_access", "env_access status");
}
// 3: no credentials.
{
  const provider = createTokenProvider({ env: {} });
  let error: unknown = null;
  try {
    await provider.getToken();
  } catch (e) {
    error = e;
  }
  assert(
    error instanceof RingError && error.status === 401 && error.message.includes("Paste a Playground token"),
    "no credentials rejects with the paste-a-token message",
  );
}
// 4–7: refresh flow, caching, skew and rotation.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch(
    [ { status: 200, body: tokenBody("access-A", "refresh-B") }, { status: 200, body: tokenBody("access-C", "refresh-D") } ],
    calls,
  );
  const provider = createTokenProvider({
    env: { RING_REFRESH_TOKEN: "refresh-1", RING_CLIENT_ID: "cid", RING_CLIENT_SECRET: "csec" },
    fetch, now: time.now,
  });
  assert((await provider.getToken()) === "access-A", "refresh flow returns the access token");
  const first = calls[0] as Call;
  assert(first.url === RING_OAUTH_URL && first.method === "POST", "refresh posts to the OAuth URL");
  assert(first.headers["Content-Type"] === "application/x-www-form-urlencoded", "refresh posts a form body");
  const form = new URLSearchParams(first.body ?? "");
  assert(
    form.get("grant_type") === "refresh_token" && form.get("refresh_token") === "refresh-1" &&
      form.get("client_id") === "cid" && form.get("client_secret") === "csec",
    "form carries grant type, refresh token, client id and secret",
  );
  assert((await provider.getToken()) === "access-A" && calls.length === 1, "second call reuses the cache");
  time.state.at += (14400 - 300) * 1000 + 1;
  assert((await provider.getToken()) === "access-C", "a new refresh happens past expires_in minus skew");
  const second = calls[1] as Call;
  assert(new URLSearchParams(second.body ?? "").get("refresh_token") === "refresh-B", "the rotated refresh token is used");
}
// 8: concurrent callers share one refresh.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch([{ status: 200, body: tokenBody("access-A", "refresh-B") }], calls);
  const provider = createTokenProvider({
    env: { RING_REFRESH_TOKEN: "r", RING_CLIENT_ID: "c", RING_CLIENT_SECRET: "s" }, fetch, now: time.now,
  });
  const [a, b] = await Promise.all([provider.getToken(), provider.getToken()]);
  assert(a === "access-A" && b === "access-A" && calls.length === 1, "concurrent calls share one request");
}
// 9: refresh failure never echoes the secret.
{
  const secret = "csec9-super-secret-value";
  const calls: Call[] = [];
  const fetch = scriptedFetch(
    [{ status: 400, body: JSON.stringify({ error: `bad client_secret ${secret}`, detail: secret }) }],
    calls,
  );
  const provider = createTokenProvider({
    env: { RING_REFRESH_TOKEN: "r", RING_CLIENT_ID: "c", RING_CLIENT_SECRET: secret }, fetch,
  });
  let error: unknown = null;
  try {
    await provider.getToken();
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && !(error.message as string).includes(secret), "refresh refusal redacts the secret");
}
// 10: forget drops the playground token.
{
  const provider = createTokenProvider({ env: { RING_ACCESS_TOKEN: "env-t" } });
  provider.setPlaygroundToken("pg");
  assert((await provider.getToken()) === "pg", "playground first");
  provider.forget();
  assert((await provider.getToken()) === "env-t", "env access after forget");
}
// 11: bearer header and unencoded commas.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch([{ status: 200, body: "{}" }], calls);
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch, now: time.now, sleep: time.sleep,
  });
  await http.get("/v1/devices", { include: "a,b" });
  const call = calls[0] as Call;
  assert(call.headers["Authorization"] === "Bearer tok", "bearer header is sent");
  assert(call.url === `${RING_API_BASE}/v1/devices?include=a,b`, "commas stay unencoded");
}
// 12: one 429 with Retry-After is waited out.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch(
    [{ status: 429, headers: { "retry-after": "1" }, body: "{}" }, { status: 200, body: "{}" }],
    calls,
  );
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch, now: time.now, sleep: time.sleep,
  });
  const res = await http.get("/v1/devices");
  assert(res.status === 200 && calls.length === 2 && (time.state.slept[0] as number) >= 1000, "429 waits Retry-After then succeeds");
}
// 13: persistent 429s end in rate_limited after exactly 3 retries.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch(
    [0, 1, 2, 3].map(() => ({ status: 429, headers: { "retry-after": "1" }, body: "{}" })),
    calls,
  );
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch, now: time.now, sleep: time.sleep,
  });
  let error: unknown = null;
  try {
    await http.get("/v1/devices");
  } catch (e) {
    error = e;
  }
  assert(
    error instanceof RingError && error.code === "rate_limited" && error.retryAfterSec === 1 && calls.length === 4,
    "four 429s throw rate_limited after 3 retries",
  );
}
// 14: backoff without Retry-After follows 1 s, 2 s, 4 s with jitter.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch([0, 1, 2, 3].map(() => ({ status: 429, body: "{}" })), calls);
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch, now: time.now, sleep: time.sleep,
  });
  await http.get("/v1/devices").then(
    () => assert(false, "expected rate_limited"),
    (e: unknown) => assert(e instanceof RingError && e.code === "rate_limited", "rate_limited without Retry-After"),
  );
  const [first, second, third] = time.state.slept;
  assert(
    (first as number) >= 750 && (first as number) <= 1250 &&
      (second as number) >= 1500 && (second as number) <= 2500 &&
      (third as number) >= 3000 && (third as number) <= 5000,
    "sleeps follow 1000/2000/4000 ms within jitter",
  );
}
// 15: 401 refreshes once and retries; a second 401 throws unauthorized.
{
  const time = clock();
  const calls: Call[] = [];
  const api = scriptedFetch(
    [{ status: 401, body: "{}" }, { status: 200, body: "{}" }],
    calls,
  );
  const oauthCalls: Call[] = [];
  const oauth = scriptedFetch(
    [{ status: 200, body: tokenBody("access-N", "refresh-N") }, { status: 200, body: tokenBody("access-N2", "refresh-N2") }],
    oauthCalls,
  );
  const inner = createTokenProvider({
    env: { RING_REFRESH_TOKEN: "r1", RING_CLIENT_ID: "c", RING_CLIENT_SECRET: "s" },
    fetch: oauth, now: time.now,
  });
  const forced: boolean[] = [];
  const http = createRingHttp({
    tokens: { getToken: (o) => { forced.push(o?.force === true); return inner.getToken(o); } },
    fetch: api, now: time.now, sleep: time.sleep,
  });
  assert((await http.get("/v1/devices")).status === 200, "retry after refresh succeeds");
  assert(JSON.stringify(forced) === JSON.stringify([false, true]) && calls.length === 2, "one forced refresh and one retry");

  const timeB = clock();
  const apiBCalls: Call[] = [];
  const apiB = scriptedFetch([{ status: 401, body: "{}" }, { status: 401, body: "{}" }], apiBCalls);
  const oauthB = scriptedFetch(
    [{ status: 200, body: tokenBody("access-X", "refresh-X") }, { status: 401, body: "{}" }],
    [],
  );
  const innerB = createTokenProvider({
    env: { RING_REFRESH_TOKEN: "r1", RING_CLIENT_ID: "c", RING_CLIENT_SECRET: "s" },
    fetch: oauthB, now: timeB.now,
  });
  const httpB = createRingHttp({ tokens: innerB, fetch: apiB, now: timeB.now, sleep: timeB.sleep });
  let error: unknown = null;
  try {
    await httpB.get("/v1/devices");
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.code === "unauthorized", "second 401 throws unauthorized");
}
// 16: JSON:API detail becomes the message.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch(
    [{ status: 400, body: JSON.stringify({ errors: [{ status: "400", detail: "Nope-detail" }] }) }],
    calls,
  );
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch, now: time.now, sleep: time.sleep,
  });
  let error: unknown = null;
  try {
    await http.get("/v1/devices");
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.message === "Nope-detail", "detail is the message");
}
// 17: status classification and the single wrapper retry.
{
  async function classified(status: number, body: string): Promise<RingError> {
    const time = clock();
    const fetch = scriptedFetch([{ status, body }], []);
    const http = createRingHttp({
      tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch, now: time.now, sleep: time.sleep,
    });
    try {
      await http.get("/v1/devices");
    } catch (e) {
      return e as RingError;
    }
    throw new Error("expected a refusal");
  }
  assert((await classified(404, "{}")).code === "not_found", "404 is not_found");
  assert((await classified(400, "{}")).code === "bad_request", "400 is bad_request");
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch([{ status: 500, body: "boom" }, { status: 500, body: "boom" }], calls);
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }), fetch, now: time.now, sleep: time.sleep,
  });
  let error: unknown = null;
  try {
    await http.get("/v1/devices");
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.code === "upstream" && calls.length === 2, "500 retries once then is upstream");
}
// 18: a rejected fetch is a network error.
{
  const http = createRingHttp({ tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }) });
  const failing = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }),
    fetch: scriptedFetch([], [], new Error("down")),
  });
  assert(http.baseUrl === RING_API_BASE, "default base url");
  let error: unknown = null;
  try {
    await failing.get("/v1/devices");
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.code === "network" && error.status === 0, "rejected fetch is network/0");
}
// 19: 150 calls at 100 TPS record at least 500 ms of sleep.
{
  const time = clock();
  const calls: Call[] = [];
  const fetch = scriptedFetch(new Array(150).fill({ status: 200, body: "{}" }), calls);
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }),
    fetch, tps: 100, now: time.now, sleep: time.sleep,
  });
  for (let i = 0; i < 150; i += 1) await http.get("/v1/devices");
  assert(time.state.slept.reduce((a, b) => a + b, 0) >= 500, "token bucket paces the burst");
}
// 20: forced degraded never touches fetch; SDP answers come back as text.
{
  const calls: Call[] = [];
  const fetch = scriptedFetch([{ status: 200, body: "{}" }], calls);
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }),
    fetch, resilience: { forced_degraded: true },
  });
  let error: unknown = null;
  try {
    await http.get("/v1/devices");
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.code === "network" && calls.length === 0, "forced degraded skips fetch");

  const time = clock();
  const sdpCalls: Call[] = [];
  const sdpFetch = scriptedFetch(
    [{ status: 200, headers: { "Content-Type": "application/sdp", Location: "https://x/sess-1" }, body: "v=0\r\nMOCK" }],
    sdpCalls,
  );
  const sdpHttp = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }),
    fetch: sdpFetch, now: time.now, sleep: time.sleep,
  });
  const res = await sdpHttp.post("/v1/devices/d/media/streaming/whep/sessions", undefined, {
    body: "v=0 OFFER", contentType: "application/sdp", accept: "application/sdp",
  });
  assert(res.json === null && res.text === "v=0\r\nMOCK" && res.headers["location"] === "https://x/sess-1", "sdp answers stay text with lower-cased headers");
}

console.log("ri-03-client: 20 checks OK");
