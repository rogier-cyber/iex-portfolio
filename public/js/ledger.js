// Grootboek: de rekenkern voor brokerdata.
// Elke gebeurtenis is een boeking die nooit wordt overschreven; posities, kas, resultaten en
// controles worden er steeds opnieuw uit berekend (replay). Werkt in de browser en in Node.
//
// Basisvaluta is EUR. Datums zijn 'JJJJ-MM-DD'. Bedragen staan in hun eigen valuta (ccy);
// `fx` is het aantal euro per 1 eenheid van die valuta zoals de broker het rekende.
//
// Boekingstypes (velden naast type, date, account, src):
//   DEPOSIT / WITHDRAWAL   amount, ccy, fx
//   BUY / SELL             inst, qty, price, ccy, fx, fee?, feeCcy?, cash?{amount, ccy}  (cash = wat de broker echt afschreef/bijschreef)
//   DIVIDEND               inst, gross, tax, ccy, fx, exDate, payDate?, kind (regular|special|capital_return|capital_gain|interest), taxCountry?
//   DIVIDEND_REVERSAL      inst, gross, tax, ccy, fx, exDate   (draait een dividend terug)
//   TAX_REFUND             inst?, amount, ccy, fx
//   STOCK_DIVIDEND         inst, qty                          (nieuwe aandelen, kostprijs 0)
//   SPLIT                  inst, ratio (nieuw per oud), cashInLieu?, ccy?, fx?
//   SPINOFF                inst, newInst, ratio (nieuw per moederaandeel), costFraction (deel van de kostprijs naar de dochter)
//   MERGER                 inst, newInst?, ratio?, cashPerShare?, ccy?, fx?, cashCostFraction?
//   ISIN_CHANGE            inst, newInst
//   TRANSFER_OUT           inst, qty, to?
//   TRANSFER_IN            inst, qty, cost?(EUR totaal), costLocal?, from?, price?, ccy?, fx?
//   FX                     fromAmount, fromCcy, toAmount, toCcy, fromFx?, toFx?, fee?, feeCcy?
//   FEE / INTEREST         amount, ccy, fx, category?
//
// Een DRIP (herbelegd dividend) is gewoon een DIVIDEND plus een BUY die met dat geld betaald wordt:
// er komt geen storting bij, dus het rendement wordt niet opgeblazen.

const CA = new Set(["SPLIT", "ISIN_CHANGE", "SPINOFF", "MERGER", "STOCK_DIVIDEND"]);
// Volgorde binnen een dag: eerst corporate actions (een koop op de splitdag is al tegen de nieuwe koers),
// dan geld erin, dan kopen, verkopen, uitkeringen, en als laatste geld eruit.
const RANK = { SPLIT: 0, ISIN_CHANGE: 0, SPINOFF: 1, MERGER: 1, STOCK_DIVIDEND: 1, DEPOSIT: 2, TRANSFER_IN: 2, FX: 3, BUY: 4, SELL: 5, TRANSFER_OUT: 5,
  DIVIDEND: 6, DIVIDEND_REVERSAL: 7, TAX_REFUND: 7, INTEREST: 7, FEE: 8, WITHDRAWAL: 9 };
const EPS = 1e-6;
const r2 = (v) => Math.round(v * 100) / 100;

// Verdragstarieven voor een inwoner van Nederland (deel dat verrekenbaar is) en het standaardtarief aan de bron.
export const TREATY = {
  NL: { std: 0.15, treaty: 0.15 }, US: { std: 0.30, treaty: 0.15, note: "15% alleen met een W-8BEN bij je broker" },
  CH: { std: 0.35, treaty: 0.15 }, DE: { std: 0.26375, treaty: 0.15 }, FR: { std: 0.25, treaty: 0.128 },
  BE: { std: 0.30, treaty: 0.15 }, DK: { std: 0.27, treaty: 0.15 }, GB: { std: 0, treaty: 0 }, IE: { std: 0, treaty: 0 },
};

/* ---------- invoer schoonmaken ---------- */

export function entryKey(e) {
  if (e.src && e.src.extId) return `${e.src.broker || ""}|${e.src.extId}`;
  return [e.type, e.date, e.account || "", e.inst || "", e.qty ?? "", e.price ?? "", e.gross ?? e.amount ?? "", e.ccy || ""].join("|");
}

