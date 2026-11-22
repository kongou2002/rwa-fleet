// Home: what FleetShares is (hero, three steps), the cars, then the track record read from the chain.
import {
  registerView, S, ui, cfg, esc, usd, fig, num, same, ICON,
  metaOf, valueOf, raisedOf, holdersOf, yieldToDate, targetNet, rangePct, stageOf,
  photo, spin, off, allEvents, TERMS, SERIES, exitOf, render,
} from '../core.js';
import { barChart, chartW } from '../chart.js';

const ORDER = { funding: 0, expired: 1, earning: 2, sold: 3, cancelled: 4 };
const idStr = (c) => c.id.toString();
const plate = (c) => `FS-${idStr(c).padStart(3, '0')}`;
const seriesOf = (carId) => SERIES[(Number(carId) - 1 + SERIES.length * 10) % SERIES.length];
const netRange = () => rangePct(TERMS.gross[0] * (1 - TERMS.fee / 100), TERMS.gross[1] * (1 - TERMS.fee / 100));
const pctBar = (c) => (c.totalShares ? Math.round((c.sold / c.totalShares) * 1000) / 10 : 0);

function metaLine(c) {
  const m = metaOf(c);
  const parts = [m.city, m.term ? `${m.term}-year term` : null].filter(Boolean);
  return parts.length ? parts.map(esc).join(' · ') : plate(c);
}

function resaleOf(c) {
  const r = metaOf(c).resale;
  return r ? (valueOf(c) * BigInt(Math.round(r * 100))) / 10000n : null;
}

// ---------- hero: what this is, in one screen ----------

const featuredOf = (cars) => cars.find((c) => stageOf(c).key === 'funding') || cars.find((c) => stageOf(c).key === 'earning') || cars[0];

function hero(cars) {
  const funding = cars.filter((c) => stageOf(c).key === 'funding');
  const from = funding.length ? funding.reduce((a, c) => (c.sharePrice < a ? c.sharePrice : a), funding[0].sharePrice) : null;
  const feat = featuredOf(cars);
  const cta = funding.length
    ? `<a class="btn btn-p btn-lg" href="#/car/${idStr(funding[0])}">Buy shares in ${esc(funding[0].name)} ${ICON.arrow}</a>`
    : '';
  return `<section class="hm-hero">
    <div class="hm-hero-t">
      <p class="hm-eyebrow">Rental cars in ${esc(TERMS.country)} · on Avalanche</p>
      <h1 class="hm-h1">Own part of a rental car.<br>Get paid its rent.</h1>
      <p class="hm-lede">Buy shares of a car${from !== null ? ` from <b>${usd(from)} VND</b>` : ''}. ${esc(TERMS.operator)} rents it out, the contract pays <b>${100 - TERMS.fee}% of every rent payment</b> to shareholders, and the car is sold at the end of its term to return your capital.</p>
      <div class="row hm-cta">${cta}<a class="btn btn-lg" href="#/how">How it works</a></div>
      <ul class="hm-facts">
        <li><b class="pos">${netRange()}</b><span>target a year, after fees</span></li>
        <li><b>${100 - TERMS.fee} / ${TERMS.fee}</b><span>rent split, fixed in the contract</span></li>
        <li><b>Escrow</b><span>full refund if a car doesn't sell out</span></li>
      </ul>
    </div>
    ${feat ? featuredCard(feat) : ''}
  </section>`;
}

function featuredCard(c) {
  const st = stageOf(c);
  const live = st.key === 'funding';
  return `<a class="hm-feat" href="#/car/${idStr(c)}" aria-label="${esc(c.name)}">
    ${photo(c, 'hm-feat-img', '')}
    <div class="hm-feat-b">
      <div class="hm-feat-top"><span>${st.pill}</span><span class="t-sm ink-3">${metaLine(c)}</span></div>
      <p class="t-h2">${esc(c.name)}</p>
      <div class="hm-feat-n">
        <div><p class="t-label">${live ? 'Target a year' : 'Paid so far'}</p><p class="t-fig pos">${live ? rangePct(...targetNet(c)) : `${yieldToDate(c)}%`}</p></div>
        <div><p class="t-label">Per share</p><p class="t-fig">${usd(c.sharePrice)}<span class="unit">VND</span></p></div>
      </div>
      ${live ? `<div class="bar"><i style="width:${pctBar(c)}%"></i></div>
      <p class="t-sm ink-3">${c.sold} of ${c.totalShares} shares sold · closes in <b class="ink-2" data-deadline="${c.fundingDeadline}">…</b></p>` : ''}
    </div>
  </a>`;
}

