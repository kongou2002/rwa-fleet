# Reported vs paid check, car 1 (Mazda CX-5 2.0), 2026-11-22

This is a demo check made by the FleetShares team's own test wallet (0x8F3bdAbb36821B7AeDa3e7823B441607A72B4921), the auditor key of the AuditRegistry on Avalanche Fuji. It is not an independent audit. Nobody inspected the car, its papers or the operator's books.

Money in this demo is a test token standing in for VND moved by bank transfer, at a fixed demo rate of 1 token unit = 25,000 VND.

Read from Avalanche Fuji (chain 43113) at block 61448056 (2026-11-22T00:07:37.000Z):

| Source | Value |
|---|---|
| FleetShares 0xd82ba2Bad1cb88c836eA90410E4FDA798ad458F9 getCar(1).rentPaid | 1260 units = 31,500,000 VND |
| FleetShares getCar(1).feePaid | 126 units = 3,150,000 VND (10 % of rent) |
| FleetShares getCar(1).sold / totalShares | 100 / 100 |
| IncomeMirror 0x9D1479479FCB0EFeFF7E8398558b326886be263d ledger(1) reported | 1260 units = 31,500,000 VND |
| IncomeMirror ledger(1) paid | 1260 units = 31,500,000 VND |
| IncomeMirror ledger(1) unpaid | 0 units = 0 VND |
| IncomeMirror reported(1) periods / rentals / days | 4 / 8 / 59 |

Result: Rent paid covers the reported income: no unpaid amount.

Limits: these figures are what the contracts record. The chain cannot see the real car or whether every real rental was logged.
