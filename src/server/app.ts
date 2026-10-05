// src/server/app.ts — Requirement IDs: FR-01…FR-24
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requestLogger } from "src/server/logger.js";
import type { ServerDeps } from "src/server/deps.js";
import { RingError } from "src/domain/ring-port.js";
import type { RingPort } from "src/domain/ring-port.js";
import { SESSION_ID_PATTERN } from "src/server/sessions.js";
import { confirmLink, completeLink, getUserMe, makeNonce, nonceTime } from "src/ring/linking.js";
import { createWebhookHandler } from "src/ring/webhook.js";
import type { WebhookHandler } from "src/ring/webhook.js";
import { signPayload } from "src/ring/signature.js";
import { buildSimulatedWebhook, SIMULATE_TYPES } from "src/server/simulate.js";

function errJson(status: number, code: string, message: string, retryAfterSec?: number): Record<string, unknown> {
  const inner: Record<string, unknown> = { status, code, message };
  if (retryAfterSec !== undefined) inner["retryAfterSec"] = retryAfterSec;
  return { ok: false, error: inner };
}

function validSessionId(v: unknown): v is string {
  return typeof v === "string" && SESSION_ID_PATTERN.test(v);
}

function mountHealth(app: Express, deps: ServerDeps): void {
  app.get("/health", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const mode = deps.sessions.ringMode();
      const provider = deps.agent.state().kind;
      const uptimeSec = Math.max(0, Math.floor((deps.now() - deps.startedAtMs) / 1000));
      res.json({ ok: true, build: deps.buildMarker, mode, provider, uptimeSec });
    } catch (e) {
      next(e);
    }
  });
}

function mountEvents(app: Express, deps: ServerDeps): void {
  app.get("/events", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const s = deps.hub.snapshot();
      res.setHeader("Cache-Control", "no-store");
      res.json({ events: s.events, degraded: s.degraded });
    } catch (e) {
      next(e);
    }
  });
  app.get("/events/stream", (req: Request, res: Response) => {
    deps.hub.stream(req as never, res as never);
  });
}

function proofMiddleware(app: Express, deps: ServerDeps): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) {
      next();
      return;
    }
    if (req.method === "GET" && req.path === "/api/status") {
      next();
      return;
    }
    const start = deps.now();
    res.on("finish", () => {
      try {
        deps.proof("ui-api", "server", `${req.method} ${req.path} ${res.statusCode} ${deps.now() - start}ms`);
      } catch {
        /* ignore */
      }
    });
    next();
  });
}

function reqStr(args: Record<string, unknown>, op: string, name: string): string {
  const v = args[name];
  if (typeof v !== "string" || v.length === 0) {
    throw new RingError(400, "bad_request", `${op}: ${name} is required.`);
  }
  return v;
}

function reqInt(args: Record<string, unknown>, op: string, name: string): number {
  const v = args[name];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 1000) {
    throw new RingError(400, "bad_request", `${op}: ${name} is required.`);
  }
  return v;
}

function reqMs(args: Record<string, unknown>, op: string, name: string): number {
  const v = args[name];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new RingError(400, "bad_request", `${op}: ${name} is required.`);
  }
  return v;
}

