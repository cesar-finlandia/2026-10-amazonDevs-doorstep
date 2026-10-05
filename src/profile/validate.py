# Requirement IDs: PROFILE-01, RES-04
"""Thin wrapper over src/resilience/validate for the event-profile schema —
DP-L §9.2 (non-duplicate): all jsonschema logic stays in RES-04; this module
only pins the frozen contract contracts/event-profile.schema.json so callers
never hand-roll schema loading or re-implement validation. Python mirror of
src/profile/validate.ts. Absent/malformed schema raises loudly (repo integrity
bug, not a runtime degradation)."""

from __future__ import annotations

from typing import Any, Dict

from src.profile.extractor import EVENT_PROFILE_SCHEMA_PATH, load_event_profile_schema
from src.resilience import validate

__all__ = [
    "EVENT_PROFILE_SCHEMA_PATH",
    "SCHEMA_PATH",
    "load_event_profile_schema",
    "validate_event_profile",
]

# Alias kept for parity with validate.ts's SCHEMA_PATH export.
SCHEMA_PATH = EVENT_PROFILE_SCHEMA_PATH


def validate_event_profile(data: Any) -> Dict[str, Any]:
    """Validate one parsed EventProfile document against the frozen contract."""
    return validate(load_event_profile_schema(), data)
