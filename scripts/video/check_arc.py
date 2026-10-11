#!/usr/bin/env python3
"""scripts/video/check_arc.py — DP-SCRIPT WU-05 (§5.6).
Reads beat-plan.json and the estimator's per-segment seconds (text-only,
estimate.json per R-17), builds consecutive beat windows (0.5 s per
sentence-bound and per internal segment boundary, 0.5 s following gap except
the close, which carries the 3.0 s tail), and calls the chassis solver.
Prints `arc: OK (total <s>s, demo <p>%)` or the problems (exit 1).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "..", "..", "..", "hackathons", "_useful", "scripts"))
from winner_arc import check_arc  # noqa: E402

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                     "..", "..", "..", "..", "hackathons",
                                     "hackathon-projects", "2026-10-amazonDevs"))


def sentences(text):
    return [x for x in re.split(r"[.?!]+", text) if x.strip() != ""]


def main():
    with open(os.path.join(ROOT, "beat-plan.json"), encoding="utf-8") as f:
        plan = json.load(f)
    with open(os.path.join(ROOT, "narration-segments.json"), encoding="utf-8") as f:
        segs = {s["id"]: s["text"] for s in json.load(f)["segments"]}
    with open(os.path.join(ROOT, "video", "facts", "estimate.json"), encoding="utf-8") as f:
        est = json.load(f).get("perSegment", {})
    beats = []
    t = 0.0
    order = plan["beats"]
    for i, b in enumerate(order):
        seg_ids = b.get("segments", [])
        dur = sum(float(est.get(s, 0.0)) for s in seg_ids)
        bounds = sum(max(0, len(sentences(segs.get(s, ""))) - 1) for s in seg_ids)
        internal = max(0, len(seg_ids) - 1)
        dur += 0.5 * bounds + 0.5 * internal
        last = i == len(order) - 1
        if b.get("kind") == "close":
            dur += 3.0
        elif not last:
            dur += 0.5
        start = t
        t += dur
        props = dict(b.get("props", {}))
        # The chassis validates the figure's own words (explain.*); the beat
        # carries only the file name, so resolve it: read props.stage from the
        # project folder and attach it as props.stage3d (read-only).
        if b.get("scene") == "Stage3D" and props.get("stage"):
            with open(os.path.join(ROOT, props["stage"]), encoding="utf-8") as f:
                props["stage3d"] = json.load(f)
        beats.append({"id": b.get("id"), "kind": b.get("kind"), "scene": b.get("scene"),
                      "start": round(start, 2), "end": round(t, 2), "props": props})
    total = t
    problems, warns = check_arc(beats, total, 180)
    for w in warns:
        print("warn: " + w)
    demo = sum(b["end"] - b["start"] for b in beats if b.get("kind") == "demo")
    pct = 100.0 * demo / total if total else 0.0
    if problems:
        for p in problems:
            print(p)
        sys.exit(1)
    print("arc: OK (total %.1fs, demo %.0f%%)" % (total, pct))


main()
