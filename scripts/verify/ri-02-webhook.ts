// Requirement IDs: FR-11, NFR-12
// WU-RING-INTEGRATION-02: the receiver verifies before parsing, answers fast,
// is idempotent and never leaks the secret.
import type { RingWebhookPayload } from "src/domain/ring-port.js";
import { createInbox, createSeenStore } from "src/ring/inbox.js";
import { signPayload } from "src/ring/signature.js";
import { createWebhookHandler } from "src/ring/webhook.js";
import type { WebhookEvent } from "src/ring/webhook.js";
import { WIRE_SAMPLES } from "src/ring/wire.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

const SECRET = "fixed-test-secret-02";
const bodies: string[] = [];
const published: WebhookEvent[] = [];
const inbox = createInbox();
const handler = createWebhookHandler({ secret: SECRET, inbox, publish: (e) => published.push(e) });

function signed(payload: unknown): { rawBody: Buffer; headers: Record<string, string | undefined> } {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  return { rawBody: raw, headers: { "X-Signature": signPayload(raw, SECRET) } };
}

// 1: valid motion → fast 200, inbox size 1 after flush.
{
  const started = Date.now();
  const res = await handler(signed(WIRE_SAMPLES.webhookMotion));
  const elapsed = Date.now() - started;
  bodies.push(res.body);
  assert(res.status === 200 && res.body === '{"ok":true}' && elapsed < 50, "valid motion acks fast with ok:true");
  await handler.flush();
  assert(inbox.size("default") === 1, "inbox holds the motion payload after flush");
}
// 2: duplicate request id.
{
  const res = await handler(signed(WIRE_SAMPLES.webhookMotion));
  bodies.push(res.body);
  await handler.flush();
  assert(res.status === 200 && res.body.includes('"duplicate":true') && inbox.size("default") === 1, "repeat is a duplicate");
}
// 3: wrong signature.
{
  const raw = Buffer.from(JSON.stringify(WIRE_SAMPLES.webhookMotion), "utf8");
  const before = published.length;
  const res = await handler({ rawBody: raw, headers: { "x-signature": signPayload(raw, "wrong-secret") } });
  bodies.push(res.body);
  await handler.flush();
  assert(res.status === 401 && inbox.size("default") === 1 && published.length === before, "wrong signature is rejected silently");
}
// 4: missing header.
{
  const res = await handler({ rawBody: Buffer.from("{}", "utf8"), headers: {} });
  bodies.push(res.body);
  assert(res.status === 401, "missing signature is rejected");
}
// 5: valid signature over invalid JSON.
{
  const raw = Buffer.from("{not json", "utf8");
  const res = await handler({ rawBody: raw, headers: { "X-Signature": signPayload(raw, SECRET) } });
  bodies.push(res.body);
  assert(res.status === 400, "invalid json is refused");
}
// 6: no request id anywhere.
{
  const res = await handler(signed({ type: "motion_detected", device_id: "dev-door", timestamp: "2026-10-13T09:14:05Z" }));
  bodies.push(res.body);
  assert(res.status === 400, "missing request id is refused");
}
// 7+8: unknown types are acknowledged and published, never queued.
{
  const before = published.length;
  const deviceAdded = {
    event_id: "evt-added", timestamp: "2026-10-13T09:14:05Z", type: "device_added",
    device_id: "dev-door", meta: { request_id: "req-added" },
  };
  const resAdded = await handler(signed(deviceAdded));
  bodies.push(resAdded.body);
  const removed = {
    event_id: "evt-removed", timestamp: "2026-10-13T09:14:05Z", type: "app_integration_removed",
    device_id: "dev-door", meta: { request_id: "req-removed" },
  };
  const resRemoved = await handler(signed(removed));
  bodies.push(resRemoved.body);
  await handler.flush();
  assert(resAdded.status === 200 && inbox.size("default") === 1 && published.length === before + 2, "unknown types ack without queueing");
  assert(published[published.length - 1]?.type === "app_integration_removed", "removed type is published");
}
// 9: publish shape.
{
  const last = published[published.length - 1] as unknown as Record<string, unknown>;
  assert(
    JSON.stringify(Object.keys(last).sort()) === JSON.stringify(["deviceId", "requestId", "simulated", "tsMs", "type"]),
    "publish carries exactly the five keys",
  );
}
// 10: per-session queues.
{
  const inbox2 = createInbox();
  const a = WIRE_SAMPLES.webhookMotion as RingWebhookPayload;
  const b = WIRE_SAMPLES.webhookButton as RingWebhookPayload;
  inbox2.push("s1", a);
  inbox2.push("default", b);
  assert(JSON.stringify(inbox2.drain("s1")) === JSON.stringify([a]), "s1 drains its own payload");
  assert(JSON.stringify(inbox2.drain("default")) === JSON.stringify([b]), "default drains its own payload");
  assert(inbox2.drain("s1").length === 0 && inbox2.drain("default").length === 0, "second drain is empty");
}
// 11: bounded queues keep the newest.
{
  const inbox3 = createInbox({ maxPerSession: 500 });
  const base = WIRE_SAMPLES.webhookMotion as RingWebhookPayload;
  for (let i = 0; i < 501; i += 1) inbox3.push("default", { ...base, event_id: `evt-${i}` });
  const drained = inbox3.drain("default");
  assert(
    drained.length === 500 && drained[0]?.event_id === "evt-1" && drained[499]?.event_id === "evt-500",
    "queue keeps the newest 500",
  );
}
// 12: unconfigured secret.
{
  const handler503 = createWebhookHandler({ secret: () => undefined, inbox: createInbox() });
  const res = await handler503(signed(WIRE_SAMPLES.webhookMotion));
  bodies.push(res.body);
  assert(res.status === 503 && res.body.includes("webhook secret not configured"), "missing secret answers 503");
}
// 13: nothing leaks the secret.
assert(bodies.every((b) => !b.includes(SECRET)), "no response body contains the secret");
// 14: evicting seen store.
{
  const seen = createSeenStore(3);
  seen.add("a");
  seen.add("b");
  seen.add("c");
  seen.add("d");
  assert(seen.has("d") && !seen.has("a") && seen.size() === 3, "fourth id evicts the first");
}
// 15: non-UTF-8 bytes with a valid signature.
{
  const raw = Buffer.from([0xff, 0xfe, 0x00, 0x41]);
  const res = await handler({ rawBody: raw, headers: { "X-Signature": signPayload(raw, SECRET) } });
  bodies.push(res.body);
  assert(res.status === 400, "non-UTF-8 body is refused without throwing");
}

console.log("ri-02-webhook: 15 checks OK");
