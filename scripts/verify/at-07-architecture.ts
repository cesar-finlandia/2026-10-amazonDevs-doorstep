// Requirement IDs: FR-24
// WU-API-TRANSPORT-07: architecture skeleton and proof harvest.
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createProofLog } from "src/server/proof.js";
import { harvest } from "../harvest-architecture-proofs.js";
import { createChecker } from "./at-kit.js";

const check = createChecker("at-07-architecture");

function makeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "at07-"));
  mkdirSync(join(dir, "config"), { recursive: true });
  mkdirSync(join(dir, "logs"), { recursive: true });
  copyFileSync(join("architecture.json"), join(dir, "architecture.json"));
  copyFileSync(join("config", "architecture-proofs.json"), join(dir, "config", "architecture-proofs.json"));
  const proof = createProofLog({ path: join(dir, "logs", "proof.log") });
  proof("ui-api", "server", "POST /api/ring/listDevices 200 3ms");
  proof("api-ring", "live", "listDevices ok 3ms");
  proof("api-inbox", "live", "webhook motion_detected accepted req-0001");
  proof("api-bedrock", "bedrock", "extractor stub-model 7ms 30 tokens");
  proof("api-cache", "golden", "replayed extractor from the recorded run");
  proof("api-cost", "sidecar", "used 0% of the token budget (0 tokens)");
  return dir;
}

