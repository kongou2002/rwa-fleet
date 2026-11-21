// Car detail: photo, life, details, income reports; aside with stats and the action card.
import {
  registerView, S, ui, cfg, esc, usd, usdc, fig, num, trim, plural, same, ICON, who, txUrl, addrUrl, ago,
  dateStr, parseShares, parseUsd, carById, metaOf, valueOf, raisedOf, holdersOf, yieldToDate, targetNet,
  rangePct, stageOf, pill, photo, buyAmount, spin, off, faucetBtn, allEvents, TERMS, exitOf,
} from '../core.js';

// Earning and sold cars were both funded and rented out; a sold car also has a CarExit record.
const onRoad = (st) => st.key === 'earning' || st.key === 'sold';

const day = (sec) => new Date(Number(sec) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const whole = (n) => Math.round(n).toLocaleString('en-US');
const shareOf = (n, total) => (total ? trim((n / total) * 100, n && (n / total) * 100 < 1 ? 2 : 1) : '0');
const resaleOf = (c, base) => {
  const r = metaOf(c).resale;
  return r ? (base * BigInt(Math.round(r * 100))) / 10000n : null;
};
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text} ${ICON.ext}</a>`;

function notFound(id) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Vault</a><span aria-hidden="true">/</span><span class="cd-now">Not found</span></nav>
    <div class="card pad empty cd-missing">${ICON.car}<p class="t-sm ink-3">Car not found${id ? ` (id ${esc(id)})` : ''}. It may not be listed yet.</p><a class="btn btn-sm" href="#/">Back to the vault</a></div>`;
}

// ---------- left column ----------

function lifeCard(c, st) {
  const m = metaOf(c);
  const funded = onRoad(st);
  const ex = exitOf(c);
  const filled = ex ? 4 : funded ? 3 : 1;
  const paidOut = allEvents().find((e) => e.name === 'CarFunded' && e.args.carId?.toString() === c.id.toString());
  const toOperator = paidOut ? paidOut.args.paidToOperator : valueOf(c);
  const resale = resaleOf(c, valueOf(c));
  const fundLine = { funding: `Closes ${day(c.fundingDeadline)}`, expired: `Deadline passed ${day(c.fundingDeadline)}`, earning: 'Sold out', sold: 'Sold out', cancelled: 'Closed · refunds open' }[st.key];
  const steps = [
    ['Funding', fundLine],
    ['Sell-out', funded ? `${usd(toOperator)} USDC paid to the operator` : `${esc(TERMS.operator)} buys the car`],
    [m.term ? `Years 1–${m.term}` : 'Rental years', ex ? `${usd(c.rentPaid)} USDC rent paid in` : funded ? `${usd(c.rentPaid)} USDC rent so far` : 'Rent paid monthly'],
    ['Resale', ex ? `Sold · ${usd(ex.proceeds)} USDC<br><span class="ink-3">${day(ex.soldAt)}</span>` : resale !== null ? `Est. ${usd(resale)} USDC at the end of the term` : 'Sold at the end of the term'],
  ];
  const sub = ex
    ? `Sold on ${day(ex.soldAt)}. Every USDC of the sale goes to holders, with no fee.`
    : `Rented out for ${m.term ? `${m.term} years` : esc(TERMS.life)}, then sold. The resale goes to holders.`;
  return `<section class="card pad">
    <div class="card-h cd-tight"><div><h2 class="t-title">Car life</h2><p class="t-sm ink-3">${sub}</p></div></div>
    <div class="cd-life" role="img" aria-label="Stage ${filled} of 4${st.key === 'cancelled' ? ', sale cancelled' : ''}">${steps.map((_, i) => `<i class="${i < filled ? (st.key === 'cancelled' ? 'x' : 'on') : ''}"></i>`).join('')}</div>
    <ol class="cd-life-l">${steps.map(([k, v], i) => `<li class="${i === filled - 1 ? 'now' : ''}"><p class="t-label">${k}</p><p class="t-sm">${v}</p></li>`).join('')}</ol>
  </section>`;
}

