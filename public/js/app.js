import {AXES,AXDESC,INS,MARKET,TXIN,FEE,FXFEE,WHT,LOOK,REGION,CCYOF,WHTC,OPT_PLAN,OPT_FEE} from "./data/mock-portfolio.js";
/* global echarts */
// Echte marktdata (EODHD via de server) als die er is; anders draait alles op voorbeelddata.
const LIVE=await fetch('/api/market').then(r=>r.ok?r.json():null).then(d=>d&&d.instruments?d:null).catch(()=>null);
/* ============ helpers ============ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nf0=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:0});
const nf1=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:1});
const nf2=new Intl.NumberFormat('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
const eur=(v,d=0)=>(v<0?'−':'')+'€ '+(d?nf2:nf0).format(Math.abs(v));
const eurS=(v,d=0)=>(v>0?'+':'')+eur(v,d);
const pct=(v,d=1)=>(v<0?'−':'')+Math.abs(v*100).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const pctS=(v,d=1)=>(v>0?'+':'')+pct(v,d);
const cls=v=>v>=0?'up':'down';
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function rng(seed){let a=0;for(const c of seed)a=(a*31+c.charCodeAt(0))>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const DAY=864e5, START=Date.UTC(2019,0,7);
const TODAY=LIVE?(()=>{const n=new Date();return Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate());})():Date.UTC(2026,10,15);
const NW=Math.floor((TODAY-START)/(7*DAY))+1; // one point per week since the first purchase
const wdate=i=>START+i*7*DAY;
const widx=d=>Math.max(0,Math.min(NW-1,Math.floor((d-START)/(7*DAY))));
const D=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};
const fdate=t=>new Date(t).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const MONTHS=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

/* ============ reference data (mock) ============ */
const BY=Object.fromEntries(INS.map(i=>[i.t,i]));


/* ============ price model ============ */
// weekly log-returns: beta*market + sector factor + idiosyncratic; rescaled so the last point equals today's price
const rM=rng('market'); const mkt=[0]; for(let i=1;i<NW;i++)mkt.push(.0016+.021*gauss(rM));
const FACT={}; ['semi','fintech','energy','fin','staples','services','tech','health'].forEach(k=>{const r=rng('f'+k);FACT[k]=[0];for(let i=1;i<NW;i++)FACT[k].push(.014*gauss(r));});
// Brownian bridge: keep the simulated wiggles, pin first and last point to realistic levels
function pathFrom(rets,last,first){const lp=[0];for(let i=1;i<NW;i++)lp.push(lp[i-1]+rets[i]);const a=Math.log(first),b=Math.log(last),e=lp[NW-1];return lp.map((v,i)=>Math.exp(a+v-e*i/(NW-1)+(b-a)*i/(NW-1)));}
INS.forEach(x=>{const r=rng('p'+x.t);x.ret=[0];for(let i=1;i<NW;i++)x.ret.push(x.al+x.beta*(mkt[i]-.0016)+.9*FACT[x.f][i]+x.iv*gauss(r));x.px=pathFrom(x.ret,x.p,x.p0);
  const rd=rng('d'+x.t); x.day=(rd()-.45)*.035; });
let AEX=pathFrom(mkt,905.3,487);
const rF=rng('fx'); const fxr=[0]; for(let i=1;i<NW;i++)fxr.push(.0002+.008*gauss(rF)); let FX=pathFrom(fxr,.8652,.874); // EUR per USD
const FXS={USD:FX,CHF:(()=>{const r=rng('chf');const a=[0];for(let i=1;i<NW;i++)a.push(.0004+.006*gauss(r));return pathFrom(a,1.072,.889);})(),DKK:(()=>{const r=rng('dkk');const a=[0];for(let i=1;i<NW;i++)a.push(.0004*gauss(r));return pathFrom(a,.1340,.1339);})()};
// mock benchmarks (replaced by real series below when available)
const mockIdx=(seed,beta,noise,first,last)=>{const r=rng(seed);const rs=[0];for(let i=1;i<NW;i++)rs.push(.0014+beta*(mkt[i]-.0016)+noise*gauss(r));return pathFrom(rs,last,first);};
const BENCH={AEX:{name:'AEX',s:null,note:'koersindex'},AMX:{name:'AMX (midkap)',s:mockIdx('amx',.85,.012,520,930),note:'koersindex'},
  MSCIW:{name:'MSCI World (ETF)',s:mockIdx('msciw',.7,.011,47,108),note:'ETF in euro, inclusief dividend'},SPX:{name:'S&P 500 (in euro)',s:mockIdx('spx',.75,.012,2250,6200),note:'koersindex, omgerekend naar euro'},
  SX5E:{name:'Euro Stoxx 50',s:mockIdx('sx5e',.9,.008,3000,5650),note:'koersindex'}};
INS.forEach(x=>{x.fvSrc='Voorbeeldschatting';x.divEvents=null;});
/* ---- real data from EODHD ---- */
function align(series){const pts=(series||[]).map(([d,c])=>[D(d),+c]).filter(p=>p[1]>0).sort((a,b)=>a[0]-b[0]);if(pts.length<20)return null;
  const out=new Array(NW);let j=0,last=pts[0][1];for(let i=0;i<NW;i++){const t=wdate(i)+4*DAY;while(j<pts.length&&pts[j][0]<=t){last=pts[j][1];j++;}out[i]=last;}return out;}
// vangnet: een weekbeweging van meer dan -60% of +150% is bijna altijd een niet-verwerkte split; schaal de oudere koersen mee
function fixJumps(px){if(!px)return px;for(let i=px.length-1;i>0;i--){const r=px[i]/px[i-1];if(r<.4||r>2.5){for(let j=0;j<i;j++)px[j]*=r;}}return px;}
if(LIVE){
  const fx=align(LIVE.fx&&LIVE.fx.prices); if(fx){FX=fx.map(v=>1/v);FXS.USD=FX;} // EODHD gives USD per EUR
  Object.entries(LIVE.fxs||{}).forEach(([c,f])=>{const a=align(f&&f.prices);if(a&&c!=='USD')FXS[c]=a.map(v=>1/v);});
  INS.forEach(x=>{const L=LIVE.instruments[x.t];if(!L)return;const px=fixJumps(align(L.prices));
    if(px){x.px=px;const q=L.quote||{};if(q.last>0){x.p=q.last;x.px[NW-1]=q.last;}else x.p=px[NW-1];
      x.day=q.changePct!=null?q.changePct/100:(x.px[NW-1]/x.px[NW-2]-1);
      x.ret=[0];for(let i=1;i<NW;i++)x.ret.push(Math.log(x.px[i]/x.px[i-1]));x.live=true;}
    const F=L.fundamentals;if(F){const r1=v=>Math.round(v*10)/10;
      if(F.pe>0)x.pe=r1(F.pe); if(F.epsGrowthNext!=null)x.g=r1(F.epsGrowthNext*100); if(F.roe!=null)x.roe=r1(F.roe*100);
      if(F.debtEquity!=null)x.de=Math.round(F.debtEquity*100); if(F.payout!=null)x.payout=Math.round(F.payout*(F.payout<=1.5?100:1));
      if(F.targetPrice>0){x.fv=F.targetPrice;x.fvSrc='Koersdoel analisten';}
      if(F.revGrowth!=null)x.revG=r1(F.revGrowth*100); if(F.margin!=null)x.margin=r1(F.margin*100);}
    if(L.dividends&&L.dividends.length){x.divEvents=L.dividends.map(d=>({exd:D(d.ex),pay:D(d.pay||d.ex),ps:+d.amount})).filter(d=>d.ps>0).sort((a,b)=>a.exd-b.exd);
      x.dps=x.divEvents.filter(d=>d.exd>TODAY-365*DAY&&d.exd<=TODAY).reduce((a,d)=>a+d.ps,0);}
    else if(x.live)x.dps=x.dps||0;});
  Object.entries(BENCH).forEach(([k,b])=>{const L=LIVE.benchmarks&&LIVE.benchmarks[k];const s=L&&align(L.prices);if(s)b.s=L.ccy==='USD'?s.map((v,i)=>v*FX[i]):s;});
  const a=LIVE.benchmarks&&LIVE.benchmarks.AEX&&align(LIVE.benchmarks.AEX.prices); if(a)AEX=a;
}
BENCH.AEX.s=AEX;
const fxAt=(ccy,i)=>ccy==='EUR'||!FXS[ccy]?1:FXS[ccy][i];
INS.forEach(x=>{x.wht=WHTC[x.cty]??WHT;});

/* ============ ledger: positions, cash flows, dividends ============ */
const TX=[]; const pos={}; INS.forEach(x=>pos[x.t]={q:0,costE:0,costL:0,fxw:0,real:0,fees:0,divG:0,divT:0});
TXIN.forEach(([ds,ty,t,q])=>{const x=BY[t],d=D(ds),i=widx(d),pl=x.px[i],fx=fxAt(x.ccy,i);const gross=q*pl*fx;const fee=FEE+(x.ccy!=='EUR'?gross*FXFEE:0);
  const P=pos[t]; P.fees+=fee;
  if(ty==='BUY'){P.q+=q;P.costE+=gross;P.costL+=q*pl;TX.push({d,ty,t,q,price:pl,ccy:x.ccy,fx,amt:-(gross+fee),fee});}
  else{const avgE=P.costE/P.q,avgL=P.costL/P.q;P.real+=gross-avgE*q;P.costE-=avgE*q;P.costL-=avgL*q;P.q-=q;TX.push({d,ty,t,q,price:pl,ccy:x.ccy,fx,amt:gross-fee,fee});}});
TX.sort((a,b)=>a.d-b.d);
function qtyAt(t,d){let q=0;for(const tx of TX){if(tx.t!==t||tx.d>d)continue;if(tx.ty==='BUY')q+=tx.q;else if(tx.ty==='SELL')q-=tx.q;}return q;}
// dividend schedule: history (paid) + forecast (next 12 months)
const DIVS=[]; const END12=TODAY+365*DAY;
function pushDiv(x,exd,pay,ps,hist){const q=hist?qtyAt(x.t,exd):pos[x.t].q;if(q<=0)return;
  const fx=fxAt(x.ccy,hist?widx(pay):NW-1);const g=q*ps*fx;DIVS.push({t:x.t,pay,exd,q,ps,ccy:x.ccy,gross:g,tax:g*x.wht,net:g*(1-x.wht),hist,est:!hist&&!x._declared});}
INS.forEach(x=>{if(!x.divEvents)return;
  x.divEvents.forEach(d=>{if(d.pay<START+20*DAY)return;if(d.pay<=TODAY)pushDiv(x,d.exd,d.pay,d.ps,true);else{x._declared=true;pushDiv(x,d.exd,d.pay,d.ps,false);x._declared=false;}});
  // estimate the next 12 months from the last 12, skipping payments that are already declared
  x.divEvents.filter(d=>d.pay>TODAY-365*DAY&&d.pay<=TODAY).forEach(d=>{const pay=d.pay+365*DAY,exd=d.exd+365*DAY;
    if(x.divEvents.some(e=>Math.abs(e.pay-pay)<40*DAY))return;if(pay<=END12)pushDiv(x,exd,pay,d.ps,false);});});
INS.forEach(x=>{if(!x.dps||x.divEvents)return;const w=x.dmw||x.dm.map(()=>1/x.dm.length);
  for(let y=2019;y<=new Date(END12).getUTCFullYear();y++){const dpsY=x.dps*Math.pow(1.055,y-2026);
    x.dm.forEach(([m,day],k)=>{const pay=Date.UTC(y,m-1,day),exd=pay-24*DAY;if(pay<START+20*DAY||pay>END12)return;
      const hist=pay<=TODAY;const q=hist?qtyAt(x.t,exd):pos[x.t].q;if(q<=0)return;
      const ps=dpsY*w[k];const fx=fxAt(x.ccy,hist?widx(pay):NW-1);const g=q*ps*fx;
      DIVS.push({t:x.t,pay,exd,q,ps,ccy:x.ccy,gross:g,tax:g*x.wht,net:g*(1-x.wht),hist});});}});
DIVS.sort((a,b)=>a.pay-b.pay);
DIVS.filter(v=>v.hist).forEach(v=>{pos[v.t].divG+=v.gross;pos[v.t].divT+=v.tax;TX.push({d:v.pay,ty:'DIV',t:v.t,q:v.q,price:v.ps,ccy:v.ccy,fx:fxAt(v.ccy,widx(v.pay)),amt:v.net,fee:0,tax:v.tax});});
TX.sort((a,b)=>a.d-b.d);

/* ============ derived positions ============ */
const LASTI=NW-1;
const OPEN=INS.filter(x=>pos[x.t].q>0);
OPEN.forEach(x=>{const P=pos[x.t];x.q=P.q;x.fxNow=fxAt(x.ccy,LASTI);x.val=P.q*x.p*x.fxNow;x.cost=P.costE;x.avgL=P.costL/P.q;
  x.fxAvg=P.costE/P.costL; x.priceGain=P.q*(x.p-x.avgL)*x.fxNow; x.fxGain=P.q*x.avgL*(x.fxNow-x.fxAvg);});
const TOTAL=OPEN.reduce((a,x)=>a+x.val,0);
OPEN.forEach(x=>{x.w=x.val/TOTAL;x.prev=x.p/(1+x.day);x.dayE=x.val-x.val/(1+x.day);x.yld=x.dps?x.dps/x.p:0;
  const P=pos[x.t];x.totRes=x.priceGain+x.fxGain+P.real+P.divG-P.divT-P.fees;x.totPct=x.totRes/x.cost;x.disc=(x.fv-x.p)/x.fv;});
OPEN.sort((a,b)=>b.val-a.val);
const wavg=f=>OPEN.reduce((a,x)=>a+x.w*f(x),0);
// aandelen apart: scores, waardering en kerncijfers gaan alleen over losse aandelen, niet over ETF's
const STK=OPEN.filter(x=>!x.etf), ETFS=OPEN.filter(x=>x.etf);const STOT=STK.reduce((a,x)=>a+x.val,0);STK.forEach(x=>x.ws=x.val/STOT);
const wavgS=f=>STK.reduce((a,x)=>a+x.ws*f(x),0);
const FV_L=LIVE?'koersdoel':'reële waarde', FV_U=LIVE?'Koersdoel':'Reële waarde';
/* ---- Kompasscore: 6 checks per kenmerk, berekend uit de data (geen handmatige scores) ---- */
const AEXVOL=(()=>{const r=[];for(let i=NW-156;i<NW;i++)r.push(AEX[i]/AEX[i-1]-1);const m=r.reduce((a,b)=>a+b,0)/r.length;return Math.sqrt(r.reduce((a,b)=>a+(b-m)**2,0)/(r.length-1))*Math.sqrt(52);})();
const chg=(x,w)=>x.px[NW-1]/x.px[Math.max(0,NW-1-w)]-1;
function checks(x){const vol=(()=>{const r=x.ret.slice(NW-156).map(v=>Math.expm1?Math.expm1(v):v);const m=r.reduce((a,b)=>a+b,0)/r.length;return Math.sqrt(r.reduce((a,b)=>a+(b-m)**2,0)/(r.length-1))*Math.sqrt(52);})();
  const aex3=AEX[NW-1]/AEX[NW-157]-1;const peg=x.pe>0&&x.g>0?x.pe/x.g:null;
  const divs=x.divEvents?x.divEvents.filter(d=>d.exd<=TODAY):null;const yr=y=>divs?divs.filter(d=>new Date(d.exd).getUTCFullYear()===y).reduce((a,d)=>a+d.ps,0):x.dps*Math.pow(1.055,y-2026);
  const cy=new Date(TODAY).getUTCFullYear();const noCut=x.dps>0&&[1,2,3,4].every(k=>yr(cy-k)>=yr(cy-k-1)*.95||yr(cy-k-1)===0);const grew=x.dps>0&&yr(cy-1)>yr(cy-5)&&yr(cy-5)>0;
  const yl=x.dps/x.p;const bank=x.ind==='Banken'||x.ind==='Verzekeraars';
  return [
   [['Koers onder '+FV_L,x.p<x.fv],['Meer dan 20% onder '+FV_L,x.p<x.fv*.8],['K/W lager dan de AEX ('+MARKET.pe+'x)',x.pe>0&&x.pe<MARKET.pe],['K/W onder 25x',x.pe>0&&x.pe<25],['Winstgevend (K/W positief)',x.pe>0],['PEG onder 1,5',peg!==null&&peg<1.5]],
   [['Winst groeit',x.g>0],['Groeit sneller dan de AEX ('+MARKET.g+'%)',x.g>MARKET.g],['Groei boven 15% per jaar',x.g>15],['Groeit sneller dan spaarrente (2,5%)',x.g>2.5],['Omzet groeit',(x.revG??x.g)>0],['Groei boven 20% per jaar',x.g>20]],
   [['Rendement eigen vermogen positief',x.roe>0],['ROE hoger dan de AEX ('+MARKET.roe+'%)',x.roe>MARKET.roe],['ROE boven 20%',x.roe>20],['Koers hoger dan 3 jaar geleden',chg(x,156)>0],['Beter dan de AEX over 3 jaar',chg(x,156)>aex3],['Koers hoger dan 5 jaar geleden',chg(x,260)>0]],
   [[bank?'Schuld/EV: niet zinvol bij banken en verzekeraars':'Schuld lager dan eigen vermogen',bank||x.de<100],[bank?'Gereguleerde kapitaalbuffer (aangenomen)':'Schuld/EV lager dan de AEX ('+MARKET.de+'%)',bank||x.de<MARKET.de],['Schuld/EV onder 40%',!bank&&x.de<40],['Vrijwel schuldenvrij (onder 10%)',!bank&&x.de<10],['Minder beweeglijk dan 1,5x de AEX',vol<AEXVOL*1.5],['Daling vanaf piek (1 jaar) kleiner dan 25%',x.px[NW-1]/Math.max(...x.px.slice(NW-52))>.75]],
   [['Keert dividend uit',x.dps>0],['Dividendrendement boven 2%',yl>.02],['Hoger dan de AEX ('+pct(MARKET.yld)+')',yl>MARKET.yld],['Uitkeringsratio onder 90%',x.dps>0&&(x.payout??0)<90],['Geen verlaging in 4 jaar',noCut],['Dividend gegroeid in 5 jaar',grew]]];}
INS.forEach(x=>{x.checks=checks(x);x.s=x.checks.map(a=>a.filter(c=>c[1]).length);});
const PSCORE=AXES.map((_,k)=>wavgS(x=>x.s[k]));

/* ============ OPTIES: Euronext-opties, Black-Scholes op echte onderliggende koersen ============ */
const RFR=.025;
const ncdf=x=>{const t=1/(1+.2316419*Math.abs(x));const d=.3989423*Math.exp(-x*x/2);const p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p;};
const npdf=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
function bs(S,K,T,v,type){if(T<=1e-6){const iv=type==='C'?Math.max(0,S-K):Math.max(0,K-S);return {p:iv,delta:type==='C'?(S>K?1:0):(S<K?-1:0),gamma:0,theta:0,vega:0,itm:iv>0?1:0};}
  const sq=v*Math.sqrt(T),d1=(Math.log(S/K)+(RFR+v*v/2)*T)/sq,d2=d1-sq,df=Math.exp(-RFR*T);
  const p=type==='C'?S*ncdf(d1)-K*df*ncdf(d2):K*df*ncdf(-d2)-S*ncdf(-d1);
  const theta=(-S*npdf(d1)*v/(2*Math.sqrt(T))-(type==='C'?1:-1)*RFR*K*df*ncdf(type==='C'?d2:-d2))/365;
  return {p:Math.max(p,0),delta:type==='C'?ncdf(d1):ncdf(d1)-1,gamma:npdf(d1)/(S*sq),theta,vega:S*npdf(d1)*Math.sqrt(T)/100,itm:type==='C'?ncdf(d2):ncdf(-d2)};}
const UND=u=>u==='AEX'?{n:'Mini AEX-index',px:AEX,mult:10,step:5}:{n:BY[u].n,px:BY[u].px,mult:100,step:null};
const strikeStep=S=>S<5?.1:S<20?.5:S<50?1:S<200?2:S<500?10:20;
// historische volatiliteit (26 weken) als benadering van de implied vol, puts iets duurder (skew)
function hvol(u,i){const a=UND(u).px;const r=[];for(let k=Math.max(1,i-26);k<=i;k++)r.push(Math.log(a[k]/a[k-1]));const m=r.reduce((a,b)=>a+b,0)/r.length;const sdv=Math.sqrt(r.reduce((a,b)=>a+(b-m)**2,0)/(r.length-1));return Math.min(.8,Math.max(.12,sdv*Math.sqrt(52)*1.08));}
const fri3=(y,m)=>{const d=new Date(Date.UTC(y,m,1));const off=(5-d.getUTCDay()+7)%7;return Date.UTC(y,m,1+off+14);};
function expiryAfter(t,weeks){const d=new Date(t+weeks*7*DAY);let e=fri3(d.getUTCFullYear(),d.getUTCMonth());if(e<t+(weeks-2)*7*DAY){const n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));e=fri3(n.getUTCFullYear(),n.getUTCMonth());}return e;}
const r05=v=>Math.max(.05,Math.round(v*20)/20);
const OPTS=[]; const OPTV=new Array(NW).fill(0); const OPTTX=[];
OPT_PLAN.forEach(pl=>{const U=UND(pl.u);let i=widx(D(pl.from));const rr=rng('opt'+pl.id);
  while(i<NW-1){const t0=wdate(i)+4*DAY;const S0=U.px[i];const step=U.step||strikeStep(S0);
    const K=Math.round(S0*(1+(pl.type==='C'?1:-1)*pl.otm)/step)*step;const E=expiryAfter(t0,pl.weeks);
    const v0=hvol(pl.u,i)+(pl.type==='P'?.02:0);const p0=r05(bs(S0,K,(E-t0)/(365*DAY),v0,pl.type).p);
    const o={id:pl.id+'-'+i,pl,u:pl.u,un:U.n,type:pl.type,side:pl.side,n:pl.n,mult:U.mult,K,E,i0:i,t0,p0,close:null};
    OPTTX.push({d:t0,ty:'OPT',t:pl.u,o,act:pl.side<0?'Schrijf':'Koop',q:pl.n,price:p0,amt:-pl.side*p0*pl.n*U.mult-OPT_FEE*pl.n,fee:OPT_FEE*pl.n});
    let j=i+1;
    for(;j<NW;j++){const t=wdate(j)+4*DAY;const S=U.px[j];const T=(E-t)/(365*DAY);
      if(t>=E){const iv=pl.type==='C'?Math.max(0,S-K):Math.max(0,K-S);o.close={j,t:E,p:iv,how:iv>0?'Expiratie (cash)':'Waardeloos verlopen'};break;}
      const q=bs(S,K,T,hvol(pl.u,j)+(pl.type==='P'?.02:0),pl.type).p;const wl=(E-t)/(7*DAY);
      let how=null;
      if(pl.roll&&S>K*.99&&wl<=2.2)how='Teruggekocht (doorgerold)';
      else if(pl.stop&&q>p0*pl.stop)how='Teruggekocht (stop)';
      else if(pl.side<0&&q<p0*.15&&wl>1.2)how='Teruggekocht (80% winst)';
      else if(pl.exitWeeks&&wl<=pl.exitWeeks)how='Verkocht';
      else if(pl.hold&&(j-i>=pl.hold||q>p0*(1+pl.take)))how=q>p0*(1+pl.take)?'Verkocht (winstdoel)':'Verkocht';
      if(how&&j<NW-1){o.close={j,t,p:r05(q),how};break;}
      OPTV[j]+=pl.side*q*pl.n*U.mult;}
    if(o.close){const c=o.close;const fee=c.how.startsWith('Waardeloos')?0:OPT_FEE*pl.n;
      OPTTX.push({d:c.t,ty:'OPT',t:pl.u,o,act:c.how,q:pl.n,price:c.p,amt:pl.side*c.p*pl.n*U.mult-fee,fee});
      o.pnl=pl.side*(c.p-p0)*pl.n*U.mult-OPT_FEE*pl.n-fee;o.fees=OPT_FEE*pl.n+fee;i=c.j+1+(pl.gap||0);}
    else{o.fees=OPT_FEE*pl.n;i=NW;}
    OPTS.push(o);}});
// open posities: waarde en Greeks vandaag
const OPEN_OPT=OPTS.filter(o=>!o.close).map(o=>{const U=UND(o.u);const S=U.px[NW-1];const T=Math.max(0,(o.E-TODAY)/(365*DAY));const v=hvol(o.u,NW-1)+(o.type==='P'?.02:0);const g=bs(S,o.K,T,v,o.type);
  const m=o.side*o.n*o.mult;return Object.assign(o,{S,T,vol:v,g,val:m*g.p,upnl:m*(g.p-o.p0)-o.fees,delta:m*g.delta,deltaE:m*g.delta*S,gamma:m*g.gamma,theta:m*g.theta,vega:m*g.vega,dte:Math.round((o.E-TODAY)/DAY)});});
OPTV[NW-1]=OPEN_OPT.reduce((a,o)=>a+o.val,0);
OPTTX.forEach(t=>TX.push(t));TX.sort((a,b)=>a.d-b.d);
const CLOSED_OPT=OPTS.filter(o=>o.close);
const OPTT={real:CLOSED_OPT.reduce((a,o)=>a+o.pnl,0),open:OPEN_OPT.reduce((a,o)=>a+o.upnl,0),val:OPTV[NW-1],fees:OPTS.reduce((a,o)=>a+o.fees,0)};
OPTT.total=OPTT.real+OPTT.open;

// weekly portfolio series
const SER={v:[],inv:[],cf:[]}; {let inv=0;let ti=0;const q={};INS.forEach(x=>q[x.t]=0);
  const trades=TX.filter(t=>t.ty!=='DIV');
  for(let i=0;i<NW;i++){let cf=0;const wEnd=wdate(i)+6*DAY;
    while(ti<trades.length&&trades[ti].d<=wEnd){const t=trades[ti];if(t.ty==='OPT')cf-=t.amt;else if(t.ty==='BUY'){q[t.t]+=t.q;cf+=-t.amt;}else{q[t.t]-=t.q;cf-=t.amt;}ti++;}
    inv+=cf;let v=OPTV[i];INS.forEach(x=>{if(q[x.t])v+=q[x.t]*x.px[i]*fxAt(x.ccy,i);});
    SER.v.push(v);SER.inv.push(inv);SER.cf.push(cf);} }
SER.ret=[0];SER.idx=[100];for(let i=1;i<NW;i++){const r=SER.v[i-1]>0?(SER.v[i]-SER.cf[i])/SER.v[i-1]-1:0;SER.ret.push(r);SER.idx.push(SER.idx[i-1]*(1+r));}
const AEXR=[0];for(let i=1;i<NW;i++)AEXR.push(AEX[i]/AEX[i-1]-1);

// XIRR
function xirr(flows){let r=.1;for(let k=0;k<80;k++){let f=0,df=0;const t0=flows[0].d;for(const c of flows){const y=(c.d-t0)/(365.25*DAY);f+=c.a/Math.pow(1+r,y);df+=-y*c.a/Math.pow(1+r,y+1);}const nr=r-f/df;if(!isFinite(nr))break;if(Math.abs(nr-r)<1e-8){r=nr;break;}r=nr;}return r;}
const flows=TX.map(t=>({d:t.d,a:t.amt}));flows.push({d:TODAY,a:TOTAL+OPTT.val});
const IRR=xirr(flows);

// totals
const SUM=k=>INS.reduce((a,x)=>a+(pos[x.t][k]||0),0);
const T={priceGain:OPEN.reduce((a,x)=>a+x.priceGain,0),fxGain:OPEN.reduce((a,x)=>a+x.fxGain,0),real:SUM('real'),divG:SUM('divG'),divT:SUM('divT'),fees:SUM('fees')};
T.opt=OPTT.total;T.total=T.priceGain+T.fxGain+T.real+T.divG-T.divT-T.fees+T.opt; T.cost=OPEN.reduce((a,x)=>a+x.cost,0);
T.invested=SER.inv[LASTI]; T.day=OPEN.reduce((a,x)=>a+x.dayE,0);
T.twr=SER.idx[LASTI]/100-1; T.aexr=AEX[LASTI]/AEX[0]-1;

// risk, last 156 weeks
const RW=156, R0=NW-RW;
const sl=a=>a.slice(R0);
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};
const cov=(a,b)=>{const ma=mean(a),mb=mean(b);let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-ma)*(b[i]-mb);return s/(a.length-1);};
const corr=(a,b)=>cov(a,b)/(sd(a)*sd(b));
function maxDD(idx){let pk=idx[0],m=0;for(const v of idx){pk=Math.max(pk,v);m=Math.min(m,v/pk-1);}return m;}
const pr=sl(SER.ret), ar=sl(AEXR);
const RISK={vol:sd(pr)*Math.sqrt(52),mvol:sd(ar)*Math.sqrt(52),beta:cov(pr,ar)/(sd(ar)**2),dd:maxDD(sl(SER.idx)),mdd:maxDD(sl(AEX))};
const ann=Math.pow(SER.idx[LASTI]/SER.idx[R0],52/RW)-1, mann=Math.pow(AEX[LASTI]/AEX[R0],52/RW)-1, RF=.025;
const down=pr.filter(v=>v<0);RISK.sharpe=(ann-RF)/RISK.vol;RISK.sortino=(ann-RF)/(Math.sqrt(down.reduce((s,v)=>s+v*v,0)/pr.length)*Math.sqrt(52));
RISK.msharpe=(mann-RF)/RISK.mvol;RISK.ann=ann;RISK.mann=mann;
RISK.top3=OPEN.slice(0,3).reduce((a,x)=>a+x.w,0);
OPEN.forEach(x=>{x.vol=sd(x.ret.slice(R0))*Math.sqrt(52);});
// risk score 0-100: blend of vol, beta, concentration, drawdown
RISK.score=Math.round(Math.min(100,Math.max(0,RISK.vol/.40*45+RISK.beta*15+RISK.top3*40-RISK.dd*40)));
RISK.mscore=Math.round(Math.min(100,Math.max(0,RISK.mvol/.40*45+15+.42*40-RISK.mdd*40)));

