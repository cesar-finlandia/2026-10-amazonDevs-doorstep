// Requirement IDs: FR-13, FR-14, FR-15
// WU-RING-INTEGRATION-05: live sessions are always closable, evidence calls are
// bounded, and the chime is capability-gated before any request leaves.
import { RingError } from "src/domain/ring-port.js";
import { createRingHttp } from "src/ring/client.js";
import { createInbox } from "src/ring/inbox.js";
import { createLiveRingPort } from "src/ring/live-ring-port.js";
import { createTokenProvider } from "src/ring/oauth.js";

function assert(cond: unknown, reason: string): void {
  if (!cond) {
    console.error(`FAIL: ${reason}`);
    process.exit(1);
  }
}

interface Call { url: string; method: string; headers: Record<string, string>; body: string | undefined }

interface StubState {
  missingLocation: boolean;
  delete404: boolean;
  snapshotJson: boolean;
}

function capsBody(chime: boolean): string {
  return JSON.stringify({
    data: {
      type: "capabilities", id: "dev-door",
      attributes: {
        motion_detection: true, video_codecs: ["h264"], night_vision: "auto",
        chime_audio: chime ? { supported: true, slots: ["gentle_hello"] } : { supported: false, slots: [] },
        whep: true, snapshot: true, components: [0],
      },
    },
  });
}

function stubFetch(calls: Call[], state: StubState, now: () => number): typeof fetch {
  void now;
  let sessionNo = 0;
  return (async (url: unknown, init?: unknown): Promise<unknown> => {
    const request = (init ?? {}) as { method?: string; headers?: Record<string, string>; body?: string };
    const call: Call = { url: String(url), method: request.method ?? "GET", headers: request.headers ?? {}, body: request.body };
    calls.push(call);
    const target = String(url);
    const reply = (status: number, headers: Record<string, string>, body: string): unknown => {
      const bytes = new TextEncoder().encode(body);
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
          forEach: (cb: (value: string, name: string) => void): void => {
            for (const [key, value] of Object.entries(headers)) cb(value, key);
          },
        },
        arrayBuffer: async (): Promise<ArrayBuffer> => bytes.buffer.slice(0) as ArrayBuffer,
        text: async (): Promise<string> => body,
        json: async (): Promise<unknown> => JSON.parse(body) as unknown,
      };
    };
    const jsonReply = (status: number, sample: unknown): unknown =>
      reply(status, { "content-type": "application/json" }, JSON.stringify(sample));
    if (target.includes("/status") && request.method === "GET") {
      const acPower = target.includes("dev-line");
      return jsonReply(200, {
        data: { type: "status", id: "x", attributes: { online: true, ac_power: acPower, battery: acPower ? "full" : "ok" } },
      });
    }
    if (target.includes("/capabilities") && request.method === "GET") {
      return reply(200, { "content-type": "application/json" }, capsBody(target.includes("dev-door")));
    }
    if (target.includes("/whep/sessions") && request.method === "POST") {
      if (state.missingLocation) return reply(201, { "content-type": "application/sdp" }, "v=0 ANSWER");
      sessionNo += 1;
      return reply(
        201,
        { "content-type": "application/sdp", Location: `https://ring.test/v1/devices/dev-batt/media/streaming/whep/sessions/sess-${sessionNo}` },
        "v=0 ANSWER",
      );
    }
    if (target.includes("/whep/sessions/") && request.method === "DELETE") {
      if (state.delete404 || target.includes("ghost")) {
        return jsonReply(404, { errors: [{ status: "404", detail: "gone" }] });
      }
      return reply(204, {}, "");
    }
    if (target.includes("/media/image/download")) {
      if (state.snapshotJson) {
        return jsonReply(200, { data: { type: "image", id: "img-1", attributes: { image: "QUJD", content_type: "image/png" } } });
      }
      return reply(200, { "content-type": "image/jpeg" }, "BYTES");
    }
    if (target.includes("/media/video/download")) {
      return reply(200, { "content-type": "video/mp4" }, "MP4");
    }
    if (target.includes("/media/audio/playback")) {
      return reply(202, { "content-type": "application/json" }, "{}");
    }
    return jsonReply(404, { errors: [{ status: "404", detail: "gone" }] });
  }) as unknown as typeof fetch;
}

function setup(state?: Partial<StubState>, at = 5_000_000) {
  const full: StubState = { missingLocation: false, delete404: false, snapshotJson: false, ...state };
  const calls: Call[] = [];
  let time = at;
  const http = createRingHttp({
    tokens: createTokenProvider({ env: { RING_ACCESS_TOKEN: "tok" } }),
    fetch: stubFetch(calls, full, () => time),
  });
  const port = createLiveRingPort({ http, inbox: createInbox(), now: () => time });
  return { calls, port, advance: (ms: number): void => { time += ms; } };
}

