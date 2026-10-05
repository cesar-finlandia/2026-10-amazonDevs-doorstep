// Requirement IDs: FR-24, NFR-01
// WU-API-TRANSPORT-01: app shell, /health, logging without secrets.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadServerConfig } from "src/server/config.js";
import { createLogger, redact } from "src/server/logger.js";
import { createProofLog } from "src/server/proof.js";
import { createEventHub } from "src/server/events.js";
import { api, createChecker, startTestServer } from "./at-kit.js";

const check = createChecker("at-01-app");

// 1
{
  const c = loadServerConfig({ env: {} });
  check.ok(
    c.port === 8080 && c.eventsKeep === 500 && c.ringDegradeAfter === 2 && c.proofLog === "logs/proof.log",
    "1 defaults",
  );
}
// 2
{
  const a = loadServerConfig({ env: { PORT: "9090" } });
  const b = loadServerConfig({ env: { PORT: "abc" } });
  const c = loadServerConfig({ env: { PORT: "70000" } });
  check.ok(a.port === 9090 && b.port === 8080 && c.port === 8080, "2 PORT override");
}
// 3
{
  let cfg = null as null | ReturnType<typeof loadServerConfig>;
  let threw = false;
  try {
    cfg = loadServerConfig({ path: "does-not-exist.json", env: {} });
  } catch {
    threw = true;
  }
  check.ok(!threw && cfg !== null && cfg.port === 8080, "3 missing file");
}
// 4
check.ok(
  redact("x Bearer abc.def-1 y sha256=0123456789abcdef0123 z") === "x Bearer [redacted] y sha256=[redacted] z",
  "4 bearer+sha",
);
// 5
check.ok(
  redact("tok-SECRET-9 here", ["tok-SECRET-9"]) === "[redacted] here" &&
    redact("ab cd", ["ab"]) === "ab cd",
  "5 secrets",
);
// 6
{
  const lines: string[] = [];
  const log = createLogger({ write: (l) => lines.push(l) });
  log.info("hello", { auth: "Bearer abc123" });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(lines[0] as string) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  check.ok(
    typeof parsed["t"] === "string" &&
      parsed["level"] === "info" &&
      typeof parsed["msg"] === "string" &&
      typeof parsed["auth"] === "string" &&
      (parsed["auth"] as string).includes("Bearer [redacted]"),
    "6 logger line",
  );
}
// 7
{
  const lines: string[] = [];
  let current: string[] = [];
  const log = createLogger({ write: (l) => lines.push(l), secrets: () => current });
  log.info("first tok-none-here");
  current = ["newsecret-77"];
  log.info("second newsecret-77 here");
  check.ok(
    lines.length === 2 && (lines[1] as string).includes("[redacted]") && !(lines[1] as string).includes("newsecret-77"),
    "7 secrets thunk",
  );
}
// 8
{
  const dir = mkdtempSync(join(tmpdir(), "at01-"));
  const proof = createProofLog({ path: join(dir, "proof.log") });
  proof("api-ring", "live", "listDevices ok 12ms");
  const content = readFileSync(proof.path, "utf8").trim();
  check.ok(
    /^\d{4}-\d\d-\d\dT[\d:.]+Z proof edge=api-ring mode=live listDevices ok 12ms$/.test(content) &&
      proof.lineCount() === 1,
    "8 proof line",
  );
}
// 9
{
  const dir = mkdtempSync(join(tmpdir(), "at01-"));
  const proof = createProofLog({ path: join(dir, "proof.log") });
  proof("api-ring", "live", "a\n".padEnd(50, "x") + "y".repeat(200));
  const content = readFileSync(proof.path, "utf8");
  const lines = content.split("\n").filter((l) => l.length > 0);
  const textPart = (lines[0] as string).split("mode=live ")[1] ?? "";
  check.ok(lines.length === 1 && textPart.length <= 120, "9 proof flatten+cut");
}
// 10
{
  const dir = mkdtempSync(join(tmpdir(), "at01-"));
  const proof = createProofLog({ path: join(dir, "proof.log") });
  proof("api-ring", "live", "call with Bearer zzz-token-9");
  const content = readFileSync(proof.path, "utf8");
  check.ok(content.includes("Bearer [redacted]"), "10 proof redact");
}

const sessionsStub = { ringMode: (): "bundle" => "bundle" };
const agentStub = {
  state: (): { kind: "bedrock"; label: string; model: string; rung: "bedrock" } => ({
    kind: "bedrock",
    label: "test",
    model: "test",
    rung: "bedrock",
  }),
};

