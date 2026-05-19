// app_profile.js v4.08

function renderProfilesDropdown(){
  function mkToggle(id,label,checked,history,key,pid){
    var hid='th-'+key+'-'+pid;
    var histBtn='';
    if(key&&pid){
      histBtn='<button data-key="'+key+'" data-pid="'+pid+'" onmousedown="event.preventDefault();toggleHistPanel(this)" style="background:transparent;border:none;color:var(--text3);font-size:11px;cursor:pointer;padding:0 4px;margin-right:4px"><i class="ti ti-history" style="font-size:11px"></i></button>';
    }
    var pidAttr=pid?' data-pid="'+pid+'" onchange="applySettingsFromDD(this.dataset.pid)"':'';
    return '<div class="srow" style="padding:5px 0"><div class="slbl" style="font-size:12px">'+label+'</div>'
      +'<div style="display:flex;align-items:center">'+histBtn+'<label class="tgl"><input type="checkbox" id="'+id+'"'+(checked?' checked':'')+pidAttr+'><span class="tgl-s"></span></label></div></div>';
  }

  var actD='';
  var list=getProfiles().map(function(p){
    var isAct=p.id===_aid;
    var pr=_profs[p.id];
    var ss=pr&&pr.settings?pr.settings:{};
    if(isAct){
      // Options in fixed cycle order (CYCLE[0] to CYCLE[13])
      // Selected = the line the user is on THIS week
      var _diff=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
      var _curVisual=((pr.profile.anchorLine!==undefined?pr.profile.anchorLine:ANCHOR_L)+_diff+ getCycleLen(NOW)*1000)%getCycleLen(NOW);
      var lineOpts=Array.from({length:14},function(_,i){
        return '<option value="'+i+'"'+(i===_curVisual?' selected':'')+'>'+formatLineOption(i)+'</option>';
      }).join('');
      actD='<div id="ps-panel" class="ps-panel">'
        // ── SECTION PROFIL ──
        +'<div '+'style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;margin-top:12px;padding-bottom:4px;border-bottom:0.5px solid var(--border)"'+'>Profil</div>'
        +'<div class="mrow" style="margin-bottom:6px"><label style="font-size:10px;color:var(--text3)">Nom</label>'
        +'<input id="ps-name" value="'+(pr.profile.name||'')+'" '+'style="height:40px;box-sizing:border-box;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--bg2);color:var(--text);width:100%;box-sizing:border-box"'+' ></div>'
        +'<div class="mrow" style="margin-bottom:6px"><label style="font-size:10px;color:var(--text3)">Ligne actuelle : S'+_curVisual+'</label>'
        +'<button class="mb" style="width:100%;height:40px;background:var(--bg2);color:var(--text);border:0.5px solid var(--border)" data-pid="'+p.id+'" onclick="openChangeLigneModal(this.dataset.pid)">Changer de ligne</button></div>'
        +'<div class="mr2" style="margin-bottom:6px">'
        +'<div><label style="font-size:10px;color:var(--text3)">Matelas</label>'
        +'<input id="ps-matelas" value="'+fmtMin(pr.profile.matelas||0)+'" '+'style="height:40px;box-sizing:border-box;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--bg2);color:var(--text);width:100%"'+' ></div>'
        +'<div><label style="font-size:10px;color:var(--text3)">Congés / an</label>'
        +'<input id="ps-conges" type="number" value="'+(pr.profile.congesInit||25)+'" '+'style="height:40px;box-sizing:border-box;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--bg2);color:var(--text);width:100%;-webkit-appearance:none"'+' ></div>'
        +'</div>'
        +'<div style="margin-bottom:6px;">'
        +'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Stock initial éphem.</label>'
        +'<div style="display:flex;gap:8px;">'
        +'<input id="ps-eph" value="'+fmtMin(Math.round((pr.profile.ephSolde||0)*60))+'" '+'style="height:40px;box-sizing:border-box;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--bg2);color:var(--text);flex:1;min-width:0" >'
        +'<button class="mb" style="padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;flex:1;height:40px;box-sizing:border-box;background:var(--blue);color:#fff;white-space:nowrap" data-pid="'+p.id+'" onclick="saveProfileFromDD(this.dataset.pid)">Enregistrer</button>'
        +'</div>'
        +'</div>'
        // ── SECTION GÉNÉRATION DES RENDUS ──
        +'<div '+'style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;margin-top:12px;padding-bottom:4px;border-bottom:0.5px solid var(--border)"'+'>Génération des rendus (M+1)</div>'
        +mkToggle('ps-dim','Dimanches',computeSettForProfile(pr,TODAY_YM+1,'dimRendu'),pr.settings&&pr.settings.settingsHistory,'dimRendu',p.id)
        +mkToggle('ps-rh','RH travaillés',computeSettForProfile(pr,TODAY_YM+1,'rhRendu'),pr.settings&&pr.settings.settingsHistory,'rhRendu',p.id)
        +mkToggle('ps-fer','Fériés travaillés',computeSettForProfile(pr,TODAY_YM+1,'ferRendu'),pr.settings&&pr.settings.settingsHistory,'ferRendu',p.id)
        +mkToggle('ps-hs','Heures sup.',computeSettForProfile(pr,TODAY_YM+1,'hsRendu'),pr.settings&&pr.settings.settingsHistory,'hsRendu',p.id)
        // ── SECTION GOOGLE AGENDA ──
        +'<div '+'style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;margin-top:12px;padding-bottom:4px;border-bottom:0.5px solid var(--border)"'+'>Google Agenda</div>'
        +'<button id="gcal-btn" class="mb" style="font-size:11px;padding:8px;width:100%;color:var(--text3);margin-bottom:4px" onclick="gcalHandleClick()">Connecter à Google Agenda</button>'
        +'<div id="gcal-connected-btns" style="display:none;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">'
        +'<button id="gcal-sync-icon-btn" title="Synchroniser" class="mb" style="padding:10px;display:flex;align-items:center;justify-content:center;color:var(--text2)" onclick="gcalHandleClick()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 12A10 10 0 0 1 18.5 5.5l3 2.5"/><path d="M2.5 22v-6h6"/><path d="M21.5 12A10 10 0 0 1 5.5 18.5l-3-2.5"/></svg></button>'
        +'<button id="gcal-autosync-btn" title="Sync automatique" class="mb" style="padding:10px;display:flex;align-items:center;justify-content:center;color:var(--text2)" onclick="gcalToggleAutoSync()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 3"/></svg></button>'
        +'<button id="gcal-clear-btn" title="Effacer les événements" class="mb" style="padding:10px;display:flex;align-items:center;justify-content:center;color:var(--text2)" onclick="gcalClear()"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM3 6h18v2H3V6zm2 3h14l-1.5 12a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9L5 9z"/></svg></button>'
        +'<button id="gcal-disconnect-btn" title="Déconnecter" class="mb" style="padding:10px;display:flex;align-items:center;justify-content:center;color:var(--text2)" onclick="gcalDisconnect()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>'
        +'</div>'
        +'</div></div>';
    }
    var delBtn=p.id!=='default'?'<button class="pdel" data-pid="'+p.id+'" onclick="event.stopPropagation();deleteProfileDD(this.dataset.pid)">x</button>':'';
    var gearBtn='';
    var clickAttr=!isAct?'data-pid="'+p.id+'" onclick="switchToProfile(this.dataset.pid)"':'';
    return '<div class="pit-wrap">'      +'<div class="pit'+(isAct?' act':'')+'" '+clickAttr+' style="cursor:'+(isAct?'default':'pointer')+'">'      +'<div class="pname">'+p.name+'</div>'      +'<div style="display:flex;gap:2px">'+gearBtn+delBtn+'</div>'      +'</div>'      +actD      +'</div>';
  }).join('');

  var npToggles=''
    +mkToggle('np-dim','Dimanches',true)
    +mkToggle('np-rh','RH travaillés',true)
    +mkToggle('np-fer','Fériés travaillés',true)
    +mkToggle('np-hs','Heures sup.',true);

  var lineSelNP='';
  for(var i=0;i<14;i++){
    lineSelNP+='<option value="'+i+'">'+formatLineOption(i)+'</option>';
  }

  document.getElementById('dd-profil-content').innerHTML=
    actD
    +'<div class="sep"></div>'
   +'<div style="display:flex;gap:4px;margin-top:10px;padding:0 10px 10px">'
    +'<button class="mb" style="font-size:11px;flex:1;height:40px;box-sizing:border-box;padding:0 12px;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;gap:6px" onclick="signOut()"><i class="ti ti-logout" style="font-size:13px"></i>Changer</button>'
    +(Object.keys(_profs).length>1?'<button class="mb" style="font-size:11px;flex:1;height:40px;box-sizing:border-box;padding:0 12px;color:var(--rendu-red-text);display:flex;align-items:center;justify-content:center;gap:4px" onclick="deleteCurrentProfile()"><i class="ti ti-trash" style="font-size:13px"></i>Supprimer</button>':'')
    +'</div>'
    +'<div class="np-body" id="np-body" style="display:none"><div style="height:10px"></div>'
    +'<div class="mr2"><div><label>Nom</label><input id="np-name" placeholder=""></div><div><label>Congés / an</label><input id="np-conges" type="number" value="25"></div></div>'
    +'<div class="mr2"><div><label>Matelas (heures)</label><input id="np-matelas" placeholder=""></div><div><label>Rendus éphem. initiaux</label><input id="np-eph" placeholder=""></div></div>'
    +'<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Génération des rendus</div>'
    +npToggles
    +'<div id="np-lines-section" style="margin-top:10px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Ligne (les lignes prises sont grisées)</div><div id="np-lines-list" style="font-size:11px;color:var(--text3)">Chargement...</div></div>'
    +'<button class="mb pri wide" style="margin-top:8px" onclick="confirmNewProfile()">Créer le profil</button>'
    +'</div>';
}


