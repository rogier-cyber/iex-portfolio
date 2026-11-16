// Transacties van leidinggevenden buiten Nederland (MAR 19 en Zwitserse tegenhanger).
// - Zwitserland: SIX Exchange Regulation (SER), JSON-overzicht van "management transactions"; gekoppeld op ISIN.
// - Frankrijk: AMF BDIF, déclarations des dirigeants (type DD); gekoppeld op naam. Bedragen staan in de pdf, niet in de lijst.
// Veldnamen worden ruim herkend, zodat een kleine wijziging aan de kant van de bron niet alles breekt.
import { afmDate } from "./afm.js";

export const SER_ISSUERS = { NESN: "CH0038863350" };
export const AMF_ISSUERS = { MC: { q: "LVMH", names: ["lvmh", "moet hennessy", "moët hennessy"] } };

const UA = { "User-Agent": "Mozilla/5.0 (portefeuille-kompas)", Accept: "application/json,text/plain,*/*" };
const day = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const pick = (o, re) => { const k = Object.keys(o).find((k) => re.test(k)); return k ? o[k] : undefined; };
export function euDate(v) {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e11 ? new Date(v).toISOString().slice(0, 10) : null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return afmDate(s);
}
const side = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (/^(b|buy|purchase|p|kauf|acquisition|achat|acquisto)$|purchase|acquisition|achat|kauf\b/.test(s)) return "P";
  if (/^(s|sell|sale|v|verkauf|disposal|vente|cession)$|sale|disposal|cession|verkauf|vente/.test(s)) return "S";
  return null;
};

export function parseSer(json, isins = SER_ISSUERS) {
  const items = Array.isArray(json?.itemList) ? json.itemList : [];
  const byIsin = Object.fromEntries(Object.entries(isins).map(([t, i]) => [i, t]));
  const byTicker = {};
  for (const it of items) {
    const t = byIsin[String(it.ISIN || it.isin || "").toUpperCase()];
    if (!t) continue;
    const date = euDate(pick(it, /^transactionDate$/i) ?? pick(it, /transaction.*date/i) ?? pick(it, /date/i));
    if (!date) continue;
    const kind = side(pick(it, /buy.?sell|purchase.?sale|transactionType|natureOfTransaction|transactionCode/i));
    const rel = /^(t|true|y|1)$/i.test(String(it.obligorRelatedPartyInd || ""));
    const fn = String(it.obligorFunctionCode ?? "");
    (byTicker[t] = byTicker[t] || []).push({
      date, filed: euDate(pick(it, /publication|notification.*date|submission/i)), name: rel ? "Nauw gelieerde persoon" : "Leidinggevende",
      role: fn === "1" ? "Directie" : fn === "2" ? "Raad van bestuur" : fn ? "Bestuurder" : null,
      type: kind ? (kind === "P" ? "P-Koop" : "S-Verkoop") : "J-Melding",
      shares: Number(it.transactionSize) || null, price: Number(it.transactionAmountPerSecurityCHF) || null, unit: "CHF",
      instrument: pick(it, /securityType|instrument/i) || null, option: false, source: "SIX",
    });
  }
  return { total: Number(json?.totalCount) || items.length, items: items.length, byTicker };
}

export async function loadSer({ fetchImpl = fetch, days = 365, pageSize = 100, maxPages = 30, now = new Date() } = {}) {
  const status = { source: "SIX SER", ok: false, rows: 0, matched: 0, error: null };
  const from = new Date(now.getTime() - days * 864e5);
  const out = {};
  try {
    for (let p = 0; p < maxPages; p++) {
      const url = `https://www.ser-ag.com/sheldon/management_transactions/v1/overview.json?pageSize=${pageSize}&pageNumber=${p}&sortAttribute=byDate&fromDate=${day(from)}&toDate=${day(now)}`;
      const res = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = JSON.parse(await res.text());
      const r = parseSer(j);
      status.rows += r.items;
      for (const [t, rows] of Object.entries(r.byTicker)) (out[t] = out[t] || []).push(...rows);
      if (!r.items || status.rows >= r.total) break;
    }
    status.matched = Object.values(out).reduce((a, v) => a + v.length, 0);
    status.ok = status.rows > 0;
    if (!status.ok) status.error = "geen meldingen in het antwoord";
  } catch (e) { status.error = e.message; }
  return { status, byTicker: out };
}

