import {
  registerView, S, ui, esc, same, usd, toVnd, num, trim, parseUsd, parseShares, plural,
  carById, metaOf, photo, targetNet, spin, off, ICON, exitOf, ago,
} from '../core.js?v=20261125e';

const idOf = (c) => c.id.toString();
const vnd = (v) => `₫${usd(v)}`;
/** A number of million VND as '₫71k' or '₫1.25M'. */
const vndM = (m) => (m >= 1 ? `₫${trim(m, 2)}M` : `₫${Math.round(m * 1000)}k`);

/** Expected net rent per share per month at the target yield midpoint, in million VND. */
function monthlyPerShare(car) {
  const [lo, hi] = targetNet(car);
  return (num(car.sharePrice) * ((lo + hi) / 2)) / 100 / 12;
}

/** When the offer was posted, from the event feed when it has it. */
function listedAgo(oid) {
  const ev = (S.events || []).find((e) => e.name === 'OfferMade' && String(e.args?.offerId) === oid);
  return ev?.time ? `listed ${ago(ev.time)}` : 'listed by you';
}

function forSale() {
  const open = S.data.offers.filter((o) => o.amount > 0);
  const carIds = [...new Set(open.map((o) => o.carId.toString()))];
  const filter = carIds.includes(String(ui.mkCar)) ? String(ui.mkCar) : 'all';
  const shown = filter === 'all' ? open : open.filter((o) => o.carId.toString() === filter);

  // The cheapest takeable offer (against its car's issue price) gets the black button.
  let best = null, bestRatio = Infinity;
  for (const o of shown) {
    if (same(o.seller, S.account) || o.fillable < 1) continue;
    const ratio = num(o.pricePerShare) / num(carById(o.carId).sharePrice);
    if (ratio < bestRatio) { bestRatio = ratio; best = o.id; }
  }
  // Buyable rows first, cheapest first; own listings last.
  shown.sort((a, b) => {
    const rank = (o) => (same(o.seller, S.account) ? 2 : o.fillable < 1 ? 1 : 0);
    return rank(a) - rank(b) || num(a.pricePerShare) / num(carById(a.carId).sharePrice) - num(b.pricePerShare) / num(carById(b.carId).sharePrice);
  });

  const chips = carIds.length > 1 ? `<div class="mk-chips" role="group" aria-label="Filter by car">
      <button type="button" class="chip${filter === 'all' ? ' on' : ''}" aria-pressed="${filter === 'all'}" data-act="set" data-k="mkCar" data-v="all">All</button>
      ${carIds.map((id) => `<button type="button" class="chip${filter === id ? ' on' : ''}" aria-pressed="${filter === id}" data-act="set" data-k="mkCar" data-v="${esc(id)}">${esc(carById(id)?.name ?? `Car ${id}`)}</button>`).join('')}
    </div>` : '';

  const rows = shown.map((o) => {
    const oid = o.id.toString();
    const car = carById(o.carId);
    const ex = exitOf(car); // sold: the shares are a claim on the sale money, not on future rent
    const mine = same(o.seller, S.account);
    const city = metaOf(car).city;
    const below = o.pricePerShare < car.sharePrice;

    let act;
    if (mine) {
      act = `<button class="btn mk-btn" type="button" data-act="cancelOffer" data-offer="${oid}"${off()}>${spin(`unoffer-${oid}`)}Remove</button>`;
    } else if (o.fillable < 1) {
      act = '<span class="t-sm ink-3">Seller has none left</span>';
    } else if (!S.account) {
      act = `<button class="btn mk-btn" type="button" data-act="connect">Log in to buy</button>`;
    } else {
      const qty = ui.take[oid] ?? String(o.fillable);
      const n = Math.min(parseShares(qty), o.fillable);
      act = `<span class="mk-take">
          ${o.fillable > 1 ? `<input class="mk-qty" id="take-${oid}" data-bind="take" data-offer="${oid}" value="${esc(qty)}" inputmode="numeric" autocomplete="off" aria-label="Shares to buy, up to ${o.fillable}" title="Shares to buy">` : ''}
          <button class="btn mk-btn${o.id === best ? ' btn-p' : ''}" type="button" data-act="takeOffer" data-offer="${oid}"${off(n < 1)}>${spin(`take-${oid}`)}Buy ${vnd(BigInt(n) * o.pricePerShare)}</button>
        </span>`;
    }

    const earn = ex
      ? `<span class="mk-fig">${vnd(ex.proceeds / BigInt(ex.totalShares))}</span><span class="mk-sub">payout per share</span>`
      : `<span class="mk-fig pos">~${vndM(monthlyPerShare(car))}/mo</span><span class="mk-sub">per share</span>`;

    return `<li class="mk-row${mine ? ' mk-mine' : ''}">
      <a class="mk-car" href="#/car/${idOf(car)}">
        ${photo(car, 'mk-thumb', '')}
        <span class="mk-name"><b>${esc(car.name)}</b>${mine ? '<span class="mk-yours">Yours</span>' : ''}${ex ? '<span class="mk-yours">Sold</span>' : ''}
          <span class="mk-sub">${plural(o.fillable < o.amount && !mine ? o.fillable : o.amount, 'share')} · ${mine ? esc(listedAgo(oid)) : esc(city || 'on the road')}</span></span>
      </a>
      <span class="mk-col"><span class="mk-fig">${vnd(o.pricePerShare)}</span><span class="mk-sub${below ? ' pos' : ''}">${below ? 'below issue price' : 'per share'}</span></span>
      <span class="mk-col">${earn}</span>
      <span class="mk-act">${act}</span>
    </li>`;
  }).join('');

  const body = shown.length
    ? `<ul class="mk-list">${rows}</ul>`
    : `<div class="mk-empty">${ICON.car}<p>Nothing for sale right now.</p></div>`;

  return `<section class="mk-book">
    <div class="mk-h"><h2 class="mk-h2">For sale</h2>${chips}</div>
    ${body}
  </section>`;
}

