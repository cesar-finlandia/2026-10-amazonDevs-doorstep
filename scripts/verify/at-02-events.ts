// Requirement IDs: FR-09, FR-21
// WU-API-TRANSPORT-02: event hub, /events, /events/stream.
import { get } from "node:http";
import { createEventHub } from "src/server/events.js";
import { api, createChecker, startTestServer } from "./at-kit.js";

const check = createChecker("at-02-events");

interface StreamClient {
  chunks: string[];
  ended: boolean;
  destroy(): void;
  closed: Promise<void>;
}

function openStream(url: string): { client: StreamClient; ready: Promise<{ status: number; headers: Record<string, string> }> } {
  const chunks: string[] = [];
  let destroyFn: () => void = () => undefined;
  let endResolve: () => void = () => undefined;
  const closed = new Promise<void>((r) => {
    endResolve = r;
  });
  let ended = false;
  const ready = new Promise<{ status: number; headers: Record<string, string> }>((resolve, reject) => {
    const req = get(url, (res) => {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (typeof v === "string") headers[k.toLowerCase()] = v;
        else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(", ");
      }
      res.setEncoding("utf8");
      res.on("data", (c: string) => chunks.push(c));
      res.on("end", () => {
        ended = true;
        endResolve();
      });
      res.on("close", () => {
        ended = true;
        endResolve();
      });
      destroyFn = (): void => {
        try {
          res.destroy();
        } catch {
          /* ignore */
        }
        try {
          req.destroy();
        } catch {
          /* ignore */
        }
      };
      resolve({ status: res.statusCode ?? 0, headers });
    });
    req.on("error", reject);
  });
  const client: StreamClient = {
    chunks,
    get ended(): boolean {
      return ended;
    },
    destroy: (): void => destroyFn(),
    closed,
  };
  return { client, ready };
}

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return cond();
}

function framesOf(chunks: string[]): string[] {
  return chunks.join("").split("\n\n").filter((f) => f.includes("event: envelope"));
}

function parseFrame(frame: string): { id: string; data: Record<string, unknown> } | null {
  const idM = /^id: (.*)$/m.exec(frame);
  const dataM = /^data: (.*)$/m.exec(frame);
  if (!idM || !dataM) return null;
  try {
    return { id: idM[1] as string, data: JSON.parse(dataM[1] as string) as Record<string, unknown> };
  } catch {
    return null;
  }
}

// 1
{
  const hub = createEventHub();
  const r = await hub.publish("ring-webhook", "done", { requestId: "r1" });
  const s = hub.snapshot();
  check.ok(
    r === true &&
      s.events.length === 1 &&
      (s.events[0] as { step_id?: string }).step_id === "ring-webhook" &&
      s.events[0]?.status === "done" &&
      (s.events[0]?.payload as Record<string, unknown>)["requestId"] === "r1",
    "1 publish+snapshot",
  );
  await hub.close();
}
// 2
{
  const hub = createEventHub();
  await hub.publish("ring-webhook", "done", { requestId: "r1" });
  const before = hub.snapshot().events.length;
  const r = await hub.publish("Bad_Id", "done");
  check.ok(r === false && hub.snapshot().events.length === before, "2 bad step id");
  await hub.close();
}
// 3
{
  const hub = createEventHub();
  await hub.publish("ring-webhook", "done", {});
  const d0 = hub.snapshot().degraded;
  await hub.publish("system-degraded", "done", {}, { degraded: true });
  check.ok(d0 === false && hub.snapshot().degraded === true, "3 degraded flag");
  await hub.close();
}
// 4
{
  const hub = createEventHub({ keep: 3 });
  for (let n = 0; n < 5; n++) await hub.publish("agent-step", "done", { n });
  const ev = hub.snapshot().events;
  const ns = ev.map((e) => (e.payload as Record<string, unknown>)["n"]);
  const seqs = ev.map((e) => e.sequence);
  check.ok(
    JSON.stringify(ns) === JSON.stringify([2, 3, 4]) && seqs[0]! < seqs[1]! && seqs[1]! < seqs[2]!,
    "4 keep window",
  );
  await hub.close();
}