/* ============ ANALISTEN & INSIDERS (rekenregels overgenomen uit guruwatch) ============ */
const GPOS=/strong buy|buy|outperform|overweight|positive|accumulate|add|market outperform|sector outperform/i, GNEG=/sell|underperform|underweight|negative|reduce/i;
const gTone=g=>!g?'neu':GNEG.test(g)?'bad':GPOS.test(g)?'good':'neu';
const ACT={up:'Upgrade',down:'Downgrade',init:'Gestart',reit:'Herhaald',main:'Gehandhaafd'};
const actLbl=a=>{const x=String(a||'').toLowerCase();for(const k in ACT)if(x.startsWith(k))return ACT[k];return a?a[0].toUpperCase()+a.slice(1):'–';};
const LEVELS=[['strongBuy','Sterk kopen',5],['buy','Kopen',4],['hold','Houden',3],['sell','Verkopen',2],['strongSell','Sterk verkopen',1]];
const rScore=c=>{if(!c)return null;const t=LEVELS.reduce((a,[k])=>a+(c[k]||0),0);return t?LEVELS.reduce((a,[k,,w])=>a+w*(c[k]||0),0)/t:null;};
const rLabel=s=>s==null?'–':s>=4.5?'Sterk kopen':s>=3.75?'Kopen':s>=3.25?'Licht kopen':s>=2.5?'Houden':s>=1.75?'Verkopen':'Sterk verkopen';
const TXT={P:'Aankoop',S:'Verkoop',A:'Toekenning',M:'Optie-uitoefening',F:'Belasting',G:'Schenking',D:'Teruggave',C:'Conversie',X:'Optie-uitoefening',J:'Overig'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const txCode=t=>String(t||'').split('-')[0].toUpperCase();
const roleNL=t=>{const s=String(t||'').toLowerCase();const o=[];if(/supervisory|commissaris/.test(s))return 'commissaris';if(/board member|bestuurder|executive board|management board/.test(s))return 'bestuurder';if(/chief executive|\bceo\b/.test(s))o.push('CEO');if(/chief financial|\bcfo\b/.test(s))o.push('CFO');if(/director/.test(s))o.push('bestuurder');if(/officer/.test(s)&&!o.length)o.push('directielid');if(/10%|owner/.test(s))o.push('grootaandeelhouder');return o.join(', ')||t||'insider';};
// voorbeelddata als er geen live analistendata is
function mockAnalyst(x){const r=rng('an'+x.t);const firms=['Broker A','Broker B','Broker C','Broker D','Broker E','Broker F','Broker G','Broker H','Broker I','Broker J'];
  const bull=Math.min(.95,Math.max(.15,.45+(x.fv/x.p-1)*1.6+(r()-.5)*.2));const tot=10+Math.floor(r()*22);
  const sb=Math.round(tot*bull*.35),b=Math.round(tot*bull)-sb,se=Math.max(0,Math.round(tot*(1-bull)*.25*(r()+.3))),h=Math.max(0,tot-sb-b-se);
  const cons={strongBuy:sb,buy:b,hold:h,sell:se,strongSell:0};
  const targets=[],grades=[];const n=9+Math.floor(r()*9);const last={};
  for(let k=0;k<n;k++){const d=TODAY-Math.floor(r()*360)*DAY;const i=widx(d);const f=firms[Math.floor(r()*firms.length)];
    const tg=x.fv*(x.px[i]/x.p)**.6*(1+.13*gauss(r));targets.push({date:new Date(d).toISOString().slice(0,10),analyst:null,firm:f+' (voorbeeld)',target:+tg.toFixed(2),priceWhen:+x.px[i].toFixed(2)});}
  const gl=['Buy','Outperform','Hold','Neutral','Overweight','Underweight','Sell'];
  for(let k=0;k<3+Math.floor(r()*5);k++){const d=TODAY-Math.floor(r()*300)*DAY;const up=r()<bull;const ng=up?gl[Math.floor(r()*2)]:gl[2+Math.floor(r()*3)];
    grades.push({date:new Date(d).toISOString().slice(0,10),firm:firms[Math.floor(r()*firms.length)]+' (voorbeeld)',action:r()<.35?(up?'upgrade':'downgrade'):'maintain',newGrade:ng,prevGrade:r()<.5?gl[Math.floor(r()*gl.length)]:null});}
  const history=[];let bb=bull-.12+(r()-.5)*.2;for(let m=23;m>=0;m--){const d=new Date(TODAY);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-m);bb=Math.min(.97,Math.max(.1,bb+(bull-bb)*.12+(r()-.5)*.07));
    const t2=tot-Math.round(m/6);const s1=Math.round(t2*bb);history.push({date:d.toISOString().slice(0,10),strongBuy:Math.round(s1*.35),buy:s1-Math.round(s1*.35),hold:Math.max(0,t2-s1-1),sell:1,strongSell:0});}
  const insiders=[];if(['ASML','ADYEN','INGA','SHELL','MSFT','NVDA','HEIA','BESI'].includes(x.t)){const roles=['CEO','CFO','Bestuurder','Commissaris','Directielid'];
    for(let k=0;k<4+Math.floor(r()*7);k++){const d=TODAY-Math.floor(r()*540)*DAY;const i=widx(d);const buy=r()<(x.ccy==='USD'?.15:.45);const sh=Math.max(5,Math.round((buy?2000:6000)*(.3+r())/x.p/5)*5);
      insiders.push({date:new Date(d).toISOString().slice(0,10),filed:new Date(d+2*DAY).toISOString().slice(0,10),name:roles[Math.floor(r()*roles.length)]+' (voorbeeld)',role:null,type:buy?'P-Purchase':'S-Sale',shares:sh,price:+x.px[i].toFixed(2),owned:null});}}
  return {cons,targets,grades,history,insiders,hi:x.fv*1.25,lo:x.fv*.72,med:x.fv,mock:true};}
STK.forEach(x=>{const L=LIVE&&LIVE.instruments[x.t];const F=L&&L.fundamentals;
  if(LIVE){const A=L&&L.analyst;x.an=A?{...A,cons:F&&F.analysts,hi:F&&F.targetHigh,lo:F&&F.targetLow,med:F&&F.targetMedian}:{cons:F&&F.analysts,targets:[],grades:[],history:[],insiders:[],hi:F&&F.targetHigh,lo:F&&F.targetLow,med:F&&F.targetMedian};}
  else x.an=mockAnalyst(x);
  if(LIVE&&L&&L.afm&&L.afm.length)x.an.insiders=[...(x.an.insiders||[]),...L.afm];
  const A=x.an;A.targets=(A.targets||[]).slice().sort((a,b)=>a.date<b.date?1:-1);A.grades=(A.grades||[]).slice().sort((a,b)=>a.date<b.date?1:-1);A.history=(A.history||[]).slice().sort((a,b)=>a.date<b.date?-1:1);
  A.insiders=(A.insiders||[]).slice().sort((a,b)=>a.date<b.date?1:-1);
  if(!A.cons&&A.history.length)A.cons=A.history.at(-1);
  // targets in de koersvaluta; hoog/laag uit losse doelen als de consensus ze niet heeft
  const act=A.targets.filter(t=>D(t.date)>TODAY-365*DAY);const latest={};act.forEach(t=>{const k=t.firm||t.analyst;if(k&&!latest[k])latest[k]=t;});A.active=Object.values(latest);
  if(!A.hi&&A.active.length){A.hi=Math.max(...A.active.map(t=>t.target));A.lo=Math.min(...A.active.map(t=>t.target));}
  A.score=rScore(A.cons);A.n=A.cons?LEVELS.reduce((a,[k])=>a+(A.cons[k]||0),0):0;A.avg=x.fv;A.up=x.fv/x.p-1;
  // momentum (guruwatch): verhogingen − verlagingen + 2 × (upgrades − downgrades), laatste 90 dagen
  const since=TODAY-90*DAY;let raises=0,cuts=0,chg=[];const byF={};[...A.targets].reverse().forEach(t=>{const k=t.firm||t.analyst;const prev=byF[k];if(prev&&D(t.date)>=since){if(t.target>prev.target*1.005)raises++;else if(t.target<prev.target*.995)cuts++;chg.push(t.target/prev.target-1);}byF[k]=t;});
  const g90=A.grades.filter(g=>D(g.date)>=since);const ups=g90.filter(g=>/^up/i.test(g.action||'')).length,downs=g90.filter(g=>/^down/i.test(g.action||'')).length;
  const avgC=chg.length?chg.reduce((a,b)=>a+b,0)/chg.length:null;
  A.mom=Math.round((raises-cuts+2*(ups-downs)+(avgC!=null?Math.max(-3,Math.min(3,avgC*20)):0))*10)/10;Object.assign(A,{raises,cuts,ups,downs,new90:A.targets.filter(t=>D(t.date)>=since).length});
  // consensus surprise: koers en verwachting lopen uiteen
  const pc=x.px[NW-1]/x.px[NW-14]-1;const old=A.targets.filter(t=>D(t.date)<=TODAY-90*DAY&&D(t.date)>TODAY-455*DAY);const oldL={};old.forEach(t=>{const k=t.firm||t.analyst;if(!oldL[k])oldL[k]=t;});
  const ov=Object.values(oldL);const tc=ov.length>=2&&A.active.length>=2?mean(A.active.map(t=>t.target))/mean(ov.map(t=>t.target))-1:null;
  A.surprise=tc==null?null:pc<=-.2&&tc>-.05?'koers-daalt':pc>=.15&&tc<0?'koers-stijgt':tc>=.1&&pc<=0?'doelen-stijgen':tc<=-.1&&pc>=0?'doelen-dalen':null;A.pc=pc;A.tc=tc;
  // insiders netto (12 mnd) in euro
  const fx=fxAt(x.ccy,NW-1);A.insNet=A.insiders.filter(t=>D(t.date)>TODAY-365*DAY&&t.price>0).reduce((a,t)=>a+(txCode(t.type)==='P'?1:txCode(t.type)==='S'?-1:0)*t.shares*t.price*fx,0);});
const SURP={'koers-daalt':['Koers zakt, analisten blijven positief','good'],'koers-stijgt':['Koers stijgt, analisten verlagen hun doelen','bad'],'doelen-stijgen':['Analisten verhogen doelen, koers nog niet mee','good'],'doelen-dalen':['Analisten verlagen doelen, koers nog niet mee','bad']};
const logo=(x,size=30)=>{const ok=['ASML','ASM','BESI','ADYEN','INGA','NN','UNA','AD','HEIA','WKL','PRX','KPN','PHIA','SAP','MC','MSFT','NVDA'].includes(x.t);
  return ok?`<img class="logo" src="logos/${x.t}.webp" alt="" width="${size}" height="${size}" loading="lazy">`:`<span class="logo mono" style="width:${size}px;height:${size}px">${x.etf?'ETF':x.t.slice(0,2)}</span>`;};

function renderAnalysts(){const b=base();const cov=STK.filter(x=>x.an.score!=null);const tw=cov.reduce((a,x)=>a+x.ws,0)||1;
  const wScore=cov.reduce((a,x)=>a+x.ws*x.an.score,0)/tw;const wUp=wavgS(x=>x.an.up);const nA=STK.reduce((a,x)=>a+x.an.n,0);const mom=STK.reduce((a,x)=>a+x.an.mom,0);
  const insAll=STK.flatMap(x=>x.an.insiders.map(t=>({...t,x})));const insNet=STK.reduce((a,x)=>a+x.an.insNet,0);const mock=STK.some(x=>x.an.mock);
  $('#anHero').innerHTML=`<div class="stat"><span class="l">Consensus, gewogen</span><span class="big">${rLabel(wScore)}</span></div>
   <div class="stat"><span class="l">Gemiddelde score</span><span class="v num">${nf2.format(wScore)} <small style="font-size:13px;color:var(--ink-3)">van 5</small></span></div>
   <div class="stat"><span class="l">Potentieel naar koersdoel</span><span class="v num ${cls(wUp)}">${pctS(wUp)}</span></div>
   <div class="stat"><span class="l">Momentum 90 dagen</span><span class="v num ${cls(mom)}">${mom>0?'+':''}${nf1.format(mom)}</span></div>
   <div class="stat"><span class="l">Insiders netto, 12 mnd</span><span class="v num ${cls(insNet)}">${insAll.length?eurS(insNet):'–'}</span></div>`;
  $('#anSub').textContent=`${nA} analistenoordelen over ${cov.length} van je ${STK.length} aandelen.${mock?' Voorbeelddata: met de FMP-key komen hier de echte koersdoelen, adviezen en insidermeldingen, net als in Guruwatch.':' Bron: Financial Modeling Prep, dezelfde data als Guruwatch.'}`;
  // koersdoelbereik
  const xs=STK.filter(x=>x.an.hi&&x.an.lo).sort((a,b2)=>b2.an.up-a.an.up);const rel=v=>v;
  C('chTargets').setOption({textStyle:b.text,grid:{left:8,right:60,top:24,bottom:24,containLabel:true},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>{const x=xs[p[0].dataIndex];return `<b>${x.n}</b><br>Koers ${px(x)}<br>Laagste doel ${px(x,x.an.lo)} (${pctS(x.an.lo/x.p-1)})<br>Gemiddeld ${px(x,x.fv)} (${pctS(x.an.up)})<br>Hoogste doel ${px(x,x.an.hi)} (${pctS(x.an.hi/x.p-1)})`;}},
   xAxis:{type:'value',splitNumber:NARROW()?3:5,...b.ax,axisLabel:{...b.ax.axisLabel,hideOverlap:true,formatter:v=>pctS(v/100,0)}},yAxis:{type:'category',inverse:true,data:xs.map(x=>x.t),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:600}},
   series:[{name:'Bereik koersdoelen',type:'custom',data:xs.map((x,i)=>[+((x.an.lo/x.p-1)*100).toFixed(1),+((x.an.hi/x.p-1)*100).toFixed(1),i]),encode:{x:[0,1],y:2},
     renderItem:(params,api)=>{const a=api.coord([api.value(0),api.value(2)]),z=api.coord([api.value(1),api.value(2)]);const h=8;return {type:'rect',shape:{x:a[0],y:a[1]-h/2,width:Math.max(2,z[0]-a[0]),height:h,r:4},style:{fill:hexA(b.acc,.3)}};},z:2},
    {name:'Gemiddeld doel',type:'scatter',symbol:'diamond',symbolSize:13,data:xs.map(x=>+(x.an.up*100).toFixed(1)),itemStyle:{color:b.acc,borderColor:b.sf,borderWidth:1.5},z:5,
     label:{show:true,position:'right',distance:10,color:b.ink2,fontSize:11,formatter:p=>pctS(p.value/100)}},
    {type:'line',data:[],markLine:{silent:true,symbol:'none',data:[{xAxis:0}],lineStyle:{color:b.ink,width:1.5},label:{formatter:'koers nu',color:b.ink2,position:'start'}}}]});
  // adviesverdeling
  const ys=STK.filter(x=>x.an.n).sort((a,b2)=>b2.an.score-a.an.score);const LC=[b.good,hexA(b.good,.55),b.ink3,hexA(b.bad,.6),b.bad];
  C('chRatings').setOption({textStyle:b.text,grid:{left:8,right:8,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2,fontSize:11.5},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>{const x=ys[p[0].dataIndex];return `<b>${x.n}</b> · ${x.an.n} analisten<br>`+p.map(s=>`${s.marker}${s.seriesName}: ${x.an.cons[LEVELS[s.seriesIndex][0]]||0}`).join('<br>')+`<br><b>${rLabel(x.an.score)} (${nf2.format(x.an.score)})</b>`;}},
   xAxis:{type:'value',max:100,show:false},yAxis:[{type:'category',inverse:true,data:ys.map(x=>x.t),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:600}},{type:'category',inverse:true,position:'right',data:ys.map(x=>rLabel(x.an.score)),axisLine:{show:false},axisTick:{show:false},axisLabel:{color:b.ink3,fontSize:11.5}}],
   series:LEVELS.map(([k,l],li)=>({name:l,type:'bar',stack:'a',barWidth:12,data:ys.map(x=>+((x.an.cons[k]||0)/x.an.n*100).toFixed(1)),itemStyle:{color:LC[li]},
    }))});
  // sentiment door de tijd
  const months=[];for(let m=23;m>=0;m--){const d=new Date(TODAY);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-m);months.push(d.toISOString().slice(0,7));}
  const zs=STK.filter(x=>x.an.history.length).sort((a,b2)=>b2.an.score-a.an.score);const cells=[];
  zs.forEach((x,yi)=>months.forEach((m,mi)=>{const h=[...x.an.history].reverse().find(r=>r.date.slice(0,7)<=m);if(!h)return;const t=LEVELS.reduce((a,[k])=>a+(h[k]||0),0);if(t)cells.push([mi,yi,+(((h.strongBuy+h.buy)/t)*100).toFixed(0)]);}));
  C('chSent').setOption({textStyle:b.text,grid:{left:8,right:8,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${zs[p.value[1]].t}</b>, ${months[p.value[0]]}<br>${p.value[2]}% kopen-adviezen`},
   xAxis:{type:'category',data:months.map(m=>MONTHS[+m.slice(5)-1]+(m.slice(5)==='01'?" '"+m.slice(2,4):'')),...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:2}},
   yAxis:{type:'category',inverse:true,data:zs.map(x=>x.t),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:600,interval:0}},
   visualMap:{show:false,min:20,max:90,inRange:{color:[css('--div-neg'),css('--div-mid'),css('--div-pos')]}},
   series:[{type:'heatmap',data:cells,itemStyle:{borderColor:b.sf,borderWidth:1.5,borderRadius:2}}]});
  // momentum en signalen
  const ms=[...STK].sort((a,b2)=>b2.an.mom-a.an.mom);
  $('#tblMom').innerHTML=`<thead><tr><th>Aandeel</th><th class="n">Momentum</th><th class="n">Doelen ↑ / ↓</th><th class="n">Up / down</th><th>Signaal</th></tr></thead><tbody>`+
   ms.map(x=>{const A=x.an;const s=A.surprise&&SURP[A.surprise];return `<tr class="click" data-t="${x.t}" tabindex="0"><td><div class="tk">${logo(x,26)}<div><b>${x.t}</b><small>${A.n?rLabel(A.score)+' · '+A.n+' analisten':'geen dekking'}</small></div></div></td>
    <td class="n num ${A.mom>0?'up':A.mom<0?'down':''}"><b>${A.mom>0?'+':''}${nf1.format(A.mom)}</b></td><td class="n num">${A.raises} / ${A.cuts}</td><td class="n num">${A.ups} / ${A.downs}</td>
    <td>${s?`<span class="pill ${s[1]}">${s[0]}</span>`:'<span style="color:var(--ink-3)">–</span>'}</td></tr>`;}).join('')+'</tbody>';
  // laatste acties
  const feed=[...STK.flatMap(x=>x.an.targets.slice(0,12).map(t=>({k:'t',d:t.date,x,t}))),...STK.flatMap(x=>x.an.grades.slice(0,8).map(g=>({k:'g',d:g.date,x,g})))].sort((a,b2)=>a.d<b2.d?1:-1).slice(0,24);
  $('#anFeed').innerHTML=feed.map(f=>{const x=f.x;if(f.k==='t'){const up=f.t.target/x.p-1;return `<div class="feed">${logo(x,28)}<div><b>${x.t}</b> koersdoel <b class="num">${px(x,f.t.target)}</b> <span class="num ${cls(up)}" style="font-size:12px">${pctS(up)} vs nu</span><small>${f.t.firm||''}${f.t.analyst?' · '+f.t.analyst:''} · ${fdate(D(f.d))}</small></div></div>`;}
    const g=f.g;return `<div class="feed">${logo(x,28)}<div><b>${x.t}</b> <span class="pill ${/^up/i.test(g.action||'')?'good':/^down/i.test(g.action||'')?'bad':'neu'}">${actLbl(g.action)}</span> <span class="pill ${gTone(g.newGrade)}">${g.newGrade||'–'}</span>${g.prevGrade&&g.prevGrade!==g.newGrade?` <span style="color:var(--ink-3);font-size:12px">was ${g.prevGrade}</span>`:''}<small>${g.firm||''} · ${fdate(D(f.d))}</small></div></div>`;}).join('')||'<p class="note">Geen recente acties.</p>';
  // insiders
  const im={};const k0=new Date(TODAY).getUTCFullYear()*12+new Date(TODAY).getUTCMonth()-17;const ks=[];for(let q=k0;q<=k0+17;q++)ks.push(q);
  insAll.forEach(t=>{const d=new Date(D(t.date));const q=d.getUTCFullYear()*12+d.getUTCMonth();if(q<k0||!(t.price>0))return;const c=txCode(t.type);if(c!=='P'&&c!=='S')return;im[q]=im[q]||{b:0,s:0};im[q][c==='P'?'b':'s']+=t.shares*t.price*fxAt(t.x.ccy,NW-1);});
  C('chIns').setOption({textStyle:b.text,grid:{left:8,right:8,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},valueFormatter:v=>eur(Math.abs(v))},
   xAxis:{type:'category',data:ks.map(q=>MONTHS[q%12]+(q%12===0?" '"+String(Math.floor(q/12)).slice(2):'')),...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>(v<0?'−':'')+'€ '+nf0.format(Math.abs(v)/1000)+'k'}},
   series:[{name:'Aankopen',type:'bar',stack:'i',data:ks.map(q=>Math.round(im[q]?.b||0)),itemStyle:{color:b.good,borderRadius:[3,3,0,0]}},{name:'Verkopen',type:'bar',stack:'i',data:ks.map(q=>-Math.round(im[q]?.s||0)),itemStyle:{color:b.bad,borderRadius:[0,0,3,3]}}]});
  const srcs=LIVE&&(LIVE.insiderSources||(LIVE.afm?[LIVE.afm]:[]));const srcNL={'AFM MAR 19':'AFM (NL)','SIX SER':'SIX (CH)','AMF BDIF':'AMF (FR)','FSMA':'FSMA (BE)'};
  $('#insSrc').textContent=!LIVE?'Voorbeelddata. Live komen meldingen uit het AFM-register (NL), de FSMA (België), SIX (Zwitserland), de AMF (Frankrijk) en voor Amerikaanse aandelen uit SEC-meldingen via FMP.':
   (srcs||[]).map(st=>`${srcNL[st.source]||st.source}: ${st.ok?`${nf0.format(st.rows||0)} meldingen gelezen, ${st.matched||0} over jouw aandelen`:`niet bereikbaar${st.error?' ('+String(st.error).slice(0,80)+')':''}`}`).join(' · ')+'. Amerikaanse aandelen via SEC-meldingen (FMP). AFM en AMF geven datum en melder; aantal en prijs staan in de melding zelf. Duitsland, Denemarken en Londen hebben geen bruikbare openbare export.';
  $('#tblIns').innerHTML=insAll.length?`<thead><tr><th>Datum</th><th>Aandeel</th><th>Insider</th><th>Soort</th><th class="n">Aantal</th><th class="n">Prijs</th><th class="n">Waarde</th></tr></thead><tbody>`+
   insAll.sort((a,b2)=>a.date<b2.date?1:-1).slice(0,40).map(t=>{const c=txCode(t.type);return `<tr><td class="num" title="Gemeld ${t.filed?fdate(D(t.filed)):'–'}">${fdate(D(t.date))}</td><td><div class="tk">${logo(t.x,22)}<b>${t.x.t}</b></div></td><td>${t.url?`<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name||'Melding')}</a>`:esc(t.name||'–')}<span class="sub2">${[t.role?esc(roleNL(t.role)):'',t.source&&t.source!=='FMP'?esc(t.source):'',t.option?'optieprogramma':''].filter(Boolean).join(' · ')}</span></td>
    <td><span class="pill ${c==='P'?'good':c==='S'?'bad':'neu'}">${t.type==='J-Melding'?'Melding':TXT[c]||t.type||'–'}</span></td><td class="n num">${t.shares>0?nf0.format(t.shares):'–'}</td><td class="n num">${t.price>0?px(t.x,t.price):'–'}</td><td class="n num"><b>${t.price>0?eur(t.shares*t.price*fxAt(t.x.ccy,NW-1)):'–'}</b></td></tr>`;}).join('')+'</tbody>':'<tbody><tr><td class="note">Geen insidertransacties gevonden.</td></tr></tbody>';}

/* ============ chart infra ============ */
const charts={};
function C(id){if(charts[id]){charts[id].dispose();}const el=document.getElementById(id);const c=echarts.init(el,null,{renderer:'svg'});charts[id]=c;return c;}
function base(){const ink=css('--ink'),ink2=css('--ink-2'),ink3=css('--ink-3'),line=css('--line'),sf=css('--surface');
  return {ink,ink2,ink3,line,sf,acc:css('--accent'),good:css('--good'),bad:css('--bad'),warn:css('--warn'),mkt:css('--mkt'),
    cat:[1,2,3,4,5,6,7,8].map(i=>css('--c'+i)),
    text:{color:ink2,fontFamily:'Inter, system-ui, sans-serif',fontSize:12},
    tip:{backgroundColor:sf,borderColor:line,borderWidth:1,textStyle:{color:ink,fontSize:12.5,fontFamily:'Inter, system-ui, sans-serif'},extraCssText:'box-shadow:0 6px 24px rgba(0,0,0,.14);border-radius:8px;'},
    ax:{axisLine:{lineStyle:{color:line}},axisTick:{show:false},axisLabel:{color:ink3,fontSize:11.5,hideOverlap:true},splitLine:{lineStyle:{color:line,opacity:.7}}}};}
const mix=(c,a)=>`color-mix(in srgb, ${c} ${Math.round(a*100)}%, transparent)`;
function hexA(hex,a){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
const SECCOL={}; ['Technologie','Financiën','Consumentengoederen','Communicatie','Energie','Zakelijke diensten','Gezondheidszorg'].forEach((s,i)=>SECCOL[s]=i);

/* glyph: mini pentagon score */
function glyph(s,size=30){const c=size/2,R=size/2-2;const pt=(k,r)=>{const a=-Math.PI/2+k*2*Math.PI/5;return [c+r*Math.cos(a),c+r*Math.sin(a)];};
  const outer=AXES.map((_,k)=>pt(k,R).join(',')).join(' ');const inner=s.map((v,k)=>pt(k,R*Math.max(.12,v/6)).join(',')).join(' ');
  const avg=s.reduce((a,b)=>a+b,0)/5;const col=avg>=4?'var(--good)':avg>=3?'var(--accent)':'var(--warn)';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="Kompasscore ${s.join(', ')}" role="img"><polygon points="${outer}" fill="var(--surface-2)" stroke="var(--line)"/><polygon points="${inner}" fill="${col}" fill-opacity=".85"/></svg>`;}
function spark(x,w=84,h=26){const a=x.px.slice(-26);const mn=Math.min(...a),mx=Math.max(...a);const pts=a.map((v,i)=>[i/(a.length-1)*w,h-2-(v-mn)/(mx-mn||1)*(h-4)]);
  const up=a[a.length-1]>=a[0];const col=up?'var(--good)':'var(--bad)';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="Koers laatste 6 maanden ${up?'gestegen':'gedaald'}" role="img"><polyline points="${pts.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${pts.at(-1)[0].toFixed(1)}" cy="${pts.at(-1)[1].toFixed(1)}" r="2.2" fill="${col}"/></svg>`;}
const CSYM={EUR:'€ ',USD:'$ ',CHF:'CHF ',DKK:'DKK '};
const px=(x,v=x.p)=>(CSYM[x.ccy]||x.ccy+' ')+nf2.format(v);
const valPill=x=>{if(x.etf)return `<span class="pill neu">ETF · ${x.acc?'accumulerend':'uitkerend'} · TER ${nf2.format(x.ter)}%</span>`;const d=x.disc;return Math.abs(d)<.05?`<span class="pill neu">rond ${FV_L}</span>`:d>0?`<span class="pill good">${pct(d,0)} onder ${FV_L}</span>`:`<span class="pill bad">${pct(-d,0)} boven ${FV_L}</span>`;};

/* ============ OVERZICHT ============ */
function renderHero(){
  $('#heroStats').innerHTML=`<div class="stat"><span class="l">Totale waarde · ${OPEN.length} posities</span><span class="big num">${eur(TOTAL+OPTT.val)}</span></div>
   <div class="stat"><span class="l">Vandaag</span><span class="v num ${cls(T.day)}">${eurS(T.day)} <small style="font-size:13px">${pctS(T.day/(TOTAL-T.day),2)}</small></span></div>
   <div class="stat"><span class="l">Totaal resultaat</span><span class="v num ${cls(T.total)}">${eurS(T.total)}</span></div>
   <div class="stat"><span class="l">Rendement per jaar (IRR)</span><span class="v num ${cls(IRR)}">${pct(IRR)}</span></div>`;
  const fwd=DIVS.filter(v=>!v.hist).reduce((a,v)=>a+v.net,0);
  $('#ovKpis').innerHTML=[
   ['Ongerealiseerd koersresultaat',eurS(T.priceGain),pctS(T.priceGain/T.cost)+' op inleg',T.priceGain],
   ['Gerealiseerd resultaat',eurS(T.real),'uit '+TX.filter(t=>t.ty==='SELL').length+' verkopen',T.real],
   ['Ontvangen dividend (netto)',eur(T.divG-T.divT),'na '+eur(T.divT)+' bronbelasting',1],
   ['Valuta-effect',eurS(T.fxGain),'dollar, frank en kroon',T.fxGain],
   ['Verwacht dividend 12 mnd',eur(fwd),pct(fwd/TOTAL,2)+' netto rendement',1],
   ['Resultaat opties',eurS(OPTT.total),'<a href="#opties" style="color:var(--accent)">'+OPEN_OPT.length+' lopend, bekijk ›</a>',OPTT.total],
   ['Box 3-indicatie '+new Date(TODAY).getUTCFullYear(),eur(box3Year(new Date(TODAY).getUTCFullYear()).tax),'<a href="#belasting" style="color:var(--accent)">bekijk berekening ›</a>',1]].map(([l,v,s,c])=>`<div class="kpi"><span>${l}</span><b class="${c<0?'down':''}">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');
  $('#posCount').textContent=OPEN.length+' posities';
}
let ovMode='value',ovRange=0;
function renderValue(){const b=base(),c=C('chValue');const n=ovRange||NW;const i0=Math.max(0,NW-n);const xs=[];for(let i=i0;i<NW;i++)xs.push(i);
  let series,yfmt,leg;
  if(ovMode==='value'){series=[
    {name:'Waarde',type:'line',showSymbol:false,data:xs.map(i=>[wdate(i),Math.round(SER.v[i])]),lineStyle:{width:2,color:b.acc},itemStyle:{color:b.acc},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:hexA(b.acc,.28)},{offset:1,color:hexA(b.acc,0)}]}}},
    {name:'Inleg',type:'line',step:'end',showSymbol:false,data:xs.map(i=>[wdate(i),Math.round(SER.inv[i])]),lineStyle:{width:2,color:b.mkt,type:'dashed'},itemStyle:{color:b.mkt}}];
    yfmt=v=>'€ '+(v>=1000?nf0.format(v/1000)+'k':v);leg=`<span><i class="line" style="background:var(--accent)"></i>Waarde portefeuille</span><span><i class="dash"></i>Netto inleg</span>`;}
  else{const p0=SER.idx[i0],a0=AEX[i0];series=[
    {name:'Portefeuille',type:'line',showSymbol:false,data:xs.map(i=>[wdate(i),+(SER.idx[i]/p0*100-100).toFixed(2)]),lineStyle:{width:2,color:b.acc},itemStyle:{color:b.acc}},
    {name:'AEX',type:'line',showSymbol:false,data:xs.map(i=>[wdate(i),+(AEX[i]/a0*100-100).toFixed(2)]),lineStyle:{width:2,color:b.mkt,type:'dashed'},itemStyle:{color:b.mkt}}];
    yfmt=v=>v+'%';leg=`<span><i class="line" style="background:var(--accent)"></i>Portefeuille (tijdgewogen)</span><span><i class="dash"></i>AEX (koersindex)</span>`;}
  $('#lgValue').innerHTML=leg;
  c.setOption({textStyle:b.text,grid:{left:8,right:12,top:14,bottom:8,containLabel:true},
    tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'line',lineStyle:{color:b.ink3}},valueFormatter:v=>ovMode==='value'?eur(v):pctS(v/100)},
    xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:yfmt},scale:ovMode!=='value'},series});}
