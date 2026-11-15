# Portefeuille Kompas (IEX Portfolio)

Portefeuilletool voor IEX.nl. **Fase 1**: alle visualisaties en het datamodel, op voorbeelddata.
Brokerkoppeling en login volgen in fase 2.

## Weergaven

| Weergave | Wat je ziet |
|---|---|
| Overzicht | Waarde vs inleg of rendement vs AEX, kompasscore, kerncijfers, posities met detailpaneel |
| Analyse | Score per kenmerk (wie trekt omhoog, wie drukt), posities op één lijn t.o.v. portefeuille en AEX, spreiding sector → branche → positie, omzet per regio, valuta, correlatiematrix, risico (volatiliteit, drawdown, bèta, Sharpe, Sortino) |
| Waardering | Koers t.o.v. reële waarde per positie, opwaarts potentieel |
| Dividend | Ontvangen en verwacht dividend per maand/jaar, bijdrage per positie, rendement op inleg, kalender met ex- en betaaldata |
| Rendement | Waterval (koers, valuta, gerealiseerd, dividend, bronbelasting, kosten), bijdrage per positie, rendementsrapport, transacties |
| Nieuws | Voorbeeldfeed per positie en categorie |
| Datamodel | De tabellen die in fase 2 in de database komen |

## Lokaal draaien

```bash
npm install
npm run dev     # http://localhost:3000
```

Node 20 of nieuwer. De server (`server.js`) heeft geen dependencies; ECharts komt uit `node_modules`.

## Structuur

```
server.js                     Node-server: statische bestanden, /vendor/echarts.min.js, /healthz
public/index.html             App-shell en weergaven
public/css/app.css            Design tokens (licht/donker) en layout
public/js/data/mock-portfolio.js  Brondata: instrumenten, kerncijfers, scores, transacties (voorbeeld)
public/js/app.js              Berekeningen (posities, IRR, TWR, risico, dividendprognose) en grafieken
docs/datamodel.md             Datamodel voor fase 2
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
