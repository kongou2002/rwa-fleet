const pptxgen = require("pptxgenjs");
const path = require("path");
const IMG = (n) => path.join(__dirname, n + ".jpg");

const BG = "0F1513", TEXT = "F3F2EC", MUTED = "A3A9A4", DIM = "6F7773";
const YELLOW = "FFC42E", GREEN = "4FD6A3", CARD = "18211E", LINE = "2A3531";
const FONT = "Arial";
const W = 13.333, M = 0.7;
const RENT_RATIO = 1300 / 330;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "FleetShares";
pres.author = "Team Oicha";

function slide() {
  const s = pres.addSlide();
  s.background = { color: BG };
  return s;
}
function t(s, text, o) {
  s.addText(text, Object.assign({ fontFace: FONT, color: TEXT, margin: 0, isTextBox: true, valign: "top" }, o));
}
function title(s, text) {
  t(s, text, { x: M, y: 0.6, w: W - 2 * M, h: 0.75, fontSize: 36, bold: true });
}
function sub(s, text, y = 1.4) {
  t(s, text, { x: M, y, w: W - 2 * M, h: 0.5, fontSize: 18, color: MUTED });
}
function foot(s, text) {
  t(s, text, { x: M, y: 6.75, w: W - 2 * M, h: 0.35, fontSize: 12, color: DIM });
}
// "Verb. explanation" rows, like the reference deck.
function rows(s, items, x, y, w, gap = 0.95, size = 18) {
  items.forEach(([head, body], i) => {
    t(s, [
      { text: head + "  ", options: { bold: true, color: YELLOW } },
      { text: body, options: { color: TEXT } },
    ], { x, y: y + i * gap, w, h: gap - 0.1, fontSize: size });
  });
}
function stat(s, value, label, x, y, w, color = YELLOW, size = 72) {
  t(s, value, { x, y, w, h: 1.25, fontSize: size, bold: true, color, valign: "bottom" });
  t(s, label, { x, y: y + 1.35, w, h: 0.9, fontSize: 16, color: MUTED });
}
// A framed screenshot: the frame is w wide, the image sits inside with even padding.
function shot(s, name, x, y, w, ratio) {
  const P = 0.22, iw = w - 2 * P, ih = iw / ratio;
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h: ih + 2 * P, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  s.addImage({ path: IMG(name), x: x + P, y: y + P, w: iw, h: ih });
}
// One step of a chain diagram: tag pill, heading, body, with generous inner padding.
function step(s, x, y, w, h, tag, tagFill, tagColor, head, body) {
  const P = 0.35;
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  const tw = Math.min(w - 2 * P, 0.14 * tag.length + 0.35);
  s.addShape(pres.ShapeType.roundRect, { x: x + P, y: y + P, w: tw, h: 0.34, rectRadius: 0.06, fill: { color: tagFill }, line: { color: tagFill, width: 0 } });
  t(s, tag, { x: x + P, y: y + P, w: tw, h: 0.34, fontSize: 11, bold: true, color: tagColor, align: "center", valign: "middle", fontFace: "Courier New" });
  t(s, head, { x: x + P, y: y + P + 0.6, w: w - 2 * P, h: 0.4, fontSize: 17, bold: true });
  t(s, body, { x: x + P, y: y + P + 1.1, w: w - 2 * P, h: h - 2 * P - 1.1, fontSize: 14, color: MUTED });
}
function card(s, x, y, w, h, head, lines, tag) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  t(s, head, { x: x + 0.25, y: y + 0.25, w: w - 0.5, h: 0.4, fontSize: 18, bold: true });
  t(s, lines.map((l, i) => ({ text: l, options: { breakLine: i < lines.length - 1 } })), { x: x + 0.25, y: y + 0.8, w: w - 0.5, h: h - 1.5, fontSize: 14, color: MUTED, paraSpaceAfter: 6 });
  t(s, tag, { x: x + 0.25, y: y + h - 0.55, w: w - 0.5, h: 0.3, fontSize: 12, color: YELLOW, bold: true });
}

// 1. Title
{
  const s = slide();
  t(s, "Rental cars you can own a share of", { x: M, y: 1.7, w: 6.6, h: 2.6, fontSize: 50, bold: true });
  t(s, "kongou2002.github.io/rwa-fleet", { x: M, y: 4.45, w: 6.6, h: 0.45, fontSize: 20, color: YELLOW, bold: true });
  t(s, "Buy shares of one car with USDC. The contract pays the rental operator, splits every rent payment 90 / 10, and shows what the operator reported next to what it paid.", { x: M, y: 5.05, w: 6.2, h: 1.2, fontSize: 16, color: MUTED });
  shot(s, "vf8", 7.75, 1.55, 4.9, 1700 / 1257);
  foot(s, "FleetShares · Team Oicha · Team1 Vietnam UniHack 2026 · Live on Avalanche Fuji with an Avalanche L1 over ICM");
}