function detailsCard(c) {
  const m = metaOf(c);
  const h = c.docsHash || '';
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  const left = [
    row('Model', esc(c.name)),
    m.type ? row('Type', esc(m.type)) : '',
    m.city ? row('City', esc(m.city)) : '',
    row('Operator', `${esc(TERMS.operator)} · ${who(c.operator)}`),
  ].join('');
  const right = [
    row('Shares', `${c.totalShares} × ${usd(c.sharePrice)} USDC`),
    m.gross ? row('Gross rent agreed', `${m.gross[0]}–${m.gross[1]}% a year`) : '',
    m.resale ? row('Resale estimate', `${m.resale}% of price`) : '',
    h ? row('Legal documents', `<button class="cd-copy" type="button" data-act="copy" data-v="${esc(h)}" aria-label="Copy document hash ${esc(h)}" title="${esc(h)}"><span class="t-addr">${esc(h.slice(0, 6))}…${esc(h.slice(-4))}</span>${ICON.copy}</button>`) : '',
    row('Funding deadline', esc(dateStr(c.fundingDeadline))),
  ].join('');
  return `<section class="card pad">
    <h2 class="t-title cd-mb">Details</h2>
    <div class="cd-kv2"><dl class="kv">${left}</dl><dl class="kv">${right}</dl></div>
  </section>`;
}

function reportsCard(c, st) {
  const L = S.ledger?.[c.id];
  const l1 = cfg.l1 || {};
  const mine = (S.reports || []).filter((r) => r.args.carId?.toString() === c.id.toString());
  const intro = `<h2 class="t-title">Income reports</h2>
    <p class="t-sm ink-3">${esc(TERMS.operator)} logs each rental on its own chain${l1.name ? `, ${esc(l1.name)}` : ''}. Monthly totals arrive here by Avalanche ICM and sit next to the rent it paid.</p>`;
  // The operator chain may have no public explorer: then show the short hash with a copy button instead of a link.
  const l1Ref = (kind, v, text) => (l1.explorer ? ext(`${l1.explorer}/${kind}/${v}`, text)
    : `<span>${text} <button class="cd-copy" type="button" data-act="copy" data-v="${esc(v)}" aria-label="Copy ${esc(text)} ${esc(v)}" title="${esc(v)}"><span class="t-addr">${esc(v.slice(0, 6))}…${esc(v.slice(-4))}</span>${ICON.copy}</button></span>`);
  const links = [
    l1.RentalLog ? l1Ref('address', l1.RentalLog, 'Rental log on the operator chain') : '',
    l1.tx?.report ? l1Ref('tx', l1.tx.report, 'Report sent') : '',
    cfg.tx?.icmDeliveredOnFuji ? ext(txUrl(cfg.tx.icmDeliveredOnFuji), 'Delivered on Fuji') : '',
    cfg.IncomeMirror ? ext(addrUrl(cfg.IncomeMirror), 'IncomeMirror') : '',
  ].filter(Boolean);
  const hasData = L && (L.reportedIncome > 0n || Number(L.periods) > 0 || mine.length);
  if (!cfg.IncomeMirror || !hasData) {
    const msg = onRoad(st)
      ? 'No period reported yet. The first report from the operator chain will show here.'
      : st.key === 'cancelled' ? 'This sale was cancelled, so there is nothing to report.' : 'Reports start once the car is funded and on the road.';
    return `<section class="card pad">${intro}
      <div class="empty cd-empty">${ICON.clock}<p class="t-sm ink-3">${msg}</p></div>
      ${onRoad(st) && links.length ? `<p class="t-sm cd-links">${links.join('')}</p>` : ''}
    </section>`;
  }
  const max = L.reportedIncome > L.rentPaid ? L.reportedIncome : L.rentPaid;
  const w = (v) => (max > 0n ? Math.max(v > 0n ? 2 : 0, Number((v * 1000n) / max) / 10) : 0);
  const verdict = L.unpaid === 0n ? pill('ok', 'Paid in full') : pill('warn', `${usd(L.unpaid)} USDC due`);
  const n = (v, one, many) => `<div><dt class="t-label">${Number(v) === 1 ? one : many}</dt><dd class="t-fig">${Number(v)}</dd></div>`;
  const rows = mine.map((r) => `<li>
      <span><b>Period ${esc(String(r.args.period))}</b> <span class="ink-3">· ${plural(r.args.rentals, 'rental')} · ${plural(r.args.daysRented, 'day')}</span></span>
      <span class="cd-dl-r"><b>${usd(r.args.income)} USDC</b> <a href="${txUrl(r.tx)}" target="_blank" rel="noopener">${r.time ? ago(Number(r.time)) : 'Delivery'} ${ICON.ext}</a></span>
    </li>`).join('');
  return `<section class="card pad">${intro}
    <div class="cd-meters">
      <div><div class="cd-mh"><span class="t-sm ink-2">Reported on the operator chain</span><b>${fig(L.reportedIncome)}</b></div><div class="cd-meter"><i class="rep" style="width:${w(L.reportedIncome)}%"></i></div></div>
      <div><div class="cd-mh"><span class="t-sm ink-2">Rent paid here</span><b>${fig(L.rentPaid)}</b></div><div class="cd-meter"><i class="paid" style="width:${w(L.rentPaid)}%"></i></div></div>
    </div>
    <div class="row cd-verdict">${verdict}<span class="t-sm ink-3">${L.unpaid === 0n ? 'Rent paid covers everything the operator reported.' : 'The operator reported more income than it has paid in so far.'}</span></div>
    <dl class="cd-counts">${n(L.rentals, 'Rental', 'Rentals')}${n(L.daysRented, 'Day rented', 'Days rented')}${n(L.periods, 'Period', 'Periods')}</dl>
    ${rows ? `<h3 class="t-label cd-dl-h">ICM deliveries</h3><ul class="cd-dl">${rows}</ul>` : ''}
    ${links.length ? `<p class="t-sm cd-links">${links.join('')}</p>` : ''}
  </section>`;
}

