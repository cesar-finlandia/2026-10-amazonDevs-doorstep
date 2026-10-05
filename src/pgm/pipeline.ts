// Requirement IDs: PGM-10, PGM-11, PGM-12, PGM-13, GOV-RES-01, XCUT-08
// Pipeline orchestration (DP-K §9): runPgm chains S1→S2→S3→S4 inside the
// documented time budget (p50 ≤22 min / p95 ≤25 min) under a 28-minute hard
// ceiling; runStage executes ONE stage against its own input file with no
// upstream re-invocation (PGM-13: stage 3 reads mined_frustrations.json
// (+brief), stage 4 reads pitch_candidates.json + brief + catalog — never a
// Reddit fetch). Every LLM/data call stays inside the stages' RES-01-wrapped
// code; this module only sequences, budgets, hashes and manifests.
//
// Ceiling semantics (§9.1): the top-level promise is raced against an
// AbortController armed at time_budget.ceiling_minutes (overridable via
// opts.hard_ceiling_ms for tests). On expiry we surface whatever partial
// outputs exist, write run.json {status:"partial_ceiling", completed_stages,
// elapsed_ms, ceiling_ms} and resolve degraded-but-zero — never an unhandled
// throw (GOV-RES-01). Per-call timeouts in config/pgm.json resilience slice
// abort hung calls independently of the ceiling.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { RoleCallOptions } from "./resilientCall.js";
import { runStage1, type Stage1Outcome } from "./stages/stage1_deconstruction.js";
import type { Stage2PgmConfig, Stage2Options, Stage2Outcome } from "./stages/stage2_mining.js";
import { runStage2 } from "./stages/stage2_mining.js";
import { runStage3, type Stage3Outcome } from "./stages/stage3_synthesis.js";
import { runStage4, type Stage4Data, type Stage4Outcome } from "./stages/stage4_selection.js";
import { writeEngineBuildingPrompt } from "./engine-prompt.js";

//#region Config loading + safe defaults (GOV-RES-02)

export interface PgmResolvedConfig {
  personas_count: number;
  min_sponsor_pair_fraction: number;
  candidates_count: number;
  max_quote_words: number;
  paraphrase_max_chars: number;
  include_comments: boolean;
  mining: Stage2PgmConfig["mining"];
  data_source: Stage2PgmConfig["data_source"];
  ceiling_minutes: number;
}

/** Safe defaults when config/pgm.json is missing or malformed (DP-K §10 row 11). */
export function defaultPgmConfig(): PgmResolvedConfig {
  return {
    personas_count: 10,
    min_sponsor_pair_fraction: 0.4,
    candidates_count: 10,
    max_quote_words: 25,
    paraphrase_max_chars: 600,
    include_comments: false,
    mining: {},
    data_source: undefined,
    ceiling_minutes: 28,
  };
}

/**
 * loadPgmConfig — read config/pgm.json into one resolved object (PGM-04/11/12).
 * Missing/malformed → warn + safe defaults, never crash (GOV-RES-02). Count
 * overrides (--personas/--candidates) win over file values so stages see a
 * single resolved config.
 */
export function loadPgmConfig(
  configPath: string | undefined,
  overrides: { personas?: number; candidates?: number; withComments?: boolean } = {},
): PgmResolvedConfig {
  const cfg = defaultPgmConfig();
  if (configPath && existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
      const personas = raw.personas as Record<string, unknown> | undefined;
      const candidates = raw.candidates as Record<string, unknown> | undefined;
      const budget = raw.time_budget as Record<string, unknown> | undefined;
      const miningRaw = raw.mining as Record<string, unknown> | undefined;
      if (typeof personas?.count === "number") cfg.personas_count = personas.count;
      if (typeof personas?.min_sponsor_pair_fraction === "number")
        cfg.min_sponsor_pair_fraction = personas.min_sponsor_pair_fraction;
      if (typeof candidates?.count === "number") cfg.candidates_count = candidates.count;
      if (typeof candidates?.max_quote_words === "number") cfg.max_quote_words = candidates.max_quote_words;
      if (typeof candidates?.paraphrase_max_chars === "number")
        cfg.paraphrase_max_chars = candidates.paraphrase_max_chars;
      if (miningRaw) cfg.mining = miningRaw as NonNullable<Stage2PgmConfig["mining"]>;
      if (raw.data_source !== undefined) cfg.data_source = raw.data_source as Stage2PgmConfig["data_source"];
      if (typeof budget?.ceiling_minutes === "number" && budget.ceiling_minutes > 0)
        cfg.ceiling_minutes = budget.ceiling_minutes;
    } catch (err) {
      console.warn(
        `[pgm:pipeline] warning: config ${configPath} malformed (${(err as Error).message}) — using safe defaults (GOV-RES-02)`,
      );
    }
  } else if (configPath) {
    console.warn(`[pgm:pipeline] warning: config ${configPath} not found — using safe defaults (GOV-RES-02)`);
  }
  if (overrides.personas !== undefined) cfg.personas_count = overrides.personas;
  if (overrides.candidates !== undefined) cfg.candidates_count = overrides.candidates;
  // --with-comments flag ANDs with config mining.include_comments; stage 2 also
  // requires env PGM_ENABLE_COMMENTS=1 (PGM-05 double opt-in).
  if (overrides.withComments) cfg.include_comments = true;
  return cfg;
}

