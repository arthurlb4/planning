// app_calc.js v4.08

function getActiveCycleGrid(date){
  if(!_globalCycles.length)return null;
  const key=dk(date instanceof Date?date:new Date(date+'T12:00:00'));
  const sorted=[..._globalCycles].filter(function(c){return c.weeks&&c.weeks.length>0;}).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
  let active=null;
  sorted.forEach(function(c){
    if(c.startDate<=key&&(!c.endDate||c.endDate>=key))active=c;
  });
  return active?active.weeks:null;
}
function getActiveCycleAnchor(date){
  if(!_globalCycles.length)return null;
  const key=dk(date instanceof Date?date:new Date(date+'T12:00:00'));
  const sorted=[..._globalCycles].filter(function(c){return c.weeks&&c.weeks.length>0;}).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
  let active=null;
  sorted.forEach(function(c){if(c.startDate<=key&&(!c.endDate||c.endDate>=key))active=c;});
  return active?active.startDate:null;
}
function getCycleLen(date){
  const grid=getActiveCycleGrid(date||NOW);
  return grid?grid.length:CYCLE.length;
}
function getVAC(date){
  // If we have cycles with vacations, filter by active cycle at given date
  if(_globalCycles.length&&date){
    const key=dk(date instanceof Date?date:new Date(date+'T12:00:00'));
    // Find active cycle at this date (most recent startDate <= key)
    const sorted=[..._globalCycles].sort(function(a,b){return a.startDate<b.startDate?-1:1;});
    let activeCycle=null;
    sorted.forEach(function(c){if(c.startDate<=key)activeCycle=c;});
    if(activeCycle){
      // Build VAC from vacations belonging to this cycle
      const cycVacs={};
      Object.entries(_globalVacs).forEach(function([name,v]){
        if(!v.cycleIds||!v.cycleIds.length||v.cycleIds.includes(activeCycle.id)){
          cycVacs[name]=v;
        }
      });
      return{...VAC_STD,...cycVacs,...(S.customVacs||{})};
    }
  }
  return{...VAC_STD,..._globalVacs,...(S.customVacs||{})};
}
function lineIdx(monday){
  const N=getCycleLen(monday);
  const diff=Math.round((monday-ANCHOR)/(7*864e5));
  const key=dk(monday);
  if(S.profile&&S.profile.lineHistory&&S.profile.lineHistory.length){
    const sorted=[...S.profile.lineHistory].sort(function(a,b){return a.from<b.from?-1:1;});
    let best=null;
    sorted.forEach(function(h){if(h.from<=key)best=h;});
    if(best)return((best.anchorLine+diff)%N+N)%N;
    const origAl=(S.profile.origAnchor!==undefined)?S.profile.origAnchor:((S.profile.anchorLine!==undefined)?S.profile.anchorLine:ANCHOR_L);
    return((origAl+diff)%N+N)%N;
  }
  const al=(S.profile&&S.profile.anchorLine!==undefined)?S.profile.anchorLine:ANCHOR_L;
  return((al+diff)%N+N)%N;
}
function getCycleVac(date){
  const dw=date.getDay(),idx=dw===0?6:dw-1,li=lineIdx(getMonday(date));
  // Use KV cycle grid if available for this date
  const kvGrid=getActiveCycleGrid(date);
  const grid=kvGrid||CYCLE;
  return{cycleVac:grid[li][idx],li};
}
function getVac(date){
  const key=dk(date),{cycleVac,li}=getCycleVac(date),ov=(S.overrides||{})[key];
  if(ov&&ov.absent)return{vac:null,ov:true,absent:true,echange:false,ecSelf:false,fromSV:false,li,cycleVac};
  if(ov&&ov.echange===true){
    // Échange override: ecSelf=true means I work here, ecSelf=false means I give away
    var evac=ov.vac||cycleVac;
    return{vac:evac,ov:true,fromSV:!!ov.fromSV,absent:false,echange:true,ecSelf:!!ov.ecSelf,li,cycleVac};
  }
  if(ov&&(ov.vac||ov.fromSV))return{vac:ov.vac||null,ov:true,fromSV:!!ov.fromSV,absent:false,echange:false,ecSelf:false,li,cycleVac};
  return{vac:cycleVac,ov:false,fromSV:false,absent:false,echange:false,ecSelf:false,li,cycleVac};
}
function getDur(date){const{vac}=getVac(date);const VAC=getVAC();return(vac&&vac!=='RH'&&VAC[vac])?VAC[vac].dur:0;}
function isPanier(date){const{vac}=getVac(date);const VAC=getVAC();return!!(vac&&vac!=='RH'&&VAC[vac]&&VAC[vac].panier);}
function isRHDay(date){return getCycleVac(date).cycleVac==='RH';}

