// app_cycle.js v4.08

var EX_VACS={
  week:['A1','A2','A3','B1','C1','C2','D1','D2','P423'],
  sat: ['As1','As2','As3','Cs','Es','Fs'],
  sun: ['Ad1','Ad2','Ad3','Cd','Ed','Fd'],
};
function exVacsForDay(date){
  const dw=date.getDay();
  if(dw===6)return EX_VACS.sat;
  if(dw===0)return EX_VACS.sun;
  return EX_VACS.week;
}
// Rendus generés pour une vacation d'échange :
// - Ferié travaillé : OUI (+200%)
// - Dimanche travaillé : OUI (+50%)
// - RH travaillé : NON (pas de rendu RH en échange)
// - HS : NON (échange = pas de HS)
function renduFactorÉchange(date){
  const key=dk(date),isFer=FERIES.has(key),isDim=date.getDay()===0;
  const sett=settingsForYM(date.getFullYear()*12+date.getMonth());
  let f=0;
  if(isFer&&sett.ferRendu){f+=2.0;if(isDim&&sett.dimRendu)f+=0.5;}
  else if(isDim&&sett.dimRendu){f+=0.5;}
  // RH : pas de rendu en cas d'échange
  return f;
}

var _exState={step:1,targetKey:null,targetVac:null}; // step 1=choisir jour, 2=choisir vacation

function openExchange(key){
  pendingKey=key;_lpk=key;
  _exState={step:1,targetKey:null,targetVac:null};
  renderExchangeModal();
}

function renderExchangeModal(){
  const myKey=pendingKey||_lpk;
  const date=new Date(myKey+'T12:00:00');
  const mon=getMonday(date);
  const weekDays=[];for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);weekDays.push(d);}

  // Étape 1: grille des jours
  const dayBtns=weekDays.map(d=>{
    const dk2=dk(d),isCurrent=dk2===myKey,isSel=dk2===_exState.targetKey;
    const dw=d.getDay();
    const dayName=['D','L','Ma','Me','J','V','S'][dw];
    const{vac:cv2}=getVac(d);
    return '<div class="exchange-day'+(isCurrent?' current':isSel?' sel':'')+'" data-exday="'+dk2+'">'
      +'<div class="exc-day-n">'+dayName+' '+d.getDate()+'</div>'
      +'<div class="exc-day-v">'+(cv2||'+')+'</div>'
      +'</div>';
  }).join('');

  // Étape 2: grille des vacations du jour cible
  var vacGrid='';
  if(_exState.step===2&&_exState.targetKey){
    const tDate=new Date(_exState.targetKey+'T12:00:00');
    const dw=tDate.getDay();
    const VAC=getVAC();
    const exGridCols=(dw===0||dw===6)?3:4;
    var exRows;
    if(dw===6)exRows=[['As1','As2','As3'],['Cs','Es','Fs'],['SV','Vac. perso','Autre']];
    else if(dw===0)exRows=[['Ad1','Ad2','Ad3'],['Cd','Ed','Fd'],['SV','Vac. perso','Autre']];
    else exRows=[['A1','A2','A3','B1'],['C1','C2','D1','D2'],['P423'],['SV','Vac. perso','Autre']];
    const customVacs=Object.keys(S.customVacs||{}).filter(function(v){return !(S.customVacs[v].hidden);});
    if(customVacs.length)exRows.splice(exRows.length-1,0,customVacs);
    const allExVns=[];exRows.forEach(function(row){row.forEach(function(vn){allExVns.push(vn);});});
    let exVgHtml='<div style="display:grid;grid-template-columns:repeat('+exGridCols+',1fr);gap:8px;margin-bottom:6px">';
    allExVns.forEach(function(vn){
      if(vn==='Autre'){
        exVgHtml+='<button style="padding:8px 4px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);cursor:pointer;text-align:center;font-weight:500;" onclick="_lpk=_exState.targetKey;pendingKey=_exState.targetKey;openAutreVacModal()">Autre</button>';
      } else if(vn==='Vac. perso'){
        exVgHtml+='<button style="padding:8px 4px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);cursor:pointer;text-align:center;font-weight:500;" onclick="openCustomVacModal()">Perso</button>';
      } else if(vn==='SV'){
        exVgHtml+='<button style="padding:8px 4px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);cursor:pointer;text-align:center;font-weight:500;" data-exvac="SV">SV</button>';
      } else {
        const vi=VAC[vn],dur=vi?vi.dur:0;
        const bg=vi&&vi.dur>0?'var(--blue-l)':'var(--bg2)',cl=vi&&vi.dur>0?'var(--blue)':'var(--text)';
        const durLbl=vi&&vi.dur>0?'<div style="font-size:9px;opacity:.7">'+fmtMin(dur)+'</div>':'';
        exVgHtml+='<button class="mb" style="background:'+bg+';color:'+cl+'" data-exvac="'+vn+'"><div>'+vn+'</div>'+durLbl+'</button>';
      }
    });
    exVgHtml+='</div>';
    vacGrid='<div style="margin-top:10px" id="ex-vac-grid">'+exVgHtml+'</div>';
  }

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Échange collègue</div>'
    +'<div class="exchange-days" id="ex-day-grid">'+dayBtns+'</div>'
    +vacGrid
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';

  setTimeout(function(){
    const dg=document.getElementById('ex-day-grid');
    if(dg)dg.onclick=function(e){const b=e.target.closest('[data-exday]');if(b)exSelectDay(b.dataset.exday);};
    const vg=document.getElementById('ex-vac-grid');
    if(vg)vg.onclick=function(e){const b=e.target.closest('[data-exvac]');if(b)exSelectVac(b.dataset.exvac);};
  },0);
}

