// FleetShares core: state, helpers, wallet, transactions, router, render loop, data loading.
// Plain ES module, no build step. Views import from here and register themselves with registerView().
import * as chain from './chain.js';

export { chain };

const VIEM_URL = 'https://esm.sh/viem@2.21.0';
const FUJI_HEX = '0xa869'; // 43113
const AVAX_FAUCET = 'https://build.avax.network/console/primary-network/faucet';
const EXPLORER = chain.EXPLORER;

// Live bindings, assigned in boot(). Read them inside functions, not at module top level.
export let V; // viem
export let cfg; // fuji.json
export let abis; // { fleet, usdc, fleetX, exit?, exitX?, audit? }
export let pub; // public client (reads, simulation, receipts)
let FUJI; // viem chain definition
let logsClient; // wide-range getLogs fallback

export const S = {
  data: null, // result of chain.loadState
  events: null,
  localEvents: [], // decoded from our own receipts, shown before the indexer catches up
  account: null,
  provider: null,
  busy: null, // key of the action in flight
  loadError: null,
  feedError: false, // the event feed could not be loaded
  reports: [], // IncomeReported deliveries on IncomeMirror, newest first
  walletChain: null, // chain id the wallet is on
  ledger: {}, // carId -> { reportedIncome, rentPaid, unpaid, periods, rentals, daysRented } from IncomeMirror
  // Add-ons, only filled when fuji.json names them (CarExit, AuditRegistry):
  exits: {}, // carId -> { proceeds, paidOut, totalShares, redeemedShares, soldAt } for cars whose sale is recorded
  audits: null, // null until read, then AuditRegistry reports, newest first: { id, carId, period, scope, exceptions, reportHash, publishedAt }
  auditor: null, // AuditRegistry.auditor()
};
export const ui = { buy: {}, offer: {}, take: {}, rent: {}, exit: {}, list: { name: '', image: '', docs: '', operator: '', shares: '100', price: '25', days: '30' }, audit: { car: '0', period: '', scope: '', exceptions: '', doc: '' }, walletOpen: false, listOpen: false };

// ---------- off-chain terms ----------

// Off-chain terms from the rental agreement with the operator. The chain does not know these:
// edit them here. A car with no CAR_META entry simply omits city, type, term, gross range and resale.
export const TERMS = { operator: 'Company A', country: 'Vietnam', gross: [12, 15], life: '4–5 years', fee: 10 };
export const CAR_META = {
  1: { city: 'Hanoi', type: 'SUV', term: 5, resale: 55 },
  2: { city: 'Ho Chi Minh City', type: 'Electric SUV', term: 5, gross: [13, 15], resale: 50 },
  3: { city: 'Da Nang', type: 'Sedan', term: 4, resale: 60 },
};
// Chart series colours, fixed order by car id (car 1 -> SERIES[0]).
export const SERIES = ['#c8102e', '#2a78d6', '#eda100'];

// ---------- small helpers ----------

const $ = (sel, el = document) => el.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const txUrl = (h) => `${EXPLORER}/tx/${h}`;
export const addrUrl = (a) => `${EXPLORER}/address/${a}`;
export const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? '' : 's'}`;

/** USDC base units to a display string. Truncates, never rounds up. */
/**
 * Demo money. In the real product money moves in VND by bank transfer and the chain keeps the rules and the receipts.
 * On this testnet a test token stands in for the VND a payment gateway would have received: 1 token unit = 25,000 VND.
 */
export const VND_PER_UNIT = 25000n;
/** Token base units (6 dp) to whole VND. Truncates, never rounds up. */
export const toVnd = (v) => (BigInt(v) * VND_PER_UNIT) / 1000000n;
/** Token base units to a compact VND string without the unit: '700M', '7.875M', '2.15B', '141,750'. */
export function usd(v) {
  const d = toVnd(v);
  const cut = (scale, suffix) => {
    const whole = d / scale;
    const frac = ((d % scale) * 1000n / scale).toString().padStart(3, '0').replace(/0+$/, '');
    return `${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}${suffix}`;
  };
  if (d >= 1000000000n) return cut(1000000000n, 'B');
  if (d >= 1000000n) return cut(1000000n, 'M');
  return d.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export const usdc = (v) => `${usd(v)} VND`;
/** Token base units to a plain JS number of million VND (for charts and ratios). */
export const num = (v) => Number(V.formatUnits(BigInt(v), 6)) * Number(VND_PER_UNIT) / 1e6;
/** A figure with its unit, for KPI and stat cells. */
export const fig = (v) => `${usd(v)}<span class="unit">VND</span>`;
/** 11.66 -> '11.7', 12 -> '12'. */
export const trim = (n, dp = 1) => String(Number(Number(n).toFixed(dp)));
/** Percent of part in whole, no % sign. */
export const pct = (part, whole, dp = 1) => (BigInt(whole) === 0n ? '0' : trim((Number(part) / Number(whole)) * 100, dp));

/** A typed VND amount ('7,875,000', '7.875.000', '7875000', '7.875M', '0.7B') to token base units, or null. */
export function parseUsd(str) {
  const s = String(str ?? '').trim().replace(/\s|vnd|đ|₫/gi, '');
  let vnd = null;
  const short = /^(\d+(?:[.,]\d{1,3})?)([mb])$/i.exec(s);
  if (short) {
    const [w, f = ''] = short[1].replace(',', '.').split('.');
    vnd = (BigInt(w) * 1000n + BigInt(f.padEnd(3, '0'))) * (short[2].toLowerCase() === 'b' ? 1000000n : 1000n);
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(s) || /^\d+$/.test(s)) {
    vnd = BigInt(s.replace(/[.,]/g, ''));
  }
  if (vnd === null || vnd <= 0n) return null;
  return (vnd * 1000000n) / VND_PER_UNIT;
}
export function parseShares(str) {
  const s = String(str ?? '').trim();
  if (!/^\d{1,9}$/.test(s)) return 0;
  return parseInt(s, 10);
}

export function who(addr) {
  let tag = '';
  if (same(addr, S.account)) tag = 'You';
  else if (S.data && same(addr, S.data.manager)) tag = 'Manager';
  else if (S.data && S.data.cars.some((c) => same(c.operator, addr))) tag = 'Operator';
  return `<a class="addr" href="${addrUrl(addr)}" target="_blank" rel="noopener" title="${esc(addr)}">${tag ? `<b>${tag}</b> ` : ''}${short(addr)}</a>`;
}

export function timeLeft(sec) {
  if (sec <= 0) return 'ended';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
export function ago(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
export const dateStr = (ts) => new Date(Number(ts) * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const svg = (body) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
export const ICON = {
  wallet: svg('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5z"/><circle cx="16.5" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>'),
  ext: svg('<path d="M14 5h5v5M19 5l-8 8M11 6H6v12h12v-5"/>'),
  copy: svg('<rect x="9" y="9" width="10" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  check: svg('<path d="M5 12l4 4 10-10"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  minus: svg('<path d="M6 12h12"/>'),
  plus: svg('<path d="M6 12h12M12 6v12"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  drop: svg('<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>'),
  car: svg('<path d="M3 15l2-6h14l2 6v3H3z"/><circle cx="7.5" cy="18" r="1.8" fill="currentColor" stroke="none"/><circle cx="16.5" cy="18" r="1.8" fill="currentColor" stroke="none"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
};

/**
 * A selector that finds the same control again after a re-render: its id, or for id-less
 * controls (stepper buttons, tabs, segmented buttons) its tag plus all its data-* attributes.
 */
function focusKey(a) {
  if (a.id) return `#${CSS.escape(a.id)}`;
  const attrs = [...a.attributes].filter((x) => x.name.startsWith('data-') && !/^data-(faucet-at|deadline)$/.test(x.name));
  if (!attrs.length) return null;
  return a.tagName.toLowerCase() + attrs.map((x) => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
}

