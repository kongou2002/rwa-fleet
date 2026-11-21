// FleetShares web app. Plain ES modules, no build step.
import * as chain from './chain.js';

const VIEM_URL = 'https://esm.sh/viem@2.21.0';
const FUJI_HEX = '0xa869'; // 43113
const AVAX_FAUCET = 'https://build.avax.network/console/primary-network/faucet';
const EXPLORER = chain.EXPLORER;

let V; // viem
let FUJI; // viem chain definition
let cfg; // fuji.json
let abis; // { fleet, usdc }
let pub; // public client (reads, simulation, receipts)
let logsClient; // wide-range getLogs fallback

const S = {
  data: null, // result of chain.loadState
  events: null,
  localEvents: [], // decoded from our own receipts, shown before the indexer catches up
  account: null,
  provider: null,
  busy: null, // key of the action in flight
  loadError: null,
  reports: [], // IncomeReported deliveries on IncomeMirror, newest first
  walletChain: null, // chain id the wallet is on
  ledger: {}, // carId -> { reportedIncome, rentPaid, unpaid, periods, rentals, daysRented } from IncomeMirror
};
const ui = { buy: {}, offer: {}, take: {}, rent: {}, list: { name: '', image: '', docs: '', operator: '', shares: '100', price: '25', days: '30' }, feedAll: false, walletOpen: false, listOpen: false };

