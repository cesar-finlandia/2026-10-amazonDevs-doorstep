// scripts/verify/e2e-04-ring.ts — DP-E2E-BROWSER-TESTING WU-E2E-04 (12 checks).
// Requirement IDs: FR-01, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, NFR-01, NFR-12
// Proves each Ring capability ran through the real server code against the
// simulated Ring and was observed in a response, a counter or the page; the
// token never leaks; the one live model path is exercised when a route exists
// and otherwise skipped with a named error.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createChecker } from "./ui-kit.js";
import { run, wrapper } from "./e2e-kit.js";
import { probeBedrock } from "../../e2e/bedrock-probe.js";

const c = createChecker("e2e-04-ring");
const RING = ["e2e/scenarios/s-ring.spec.ts"];
const BEDROCK = ["e2e/scenarios/s-bedrock.spec.ts"];

interface JsonSpec {
  title: string;
}
interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

function collectTitles(node: JsonSuite, acc: string[]): void {
  for (const s of node.specs ?? []) acc.push(s.title);
  for (const sub of node.suites ?? []) collectTitles(sub, acc);
}

function listTitles(files: string[]): string[] {
  const r = run("npx", ["playwright", "test", "--list", "--reporter=json", ...files]);
  const span = r.out.slice(r.out.indexOf("{"), r.out.lastIndexOf("}") + 1);
  const report = JSON.parse(span) as { suites?: JsonSuite[] };
  const titles: string[] = [];
  for (const s of report.suites ?? []) collectTitles(s, titles);
  return titles;
}

// 1. The two files list 10 tests with the ids S-RING-1…9 and S-BEDROCK-1.
const titles = listTitles([...RING, ...BEDROCK]);
const wantIds = [...Array.from({ length: 9 }, (_, i) => `S-RING-${i + 1}`), "S-BEDROCK-1"];
c.ok(
  titles.length === 10 && wantIds.every((id) => titles.some((t) => t.startsWith(id))),
  "the two files list 10 tests with ids S-RING-1…S-RING-9 and S-BEDROCK-1",
);

// 2. The ring file passes whole.
const ring = wrapper("ring", RING, { timeout: 900000 });
c.ok(
  ring.code === 0 && ring.line === "ring: 9 passed, 0 failed, 0 skipped",
  "ring run prints ring: 9 passed, 0 failed, 0 skipped",
);

// 3. The mock saw every mandated path (per-path counts written by the spec:
// per-test fragments merged with the same max rule as the spec's afterAll).
let statsOk = false;
try {
  const { readdirSync } = await import("node:fs");
  const merged: Record<string, number> = {};
  const absorb = (byPath: Record<string, number> | undefined): void => {
    for (const [k, v] of Object.entries(byPath ?? {})) merged[k] = Math.max(merged[k] ?? 0, v);
  };
  try {
    const stats = JSON.parse(readFileSync("e2e/artifacts/ring-stats.json", "utf8")) as {
      byPath?: Record<string, number>;
    };
    absorb(stats.byPath);
  } catch {
    /* the merged file may be absent; fragments still count */
  }
  let frags: string[] = [];
  try {
    frags = readdirSync("e2e/artifacts/ring-stats");
  } catch {
    frags = [];
  }
  for (const f of frags) {
    if (!f.startsWith("frag-") || !f.endsWith(".json")) continue;
    try {
      const frag = JSON.parse(readFileSync(`e2e/artifacts/ring-stats/${f}`, "utf8")) as {
        byPath?: Record<string, number>;
      };
      absorb(frag.byPath);
    } catch {
      /* ignore half-written fragments */
    }
  }
  const fragments = [
    "/v1/devices",
    "/v1/users/me",
    "/v1/history/devices/",
    "whep/sessions",
    "/media/image/download",
    "/media/audio/playback",
    "/v1/accounts/me/app-integrations",
  ];
  statsOk = fragments.every((f) => Object.entries(merged).some(([k, v]) => k.includes(f) && v >= 1));
} catch {
  statsOk = false;
}
c.ok(statsOk, "ring-stats.json counts every mandated path fragment");

// 4. Every S-RING body reads app.stats() or a mock byPath.
const ringText = readFileSync("e2e/scenarios/s-ring.spec.ts", "utf8");
const blocks = ringText.split('test("').slice(1);
const ringBlocks = blocks.filter((b) => /^S-RING-\d/.test(b));
c.ok(
  ringBlocks.length === 9 && ringBlocks.every((b) => b.includes("stats()") || b.includes("byPath")),
  "each of the 9 S-RING bodies scans stats() or byPath",
);