function renduFactor(date){
  const key=dk(date),isFer=FERIES.has(key),isDim=date.getDay()===0,isRH=isRHDay(date);
  const sett=settingsForYM(date.getFullYear()*12+date.getMonth());
  let f=0;
  if(isFer&&sett.ferRendu)f+=2.0;
  // Dim et RH ne se cumulent pas entre eux, mais cumulent avec férié
  if(isDim&&sett.dimRendu)f+=0.5;
  else if(isRH&&sett.rhRendu)f+=0.5;
  return f;
}
function hsRenduFromSurplus(surplus){
  const hs1=Math.min(surplus,8*60),hs2=Math.max(0,surplus-8*60);
  return hs1*1.25+hs2*1.5;
}
function calcHSWeek(monday){
  const li=lineIdx(monday),weekBase=WEEK_DUR[li],VAC=getVAC();let weekWorked=0;
  for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=dk(d);const{vac,absent,echange,ecSelf,cycleVac}=getVac(d);if(absent)continue;const _cg=(S.conges||{})[key];if(_cg&&_cg!=='rend'&&_cg!=='cg')continue;
    if(echange){
      const _ecOv=(S.overrides||{})[key];
      const _hsFlag=_ecOv&&_ecOv.hs;
      if(_hsFlag){
        // Échange avec HS: jour pris = durée réelle, jour donné = 0 (soustraction implicite via weekBase)
        if(ecSelf&&vac&&vac!=='RH')weekWorked+=VAC[vac]?VAC[vac].dur:0;
        // ecSelf=false: contribue 0 → le weekBase comptait ce jour mais on ne le travaille plus
      } else {
        // Échange sans HS: différentiel = 0, valoriser au cycle original des deux côtés
        if(cycleVac&&cycleVac!=='RH')weekWorked+=VAC[cycleVac]?VAC[cycleVac].dur:0;
      }
    }else{
      if(!vac||vac==='RH')continue;
      const _ov=(S.overrides||{})[key];
      // Si override sans HS: compter durée cycle (pas la nouvelle vacation)
      if(_ov&&_ov.vac&&!_ov.echange&&!_ov.hs){
        // Pas de HS: valoriser au cycle original
        weekWorked+=cycleVac&&cycleVac!=='RH'&&VAC[cycleVac]?VAC[cycleVac].dur:0;
      } else {
        weekWorked+=VAC[vac]?VAC[vac].dur:0;
      }
    }
  }
  const isRam=isSemaineRamenée(monday);
  // Ramenée = 7h fixes + surplus normal éventuel (ex: vacation plus longue avec HS)
  if(isRam){
    const ramMin=7*60;
    const normalSurplus=Math.max(0,weekWorked-weekBase);
    const surplusTotal=ramMin+normalSurplus;
    const rendusTotal=hsRenduFromSurplus(surplusTotal);
    const rendusPure=hsRenduFromSurplus(normalSurplus);
    const rendusRam=rendusTotal-rendusPure;
    const rawLow=Math.min(surplusTotal,480);
    const rawHigh=Math.max(0,surplusTotal-480);
    return{surplus:surplusTotal,weekBase,weekWorked:weekBase+surplusTotal,
      rendusMin:rendusTotal,rendusH:Math.round(rendusTotal/60*100)/100,
      rendusMinHS:rendusPure,rendusMinRam:rendusRam,isRam,rawLow,rawHigh};
  }
  const surplusTotal=Math.max(0,weekWorked-weekBase);
  const surplusPure=Math.max(0,weekWorked-weekBase);
  const rendusTotal=hsRenduFromSurplus(surplusTotal);
  const rendusPure=hsRenduFromSurplus(surplusPure);
  const rendusRam=rendusTotal-rendusPure;
  // Raw brackets (no rate applied)
  const rawLow=Math.min(surplusTotal,480);
  const rawHigh=Math.max(0,surplusTotal-480);
  return{surplus:surplusTotal,weekBase,weekWorked:weekWorked,
    rendusMin:rendusTotal,rendusH:Math.round(rendusTotal/60*100)/100,
    rendusMinHS:rendusPure,rendusMinRam:rendusRam,isRam,rawLow,rawHigh};
}
function isSemaineRamenée(monday){
  let hasFérié=false,hasWork=false,allCG=true,hasAbsent=false;
  for(let i=0;i<6;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=dk(d),{vac,absent,echange,ecSelf}=getVac(d);if(FERIES.has(key))hasFérié=true;if(absent)hasAbsent=true;const isGivenAway=echange&&!ecSelf;if(vac&&vac!=='RH'&&!absent&&!isGivenAway){hasWork=true;if((S.conges||{})[key]!=='cg')allCG=false;}}
  // Semaine ramenée si: contient un férié, a des jours travaillés, pas tous en congés, et pas d'absent
  return hasFérié&&hasWork&&!allCG&&!hasAbsent;
}
function isWeekFullCG(monday){
  for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=dk(d),{vac,absent}=getVac(d);if(vac&&vac!=='RH'&&!absent&&!FERIES.has(key)&&(S.conges||{})[key]!=='cg')return false;}
  return true;
}
function settingsForYM(ym){
  const ss=S.settings||{};
  const base={dimRendu:ss.dimRendu!==false,rhRendu:ss.rhRendu!==false,ferRendu:ss.ferRendu!==false,hsRendu:ss.hsRendu!==false};
  if(!ss.settingsHistory||!ss.settingsHistory.length)return base;
  let active=null;
  for(const h of ss.settingsHistory){
    const hym=parseInt(h.since.split('-')[0])*12+(parseInt(h.since.split('-')[1])-1);
    if(hym<=ym)active=h;
  }
  if(!active)return base;
  return{dimRendu:active.dimRendu!==false,rhRendu:active.rhRendu!==false,ferRendu:active.ferRendu!==false,hsRendu:active.hsRendu!==false};
}

