// Requirement IDs: FR-10…FR-17 — a SIMULATED Ring. Every response carries the header "x-simulated: true".
// Local contract server for offline verification (server-side only; never logs tokens or signatures).
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { buildBundle } from "src/domain/generator.js";
import type { RingBundle } from "src/domain/generator.js";
import { signPayload } from "src/ring/signature.js";
import { WIRE_SAMPLES } from "src/ring/wire.js";

export interface MockRingOptions {
  port?: number; // default 0 (ephemeral)
  bundle?: RingBundle; // default the committed bundle
  webhookSecret?: string; webhookTarget?: string; // emitWebhook posts here
  clientId?: string; clientSecret?: string; refreshToken?: string;
  accessTokens?: string[]; // accepted bearer tokens; default ["mock-access-token"] and every token the mock issues
  rateLimitPerSec?: number; // when set, the (n+1)th request within one second gets 429 Retry-After: 1
}
export interface MockRing {
  readonly url: string; readonly oauthUrl: string;
  close(): Promise<void>;
  stats(): { requests: number; byPath: Record<string, number>; rateLimited: number };
  failNext(status: number, retryAfterSec?: number): void;
  emitWebhook(partial: { type: string; deviceId: string; subType?: string; componentId?: number; requestId?: string }): Promise<{ requestId: string; status: number }>;
}

interface FailPlan { status: number; retryAfterSec?: number }

function jsonError(status: number, code: string, title: string, detail: string): unknown {
  return { errors: [{ status: String(status), code, title, detail }] };
}

