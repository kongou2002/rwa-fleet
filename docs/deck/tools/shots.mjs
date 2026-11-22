// Captures the deck's screenshots from the running web app, read-only (the wallet answers reads, refuses every send).
//
//   cd web && python3 -m http.server 8171 &
//   PW=/path/to/node_modules/playwright/index.mjs node shots.mjs <out dir>
//
// Env: PW (playwright entry), BASE (default http://localhost:8171/), HOLDER (wallet shown as connected).
// Viewport 1440x900 at 2x. Every page is scrolled top to bottom so lazy photos load before the shot.
// Writes buy.png, portfolio.png, market.png, ledger.png and shots.json (figures read from the page at capture time).
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PW || 'playwright');
const OUT = process.argv[2];
const BASE = process.env.BASE || 'http://localhost:8171/';
const HOLDER = process.env.HOLDER || '0x0812ebF118750B566858241b429C574Aec59a419';
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
  const H = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 400) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(200); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 }).catch(() => console.warn('  some images did not load on', hash));
  await page.waitForTimeout(800);
}

async function box(targets, pad) {
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

async function shot(name, hash, targets, pad = 1) {
  await go(hash);
  const clip = await box(targets, pad);
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true, clip });
  const usdc = await page.evaluate(() => (document.querySelector('main, #view') || document.body).innerText.match(/USDC|\$/g)?.length || 0);
  console.log(name.padEnd(10), hash.padEnd(14), Math.round(clip.width * 2) + 'x' + Math.round(clip.height * 2), 'USDC/$ on page:', usdc);
}

const info = { at: new Date().toISOString(), holder: HOLDER };
await go('#/');
const cars = await page.$$eval('.vt-cars a[href^="#/car/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.innerText })));
const funding = cars.find((c) => /Funding/.test(c.text)) || cars[0];
info.fundingCar = funding.href;

await shot('buy', funding.href, ['.cd-photo', '.cd-aside'], 1);
await shot('portfolio', '#/portfolio', ['.pf-kpis', { heading: 'Holdings' }]);
await shot('market', '#/market', [{ heading: 'Open offers' }]);
info.offers = await page.evaluate(() => { const h = [...document.querySelectorAll('h2,h3')].find((e) => e.textContent.trim() === 'Open offers'); return h.closest('.card').innerText.split('\n').find((l) => /offers? ·|lệnh/.test(l)); });
await shot('ledger', '#/transparency', [{ heading: 'Reported income and rent paid' }]);
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(info, null, 1));
console.log(info);
await browser.close();