// ---------- aside ----------

function statGrid(c, st) {
  const cell = (k, v, cls = '') => `<div class="${cls}"><dt class="t-label">${k}</dt><dd class="t-fig">${v}</dd></div>`;
  let cells;
  const ex = exitOf(c);
  if (ex) {
    cells = [cell('Resale proceeds', fig(ex.proceeds)), cell('Per share at resale', fig(ex.proceeds / BigInt(ex.totalShares))),
      cell('Net yield to date', `<span class="pos">${yieldToDate(c)}%</span>`, 'hide-phone'), cell('Shares redeemed', `${ex.redeemedShares} / ${ex.totalShares}`)];
  } else if (st.key === 'earning') {
    cells = [cell('Net yield to date', `<span class="pos">${yieldToDate(c)}%</span>`), cell('Per share', fig(c.sharePrice)), cell('Car value', fig(valueOf(c)), 'hide-phone'), cell('Rent paid in', fig(c.rentPaid))];
  } else if (st.key === 'cancelled') {
    cells = [cell('Per share', fig(c.sharePrice)), cell('Car value', fig(valueOf(c)), 'hide-phone'), cell('Raised, refundable', fig(raisedOf(c))), cell('Shares sold', `${c.sold} / ${c.totalShares}`)];
  } else {
    cells = [cell('Target net yield', rangePct(...targetNet(c))), cell('Per share', fig(c.sharePrice)), cell('Car value', fig(valueOf(c)), 'hide-phone'),
      st.key === 'funding' ? cell('Closes in', `<b class="cd-cd" data-deadline="${c.fundingDeadline}">…</b>`) : cell('Deadline', '<span class="warn-t">Passed</span>')];
  }
  return `<dl class="card statgrid cd-stats">${cells.join('')}</dl>`;
}

