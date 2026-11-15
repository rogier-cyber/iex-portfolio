// Kleine Node-server zonder dependencies: serveert /public, ECharts uit node_modules
// en een healthcheck voor Render. In fase 2 komen hier de API-routes bij
// (portefeuilles, transacties, brokerkoppeling, login).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketData } from "./lib/market-data.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = resolve(ROOT, "public");
const PORT = Number(process.env.PORT) || 3000;

// Marktdata: met EODHD_API_KEY live ophalen en 6 uur cachen, anders snapshot.json of 404 (dan voorbeelddata)
const TTL = 6 * 3600e3;
let market = { data: null, at: 0, pending: null };
async function marketData() {
  const fresh = market.data && Date.now() - market.at < TTL;
  if (fresh) return market.data;
  if (!market.pending) {
    market.pending = loadMarketData()
      .then((d) => { if (d) market = { data: d, at: Date.now(), pending: null }; else market.pending = null; return d; })
      .catch((e) => { console.error("Marktdata ophalen mislukt:", e.message); market.pending = null; return null; });
  }
  return market.data || market.pending; // oude data direct tonen terwijl er ververst wordt
}

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
  ".ico": "image/x-icon",
};

async function sendFile(res, file, cache) {
  const body = await readFile(file);
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] || "application/octet-stream",
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);

  if (path === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, version: process.env.RENDER_GIT_COMMIT || "dev" }));
  }

  if (path === "/api/market") {
    let data = process.env.EODHD_API_KEY ? await marketData() : null;
    if (!data) data = await readFile(join(PUBLIC, "data/snapshot.json"), "utf8").then(JSON.parse).catch(() => null);
    if (!data) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end('{"source":null}'); }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600" });
    return res.end(JSON.stringify(data));
  }

  try {
    if (ROUTES[path]) return await sendFile(res, ROUTES[path], "public, max-age=604800, immutable");

    const target = normalize(join(PUBLIC, path === "/" ? "index.html" : path));
    if (!target.startsWith(PUBLIC)) throw Object.assign(new Error("forbidden"), { code: "ENOENT" });
    const info = await stat(target);
    if (info.isDirectory()) return await sendFile(res, join(target, "index.html"), "no-cache");
    return await sendFile(res, target, target.endsWith(".html") ? "no-cache" : "public, max-age=300");
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") {
      // Onbekend pad: toon de app (weergaven werken met #hash)
      return sendFile(res, join(PUBLIC, "index.html"), "no-cache").catch(() => {
        res.writeHead(404); res.end("Niet gevonden");
      });
    }
    console.error(err);
    res.writeHead(500); res.end("Serverfout");
  }
});

server.listen(PORT, () => console.log(`Portefeuille Kompas draait op http://localhost:${PORT}`));
