# FleetShares: own a share of a rental car, get paid a share of its rent

Live app: https://kongou2002.github.io/rwa-fleet/ · Slides: https://canva.link/3kubb6g3zn898er ([pptx](docs/FleetShares-pitch.pptx)) · Video (2:56, Vietnamese voice-over and captions): https://kongou2002.github.io/rwa-fleet/demo.html ([flows and script](docs/DEMO_FLOWS.md))

A rental company in Vietnam earns roughly 10 to 15 % a year on a car, but only people who can buy a whole car get that income. FleetShares splits one car (say a Mazda CX-5) into shares. Investors buy shares with USDC; when the car is sold out the money goes to the rental operator, who buys it and rents it out. Rent comes back on chain per car: **10 % to the manager, 90 % to the shareholders**, and shares can be resold in a built-in offer book.

Live on Avalanche Fuji (testnet only):

| What | Where |
|---|---|
| FleetShares | [`0xd82b…58F9`](https://testnet.snowtrace.io/address/0xd82ba2Bad1cb88c836eA90410E4FDA798ad458F9) |
| MockUSDC (public faucet) | [`0xb06F…C630`](https://testnet.snowtrace.io/address/0xb06F76bAEf808a580926C48fD281E829836Ec630) |
| IncomeMirror (Fuji, receives ICM) | [`0x9D14…263d`](https://testnet.snowtrace.io/address/0x9D1479479FCB0EFeFF7E8398558b326886be263d) |
| RentalLog (Team1 L1, chain 510103; read-only RPC `https://fairpick-rpc.zillexa.com`, no public explorer) | `0xb06F76bAEf808a580926C48fD281E829836Ec630` |
| CarExit (resale payout to holders) | [`0xbc57…F96B`](https://testnet.snowtrace.io/address/0xbc57911967Ec9DfEC19d6912136DE3F232BAF96B) |
| AuditRegistry (published audit report hashes) | [`0xF2e4…E442`](https://testnet.snowtrace.io/address/0xF2e41F5158E717Ad730f9D59cACfa4a9a285E442) |

| Proof | Transaction |
|---|---|
| Manager lists a Mazda CX-5 2.0 as 100 shares x 280 USDC | [0x0252…adf6](https://testnet.snowtrace.io/tx/0x02523e17934d4eae2634c154ddfa963314ff61a89cdda54e2381eed568e6adf6) |
| Last share sold: 28,000 USDC goes to the rental operator in the same transaction | [0xb887…d813](https://testnet.snowtrace.io/tx/0xb8879dee425910b16eab691de88fa667dad881b236c74d38eec646888985d813) |
| Operator pays 315 USDC rent: 31.50 fee, 283.50 to holders | [0xaf5d…2780](https://testnet.snowtrace.io/tx/0xaf5d3501904d84f35e9a1abbb2cb481140810be8ffb3a168bad1670140de2780) |
| A holder of 40 shares collects two months of rent, 226.80 USDC | [0xd2a7…764d](https://testnet.snowtrace.io/tx/0xd2a782fb2bb2049bdb5d28a4c5c8b9fcbf6107e863fc6b0de47263be4703764d) |
| Holder offers 5 shares at 275 USDC | [0x1aaa…f625](https://testnet.snowtrace.io/tx/0x1aaa07517aa266c4ef5aa6258c526046ef8a33baaa4671caa5c711efddaef625) |
| Operator closes a period on the Team1 L1: 2 rentals, 15 days, 315 USDC, sent over ICM (no public explorer) | `0xa827f743eb0cd69f604e7ee7d13649c99d8b554bbc429539337b09d31dea15dd` |
| The ICM message arrives on Fuji | [0xa187…e740](https://testnet.snowtrace.io/tx/0xa187c4229be5ed4d0d505ba452457baaca3fa046f1ec1bbde25a09b51a2de740) |
| A third month is reported but not paid: `ledger(1)` shows reported 945, paid 630, unpaid 315 | [0x6c09…c86b](https://testnet.snowtrace.io/tx/0x6c095efd7316f32f18e13da5b2933837f0177718cc7988ceb50ffde599b4c86b) |

All addresses and hashes: [docs/fuji.json](docs/fuji.json). The first deployment, by the original author (with the RentalLog on Dispatch), is kept in [docs/fuji-v1.json](docs/fuji-v1.json).

Keywords: RWA · fractional ownership · rental income · ERC-1155 · Avalanche L1 · ICM / Teleporter · Foundry

## Two chains, joined by Avalanche ICM

- **Fuji C-Chain** holds the money: `FleetShares` (shares, rent, offers) and `IncomeMirror`.
- **An Avalanche L1** holds the operator's day-to-day ledger: `RentalLog`, one cheap transaction per rental. Anyone can close a car's period; the contract sends its own totals to Fuji through Teleporter, once per period.
- `IncomeMirror.ledger(carId)` then shows, on Fuji, the income the operator **reported** next to the rent it **paid** into FleetShares, and the gap. Shareholders see at once if the operator is keeping income back. The mirror accepts a message only from Teleporter, only from that L1 and only from that RentalLog.

The L1 in this deployment is one of our team's own Avalanche L1s on Fuji (chain 510103, Subnet-EVM, sovereign L1 with its own validator), connected to the C-Chain by the team's ICM relayer. It has a transaction allow-list, so only enabled addresses (here the manager and the operator) can send transactions on it; anyone can read it at `https://fairpick-rpc.zillexa.com`. It has no public block explorer, so the app shows L1 hashes with a copy button instead of a link. The first deployment used Dispatch, Avalanche's public test L1; nothing in `RentalLog` depends on which L1 it is.

## Who doesn't trust whom, and what the contract enforces

| Distrust | Rule in `src/FleetShares.sol` |
|---|---|
| Investors vs the manager: will it run off with the money? | The manager never holds investor money. Purchase money sits in the contract and goes to the operator's address only in the transaction that sells the last share. |
| Investors vs a car that never fills | Past the deadline anyone can cancel the sale and every buyer refunds in full. Shares cannot move while a sale is open. |
| Investors vs the fee | The fee is a constant: 10 % of each rent payment. The manager cannot change it or take more. |
| Holders vs each other | Rent is accounted per share at the moment it is paid. Rent earned before a sale stays with the seller; the buyer earns from then on. |
| Buyer vs seller of shares | An offer is taken in one transaction: USDC to the seller, shares to the buyer, or nothing. |

## Contract

`FleetShares` is one ERC-1155: each car is a token id, each unit one share.

- `listCar` (manager) · `buyShares` · `cancelFunding` · `refund`
- `payRent` (that car's operator) · `claim` · `claimable` · `withdrawFees`
- `makeOffer` · `takeOffer` · `cancelOffer`

`RentalLog` (L1): `setOperator` (manager) · `logRental` (operator, each rental once) · `report` (anyone). `IncomeMirror` (Fuji): `ledger` · `reported`.

## Run

```sh
git submodule update --init --recursive
forge test                      # 50 tests
./scripts/fuji-deploy-seed.sh   # deploy to Fuji and replay the demo story (needs .env with DEPLOYER_KEY)
./scripts/fuji-deploy-env.sh    # the current deployment: all contracts on Fuji + the team L1, three seeded cars (needs TEAM_FUNDER_KEY)
cd web && python3 -m http.server 8080
```

## Limits

- Testnet demo. The chain cannot see the car or its real income: it records who paid what and enforces the split.
- An operator that stops paying rent is not forced to by the contract; there is no collateral or repossession on chain.
- Selling shares of a car's income to the public is likely a regulated security offering in Vietnam. This is a prototype, not an offer.
- The offer book does not escrow shares: an offer whose seller moved the shares cannot be taken.
- Contracts are not audited.

## Photo credits

Car photos are loaded from Wikimedia Commons under CC BY-SA 4.0: [2022 Mazda CX-5 2.0 front.jpg](https://commons.wikimedia.org/wiki/File:2022_Mazda_CX-5_2.0_front.jpg) by ShangTW, [VinFast VF 8 IAA 2023 1X7A0681.jpg](https://commons.wikimedia.org/wiki/File:VinFast_VF_8_IAA_2023_1X7A0681.jpg) by Alexander-93, and [2023 Toyota Vios 1.5 G in Black, front left.jpg](https://commons.wikimedia.org/wiki/File:2023_Toyota_Vios_1.5_G_in_Black,_front_left.jpg) by Ethan Llamas.

## Add-ons

Two contracts that sit next to the deployed `FleetShares` and leave it unchanged.

- `CarExit` pays out a car's resale money. When the car is sold after its 4–5 rental years, the operator calls `settle(carId, proceeds)` once. Each holder then calls `redeem(carId, shares)` (after `setApprovalForAll` on FleetShares) and gets `proceeds × shares / totalShares` USDC. There is no fee on resale. Rent earned before redeeming stays claimable in FleetShares, and the holder who redeems the last share also gets the rounding dust.
- `AuditRegistry` stores the auditor's quarterly reports: `publish(carId, period, scope, exceptions, reportHash)`, where `carId` 0 means the whole fleet. Only the auditor key set at deployment can publish, and reports can't be edited or deleted.

Limits: FleetShares has no "sold" state, so a settled car stays Active there. Its shares still trade, and any rent paid after the sale on shares already redeemed goes to `CarExit` and stays there unclaimed. The registry holds report hashes only, so it shows what the auditor signed, not that the audit was done properly.

Deploy: `./scripts/fuji-deploy-addons.sh` (needs `DEPLOYER_KEY` in `.env`; `AUDITOR_ADDRESS` is optional and defaults to the deployer). It prints the `CarExit`, `AuditRegistry` and `auditor` keys to add to `web/fuji.json` and `docs/fuji.json`. ABIs are in `web/abi/`.
