/**
 * Voorbeelddata (mock) voor fase 1.
 * Dit bestand bevat alleen BRONDATA: instrumenten, kerncijfers, scores en transacties.
 * Alles daarbuiten (posities, rendement, risico, dividendprognose) wordt in app.js berekend.
 * In fase 2 komt deze data uit de database (zie docs/datamodel.md) en de brokerkoppeling.
 */
// scores: [Waardering, Groei, Verleden, Gezondheid, Dividend], 0..6
export const AXES=['Waardering','Groei','Verleden','Gezondheid','Dividend'];
export const AXDESC={
  Waardering:'Hoe de koers zich verhoudt tot de geschatte reële waarde, winst en kasstroom.',
  Groei:'Verwachte groei van winst en omzet volgens analisten, de komende drie jaar.',
  Verleden:'Hoe winst, rendement op eigen vermogen en marges zich de afgelopen vijf jaar ontwikkelden.',
  Gezondheid:'Schuldpositie, rentedekking en liquiditeit van de balans.',
  Dividend:'Hoogte, stabiliteit en dekking van het dividend.'};
export const INS=[
  {t:'ASML',p0:140,n:'ASML Holding',isin:'NL0010273215',ex:'Euronext Amsterdam',sec:'Technologie',ind:'Halfgeleiderapparatuur',cty:'Nederland',ccy:'EUR',p:842.0,fv:905,beta:1.3,f:'semi',iv:.032,al:.0022,s:[3,5,6,6,2],pe:34,g:14,roe:48,de:27,dps:7.36,dm:[[2,10],[5,6],[8,7],[11,6]],geo:[15,15,68,2]},
  {t:'ASM',p0:30,n:'ASM International',isin:'NL0000334118',ex:'Euronext Amsterdam',sec:'Technologie',ind:'Halfgeleiderapparatuur',cty:'Nederland',ccy:'EUR',p:548.0,fv:520,beta:1.4,f:'semi',iv:.038,al:.0018,s:[2,5,5,6,1],pe:38,g:17,roe:22,de:1,dps:3.0,dm:[[5,30]],geo:[12,18,68,2]},
  {t:'BESI',p0:17,n:'BE Semiconductor',isin:'NL0012866412',ex:'Euronext Amsterdam',sec:'Technologie',ind:'Halfgeleiders',cty:'Nederland',ccy:'EUR',p:128.4,fv:112,beta:1.6,f:'semi',iv:.046,al:.0016,s:[1,5,5,5,3],pe:52,g:21,roe:38,de:45,dps:2.18,dm:[[5,6]],geo:[10,8,80,2]},
  {t:'ADYEN',p0:520,n:'Adyen',isin:'NL0012969182',ex:'Euronext Amsterdam',sec:'Technologie',ind:'Betalingsverwerking',cty:'Nederland',ccy:'EUR',p:1395,fv:1720,beta:1.4,f:'fintech',iv:.05,al:.0004,s:[4,5,5,6,0],pe:41,g:20,roe:25,de:3,dps:0,dm:[],geo:[62,22,10,6]},
  {t:'SHELL',p0:26,n:'Shell plc',isin:'GB00BP6MXD84',ex:'Euronext Amsterdam',sec:'Energie',ind:'Olie en gas',cty:'Verenigd Koninkrijk',ccy:'EUR',p:31.42,fv:38.9,beta:.7,f:'energy',iv:.03,al:.0008,s:[5,2,4,4,5],pe:12,g:3,roe:11,de:41,dps:1.32,dm:[[3,24],[6,23],[9,22],[12,20]],geo:[35,25,25,15]},
  {t:'INGA',p0:10.2,n:'ING Groep',isin:'NL0011821202',ex:'Euronext Amsterdam',sec:'Financiën',ind:'Banken',cty:'Nederland',ccy:'EUR',p:21.18,fv:24.6,beta:1.1,f:'fin',iv:.03,al:.0012,s:[5,2,4,3,6],pe:9,g:5,roe:13,de:290,dps:1.36,dm:[[5,2],[8,8]],dmw:[.69,.31],geo:[88,4,6,2]},
  {t:'NN',p0:35,n:'NN Group',isin:'NL0010773842',ex:'Euronext Amsterdam',sec:'Financiën',ind:'Verzekeraars',cty:'Nederland',ccy:'EUR',p:55.8,fv:61.0,beta:.9,f:'fin',iv:.028,al:.0008,s:[5,2,3,3,6],pe:10,g:4,roe:9,de:38,dps:3.40,dm:[[6,10],[9,9]],dmw:[.61,.39],geo:[95,0,5,0]},
  {t:'UNA',p0:47,n:'Unilever',isin:'GB00B10RZP78',ex:'Euronext Amsterdam',sec:'Consumentengoederen',ind:'Persoonlijke verzorging',cty:'Verenigd Koninkrijk',ccy:'EUR',p:53.10,fv:49.8,beta:.5,f:'staples',iv:.022,al:.0003,s:[2,3,4,4,4],pe:20,g:6,roe:32,de:140,dps:1.76,dm:[[3,13],[6,12],[9,11],[12,11]],geo:[22,20,40,18]},
  {t:'AD',p0:22,n:'Ahold Delhaize',isin:'NL0011794037',ex:'Euronext Amsterdam',sec:'Consumentengoederen',ind:'Supermarkten',cty:'Nederland',ccy:'EUR',p:35.62,fv:42.3,beta:.4,f:'staples',iv:.022,al:.0006,s:[5,2,4,4,5],pe:13,g:4,roe:15,de:92,dps:1.17,dm:[[4,24],[8,28]],dmw:[.57,.43],geo:[38,62,0,0]},
  {t:'HEIA',p0:76,n:'Heineken',isin:'NL0000009165',ex:'Euronext Amsterdam',sec:'Consumentengoederen',ind:'Brouwerijen',cty:'Nederland',ccy:'EUR',p:71.50,fv:88.0,beta:.6,f:'staples',iv:.025,al:-.0006,s:[5,3,2,3,4],pe:16,g:7,roe:13,de:88,dps:1.86,dm:[[5,6],[8,6]],dmw:[.6,.4],geo:[37,24,12,27]},
  {t:'WKL',p0:52,n:'Wolters Kluwer',isin:'NL0000395903',ex:'Euronext Amsterdam',sec:'Zakelijke diensten',ind:'Professionele informatie',cty:'Nederland',ccy:'EUR',p:118.0,fv:141,beta:.7,f:'services',iv:.024,al:.0012,s:[4,4,6,4,3],pe:22,g:9,roe:70,de:210,dps:2.42,dm:[[5,20],[9,24]],dmw:[.61,.39],geo:[32,60,6,2]},
  {t:'PRX',p0:58,n:'Prosus',isin:'NL0013654783',ex:'Euronext Amsterdam',sec:'Communicatie',ind:'Internetplatforms',cty:'Nederland',ccy:'EUR',p:52.40,fv:63.1,beta:1.2,f:'tech',iv:.036,al:.0006,s:[5,4,3,4,1],pe:14,g:15,roe:18,de:28,dps:.10,dm:[[10,8]],geo:[20,5,50,25]},
  {t:'MSFT',p0:102,n:'Microsoft',isin:'US5949181045',ex:'Nasdaq',sec:'Technologie',ind:'Software',cty:'Verenigde Staten',ccy:'USD',p:412.0,fv:455,beta:1.1,f:'tech',iv:.026,al:.0016,s:[3,4,6,6,2],pe:31,g:13,roe:33,de:18,dps:3.32,dm:[[3,13],[6,12],[9,11],[12,11]],geo:[27,51,15,7]},
  {t:'KPN',p0:2.75,n:'KPN',isin:'NL0000009082',ex:'Euronext Amsterdam',sec:'Communicatie',ind:'Telecom',cty:'Nederland',ccy:'EUR',p:3.95,fv:4.3,beta:.4,f:'services',iv:.02,al:.0007,s:[3,2,4,3,5],pe:18,g:5,roe:18,de:140,dps:.175,dm:[[4,16],[7,31]],dmw:[.6,.4],geo:[100,0,0,0]},
  {t:'PHIA',p0:33,n:'Philips',isin:'NL0000009538',ex:'Euronext Amsterdam',sec:'Gezondheidszorg',ind:'Medische apparatuur',cty:'Nederland',ccy:'EUR',p:24.10,fv:26,beta:.9,f:'health',iv:.04,al:-.0022,s:[3,3,1,3,3],pe:18,g:8,roe:4,de:62,dps:.85,dm:[[5,15]],geo:[30,40,20,10]},
  {t:'SAP',p0:95,n:'SAP',isin:'DE0007164600',ex:'Xetra',sec:'Technologie',ind:'Software',cty:'Duitsland',ccy:'EUR',p:238.0,fv:285,beta:1.0,f:'tech',iv:.026,al:.0012,s:[2,5,5,6,2],pe:38,g:16,roe:15,de:22,dps:2.35,dm:[[5,15]],geo:[45,33,16,6]},
  {t:'MC',p0:260,n:'LVMH',isin:'FR0000121014',ex:'Euronext Parijs',sec:'Consumentengoederen',ind:'Luxegoederen',cty:'Frankrijk',ccy:'EUR',p:615.0,fv:690,beta:1.1,f:'staples',iv:.03,al:.0006,s:[3,3,5,5,3],pe:25,g:7,roe:20,de:36,dps:13,dm:[[4,28],[12,4]],dmw:[.55,.45],geo:[32,25,36,7]},
  {t:'NESN',p0:82,n:'Nestlé',isin:'CH0038863350',ex:'SIX Zürich',sec:'Consumentengoederen',ind:'Voeding',cty:'Zwitserland',ccy:'CHF',p:80.5,fv:89,beta:.5,f:'staples',iv:.02,al:-.0002,s:[4,2,3,4,5],pe:18,g:4,roe:30,de:150,dps:3.05,dm:[[4,22]],geo:[30,33,20,17]},
  {t:'NOVO',p0:150,n:'Novo Nordisk B',isin:'DK0062498333',ex:'Nasdaq Kopenhagen',sec:'Gezondheidszorg',ind:'Farmacie',cty:'Denemarken',ccy:'DKK',p:330,fv:410,beta:.7,f:'health',iv:.034,al:.0018,s:[5,4,6,5,4],pe:14,g:8,roe:70,de:60,dps:11.4,dm:[[3,28],[8,20]],dmw:[.65,.35],geo:[24,56,10,10]},
  {t:'NVDA',p0:3.4,n:'Nvidia',isin:'US67066G1040',ex:'Nasdaq',sec:'Technologie',ind:'Halfgeleiders',cty:'Verenigde Staten',ccy:'USD',p:185.0,fv:225,beta:1.8,f:'semi',iv:.055,al:.0062,s:[2,6,6,6,0],pe:45,g:35,roe:100,de:15,dps:.04,dm:[[3,28],[6,28],[9,28],[12,28]],geo:[10,45,40,5]},
  {t:'IWDA',etf:true,p0:50,n:'iShares Core MSCI World',isin:'IE00B4L5Y983',ex:'Euronext Amsterdam',sec:"ETF's",ind:'Wereldwijd',cty:'Ierland',ccy:'EUR',p:110.0,fv:110,beta:.75,f:'tech',iv:.008,al:.0011,s:[3,3,4,4,0],pe:21,g:10,roe:17,de:60,dps:0,dm:[],geo:[16,73,9,2],ter:.20,acc:true,lt:'msciw'},
  {t:'VWRL',etf:true,p0:72,n:'Vanguard FTSE All-World',isin:'IE00B3RBWM25',ex:'Euronext Amsterdam',sec:"ETF's",ind:'Wereldwijd',cty:'Ierland',ccy:'EUR',p:142.0,fv:142,beta:.72,f:'tech',iv:.008,al:.0009,s:[3,3,4,4,2],pe:19,g:9,roe:16,de:60,dps:2.0,dm:[[3,28],[6,26],[9,25],[12,24]],geo:[16,64,16,4],ter:.19,acc:false,lt:'ftaw'},
  {t:'EMIM',etf:true,p0:24,n:'iShares Core MSCI EM IMI',isin:'IE00BKM4GZ66',ex:'Euronext Amsterdam',sec:"ETF's",ind:'Opkomende markten',cty:'Ierland',ccy:'EUR',p:38.0,fv:38,beta:.6,f:'tech',iv:.014,al:.0004,s:[4,3,3,4,0],pe:14,g:11,roe:13,de:55,dps:0,dm:[],geo:[2,0,84,14],ter:.18,acc:true,lt:'em'},
];
export const MARKET={name:'AEX',pe:15.5,g:9,roe:14,de:70,yld:.030,s:[3.4,3.2,3.6,3.7,3.4],vol:null};
// transactions [date, type, ticker, qty]
export const TXIN=[
  ['2019-01-07','BUY','SHELL',400],['2019-01-07','BUY','INGA',600],['2019-02-04','BUY','ASML',10],['2019-03-04','BUY','PHIA',300],
  ['2019-06-03','BUY','UNA',150],['2019-09-02','BUY','MSFT',25],['2020-01-06','BUY','AD',250],['2020-04-06','BUY','INGA',400],
  ['2020-05-04','BUY','ASM',15],['2020-08-03','BUY','KPN',1500],['2020-10-05','BUY','SHELL',300],['2021-01-04','BUY','WKL',70],
  ['2021-03-01','BUY','ASML',5],['2021-06-07','BUY','BESI',60],['2021-09-06','BUY','NN',180],['2022-01-03','SELL','PHIA',300],
  ['2022-03-07','BUY','PRX',200],['2022-06-06','BUY','ADYEN',6],['2022-10-03','BUY','MSFT',15],['2022-11-07','BUY','AD',150],
  ['2023-01-02','BUY','KPN',1200],['2023-03-06','BUY','HEIA',120],['2023-06-05','SELL','SHELL',200],['2023-10-02','BUY','ASML',5],
  ['2024-02-05','BUY','ADYEN',4],['2024-07-15','SELL','ASML',4],['2024-10-07','BUY','BESI',40],['2025-04-07','BUY','HEIA',80],
  // meer verkopen en terugkopen, zodat de gedragsanalyse iets te zien heeft
  ['2020-03-16','SELL','UNA',100],['2021-01-04','BUY','UNA',100],['2021-11-01','SELL','ASM',10],['2022-05-02','SELL','NN',80],
  ['2022-07-04','SELL','BESI',30],['2023-04-03','SELL','MSFT',10],['2023-09-04','BUY','PHIA',200],['2024-11-04','SELL','ADYEN',3],
  ['2025-03-03','SELL','KPN',800],['2025-09-01','BUY','NVDA',40],['2026-02-02','SELL','HEIA',60],
  // buitenlandse aandelen
  ['2019-10-07','BUY','NVDA',300],['2020-11-02','BUY','SAP',40],['2021-04-06','BUY','NOVO',120],['2021-11-01','BUY','MC',8],
  ['2022-09-05','BUY','NESN',70],['2024-03-04','SELL','NVDA',120],['2025-06-02','BUY','NOVO',60],
  // ETF's: eenmalige aankopen
  ['2019-04-01','BUY','IWDA',120],['2021-02-01','BUY','VWRL',80],['2021-05-03','BUY','EMIM',300],['2024-05-06','BUY','VWRL',40],['2025-01-06','BUY','EMIM',200],
  // periodiek beleggen: elk kwartaal 10 stuks IWDA
  ...Array.from({length:27},(_,k)=>{const y=2020+Math.floor(k/4),m=1+3*(k%4);return [`${y}-${String(m).padStart(2,'0')}-0${m===4?6:m===10?5:m===7?6:2}`,'BUY','IWDA',10];}),
].sort((a,b)=>a[0].localeCompare(b[0]));
// Doorkijk van ETF's naar landen (afgerond, %)
export const LOOK={
  msciw:{'Verenigde Staten':72,'Japan':5.5,'Verenigd Koninkrijk':3.5,'Canada':3,'Frankrijk':2.7,'Zwitserland':2.4,'Duitsland':2.3,'Australië':1.7,'Nederland':1.2,'Denemarken':.8,'Overig ontwikkeld':4.9},
  ftaw:{'Verenigde Staten':63,'Japan':5.5,'Verenigd Koninkrijk':3.2,'China':2.8,'Canada':2.8,'Frankrijk':2.3,'India':2.2,'Zwitserland':2.1,'Taiwan':2,'Duitsland':2,'Overig ontwikkeld':8,'Overig opkomend':6.1},
  em:{'China':25,'India':20,'Taiwan':19,'Zuid-Korea':10,'Brazilië':4,'Saoedi-Arabië':3.5,'Zuid-Afrika':3.2,'Mexico':2,'Overig opkomend':13.3}};