function radarOpt(b,showMarket=true,big=false){return {textStyle:b.text,tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${p.name}</b><br>`+AXES.map((a,k)=>`${a}: ${nf2.format(p.value[k])} / 6`).join('<br>')},
  radar:{indicator:AXES.map(a=>({name:a,max:6})),radius:NARROW()?'56%':big?'68%':'64%',splitNumber:6,shape:'polygon',axisName:{color:b.ink2,fontSize:big?12.5:11.5,fontWeight:600},
    splitLine:{lineStyle:{color:b.line}},splitArea:{areaStyle:{color:['transparent']}},axisLine:{lineStyle:{color:b.line}}},
  series:[{type:'radar',symbol:'circle',symbolSize:big?7:5,data:[
    ...(showMarket?[{name:'AEX',value:MARKET.s,lineStyle:{color:b.mkt,type:'dashed',width:1.5},itemStyle:{color:b.mkt},areaStyle:{opacity:0}}]:[]),
    {name:'Portefeuille',value:PSCORE.map(v=>+v.toFixed(2)),lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.22)}}]}]};}
function renderRadarOv(){const b=base();C('chRadarOv').setOption(radarOpt(b));
  const hi=AXES.map((a,k)=>[a,PSCORE[k]]).sort((x,y)=>y[1]-x[1]);
  $('#kompasLine').innerHTML=`Sterk op <b>${hi[0][0].toLowerCase()}</b> (${nf2.format(hi[0][1])}) en <b>${hi[1][0].toLowerCase()}</b>, het zwakst op <b>${hi[4][0].toLowerCase()}</b> (${nf2.format(hi[4][1])}).`;}
function renderHoldings(){
  $('#tblHoldings').innerHTML=`<thead><tr><th>Positie</th><th class="n">Koers</th><th>Waardering</th><th class="n">Waarde</th><th>Gewicht</th><th class="n">Totaal resultaat</th><th>6 mnd</th></tr></thead><tbody>`+
   OPEN.map(x=>`<tr class="click" data-t="${x.t}" tabindex="0"><td><div class="tk">${logo(x)}<div><b>${x.t}</b><small>${x.n}</small></div>${x.etf?'':`<span class="gl" title="Kompasscore">${glyph(x.s,22)}</span>`}</div></td>
    <td class="n num">${px(x)}<span class="sub2 ${cls(x.day)}">${pctS(x.day,2)}</span></td><td>${valPill(x)}</td>
    <td class="n num">${eur(x.val)}<span class="sub2">${nf0.format(x.q)} st.</span></td>
    <td class="num"><span class="wbar"><i style="width:${Math.min(100,x.w/OPEN[0].w*100)}%"></i></span>${pct(x.w)}</td>
    <td class="n num ${cls(x.totRes)}">${eurS(x.totRes)}<span class="sub2 ${cls(x.totRes)}">${pctS(x.totPct)}</span></td><td>${spark(x)}</td></tr>`).join('')+'</tbody>';
}

/* ============ ANALYSE ============ */
let axisSel=1;
function renderRadar(){const b=base();C('chRadar').setOption(radarOpt(b,true,true));}
function renderLift(){
  $('#axisPick').innerHTML=AXES.map((a,k)=>`<button aria-pressed="${k===axisSel}" data-k="${k}">${a} <span class="num" style="color:var(--ink-3)">${nf2.format(PSCORE[k])}</span></button>`).join('');
  $('#axisDesc').textContent=AXDESC[AXES[axisSel]];
  const s=[...STK].sort((a,b)=>b.s[axisSel]-a.s[axisSel]||b.w-a.w);
  const row=x=>{const v=x.s[axisSel];const col=v>=4?'var(--good)':v>=3?'var(--accent)':'var(--bad)';return `<div class="lrow"><b>${x.t}</b><div class="bar"><i style="width:${v/6*100}%;background:${col}"></i></div><span class="sc">${v}/6</span></div>`;};
  $('#liftUp').innerHTML=s.slice(0,5).map(row).join('');$('#liftDown').innerHTML=s.slice(-5).reverse().map(row).join('');}
const STRIPS=[
 {k:'pe',l:'Koers/winst',d:'Koers-winstverhouding per positie. Lager is goedkoper.',low:true,f:v=>nf0.format(v)+'x',m:MARKET.pe},
 {k:'g',l:'Winstgroei',d:'Verwachte jaarlijkse winstgroei komende drie jaar. Hoger is beter.',low:false,f:v=>v+'%',m:MARKET.g},
 {k:'roe',l:'Rendement eigen vermogen',d:'Winst als percentage van het eigen vermogen. Hoger is beter.',low:false,f:v=>v+'%',m:MARKET.roe},
 {k:'de',l:'Schuld/eigen vermogen',d:'Netto schuld als percentage van het eigen vermogen. Lager is gezonder.',low:true,f:v=>v+'%',m:MARKET.de},
 {k:'yld',l:'Dividendrendement',d:'Verwacht dividend als percentage van de koers. Hoger levert meer inkomen.',low:false,f:v=>nf2.format(v)+'%',m:MARKET.yld*100}];
let stripSel=0;
function renderStrip(){const b=base(),S=STRIPS[stripSel];
  $('#stripPick').innerHTML=STRIPS.map((s,i)=>`<button aria-pressed="${i===stripSel}" data-i="${i}">${s.l}</button>`).join('');
  $('#stripDesc').textContent=S.d;
  const val=x=>S.k==='yld'?x.yld*100:x[S.k];
  let pts=STK.map(x=>({x,v:val(x)}));
  const vals=pts.map(p=>p.v).sort((a,b)=>a-b);const q1=vals[Math.floor(vals.length*.25)],q3=vals[Math.floor(vals.length*.75)],lim=q3+3*(q3-q1);
  const hidden=pts.filter(p=>p.v>lim);pts=pts.filter(p=>p.v<=lim);
  const port=wavgS(val);
  // simple dodge: sort by value and stack rows when bubbles collide
  const mx=Math.max(...pts.map(p=>p.v),S.m,port)*1.08,mn=Math.min(0,...pts.map(p=>p.v));
  const placed=[];pts.sort((a,b)=>b.x.w-a.x.w).forEach(p=>{const span=(mx-mn)*.07;let lane=0;const lanes=[0,1,-1,2,-2,3,-3];for(const L of lanes){if(!placed.some(q=>q.lane===L&&Math.abs(q.v-p.v)<span)){lane=L;break;}}p.lane=lane;placed.push(p);});
  const good=p=>S.low?p.v<=S.m:p.v>=S.m;
  C('chStrip').setOption({textStyle:b.text,grid:{left:16,right:24,top:44,bottom:28},
   tooltip:{...b.tip,trigger:'item',formatter:p=>p.data.x?`<b>${p.data.x.t}</b> · ${p.data.x.n}<br>${S.l}: ${S.f(+p.data.value[0].toFixed(2))}<br>Gewicht: ${pct(p.data.x.w)} van de portefeuille`:''},
   xAxis:{type:'value',min:mn,max:mx,...b.ax,splitLine:{show:true,lineStyle:{color:b.line,opacity:.6}},axisLabel:{...b.ax.axisLabel,formatter:v=>S.f(+v.toFixed(1))}},
   yAxis:{type:'value',min:-3.6,max:3.6,show:false},
   series:[{type:'scatter',data:pts.map(p=>({value:[p.v,p.lane*.95],x:p.x,symbolSize:14+Math.sqrt(p.x.ws)*56,itemStyle:{color:good(p)?b.good:b.bad,borderColor:b.sf,borderWidth:2,opacity:.92},
      label:{show:true,formatter:p.x.t,position:p.x.ws>.1?'inside':(p.lane<0?'bottom':'top'),color:p.x.ws>.1?'#fff':b.ink2,fontSize:10.5,fontWeight:600}})),
     markLine:{silent:true,symbol:'none',data:[
      {xAxis:S.m,lineStyle:{color:b.mkt,type:'dashed',width:1.5},label:{formatter:'AEX '+S.f(+S.m.toFixed(1)),color:b.ink2,position:'end',fontSize:11.5}},
      {xAxis:+port.toFixed(2),lineStyle:{color:b.acc,width:2,type:'solid'},label:{formatter:'Portefeuille '+S.f(+port.toFixed(1)),color:b.acc,fontWeight:600,position:'start',fontSize:11.5}}]}}]});
  $('#stripNote').textContent=hidden.length?`${hidden.map(p=>p.x.t).join(' en ')} (${hidden.map(p=>S.f(p.v)).join(', ')}) valt ver buiten de rest en is niet getoond. De portefeuillelijn rekent wel mee.`:'';}
function renderSankey(){const b=base();const nodes=[{name:'Portefeuille'}],links=[];const seen=new Set(['Portefeuille']);
  const add=(n,col)=>{if(!seen.has(n)){seen.add(n);nodes.push({name:n,itemStyle:col?{color:col}:undefined});}};
  const bySec={};OPEN.forEach(x=>{(bySec[x.sec]=bySec[x.sec]||[]).push(x);});
  Object.entries(bySec).sort((a,b)=>b[1].reduce((s,x)=>s+x.w,0)-a[1].reduce((s,x)=>s+x.w,0)).forEach(([sec,xs])=>{const col=b.cat[SECCOL[sec]%8];add(sec,col);
    links.push({source:'Portefeuille',target:sec,value:+(xs.reduce((s,x)=>s+x.w,0)*100).toFixed(2)});
    if(NARROW()){xs.forEach(y=>{add(y.t,col);links.push({source:sec,target:y.t,value:+(y.w*100).toFixed(2)});});return;}
    const byInd={};xs.forEach(x=>{(byInd[x.ind]=byInd[x.ind]||[]).push(x);});
    Object.entries(byInd).forEach(([ind,ys])=>{add(ind,col);links.push({source:sec,target:ind,value:+(ys.reduce((s,x)=>s+x.w,0)*100).toFixed(2)});
      ys.forEach(y=>{add(y.t,col);links.push({source:ind,target:y.t,value:+(y.w*100).toFixed(2)});});});});
  nodes[0].itemStyle={color:b.acc};
  C('chSankey').setOption({textStyle:b.text,tooltip:{...b.tip,trigger:'item',formatter:p=>p.dataType==='edge'?`${p.data.source} → ${p.data.target}: ${nf2.format(p.data.value)}%`:`<b>${p.name}</b>`},
   series:[{type:'sankey',left:4,right:NARROW()?96:150,layoutIterations:0,top:8,bottom:8,nodeWidth:10,nodeGap:9,nodeAlign:'justify',draggable:false,data:nodes,links,
    lineStyle:{color:'source',opacity:.28,curveness:.5},emphasis:{focus:'adjacency'},
    label:{color:b.ink,fontSize:NARROW()?10.5:12,formatter:p=>{const v=links.filter(l=>l.target===p.name).reduce((s,l)=>s+l.value,0);return p.name==='Portefeuille'?'':`${p.name}  {m|${nf2.format(v).replace(/,?0+$/,'')}%}`;},rich:{m:{color:b.ink3,fontSize:11}}}}]});}
const NARROW=()=>window.innerWidth<640;
// op smalle schermen staat de legenda onder de taart, zodat niets overlapt
function donut(id,data){const b=base();const el=document.getElementById(id);const nar=el.clientWidth<480;
  if(nar){el.style.height=(230+Math.ceil(data.length/2)*24)+'px';}else el.style.height='';
  C(id).setOption({textStyle:b.text,tooltip:{...b.tip,trigger:'item',formatter:p=>`${p.name}: ${pct(p.value/100)}`},
  legend:nar?{orient:'horizontal',left:'center',bottom:0,itemGap:12,textStyle:{color:b.ink2,fontSize:11.5},icon:'roundRect',itemWidth:10,itemHeight:10,formatter:n=>`${n}  ${pct(data.find(d=>d.name===n).value/100)}`}
   :{orient:'vertical',right:0,top:'middle',textStyle:{color:b.ink2,fontSize:12},icon:'roundRect',itemWidth:10,itemHeight:10,formatter:n=>`${n}  ${pct(data.find(d=>d.name===n).value/100)}`},
  series:[{type:'pie',radius:nar?[56,88]:['52%','78%'],center:nar?['50%',98]:['30%','50%'],padAngle:1.5,itemStyle:{borderRadius:4,borderColor:b.sf,borderWidth:2},label:{show:false},data:data.map((d,i)=>({...d,itemStyle:{color:b.cat[d.ci??i]}}))}]});}
function renderGeo(){const R=['Europa','Noord-Amerika','Azië-Pacific','Overig'];const v=R.map((_,k)=>OPEN.reduce((a,x)=>a+x.w*x.geo[k],0));
  donut('chGeo',R.map((n,k)=>({name:n,value:+v[k].toFixed(1)})));
  const ccy={};OPEN.forEach(x=>ccy[x.ccy]=(ccy[x.ccy]||0)+x.w*100);const CNm={EUR:'Euro',USD:'Amerikaanse dollar',CHF:'Zwitserse frank',DKK:'Deense kroon'};donut('chCcy',Object.entries(ccy).sort((a,b)=>b[1]-a[1]).map(([n,v],i)=>({name:CNm[n]||n,value:+v.toFixed(1),ci:i})));}
function renderCorr(){const b=base();const xs=[...OPEN].sort((a,b)=>a.sec.localeCompare(b.sec)||b.w-a.w);const n=xs.length;const R=xs.map(x=>x.ret.slice(R0));const data=[];const pairs=[];
  for(let i=0;i<n;i++)for(let j=0;j<i;j++){const c=corr(R[i],R[j]);data.push([j,i,+c.toFixed(2)]);pairs.push([xs[i].t,xs[j].t,c]);}
  C('chCorr').setOption({textStyle:b.text,grid:{left:8,right:8,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${xs[p.value[1]].t} / ${xs[p.value[0]].t}</b><br>Correlatie: ${nf2.format(p.value[2])}`},
   xAxis:{type:'category',data:xs.map(x=>x.t),max:n-2,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,rotate:NARROW()?90:45,interval:0,fontSize:NARROW()?8.5:11.5}},
   yAxis:{type:'category',data:xs.map(x=>x.t),inverse:true,min:1,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:0}},
   visualMap:{min:-1,max:1,show:false,inRange:{color:[css('--div-neg'),css('--div-mid'),css('--div-pos')]}},
   series:[{type:'heatmap',data,itemStyle:{borderColor:b.sf,borderWidth:2,borderRadius:3},label:{show:window.innerWidth>700,fontSize:10,color:b.ink,formatter:p=>nf2.format(p.value[2]).replace('0,',',')}}]});
  pairs.sort((a,b)=>b[2]-a[2]);const pr=(p,col)=>`<div class="lrow" style="grid-template-columns:110px 1fr 44px"><b>${p[0]} / ${p[1]}</b><div class="bar"><i style="width:${Math.abs(p[2])*100}%;background:${col}"></i></div><span class="sc">${nf2.format(p[2])}</span></div>`;
  $('#corrTop').innerHTML=pairs.slice(0,5).map(p=>pr(p,'var(--div-pos)')).join('');$('#corrLow').innerHTML=pairs.slice(-5).reverse().map(p=>pr(p,'var(--div-neg)')).join('');}
function renderRisk(){
  $('#riskGauge').innerHTML=`<div class="pin" style="left:${RISK.score}%"><span>Jouw portefeuille ${RISK.score}/100</span></div><div class="pin m" style="left:${RISK.mscore}%"><span>AEX ${RISK.mscore}</span></div>`;
  const t=(l,v,e)=>`<div class="kpi"><span>${l}</span><b>${v}</b><em>${e}</em></div>`;
  $('#riskTiles').innerHTML=[
   t('Volatiliteit',pct(RISK.vol),`AEX ${pct(RISK.mvol)}, ${RISK.vol>RISK.mvol?'beweeglijker':'rustiger'} dan de markt`),
   t('Grootste daling',pct(RISK.dd),`AEX ${pct(RISK.mdd)}, gemeten van piek tot dal`),
   t('Bèta',nf2.format(RISK.beta)+'x',`${RISK.beta>1?pct(RISK.beta-1,0)+' gevoeliger':pct(1-RISK.beta,0)+' minder gevoelig'} voor AEX-bewegingen`),
   t('Top-3 concentratie',pct(RISK.top3),`Grootste positie is ${OPEN[0].n} (${pct(OPEN[0].w)})`),
   t('Sharpe-ratio',nf2.format(RISK.sharpe),`AEX ${nf2.format(RISK.msharpe)} · boven 1 geldt als goed`),
   t('Sortino-ratio',nf2.format(RISK.sortino),'Rendement per eenheid neerwaarts risico')].join('');
  const b=base();const xs=[...OPEN].sort((a,b)=>a.vol-b.vol);const rows=[...xs.map(x=>({n:x.t,v:x.vol,c:x.vol>RISK.mvol*1.6?b.bad:b.cat[0]})),{n:'Portefeuille',v:RISK.vol,c:b.acc},{n:'AEX',v:RISK.mvol,c:b.mkt}].sort((a,b)=>a.v-b.v);
  C('chVol').setOption({textStyle:b.text,grid:{left:8,right:56,top:4,bottom:4,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${p.name}</b>: ${pct(p.value)}`},
   xAxis:{type:'value',show:false},yAxis:{type:'category',data:rows.map(r=>r.n),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:500,fontSize:12,formatter:v=>v==='Portefeuille'||v==='AEX'?`{b|${v}}`:v,rich:{b:{fontWeight:700,color:b.ink}}}},
   series:[{type:'bar',barWidth:12,data:rows.map(r=>({value:r.v,name:r.n,itemStyle:{color:r.c,borderRadius:[0,4,4,0]}})),label:{show:true,position:'right',color:b.ink2,fontSize:11.5,formatter:p=>pct(p.value)},showBackground:true,backgroundStyle:{color:css('--surface-2'),borderRadius:4}}]});
  $('#chVol').setAttribute('aria-label','Rood: meer dan 1,6 keer zo beweeglijk als de AEX');}

/* ============ WAARDERING ============ */
function renderVal(){const fvTot=STK.reduce((a,x)=>a+x.q*x.fv*x.fxNow,0);const under=STK.filter(x=>x.disc>0);
  $('#valHero').innerHTML=`<div class="stat"><span class="l">Waarde aandelen (zonder ETF's)</span><span class="big num">${eur(STOT)}</span></div>
   <div class="stat"><span class="l">${LIVE?"Koersdoel analisten, gewogen":"Geschatte reële waarde"}</span><span class="v num">${eur(fvTot)}</span></div>
   <div class="stat"><span class="l">Verschil</span><span class="v num ${cls(fvTot-STOT)}">${pctS((fvTot-STOT)/fvTot)} ${fvTot>TOTAL?'onder':'boven'} ${FV_L}</span></div>`;
  $('#valKpis').innerHTML=[
   ['Deel ondergewaardeerd',pct(under.reduce((a,x)=>a+x.ws,0),0),under.length+' posities','up'],
   ['Deel overgewaardeerd',pct(1-under.reduce((a,x)=>a+x.ws,0),0),(STK.length-under.length)+' posities','down'],
   ['Gewogen opwaarts potentieel',eurS(fvTot-STOT),'als alle posities naar '+FV_L+' gaan',''],
   ['Gewogen koers/winst',nf2.format(wavgS(x=>x.pe))+'x','AEX '+nf2.format(MARKET.pe)+'x','']].map(([l,v,s,c])=>`<div class="kpi"><span>${l}</span><b class="${c}">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');
  const b=base();const xs=[...STK].sort((a,b)=>b.disc-a.disc);
  C('chVal').setOption({textStyle:b.text,grid:{left:8,right:60,top:8,bottom:24,containLabel:true},
   tooltip:{...b.tip,trigger:'item',formatter:p=>{const x=xs[p.dataIndex];return `<b>${x.t}</b> · ${x.n}<br>Koers ${px(x)} · ${FV_L} ${px(x,x.fv)}<br>${x.disc>0?'Onder':'Boven'} ${FV_L}: ${pct(Math.abs(x.disc))}`;}},
   xAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>pctS(v/100,0)}},
   yAxis:{type:'category',inverse:true,data:xs.map(x=>x.t),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:600,fontSize:12}},
   series:[{type:'bar',barWidth:14,data:xs.map(x=>{const v=+(-x.disc*100).toFixed(1);return {value:v,itemStyle:{color:v<=0?b.good:b.bad,borderRadius:v<=0?[4,0,0,4]:[0,4,4,0]}};}),
    label:{show:true,position:'right',formatter:p=>pctS(p.value/100),color:b.ink2,fontSize:11.5},markLine:{silent:true,symbol:'none',data:[{xAxis:0}],lineStyle:{color:b.ink3,width:1},label:{show:false}}}]});
  $('#tblVal').innerHTML=`<thead><tr><th>Positie</th><th class="n">Koers</th><th class="n">${FV_U}</th><th>Oordeel</th><th class="n">Potentieel</th><th class="n">K/W</th></tr></thead><tbody>`+
   xs.map(x=>`<tr class="click" data-t="${x.t}" tabindex="0"><td><div class="tk">${glyph(x.s,26)}<div><b>${x.t}</b><small>${x.n}</small></div></div></td><td class="n num">${px(x)}</td><td class="n num">${px(x,x.fv)}</td><td>${valPill(x)}</td><td class="n num ${cls(x.fv-x.p)}">${eurS(x.q*(x.fv-x.p)*x.fxNow)}</td><td class="n num">${x.pe}x</td></tr>`).join('')+'</tbody>';}

/* ============ DIVIDEND ============ */
let divGran='m', calM=Date.UTC(2026,10,1);
function renderDivHero(){const fwd=DIVS.filter(v=>!v.hist);const last12=DIVS.filter(v=>v.hist&&v.pay>TODAY-365*DAY);
  const F=fwd.reduce((a,v)=>a+v.net,0),L=last12.reduce((a,v)=>a+v.net,0);const payers=new Set(fwd.map(v=>v.t)).size;
  const cost=OPEN.reduce((a,x)=>a+x.cost,0);
  $('#divHero').innerHTML=`<div class="stat"><span class="l">Verwacht netto, komende 12 maanden · ${payers} betalers</span><span class="big num">${eur(F)}</span><span class="${cls(F-L)}" style="font-size:13px">${pctS(F/L-1)} t.o.v. ontvangen afgelopen 12 maanden</span></div>
   <div class="stat"><span class="l">Gemiddeld per maand</span><span class="v num">${eur(F/12)}</span></div>
   <div class="stat"><span class="l">Rendement (bruto)</span><span class="v num">${pct(fwd.reduce((a,v)=>a+v.gross,0)/TOTAL,2)}</span></div>
   <div class="stat"><span class="l">Rendement op inleg</span><span class="v num">${pct(fwd.reduce((a,v)=>a+v.gross,0)/cost,2)}</span></div>
   <div class="stat"><span class="l">Bronbelasting (15%)</span><span class="v num">${eur(fwd.reduce((a,v)=>a+v.tax,0))}</span></div>`;}
function renderDiv(){const b=base();const soft=hexA(b.acc,.38);let cats=[],rec=[],exp=[];
  if(divGran==='m'){for(let y=2023,m=11;!(y===2027&&m===11);){const t=Date.UTC(y,m-1,1),t2=Date.UTC(m===12?y+1:y,m%12,1);cats.push(MONTHS[m-1]+(m===1||cats.length===0?" '"+String(y).slice(2):''));
      const inM=DIVS.filter(v=>v.pay>=t&&v.pay<t2);rec.push(+inM.filter(v=>v.hist).reduce((a,v)=>a+v.net,0).toFixed(2));exp.push(+inM.filter(v=>!v.hist).reduce((a,v)=>a+v.net,0).toFixed(2));m++;if(m>12){m=1;y++;}}}
  else{for(let y=2019;y<=2027;y++){cats.push(String(y));const inY=DIVS.filter(v=>new Date(v.pay).getUTCFullYear()===y);rec.push(+inY.filter(v=>v.hist).reduce((a,v)=>a+v.net,0).toFixed(2));exp.push(+inY.filter(v=>!v.hist).reduce((a,v)=>a+v.net,0).toFixed(2));}}
  C('chDiv').setOption({textStyle:b.text,grid:{left:8,right:8,top:16,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},valueFormatter:v=>eur(v,0)},
   xAxis:{type:'category',data:cats,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:divGran==='m'?1:0}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v)}},
   series:[{name:'Ontvangen',type:'bar',stack:'d',barMaxWidth:28,data:rec,itemStyle:{color:b.acc,borderRadius:[4,4,0,0]}},{name:'Verwacht',type:'bar',stack:'d',data:exp,itemStyle:{color:soft,borderRadius:[4,4,0,0]}}]});}
