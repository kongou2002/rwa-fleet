// Builds docs/FleetShares-pitch.pptx.
//
//   NODE_PATH=/path/with/node_modules node docs/deck/build.js      (needs pptxgenjs)
//
// Addresses and proof links come from docs/fuji.json and the README's "Proof" table. Live figures
// (rent, reported vs paid, audit reports, gas) are read from the chain with Foundry's `cast` at build
// time. The worked example is recomputed from the constants in web/views/how.js. Screenshots are the
// .jpg files next to this script, made by shots.mjs. Set LIVE=0 to skip the chain reads.
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const IMG = (n) => path.join(__dirname, n + ".jpg");
const cfg = JSON.parse(read("docs/fuji.json"));
const README = read("README.md");
const L1 = cfg.l1 || {};
const ON_DISPATCH = /dispatch/i.test(L1.name || "");
const L1_NAME = (L1.name || "Avalanche L1").replace(/\s*\((Fuji|chain \d+)\)\s*/i, "");

// ---------- data ----------

const FUJI_RPC = process.env.FUJI_RPC || "https://avalanche-fuji-c-chain-rpc.publicnode.com";
const CAST = process.env.CAST || path.join(process.env.HOME, ".foundry/bin/cast");
const LIVE = process.env.LIVE !== "0";
function cast(args) {
  return JSON.parse(execFileSync(CAST, args, { encoding: "utf8", timeout: 30000 }));
}
const call = (to, sig, ...a) => cast(["call", "--json", "--rpc-url", FUJI_RPC, to, sig, ...a.map(String)]);
const usd = (raw) => Number(BigInt(raw) / 10000n) / 100; // 6-decimal USDC to a number
const n0 = (n) => Math.round(n).toLocaleString("en-US");
const short = (h) => h.slice(0, 6) + "…" + h.slice(-4);
const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const live = { block: null, cars: [], rent: 0, fee: 0, reported: 0, paid: 0, unpaid: 0, audits: null, exits: 0, gas: null, baseFee: null };
if (LIVE) {
  live.block = Number(execFileSync(CAST, ["block-number", "--rpc-url", FUJI_RPC], { encoding: "utf8" }).trim());
  live.at = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const CAR = "getCar(uint256)((string,string,bytes32,address,uint64,uint32,uint32,uint8,uint256,uint256,uint256,uint256))";
  const count = Number(call(cfg.FleetShares, "carCount()(uint256)")[0]);
  for (let id = 1; id <= count; id++) {
    const [c] = call(cfg.FleetShares, CAR, id);
    const car = { id, name: c[0], total: Number(c[5]), sold: Number(c[6]), status: Number(c[7]), price: usd(c[8]), rent: usd(c[9]), fee: usd(c[10]) };
    live.cars.push(car);
    live.rent += car.rent; live.fee += car.fee;
    if (cfg.IncomeMirror && car.status === 2) {
      const [rep, paid, unpaid] = call(cfg.IncomeMirror, "ledger(uint256)(uint256,uint256,uint256)", id);
      live.reported += usd(rep); live.paid += usd(paid); live.unpaid += usd(unpaid);
      car.ledger = { reported: usd(rep), paid: usd(paid), unpaid: usd(unpaid) };
    }
    if (cfg.CarExit) {
      const [e] = call(cfg.CarExit, "exitOf(uint256)((uint256,uint256,uint32,uint32,uint64))", id);
      if (BigInt(e[0]) > 0n) live.exits++;
    }
  }
  if (cfg.AuditRegistry) live.audits = Number(call(cfg.AuditRegistry, "reportCount()(uint256)")[0]);
  if (cfg.tx?.payRent) {
    live.gas = Number(execFileSync(CAST, ["receipt", "--rpc-url", FUJI_RPC, cfg.tx.payRent, "gasUsed"], { encoding: "utf8" }).trim());
    live.baseFee = Number(execFileSync(CAST, ["base-fee", "--rpc-url", "https://api.avax.network/ext/bc/C/rpc"], { encoding: "utf8" }).trim());
  }
  console.log("live:", JSON.stringify({ ...live, cars: live.cars.map((c) => `${c.id} ${c.name} ${c.sold}/${c.total} s${c.status}`) }));
}
const funding = live.cars.find((c) => c.status === 1);
const earningCars = live.cars.filter((c) => c.status === 2);

