// Kleine Node-server zonder dependencies: serveert /public, ECharts uit node_modules
// en een healthcheck voor Render. In fase 2 komen hier de API-routes bij
// (portefeuilles, transacties, brokerkoppeling, login).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { loadMarketData, loadInsiders, mergeInsiders } from "./lib/market-data.js";
import { probeSources } from "./lib/source-probe.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = resolve(ROOT, "public");
const PORT = Number(process.env.PORT) || 3000;

// Marktdata: met EODHD_API_KEY live ophalen en 6 uur cachen, anders snapshot.json of 404 (dan voorbeelddata)
const TTL = 6 * 3600e3;
// Een kleine cache met "oude data direct tonen, op de achtergrond verversen"
function cached(load, ttl, label) {
  let st = { data: null, at: 0, pending: null };
  return () => {
    if (st.data && Date.now() - st.at < ttl) return st.data;
    if (!st.pending) {
      const t0 = Date.now();
      st.pending = load()
        .then((d) => { if (d) st = { data: d, at: Date.now(), pending: null }; else st.pending = null; console.log(`${label} geladen in ${Date.now() - t0} ms`); return d; })
        .catch((e) => { console.error(`${label} ophalen mislukt:`, e.message); st.pending = null; return null; });
    }
    return st.data || st.pending;
  };
}
const marketData = cached(() => loadMarketData(undefined, undefined, { withInsiders: false }), TTL, "Marktdata");
const insiderData = cached(() => loadInsiders(), TTL, "Insiders");
const peek = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
let marketGz = { src: null, gz: null };
// Direct bij het opstarten alvast ophalen, zodat de eerste bezoeker niet hoeft te wachten
if (process.env.EODHD_API_KEY) { marketData(); insiderData(); }

const ROUTES = {
  "/vendor/echarts.min.js": join(ROOT, "node_modules/echarts/dist/echarts.min.js"),
};
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

// gzip voor tekst (html, js, css, json, svg); gecomprimeerde bestanden blijven in het geheugen
const gzCache = new Map();
const wantsGzip = (req) => /\bgzip\b/.test(req?.headers?.["accept-encoding"] || "");
const textual = (type) => /text|javascript|json|svg/.test(type);
async function sendFile(res, file, cache, req) {
  const type = TYPES[extname(file)] || "application/octet-stream";
  const head = { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff", Vary: "Accept-Encoding" };
  if (textual(type) && wantsGzip(req)) {
    const info = await stat(file);
    const key = file + ":" + info.mtimeMs;
    let gz = gzCache.get(key);
    if (!gz) { gz = gzipSync(await readFile(file), { level: 9 }); gzCache.set(key, gz); }
    res.writeHead(200, { ...head, "Content-Encoding": "gzip", "Content-Length": gz.length });
    return res.end(gz);
  }
  const body = await readFile(file);
  res.writeHead(200, head);
  res.end(body);
}
function sendJson(req, res, data, cache) {
  const head = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, Vary: "Accept-Encoding" };
  if (!wantsGzip(req)) { res.writeHead(200, head); return res.end(JSON.stringify(data)); }
  if (marketGz.src !== data) marketGz = { src: data, gz: gzipSync(JSON.stringify(data), { level: 6 }) };
  res.writeHead(200, { ...head, "Content-Encoding": "gzip", "Content-Length": marketGz.gz.length });
  return res.end(marketGz.gz);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);

  if (path === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, version: process.env.RENDER_GIT_COMMIT || "dev" }));
  }

  if (path === "/api/bronnentest") {
    const r = await probeSources();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify(r, null, 2));
  }

  if (path === "/api/market") {
    let data = process.env.EODHD_API_KEY ? await marketData() : null;
    if (!data) data = await readFile(join(PUBLIC, "data/snapshot.json"), "utf8").then(JSON.parse).catch(() => null);
    if (!data) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end('{"source":null}'); }
    if (process.env.EODHD_API_KEY) {
      const ins = await peek(Promise.resolve(insiderData()), 50);
      data = ins ? mergeInsiders(data, ins) : { ...data, insidersPending: true };
    }
    return sendJson(req, res, data, "public, max-age=600");
  }

  if (path === "/api/insiders") {
    const ins = process.env.EODHD_API_KEY ? await peek(Promise.resolve(insiderData()), 90000) : null;
    if (!ins) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end('{"sources":[]}'); }
    return sendJson(req, res, ins, "public, max-age=600");
  }

  try {
    if (ROUTES[path]) return await sendFile(res, ROUTES[path], "public, max-age=604800, immutable", req);

    const target = normalize(join(PUBLIC, path === "/" ? "index.html" : path));
    if (!target.startsWith(PUBLIC)) throw Object.assign(new Error("forbidden"), { code: "ENOENT" });
    const info = await stat(target);
    if (info.isDirectory()) return await sendFile(res, join(target, "index.html"), "no-cache", req);
    return await sendFile(res, target, target.endsWith(".html") ? "no-cache" : /\/(logos|brand)\/|favicon|apple-touch|icon-\d+\.png|site\.webmanifest/.test(target) ? "public, max-age=604800" : "public, max-age=300", req);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") {
      // Onbekend pad: toon de app (weergaven werken met #hash)
      return sendFile(res, join(PUBLIC, "index.html"), "no-cache", req).catch(() => {
        res.writeHead(404); res.end("Niet gevonden");
      });
    }
    console.error(err);
    res.writeHead(500); res.end("Serverfout");
  }
});

server.listen(PORT, () => console.log(`Portefeuille Kompas draait op http://localhost:${PORT}`));
