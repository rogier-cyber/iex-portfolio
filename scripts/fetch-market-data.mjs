// Haalt een snapshot van echte marktdata op en schrijft public/data/snapshot.json.
// Gebruik: EODHD_API_KEY=... node scripts/fetch-market-data.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { loadMarketData } from "../lib/market-data.js";

const data = await loadMarketData();
if (!data) { console.error("Zet eerst EODHD_API_KEY."); process.exit(1); }
await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/data/snapshot.json", import.meta.url), JSON.stringify(data));
const n = Object.values(data.instruments).filter((i) => i.prices.length).length;
console.log(`Snapshot geschreven: ${n} instrumenten met koersen, ${data.news.length} nieuwsberichten.`);