// Tests: count test functions in test/*.sol.
const TESTS = fs.readdirSync(path.join(ROOT, "test")).filter((f) => f.endsWith(".sol"))
  .reduce((a, f) => a + (read("test/" + f).match(/function test\w*\s*\(/g) || []).length, 0);
const CONTRACTS = ["FleetShares", "MockUSDC", "IncomeMirror", "CarExit", "AuditRegistry"].filter((k) => cfg[k]).length + (L1.RentalLog ? 1 : 0);

// Off-chain terms and the worked example, from the app's own source.
const core = read("web/core.js");
const GROSS = (core.match(/gross:\s*\[(\d+),\s*(\d+)\]/) || [0, 12, 15]).slice(1, 3).map(Number);
const FEE = Number((core.match(/fee:\s*(\d+)\s*}/) || [0, 10])[1]);
const EX = Function(`return (${read("web/views/how.js").match(/const EX = (\{[^}]+\})/)[1]})`)();
function flows({ price, gross, fee, years, resale }) {
  const rent = price * gross * (1 - fee);
  return [-price, ...Array.from({ length: years }, (_, i) => rent + (i === years - 1 ? price * resale : 0))];
}
function irr(cf) {
  const npv = (r) => cf.reduce((a, c, t) => a + c / (1 + r) ** t, 0);
  let lo = -0.99, hi = 10;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const exRent = EX.price * EX.gross * (1 - EX.fee) * EX.years, exResale = EX.price * EX.resale, exBack = exRent + exResale;
const exIrr = irr(flows(EX)), exHi = irr(flows({ ...EX, gross: 0.15, resale: 0.6 }));

// Proof rows from the README table "| Proof | Transaction |".
function proofRows() {
  const lines = README.split("\n");
  const start = lines.findIndex((l) => /^\|\s*Proof\s*\|/.test(l));
  if (start < 0) return [];
  const rows = [];
  for (const l of lines.slice(start + 2)) {
    if (!l.startsWith("|")) break;
    const m = l.match(/^\|\s*(.+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)/);
    const c = l.match(/^\|\s*(.+?)\s*\|\s*`(0x[0-9a-fA-F]+)`/);
    const clean = (w) => w.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s*\(no public explorer\)/i, "");
    if (m) rows.push({ what: clean(m[1]), hash: m[2], url: m[3] });
    else if (c) rows.push({ what: clean(c[1]), hash: short(c[2]), url: null });
  }
  return rows;
}
const PROOF = proofRows();
const fuji = (kind, h) => `https://testnet.snowtrace.io/${kind}/${h}`;
const l1url = (kind, h) => (L1.explorer ? `${L1.explorer}/${kind}/${h}` : null);

// ---------- design ----------

const INK = "0D1117", INK2 = "475260", INK3 = "646D79", LINE = "D9DCE1", SOFT = "F5F5F6", RED = "C8102E", WHITE = "FFFFFF";
const FONT = "Arial", MONO = "Courier New";
const W = 13.333, M = 0.6, CW = W - 2 * M;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "FleetShares";
pres.author = "Team Oicha";

