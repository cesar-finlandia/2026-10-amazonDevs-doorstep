#!/usr/bin/env python3
# Requirement IDs: FR-18, NFR-14
"""Cost sidecar: JSON-lines metering over src.cost (DP-AGENT-WORKFLOW §5.4).

Usage: python3 scripts/cost_sidecar.py <configPath>
Reads one JSON object per line on stdin, writes one JSON object per line on
stdout. Any exception per request becomes {"ok": false, "error": "<message>"}
and the sidecar keeps running.
"""
import datetime
import json
import os
import sys
import uuid


def _utc_now_iso() -> str:
    try:
        return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return ""


def main() -> None:
    cfg_path = sys.argv[1]
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    from src.cost import create_cost_store

    with open(cfg_path, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    store = create_cost_store({"budget_config": cfg})
    gscope = (cfg.get("global") or {}) if isinstance(cfg, dict) else {}
    try:
        budget = float(gscope.get("budget") or 0)
    except Exception:
        budget = 0.0
    try:
        threshold = float(gscope.get("threshold") or 0.8)
    except Exception:
        threshold = 0.8

    def snapshot():
        totals = store.global_totals()
        total = int(totals.get("total_tokens") or 0)
        requests = int(totals.get("request_count") or 0)
        pct = round(total / budget * 100, 1) if budget > 0 else 0.0
        if pct >= 95:
            warning = "critical"
        elif pct >= threshold * 100:
            warning = "warning"
        else:
            warning = "none"
        return total, requests, pct, warning

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            op = req.get("op")
            if op == "record":
                try:
                    in_tok = int(req.get("input_tokens"))
                except Exception:
                    in_tok = 0
                try:
                    out_tok = int(req.get("output_tokens"))
                except Exception:
                    out_tok = 0
                record = {
                    "id": uuid.uuid4().hex,
                    "timestamp": _utc_now_iso(),
                    "provider": str(req.get("provider") or "").strip().lower(),
                    "label": str(req.get("label") or ""),
                    "model_profile": "generic-heuristic",
                    "input_tokens": in_tok,
                    "output_tokens": out_tok,
                    "total_tokens": in_tok + out_tok,
                    "request_count": 1,
                    "estimated_cost_usd": None,
                    "unmetered": False,
                    "unmetered_reason": "",
                    "raw_usage_ref": None,
                }
                store.append(record)
                total, requests, pct, warning = snapshot()
                out = {
                    "ok": True,
                    "usedPct": pct,
                    "totalTokens": total,
                    "requests": requests,
                    "warning": warning,
                    "text": store.render_summary(),
                }
            elif op == "summary":
                total, requests, pct, warning = snapshot()
                out = {
                    "ok": True,
                    "usedPct": pct,
                    "totalTokens": total,
                    "requests": requests,
                    "warning": warning,
                    "text": store.render_summary(),
                }
            elif op == "reset":
                store.reset()
                out = {"ok": True}
            else:
                out = {"ok": False, "error": "unknown op %r" % (op,)}
        except Exception as exc:  # noqa: BLE001 — protocol demands the sidecar keeps running
            out = {"ok": False, "error": str(exc)}
        sys.stdout.write(json.dumps(out) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
