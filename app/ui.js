// app_ui.js v4.08

function render(){
  applyTheme();
  const _hpn2=document.getElementById('hdr-profile-name');if(_hpn2)_hpn2.textContent=capitalize((S.profile&&S.profile.name)||'Profil');
  const el_ml=document.getElementById('mtit'),el_heads=document.getElementById('heads'),el_cal=document.getElementById('cal');
  if(!el_ml)return;
  if(annualOpen){el_ml.textContent=String(curY);renderAnnual();}
  else{el_ml.textContent=ML[curM]+' '+curY;renderMonth(el_heads,el_cal);}
  updateCounters();renderHistory();

function syncWknHeight(){
  const wkns=document.querySelectorAll('td.wkn');
  wkns.forEach(function(td){
    const tr=td.closest('tr');
    if(!tr)return;
    td.style.height='';
    const h=tr.offsetHeight;
    if(h)td.style.lineHeight=h+'px';
  });
}
requestAnimationFrame(function(){ setTimeout(syncWknHeight, 0); });
}

function renderMonth(el_heads,el_cal){
  el_heads.innerHTML='<th class="wkh"></th>'+['L','M','Me','J','V','S','D'].map(j=>`<th>${j}</th>`).join('');
  const rameeSet=buildRameeSet(curY,curM),first=new Date(curY,curM,1),last=new Date(curY,curM+1,0);
  let sdow=first.getDay();sdow=sdow===0?6:sdow-1;
  // Compute warn keys in one FIFO pass
  const _warnKeys=new Set();
  {
    const _cs2=calcSoldes();
    const _stk={};
    Object.keys(_cs2.realAvail).map(Number).sort().forEach(function(ym){_stk[ym]=_cs2.realAvail[ym];});
    Object.keys(_cs2.prevEph).map(Number).sort().forEach(function(ym){_stk[ym]=(_stk[ym]||0)+(_cs2.prevEph[ym]||0);});
    const _rks=Object.keys(S.conges||{}).filter(function(k){return S.conges[k]==='rend';}).sort();
    _rks.forEach(function(k){
      const _d=new Date(k+'T12:00:00'),_pym=_d.getFullYear()*12+_d.getMonth(),_dur=getDur(_d);
      let _lft=_dur;
      Object.keys(_stk).map(Number).sort().forEach(function(_ym){
        if(_lft<=0||_stk[_ym]<=0||getExpYm(_ym)<_pym)return;
        const _tk=Math.min(_stk[_ym],_lft);_stk[_ym]-=_tk;_lft-=_tk;
      });
      if(_lft>0)_warnKeys.add(k);
    });
  }
  const cells=[];for(let i=0;i<sdow;i++)cells.push(null);
  for(let d=1;d<=last.getDate();d++){
    const date=new Date(curY,curM,d),key=dk(date),st=getState(date),{vac,ov,fromSV,echange}=getVac(date);
    let lbl='';
    if(st==='absent')lbl='abs.';
    else if(st==='sv')lbl=ov?'*':'+';
    else if(st==='rh')lbl='+';
    else if(st==='fer')lbl=(vac&&vac!=='RH')?vac+(echange?'~':'')+(ov&&!fromSV?'*':''):'+';
    else if(vac&&vac!=='RH')lbl=vac+(echange?'~':'')+(ov&&!fromSV?'*':'');
    const panDot=isPanier(date)&&!(S.conges||{})[key]?'<span class="pdot"></span>':'';
    const _inWarn=_warnKeys.has(key);
    const warnDot=_inWarn?'<span class="wdot">⚠️</span>':'';
    const _lbl=_inWarn?'':lbl;
    const _dn=_inWarn?'':d;
    cells.push({d:_dn,date,key,st,lbl:_lbl,panDot,warnDot});
  }
  // Don't add trailing empty cells
  const todayMon=dk(getMonday(NOW));let html='';
  for(let r=0;r<cells.length/7;r++){
    const row=cells.slice(r*7,(r+1)*7),firstReal=row.find(x=>x&&x.date);
    const wn=firstReal?isoWeek(firstReal.date):'';
    const rowMon=firstReal?dk(getMonday(firstReal.date)):'';
    const rowRamee=firstReal&&rameeSet.has(dk(firstReal.date));
    const isCurWeek=rowMon===todayMon;
    const isFullCG=firstReal&&isWeekFullCG(getMonday(firstReal.date));
    // Wkn color: ramenee > plein CG > semaine courante
    const wknCls=rowRamee?'wram':isFullCG?'wcg':isCurWeek?'wcur':'';
    const rowCls=(rowRamee?'':'')+' '+(isCurWeek?'curweek':isFullCG?'cgweek':'');
    html+=`<tr class="${rowCls.trim()}"><td class="wkn ${wknCls}" data-wn="${wn}">${wn}</td>`;
    row.forEach(cell=>{
      if(!cell){html+='<td></td>';return;}
      html+=`<td><div class="dc s-${cell.st}" style="position:relative;">${cell.warnDot}<div class="dci" onclick="openDay('${cell.key}')"><span class="dn">${cell.d}</span><span class="dv">${cell.lbl}</span></div>${cell.panDot}</div></td>`;
    });
    html+='</tr>';
  }
  el_cal.innerHTML=html;
  // Update header warn icon
  updateWarnIcon(_warnKeys);
}

// ================================================================
// ANNUAL VIEW
// ================================================================
function getISOWeek(date){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const dayNum=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-yearStart)/86400000)+1)/7);
}
function toggleAnnual(){
  annualOpen=!annualOpen;
  const aw=document.getElementById('ann-wrap'),mv=document.getElementById('month-view');
  if(annualOpen){
    aw.classList.add('open');
    aw.style.display='';
    aw.style.overflow='visible';
    mv.style.visibility='hidden';mv.style.height='0';mv.style.overflow='hidden';
    aw.style.opacity='0';aw.style.transition='opacity .2s ease';
    requestAnimationFrame(()=>{aw.style.opacity='1';});
  }else{
    aw.style.transition='opacity .12s ease';aw.style.opacity='0';
    setTimeout(()=>{
      aw.classList.remove('open');
      mv.style.visibility='visible';mv.style.height='';mv.style.overflow='';mv.style.opacity='0';mv.style.transition='opacity .2s ease';
      requestAnimationFrame(()=>{mv.style.opacity='1';});
    },130);
  }
  render();
}
function renderAnnual(){
  const el=document.getElementById('ann-grid');if(!el)return;let html='';
  for(let m=0;m<12;m++){
    const isSel=m===curM,first=new Date(curY,m,1),last=new Date(curY,m+1,0);
    let sdow=first.getDay();sdow=sdow===0?6:sdow-1;const rameeSet=buildRameeSet(curY,m);
    let mini='';for(let i=0;i<sdow;i++)mini+=`<div class="ann-day sv"></div>`;
    for(let d=1;d<=last.getDate();d++){const date=new Date(curY,m,d),key=dk(date),st=getState(date),isRam=rameeSet.has(key);mini+=`<div class="ann-day ${st}${isRam?' ram':''}"></div>`;}
    const isCur=curY===NOW.getFullYear()&&m===NOW.getMonth();
    const annCls=isSel&&isCur?'sel cur-month':isSel?'sel':isCur?'cur-month':'';
    html+=`<div class="ann-month${annCls?' '+annCls:''}" onclick="goToMonth(${m})"><div class="ann-mname">${ML[m].slice(0,3)}</div><div class="ann-mini">${mini}</div></div>`;
  }
  el.innerHTML=html;
}
function goToMonth(m){
  curM=m;annualOpen=false;const aw=document.getElementById('ann-wrap'),mv=document.getElementById('month-view');
  aw.classList.remove('open');aw.style.transition='opacity .12s ease';aw.style.opacity='0';
  setTimeout(()=>{aw.style.display='none';mv.style.display='block';mv.style.visibility='visible';mv.style.height='';mv.style.overflow='';mv.style.opacity='0';mv.style.transform='scale(.98)';mv.style.transition='opacity .2s ease,transform .2s ease';requestAnimationFrame(()=>{mv.style.opacity='1';mv.style.transform='scale(1)';});render();},130);
}

