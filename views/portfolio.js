import {
  registerView, ACTIONS, S, ui, esc, same, txUrl, plural, usd, num, trim, pct, ago,
  carById, stageOf, photo, spin, off, allEvents, ICON, render,
} from '../core.js?v=20261125d';

// "Sell" in My cars: preselect the car in the Resell form, then go there.
ACTIONS.pfSell = (d) => {
  ui.mkSell = d.car;
  if (location.hash !== '#/market') location.hash = '#/market';
  else render();
};

const idOf = (c) => c.id.toString();
const big = (v) => (typeof v === 'bigint' ? v : BigInt(v ?? 0));
const vnd = (v) => `₫${usd(v)}`;
/** Rounded for summaries: '₫15.1M', '₫480M', '₫2.1B'. */
const vndR = (v) => {
  const m = num(big(v));
  if (m >= 1000) return `₫${trim(m / 1000, 2)}B`;
  return m >= 1 ? `₫${trim(m, 1)}M` : vnd(v);
};
/** Whole VND with separators: '₫2,840,000'. 1 token unit (6 dp) = 25,000 VND. */
const vndFull = (v) => `₫${((big(v) * 25000n) / 1000000n).toLocaleString('en-US')}`;

const svg = (b) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${b}</svg>`;
const IC = {
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  check: ICON.check,
  car: ICON.car,
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/>'),
  x: ICON.x,
};

const head = () => '<div class="pf-head"><h1 class="pf-title">My cars</h1></div>';

function holdingsOf(me) {
  return S.data.cars
    .map((c) => {
      const shares = big(me.shares[c.id]);
      const claim = big(me.claimable[c.id]);
      // redeem: what the shares fetch from CarExit once the car's sale is recorded (add-on; 0 otherwise)
      return { c, stage: stageOf(c), shares, claim, invested: shares * c.sharePrice, redeem: big(me.redeemable?.[c.id]) };
    })
    .filter((h) => h.shares > 0n || h.claim > 0n);
}

// Events that touch this wallet: { icon, kind, title, amount, ev }. kind 'in' is money in.
function myActivity(me) {
  const a = me.address;
  const offerOf = (oid) => {
    const id = String(oid);
    const o = S.data.offers.find((x) => x.id.toString() === id);
    if (o) return { seller: o.seller, carId: o.carId };
    const made = (S.events || []).find((e) => e.name === 'OfferMade' && String(e.args.offerId) === id);
    return made ? { seller: made.args.seller, carId: made.args.carId } : null;
  };
  const nm = (id) => esc(id == null ? 'a car' : carById(id)?.name ?? `Car ${id}`);
  const out = [];
  for (const ev of allEvents()) {
    const g = ev.args || {};
    let r = null;
    switch (ev.name) {
      case 'SharesBought':
        if (same(g.buyer, a)) r = [IC.car, 'out', `Bought ${plural(Number(g.amount), 'share')} of ${nm(g.carId)}`, `−${vnd(big(g.paid))}`];
        break;
      case 'RentClaimed':
        if (same(g.holder, a)) r = [IC.check, 'in', `Rent from ${nm(g.carId)}`, `+${vnd(big(g.amount))}`];
        break;
      case 'Refunded':
        if (same(g.buyer, a)) r = [IC.up, 'in', `Refund from ${nm(g.carId)}`, `+${vnd(big(g.amount))}`];
        break;
      case 'RentPaid':
        if (same(g.payer, a)) r = [IC.up, 'out', `Paid rent for ${nm(g.carId)}`, `−${vnd(big(g.gross))}`];
        break;
      case 'OfferMade':
        if (same(g.seller, a)) r = [IC.tag, '', `Listed ${plural(Number(g.amount), 'share')} of ${nm(g.carId)}`, `${vnd(big(g.pricePerShare))} each`];
        break;
      case 'OfferTaken': {
        const o = offerOf(g.offerId);
        if (same(g.buyer, a)) r = [IC.car, 'out', `Bought ${plural(Number(g.amount), 'share')} of ${nm(o?.carId)}`, `−${vnd(big(g.paid))}`];
        else if (o && same(o.seller, a)) r = [IC.up, 'in', `Sold ${plural(Number(g.amount), 'share')} of ${nm(o.carId)}`, `+${vnd(big(g.paid))}`];
        break;
      }
      case 'OfferCancelled': {
        const o = offerOf(g.offerId);
        if (o && same(o.seller, a)) r = [IC.x, '', `Removed a listing of ${nm(o.carId)}`, ''];
        break;
      }
      default:
    }
    if (r) out.push({ icon: r[0], kind: r[1], title: r[2], amount: r[3], ev });
    if (out.length >= 8) break;
  }
  return out;
}

function activity(me) {
  let body;
  if (S.events === null && !S.feedError) body = '<p class="skel">Loading your activity</p>';
  else {
    const rows = myActivity(me);
    if (!rows.length) {
      body = `<p class="pf-quiet">${S.feedError ? 'Activity could not be loaded.' : 'Nothing yet. Buys and rent show up here.'}</p>`;
    } else {
      body = `<ul class="pf-acts">${rows.map((r) => {
        const when = r.ev.time ? esc(ago(r.ev.time)) : 'View';
        const t = r.ev.tx ? `<a href="${esc(txUrl(r.ev.tx))}" target="_blank" rel="noopener">${when}</a>` : (r.ev.time ? when : '');
        return `<li>
          <span class="pf-ic${r.kind === 'in' ? ' pf-ic-in' : ''}">${r.icon}</span>
          <span class="pf-act-t"><b>${r.title}</b><span>${t}</span></span>
          <span class="pf-amt${r.kind === 'in' ? ' pos' : ''}">${r.amount}</span>
        </li>`;
      }).join('')}</ul>`;
    }
  }
  return `<section class="pf-sec pf-activity"><h2 class="pf-h2">Activity</h2>${body}</section>`;
}

// Earning and sold cars both earned rent; a sold car's rent stays collectable after the sale.
const rents = (h) => h.stage.key === 'earning' || h.stage.key === 'sold';

function statusOf(h) {
  const c = h.c;
  switch (h.stage.key) {
    case 'earning': return ['pf-ok', 'On the road', 100];
    case 'sold': return ['pf-ok', 'Car sold', 100];
    case 'funding': {
      const p = Number(pct(c.sold, BigInt(c.totalShares), 0));
      return ['pf-red', `${p}% funded`, p];
    }
    case 'expired': return ['pf-red', 'Sale ended', Number(pct(c.sold, BigInt(c.totalShares), 0))];
    case 'cancelled': return ['pf-red', 'Not funded', 0];
    default: return ['', '', 0];
  }
}

function actionsOf(h) {
  const id = idOf(h.c);
  const collect = h.claim > 0n
    ? `<button class="btn pf-btn" type="button" data-act="claim" data-car="${id}"${off()}>${spin(`claim-${id}`)}Collect</button>` : '';
  switch (h.stage.key) {
    case 'earning':
      return `${collect}${h.shares > 0n ? `<a class="btn pf-btn" href="#/market" data-act="pfSell" data-car="${id}">Sell</a>` : ''}`;
    case 'sold':
      return `${collect}${h.shares > 0n
        ? `<button class="btn btn-p pf-btn" type="button" data-act="redeem" data-car="${id}"${off()} title="Your part of the sale">${spin(`redeem-${id}`)}Redeem ${vnd(h.redeem)}</button>` : ''}`;
    case 'funding':
      return `<a class="btn pf-btn" href="#/car/${id}">Buy more</a>`;
    case 'expired':
      return `<button class="btn pf-btn" type="button" data-act="cancelFunding" data-car="${id}"${off()}>${spin(`cancel-${id}`)}Close sale</button>`;
    case 'cancelled':
      return h.shares > 0n
        ? `<button class="btn btn-p pf-btn" type="button" data-act="refund" data-car="${id}"${off()}>${spin(`refund-${id}`)}Refund ${vnd(h.invested)}</button>` : '';
    default:
      return '';
  }
}

function carsList(hold, collectedBy) {
  if (!hold.length) {
    return `<section class="pf-sec"><h2 class="pf-h2">My cars</h2>
      <div class="pf-none"><p>No cars yet.</p><a class="btn btn-p pf-btn" href="#/">Browse cars</a></div>
    </section>`;
  }
  const rows = hold.map((h) => {
    const [cls, label, p] = statusOf(h);
    const earned = (collectedBy[idOf(h.c)] ?? 0n) + h.claim;
    const earn = rents(h)
      ? `<span class="pf-k">Earned</span><b class="pos">+${vndR(earned)}</b>`
      : h.stage.key === 'cancelled'
        ? '<span class="pf-k">Refund</span><b>Open</b>'
        : '<span class="pf-k">Starts earning</span><b class="pf-soft">when funded</b>';
    return `<li class="pf-car">
      <a class="pf-name" href="#/car/${idOf(h.c)}">${photo(h.c, 'pf-thumb', '')}
        <span><b>${esc(h.c.name)}</b><span class="pf-k">${plural(Number(h.shares), 'share')} · you own ${pct(h.shares, BigInt(h.c.totalShares))}%</span></span></a>
      <span class="pf-earn">${earn}</span>
      <span class="pf-st ${cls}"><span>${label}</span><span class="pf-bar"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></span></span>
      <span class="pf-do">${actionsOf(h)}</span>
    </li>`;
  }).join('');
  return `<section class="pf-sec"><h2 class="pf-h2">My cars</h2><ul class="pf-cars">${rows}</ul></section>`;
}

registerView('portfolio', () => {
  if (!S.account) {
    return `${head()}
      <section class="pf-login">
        <span class="pf-login-ic">${ICON.car}</span>
        <h2 class="pf-h2">Your cars live here</h2>
        <p>Log in to see your shares, rent and what's ready to collect.</p>
        <button class="btn btn-p pf-cta" type="button" data-act="connect">Log in</button>
      </section>`;
  }
  const me = S.data.me;
  if (!me) {
    return `${head()}
      <div class="pf-top"><section class="pf-ready"><p class="skel">Loading</p></section>
        <div class="pf-tiles"><div class="pf-tile"><p class="skel">Loading</p></div><div class="pf-tile"><p class="skel">Loading</p></div></div></div>`;
  }

  const hold = holdingsOf(me);
  const held = hold.filter((h) => h.shares > 0n);
  const invested = held.reduce((s, h) => s + h.invested, 0n);
  const ready = Object.values(me.claimable || {}).reduce((s, v) => s + big(v), 0n);
  const readyCars = hold.filter((h) => h.claim > 0n);

  const loading = S.events === null && !S.feedError;
  const collectedBy = {};
  let collected = 0n;
  if (!loading && !S.feedError) {
    for (const e of allEvents()) {
      if (e.name !== 'RentClaimed' || !same(e.args?.holder, me.address)) continue;
      const k = String(e.args.carId);
      collectedBy[k] = (collectedBy[k] ?? 0n) + big(e.args.amount);
      collected += big(e.args.amount);
    }
  }
  const earned = collected + ready;
  const month = new Date().toLocaleString('en-GB', { month: 'long' });
  const from = readyCars.length === 1 ? `From ${esc(readyCars[0].c.name)} · ${month}`
    : readyCars.length > 1 ? `From ${readyCars.length} cars · ${month}`
    : 'Nothing to collect right now';

  return `${head()}
    <div class="pf-top">
      <section class="pf-ready" aria-label="Ready to collect">
        <p class="pf-ready-l">Ready to collect</p>
        <p class="pf-ready-v">${vndFull(ready)}</p>
        <div class="pf-ready-f">
          <span>${from}</span>
          <button class="btn pf-collect" type="button" data-act="claimAll"${off(ready === 0n)}>${spin('claimAll')}Collect</button>
        </div>
      </section>
      <div class="pf-tiles">
        <div class="pf-tile"><span>Invested</span><b>${vndR(invested)}</b></div>
        <div class="pf-tile pf-tile-g"><span>Earned so far</span><b>${loading ? '<span class="skel">…</span>' : `+${vndR(earned)}`}</b></div>
      </div>
    </div>
    ${carsList(hold, collectedBy)}
    ${activity(me)}`;
});