function progress(c, st) {
  const w = c.totalShares ? Math.round((c.sold / c.totalShares) * 1000) / 10 : 0;
  return `<div class="cd-prog">
    <div class="bar" role="progressbar" aria-label="Shares sold" aria-valuemin="0" aria-valuemax="${c.totalShares}" aria-valuenow="${c.sold}"><i class="${onRoad(st) ? 'full' : ''}" style="width:${onRoad(st) ? 100 : w}%"></i></div>
    <div class="cd-prog-l t-sm"><span><b>${c.sold}</b> <span class="ink-3">of ${c.totalShares} shares sold</span></span><span class="ink-3">${usd(raisedOf(c))} / ${usd(valueOf(c))} USDC</span></div>
  </div>`;
}

const connectPrompt = (what) => `<div class="cd-connect"><p class="t-sm ink-3">${what}</p><button class="btn btn-w" type="button" data-act="connect">${ICON.wallet}Connect wallet</button></div>`;
const loadingMe = '<p class="skel">Loading your position</p>';

function buyTab(c, myShares) {
  const id = c.id.toString();
  const me = S.data.me;
  const left = c.totalShares - c.sold;
  const amt = buyAmount(c);
  const n = Math.min(parseShares(amt), left);
  const cost = BigInt(n) * c.sharePrice;
  const [lo, hi] = targetNet(c);
  const resale = resaleOf(c, cost);
  const chips = [1, 5, 10, 25].filter((x) => x < left).map((x) => [x, String(x)]).concat([[left, `All ${left}`]]);
  const short = S.account && me && me.usdc < cost;
  return `<div class="field">
      <label for="buy-${id}">Shares</label>
      <div class="stepper">
        <button type="button" data-act="step" data-car="${id}" data-d="-1" aria-label="One share fewer"${n <= 1 ? ' disabled' : ''}>${ICON.minus}</button>
        <input id="buy-${id}" data-bind="buy" data-car="${id}" value="${esc(amt)}" inputmode="numeric" autocomplete="off">
        <button type="button" data-act="step" data-car="${id}" data-d="1" aria-label="One share more"${n >= left ? ' disabled' : ''}>${ICON.plus}</button>
      </div>
    </div>
    <div class="row cd-chips">${chips.map(([v, t]) => `<button class="btn btn-sm${n === v ? ' on' : ''}" type="button" aria-pressed="${n === v}" data-act="step" data-car="${id}" data-set="${v === left ? 'max' : v}">${t}</button>`).join('')}</div>
    <dl class="kv">
      <div><dt>Ownership after purchase</dt><dd>${shareOf(myShares + n, c.totalShares)}% of the car</dd></div>
      <div><dt>Rent to you per year (target)</dt><dd class="pos">${whole((num(cost) * lo) / 100)}–${whole((num(cost) * hi) / 100)} USDC</dd></div>
      ${resale !== null ? `<div><dt>Resale share (est.)</dt><dd>${usd(resale)} USDC</dd></div>` : ''}
    </dl>
    <div class="total"><span class="t-sm ink-3">You pay</span><span class="t-fig">${fig(cost)}</span></div>
    ${S.account
      ? `<button class="btn btn-p btn-lg btn-w hide-phone" type="button" data-act="buy" data-car="${id}"${off(n < 1)}>${spin(`buy-${id}`)}Buy ${plural(n, 'share')}</button>`
      : `<button class="btn btn-p btn-lg btn-w hide-phone" type="button" data-act="connect">${ICON.wallet}Connect wallet to buy</button>`}
    ${short ? `<div class="cd-short"><p class="t-sm warn-t">You have ${usdc(me.usdc)}, ${usdc(cost - me.usdc)} short.</p>${faucetBtn('btn-w')}</div>` : ''}
    <div class="note">${ICON.shield}<span>Your USDC stays in escrow until the car sells out. If it doesn't by ${day(c.fundingDeadline)}, you get all of it back.</span></div>`;
}

