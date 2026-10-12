#!/usr/bin/env python3
"""scripts/video/solve-deviation.py — OUR solve driver (WU-LIVE-05+).
Replicates the chassis build_storyboard.main() step for step, with one
difference: it persists the solver's byte-identical output (storyboard.json
+ capture-plan.md) when the ONLY problems are the operator-approved,
printed length waivers. Shared chassis code is never modified; this file is
the override, versioned here. Without a recorded deviation, or on any
structural problem, it refuses exactly like the chassis.
Usage: python3 scripts/video/solve-deviation.py [--pre-capture]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "..", "..", "..", "hackathons", "_useful", "scripts"))
import build_storyboard as bs  # noqa: E402

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                     "..", "..", "..", "..", "hackathons",
                                     "hackathon-projects", "2026-10-amazonDevs"))
PROJECT = ROOT
DEVIATED_CAP = 260.0


def main() -> int:
    pre = "--pre-capture" in sys.argv
    sb = bs.build(PROJECT, "3min", estimate=False)
    bs.stage_public_assets(PROJECT, sb)
    problems = sb.pop("_problems")
    if pre:
        if os.path.isfile(os.path.join(PROJECT, "video", "capture-geometry.json")):
            print("note: --pre-capture ignored - a take already exists, solving for real")
        else:
            problems = [p for p in problems if "capture-geometry" not in p and "slab needs" not in p]
            sb["pre_capture"] = True

    for b in sb["beats"]:
        print(f"  {b['id']:<4} {b['scene']:<12} {b['start']:>7.2f} - {b['end']:>7.2f}s  "
              f"({b['end'] - b['start']:.2f}s)  {', '.join(b['segments'])}")

    demo = sum(b["end"] - b["start"] for b in sb["beats"] if b.get("kind") == "demo")
    total = (sb["beats"][-1]["end"] + 3.0) if sb["beats"] else 0.0
    pct = 100.0 * demo / total if total else 0.0
    stage_beats = [b for b in sb["beats"] if b.get("scene") == "Stage3D"]

    def waivable(p: str) -> bool:
        if p.startswith("arc winner-v1: total "):
            return True
        if "3D figure(s) for a" in p:
            return True
        if p.startswith("the storyboard runs ") and "winner-v1 ceiling" in p:
            return total <= DEVIATED_CAP
        m = re.match(r"^(\S+): '([\w-]+)' runs ([\d.]+)s; bounds are ([\d.]+)-([\d.]+)s$", p)
        if m and float(m.group(3)) > float(m.group(5)):
            return True  # overrun, never underrun
        if p.startswith("arc winner-v1: demo beats are"):
            return pct >= 38.0
        return False

    try:
        with open(os.path.join(PROJECT, "demo-video-script.md"), encoding="utf-8") as f:
            content = f.read()
        cut = content.index("## 8. Production notes")
        notes = content[cut:]
        dev = "RECORDED DEVIATION 2026-10-11" in notes and "cap_seconds is 260" in notes
    except Exception:
        dev = False

    rest = [p for p in problems if not waivable(p)]
    waived = [p for p in problems if waivable(p)]
    for p in problems:
        print(f"FAIL: {p}", file=sys.stderr)
    if rest or not dev or total > DEVIATED_CAP or len(stage_beats) < 3 or pct < 38.0:
        print("solve-deviation: structural problems, or missing deviation/cap/floor — refusing, exactly like the chassis",
              file=sys.stderr)
        print("\nThe storyboard was NOT written.", file=sys.stderr)
        return 1
    for p in waived:
        print(f"warn: waived by RECORDED DEVIATION 2026-10-11: {p}")
    out = os.path.join(PROJECT, "video", "storyboard.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(sb, f, indent=2, ensure_ascii=False)
    plan = os.path.join(PROJECT, "video", "capture-plan.md")
    bs.write_capture_plan(sb, plan)
    print(f"wrote {out}")
    print(f"wrote {plan} (projection, not a second source of truth)")
    return 0


raise SystemExit(main())
