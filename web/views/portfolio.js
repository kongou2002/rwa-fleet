import {
  registerView, ACTIONS, S, ui, esc, same, short, txUrl, plural, usd, fig, pct, ago,
  carById, metaOf, yieldToDate, targetNet, rangePct, stageOf, photo, spin, off, allEvents,
  SERIES, ICON, render,
} from '../core.js';

// "Sell" in the holdings table: preselect the car in the market's sell form, then go there.
ACTIONS.pfSell = (d) => {
  ui.mkSell = d.car;
  if (location.hash !== '#/market') location.hash = '#/market';
  else render();
};

const idOf = (c) => c.id.toString();
const colorOf = (c) => SERIES[(Number(c.id) - 1 + SERIES.length) % SERIES.length];
const big = (v) => (typeof v === 'bigint' ? v : BigInt(v ?? 0));

const head = (line = '', action = '') => `
  <div class="head">
    <div class="pf-intro">
      <h1 class="t-display">Portfolio</h1>
      ${line ? `<p class="t-body ink-2">${line}</p>` : ''}
    </div>
    ${action}
  </div>`;

function holdingsOf(me) {
  return S.data.cars
    .map((c) => {
      const shares = big(me.shares[c.id]);
      const claim = big(me.claimable[c.id]);
      // redeem: USDC the shares fetch from CarExit once the car's sale is recorded (add-on; 0 otherwise)
      return { c, stage: stageOf(c), shares, claim, invested: shares * c.sharePrice, redeem: big(me.redeemable?.[c.id]) };
    })
    .filter((h) => h.shares > 0n || h.claim > 0n);
}

// Events that touch this wallet, as { label, amount (html), ev }.
function myActivity(me) {
  const a = me.address;
  const offerOf = (oid) => {
    const id = String(oid);
    const o = S.data.offers.find((x) => x.id.toString() === id);
    if (o) return { seller: o.seller, carId: o.carId };
    const made = (S.events || []).find((e) => e.name === 'OfferMade' && String(e.args.offerId) === id);
    return made ? { seller: made.args.seller, carId: made.args.carId } : null;
  };
  const nm = (id) => (id == null ? '' : ` · ${esc(carById(id)?.name ?? `Car ${id}`)}`);
  const out = [];
  for (const ev of allEvents()) {
    const g = ev.args || {};
    let row = null;
    switch (ev.name) {
      case 'SharesBought':
        if (same(g.buyer, a)) row = [`Bought ${plural(Number(g.amount), 'share')}${nm(g.carId)}`, usd(big(g.paid))];
        break;
      case 'RentClaimed':
        if (same(g.holder, a)) row = [`Collected${nm(g.carId)}`, `<span class="pos">+${usd(big(g.amount))}</span>`];
        break;
      case 'Refunded':
        if (same(g.buyer, a)) row = [`Refund${nm(g.carId)}`, `<span class="pos">+${usd(big(g.amount))}</span>`];
        break;
      case 'RentPaid':
        if (same(g.payer, a)) row = [`Paid rent${nm(g.carId)}`, usd(big(g.gross))];
        break;
      case 'OfferMade':
        if (same(g.seller, a)) row = [`Listed ${plural(Number(g.amount), 'share')}${nm(g.carId)}`, `${usd(big(g.pricePerShare))} each`];
        break;
      case 'OfferTaken': {
        const o = offerOf(g.offerId);
        if (same(g.buyer, a)) row = [`Bought ${plural(Number(g.amount), 'share')}${nm(o?.carId)}`, usd(big(g.paid))];
        else if (o && same(o.seller, a)) row = [`Sold ${plural(Number(g.amount), 'share')}${nm(o.carId)}`, `<span class="pos">+${usd(big(g.paid))}</span>`];
        break;
      }
      case 'OfferCancelled': {
        const o = offerOf(g.offerId);
        if (o && same(o.seller, a)) row = [`Cancelled offer${nm(o.carId)}`, ''];
        break;
      }
      default:
    }
    if (row) out.push({ label: row[0], amount: row[1], ev });
    if (out.length >= 6) break;
  }
  return out;
}

function activityCard(me) {
  let body;
  if (S.events === null && !S.feedError) body = '<p class="skel">Loading your activity</p>';
  else {
    const rows = myActivity(me);
    if (!rows.length) {
      body = `<div class="empty"><p class="t-sm ink-3">${S.feedError ? 'The activity feed could not be loaded.' : 'Nothing yet. Buys, sales and rent you collect show up here.'}</p></div>`;
    } else {
      body = `<dl class="kv">${rows.map((r) => `<div><dt>${r.label}</dt><dd>${r.amount}${r.amount ? ' · ' : ''}${r.ev.tx
        ? `<a href="${esc(txUrl(r.ev.tx))}" target="_blank" rel="noopener">${r.ev.time ? esc(ago(r.ev.time)) : 'View tx'}</a>`
        : (r.ev.time ? esc(ago(r.ev.time)) : '')}</dd></div>`).join('')}</dl>`;
    }
  }
  return `<section class="card pad pf-half">
    <h2 class="t-title">Recent activity</h2>
    <p class="t-sm ink-3 pf-sub">Your wallet only</p>
    ${body}
  </section>`;
}

