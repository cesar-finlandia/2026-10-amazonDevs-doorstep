# Requirement IDs: PROFILE-01, PROFILE-05, PROFILE-07
"""Public entry of the Event Profile Extractor (DP-L §9.1) — Python mirror of
src/profile/index.ts. Consumers import only this package surface."""

from src.profile.validate import (
    SCHEMA_PATH as EVENT_PROFILE_SCHEMA_PATH_ALIAS,
    validate_event_profile,
)
from src.profile.extractor import (
    EVENT_PROFILE_SCHEMA_PATH,
    EXTRACT_TEMPLATE_PATH,
    EXTRACTION_RESILIENCE_CONFIG,
    NOT_EXTRACTED,
    blank_template,
    compute_not_extracted,
    dedup_strings,
    extract_event_profile,
    load_event_profile_schema,
    normalize,
    parse_llm_json,
    render_extract_prompt,
    run_profile_extract_brief,
    sha256_hex,
    write_atomically,
)

__all__ = [
    "EVENT_PROFILE_SCHEMA_PATH",
    "EXTRACT_TEMPLATE_PATH",
    "EXTRACTION_RESILIENCE_CONFIG",
    "NOT_EXTRACTED",
    "blank_template",
    "compute_not_extracted",
    "dedup_strings",
    "extract_event_profile",
    "load_event_profile_schema",
    "normalize",
    "parse_llm_json",
    "render_extract_prompt",
    "run_profile_extract_brief",
    "sha256_hex",
    "write_atomically",
    "validate_event_profile",
    "EVENT_PROFILE_SCHEMA_PATH_ALIAS",
]
