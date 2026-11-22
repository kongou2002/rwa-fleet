# FleetShares: slide pitch (22/11/2026)

15 slide, dựng trong `deck.html` (1920×1080, font IBM Plex Sans nhúng sẵn, có đủ dấu tiếng Việt). Mỗi slide là một hình; câu đầy đủ nằm ở ghi chú người nói.

Tiền trên slide là tiền đồng. Bản demo trên testnet mô phỏng tiền VND bằng một token thử theo tỷ giá demo của app, 1 đơn vị = 25.000 đ; cổng thanh toán chưa nối.

Tên Avalanche và Fuji chỉ có trên slide 1 và slide cuối; các slide giữa gọi là "mạng riêng (L1)", "mạng chính", "testnet". Tên kỹ thuật (C-Chain, ICM, Teleporter) nằm trong ghi chú người nói.

Số liệu sống đọc từ Fuji lúc khối 61,448,230 (2026-11-22 00:13 UTC) qua https://avalanche-fuji-c-chain-rpc.publicnode.com. Ảnh chụp app lúc 2026-11-22 00:12 UTC, ví chỉ đọc 0x0812ebF118750B566858241b429C574Aec59a419.

## 1. Tổng quan

Chữ trên slide:

> FleetShares
> Mua một phần chiếc xe cho thuê,
> nhận một phần tiền thuê
> Mua xe theo cổ phần
> Tiền thuê chia 90/10
> Bán lại cổ phần
> XÂY TRÊN AVALANCHE · CHẠY TRÊN TESTNET FUJI
> Mazda CX-5 2.0
> 100 phần × 7 triệu · 700 triệu
> Đang cho thuê
> Ảnh: ShangTW, CC BY-SA 4.0 · Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Xin chào, chúng tôi là FleetShares. Một chiếc xe cho thuê được chia thành cổ phần, ví dụ chiếc Mazda CX-5 700 triệu đồng chia làm 100 phần, mỗi phần 7 triệu. Người mua chuyển khoản tiền đồng, và mỗi lần công ty cho thuê trả tiền thuê, phần chia được ghi ngay: 90% cho người giữ cổ phần, 10% phí quản lý. Muốn rút ra thì bán cổ phần cho người khác. Xin nói trước: bản demo chạy trên Avalanche Fuji, testnet; tiền VND được mô phỏng bằng một token thử theo tỷ giá demo 1 đơn vị = 25.000 đồng, cổng thanh toán chưa nối; công ty cho thuê là Công ty A, tên giữ chỗ; tiền thuê do ví của nhóm trả thay công ty.

Số liệu và nguồn:

- 90/10: phí FEE_BPS cố định trong src/FleetShares.sol; README, mục Who doesn't trust whom
- 100 phần × 7 triệu: FleetShares.getCar(1) trên Fuji, khối 61.448.230 (2026-11-22 00:13 UTC): 100 × 280 đơn vị token thử × 25.000 đ (tỷ giá demo của app); README, Proof: listCar1 0x02523e17934d4eae2634c154ddfa963314ff61a89cdda54e2381eed568e6adf6

Liên kết trên slide:

- Ảnh: ShangTW: https://commons.wikimedia.org/wiki/File:2022_Mazda_CX-5_2.0_front.jpg

## 2. Vấn đề

Chữ trên slide:

> VẤN ĐỀ
> Lãi xe cho thuê chỉ dành cho người mua cả chiếc
> 10–15%
> tiền thuê mỗi năm trên giá xe
> ước tính của ngành
> 700 triệu
> Mua cả chiếc
> Góp qua công ty
> Phải tin sổ sách của họ
> FleetShares
> 10–15%: ước tính của ngành, nhóm chưa đo · Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Một chiếc xe cho thuê ở Việt Nam đem về khoảng 10 đến 15% giá xe mỗi năm tiền thuê. Đây là ước tính của ngành, nhóm chưa tự đo. Nhưng chỉ người mua nổi cả chiếc mới có khoản đó: một chiếc CX-5 trong vault giá 700 triệu đồng. Cách còn lại là góp tiền qua một công ty, và khi đó phải tin công ty về tiền, về phí và về báo cáo thu nhập.

