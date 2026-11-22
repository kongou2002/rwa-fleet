// Car detail: gallery, title and stats, specs, rent split, the plan, records; sticky action card on the right.
import {
  registerView, S, ui, cfg, esc, usd, usdc, toVnd, trim, plural, same, ICON, who, txUrl, addrUrl, ago,
  parseShares, parseUsd, carById, metaOf, valueOf, holdersOf, targetNet,
  stageOf, photo, buyAmount, spin, off, faucetBtn, TERMS, exitOf,
} from '../core.js';

// Earning and sold cars were both funded and rented out; a sold car also has a CarExit record.
const onRoad = (st) => st.key === 'earning' || st.key === 'sold';
const DAY = 86400;
const day = (sec) => new Date(Number(sec) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dayShort = (sec) => new Date(Number(sec) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const shareOf = (n, total) => (total ? trim((n / total) * 100, n && (n / total) * 100 < 1 ? 2 : 1) : '0');
const daysLeft = (c) => Math.max(0, Math.ceil((Number(c.fundingDeadline) - Date.now() / 1000) / DAY));
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text} ${ICON.ext}</a>`;
/** Token base units to '₫6.25M'; full to '₫31,250,000'. */
const vnd = (v) => `₫${usd(v)}`;
const vndFull = (v) => `₫${toVnd(v).toLocaleString('en-US')}`;
/** Whole VND to '₫1.3M' / '₫1B'. */
const vShort = (n) => (n >= 1e9 ? `₫${+(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `₫${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `₫${Math.floor(n / 1e3)}k` : `₫${Math.floor(n)}`);

/**
 * Off-chain facts about each car, from the registration and the rental agreement. The chain does not hold
 * these: edit them here. City, body type and term live in core.js CAR_META. `daily` is the rental price per day in VND.
 */
const SPECS = {
  1: {
    seats: 5, daily: 1100000,
    rows: [['Model', 'Mazda CX-5 2.0 Premium'], ['Year', '2022'], ['Body', 'SUV, 5 seats'], ['Colour', 'Machine Grey'],
      ['Engine', '2.0 L Skyactiv-G petrol'], ['Range', '~650 km a tank'], ['Power', '154 hp'], ['Gearbox', '6-speed automatic'],
      ['Odometer', '38,200 km'], ['Registered', 'Hanoi, 2022']],
  },
  2: {
    seats: 5, daily: 1300000,
    rows: [['Model', 'VinFast VF 8 Eco'], ['Year', '2023'], ['Body', 'Electric SUV, 5 seats'], ['Colour', 'Brahminy White'],
      ['Battery', '87.7 kWh'], ['Range', '471 km'], ['Power', '260 kW, AWD'], ['Gearbox', 'Single-speed'],
      ['Odometer', '6,400 km'], ['Registered', 'Ho Chi Minh City, 2023']],
  },
  3: {
    seats: 5, daily: 650000,
    rows: [['Model', 'Toyota Vios 1.5 G'], ['Year', '2023'], ['Body', 'Sedan, 5 seats'], ['Colour', 'Black'],
      ['Engine', '1.5 L Dual VVT-i petrol'], ['Range', '~600 km a tank'], ['Power', '107 hp'], ['Gearbox', 'CVT automatic'],
      ['Odometer', '41,500 km'], ['Registered', 'Da Nang, 2023']],
  },
};
const specOf = (c) => SPECS[c.id.toString()] || null;

/** Estimated rent to holders per month in VND for `cost` (token units), midpoint of the agreed range after the fee. */
function estMonthly(c, cost) {
  const [lo, hi] = targetNet(c);
  return (Number(toVnd(cost)) * ((lo + hi) / 2)) / 100 / 12;
}
const round10k = (n) => Math.round(n / 10000) * 10000;

function notFound(id) {
  return `<a class="cr-back" href="#/">${ICON.back}All cars</a>
    <div class="cr-missing">${ICON.car}<p>Car not found${id ? ` (id ${esc(id)})` : ''}. It may not be listed yet.</p><a class="btn" href="#/">Back to cars</a></div>`;
}

// ---------- top: gallery, title, stats ----------

function gallery(c) {
  return `<div class="cr-gal">
    <div class="cr-g1">${photo(c, 'cr-gimg', c.name)}</div>
    <div class="cr-g2">${photo(c, 'cr-gimg', '')}</div>
    <div class="cr-g3">${photo(c, 'cr-gimg', '')}<span class="cr-gmore">+8 photos</span></div>
  </div>`;
}

function statusPill(c, st) {
  const p = (cls, t) => `<span class="cr-pill ${cls}">${t}</span>`;
  if (st.key === 'funding') { const d = daysLeft(c); return p('warn', `Open · ${d} ${d === 1 ? 'day' : 'days'} left`); }
  if (st.key === 'earning') return p('ok', 'On the road');
  if (st.key === 'sold') return p('', `Sold ${day(exitOf(c).soldAt)}`);
  if (st.key === 'expired') return p('risk', 'Deadline passed');
  return p('risk', 'Not funded · refunds open');
}

function titleBlock(c, st) {
  const m = metaOf(c);
  const sp = specOf(c);
  const sub = [m.city, m.type, sp?.seats ? `${sp.seats} seats` : null].filter(Boolean).map(esc).join(' · ');
  const stat = (v, k) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  const stats = [
    sp?.daily ? stat(vShort(sp.daily), 'rental per day') : stat(vnd(c.sharePrice), 'per share'),
    stat(m.term ? `${m.term} years` : esc(TERMS.life), 'on the road'),
    stat(vnd(valueOf(c)), 'car value'),
    stat(String(c.totalShares), 'shares'),
  ];
  return `<header class="cr-head">
    ${statusPill(c, st)}
    <h1 class="cr-h">${esc(c.name)}</h1>
    ${sub ? `<p class="cr-sub">${sub}</p>` : ''}
    <dl class="cr-stats">${stats.join('')}</dl>
  </header>`;
}

// ---------- left column ----------

function specsCard(c) {
  const sp = specOf(c);
  const h = c.docsHash || '';
  const rows = [
    ...(sp ? sp.rows : [['Model', esc(c.name)]]),
    ['Insurance', 'Full cover, paid by operator'],
    ['Servicing', 'Operator, every 12,000 km'],
  ].map(([k, v]) => [k, esc(v)]);
  rows.push(['Operator', `${esc(TERMS.operator)} · ${who(c.operator)}`]);
  if (h) rows.push(['Documents', `<button class="cr-copy" type="button" data-act="copy" data-v="${esc(h)}" aria-label="Copy document hash ${esc(h)}" title="${esc(h)}"><span class="t-addr">${esc(h.slice(0, 6))}…${esc(h.slice(-4))}</span>${ICON.copy}</button>`]);
  return `<section class="cr-sec">
    <h2 class="cr-h2">Specs</h2>
    <dl class="cr-specs">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </section>`;
}

function splitCard() {
  const fee = TERMS.fee, hold = 100 - fee;
  return `<section class="cr-sec">
    <h2 class="cr-h2">Where the rent goes</h2>
    <div class="cr-split" role="img" aria-label="${hold}% to owners, ${fee}% fee">
      <div class="h" style="flex:${hold}"><b>${hold}%</b> to owners</div><div class="f" style="flex:${Math.max(fee, 12)}">${fee}% fee</div>
    </div>
  </section>`;
}

function planCard(c, st) {
  const m = metaOf(c);
  const ex = exitOf(c);
  const now = ex ? 3 : onRoad(st) ? 2 : 0; // index of the current step
  const steps = [
    onRoad(st) ? ['Funded', `All ${c.totalShares} shares sold`]
      : [st.key === 'funding' ? 'Now' : 'Funding', st.key === 'cancelled' ? 'Not funded · refunds' : `Funding · ${c.sold} of ${c.totalShares}`],
    [`When share ${c.totalShares} sells`, 'On the road. Rent starts'],
    ['Every month', 'Rent paid to owners'],
    [`After ${m.term ? `${m.term} years` : esc(TERMS.life)}`, ex ? `Car sold for ${vnd(ex.proceeds)}` : 'Car sold, money back'],
  ];
  const cls = (i) => (st.key === 'cancelled' ? (i === 0 ? 'now x' : '') : i < now ? 'done' : i === now ? 'now' : '');
  const foot = st.key === 'funding' || st.key === 'expired'
    ? `<p class="cr-foot">Not sold out by ${day(c.fundingDeadline)}? The sale closes and everyone gets a full refund.</p>`
    : st.key === 'cancelled' ? '<p class="cr-foot">The sale closed before it sold out. Every buyer can take their money back.</p>'
      : ex ? `<p class="cr-foot">Sold on ${day(ex.soldAt)}. All of the sale money goes to owners, no fee.</p>` : '';
  return `<section class="cr-sec">
    <h2 class="cr-h2">The plan</h2>
    <ol class="cr-plan">${steps.map(([k, v], i) => `<li class="${cls(i)}"><i aria-hidden="true"></i><p class="k">${k}</p><p class="v">${v}</p></li>`).join('')}</ol>
    ${foot}
  </section>`;
}

function recordsCard(c, st) {
  if (!onRoad(st)) return '';
  const L = S.ledger?.[c.id];
  const l1 = cfg.l1 || {};
  const mine = (S.reports || []).filter((r) => r.args.carId?.toString() === c.id.toString());
  const l1Ref = (kind, v, text) => (l1.explorer ? ext(`${l1.explorer}/${kind}/${v}`, text)
    : `<span>${text} <button class="cr-copy" type="button" data-act="copy" data-v="${esc(v)}" aria-label="Copy ${esc(text)} ${esc(v)}" title="${esc(v)}"><span class="t-addr">${esc(v.slice(0, 6))}…${esc(v.slice(-4))}</span>${ICON.copy}</button></span>`);
  const links = [
    l1.RentalLog ? l1Ref('address', l1.RentalLog, 'Rental log') : '',
    cfg.IncomeMirror ? ext(addrUrl(cfg.IncomeMirror), 'IncomeMirror') : '',
  ].filter(Boolean);
  const hasData = cfg.IncomeMirror && L && (L.reportedIncome > 0n || Number(L.periods) > 0 || mine.length);
  if (!hasData) {
    return `<section class="cr-sec"><h2 class="cr-h2">Records</h2><p class="cr-foot">No month reported yet.</p></section>`;
  }
  const paid = L.rentPaid > L.reportedIncome ? L.reportedIncome : L.rentPaid;
  const w = L.reportedIncome > 0n ? Number((paid * 1000n) / L.reportedIncome) / 10 : 100;
  const rows = mine.slice(0, 6).map((r) => `<li>
      <span>Period ${esc(String(r.args.period))} <span class="ink-3">· ${plural(r.args.rentals, 'trip')} · ${plural(r.args.daysRented, 'day')}</span></span>
      <span class="cr-dl-r"><b>${vnd(r.args.income)}</b> <a href="${txUrl(r.tx)}" target="_blank" rel="noopener" aria-label="Delivery transaction">${r.time ? ago(Number(r.time)) : 'tx'} ${ICON.ext}</a></span>
    </li>`).join('');
  return `<section class="cr-sec">
    <div class="cr-sec-h"><h2 class="cr-h2">Records</h2><a class="cr-link" href="#/transparency">All records ${ICON.arrow}</a></div>
    <div class="cr-rec-n">
      <div><span>Reported</span><b>${vnd(L.reportedIncome)}</b></div>
      <div><span>Paid in</span><b class="pos">${vnd(L.rentPaid)}</b></div>
      <div><span>Not paid</span><b class="${L.unpaid > 0n ? 'cr-red' : ''}">${vnd(L.unpaid)}</b></div>
    </div>
    <div class="cr-two-bar" role="img" aria-label="${w}% of reported rent paid in"><i style="width:${w}%"></i></div>
    ${rows ? `<ul class="cr-dl">${rows}</ul>` : ''}
    ${links.length ? `<p class="cr-links">${links.join('')}</p>` : ''}
  </section>`;
}

// ---------- aside: action cards ----------

const connectBtn = (label) => `<button class="btn btn-p cr-cta" type="button" data-act="connect">${ICON.wallet}${label}</button>`;
const loadingMe = '<p class="skel">Loading your position</p>';
const priceHead = (c) => `<p class="cr-price"><b>${vnd(c.sharePrice)}</b> <span>/ share</span></p>`;

function progress(c, st) {
  const w = onRoad(st) ? 100 : c.totalShares ? Math.round((c.sold / c.totalShares) * 1000) / 10 : 0;
  const right = st.key === 'funding' ? `<span data-cr-days>${daysLeft(c)} ${daysLeft(c) === 1 ? 'day' : 'days'} left</span>`
    : st.key === 'expired' ? '<span class="cr-red">Deadline passed</span>' : onRoad(st) ? '<span>Fully funded</span>' : '<span>Closed</span>';
  return `<div class="cr-prog">
    <div class="cr-bar${onRoad(st) ? ' full' : ''}" role="progressbar" aria-label="Shares sold" aria-valuemin="0" aria-valuemax="${c.totalShares}" aria-valuenow="${c.sold}"><i style="width:${w}%"></i></div>
    <div class="cr-prog-l"><span><b>${c.sold}</b> of ${c.totalShares} sold</span>${right}</div>
  </div>`;
}

function buyCard(c, st, myShares) {
  const id = c.id.toString();
  const me = S.data.me;
  const left = c.totalShares - c.sold;
  const amt = buyAmount(c);
  const n = Math.min(parseShares(amt), left);
  const cost = BigInt(n) * c.sharePrice;
  const chips = [1, 5, 10, 25].filter((x) => x <= left);
  const short = S.account && me && me.usdc < cost;
  const monthly = round10k(estMonthly(c, cost));
  return `<section class="cr-card">
    ${priceHead(c)}
    ${progress(c, st)}
    <div class="cr-qty">
      <label for="buy-${id}">Shares</label>
      <div class="cr-step">
        <button type="button" data-act="step" data-car="${id}" data-d="-1" aria-label="One share fewer"${n <= 1 ? ' disabled' : ''}>${ICON.minus}</button>
        <input id="buy-${id}" data-bind="buy" data-car="${id}" value="${esc(amt)}" inputmode="numeric" autocomplete="off" aria-label="Shares to buy">
        <button type="button" data-act="step" data-car="${id}" data-d="1" aria-label="One share more"${n >= left ? ' disabled' : ''}>${ICON.plus}</button>
      </div>
    </div>
    <div class="cr-chips">${chips.map((v) => `<button class="chip${n === v ? ' on' : ''}" type="button" aria-pressed="${n === v}" data-act="step" data-car="${id}" data-set="${v}">${v}</button>`).join('')}${left > 25 || !chips.includes(left) ? `<button class="chip${n === left && !chips.includes(left) ? ' on' : ''}" type="button" aria-pressed="${n === left}" data-act="step" data-car="${id}" data-set="max">All ${left}</button>` : ''}</div>
    <dl class="cr-rows">
      <div><dt>You pay</dt><dd>${vndFull(cost)}</dd></div>
      <div><dt>You earn, once on the road</dt><dd class="pos">~₫${monthly.toLocaleString('en-US')} / month</dd></div>
      <div><dt>You own</dt><dd>${shareOf(myShares + n, c.totalShares)}% of the car</dd></div>
    </dl>
    ${S.account
      ? `<button class="btn btn-p cr-cta hide-phone" type="button" data-act="buy" data-car="${id}"${off(n < 1)}>${spin(`buy-${id}`)}Buy ${plural(n, 'share')}</button>`
      : `<span class="hide-phone">${connectBtn('Log in to buy')}</span>`}
    ${short ? `<div class="cr-short"><p class="t-sm warn-t">You have ${usdc(me.usdc)}, ${usdc(cost - me.usdc)} short.</p>${faucetBtn('btn-w')}</div>` : ''}
    ${myShares ? `<p class="cr-mine">You already own ${plural(myShares, 'share')} · ${vnd(BigInt(myShares) * c.sharePrice)} held safely</p>` : ''}
    <p class="cr-safe">${ICON.shield}Full refund if not funded by ${dayShort(c.fundingDeadline)}</p>
  </section>`;
}

function rowsDl(pairs) {
  return `<dl class="cr-rows">${pairs.map(([k, v, cls = '']) => `<div><dt>${k}</dt><dd class="${cls}">${v}</dd></div>`).join('')}</dl>`;
}

function actionArea(c, st, myShares, myClaim) {
  const id = c.id.toString();
  if (st.key === 'funding') return buyCard(c, st, myShares);
  if (st.key === 'expired') {
    return `<section class="cr-card">
      ${priceHead(c)}${progress(c, st)}
      <p class="cr-note">The deadline passed before the car sold out. Anyone can close the sale, which opens refunds for every buyer.</p>
      ${S.account && S.data.me && myShares ? rowsDl([['In escrow for you', vndFull(BigInt(myShares) * c.sharePrice)]]) : ''}
      <button class="btn btn-p cr-cta" type="button" data-act="${S.account ? 'cancelFunding' : 'connect'}" data-car="${id}"${off()}>${spin(`cancel-${id}`)}${S.account ? 'Close sale and open refunds' : 'Log in to close the sale'}</button>
    </section>`;
  }
  if (st.key === 'cancelled') {
    let body;
    if (!S.account) body = connectBtn('Log in to see your refund');
    else if (!S.data.me) body = loadingMe;
    else body = `${rowsDl([['Your shares', myShares], ['Refund due', vndFull(BigInt(myShares) * c.sharePrice)]])}
      <button class="btn btn-p cr-cta" type="button" data-act="refund" data-car="${id}"${off(myShares === 0)}>${spin(`refund-${id}`)}${myShares ? `Refund ${vnd(BigInt(myShares) * c.sharePrice)}` : 'Nothing to refund'}</button>`;
    return `<section class="cr-card"><h2 class="cr-card-h">Full refund</h2><p class="cr-note">The sale closed without selling out.</p>${body}</section>`;
  }
  if (st.key === 'sold') {
    const due = S.data.me?.redeemable?.[c.id] ?? 0n;
    let pos;
    if (!S.account) pos = connectBtn('Log in to redeem');
    else if (!S.data.me) pos = loadingMe;
    else {
      pos = `${rowsDl([['Your shares', myShares], ['Redeems for', vndFull(due), due > 0n ? 'pos' : ''], ['Rent to collect', vndFull(myClaim), myClaim > 0n ? 'pos' : '']])}
      <button class="btn ${myShares ? 'btn-p' : ''} cr-cta" type="button" data-act="redeem" data-car="${id}"${off(!myShares)}>${spin(`redeem-${id}`)}${myShares ? `Redeem ${plural(myShares, 'share')} for ${vnd(due)}` : 'No shares to redeem'}</button>
      ${myClaim > 0n ? `<button class="btn cr-cta2" type="button" data-act="claim" data-car="${id}"${off()}>${spin(`claim-${id}`)}Collect ${vnd(myClaim)} rent</button>` : ''}`;
    }
    return `<section class="cr-card">
      <p class="cr-price"><b>${vnd(exitOf(c).proceeds / BigInt(exitOf(c).totalShares))}</b> <span>/ share at sale</span></p>
      ${pos}
    </section>
    ${saleCard(c)}
    ${rentCard(c, true)}`;
  }
  // earning
  const perShare = c.accPerShare / 10n ** 18n;
  const resell = (label, p = false) => `<a class="btn ${p ? 'btn-p' : ''} cr-cta2" href="#/market" data-act="market" data-car="${id}">${label}</a>`;
  let pos;
  if (!S.account) pos = `${connectBtn('Log in to collect rent')}${resell('Buy on Resell')}`;
  else if (!S.data.me) pos = loadingMe;
  else {
    pos = `${rowsDl([['Your shares', `${myShares}${myShares ? ` · ${shareOf(myShares, c.totalShares)}%` : ''}`], ['Ready to collect', vndFull(myClaim), myClaim > 0n ? 'pos' : '']])}
      <button class="btn ${myClaim > 0n ? 'btn-p' : ''} cr-cta" type="button" data-act="claim" data-car="${id}"${off(myClaim === 0n)}>${spin(`claim-${id}`)}${myClaim > 0n ? `Collect ${vnd(myClaim)}` : 'No rent to collect yet'}</button>
      ${resell(myShares ? 'Resell your shares' : 'Buy on Resell')}`;
  }
  return `<section class="cr-card">
    <p class="cr-price"><b class="pos">${vnd(perShare)}</b> <span>rent paid per share</span></p>
    ${progress(c, st)}
    ${pos}
  </section>
  ${offersCard(c)}
  ${rentCard(c)}
  ${saleForm(c)}`;
}

// A sold car: what the sale brought in and how much of it holders have taken. CarExit add-on.
function saleCard(c) {
  const ex = exitOf(c);
  return `<section class="cr-card cr-card-sm">
    <h2 class="cr-card-h">Sale</h2>
    ${rowsDl([['Sold for', vnd(ex.proceeds)], ['Shares redeemed', `${ex.redeemedShares} of ${ex.totalShares}`], ['Paid to owners', vnd(ex.paidOut)], ['Still to redeem', vnd(ex.proceeds - ex.paidOut)]])}
  </section>`;
}

// The operator of an earning car records its sale and pays the money in. CarExit add-on.
function saleForm(c) {
  if (!cfg.CarExit || !same(S.account, c.operator)) return '';
  const id = c.id.toString();
  const amt = parseUsd(ui.exit?.[id]);
  const r = metaOf(c).resale;
  const est = r ? (valueOf(c) * BigInt(Math.round(r * 100))) / 10000n : null;
  return `<section class="cr-card cr-card-sm">
    <h2 class="cr-card-h">Record the sale</h2>
    <p class="cr-note">Once the car is sold, pay the money in here. Owners redeem their shares for it.</p>
    <div class="field"><label for="exit-${id}">Resale amount</label>
      <div class="input-suffix"><input class="input" id="exit-${id}" data-bind="exit" data-car="${id}" value="${esc(ui.exit?.[id] ?? '')}" placeholder="${est ? toVnd(est).toLocaleString('en-US') : '385,000,000'}" inputmode="decimal" autocomplete="off"><span>VND</span></div></div>
    ${amt ? `<p class="t-sm ink-2">Each of the ${c.totalShares} shares receives ${usdc(amt / BigInt(c.totalShares))}.</p>` : '<p class="t-sm ink-3">Paid from this wallet. Only once.</p>'}
    <button class="btn btn-p cr-cta2" type="button" data-act="settleExit" data-car="${id}"${off(!amt)}>${spin(`exit-${id}`)}Record the sale</button>
  </section>`;
}

// Open offers for this car: re-trading between holders, as on the Resell page.
function offersCard(c) {
  const id = c.id.toString();
  const open = S.data.offers.filter((o) => o.amount > 0 && o.carId === c.id);
  if (!open.length) return '';
  const rows = open.slice(0, 4).map((o) => {
    const oid = o.id.toString();
    let btn;
    if (same(o.seller, S.account)) btn = `<button class="btn btn-sm" type="button" data-act="cancelOffer" data-offer="${oid}"${off()}>${spin(`unoffer-${oid}`)}Remove</button>`;
    else if (o.fillable < 1) btn = '<span class="t-sm ink-3">Sold out</span>';
    else if (!S.account) btn = '<button class="btn btn-sm" type="button" data-act="connect">Log in</button>';
    else {
      const n = Math.min(parseShares(ui.take[oid] ?? String(o.fillable)), o.fillable);
      btn = `<button class="btn btn-sm" type="button" data-act="takeOffer" data-offer="${oid}"${off(n < 1)}>${spin(`take-${oid}`)}Buy ${vnd(BigInt(n) * o.pricePerShare)}</button>`;
    }
    return `<li><span><b>${plural(o.fillable, 'share')}</b> <span class="ink-3">at ${vnd(o.pricePerShare)}</span></span>${btn}</li>`;
  }).join('');
  return `<section class="cr-card cr-card-sm">
    <h2 class="cr-card-h">For sale by owners</h2>
    <ul class="cr-offers">${rows}</ul>
    <a class="cr-link" href="#/market" data-act="market" data-car="${id}">${open.length > 4 ? `All ${open.length} offers` : 'Open Resell'} ${ICON.arrow}</a>
  </section>`;
}

function rentCard(c, sold = false) {
  const id = c.id.toString();
  const operator = !sold && same(S.account, c.operator);
  const fee = TERMS.fee;
  let pay = '';
  if (operator) {
    const preview = parseUsd(ui.rent?.[id]);
    const feePart = preview ? (preview * BigInt(fee)) / 100n : 0n;
    pay = `<div class="field"><label for="rent-${id}">Rent to pay</label>
        <div class="input-suffix"><input class="input" id="rent-${id}" data-bind="rent" data-car="${id}" value="${esc(ui.rent?.[id] ?? '')}" placeholder="7,875,000" inputmode="decimal" autocomplete="off"><span>VND</span></div></div>
      ${preview ? `<p class="t-sm ink-2">Owners get ${usdc(preview - feePart)}. Manager gets ${usdc(feePart)}.</p>` : '<p class="t-sm ink-3">You operate this car. The contract splits rent on arrival.</p>'}
      <button class="btn btn-p cr-cta2" type="button" data-act="payRent" data-car="${id}"${off(!preview)}>${spin(`rent-${id}`)}Pay rent</button>`;
  }
  return `<section class="cr-card cr-card-sm">
    <h2 class="cr-card-h">Rent</h2>
    ${rowsDl([['Paid in', vnd(c.rentPaid)], ['To owners', vnd(holdersOf(c)), 'pos'], [`${fee}% fee`, vnd(c.feePaid)]])}
    ${pay}
  </section>`;
}

function buyBar(c) {
  const id = c.id.toString();
  const n = Math.min(parseShares(buyAmount(c)), c.totalShares - c.sold);
  const cost = BigInt(n) * c.sharePrice;
  return `<div class="buybar cr-buybar">
    <div class="cr-bb-l"><b>${vnd(c.sharePrice)}</b> <span>/ share</span><small>${plural(n, 'share')} · ${vnd(cost)}</small></div>
    ${S.account
      ? `<button class="btn btn-p" type="button" data-act="buy" data-car="${id}"${off(n < 1)}>${spin(`buy-${id}`)}Buy</button>`
      : '<button class="btn btn-p" type="button" data-act="connect">Log in to buy</button>'}
  </div>`;
}

registerView('car', (r) => {
  const c = r.id != null ? carById(r.id) : null;
  if (!c) return notFound(r.id);
  const st = stageOf(c);
  const me = S.data.me;
  const myShares = me ? Number(me.shares?.[c.id] ?? 0n) : 0;
  const myClaim = me ? me.claimable?.[c.id] ?? 0n : 0n;
  return `<div class="cr-page${st.key === 'funding' ? ' cr-has-bar' : ''}">
    <a class="cr-back" href="#/">${ICON.back}All cars</a>
    <div class="cr-grid">
      <div class="cr-main">
        ${gallery(c)}
        ${titleBlock(c, st)}
        ${specsCard(c)}
        ${splitCard()}
        ${planCard(c, st)}
        ${recordsCard(c, st)}
      </div>
      <aside class="cr-aside">${actionArea(c, st, myShares, myClaim)}</aside>
    </div>
    ${st.key === 'funding' ? buyBar(c) : ''}
  </div>`;
});