/** Sets innerHTML only when it changed, and keeps keyboard focus and caret where they were. */
const htmlCache = new WeakMap();
function setHTML(el, html) {
  if (!el || htmlCache.get(el) === html) return;
  const active = document.activeElement;
  const sel = active && active !== document.body && el.contains(active) ? focusKey(active) : null;
  const keep = sel ? { sel, start: active.selectionStart, end: active.selectionEnd } : null;
  el.innerHTML = html;
  htmlCache.set(el, html);
  if (keep) {
    const again = el.querySelector(keep.sel);
    if (again) {
      again.focus({ preventScroll: true });
      try { if (keep.start != null) again.setSelectionRange(keep.start, keep.end); } catch (e) { /* not a text field */ }
    }
  }
}

// ---------- car helpers ----------

export const carById = (id) => S.data?.cars.find((c) => c.id.toString() === String(id));
export const carName = (id) => esc(S.data?.cars.find((c) => c.id === BigInt(id))?.name ?? `car ${id}`);
export const metaOf = (car) => CAR_META[String(car.id)] || {};
export const valueOf = (car) => BigInt(car.totalShares) * car.sharePrice;
export const raisedOf = (car) => BigInt(car.sold) * car.sharePrice;
export const holdersOf = (car) => car.rentPaid - car.feePaid;
/** Rent paid to holders so far as a percent of the car value. Not annualised. */
export const yieldToDate = (car) => pct(holdersOf(car), valueOf(car));
/** Gross rent range after the management fee, in percent. */
export const targetNet = (car) => (metaOf(car).gross || TERMS.gross).map((g) => (g * (100 - TERMS.fee)) / 100);
export const rangePct = (lo, hi) => `${trim(lo)}–${trim(hi)}%`;
export const pill = (kind, text) => `<span class="pill${kind ? ` ${kind}` : ''}">${esc(text)}</span>`;

/** The CarExit record of a car whose sale was recorded, else null. */
export const exitOf = (car) => S.exits[String(car.id)] || null;

export function stageOf(car) {
  const now = Math.floor(Date.now() / 1000);
  // FleetShares has no sold state: a sold car is still Active there, so CarExit decides.
  if (car.statusName === 'Active' && exitOf(car)) return { key: 'sold', pill: pill('', 'Sold') };
  if (car.statusName === 'Active') return { key: 'earning', pill: pill('ok', 'Earning') };
  if (car.statusName === 'Cancelled') return { key: 'cancelled', pill: pill('risk', 'Refunds open') };
  if (now <= Number(car.fundingDeadline)) return { key: 'funding', pill: pill('warn', 'Funding') };
  return { key: 'expired', pill: pill('risk', 'Deadline passed') };
}

// Photos that failed to load: drawn as the placeholder from then on.
const badImg = new Set();
export function photo(car, cls = '', alt) {
  const text = alt ?? car.name;
  const url = car.imageURI || '';
  if (/^https:\/\//.test(url) && !badImg.has(url)) return `<img class="${cls}" src="${esc(url)}" alt="${esc(text)}" loading="lazy" decoding="async" data-img>`;
  const label = text ? `role="img" aria-label="${esc(text)}"` : 'aria-hidden="true"';
  return `<div class="${cls} ph" ${label}>${ICON.car}</div>`;
}

export function buyAmount(car) {
  const left = car.totalShares - car.sold;
  const v = ui.buy[car.id];
  return v === undefined ? String(Math.min(5, left)) : v;
}

export const spin = (key) => (S.busy === key ? '<span class="spin" aria-hidden="true"></span>' : '');
export const off = (extra = false) => (S.busy || extra ? ' disabled' : '');

export function faucetBtn(extra = '') {
  const me = S.data?.me;
  const at = me && me.lastFaucet > 0n ? Number(me.lastFaucet) + 300 : 0;
  return `<button class="btn btn-sm ${extra}" type="button" data-act="faucet" data-faucet-at="${at}"${off()}>${S.busy === 'faucet' ? '<span class="spin" aria-hidden="true"></span>' : ICON.drop}<span data-label>Add 25M demo VND</span></button>`;
}

// ---------- toasts ----------

export function toast(title, body, state = 'pending') {
  const el = document.createElement('div');
  const box = $('#toasts');
  box.appendChild(el);
  let timer;
  const t = {
    update(p) {
      Object.assign(t, p);
      el.className = `toast is-${t.state}`;
      el.setAttribute('role', t.state === 'err' ? 'alert' : 'status');
      const icon = t.state === 'pending' ? '<span class="spin" aria-hidden="true"></span>' : t.state === 'ok' ? ICON.check : ICON.x;
      el.innerHTML = `<div class="toast-icon">${icon}</div>
        <div class="toast-text"><strong>${esc(t.title)}</strong>${t.body ? `<p>${t.html ? t.body : esc(t.body)}</p>` : ''}
        ${t.href ? `<a href="${t.href}" target="_blank" rel="noopener">View on Snowtrace ${ICON.ext}</a>` : ''}</div>
        <button class="toast-x" type="button" aria-label="Dismiss">${ICON.x}</button>`;
      $('.toast-x', el).onclick = t.close;
      clearTimeout(timer);
      if (t.state === 'ok') timer = setTimeout(t.close, 9000);
      if (t.state === 'err') timer = setTimeout(t.close, 20000);
      return t;
    },
    close() { clearTimeout(timer); el.remove(); },
  };
  return t.update({ title, body, state, href: null, html: false });
}

// ---------- errors, decoded into plain sentences ----------

const ERRORS = {
  NotManager: () => 'Only the manager can do this.',
  NotOperator: () => 'Only this car’s operator can pay its rent.',
  BadCar: () => 'The listing is incomplete. It needs an operator, a share count, a price and a funding period.',
  WrongStatus: () => 'This car is not at the right stage for that. Refresh and check its status.',
  FundingClosed: () => 'The funding deadline has passed, so this car no longer takes purchases.',
  FundingOpen: () => 'The funding deadline has not passed yet, so the sale cannot be closed.',
  NotEnoughShares: () => 'There are not enough shares available for that amount.',
  ZeroAmount: () => 'Enter an amount greater than zero.',
  NothingToClaim: () => 'There is nothing to collect right now.',
  NotSeller: () => 'Only the seller can cancel this offer.',
  TransfersLocked: () => 'Shares can only change hands after the car is fully funded.',
  FaucetCooldown: ([at]) => `The demo faucet adds 25M demo VND every 5 minutes. Try again at ${new Date(Number(at) * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`,
  ERC20InsufficientBalance: ([, bal, need]) => `Not enough demo VND. You have ${usdc(bal)} and this needs ${usdc(need)}. Use “Add 25M demo VND” first.`,
  ERC20InsufficientAllowance: () => 'The payment allowance is too low. Try again and confirm the allow step.',
  ERC1155InsufficientBalance: () => 'The seller no longer holds enough shares for this offer.',
  SafeERC20FailedOperation: () => 'The demo VND transfer failed. Check your demo VND balance and allowance.',
  ReentrancyGuardReentrantCall: () => 'The contract is busy with another call. Try again.',
  ERC1155MissingApprovalForAll: () => 'The resale contract is not allowed to take your shares yet. Try again and confirm the approval step.',
  AlreadySold: () => 'The sale of this car is already recorded. It can only be recorded once.',
  NotSold: () => 'This car’s sale has not been recorded yet, so there is nothing to redeem.',
  UnexpectedTransfer: () => 'The resale contract only accepts shares through Redeem.',
  NotAuditor: () => 'Only the auditor wallet can publish reports.',
  BadReport: () => 'The report needs a period and a document hash.',
};
// Same error names, different meaning when the CarExit add-on reverts.
const EXIT_ERRORS = {
  NotOperator: () => 'Only this car’s operator can record its sale.',
  WrongStatus: () => 'Only a funded, earning car can be recorded as sold.',
  NotEnoughShares: () => 'You do not hold that many shares of this car.',
};

/** `where` is the address of the contract that was called, when known. */
export function explain(err, where) {
  const walk = (fn) => (typeof err?.walk === 'function' ? err.walk(fn) : null);
  const code = err?.code ?? walk((e) => e?.code === 4001 || e?.code === -32002)?.code;
  const text = `${err?.shortMessage ?? ''} ${err?.details ?? ''} ${err?.message ?? ''}`;
  if (code === 4001 || /user rejected|user denied|rejected the request/i.test(text)) return 'You cancelled the request in your wallet. Nothing was sent.';
  if (code === -32002) return 'Your wallet already has a request waiting. Open the wallet to continue.';
  const rev = walk((e) => e?.name === 'ContractFunctionRevertedError');
  const name = rev?.data?.errorName;
  const say = (where && cfg?.CarExit && same(where, cfg.CarExit) && EXIT_ERRORS[name]) || ERRORS[name];
  if (name) return say ? say(rev.data.args ?? []) : `The contract refused: ${name}.`;
  if (/insufficient funds|exceeds the balance|gas required exceeds/i.test(text)) return 'Not enough test AVAX to pay for gas. Get some from the Fuji faucet, then try again.';
  if (/does not match the target chain|chain mismatch/i.test(text)) return 'Your wallet is on another network. Switch it to Avalanche Fuji and try again.';
  if (/HTTP request failed|fetch failed|timed out|network/i.test(text)) return 'Could not reach the Avalanche Fuji network. Check your connection and try again.';
  const msg = (err?.shortMessage || err?.message || String(err)).split('\n')[0];
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

// ---------- wallet ----------

// Wallets announce themselves over EIP-6963; some (Core) also inject window.ethereum a moment after load.
const discovered = []; // { provider, rdns }
window.addEventListener('eip6963:announceProvider', (e) => {
  const provider = e.detail?.provider;
  if (provider && !discovered.some((d) => d.provider === provider)) discovered.push({ provider, rdns: e.detail.info?.rdns || '' });
});
const askProviders = () => window.dispatchEvent(new Event('eip6963:requestProvider'));
askProviders();

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } },
};

