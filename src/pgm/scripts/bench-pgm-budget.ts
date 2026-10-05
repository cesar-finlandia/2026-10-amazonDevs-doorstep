// Requirement IDs: PGM-12, BENCH-03, GOV-RES-01, XCUT-08
// PGM end-to-end budget bench (DP-K §9.1 / §12 BENCH-03): repeats 10 full
// runPgm pipelines with a stubbed LLM transport + stubbed tier-1 data source,
// then records p50/p95 wall-clock to reports/bench/pgm-budget.json.
//
// The documented budget promise (README + config/pgm.json) is p50 ≤22 min /
// p95 ≤25 min with a 28-min hard ceiling. With stubbed calls the measured
// numbers are orchestration overhead only — the bench records them for
// regression tracking and asserts the manifest invariants (status ok, 4/4
// stages completed, ceiling_ms = 28*60_000), not the live-API budget itself.
//
// Run:
//   npx vite-node src/pgm/scripts/bench-pgm-budget.ts [--runs 10] [--out reports/bench/pgm-budget.json]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runPgm, type RunManifest } from "../pipeline.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const DUMMY_BRIEF = join(REPO_ROOT, "examples", "dummy-fixtures", "pgm", "hackathon_brief.dummy.md");
const EXAMPLE_PLAN = join(REPO_ROOT, "examples", "dummy-fixtures", "pgm", "winning_project_plan.example.md");

interface BenchOptions {
  runs: number;
  outPath: string;
}

function parseArgs(argv: string[]): BenchOptions {
  const opts: BenchOptions = { runs: 10, outPath: join(REPO_ROOT, "reports", "bench", "pgm-budget.json") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--runs") opts.runs = Number(argv[++i]) || 10;
    else if (argv[i] === "--out") opts.outPath = argv[++i] ?? opts.outPath;
  }
  return opts;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] as number;
}

//#region Stubs (LLM transport + tier-1 data source)

/** Schema-conformant personas document (mirrors tests/pgm/stage1.test.ts). */
function personasDoc(count: number, briefHash: string): string {
  const personas = Array.from({ length: count }, (_v, i) => ({
    id: `persona-${String(i + 1).padStart(2, "0")}`,
    persona_name: `bench persona ${i + 1}`,
    description: `Bench persona ${i + 1}: who they are and the recurring friction in their workflow.`,
    target_subreddits: ["smallbusiness"],
    boolean_search_terms: `(alpha AND beta) OR gamma NOT delta ${i + 1}`,
    paired_sponsor_tech: true,
    sponsor_tech_name: "Acme Vision AI",
  }));
  return JSON.stringify({ version: "1.0.0", generated_at: new Date().toISOString(), source_brief_hash: briefHash, personas });
}

/** Candidates document mirroring the smoke fixture shape (one per persona). */
function candidatesDoc(personaIds: string[]): string {
  const cands = personaIds.map((pid, i) => ({
    id: `pitch-${String(i + 1).padStart(2, "0")}`,
    persona_id: pid,
    persona_name: `Bench persona ${i + 1} for synthesis`,
    supporting_evidence: {
      subreddit: "smallbusiness",
      rough_date: "2026-01",
      paraphrase: "Bench paraphrase of the mined frustration around manual workflow tooling costs.",
      grounded: true,
    },
    problem_framing: "Bench problem framing: repeated friction in an inefficient manual workflow costing hours weekly.",
    ai_solution: "Bench AI solution: an assistant automating the tedious steps without pre-deciding engine topology.",
    why_now: "Could not have been built two years ago with a form and a database — needs modern LLM reasoning over messy text.",
    predictability_note: "Gallery-adjacent workflow copilots exist; differentiation via evidence grounding; manual IDEA-03 scan still required.",
    rubric_alignment_score: 7.5,
    grounded: true,
    illustrative_quote: {
      fragment: "the shipping fee calculator keeps being wrong every single week and support never answers my tickets about it which costs me real money on nearly every mid price widget order",
      subreddit: "smallbusiness",
    },
  }));
  return JSON.stringify({ candidates: cands });
}