const STEPS = [
  ['Buy shares', 'Pick a car and buy as many shares as you like. Your money waits in the contract until the car sells out, or comes back in full if it doesn\'t.'],
  ['The car goes to work', `When the last share sells, the money goes to ${TERMS.operator}, who buys the car and rents it out.`],
  ['Collect rent, then the resale', `Each rent payment is split on arrival: ${100 - TERMS.fee}% to shareholders, ${TERMS.fee}% fee. Collect any time. At the end of the term the car is sold and the proceeds go to shareholders.`],
];

function steps() {
  return `<section class="hm-steps" aria-label="How it works">
    ${STEPS.map(([t, d], i) => `<div class="hm-step"><span class="hm-num">${i + 1}</span><h3 class="t-title">${t}</h3><p class="t-sm ink-2">${esc(d)}</p></div>`).join('')}
  </section>`;
}

// ---------- track record ----------

function kpis(cars) {
  const live = cars.filter((c) => !['cancelled', 'sold'].includes(stageOf(c).key)); // a sold car has left the vault
  const value = live.reduce((a, c) => a + valueOf(c), 0n);
  const rent = cars.reduce((a, c) => a + c.rentPaid, 0n);
  const fee = cars.reduce((a, c) => a + c.feePaid, 0n);
  const count = (k) => cars.filter((c) => stageOf(c).key === k).length;
  const earning = count('earning'), funding = count('funding') + count('expired'), sold = count('sold');
  const fleetSub = [`${earning} earning`, `${funding} funding`, sold ? `${sold} sold` : ''].filter(Boolean).join(' · ');
  return `<section class="kpis vt-kpis" aria-label="Track record">
    <div><p class="t-label">Rent paid to shareholders</p><p class="t-kpi pos">${fig(rent - fee)}</p><p class="t-sm">after the ${usd(fee)} VND fee</p></div>
    <div><p class="t-label">Value of cars on the road or funding</p><p class="t-kpi">${fig(value)}</p><p class="t-sm">${cars.length} ${cars.length === 1 ? 'car' : 'cars'}: ${fleetSub}</p></div>
  </section>`;
}

// ---------- rent chart ----------

function rentChart(cars) {
  const legendCars = cars.filter((c) => holdersOf(c) > 0n);
  const legend = legendCars.length
    ? `<div class="legend">${legendCars.map((c) => `<span><i style="background:${seriesOf(c.id)}"></i>${esc(c.name)} <b>${usd(holdersOf(c))}</b></span>`).join('')}</div>`
    : '';
  let body;
  if (!legendCars.length && S.events !== null) {
    body = `<div class="empty">${ICON.clock}<p class="t-sm ink-3">No rent has been paid yet. It shows here month by month once a funded car is on the road.</p></div>`;
  } else if (S.events === null) {
    body = S.feedError
      ? `<div class="empty"><p class="t-sm ink-3">The rent history could not be loaded. <button class="btn btn-sm" type="button" data-act="retry">Try again</button></p></div>`
      : '<p class="skel vt-skel">Loading rent history</p>';
  } else {
    const now = new Date();
    const months = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      months.push({ key: d.getFullYear() * 12 + d.getMonth(), label: d.toLocaleString('en-US', { month: 'short' }), long: d.toLocaleString('en-US', { month: 'long' }), by: {} });
    }
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    let inRange = 0;
    for (const e of allEvents()) {
      if (e.name !== 'RentPaid' || !e.time) continue;
      const d = new Date(Number(e.time) * 1000);
      const m = byKey[d.getFullYear() * 12 + d.getMonth()];
      if (!m) continue;
      const cid = e.args.carId.toString();
      m.by[cid] = (m.by[cid] || 0) + num(e.args.toHolders);
      inRange++;
    }
    if (!inRange) {
      body = `<div class="empty">${ICON.clock}<p class="t-sm ink-3">No rent in the last six months.</p></div>`;
    } else {
      const ids = cars.map(idStr);
      const groups = months.map((m) => ({ label: m.label, parts: ids.map((id) => ({ v: m.by[id] || 0, color: seriesOf(id) })) }));
      const totals = months.map((m) => Object.values(m.by).reduce((a, v) => a + v, 0));
      const fmt2 = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
      const aria = `Rent paid to holders by month: ${months.map((m, i) => `${m.long} ${fmt2(totals[i])}`).join(', ')} million VND`;
      body = `<figure class="chart">${barChart({ groups, width: chartW(720), height: chartW(240, 200), labels: 'last', aria })}</figure>`;
    }
  }
  return `<section class="card pad vt-chart">
    <div class="card-h">
      <div><h2 class="t-title">Rent paid to shareholders, by month</h2><p class="t-sm ink-3">Million VND, after the ${TERMS.fee}% fee</p></div>
      ${legend}
    </div>
    ${body}
  </section>`;
}