function renderDivContrib(){const b=base();const fwd=DIVS.filter(v=>!v.hist);const by={};fwd.forEach(v=>by[v.t]=(by[v.t]||0)+v.net);
  const rows=Object.entries(by).sort((a,b)=>a[1]-b[1]);const tot=rows.reduce((a,r)=>a+r[1],0);
  C('chDivContrib').setOption({textStyle:b.text,grid:{left:8,right:96,top:4,bottom:4,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${p.name}</b>: ${eur(p.value)} (${pct(p.value/tot)})`},
   xAxis:{type:'value',show:false},yAxis:{type:'category',data:rows.map(r=>r[0]),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:600}},
   series:[{type:'bar',barWidth:12,data:rows.map(r=>({value:+r[1].toFixed(2),name:r[0]})),itemStyle:{color:b.acc,borderRadius:[0,4,4,0]},showBackground:true,backgroundStyle:{color:css('--surface-2'),borderRadius:4},
    label:{show:true,position:'right',color:b.ink2,fontSize:11.5,formatter:p=>`${eur(p.value)}  ${pct(p.value/tot,0)}`}}]});
  const xs=OPEN.filter(x=>x.dps).sort((a,b)=>b.dps*b.q-a.dps*a.q);
  $('#tblYoc').innerHTML=`<thead><tr><th>Positie</th><th class="n">Dividend/aandeel</th><th class="n">Rendement</th><th class="n">Op inleg</th><th class="n">Uitkering</th></tr></thead><tbody>`+
   xs.map(x=>{const yoc=x.dps*x.fxNow*x.q/x.cost;return `<tr><td><b>${x.t}</b><span class="sub2">${x.n}</span></td><td class="n num">${px(x,x.dps)}</td><td class="n num">${pct(x.yld,2)}</td><td class="n num ${yoc>x.yld?'up':''}">${pct(yoc,2)}</td><td class="n num">${pct(x.payout?x.payout/100:x.dps*x.pe/x.p,0)}</td></tr>`;}).join('')+'</tbody>';}
function renderCal(){const y=new Date(calM).getUTCFullYear(),m=new Date(calM).getUTCMonth();$('#calTitle').textContent=new Date(calM).toLocaleDateString('nl-NL',{month:'long',year:'numeric',timeZone:'UTC'});
  const first=Date.UTC(y,m,1);const dow=(new Date(first).getUTCDay()+6)%7;const start=first-dow*DAY;let h=['ma','di','wo','do','vr','za','zo'].map(d=>`<div class="dh">${d}</div>`).join('');
  for(let k=0;k<42;k++){const d=start+k*DAY;const dd=new Date(d);const inM=dd.getUTCMonth()===m;const ev=[];
    DIVS.forEach(v=>{if(v.exd===d)ev.push(`<span class="ev ex" title="${v.t} ex-dividend">${v.t} ex</span>`);if(v.pay===d)ev.push(`<span class="ev pay" title="${v.t} betaling ${eur(v.net,2)} netto">${v.t} ${eur(v.net)}</span>`);});
    if(k>=35&&!inM&&k%7===0){if(new Date(start+35*DAY).getUTCMonth()!==m)break;}
    h+=`<div class="${inM?'':'out'} ${d===TODAY?'today':''}">${dd.getUTCDate()}${ev.join('')}</div>`;}
  $('#cal').innerHTML=h;}

/* ============ RENDEMENT ============ */
function renderWater(){const b=base();const steps=[['Koers',T.priceGain],['Valuta',T.fxGain],['Gerealiseerd',T.real],['Dividend bruto',T.divG],['Bronbelasting',-T.divT],['Kosten',-T.fees],['Opties',T.opt]];
  let run=0;const baseA=[],pos_=[],neg=[];steps.forEach(([_,v])=>{if(v>=0){baseA.push(run);pos_.push(+v.toFixed(0));neg.push('-');run+=v;}else{run+=v;baseA.push(run);pos_.push('-');neg.push(+(-v).toFixed(0));}});
  const cats=[...steps.map(s=>s[0]),'Totaal'];baseA.push(0);pos_.push('-');neg.push('-');const tot=cats.map((_,i)=>i===cats.length-1?+T.total.toFixed(0):'-');
  const vals=[...steps.map(s=>s[1]),T.total];
  C('chWater').setOption({textStyle:b.text,grid:{left:8,right:8,top:28,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>`<b>${p[0].name}</b>: ${eurS(vals[p[0].dataIndex])}`},
   xAxis:{type:'category',data:cats,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:0,color:b.ink2,rotate:NARROW()?50:0,fontSize:NARROW()?10.5:11.5}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},
   series:[{type:'bar',stack:'w',data:baseA,itemStyle:{color:'transparent'},emphasis:{disabled:true},silent:true},
    {type:'bar',stack:'w',data:pos_,barWidth:'56%',itemStyle:{color:b.good,borderRadius:3},label:{show:true,position:'top',color:b.ink2,fontSize:NARROW()?9.5:11.5,formatter:p=>NARROW()?eurS(Math.round(p.value/1000))+'k':eurS(p.value)}},
    {type:'bar',stack:'w',data:neg,itemStyle:{color:b.bad,borderRadius:3},label:{show:true,position:'bottom',color:b.ink2,fontSize:NARROW()?9.5:11.5,formatter:p=>NARROW()?eur(-Math.round(p.value/1000))+'k':eur(-p.value)}},
    {type:'bar',stack:'w',data:tot,itemStyle:{color:b.acc,borderRadius:3},label:{show:true,position:'top',color:b.ink,fontWeight:600,fontSize:NARROW()?10:12,formatter:p=>NARROW()?eurS(Math.round(p.value/1000))+'k':eurS(p.value)}}]});
  const yrs=(TODAY-START)/(365.25*DAY);
  $('#tblRet').innerHTML='<tbody>'+[
   ['Waarde nu',eur(TOTAL)],['Netto inleg',eur(T.invested)],['Totaal resultaat',`<span class="${cls(T.total)}">${eurS(T.total)}</span>`],
   ['Rendement per jaar (IRR)',pct(IRR)],['Tijdgewogen (TWR), totaal',pct(T.twr)],['Tijdgewogen, per jaar',pct(Math.pow(1+T.twr,1/yrs)-1)],
   ['AEX koersindex, zelfde periode',pct(T.aexr)],['Kosten',eur(T.fees)],['Bronbelasting',eur(T.divT)]].map(([l,v])=>`<tr><td>${l}</td><td class="n num"><b>${v}</b></td></tr>`).join('')+'</tbody>';}
function contribRows(){return INS.filter(x=>TX.some(t=>t.t===x.t)).map(x=>{const P=pos[x.t];const open=P.q>0;const pg=open?x.priceGain:0,fg=open?x.fxGain:0;
  return {x,open,pg,fg,real:P.real,div:P.divG-P.divT,fees:P.fees,tot:pg+fg+P.real+P.divG-P.divT-P.fees};});}
function renderContrib(){const b=base();const rows=contribRows().sort((a,b)=>a.tot-b.tot);
  const S=(name,key,col)=>({name,type:'bar',stack:'c',barWidth:14,data:rows.map(r=>+r[key].toFixed(0)),itemStyle:{color:col}});
  C('chContrib').setOption({textStyle:b.text,grid:{left:8,right:16,top:34,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>{const r=rows[p[0].dataIndex];return `<b>${r.x.t}</b>${r.open?'':' (verkocht)'}<br>`+p.map(s=>`${s.marker}${s.seriesName}: ${eurS(s.value)}`).join('<br>')+`<br><b>Totaal: ${eurS(r.tot)}</b>`;}},
   xAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},
   yAxis:{type:'category',data:rows.map(r=>r.x.t+(r.open?'':' ✕')),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:600}},
   series:[S('Koers','pg',b.cat[0]),S('Valuta','fg',b.cat[1]),S('Gerealiseerd','real',b.cat[2]),S('Dividend netto','div',b.cat[3])]});}
let reportCSV='';
function renderReport(){const rows=contribRows().sort((a,b)=>(b.open-a.open)||b.tot-a.tot);
  const head=['Positie','Aantal','Koers','Waarde','Inleg','Koers','Valuta','Gerealiseerd','Dividend','Kosten','Totaal'];
  $('#tblReport').innerHTML=`<thead><tr><th>Positie</th><th class="n">Aantal</th><th class="n">Koers</th><th class="n">Waarde</th><th class="n">Inleg</th><th class="n">Koersresultaat</th><th class="n">Valuta</th><th class="n">Gerealiseerd</th><th class="n">Dividend netto</th><th class="n">Kosten</th><th class="n">Totaal</th></tr></thead><tbody>`+
   rows.map(r=>{const x=r.x;const f=v=>`<td class="n num ${v<0?'down':''}">${v?nf0.format(v):'0'}</td>`;return `<tr><td><b>${x.t}</b><span class="sub2">${r.open?x.ex+' · '+x.ccy:'verkocht'}</span></td><td class="n num">${r.open?nf0.format(x.q):0}</td><td class="n num">${px(x)}</td><td class="n num">${r.open?nf0.format(x.val):0}</td><td class="n num">${r.open?nf0.format(x.cost):0}</td>${f(r.pg)}${f(r.fg)}${f(r.real)}${f(r.div)}${f(-r.fees)}<td class="n num ${cls(r.tot)}"><b>${nf0.format(r.tot)}</b></td></tr>`;}).join('')+'</tbody>';
  reportCSV=[head.join(';'),...rows.map(r=>[r.x.t,r.open?r.x.q:0,nf2.format(r.x.p),r.open?r.x.val.toFixed(2):0,r.open?r.x.cost.toFixed(2):0,r.pg.toFixed(2),r.fg.toFixed(2),r.real.toFixed(2),r.div.toFixed(2),(-r.fees).toFixed(2),r.tot.toFixed(2)].join(';'))].join('\n');}
let txSel='ALL';
function renderTx(){const L={BUY:'Koop',SELL:'Verkoop',DIV:'Dividend',OPT:'Optie'};const xs=TX.filter(t=>txSel==='ALL'||t.ty===txSel).slice().reverse();
  $('#txCount').textContent=`${xs.length} transacties sinds 7 januari 2019. Koopkosten: € ${nf2.format(FEE)} per order plus ${nf2.format(FXFEE*100)}% valutakosten op vreemde valuta. Opties: € ${nf2.format(OPT_FEE)} per contract.`;
  $('#tblTx').innerHTML=`<thead><tr><th>Datum</th><th>Soort</th><th>Positie</th><th class="n">Aantal</th><th class="n">Prijs</th><th class="n">Bedrag (EUR)</th></tr></thead><tbody>`+
   xs.map(t=>`<tr><td class="num">${fdate(t.d)}</td><td><span class="pill ${t.ty==='SELL'?'bad':t.ty==='BUY'?'neu':'good'}">${L[t.ty]}</span></td><td><b>${t.t}</b> <span style="color:var(--ink-3)">${t.ty==='OPT'?optName(t.o)+' · '+t.act:BY[t.t].n}</span></td><td class="n num">${nf0.format(t.q)}${t.ty==='OPT'?' ct':''}</td><td class="n num">${t.ty==='OPT'?'€ '+nf2.format(t.price):(CSYM[t.ccy]||'€ ')+nf2.format(t.price)}</td><td class="n num ${cls(t.amt)}">${eurS(t.amt,2)}${t.tax?`<span class="sub2">na ${eur(t.tax,2)} belasting</span>`:''}</td></tr>`).join('')+'</tbody>';}

/* ============ NIEUWS (sample items) ============ */
const NEWS=[
 {t:'ASML',c:'Kwartaalcijfers',h:'ASML: orderboek voorbeeldkwartaal hoger dan verwacht',p:'Voorbeeldbericht. In de echte versie staat hier de samenvatting van het IEX-artikel over de kwartaalcijfers, met een link naar het volledige stuk.',ago:'3 uur geleden',big:true},
 {t:'SHELL',c:'Dividend',h:'Shell kondigt interim-dividend aan voor het vierde kwartaal',p:'Voorbeeldbericht over een dividendaankondiging. De ex-dividenddatum en het bedrag verschijnen automatisch in de dividendkalender.',ago:'6 uur geleden'},
 {t:'INGA',c:'Analisten',h:'Analist verhoogt koersdoel ING',p:'Voorbeeldbericht. Koersdoelwijzigingen van analisten kunnen de geschatte reële waarde in de weergave Waardering bijwerken.',ago:'11 uur geleden'},
 {t:'ADYEN',c:'Waardering',h:'Adyen noteert ruim onder geschatte reële waarde',p:'Voorbeeld van een automatisch signaal: de koers zakt meer dan 15% onder de reële waarde.',ago:'gisteren'},
 {t:'BESI',c:'Risico',h:'BESI is de meest beweeglijke positie in je portefeuille',p:'Voorbeeld van een automatisch signaal uit de risicoanalyse: volatiliteit boven 1,6 keer de AEX.',ago:'gisteren'},
 {t:'HEIA',c:'IEX Premium',h:'Heineken: koopwaardig na de koersdaling?',p:'Voorbeeld van een IEX Premium-analyse die aan de positie gekoppeld wordt.',ago:'2 dagen geleden'},
 {t:'MSFT',c:'Kwartaalcijfers',h:'Microsoft: cloudomzet groeit door',p:'Voorbeeldbericht bij een buitenlandse positie, met koers en valuta-effect in euro.',ago:'3 dagen geleden'},
 {t:'AD',c:'Dividend',h:'Ahold Delhaize zet inkoopprogramma voort',p:'Voorbeeldbericht over aandeleninkoop en dividendbeleid.',ago:'4 dagen geleden'},
];
let newsF='Alles';
const T2={};Object.keys(BY).forEach(t=>{T2[t]=t;});
function liveNews(){if(!LIVE||!LIVE.news||!LIVE.news.length)return null;const sym=Object.fromEntries(INS.map(x=>[(LIVE.instruments[x.t]||{}).symbol,x.t]));
  return LIVE.news.map(n=>({ts:(n.symbols||[]).map(s=>sym[s]||sym[s.replace(/\.US$/,'.US')]).filter(Boolean),c:'Nieuws',h:n.title,url:n.url,src:n.source,ago:fdate(Date.parse(n.date))})).filter(n=>n.ts.length);}
function renderNews(){const LN=liveNews();if(LN){const tks=['Alles',...new Set(LN.flatMap(n=>n.ts))];if(!tks.includes(newsF))newsF='Alles';
   $('#newsFilters').innerHTML=tks.map(c=>`<button aria-pressed="${c===newsF}" data-c="${c}">${c}</button>`).join('');
   $('#newsList').innerHTML=LN.filter(n=>newsF==='Alles'||n.ts.includes(newsF)).map(n=>`<article class="item"><div class="meta">${n.ts.map(t=>{const x=BY[t];return `<span class="chip tick">${t} ${px(x)} <span class="${cls(x.day)}">${pctS(x.day,1)}</span></span>`;}).join('')}<span>${n.src||''}</span><span>${n.ago}</span></div><h3><a href="${n.url}" target="_blank" rel="noopener" style="color:inherit">${n.h.replace(/</g,'&lt;')}</a></h3></article>`).join('');return;}
  const cats=['Alles',...new Set(NEWS.map(n=>n.c))];
  $('#newsFilters').innerHTML=cats.map(c=>`<button aria-pressed="${c===newsF}" data-c="${c}">${c}</button>`).join('');
  $('#newsList').innerHTML=NEWS.filter(n=>newsF==='Alles'||n.c===newsF).map(n=>{const x=BY[n.t];return `<article class="item"><div class="meta"><span class="chip tick">${n.t} ${px(x)} <span class="${cls(x.day)}">${pctS(x.day,1)}</span></span><span class="chip">${n.c}</span><span>${n.ago}</span></div><h3>${n.h}</h3><p>${n.p}</p></article>`;}).join('');}

/* ============ DATAMODEL ============ */
function renderEnts(){const E=[
 ['user','Gebruiker (fase 2, met login)',[['id','uuid'],['email','text'],['base_currency','char(3)'],['created_at','timestamptz']]],
 ['portfolio','Een gebruiker kan meerdere portefeuilles hebben',[['id','uuid'],['user_id','→ user'],['name','text'],['broker_account_id','→ broker_account?'],['base_currency','char(3)']]],
 ['broker_account','Koppeling met broker (fase 2)',[['id','uuid'],['broker','enum'],['external_id','text'],['last_sync_at','timestamptz']]],
 ['instrument','Aandeel, ETF of fonds',[['id','uuid'],['isin','char(12)'],['ticker','text'],['name','text'],['exchange','text'],['currency','char(3)'],['sector / industry','text'],['country','char(2)']]],
 ['transaction','Bron van alle berekeningen',[['id','uuid'],['portfolio_id','→ portfolio'],['instrument_id','→ instrument'],['type','BUY | SELL | DIVIDEND | FEE | CASH'],['trade_date','date'],['quantity','numeric'],['price','numeric (lokaal)'],['fx_rate','numeric'],['fees / tax','numeric (EUR)']]],
 ['option_contract','Optieserie (Euronext): onderliggende, call/put, strike, expiratie',[['id','uuid'],['underlying_id','→ instrument of index'],['type','CALL | PUT'],['strike','numeric'],['expiry','date'],['multiplier','10 (Mini AEX) | 100'],['style','Europees | Amerikaans'],['settlement','cash | levering']]],
 ['option_trade','Opening, sluiting, expiratie of assignment',[['id','uuid'],['portfolio_id','→ portfolio'],['contract_id','→ option_contract'],['action','BTO | STO | BTC | STC | EXP | ASSIGN'],['trade_date','date'],['contracts','int'],['premium','numeric'],['fee','numeric'],['strategy','text?']]],
 ['etf_exposure','Doorkijk van een ETF naar landen en sectoren',[['instrument_id','→ instrument'],['as_of','date'],['dimension','country | sector | currency'],['key','text'],['weight','numeric']]],
 ['price_daily','Slotkoersen per dag',[['instrument_id','→ instrument'],['date','date'],['close','numeric'],['volume','bigint']]],
 ['fx_daily','Valutakoersen per dag',[['pair','EURUSD …'],['date','date'],['rate','numeric']]],
 ['dividend_event','Aangekondigd of geschat dividend',[['instrument_id','→ instrument'],['ex_date','date'],['pay_date','date'],['amount','numeric (lokaal)'],['status','declared | estimated']]],
 ['fundamentals','Kerncijfers per instrument',[['instrument_id','→ instrument'],['as_of','date'],['pe, eps_growth_fc','numeric'],['roe, debt_equity','numeric'],['payout_ratio','numeric']]],
 ['score','Kompasscore per instrument',[['instrument_id','→ instrument'],['as_of','date'],['valuation … dividend','0–6'],['fair_value','numeric'],['fair_value_method','text']]],
 ['benchmark','Vergelijkingsindex',[['code','AEX, AMX, MSCI World'],['date','date'],['close','numeric']]],
 ['news_item','IEX-artikel gekoppeld aan instrumenten',[['id','uuid'],['instrument_ids','uuid[]'],['category','text'],['title / summary','text'],['url','text'],['published_at','timestamptz']]],
];
 $('#ents').innerHTML=E.map(([n,d,f])=>`<section><h3>${n}</h3><p style="padding-top:8px">${d}</p><ul>${f.map(([a,b])=>`<li><span>${a}</span><em>${b}</em></li>`).join('')}</ul></section>`).join('')+
 `<section><h3>berekend, niet opgeslagen</h3><p style="padding-top:8px">Afgeleid uit de tabellen hiernaast, in dit prototype in de browser</p><ul>${['posities en gemiddelde kostprijs','waarde- en inlegreeks','IRR (XIRR) en TWR','gerealiseerd en valuta-effect','volatiliteit, bèta, drawdown','correlatiematrix','dividendprognose 12 mnd','gewogen kompasscore'].map(s=>`<li><span>${s}</span></li>`).join('')}</ul></section>`;}

/* ============ BRON / HEADER ============ */
function renderSource(){const last=wdate(NW-1);
  $('#srcBadge').textContent=LIVE?`Live · ${LIVE.source}`:'Prototype · voorbeelddata';$('#srcBadge').classList.toggle('live',!!LIVE);
  if(LIVE){const v=$('#v-waardering .panel:nth-child(2) header p');if(v)v.textContent='Links van nul noteert de positie onder het gemiddelde koersdoel van analisten, rechts erboven.';const n=$('#v-nieuws header p');if(n)n.textContent='Recente berichten over je posities, via '+LIVE.source+'. Klik om het volledige bericht te openen.';}
  $('#footSrc').textContent=LIVE?`Data: ${LIVE.source}. Fundamentals en koersdoelen van analisten. Geen beleggingsadvies.`:'Voorbeelddata. Geen beleggingsadvies.';
  $('#subLine').textContent=`Demoportefeuille "Lange termijn" · ${LIVE?'koersen bijgewerkt '+fdate(Date.parse(LIVE.generatedAt)):'koersen gesimuleerd t/m '+fdate(TODAY)}`;}

/* ============ PORTEFEUILLEKAART + SIGNALEN ============ */
let tmSel='day';
function renderTree(){const b=base();const chgOf=x=>tmSel==='day'?x.day:x.px[NW-1]/x.px[NW-1-(+tmSel)]-1;
  const lim={day:.03,1:.05,4:.1,52:.4}[tmSel];const bySec={};OPEN.forEach(x=>{(bySec[x.sec]=bySec[x.sec]||[]).push(x);});
  const data=Object.entries(bySec).map(([sec,xs])=>({name:sec,children:xs.map(x=>({name:x.t,value:[+x.val.toFixed(0),+chgOf(x).toFixed(4)],full:x.n}))}));
  C('chTree').setOption({textStyle:b.text,tooltip:{...b.tip,formatter:p=>p.data&&p.data.full?`<b>${p.name}</b> · ${p.data.full}<br>${eur(p.value[0])} · ${pctS(p.value[1])}`:`<b>${p.name}</b>`},
   visualMap:{show:false,type:'continuous',min:-lim,max:lim,dimension:1,seriesIndex:0,inRange:{color:[b.bad,css('--div-mid'),b.good]}},
   series:[{type:'treemap',roam:false,nodeClick:false,breadcrumb:{show:false},left:0,right:0,top:0,bottom:0,visualDimension:1,
    upperLabel:{show:true,height:20,color:b.ink2,fontSize:11,fontWeight:600,formatter:'{b}',backgroundColor:'transparent'},
    itemStyle:{borderColor:b.sf,borderWidth:2,gapWidth:2},
    levels:[{upperLabel:{show:false},itemStyle:{borderColor:b.sf,borderWidth:0,gapWidth:4}},{upperLabel:{show:true,formatter:'{b}'},itemStyle:{borderColor:css('--surface-2'),borderWidth:3,gapWidth:2}},{}],
    label:{show:true,formatter:p=>`{t|${p.name}}\n{c|${pctS(p.value[1])}}`,rich:{t:{fontWeight:700,fontSize:13,color:b.ink},c:{fontSize:11.5,color:b.ink2}}},data}]});}
function renderSignals(){const out=[];const add=(k,ic,t,s)=>out.push({k,ic,t,s});
  const soon=DIVS.filter(v=>!v.hist&&v.exd>=TODAY&&v.exd<=TODAY+14*DAY);soon.forEach(v=>add(1,'info',`${v.t} gaat ${fdate(v.exd)} ex-dividend`,`Verwacht ${eur(v.net,2)} netto, betaling rond ${fdate(v.pay)}`));
  DIVS.filter(v=>!v.hist&&v.pay>=TODAY&&v.pay<=TODAY+14*DAY).forEach(v=>add(2,'good',`${v.t} betaalt ${eur(v.net,2)} dividend`,`Rond ${fdate(v.pay)}`));
  STK.filter(x=>x.w>.1).forEach(x=>add(3,'bad',`${x.t} is ${pct(x.w)} van je portefeuille`,'Boven 10% maakt één tegenvaller voelbaar'));
  const secW={};STK.forEach(x=>secW[x.sec]=(secW[x.sec]||0)+x.w);Object.entries(secW).filter(([,w])=>w>.3).forEach(([s,w])=>add(3,'bad',`${s} weegt ${pct(w)}`,'Meer dan 30% in één sector'));
  OPEN.filter(x=>x.disc>.15).sort((a,b)=>b.disc-a.disc).slice(0,2).forEach(x=>add(4,'good',`${x.t} noteert ${pct(x.disc,0)} onder ${FV_L}`,`Koers ${px(x)}, ${FV_L} ${px(x,x.fv)}`));
  OPEN.filter(x=>x.disc<-.1).forEach(x=>add(4,'bad',`${x.t} staat ${pct(-x.disc,0)} boven ${FV_L}`,`Koers ${px(x)}, ${FV_L} ${px(x,x.fv)}`));
  OPEN.forEach(x=>{const hi=Math.max(...x.px.slice(NW-52));const dd=x.p/hi-1;if(dd<-.25)add(5,'bad',`${x.t} staat ${pct(-dd,0)} onder de top van dit jaar`,`Jaarhoog ${px(x,hi)}`);});
  const best=[...OPEN].sort((a,b)=>chg(b,52)-chg(a,52));add(6,'good',`Beste positie dit jaar: ${best[0].t} ${pctS(chg(best[0],52))}`,`Zwakste: ${best.at(-1).t} ${pctS(chg(best.at(-1),52))}`);
  STK.filter(x=>x.an&&x.an.surprise).forEach(x=>{const S=SURP[x.an.surprise];add(4,S[1],`${x.t}: ${S[0].toLowerCase()}`,`Koers ${pctS(x.an.pc)} in 3 maanden, gemiddeld koersdoel ${pctS(x.an.tc)}`);});
  STK.filter(x=>x.an&&Math.abs(x.an.mom)>=4).forEach(x=>add(5,x.an.mom>0?'good':'bad',`Analisten ${x.an.mom>0?'steeds positiever':'steeds negatiever'} over ${x.t}`,`${x.an.raises} verhogingen, ${x.an.cuts} verlagingen, ${x.an.ups} upgrades, ${x.an.downs} downgrades in 90 dagen`));
  out.sort((a,b)=>a.k-b.k);
  $('#signals').innerHTML=out.slice(0,8).map(o=>`<div class="sig"><span class="ic ${o.ic}">${o.ic==='good'?'↑':o.ic==='bad'?'!':'i'}</span><div>${o.t}<small>${o.s}</small></div></div>`).join('')||'<p class="note">Geen bijzonderheden.</p>';}

/* ============ SCORE-CHECKS ============ */
function renderChecks(){const xs=[...STK].sort((a,b)=>b.s[axisSel]-a.s[axisSel]||b.w-a.w);const labels=STK[0].checks[axisSel].map(c=>c[0]);
  $('#tblChecks').innerHTML=`<thead><tr><th>Positie</th>${labels.map((l,i)=>`<th title="${l}" style="white-space:normal;min-width:84px;max-width:130px;text-transform:none;letter-spacing:0;font-size:11.5px;line-height:1.3">${l}</th>`).join('')}<th class="n">Score</th></tr></thead><tbody>`+
   xs.map(x=>`<tr><td><b>${x.t}</b></td>${x.checks[axisSel].map(c=>`<td><span class="dot ${c[1]?'y':'n'}" title="${x.t}: ${c[0]}: ${c[1]?'ja':'nee'}" aria-label="${c[1]?'ja':'nee'}"></span></td>`).join('')}<td class="n num"><b>${x.s[axisSel]}</b>/6</td></tr>`).join('')+'</tbody>';}

/* ============ BELASTING ============ */
let taxP=1;
// Box 3 overbruggingsstelsel: heffingsvrij vermogen p.p., forfaitair rendement overige bezittingen, tarief
const BOX3={2023:{free:57000,f:.0617,r:.32},2024:{free:57000,f:.0604,r:.36},2025:{free:57684,f:.0588,r:.36}};
const box3Rates=y=>BOX3[y]||BOX3[Math.max(...Object.keys(BOX3).map(Number))];
function box3Year(y){const R=box3Rates(y);const v0=SER.v[widx(Date.UTC(y,0,1))];const free=R.free*taxP;const base_=Math.max(0,v0-free);return {y,v0,free,base:base_,f:R.f,r:R.r,tax:base_*R.f*R.r,est:!BOX3[y]};}
function renderTaxHero(){const cy=new Date(TODAY).getUTCFullYear();const b3=box3Year(cy);const fwd=DIVS.filter(v=>!v.hist).reduce((a,v)=>a+v.net,0);
  const whtY=DIVS.filter(v=>v.hist&&new Date(v.pay).getUTCFullYear()===cy).reduce((a,v)=>a+v.tax,0);
  $('#taxHero').innerHTML=`<div class="stat"><span class="l">Box 3-indicatie ${cy}</span><span class="big num">${eur(b3.tax)}</span></div>
   <div class="stat"><span class="l">Grondslag (1 januari)</span><span class="v num">${eur(b3.base)}</span></div>
   <div class="stat"><span class="l">Als % van je portefeuille</span><span class="v num">${pct(b3.tax/TOTAL,2)}</span></div>
   <div class="stat"><span class="l">Verrekenbare bronbelasting ${cy}</span><span class="v num">${eur(whtY)}</span></div>`;
  const ys=[];for(let y=2020;y<=cy;y++)ys.push(y);const rows=ys.filter(y=>y>=2023).map(box3Year);const bb=base();
  C('chBox3').setOption({textStyle:bb.text,grid:{left:8,right:8,top:24,bottom:8,containLabel:true},tooltip:{...bb.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(bb.ink3,.08)}},valueFormatter:v=>eur(v)},
   legend:{show:false},xAxis:{type:'category',data:rows.map(r=>String(r.y)+(r.est?'*':'')),...bb.ax,splitLine:{show:false}},
   yAxis:[{type:'value',...bb.ax,axisLabel:{...bb.ax.axisLabel,formatter:v=>'€ '+nf0.format(v)}}],
   series:[{name:'Box 3-belasting',type:'bar',data:rows.map(r=>Math.round(r.tax)),barMaxWidth:44,itemStyle:{color:bb.cat[0],borderRadius:[4,4,0,0]},label:{show:true,position:'top',color:bb.ink2,fontSize:11,formatter:p=>eur(p.value)}}]});
  $('#box3YearNote').textContent=`Per jaar: waarde op 1 januari min heffingsvrij vermogen, keer het forfaitaire rendement, keer het tarief. ${rows.some(r=>r.est)?'* Tarieven voor dit jaar zijn nog niet definitief; berekend met die van 2025.':''}`;}
function renderTax(){const cy=new Date(TODAY).getUTCFullYear();const j1=widx(Date.UTC(cy,0,1));const b3=box3Year(cy);const v0=b3.v0;
  const free=b3.free, forfait=b3.f, rate=b3.r;const base_=b3.base;const tax=b3.tax;
  let cf=0;for(let i=j1+1;i<NW;i++)cf+=SER.cf[i];const divY=DIVS.filter(v=>v.hist&&new Date(v.pay).getUTCFullYear()===cy).reduce((a,v)=>a+v.net,0);
  const actual=SER.v[NW-1]-v0-cf+divY-TX.filter(t=>t.d>=Date.UTC(cy,0,1)).reduce((a,t)=>a+(t.fee||0),0);
  const fictive=v0*forfait;
  $('#tblBox3').innerHTML='<tbody>'+[['Waarde op 1 januari '+cy,eur(v0)],['Heffingsvrij vermogen'+(taxP>1?' (2 personen)':''),'−'+eur(free).replace('−','')],['Grondslag',eur(base_)],[`Forfaitair rendement (${nf2.format(forfait*100)}%)`,eur(base_*forfait)],[`Box 3-belasting (${Math.round(rate*100)}%)`,`<b>${eur(tax)}</b>`],
   ['Werkelijk rendement dit jaar',`<span class="${cls(actual)}">${eurS(actual)} (${pctS(actual/v0)})</span>`],['Tegenbewijs gunstig?',actual<fictive?'<span class="pill good">Ja, werkelijk lager dan forfait</span>':'<span class="pill neu">Nee</span>']].map(([a,b])=>`<tr><td>${a}</td><td class="n num">${b}</td></tr>`).join('')+'</tbody>';
  $('#box3Note').textContent=(b3.est?'Tarieven 2025 als indicatie (die van '+cy+' zijn nog niet definitief), ':'Tarieven '+cy+', ')+'alleen deze portefeuille, zonder schulden of andere bezittingen. Werkelijk rendement = koersverschil plus netto dividend, min kosten.';
  const b=base();const ys=[];for(let y=2019;y<=cy;y++)ys.push(y);const by=ys.map(y=>+DIVS.filter(v=>v.hist&&new Date(v.pay).getUTCFullYear()===y).reduce((a,v)=>a+v.tax,0).toFixed(2));
  C('chWht').setOption({textStyle:b.text,grid:{left:8,right:8,top:20,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},valueFormatter:v=>eur(v,2)},
   xAxis:{type:'category',data:ys.map(String),...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v)}},
   series:[{type:'bar',data:by,barMaxWidth:28,itemStyle:{color:b.cat[3],borderRadius:[4,4,0,0]},label:{show:true,position:'top',color:b.ink2,fontSize:11,formatter:p=>p.value?eur(p.value):''}}]});}

/* ============ VERGELIJKEN ============ */
const AEXW={Technologie:34,'Financiën':18,'Consumentengoederen':16,Energie:9,Communicatie:8,'Zakelijke diensten':6,Gezondheidszorg:4,Industrie:3,Materialen:2};
let bmSel='AEX',bmRange=0;
function bmStats(){const B=BENCH[bmSel].s;const n=bmRange||NW;const i0=Math.max(1,NW-n);
  // schaduwportefeuille: start met dezelfde waarde, daarna dezelfde stortingen/opnames
  let u=SER.v[i0]/B[i0];const sh=[];for(let i=i0;i<NW;i++){if(i>i0)u+=SER.cf[i]/B[i];sh.push(u*B[i]);}
  const pr=[],br=[];for(let i=i0+1;i<NW;i++){pr.push(SER.ret[i]);br.push(B[i]/B[i-1]-1);}
  const yrs=(NW-1-i0)/52;const tp=SER.idx[NW-1]/SER.idx[i0]-1,tb=B[NW-1]/B[i0]-1;const ap=Math.pow(1+tp,1/yrs)-1,ab=Math.pow(1+tb,1/yrs)-1;
  const beta=cov(pr,br)/(sd(br)**2);const alpha=ap-(RF+beta*(ab-RF));const te=sd(pr.map((v,k)=>v-br[k]))*Math.sqrt(52);
  const up=br.map((v,k)=>[v,pr[k]]).filter(a=>a[0]>0),dn=br.map((v,k)=>[v,pr[k]]).filter(a=>a[0]<0);
  const capUp=mean(up.map(a=>a[1]))/mean(up.map(a=>a[0])),capDn=mean(dn.map(a=>a[1]))/mean(dn.map(a=>a[0]));
  const flows=[{d:wdate(i0),a:-SER.v[i0]}];for(let i=i0+1;i<NW;i++)if(SER.cf[i])flows.push({d:wdate(i),a:-SER.cf[i]});
  const divs=DIVS.filter(v=>v.hist&&v.pay>wdate(i0)).map(v=>({d:v.pay,a:v.net}));
  const irrP=xirr([...flows,...divs,{d:TODAY,a:SER.v[NW-1]}].sort((a,b)=>a.d-b.d)),irrB=xirr([...flows,{d:TODAY,a:sh.at(-1)}]);
  return {B,i0,sh,tp,tb,ap,ab,beta,alpha,te,capUp,capDn,irrP,irrB,divIn:divs.reduce((a,v)=>a+v.a,0)};}
function renderBench(){const b=base();
  $('#bmPick').innerHTML=Object.entries(BENCH).map(([k,v])=>`<button aria-pressed="${k===bmSel}" data-v="${k}">${v.name}</button>`).join('');
  const S=bmStats();const bn=BENCH[bmSel].name;const diff=SER.v[NW-1]+S.divIn-S.sh.at(-1);
  $('#bmNote').textContent=`Wat als je elke storting en opname op dezelfde dag in ${bn} had gestoken? Zo vergelijk je eerlijk, inclusief het moment waarop je geld erbij deed. ${bn}: ${BENCH[bmSel].note}${LIVE?'':', gesimuleerd'}.`;
  const k=(l,v,s,c='')=>`<div class="kpi"><span>${l}</span><b class="${c}">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`;
  $('#bmKpis').innerHTML=[k('Voorsprong in euro',eurS(diff),`waarde plus ontvangen dividend t.o.v. ${eur(S.sh.at(-1))}`,cls(diff)),
   k('Rendement per jaar (IRR)',pct(S.irrP),`${bn}: ${pct(S.irrB)}`,S.irrP>=S.irrB?'up':'down'),
   k('Tijdgewogen per jaar',pct(S.ap),`${bn}: ${pct(S.ab)}`,S.ap>=S.ab?'up':'down'),
   k('Alfa per jaar',pctS(S.alpha),`bèta ${nf2.format(S.beta)} · tracking error ${pct(S.te)}`,cls(S.alpha)),
   k('Mee omhoog / mee omlaag',`${pct(S.capUp,0)} / ${pct(S.capDn,0)}`,'deel van stijgende en dalende weken dat je meedoet','')].join('');
  const xs=[];for(let i=S.i0;i<NW;i++)xs.push(i);
  C('chShadow').setOption({textStyle:b.text,grid:{left:8,right:12,top:14,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',valueFormatter:v=>eur(v)},
   xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},
   series:[{name:'Jouw portefeuille',type:'line',showSymbol:false,data:xs.map(i=>[wdate(i),Math.round(SER.v[i])]),lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.12)}},
    {name:'Zelfde stortingen in '+bn,type:'line',showSymbol:false,data:xs.map((i,k)=>[wdate(i),Math.round(S.sh[k])]),lineStyle:{color:b.mkt,width:2,type:'dashed'},itemStyle:{color:b.mkt}},
    {name:'Netto inleg',type:'line',step:'end',showSymbol:false,data:xs.map(i=>[wdate(i),Math.round(SER.inv[i])]),lineStyle:{color:b.ink3,width:1},itemStyle:{color:b.ink3}}]});
  const ex=xs.map(i=>[wdate(i),+((SER.idx[i]/SER.idx[S.i0])/(S.B[i]/S.B[S.i0])*100-100).toFixed(2)]);
  C('chExcess').setOption({textStyle:b.text,grid:{left:8,right:12,top:14,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',valueFormatter:v=>pctS(v/100)},
   xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[{name:'Voor',type:'line',showSymbol:false,data:ex.map(([t,v])=>[t,Math.max(0,v)]),lineStyle:{width:0},itemStyle:{color:b.good},areaStyle:{color:hexA(b.good,.22)},tooltip:{show:false}},
    {name:'Achter',type:'line',showSymbol:false,data:ex.map(([t,v])=>[t,Math.min(0,v)]),lineStyle:{width:0},itemStyle:{color:b.bad},areaStyle:{color:hexA(b.bad,.22)},tooltip:{show:false}},
    {name:'Voorsprong',type:'line',showSymbol:false,data:ex,lineStyle:{width:1.6,color:b.ink2},itemStyle:{color:b.ink2},markLine:{silent:true,symbol:'none',data:[{yAxis:0}],lineStyle:{color:b.ink3},label:{show:false}}}]});
  const uw=a=>{let pk=a[S.i0];return xs.map(i=>{pk=Math.max(pk,a[i]);return +((a[i]/pk-1)*100).toFixed(2);});};const up=uw(SER.idx),ub=uw(S.B);
  C('chDD').setOption({textStyle:b.text,grid:{left:8,right:12,top:14,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',valueFormatter:v=>pct(v/100)},
   xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',max:0,...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[{name:'Portefeuille',type:'line',showSymbol:false,data:xs.map((i,k)=>[wdate(i),up[k]]),lineStyle:{color:b.acc,width:1.6},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.15)}},
    {name:bn,type:'line',showSymbol:false,data:xs.map((i,k)=>[wdate(i),ub[k]]),lineStyle:{color:b.mkt,width:1.6,type:'dashed'},itemStyle:{color:b.mkt}}]});
  // kalenderjaren
  const cy=new Date(TODAY).getUTCFullYear();const years=[];for(let y=2019;y<=cy;y++)years.push(y);
  const yret=(arr,y)=>{const a=widx(Date.UTC(y,0,1)),z=y===cy?NW-1:widx(Date.UTC(y+1,0,1));return arr[z]/arr[Math.max(a,y===2019?1:a)]-1;};
  C('chYears').setOption({textStyle:b.text,legend:{top:0,left:0,textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},grid:{left:8,right:8,top:34,bottom:8,containLabel:true},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},valueFormatter:v=>pctS(v/100)},
   xAxis:{type:'category',data:years.map(y=>NARROW()?"'"+String(y).slice(2):y===cy?y+' t/m nu':String(y)),...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:0}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[{name:'Portefeuille',type:'bar',barGap:'10%',data:years.map(y=>+(yret(SER.idx,y)*100).toFixed(1)),itemStyle:{color:b.acc,borderRadius:3}},{name:bn,type:'bar',data:years.map(y=>+(yret(S.B,y)*100).toFixed(1)),itemStyle:{color:b.mkt,borderRadius:3}}]});
  // sectorweging vs AEX
  const pw={};OPEN.forEach(x=>pw[x.sec]=(pw[x.sec]||0)+x.w*100);const secs=[...new Set([...Object.keys(AEXW),...Object.keys(pw)])].map(s=>[s,(pw[s]||0)-(AEXW[s]||0)]).sort((a,b)=>a[1]-b[1]);
  C('chSecW').setOption({textStyle:b.text,grid:{left:8,right:40,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>{const s=p.name;return `<b>${s}</b><br>Jij ${nf2.format(pw[s]||0)}% · AEX ${AEXW[s]||0}%`;}},
   xAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>(v>0?'+':'')+v}},yAxis:{type:'category',data:secs.map(s=>s[0]),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2}},
   series:[{type:'bar',barWidth:12,data:secs.map(s=>({value:+s[1].toFixed(1),name:s[0],itemStyle:{color:s[1]>=0?b.cat[1]:b.cat[0],borderRadius:s[1]>=0?[0,4,4,0]:[4,0,0,4]}})),label:{show:true,position:'right',color:b.ink2,fontSize:11,formatter:p=>(p.value>0?'+':'')+nf2.format(p.value).replace(/,?0+$/,'')}}]});
  // maandrendementen
  const cells=[];const mret={};for(let i=1;i<NW;i++){const d=new Date(wdate(i));const key=d.getUTCFullYear()+'-'+d.getUTCMonth();mret[key]=(mret[key]??1)*(1+SER.ret[i]);}
  years.forEach((y,yi)=>{for(let m=0;m<12;m++){const v=mret[y+'-'+m];if(v!==undefined)cells.push([m,yi,+((v-1)*100).toFixed(1)]);}
    cells.push([12,yi,+(yret(SER.idx,y)*100).toFixed(1)]);cells.push([13,yi,+((yret(SER.idx,y)-yret(S.B,y))*100).toFixed(1)]);});
  C('chMonths').setOption({textStyle:b.text,grid:{left:8,right:8,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`${p.value[0]<12?MONTHS[p.value[0]]+' ':p.value[0]===12?'Heel ':'Verschil met '+bn+', '}${years[p.value[1]]}: ${pctS(p.value[2]/100)}`},
   xAxis:{type:'category',data:[...MONTHS,'Jaar','vs '+bmSel],position:'top',...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2,fontWeight:600}},yAxis:{type:'category',data:years.map(String),inverse:true,...b.ax,splitLine:{show:false}},
   visualMap:{show:false,min:-8,max:8,dimension:2,inRange:{color:[b.bad,css('--div-mid'),b.good]}},
   series:[{type:'heatmap',data:cells,itemStyle:{borderColor:b.sf,borderWidth:2,borderRadius:3},label:{show:true,fontSize:11,color:b.ink,formatter:p=>nf2.format(p.value[2]).replace(/(,\d)\d$/,'$1')}}]});}

/* ============ OPTIES ============ */
const fK=K=>K>=100?nf0.format(K):nf2.format(K);
const fExp=t=>{const d=new Date(t);return MONTHS[d.getUTCMonth()]+" '"+String(d.getUTCFullYear()).slice(2);};
function optName(o){return `${o.u==='AEX'?'AEX':o.u} ${o.type==='C'?'Call':'Put'} ${fK(o.K)} ${fExp(o.E)}`;}
const sideLbl=o=>o.side<0?'<span class="pill bad">geschreven</span>':'<span class="pill good">gekocht</span>';
let payU=null, stratSel='ALL';
function renderOptions(){const b=base();const cy=new Date(TODAY).getUTCFullYear();
  const premY=OPTTX.filter(t=>new Date(t.d).getUTCFullYear()===cy&&(t.act==='Schrijf')).reduce((a,t)=>a+t.amt,0);
  const wins=CLOSED_OPT.filter(o=>o.pnl>0).length;
  $('#optHero').innerHTML=`<div class="stat"><span class="l">Resultaat opties sinds 2021</span><span class="big num ${cls(OPTT.total)}">${eurS(OPTT.total)}</span></div>
   <div class="stat"><span class="l">Lopend · ${OPEN_OPT.length} posities</span><span class="v num ${cls(OPTT.open)}">${eurS(OPTT.open)}</span></div>
   <div class="stat"><span class="l">Ontvangen premie ${cy}</span><span class="v num">${eur(premY)}</span></div>
   <div class="stat"><span class="l">Gewonnen trades</span><span class="v num">${pct(wins/CLOSED_OPT.length,0)} <small style="font-size:13px;color:var(--ink-3)">van ${CLOSED_OPT.length}</small></span></div>`;
  const G=k=>OPEN_OPT.reduce((a,o)=>a+o[k],0);
  const k=(l,v,s,c='')=>`<div class="kpi"><span>${l}</span><b class="${c}">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`;
  $('#optGreeks').innerHTML=[k('Marktwaarde opties',eurS(OPTT.val),'geschreven opties tellen als verplichting',cls(OPTT.val)),
   k('Delta in euro',eurS(G('deltaE')),'koersgevoeligheid, alsof je zoveel aandelen hebt',cls(G('deltaE'))),
   k('Theta per dag',eurS(G('theta'),2),'tijdswaarde die je per dag wint of verliest',cls(G('theta'))),
   k('Vega per volapunt',eurS(G('vega'),2),'als de volatiliteit 1 punt stijgt',cls(G('vega'))),
   k('Eerstvolgende expiratie',OPEN_OPT.length?fdate(Math.min(...OPEN_OPT.map(o=>o.E))):'geen',OPEN_OPT.length?Math.min(...OPEN_OPT.map(o=>o.dte))+' dagen':'')].join('');
  const xs=[...OPEN_OPT].sort((a,b)=>a.E-b.E);
  $('#tblOptOpen').innerHTML=`<thead><tr><th>Optie</th><th></th><th class="n">Aantal</th><th class="n">Onderl.</th><th>Afstand</th><th class="n">Open</th><th class="n">Nu</th><th class="n">Resultaat</th><th class="n">Delta</th><th class="n">Theta/dag</th><th class="n">Kans ITM</th><th class="n">Dagen</th></tr></thead><tbody>`+
   xs.map(o=>{const dist=o.S/o.K-1;const itm=o.type==='C'?o.S>o.K:o.S<o.K;return `<tr><td><b>${optName(o)}</b><span class="sub2">${o.pl.naam}</span></td><td>${sideLbl(o)}</td><td class="n num">${o.side*o.n}</td>
    <td class="n num">${fK(o.S)}</td><td><span class="pill ${itm?(o.side<0?'bad':'good'):'neu'}">${itm?'in the money':'out of the money'}</span> <span class="num" style="color:var(--ink-3);font-size:12px">${pctS(dist)}</span></td>
    <td class="n num">${nf2.format(o.p0)}</td><td class="n num">${nf2.format(o.g.p)}</td><td class="n num ${cls(o.upnl)}">${eurS(o.upnl)}</td><td class="n num">${eurS(o.deltaE)}</td><td class="n num ${cls(o.theta)}">${eurS(o.theta,2)}</td>
    <td class="n num"><span class="probbar"><i style="width:${o.g.itm*100}%"></i></span>${pct(o.g.itm,0)}</td><td class="n num">${o.dte}</td></tr>`;}).join('')+'</tbody>';
  // uitbetalingsprofiel
  const us=[...new Set(OPEN_OPT.map(o=>o.u))];if(!us.includes(payU))payU=us[0];
  $('#payPick').innerHTML=us.map(u=>`<button aria-pressed="${u===payU}" data-v="${u}">${u}</button>`).join('');
  if(payU){const legs=OPEN_OPT.filter(o=>o.u===payU);const S0=legs[0].S;const stock=BY[payU]&&BY[payU].q?BY[payU].q:0;
    const lo=S0*.75,hi=S0*1.25,pts=[];for(let k2=0;k2<=120;k2++)pts.push(lo+(hi-lo)*k2/120);
    const atExp=S=>legs.reduce((a,o)=>{const iv=o.type==='C'?Math.max(0,S-o.K):Math.max(0,o.K-S);return a+o.side*o.n*o.mult*(iv-o.g.p);},0)+stock*(S-S0);
    const now=S=>legs.reduce((a,o)=>a+o.side*o.n*o.mult*(bs(S,o.K,Math.max(0,o.T-7/365),o.vol,o.type).p-o.g.p),0)+stock*(S-S0);
    const ex=pts.map(S=>[+S.toFixed(2),Math.round(atExp(S))]),nw=pts.map(S=>[+S.toFixed(2),Math.round(now(S))]);
    C('chPayoff').setOption({textStyle:b.text,grid:{left:8,right:16,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,data:['Op expiratie'+(stock?' (met je '+nf0.format(stock)+' aandelen)':''),'Over een week'],textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
     tooltip:{...b.tip,trigger:'axis',formatter:p=>`<b>${payU} op ${fK(p[0].value[0])}</b> (${pctS(p[0].value[0]/S0-1)})<br>`+p.filter(q=>q.seriesName!=='w'&&q.seriesName!=='v').map(q=>`${q.marker}${q.seriesName}: ${eurS(q.value[1])}`).join('<br>')},
     xAxis:{type:'value',min:+lo.toFixed(2),max:+hi.toFixed(2),...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,formatter:v=>fK(v)}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},
     series:[{name:'w',type:'line',showSymbol:false,data:ex.map(([x,y])=>[x,Math.max(0,y)]),lineStyle:{width:0},areaStyle:{color:hexA(b.good,.16)},tooltip:{show:false},silent:true},
      {name:'v',type:'line',showSymbol:false,data:ex.map(([x,y])=>[x,Math.min(0,y)]),lineStyle:{width:0},areaStyle:{color:hexA(b.bad,.16)},tooltip:{show:false},silent:true},
      {name:'Op expiratie'+(stock?' (met je '+nf0.format(stock)+' aandelen)':''),type:'line',showSymbol:false,data:ex,lineStyle:{color:b.acc,width:2.2},itemStyle:{color:b.acc},
       markLine:{silent:true,symbol:'none',data:[{xAxis:+S0.toFixed(2),label:{formatter:'nu '+fK(S0),color:b.ink2,position:'end'},lineStyle:{color:b.ink2,type:'solid'}},...legs.map(o=>({xAxis:o.K,label:{formatter:(o.type==='C'?'C ':'P ')+fK(o.K),color:b.ink3,position:'insideEndTop',fontSize:10.5},lineStyle:{color:b.ink3,type:'dotted'}})),{yAxis:0,label:{show:false},lineStyle:{color:b.ink3}}]}},
      {name:'Over een week',type:'line',showSymbol:false,data:nw,lineStyle:{color:b.mkt,width:1.6,type:'dashed'},itemStyle:{color:b.mkt}}]});
    $('#payNote').textContent=`Resultaat ten opzichte van vandaag als ${legs[0].un} beweegt.${stock?' Je aandelen tellen mee, zodat je ziet hoe de geschreven calls je opwaartse winst begrenzen.':''}`;}
  // expiratieladder
  const months=[...new Set(xs.map(o=>fExp(o.E)))];const uu=[...new Set(xs.map(o=>o.u))];
  C('chExpiry').setOption({textStyle:b.text,grid:{left:8,right:8,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},valueFormatter:v=>v?eur(v):'-'},
   xAxis:{type:'category',data:months,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:0}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},
   series:uu.map((u,ui)=>({name:u,type:'bar',stack:'e',barMaxWidth:46,data:months.map(m=>Math.round(xs.filter(o=>o.u===u&&fExp(o.E)===m).reduce((a,o)=>a+o.n*o.mult*o.K,0))),itemStyle:{color:b.cat[ui%8],borderRadius:2}}))});
  // resultaat per maand
  const mm={};CLOSED_OPT.forEach(o=>{const d=new Date(o.close.t);const key=d.getUTCFullYear()*12+d.getUTCMonth();mm[key]=(mm[key]||0)+o.pnl;});
  const k0=Math.min(...Object.keys(mm).map(Number)),k1=new Date(TODAY).getUTCFullYear()*12+new Date(TODAY).getUTCMonth();const keys=[];for(let q=k0;q<=k1;q++)keys.push(q);
  let cum=0;const cumA=keys.map(q=>Math.round(cum+=mm[q]||0));
  C('chOptMonth').setOption({textStyle:b.text,grid:{left:8,right:8,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},valueFormatter:v=>eurS(v)},
   xAxis:{type:'category',data:keys.map(q=>MONTHS[q%12]+" '"+String(Math.floor(q/12)).slice(2)),...b.ax,splitLine:{show:false}},
   yAxis:[{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},{type:'value',...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}}],
   series:[{name:'Per maand',type:'bar',barMaxWidth:12,data:keys.map(q=>({value:Math.round(mm[q]||0),itemStyle:{color:(mm[q]||0)>=0?b.good:b.bad,borderRadius:2}}))},
    {name:'Cumulatief',type:'line',yAxisIndex:1,showSymbol:false,data:cumA,lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.1)}}]});
  // strategieen
  const st=OPT_PLAN.map(pl=>{const cs=CLOSED_OPT.filter(o=>o.pl===pl),op=OPEN_OPT.filter(o=>o.pl===pl);const pn=cs.map(o=>o.pnl);
    return {pl,n:cs.length,open:op.length,win:cs.length?cs.filter(o=>o.pnl>0).length/cs.length:0,tot:pn.reduce((a,v)=>a+v,0)+op.reduce((a,o)=>a+o.upnl,0),best:Math.max(0,...pn),worst:Math.min(0,...pn)};}).sort((a,b)=>b.tot-a.tot);
  $('#tblStrat').innerHTML=`<thead><tr><th>Strategie</th><th class="n">Trades</th><th>Gewonnen</th><th class="n">Beste / slechtste</th><th class="n">Totaal</th></tr></thead><tbody>`+
   st.map(r=>`<tr><td><b>${r.pl.naam}</b><span class="sub2">${r.pl.side<0?'schrijven':'kopen'} · ${r.pl.type==='C'?'calls':'puts'} · ${r.pl.n} contract${r.pl.n>1?'en':''}${r.open?' · '+r.open+' lopend':''}</span></td><td class="n num">${r.n}</td>
    <td class="num"><span class="probbar"><i style="width:${r.win*100}%"></i></span>${pct(r.win,0)}</td><td class="n num"><span class="up">${eurS(r.best)}</span><span class="sub2 down">${eurS(r.worst)}</span></td><td class="n num ${cls(r.tot)}"><b>${eurS(r.tot)}</b></td></tr>`).join('')+'</tbody>';
  // verdeling
  const pn=CLOSED_OPT.map(o=>o.pnl);const bw=500;const bmin=Math.floor(Math.min(...pn)/bw)*bw,bmax=Math.ceil(Math.max(...pn)/bw)*bw;const bins=[];for(let v=bmin;v<bmax;v+=bw)bins.push(v);
  C('chOptHist').setOption({textStyle:b.text,grid:{left:8,right:8,top:12,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>`${eurS(bins[p[0].dataIndex])} tot ${eurS(bins[p[0].dataIndex]+bw)}: <b>${p[0].value} trades</b>`},
   xAxis:{type:'category',data:bins.map(v=>v===0?'0':(v>0?'+':'−')+nf2.format(Math.abs(v)/1000).replace(/,?0+$/,'')+'k'),...b.ax,splitLine:{show:false}},yAxis:{type:'value',minInterval:1,...b.ax},
   series:[{type:'bar',barCategoryGap:'12%',data:bins.map(v=>({value:pn.filter(x=>x>=v&&x<v+bw).length,itemStyle:{color:v>=0?b.good:b.bad,borderRadius:[3,3,0,0]}}))}]});
  $('#stratPick').innerHTML=[['ALL','Alles'],...OPT_PLAN.map(p=>[p.id,p.naam])].map(([v,l])=>`<button aria-pressed="${v===stratSel}" data-v="${v}">${l}</button>`).join('');
  renderOptClosed();}
function renderOptClosed(){const xs=CLOSED_OPT.filter(o=>stratSel==='ALL'||o.pl.id===stratSel).sort((a,b)=>b.close.t-a.close.t);
  $('#tblOptClosed').innerHTML=`<thead><tr><th>Optie</th><th></th><th class="n">Aantal</th><th>Geopend</th><th>Gesloten</th><th>Hoe</th><th class="n">Open</th><th class="n">Sluit</th><th class="n">Resultaat</th></tr></thead><tbody>`+
   xs.map(o=>`<tr><td><b>${optName(o)}</b></td><td>${sideLbl(o)}</td><td class="n num">${o.side*o.n}</td><td class="num">${fdate(o.t0)}</td><td class="num">${fdate(o.close.t)}</td><td style="color:var(--ink-2)">${o.close.how}</td>
    <td class="n num">${nf2.format(o.p0)}</td><td class="n num">${nf2.format(o.close.p)}</td><td class="n num ${cls(o.pnl)}">${eurS(o.pnl)}</td></tr>`).join('')+'</tbody>';
  $('#optClosedCount').textContent=`${xs.length} gesloten posities. Kosten € ${nf2.format(OPT_FEE)} per contract per transactie, niets bij waardeloos verlopen.`;}

/* ============ SPREIDING ============ */
// doorkijk: losse aandelen tellen bij hun land, ETF's worden over hun landen verdeeld
function lookThrough(){const c={},via={};const add=(land,v,src)=>{c[land]=(c[land]||0)+v;via[land]=via[land]||{d:0,e:0};via[land][src]+=v;};
  OPEN.forEach(x=>{if(x.etf){const L=LOOK[x.lt];const s=Object.values(L).reduce((a,b)=>a+b,0);Object.entries(L).forEach(([land,w])=>add(land,x.val*w/s,'e'));}else add(x.cty,x.val,'d');});
  return {c,via};}
let ccyMode='lt';
function renderSpread(){const b=base();const {c,via}=lookThrough();const tot=Object.values(c).reduce((a,b)=>a+b,0);
  const regs={};Object.entries(c).forEach(([land,v])=>{const r=REGION[land]||'Overig ontwikkeld';(regs[r]=regs[r]||[]).push([land,v]);});
  const RC={'Europa':0,'Noord-Amerika':1,'Azië-Pacific':2,'Opkomende markten':3,'Overig ontwikkeld':4};
  const sun=Object.entries(regs).sort((a,b)=>b[1].reduce((s,x)=>s+x[1],0)-a[1].reduce((s,x)=>s+x[1],0)).map(([r,ls])=>({name:r,itemStyle:{color:b.cat[RC[r]??5]},
    children:ls.sort((a,b)=>b[1]-a[1]).map(([land,v],k)=>({name:land,value:+(v/tot*100).toFixed(2),itemStyle:{color:hexA(b.cat[RC[r]??5],Math.max(.35,.95-k*.09))}}))}));
  document.getElementById('chSun').style.height=NARROW()?'340px':'480px';
  C('chSun').setOption({textStyle:b.text,tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${p.name}</b>: ${pct(p.value/100)}`+(via[p.name]?`<br>Direct ${eur(via[p.name].d)} · via ETF's ${eur(via[p.name].e)}`:'')},
   series:[{type:'sunburst',data:sun,radius:['18%','94%'],sort:null,nodeClick:false,itemStyle:{borderColor:b.sf,borderWidth:2,borderRadius:4},
    levels:[{},{r0:'18%',r:'52%',label:{color:'#fff',fontWeight:600,fontSize:NARROW()?10:12,rotate:0,minAngle:NARROW()?30:14,formatter:p=>p.name+'\n'+pct(p.value/100,0)}},{r0:'53%',r:'94%',label:{show:!NARROW(),color:b.ink,fontSize:11,minAngle:7,align:'right',formatter:p=>p.name}}]}],
   graphic:[{type:'text',left:'center',top:'middle',style:{text:Object.keys(c).length+'\nlanden',fill:b.ink2,font:'600 13px Inter',align:'center'}}]});
  // beleggingstype
  const sv=STK.reduce((a,x)=>a+x.val,0),ev=ETFS.reduce((a,x)=>a+x.val,0);const lo=OPEN_OPT.filter(o=>o.val>0).reduce((a,o)=>a+o.val,0),so=-OPEN_OPT.filter(o=>o.val<0).reduce((a,o)=>a+o.val,0);
  const at=[{name:'Aandelen',value:sv,ci:0},{name:"ETF's",value:ev,ci:1},{name:'Opties (gekocht)',value:lo,ci:2}];const atT=at.reduce((a,d)=>a+d.value,0);
  donut('chAsset',at.map(d=>({...d,value:+(d.value/atT*100).toFixed(2)})));
  $('#assetNote').textContent=`Geschreven opties zijn een verplichting van ${eur(so)} en staan daarom niet in de taart. Netto optiewaarde: ${eurS(OPTT.val)}.`;
  // valuta
  const cc={};if(ccyMode==='lt'){Object.entries(c).forEach(([land,v])=>{const k=CCYOF[land]||(REGION[land]==='Europa'?'EUR':REGION[land]==='Opkomende markten'?'Overig opkomend':'EUR');cc[k]=(cc[k]||0)+v;});}
  else OPEN.forEach(x=>cc[x.ccy]=(cc[x.ccy]||0)+x.val);
  const CN={EUR:'Euro',USD:'Dollar',CHF:'Zwitserse frank',DKK:'Deense kroon',JPY:'Yen',GBP:'Pond',CAD:'Canadese dollar',AUD:'Australische dollar',CNY:'Yuan',INR:'Roepie',TWD:'Taiwanese dollar',KRW:'Won','Overig opkomend':'Overig opkomend'};
  const ccT=Object.values(cc).reduce((a,b)=>a+b,0);const ce=Object.entries(cc).sort((a,b)=>b[1]-a[1]);const top=ce.slice(0,6),rest=ce.slice(6).reduce((a,x)=>a+x[1],0);
  donut('chCcy2',[...top.map(([k2,v],i)=>({name:CN[k2]||k2,value:+(v/ccT*100).toFixed(2),ci:i})),...(rest?[{name:'Overig',value:+(rest/ccT*100).toFixed(2),ci:7}]:[])]);
  // thuismarktvoorkeur: jij vs MSCI World
  const W=LOOK.msciw;const lands=[...new Set([...Object.keys(W),...Object.keys(c)])].filter(l=>!l.startsWith('Overig')).map(l=>[l,(c[l]||0)/tot*100,W[l]||0]).sort((a,b2)=>(b2[1]-b2[2])-(a[1]-a[2]));
  const sel=[...lands.slice(0,6),...lands.slice(-4)].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b2)=>(a[1]-a[2])-(b2[1]-b2[2]));
  C('chHome').setOption({textStyle:b.text,grid:{left:8,right:48,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>{const r=sel[p.dataIndex];return `<b>${r[0]}</b><br>Jij ${nf2.format(r[1])}% · MSCI World ${nf2.format(r[2])}%`;}},
   xAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>(v>0?'+':'')+v}},yAxis:{type:'category',data:sel.map(r=>r[0]),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2}},
   series:[{type:'bar',barWidth:12,data:sel.map(r=>{const d=r[1]-r[2];return {value:+d.toFixed(1),itemStyle:{color:d>=0?b.cat[1]:b.cat[0],borderRadius:d>=0?[0,4,4,0]:[4,0,0,4]}};}),label:{show:true,position:'right',color:b.ink2,fontSize:11,formatter:p=>(p.value>0?'+':'')+nf2.format(p.value).replace(/,?0+$/,'')}}]});
  const nl=(c['Nederland']||0)/tot;$('#homeNote').textContent=`Nederland is ${pct(nl)} van je vermogen, tegen ${nf2.format(W['Nederland'])}% in de MSCI World. Een thuismarktvoorkeur is normaal, maar maakt je gevoeliger voor de Nederlandse economie.`;
  // tabel
  const rows=Object.entries(c).sort((a,b2)=>b2[1]-a[1]);
  $('#tblCountry').innerHTML=`<thead><tr><th>Land</th><th>Regio</th><th class="n">Direct</th><th class="n">Via ETF's</th><th>Gewicht</th></tr></thead><tbody>`+
   rows.map(([land,v])=>`<tr><td><b>${land}</b></td><td style="color:var(--ink-2)">${REGION[land]||'Overig'}</td><td class="n num">${via[land].d?eur(via[land].d):'–'}</td><td class="n num">${via[land].e?eur(via[land].e):'–'}</td><td class="num" style="white-space:nowrap"><span class="probbar"><i style="width:${v/rows[0][1]*100}%"></i></span>${pct(v/tot)}</td></tr>`).join('')+'</tbody>';
  $('#spreadHero').innerHTML=`<div class="stat"><span class="l">Landen (met doorkijk)</span><span class="big num">${Object.keys(c).length}</span></div>
   <div class="stat"><span class="l">Buiten Europa</span><span class="v num">${pct(Object.entries(c).filter(([l])=>REGION[l]!=='Europa').reduce((a,x)=>a+x[1],0)/tot)}</span></div>
   <div class="stat"><span class="l">Niet in euro</span><span class="v num">${pct(1-(cc.EUR||0)/ccT)}</span></div>
   <div class="stat"><span class="l">ETF's</span><span class="v num">${pct(ev/(sv+ev))}</span></div>`;}

