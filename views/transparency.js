// Records: rent each car reported (RentalLog on the operator's L1, mirrored by IncomeMirror) and rent paid in.
// Quiet sections at the bottom keep the audit reports, the auditor's form, the manager's fee withdrawal,
// the event feed and every contract address.
import {
  registerView, S, ui, cfg, TERMS, FEED, esc, usd, short, txUrl, addrUrl, ago, dateStr, same,
  ICON, carName, photo, pill, spin, off, allEvents, stageOf, metaOf,
} from '../core.js';

const FEED_ROWS = 12;

const vnd = (v) => `₫${usd(v)}`;
const ext = (href, text, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}" target="_blank" rel="noopener">${text} ${ICON.ext}</a>`;
const copyBtn = (v, what) => `<button class="tr-copy" type="button" data-act="copy" data-v="${esc(v)}" aria-label="Copy ${esc(what)}">${ICON.copy}</button>`;
const l1Url = (kind, v) => (cfg.l1?.explorer ? `${cfg.l1.explorer}/${kind}/${v}` : '');
const l1Label = () => esc(cfg.l1?.name || 'Operator L1');
const when = (e) => (e.time
  ? `<time datetime="${new Date(e.time * 1000).toISOString()}" title="${esc(dateStr(e.time))}">${esc(ago(e.time))}</time>`
  : `block ${esc(e.block)}`);