Số liệu và nguồn:

- 10–15%: khoảng trong đề bài của ban giám khảo cho dự án này; app dùng 12–15% (TERMS.gross trong web/core.js). Ước tính, nhóm chưa đo.
- 700 triệu: giá xe Mazda CX-5 2.0 = 100 phần × 280 đơn vị × 25.000 đ, FleetShares.getCar(1), khối 61.448.230 (2026-11-22 00:13 UTC)

## 3. Vòng đời một chiếc xe

Chữ trên slide:

> CÁCH HOẠT ĐỘNG
> Vòng đời một chiếc xe
> 1
> Gọi vốn
> Chuyển khoản
> mua cổ phần
> 2
> Đủ vốn, mua xe
> Tiền tới
> Công ty A
> 3
> Cho thuê
> 4–5 năm
> 4
> Chia tiền thuê
> 90% người giữ
> 10% phí
> 5
> Bán xe
> Cuối kỳ thuê
> 6
> Hoàn vốn
> Theo số
> cổ phần
> Không đủ vốn đúng hạn: hoàn 100%
> Cả sáu bước đã chạy trên mạng thử
> FleetShares
> Công ty A: tên giữ chỗ cho công ty cho thuê xe, chưa ký với công ty nào · Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Vòng đời một chiếc xe có sáu bước. Một: gọi vốn, nhà đầu tư mua cổ phần và chuyển khoản tiền đồng ngay khi mua; quản lý không cầm tiền, tiền chỉ được giải ngân theo luật ghi trên chuỗi. Hai: cổ phần cuối cùng bán xong thì toàn bộ tiền mua xe chuyển cho Công ty A ngay trong giao dịch đó. Quá hạn mà chưa đủ vốn thì ai cũng huỷ được và mọi người lấy lại đủ tiền. Ba: Công ty A cho thuê xe 4 đến 5 năm. Bốn: mỗi lần trả tiền thuê, hợp đồng chia 90% cho người giữ cổ phần, 10% phí quản lý, phí cố định, không ai sửa được. Năm và sáu: hết kỳ thì bán xe, tiền bán chia theo số cổ phần, không thu phí. Trên Fuji cả sáu bước đã chạy: chiếc Toyota Vios đã ghi bán 270 triệu và 70 trên 120 cổ phần đã được hoàn vốn.

Số liệu và nguồn:

- 4–5 năm: TERMS.life trong web/core.js; README, Add-ons (CarExit)
- 90% / 10%: FEE_BPS trong src/FleetShares.sol
- hoàn 100%: cancelFunding + refund trong src/FleetShares.sol; README, Who doesn't trust whom
- Cả sáu bước đã chạy: README Proof (listCar1, soldOutPaysOperator 0xb8879dee425910b16eab691de88fa667dad881b236c74d38eec646888985d813, payRent, claimRent); CarExit.exitOf(3) khối 61.448.230 (2026-11-22 00:13 UTC): bán 10.800 đơn vị = 270 triệu, 70/120 cổ phần đã hoàn

## 4. Ngân hàng giữ tiền, blockchain giữ bằng chứng

Chữ trên slide:

> GIẢI PHÁP
> Ngân hàng giữ tiền, blockchain giữ bằng chứng
> NGÂN HÀNG
> Tiền VND
> Chuyển khoản, VietQR
> Có người báo
> tiền đã về
> BLOCKCHAIN
> Luật chia 90/10
> Biên nhận
> Sổ đối chiếu
> FleetShares
> Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Ở Việt Nam tiền mã hoá không dùng để thanh toán, nên tiền đi bằng tiền đồng qua ngân hàng: nhà đầu tư chuyển khoản qua VietQR hoặc một cổng thanh toán có phép, Công ty A trả tiền thuê cũng bằng tiền đồng. Blockchain không giữ tiền. Nó giữ luật và bằng chứng: ai đã trả bao nhiêu, phần chia 90/10, khi nào tiền được giải ngân cho công ty, ai đã ký. Chuỗi không ép được một lệnh chuyển khoản; vẫn phải có cổng thanh toán hoặc người báo là tiền đã về, và đó là điểm cần tin. Trong bản demo, tiền đồng được mô phỏng bằng token thử trên Fuji, cổng thanh toán chưa nối.

