// Echte marktdata via EODHD (koersen, dividend, indices, valuta, nieuws, kerncijfers)
// aangevuld met Financial Modeling Prep (kerncijfers, koersdoelen, analistenoordelen).
// Wordt gebruikt door server.js (/api/market) en scripts/fetch-market-data.mjs.
// Zonder EODHD_API_KEY geeft loadMarketData() null en draait de app op voorbeelddata.
// FMP_API_KEY is optioneel (zelfde naam als in guruwatch).

const BASE = "https://eodhd.com/api";
const FROM = "2018-12-31";

// Ticker in de app → EODHD-symbool
export const SYMBOLS = {
  ASML: "ASML.AS", ASM: "ASM.AS", BESI: "BESI.AS", ADYEN: "ADYEN.AS", SHELL: "SHELL.AS",
  INGA: "INGA.AS", NN: "NN.AS", UNA: "UNA.AS", AD: "AD.AS", HEIA: "HEIA.AS",
  WKL: "WKL.AS", PRX: "PRX.AS", MSFT: "MSFT.US", KPN: "KPN.AS", PHIA: "PHIA.AS",
  // buitenland
  SAP: "SAP.XETRA", MC: "MC.PA", NESN: "NESN.SW", NOVO: "NOVO-B.CO", NVDA: "NVDA.US",
  // ETF's
  IWDA: "IWDA.AS", VWRL: "VWRL.AS", EMIM: "EMIM.AS",
};
const ETFS = new Set(["IWDA", "VWRL", "EMIM"]);
// extra valuta naast de dollar (EODHD: vreemde valuta per euro)
const FXS = { CHF: "EURCHF.FOREX", DKK: "EURDKK.FOREX" };
// Benchmarks: koersindices + een MSCI World-ETF in euro (inclusief herbelegd dividend)
export const BENCHMARKS = {
  AEX: { symbol: "AEX.INDX", name: "AEX", ccy: "EUR" },
  AMX: { symbol: "AMX.INDX", name: "AMX (midkap)", ccy: "EUR" },
  MSCIW: { symbol: "IWDA.AS", name: "MSCI World (IWDA)", ccy: "EUR" },
  SPX: { symbol: "GSPC.INDX", name: "S&P 500", ccy: "USD" },
  SX5E: { symbol: "STOXX50E.INDX", name: "Euro Stoxx 50", ccy: "EUR" },
};
const FX = "EURUSD.FOREX"; // dollars per euro

async function get(path, key, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("api_token", key);
  url.searchParams.set("fmt", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "User-Agent": "iex-portfolio/0.2" } });
  if (!res.ok) throw new Error(`EODHD ${path}: HTTP ${res.status}`);
  return res.json();
}
const num = (v) => (v === null || v === undefined || v === "" || v === "NA" || isNaN(+v) ? null : +v);