/** Tier-1 stub: one fresh raw submission per query (identity fields stripped upstream). */
const benchCacheSource = {
  name: "local_cache" as const,
  async search(params: { subreddit: string; subset?: string }) {
    return [
      {
        subreddit: params.subreddit,
        title: `Bench frustration in ${params.subreddit} about manual fee reconciliation`,
        selftext:
          "Every week the fee calculator disagrees with the actual payout and support never answers — it costs real money and hours of spreadsheet work.",
        score: 42,
        created_utc: Math.floor((Date.now() - 86_400_000 * 14) / 1000),
      },
    ];
  },
};

/** Dispatch by template marker line (see prompts/*.template.md headers). */
function makeTransport(): (prompt: string) => string {
  return (prompt) => {
    if (prompt.includes("brief deconstructor")) return personasDoc(10, "0".repeat(64));
    if (prompt.includes("pitch synthesizer")) {
      const ids = [...new Set(prompt.match(/persona-\d+/g) ?? [])];
      return candidatesDoc(ids);
    }
    // Strategic selector: fixture plan carries conformant frontmatter + frozen headings.
    return readFileSync(EXAMPLE_PLAN, "utf8").replace(/^[\s\S]*?(?=---)/, "").trim();
  };
}

//#endregion

//#region Main

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const transport = makeTransport();
  const samples: number[] = [];
  const statuses: Record<string, number> = {};
  let lastManifest: RunManifest | null = null;
  let failedRuns = 0;
  const tmpRoots: string[] = [];

  for (let i = 0; i < opts.runs; i++) {
    const outDir = join(tmpdir(), `pgm-bench-${Date.now()}-${i}`);
    tmpRoots.push(outDir);
    const t0 = performance.now();
    const manifest = await runPgm({
      briefPath: DUMMY_BRIEF,
      outDir,
      configPath: undefined, // defaults: ceiling 28 min, counts 10/10 (PGM-12)
      transport,
      cacheSource: benchCacheSource,
    });
    samples.push(performance.now() - t0);
    statuses[manifest.status] = (statuses[manifest.status] ?? 0) + 1;
    if (manifest.status !== "ok" || manifest.completed_stages.length !== 4) failedRuns += 1;
    lastManifest = manifest;
    console.log(`[bench] run ${i + 1}/${opts.runs}: ${manifest.status} in ${Math.round(manifest.elapsed_ms)}ms`);
  }
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });

  samples.sort((a, b) => a - b);
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);

  const report = {
    requirement_ids: ["PGM-12", "BENCH-03"],
    generated_at: new Date().toISOString(),
    mode: "stubbed-llm + stubbed-data-source (orchestration overhead only)",
    runs: opts.runs,
    p50_ms: Math.round(p50),
    p95_ms: Math.round(p95),
    min_ms: Math.round(samples[0] ?? 0),
    max_ms: Math.round(samples[samples.length - 1] ?? 0),
    documented_budget: {
      p50_minutes_max: 22,
      p95_minutes_max: 25,
      ceiling_minutes: 28,
      note: "Live-API promise per DP-K §9.1; stubbed bench validates orchestration overhead + manifest invariants only.",
    },
    statuses,
    failed_runs: failedRuns,
    last_run_manifest: lastManifest,
  };

  mkdirSync(opts.outPath.substring(0, opts.outPath.lastIndexOf("/")) || ".", { recursive: true });
  writeFileSync(opts.outPath, JSON.stringify(report, null, 2) + "\n");

  console.log(`[bench] p50=${report.p50_ms}ms p95=${report.p95_ms}ms over ${opts.runs} runs -> ${opts.outPath}`);
  if (failedRuns > 0) {
    console.error(`[bench] FAIL: ${failedRuns}/${opts.runs} runs did not complete all 4 stages with status ok`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});

//#endregion