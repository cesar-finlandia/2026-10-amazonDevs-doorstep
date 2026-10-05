# Event Profile Extractor (PROFILE) — M10

Requirement IDs: PROFILE-01..07, PROFILE-REU-01, PROFILE-RES-01/02, RES-01, RES-04
Design plan: `design_documents/design_plans/DP-L-event-profile-extractor.md`

## Purpose

Standalone extractor that turns a free-text `hackathon_brief.md` into an
advisory `event_profile.json` (five fact groups: mandated platform, tracks,
video limits, submission fields, AI disclosure) in ONE generic LLM call with at
most ONE RES-04 repair round-trip. It imports ONLY `src/resilience`, the shared
`src/pgm` role→model-profile file reader (`roles.ts` re-exports the single M09
resolver; Python reads `config/model-profiles.json` directly), and the frozen
contract `contracts/event-profile.schema.json`. No PGM/ADV/ideation/platform/
context/media coupling (DP-L §4.5).

## Example

```text
profile extract --brief hackathon_brief.md --out event_profile.json \
  [--role profile_extractor] [--json]
profile --validate event_profile.json [--brief hackathon_brief.md]
profile --show-flag event_profile.json
```

- Exit `0` on ANY successful write — both `extracted` and `not-extracted`
  outcomes are successful writes; exit `1` only for usage errors, failed
  validation dry-runs or I/O failures.
- Every failure mode (unreadable/empty brief, LLM timeout/exhaustion, corrupt
  JSON, failed repair) collapses to the SAME blank template whose every field
  carries the literal marker `not extracted — confirm manually` (em dash).
  The write is atomic (tmp + rename); no partial or empty files.
- Offline bench: route the `profile_extractor` role at a profile entry with
  `"provider": "generic-heuristic"` to get deterministic synthetic output
  without network (used by tests and the offline bench).

## Config

- **Role routing (PROFILE-07):** the single shared role→model_profile file
  `config/model-profiles.json` (alias `config/roles.yaml`) carries the
  `profile_extractor` entry. This module never hardcodes a provider/model and
  never keeps a second role file.
- **No-cache rule:** `PROFILE` never caches extraction results. Every run
  re-reads the brief and makes one fresh LLM call; `.cache/` is intentionally
  unused by this module (DP-L §8). Freshness is carried as data instead:
  `raw_brief_hash` pins the brief SHA-256 that produced the artifact so
  consumers (e.g. `TRACK-01`) can detect staleness and re-run.
- **Blank-template contract (PROFILE-04):** any failure (unreadable/empty
  brief, LLM exhaustion, corrupt JSON, failed repair) writes the SAME
  schema-valid blank template — every field the literal marker
  `not extracted — confirm manually`, `extraction_meta.status:
  "not-extracted"`, atomic tmp+rename write, never null silently, never an
  empty or missing file, never a throw.

## Advisory note

<!-- markdownlint-disable-next-line MD013 --><!-- verbatim per DP-L §5.2 -->
This output is advisory configuration only — the mandated-platform flag is a prompt for a manual human decision, never an automatic gate that disables any component.

Consumers (`ADV-01`, `SCRIPT-01`, `SUBMIT-03`, `TRACK-01`) must stay functional
when this module or its output file is absent.

## Consumption by ADV-01 (optional)

`ADV-01` treats `event_profile.json` (via `AdvisorInput.event_profile_path`)
as an OPTIONAL input: when present, brief normalization prefers the extracted
tracks structure / sponsors / mandated-platform flag over re-parsing raw brief
text; when the file is absent or stale, ADV falls back to reading
`hackathon_brief.md` directly and works unchanged (PROFILE-05). The only
permitted system-level reaction to `mandated_platform.required:true` is
advisory prose in `selection_rationale` ("flagged for manual confirmation per
PROFILE-06") — never manifest gating or component skipping.

## Consumption by SCRIPT-01 (optional)

`SCRIPT-01` uses `video_limits.max_seconds` as the DEFAULT timing budget for
the demo-video script; the CLI `--duration` flag overrides it per-invocation;
when the profile is absent or `max_seconds` was not extracted, SCRIPT falls
back to the 4-minute heuristic. Absence never blocks script generation.

## Consumption by SUBMIT-03 (optional)

`SUBMIT-03` uses `submission_fields` as the default submission label set and
auto-includes the disclosure checklist item when `disclosure_required:true`;
a manual `submit --fields` override wins over both. Without the profile,
SUBMIT falls back to its cataloged standard labels and still functions.

## Consumption by TRACK-01 (optional)

`TRACK-01` watches artifact freshness: it compares the current SHA-256 of
`hackathon_brief.md` against `raw_brief_hash` (and `extracted_at` vs the
brief mtime). On mismatch it reports "brief hash changed but profile hash
stale → re-run `profile extract`"; when the profile is simply absent, TRACK
degrades to "not present" without error.

## Layout

- `extractor.ts` / `extractor.py` — prompt render, RES-01 wrapping,
  validate+repair, normalize, blank template, atomic write, driver
- `validate.ts` / `validate.py` — thin wrapper pinning the frozen schema
  (RES-04 does all real work)
- `roles.ts` / `roles.py` — shared routing reader (PROFILE-07)
- `cli.ts` / `cli.py` — §9.3 argument surface
- `prompts/extract.template.md` — generic domain-free prompt (`{{brief}}`
  only)

Fixtures: `examples/dummy-fixtures/profile/` — fictional Acme Corp briefs and
expected profiles (NONGOAL-06: dummy content only).

## What this module does NOT contain

- No caching of extraction results (see no-cache rule above).
- No domain knowledge: the prompt template is generic (`{{brief}}` only) —
  all event facts live in the brief, never in code.
- No gating logic: nothing anywhere checks `mandated_platform.required` /
  `needs_human_confirm` to disable, skip, or exit a component (NONGOAL-17);
  the flag is data for a human decision.
- No dependency on other chassis components beyond `src/resilience` and the
  shared role file reader — no imports from assembly/ideation/platform/
  context/media (PROFILE-02, DP-L §4.5).
- No real event artifacts: only dummy Acme Corp fixtures are committed;
  `event_profile.json` / `hackathon_brief.md` at a repo root stay gitignored.