async function callRingOp(
  port: RingPort,
  op: string,
  args: Record<string, unknown>,
  inboxDrain: () => unknown[],
): Promise<unknown> {
  switch (op) {
    case "listDevices":
      return port.listDevices();
    case "getStatus":
      return port.getStatus(reqStr(args, op, "deviceId"));
    case "getCapabilities": {
      const deviceId = reqStr(args, op, "deviceId");
      const c = args["componentId"];
      return port.getCapabilities(deviceId, typeof c === "number" ? c : undefined);
    }
    case "getLocation":
      return port.getLocation(reqStr(args, op, "deviceId"));
    case "getConfigurations":
      return port.getConfigurations(reqStr(args, op, "deviceId"));
    case "getEventHistory": {
      const deviceId = reqStr(args, op, "deviceId");
      const limit = reqInt(args, op, "limit");
      const offset = reqInt(args, op, "offset");
      const t = args["type"];
      return port.getEventHistory(deviceId, {
        limit,
        offset,
        ...(typeof t === "string" ? { type: t } : {}),
      });
    }
    case "drainWebhookInbox": {
      const items = await port.drainWebhookInbox();
      if (port.mode === "bundle") {
        const extra = inboxDrain() as unknown[];
        return [...items, ...extra];
      }
      return items;
    }
    case "startWhep": {
      const deviceId = reqStr(args, op, "deviceId");
      const sdpOffer = reqStr(args, op, "sdpOffer");
      const c = args["componentId"];
      return port.startWhep(deviceId, sdpOffer, typeof c === "number" ? c : undefined);
    }
    case "stopWhep":
      await port.stopWhep(reqStr(args, op, "deviceId"), reqStr(args, op, "whepSessionId"));
      return null;
    case "getSnapshot": {
      const deviceId = reqStr(args, op, "deviceId");
      const c = args["componentId"];
      return port.getSnapshot(deviceId, typeof c === "number" ? c : undefined);
    }
    case "getClip": {
      const deviceId = reqStr(args, op, "deviceId");
      const startMs = reqMs(args, op, "startMs");
      const endMs = reqMs(args, op, "endMs");
      const c = args["componentId"];
      return port.getClip(deviceId, {
        startMs,
        endMs,
        ...(typeof c === "number" ? { componentId: c } : {}),
      });
    }
    case "playChime":
      return port.playChime(reqStr(args, op, "deviceId"), reqStr(args, op, "audioRef"));
    default:
      throw new RingError(404, "unknown_op", `Unknown operation ${op}.`);
  }
}

const RING_OPS = new Set([
  "listDevices",
  "getStatus",
  "getCapabilities",
  "getLocation",
  "getConfigurations",
  "getEventHistory",
  "drainWebhookInbox",
  "startWhep",
  "stopWhep",
  "getSnapshot",
  "getClip",
  "playChime",
]);

function sendRingError(res: Response, e: RingError): void {
  const status = e.status >= 400 && e.status <= 599 ? e.status : 502;
  const inner: Record<string, unknown> = { status, code: e.code, message: e.message };
  if (e.retryAfterSec !== undefined) inner["retryAfterSec"] = e.retryAfterSec;
  res.status(status).json({ ok: false, error: inner });
}

