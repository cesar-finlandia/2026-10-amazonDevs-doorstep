"""Probe Lyria availability: one short bed generation to TEMP, discarded.

Used by live-gate.ts (DP-LIVE-RUN-AND-VIDEO §5.3 item 5: the music model is
available in the configured region). Prints only booleans. Output is
deleted. Costs one ~33 s Lyria clip.
"""
import importlib.util
import os

spec = importlib.util.spec_from_file_location(
    "compose_bed", "../../hackathons/_useful/scripts/compose_bed.py")
bed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bed)

OUT = "C:/Users/cesar/AppData/Local/Temp/opencode/bed-probe.wav"
ok = False
try:
    used = bed.generate("gentle paper-minimal music bed, soft piano and air",
                        model="lyria-002", project="hacka-2026-09-agentic-cinema1",
                        location="us-central1", out_path=OUT)
    ok = bool(used) and os.path.getsize(OUT) > 10000
except SystemExit as e:
    print(f"lyria_exit={e}")
except Exception as e:
    print(f"lyria_error={str(e)[:120]}")
finally:
    try:
        os.remove(OUT)
    except OSError:
        pass
print(f"lyria_probe={ok}")