function togglePsPanel(){} // ps-panel always visible

function saveProfileFromDD(pid){
  const pr=_profs[pid];if(!pr)return;
  // Read oldLine BEFORE modifying pr (pr is a reference to _profs[pid])
  const oldLine=pr.profile&&pr.profile.anchorLine;
  const n=document.getElementById('ps-name');if(n)pr.profile.name=n.value.trim()||pr.profile.name;
  // Line is now changed via openChangeLigneModal
  const mat=document.getElementById('ps-matelas');if(mat&&mat.value.trim()){const v=parseHM(mat.value);if(v>=0)pr.profile.matelas=v;}
  const cg=document.getElementById('ps-conges');if(cg){const v=parseInt(cg.value);if(!isNaN(v))pr.profile.congesInit=v;}
  const eph2=document.getElementById('ps-eph');if(eph2&&eph2.value.trim()){const ev=parseHM(eph2.value);pr.profile.ephSolde=Math.round(ev/60*100)/100;pr.profile.ephSoldeCreatedYM=TODAY_YM;}
  const newLine=pr.profile.anchorLine;
  _profs[pid]=pr;if(pid===_aid)S=pr;saveState();render();renderProfilesDropdown();gcalUpdateBtn();
  const _hpn=document.getElementById('hdr-profile-name');if(_hpn&&S.profile)_hpn.textContent=S.profile.name||'Profil';
}
function applySettingsFromDD(pid){
  const pr=_profs[pid];if(!pr)return;if(!pr.settings)pr.settings={};
  const dimEl=document.getElementById('ps-dim'),rhEl=document.getElementById('ps-rh');
  const ferEl=document.getElementById('ps-fer'),hsEl=document.getElementById('ps-hs');
  if(!dimEl)return;
  const newDim=dimEl.checked,newRh=rhEl?rhEl.checked:true,newFer=ferEl?ferEl.checked:true,newHs=hsEl?hsEl.checked:true;

  // M+1 since date
  const now=new Date();let sy=now.getFullYear(),sm=now.getMonth()+2;
  if(sm>12){sy++;sm=1;}
  const nextYM=sy*12+(sm-1);
  const since=sy+'-'+String(sm).padStart(2,'0');

  if(!pr.settings.settingsHistory)pr.settings.settingsHistory=[];

  // What are the current month's effective settings?
  const curEff=settingsForYM(TODAY_YM);
  const newMatchesCurrent=curEff.dimRendu===newDim&&curEff.rhRendu===newRh&&curEff.ferRendu===newFer&&curEff.hsRendu===newHs;

  if(newMatchesCurrent){
    // Cancel: remove any pending future entry for M+1
    pr.settings.settingsHistory=pr.settings.settingsHistory.filter(h=>{
      const hym=parseInt(h.since.split('-')[0])*12+(parseInt(h.since.split('-')[1])-1);
      return hym!==nextYM;
    });
  } else {
    // Apply change: upsert entry for M+1
    pr.settings.settingsHistory=pr.settings.settingsHistory.filter(h=>h.since!==since);
    pr.settings.settingsHistory.push({since,dimRendu:newDim,rhRendu:newRh,ferRendu:newFer,hsRendu:newHs});
    pr.settings.settingsHistory.sort((a,b)=>a.since.localeCompare(b.since));
    // Keep max 6 entries (preserve oldest = initial creation)
    if(pr.settings.settingsHistory.length>6){
      pr.settings.settingsHistory=pr.settings.settingsHistory.slice(-6);
    }
  }
  const oldLine=_profs[pid]&&_profs[pid].profile&&_profs[pid].profile.anchorLine;
  const newLine=pr.profile.anchorLine;
  _profs[pid]=pr;if(pid===_aid)S=pr;saveState();render();renderProfilesDropdown();gcalUpdateBtn();
  const _hpn=document.getElementById('hdr-profile-name');if(_hpn&&S.profile)_hpn.textContent=S.profile.name||'Profil';
  // If line changed and Google connected, clear calendar then re-sync
  if(gcalTokens&&oldLine!==undefined&&oldLine!==newLine){
    if(confirm('La ligne a changé. Voulez-vous vider le calendrier Google et le re-synchroniser ?')){
      gcalClear().then(function(){setTimeout(gcalSync,500);});
    }
  }
}