function mountRing(app: Express, deps: ServerDeps): void {
  app.post("/api/ring/token", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!validSessionId(body["sessionId"])) {
        res.status(400).json(errJson(400, "bad_session", "Invalid session id."));
        return;
      }
      const sid = body["sessionId"] as string;
      try {
        const token = body["token"];
        const out = deps.sessions.setToken(sid, typeof token === "string" ? token : "");
        const mode = deps.sessions.ringMode(sid);
        await deps.hub.publish("ring-mode", "done", { mode, sessionId: sid });
        res.json({ ok: true, expiresInSec: out.expiresInSec });
      } catch (e) {
        if (e instanceof RingError) sendRingError(res, e);
        else next(e);
      }
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/ring/token", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!validSessionId(body["sessionId"])) {
        res.status(400).json(errJson(400, "bad_session", "Invalid session id."));
        return;
      }
      const sid = body["sessionId"] as string;
      deps.sessions.forgetToken(sid);
      const mode = deps.sessions.ringMode(sid);
      await deps.hub.publish("ring-mode", "done", { mode, sessionId: sid });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/ring/linking/nonce", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!validSessionId(body["sessionId"])) {
        res.status(400).json(errJson(400, "bad_session", "Invalid session id."));
        return;
      }
      const sid = body["sessionId"] as string;
      const http = deps.sessions.httpFor(sid);
      if (!http) {
        res.status(409).json(errJson(409, "not_live", "Connect a Ring token first."));
        return;
      }
      const key = deps.env["RING_HMAC_KEY"];
      if (!key) {
        res.status(503).json(errJson(503, "not_configured", "Linking is not configured."));
        return;
      }
      try {
        let accountId = body["accountId"];
        if (typeof accountId !== "string" || accountId.length === 0) {
          accountId = (await getUserMe({ http })).accountId;
        }
        const at = deps.now();
        res.json({
          ok: true,
          nonce: makeNonce(key, accountId as string, at),
          time: nonceTime(at),
          accountId,
        });
      } catch (e) {
        const ringErr = e instanceof RingError ? e : new RingError(0, "upstream", "Ring did not answer.");
        deps.sessions.noteRingResult(sid, ringErr);
        sendRingError(res, ringErr);
      }
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/ring/linking/confirm", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!validSessionId(body["sessionId"])) {
        res.status(400).json(errJson(400, "bad_session", "Invalid session id."));
        return;
      }
      const sid = body["sessionId"] as string;
      const http = deps.sessions.httpFor(sid);
      if (!http) {
        res.status(409).json(errJson(409, "not_live", "Connect a Ring token first."));
        return;
      }
      try {
        const accountIdentifier = body["accountIdentifier"];
        const nonce = body["nonce"];
        if (typeof accountIdentifier !== "string" || typeof nonce !== "string") {
          throw new RingError(400, "bad_request", "confirm: accountIdentifier is required.");
        }
        const result = await confirmLink({ http }, { accountIdentifier, nonce });
        res.json({ ok: true, ...result });
      } catch (e) {
        const ringErr = e instanceof RingError ? e : new RingError(0, "upstream", "Ring did not answer.");
        deps.sessions.noteRingResult(sid, ringErr);
        sendRingError(res, ringErr);
      }
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/ring/linking/complete", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!validSessionId(body["sessionId"])) {
        res.status(400).json(errJson(400, "bad_session", "Invalid session id."));
        return;
      }
      const sid = body["sessionId"] as string;
      const http = deps.sessions.httpFor(sid);
      if (!http) {
        res.status(409).json(errJson(409, "not_live", "Connect a Ring token first."));
        return;
      }
      try {
        const result = await completeLink({ http });
        res.json({ ok: true, ...result });
      } catch (e) {
        const ringErr = e instanceof RingError ? e : new RingError(0, "upstream", "Ring did not answer.");
        deps.sessions.noteRingResult(sid, ringErr);
        sendRingError(res, ringErr);
      }
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/ring/:op", async (req: Request, res: Response, next: NextFunction) => {
    const started = deps.now();
    try {
      const op = req.params.op as string;
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!validSessionId(body["sessionId"])) {
        res.status(400).json(errJson(400, "bad_session", "Invalid session id."));
        return;
      }
      const sid = body["sessionId"] as string;
      if (!RING_OPS.has(op)) {
        res.status(404).json(errJson(404, "unknown_op", `Unknown operation ${op}.`));
        return;
      }
      const args = (body["args"] ?? {}) as Record<string, unknown>;
      const port = deps.sessions.portFor(sid);
      const live = port.mode === "live";
      let data: unknown;
      try {
        data = await callRingOp(port, op, args, () => deps.inbox.drain(sid));
      } catch (e) {
        const ringErr = e instanceof RingError ? e : new RingError(0, "upstream", "Ring did not answer.");
        if (live) {
          const degradedNow = deps.sessions.noteRingResult(sid, ringErr);
          if (degradedNow) {
            const reason =
              ringErr.code === "unauthorized"
                ? "The Ring token is missing or expired."
                : "Ring is not answering.";
            await deps.hub.publish(
              "system-degraded",
              "done",
              { layer: "ring", kind: "bundle", label: "Recorded week (not live Ring)", reason },
              { degraded: true },
            );
            await deps.hub.publish("ring-mode", "done", { mode: "bundle", sessionId: sid });
          }
        }
        sendRingError(res, ringErr);
        return;
      }
      if (live) deps.sessions.noteRingResult(sid, null);
      deps.proof("api-ring", port.mode === "live" ? "live" : "bundle", `${op} ok ${deps.now() - started}ms`);
      res.json({ ok: true, data: data ?? null });
    } catch (e) {
      next(e);
    }
  });
}

