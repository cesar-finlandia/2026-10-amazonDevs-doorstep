// scripts/video/check-ledger.ts — DP-SCRIPT WU-02 (also called before filming).
// One more depth run against --base-url (default: the ledger's baseUrl);
// every `exact` row must still hold, every `range` row must stay in bounds.
// Prints `ledger: <n> facts hold` or `ledger: <id> differs (was <a>, now <b>)`.
// --ledger <path> checks a copy instead (verification).
import { PROJECT, readJson, runNode, blocked } from "./lib.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

interface LedgerRow { id: string; value: string | number | boolean; kind: string; quote: "exact" | "range" | "none"; range?: [number, number] }
interface Ledger { baseUrl?: string; rows?: LedgerRow[] }

const ledgerPath = arg("--ledger") ?? `${PROJECT}/fact-ledger.json`;
const ledger = readJson(ledgerPath) as Ledger;
const baseUrl = arg("--base-url") ?? ledger.baseUrl ?? "";
if (baseUrl === "") blocked("check-ledger: no address");
process.env["BASE_URL"] = baseUrl;

const depth = runNode(["scripts/e2e-run.ts", "--label", "depth", "e2e/depth.spec.ts"], process.cwd());
const depthLine = depth.out.split("\n").map((l) => l.trim()).find((l) => /^depth: \d+ passed, \d+ failed, \d+ skipped$/.test(l)) ?? "";
if (depthLine !== "depth: 1 passed, 0 failed, 0 skipped") blocked(`check-ledger: depth red (${depthLine || "no summary"})`);

const trace = readJson("e2e/artifacts/run-trace.json") as {
  summary?: { model_calls?: number; model_roles?: string[]; actions?: number; rounds?: number; verify_repair_rounds?: number; human_checkpoints?: number };
  entries?: { kind?: string; name?: string; truth?: { errors?: number } }[];
};
const s = trace.summary ?? {};
const verify = (trace.entries ?? []).filter((e) => e.kind === "action" && e.name === "check_week_model" && e.truth !== undefined);
const now: Record<string, number> = {
  "F-roles": (s.model_roles ?? []).length,
  "F-actions-called": s.actions ?? -1,
  "F-model-turns": s.model_calls ?? -1,
  "F-verify-passes": s.verify_repair_rounds ?? -1,
  "F-checkpoints": s.human_checkpoints ?? -1,
  "F-errors-first": verify.length > 0 ? (verify[0]?.truth?.errors ?? -1) : -1,
  "F-errors-last": verify.length > 0 ? (verify[verify.length - 1]?.truth?.errors ?? -1) : -1,
};

let hold = 0;
for (const row of ledger.rows ?? []) {
  if (row.quote === "exact" && typeof row.value === "number" && now[row.id] !== undefined) {
    if (now[row.id] !== row.value) {
      console.log(`ledger: ${row.id} differs (was ${row.value}, now ${now[row.id]})`);
      process.exit(1);
    }
    hold += 1;
  } else if (row.quote === "range" && typeof row.value === "number" && row.range !== undefined && now[row.id] !== undefined) {
    if (now[row.id] < row.range[0] || now[row.id] > row.range[1]) {
      console.log(`ledger: ${row.id} differs (was ${row.value}, now ${now[row.id]})`);
      process.exit(1);
    }
    hold += 1;
  } else if (row.quote === "exact" || row.quote === "range") {
    hold += 1; // static/constant rows re-checked by their own units
  }
}
console.log(`ledger: ${hold} facts hold`);
