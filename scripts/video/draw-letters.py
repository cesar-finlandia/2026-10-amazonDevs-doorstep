import sys
from PIL import Image, ImageDraw, ImageFont
im = Image.open(sys.argv[1])
d = ImageDraw.Draw(im)
try:
    font = ImageFont.load_default(size=72)
except TypeError:
    font = ImageFont.load_default()
d.text((640, 460), "XYZZY PROBE LETTERS", fill=(10, 10, 10), font=font)
im.save(sys.argv[2])
print("drew letters")
