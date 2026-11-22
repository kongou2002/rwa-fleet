// Vault (home): fleet summary, rent chart, cars, register, role tools.
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

// ---------- head + KPIs ----------

function head(cars) {
  const open = cars.find((c) => stageOf(c).key === 'funding');
  return `<div class="head vt-head">
    <div class="vt-intro">
      <h1 class="t-display">Fleet Vault</h1>
      <p class="t-body ink-2">Rental cars in ${esc(TERMS.country)}, owned in shares.<span class="hide-phone"> ${esc(TERMS.operator)} rents them out, rent is split on-chain, and each car is sold after ${esc(TERMS.life)} to return capital.</span></p>
    </div>
    <div class="row">
      <a class="btn" href="#/how">How it works</a>
      ${open ? `<a class="btn btn-p" href="#/car/${idStr(open)}">Buy shares</a>` : ''}
    </div>
  </div>`;
}

function kpis(cars) {
  const live = cars.filter((c) => !['cancelled', 'sold'].includes(stageOf(c).key)); // a sold car has left the vault
  const value = live.reduce((a, c) => a + valueOf(c), 0n);
  const escrow = cars.filter((c) => c.statusName === 'Funding').reduce((a, c) => a + raisedOf(c), 0n);
  const rent = cars.reduce((a, c) => a + c.rentPaid, 0n);
  const fee = cars.reduce((a, c) => a + c.feePaid, 0n);
  const count = (k) => cars.filter((c) => stageOf(c).key === k).length;
  const earning = count('earning'), funding = count('funding') + count('expired'), cancelled = count('cancelled'), sold = count('sold');
  const fleetSub = [`${earning} earning`, `${funding} funding`, sold ? `${sold} sold` : '', cancelled ? `${cancelled} cancelled` : ''].filter(Boolean).join(' · ');
  return `<section class="kpis vt-kpis" aria-label="Vault summary">
    <div><p class="t-label">Target net rent yield</p><p class="t-kpi pos">${netRange()}</p><p class="t-sm">${TERMS.gross[0]}–${TERMS.gross[1]}% gross rent, after the ${TERMS.fee}% fee</p></div>
    <div><p class="t-label">Vault value</p><p class="t-kpi">${fig(value)}</p><p class="t-sm">${usd(escrow)} VND in funding escrow</p></div>
    <div><p class="t-label">Paid to holders</p><p class="t-kpi">${fig(rent - fee)}</p><p class="t-sm">${usd(fee)} VND management fee</p></div>
    <div><p class="t-label">Fleet</p><p class="t-kpi">${cars.length}<span class="unit">${cars.length === 1 ? 'car' : 'cars'}</span></p><p class="t-sm">${fleetSub}</p></div>
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
      <div><h2 class="t-title">Rent paid to holders</h2><p class="t-sm ink-3">Million VND per month, after the ${TERMS.fee}% fee</p></div>
      ${legend}
    </div>
    ${body}
  </section>`;
}