function wireHistoryType(eventType: string, subType?: string): string {
  switch (eventType) {
    case "motion_detected":
      return subType === "human" ? "motion.human" : "motion.other";
    case "button_press":
      return "ding";
    case "device_online":
      return "device_online";
    case "device_offline":
      return "device_offline";
    default:
      return eventType;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

export function createMockRingServer(opts?: MockRingOptions): Promise<MockRing> {
  const bundle = opts?.bundle ?? buildBundle();
  const accepted = new Set<string>(opts?.accessTokens ?? ["mock-access-token"]);
  const expectedClientId = opts?.clientId ?? "mock-client-id";
  const expectedClientSecret = opts?.clientSecret ?? "mock-client-secret";
  let expectedRefresh = opts?.refreshToken ?? "mock-refresh-token";
  const limit = opts?.rateLimitPerSec;
  const webhookSecret = opts?.webhookSecret;
  const webhookTarget = opts?.webhookTarget;

  let requests = 0;
  const byPath: Record<string, number> = {};
  let rateLimited = 0;
  let failPlan: FailPlan | null = null;
  let tokenSeq = 0;
  let sessionSeq = 0;
  let webhookSeq = 0;
  // Per-link account-link state (FR-16): a PATCH completes only a link whose
  // POST opened it, exactly once. A fresh server refuses PATCH-first with 409
  // (ri-07-mock check 10), and so does any repeat PATCH after the one
  // completion (S-RING-9 one-time semantics).
  let linkStage: "none" | "awaiting" | "completed" = "none";
  const sessions = new Set<string>();
  const window: number[] = [];

  function send(res: ServerResponse, status: number, headers: Record<string, string>, body: string | Buffer): void {
    res.writeHead(status, { "x-simulated": "true", ...headers });
    res.end(body);
  }
  function sendJson(res: ServerResponse, status: number, doc: unknown, extra?: Record<string, string>): void {
    send(res, status, { "content-type": "application/json", ...extra }, JSON.stringify(doc));
  }

  function devicesDoc(includeParam: string | null): unknown {
    const want = includeParam === null ? ["status", "capabilities", "location", "configurations"] : includeParam.split(",");
    const data = bundle.devices.map((device) => ({
      type: "device",
      id: device.id,
      attributes: {
        device_type: device.kind,
        description: device.description,
        owned: device.owned,
        subscribed: device.subscribed,
        component_ids: device.componentIds,
      },
      relationships: {
        status: { data: { type: "status", id: device.id } },
        capabilities: { data: { type: "capabilities", id: device.id } },
        location: { data: { type: "location", id: device.id } },
        configurations: { data: { type: "configurations", id: device.id } },
      },
    }));
    const included: unknown[] = [];
    for (const device of bundle.devices) {
      if (want.includes("status")) {
        included.push({
          type: "status", id: device.id,
          attributes: { online: device.status.online, ac_power: device.status.acPower, battery: device.status.battery },
        });
      }
      if (want.includes("capabilities")) {
        included.push({
          type: "capabilities", id: device.id,
          attributes: {
            motion_detection: device.capabilities.motionDetection,
            video_codecs: device.capabilities.videoCodecs,
            night_vision: device.capabilities.nightVision,
            chime_audio: {
              supported: device.capabilities.chimeAudio,
              slots: device.capabilities.chimeAudioSlots,
            },
            whep: device.capabilities.whep,
            snapshot: device.capabilities.snapshot,
            components: device.capabilities.components,
          },
        });
      }
      if (want.includes("location")) {
        included.push({
          type: "location", id: device.id,
          attributes: {
            country: "US",
            state: "CA",
            utc_offset_minutes: device.location?.utcOffsetMin ?? 0,
          },
        });
      }
      if (want.includes("configurations")) {
        included.push({ type: "configurations", id: device.id, attributes: { ...(device.configurations ?? {}) } });
      }
    }
    return { data, included };
  }

  function subResource(deviceId: string, name: string): unknown | null {
    const device = bundle.devices.find((entry) => entry.id === deviceId);
    if (device === undefined) return null;
    switch (name) {
      case "status":
        return {
          data: {
            type: "status", id: device.id,
            attributes: { online: device.status.online, ac_power: device.status.acPower, battery: device.status.battery },
          },
        };
      case "capabilities":
        return {
          data: {
            type: "capabilities", id: device.id,
            attributes: {
              motion_detection: device.capabilities.motionDetection,
              video_codecs: device.capabilities.videoCodecs,
              night_vision: device.capabilities.nightVision,
              chime_audio: {
                supported: device.capabilities.chimeAudio,
                slots: device.capabilities.chimeAudioSlots,
              },
              whep: device.capabilities.whep,
              snapshot: device.capabilities.snapshot,
              components: device.capabilities.components,
            },
          },
        };
      case "location":
        return {
          data: {
            type: "location", id: device.id,
            attributes: { country: "US", state: "CA", utc_offset_minutes: device.location?.utcOffsetMin ?? 0 },
          },
        };
      case "configurations":
        return { data: { type: "configurations", id: device.id, attributes: { ...(device.configurations ?? {}) } } };
      default:
        return null;
    }
  }

  function historyDoc(deviceId: string, url: URL): unknown | null {
    const pages = bundle.history[deviceId];
    if (pages === undefined) return null;
    const all = pages.flatMap((page) => page.items);
    const filterRaw = url.searchParams.get("event_types");
    const wanted = filterRaw === null ? null : new Set(filterRaw.split(",").map((part) => part.trim()));
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const typed = all.map((item) => ({ item, wire: wireHistoryType(item.eventType, item.subType) }));
    const filtered = wanted === null
      ? typed
      : typed.filter(({ wire }) =>
        wanted.has(wire) || (wire.startsWith("motion.") && wanted.has("motion")));
    const slice = filtered.slice(offset, offset + (Number.isFinite(limit) ? limit : 50));
    return {
      data: slice.map(({ item, wire }) => ({
        type: "event",
        id: item.id,
        attributes: {
          event_type: wire,
          start: item.timestamp,
          component_ids: item.componentIds,
          ...(item.subType !== undefined ? { sub_type: item.subType } : {}),
        },
      })),
      meta: { pagination: { limit: Number.isFinite(limit) ? limit : 50, offset, total: filtered.length } },
    };
  }

  const server: Server = createServer((req, res) => {
    void (async (): Promise<void> => {
      const at = Date.now();
      const parsed = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = parsed.pathname;
      requests += 1;
      byPath[path] = (byPath[path] ?? 0) + 1;
      window.push(at);
      while (window.length > 0 && (window[0] as number) <= at - 1000) window.shift();

      if (failPlan !== null) {
        const plan = failPlan;
        failPlan = null;
        sendJson(res, plan.status, jsonError(plan.status, plan.status === 429 ? "rate_limited" : "upstream", "Simulated failure", "failNext armed this failure."), plan.retryAfterSec !== undefined ? { "retry-after": String(plan.retryAfterSec) } : undefined);
        return;
      }
      if (limit !== undefined && window.length > limit) {
        rateLimited += 1;
        sendJson(res, 429, WIRE_SAMPLES.errorRateLimited, { "retry-after": "1" });
        return;
      }

      if (req.method === "POST" && path === "/oauth/token") {
        const form = new URLSearchParams(await readBody(req));
        if (
          form.get("grant_type") === "refresh_token" &&
          form.get("refresh_token") === expectedRefresh &&
          form.get("client_id") === expectedClientId &&
          form.get("client_secret") === expectedClientSecret
        ) {
          tokenSeq += 1;
          const access = `mock-access-${tokenSeq}`;
          const refresh = `mock-refresh-${tokenSeq}`;
          expectedRefresh = refresh;
          accepted.add(access);
          sendJson(res, 200, {
            access_token: access, refresh_token: refresh, scope: "devices", expires_in: 14400, token_type: "Bearer",
          });
        } else {
          sendJson(res, 401, jsonError(401, "unauthorized", "Unauthorized", "The refresh token or client credentials are wrong."));
        }
        return;
      }

      const header = req.headers["authorization"];
      const authorized = typeof header === "string" && [...accepted].some((token) => header === `Bearer ${token}`);
      if (path.startsWith("/v1/") && !authorized) {
        sendJson(res, 401, WIRE_SAMPLES.errorUnauthorized);
        return;
      }

      if (req.method === "GET" && path === "/v1/devices") {
        sendJson(res, 200, devicesDoc(parsed.searchParams.get("include")));
        return;
      }

      const sub = /^\/v1\/devices\/([^/]+)\/(status|capabilities|location|configurations)$/.exec(path);
      if (req.method === "GET" && sub !== null) {
        const doc = subResource(decodeURIComponent(sub[1] as string), sub[2] as string);
        if (doc === null) {
          sendJson(res, 404, jsonError(404, "not_found", "Not Found", "Unknown device."));
        } else {
          sendJson(res, 200, doc);
        }
        return;
      }

      const history = /^\/v1\/history\/devices\/([^/]+)\/events$/.exec(path);
      if (req.method === "GET" && history !== null) {
        const doc = historyDoc(decodeURIComponent(history[1] as string), parsed);
        if (doc === null) {
          sendJson(res, 404, jsonError(404, "not_found", "Not Found", "Unknown device."));
        } else {
          sendJson(res, 200, doc);
        }
        return;
      }

      const whepPost = /^\/v1\/devices\/([^/]+)\/media\/streaming\/whep\/sessions$/.exec(path);
      if (req.method === "POST" && whepPost !== null) {
        const contentType = req.headers["content-type"] ?? "";
        await readBody(req);
        if (!contentType.includes("application/sdp")) {
          sendJson(res, 400, jsonError(400, "bad_request", "Bad Request", "WHEP sessions need an SDP offer."));
          return;
        }
        sessionSeq += 1;
        const id = decodeURIComponent(whepPost[1] as string);
        const sessionId = `sess-${sessionSeq}`;
        sessions.add(sessionId);
        const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
        send(res, 201, { "content-type": "application/sdp", location: `${origin}/v1/devices/${id}/media/streaming/whep/sessions/${sessionId}` }, "v=0 SIMULATED");
        return;
      }
      const whepDel = /^\/v1\/devices\/[^/]+\/media\/streaming\/whep\/sessions\/([^/]+)$/.exec(path);
      if (req.method === "DELETE" && whepDel !== null) {
        const sessionId = whepDel[1] as string;
        if (!sessions.has(sessionId)) {
          sendJson(res, 404, jsonError(404, "not_found", "Not Found", "Unknown session."));
        } else {
          sessions.delete(sessionId);
          send(res, 204, {}, "");
        }
        return;
      }

      const image = /^\/v1\/devices\/([^/]+)\/media\/image\/download$/.exec(path);
      if (req.method === "POST" && image !== null) {
        const id = decodeURIComponent(image[1] as string);
        const device = bundle.devices.find((entry) => entry.id === id);
        if (device === undefined) {
          sendJson(res, 404, jsonError(404, "not_found", "Not Found", "Unknown device."));
          return;
        }
        let component = 0;
        try {
          const parsedBody = JSON.parse(await readBody(req)) as { components?: unknown };
          const first = Array.isArray(parsedBody.components) ? parsedBody.components[0] : undefined;
          if (typeof first === "number") component = first;
        } catch {
          component = 0;
        }
        const snap = bundle.snapshots[`${id}:${component}`];
        if (snap === undefined) {
          sendJson(res, 404, jsonError(404, "not_found", "Not Found", "No snapshot."));
          return;
        }
        send(res, 200, { "content-type": snap.contentType }, Buffer.from(snap.dataBase64, "base64"));
        return;
      }

      const video = /^\/v1\/devices\/([^/]+)\/media\/video\/download$/.exec(path);
      if (req.method === "POST" && video !== null) {
        const id = decodeURIComponent(video[1] as string);
        await readBody(req);
        if (bundle.devices.find((entry) => entry.id === id) === undefined) {
          sendJson(res, 404, jsonError(404, "not_found", "Not Found", "Unknown device."));
          return;
        }
        send(res, 200, { "content-type": "video/mp4" }, Buffer.from("MOCKMP4BYTES"));
        return;
      }

      const audio = /^\/v1\/devices\/([^/]+)\/media\/audio\/playback$/.exec(path);
      if (req.method === "POST" && audio !== null) {
        const id = decodeURIComponent(audio[1] as string);
        await readBody(req);
        const device = bundle.devices.find((entry) => entry.id === id);
        if (device === undefined) {
          sendJson(res, 404, jsonError(404, "not_found", "Not Found", "Unknown device."));
          return;
        }
        if (!device.capabilities.chimeAudio) {
          sendJson(res, 400, jsonError(400, "bad_request", "Bad Request", "This device cannot play audio."));
          return;
        }
        sendJson(res, 202, { data: { type: "playback", id: "pb-1", attributes: { ok: true } } });
        return;
      }

      if (req.method === "GET" && path === "/v1/users/me") {
        sendJson(res, 200, WIRE_SAMPLES.usersMe);
        return;
      }

      if (path === "/v1/accounts/me/app-integrations" && (req.method === "POST" || req.method === "PATCH")) {
        const text = await readBody(req);
        let parsedBody: Record<string, unknown> = {};
        try {
          parsedBody = JSON.parse(text) as Record<string, unknown>;
        } catch {
          parsedBody = {};
        }
        if (req.method === "POST") {
          if (typeof parsedBody["account_identifier"] !== "string" || typeof parsedBody["nonce"] !== "string") {
            sendJson(res, 400, jsonError(400, "bad_request", "Bad Request", "account_identifier and nonce are required."));
            return;
          }
          linkStage = "awaiting";
          sendJson(res, 200, WIRE_SAMPLES.appIntegrationAwaiting);
          return;
        }
        if (linkStage !== "awaiting") {
          sendJson(res, 409, jsonError(409, "conflict", "Conflict", "Confirm the link before completing it."));
          return;
        }
        linkStage = "completed";
        sendJson(res, 200, WIRE_SAMPLES.appIntegrationCompleted);
        return;
      }

      sendJson(res, 404, jsonError(404, "not_found", "Not Found", "Unknown path."));
    })();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts?.port ?? 0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const url = `http://127.0.0.1:${address.port}`;
      resolve({
        url,
        oauthUrl: `${url}/oauth/token`,
        close: () => new Promise<void>((done, failed) => {
          server.close((error?: Error) => {
            if (error !== undefined && error !== null) failed(error);
            else done();
          });
        }),
        stats: () => ({ requests: requests, byPath: { ...byPath }, rateLimited }),
        failNext: (status: number, retryAfterSec?: number): void => {
          failPlan = retryAfterSec === undefined ? { status } : { status, retryAfterSec };
        },
        emitWebhook: async (partial) => {
          if (webhookSecret === undefined || webhookTarget === undefined) {
            throw new Error("emitWebhook needs webhookSecret and webhookTarget.");
          }
          webhookSeq += 1;
          const requestId = partial.requestId ?? `req-sim-${webhookSeq}`;
          const at = new Date().toISOString();
          const payload = {
            event_id: `evt-${requestId}`,
            timestamp: at,
            type: partial.type,
            account_id: "acct-demo",
            device_id: partial.deviceId,
            attributes: {
              ...(partial.subType !== undefined ? { sub_type: partial.subType } : {}),
              component_ids: [partial.componentId ?? 0],
            },
            meta: { request_id: requestId, time: at },
            simulated: true,
          };
          const raw = JSON.stringify(payload);
          const delivered = await globalThis.fetch(webhookTarget, {
            method: "POST",
            headers: { "content-type": "application/json", "x-signature": signPayload(raw, webhookSecret) },
            body: raw,
          });
          await delivered.text();
          return { requestId, status: delivered.status };
        },
      });
    });
  });
}
