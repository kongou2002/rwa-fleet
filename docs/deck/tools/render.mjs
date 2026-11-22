// node render.mjs <deck.html> <png dir>   (PW = playwright entry). Renders each slide at 1920x1080 and reports
// elements that cross the footer or the side margins, and titles whose last line holds a single word.
const { chromium } = await import(process.env.PW || 'playwright');
const [,, file, out] = process.argv;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + file + '?export=1'); await p.waitForTimeout(1200);
await p.evaluate(() => document.fonts.ready);
const n = await p.evaluate(() => document.querySelectorAll('.slide').length);
for (let i = 1; i <= n; i++) {
  const o = await p.evaluate(() => { const s = document.querySelector('.slide.on'); const sr = s.getBoundingClientRect(); const f = s.querySelector('footer').getBoundingClientRect(); const bad = []; s.querySelectorAll(':scope > *:not(footer), :scope > * *').forEach(e => { if (e.closest('footer') || e.closest('svg.curve')) return; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; if (r.bottom > f.top - 4 || r.right > sr.right - 100 || r.left < sr.left + 100) bad.push((e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.tagName) + '@' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom)); });
    const orphans = []; s.querySelectorAll('h1,h2').forEach(h => { const range = document.createRange(); const words = []; const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let nd; while ((nd = walk.nextNode())) { let m; const re = /\S+/g; while ((m = re.exec(nd.data))) { range.setStart(nd, m.index); range.setEnd(nd, m.index + m[0].length); words.push(Math.round(range.getBoundingClientRect().top)); } } const lines = [...new Set(words)]; const last = words.filter(t => t === lines[lines.length - 1]).length; if (lines.length > 2 || (lines.length > 1 && last === 1)) orphans.push(h.innerText.replace(/\n/g, ' / ') + ' [' + lines.length + ' lines, last ' + last + ']'); });
    // text overflowing its own box (clipped or spilling)
    const spill = []; s.querySelectorAll('*').forEach(e => { if (e.closest('svg') || e.tagName === 'IMG') return; if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && e.clientWidth) spill.push(e.className || e.tagName); });
    return { bad: bad.slice(0, 4), orphans, spill: spill.slice(0, 4) }; });
  console.log(i, o.bad.length ? 'OUT ' + o.bad.join(' | ') : 'ok', o.orphans.length ? 'WRAP ' + o.orphans.join(';') : '', o.spill.length ? 'SPILL ' + o.spill.join(',') : '');
  await p.screenshot({ path: `${out}/s${String(i).padStart(2, '0')}.png` });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120);
}
console.log('errors', errs.length, errs.slice(0, 3));
await b.close();