function allocationCard(hold) {
  const parts = hold.filter((h) => h.invested > 0n);
  const total = parts.reduce((s, h) => s + h.invested, 0n);
  let body;
  if (!total) body = '<div class="empty"><p class="t-sm ink-3">Nothing invested yet.</p></div>';
  else {
    const share = (h) => pct(h.invested, total);
    const aria = `Allocation by amount invested: ${parts.map((h) => `${h.c.name} ${share(h)}%`).join(', ')}`;
    body = `<div class="pf-alloc" role="img" aria-label="${esc(aria)}">
        ${parts.map((h) => `<i style="flex:${Number(h.invested * 10000n / total) || 1};background:${colorOf(h.c)}"></i>`).join('')}
      </div>
      <dl class="kv">${parts.map((h) => {
        const city = metaOf(h.c).city;
        return `<div><dt class="pf-key"><i style="background:${colorOf(h.c)}" aria-hidden="true"></i>${esc(h.c.name)}${city ? ` · ${esc(city)}` : ''}</dt><dd>${usd(h.invested)} · ${share(h)}%</dd></div>`;
      }).join('')}</dl>`;
  }
  return `<section class="card pad pf-half">
    <h2 class="t-title">Allocation</h2>
    <p class="t-sm ink-3">By amount invested</p>
    ${body}
  </section>`;
}

// Earning and sold cars both earned rent; a sold car's rent stays collectable after the sale.
const rents = (h) => h.stage.key === 'earning' || h.stage.key === 'sold';

function yieldCell(h) {
  if (rents(h)) return `<td class="num pos">${esc(yieldToDate(h.c))}%</td>`;
  if (h.stage.key === 'funding' || h.stage.key === 'expired') return `<td class="r">${rangePct(...targetNet(h.c))} <span class="ink-3">target</span></td>`;
  return '<td class="r ink-3">–</td>';
}

function actionsOf(h) {
  const id = idOf(h.c);
  switch (h.stage.key) {
    case 'earning':
      return `<button class="btn btn-sm" type="button" data-act="claim" data-car="${id}"${off(h.claim === 0n)}>${spin(`claim-${id}`)}Collect</button>
        ${h.shares > 0n ? `<a class="btn btn-sm" href="#/market" data-act="pfSell" data-car="${id}">Sell</a>` : ''}`;
    case 'sold':
      return `${h.claim > 0n ? `<button class="btn btn-sm" type="button" data-act="claim" data-car="${id}"${off()}>${spin(`claim-${id}`)}Collect</button>` : ''}
        ${h.shares > 0n ? `<span class="t-sm pf-redeem">Redeems for <b>${usd(h.redeem)}</b></span>
        <button class="btn btn-sm btn-p" type="button" data-act="redeem" data-car="${id}"${off()}>${spin(`redeem-${id}`)}Redeem</button>` : ''}`;
    case 'funding':
      return `<a class="btn btn-sm" href="#/car/${id}">Add more</a>`;
    case 'expired':
      return `<button class="btn btn-sm" type="button" data-act="cancelFunding" data-car="${id}"${off()}>${spin(`cancel-${id}`)}Close sale</button>`;
    case 'cancelled':
      return h.shares > 0n
        ? `<button class="btn btn-sm" type="button" data-act="refund" data-car="${id}"${off()}>${spin(`refund-${id}`)}Refund ${usd(h.invested)}</button>`
        : '';
    default:
      return '';
  }
}

function holdingsCard(hold) {
  if (!hold.length) {
    return `<section class="card pad pf-hold">
      <div class="card-h"><h2 class="t-title">Holdings</h2></div>
      <div class="empty">${ICON.car}<p class="t-sm ink-3">You do not hold any shares yet. <a href="#/">Pick a car in the vault</a> to start.</p></div>
    </section>`;
  }
  const rows = hold.map((h) => `<tr>
      <td><a class="carcell" href="#/car/${idOf(h.c)}">${photo(h.c, 'thumb', '')}${esc(h.c.name)}</a></td>
      <td>${h.stage.pill}</td>
      <td class="num">${h.shares}</td>
      <td class="r">${pct(h.shares, BigInt(h.c.totalShares))}%</td>
      <td class="num">${usd(h.invested)}</td>
      ${yieldCell(h)}
      <td class="${rents(h) ? 'num' : 'r ink-3'}">${rents(h) ? usd(h.claim) : '–'}</td>
      <td class="r"><span class="pf-acts">${actionsOf(h)}</span></td>
    </tr>`).join('');

  const list = hold.map((h) => `<li>
      ${photo(h.c, 'thumb', '')}
      <a class="pf-li-name" href="#/car/${idOf(h.c)}"><b>${esc(h.c.name)}</b><span class="t-sm ink-3">${plural(Number(h.shares), 'share')} · ${pct(h.shares, BigInt(h.c.totalShares))}%</span></a>
      ${h.stage.key === 'earning'
        ? `<span class="pf-li-r"><b class="${h.claim > 0n ? 'pos' : 'ink-3'}">${h.claim > 0n ? '+' : ''}${usd(h.claim)}</b><span class="t-sm ink-3">${esc(yieldToDate(h.c))}%</span></span>`
        : h.stage.key === 'sold' && h.shares > 0n
          ? `<span class="pf-li-r"><b>${usd(h.redeem)}</b><span class="t-sm ink-3">Sold · to redeem</span></span>`
          : h.stage.pill}
    </li>`).join('');

  return `<section class="card pad pf-hold">
    <div class="card-h"><h2 class="t-title">Holdings</h2><span class="t-sm ink-3 hide-phone">Rent builds up each time rent is paid in</span></div>
    <div class="tbl-box hide-phone">
      <table class="t">
        <thead><tr><th>Car</th><th>Status</th><th class="r">Shares</th><th class="r">Ownership</th><th class="r">Invested</th><th class="r">Net yield</th><th class="r">To collect</th><th class="r"><span class="pf-sr">Actions</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <ul class="pf-list only-phone">${list}</ul>
  </section>`;
}

