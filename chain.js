// Read logic for FleetShares. No imports: callers pass in a viem public client,
// so the same code runs in the browser (CDN viem) and in a node check (npm viem).

export const STATUS = ['None', 'Funding', 'Active', 'Cancelled'];
export const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';
export const EXPLORER = 'https://testnet.snowtrace.io';

// eth_getLogs limits differ a lot per endpoint: api.avax-test.network rejects ranges of 100+ blocks,
// publicnode allows 50,000. So the feed reads from an indexer first and falls back to RPC scans.
export const LOGS_RPC_URL = 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
export const LOGS_API = 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api';
const WIDE_CHUNK = 40000n;
const NARROW_CHUNK = 100n;

// Events worth showing in the activity feed (ERC-1155 transfer noise is left out).
export const FEED_EVENTS = new Set([
  'CarListed', 'SharesBought', 'CarFunded', 'FundingCancelled', 'Refunded', 'RentPaid',
  'RentClaimed', 'FeesWithdrawn', 'OfferMade', 'OfferTaken', 'OfferCancelled',
]);

async function readMany(client, contracts) {
  if (!contracts.length) return [];
  try {
    return await client.multicall({ contracts, allowFailure: false });
  } catch (e) {
    return Promise.all(contracts.map((c) => client.readContract(c)));
  }
}

const range = (n) => Array.from({ length: Number(n) }, (_, i) => BigInt(i + 1));

/** Everything the page shows, in three round trips. `account` is optional. */
export async function loadState(client, cfg, abis, account) {
  const fleet = { address: cfg.FleetShares, abi: abis.fleet };
  const usdc = { address: cfg.MockUSDC, abi: abis.usdc };

  const [carCount, offerCount, feesOwed, manager] = await readMany(client, [
    { ...fleet, functionName: 'carCount' },
    { ...fleet, functionName: 'offerCount' },
    { ...fleet, functionName: 'feesOwed' },
    { ...fleet, functionName: 'manager' },
  ]);

  const carIds = range(carCount);
  const offerIds = range(offerCount);
  const second = await readMany(client, [
    ...carIds.map((id) => ({ ...fleet, functionName: 'getCar', args: [id] })),
    ...offerIds.map((id) => ({ ...fleet, functionName: 'getOffer', args: [id] })),
  ]);
  const cars = carIds.map((id, i) => ({ id, ...second[i], statusName: STATUS[second[i].status] ?? 'None' }));
  const offers = offerIds.map((id, i) => ({ id, ...second[carIds.length + i] }));

  // A seller may have moved shares since making an offer: only what they still hold can be bought.
  const open = offers.filter((o) => o.amount > 0);
  const third = [
    ...open.map((o) => ({ ...fleet, functionName: 'balanceOf', args: [o.seller, o.carId] })),
  ];
  let me = null;
  if (account) {
    third.push(
      { ...usdc, functionName: 'balanceOf', args: [account] },
      { ...usdc, functionName: 'allowance', args: [account, cfg.FleetShares] },
      { ...usdc, functionName: 'lastFaucet', args: [account] },
      ...carIds.map((id) => ({ ...fleet, functionName: 'balanceOf', args: [account, id] })),
      ...carIds.map((id) => ({ ...fleet, functionName: 'claimable', args: [id, account] })),
    );
  }
  const [res, avax] = await Promise.all([
    readMany(client, third),
    account ? client.getBalance({ address: account }) : Promise.resolve(0n),
  ]);
  open.forEach((o, i) => {
    const held = res[i];
    o.fillable = held < BigInt(o.amount) ? Number(held) : o.amount;
  });
  if (account) {
    let k = open.length;
    me = { address: account, avax, usdc: res[k++], allowance: res[k++], lastFaucet: res[k++], shares: {}, claimable: {} };
    carIds.forEach((id) => { me.shares[id] = res[k++]; });
    carIds.forEach((id) => { me.claimable[id] = res[k++]; });
  }
  return { carCount, offerCount, feesOwed, manager, cars, offers, me };
}

/** Block ranges of <= size blocks covering [from, to], newest first, at most `max` of them. */
export function chunkRanges(from, to, size, max = 60) {
  const out = [];
  for (let end = to; end >= from && out.length < max; end -= size) {
    const start = end - size + 1n > from ? end - size + 1n : from;
    out.push([start, end]);
  }
  return out;
}

