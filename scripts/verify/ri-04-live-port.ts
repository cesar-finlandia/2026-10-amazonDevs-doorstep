// Requirement IDs: FR-10, FR-12, FR-17
// WU-RING-INTEGRATION-04: Ring's JSON:API is mapped into the domain port types
// with tolerant readers, and component addressing works.
import { RingError } from "src/domain/ring-port.js";
import { parseHistoryPage } from "src/domain/parse.js";
import { createRingHttp } from "src/ring/client.js";
import { createInbox } from "src/ring/inbox.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import { createTokenProvider } from "src/ring/oauth.js";
import { WIRE, WIRE_SAMPLES } from "src/ring/wire.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

interface StubReply { status: number; headers?: Record<string, string>; body: string }
interface SeenCall { url: string; method: string; body: string | undefined }

function stubFetch(handler: (call: SeenCall) => StubReply, seen: SeenCall[]): typeof fetch {
  return (async (url: unknown, init?: unknown): Promise<unknown> => {
    const request = (init ?? {}) as { method?: string; body?: string };
    const call: SeenCall = { url: String(url), method: request.method ?? "GET", body: request.body };
    seen.push(call);
    const next = handler(call);
    const bytes = new TextEncoder().encode(next.body);
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers: {
        forEach: (cb: (value: string, name: string) => void): void => {
          for (const [key, value] of Object.entries(next.headers ?? { "content-type": "application/json" })) cb(value, key);
        },
      },
      arrayBuffer: async (): Promise<ArrayBuffer> => bytes.buffer.slice(0) as ArrayBuffer,
      text: async (): Promise<string> => next.body,
      json: async (): Promise<unknown> => JSON.parse(next.body) as unknown,
    };
  }) as unknown as typeof fetch;
}

const json = (status: number, sample: unknown): StubReply =>
  ({ status, headers: { "content-type": "application/json" }, body: JSON.stringify(sample) });

function portWith(seen: SeenCall[], handler: (call: SeenCall) => StubReply) {
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }),
    fetch: stubFetch(handler, seen),
  });
  return createLiveRingPort({ http, inbox: createInbox() });
}

const devicesReply = (): StubReply => json(200, WIRE_SAMPLES.devices);

// 1–4: listDevices mapping over WIRE_SAMPLES.devices.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => devicesReply());
  const devices = await port.listDevices();
  assert(devices.length === 2 && devices[0]?.id === "dev-door" && devices[1]?.id === "dev-elite", "two devices with ids");
  assert(
    (seen[0] as SeenCall).url.endsWith(`/v1/devices?include=${WIRE.deviceInclude}`),
    "include query is exact",
  );
  const door = devices[0];
  const elite = devices[1];
  assert(
    JSON.stringify(elite?.componentIds) === JSON.stringify([0, 1]) &&
      door?.capabilities.chimeAudio === true &&
      JSON.stringify(door?.capabilities.chimeAudioSlots) === JSON.stringify(["gentle_hello", "check_in_chime"]) &&
      elite?.capabilities.chimeAudio === false,
    "component ids and chime flags",
  );
  assert(
    JSON.stringify(door?.status) === JSON.stringify({ online: true, acPower: false, battery: "ok" }),
    "door status maps",
  );
}
// 5: status string "online" and low battery.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => json(200, WIRE_SAMPLES.status));
  const status = await port.getStatus("dev-door");
  assert(status.online === true && status.battery === "low", "string online maps to true with low battery");
}
// 6: component_id on capabilities.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => json(200, WIRE_SAMPLES.capabilitiesElite));
  await port.getCapabilities("dev-elite", 1);
  assert((seen[0] as SeenCall).url.endsWith("/v1/devices/dev-elite/capabilities?component_id=1"), "component_id is sent");
}
// 7: location name order.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => json(200, WIRE_SAMPLES.location));
  assert((await port.getLocation("dev-door")).name === "CA, US", "location reads CA, US");
}
// 8: configurations flattening.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => json(200, WIRE_SAMPLES.configurations));
  const conf = await port.getConfigurations("dev-door");
  assert(
    conf["motion.zones"] === 2 && conf["privacy.zones"] === 1 && conf["label"] === "porch" && conf["enhanced"] === true,
    "configurations flatten to dotted keys",
  );
}
// 9–11: history page, filter and domain parsing.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => json(200, WIRE_SAMPLES.history));
  const page = await port.getEventHistory("dev-door", { limit: 50, offset: 0 });
  assert(
    page.items.length === 3 && page.total === 3 &&
      page.items[0]?.id === "h-3" && page.items[2]?.id === "h-1" &&
      page.items.every((item) => typeof item.timestamp === "string" && item.timestamp.length > 0) &&
      page.items[0]?.timestamp === "2026-10-13T09:14:05Z",
    "history is newest first with start timestamps and total 3",
  );
  await port.getEventHistory("dev-door", { limit: 50, offset: 0, type: "button_press" });
  assert((seen[1] as SeenCall).url.includes("event_types=ding"), "button_press adds event_types=ding");
  const events = parseHistoryPage(page.items, "dev-door");
  const human = events.find((e) => e.id === "hist:h-3");
  const ding = events.find((e) => e.id === "hist:h-2");
  assert(
    human?.type === "motion_detected" && human?.subType === "human" && ding?.type === "button_press",
    "history items parse to domain events",
  );
}
// 12: inbox drain.
{
  const seen: SeenCall[] = [];
  const inbox = createInbox();
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }),
    fetch: stubFetch(() => devicesReply(), seen),
  });
  const port = createLiveRingPort({ http, inbox });
  const payload = WIRE_SAMPLES.webhookMotion as import("src/domain/ring-port.js").RingWebhookPayload;
  inbox.push("default", payload);
  const drained = await port.drainWebhookInbox();
  assert(drained.length === 1 && (await port.drainWebhookInbox()).length === 0, "drain returns payloads and empties");
}
// 13–14: error surfacing.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => json(404, { errors: [{ status: "404", detail: "gone" }] }));
  let notFound: unknown = null;
  try {
    await port.getStatus("dev-nope");
  } catch (e) {
    notFound = e;
  }
  assert(notFound instanceof RingError && (notFound as RingError).code === "not_found", "404 surfaces as not_found");
  const seenB: SeenCall[] = [];
  const portB = portWith(seenB, () => json(401, WIRE_SAMPLES.errorUnauthorized));
  let unauthorized: unknown = null;
  try {
    await portB.listDevices();
  } catch (e) {
    unauthorized = e;
  }
  assert(unauthorized instanceof RingError && (unauthorized as RingError).code === "unauthorized", "401 surfaces as unauthorized");
}
// 15: mode and empty history.
{
  const seen: SeenCall[] = [];
  const port = portWith(seen, () => json(200, { data: [], meta: { pagination: { limit: 50, offset: 0, total: 0 } } }));
  const page = await port.getEventHistory("dev-door", { limit: 50, offset: 0 });
  assert(port.mode === "live" && page.items.length === 0 && page.total === 0, "live mode with empty history");
}

console.log("ri-04-live-port: 15 checks OK");