Số liệu và nguồn:

- 90/10: FEE_BPS trong src/FleetShares.sol
- Tiền mã hoá không dùng để thanh toán: Ngân hàng Nhà nước: https://vnba.org.vn/vi/bitcoin-khong-phai-tien-phap-quy--khong-phai-la-phuong-tien-thanh-toan-hop-phap-tren-dat-nuoc-viet-nam-6822.htm

## 5. Mua cổ phần

Chữ trên slide:

> MUA CỔ PHẦN
> Chọn xe thật, trả tiền ngay khi mua
> kongou2002.github.io/rwa-fleet
> 6,25triệu
> một cổ phần VinFast VF 8
> 100/160
> cổ phần đã bán
> Không đủ vốn: hoàn tiền đủ
> FleetShares
> Ảnh xe: Alexander-93, CC BY-SA 4.0 · Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Đây là app thật, đang chạy. Chiếc VinFast VF 8 Eco, xe 1 tỷ, đang gọi vốn: 160 cổ phần, mỗi cổ phần 6,25 triệu đồng, đã bán 100. Chọn số cổ phần, app tính phần sở hữu, tiền thuê dự kiến và phần tiền bán xe, rồi trả tiền. Tiền chỉ tới Công ty A khi bán hết; nếu tới hạn mà chưa đủ, mỗi người lấy lại đủ số đã trả.

Số liệu và nguồn:

- 6,25 triệu, 100/160: FleetShares.getCar(2), khối 61.448.230 (2026-11-22 00:13 UTC) (250 đơn vị × 25.000 đ); ảnh chụp app lúc 2026-11-22 00:12 UTC

Liên kết trên slide:

- Ảnh xe: Alexander-93: https://commons.wikimedia.org/wiki/File:VinFast_VF_8_IAA_2023_1X7A0681.jpg

## 6. Nhận tiền thuê

Chữ trên slide:

> NHẬN TIỀN THUÊ
> Tiền thuê về ví theo cổ phần
> kongou2002.github.io/rwa-fleet
> 90%
> tiền thuê cho người giữ cổ phần
> 5,67triệu
> 40 cổ phần, hai tháng thuê
> FleetShares
> Ví người giữ thử 0x0812…a419 · Lần nhận: 0xd2a7…764d · Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Mỗi lần Công ty A trả tiền thuê, hợp đồng ghi phần của từng cổ phần ngay lúc đó. Người giữ cổ phần bấm nhận là xong. Ví dụ trên Fuji: Công ty A trả 7,875 triệu tiền thuê một tháng cho chiếc CX-5, 787.500 đ là phí, 7,0875 triệu cho người giữ cổ phần; một người giữ 40 trên 100 cổ phần nhận 5,67 triệu cho hai tháng. Tiền thuê kiếm được trước khi bán cổ phần vẫn thuộc người bán.

Số liệu và nguồn:

- 90%: FEE_BPS trong src/FleetShares.sol
- 5,67 triệu: README Proof: claimRent 0xd2a782fb2bb2049bdb5d28a4c5c8b9fcbf6107e863fc6b0de47263be4703764d: 226,80 đơn vị (= 40% × 283,50 × 2) × 25.000 đ; payRent 0xaf5d3501904d84f35e9a1abbb2cb481140810be8ffb3a168bad1670140de2780

Liên kết trên slide:

- 0xd2a7…764d: https://testnet.snowtrace.io/tx/0xd2a782fb2bb2049bdb5d28a4c5c8b9fcbf6107e863fc6b0de47263be4703764d

## 7. Bán lại

Chữ trên slide:

> BÁN LẠI
> Bán cổ phần cho người khác
> kongou2002.github.io/rwa-fleet
> 1giao dịch
> tiền cho người bán, cổ phần cho người mua
> 4lệnh
> đang mở, 21 cổ phần
> FleetShares
> Sổ lệnh không giữ cổ phần của người bán · Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Người giữ cổ phần đặt giá bán; cổ phần vẫn nhận tiền thuê tới khi có người mua. Người mua trả trong một giao dịch: tiền cho người bán, cổ phần cho người mua, hoặc không có gì xảy ra. Lúc chụp có 4 lệnh đang mở với 21 cổ phần. Giới hạn: sổ lệnh không giữ cổ phần, nên nếu người bán đã chuyển cổ phần đi thì lệnh đó không khớp được.

