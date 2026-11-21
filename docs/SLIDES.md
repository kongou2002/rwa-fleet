# FleetShares: slide outline

Twelve slides, text ready to paste into Canva. Under each slide: what is on it, and where every number comes from. The pptx is built by `docs/deck/build.js`, which reads addresses and proof links from `docs/fuji.json` and the README, and reads the live figures from the chain when it runs. Figures below are from the build of 22 Nov 2026, Fuji block 61446766 (23:29 UTC on 21 Nov). The video's transactions after that will move the live figures; rebuild to refresh.

Look: white ground, near-black text, brand red `#c8102e` for the top rule and key figures only, hairline rules, Arial. Screens are from the live app at 1440×900 (`docs/deck/*.jpg`).

## 1. Title

**Own a share of a rental car**

Buy shares of one car in USDC. The contract pays the rental company and splits every rent payment: 90% to holders, 10% fee.

kongou2002.github.io/rwa-fleet · github.com/kongou2002/rwa-fleet

Visual: photo of the Mazda CX-5 2.0 from the app (`car.jpg`).
Footer: Testnet prototype on Avalanche Fuji · Team Oicha · Car photos: Wikimedia Commons, CC BY-SA 4.0.

- 90 / 10: `FEE_BPS` in `src/FleetShares.sol`, shown in the app.

## 2. Problem

**A rental car earns 10–15% a year**

- **10–15%**: gross rent a year on the car's price. Industry estimate; we have not measured it.
- **USD 1.17 bn**: Vietnam car rental market, 2026 estimate (Mordor Intelligence).

Only people who can buy a whole car get that income. Pooling money through a company means trusting it with the cash, the fee and the income report.

- 10–15%: the range in the judges' brief for this project. The app's own terms use 12–15% (`TERMS.gross` in `web/core.js`).
- USD 1.17 bn: Mordor Intelligence, "Vietnam Car Rental Market" (mordorintelligence.com/industry-reports/vietnam-car-rental-market), read 22 Nov 2026. IMARC estimates lower: USD 376 m for 2025 (imarcgroup.com/vietnam-car-rental-market).

## 3. Solution

**A vault buys cars in shares**

Diagram, three boxes:

- Investors (anywhere, USDC): pay for shares when they buy; get 90% of rent and the resale.
- FleetShares vault (manager, smart contract): lists cars; takes a fixed 10% of rent and nothing else.
- Company A (rental company, Vietnam): buys and rents out the car, pays rent on chain, sells it after 4–5 years.

Arrows: buy shares → · ← 90% of rent + resale · car price → · ← rent, monthly.
Dashed box: Independent auditor publishes a hash of each signed report on chain (AuditRegistry).

Everything the three parties need to check sits on chain: the purchase money, the fee, each rent payment and the income report.

Footer: Company A is a placeholder name for the rental operator. No operator or auditor has signed with us.

## 4. How the money moves

Five steps: **Fund** (pay for shares up front, USDC waits in the contract) → **Sell-out** (last share sends the full price to Company A; deadline missed means full refund) → **Rent** (each payment split 90 / 10 as it arrives) → **Resale** (after 4–5 years, holders redeem pro rata, no fee: `CarExit`) → **Next car**.

Big figures: **90%** of rent to holders · **10%** fee, fixed in the code · **0%** fee on resale.

Footer: Step 5 is the plan: putting returned money into the next car is each investor's choice, not automatic in the contract.

- 4–5 years: `TERMS.life` in the app; README "Add-ons".
- 0% on resale: `CarExit.redeem` pays `proceeds × shares / totalShares` (README "Add-ons").

## 5. Product: cars and buying

**Real cars. Pay for your shares when you buy.**

Visual: the vault's three car cards (`cards.jpg`) and the buy panel of the car still funding (`buypanel.jpg`).

VinFast VF 8 Eco: 160 shares × 250 USDC, 96 sold so far. If it does not sell out by the deadline, every buyer gets the money back.

- Shares, price and shares sold: `FleetShares.getCar` on Fuji at build time.

## 6. Product: market and portfolio

**Sell your shares to another investor**

Visual: the Market's open offers (`market.jpg`) and the portfolio of test holder 0x0812…a419 (`portfolio.jpg`). For this one shot the offer book is widened to the full row: at 1440 the app's offer table is wider than its column and clips the buy buttons.

- A holder posts shares at a price. They keep earning rent until sold.
- The buyer pays in one transaction: USDC to the seller, shares to the buyer.
- Rent earned before the sale stays with the seller.

## 7. Transparency

**What Company A reported, next to what it paid**

