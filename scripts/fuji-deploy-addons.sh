#!/usr/bin/env bash
# Deploys the two add-ons next to the FleetShares already on Fuji: CarExit (resale payout) and AuditRegistry
# (published audit reports). Reads FleetShares from web/fuji.json; CarExit reads the USDC address from FleetShares.
# Needs .env with DEPLOYER_KEY (funded with Fuji AVAX). AUDITOR_ADDRESS in .env is optional and defaults to the
# deployer for the demo. Prints the JSON keys to add to web/fuji.json and docs/fuji.json; writes no files. TESTNET ONLY.
set -euo pipefail
cd "$(dirname "$0")/.."
RPC=${RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}
CAST=${CAST:-cast}
FORGE=${FORGE:-forge}

set -a; source .env; set +a
: "${DEPLOYER_KEY:?DEPLOYER_KEY missing in .env}"
DEPLOYER_ADDRESS=$("$CAST" wallet address --private-key "$DEPLOYER_KEY")
AUDITOR=${AUDITOR_ADDRESS:-$DEPLOYER_ADDRESS}

jsonkey() { python3 -c "import json,sys;print(json.load(open('web/fuji.json'))[sys.argv[1]])" "$1"; }
FLEET=$(jsonkey FleetShares)
USDC=$(jsonkey MockUSDC)

# Sanity check: the FleetShares at that address really uses the USDC listed next to it.
ONCHAIN_USDC=$("$CAST" call --rpc-url "$RPC" "$FLEET" "token()(address)")
if [ "$(echo "$ONCHAIN_USDC" | tr '[:upper:]' '[:lower:]')" != "$(echo "$USDC" | tr '[:upper:]' '[:lower:]')" ]; then
  echo "FleetShares.token() is $ONCHAIN_USDC but web/fuji.json says MockUSDC is $USDC" >&2
  exit 1
fi

deploy() { # contract args...
  local c=$1; shift
  "$FORGE" create --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast --json "$c" ${1:+--constructor-args "$@"} \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['deployedTo'])"
}

EXIT=$(deploy src/CarExit.sol:CarExit "$FLEET")
AUDIT=$(deploy src/AuditRegistry.sol:AuditRegistry "$AUDITOR")
echo "CarExit       $EXIT   (FleetShares $FLEET, USDC $USDC)"
echo "AuditRegistry $AUDIT   (auditor $AUDITOR)"
echo
echo "Add these keys to web/fuji.json and docs/fuji.json:"
cat <<EOF
  "CarExit": "$EXIT",
  "AuditRegistry": "$AUDIT",
  "auditor": "$AUDITOR"
EOF
