import sys
sys.path.insert(0, "scripts/video")
from contamination import ocr
print(ocr(sys.argv[1]) or "")
