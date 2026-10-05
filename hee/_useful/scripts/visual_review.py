#!/usr/bin/env python3
"""Shared visual-review tool (DP-W07).

Reviews screenshots of a web product against a design brief and a quality
rules file using a Gemini vision model on Vertex AI, or replays a recorded
raw model reply offline. The model's score never gates anything by itself:
the caller applies the threshold with deterministic code (exit code 3 means
"below threshold").

Requirement IDs: HEE-ART-01, HEE-ART-02.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import sys

MODEL_NAME_RE = re.compile(
    r"^gemini-(\d+(?:\.\d+)?)-(pro|flash)(-preview(?:-[\w.]+)?)?$"
)
_BANNED_MODEL_SUBSTRINGS = (
    "lite",
    "image",
    "tts",
    "live",
    "audio",
    "embedding",
    "thinking-exp",
)

SYSTEM_INSTRUCTION = (
    "You are a senior product designer and art director reviewing screenshots "
    "of a web product before it ships. You judge only what is visible in the "
    "images, against the design brief and the quality rules you are given. "
    "You are specific, short and direct. You never praise what you cannot see "
    "and you never invent elements that are not in the images. You reply with "
    "JSON only."
)

USER_PROMPT_TEMPLATE = """Review {{count}} screenshot(s) of the "{{unit}}" part of a product. The images are attached in order.

DESIGN BRIEF (what the product is meant to look and feel like):
<<<
{{brief}}
>>>

QUALITY RULES (the standard you judge against; cite them by number in spec_ref):
<<<
{{rules}}
>>>

Scoring (one decimal, 1 to 10):
- 10: a judge would screenshot this and share it.
- 8: professional; only small polish remains.
- 6: competent but generic; it could be any product.
- 4: visible craft problems (weak hierarchy, poor contrast, clutter, clipped text).
- 1 to 2: broken. If any image is blank, almost one colour, or shows an error message, give 1 or 2 and make that defect number 1.
The score reflects the weakest major area: hierarchy, typography, colour and contrast, spacing, consistency with the brief's concept, clarity of states and labels, legibility of text, and (for unit "3d") lighting, material, depth and framing of the 3D view.

List the defects that most limit the score, most important first, at most 8. For each defect: say what is wrong using only what you can see; give a fix_hint that is a concrete change a developer can make (a token value, a spacing step, a light position, a material property, a layout change); give spec_ref as the rule number from the quality rules (for example "§4.1") or "brief" when the brief is the reference. Also list up to 3 short strengths.