function positionRows(c, myShares, extra = '') {
  return `<dl class="kv">
    <div><dt>Your shares</dt><dd>${myShares}</dd></div>
    <div><dt>Ownership</dt><dd>${shareOf(myShares, c.totalShares)}% of the car</dd></div>
    ${extra}
  </dl>`;
}

function fundingPosition(c, myShares) {
  if (!S.account) return connectPrompt('Connect your wallet to see your shares in this car.');
  if (!S.data.me) return loadingMe;
  if (!myShares) return '<p class="t-sm ink-3">You hold no shares in this car yet. Buy some on the first tab.</p>';
  return `${positionRows(c, myShares, `<div><dt>Paid, in escrow</dt><dd>${usd(BigInt(myShares) * c.sharePrice)} USDC</dd></div>`)}
    <p class="t-sm ink-3">Rent starts once the car sells out. If it doesn't, you get the full amount back.</p>`;
}

function actionArea(c, st, myShares, myClaim) {
  const id = c.id.toString();
  if (st.key === 'funding') {
    const tab = ui.cdTab === 'pos' ? 'pos' : 'buy';
    const t = (k, label) => `<button type="button" role="tab" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="set" data-k="cdTab" data-v="${k}">${label}</button>`;
    return `<section class="card cd-act">
      <div class="tabs cd-tabs" role="tablist">${t('buy', 'Buy shares')}${t('pos', 'Your position')}</div>
      <div class="cd-act-b" role="tabpanel">${tab === 'buy' ? buyTab(c, myShares) : fundingPosition(c, myShares)}</div>
    </section>`;
  }
  if (st.key === 'expired') {
    return `<section class="card pad cd-act-b">
      <h2 class="t-title">Close the sale</h2>
      <p class="t-sm ink-2">The deadline passed on ${esc(dateStr(c.fundingDeadline))} before the car sold out. Anyone can close a sale that missed its deadline. Closing it opens refunds for every buyer.</p>
      ${S.account && S.data.me && myShares ? `<p class="t-sm">You have ${usdc(BigInt(myShares) * c.sharePrice)} in escrow for ${plural(myShares, 'share')}.</p>` : ''}
      <button class="btn btn-p btn-lg btn-w" type="button" data-act="${S.account ? 'cancelFunding' : 'connect'}" data-car="${id}"${off()}>${spin(`cancel-${id}`)}${S.account ? 'Close sale and open refunds' : 'Connect wallet to close the sale'}</button>
    </section>`;
  }
  if (st.key === 'cancelled') {
    let body;
    if (!S.account) body = connectPrompt('Connect your wallet to see if you have a refund.');
    else if (!S.data.me) body = loadingMe;
    else body = `${positionRows(c, myShares, `<div><dt>Refund due</dt><dd>${usd(BigInt(myShares) * c.sharePrice)} USDC</dd></div>`)}
      <button class="btn btn-p btn-lg btn-w" type="button" data-act="refund" data-car="${id}"${off(myShares === 0)}>${spin(`refund-${id}`)}${myShares ? `Refund ${usdc(BigInt(myShares) * c.sharePrice)}` : 'Nothing to refund'}</button>`;
    return `<section class="card pad cd-act-b">
      <h2 class="t-title">Your position</h2>
      <p class="t-sm ink-3">The sale was closed without selling out. Every buyer can take their money back.</p>
      ${body}
    </section>`;
  }
  if (st.key === 'sold') {
    const due = S.data.me?.redeemable?.[c.id] ?? 0n;
    let pos;
    if (!S.account) pos = connectPrompt('Connect your wallet to redeem your shares for your part of the sale.');
    else if (!S.data.me) pos = loadingMe;
    else {
      pos = `${positionRows(c, myShares, `<div><dt>Redeems for</dt><dd class="${due > 0n ? 'pos' : ''}">${usd(due)} USDC</dd></div>
        <div><dt>Rent to collect</dt><dd class="${myClaim > 0n ? 'pos' : ''}">${usd(myClaim)} USDC</dd></div>`)}
      <button class="btn ${myShares ? 'btn-p' : ''} btn-lg btn-w" type="button" data-act="redeem" data-car="${id}"${off(!myShares)}>${spin(`redeem-${id}`)}${myShares ? `Redeem ${plural(myShares, 'share')} for ${usdc(due)}` : 'No shares to redeem'}</button>
      ${myShares ? '<p class="t-sm ink-3">This hands your shares to the resale contract for good. Rent you have not collected stays yours to collect.</p>' : ''}
      ${myClaim > 0n ? `<button class="btn btn-lg btn-w" type="button" data-act="claim" data-car="${id}"${off()}>${spin(`claim-${id}`)}Collect ${usdc(myClaim)} rent</button>` : ''}`;
    }
    return `<section class="card pad cd-act-b"><h2 class="t-title">Your position</h2>${pos}</section>
      ${saleCard(c)}
      ${rentCard(c, true)}`;
  }
  // earning
  const toMarket = (label) => `<a class="btn btn-w" href="#/market" data-act="market" data-car="${id}">${label}</a>`;
  let pos;
  if (!S.account) pos = `${connectPrompt('Connect your wallet to see your shares and collect rent.')}${toMarket('Buy shares on the market')}`;
  else if (!S.data.me) pos = loadingMe;
  else pos = `${positionRows(c, myShares, `<div><dt>Rent to collect</dt><dd class="${myClaim > 0n ? 'pos' : ''}">${usd(myClaim)} USDC</dd></div>`)}
    <button class="btn ${myClaim > 0n ? 'btn-p' : ''} btn-lg btn-w" type="button" data-act="claim" data-car="${id}"${off(myClaim === 0n)}>${spin(`claim-${id}`)}${myClaim > 0n ? `Collect ${usdc(myClaim)}` : 'No rent to collect yet'}</button>
    ${toMarket(myShares ? 'Sell your shares on the market' : 'Buy shares on the market')}`;
  return `<section class="card pad cd-act-b"><h2 class="t-title">Your position</h2>${pos}</section>
    ${offersCard(c)}
    ${rentCard(c)}
    ${saleForm(c)}`;
}