Số liệu và nguồn:

- 1 giao dịch: takeOffer trong src/FleetShares.sol; README, Who doesn't trust whom
- 4 lệnh, 21 cổ phần: trang Market của app lúc 2026-11-22 00:12 UTC (đọc từ hợp đồng)
- Lệnh bán 5 cổ phần: README Proof: makeOffer 0x1aaa07517aa266c4ef5aa6258c526046ef8a33baaa4671caa5c711efddaef625

## 8. Công ty báo bao nhiêu, trả bao nhiêu

Chữ trên slide:

> MINH BẠCH
> Công ty báo bao nhiêu, trả bao nhiêu
> kongou2002.github.io/rwa-fleet
> Kỳ 4: báo 7,875 triệu
> Mazda CX-5, sang mạng chính
> 7,875
> triệu chưa trả
> ai cũng thấy, chưa cần ai kêu
> Đã trả đủ
> 31,5 triệu / 31,5 triệu
> FleetShares
> Kỳ 4: 0xcf65…9b75 · Trả nốt: 0x56e5…4869 · Bản demo trên testnet: tiền VND được mô phỏng bằng token thử; cổng thanh toán chưa nối.

Ghi chú người nói:

Đây là chỗ các bên không phải tin nhau. Công ty A ghi từng lượt thuê, tổng mỗi kỳ được gửi sang mạng chính và đặt cạnh số tiền thuê thật sự đã trả. Với chiếc CX-5, báo cáo kỳ 4 sang trước tiền thuê: báo tổng 31,5 triệu, đã trả 23,625 triệu, còn nợ 7,875 triệu, hiện ngay trên app và trên hợp đồng. Sau đó Công ty A trả nốt, giờ là 31,5 triệu trên 31,5 triệu. Chiếc Vios: báo 10,125 triệu, trả 10,125 triệu. Giới hạn: chuỗi không thấy lượt thuê mà công ty không ghi; hợp đồng không ép được công ty trả, chưa có tiền ký quỹ.

Số liệu và nguồn:

- Kỳ 4: báo 315: IncomeMirror, sự kiện IncomeReported, tx 0xcf65497d9936d03cb7c19ab6586f3148e1d3121b1f5418b1c60447b30a479b75 (khối 61.447.739)
- 7,875 triệu còn nợ: README Proof: ledger(1) = báo 945, trả 630, còn 315 đơn vị (× 25.000 đ) (tx 0xcf65497d9936d03cb7c19ab6586f3148e1d3121b1f5418b1c60447b30a479b75); tiền thuê đã trả trước đó 945 từ sự kiện RentPaid
- Đã trả 31,5 triệu / 31,5 triệu: IncomeMirror.ledger(1), khối 61.448.230 (2026-11-22 00:13 UTC); khoản trả nốt tx 0x56e5a7cd8ede58f6e1b62807c18a3ee0aee61296492d2c1889e2066e5daa4869 (khối 61.448.038)
- Vios 10,125 triệu: IncomeMirror.ledger(3), khối 61.448.230 (2026-11-22 00:13 UTC)

Liên kết trên slide:

- 0xcf65…9b75: https://testnet.snowtrace.io/tx/0xcf65497d9936d03cb7c19ab6586f3148e1d3121b1f5418b1c60447b30a479b75
- 0x56e5…4869: https://testnet.snowtrace.io/tx/0x56e5a7cd8ede58f6e1b62807c18a3ee0aee61296492d2c1889e2066e5daa4869

## 9. Hai mạng

Chữ trên slide:

> HAI MẠNG
> Sổ cho thuê ở mạng riêng, đối chiếu ở mạng chính
> Công ty A
> Mạng riêng (L1)
> Mạng chính
> 1
> Ghi từng lượt thuê
> 2
> Tổng mỗi kỳ, có chữ ký
> 3
> So với tiền thuê đã trả
> 6
> báo cáo kỳ
> đã sang mạng chính
> Chỉ ví được phép mới ghi
> FleetShares
> Mạng riêng hiện do nhóm chạy, một validator, chưa có trình duyệt khối công khai

