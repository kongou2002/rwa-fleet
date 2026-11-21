import {
  registerView, S, ui, esc, same, usd, num, fig, trim, parseUsd, parseShares, plural,
  who, carById, photo, targetNet, rangePct, spin, off, ICON, exitOf, pill,
} from '../core.js';

const idOf = (c) => c.id.toString();

// Signed percent of offer price against issue price, e.g. '−1.8%' / '+4.3%' / '0%'.
function vsIssue(price, car) {
  const issue = num(car.sharePrice);
  const d = ((num(price) - issue) / issue) * 100;
  const r = Math.round(d * 10) / 10;
  if (r === 0) return { text: '0%', cls: 'ink-2', word: 'Same as issue price', d: 0 };
  const text = `${r < 0 ? '−' : '+'}${trim(Math.abs(r))}%`;
  return r < 0
    ? { text, cls: 'pos', word: `${text} discount`, d: r }
    : { text, cls: 'ink-2', word: `${text} premium`, d: r };
}

// Target net yield range scaled to what a buyer pays at this price.
function yieldAt(price, car) {
  const [lo, hi] = targetNet(car);
  const k = num(car.sharePrice) / num(price);
  return rangePct(lo * k, hi * k);
}

function offersCard() {
  const open = S.data.offers.filter((o) => o.amount > 0);
  const carIds = [...new Set(open.map((o) => o.carId.toString()))];
  const filter = carIds.includes(String(ui.mkCar)) ? String(ui.mkCar) : 'all';
  const shown = filter === 'all' ? open : open.filter((o) => o.carId.toString() === filter);
  const totalShares = open.reduce((s, o) => s + o.fillable, 0);

  // Cheapest takeable offer relative to its car's issue price gets the primary button.
  let best = null, bestRatio = Infinity;
  for (const o of shown) {
    if (same(o.seller, S.account) || o.fillable < 1) continue;
    const car = carById(o.carId);
    const ratio = num(o.pricePerShare) / num(car.sharePrice);
    if (ratio < bestRatio) { bestRatio = ratio; best = o.id; }
  }

  const seg = carIds.length ? `<div class="seg" role="group" aria-label="Filter by car">
      <button type="button" class="${filter === 'all' ? 'on' : ''}" aria-pressed="${filter === 'all'}" data-act="set" data-k="mkCar" data-v="all">All</button>
      ${carIds.map((id) => `<button type="button" class="${filter === id ? 'on' : ''}" aria-pressed="${filter === id}" data-act="set" data-k="mkCar" data-v="${esc(id)}">${esc(carById(id)?.name ?? `Car ${id}`)}</button>`).join('')}
    </div>` : '';

  const rows = shown.map((o) => {
    const oid = o.id.toString();
    const car = carById(o.carId);
    const vs = vsIssue(o.pricePerShare, car);
    const ex = exitOf(car); // sold: these shares are a claim on the resale payout, not on future rent
    const mine = same(o.seller, S.account);
    let cell;
    if (mine) {
      cell = `<button class="btn btn-sm" type="button" data-act="cancelOffer" data-offer="${oid}"${off()}>${spin(`unoffer-${oid}`)}Cancel offer</button>`;
    } else if (o.fillable < 1) {
      cell = '<span class="t-sm ink-3">Seller has no shares left</span>';
    } else if (!S.account) {
      cell = '<button class="btn btn-sm" type="button" data-act="connect">Connect to buy</button>';
    } else {
      const qty = ui.take[oid] ?? String(o.fillable);
      const n = Math.min(parseShares(qty), o.fillable);
      cell = `<span class="mk-take">
          <input class="input mk-qty" id="take-${oid}" data-bind="take" data-offer="${oid}" value="${esc(qty)}" inputmode="numeric" autocomplete="off" aria-label="Shares to buy from offer ${oid}, up to ${o.fillable}">
          <button class="btn btn-sm${o.id === best ? ' btn-p' : ''}" type="button" data-act="takeOffer" data-offer="${oid}"${off(n < 1)}>${spin(`take-${oid}`)}Buy for ${usd(BigInt(n) * o.pricePerShare)}</button>
        </span>`;
    }
    return `<tr>
      <td><a class="carcell" href="#/car/${idOf(car)}">${photo(car, 'thumb', '')}${esc(car.name)}</a>${ex ? ` ${pill('', 'Sold')}` : ''}</td>
      <td class="t-addr ink-2" data-l="Seller">${who(o.seller)}</td>
      <td class="num" data-l="Shares">${o.fillable}${o.fillable < o.amount ? ` <span class="ink-3 mk-of">of ${o.amount}</span>` : ''}</td>
      <td class="num" data-l="Price">${usd(o.pricePerShare)}</td>
      <td class="r ${vs.cls}" data-l="vs. issue">${vs.text}</td>
      ${ex
        ? `<td class="r ink-2" data-l="Payout" title="The car is sold: each share redeems for its part of the sale">${usd(ex.proceeds / BigInt(ex.totalShares))} payout</td>`
        : `<td class="num pos" data-l="Buyer yield">${yieldAt(o.pricePerShare, car)}</td>`}
      <td class="r mk-act">${cell}</td>
    </tr>`;
  }).join('');

  const body = open.length
    ? `<div class="tbl-box">
        <table class="t mk-tbl">
          <thead><tr><th>Car</th><th>Seller</th><th class="r">Shares</th><th class="r">Price</th><th class="r">vs. issue</th><th class="r">Buyer yield</th><th class="r"><span class="mk-sr">Action</span></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="t-sm ink-3 mk-foot">Buyer yield is the car's target net rent yield, scaled by issue price over offer price.</p>`
    : `<div class="empty">${ICON.car}<p class="t-sm ink-3">No shares are for sale right now. Holders of a funded car can list theirs here.</p></div>`;

  return `<section class="card pad mk-book">
    <div class="card-h mk-ch">
      <div><h2 class="t-title">Open offers</h2><p class="t-sm ink-3">${plural(open.length, 'offer')} · ${plural(totalShares, 'share')}</p></div>
      ${seg}
    </div>
    ${body}
  </section>`;
}