// 2. Problem
{
  const s = slide();
  title(s, "Only whole-car buyers get the income");
  t(s, "What a rental car earns", { x: M, y: 1.95, w: 5.4, h: 0.4, fontSize: 18, color: MUTED });
  t(s, "10 to 15%", { x: M, y: 2.4, w: 5.6, h: 1.3, fontSize: 80, bold: true, color: YELLOW, valign: "bottom" });
  t(s, "a year, by a rental operator's own estimate.", { x: M, y: 3.9, w: 5.2, h: 0.8, fontSize: 20, color: MUTED });
  t(s, "What it takes to get it", { x: 7.0, y: 1.95, w: 5.4, h: 0.4, fontSize: 18, color: MUTED });
  t(s, "1 car", { x: 7.0, y: 2.4, w: 5.7, h: 1.3, fontSize: 80, bold: true, valign: "bottom" });
  t(s, "The whole car, paid up front. Or a company you must trust with the cash, the fee and the books.", { x: 7.0, y: 3.9, w: 5.4, h: 1.2, fontSize: 20, color: MUTED });
  t(s, "Three parties who do not trust each other: investors, the rental operator and the company in the middle. Today the company holds the money and writes the report.", { x: M, y: 5.55, w: 11.6, h: 0.9, fontSize: 18 });
  foot(s, "The 10 to 15% figure is the operator's estimate, not a measured or promised return.");
}

// 3. Solution
{
  const s = slide();
  title(s, "One car, split into shares");
  rows(s, [
    ["Buy.", "Pick a car and a number of shares. Pay in USDC. The money waits in the contract, not with the company."],
    ["Fund.", "The transaction that sells the last share pays the rental operator. If the deadline passes first, every buyer takes the money back."],
    ["Earn.", "The operator pays rent in per car. 90% goes to shareholders by share, 10% to the manager. Collect any time, or sell your shares."],
  ], M, 1.75, 5.9, 1.45, 18);
  shot(s, "vf8", 7.2, 1.7, 5.4, 1700 / 1257);
  foot(s, "The live app: a VinFast VF 8 listed as 200 shares at 10 test USDC each.");
}

// 4. Architecture
{
  const s = slide();
  title(s, "How it is built");
  sub(s, "Money on the C-Chain. The operator's daily ledger on an Avalanche L1. ICM joins them.");
  const y = 2.2, h = 3.9, w = 2.82, g = 0.22;
  card(s, M, y, w, h, "FleetShares", ["One ERC-1155: a car is a token id, a unit is a share.", "Funding, refunds, rent split, claims, offer book."], "Fuji C-Chain");
  card(s, M + (w + g), y, w, h, "RentalLog", ["The operator logs every rental: one cheap transaction each.", "Anyone can close a period. The contract sends its own totals."], "Avalanche L1 (Dispatch)");
  card(s, M + 2 * (w + g), y, w, h, "IncomeMirror", ["Receives the totals over Teleporter.", "ledger(car) returns income reported, rent paid and the gap."], "Fuji C-Chain");
  card(s, M + 3 * (w + g), y, w, h, "Web app", ["Reads live state with no wallet.", "Buy, collect, offer and take from Core or MetaMask.", "Every row links to its transaction."], "Static site, no backend");
  foot(s, "Solidity 0.8.30, Foundry, OpenZeppelin, viem. 4 contracts, 17 tests.");
}

// 5. Custody
{
  const s = slide();
  title(s, "The manager never holds your money");
  stat(s, "0", "functions that let the manager move purchase money.", M, 1.9, 3.6);
  stat(s, "1 tx", "The sale of the last share sends the full amount to the operator.", 4.85, 1.9, 3.6, TEXT);
  stat(s, "100%", "back to every buyer if the car does not sell out by the deadline.", 9.0, 1.9, 3.6, GREEN);
  t(s, "On Fuji: the Mazda CX-5 sold 100 shares at 25 USDC. The buyer of the last 20 shares triggered the transfer of 2,500 USDC to the operator in the same transaction.", { x: M, y: 4.9, w: 11.8, h: 0.9, fontSize: 18 });
  foot(s, "Sell-out transaction 0x947ab73f…52798d on testnet.snowtrace.io");
}