// A sold car: what the sale brought in and how much of it holders have taken. CarExit add-on.
function saleCard(c) {
  const ex = exitOf(c);
  const left = ex.proceeds - ex.paidOut;
  return `<section class="card pad cd-act-b">
    <div class="card-h cd-tight"><div><h2 class="t-title">Sale</h2><p class="t-sm ink-3">Recorded by the operator on ${day(ex.soldAt)}</p></div></div>
    <dl class="kv">
      <div><dt>Sold for</dt><dd>${usd(ex.proceeds)} USDC</dd></div>
      <div><dt>Shares redeemed</dt><dd>${ex.redeemedShares} of ${ex.totalShares}</dd></div>
      <div><dt>Paid to holders</dt><dd>${usd(ex.paidOut)} USDC</dd></div>
      <div><dt>Still to redeem</dt><dd>${usd(left)} USDC</dd></div>
    </dl>
    <p class="t-sm ink-3">The share contract has no sold state, so it still lists this car as active and its shares can still change hands there. Shares handed in stay with the resale contract.</p>
  </section>`;
}

// The operator of an earning car records its sale and pays the money in. CarExit add-on.
function saleForm(c) {
  if (!cfg.CarExit || !same(S.account, c.operator)) return '';
  const id = c.id.toString();
  const amt = parseUsd(ui.exit?.[id]);
  const est = resaleOf(c, valueOf(c));
  return `<section class="card pad cd-act-b">
    <div class="card-h cd-tight"><div><h2 class="t-title">Record the sale</h2><p class="t-sm ink-3">Once the car is sold, pay the money in here. Holders redeem their shares for it.</p></div></div>
    <div class="field"><label for="exit-${id}">Resale amount</label>
      <div class="input-suffix"><input class="input" id="exit-${id}" data-bind="exit" data-car="${id}" value="${esc(ui.exit?.[id] ?? '')}" placeholder="${est ? usd(est).replace(/,/g, '') : '1000'}" inputmode="decimal" autocomplete="off"><span>USDC</span></div></div>
    ${amt
      ? `<p class="t-sm ink-2">Each of the ${c.totalShares} shares receives ${usdc(amt / BigInt(c.totalShares))}. No fee is taken.</p>`
      : '<p class="t-sm ink-3">The money comes from this wallet. A sale can be recorded only once.</p>'}
    <button class="btn btn-p btn-w" type="button" data-act="settleExit" data-car="${id}"${off(!amt)}>${spin(`exit-${id}`)}Record the sale</button>
  </section>`;
}