export const REGION={'Nederland':'Europa','Duitsland':'Europa','Frankrijk':'Europa','Zwitserland':'Europa','Denemarken':'Europa','Verenigd Koninkrijk':'Europa','Ierland':'Europa',
  'Verenigde Staten':'Noord-Amerika','Canada':'Noord-Amerika','Japan':'Azië-Pacific','Australië':'Azië-Pacific','China':'Opkomende markten','India':'Opkomende markten','Taiwan':'Opkomende markten',
  'Zuid-Korea':'Opkomende markten','Brazilië':'Opkomende markten','Saoedi-Arabië':'Opkomende markten','Zuid-Afrika':'Opkomende markten','Mexico':'Opkomende markten','Overig ontwikkeld':'Overig ontwikkeld','Overig opkomend':'Opkomende markten'};
export const CCYOF={'Verenigde Staten':'USD','Canada':'CAD','Japan':'JPY','Verenigd Koninkrijk':'GBP','Zwitserland':'CHF','Denemarken':'DKK','Australië':'AUD','China':'CNY','India':'INR','Taiwan':'TWD','Zuid-Korea':'KRW'};
// Dividendbelasting bij de bron per land van vestiging (wat je in NL kunt verrekenen is maximaal 15%)
export const WHTC={'Nederland':.15,'Verenigde Staten':.15,'Duitsland':.26375,'Frankrijk':.128,'Zwitserland':.35,'Denemarken':.27,'Verenigd Koninkrijk':0,'Ierland':0};
// Optiestrategieën (Euronext-opties op echte onderliggende koersen, premies via Black-Scholes)
// u: onderliggende (AEX = Mini AEX-index-optie, vermenigvuldiger 10; aandelen 100)
export const OPT_PLAN=[
  {id:'cc-inga',naam:'Covered calls ING',u:'INGA',type:'C',side:-1,n:10,otm:.08,weeks:8,from:'2021-01-04',roll:true},
  {id:'cc-shell',naam:'Covered calls Shell',u:'SHELL',type:'C',side:-1,n:3,otm:.06,weeks:5,from:'2021-03-01',roll:true},
  {id:'sp-aex',naam:'Puts schrijven AEX',u:'AEX',type:'P',side:-1,n:3,otm:.045,weeks:5,from:'2021-06-07',stop:3},
  {id:'hp-aex',naam:'Afdekking AEX-puts',u:'AEX',type:'P',side:1,n:4,otm:.08,weeks:26,from:'2022-01-03',exitWeeks:8,gap:0},
  {id:'lc-asml',naam:'Calls kopen ASML',u:'ASML',type:'C',side:1,n:1,otm:0,weeks:17,from:'2021-09-06',hold:9,take:.8,gap:9},
  {id:'sp-ad',naam:'Puts schrijven Ahold',u:'AD',type:'P',side:-1,n:5,otm:.07,weeks:9,from:'2023-02-06',stop:3},
];
export const OPT_FEE=1.0; // per contract per transactie
// Kosten per order (EUR), valutakosten op niet-EUR orders, bronbelasting op dividend
export const FEE=3.0, FXFEE=.0025, WHT=.15;
