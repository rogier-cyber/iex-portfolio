// node --test test/  — rekenregels voor splits, dividendrecht en dividendvaluta
import test from "node:test";
import assert from "node:assert/strict";
import { parseSplits, splitFactorAfter, fixJumps, dividendPerShareNow, normCurrency, qtyEntitled } from "../public/js/corporate-actions.js";
import { parseSplitRows, splitAdjust } from "../lib/market-data.js";

const DAY = 864e5, D = (s) => Date.parse(s + "T00:00:00Z");
const START = D("2024-01-05"), sampleAt = (i) => START + i * 7 * DAY;

test("EODHD-splitnotatie wordt nieuwe aandelen per oud aandeel", () => {
  assert.deepEqual(parseSplitRows([{ date: "2024-06-10", split: "10.000000/1.000000" }, { date: "2020-01-02", split: "1.000000/10.000000" }, { date: "x", split: "1/1" }]),
    [{ date: "2024-06-10", ratio: 10 }, { date: "2020-01-02", ratio: 0.1 }]);
});

test("splitfactor telt alleen splits ná de datum", () => {
  const s = parseSplits([{ date: "2021-07-20", ratio: 4 }, { date: "2024-06-10", ratio: 10 }], D);
  assert.equal(splitFactorAfter(s, D("2020-01-01")), 40);
  assert.equal(splitFactorAfter(s, D("2022-01-01")), 10);
  assert.equal(splitFactorAfter(s, D("2024-06-10")), 1);
});

test("een echte koersval zonder split blijft staan", () => {
  const px = [100, 101, 102, 30, 31];
  assert.deepEqual(fixJumps([...px], [], sampleAt), px);
  // een split elders in de tijd verandert er ook niets aan
  assert.deepEqual(fixJumps([...px], parseSplits([{ date: "2020-01-01", ratio: 0.3 }], D), sampleAt), px);
});

test("een niet-verwerkte 10-op-1-split wordt gecorrigeerd", () => {
  const px = [1000, 1010, 1020, 103, 104];
  const out = fixJumps([...px], [{ d: sampleAt(3) - 2 * DAY, r: 10 }], sampleAt);
  assert.deepEqual(out.map((v) => Math.round(v * 10) / 10), [100, 101, 102, 103, 104]);
});

test("een sprong die niet bij de splitverhouding past wordt niet aangepast", () => {
  const px = [100, 101, 30, 31];
  assert.deepEqual(fixJumps([...px], [{ d: sampleAt(2), r: 10 }], sampleAt), px);
});

test("reverse split 1-op-10 wordt gecorrigeerd", () => {
  const out = fixJumps([2, 2.1, 21.5, 22], [{ d: sampleAt(2), r: 0.1 }], sampleAt);
  assert.deepEqual(out.map((v) => Math.round(v * 10) / 10), [20, 21, 21.5, 22]);
});

test("ongecorrigeerd dividend van vóór een split gaat naar aandelen van nu", () => {
  const s = [{ d: D("2024-06-10"), r: 10 }];
  assert.ok(Math.abs(dividendPerShareNow({ amount: 0.04, adjusted: false, exd: D("2024-03-05") }, s) - 0.004) < 1e-12);
  assert.equal(dividendPerShareNow({ amount: 0.01, adjusted: false, exd: D("2024-09-12") }, s), 0.01);
  assert.equal(dividendPerShareNow({ amount: 0.004, adjusted: true, exd: D("2024-03-05") }, s), 0.004);
});

test("pence en agorot naar hoofdvaluta", () => {
  assert.deepEqual(normCurrency("GBX", 150), { ccy: "GBP", amount: 1.5 });
  assert.deepEqual(normCurrency("ILA", 50), { ccy: "ILS", amount: 0.5 });
  assert.deepEqual(normCurrency("usd", 1), { ccy: "USD", amount: 1 });
  assert.deepEqual(normCurrency(null, 1), { ccy: null, amount: 1 });
});

test("dividendrecht: positie aan het eind van de dag vóór de ex-datum", () => {
  const exd = D("2025-04-24");
  const tx = [
    { t: "A", ty: "BUY", q: 100, d: D("2025-01-10") },
    { t: "A", ty: "BUY", q: 50, d: exd },           // koop op ex-datum: geen recht
    { t: "A", ty: "SELL", q: 30, d: exd },          // verkoop op ex-datum: recht blijft
    { t: "B", ty: "BUY", q: 999, d: D("2025-01-01") },
  ];
  assert.equal(qtyEntitled(tx, "A", exd), 100);
  assert.equal(qtyEntitled(tx, "A", exd + DAY), 120);
});

test("splitAdjust laat een echte crash staan en corrigeert alleen de split", () => {
  const rows = [
    { date: "2022-07-04", close: 2000, adjusted_close: 100 },
    { date: "2022-07-11", close: 2020, adjusted_close: 101 },
    { date: "2022-07-18", close: 102, adjusted_close: 102 },
    { date: "2022-07-25", close: 30, adjusted_close: 30 },
  ];
  assert.deepEqual(splitAdjust(rows).map((r) => r[1]), [100, 101, 102, 30]);
});