interface WebhookStore {
  defaultHandler: WebhookHandler;
  extra: Map<string, WebhookHandler>;
  publish: (e: { requestId: string; type: string; deviceId: string; tsMs: number; simulated: boolean }) => void;
}

const webhookStores = new WeakMap<ServerDeps, WebhookStore>();

function mountWebhook(app: Express, deps: ServerDeps): void {
  const publish = (e: {
    requestId: string;
    type: string;
    deviceId: string;
    tsMs: number;
    simulated: boolean;
  }): void => {
    void deps.hub.publish("ring-webhook", "done", {
      requestId: e.requestId,
      type: e.type,
      deviceId: e.deviceId,
      tsMs: e.tsMs,
      simulated: e.simulated,
    });
    try {
      deps.proof("api-inbox", e.simulated ? "simulated" : "live", `webhook ${e.type} accepted ${e.requestId}`);
    } catch {
      /* ignore */
    }
  };
  const defaultHandler = createWebhookHandler({
    secret: () => deps.env["RING_WEBHOOK_SECRET"],
    inbox: deps.inbox,
    seen: deps.seen,
    publish,
    sessionId: "default",
  });
  webhookStores.set(deps, { defaultHandler, extra: new Map(), publish });
  app.post(
    "/webhooks/ring",
    express.raw({ type: "*/*", limit: deps.config.bodyLimitKb + "kb" }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const raw = req.body as Buffer;
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          headers[k] = Array.isArray(v) ? v.join(", ") : v;
        }
        const out = await defaultHandler({
          rawBody: Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw ?? "")),
          headers,
        });
        res.status(out.status).type("application/json").send(out.body);
      } catch (e) {
        next(e);
      }
    },
  );
}

function mountSimulate(app: Express, deps: ServerDeps): void {
  let counter = 0;
  app.post("/api/dev/simulate-webhook", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (deps.env["NODE_ENV"] === "production" && deps.env["ALLOW_SIMULATE"] !== "1") {
        res.status(404).json(errJson(404, "disabled", "Simulated deliveries are off on this server."));
        return;
      }
      const type = body["type"];
      const deviceId = body["deviceId"];
      if (
        typeof type !== "string" ||
        !(SIMULATE_TYPES as readonly string[]).includes(type) ||
        typeof deviceId !== "string" ||
        deviceId.length === 0 ||
        deviceId.length > 80
      ) {
        res.status(400).json(errJson(400, "bad_request", "Invalid simulation request."));
        return;
      }
      const secret = deps.env["RING_WEBHOOK_SECRET"];
      if (!secret) {
        res.status(503).json(errJson(503, "not_configured", "The webhook secret is not set."));
        return;
      }
      const simReq: { type: string; deviceId: string; subType?: string; componentId?: number; sessionId?: string } = {
        type,
        deviceId,
      };
      if (typeof body["subType"] === "string") simReq.subType = body["subType"] as string;
      if (typeof body["componentId"] === "number") simReq.componentId = body["componentId"] as number;
      if (typeof body["sessionId"] === "string") simReq.sessionId = body["sessionId"] as string;
      const at = deps.now();
      counter += 1;
      const payload = buildSimulatedWebhook(simReq, at, counter);
      const raw = Buffer.from(JSON.stringify(payload));
      const sig = signPayload(raw, secret);
      const store = webhookStores.get(deps);
      if (!store) {
        res.status(502).json(errJson(502, "upstream", "The simulated delivery was not accepted."));
        return;
      }
      const target =
        typeof body["sessionId"] === "string" && (body["sessionId"] as string).length > 0
          ? (body["sessionId"] as string)
          : "default";
      let handler = target === "default" ? store.defaultHandler : store.extra.get(target);
      if (!handler) {
        handler = createWebhookHandler({
          secret: () => deps.env["RING_WEBHOOK_SECRET"],
          inbox: deps.inbox,
          seen: deps.seen,
          publish: store.publish,
          sessionId: target,
        });
        store.extra.set(target, handler);
      }
      const out = await handler({ rawBody: raw, headers: { "x-signature": sig } });
      if (out.status !== 200) {
        res.status(502).json(errJson(502, "upstream", "The simulated delivery was not accepted."));
        return;
      }
      res.json({ ok: true, requestId: (payload["meta"] as Record<string, unknown>)["request_id"] });
    } catch (e) {
      next(e);
    }
  });
}

