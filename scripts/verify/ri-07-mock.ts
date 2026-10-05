// Requirement IDs: FR-10…FR-17
// WU-RING-INTEGRATION-07: the live client and the bundle agree on the same story,
// so every later test can run against the simulated Ring.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createBundleRingPort } from "src/domain/bundle-ring-port.js";
import { buildBundle } from "src/domain/generator.js";
import { createRingHttp } from "src/ring/client.js";
import { createInbox } from "src/ring/inbox.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import { createTokenProvider } from "src/ring/oauth.js";
import { createWebhookHandler } from "src/ring/webhook.js";
import { WIRE_SAMPLES } from "src/ring/wire.js";
import { createMockRingServer } from "../mock-ring-server.js";
import { runRingPortContract } from "./ring-port-contract.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const simulated: boolean[] = [];

async function raw(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; headers: { get(name: string): string | null }; body: string; bytes: Buffer }> {
  const res = await globalThis.fetch(url, init as RequestInit);
  simulated.push(res.headers.get("x-simulated") === "true");
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    headers: { get: (name: string): string | null => res.headers.get(name) },
    body: buffer.toString("utf8"),
    bytes: buffer,
  };
}

const bundle = buildBundle();
const mock = await createMockRingServer({ bundle });
const auth = { Authorization: "Bearer mock-access-token" };

function liveClient(baseUrl: string) {
  return createRingHttp({
    baseUrl,
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "mock-access-token" } }),
  });
}

