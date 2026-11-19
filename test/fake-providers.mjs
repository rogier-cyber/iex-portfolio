// Bootst EODHD- en FMP-antwoorden na (zelfde vorm als de echte API's) om de verwerking te testen zonder key.
import { loadMarketData } from "../lib/market-data.js";
const P0 = { "ASML.AS":620,"ASM.AS":480,"BESI.AS":130,"ADYEN.AS":1400,"SHELL.AS":31,"INGA.AS":20,"NN.AS":55,"UNA.AS":52,"AD.AS":35,"HEIA.AS":70,"WKL.AS":120,"PRX.AS":50,"MSFT.US":500,"KPN.AS":3.9,"SAP.XETRA":240,"MC.PA":610,"NESN.SW":80,"NOVO-B.CO":320,"KBC.BR":104,"ARGX.BR":690,"NVDA.US":185,"IWDA.AS":110,"VWRL.AS":142,"EMIM.AS":38,"EURCHF.FOREX":.935,"EURDKK.FOREX":7.46,"PHIA.AS":24,"AEX.INDX":940,"AMX.INDX":900,"IWDA.AS":105,"GSPC.INDX":6700,"STOXX50E.INDX":5600,"EURUSD.FOREX":1.16 };
function series(sym){let s=1;for(const c of sym)s=(s*31+c.charCodeAt(0))%2147483647;const rnd=()=>(s=(s*48271)%2147483647)/2147483647;
  const out=[];let p=P0[sym]*0.45;const d=new Date(Date.UTC(2018,11,31));while(d<new Date()){p*=1+(rnd()-.485)*.06;out.push({date:d.toISOString().slice(0,10),close:+p.toFixed(2),adjusted_close:+p.toFixed(2)});d.setUTCDate(d.getUTCDate()+7);}
  const k=P0[sym]/p;
  // MSFT krijgt een nep-split 20:1 op 2022-07-18: ruwe close ervoor x20, adjusted_close niet (zoals EODHD bij Alphabet)
  const split=sym==="MSFT.US"?(d)=>d<"2022-07-18"?20:1:()=>1;
  return out.map(r=>({...r,close:+(r.close*k*split(r.date)).toFixed(3)}));}