let no = 0;
function slide(head) {
  const s = pres.addSlide();
  s.background = { color: WHITE };
  no++;
  if (head) {
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.1, fill: { color: RED }, line: { color: RED, width: 0 } });
    t(s, head, { x: M, y: 0.42, w: CW, h: 0.95, fontSize: 34, bold: true, valign: "middle" });
    t(s, `FleetShares  ${no}`, { x: W - M - 2.5, y: 7.0, w: 2.5, h: 0.3, fontSize: 11, color: INK3, align: "right" });
  }
  return s;
}
function t(s, text, o) {
  s.addText(text, Object.assign({ fontFace: FONT, color: INK, margin: 0, valign: "top", isTextBox: true }, o));
}
function foot(s, text) { t(s, text, { x: M, y: 7.0, w: CW - 2.7, h: 0.3, fontSize: 11, color: INK3 }); }
function rule(s, x, y, w, color = LINE, width = 0.75) { s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color, width } }); }
function box(s, x, y, w, h, o = {}) {
  s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: o.fill || WHITE }, line: { color: o.line || LINE, width: o.lw || 0.75, dashType: o.dash || "solid" } });
}
function arrow(s, x, y, w, color = INK2, back = false) {
  s.addShape(pres.ShapeType.line, { x, y, w, h: 0, flipH: back, line: { color, width: 1.25, endArrowType: "triangle" } });
}
// Pixel size of a JPEG, read from its SOF marker.
function jpegSize(file) {
  const b = fs.readFileSync(file);
  for (let i = 2; i < b.length;) {
    const marker = b[i + 1], len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  throw new Error("no size in " + file);
}
// A screenshot fitted into a box (keeps its ratio, aligned top-left unless centred), with a hairline frame.
function shot(s, name, x, y, w, h, align = "left") {
  const { w: pw, h: ph } = jpegSize(IMG(name));
  let iw = w, ih = (w * ph) / pw;
  if (ih > h) { ih = h; iw = (h * pw) / ph; }
  const ix = align === "center" ? x + (w - iw) / 2 : align === "right" ? x + w - iw : x;
  s.addImage({ path: IMG(name), x: ix, y, w: iw, h: ih });
  s.addShape(pres.ShapeType.rect, { x: ix, y, w: iw, h: ih, fill: { type: "none" }, line: { color: LINE, width: 0.75 } });
  return { x: ix, y, w: iw, h: ih };
}
const lines = (arr, o = {}) => arr.map((x, i) => ({ text: x, options: Object.assign({ breakLine: i < arr.length - 1 }, o) }));

// ---------- slides ----------

// 1. Title
{
  const s = slide();
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.9, fill: { color: RED }, line: { color: RED, width: 0 } });
  t(s, "FleetShares", { x: M, y: 0, w: 5, h: 0.9, fontSize: 24, bold: true, color: WHITE, valign: "middle" });
  t(s, "Team1 Vietnam UniHack 2026 · Avalanche", { x: W - M - 6, y: 0, w: 6, h: 0.9, fontSize: 15, color: WHITE, align: "right", valign: "middle" });
  t(s, "Own a share of a rental car", { x: M, y: 1.55, w: 5.9, h: 2.1, fontSize: 52, bold: true, valign: "bottom" });
  t(s, `Buy shares of one car in USDC. The contract pays the rental company and splits every rent payment: ${100 - FEE}% to holders, ${FEE}% fee.`,
    { x: M, y: 3.9, w: 5.7, h: 1.3, fontSize: 20, color: INK2 });
  t(s, "kongou2002.github.io/rwa-fleet", { x: M, y: 5.45, w: 5.9, h: 0.45, fontSize: 20, bold: true, color: RED, hyperlink: { url: "https://kongou2002.github.io/rwa-fleet/" } });
  t(s, "github.com/kongou2002/rwa-fleet", { x: M, y: 5.95, w: 5.9, h: 0.4, fontSize: 16, color: INK2, hyperlink: { url: "https://github.com/kongou2002/rwa-fleet" } });
  shot(s, "car", 6.95, 1.55, W - M - 6.95, 4.8, "right");
  t(s, "Testnet prototype on Avalanche Fuji · Team Oicha · Car photos: Wikimedia Commons, CC BY-SA 4.0 (credits in the README)",
    { x: M, y: 6.95, w: CW, h: 0.3, fontSize: 11, color: INK3 });
}

// 2. Problem
{
  const s = slide("A rental car earns 10–15% a year");
  t(s, "10–15%", { x: M, y: 1.75, w: 5.6, h: 1.5, fontSize: 96, bold: true, color: RED, valign: "bottom" });
  t(s, "gross rent a year on the car's price. Industry estimate; we have not measured it.", { x: M, y: 3.35, w: 5.2, h: 0.9, fontSize: 18, color: INK2 });
  t(s, "USD 1.17 bn", { x: 7.0, y: 1.75, w: 5.7, h: 1.5, fontSize: 66, bold: true, valign: "bottom" });
  t(s, "Vietnam car rental market, 2026 estimate (Mordor Intelligence).", { x: 7.0, y: 3.35, w: 5.4, h: 0.9, fontSize: 18, color: INK2 });
  rule(s, M, 4.75, CW);
  t(s, "Only people who can buy a whole car get that income. Pooling money through a company means trusting it with the cash, the fee and the income report.", { x: M, y: 5.05, w: CW, h: 0.9, fontSize: 22 });
  foot(s, "Market: Mordor Intelligence, Vietnam Car Rental Market report, read 22 Nov 2026. IMARC estimates lower: USD 376 m for 2025.");
}

