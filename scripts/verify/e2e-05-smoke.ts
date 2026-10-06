// scripts/verify/e2e-05-smoke.ts — DP-E2E-BROWSER-TESTING WU-E2E-05 (12 checks).
// Requirement IDs: FR-24, FR-06, FR-07, FR-09
// Proves one thin path is alive and doing real work against any URL and a
// real run meets the depth bar judged from its own trace.
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChecker } from "./ui-kit.js";
import { run, wrapper } from "./e2e-kit.js";
import { startServer } from "../../src/server/start.js";
import { createMockRingServer } from "../../scripts/mock-ring-server.js";
import { randomSecret } from "../../e2e/helpers.js";

const c = createChecker("e2e-05-smoke");

const SMOKE_TITLES = [
  "SMOKE-1 health answers with a build marker",
  "SMOKE-2 the home page loads clean",
  "SMOKE-3 a week review runs to the end",
  "SMOKE-4 the three routes render",
];
const DEPTH_TITLE = "DEPTH-1 one run of the core demo meets the depth bar";
const TRACE_PATH = "e2e/artifacts/run-trace.json";
const FORBIDDEN = ["app.ring", "app.secrets", "app.stats", "mock-ring-server", "signPayload"];

function listTitles(files: string[]): string[] {
  const r = run("npx", ["playwright", "test", ...files, "--list"]);
  if (r.code !== 0) return [];
  return r.out
    .split("\n")
    .filter((l) => l.includes("›"))
    .map((l) => ((l.split("›").pop() as string) ?? "").trim())
    .filter((t) => t.length > 0);
}

interface JsonTest {
  annotations: { type: string; description?: string }[];
}
interface JsonSpec {
  title: string;
  tests: JsonTest[];
}
interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

function smoke3Annotations(): { rung: boolean; ring: boolean } {
  try {
    const report = JSON.parse(readFileSync("e2e/artifacts/report.json", "utf8")) as {
      suites?: JsonSuite[];
    };
    const specs: JsonSpec[] = [];
    const walk = (node: JsonSuite): void => {
      for (const s of node.specs ?? []) specs.push(s);
      for (const sub of node.suites ?? []) walk(sub);
    };
    for (const s of report.suites ?? []) walk(s);
    const smoke3 = specs.find((s) => s.title.startsWith("SMOKE-3"));
    const types = (smoke3?.tests ?? []).flatMap((t) => t.annotations.map((a) => a.type));
    return { rung: types.includes("rung"), ring: types.includes("ring") };
  } catch {
    return { rung: false, ring: false };
  }
}

// 1. The smoke file lists exactly the four §3.7 titles.
const smokeTitles = listTitles(["e2e/smoke.spec.ts"]);
c.ok(
  smokeTitles.length === 4 && SMOKE_TITLES.every((t) => smokeTitles.includes(t)),
  `--list of e2e/smoke.spec.ts shows exactly the four §3.7 titles (got ${JSON.stringify(smokeTitles)})`,
);

// 2. The smoke file prints its base URL and never touches the simulated Ring.
const smokeText = readFileSync("e2e/smoke.spec.ts", "utf8");
c.ok(
  smokeText.includes("smoke: base") && FORBIDDEN.every((s) => !smokeText.includes(s)),
  "smoke.spec.ts prints smoke: base and holds no app.ring/app.secrets/app.stats/mock-ring-server/signPayload",
);

// 3. The smoke run is green against the local server.
const smoke = wrapper("smoke", ["e2e/smoke.spec.ts"]);
c.ok(
  smoke.code === 0 &&
    smoke.line === "smoke: 4 passed, 0 failed, 0 skipped" &&
    smoke.out.includes("smoke: base http://127.0.0.1:"),
  "smoke run prints smoke: 4 passed, 0 failed, 0 skipped with a smoke: base http://127.0.0.1: line",
);

// Capture the SMOKE-3 annotations now: later runs overwrite report.json.
const ann = smoke3Annotations();

