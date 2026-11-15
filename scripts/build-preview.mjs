// Bouwt één zelfstandig HTML-bestand (voor een preview zonder server) uit public/.
// Gebruik: node scripts/build-preview.mjs <uitvoerpad>
import { readFile, writeFile } from "node:fs/promises";
const r = (p) => readFile(new URL(`../public/${p}`, import.meta.url), "utf8");
const [html, css, data, app] = await Promise.all([r("index.html"), r("css/app.css"), r("js/data/mock-portfolio.js"), r("js/app.js")]);
const js = data.replace(/^export /gm, "") + "\n" + app.replace(/^import .*$/m, "");
const body = html.split("<body>")[1].split("</body>")[0];
const out = `<title>Portefeuille Kompas</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js"></script>
<style>
${css}</style>
${body}
<script type="module">
${js}</script>
`;
await writeFile(process.argv[2] || "preview.html", out);
console.log("Preview geschreven:", process.argv[2] || "preview.html");
