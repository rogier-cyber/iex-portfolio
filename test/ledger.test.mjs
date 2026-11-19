// Testset brokerdata: per valkuil een klein voorbeeld. Elke wijziging in de rekenkern moet deze halen.
import test from "node:test";
import assert from "node:assert/strict";
import { replay, dedupe, checkAgainstMarket, reconcile, explain, qtyBefore } from "../public/js/ledger.js";

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const dep = (date, amount) => ({ type: "DEPOSIT", date, account: "A", amount, ccy: "EUR" });

test("Nvidia-split 10:1 (juni 2024): aantallen x10, kostprijs gelijk", () => {
  const s = replay([dep("2024-01-02", 10000), { type: "BUY", date: "2024-01-10", account: "A", inst: "NVDA", qty: 10, price: 540, ccy: "USD", fx: 0.92 },
    { type: "SPLIT", date: "2024-06-10", inst: "NVDA", ratio: 10 }]);
  const p = s.positions.NVDA;
  assert.equal(p.qty, 100);
  near(p.costEUR, 10 * 540 * 0.92);
  near(p.costLocal / p.qty, 54);
});

test("koop op de splitdag wordt niet mee-gesplitst", () => {
  const s = replay([{ type: "BUY", date: "2024-06-10", inst: "NVDA", qty: 5, price: 120, ccy: "USD", fx: 0.92 },
    { type: "BUY", date: "2024-06-03", inst: "NVDA", qty: 1, price: 1150, ccy: "USD", fx: 0.92 },
    { type: "SPLIT", date: "2024-06-10", inst: "NVDA", ratio: 10 }]);
  assert.equal(s.positions.NVDA.qty, 15);
});

test("reverse split 1:10 met restfractie in contanten", () => {
  const s = replay([dep("2023-01-01", 1000), { type: "BUY", date: "2023-01-02", account: "A", inst: "X", qty: 105, price: 1, ccy: "EUR" },
    { type: "SPLIT", date: "2023-06-01", account: "A", inst: "X", ratio: 0.1, cashInLieu: 4.5, ccy: "EUR" }]);
  const p = s.positions.X;
  assert.equal(p.qty, 10);
  near(p.costEUR, 100); // 0,5 nieuw aandeel = 5 oude à 1 euro is verkocht
  near(p.realized.total, -0.5);
  near(s.cash["A|EUR"].amount, 1000 - 105 + 4.5);
});

test("spin-off (Unilever → Magnum, 1 op 5): kostprijs verdeeld, aankoopdatum loopt door", () => {
  const s = replay([{ type: "BUY", date: "2020-03-02", inst: "UNA", qty: 100, price: 50, ccy: "EUR" },
    { type: "SPINOFF", date: "2025-12-08", inst: "UNA", newInst: "MICC", ratio: 0.2, costFraction: 0.1 }]);
  near(s.positions.UNA.costEUR, 4500);
  near(s.positions.MICC.costEUR, 500);
  assert.equal(s.positions.MICC.qty, 20);
  assert.equal(s.positions.MICC.lots[0].date, "2020-03-02");
});

test("spin-off zonder verdeling geeft een waarschuwing", () => {
  const s = replay([{ type: "BUY", date: "2020-03-02", inst: "UNA", qty: 100, price: 50, ccy: "EUR" }, { type: "SPINOFF", date: "2025-12-08", inst: "UNA", newInst: "MICC", ratio: 0.2 }]);
  assert.ok(s.warnings.some((w) => w.code === "spinoff-cost"));
});

test("verkoop van gekregen spin-off-aandelen geeft geen negatieve positie", () => {
  const s = replay([{ type: "BUY", date: "2020-03-02", inst: "UNA", qty: 100, price: 50, ccy: "EUR" },
    { type: "SPINOFF", date: "2025-12-08", inst: "UNA", newInst: "MICC", ratio: 0.2, costFraction: 0.1 },
    { type: "SELL", date: "2026-01-05", inst: "MICC", qty: 20, price: 30, ccy: "EUR" }]);
  assert.equal(s.positions.MICC.qty, 0);
  near(s.positions.MICC.realized.total, 100);
  assert.ok(!s.warnings.some((w) => w.code === "oversell"));
});