/** Providers to try, best first: the wallet used last time, Core, other announced wallets, window.ethereum. */
function providers() {
  const last = store.get('fs-wallet');
  const rank = (d) => (last && d.rdns === last ? 0 : /core/i.test(d.rdns) ? 1 : 2);
  const list = [...discovered].sort((x, y) => rank(x) - rank(y)).map((d) => d.provider);
  if (window.ethereum && !list.includes(window.ethereum)) list.push(window.ethereum);
  return list;
}
const rdnsOf = (p) => discovered.find((d) => d.provider === p)?.rdns || '';

async function ensureChain() {
  const p = S.provider;
  const id = await p.request({ method: 'eth_chainId' });
  S.walletChain = parseInt(id, 16);
  if (S.walletChain === cfg.chainId) return false;
  const note = toast('Switching your wallet to Avalanche Fuji', `Your wallet is on chain ${S.walletChain}. FleetShares runs on Fuji (43113). Confirm the switch in your wallet.`);
  try {
    await switchChain(p);
    S.walletChain = cfg.chainId;
    note.update({ state: 'ok', title: 'Wallet switched to Avalanche Fuji', body: 'You are on the right network now.' });
    render();
    return true;
  } catch (e) {
    note.close();
    throw e;
  }
}

async function switchChain(p) {
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: FUJI_HEX }] });
  } catch (e) {
    if (e?.code === 4001) throw e;
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: FUJI_HEX,
        chainName: 'Avalanche Fuji Testnet',
        nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
        rpcUrls: [chain.RPC_URL],
        blockExplorerUrls: [EXPLORER],
      }],
    });
  }
}

function watchProvider(p) {
  if (p.__fleetWatched || typeof p.on !== 'function') return;
  p.__fleetWatched = true;
  p.on('accountsChanged', (accs) => {
    S.account = accs && accs[0] ? V.getAddress(accs[0]) : null;
    if (S.provider !== p) return; // another wallet in the same browser
    if (S.data) S.data.me = null;
    render();
    refresh();
  });
  p.on('chainChanged', (id) => { S.walletChain = parseInt(id, 16); render(); refresh(); });
}

/** Takes a provider and account as the connected wallet and remembers it for the next load. */
function adopt(p, account) {
  S.provider = p;
  S.account = V.getAddress(account);
  watchProvider(p);
  store.set('fs-connected', '1');
  store.set('fs-wallet', rdnsOf(p));
  store.del('fs-off');
  render();
}

async function connect() {
  askProviders();
  const p = providers()[0];
  if (!p) {
    toast('No wallet found', 'Install <a href="https://core.app/" target="_blank" rel="noopener">Core</a> or <a href="https://metamask.io/download/" target="_blank" rel="noopener">MetaMask</a>, then reload. On a phone, open this page inside the wallet app’s browser.', 'err').update({ html: true });
    return false;
  }
  try {
    const accs = await p.request({ method: 'eth_requestAccounts' });
    if (!accs || !accs[0]) return false;
    adopt(p, accs[0]);
    await ensureChain().catch((e) => toast('Your wallet is not on Avalanche Fuji yet', `${explain(e)} You can switch from the banner at the top of the page.`, 'err'));
    await refresh();
    return true;
  } catch (e) {
    toast('Could not connect', explain(e), 'err');
    return false;
  }
}

/**
 * On load: re-attach a wallet that already trusts this site, without any prompt (eth_accounts only).
 * Wallets can inject late, so keep asking for a couple of seconds. Skipped after an explicit Disconnect.
 */
async function restore() {
  if (store.get('fs-off') === '1') return false;
  const until = Date.now() + 2500;
  for (;;) {
    askProviders();
    for (const p of providers()) {
      try {
        const accs = await p.request({ method: 'eth_accounts' });
        if (accs && accs[0]) {
          if (S.account) return true; // the user connected by hand meanwhile
          adopt(p, accs[0]);
          p.request({ method: 'eth_chainId' }).then((id) => { S.walletChain = parseInt(id, 16); render(); }).catch(() => {});
          refresh();
          return true;
        }
      } catch (e) { /* this provider is not ready or refuses: try the next */ }
    }
    if (Date.now() > until || S.account) return false;
    await sleep(250);
  }
}

function disconnect() {
  S.account = null;
  S.walletChain = null;
  if (S.data) S.data.me = null;
  ui.walletOpen = false;
  store.del('fs-connected');
  store.set('fs-off', '1'); // stay disconnected across reloads until the user connects again
  render();
}

// ---------- transactions ----------

export const fleetCall = (functionName, args = []) => ({ address: cfg.FleetShares, abi: abis.fleetX, functionName, args });
export const usdcCall = (functionName, args = []) => ({ address: cfg.MockUSDC, abi: abis.usdc, functionName, args });
/** Add-on calls. Only used when fuji.json names the add-on (its ABI is loaded at boot then). */
export const exitCall = (functionName, args = []) => ({ address: cfg.CarExit, abi: abis.exitX, functionName, args });
export const auditCall = (functionName, args = []) => ({ address: cfg.AuditRegistry, abi: abis.audit, functionName, args });

