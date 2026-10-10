// scripts/verify/dp-04-deploy.ts — DP-DEPLOY WU-DEPLOY-04 (10 checks).
// Requirement IDs: FR-24
// LOW-COST DEVIATION: check 8 asserts minScale 0 / maxScale 1 (plan: 1 / 1).
// When cloud access is missing the script prints BLOCKED and exits 3.
import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createChecker } from "./at-kit.js";
import { run } from "./e2e-kit.js";
import { loadDeployConfig } from "../lib/deploy-plan.js";

const c = createChecker("dp-04-deploy");
const { cfg, project, region } = loadDeployConfig({ env: {} });
const recDir = process.env[cfg.record.dirEnv] ?? cfg.record.defaultDir;
const recPath = joinRec(recDir);

function joinRec(dir: string): string {
  return dir.endsWith(sep) ? `${dir}deploy-record.json` : `${dir}${sep}deploy-record.json`;
}

if (!existsSync(recPath)) {
  console.log(`dp-04-deploy: BLOCKED (no deploy record at ${recPath}: run the deploy first)`);
  process.exit(3);
}
const rec = JSON.parse(readFileSync(recPath, "utf8")) as Record<string, unknown>;
const url = rec["url"] as string;

// 1. Record outside the repository.
const root = resolve(process.cwd());
const recAbs = resolve(recPath);
c.ok(!recAbs.startsWith(root + sep) && !recAbs.startsWith(root + "/"), `record outside repo (${recPath})`);

// 2. Record shape: https URL, marker, service, recent date.
const ageOk = (() => {
  try { return Date.now() - Date.parse(rec["deployedAt"] as string) < 24 * 3600 * 1000; } catch { return false; }
})();
c.ok(
  typeof url === "string" && url.startsWith("https://") &&
    typeof rec["buildMarker"] === "string" && (rec["buildMarker"] as string).length > 0 &&
    rec["service"] === "doorstep-rhythm" && ageOk,
  "record has https url, buildMarker, service, deployedAt <24h",
);

async function get(path: string, timeoutMs = 15000): Promise<{ status: number; text: string; headers: Headers }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url + path, { signal: ctl.signal });
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  } finally {
    clearTimeout(t);
  }
}

// 3. /health carries the record's build marker, no login.
const health = await get("/health");
let healthOk = false;
try {
  const j = JSON.parse(health.text) as { ok?: boolean; build?: string };
  healthOk = health.status === 200 && j.ok === true && j.build === rec["buildMarker"];
} catch { healthOk = false; }
c.ok(healthOk, `GET /health 200 ok:true build=${rec["buildMarker"]}`);

// 4. / serves HTML.
const home = await get("/");
c.ok(home.status === 200 && home.text.includes("<div id=\"root\""), "GET / 200 with app mount");

// 5. /watch + /lab SPA fallback HTML.
const watch = await get("/watch");
const lab = await get("/lab");
c.ok(watch.status === 200 && watch.text.includes("<div") && lab.status === 200 && lab.text.includes("<div"), "/watch + /lab 200 HTML");

// 6. /api/status has ring.mode + agent.kind.
let statusOk = false;
try {
  const j = JSON.parse((await get("/api/status")).text) as { ring?: { mode?: string }; agent?: { kind?: string } };
  statusOk = typeof j.ring?.mode === "string" && typeof j.agent?.kind === "string";
} catch { statusOk = false; }
c.ok(statusOk, "/api/status has ring.mode + agent.kind");

// 7. SSE stream answers within 8 s with event-stream content type.
// (fetch resolves on response headers; the infinite body is cancelled, never read.)
let sseOk = false;
try {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${url}/events/stream`, { signal: ctl.signal });
    const ct = res.headers.get("content-type") ?? "";
    sseOk = res.ok && ct.startsWith("text/event-stream");
    const body = res.body as { cancel?: () => Promise<void> } | null;
    try { await body?.cancel?.(); } catch { /* ignore */ }
  } catch { sseOk = false; } finally { clearTimeout(t); }
} catch { sseOk = false; }
c.ok(sseOk, "/events/stream answers text/event-stream within 8 s");

// 8. Exactly the low-cost scale: maxScale 1, minScale 0 (Cloud Run omits
// the minScale annotation when it is 0, the default — absent counts as 0).
const desc = run("gcloud", ["run", "services", "describe", "doorstep-rhythm", "--region", region, "--project", project, "--format=json"]);
let scaleOk = false;
try {
  const j = JSON.parse(desc.out) as { spec?: { template?: { metadata?: { annotations?: Record<string, string> } } } };
  const ann = j.spec?.template?.metadata?.annotations ?? {};
  const min = ann["autoscaling.knative.dev/minScale"] ?? "0";
  scaleOk = desc.code === 0 && min === "0" && ann["autoscaling.knative.dev/maxScale"] === "1";
} catch { scaleOk = false; }
c.ok(scaleOk, "service minScale 0 (absent) / maxScale 1");

// 9. Chassis health poll passes.
const smoke = run("npm", ["run", "deploy:verify"], { env: { PUBLIC_URL: url } });
c.ok(smoke.code === 0 && smoke.out.split("\n").some((l) => l.trim().startsWith("PASS ")), "deploy:verify prints PASS");

// 10. Record holds no secret value, hex blob or Bearer. (The sha256 image
// digest required by §5.5 is 64 hex by construction, so it is excluded from
// the scan — the check proves no OTHER 20-hex blob, i.e. no secret, is stored.)
const recCopy = { ...rec } as Record<string, unknown>;
delete recCopy["digest"];
const recText = JSON.stringify(recCopy);
c.ok(!/[0-9a-f]{20}/.test(recText) && !recText.includes("Bearer "), "record has no secret value");

c.done();