// ================================================================
// INIT
// ================================================================
function switchToProfile(id){switchProfile(id);render();document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');document.removeEventListener('click',_ddClose,true);}

function toggleNP(){
  const b=document.getElementById('np-body');
  if(b){
    const isShowing=b.style.display==='none'||b.style.display==='';
    b.style.display=isShowing?'block':'none';
    if(isShowing)loadAvailableLines();
  }
}

async function loadAvailableLines(){
  const el=document.getElementById('np-lines-list');
  if(!el)return;
  try{
    const res=await fetch(CLOUD_API+'/lines/available',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({})});
    const data=await res.json();
    const taken=data.lines||{};
    // Use current cycle grid (KV or hardcoded)
    const grid=getActiveCycleGrid(NOW)||CYCLE;
    let html='<div style="display:flex;flex-direction:column;gap:3px"><input type="hidden" id="np-line" value="1">';
    grid.forEach(function(w,i){
      const display=w.map(function(v){return(!v||v==='RH')?'—':v;}).join(' ');
      const ligne=w.join(' ');
      const isTaken=taken[ligne]&&taken[ligne].length>0;
      const users=isTaken?taken[ligne].map(function(u){return u.userName||'?';}).join(', '):'';
      html+='<div class="np-line-opt" data-ligne="'+(i+1)+'" data-taken="'+(isTaken?'1':'0')+'" data-users="'+users+'" onclick="selectNPLine(this)" style="padding:6px 8px;border-radius:4px;cursor:pointer;font-size:12px;color:'+(isTaken?'var(--text3)':'var(--text)')+';opacity:'+(isTaken?'0.5':'1')+'">'+display+(isTaken?' <span style="font-size:10px;color:var(--text3)">('+users+')</span>':'')+'</div>';
    });
    html+='</div>';
    el.innerHTML=html;
  }catch(e){if(el)el.textContent='Impossible de charger les lignes';}
}

