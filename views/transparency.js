// Transparency: what the operator reported, what it paid, what the manager took, and every record behind it.
import {
  registerView, S, ui, cfg, TERMS, FEED, esc, usd, fig, pct, short, txUrl, addrUrl, plural, ago, dateStr, same,
  ICON, carName, photo, pill, spin, off, allEvents, stageOf, holdersOf,
} from '../core.js';

const TABS = [
  ['income', 'Income vs. paid'],
  ['audit', 'Documents'],
  ['fees', 'Fees'],
  ['activity', 'Activity'],
  ['contracts', 'Contracts'],
];
const FEED_ROWS = 12;

const ext = (href, text, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}" target="_blank" rel="noopener">${text} ${ICON.ext}</a>`;
const copyBtn = (v, what) => `<button class="tr-copy" type="button" data-act="copy" data-v="${esc(v)}" aria-label="Copy ${esc(what)}">${ICON.copy}</button>`;
const l1Url = (kind, v) => (cfg.l1?.explorer ? `${cfg.l1.explorer}/${kind}/${v}` : '');
// Link to the L1 explorer, or the short hash with a copy button when the L1 has no public explorer.
const l1Ref = (kind, v, text) => (cfg.l1?.explorer ? ext(l1Url(kind, v), text)
  : `<span class="tr-hash">${text} <span class="t-addr">${esc(short(v))}</span>${copyBtn(v, text)}</span>`);
const l1Label = () => esc(cfg.l1?.name || 'Operator L1');
const empty = (text) => `<div class="empty"><p class="t-sm ink-3">${text}</p></div>`;
const sumOf = (cars, f) => cars.reduce((a, c) => a + f(c), 0n);
const sameId = (a, b) => a != null && b != null && BigInt(a) === BigInt(b);
const when = (e) => (e.time
  ? `<time datetime="${new Date(e.time * 1000).toISOString()}" title="${esc(dateStr(e.time))}">${esc(ago(e.time))}</time>`
  : `block ${esc(e.block)}`);

registerView('transparency', (r) => {
  const tab = TABS.some(([k]) => k === r?.tab) ? r.tab : 'income';
  const body = { income, audit, fees, activity, contracts }[tab]();
  return `<div class="head"><div class="tr-intro">
      <h1 class="t-display">Transparency</h1>
      <p class="t-body ink-2">What ${esc(TERMS.operator)} reported, what it paid, what the manager took, and what was checked. Every figure links to its record on-chain.</p>
    </div></div>
    <nav class="tabs tr-tabs" aria-label="Transparency sections">${TABS.map(([k, l]) => [k, k === 'audit' && cfg.AuditRegistry ? 'Audit' : l]).map(([k, label]) => (k === tab
      ? `<a href="#/transparency/${k}" class="on" aria-current="page">${label}</a>`
      : `<a href="#/transparency/${k}">${label}</a>`)).join('')}</nav>
    <div class="tr-body">${body}</div>`;
});

// ---------- Income vs. paid ----------