function splitCard() {
  const fee = TERMS.fee, hold = 100 - fee;
  return `<section class="card pad vt-split-card">
    <h2 class="t-title">Where each 100 VND of rent goes</h2>
    <p class="t-sm ink-3">The contract splits it the moment it arrives</p>
    <div class="vt-split" role="img" aria-label="${hold} VND to holders, ${fee} VND fee">
      <div class="vt-split-h" style="flex:${hold}">${hold} to holders</div>
      <div class="vt-split-f" style="flex:${Math.max(fee, 14)}">${fee} fee</div>
    </div>
    <dl class="kv">
      <div><dt>Operator</dt><dd>${esc(TERMS.operator)}, ${esc(TERMS.country)}</dd></div>
      <div><dt>Gross rent</dt><dd>${TERMS.gross[0]}–${TERMS.gross[1]}% a year</dd></div>
      <div><dt>Management fee</dt><dd>${fee}% of rent, fixed</dd></div>
      <div><dt>Car life</dt><dd>${esc(TERMS.life)}, then sold</dd></div>
      <div><dt>Reporting</dt><dd><a href="#/transparency">Monthly, via Avalanche ICM</a></dd></div>
    </dl>
  </section>`;
}

// ---------- car cards ----------

/** One headline number, one progress line, one action per card. */
function carCard(c) {
  const st = stageOf(c);
  const id = idStr(c);
  let big, bigLabel, line, action, bar;
  if (st.key === 'funding') {
    big = rangePct(...targetNet(c)); bigLabel = 'target a year';
    bar = `<i style="width:${pctBar(c)}%"></i>`;
    line = `${c.sold} of ${c.totalShares} shares sold · closes in <b class="vt-cd" data-deadline="${c.fundingDeadline}">…</b>`;
    action = '<span class="btn btn-p btn-w">Buy shares</span>';
  } else if (st.key === 'earning') {
    big = `${yieldToDate(c)}%`; bigLabel = 'paid to shareholders so far';
    bar = '<i class="full" style="width:100%"></i>';
    line = `Fully funded · on the road${metaOf(c).term ? ` for ${metaOf(c).term} years` : ''}`;
    action = '<span class="btn btn-w">View car</span>';
  } else if (st.key === 'sold') {
    const ex = exitOf(c);
    big = `${usd(ex.proceeds / BigInt(ex.totalShares))}<span class="unit">VND</span>`; bigLabel = 'resale paid per share';
    bar = '<i class="full" style="width:100%"></i>';
    line = `Sold · ${ex.redeemedShares} of ${ex.totalShares} shares redeemed`;
    action = '<span class="btn btn-w">View car</span>';
  } else {
    big = `${c.sold} / ${c.totalShares}`; bigLabel = 'shares sold';
    bar = `<i style="width:${pctBar(c)}%"></i>`;
    line = st.key === 'expired' ? 'Missed its deadline · close the sale to open refunds' : 'Did not sell out · refunds open';
    action = '<span class="btn btn-w">Get a refund</span>';
  }
  const pos = st.key === 'funding' || st.key === 'earning';
  return `<a class="car vt-car" href="#/car/${id}">
    <div class="vt-img-box">${photo(c, 'vt-img', c.name)}<span class="vt-pill">${st.pill}</span></div>
    <div class="car-b">
      <div><h3 class="t-title vt-name">${esc(c.name)}</h3><p class="t-sm ink-3">${metaLine(c)}</p></div>
      <div class="vt-big"><p class="t-kpi${pos ? ' pos' : ''}">${big}</p><p class="t-sm ink-3">${bigLabel}</p></div>
      <dl class="vt-mini"><div><dt>Per share</dt><dd>${usd(c.sharePrice)} VND</dd></div><div><dt>Car value</dt><dd>${usd(valueOf(c))} VND</dd></div></dl>
      <div class="vt-prog"><div class="bar" role="progressbar" aria-label="Shares sold" aria-valuemin="0" aria-valuemax="${c.totalShares}" aria-valuenow="${c.sold}">${bar}</div><p class="t-sm ink-3">${line}</p></div>
      ${action}
    </div>
  </a>`;
}