// ================================================================
// HELPERS EXPIRATION
function getEphExtensions(ym){
  if(!S.ephExtend)return 0;
  const v=S.ephExtend[ym];
  if(v===true)return 1;
  return typeof v==='number'?v:0;
}
function getExpYm(ym){return ym+3+getEphExtensions(ym)*3;}

// BUILD GEN
// ================================================================
function buildGen(){
  const gen={};function add(ym,k,v){if(!gen[ym])gen[ym]={dim:0,rh:0,fer:0,hs:0,ram:0,solde:0};gen[ym][k]+=v;}
  const START=2026*12,maxYM=CUR_YEAR*12+11,maxYMDisplay=(CUR_YEAR+2)*12+11,VAC=getVAC();
  const createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:START;
  const solde=(S.profile&&S.profile.ephSolde)||0;
  if(solde>0)add(createdYM>0?createdYM-1:createdYM,'solde',solde*60);
  for(let y=2025;y<=2030;y++)for(let m=0;m<12;m++){
    const ym=y*12+m;if(ym<createdYM||ym>TODAY_YM&&ym>maxYMDisplay)continue;
    const last=new Date(y,m+1,0).getDate();
    for(let d=1;d<=last;d++){const date=new Date(y,m,d),key=dk(date);const v2e=getVac(date);const{vac,absent,echange,ecSelf}=v2e;if(!vac||vac==='RH'||absent)continue;if(echange&&!ecSelf)continue;// ec2: I give away, no rendu for me
const cKey=(S.conges||{})[key];if(cKey==='rend')continue;// rendu posé: no dim/fer rendu (still counted for HS)
const dur=VAC[vac]?VAC[vac].dur:0;
      const isFer2=FERIES.has(key),isDim2=date.getDay()===0,isRH2=isRHDay(date);
      const sett2b=settingsForYM(ym);
      const ferF=isFer2&&sett2b.ferRendu?2.0:0;
      // Échange ecSelf=true: férié et dimanche comptent, pas RH
      const dimF=(isDim2&&sett2b.dimRendu)?0.5:0;
      const rhF=(!echange&&!isDim2&&isRH2&&sett2b.rhRendu)?0.5:0;
      const totF=ferF+dimF+rhF;
      if(totF===0)continue;
      if(ferF>0)add(ym,'fer',Math.round(dur*ferF/60*100)/100*60);
      if(dimF>0)add(ym,'dim',Math.round(dur*dimF/60*100)/100*60);
      if(rhF>0)add(ym,'rh',Math.round(dur*rhF/60*100)/100*60);}
  }
  const seenHS=new Set();
  for(let y=2025;y<=2030;y++)for(let m=0;m<12;m++){
    const ym=y*12+m;if(ym<createdYM||ym>TODAY_YM&&ym>maxYM)continue;
    const last=new Date(y,m+1,0).getDate();
    for(let d=1;d<=last;d++){const date=new Date(y,m,d),mon=getMonday(date),mk2=dk(mon);if(seenHS.has(mk2))continue;seenHS.add(mk2);const mym=mon.getFullYear()*12+mon.getMonth();
      // Compute ferYm early — for ramenée weeks the ferie might be in the next month
      let ferYm=mym;
      for(let fi=0;fi<7;fi++){const fd2=new Date(mon);fd2.setDate(mon.getDate()+fi);if(FERIES.has(dk(fd2))){ferYm=fd2.getFullYear()*12+fd2.getMonth();break;}}
      // Skip if neither the week's month nor the ferie month is in scope
      const weekInScope=mym>=createdYM&&(mym<=TODAY_YM||mym<=maxYM);
      const ferInScope=ferYm>=createdYM&&(ferYm<=TODAY_YM||ferYm<=maxYM);
      if(!weekInScope&&!ferInScope)continue;
      const sett=settingsForYM(weekInScope?mym:ferYm);if(!sett.hsRendu)continue;
      const hsW=calcHSWeek(mon);if(hsW.rendusMin>0){
        if(hsW.rendusMinHS>0&&weekInScope)add(mym,'hs',hsW.rendusMinHS);
        if(hsW.rendusMinRam>0&&ferInScope)add(ferYm,'ram',hsW.rendusMinRam);
      }}
  }
  // Semaine ramenée: les 7h sont déjà intégrées dans calcHSWeek ci-dessus
  return gen;
}

