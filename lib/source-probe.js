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
    } catch (e) { r.error = e.message; }
    return r;
  }));
  cache = { t: Date.now(), v: { at: new Date().toISOString(), results: out } };
  return cache.v;
}