globalThis.fetch = async (u) => {
  const url = new URL(u); const p = url.pathname; let body;
  if (url.hostname === "eodhd.com") {
    const sym = decodeURIComponent(p.split("/").pop());
    if (p.startsWith("/api/eod/")) body = series(sym);
    else if (p.startsWith("/api/real-time/")) body = { close: P0[sym], previousClose: P0[sym]/1.01, change_p: 1.0, timestamp: Date.now()/1000 };
    else if (p.startsWith("/api/splits/")) body = sym === "MSFT.US" ? [{ date: "2022-07-18", split: "20.000000/1.000000" }] : [];
    // MSFT: value is split-gecorrigeerd, unadjustedValue vóór de nep-split 20x zo hoog (zoals EODHD dat levert)
    else if (p.startsWith("/api/div/")) body = sym.includes("ADYEN") ? [] : [2021,2022,2023,2024,2025,2026].flatMap(y=>[{date:`${y}-04-24`,paymentDate:`${y}-05-06`,value:0.5+(y-2021)*0.05,currency:sym.endsWith(".US")?"USD":"EUR"},{date:`${y}-10-27`,paymentDate:`${y}-11-06`,value:0.3+(y-2021)*0.04,currency:sym.endsWith(".US")?"USD":"EUR"}])
      .map(d=>({...d,unadjustedValue:sym==="MSFT.US"&&d.date<"2022-07-18"?d.value*20:d.value}));
    else if (p.startsWith("/api/fundamentals/")) body = sym==="BESI.AS" ? {} : { General:{Name:sym,Sector:"Technology",CountryName:"Netherlands",CurrencyCode:"EUR"}, Highlights:{PERatio:18.5,ReturnOnEquityTTM:0.21,ProfitMargin:0.18,QuarterlyRevenueGrowthYOY:0.07,DividendYield:0.025,WallStreetTargetPrice:P0[sym]*1.12}, Valuation:{TrailingPE:18.5,ForwardPE:16}, SplitsDividends:{PayoutRatio:0.45}, Earnings:{Trend:{a:{period:"+1y",growth:"0.11"}}}, Financials:{Balance_Sheet:{yearly:{"2024-12-31":{totalStockholderEquity:"1000",shortLongTermDebtTotal:"450",cash:"200"}}}}, Technicals:{Beta:1.1} };
    else if (p === "/api/calendar/earnings") body = { earnings: [{ code: "ASML.AS", report_date: new Date(Date.now()+9*864e5).toISOString().slice(0,10), before_after_market: "BeforeMarket" }, { code: "MSFT.US", report_date: new Date(Date.now()+60*864e5).toISOString().slice(0,10) }] };
    else if (p === "/api/news") body = [{date:"2026-11-14T08:00:00+00:00",title:"Test: ASML meldt orderboek",link:"https://example.com/a",symbols:["ASML.AS"]},{date:"2026-11-13T08:00:00+00:00",title:"Test: Microsoft & cloud <b>",link:"https://example.com/b",symbols:["MSFT.US"]}];
    else return new Response("not found", { status: 404 });
  } else if (url.hostname === "financialmodelingprep.com") {
    const path = p.replace("/stable/", "");
    body = path === "ratios-ttm" ? [{ priceToEarningsRatioTTM: 44, debtToEquityRatioTTM: 0.3, dividendPayoutRatioTTM: 0.6, netProfitMarginTTM: 0.3, dividendYieldTTM: 0.017 }]
      : path === "key-metrics-ttm" ? [{ returnOnEquityTTM: 0.35 }]
      : path === "price-target-consensus" ? [{ targetConsensus: 150 }]
      : path === "grades-consensus" ? [{ strongBuy: 3, buy: 10, hold: 5, sell: 1, strongSell: 0, consensus: "Buy" }]
      : path === "analyst-estimates" ? [{ date: `${new Date().getFullYear()+1}-12-31`, epsAvg: 4.6 }, { date: `${new Date().getFullYear()}-12-31`, epsAvg: 4.0 }]
      : path === "price-target-news" ? [{ publishedDate: "2026-11-03T10:00:00.000Z", analystName: "Test Analist", analystCompany: "Testbank", priceTarget: 3000, adjPriceTarget: 150, priceWhenPosted: 130 }]
      : path === "grades-news" ? [{ publishedDate: "2026-10-20T10:00:00.000Z", gradingCompany: "Testbank", previousGrade: "Hold", newGrade: "Buy", action: "upgrade" }]
      : path === "grades-historical" ? [{ date: "2026-11-01", analystRatingsStrongBuy: 3, analystRatingsBuy: 10, analystRatingsHold: 5, analystRatingsSell: 1, analystRatingsStrongSell: 0 }]
      : path === "insider-trading/search" ? [{ transactionDate: "2026-10-01", filingDate: "2026-10-03", reportingName: "Test Persoon", typeOfOwner: "director", transactionType: "S-Sale", securitiesTransacted: 1000, price: 400, securitiesOwned: 5000 }] : [];
  } else if (url.hostname === "www.afm.nl") {
    const csv = "Transactiedatum;Uitgevende instelling;Meldingsplichtige;Nauw gelieerd aan;Positie;Type instrument;ISIN;Aard transactie;Soort transactie;Aandelenoptie programma;Plaats van handel;Prijs;Aantal;Eenheid\r\n" +
      "12-11-2026;ASML Holding N.V.;Test A.;;CEO;Gewoon aandeel;NL0010273215;Verwerving;Aankoop;Nee;XAMS;905,20;1.000,00;EUR\r\n" +
      "03-10-2026;ING Groep N.V.;Test B.;;Board member;Gewoon aandeel;NL0011821202;Vervreemding;Verkoop;Nee;XAMS;21,10;5.000,00;EUR\r\n";
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(csv).buffer, json: async () => ({}) };
  } else if (url.hostname === "www.ser-ag.com") {
    const items = url.searchParams.get("pageNumber") === "0" ? [
      { ISIN: "CH0038863350", transactionDate: "20261105", buySellIndicator: "B", transactionSize: 2000, transactionAmountPerSecurityCHF: 84.5, transactionAmountCHF: 169000, obligorFunctionCode: "1", obligorRelatedPartyInd: "F", notificationSubmitter: "Nestlé S.A." },
      { ISIN: "CH1386220409", transactionDate: "20261104", transactionSize: 1, transactionAmountPerSecurityCHF: 135000, obligorFunctionCode: "2" }] : [];
    return new Response(JSON.stringify({ status: "Ok", totalCount: 2, itemList: items }), { status: 200 });
  } else if (url.hostname === "www.fsma.be") {
    if (url.pathname.includes("manager-transaction/")) return new Response(`<div class="field"><div class="field__label">Date of publication</div><div class="field__item">11/11/2026</div></div><div><div class="field__label">Notifying person</div><div>Test K.</div></div><div><div class="field__label">Declarer Type</div><div>Senior executive</div></div><div><div class="field__label">Instrument Type</div><div>Share</div></div><div><div class="field__label">Instrument ISIN Code</div><div>BE0003565737</div></div><div><div class="field__label">Transaction Type</div><div>Purchase / Acquisition</div></div><div><div class="field__label">Transaction Type Specifications</div><div></div></div><div><div class="field__label">Transaction Date</div><div>06/11/2026</div></div><div><div class="field__label">Transaction Currency</div><div>EUR</div></div><div><div class="field__label">Transaction Quantity</div><div>700</div></div><div><div class="field__label">Transaction Price</div><div>79,99</div></div><div><div class="field__label">Transaction Amount</div><div>55.993,00</div></div>`, { status: 200 });
    return new Response(`<select name="issuer"><option value="All">- Any -</option><option value="4411">KBC GROUP</option><option value="4500">UCB</option></select><table><tr><th>Publication date</th><th>Issuer</th><th>Notifying person</th></tr><tr><td>11/11/2026</td><td><a href="/en/manager-transaction/kbc-group-12">KBC GROUP</a></td><td>Test K.</td></tr><tr><td>11/11/2026</td><td><a href="/en/manager-transaction/ucb-214">UCB</a></td><td>Caeymaex Emmanuel</td></tr></table>`, { status: 200 });
  } else if (url.hostname === "api.gleif.org") {
    return new Response(JSON.stringify({ data: url.search.includes("NL0010273215") ? [{ id: "724500Y6DUVHQD6OXN27" }] : [] }), { status: 200 });
  } else if (url.hostname === "bdif.amf-france.org") {
    return new Response(JSON.stringify({ aggregations: {}, hits: { total: 2, hits: [{ _source: { numero: "2026DD123", dateInformation: "2026-10-30T00:00:00Z", titre: "Déclaration des dirigeants - LVMH Moët Hennessy Louis Vuitton - acquisition", path: "pdf/2026DD123.pdf" } }, { _source: { numero: "2026DD9", dateInformation: "2026-10-01T00:00:00Z", titre: "Autre société - cession" } }] } }), { status: 200 });
  } else throw new Error("unexpected host " + url.hostname);
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
};
// FAKE_SERVER=1: start de echte server met deze nagebootste bronnen (insiderbronnen 4 s vertraagd)
if (process.env.FAKE_SERVER) {
  const real = globalThis.fetch;
  globalThis.fetch = async (u, o) => { if (/afm\.nl|fsma|ser-ag|amf-france/.test(String(u))) await new Promise((r) => setTimeout(r, 4000)); return real(u, o); };
  process.env.EODHD_API_KEY = "test"; process.env.FMP_API_KEY = "test";
  await import("../server.js");
  await new Promise(() => {});
}
const data = await loadMarketData("test-key", "test-fmp");
const fs = await import("node:fs/promises");
await fs.mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await fs.writeFile(new URL("../public/data/snapshot.json", import.meta.url), JSON.stringify(data));
const besi = data.instruments.BESI.fundamentals;
console.log("source", data.source, "| instruments", Object.keys(data.instruments).length, "| bench", Object.keys(data.benchmarks).map(k=>k+":"+data.benchmarks[k].prices.length).join(" "), "| fx", data.fx.prices.length, "| news", data.news.length);
console.log("ASML fund", JSON.stringify(data.instruments.ASML.fundamentals).slice(0,300));
console.log("BESI from FMP only", JSON.stringify(besi));
console.log("AFM", JSON.stringify(data.afm).slice(0, 220), "| ASML afm rows:", (data.instruments.ASML.afm || []).length);
console.log("EU", JSON.stringify(data.insiderSources), "| NESN:", JSON.stringify((data.instruments.NESN.afm||[])[0]), "| MC:", JSON.stringify((data.instruments.MC.afm||[])[0]));
const ms = data.instruments.MSFT;
console.log("MSFT splits", JSON.stringify(ms.splits), "| div 2021-04 raw:", JSON.stringify(ms.dividends.find((d) => d.ex === "2021-04-24")), "| prijs 2021 vs 2023:", ms.prices.find((p) => p[0] >= "2021-06-01")?.[1], ms.prices.find((p) => p[0] >= "2023-06-01")?.[1]);
console.log("FSMA/KBC:", JSON.stringify((data.instruments.KBC.afm||[])[0]), "| leis:", data.afm.leis);