function calcSoldes(){
  const gen=buildGen(),createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  const realEph={},prevEph={};
  for(let ym=createdYM;ym<=TODAY_YM;ym++)realEph[ym]=0;
  Object.keys(gen).forEach(ymStr=>{const ym=Number(ymStr),total=Object.values(gen[ym]).reduce((s,v)=>s+v,0),expYm=getExpYm(ym);if(ym>TODAY_YM){prevEph[ym]=total;return;}realEph[ym]=expYm<=TODAY_YM?0:total;});
  // FIFO: deduct all rendus (past AND future) from combined stock (realEph + prevEph)
  {
    const _rendKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').sort();
    // Build combined simulation: realEph + prevEph
    const _sim={};
    Object.keys(realEph).forEach(function(ym){_sim[ym]=realEph[ym];});
    Object.keys(prevEph).forEach(function(ym){_sim[ym]=(_sim[ym]||0)+prevEph[ym];});
    _rendKeys.forEach(function(k){
      const _d=new Date(k+'T12:00:00'),_poseYm=_d.getFullYear()*12+_d.getMonth(),_dur=getDur(_d);
      let _left=_dur;
      const _yms=Object.keys(_sim).map(Number).sort();
      for(const _ym of _yms){
        if(_sim[_ym]<=0||getExpYm(_ym)<_poseYm)continue;
        const _take=Math.min(_sim[_ym],_left);_sim[_ym]-=_take;_left-=_take;
        if(_left<=0)break;
      }
    });
    // Write back deductions to realEph and prevEph
    Object.keys(realEph).forEach(function(ym){realEph[ym]=Math.max(0,_sim[ym]||0);});
    Object.keys(prevEph).forEach(function(ym){prevEph[ym]=Math.max(0,(_sim[ym]||0));});
  }
  let toDeduct=0;
  const realAvail={};Object.keys(realEph).map(Number).sort().forEach(ym=>realAvail[ym]=realEph[ym]);
  for(const ym of Object.keys(realAvail).map(Number).sort()){if(toDeduct<=0)break;const take=Math.min(realAvail[ym],toDeduct);realAvail[ym]-=take;toDeduct-=take;}
  let matelas=(S.profile&&S.profile.matelas)||0;if(toDeduct>0)matelas-=toDeduct;
  return{gen,realEph,realAvail,prevEph,matelas,totalReal:Object.values(realAvail).reduce((s,v)=>s+v,0),totalPrev:Object.keys(prevEph).map(Number).filter(ym=>ym<=CUR_YEAR*12+11).reduce((s,ym)=>s+(prevEph[ym]||0),0)};
}

