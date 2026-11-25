// Cars (home): hero, KPI strip, car grid, records teaser, CTA, and manager/operator tools below.
import {
  registerView, S, ui, cfg, esc, usd, toVnd, same, ICON,
  metaOf, holdersOf, targetNet, stageOf,
  photo, spin, off, allEvents, TERMS,
} from '../core.js?v=20261125e';

const idStr = (c) => c.id.toString();
const ORDER = { funding: 0, expired: 1, earning: 2, sold: 3, cancelled: 4 };
const DAY = 86400;

/** Token base units to '₫6.25M' / '₫283,500'. */
const vnd = (v) => `₫${usd(v)}`;
/** Whole VND (a JS number) to a short label: 65,625 -> '65k', 1,300,000 -> '1.3M'. */
function vShort(n, dp = 2) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(dp)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(dp)}M`;
  if (n >= 1e3) return `${Math.floor(n / 1e3)}k`;
  return String(Math.floor(n));
}
const fullVnd = (v) => `₫${toVnd(v).toLocaleString('en-US')}`;
const daysLeft = (c) => Math.max(0, Math.ceil((Number(c.fundingDeadline) - Date.now() / 1000) / DAY));
const pctSold = (c) => (c.totalShares ? Math.round((c.sold / c.totalShares) * 100) : 0);
/** Daily rental price in VND, off-chain (rental agreement). Kept in step with views/car.js. */
const DAILY = { 1: 1100000, 2: 1300000, 3: 650000 };
/** Estimated rent per share per month in VND, from the agreed gross range after the fee (midpoint). */
function estMonth(c) {
  const [lo, hi] = targetNet(c);
  return (toVndNum(c.sharePrice) * ((lo + hi) / 2)) / 100 / 12;
}
const toVndNum = (v) => Number(toVnd(v));
/** Rent paid to holders per share so far, in whole VND. */
const perShare = (c) => toVndNum(c.accPerShare / 10n ** 18n);

const onRoad = (k) => k === 'earning' || k === 'sold';

// ---------- hero ----------

const svgI = (body, cls = '') => `<svg class="vt-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const HERO_ICON = {
  car: svgI('<path d="M4 15.5l1.6-4.7A2 2 0 0 1 7.5 9.4h9a2 2 0 0 1 1.9 1.4l1.6 4.7v3H4z"/><circle cx="8" cy="17.5" r="1.6"/><circle cx="16" cy="17.5" r="1.6"/>'),
  key: svgI('<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M16 7l2.5 2.5M14 9l2 2"/>'),
  doc: svgI('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M9 11h6M9 14h4"/><circle cx="17" cy="18" r="3.2" class="fill-g"/><path d="M15.6 18l1 1 1.8-1.9" class="st-w"/>'),
  coin: svgI('<circle cx="12" cy="12" r="8.5" class="fill-g"/><text x="12" y="16.2" text-anchor="middle" class="coin-t">₫</text>'),
  up: svgI('<path d="M12 19V5M6 11l6-6 6 6"/>'),
};
// Colour, lit icons for the orbit tiles (like the design): gradients live in one hidden <defs> block.
const ICON_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="vg-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5468"/><stop offset=".55" stop-color="#e0102f"/><stop offset="1" stop-color="#a50a22"/></linearGradient>
  <linearGradient id="vg-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f3ff"/><stop offset="1" stop-color="#9cc9f2"/></linearGradient>
  <linearGradient id="vg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset=".5" stop-color="#f5b51c"/><stop offset="1" stop-color="#d28a06"/></linearGradient>
  <radialGradient id="vg-coin" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7fe3b0"/><stop offset=".55" stop-color="#1f9e5f"/><stop offset="1" stop-color="#0f6b3c"/></radialGradient>
  <linearGradient id="vg-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe3ea"/></linearGradient>
  <radialGradient id="vg-check" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#5fd896"/><stop offset="1" stop-color="#15894d"/></radialGradient>