function income() {
  const l1 = cfg.l1 || {};
  const steps = `<div class="tr-steps">
    <div class="card pad"><p class="t-label">Step 1 · ${l1Label()}</p><h2 class="t-title">${esc(TERMS.operator)} logs each rental</h2><p class="t-sm ink-3">Days rented and income, on its own Avalanche L1.</p></div>
    <div class="card pad"><p class="t-label">Step 2 · Avalanche ICM</p><h2 class="t-title">Monthly totals cross over</h2><p class="t-sm ink-3">Signed by the L1's validators, checked on Fuji.</p></div>
    <div class="card pad"><p class="t-label">Step 3 · Fuji C-Chain · chain ${esc(cfg.chainId)}</p><h2 class="t-title">Compared with rent paid</h2><p class="t-sm ink-3">Any gap shows here and on the car.</p></div>
  </div>`;

  const cars = S.data.cars.filter((c) => ['earning', 'sold'].includes(stageOf(c).key) || Number(S.ledger[c.id]?.periods ?? 0) > 0);
  const rows = cars.map((c) => {
    const L = S.ledger[c.id];
    const rep = L?.reportedIncome ?? 0n, paid = L?.rentPaid ?? 0n;
    const max = rep > paid ? rep : paid;
    const w = (v) => (max > 0n ? Math.max(v > 0n ? 2 : 0, Number((v * 1000n) / max) / 10) : 0);
    const status = !L || rep === 0n ? pill('', 'No report yet')
      : L.unpaid === 0n ? pill('ok', 'Paid in full') : pill('warn', `${usd(L.unpaid)} due`);
    return `<tr>
      <td><a class="carcell" href="#/car/${c.id}">${photo(c, 'thumb', '')}${esc(c.name)}</a></td>
      <td class="r">${L ? esc(Number(L.periods)) : '0'}</td>
      <td class="num">${L ? usd(rep) : '–'}</td>
      <td class="num">${L ? usd(paid) : '–'}</td>
      <td><div class="tr-cov" aria-label="Paid ${max > 0n ? pct(paid, max, 0) : 0}% of reported"><i class="tr-cov-rep" style="width:${w(rep)}%"></i><i class="tr-cov-paid" style="width:${w(paid)}%"></i></div></td>
      <td class="r">${status}</td>
    </tr>`;
  }).join('');
  const table = cars.length
    ? `<div class="tbl-box"><table class="t">
        <thead><tr><th>Car</th><th class="r">Periods reported</th><th class="r">Reported</th><th class="r">Paid</th><th class="tr-cov-h">Coverage</th><th class="r">Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : empty('No car is earning yet. Reports from the operator start once a car is funded and rented out.');

  const links = [
    l1.RentalLog ? (l1.explorer ? ext(l1Url('address', l1.RentalLog), `RentalLog on ${l1Label()} ${short(l1.RentalLog)}`) : l1Ref('address', l1.RentalLog, `RentalLog on ${l1Label()}`)) : '',
    l1.tx?.report ? l1Ref('tx', l1.tx.report, `Report sent from ${l1Label()}`) : '',
    cfg.tx?.icmDeliveredOnFuji ? ext(txUrl(cfg.tx.icmDeliveredOnFuji), 'Delivered on Fuji by ICM') : '',
    cfg.IncomeMirror ? ext(addrUrl(cfg.IncomeMirror), `IncomeMirror on Fuji ${short(cfg.IncomeMirror)}`) : '',
  ].filter(Boolean);
  const reports = S.reports || [];
  const deliveries = reports.length
    ? `<div class="tbl-box"><table class="t">
        <thead><tr><th>Period</th><th>Car</th><th class="r">Rentals</th><th class="r">Days</th><th class="r">Income</th><th class="r">Delivered</th></tr></thead>
        <tbody>${reports.map((e) => `<tr>
          <td>${esc(e.args.period)}</td><td>${carName(e.args.carId)}</td>
          <td class="r">${esc(e.args.rentals)}</td><td class="r">${esc(e.args.daysRented)}</td>
          <td class="num">${usd(e.args.income)}</td>
          <td class="r">${e.tx ? ext(txUrl(e.tx), when(e)) : when(e)}</td></tr>`).join('')}</tbody></table></div>`
    : empty('No report has arrived by ICM yet.');

  return `${steps}
    <section class="card pad">
      <div class="card-h"><div><h2 class="t-title">Reported income and rent paid</h2><p class="t-sm ink-3">VND, all time</p></div>
        <div class="legend"><span><i class="tr-sw-rep"></i>Reported</span><span><i class="tr-sw-paid"></i>Paid</span></div></div>
      ${table}
    </section>
    <section class="card pad tr-gap">
      <div class="card-h"><div><h2 class="t-title">Deliveries by ICM</h2><p class="t-sm ink-3">Each period total from ${l1Label()}, as it arrived on Fuji</p></div></div>
      ${deliveries}
      ${links.length ? `<p class="tr-links t-sm">${links.join('')}</p>` : ''}
    </section>
    <div class="tr-pair tr-gap">
      <section class="card pad tr-rules">
        <h2 class="t-title">Rules in the contract</h2>
        <dl class="kv">
          <div><dt>Money</dt><dd>VND by bank transfer; the chain keeps rules and receipts</dd></div>
          <div><dt>Manager holds investor money</dt><dd>Never</dd></div>
          <div><dt>Operator paid</dt><dd>Only at sell-out</dd></div>
          <div><dt>Missed funding deadline</dt><dd>Full refund</dd></div>
          <div><dt>Management fee</dt><dd>${esc(TERMS.fee)}%, cannot change</dd></div>
          ${cfg.CarExit ? '<div><dt>Resale proceeds</dt><dd>100% to holders, no fee</dd></div>' : ''}
        </dl>
      </section>
      <section class="card pad tr-limits">
        <h2 class="t-title">Limits</h2>
        <div class="note warn">${ICON.shield}<div>
          <p>This is a testnet demo. Amounts are in VND: a test token (1 unit = 25,000 VND) stands in for money that would move by bank transfer.</p>
          <p>The chain cannot force a bank transfer. Someone must still report that the money arrived, and the record is only as true as that report.</p>
          <p>The chain cannot see the real car or its real income. It records who reported what, and it enforces how the money is split.</p>
          <p>Whether the operator buys the car and reports rent honestly depends on the operator and on the legal agreement behind the documents hash.</p>
        </div></div>
      </section>
    </div>`;
}

// ---------- Documents ----------

// ---------- Audit reports (AuditRegistry add-on, only when fuji.json names it) ----------

const day = (ts) => new Date(Number(ts) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function auditReports() {
  const list = S.audits;
  let body;
  if (list === null) body = '<p class="t-sm ink-3"><span class="skel">Reading audit reports</span></p>';
  else if (!list.length) body = empty(S.auditsError ? 'The audit reports could not be read. They will show here when the network answers.' : 'No audit report has been published yet. Each one will show here with the hash of the signed report.');
  else {
    body = `<div class="tbl-box"><table class="t">
      <thead><tr><th>Period</th><th>Scope</th><th>Finding</th><th>Report hash</th><th class="r">Published</th></tr></thead>
      <tbody>${list.map((a) => {
        const h = String(a.reportHash);
        const subject = BigInt(a.carId) === 0n ? 'Whole fleet' : carName(a.carId);
        return `<tr>
          <td><b>${esc(a.period)}</b></td>
          <td>${subject}${a.scope ? `<span class="t-sm ink-3"> · ${esc(a.scope)}</span>` : ''}</td>
          <td>${a.exceptions ? pill('warn', 'Exceptions noted') : pill('ok', 'No exceptions')}</td>
          <td><span class="tr-hash"><span class="t-addr ink-2" title="${esc(h)}">${esc(short(h))}</span>${copyBtn(h, `hash of the ${a.period} report`)}</span></td>
          <td class="r">${esc(day(a.publishedAt))}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }
  const by = S.auditor || cfg.auditor;
  return `<section class="card pad">
      <div class="card-h"><div><h2 class="t-title">Audit reports</h2><p class="t-sm ink-3">Published on chain by the auditor wallet${by ? ` ${ext(addrUrl(by), `<span class="t-addr">${esc(short(by))}</span>`)}` : ''}. On this testnet demo that wallet belongs to the team. Reports cannot be edited or deleted. Each holds the hash of the signed report, so anyone with the file can check it.</p></div></div>
      ${body}
    </section>
    ${auditForm()}`;
}

function auditForm() {
  if (!S.account || !S.auditor || !same(S.account, S.auditor)) return '';
  const f = ui.audit;
  const ex = f.exceptions === '1';
  const input = (k, label, ph) => `<div class="field"><label for="audit-${k}">${label}</label><input class="input" id="audit-${k}" data-bind="audit" data-k="${k}" value="${esc(f[k] ?? '')}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
  const opt = (v, text) => `<option value="${esc(v)}"${String(f.car) === String(v) ? ' selected' : ''}>${text}</option>`;
  return `<section class="card pad tr-gap" aria-label="Auditor tools">
    <div class="card-h"><div><h2 class="t-title">Publish a report</h2><p class="t-sm ink-3">Only the auditor wallet sees this. A published report is permanent.</p></div></div>
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

function audit() {
  const listed = allEvents().filter((e) => e.name === 'CarListed');
  const rows = S.data.cars.map((c) => {
    const ev = listed.find((e) => sameId(e.args.carId, c.id));
    const h = c.docsHash ? String(c.docsHash) : '';
    return `<tr>
      <td><a class="carcell" href="#/car/${c.id}">${photo(c, 'thumb', '')}${esc(c.name)}</a></td>
      <td>Legal documents hash</td>
      <td>${h ? `<span class="tr-hash"><span class="t-addr ink-2" title="${esc(h)}">${esc(short(h))}</span>${copyBtn(h, `documents hash of ${c.name}`)}</span>` : '<span class="ink-3">None</span>'}</td>
      <td class="r">${ev?.tx ? ext(txUrl(ev.tx), ev.time ? when(ev) : 'Listing') : '<span class="ink-3">–</span>'}</td>
    </tr>`;
  }).join('');
  const reg = !!cfg.AuditRegistry;
  return `${reg ? auditReports() : ''}
    <section class="card pad${reg ? ' tr-gap' : ''}">
      <div class="card-h"><div><h2 class="t-title">Documents on chain</h2><p class="t-sm ink-3">Each car is listed with a hash of its legal documents. Anyone holding the papers can check they match.</p></div></div>
      ${S.data.cars.length
        ? `<div class="tbl-box"><table class="t"><thead><tr><th>Car</th><th>Document</th><th>Hash</th><th class="r">Listed</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : empty('No cars are listed yet.')}
    </section>
    ${reg ? '' : '<p class="t-sm ink-3 tr-gap">Independent audit reports are planned each quarter and will be listed here with their hash. None has been published yet.</p>'}`;
}

// ---------- Fees ----------

function fees() {
  const cars = S.data.cars;
  const gross = sumOf(cars, (c) => c.rentPaid), toHolders = sumOf(cars, holdersOf), fee = sumOf(cars, (c) => c.feePaid);
  const isManager = S.account && same(S.account, S.data.manager);
  const paying = cars.filter((c) => c.rentPaid > 0n || ['earning', 'sold'].includes(stageOf(c).key));
  const withdrawn = allEvents().filter((e) => e.name === 'FeesWithdrawn');
  const share = 100 - Number(TERMS.fee);

  const kpis = `<div class="kpis">
    <div><p class="t-label">Rent paid in</p><p class="t-kpi">${fig(gross)}</p><p class="t-sm">Gross, all cars</p></div>
    <div><p class="t-label">Paid to holders</p><p class="t-kpi">${fig(toHolders)}</p><p class="t-sm">${share}% of rent</p></div>
    <div><p class="t-label">Management fee</p><p class="t-kpi">${fig(fee)}</p><p class="t-sm">${esc(TERMS.fee)}% of rent</p></div>
    <div><p class="t-label">Fees awaiting withdrawal</p><p class="t-kpi">${fig(S.data.feesOwed)}</p><p class="t-sm">Held by the contract</p></div>
  </div>`;

  const table = paying.length
    ? `<div class="tbl-box"><table class="t"><thead><tr><th>Car</th><th class="r">Rent paid in</th><th class="r">To holders</th><th class="r">Fee</th><th class="r">Fee share</th></tr></thead>
        <tbody>${paying.map((c) => `<tr>
          <td><a class="carcell" href="#/car/${c.id}">${photo(c, 'thumb', '')}${esc(c.name)}</a></td>
          <td class="num">${usd(c.rentPaid)}</td><td class="num">${usd(holdersOf(c))}</td><td class="num">${usd(c.feePaid)}</td>
          <td class="r">${c.rentPaid > 0n ? `${pct(c.feePaid, c.rentPaid)}%` : '–'}</td></tr>`).join('')}</tbody></table></div>`
    : empty('No rent has been paid in yet.');

  const list = withdrawn.length
    ? `<ul class="tr-list">${withdrawn.map((e) => `<li><span>Manager withdrew <b>${usd(e.args.amount)}</b> VND</span>${e.tx ? ext(txUrl(e.tx), when(e)) : `<span class="ink-3">${when(e)}</span>`}</li>`).join('')}</ul>`
    : S.events === null ? '<p class="t-sm ink-3"><span class="skel">Reading events</span></p>' : empty('The manager has not withdrawn any fees yet.');

  return `${kpis}
    <p class="t-sm ink-2 tr-gap">Every rent payment is split ${share} / ${esc(TERMS.fee)} the moment it arrives. This fee is the only money the manager can take out.</p>
    ${isManager ? `<div class="card pad tr-gap tr-withdraw"><div><h2 class="t-title">You are the manager</h2><p class="t-sm ink-3">${usd(S.data.feesOwed)} VND is ready to withdraw to this wallet.</p></div>
      <button class="btn btn-p" type="button" data-act="withdrawFees"${off(S.data.feesOwed === 0n)}>${spin('fees')}Withdraw fees</button></div>` : ''}
    <section class="card pad tr-gap"><div class="card-h"><div><h2 class="t-title">Fees by car</h2><p class="t-sm ink-3">VND, all time</p></div></div>${table}</section>
    <section class="card pad tr-gap"><div class="card-h"><div><h2 class="t-title">Fee withdrawals</h2><p class="t-sm ink-3">Read from FeesWithdrawn events</p></div></div>${list}</section>`;
}

// ---------- Activity ----------

function activity() {
  let body;
  if (S.feedError) {
    body = `<div class="empty"><p class="t-sm ink-3">The activity feed could not be loaded. You can read every event on the ${ext(addrUrl(cfg.FleetShares), 'FleetShares contract')}.</p>
      <button class="btn btn-sm" type="button" data-act="retry">Try again</button></div>`;
  } else if (S.events === null) {
    body = '<p class="t-sm ink-3"><span class="skel">Reading events from Avalanche Fuji</span></p>';
  } else {
    const all = allEvents();
    if (!all.length) body = empty('No activity yet.');
    else {
      const shown = ui.trAll ? all : all.slice(0, FEED_ROWS);
      body = `<ol class="tr-feed">${shown.map((e) => {
        const [tag, text] = FEED[e.name] ? FEED[e.name](e.args) : [e.name, esc(e.name)];
        return `<li><span class="tr-tag">${esc(tag)}</span><span class="tr-ev">${text}</span>
          ${e.tx ? `<a class="tr-when" href="${esc(txUrl(e.tx))}" target="_blank" rel="noopener" aria-label="Transaction on the explorer">${when(e)} ${ICON.ext}</a>` : `<span class="tr-when ink-3">${when(e)}</span>`}</li>`;
      }).join('')}</ol>
      ${all.length > FEED_ROWS ? `<button class="btn btn-sm tr-more" type="button" data-act="set" data-k="trAll" data-v="${ui.trAll ? '' : '1'}">${ui.trAll ? 'Show fewer' : `Show all ${all.length}`}</button>` : ''}`;
    }
  }
  return `<section class="card pad"><div class="card-h"><div><h2 class="t-title">Activity</h2><p class="t-sm ink-3">Read from contract events. Every line links to its transaction.</p></div></div>${body}</section>`;
}

// ---------- Contracts ----------

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
  const addrRow = (label, sub, addr, href) => (addr
    ? `<div><dt>${label}<span class="t-sm ink-3">${sub}</span></dt><dd><span class="tr-hash">${href ? ext(href, `<span class="t-addr">${esc(short(addr))}</span>`) : `<span class="t-addr">${esc(short(addr))}</span>`}${copyBtn(addr, `${label} address`)}</span></dd></div>`
    : '');
  const fuji = `Fuji C-Chain · ${esc(cfg.chainId)}`;
  const l1Name = l1Label();
  const txRows = (txs, sub, url) => Object.entries(txs || {}).map(([k, h]) => {
    const hash = `<span class="t-addr">${esc(short(h))}</span>`;
    return `<div><dt>${esc(readable(k))}<span class="t-sm ink-3">${sub}</span></dt><dd><span class="tr-hash">${url(h) ? ext(url(h), hash) : hash}${copyBtn(h, `${readable(k)} transaction hash`)}</span></dd></div>`;
  }).join('');
  return `<div class="tr-pair">
    <section class="card pad"><h2 class="t-title tr-kv-h">Contracts and roles</h2>
      <dl class="kv tr-kv">
        ${addrRow('FleetShares', fuji, cfg.FleetShares, addrUrl(cfg.FleetShares))}
        ${addrRow('Demo VND token (test)', fuji, cfg.MockUSDC, addrUrl(cfg.MockUSDC))}
        ${addrRow('IncomeMirror', fuji, cfg.IncomeMirror, cfg.IncomeMirror && addrUrl(cfg.IncomeMirror))}
        ${addrRow('RentalLog', l1Name, l1.RentalLog, l1.RentalLog && l1Url('address', l1.RentalLog))}
        ${addrRow('Manager', 'Lists cars, takes the fee', S.data.manager || cfg.manager, addrUrl(S.data.manager || cfg.manager))}
        ${addrRow('Operator', `${esc(TERMS.operator)}, runs the cars`, cfg.operator, cfg.operator && addrUrl(cfg.operator))}
        ${addrRow('CarExit', `${fuji} · pays out resale money`, cfg.CarExit, cfg.CarExit && addrUrl(cfg.CarExit))}
        ${addrRow('AuditRegistry', `${fuji} · audit reports`, cfg.AuditRegistry, cfg.AuditRegistry && addrUrl(cfg.AuditRegistry))}
        ${cfg.AuditRegistry ? addrRow('Auditor', 'Publishes audit reports', S.auditor || cfg.auditor, (S.auditor || cfg.auditor) && addrUrl(S.auditor || cfg.auditor)) : ''}
      </dl>
    </section>
    <section class="card pad"><h2 class="t-title tr-kv-h">Reference transactions</h2>
      <dl class="kv tr-kv">
        ${txRows(cfg.tx, 'Fuji', txUrl)}
        ${txRows(l1.tx, l1Name, (h) => l1Url('tx', h))}
      </dl>
    </section>
  </div>`;
}
