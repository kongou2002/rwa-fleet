# FleetShares: own a share of a rental car, get paid a share of its rent

Slides: _link to be added before submission_ · Video (2 to 3 min): _link to be added before submission_

A rental company in Vietnam earns roughly 10 to 15 % a year on a car, but only people who can buy a whole car get that income. FleetShares splits one car (say a Mazda CX-5) into shares. Investors buy shares with USDC; when the car is sold out the money goes to the rental operator, who buys it and rents it out. Rent comes back on chain per car: **10 % to the manager, 90 % to the shareholders**, and shares can be resold in a built-in offer book.

Live on Avalanche Fuji (testnet only):

| What | Where |
|---|---|
| FleetShares | [`0x75F0…a2B1`](https://testnet.snowtrace.io/address/0x75F02c6F7E44b26637E4396170BE1B65E67dA2B1) |
| MockUSDC (public faucet) | [`0xc5c5…9CF4`](https://testnet.snowtrace.io/address/0xc5c54112194CdC7221677A8da4b5D33Fd5EB9CF4) |

| Proof | Transaction |
|---|---|
| Manager lists a Mazda CX-5 as 100 shares x 25 USDC | [0x9db0…63b7](https://testnet.snowtrace.io/tx/0x9db0e8560729f091c68bb5178ce62d587a783097263554fee426caf9e76363b7) |
| Last share sold: 2,500 USDC goes to the rental operator in the same transaction | [0x947a…798d](https://testnet.snowtrace.io/tx/0x947ab73ff6343521148c8fa2fdd7466bd3faa532ad0b52f09937bf71d752798d) |
| Operator pays 250 USDC rent: 25 fee, 225 to holders | [0xa54b…f25c](https://testnet.snowtrace.io/tx/0xa54b1e5f97cd8c7109bf13f31240322b2bdcfeb22650a608d0eacefae660f25c) |
| A holder of 40 shares claims 90 USDC | [0x6732…8e7e](https://testnet.snowtrace.io/tx/0x673238e858b39c23f99fd6c397bbf001a8cabc6efec2758d016ba02967f08e7e) |
| Manager withdraws its 25 USDC fee | [0xdbcf…dfec](https://testnet.snowtrace.io/tx/0xdbcf04c19c3cfaca849fc3803a0fc84fd9c9016b7345e2497784241aaba5dfec) |
| Holder offers 10 shares at 27 USDC | [0xe527…8387](https://testnet.snowtrace.io/tx/0xe5271d070c2b2873ccd57cf4c99e875d118e772c6663b25c89086540ffe38387) |
| Another investor takes 5 of them | [0x4909…9475](https://testnet.snowtrace.io/tx/0x4909abde3aec65b403b4b93c075505f4388b3379403e4f9ebd484f7e58a39475) |

All addresses and hashes: [docs/fuji.json](docs/fuji.json).

Keywords: RWA · fractional ownership · rental income · ERC-1155 · Avalanche · Foundry

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

## Run

```sh
git submodule update --init --recursive
forge test                      # 13 tests
./scripts/fuji-deploy-seed.sh   # deploy to Fuji and replay the demo story (needs .env with DEPLOYER_KEY)
cd web && python3 -m http.server 8080
```

## Limits

- Testnet demo. The chain cannot see the car or its real income: it records who paid what and enforces the split.
- An operator that stops paying rent is not forced to by the contract; there is no collateral or repossession on chain.
- Selling shares of a car's income to the public is likely a regulated security offering in Vietnam. This is a prototype, not an offer.
- The offer book does not escrow shares: an offer whose seller moved the shares cannot be taken.
- Contracts are not audited.

## Photo credits

Car photos are loaded from Wikimedia Commons under CC BY-SA 4.0: [2022 Mazda CX-5 2.0 front.jpg](https://commons.wikimedia.org/wiki/File:2022_Mazda_CX-5_2.0_front.jpg) by ShangTW, and [VinFast VF 8 IAA 2023 1X7A0681.jpg](https://commons.wikimedia.org/wiki/File:VinFast_VF_8_IAA_2023_1X7A0681.jpg) by Alexander-93.