function selectNPLine(el){
  const isTaken=el.dataset.taken==='1';
  if(isTaken&&!confirm('Cette ligne est déjà prise par '+el.dataset.users+'. Confirmer quand même ?'))return;
  document.querySelectorAll('.np-line-opt').forEach(function(x){x.style.background='';});
  el.style.background='var(--bg3)';
  const inp=document.getElementById('np-line');
  if(inp)inp.value=el.dataset.ligne;
}

function openChangeLigneModal(pid){
  const pr=_profs[pid];if(!pr)return;
  const _diff=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
  const _curVisual=((pr.profile.anchorLine!==undefined?pr.profile.anchorLine:ANCHOR_L)+_diff+ getCycleLen(NOW)*1000)%getCycleLen(NOW);
  const today=dk(NOW);
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Changer de ligne</div>'
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:8px">Portée du changement</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer">'
    +'<input type="radio" name="cl-scope" value="total" checked onchange="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')"> Totale — efface toutes les modifications</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">'
    +'<input type="radio" name="cl-scope" value="from" onchange="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')"> À partir de'
    +'<input type="date" id="cl-date" value="'+today+'" oninput="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')" style="height:32px;padding:4px 8px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--bg2);color:var(--text);margin-left:4px">'
    +'</label>'
    +'</div>'
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px" id="cl-cycle-lbl"></label>'
    +'<select id="cl-line" style="height:40px;width:100%;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--bg2);color:var(--text);-webkit-appearance:none"></select>'
    +'</div>'
    +'<button class="mb wide" style="background:var(--blue);color:#fff;margin-top:8px" onclick="confirmChangeLigne(\''+pid+'\')">Confirmer</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
  // Initial population
  updateChangeLigneSelect(pid, _curVisual);
}

function updateChangeLigneSelect(pid, curVisual){
  const scope=[...document.querySelectorAll('input[name="cl-scope"]')].find(function(r){return r.checked;});
  const scopeVal=scope?scope.value:'total';
  const fromDate=scopeVal==='from'?(document.getElementById('cl-date')||{value:dk(NOW)}).value:dk(NOW);
  // Get the grid for the target date
  const targetDate=new Date(fromDate+'T12:00:00');
  const kvGrid=getActiveCycleGrid(targetDate);
  const grid=kvGrid||CYCLE;
  const nLines=grid.length;
  // Find current visual line at target date
  const _diffTarget=Math.round((getMonday(targetDate)-ANCHOR)/(7*864e5));
  const pr=_profs[pid];
  const _al=pr&&pr.profile&&pr.profile.anchorLine!==undefined?pr.profile.anchorLine:ANCHOR_L;
  const _curAtTarget=((_al+_diffTarget)%nLines+nLines)%nLines;
  // Find active cycle name
  const activeCyc=_globalCycles.find(function(c){
    const k=fromDate;return c.startDate<=k&&(!c.endDate||c.endDate>=k);
  });
  const lbl=document.getElementById('cl-cycle-lbl');
  if(lbl)lbl.textContent='Ligne dans '+(activeCyc?activeCyc.name:'le cycle actuel');
  const sel=document.getElementById('cl-line');
  if(!sel)return;
  sel.innerHTML=Array.from({length:nLines},function(_,i){
    const w=grid[i]||[];
    const summary=w.map(function(v){return(!v||v==='RH')?'—':v;}).join(' ');
    const isCur=i===_curAtTarget;
    return '<option value="'+i+'"'+(isCur?' selected':'')+'>'+summary+'</option>';
  }).join('');
}

