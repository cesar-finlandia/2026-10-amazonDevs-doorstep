// scripts/verify/sk-01-harvest.ts — DP-SCRIPT WU-01 (12 checks).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { check, done, runNode } from "../video/lib.js";

const failures: string[] = [];
let n = 0;
const t = (ok: boolean, label: string): void => {
  n += 1;
  check(n, ok, label, failures);
};
const PROJECT = "../../hackathons/hackathon-projects/2026-10-amazonDevs";

// 1. Preflight green (match the preflight line itself; tool noise may follow).
{
  const r = runNode(["scripts/video/preflight.ts"]);
  const line = r.out.split("\n").map((l) => l.trim()).find((l) => l.startsWith("preflight:")) ?? "";
  t(r.code === 0 && /^preflight: \d+ checks passed$/.test(line), `preflight green (${line.slice(0, 40)})`);
}

// 2. lib.ts exports.
{
  const lib = await import("../video/lib.js");
  const names = ["PROJECT", "CHASSIS", "readJson", "writeJson", "runNode", "runPy", "blocked", "check", "done", "estimate"];
  t(names.every((k) => (lib as Record<string, unknown>)[k] !== undefined), "lib exports complete");
}

// 3. Harvest line.
{
  const r = runNode(["scripts/video/harvest-facts.ts"]);
  const line = r.out.split("\n").map((l) => l.trim()).find((l) => l.startsWith("harvest:")) ?? "";
  t(/^harvest: rung (bedrock|vertex-fallback|golden|manual), runs agree (yes|no), \d+ rows$/.test(line), `harvest line (${line.slice(0, 60)})`);
}

const harvest = JSON.parse(readFileSync(`${PROJECT}/video/facts/harvest.json`, "utf8")) as {
  version?: string; baseUrl?: string; measuredAt?: string; rung?: string; runsAgree?: boolean;
  smoke?: string; comparisons?: { field: string; run1: unknown; run2: unknown; quote: string }[];
  featured?: { title?: string; eventCount?: number; startHour?: number };
};

// 4. Both traces validate (via the CLI in a child process; importing it
// would run its main under this process's argv).
{
  const v1 = runNode(["hee/scripts/hee-validate-run-trace.ts", `${PROJECT}/video/facts/run-1/run-trace.json`, "--min-roles", "4", "--min-actions", "15", "--require-verify-repair", "--require-human-checkpoint"]);
  const v2 = runNode(["hee/scripts/hee-validate-run-trace.ts", `${PROJECT}/video/facts/run-2/run-trace.json`, "--min-roles", "4", "--min-actions", "15", "--require-verify-repair", "--require-human-checkpoint"]);
  t(v1.code === 0 && v1.out.includes("trace ok:") && v2.code === 0 && v2.out.includes("trace ok:"), "both traces validate");
}

// 5. status.json kinds match harvest rung (or runsAgree false).
{
  const s1 = JSON.parse(readFileSync(`${PROJECT}/video/facts/run-1/status.json`, "utf8")) as { agent?: { kind?: string } };
  const s2 = JSON.parse(readFileSync(`${PROJECT}/video/facts/run-2/status.json`, "utf8")) as { agent?: { kind?: string } };
  const norm = (k: string): string => {
    const l = k.toLowerCase();
    if (l.includes("bedrock") && !l.includes("not bedrock")) return "bedrock";
    if (l.includes("vertex") || l.includes("fallback") || l.includes("recorded")) return l.includes("recorded") ? "golden" : "vertex-fallback";
    if (l.includes("golden")) return "golden";
    return "manual";
  };
  t(
    (norm(s1.agent?.kind ?? "") === harvest.rung && norm(s2.agent?.kind ?? "") === harvest.rung) || harvest.runsAgree === false,
    `status rungs match ${harvest.rung}`,
  );
}

// 6. Harvest shape: version, baseUrl, measuredAt today.
{
  const day = new Date().toISOString().slice(0, 10);
  t(
    harvest.version === "1.0.0" && (harvest.baseUrl ?? "") !== "" &&
      !(harvest.baseUrl ?? "").includes("localhost") && (harvest.measuredAt ?? "").startsWith(day),
    "harvest shape + today",
  );
}

// 7. Comparison rows with exact/range discipline.
{
  const rows = harvest.comparisons ?? [];
  const fields = rows.map((r) => r.field);
  const need = ["model_roles", "actions", "rounds", "verify_repair_rounds", "human_checkpoints", "final_truth"];
  let ok = need.every((f) => fields.includes(f));
  for (const r of rows) {
    if (r.quote !== "exact" && r.quote !== "range") ok = false;
    if (r.quote === "exact" && JSON.stringify(r.run1) !== JSON.stringify(r.run2)) ok = false;
  }
  t(ok, "comparison rows disciplined");
}

// 8. Truth series for model rungs.
{
  const row = (harvest.comparisons ?? []).find((r) => r.field === "truth_series") as { first_errors?: number; last_errors?: number; run1?: { first?: number; last?: number } } | undefined;
  const r1 = row?.run1;
  if (harvest.rung === "bedrock" || harvest.rung === "vertex-fallback") {
    t(r1 !== undefined && (r1.first ?? 0) >= 1 && r1.last === 0, "truth series first>=1 last=0");
  } else {
    t(true, "truth series not required on this rung");
  }
}

// 9. Featured moment from the bundle.
{
  const f = harvest.featured ?? {};
  t((f.title ?? "") !== "" && (f.eventCount ?? 0) >= 1 && Number.isInteger(f.startHour) && (f.startHour ?? -1) >= 0 && (f.startHour ?? 99) <= 23, `featured ${f.title ?? "?"}@${f.startHour}`);
}

// 10. Smoke line.
t(harvest.smoke === "smoke: 4 passed, 0 failed, 0 skipped", "smoke recorded green");

// 11. Closed port BLOCKED, files unchanged.
{
  const hashDir = (p: string): string => {
    try {
      return createHash("sha256").update(readFileSync(p)).digest("hex");
    } catch {
      return "missing";
    }
  };
  const before = hashDir(`${PROJECT}/video/facts/harvest.json`);
  const r = runNode(["scripts/video/harvest-facts.ts", "--base-url", "http://127.0.0.1:9"]);
  const line = r.out.split("\n").map((l) => l.trim()).find((l) => l.startsWith("BLOCKED (")) ?? "";
  t(r.code === 3 && line !== "" && hashDir(`${PROJECT}/video/facts/harvest.json`) === before, `closed port BLOCKED, files stable (${line.slice(0, 40)})`);
}

// 12. No absolute path / auth token word / secret value in unit files.
// (The token word is assembled so this check does not flag itself; paths use
// the shared tuned scanner from lib/submission.)
{
  const files = ["scripts/video/lib.ts", "scripts/video/preflight.ts", "scripts/video/harvest-facts.ts", "scripts/verify/sk-01-harvest.ts"];
  const { absolutePathHits } = await import("../lib/submission.js");
  const tokenWord = "Bear" + "er ";
  let ok = true;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    if (absolutePathHits(text).length > 0 || text.includes(tokenWord) ||
      /(RING|AWS|BEDROCK)_[A-Z_]*['"]?\s*[:=]\s*['"][A-Za-z0-9_+/-]{12,}/.test(text)) ok = false;
  }
  t(ok, "unit files hold no path/secret");
}

done("sk-01-harvest", n, failures);