function carsSection(cars) {
  const sorted = [...cars].sort((a, b) => ORDER[stageOf(a).key] - ORDER[stageOf(b).key] || Number(a.id - b.id));
  const isFunding = (c) => c.statusName === 'Funding';
  const isEarning = (c) => stageOf(c).key === 'earning';
  const isSold = (c) => stageOf(c).key === 'sold';
  const counts = { all: cars.length, funding: cars.filter(isFunding).length, earning: cars.filter(isEarning).length, sold: cars.filter(isSold).length };
  let f = ui.vtFilter || 'all';
  if (!counts[f]) f = 'all';
  const shown = f === 'funding' ? sorted.filter(isFunding) : f === 'earning' ? sorted.filter(isEarning) : f === 'sold' ? sorted.filter(isSold) : sorted;
  const seg = [['all', 'All'], ['funding', 'Open to buy'], ['earning', 'Earning'], ['sold', 'Sold']]
    .filter(([k]) => k === 'all' || counts[k] > 0)
    .map(([k, label]) => `<button type="button" class="${f === k ? 'on' : ''}" aria-pressed="${f === k}" data-act="set" data-k="vtFilter" data-v="${k}">${label} ${counts[k]}</button>`)
    .join('');
  return `<div class="head vt-sec-head">
      <div><h2 class="t-h1">Cars</h2><p class="t-body ink-2">Open a car to see its numbers and buy shares.</p></div>
      ${cars.length > 1 ? `<div class="seg" role="group" aria-label="Filter cars">${seg}</div>` : ''}
    </div>
    ${shown.length
      ? `<div class="cars vt-cars">${shown.map(carCard).join('')}</div>`
      : `<div class="card pad empty">${ICON.car}<p class="t-sm ink-3">No cars are listed yet.</p></div>`}`;
}

// ---------- register ----------

function register(cars) {
  if (!cars.length) return '';
  const anySold = cars.some((c) => exitOf(c));
  const rows = cars.map((c) => {
    const st = stageOf(c);
    const m = metaOf(c);
    const ex = exitOf(c);
    const est = ex ? null : resaleOf(c);
    // Actual resale once the sale is recorded; otherwise the estimate (marked as one when real figures sit beside it).
    const resaleCell = ex ? `<td class="num">${usd(ex.proceeds)}</td>`
      : est === null ? '<td class="r ink-3">–</td>'
      : `<td class="num">${anySold ? '<span class="ink-3">est.</span> ' : ''}${usd(est)}</td>`;
    let yieldCell;
    if (st.key === 'earning' || st.key === 'sold') yieldCell = `<td class="num pos">${yieldToDate(c)}%</td>`;
    else if (st.key === 'cancelled') yieldCell = '<td class="r ink-3">–</td>';
    else yieldCell = `<td class="r ink-3">${rangePct(...targetNet(c))} target</td>`;
    return `<tr>
      <td><a class="carcell" href="#/car/${idStr(c)}">${photo(c, 'thumb', '')}${esc(c.name)}</a></td>
      <td>${m.city ? esc(m.city) : '<span class="ink-3">–</span>'}</td>
      <td>${st.pill}</td>
      <td class="num">${c.sold} / ${c.totalShares}</td>
      <td class="num">${usd(valueOf(c))}</td>
      ${yieldCell}
      ${resaleCell}
      <td class="r">${m.term ? `${m.term} years` : '<span class="ink-3">–</span>'}</td>
    </tr>`;
  }).join('');
  return `<details class="card vt-register">
    <summary class="pad"><span><b class="t-title">All cars in one table</b><span class="t-sm ink-3"> · read from the contract, amounts in VND</span></span><span class="vt-chev" aria-hidden="true"></span></summary>
    <div class="tbl-box vt-reg-body">
      <table class="t">
        <thead><tr><th>Car</th><th>City</th><th>Status</th><th class="r">Shares sold</th><th class="r">Car value</th><th class="r">Net yield</th><th class="r">${anySold ? 'Resale' : 'Resale (est.)'}</th><th class="r">Term</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </details>`;
}