// 3. Solution
{
  const s = slide("A vault buys cars in shares");
  const y = 1.75, h = 2.05, bw = 3.0, gap = (CW - 3 * bw) / 2;
  const node = (i, label, head, body, red) => {
    const x = M + i * (bw + gap);
    box(s, x, y, bw, h, red ? { fill: RED, line: RED } : {});
    const c = red ? WHITE : INK, c2 = red ? WHITE : INK2;
    t(s, label, { x: x + 0.25, y: y + 0.22, w: bw - 0.5, h: 0.3, fontSize: 12, color: red ? WHITE : INK3 });
    t(s, head, { x: x + 0.25, y: y + 0.55, w: bw - 0.5, h: 0.45, fontSize: 20, bold: true, color: c });
    t(s, body, { x: x + 0.25, y: y + 1.05, w: bw - 0.5, h: h - 1.2, fontSize: 14, color: c2 });
  };
  node(0, "Anywhere · USDC", "Investors", `Pay for shares when they buy. Get ${100 - FEE}% of rent and the resale.`);
  node(1, "Manager · smart contract", "FleetShares vault", `Lists cars. Takes a fixed ${FEE}% of rent and nothing else.`, true);
  node(2, "Rental company · Vietnam", "Company A", "Buys and rents out the car. Pays rent on chain. Sells it after 4–5 years.");
  [["buy shares", `${100 - FEE}% of rent + resale`], ["car price", "rent, monthly"]].forEach(([fwd, back], i) => {
    const x = M + bw + i * (bw + gap) + 0.12, w = gap - 0.24;
    t(s, fwd, { x, y: y + 0.18, w, h: 0.4, fontSize: 12, color: INK2, align: "center", valign: "bottom" });
    arrow(s, x, y + 0.65, w);
    arrow(s, x, y + 1.35, w, RED, true);
    t(s, back, { x, y: y + 1.45, w, h: 0.45, fontSize: 12, color: RED, align: "center" });
  });
  box(s, M, 4.35, CW, 0.85, { dash: "dash", line: "9AA1AB" });
  t(s, [{ text: "Independent auditor  ", options: { bold: true } }, { text: "publishes a hash of each signed report on chain (AuditRegistry). Holders can check the file against it.", options: { color: INK2 } }],
    { x: M + 0.3, y: 4.35, w: CW - 0.6, h: 0.85, fontSize: 16, valign: "middle" });
  t(s, "Everything the three parties need to check sits on chain: the purchase money, the fee, each rent payment and the income report.", { x: M, y: 5.6, w: CW, h: 0.8, fontSize: 18 });
  foot(s, "Company A is a placeholder name for the rental operator. No operator or auditor has signed with us.");
}