function mountAgent(app: Express, deps: ServerDeps): void {
  const RUN_ID = /^[A-Za-z0-9_-]{1,64}$/;
  const ROLES = new Set(["extractor", "planner", "narrator"]);

  function runIdOf(req: Request): string | null {
    const v = req.headers["x-run-id"];
    const id = Array.isArray(v) ? v[0] : v;
    if (id === undefined) return "default";
    if (typeof id !== "string" || !RUN_ID.test(id)) return null;
    return id;
  }

  function writeProofs(kind: string, name: string, model: string, latencyMs: number, totalTokens: number): void {
    try {
      if (kind === "bedrock" || kind === "vertex-fallback") {
        const mode = kind === "bedrock" ? "bedrock" : "vertex";
        deps.proof("api-bedrock", mode, `${name} ${model} ${latencyMs}ms ${totalTokens} tokens`);
      } else if (kind === "golden") {
        deps.proof("api-cache", "golden", `replayed ${name} from the recorded run`);
      }
      const s = deps.cost.summary();
      deps.proof("api-cost", "sidecar", `used ${s.usedPct}% of the token budget (${s.totalTokens} tokens)`);
    } catch {
      /* ignore */
    }
  }

  app.post("/api/agent/step", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const runId = runIdOf(req);
      if (runId === null) {
        res.status(400).json(errJson(400, "bad_request", "Invalid run id."));
        return;
      }
      const body = req.body as { contents?: unknown; tools?: unknown; system?: unknown };
      if (body === null || typeof body !== "object" || !Array.isArray(body.contents) || body.contents.length === 0) {
        res.status(400).json({ ok: false, status: 400, message: "contents must be a non-empty array" });
        return;
      }
      if (!Array.isArray(body.tools)) {
        res.status(400).json({ ok: false, status: 400, message: "tools must be an array" });
        return;
      }
      const out = await deps.agent.step(runId, {
        ...(typeof body.system === "string" ? { system: body.system } : {}),
        contents: body.contents as never,
        tools: body.tools as never,
      });
      if (out.ok === true) {
        writeProofs(out.kind, "step", out.result.model, out.result.latencyMs, out.result.usage.totalTokens);
        res.status(200).json({ ...out });
      } else {
        res.status(out.status).json({ ...out });
      }
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/agent/role/:role", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.params.role as string;
      if (!ROLES.has(role)) {
        res.status(404).json(errJson(404, "unknown_role", `Unknown role ${role}.`));
        return;
      }
      const runId = runIdOf(req);
      if (runId === null) {
        res.status(400).json(errJson(400, "bad_request", "Invalid run id."));
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const input = body["input"];
      const round = body["round"];
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        res.status(400).json(errJson(400, "bad_request", "Role input is required."));
        return;
      }
      if (typeof round !== "number" || !Number.isInteger(round) || round < 1) {
        res.status(400).json(errJson(400, "bad_request", "Round is required."));
        return;
      }
      const key = typeof body["key"] === "string" && body["key"] !== "" ? (body["key"] as string) : `${role}-${round}`;
      const R = role as "extractor" | "planner" | "narrator";
      const out = await deps.agent.role(runId, R, input as never, { round, key });
      if (out.ok === true) {
        writeProofs(out.kind, role, out.model, out.latencyMs, out.usage.totalTokens);
        res.status(200).json({
          ok: true,
          output: out.output,
          model: out.model,
          tokens: out.usage,
          usage: out.usage,
          latencyMs: out.latencyMs,
          kind: out.kind,
          label: out.label,
          rungChanged: false,
        });
      } else {
        res.status(200).json({ ok: false, degraded: out.degraded, kind: out.kind, label: out.label, rungChanged: out.rungChanged });
      }
    } catch (e) {
      next(e);
    }
  });
}