function exSelectDay(dk2){
  if(dk2===(pendingKey||_lpk))return;
  _exState.targetKey=dk2;
  _exState.step=2;
  _exState.targetVac=null;
  renderExchangeModal();
}
function exGoStep2(){if(!_exState.targetKey)return;_exState.step=2;renderExchangeModal();}
function exBackStep1(){_exState.step=1;renderExchangeModal();}
function exSelectVac(vn){
  _exState.targetVac=vn;
  // Show HS toggle before confirming
  var myKey=pendingKey||_lpk;
  var VAC=getVAC();
  var durInfo='';
  // No HS toggle when chosen vacation is SV
  const isExSelSV=vn==='SV';
  var myCv=myKey?getCycleVac(new Date(myKey+'T12:00:00')).cycleVac:null;
  if(myKey){
    var myDate=new Date(myKey+'T12:00:00');
    var myDur=VAC[getVac(myDate).vac]?VAC[getVac(myDate).vac].dur:0;
    var newDur=VAC[vn]?VAC[vn].dur:0;
    var diff=newDur-myDur;
    if(diff>0)durInfo='<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Jour pris\u00a0: '+vn+' (+'+fmtMin(diff)+' vs jour donn\u00e9)</div>';
  }
  const exHsToggle=isExSelSV?'':
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:0.5px solid var(--border)">'
    +'<span style="font-size:13px;color:var(--text2)">Génère des HS</span>'
    +'<label class="tgl"><input type="checkbox" id="hs-toggle-ex"><span class="tgl-s"></span></label>'
    +'</div>';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">\u00c9change — '+vn+'</div>'
    +durInfo+exHsToggle
    +'<button class="mb wide" style="margin-top:8px" onclick="confirmExchange()">Confirmer</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
}
function confirmExchange(){
  var myKey=pendingKey||_lpk;
  if(!myKey||!_exState.targetKey||!_exState.targetVac)return;
  var date=new Date(myKey+'T12:00:00');
  var targetDate=new Date(_exState.targetKey+'T12:00:00');
  var myCycle=getCycleVac(date).cycleVac;
  var theirCycle=getCycleVac(targetDate).cycleVac;
  // Read my original vac BEFORE any override changes
  var myOrigVac=getVac(date);
  var myOrigVacName=myOrigVac.vac||myCycle;
  var hsEx=document.getElementById('hs-toggle-ex')?document.getElementById('hs-toggle-ex').checked:false;
  if(!S.overrides)S.overrides={};
  // myKey: mon jour original que je DONNE au collègue → je suis absent (gris)
  S.overrides[myKey]={vac:myOrigVacName,fromSV:false,echange:true,ecSelf:false,hs:hsEx};
  // targetKey: le jour que je PRENDS → je travaille la nouvelle vacation (orange)
  S.overrides[_exState.targetKey]={vac:_exState.targetVac,fromSV:!theirCycle||theirCycle==='RH',echange:true,ecSelf:true,hs:hsEx};
  logH('Échange: '+fmtDate(date)+' <-> '+fmtDate(targetDate)+' ('+_exState.targetVac+(hsEx?' HS':'')+')', '#d4a030', myKey);
  saveState();closeModal();render();
  if(gcalTokens){if(pendingKey)_gcalPendingDates.add(pendingKey);gcalTriggerTargeted();}
}


function toggleDropdown(id){
  const el=document.getElementById(id);if(!el)return;
  const wasOpen=el.style.display!=='none';
  document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');
  document.removeEventListener('click',_ddClose,true);
  if(!wasOpen){
    el.style.display='block';
    if(id==='dd-profil'){renderProfilesDropdown();gcalUpdateBtn();}
    if(id==='dd-history')renderHistoryDropdown();
    setTimeout(()=>document.addEventListener('click',_ddClose,true),10);
  }
}
function _ddClose(e){
  const dds=document.querySelectorAll('.dropdown');
  let anyOpen=false;
  let closed=false;
  dds.forEach(d=>{
    if(d.style.display!=='none'){
      anyOpen=true;
      if(!d.contains(e.target)&&!e.target.closest('[onclick*="toggleDropdown"]')){
        d.style.display='none';
        closed=true;
      }
    }
  });
  // If we just closed a dropdown, stop the click from opening modals
  if(closed){e.stopPropagation();e.preventDefault();}
  if(!anyOpen)document.removeEventListener('click',_ddClose,true);
}