// ---------- small helpers ----------

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const txUrl = (h) => `${EXPLORER}/tx/${h}`;
const addrUrl = (a) => `${EXPLORER}/address/${a}`;
const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? '' : 's'}`;

/** USDC base units to a display string. Truncates, never rounds up. */
function usd(v, dp = 2) {
  v = BigInt(v);
  if (dp === 2 && v > 0n && v < 10000n) dp = 6; // below one cent: show it all
  let [i, f = ''] = V.formatUnits(v, 6).split('.');
  f = f.slice(0, dp).replace(/0+$/, '');
  if (f.length === 1) f += '0';
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return f ? `${i}.${f}` : i;
}
const usdc = (v) => `${usd(v)} USDC`;

function parseUsd(str) {
  const s = String(str ?? '').trim().replace(/,/g, '');
  if (!/^\d*\.?\d{0,6}$/.test(s) || s === '' || s === '.') return null;
  try { return V.parseUnits(s, 6); } catch (e) { return null; }
}
function parseShares(str) {
  const s = String(str ?? '').trim();
  if (!/^\d{1,9}$/.test(s)) return 0;
  return parseInt(s, 10);
}

function who(addr) {
  let tag = '';
  if (same(addr, S.account)) tag = 'You';
  else if (S.data && same(addr, S.data.manager)) tag = 'Manager';
  else if (S.data && S.data.cars.some((c) => same(c.operator, addr))) tag = 'Operator';
  return `<a class="addr" href="${addrUrl(addr)}" target="_blank" rel="noopener" title="${esc(addr)}">${tag ? `<b>${tag}</b> ` : ''}${short(addr)}</a>`;
}

function timeLeft(sec) {
  if (sec <= 0) return 'ended';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
function ago(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
const dateStr = (ts) => new Date(Number(ts) * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ICON = {
  wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5.5A2.500 2.500 0 0 1 3 7.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16.5" cy="13.500" r="1.300" fill="currentColor"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M11 6H6v12h12v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.500" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.500V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.500s6 6.200 6 10.500a6 6 0 0 1-12 0c0-4.300 6-10.500 6-10.500z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15l2-6h14l2 6v3H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7.500" cy="18" r="1.800" fill="currentColor"/><circle cx="16.500" cy="18" r="1.800" fill="currentColor"/></svg>',
};

/** Sets innerHTML only when it changed, and keeps keyboard focus and caret where they were. */
const htmlCache = new WeakMap();
function setHTML(el, html) {
  if (!el || htmlCache.get(el) === html) return;
  const active = document.activeElement;
  const keep = active && active.id && el.contains(active) ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
  el.innerHTML = html;
  htmlCache.set(el, html);
  if (keep) {
    const again = document.getElementById(keep.id);
    if (again) {
      again.focus({ preventScroll: true });
      try { if (keep.start != null) again.setSelectionRange(keep.start, keep.end); } catch (e) { /* not a text field */ }
    }
  }
}

// ---------- toasts ----------

function toast(title, body, state = 'pending') {
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
  FaucetCooldown: ([at]) => `The faucet gives 1,000 test USDC every 5 minutes. Try again at ${new Date(Number(at) * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`,
  ERC20InsufficientBalance: ([, bal, need]) => `Not enough USDC. You have ${usd(bal)} and this needs ${usd(need)}. Use “Get test USDC” first.`,
  ERC20InsufficientAllowance: () => 'The USDC approval is too low. Try again and confirm the approval step.',
  ERC1155InsufficientBalance: () => 'The seller no longer holds enough shares for this offer.',
  SafeERC20FailedOperation: () => 'The USDC transfer failed. Check your USDC balance and approval.',
  ReentrancyGuardReentrantCall: () => 'The contract is busy with another call. Try again.',
};

function explain(err) {
  const walk = (fn) => (typeof err?.walk === 'function' ? err.walk(fn) : null);
  const code = err?.code ?? walk((e) => e?.code === 4001 || e?.code === -32002)?.code;
  const text = `${err?.shortMessage ?? ''} ${err?.details ?? ''} ${err?.message ?? ''}`;
  if (code === 4001 || /user rejected|user denied|rejected the request/i.test(text)) return 'You cancelled the request in your wallet. Nothing was sent.';
  if (code === -32002) return 'Your wallet already has a request waiting. Open the wallet to continue.';
  const rev = walk((e) => e?.name === 'ContractFunctionRevertedError');
  const name = rev?.data?.errorName;
  if (name) return ERRORS[name] ? ERRORS[name](rev.data.args ?? []) : `The contract refused: ${name}.`;
  if (/insufficient funds|exceeds the balance|gas required exceeds/i.test(text)) return 'Not enough test AVAX to pay for gas. Get some from the Fuji faucet, then try again.';
  if (/does not match the target chain|chain mismatch/i.test(text)) return 'Your wallet is on another network. Switch it to Avalanche Fuji and try again.';
  if (/HTTP request failed|fetch failed|timed out|network/i.test(text)) return 'Could not reach the Avalanche Fuji network. Check your connection and try again.';
  const msg = (err?.shortMessage || err?.message || String(err)).split('\n')[0];
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

// ---------- wallet ----------

const discovered = [];
window.addEventListener('eip6963:announceProvider', (e) => { if (e.detail?.provider) discovered.push(e.detail.provider); });
window.dispatchEvent(new Event('eip6963:requestProvider'));
const getProvider = () => window.ethereum || discovered[0] || null;

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
    renderNotice();
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
    if (!S.account) try { localStorage.removeItem('fs-connected'); } catch (e) { /* private mode */ }
    if (S.data) S.data.me = null;
    render();
    refresh();
  });
  p.on('chainChanged', (id) => { S.walletChain = parseInt(id, 16); renderNotice(); refresh(); });
}

async function connect(silent = false) {
  const p = getProvider();
  if (!p) {
    if (!silent) {
      toast('No wallet found', 'Install <a href="https://core.app/" target="_blank" rel="noopener">Core</a> or <a href="https://metamask.io/download/" target="_blank" rel="noopener">MetaMask</a>, then reload. On a phone, open this page inside the wallet app’s browser.', 'err').update({ html: true });
    }
    return false;
  }
  try {
    const accs = await p.request({ method: silent ? 'eth_accounts' : 'eth_requestAccounts' });
    if (!accs || !accs[0]) return false;
    S.provider = p;
    S.account = V.getAddress(accs[0]);
    watchProvider(p);
    try { localStorage.setItem('fs-connected', '1'); } catch (e) { /* private mode */ }
    render();
    if (silent) p.request({ method: 'eth_chainId' }).then((id) => { S.walletChain = parseInt(id, 16); renderNotice(); }).catch(() => {});
    else await ensureChain().catch((e) => toast('Your wallet is not on Avalanche Fuji yet', `${explain(e)} You can switch from the banner at the top of the page.`, 'err'));
    await refresh();
    return true;
  } catch (e) {
    if (!silent) toast('Could not connect', explain(e), 'err');
    return false;
  }
}

function disconnect() {
  S.account = null;
  if (S.data) S.data.me = null;
  ui.walletOpen = false;
  try { localStorage.removeItem('fs-connected'); } catch (e) { /* private mode */ }
  render();
}

// ---------- transactions ----------

const fleetCall = (functionName, args = []) => ({ address: cfg.FleetShares, abi: abis.fleetX, functionName, args });
const usdcCall = (functionName, args = []) => ({ address: cfg.MockUSDC, abi: abis.usdc, functionName, args });

/** Prepends an exact-amount approval when the current allowance is short. */
async function withApproval(cost, step) {
  const [bal, allowance] = await Promise.all([
    pub.readContract(usdcCall('balanceOf', [S.account])),
    pub.readContract(usdcCall('allowance', [S.account, cfg.FleetShares])),
  ]);
  if (bal < cost) throw new Error(`Not enough USDC. You have ${usd(bal)} and this needs ${usd(cost)}. Use “Get test USDC” first.`);
  const steps = [];
  if (allowance < cost) steps.push({ label: `Approve ${usdc(cost)}`, call: usdcCall('approve', [cfg.FleetShares, cost]) });
  steps.push(step);
  return steps;
}

/**
 * Runs one or more contract calls in sequence with one toast: simulate (so reverts are decoded
 * before the wallet opens), send, wait for the receipt.
 */
async function send(key, title, build, doneText) {
  if (S.busy) return;
  if (!S.account && !(await connect())) return;
  S.busy = key;
  render();
  const t = toast(title, 'Checking with the contract…');
  try {
    await ensureChain();
    const wallet = V.createWalletClient({ account: S.account, chain: FUJI, transport: V.custom(S.provider) });
    const steps = await build();
    let hash;
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
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
    S.busy = null;
    await refresh();
    setTimeout(refresh, 2500);
    setTimeout(loadFeed, 6000);
  } catch (e) {
    console.error(e);
    t.update({ state: 'err', title: `${title}: not done`, body: explain(e) });
  } finally {
    S.busy = null;
    render();
  }
}

const ACTIONS = {
  connect: () => connect(),
  disconnect,
  switchNet: () => ensureChain().catch((e) => toast('Could not switch network', explain(e), 'err')),
  faucet: () => send('faucet', 'Get test USDC', async () => [{ label: 'Take 1,000 test USDC from the faucet', call: usdcCall('faucet') }], '1,000 test USDC added to your wallet.'),
  step(d) {
    const car = carById(d.car);
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
  refund(d) {
    const car = carById(d.car);
    send(`refund-${d.car}`, `Refund for ${car.name}`, async () => [{ label: 'Take your money back', call: fleetCall('refund', [car.id]) }], 'Your USDC is back in your wallet.');
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
    if (n < 1 || !price) return toast('Sell shares', 'Enter a share count and a price per share.', 'err');
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
    if (!amt) return toast('Pay rent', 'Enter the rent amount in USDC.', 'err');
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
    if (shares < 1 || !price || !(days > 0)) return toast('List a car', 'Shares, price and funding days must all be greater than zero.', 'err');
    const docs = f.docs.trim();
    const docsHash = /^0x[0-9a-fA-F]{64}$/.test(docs) ? docs : V.keccak256(V.stringToHex(docs || f.name.trim()));
    send('list', `List ${f.name.trim()}`,
      async () => [{ label: `List ${shares} shares at ${usdc(price)}`, call: fleetCall('listCar', [f.name.trim(), f.image.trim(), docsHash, operator, shares, price, BigInt(Math.round(days * 86400))]) }],
      'The car is listed and open for funding.');
  },
  async copy(d, el) {
    try {
      await navigator.clipboard.writeText(d.v);
      el.classList.add('copied');
      setTimeout(() => el.classList.remove('copied'), 1200);
    } catch (e) { /* clipboard blocked */ }
  },
  feedAll() { ui.feedAll = !ui.feedAll; render(); },
};

const carById = (id) => S.data.cars.find((c) => c.id.toString() === String(id));
function buyAmount(car) {
  const left = car.totalShares - car.sold;
  const v = ui.buy[car.id];
  return v === undefined ? String(Math.min(5, left)) : v;
}

// ---------- rendering ----------

function renderWallet() {
  const el = $('#wallet');
  if (!S.account) {
    setHTML(el, `<button class="btn btn-primary btn-sm" type="button" data-act="connect">${ICON.wallet}<span>Connect wallet</span></button>`);
    return;
  }
  const me = S.data?.me;
  const role = S.data && same(S.account, S.data.manager) ? 'Manager' : S.data?.cars.some((c) => same(c.operator, S.account)) ? 'Operator' : 'Investor';
  const avax = me ? Number(V.formatEther(me.avax)).toFixed(3) : '…';
  setHTML(el, `<details class="wallet" id="wallet-menu" ${ui.walletOpen ? 'open' : ''}>
    <summary class="wallet-chip" aria-label="Wallet menu">
      <i class="dot dot-ok"></i><span class="wallet-addr">${short(S.account)}</span>
      <span class="wallet-bal">${me ? usd(me.usdc) : '…'} <small>USDC</small></span>
    </summary>
    <div class="pop">
      <div class="pop-row"><span>Wallet</span><span>${who(S.account)} <em class="tag">${role}</em></span></div>
      <div class="pop-row"><span>USDC</span><b>${me ? usd(me.usdc) : '…'}</b></div>
      <div class="pop-row"><span>AVAX (gas)</span><b>${avax}</b></div>
      ${faucetBtn('btn-block')}
      <a class="btn btn-ghost btn-sm btn-block" href="${AVAX_FAUCET}" target="_blank" rel="noopener">Get test AVAX for gas ${ICON.ext}</a>
      <button class="btn btn-quiet btn-sm btn-block" type="button" data-act="disconnect">Disconnect</button>
    </div>
  </details>`);
}

function faucetBtn(extra = '') {
  const me = S.data?.me;
  const at = me && me.lastFaucet > 0n ? Number(me.lastFaucet) + 300 : 0;
  return `<button class="btn btn-secondary btn-sm ${extra}" type="button" data-act="faucet" data-faucet-at="${at}" ${S.busy ? 'disabled' : ''}>${S.busy === 'faucet' ? '<span class="spin"></span>' : ICON.drop}<span data-label>Get 1,000 test USDC</span></button>`;
}

function renderStats() {
  if (!S.data) return;
  const cars = S.data.cars;
  const raised = cars.reduce((a, c) => a + BigInt(c.sold) * c.sharePrice, 0n);
  const rent = cars.reduce((a, c) => a + c.rentPaid, 0n);
  const fees = cars.reduce((a, c) => a + c.feePaid, 0n);
  const cell = (k, v, unit) => `<div class="stat"><dt>${k}</dt><dd>${v}${unit ? ` <small>${unit}</small>` : ''}</dd></div>`;
  setHTML($('#stats'), cell('Cars listed', cars.length) + cell('Put in by investors', usd(raised), 'USDC') + cell('Rent paid in', usd(rent), 'USDC') + cell('Rent for shareholders', usd(rent - fees), 'USDC'));
}

function renderNotice() {
  const el = $('#notice');
  if (S.loadError && !S.data) {
    setHTML(el, `<div class="note note-err">${ICON.x}<div><strong>Could not read the contract.</strong> ${esc(S.loadError)} <button class="link" type="button" data-act="retry">Try again</button></div></div>`);
    return;
  }
  const me = S.data?.me;
  if (S.account && S.walletChain && S.walletChain !== cfg.chainId) {
    setHTML(el, `<div class="note">${ICON.x}<div><strong>Your wallet is on another network (chain ${S.walletChain}).</strong> FleetShares runs on Avalanche Fuji. Any action here switches your wallet first.</div><button class="btn btn-secondary btn-sm" type="button" data-act="switchNet">Switch to Fuji</button></div>`);
  } else if (me && me.avax === 0n) {
    setHTML(el, `<div class="note">${ICON.drop}<div><strong>You need a little test AVAX for gas.</strong> It is free from the Fuji faucet. <a href="${AVAX_FAUCET}" target="_blank" rel="noopener">Open the faucet ${ICON.ext}</a></div></div>`);
  } else if (me && me.usdc === 0n) {
    setHTML(el, `<div class="note">${ICON.drop}<div><strong>You have no test USDC yet.</strong> The faucet gives 1,000 every 5 minutes, free.</div>${faucetBtn()}</div>`);
  } else setHTML(el, '');
}

function renderRole() {
  const el = $('#role');
  if (!S.data || !S.account) return setHTML(el, '');
  const isManager = same(S.account, S.data.manager);
  const opCars = S.data.cars.filter((c) => same(c.operator, S.account));
  let html = '';
  if (isManager) {
    const f = ui.list;
    const field = (k, label, ph, attrs = '') => `<label class="field"><span>${label}</span><input id="list-${k}" data-bind="list" data-k="${k}" value="${esc(f[k])}" placeholder="${esc(ph)}" ${attrs} autocomplete="off"></label>`;
    html += `<section class="role" aria-label="Manager tools">
      <div class="role-head"><span class="role-tag">Manager</span><h2>Your tools</h2></div>
      <div class="role-grid">
        <div class="panel">
          <div class="panel-h"><h4>Fees ready to withdraw</h4></div>
          <p class="big">${usd(S.data.feesOwed)} <small>USDC</small></p>
          <p class="fine">10% of every rent payment. This is the only money the manager can take out.</p>
          <button class="btn btn-primary" type="button" data-act="withdrawFees" ${S.busy || S.data.feesOwed === 0n ? 'disabled' : ''}>${S.busy === 'fees' ? '<span class="spin"></span>' : ''}Withdraw fees</button>
        </div>
        <details class="panel" id="list-panel" ${ui.listOpen ? 'open' : ''}>
          <summary class="panel-h"><h4>List a new car</h4><span class="muted">Open form</span></summary>
          <div class="form-grid">
            ${field('name', 'Car name', 'Toyota Vios 2024')}
            ${field('image', 'Photo URL (https)', 'https://…')}
            ${field('docs', 'Documents: text to hash, or a 0x hash', 'Registration and rental agreement')}
            ${field('operator', 'Operator address', cfg.operator)}
            ${field('shares', 'Number of shares', '100', 'inputmode="numeric"')}
            ${field('price', 'Price per share (USDC)', '25', 'inputmode="decimal"')}
            ${field('days', 'Funding period (days)', '30', 'inputmode="decimal"')}
          </div>
          <button class="btn btn-primary" type="button" data-act="listCar" ${S.busy ? 'disabled' : ''}>${S.busy === 'list' ? '<span class="spin"></span>' : ''}List car</button>
        </details>
      </div>
    </section>`;
  }
  if (opCars.length) {
    html += `<section class="role" aria-label="Operator tools">
      <div class="role-head"><span class="role-tag">Operator</span><h2>You operate ${opCars.map((c) => `<a href="#car-${c.id}">${esc(c.name)}</a>`).join(', ')}</h2></div>
      <p class="muted">Pay rent from the “Rent” panel of each funded car. The contract splits it 90 / 10 on arrival.</p>
    </section>`;
  }
  setHTML(el, html);
}

function carView(c) {
  const id = c.id.toString();
  const me = S.data.me;
  const total = BigInt(c.totalShares) * c.sharePrice;
  const raised = BigInt(c.sold) * c.sharePrice;
  const left = c.totalShares - c.sold;
  const pct = Math.round((c.sold / c.totalShares) * 1000) / 10;
  const now = Math.floor(Date.now() / 1000);
  const st = c.statusName;
  const expired = st === 'Funding' && now > Number(c.fundingDeadline);
  const myShares = me ? Number(me.shares[c.id] ?? 0n) : 0;
  const myClaim = me ? me.claimable[c.id] ?? 0n : 0n;
  const isOperator = same(S.account, c.operator);
  const busy = S.busy ? 'disabled' : '';
  const spin = (key) => (S.busy === key ? '<span class="spin"></span>' : '');

  const badge = st === 'Active' ? ['ok', 'Funded · earning rent'] : st === 'Cancelled' ? ['bad', 'Cancelled · refunds open'] : expired ? ['warn', 'Deadline passed'] : ['fund', 'Funding open'];
  const img = /^https:\/\//.test(c.imageURI) ? `<img src="${esc(c.imageURI)}" alt="${esc(c.name)}" loading="lazy" decoding="async" data-img>` : '';
  const media = `${img}<div class="car-ph" aria-hidden="true">${ICON.car}</div>
    <span class="plate" title="Car id ${id}">FS · ${id.padStart(3, '0')}</span>
    <span class="badge badge-${badge[0]}">${badge[1]}</span>`;

  // --- funding
  let funding = `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${c.totalShares}" aria-valuenow="${c.sold}" aria-label="Shares sold"><i style="width:${pct}%" class="${st === 'Active' ? 'full' : ''}"></i></div>
    <div class="bar-legend"><span><b>${c.sold}</b> of ${c.totalShares} shares sold</span><span><b>${usd(raised)}</b> of ${usdc(total)}</span></div>`;
  if (st === 'Funding' && !expired) funding += `<p class="deadline">${ICON.clock}<span>Funding closes in <b data-deadline="${c.fundingDeadline}">…</b> <span class="muted">(${dateStr(c.fundingDeadline)})</span></span></p>`;
  if (st === 'Active') funding += `<p class="deadline ok">${ICON.check}<span>Sold out. ${usdc(total)} went to the operator in the sell-out transaction.</span></p>`;
  if (expired) funding += `<p class="deadline warn">${ICON.clock}<span>The deadline passed on ${dateStr(c.fundingDeadline)} before the car sold out.</span></p>`;
  if (st === 'Cancelled') funding += `<p class="deadline warn">${ICON.x}<span>The sale was closed without selling out. Every buyer can take their money back.</span></p>`;

  // --- main action
  let action = '';
  if (st === 'Funding' && !expired) {
    const amt = buyAmount(c);
    const n = Math.min(parseShares(amt), left);
    const cost = BigInt(n) * c.sharePrice;
    const shortBy = me && me.usdc < cost;
    action = `<div class="panel buy">
      <div class="panel-h"><h4>Buy shares</h4><span class="muted">${left} left · ${usdc(c.sharePrice)} each</span></div>
      <div class="buy-row">
        <div class="stepper">
          <button type="button" data-act="step" data-car="${id}" data-d="-1" aria-label="One share fewer">${ICON.minus}</button>
          <input id="buy-${id}" data-bind="buy" data-car="${id}" value="${esc(amt)}" inputmode="numeric" aria-label="Number of shares">
          <button type="button" data-act="step" data-car="${id}" data-d="1" aria-label="One share more">${ICON.plus}</button>
        </div>
        <div class="chips">${[1, 5, 10].filter((x) => x <= left).map((x) => `<button type="button" data-act="step" data-car="${id}" data-set="${x}">${x}</button>`).join('')}<button type="button" data-act="step" data-car="${id}" data-set="max">All ${left}</button></div>
      </div>
      <div class="cost"><span>You pay</span><strong>${usd(cost)} <small>USDC</small></strong></div>
      <div class="cost sub"><span>Your stake after</span><span>${(((myShares + n) / c.totalShares) * 100).toFixed(1).replace(/\.0$/, '')}% of the car</span></div>
      ${S.account
        ? `<button class="btn btn-primary btn-block" type="button" data-act="buy" data-car="${id}" ${busy || n < 1 ? 'disabled' : ''}>${spin(`buy-${id}`)}Buy ${plural(n, 'share')}</button>`
        : `<button class="btn btn-primary btn-block" type="button" data-act="connect">${ICON.wallet}Connect wallet to buy</button>`}
      ${shortBy ? `<p class="fine warn-text">You have ${usdc(me.usdc)}. ${faucetBtn()}</p>` : ''}
      <p class="fine">Your USDC waits in the contract until the car sells out. If it does not sell out by the deadline, you take all of it back.</p>
    </div>`;
  } else if (expired) {
    action = `<div class="panel">
      <div class="panel-h"><h4>Close the sale</h4></div>
      <p class="fine">Anyone can close a sale that missed its deadline. Closing it opens refunds for every buyer.</p>
      <button class="btn btn-primary btn-block" type="button" data-act="${S.account ? 'cancelFunding' : 'connect'}" data-car="${id}" ${busy}>${spin(`cancel-${id}`)}${S.account ? 'Close sale and open refunds' : 'Connect wallet to close the sale'}</button>
    </div>`;
  }

  // --- position
  let mine = '';
  if (S.account) {
    const stake = c.totalShares ? ((myShares / c.totalShares) * 100).toFixed(2).replace(/\.?0+$/, '') : '0';
    let btn = '';
    if (st === 'Active') btn = `<button class="btn ${myClaim > 0n ? 'btn-primary' : 'btn-secondary'} btn-block" type="button" data-act="claim" data-car="${id}" ${busy || myClaim === 0n ? 'disabled' : ''}>${spin(`claim-${id}`)}${myClaim > 0n ? `Collect ${usdc(myClaim)}` : 'No rent to collect yet'}</button>`;
    if (st === 'Cancelled') btn = `<button class="btn btn-primary btn-block" type="button" data-act="refund" data-car="${id}" ${busy || myShares === 0 ? 'disabled' : ''}>${spin(`refund-${id}`)}${myShares ? `Refund ${usdc(BigInt(myShares) * c.sharePrice)}` : 'Nothing to refund'}</button>`;
    mine = `<div class="panel mine">
      <div class="panel-h"><h4>Your position</h4>${me ? '' : '<span class="muted">Loading…</span>'}</div>
      <div class="tiles">
        <div><span>Your shares</span><b>${myShares}</b></div>
        <div><span>Your stake</span><b>${stake}%</b></div>
        <div><span>Rent to collect</span><b class="${myClaim > 0n ? 'pos' : ''}">${usd(myClaim)} <small>USDC</small></b></div>
      </div>
      ${btn}
    </div>`;
  }

  // --- rent
  const holders = c.rentPaid - c.feePaid;
  let rent = '';
  if (st === 'Active') {
    const perShare = c.accPerShare / 10n ** 18n;
    const preview = parseUsd(ui.rent[id]);
    rent = `<div class="panel">
      <div class="panel-h"><h4>Rent</h4><span class="muted">${usdc(c.rentPaid)} paid in so far</span></div>
      <div class="split" role="img" aria-label="Rent split: 90% to shareholders, 10% manager fee"><i class="split-h"></i><i class="split-f"></i></div>
      <div class="split-legend">
        <div><span class="key key-h"></span>Shareholders 90%<b>${usdc(holders)}</b></div>
        <div><span class="key key-f"></span>Manager fee 10%<b>${usdc(c.feePaid)}</b></div>
      </div>
      <p class="fine">${c.rentPaid > 0n ? `That is ${usdc(perShare)} per share so far. ` : 'No rent has been paid in yet. '}The split is done by the contract each time rent arrives.</p>
      ${isOperator ? `<div class="inline-form">
        <label class="field"><span>Rent to pay (USDC)</span><input id="rent-${id}" data-bind="rent" data-car="${id}" value="${esc(ui.rent[id] ?? '')}" placeholder="250" inputmode="decimal" autocomplete="off"></label>
        <button class="btn btn-primary" type="button" data-act="payRent" data-car="${id}" ${busy || !preview ? 'disabled' : ''}>${spin(`rent-${id}`)}Pay rent</button>
      </div>
      ${preview ? `<p class="fine">Shareholders get ${usdc(preview - preview / 10n)}. Manager gets ${usdc(preview / 10n)}.</p>` : ''}` : ''}
    </div>`;
  } else if (st === 'Funding') {
    rent = `<div class="panel panel-flat">
      <div class="panel-h"><h4>Rent</h4><span class="muted">Starts after sell-out</span></div>
      <div class="split" role="img" aria-label="Rent split: 90% to shareholders, 10% manager fee"><i class="split-h"></i><i class="split-f"></i></div>
      <div class="split-legend"><div><span class="key key-h"></span>Shareholders 90%</div><div><span class="key key-f"></span>Manager fee 10%</div></div>
    </div>`;
  }

  // --- offers
  let market = '';
  if (st === 'Active') {
    const offers = S.data.offers.filter((o) => o.carId === c.id && o.amount > 0);
    const rows = offers.map((o) => {
      const oid = o.id.toString();
      const isMine = same(o.seller, S.account);
      const qty = ui.take[oid] ?? String(o.fillable);
      const n = Math.min(parseShares(qty), o.fillable);
      let cell;
      if (isMine) cell = `<button class="btn btn-secondary btn-sm" type="button" data-act="cancelOffer" data-offer="${oid}" ${busy}>${spin(`unoffer-${oid}`)}Cancel offer</button>`;
      else if (o.fillable < 1) cell = '<span class="muted">Seller has no shares left</span>';
      else if (!S.account) cell = `<button class="btn btn-secondary btn-sm" type="button" data-act="connect">Connect to buy</button>`;
      else cell = `<div class="take"><input id="take-${oid}" data-bind="take" data-offer="${oid}" value="${esc(qty)}" inputmode="numeric" aria-label="Shares to buy from offer ${oid}">
          <button class="btn btn-primary btn-sm" type="button" data-act="takeOffer" data-offer="${oid}" ${busy || n < 1 ? 'disabled' : ''}>${spin(`take-${oid}`)}Buy for ${usd(BigInt(n) * o.pricePerShare)}</button></div>`;
      return `<tr>
        <td data-l="Offer">#${oid}</td>
        <td data-l="Seller">${who(o.seller)}</td>
        <td data-l="Shares" class="num">${o.fillable < o.amount ? `${o.fillable} <span class="muted">of ${o.amount}</span>` : o.amount}</td>
        <td data-l="Price per share" class="num">${usdc(o.pricePerShare)}</td>
        <td class="act">${cell}</td>
      </tr>`;
    }).join('');
    const f = ui.offer[id] || {};
    const sn = parseShares(f.amount), sp = parseUsd(f.price);
    market = `<div class="panel">
      <div class="panel-h"><h4>Shares for sale</h4><span class="muted">${offers.length ? plural(offers.length, 'open offer') : 'Offer book'}</span></div>
      ${offers.length ? `<table class="offers"><thead><tr><th>Offer</th><th>Seller</th><th class="num">Shares</th><th class="num">Price per share</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="empty">No shares are for sale right now. Holders can list theirs here.</p>'}
      ${myShares > 0 ? `<div class="sell">
        <h5>Sell your shares</h5>
        <div class="inline-form">
          <label class="field"><span>Shares (you hold ${myShares})</span><input id="offer-amt-${id}" data-bind="offer" data-car="${id}" data-k="amount" value="${esc(f.amount ?? '')}" placeholder="5" inputmode="numeric" autocomplete="off"></label>
          <label class="field"><span>Price per share (USDC)</span><input id="offer-price-${id}" data-bind="offer" data-car="${id}" data-k="price" value="${esc(f.price ?? '')}" placeholder="${usd(c.sharePrice)}" inputmode="decimal" autocomplete="off"></label>
          <button class="btn btn-secondary" type="button" data-act="makeOffer" data-car="${id}" ${busy || sn < 1 || sn > myShares || !sp ? 'disabled' : ''}>${spin(`offer-${id}`)}Post offer</button>
        </div>
        <p class="fine">${sn > myShares ? 'You do not hold that many shares. ' : sn && sp ? `You would receive ${usdc(BigInt(sn) * sp)} if all ${sn} sell. ` : ''}Offered shares stay in your wallet and keep earning rent for you until someone buys.</p>
      </div>` : ''}
    </div>`;
  } else if (st === 'Funding') {
    market = `<p class="fine lock">Shares become tradable on the built-in offer book once the car is fully funded.</p>`;
  }

  const facts = `<dl class="facts">
    <div><dt>Share price</dt><dd>${usdc(c.sharePrice)}</dd></div>
    <div><dt>Total value</dt><dd>${usdc(total)}</dd></div>
    <div><dt>Shares</dt><dd>${c.totalShares}</dd></div>
    <div><dt>Operator</dt><dd>${who(c.operator)}</dd></div>
    <div><dt>Documents hash</dt><dd><button class="copy" type="button" data-act="copy" data-v="${esc(c.docsHash)}" title="Copy ${esc(c.docsHash)}"><code>${c.docsHash.slice(0, 10)}…${c.docsHash.slice(-6)}</code>${ICON.copy}</button></dd></div>
    <div><dt>Funding deadline</dt><dd>${dateStr(c.fundingDeadline)}</dd></div>
  </dl>`;

  const body = `<header class="car-head">
      <h3>${esc(c.name)}</h3>
      <p class="muted">${c.totalShares} shares · ${usdc(c.sharePrice)} each · ${usdc(total)} total</p>
    </header>
    <div class="funding">${funding}</div>
    ${action}${mine}${rent}${ledgerView(c)}${market}`;
  return { media, facts, body };
}

/** What the operator reported on its own L1, next to what it actually paid here. */
function ledgerView(c) {
  const L = S.ledger[c.id];
  if (!cfg.IncomeMirror || !L) return '';
  if (c.statusName !== 'Active' && L.reportedIncome === 0n) {
    return c.statusName === 'Funding'
      ? `<div class="panel panel-flat icm-mini"><div class="panel-h"><h4>Operator ledger</h4><span class="muted">Dispatch L1 → Fuji over ICM</span></div><p class="fine">No period reported yet. Once the car is funded and rented, the operator’s rental log on its own Avalanche L1 is compared here with the rent it pays.</p></div>`
      : '';
  }
  const l1 = cfg.l1 || {};
  const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  const links = [
    l1.RentalLog && l1.explorer ? link(`${l1.explorer}/address/${l1.RentalLog}`, 'RentalLog on Dispatch') : '',
    l1.tx?.report && l1.explorer ? link(`${l1.explorer}/tx/${l1.tx.report}`, 'report sent') : '',
    cfg.tx?.icmDeliveredOnFuji ? link(txUrl(cfg.tx.icmDeliveredOnFuji), 'delivered on Fuji') : '',
    link(addrUrl(cfg.IncomeMirror), 'IncomeMirror'),
  ].filter(Boolean).join(' · ');
  const max = L.reportedIncome > L.rentPaid ? L.reportedIncome : L.rentPaid;
  const w = (v) => (max > 0n ? Math.max(2, Number((v * 1000n) / max) / 10) : 0);
  const mine = S.reports.filter((r) => r.args.carId === c.id);
  const deliveries = mine.length
    ? `<ul class="icm-rows">${mine.slice(0, 4).map((r) => `<li><span><b>Period ${r.args.period}</b> · ${plural(r.args.rentals, 'rental')} · ${plural(r.args.daysRented, 'day')} · ${usdc(r.args.income)}</span>
        <a href="${txUrl(r.tx)}" target="_blank" rel="noopener">${r.time ? ago(r.time) : 'delivery'} ${ICON.ext}</a></li>`).join('')}</ul>`
    : '';
  const body = L.reportedIncome === 0n
    ? '<p class="empty">No period reported yet. The first report from the operator’s L1 will show here.</p>'
    : `<div class="icm-bars">
        <div class="icm-bar"><div class="icm-bar-h"><span>Reported on the operator’s L1</span><b>${usd(L.reportedIncome)} <small>USDC</small></b></div><div class="meter"><i class="m-l1" style="width:${w(L.reportedIncome)}%"></i></div></div>
        <div class="icm-bar"><div class="icm-bar-h"><span>Rent paid on Fuji</span><b>${usd(L.rentPaid)} <small>USDC</small></b></div><div class="meter"><i class="m-paid" style="width:${w(L.rentPaid)}%"></i></div></div>
      </div>
      ${L.unpaid === 0n
        ? `<p class="verdict verdict-ok">${ICON.check}<span><b>Paid in full.</b> Rent paid covers everything the operator reported.</span></p>`
        : `<p class="verdict verdict-warn">${ICON.clock}<span><b>${usdc(L.unpaid)} reported but not yet paid.</b> The operator logged more income on its L1 than it has paid in here.</span></p>`}
      <div class="icm-counts"><div><b>${L.rentals}</b><span>${Number(L.rentals) === 1 ? 'rental' : 'rentals'}</span></div><div><b>${L.daysRented}</b><span>${Number(L.daysRented) === 1 ? 'day rented' : 'days rented'}</span></div><div><b>${L.periods}</b><span>${Number(L.periods) === 1 ? 'period reported' : 'periods reported'}</span></div></div>
      ${deliveries}`;
  return `<div class="panel icm">
    <div class="panel-h"><h4>Operator ledger</h4>
      <span class="route" aria-label="Dispatch L1 to Fuji C-Chain over Avalanche ICM"><em>Dispatch L1</em><i>ICM</i><em>Fuji C-Chain</em></span></div>
    ${body}
    <p class="fine">The operator logs each rental on the Dispatch L1 (chain ${l1.chainId ?? 779672}). Period totals arrive here by Avalanche ICM, so holders can compare reported income with rent actually paid. ${links}</p>
  </div>`;
}

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
      const a = res[2 * i], b = res[2 * i + 1];
      if (a.status !== 'success' || b.status !== 'success') return;
      const [reportedIncome, rentPaid, unpaid] = a.result;
      const [periods, rentals, daysRented] = b.result;
      S.ledger[id] = { reportedIncome, rentPaid, unpaid, periods, rentals, daysRented };
    });
    renderCars();
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
    S.reports = await chain.loadReports({ client: pub, logsClient, cfg, mirrorAbi, decodeEventLog: V.decodeEventLog });
    renderCars();
    renderFeed();
  } catch (e) {
    console.warn('ICM deliveries unavailable', e);
  } finally {
    reportsLoading = false;
  }
}