function lint(dir: string): { status: number; out: string } {
  const r = spawnSync("node", ["..\\..\\hackathons\\scripts\\lint-architecture.ts", dir], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const kebab = /^[a-z0-9][a-z0-9-]*$/;
const arch = JSON.parse(readFileSync("architecture.json", "utf8")) as {
  lanes?: string[];
  nodes?: { id?: string; label?: string; lane?: string; sponsor?: boolean }[];
  edges?: { id?: string; from?: string; to?: string; label?: string; proof?: unknown }[];
};
const cfg = JSON.parse(readFileSync(join("config", "architecture-proofs.json"), "utf8")) as Record<string, { accept?: string[] }>;

// 1
{
  const ids = [...(arch.nodes ?? []).map((n) => n.id), ...(arch.edges ?? []).map((e) => e.id)];
  check.ok(
    (arch.nodes ?? []).length === 8 && (arch.edges ?? []).length === 7 &&
      ids.every((id) => typeof id === "string" && kebab.test(id)),
    "1 skeleton shape",
  );
}
// 2
{
  const labels = [...(arch.nodes ?? []).map((n) => n.label ?? ""), ...(arch.edges ?? []).map((e) => e.label ?? "")];
  check.ok(
    labels.every((l) => l.length <= 22) &&
      (arch.nodes ?? []).every((n) => !n.lane || (arch.lanes ?? []).includes(n.lane)),
    "2 labels+lanes",
  );
}
// 3
{
  const sponsors = (arch.nodes ?? []).filter((n) => n.sponsor).map((n) => n.id).sort();
  check.ok(JSON.stringify(sponsors) === JSON.stringify(["bedrock", "ring"]), "3 sponsors");
}
// 4
check.ok((arch.edges ?? []).every((e) => e.proof === undefined), "4 no proofs shipped");
// 5
{
  const edgeIds = new Set((arch.edges ?? []).map((e) => e.id));
  check.ok(Object.keys(cfg).every((k) => edgeIds.has(k)), "5 config keys");
}
// 6
{
  const r = lint(".");
  check.ok(r.status === 1 && r.out.includes("carry no proof edge"), "6 lint fails clean");
}
// 7
{
  const dir = makeFixture();
  const { proofs, missing } = harvest({ dir, logPath: join(dir, "logs", "proof.log") });
  check.ok(Object.keys(proofs).length === 6 && missing.length === 0, "7 harvest six");
}
// 8
{
  const dir = makeFixture();
  harvest({ dir, logPath: join(dir, "logs", "proof.log") });
  const before = readFileSync(join(dir, "logs", "proof.log"), "utf8").split("\n").filter((l) => l.length > 0).length;
  appendFileSync(join(dir, "logs", "proof.log"), "2099-01-01T00:00:00.000Z proof edge=api-ring mode=live listDevices ok 9ms\n");
  const { proofs } = harvest({ dir, logPath: join(dir, "logs", "proof.log") });
  check.ok((proofs["api-ring"]?.line ?? 0) === before + 1, "8 last line wins");
}
// 9
{
  const dir = makeFixture();
  const mockLog = join(dir, "logs", "mock.log");
  createProofLog({ path: mockLog })("api-ring", "mock", "listDevices ok 1ms");
  const plain = harvest({ dir, logPath: mockLog });
  const any = harvest({ dir, logPath: mockLog, acceptAny: true });
  check.ok(
    plain.missing.includes("api-ring") && (any.proofs["api-ring"]?.mode ?? "") === "mock",
    "9 mock filtered",
  );
}
// 10 + 11 + 12 + 13 share one freshly harvested fixture
{
  const dir = makeFixture();
  const original = readFileSync(join(dir, "architecture.json"), "utf8");
  const { proofs } = harvest({ dir, logPath: join(dir, "logs", "proof.log") });
  // 10
  const strip = (text: string): string => {
    const doc = JSON.parse(text) as { edges?: Record<string, unknown>[] };
    for (const e of doc.edges ?? []) delete (e as Record<string, unknown>)["proof"];
    return JSON.stringify(doc);
  };
  const after = readFileSync(join(dir, "architecture.json"), "utf8");
  check.ok(strip(after) === strip(original), "10 key order kept");
  // 11
  const logLines = readFileSync(join(dir, "logs", "proof.log"), "utf8").split(/\r?\n/);
  const ok11 = Object.values(proofs).every(
    (p) => p.file === "logs/proof.log" && (logLines[p.line - 1] ?? "").includes(p.text),
  );
  check.ok(ok11, "11 proof pointers");
  // 12
  const r = lint(dir);
  check.ok(
    r.status === 0 &&
      r.out.split("\n").some((l) => l.startsWith("lint:architecture — OK (8 nodes, 7 edges, 6 proof(s) read and matched, sponsor: ring, bedrock)")),
    "12 lint passes",
  );
  // 13
  const doc = JSON.parse(after) as { edges?: { id?: string; proof?: { text?: string } }[] };
  const withProof = (doc.edges ?? []).find((e) => e.proof !== undefined);
  if (withProof?.proof) withProof.proof.text = "definitely not on that line xyz";
  writeFileSync(join(dir, "architecture.json"), JSON.stringify(doc, null, 2) + "\n");
  const r2 = lint(dir);
  check.ok(r2.status === 1 && r2.out.includes("does not contain"), "13 tampered proof");
}
// 14
{
  const dir = makeFixture();
  const mockLog = join(dir, "logs", "mock.log");
  createProofLog({ path: mockLog })("api-ring", "mock", "listDevices ok 1ms");
  const run = (extra: string): number => {
    const r = spawnSync(`npx vite-node scripts/harvest-architecture-proofs.ts ${extra}`, {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: true,
    });
    return r.status ?? 1;
  };
  const bad = run(`--dir ${dir} --log ${mockLog} --require-sponsor`);
  const good = run(`--dir ${dir} --log ${join(dir, "logs", "proof.log")} --require-sponsor`);
  check.ok(bad === 1 && good === 0, "14 require sponsor");
}
// 15
{
  const dir = makeFixture();
  const target = mkdtempSync(join(tmpdir(), "at07sync-"));
  const r = spawnSync(`npx vite-node scripts/harvest-architecture-proofs.ts --dir ${dir} --sync`, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    env: { ...process.env, ARCH_SYNC_DIR: target },
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  check.ok(
    existsSync(join(target, "architecture.json")) && existsSync(join(target, "logs", "proof.log")) &&
      out.includes("synced") && (r.status ?? 1) === 0,
    "15 sync copies",
  );
}
// 16
{
  const dir = makeFixture();
  const missing = join(tmpdir(), "at07-missing-xyz");
  const r = spawnSync(`npx vite-node scripts/harvest-architecture-proofs.ts --dir ${dir} --sync`, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    env: { ...process.env, ARCH_SYNC_DIR: missing },
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  check.ok(out.includes("sync skipped") && (r.status ?? 1) === 0, "16 sync skipped");
}

check.done();