// Open offers for this car: re-trading between holders, as on the market page.
function offersCard(c) {
  const id = c.id.toString();
  const open = S.data.offers.filter((o) => o.amount > 0 && o.carId === c.id);
  const head = `<div class="card-h cd-tight"><div><h2 class="t-title">Shares for sale</h2><p class="t-sm ink-3">${open.length ? `${plural(open.length, 'open offer')} from holders` : 'Holders can resell their shares here'}</p></div></div>`;
  if (!open.length) {
    return `<section class="card pad cd-act-b">${head}
      <p class="t-sm ink-3">No shares of this car are for sale right now.</p>
      <a class="cd-more t-sm" href="#/market" data-act="market" data-car="${id}">Open the market ${ICON.arrow}</a>
    </section>`;
  }
  const rows = open.slice(0, 4).map((o) => {
    const oid = o.id.toString();
    const diff = Number(((o.pricePerShare - c.sharePrice) * 1000n) / c.sharePrice) / 10;
    const vs = diff === 0 ? 'issue price' : `${diff < 0 ? '−' : '+'}${trim(Math.abs(diff))}% vs. issue`;
    let btn;
    if (same(o.seller, S.account)) btn = `<button class="btn btn-sm" type="button" data-act="cancelOffer" data-offer="${oid}"${off()}>${spin(`unoffer-${oid}`)}Cancel</button>`;
    else if (o.fillable < 1) btn = '<span class="t-sm ink-3">Sold out</span>';
    else if (!S.account) btn = '<button class="btn btn-sm" type="button" data-act="connect">Connect to buy</button>';
    else {
      const n = Math.min(parseShares(ui.take[oid] ?? String(o.fillable)), o.fillable);
      btn = `<button class="btn btn-sm" type="button" data-act="takeOffer" data-offer="${oid}"${off(n < 1)}>${spin(`take-${oid}`)}Buy ${n} for ${usd(BigInt(n) * o.pricePerShare)} USDC</button>`;
    }
    return `<li><span><b>${plural(o.fillable, 'share')}</b> at ${usd(o.pricePerShare)} USDC <span class="ink-3">· ${vs} · ${who(o.seller)}</span></span>${btn}</li>`;
  }).join('');
  return `<section class="card pad cd-act-b">${head}
    <ul class="cd-offers">${rows}</ul>
    <a class="cd-more t-sm" href="#/market" data-act="market" data-car="${id}">${open.length > 4 ? `All ${open.length} offers` : 'Choose how many on the market'} ${ICON.arrow}</a>
  </section>`;
}