function calcCongesUsed(){
  const cgKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').sort();
  if(!cgKeys.length)return 0;
  const cgSet=new Set(cgKeys);

  // A week counts as 5 CP only if the pose covers from MONDAY
  // (i.e. Monday is either posed or non-worked, AND all worked days are posed)
  function isFullWeekCP(monday){
    // Full week = Monday must be in cgSet (posed)
    // If Mon is SV/RH (not worked), the week cannot be "full" since the pose didn't start Monday
    const monKey=dk(monday);
    if(!cgSet.has(monKey))return false;
    // All worked days in the week must be posed
    for(var i=0;i<7;i++){
      const d=new Date(monday);d.setDate(monday.getDate()+i);
      const k=dk(d);
      const v2=getVac(d);
      const isWorked=v2.vac&&v2.vac!=='RH'&&!v2.absent;
      if(isWorked&&!cgSet.has(k))return false;
    }
    return true;
  }

  // Collect full weeks (count 5 each) and remaining individual days
  const fullWeeks=new Set(); // monday keys of full weeks already counted
  const seenMon=new Set();
  let total=0;

  cgKeys.forEach(function(k){
    const d=new Date(k+'T12:00:00');
    const mon=getMonday(d);
    const mk=dk(mon);
    if(seenMon.has(mk))return;
    seenMon.add(mk);
    if(isFullWeekCP(mon)){
      fullWeeks.add(mk);
      total+=5;
    }
  });

  // For remaining days (not in full weeks): apply ecart rule
  const partialKeys=cgKeys.filter(function(k){
    const d=new Date(k+'T12:00:00');
    return!fullWeeks.has(dk(getMonday(d)));
  });

  if(!partialKeys.length)return total;

  function findReprise(fromDate){
    // Find next worked day - for partial groups, stop at any worked day
    // (full weeks are counted separately, so we don't skip days in cgSet)
    const sd=new Date(fromDate);sd.setDate(sd.getDate()+1);
    while(sd<=new Date('2031-01-01')){
      const v2=getVac(sd);
      if(v2.vac&&v2.vac!=='RH'&&!v2.absent)return new Date(sd);
      sd.setDate(sd.getDate()+1);
    }
    return null;
  }

  const groups={};
  partialKeys.forEach(function(k){
    const d=new Date(k+'T12:00:00');
    const r=findReprise(d);
    const rk=r?dk(r):'none';
    if(!groups[rk])groups[rk]={reprise:r,dates:[]};
    groups[rk].dates.push(d);
  });

  Object.values(groups).forEach(function(g){
    const nb=g.dates.length;
    if(!g.reprise){total+=nb;return;}
    const lastCp=new Date(Math.max.apply(null,g.dates));
    const ecart=Math.round((g.reprise-lastCp)/(864e5))-1;
    total+=nb+Math.max(0,ecart-2);
  });

  return total;
}

function getState(date){
  const key=dk(date),v2=getVac(date),{vac,fromSV,absent,echange,ecSelf}=v2;
  if(absent)return'absent';
  const c=(S.conges||{})[key];
  // Échange: ec=orange (I work it), ec2=grey (colleague covers)
  if(echange){
    if(!ecSelf)return FERIES.has(key)?'ec2-fer':'ec2'; // grey - colleague works this
    // ecSelf: I work the new vacation
    if(FERIES.has(key))return'ec-fer';
    return'ec';
  }
  if(FERIES.has(key)){
    if(c==='cg')return'cg-fer';
    if(c==='rend')return'rend-fer';
    if(absent)return'absent-fer';
    if(!ecSelf&&echange)return'ec2-fer';
    if(vac&&vac!=='RH')return fromSV?'sv-vac-fer':'tv-fer';
    return'fer';
  }
  if(!vac){
    // SV override (explicitly set to SV) vs natural SV
    const _ovr=(S.overrides||{})[key];
    return(_ovr&&_ovr.fromSV&&!_ovr.echange)?'sv-ov':'sv';
  }
  if(vac==='RH')return'rh';
  if(c==='cg')return'cg';if(c==='rend')return'rend';
  return fromSV?'sv-vac':'tv';
}
function buildRameeSet(y,m){
  const set=new Set(),seen=new Set(),last=new Date(y,m+1,0).getDate();
  for(let d=1;d<=last;d++){const date=new Date(y,m,d),mon=getMonday(date),mk=dk(mon);if(seen.has(mk))continue;seen.add(mk);if(isSemaineRamenée(mon)){for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);set.add(dk(dd));}}}
  return set;
}

