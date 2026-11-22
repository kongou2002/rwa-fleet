#!/usr/bin/env python3
"""FleetShares pitch deck: deck.html (1920x1080, self-contained), notes.json, sources.json.

    python3 build.py <work dir> <repo>

Reads: <work>/live.json (read_chain.py), <work>/shots/*.png + shots.json (shots.mjs), <work>/assets (icons.json from
icons.mjs, car photos, qr-app.svg), <work>/fonts/plex{1..4}.ttf (IBM Plex Sans 400/500/600/700 from Google Fonts, full
Vietnamese coverage) and the worked example from <repo>/web/views/how.js.
One font, one type scale, Lucide icons, charts as inline SVG, the app's own colours.
"""
import base64, io, json, pathlib, re, sys

from PIL import Image

W = pathlib.Path(sys.argv[1]).resolve()
REPO = pathlib.Path(sys.argv[2]).resolve()
A = W / "assets"
ICONS = json.loads((A / "icons.json").read_text())
LIVE = json.loads((W / "live.json").read_text())
SHOTS = json.loads((W / "shots" / "shots.json").read_text())
CFG = json.loads((REPO / "docs/fuji.json").read_text())
APP = "https://kongou2002.github.io/rwa-fleet/"
SNOW = "https://testnet.snowtrace.io"


# ---------- helpers ----------

def vn(x, dec=0):
    """Vietnamese number format: 28.000 · 283,50."""
    s = f"{x:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


RATE = 25000  # demo rate shown by the app: 1 test-token unit = 25.000 đ (VND is simulated by a test token)


def money(units, unit=True):
    """Token units -> đồng, the Vietnamese way: 700 triệu, 1 tỷ, 7,875 triệu, 787.500 đ."""
    d = units * RATE
    if d >= 1e9:
        v, u = d / 1e9, "tỷ"
    elif d >= 1e6:
        v, u = d / 1e6, "triệu"
    else:
        return vn(d) + (" đ" if unit else "")
    s = f"{v:.4f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{s} {u}" if unit else s


def b64(p):
    return base64.b64encode(pathlib.Path(p).read_bytes()).decode()


def img(path, max_w=None, quality=86):
    """Embed an image as a JPEG data URI, downscaled to max_w px wide (keeps the file small, text stays sharp at 2x)."""
    im = Image.open(path).convert("RGB")
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def ic(name, size=48, cls=""):
    shapes = "".join(f"<{t} " + " ".join(f'{k}="{v}"' for k, v in a.items()) + "/>" for t, a in ICONS[name])
    return (f'<svg class="ic {cls}" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{shapes}</svg>')


def mark(size):
    # The app's logo mark: rounded square, a ring and a wedge. Red square, white ring and wedge on a white slide.
    return (f'<svg class="mark" width="{size}" height="{size}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#c8102e"/>'
            f'<circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-width="3"/><path d="M16 16V7a9 9 0 0 1 9 9z" fill="#fff"/></svg>')


def logo(size=40, cls=""):
    return f'<span class="logo {cls}" style="font-size:{size}px">{mark(round(size * 1.15))}<b>FleetShares</b></span>'


def link(href, label):
    return f'<a href="{href}" target="_blank" rel="noopener">{label}</a>'


def tx(h, label=None):
    return link(f"{SNOW}/tx/{h}", label or f"{h[:6]}…{h[-4:]}")


def screen(src, alt, cls=""):
    return f'<figure class="screen {cls}"><div class="bar"><i></i><i></i><i></i><span>kongou2002.github.io/rwa-fleet</span></div><img src="{src}" alt="{alt}"></figure>'


SLIDES = []


def slide(body, notes, sources=(), cap="", cls=""):
    n = len(SLIDES) + 1
    if "</h2>" in body:
        head, rest = body.split("</h2>", 1)
        body = head + '</h2><div class="fill">' + rest + "</div>"
    SLIDES.append((f'''<section class="slide {cls}">
  {body}
  <footer>{logo(22, "foot")}<span class="cap">{cap}</span><span class="pg">{n:02d}</span></footer>
</section>''', notes, list(sources)))


# ---------- data ----------

cars = {c["id"]: c for c in LIVE["cars"]}
cx5, vf8, vios = cars[1], cars[2], cars[3]
BLOCK, AT = LIVE["block"], LIVE["time_utc"]
READ = f"khối {vn(BLOCK)} ({AT})"
n_reports = len(LIVE["reports"])
offers_open = int(re.match(r"(\d+)", SHOTS["offers"]).group(1))
offer_shares = int(re.search(r"(\d+) shares", SHOTS["offers"]).group(1))

# Mazda CX-5: the period whose report arrived before its rent, and the payment that closed the gap.
rep3 = max((r for r in LIVE["reports"] if r["car"] == 1), key=lambda r: r["period"])
pays1 = sorted((p for p in LIVE["rentPaid"] if p["car"] == 1), key=lambda p: p["block"])
late = next((p for p in pays1 if p["block"] > rep3["block"]), None)
paid_before = sum(p["gross"] for p in pays1 if p["block"] <= rep3["block"])
gap = rep3["income"] * rep3["period"] - paid_before if late else cx5["ledger"]["unpaid"]

# Worked example, the app's own constants and formula (web/views/how.js).
EX = json.loads(re.sub(r"(\w+):", r'"\1":', re.search(r"const EX = (\{[^}]+\})", (REPO / "web/views/how.js").read_text()).group(1)))
EX_TRIEU = EX["price"]  # the app now states the example in triệu đồng (700); convert to token units for money()
if EX["price"] < 5000:
    EX["price"] = EX["price"] * 1e6 / RATE
rent_y = EX["price"] * EX["gross"] * (1 - EX["fee"])
rent_tot, resale = rent_y * EX["years"], EX["price"] * EX["resale"]
back = rent_tot + resale


