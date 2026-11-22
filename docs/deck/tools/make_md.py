"""python make_md.py <work dir>: slides.md = text on each slide, speaker notes, every number with its source, links."""
import json, pathlib, sys, re
root = pathlib.Path(sys.argv[1])
notes = json.loads((root / "notes.json").read_text()); texts = json.loads((root / "texts.json").read_text())
src = json.loads((root / "sources.json").read_text()); live = json.loads((root / "live.json").read_text()); shots = json.loads((root / "shots" / "shots.json").read_text())
TITLES = ["Tổng quan", "Vấn đề", "Vòng đời một chiếc xe", "Ngân hàng giữ tiền, blockchain giữ bằng chứng", "Mua cổ phần", "Nhận tiền thuê", "Bán lại",
          "Công ty báo bao nhiêu, trả bao nhiêu", "Hai mạng", "Một chiếc xe từ đầu đến cuối (ví dụ)", "Bằng chứng", "So sánh", "Luật Việt Nam và giới hạn", "Lộ trình", "Cảm ơn"]
assert len(TITLES) == len(notes) == len(texts) == len(src)
o = ["# FleetShares: slide pitch (22/11/2026)", "",
     f"{len(notes)} slide, dựng trong `deck.html` (1920×1080, font IBM Plex Sans nhúng sẵn, có đủ dấu tiếng Việt). Mỗi slide là một hình; câu đầy đủ nằm ở ghi chú người nói.", "",
     "Tiền trên slide là tiền đồng. Bản demo trên testnet mô phỏng tiền VND bằng một token thử theo tỷ giá demo của app, 1 đơn vị = 25.000 đ; cổng thanh toán chưa nối.", "",
     "Tên Avalanche và Fuji chỉ có trên slide 1 và slide cuối; các slide giữa gọi là \"mạng riêng (L1)\", \"mạng chính\", \"testnet\". Tên kỹ thuật (C-Chain, ICM, Teleporter) nằm trong ghi chú người nói.", "",
     f"Số liệu sống đọc từ Fuji lúc khối {live['block']:,} ({live['time_utc']}) qua {live['rpc']}. Ảnh chụp app lúc {shots['at'][:16].replace('T', ' ')} UTC, ví chỉ đọc {shots['holder']}.", ""]
for i, (t, n, x, s) in enumerate(zip(TITLES, notes, texts, src), 1):
    o += [f"## {i}. {t}", "", "Chữ trên slide:", ""] + [f"> {line}" for line in x["text"].split("\n") if line.strip() and line.strip() != f"{i:02d}"] + ["", "Ghi chú người nói:", "", n, ""]
    if s: o += ["Số liệu và nguồn:", ""] + [f"- {a}: {b}" for a, b in s] + [""]
    seen = []
    for l in x["links"]:
        if l["href"] not in seen: seen.append(l["href"])
    if seen: o += ["Liên kết trên slide:", ""] + [f"- {next(l['label'] for l in x['links'] if l['href'] == h)}: {h}" for h in seen] + [""]
o += ["## Dựng lại", "", "```sh", "cd web && python3 -m http.server 8171 &", "python3 docs/deck/tools/read_chain.py . docs/deck/live.json      # số liệu sống (cần Foundry cast)",
      "PW=<playwright>/index.mjs node docs/deck/tools/shots.mjs docs/deck/shots   # ảnh chụp app, chỉ đọc",
      "uv run --with pillow python docs/deck/tools/build.py docs/deck .          # deck.html, notes.json, sources.json",
      "PW=... node docs/deck/tools/render.mjs $PWD/docs/deck/deck.html docs/deck/png && PW=... node docs/deck/tools/texts.mjs $PWD/docs/deck/deck.html docs/deck/texts.json docs/FleetShares-pitch.pdf",
      "uv run --with python-pptx --with pillow python docs/deck/tools/make_pptx.py docs/deck docs/FleetShares-pitch.pptx", "```", ""]
(root / "slides.md").write_text("\n".join(o) + "\n", encoding="utf-8"); print("slides.md", len(o))