function sellCard() {
  const head = '<h2 class="mk-h2">Sell your shares</h2>';
  if (!S.account) {
    return `<section class="mk-sell">${head}
      <p class="mk-note-l">Log in to list shares you own.</p>
      <button class="btn btn-p mk-cta" type="button" data-act="connect">Log in</button>
    </section>`;
  }
  const me = S.data.me;
  if (!me) return `<section class="mk-sell">${head}<p class="skel">Loading your shares</p></section>`;

  const held = S.data.cars.filter((c) => c.statusName === 'Active' && (me.shares[c.id] ?? 0n) > 0n);
  if (!held.length) {
    return `<section class="mk-sell">${head}
      <p class="mk-note-l">You can sell once a car you own is on the road.</p>
      <a class="btn mk-cta" href="#/">Browse cars</a>
    </section>`;
  }

  const ids = held.map(idOf);
  const sel = ids.includes(String(ui.mkSell)) ? String(ui.mkSell) : ids[0];
  const car = carById(sel);
  const mine = Number(me.shares[car.id]);
  const f = ui.offer[sel] || {};
  const n = parseShares(f.amount);
  const price = parseUsd(f.price);
  const okPrice = price !== null && price > 0n;
  const tooMany = n > mine;
  const total = n && okPrice && !tooMany ? BigInt(n) * price : null;

  const carOpt = (c) => {
    const on = idOf(c) === sel;
    return `<button type="button" class="mk-opt${on ? ' on' : ''}" aria-pressed="${on}" data-act="set" data-k="mkSell" data-v="${idOf(c)}">
        ${photo(c, 'mk-opt-img', '')}<b>${esc(c.name)}</b><span>${Number(me.shares[c.id])} owned</span>
      </button>`;
  };

  return `<section class="mk-sell">${head}
    <div class="mk-field">
      <span class="mk-lab" id="mk-car-l">Car</span>
      <div class="mk-opts" role="group" aria-labelledby="mk-car-l">${held.map(carOpt).join('')}</div>
    </div>
    <div class="mk-pair">
      <div class="mk-field">
        <label class="mk-lab" for="offer-amt-${sel}">Shares</label>
        <input class="mk-in" id="offer-amt-${sel}" data-bind="offer" data-car="${sel}" data-k="amount" value="${esc(f.amount ?? '')}" placeholder="${Math.min(5, mine)}" inputmode="numeric" autocomplete="off">
      </div>
      <div class="mk-field">
        <label class="mk-lab" for="offer-price-${sel}">Price each</label>
        <input class="mk-in" id="offer-price-${sel}" data-bind="offer" data-car="${sel}" data-k="price" value="${esc(f.price ?? '')}" placeholder="${toVnd(car.sharePrice).toLocaleString('en-US')}" inputmode="decimal" autocomplete="off">
      </div>
    </div>
    <p class="mk-hint${tooMany ? ' mk-bad' : ''}">${tooMany ? `You own ${plural(mine, 'share')}.` : `Issued at ${vnd(car.sharePrice)}.`}</p>
    <div class="mk-total"><span>You get</span><b>${total === null ? '–' : `₫${toVnd(total).toLocaleString('en-US')}`}</b></div>
    <button class="btn btn-p mk-cta" type="button" data-act="makeOffer" data-car="${sel}"${off(n < 1 || tooMany || !okPrice)}>${spin(`offer-${sel}`)}List for sale</button>
    <p class="mk-note">Your shares keep earning until they sell.</p>
  </section>`;
}

registerView('market', () => `
  <div class="mk-head">
    <h1 class="mk-title">Resell</h1>
    <p class="mk-lede">Shares of cars on the road. Buy from owners, or sell yours.</p>
  </div>
  <div class="mk-grid">
    ${forSale()}
    ${sellCard()}
  </div>`);