function sellCard() {
  const head = `<div><h2 class="t-title">Sell shares</h2><p class="t-sm ink-3">Listed shares keep earning rent until sold</p></div>`;
  if (!S.account) {
    return `<section class="card pad mk-sell">${head}
      <p class="t-sm ink-2">Connect a wallet to list shares you hold.</p>
      <button class="btn btn-p btn-w" type="button" data-act="connect">${ICON.wallet}Connect wallet</button>
    </section>`;
  }
  const me = S.data.me;
  if (!me) return `<section class="card pad mk-sell">${head}<p class="skel">Loading your shares</p></section>`;

  const held = S.data.cars.filter((c) => c.statusName === 'Active' && (me.shares[c.id] ?? 0n) > 0n);
  const mineOpen = S.data.offers.filter((o) => o.amount > 0 && same(o.seller, S.account));
  const myList = mineOpen.length ? `<div class="mk-mine">
      <h3 class="t-label">Your open offers</h3>
      <ul>${mineOpen.map((o) => {
        const oid = o.id.toString();
        return `<li><span class="t-sm"><b>${plural(o.amount, 'share')}</b> · ${esc(carById(o.carId)?.name ?? '')} · ${usd(o.pricePerShare)} each</span>
          <button class="btn btn-sm" type="button" data-act="cancelOffer" data-offer="${oid}"${off()}>${spin(`unoffer-${oid}`)}Cancel</button></li>`;
      }).join('')}</ul>
    </div>` : '';

  if (!held.length) {
    return `<section class="card pad mk-sell">${head}
      <p class="t-sm ink-2">Shares become tradable once a car is fully funded and starts earning rent. You hold none of those yet.</p>
      <a class="btn btn-w" href="#/">Browse cars in the vault</a>
      ${myList}
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
  const vs = okPrice ? vsIssue(price, car) : null;

  return `<section class="card pad mk-sell">${head}
    <div class="seg mk-seg" role="group" aria-label="Car to sell">
      ${held.map((c) => `<button type="button" class="${idOf(c) === sel ? 'on' : ''}" aria-pressed="${idOf(c) === sel}" data-act="set" data-k="mkSell" data-v="${idOf(c)}">${esc(c.name)} · ${Number(me.shares[c.id])}</button>`).join('')}
    </div>
    <div class="field">
      <label for="offer-amt-${sel}">Shares</label>
      <div class="input-suffix"><input class="input" id="offer-amt-${sel}" data-bind="offer" data-car="${sel}" data-k="amount" value="${esc(f.amount ?? '')}" placeholder="${Math.min(5, mine)}" inputmode="numeric" autocomplete="off"><span>of ${mine}</span></div>
    </div>
    <div class="field">
      <label for="offer-price-${sel}">Price per share</label>
      <div class="input-suffix"><input class="input" id="offer-price-${sel}" data-bind="offer" data-car="${sel}" data-k="price" value="${esc(f.price ?? '')}" placeholder="${usd(car.sharePrice)}" inputmode="decimal" autocomplete="off"><span>USDC · issued at ${usd(car.sharePrice)}</span></div>
    </div>
    ${tooMany ? `<p class="t-sm risk">You hold ${plural(mine, 'share')} of ${esc(car.name)}.</p>` : ''}
    ${vs ? `<dl class="kv">
      <div><dt>vs. issue price</dt><dd class="${vs.d < 0 ? 'pos' : ''}">${vs.word}</dd></div>
      <div><dt>Target yield at this price</dt><dd class="pos">${yieldAt(price, car)}</dd></div>
    </dl>` : ''}
    <div class="total"><span class="t-sm ink-3">You receive if all sell</span><span class="t-fig">${n && okPrice && !tooMany ? fig(BigInt(n) * price) : '–'}</span></div>
    <button class="btn btn-p btn-lg btn-w" type="button" data-act="makeOffer" data-car="${sel}"${off(n < 1 || tooMany || !okPrice)}>${spin(`offer-${sel}`)}Post offer</button>
    ${myList}
  </section>`;
}

registerView('market', () => `
  <div class="head">
    <div class="mk-intro">
      <h1 class="t-display">Market</h1>
      <p class="t-body ink-2">Buy and sell shares of funded cars. The seller is paid directly, and future rent follows the shares.</p>
    </div>
  </div>
  <div class="mk-grid">
    ${offersCard()}
    ${sellCard()}
  </div>`);