registerView('portfolio', () => {
  if (!S.account) {
    return `${head()}
      <section class="card pad pf-connect">
        <div class="empty">${ICON.wallet}<p class="t-sm ink-3">Connect a wallet to see your shares, rent and activity.</p>
          <button class="btn btn-p" type="button" data-act="connect">Connect wallet</button></div>
      </section>`;
  }
  const me = S.data.me;
  if (!me) {
    return `${head(`<span class="t-addr">${esc(short(S.account))}</span>`)}
      <section class="kpis"><div><p class="skel">Loading</p></div><div><p class="skel">Loading</p></div><div><p class="skel">Loading</p></div></section>
      <section class="card pad pf-hold"><p class="skel">Loading your holdings</p></section>`;
  }

  const hold = holdingsOf(me);
  const held = hold.filter((h) => h.shares > 0n);
  const earning = hold.filter(rents);
  const invested = held.reduce((s, h) => s + h.invested, 0n);
  const investedEarning = earning.reduce((s, h) => s + h.invested, 0n);
  const ready = Object.values(me.claimable || {}).reduce((s, v) => s + big(v), 0n);
  const readyCars = earning.filter((h) => h.claim > 0n).length;

  const loading = S.events === null && !S.feedError;
  const known = !loading && !S.feedError;
  const collected = known
    ? allEvents()
      .filter((e) => e.name === 'RentClaimed' && same(e.args?.holder, me.address))
      .reduce((s, e) => s + big(e.args.amount), 0n)
    : 0n;
  const earned = collected + ready;
  const yieldPct = investedEarning > 0n ? `${pct(earned, investedEarning)}%` : '–';

  const collectBtn = ready > 0n
    ? `<button class="btn btn-p" type="button" data-act="claimAll"${off()}>${spin('claimAll')}Collect ${usd(ready)} VND</button>`
    : '';
  const line = `${plural(held.length, 'car')} · <span class="t-addr">${esc(short(me.address))}</span>`;

  const rentSub = loading ? 'Collected rent is still loading. Showing what is ready.'
    : S.feedError ? 'Collected rent could not be loaded. Showing what is ready.'
    : `${usd(collected)} collected so far`;

  return `${head(line, `<span class="hide-phone">${collectBtn}</span>`)}

    <section class="card pf-ready only-phone">
      <div><p class="t-label">Ready to collect</p><p class="t-kpi${ready > 0n ? ' pos' : ''}">${fig(ready)}</p></div>
      ${ready > 0n
        ? `<button class="btn btn-p btn-lg btn-w" type="button" data-act="claimAll"${off()}>${spin('claimAll')}Collect all</button>`
        : '<p class="t-sm ink-3">Nothing to collect right now.</p>'}
    </section>
    <dl class="card statgrid only-phone pf-stats">
      <div><dt class="t-label">Invested</dt><dd class="t-fig">${usd(invested)}</dd></div>
      <div><dt class="t-label">Your yield to date</dt><dd class="t-fig pos">${yieldPct}</dd></div>
    </dl>

    <section class="kpis hide-phone pf-kpis" aria-label="Portfolio summary">
      <div><p class="t-label">Invested</p><p class="t-kpi">${fig(invested)}</p><p class="t-sm">At issue price</p></div>
      <div><p class="t-label">Rent earned</p><p class="t-kpi">${fig(earned)}</p><p class="t-sm">${rentSub}</p></div>
      <div><p class="t-label">Ready to collect</p><p class="t-kpi${ready > 0n ? ' pos' : ''}">${fig(ready)}</p><p class="t-sm">${readyCars ? `From ${plural(readyCars, 'earning car')}` : 'Nothing to collect yet'}</p></div>
      <div><p class="t-label">Your yield to date</p><p class="t-kpi pos">${yieldPct}</p><p class="t-sm">Rent only, before resale</p></div>
    </section>

    ${holdingsCard(hold)}

    <div class="pf-row">
      ${allocationCard(held)}
      ${activityCard(me)}
    </div>`;
});
