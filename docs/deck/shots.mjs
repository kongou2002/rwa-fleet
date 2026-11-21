// Captures the deck's screenshots from the running web app (read-only, no transactions).
//
//   cd web && python3 -m http.server 8151 &
//   PW=/path/to/node_modules/playwright/index.mjs node docs/deck/shots.mjs
//
// Env: PW (playwright entry, default 'playwright'), BASE (default http://localhost:8151/),
//      HOLDER (wallet shown as connected, read-only; default a holder with a position).
// Writes docs/deck/{car,cards,buypanel,market,portfolio,example}.jpg at 1440x900, 2x.
// Crops are found from the page's own elements, so they survive new cars and new numbers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW || 'playwright');
const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:8151/';
const HOLDER = process.env.HOLDER || '0x0812ebF118750B566858241b429C574Aec59a419';

// A wallet that only answers reads: the app shows the holder's position, any send is refused.
const fake = `(() => { const A = ${JSON.stringify(HOLDER)}; window.ethereum = { async request({ method }) {
  if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [A];
  if (method === 'eth_chainId') return '0xa869';
  if (method === 'wallet_switchEthereumChain') return null;
  const e = new Error('read-only'); e.code = 4001; throw e; }, on() {}, removeListener() {} }; })();`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(fake);
const page = await ctx.newPage();
await page.goto(BASE);
await page.waitForFunction(() => document.querySelector('.vt-cars'), null, { timeout: 60000 });
await page.waitForTimeout(3000);

async function go(hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(2500);
  // Scroll the whole page so lazy images load, then wait for every image to finish.
  const H = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 500) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(200); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 }).catch(() => console.warn('  some images did not load on', hash));
  await page.waitForTimeout(800);
}

// Union of the boxes of the given targets, in page coordinates. A target is a CSS selector,
// or { heading: 'text' } meaning the nearest .card (or .head row) around that heading.
async function box(targets, pad = 0) {
  return page.evaluate(({ targets, pad }) => {
    const find = (t) => {
      if (typeof t === 'string') return document.querySelector(t);
      const h = [...document.querySelectorAll('h1,h2,h3')].find((e) => e.textContent.trim() === t.heading);
      return h && (h.closest(t.up || '.card') || h.parentElement);
    };
    const rs = targets.map((t) => { const e = find(t); if (!e) throw new Error('not found: ' + JSON.stringify(t)); return e.getBoundingClientRect(); });
    const x = Math.min(...rs.map((r) => r.left)) - pad, y = Math.min(...rs.map((r) => r.top)) - pad + scrollY;
    const r = Math.max(...rs.map((r) => r.right)) + pad, b = Math.max(...rs.map((r) => r.bottom)) + pad + scrollY;
    return { x, y, width: r - x, height: b - y };
  }, { targets, pad });
}

// css: a style added for this shot only. The market's offer table is wider than its column at 1440
// (the buy buttons are clipped), so the deck shot lets the offer book take the full row, as the app's
// own flex-wrap does on narrower screens.
async function shot(name, hash, targets, pad = 1, css = '') {
  await go(hash);
  const tag = css ? await page.addStyleTag({ content: css }) : null;
  if (tag) await page.waitForTimeout(500);
  const clip = await box(targets, pad);
  await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 90, fullPage: true, clip });
  if (tag) await tag.evaluate((e) => e.remove());
  console.log(name.padEnd(10), hash.padEnd(22), Math.round(clip.width * 2) + 'x' + Math.round(clip.height * 2));
}

// Pick cars from the vault: the first earning car and the first car still funding.
await go('#/');
const cars = await page.$$eval('.vt-cars a[href^="#/car/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.innerText })));
const earning = cars.find((c) => /Earning/.test(c.text)) || cars[0];
const funding = cars.find((c) => /Funding/.test(c.text)) || cars[cars.length - 1];
console.log('earning car', earning.href, '· funding car', funding.href);

await shot('car', earning.href, ['.cd-photo'], 0);
await shot('cards', '#/', [{ heading: 'Cars in the vault', up: '.head' }, '.vt-cars']);
await shot('buypanel', funding.href, ['.cd-aside']);
await shot('market', '#/market', [{ heading: 'Open offers' }], 1, '.mk-book { flex-basis: 100% !important; }');
await shot('portfolio', '#/portfolio', ['.pf-kpis', { heading: 'Holdings' }]);
await shot('example', '#/how', ['.hw-ex']);

await browser.close();