function mountStatus(app: Express, deps: ServerDeps): void {  app.get("/api/status", (req: Request, res: Response, next: NextFunction) => {
    try {
      const sid = typeof req.query["sessionId"] === "string" ? (req.query["sessionId"] as string) : undefined;
      const mode = deps.sessions.ringMode(sid);
      const ring: Record<string, unknown> = { mode };
      const ts = deps.sessions.tokenStatus(sid);
      if (ts.expiresInSec !== null && ts.expiresInSec !== undefined) {
        ring["tokenExpiresInSec"] = ts.expiresInSec;
      }
      const a = deps.agent.state();
      res.json({
        ring,
        agent: { kind: a.kind, label: a.label, model: a.model },
        cost: { usedPct: deps.cost.summary().usedPct },
        inbox: { default: deps.inbox.size("default") },
        build: deps.buildMarker,
      });
    } catch (e) {
      next(e);
    }
  });
}

function mountStatic(app: Express, deps: ServerDeps): void {
  const dir = deps.config.staticDir;
  app.use(express.static(dir, { index: false, maxAge: "1h" }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/") || req.path === "/api") {
      res.status(404).json(errJson(404, "not_found", "Not found."));
      return;
    }
    next();
  });
  app.get("/{*splat}", (req: Request, res: Response, next: NextFunction) => {
    try {
      const p = req.path;
      if (p.startsWith("/api") || p.startsWith("/events") || p.startsWith("/webhooks") || p.startsWith("/health")) {
        res.status(404).json(errJson(404, "not_found", "Not found."));
        return;
      }
      const indexFile = join(dir, "index.html");
      if (existsSync(indexFile)) {
        const html = readFileSync(indexFile, "utf8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
        return;
      }
      res.status(503).type("text/plain").send("The interface has not been built. Run: npm run build");
    } catch (e) {
      next(e);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorMiddleware(deps: ServerDeps) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    err: any,
    _req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
  ): void => {
    try {
      deps.log.error("request_error", { message: err instanceof Error ? err.message : String(err) });
    } catch {
      /* ignore */
    }
    if (res.headersSent) return;
    const status =
      typeof err?.status === "number" && err.status >= 400 && err.status <= 599 ? err.status : 500;
    if (status === 413) {
      res.status(413).json({ ok: false, error: "too large" });
      return;
    }
    if (status !== 500) {
      const code = typeof err?.code === "string" ? err.code : "server_error";
      const message = typeof err?.message === "string" ? err.message : "Something went wrong on the server.";
      res.status(status).json(errJson(status, code, message));
      return;
    }
    res.status(500).json(errJson(500, "server_error", "Something went wrong on the server."));
  };
}

export function createApp(deps: ServerDeps): Express {
  const app = express();
  app.use(requestLogger(deps.log));
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  mountWebhook(app, deps);
  app.use(express.json({ limit: deps.config.bodyLimitKb + "kb" }));
  proofMiddleware(app, deps);
  mountHealth(app, deps);
  mountEvents(app, deps);
  mountRing(app, deps);
  mountAgent(app, deps);
  mountStatus(app, deps);
  mountSimulate(app, deps);
  mountStatic(app, deps);
  app.use(errorMiddleware(deps));
  return app;
}