// Wekelijkse slotkoersen, gecorrigeerd voor splitsingen en spin-offs maar niet voor dividend.
// EODHD's "close" is de ruwe koers: bij een split (bv. Alphabet 20:1 in 2022) zakt die ineens 95%.
// "adjusted_close" corrigeert ook voor dividend; dat telt dividend dubbel omdat wij dividend apart boeken.
// Daarom nemen we alleen de sprongen in de verhouding adjusted/close over (splits, spin-offs).
export function splitAdjust(rows) {
  const pts = rows.map((r) => ({ d: r.date, c: num(r.close), a: num(r.adjusted_close) })).filter((r) => r.c > 0);
  const out = new Array(pts.length);
  let m = 1;
  for (let i = pts.length - 1; i >= 0; i--) {
    if (i < pts.length - 1) {
      const r0 = pts[i].a > 0 ? pts[i].a / pts[i].c : null, r1 = pts[i + 1].a > 0 ? pts[i + 1].a / pts[i + 1].c : null;
      if (r0 && r1 && Math.abs(Math.log(r0 / r1)) > 0.1) m *= r0 / r1;
    }
    out[i] = [pts[i].d, +(pts[i].c * m).toFixed(4)];
  }
  return out;
}
async function weekly(symbol, key) {
  const rows = await get(`/eod/${symbol}`, key, { from: FROM, period: "w" });
  return splitAdjust(rows);
}
async function realtime(symbol, key) {
  try {
    const r = await get(`/real-time/${symbol}`, key);
    return { last: num(r.close), prev: num(r.previousClose), changePct: num(r.change_p), ts: num(r.timestamp) };
  } catch { return null; }
}
async function dividends(symbol, key) {
  try {
    const rows = await get(`/div/${symbol}`, key, { from: FROM });
    return rows.map((d) => ({ ex: d.date, pay: d.paymentDate || d.date, amount: num(d.value), currency: d.currency || null }))
      .filter((d) => d.amount);
  } catch { return []; }
}
function latest(obj) {
  if (!obj || typeof obj !== "object") return null;
  const k = Object.keys(obj).sort().pop();
  return k ? obj[k] : null;
}
async function fundamentals(symbol, key) {
  try {
    const f = await get(`/fundamentals/${symbol}`, key);
    const H = f.Highlights || {}, V = f.Valuation || {}, G = f.General || {}, S = f.SplitsDividends || {}, A = f.AnalystRatings || {};
    const bs = latest(f.Financials?.Balance_Sheet?.yearly) || {};
    const equity = num(bs.totalStockholderEquity);
    const debt = num(bs.shortLongTermDebtTotal) ?? ((num(bs.longTermDebt) || 0) + (num(bs.shortTermDebt) || 0));
    const cash = num(bs.cashAndShortTermInvestments) ?? num(bs.cash) ?? 0;
    const trend = f.Earnings?.Trend ? Object.values(f.Earnings.Trend).find((t) => t.period === "+1y") : null;
    return {
      name: G.Name || null, isin: G.ISIN || null, sector: G.Sector || null, industry: G.Industry || null,
      country: G.CountryName || null, currency: G.CurrencyCode || null, description: G.Description || null,
      pe: num(V.TrailingPE) ?? num(H.PERatio), forwardPe: num(V.ForwardPE), pb: num(V.PriceBookMRQ),
      roe: num(H.ReturnOnEquityTTM), margin: num(H.ProfitMargin), revGrowth: num(H.QuarterlyRevenueGrowthYOY),
      epsGrowthNext: num(trend?.growth), dividendYield: num(H.DividendYield), payout: num(S.PayoutRatio),
      debtEquity: equity ? debt / equity : null, netDebtEquity: equity ? (debt - cash) / equity : null,
      targetPrice: num(H.WallStreetTargetPrice) ?? num(A.TargetPrice), analystRating: num(A.Rating),
      analysts: A.StrongBuy !== undefined ? { strongBuy: A.StrongBuy, buy: A.Buy, hold: A.Hold, sell: A.Sell, strongSell: A.StrongSell } : null,
      marketCap: num(H.MarketCapitalization), beta: num(f.Technicals?.Beta),
    };
  } catch { return null; }
}
// Financial Modeling Prep (stable API), zelfde symbolen met .AS/.US-achtervoegsel (VS zonder achtervoegsel)
const FMP = "https://financialmodelingprep.com/stable";
async function fmp(path, symbol, key, params = {}) {
  const url = new URL(`${FMP}/${path}`);
  url.searchParams.set("symbol", symbol);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`FMP ${path}: HTTP ${res.status}`);
  const d = await res.json();
  return Array.isArray(d) ? d : d ? [d] : [];
}
async function fmpFundamentals(eodSymbol, key) {
  if (!key) return null;
  const symbol = eodSymbol.endsWith(".US") ? eodSymbol.slice(0, -3) : eodSymbol.replace(/\.XETRA$/, ".DE");
  const safe = (p) => p.catch(() => []);
  const [ratios, metrics, target, grades, est] = await Promise.all([
    safe(fmp("ratios-ttm", symbol, key)), safe(fmp("key-metrics-ttm", symbol, key)),
    safe(fmp("price-target-consensus", symbol, key)), safe(fmp("grades-consensus", symbol, key)),
    safe(fmp("analyst-estimates", symbol, key, { period: "annual", limit: 6 })),
  ]);
  const r = ratios[0] || {}, m = metrics[0] || {}, t = target[0] || {}, g = grades[0] || {};
  // groeiverwachting: gemiddelde EPS-schatting volgend jaar vs dit jaar
  const yr = new Date().getFullYear();
  const eps = (y) => num(est.find((e) => String(e.date || "").startsWith(String(y)))?.epsAvg);
  const e0 = eps(yr), e1 = eps(yr + 1);
  return {
    pe: num(r.priceToEarningsRatioTTM), debtEquity: num(r.debtToEquityRatioTTM), payout: num(r.dividendPayoutRatioTTM),
    margin: num(r.netProfitMarginTTM), dividendYield: num(r.dividendYieldTTM), roe: num(m.returnOnEquityTTM),
    targetPrice: num(t.targetConsensus), targetHigh: num(t.targetHigh), targetLow: num(t.targetLow), targetMedian: num(t.targetMedian), epsGrowthNext: e0 > 0 && e1 ? e1 / e0 - 1 : null,
    analysts: g.consensus ? { strongBuy: g.strongBuy, buy: g.buy, hold: g.hold, sell: g.sell, strongSell: g.strongSell, consensus: g.consensus } : null,
  };
}
// Analisten en insiders (zelfde FMP-endpoints als guruwatch): losse koersdoelen, up- en downgrades,
// adviesverdeling door de tijd en, voor Amerikaanse aandelen, insidertransacties (SEC Form 4).
const d10 = (v) => (v ? String(v).slice(0, 10) : null);
export async function fmpAnalyst(eodSymbol, key) {
  if (!key) return null;
  const us = eodSymbol.endsWith(".US");
  const symbol = us ? eodSymbol.slice(0, -3) : eodSymbol.replace(/\.XETRA$/, ".DE");
  const safe = (p) => p.catch(() => []);
  const [pt, gr, hist, ins] = await Promise.all([
    safe(fmp("price-target-news", symbol, key, { page: 0, limit: 60 })),
    safe(fmp("grades-news", symbol, key, { page: 0, limit: 60 })),
    safe(fmp("grades-historical", symbol, key, { limit: 30 })),
    us ? safe(fmp("insider-trading/search", symbol, key, { page: 0, limit: 100 })) : Promise.resolve([]),
  ]);
  const out = {
    targets: pt.map((r) => ({ date: d10(r.publishedDate), analyst: r.analystName || null, firm: r.analystCompany || null,
      target: num(r.adjPriceTarget) ?? num(r.priceTarget), priceWhen: num(r.priceWhenPosted) })).filter((r) => r.date && r.target > 0),
    grades: gr.map((r) => ({ date: d10(r.publishedDate), firm: r.gradingCompany || null, action: r.action || null,
      newGrade: r.newGrade || null, prevGrade: r.previousGrade || null })).filter((r) => r.date),
    history: hist.map((r) => ({ date: d10(r.date), strongBuy: num(r.analystRatingsStrongBuy) || 0, buy: num(r.analystRatingsBuy) || 0,
      hold: num(r.analystRatingsHold) || 0, sell: num(r.analystRatingsSell) || 0, strongSell: num(r.analystRatingsStrongSell) || 0 })).filter((r) => r.date),
    insiders: ins.map((r) => ({ date: d10(r.transactionDate), filed: d10(r.filingDate), name: r.reportingName || null, role: r.typeOfOwner || null,
      type: r.transactionType || null, shares: num(r.securitiesTransacted), price: num(r.price), owned: num(r.securitiesOwned) })).filter((r) => r.date && r.shares),
  };
  return out.targets.length || out.grades.length || out.history.length || out.insiders.length ? out : null;
}