/** Prepends an exact-amount USDC approval for `spender` (FleetShares unless given) when the allowance is short. */
export async function withApproval(cost, step, spender = cfg.FleetShares) {
  const [bal, allowance] = await Promise.all([
    pub.readContract(usdcCall('balanceOf', [S.account])),
    pub.readContract(usdcCall('allowance', [S.account, spender])),
  ]);
  if (bal < cost) throw new Error(`Not enough demo VND. You have ${usdc(bal)} and this needs ${usdc(cost)}. Use “Add 25M demo VND” first.`);
  const steps = [];
  if (allowance < cost) steps.push({ label: `Allow the payment of ${usdc(cost)}`, call: usdcCall('approve', [spender, cost]) });
  steps.push(step);
  return steps;
}

/**
 * Runs one or more contract calls in sequence with one toast: simulate (so reverts are decoded
 * before the wallet opens), send, wait for the receipt.
 */
export async function send(key, title, build, doneText) {
  if (S.busy) return;
  if (!S.account && !(await connect())) return;
  S.busy = key;
  render();
  const t = toast(title, 'Checking with the contract…');
  let where = null; // contract of the step in flight, so its revert reads right
  let ok = false;
  try {
    await ensureChain();
    const wallet = V.createWalletClient({ account: S.account, chain: FUJI, transport: V.custom(S.provider) });
    const steps = await build();
    let hash;
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      where = st.call.address;
      const pre = steps.length > 1 ? `Step ${i + 1} of ${steps.length}: ` : '';
      t.update({ state: 'pending', body: `${pre}${st.label}. Confirm in your wallet.`, href: null });
      let request;
      for (let attempt = 0; ; attempt++) {
        try {
          ({ request } = await pub.simulateContract({ ...st.call, account: S.account }));
          break;
        } catch (e) {
          // After an approval, a lagging RPC node may not see it yet: give it a moment.
          if (i === 0 || attempt >= 3) throw e;
          await sleep(1200);
        }
      }
      hash = await wallet.writeContract(request);
      t.update({ body: `${pre}${st.label}. Waiting for Avalanche to confirm…`, href: txUrl(hash) });
      const rc = await pub.waitForTransactionReceipt({ hash });
      if (rc.status !== 'success') throw new Error('The network reverted this transaction. Nothing changed.');
      const mine = chain.decodeLogs(rc.logs, cfg, abis, V.decodeEventLog);
      mine.forEach((e) => { e.time = Math.floor(Date.now() / 1000); });
      S.localEvents.push(...mine);
    }
    t.update({ state: 'ok', title: `${title}: done`, body: doneText, href: txUrl(hash) });
    ok = true;
    S.busy = null;
    await refresh();
    setTimeout(refresh, 2500);
    setTimeout(loadFeed, 6000);
  } catch (e) {
    const why = explain(e, where);
    // a cancel in the wallet, or a balance check we made ourselves, is not a program error
    if (!/^(You cancelled|Not enough demo VND|You hold no shares)/.test(why)) console.error(e);
    t.update({ state: 'err', title: `${title}: not done`, body: why });
  } finally {
    S.busy = null;
    render();
  }
  return ok;
}

// ---------- actions (data-act) ----------

