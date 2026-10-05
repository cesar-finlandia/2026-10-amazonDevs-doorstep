# Requirement IDs: PROFILE-01, PROFILE-02, PROFILE-03, PROFILE-04, PROFILE-06,
#   PROFILE-RES-01, PROFILE-RES-02, GOV-RES-02, GOV-RES-04, RES-01, RES-04
"""Event Profile Extractor — Python mirror of src/profile/extractor.ts.

DP-L §4 (extraction flow), §5 (fallback + flag):

- PROFILE-01: ONE generic LLM call on the happy path; at most one RES-04
  repair round-trip (exactly-one retry, DP-A §6.2). No loops, no cache.
- PROFILE-02 standalone: imports ONLY src/resilience (RES-01/RES-04),
  src.profile.roles (shared model-profiles reader) and the frozen contract
  contracts/event-profile.schema.json — never pgm/assembly/ideation/platform/
  context/media (CI-blocked, DP-L §4.5).
- PROFILE-03 budget: timeout_ms 18000, retries 1, exponential backoff base
  400ms; the CLI driver enforces the 40s hard ceiling.
- PROFILE-04/RES-02: every failure mode collapses to the SAME blank template
  with the literal marker "not extracted — confirm manually" (em dash U+2014)
  — never a raise to the caller, never an empty file, never a fabricated value.
- PROFILE-06: the mandated-platform flag is DATA ONLY (advisory).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import tempfile
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.resilience import (  # type: ignore[attr-defined]
    render_repair_prompt,
    repair,
    validate,
    with_resilience,
)

from src.profile.roles import call_llm_for_profile

PROFILE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PROFILE_DIR.parent.parent
EXTRACT_TEMPLATE_PATH = PROFILE_DIR / "prompts" / "extract.template.md"
EVENT_PROFILE_SCHEMA_PATH = REPO_ROOT / "contracts" / "event-profile.schema.json"

#: Literal marker per DP-L §5.1 — em dash U+2014, NEVER a hyphen.
NOT_EXTRACTED = "not extracted — confirm manually"

#: §4.4 RES-01 wrapping for BOTH primary and repair calls.
EXTRACTION_RESILIENCE_CONFIG: Dict[str, Any] = {
    "timeout_ms": 18_000,
    "retries": 1,
    "backoff": {"policy": "exponential", "base_ms": 400, "factor": 2.0, "max_ms": 3000, "jitter": True},
    "fallback_chain": {"order": ["none"]},  # no stale-cache fact fallback — would fabricate
}

_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?([\s\S]*?)\n?```$")


def render_extract_prompt(brief_text: str) -> str:
    """Render the checked-in generic template; the brief is the ONLY variable."""
    return EXTRACT_TEMPLATE_PATH.read_text(encoding="utf-8").replace("{{brief}}", brief_text)


def parse_llm_json(raw: str) -> Dict[str, Any]:
    """Defensive fenced-strip then JSON.parse (provider may ignore json_object)."""
    text = raw.strip()
    fence = _FENCE_RE.match(text)
    if fence and fence.group(1):
        text = fence.group(1).strip()
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("profile LLM output is not a JSON object")
    return parsed


def load_event_profile_schema() -> Dict[str, Any]:
    """The authoritative contract (repo integrity bug → loud failure)."""
    return json.loads(EVENT_PROFILE_SCHEMA_PATH.read_text(encoding="utf-8"))


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def dedup_strings(values: List[Any]) -> List[str]:
    """Order-preserving case-insensitive dedup (deterministic, no domain logic)."""
    seen: set[str] = set()
    out: List[str] = []
    for v in values:
        if not isinstance(v, str):
            continue
        key = v.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(v.strip())
    return out


def compute_not_extracted(raw: Dict[str, Any]) -> List[str]:
    """Groups left null/unknown by brief SILENCE — expected, not failure (§4.3)."""
    groups: List[str] = []
    platform = raw.get("mandated_platform") or {}
    tracks = raw.get("tracks") or {}
    video = raw.get("video_limits") or {}
    if platform.get("required") is None and platform.get("name") is None:
        groups.append("mandated_platform")
    structure = tracks.get("structure")
    sponsors = tracks.get("sponsors") or []
    if not structure or structure == "unknown" or len(sponsors) == 0:
        groups.append("tracks")
    if video.get("max_minutes") is None and video.get("section_boundaries") is None:
        groups.append("video_limits")
    if raw.get("submission_fields") is None:
        groups.append("submission_fields")
    if raw.get("disclosure_required") is None:
        groups.append("disclosure_required")
    return groups


def normalize(raw: Dict[str, Any], brief_hash: str) -> Dict[str, Any]:
    """Pure deterministic normalization — NO second LLM call (§4.3)."""
    video = raw.get("video_limits") or {}
    max_minutes = video.get("max_minutes") if isinstance(video.get("max_minutes"), (int, float)) else None
    max_seconds = round(max_minutes * 60) if max_minutes is not None else None
    platform = raw.get("mandated_platform") or {}
    req = bool(platform.get("required"))
    # The marker literal NEVER appears in extracted-status documents (schema
    # allOf[1] forbids it); a mandated platform whose name stayed null stays
    # null and surfaces via needs_human_confirm + flag("unknown").
    name = platform.get("name").strip() if isinstance(platform.get("name"), str) else None
    flag = (
        f"⚠️ MANDATED PLATFORM — {name or 'unknown'} — chassis likely doesn't apply — confirm manually"
        if req
        else None
    )
    tracks = raw.get("tracks") or {}
    return {
        "version": "1.0.0",
        "mandated_platform": {
            "required": req,
            "name": name,
            "flag": flag,
            "needs_human_confirm": req,
        },
        "tracks": {
            "structure": tracks.get("structure", "unknown"),
            "sponsors": dedup_strings(tracks.get("sponsors") or []),
        },
        "video_limits": {
            "max_minutes": max_minutes,
            "max_seconds": max_seconds,
            "section_boundaries": video.get("section_boundaries"),
        },
        "submission_fields": (
            dedup_strings(raw["submission_fields"])
            if isinstance(raw.get("submission_fields"), list)
            else raw.get("submission_fields")
        ),
        "disclosure_required": (
            raw["disclosure_required"] if isinstance(raw.get("disclosure_required"), bool) else None
        ),
        "not_extracted_fields": compute_not_extracted(raw),
        "raw_brief_hash": brief_hash,
        "extracted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "extraction_meta": {"status": "extracted", "not_extracted_marker": NOT_EXTRACTED},
    }


def blank_template(brief_hash: str) -> Dict[str, Any]:
    """Total-failure template (§5.1): EVERY field carries the literal marker."""
    return {
        "version": "1.0.0",
        "mandated_platform": {"required": False, "name": NOT_EXTRACTED, "flag": None, "needs_human_confirm": False},
        "tracks": {"structure": NOT_EXTRACTED, "sponsors": [NOT_EXTRACTED]},
        "video_limits": {
            "max_minutes": NOT_EXTRACTED,
            "max_seconds": NOT_EXTRACTED,
            "section_boundaries": NOT_EXTRACTED,
        },
        "submission_fields": [NOT_EXTRACTED],
        "disclosure_required": NOT_EXTRACTED,
        "not_extracted_fields": [
            "mandated_platform",
            "tracks",
            "video_limits",
            "submission_fields",
            "disclosure_required",
        ],
        "raw_brief_hash": brief_hash or "0" * 64,
        "extracted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "extraction_meta": {"status": "not-extracted", "not_extracted_marker": NOT_EXTRACTED},
    }


def render_extract_repair_prompt(errors: List[Dict[str, str]], original_output: str) -> str:
    """Generic repair re-prompt — DELEGATES to the single shared template

    (src/resilience/repair-prompt.template.md via RES-04's render_repair_prompt;
    DP-A §6.3) — never a bespoke profile copy.
    """
    return render_repair_prompt(errors, original_output)


#: Repair round-trips run colder than extraction (DP-L §4.3).
REPAIR_TEMPERATURE = 0.1


def apply_fabrication_guard(profile: Dict[str, Any], brief_text: str) -> Dict[str, Any]:
    """§8 row "LLM fabricates value" — MORE stringent than the schema alone.

    A value the LLM could only have invented (absent from the brief text) is
    demoted to the literal NOT_EXTRACTED marker and its group is added to
    not_extracted_fields. Because the frozen contract forbids the marker under
    extraction_meta.status=="extracted" (allOf[1]), any violation flips the
    document to status "not-extracted" — downstream then prompts a manual
    confirm instead of trusting a hallucinated fact. tracks.structure stays
    untouched (§8). Pure function; never calls the LLM.
    """
    import copy

    lower = brief_text.lower()
    violations: set[str] = set()
    out = copy.deepcopy(profile)

    # mandated_platform: required:true demands the name be a brief substring.
    name = out["mandated_platform"]["name"]
    if (
        out["mandated_platform"]["required"]
        and isinstance(name, str)
        and len(name) > 0
        and name.strip().lower() not in lower
    ):
        # Never echo the fabricated string anywhere — not in name, not in flag.
        out["mandated_platform"]["name"] = NOT_EXTRACTED
        out["mandated_platform"]["flag"] = None
        violations.add("mandated_platform")

    # sponsors: every non-empty sponsor entry must appear in the brief.
    sponsors = out["tracks"]["sponsors"]
    if len(sponsors) > 0:
        fabricated = any(
            isinstance(s, str) and len(s) > 0 and s.strip().lower() not in lower for s in sponsors
        )
        if fabricated:
            out["tracks"]["sponsors"] = [NOT_EXTRACTED]
            violations.add("tracks")

    if violations:
        out["extraction_meta"]["status"] = "not-extracted"
        merged = list(out["not_extracted_fields"])
        for group in sorted(violations):
            if group not in merged:
                merged.append(group)
        out["not_extracted_fields"] = merged
    return out


async def extract_event_profile(
    brief_text: str,
    brief_hash: str,
    deps: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """ONE LLM call happy path; at most one RES-04 repair round-trip; RES-01

    wrapping on BOTH calls. Raises only after ALL of that fails so the outer
    §5.1 driver can collapse to the blank template.

    ``deps['call_llm']`` optionally injects a transport (tests/bench stubs;
    mirrors pgm resilientCall DI); defaults to the shared routing.
    """
    call_llm = (deps or {}).get("call_llm", call_llm_for_profile)
    prompt = render_extract_prompt(brief_text)  # generic; brief is the only variable
    resilient_call = with_resilience(lambda: call_llm(prompt), EXTRACTION_RESILIENCE_CONFIG)
    out = resilient_call()  # str | DegradedResult — both non-str outcomes mean failure
    if not isinstance(out, str):
        reason = out.get("reason", "unknown") if isinstance(out, dict) else str(out)
        raise RuntimeError(f"profile extraction degraded: {reason}")
    parsed = parse_llm_json(out)

    # The frozen contract requires the FULL document shape and gates the
    # marker literal by status — validation runs on the NORMALIZED candidate,
    # never on the bare 5-group raw object. The fabrication guard runs BEFORE
    # validation so a sanitized document is what gets checked (and what
    # repair, if ever needed, starts from).
    schema = load_event_profile_schema()
    candidate = apply_fabrication_guard(normalize(parsed, brief_hash), brief_text)
    first = validate(schema, candidate)
    if not first["valid"]:
        # Exactly ONE repair round-trip via RES-04 (DP-A §6.2) using the SHARED
        # generic re-prompt template; temperature 0.1 (§4.3). Its raise means
        # total failure → caller writes the blank template.
        async def _repair_call(re_prompt: str) -> str:
            raw = call_llm(re_prompt, {"temperature": REPAIR_TEMPERATURE})
            if asyncio.iscoroutine(raw):
                raw = await raw
            second = parse_llm_json(raw)
            return json.dumps(
                apply_fabrication_guard(normalize(second, brief_hash), brief_text),
                ensure_ascii=False,
            )

        repaired = await repair(
            schema,
            candidate,
            lambda errs: render_repair_prompt(errs, out),
            _repair_call,
        )
        return repaired["data"]
    return candidate


def write_atomically(out_path: str | os.PathLike[str], profile: Dict[str, Any]) -> None:
    """Atomic write: tmp + rename in the SAME dir — no partial file, no empty file."""
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(profile, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


class BriefInsufficientError(RuntimeError):
    """§5.1/§8: empty, severely short, <5 whitespace-tokens or NUL-byte brief
    — NO LLM call is made; the driver maps this straight to the blank template."""

    reason = "brief_insufficient"


class ProfileWriteError(RuntimeError):
    """§8 row "Output path unwritable": the ONLY failure the driver surfaces
    to its caller (CLI maps it to exit 1 with a clear message; no raw stack)."""

    def __init__(self, path: str, cause: BaseException) -> None:
        super().__init__(f"profile extract failed to write {path}: {cause}")
        self.path = path
        self.cause_exc = cause


#: PROFILE-03 hard ceiling (§4.6/§8): the driver aborts extraction at 40 s and
#: falls back to the blank template — Hour-0 progress never blocks.
PROFILE_HARD_CEILING_SECONDS = 40.0


def read_event_profile(path: str) -> Dict[str, Any]:
    """Consumer read path (DP-L §9.1 index exports): parse + RES-04 validate.

    Raises on unreadable/malformed/schema-invalid files — consumers apply
    their own RES rules around this advisory input; silent bad data is worse.
    """
    raw = Path(path).read_text(encoding="utf-8")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"event profile not valid JSON at {path}: {exc}") from exc
    result = validate(load_event_profile_schema(), parsed)
    if not result["valid"]:
        first = result["errors"][0] if result["errors"] else None
        detail = f"{first['path']} [{first['code']}]: {first['message']}" if first else "unknown error"
        raise ValueError(
            f"event profile at {path} fails contracts/event-profile.schema.json: {detail}"
        )
    return parsed


def _assert_brief_content(text: str) -> None:
    """§8 binary/brief heuristics: NUL byte or <5 whitespace-separated tokens."""
    if "\x00" in text:
        raise BriefInsufficientError("brief looks binary (NUL byte present)")
    if len([t for t in re.split(r"\s+", text) if t]) < 5:
        raise BriefInsufficientError("brief has fewer than 5 whitespace-delimited tokens")


def _write_or_throw(out_path: str, profile: Dict[str, Any]) -> None:
    try:
        write_atomically(out_path, profile)
    except OSError as err:
        raise ProfileWriteError(str(out_path), err) from err


def run_profile_extract_brief(
    brief_path: str,
    out_path: str,
    deps: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Catch-all CLI driver (§5.1 pseudocode, GOV-RES-04): EVERY failure mode

    — unreadable/short/binary brief, RES-01 exhaustion, corrupt JSON, failed
    repair, 40 s hard ceiling — collapses to writing the blank template.
    NEVER raises except for an UNWRITABLE OUTPUT PATH (ProfileWriteError).
    Returns {status, out_path, brief_hash, reason} for CLI exit decisions.
    """
    hash_value = "0" * 64
    try:
        try:
            text = Path(brief_path).read_text(encoding="utf-8")
            hash_value = sha256_hex(text)
        except OSError as read_err:
            raise RuntimeError(f"brief unreadable: {read_err}") from read_err
        if len(text.strip()) < 20:
            raise BriefInsufficientError("brief empty or severely short")
        _assert_brief_content(text)  # NUL byte / <5 tokens → no LLM call (PROFILE-RES-02)
        try:
            # Hard ceiling wraps ONLY the extraction (PROFILE-03); fallback writes stay under it.
            profile = asyncio.run(
                asyncio.wait_for(
                    extract_event_profile(text, hash_value, deps),
                    timeout=PROFILE_HARD_CEILING_SECONDS,
                )
            )
            _write_or_throw(out_path, profile)  # ProfileWriteError propagates — never blank-mapped
            return {
                "status": profile["extraction_meta"]["status"],
                "out_path": out_path,
                "brief_hash": hash_value,
                "reason": None,
            }
        except ProfileWriteError:
            raise
        except Exception as llm_or_validation_error:  # noqa: BLE001 — collapse to blank
            _write_or_throw(out_path, blank_template(hash_value))
            warnings.warn(f"[profile] extraction failed — wrote blank template: {llm_or_validation_error}")
            return {"status": "not-extracted", "out_path": out_path, "brief_hash": hash_value, "reason": "extraction_failed"}
    except ProfileWriteError:
        raise
    except Exception as brief_read_error:  # noqa: BLE001 — outer guard, never raise
        _write_or_throw(out_path, blank_template(hash_value))
        warnings.warn(f"[profile] brief unreadable — wrote blank template: {brief_read_error}")
        reason = getattr(brief_read_error, "reason", "brief_unreadable")
        return {"status": "not-extracted", "out_path": out_path, "brief_hash": hash_value, "reason": reason}