/* ============ BELEGGERSGEDRAG: analyse van je eigen beslissingen ============ */
// Alle maatstaven komen uit je eigen transacties en koersen. Onderzoek dient als ijkpunt, niet als oordeel.
const BM=()=>BENCH.MSCIW.s;
const fwd=(arr,i,w)=>i+w<NW?arr[i+w]/arr[i]-1:null;
const RESEARCH={
  odean98:{t:'Odean (1998), Journal of Finance',k:'Beleggers verkopen winnaars 1,5 keer zo graag als verliezers (PGR 14,8% tegen PLR 9,8%), terwijl de verkochte winnaars het daarna beter deden dan de vastgehouden verliezers.'},
  odean99:{t:'Odean (1999), American Economic Review',k:'Aandelen die particulieren kochten deden het het jaar erna 3,3 procentpunt slechter dan de aandelen die ze ervoor verkochten.'},
  barber00:{t:'Barber & Odean (2000), Journal of Finance',k:'De 20% huishoudens die het meest handelden haalden 11,4% per jaar, tegen 18,5% voor de markt. Vooral door kosten.'},
  barber08:{t:'Barber & Odean (2008), Review of Financial Studies',k:'Particulieren kopen vooral aandelen die in het nieuws zijn of hard zijn gestegen: aandacht drijft aankopen.'},
  mstar25:{t:'Morningstar, Mind the Gap (jaarlijks onderzoek)',k:'De gemiddelde fondsbelegger haalt structureel ruim 1 procentpunt per jaar minder dan de fondsen waarin hij belegt, door slecht getimede stortingen en opnames.'},
  frazzini06:{t:'Frazzini (2006), Journal of Finance',k:'Het dispositie-effect vertraagt hoe nieuws in koersen komt: wie verliezers vasthoudt, betaalt daar een prijs voor.'},
  french91:{t:'French & Poterba (1991), American Economic Review',k:'Beleggers houden het overgrote deel in hun eigen land aan, veel meer dan de wereldwijde marktweging rechtvaardigt.'},
  kumar09:{t:'Kumar (2009), Journal of Finance',k:'Particulieren hebben een voorkeur voor "loterij-aandelen" (goedkoop, zeer beweeglijk) en doen het daarmee structureel slechter.'},
  bryz23:{t:'Bryzgalova, Pavlova & Sikorskaya (2023), Journal of Finance',k:'Particuliere optiehandelaren verliezen gemiddeld geld, vooral op korte looptijden en door hoge spreads.'},
  esb:{t:'Cox, Kamolsareeratana & Kouwenberg (2018), Netspar / ESB',k:'Een kleine groep Nederlandse beleggers vertoont dwangmatig handelsgedrag: zij daytraden vijf keer zo vaak en hebben vaker hefboomproducten.'},
  hoffmann14:{t:'Hoffmann & Shefrin (2014), Journal of Banking & Finance',k:'Nederlandse brokerklanten die opties handelen en technische analyse gebruiken, behalen duidelijk lagere rendementen.'},
  afm15:{t:'AFM (2015), Inzichten zelfstandige beleggers',k:'Overmoed met te veel handelen, en te weinig spreiding (vaak door thuismarktvoorkeur), zijn de twee belangrijkste oorzaken van zwakke rendementen bij Nederlandse zelfbeleggers.'},
  kahneman:{t:'Kahneman, Thinking, Fast and Slow (2011)',k:'Een beslisdagboek beschermt tegen achterafwijsheid: je ziet wat je toen echt dacht, niet wat je je nu herinnert.'},
  bessem18:{t:'Bessembinder (2018), Journal of Financial Economics',k:'De meeste losse aandelen doen het over hun hele levensduur slechter dan staatsleningen; een handvol toppers maakt het hele marktrendement.'},
};
// --- transacties opnieuw afspelen voor kostprijs per moment ---
const TRADES=TX.filter(t=>t.ty==='BUY'||t.ty==='SELL').map(t=>({...t,i:widx(t.d),x:BY[t.t]}));
const BEH=(()=>{const st={};INS.forEach(x=>st[x.t]={q:0,cL:0});const out={buys:[],sells:[],disp:{rg:0,rl:0,pg:0,pl:0,days:0},closed:[]};
  const lastBuy={};
  // per verkoopweek: dispositie-telling (Odean) over alle posities die je toen had
  const sellWeeks=new Set(TRADES.filter(t=>t.ty==='SELL').map(t=>t.i));
  TRADES.forEach(t=>{const S=st[t.t];const x=t.x;const i=t.i;
    if(t.ty==='BUY'){
      const lo=Math.min(...x.px.slice(Math.max(0,i-52),i+1)),hi=Math.max(...x.px.slice(Math.max(0,i-52),i+1));const rng52=hi>lo?(t.price-lo)/(hi-lo):.5;
      const run13=i>=13?x.px[i]/x.px[i-13]-1:null;const f26=fwd(x.px,i,26),f52=fwd(x.px,i,52);const b52=fwd(BM(),i,52);
      out.buys.push({t:t.t,d:t.d,i,amt:-t.amt,price:t.price,rng52,run13,f26,f52,ex52:f52!=null&&b52!=null?(1+f52)/(1+b52)-1:null,etf:!!x.etf});
      S.q+=t.q;S.cL+=t.q*t.price;lastBuy[t.t]=lastBuy[t.t]??t.d;}
    else{const avg=S.cL/S.q;const gain=t.price/avg-1;
      if(sellWeeks.has(i)&&!out._seen?.has(i)){out._seen=out._seen||new Set();out._seen.add(i);out.disp.days++;
        const soldNow=new Set(TRADES.filter(u=>u.ty==='SELL'&&u.i===i).map(u=>u.t));
        Object.entries(st).forEach(([k,P])=>{if(P.q<=0)return;const y=BY[k];const g=y.px[i]>P.cL/P.q;if(soldNow.has(k)){g?out.disp.rg++:out.disp.rl++;}else{g?out.disp.pg++:out.disp.pl++;}});}
      const f26=fwd(x.px,i,26),f52=fwd(x.px,i,52);const lo=Math.min(...x.px.slice(Math.max(0,i-52),i+1)),hi=Math.max(...x.px.slice(Math.max(0,i-52),i+1));
      const path=[];for(let k=0;k<=52&&i+k<NW;k++)path.push(x.px[i+k]/x.px[i]-1);
      const regret=f52!=null?t.q*(x.px[i+52]-t.price)*fxAt(x.ccy,Math.min(NW-1,i+52)):t.q*(x.p-t.price)*fxAt(x.ccy,NW-1);
      out.sells.push({t:t.t,d:t.d,i,q:t.q,price:t.price,gain,f26,f52,path,regret,rng52:hi>lo?(t.price-lo)/(hi-lo):.5,held:(t.d-(lastBuy[t.t]||t.d))/DAY});
      S.cL-=avg*t.q;S.q-=t.q;if(S.q<=0){out.closed.push({t:t.t,ret:gain,days:(t.d-(lastBuy[t.t]||t.d))/DAY});S.cL=0;lastBuy[t.t]=null;}}});
  const D_=out.disp;D_.pgr=D_.rg+D_.pg?D_.rg/(D_.rg+D_.pg):0;D_.plr=D_.rl+D_.pl?D_.rl/(D_.rl+D_.pl):0;D_.ratio=(D_.pgr+.03)/(D_.plr+.03);
  // open posities: hoe lang en met welk resultaat (winnaars vs verliezers vasthouden)
  out.open=OPEN.filter(x=>!x.etf).map(x=>({t:x.t,ret:x.p/x.avgL-1,days:(TODAY-(TX.find(t=>t.t===x.t&&t.ty==='BUY')||{d:TODAY}).d)/DAY,w:x.w}));
  return out;})();
