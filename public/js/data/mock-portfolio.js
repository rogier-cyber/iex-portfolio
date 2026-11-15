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
];
// Kosten per order (EUR), valutakosten op niet-EUR orders, bronbelasting op dividend
export const FEE=3.0, FXFEE=.0025, WHT=.15;
