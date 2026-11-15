// AFM-register "Transacties leidinggevenden (MAR 19)": meldingen van bestuurders, commissarissen
// en nauw gelieerde personen bij Nederlandse uitgevende instellingen.
// Bron: https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/transacties-leidinggevenden-mar19-
// De export (CSV, met XML als reserve) wordt op de server opgehaald en gekoppeld op ISIN, met de naam van de
// uitgevende instelling als reserve. Kolommen worden op naam herkend, zodat een andere volgorde niet uitmaakt.

const EXPORT = "https://www.afm.nl/export.aspx?type=0ee836dc-5520-459d-bcf4-a4a689de6614&format=";

// Ticker → ISIN en (delen van) de naam zoals die in het register staat
export const AFM_ISSUERS = {
  ASML: { isin: "NL0010273215", names: ["asml holding"] },
  ASM: { isin: "NL0000334118", names: ["asm international"] },
  BESI: { isin: "NL0012866412", names: ["be semiconductor"] },
  ADYEN: { isin: "NL0012969182", names: ["adyen"] },
  INGA: { isin: "NL0011821202", names: ["ing groep"] },
  NN: { isin: "NL0010773842", names: ["nn group"] },
  AD: { isin: "NL0011794037", names: ["ahold delhaize"] },
  HEIA: { isin: "NL0000009165", names: ["heineken n.v", "heineken nv"] },
  WKL: { isin: "NL0000395903", names: ["wolters kluwer"] },
  PRX: { isin: "NL0013654783", names: ["prosus"] },
  KPN: { isin: "NL0000009082", names: ["koninklijke kpn"] },
  PHIA: { isin: "NL0000009538", names: ["koninklijke philips"] },
};