function renderIcm() {
  const el = $('#icm-links');
  if (!el || !cfg.IncomeMirror) return;
  const l1 = cfg.l1 || {};
  const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text} ${ICON.ext}</a>`;
  setHTML(el, [
    l1.RentalLog && l1.explorer ? a(`${l1.explorer}/address/${l1.RentalLog}`, `RentalLog on Dispatch ${short(l1.RentalLog)}`) : '',
    l1.tx?.report && l1.explorer ? a(`${l1.explorer}/tx/${l1.tx.report}`, 'Report sent from Dispatch') : '',
    cfg.tx?.icmDeliveredOnFuji ? a(txUrl(cfg.tx.icmDeliveredOnFuji), 'Delivered on Fuji by ICM') : '',
    a(addrUrl(cfg.IncomeMirror), `IncomeMirror on Fuji ${short(cfg.IncomeMirror)}`),
  ].filter(Boolean).join(''));
}

function renderCars() {
  if (!S.data) return;
  const list = $('#car-list');
  if (!S.data.cars.length) return setHTML(list, '<p class="empty">No cars are listed yet.</p>');
  if (!list.dataset.ready) { list.innerHTML = ''; list.dataset.ready = '1'; }
  // Funding cars first: they are what a visitor can act on.
  const order = [...S.data.cars].sort((a, b) => (a.statusName === 'Funding' ? 0 : 1) - (b.statusName === 'Funding' ? 0 : 1) || Number(a.id - b.id));
  order.forEach((c, i) => {
    let art = document.getElementById(`car-${c.id}`);
    if (!art) {
      art = document.createElement('article');
      art.className = 'car';
      art.id = `car-${c.id}`;
      art.innerHTML = '<div class="car-side"><div class="car-media"></div><div class="car-facts"></div></div><div class="car-body"></div>';
      list.appendChild(art);
    }
    art.style.order = i;
    const v = carView(c);
    setHTML($('.car-media', art), v.media);
    setHTML($('.car-facts', art), v.facts);
    setHTML($('.car-body', art), v.body);
  });
}

const FEED = {
  CarListed: (a) => ['List', `Manager listed <b>${esc(a.name)}</b>: ${a.totalShares} shares at ${usdc(a.sharePrice)}`],
  SharesBought: (a) => ['Buy', `${who(a.buyer)} bought ${plural(a.amount, 'share')} of ${carName(a.carId)} for ${usdc(a.paid)}`],
  CarFunded: (a) => ['Funded', `${carName(a.carId)} sold out. ${usdc(a.paidToOperator)} sent to ${who(a.operator)}`],
  FundingCancelled: (a) => ['Closed', `Sale of ${carName(a.carId)} closed after its deadline. Refunds are open`],
  Refunded: (a) => ['Refund', `${who(a.buyer)} took back ${usdc(a.amount)} from ${carName(a.carId)}`],
  RentPaid: (a) => ['Rent', `${who(a.payer)} paid ${usdc(a.gross)} rent for ${carName(a.carId)}: ${usd(a.toHolders)} to shareholders, ${usd(a.fee)} fee`],
  RentClaimed: (a) => ['Rent', `${who(a.holder)} collected ${usdc(a.amount)} rent from ${carName(a.carId)}`],
  FeesWithdrawn: (a) => ['Fee', `Manager withdrew ${usdc(a.amount)} in fees`],
  OfferMade: (a) => ['Market', `${who(a.seller)} offered ${plural(a.amount, 'share')} of ${carName(a.carId)} at ${usdc(a.pricePerShare)} each (offer #${a.offerId})`],
  OfferTaken: (a) => ['Market', `${who(a.buyer)} bought ${plural(a.amount, 'share')}${offerCar(a.offerId)} from offer #${a.offerId} for ${usdc(a.paid)}`],
  IncomeReported: (a) => ['L1 → ICM', `Operator’s L1 report for ${carName(a.carId)} arrived by ICM: period ${a.period}, ${plural(a.rentals, 'rental')}, ${plural(a.daysRented, 'day')}, ${usdc(a.income)} income`],
  OfferCancelled: (a) => ['Market', `Offer #${a.offerId}${offerCar(a.offerId)} was cancelled`],
};
const carName = (id) => `<b>${esc(S.data?.cars.find((c) => c.id === BigInt(id))?.name ?? `car ${id}`)}</b>`;
function offerCar(offerId) {
  const o = S.data?.offers.find((x) => x.id === BigInt(offerId));
  return o ? ` of ${carName(o.carId)}` : '';
}

