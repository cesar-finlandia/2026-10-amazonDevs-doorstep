# Requirement IDs: PROFILE-07, PGM-11 (XCUT-08)
"""Profile-side role→model resolution for the Event Profile Extractor.

Python mirror of src/profile/roles.ts — DP-L §7 / master_blueprint §6.14.

- THE single read path for PROFILE role routing is the SHARED
  config/model-profiles.json (exactly one routing file; PROFILE-07): this
  module reads it directly like advisor llm.py does — Python has no pgm roles
  module to re-export (src/pgm is TypeScript-only besides its CLI wrapper),
  so this is the same parser contract, never a second routing file.
- Tolerates BOTH documented shapes (PGM-11 / DP-K §8): string-form roles
  ("profile_extractor": "analyst-balanced", profiles under "profiles") and
  object-form roles ("profile_extractor": {"model_profile": ...}, profiles
  under "model_profiles"). The tests-only PGM_ROLES_FILE env override is
  honored exactly like src/pgm/roles.ts.
- Unlike PGM (whose stages must throw rather than silently mis-route),
  PROFILE applies the advisor-style GOV-RES-02 contract on top: absent or
  malformed shared config → warn ONCE + safe defaults
  (profile_extractor → analyst-balanced, synthetic generic-heuristic
  provider so the offline bench keeps working) — NEVER a raise.
- No hardcoded provider/model strings live in src/profile/: everything is
  resolved from the shared file's profile entries (GOV-REU-02). The only
  literals below are the two documented safe-default NAMES.
- Outbound calls made here are plain JSON-mode chat completions; RES-01/
  RES-04 wrapping (timeout/retry/repair) belongs to the extractor
  (DP-L §4.3–§4.4), not to this routing module.
"""

from __future__ import annotations

import json
import os
import warnings
from pathlib import Path
from typing import Any, Dict, Optional

_REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_PROFILES_PATH = _REPO_ROOT / "config" / "model-profiles.json"

#: The one role PROFILE uses today; new roles are additive config entries (§7).
ProfileRole = str

#: Default model_profile for profile_extractor per DP-L §7 table (analyst task).
DEFAULT_PROFILE_MODEL_PROFILE = "analyst-balanced"

#: Safe-default routing used ONLY when the shared file is absent/malformed or
#: lacks the role (GOV-RES-02): synthetic heuristic provider keeps the offline
#: bench functional — no network, deterministic output, never a raise.
#: Temperature 0.2 mirrors the DP-L §7 analyst-balanced example entry.
DEFAULT_PROFILE_ROLE_CONFIG: Dict[str, Any] = {
    "provider": "generic-heuristic",
    "model": DEFAULT_PROFILE_MODEL_PROFILE,
    "temperature": 0.2,
    "max_tokens": 4000,
}

_warned_fallback = False


def _warn_once(message: str) -> None:
    global _warned_fallback
    if not _warned_fallback:
        _warned_fallback = True
        warnings.warn(f"[profile] warn: {message}")


def resolve_roles_file_path() -> Path:
    """Roles file path; PGM_ROLES_FILE env override is tests-only by convention."""
    override = os.environ.get("PGM_ROLES_FILE", "").strip()
    return Path(override) if override else MODEL_PROFILES_PATH


def _read_roles_doc(path: Path) -> Dict[str, Any]:
    """Parse the roles file; raises ValueError/OSError on absent/malformed."""
    parsed = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError(f"roles file is not an object: {path}")
    return parsed


def _profile_name_for_role(doc: Dict[str, Any], role: str) -> str:
    """Shape A string form or Shape B {model_profile} object → profile name."""
    roles = doc.get("roles")
    entry = roles.get(role) if isinstance(roles, dict) else None
    if isinstance(entry, str) and entry.strip():
        return entry.strip()
    if isinstance(entry, dict):
        mp = entry.get("model_profile")
        if isinstance(mp, str) and mp.strip():
            return mp.strip()
    raise ValueError(f"Unknown role {role} — check {resolve_roles_file_path()} (PGM-11)")