export const ACTIONS = {
  connect: () => connect(),
  disconnect,
  retry: () => refresh(),
  switchNet: () => ensureChain().catch((e) => toast('Could not switch network', explain(e), 'err')),
  faucet: () => send('faucet', 'Add demo VND', async () => [{ label: 'Add 25M demo VND from the test faucet', call: usdcCall('faucet') }], '25M demo VND added to your wallet.'),
  step(d) {
    const car = carById(d.car);
    if (!car) return;
    const left = car.totalShares - car.sold;
    const cur = parseShares(buyAmount(car));
    ui.buy[d.car] = String(d.set === 'max' ? left : d.set ? Math.min(left, Number(d.set)) : Math.max(1, Math.min(left, cur + Number(d.d))));
    render();
  },
  buy(d) {
    const car = carById(d.car);
    const n = parseShares(buyAmount(car));
    if (n < 1) return toast('Buy shares', 'Enter how many shares you want.', 'err');
    const cost = BigInt(n) * car.sharePrice;
    send(`buy-${d.car}`, `Buy ${plural(n, 'share')} of ${car.name}`,
      () => withApproval(cost, { label: `Buy ${plural(n, 'share')} for ${usdc(cost)}`, call: fleetCall('buyShares', [car.id, n]) }),
      `You now own ${plural(n, 'more share')} of ${car.name}.`);
  },
  claim(d) {
    const car = carById(d.car);
    send(`claim-${d.car}`, `Collect rent from ${car.name}`, async () => [{ label: 'Collect your rent', call: fleetCall('claim', [car.id]) }], 'The rent is in your wallet.');
  },
  claimAll() {
    const me = S.data?.me;
    if (!me) return S.account ? undefined : connect(); // balances still loading, or no wallet yet
    const cars = S.data.cars.filter((c) => (me.claimable[c.id] ?? 0n) > 0n);
    if (!cars.length) return toast('Collect rent', 'There is nothing to collect right now.', 'err');
    const total = cars.reduce((a, c) => a + me.claimable[c.id], 0n);
    send('claimAll', 'Collect rent',
      async () => cars.map((c) => ({ label: `Collect ${usdc(me.claimable[c.id])} from ${c.name}`, call: fleetCall('claim', [c.id]) })),
      `${usdc(total)} of rent is in your wallet.`);
  },
  refund(d) {
    const car = carById(d.car);
    send(`refund-${d.car}`, `Refund for ${car.name}`, async () => [{ label: 'Take your money back', call: fleetCall('refund', [car.id]) }], 'Your money is back in your wallet.');
  },
  cancelFunding(d) {
    const car = carById(d.car);
    send(`cancel-${d.car}`, `Close the sale of ${car.name}`, async () => [{ label: 'Close the sale and open refunds', call: fleetCall('cancelFunding', [car.id]) }], 'The sale is closed. Buyers can now take their money back.');
  },
  makeOffer(d) {
    const car = carById(d.car);
    const f = ui.offer[d.car] || {};
    const n = parseShares(f.amount);
    const price = parseUsd(f.price);
    if (n < 1 || !price) return toast('Sell shares', 'Enter a share count and a price per share in VND.', 'err');
    send(`offer-${d.car}`, `Offer ${plural(n, 'share')} of ${car.name}`,
      async () => [{ label: `List ${plural(n, 'share')} at ${usdc(price)} each`, call: fleetCall('makeOffer', [car.id, n, price]) }],
      'Your offer is on the book. The shares stay with you until someone buys.');
  },
  takeOffer(d) {
    const o = S.data.offers.find((x) => x.id.toString() === d.offer);
    const n = parseShares(ui.take[d.offer] ?? String(o.fillable));
    if (n < 1) return toast('Buy from offer', 'Enter how many shares you want.', 'err');
    const cost = BigInt(n) * o.pricePerShare;
    send(`take-${d.offer}`, `Buy ${plural(n, 'share')} from offer #${d.offer}`,
      () => withApproval(cost, { label: `Buy ${plural(n, 'share')} for ${usdc(cost)}`, call: fleetCall('takeOffer', [o.id, n]) }),
      `You bought ${plural(n, 'share')}. The seller was paid directly.`);
  },
  cancelOffer(d) {
    send(`unoffer-${d.offer}`, `Cancel offer #${d.offer}`, async () => [{ label: 'Cancel your offer', call: fleetCall('cancelOffer', [BigInt(d.offer)]) }], 'Your offer is off the book.');
  },
  payRent(d) {
    const car = carById(d.car);
    const amt = parseUsd(ui.rent[d.car]);
    if (!amt) return toast('Pay rent', 'Enter the rent amount in VND, for example 7,875,000.', 'err');
    send(`rent-${d.car}`, `Pay rent for ${car.name}`,
      () => withApproval(amt, { label: `Pay ${usdc(amt)} rent`, call: fleetCall('payRent', [car.id, amt]) }),
      `${usdc(amt - amt / 10n)} went to shareholders and ${usdc(amt / 10n)} to the manager.`);
  },
  withdrawFees: () => send('fees', 'Withdraw manager fees', async () => [{ label: 'Withdraw fees', call: fleetCall('withdrawFees') }], 'Fees sent to the manager wallet.'),
  listCar() {
    const f = ui.list;
    const shares = parseShares(f.shares);
    const price = parseUsd(f.price);
    const days = Number(f.days);
    const operator = (f.operator || cfg.operator).trim();
    if (!f.name.trim()) return toast('List a car', 'Give the car a name.', 'err');
    if (!V.isAddress(operator)) return toast('List a car', 'The operator address is not a valid address.', 'err');
    if (shares < 1 || !price || !(days > 0)) return toast('List a car', 'Shares, price per share (VND) and funding days must all be greater than zero.', 'err');
    const docs = f.docs.trim();
    const docsHash = /^0x[0-9a-fA-F]{64}$/.test(docs) ? docs : V.keccak256(V.stringToHex(docs || f.name.trim()));
    send('list', `List ${f.name.trim()}`,
      async () => [{ label: `List ${shares} shares at ${usdc(price)}`, call: fleetCall('listCar', [f.name.trim(), f.image.trim(), docsHash, operator, shares, price, BigInt(Math.round(days * 86400))]) }],
      'The car is listed and open for funding.');
  },
  // ----- add-ons (only rendered when fuji.json names them) -----
  /** The operator pays in a sold car's resale money (CarExit.settle). Amount from ui.exit[carId]. */
  settleExit(d) {
    const car = carById(d.car);
    if (!car || !cfg.CarExit) return;
    const amt = parseUsd(ui.exit[d.car]);
    if (!amt) return toast('Record the sale', 'Enter the resale amount in VND, for example 385,000,000.', 'err');
    send(`exit-${d.car}`, `Record the sale of ${car.name}`,
      () => withApproval(amt, { label: `Pay in ${usdc(amt)} from the sale`, call: exitCall('settle', [car.id, amt]) }, cfg.CarExit),
      `Holders can now redeem each share for ${usdc(amt / BigInt(car.totalShares))}.`);
  },
  /** Hands every share the wallet holds of a sold car to CarExit for its part of the resale money. */
  redeem(d) {
    const car = carById(d.car);
    if (!car || !cfg.CarExit) return;
    if (!S.account) return connect();
    send(`redeem-${d.car}`, `Redeem shares of ${car.name}`, async () => {
      const [held, due, approved] = await Promise.all([
        pub.readContract(fleetCall('balanceOf', [S.account, car.id])),
        pub.readContract(exitCall('redeemable', [car.id, S.account])),
        pub.readContract(fleetCall('isApprovedForAll', [S.account, cfg.CarExit])),
      ]);
      if (held === 0n) throw new Error('You hold no shares of this car.');
      const n = Number(held);
      const steps = [];
      if (!approved) steps.push({ label: 'Allow the resale contract to take your shares', call: fleetCall('setApprovalForAll', [cfg.CarExit, true]) });
      steps.push({ label: `Hand in ${plural(n, 'share')} for ${usdc(due)}`, call: exitCall('redeem', [car.id, n]) });
      return steps;
    }, 'Your part of the sale is in your wallet. Rent you had not collected is still yours to collect.');
  },
  /** The auditor publishes a report (AuditRegistry.publish) from ui.audit. */
  publishAudit() {
    if (!cfg.AuditRegistry) return;
    const f = ui.audit;
    const period = f.period.trim(), scope = f.scope.trim(), doc = f.doc.trim();
    if (!period) return toast('Publish a report', 'Enter the period the report covers, for example 2026-Q3.', 'err');
    if (!doc) return toast('Publish a report', 'Paste the report text, or its 0x hash.', 'err');
    const hash = /^0x[0-9a-fA-F]{64}$/.test(doc) ? doc : V.keccak256(V.stringToHex(doc));
    const carId = BigInt(/^\d+$/.test(f.car) ? f.car : '0');
    send('audit', 'Publish audit report',
      async () => [{ label: `Publish the ${period} report`, call: auditCall('publish', [carId, period, scope, f.exceptions === '1', hash]) }],
      'The report is on chain. It cannot be edited or deleted.')
      .then((ok) => { if (ok) { Object.assign(ui.audit, { period: '', scope: '', exceptions: '', doc: '' }); render(); } }); // a second click must not publish it twice
  },
  /** Sets one field of the audit form from a button (the exceptions toggle). */
  auditSet(d) { ui.audit[d.k] = d.v; render(); },
  async copy(d, el) {
    try {
      await navigator.clipboard.writeText(d.v);
      el.classList.add('copied');
      setTimeout(() => el.classList.remove('copied'), 1200);
    } catch (e) { /* clipboard blocked */ }
  },
  set(d) { ui[d.k] = d.v; render(); },
  /** Opens the market on one car: offer book filtered to it, sell form set to it. Put on <a href="#/market">. */
  market(d) {
    if (d.car) { ui.mkCar = d.car; ui.mkSell = d.car; }
    if (location.hash !== '#/market') location.hash = '#/market';
    else render();
  },
};

// ---------- bindings (data-bind) ----------

// The view is only redrawn when its HTML changes, so a value that was cleaned up (a letter
// dropped, a count capped) must also be written back to the field, or the field and state drift.
const keepAs = (el, v) => { if (el.value !== v) el.value = v; return v; };

export const BINDS = {
  buy(d, el) {
    const car = carById(d.car);
    const digits = el.value.replace(/\D/g, '');
    const left = car ? car.totalShares - car.sold : Infinity;
    ui.buy[d.car] = keepAs(el, digits && Number(digits) > left ? String(left) : digits);
  },
  take(d, el) {
    const o = S.data?.offers.find((x) => x.id.toString() === d.offer);
    const digits = el.value.replace(/\D/g, '');
    ui.take[d.offer] = keepAs(el, o && digits && Number(digits) > o.fillable ? String(o.fillable) : digits);
  },
  rent(d, el) { ui.rent[d.car] = el.value; },
  offer(d, el) { (ui.offer[d.car] ||= {})[d.k] = d.k === 'amount' ? keepAs(el, el.value.replace(/\D/g, '')) : el.value; },
  list(d, el) { ui.list[d.k] = el.value; },
  exit(d, el) { ui.exit[d.car] = el.value; },
  audit(d, el) { ui.audit[d.k] = el.value; },
  ui(d, el) { ui[d.k] = el.value; },
};

// ---------- activity sentences ----------