// ================================================================
// COUNTERS
// ================================================================
function updateCounters(){
  const{gen,realEph,realAvail,prevEph,matelas,totalReal,totalPrev}=calcSoldes();
  const cRest=Math.max(0,((S.profile&&S.profile.congesInit)||25)-calcCongesUsed());
  // HS for current month (respect toggle and temporal settings)
  const settHS=settingsForYM(curY*12+curM);
  const useHSRendu=settHS.hsRendu;
  let hsTotal=0,hsTotalLow=0,hsTotalHigh=0;
  {const seenHSm=new Set();for(let d=1;d<=new Date(curY,curM+1,0).getDate();d++){const date=new Date(curY,curM,d),mon=getMonday(date),mk=dk(mon);if(seenHSm.has(mk))continue;seenHSm.add(mk);const hsW=calcHSWeek(mon);if(hsW.surplus<=0)continue;
    if(useHSRendu){hsTotal+=hsW.rendusMin;hsTotalLow+=Math.min(hsW.surplus,480)*1.25;hsTotalHigh+=Math.max(0,hsW.surplus-480)*1.5;}
    else{hsTotal+=hsW.rawLow+hsW.rawHigh;hsTotalLow+=hsW.rawLow;hsTotalHigh+=hsW.rawHigh;}
  }}
  const mym=curY*12+curM,gm=gen[mym]||{};const gt=((gm.dim||0)+(gm.rh||0)+(gm.fer||0)+(gm.hs||0)+(gm.ram||0));// excludes solde initial
  const panCount=calcPaniersMois(curY,curM);
  const el=document.getElementById('ctr-main');if(!el)return;
  // Detail dots for "Créés ce mois"
  function detRow(color,val){return val>0?'<div class="ctr-dot-row"><span class="rdot" style="background:'+color+'"></span>'+fmtMin(val)+'</div>':'';}
  const det=detRow('#9c80e0',gm.dim||0)+detRow('#7b9ce0',gm.rh||0)+detRow('var(--gold)',gm.fer||0)+detRow('var(--gold-dark)',gm.ram||0)+detRow('var(--blue)',gm.hs||0)||'<div class="ctr-dot-row" style="color:var(--text3)">-</div>';
  el.innerHTML=`
    <div class="ctr"><div class="clbl">Éphem. dispo</div><div class="cval" style="color:var(--blue)">${fmtMin(totalReal)}</div><div class="csub">priorité</div></div>
    <div class="ctr"><div class="clbl">Matelas</div><div class="cval" style="color:var(--blue)">${fmtMin(Math.max(0,matelas))}</div><div class="csub">permanent</div></div>
    <div class="ctr"><div class="clbl">Congés</div><div class="cval" style="color:var(--green)">${cRest} j</div></div>
    <div class="ctr clk" onclick="openHSModal(${mym})"><div class="clbl">HS ce mois <span style="font-size:8px;opacity:.5">▼</span></div><div class="cval" style="color:var(--blue)">${fmtMin(hsTotal)}</div><div class="csub">${useHSRendu?'rendus':'payés'}</div></div>
    <div class="ctr"><div class="clbl">Paniers</div><div class="cval" style="color:var(--amber)">${panCount}</div><div class="csub">ce mois</div></div>
    <div class="ctr wide clk" onclick="openDetailMois(${mym})"><div class="clbl">Créés ce mois <span style="font-size:8px;opacity:.5">▼</span></div><div class="ctr-wide-inner"><div><div class="cval" style="color:var(--rendu-red-text)">${fmtMin(gt)}</div><div class="csub">${mym>TODAY_YM?'prévis.':'acquis'}</div></div><div class="ctr-detail">${det}</div></div></div>`;

  // Eph list
  const allYms=new Set([...Object.keys(realEph).map(Number),...Object.keys(prevEph).map(Number)]);
  const sorted=[...allYms].sort();
  // Always include next 3 months even if empty
  const futureMonths=[];for(let i=1;i<=3;i++)futureMonths.push(TODAY_YM+i);
  const pastDisplay=[...sorted.filter(ym=>ym<=TODAY_YM).slice(-5)];
  const futureDisplay=[...new Set([...sorted.filter(ym=>ym>TODAY_YM).slice(0,3),...futureMonths])].sort().slice(0,3);
  const display=[...pastDisplay,...futureDisplay];
  const maxV=Math.max(...display.map(ym=>gen[ym]?Object.values(gen[ym]).reduce((s,v)=>s+v,0):0),1);
  let ephHtml='';
    // Show initial solde before first month

  display.forEach(ym=>{
    const y2=Math.floor(ym/12),m2=ym%12,expYm=ym+((S.ephExtend&&S.ephExtend[ym])?6:3),expY=Math.floor(expYm/12),expM=expYm%12;
    const isFut=ym>TODAY_YM,isExp=!isFut&&expYm<=TODAY_YM;
    const orig=gen[ym]?Object.values(gen[ym]).reduce((s,v)=>s+v,0):0;
    // Show created amount (not deducted) — avail is shown in the main counter tile
    const bar=isExp?'#555':isFut?'#6aaaf0':orig===0?'var(--bg3)':'var(--blue)';
    const isExtended=!!(S.ephExtend&&S.ephExtend[ym]);
    const showBtn=!isFut&&!isExp&&!isExtended;
    const showUndo=!isFut&&!isExp&&isExtended;
    const rBtn=showBtn?`<button class="eph-rbtn" onclick="event.stopPropagation();reportEph(${ym})">+3m</button>`:showUndo?`<button class="eph-rbtn" onclick="event.stopPropagation();undoEph(${ym})">-3m</button>`:'<span style="width:26px;display:inline-block"></span>';
        // Source dots
    const gm2=gen[ym]||{};
    const dotHtml=(gm2.dim>0?'<span style="width:5px;height:5px;border-radius:50%;background:#9c80e0;display:inline-block"></span>':'')+
      (gm2.fer>0?'<span style="width:5px;height:5px;border-radius:50%;background:var(--gold);display:inline-block"></span>':'')+
      (gm2.ram>0?'<span style="width:5px;height:5px;border-radius:50%;background:var(--gold-dark);display:inline-block"></span>':'')+
      (gm2.hs>0?'<span style="width:5px;height:5px;border-radius:50%;background:var(--blue);display:inline-block"></span>':'')+
      (gm2.solde>0?'<span style="width:5px;height:5px;border-radius:50%;background:var(--text3);display:inline-block"></span>':'');
    ephHtml+=`<div class="eph-row${isFut?' fut':''}">
      <div class="eph-mc">${(function(){const cym=(S.profile&&S.profile.ephSoldeCreatedYM)||0;return ym===(cym>0?cym-1:cym)&&gen[ym]&&gen[ym].solde?'init':MC[m2]+' '+y2;})()}</div>
      <div class="eph-bc"><div class="eph-bw"><div class="eph-b" style="width:${Math.round(orig/maxV*100)}%;background:${bar};opacity:${isFut?.4:1}"></div></div></div>
      <div class="eph-vc">${fmtMin(orig)}</div>
      <div style="display:flex;gap:2px;align-items:center;width:26px;flex-shrink:0">${dotHtml}</div>
    </div>`;
  });
  document.getElementById('eph-list').innerHTML=ephHtml||'<div style="font-size:11px;color:var(--text3)">Aucune donnée.</div>';
  let restHtml='';
  let totalExisting=0; // only real (non-future) non-expired
  // Combine real available + previsionnal months (4 future max inline)
  const allRestReal=Object.keys(realAvail).map(Number).filter(ym=>realAvail[ym]>0).sort();
  const allRestPrev=Object.keys(prevEph).map(Number).filter(ym=>prevEph[ym]>0).sort().slice(0,4);
  const allRestYms=[...new Set([...allRestReal,...allRestPrev])].sort();
  const restMaxV=Math.max(...allRestYms.map(ym=>ym>TODAY_YM?(prevEph[ym]||0):(realAvail[ym]||0)),1);
  allRestYms.forEach(ym=>{
    const y2r=Math.floor(ym/12),m2r=ym%12;
    const expYmR=getExpYm(ym);
    const expYr=Math.floor(expYmR/12),expMr=expYmR%12;
    const isExpR=expYmR<=TODAY_YM;
    const isFutR=ym>TODAY_YM;
    const avail=isFutR?(prevEph[ym]||0):(realAvail[ym]||0);
    if(avail<=0)return;
    // Total = only existing (real, non-expired)
    if(!isExpR&&!isFutR)totalExisting+=avail;
    const moLeft=expYmR-TODAY_YM;
    const barColor=ephBarColor(moLeft,isExpR);
    const pct=Math.round(avail/restMaxV*100);
    const ext=getEphExtensions(ym);
    const expLblParts=isExpR?['expiré','']:['→',MC[expMr]+' '+String(expYr).slice(2)];
    const extSpan=(!isExpR&&!isFutR&&ext>0)
      ?'<span style="background:rgba(99,153,34,.35);border-radius:3px;color:var(--text)">'+expLblParts[1]+'</span>'
      :expLblParts[1];
    const expLblHtml=isExpR?'expiré':expLblParts[0]+extSpan;
    const extColor='var(--text3)';
    restHtml+='<div class="eph-row'+(isExpR?' exp':'')+(isFutR?' fut':'')+'"><div class="eph-mc">'+MC[m2r]+' '+y2r+'</div><div class="eph-bc"><div class="eph-bw"><div class="eph-b" style="width:'+pct+'%;background:'+barColor+';opacity:'+(isFutR?.5:1)+'"></div></div></div><div class="eph-vc">'+fmtMin(avail)+'</div><div class="eph-ec" style="font-size:9px;color:var(--text3)">'+expLblHtml+'</div></div>';
  });
  const restEl=document.getElementById('eph-rest-list');
  if(restEl)restEl.innerHTML=restHtml||'<div style="font-size:11px;color:var(--text3)">Aucun rendu disponible.</div>';
  const dispEl=document.getElementById('eph-total-dispo');
  if(dispEl)dispEl.textContent=fmtMin(totalExisting);
  updateRecap();
}