function renderFeed() {
  const el = $('#feed');
  if (!S.events || !S.data) return;
  const all = chain.sortEvents([...S.events, ...S.localEvents, ...S.reports]);
  if (!all.length) return setHTML(el, '<p class="empty">No activity yet.</p>');
  const shown = ui.feedAll ? all : all.slice(0, 8);
  const rows = shown.map((e) => {
    const [tag, text] = FEED[e.name] ? FEED[e.name](e.args) : [e.name, e.name];
    const when = e.time ? `<time datetime="${new Date(e.time * 1000).toISOString()}" title="${dateStr(e.time)}">${ago(e.time)}</time>` : `block ${e.block}`;
    return `<li class="ev ev-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><span class="ev-tag">${tag}</span><span class="ev-text">${text}</span>
      <a class="ev-tx" href="${txUrl(e.tx)}" target="_blank" rel="noopener" aria-label="Transaction ${e.tx} on Snowtrace"><span>${when}</span>${ICON.ext}</a></li>`;
  }).join('');
  setHTML(el, `<ol class="ev-list">${rows}</ol>${all.length > 8 ? `<button class="btn btn-quiet btn-sm" type="button" data-act="feedAll">${ui.feedAll ? 'Show fewer' : `Show all ${all.length}`}</button>` : ''}`);
}