//#endregion

//#region Manifest + hash helpers

export interface StageStatusEntry {
  status: string;
  elapsed_ms: number;
}

export interface RunManifest {
  module: "pgm";
  mode: "run" | "stage" | "validate";
  status: string;
  completed_stages: number[];
  stage_statuses: Record<string, string>;
  grounded_fraction: number | null;
  ungrounded: boolean;
  elapsed_ms: number;
  ceiling_ms: number;
  started_at: string;
  finished_at: string;
  flags: Record<string, unknown>;
  files: Record<string, string>;
  error?: string;
}

/** sha256 of a file's bytes; unreadable files hash to their absence marker. */
export function hashFile(path: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

/** Hash every artifact currently present in outDir (PGM-12 traceability). */
export function hashArtifacts(outDir: string, names: string[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of names) {
    const h = hashFile(join(outDir, name));
    if (h) files[name] = h;
  }
  return files;
}

/**
 * writeRunJson — the authoritative run manifest (DP-K §9 per-stage file
 * contract). Always written last, after any ceiling abort, so callers can
 * branch on status without parsing partial outputs.
 */
export function writeRunJson(outDir: string, manifest: RunManifest): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "run.json"), JSON.stringify(manifest, null, 2) + "\n");
}

/**
 * groundedFraction — grounded records ÷ total records in a mined document
 * (null when no records at all). Fraction 0 drives ok_ungrounded (§10 row 3).
 */
export function groundedFraction(minedDoc: unknown): number | null {
  const records = (minedDoc as { records?: unknown })?.records;
  if (!Array.isArray(records) || records.length === 0) return null;
  const grounded = records.filter((r) => (r as { grounded?: unknown })?.grounded === true).length;
  return grounded / records.length;
}

//#endregion

//#region Full pipeline (PGM-12)

//#region Partial surfacing (§9.1 hard-ceiling flow)

const ARTIFACT_NAMES = [
  "personas.json",
  "mined_frustrations.json",
  "pitch_candidates.json",
  "pitch_candidates.md",
  "winning_project_plan.md",
] as const;

/**
 * surfacePartials — after a ceiling abort, guarantee every not-yet-produced
 * artifact has an explicit .partial marker so downstream consumers never
 * confuse absence-by-crash with truncation-by-budget. Completed canonical
 * outputs are left untouched; missing ones get a machine-readable stub.
 */