// rendementskloof: geldgewogen (IRR) tegen tijdgewogen (TWR)
const YRS=(TODAY-START)/(365.25*DAY);const TWRA=Math.pow(1+T.twr,1/YRS)-1;const GAP=IRR-TWRA;
// kosten en omloopsnelheid per jaar
const COST={};TX.forEach(t=>{const y=new Date(t.d).getUTCFullYear();COST[y]=COST[y]||{fee:0,turn:0,n:0,opt:0};COST[y].fee+=t.fee||0;if(t.ty==='BUY'||t.ty==='SELL'){COST[y].turn+=Math.abs(t.amt);COST[y].n++;}if(t.ty==='OPT')COST[y].opt++;});
Object.entries(COST).forEach(([y,c])=>{const a=widx(Date.UTC(+y,0,1)),z=+y===new Date(TODAY).getUTCFullYear()?NW-1:widx(Date.UTC(+y+1,0,1));const av=mean(SER.v.slice(a,z+1).filter(v=>v>0))||1;c.avg=av;c.turnPct=c.turn/2/av;c.feePct=c.fee/av;});
const FEES_ALL=TX.reduce((a,t)=>a+(t.fee||0),0);
// spreiding
const HHI=OPEN.reduce((a,x)=>a+x.w*x.w,0);const EFFN=1/HHI;
const NLW=OPEN.filter(x=>x.cty==='Nederland').reduce((a,x)=>a+x.w,0);
// wat-als: nooit verkocht, alles in MSCI World, vast bedrag per maand in MSCI World
const WHATIF=(()=>{const keep=new Array(NW).fill(0),q={};INS.forEach(x=>q[x.t]=0);let ti=0;const buys=TRADES.filter(t=>t.ty==='BUY');
  for(let i=0;i<NW;i++){while(ti<buys.length&&buys[ti].i<=i){q[buys[ti].t]+=buys[ti].q;ti++;}let v=0;INS.forEach(x=>{if(q[x.t])v+=q[x.t]*x.px[i]*fxAt(x.ccy,i);});keep[i]=v;}
  // nooit verkocht: geen verkoopopbrengst; eerlijk vergelijken door verkoopopbrengst bij de werkelijke lijn op te tellen
  const sold=new Array(NW).fill(0);let cum=0;let si=0;const sells=TX.filter(t=>t.ty==='SELL').sort((a,b)=>a.d-b.d);for(let i=0;i<NW;i++){while(si<sells.length&&widx(sells[si].d)<=i){cum+=sells[si].amt;si++;}sold[i]=cum;}
  const B=BM();let u=0;const world=[];for(let i=0;i<NW;i++){u+=Math.max(0,SER.cf[i])/B[i];world.push(u*B[i]);}
  const total=SER.cf.reduce((a,v)=>a+Math.max(0,v),0);const months=Math.round(NW/4.345);const per=total/months;let u2=0;const dca=[];for(let i=0;i<NW;i++){if(i%4===0||i===0)u2+=per*(4/4.345)/B[i];dca.push(u2*B[i]);}
  const actualPlus=SER.v.map((v,i)=>v+sold[i]);
  return {keep,world,dca,actualPlus,total};})();
// --- scores 0-100 per gedragskenmerk ---
const cl=(v,a,b)=>Math.max(0,Math.min(100,Math.round((v-a)/(b-a)*100)));
const avgRng=mean(BEH.buys.filter(b=>!b.etf).map(b=>b.rng52));const chase=BEH.buys.filter(b=>!b.etf&&b.run13>.2).length/Math.max(1,BEH.buys.filter(b=>!b.etf).length);
const exBuys=BEH.buys.filter(b=>b.ex52!=null);const buyHit=exBuys.filter(b=>b.ex52>0).length/Math.max(1,exBuys.length);
const sellOk=BEH.sells.filter(s=>s.f52!=null);const sellHit=sellOk.filter(s=>s.f52<fwd(BM(),s.i,52)).length/Math.max(1,sellOk.length);const regretSum=BEH.sells.reduce((a,s)=>a+s.regret,0);
const avgTurn=mean(Object.values(COST).map(c=>c.turnPct));const feeDrag=FEES_ALL/YRS/Math.max(1,mean(SER.v.filter(v=>v>0)));
const BSC=[
 {k:'Instap',v:Math.round(.5*cl(1-avgRng,.2,.7)+.3*cl(buyHit,.3,.7)+.2*cl(1-chase,.5,1)),d:'Koop je op een gunstig moment, of na een flinke stijging?'},
 {k:'Verkoop',v:sellOk.length?Math.round(.6*cl(sellHit,.2,.8)+.4*cl(-regretSum/Math.max(1,WHATIF.total)*10,-.5,.5)):60,d:'Deden je verkochte aandelen het daarna slechter dan de markt?'},
 {k:'Discipline',v:cl(-(Math.log(BEH.disp.ratio||1)),-1.4,.7),d:'Verkoop je winnaars en verliezers even makkelijk (dispositie-effect)?'},
 {k:'Kosten',v:cl(-feeDrag,-.01,-.0005),d:'Hoeveel van je rendement gaat op aan transactiekosten?'},
 {k:'Spreiding',v:Math.round(.6*cl(EFFN,5,20)+.4*cl(-NLW,-.7,-.2)),d:'Effectief aantal posities en thuismarktvoorkeur.'},
 {k:'Rust',v:Math.round(.6*cl(-avgTurn,-1,-.1)+.4*cl(-GAP,-.03,.01)),d:'Handelsfrequentie en de kloof tussen jouw rendement en dat van je beleggingen.'}];
const BSCORE=Math.round(mean(BSC.map(s=>s.v)));
// referentie: typische particuliere belegger volgens het onderzoek (indicatief)
const BREF=[45,40,38,55,42,45];
// --- leerpunten: wat we zien, wat onderzoek zegt, wat je kunt proberen ---
function lessons(){const L=[];const add=(sev,title,seen,res,tryit,metric)=>L.push({sev,title,seen,res,tryit,metric});
  const d=BEH.disp;
  if(d.ratio>1.2)add(2,'Je verkoopt winnaars sneller dan verliezers',`Op je verkoopmomenten verkocht je ${pct(d.pgr,0)} van je winnaars maar ${pct(d.plr,0)} van je verliezers: ${nf2.format(d.ratio)} keer zo vaak winnaars.`,'odean98','Stel bij elke positie vooraf een reden om te verkopen vast. Vraag bij een verliezer: zou ik dit vandaag opnieuw kopen?',`${nf2.format(d.ratio)}×`);
  else add(0,'Je verkoopt winnaars en verliezers even makkelijk',`Je verkoopratio winnaars/verliezers is ${nf2.format(d.ratio)}. Dat is beter dan de gemiddelde belegger (rond 1,5).`,'odean98','Houd dit vast door verkoopredenen in je dagboek te noteren.',`${nf2.format(d.ratio)}×`);
  if(avgRng>.6)add(2,'Je koopt vaak dicht bij de top van het jaar',`Gemiddeld kocht je op ${pct(avgRng,0)} van de jaarband (0% is de jaarbodem, 100% de top). ${pct(chase,0)} van je aandelenaankopen kwam na een stijging van meer dan 20% in drie maanden.`,'barber08','Zet een aankoop eerst op een wachtlijst met een koersdoel. Koop in twee of drie delen in plaats van in één keer.',pct(avgRng,0));
  else add(0,'Je instapmomenten zijn rustig gekozen',`Je kocht gemiddeld op ${pct(avgRng,0)} van de jaarband en zelden na een sterke stijging.`,'barber08','Blijf een wachtlijst met koersdoelen gebruiken.',pct(avgRng,0));
  if(sellOk.length){const better=sellOk.filter(s=>s.f52>.1);if(regretSum>0)add(regretSum>WHATIF.total*.05?2:1,'Je verkochte aandelen liepen daarna verder op',`Een jaar na verkoop stonden je verkochte posities samen ${eurS(regretSum)} hoger dan je verkoopprijs. ${better.length} van de ${sellOk.length} verkopen stegen daarna meer dan 10%.`,'odean99','Verkoop in delen, en noteer vooraf waarom je verkoopt. Kijk na een jaar terug in je dagboek.',eur(regretSum)+' gemist');
    else add(0,'Je verkoopmomenten pakten goed uit',`Een jaar na verkoop stonden je verkochte posities samen ${eur(-regretSum)} lager dan je verkoopprijs.`,'odean99','Noteer in je dagboek wat je toen zag, zodat je dit kunt herhalen.',eur(-regretSum)+' bespaard');}
  if(GAP<-.005)add(2,'Je rendement blijft achter bij dat van je beleggingen',`Je beleggingen haalden ${pct(TWRA)} per jaar (tijdgewogen), jij ${pct(IRR)} (geldgewogen). Het verschil van ${pct(-GAP)} per jaar komt door het moment waarop je geld erbij deed of eruit haalde.`,'mstar25','Beleg een vast bedrag op een vaste dag. Dan hangt je instap niet van je gevoel af.',pctS(GAP));
  else add(0,'Je timing van stortingen werkt in je voordeel',`Je geldgewogen rendement (${pct(IRR)}) ligt ${pct(GAP)} per jaar boven het tijdgewogen rendement (${pct(TWRA)}): je stortte vaker op gunstige momenten.`,'mstar25','Periodiek beleggen houdt dit vol zonder dat je de markt hoeft te voorspellen.',pctS(GAP));
  if(NLW>.35)add(1,'Sterke thuismarktvoorkeur',`${pct(NLW,0)} van je vermogen zit in Nederlandse aandelen, tegen ruim 1% in de MSCI World.`,'french91','Gebruik nieuwe inleg eerst voor regio\'s waar je weinig hebt. Onder Analyse, bij Spreiding, zie je waar.',pct(NLW,0));
  if(EFFN<12)add(1,'Je portefeuille is geconcentreerder dan hij lijkt',`Je hebt ${OPEN.length} posities, maar door de verschillen in gewicht gedraagt hij zich als ${nf1.format(EFFN)} gelijke posities.`,'bessem18','Overweeg een maximum per positie, bijvoorbeeld 8%, en stel dat in bij je eigen regels.',nf1.format(EFFN));
  if(avgTurn>.5)add(1,'Je handelt relatief veel',`Je omloopsnelheid is gemiddeld ${pct(avgTurn,0)} per jaar. Transactiekosten waren in totaal ${eur(FEES_ALL)}.`,'afm15','Vaste momenten om te handelen (bijvoorbeeld eens per kwartaal) halen impulsaankopen eruit.',pct(avgTurn,0));
  else add(0,'Je kosten zijn laag',`Transactiekosten waren in totaal ${eur(FEES_ALL)}, zo'n ${pct(feeDrag,2)} van je vermogen per jaar.`,'barber00','Blijf letten op valutakosten bij buitenlandse aandelen.',eur(FEES_ALL));
  const sp=CLOSED_OPT.filter(o=>o.side<0);if(sp.length){const wins=sp.filter(o=>o.pnl>0);const avgW=mean(wins.map(o=>o.pnl)),worst=Math.min(...sp.map(o=>o.pnl));const n=Math.round(-worst/avgW);
    add(n>10?2:1,'Schrijven van opties: veel kleine winsten, af en toe een grote klap',`${pct(wins.length/sp.length,0)} van je geschreven opties was winstgevend, gemiddeld ${eur(avgW)}. Je grootste verlies (${eur(worst)}) kostte de winst van ${n} trades.`,'hoffmann14','Bepaal vooraf je maximale verlies per positie en houd je aan een stop. Bekijk in de tab Opties het uitbetalingsprofiel.',`${n}×`);}
  const lot=OPEN.filter(x=>!x.etf&&x.vol>.45);if(lot.length)add(1,'Een deel zit in zeer beweeglijke aandelen',`${lot.map(x=>x.t).join(', ')} bewegen meer dan 45% per jaar en vormen samen ${pct(lot.reduce((a,x)=>a+x.w,0),0)} van je portefeuille.`,'kumar09','Geef zulke posities bewust een kleiner gewicht.',pct(lot.reduce((a,x)=>a+x.w,0),0));
  return L.sort((a,b)=>b.sev-a.sev);}
const LESSONS=lessons();

