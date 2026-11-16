// Bronnentest: haalt de openbare registers voor transacties van leidinggevenden op vanaf de server
// en laat per bron zien wat er terugkomt (status, type, grootte, begin van de inhoud).
// Zo zien we vanaf de live server welke bron bruikbaar is, zonder sleutels of persoonsgegevens.
const AFM = "https://www.afm.nl/export.aspx?type=0ee836dc-5520-459d-bcf4-a4a689de6614";
const day = (d) => d.toISOString().slice(0, 10);
export function probeTargets(now = new Date()) {
  const from = new Date(now.getTime() - 90 * 864e5);
  return [
    { id: "afm-csv", land: "NL", url: `${AFM}&format=csv` },
    { id: "afm-xml", land: "NL", url: `${AFM}&format=xml` },
    { id: "afm-register", land: "NL", url: "https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/transacties-leidinggevenden-mar19-" },
    { id: "bafin-sap", land: "DE", url: "https://portal.mvp.bafin.de/database/DealingsInfo/sucheForm.do?meldepflichtigerName=&zeitraum=0&d-4000784-e=1&emittentButton=Suche+Emittent&emittentName=&zeitraumVon=&emittentIsin=DE0007164600&zeitraumBis=&6578706f7274=1" },
    { id: "ser-nestle", land: "CH", url: `https://www.ser-ag.com/sheldon/management_transactions/v1/overview.json?pageSize=20&pageNumber=0&sortAttribute=byDate&fromDate=${day(from).replace(/-/g, "")}&toDate=${day(now).replace(/-/g, "")}` },
    { id: "amf-lvmh", land: "FR", url: "https://bdif.amf-france.org/back/api/v1/informations?typesInformation=DD&rechercheTexte=LVMH&from=0&size=20" },
    { id: "dfsa-novo", land: "DK", url: "https://oam.finanstilsynet.dk/" },
    { id: "fsma-list", land: "BE", url: "https://www.fsma.be/en/transaction-search" },
  ];
}
let cache = null;
export async function probeSources({ fetchImpl = fetch } = {}) {
  if (cache && Date.now() - cache.t < 10 * 60e3) return cache.v;
  const out = await Promise.all(probeTargets().map(async (t) => {
    const r = { ...t, ok: false };
    try {
      const res = await fetchImpl(t.url, { headers: { "User-Agent": "Mozilla/5.0 (portefeuille-kompas bronnentest)", Accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
      const buf = new Uint8Array(await res.arrayBuffer());
      Object.assign(r, {
        status: res.status, ok: res.ok, type: res.headers.get("content-type"), bytes: buf.length, finalUrl: res.url !== t.url ? res.url : undefined,
        hex: Array.from(buf.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join(" "),
        start: new TextDecoder("utf-8").decode(buf.subarray(0, 400)).replace(/\s+/g, " ").trim(),
      });
      if (t.id === "afm-xml") { const txt = new TextDecoder("utf-8").decode(buf.subarray(0, 20000)); const m = txt.match(/<vermelding[^>]*>[\s\S]*?<\/vermelding>/i); r.firstRecord = m ? m[0].replace(/></g, ">\n<").split("\n") : null; }
      if (t.id === "ser-nestle" || t.id === "amf-lvmh") { try { const j = JSON.parse(new TextDecoder("utf-8").decode(buf)); r.keys = Object.keys(j); const first = t.id === "ser-nestle" ? j.itemList?.[0] : (j.hits?.hits?.[0] || j.hits?.[0] || j.informations?.[0] || j.content?.[0] || j.results?.[0] || j.data?.[0]); r.firstItem = first ? JSON.stringify(first).slice(0, 2500) : null; } catch (e) { r.parseError = e.message; } }
      if (/html/i.test(r.type || "")) { const html = new TextDecoder("utf-8").decode(buf); r.title = (html.match(/<title>([^<]*)/i) || [])[1]?.trim(); r.links = [...new Set([...html.matchAll(/(?:href|src|action|data-url|data-src)=["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /export|csv|xls|json|api|download|leidinggevend|dirigeant|manager|transact|mar.?19|stori/i.test(u)))].slice(0, 40); }
      if (t.id === "afm-csv") { const txt = new TextDecoder("utf-8").decode(buf.subarray(0, 4000)); r.firstLines = txt.split(/\r?\n/).slice(0, 3); }
    } catch (e) { r.error = e.message; }
    return r;
  }));
  let afm = null;
  try {
    const { loadAfm } = await import("./afm.js");
    const a = await loadAfm({ fetchImpl });
    afm = { status: a.status, perTicker: Object.fromEntries(Object.entries(a.byTicker).map(([k, v]) => [k, v.length])), sample: Object.values(a.byTicker).flat().sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 5) };
  } catch (e) { afm = { error: e.message }; }
  let eu = null;
  try {
    const { loadSer, loadAmf } = await import("./eu-insiders.js");
    const { loadFsma } = await import("./fsma.js");
    const [ser, amf, fsma] = await Promise.all([loadSer({ fetchImpl, maxPages: 3 }), loadAmf({ fetchImpl }), loadFsma({ fetchImpl, maxDetails: 3 })]);
    eu = { fsma: { status: fsma.status, sample: Object.values(fsma.byTicker).flat().slice(0, 3) }, ser: { status: ser.status, sample: Object.values(ser.byTicker).flat().slice(0, 3) }, amf: { status: amf.status, sample: Object.values(amf.byTicker).flat().slice(0, 3) } };
  } catch (e) { eu = { error: e.message }; }
  cache = { t: Date.now(), v: { at: new Date().toISOString(), afm, eu, results: out } };
  return cache.v;
}