const b = (id) => `<b>${carName(id)}</b>`;
function offerCar(offerId) {
  const o = S.data?.offers.find((x) => x.id === BigInt(offerId));
  return o ? ` of ${b(o.carId)}` : '';
}
export const FEED = {
  CarListed: (a) => ['List', `Manager listed <b>${esc(a.name)}</b>: ${a.totalShares} shares at ${usdc(a.sharePrice)}`],
  SharesBought: (a) => ['Buy', `${who(a.buyer)} bought ${plural(a.amount, 'share')} of ${b(a.carId)} for ${usdc(a.paid)}`],
  CarFunded: (a) => ['Funded', `${b(a.carId)} sold out. ${usdc(a.paidToOperator)} sent to ${who(a.operator)}`],
  FundingCancelled: (a) => ['Closed', `Sale of ${b(a.carId)} closed after its deadline. Refunds are open`],
  Refunded: (a) => ['Refund', `${who(a.buyer)} took back ${usdc(a.amount)} from ${b(a.carId)}`],
  RentPaid: (a) => ['Rent', `${who(a.payer)} paid ${usdc(a.gross)} rent for ${b(a.carId)}: ${usd(a.toHolders)} to shareholders, ${usd(a.fee)} fee`],
  RentClaimed: (a) => ['Rent', `${who(a.holder)} collected ${usdc(a.amount)} rent from ${b(a.carId)}`],
  FeesWithdrawn: (a) => ['Fee', `Manager withdrew ${usdc(a.amount)} in fees`],
  OfferMade: (a) => ['Market', `${who(a.seller)} offered ${plural(a.amount, 'share')} of ${b(a.carId)} at ${usdc(a.pricePerShare)} each (offer #${a.offerId})`],
  OfferTaken: (a) => ['Market', `${who(a.buyer)} bought ${plural(a.amount, 'share')}${offerCar(a.offerId)} from offer #${a.offerId} for ${usdc(a.paid)}`],
  IncomeReported: (a) => ['L1 → ICM', `Operator’s L1 report for ${b(a.carId)} arrived by ICM: period ${a.period}, ${plural(a.rentals, 'rental')}, ${plural(a.daysRented, 'day')}, ${usdc(a.income)} income`],
  OfferCancelled: (a) => ['Market', `Offer #${a.offerId}${offerCar(a.offerId)} was cancelled`],
};

/** FleetShares events, our own receipts and ICM deliveries, newest first. [] while loading. */
export const allEvents = () => (S.events ? chain.sortEvents([...S.events, ...S.localEvents, ...S.reports]) : []);

// ---------- router ----------