// AMF: zoek de grootste lijst met objecten die een datum hebben
function findRecords(node, best = { arr: [] }) {
  if (Array.isArray(node)) {
    const objs = node.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    if (objs.length > best.arr.length && objs.some((o) => JSON.stringify(o).match(/"\w*date\w*"\s*:/i))) best.arr = objs;
    node.forEach((x) => findRecords(x, best));
  } else if (node && typeof node === "object") Object.values(node).forEach((x) => findRecords(x, best));
  return best.arr;
}
const deepPick = (o, re, depth = 0) => {
  if (!o || typeof o !== "object" || depth > 3) return undefined;
  for (const [k, v] of Object.entries(o)) if (re.test(k) && (typeof v === "string" || typeof v === "number")) return v;
  for (const v of Object.values(o)) { const r = deepPick(Array.isArray(v) ? v[0] : v, re, depth + 1); if (r !== undefined) return r; }
  return undefined;
};
export function parseAmf(json, ticker = "MC", names = AMF_ISSUERS.MC.names) {
  const recs = findRecords(json).map((r) => r._source || r);
  const rows = [];
  for (const r of recs) {
    const blob = JSON.stringify(r).toLowerCase();
    if (!names.some((n) => blob.includes(n))) continue;
    const date = euDate(deepPick(r, /^date(Information|Publication|Operation|Diffusion)?$/i) ?? deepPick(r, /date/i));
    if (!date) continue;
    const title = deepPick(r, /^(titre|title|libelle|objet|intitule)$/i) || deepPick(r, /titre|title|libelle/i) || null;
    const path = deepPick(r, /^(path|url|lien|link|fichier|nomFichier)$/i);
    const num = deepPick(r, /^(numero|numeroInformation|id|identifiant)$/i);
    const t = String(title || "").toLowerCase();
    rows.push({
      date, filed: null, name: title ? String(title).slice(0, 140) : "Déclaration des dirigeants", role: null,
      type: /acquisition|achat|souscription/.test(t) ? "P-Koop" : /cession|vente/.test(t) ? "S-Verkoop" : "J-Melding",
      shares: null, price: null, unit: null, instrument: null, option: false, source: "AMF",
      url: path ? (/^https?:/.test(path) ? path : `https://bdif.amf-france.org/back/api/v1/documents/${String(path).replace(/^\//, "")}`) : num ? `https://bdif.amf-france.org/fr/details/${num}` : null,
    });
  }
  return { records: recs.length, byTicker: rows.length ? { [ticker]: rows } : {} };
}

export async function loadAmf({ fetchImpl = fetch, issuers = AMF_ISSUERS } = {}) {
  const status = { source: "AMF BDIF", ok: false, rows: 0, matched: 0, error: null };
  const out = {};
  try {
    for (const [t, cfg] of Object.entries(issuers)) {
      const url = `https://bdif.amf-france.org/back/api/v1/informations?typesInformation=DD&rechercheTexte=${encodeURIComponent(cfg.q)}&from=0&size=100`;
      const res = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = parseAmf(JSON.parse(await res.text()), t, cfg.names);
      status.rows += r.records;
      if (r.byTicker[t]) out[t] = r.byTicker[t];
    }
    status.matched = Object.values(out).reduce((a, v) => a + v.length, 0);
    status.ok = status.rows > 0;
    if (!status.ok) status.error = "geen meldingen herkend";
  } catch (e) { status.error = e.message; }
  return { status, byTicker: out };
}
