// scripts/video/harvest-facts.ts — DP-SCRIPT WU-01 (§5.4 steps 1–5).
// Smoke-gates the deployed address, runs depth twice, compares the traces
// and writes video/facts/harvest.json + run-1/run-2 artefacts.
// Prints `harvest: rung <kind>, runs agree <yes|no>, <n> rows`.
// With --ledger, writes fact-ledger.json from the harvest (WU-02 step 1).
// With --markdown, prints the ledger as markdown table rows for section 5.
import { existsSync, readFileSync } from "node:fs";
import { PROJECT, readJson, writeJson, runNode, blocked } from "./lib.js";

interface TraceSummary {
  model_calls?: number; actions?: number; rounds?: number;
  model_roles?: string[]; verify_repair_rounds?: number; human_checkpoints?: number;
  final_truth?: { errors?: number; warnings?: number };
}
interface TraceFile {
  entries?: { seq?: number; kind?: string; name?: string; args?: Record<string, unknown>; truth?: { errors?: number; warnings?: number }; source?: string }[];
  summary?: TraceSummary;
}
interface StatusFile { agent?: { kind?: string; label?: string } }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function rungOf(kind: string, label: string): "bedrock" | "vertex-fallback" | "golden" | "manual" {
  const k = kind.toLowerCase();
  const l = label.toLowerCase();
  if (k.includes("bedrock") && !l.includes("not bedrock")) return "bedrock";
  if (k.includes("vertex") || k.includes("fallback") || l.includes("not bedrock") || l.includes("fallback")) return "vertex-fallback";
  if (k.includes("golden") || l.includes("recorded")) return "golden";
  return "manual";
}

function fileUrl(path: string): string {
  return `${PROJECT}/${path}`;
}

if (arg("--ledger") !== undefined || process.argv.includes("--ledger")) {
  writeLedger();
  process.exit(0);
}
if (arg("--markdown") !== undefined || process.argv.includes("--markdown")) {
  printMarkdown();
  process.exit(0);
}

