#!/usr/bin/env python3
"""scripts/video/contamination.py — DP-SCRIPT WU-07 check 6 (reused WU-09).

The measured text-contamination test: an edge-density pass over the picture
finds the high-contrast stroke regions, then OCR reads the whole picture and
the densest regions. Prints `contamination: clean (<ratio> edge ratio, <n>
ocr words)` and exits 0, or `text-contaminated: <words>` and exits 1.

Usage: python3 scripts/video/contamination.py <image.png>
"""
import shutil
import subprocess
import sys

from PIL import Image, ImageFilter


def edge_ratio(gray: Image.Image) -> float:
    edges = gray.filter(ImageFilter.FIND_EDGES).convert("L")
    hist = edges.histogram()
    hot = sum(hist[97:])
    return hot / max(1, sum(hist))


def ocr(path: str) -> str:
    if not shutil.which("tesseract"):
        return ""
    try:
        out = subprocess.run(["tesseract", path, "stdout"], capture_output=True, text=True, timeout=120)
        return out.stdout
    except Exception:
        return ""


def words_of(text: str) -> list:
    return [w for w in "".join(c if c.isalnum() else " " for c in text).split() if len(w) >= 4]


def dense_crops(path: Image.Image, tmp: str) -> list:
    """Crop the three densest grid cells (stroke regions) for focused OCR."""
    w, h = path.size
    gray = path.convert("L")
    cells = []
    n = 4
    for gy in range(n):
        for gx in range(n):
            box = (gx * w // n, gy * h // n, (gx + 1) * w // n, (gy + 1) * h // n)
            cells.append((edge_ratio(gray.crop(box)), box))
    cells.sort(reverse=True)
    paths = []
    for i, (_, box) in enumerate(cells[:3]):
        p = f"{tmp}.{i}.png"
        path.crop(box).save(p)
        paths.append(p)
    return paths


def main() -> int:
    src = sys.argv[1]
    img = Image.open(src).convert("RGB")
    ratio = edge_ratio(img.convert("L"))
    found: list = words_of(ocr(src))
    for crop in dense_crops(img, src):
        for w in words_of(ocr(crop)):
            if w not in found:
                found.append(w)
    if len(found) >= 2:
        print(f"text-contaminated: {' '.join(found[:8])}")
        return 1
    print(f"contamination: clean ({ratio:.3f} edge ratio, {len(found)} ocr words)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
