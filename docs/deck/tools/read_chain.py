#!/usr/bin/env python3
"""Read the live figures the deck shows from Fuji and write live.json.

    python3 read_chain.py <repo> <out.json>

Needs Foundry's `cast` (CAST env, default ~/.foundry/bin/cast). RPC: FUJI_RPC env, default publicnode
(api.avax-test.network rate-limits). Addresses come from <repo>/docs/fuji.json; the test count from <repo>/test/*.sol.
"""
import json, os, pathlib, re, subprocess, sys, datetime

REPO, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
RPC = os.environ.get("FUJI_RPC", "https://avalanche-fuji-c-chain-rpc.publicnode.com")
CAST = os.environ.get("CAST", os.path.expanduser("~/.foundry/bin/cast"))
cfg = json.loads((REPO / "docs/fuji.json").read_text())
FROM = 61445000  # just before the current deployment (listCar1 is in block 61445720)


def cast(*a):
    return subprocess.run([CAST, *a, "--rpc-url", RPC], capture_output=True, text=True, check=True, timeout=60).stdout.strip()


def call(to, sig, *args):
    return json.loads(subprocess.run([CAST, "call", "--json", "--rpc-url", RPC, to, sig, *map(str, args)], capture_output=True, text=True, check=True, timeout=60).stdout)


def logs(addr, sig=None):
    a = ["logs", "--json", "--from-block", str(FROM), "--to-block", str(block), "--address", addr] + ([sig] if sig else [])
    return json.loads(cast(*a))


usd = lambda raw: int(str(raw).split()[0]) / 1e6
words = lambda data: [int(data[2 + i * 64: 2 + (i + 1) * 64], 16) for i in range((len(data) - 2) // 64)]

block = int(cast("block-number"))
ts = int(cast("block", str(block), "--field", "timestamp"), 0)
live = {"block": block, "time_utc": datetime.datetime.fromtimestamp(ts, datetime.UTC).strftime("%Y-%m-%d %H:%M UTC"), "rpc": RPC}

CAR = "getCar(uint256)((string,string,bytes32,address,uint64,uint32,uint32,uint8,uint256,uint256,uint256,uint256))"
cars = []
n = int(call(cfg["FleetShares"], "carCount()(uint256)")[0])
for i in range(1, n + 1):
    c = call(cfg["FleetShares"], CAR, i)[0]
    car = {"id": i, "name": c[0], "image": c[1], "total": int(c[5]), "sold": int(c[6]), "status": int(c[7]), "price": usd(c[8]), "rent": usd(c[9]), "fee": usd(c[10])}
    rep, paid, unpaid = call(cfg["IncomeMirror"], "ledger(uint256)(uint256,uint256,uint256)", i)
    car["ledger"] = {"reported": usd(rep), "paid": usd(paid), "unpaid": usd(unpaid)}
    e = call(cfg["CarExit"], "exitOf(uint256)((uint256,uint256,uint32,uint32,uint64))", i)[0]
    car["exit"] = {"proceeds": usd(e[0]), "paidOut": usd(e[1]), "totalShares": int(e[2]), "redeemed": int(e[3]), "soldAt": int(str(e[4]).split()[0])}
    cars.append(car)
live["cars"] = cars
live["audits"] = int(call(cfg["AuditRegistry"], "reportCount()(uint256)")[0])

rent = [{"block": int(l["blockNumber"], 16), "car": int(l["topics"][1], 16), "gross": words(l["data"])[0] / 1e6, "tx": l["transactionHash"]}
        for l in logs(cfg["FleetShares"], "RentPaid(uint256 indexed,address indexed,uint256,uint256,uint256)")]
reports = [{"block": int(l["blockNumber"], 16), "car": int(l["topics"][1], 16), "period": words(l["data"])[0], "rentals": words(l["data"])[1], "days": words(l["data"])[2], "income": words(l["data"])[3] / 1e6, "tx": l["transactionHash"]}
           for l in logs(cfg["IncomeMirror"], "IncomeReported(uint256 indexed,uint32,uint32,uint32,uint256)")]
live["rentPaid"], live["reports"] = rent, reports

# Transactions that touched the app's Fuji contracts: distinct hashes over every log they emitted. MockUSDC is
# left out because its faucet is public and its transfers inside our transactions are already counted.
txs = set()
for k in ["FleetShares", "IncomeMirror", "CarExit", "AuditRegistry"]:
    txs |= {l["transactionHash"] for l in logs(cfg[k])}
live["fujiTxs"] = len(txs)
live["contracts"] = sum(1 for k in ["FleetShares", "MockUSDC", "IncomeMirror", "CarExit", "AuditRegistry"] if cfg.get(k)) + (1 if cfg.get("l1", {}).get("RentalLog") else 0)
live["tests"] = sum(len(re.findall(r"function test\w*\s*\(", p.read_text())) for p in (REPO / "test").glob("*.sol"))
OUT.write_text(json.dumps(live, indent=1, ensure_ascii=False))
print(json.dumps({k: v for k, v in live.items() if k not in ("rentPaid", "reports", "cars")}), [(c["name"], c["sold"], c["total"], c["status"], c["ledger"], c["exit"]["proceeds"], c["exit"]["redeemed"]) for c in cars])