async function main(): Promise<void> {
  const fromFlag = arg("--base-url") ?? "";
  let baseUrl = fromFlag;
  if (baseUrl === "") {
    try {
      const rec = readJson(fileUrl("deploy-record.json")) as { url?: string };
      if (typeof rec.url === "string" && rec.url !== "") baseUrl = rec.url;
    } catch { /* ignore */ }
  }
  if (baseUrl === "") blocked("no deployed address (deploy record missing and no --base-url)");

  // Probe first so a closed port stops here with nothing written.
  let status: StatusFile;
  try {
    const res = await fetch(`${baseUrl}/api/status`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) blocked(`no product at ${baseUrl} (status ${res.status})`);
    status = (await res.json()) as StatusFile;
  } catch (e) {
    blocked(`no product at ${baseUrl} (${(e as Error).message ?? e})`);
    throw new Error("unreachable");
  }
  const rung = rungOf(status.agent?.kind ?? "", status.agent?.label ?? "");
  process.env["BASE_URL"] = baseUrl;

  // Smoke gate first (§5.4 step 2).
  const smoke = runNode(["scripts/e2e-run.ts", "--label", "smoke", "e2e/smoke.spec.ts"], process.cwd());
  const smokeLine = smoke.out.split("\n").map((l) => l.trim()).find((l) => /^smoke: \d+ passed, \d+ failed, \d+ skipped$/.test(l)) ?? "";
  if (smokeLine !== "smoke: 4 passed, 0 failed, 0 skipped") blocked(`smoke gate: ${smokeLine || "no summary"}`);

  const summaries: TraceSummary[] = [];
  const traces: TraceFile[] = [];
  for (let n = 1; n <= 2; n++) {
    const depth = runNode(["scripts/e2e-run.ts", "--label", "depth", "e2e/depth.spec.ts"], process.cwd());
    const depthLine = depth.out.split("\n").map((l) => l.trim()).find((l) => /^depth: \d+ passed, \d+ failed, \d+ skipped$/.test(l)) ?? "";
    if (depthLine !== "depth: 1 passed, 0 failed, 0 skipped") blocked(`depth run ${n}: ${depthLine || "no summary"}`);
    const trace = readJson("e2e/artifacts/run-trace.json") as TraceFile;
    const st = await (await fetch(`${baseUrl}/api/status`, { signal: AbortSignal.timeout(15000) })).json() as StatusFile;
    writeJson(fileUrl(`video/facts/run-${n}/run-trace.json`), trace);
    writeJson(fileUrl(`video/facts/run-${n}/status.json`), st);
    summaries.push(trace.summary ?? {});
    traces.push(trace);
  }

  const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  const comparisons: { field: string; run1: unknown; run2: unknown; quote: "exact" | "range"; range?: [number, number] }[] = [];
  const numRow = (field: string, a: number, b: number): void => {
    if (a === b) comparisons.push({ field, run1: a, run2: b, quote: "exact" });
    else comparisons.push({ field, run1: a, run2: b, quote: "range", range: [Math.min(a, b), Math.max(a, b)] });
  };
  const roles1 = [...(summaries[0]?.model_roles ?? [])].sort();
  const roles2 = [...(summaries[1]?.model_roles ?? [])].sort();
  if (eq(roles1, roles2)) comparisons.push({ field: "model_roles", run1: roles1.length, run2: roles2.length, quote: "exact" });
  else comparisons.push({ field: "model_roles", run1: roles1.length, run2: roles2.length, quote: "range", range: [Math.min(roles1.length, roles2.length), Math.max(roles1.length, roles2.length)] });
  numRow("actions", summaries[0]?.actions ?? -1, summaries[1]?.actions ?? -2);
  numRow("rounds", summaries[0]?.rounds ?? -1, summaries[1]?.rounds ?? -2);
  numRow("verify_repair_rounds", summaries[0]?.verify_repair_rounds ?? -1, summaries[1]?.verify_repair_rounds ?? -2);
  numRow("human_checkpoints", summaries[0]?.human_checkpoints ?? -1, summaries[1]?.human_checkpoints ?? -2);
  const ft1 = summaries[0]?.final_truth ?? {};
  const ft2 = summaries[1]?.final_truth ?? {};
  if (eq(ft1, ft2)) comparisons.push({ field: "final_truth", run1: ft1.errors ?? -1, run2: ft2.errors ?? -1, quote: "exact" });
  else comparisons.push({ field: "final_truth", run1: ft1.errors ?? -1, run2: ft2.errors ?? -1, quote: "range", range: [Math.min(ft1.errors ?? 0, ft2.errors ?? 0), Math.max(ft1.errors ?? 0, ft2.errors ?? 0)] });

  // Truth series across the verify entries of run 1 (first and last errors).
  const verify1 = (traces[0]?.entries ?? []).filter((e) => e.kind === "action" && e.name === "check_week_model" && e.truth !== undefined);
  const firstErrors = verify1.length > 0 ? (verify1[0]?.truth?.errors ?? 0) : 0;
  const lastErrors = verify1.length > 0 ? (verify1[verify1.length - 1]?.truth?.errors ?? 0) : 0;
  const verify2 = (traces[1]?.entries ?? []).filter((e) => e.kind === "action" && e.name === "check_week_model" && e.truth !== undefined);
  const first2 = verify2.length > 0 ? (verify2[0]?.truth?.errors ?? 0) : 0;
  const last2 = verify2.length > 0 ? (verify2[verify2.length - 1]?.truth?.errors ?? 0) : 0;
  if (firstErrors === first2 && lastErrors === last2) {
    comparisons.push({ field: "truth_series", run1: { first: firstErrors, last: lastErrors }, run2: { first: first2, last: last2 }, quote: "exact" });
  } else {
    comparisons.push({ field: "truth_series", run1: { first: firstErrors, last: lastErrors }, run2: { first: first2, last: last2 }, quote: "range" });
  }

  // Featured moment: first open_incident with args in run 1.
  const open = (traces[0]?.entries ?? []).filter((e) => e.kind === "action" && e.name === "open_incident" && e.args !== undefined).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))[0];
  const oargs = (open?.args ?? {}) as { title?: string; eventIds?: string[] };
  const title = oargs.title ?? "";
  const ids = oargs.eventIds ?? [];
  if (title === "" || ids.length === 0) blocked("featured moment has no title or events");
  const bundle = readJson("data/bundle/doorstep-14d.json") as {
    inbox?: { meta?: { request_id?: string }; timestamp?: string }[];
    history?: Record<string, { items?: { id?: string; timestamp?: string }[] }[]>;
  };
  const want = new Set(ids.map((id) => (id.startsWith("evt:") ? id.slice(4) : id)));
  let stamp = "";
  for (const p of bundle.inbox ?? []) {
    if (p.meta?.request_id !== undefined && want.has(p.meta.request_id) && p.timestamp !== undefined) { stamp = p.timestamp; break; }
  }
  if (stamp === "") {
    for (const pages of Object.values(bundle.history ?? {})) {
      for (const page of pages ?? []) {
        for (const it of page.items ?? []) {
          if (it.id !== undefined && want.has(it.id) && it.timestamp !== undefined) { stamp = it.timestamp; break; }
        }
        if (stamp !== "") break;
      }
      if (stamp !== "") break;
    }
  }
  if (stamp === "") blocked("featured event id not found in the bundle");
  const startHour = new Date(stamp).getUTCHours();
  const runsAgree = comparisons.every((r) => r.quote === "exact");

  const harvest = {
    version: "1.0.0",
    measuredAt: new Date().toISOString(),
    baseUrl,
    rung,
    runsAgree,
    smoke: smokeLine,
    comparisons,
    featured: { title, eventCount: ids.length, startHour },
  };
  writeJson(fileUrl("video/facts/harvest.json"), harvest);
  console.log(`harvest: rung ${rung}, runs agree ${runsAgree ? "yes" : "no"}, ${comparisons.length} rows`);
}