</defs></svg>`;
const ICON3D = {
  car: `<svg class="vt-i3" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M5 25.5c0-2.2 1.3-3.6 3.4-4.1l4.2-1 3.4-4.6c.8-1 1.9-1.6 3.2-1.6h6.4c1.3 0 2.4.6 3.1 1.6l3 4.4 2.2.6c1.6.4 2.6 1.8 2.6 3.4v2.3c0 .8-.6 1.4-1.4 1.4H6.4c-.8 0-1.4-.6-1.4-1.4z" fill="url(#vg-red)"/>
    <path d="M16.2 20.3l2.4-3.4c.4-.5.9-.8 1.6-.8h2.4v4.2zM24.4 16.1h2.2c.6 0 1.1.3 1.5.8l2.3 3.4h-6z" fill="url(#vg-glass)"/>
    <path d="M7 22.6h29" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
    <circle cx="12.5" cy="27.5" r="3.6" fill="#1f1f24"/><circle cx="12.5" cy="27.5" r="1.5" fill="#c9ccd3"/>
    <circle cx="29.5" cy="27.5" r="3.6" fill="#1f1f24"/><circle cx="29.5" cy="27.5" r="1.5" fill="#c9ccd3"/>
    <rect x="34.6" y="22.4" width="2.4" height="1.6" rx=".8" fill="#ffd36b"/></svg>`,
  key: `<svg class="vt-i3" viewBox="0 0 40 40" aria-hidden="true"><g transform="rotate(-28 20 20)">
    <circle cx="12" cy="20" r="6.4" fill="url(#vg-gold)"/><circle cx="12" cy="20" r="2.6" fill="#fff8e6"/>
    <path d="M17.6 18.4h16.2a1.6 1.6 0 0 1 0 3.2h-1.6v3.2h-3v-3.2h-2v2.4h-3v-2.4h-6.6z" fill="url(#vg-gold)"/>
    <path d="M18 19h15.6" stroke="#fff" stroke-opacity=".55" stroke-width=".9" stroke-linecap="round"/></g></svg>`,
  doc: `<svg class="vt-i3" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M10.5 6h13l6 6v20.5a1.5 1.5 0 0 1-1.5 1.5H10.5A1.5 1.5 0 0 1 9 32.5v-25A1.5 1.5 0 0 1 10.5 6z" fill="url(#vg-paper)" stroke="#c9ced8" stroke-width=".8"/>
    <path d="M23.5 6v4.5a1.5 1.5 0 0 0 1.5 1.5h4.5z" fill="#cfd4dd"/>
    <path d="M13 16h11M13 20h11M13 24h7" stroke="#9aa2b0" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="28" cy="29" r="6" fill="url(#vg-check)" stroke="#fff" stroke-width="1.4"/>
    <path d="M25.3 29l1.9 1.9 3.6-3.7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  coin: `<svg class="vt-i3" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="21.4" r="13" fill="#0c5c33"/><circle cx="20" cy="20" r="13" fill="url(#vg-coin)"/>
    <circle cx="20" cy="20" r="10" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2"/>
    <text x="20" y="25.6" text-anchor="middle" fill="#fff" font-family="Inter, sans-serif" font-weight="700" font-size="15">₫</text></svg>`,
};

// Hero mark: thick white ring with a white wedge that sweeps like a meter (animated in CSS).
const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13.2" fill="none" stroke="#fff" stroke-width="5.4"/><circle class="vt-sweep" cx="16" cy="16" r="5.4" fill="none" stroke="#fff" stroke-width="10.8" pathLength="100" transform="rotate(-90 16 16)"/></svg>';
// The logo is a slab: a stack of darker layers behind the face gives it thickness when it turns.
const SLAB = Array.from({ length: 12 }, (_, i) => `<i style="--z:${i + 1}"></i>`).join('');

function hero(cars) {
  const open = cars.filter((c) => stageOf(c).key === 'funding');
  const from = (open.length ? open : cars).reduce((m, c) => (m === null || c.sharePrice < m ? c.sharePrice : m), null);
  const rents = allEvents().filter((e) => e.name === 'RentPaid');
  const lastRent = rents[0] ? fullVnd(rents[0].args.toHolders) : '₫2,840,000';
  const rep = (S.reports || [])[0];
  const repCar = rep ? cars.find((c) => c.id === rep.args.carId) : null;
  const trip = rep && Number(rep.args.daysRented)
    ? `${Number(rep.args.daysRented)} days${repCar && metaOf(repCar).city ? ` · ${esc(metaOf(repCar).city)}` : ''}`
    : '7 days · Hanoi';
  return `<section class="vt-hero">
    <div class="vt-hero-l">
      <h1 class="vt-h">Own a car.<br>Earn its rent.</h1>
      <p class="vt-lead">${from !== null ? `Shares from ${vnd(from)}. ` : ''}Paid every month.</p>
      <div class="vt-ctas">
        <a class="btn btn-p btn-lg" href="#cars" data-vt-scroll>Browse cars</a>
        <a class="btn btn-lg" href="#/how">How it works</a>
      </div>
    </div>
    <div class="vt-art" aria-hidden="true">
      ${ICON_DEFS}
      <div class="vt-grid"></div>
      <div class="vt-glow"></div>
      <div class="vt-orbit vt-orbit-b"></div>
      <div class="vt-logo"><div class="vt-cube">${SLAB}<div class="vt-face">${LOGO}</div></div></div>
      <span class="vt-coin" style="--c:0">₫</span><span class="vt-coin" style="--c:1">₫</span>
      <div class="vt-orbit vt-orbit-f"></div>
      ${['car', 'key', 'doc', 'coin'].map((k, i) => `<div class="vt-sat" style="--d:${i}"><div class="vt-sat-y"><div class="vt-tile">${ICON3D[k]}</div></div></div>`).join('')}
      <div class="vt-float vt-float-trip"><span class="vt-ft-ico red">${ICON3D.car}</span><span><small>Trip completed</small><b>${trip}</b></span></div>
      <div class="vt-float vt-float-paid"><span class="vt-ft-ico green">${HERO_ICON.up}</span><span><small>Paid to you</small><b class="pos">+${lastRent}</b></span></div>
    </div>
  </section>`;
}

function kpis(cars) {
  const paid = cars.reduce((a, c) => a + holdersOf(c), 0n);
  const cities = new Set(cars.map((c) => metaOf(c).city).filter(Boolean)).size;
  const cell = (big, small) => `<div><p class="vt-k">${big}</p><p class="vt-kl">${small}</p></div>`;
  return `<section class="vt-kpis" aria-label="FleetShares in numbers">
    ${cell(`₫${vShort(toVndNum(paid), 1)}`, 'paid to owners')}
    ${cell(cars.length, `${cars.length === 1 ? 'car' : 'cars'}${cities ? ` in ${cities} ${cities === 1 ? 'city' : 'cities'}` : ''}`)}
    ${cell(`${100 - TERMS.fee}%`, 'of rent to you')}
    ${cell('100%', 'refund if not funded')}
  </section>`;
}

// ---------- car cards ----------

function statusPill(c, k) {
  if (k === 'funding') { const d = daysLeft(c); return `<span class="vt-st warn">Open · ${d} ${d === 1 ? 'day' : 'days'} left</span>`; }
  if (k === 'earning') return '<span class="vt-st ok">On the road</span>';
  if (k === 'sold') return '<span class="vt-st">Sold</span>';
  if (k === 'expired') return '<span class="vt-st risk">Deadline passed</span>';
  return '<span class="vt-st risk">Refunds open</span>';
}

function carCard(c) {
  const k = stageOf(c).key;
  const m = metaOf(c);
  const road = onRoad(k);
  const L = S.ledger?.[c.id];
  const trips = L && Number(L.rentals) ? `${Number(L.rentals)} ${Number(L.rentals) === 1 ? 'trip' : 'trips'}` : null;
  const daily = DAILY[idStr(c)] ? `₫${vShort(DAILY[idStr(c)])}/day` : null;
  const sub = [m.city, road ? (trips || daily) : daily].filter(Boolean).map(esc).join(' · ');
  const right = road
    ? `<span class="vt-c-r pos">₫${vShort(perShare(c))}</span>`
    : `<span class="vt-c-r">~₫${vShort(estMonth(c))}/mo</span>`;
  const rightSub = road ? 'rent paid per share' : 'est. per share';
  const w = road ? 100 : pctSold(c);
  const done = k === 'sold' ? 'Sold' : road ? 'Fully funded' : k === 'cancelled' ? 'Not funded' : `${pctSold(c)}% funded`;
  return `<a class="vt-car" href="#/car/${idStr(c)}">
    <div class="vt-ph">${photo(c, 'vt-img', c.name)}${statusPill(c, k)}</div>
    <div class="vt-l1"><h3>${esc(c.name)}</h3>${right}</div>
    <div class="vt-l2"><span>${sub}</span><span>${rightSub}</span></div>
    <div class="vt-bar${road ? ' full' : ''}" role="progressbar" aria-label="Shares sold" aria-valuemin="0" aria-valuemax="${c.totalShares}" aria-valuenow="${c.sold}"><i style="width:${w}%"></i></div>
    <div class="vt-l3"><span>${vnd(c.sharePrice)} a share</span><span>${done}</span></div>
  </a>`;
}

function carsSection(cars) {
  const sorted = [...cars].sort((a, b) => ORDER[stageOf(a).key] - ORDER[stageOf(b).key] || Number(a.id - b.id));
  const isOpen = (c) => stageOf(c).key === 'funding';
  const isRoad = (c) => stageOf(c).key === 'earning';
  const f = ['all', 'open', 'road'].includes(ui.vtFilter) ? ui.vtFilter : 'all';
  const shown = f === 'open' ? sorted.filter(isOpen) : f === 'road' ? sorted.filter(isRoad) : sorted;
  const max = ui.vtMore ? Infinity : 6;
  const chips = [['all', 'All'], ['open', 'Open now'], ['road', 'On the road']]
    .map(([k, label]) => `<button type="button" class="chip${f === k ? ' on' : ''}" aria-pressed="${f === k}" data-act="set" data-k="vtFilter" data-v="${k}">${label}</button>`).join('');
  return `<section class="vt-sec" id="cars" aria-labelledby="vt-cars-h">
    <div class="vt-sec-h"><h2 class="vt-h2" id="vt-cars-h">Cars</h2><div class="vt-chips" role="group" aria-label="Filter cars">${chips}</div></div>
    ${shown.length
      ? `<div class="vt-cars">${shown.slice(0, max).map(carCard).join('')}</div>`
      : `<div class="vt-empty">${ICON.car}<p>${cars.length ? 'No cars here right now.' : 'No cars are listed yet.'}</p></div>`}
    ${shown.length > max ? '<div class="vt-more"><button class="btn btn-lg" type="button" data-act="set" data-k="vtMore" data-v="1">More cars <span aria-hidden="true">→</span></button></div>' : ''}
  </section>`;
}

// ---------- records teaser ----------

function recordCard(cars) {
  const withData = cars.map((c) => ({ c, L: S.ledger?.[c.id] })).filter((x) => x.L && x.L.reportedIncome > 0n);
  if (!withData.length) return '';
  // The car with the most owed, else the one with the most reported.
  withData.sort((a, b) => (b.L.unpaid > a.L.unpaid ? 1 : b.L.unpaid < a.L.unpaid ? -1 : b.L.reportedIncome > a.L.reportedIncome ? 1 : -1));
  const { c, L } = withData[0];
  const paid = L.rentPaid > L.reportedIncome ? L.reportedIncome : L.rentPaid;
  const w = Number((paid * 1000n) / L.reportedIncome) / 10;
  const months = Number(L.periods);
  return `<a class="vt-rec" href="#/transparency">
    <div class="vt-rec-h">${photo(c, 'vt-rec-img', '')}<div><b>${esc(c.name)}</b><span>${months ? `${months} ${months === 1 ? 'month' : 'months'} reported` : 'Reported so far'}</span></div></div>
    <div class="vt-two-bar" role="img" aria-label="${w}% of reported rent paid in"><i style="width:${w}%"></i></div>
    <div class="vt-rec-n">
      <div><span>Reported</span><b>${vnd(L.reportedIncome)}</b></div>
      <div><span>Paid in</span><b class="pos">${vnd(L.rentPaid)}</b></div>
      <div><span>Not paid</span><b class="${L.unpaid > 0n ? 'vt-red' : ''}">${vnd(L.unpaid)}</b></div>
    </div>
  </a>`;
}

function records(cars) {
  return `<section class="vt-records">
    <div class="vt-records-l">
      <h2 class="vt-h2">Every trip, on record.</h2>
      <p class="vt-lead">What each car reported, and what was paid in.</p>
      <a class="btn btn-lg" href="#/transparency">See all records <span aria-hidden="true">→</span></a>
    </div>
    ${recordCard(cars)}
  </section>`;
}

function cta(cars) {
  const open = cars.filter((c) => stageOf(c).key === 'funding');
  const from = (open.length ? open : cars).reduce((m, c) => (m === null || c.sharePrice < m ? c.sharePrice : m), null);
  return `<section class="vt-cta">
    <h2>${from !== null ? `Your first share, from ${vnd(from)}.` : 'Your first share.'}</h2>
    <a class="btn btn-lg vt-cta-b" href="#cars" data-vt-scroll>Browse cars</a>
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
    html += `<div class="vt-role-grid">
        <div class="vt-fees">
          <p class="t-label">Fees ready to withdraw</p>
          <p class="vt-k">${vnd(S.data.feesOwed)}</p>
          <p class="t-sm ink-3">${TERMS.fee}% of every rent payment.</p>
          <button class="btn" type="button" data-act="withdrawFees"${off(S.data.feesOwed === 0n)}>${spin('fees')}Withdraw fees</button>
        </div>
        <div class="vt-list">
          <div class="vt-list-h"><h3 class="vt-h3">List a new car</h3>
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
          <button class="btn btn-p" type="button" data-act="listCar"${off()}>${spin('list')}List car</button>` : '<p class="t-sm ink-3">Shares, price and the funding window are fixed once listed.</p>'}
        </div>
      </div>`;
  }
  const mine = cars.filter((c) => same(c.operator, S.account));
  if (mine.length) {
    html += `<div class="note vt-op">${ICON.car}<span>You operate ${mine.map((c) => `<a href="#/car/${idStr(c)}">${esc(c.name)}</a>`).join(', ')}. Pay rent from each car's page. The contract splits it ${100 - TERMS.fee} / ${TERMS.fee}.</span></div>`;
  }
  if (!html) return '';
  return `<section class="vt-role" aria-labelledby="vt-role-h">
    <h2 class="vt-h3" id="vt-role-h">${same(S.account, S.data.manager) ? 'Manager tools' : 'Operator tools'}</h2>
    ${html}
  </section>`;
}

registerView('vault', () => {
  const cars = S.data.cars;
  return `<div class="vt-page">
    ${hero(cars)}
    ${kpis(cars)}
    ${carsSection(cars)}
    ${records(cars)}
    ${cta(cars)}
    ${roleTools(cars)}
  </div>`;
});

// "Browse cars" scrolls to the grid without changing the hash route.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('[data-vt-scroll]');
  if (!a) return;
  e.preventDefault();
  document.getElementById('cars')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