const lines: string[] = [];
const capLog = createLogger({ write: (l) => lines.push(l) });
const srv = await startTestServer({
  env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
  overrides: {
    log: capLog,
    hub: createEventHub({ keep: 500 }),
    sessions: sessionsStub as never,
    agent: agentStub as never,
  },
});
try {
  // 11
  {
    const r = await api(srv.url, "GET", "/health");
    const j = r.json as Record<string, unknown>;
    check.ok(
      r.status === 200 &&
        j["ok"] === true &&
        j["build"] === "test-1" &&
        j["mode"] === "bundle" &&
        typeof j["provider"] === "string" &&
        Number.isInteger(j["uptimeSec"]) &&
        (j["uptimeSec"] as number) >= 0,
      "11 health",
    );
  }
  // 12
  {
    const r = await api(srv.url, "GET", "/health");
    check.ok(r.headers.get("x-content-type-options") === "nosniff", "12 nosniff");
  }
  // 13
  {
    const r = await api(srv.url, "GET", "/api/nothing");
    const j = r.json as { ok?: boolean; error?: { code?: string } };
    check.ok(r.status === 404 && j.ok === false && j.error?.code === "not_found", "13 unknown api");
  }
  // 14
  {
    const emptyDir = mkdtempSync(join(tmpdir(), "at01-"));
    const fullDir = mkdtempSync(join(tmpdir(), "at01-"));
    writeFileSync(join(fullDir, "index.html"), "<html>MARK-7</html>");
    const s1 = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      config: { staticDir: emptyDir },
      overrides: {
        hub: createEventHub(),
        sessions: sessionsStub as never,
        agent: agentStub as never,
      },
    });
    const r1 = await fetch(s1.url + "/watch");
    const t1 = await r1.text();
    const s2 = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      config: { staticDir: fullDir },
      overrides: {
        hub: createEventHub(),
        sessions: sessionsStub as never,
        agent: agentStub as never,
      },
    });
    const r2 = await fetch(s2.url + "/watch");
    const t2 = await r2.text();
    const ok1 = r1.status === 503 && t1.includes("npm run build");
    const ok2 = r2.status === 200 && t2.includes("MARK-7") && (r2.headers.get("cache-control") ?? "").includes("no-cache");
    await s1.close();
    await s2.close();
    check.ok(ok1 && ok2, "14 static fallback");
  }
  // 15
  {
    const throwingHub = {
      snapshot: (): never => {
        throw new Error("boom");
      },
      stream: (): void => undefined,
      publish: async (): Promise<boolean> => true,
      connections: (): number => 0,
      close: async (): Promise<void> => undefined,
    };
    const s = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      overrides: {
        hub: throwingHub as never,
        sessions: sessionsStub as never,
        agent: agentStub as never,
      },
    });
    const r = await api(s.url, "GET", "/events");
    const j = r.json as { ok?: boolean; error?: { code?: string; message?: string } };
    const bodyText = JSON.stringify(r.json);
    await s.close();
    check.ok(
      r.status === 500 &&
        j.ok === false &&
        j.error?.code === "server_error" &&
        j.error?.message === "Something went wrong on the server." &&
        !bodyText.includes(" at "),
      "15 events error",
    );
  }
  // 16
  {
    lines.length = 0;
    await api(srv.url, "GET", "/health?secret=abc");
    await new Promise((r) => setTimeout(r, 50));
    const found = lines.find((l) => l.includes('"/health"') || l.includes("/health"));
    check.ok(
      typeof found === "string" && found.includes("/health") && !found.includes("abc"),
      "16 request log",
    );
  }
  // 17
  {
    const s = await startTestServer({
      env: { NODE_ENV: "test", BUILD_MARKER: "test-1" },
      overrides: {
        hub: createEventHub(),
        sessions: sessionsStub as never,
        agent: agentStub as never,
      },
    });
    const u = new URL(s.url);
    const portOk = u.port !== "" && u.port !== "0";
    await s.close();
    let rejected = false;
    try {
      await fetch(s.url + "/health");
    } catch {
      rejected = true;
    }
    check.ok(portOk && rejected, "17 ephemeral+close");
  }
  // 18
  {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    check.ok(
      pkg.dependencies?.["express"] === "5.2.1" &&
        typeof pkg.scripts?.["server"] === "string" &&
        typeof pkg.scripts?.["server:dev"] === "string" &&
        typeof pkg.scripts?.["verify:api"] === "string",
      "18 package",
    );
  }
} finally {
  await srv.close();
}

check.done();
