#!/usr/bin/env bash
# Deploys MockUSDC and FleetShares to Fuji and runs the demo story with four test wallets:
# list two cars, sell one out, pay rent, claim, trade shares. Writes addresses and tx hashes to docs/fuji.json.
# Needs .env with DEPLOYER_KEY (funded with Fuji AVAX). Demo keys are created in .env on first run. TESTNET ONLY.
set -euo pipefail
cd "$(dirname "$0")/.."
RPC=${RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}
CAST=${CAST:-cast}
FORGE=${FORGE:-forge}

newkey() { # name
  if ! grep -q "^$1_KEY=" .env; then
    "$CAST" wallet new --json | python3 -c "
import json,sys
d=json.load(sys.stdin)['data'][0]
print('$1_KEY='+d['private_key']); print('$1_ADDRESS='+d['address'])" >> .env
  fi
}
for n in OPERATOR ALICE BOB CAROL; do newkey $n; done
set -a; source .env; set +a

send() { # key to sig args... -> prints tx hash
  local key=$1; shift
  "$CAST" send --rpc-url "$RPC" --private-key "$key" --json "$@" | python3 -c "import json,sys;print(json.load(sys.stdin)['transactionHash'])"
}
deploy() { # contract args...
  local c=$1; shift
  "$FORGE" create --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast --json "$c" ${1:+--constructor-args "$@"} \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['deployedTo'])"
}

echo "funding demo wallets with gas"
for a in $OPERATOR_ADDRESS $ALICE_ADDRESS $BOB_ADDRESS $CAROL_ADDRESS; do
  send "$DEPLOYER_KEY" "$a" --value 0.08ether >/dev/null
done

USDC=$(deploy src/MockUSDC.sol:MockUSDC)
FLEET=$(deploy src/FleetShares.sol:FleetShares "$USDC" "$DEPLOYER_ADDRESS")
echo "MockUSDC $USDC"; echo "FleetShares $FLEET"

for k in $OPERATOR_KEY $ALICE_KEY $BOB_KEY $CAROL_KEY; do
  send "$k" "$USDC" "faucet()" >/dev/null
  send "$k" "$USDC" "approve(address,uint256)" "$FLEET" 115792089237316195423570985008687907853269984665640564039457584007913129639935 >/dev/null
done

IMG1="https://commons.wikimedia.org/wiki/Special:FilePath/2022%20Mazda%20CX-5%202.0%20front.jpg?width=1200"
IMG2="https://commons.wikimedia.org/wiki/Special:FilePath/VinFast%20VF%208%20IAA%202023%201X7A0681.jpg?width=1200"
DOCS1=$("$CAST" keccak "Mazda CX-5 2024 demo registration + rental agreement")
DOCS2=$("$CAST" keccak "VinFast VF 8 2024 demo registration + rental agreement")

# Car 1: 100 shares x 25 USDC, sold out. Car 2: 200 shares x 10 USDC, left on sale for the live demo.
T_LIST1=$(send "$DEPLOYER_KEY" "$FLEET" "listCar(string,string,bytes32,address,uint32,uint256,uint64)" "Mazda CX-5 2024" "$IMG1" "$DOCS1" "$OPERATOR_ADDRESS" 100 25000000 604800)
T_LIST2=$(send "$DEPLOYER_KEY" "$FLEET" "listCar(string,string,bytes32,address,uint32,uint256,uint64)" "VinFast VF 8 2024" "$IMG2" "$DOCS2" "$OPERATOR_ADDRESS" 200 10000000 2592000)
T_BUY_A=$(send "$ALICE_KEY" "$FLEET" "buyShares(uint256,uint32)" 1 40)
T_BUY_B=$(send "$BOB_KEY" "$FLEET" "buyShares(uint256,uint32)" 1 40)
T_FUNDED=$(send "$CAROL_KEY" "$FLEET" "buyShares(uint256,uint32)" 1 20)
T_RENT=$(send "$OPERATOR_KEY" "$FLEET" "payRent(uint256,uint256)" 1 250000000)
T_CLAIM=$(send "$ALICE_KEY" "$FLEET" "claim(uint256)" 1)
T_FEES=$(send "$DEPLOYER_KEY" "$FLEET" "withdrawFees()")
T_OFFER=$(send "$ALICE_KEY" "$FLEET" "makeOffer(uint256,uint32,uint256)" 1 10 27000000)
T_TAKE=$(send "$CAROL_KEY" "$FLEET" "takeOffer(uint256,uint32)" 1 5)
T_BUY2=$(send "$CAROL_KEY" "$FLEET" "buyShares(uint256,uint32)" 2 20)

mkdir -p docs
cat > docs/fuji.json <<EOF
{
  "chainId": 43113,
  "MockUSDC": "$USDC",
  "FleetShares": "$FLEET",
  "manager": "$DEPLOYER_ADDRESS",
  "operator": "$OPERATOR_ADDRESS",
  "tx": {
    "listCar1": "$T_LIST1", "listCar2": "$T_LIST2",
    "buyAlice": "$T_BUY_A", "buyBob": "$T_BUY_B", "soldOutPaysOperator": "$T_FUNDED",
    "payRent": "$T_RENT", "claimRent": "$T_CLAIM", "withdrawFees": "$T_FEES",
    "makeOffer": "$T_OFFER", "takeOffer": "$T_TAKE", "buyCar2": "$T_BUY2"
  }
}
EOF
cat docs/fuji.json