// 4. Money flow
{
  const s = slide("How the money moves");
  const steps = [
    ["01", "Fund", "Investors pay for shares up front. The USDC waits in the contract.", "buyShares"],
    ["02", "Sell-out", "The last share sends the full price to Company A. Deadline missed: full refund.", "CarFunded · refund"],
    ["03", "Rent", `Each payment is split as it arrives: ${100 - FEE} to holders, ${FEE} fee.`, "payRent · claim"],
    ["04", "Resale", "After 4–5 years the car is sold. Holders redeem pro rata. No fee.", "CarExit.redeem"],
    ["05", "Next car", "Returned capital and new money fund the next car.", "listCar"],
  ];
  const y = 1.7, h = 2.75, gap = 0.32, bw = (CW - 4 * gap) / 5;
  steps.forEach(([n, head, body, fn], i) => {
    const x = M + i * (bw + gap);
    box(s, x, y, bw, h);
    t(s, n, { x: x + 0.2, y: y + 0.2, w: 1, h: 0.3, fontSize: 14, bold: true, color: RED });
    t(s, head, { x: x + 0.2, y: y + 0.55, w: bw - 0.4, h: 0.4, fontSize: 19, bold: true });
    t(s, body, { x: x + 0.2, y: y + 1.0, w: bw - 0.4, h: 1.25, fontSize: 14, color: INK2 });
    t(s, fn, { x: x + 0.2, y: y + h - 0.45, w: bw - 0.4, h: 0.3, fontSize: 11, color: INK3, fontFace: MONO });
    if (i < 4) arrow(s, x + bw + 0.04, y + h / 2, gap - 0.08);
  });
  [[`${100 - FEE}%`, "of rent to holders", RED], [`${FEE}%`, "fee, fixed in the code", INK], ["0%", "fee on resale", INK]].forEach(([v, l, c], i) => {
    const x = M + i * (CW / 3);
    t(s, v, { x, y: 4.85, w: 3.8, h: 1.1, fontSize: 60, bold: true, color: c, valign: "bottom" });
    t(s, l, { x, y: 6.0, w: 3.8, h: 0.4, fontSize: 18, color: INK2 });
  });
  foot(s, "Step 5 is the plan: putting returned money into the next car is each investor's choice, not automatic in the contract.");
}

// 5. Product: cars and buying
{
  const s = slide("Real cars. Pay for your shares when you buy.");
  const panel = shot(s, "buypanel", M, 1.55, CW, 5.05, "right");
  const cards = shot(s, "cards", M, 1.55, panel.x - M - 0.3, 4.4);
  const cap = funding
    ? `${funding.name}: ${funding.total} shares × ${n0(funding.price)} USDC, ${funding.sold} sold so far. If it does not sell out by the deadline, every buyer gets the money back.`
    : "Each car shows its shares, price and deadline. If a car does not sell out in time, every buyer gets the money back.";
  t(s, cap, { x: M, y: cards.y + cards.h + 0.2, w: cards.w, h: 0.8, fontSize: 16, color: INK2 });
  foot(s, `The live app on Fuji, ${today}. Prices and shares sold are read from the contract.`);
}

// 6. Product: market and portfolio
{
  const s = slide("Sell your shares to another investor");
  const iw = 8.5;
  const a = shot(s, "market", M, 1.55, iw, 2.9);
  shot(s, "portfolio", M, a.y + a.h + 0.25, iw, 6.7 - (a.y + a.h + 0.25));
  const x = M + iw + 0.45, w = W - M - x;
  t(s, lines([
    "A holder posts shares at a price. They keep earning rent until sold.",
    "The buyer pays in one transaction: USDC to the seller, shares to the buyer.",
    "Rent earned before the sale stays with the seller.",
  ], { paraSpaceAfter: 18 }), { x, y: 1.65, w, h: 4.6, fontSize: 18 });
  foot(s, `Market and a test holder's portfolio in the live app, ${today}.`);
}

