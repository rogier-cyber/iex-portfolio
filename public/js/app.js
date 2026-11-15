import {AXES,AXDESC,INS,MARKET,TXIN,FEE,FXFEE,WHT} from "./data/mock-portfolio.js";
/* global echarts */
// Echte marktdata (EODHD via de server) als die er is; anders draait alles op voorbeelddata.
const LIVE=await fetch('/api/market').then(r=>r.ok?r.json():null).then(d=>d&&d.instruments?d:null).catch(()=>null);
/* ============ helpers ============ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nf0=new Intl.NumberFormat('nl-NL',{maximumFractionDigits:0});
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
// mock benchmarks (replaced by real series below when available)
const mockIdx=(seed,beta,noise,first,last)=>{const r=rng(seed);const rs=[0];for(let i=1;i<NW;i++)rs.push(.0014+beta*(mkt[i]-.0016)+noise*gauss(r));return pathFrom(rs,last,first);};
const BENCH={AEX:{name:'AEX',s:null,note:'koersindex'},AMX:{name:'AMX (midkap)',s:mockIdx('amx',.85,.012,520,930),note:'koersindex'},
  MSCIW:{name:'MSCI World (ETF)',s:mockIdx('msciw',.7,.011,47,108),note:'ETF in euro, inclusief dividend'},SPX:{name:'S&P 500 (in euro)',s:mockIdx('spx',.75,.012,2250,6200),note:'koersindex, omgerekend naar euro'},
  SX5E:{name:'Euro Stoxx 50',s:mockIdx('sx5e',.9,.008,3000,5650),note:'koersindex'}};
INS.forEach(x=>{x.fvSrc='Voorbeeldschatting';x.divEvents=null;});
/* ---- real data from EODHD ---- */
function align(series){const pts=(series||[]).map(([d,c])=>[D(d),+c]).filter(p=>p[1]>0).sort((a,b)=>a[0]-b[0]);if(pts.length<20)return null;
  const out=new Array(NW);let j=0,last=pts[0][1];for(let i=0;i<NW;i++){const t=wdate(i)+4*DAY;while(j<pts.length&&pts[j][0]<=t){last=pts[j][1];j++;}out[i]=last;}return out;}