Ghi chú người nói:

Vì sao hai mạng. Sổ cho thuê hằng ngày của Công ty A nằm trên một Avalanche L1 riêng (chain 510103): mỗi lượt thuê là một giao dịch rẻ, và chỉ những ví được bật trong danh sách cho phép mới ghi được. Hết kỳ, ai cũng gọi được report: hợp đồng RentalLog tự gửi tổng của nó sang C-Chain qua Avalanche ICM (Teleporter), có chữ ký của validator L1. Trên C-Chain, IncomeMirror chỉ nhận tin từ Teleporter, từ đúng L1 đó và đúng RentalLog đó, rồi đặt tổng cạnh tiền thuê đã ghi nhận trong FleetShares. Đến khối 61.448.230 (2026-11-22 00:13 UTC) đã có 6 báo cáo kỳ sang tới Fuji. Giới hạn: L1 hiện do nhóm chạy, một validator, chưa có trình duyệt khối công khai.

Số liệu và nguồn:

- 6 báo cáo: số sự kiện IncomeReported của IncomeMirror 0x9D1479479FCB0EFeFF7E8398558b326886be263d từ khối 61.445.000 tới khối 61.448.230 (2026-11-22 00:13 UTC)
- Chỉ ví được phép: README, Two chains joined by Avalanche ICM (allow-list của L1 510103)

## 10. Một chiếc xe từ đầu đến cuối (ví dụ)

Chữ trên slide:

> VÍ DỤ, KHÔNG PHẢI DỰ BÁO
> Một chiếc xe từ đầu đến cuối
> Vốn bỏ ra 700 triệu
> Năm 1
> Năm 2
> Năm 3
> Năm 4
> 810,25 triệu
> Năm 5
> Tiền thuê
> Tiền bán xe
> Cộng dồn, triệu đồng
> 810,25triệu
> về lại trên 700 triệu bỏ ra
> 1,16×
> sau 5 năm
> 3,8%
> mỗi năm (IRR)
> FleetShares
> Giả định: xe 700 triệu · thuê 13,5%/năm · phí 10% · 5 năm · bán lại 55% giá · từ trang How it works

Ghi chú người nói:

Một ví dụ, không phải dự báo, đúng như trang How it works của app. Giả định: xe 700 triệu, tiền thuê 13,5% giá xe mỗi năm, phí 10%, cho thuê 5 năm, bán lại 55% giá. Người giữ cổ phần nhận 425,25 triệu tiền thuê cộng 385 triệu tiền bán xe, tổng 810,25 triệu trên 700 triệu bỏ ra: 1,16 lần, khoảng 3,8% mỗi năm. Giá bán lại ảnh hưởng nhiều nhất: tiền thuê 15% và bán lại 60% cho 6,5% mỗi năm.

Số liệu và nguồn:

- Giả định: const EX trong web/views/how.js: price 700 (triệu đồng), gross 0.135, fee 0.10, years 5, resale 0.55
- 810,25 triệu · 1,16× · 3,8%: tính lại bằng đúng công thức flows/irr của web/views/how.js; khớp trang How it works (1.16× · 3.8%)
- 6,5%: bảng Return per year (IRR) trên trang How it works: gross 15%, resale 60%

## 11. Bằng chứng

Chữ trên slide:

> BẰNG CHỨNG
> Đã chạy thật trên mạng thử
> 50
> bài kiểm thử, đều qua
> 6
> hợp đồng trên 2 mạng
> 46
> giao dịch trên mạng thử
> 6
> báo cáo thu nhập qua 2 mạng
> 270triệu
> bán xe Vios, chia theo cổ phần
> Mở app
> FleetShares
> Đọc từ chuỗi lúc khối 61.448.230 (2026-11-22 00:13 UTC) · kongou2002.github.io/rwa-fleet/

Ghi chú người nói:

