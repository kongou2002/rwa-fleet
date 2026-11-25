# FleetShares demo video

[`web/demo.mp4`](../web/demo.mp4) · 2:56 (a 29-second animated intro, the live take, a 7-second closing card) · 1440×900 · Vietnamese voice-over (synthetic voice) and a soft music bed, one Vietnamese caption per step (the beat list below gives them in English). Recorded on 22 Nov 2026 against the live deployment in [`web/fuji.json`](../web/fuji.json) on Avalanche Fuji.

Money is shown in VND. In the product, money moves in VND by bank transfer and the chain keeps the rules and the receipts. On this testnet demo a test token stands in for the transfer, at a fixed demo rate of 1 token unit = 25,000 VND. Every screen is the app in a browser and every transaction below is a real Fuji transaction. Waits for confirmations are played at 8×, page loads after each wallet switch are cut, and the two opening captions are held 2 s on a still frame.

Roles: **Investor** `0x135c…9171`, **Operator** `0x6970…a392`, **Manager** `0xE436…07AA`, **Auditor** `0x8F3b…4921` (the team's own test wallet on this demo), **Bob** `0x0812…a419` (holder). Wallets are switched on screen with Disconnect / Connect. There is no wallet popup: the recorder signs outside the page, so the app's "Confirm in your wallet" step passes on its own.

## Beats and captions

| Time | Screen | Caption |
|---|---|---|
| 0:00 | Vault | Money moves in VND by bank transfer. The chain keeps the rules and the receipts. |
| 0:04 | Vault figures | On this testnet demo, the bank transfer is simulated with a test token. |
| 0:09 | Rent chart, split card | Rent paid to holders so far, and the fixed split: 90 to holders, 10 to the manager. |
| 0:12 | Car cards | Three cars: one still selling shares, one earning rent, one already sold. |
| 0:18 | Connect | Connect an investor's wallet. |
| 0:23 | VinFast VF 8 Eco | Open the VinFast VF 8 Eco and pick 2 shares at 6.25M VND each. |
| 0:28 | Buy | Buy: allow the payment of 12.5M VND, then purchase. It waits in escrow until the car sells out. |
| 0:33 | Progress, Your position | Shares sold move from 98 to 100 of 160, and the position shows the new shares. |
| 0:40 | Market | Market: buy 1 Mazda CX-5 share from a holder's offer at 6.875M VND. The seller is paid at once. |
| 0:47 | Portfolio | Portfolio: holdings, ownership, allocation and this wallet's own transactions. |
| 0:55 | Switch to operator, CX-5 page | Switch to the operator, the rental company that runs the cars. |
| 1:00 | Income reports | Two new rentals were logged on the team's own L1. The totals arrived here over Avalanche ICM. |
| 1:04 | Reported vs paid | Income reported: 31.5M VND. Rent paid in: 23.625M VND. So 7.875M VND shows as due. |
| 1:08 | Pay rent | The operator pays the 7,875,000 VND. The contract splits it on arrival: 90% to holders, 10% fee. |
| 1:15 | Income reports | Reported income and rent paid match again, and the car shows Paid in full. |
| 1:18 | Switch to manager, Transparency | Switch to the manager. Transparency compares reported income with rent paid for each car. |
| 1:27 | Fees | The manager withdraws its 787,500 VND fee. The contract can only send it to the manager. |
| 1:32 | Activity, Contracts | Every event links to its transaction. The contracts sit on Fuji and on the team's L1. |
| 1:41 | Switch to auditor, Audit | Switch to the auditor wallet. In this demo it is the team's own test wallet. |
| 1:47 | Publish a report | It publishes the hash of a short check written from chain reads: reported vs paid for the CX-5. |
| 2:01 | Audit reports | The new report hash is on chain and listed. It cannot be edited or deleted. |
| 2:04 | Switch to Bob, Portfolio | Switch to Bob, a holder. The Toyota Vios is already sold. He collects his rent first. |
| 2:14 | Redeem | Then he hands in his 50 Vios shares for his part of the sale: 112.5M VND, no fee. |
| 2:22 | How it works | How it works: fund a car, rent it out for 4 to 5 years, sell it, and grow the fleet. |

## Transactions

Before the take, on the team L1 (chain 510103, no explorer), the operator logged two CX-5 rentals and sent the period report over ICM (2 rentals, 14 days, 315 units = 7.875M VND):

| Action | L1 transaction |
|---|---|
| logRental (car 1, 7 days, 3.9375M VND) | `0x2563f1b728c330c3418e4e7d72f2b3fee11707f5e867a51a64ef9af412388d63` |
| logRental (car 1, 7 days, 3.9375M VND) | `0xd00912f4ac599a7857ca0b8cb2590a2ffced6a959f3bfd0c877168fc71d4c3f1` |
| report (car 1), sent by ICM | `0xee016abf42fa7a37582379353316f3fd3b77e862cfb938bce40673f05fbeee9b` |

During the take, on Fuji:

| Time | Role | Action | Transaction |
|---|---|---|---|
| 0:31 | Investor | Allow the payment of 12.5M VND | [0x473a…c0b3](https://testnet.snowtrace.io/tx/0x473adf3387e28bb2b113d538dd1a22c8b475baa6626ffc37f6270b7ea71ac0b3) |
| 0:31 | Investor | Buy 2 VF 8 Eco shares | [0x488b…701c](https://testnet.snowtrace.io/tx/0x488b6111d4ebbbfb101e6853e3fdd139940e39e966e7630c8b3c6682c7f4701c) |
| 0:44 | Investor | Allow the payment of 6.875M VND | [0xce03…169a](https://testnet.snowtrace.io/tx/0xce031c9ca6e7800ea0cd681695cd52861f28a80d0bf834d318ea9f7fb24a169a) |
| 0:44 | Investor | Take 1 CX-5 share from offer #1 | [0x8d8c…b43a](https://testnet.snowtrace.io/tx/0x8d8cc3fe65bb87c61f8304fa30593da27b7b015ce29a26784189add1a22eb43a) |
| 1:12 | Operator | Pay 7,875,000 VND rent on the CX-5 | [0x56e5…4869](https://testnet.snowtrace.io/tx/0x56e5a7cd8ede58f6e1b62807c18a3ee0aee61296492d2c1889e2066e5daa4869) |
| 1:28 | Manager | Withdraw the 787,500 VND fee | [0xe2f1…83af4](https://testnet.snowtrace.io/tx/0xe2f1b31c431264409e18304757494559b8e75baafc3b6f112e506e1c52c83af4) |
| 1:56 | Auditor | Publish report #2 (hash `0x6d85…8f17`) | [0x8013…7c21](https://testnet.snowtrace.io/tx/0x8013a16026b57792883ae793963b868fc7fb11b94fb7b300111f848317a67c21) |
| 2:12 | Bob | Collect CX-5 rent | [0x289f…099b](https://testnet.snowtrace.io/tx/0x289fa44f2c1354831b64a8d36ac4240f3b3d1f5ae1f7dd064ce5b177d5ff099b) |
| 2:12 | Bob | Collect Vios rent | [0x7fc2…b098](https://testnet.snowtrace.io/tx/0x7fc2ee453f4b28f3e0dab7f503ffd16156b295a07c6371f96c99931cf131b098) |
| 2:17 | Bob | Allow CarExit to take his shares | [0x4e49…0907](https://testnet.snowtrace.io/tx/0x4e49a7de6554fa0ce7be139846c93b09474934f6d074902fa90331c8c8760907) |
| 2:17 | Bob | Redeem 50 Vios shares for 112.5M VND | [0xe40c…bfac](https://testnet.snowtrace.io/tx/0xe40cf8487ac7850f5b947f8af3663bcc9c1c03df56eefb611e4289529226bfac) |

The published report is [`docs/audit/2026-11-22-car1-reported-vs-paid.md`](audit/2026-11-22-car1-reported-vs-paid.md), generated from chain reads seconds before publishing. Its keccak256 is the hash on chain: `cast keccak 0x$(xxd -p -c0 docs/audit/2026-11-22-car1-reported-vs-paid.md)`. It says it is a demo check by the team's own wallet and not an independent audit. Report #1 ([`2026-11-21-car1-reported-vs-paid.md`](audit/2026-11-21-car1-reported-vs-paid.md)) comes from an earlier take that showed amounts in USDC.

## Not shown live, and why

- **Recording the Vios resale.** It was recorded in the earlier take ([0xdcf9…999a](https://testnet.snowtrace.io/tx/0xdcf9676e1e09b75a008a624e170e7905a1b2b2fbe5b8bc772c09266e8923999a)) and can be recorded only once, so the video shows the Vios as Sold and a holder redeeming.
- **Logging rentals and sending the ICM report.** These are on the team L1, which has no explorer, and were sent with `cast` before the take. The video shows their arrival on Fuji (period 4 in Income reports).
- **Listing a car, the funding sell-out, refunds, and the demo-VND faucet.** Listings and sell-outs were seeded, no car is past its deadline, and the investor already held demo VND.
- **Posting an offer.** The investor's 1-share CX-5 offer from the earlier take is still open, so the video shows it in the book.

## Pre-record checklist

- [ ] `web/fuji.json` points at the deployment you mean to record, and the role keys match its `manager`, `operator` and `auditor`.
- [ ] Read live state: the funding car has shares left and a deadline in the future; the cheapest offer has a fillable share from another wallet; the car you will show has an unpaid amount in `IncomeMirror.ledger` (log rentals and `report` on the L1 first, then wait for the relayer); feesOwed > 0 after the rent; the holder you redeem with holds shares of a car whose sale is recorded.
- [ ] Balances: every role has gas; the investor and the operator hold enough demo VND.
- [ ] Rehearse on `anvil --fork-url https://avalanche-fuji-c-chain-rpc.publicnode.com`. A real take uses up state, so a second take needs a re-plan, not a replay.
- [ ] Serve `web/` locally and route `api.avax-test.network` to publicnode (it rate-limits).
- [ ] After cutting: total under 3:00, no "USDC" on screen, one frame per caption checked (caption matches the screen, no skeletons, no error toasts).


## Take 2 (UI v2, 22 Nov 2026)

Re-recorded on the new UI, same roles. Before the take the operator logged two CX-5 rentals on the team L1 and sent the period report over ICM (L1 txs `0xb0daae10…`, `0x53d36de5…`, report `0xb974099f…`); the investor wallet used the demo-VND faucet. The holder in this take is Carol, who redeems her Toyota Vios shares. Audit document: `docs/audit/2026-11-22-car1-reported-vs-paid-v2.md`.

| Step | Transaction |
|---|---|
| viewer · buy VF 8 shares | [`0x07cd347b…`](https://testnet.snowtrace.io/tx/0x07cd347bf20226eff0e8dbe5eea02de25f7fec6a80db2e34f99dd2f8ea77787f) |
| viewer · buy VF 8 shares | [`0x391c8c54…`](https://testnet.snowtrace.io/tx/0x391c8c54a329253a3d13c3b219682c2fbb1336ff134669ddcafb101f4551753f) |
| viewer · take offer | [`0x28aa8efd…`](https://testnet.snowtrace.io/tx/0x28aa8efdab2be068d658a24ac0420b525d8645597cc5480051727688a62c5c45) |
| viewer · take offer | [`0x84aa8826…`](https://testnet.snowtrace.io/tx/0x84aa88269b772b41c03669227c301327b9c7385f17f10f43867bbb43c2d93ab8) |
| operator · pay rent | [`0x23fb52d2…`](https://testnet.snowtrace.io/tx/0x23fb52d2027fb7cfda2f0dbbcee72de570c323ce4425faffca13d7a1943e4f00) |
| manager · withdraw fees | [`0x1be29784…`](https://testnet.snowtrace.io/tx/0x1be29784e30af35917d9e4c7f9364d61db27b68e08cdcd3af8d976d1ed78d8fa) |
| auditor · publish audit | [`0xec9b3eec…`](https://testnet.snowtrace.io/tx/0xec9b3eec5b289faf0b263589fae7c6ed8fdaaafb3ce4f6a0e4aba53074ca00dd) |
| holder · collect rent | [`0x0d504cd4…`](https://testnet.snowtrace.io/tx/0x0d504cd43954bd6516d552013850fba6daa4f1acd2de1733d3f0aaa762b1e4df) |
| holder · collect rent | [`0x793d870f…`](https://testnet.snowtrace.io/tx/0x793d870f6b7738c8b5f7221bc7d5aef2e38e6bb40c49b5aa0097470e8889a79c) |
| holder · redeem | [`0xfc51bbe1…`](https://testnet.snowtrace.io/tx/0xfc51bbe1683ade99f916e7b9fd0584b6633e88f72a803e7e8f0b554674da9f2f) |
| holder · redeem | [`0x930de547…`](https://testnet.snowtrace.io/tx/0x930de547aa190ace18b42136f445cd302f6f950c1b69b7099c2212480ca9cae5) |

## More sample cars (25 Nov 2026)

Ten more cars were listed on Fuji to make the marketplace look like a real one: 13 cars in 7 cities in total. They are real listings on the same FleetShares contract, so every card opens and every buy button works. The test investors Alice, Bob and Carol bought shares in them. Three cars sold out, and the operator paid them rent.

| Car id | Car | State | Listing tx |
|---|---|---|---|
| 4 | Hyundai Accent 1.4 AT | sold out, rent paid | [listCar](https://testnet.snowtrace.io/tx/0xc3fc84f4dd5c014643ad6addef076010cf58d1499d47ce25a781824340273856) |
| 5 | Kia Seltos 1.5 Premium | selling shares | [listCar](https://testnet.snowtrace.io/tx/0xd685d2ea6000ff7432c16c5652c43305d4859ca917b9142269cebc65880fa0a5) |
| 6 | Mitsubishi Xpander 1.5 AT | sold out, rent paid | [listCar](https://testnet.snowtrace.io/tx/0x032c94f24b0fe894e5ee2e6dc26b5f25fdfdfa7d007b84ec88caef13be91c987) |
| 7 | Honda City RS | selling shares | [listCar](https://testnet.snowtrace.io/tx/0xf0e967aa72f594bfabbcca5ecbdc3d3ad8128b13c47eece21a061d518aba6967) |
| 8 | VinFast VF 5 Plus (Hanoi) | selling shares | [listCar](https://testnet.snowtrace.io/tx/0x49122da8a9472d29b86aebdd96a0df5807ac81edd90808108a0c7d55d4f8caa5) |
| 9 | Ford Ranger XLS 2.0 | selling shares | [listCar](https://testnet.snowtrace.io/tx/0x43eec104d00364463d18b4e755f6f5a7bebe88bb1c12655a8b5bfb963bf9394c) |
| 10 | Hyundai Creta 1.5 Premium | selling shares | [listCar](https://testnet.snowtrace.io/tx/0xa2d74c3d30c365d530b7041c53fc8baf15cb0accc7b6bce5b298a11aa08e5424) |
| 11 | Toyota Corolla Cross 1.8 HEV | sold out, rent paid | [listCar](https://testnet.snowtrace.io/tx/0x759937d9581223b5acf59e565e13e0281ec12f44b233a0f3cca619d7e9e05e7d) |
| 12 | Kia Carnival 2.2D Luxury | selling shares | [listCar](https://testnet.snowtrace.io/tx/0xd57e62aab35f4d4ed9d02d99fdeb1cea1f488f2a5b64e1c8975c028802b15bd5) |
| 13 | VinFast VF 5 Plus (HCMC) | selling shares | [listCar](https://testnet.snowtrace.io/tx/0x4a17cbe127719becb1735f75a3cbaa465a6f1e932a3b2e675fd14140d1080b08) |

Rent payments: [accent #1](https://testnet.snowtrace.io/tx/0xc9c60d4f87bb3c826ea719fec76fdf6dd1468135eac84e156811e3bd247bd11c), [accent #2](https://testnet.snowtrace.io/tx/0x05909bf069dd7ad08765c05eb6acb2916ea9bbd595037367517f1b10959ad8e3), [xpander #1](https://testnet.snowtrace.io/tx/0x1ecd37a3a46de2e8d5f243876f4b438502d625bf28d62299e4bd9e02edf96551), [xpander #2](https://testnet.snowtrace.io/tx/0x8269851f3fdb7130727e4901108d5dcab60556f6bc561d3a3dcd78ff00bef0e0), [ccross #1](https://testnet.snowtrace.io/tx/0xa159335dbf9781d6ebc40a540b6fecb42369d84c7662004cd1007f2f478ee404).
City and type for each car are off-chain, in `CAR_META` in `web/core.js`.
