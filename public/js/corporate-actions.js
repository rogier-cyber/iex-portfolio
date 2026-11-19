// Corporate actions en dividendrechten: kleine, losse functies zodat ze zonder browser te testen zijn.
// Datums zijn milliseconden (UTC middernacht), net als in app.js.
const DAY = 864e5;

// Splitsingen uit EODHD: [{date:'2024-06-10', ratio:10}] waarbij ratio = nieuwe aandelen per oud aandeel
// (10 bij een 10-op-1-split, 0.1 bij een 1-op-10 reverse split).
export function parseSplits(rows, toMs) {
  return (rows || []).map((s) => ({ d: toMs(s.date), r: +s.ratio })).filter((s) => s.r > 0 && isFinite(s.r) && s.r !== 1).sort((a, b) => a.d - b.d);
}

// Hoeveel keer zo veel aandelen je nu hebt als op dag d (alle splits ná d samen).
export function splitFactorAfter(splits, d) {
  let f = 1;
  for (const s of splits || []) if (s.d > d) f *= s.r;
  return f;
}

// Vangnet voor koersreeksen waarin een split niet verwerkt is. Corrigeert een sprong alleen als er
// rond die week echt een split was én de sprong bij de splitverhouding past. Een echte koersval
// (bv. -70% in een week) blijft dus staan. sampleAt(i) = datum van het koerspunt i.
export function fixJumps(px, splits, sampleAt) {
  if (!px || !splits || !splits.length) return px;
  for (let i = px.length - 1; i > 0; i--) {
    const jump = px[i] / px[i - 1];
    if (!(jump < 0.4 || jump > 2.5)) continue;
    const t0 = sampleAt(i - 1) - 7 * DAY, t1 = sampleAt(i) + 7 * DAY;
    const s = splits.find((s) => s.d > t0 && s.d <= t1 && Math.abs(Math.log(jump * s.r)) < 0.3);
    if (!s) continue;
    for (let j = 0; j < i; j++) px[j] /= s.r;
  }
  return px;
}

// Dividend per aandeel omgerekend naar aandelen van nu (zelfde basis als de split-gecorrigeerde koersen
// en de aantallen in de portefeuille). Een ongecorrigeerd bedrag van vóór een split wordt gedeeld door
// de splitfactor; een bedrag dat de bron al corrigeerde blijft staan.
export function dividendPerShareNow(ev, splits) {
  return ev.adjusted ? ev.amount : ev.amount / splitFactorAfter(splits, ev.exd);
}

// Valutacode van een dividend: pence (GBX/GBp) en agorot (ILA) naar hoofdvaluta.
export function normCurrency(ccy, amount) {
  const c = (ccy || "").trim();
  if (c === "GBX" || c === "GBp") return { ccy: "GBP", amount: amount / 100 };
  if (c === "ILA") return { ccy: "ILS", amount: amount / 100 };
  return { ccy: c.toUpperCase() || null, amount };
}

// Recht op dividend: de positie aan het eind van de handelsdag vóór de ex-datum.
// Een aankoop op de ex-datum zelf telt niet mee, een verkoop op de ex-datum ook niet (je houdt het recht).
export function qtyEntitled(trades, ticker, exd) {
  let q = 0;
  for (const tx of trades) {
    if (tx.t !== ticker || tx.d >= exd) continue;
    if (tx.ty === "BUY") q += tx.q; else if (tx.ty === "SELL") q -= tx.q;
  }
  return q;
}
