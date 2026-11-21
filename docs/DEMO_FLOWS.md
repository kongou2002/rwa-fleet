# FleetShares demo video

[`web/demo.mp4`](../web/demo.mp4) · 2:57 · 1440×900 · silent, one caption per step. Recorded on 22 Nov 2026 (21 Nov UTC) against the live deployment in [`web/fuji.json`](../web/fuji.json) on Avalanche Fuji. Every screen is the app in a browser and every transaction below is a real Fuji transaction. Waits for confirmations are played at 8× and the page loads after each wallet switch are cut.

Roles: **Investor** `0x135c…9171` (fresh wallet with 2,000 test USDC), **Operator** `0x6970…a392`, **Manager** `0xE436…07AA`, **Auditor** `0x8F3b…4921` (the team's own test wallet on this demo), **Alice** `0xD367…4319` (seeded holder). Wallets are switched on screen with Disconnect / Connect. There is no wallet popup: the recorder signs outside the page, so the app's "Confirm in your wallet" step passes on its own.

## Beats and captions

| Time | Screen | Caption |
|---|---|---|
| 0:00 | Vault | FleetShares on Avalanche Fuji: rental cars in Vietnam, owned in shares, read live from the chain. |
| 0:03 | Vault figures, rent chart, split card | Rent paid to holders so far, and the fixed split: 90 to holders, 10 to the manager. |
| 0:06 | Car cards | Three cars: two funded and earning rent, one still selling shares. |
| 0:12 | Connect | Connect an investor wallet that holds 2,000 test USDC and no shares. |
| 0:18 | VinFast VF 8 Eco | Open the VinFast VF 8 Eco and pick 2 shares at 250 USDC. |
| 0:23 | Buy | Buy: approve 500 USDC, then purchase. The USDC waits in escrow until the car sells out. |
| 0:29 | Progress, Your position | Shares sold move from 96 to 98 of 160, and the position shows 2 shares in escrow. |
| 0:36 | Market | Market: buy 2 Mazda CX-5 shares from a holder's offer at 275 USDC. The seller is paid at once. |
| 0:43 | Sell shares | Post an offer of your own: 1 share at 285 USDC. It keeps earning rent until someone buys it. |
| 0:54 | Portfolio | Portfolio: holdings, ownership, allocation and this wallet's own transactions. |
| 1:04 | Switch to operator, CX-5 page | Switch to the operator, the rental company that runs the cars. |
| 1:10 | Income reports | Rentals are logged on the team's own L1. Period totals arrive here over Avalanche ICM. |
| 1:14 | Reported vs paid | It reported 945 USDC of income but paid in only 630, so 315 USDC shows as due. |
| 1:19 | Pay rent | The operator pays the 315 USDC. The contract splits it on arrival: 90% to holders, 10% fee. |
| 1:27 | Income reports | Reported income and rent paid now match, and the car shows Paid in full. |
| 1:30 | Toyota Vios 1.5 G, Record the sale | Skip ahead to the end of the Toyota Vios 1.5 G's term: the operator records its sale for 10,800 USDC. |
| 1:42 | Switch to manager, Transparency | Switch to the manager. Transparency compares reported income with rent paid for each car. |
| 1:51 | Fees | The manager withdraws its 135 USDC of fees. The contract can only send them to the manager address. |
| 1:57 | Activity, Contracts | Every event links to its transaction. The contracts sit on Fuji and on the team's L1. |
| 2:07 | Switch to auditor, Audit | Switch to the auditor wallet. In this demo it is the team's own test wallet. |
| 2:13 | Publish a report | It publishes the hash of a short check written from chain reads: reported vs paid for the CX-5. |
| 2:24 | Audit reports | The report hash is on chain and listed. It cannot be edited or deleted. |
| 2:29 | Switch to Alice, Portfolio | Switch to Alice, a holder since the start. She collects her rent from both earning cars. |
| 2:40 | Redeem | Then she hands in her 20 Toyota Vios shares for her part of the sale: 1,800 USDC, no fee. |
| 2:48 | How it works | How it works: fund a car, rent it out for 4 to 5 years, sell it, and grow the fleet. |

## Transactions made during the take

| Time | Role | Action | Transaction |
|---|---|---|---|
| 0:27 | Investor | Approve 500 USDC | [0xd6a3…6554](https://testnet.snowtrace.io/tx/0xd6a3b009291c17775fdfec886af4f5246eda2b738c63c4f58919d59775556554) |
| 0:27 | Investor | Buy 2 VF 8 Eco shares | [0x17b8…1f22](https://testnet.snowtrace.io/tx/0x17b89756aed562f7118b272e3da0d9586a7c88e8008ec3f78d31b7fcde771f22) |
| 0:41 | Investor | Approve 550 USDC | [0xb97c…1000](https://testnet.snowtrace.io/tx/0xb97ce1bf6324ad44baf3dc72ae912cbbeffe54b00f7e6ca9017e9d12023e1000) |
| 0:42 | Investor | Take 2 CX-5 shares from offer #1 at 275 | [0x8188…d82c](https://testnet.snowtrace.io/tx/0x81882f2b51e1959bb52ed19dc26e0d6d3d7acf1881b0f7dc63104455d72ed82c) |
| 0:49 | Investor | Offer 1 CX-5 share at 285 | [0x2b1b…139b](https://testnet.snowtrace.io/tx/0x2b1b31f6cf674cbb39192983e7a789e67ec7baaf8886e9c0e04dddc1acb8139b) |
| 1:24 | Operator | Pay 315 USDC rent on the CX-5 (283.50 to holders, 31.50 fee) | [0xc22c…1225](https://testnet.snowtrace.io/tx/0xc22cb50338fba686fde525c8c7af6424b93ef83c0d6cc6eb6d6e960799141225) |
| 1:37 | Operator | Approve 10,800 USDC to CarExit | [0x6748…9714](https://testnet.snowtrace.io/tx/0x6748249c5ed5a97bf3c78eb4a42b208bbbbf727d6d7011477fc949e4bcb29714) |
| 1:37 | Operator | Record the Vios resale, 10,800 USDC | [0xdcf9…999a](https://testnet.snowtrace.io/tx/0xdcf9676e1e09b75a008a624e170e7905a1b2b2fbe5b8bc772c09266e8923999a) |
| 1:53 | Manager | Withdraw 135 USDC of fees | [0x2a15…4982](https://testnet.snowtrace.io/tx/0x2a159bf5e22f103b0253dd37a8075f0bcda6750fb558ab178252fbc993cb4982) |
| 2:23 | Auditor | Publish report #1 (hash `0xa0fa…0e17`) | [0x4c0a…d4f5](https://testnet.snowtrace.io/tx/0x4c0ae04dd1e82baa26eeb77c34e6f5ce1f64b8f130698bbb50cbf28effebd4f5) |
| 2:38 | Alice | Collect CX-5 rent | [0xc794…0448](https://testnet.snowtrace.io/tx/0xc794a6205c4afb462b83b8d92a516de06fed9e7be723469ff7f8ef70dfda0448) |
| 2:38 | Alice | Collect Vios rent | [0x2b6e…dfce](https://testnet.snowtrace.io/tx/0x2b6ee06d13316d999c79aec7025ae44cd0976bac7ddd29e8d98b13cf03a9dfce) |
| 2:43 | Alice | Allow CarExit to take her shares | [0x6e5a…4d20](https://testnet.snowtrace.io/tx/0x6e5a92b912abcaf3daff2a65afd0e27730ec4d6556dd66a8d26e56bf6a914d20) |
| 2:44 | Alice | Redeem 20 Vios shares for 1,800 USDC | [0xb1ea…08fb](https://testnet.snowtrace.io/tx/0xb1eada4298b9211019d06bf409d6e710c281eb9455dbc21cecdf6dc2785e08fb) |

The published report is [`docs/audit/2026-11-21-car1-reported-vs-paid.md`](audit/2026-11-21-car1-reported-vs-paid.md): a reported-vs-paid read of car 1, generated from chain reads seconds before publishing. Its keccak256 is the hash stored on chain (`cast keccak 0x$(xxd -p -c0 docs/audit/2026-11-21-car1-reported-vs-paid.md)`). It says it is a demo check by the team's own wallet and not an independent audit. The period shows the UTC date (21 Nov) while the app shows the publish date in local time (22 Nov).

## Not shown live, and why

- **Listing a car and the funding sell-out.** These happened during seeding (see `tx` in `fuji.json`). A new listing would add a fourth car that nobody funds.
- **Rental logging on the L1 and the ICM report.** These are on the team's L1 (chain 510103, no explorer) and were sent before the take. The video shows their result on Fuji (the deliveries in Income reports and the 945 reported).
- **Faucet.** The investor started with 2,000 test USDC, so the faucet button is not used in the video.
- **Refunds for a car that misses its deadline.** No car is past its deadline.
- **The resale is not at the end of a real term.** The Vios was recorded as sold minutes after its rent, and the caption says it skips ahead.

## Pre-record checklist

- [ ] `web/fuji.json` points at the deployment you mean to record, and the role keys match its `manager`, `operator` and `auditor`.
- [ ] Read live state: VF 8 has shares left and a deadline in the future; the cheapest CX-5 offer still has at least 2 fillable shares; the CX-5 ledger shows an unpaid amount if you want the "due → Paid in full" beat; no resale is recorded for the car you will sell; feesOwed > 0.
- [ ] Balances: every role has gas; investor ≥ 1,100 USDC; operator ≥ rent + resale USDC.
- [ ] Rehearse the whole path on `anvil --fork-url https://avalanche-fuji-c-chain-rpc.publicnode.com` before the real take. Each real take uses up state (offers, resale, unpaid rent), so a second take needs a re-plan, not a replay.
- [ ] Serve `web/` locally (`python3 -m http.server`). `api.avax-test.network` can rate-limit; route reads to publicnode.
- [ ] After cutting: total under 3:00, one frame per caption checked (caption matches the screen, no skeletons, no error toasts).