Số liệu đọc lúc khối 61.448.230 (2026-11-22 00:13 UTC). 50 bài kiểm thử Foundry trên các đường đi của tiền, chạy lại hôm nay, đều qua. 6 hợp đồng: FleetShares, MockUSDC, IncomeMirror, CarExit, AuditRegistry trên Fuji và RentalLog trên L1 của nhóm. 46 giao dịch đã chạm vào các hợp đồng của app trên Fuji. 6 báo cáo kỳ đã đi từ L1 sang Fuji. Chiếc Toyota Vios đã ghi bán 270 triệu qua CarExit, 70 cổ phần đã hoàn vốn. AuditRegistry có 2 báo cáo kiểm toán, do ví kiểm toán của nhóm công bố. Quét mã để mở app.

Số liệu và nguồn:

- 50: forge test trên nhánh ui-redesign, 22/11/2026: 50 passed, 0 failed (đếm function test trong test/*.sol)
- 6: docs/fuji.json: 5 hợp đồng trên Fuji + RentalLog trên L1 510103
- 46: số mã giao dịch khác nhau trong log của FleetShares, IncomeMirror, CarExit, AuditRegistry từ khối 61.445.000 tới khối 61.448.230 (2026-11-22 00:13 UTC)
- 6: sự kiện IncomeReported, khối 61.448.230 (2026-11-22 00:13 UTC)
- 270 triệu: CarExit.exitOf(3), khối 61.448.230 (2026-11-22 00:13 UTC): 10.800 đơn vị × 25.000 đ
- QR: https://kongou2002.github.io/rwa-fleet/

Liên kết trên slide:

- Mở app: https://kongou2002.github.io/rwa-fleet/

## 12. So sánh

Chữ trên slide:

> SO SÁNH
> So với mua cả xe hay góp qua công ty
> FleetShares
> Mua cả xe
> Góp qua công ty
> Vốn nhỏ vẫn tham gia
> Không phải tự lo xe
> Thấy từng khoản tiền thuê
> Phí cố định trong hợp đồng
> Bán lại một phần
> FleetShares
> Dấu gạch: không áp dụng hoặc tuỳ công ty

Ghi chú người nói:

So với hai cách người ta đang làm. Mua cả xe: phải có đủ tiền một chiếc, tự lo xe hoặc tự tìm công ty thuê lại, bán thì bán cả chiếc; bù lại thấy hết tiền thuê của mình và không có phí quản lý. Góp qua công ty: vốn nhỏ vẫn góp được, không phải lo xe, nhưng tiền thuê, phí và báo cáo là chuyện của công ty, và rút ra thì tuỳ công ty. FleetShares: vốn nhỏ, không lo xe, từng khoản tiền thuê nằm trên chuỗi, phí 10% cố định trong mã, và bán lại được từng cổ phần.

Số liệu và nguồn:

- Phí 10% cố định: FEE_BPS constant, src/FleetShares.sol
- Bán lại một phần: makeOffer / takeOffer, src/FleetShares.sol

## 13. Luật Việt Nam và giới hạn

Chữ trên slide:

> LUẬT VIỆT NAM VÀ GIỚI HẠN
> Bản mẫu trên mạng thử, chưa chào bán
> LUẬT VIỆT NAM
> Tiền đi bằng VND
> Tiền mã hoá không để thanh toán
> Có thể là chứng khoán
> HÔM NAY CHƯA CÓ
> Chưa có xe thật
> Chưa nối cổng thanh toán
> Nhóm giữ mạng riêng, ví kiểm toán
> Chưa kiểm toán, chưa tư vấn luật
> FleetShares
> NHNN về tiền mã hoá · NQ 05/2025/NQ-CP · Luật Chứng khoán 2019 · Không phải lời chào bán hay lời khuyên đầu tư

Ghi chú người nói:

Về luật Việt Nam. Một: tiền mã hoá không phải phương tiện thanh toán hợp pháp ở Việt Nam (Ngân hàng Nhà nước); thí điểm tài sản mã hoá theo Nghị quyết 05/2025/NQ-CP yêu cầu chào bán và thanh toán bằng VND qua tổ chức được cấp phép. Hai: bán cổ phần thu nhập của xe ra công chúng nhiều khả năng là chào bán chứng khoán theo Luật Chứng khoán 2019. Đây là bản mẫu, không phải lời chào bán hay lời khuyên đầu tư. Vì vậy tiền đi bằng tiền đồng qua ngân hàng, và muốn ra thật phải có cấu trúc được cấp phép. Hôm nay chưa có: xe và công ty cho thuê thật; cổng thanh toán chưa nối, tiền đồng đang mô phỏng bằng token thử; mạng riêng và ví kiểm toán đều do nhóm giữ; chưa có tư vấn pháp lý; hợp đồng chưa được kiểm toán. Nếu công ty ngừng trả tiền thuê, hợp đồng không ép được, chưa có ký quỹ.

Số liệu và nguồn:

- Tiền mã hoá không phải phương tiện thanh toán: Ngân hàng Nhà nước: https://vnba.org.vn/vi/bitcoin-khong-phai-tien-phap-quy--khong-phai-la-phuong-tien-thanh-toan-hop-phap-tren-dat-nuoc-viet-nam-6822.htm
- Thanh toán VND qua tổ chức được cấp phép: NQ 05/2025/NQ-CP: https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm
- Có thể là chứng khoán: Luật Chứng khoán số 54/2019/QH14; README, Limits
- Giới hạn: README, Limits và Add-ons; docs/fuji.json (auditor = ví của nhóm)

## 14. Lộ trình

Chữ trên slide:

> LỘ TRÌNH
> Từ mạng thử tới một chiếc xe thật
> BÂY GIỜ
> Mạng thử
> 3 xe mẫu · tiền mô phỏng
> TIẾP THEO
> 1 xe thật, 1 công ty
> Nối VietQR · pháp lý · kiểm toán
> SAU ĐÓ
> Công ty tự chạy mạng riêng
> Ký quỹ của công ty cho thuê
> FleetShares
> Chưa có công ty cho thuê hay đơn vị kiểm toán nào ký với nhóm

Ghi chú người nói:

Lộ trình ba bước. Bây giờ: testnet, ba xe mẫu, tiền đồng mô phỏng bằng token thử, đủ vòng đời từ gọi vốn tới bán xe. Tiếp theo: nối cổng thanh toán VietQR, một chiếc xe thật với một công ty cho thuê có giấy phép ở Việt Nam, báo cáo thu nhập hằng tháng; song song là tư vấn pháp lý cho cấu trúc và kiểm toán hợp đồng. Sau đó: giao validator và danh sách cho phép của mạng riêng cho công ty cho thuê, thêm trình duyệt khối công khai, và thêm khoản ký quỹ của công ty, bị trừ khi tiền thuê đã báo mà quá hạn chưa trả. Chúng tôi đang tìm một công ty cho thuê xe cho chiếc xe đầu tiên và tư vấn pháp lý.

Số liệu và nguồn:

- 3 xe mẫu: FleetShares.carCount(), khối 61.448.230 (2026-11-22 00:13 UTC)
- Các bước tiếp theo: docs/SLIDES.md cũ, mục Next; README, Limits

## 15. Cảm ơn

Chữ trên slide:

> FleetShares
> Cảm ơn
> Team Oicha
> XÂY TRÊN AVALANCHE · CHẠY TRÊN TESTNET FUJI

Ghi chú người nói:

Cảm ơn ban giám khảo.

## Dựng lại

```sh
cd web && python3 -m http.server 8171 &
python3 docs/deck/tools/read_chain.py . docs/deck/live.json      # số liệu sống (cần Foundry cast)
PW=<playwright>/index.mjs node docs/deck/tools/shots.mjs docs/deck/shots   # ảnh chụp app, chỉ đọc
uv run --with pillow python docs/deck/tools/build.py docs/deck .          # deck.html, notes.json, sources.json
PW=... node docs/deck/tools/render.mjs $PWD/docs/deck/deck.html docs/deck/png && PW=... node docs/deck/tools/texts.mjs $PWD/docs/deck/deck.html docs/deck/texts.json docs/FleetShares-pitch.pdf
uv run --with python-pptx --with pillow python docs/deck/tools/make_pptx.py docs/deck docs/FleetShares-pitch.pptx
```

