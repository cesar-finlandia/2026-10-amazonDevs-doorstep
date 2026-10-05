# Requirement IDs: PGM-12, PGM-13, PGM-05, PGM-11, GOV-RES-01, XCUT-08
"""`pgm` — Problem Grounding & Market-Discovery Engine CLI (DP-K §9.2).

Python twin of src/pgm/cli.ts. The engine itself lives in TypeScript
(src/pgm/pipeline.ts — stages, RES-01 wrappers, hard-ceiling orchestration);
this wrapper owns the exact §9.2 argument surface on the Python side and
delegates verbatim, so flags, help text and exit codes stay byte-compatible:

  pgm run --brief <file> --out <dir> [--config config/pgm.json]
          [--refresh-cache] [--with-comments]
  pgm (--stage {1..4}|stage1..4) --input <file> --out <dir>
      [--brief <file>] [--catalog <file>] [--candidates N] [--personas N]
      [--config <file>] [--with-comments]
  pgm --validate <file>          # RES-04 dry-run, no write
  pgm --refresh-cache [--subreddits a,b] [--months 6]
  pgm --help

Exit codes: 0 ok/degraded-but-zero (GOV-RES-01 — partial_ceiling still exits 0)
· 1 usage error / failed validation · 2 dispatch failure.

Caveats surfaced by --help:
  - PGM-05 Reddit evidence staleness (check captured_at before trusting).
  - PGM-11 role→model routing lives ONLY in config/model-profiles.json.
  - PGM-13 per-stage re-runs need NO upstream invocation (S3 = mined file +
    brief; S4 = candidates + brief + catalog; never Reddit).

Packaging note: wired via pyproject.toml [project.scripts] as
`pgm = "src.pgm.cli:main"`; equivalent to `python3 -m src.pgm.cli`.
Stdlib only (argparse/subprocess/sys).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

__all__ = ["main", "build_parser"]

REPO_ROOT = Path(__file__).resolve().parents[2]
TS_CLI = REPO_ROOT / "src" / "pgm" / "cli.ts"

EPILOG = """caveats:
  PGM-05  evidence staleness: verify captured_at in mined_frustrations.json
           before trusting freshness-sensitive outputs; comments carry extra
           identity risk and are off unless doubly opted in.
  PGM-11  roles/models resolve via config/model-profiles.json ONLY
           (pgm_deconstructor / pgm_miner_query / pgm_synthesizer ->
           analyst-balanced; pgm_selector -> strong-reasoning). Never hardcode.
  PGM-13  per-stage examples (centralized layout):
            pgm --stage 2 --input hackathon-projects/<name>/personas.json --out hackathon-projects/<name>
            pgm --stage 3 --input hackathon-projects/<name>/mined_frustrations.json \
--brief hackathon-projects/<name>/hackathon_brief.md --out hackathon-projects/<name> --candidates 12
            pgm --stage 4 --input hackathon-projects/<name>/pitch_candidates.json \
--brief hackathon-projects/<name>/hackathon_brief.md --out hackathon-projects/<name> \
--catalog contracts/component-catalog.json