function rentCard(c, sold = false) {
  const id = c.id.toString();
  const holders = holdersOf(c);
  const fee = TERMS.fee, hold = 100 - fee;
  const perShare = c.accPerShare / 10n ** 18n;
  let pay = '';
  if (!sold && same(S.account, c.operator)) {
    const preview = parseUsd(ui.rent?.[id]);
    const feePart = preview ? (preview * BigInt(fee)) / 100n : 0n;
    pay = `<div class="cd-pay">
      <h3 class="t-title">Pay rent</h3>
      <div class="field"><label for="rent-${id}">Rent to pay</label>
        <div class="input-suffix"><input class="input" id="rent-${id}" data-bind="rent" data-car="${id}" value="${esc(ui.rent?.[id] ?? '')}" placeholder="250" inputmode="decimal" autocomplete="off"><span>USDC</span></div></div>
      ${preview ? `<p class="t-sm ink-2">Holders get ${usdc(preview - feePart)}. Manager gets ${usdc(feePart)}.</p>` : '<p class="t-sm ink-3">You operate this car. The contract splits rent on arrival.</p>'}
      <button class="btn btn-p btn-w" type="button" data-act="payRent" data-car="${id}"${off(!preview)}>${spin(`rent-${id}`)}Pay rent</button>
    </div>`;
  }
  return `<section class="card pad cd-act-b">
    <div class="card-h cd-tight"><div><h2 class="t-title">Rent</h2><p class="t-sm ink-3">${c.rentPaid > 0n ? `${usdc(c.rentPaid)} paid in so far` : 'No rent paid in yet'}</p></div></div>
    <div class="cd-split" role="img" aria-label="${hold}% to holders, ${fee}% management fee">
      <div class="h" style="flex:${hold}">${hold}% holders</div><div class="f" style="flex:${Math.max(fee, 14)}">${fee}% fee</div>
    </div>
    <dl class="kv">
      <div><dt>To holders</dt><dd>${usd(holders)} USDC</dd></div>
      <div><dt>Management fee</dt><dd>${usd(c.feePaid)} USDC</dd></div>
      <div><dt>Rent per share so far</dt><dd>${usd(perShare)} USDC</dd></div>
    </dl>
    ${pay}
  </section>`;
}

function buyBar(c) {
  const id = c.id.toString();
  const n = Math.min(parseShares(buyAmount(c)), c.totalShares - c.sold);
  const cost = BigInt(n) * c.sharePrice;
  return `<div class="buybar cd-buybar only-phone">${S.account
    ? `<button class="btn btn-p btn-lg btn-w" type="button" data-act="buy" data-car="${id}"${off(n < 1)}>${spin(`buy-${id}`)}Buy ${plural(n, 'share')} · ${usd(cost)} USDC</button>`
    : `<button class="btn btn-p btn-lg btn-w" type="button" data-act="connect">${ICON.wallet}Connect wallet to buy</button>`}</div>`;
}

registerView('car', (r) => {
  const c = r.id != null ? carById(r.id) : null;
  if (!c) return notFound(r.id);
  const st = stageOf(c);
  const m = metaOf(c);
  const me = S.data.me;
  const myShares = me ? Number(me.shares?.[c.id] ?? 0n) : 0;
  const myClaim = me ? me.claimable?.[c.id] ?? 0n : 0n;
  const plate = `FS-${c.id.toString().padStart(3, '0')}`;
  const sub = [m.city, m.term ? `${m.term}-year term` : null].filter(Boolean).map(esc).join(' · ');
  return `<div class="cd-page${st.key === 'funding' ? ' cd-has-bar' : ''}">
    <nav class="crumbs cd-crumbs" aria-label="Breadcrumb"><a href="#/">Vault</a><span aria-hidden="true">/</span><span class="cd-now">${esc(c.name)}</span></nav>
    <div class="cd-grid">
      <div class="cd-photo">${photo(c, 'photo', c.name)}</div>
      <aside class="cd-aside">
        <div class="cd-title">
          <div class="row">${st.pill}<span class="t-sm ink-3 hide-phone">${plate}${m.term ? ` · ${m.term}-year term` : ''}</span></div>
          ${sub ? `<p class="t-sm ink-3 only-phone">${sub}</p>` : ''}
          <h1 class="t-h1">${esc(c.name)}</h1>
        </div>
        ${statGrid(c, st)}
        ${progress(c, st)}
        ${actionArea(c, st, myShares, myClaim)}
      </aside>
      <div class="cd-rest">
        ${lifeCard(c, st)}
        ${detailsCard(c)}
        ${reportsCard(c, st)}
      </div>
    </div>
    ${st.key === 'funding' ? buyBar(c) : ''}
  </div>`;
});