// 6. Rent split
{
  const s = slide();
  title(s, "Every rent payment is split by the contract");
  stat(s, "90%", "to shareholders, in proportion to their shares.", M, 1.7, 3.2, GREEN);
  stat(s, "10%", "to the manager. A constant in the code that nobody can change.", 4.1, 1.7, 3.2, YELLOW);
  shot(s, "rent", 7.6, 2.05, 5.0, RENT_RATIO);
  rows(s, [
    ["Per share.", "Rent is booked to each share the moment it arrives. No snapshot dates."],
    ["Fair on resale.", "Rent earned before a sale stays with the seller. The buyer earns from then on."],
  ], M, 4.6, 11.8, 0.85, 18);
  foot(s, "Live figures: 350 USDC paid in rent on the CX-5, 315 to holders, 35 fee.");
}

// 7. ICM ledger
{
  const s = slide();
  title(s, "What the operator earned, next to what it paid");
  rows(s, [
    ["Log.", "Each rental is one transaction on the operator's Avalanche L1."],
    ["Report.", "Anyone closes the period. RentalLog sends its own totals to Fuji by ICM."],
    ["Mirror.", "IncomeMirror accepts it only from Teleporter, that L1 and that contract."],
    ["Compare.", "Holders see income reported, rent paid and the unpaid gap, per car."],
  ], M, 1.75, 6.0, 1.12, 18);
  shot(s, "ledger", 7.35, 1.7, 5.25, 1700 / 1124);
  foot(s, "The operator ledger panel in the live app, read from IncomeMirror on Fuji.");
}

// 8. Two chains
{
  const s = slide();
  title(s, "Two chains, joined by Avalanche ICM");
  const cw = 3.2, ch = 2.8, gap = (W - 2 * M - 3 * cw) / 2, y0 = 1.7;
  step(s, M, y0, cw, ch, "DISPATCH L1 · 779672", "F3F2EC", BG, "Rentals are logged", "Every rental of a car is written to RentalLog on the operator's Avalanche L1: days rented and income.");
  step(s, M + cw + gap, y0, cw, ch, "AVALANCHE ICM", YELLOW, BG, "Totals cross over", "At the end of a period the contract sends its own totals as an Interchain Message through Teleporter.");
  step(s, M + 2 * (cw + gap), y0, cw, ch, "FUJI C-CHAIN · 43113", "F3F2EC", BG, "Holders compare", "IncomeMirror stores the reported income next to the rent FleetShares received. Any gap shows on the car.");
  [["ICM message", M + cw], ["delivered", M + 2 * cw + gap]].forEach(([label, ax]) => {
    s.addShape(pres.ShapeType.line, { x: ax + 0.18, y: y0 + ch / 2, w: gap - 0.36, h: 0, line: { color: YELLOW, width: 1.5, dashType: "dash", endArrowType: "triangle" } });
    t(s, label, { x: ax, y: y0 + ch / 2 + 0.12, w: gap, h: 0.3, fontSize: 10, color: MUTED, align: "center", fontFace: "Courier New" });
  });
  [["350", "USDC reported on the L1", YELLOW], ["350", "USDC rent paid on Fuji", GREEN], ["0", "USDC reported but unpaid", TEXT]].forEach(([v, l, c], i) => {
    t(s, v, { x: M + i * (cw + gap), y: 4.8, w: cw, h: 0.9, fontSize: 54, bold: true, color: c, valign: "bottom" });
    t(s, l, { x: M + i * (cw + gap), y: 5.8, w: cw, h: 0.4, fontSize: 16, color: MUTED });
  });
  foot(s, "Period 1: reported on Dispatch 0x3cd79091…7588b6, delivered on Fuji 0x6d89cb71…b96831. The L1 here is Dispatch, Avalanche's public test L1.");
}

// 9. Resale
{
  const s = slide();
  title(s, "Shares can change hands");
  rows(s, [
    ["Offer.", "A holder posts shares at a price. They stay in the holder's wallet and keep earning."],
    ["Take.", "One transaction: USDC to the seller, shares to the buyer, or nothing at all."],
    ["Locked while funding.", "Shares cannot move until the car is fully funded, so refunds always add up."],
  ], M, 1.75, 5.9, 1.3, 18);
  shot(s, "offers", 7.2, 1.9, 5.4, 1700 / 510);
  t(s, "On Fuji: 10 CX-5 shares offered at 27 USDC, 6 of them taken by two buyers.", { x: 7.2, y: 4.1, w: 5.4, h: 0.8, fontSize: 16, color: MUTED });
  foot(s, "Offers do not escrow shares: an offer whose seller moved the shares cannot be taken.");
}