function ephBarColor(moLeft,isExp){
  if(isExp)return'#555';
  if(moLeft<=0)return'#E24B4A';
  if(moLeft>=3)return'#639922';
  if(moLeft<=1){
    const t=moLeft;
    const r=Math.round(226+(186-226)*t);const g=Math.round(75+(152-75)*t);const b=Math.round(74+(23-74)*t);
    return'rgb('+r+','+g+','+b+')';
  } else {
    const t=(moLeft-1)/2;
    const r=Math.round(186+(99-186)*t);const g=Math.round(152+(153-152)*t);const b=Math.round(23+(34-23)*t);
    return'rgb('+r+','+g+','+b+')';
  }
}

function calcPaniersMois(y,m){
  let c=0;const last=new Date(y,m+1,0).getDate();
  for(let d=1;d<=last;d++){const date=new Date(y,m,d),key=dk(date);if(isPanier(date)&&!(S.conges||{})[key])c++;}
  return c;
}

function reportEph(ym){
  if(!S.ephExtend)S.ephExtend={};
  const cur=getEphExtensions(ym);if(cur>=3)return;S.ephExtend[ym]=cur+1;
  saveState();render();
}

function undoEph(ym){
  if(!S.ephExtend)return;
  const cur=getEphExtensions(ym);if(cur<=1){delete S.ephExtend[ym];}else{S.ephExtend[ym]=cur-1;}
  saveState();render();
}
// ================================================================
// RECAP
// ================================================================
function updateRecap(){
  const el=document.getElementById('recap-content');if(!el)return;
  const used=calcCongesUsed();
  const rendusMin=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').reduce((s,k)=>s+getDur(new Date(k+'T12:00:00')),0);
  el.innerHTML='<div class="recap-row"><span>Congés posés</span><b style="color:var(--green)">'+used+' j</b></div>'
    +'<div class="recap-row"><span>Rendus posés</span><b style="color:var(--rendu-red-text)">'+fmtMin(rendusMin)+'</b></div>';
}
function openRecapModal(){
  document.querySelectorAll('[onclick*="openRecapModal"]').forEach(el=>el.classList.add('active'));document.body.classList.add('modal-open');
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const used=calcCongesUsed();
  const cgKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').sort();
  const rendKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').sort();
  const MC=['jan','fév','mar','avr','mai','jun','jui','aoû','sep','oct','nov','déc'];
  const rendusMin=rendKeys.reduce(function(s,k){return s+getDur(new Date(k+'T12:00:00'));},0);
  const cs=calcSoldes();

  function groupByMonth(keys){const g={};keys.forEach(function(k){const d=new Date(k+'T12:00:00'),ym=d.getFullYear()*12+d.getMonth();if(!g[ym])g[ym]=[];g[ym].push(k);});return g;}
  const cgByMonth=groupByMonth(cgKeys),rendByMonth=groupByMonth(rendKeys);

  function monthSection(byMonth,type){
    return Object.keys(byMonth).map(Number).sort().map(function(ym){
      const y=Math.floor(ym/12),m=ym%12,days=byMonth[ym];
      const val=type==='cg'?calcCongesUsedForKeys(days,cgKeys)+' j':fmtMin(days.reduce(function(s,k){return s+getDur(new Date(k+'T12:00:00'));},0));
      const color=type==='cg'?'var(--green)':'var(--rendu-red-text)';
      const detail=days.map(function(k){const d=new Date(k+'T12:00:00');return'<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:var(--text2)"><span>'+fmtDate(d)+'</span>'+(type==='rend'?'<span>'+fmtMin(getDur(d))+'</span>':'')+'</div>';}).join('');
      return'<div style="margin-bottom:2px"><div data-tid="r-'+type+'-'+ym+'" style="display:flex;justify-content:space-between;cursor:pointer;padding:5px 0;border-bottom:0.5px solid var(--border2)" onclick="toggleRecapMonth(this)"><span style="font-size:12px;color:var(--text2)">'+MC[m]+' '+y+'</span><span style="font-size:12px;font-weight:500;color:'+color+'">'+val+' ▸</span></div><div id="r-'+type+'-'+ym+'" style="display:none;padding:4px 0 4px 8px">'+detail+'</div></div>';
    }).join('');
  }

  const cgHtml=monthSection(cgByMonth,'cg')||'<div style="font-size:11px;color:var(--text3);padding:4px 0">Aucun congé posé.</div>';
  const rendHtml=monthSection(rendByMonth,'rend')||'<div style="font-size:11px;color:var(--text3);padding:4px 0">Aucun rendu posé.</div>';

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Récapitulatif</div>'
    +'<div class="recap-row"><span>Congés posés</span><b style="color:var(--green)">'+used+' j</b></div>'
    +'<div class="recap-row"><span>Rendus posés</span><b style="color:var(--rendu-red-text)">'+fmtMin(rendusMin)+'</b></div>'
    +'<div class="recap-row" style="margin-bottom:12px"><span>Éphem. dispo</span><b style="color:var(--blue)">'+fmtMin(cs.totalReal)+'</b></div>'
    +'<div class="btit" style="margin-bottom:4px;margin-top:4px">Congés</div>'
    +cgHtml
    +'<div class="btit" style="margin-bottom:4px;margin-top:8px">Rendus</div>'
    +rendHtml
    +'<button class="mcancel" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

// ================================================================
// HISTORY
// ================================================================
function renderHistory(){}// No side panel history — use modal
function logH(detail,color,key){
  pushUndo();
  if(!S.history)S.history=[];S.history.unshift({t:nowHHMM(),d:detail,c:color,key});
  if(S.history.length>30)S.history.pop();saveState();
}
function removeHistoryForKey(key){if(!S.history)return;S.history=S.history.filter(h=>h.key!==key);saveState();}
function renderHistoryDropdown(){
  const el=document.getElementById('dd-history-content');if(!el)return;
  const h=S.history||[];
  const html=h.length
    ?h.slice(0,15).map(e=>'<div class="hrow"><div class="hdot" style="background:'+e.c+'"></div><span class="htime">'+e.t+'</span><span class="hdesc">'+e.d+'</span></div>').join('')
    :'<span style="font-size:11px;color:var(--text3)">Aucune modification.</span>';
  el.innerHTML='<div class="dd-title">Historique</div>'+html;
}
function openHistoryModal(){
  const h=S.history||[];
  const html=h.length?h.map(e=>`<div class="hrow"><div class="hdot" style="background:${e.c}"></div><span class="htime">${e.t}</span><span class="hdesc">${e.d}</span></div>`).join(''):'<span style="font-size:11px;color:var(--text3)">Aucune modification.</span>';
  document.getElementById('modal-root').innerHTML=`<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Historique</div>${html}<button class="mcancel" onclick="closeModal()">Fermer</button></div></div>`;
}

// ================================================================
// DAY MODAL — grille contextuelle
// ================================================================
// Les vacations valides selon le jour de semaine
function getDayVacs(dw,allVK){
  // lun-ven: A*, B*, C*, D*, P423 (pas de s/d suffixe)
  // sam: *s ou As*
  // dim: *d ou Ad*
  var night=['D1','D2','Es','Ed','Fs','Fd','P423'];
  var week=['A1','A2','A3','B1','C1','C2'];
  var sat=['As1','As2','As3','Cs','Es','Fs'];
  var sun=['Ad1','Ad2','Ad3','Cd','Ed','Fd'];
  var base;
  if(dw===6) base=[...new Set([...sat,...night.filter(v=>!sat.includes(v))])];
  else if(dw===0) base=[...new Set([...sun,...night.filter(v=>!sun.includes(v))])];
  else base=[...new Set([...week,...night.filter(v=>!week.includes(v))])];
  var std=base.filter(v=>allVK.includes(v));
  var stdAll=[...week,...sat,...sun,...night];
  var custom=allVK.filter(v=>!stdAll.includes(v));
  return [...std,...custom];
}

var _lpk=null; // backup of pendingKey for avw()

function openDay(key){
  if(!key)return;pendingKey=key;_lpk=key;
  var date=new Date(key+'T12:00:00'),VAC=getVAC(),v2=getVac(date),vac=v2.vac,ov=v2.ov,fromSV=v2.fromSV,absent=v2.absent,echange=v2.echange,li=v2.li,cycleVac=v2.cycleVac;
  var isFer=FERIES.has(key),hasCg=(S.conges||{})[key],dur=getDur(date);
  var cs=calcSoldes(),totalReal=cs.totalReal,matelas=cs.matelas,totalDispo=totalReal+Math.max(0,matelas);
  var cR=Math.max(0,((S.profile&&S.profile.congesInit)||25)-calcCongesUsed());
  var lbl=fmtDate(date),factor=renduFactor(date),ramee=isSemaineRamenée(getMonday(date)),hsW=calcHSWeek(getMonday(date)),sett=settingsForYM(date.getFullYear()*12+date.getMonth());
  var tt=vac&&vac!=='RH'?vac:'';if(absent)tt='Absent';else if(isFer)tt=vac&&vac!=='RH'?vac:'Férié';else if(!vac)tt='Repos';if(echange)tt+=' (echange)';

  // Grille contextuelle — seulement les vacs du jour
  var dw=date.getDay();
  var allVK=Object.keys(VAC).filter(v=>VAC[v]&&VAC[v].dur>0&&v!=='SV');
  // Row-based grid by day type
  var rows=[];
  if(dw===6){rows=[['As1','As2','As3'],['Cs','Es','Fs'],['SV','Vac. perso','Autre']];}
  else if(dw===0){rows=[['Ad1','Ad2','Ad3'],['Cd','Ed','Fd'],['SV','Vac. perso','Autre']];}
  else{rows=[['A1','A2','A3','B1'],['C1','C2','D1','D2'],['P423'],['SV','Vac. perso','Autre']];}
  // Add custom vacs to last row
  var customVacs=Object.keys(VAC).filter(v=>!VAC_STD[v]&&v!=='SV'&&!(S.customVacs&&S.customVacs[v]&&S.customVacs[v].hidden));
  customVacs.forEach(function(cv){var found=false;rows.forEach(function(r){if(r.includes(cv))found=true;});if(!found)rows[rows.length-1].unshift(cv);});
  const gridCols=(dw===0||dw===6)?3:4;
  var vgHtml='<div style="height:8px"></div>';
  // Flatten all rows into a single grid (same sizing as action buttons)
  var allVns=[];rows.forEach(function(row){row.forEach(function(vn){allVns.push(vn);});});
  vgHtml+='<div class="mbtns" style="grid-template-columns:repeat('+gridCols+',1fr);margin-bottom:6px">';
  allVns.forEach(function(vn){
      if(vn==='Autre'){
        vgHtml+=`<button style="padding:8px 4px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);cursor:pointer;text-align:center;font-weight:500;" onclick="openAutreVacModal()">Autre</button>`;
      } else if(vn==='Vac. perso'){
        vgHtml+=`<button style="padding:8px 4px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);cursor:pointer;text-align:center;font-weight:500;" onclick="openCustomVacModal()">Perso</button>`;
      } else {
        var vi=VAC[vn];
        var isCur=!ov&&vn===cycleVac;
        var bg=vi&&vi.dur>0?'var(--blue-l)':'var(--bg2)',cl=vi&&vi.dur>0?'var(--blue)':'var(--text)';
        var bd=isCur?'2px solid var(--blue)':'0.5px solid var(--border)';
        var durLbl=vi&&vi.dur>0?'<div style="font-size:9px;opacity:.7">'+fmtMin(vi.dur)+'</div>':'';
        vgHtml+=`<button class="mb" style="border:${bd};background:${bg};color:${cl};" onclick="avw('${vn}')"><div>${vn}</div>${durLbl}</button>`;
      }
  });
  vgHtml+='</div>';


  var ah='';
  if((vac&&vac!=='RH'&&!absent)&&!hasCg){
    ah=`<div class="mbtns" style="grid-template-columns:repeat(4,1fr)">
      <button class="mb grn" onclick="openPoseModal('cg')"${cR<=0?' disabled':''}>Congé</button>
      <button class="mb" style="background:var(--rendu-red-l);color:var(--rendu-red-text);border-color:transparent" onclick="openPoseModal('rend')"${totalDispo<dur?' disabled':''}>Rendu</button>
      <button class="mb" style="border:none;background:rgba(124,92,191,.20);color:#9b7fe0" onclick="openExchange('${key}')">Échange</button>
      <button class="mb" style="background:var(--bg3);color:var(--text2)" onclick="openPoseModal('absent')">Absent</button>
    </div>`;
  } else if(vac&&vac!=='RH'&&!absent&&hasCg){
    ah=`<div class="mbtns"><button class="mb del wide" style="border:none" onclick="removeCongé()">Retirer</button></div>`;
  }

  document.getElementById('modal-root').innerHTML=`<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">${lbl}${tt?' - '+tt:''}${dur?' - '+fmtMin(dur):''}</div>${vac&&vac!=='RH'&&!absent&&VAC[vac]?`<div class="ss">${VAC[vac].deb}→${VAC[vac].fin} · ${fmtMin(dur)}</div>`:''}${vgHtml}<div style="height:0.5px;background:var(--border);margin:16px 0;opacity:.5"></div>${ah}${echange?`<button class="mb del wide" style="font-size:11px;padding:8px;margin-bottom:4px" onclick="cancelExchange('${key}')">Annuler l'échange</button>`:ov?`<button class="mb wide ghost" style="font-size:11px;padding:8px;margin-bottom:4px" onclick="resetVac()">Remettre le cycle (${cycleVac||'repos'})</button>`:''}<button class="mcancel" onclick="closeModal()">Fermer</button></div></div>`;
}
function avw(sel){
  if(!sel)return;
  var key=pendingKey||_lpk;if(!key)return;
  var date=new Date(key+'T12:00:00'),cv=getCycleVac(date).cycleVac;
  // Show HS toggle before saving
  var curOv=S.overrides&&S.overrides[key];
  var curHs=curOv&&curOv.hs===true;
  _pendingVacSel={key,sel,date,cv,hs:curHs};
  var durInfo='';
  const VAC=getVAC();
  // No HS toggle when choosing SV (repos)
  const isSelSV=sel==='SV';
  if(VAC[sel]&&VAC[sel].dur>0){
    const cvDur=(cv&&cv!=='RH'&&VAC[cv])?VAC[cv].dur:0;
    const diff=VAC[sel].dur-cvDur;
    if(diff>0)durInfo='<div style="font-size:11px;color:var(--text3);margin-bottom:10px">+'+fmtMin(diff)+' vs cycle</div>';
  }
  const hsToggle=isSelSV?'':
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:0.5px solid var(--border)">'
    +'<span style="font-size:13px;color:var(--text2)">Génère des HS</span>'
    +'<label class="tgl"><input type="checkbox" id="hs-toggle"'+(curHs?' checked':'')+'><span class="tgl-s"></span></label>'
    +'</div>';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">'+sel+'</div>'
    +durInfo+hsToggle
    +'<button class="mb wide" style="margin-top:8px" onclick="avwConfirm()">Confirmer</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
}
var _pendingVacSel=null;
function avwConfirm(){
  if(!_pendingVacSel)return;
  var{key,sel,date,cv}=_pendingVacSel;
  var hs=document.getElementById('hs-toggle')?document.getElementById('hs-toggle').checked:false;
  if(!S.overrides)S.overrides={};
  S.overrides[key]={vac:sel==='SV'?null:sel,fromSV:!cv||cv==='RH'||sel==='SV',echange:false,hs:hs};
  logH(fmtDate(date)+' -> '+sel+(hs?' (HS)':''),'#4ea0f7',key);
  _pendingVacSel=null;
  saveState();closeModal();render();
  if(gcalTokens){if(key)_gcalPendingDates.add(key);gcalTriggerTargeted();}
}

function resetVac(){removeHistoryForKey(pendingKey);if(!S.overrides)S.overrides={};delete S.overrides[pendingKey];if(!S.conges)S.conges={};delete S.conges[pendingKey];saveState();closeModal();render();if(gcalTokens){if(pendingKey)_gcalPendingDates.add(pendingKey);gcalTriggerTargeted();}
}
function setAbsent(){var date=new Date(pendingKey+'T12:00:00');if(!S.overrides)S.overrides={};S.overrides[pendingKey]={absent:true};if(!S.conges)S.conges={};S.conges[pendingKey]='absent';logH(fmtDate(date)+' -> absent','#f0a030',pendingKey);saveState();closeModal();render();if(gcalTokens){if(pendingKey)_gcalPendingDates.add(pendingKey);gcalTriggerTargeted();}
}
function resetAbsent(){removeHistoryForKey(pendingKey);if(!S.overrides)S.overrides={};delete S.overrides[pendingKey];if(!S.conges)S.conges={};delete S.conges[pendingKey];saveState();closeModal();render();if(gcalTokens){if(pendingKey)_gcalPendingDates.add(pendingKey);gcalTriggerTargeted();}
}
function poseConge(t){var date=new Date(pendingKey+'T12:00:00');if(!S.conges)S.conges={};S.conges[pendingKey]=t;logH(fmtDate(date)+' -> '+(t==='cg'?'congé':'rendu '+fmtMin(getDur(date))),t==='cg'?'#5a9e3f':'#b0443a',pendingKey);saveState();closeModal();render();}
function removeCongé(){
  const key=pendingKey;
  if(!S.conges||!key)return;
  const type=S.conges[key];
  if(!type){saveState();closeModal();render();return;}
  // Find all days of the same type connected to this day (no worked-day gap)
  // Walk backward and forward
  const toRemove=new Set([key]);
  // Walk backward
  var d=new Date(key+'T12:00:00');
  for(var i=1;i<=365;i++){
    var prev=new Date(d);prev.setDate(prev.getDate()-i);
    var pk=dk(prev);
    var v2=getVac(prev);
    var isWorked=v2.vac&&v2.vac!=='RH'&&!v2.absent;
    if(isWorked){
      if(S.conges[pk]===type)toRemove.add(pk);
      else break; // gap found
    }
  }
  // Walk forward
  var d2=new Date(key+'T12:00:00');
  for(var j=1;j<=365;j++){
    var nxt=new Date(d2);nxt.setDate(nxt.getDate()+j);
    var nk=dk(nxt);
    var v2b=getVac(nxt);
    var isWorked2=v2b.vac&&v2b.vac!=='RH'&&!v2b.absent;
    if(isWorked2){
      if(S.conges[nk]===type)toRemove.add(nk);
      else break;
    }
  }
  const _pid2=window._aid||'default';
  const _stored2=JSON.parse(localStorage.getItem('gcal_event_ids_'+_pid2)||'{}');
  toRemove.forEach(function(k){
    delete S.conges[k];removeHistoryForKey(k);
    delete _stored2[k]; // clear stored IDs so sync re-creates correctly
  });
  localStorage.setItem('gcal_event_ids_'+_pid2,JSON.stringify(_stored2));
  saveState();closeModal();render();
  if(gcalTokens){if(pendingKey)_gcalPendingDates.add(pendingKey);gcalTriggerTargeted();}
}
function showPoseSelect(){
  var w=document.getElementById('pose-select-wrap');
  if(w)w.style.display='block';
}
function openPoseModal(type){
  const key=pendingKey||_lpk;
  if(!key)return;
  const date=new Date(key+'T12:00:00');
  // Build a list of valid target days from this day forward (worked days, same type logic)
  // Show: Unique | Jusqu'au [date picker equivalent - show next worked days]
  const lbl=type==='cg'?'Congé':type==='rend'?'Rendu':'Absent';
  const color=type==='cg'?'var(--green)':type==='rend'?'var(--rendu-red-text)':'var(--text2)';
  const bg=type==='cg'?'var(--green-l)':type==='rend'?'var(--rendu-red-l)':'var(--bg3)';

  // Build list of next worked days for "jusqu'au" picker (next 60 days)
  var opts='',lastMonK='';
  var d=new Date(key+'T12:00:00');
  var count=1;
  while(count<=60){
    var nxt=new Date(d);nxt.setDate(nxt.getDate()+count);
    var nk=dk(nxt);
    var v2=getVac(nxt);
    var isWorked=v2.vac&&v2.vac!=='RH'&&!v2.absent;
    if(isWorked){
      // Add week separator
      const nxtMon=getMonday(nxt),nxtMk=dk(nxtMon);
      if(lastMonK&&nxtMk!==lastMonK){opts+='<option disabled>──────────────────</option>';}
      lastMonK=nxtMk;
      opts+='<option value="'+nk+'"'+(opts===''?' selected':'')+'>'+fmtDate(nxt)+'</option>';
    }
    count++;
  }

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)openDay(\''+key+'\')"><div class="sheet" style="max-height:380px">'
    +'<div class="sh"></div>'
    +'<div class="st" style="color:#fff;margin-bottom:14px">'+lbl+'</div>'
    +'<div class="mbtns" style="margin-bottom:10px">'
    +'<button class="mb" style="background:'+bg+';color:'+color+';border:none" onclick="applyPose(\''+type+'\',\''+key+'\',true)">Unique</button>'
    +'<button class="mb" style="background:'+bg+';color:'+color+';border:none" onclick="showPoseSelect()">Multiple</button>'
    +'</div>'
    +'<div id="pose-select-wrap" style="display:none;margin-bottom:10px">'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +'<select id="pose-until" style="flex:1;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:14px;background:var(--bg2);color:var(--text)">'+opts+'</select>'
    +'<button class="mb pri" style="flex-shrink:0;white-space:nowrap" onclick="applyPose(\''+type+'\',\''+key+'\',false)">Valider</button>'
    +'</div>'
    +'</div>'
    +'<button class="mcancel" onclick="openDay(\''+key+'\')">Retour</button>'
    +'</div></div>';
}

function calcDispoAtDate(targetDate){
  // Heures disponibles à targetDate :
  // - heures réelles dispo aujourd'hui, non expirées à targetDate
  // - heures futures créées avant targetDate et non expirées à targetDate
  const cs=calcSoldes();
  let dispo=0;
  // Real months: include only if not expired at targetDate
  Object.keys(cs.realAvail).forEach(function(ymStr){
    const ym=Number(ymStr);
    const avail=cs.realAvail[ym];
    if(avail<=0)return;
    const expYm=ym+((S.ephExtend&&S.ephExtend[ym])?6:3);
    const expDate=new Date(Math.floor(expYm/12),expYm%12+1,0);
    if(expDate>=targetDate)dispo+=avail;
  });
  // Future months: created before targetDate, not expired at targetDate
  Object.keys(cs.prevEph).forEach(function(ymStr){
    const ym=Number(ymStr);
    const total=cs.prevEph[ym];
    if(total<=0)return;
    const lastDayOfMonth=new Date(Math.floor(ym/12),ym%12+1,0);
    if(lastDayOfMonth>targetDate)return; // not yet created at targetDate
    const expYm=ym+((S.ephExtend&&S.ephExtend[ym])?6:3);
    const expDate=new Date(Math.floor(expYm/12),expYm%12+1,0);
    if(expDate>=targetDate)dispo+=total;
  });
  return dispo;
}

function applyPose(type,startKey,unique){
  const endKey=unique?startKey:(document.getElementById('pose-until').value||startKey);
  const start=new Date(startKey+'T12:00:00');
  const end=new Date(endKey+'T12:00:00');

  // Validate rendus: check available hours at end date
  if(type==='rend'){
    var totalRend=0;
    var d0=new Date(start);
    while(d0<=end){
      const v2=getVac(d0);
      if(v2.vac&&v2.vac!=='RH'&&!v2.absent)totalRend+=getDur(d0);
      d0.setDate(d0.getDate()+1);
    }
    const dispo=calcDispoAtDate(end);
    if(totalRend>dispo){
      const manque=totalRend-dispo;
      document.getElementById('modal-root').innerHTML='<div class="overlay" style="z-index:400"><div class="sheet" style="max-height:220px"><div class="sh"></div>'
        +'<div class="st" style="color:var(--rendu-red-text)">Rendus insuffisants</div>'
        +'<div class="ss" style="margin-bottom:16px">Il manque <b>'+fmtMin(manque)+'</b> pour poser cette période.<br>Disponible : '+fmtMin(dispo)+' · Nécessaire : '+fmtMin(totalRend)+'</div>'
        +'<button class="mb wide" onclick="if(pendingKey)openDay(pendingKey);else closeModal()">Retour</button>'
        +'</div></div>';
      return;
    }

  }

  if(!S.conges)S.conges={};if(!S.overrides)S.overrides={};
  var d=new Date(start);
  while(d<=end){
    const k=dk(d);
    const v2=getVac(d);
    const isWorked=v2.vac&&v2.vac!=='RH'&&!v2.absent;
    if(isWorked){
      if(type==='absent'){S.overrides[k]={absent:true};S.conges[k]='absent';}
      else{S.conges[k]=type;}
    }
    d.setDate(d.getDate()+1);
  }
  const label=type==='cg'?'congé':type==='rend'?'rendu':'absent';
  const color=type==='cg'?'#5a9e3f':type==='rend'?'#b0443a':'#f0a030';
  logH(fmtDate(start)+' -> '+label+(unique?'':' au '+fmtDate(end)),color,startKey);
  saveState();closeModal();render();
  if(gcalTokens){
    const d2=new Date(start);
    while(d2<=end){gcalQueueDate(dk(d2));d2.setDate(d2.getDate()+1);}
  }
}

function computeSettForProfile(pr,targetYM,key){
  var ss=pr&&pr.settings?pr.settings:{};
  var base=ss[key]!==false;
  var hist=ss.settingsHistory||[];
  var active=null;
  for(var h of hist){var p2=h.since||'';if(!p2)continue;var py=parseInt(p2.split('-')[0]),pm=parseInt(p2.split('-')[1])-1;var hym=py*12+pm;if(hym<=targetYM)active=h;}
  return active?active[key]!==false:base;
}

function toggleHistPanel(btn){
  const key=btn.dataset.key,pid=btn.dataset.pid;
  const panelId='th-'+key+'-'+pid;
  const existing=document.getElementById(panelId);
  if(existing){existing.style.display=existing.style.display==='none'?'block':'none';return;}
  const pr=_profs[pid];if(!pr)return;
  const history=(pr.settings&&pr.settings.settingsHistory)||[];
  const MC=['jan','fév','mar','avr','mai','jun','jui','aoû','sep','oct','nov','déc'];
  const rows=history.filter(function(h){
    const since=h.since||'';if(!since)return false;
    return parseInt(since.split('-')[0])===CUR_YEAR;
  }).map(function(h){
    const since=h.since||'';
    const parts=since.split('-');
    const y=parseInt(parts[0]),m=parseInt(parts[1])-1;
    const sinceYM=y*12+m;
    const val=h[key];
    const isFuture=sinceYM>TODAY_YM;
    const badge=isFuture?'<span style="font-size:9px;background:var(--gold-l);color:var(--gold-dark);padding:1px 5px;border-radius:8px;margin-left:4px">à venir</span>':'';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0">'
      +'<span style="font-size:11px;color:var(--text2)">'+MC[m]+' '+y+'</span>'
      +'<div style="display:flex;align-items:center"><span style="font-size:11px;color:var(--text3)">'+(val?'activé':'désactivé')+'</span>'+badge+'</div>'
      +'</div>';
  }).filter(Boolean);
  if(!rows.length)return; // no changes to show
  const panel=document.createElement('div');
  panel.id=panelId;
  panel.style.cssText='padding:6px 8px;background:var(--bg3);border-radius:var(--r);margin:2px 0 4px;font-size:11px';
  panel.innerHTML=rows.join('');
  const row=btn.closest('.srow');
  if(row&&row.parentNode)row.parentNode.insertBefore(panel,row.nextSibling);
}

function cancelExchange(key){
  // Remove overrides for both days of the exchange
  if(!S.overrides)return;
  // Find the partner key: look for ec2 (the day we gave away) or ec (the day we took)
  const ov1=S.overrides[key];
  if(!ov1||!ov1.echange)return;
  delete S.overrides[key];
  // Also remove the partner if it references this exchange
  // Since we don't store a link, search all overrides for echange pairs in the same week
  const date=new Date(key+'T12:00:00'),mon=getMonday(date);
  for(let i=0;i<7;i++){
    const d=new Date(mon);d.setDate(mon.getDate()+i);const dk2=dk(d);
    const ov2=(S.overrides||{})[dk2];
    if(ov2&&ov2.echange){gcalClearDateId(dk2);if(dk2!==key)delete S.overrides[dk2];}
  }
  gcalClearDateId(key);delete S.overrides[key];
  removeHistoryForKey(key);
  saveState();closeModal();render();
  if(gcalTokens){if(pendingKey)_gcalPendingDates.add(pendingKey);gcalTriggerTargeted();}
}
function openHSModal(mym){
  document.querySelectorAll('[onclick*="openHSModal"]').forEach(el=>el.classList.add('active'));document.body.classList.add('modal-open');
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const y=Math.floor(mym/12),m=mym%12;
  const MC=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const sett2=settingsForYM(mym);const useRendu2=sett2.hsRendu;
  const seenW=new Set();let rows='';
  let tot=0,totLow=0,totHigh=0,totRawLow=0,totRawHigh=0,totRam=0;
  // Cross-month ramenée weeks
  for(let dd=-14;dd<1;dd++){
    const date=new Date(y,m,1);date.setDate(date.getDate()+dd);
    const mon=getMonday(date),mk=dk(mon);
    if(seenW.has(mk))continue;
    if(mon.getFullYear()*12+mon.getMonth()===mym)continue;
    if(!isSemaineRamenée(mon))continue;
    let ferYm2=mon.getFullYear()*12+mon.getMonth();
    for(let fi=0;fi<7;fi++){const fd=new Date(mon);fd.setDate(mon.getDate()+fi);if(FERIES.has(dk(fd))){ferYm2=fd.getFullYear()*12+fd.getMonth();break;}}
    if(ferYm2!==mym)continue;
    seenW.add(mk);
    const hsW=calcHSWeek(mon);if(hsW.surplus<=0)continue;
    const sett=settingsForYM(mym);const useRendu=sett.hsRendu;
    const low=useRendu?Math.min(hsW.surplus,480)*1.25:hsW.rawLow;
    const high=useRendu?Math.max(0,hsW.surplus-480)*1.5:hsW.rawHigh;
    const rowTotal=useRendu?hsW.rendusMin:(hsW.rawLow+hsW.rawHigh);
    tot+=rowTotal;totLow+=low;totHigh+=high;totRawLow+=hsW.rawLow;totRawHigh+=hsW.rawHigh;if(hsW.isRam)totRam+=7*60;
    const li=lineIdx(mon);
    rows+='<div style="padding:5px 0;border-bottom:0.5px solid var(--border2)">'      +'<div style="display:flex;justify-content:space-between;align-items:center">'      +'<span style="font-size:11px;color:var(--text2)">Semaine '+getISOWeek(mon)+'</span>'      +'<div style="margin-left:auto;display:flex;gap:16px;align-items:center">'      +(useRendu2?'<b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(hsW.rawLow+hsW.rawHigh)+'</b>':'')      +'<b style="font-size:11px;width:52px;text-align:right">'+fmtMin(rowTotal)+'</b>'      +'</div></div>'      +(low>0?'<div style="font-size:10px;color:var(--text3);margin-top:1px">HS≤8h : '+fmtMin(hsW.rawLow)+(hsW.isRam?' (dont ramenée 7h)':'')+'</div>':'')      +(high>0?'<div style="font-size:10px;color:var(--text3)">HS>8h : '+fmtMin(hsW.rawHigh)+'</div>':'')      +'</div>';
  }
  // Main month weeks
  for(let d=1;d<=new Date(y,m+1,0).getDate();d++){
    const date=new Date(y,m,d),mon=getMonday(date),mk=dk(mon);
    if(seenW.has(mk))continue;seenW.add(mk);
    if(mon.getFullYear()*12+mon.getMonth()!==mym)continue;
    const hsW=calcHSWeek(mon);if(hsW.surplus<=0)continue;
    const sett=settingsForYM(mym);const useRendu=sett.hsRendu;
    const low=useRendu?Math.min(hsW.surplus,480)*1.25:hsW.rawLow;
    const high=useRendu?Math.max(0,hsW.surplus-480)*1.5:hsW.rawHigh;
    const rowTotal=useRendu?hsW.rendusMin:(hsW.rawLow+hsW.rawHigh);
    tot+=rowTotal;totLow+=low;totHigh+=high;totRawLow+=hsW.rawLow;totRawHigh+=hsW.rawHigh;if(hsW.isRam)totRam+=7*60;
    const li=lineIdx(mon);
    rows+='<div style="padding:5px 0;border-bottom:0.5px solid var(--border2)">'      +'<div style="display:flex;justify-content:space-between;align-items:center">'      +'<span style="font-size:11px;color:var(--text2)">Semaine '+getISOWeek(mon)+'</span>'      +'<div style="margin-left:auto;display:flex;gap:16px;align-items:center">'      +(useRendu2?'<b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(hsW.rawLow+hsW.rawHigh)+'</b>':'')      +'<b style="font-size:11px;width:52px;text-align:right">'+fmtMin(rowTotal)+'</b>'      +'</div></div>'      +(low>0?'<div style="font-size:10px;color:var(--text3);margin-top:1px">HS≤8h : '+fmtMin(hsW.rawLow)+(hsW.isRam?' (dont ramenée 7h)':'')+'</div>':'')      +(high>0?'<div style="font-size:10px;color:var(--text3)">HS>8h : '+fmtMin(hsW.rawHigh)+'</div>':'')      +'</div>';
  }
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Heures supp. – '+MC[m]+' '+y+'</div>'
    +(rows?'<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0 4px"><span style="font-size:10px;color:var(--text3)"></span><div style="margin-left:auto;display:flex;gap:16px">'+(useRendu2?'<span style="font-size:10px;color:var(--text3);width:52px;text-align:right">brutes</span>':'')+'<span style="font-size:10px;color:var(--text3);width:52px;text-align:right">'+(useRendu2?'rendues':'payés')+'</span></div></div>'+rows:'<div style="font-size:11px;color:var(--text3);padding:8px 0">Aucune heure supplémentaire ce mois.</div>')
    +'<div class="sep"></div>'    +(useRendu2?(
      (totRawLow>0?'<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS≤8h'+(totRam>0?' (dont ramenées '+fmtMin(totRam)+')':'')+'</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawLow)+'</b><b style="font-size:11px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totLow)+'</b></div></div>':'')+
      (totRawHigh>0?'<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS>8h</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawHigh)+'</b><b style="font-size:11px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totHigh)+'</b></div></div>':'')+
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:0.5px solid var(--border)"><span style="font-size:15px;font-weight:600">Total</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:15px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawLow+totRawHigh)+'</b><b style="font-size:15px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(tot)+'</b></div></div>'
    ):(
      (totRawLow>0?'<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:15px;font-weight:600">HS≤8h'+(totRam>0?' (dont ramenées '+fmtMin(totRam)+')':'')+'</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:15px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totRawLow)+'</b></div></div>':'')+
      (totRawHigh>0?'<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:15px;font-weight:600">HS>8h</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:15px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totRawHigh)+'</b></div></div>':'')
    ))    +'<button class="mcancel" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

function openRestantsModal(){
  document.body.classList.add('modal-open');
  const{realAvail,prevEph}=calcSoldes();
  const ML=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  // Combine real + 12 future months
  const allReal=Object.keys(realAvail).map(Number).filter(ym=>realAvail[ym]>0);
  const allPrev=Object.keys(prevEph).map(Number).filter(ym=>prevEph[ym]>0).sort().slice(0,12);
  const yms=[...new Set([...allReal,...allPrev])].sort();
  const maxV=Math.max(...yms.map(ym=>ym>TODAY_YM?(prevEph[ym]||0):(realAvail[ym]||0)),1);
  let rows='';
  const btnS='font-size:9px;padding:2px 5px;border:0.5px solid var(--border);border-radius:4px;background:transparent;cursor:pointer;';
  yms.forEach(function(ym){
    const isFut=ym>TODAY_YM;
    const avail=isFut?(prevEph[ym]||0):(realAvail[ym]||0);
    if(avail<=0)return;
    const y=Math.floor(ym/12),m=ym%12;
    const expYm=getExpYm(ym),expY=Math.floor(expYm/12),expM=expYm%12;
    const isExp=expYm<=TODAY_YM,ext=getEphExtensions(ym);
    // canSub: allowed whenever ext>0
    const canAdd=!isExp&&!isFut&&ext<3;
    const canSub=!isExp&&!isFut&&ext>0;
    const moLeft=expYm-TODAY_YM;
    const expColor=isExp?'var(--rendu-red-text)':moLeft<=1?'#E24B4A':moLeft<=2?'#BA7517':'var(--text3)';
    const barColor=ephBarColor(moLeft,isExp);
    const pct=Math.round(avail/maxV*100);
    const minusBtn='<button onclick="undoEph('+ym+');openRestantsModal()" style="'+btnS+'color:'+(canSub?'var(--text3)':'var(--border2)')+';pointer-events:'+(canSub?'auto':'none')+'">-3m</button>';
    const plusBtn='<button onclick="reportEph('+ym+');openRestantsModal()" style="'+btnS+'color:'+(canAdd?'var(--text3)':'var(--border2)')+';pointer-events:'+(canAdd?'auto':'none')+'">+3m</button>';
    rows+='<div style="display:flex;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--border2);gap:6px'+(isExp?';opacity:.4':'')+'">'
      +'<div style="width:52px;flex-shrink:0"><div style="font-size:11px;color:var(--text'+(isExp||isFut?'3':'2')+')">'+ML[m].slice(0,4)+' '+String(y).slice(2)+'</div>'
      +'<div style="font-size:9px;color:'+expColor+'">→'+ML[expM].slice(0,4)+' '+String(expY).slice(2)+'</div></div>'
      +'<div style="flex:1"><div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+barColor+';opacity:'+(isFut?.5:1)+'"></div></div></div>'
      +'<div style="width:44px;text-align:right;font-size:12px;font-weight:600;color:'+(isFut?'var(--text3)':'var(--text)')+'">'+fmtMin(avail)+'</div>'
      +'<div style="display:flex;gap:2px">'+minusBtn+plusBtn+'</div>'
      +'</div>';
  });
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Solde éphémère</div>'
    +(rows||'<div style="font-size:11px;color:var(--text3)">Aucun rendu disponible.</div>')
    +'<button class="mcancel" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

function openPrevisMois(){
  document.querySelectorAll('[onclick*="openPrevisMois"]').forEach(el=>el.classList.add('active'));document.body.classList.add('modal-open');
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const{gen,prevEph}=calcSoldes();
  const MC=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const futureYms=Object.keys(prevEph).map(Number).sort();
  if(!futureYms.length){
    document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Prévis. rendus</div><div class="ss" style="margin-bottom:12px">Aucun rendu prévu.</div><button class="mcancel" onclick="closeModal()">Fermer</button></div></div>';
    return;
  }
  // Group by year, show CUR_YEAR total separately
  let rows='';let runningTotal=0;let prevYear=null;let yearTotal=0;let yearYm=null;
  futureYms.forEach(function(ym){
    const y=Math.floor(ym/12),m=ym%12;
    if(y!==CUR_YEAR)return; // only current year
    const gm=gen[ym]||{};
    const gt=(gm.dim||0)+(gm.rh||0)+(gm.fer||0)+(gm.hs||0)+(gm.ram||0);
    if(gt===0)return;
    // Year separator
    if(y!==prevYear){
      if(prevYear!==null){
        rows+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:4px;border-top:0.5px solid var(--border)"><span style="font-size:11px;font-weight:600">Total '+prevYear+'</span><div style="display:flex;align-items:center;gap:8px"><b style="font-size:12px;min-width:40px;text-align:right;color:var(--blue)">'+fmtMin(yearTotal)+'</b><div style="width:44px"></div></div></div>';
        if(prevYear===CUR_YEAR)runningTotal=yearTotal;
      }
      yearTotal=0;prevYear=y;
      rows+='<div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;padding:8px 0 4px">'+y+'</div>';
    }
    yearTotal+=gt;
    const dots=[];
    if(gm.dim>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:#9c80e0;display:inline-block"></span>');
    if(gm.rh>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:#7b9ce0;display:inline-block"></span>');
    if(gm.fer>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:var(--gold);display:inline-block"></span>');
    if(gm.ram>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:var(--gold-dark);display:inline-block"></span>');
    if(gm.hs>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:var(--blue);display:inline-block"></span>');
    rows+='<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:0.5px solid var(--border2)">'
      +'<span style="font-size:12px;color:var(--text2)">'+MC[m]+'</span>'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<b style="font-size:12px;min-width:40px;text-align:right">'+fmtMin(gt)+'</b>'
      +'<div style="display:flex;gap:2px;align-items:center;width:44px">'+dots.join('')+'</div>'
      +'</div>'
      +'</div>';
  });
  // Last year total
  if(prevYear!==null){
    rows+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:4px;border-top:0.5px solid var(--border)"><span style="font-size:11px;font-weight:600">Total '+prevYear+'</span><div style="display:flex;align-items:center;gap:8px"><b style="font-size:12px;min-width:40px;text-align:right;color:var(--blue)">'+fmtMin(yearTotal)+'</b><div style="width:44px"></div></div></div>';
    if(prevYear===CUR_YEAR)runningTotal=yearTotal;
  }
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Rendus à venir</div>'
    +(rows||'<div style="font-size:11px;color:var(--text3);padding:4px 0">Aucun rendu prévu.</div>')
    +'<button class="mcancel" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

function toggleRecapMonth(btn){
  const tid=btn.getAttribute?btn.getAttribute('data-tid'):btn;
  const el=document.getElementById(tid);
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}

function calcCongesUsedForKeys(monthKeys,allCgKeys){
  // Count CP for a specific set of days, using full ecart rule but limited to these keys
  if(!monthKeys.length)return 0;
  const cgSet=new Set(allCgKeys);
  const seenMon=new Set();let total=0;const fullWeeks=new Set();
  monthKeys.forEach(function(k){
    const d=new Date(k+'T12:00:00'),mon=getMonday(d),mk=dk(mon);
    if(seenMon.has(mk))return;seenMon.add(mk);
    if(!cgSet.has(mk))return;
    // Only count full week if monday is in this month (avoids double-counting cross-month weeks)
    const monM=mon.getFullYear()*12+mon.getMonth();
    const dayM=d.getFullYear()*12+d.getMonth();
    if(monM!==dayM)return; // monday in different month — will be counted there
    let ok=true;
    for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);const v2=getVac(dd);if(v2.vac&&v2.vac!=='RH'&&!v2.absent&&!cgSet.has(dk(dd))){ok=false;break;}}
    if(ok){fullWeeks.add(mk);total+=5;}
  });
  const partial=monthKeys.filter(k=>{
    const mk=dk(getMonday(new Date(k+'T12:00:00')));
    // Exclude days whose week was already counted as a full week (even from another month)
    if(fullWeeks.has(mk))return false;
    // Also check if this week is a full week globally (counted in a previous month)
    const mon=getMonday(new Date(k+'T12:00:00'));
    let ok=true;
    for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);const v2=getVac(dd);if(v2.vac&&v2.vac!=='RH'&&!v2.absent&&!cgSet.has(dk(dd))){ok=false;break;}}
    return ok===false; // only include in partial if week is NOT full
  });
  function fR(from){const sd=new Date(from);sd.setDate(sd.getDate()+1);while(sd<=new Date('2031-01-01')){const v2=getVac(sd);if(v2.vac&&v2.vac!=='RH'&&!v2.absent)return new Date(sd);sd.setDate(sd.getDate()+1);}return null;}
  const groups={};
  partial.forEach(function(k){const d=new Date(k+'T12:00:00'),r=fR(d),rk=r?dk(r):'none';if(!groups[rk])groups[rk]={reprise:r,dates:[]};groups[rk].dates.push(d);});
  Object.values(groups).forEach(function(g){
    const nb=g.dates.length;if(!g.reprise){total+=nb;return;}
    const lc=new Date(Math.max.apply(null,g.dates));
    total+=nb+Math.max(0,Math.round((g.reprise-lc)/(864e5))-1-2);
  });
  return total;
}

function openDetailMois(mym){
  document.querySelectorAll('[onclick*="openDetailMois"]').forEach(el=>el.classList.add('active'));document.body.classList.add('modal-open');
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const{gen}=calcSoldes();
  const gm=gen[mym]||{};
  const y=Math.floor(mym/12),m=mym%12;
  const ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function makeWeekRow(mon,note){
    const hsW=calcHSWeek(mon);
    // Compute dim/fer for this week
    const VAC=getVAC();
    let weekDim=0,weekRH=0,weekFer=0;
    for(let i=0;i<7;i++){
      const d=new Date(mon);d.setDate(mon.getDate()+i);
      const key=dk(d);const v2=getVac(d);
      const{vac,absent,echange,ecSelf}=v2;
      if(!vac||vac==='RH'||absent)continue;
      if(echange&&!ecSelf)continue;
      const cKey=(S.conges||{})[key];if(cKey==='rend')continue;
      const dur=VAC[vac]?VAC[vac].dur:0;
      const isFer3=FERIES.has(key),isDim3=d.getDay()===0,isRH3=isRHDay(d);
      const sett3=settingsForYM(d.getFullYear()*12+d.getMonth());
      const ferF3=isFer3&&sett3.ferRendu?2.0:0;
      const dimF3=isDim3&&sett3.dimRendu?0.5:0;
      const rhF3=(!v2.echange&&!isDim3&&isRH3&&sett3.rhRendu)?0.5:0;
      if(ferF3+dimF3+rhF3===0)continue;
      if(ferF3>0)weekFer+=Math.round(dur*ferF3/60*100)/100*60;
      if(dimF3>0)weekDim+=Math.round(dur*dimF3/60*100)/100*60;
      if(rhF3>0)weekRH+=Math.round(dur*rhF3/60*100)/100*60;
    }
    const total=hsW.rendusMinHS+hsW.rendusMinRam+weekDim+weekRH+weekFer;
    if(total<=0)return'';
    const parts=[];
    if(weekDim>0)parts.push('<span style="color:#9c80e0">Dim +'+fmtMin(weekDim)+'</span>');
    if(weekRH>0)parts.push('<span style="color:#7b9ce0">RH +'+fmtMin(weekRH)+'</span>');
    if(weekFer>0)parts.push('<span style="color:var(--gold)">Fér +'+fmtMin(weekFer)+'</span>');
    if(hsW.rendusMinHS>0)parts.push('<span style="color:var(--blue)">HS +'+fmtMin(hsW.rendusMinHS)+'</span>');
    if(hsW.rendusMinRam>0)parts.push('<span style="color:var(--gold-dark)">Ram +'+fmtMin(hsW.rendusMinRam)+'</span>');
    const partRows=[
      {label:'Dimanches',val:weekDim,color:'#9c80e0'},
      {label:'RH',val:weekRH,color:'#7b9ce0'},
      {label:'Fériés',val:weekFer,color:'var(--gold)'},
      {label:'Heures supp.',val:hsW.rendusMinHS,color:'var(--blue)'},
      {label:'Ramenée',val:hsW.rendusMinRam,color:'var(--gold-dark)'},
    ].filter(r=>r.val>0);
    return'<div style="font-size:11px;padding:5px 0;border-bottom:0.5px solid var(--border2)">'      +'<div style="display:flex;justify-content:space-between;margin-bottom:3px">'      +'<span style="font-weight:500;color:var(--text)">Semaine '+getISOWeek(mon)+(note?' <span style="font-size:10px;font-weight:400;color:var(--text3)">'+note+'</span>':'')+'</span>'      +'<b style="color:var(--blue)">+'+fmtMin(total)+'</b></div>'      +partRows.map(r=>'<div style="display:flex;justify-content:space-between;padding:1px 0 1px 8px">'        +'<span style="color:var(--text3)">'+r.label+'</span>'        +'<span style="color:'+r.color+'">+'+fmtMin(r.val)+'</span>'        +'</div>').join('')      +'</div>';
  }

  const seenW=new Set();let hsRows='';

  // Cross-month ramenées: semaines du mois préc. dont le férié est ce mois
  for(let dd=-14;dd<0;dd++){
    const date=new Date(y,m,1);date.setDate(date.getDate()+dd);
    const mon=getMonday(date),mk=dk(mon);
    if(seenW.has(mk))continue;seenW.add(mk);
    if(!isSemaineRamenée(mon))continue;
    let ferYm2=mon.getFullYear()*12+mon.getMonth();
    for(let fi=0;fi<7;fi++){const fd=new Date(mon);fd.setDate(mon.getDate()+fi);if(FERIES.has(dk(fd))){ferYm2=fd.getFullYear()*12+fd.getMonth();break;}}
    if(ferYm2!==mym)continue;
    hsRows+=makeWeekRow(mon,'← mois préc.');
  }

  // Semaines de ce mois
  for(let d=1;d<=new Date(y,m+1,0).getDate();d++){
    const date=new Date(y,m,d),mon=getMonday(date),mk=dk(mon);
    if(seenW.has(mk))continue;seenW.add(mk);
    if(mon.getFullYear()*12+mon.getMonth()!==mym)continue;
    hsRows+=makeWeekRow(mon,'');
  }

  const rows=[
    {label:'Dimanches',val:gm.dim,color:'#9c80e0'},
    {label:'RH',val:gm.rh,color:'#7b9ce0'},
    {label:'Fériés travaillés',val:gm.fer,color:'var(--gold)'},
    {label:'Heures supp.',val:gm.hs,color:'var(--blue)'},
    {label:'Semaines ramenées',val:gm.ram,color:'var(--gold-dark)'},
    {label:'Solde initial',val:gm.solde,color:'var(--text2)'},
  ].filter(r=>r.val>0);

  const gt=(gm.dim||0)+(gm.rh||0)+(gm.fer||0)+(gm.hs||0)+(gm.ram||0);

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'    +'<div class="sh"></div>'    +'<div class="st">Créés — '+ML[m].toLowerCase()+' '+y+'</div>'    +'<div class="ss">'+fmtMin(gt)+' acquis</div>'    +'<div style="margin-bottom:10px">'+rows.map(r=>
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid var(--border2)">'      +'<div style="display:flex;align-items:center;gap:6px"><span class="rdot" style="background:'+r.color+'"></span><span style="font-size:12px;color:var(--text2)">'+r.label+'</span></div>'      +'<b style="font-size:13px;color:var(--text)">'+fmtMin(r.val)+'</b></div>'    ).join('')+'</div>'    +(hsRows?'<div class="sep"></div><div class="btit" style="margin-bottom:4px">Détail par semaine</div>'+hsRows:'')    +'<button class="mcancel" onclick="closeModal()">Fermer</button>'    +'</div></div>';
}

function closeModal(){document.getElementById('modal-root').innerHTML='';pendingKey=null;document.querySelectorAll('.bloc.active,.ctr.active').forEach(el=>el.classList.remove('active'));document.body.classList.remove('modal-open');
  // Kill sticky hover on touch devices
  if(document.documentElement.classList.contains('touch')){
    const tmp=document.createElement('button');
    tmp.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';
    document.body.appendChild(tmp);tmp.focus();document.body.removeChild(tmp);
  }
}

// Swipe down to close modal
(function(){
  var startY=0,startScroll=0,sheet=null,overlay=null,dragging=false;
  document.addEventListener('touchstart',function(e){
    var el=e.target.closest('.sheet');
    if(!el)return;
    sheet=el;overlay=el.closest('.overlay');
    startY=e.touches[0].clientY;
    startScroll=sheet.scrollTop;
    dragging=true;
    sheet.style.transition='none';
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!dragging||!sheet)return;
    var dy=e.touches[0].clientY-startY;
    // Only swipe down when at top of scroll
    if(dy>0&&sheet.scrollTop<=0){
      sheet.style.transform='translateY('+Math.min(dy,300)+'px)';
      if(overlay)overlay.style.background='rgba(0,0,0,'+Math.max(0,.45-dy/400)+')';
    }
  },{passive:true});
  document.addEventListener('touchend',function(e){
    if(!dragging||!sheet)return;
    dragging=false;
    var dy=e.changedTouches[0].clientY-startY;
    sheet.style.transition='transform .2s ease';
    if(dy>80){
      // Close
      sheet.style.transform='translateY(100%)';
      if(overlay)overlay.style.transition='background .2s ease';
      if(overlay)overlay.style.background='rgba(0,0,0,0)';
      setTimeout(closeModal,200);
    }else{
      sheet.style.transform='';
      if(overlay)overlay.style.background='';
    }
    sheet=null;overlay=null;
  },{passive:true});
})();

// ================================================================
// ECHANGE COLLEGUE
// ================================================================
// Vacations valides par type de jour (pour le jour que l'on PREND)
