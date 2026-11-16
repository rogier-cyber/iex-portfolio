// België: FSMA, "transacties van leidinggevenden". Er is geen export; we lezen de openbare lijst
// (https://www.fsma.be/en/transaction-search) en per melding de detailpagina met aantal, prijs en soort.
import { afmDate, afmNum } from "./afm.js";

export const FSMA_ISSUERS = { KBC: { isin: "BE0003565737", names: ["kbc"] } };
const BASE = "https://www.fsma.be";
const UA = { "User-Agent": "Mozilla/5.0 (portefeuille-kompas)", Accept: "text/html,*/*" };
const text = (h) => String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p|td|th|li|tr|h\d|dt|dd|span|label)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const lines = (h) => text(h).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

// keuzelijst met uitgevende instellingen: <option value="123">KBC GROUP</option>
export function parseIssuerOptions(html) {
  return [...html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/gi)].map((m) => ({ id: m[1], name: m[2].trim() })).filter((o) => o.id && !/^all$|^-/i.test(o.id));
}
// regels uit de lijst: datum, uitgevende instelling (met link), melder
export function parseList(html) {
  const out = [];
  for (const tr of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const row = tr[0];
    const a = row.match(/href="([^"]*manager-transaction\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => lines(m[1]).join(" "));
    const date = cells.map(afmDate).find(Boolean);
    const issuer = lines(a[2]).join(" ");
    const person = cells.find((c) => c && c !== issuer && !afmDate(c)) || null;
    out.push({ href: a[1].startsWith("http") ? a[1] : BASE + a[1], issuer, person, date });
  }
  return out;
}
const LABELS = {
  person: /^(notifying person|meldingsplichtige|personne)/i, role: /^(declarer type|type melder|type de déclarant)/i, isin: /isin/i,
  kind: /^(transaction type|soort transactie|type de transaction|aard)/i, date: /^(transaction date|transactiedatum|date de (la )?transaction)/i,
  ccy: /currency|munt|devise/i, qty: /quantity|hoeveelheid|aantal|quantité/i, price: /^(transaction price|prijs|prix)/i, instrument: /^(instrument type|type instrument|type d'instrument)/i,
};
export function parseDetail(html) {
  const L = lines(html);
  const r = {};
  for (let i = 0; i < L.length - 1; i++) for (const [k, re] of Object.entries(LABELS)) {
    if (r[k] === undefined && re.test(L[i]) && L[i].length < 60 && !(k === "kind" && /specification/i.test(L[i]))) r[k] = L[i + 1];
  }
  return r;
}
const side = (s) => (/purchase|acquisition|aankoop|verwerving|achat/i.test(s || "") ? "P-Koop" : /sale|disposal|verkoop|vervreemding|cession|vente/i.test(s || "") ? "S-Verkoop" : /grant|toekenning|attribution/i.test(s || "") ? "A-Toekenning" : /exercise|uitoefening/i.test(s || "") ? "M-Uitoefening" : "J-Melding");

export async function loadFsma({ fetchImpl = fetch, issuers = FSMA_ISSUERS, maxDetails = 25 } = {}) {
  const status = { source: "FSMA", ok: false, rows: 0, matched: 0, error: null };
  const byTicker = {};
  const get = async (u) => { const res = await fetchImpl(u, { headers: UA, signal: AbortSignal.timeout(25000) }); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); };
  try {
    const first = await get(`${BASE}/en/transaction-search`);
    const opts = parseIssuerOptions(first);
    status.rows = parseList(first).length;
    for (const [t, cfg] of Object.entries(issuers)) {
      const opt = opts.find((o) => cfg.names.some((n) => o.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(n)));
      let list = [];
      if (opt) list = parseList(await get(`${BASE}/en/transaction-search?issuer=${encodeURIComponent(opt.id)}&order=field_ct_date_time&sort=desc`));
      const mine = (r) => cfg.names.some((n) => r.issuer.toLowerCase().replace(/[^a-z0-9]/g, "").includes(n));
      list = list.filter(mine);
      if (!list.length) list = parseList(first).filter(mine);
      const rows = [];
      for (const it of list.slice(0, maxDetails)) {
        let d = {};
        try { d = parseDetail(await get(it.href)); } catch {}
        if (d.isin && cfg.isin && d.isin.replace(/\s/g, "").toUpperCase() !== cfg.isin) { if (!/share|aandeel|action/i.test(d.instrument || "")) continue; }
        rows.push({ date: afmDate(d.date) || it.date, filed: it.date, name: d.person || it.person, role: d.role || null, type: side(d.kind), shares: afmNum(d.qty), price: afmNum(d.price), unit: d.ccy || null,
          instrument: d.instrument || null, option: false, source: "FSMA", url: it.href });
      }
      if (rows.length) byTicker[t] = rows.filter((r) => r.date);
    }
    status.matched = Object.values(byTicker).reduce((a, v) => a + v.length, 0);
    status.ok = status.rows > 0 || status.matched > 0;
    if (!status.ok) status.error = "lijst niet herkend";
  } catch (e) { status.error = e.message; }
  return { status, byTicker };
}