function confirmChangeLigne(pid){
  const pr=_profs[pid];if(!pr)return;
  const li=document.getElementById('cl-line');if(!li)return;
  const scope=[...document.querySelectorAll('input[name="cl-scope"]')].find(function(r){return r.checked;});
  const scopeVal=scope?scope.value:'total';
  const fromDate=scopeVal==='from'?(document.getElementById('cl-date')||{value:''}).value:'';

  const _chosenVisual=parseInt(li.value);

  if(scopeVal==='total'){
    // Check if same as current line
    const _diffNow=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
    const _curVisual=((pr.profile.anchorLine!==undefined?pr.profile.anchorLine:ANCHOR_L)+_diffNow+ getCycleLen(NOW)*1000)%getCycleLen(NOW);
    if(_curVisual===_chosenVisual&&!(pr.profile.lineHistory&&pr.profile.lineHistory.length)){
      alert('Cette ligne est déjà votre ligne actuelle.');return;
    }
    // anchorLine: want chosenVisual at NOW week
    const newAnchor=((_chosenVisual-_diffNow)%_N+_N)%_N;
    pr.profile.anchorLine=newAnchor;
    pr.profile.lineHistory=[];
    delete pr.profile.origAnchor;
    pr.overrides={};
    pr.conges={};
  } else {
    if(!fromDate){alert('Date requise.');return;}
    // anchorLine: want chosenVisual at fromDate week
    const _fromMonday=getMonday(new Date(fromDate+'T12:00:00'));
    const _diffFrom=Math.round((_fromMonday-ANCHOR)/(7*864e5));
    const newAnchor=((_chosenVisual-_diffFrom)%_N2+_N2)%_N2;
    if(!pr.profile.lineHistory)pr.profile.lineHistory=[];
    // Save origAnchor before first change
    if(pr.profile.origAnchor===undefined)pr.profile.origAnchor=pr.profile.anchorLine;
    // Remove entries from this date onwards
    pr.profile.lineHistory=pr.profile.lineHistory.filter(function(h){return h.from<fromDate;});
    pr.profile.lineHistory.push({anchorLine:newAnchor,from:fromDate});
    pr.profile.lineHistory.sort(function(a,b){return a.from<b.from?-1:1;});
    // Update anchorLine to latest entry
    pr.profile.anchorLine=pr.profile.lineHistory[pr.profile.lineHistory.length-1].anchorLine;
    // Clear overrides + conges from fromDate onwards
    const _fromTs=_fromMonday.getTime();
    Object.keys(pr.overrides||{}).forEach(function(k){if(new Date(k+'T00:00:00').getTime()>=_fromTs)delete pr.overrides[k];});
    Object.keys(pr.conges||{}).forEach(function(k){if(new Date(k+'T00:00:00').getTime()>=_fromTs)delete pr.conges[k];});
  }

  _profs[pid]=pr;if(pid===_aid)S=pr;
  saveState();closeModal();render();renderProfilesDropdown();gcalUpdateBtn();
  if(gcalTokens){
    if(confirm('La ligne a changé. Vider le calendrier Google et re-synchroniser ?')){
      gcalClear().then(function(){setTimeout(gcalSync,500);});
    }
  }
}

function getCycleVacWithHistory(date,pr){
  if(!pr||!pr.profile||!pr.profile.lineHistory||!pr.profile.lineHistory.length)return null;
  const key=dk(date);
  // Find the most recent line change that is <= date
  let best=null;
  pr.profile.lineHistory.forEach(function(h){
    if(h.from<=key){if(!best||h.from>best.from)best=h;}
  });
  return best?best.anchorLine:null;
}

function openChangeLigneModal2(pid){openChangeLigneModal(pid);}



