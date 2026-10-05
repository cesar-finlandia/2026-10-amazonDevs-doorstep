# Requirement IDs: PROFILE-01, PROFILE-02, PROFILE-06, XCUT-06
"""`profile` — Event Profile Extractor CLI (DP-L §9.3).

  profile extract --brief hackathon_brief.md --out event_profile.json
      [--role profile_extractor] [--json]
  profile --brief hackathon_brief.md --out event_profile.json   # alias form
  profile extract --validate <file> --brief <file>              # RES-04 dry-run + hash
  profile --validate <file> [--brief <file>]   # RES-04 dry-run, no LLM
  profile --show-flag <file>                   # distinct mandated-platform line
  profile --help

Exit codes: 0 on ANY successful write (`extracted` AND `not-extracted` are
successful writes per §9.3 rule 5) · 1 usage error / failed validation /
writeAtomically I-O failure. The mandated-platform flag is DATA ONLY
(PROFILE-06/NONGOAL-17): nothing here gates or disables any chassis component.

Wired via pyproject.toml [project.scripts] as `profile = "src.profile.cli:main"`.
Stdlib only (argparse/sys).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from src.profile.extractor import (
    NOT_EXTRACTED,
    ProfileWriteError,
    load_event_profile_schema,
    run_profile_extract_brief,
    sha256_hex,
)
from src.profile.roles import call_llm_for_profile
from src.resilience import validate

HELP_EPILOG = (
    "Advisory note (PROFILE-05): every field in event_profile.json is an "
    "OPTIONAL runtime-configuration default — consumers stay functional when "
    "the file is absent or extraction failed.\n"
    "Mandated-platform warning (PROFILE-06): a ⚠️ flag means the brief mandates "
    "a specific build platform — this is a prompt for a MANUAL human decision; "
    "no component is disabled automatically."
)


# §5.2 distinctness rules (verification item 3): a mandated flag MUST carry the
# sentinel prefix, embed {name} verbatim and end with the exact tail phrase.
FLAG_SENTINELS = ("⚠️ MANDATED PLATFORM —", "!!! MANDATED PLATFORM —")
FLAG_TAIL = "chassis likely doesn't apply — confirm manually"


def check_flag_distinctness(data: dict) -> list[tuple[str, str, str]]:
    """§9.3 ``--validate`` extra gate: flag distinctness when required:true.

    Returns (path, code, message) triples in validation-error.schema.json shape.
    Never runs when required is not exactly true (blank template → no gate).
    """
    mp = data.get("mandated_platform") if isinstance(data, dict) else None
    if not isinstance(mp, dict) or mp.get("required") is not True:
        return []
    errors: list[tuple[str, str, str]] = []
    flag = mp.get("flag")
    if not isinstance(flag, str) or not flag.strip():
        errors.append(
            (
                "mandated_platform.flag",
                "flag/required-when-mandated",
                'required:true demands a non-null flag with a MANDATED PLATFORM sentinel',
            )
        )
        return errors
    if not flag.startswith(FLAG_SENTINELS):
        errors.append(
            (
                "mandated_platform.flag",
                "flag/sentinel-prefix",
                'must start with "⚠️ MANDATED PLATFORM —" or "!!! MANDATED PLATFORM —"',
            )
        )
    if not flag.endswith(FLAG_TAIL):
        errors.append(
            (
                "mandated_platform.flag",
                "flag/tail-language",
                f'must end with the exact phrase "{FLAG_TAIL}"',
            )
        )
    name = mp.get("name")
    if isinstance(name, str) and name.strip() and f"— {name} —" not in flag:
        errors.append(
            (
                "mandated_platform.flag",
                "flag/name-embedded",
                f"must embed the extracted platform name verbatim (— {name} —)",
            )
        )
    return errors


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="profile",
        description="Event Profile Extractor — advisory platform facts from hackathon_brief.md",
        epilog=HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--validate", metavar="FILE", help="dry-run: validate event_profile.json against the frozen schema (exit 0 valid / 1 invalid); also checks flag distinctness when required:true")
    parser.add_argument("--show-flag", metavar="FILE", help="print ONLY the mandated_platform.flag line ('(no mandated platform)' when null)")
    # Alias form (§9.3): `profile --brief … --out …` == `profile extract …`.
    parser.add_argument("--brief", metavar="FILE", default=None, help=argparse.SUPPRESS)
    parser.add_argument("--out", metavar="FILE", default=None, help=argparse.SUPPRESS)
    parser.add_argument("--role", default=None, help=argparse.SUPPRESS)
    parser.add_argument("--json", action="store_true", help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command")
    ex = sub.add_parser("extract", help="extract event_profile.json from a brief (blank template on any failure, never throws)")
    ex.add_argument("--brief", required=True, help="path to hackathon_brief.md (free text)")
    ex.add_argument("--out", default=None, help="output path (default: <briefDir>/event_profile.json; parent auto-created)")
    ex.add_argument("--role", default=None, help="routing role key in the shared config/model-profiles.json (default profile_extractor)")
    ex.add_argument("--validate", metavar="FILE", default=None, help="dry-run: validate FILE against the frozen schema (+ --brief hash check), write nothing")
    ex.add_argument("--json", action="store_true", help="emit machine report to stdout alongside the human log")
    return parser


def _cmd_validate(file: str, brief: str | None) -> int:
    try:
        data = json.loads(Path(file).read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        print(f"[profile] invalid JSON/unreadable: {err}", file=sys.stderr)
        return 1
    result = validate(load_event_profile_schema(), data)
    if not result["valid"]:
        for e in result["errors"]:
            print(f"{e['path']} [{e['code']}]: {e['message']}", file=sys.stderr)
        return 1
    # §9.3 --validate gate: flag-distinctness when required:true (§5.2 rules).
    if isinstance(data, dict):
        distinct = check_flag_distinctness(data)
        for path, code, message in distinct:
            print(f"{path} [{code}]: {message}", file=sys.stderr)
        if distinct:
            return 1
    if brief:
        recorded = (data.get("raw_brief_hash") or "") if isinstance(data, dict) else ""
        text = Path(brief).read_text(encoding="utf-8")
        actual = sha256_hex(text)
        if recorded and recorded != actual and data.get("extraction_meta", {}).get("status") == "extracted":
            print(
                f"[profile] warn: raw_brief_hash stale (file {recorded[:12]}… vs brief {actual[:12]}…) — re-run profile extract",
                file=sys.stderr,
            )
    print(f"[profile] valid: {file}")
    return 0


def _cmd_show_flag(file: str) -> int:
    try:
        data = json.loads(Path(file).read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        print(f"[profile] invalid JSON/unreadable: {err}", file=sys.stderr)
        return 1
    flag = data.get("mandated_platform", {}).get("flag") if isinstance(data, dict) else None
    print(flag if flag else "(no mandated platform)")
    return 0


def _ensure_canonical_symlink(out_path: Path) -> None:
    """§9.3 behavior gate 3: after a successful write, make

    profile/event_profile.json → ../event_profile.json idempotent — only when
    a ``profile/`` dir already exists beside the output (or --out targets it,
    in which case the file already IS the canonical spot). Best-effort: a
    failed symlink (e.g. Windows without privilege) never fails the run.
    """
    parent = out_path.resolve().parent
    if parent.name == "profile":
        return  # --out targets profile/ — written file is already canonical
    link = parent / "profile" / "event_profile.json"
    if not link.parent.is_dir():
        return  # no profile/ dir → nothing to alias (§9.3 "when it exists")
    target = "../event_profile.json"
    try:
        if link.is_symlink():
            if os.readlink(link) == target:
                return  # idempotent — already correct
            link.unlink()
        elif link.exists():
            return  # real file occupies the spot — never clobber user data
        os.symlink(target, link)
        print(f"[profile] symlinked {link} → {target}")
    except OSError:
        pass  # advisory convenience only; extraction result stays intact


def _render_banner(profile: dict, status: str) -> None:
    """§5.2 rendering: flag on its own banner, never buried; manual-confirm

    language verbatim; blank template renders the not-extracted line instead.
    """
    mp = profile.get("mandated_platform", {})
    meta = profile.get("extraction_meta", {})
    print(
        f"[profile] extracted at {profile.get('extracted_at')}"
        f" — hash {(profile.get('raw_brief_hash') or '')[:8]}… — status: {status}"
    )
    if mp.get("required") and mp.get("flag"):
        name = mp.get("name") or "unknown"
        print()
        print("─" * 61)
        print(mp["flag"])  # §5.2: own line — sentinel + {name} + tail phrase
        print(f"   This hackathon's brief mandates a specific end-to-end build platform ({name}).")
        print("   The chassis's code components (Platform/Transport/Media) likely do not apply")
        print("   to this event. This is a prompt for a manual human decision — no component")
        print("   is being disabled automatically. Confirm with the team whether to proceed")
        print("   with the chassis or pivot to the mandated platform.")
        print("─" * 61)
    tracks = profile.get("tracks") or {}
    video = profile.get("video_limits") or {}
    sponsors = ", ".join(tracks.get("sponsors") or []) or "(none listed)"

    def _val(value: object) -> str:
        return str(value) if value not in (None, "") else NOT_EXTRACTED

    vmax = video.get("max_minutes")
    vmax_s = f"{vmax} min ({round(float(vmax) * 60)} s)" if isinstance(vmax, (int, float)) else _val(vmax)
    print(f"  Tracks: {_val(tracks.get('structure'))} — sponsors: {sponsors}")
    print(f"  Video: {vmax_s}")
    print(f"  Disclosure: {_val(profile.get('disclosure_required'))}")
    if status != "extracted":
        # §5.2 fallback rendering — explicit, never a silent null.
        print(
            f"mandated platform: {NOT_EXTRACTED} — verify brief manually — no assumption"
        )


def _cmd_extract(args: argparse.Namespace) -> int:
    brief = Path(args.brief)
    out = Path(args.out) if args.out else brief.parent / "event_profile.json"
    # §9.3 gate 2: role resolved through the SHARED roles module — never a
    # hardcoded provider/model here; malformed config warns + defaults there.
    role = args.role or "profile_extractor"
    deps = {"call_llm": lambda prompt, opts=None: call_llm_for_profile(prompt, opts, role)}
    try:
        outcome = run_profile_extract_brief(str(brief), str(out), deps=deps)
    except ProfileWriteError as err:
        # §9.3 rule 5: exit 1 ONLY here; no raw stack trace ever.
        try:
            brief_hash = sha256_hex(brief.read_text(encoding="utf-8"))
        except OSError:
            brief_hash = "0" * 64
        print(
            f"{err} — brief hash {brief_hash[:12]}…"
            " — re-run with --out <writable-dir>",
            file=sys.stderr,
        )
        return 1
    if args.json:
        print(json.dumps(outcome, ensure_ascii=False))
    out_path = Path(outcome["out_path"])
    try:
        profile = json.loads(out_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        profile = {}
    _render_banner(profile if isinstance(profile, dict) else {}, outcome["status"])
    if outcome["status"] != "extracted":
        reason = outcome.get("reason") or "unknown"
        print(f"[profile] warn: extraction failed ({reason}) — wrote blank template")
    _ensure_canonical_symlink(out_path)
    return 0  # both extracted AND not-extracted are successful writes (§9.3 rule 5)


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "extract" and getattr(args, "validate", None):
            # §9.3 alternative form: `profile extract --validate f --brief b`
            return _cmd_validate(args.validate, args.brief)
        if args.validate:
            return _cmd_validate(args.validate, getattr(args, "brief", None))
        if args.show_flag:
            return _cmd_show_flag(args.show_flag)
        if args.command == "extract":
            return _cmd_extract(args)
        if args.command is None and args.brief:
            # Alias invocation (§9.3): `profile --brief … [--out …] [--role …]`
            return _cmd_extract(args)
        parser.print_help()
        return 1
    except ProfileWriteError as err:  # defensive — _cmd_extract maps it above
        print(f"{err} — re-run with --out <writable-dir>", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