// Ontdubbelen: een boeking met hetzelfde externe id (opnieuw geïmporteerd bestand) valt weg.
// Twee boekingen die er zonder id hetzelfde uitzien kunnen echt zijn (twee gelijke orders op één dag):
// die blijven staan en komen als "mogelijk dubbel" in de controles.
export function dedupe(entries) {
  const seen = new Map(), out = [], dropped = [], suspects = [];
  for (const e of entries) {
    const k = entryKey(e);
    if (seen.has(k)) {
      if (e.src && e.src.extId) { dropped.push(e); continue; }
      suspects.push([seen.get(k), e]);
    } else seen.set(k, e);
    out.push(e);
  }
  return { entries: out, dropped, suspects };
}

export function sortEntries(entries) {
  return entries.map((e, i) => [e, i]).sort((a, b) => (a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : (RANK[a[0].type] ?? 5) - (RANK[b[0].type] ?? 5) || a[1] - b[1])).map((x) => x[0]);
}

/* ---------- replay ---------- */

function newPos(inst) {
  return { inst, lots: [], qty: 0, realized: { price: 0, fx: 0, total: 0 }, div: { gross: 0, tax: 0, net: 0, n: 0 }, fees: 0, costUnknown: false, aliases: [inst], firstDate: null, closedDate: null };
}