// ================================================================
// THEME
// ================================================================
function applyTheme(t){
  t=t||(S&&S.settings&&S.settings.theme)||document.documentElement.getAttribute('data-theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  if(t==='light'){
    document.documentElement.style.backgroundColor='#e8e8e4';
    document.body.style.backgroundColor='#e8e8e4';
  } else {
    document.documentElement.style.backgroundColor='#18181b';
    document.body.style.backgroundColor='#18181b';
  }

  setTimeout(syncWknHeight,50);
  const _meta=document.getElementById('theme-color-meta');if(_meta)_meta.content=t==='dark'?'#18181b':'#fff';
  const icon=document.getElementById('theme-icon');
  if(icon)icon.className=t==='dark'?'ti ti-moon':'ti ti-sun';
}
function updateWarnIcon(warnKeys){
  const wrap=document.getElementById('warn-icon-wrap');
  if(!wrap)return;
  if(!warnKeys||warnKeys.size===0){
    wrap.style.display='none';
    const dd=document.getElementById('warn-dropdown');if(dd)dd.style.display='none';
    return;
  }
  wrap.style.display='inline-flex';
  const list=document.getElementById('warn-dates-list');
  if(list){
    const ML=['jan','\u00e9fv','mar','avr','mai','jun','jul','ao\u00fb','sep','oct','nov','d\u00e9c'];
    list.innerHTML=[...warnKeys].sort().map(function(k){
      const d=new Date(k+'T12:00:00');
      return '<div style="padding:2px 0;border-bottom:0.5px solid var(--border2)">'+d.getDate()+' '+ML[d.getMonth()]+' '+d.getFullYear()+'</div>';
    }).join('');
  }
}
function toggleWarnDropdown(){
  const dd=document.getElementById('warn-dropdown');
  if(!dd)return;
  dd.style.display=dd.style.display==='none'?'block':'none';
  if(dd.style.display==='block'){
    setTimeout(function(){document.addEventListener('click',function _cl(e){if(!document.getElementById('warn-icon-wrap').contains(e.target)){dd.style.display='none';document.removeEventListener('click',_cl);}});},10);
  }
}

function toggleTheme(){
  const t=(S.settings&&S.settings.theme)||'dark',nt=t==='dark'?'light':'dark';
  if(!S.settings)S.settings={};S.settings.theme=nt;_profs[_aid]=S;saveState();applyTheme(nt);
}

// ================================================================
// NAVIGATION
// ================================================================
function goToday(){
  curM=NOW.getMonth();curY=NOW.getFullYear();
  annualOpen=false;
  const aw=document.getElementById('ann-wrap'),mv=document.getElementById('month-view');
  if(aw){aw.classList.remove('open');aw.style.display='none';aw.style.opacity='0';}
  if(mv){mv.style.display='block';mv.style.visibility='visible';mv.style.height='';mv.style.overflow='';mv.style.opacity='1';mv.style.transform='scale(1)';mv.style.transition='';}
  render();
}
function navDir(d){
  if(annualOpen){curY+=d;renderAnnual();document.getElementById('mtit').textContent=String(curY);return;}
  const mv=document.getElementById('month-view');
  if(mv){
    // Slide out
    mv.classList.add(d<0?'slide-right':'slide-left');
    setTimeout(function(){
      mv.classList.remove('slide-left','slide-right');
      mv.style.opacity='0';
      curM+=d;if(curM<0){curM=11;curY--;}if(curM>11){curM=0;curY++;}
      render();
      // Slide in from opposite direction
      mv.classList.add(d<0?'slide-in-right':'slide-in-left');
      setTimeout(function(){mv.classList.remove('slide-in-left','slide-in-right');mv.style.opacity='';},220);
    },180);
  } else {
    curM+=d;if(curM<0){curM=11;curY--;}if(curM>11){curM=0;curY++;}render();
  }
}

// ================================================================
// RENDER
// ================================================================