const TABS = ['income', 'audit', 'fees', 'activity', 'contracts'];
export function route() {
  let h = location.hash.replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch (e) { /* malformed escape: use it as typed */ }
  const legacy = h.match(/^car-(\d+)$/);
  if (legacy) return { name: 'car', id: legacy[1] };
  const [head, arg] = h.replace(/^\//, '').split('/');
  switch (head) {
    case 'car': return { name: 'car', id: arg ?? '' };
    case 'market': return { name: 'market' };
    case 'portfolio': return { name: 'portfolio' };
    case 'how': return { name: 'how' };
    case 'transparency': return { name: 'transparency', tab: TABS.includes(arg) ? arg : 'income' };
    default: return { name: 'vault' };
  }
}

// ---------- views and render loop ----------

const VIEWS = {};
const TITLES = { vault: 'Fleet Vault', car: 'Car', market: 'Market', transparency: 'Transparency', portfolio: 'Portfolio', how: 'How it works' };

/** fn(route) returns the HTML inside #view. opts: { needsData = true, title }. */
export function registerView(name, fn, opts = {}) {
  VIEWS[name] = { fn, opts };
  if (cfg) render();
}

function skeleton(title) {
  const kpi = '<div><p class="t-label"><span class="skel">Loading</span></p><p class="t-kpi"><span class="skel">00,000</span></p><p class="t-sm"><span class="skel">Reading the chain</span></p></div>';
  return `<div class="head"><div class="skel-head"><h1 class="t-display">${esc(title)}</h1><p class="t-body"><span class="skel">Reading the vault from Avalanche Fuji</span></p></div></div>
    <section class="kpis" aria-hidden="true">${kpi.repeat(4)}</section>`;
}

const brokenView = `<div class="note warn">${ICON.x}<span><b>This view could not be drawn.</b> Reload the page, or open another section.</span></div>`;

function renderView() {
  const el = $('#view');
  if (!el) return;
  const r = route();
  const v = VIEWS[r.name];
  let html;
  let loading = false;
  if (!v) html = brokenView;
  else if (S.data || v.opts.needsData === false) {
    try { html = v.fn(r); } catch (e) { console.error(`View "${r.name}" failed`, e); html = brokenView; }
  } else if (S.loadError) html = '';
  else { html = skeleton(v.opts.title || TITLES[r.name] || ''); loading = true; }
  el.setAttribute('aria-busy', loading ? 'true' : 'false');
  setHTML(el, html);
  const title = pageTitle(r);
  if (document.title !== title) document.title = title;
}

const TAB_TITLES = { income: 'Income vs. paid', audit: 'Documents', fees: 'Fees', activity: 'Activity', contracts: 'Contracts' };
function pageTitle(r) {
  let t = TITLES[r.name] || '';
  if (r.name === 'car') {
    const c = S.data ? carById(r.id) : null;
    t = c ? c.name : S.data ? 'Car not found' : 'Car';
  } else if (r.name === 'transparency') t = `${r.tab === 'audit' && cfg?.AuditRegistry ? 'Audit' : TAB_TITLES[r.tab] || 'Income vs. paid'} · Transparency`;
  else if (r.name === 'vault') return 'FleetShares: own a share of a rental car';
  return `${t} · FleetShares`;
}

function renderNav() {
  const r = route();
  const name = r.name === 'car' ? 'vault' : r.name;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === name;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function renderWallet() {
  const el = $('#wallet');
  if (!el) return;
  if (!S.account) {
    setHTML(el, '<button class="btn btn-sm wallet-cta" type="button" data-act="connect">Connect wallet</button>');
    return;
  }
  const me = S.data?.me;
  const role = S.data && same(S.account, S.data.manager) ? 'Manager' : S.data?.cars.some((c) => same(c.operator, S.account)) ? 'Operator' : 'Investor';
  const avax = me ? Number(V.formatEther(me.avax)).toFixed(3) : '…';
  let bal = me ? usd(me.usdc) : '…';
  setHTML(el, `<details id="wallet-menu" class="wmenu"${ui.walletOpen ? ' open' : ''}>
    <summary id="wallet-chip" class="wallet" aria-label="Wallet menu: ${esc(bal)} VND, ${short(S.account)}">${bal} VND<span class="addr">${short(S.account)}</span></summary>
    <div class="pop">
      <div class="pop-row"><span>Wallet</span><span>${who(S.account)} ${pill('', role)}</span></div>
      <div class="pop-row"><span>Demo VND</span><b>${me ? usdc(me.usdc) : '…'}</b></div>
      <div class="pop-row"><span>AVAX for gas</span><b>${avax}</b></div>
      ${faucetBtn('btn-w')}
      <a class="btn btn-sm btn-w" href="${AVAX_FAUCET}" target="_blank" rel="noopener">Get test AVAX for gas ${ICON.ext}</a>
      <button class="btn btn-sm btn-w pop-quiet" type="button" data-act="disconnect">Disconnect</button>
    </div>
  </details>`);
}

function renderNotice() {
  const el = $('#notice');
  if (!el) return;
  const note = (icon, text, action = '') => `<div class="note warn">${icon}<span>${text}</span>${action}</div>`;
  if (S.loadError && !S.data) {
    setHTML(el, note(ICON.x, `<b>Could not read the contract.</b> ${esc(S.loadError)}`, '<button class="btn btn-sm" type="button" data-act="retry">Try again</button>'));
    return;
  }
  const me = S.data?.me;
  if (S.account && S.walletChain && cfg && S.walletChain !== cfg.chainId) {
    setHTML(el, note(ICON.x, `<b>Your wallet is on another network (chain ${S.walletChain}).</b> FleetShares runs on Avalanche Fuji. Any action here switches your wallet first.`, '<button class="btn btn-sm" type="button" data-act="switchNet">Switch to Fuji</button>'));
  } else if (me && me.avax === 0n) {
    const noUsdc = me.usdc === 0n;
    setHTML(el, note(ICON.drop, `<b>You need a little test AVAX for gas.</b> It is free from the Fuji faucet.${noUsdc ? ' Then add 25M demo VND, also free.' : ''}`,
      `<span class="row"><a class="btn btn-sm" href="${AVAX_FAUCET}" target="_blank" rel="noopener">Get test AVAX ${ICON.ext}</a>${noUsdc ? faucetBtn() : ''}</span>`));
  } else if (me && me.usdc === 0n) {
    setHTML(el, note(ICON.drop, '<b>You have no demo VND yet.</b> The test faucet adds 25M every 5 minutes, free.', faucetBtn()));
  } else setHTML(el, '');
}

/** Draws the whole page from state: wallet chip, nav, notice strip and the current view. */
export function render() {
  renderNav();
  if (!V || !cfg) { // libraries not loaded (yet)
    renderNotice();
    if (S.loadError) setHTML($('#view'), '');
    return;
  }
  renderWallet();
  renderNotice();
  renderView();
  tick();
}

// Live bits that change every second without re-rendering anything else.
let expiredKey = '';
function tick() {
  const now = Math.floor(Date.now() / 1000);
  document.querySelectorAll('[data-deadline]').forEach((el) => { el.textContent = timeLeft(Number(el.dataset.deadline) - now); });
  document.querySelectorAll('[data-faucet-at]').forEach((el) => {
    const wait = Number(el.dataset.faucetAt) - now;
    const label = $('[data-label]', el);
    if (!label) return;
    if (wait > 0) { el.disabled = true; label.textContent = `Faucet ready in ${timeLeft(wait)}`; } else {
      if (!S.busy) el.disabled = false;
      label.textContent = 'Add 25M demo VND';
    }
  });
  if (S.data) {
    const key = S.data.cars.map((c) => (c.statusName === 'Funding' && now > Number(c.fundingDeadline) ? 1 : 0)).join('');
    if (key !== expiredKey) { expiredKey = key; render(); }
  }
}

// ---------- data loading ----------

let mirrorAbi = null;
async function loadLedger() {
  if (!cfg.IncomeMirror || !S.data?.cars.length) return;
  try {
    mirrorAbi ||= await fetch('abi/IncomeMirror.json').then((r) => r.json()).then((x) => (Array.isArray(x) ? x : x.abi));
    const mirror = { address: cfg.IncomeMirror, abi: mirrorAbi };
    const ids = S.data.cars.map((c) => c.id);
    const res = await pub.multicall({
      allowFailure: true,
      contracts: ids.flatMap((id) => [{ ...mirror, functionName: 'ledger', args: [id] }, { ...mirror, functionName: 'reported', args: [id] }]),
    });
    ids.forEach((id, i) => {
      const a = res[2 * i], r2 = res[2 * i + 1];
      if (a.status !== 'success' || r2.status !== 'success') return;
      const [reportedIncome, rentPaid, unpaid] = a.result;
      const [periods, rentals, daysRented] = r2.result;
      S.ledger[id] = { reportedIncome, rentPaid, unpaid, periods, rentals, daysRented };
    });
    render();
    // A new period on chain that the delivery list has not seen yet: fetch the deliveries again.
    const periods = Object.values(S.ledger).reduce((n, l) => n + Number(l.periods), 0);
    if (periods !== S.reports.length) loadReports();
  } catch (e) {
    console.warn('Operator ledger unavailable', e); // optional panel: the page works without it
  }
}

let reportsLoading = false;
async function loadReports() {
  if (reportsLoading || !cfg.IncomeMirror || !mirrorAbi) return;
  reportsLoading = true;
  try {
    S.reports = withTimes(await chain.loadReports({ client: pub, logsClient, cfg, mirrorAbi, decodeEventLog: V.decodeEventLog }));
    render();
    fillTimes().catch(() => {});
  } catch (e) {
    console.warn('ICM deliveries unavailable', e);
  } finally {
    reportsLoading = false;
  }
}

/**
 * CarExit add-on: exitOf for every Active car, and for a wallet what it can redeem per car plus whether CarExit
 * may move its shares. Folded into a fresh loadState result before it is shown, so a sold car never flickers
 * back to Earning. A failed read keeps what was known before.
 */
async function loadExits(data, account) {
  if (!cfg.CarExit || !abis.exit) return;
  const exit = { address: cfg.CarExit, abi: abis.exit };
  const active = data.cars.filter((c) => c.statusName === 'Active');
  const withMe = !!(account && data.me);
  const prevMe = S.data?.me && same(S.data.me.address, account) ? S.data.me : null;
  if (withMe) { data.me.redeemable = { ...(prevMe?.redeemable || {}) }; data.me.exitApproved = prevMe?.exitApproved ?? false; }
  if (!active.length) return;
  const contracts = active.map((c) => ({ ...exit, functionName: 'exitOf', args: [c.id] }));
  if (withMe) {
    contracts.push(
      ...active.map((c) => ({ ...exit, functionName: 'redeemable', args: [c.id, account] })),
      { address: cfg.FleetShares, abi: abis.fleet, functionName: 'isApprovedForAll', args: [account, cfg.CarExit] },
    );
  }
  try {
    const res = await pub.multicall({ allowFailure: true, contracts });
    active.forEach((c, i) => {
      const r = res[i];
      if (r.status !== 'success') return;
      if (r.result.soldAt > 0n) S.exits[String(c.id)] = r.result;
      else delete S.exits[String(c.id)];
    });
    if (withMe) {
      active.forEach((c, i) => { const r = res[active.length + i]; if (r.status === 'success') data.me.redeemable[c.id] = r.result; });
      const ap = res[2 * active.length];
      if (ap.status === 'success') data.me.exitApproved = ap.result;
    }
  } catch (e) {
    console.warn('Resale records unavailable', e); // add-on: the page works without it
  }
}

/** AuditRegistry add-on: the auditor address and every report, newest first. Re-reads reports only when the count changes. */
let auditsLoading = false;
async function loadAudits() {
  if (auditsLoading || !cfg.AuditRegistry || !abis.audit) return;
  auditsLoading = true;
  try {
    const reg = { address: cfg.AuditRegistry, abi: abis.audit };
    const [count, auditor] = await pub.multicall({ allowFailure: true, contracts: [{ ...reg, functionName: 'reportCount' }, { ...reg, functionName: 'auditor' }] });
    if (auditor.status === 'success') S.auditor = auditor.result;
    if (count.status !== 'success') throw count.error;
    const n = Number(count.result);
    if (!S.audits || S.audits.length !== n) {
      const ids = Array.from({ length: n }, (_, i) => BigInt(n - i)); // newest first
      const res = n ? await pub.multicall({ allowFailure: true, contracts: ids.map((id) => ({ ...reg, functionName: 'getReport', args: [id] })) }) : [];
      const old = new Map((S.audits || []).map((a) => [a.id, a]));
      S.audits = ids.map((id, i) => (res[i].status === 'success' ? { id, ...res[i].result } : old.get(id))).filter(Boolean);
    }
    render();
  } catch (e) {
    console.warn('Audit reports unavailable', e);
    if (!S.audits) { S.audits = []; S.auditsError = true; render(); }
  } finally {
    auditsLoading = false;
  }
}

let loading = null;
let stale = false;
async function refresh() {
  if (loading) { stale = true; return loading; } // a load is in flight: run once more after it
  loading = (async () => {
    do {
      stale = false;
      try {
        const account = S.account;
        const data = await chain.loadState(pub, cfg, abis, account);
        await loadExits(data, account);
        if (account !== S.account) { data.me = null; stale = true; } // account switched while loading
        S.data = data;
        S.loadError = null;
        loadLedger();
        loadAudits();
        const mark = markOf(data);
        if (chainMark && mark !== chainMark) loadFeed(); // something happened on chain: the feed is behind
        chainMark = mark;
      } catch (e) {
        console.error(e);
        S.loadError = explain(e);
        stale = false;
      }
      render();
    } while (stale);
    loading = null;
  })();
  return loading;
}

/**
 * Rows that came from an RPC (no timestamp): look their block times up. The 16 newest rows (the feed),
 * plus every RentPaid / RentClaimed (the rent chart needs them), capped at 40 extra blocks.
 */
async function fillTimes() {
  const all = chain.sortEvents([...(S.events || []), ...S.reports]);
  const top = all.slice(0, 16).filter((e) => !e.time);
  const rent = all.filter((e) => !e.time && (e.name === 'RentPaid' || e.name === 'RentClaimed'));
  const blocks = [...new Set(top.map((e) => e.block))];
  for (const bn of new Set(rent.map((e) => e.block))) {
    if (blocks.length >= 16 + 40) break;
    if (!blocks.includes(bn)) blocks.push(bn);
  }
  if (!blocks.length) return;
  const times = await Promise.all(blocks.map((bn) => pub.getBlock({ blockNumber: bn }).then((x) => Number(x.timestamp)).catch(() => undefined)));
  blockTimes = { ...blockTimes, ...Object.fromEntries(blocks.map((bn, i) => [bn, times[i]])) };
  [...top, ...rent].forEach((e) => { const i = blocks.indexOf(e.block); if (i >= 0) e.time = times[i]; });
  render();
}
let blockTimes = {}; // block number -> timestamp, so a reload of the feed does not lose them
const withTimes = (list) => { list.forEach((e) => { if (!e.time && blockTimes[e.block]) e.time = blockTimes[e.block]; }); return list; };

let feedLoading = null;
let feedStale = false;
function loadFeed() {
  if (feedLoading) { feedStale = true; return feedLoading; }
  feedLoading = (async () => {
    do {
      feedStale = false;
      try {
        const { events } = await chain.loadEvents({ client: pub, logsClient, cfg, abis, decodeEventLog: V.decodeEventLog });
        S.events = withTimes(events);
        S.feedError = false;
        // Our own receipts are now in the loaded set (or will be next time): keep only the ones still missing.
        const have = new Set(events.map((e) => `${e.tx}:${e.index}`));
        S.localEvents = S.localEvents.filter((e) => !have.has(`${e.tx}:${e.index}`));
        render();
        await fillTimes();
      } catch (e) {
        console.error(e);
        if (!S.events) { S.feedError = true; render(); }
      }
    } while (feedStale);
    feedLoading = null;
  })();
  return feedLoading;
}

/** Changes whenever anything that emits an event happened on chain: a cheap trigger to reload the feed. */
let chainMark = '';
function markOf(d) {
  return JSON.stringify([d.offerCount, d.feesOwed, d.cars.map((c) => [c.sold, c.status, c.rentPaid]), d.offers.map((o) => o.amount)], (k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

// ---------- document events ----------

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (ACTIONS[act]) ACTIONS[act](el.dataset, el);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  const d = el.dataset;
  if (!d || !d.bind || !BINDS[d.bind]) return;
  BINDS[d.bind](d, el);
  render();
});

document.addEventListener('toggle', (ev) => {
  if (ev.target.id === 'wallet-menu') ui.walletOpen = ev.target.open;
  if (ev.target.id === 'list-panel') ui.listOpen = ev.target.open;
}, true);

document.addEventListener('click', (ev) => {
  const menu = $('#wallet-menu');
  if (menu && menu.open && !menu.contains(ev.target)) menu.open = false;
});
document.addEventListener('keydown', (ev) => {
  const menu = $('#wallet-menu');
  if (ev.key === 'Escape' && menu && menu.open) { menu.open = false; $('summary', menu).focus(); }
});

// A photo that fails to load is drawn as the placeholder from then on.
document.addEventListener('error', (ev) => {
  const t = ev.target;
  if (!t.matches?.('img[data-img]')) return;
  const url = t.getAttribute('src');
  if (badImg.has(url)) return;
  badImg.add(url);
  render();
}, true);

window.addEventListener('hashchange', () => {
  const menu = $('#wallet-menu');
  if (menu) menu.open = false;
  render();
  window.scrollTo(0, 0);
  $('#view')?.focus({ preventScroll: true });
});

// ---------- boot ----------

export async function boot() {
  try {
    const [viem, chains, c, fleet, usdcAbi] = await Promise.all([
      import(VIEM_URL),
      import(`${VIEM_URL}/chains`),
      fetch('fuji.json').then((r) => r.json()),
      fetch('abi/FleetShares.json').then((r) => r.json()),
      fetch('abi/MockUSDC.json').then((r) => r.json()),
    ]);
    V = viem;
    FUJI = chains.avalancheFuji;
    cfg = c;
    const arr = (x) => (Array.isArray(x) ? x : x.abi);
    abis = { fleet: arr(fleet), usdc: arr(usdcAbi) };
    // Token errors bubble up through FleetShares calls: include them so they decode too.
    const known = new Set(abis.fleet.filter((x) => x.type === 'error').map((x) => x.name));
    abis.fleetX = [...abis.fleet, ...abis.usdc.filter((x) => x.type === 'error' && !known.has(x.name))];
    // Optional add-ons: their ABIs are fetched only when fuji.json names them.
    const [exitAbi, auditAbi] = await Promise.all([
      cfg.CarExit ? fetch('abi/CarExit.json').then((r) => r.json()).then(arr) : null,
      cfg.AuditRegistry ? fetch('abi/AuditRegistry.json').then((r) => r.json()).then(arr) : null,
    ]);
    if (exitAbi) {
      abis.exit = exitAbi;
      // CarExit calls FleetShares and USDC: their errors bubble up and must decode too.
      const own = new Set(exitAbi.filter((x) => x.type === 'error').map((x) => x.name));
      abis.exitX = [...exitAbi, ...abis.fleetX.filter((x) => x.type === 'error' && !own.has(x.name) && (own.add(x.name), true))];
    }
    if (auditAbi) abis.audit = auditAbi;
  } catch (e) {
    console.error(e);
    S.loadError = 'The page could not load its libraries. Check your connection and reload.';
    render();
    return;
  }
  pub = V.createPublicClient({
    chain: FUJI,
    transport: V.fallback([V.http(chain.RPC_URL), V.http(chain.LOGS_RPC_URL)]),
    pollingInterval: 1500,
  });
  logsClient = V.createPublicClient({ chain: FUJI, transport: V.http(chain.LOGS_RPC_URL) });
  render(); // skeleton for data views, full page for views that need no data

  restore(); // silent; never blocks the first render
  await refresh();
  loadFeed();

  setInterval(tick, 1000);
  setInterval(() => { if (!document.hidden && !S.busy) refresh(); }, 15000);
  setInterval(() => { if (!document.hidden) { loadFeed(); loadReports(); } }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); loadFeed(); loadReports(); } });
}