def _resolve_profile(doc: Dict[str, Any], name: str) -> Dict[str, Any]:
    """Profile entry under 'profiles' (Shape A) or 'model_profiles' (Shape B)."""
    raw: Any = None
    for key in ("profiles", "model_profiles"):
        table = doc.get(key)
        if isinstance(table, dict):
            raw = table.get(name)
            if isinstance(raw, dict):
                break
    if not isinstance(raw, dict):
        raise ValueError(
            f"Unknown model_profile {name} — check {resolve_roles_file_path()} (PGM-11)"
        )
    provider = raw.get("provider")
    model = raw.get("model")
    if not (isinstance(provider, str) and provider.strip()) or not (
        isinstance(model, str) and model.strip()
    ):
        raise ValueError(
            f"model_profile {name} lacks provider/model in {resolve_roles_file_path()} (PGM-11)"
        )
    temperature = raw["temperature"] if isinstance(raw.get("temperature"), (int, float)) else 0.4
    config: Dict[str, Any] = {
        "provider": provider,
        "model": model,
        "temperature": float(temperature),  # DP-K §8 analyst default
    }
    if isinstance(raw.get("max_tokens"), (int, float)):
        config["max_tokens"] = int(raw["max_tokens"])  # type: ignore[assignment]
    return config


def get_model_for_profile_role(role: ProfileRole = "profile_extractor") -> Dict[str, Any]:
    """Resolve {provider, model, temperature[, max_tokens]} for a PROFILE role.

    Reads the ONE shared routing file fresh per call so config edits apply
    without a process restart. Absent/malformed file, unknown role or unknown
    model_profile → warn ONCE + GOV-RES-02 safe defaults — NEVER raises
    (unlike the PGM stages, extraction must not crash on config trouble).
    """
    try:
        doc = _read_roles_doc(resolve_roles_file_path())
        return _resolve_profile(doc, _profile_name_for_role(doc, role))
    except (OSError, ValueError) as err:
        _warn_once(
            f"profile config invalid ({err}); using defaults "
            f"(role {role} → {DEFAULT_PROFILE_MODEL_PROFILE}, provider generic-heuristic)"
        )
        return dict(DEFAULT_PROFILE_ROLE_CONFIG)


def call_llm_for_profile(
    prompt: str,
    opts: Optional[Dict[str, Any]] = None,
    role: ProfileRole = "profile_extractor",
) -> str:
    """JSON-mode LLM call for PROFILE (mirror of roles.ts callLlmForProfile).

    Resolves provider/model/temperature/max_tokens from the profile entry
    (never hardcoded); ``opts['temperature']`` overrides the role temperature
    (used by the RES-04 repair round-trip, 0.1); ``role`` is the CLI ``--role``
    override resolved through THIS shared module (§7/§9.3 behavior gate 2 —
    malformed config → warn + defaults upstream), then:
    - provider "generic-heuristic" → deterministic all-null five-fact-group
      JSON (offline bench; fabrication-free per prompt rule 6);
    - any other provider → OPENAI_API_KEY/OPENAI_BASE_URL chat completion.
      Failures RAISE here by contract — the extractor's RES-01 wrapper
      degrades them into the blank template (DP-L §4.4).
    """
    cfg = get_model_for_profile_role(role)
    if opts and "temperature" in opts:
        cfg = {**cfg, "temperature": opts["temperature"]}
    if cfg["provider"] in ("generic-heuristic", "heuristic"):
        return synthetic_heuristic_response()
    return _openai_compatible_json_call(prompt, cfg)


def synthetic_heuristic_response() -> str:
    """Deterministic offline response: conservative all-null five-fact-group
    object — parseable, schema-shaped, fabrication-free (prompt rule 6). Real
    extraction needs a real model; the bench uses this to exercise plumbing,
    validation and fallback paths without network."""
    return json.dumps(
        {
            "mandated_platform": {"required": False, "name": None},
            "tracks": {"structure": "unknown", "sponsors": []},
            "video_limits": {"max_minutes": None, "section_boundaries": None},
            "submission_fields": None,
            "disclosure_required": None,
        }
    )


def _openai_compatible_json_call(prompt: str, cfg: Dict[str, Any]) -> str:
    """OpenAI-compatible chat completion in json_object mode (advisor-style)."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY not set — profile extractor cannot reach an LLM (offline path)"
        )
    try:
        import urllib.request

        base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
        payload = json.dumps(
            {
                "model": cfg["model"],
                "messages": [{"role": "user", "content": prompt}],
                "temperature": cfg["temperature"],
                **(
                    {"max_tokens": cfg["max_tokens"]}
                    if cfg.get("max_tokens") is not None
                    else {}
                ),
                "response_format": {"type": "json_object"},  # DP-L §4.2 structured output
            }
        ).encode("utf-8")
        request = urllib.request.Request(  # noqa: S310 — fixed https default, key via env
            f"{base_url}/chat/completions",
            data=payload,
            headers={"content-type": "application/json", "authorization": f"Bearer {api_key}"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310 — RES-01 governs budget
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        if not content:
            raise RuntimeError("profile LLM returned empty content")
        return str(content)
    except Exception as err:  # noqa: BLE001 — degrade upstream via extractor RES-01
        raise RuntimeError(f"profile LLM call failed: {err}") from err