// 1–2: WHEP offer/answer and session address.
{
  const { calls, port } = setup();
  const session = await port.startWhep("dev-batt", "v=0 OFFER");
  const post = calls.find((call) => call.method === "POST" && call.url.includes("/whep/sessions")) as Call;
  assert(post.headers["Content-Type"] === "application/sdp" && post.body === "v=0 OFFER", "offer posts as SDP");
  assert(session.answerSdp === "v=0 ANSWER", "answer SDP returns");
  assert(
    session.sessionUri === "https://ring.test/v1/devices/dev-batt/media/streaming/whep/sessions/sess-1" &&
      session.sessionId === "sess-1",
    "absolute session uri with last-segment id",
  );
}
// 3: battery vs line-powered windows.
{
  const { port } = setup();
  assert((await port.startWhep("dev-batt", "v=0 OFFER")).maxSeconds === 30, "battery window is 30 s");
  const line = setup();
  assert((await line.port.startWhep("dev-line", "v=0 OFFER")).maxSeconds === 60, "line-powered window is 60 s");
}
// 4: component addressing on WHEP.
{
  const { calls, port } = setup();
  await port.startWhep("dev-batt", "v=0 OFFER", 1);
  const post = calls.find((call) => call.method === "POST" && call.url.includes("/whep/sessions")) as Call;
  assert(post.url.includes("component_id=1"), "component_id rides on the WHEP post");
}
// 5–7: closing sessions.
{
  const { calls, port } = setup();
  await port.startWhep("dev-batt", "v=0 OFFER");
  await port.stopWhep("dev-batt", "sess-1");
  const dels = calls.filter((call) => call.method === "DELETE");
  assert(dels.length === 1 && dels[0]?.url === "https://ring.test/v1/devices/dev-batt/media/streaming/whep/sessions/sess-1", "stop deletes the remembered uri");

  const missing = setup({ delete404: true });
  await missing.port.startWhep("dev-batt", "v=0 OFFER");
  await missing.port.stopWhep("dev-batt", "sess-1");
  assert(true, "a 404 on DELETE resolves");

  const ghost = setup();
  await ghost.port.stopWhep("dev-batt", "ghost");
  const ghostDel = ghost.calls.find((call) => call.method === "DELETE") as Call;
  assert(ghostDel.url.endsWith("/whep/sessions/ghost"), "unknown sessions delete by convention");
}
// 8: no Location is a 502.
{
  const { port } = setup({ missingLocation: true });
  let error: unknown = null;
  try {
    await port.startWhep("dev-batt", "v=0 OFFER");
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.status === 502, "missing Location is a 502");
}
// 9–10: snapshots, bytes and embedded JSON.
{
  const { calls, port } = setup();
  const snap = await port.getSnapshot("dev-elite", 1);
  const post = calls.find((call) => call.method === "POST" && call.url.includes("/media/image/download")) as Call;
  assert(JSON.stringify(JSON.parse(post.body ?? "")) === JSON.stringify({ format: "jpeg", components: [1] }), "snapshot posts format and components");
  assert(snap.contentType === "image/jpeg" && snap.dataBase64 === Buffer.from("BYTES").toString("base64"), "image bytes become base64");

  const viaJson = setup({ snapshotJson: true });
  const embedded = await viaJson.port.getSnapshot("dev-door", 0);
  assert(embedded.dataBase64 === "QUJD" && embedded.contentType === "image/png", "embedded base64 also works");
}
// 11: clip bounds checked before any request.
{
  const { calls, port } = setup();
  let error: unknown = null;
  try {
    await port.getClip("dev-door", { startMs: 0, endMs: 31_000 });
  } catch (e) {
    error = e;
  }
  assert(error instanceof RingError && error.code === "bad_request" && calls.length === 0, "31 s clip refused before posting");
  const clip = await port.getClip("dev-door", { startMs: 1000, endMs: 21_000 });
  const post = calls.find((call) => call.method === "POST" && call.url.includes("/media/video/download")) as Call;
  const sent = JSON.parse(post.body ?? "") as { start: string; end: string };
  assert(
    sent.start === new Date(1000).toISOString() && sent.end === new Date(21_000).toISOString() && clip.durationSec === 20,
    "20 s clip posts ISO bounds",
  );
}
// 12–13: chime gating.
{
  const { calls, port } = setup();
  const result = await port.playChime("dev-door", "gentle_hello");
  const post = calls.find((call) => call.method === "POST" && call.url.includes("/media/audio/playback")) as Call;
  assert(JSON.stringify(JSON.parse(post.body ?? "")) === JSON.stringify({ audio_ref: "gentle_hello" }), "chime posts audio_ref");
  assert(result.ok === true && result.simulated === false, "chime result is live");

  const elite = setup();
  let error: unknown = null;
  try {
    await elite.port.playChime("dev-elite", "gentle_hello");
  } catch (e) {
    error = e;
  }
  assert(
    error instanceof RingError && error.code === "unsupported" &&
      elite.calls.every((call) => !call.url.includes("/media/audio/playback")),
    "chime without capability is refused locally",
  );
}
// 14: session tracking and capability caching.
{
  const { calls, port, advance } = setup();
  await port.startWhep("dev-batt", "v=0 OFFER");
  await port.startWhep("dev-line", "v=0 OFFER");
  assert(port.openSessions().length === 2, "two sessions tracked");
  await port.closeAll();
  assert(calls.filter((call) => call.method === "DELETE").length === 2 && port.openSessions().length === 0, "closeAll deletes both and empties");
  const capsCalls = (): number => calls.filter((call) => call.method === "GET" && call.url.includes("/capabilities")).length;
  await port.playChime("dev-door", "gentle_hello");
  await port.playChime("dev-door", "gentle_hello");
  assert(capsCalls() === 1, "capabilities cached within 60 s");
  advance(61_000);
  await port.playChime("dev-door", "gentle_hello");
  assert(capsCalls() === 2, "capabilities refetched after 60 s");
}

console.log("ri-05-media: 14 checks OK");
