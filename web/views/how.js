// How it works: four steps, a few questions, one call to action.
import { registerView, S, TERMS, esc, photo, usd, toVnd, carById } from '../core.js';

// Worked example, kept for the pitch deck tool (docs/deck/tools/build.py reads `const EX` from this file).
// Amounts in million VND (a 700M VND car).
const EX = { price: 700, gross: 0.135, fee: 0.10, years: 5, resale: 0.55 };

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
void EX;

const full = (v) => toVnd(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function cheapest() {
  const cars = S.data?.cars || [];
  const open = cars.filter((c) => c.statusName === 'Funding');
  const pool = open.length ? open : cars;
  if (!pool.length) return '₫6.25M';
  const min = pool.reduce((m, c) => (c.sharePrice < m ? c.sharePrice : m), pool[0].sharePrice);
  return `₫${usd(min)}`;
}

/** Holders' part of the newest rent report, as a sample payout. */
function paidToYou() {
  const r = S.reports?.[0];
  if (!r) return '2,840,000';
  const v = (BigInt(r.args.income) * BigInt(100 - Number(TERMS.fee))) / 100n;
  return full(v);
}

const img = (id, alt) => {
  const c = carById(id);
  return c ? photo(c, 'hw-img', alt) : '<div class="hw-img ph" aria-hidden="true"></div>';
};

registerView('how', () => {
  const fee = Number(TERMS.fee);
  const step = (no, title, sub, media) => `<li class="hw-step">
      <span class="hw-no" aria-hidden="true">${no}</span>
      <div class="hw-step-t"><h2 class="hw-step-h">${title}</h2><p class="hw-step-s">${sub}</p></div>
      <div class="hw-media">${media}</div>
    </li>`;
  const qa = (q, a) => `<div class="hw-qa"><dt>${q}</dt><dd>${a}</dd></div>`;

  return `<div class="hw">
    <header class="hw-hero">
      <h1 class="hw-display">Like owning a rental car. Without the work.</h1>
      <p class="hw-lede">You own a share. We handle the rest.</p>
    </header>

    <ol class="hw-steps">
      ${step('01', 'Buy shares in a car', `From ${cheapest()}. Held safely until the car is fully funded.`, img(2, 'VinFast VF 8'))}
      ${step('02', 'The car goes to work', `A licensed operator rents it out, day after day.`, img(1, 'Mazda CX-5'))}
      ${step('03', 'You get paid monthly', `Each time rent is paid in, ${100 - fee}% is yours. Collect anytime.`,
        `<div class="hw-paid"><span class="hw-paid-l">Paid to you</span><span class="hw-paid-v">+₫${paidToYou()}</span></div>`)}
      ${step('04', 'The car is sold', `After ${esc(TERMS.life)}. You claim your part of the sale money.`, img(3, 'Toyota Vios'))}
    </ol>

    <section class="hw-faq" aria-labelledby="hw-q">
      <h2 class="hw-h2" id="hw-q">Questions</h2>
      <dl class="hw-qas">
        ${qa('What if a car isn’t fully funded?', 'You get all your money back.')}
        ${qa('Can I sell before the car is sold?', 'Yes, once the car is on the road. List your shares on <a href="#/market">Resell</a>.')}
        ${qa('Who rents out the cars?', `${esc(TERMS.operator)}, a licensed rental operator in ${esc(TERMS.country)}.`)}
        ${qa('How do I know the rent is real?', 'Every trip and payment is on <a href="#/transparency">Records</a>.')}
        ${qa('Where does my money go?', 'By bank transfer to an escrow account. The chain keeps the rules and the receipts.')}
      </dl>
    </section>

    <section class="hw-cta">
      <h2 class="hw-cta-h">Ready when you are.</h2>
      <a class="hw-btn-w" href="#/">Browse cars</a>
    </section>
  </div>`;
}, { needsData: false });