function confirmNewProfile(){
  const name=(document.getElementById('np-name')||{value:''}).value.trim();
  if(!name){alert('Nom requis.');return;}
  const id='p_'+Date.now(),d=DEFAULT_PD();
  d.profile.name=capitalize(name);
  const matStr=(document.getElementById('np-matelas')||{value:''}).value.trim();d.profile.matelas=matStr?parseHM(matStr):0;
  const eph=parseHM((document.getElementById('np-eph')||{value:''}).value);
  d.profile.ephSolde=eph>0?Math.round(eph/60*100)/100:0;d.profile.ephSoldeCreatedYM=TODAY_YM;
  const cg=parseInt((document.getElementById('np-conges')||{value:'25'}).value);if(!isNaN(cg))d.profile.congesInit=cg;
  const chosenLine=parseInt((document.getElementById('np-line')||{value:'9'}).value)||9;
  const diff=weeksDiff(NOW);
  // chosenLine is 1-based (S1=1), convert to 0-based index
  const _Nnp=getCycleLen(NOW);let anchorLine=((chosenLine-1)-diff)%_Nnp;if(anchorLine<0)anchorLine+=_Nnp;
  d.profile.anchorLine=anchorLine;
  d.settings.dimRendu=(document.getElementById('np-dim')||{checked:true}).checked;
  d.settings.rhRendu=(document.getElementById('np-rh')||{checked:true}).checked;
  d.settings.ferRendu=(document.getElementById('np-fer')||{checked:true}).checked;
  d.settings.hsRendu=(document.getElementById('np-hs')||{checked:true}).checked;
  d.settings.theme=(S.settings&&S.settings.theme)||'dark';
  createProfile(id,d);switchProfile(id);render();document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');document.removeEventListener('click',_ddClose,true);
}

function deleteProfileDD(id){
  const name=(_profs[id]&&_profs[id].profile)?capitalize(_profs[id].profile.name):'ce profil';
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay"><div class="sheet" style="max-height:220px"><div class="sh"></div>'
    +'<div class="st">Supprimer '+name+' ?</div>'
    +'<div class="ss" style="margin-bottom:16px">Toutes les données seront perdues.</div>'
    +'<div class="mbtns">'
    +'<button class="mb" onclick="closeModal();renderProfilesDropdown()">Annuler</button>'
    +'<button class="mb del" data-pid="'+id+'" onclick="confirmDeleteProfile(this.dataset.pid)">Supprimer</button>'
    +'</div></div></div>';
}

function confirmDeleteProfile(id){deleteProfile(id);closeModal();renderProfilesDropdown();render();}


function formatLineOption(idx,grid){
  const lineData=(grid||CYCLE)[idx];
  if(!lineData)return'—';
  return lineData.map(function(v){return(!v||v==='RH')?'—':v;}).join(' ');
}

function weeksDiff(date){
  return Math.round((getMonday(date)-ANCHOR)/(7*864e5));
}

function coversMealSlot(debMin,finMin){
  return(debMin<=690&&finMin>=870)||(debMin<=1110&&finMin>=1290);
}

