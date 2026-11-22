// node texts.mjs <deck.html> <texts.json> <out.pdf>  (PW = playwright entry): slide text + link boxes, and the PDF.
import fs from 'fs';
const { chromium } = await import(process.env.PW || 'playwright');
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await p.goto('file://' + process.argv[2] + '?export=1'); await p.waitForTimeout(1500);
const t = await p.evaluate(() => [...document.querySelectorAll('.slide')].map(s => { document.querySelectorAll('.slide').forEach(x => x.classList.remove('on')); s.classList.add('on'); const sr = s.getBoundingClientRect(); const text = s.innerText.replace(/\n{2,}/g, '\n').trim(); const links = [...s.querySelectorAll('a')].map(a => { const r = a.getBoundingClientRect(); return { label: a.innerText.trim() || 'Mở app', href: a.href, x: (r.left - sr.left) / sr.width, y: (r.top - sr.top) / sr.height, w: r.width / sr.width, h: r.height / sr.height }; }); return { text, links }; }));
fs.writeFileSync(process.argv[3], JSON.stringify(t, null, 1));
await p.goto('file://' + process.argv[2] + '?print=1'); await p.waitForTimeout(2500); await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: process.argv[4], width: '1920px', height: '1080px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await b.close();