function renderContracts() {
  setHTML($('#contracts'), `Contracts on Fuji: <a href="${addrUrl(cfg.FleetShares)}" target="_blank" rel="noopener">FleetShares ${short(cfg.FleetShares)}</a> · <a href="${addrUrl(cfg.MockUSDC)}" target="_blank" rel="noopener">Test USDC ${short(cfg.MockUSDC)}</a>`);
}

function render() {
  renderWallet();
  renderStats();
  renderNotice();
  renderRole();
  renderCars();
  renderFeed();
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
    if (wait > 0) { el.disabled = true; label.textContent = `Faucet ready in ${timeLeft(wait)}`; } else {
      if (!S.busy) el.disabled = false;
      label.textContent = 'Get 1,000 test USDC';
    }
  });
  if (S.data) {
    const key = S.data.cars.map((c) => (c.statusName === 'Funding' && now > Number(c.fundingDeadline) ? 1 : 0)).join('');
    if (key !== expiredKey) { expiredKey = key; render(); }
  }
}

// ---------- data loading ----------

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
        if (account !== S.account) { data.me = null; stale = true; } // account switched while loading
        S.data = data;
        S.loadError = null;
        loadLedger();
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

async function loadFeed() {
  try {
    const { events, source } = await chain.loadEvents({ client: pub, logsClient, cfg, abis, decodeEventLog: V.decodeEventLog });
    S.events = events;
    renderFeed();
    if (source !== 'indexer') {
      // RPC logs carry no timestamps: fetch them for the rows on screen.
      const blocks = [...new Set(events.slice(0, 12).map((e) => e.block))];
      const times = await Promise.all(blocks.map((b) => pub.getBlock({ blockNumber: b }).then((x) => Number(x.timestamp)).catch(() => undefined)));
      events.forEach((e) => { const i = blocks.indexOf(e.block); if (i >= 0) e.time = times[i]; });
      htmlCache.delete($('#feed'));
      renderFeed();
    }
  } catch (e) {
    console.error(e);
    if (!S.events) setHTML($('#feed'), `<p class="empty">Could not load activity right now. <a href="${addrUrl(cfg.FleetShares)}" target="_blank" rel="noopener">See the contract on Snowtrace</a>.</p>`);
  }
}