function openCustomVacModal(){
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this){if(pendingKey)openDay(pendingKey);else closeModal();}"><div class="sheet"><div class="sh"></div><div class="st">Vacation personnalisée</div>'
    +'<div class="mrow"><label>Nom</label><input id="custom-name" placeholder=""></div>'
    +'<div class="mr2"><div><label>Début</label><select id="custom-deb" style="padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:14px;background:var(--bg2);color:var(--text);width:100%;-webkit-appearance:none;"><option value="00h00">00h00</option><option value="00h15">00h15</option><option value="00h30">00h30</option><option value="00h45">00h45</option><option value="01h00">01h00</option><option value="01h15">01h15</option><option value="01h30">01h30</option><option value="01h45">01h45</option><option value="02h00">02h00</option><option value="02h15">02h15</option><option value="02h30">02h30</option><option value="02h45">02h45</option><option value="03h00">03h00</option><option value="03h15">03h15</option><option value="03h30">03h30</option><option value="03h45">03h45</option><option value="04h00">04h00</option><option value="04h15">04h15</option><option value="04h30">04h30</option><option value="04h45">04h45</option><option value="05h00">05h00</option><option value="05h15">05h15</option><option value="05h30">05h30</option><option value="05h45">05h45</option><option value="06h00">06h00</option><option value="06h15">06h15</option><option value="06h30">06h30</option><option value="06h45">06h45</option><option value="07h00">07h00</option><option value="07h15">07h15</option><option value="07h30">07h30</option><option value="07h45">07h45</option><option value="08h00" selected>08h00</option><option value="08h15">08h15</option><option value="08h30">08h30</option><option value="08h45">08h45</option><option value="09h00">09h00</option><option value="09h15">09h15</option><option value="09h30">09h30</option><option value="09h45">09h45</option><option value="10h00">10h00</option><option value="10h15">10h15</option><option value="10h30">10h30</option><option value="10h45">10h45</option><option value="11h00">11h00</option><option value="11h15">11h15</option><option value="11h30">11h30</option><option value="11h45">11h45</option><option value="12h00">12h00</option><option value="12h15">12h15</option><option value="12h30">12h30</option><option value="12h45">12h45</option><option value="13h00">13h00</option><option value="13h15">13h15</option><option value="13h30">13h30</option><option value="13h45">13h45</option><option value="14h00">14h00</option><option value="14h15">14h15</option><option value="14h30">14h30</option><option value="14h45">14h45</option><option value="15h00">15h00</option><option value="15h15">15h15</option><option value="15h30">15h30</option><option value="15h45">15h45</option><option value="16h00">16h00</option><option value="16h15">16h15</option><option value="16h30">16h30</option><option value="16h45">16h45</option><option value="17h00">17h00</option><option value="17h15">17h15</option><option value="17h30">17h30</option><option value="17h45">17h45</option><option value="18h00">18h00</option><option value="18h15">18h15</option><option value="18h30">18h30</option><option value="18h45">18h45</option><option value="19h00">19h00</option><option value="19h15">19h15</option><option value="19h30">19h30</option><option value="19h45">19h45</option><option value="20h00">20h00</option><option value="20h15">20h15</option><option value="20h30">20h30</option><option value="20h45">20h45</option><option value="21h00">21h00</option><option value="21h15">21h15</option><option value="21h30">21h30</option><option value="21h45">21h45</option><option value="22h00">22h00</option><option value="22h15">22h15</option><option value="22h30">22h30</option><option value="22h45">22h45</option><option value="23h00">23h00</option><option value="23h15">23h15</option><option value="23h30">23h30</option><option value="23h45">23h45</option></select></div>'
    +'<div><label>Fin</label><select id="custom-fin" style="padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:14px;background:var(--bg2);color:var(--text);width:100%;-webkit-appearance:none;"><option value="00h00">00h00</option><option value="00h15">00h15</option><option value="00h30">00h30</option><option value="00h45">00h45</option><option value="01h00">01h00</option><option value="01h15">01h15</option><option value="01h30">01h30</option><option value="01h45">01h45</option><option value="02h00">02h00</option><option value="02h15">02h15</option><option value="02h30">02h30</option><option value="02h45">02h45</option><option value="03h00">03h00</option><option value="03h15">03h15</option><option value="03h30">03h30</option><option value="03h45">03h45</option><option value="04h00">04h00</option><option value="04h15">04h15</option><option value="04h30">04h30</option><option value="04h45">04h45</option><option value="05h00">05h00</option><option value="05h15">05h15</option><option value="05h30">05h30</option><option value="05h45">05h45</option><option value="06h00">06h00</option><option value="06h15">06h15</option><option value="06h30">06h30</option><option value="06h45">06h45</option><option value="07h00">07h00</option><option value="07h15">07h15</option><option value="07h30">07h30</option><option value="07h45">07h45</option><option value="08h00">08h00</option><option value="08h15">08h15</option><option value="08h30">08h30</option><option value="08h45">08h45</option><option value="09h00">09h00</option><option value="09h15">09h15</option><option value="09h30">09h30</option><option value="09h45">09h45</option><option value="10h00">10h00</option><option value="10h15">10h15</option><option value="10h30">10h30</option><option value="10h45">10h45</option><option value="11h00">11h00</option><option value="11h15">11h15</option><option value="11h30">11h30</option><option value="11h45">11h45</option><option value="12h00">12h00</option><option value="12h15">12h15</option><option value="12h30">12h30</option><option value="12h45">12h45</option><option value="13h00">13h00</option><option value="13h15">13h15</option><option value="13h30">13h30</option><option value="13h45">13h45</option><option value="14h00">14h00</option><option value="14h15">14h15</option><option value="14h30">14h30</option><option value="14h45">14h45</option><option value="15h00">15h00</option><option value="15h15">15h15</option><option value="15h30">15h30</option><option value="15h45">15h45</option><option value="16h00" selected>16h00</option><option value="16h15">16h15</option><option value="16h30">16h30</option><option value="16h45">16h45</option><option value="17h00">17h00</option><option value="17h15">17h15</option><option value="17h30">17h30</option><option value="17h45">17h45</option><option value="18h00">18h00</option><option value="18h15">18h15</option><option value="18h30">18h30</option><option value="18h45">18h45</option><option value="19h00">19h00</option><option value="19h15">19h15</option><option value="19h30">19h30</option><option value="19h45">19h45</option><option value="20h00">20h00</option><option value="20h15">20h15</option><option value="20h30">20h30</option><option value="20h45">20h45</option><option value="21h00">21h00</option><option value="21h15">21h15</option><option value="21h30">21h30</option><option value="21h45">21h45</option><option value="22h00">22h00</option><option value="22h15">22h15</option><option value="22h30">22h30</option><option value="22h45">22h45</option><option value="23h00">23h00</option><option value="23h15">23h15</option><option value="23h30">23h30</option><option value="23h45">23h45</option></select></div></div>'
    +'<div class="mrow" style="margin-bottom:30px"><label>Pause</label><select id="custom-pause" style="padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:14px;background:var(--bg2);color:var(--text);width:100%;-webkit-appearance:none;"><option value="0">Sans pause</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">1h00</option></select></div>'
    +'<div class="mbtns"><button class="mb" onclick="if(pendingKey)openDay(pendingKey);else closeModal()">Annuler</button><button class="mb pri" onclick="confirmCustomVac()">Créer</button></div>'
    +'</div></div>';
}

