#!/usr/bin/env bash
# Plays the rental operator for a live demo: logs one rental on the Dispatch L1, closes the period (ICM to Fuji),
# then pays the same amount of rent into FleetShares on Fuji. Usage: ./scripts/demo-rent.sh [carId] [usdc] [days]
# Needs .env with OPERATOR_KEY (test wallet created by fuji-deploy-seed.sh). TESTNET ONLY.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
CAST=${CAST:-cast}
FUJI=${RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}
L1=${L1_RPC_URL:-https://subnets.avax.network/dispatch/testnet/rpc}
CAR=${1:-1}; USDC_AMOUNT=${2:-100}; DAYS=${3:-2}
UNITS=$((USDC_AMOUNT * 1000000))
j() { python3 -c "import json,sys;print(json.load(sys.stdin)$1)"; }
FLEET=$(j "['FleetShares']" < docs/fuji.json)
LOG=$(j "['l1']['RentalLog']" < docs/fuji.json)
MIRROR=$(j "['IncomeMirror']" < docs/fuji.json)
send() { local rpc=$1; shift; "$CAST" send --rpc-url "$rpc" --private-key "$OPERATOR_KEY" --json "$@" | j "['transactionHash']"; }

REF=$("$CAST" keccak "car-$CAR-rental-$(date +%s)")
echo "L1  logRental  $(send "$L1" "$LOG" "logRental(uint256,bytes32,uint32,uint256)" "$CAR" "$REF" "$DAYS" "$UNITS")"
echo "L1  report     $(send "$L1" "$LOG" "report(uint256)" "$CAR")"
echo "Fuji payRent   $(send "$FUJI" "$FLEET" "payRent(uint256,uint256)" "$CAR" "$UNITS")"
echo "waiting for the ICM message on Fuji..."
BEFORE=""
for _ in $(seq 1 30); do
  NOW=$("$CAST" call "$MIRROR" "ledger(uint256)(uint256,uint256,uint256)" "$CAR" --rpc-url "$FUJI" | tr '\n' ' ')
  [ "$NOW" != "$BEFORE" ] && echo "ledger (reported, paid, unpaid): $NOW" && BEFORE=$NOW
  case "$NOW" in *" 0 "|*" 0") break ;; esac
  python3 -c "import time;time.sleep(3)"
done