/* ---------- tweede laag: patronen die je zelf niet ziet ---------- */
Object.assign(RESEARCH,{
  hartzmark15:{t:'Hartzmark (2015), Review of Financial Studies',k:'Beleggers verkopen vooral hun beste en hun slechtste positie in de portefeuille (het rangorde-effect). Niet het rendement zelf, maar de opvallendheid bepaalt de verkoop.'},
  statman06:{t:'Statman, Thorley & Vorkink (2006), Review of Financial Studies',k:'Na goede maanden gaan beleggers meer handelen: succes wordt toegeschreven aan eigen kunde (zelfoverschatting), en dat verhoogt de handelsfrequentie.'},
  strahil11:{t:'Strahilevitz, Odean & Barber (2011), Journal of Marketing Research',k:'Beleggers kopen liever een eerder verkocht aandeel terug als het sindsdien gedaald is, en mijden aandelen die na verkoop stegen, om spijt te vermijden.'},
  bauer09:{t:'Bauer, Cosemans & Eichholtz (2009), Journal of Banking & Finance',k:'Ruim 68.000 Nederlandse beleggers: wie opties handelde, deed het risico-gecorrigeerd zo\'n 1% per maand slechter (bruto) dan wie alleen aandelen had. Vermaak en gokken waren het belangrijkste motief, afdekken nauwelijks.'},
  tetlock05:{t:'Tetlock (2005), Expert Political Judgment; Tetlock & Gardner (2015), Superforecasting',k:'Wie voorspellingen opschrijft en later nakijkt, wordt meetbaar beter in inschatten. Zonder nakijken blijft overmoed onzichtbaar.'},
});
const DEEP=(()=>{const st={};INS.forEach(x=>st[x.t]={q:0,c:0});const rank=[];const rebuys=[];const lastSell={};
  TRADES.forEach(t=>{const S=st[t.t];const i=t.i;
    if(t.ty==='BUY'){const ls=lastSell[t.t];if(ls&&!t.x.etf)rebuys.push({t:t.t,sd:ls.d,sp:ls.price,bd:t.d,bp:t.price,ch:t.price/ls.price-1,gap:(t.d-ls.d)/DAY});S.q+=t.q;S.c+=t.q*t.price;return;}
    if(!t.x.etf){const held=Object.entries(st).filter(([k,P])=>P.q>0&&!BY[k].etf).map(([k,P])=>({k,r:BY[k].px[i]/(P.c/P.q)-1})).sort((a,b)=>a.r-b.r);
      if(held.length>=3){const pos=held.findIndex(h=>h.k===t.t);if(pos>=0)rank.push({t:t.t,d:t.d,p:pos/(held.length-1),n:held.length,r:held[pos].r});}}
    const avg=S.c/S.q;S.c-=avg*t.q;S.q-=t.q;if(S.q<=1e-9){S.q=0;S.c=0;}lastSell[t.t]={d:t.d,price:t.price};});
  const qb=[0,0,0,0,0];rank.forEach(r=>qb[Math.min(4,Math.floor(r.p*5))]++);const extreme=rank.length?(qb[0]+qb[4])/rank.length:0;
  // zelfoverschatting: aantal losse aan- en verkopen per maand tegen het portefeuillerendement van de drie maanden ervoor
  const mo={};TRADES.filter(t=>!t.x.etf).forEach(t=>{const d=new Date(t.d);const k=d.getUTCFullYear()*12+d.getUTCMonth();mo[k]=(mo[k]||0)+1;});
  const d0=new Date(START),d1=new Date(TODAY);const k0=d0.getUTCFullYear()*12+d0.getUTCMonth()+3,k1=d1.getUTCFullYear()*12+d1.getUTCMonth();const months=[];
  for(let k=k0;k<=k1;k++){const ms=Date.UTC(Math.floor(k/12),k%12,1);const i=widx(ms),j=widx(Date.UTC(Math.floor((k-3)/12),(k-3)%12,1));if(i-j<8)continue;months.push({k,ms,prior:SER.idx[i]/SER.idx[j]-1,n:mo[k]||0});}
  const sorted=months.map(m=>m.prior).sort((a,b)=>a-b);const lo=sorted[Math.floor(sorted.length/3)],hi=sorted[Math.floor(sorted.length*2/3)];
  const bucket=f=>{const v=months.filter(f).map(m=>m.n);return v.length?mean(v):0;};
  const oc={after:{up:bucket(m=>m.prior>=hi),mid:bucket(m=>m.prior>lo&&m.prior<hi),down:bucket(m=>m.prior<=lo)}};
  const mx=mean(months.map(m=>m.prior)),my=mean(months.map(m=>m.n));const cov=mean(months.map(m=>(m.prior-mx)*(m.n-my)));const vx=mean(months.map(m=>(m.prior-mx)**2));const vy=mean(months.map(m=>(m.n-my)**2));
  oc.slope=vx?cov/vx:0;oc.icpt=my-oc.slope*mx;oc.corr=vx&&vy?cov/Math.sqrt(vx*vy):0;oc.ratio=oc.after.down?oc.after.up/oc.after.down:1;
  // marktonrust: handel je vooral in weken waarin de markt hard bewoog?
  const absR=AEXR.map(Math.abs);const thr=absR.slice(1).sort((a,b)=>a-b)[Math.floor((absR.length-1)*.8)];
  const disc=TRADES.filter(t=>!t.x.etf);const loud=disc.filter(t=>absR[t.i]>=thr||absR[Math.max(0,t.i-1)]>=thr);
  const att={thr,share:disc.length?loud.length/disc.length:0,base:1-.8*.8,n:disc.length,loud:loud.length};
  // opties: verdeling van uitkomsten en kosten
  const opt={written:CLOSED_OPT.filter(o=>o.side<0).map(o=>o.pnl),bought:CLOSED_OPT.filter(o=>o.side>0).map(o=>o.pnl)};
  const gw=CLOSED_OPT.filter(o=>o.pnl+o.fees>0).reduce((a,o)=>a+o.pnl+o.fees,0);opt.feeShare=gw?OPTT.fees/gw:0;
  opt.byStrat=OPT_PLAN.map(pl=>{const os=CLOSED_OPT.filter(o=>o.pl.id===pl.id);return {id:pl.id,n:pl.name||pl.id,trades:os.length,net:os.reduce((a,o)=>a+o.pnl,0),fees:os.reduce((a,o)=>a+o.fees,0),win:os.length?os.filter(o=>o.pnl>0).length/os.length:0};}).filter(s=>s.trades);
  return {rank,qb,extreme,months,oc,att,rebuys,opt};})();
{const L=LESSONS;const add=(sev,title,seen,res,tryit,metric)=>L.push({sev,title,seen,res,tryit,metric});
  if(DEEP.rank.length>=5){const ex=DEEP.extreme;if(ex>.55)add(1,'Je verkoopt vooral je uitschieters',`${pct(ex,0)} van je verkopen was je beste of slechtste positie op dat moment (bij toeval zou dat rond 40% zijn). De middenmoot blijft liggen, ook als daar de zwakste verhalen zitten.`,'hartzmark15','Loop bij elke verkoop je hele lijst langs en vraag per positie: zou ik dit vandaag kopen? Verkoop wat het minst overtuigt, niet wat het meest opvalt.',pct(ex,0));
    else add(0,'Je verkoopt niet alleen je uitschieters',`${pct(ex,0)} van je verkopen was je beste of slechtste positie; dat ligt rond wat je bij toeval verwacht.`,'hartzmark15','Blijf je verkopen onderbouwen per positie, los van de rangorde in je lijst.',pct(ex,0));}
  const oc=DEEP.oc;if(oc.ratio>1.3&&oc.after.up>.6)add(1,'Na goede maanden ga je meer handelen',`Na een sterk kwartaal deed je gemiddeld ${nf1.format(oc.after.up)} losse transacties per maand, na een zwak kwartaal ${nf1.format(oc.after.down)}. Dat is ${nf1.format(oc.ratio)} keer zo veel.`,'statman06','Plan na een goede periode bewust een week zonder nieuwe posities, en schrijf eerst in je dagboek waarom je wilt handelen.',nf1.format(oc.ratio)+'×');
  if(DEEP.att.n>=6&&DEEP.att.share>DEEP.att.base+.1)add(1,'Je handelt vaak in onrustige weken',`${pct(DEEP.att.share,0)} van je losse aan- en verkopen viel in of vlak na een week waarin de AEX meer dan ${pct(DEEP.att.thr,1)} bewoog. Bij een gelijkmatige spreiding zou dat ${pct(DEEP.att.base,0)} zijn.`,'barber08','Zet een order in onrustige weken pas de dag erna door. Een nacht slapen haalt veel reactieve handel weg.',pct(DEEP.att.share,0));
  L.sort((a,b)=>b.sev-a.sev);}

// voorspellingen uit het dagboek nakijken
const HOR_W={'< 1 jaar':52,'1-3 jaar':104,'> 3 jaar':156};
function calib(){return TRADES.filter(t=>t.ty==='BUY').map(t=>{const e=jEntry(t);if(!e||!e.target||!(e.target>0))return null;const x=t.x;const h=HOR_W[e.horizon]||104;const end=Math.min(NW-1,t.i+h);
  const exp=e.target/t.price-1;let hit=null;for(let k=t.i;k<=end;k++)if(x.px[k]>=e.target){hit=k;break;}const real=x.px[end]/t.price-1;const done=t.i+h<=NW-1;
  return {t:t.t,d:t.d,exp,real,hit,done,state:hit!=null?'gehaald':done?'niet gehaald':'loopt nog',weeks:hit!=null?hit-t.i:null,demo:!!e.demo};}).filter(Boolean);}

function renderDeep(){const b=base();const D_=DEEP;const nar=NARROW();
  // rangorde-effect
  const exp=D_.rank.length/5;const lbl=nar?['Slechtste','','Midden','','Beste']:['Slechtste 20%','20-40%','Midden','60-80%','Beste 20%'];
  C('chDpRank').setOption({textStyle:b.text,grid:{left:8,right:12,top:26,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>`${['Slechtste 20%','20-40%','Midden','60-80%','Beste 20%'][p[0].dataIndex]} van je posities<br><b>${p[0].value}</b> verkopen<br>Bij toeval: ${nf1.format(exp)}`},
   xAxis:{type:'category',data:lbl,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,color:b.ink2,interval:0}},yAxis:{type:'value',minInterval:1,...b.ax},
   series:[{type:'bar',barWidth:'56%',data:D_.qb.map((v,k)=>({value:v,itemStyle:{color:k===0||k===4?b.acc:hexA(b.acc,.35),borderRadius:[4,4,0,0]}})),label:{show:true,position:'top',color:b.ink,fontWeight:600},
     markLine:{silent:true,symbol:'none',data:[{yAxis:+exp.toFixed(2)}],lineStyle:{color:b.mkt,type:'dashed'},label:{formatter:'bij toeval',position:'insideEndTop',color:b.ink3}}}]});
  $('#dpRankNote').innerHTML=`Bij elke verkoop van een los aandeel rangschikken we al je posities op ongerealiseerd resultaat. <b>${pct(D_.extreme,0)}</b> van je ${D_.rank.length} verkopen kwam uit de buitenste twee groepen; bij toeval is dat 40%.`;
  // zelfoverschatting
  const Q=[];{const s0=new Date(START);let y=s0.getUTCFullYear(),q=Math.floor(s0.getUTCMonth()/3)+1;const disc=TRADES.filter(t=>!t.x.etf);
    while(Date.UTC(y,(q-1)*3,1)<=TODAY){const a=Date.UTC(y,(q-1)*3,1),z=Date.UTC(y,q*3,1);const ia=widx(a),ip=widx(Date.UTC(y,(q-2)*3,1));
      Q.push({l:`${nar?"'"+String(y).slice(2):y} K${q}`,n:disc.filter(t=>t.d>=a&&t.d<z).length,prior:ia-ip>=8?SER.idx[ia]/SER.idx[ip]-1:null});q++;if(q>4){q=1;y++;}}}
  C('chDpConf').setOption({textStyle:b.text,grid:{left:8,right:8,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2,fontSize:11.5},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>{const r=Q[p[0].dataIndex];return `<b>${r.l}</b><br>${r.n} losse transacties<br>Kwartaal ervoor: ${r.prior==null?'–':pctS(r.prior)}`;}},
   xAxis:{type:'category',data:Q.map(r=>r.l),...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:nar?7:3}},
   yAxis:[{type:'value',minInterval:1,...b.ax},{type:'value',...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}}],
   series:[{name:'Transacties',type:'bar',barWidth:'60%',itemStyle:{color:hexA(b.acc,.85),borderRadius:[3,3,0,0]},data:Q.map(r=>r.n)},
    {name:'Rendement kwartaal ervoor',type:'line',yAxisIndex:1,showSymbol:false,smooth:.3,data:Q.map(r=>r.prior==null?null:+(r.prior*100).toFixed(1)),lineStyle:{color:b.mkt,width:1.6},itemStyle:{color:b.mkt},
     areaStyle:{color:hexA(b.mkt,.08)},markLine:{silent:true,symbol:'none',data:[{yAxis:0}],lineStyle:{color:b.ink3,type:'dotted'},label:{show:false}}}]});
  $('#dpConfKpis').innerHTML=[['Na een sterk kwartaal',nf1.format(D_.oc.after.up),'transacties per maand'],['Na een gemiddeld kwartaal',nf1.format(D_.oc.after.mid),'transacties per maand'],['Na een zwak kwartaal',nf1.format(D_.oc.after.down),'transacties per maand']].map(([l,v,s])=>`<div class="kpi"><span>${l}</span><b class="num">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');
  // marktonrust en handel
  const st=nar?2:1;const wk=[];for(let i=1;i<NW;i+=st)wk.push(i);const disc=TRADES.filter(t=>!t.x.etf);const thr=D_.att.thr;
  C('chDpAtt').setOption({textStyle:b.text,grid:{left:8,right:12,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2,fontSize:11.5},icon:'roundRect',itemWidth:10,itemHeight:10,data:['Koop','Verkoop']},
   tooltip:{...b.tip,trigger:'item',formatter:p=>p.seriesType==='bar'?`Week van ${fdate(p.value[0])}<br>AEX ${p.data.r>0?'steeg':'daalde'} ${pct(Math.abs(p.data.r),1)}`:`<b>${p.data.t.ty==='BUY'?'Koop':'Verkoop'} ${p.data.t.t}</b><br>${fdate(p.data.t.d)}<br>AEX die week ${pctS(AEXR[p.data.t.i],1)}`},
   xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[{type:'bar',barWidth:nar?2:2.4,data:wk.map(i=>({value:[wdate(i),+(Math.abs(AEXR[i])*100).toFixed(2)],r:AEXR[i],itemStyle:{color:Math.abs(AEXR[i])>=thr?hexA(b.mkt,.85):hexA(b.ink3,.28)}})),
     markLine:{silent:true,symbol:'none',data:[{yAxis:+(thr*100).toFixed(2)}],lineStyle:{color:b.mkt,type:'dashed'},label:{formatter:'onrustig',position:'insideEndTop',color:b.ink3}}},
    {name:'Koop',type:'scatter',data:disc.filter(t=>t.ty==='BUY').map(t=>({value:[t.d,+(Math.abs(AEXR[t.i])*100).toFixed(2)],t})),symbolSize:9,itemStyle:{color:b.good,borderColor:b.sf,borderWidth:1.2},z:4},
    {name:'Verkoop',type:'scatter',symbol:'diamond',data:disc.filter(t=>t.ty==='SELL').map(t=>({value:[t.d,+(Math.abs(AEXR[t.i])*100).toFixed(2)],t})),symbolSize:11,itemStyle:{color:b.bad,borderColor:b.sf,borderWidth:1.2},z:4}]});
  $('#dpAttNote').innerHTML=`De staafjes zijn de weekbewegingen van de AEX; de 20% grootste zijn gemarkeerd. <b>${pct(D_.att.share,0)}</b> van je ${D_.att.n} losse aan- en verkopen viel in zo'n week of de week erna, tegen ${pct(D_.att.base,0)} bij toeval.`;
  // terugkopen
  const rb=D_.rebuys;
  if(rb.length){C('chDpRebuy').setOption({textStyle:b.text,grid:{left:8,right:56,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>{const r=rb[p.dataIndex];return `<b>${r.t}</b><br>Verkocht ${fdate(r.sd)} voor ${nf2.format(r.sp)}<br>Teruggekocht ${fdate(r.bd)} voor ${nf2.format(r.bp)}<br>${Math.round(r.gap/30.4)} maanden later, ${pctS(r.ch)}`;}},
     xAxis:{type:'value',splitNumber:nar?3:5,...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},yAxis:{type:'category',inverse:true,data:rb.map(r=>`${r.t} ${new Date(r.bd).getUTCFullYear()}`),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2}},
     series:[{type:'bar',barWidth:12,data:rb.map(r=>({value:+(r.ch*100).toFixed(1),itemStyle:{color:r.ch>0?b.bad:b.good,borderRadius:r.ch>0?[0,4,4,0]:[4,0,0,4]}})),label:{show:true,position:'right',color:b.ink2,formatter:p=>(p.value>0?'▲ ':'▼ ')+pct(Math.abs(p.value)/100)}}]});
    const up=rb.filter(r=>r.ch>0);$('#dpRebuyNote').innerHTML=`${rb.length} keer kocht je een aandeel terug dat je eerder verkocht. ${up.length?`${up.length} keer lag de koers toen hoger dan je verkoopprijs (rood): je kocht duurder terug. Dat is niet per se fout, maar wel een moment om je verkoopreden van toen terug te lezen.`:'Je wachtte steeds tot de koers onder je verkoopprijs lag.'}`;}
  else{$('#chDpRebuy').style.height='60px';$('#dpRebuyNote').textContent='Je hebt nog geen eerder verkocht aandeel teruggekocht.';}
  // opties: uitkomsten
  const all=[...D_.opt.written.map(v=>['w',v]),...D_.opt.bought.map(v=>['b',v])];
  if(all.length){const edges=[-Infinity,-1000,-250,0,50,100,250,1000,Infinity];const lab=nar?['>1k','250-1k','0-250','0-50','50-100','100-250','250-1k','>1k']:['verlies >1k','250-1k','0-250','winst 0-50','50-100','100-250','250-1k','>1k'];
    const cnt=k=>edges.slice(0,-1).map((e,j)=>all.filter(([s,v])=>s===k&&v>e&&v<=edges[j+1]).length);
    C('chDpOpt').setOption({textStyle:b.text,grid:{left:8,right:8,top:30,bottom:26,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2,fontSize:11.5},icon:'roundRect',itemWidth:10,itemHeight:10},
     tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}}},xAxis:{type:'category',data:lab,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:0,hideOverlap:false,fontSize:nar?8.5:11,color:(v,k)=>k<3?b.bad:b.good},name:'resultaat per trade in euro',nameLocation:'middle',nameGap:26,nameTextStyle:{color:b.ink3}},yAxis:{type:'value',minInterval:1,...b.ax},
     series:[{name:'Geschreven',type:'bar',stack:'o',data:cnt('w'),itemStyle:{color:b.acc}},{name:'Gekocht',type:'bar',stack:'o',data:cnt('b'),itemStyle:{color:b.cat[0],borderRadius:[3,3,0,0]}}],});
    const w=D_.opt.written,bo=D_.opt.bought;$('#dpOptKpis').innerHTML=[['Geschreven: winstkans',w.length?pct(w.filter(v=>v>0).length/w.length,0):'–',w.length?`gemiddeld ${eurS(mean(w))} per trade`:''],['Gekocht: winstkans',bo.length?pct(bo.filter(v=>v>0).length/bo.length,0):'–',bo.length?`gemiddeld ${eurS(mean(bo))} per trade`:''],['Kosten',pct(D_.opt.feeShare,0),'van je bruto optiewinsten']].map(([l,v,s])=>`<div class="kpi"><span>${l}</span><b class="num">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');}
}

function renderCalib(){const b=base();const R=calib();const nar=NARROW();
  const done=R.filter(r=>r.state!=='loopt nog');const hit=done.filter(r=>r.state==='gehaald');const aE=done.length?mean(done.map(r=>r.exp)):0,aR=done.length?mean(done.map(r=>r.real)):0;
  $('#dpCalKpis').innerHTML=[['Koersdoelen nagekeken',String(done.length),`${R.length-done.length} lopen nog`],['Gehaald binnen je horizon',done.length?pct(hit.length/done.length,0):'–',hit.length?`gemiddeld na ${Math.round(mean(hit.map(r=>r.weeks))/4.345)} maanden`:''],['Je verwachtte gemiddeld',pctS(aE,0),'koersdoel boven je aankoopprijs'],['Het werd gemiddeld',pctS(aR,0),'aan het eind van je horizon']].map(([l,v,s])=>`<div class="kpi"><span>${l}</span><b class="num">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');
  const col={'gehaald':b.good,'niet gehaald':b.bad,'loopt nog':b.mkt};const mx=Math.max(60,...R.map(r=>r.exp*100+10));
  C('chDpCal').setOption({textStyle:b.text,grid:{left:8,right:16,top:nar?54:30,bottom:30,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2,fontSize:11.5},icon:'circle',itemWidth:9,itemHeight:9},
   tooltip:{...b.tip,trigger:'item',formatter:p=>{const r=p.data.r;if(!r)return '';return `<b>${r.t}</b> gekocht ${fdate(r.d)}${r.demo?' (voorbeeld)':''}<br>Koersdoel: ${pctS(r.exp)}<br>${r.done?'Aan eind horizon':'Tot nu toe'}: ${pctS(r.real)}<br>${r.state}${r.weeks!=null?' na '+Math.round(r.weeks/4.345)+' maanden':''}`;}},
   xAxis:{type:'value',min:0,max:Math.ceil(mx/10)*10,...b.ax,splitLine:{show:false},name:'verwacht (koersdoel)',nameLocation:'middle',nameGap:24,nameTextStyle:{color:b.ink3},axisLabel:{...b.ax.axisLabel,formatter:v=>'+'+v+'%'}},
   yAxis:{type:'value',min:-50,max:150,interval:50,...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[...['gehaald','niet gehaald','loopt nog'].map(s=>({name:s[0].toUpperCase()+s.slice(1),type:'scatter',symbolSize:11,data:R.filter(r=>r.state===s).map(r=>({value:[+(r.exp*100).toFixed(1),+(Math.max(-49,Math.min(148,r.real*100))).toFixed(1)],r})),itemStyle:{color:col[s],opacity:.85,borderColor:b.sf,borderWidth:1}})),
    {name:'Zoals verwacht',type:'line',silent:true,showSymbol:false,data:[[0,0],[Math.ceil(mx/10)*10,Math.ceil(mx/10)*10]],lineStyle:{color:b.acc,type:'dashed',width:1.5},itemStyle:{color:b.acc},tooltip:{show:false}}]});
  $('#dpCalNote').innerHTML=R.length?`Elke stip is een aankoop met een koersdoel in je dagboek. Boven de stippellijn deed het aandeel het beter dan je verwachtte, eronder slechter. ${done.length&&aE>aR+.05?`Je koersdoelen lagen gemiddeld ${pct(aE-aR,0)} te hoog: houd daar rekening mee bij je volgende doel.`:done.length?'Je verwachtingen waren gemiddeld realistisch.':''}`:'Vul bij een aankoop in je dagboek een koersdoel en horizon in; hier zie je later hoe goed je inschatting was.';}

/* ---------- dagboek (lokaal opgeslagen tot er een login is) ---------- */
const MOTIVES=['Waardering','Groei','Dividend','Momentum','Nieuws','Tip of forum','Spreiding','Periodiek','Winst nemen','Verlies nemen','Herbalanceren','Geld nodig'];
const EMOS=[['😰','Angstig'],['😟','Onzeker'],['😐','Neutraal'],['🙂','Zeker'],['🤩','Euforisch']];
const JKEY='pk-dagboek-v1';
let JOURNAL={};try{JOURNAL=JSON.parse(localStorage.getItem(JKEY)||'{}')||{};}catch(_){JOURNAL={};}
const txId=t=>`${new Date(t.d).toISOString().slice(0,10)}-${t.ty}-${t.t}-${t.q}`;
function demoEntry(t){const r=rng('j'+txId(t));if(r()<.25)return null;const x=BY[t.t];const i=widx(t.d);
  const mot=t.ty==='BUY'?(x.etf?['Periodiek','Spreiding']:[r()<.4?'Waardering':r()<.5?'Groei':r()<.5?'Dividend':r()<.6?'Momentum':'Nieuws']):[r()<.5?'Winst nemen':r()<.5?'Herbalanceren':'Verlies nemen'];
  const run=i>=13?x.px[i]/x.px[i-13]-1:0;const emo=Math.max(0,Math.min(4,2+Math.round(run*6+(r()-.5)*1.5)));
  return {demo:true,motives:mot,conv:1+Math.floor(r()*5),emo,horizon:['< 1 jaar','1-3 jaar','> 3 jaar'][Math.floor(r()*3)],target:t.ty==='BUY'&&!x.etf?+(t.price*(1.15+r()*.3)).toFixed(2):null,
   note:t.ty==='BUY'?(x.etf?'Vaste inleg volgens plan.':['Koers terug na daling, fundament onveranderd.','Sterke cijfers, wil erbij zijn.','Analisten positief, koersdoel ruim hoger.','Mooi dividend, rustig bedrijf.','Iedereen heeft het erover, bang om de boot te missen.'][Math.floor(r()*5)]):['Doel bereikt.','Positie werd te groot.','Verhaal klopt niet meer.','Geld nodig voor iets anders.'][Math.floor(r()*4)]};}
const jEntry=t=>JOURNAL[txId(t)]||(JOURNAL._noDemo?null:demoEntry(t));
function saveJ(){try{localStorage.setItem(JKEY,JSON.stringify(JOURNAL));}catch(_){}}
const RULES_KEY='pk-regels-v1';
const RULE_DEF=[{id:'maxpos',l:'Maximaal % per positie',v:10,u:'%'},{id:'nochase',l:'Niet kopen na een stijging van meer dan … in 3 maanden',v:25,u:'%'},{id:'maxtrades',l:'Maximaal aantal aan- en verkopen per jaar',v:12,u:''},{id:'minhold',l:'Minimale houdperiode voor een verkoop',v:12,u:'mnd'},{id:'journal',l:'Elke transactie een dagboeknotitie',v:1,u:'aan/uit'}];
let RULES={};try{RULES=JSON.parse(localStorage.getItem(RULES_KEY)||'{}')||{};}catch(_){RULES={};}
const rv=id=>RULES[id]??RULE_DEF.find(r=>r.id===id).v;
function ruleBreaks(){const out=[];const byY={};
  TRADES.forEach(t=>{const y=new Date(t.d).getUTCFullYear();byY[y]=(byY[y]||0)+1;const x=t.x;
    if(t.ty==='BUY'&&!x.etf&&t.i>=13&&x.px[t.i]/x.px[t.i-13]-1>rv('nochase')/100)out.push({d:t.d,t:t.t,r:'nochase',s:`Gekocht na ${pctS(x.px[t.i]/x.px[t.i-13]-1,0)} in 3 maanden`});
    if(t.ty==='SELL'){const b=TRADES.filter(u=>u.t===t.t&&u.ty==='BUY'&&u.d<=t.d).pop();if(b&&(t.d-b.d)/DAY<rv('minhold')*30.4)out.push({d:t.d,t:t.t,r:'minhold',s:`Verkocht ${Math.round((t.d-b.d)/DAY/30.4)} maanden na de laatste aankoop`});}
    if(rv('journal')&&!jEntry(t))out.push({d:t.d,t:t.t,r:'journal',s:'Geen dagboeknotitie'});});
  Object.entries(byY).forEach(([y,n])=>{if(n>rv('maxtrades'))out.push({d:Date.UTC(+y,11,31),t:'–',r:'maxtrades',s:`${n} aan- en verkopen in ${y}`});});
  OPEN.filter(x=>x.w>rv('maxpos')/100).forEach(x=>out.push({d:TODAY,t:x.t,r:'maxpos',s:`Nu ${pct(x.w)} van je portefeuille`}));
  return out.sort((a,b)=>b.d-a.d);}