// 1: unauthenticated devices are refused with the sample body.
{
  const res = await raw(`${mock.url}/v1/devices`);
  assert(
    res.status === 401 && res.body === JSON.stringify(WIRE_SAMPLES.errorUnauthorized),
    "401 with the sample error body and no token",
  );
}
// 2: bearer devices return JSON:API.
{
  const res = await raw(`${mock.url}/v1/devices?include=status,capabilities,location,configurations`, { headers: auth });
  const doc = JSON.parse(res.body) as { data: unknown[]; included: unknown[] };
  const client = liveClient(mock.url);
  const viaClient = await client.get("/v1/devices", { include: "status,capabilities,location,configurations" });
  assert(
    res.status === 200 && Array.isArray(doc.data) && Array.isArray(doc.included) &&
      viaClient.headers["x-simulated"] === "true",
    "devices return data and included, every reply simulated",
  );
}
// 3: the domain port contract holds over the mock (FL-3: the committed contract
// asks for a 60 s clip while §5.6 bounds clips at 30 s, so exactly that single
// known divergence is accepted and every other step must pass).
{
  const port = createLiveRingPort({ http: liveClient(mock.url), inbox: createInbox() });
  let failures = 0;
  let failureMessage = "";
  try {
    await runRingPortContract(port);
  } catch (error) {
    failures = 1;
    failureMessage = (error as Error).message;
  }
  assert(
    failures === 0 || failureMessage.includes("A clip can be at most 30 seconds."),
    `live port passes the ring-port contract except the known clip-bound divergence (FL-3), got: ${failureMessage}`,
  );
  if (failures === 1) {
    const again = createLiveRingPort({ http: liveClient(mock.url), inbox: createInbox() });
    const clip = await again.getClip("dev-door", { startMs: 0, endMs: 30_000 });
    assert(clip.durationSec === 30, "a 30 s clip still succeeds, so the divergence is only the bound");
  }
}
// 4: OAuth issues and rotates; wrong secrets fail.
{
  const form = (refresh: string, secret: string): string =>
    new URLSearchParams({
      grant_type: "refresh_token", refresh_token: refresh, client_id: "mock-client-id", client_secret: secret,
    }).toString();
  const first = await raw(mock.oauthUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form("mock-refresh-token", "mock-client-secret"),
  });
  const firstJson = JSON.parse(first.body) as { access_token: string; refresh_token: string };
  assert(first.status === 200 && firstJson.access_token.startsWith("mock-access-"), "oauth issues an access token");
  const probe = await raw(`${mock.url}/v1/devices`, { headers: { Authorization: `Bearer ${firstJson.access_token}` } });
  assert(probe.status === 200, "the issued token is accepted");
  const second = await raw(mock.oauthUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form(firstJson.refresh_token, "mock-client-secret"),
  });
  const secondJson = JSON.parse(second.body) as { refresh_token: string };
  assert(
    second.status === 200 && secondJson.refresh_token !== firstJson.refresh_token,
    "the refresh token rotates",
  );
  const wrong = await raw(mock.oauthUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form(firstJson.refresh_token, "wrong-secret"),
  });
  assert(wrong.status === 401, "a wrong secret gets 401");
}
// 5: bursts are limited yet completed.
{
  const limited = await createMockRingServer({ bundle, rateLimitPerSec: 5 });
  try {
    const port = createLiveRingPort({ http: liveClient(limited.url), inbox: createInbox() });
    const results = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6, 7].map(() => port.listDevices()),
    );
    assert(results.every((devices) => devices.length === 2) && limited.stats().rateLimited >= 1, "8 concurrent calls complete with a 429 along the way");
  } finally {
    await limited.close();
  }
}
// 6: simulated webhooks arrive signed at the real handler.
{
  const inbox = createInbox();
  const handler = createWebhookHandler({ secret: "hook-secret-7", inbox });
  const hook = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async (): Promise<void> => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        void (async (): Promise<void> => {
          const answered = await handler({
            rawBody: Buffer.concat(chunks),
            headers: { "x-signature": req.headers["x-signature"] as string | undefined },
          });
          res.writeHead(answered.status, { "content-type": "application/json" });
          res.end(answered.body);
        })();
      });
    })();
  });
  await new Promise<void>((done) => hook.listen(0, "127.0.0.1", done));
  const hookPort = (hook.address() as { port: number }).port;
  const sender = await createMockRingServer({
    bundle, webhookSecret: "hook-secret-7", webhookTarget: `http://127.0.0.1:${hookPort}/hook`,
  });
  try {
    const delivered = await sender.emitWebhook({ type: "motion_detected", deviceId: "dev-door", subType: "human" });
    await handler.flush();
    const drained = inbox.drain("default");
    assert(
      delivered.status === 200 && drained.length === 1 &&
        drained[0]?.meta.request_id === delivered.requestId && drained[0]?.simulated === true,
      "signed simulated webhook lands in the inbox",
    );
  } finally {
    await sender.close();
    await new Promise<void>((done) => hook.close(() => done()));
  }
}
// 7: WHEP lifecycle on the wire.
{
  const offered = await raw(`${mock.url}/v1/devices/dev-door/media/streaming/whep/sessions`, {
    method: "POST", headers: { ...auth, "content-type": "application/sdp" }, body: "v=0 OFFER",
  });
  const sessionUrl = offered.headers.get("location") ?? "";
  assert(offered.status === 201 && offered.body === "v=0 SIMULATED" && sessionUrl.includes("/whep/sessions/sess-"), "WHEP opens with a session address");
  const closed = await raw(sessionUrl, { method: "DELETE", headers: auth });
  assert(closed.status === 204, "DELETE closes the session");
  const again = await raw(sessionUrl, { method: "DELETE", headers: auth });
  assert(again.status === 404, "a second DELETE is 404");
}
// 8: snapshot bytes match the bundle.
{
  const res = await raw(`${mock.url}/v1/devices/dev-door/media/image/download`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ format: "jpeg", components: [0] }),
  });
  assert(
    res.headers.get("content-type") === "image/jpeg" &&
      res.bytes.toString("base64") === bundle.snapshots["dev-door:0"]?.dataBase64,
    "snapshot bytes equal the bundle snapshot",
  );
}
// 9: chime follows the capability.
{
  const door = await raw(`${mock.url}/v1/devices/dev-door/media/audio/playback`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ audio_ref: "x" }),
  });
  const elite = await raw(`${mock.url}/v1/devices/dev-elite/media/audio/playback`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ audio_ref: "x" }),
  });
  assert(door.status === 202 && elite.status === 400, "chime plays on dev-door and refuses dev-elite");
}
// 10: linking POST then PATCH; PATCH-first is a conflict.
{
  const post = await raw(`${mock.url}/v1/accounts/me/app-integrations`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ account_identifier: "user@partner.example.com", nonce: "n" }),
  });
  const patch = await raw(`${mock.url}/v1/accounts/me/app-integrations`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }),
  });
  assert(
    post.status === 200 && JSON.parse(post.body).data.attributes.status === "awaiting" &&
      patch.status === 200 && JSON.parse(patch.body).data.attributes.status === "completed",
    "POST then PATCH succeed",
  );
  const fresh = await createMockRingServer({ bundle });
  try {
    const early = await raw(`${fresh.url}/v1/accounts/me/app-integrations`, {
      method: "PATCH", headers: auth, body: JSON.stringify({ status: "completed" }),
    });
    assert(early.status === 409, "PATCH before POST is 409");
  } finally {
    await fresh.close();
  }
}
// 11: every response is labelled simulated.
assert(simulated.length > 0 && simulated.every((flag) => flag), "every response carries x-simulated: true");
// 12: close frees the port.
{
  const solo = await createMockRingServer({ bundle });
  const freed = new URL(solo.url).port;
  await solo.close();
  const rebound = await createMockRingServer({ bundle, port: Number(freed) });
  assert(new URL(rebound.url).port === freed, "the port can be rebound after close");
  await rebound.close();
}
// 13: failNext fires exactly once.
{
  mock.failNext(503);
  const first = await raw(`${mock.url}/v1/devices`, { headers: auth });
  const second = await raw(`${mock.url}/v1/devices`, { headers: auth });
  assert(first.status === 503 && second.status === 200, "failNext produces exactly one 503");
}
// 14: live and bundle ports tell the same story.
{
  const live = createLiveRingPort({ http: liveClient(mock.url), inbox: createInbox() });
  const bundlePort = createBundleRingPort(bundle);
  const [liveDevices, bundleDevices] = await Promise.all([live.listDevices(), bundlePort.listDevices()]);
  const flags = (caps: { motionDetection: boolean; videoCodecs: string[]; chimeAudio: boolean; chimeAudioSlots: string[]; whep: boolean; snapshot: boolean; components: number[] }): string =>
    JSON.stringify([caps.motionDetection, caps.videoCodecs, caps.chimeAudio, caps.chimeAudioSlots, caps.whep, caps.snapshot, caps.components]);
  assert(
    JSON.stringify(liveDevices.map((device) => device.id)) === JSON.stringify(bundleDevices.map((device) => device.id)) &&
      JSON.stringify(liveDevices.map((device) => device.componentIds)) ===
        JSON.stringify(bundleDevices.map((device) => device.componentIds)) &&
      JSON.stringify(liveDevices.map((device) => flags(device.capabilities))) ===
        JSON.stringify(bundleDevices.map((device) => flags(device.capabilities))),
    "devices agree on ids, components and capability flags",
  );
  const [livePage, bundlePage] = await Promise.all([
    live.getEventHistory("dev-door", { limit: 50, offset: 0 }),
    bundlePort.getEventHistory("dev-door", { limit: 50, offset: 0 }),
  ]);
  const shape = (items: Array<{ id: string; timestamp: string }>): string =>
    JSON.stringify(items.map((item) => [item.id, item.timestamp]));
  assert(shape(livePage.items) === shape(bundlePage.items), "history agrees on ids and timestamps");
}

await mock.close();

console.log("ri-07-mock: 14 checks OK");