if(LIVE){
  const fx=align(LIVE.fx&&LIVE.fx.prices); if(fx) FX=fx.map(v=>1/v); // EODHD gives USD per EUR
  INS.forEach(x=>{const L=LIVE.instruments[x.t];if(!L)return;const px=align(L.prices);
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
const fxAt=(ccy,i)=>ccy==='USD'?FX[i]:1;

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
  const fx=x.ccy==='USD'?(hist?FX[widx(pay)]:FX[NW-1]):1;const g=q*ps*fx;DIVS.push({t:x.t,pay,exd,q,ps,ccy:x.ccy,gross:g,tax:g*WHT,net:g*(1-WHT),hist,est:!hist&&!x._declared});}
INS.forEach(x=>{if(!x.divEvents)return;
  x.divEvents.forEach(d=>{if(d.pay<START+20*DAY)return;if(d.pay<=TODAY)pushDiv(x,d.exd,d.pay,d.ps,true);else{x._declared=true;pushDiv(x,d.exd,d.pay,d.ps,false);x._declared=false;}});
  // estimate the next 12 months from the last 12, skipping payments that are already declared
  x.divEvents.filter(d=>d.pay>TODAY-365*DAY&&d.pay<=TODAY).forEach(d=>{const pay=d.pay+365*DAY,exd=d.exd+365*DAY;
    if(x.divEvents.some(e=>Math.abs(e.pay-pay)<40*DAY))return;if(pay<=END12)pushDiv(x,exd,pay,d.ps,false);});});
INS.forEach(x=>{if(!x.dps||x.divEvents)return;const w=x.dmw||x.dm.map(()=>1/x.dm.length);
  for(let y=2019;y<=new Date(END12).getUTCFullYear();y++){const dpsY=x.dps*Math.pow(1.055,y-2026);
    x.dm.forEach(([m,day],k)=>{const pay=Date.UTC(y,m-1,day),exd=pay-24*DAY;if(pay<START+20*DAY||pay>END12)return;
      const hist=pay<=TODAY;const q=hist?qtyAt(x.t,exd):pos[x.t].q;if(q<=0)return;
      const ps=dpsY*w[k];const fx=x.ccy==='USD'?(hist?FX[widx(pay)]:FX[NW-1]):1;const g=q*ps*fx;
      DIVS.push({t:x.t,pay,exd,q,ps,ccy:x.ccy,gross:g,tax:g*WHT,net:g*(1-WHT),hist});});}});
DIVS.sort((a,b)=>a.pay-b.pay);
DIVS.filter(v=>v.hist).forEach(v=>{pos[v.t].divG+=v.gross;pos[v.t].divT+=v.tax;TX.push({d:v.pay,ty:'DIV',t:v.t,q:v.q,price:v.ps,ccy:v.ccy,fx:v.ccy==='USD'?FX[widx(v.pay)]:1,amt:v.net,fee:0,tax:v.tax});});
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
const PSCORE=AXES.map((_,k)=>wavg(x=>x.s[k]));

// weekly portfolio series
const SER={v:[],inv:[],cf:[]}; {let inv=0;let ti=0;const q={};INS.forEach(x=>q[x.t]=0);
  const trades=TX.filter(t=>t.ty!=='DIV');
  for(let i=0;i<NW;i++){let cf=0;const wEnd=wdate(i)+6*DAY;
    while(ti<trades.length&&trades[ti].d<=wEnd){const t=trades[ti];if(t.ty==='BUY'){q[t.t]+=t.q;cf+=-t.amt;}else{q[t.t]-=t.q;cf-=t.amt;}ti++;}
    inv+=cf;let v=0;INS.forEach(x=>{if(q[x.t])v+=q[x.t]*x.px[i]*fxAt(x.ccy,i);});
    SER.v.push(v);SER.inv.push(inv);SER.cf.push(cf);} }
SER.ret=[0];SER.idx=[100];for(let i=1;i<NW;i++){const r=SER.v[i-1]>0?(SER.v[i]-SER.cf[i])/SER.v[i-1]-1:0;SER.ret.push(r);SER.idx.push(SER.idx[i-1]*(1+r));}
const AEXR=[0];for(let i=1;i<NW;i++)AEXR.push(AEX[i]/AEX[i-1]-1);

// XIRR
function xirr(flows){let r=.1;for(let k=0;k<80;k++){let f=0,df=0;const t0=flows[0].d;for(const c of flows){const y=(c.d-t0)/(365.25*DAY);f+=c.a/Math.pow(1+r,y);df+=-y*c.a/Math.pow(1+r,y+1);}const nr=r-f/df;if(!isFinite(nr))break;if(Math.abs(nr-r)<1e-8){r=nr;break;}r=nr;}return r;}
const flows=TX.map(t=>({d:t.d,a:t.amt}));flows.push({d:TODAY,a:TOTAL});
const IRR=xirr(flows);

// totals
const SUM=k=>INS.reduce((a,x)=>a+(pos[x.t][k]||0),0);
const T={priceGain:OPEN.reduce((a,x)=>a+x.priceGain,0),fxGain:OPEN.reduce((a,x)=>a+x.fxGain,0),real:SUM('real'),divG:SUM('divG'),divT:SUM('divT'),fees:SUM('fees')};
T.total=T.priceGain+T.fxGain+T.real+T.divG-T.divT-T.fees; T.cost=OPEN.reduce((a,x)=>a+x.cost,0);
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

/* ============ chart infra ============ */
const charts={};
function C(id){if(charts[id]){charts[id].dispose();}const el=document.getElementById(id);const c=echarts.init(el,null,{renderer:'svg'});charts[id]=c;return c;}
function base(){const ink=css('--ink'),ink2=css('--ink-2'),ink3=css('--ink-3'),line=css('--line'),sf=css('--surface');
  return {ink,ink2,ink3,line,sf,acc:css('--accent'),good:css('--good'),bad:css('--bad'),warn:css('--warn'),mkt:css('--mkt'),
    cat:[1,2,3,4,5,6,7,8].map(i=>css('--c'+i)),
    text:{color:ink2,fontFamily:'Inter, system-ui, sans-serif',fontSize:12},
    tip:{backgroundColor:sf,borderColor:line,borderWidth:1,textStyle:{color:ink,fontSize:12.5,fontFamily:'Inter, system-ui, sans-serif'},extraCssText:'box-shadow:0 6px 24px rgba(0,0,0,.14);border-radius:8px;'},
    ax:{axisLine:{lineStyle:{color:line}},axisTick:{show:false},axisLabel:{color:ink3,fontSize:11.5},splitLine:{lineStyle:{color:line,opacity:.7}}}};}
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
const px=(x,v=x.p)=>(x.ccy==='USD'?'$ ':'€ ')+nf2.format(v);
const valPill=x=>{const d=x.disc;return Math.abs(d)<.05?`<span class="pill neu">rond ${FV_L}</span>`:d>0?`<span class="pill good">${pct(d,0)} onder ${FV_L}</span>`:`<span class="pill bad">${pct(-d,0)} boven ${FV_L}</span>`;};

/* ============ OVERZICHT ============ */
function renderHero(){
  $('#heroStats').innerHTML=`<div class="stat"><span class="l">Totale waarde · ${OPEN.length} posities</span><span class="big num">${eur(TOTAL)}</span></div>
   <div class="stat"><span class="l">Vandaag</span><span class="v num ${cls(T.day)}">${eurS(T.day)} <small style="font-size:13px">${pctS(T.day/(TOTAL-T.day),2)}</small></span></div>
   <div class="stat"><span class="l">Totaal resultaat</span><span class="v num ${cls(T.total)}">${eurS(T.total)}</span></div>
   <div class="stat"><span class="l">Rendement per jaar (IRR)</span><span class="v num ${cls(IRR)}">${pct(IRR)}</span></div>`;
  const fwd=DIVS.filter(v=>!v.hist).reduce((a,v)=>a+v.net,0);
  $('#ovKpis').innerHTML=[
   ['Ongerealiseerd koersresultaat',eurS(T.priceGain),pctS(T.priceGain/T.cost)+' op inleg',T.priceGain],
   ['Gerealiseerd resultaat',eurS(T.real),'uit '+TX.filter(t=>t.ty==='SELL').length+' verkopen',T.real],
   ['Ontvangen dividend (netto)',eur(T.divG-T.divT),'na '+eur(T.divT)+' bronbelasting',1],
   ['Valuta-effect',eurS(T.fxGain),'USD-posities',T.fxGain],
   ['Verwacht dividend 12 mnd',eur(fwd),pct(fwd/TOTAL,2)+' netto rendement',1]].map(([l,v,s,c])=>`<div class="kpi"><span>${l}</span><b class="${c<0?'down':''}">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');
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
  radar:{indicator:AXES.map(a=>({name:a,max:6})),radius:big?'68%':'64%',splitNumber:6,shape:'polygon',axisName:{color:b.ink2,fontSize:big?12.5:11.5,fontWeight:600},
    splitLine:{lineStyle:{color:b.line}},splitArea:{areaStyle:{color:['transparent']}},axisLine:{lineStyle:{color:b.line}}},
  series:[{type:'radar',symbol:'circle',symbolSize:big?7:5,data:[
    ...(showMarket?[{name:'AEX',value:MARKET.s,lineStyle:{color:b.mkt,type:'dashed',width:1.5},itemStyle:{color:b.mkt},areaStyle:{opacity:0}}]:[]),
    {name:'Portefeuille',value:PSCORE.map(v=>+v.toFixed(2)),lineStyle:{color:b.acc,width:2},itemStyle:{color:b.acc},areaStyle:{color:hexA(b.acc,.22)}}]}]};}
function renderRadarOv(){const b=base();C('chRadarOv').setOption(radarOpt(b));
  const hi=AXES.map((a,k)=>[a,PSCORE[k]]).sort((x,y)=>y[1]-x[1]);
  $('#kompasLine').innerHTML=`Sterk op <b>${hi[0][0].toLowerCase()}</b> (${nf2.format(hi[0][1])}) en <b>${hi[1][0].toLowerCase()}</b>, het zwakst op <b>${hi[4][0].toLowerCase()}</b> (${nf2.format(hi[4][1])}).`;}
function renderHoldings(){
  $('#tblHoldings').innerHTML=`<thead><tr><th>Positie</th><th class="n">Koers</th><th>Waardering</th><th class="n">Waarde</th><th>Gewicht</th><th class="n">Totaal resultaat</th><th>6 mnd</th></tr></thead><tbody>`+
   OPEN.map(x=>`<tr class="click" data-t="${x.t}" tabindex="0"><td><div class="tk">${glyph(x.s)}<div><b>${x.t}</b><small>${x.n}</small></div></div></td>
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
  const s=[...OPEN].sort((a,b)=>b.s[axisSel]-a.s[axisSel]||b.w-a.w);
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
  let pts=OPEN.map(x=>({x,v:val(x)}));
  const vals=pts.map(p=>p.v).sort((a,b)=>a-b);const q1=vals[Math.floor(vals.length*.25)],q3=vals[Math.floor(vals.length*.75)],lim=q3+3*(q3-q1);
  const hidden=pts.filter(p=>p.v>lim);pts=pts.filter(p=>p.v<=lim);
  const port=wavg(val);
  // simple dodge: sort by value and stack rows when bubbles collide
  const mx=Math.max(...pts.map(p=>p.v),S.m,port)*1.08,mn=Math.min(0,...pts.map(p=>p.v));
  const placed=[];pts.sort((a,b)=>b.x.w-a.x.w).forEach(p=>{const span=(mx-mn)*.07;let lane=0;const lanes=[0,1,-1,2,-2,3,-3];for(const L of lanes){if(!placed.some(q=>q.lane===L&&Math.abs(q.v-p.v)<span)){lane=L;break;}}p.lane=lane;placed.push(p);});
  const good=p=>S.low?p.v<=S.m:p.v>=S.m;
  C('chStrip').setOption({textStyle:b.text,grid:{left:16,right:24,top:44,bottom:28},
   tooltip:{...b.tip,trigger:'item',formatter:p=>p.data.x?`<b>${p.data.x.t}</b> · ${p.data.x.n}<br>${S.l}: ${S.f(+p.data.value[0].toFixed(2))}<br>Gewicht: ${pct(p.data.x.w)}`:''},
   xAxis:{type:'value',min:mn,max:mx,...b.ax,splitLine:{show:true,lineStyle:{color:b.line,opacity:.6}},axisLabel:{...b.ax.axisLabel,formatter:v=>S.f(+v.toFixed(1))}},
   yAxis:{type:'value',min:-3.6,max:3.6,show:false},
   series:[{type:'scatter',data:pts.map(p=>({value:[p.v,p.lane*.95],x:p.x,symbolSize:14+Math.sqrt(p.x.w)*62,itemStyle:{color:good(p)?b.good:b.bad,borderColor:b.sf,borderWidth:2,opacity:.92},
      label:{show:true,formatter:p.x.t,position:p.x.w>.09?'inside':(p.lane<0?'bottom':'top'),color:p.x.w>.09?'#fff':b.ink2,fontSize:10.5,fontWeight:600}})),
     markLine:{silent:true,symbol:'none',data:[
      {xAxis:S.m,lineStyle:{color:b.mkt,type:'dashed',width:1.5},label:{formatter:'AEX '+S.f(+S.m.toFixed(1)),color:b.ink2,position:'end',fontSize:11.5}},
      {xAxis:+port.toFixed(2),lineStyle:{color:b.acc,width:2,type:'solid'},label:{formatter:'Portefeuille '+S.f(+port.toFixed(1)),color:b.acc,fontWeight:600,position:'start',fontSize:11.5}}]}}]});
  $('#stripNote').textContent=hidden.length?`${hidden.map(p=>p.x.t).join(' en ')} (${hidden.map(p=>S.f(p.v)).join(', ')}) valt ver buiten de rest en is niet getoond. De portefeuillelijn rekent wel mee.`:'';}
function renderSankey(){const b=base();const nodes=[{name:'Portefeuille'}],links=[];const seen=new Set(['Portefeuille']);
  const add=(n,col)=>{if(!seen.has(n)){seen.add(n);nodes.push({name:n,itemStyle:col?{color:col}:undefined});}};
  const bySec={};OPEN.forEach(x=>{(bySec[x.sec]=bySec[x.sec]||[]).push(x);});
  Object.entries(bySec).sort((a,b)=>b[1].reduce((s,x)=>s+x.w,0)-a[1].reduce((s,x)=>s+x.w,0)).forEach(([sec,xs])=>{const col=b.cat[SECCOL[sec]%8];add(sec,col);
    links.push({source:'Portefeuille',target:sec,value:+(xs.reduce((s,x)=>s+x.w,0)*100).toFixed(2)});
    const byInd={};xs.forEach(x=>{(byInd[x.ind]=byInd[x.ind]||[]).push(x);});
    Object.entries(byInd).forEach(([ind,ys])=>{add(ind,col);links.push({source:sec,target:ind,value:+(ys.reduce((s,x)=>s+x.w,0)*100).toFixed(2)});
      ys.forEach(y=>{add(y.t,col);links.push({source:ind,target:y.t,value:+(y.w*100).toFixed(2)});});});});
  nodes[0].itemStyle={color:b.acc};
  C('chSankey').setOption({textStyle:b.text,tooltip:{...b.tip,trigger:'item',formatter:p=>p.dataType==='edge'?`${p.data.source} → ${p.data.target}: ${nf2.format(p.data.value)}%`:`<b>${p.name}</b>`},
   series:[{type:'sankey',left:4,right:150,layoutIterations:0,top:8,bottom:8,nodeWidth:10,nodeGap:9,nodeAlign:'justify',draggable:false,data:nodes,links,
    lineStyle:{color:'source',opacity:.28,curveness:.5},emphasis:{focus:'adjacency'},
    label:{color:b.ink,fontSize:12,formatter:p=>{const v=links.filter(l=>l.target===p.name).reduce((s,l)=>s+l.value,0);return p.name==='Portefeuille'?'':`${p.name}  {m|${nf2.format(v).replace(/,?0+$/,'')}%}`;},rich:{m:{color:b.ink3,fontSize:11}}}}]});}
function donut(id,data){const b=base();C(id).setOption({textStyle:b.text,tooltip:{...b.tip,trigger:'item',formatter:p=>`${p.name}: ${pct(p.value/100)}`},
  legend:{orient:'vertical',right:0,top:'middle',textStyle:{color:b.ink2,fontSize:12},icon:'roundRect',itemWidth:10,itemHeight:10,formatter:n=>`${n}  ${pct(data.find(d=>d.name===n).value/100)}`},
  series:[{type:'pie',radius:['52%','78%'],center:['30%','50%'],padAngle:1.5,itemStyle:{borderRadius:4,borderColor:b.sf,borderWidth:2},label:{show:false},data:data.map((d,i)=>({...d,itemStyle:{color:b.cat[d.ci??i]}}))}]});}
function renderGeo(){const R=['Europa','Noord-Amerika','Azië-Pacific','Overig'];const v=R.map((_,k)=>OPEN.reduce((a,x)=>a+x.w*x.geo[k],0));
  donut('chGeo',R.map((n,k)=>({name:n,value:+v[k].toFixed(1)})));
  const ccy={};OPEN.forEach(x=>ccy[x.ccy]=(ccy[x.ccy]||0)+x.w*100);donut('chCcy',Object.entries(ccy).map(([n,v],i)=>({name:n==='EUR'?'Euro':'Amerikaanse dollar',value:+v.toFixed(1),ci:i===0?0:1})));}
function renderCorr(){const b=base();const xs=[...OPEN].sort((a,b)=>a.sec.localeCompare(b.sec)||b.w-a.w);const n=xs.length;const R=xs.map(x=>x.ret.slice(R0));const data=[];const pairs=[];
  for(let i=0;i<n;i++)for(let j=0;j<i;j++){const c=corr(R[i],R[j]);data.push([j,i,+c.toFixed(2)]);pairs.push([xs[i].t,xs[j].t,c]);}
  C('chCorr').setOption({textStyle:b.text,grid:{left:8,right:8,top:8,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'item',formatter:p=>`<b>${xs[p.value[1]].t} / ${xs[p.value[0]].t}</b><br>Correlatie: ${nf2.format(p.value[2])}`},
   xAxis:{type:'category',data:xs.map(x=>x.t),max:n-2,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,rotate:45,interval:0}},
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
function renderVal(){const fvTot=OPEN.reduce((a,x)=>a+x.q*x.fv*x.fxNow,0);const under=OPEN.filter(x=>x.disc>0);
  $('#valHero').innerHTML=`<div class="stat"><span class="l">Waarde portefeuille</span><span class="big num">${eur(TOTAL)}</span></div>
   <div class="stat"><span class="l">${LIVE?"Koersdoel analisten, gewogen":"Geschatte reële waarde"}</span><span class="v num">${eur(fvTot)}</span></div>
   <div class="stat"><span class="l">Verschil</span><span class="v num ${cls(fvTot-TOTAL)}">${pctS((fvTot-TOTAL)/fvTot)} ${fvTot>TOTAL?'onder':'boven'} ${FV_L}</span></div>`;
  $('#valKpis').innerHTML=[
   ['Deel ondergewaardeerd',pct(under.reduce((a,x)=>a+x.w,0),0),under.length+' posities','up'],
   ['Deel overgewaardeerd',pct(1-under.reduce((a,x)=>a+x.w,0),0),(OPEN.length-under.length)+' posities','down'],
   ['Gewogen opwaarts potentieel',eurS(fvTot-TOTAL),'als alle posities naar '+FV_L+' gaan',''],
   ['Gewogen koers/winst',nf2.format(wavg(x=>x.pe))+'x','AEX '+nf2.format(MARKET.pe)+'x','']].map(([l,v,s,c])=>`<div class="kpi"><span>${l}</span><b class="${c}">${v}</b><small style="color:var(--ink-3)">${s}</small></div>`).join('');
  const b=base();const xs=[...OPEN].sort((a,b)=>b.disc-a.disc);
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
function renderWater(){const b=base();const steps=[['Koers',T.priceGain],['Valuta',T.fxGain],['Gerealiseerd',T.real],['Dividend bruto',T.divG],['Bronbelasting',-T.divT],['Kosten',-T.fees]];
  let run=0;const baseA=[],pos_=[],neg=[];steps.forEach(([_,v])=>{if(v>=0){baseA.push(run);pos_.push(+v.toFixed(0));neg.push('-');run+=v;}else{run+=v;baseA.push(run);pos_.push('-');neg.push(+(-v).toFixed(0));}});
  const cats=[...steps.map(s=>s[0]),'Totaal'];baseA.push(0);pos_.push('-');neg.push('-');const tot=cats.map((_,i)=>i===cats.length-1?+T.total.toFixed(0):'-');
  const vals=[...steps.map(s=>s[1]),T.total];
  C('chWater').setOption({textStyle:b.text,grid:{left:8,right:8,top:28,bottom:8,containLabel:true},tooltip:{...b.tip,trigger:'axis',axisPointer:{type:'shadow',shadowStyle:{color:hexA(b.ink3,.08)}},formatter:p=>`<b>${p[0].name}</b>: ${eurS(vals[p[0].dataIndex])}`},
   xAxis:{type:'category',data:cats,...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:0,color:b.ink2}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>'€ '+nf0.format(v/1000)+'k'}},
   series:[{type:'bar',stack:'w',data:baseA,itemStyle:{color:'transparent'},emphasis:{disabled:true},silent:true},
    {type:'bar',stack:'w',data:pos_,barWidth:'56%',itemStyle:{color:b.good,borderRadius:3},label:{show:true,position:'top',color:b.ink2,fontSize:11.5,formatter:p=>eurS(p.value)}},
    {type:'bar',stack:'w',data:neg,itemStyle:{color:b.bad,borderRadius:3},label:{show:true,position:'bottom',color:b.ink2,fontSize:11.5,formatter:p=>eur(-p.value)}},
    {type:'bar',stack:'w',data:tot,itemStyle:{color:b.acc,borderRadius:3},label:{show:true,position:'top',color:b.ink,fontWeight:600,fontSize:12,formatter:p=>eurS(p.value)}}]});
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
function renderTx(){const L={BUY:'Koop',SELL:'Verkoop',DIV:'Dividend'};const xs=TX.filter(t=>txSel==='ALL'||t.ty===txSel).slice().reverse();
  $('#txCount').textContent=`${xs.length} transacties sinds 7 januari 2019. Koopkosten: € ${nf2.format(FEE)} per order plus ${nf2.format(FXFEE*100)}% valutakosten op dollars.`;
  $('#tblTx').innerHTML=`<thead><tr><th>Datum</th><th>Soort</th><th>Positie</th><th class="n">Aantal</th><th class="n">Prijs</th><th class="n">Bedrag (EUR)</th></tr></thead><tbody>`+
   xs.map(t=>`<tr><td class="num">${fdate(t.d)}</td><td><span class="pill ${t.ty==='SELL'?'bad':t.ty==='BUY'?'neu':'good'}">${L[t.ty]}</span></td><td><b>${t.t}</b> <span style="color:var(--ink-3)">${BY[t.t].n}</span></td><td class="n num">${nf0.format(t.q)}</td><td class="n num">${(t.ccy==='USD'?'$ ':'€ ')+nf2.format(t.price)}</td><td class="n num ${cls(t.amt)}">${eurS(t.amt,2)}${t.tax?`<span class="sub2">na ${eur(t.tax,2)} belasting</span>`:''}</td></tr>`).join('')+'</tbody>';}

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
  OPEN.filter(x=>x.w>.1).forEach(x=>add(3,'bad',`${x.t} is ${pct(x.w)} van je portefeuille`,'Boven 10% maakt één tegenvaller voelbaar'));
  const secW={};OPEN.forEach(x=>secW[x.sec]=(secW[x.sec]||0)+x.w);Object.entries(secW).filter(([,w])=>w>.3).forEach(([s,w])=>add(3,'bad',`${s} weegt ${pct(w)}`,'Meer dan 30% in één sector'));
  OPEN.filter(x=>x.disc>.15).sort((a,b)=>b.disc-a.disc).slice(0,2).forEach(x=>add(4,'good',`${x.t} noteert ${pct(x.disc,0)} onder ${FV_L}`,`Koers ${px(x)}, ${FV_L} ${px(x,x.fv)}`));
  OPEN.filter(x=>x.disc<-.1).forEach(x=>add(4,'bad',`${x.t} staat ${pct(-x.disc,0)} boven ${FV_L}`,`Koers ${px(x)}, ${FV_L} ${px(x,x.fv)}`));
  OPEN.forEach(x=>{const hi=Math.max(...x.px.slice(NW-52));const dd=x.p/hi-1;if(dd<-.25)add(5,'bad',`${x.t} staat ${pct(-dd,0)} onder de top van dit jaar`,`Jaarhoog ${px(x,hi)}`);});
  const best=[...OPEN].sort((a,b)=>chg(b,52)-chg(a,52));add(6,'good',`Beste positie dit jaar: ${best[0].t} ${pctS(chg(best[0],52))}`,`Zwakste: ${best.at(-1).t} ${pctS(chg(best.at(-1),52))}`);
  out.sort((a,b)=>a.k-b.k);
  $('#signals').innerHTML=out.slice(0,8).map(o=>`<div class="sig"><span class="ic ${o.ic}">${o.ic==='good'?'↑':o.ic==='bad'?'!':'i'}</span><div>${o.t}<small>${o.s}</small></div></div>`).join('')||'<p class="note">Geen bijzonderheden.</p>';}

/* ============ SCORE-CHECKS ============ */
function renderChecks(){const xs=[...OPEN].sort((a,b)=>b.s[axisSel]-a.s[axisSel]||b.w-a.w);const labels=OPEN[0].checks[axisSel].map(c=>c[0]);
  $('#tblChecks').innerHTML=`<thead><tr><th>Positie</th>${labels.map((l,i)=>`<th title="${l}" style="white-space:normal;min-width:84px;max-width:130px;text-transform:none;letter-spacing:0;font-size:11.5px;line-height:1.3">${l}</th>`).join('')}<th class="n">Score</th></tr></thead><tbody>`+
   xs.map(x=>`<tr><td><b>${x.t}</b></td>${x.checks[axisSel].map(c=>`<td><span class="dot ${c[1]?'y':'n'}" title="${x.t}: ${c[0]}: ${c[1]?'ja':'nee'}" aria-label="${c[1]?'ja':'nee'}"></span></td>`).join('')}<td class="n num"><b>${x.s[axisSel]}</b>/6</td></tr>`).join('')+'</tbody>';}

/* ============ BELASTING ============ */
let taxP=1;
function renderTax(){const cy=new Date(TODAY).getUTCFullYear();const j1=widx(Date.UTC(cy,0,1));const v0=SER.v[j1];
  const free=57684*taxP, forfait=.0588, rate=.36;const base_=Math.max(0,v0-free);const tax=base_*forfait*rate;
  let cf=0;for(let i=j1+1;i<NW;i++)cf+=SER.cf[i];const divY=DIVS.filter(v=>v.hist&&new Date(v.pay).getUTCFullYear()===cy).reduce((a,v)=>a+v.net,0);
  const actual=SER.v[NW-1]-v0-cf+divY-TX.filter(t=>t.d>=Date.UTC(cy,0,1)).reduce((a,t)=>a+(t.fee||0),0);
  const fictive=v0*forfait;
  $('#tblBox3').innerHTML='<tbody>'+[['Waarde op 1 januari '+cy,eur(v0)],['Heffingsvrij vermogen'+(taxP>1?' (2 personen)':''),'−'+eur(free).replace('−','')],['Grondslag',eur(base_)],['Forfaitair rendement (5,88%)',eur(base_*forfait)],['Box 3-belasting (36%)',`<b>${eur(tax)}</b>`],
   ['Werkelijk rendement dit jaar',`<span class="${cls(actual)}">${eurS(actual)} (${pctS(actual/v0)})</span>`],['Tegenbewijs gunstig?',actual<fictive?'<span class="pill good">Ja, werkelijk lager dan forfait</span>':'<span class="pill neu">Nee</span>']].map(([a,b])=>`<tr><td>${a}</td><td class="n num">${b}</td></tr>`).join('')+'</tbody>';
  $('#box3Note').textContent='Tarieven 2025 als indicatie, alleen deze portefeuille, zonder schulden of andere bezittingen. Werkelijk rendement = koersverschil plus netto dividend, min kosten.';
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
   xAxis:{type:'category',data:years.map(y=>y===cy?y+' t/m nu':String(y)),...b.ax,splitLine:{show:false},axisLabel:{...b.ax.axisLabel,interval:0}},yAxis:{type:'value',...b.ax,axisLabel:{...b.ax.axisLabel,formatter:v=>v+'%'}},
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
document.addEventListener('keydown',e=>{if(e.key==='Enter'){const tr=e.target.closest&&e.target.closest('tr.click');if(tr)openDrawer(tr.dataset.t);}});

/* ============ routing & controls ============ */
const VIEWS={overzicht:()=>{renderHero();renderValue();renderRadarOv();renderTree();renderSignals();renderHoldings();},
 analyse:()=>{renderRadar();renderLift();renderChecks();renderStrip();renderSankey();renderGeo();renderCorr();renderRisk();},
 waardering:renderVal, dividend:()=>{renderDivHero();renderDiv();renderDivContrib();renderTax();renderCal();},
 rendement:()=>{renderWater();renderContrib();renderReport();renderTx();}, vergelijken:renderBench, nieuws:renderNews, datamodel:renderEnts};
let cur='overzicht';
function show(){const h=location.hash.slice(1);cur=VIEWS[h]?h:'overzicht';Object.keys(VIEWS).forEach(k=>{document.getElementById('v-'+k).hidden=k!==cur;});
  $$('.tabs a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')==='#'+cur?'page':'false'));
  Object.keys(charts).forEach(k=>{charts[k].dispose();delete charts[k];});VIEWS[cur]();}
window.addEventListener('hashchange',()=>{show();window.scrollTo(0,0);});
function segBind(id,fn){$(id).addEventListener('click',e=>{const bt=e.target.closest('button');if(!bt)return;$$(id+' button').forEach(x=>x.setAttribute('aria-pressed',x===bt));fn(bt.dataset);});}
segBind('#tmPick',d=>{tmSel=d.v;renderTree();});segBind('#taxPartner',d=>{taxP=+d.v;renderTax();});segBind('#bmRange',d=>{bmRange=+d.v;renderBench();});
$('#bmPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){bmSel=bt.dataset.v;renderBench();}});
segBind('#ovMode',d=>{ovMode=d.v;renderValue();});segBind('#ovRange',d=>{ovRange=+d.v;renderValue();});
segBind('#divGran',d=>{divGran=d.v;renderDiv();});segBind('#txPick',d=>{txSel=d.v;renderTx();});
$('#axisPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){axisSel=+bt.dataset.k;renderLift();renderChecks();}});
$('#stripPick').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){stripSel=+bt.dataset.i;renderStrip();}});
$('#newsFilters').addEventListener('click',e=>{const bt=e.target.closest('button');if(bt){newsF=bt.dataset.c;renderNews();}});
$('#calPrev').onclick=()=>{const d=new Date(calM);calM=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1);renderCal();};
$('#calNext').onclick=()=>{const d=new Date(calM);calM=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);renderCal();};
$('#csvBtn').onclick=e=>{const btn=e.currentTarget;const done=()=>{btn.textContent='Gekopieerd';setTimeout(()=>btn.textContent='Kopieer als CSV',1600);};
  try{navigator.clipboard.writeText(reportCSV).then(done,()=>{btn.textContent='Kopiëren niet toegestaan';});}catch(_){btn.textContent='Kopiëren niet toegestaan';}};
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),120);});
// re-render on theme change so chart colors follow tokens
const rerender=()=>{show();const open=!$('#drawer').hidden;};
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',rerender);}catch(_){}
new MutationObserver(rerender).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
renderSource();show();