const hexNum = (h) => (typeof h === 'string' ? parseInt(h, 16) || 0 : Number(h ?? 0));

/** Raw logs (RPC, receipt or indexer shaped) to feed items. Unknown and non-feed events are dropped. */
export function decodeLogs(raw, cfg, abis, decodeEventLog) {
  const out = [];
  const self = cfg.FleetShares.toLowerCase();
  for (const l of raw) {
    if (!l.address || l.address.toLowerCase() !== self) continue;
    try {
      const d = decodeEventLog({ abi: abis.fleet, data: l.data, topics: l.topics });
      if (!FEED_EVENTS.has(d.eventName)) continue;
      out.push({
        name: d.eventName,
        args: d.args,
        block: BigInt(hexNum(l.blockNumber)),
        index: hexNum(l.logIndex),
        tx: l.transactionHash,
        time: l.timeStamp ? hexNum(l.timeStamp) : undefined,
      });
    } catch (e) { /* not one of ours */ }
  }
  return out;
}

/** De-duplicates and orders newest first. */
export function sortEvents(list) {
  const seen = new Set();
  const uniq = list.filter((e) => {
    const k = e.tx + ':' + e.index;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.sort((a, b) => (a.block === b.block ? b.index - a.index : a.block < b.block ? 1 : -1));
}

async function scan(client, cfg, from, to, size, max) {
  const ranges = chunkRanges(from, to, size, max);
  const raw = [];
  let next = 0;
  async function worker() {
    while (next < ranges.length) {
      const [fromBlock, toBlock] = ranges[next++];
      const logs = await client.request({
        method: 'eth_getLogs',
        params: [{ address: cfg.FleetShares, fromBlock: '0x' + fromBlock.toString(16), toBlock: '0x' + toBlock.toString(16) }],
      });
      raw.push(...logs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, ranges.length) }, worker));
  return raw;
}

/** Block where the first car was listed: nothing the feed shows can be older. */
export async function deployBlock(client, cfg) {
  const r = await client.getTransactionReceipt({ hash: cfg.tx.listCar1 });
  return r.blockNumber;
}

/**
 * Contract events since deploy, newest first. Tries, in order:
 *  1. the Routescan logs API (one request, includes timestamps),
 *  2. a wide-range RPC (`logsClient`) in 40,000-block chunks,
 *  3. the demo transactions' receipts plus the last 1,000 blocks on the main RPC in 100-block chunks.
 * `only` forces one path (for checks). Returns { events, source }.
 */
export async function loadEvents({ client, logsClient, cfg, abis, decodeEventLog, fetchFn = fetch, only }) {
  const from = await deployBlock(client, cfg);

  if (!only || only === 'indexer') {
    try {
      const url = `${LOGS_API}?module=logs&action=getLogs&address=${cfg.FleetShares}&fromBlock=${from}&toBlock=latest`;
      const body = await (await fetchFn(url)).json();
      if (!Array.isArray(body.result)) throw new Error(body.message || 'bad response');
      const events = decodeLogs(body.result, cfg, abis, decodeEventLog);
      if (events.length || only) return { events: sortEvents(events), source: 'indexer' };
    } catch (e) { if (only) throw e; }
  }

  if (!only || only === 'rpc') {
    try {
      const to = await logsClient.getBlockNumber();
      const raw = await scan(logsClient, cfg, from, to, WIDE_CHUNK, 60);
      return { events: sortEvents(decodeLogs(raw, cfg, abis, decodeEventLog)), source: 'rpc' };
    } catch (e) { if (only) throw e; }
  }

  const to = await client.getBlockNumber();
  const [receipts, recent] = await Promise.all([
    Promise.all(Object.values(cfg.tx).map((hash) => client.getTransactionReceipt({ hash }).catch(() => null))),
    scan(client, cfg, to - 999n > from ? to - 999n : from, to, NARROW_CHUNK, 10).catch(() => []),
  ]);
  const raw = [...receipts.filter(Boolean).flatMap((r) => r.logs), ...recent];
  return { events: sortEvents(decodeLogs(raw, cfg, abis, decodeEventLog)), source: 'receipts' };
}