function writeLedger(): void {
  const harvest = readJson(fileUrl("video/facts/harvest.json")) as {
    measuredAt?: string; baseUrl?: string; rung?: string; runsAgree?: boolean;
    comparisons?: { field: string; run1: unknown; run2: unknown; quote: "exact" | "range"; range?: [number, number] }[];
    featured?: { title?: string; eventCount?: number; startHour?: number };
  };
  const comp = (field: string): { run1: unknown; run2: unknown; quote: "exact" | "range"; range?: [number, number] } =>
    harvest.comparisons?.find((r) => r.field === field) ?? { run1: 0, run2: 0, quote: "exact" as const };
  const num = (field: string): number => Number(comp(field).run1 ?? 0);
  const truth = (harvest.comparisons?.find((r) => r.field === "truth_series")?.run1 ?? {}) as { first?: number; last?: number };
  const facts = readJson("design_documents/showcase-facts.json") as { actions?: number };
  const bundle = readJson("data/bundle/doorstep-14d.json") as {
    meta?: { days?: number };
    inbox?: unknown[];
    history?: Record<string, { items?: unknown[] }[]>;
  };
  let bundleEvents = (bundle.inbox ?? []).length;
  const dates = new Set<string>();
  const tsOf = (t: string): void => {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) dates.add(d.toISOString().slice(0, 10));
  };
  for (const p of (bundle.inbox ?? []) as { timestamp?: string }[]) if (p.timestamp !== undefined) tsOf(p.timestamp);
  for (const pages of Object.values(bundle.history ?? {})) {
    for (const page of pages ?? []) {
      for (const it of (page.items ?? []) as { timestamp?: string }[]) {
        bundleEvents += 1;
        if (it.timestamp !== undefined) tsOf(it.timestamp);
      }
    }
  }
  const rung = (harvest.rung ?? "golden") as "bedrock" | "vertex-fallback" | "golden" | "manual";
  const st1 = ((): string => {
    try {
      return ((readJson(fileUrl("video/facts/run-1/status.json")) as { agent?: { kind?: string } }).agent?.kind ?? rung);
    } catch { return rung; }
  })();
  const st2 = ((): string => {
    try {
      return ((readJson(fileUrl("video/facts/run-2/status.json")) as { agent?: { kind?: string } }).agent?.kind ?? rung);
    } catch { return rung; }
  })();
  const ledger = {
    version: "1.0.0",
    measuredAt: harvest.measuredAt ?? new Date().toISOString(),
    baseUrl: harvest.baseUrl ?? "",
    rung,
    runsAgree: harvest.runsAgree ?? false,
    narrationMayNameBedrock: rung === "bedrock" && st1 === "bedrock" && st2 === "bedrock",
    rows: [
      { id: "F-roles", claim: "Four model roles share the review", value: num("model_roles"), kind: "measured", quote: comp("model_roles").quote, ...(comp("model_roles").range !== undefined ? { range: comp("model_roles").range } : {}), source: { file: "video/facts/harvest.json", pointer: "/comparisons/model_roles" } },
      { id: "F-actions-called", claim: "The review calls over one hundred actions", value: num("actions"), kind: "measured", quote: comp("actions").quote, ...(comp("actions").range !== undefined ? { range: comp("actions").range } : {}), source: { file: "video/facts/harvest.json", pointer: "/comparisons/actions" } },
      { id: "F-verify-passes", claim: "The truth engine checks the week three times", value: num("verify_repair_rounds"), kind: "measured", quote: comp("verify_repair_rounds").quote, ...(comp("verify_repair_rounds").range !== undefined ? { range: comp("verify_repair_rounds").range } : {}), source: { file: "video/facts/harvest.json", pointer: "/comparisons/verify_repair_rounds" } },
      { id: "F-errors-first", claim: "The first check finds dozens of errors", value: truth.first ?? 0, kind: "measured", quote: "exact", source: { file: "video/facts/harvest.json", pointer: "/comparisons/truth_series" } },
      { id: "F-errors-last", claim: "The last check finds zero errors", value: truth.last ?? 0, kind: "measured", quote: "exact", source: { file: "video/facts/harvest.json", pointer: "/comparisons/truth_series" } },
      { id: "F-checkpoints", claim: "A person decides once per review", value: num("human_checkpoints"), kind: "measured", quote: comp("human_checkpoints").quote, ...(comp("human_checkpoints").range !== undefined ? { range: comp("human_checkpoints").range } : {}), source: { file: "video/facts/harvest.json", pointer: "/comparisons/human_checkpoints" } },
      { id: "F-featured-hour", claim: "The featured moment falls in the small hours", value: harvest.featured?.startHour ?? 0, kind: "measured", quote: "exact", source: { file: "video/facts/harvest.json", pointer: "/featured/startHour" } },
      { id: "F-actions-total", claim: "Twenty typed actions are registered", value: facts.actions ?? 0, kind: "static", quote: "exact", source: { file: "design_documents/showcase-facts.json", pointer: "/actions" } },
      { id: "F-bundle-days", claim: "The sample week spans a fortnight", value: dates.size, kind: "static", quote: "exact", source: { file: "data/bundle/doorstep-14d.json", pointer: "/meta/days" } },
      { id: "F-bundle-events", claim: "The sample week holds dozens of events", value: bundleEvents, kind: "static", quote: "exact", source: { file: "data/bundle/doorstep-14d.json" } },
      { id: "F-rung", claim: "The runs answered on the recorded rung", value: rung, kind: "static", quote: "exact", source: { file: "video/facts/harvest.json", pointer: "/rung" } },
    ],
  };
  writeJson(fileUrl("fact-ledger.json"), ledger);
  console.log(`ledger: ${ledger.rows.length} rows, rung ${rung}`);
}

function printMarkdown(): void {
  const ledger = readJson(fileUrl("fact-ledger.json")) as { rows?: { id?: string; claim?: string; value?: unknown; unit?: string; kind?: string; quote?: string; range?: [number, number] }[] };
  for (const r of ledger.rows ?? []) {
    const v = r.range !== undefined ? `${r.range[0]}–${r.range[1]}` : String(r.value ?? "");
    console.log(`| \`${r.id}\` | ${r.claim ?? ""} | ${v}${r.unit !== undefined ? ` ${r.unit}` : ""} | ${r.kind ?? ""} | ${r.quote ?? ""} |`);
  }
}

await main();