export function replay(input, opts = {}) {
  const method = opts.method || "avg";
  const { entries, dropped, suspects } = dedupe(input);
  const pos = {}, cash = {}, flows = [], warnings = [], pendingOut = {}, applied = [];
  const P = (k) => (pos[k] = pos[k] || newPos(k));
  const W = (level, code, e, text, extra = {}) => warnings.push({ level, code, date: e && e.date, inst: e && e.inst, text, ...extra });
  const C = (acc, ccy) => { const k = `${acc || "-"}|${ccy}`; return (cash[k] = cash[k] || { account: acc || "-", ccy, amount: 0, costEUR: 0, fxRealized: 0 }); };
  const credit = (acc, ccy, amt, fx) => { const c = C(acc, ccy); c.amount += amt; c.costEUR += amt * (ccy === "EUR" ? 1 : fx || 0); return c; };
  const debit = (acc, ccy, amt, fx) => {
    const c = C(acc, ccy);
    if (ccy !== "EUR" && c.amount > EPS) { const avg = c.costEUR / c.amount, take = Math.min(amt, c.amount); c.fxRealized += take * ((fx || avg) - avg); c.costEUR -= take * avg; if (amt > take) c.costEUR -= (amt - take) * (fx || avg); }
    else c.costEUR -= amt * (ccy === "EUR" ? 1 : fx || 0);
    c.amount -= amt; return c;
  };
  for (const [a, b] of suspects) W("warn", "duplicate", b, `Twee gelijke boekingen (${b.type}) op ${b.date}. Klopt dat, of is er iets dubbel geïmporteerd?`, { pair: [a, b] });

  const removeLots = (p, qty) => {
    // geeft de weggehaalde stukken terug, met kostprijs in euro en lokale valuta
    const out = [];
    if (method === "fifo") {
      let left = qty;
      while (left > EPS && p.lots.length) {
        const l = p.lots[0], take = Math.min(left, l.qty), f = take / l.qty;
        const cE = l.costEUR * f, cL = l.costLocal * f;
        out.push({ qty: take, costEUR: cE, costLocal: cL, date: l.date, unknown: l.unknown });
        l.qty -= take; l.costEUR -= cE; l.costLocal -= cL;
        if (l.qty <= EPS) p.lots.shift();
        left -= take;
      }
    } else {
      const tot = p.lots.reduce((a, l) => a + l.qty, 0) || 1, f = Math.min(1, qty / tot);
      for (const l of p.lots) { out.push({ qty: l.qty * f, costEUR: l.costEUR * f, costLocal: l.costLocal * f, date: l.date, unknown: l.unknown }); l.qty -= l.qty * f; l.costEUR -= l.costEUR * f; l.costLocal -= l.costLocal * f; }
      p.lots = p.lots.filter((l) => l.qty > EPS);
    }
    p.qty = p.lots.reduce((a, l) => a + l.qty, 0);
    if (p.qty < 1e-4) { p.qty = 0; p.lots = []; } // restfracties als 0,00000001 aandeel weg
    return out;
  };
  const realize = (p, taken, qty, price, fx, proceedsEUR) => {
    const cE = taken.reduce((a, t) => a + t.costEUR, 0), cL = taken.reduce((a, t) => a + t.costLocal, 0);
    const avgFx = cL > EPS ? cE / cL : fx;
    const total = proceedsEUR - cE, pricePart = (qty * price - cL) * avgFx;
    p.realized.total += total; p.realized.price += pricePart; p.realized.fx += total - pricePart;
    return { total, price: pricePart, fx: total - pricePart, cost: cE };
  };

  for (const e of sortEntries(entries)) {
    const fx = e.ccy === "EUR" || !e.ccy ? 1 : e.fx;
    switch (e.type) {
      case "DEPOSIT": credit(e.account, e.ccy, e.amount, fx); flows.push({ date: e.date, amount: e.amount * fx }); break;
      case "WITHDRAWAL": debit(e.account, e.ccy, e.amount, fx); flows.push({ date: e.date, amount: -e.amount * fx }); break;
      case "BUY": {
        const p = P(e.inst), fee = e.fee || 0, feeFx = (e.feeCcy || e.ccy) === "EUR" ? 1 : fx;
        p.lots.push({ qty: e.qty, costEUR: e.qty * e.price * fx + fee * feeFx, costLocal: e.qty * e.price + (feeFx === fx ? fee : (fee * feeFx) / fx), date: e.date });
        p.qty += e.qty; p.fees += fee * feeFx; p.firstDate = p.firstDate || e.date; p.closedDate = null;
        const c = e.cash || { amount: e.qty * e.price + ((e.feeCcy || e.ccy) === e.ccy ? fee : 0), ccy: e.ccy };
        debit(e.account, c.ccy, c.amount, c.ccy === e.ccy ? fx : c.ccy === "EUR" ? 1 : undefined);
        if ((e.feeCcy || e.ccy) !== c.ccy) debit(e.account, e.feeCcy, fee, feeFx);
        break;
      }
      case "SELL": {
        const p = P(e.inst), fee = e.fee || 0, feeFx = (e.feeCcy || e.ccy) === "EUR" ? 1 : fx;
        if (e.qty > p.qty + EPS) W("error", "oversell", e, `Verkoop van ${e.qty} stuks terwijl je er ${r2(p.qty)} hebt. Mist er een aankoop, overboeking of split?`);
        const q = Math.min(e.qty, p.qty);
        const taken = removeLots(p, q);
        if (taken.some((t) => t.unknown)) p.costUnknown = true;
        realize(p, taken, q, e.price, fx, q * e.price * fx - fee * feeFx);
        p.fees += fee * feeFx;
        const c = e.cash || { amount: e.qty * e.price - ((e.feeCcy || e.ccy) === e.ccy ? fee : 0), ccy: e.ccy };
        credit(e.account, c.ccy, c.amount, c.ccy === e.ccy ? fx : 1);
        if ((e.feeCcy || e.ccy) !== c.ccy) debit(e.account, e.feeCcy, fee, feeFx);
        if (p.qty === 0) p.closedDate = e.date;
        break;
      }
      case "DIVIDEND": case "DIVIDEND_REVERSAL": {
        const s = e.type === "DIVIDEND" ? 1 : -1, p = P(e.inst), gross = e.gross ?? (e.net + (e.tax || 0)), tax = e.tax || 0;
        if (e.kind === "capital_return" && s > 0) {
          // kapitaalterugbetaling: geen inkomen, verlaagt de kostprijs
          const tot = p.lots.reduce((a, l) => a + l.qty, 0) || 1;
          for (const l of p.lots) { const part = gross * (l.qty / tot); l.costLocal -= part; l.costEUR -= part * fx; }
        } else {
          p.div.gross += s * gross * fx; p.div.tax += s * tax * fx; p.div.net += s * (gross - tax) * fx; p.div.n += s;
        }
        (s > 0 ? credit : debit)(e.account, e.cashCcy || e.ccy, gross - tax, fx);
        if (s > 0) {
          const rate = gross > 0 ? tax / gross : 0, tr = TREATY[e.taxCountry];
          if (rate > 0.5) W("warn", "tax-high", e, `Bronbelasting van ${Math.round(rate * 100)}% op dit dividend. Dat is ongebruikelijk hoog; controleer de boeking.`);
          else if (tr && rate > tr.treaty + 0.005) W("info", "tax-reclaim", e, `${Math.round(rate * 100)}% ingehouden, het verdragstarief is ${Math.round(tr.treaty * 1000) / 10}%. ${tr.note || "Het verschil kun je terugvragen."}`, { reclaim: (rate - tr.treaty) * gross * fx });
        }
        break;
      }
      case "TAX_REFUND": credit(e.account, e.ccy, e.amount, fx); if (e.inst) { const p = P(e.inst); p.div.tax -= e.amount * fx; p.div.net += e.amount * fx; } break;
      case "FEE": debit(e.account, e.ccy, e.amount, fx); if (e.inst) P(e.inst).fees += e.amount * fx; break;
      case "INTEREST": credit(e.account, e.ccy, e.amount, fx); break;
      case "STOCK_DIVIDEND": { const p = P(e.inst); p.lots.push({ qty: e.qty, costEUR: 0, costLocal: 0, date: e.date }); p.qty += e.qty; applied.push(e); break; }
      case "SPLIT": {
        const p = P(e.inst);
        for (const l of p.lots) l.qty *= e.ratio;
        p.qty *= e.ratio;
        if (e.cashInLieu) {
          // de broker verkoopt de restfractie en betaalt die uit: dat is een kleine verkoop, geen dividend
          const frac = p.qty - Math.floor(p.qty + EPS), cfx = e.ccy === "EUR" || !e.ccy ? 1 : e.fx;
          if (frac > EPS) { const taken = removeLots(p, frac); realize(p, taken, frac, e.cashInLieu / frac, cfx, e.cashInLieu * cfx); }
          credit(e.account, e.ccy || "EUR", e.cashInLieu, cfx);
        }
        applied.push(e); break;
      }
      case "ISIN_CHANGE": {
        const p = P(e.inst), n = P(e.newInst);
        n.lots.push(...p.lots); n.qty += p.qty; n.realized.total += p.realized.total; n.realized.price += p.realized.price; n.realized.fx += p.realized.fx;
        n.div.gross += p.div.gross; n.div.tax += p.div.tax; n.div.net += p.div.net; n.div.n += p.div.n; n.fees += p.fees;
        n.aliases = [...new Set([...n.aliases, ...p.aliases])]; n.firstDate = n.firstDate || p.firstDate;
        delete pos[e.inst]; applied.push(e); break;
      }
      case "SPINOFF": {
        const p = P(e.inst), n = P(e.newInst), f = e.costFraction ?? 0;
        if (e.costFraction == null) W("warn", "spinoff-cost", e, `Spin-off zonder verdeling van de kostprijs. De dochter staat nu op kostprijs 0; vul de verdeling in (staat in het prospectus).`);
        for (const l of p.lots) {
          n.lots.push({ qty: l.qty * e.ratio, costEUR: l.costEUR * f, costLocal: l.costLocal * f, date: l.date });
          l.costEUR *= 1 - f; l.costLocal *= 1 - f;
        }
        n.qty += p.qty * e.ratio; n.firstDate = n.firstDate || e.date; applied.push(e); break;
      }
      case "MERGER": {
        const p = P(e.inst), q = p.qty, cfx = e.ccy === "EUR" || !e.ccy ? 1 : e.fx;
        const cashTot = (e.cashPerShare || 0) * q;
        let fCash = e.cashCostFraction ?? (e.newInst ? 0 : 1);
        if (e.newInst && e.cashPerShare && e.cashCostFraction == null) W("warn", "merger-cost", e, "Fusie met aandelen én contanten zonder verdeling van de kostprijs. Al het geld is als winst geboekt.");
        if (cashTot) {
          const taken = p.lots.map((l) => ({ qty: q ? l.qty : 0, costEUR: l.costEUR * fCash, costLocal: l.costLocal * fCash }));
          for (const l of p.lots) { l.costEUR *= 1 - fCash; l.costLocal *= 1 - fCash; }
          realize(p, taken, q, e.cashPerShare, cfx, cashTot * cfx);
          credit(e.account, e.ccy || "EUR", cashTot, cfx);
        }
        if (e.newInst) {
          const n = P(e.newInst);
          for (const l of p.lots) n.lots.push({ qty: l.qty * (e.ratio || 0), costEUR: l.costEUR, costLocal: l.costLocal, date: l.date });
          n.qty += q * (e.ratio || 0); n.firstDate = n.firstDate || p.firstDate;
          n.realized.total += p.realized.total; n.realized.price += p.realized.price; n.realized.fx += p.realized.fx;
        }
        p.lots = []; p.qty = 0; p.closedDate = e.date; applied.push(e); break;
      }
      case "TRANSFER_OUT": {
        const p = P(e.inst);
        if (e.qty > p.qty + EPS) W("error", "oversell", e, `Overboeking van ${e.qty} stuks terwijl je er ${r2(p.qty)} hebt.`);
        const taken = removeLots(p, Math.min(e.qty, p.qty));
        (pendingOut[e.inst] = pendingOut[e.inst] || []).push({ e, taken });
        if (p.qty === 0) p.closedDate = e.date;
        break;
      }
      case "TRANSFER_IN": {
        const p = P(e.inst), queue = pendingOut[e.inst] || [];
        const match = queue.findIndex((o) => Math.abs(o.e.qty - e.qty) < EPS);
        if (match >= 0) {
          // eigen overboeking tussen brokers: kostprijs en aankoopdatum lopen door, geen storting
          const [o] = queue.splice(match, 1);
          p.lots.push(...o.taken.map((t) => ({ ...t })));
        } else if (e.cost != null) {
          p.lots.push({ qty: e.qty, costEUR: e.cost, costLocal: e.costLocal ?? e.cost / (e.fx || 1), date: e.origDate || e.date });
          flows.push({ date: e.date, amount: (e.price ? e.qty * e.price * (e.fx || 1) : e.cost), transfer: true });
        } else {
          const v = e.price ? e.qty * e.price * (e.ccy === "EUR" || !e.ccy ? 1 : e.fx) : 0;
          p.lots.push({ qty: e.qty, costEUR: v, costLocal: e.price ? e.qty * e.price : 0, date: e.date, unknown: true });
          p.costUnknown = true; flows.push({ date: e.date, amount: v, transfer: true });
          W("warn", "transfer-cost", e, `Inkomende overboeking zonder oorspronkelijke aankoopkoers. We rekenen met de koers van ${e.date}; vul de echte kostprijs in voor een juist rendement.`);
        }
        p.qty = p.lots.reduce((a, l) => a + l.qty, 0); p.firstDate = p.firstDate || e.date; p.closedDate = null;
        break;
      }
      case "FX": {
        const fFx = e.fromCcy === "EUR" ? 1 : e.fromFx ?? (e.toCcy === "EUR" ? e.toAmount / e.fromAmount : undefined);
        const tFx = e.toCcy === "EUR" ? 1 : e.toFx ?? (e.fromCcy === "EUR" ? e.fromAmount / e.toAmount : undefined);
        debit(e.account, e.fromCcy, e.fromAmount, fFx);
        credit(e.account, e.toCcy, e.toAmount, tFx ?? (fFx * e.fromAmount) / e.toAmount);
        if (e.fee) debit(e.account, e.feeCcy || e.fromCcy, e.fee, (e.feeCcy || e.fromCcy) === "EUR" ? 1 : fFx);
        break;
      }
      default: W("warn", "unknown-type", e, `Onbekend boekingstype ${e.type}.`);
    }
  }
  for (const [inst, q] of Object.entries(pendingOut)) for (const o of q) W("info", "transfer-open", o.e, `Overboeking van ${o.e.qty} ${inst} is nog niet bij een andere broker binnengekomen.`);
  for (const p of Object.values(pos)) { p.costEUR = p.lots.reduce((a, l) => a + l.costEUR, 0); p.costLocal = p.lots.reduce((a, l) => a + l.costLocal, 0); }
  for (const c of Object.values(cash)) if (Math.abs(c.amount) < 0.005) c.amount = 0;
  return { positions: pos, cash, flows, warnings, dropped, suspects, applied, method };
}

