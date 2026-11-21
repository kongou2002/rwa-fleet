#!/usr/bin/env bash
# Full deployment under keys we hold: MockUSDC, FleetShares, CarExit, AuditRegistry and IncomeMirror on Fuji, RentalLog
# on the team's fairpick L1 (chain 510103, Avalanche ICM to Fuji through the team relayer), then seeds three cars with
# investors, rent, L1 income reports and offers, and writes docs/fuji.json and web/fuji.json.
#
# Needs .env with TEAM_FUNDER_KEY: pays gas to the role wallets on Fuji, and on the L1 (where it is an allow-list
# admin) enables DEPLOYER and OPERATOR and sends them L1 gas. Role keys (DEPLOYER, OPERATOR, ALICE, BOB, CAROL, DAVE,
# AUDITOR) are created in .env on first run. Test USDC comes from throwaway funder wallets (one faucet() each).
# Re-runnable: every step records its result in cache/fuji-deploy-env.state and is skipped next time.
# Optional: KEYS_OUT=/path/keys.json writes the role keys there (mode 600) for the demo recorder. TESTNET ONLY.
set -euo pipefail
cd "$(dirname "$0")/.."
RPC=${RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}
L1=${L1_RPC_URL:-https://fairpick-rpc.zillexa.com}
CAST=${CAST:-cast}
FORGE=${FORGE:-forge}
TELEPORTER=0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf
FUJI_ID=0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5   # Fuji C-Chain blockchainID
L1_ID=0x8c8a1113dc680048a3734fbf97bac7e193d728d299d57884f5dca1888c88199a     # fairpick blockchainID
ALLOWLIST=0x0200000000000000000000000000000000000002                           # TxAllowList precompile
MAX=115792089237316195423570985008687907853269984665640564039457584007913129639935
STATE=cache/fuji-deploy-env.state

newkey() { # name
  if ! grep -q "^$1_KEY=" .env; then
    "$CAST" wallet new --json | python3 -c "
import json,sys
d=json.load(sys.stdin); d=d['data'][0] if isinstance(d,dict) else d[0]
print('$1_KEY='+d['private_key']); print('$1_ADDRESS='+d['address'])" >> .env
  fi
}
for n in DEPLOYER OPERATOR ALICE BOB CAROL DAVE AUDITOR; do newkey $n; done
chmod 600 .env
set -a; source .env; set +a
: "${TEAM_FUNDER_KEY:?TEAM_FUNDER_KEY missing in .env}"

mkdir -p cache; touch "$STATE"
get() { grep "^$1=" "$STATE" | tail -1 | cut -d= -f2- || true; }
once() { # VAR cmd... : runs cmd once, keeps its output in the state file and in $VAR
  local v; v=$(get "$1")
  if [ -z "$v" ]; then v=$("${@:2}"); echo "$1=$v" >> "$STATE"; fi
  printf -v "$1" '%s' "$v"
}
send() { # rpc key to sig args... -> tx hash (fails if the tx reverted)
  local rpc=$1 key=$2; shift 2
  "$CAST" send --rpc-url "$rpc" --private-key "$key" --json "$@" | python3 -c "
import json,sys
r=json.load(sys.stdin)
if r.get('status') not in ('0x1',1,'1'): sys.exit('reverted: '+r['transactionHash'])
print(r['transactionHash'])"
}
fuji() { send "$RPC" "$@"; }
l1() { send "$L1" "$@"; }
deploy() { # rpc contract args...
  local rpc=$1 c=$2; shift 2
  "$FORGE" create --rpc-url "$rpc" --private-key "$DEPLOYER_KEY" --broadcast --json "$c" ${1:+--constructor-args "$@"} \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['deployedTo'])"
}
usdc() { python3 -c "import sys;print(round(float(sys.argv[1])*10**6))" "$1"; }

