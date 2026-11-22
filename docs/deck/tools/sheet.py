"""Contact sheet: python sheet.py <png dir> <out.jpg> [cols]"""
import sys, pathlib
from PIL import Image
d, out = pathlib.Path(sys.argv[1]), sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
ims = sorted(d.glob("s*.png")); w, h, g = 640, 360, 8
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w + (cols + 1) * g, rows * h + (rows + 1) * g), (150, 150, 155))
for i, p in enumerate(ims):
    im = Image.open(p).convert("RGB").resize((w, h), Image.LANCZOS)
    sheet.paste(im, (g + (i % cols) * (w + g), g + (i // cols) * (h + g)))
sheet.save(out, quality=88)
print(out, sheet.size)