budget (PGM-12): p50 <=22 min, p95 <=25 min; hard ceiling 28 min -> partial
outputs + run.json{status:"partial_ceiling"}, degraded-but-zero exit.
"""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pgm",
        description="Problem Grounding & Market-Discovery Engine (DP-K §9).",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("mode", nargs="?", choices=["run"], help="full S1→S4 pipeline")
    parser.add_argument("--stage", type=int, choices=[1, 2, 3, 4], help="single stage vs its own input (PGM-13)")
    parser.add_argument("--brief", metavar="FILE", help="hackathon_brief.md (run/stage 1; used by stages 3/4)")
    parser.add_argument("--input", metavar="FILE", help="stage input: personas|mined_frustrations|pitch_candidates .json")
    parser.add_argument("--out", metavar="DIR", default=str(Path("hackathon-projects")), help="centralized planning output dir (default hackathon-projects/<Hackathon-project-name>; legacy private/pgm still accepted)")
    parser.add_argument("--catalog", metavar="FILE", default=None, help="component catalog for stage 4")
    parser.add_argument("--config", metavar="FILE", default=str(REPO_ROOT / "config" / "pgm.json"), help="default config/pgm.json (PGM-04/11/12)")
    parser.add_argument("--candidates", type=int, metavar="N", help="override pgm.candidates.count")
    parser.add_argument("--personas", type=int, metavar="N", help="override pgm.personas.count")
    parser.add_argument("--with-comments", action="store_true", help="request comment evidence (also needs PGM_ENABLE_COMMENTS=1 + config flag, PGM-05)")
    parser.add_argument("--validate", metavar="FILE", help="RES-04 schema dry-run; no write")
    parser.add_argument("--refresh-cache", action="store_true", help="tier-1 cache refresh outside event window (6.12)")
    parser.add_argument("--subreddits", metavar="A,B", help="--refresh-cache watchlist override")
    parser.add_argument("--months", type=int, metavar="N", help="--refresh-cache recency window (default 6)")
    parser.add_argument("--llm", choices=["sweep"], help="dispatch S1/S3/S4 LLM calls through run_sweep.sh --chat")
    parser.add_argument("--sweep-role", default="standard", help="models.json role for chat turns (default standard)")
    parser.add_argument("--llm-timeout-ms", type=int, help="per-call resilience budget when a transport is active (default 900000)")
    parser.add_argument("--ceiling-minutes", type=int, help="override time_budget.ceiling_minutes for this run")
    return parser


def _passthrough(ns: argparse.Namespace) -> List[str]:
    """Mirror parsed args onto the TS CLI's exact flag names."""
    argv: List[str] = []
    if ns.mode == "run":
        argv.append("run")
    if ns.stage is not None:
        argv += ["--stage", str(ns.stage)]
    if ns.brief:
        argv += ["--brief", ns.brief]
    if ns.input:
        argv += ["--input", ns.input]
    if ns.out:
        argv += ["--out", ns.out]
    if ns.catalog:
        argv += ["--catalog", ns.catalog]
    if ns.config:
        argv += ["--config", ns.config]
    if ns.candidates is not None:
        argv += ["--candidates", str(ns.candidates)]
    if ns.personas is not None:
        argv += ["--personas", str(ns.personas)]
    if ns.with_comments:
        argv.append("--with-comments")
    if ns.validate:
        argv += ["--validate", ns.validate]
    if ns.refresh_cache:
        argv.append("--refresh-cache")
    if ns.subreddits:
        argv += ["--subreddits", ns.subreddits]
    if ns.months is not None:
        argv += ["--months", str(ns.months)]
    if ns.llm:
        argv += ["--llm", ns.llm, "--sweep-role", ns.sweep_role]
    if ns.llm_timeout_ms is not None:
        argv += ["--llm-timeout-ms", str(ns.llm_timeout_ms)]
    if ns.ceiling_minutes is not None:
        argv += ["--ceiling-minutes", str(ns.ceiling_minutes)]
    return argv


def _ts_cli_argv(argv: List[str]) -> List[str]:
    """Node/vite-node invocation of the TS CLI (single engine owner)."""
    vite_node = REPO_ROOT / "node_modules" / "vite-node" / "vite-node.mjs"
    if vite_node.exists():
        return ["node", str(vite_node), str(TS_CLI), *argv]
    # npx on PATH; shell=True needed on Windows where npx is a .cmd shim.
    return ["npx", "vite-node", str(TS_CLI), *argv]


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    ns = parser.parse_args(argv)
    args = _passthrough(ns)
    try:
        needs_shell = _ts_cli_argv(args)[0] == "npx" and os.name == "nt"
        proc = subprocess.run(_ts_cli_argv(args), cwd=str(REPO_ROOT), shell=needs_shell)
        return proc.returncode
    except KeyboardInterrupt:
        return 130
    except OSError as err:  # GOV-RES-01: degraded-but-zero reporting, never raise
        print(f"error: cannot launch pgm engine: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