// 4 + 10 share one second server with the golden provider, mirroring the app
// fixture environment; BASE_URL must flow through e2e-run into Playwright.
const secrets = { webhook: randomSecret(), hmac: randomSecret() };
const ring = await createMockRingServer({ webhookSecret: secrets.webhook });
const proofLog = join(tmpdir(), `e2e-05-${randomSecret(4)}-proof.log`);
const second = await startServer({
  port: 0,
  config: { staticDir: "dist", proofLog },
  env: {
    NODE_ENV: "test",
    AGENT_PROVIDER: "golden",
    BUILD_MARKER: "e2e-1",
    ALLOW_SIMULATE: "1",
    RING_WEBHOOK_SECRET: secrets.webhook,
    RING_HMAC_KEY: secrets.hmac,
  },
  ringBaseUrl: ring.url,
  oauthUrl: ring.oauthUrl,
});
let smokeBase = { code: -1, out: "", line: "" };
let depthBase = { code: -1, out: "", line: "" };
try {
  // 4. Against BASE_URL no local server starts (app.local is false).
  smokeBase = wrapper("smoke", ["e2e/smoke.spec.ts"], { env: { BASE_URL: second.url } });
  c.ok(
    smokeBase.code === 0 &&
      smokeBase.line === "smoke: 4 passed, 0 failed, 0 skipped" &&
      smokeBase.out.includes(`smoke: base ${second.url}`) &&
      smokeBase.out.includes("smoke: local false"),
    `BASE_URL smoke run prints smoke: 4 passed with smoke: base ${second.url} and smoke: local false`,
  );

  // 5. A dead URL fails SMOKE-1 and exits 1.
  const dead = wrapper("smoke", ["e2e/smoke.spec.ts"], { env: { BASE_URL: "http://127.0.0.1:1" } });
  c.ok(
    dead.code === 1 && dead.out.includes("FAIL SMOKE-1"),
    "dead BASE_URL exits 1 with a FAIL SMOKE-1 line",
  );

  // 6. SMOKE-3 annotates which rung and which Ring answered.
  c.ok(
    ann.rung && ann.ring,
    `SMOKE-3 leaves rung+ring annotations in the JSON report (got rung=${ann.rung} ring=${ann.ring})`,
  );

  // 7. The depth file lists exactly DEPTH-1.
  const depthTitles = listTitles(["e2e/depth.spec.ts"]);
  c.ok(
    depthTitles.length === 1 && depthTitles[0] === DEPTH_TITLE,
    `--list of e2e/depth.spec.ts shows one test titled ${DEPTH_TITLE}`,
  );

  // 8. The depth run is green against the local server.
  const depth = wrapper("depth", ["e2e/depth.spec.ts"]);
  c.ok(
    depth.code === 0 && depth.line === "depth: 1 passed, 0 failed, 0 skipped",
    "depth run prints depth: 1 passed, 0 failed, 0 skipped",
  );

  // 9. The run wrote a trace that the chassis validator accepts.
  const validated =
    existsSync(TRACE_PATH) &&
    (() => {
      const v = run("npx", [
        "vite-node",
        "hee/scripts/hee-validate-run-trace.ts",
        TRACE_PATH,
        "--min-roles",
        "4",
        "--min-actions",
        "15",
        "--require-verify-repair",
        "--require-human-checkpoint",
      ]);
      return v.code === 0 && v.out.includes("trace ok:");
    })();
  c.ok(validated, "run-trace.json exists and the validator prints a trace ok: line");

  // 10. The depth file honours BASE_URL and passes against the second server.
  const depthText = readFileSync("e2e/depth.spec.ts", "utf8");
  depthBase = wrapper("depth", ["e2e/depth.spec.ts"], { env: { BASE_URL: second.url } });
  c.ok(
    depthText.includes("depth: base") &&
      FORBIDDEN.every((s) => !depthText.includes(s)) &&
      depthBase.code === 0 &&
      depthBase.line === "depth: 1 passed, 0 failed, 0 skipped",
    "depth.spec.ts prints depth: base, touches no simulated Ring, and the BASE_URL depth run prints depth: 1 passed",
  );

  // 11. The depth test compares the trace's action count with the feed rows.
  c.ok(
    depthText.includes("traceActions") &&
      depthText.includes("feedRows") &&
      depthText.includes("activity-feed") &&
      depthText.includes("entries.length") &&
      depthText.includes("toBe("),
    "depth.spec.ts reads the trace action count and the feed row count and asserts equality",
  );

  // 12. The smoke gate is wired into the scripts and the strategy.
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  const strategy = readFileSync("design_documents/e2e-testing/strategy.md", "utf8");
  const gateNamed =
    strategy.includes("e2e/smoke.spec.ts") &&
    strategy.includes("DP-DEPLOY") &&
    strategy.includes("DP-SCRIPT") &&
    strategy.includes("DP-LIVE-RUN-AND-VIDEO");
  c.ok(
    pkg.scripts["e2e:smoke"] === "playwright test e2e/smoke.spec.ts" && gateNamed,
    "package.json e2e:smoke is exact and strategy.md names e2e/smoke.spec.ts as the DP-DEPLOY/DP-SCRIPT/DP-LIVE-RUN-AND-VIDEO gate",
  );
} finally {
  await second.close();
  await ring.close();
}

c.done();
