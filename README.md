# Portefeuille Kompas (IEX Portfolio)

Portefeuilletool voor IEX.nl. **Fase 1**: alle visualisaties en het datamodel. Met een EODHD-key draait de
demoportefeuille op echte koersen, dividenden, kerncijfers en indices; zonder key op voorbeelddata.
Brokerkoppeling en login volgen in fase 2.

Live: <https://iex-portfolio.onrender.com>

## Weergaven

| Weergave | Wat je ziet |
|---|---|
| Overzicht | Waarde vs inleg of rendement vs AEX, kompasscore, kerncijfers, portefeuillekaart (treemap), signalen, posities met detailpaneel |
| Analyse | Score per kenmerk met de 6 onderliggende checks per positie, posities op één lijn t.o.v. portefeuille en AEX, spreiding sector → branche → positie, omzet per regio, valuta, correlatiematrix, risico (volatiliteit, drawdown, bèta, Sharpe, Sortino) |
| Waardering | Koers t.o.v. reële waarde per positie, opwaarts potentieel |
| Dividend | Ontvangen en verwacht dividend per maand/jaar, bijdrage per positie, rendement op inleg, box 3-indicatie met tegenbewijs, verrekenbare bronbelasting, kalender |
| Rendement | Waterval (koers, valuta, gerealiseerd, dividend, bronbelasting, kosten), bijdrage per positie, rendementsrapport, transacties |
| Vergelijken | Benchmark naar keuze (AEX, AMX, MSCI World, S&P 500 in euro, Euro Stoxx 50), schaduwportefeuille met dezelfde stortingen, IRR/TWR/alfa/bèta, voorsprong, drawdown, kalenderjaren, sectorweging vs AEX, maandrendementen |
| Nieuws | Voorbeeldfeed per positie en categorie |
| Datamodel | De tabellen die in fase 2 in de database komen |

## Lokaal draaien

```bash
npm install
npm run dev     # http://localhost:3000
```

Node 20 of nieuwer. De server (`server.js`) heeft geen dependencies; ECharts komt uit `node_modules`.

## Databronnen

| Variabele | Bron | Gebruikt voor |
|---|---|---|
| `EODHD_API_KEY` | [EODHD](https://eodhd.com) | Weekkoersen sinds 2019, actuele koers, dividenden, indices (AEX, AMX, S&P 500, Euro Stoxx 50), MSCI World-ETF, EUR/USD, nieuws, kerncijfers |
| `FMP_API_KEY` (optioneel) | [Financial Modeling Prep](https://financialmodelingprep.com) | Aanvulling: K/W, ROE, schuld/EV, uitkeringsratio, koersdoel en oordeel van analisten, verwachte winstgroei |

De server haalt alles op bij de eerste aanvraag en bewaart het 6 uur (`/api/market`). Zonder keys valt de app terug op
voorbeelddata. Een snapshot maken kan ook lokaal: `EODHD_API_KEY=... node scripts/fetch-market-data.mjs`.
`node test/fake-providers.mjs` test de verwerking met nagebootste API-antwoorden.

De kompasscore wordt berekend uit 6 checks per kenmerk (zie `checks()` in `app.js`), niet handmatig ingevuld.

## Structuur

```
server.js                     Node-server: statische bestanden, /api/market, /vendor/echarts.min.js, /healthz
lib/market-data.js            Ophalen en normaliseren van EODHD- en FMP-data
public/index.html             App-shell en weergaven
public/css/app.css            Design tokens (licht/donker) en layout
public/js/data/mock-portfolio.js  Brondata: instrumenten, kerncijfers, scores, transacties (voorbeeld)
public/js/app.js              Berekeningen (posities, IRR, TWR, risico, dividendprognose) en grafieken
docs/datamodel.md             Datamodel voor fase 2 (stond eerst als tab in de app)
render.yaml                   Render Blueprint
```

Alle getallen worden afgeleid van vier bronnen: transacties, koersen, valutakoersen en dividendaankondigingen.
Koersreeksen zijn in dit prototype gesimuleerd (vaste seed), vastgepind op een realistische begin- en eindkoers.

## Deployen op Render

`render.yaml` beschrijft één Node web service (`npm ci` → `npm start`, healthcheck `/healthz`, regio Frankfurt)
die automatisch opnieuw deployt bij elke push naar `main`.

1. Ga naar <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
2. Koppel GitHub en kies `rogier-cyber/iex-portfolio`.
3. Render leest `render.yaml`; klik **Apply**. Na ~2 minuten staat de site op `https://iex-portfolio.onrender.com`
   (of een vergelijkbare naam als die al bezet is).

Het gratis plan valt na 15 minuten zonder bezoek in slaap; het eerste bezoek daarna duurt ±30 seconden.
Zet `plan: starter` in `render.yaml` om dat te voorkomen.

## Volgende stappen (fase 2)

- Postgres (Neon of Render Postgres) met het schema uit `docs/datamodel.md`
- Echte koers-, valuta- en dividenddata via een marktdataleverancier
- Login en meerdere portefeuilles per gebruiker
- Brokerkoppeling die transacties importeert
- Overstap naar Next.js + TypeScript zodra er API-routes en accounts bij komen