test("Shell-dividend in dollars blijft dollarkas, omzetten geeft valutaresultaat", () => {
  const s = replay([{ type: "DIVIDEND", date: "2025-03-24", account: "A", inst: "SHELL", gross: 100, tax: 15, ccy: "USD", fx: 0.95, exDate: "2025-02-13", taxCountry: "GB" },
    { type: "FX", date: "2025-06-02", account: "A", fromAmount: 85, fromCcy: "USD", toAmount: 76.5, toCcy: "EUR" }]);
  assert.equal(s.cash["A|USD"].amount, 0);
  near(s.cash["A|EUR"].amount, 76.5);
  near(s.cash["A|USD"].fxRealized, 76.5 - 85 * 0.95);
  near(s.positions.SHELL.div.net, 85 * 0.95);
});

test("Nestlé met 35% bronbelasting: terug te vragen deel wordt gemeld", () => {
  const s = replay([{ type: "DIVIDEND", date: "2025-04-22", account: "A", inst: "NESN", gross: 300, tax: 105, ccy: "CHF", fx: 1.06, exDate: "2025-04-17", taxCountry: "CH" }]);
  const w = s.warnings.find((x) => x.code === "tax-reclaim");
  assert.ok(w);
  near(w.reclaim, 0.2 * 300 * 1.06);
});

test("VS zonder W-8BEN (30%): melding met tip", () => {
  const s = replay([{ type: "DIVIDEND", date: "2025-03-13", inst: "MSFT", gross: 83, tax: 24.9, ccy: "USD", fx: 0.92, exDate: "2025-02-20", taxCountry: "US" }]);
  assert.match(s.warnings.find((x) => x.code === "tax-reclaim").text, /W-8BEN/);
});

test("DRIP telt niet als storting", () => {
  const s = replay([dep("2024-01-02", 1000), { type: "BUY", date: "2024-01-03", account: "A", inst: "VWRL", qty: 10, price: 100, ccy: "EUR" },
    { type: "DIVIDEND", date: "2024-03-27", account: "A", inst: "VWRL", gross: 8, tax: 0, ccy: "EUR", exDate: "2024-03-14" },
    { type: "BUY", date: "2024-03-27", account: "A", inst: "VWRL", qty: 0.08, price: 100, ccy: "EUR" }]);
  assert.equal(s.flows.length, 1);
  near(s.positions.VWRL.qty, 10.08, 1e-9);
  near(s.cash["A|EUR"].amount, 0);
});

test("overboeking van DEGIRO naar een andere broker: kostprijs en datum lopen door, geen storting", () => {
  const s = replay([dep("2021-01-04", 2000), { type: "BUY", date: "2021-01-05", account: "DEGIRO", inst: "ASML", qty: 4, price: 420, ccy: "EUR" },
    { type: "TRANSFER_OUT", date: "2024-05-01", account: "DEGIRO", inst: "ASML", qty: 4 },
    { type: "TRANSFER_IN", date: "2024-05-03", account: "IBKR", inst: "ASML", qty: 4 }]);
  near(s.positions.ASML.costEUR, 1680);
  assert.equal(s.positions.ASML.lots[0].date, "2021-01-05");
  assert.equal(s.flows.length, 1);
  assert.ok(!s.warnings.some((w) => w.code === "transfer-cost"));
});

test("inkomende overboeking zonder kostprijs: waarschuwing en kostprijs onbekend", () => {
  const s = replay([{ type: "TRANSFER_IN", date: "2024-05-03", inst: "ASML", qty: 4, price: 900, ccy: "EUR" }]);
  assert.ok(s.positions.ASML.costUnknown);
  assert.ok(s.warnings.some((w) => w.code === "transfer-cost"));
});

test("overname in contanten sluit de positie", () => {
  const s = replay([{ type: "BUY", date: "2022-01-03", account: "A", inst: "TKWY", qty: 50, price: 40, ccy: "EUR" },
    { type: "MERGER", date: "2025-01-10", account: "A", inst: "TKWY", cashPerShare: 54, ccy: "EUR" }]);
  assert.equal(s.positions.TKWY.qty, 0);
  near(s.positions.TKWY.realized.total, 50 * 14);
  near(s.cash["A|EUR"].amount, -2000 + 2700);
});

test("fusie in aandelen: kostprijs gaat naar het nieuwe aandeel", () => {
  const s = replay([{ type: "BUY", date: "2022-01-03", inst: "OLD", qty: 100, price: 10, ccy: "EUR" }, { type: "MERGER", date: "2024-01-10", inst: "OLD", newInst: "NEW", ratio: 0.5 }]);
  assert.equal(s.positions.NEW.qty, 50);
  near(s.positions.NEW.costEUR, 1000);
});