// 10. Enforced vs not
{
  const s = slide();
  title(s, "What the contract enforces, and what it cannot");
  t(s, "Enforced on chain", { x: M, y: 1.75, w: 5.6, h: 0.4, fontSize: 18, color: GREEN, bold: true });
  t(s, [
    "The manager cannot move purchase money.",
    "The operator is paid only at sell-out.",
    "A missed deadline refunds every buyer in full.",
    "The fee is 10% of rent, fixed in the code.",
    "An offer settles in one transaction or not at all.",
  ].map((x, i, a) => ({ text: x, options: { bullet: true, breakLine: i < a.length - 1 } })), { x: M, y: 2.3, w: 5.6, h: 3.4, fontSize: 18, paraSpaceAfter: 12 });
  t(s, "Not enforced", { x: 7.0, y: 1.75, w: 5.6, h: 0.4, fontSize: 18, color: YELLOW, bold: true });
  t(s, [
    "The chain cannot see the car or its real income.",
    "An operator that stops paying is not forced to pay. There is no collateral yet.",
    "The ledger shows a gap only for rentals the operator logged.",
    "The share is not a legal title to the car.",
  ].map((x, i, a) => ({ text: x, options: { bullet: true, breakLine: i < a.length - 1 } })), { x: 7.0, y: 2.3, w: 5.6, h: 3.4, fontSize: 18, color: MUTED, paraSpaceAfter: 12 });
  foot(s, "Testnet prototype, not audited. Selling income shares to the public is likely a regulated offering in Vietnam; this is not an offer.");
}

// 11. Proof
{
  const s = slide();
  title(s, "Running live on testnet");
  stat(s, "4", "contracts on 2 chains, FleetShares verified on Snowtrace", M, 1.6, 3.3, YELLOW, 60);
  stat(s, "17", "Foundry tests: funding, refunds, rent accounting, offers, ICM source checks", M, 3.95, 3.3, TEXT, 60);
  shot(s, "activity", 4.6, 1.75, 8.0, 1700 / 811);
  foot(s, "FleetShares 0x75F02c6F7E44b26637E4396170BE1B65E67dA2B1 on Fuji · RentalLog 0x0A3dDE751a009ab4454a2E244a76574F442f8988 on Dispatch");
}

// 12. Business model
{
  const s = slide();
  title(s, "Business model");
  stat(s, "10%", "of every rent payment", M, 1.9, 3.6);
  stat(s, "0", "investor money held by us", 4.85, 1.9, 3.6, TEXT);
  stat(s, "1", "fee, visible to everyone", 9.0, 1.9, 3.6, TEXT);
  t(s, "Taken by the contract when rent arrives. We earn only when shareholders earn.", { x: M, y: 4.55, w: 3.6, h: 1.4, fontSize: 16, color: MUTED });
  t(s, "Purchase money goes from the contract to the operator. We list cars and check paperwork.", { x: 4.85, y: 4.55, w: 3.6, h: 1.4, fontSize: 16, color: MUTED });
  t(s, "No listing fee, no spread on resale, no hidden cut. The rate is a constant in the code.", { x: 9.0, y: 4.55, w: 3.6, h: 1.4, fontSize: 16, color: MUTED });
}

// 13. Next
{
  const s = slide();
  title(s, "What comes next");
  rows(s, [
    ["Our own L1.", "A permissioned L1 where only licensed operators can write rentals. Builder Hub's one-click launch failed three times at the same step, so this demo uses Dispatch."],
    ["Operator bond.", "Collateral that is cut when reported income stays unpaid past a deadline."],
    ["Holder checks.", "KYC-gated transfers and a legal wrapper that ties a share to the rental contract."],
    ["Real cars.", "A pilot with one rental operator, starting with a single vehicle."],
  ], M, 1.75, 11.8, 1.15, 18);
}

// 14. Close
{
  const s = slide();
  t(s, "FleetShares", { x: M, y: 2.2, w: W - 2 * M, h: 1.1, fontSize: 60, bold: true });
  t(s, "kongou2002.github.io/rwa-fleet", { x: M, y: 3.5, w: W - 2 * M, h: 0.5, fontSize: 24, color: YELLOW, bold: true });
  t(s, "github.com/kongou2002/rwa-fleet", { x: M, y: 4.15, w: W - 2 * M, h: 0.5, fontSize: 20, color: MUTED });
  foot(s, "Team Oicha · Team1 Vietnam UniHack 2026 · Car photos: ShangTW and Alexander-93, CC BY-SA 4.0, Wikimedia Commons");
}

pres.writeFile({ fileName: path.join(__dirname, "..", "FleetShares-pitch.pptx") }).then((f) => console.log("wrote", f));