def irr(cf):
    npv = lambda r: sum(c / (1 + r) ** t for t, c in enumerate(cf))
    lo, hi = -0.99, 10.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(lo) * npv(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


ex_irr = irr([-EX["price"]] + [rent_y + (resale if i == EX["years"] - 1 else 0) for i in range(EX["years"])])

SIM = "Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối."
PHOTO_CREDIT = {
    1: link("https://commons.wikimedia.org/wiki/File:2022_Mazda_CX-5_2.0_front.jpg", "Ảnh: ShangTW") + ", CC BY-SA 4.0",
    2: link("https://commons.wikimedia.org/wiki/File:VinFast_VF_8_IAA_2023_1X7A0681.jpg", "Ảnh xe: Alexander-93") + ", CC BY-SA 4.0",
}

# ---------- slides ----------

# 1 overview
slide(f'''
<div class="cover">
  <div class="cl">
    {logo(76, "hero")}
    <h1>Mua một phần chiếc xe cho thuê,<br><em>nhận một phần tiền thuê</em></h1>
    <ul class="chips">
      <li>{ic("car", 40)}Mua xe theo cổ phần</li>
      <li>{ic("chart-pie", 40)}Tiền thuê chia 90/10</li>
      <li>{ic("repeat", 40)}Bán lại cổ phần</li>
    </ul>
    <p class="avax">Xây trên Avalanche · Chạy trên testnet Fuji</p>
  </div>
  <figure class="hero-photo"><img src="{img(A / "cx5.jpg", 1800)}" alt="Mazda CX-5 2.0, xe đang cho thuê trong vault">
    <figcaption><b>Mazda CX-5 2.0</b><span>{cx5["total"]} phần × {money(cx5["price"])} · {money(cx5["price"] * cx5["total"])}</span><em class="pill good">Đang cho thuê</em></figcaption>
  </figure>
</div>''',
      f"Xin chào, chúng tôi là FleetShares. Một chiếc xe cho thuê được chia thành cổ phần, ví dụ chiếc Mazda CX-5 700 triệu đồng chia làm 100 phần, mỗi phần 7 triệu. Người mua chuyển khoản tiền đồng, và mỗi lần công ty cho thuê trả tiền thuê, phần chia được ghi ngay: 90% cho người giữ cổ phần, 10% phí quản lý. Muốn rút ra thì bán cổ phần cho người khác. Xin nói trước: bản demo chạy trên Avalanche Fuji, testnet; tiền VND được mô phỏng bằng một token thử theo tỷ giá demo 1 đơn vị = 25.000 đồng, cổng thanh toán chưa nối; công ty cho thuê là Công ty A, tên giữ chỗ; tiền thuê do ví của nhóm trả thay công ty.",
      [("90/10", "phí FEE_BPS cố định trong src/FleetShares.sol; README, mục Who doesn't trust whom"),
       (f"{cx5['total']} phần × {money(cx5['price'])}", f"FleetShares.getCar(1) trên Fuji, {READ}: 100 × 280 đơn vị token thử × 25.000 đ (tỷ giá demo của app); README, Proof: listCar1 {CFG['tx']['listCar1']}")],
      cap=PHOTO_CREDIT[1] + " · " + SIM, cls="nofootlogo")

# 2 problem
slide(f'''
<p class="kick">Vấn đề</p>
<h2>Lãi xe cho thuê <em>chỉ dành cho người mua cả chiếc</em></h2>
<div class="prob">
  <div class="big">
    <strong class="num red">10–15%</strong>
    <span class="lbl">tiền thuê mỗi năm trên giá xe<small>ước tính của ngành</small></span>
  </div>
  <div class="walls">
    <div class="wall">{ic("car", 72)}<div><b class="mid">{money(cx5["price"] * cx5["total"])}</b><span class="lbl">Mua cả chiếc</span></div></div>
    <div class="wall">{ic("eye-off", 72)}<div><b class="mid">Góp qua công ty</b><span class="lbl">Phải tin sổ sách của họ</span></div></div>
  </div>
</div>''',
      f"Một chiếc xe cho thuê ở Việt Nam đem về khoảng 10 đến 15% giá xe mỗi năm tiền thuê. Đây là ước tính của ngành, nhóm chưa tự đo. Nhưng chỉ người mua nổi cả chiếc mới có khoản đó: một chiếc CX-5 trong vault giá 700 triệu đồng. Cách còn lại là góp tiền qua một công ty, và khi đó phải tin công ty về tiền, về phí và về báo cáo thu nhập.",
      [("10–15%", "khoảng trong đề bài của ban giám khảo cho dự án này; app dùng 12–15% (TERMS.gross trong web/core.js). Ước tính, nhóm chưa đo."),
       (money(cx5['price'] * cx5['total']), f"giá xe Mazda CX-5 2.0 = 100 phần × 280 đơn vị × 25.000 đ, FleetShares.getCar(1), {READ}")],
      cap="10–15%: ước tính của ngành, nhóm chưa đo · " + SIM)

# 3 lifecycle
LIFE = [("users", "Gọi vốn", "Chuyển khoản<br>mua cổ phần"), ("car", "Đủ vốn, mua xe", "Tiền tới<br>Công ty A"), ("key-round", "Cho thuê", "4–5 năm"),
        ("chart-pie", "Chia tiền thuê", "90% người giữ<br>10% phí"), ("tag", "Bán xe", "Cuối kỳ thuê"), ("wallet", "Hoàn vốn", "Theo số<br>cổ phần")]
slide(f'''
<p class="kick">Cách hoạt động</p>
<h2>Vòng đời <em>một chiếc xe</em></h2>
<div class="life">
  <ol>{"".join(f'<li><span class="disc">{ic(k, 64)}<i>{j}</i></span><b>{t}</b><small>{d}</small></li>' for j, (k, t, d) in enumerate(LIFE, 1))}</ol>
  <div class="branch">{ic("undo-2", 30)}<span>Không đủ vốn đúng hạn: <b>hoàn 100%</b></span></div>
</div>
<p class="ran">{ic("circle-check", 30)}Cả sáu bước đã chạy trên mạng thử</p>''',
      f"Vòng đời một chiếc xe có sáu bước. Một: gọi vốn, nhà đầu tư mua cổ phần và chuyển khoản tiền đồng ngay khi mua; quản lý không cầm tiền, tiền chỉ được giải ngân theo luật ghi trên chuỗi. Hai: cổ phần cuối cùng bán xong thì toàn bộ tiền mua xe chuyển cho Công ty A ngay trong giao dịch đó. Quá hạn mà chưa đủ vốn thì ai cũng huỷ được và mọi người lấy lại đủ tiền. Ba: Công ty A cho thuê xe 4 đến 5 năm. Bốn: mỗi lần trả tiền thuê, hợp đồng chia 90% cho người giữ cổ phần, 10% phí quản lý, phí cố định, không ai sửa được. Năm và sáu: hết kỳ thì bán xe, tiền bán chia theo số cổ phần, không thu phí. Trên Fuji cả sáu bước đã chạy: chiếc Toyota Vios đã ghi bán {money(vios['exit']['proceeds'])} và {vios['exit']['redeemed']} trên {vios['exit']['totalShares']} cổ phần đã được hoàn vốn.",
      [("4–5 năm", "TERMS.life trong web/core.js; README, Add-ons (CarExit)"),
       ("90% / 10%", "FEE_BPS trong src/FleetShares.sol"),
       ("hoàn 100%", "cancelFunding + refund trong src/FleetShares.sol; README, Who doesn't trust whom"),
       ("Cả sáu bước đã chạy", f"README Proof (listCar1, soldOutPaysOperator {CFG['tx']['soldOutPaysOperator']}, payRent, claimRent); CarExit.exitOf(3) {READ}: bán {vn(vios['exit']['proceeds'])} đơn vị = {money(vios['exit']['proceeds'])}, {vios['exit']['redeemed']}/{vios['exit']['totalShares']} cổ phần đã hoàn")],
      cap="Công ty A: tên giữ chỗ cho công ty cho thuê xe, chưa ký với công ty nào · " + SIM)

# 4 bank keeps the money, the chain keeps the proof
slide(f'''
<p class="kick">Giải pháp</p>
<h2>Ngân hàng giữ tiền, <em>blockchain giữ bằng chứng</em></h2>
<div class="duo">
  <div class="panel">
    <p class="ph">Ngân hàng</p>
    <div class="one">{ic("banknote", 150)}<b>Tiền VND</b><span class="lbl">Chuyển khoản, VietQR</span></div>
  </div>
  <div class="bridge">{ic("arrow-right", 44)}<span>{ic("user", 30)}Có người báo<br>tiền đã về</span></div>
  <div class="panel key">
    <p class="ph">Blockchain</p>
    <ul>
      <li>{ic("chart-pie", 56)}<b>Luật chia 90/10</b></li>
      <li>{ic("receipt-text", 56)}<b>Biên nhận</b></li>
      <li>{ic("list-checks", 56)}<b>Sổ đối chiếu</b></li>
    </ul>
  </div>
</div>''',
      "Ở Việt Nam tiền mã hoá không dùng để thanh toán, nên tiền đi bằng tiền đồng qua ngân hàng: nhà đầu tư chuyển khoản qua VietQR hoặc một cổng thanh toán có phép, Công ty A trả tiền thuê cũng bằng tiền đồng. Blockchain không giữ tiền. Nó giữ luật và bằng chứng: ai đã trả bao nhiêu, phần chia 90/10, khi nào tiền được giải ngân cho công ty, ai đã ký. Chuỗi không ép được một lệnh chuyển khoản; vẫn phải có cổng thanh toán hoặc người báo là tiền đã về, và đó là điểm cần tin. Trong bản demo, tiền đồng được mô phỏng bằng token thử trên Fuji, cổng thanh toán chưa nối.",
      [("90/10", "FEE_BPS trong src/FleetShares.sol"), ("Tiền mã hoá không dùng để thanh toán", "Ngân hàng Nhà nước: https://vnba.org.vn/vi/bitcoin-khong-phai-tien-phap-quy--khong-phai-la-phuong-tien-thanh-toan-hop-phap-tren-dat-nuoc-viet-nam-6822.htm")],
      cap=SIM)

# 4 buy
slide(f'''
<p class="kick">Mua cổ phần</p>
<h2>Chọn xe thật, <em>trả tiền ngay khi mua</em></h2>
<div class="prod">
  {screen(img(W / "shots/buy.png", 2400, 88), "Trang xe VinFast VF 8 Eco: ảnh xe và khung mua cổ phần", "wide tall")}
  <div class="figs">
    <div><strong class="num">{money(vf8["price"], False)}<small>triệu</small></strong><span class="lbl">một cổ phần VinFast VF 8</span></div>
    <div><strong class="num">{vf8["sold"]}<small>/{vf8["total"]}</small></strong><span class="lbl">cổ phần đã bán</span></div>
    <p class="safe">{ic("shield-check", 32)}Không đủ vốn: hoàn tiền đủ</p>
  </div>
</div>''',
      f"Đây là app thật, đang chạy. Chiếc VinFast VF 8 Eco, xe {money(vf8['price'] * vf8['total'])}, đang gọi vốn: {vf8['total']} cổ phần, mỗi cổ phần {money(vf8['price'])} đồng, đã bán {vf8['sold']}. Chọn số cổ phần, app tính phần sở hữu, tiền thuê dự kiến và phần tiền bán xe, rồi trả tiền. Tiền chỉ tới Công ty A khi bán hết; nếu tới hạn mà chưa đủ, mỗi người lấy lại đủ số đã trả.",
      [(f"{money(vf8['price'])}, {vf8['sold']}/{vf8['total']}", f"FleetShares.getCar(2), {READ} (250 đơn vị × 25.000 đ); ảnh chụp app lúc {SHOTS['at'][:16].replace('T', ' ')} UTC")],
      cap=f"{PHOTO_CREDIT[2]} · {SIM}")

# 5 collect rent
slide(f'''
<p class="kick">Nhận tiền thuê</p>
<h2>Tiền thuê <em>về ví theo cổ phần</em></h2>
<div class="prod">
  {screen(img(W / "shots/portfolio.png", 2400, 88), "Trang Portfolio của một người giữ cổ phần: tiền đã đầu tư, tiền thuê, các xe đang giữ", "wide")}
  <div class="figs">
    <div><strong class="num green">90%</strong><span class="lbl">tiền thuê cho người giữ cổ phần</span></div>
    <div><strong class="num">{money(226.8, False)}<small>triệu</small></strong><span class="lbl">40 cổ phần, hai tháng thuê</span></div>
  </div>
</div>''',
      f"Mỗi lần Công ty A trả tiền thuê, hợp đồng ghi phần của từng cổ phần ngay lúc đó. Người giữ cổ phần bấm nhận là xong. Ví dụ trên Fuji: Công ty A trả {money(315)} tiền thuê một tháng cho chiếc CX-5, {money(31.5)} là phí, {money(283.5)} cho người giữ cổ phần; một người giữ 40 trên 100 cổ phần nhận {money(226.8)} cho hai tháng. Tiền thuê kiếm được trước khi bán cổ phần vẫn thuộc người bán.",
      [("90%", "FEE_BPS trong src/FleetShares.sol"),
       (money(226.8), f"README Proof: claimRent {CFG['tx']['claimRent']}: 226,80 đơn vị (= 40% × 283,50 × 2) × 25.000 đ; payRent {CFG['tx']['payRent']}")],
      cap=f"Ví người giữ thử 0x0812…a419 · Lần nhận: {tx(CFG['tx']['claimRent'])} · {SIM}")

# 6 resell
slide(f'''
<p class="kick">Bán lại</p>
<h2>Bán cổ phần <em>cho người khác</em></h2>
<div class="prod">
  {screen(img(W / "shots/market.png", 1700, 90), "Market: các lệnh bán cổ phần đang mở", "wide")}
  <div class="figs">
    <div><strong class="num">1<small>giao dịch</small></strong><span class="lbl">tiền cho người bán, cổ phần cho người mua</span></div>
    <div><strong class="num">{offers_open}<small>lệnh</small></strong><span class="lbl">đang mở, {offer_shares} cổ phần</span></div>
  </div>
</div>''',
      f"Người giữ cổ phần đặt giá bán; cổ phần vẫn nhận tiền thuê tới khi có người mua. Người mua trả trong một giao dịch: tiền cho người bán, cổ phần cho người mua, hoặc không có gì xảy ra. Lúc chụp có {offers_open} lệnh đang mở với {offer_shares} cổ phần. Giới hạn: sổ lệnh không giữ cổ phần, nên nếu người bán đã chuyển cổ phần đi thì lệnh đó không khớp được.",
      [("1 giao dịch", "takeOffer trong src/FleetShares.sol; README, Who doesn't trust whom"),
       (f"{offers_open} lệnh, {offer_shares} cổ phần", f"trang Market của app lúc {SHOTS['at'][:16].replace('T', ' ')} UTC (đọc từ hợp đồng)"),
       ("Lệnh bán 5 cổ phần", f"README Proof: makeOffer {CFG['tx']['makeOffer']}")],
      cap=f"Sổ lệnh không giữ cổ phần của người bán · {SIM}")

# 7 reported vs paid
slide(f'''
<p class="kick">Minh bạch</p>
<h2>Công ty báo bao nhiêu, <em>trả bao nhiêu</em></h2>
<div class="ledger">
  {screen(img(W / "shots/ledger.png", 2400, 90), "Transparency: thu nhập Công ty A báo và tiền thuê đã trả, từng xe", "flat")}
  <ol class="gapline">
    <li>{ic("file-text", 44)}<span><b>Kỳ {rep3["period"]}: báo {money(rep3["income"])}</b><small>Mazda CX-5, sang mạng chính</small></span></li>
    <li class="due"><strong>{money(gap, False)}</strong><span><b>triệu còn nợ</b><small>ai cũng thấy, chưa cần ai kêu</small></span></li>
    <li class="{"ok" if late else "wait"}">{ic("circle-check" if late else "hourglass", 44)}<span><b>{"Đã trả đủ" if late else "Đã trả"}</b><small>{money(cx5["ledger"]["paid"])} / {money(cx5["ledger"]["reported"])}</small></span></li>
  </ol>
</div>''',
      f"Đây là chỗ các bên không phải tin nhau. Công ty A ghi từng lượt thuê, tổng mỗi kỳ được gửi sang mạng chính và đặt cạnh số tiền thuê thật sự đã trả. Với chiếc CX-5, báo cáo kỳ {rep3['period']} sang trước tiền thuê: báo tổng {money(rep3['income'] * rep3['period'])}, đã trả {money(paid_before)}, còn nợ {money(gap)}, hiện ngay trên app và trên hợp đồng. {("Sau đó Công ty A trả nốt, giờ là " + money(cx5['ledger']['paid']) + " trên " + money(cx5['ledger']['reported']) + ".") if late else ("Lúc đọc số liệu, khoản này chưa trả: đã trả " + money(cx5['ledger']['paid']) + " trên " + money(cx5['ledger']['reported']) + " đã báo.")} Chiếc Vios: báo {money(vios['ledger']['reported'])}, trả {money(vios['ledger']['paid'])}. Giới hạn: chuỗi không thấy lượt thuê mà công ty không ghi; hợp đồng không ép được công ty trả, chưa có tiền ký quỹ.",
      [(f"Kỳ {rep3['period']}: báo {vn(rep3['income'])}", f"IncomeMirror, sự kiện IncomeReported, tx {rep3['tx']} (khối {vn(rep3['block'])})"),
       (f"{money(gap)} còn nợ", f"README Proof: ledger(1) = báo 945, trả 630, còn 315 đơn vị (× 25.000 đ) (tx {rep3['tx']}); tiền thuê đã trả trước đó {vn(paid_before)} từ sự kiện RentPaid"),
       (f"Đã trả {money(cx5['ledger']['paid'])} / {money(cx5['ledger']['reported'])}", f"IncomeMirror.ledger(1), {READ}" + (f"; khoản trả nốt tx {late['tx']} (khối {vn(late['block'])})" if late else "")),
       (f"Vios {money(vios['ledger']['reported'])}", f"IncomeMirror.ledger(3), {READ}")],
      cap=f"Kỳ {rep3['period']}: {tx(rep3['tx'])} · Trả nốt: {tx(late['tx']) if late else '—'} · {SIM}")

# 8 two chains: a sequence diagram
slide(f'''
<p class="kick">Hai mạng</p>
<h2>Sổ cho thuê ở <em>mạng riêng</em>, đối chiếu ở <em>mạng chính</em></h2>
<div class="seq">
  <div class="lanes">
    <div class="lane"><span class="who">{ic("building-2", 40)}Công ty A</span></div>
    <div class="lane key"><span class="who">{ic("server", 40)}Mạng riêng (L1)</span></div>
    <div class="lane"><span class="who">{ic("landmark", 40)}Mạng chính</span></div>
  </div>
  <div class="msgs">
    <div class="msg m1"><b>1</b><span>Ghi từng lượt thuê</span></div>
    <div class="msg m2"><b>2</b><span>Tổng mỗi kỳ, có chữ ký</span></div>
    <div class="msg m3"><b>3</b><span>So với tiền thuê đã trả</span></div>
  </div>
  <div class="seqfig"><strong class="num">{n_reports}</strong><span class="lbl">báo cáo kỳ<br>đã sang mạng chính</span>
    <p>{ic("lock", 28)}Chỉ ví được phép mới ghi</p></div>
</div>''',
      f"Vì sao hai mạng. Sổ cho thuê hằng ngày của Công ty A nằm trên một Avalanche L1 riêng (chain 510103): mỗi lượt thuê là một giao dịch rẻ, và chỉ những ví được bật trong danh sách cho phép mới ghi được. Hết kỳ, ai cũng gọi được report: hợp đồng RentalLog tự gửi tổng của nó sang C-Chain qua Avalanche ICM (Teleporter), có chữ ký của validator L1. Trên C-Chain, IncomeMirror chỉ nhận tin từ Teleporter, từ đúng L1 đó và đúng RentalLog đó, rồi đặt tổng cạnh tiền thuê đã ghi nhận trong FleetShares. Đến {READ} đã có {n_reports} báo cáo kỳ sang tới Fuji. Giới hạn: L1 hiện do nhóm chạy, một validator, chưa có trình duyệt khối công khai.",
      [(f"{n_reports} báo cáo", f"số sự kiện IncomeReported của IncomeMirror {CFG['IncomeMirror']} từ khối 61.445.000 tới {READ}"),
       ("Chỉ ví được phép", "README, Two chains joined by Avalanche ICM (allow-list của L1 510103)")],
      cap="Mạng riêng hiện do nhóm chạy, một validator, chưa có trình duyệt khối công khai")

# 9 worked example
yrs = EX["years"]
maxv = 45000
bars = []
for i in range(yrs):
    r = rent_y * (i + 1)
    s = resale if i == yrs - 1 else 0
    bars.append(f'<div class="col"><div class="stack" style="height:{(r + s) / maxv * 100:.2f}%">'
                + (f'<i class="rs" style="flex:{s:.0f}"></i>' if s else "") + f'<i class="rt" style="flex:{r:.0f}"></i></div>'
                + (f'<b class="top">{money(r + s)}</b>' if s else "") + f'<span>Năm {i + 1}</span></div>')
slide(f'''
<p class="kick">Ví dụ, không phải dự báo</p>
<h2>Một chiếc xe <em>từ đầu đến cuối</em></h2>
<div class="ex">
  <div class="chartx">
    <div class="plot">
      <div class="inv" style="bottom:{EX["price"] / maxv * 100:.2f}%"><span>Vốn bỏ ra {money(EX["price"])}</span></div>
      {"".join(bars)}
    </div>
    <p class="legend"><span class="rt"><i></i>Tiền thuê</span><span class="rs"><i></i>Tiền bán xe</span><span>Cộng dồn, triệu đồng</span></p>
  </div>
  <div class="figs">
    <div><strong class="num">{money(back, False)}<small>triệu</small></strong><span class="lbl">về lại trên {money(EX["price"])} bỏ ra</span></div>
    <div><strong class="num green">{vn(back / EX["price"], 2)}×</strong><span class="lbl">sau {yrs} năm</span></div>
    <div><strong class="num">{vn(ex_irr * 100, 1)}%</strong><span class="lbl">mỗi năm (IRR)</span></div>
  </div>
</div>''',
      f"Một ví dụ, không phải dự báo, đúng như trang How it works của app. Giả định: xe {money(EX['price'])}, tiền thuê {vn(EX['gross'] * 100, 1)}% giá xe mỗi năm, phí {vn(EX['fee'] * 100)}%, cho thuê {yrs} năm, bán lại {vn(EX['resale'] * 100)}% giá. Người giữ cổ phần nhận {money(rent_tot)} tiền thuê cộng {money(resale)} tiền bán xe, tổng {money(back)} trên {money(EX['price'])} bỏ ra: {vn(back / EX['price'], 2)} lần, khoảng {vn(ex_irr * 100, 1)}% mỗi năm. Giá bán lại ảnh hưởng nhiều nhất: tiền thuê 15% và bán lại 60% cho 6,5% mỗi năm.",
      [("Giả định", f"const EX trong web/views/how.js: price {EX_TRIEU} (triệu đồng), gross 0.135, fee 0.10, years 5, resale 0.55"),
       (f"{money(back)} · {vn(back / EX['price'], 2)}× · {vn(ex_irr * 100, 1)}%", "tính lại bằng đúng công thức flows/irr của web/views/how.js; khớp trang How it works (1.16× · 3.8%)"),
       ("6,5%", "bảng Return per year (IRR) trên trang How it works: gross 15%, resale 60%")],
      cap=f"Giả định: xe {money(EX['price'])} · thuê {vn(EX['gross'] * 100, 1)}%/năm · phí {vn(EX['fee'] * 100)}% · {yrs} năm · bán lại {vn(EX['resale'] * 100)}% giá · từ trang How it works")

# 10 proof
qr = "data:image/svg+xml;base64," + b64(A / "qr-app.svg")
slide(f'''
<p class="kick">Bằng chứng</p>
<h2>Đã chạy thật <em>trên mạng thử</em></h2>
<div class="proof">
  <div class="tile"><strong class="num">{LIVE["tests"]}</strong><span class="lbl">bài kiểm thử, đều qua</span></div>
  <div class="tile"><strong class="num">{LIVE["contracts"]}</strong><span class="lbl">hợp đồng trên 2 mạng</span></div>
  <div class="tile"><strong class="num">{LIVE["fujiTxs"]}</strong><span class="lbl">giao dịch trên mạng thử</span></div>
  <div class="tile"><strong class="num">{n_reports}</strong><span class="lbl">báo cáo thu nhập qua 2 mạng</span></div>
  <div class="tile good"><strong class="num green">{money(vios["exit"]["proceeds"], False)}<small>triệu</small></strong><span class="lbl">bán xe Vios, chia theo cổ phần</span></div>
  <div class="qr"><a href="{APP}" target="_blank" rel="noopener"><img src="{qr}" alt="Mã QR mở app FleetShares"></a><span class="lbl">Mở app</span></div>
</div>''',
      f"Số liệu đọc lúc {READ}. {LIVE['tests']} bài kiểm thử Foundry trên các đường đi của tiền, chạy lại hôm nay, đều qua. {LIVE['contracts']} hợp đồng: FleetShares, MockUSDC, IncomeMirror, CarExit, AuditRegistry trên Fuji và RentalLog trên L1 của nhóm. {LIVE['fujiTxs']} giao dịch đã chạm vào các hợp đồng của app trên Fuji. {n_reports} báo cáo kỳ đã đi từ L1 sang Fuji. Chiếc Toyota Vios đã ghi bán {money(vios['exit']['proceeds'])} qua CarExit, {vios['exit']['redeemed']} cổ phần đã hoàn vốn. AuditRegistry có {LIVE['audits']} báo cáo kiểm toán, do ví kiểm toán của nhóm công bố. Quét mã để mở app.",
      [(f"{LIVE['tests']}", "forge test trên nhánh ui-redesign, 22/11/2026: 50 passed, 0 failed (đếm function test trong test/*.sol)"),
       (f"{LIVE['contracts']}", "docs/fuji.json: 5 hợp đồng trên Fuji + RentalLog trên L1 510103"),
       (f"{LIVE['fujiTxs']}", f"số mã giao dịch khác nhau trong log của FleetShares, IncomeMirror, CarExit, AuditRegistry từ khối 61.445.000 tới {READ}"),
       (f"{n_reports}", f"sự kiện IncomeReported, {READ}"),
       (money(vios['exit']['proceeds']), f"CarExit.exitOf(3), {READ}: {vn(vios['exit']['proceeds'])} đơn vị × 25.000 đ"),
       ("QR", APP)],
      cap=f"Đọc từ chuỗi lúc {READ} · {link(APP, APP.replace('https://', ''))}")

# 11 compare
Y, N, M = ic("check", 40, "y"), ic("x", 40, "n"), ic("minus", 40, "m")
ROWS = [("Vốn nhỏ vẫn tham gia", Y, N, Y), ("Không phải tự lo xe", Y, N, Y), ("Thấy từng khoản tiền thuê", Y, Y, M),
        ("Phí cố định trong hợp đồng", Y, M, M), ("Bán lại một phần", Y, N, M)]
slide(f'''
<p class="kick">So sánh</p>
<h2>So với <em>mua cả xe</em> hay <em>góp qua công ty</em></h2>
<div class="cmp">
  <div class="hd"><span></span><b class="us">{mark(34)}FleetShares</b><b>Mua cả xe</b><b>Góp qua công ty</b></div>
  {"".join(f'<div class="rw"><span>{l}</span><i class="us">{a}</i><i>{b}</i><i>{c}</i></div>' for l, a, b, c in ROWS)}
</div>''',
      "So với hai cách người ta đang làm. Mua cả xe: phải có đủ tiền một chiếc, tự lo xe hoặc tự tìm công ty thuê lại, bán thì bán cả chiếc; bù lại thấy hết tiền thuê của mình và không có phí quản lý. Góp qua công ty: vốn nhỏ vẫn góp được, không phải lo xe, nhưng tiền thuê, phí và báo cáo là chuyện của công ty, và rút ra thì tuỳ công ty. FleetShares: vốn nhỏ, không lo xe, từng khoản tiền thuê nằm trên chuỗi, phí 10% cố định trong mã, và bán lại được từng cổ phần.",
      [("Phí 10% cố định", "FEE_BPS constant, src/FleetShares.sol"), ("Bán lại một phần", "makeOffer / takeOffer, src/FleetShares.sol")],
      cap="Dấu gạch: không áp dụng hoặc tuỳ công ty")

# 12 law and limits
LAW = [("banknote", "Tiền đi bằng VND"), ("ban", "Tiền mã hoá không để thanh toán"), ("scale", "Có thể là chứng khoán")]
LIM = [("car", "Chưa có xe thật"), ("qr-code", "Chưa nối cổng thanh toán"), ("server", "Nhóm giữ mạng riêng, ví kiểm toán"), ("gavel", "Chưa kiểm toán, chưa tư vấn luật")]
slide(f'''
<p class="kick">Luật Việt Nam và giới hạn</p>
<h2>Bản mẫu trên mạng thử, <em>chưa chào bán</em></h2>
<div class="rules">
  <p class="row-h">Luật Việt Nam</p>
  <div class="row law">{"".join(f'<div class="cell">{ic(k, 52)}<b>{t}</b></div>' for k, t in LAW)}</div>
  <p class="row-h">Hôm nay chưa có</p>
  <div class="row lim">{"".join(f'<div class="cell">{ic(k, 52)}<b>{t}</b></div>' for k, t in LIM)}</div>
</div>''',
      "Về luật Việt Nam. Một: tiền mã hoá không phải phương tiện thanh toán hợp pháp ở Việt Nam (Ngân hàng Nhà nước); thí điểm tài sản mã hoá theo Nghị quyết 05/2025/NQ-CP yêu cầu chào bán và thanh toán bằng VND qua tổ chức được cấp phép. Hai: bán cổ phần thu nhập của xe ra công chúng nhiều khả năng là chào bán chứng khoán theo Luật Chứng khoán 2019. Đây là bản mẫu, không phải lời chào bán hay lời khuyên đầu tư. Vì vậy tiền đi bằng tiền đồng qua ngân hàng, và muốn ra thật phải có cấu trúc được cấp phép. Hôm nay chưa có: xe và công ty cho thuê thật; cổng thanh toán chưa nối, tiền đồng đang mô phỏng bằng token thử; mạng riêng và ví kiểm toán đều do nhóm giữ; chưa có tư vấn pháp lý; hợp đồng chưa được kiểm toán. Nếu công ty ngừng trả tiền thuê, hợp đồng không ép được, chưa có ký quỹ.",
      [("Tiền mã hoá không phải phương tiện thanh toán", "Ngân hàng Nhà nước: https://vnba.org.vn/vi/bitcoin-khong-phai-tien-phap-quy--khong-phai-la-phuong-tien-thanh-toan-hop-phap-tren-dat-nuoc-viet-nam-6822.htm"),
       ("Thanh toán VND qua tổ chức được cấp phép", "NQ 05/2025/NQ-CP: https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm"),
       ("Có thể là chứng khoán", "Luật Chứng khoán số 54/2019/QH14; README, Limits"),
       ("Giới hạn", "README, Limits và Add-ons; docs/fuji.json (auditor = ví của nhóm)")],
      cap="NHNN về tiền mã hoá · NQ 05/2025/NQ-CP · Luật Chứng khoán 2019 · Không phải lời chào bán hay lời khuyên đầu tư")

# 13 roadmap, drawn as a curve with three points
slide(f'''
<p class="kick">Lộ trình</p>
<h2>Từ mạng thử <em>tới một chiếc xe thật</em></h2>
<div class="road">
  <svg class="curve" viewBox="0 0 1680 600" aria-hidden="true">
    <path d="M0 574 C 120 571, 180 565, 235 558 C 500 528, 700 470, 874 390 S 1250 140, 1411 84 S 1600 30, 1680 22" fill="none" stroke="#e6e6e8" stroke-width="6"/>
    <path d="M0 574 C 120 571, 180 565, 235 558 C 500 528, 700 470, 874 390" fill="none" stroke="#0f7a4d" stroke-width="6"/>
  </svg>
  <div class="pt now" style="left:14%;bottom:7%"><i></i><p class="when">Bây giờ</p><b>Mạng thử</b><small>3 xe mẫu · tiền mô phỏng</small></div>
  <div class="pt next" style="left:52%;bottom:35%"><i></i><p class="when">Tiếp theo</p><b>1 xe thật, 1 công ty</b><small>Nối VietQR · pháp lý · kiểm toán</small></div>
  <div class="pt later" style="left:84%;bottom:86%"><i></i><p class="when">Sau đó</p><b>Công ty tự chạy mạng riêng</b><small>Ký quỹ của công ty cho thuê</small></div>
</div>''',
      "Lộ trình ba bước. Bây giờ: testnet, ba xe mẫu, tiền đồng mô phỏng bằng token thử, đủ vòng đời từ gọi vốn tới bán xe. Tiếp theo: nối cổng thanh toán VietQR, một chiếc xe thật với một công ty cho thuê có giấy phép ở Việt Nam, báo cáo thu nhập hằng tháng; song song là tư vấn pháp lý cho cấu trúc và kiểm toán hợp đồng. Sau đó: giao validator và danh sách cho phép của mạng riêng cho công ty cho thuê, thêm trình duyệt khối công khai, và thêm khoản ký quỹ của công ty, bị trừ khi tiền thuê đã báo mà quá hạn chưa trả. Chúng tôi đang tìm một công ty cho thuê xe cho chiếc xe đầu tiên và tư vấn pháp lý.",
      [("3 xe mẫu", f"FleetShares.carCount(), {READ}"), ("Các bước tiếp theo", "docs/SLIDES.md cũ, mục Next; README, Limits")],
      cap="Chưa có công ty cho thuê hay đơn vị kiểm toán nào ký với nhóm")

# 14 thanks
slide(f'''
<div class="thanks">
  {logo(104, "hero")}
  <h1>Cảm ơn</h1>
  <p class="team">Team Oicha</p>
  <p class="avax">Xây trên Avalanche · Chạy trên testnet Fuji</p>
</div>''', "Cảm ơn ban giám khảo.", cls="nofootlogo")

# ---------- page ----------

FONTS = "\n".join(f"@font-face{{font-family:'IBM Plex Sans';font-weight:{w};font-style:normal;src:url(data:font/ttf;base64,{b64(W / 'fonts' / f'plex{i}.ttf')}) format('truetype')}}"
                  for i, w in enumerate([400, 500, 600, 700], 1))
CSS = FONTS + r'''
:root{--bg:#fff;--s2:#f5f5f6;--line:#e6e6e8;--ink:#0d1117;--ink2:#475260;--ink3:#646d79;--red:#c8102e;--green:#0f7a4d;--amber:#a35700;--redbg:#fbeef0;--greenbg:#edf6f1;--amberbg:#fbf3e8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#e9e9ec;overflow:hidden}
body{font-family:'IBM Plex Sans',sans-serif;font-weight:400;color:var(--ink);-webkit-font-smoothing:antialiased;font-feature-settings:"tnum" 1,"lnum" 1}
#stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:0 0}
.slide{position:absolute;inset:0;display:none;flex-direction:column;padding:88px 120px 120px;overflow:hidden;background:var(--bg)}
.slide.on{display:flex}
.slide:before{content:"";position:absolute;left:0;top:0;right:0;height:8px;background:var(--red)}
h1,h2{font-weight:600;letter-spacing:-.02em;text-wrap:balance}
h1{font-size:58px;line-height:1.16}
h2{font-size:60px;line-height:1.14;margin-bottom:44px;max-width:1560px}
em{font-style:normal;color:var(--red)}
.kick{font-size:20px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--red);margin-bottom:18px}
.lbl{font-size:26px;font-weight:500;line-height:1.3;color:var(--ink2);text-wrap:balance}
.num{font-size:112px;font-weight:600;line-height:1;letter-spacing:-.03em;display:block;color:var(--ink)}
.num small{font-size:.32em;font-weight:500;letter-spacing:0;color:var(--ink3);margin-left:12px}
.red{color:var(--red)}.green{color:var(--green)}
.ic{flex:0 0 auto}
a{color:inherit}
footer{position:absolute;left:120px;right:120px;bottom:44px;display:flex;align-items:center;gap:28px;font-size:18px;color:var(--ink3)}
footer .cap{flex:1}footer .pg{font-weight:600}
footer a{color:var(--ink3);text-underline-offset:3px}
.logo{display:inline-flex;align-items:center;gap:.32em;font-weight:600;letter-spacing:-.02em;line-height:1;white-space:nowrap}
.logo.foot{color:var(--ink2)}
.nofootlogo footer .logo{visibility:hidden}
.fill{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;padding-bottom:16px}
.pill{display:inline-block;font-style:normal;font-size:20px;font-weight:500;padding:4px 12px;border-radius:6px}
.pill.good{background:var(--greenbg);color:var(--green)}
.screen{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
.screen .bar{height:38px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid var(--line);background:var(--s2)}
.screen .bar i{width:11px;height:11px;border-radius:50%;background:#d4d5d9;display:block}
.screen .bar span{margin-left:14px;font-size:15px;color:var(--ink3)}
.screen img{display:block;width:100%}
.screen.tall img{height:740px;object-fit:cover;object-position:top}
/* 1 cover */
.cover{flex:1;display:grid;grid-template-columns:1fr 760px;gap:64px;align-items:center}
.cover h1{margin:52px 0 52px}
.chips{list-style:none;display:flex;flex-direction:column;gap:22px}
.chips li{display:flex;align-items:center;gap:20px;font-size:30px;font-weight:500}
.chips .ic{color:var(--red)}
.avax{font-size:19px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
.cover .avax{margin-top:60px}
.hero-photo{position:relative;border-radius:8px;overflow:hidden;height:820px}
.hero-photo img{width:100%;height:100%;object-fit:cover;object-position:52% 50%;display:block}
.hero-photo figcaption{position:absolute;left:28px;bottom:28px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:22px 26px;display:flex;flex-direction:column;gap:8px}
.hero-photo figcaption b{font-size:28px;font-weight:600}
.hero-photo figcaption span{font-size:22px;color:var(--ink2)}
.hero-photo figcaption .pill{align-self:flex-start;margin-top:4px}
/* 2 problem */
.prob{display:grid;grid-template-columns:1fr 760px;gap:80px;align-items:center}
.prob .big .num{font-size:200px;white-space:nowrap}
.prob .big .lbl{display:block;margin-top:26px;font-size:32px}
.prob .big small{display:block;font-size:22px;color:var(--ink3);margin-top:8px;font-weight:400}
.walls{display:flex;flex-direction:column;gap:22px}
.wall{display:flex;align-items:center;gap:34px;border:1px solid var(--line);border-radius:8px;padding:34px 40px;color:var(--ink2)}
.wall .mid{display:block;font-size:48px;font-weight:600;color:var(--ink);letter-spacing:-.02em;line-height:1.1;margin-bottom:8px}
.mkt{font-size:22px;color:var(--ink3);margin-top:12px;padding-left:4px}
.mkt b{color:var(--ink);font-weight:600;font-size:26px;margin-right:6px}
/* 3 lifecycle */
.life ol{list-style:none;display:grid;grid-template-columns:repeat(6,1fr);position:relative}
.life ol:before{content:"";position:absolute;left:calc(100%/12);right:calc(100%/12);top:85px;height:3px;background:var(--line)}
.life li{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;position:relative}
.disc{width:170px;height:170px;border-radius:50%;border:3px solid var(--red);background:#fff;color:var(--red);display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:22px}
.disc i{position:absolute;top:-6px;right:-6px;width:46px;height:46px;border-radius:50%;background:var(--red);color:#fff;font-style:normal;font-size:24px;font-weight:600;display:flex;align-items:center;justify-content:center}
.life li:nth-child(4) .disc{background:var(--redbg)}
.life li b{font-size:30px;font-weight:600;line-height:1.2}
.life li small{font-size:22px;color:var(--ink2);line-height:1.35}
.branch{display:inline-flex;align-items:center;gap:14px;margin:44px 0 0 calc(100%/12 - 30px);padding:14px 22px;border:1px dashed var(--ink3);border-radius:8px;font-size:23px;color:var(--ink2);position:relative}
.branch:before{content:"";position:absolute;left:28px;top:-46px;height:44px;border-left:2px dashed var(--ink3)}
.branch b{color:var(--ink);font-weight:600}
.ran{display:flex;align-items:center;gap:12px;margin-top:56px;font-size:24px;font-weight:500;color:var(--green);justify-content:center}
/* bank vs chain */
.duo{display:grid;grid-template-columns:1fr 260px 1fr;gap:0;align-items:stretch;height:600px}
.panel{border:1px solid var(--line);border-radius:8px;padding:40px 52px;display:flex;flex-direction:column}
.panel.key{border:2px solid var(--red);background:var(--redbg)}
.ph{font-size:20px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
.panel.key .ph{color:var(--red)}
.panel .one{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:var(--green)}
.panel .one b{font-size:64px;font-weight:600;color:var(--ink);letter-spacing:-.02em}
.panel ul{list-style:none;flex:1;display:flex;flex-direction:column;justify-content:center;gap:44px}
.panel li{display:flex;align-items:center;gap:28px;color:var(--red)}
.panel li b{color:var(--ink);font-size:42px;font-weight:600}
.bridge{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:var(--ink3);text-align:center}
.bridge span{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:21px;font-weight:500;color:var(--amber);background:var(--amberbg);border-radius:8px;padding:14px 16px;line-height:1.3}
/* 4-6 product */
.prod{display:grid;grid-template-columns:1140px 1fr;gap:80px;align-items:center}
.figs{display:flex;flex-direction:column;gap:52px}
.figs .lbl{display:block;margin-top:14px}
.safe{display:flex;align-items:center;gap:14px;font-size:24px;font-weight:500;color:var(--green);border-top:1px solid var(--line);padding-top:30px}
/* 7 ledger */
.ledger{display:flex;flex-direction:column;gap:44px}
.gapline{list-style:none;display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:0;position:relative}
.gapline li{display:flex;align-items:center;gap:22px;padding:26px 32px;border:1px solid var(--line);color:var(--ink2)}
.gapline li+li{border-left:0}
.gapline li:first-child{border-radius:8px 0 0 8px}.gapline li:last-child{border-radius:0 8px 8px 0}
.gapline span{display:flex;flex-direction:column;gap:4px}
.gapline b{font-size:30px;font-weight:600;color:var(--ink)}
.gapline small{font-size:21px;color:var(--ink3)}
.gapline .due{background:var(--amberbg);border-color:#ecd9bd}
.gapline .due strong{font-size:84px;font-weight:600;color:var(--amber);letter-spacing:-.03em;line-height:1}
.gapline .due b{color:var(--amber)}
.gapline .ok{background:var(--greenbg);border-color:#cfe5d9;color:var(--green)}
.gapline .ok b{color:var(--green)}
.gapline .wait{background:var(--s2)}
/* 8 sequence */
.seq{display:grid;grid-template-columns:1fr 360px;grid-template-rows:auto 1fr;column-gap:80px;position:relative}
.lanes{grid-column:1;display:grid;grid-template-columns:repeat(3,1fr)}
.lane{display:flex;flex-direction:column;align-items:center;position:relative;height:560px}
.lane:after{content:"";position:absolute;top:96px;bottom:0;left:50%;border-left:2px dashed var(--line)}
.who{display:flex;align-items:center;gap:14px;font-size:28px;font-weight:600;border:1px solid var(--line);border-radius:8px;padding:20px 28px;background:#fff;color:var(--ink);white-space:nowrap}
.who .ic{color:var(--ink2)}
.lane.key .who{border-color:var(--red);color:var(--red)}.lane.key .who .ic{color:var(--red)}
.msgs{position:absolute;left:0;top:0;width:calc(100% - 440px);height:560px}
.msg{position:absolute;display:flex;align-items:center;gap:14px;font-size:26px;font-weight:500;color:var(--ink)}
.msg b{width:40px;height:40px;border-radius:50%;background:var(--red);color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.msg:after{content:"";position:absolute;left:0;right:0;bottom:-18px;height:3px;background:var(--ink2)}
.msg:before{content:"";position:absolute;right:-2px;bottom:-25px;width:14px;height:14px;border-top:3px solid var(--ink2);border-right:3px solid var(--ink2);transform:rotate(45deg)}
.m1{left:16.67%;width:33.33%;top:170px;justify-content:center}
.m2{left:50%;width:33.33%;top:300px;justify-content:center}
.m3{left:83.33%;top:430px;width:0;justify-content:flex-start}
.m3:after,.m3:before{content:none}
.m3{transform:translateX(-50%);width:auto;background:var(--greenbg);color:var(--green);padding:14px 22px;border-radius:8px;white-space:nowrap}
.seqfig{grid-column:2;grid-row:1/3;align-self:center;border-left:1px solid var(--line);padding-left:56px}
.seqfig .num{font-size:160px}
.seqfig .lbl{display:block;margin-top:16px}
.seqfig p{display:flex;align-items:center;gap:12px;margin-top:48px;font-size:23px;font-weight:500;color:var(--ink2)}
/* 9 example */
.ex{display:grid;grid-template-columns:1fr 440px;gap:100px;align-items:stretch}
.chartx{display:flex;flex-direction:column}
.plot{position:relative;height:580px;display:flex;align-items:flex-end;gap:56px;padding:0 40px 0 260px;border-bottom:2px solid var(--ink)}
.col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}
.stack{width:100%;display:flex;flex-direction:column;border-radius:6px 6px 0 0;overflow:hidden}
.stack i{display:block}
.rt{background:var(--red)}.rs{background:#475260}
.col span{position:absolute;top:100%;margin-top:14px;font-size:22px;color:var(--ink3);white-space:nowrap}
.col .top{position:absolute;bottom:calc(100% * (32410/45000) + 10px);font-size:30px;font-weight:600;white-space:nowrap}
.inv{position:absolute;left:0;right:0;border-top:2px dashed var(--ink3);z-index:1}
.inv span{position:absolute;left:0;top:-36px;font-size:22px;color:var(--ink2);font-weight:500;background:#fff;padding-right:12px}
.legend{display:flex;gap:36px;margin-top:62px;padding-left:260px;font-size:21px;color:var(--ink3)}
.legend span{display:flex;align-items:center;gap:10px;background:none}
.legend i{width:18px;height:18px;border-radius:4px;display:block}
.legend .rt i{background:var(--red)}.legend .rs i{background:#475260}
.ex .figs{justify-content:center;gap:44px}
.ex .num{font-size:96px}
/* 10 proof */
.proof{display:grid;grid-template-columns:repeat(3,1fr) 360px;grid-template-rows:1fr 1fr;gap:22px;height:640px}
.tile{border:1px solid var(--line);border-radius:8px;padding:34px 38px;display:flex;flex-direction:column;justify-content:flex-end}
.tile .lbl{margin-top:14px}
.tile.good{background:var(--greenbg);border-color:#cfe5d9}
.proof .tile:nth-child(5){grid-column:span 2}
.qr{grid-column:4;grid-row:1/3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;border:1px solid var(--line);border-radius:8px}
.qr img{width:290px;height:290px;display:block}
/* 11 compare */
.cmp{display:grid;gap:12px}
.hd,.rw{display:grid;grid-template-columns:1fr 330px 330px 330px;align-items:center}
.hd b{display:flex;align-items:center;justify-content:center;gap:12px;font-size:26px;font-weight:600;color:var(--ink2);padding-bottom:8px}
.hd b.us{color:var(--red)}
.rw{border:1px solid var(--line);border-radius:8px;height:104px;padding-left:36px}
.rw span{font-size:30px;font-weight:500}
.rw i{display:flex;align-items:center;justify-content:center;height:100%}
.rw i.us{background:var(--redbg)}
.y{color:var(--green)}.n{color:var(--red)}.m{color:var(--ink3)}
/* 12 law */
.rules{display:flex;flex-direction:column}
.row-h{font-size:20px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin:0 0 16px}
.row{display:grid;gap:20px;margin-bottom:44px}
.row.law{grid-template-columns:repeat(3,1fr)}
.row.lim{grid-template-columns:repeat(4,1fr);margin-bottom:0}
.cell{border:1px solid var(--line);border-radius:8px;padding:30px 32px;display:flex;flex-direction:column;gap:22px;min-height:210px}
.cell b{font-size:28px;font-weight:600;line-height:1.25;text-wrap:balance}
.law .cell{color:var(--red)}.law .cell b{color:var(--ink)}
.lim .cell{background:var(--s2);border-color:var(--s2);color:var(--ink2)}.lim .cell b{color:var(--ink)}
/* 13 roadmap */
.road{position:relative;height:600px}
.curve{position:absolute;left:0;top:0;width:1680px;height:600px}
.pt .when,.pt b,.pt small{width:max-content;background:#fff;padding-right:10px}
.pt.later .when,.pt.later b,.pt.later small{margin-left:auto;padding:0 0 0 10px}
.pt.now{padding-bottom:70px}
.pt{position:absolute;transform:translateX(-24px)}
.pt i{position:absolute;left:0;bottom:-24px;width:48px;height:48px;border-radius:50%;background:#fff;border:6px solid var(--ink3);display:block}
.pt.now i{background:var(--green);border-color:var(--green)}
.pt.next i{border-color:var(--red)}
.pt .when,.pt b,.pt small{position:relative;left:0;display:block;white-space:nowrap}
.pt{padding:0 0 46px 0}
.pt .when{font-size:20px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px}
.pt.now .when{color:var(--green)}.pt.next .when{color:var(--red)}
.pt b{font-size:34px;font-weight:600}
.pt small{font-size:22px;color:var(--ink2);margin-top:8px}
.pt.later{transform:translateX(calc(-100% + 24px));text-align:right}
.pt.later i{left:auto;right:0}
/* 14 thanks */
.thanks{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px}
.thanks h1{font-size:150px;letter-spacing:-.03em;margin-top:20px}
.team{font-size:34px;font-weight:500;color:var(--ink2)}
.thanks .avax{margin-top:30px}
#bar{position:fixed;right:14px;bottom:10px;display:flex;gap:8px;z-index:5;opacity:.5}
#bar:hover,#bar:focus-within{opacity:1}
#bar button{font:inherit;font-size:12px;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:6px;padding:5px 11px;cursor:pointer}
.export #bar,.print #bar{display:none}
html.print,body.print{height:auto;overflow:visible;background:#fff}
.print #stage{position:static;transform:none !important;width:1920px;height:auto}
.print .slide{position:relative;display:flex !important;width:1920px;height:1080px;break-after:page;page-break-after:always}
@page{size:1920px 1080px;margin:0}
'''

JS = (pathlib.Path(__file__).parent / "deck.js").read_text()

HTML = f'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FleetShares · pitch</title>
<style>{CSS}</style>
</head>
<body>
<div id="stage">
{chr(10).join(s for s, _, _ in SLIDES)}
</div>
<div id="bar"><button id="prev" aria-label="Slide trước">←</button><button id="next" aria-label="Slide sau">→</button><button id="full">Toàn màn hình</button></div>
<script>{JS}</script>
</body>
</html>
'''
(W / "deck.html").write_text(HTML, encoding="utf-8")
(W / "notes.json").write_text(json.dumps([n for _, n, _ in SLIDES], ensure_ascii=False, indent=1), encoding="utf-8")
(W / "sources.json").write_text(json.dumps([s for _, _, s in SLIDES], ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{(W / 'deck.html').stat().st_size / 1e6:.2f} MB", len(SLIDES), "slides", READ)
