"""python make_pptx.py <work dir> <out.pptx>: one image per slide (png/), clickable link boxes, speaker notes."""
import json, pathlib, sys
from pptx import Presentation
from pptx.util import Emu
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image
root, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
notes = json.loads((root / "notes.json").read_text()); texts = json.loads((root / "texts.json").read_text())
pngs = sorted((root / "png").glob("s*.png")); jpg_dir = root / "jpg"; jpg_dir.mkdir(exist_ok=True)
prs = Presentation(); W, H = 12192000, 6858000; prs.slide_width = Emu(W); prs.slide_height = Emu(H)
for i, png in enumerate(pngs):
    jpg = jpg_dir / (png.stem + ".jpg"); Image.open(png).convert("RGB").save(jpg, quality=90, optimize=True)
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.shapes.add_picture(str(jpg), 0, 0, width=prs.slide_width, height=prs.slide_height)
    for l in texts[i]["links"]:
        if l["w"] <= 0 or l["h"] <= 0: continue
        sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(int(l["x"] * W)), Emu(int(l["y"] * H)), Emu(int(l["w"] * W)), Emu(int(l["h"] * H)))
        sh.fill.background(); sh.line.fill.background(); sh.shadow.inherit = False
        sh.click_action.hyperlink.address = l["href"]; sh.name = "Link: " + l["label"]
    body = "Lời thuyết minh: " + notes[i] + "\n\nChữ trên slide:\n" + texts[i]["text"]
    if texts[i]["links"]: body += "\n\nLiên kết:\n" + "\n".join(f'{l["label"]}: {l["href"]}' for l in texts[i]["links"])
    s.notes_slide.notes_text_frame.text = body
prs.core_properties.title = "FleetShares · pitch"
prs.save(out); print(len(pngs), "slides", round(out.stat().st_size / 1e6, 2), "MB")