/* ---------- controles met marktdata ---------- */

// Positie aan het eind van de dag vóór `date` (recht op dividend), in aantallen zoals de broker ze toen had.
export function qtyBefore(entries, inst, date) {
  return replay(entries.filter((e) => e.date < date)).positions[inst]?.qty || 0;
}

// market: { close(inst, date) → koers of null, dividends: {inst: [{exDate, payDate, amount, ccy}]} (ongecorrigeerd), splits: {inst: [{date, ratio}]} }
export function checkAgainstMarket(entries, market, opts = {}) {
  const out = [], W = (level, code, e, text, extra = {}) => out.push({ level, code, date: e.date, inst: e.inst, text, ...extra });
  const today = opts.today || "9999-12-31";
  for (const e of entries) {
    if ((e.type === "BUY" || e.type === "SELL") && market.close) {
      const c = market.close(e.inst, e.date);
      if (c > 0 && e.price > 0) {
        const r = e.price / c;
        if (Math.abs(r - 100) / 100 < 0.1 || Math.abs(r - 0.01) / 0.01 < 0.1) W("error", "price-unit", e, `Prijs ${e.price} is ongeveer 100 keer de slotkoers (${c}). Pence en pond verwisseld?`);
        else {
          const sp = (market.splits?.[e.inst] || []).find((s) => Math.abs(Math.log(r / s.ratio)) < 0.1 || Math.abs(Math.log(r * s.ratio)) < 0.1);
          if (sp) W("error", "price-split", e, `Prijs wijkt een factor ${sp.ratio} af van de slotkoers. Is de split van ${sp.date} verwerkt?`);
          else if (Math.abs(r - 1) > 0.25) W("warn", "price-far", e, `Prijs ${e.price} wijkt ${Math.round((r - 1) * 100)}% af van de slotkoers (${c}) van die dag.`);
        }
      }
    }
  }
  const booked = entries.filter((e) => e.type === "DIVIDEND");
  const reversals = entries.filter((e) => e.type === "DIVIDEND_REVERSAL");
  const insts = [...new Set(entries.filter((e) => e.inst).map((e) => e.inst))];
  for (const inst of insts) {
    for (const d of market.dividends?.[inst] || []) {
      if ((d.payDate || d.exDate) > today) continue;
      const q = replay(entries.filter((e) => e.date < d.exDate)).positions[inst]?.qty || 0;
      const got = booked.filter((b) => b.inst === inst && (b.exDate === d.exDate || Math.abs(Date.parse(b.payDate || b.date) - Date.parse(d.payDate || d.exDate)) < 20 * 864e5));
      const rev = reversals.filter((b) => b.inst === inst && b.exDate === d.exDate).length;
      if (q > 1e-6 && got.length - rev <= 0) W("warn", "div-missing", { date: d.payDate || d.exDate, inst }, `Dividend van ${d.amount} ${d.ccy || ""} per aandeel (ex-datum ${d.exDate}) niet ontvangen, terwijl je ${r2(q)} stuks had. Verwacht bruto ${r2(q * d.amount)} ${d.ccy || ""}.`, { expected: q * d.amount, ccy: d.ccy });
      if (q > 1e-6 && got.length - rev === 1) {
        const g = got[0], exp = q * d.amount;
        if (exp > 0 && Math.abs(g.gross - exp) / exp > 0.05) W("info", "div-amount", g, `Ontvangen bruto ${r2(g.gross)} ${g.ccy}, verwacht ${r2(exp)} (${r2(q)} × ${d.amount}).`);
      }
      if (got.length - rev > 1) W("warn", "div-double", got[1], `Dividend met ex-datum ${d.exDate} is ${got.length - rev} keer geboekt.`);
    }
    for (const b of booked.filter((x) => x.inst === inst && x.exDate)) {
      const q = replay(entries.filter((e) => e.date < b.exDate)).positions[inst]?.qty || 0;
      if (q <= 1e-6) W("warn", "div-no-position", b, `Dividend ontvangen zonder positie op de dag vóór de ex-datum (${b.exDate}).`);
    }
    for (const s of market.splits?.[inst] || []) {
      if (s.date > today) continue;
      const held = replay(entries.filter((e) => e.date < s.date)).positions[inst]?.qty || 0;
      const done = entries.some((e) => e.type === "SPLIT" && e.inst === inst && Math.abs(Date.parse(e.date) - Date.parse(s.date)) < 10 * 864e5);
      if (held > 1e-6 && !done) W("error", "split-missing", { date: s.date, inst }, `Split ${s.ratio}:1 van ${s.date} staat niet in je boekingen, terwijl je ${r2(held)} stuks had.`, { ratio: s.ratio });
    }
  }
  return out;
}