// ---------- events ----------

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (act === 'retry') return refresh();
  if (ACTIONS[act]) ACTIONS[act](el.dataset, el);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  const d = el.dataset;
  if (!d || !d.bind) return;
  if (d.bind === 'buy') {
    const car = carById(d.car);
    const digits = el.value.replace(/\D/g, '');
    const left = car.totalShares - car.sold;
    ui.buy[d.car] = digits && Number(digits) > left ? String(left) : digits;
  }
  else if (d.bind === 'take') ui.take[d.offer] = el.value.replace(/\D/g, '');
  else if (d.bind === 'rent') ui.rent[d.car] = el.value;
  else if (d.bind === 'offer') (ui.offer[d.car] ||= {})[d.k] = d.k === 'amount' ? el.value.replace(/\D/g, '') : el.value;
  else if (d.bind === 'list') ui.list[d.k] = el.value;
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

// A photo that fails to load falls back to the drawn placeholder underneath it.
document.addEventListener('error', (ev) => { if (ev.target.matches?.('img[data-img]')) ev.target.remove(); }, true);

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('fs-theme'); } catch (e) { /* private mode */ }
  if (saved) document.documentElement.dataset.theme = saved;
  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('fs-theme', next); } catch (e) { /* private mode */ }
  });
}

// ---------- boot ----------

async function boot() {
  initTheme();
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
  } catch (e) {
    console.error(e);
    S.loadError = 'The page could not load its libraries. Check your connection and reload.';
    renderNotice();
    return;
  }
  pub = V.createPublicClient({
    chain: FUJI,
    transport: V.fallback([V.http(chain.RPC_URL), V.http(chain.LOGS_RPC_URL)]),
    pollingInterval: 1500,
  });
  logsClient = V.createPublicClient({ chain: FUJI, transport: V.http(chain.LOGS_RPC_URL) });
  renderContracts();
  renderIcm();
  renderWallet();

  let wasConnected = false;
  try { wasConnected = localStorage.getItem('fs-connected') === '1'; } catch (e) { /* private mode */ }
  await Promise.all([refresh(), wasConnected ? connect(true) : null]);
  loadFeed();

  setInterval(tick, 1000);
  setInterval(() => { if (!document.hidden && !S.busy) refresh(); }, 15000);
  setInterval(() => { if (!document.hidden) loadFeed(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

boot();