const MONTHS = { jan: 1, feb: 2, mrt: 3, maa: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };
export function afmDate(v) {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})/i);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
// Nederlandse en Engelse notatie: "66.145,00", "66,145.00", "8,00", "8.5"
export function afmNum(v) {
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const c = s.lastIndexOf(","), d = s.lastIndexOf(".");
  if (c > d) s = s.replace(/\./g, "").replace(",", ".");
  else if (d > c && c >= 0) s = s.replace(/,/g, "");
  else if (c < 0 && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function decode(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  if (b.length > 3 && b[1] === 0 && b[3] === 0) return new TextDecoder("utf-16le").decode(b);
  let t = new TextDecoder("utf-8").decode(b);
  if (t.includes("�")) t = new TextDecoder("windows-1252").decode(b);
  return t.replace(/^﻿/, "");
}

export function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0];
  const delim = [";", "\t", ","].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

// XML-reserve: zoek het herhalende element en lees de kindvelden
export function parseXml(text) {
  const counts = {};
  for (const m of text.matchAll(/<([A-Za-z_][\w.-]*)[\s>]/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  const cand = Object.entries(counts).filter(([, n]) => n > 1).map(([tag]) => tag);
  let best = null;
  for (const tag of cand) {
    const blocks = [...text.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
    const withKids = blocks.filter((b) => /<([\w.-]+)[^>]*>[^<]*<\/\1>/.test(b));
    if (withKids.length > 1 && (!best || withKids.length > best.blocks.length || (withKids.length === best.blocks.length && withKids[0].length > best.blocks[0].length))) best = { tag, blocks: withKids };
  }
  if (!best) return [];
  const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
  const recs = best.blocks.map((b) => Object.fromEntries([...b.matchAll(/<([\w.-]+)[^>]*>([^<]*)<\/\1>/g)].map((m) => [m[1], unesc(m[2])])));
  const keys = [...new Set(recs.flatMap((r) => Object.keys(r)))];
  return [keys, ...recs.map((r) => keys.map((k) => r[k] ?? ""))];
}

const COLS = {
  date: /transactiedatum|transaction ?date|^transactie$|^datum$|^date$/i,
  issuer: /uitgevende|issuer|instelling/i,
  person: /meldingsplichtige|notif|person ?discharging|^naam$|^name$/i,
  related: /gelieerd|closely/i,
  role: /positie|functie|position/i,
  instrument: /type ?instrument|instrument/i,
  isin: /isin/i,
  nature: /aard|nature/i,
  kind: /soort ?transactie|transaction ?type|^soort$/i,
  option: /optie ?programma|option/i,
  venue: /plaats|venue/i,
  price: /prijs|price/i,
  qty: /aantal|volume|quantity/i,
  unit: /eenheid|valuta|currency|unit/i,
};
function mapHeader(h) {
  const idx = {};
  h.forEach((name, i) => {
    const n = String(name).trim();
    for (const [k, re] of Object.entries(COLS)) if (idx[k] === undefined && re.test(n)) { idx[k] = i; break; }
  });
  return idx;
}
const txType = (nature, kind) => {
  const s = `${kind || ""} ${nature || ""}`.toLowerCase();
  if (/verkoop|vervreemding|sale|disposal|sell/.test(s)) return "S-Verkoop";
  if (/aankoop|koop|verwerving|purchase|acquisition|buy/.test(s)) return "P-Koop";
  if (/toekenning|grant|award/.test(s)) return "A-Toekenning";
  if (/uitoefen|exercise/.test(s)) return "M-Uitoefening";
  return `J-${kind || nature || "Overig"}`;
};

export function toTransactions(rows, issuers = AFM_ISSUERS) {
  if (!rows.length) return { header: [], rows: 0, byTicker: {} };
  const header = rows[0].map((c) => String(c).trim());
  const idx = mapHeader(header);
  const byIsin = Object.fromEntries(Object.entries(issuers).map(([t, v]) => [v.isin, t]));
  const byTicker = {};
  const get = (r, k) => (idx[k] !== undefined ? String(r[idx[k]] ?? "").trim() : "");
  for (const r of rows.slice(1)) {
    const isin = get(r, "isin").toUpperCase();
    const issuer = get(r, "issuer").toLowerCase();
    let t = byIsin[isin];
    if (!t && issuer) t = Object.keys(issuers).find((k) => issuers[k].names.some((n) => issuer.includes(n)));
    if (!t) continue;
    const date = afmDate(get(r, "date"));
    if (!date) continue;
    const qty = afmNum(get(r, "qty")), price = afmNum(get(r, "price"));
    const person = get(r, "person"), related = get(r, "related");
    (byTicker[t] = byTicker[t] || []).push({
      date, filed: null, name: related ? `${person} (gelieerd aan ${related})` : person || null, role: get(r, "role") || null,
      type: txType(get(r, "nature"), get(r, "kind")), shares: qty, price, unit: get(r, "unit") || null,
      instrument: get(r, "instrument") || null, option: /^ja|yes/i.test(get(r, "option")), source: "AFM",
    });
  }
  return { header, idx, rows: rows.length - 1, byTicker };
}

export async function loadAfm({ fetchImpl = fetch } = {}) {
  const status = { source: "AFM MAR 19", ok: false, rows: 0, matched: 0, header: null, error: null, format: null };
  for (const format of ["csv", "xml"]) {
    try {
      const res = await fetchImpl(EXPORT + format, { headers: { "User-Agent": "Mozilla/5.0 (portefeuille-kompas)", Accept: "text/csv,application/xml,text/plain,*/*" }, signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = decode(await res.arrayBuffer());
      const rows = format === "csv" ? parseCsv(text) : parseXml(text);
      const out = toTransactions(rows);
      if (!out.rows || out.idx.date === undefined) throw new Error(`${format}: ${out.rows} rijen, kolommen niet herkend (${(out.header || []).slice(0, 8).join(" | ") || text.slice(0, 80)})`);
      for (const t of Object.keys(out.byTicker)) out.byTicker[t].sort((a, b) => (a.date < b.date ? 1 : -1));
      Object.assign(status, { ok: true, format, rows: out.rows, header: out.header, matched: Object.values(out.byTicker).reduce((a, v) => a + v.length, 0), error: null });
      return { status, byTicker: out.byTicker };
    } catch (e) {
      status.error = (status.error ? status.error + " · " : "") + `${format}: ${e.message}`;
    }
  }
  return { status, byTicker: {} };
}