// 7. Transparency
{
  const s = slide("What Company A reported, next to what it paid");
  const y = 1.65, h = 1.95, bw = 3.35, gap = (CW - 3 * bw) / 2;
  const node = (i, label, head, body, red) => {
    const x = M + i * (bw + gap);
    box(s, x, y, bw, h, red ? { line: RED, lw: 1.25 } : {});
    t(s, label, { x: x + 0.25, y: y + 0.22, w: bw - 0.5, h: 0.3, fontSize: 12, color: red ? RED : INK3, bold: !!red });
    t(s, head, { x: x + 0.25, y: y + 0.55, w: bw - 0.5, h: 0.45, fontSize: 19, bold: true });
    t(s, body, { x: x + 0.25, y: y + 1.05, w: bw - 0.5, h: h - 1.15, fontSize: 14, color: INK2 });
  };
  node(0, `${L1_NAME} · chain ${L1.chainId}`, "Each rental logged", "RentalLog: one transaction per rental, with days and income.");
  node(1, "Avalanche ICM", "Totals cross over", "A Teleporter message, signed by the L1's validators.", true);
  node(2, "Fuji C-Chain · 43113", "Checked against rent", "IncomeMirror accepts messages only from that L1 and that contract.");
  [0, 1].forEach((i) => arrow(s, M + bw + i * (bw + gap) + 0.12, y + h / 2, gap - 0.24, RED));
  // Per funded car: reported on the L1, paid on Fuji, and what is still due.
  const cols = [M, M + 5.2, M + 7.4, M + 9.6], cw2 = [5.0, 2.0, 2.0, CW - 9.6];
  const th = 3.95, rh2 = 0.48;
  ["Funded car", "Reported (L1)", "Paid (Fuji)", "Still due"].forEach((h, i) => t(s, h, { x: cols[i], y: th, w: cw2[i], h: 0.35, fontSize: 13, bold: true, color: INK3, align: i ? "right" : "left" }));
  rule(s, M, th + 0.4, CW);
  earningCars.slice(0, 3).forEach((c, j) => {
    const y = th + 0.45 + j * rh2, L = c.ledger || { reported: 0, paid: 0, unpaid: 0 };
    const due = L.unpaid > 0 ? `${n0(L.unpaid)} USDC` : L.reported > 0 ? "Paid in full" : "No report yet";
    [c.name, n0(L.reported), n0(L.paid), due].forEach((v, i) => t(s, v, { x: cols[i], y, w: cw2[i], h: rh2, fontSize: 19, valign: "middle", align: i ? "right" : "left", bold: i === 3 && L.unpaid > 0, color: i === 3 ? (L.unpaid > 0 ? RED : INK2) : INK }));
    rule(s, M, y + rh2, CW);
  });
  const audits = live.audits == null ? "" : live.audits === 0 ? " None published yet." : ` ${live.audits} published so far.`;
  t(s, [{ text: "Audit  ", options: { bold: true } }, { text: `The auditor's report hashes go to AuditRegistry and cannot be edited or deleted.${audits}`, options: { color: INK2 } }],
    { x: M, y: 5.85 + Math.max(0, earningCars.length - 2) * 0.2, w: CW, h: 0.6, fontSize: 17 });
  foot(s, `IncomeMirror.ledger on Fuji, block ${live.block}, ${live.at}. The chain cannot see rentals the operator never logs.`);
}

// 8. Worked example
{
  const s = slide("One car, start to finish: an example");
  const im = shot(s, "example", M, 1.5, CW, 3.95, "center");
  t(s, lines([
    `Assumptions from the app's How it works page, not a forecast: ${n0(EX.price)} USDC car, ${pct(EX.gross)} gross rent, ${pct(EX.fee)} fee, ${EX.years} years, resale at ${pct(EX.resale)}.`,
    `Holders get ${n0(exRent)} rent + ${n0(exResale)} resale = ${n0(exBack)} back on ${n0(EX.price)}: ${(exBack / EX.price).toFixed(2)}×, IRR ${pct(exIrr)} a year. Resale value moves it most: 15% rent and 60% resale gives ${pct(exHi)}.`,
  ], { paraSpaceAfter: 10 }), { x: M, y: im.y + im.h + 0.25, w: CW, h: 6.8 - (im.y + im.h + 0.25), fontSize: 17 });
}

// 9. Three answers
{
  const s = slide("Why on chain, and why Avalanche");
  const gasLine = live.gas && live.baseFee
    ? `A rent payment used ${n0(live.gas)} gas: about ${(live.gas * live.baseFee / 1e18).toFixed(4)} AVAX at today's C-Chain base fee.`
    : "Fees stay low enough to pay rent per car, monthly.";
  const cols = [
    ["Why on chain", ["Investors, the manager and the rental company do not have to trust each other.", `The contract holds purchase money, fixes the ${FEE}% fee and pays rent by share.`, "Anyone can check every payment."]],
    ["Why Avalanche", [ON_DISPATCH ? "The operator logs rentals on an Avalanche L1, one cheap transaction each." : `Rentals are logged on our own Avalanche L1 (chain ${L1.chainId}): one cheap transaction each, and only allow-listed addresses can write.`, ON_DISPATCH ? "ICM carries the signed totals to the C-Chain, where the money is." : "Our ICM relayer carries the signed totals to the C-Chain, where the money is.", gasLine]],
    ["Where money comes from", ["Rent Company A earns from renting the car out, and the car's resale.", `The manager earns only its ${FEE}% of rent. No token, no printed yield.`, "On testnet, rent is test USDC paid by our own operator key."]],
  ];
  const gap = 0.45, cw = (CW - 2 * gap) / 3;
  cols.forEach(([head, body], i) => {
    const x = M + i * (cw + gap);
    rule(s, x, 1.75, cw, RED, 2.5);
    t(s, head, { x, y: 1.95, w: cw, h: 0.5, fontSize: 20, bold: true });
    t(s, lines(body, { paraSpaceAfter: 14 }), { x, y: 2.65, w: cw, h: 3.9, fontSize: 17, color: INK2 });
  });
  if (live.gas) foot(s, `Gas from the rent payment ${short(cfg.tx.payRent)} on Fuji; base fee read from C-Chain mainnet, ${today}.`);
}

