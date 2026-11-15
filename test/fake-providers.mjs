// Bootst EODHD- en FMP-antwoorden na (zelfde vorm als de echte API's) om de verwerking te testen zonder key.
import { loadMarketData } from "../lib/market-data.js";
const P0 = { "ASML.AS":620,"ASM.AS":480,"BESI.AS":130,"ADYEN.AS":1400,"SHELL.AS":31,"INGA.AS":20,"NN.AS":55,"UNA.AS":52,"AD.AS":35,"HEIA.AS":70,"WKL.AS":120,"PRX.AS":50,"MSFT.US":500,"KPN.AS":3.9,"SAP.XETRA":240,"MC.PA":610,"NESN.SW":80,"NOVO-B.CO":320,"NVDA.US":185,"IWDA.AS":110,"VWRL.AS":142,"EMIM.AS":38,"EURCHF.FOREX":.935,"EURDKK.FOREX":7.46,"PHIA.AS":24,"AEX.INDX":940,"AMX.INDX":900,"IWDA.AS":105,"GSPC.INDX":6700,"STOXX50E.INDX":5600,"EURUSD.FOREX":1.16 };
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
    else if (p.startsWith("/api/div/")) body = sym.includes("ADYEN") ? [] : [2021,2022,2023,2024,2025,2026].flatMap(y=>[{date:`${y}-04-24`,paymentDate:`${y}-05-06`,value:0.5+(y-2021)*0.05,currency:"EUR"},{date:`${y}-10-27`,paymentDate:`${y}-11-06`,value:0.3+(y-2021)*0.04,currency:"EUR"}]);
    else if (p.startsWith("/api/fundamentals/")) body = sym==="BESI.AS" ? {} : { General:{Name:sym,Sector:"Technology",CountryName:"Netherlands",CurrencyCode:"EUR"}, Highlights:{PERatio:18.5,ReturnOnEquityTTM:0.21,ProfitMargin:0.18,QuarterlyRevenueGrowthYOY:0.07,DividendYield:0.025,WallStreetTargetPrice:P0[sym]*1.12}, Valuation:{TrailingPE:18.5,ForwardPE:16}, SplitsDividends:{PayoutRatio:0.45}, Earnings:{Trend:{a:{period:"+1y",growth:"0.11"}}}, Financials:{Balance_Sheet:{yearly:{"2024-12-31":{totalStockholderEquity:"1000",shortLongTermDebtTotal:"450",cash:"200"}}}}, Technicals:{Beta:1.1} };
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
  } else throw new Error("unexpected host " + url.hostname);
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
};
const data = await loadMarketData("test-key", "test-fmp");
const fs = await import("node:fs/promises");
await fs.mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await fs.writeFile(new URL("../public/data/snapshot.json", import.meta.url), JSON.stringify(data));
const besi = data.instruments.BESI.fundamentals;
console.log("source", data.source, "| instruments", Object.keys(data.instruments).length, "| bench", Object.keys(data.benchmarks).map(k=>k+":"+data.benchmarks[k].prices.length).join(" "), "| fx", data.fx.prices.length, "| news", data.news.length);
console.log("ASML fund", JSON.stringify(data.instruments.ASML.fundamentals).slice(0,300));
console.log("BESI from FMP only", JSON.stringify(besi));