const day = (ts) => new Date(Number(ts) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const city = (c) => esc(metaOf(c).city || TERMS.country);
const sumPct = (part, whole) => (whole > 0n ? Math.min(100, Number((part * 1000n) / whole) / 10) : 0);

registerView('transparency', (r) => {
  const cars = S.data.cars;
  const onRoad = cars.filter((c) => stageOf(c).key === 'earning');
  const sold = cars.filter((c) => stageOf(c).key === 'sold');
  const any = onRoad.length + sold.length;

  return `<div class="tr">
    <header class="tr-head">
      <h1 class="tr-display">Records</h1>
      <p class="tr-lede">Rent each car reported, and rent paid in.</p>
    </header>

    ${any ? '' : '<div class="tr-card tr-none"><p class="ink-3">No car is on the road yet. Records start with its first rental.</p></div>'}
    ${onRoad.map(carRecord).join('')}
    ${sold.map(soldRecord).join('')}

    <div class="tr-tiles">
      <div class="tr-tile"><h2>Fee is always ${esc(TERMS.fee)}%</h2><p>Of rent. Nothing else.</p></div>
      <div class="tr-tile"><h2>Refund if not funded</h2><p>Every đồng back. Claim it in one tap.</p></div>
      <div class="tr-tile"><h2>Checked every quarter</h2><p>By an outside auditor. ${latestAudit()}</p></div>
    </div>

    <div class="tr-quiet">
      ${audits()}
      ${auditForm()}
      ${feeTools()}
      ${activity(r)}
      ${contracts()}
      <p class="tr-note">Testnet demo. A test token (1 unit = ₫25,000) stands in for VND that would move by bank transfer. The chain records who reported what and enforces the split; it cannot see the real car.</p>
    </div>
  </div>`;
});

// ---------- per car ----------

/** Monthly reports for one car, oldest first, each marked paid by applying rent paid to the oldest month first. */
function months(c, paid) {
  const list = (S.reports || []).filter((e) => BigInt(e.args.carId) === c.id)
    .sort((a, b) => Number(a.args.period) - Number(b.args.period));
  let left = paid;
  return list.map((e) => {
    const inc = BigInt(e.args.income);
    const status = left >= inc ? 'paid' : left > 0n ? 'part' : 'due';
    left = left >= inc ? left - inc : 0n;
    return { e, inc, status };
  });
}

function carRecord(c) {
  const L = S.ledger[c.id];
  const rep = L?.reportedIncome ?? null;
  const paid = L?.rentPaid ?? c.rentPaid;
  const owed = L?.unpaid ?? 0n;
  const flag = rep === null || rep === 0n ? pill('', 'No report yet')
    : owed > 0n ? pill('risk', `${vnd(owed)} not paid yet`) : pill('ok', 'Paid in full');
  const w = rep ? sumPct(paid, rep) : 0;
  const rows = months(c, paid).reverse();
  const st = { paid: pill('ok', 'Paid'), part: pill('warn', 'Part paid'), due: pill('risk', 'Not paid') };
  const table = rows.length
    ? `<div class="tbl-box"><table class="t tr-t">
        <thead><tr><th>Month</th><th class="r">Trips</th><th class="r">Reported</th><th class="r">Status</th></tr></thead>
        <tbody>${rows.map(({ e, inc, status }) => `<tr>
          <td>${e.tx ? ext(txUrl(e.tx), `Month ${esc(e.args.period)}`, 'tr-month') : `Month ${esc(e.args.period)}`}</td>
          <td class="r">${esc(e.args.rentals)}</td>
          <td class="r">${vnd(inc)}</td>
          <td class="r">${st[status]}</td></tr>`).join('')}</tbody></table></div>`
    : '';

  return `<section class="tr-card" aria-label="${esc(c.name)} records">
    <div class="tr-car-h">
      <a class="tr-car" href="#/car/${c.id}">${photo(c, 'tr-thumb', '')}<span><span class="tr-name">${esc(c.name)}</span><span class="tr-where">${city(c)} · on the road</span></span></a>
      <span class="tr-flag">${flag}</span>
    </div>
    <div class="tr-figs">
      <div><p class="tr-lab">Reported by the operator</p><p class="tr-fig">${rep === null ? '–' : vnd(rep)}</p></div>
      <div><p class="tr-lab">Paid in · ${100 - Number(TERMS.fee)}% to owners</p><p class="tr-fig tr-pos">${vnd(paid)}</p></div>
      <div><p class="tr-lab">Still owed</p><p class="tr-fig${owed > 0n ? ' tr-neg' : ''}">${vnd(owed)}</p></div>
    </div>
    ${rep ? `<div class="tr-bar" role="img" aria-label="${w}% of reported rent paid in"><i style="width:${w}%"></i></div>` : ''}
    ${table}
  </section>`;
}

function soldRecord(c) {
  const L = S.ledger[c.id];
  const rep = L?.reportedIncome ?? null;
  const paid = L?.rentPaid ?? c.rentPaid;
  const owed = L?.unpaid ?? 0n;
  return `<section class="tr-card tr-sold" aria-label="${esc(c.name)} records">
    <a class="tr-car" href="#/car/${c.id}">${photo(c, 'tr-thumb', '')}<span><span class="tr-name">${esc(c.name)}</span><span class="tr-where">${city(c)} · sold</span></span></a>
    <div class="tr-sold-r">
      <p class="tr-sold-n"><span>Reported <b>${rep === null ? '–' : vnd(rep)}</b></span><span>Paid in <b class="tr-pos">${vnd(paid)}</b></span></p>
      ${owed > 0n ? pill('risk', `${vnd(owed)} not paid`) : pill('ok', 'Paid in full')}
    </div>
  </section>`;
}

function latestAudit() {
  const a = S.audits?.[0];
  if (!cfg.AuditRegistry) return '<span class="ink-3">First report coming soon.</span>';
  const text = a ? `Latest report · ${esc(day(a.publishedAt))}` : 'Reports';
  return ext(addrUrl(cfg.AuditRegistry), text, 'tr-tile-a');
}

// ---------- quiet sections ----------

const quiet = (title, body, extra = '') => `<section class="tr-q"><div class="tr-q-h"><h2>${title}</h2>${extra}</div>${body}</section>`;

function audits() {
  if (!cfg.AuditRegistry) return '';
  const list = S.audits;
  const by = S.auditor || cfg.auditor;
  let body;
  if (list === null) body = '<p class="tr-small"><span class="skel">Reading audit reports</span></p>';
  else if (!list.length) body = `<p class="tr-small">${S.auditsError ? 'The audit reports could not be read right now.' : 'No audit report yet.'}</p>`;
  else {
    body = `<ul class="tr-rows">${list.map((a) => {
      const h = String(a.reportHash);
      const subject = BigInt(a.carId) === 0n ? 'Whole fleet' : carName(a.carId);
      return `<li>
        <span class="tr-rows-main"><b>${esc(a.period)}</b> · ${subject}${a.scope ? `<span class="ink-3"> · ${esc(a.scope)}</span>` : ''}</span>
        ${a.exceptions ? pill('warn', 'Exceptions noted') : pill('ok', 'No exceptions')}
        <span class="tr-hash"><span class="t-addr" title="${esc(h)}">${esc(short(h))}</span>${copyBtn(h, `hash of the ${a.period} report`)}</span>
        <span class="ink-3">${esc(day(a.publishedAt))}</span>
      </li>`;
    }).join('')}</ul>`;
  }
  const note = `<p class="tr-small">Published by the auditor wallet${by ? ` ${ext(addrUrl(by), `<span class="t-addr">${esc(short(by))}</span>`)}` : ''}, a team wallet on this testnet. Each holds the hash of the signed report and cannot be edited.</p>`;
  return quiet('Audit reports', body + note);
}

function auditForm() {
  if (!cfg.AuditRegistry || !S.account || !S.auditor || !same(S.account, S.auditor)) return '';
  const f = ui.audit;
  const ex = f.exceptions === '1';
  const input = (k, label, ph) => `<div class="field"><label for="audit-${k}">${label}</label><input class="input" id="audit-${k}" data-bind="audit" data-k="${k}" value="${esc(f[k] ?? '')}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
  const opt = (v, text) => `<option value="${esc(v)}"${String(f.car) === String(v) ? ' selected' : ''}>${text}</option>`;
  return `<section class="tr-q tr-q-card" aria-label="Auditor tools">
    <div class="tr-q-h"><h2>Publish a report</h2><span class="tr-small">Only the auditor wallet sees this. Permanent once published.</span></div>
    <div class="tr-form">
      <div class="field"><label for="audit-car">Car</label>
        <select class="input" id="audit-car" data-bind="audit" data-k="car">${opt('0', 'Whole fleet')}${S.data.cars.map((c) => opt(c.id.toString(), esc(c.name))).join('')}</select></div>
      ${input('period', 'Period', '2026-Q3')}
      ${input('scope', 'Scope', 'Cars, rental income, payouts')}
      <div class="field"><span class="tr-flabel" id="audit-ex-l">Finding</span>
        <div class="seg" role="group" aria-labelledby="audit-ex-l">
          <button type="button" class="${ex ? '' : 'on'}" aria-pressed="${!ex}" data-act="auditSet" data-k="exceptions" data-v="">No exceptions</button>
          <button type="button" class="${ex ? 'on' : ''}" aria-pressed="${ex}" data-act="auditSet" data-k="exceptions" data-v="1">Exceptions noted</button>
        </div></div>
      <div class="tr-form-wide">${input('doc', 'Report: text to hash, or a 0x hash', 'Signed report text, or 0x…')}</div>
    </div>
    <button class="btn btn-p" type="button" data-act="publishAudit"${off(!f.period.trim() || !f.doc.trim())}>${spin('audit')}Publish report</button>
  </section>`;
}

function feeTools() {
  if (!S.account || !same(S.account, S.data.manager)) return '';
  return `<section class="tr-q tr-q-card tr-withdraw" aria-label="Manager tools">
    <div><h2>Manager fees</h2><p class="tr-small">${vnd(S.data.feesOwed)} ready to withdraw to this wallet.</p></div>
    <button class="btn btn-p" type="button" data-act="withdrawFees"${off(S.data.feesOwed === 0n)}>${spin('fees')}Withdraw fees</button>
  </section>`;
}

function activity(r) {
  const open = ui.trFeed === '1' || r?.tab === 'activity';
  const toggle = `<button class="tr-link-btn" type="button" data-act="set" data-k="trFeed" data-v="${open ? '' : '1'}">${open ? 'Hide' : 'Show'}</button>`;
  if (!open) return quiet('Activity', '', toggle);
  let body;
  if (S.feedError) {
    body = `<p class="tr-small">The activity feed could not be loaded. Every event is on the ${ext(addrUrl(cfg.FleetShares), 'FleetShares contract')}.</p>
      <button class="btn btn-sm" type="button" data-act="retry">Try again</button>`;
  } else if (S.events === null) {
    body = '<p class="tr-small"><span class="skel">Reading events from Avalanche Fuji</span></p>';
  } else {
    const all = allEvents();
    if (!all.length) body = '<p class="tr-small">No activity yet.</p>';
    else {
      const shown = ui.trAll ? all : all.slice(0, FEED_ROWS);
      body = `<ol class="tr-feed">${shown.map((e) => {
        const [tag, text] = FEED[e.name] ? FEED[e.name](e.args) : [e.name, esc(e.name)];
        return `<li><span class="tr-tag">${esc(tag)}</span><span class="tr-ev">${text}</span>
          ${e.tx ? `<a class="tr-when" href="${esc(txUrl(e.tx))}" target="_blank" rel="noopener" aria-label="Transaction on the explorer">${when(e)} ${ICON.ext}</a>` : `<span class="tr-when ink-3">${when(e)}</span>`}</li>`;
      }).join('')}</ol>
      ${all.length > FEED_ROWS ? `<button class="tr-link-btn tr-more" type="button" data-act="set" data-k="trAll" data-v="${ui.trAll ? '' : '1'}">${ui.trAll ? 'Show fewer' : `Show all ${all.length}`}</button>` : ''}`;
    }
  }
  return quiet('Activity', body, toggle);
}

const TX_LABELS = {
  listCar1: 'First car listed', listCar2: 'Second car listed', buyAlice: 'Shares bought (first buyer)', buyBob: 'Shares bought (second buyer)',
  soldOutPaysOperator: 'Sell-out pays the operator', payRent: 'Rent paid', claimRent: 'Rent collected', withdrawFees: 'Fees withdrawn',
  makeOffer: 'Offer made', takeOffer: 'Offer taken', buyCar2: 'Shares of the second car bought', icmDeliveredOnFuji: 'ICM report delivered on Fuji',
  listCar3: 'Third car listed', soldOutCar3: 'Third car sells out, pays the operator',
  setOperator: 'Operator set on RentalLog', logRental1: 'First rental logged', logRental2: 'Second rental logged', report: 'Period report sent by ICM',
};
const readable = (k) => TX_LABELS[k] || k.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());

function contracts() {
  const l1 = cfg.l1 || {};
  const fuji = `Fuji · ${esc(cfg.chainId)}`;
  const row = (label, sub, v, href) => (v
    ? `<li><span class="tr-c-l">${label}<span class="ink-3"> · ${sub}</span></span><span class="tr-hash">${href ? ext(href, `<span class="t-addr">${esc(short(v))}</span>`) : `<span class="t-addr">${esc(short(v))}</span>`}${copyBtn(v, `${label}`)}</span></li>`
    : '');
  const auditor = S.auditor || cfg.auditor;
  const addrs = [
    row('FleetShares', fuji, cfg.FleetShares, addrUrl(cfg.FleetShares)),
    row('Demo VND token', fuji, cfg.MockUSDC, addrUrl(cfg.MockUSDC)),
    row('IncomeMirror', fuji, cfg.IncomeMirror, cfg.IncomeMirror && addrUrl(cfg.IncomeMirror)),
    row('RentalLog', l1Label(), l1.RentalLog, l1.RentalLog && l1Url('address', l1.RentalLog)),
    row('CarExit', fuji, cfg.CarExit, cfg.CarExit && addrUrl(cfg.CarExit)),
    row('AuditRegistry', fuji, cfg.AuditRegistry, cfg.AuditRegistry && addrUrl(cfg.AuditRegistry)),
    row('Manager', 'lists cars, takes the fee', S.data.manager || cfg.manager, addrUrl(S.data.manager || cfg.manager)),
    row('Operator', esc(TERMS.operator), cfg.operator, cfg.operator && addrUrl(cfg.operator)),
    cfg.AuditRegistry ? row('Auditor', 'publishes audit reports', auditor, auditor && addrUrl(auditor)) : '',
    ...S.data.cars.map((c) => (c.docsHash ? row(`${esc(c.name)} documents`, 'hash', String(c.docsHash), '') : '')),
  ].join('');
  const open = ui.trTx === '1';
  const txs = (list, sub, url) => Object.entries(list || {}).map(([k, h]) => row(esc(readable(k)), sub, h, url(h))).join('');
  const txList = open ? `<ul class="tr-rows tr-c">${txs(cfg.tx, 'Fuji', txUrl)}${txs(l1.tx, l1Label(), (h) => l1Url('tx', h))}</ul>` : '';
  const toggle = `<button class="tr-link-btn" type="button" data-act="set" data-k="trTx" data-v="${open ? '' : '1'}">${open ? 'Hide transactions' : 'Show reference transactions'}</button>`;
  return quiet('Contracts', `<ul class="tr-rows tr-c">${addrs}</ul>${txList}`, toggle);
}