// 10. Proof
{
  const s = slide(`Live on Avalanche Fuji, with ${TESTS} tests`);
  const C = [["FleetShares", cfg.FleetShares], ["MockUSDC", cfg.MockUSDC], ["IncomeMirror", cfg.IncomeMirror], ["CarExit", cfg.CarExit], ["AuditRegistry", cfg.AuditRegistry]]
    .filter(([, a]) => a).map(([n, a]) => [n, a, fuji("address", a)]);
  if (L1.RentalLog) C.push([`RentalLog (${L1_NAME})`, L1.RentalLog, l1url("address", L1.RentalLog)]);
  const lw = 4.3, rh = 0.5;
  t(s, "Contracts", { x: M, y: 1.6, w: lw, h: 0.35, fontSize: 14, bold: true, color: INK3 });
  C.forEach(([n, a, url], i) => {
    const y = 2.05 + i * rh;
    t(s, n, { x: M, y, w: 2.5, h: rh, fontSize: 15, valign: "middle" });
    t(s, short(a), { x: M + 2.55, y, w: lw - 2.55, h: rh, fontSize: 14, color: url ? RED : INK2, fontFace: MONO, valign: "middle", ...(url ? { hyperlink: { url } } : {}) });
    rule(s, M, y + rh, lw);
  });
  const x = M + lw + 0.5, w = W - M - x;
  t(s, "Transactions", { x, y: 1.6, w, h: 0.35, fontSize: 14, bold: true, color: INK3 });
  const rows = PROOF.slice(0, 9);
  const ph = Math.min(0.56, 4.75 / Math.max(rows.length, 1));
  rows.forEach((r, i) => {
    const y = 2.05 + i * ph;
    const what = r.what.length > 120 ? r.what.slice(0, r.what.lastIndexOf(" ", 118)) + "…" : r.what; // two lines fit in a row
    t(s, what, { x, y, w: w - 1.75, h: ph, fontSize: 12, valign: "middle" });
    t(s, r.hash.includes("…") ? r.hash : short(r.url.split("/").pop()), { x: x + w - 1.65, y, w: 1.65, h: ph, fontSize: 13, color: r.url ? RED : INK2, fontFace: MONO, align: "right", valign: "middle", ...(r.url ? { hyperlink: { url: r.url } } : {}) });
    rule(s, x, y + ph, w);
  });
  t(s, `${CONTRACTS} contracts on 2 chains · ${TESTS} Foundry tests on the money paths`, { x: M, y: 2.05 + C.length * rh + 0.35, w: lw, h: 0.8, fontSize: 15, color: INK2 });
  foot(s, L1.explorer ? "Every row links to its explorer page. Full list in docs/fuji.json." : "Red rows link to Snowtrace. The team's L1 has no public explorer, so its rows are plain hashes. Full list in docs/fuji.json.");
}

