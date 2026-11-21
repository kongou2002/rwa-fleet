// How it works: the investor overview. Static story, a computed worked example, live touches where data exists.
import { registerView, S, TERMS, SERIES, esc, photo, stageOf, ICON } from '../core.js';
import { barChart, chartW } from '../chart.js';

// Worked example. Every figure on the page is derived from these five numbers.
const EX = { price: 28000, gross: 0.135, fee: 0.10, years: 5, resale: 0.55 };
const PLAN = [6, 12, 20, 30]; // example roadmap, placeholders
const GROSS_GRID = [0.135, 0.15, 0.20, 0.25];
const RESALE_GRID = [0.50, 0.55, 0.60];

const n0 = (n) => Math.round(n).toLocaleString('en-US');
const p1 = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
const pc = (x) => `${Math.round(x * 1000) / 10}%`;

/** Yearly cash flows for one car: year 0 buys it, each year pays net rent, the last year adds the resale. */
export function flows({ price, gross, fee, years, resale }) {
  const rent = price * gross * (1 - fee);
  return [-price, ...Array.from({ length: years }, (_, i) => rent + (i === years - 1 ? price * resale : 0))];
}

/** IRR by bisection over yearly cash flows. Returns NaN when no root lies in (-99%, 1000%). */
export function irr(cf) {
  const npv = (r) => cf.reduce((a, c, t) => a + c / (1 + r) ** t, 0);
  let lo = -0.99, hi = 10;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function quarters(count) {
  const d = new Date();
  let q = Math.floor(d.getMonth() / 3), y = d.getFullYear();
  return Array.from({ length: count }, () => {
    const label = `Q${q + 1} ${y}`;
    if (++q === 4) { q = 0; y++; }
    return label;
  });
}

registerView('how', () => {
  const cars = S.data?.cars || [];
  const earning = cars.filter((c) => stageOf(c).key === 'earning');
  const hero = earning[0] || cars[0];
  const [gLo, gHi] = TERMS.gross;
  const fee = Number(TERMS.fee);

  // ---- worked example ----
  const cf = flows(EX);
  const rentYear = EX.price * EX.gross * (1 - EX.fee);
  const rentTotal = rentYear * EX.years;
  const resale = EX.price * EX.resale;
  const back = rentTotal + resale;
  const base = irr(cf);
  const cashChart = barChart({
    groups: Array.from({ length: EX.years }, (_, i) => ({
      label: `Year ${i + 1}`,
      parts: [{ v: rentYear * (i + 1), color: SERIES[0] }, ...(i === EX.years - 1 ? [{ v: resale, color: SERIES[1] }] : [])],
    })),
    width: chartW(560), height: chartW(240, 220), labels: 'last', fmt: n0,
    line: { v: EX.price, text: `Invested · ${n0(EX.price)}` },
    aria: `Cumulative cash returned per year: rent builds to ${n0(rentTotal)} USDC by year ${EX.years}, resale adds ${n0(resale)}, against ${n0(EX.price)} invested`,
  });
  const sens = GROSS_GRID.map((g) => `<tr><td>${pc(g)}</td>${RESALE_GRID.map((rs) => {
    const v = irr(flows({ ...EX, gross: g, resale: rs }));
    const cls = ['num', v >= 0.15 ? 'pos' : '', g === EX.gross && rs === EX.resale ? 'hw-base' : ''].filter(Boolean).join(' ');
    return `<td class="${cls}">${Number.isFinite(v) ? p1(v) : '–'}</td>`;
  }).join('')}</tr>`).join('');

  // ---- fleet chart ----
  const q = quarters(PLAN.length + 1);
  const plan = PLAN.map((v, i) => ({ label: q[i + 1], parts: [{ v, color: 'currentColor' }] }));
  const groups = S.data ? [{ label: q[0], parts: [{ v: earning.length, color: SERIES[0] }] }, ...plan] : plan;
  const fleetChart = barChart({
    groups, width: chartW(1120), height: chartW(240, 220), labels: 'all', fmt: n0,
    aria: `Cars on the road by quarter: ${S.data ? `${earning.length} funded in ${q[0]}, then ` : ''}an example plan of ${PLAN.join(', ')} through ${q[PLAN.length]}`,
  });

  const step = (no, title, text, when, last) => `<li class="${last ? 'hw-last' : ''}"><span class="hw-no">${no}</span><h3 class="t-title">${title}</h3><p class="t-sm ink-2">${text}</p><p class="t-label hw-when">${when}</p></li>`;
  const arrow = `<div class="hw-arrow" aria-hidden="true"><svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></div>`;
  const rule = (t, s) => `<li>${ICON.check}<div><h3 class="t-title">${t}</h3><p class="t-sm ink-2">${s}</p></div></li>`;

  return `<section class="hw-hero">
      <div class="hw-hero-t">
        <p class="t-label">Investor overview</p>
        <h1 class="t-display">Growing ${esc(TERMS.country)}'s rental fleet</h1>
        <p class="t-body ink-2">An offshore vault funds cars in fractional shares. ${esc(TERMS.operator)} rents them out in ${esc(TERMS.country)}. Each car earns rent for ${esc(TERMS.life)}, then is sold so the capital comes back and funds the next cars.</p>
        <div class="row hw-cta"><a class="btn btn-p" href="#/">Open the vault</a><a class="btn" href="#/transparency">See the records</a></div>
      </div>
      ${hero ? `<a class="hw-hero-img" href="#/car/${hero.id}">${photo(hero, 'hw-photo', `${hero.name} from the fleet`)}</a>` : ''}
    </section>

    <section class="hw-sec">
      <h2 class="t-h2">The life of one car</h2>
      <p class="t-sm ink-3 hw-sub">Four steps, run by the contract</p>
      <ol class="hw-steps">
        ${step('01', 'Fund a car', 'Investors buy shares of one car in USDC. Money waits in escrow until it sells out.', 'Month 0')}
        ${step('02', `Rent it out in ${esc(TERMS.country)}`, `${esc(TERMS.operator)} runs the car and pays ${gLo}–${gHi}% of its price in rent each year, monthly.`, 'Years 1–5')}
        ${step('03', 'Sell while it holds value', `After ${esc(TERMS.life)} the car is sold. The resale goes back to holders.`, 'Year 4–5 · about 50–60% of price')}
        ${step('04', 'Grow the fleet', 'New money and returned capital fund the next cars in the vault.', 'Ongoing', true)}
      </ol>
    </section>

    <section class="hw-sec">
      <h2 class="t-h2">Who does what</h2>
      <p class="t-sm ink-3 hw-sub">Three parties and one independent check</p>
      <div class="hw-who">
        <div class="card pad"><p class="t-label">Anywhere · USDC</p><h3 class="t-title">Investors</h3><p class="t-sm ink-2">Hold car shares. Receive ${100 - fee}% of rent and the full resale value.</p></div>
        ${arrow}
        <div class="card pad hw-vault"><p class="t-label">Offshore company</p><h3 class="t-title">FleetShares Vault</h3><p class="t-sm">Set up abroad. Invests in cars for ${esc(TERMS.country)}, lists them, takes a fixed ${fee}% of rent.</p></div>
        ${arrow}
        <div class="card pad"><p class="t-label">${esc(TERMS.country)}</p><h3 class="t-title">${esc(TERMS.operator)}</h3><p class="t-sm ink-2">Rents the cars out, pays rent monthly, sells each car at the end of its term.</p></div>
      </div>
      <div class="hw-audit">${ICON.shield}<p class="t-sm ink-2"><b>Independent auditor, planned.</b> An independent auditor outside ${esc(TERMS.country)} is planned to check the cars, rental income and payouts each quarter. Report hashes will be published on-chain.</p></div>
    </section>

    <section class="hw-sec">
      <h2 class="t-h2">One car, start to finish</h2>
      <p class="t-sm ink-3 hw-sub">Example: a ${n0(EX.price)} USDC car over ${EX.years} years. Illustration from the assumptions below, not a forecast.</p>
      <div class="card pad hw-ex">
        <div class="hw-ex-l">
          <p class="t-title">Assumptions</p>
          <dl class="kv">
            <div><dt>Car price</dt><dd>${n0(EX.price)} USDC</dd></div>
            <div><dt>Gross rent</dt><dd>${pc(EX.gross)} a year</dd></div>
            <div><dt>Management fee</dt><dd>${pc(EX.fee)} of rent</dd></div>
            <div><dt>Years in service</dt><dd>${EX.years}</dd></div>
            <div><dt>Resale value</dt><dd>${pc(EX.resale)} of price</dd></div>
          </dl>
          <div class="hw-res">
            <div><p class="t-label">Total back</p><p class="t-fig">${(back / EX.price).toFixed(2)}×</p></div>
            <div><p class="t-label">Profit</p><p class="t-fig${back >= EX.price ? ' pos' : ''}">${back >= EX.price ? '+' : '−'}${n0(Math.abs(back - EX.price))}</p></div>
            <div><p class="t-label">IRR</p><p class="t-fig">${p1(base)}</p></div>
          </div>
        </div>
        <figure class="chart hw-ex-c">
          <div class="card-h"><p class="t-title">Cash returned, cumulative</p>
            <div class="legend"><span><i style="background:${SERIES[0]}"></i>Rent <b>${n0(rentTotal)}</b></span><span><i style="background:${SERIES[1]}"></i>Resale <b>${n0(resale)}</b></span></div></div>
          ${cashChart}
        </figure>
      </div>
      <div class="card pad hw-gap">
        <div class="card-h"><div><h3 class="t-title">Return per year (IRR)</h3><p class="t-sm ink-3">Same example, ${EX.years}-year term, after the ${pc(EX.fee)} fee. Resale value is the biggest driver.</p></div></div>
        <div class="tbl-box"><table class="t">
          <thead><tr><th>Gross rent a year</th>${RESALE_GRID.map((rs) => `<th class="r">Resale ${pc(rs)}</th>`).join('')}</tr></thead>
          <tbody>${sens}</tbody>
        </table></div>
      </div>
    </section>

    <section class="hw-sec">
      <h2 class="t-h2">The vault grows the fleet</h2>
      <p class="t-sm ink-3 hw-sub">Every funded car is a new car on ${esc(TERMS.country)}'s roads</p>
      <div class="card pad">
        <div class="card-h"><div><p class="t-title">Cars on the road</p><p class="t-sm ink-3">Funded so far, then an example roadmap. Plan figures are placeholders.</p></div>
          <div class="legend">${S.data ? `<span><i style="background:${SERIES[0]}"></i>Funded</span>` : ''}<span><i class="hw-sw-plan"></i>Plan</span></div></div>
        <figure class="chart hw-fleet">${fleetChart}</figure>
      </div>
    </section>

    <section class="hw-sec hw-safe">
      <h2 class="t-h2">Safeguards</h2>
      <p class="t-sm ink-3 hw-sub">These rules are in the contract code. Nobody can change them after deployment.</p>
      <ul class="hw-rules">
        ${rule('The manager never holds investor money', 'It lists cars and earns a fee on rent, and has no function that can move your purchase money.')}
        ${rule('The operator is paid only at sell-out', 'Purchase money stays in the contract until the last share is sold, then goes to the operator in the same transaction.')}
        ${rule('Missed deadline means a full refund', 'If a car is not fully funded in time, anyone can close the sale and every buyer takes back exactly what they paid.')}
        ${rule(`The ${fee}% fee is fixed by the contract`, `Every rent payment is split ${100 - fee} / ${fee} the moment it arrives, and the manager cannot raise its fee.`)}
      </ul>
    </section>`;
}, { needsData: false });
