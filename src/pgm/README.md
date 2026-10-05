# PGM — Problem Grounding & Market-Discovery Engine (DP-K)

Requirement IDs: PGM-01…PGM-13, PGM-RES-01/02, PGM-REU-01/02, GOV-RES-01/02, BENCH-03, XCUT-06, XCUT-08.
Authoritative design: `design_documents/design_plans/DP-K-problem-grounding-engine.md`.

## Purpose

PGM turns a raw hackathon brief into grounded pitch material: Stage 1
(PGM-02) decomposes the brief into micro-personas; Stage 2 (PGM-03…06) mines
Reddit through a tiered data-source chain (local cache → live API → skip)
into `mined_frustrations.json`; Stage 3 (PGM-07/08) synthesizes pitch
candidates with paraphrased, subreddit-only-attributed evidence; Stage 4
(PGM-09) picks the winning idea and emits `winning_project_plan.md` for the
planner. Every stage re-runs against its own input file (`PGM-13`) and every
outbound call is RES-01/RES-04 wrapped via `src/pgm/resilientCall.ts`
(`PGM-10`).

## What this module NEVER contains (NONGOAL-12)

- **No pre-mined evidence / pre-selected idea**: real-event outputs
  (`mined_frustrations.json`, `pitch_candidates.md`, `winning_project_plan.md`)
  are gitignored and written only to the centralized per-event planning space
  (`hackathon-projects/<Hackathon-project-name>/`; legacy `private/pgm/` or `.pgm/` still searched as fallback). The chassis ships only the mechanism plus dummy
  fixtures under `examples/dummy-fixtures/pgm/` (Acme/widget/lorem-ipsum).
- **No binding ASM manifest**: `winning_project_plan.md`'s
  "Suggested Module Emphasis" is advisory prose only — never
  `manifest_version`/`included`/`components[]`. ADV remains the sole manifest
  writer.
- **No lablab gallery scraper**: `src/pgm/mining/` contains no gallery
  fetcher; gallery prior-art checking stays a manual IDEA-03 checklist.

## Reddit vs the lablab gallery — different checks, both required

PGM mines **Reddit = external market evidence**: are real people feeling this
pain recently enough to ground a why-now claim? The **lablab gallery = prior
art**: what has already been built at past events. PGM deliberately does NOT
mine galleries; `predictability_note` in each candidate flags
gallery-adjacency but explicitly states the IDEA-03 manual gallery scan is
still required before pitching.

## Config knobs & example run

All knobs live in `config/pgm.json` (schema:
`contracts/pgm-config.schema.json`); missing/malformed file ⇒ safe defaults +
warn (`GOV-RES-02`). Key slices: `personas.count` (default 10) /
`personas.min_sponsor_pair_fraction` (0.4), `mining.recency_window_months`
(6) / caps / `mining.include_comments` (false — see caveat below),
`candidates.count|max_quote_words|paraphrase_max_chars` (10/25/600),
`data_source.provider` (`tiered` default | `local-cache-only` |
`live-api-only` | `none-skip` — swap is config-only, `PGM-REU-02`) with per-
tier timeouts/retries, `time_budget` (22/25/28 minutes).

```bash
# STEP 0 — Reddit-only reachability probe BEFORE any spend (exit 0/1):
pgm --reddit-only
# full pipeline against a brief; S1/S3/S4 LLM calls ride run_sweep.sh chat
# turns (Pi harness -> opencode-go/ox-alpha-free) — no API keys needed:
pgm run --brief hackathon-projects/<name>/hackathon_brief.md --out hackathon-projects/<name> --llm sweep --ceiling-minutes 90
# single-stage rerun (PGM-13): stage 3 vs its own input only:
pgm --stage 3 --input hackathon-projects/<name>/mined_frustrations.json --brief hackathon-projects/<name>/hackathon_brief.md --out hackathon-projects/<name> --llm sweep
# dry-run validation / cache refresh outside the event window (6.12):
pgm --validate hackathon-projects/<name>/mined_frustrations.json
npx vite-node scripts/refresh-cache.ts --subreddits EtsySellers,smallbusiness --months 6
```

`--llm sweep` flags: `--sweep-role <models.json role>` (default `standard`),
`--llm-timeout-ms <n>` (per-call budget, default 900000 — agentic turns need
minutes), `--ceiling-minutes <n>` (override the 28-min wall clock). Without
`--llm sweep` the CLI injects no transport and degrades at stage 1 unless API
keys are configured via `config/model-profiles.json`.

## Data sources — keyless Reddit access (DP-K2)

PGM needs **zero Reddit credentials, by design** (DP-K2). Tier 2 (`LiveApiDataSource`)
calls Reddit's public, unauthenticated JSON endpoints:

| Purpose | Endpoint |
|---|---|
| Per-subreddit search (tier 2 live) | `https://www.reddit.com/r/{sub}/search.json` |
| Newest-first listing (cache warmup) | `https://www.reddit.com/r/{sub}/new.json` |

- **Recency without `after=`** (PGM-K2-02): public search has no `after=` param. The
  source instead sends a coarse `t={hour\|day\|week\|month\|year\|all}` bucket and then
  filters client-side on `created_utc >= now − mining.recency_window_months`, preserving
  exact PGM-04 semantics despite the bucket's bounded over-fetch.
- **Descriptive User-Agent** (PGM-K2-03): every direct request sends
  `chassis-pgm/<version> (purpose; contact)`.