// 5. The mock is the only upstream named.
c.ok(
  !ringText.includes("api.amazonvision.com") && !ringText.includes("oauth.ring.com"),
  "no S-RING test names the live Ring hosts",
);

// 6. No literal secret; the only token literals are the two mock values (plus
// the UI label and the normative §5.3 test title, neither a credential).
// Comments are stripped first so apostrophes in prose cannot merge literals.
const noComments = ringText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const literals: string[] = [];
for (const m of noComments.matchAll(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) literals.push(m[1] as string);
const allowedTokens = new Set([
  '"mock-access-token"',
  '"wrong-token-value"',
  '"Use this token"',
  '"S-RING-4 a token links the live Ring and is never echoed"',
]);
const strayTokens = literals.filter((l) => /token/i.test(l) && !allowedTokens.has(l));
c.ok(
  !/[0-9a-f]{20,}/.test(ringText) && strayTokens.length === 0,
  "no 20-hex string and no token literal besides mock-access-token and wrong-token-value",
);

// 7. S-RING-1 measures the 5 s budget literally.
const sring1 = ringBlocks.find((b) => b.startsWith("S-RING-1")) ?? "";
c.ok(sring1.includes("5000"), "S-RING-1 asserts elapsed time under 5000");

// 8. S-RING-4 scans all five surfaces for the token.
const sring4 = ringBlocks.find((b) => b.startsWith("S-RING-4")) ?? "";
c.ok(
  sring4.includes("outerHTML") &&
    sring4.includes("localStorage") &&
    sring4.includes("sessionStorage") &&
    sring4.includes("console") &&
    sring4.includes("proofLog"),
  "S-RING-4 scans outerHTML, localStorage, sessionStorage, console and the proof log",
);

// 9. The bedrock file passes or skips with a named reason. e2e-run.ts prints
// `SKIP <full title>: <reason>`, so the reason is the text after the first ": ".
const bedrock = wrapper("bedrock", BEDROCK, { timeout: 900000 });
const skipLines = bedrock.out
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.startsWith("SKIP S-BEDROCK-1 "));
const skipReason =
  skipLines.length === 1 && (skipLines[0] as string).includes(": ")
    ? (skipLines[0] as string).slice((skipLines[0] as string).indexOf(": ") + 2)
    : null;
c.ok(
  bedrock.line === "bedrock: 1 passed, 0 failed, 0 skipped" ||
    (bedrock.line === "bedrock: 0 passed, 0 failed, 1 skipped" &&
      skipReason !== null &&
      skipReason.length > 0),
  "bedrock run passes or skips S-BEDROCK-1 with a non-empty named reason",
);

// 10. probeBedrock() never throws: an invalid region resolves to a named error.
let invalidOk = false;
try {
  const bad = await probeBedrock({ ...process.env, AWS_REGION: "xx-invalid-9" });
  invalidOk = !bad.available && /^[A-Za-z]+: /.test(bad.error);
} catch {
  invalidOk = false;
}
c.ok(invalidOk, "probeBedrock with an invalid region resolves to { available: false, error }");

// 11. The ring probe skips without a credential (exact line).
const cleanEnv: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined) cleanEnv[k] = v;
}
delete cleanEnv["RING_ACCESS_TOKEN"];
const probeRun = spawnSync("npx", ["vite-node", "scripts/e2e-ring-probe.ts"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: true,
  timeout: 120000,
  env: cleanEnv,
});
const probeOut = `${probeRun.stdout ?? ""}${probeRun.stderr ?? ""}`.trim();
c.ok(
  (probeRun.status ?? 1) === 0 && probeOut === "ring-probe: skipped (RING_ACCESS_TOKEN not set)",
  "ring-probe without a token prints exactly the skip line",
);

// 12. The probe result line; when unavailable it repeats the skip reason.
const probe = await probeBedrock();
const probeLine = probe.available ? "bedrock-probe: available" : `bedrock-probe: unavailable (${probe.error})`;
c.ok(
  (probe.available && bedrock.line === "bedrock: 1 passed, 0 failed, 0 skipped") ||
    (!probe.available && probe.error.length > 0 && skipReason !== null && probe.error === skipReason),
  "bedrock-probe line repeats the skipped S-BEDROCK-1 reason when unavailable",
);

console.log(probeLine);
console.log(ring.line);
for (const s of skipLines) console.log(s);
console.log(bedrock.line);
c.done();