/* ---------- weergave ---------- */
let coachJ=null, jFilter='ALL';
function renderCoach(){const b=base();
  $('#coHero').innerHTML=`<div class="scorering" style="--v:${BSCORE}"><b class="num">${BSCORE}</b><span>van 100</span></div>
   <div class="t"><span class="eyebrow">Jouw beleggersprofiel</span><h2 style="margin:4px 0 6px">${BSCORE>=70?'Gedisciplineerde belegger':BSCORE>=55?'Bewuste belegger met leerpunten':'Hier valt veel te winnen'}</h2>
   <p style="margin:0;color:var(--ink-2);max-width:62ch">Gebaseerd op ${TRADES.length} aan- en verkopen, ${CLOSED_OPT.length} optietrades en ${NW} weken koersen. We vergelijken jouw beslissingen met wat er daarna gebeurde, en met wat onderzoek over particuliere beleggers zegt.</p></div>
   <div class="comini">${[['Leerpunten',LESSONS.filter(l=>l.sev===2).length],['Gemist na verkoop',eur(Math.max(0,regretSum))],['Gedragskloof',pctS(GAP)],['Regelbreuken',ruleBreaks().length]].map(([l,v])=>`<div><span>${l}</span><b class="num">${v}</b></div>`).join('')}</div>`;
  C('chCoRadar').setOption({textStyle:b.text,tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${p.name}</b><br>`+BSC.map((s,k)=>`${s.k}: ${p.value[k]}`).join('<br>')},legend:{bottom:0,left:'center',textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
   radar:{indicator:BSC.map(s=>({name:s.k,max:100})),radius:NARROW()?'58%':'66%',center:['50%','46%'],splitNumber:4,shape:'circle',axisName:{color:b.ink2,fontSize:12,fontWeight:600},splitLine:{lineStyle:{color:b.line}},splitArea:{areaStyle:{color:['transparent']}},axisLine:{lineStyle:{color:b.line}}},
   series:[{type:'radar',symbol:'circle',symbolSize:6,data:[{name:'Gemiddelde particuliere belegger',value:BREF,lineStyle:{color:b.mkt,type:'dashed',width:1.5},itemStyle:{color:b.mkt},areaStyle:{opacity:0}},
    {name:'Jij',value:BSC.map(s=>s.v),lineStyle:{color:b.acc,width:2.2},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.22)}}]}]});
  $('#coBars').innerHTML=BSC.map(s=>`<div class="cobar"><div><b>${s.k}</b><small>${s.d}</small></div><div class="track"><i style="width:${s.v}%;background:${s.v>=65?'var(--good)':s.v>=45?'var(--accent)':'var(--bad)'}"></i></div><span class="num">${s.v}</span></div>`).join('');
  // leerpunten
  $('#coLessons').innerHTML=LESSONS.map(l=>{const R=RESEARCH[l.res];return `<article class="lesson s${l.sev}"><header><span class="lv">${l.sev===2?'Belangrijk leerpunt':l.sev===1?'Let op':'Goed bezig'}</span><b class="num">${l.metric}</b></header>
   <h3>${l.title}</h3><p>${l.seen}</p><div class="res"><span>Wat onderzoek zegt</span>${R.k}<em>${R.t}</em></div><div class="try"><span>Probeer dit</span>${l.tryit}</div></article>`;}).join('');
  // instapmomenten: beeswarm op de jaarband
  const bs=BEH.buys.filter(x=>!x.etf);const lanes=[];const pts=bs.map(x=>{let lane=0;for(const L of [0,1,-1,2,-2,3,-3,4,-4]){if(!lanes.some(q=>q.l===L&&Math.abs(q.v-x.rng52)<.045)){lane=L;break;}}lanes.push({l:lane,v:x.rng52});return {x,lane};});
  C('chCoBuy').setOption({textStyle:b.text,grid:{left:12,right:12,top:30,bottom:44},tooltip:{...b.tip,trigger:'item',formatter:p=>{const x=p.data.x;return `<b>${x.t}</b> gekocht ${fdate(x.d)}<br>Op ${pct(x.rng52,0)} van de jaarband<br>3 maanden ervoor: ${x.run13!=null?pctS(x.run13):'–'}<br>Jaar erna t.o.v. MSCI World: ${x.ex52!=null?pctS(x.ex52):'nog geen jaar'}<br>Bedrag ${eur(x.amt)}`;}},
   xAxis:{type:'value',min:0,max:100,...b.ax,splitLine:{show:false},name:'← jaarbodem          positie in de jaarband          jaartop →',nameLocation:'middle',nameGap:28,nameTextStyle:{color:b.ink3,fontSize:11.5},axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   yAxis:{type:'value',min:-5,max:5,show:false},visualMap:{show:false,dimension:2,min:-.3,max:.3,inRange:{color:[b.bad,css('--div-mid'),b.good]}},
   series:[{type:'scatter',data:pts.map(p=>({value:[+(p.x.rng52*100).toFixed(1),p.lane,p.x.ex52??0],x:p.x,symbolSize:8+Math.sqrt(p.x.amt)/9,itemStyle:{borderColor:b.sf,borderWidth:1.5,opacity:p.x.ex52==null?.45:.95}})),
     markArea:{silent:true,data:[[{xAxis:0,itemStyle:{color:hexA(b.good,.06)}},{xAxis:33}],[{xAxis:67,itemStyle:{color:hexA(b.bad,.06)}},{xAxis:100}]]},
     markLine:{silent:true,symbol:'none',data:[{xAxis:+(avgRng*100).toFixed(1)}],lineStyle:{color:b.acc,width:2},label:{formatter:'jouw gemiddelde '+pct(avgRng,0),color:b.acc,fontWeight:600}}}]});
  $('#coBuyNote').textContent=`Elke stip is een aankoop van een los aandeel; grootte is het bedrag. Groen: het aandeel deed het het jaar erna beter dan de MSCI World, rood: slechter. ${pct(buyHit,0)} van je aankopen versloeg de markt in het jaar erna.`;
  // na de verkoop
  const ss=BEH.sells;const med=[];for(let k=0;k<=52;k++){const v=ss.map(s=>s.path[k]).filter(v=>v!=null).sort((a,b2)=>a-b2);med.push(v.length?v[Math.floor(v.length/2)]*100:null);}
  C('chCoSell').setOption({textStyle:b.text,grid:{left:8,right:16,top:16,bottom:30,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>p.seriesName==='Mediaan'?`Mediaan na ${p.dataIndex} weken: ${pctS(p.value/100)}`:`<b>${p.seriesName}</b><br>${p.dataIndex} weken na verkoop: ${pctS(p.value/100)}`},
   xAxis:{type:'category',data:[...Array(53).keys()],...b.ax,splitLine:{show:false},name:'weken na verkoop',nameLocation:'middle',nameGap:24,nameTextStyle:{color:b.ink3},axisLabel:{...b.ax.axisLabel,interval:12}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[...ss.map(s=>({name:`${s.t}, ${fdate(s.d)}`,type:'line',showSymbol:false,data:s.path.map(v=>+(v*100).toFixed(1)),lineStyle:{width:1.3,color:s.path.at(-1)>0?hexA(b.bad,.55):hexA(b.good,.55)},emphasis:{focus:'series',lineStyle:{width:2.5}}})),
    {name:'Mediaan',type:'line',showSymbol:false,data:med,lineStyle:{width:3,color:b.acc},z:5,markLine:{silent:true,symbol:'none',data:[{yAxis:0}],lineStyle:{color:b.ink3},label:{show:false}}}]});
  $('#coSellTbl').innerHTML=`<thead><tr><th>Verkoop</th><th class="n">Resultaat</th><th class="n">Jaar erna</th><th class="n">Gemist / bespaard</th></tr></thead><tbody>`+ss.map(s=>`<tr><td><b>${s.t}</b><span class="sub2">${fdate(s.d)} · ${Math.round(s.held/30.4)} mnd gehouden</span></td><td class="n num ${cls(s.gain)}">${pctS(s.gain)}</td><td class="n num ${s.f52==null?'':s.f52>0?'down':'up'}">${s.f52==null?'–':pctS(s.f52)}</td><td class="n num ${s.regret>0?'down':'up'}">${eurS(-s.regret)}</td></tr>`).join('')+'</tbody>';
  // dispositie
  const d=BEH.disp;C('chCoDisp').setOption({textStyle:b.text,grid:{left:8,right:24,top:30,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},valueFormatter:v=>pct(v/100,1)},
   xAxis:{type:'category',data:['Winnaars verkocht (PGR)','Verliezers verkocht (PLR)'],...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,color:b.ink2,interval:0}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[{name:'Jij',type:'bar',barWidth:34,data:[+(d.pgr*100).toFixed(1),+(d.plr*100).toFixed(1)],itemStyle:{color:b.acc,borderRadius:[4,4,0,0]},label:{show:true,position:'top',color:b.ink,fontWeight:600,formatter:p=>pct(p.value/100,1)}},
    {name:'Gemiddelde belegger (Odean 1998)',type:'bar',barWidth:34,data:[14.8,9.8],itemStyle:{color:hexA(b.mkt,.55),borderRadius:[4,4,0,0]},label:{show:true,position:'top',color:b.ink2,formatter:p=>pct(p.value/100,1)}}]});
  const allPos=[...BEH.closed.map(c=>({...c,open:false})),...BEH.open.map(o=>({...o,open:true}))];
  C('chCoHold').setOption({textStyle:b.text,grid:{left:8,right:16,top:16,bottom:30,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>{const r=p.data.r;return `<b>${r.t}</b> ${r.open?'(nog in bezit)':'(verkocht)'}<br>${Math.round(r.days/30.4)} maanden · ${pctS(r.ret)}`;}},
   xAxis:{type:'value',...b.ax,splitLine:{show:false},name:'maanden in bezit',nameLocation:'middle',nameGap:24,nameTextStyle:{color:b.ink3}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[{type:'scatter',data:allPos.map(r=>({value:[+(r.days/30.4).toFixed(1),+(Math.min(4,r.ret)*100).toFixed(1)],r,symbol:r.open?'circle':'diamond',symbolSize:r.open?11:13,itemStyle:{color:r.ret>=0?b.good:b.bad,opacity:r.open?.55:1,borderColor:b.sf,borderWidth:1.5},label:{show:!NARROW(),formatter:r.t,position:'right',color:b.ink3,fontSize:10}})),markLine:{silent:true,symbol:'none',data:[{yAxis:0}],lineStyle:{color:b.ink3},label:{show:false}}}]});
  // rendementskloof
  const ki=[];for(let i=0;i<NW;i+=1)ki.push(i);
  C('chCoGap').setOption({textStyle:b.text,grid:{left:8,right:12,top:16,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',formatter:p=>`${fdate(p[0].value[0])}<br>`+p.filter(q=>q.seriesType==='line').map(q=>`${q.marker}${q.seriesName}: ${pct(q.value[1]/100-1)}`).join('<br>')},
   xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>pctS(v/100-1,0)}},
   series:[{name:'Je beleggingen (tijdgewogen)',type:'line',showSymbol:false,data:ki.map(i=>[wdate(i),+SER.idx[i].toFixed(2)]),lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc}},
    {name:'Stortingen',type:'scatter',data:ki.filter(i=>SER.cf[i]>500).map(i=>{const f=fwd(SER.idx,i,52);return {value:[wdate(i),+SER.idx[i].toFixed(2)],symbolSize:5+Math.sqrt(SER.cf[i])/10,itemStyle:{color:f==null?b.ink3:f>0?b.good:b.bad,opacity:.85,borderColor:b.sf,borderWidth:1}};}),tooltip:{show:false}},
    {name:'Opnames',type:'scatter',symbol:'triangle',data:ki.filter(i=>SER.cf[i]<-500).map(i=>({value:[wdate(i),+SER.idx[i].toFixed(2)],symbolSize:8+Math.sqrt(-SER.cf[i])/12,itemStyle:{color:b.mkt}})),tooltip:{show:false}}]});
  $('#coGapKpis').innerHTML=[['Je beleggingen, per jaar',pct(TWRA),'tijdgewogen: los van wanneer je geld erbij deed'],['Jij, per jaar',pct(IRR),'geldgewogen: inclusief jouw timing'],['Gedragskloof',pctS(GAP),'Morningstar: gemiddeld ruim −1% per jaar']].map(([l,v,s])=>`<div class="kpi"><span>${l}</span><b>${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');
  // wat als
  const step=NARROW()?2:1;const wi=[];for(let i=0;i<NW;i+=step)wi.push(i);
  C('chCoWhat').setOption({textStyle:b.text,grid:{left:8,right:12,top:NARROW()?78:36,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2,fontSize:11.5},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',valueFormatter:v=>eur(v)},xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},
   series:[{name:'Werkelijk (incl. verkoopopbrengst)',type:'line',showSymbol:false,data:wi.map(i=>[wdate(i),Math.round(WHATIF.actualPlus[i])]),lineStyle:{color:b.acc,width:2.4},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.08)}},
    {name:'Nooit iets verkocht',type:'line',showSymbol:false,data:wi.map(i=>[wdate(i),Math.round(WHATIF.keep[i])]),lineStyle:{color:b.cat[2],width:1.6},itemStyle:{color:b.cat[2]}},
    {name:'Alles in MSCI World',type:'line',showSymbol:false,data:wi.map(i=>[wdate(i),Math.round(WHATIF.world[i])]),lineStyle:{color:b.mkt,width:1.6,type:'dashed'},itemStyle:{color:b.mkt}},
    {name:'Vast bedrag per maand in MSCI World',type:'line',showSymbol:false,data:wi.map(i=>[wdate(i),Math.round(WHATIF.dca[i])]),lineStyle:{color:b.cat[0],width:1.6,type:'dotted'},itemStyle:{color:b.cat[0]}}]});
  const fin={a:WHATIF.actualPlus[NW-1],k:WHATIF.keep[NW-1],w:WHATIF.world[NW-1],c:WHATIF.dca[NW-1]};
  $('#coWhatNote').innerHTML=`Zonder ooit te verkopen had je nu <b>${eurS(fin.k-fin.a)}</b> ${fin.k>fin.a?'meer':'minder'} gehad. Met alles in de MSCI World <b>${eurS(fin.w-fin.a)}</b>, met een vast maandbedrag <b>${eurS(fin.c-fin.a)}</b>. Opties en dividend tellen hier niet mee.`;
  // kosten en handel per jaar
  const ys=Object.keys(COST).map(Number).sort();C('chCoCost').setOption({textStyle:b.text,grid:{left:8,right:8,top:36,bottom:8,containLabel:true},legend:{top:0,left:0,textStyle:{color:b.ink2},icon:'roundRect',itemWidth:10,itemHeight:10},
   tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}}},xAxis:{type:'category',data:ys.map(y=>NARROW()?"'"+String(y).slice(2):String(y)),...b.ax,splitLine:{show:false}},
   yAxis:[{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v)}},{type:'value',...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}}],
   series:[{name:'Kosten',type:'bar',barMaxWidth:26,data:ys.map(y=>Math.round(COST[y].fee)),itemStyle:{color:b.cat[3],borderRadius:[3,3,0,0]},tooltip:{valueFormatter:v=>eur(v)}},
    {name:'Omloopsnelheid',type:'line',yAxisIndex:1,data:ys.map(y=>+(COST[y].turnPct*100).toFixed(0)),lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc},symbolSize:6,tooltip:{valueFormatter:v=>v+'%'}}]});
  renderDeep();renderJournal();renderRules();
  $('#coLib').innerHTML=Object.values(RESEARCH).map(r=>`<article class="libcard"><p>${r.k}</p><em>${r.t}</em></article>`).join('');}

function renderJournal(){renderCalib();const b=base();const xs=TX.filter(t=>t.ty==='BUY'||t.ty==='SELL').slice().reverse();
  const rows=xs.filter(t=>jFilter==='ALL'||(jFilter==='OPEN'?!jEntry(t):!!jEntry(t)));const done=xs.filter(t=>jEntry(t)).length;
  $('#jCount').textContent=`${done} van de ${xs.length} transacties hebben een notitie. ${Object.keys(JOURNAL).filter(k=>k!=='_noDemo').length?'Je eigen notities worden in deze browser bewaard.':'De notities zijn voorbeelden. Klik op een transactie om je eigen notitie te schrijven; die wordt in deze browser bewaard.'}`;
  $('#tblJournal').innerHTML=`<thead><tr><th>Datum</th><th>Transactie</th><th>Waarom</th><th>Gevoel</th><th class="n">Overtuiging</th><th class="n">Resultaat sindsdien</th></tr></thead><tbody>`+
   rows.slice(0,80).map(t=>{const e=jEntry(t);const x=BY[t.t];const since=t.ty==='BUY'?x.p/t.price-1:-(x.p/t.price-1);
    return `<tr class="jrow" data-id="${txId(t)}" tabindex="0"><td class="num">${fdate(t.d)}</td><td><div class="tk">${logo(x,24)}<div><b>${t.ty==='BUY'?'Koop':'Verkoop'} ${t.t}</b><small>${nf0.format(t.q)} × ${px(x,t.price)}</small></div></div></td>
     <td>${e?e.motives.map(m=>`<span class="chip">${m}</span>`).join(' ')+(e.demo?' <span class="chip demo">voorbeeld</span>':''):'<span class="addnote">+ notitie toevoegen</span>'}</td><td style="font-size:18px">${e?EMOS[e.emo][0]:''}</td><td class="n num">${e?'●'.repeat(e.conv)+'<span style="opacity:.25">'+'●'.repeat(5-e.conv)+'</span>':''}</td>
     <td class="n num ${cls(since)}">${pctS(since)}</td></tr>`;}).join('')+'</tbody>';
  // analyse: rendement per motief (aankopen), overtuiging vs resultaat
  const buys=xs.filter(t=>t.ty==='BUY'&&jEntry(t));const byM={};buys.forEach(t=>{const e=jEntry(t);const x=BY[t.t];const i=widx(t.d);const f=fwd(x.px,i,52);const bm=fwd(BM(),i,52);if(f==null)return;e.motives.forEach(m=>{(byM[m]=byM[m]||[]).push((1+f)/(1+bm)-1);});});
  const mm=Object.entries(byM).map(([m,v])=>[m,mean(v),v.length]).sort((a,b2)=>b2[1]-a[1]);
  C('chJMot').setOption({textStyle:b.text,grid:{left:8,right:48,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${mm[p.dataIndex][0]}</b><br>Jaar na aankoop t.o.v. MSCI World: ${pctS(p.value/100)}<br>${mm[p.dataIndex][2]} aankopen`},
   xAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},yAxis:{type:'category',inverse:true,data:mm.map(r=>r[0]),...b.ax,splitLine:{show:false},axisLabel:{color:b.ink2}},
   series:[{type:'bar',barWidth:12,data:mm.map(r=>({value:+(r[1]*100).toFixed(1),itemStyle:{color:r[1]>=0?b.good:b.bad,borderRadius:r[1]>=0?[0,4,4,0]:[4,0,0,4]}})),label:{show:true,position:'right',color:b.ink2,fontSize:11,formatter:p=>pctS(p.value/100)}}]});
  const emoR=EMOS.map((_,k)=>{const v=buys.filter(t=>jEntry(t).emo===k).map(t=>{const x=BY[t.t];const i=widx(t.d);const f=fwd(x.px,i,52),bm=fwd(BM(),i,52);return f==null?null:(1+f)/(1+bm)-1;}).filter(v=>v!=null);return [k,v.length?mean(v):null,v.length];});
  C('chJEmo').setOption({textStyle:b.text,grid:{left:8,right:8,top:20,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`${EMOS[p.dataIndex][1]}: ${p.value==null?'–':pctS(p.value/100)} t.o.v. de markt (${emoR[p.dataIndex][2]} aankopen)`},
   xAxis:{type:'category',data:EMOS.map(e=>e[0]+' '+(NARROW()?'':e[1])),...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,fontSize:13,interval:0}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
   series:[{type:'bar',barWidth:'50%',data:emoR.map(r=>r[1]==null?null:{value:+(r[1]*100).toFixed(1),itemStyle:{color:r[1]>=0?b.good:b.bad,borderRadius:3}}),label:{show:true,position:'top',color:b.ink2,fontSize:11,formatter:p=>pctS(p.value/100)}}]});}

function openJournal(id){const t=TX.find(u=>(u.ty==='BUY'||u.ty==='SELL')&&txId(u)===id);if(!t)return;coachJ=id;const e=JOURNAL[id]||{motives:[],conv:3,emo:2,horizon:'1-3 jaar',target:null,note:'',reflect:''};const x=BY[t.t];const dr=$('#drawer');
  const after=t.ty==='BUY'?x.p/t.price-1:-(x.p/t.price-1);
  dr.innerHTML=`<button class="x" id="dx" aria-label="Sluiten">×</button><div class="tk" style="padding-right:44px">${logo(x,40)}<div><h2 style="font-size:20px">${t.ty==='BUY'?'Koop':'Verkoop'} ${x.n}</h2><small style="max-width:none">${fdate(t.d)} · ${nf0.format(t.q)} × ${px(x,t.price)} · sindsdien <span class="${cls(after)}">${pctS(after)}</span></small></div></div>
   <form id="jform" class="jform">
    <label>Waarom deed je dit?</label><div class="chips">${MOTIVES.map(m=>`<button type="button" class="chip sel${e.motives.includes(m)?' on':''}" data-m="${m}">${m}</button>`).join('')}</div>
    <label>Hoe voelde je je?</label><div class="emos">${EMOS.map(([em,l],k)=>`<button type="button" class="emo${e.emo===k?' on':''}" data-e="${k}" title="${l}">${em}<small>${l}</small></button>`).join('')}</div>
    <label>Hoe zeker was je? <span class="num" id="convV">${e.conv}/5</span></label><input type="range" min="1" max="5" step="1" value="${e.conv}" id="jconv">
    <div class="g2"><div><label>Horizon</label><select id="jhor">${['< 1 jaar','1-3 jaar','> 3 jaar'].map(h=>`<option${e.horizon===h?' selected':''}>${h}</option>`).join('')}</select></div>
     <div><label>${t.ty==='BUY'?'Koersdoel':'Prijs waarop je terug zou kopen'}</label><input id="jtgt" type="number" step="0.01" inputmode="decimal" value="${e.target??''}" placeholder="${px(x,t.price*1.2)}"></div></div>
    <label>Wat is je verhaal? Wat moet er gebeuren om ongelijk te hebben?</label><textarea id="jnote" rows="4" placeholder="Bijvoorbeeld: koers terug na daling, orderboek sterk. Ik verkoop als de marge twee kwartalen daalt.">${e.demo?'':(e.note||'')}</textarea>
    <label>Terugblik (vul later in)</label><textarea id="jref" rows="3" placeholder="Klopte je verhaal? Wat leer je ervan?">${e.reflect||''}</textarea>
    <div class="jact"><button type="submit" class="btn primary">Bewaar notitie</button>${JOURNAL[id]?'<button type="button" class="btn" id="jdel">Verwijder</button>':''}</div>
    <p class="note">Wordt alleen in deze browser bewaard. Met een account komt dit later in je profiel.</p></form>`;
  dr.hidden=false;$('#scrim').hidden=false;$('#dx').onclick=closeDrawer;
  dr.querySelectorAll('.chip.sel').forEach(c=>c.onclick=()=>c.classList.toggle('on'));
  dr.querySelectorAll('.emo').forEach(c=>c.onclick=()=>{dr.querySelectorAll('.emo').forEach(o=>o.classList.remove('on'));c.classList.add('on');});
  $('#jconv').oninput=ev=>$('#convV').textContent=ev.target.value+'/5';
  if($('#jdel'))$('#jdel').onclick=()=>{delete JOURNAL[id];saveJ();closeDrawer();renderJournal();renderRules();};
  $('#jform').onsubmit=ev=>{ev.preventDefault();const on=[...dr.querySelectorAll('.chip.sel.on')].map(c=>c.dataset.m);const em=dr.querySelector('.emo.on');
    JOURNAL[id]={motives:on.length?on:['Overig'],emo:em?+em.dataset.e:2,conv:+$('#jconv').value,horizon:$('#jhor').value,target:$('#jtgt').value?+$('#jtgt').value:null,note:$('#jnote').value.trim(),reflect:$('#jref').value.trim(),saved:Date.now()};
    saveJ();closeDrawer();renderJournal();renderRules();};}
function renderRules(){const br=ruleBreaks();const RL=Object.fromEntries(RULE_DEF.map(r=>[r.id,r.l]));
  $('#rulesForm').innerHTML=RULE_DEF.map(r=>`<label class="rule"><span>${r.l}</span>${r.u==='aan/uit'?`<input type="checkbox" data-r="${r.id}"${rv(r.id)?' checked':''}>`:`<span class="rin"><input type="number" data-r="${r.id}" value="${rv(r.id)}" min="0" inputmode="numeric"> ${r.u}</span>`}<em class="num">${br.filter(x=>x.r===r.id).length} keer</em></label>`).join('');
  $('#rulesForm').querySelectorAll('input').forEach(inp=>inp.onchange=()=>{RULES[inp.dataset.r]=inp.type==='checkbox'?(inp.checked?1:0):+inp.value;try{localStorage.setItem(RULES_KEY,JSON.stringify(RULES));}catch(_){}renderRules();});
  $('#rulesBreaks').innerHTML=br.length?br.slice(0,14).map(x=>`<div class="sig"><span class="ic bad">!</span><div>${x.t!=='–'?'<b>'+x.t+'</b> · ':''}${x.s}<small>${fdate(x.d)} · ${RL[x.r]}</small></div></div>`).join(''):'<p class="note">Geen regelbreuken. Mooi.</p>';}

/* ============ drawer ============ */
function openDrawer(t){const x=BY[t];if(!x||!x.q)return;const dr=$('#drawer');const nextD=DIVS.find(v=>v.t===t&&!v.hist);
  dr.innerHTML=`<button class="x" id="dx" aria-label="Sluiten">×</button>
   <div class="tk" style="padding-right:44px">${glyph(x.s,44)}<div><h2 style="font-size:22px">${x.n}</h2><small style="max-width:none">${x.t} · ${x.ex} · ${x.isin}</small></div></div>
   <div class="hero"><div class="stat"><span class="l">Koers</span><span class="v num">${px(x)} <small class="${cls(x.day)}" style="font-size:13px">${pctS(x.day,2)}</small></span></div><div class="stat"><span class="l">${FV_U}</span><span class="v num">${px(x,x.fv)}</span></div></div>
   <div>${valPill(x)}</div>
   <div><h3 style="margin-bottom:4px">Koers, 3 jaar</h3><div id="chDrawer" style="height:200px"></div><div class="legend"><span><i class="line" style="background:var(--accent)"></i>Koers</span><span><i class="dash"></i>${FV_U} nu</span><span><i style="background:var(--ink-3);border-radius:50%"></i>Aankoop</span></div></div>
   <div><h3 style="margin-bottom:4px">Kompasscore</h3><div id="chDrawerR" style="height:210px"></div></div>
   <div class="dl">${[['Aantal',nf0.format(x.q)],['Gemiddelde aankoopprijs',px(x,x.avgL)],['Waarde',eur(x.val)],['Gewicht',pct(x.w)],['Totaal resultaat',`<span class="${cls(x.totRes)}">${eurS(x.totRes)} (${pctS(x.totPct)})</span>`],['Ontvangen dividend netto',eur(pos[t].divG-pos[t].divT)],['Dividendrendement',pct(x.yld,2)],['Volgende betaling',nextD?fdate(nextD.pay)+' · '+eur(nextD.net,2):'geen dividend'],['Sector',x.sec],['Branche',x.ind]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>`;
  dr.hidden=false;$('#scrim').hidden=false;$('#dx').focus();$('#dx').onclick=closeDrawer;
  const b=base();const i0=NW-156;const buys=TX.filter(tx=>tx.t===t&&tx.ty==='BUY'&&tx.d>=wdate(i0));
  C('chDrawer').setOption({textStyle:b.text,grid:{left:4,right:8,top:10,bottom:4,containLabel:true},tooltip:{...b.tip,trigger:'axis',valueFormatter:v=>px(x,v)},
   xAxis:{type:'time',...b.ax,splitLine:{show:false}},yAxis:{type:'value',scale:true,...b.ax},
   series:[{name:'Koers',type:'line',showSymbol:false,data:x.px.slice(i0).map((v,k)=>[wdate(i0+k),+v.toFixed(2)]),lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc},
     markLine:{silent:true,symbol:'none',data:[{yAxis:x.fv}],lineStyle:{color:b.mkt,type:'dashed'},label:{show:false}},
     markPoint:{symbol:'circle',symbolSize:9,itemStyle:{color:b.ink3,borderColor:b.sf,borderWidth:2},label:{show:false},data:buys.map(tx=>({coord:[tx.d,tx.price]}))}}]});
  const ro=radarOpt(b,true,false);ro.series[0].data[1]={name:x.t,value:x.s,lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.22)}};C('chDrawerR').setOption(ro);}
function closeDrawer(){$('#drawer').hidden=true;$('#scrim').hidden=true;['chDrawer','chDrawerR'].forEach(k=>{if(charts[k]){charts[k].dispose();delete charts[k];}});}
$('#scrim').onclick=closeDrawer;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
document.addEventListener('click',e=>{const tr=e.target.closest('tr.click');if(tr)openDrawer(tr.dataset.t);});
document.addEventListener('click',e=>{const tr=e.target.closest('tr.jrow');if(tr)openJournal(tr.dataset.id);});
document.addEventListener('keydown',e=>{if(e.key==='Enter'){const tr=e.target.closest&&e.target.closest('tr.jrow');if(tr)openJournal(tr.dataset.id);}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'){const tr=e.target.closest&&e.target.closest('tr.click');if(tr)openDrawer(tr.dataset.t);}});

/* ============ routing & controls ============ */
const VIEWS={overzicht:()=>{renderHero();renderValue();renderRadarOv();renderTree();renderSignals();renderHoldings();},
 analyse:()=>{renderRadar();renderLift();renderChecks();renderStrip();renderSankey();renderGeo();renderCorr();renderRisk();renderSpread();},
 waardering:renderVal, dividend:()=>{renderDivHero();renderDiv();renderDivContrib();renderCal();},
 belasting:()=>{renderTaxHero();renderTax();},
 opties:renderOptions, analisten:renderAnalysts, coach:renderCoach,
 rendement:()=>{renderWater();renderContrib();renderReport();renderTx();}, vergelijken:renderBench, nieuws:renderNews, datamodel:renderEnts};
let cur='overzicht';
function show(){let h=location.hash.slice(1);const jump=h==='spreiding';if(jump)h='analyse';cur=VIEWS[h]?h:'overzicht';Object.keys(VIEWS).forEach(k=>{document.getElementById('v-'+k).hidden=k!==cur;});
  $$('.tabs a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')==='#'+cur?'page':'false'));
  Object.keys(charts).forEach(k=>{charts[k].dispose();delete charts[k];});VIEWS[cur]();if(jump)setTimeout(()=>{const el=document.getElementById('spreiding');if(el)el.scrollIntoView({block:'start'});},60);}
window.addEventListener('hashchange',()=>{show();window.scrollTo(0,0);});
$('#homeLink').addEventListener('click',e=>{if(location.hash==='#overzicht'||!location.hash){e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}});
function segBind(id,fn){$(id).addEventListener('click',e=>{const bt=e.target.closest('button');if(!bt)return;$$(id+' button').forEach(x=>x.setAttribute('aria-pressed',x===bt));fn(bt.dataset);});}
segBind('#tmPick',d=>{tmSel=d.v;renderTree();});segBind('#taxPartner',d=>{taxP=+d.v;renderTaxHero();renderTax();});segBind('#bmRange',d=>{bmRange=+d.v;renderBench();});
$('#bmPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){bmSel=bt.dataset.v;renderBench();}});
segBind('#ovMode',d=>{ovMode=d.v;renderValue();});segBind('#ovRange',d=>{ovRange=+d.v;renderValue();});
segBind('#divGran',d=>{divGran=d.v;renderDiv();});segBind('#ccyMode',d=>{ccyMode=d.v;renderSpread();});segBind('#jPick',d=>{jFilter=d.v;renderJournal();});
$('#jClearDemo').onclick=()=>{JOURNAL._noDemo=!JOURNAL._noDemo;saveJ();$('#jClearDemo').textContent=JOURNAL._noDemo?'Toon voorbeeldnotities':'Verberg voorbeeldnotities';renderJournal();renderRules();};
$('#payPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){payU=bt.dataset.v;renderOptions();}});
$('#stratPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){stratSel=bt.dataset.v;$$('#stratPick button').forEach(x=>x.setAttribute('aria-pressed',x===bt));renderOptClosed();}});segBind('#txPick',d=>{txSel=d.v;renderTx();});
$('#axisPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){axisSel=+bt.dataset.k;renderLift();renderChecks();}});
$('#stripPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){stripSel=+bt.dataset.i;renderStrip();}});
$('#newsFilters').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){newsF=bt.dataset.c;renderNews();}});
$('#calPrev').onclick=()=>{const d=new Date(calM);calM=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1);renderCal();};
$('#calNext').onclick=()=>{const d=new Date(calM);calM=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);renderCal();};
$('#csvBtn').onclick=e=>{const btn=e.currentTarget;const done=()=>{btn.textContent='Gekopieerd';setTimeout(()=>btn.textContent='Kopieer als CSV',1600);};
  try{navigator.clipboard.writeText(reportCSV).then(done,()=>{btn.textContent='Kopiëren niet toegestaan';});}catch(_){btn.textContent='Kopiëren niet toegestaan';}};
let rz,wasN=NARROW();window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(NARROW()!==wasN){wasN=NARROW();show();}else Object.values(charts).forEach(c=>c.resize());},150);});
// re-render on theme change so chart colors follow tokens
const rerender=()=>{show();const open=!$('#drawer').hidden;};
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',rerender);}catch(_){}
new MutationObserver(rerender).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
// Eén richtingsteken: een getal met + of − krijgt een pijl (▲/▼) en het teken verdwijnt.
const SIGNRE=/^(\s*)([+−])\s?(?=[€$\d]|CHF|DKK)/;
function signArrows(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement&&!n.parentElement.closest('svg,script,style,button,.seg,[data-nosign]')&&SIGNRE.test(n.nodeValue)?1:2});
  const ns=[];while(w.nextNode())ns.push(w.currentNode);
  ns.forEach(n=>{const m=n.nodeValue.match(SIGNRE);const el=n.parentElement;if(!el.closest('.up,.down'))el.classList.add(m[2]==='+'?'up':'down');n.nodeValue=n.nodeValue.replace(SIGNRE,'$1');});}
let sgPending=false;new MutationObserver(()=>{if(sgPending)return;sgPending=true;requestAnimationFrame(()=>{sgPending=false;signArrows(document.body);});}).observe(document.body,{childList:true,subtree:true,characterData:false});
renderSource();show();