// Aansluiting met het overzicht van de broker: aantallen per positie en kas per valuta.
// statement: { positions: {inst: qty}, cash: {ccy: amount} } per account.
export function reconcile(state, statement, account) {
  const rows = [];
  const ours = {};
  for (const p of Object.values(state.positions)) if (p.qty > 1e-6) ours[p.inst] = p.qty;
  const keys = new Set([...Object.keys(ours), ...Object.keys(statement.positions || {})]);
  for (const k of keys) {
    const a = ours[k] || 0, b = statement.positions?.[k] || 0;
    rows.push({ kind: "positie", key: k, ours: a, broker: b, ok: Math.abs(a - b) < 1e-4 });
  }
  const cash = {};
  for (const c of Object.values(state.cash)) if (!account || c.account === account) cash[c.ccy] = (cash[c.ccy] || 0) + c.amount;
  for (const k of new Set([...Object.keys(cash), ...Object.keys(statement.cash || {})])) {
    const a = cash[k] || 0, b = statement.cash?.[k] || 0;
    rows.push({ kind: "kas", key: k, ours: r2(a), broker: r2(b), ok: Math.abs(a - b) < 0.015 });
  }
  return { rows, ok: rows.every((r) => r.ok) };
}

// Uitleg in gewone taal bij een corporate action
export function explain(e, name = (k) => k) {
  const n = name(e.inst), m = e.newInst ? name(e.newInst) : "";
  switch (e.type) {
    case "SPLIT": return e.ratio >= 1
      ? `${n} splitste ${e.ratio} op 1: voor elk aandeel kreeg je er ${e.ratio}. Je kostprijs bleef gelijk, de prijs per aandeel werd ${e.ratio} keer zo laag.${e.cashInLieu ? ` Een restfractie is uitbetaald (${r2(e.cashInLieu)} ${e.ccy || "EUR"}).` : ""}`
      : `${n} voegde ${Math.round(1 / e.ratio)} aandelen samen tot 1 (reverse split). Je hebt minder stukken, maar ze zijn evenveel waard samen.${e.cashInLieu ? ` Wat niet deelbaar was, is uitbetaald (${r2(e.cashInLieu)} ${e.ccy || "EUR"}).` : ""}`;
    case "SPINOFF": return `${n} splitste ${m} af: per aandeel ${n} kreeg je ${e.ratio} ${m}. ${e.costFraction != null ? `${Math.round(e.costFraction * 1000) / 10}% van je kostprijs is naar ${m} gegaan, de rest bleef bij ${n}.` : "De verdeling van de kostprijs ontbreekt nog."} Je aankoopdatum loopt door.`;
    case "MERGER": return e.newInst
      ? `${n} is opgegaan in ${m}: per aandeel kreeg je ${e.ratio} ${m}${e.cashPerShare ? ` en ${e.cashPerShare} ${e.ccy || "EUR"} contant` : ""}.`
      : `${n} is overgenomen voor ${e.cashPerShare} ${e.ccy || "EUR"} per aandeel. Je positie is gesloten en het geld staat op je rekening.`;
    case "ISIN_CHANGE": return `${n} kreeg een nieuwe code (${e.newInst}). Het is hetzelfde aandeel; je positie loopt door.`;
    case "STOCK_DIVIDEND": return `${n} keerde dividend uit in aandelen: je kreeg ${e.qty} nieuwe stukken, zonder dat je ervoor betaalde.`;
    default: return "";
  }
}