// 11. Limits and law
{
  const s = slide("What is real today, and what is not");
  const gap = 0.6, cw = (CW - gap) / 2;
  const real = [
    `${CONTRACTS} contracts on Fuji and an Avalanche L1, used by real testnet transactions`,
    `Money rules enforced by code: escrow, refund, ${100 - FEE} / ${FEE} split, share offers`,
    ON_DISPATCH ? "Income report sent over ICM and compared with rent paid" : "Income reports sent from our own L1 over ICM, compared with rent paid",
    `${TESTS} Foundry tests on the money paths`,
  ];
  const not = [
    "No real car or rental company yet. Company A is a placeholder.",
    "Test USDC. Rent is paid by our own operator key.",
    "An operator that stops paying is not forced to: no bond yet.",
    `Contracts not audited.${live.exits === 0 ? " No car resold yet." : ""}${live.audits === 0 ? " No audit report published yet." : ""}`,
  ];
  if (ON_DISPATCH) not.push("RentalLog runs on Dispatch, Avalanche's public test L1, not the operator's own.");
  else not.push("Our team runs the L1, not a rental company. It has no public explorer yet.");
  [["Real on testnet", real, INK], ["Not yet", not, RED]].forEach(([head, items, c], i) => {
    const x = M + i * (cw + gap);
    rule(s, x, 1.65, cw, c, 2.5);
    t(s, head, { x, y: 1.8, w: cw, h: 0.45, fontSize: 20, bold: true });
    t(s, items.map((x, j) => ({ text: x, options: { bullet: { indent: 16 }, breakLine: j < items.length - 1, paraSpaceAfter: 9 } })), { x, y: 2.35, w: cw, h: 2.9, fontSize: 16, color: INK2 });
  });
  box(s, M, 5.4, CW, 1.3, { fill: SOFT, line: SOFT });
  t(s, [{ text: "Vietnam law  ", options: { bold: true, color: INK } }, { text: "Crypto is not legal tender in Vietnam, and selling shares of a car's income to the public is likely a securities offering. This is a prototype, not an offer or investment advice. A launch needs a licensed structure, with the rental company paid in VND.", options: { color: INK2 } }],
    { x: M + 0.3, y: 5.4, w: CW - 0.6, h: 1.3, fontSize: 15, valign: "middle" });
}

// 12. Next and ask
{
  const s = slide("Next: one real car with one rental company");
  const rows = [
    ["Pilot", "One car with one licensed rental company in Vietnam, rent reported monthly."],
    ["Operator bond", "Collateral that is cut when reported rent stays unpaid past a deadline."],
    ["Legal structure", "A vault company abroad, verified holders, VND on the operator's side."],
  ];
  if (ON_DISPATCH) rows.push(["Own L1", "Move RentalLog to the operator's own L1. Builder Hub's one-click launch failed three times for us."]);
  else rows.push(["Operator's L1", "Hand the L1's validator and allow-list to the rental company, and add a public explorer."]);
  rows.forEach(([h, b], i) => {
    const y = 1.75 + i * 0.85;
    t(s, h, { x: M, y, w: 3.0, h: 0.7, fontSize: 20, bold: true });
    t(s, b, { x: M + 3.1, y, w: CW - 3.1, h: 0.7, fontSize: 19, color: INK2 });
    rule(s, M, y + 0.72, CW);
  });
  const ay = 1.75 + rows.length * 0.85 + 0.3;
  s.addShape(pres.ShapeType.rect, { x: M, y: ay, w: 0.08, h: 0.9, fill: { color: RED }, line: { color: RED, width: 0 } });
  t(s, "We are looking for a rental company for a one-car pilot, and legal advice on the structure.", { x: M + 0.3, y: ay, w: CW - 0.3, h: 0.9, fontSize: 21, bold: true, valign: "middle" });
  t(s, [
    { text: "App  ", options: { bold: true, color: INK } }, { text: "kongou2002.github.io/rwa-fleet", options: { color: RED, hyperlink: { url: "https://kongou2002.github.io/rwa-fleet/" } } },
    { text: "     Code  ", options: { bold: true, color: INK } }, { text: "github.com/kongou2002/rwa-fleet", options: { color: RED, hyperlink: { url: "https://github.com/kongou2002/rwa-fleet" } } },
  ], { x: M, y: ay + 1.1, w: CW, h: 0.4, fontSize: 16 });
  foot(s, "Team Oicha · Team1 Vietnam UniHack 2026");
}

pres.writeFile({ fileName: path.join(ROOT, "docs", "FleetShares-pitch.pptx") }).then((f) => console.log("wrote", f));