const sessionsStub = { ringMode: (): "bundle" => "bundle" };
const agentStub = {
  state: () => ({ kind: "bedrock", label: "t", model: "t", rung: "bedrock" }) as const,
};
const srv = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: { sessions: sessionsStub as never, agent: agentStub as never },
});
try {
  // 5
  {
    const r = await api(srv.url, "GET", "/events");
    const j = r.json as { events?: unknown; degraded?: unknown };
    check.ok(
      r.status === 200 &&
        Array.isArray(j.events) &&
        typeof j.degraded === "boolean" &&
        (r.headers.get("cache-control") ?? "").includes("no-store"),
      "5 get events",
    );
  }
  const { client: c1, ready: ready1 } = openStream(srv.url + "/events/stream");
  const h1 = await ready1;
  // 6
  {
    const first = await waitFor(() => c1.chunks.join("").includes(": connected"), 1000);
    check.ok(
      h1.status === 200 &&
        (h1.headers["content-type"] ?? "").startsWith("text/event-stream") &&
        (h1.headers["x-accel-buffering"] ?? "") === "no" &&
        first,
      "6 stream headers",
    );
  }
  // 7
  {
    await srv.deps.hub.publish("agent-rung", "done", { kind: "golden", label: "Recorded run", model: "recorded" });
    const got = await waitFor(
      () =>
        framesOf(c1.chunks).some((f) => {
          const p = parseFrame(f);
          return p !== null && (p.data as { step_id?: string }).step_id === "agent-rung";
        }),
      1000,
    );
    check.ok(got, "7 agent-rung frame");
  }
  // 8
  {
    const frames = framesOf(c1.chunks);
    const parsed = frames.map(parseFrame).filter((p) => p !== null);
    const match = parsed.find((p) => (p!.data as { step_id?: string }).step_id === "agent-rung");
    check.ok(
      match !== undefined && match.id === String((match.data as { sequence?: unknown }).sequence),
      "8 frame id",
    );
  }
  // 9
  {
    const one = srv.deps.hub.connections() === 1;
    c1.destroy();
    const zero = await waitFor(() => srv.deps.hub.connections() === 0, 1000);
    check.ok(one && zero, "9 connections");
  }
  // 11 (three clients, before 10/12 so the hub is alive)
  const { client: cA, ready: rA } = openStream(srv.url + "/events/stream");
  const { client: cB, ready: rB } = openStream(srv.url + "/events/stream");
  const { client: cC, ready: rC } = openStream(srv.url + "/events/stream");
  await Promise.all([rA, rB, rC]);
  await waitFor(() => cA.chunks.join("").includes(": connected") && cB.chunks.join("").includes(": connected") && cC.chunks.join("").includes(": connected"), 1000);
  const mark = cA.chunks.join("").length + cB.chunks.join("").length + cC.chunks.join("").length;
  void mark;
  {
    const beforeA = framesOf(cA.chunks).length;
    void beforeA;
    await srv.deps.hub.publish("agent-rung", "done", { kind: "manual", label: "Manual", model: "manual", n: "fanout-1" });
    const okAll = await waitFor(
      () =>
        framesOf(cA.chunks).some((f) => f.includes("fanout-1")) &&
        framesOf(cB.chunks).some((f) => f.includes("fanout-1")) &&
        framesOf(cC.chunks).some((f) => f.includes("fanout-1")),
      1000,
    );
    check.ok(okAll, "11 fanout three");
  }
  // 13 (dedicated server: first client sees every publish)
  {
    const s3 = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      overrides: { sessions: sessionsStub as never, agent: agentStub as never },
    });
    const { client: c0, ready: r0 } = openStream(s3.url + "/events/stream");
    await r0;
    await waitFor(() => c0.chunks.join("").includes(": connected"), 1000);
    await s3.deps.hub.publish("agent-rung", "done", { k: "e13-1" });
    await s3.deps.hub.publish("agent-rung", "done", { k: "e13-2" });
    await waitFor(() => framesOf(c0.chunks).length >= 2, 1000);
    const got = await api(s3.url, "GET", "/events");
    const j = got.json as { events?: unknown[] };
    const count = Array.isArray(j.events) ? j.events.length : -1;
    const firstReceived = framesOf(c0.chunks).length;
    c0.destroy();
    await s3.close().catch(() => undefined);
    check.ok(count === firstReceived && count === 2, "13 poll equals stream");
  }
  // 10 (separate hub with fast keepalive)
  {
    const { createEventHub: makeHub } = await import("src/server/events.js");
    const fast = makeHub({ keepaliveMs: 50 });
    const s2 = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      overrides: { hub: fast as never, sessions: sessionsStub as never, agent: agentStub as never },
    });
    const { client: ck, ready: rk } = openStream(s2.url + "/events/stream");
    await rk;
    const seen = await waitFor(() => ck.chunks.join("").includes(": keepalive"), 500);
    ck.destroy();
    await s2.close();
    check.ok(seen, "10 keepalive");
  }
  // 12
  {
    const pA = cA.closed;
    const pB = cB.closed;
    const pC = cC.closed;
    await srv.deps.hub.close();
    const doneAll = await Promise.race([
      Promise.all([pA, pB, pC]).then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 1000)),
    ]);
    check.ok(doneAll, "12 close ends streams");
    cA.destroy();
    cB.destroy();
    cC.destroy();
  }
} finally {
  await srv.close().catch(() => undefined);
}

check.done();
