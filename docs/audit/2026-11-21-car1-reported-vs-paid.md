# Reported vs paid check, car 1 (Mazda CX-5 2.0), 2026-11-21

This is a demo check made by the FleetShares team's own test wallet (0x8F3bdAbb36821B7AeDa3e7823B441607A72B4921), the auditor key of the AuditRegistry on Avalanche Fuji. It is not an independent audit. Nobody inspected the car, its papers or the operator's books.

Read from Avalanche Fuji (chain 43113) at block 61447245 (2026-11-21T23:44:02.000Z):

| Source | Value |
|---|---|
| FleetShares 0xd82ba2Bad1cb88c836eA90410E4FDA798ad458F9 getCar(1).rentPaid | 945 USDC |
| FleetShares getCar(1).feePaid | 94.5 USDC (10 % of rent) |
| FleetShares getCar(1).sold / totalShares | 100 / 100 |
| IncomeMirror 0x9D1479479FCB0EFeFF7E8398558b326886be263d ledger(1) reported | 945 USDC |
| IncomeMirror ledger(1) paid | 945 USDC |
| IncomeMirror ledger(1) unpaid | 0 USDC |
| IncomeMirror reported(1) periods / rentals / days | 3 / 6 / 45 |

Result: Rent paid covers the reported income: no unpaid amount.

Limits: these figures are what the contracts record. The chain cannot see the real car or whether every real rental was logged.