function confirmCustomVac(){
  const name=(document.getElementById('custom-name')||{value:''}).value.trim();
  if(!name){alert('Nom requis');return;}
  const debStr=(document.getElementById('custom-deb')||{value:''}).value.trim();
  const finStr=(document.getElementById('custom-fin')||{value:''}).value.trim();
  const pauseMin=parseInt((document.getElementById('custom-pause')||{value:'0'}).value)||0;
  const debMin=parseHM(debStr),finMin=parseHM(finStr);
  if(!debMin||!finMin){alert('Heures invalides (format 08h00)');return;}
  let dur=finMin-debMin;let panier=false;
  if(pauseMin>=45){dur-=pauseMin;}else{if(coversMealSlot(debMin,finMin))panier=true;}
  if(dur<=0){alert('Duree invalide');return;}
  // Store in customVacs for dur/panier lookup, but not displayed in grid
  if(!S.customVacs)S.customVacs={};
  S.customVacs[name]={deb:debStr,fin:finStr,dur,panier,hidden:true};
  // Apply directly via avw to get the HS toggle
  saveState();render();
  if(pendingKey){avw(name);return;}
  closeModal();
}

function openAutreVacModal(){
  const VAC=getVAC();
  const key=pendingKey||_lpk;
  const dw=key?new Date(key+'T12:00:00').getDay():1;
  const isSam=dw===6,isDim=dw===0,isWeek=!isSam&&!isDim;

  function vacBtn(vn){
    const vi=VAC[vn];const dur=vi?vi.dur:0;
    return '<button class="mb" style="background:var(--blue-l);color:var(--blue);border:0.5px solid var(--border);width:100%;" onclick="avw(\''+vn+'\')">'
      +'<div>'+vn+'</div>'
      +'<div style="font-size:9px;opacity:.7">'+fmtMin(dur)+'</div>'
      +'</button>';
  }
  function debMin(vn){const v=VAC[vn];if(!v)return 9999;const m=v.deb.match(/(\d+)h(\d*)/i);return m?parseInt(m[1])*60+(parseInt(m[2])||0):9999;}
  function section(title,vns){
    if(!vns.length)return'';
    const sorted=vns.slice().sort((a,b)=>debMin(a)-debMin(b));
    return'<div class="btit" style="margin-top:8px;margin-bottom:5px">'+title+'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px">'
      +sorted.map(vacBtn).join('')+'</div>';
  }

  // Coord: M lun-ven, S tous les jours, Pj jeudi seul, Pv vendredi seul
  const coordVacs=[];
  if(isWeek||isSam||isDim)coordVacs.push('S');  // S dispo tous les jours
  if(isWeek)coordVacs.push('M');                 // M lun-ven
  if(dw===4)coordVacs.push('Pj');               // Pj jeudi seulement
  if(dw===5)coordVacs.push('Pv');               // Pv vendredi seulement
  // Video: MR+SR en semaine, Ms-R le sam, Md-R le dim
  const videoVacs=isWeek?['MR','SR']:isSam?['Ms-R']:['Md-R'];
  // Cadre: semaine=B2V C3V P422V; sam=BsV Ds; dim=BdV Dd
  const cadreVacs=isWeek?['B2V','C3V','P422V']:isSam?['BsV','Ds']:['BdV','Dd'];

  const html=section('Coordination',coordVacs)
    +section('Video',videoVacs)
    +section('Cadre',cadreVacs);

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Autres vacations</div>'
    +(html||'<div style="font-size:12px;color:var(--text3);padding:10px 0">Aucune vacation disponible ce jour.</div>')
    +'<button class="mcancel" onclick="if(pendingKey)openDay(pendingKey);else closeModal()">Retour</button>'
    +'</div></div>';
}