// ---------- role tools ----------

function roleTools(cars) {
  if (!S.account) return '';
  let html = '';
  if (same(S.account, S.data.manager)) {
    const f = ui.list || {};
    const open = !!ui.vtList;
    const field = (k, label, ph, mode = '') => `<div class="field"><label for="list-${k}">${label}</label><input class="input" id="list-${k}" data-bind="list" data-k="${k}" value="${esc(f[k] ?? '')}" placeholder="${esc(ph)}" ${mode ? `inputmode="${mode}"` : ''} autocomplete="off"></div>`;
    html += `<section class="card pad vt-role" aria-label="Manager tools">
      <div class="card-h"><div><h2 class="t-h2">Manager tools</h2><p class="t-sm ink-3">Only the manager wallet sees this.</p></div></div>
      <div class="vt-role-grid">
        <div class="vt-fees">
          <p class="t-label">Fees ready to withdraw</p>
          <p class="t-kpi">${fig(S.data.feesOwed)}</p>
          <p class="t-sm ink-3">${TERMS.fee}% of every rent payment. This is the only money the manager can take out.</p>
          <button class="btn" type="button" data-act="withdrawFees"${off(S.data.feesOwed === 0n)}>${spin('fees')}Withdraw fees</button>
        </div>
        <div class="vt-list">
          <div class="vt-list-h"><h3 class="t-title">List a new car</h3>
            <button class="btn btn-sm" type="button" data-act="set" data-k="vtList" data-v="${open ? '' : '1'}" aria-expanded="${open}">${open ? 'Close form' : 'Open form'}</button></div>
          ${open ? `<div class="vt-form">
            ${field('name', 'Car name', 'Toyota Vios 2024')}
            ${field('image', 'Photo URL (https)', 'https://…')}
            ${field('docs', 'Documents: text to hash, or a 0x hash', 'Registration and rental agreement')}
            ${field('operator', 'Operator address', cfg.operator || '0x…')}
            ${field('shares', 'Number of shares', '100', 'numeric')}
            ${field('price', 'Price per share (VND)', '6,250,000', 'decimal')}
            ${field('days', 'Funding period (days)', '30', 'decimal')}
          </div>
          <button class="btn btn-p" type="button" data-act="listCar"${off()}>${spin('list')}List car</button>` : '<p class="t-sm ink-3">Opens a sale for a new car. Shares, price and the funding window are fixed once listed.</p>'}
        </div>
      </div>
    </section>`;
  }
  const mine = cars.filter((c) => same(c.operator, S.account));
  if (mine.length) {
    html += `<div class="note vt-op">${ICON.car}<span>You operate ${mine.map((c) => `<a href="#/car/${idStr(c)}">${esc(c.name)}</a>`).join(', ')}. Pay rent from each car's page once it is funded. The contract splits it ${100 - TERMS.fee} / ${TERMS.fee} on arrival.</span></div>`;
  }
  return html;
}

registerView('vault', () => {
  const cars = S.data.cars;
  return `${hero(cars)}
    ${steps()}
    <section class="vt-cars-sec" aria-label="Cars">${carsSection(cars)}</section>
    <section class="vt-record" aria-labelledby="vt-record-h">
      <div class="head vt-sec-head"><div><h2 class="t-h1" id="vt-record-h">Track record</h2><p class="t-body ink-2">Read live from the contracts on Avalanche. <a href="#/transparency">Check reported vs. paid rent ${ICON.arrow}</a></p></div></div>
      ${kpis(cars)}
      <div class="vt-two">${rentChart(cars)}${splitCard()}</div>
      ${register(cars)}
    </section>
    ${roleTools(cars)}`;
});

// Charts are drawn at a narrower viewBox on phones (chartW); redraw when the layout crosses the phone breakpoint.
if (typeof matchMedia === 'function') matchMedia('(max-width: 720px)').addEventListener('change', () => render());
