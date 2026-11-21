// Pure SVG stacked bar chart. No imports, no DOM: returns an SVG string.
//
// barChart({ groups: [{ label, parts: [{ v, color }] }], width, height, labels: 'last'|'all'|'none',
//            line: { v, text }, aria, fmt }) -> '<svg …>…</svg>'

const FONT = 'IBM Plex Sans, Arial, sans-serif';
const GRID = '#e6e6e8';
const AXIS = '#646d79';
const INK = '#0d1117';
const GAP = 2; // px between stacked parts
const R = 2; // rounded top of the topmost part

const escX = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round(n * 10) / 10;

function defaultFmt(n) {
  const whole = Math.abs(n - Math.round(n)) < 1e-9;
  return n.toLocaleString('en-US', whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Smallest "nice" step (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10^k) so that 3 steps cover max. */
export function niceMax(max, steps = 3) {
  if (!(max > 0)) return 0;
  const raw = max / steps;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * mag).find((s) => s >= raw - 1e-12);
  return Number((step * steps).toPrecision(12));
}

/** Chart viewBox width for the current screen: narrower on phones so 11px labels stay readable. */
export function chartW(desktop, phone = 360) {
  return typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches ? phone : desktop;
}

export function barChart({ groups = [], width = 720, height = 240, labels = 'last', line = null, aria = '', fmt = defaultFmt } = {}) {
  const left = 48, right = width - 8, top = 12, base = height - 28;
  const plotW = right - left, plotH = base - top;
  const totals = groups.map((g) => (g.parts || []).reduce((a, p) => a + (p.v > 0 ? p.v : 0), 0));
  let dataMax = Math.max(0, ...totals, line && line.v > 0 ? line.v : 0);
  // leave headroom for the total printed above the tallest bar
  if (labels !== 'none' && dataMax > 0) dataMax *= 1.08;
  const max = niceMax(dataMax);
  const y = (v) => (max > 0 ? base - (v / max) * plotH : base);
  const font = `font-family="${FONT}"`;

  // grid + axis
  const ticks = max > 0 ? [0, 1, 2, 3].map((i) => (max / 3) * i) : [0];
  const grid = ticks.map((t) => `<line x1="${left}" x2="${right}" y1="${r1(y(t))}" y2="${r1(y(t))}"></line>`).join('');
  const axis = ticks.map((t) => `<text x="${left - 10}" y="${r1(y(t) + 4)}">${escX(fmt(t))}</text>`).join('');

  // bars
  const n = groups.length;
  const slot = n ? plotW / n : plotW;
  const bw = Math.min(38, Math.max(6, slot * 0.6));
  let bars = '', totalsTxt = '', xlab = '';
  groups.forEach((g, i) => {
    const cx = left + slot * (i + 0.5);
    const x0 = r1(cx - bw / 2), x1 = r1(cx + bw / 2);
    const parts = (g.parts || []).filter((p) => p.v > 0);
    let acc = 0;
    let bottom = base;
    parts.forEach((p, j) => {
      acc += p.v;
      const topY = y(acc);
      const yb = j === 0 ? base : bottom - GAP;
      bottom = topY;
      if (yb - topY < 0.5) return; // too small to draw after the gap
      const yt = r1(topY), ybr = r1(yb);
      if (j === parts.length - 1) {
        const rr = Math.min(R, (ybr - yt) / 2, bw / 2);
        bars += `<path fill="${escX(p.color)}" d="M${x0} ${ybr}V${r1(yt + rr)}Q${x0} ${yt} ${r1(x0 + rr)} ${yt}H${r1(x1 - rr)}Q${x1} ${yt} ${x1} ${r1(yt + rr)}V${ybr}Z"></path>`;
      } else {
        bars += `<rect fill="${escX(p.color)}" x="${x0}" y="${yt}" width="${r1(x1 - x0)}" height="${r1(ybr - yt)}"></rect>`;
      }
    });
    const showTotal = totals[i] > 0 && (labels === 'all' || (labels === 'last' && i === n - 1));
    if (showTotal) totalsTxt += `<text x="${r1(cx)}" y="${r1(y(totals[i]) - 8)}">${escX(fmt(totals[i]))}</text>`;
    xlab += `<text x="${r1(cx)}" y="${height - 8}">${escX(g.label)}</text>`;
  });

  // reference line
  let ref = '';
  if (line && line.v > 0 && max > 0) {
    const ly = r1(y(line.v));
    ref = `<line x1="${left}" x2="${right}" y1="${ly}" y2="${ly}" stroke="${AXIS}" stroke-width="1" stroke-dasharray="4 4"></line>`
      // label at the left end: bars usually grow left to right, so the last (tallest) bar stays clear
      + (line.text ? `<text x="${left + 6}" y="${r1(Math.max(top + 10, ly - 6))}" fill="${AXIS}" font-size="11" ${font} text-anchor="start">${escX(line.text)}</text>` : '');
  }

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escX(aria)}">`
    + `<g stroke="${GRID}" stroke-width="1">${grid}</g>`
    + `<g fill="${AXIS}" font-size="11" ${font} text-anchor="end">${axis}</g>`
    + `<g>${bars}</g>`
    + ref
    + (totalsTxt ? `<g fill="${INK}" font-size="12" font-weight="500" ${font} text-anchor="middle">${totalsTxt}</g>` : '')
    + `<g fill="${AXIS}" font-size="11" ${font} text-anchor="middle">${xlab}</g>`
    + '</svg>';
}