- **Client-fingerprint reality (field-verified, supersedes the UA assumption)**: from
  flagged IP ranges Reddit's edge blocks EVERY non-interactive client regardless of UA —
  curl, .NET, Node fetch (h1/h2), headless browsers. Two block flavors observed:
  hard **403** and a softer **HTTP 200 with EMPTY listings** (and occasionally HTML).
  Countermeasures, all automatic:
  - **Query relaxation ladder**: LLM-written AND-chains return zero children on Reddit's
    pseudo-boolean search even for huge subreddits. Each query runs as full → drop-NOT →
    OR-of-core-terms until something answers (`liveApi.ts queryVariants`).
  - **Embedded visible-Chrome lane** (`src/pgm/mining/browserFetch.ts`): when the direct
    pass yields only blocks/empties, the SAME ladder replays through one visible real-Chrome
    window (Playwright `channel:"chrome", headless:false`, seeded landing page, address-bar
    headers, ≥1.5 s request spacing, per-subreddit seed cache). A Chrome window opening
    during mining/probe is expected. Disable with `PGM_BROWSER_FETCH=0`; requires Google
    Chrome installed.
  - **Zero-record honesty**: if no source produced any record, stage 2 is reported as
    FAILED (`mining_no_reddit_data` / `failed_stage2_no_reddit_data`) with a loud banner —
    never as a completed step.
- **Rate & blocking reality**: ~10 requests/min/IP unauthenticated, enforced opaquely.
  Live tier-2 fetching during event day is best-effort bonus grounding only.
- **Pre-event cache refresh is effectively mandatory** (PGM-K2-05): run
  `scripts/refresh-cache.ts --subreddits … --months 6` (residential connection; it uses
  the same Chrome fallback automatically) within 48 h before event day.
- **Optional-token fallback** (PGM-K2-04):

  | `REDDIT_API_TOKEN` | Behavior |
  |---|---|
  | Unset (the permanent normal case) | Silent keyless mode per above — never an error, never warning-level logged |
  | Set | `oauth.reddit.com` + `Authorization: Bearer …` exactly as pre-DP-K2; higher rate limits, nothing else changes |

The listing envelope is identical on both paths (`data.children[].data`), so
`normalizeChild()` and ingest-time author stripping (PGM-06) are unchanged, as is the
local-cache shard format (6.12).

## Comments staleness caveat (PGM-05)

Submissions are the default mining subset. Comments require BOTH
`PGM_ENABLE_COMMENTS=1` AND `mining.include_comments:true` (double opt-in);
every comment-derived record then carries `source_subset:"comments"` plus a
`staleness_warning`, and `pitch_candidates.md` renders a ⚠️ badge per
comment-derived evidence. Caveat text (DP-K §5.3, frozen):

> The default underlying archive's comment coverage is known to lag its submission coverage by ~2 years as of this writing. Silently mixing stale comment data by default would misrepresent evidence recency. Comments are therefore opt-in only; when enabled, every comment-derived record is flagged with `staleness_warning`.

## Time budget (PGM-12 — the documented promise)

| Scope | Figure |
|---|---|
| End-to-end (Stages 1–4) | **p50 ≤ 22 min, p95 ≤ 25 min** |
| Hard ceiling | **28 minutes** wall-clock from driver start |

These figures match `config/pgm.json` `time_budget` exactly (`p50_minutes:22`,
`p95_minutes:25`, `ceiling_minutes:28`). At the ceiling the orchestrator
(`src/pgm/pipeline.ts`) aborts via `AbortController`, surfaces whatever partial
outputs exist (`personas(.partial).json`, `mined_frustrations(.partial).json`,
`pitch_candidates(.partial).md`), writes
`run.json{status:"partial_ceiling", completed_stages, elapsed_ms, ceiling_ms}`
and exits **degraded-but-zero** — never an unhandled throw (GOV-RES-01).

Measured orchestration overhead (stubbed LLM + stubbed data source, 10 runs)
is recorded by `src/pgm/scripts/bench-pgm-budget.ts` to
`reports/bench/pgm-budget.json` (BENCH-03). The stubbed bench validates
orchestration + manifest invariants; the live-API budget above is the promise.

## Failure & fallback (PGM-RES-01 / IDEA-01 whole-module fallback)

PGM never throws unhandled, never hangs (per-call RES-01 timeouts), never
requires cross-event state (PGM-RES-02). Any single stage degrades to a
`DegradedResult` + `run.json{status: degraded_stage1|partial_mining_degraded|
mining_no_reddit_data|degraded_stage3|degraded_stage4}`. Zero-record mining is
reported as **`mining_no_reddit_data`** with stage 2 excluded from
`completed_stages` (`stage_statuses.stage2:"failed_no_reddit_data"`) — a
failure, never a completed step. Stages 3–4 still run ungrounded so partial
value survives; single-stage reruns report
`failed_stage2_no_reddit_data`.

The manual `IDEA-01` worksheet (`src/ideation/idea/worksheet.md`) remains a
**fully independent fallback for the entire module** — not just one stage —
usable the moment PGM is excluded from an assembly or fails outright. IDEA-01
takes the same `hackathon_brief.md` and produces a shortlist of problem
framings with its own why-now filter (`IDEA-02`). Either output can feed ADV.
PGM does not replace IDEA-01, and IDEA-01 does not depend on PGM.

## CLI (PGM-13)

See `pgm --help` (TS: `src/pgm/cli.ts`, Python wrapper: `src/pgm/cli.py`).
Each stage re-runs against its own input file with NO upstream invocation:
stage 3 reads `mined_frustrations.json` (+brief) only; stage 4 reads
`pitch_candidates.json` + brief + catalog only — stages 3–4 never fetch Reddit.
Outputs land only in the centralized per-event dir (default `hackathon-projects/<name>`; gitignored planning outputs, legacy `private/pgm` still accepted).