Return JSON with exactly the keys: score, defects (each with rank, severity, area, problem, fix_hint, spec_ref), strengths.
"""

REPLY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["score", "defects", "strengths"],
    "properties": {
        "score": {"type": "number", "minimum": 1, "maximum": 10},
        "defects": {
            "type": "array",
            "maxItems": 8,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["rank", "severity", "area", "problem", "fix_hint", "spec_ref"],
                "properties": {
                    "rank": {"type": "integer", "minimum": 1},
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "area": {
                        "type": "string",
                        "enum": [
                            "hierarchy", "typography", "colour", "spacing",
                            "lighting", "material", "depth", "consistency",
                            "state-clarity", "legibility", "blank", "other",
                        ],
                    },
                    "problem": {"type": "string", "minLength": 8},
                    "fix_hint": {"type": "string", "minLength": 8},
                    "spec_ref": {"type": "string", "minLength": 1},
                },
            },
        },
        "strengths": {"type": "array", "maxItems": 3, "items": {"type": "string"}},
    },
}

RETRY_TEMPLATE = """Your reply did not match the required JSON. Errors: {{errors}}
Return only the corrected JSON object, with exactly the keys score, defects and strengths.
"""

_HEADING_RE = re.compile(r"^(#{1,6})\s+.*$")
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"
_MAX_IMAGE_BYTES = 8 * 1024 * 1024

_DEFAULT_PROJECT = "2026-09-agentic-cinema1"
_DEFAULT_LOCATION = "us-central1"


class UsageError(Exception):
    pass


def parse_model_name(name):
    """Port of DP-W00 src/llm/models.ts parseModelName. Returns a dict or None."""
    lower = name.lower()
    for banned in _BANNED_MODEL_SUBSTRINGS:
        if banned in lower:
            return None
    m = MODEL_NAME_RE.match(name)
    if not m:
        return None
    return {
        "name": name,
        "version": float(m.group(1)),
        "tier": m.group(2),
        "preview": bool(m.group(3)),
    }


def pick_model(names, tier):
    """Port of DP-W00 src/llm/models.ts pickModel. Returns a name or None."""
    parsed = []
    for n in names:
        info = parse_model_name(n)
        if info is not None and info["tier"] == tier:
            parsed.append(info)
    parsed.sort(key=lambda i: (-i["version"], 1 if i["preview"] else 0))
    return parsed[0]["name"] if parsed else None


def _load_names_file(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict) and isinstance(data.get("models"), list):
        return [str(x) for x in data["models"]]
    if isinstance(data, list):
        return [str(x) for x in data]
    raise ValueError('models list file must be a JSON array or {"models": [...]}')


def _repo_root():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def resolve_model(role="hee_visual_review"):
    """Resolve the vision model without network: config resolved.pro, else default."""
    _ = role
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", _DEFAULT_LOCATION)
    config_path = os.path.join(_repo_root(), "config", "hee-llm.json")
    try:
        with open(config_path, "r", encoding="utf-8") as fh:
            config = json.load(fh)
        model = config.get("resolved", {}).get("pro", {}).get("model")
        if isinstance(model, str) and model:
            return (model, location)
    except (OSError, ValueError):
        pass
    env_model = os.environ.get("HEE_VISUAL_REVIEW_MODEL")
    if env_model:
        return (env_model, location)
    return ("gemini-2.5-pro", location)


def build_prompt(unit, brief_text, rules_text, count):
    prompt = USER_PROMPT_TEMPLATE
    prompt = prompt.replace("{{unit}}", str(unit))
    prompt = prompt.replace("{{count}}", str(count))
    prompt = prompt.replace("{{brief}}", brief_text)
    prompt = prompt.replace("{{rules}}", rules_text)
    return prompt


def extract_section(text, heading):
    lines = text.splitlines()
    start = None
    level = None
    for i, line in enumerate(lines):
        m = _HEADING_RE.match(line.strip())
        if m and heading in line:
            start = i
            level = len(m.group(1))
            break
    if start is None:
        raise UsageError(f'rules section not found: "{heading}"')
    end = len(lines)
    for j in range(start + 1, len(lines)):
        m = _HEADING_RE.match(lines[j].strip())
        if m and len(m.group(1)) <= level:
            end = j
            break
    return "\n".join(lines[start + 1 : end]).strip() + "\n"


def _sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_image(path):
    try:
        with open(path, "rb") as fh:
            head = fh.read(8)
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
    except OSError:
        raise UsageError(f"cannot read screenshot: {path}")
    if size > _MAX_IMAGE_BYTES:
        raise UsageError(f"screenshot larger than 8 MB: {path}")
    if head[:8] == _PNG_MAGIC:
        mime = "image/png"
    elif head[:3] == _JPEG_MAGIC:
        mime = "image/jpeg"
    else:
        raise UsageError(f"screenshot is not PNG/JPEG: {path}")
    with open(path, "rb") as fh:
        data = fh.read()
    return data, mime


def _validate_reply(raw):
    import jsonschema

    jsonschema.validate(instance=raw, schema=REPLY_SCHEMA)


def _retry_message(errors):
    return RETRY_TEMPLATE.replace("{{errors}}", errors)


def _write_report(out_path, report):
    directory = os.path.dirname(os.path.abspath(out_path))
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def _degraded_report(*, unit, round_n, model, location, threshold, inputs, reason):
    return {
        "version": "1.0.0",
        "unit": unit,
        "round": round_n,
        "model": model,
        "location": location,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "threshold": threshold,
        "score": None,
        "verdict": "unavailable",
        "degraded": True,
        "reason": reason,
        "defects": [],
        "strengths": [],
        "inputs": inputs,
    }


def _append_log_md(log_md, *, unit, report):
    lines = []
    if not os.path.exists(log_md):
        lines.append(f"# Visual review — {unit}")
        lines.append("")
    score = report["score"]
    verdict = report["verdict"]
    lines.append(f"## Round {report['round']} — {score}/10 ({verdict})")
    lines.append("")
    lines.append("| rank | severity | area | problem | fix |")
    lines.append("| --- | --- | --- | --- | --- |")
    for d in report.get("defects", []):
        lines.append(
            f"| {d['rank']} | {d['severity']} | {d['area']} | {d['problem']} | {d['fix_hint']} |"
        )
    lines.append("")
    lines.append("Screenshots:")
    lines.append("")
    for shot in report["inputs"]["screenshots"]:
        lines.append(f"- {shot['path']}")
    lines.append("")
    directory = os.path.dirname(os.path.abspath(log_md))
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(log_md, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def _build_report(*, unit, round_n, model, location, threshold, raw, inputs):
    score = round(float(raw["score"]), 1)
    defects = sorted(raw.get("defects", []), key=lambda d: d["rank"])[:8]
    renumbered = []
    for i, d in enumerate(defects, start=1):
        renumbered.append(
            {
                "rank": i,
                "severity": d["severity"],
                "area": d["area"],
                "problem": d["problem"],
                "fix_hint": d["fix_hint"],
                "spec_ref": d["spec_ref"],
            }
        )
    verdict = "pass" if score >= threshold else "fix"
    return {
        "version": "1.0.0",
        "unit": unit,
        "round": round_n,
        "model": model,
        "location": location,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "threshold": threshold,
        "score": score,
        "verdict": verdict,
        "degraded": False,
        "defects": renumbered,
        "strengths": list(raw.get("strengths", []))[:3],
        "inputs": inputs,
    }


def _live_reply(*, prompt, images, record_path):
    from google import genai
    from google.genai import types

    project = os.environ.get("GOOGLE_CLOUD_PROJECT", _DEFAULT_PROJECT)
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", _DEFAULT_LOCATION)
    model, _ = resolve_model()
    client = genai.Client(vertexai=True, project=project, location=location)
    parts = [
        types.Part.from_bytes(data=data, mime_type=mime) for data, mime in images
    ]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.2,
        response_mime_type="application/json",
        response_schema=dict(REPLY_SCHEMA),
    )
    response = client.models.generate_content(
        model=model, contents=parts + [prompt], config=config
    )
    raw = json.loads(response.text)
    if record_path:
        _write_report(record_path, raw)
    try:
        _validate_reply(raw)
        return raw
    except Exception as exc:  # noqa: BLE001 - validation errors become a retry
        retry = _retry_message(str(exc))
        response2 = client.models.generate_content(
            model=model, contents=parts + [prompt, retry], config=config
        )
        raw2 = json.loads(response2.text)
        if record_path:
            _write_report(record_path, raw2)
        _validate_reply(raw2)
        return raw2


def review(
    screenshots,
    brief,
    rules,
    rules_section,
    unit,
    round_n,
    out,
    threshold=8.0,
    log_md=None,
    replay=None,
    record=None,
):
    if not screenshots or len(screenshots) < 1 or len(screenshots) > 6:
        raise UsageError("provide 1–6 --screenshots")
    if unit not in ("ui", "3d"):
        raise UsageError("--unit must be ui or 3d")
    if round_n not in (1, 2, 3):
        raise UsageError("--round must be 1, 2 or 3")
    try:
        with open(brief, "r", encoding="utf-8") as fh:
            brief_text = fh.read()
    except OSError:
        raise UsageError(f"cannot read brief: {brief}")
    try:
        with open(rules, "r", encoding="utf-8") as fh:
            rules_text = fh.read()
    except OSError:
        raise UsageError(f"cannot read rules: {rules}")
    if rules_section:
        rules_text = extract_section(rules_text, rules_section)

    images = []
    shots = []
    for path in screenshots:
        data, mime = _read_image(path)
        images.append((data, mime))
        shots.append({"path": path, "sha256": _sha256_file(path)})
    inputs = {
        "screenshots": shots,
        "brief_sha256": hashlib.sha256(brief_text.encode("utf-8")).hexdigest(),
        "rules_sha256": hashlib.sha256(rules_text.encode("utf-8")).hexdigest(),
    }
    prompt = build_prompt(unit, brief_text, rules_text, len(screenshots))

    model, location = resolve_model()
    try:
        if replay is not None:
            with open(replay, "r", encoding="utf-8") as fh:
                raw = json.load(fh)
            try:
                _validate_reply(raw)
            except Exception as exc:  # noqa: BLE001 - one retry, then degraded
                try:
                    _validate_reply(raw)
                except Exception as exc2:  # noqa: BLE001
                    _ = exc
                    raise exc2
        else:
            raw = _live_reply(prompt=prompt, images=images, record_path=record)
    except UsageError:
        raise
    except Exception as exc:  # noqa: BLE001 - network/auth/validation → degraded
        text = str(exc)
        if isinstance(exc, ValueError) or "validation" in type(exc).__name__.lower():
            reason = f"invalid_model_reply: {text[:500]}"
        else:
            reason = f"{type(exc).__name__}: {text[:500]}"
        # Distinguish validation failures (prefix required) from transport ones.
        try:
            import jsonschema

            jsonschema.validate(instance=raw, schema=REPLY_SCHEMA)
        except Exception:  # noqa: BLE001
            reason = f"invalid_model_reply: {text[:500]}"
        report = _degraded_report(
            unit=unit, round_n=round_n, model=model, location=location,
            threshold=threshold, inputs=inputs, reason=reason,
        )
        _write_report(out, report)
        if log_md:
            _append_log_md(log_md, unit=unit, report=report)
        if reason.startswith("invalid_model_reply"):
            return (report, 1)
        return (report, 1)

    report = _build_report(
        unit=unit, round_n=round_n, model=model, location=location,
        threshold=threshold, raw=raw, inputs=inputs,
    )
    _write_report(out, report)
    if log_md:
        _append_log_md(log_md, unit=unit, report=report)
    return (report, 0 if report["verdict"] == "pass" else 3)


def _build_parser():
    p = argparse.ArgumentParser(description="Visual review of product screenshots.")
    p.add_argument("--screenshots", nargs="+", default=None)
    p.add_argument("--brief", default=None)
    p.add_argument("--rules", default=None)
    p.add_argument("--rules-section", default=None)
    p.add_argument("--unit", default=None, choices=["ui", "3d"])
    p.add_argument("--round", default=None, type=int)
    p.add_argument("--out", default=None)
    p.add_argument("--threshold", default=8.0, type=float)
    p.add_argument("--log-md", default=None)
    p.add_argument("--replay", default=None)
    p.add_argument("--record", default=None)
    p.add_argument("--self-test-pick", default=None)
    p.add_argument("--tier", default=None, choices=["pro", "flash"])
    return p


def main(argv=None):
    args = _build_parser().parse_args(argv)
    if args.self_test_pick is not None:
        if args.tier not in ("pro", "flash"):
            print("error: --self-test-pick requires --tier <pro|flash>", file=sys.stderr)
            return 2
        try:
            names = _load_names_file(args.self_test_pick)
        except (OSError, ValueError) as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        picked = pick_model(names, args.tier)
        if picked is None:
            print(f"error: no {args.tier} model visible", file=sys.stderr)
            return 1
        print(picked)
        return 0
    missing = [
        name
        for name in ("screenshots", "brief", "rules", "unit", "round", "out")
        if getattr(args, name) in (None, [])
    ]
    if missing:
        print(f"error: missing required options: {', '.join('--' + m for m in missing)}",
              file=sys.stderr)
        return 2
    try:
        _, code = review(
            screenshots=args.screenshots,
            brief=args.brief,
            rules=args.rules,
            rules_section=args.rules_section,
            unit=args.unit,
            round_n=args.round,
            out=args.out,
            threshold=args.threshold,
            log_md=args.log_md,
            replay=args.replay,
            record=args.record,
        )
    except UsageError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    report = json.load(open(args.out, "r", encoding="utf-8"))
    if report.get("degraded"):
        if str(report.get("reason", "")).startswith("invalid_model_reply"):
            return 1
        print(f"visual review unavailable: {report.get('reason', '')}")
        return 1
    print(
        f"visual review {args.unit} round {args.round}: "
        f"{report['score']}/10 -> {report['verdict']}; "
        f"{len(report['defects'])} defects"
    )
    return code


if __name__ == "__main__":
    sys.exit(main())