echo "== gas for the role wallets (Fuji, from the team wallet)"
once G_DEPLOYER fuji "$TEAM_FUNDER_KEY" "$DEPLOYER_ADDRESS" --value 0.03ether
for n in OPERATOR ALICE BOB CAROL DAVE AUDITOR; do
  a=${n}_ADDRESS; once "G_$n" fuji "$TEAM_FUNDER_KEY" "${!a}" --value 0.01ether
done

echo "== contracts on Fuji"
once USDC deploy "$RPC" src/MockUSDC.sol:MockUSDC
once FLEET deploy "$RPC" src/FleetShares.sol:FleetShares "$USDC" "$DEPLOYER_ADDRESS"
once EXIT deploy "$RPC" src/CarExit.sol:CarExit "$FLEET"
once AUDIT deploy "$RPC" src/AuditRegistry.sol:AuditRegistry "$AUDITOR_ADDRESS"

echo "== allow-list and gas on the L1 (team wallet is an allow-list admin there)"
once AL_DEPLOYER l1 "$TEAM_FUNDER_KEY" "$ALLOWLIST" "setEnabled(address)" "$DEPLOYER_ADDRESS"
once AL_OPERATOR l1 "$TEAM_FUNDER_KEY" "$ALLOWLIST" "setEnabled(address)" "$OPERATOR_ADDRESS"
once L1G_DEPLOYER l1 "$TEAM_FUNDER_KEY" "$DEPLOYER_ADDRESS" --value 0.2ether
once L1G_OPERATOR l1 "$TEAM_FUNDER_KEY" "$OPERATOR_ADDRESS" --value 0.2ether

echo "== RentalLog (L1) <-> IncomeMirror (Fuji)"
# RentalLog needs the mirror's address first: it is DEPLOYER's next contract on Fuji. Nothing else may be sent from
# DEPLOYER on Fuji between this prediction and the IncomeMirror deployment.
predict_mirror() { "$CAST" compute-address "$DEPLOYER_ADDRESS" --nonce "$("$CAST" nonce "$DEPLOYER_ADDRESS" --rpc-url "$RPC")" | grep -oE '0x[0-9a-fA-F]{40}'; }
once MIRROR_PRED predict_mirror
once LOG deploy "$L1" src/icm/RentalLog.sol:RentalLog "$DEPLOYER_ADDRESS" "$TELEPORTER" "$FUJI_ID" "$MIRROR_PRED"
once MIRROR deploy "$RPC" src/icm/IncomeMirror.sol:IncomeMirror "$TELEPORTER" "$L1_ID" "$LOG" "$FLEET"
[ "$(echo "$MIRROR" | tr A-F a-f)" = "$(echo "$MIRROR_PRED" | tr A-F a-f)" ] || { echo "IncomeMirror at $MIRROR, expected $MIRROR_PRED" >&2; exit 1; }
for car in 1 2 3; do once "T_SETOP$car" l1 "$DEPLOYER_KEY" "$LOG" "setOperator(uint256,address)" $car "$OPERATOR_ADDRESS"; done