test("ISIN-wijziging: één positie, niet twee", () => {
  const s = replay([{ type: "BUY", date: "2022-01-03", inst: "NL0000001", qty: 10, price: 10, ccy: "EUR" }, { type: "ISIN_CHANGE", date: "2023-01-02", inst: "NL0000001", newInst: "NL0000002" },
    { type: "BUY", date: "2023-02-01", inst: "NL0000002", qty: 5, price: 12, ccy: "EUR" }]);
  assert.equal(Object.keys(s.positions).length, 1);
  assert.equal(s.positions.NL0000002.qty, 15);
});

test("stockdividend: nieuwe stukken op kostprijs 0", () => {
  const s = replay([{ type: "BUY", date: "2022-01-03", inst: "AD", qty: 100, price: 25, ccy: "EUR" }, { type: "STOCK_DIVIDEND", date: "2022-05-01", inst: "AD", qty: 2 }]);
  assert.equal(s.positions.AD.qty, 102);
  near(s.positions.AD.costEUR, 2500);
});

test("kapitaalterugbetaling verlaagt de kostprijs en is geen inkomen", () => {
  const s = replay([{ type: "BUY", date: "2022-01-03", inst: "X", qty: 100, price: 25, ccy: "EUR" }, { type: "DIVIDEND", date: "2022-06-01", inst: "X", gross: 100, tax: 0, ccy: "EUR", kind: "capital_return", exDate: "2022-05-20" }]);
  near(s.positions.X.costEUR, 2400);
  near(s.positions.X.div.gross, 0);
});

test("opnieuw geïmporteerd bestand: dubbele externe id's vallen weg", () => {
  const e = { type: "DIVIDEND", date: "2025-03-01", inst: "X", gross: 10, tax: 1.5, ccy: "EUR", exDate: "2025-02-20", src: { broker: "DEGIRO", extId: "abc" } };
  const s = replay([e, { ...e }]);
  near(s.positions.X.div.gross, 10);
  assert.equal(s.dropped.length, 1);
});

test("twee gelijke orders zonder id blijven staan maar worden gemeld", () => {
  const b = { type: "BUY", date: "2025-03-01", inst: "X", qty: 10, price: 5, ccy: "EUR" };
  const s = replay([b, { ...b }]);
  assert.equal(s.positions.X.qty, 20);
  assert.ok(s.warnings.some((w) => w.code === "duplicate"));
  assert.equal(dedupe([b, { ...b }]).suspects.length, 1);
});

test("teruggeboekt en opnieuw geboekt dividend telt één keer", () => {
  const d = { type: "DIVIDEND", date: "2025-03-01", inst: "X", gross: 10, tax: 1.5, ccy: "EUR", exDate: "2025-02-20" };
  const s = replay([d, { ...d, type: "DIVIDEND_REVERSAL", date: "2025-03-03" }, { ...d, date: "2025-03-04", gross: 10.5 }]);
  near(s.positions.X.div.gross, 10.5);
});

test("verkoop van meer dan je hebt is een fout", () => {
  const s = replay([{ type: "BUY", date: "2025-01-02", inst: "X", qty: 10, price: 5, ccy: "EUR" }, { type: "SELL", date: "2025-02-02", inst: "X", qty: 12, price: 6, ccy: "EUR" }]);
  assert.ok(s.warnings.some((w) => w.code === "oversell" && w.level === "error"));
});

test("FIFO en gemiddelde kostprijs geven ander gerealiseerd resultaat, zelfde totaal", () => {
  const es = [{ type: "BUY", date: "2020-01-02", inst: "X", qty: 10, price: 10, ccy: "EUR" }, { type: "BUY", date: "2021-01-04", inst: "X", qty: 10, price: 20, ccy: "EUR" },
    { type: "SELL", date: "2022-01-03", inst: "X", qty: 10, price: 25, ccy: "EUR" }];
  const avg = replay(es), fifo = replay(es, { method: "fifo" });
  near(avg.positions.X.realized.total, 100);
  near(fifo.positions.X.realized.total, 150);
  near(avg.positions.X.realized.total - avg.positions.X.costEUR, fifo.positions.X.realized.total - fifo.positions.X.costEUR); // gerealiseerd + ongerealiseerd is gelijk
});