function splitCard() {
  const fee = TERMS.fee, hold = 100 - fee;
  return `<section class="card pad vt-split-card">
    <h2 class="t-title">Where 100 VND of rent goes</h2>
    <p class="t-sm ink-3">Split by the contract when rent arrives</p>
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

function carCard(c) {
  const st = stageOf(c);
  const id = idStr(c);
  const m = metaOf(c);
  const w = pctBar(c);
  const shares = `${c.sold} of ${c.totalShares} shares sold`;
  let stats, bar, caption, rowRight, rowSub;
  if (st.key === 'earning') {
    stats = [['Net yield to date', `<span class="pos">${yieldToDate(c)}%</span>`], ['Per share', `${usd(c.sharePrice)} VND`], ['Car value', `${usd(valueOf(c))} VND`]];
    bar = '<i class="full" style="width:100%"></i>';
    caption = `Fully funded · ${usd(c.rentPaid)} VND rent paid in`;
    rowRight = `<span class="t-title pos">${yieldToDate(c)}%</span>`;
    rowSub = [m.city, 'Earning'].filter(Boolean).map(esc).join(' · ');
  } else if (st.key === 'funding') {
    stats = [['Target net yield', rangePct(...targetNet(c))], ['Per share', `${usd(c.sharePrice)} VND`], ['Closes in', `<b class="vt-cd" data-deadline="${c.fundingDeadline}">…</b>`]];
    bar = `<i style="width:${w}%"></i>`;
    caption = `${shares} · ${usd(raisedOf(c))} of ${usd(valueOf(c))} VND`;
  } else if (st.key === 'expired') {
    stats = [['Target net yield', rangePct(...targetNet(c))], ['Per share', `${usd(c.sharePrice)} VND`], ['Deadline', '<span class="warn-t">Passed</span>']];
    bar = `<i style="width:${w}%"></i>`;
    caption = `${shares} · missed its deadline, close the sale to open refunds`;
  } else if (st.key === 'sold') {
    const ex = exitOf(c);
    stats = [['Resale proceeds', `${usd(ex.proceeds)} VND`], ['Per share', `${usd(ex.proceeds / BigInt(ex.totalShares))} VND`], ['Net yield to date', `<span class="pos">${yieldToDate(c)}%</span>`]];
    bar = '<i class="full" style="width:100%"></i>';
    caption = `Sold for ${usd(ex.proceeds)} VND · ${ex.redeemedShares} of ${ex.totalShares} shares redeemed`;
  } else {
    stats = [['Per share', `${usd(c.sharePrice)} VND`], ['Car value', `${usd(valueOf(c))} VND`], ['Sold', `${c.sold} / ${c.totalShares}`]];
    bar = `<i style="width:${w}%"></i>`;
    caption = 'Sale closed without selling out · refunds open';
  }
  const compact = st.key === 'earning';
  return `<a class="car vt-car${compact ? ' vt-car--row' : ''}" href="#/car/${id}">
    ${photo(c, 'vt-img', c.name)}
    <div class="car-b">
      <div class="vt-car-top">
        <div class="vt-car-name"><h3 class="t-title">${esc(c.name)}</h3><p class="t-sm ink-3 vt-sub">${metaLine(c)}</p>${compact ? `<p class="t-sm ink-3 vt-sub-row">${rowSub}</p>` : ''}</div>
        <span class="vt-pill">${st.pill}</span>
        ${compact ? `<span class="vt-row-y">${rowRight}</span>` : ''}
      </div>
      <dl class="stats3">${stats.map(([k, v]) => `<div><dt class="t-label">${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="vt-prog"><div class="bar" role="progressbar" aria-label="Shares sold" aria-valuemin="0" aria-valuemax="${c.totalShares}" aria-valuenow="${c.sold}">${bar}</div><p class="t-sm ink-3">${caption}</p></div>
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
  const seg = [['all', 'All'], ['funding', 'Funding'], ['earning', 'Earning'], ['sold', 'Sold']]
    .filter(([k]) => k === 'all' || counts[k] > 0)
    .map(([k, label]) => `<button type="button" class="${f === k ? 'on' : ''}" aria-pressed="${f === k}" data-act="set" data-k="vtFilter" data-v="${k}">${label} ${counts[k]}</button>`)
    .join('');
  return `<div class="head vt-sec-head">
      <div><h2 class="t-h2">Cars in the vault</h2><p class="t-sm ink-3">Buy a fraction of any car. Prices in VND.</p></div>
      ${cars.length ? `<div class="seg" role="group" aria-label="Filter cars">${seg}</div>` : ''}
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
  return `<section class="card pad vt-register">
    <div class="card-h"><div><h2 class="t-h2">Fleet register</h2><p class="t-sm ink-3">Every car the vault holds, read from the contract. Amounts in VND.</p></div><a class="btn btn-sm" href="#/transparency">Reports</a></div>
    <div class="tbl-box">
      <table class="t">
        <thead><tr><th>Car</th><th>City</th><th>Status</th><th class="r">Shares sold</th><th class="r">Car value</th><th class="r">Net yield</th><th class="r">${anySold ? 'Resale' : 'Resale (est.)'}</th><th class="r">Term</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
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
  return `${head(cars)}
    ${kpis(cars)}
    <div class="vt-two">${rentChart(cars)}${splitCard()}</div>
    ${carsSection(cars)}
    ${register(cars)}
    ${roleTools(cars)}`;
});

// Charts are drawn at a narrower viewBox on phones (chartW); redraw when the layout crosses the phone breakpoint.
if (typeof matchMedia === 'function') matchMedia('(max-width: 720px)').addEventListener('change', () => render());