echo "== test USDC from throwaway funders (1,000 each)"
bal() { "$CAST" call "$USDC" "balanceOf(address)(uint256)" "$1" --rpc-url "$RPC" | awk '{print $1}'; }
# Funder wallets are throwaway test keys, kept in cache/funders (git-ignored) until the investors are funded, so a
# funder that failed halfway (rate limit, dropped tx) is simply retried by the next run. Each file: "address key to".
FUNDERS=cache/funders
run_funders() { # finishes every funder in $FUNDERS: faucet() if it holds no USDC yet, then transfer it to its investor
  export CAST RPC USDC
  ls "$FUNDERS"/* 2>/dev/null | xargs -n1 -P 4 bash -c '
    read -r a k to < "$0"
    b() { "$CAST" call "$USDC" "balanceOf(address)(uint256)" "$a" --rpc-url "$RPC" | awk "{print \$1}"; }
    [ "$(b)" -ge 1000000000 ] || "$CAST" send --rpc-url "$RPC" --private-key "$k" "$USDC" "faucet()" >/dev/null || { echo "funder $a: faucet failed" >&2; exit 0; }
    [ "$(b)" -ge 1000000000 ] && { "$CAST" send --rpc-url "$RPC" --private-key "$k" "$USDC" "transfer(address,uint256)" "$to" 1000000000 >/dev/null || echo "funder $a: transfer failed" >&2; }
    exit 0' >&2
}
fund_all() { # "ADDR USDC_WANTED" lines on stdin; tops each address up to that many USDC, 1,000 per funder
  mkdir -p "$FUNDERS"; chmod 700 "$FUNDERS"
  local targets; targets=$(cat)
  run_funders  # retry funders left over from an earlier run first
  local i new=() addr want have count
  i=$(ls "$FUNDERS" | wc -l | tr -d ' ')
  while read -r addr want; do
    have=$(bal "$addr"); count=$(( (want * 1000000 - have + 999999999) / 1000000000 ))
    for _ in $(seq 1 $((count > 0 ? count : 0))); do
      i=$((i + 1))
      "$CAST" wallet new --json | python3 -c "
import json,sys
d=json.load(sys.stdin); d=d['data'][0] if isinstance(d,dict) else d[0]
print(d['address'], d['private_key'], '$addr')" > "$FUNDERS/f$i"
      new+=("$FUNDERS/f$i")
    done
  done <<< "$targets"
  if [ ${#new[@]} -gt 0 ]; then
    export DEPLOYER_KEY
    # Gas dust for each new funder from DEPLOYER: preassigned nonces so the sends can go out in parallel.
    local nonce n=0 f; nonce=$("$CAST" nonce "$DEPLOYER_ADDRESS" --block pending --rpc-url "$RPC")
    for f in "${new[@]}"; do echo "$((nonce + n)) $(cut -d' ' -f1 "$f")"; n=$((n + 1)); done | xargs -n2 -P 4 sh -c \
      '"$CAST" send --async --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --nonce "$0" "$1" --value 0.00002ether >/dev/null' >&2
    for _ in $(seq 1 60); do
      [ "$("$CAST" nonce "$DEPLOYER_ADDRESS" --rpc-url "$RPC")" -ge $((nonce + n)) ] && break; sleep 2
    done
    run_funders
  fi
  echo done
}
WANT="$ALICE_ADDRESS 22200
$BOB_ADDRESS 26700
$CAROL_ADDRESS 21100
$DAVE_ADDRESS 2000"
once FUNDED fund_all <<< "$WANT"
while read -r addr want; do  # never continue short of USDC
  [ "$(bal "$addr")" -ge $((want * 1000000)) ] || { echo "$addr has $(bal "$addr"), needs $want USDC; rerun" >&2; sed -i.bak '/^FUNDED=/d' "$STATE"; exit 1; }
done <<< "$WANT"
rm -rf "$FUNDERS"   # every investor is funded: the throwaway funder keys are no longer needed
for n in ALICE BOB CAROL DAVE; do a=${n}_ADDRESS; echo "$n $("$CAST" call "$USDC" "balanceOf(address)(uint256)" "${!a}" --rpc-url "$RPC")"; done

echo "== approvals"
for n in ALICE BOB CAROL OPERATOR; do k=${n}_KEY; once "AP_$n" fuji "${!k}" "$USDC" "approve(address,uint256)" "$FLEET" $MAX; done

echo "== list three cars"
LIST="listCar(string,string,bytes32,address,uint32,uint256,uint64)"
IMG1="https://commons.wikimedia.org/wiki/Special:FilePath/2022%20Mazda%20CX-5%202.0%20front.jpg?width=1200"
IMG2="https://commons.wikimedia.org/wiki/Special:FilePath/VinFast%20VF%208%20IAA%202023%201X7A0681.jpg?width=1200"
IMG3="https://commons.wikimedia.org/wiki/Special:FilePath/2023%20Toyota%20Vios%201.5%20G%20in%20Black,%20front%20left.jpg?width=1200"
DOCS1=$("$CAST" keccak "Mazda CX-5 2.0 2024, Hanoi: registration + rental agreement with Company A")
DOCS2=$("$CAST" keccak "VinFast VF 8 Eco 2024, Ho Chi Minh City: registration + rental agreement with Company A")
DOCS3=$("$CAST" keccak "Toyota Vios 1.5 G 2024, Da Nang: registration + rental agreement with Company A")
once T_LIST1 fuji "$DEPLOYER_KEY" "$FLEET" "$LIST" "Mazda CX-5 2.0" "$IMG1" "$DOCS1" "$OPERATOR_ADDRESS" 100 "$(usdc 280)" 604800
once T_LIST2 fuji "$DEPLOYER_KEY" "$FLEET" "$LIST" "VinFast VF 8 Eco" "$IMG2" "$DOCS2" "$OPERATOR_ADDRESS" 160 "$(usdc 250)" 2592000
once T_LIST3 fuji "$DEPLOYER_KEY" "$FLEET" "$LIST" "Toyota Vios 1.5 G" "$IMG3" "$DOCS3" "$OPERATOR_ADDRESS" 120 "$(usdc 150)" 604800

echo "== buy shares"
BUY="buyShares(uint256,uint32)"
once T_BUY1A fuji "$ALICE_KEY" "$FLEET" "$BUY" 1 40
once T_BUY1B fuji "$BOB_KEY" "$FLEET" "$BUY" 1 40
once T_BUY1C fuji "$CAROL_KEY" "$FLEET" "$BUY" 1 20   # sells out: 28,000 to the operator
once T_BUY3A fuji "$ALICE_KEY" "$FLEET" "$BUY" 3 20
once T_BUY3B fuji "$BOB_KEY" "$FLEET" "$BUY" 3 50
once T_BUY3C fuji "$CAROL_KEY" "$FLEET" "$BUY" 3 50   # sells out: 18,000 to the operator
once T_BUY2A fuji "$ALICE_KEY" "$FLEET" "$BUY" 2 32
once T_BUY2B fuji "$BOB_KEY" "$FLEET" "$BUY" 2 32
once T_BUY2C fuji "$CAROL_KEY" "$FLEET" "$BUY" 2 32   # 96 of 160 sold

echo "== rentals on the L1, reports by ICM, rent on Fuji"
LOGR="logRental(uint256,bytes32,uint32,uint256)"
period() { # car p days1 usdc1 days2 usdc2
  local car=$1 p=$2
  once "T_LOG${car}_${p}a" l1 "$OPERATOR_KEY" "$LOG" "$LOGR" "$car" "$("$CAST" keccak "car-$car-period-$p-rental-a")" "$3" "$(usdc "$4")"
  once "T_LOG${car}_${p}b" l1 "$OPERATOR_KEY" "$LOG" "$LOGR" "$car" "$("$CAST" keccak "car-$car-period-$p-rental-b")" "$5" "$(usdc "$6")"
  once "T_REP${car}_${p}" l1 "$OPERATOR_KEY" "$LOG" "report(uint256)" "$car"
}
for p in 1 2; do
  period 1 $p 9 189 6 126       # 315 a month
  period 3 $p 5 112.5 4 90      # 202.50 a month
  once "T_RENT1_$p" fuji "$OPERATOR_KEY" "$FLEET" "payRent(uint256,uint256)" 1 "$(usdc 315)"
  once "T_RENT3_$p" fuji "$OPERATOR_KEY" "$FLEET" "payRent(uint256,uint256)" 3 "$(usdc 202.5)"
done
period 1 3 9 189 6 126          # third month reported, not paid: 315 due
once T_CLAIM_BOB fuji "$BOB_KEY" "$FLEET" "claim(uint256)" 1

echo "== offers"
OFFER="makeOffer(uint256,uint32,uint256)"
once T_OFFER_A fuji "$ALICE_KEY" "$FLEET" "$OFFER" 1 5 "$(usdc 275)"
once T_OFFER_B fuji "$BOB_KEY" "$FLEET" "$OFFER" 1 8 "$(usdc 292)"
once T_OFFER_C fuji "$CAROL_KEY" "$FLEET" "$OFFER" 3 10 "$(usdc 154)"

echo "== waiting for ICM delivery on Fuji"
for _ in $(seq 1 60); do
  R1=$("$CAST" call "$MIRROR" "ledger(uint256)(uint256,uint256,uint256)" 1 --rpc-url "$RPC" | head -1 | awk '{print $1}')
  R3=$("$CAST" call "$MIRROR" "ledger(uint256)(uint256,uint256,uint256)" 3 --rpc-url "$RPC" | head -1 | awk '{print $1}')
  echo "reported: car 1 $R1, car 3 $R3"
  [ "$R1" = 945000000 ] && [ "$R3" = 405000000 ] && break
  sleep 5
done
first_delivery() { # first IncomeReported event on the mirror = an ICM delivery tx on Fuji
  "$CAST" logs --rpc-url "$RPC" --address "$MIRROR" --from-block "$("$CAST" receipt "$T_LIST1" blockNumber --rpc-url "$RPC")" --json \
    | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['transactionHash'])"
}
once T_ICM first_delivery

echo "== config"
for f in docs/fuji.json web/fuji.json; do
cat > "$f" <<EOF
{
  "chainId": 43113,
  "MockUSDC": "$USDC",
  "FleetShares": "$FLEET",
  "manager": "$DEPLOYER_ADDRESS",
  "operator": "$OPERATOR_ADDRESS",
  "tx": {
    "listCar1": "$T_LIST1",
    "listCar2": "$T_LIST2",
    "listCar3": "$T_LIST3",
    "buyAlice": "$T_BUY1A",
    "buyBob": "$T_BUY1B",
    "soldOutPaysOperator": "$T_BUY1C",
    "soldOutCar3": "$T_BUY3C",
    "buyCar2": "$T_BUY2C",
    "payRent": "$T_RENT1_1",
    "claimRent": "$T_CLAIM_BOB",
    "makeOffer": "$T_OFFER_A",
    "icmDeliveredOnFuji": "$T_ICM"
  },
  "IncomeMirror": "$MIRROR",
  "CarExit": "$EXIT",
  "AuditRegistry": "$AUDIT",
  "auditor": "$AUDITOR_ADDRESS",
  "l1": {
    "name": "Team1 L1 (chain 510103)",
    "chainId": 510103,
    "rpc": "$L1",
    "RentalLog": "$LOG",
    "tx": {
      "setOperator": "$T_SETOP1",
      "logRental1": "$T_LOG1_1a",
      "logRental2": "$T_LOG1_1b",
      "report": "$T_REP1_1"
    }
  }
}
EOF
done
cat docs/fuji.json

if [ -n "${KEYS_OUT:-}" ]; then
  (umask 077; python3 - "$KEYS_OUT" <<'PY'
import json,os,sys
roles={'manager':'DEPLOYER','operator':'OPERATOR','alice':'ALICE','bob':'BOB','carol':'CAROL','dave':'DAVE','auditor':'AUDITOR'}
out={r:{'address':os.environ[n+'_ADDRESS'],'key':os.environ[n+'_KEY']} for r,n in roles.items()}
open(sys.argv[1],'w').write(json.dumps(out,indent=2)+'\n'); os.chmod(sys.argv[1],0o600)
PY
  )
  echo "keys written to $KEYS_OUT"
fi