export function surfacePartials(outDir: string, ceilingMs: number): void {
  mkdirSync(outDir, { recursive: true });
  for (const name of ARTIFACT_NAMES) {
    const canonical = join(outDir, name);
    if (existsSync(canonical)) continue;
    const dot = name.lastIndexOf(".");
    const partialName = dot > 0 ? `${name.slice(0, dot)}.partial${name.slice(dot)}` : `${name}.partial`;
    const partialPath = join(outDir, partialName);
    if (!existsSync(partialPath)) {
      writeFileSync(
        partialPath,
        `${JSON.stringify(
          {
            partial: true,
            reason: "partial_ceiling",
            note: `PGM hard ceiling (${Math.round(ceilingMs / 60000)} min) hit before this artifact was produced`,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
      );
    }
  }
}

//#endregion

//#region Full pipeline (PGM-12)

export interface PgmRunOptions {
  briefPath?: string;
  briefText?: string;
  outDir: string;
  configPath?: string;
  /** --personas / --candidates / --with-comments overrides win over config. */
  overrides?: { personas?: number; candidates?: number; withComments?: boolean };
  /** Test override of time_budget.ceiling_minutes (PGM-12). */
  hardCeilingMs?: number;
  /** Test injection: stub LLM transport shared by S1/S3/S4 (RES-01 stays inside stages). */
  transport?: RoleCallOptions["transport"];
  repairLlm?: RoleCallOptions["repairLlm"];
  /** Per-call LLM timeout override threaded to S1/S3/S4 (sweep transports need minutes). */
  llmTimeoutMs?: number;
  cacheSource?: Stage2Options["cacheSource"];
  liveSource?: Stage2Options["liveSource"];
}

/** Internal control-flow signal carrying the §10 per-failure status label. */
class PipelineStageError extends Error {
  constructor(
    readonly stage: number,
    readonly status: string,
    originalError: string,
  ) {
    super(`stage ${stage} degraded (${status}): ${originalError}`);
    this.name = "PipelineStageError";
  }
}

/**
 * runPgm — full S1→S2→S3→S4 chain under the documented budget (p50 ≤22 min,
 * p95 ≤25 min) and the hard ceiling (28 min default). Never throws (GOV-RES-01):
 * every terminal path resolves with a RunManifest written to <outDir>/run.json.
 */
export async function runPgm(opts: PgmRunOptions): Promise<RunManifest> {
  const startedAt = new Date();
  const t0 = Date.now();
  const cfg = loadPgmConfig(opts.configPath, opts.overrides);
  const ceilingMs = opts.hardCeilingMs ?? Math.round(cfg.ceiling_minutes * 60_000);
  mkdirSync(opts.outDir, { recursive: true });

  const completedStages: number[] = [];
  const stageStatuses: Record<string, string> = {};
  let grounded: number | null = null;
  // §10 row 3 / §12 PGM-AC-02 variant: a stage-2 wrapper degrade (DegradedResult)
  // is recorded but NEVER blocks S3/S4 — they still run ungrounded against
  // whatever salvaged mined_frustrations.json exists on disk.
  let pendingStatus: string | null = null;

  // Hard-ceiling machinery (§9.1): AbortController armed at ceiling; the race
  // settles the moment it fires even if a stage call is still pending.
  const controller = new AbortController();
  let ceilingFired = false;
  const ceilingPromise = new Promise<"ceiling">((resolve) => {
    const timer = setTimeout(() => {
      ceilingFired = true;
      controller.abort();
      resolve("ceiling");
    }, ceilingMs);
    timer.unref?.();
  });

  const pipeline = async (): Promise<void> => {
    // Stage 1 — Deconstruction (personas.json).
    const s1Start = Date.now();
    const s1: Stage1Outcome = await runStage1({
      briefPath: opts.briefPath,
      briefText: opts.briefText,
      outDir: opts.outDir,
      count: cfg.personas_count,
      minSponsorPairFraction: cfg.min_sponsor_pair_fraction,
      transport: opts.transport,
      repairLlm: opts.repairLlm,
      llmTimeoutMs: opts.llmTimeoutMs,
    });
    stageStatuses.stage1 = s1.ok ? "ok" : "degraded";
    if (!s1.ok) throw new PipelineStageError(1, "degraded_stage1", s1.original_error ?? "unknown");
    completedStages.push(1);
    stageStatuses.stage1_elapsed_ms = String(Date.now() - s1Start);
    if (ceilingFired) return;

    // Stage 2 — Market Mining (mined_frustrations.json); never blocks (PGM-03.3).
    // BUT: zero Reddit evidence is a FAILED mining step, never a completed one
    // (operator requirement) — placeholders must not masquerade as success.
    const s2Start = Date.now();
    const s2: Stage2Outcome = await runStage2({
      inputPath: join(opts.outDir, "personas.json"),
      outDir: opts.outDir,
      config: { mining: { ...cfg.mining, include_comments: cfg.include_comments }, data_source: cfg.data_source },
      cacheSource: opts.cacheSource,
      liveSource: opts.liveSource,
    });
    stageStatuses.stage2 = s2.ok ? "ok" : "degraded";
    if (!s2.ok) {
      pendingStatus = "partial_mining_degraded";
      stageStatuses.stage2_error = s2.original_error ?? "unknown";
    } else {
      const mined = (s2.data as { records?: Array<{ source_tier?: unknown }> }).records ?? [];
      const realRecords = mined.filter((r) => r.source_tier !== "skip_ungrounded").length;
      if (realRecords === 0) {
        stageStatuses.stage2 = "failed_no_reddit_data";
        stageStatuses.stage2_error =
          "ZERO Reddit evidence records — tier-1 cache cold and tier-2 live API unreachable or IP-blocked";
        pendingStatus = "mining_no_reddit_data";
        grounded = 0;
        stageStatuses.grounded_fraction = "0.000";
      } else {
        completedStages.push(2);
        stageStatuses.stage2_elapsed_ms = String(Date.now() - s2Start);
        grounded = groundedFraction(s2.data);
        if (grounded !== null) stageStatuses.grounded_fraction = grounded.toFixed(3);
      }
    }
    if (ceilingFired) return;

    // Stage 3 — Pitch Synthesis (pitch_candidates.{json,md}); reads the mined
    // file (+brief) ONLY — no Reddit fetch, no personas re-read (PGM-13).
    const s3Start = Date.now();
    const s3: Stage3Outcome = await runStage3({
      inputPath: join(opts.outDir, "mined_frustrations.json"),
      briefPath: opts.briefPath,
      briefText: opts.briefText,
      outDir: opts.outDir,
      config: {
        candidates: {
          count: cfg.candidates_count,
          max_quote_words: cfg.max_quote_words,
          paraphrase_max_chars: cfg.paraphrase_max_chars,
        },
      },
      transport: opts.transport,
      repairLlm: opts.repairLlm,
      llmTimeoutMs: opts.llmTimeoutMs,
    });
    stageStatuses.stage3 = s3.ok ? "ok" : "degraded";
    if (!s3.ok) throw new PipelineStageError(3, "degraded_stage3", s3.original_error ?? "unknown");
    completedStages.push(3);
    stageStatuses.stage3_elapsed_ms = String(Date.now() - s3Start);
    if (ceilingFired) return;

    // Stage 4 — Strategic Selection (winning_project_plan.md); candidates +
    // brief + catalog only (PGM-13).
    const s4Start = Date.now();
    const s4: Stage4Outcome = await runStage4({
      inputPath: join(opts.outDir, "pitch_candidates.json"),
      briefPath: opts.briefPath,
      briefText: opts.briefText,
      outDir: opts.outDir,
      transport: opts.transport,
      repairLlm: opts.repairLlm,
      llmTimeoutMs: opts.llmTimeoutMs,
    });
    stageStatuses.stage4 = s4.ok ? "ok" : "degraded";
    if (!s4.ok) throw new PipelineStageError(4, "degraded_stage4", s4.original_error ?? "unknown");
    completedStages.push(4);
    stageStatuses.stage4_elapsed_ms = String(Date.now() - s4Start);

    // Derived artifact (DP-K amendment 2026-08-25): the engine-building
    // meta-prompt for the operator's blueprint/design-plan chats. Best-effort —
    // never fails the pipeline.
    writeEngineBuildingPrompt(opts.outDir);

    // Stage 4 Enrichment — winning-strategy augmentation (Task 2, via run_sweep.sh).
    // Best-effort: enriches winning_project_plan.md with Hackathon Requirements &
    // Compliance Matrix + Sponsored Track Strategy (1-2 tracks) so the plan
    // maximizes win probability. Uses the same sweep transport as Stage 4;
    // evaluates quality and, on failure, rewrites the prompt and retries once.
    // A failed enrichment keeps the original Stage 4 plan — pipeline still ok.
    if (!ceilingFired && completedStages.includes(4)) {
      const enrichStart = Date.now();
      try {
        const { enrichWinningPlan } = await import("./stages/stage4_enrichment.js");
        const enrichResult = await enrichWinningPlan({
          briefPath: opts.briefPath,
          briefText: opts.briefText,
          outDir: opts.outDir,
          transport: opts.transport,
          repairLlm: opts.repairLlm,
          llmTimeoutMs: opts.llmTimeoutMs,
        });
        if (enrichResult.ok && enrichResult.enriched) {
          stageStatuses.enrichment = "enriched";
          stageStatuses.enrichment_quality = `complianceMatrix:${enrichResult.quality?.hasComplianceMatrix} trackStrategy:${enrichResult.quality?.hasTrackStrategy} focus:${enrichResult.quality?.trackFocusCount}`;
        } else if (!enrichResult.ok) {
          stageStatuses.enrichment = `skipped:${enrichResult.reason ?? "unknown"}`;
        } else {
          stageStatuses.enrichment = "ok_noop";
        }
        stageStatuses.enrichment_elapsed_ms = String(Date.now() - enrichStart);
        // Re-write engine prompt so it picks up the enriched plan's emphasis
        if (enrichResult.enriched) writeEngineBuildingPrompt(opts.outDir);
      } catch (err) {
        stageStatuses.enrichment = `skipped:${(err as Error).message}`;
        stageStatuses.enrichment_elapsed_ms = String(Date.now() - enrichStart);
      }
    }
  };

  const finish = (status: string, error?: string): RunManifest => {
    const finishedAt = new Date();
    const manifest: RunManifest = {
      module: "pgm",
      mode: "run",
      status,
      completed_stages: completedStages,
      stage_statuses: stageStatuses,
      grounded_fraction: grounded,
      ungrounded: grounded === 0,
      elapsed_ms: Date.now() - t0,
      ceiling_ms: ceilingMs,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      flags: {
        comments_enabled: cfg.include_comments && process.env.PGM_ENABLE_COMMENTS === "1",
        personas_count: cfg.personas_count,
        candidates_count: cfg.candidates_count,
      },
      files: hashArtifacts(opts.outDir, [...ARTIFACT_NAMES]),
    };
    if (error !== undefined) manifest.error = error;
    writeRunJson(opts.outDir, manifest);
    return manifest;
  };

  try {
    const verdict = await Promise.race([
      pipeline().then(() => "done" as const),
      ceilingPromise,
    ]);
    if (verdict === "ceiling") {
      // Surface whatever exists + explicit .partial markers; exit degraded-zero.
      surfacePartials(opts.outDir, ceilingMs);
      return finish("partial_ceiling", `hard ceiling ${ceilingMs}ms exceeded`);
    }
    if (pendingStatus !== null) {
      // Stage-2 degraded but S3/S4 were allowed to proceed (PGM-AC-02 variant).
      return finish(pendingStatus);
    }
    if (completedStages.length === 4 && grounded === 0) {
      return finish("ok_ungrounded"); // total data-source failure path (§10 row 3)
    }
    return finish("ok");
  } catch (err) {
    // GOV-RES-01: degraded-but-zero, never an unhandled throw.
    if (err instanceof PipelineStageError) {
      surfacePartials(opts.outDir, ceilingMs);
      return finish(err.status, err.message);
    }
    surfacePartials(opts.outDir, ceilingMs);
    return finish("partial_ceiling", `unexpected pipeline failure: ${(err as Error).message}`);
  }
}

//#endregion

//#region Single-stage re-runnability (PGM-13)

export interface PgmSingleStageOptions {
  stage: 1 | 2 | 3 | 4;
  outDir: string;
  /** Own-input file: brief (S1), personas.json (S2), mined_frustrations.json (S3), pitch_candidates.json (S4). */
  input?: string;
  /** Required for S3/S4 alongside --input (§9.2 flag table). */
  briefPath?: string;
  briefText?: string;
  catalogPath?: string;
  configPath?: string;
  overrides?: { personas?: number; candidates?: number; withComments?: boolean };
  transport?: RoleCallOptions["transport"];
  repairLlm?: RoleCallOptions["repairLlm"];
  /** Per-call LLM timeout override threaded to S1/S3/S4 (sweep transports need minutes). */
  llmTimeoutMs?: number;
  cacheSource?: Stage2Options["cacheSource"];
  liveSource?: Stage2Options["liveSource"];
}

export interface PgmSingleStageResult {
  ok: boolean;
  status: string;
  grounded_fraction: number | null;
  data?: unknown;
  error?: string;
}

/**
 * runStage — ONE stage against its own input file, NO upstream re-invocation
 * (PGM-13 / DP-K §9.3): stage 3 reads mined_frustrations.json (+brief) only,
 * stage 4 reads pitch_candidates.json + brief + catalog only — neither ever
 * touches Reddit. Statuses mirror the §10 table; never throws.
 */
export async function runPgmStage(opts: PgmSingleStageOptions): Promise<PgmSingleStageResult> {
  const t0 = Date.now();
  const startedAt = new Date();
  const cfg = loadPgmConfig(opts.configPath, opts.overrides);
  mkdirSync(opts.outDir, { recursive: true });

  let ok = false;
  let status = "ok";
  let data: unknown;
  let error: string | undefined;
  let fraction: number | null = null;

  try {
    switch (opts.stage) {
      case 1: {
        const r = await runStage1({
          briefPath: opts.input,
          briefText: opts.briefText,
          outDir: opts.outDir,
          count: cfg.personas_count,
          minSponsorPairFraction: cfg.min_sponsor_pair_fraction,
          transport: opts.transport,
          repairLlm: opts.repairLlm,
          llmTimeoutMs: opts.llmTimeoutMs,
        });
        ok = r.ok;
        data = r.ok ? r.data : undefined;
        if (!r.ok) {
          status = "degraded_stage1";
          error = r.original_error ?? "unknown";
        }
        break;
      }
      case 2: {
        const r = await runStage2({
          inputPath: opts.input,
          outDir: opts.outDir,
          config: { mining: { ...cfg.mining, include_comments: cfg.include_comments }, data_source: cfg.data_source },
          cacheSource: opts.cacheSource,
          liveSource: opts.liveSource,
        });
        if (r.ok) {
          data = r.data;
          const mined = (r.data as { records?: Array<{ source_tier?: unknown }> }).records ?? [];
          if (mined.filter((rec) => rec.source_tier !== "skip_ungrounded").length === 0) {
            ok = false; // zero Reddit evidence is a FAILED mining step, not a completed one
            status = "failed_stage2_no_reddit_data";
            error =
              "ZERO Reddit evidence records — tier-1 cache cold and tier-2 live API unreachable or IP-blocked";
            fraction = 0;
          } else {
            ok = true;
            fraction = groundedFraction(r.data);
            if (fraction === 0) status = "ok_ungrounded";
          }
        } else {
          status = "partial_mining_degraded";
          error = r.original_error ?? "unknown";
        }
        break;
      }
      case 3: {
        const r = await runStage3({
          inputPath: opts.input,
          briefPath: opts.briefPath,
          briefText: opts.briefText,
          outDir: opts.outDir,
          config: {
            candidates: {
              count: cfg.candidates_count,
              max_quote_words: cfg.max_quote_words,
              paraphrase_max_chars: cfg.paraphrase_max_chars,
            },
          },
          transport: opts.transport,
          repairLlm: opts.repairLlm,
          llmTimeoutMs: opts.llmTimeoutMs,
        });
        ok = r.ok;
        data = r.ok ? r.data : undefined;
        if (!r.ok) {
          status = "degraded_stage3";
          error = r.original_error ?? "unknown";
        }
        break;
      }
      case 4: {
        const r = await runStage4({
          inputPath: opts.input,
          briefPath: opts.briefPath,
          briefText: opts.briefText,
          catalogPath: opts.catalogPath,
          outDir: opts.outDir,
          transport: opts.transport,
          repairLlm: opts.repairLlm,
          llmTimeoutMs: opts.llmTimeoutMs,
        });
        ok = r.ok;
        data = r.ok ? r.data : undefined;
        if (!r.ok) {
          status = "degraded_stage4";
          error = r.original_error ?? "unknown";
        }
        break;
      }
    }
  } catch (err) {
    // GOV-RES-01: degraded-but-zero even on unexpected internal failure.
    ok = false;
    status = `degraded_stage${opts.stage}`;
    error = (err as Error).message;
  }

  const manifest: RunManifest = {
    module: "pgm",
    mode: "stage",
    status,
    completed_stages: ok ? [opts.stage] : [],
    stage_statuses: { [`stage${opts.stage}`]: ok ? "ok" : "degraded" },
    grounded_fraction: fraction,
    ungrounded: fraction === 0,
    elapsed_ms: Date.now() - t0,
    ceiling_ms: Math.round(cfg.ceiling_minutes * 60_000),
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    flags: {
      comments_enabled: cfg.include_comments && process.env.PGM_ENABLE_COMMENTS === "1",
      personas_count: cfg.personas_count,
      candidates_count: cfg.candidates_count,
    },
    files: hashArtifacts(opts.outDir, [...ARTIFACT_NAMES]),
  };
  if (error !== undefined) manifest.error = error;
  writeRunJson(opts.outDir, manifest);
  return { ok, status, grounded_fraction: fraction, data, error };
}

//#endregion