// EODHD eerst, ontbrekende velden aanvullen met FMP
function merge(a, b) {
  if (!a) return b; if (!b) return a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if ((out[k] === null || out[k] === undefined) && v !== null && v !== undefined) out[k] = v;
  return out;
}

async function news(symbols, key) {
  try {
    const rows = await get(`/news`, key, { s: symbols.join(","), limit: 30 });
    return rows.map((n) => ({ date: n.date, title: n.title, url: n.link, symbols: n.symbols || [], source: n.link ? new URL(n.link).hostname.replace(/^www\./, "") : null, sentiment: n.sentiment?.polarity ?? null }));
  } catch { return []; }
}

// Kleine pool zodat we EODHD niet met 60 gelijktijdige verzoeken bestoken
async function pool(tasks, size = 6) {
  const out = new Array(tasks.length); let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
  return out;
}

export async function loadMarketData(key = process.env.EODHD_API_KEY, fmpKey = process.env.FMP_API_KEY) {
  if (!key) return null;
  const tick = Object.keys(SYMBOLS);
  const instr = await pool(tick.map((t) => async () => {
    const s = SYMBOLS[t];
    const etf = ETFS.has(t);
    const [prices, rt, divs, fund, fund2, analyst] = await Promise.all([weekly(s, key).catch(() => []), realtime(s, key), dividends(s, key), fundamentals(s, key),
      etf ? null : fmpFundamentals(s, fmpKey).catch(() => null), etf ? null : fmpAnalyst(s, fmpKey).catch(() => null)]);
    return [t, { symbol: s, prices, quote: rt, dividends: divs, fundamentals: merge(fund, fund2), analyst }];
  }));
  const bench = await pool(Object.entries(BENCHMARKS).map(([k, b]) => async () => {
    try { return [k, { ...b, prices: await weekly(b.symbol, key) }]; } catch { return [k, { ...b, prices: [] }]; }
  }));
  const fx = await weekly(FX, key).catch(() => []);
  const fxs = Object.fromEntries(await Promise.all(Object.entries(FXS).map(async ([c, pair]) => [c, { pair: pair.slice(0, 6), prices: await weekly(pair, key).catch(() => []) }])));
  return {
    source: fmpKey ? "EODHD + FMP" : "EODHD", generatedAt: new Date().toISOString(),
    instruments: Object.fromEntries(instr), benchmarks: Object.fromEntries(bench), fx: { pair: "EURUSD", prices: fx }, fxs,
    news: await news(tick.filter((t) => t !== "PHIA" && !ETFS.has(t)).map((t) => SYMBOLS[t]), key),
  };
}