Diagram: Team1 L1, chain 510103 (`RentalLog`, each rental logged) → Avalanche ICM (Teleporter message, signed by the L1's validators) → Fuji C-Chain (`IncomeMirror`, accepts only that L1 and that contract).

| Funded car | Reported (L1) | Paid (Fuji) | Still due |
|---|---|---|---|
| Mazda CX-5 2.0 | 945 | 630 | **315 USDC** |
| Toyota Vios 1.5 G | 405 | 405 | Paid in full |

Audit: the auditor's report hashes go to AuditRegistry and cannot be edited or deleted. None published yet.

- Table: `IncomeMirror.ledger(carId)` for each funded car, Fuji block 61446766.
- Audit count: `AuditRegistry.reportCount()` at build time.
- Footer limit: the chain cannot see rentals the operator never logs.

## 8. One car, start to finish (example)

Visual: the worked example from the app's How it works page (`example.jpg`).

- Assumptions, not a forecast: 28,000 USDC car, 13.5% gross rent, 10% fee, 5 years, resale at 55%.
- Holders get 17,010 rent + 15,400 resale = 32,410 back on 28,000: 1.16×, IRR 3.8% a year. Resale value moves it most: 15% rent and 60% resale gives 6.5%.

- All figures: recomputed by `build.js` from `EX` in `web/views/how.js`, same formula as the app.

## 9. Why on chain, why Avalanche, where the money comes from

**Why on chain:** investors, the manager and the rental company do not have to trust each other. The contract holds purchase money, fixes the 10% fee and pays rent by share. Anyone can check every payment.

**Why Avalanche:** rentals are logged on our own Avalanche L1 (chain 510103): one cheap transaction each, and only allow-listed addresses can write. Our ICM relayer carries the signed totals to the C-Chain, where the money is. A rent payment used 141,050 gas: about 0.0011 AVAX at today's C-Chain base fee.

**Where money comes from:** rent Company A earns from renting the car out, and the car's resale. The manager earns only its 10% of rent. No token, no printed yield. On testnet, rent is test USDC paid by our own operator key.

- 141,050 gas: receipt of the rent payment `tx.payRent` in `docs/fuji.json`. Base fee 7.5 nAVAX: `cast base-fee` on C-Chain mainnet, 22 Nov 2026.

## 10. Proof

**Live on Avalanche Fuji, with 50 tests**

Contracts: FleetShares 0xd82b…58F9, MockUSDC 0xb06F…C630, IncomeMirror 0x9D14…263d, CarExit 0xbc57…F96B, AuditRegistry 0xF2e4…E442 on Fuji (linked to Snowtrace); RentalLog 0xb06F…c630 on the Team1 L1 (plain hash: the L1 has no public explorer). Addresses from `docs/fuji.json`.

Transactions, from the README's "Proof" table: Mazda CX-5 2.0 listed as 100 × 280 USDC · last share sold, 28,000 USDC to the operator in the same transaction · 315 USDC rent split 31.50 fee / 283.50 holders · a 40-share holder collects 226.80 USDC · offer of 5 shares at 275 · period closed on the Team1 L1 (2 rentals, 15 days, 315 USDC; plain hash) · ICM message arrives on Fuji · a third month reported but not paid: reported 945, paid 630, unpaid 315.

6 contracts on 2 chains · 50 Foundry tests on the money paths.

- 50: `function test…` count in `test/*.sol` at build time (`forge test`: 50 pass).

## 11. What is real today, and what is not

**Real on testnet:** 6 contracts on Fuji and an Avalanche L1, used by real testnet transactions · money rules enforced by code: escrow, refund, 90 / 10 split, share offers · income reports sent from our own L1 over ICM, compared with rent paid · 50 Foundry tests.

**Not yet:** no real car or rental company yet; Company A is a placeholder · test USDC; rent is paid by our own operator key · an operator that stops paying is not forced to: no bond yet · contracts not audited; no car resold yet; no audit report published yet · our team runs the L1, not a rental company; it has no public explorer yet.

**Vietnam law:** crypto is not legal tender in Vietnam, and selling shares of a car's income to the public is likely a securities offering. This is a prototype, not an offer or investment advice. A launch needs a licensed structure, with the rental company paid in VND.

## 12. Next

**Next: one real car with one rental company**

- Pilot: one car with one licensed rental company in Vietnam, rent reported monthly.
- Operator bond: collateral that is cut when reported rent stays unpaid past a deadline.
- Legal structure: a vault company abroad, verified holders, VND on the operator's side.
- Operator's L1: hand the L1's validator and allow-list to the rental company, and add a public explorer.

Ask: we are looking for a rental company for a one-car pilot, and legal advice on the structure.

App kongou2002.github.io/rwa-fleet · Code github.com/kongou2002/rwa-fleet · Team Oicha

## Rebuild

```sh
cd web && python3 -m http.server 8151 &          # serve the app
PW=<playwright>/index.mjs node docs/deck/shots.mjs   # refresh the six screenshots (HOLDER=0x… to change the wallet shown)
NODE_PATH=<dir with pptxgenjs> node docs/deck/build.js   # rebuild docs/FleetShares-pitch.pptx
```
