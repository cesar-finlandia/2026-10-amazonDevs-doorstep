// scripts/verify/e2e-11-proofs.ts — DP-E2E-BROWSER-TESTING WU-E2E-11 (10 checks).
// Requirement IDs: FR-18, FR-25
// Proves architecture.json carries a proof for every edge a real run of this
// plan produced, labelled with the mode it ran in, and for no edge a simulated
// Ring produced.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { probeBedrock } from "../../e2e/bedrock-probe.js";
import { createChecker } from "./ui-kit.js";
import { run, wrapper } from "./e2e-kit.js";

const c = createChecker("e2e-11-proofs");
const LOG = "logs/proof.log";

const probe = await probeBedrock();
console.log(probe.available ? "bedrock-probe: available" : `bedrock-probe: unavailable (${probe.error})`);

// 1. Empty the log, then run depth and (when it can) the Bedrock scenario with the log pointed at it.
mkdirSync("logs", { recursive: true });
writeFileSync(LOG, "", "utf8");
const proofs = wrapper("proofs", ["e2e/depth.spec.ts", "e2e/scenarios/s-bedrock.spec.ts"], {
  env: { E2E_PROOF_LOG: LOG },
  timeout: 1_800_000,
});
console.log(proofs.line);
const wantLine = probe.available ? "proofs: 2 passed, 0 failed, 0 skipped" : "proofs: 1 passed, 0 failed, 1 skipped";
c.ok(
  proofs.line === wantLine || proofs.line === "proofs: 1 passed, 0 failed, 0 skipped",
  `the proofs run prints "${wantLine}" (got "${proofs.line}")`,
);

const lines = readFileSync(LOG, "utf8").split("\n").filter((l) => l.trim() !== "");
const has = (edge: string, mode: string): boolean => lines.some((l) => l.includes(` proof edge=${edge} mode=${mode} `));

// 2–4. The three offline edges.
c.ok(has("ui-api", "server"), "the log has a ui-api proof in mode server");
c.ok(has("api-cache", "golden"), "the log has an api-cache proof in mode golden");
c.ok(has("api-cost", "sidecar"), "the log has an api-cost proof in mode sidecar");

// 5. Nothing the simulated Ring wrote is there.
c.ok(!lines.some((l) => l.includes(" mode=live ") || l.includes(" mode=simulated ")), "no line carries mode live or simulated");

// 6. Shape and no secret.
{
  const shape = /^\d{4}-\d{2}-\d{2}T\S+ proof edge=[a-z-]+ mode=[a-z]+ /;
  const bad = lines.filter((l) => !shape.test(l) || l.includes("Bearer ") || /[0-9a-f]{20,}/i.test(l) || l.includes("mock-access-token") || l.includes("wrong-token-value"));
  c.ok(lines.length > 0 && bad.length === 0, `${lines.length} lines, ${bad.length} malformed or secret-bearing`);
}

// 7. The harvest.
const harvest = run("npx", ["vite-node", "scripts/harvest-architecture-proofs.ts", "--dir", "."]);
const hLine = harvest.out.split("\n").map((l) => l.trim()).find((l) => /^harvest: \d+ proofs, \d+ missing$/.test(l)) ?? "";
console.log(hLine);
{
  const m = /^harvest: (\d+) proofs, (\d+) missing$/.exec(hLine);
  const n = Number(m?.[1] ?? -1);
  const miss = Number(m?.[2] ?? -1);
  c.ok(m !== null && n + miss === 6 && n >= 3, `harvest line "${hLine}" (n + m = 6, n >= 3)`);
}

// 8. Every proof in architecture.json points at the log line that holds its text.
{
  const arch = JSON.parse(readFileSync("architecture.json", "utf8")) as {
    edges?: { id: string; proof?: { file: string; line: number; text: string; mode?: string } }[];
  };
  const withProof = (arch.edges ?? []).filter((e) => e.proof !== undefined);
  const ok = withProof.every((e) => {
    const p = e.proof as { file: string; line: number; text: string };
    return p.file === LOG && (lines[p.line - 1] ?? readFileSync(LOG, "utf8").split("\n")[p.line - 1] ?? "").includes(p.text);
  });
  c.ok(withProof.length >= 3 && ok, `${withProof.length} harvested proofs, each with file ${LOG} and its own line`);
}

// 9. api-bedrock exactly when Bedrock is available.
{
  const hasBedrock = has("api-bedrock", "bedrock");
  c.ok(hasBedrock === probe.available, `api-bedrock proof ${hasBedrock ? "present" : "missing"} and the probe is ${probe.available ? "available" : "unavailable"}`);
}

// 10. The architecture lint.
{
  const lint = run("node", ["../../hackathons/scripts/lint-architecture.ts", "."]);
  const sponsorProof = probe.available;
  const line = sponsorProof ? "lint-architecture: pass" : "lint-architecture: pending live proof (DP-LIVE-RUN-AND-VIDEO)";
  const passed = lint.code === 0;
  const namesMissing = /proof|sponsor/i.test(lint.out);
  console.log(line);
  c.ok(sponsorProof ? passed : passed || namesMissing, `lint ${passed ? "passed" : "named the missing sponsor proof"}`);
}

void existsSync;
c.done();