test("gerealiseerd resultaat gesplitst in koers en valuta", () => {
  const s = replay([{ type: "BUY", date: "2020-01-02", inst: "MSFT", qty: 10, price: 100, ccy: "USD", fx: 0.9 }, { type: "SELL", date: "2022-01-03", inst: "MSFT", qty: 10, price: 120, ccy: "USD", fx: 0.8 }]);
  const r = s.positions.MSFT.realized;
  near(r.total, 960 - 900);
  near(r.price, 200 * 0.9);
  near(r.fx, 1200 * (0.8 - 0.9));
});

test("restfractie van 0,00000001 aandeel wordt 0", () => {
  const s = replay([{ type: "BUY", date: "2020-01-02", inst: "X", qty: 1.00000001, price: 10, ccy: "EUR" }, { type: "SELL", date: "2020-02-03", inst: "X", qty: 1, price: 11, ccy: "EUR" }]);
  assert.equal(s.positions.X.qty, 0);
});

test("dividendrecht: positie aan het eind van de dag vóór de ex-datum", () => {
  const es = [{ type: "BUY", date: "2025-01-02", inst: "X", qty: 10, price: 5, ccy: "EUR" }, { type: "BUY", date: "2025-02-20", inst: "X", qty: 5, price: 5, ccy: "EUR" }];
  assert.equal(qtyBefore(es, "X", "2025-02-20"), 10);
});

/* ---- controles met marktdata ---- */
const market = {
  close: (inst, d) => ({ VOD: 70, NVDA: 120 }[inst] ?? null),
  dividends: { X: [{ exDate: "2025-02-20", payDate: "2025-03-05", amount: 0.5, ccy: "EUR" }, { exDate: "2025-08-20", payDate: "2025-09-05", amount: 0.5, ccy: "EUR" }] },
  splits: { NVDA: [{ date: "2024-06-10", ratio: 10 }] },
};

test("prijs in pence i.p.v. pond wordt herkend", () => {
  const w = checkAgainstMarket([{ type: "BUY", date: "2025-01-02", inst: "VOD", qty: 100, price: 7000, ccy: "GBP" }], market);
  assert.ok(w.some((x) => x.code === "price-unit"));
});

test("prijs van vóór de split wordt herkend", () => {
  const w = checkAgainstMarket([{ type: "BUY", date: "2025-01-02", inst: "NVDA", qty: 1, price: 1200, ccy: "USD" }], market);
  assert.ok(w.some((x) => x.code === "price-split"));
});

test("verwacht maar niet ontvangen dividend", () => {
  const es = [{ type: "BUY", date: "2025-01-02", inst: "X", qty: 100, price: 5, ccy: "EUR" }, { type: "DIVIDEND", date: "2025-03-05", inst: "X", gross: 50, tax: 7.5, ccy: "EUR", exDate: "2025-02-20" }];
  const w = checkAgainstMarket(es, market, { today: "2025-12-31" });
  const miss = w.filter((x) => x.code === "div-missing");
  assert.equal(miss.length, 1);
  near(miss[0].expected, 50);
});

test("split die in de markt bekend is maar niet geboekt", () => {
  const w = checkAgainstMarket([{ type: "BUY", date: "2024-01-02", inst: "NVDA", qty: 10, price: 500, ccy: "USD" }], { ...market, close: () => null }, { today: "2025-01-01" });
  assert.ok(w.some((x) => x.code === "split-missing"));
});

test("aansluiting met de broker: verschillen per positie en per valuta", () => {
  const s = replay([dep("2025-01-02", 1000), { type: "BUY", date: "2025-01-03", account: "A", inst: "X", qty: 10, price: 50, ccy: "EUR" }]);
  const ok = reconcile(s, { positions: { X: 10 }, cash: { EUR: 500 } });
  assert.ok(ok.ok);
  const bad = reconcile(s, { positions: { X: 12 }, cash: { EUR: 500, USD: 3.2 } });
  assert.equal(bad.rows.filter((r) => !r.ok).length, 2);
});

test("uitleg in gewone taal", () => {
  assert.match(explain({ type: "SPLIT", inst: "NVDA", ratio: 10 }), /10 op 1/);
  assert.match(explain({ type: "SPINOFF", inst: "Unilever", newInst: "Magnum", ratio: 0.2, costFraction: 0.1 }), /10% van je kostprijs/);
  assert.match(explain({ type: "MERGER", inst: "Takeaway", cashPerShare: 54 }), /overgenomen/);
});
