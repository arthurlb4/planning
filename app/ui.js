// Interface (contenu des pages, fiche du jour, Modifier…) et mécanique iPhone. Chargé après core.js.
// Téléphone : écran étroit, ou écran tactile peu haut (iPhone tourné à l'horizontale) — même règle que @media de style.css
function _isPhone(){return innerWidth<=720||(innerHeight<=500&&!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches));}
function _isLand(){return _isPhone()&&innerWidth>innerHeight;}

var _appVer=(document.querySelector('meta[name="app-version"]')||{}).content||''; // une seule source : la balise app-version

var BASE=location.pathname.indexOf('/planning/')===0?'/planning/':'/'; // ancienne adresse (GitHub Pages, sous /planning/) ou domaine de l'app (à la racine)
 // adresse de retour enregistrée chez Google ; depuis franceinfoplanning.com, cette page renvoie aussitôt vers l'app (state)


















for(let _y=2020;_y<=2060;_y++)_feriesAnnee(_y).forEach(function(k){FERIES.add(k);});





 // jours en toutes lettres (abréviations seulement dans les colonnes étroites : en-têtes du calendrier, échanges, tableau des lignes)





function _todayBtnHide(){
  var btn=document.querySelector('.mnav.today');
  if(!btn||btn.classList.contains('hide-l')||btn.classList.contains('hide-r'))return;
  btn.classList.add('hide-l');
}


 // année du mois sélectionné (mis en évidence dans la vue annuelle)




function saveState(){
  var _ts=Date.now();
  // Avant la lecture du cloud au démarrage : rien n'est daté ni envoyé (des données anciennes de cet appareil, retouchées au
  // démarrage, passeraient sinon pour plus récentes que le cloud et l'écraseraient)
  if(window._authToken&&!window._cloudReady){try{localStorage.setItem('pl_v8',JSON.stringify({p:_profs,a:_aid,u:_plU()}));}catch(e){}return;}
  // seulement le profil actif (les autres n'ont pas changé : les dater les ferait passer pour plus récents que le cloud)
  if(_profs[_aid]&&_profs[_aid].profile)_profs[_aid].profile._lastSaved=_ts;
  try{localStorage.setItem('pl_v8',JSON.stringify({p:_profs,a:_aid,u:_plU()}));}catch(e){}
  _lineSoon(); // ligne de la semaine (admin Lignes, collègues par ligne)
  // Cloud sync debounced (5s)
  clearTimeout(window._cloudSyncTimer);
  window._cloudSyncTimer=setTimeout(function(){
    if(!_aid)return;
    cloudSave(_aid);
  },5000);
  if(window._authToken)setSyncStatus('pending');
}
// changement de profil : l'ancien est envoyé tout de suite, l'historique d'annulation vidé (il concernait l'autre profil)
function switchProfile(id){_profs[_aid]=S;saveState();var _old=_aid;try{cloudSave(_old);}catch(e){}if(!_profs[id])_profs[id]=DEFAULT_PD();_aid=id;S=_profs[_aid];_us=[];_rs=[];try{updateUrBtns();}catch(e){}saveState();}
function createProfile(id,data){_profs[id]=data;saveState();}
function deleteProfile(id){if(id==='default')return;delete _profs[id];if(_aid===id){_aid='default';if(!_profs.default)_profs.default=DEFAULT_PD();S=_profs.default;}saveState();}
function getProfiles(){
  const all=Object.entries(_profs).map(([id,d])=>({id,name:capitalize((d&&d.profile&&d.profile.name)||id)}));
  // Active profile always first
  return [all.find(p=>p.id===_aid),...all.filter(p=>p.id!==_aid)].filter(Boolean);
  gcalLoad();gcalUpdateBtn();
}



// Chaque action annulable garde son nom : « Annuler : Rendu posé », et la liste se retrouve dans Suivi → Dernières modifications
function pushUndo(label){if(label)_haptic();var sn=snap();_us.push({s:sn,l:label||'Modification',t:Date.now()});if(_us.length>40)_us.shift();_rs=[];updateUrBtns();
  // Bandeau « … · Annuler » si l'action a réellement modifié quelque chose
  if(label){clearTimeout(window._utT);window._utT=setTimeout(function(){var e=_us[_us.length-1];if(e&&e.s===sn&&snap()!==sn)_undoToast(label,'Annuler',undoAction);},60);}
}
function _undoToast(label,btn,fn){
  var t=document.getElementById('undo-toast');
  if(!t){t=document.createElement('div');t.id='undo-toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.innerHTML='<span></span><button type="button"></button>';
  t.firstChild.textContent=label;t.lastChild.textContent=btn||'Annuler';
  t.lastChild.onclick=function(e){e.stopPropagation();_hideUndoToast();(fn||undoAction)();};
  clearTimeout(window._utHide);
  requestAnimationFrame(function(){t.classList.add('on');});
  window._utHide=setTimeout(_hideUndoToast,4500);
}
function _hideUndoToast(){var t=document.getElementById('undo-toast');if(t)t.classList.remove('on');}
function undoAction(quiet){if(!_us.length)return;var e=_us.pop();_rs.push({s:snap(),l:e.l,t:e.t});_snapApply(e.s);saveState();render();updateUrBtns();gcalTrigger();
  if(!quiet)_undoToast('Annulé : '+e.l,'Rétablir',redoAction);}
function redoAction(){if(!_rs.length)return;var e=_rs.pop();_us.push({s:snap(),l:e.l,t:e.t});_snapApply(e.s);saveState();render();updateUrBtns();gcalTrigger();
  _undoToast('Rétabli : '+e.l,'Annuler',undoAction);}
// Annuler d'un coup les actions jusqu'à celle-ci (incluse)
function undoTo(i){var n=_us.length-i;if(n<=0)return;for(var k=0;k<n;k++)undoAction(true);closeModal();_undoToast('Annulé : '+n+' action'+(n>1?'s':''),'Rétablir',function(){for(var k=0;k<n;k++)redoAction();});}
function openUndoList(){var L=_us.map(function(e,i){return {e:e,i:i};}).reverse();
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Actions de cette session</div>'
    +'<div style="font-size:13px;color:var(--text3);margin:-4px 0 10px">Toucher une action annule celle-ci et toutes celles faites après.</div>'
    +(L.length?L.map(function(x){var d=new Date(x.e.t||Date.now());return '<button class="rv-b2" style="display:flex;justify-content:space-between;text-align:left" onclick="undoTo('+x.i+')"><span>'+x.e.l.replace(/</g,'&lt;')+'</span><span style="color:var(--text3)">'+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' · annuler</span></button>';}).join(''):'<div class="hd-card" style="font-size:13px;color:var(--text3)">Aucune action à annuler.</div>')
    +'<button class="mcancel mclose" style="margin-top:12px" onclick="closeModal()">Fermer</button></div></div>';}
function updateUrBtns(){const u=document.getElementById('undo-btn'),r=document.getElementById('redo-btn');if(u){u.disabled=!_us.length;u.title=_us.length?'Annuler : '+_us[_us.length-1].l:'Rien à annuler';u.setAttribute('aria-label',u.title);}if(r){r.disabled=!_rs.length;r.title=_rs.length?'Rétablir : '+_rs[_rs.length-1].l:'Rien à rétablir';r.setAttribute('aria-label',r.title);}}




































// Valider / annuler : le jour et, pour un repos trop court, la veille ou le lendemain concernés
function _ruleSet(k,on){if(on&&_ruleHard(k))return;pushUndo(on?'Alerte validée':'Validation retirée');if(!S.ruleOk)S.ruleOk={};var ks=[k],rb=_restBefore(k),ra=_restBefore(dk(_dAdd(k,1)));
  if(rb!=null&&rb<RULES.repos)ks.push(dk(_dAdd(k,-1)));if(ra!=null&&ra<RULES.repos)ks.push(dk(_dAdd(k,1)));
  ks.forEach(function(x){if(on)S.ruleOk[x]=1;else delete S.ruleOk[x];});saveState();render();openDay(k);}




function _addStreakRendu(k){pushUndo('Rendus du '+_streakPos(k)+'e jour d’affilée');if(!S.extraRendus)S.extraRendus={};S.extraRendus[k]={dur:RULES.rendJourSup,label:_streakPos(k)+'e jour d’affilée'};saveState();render();openDay(k);}
// Après un changement : une alerte pour les jours touchés et leurs voisins
function _ruleToast(keys){var seen={},msg=null;keys.forEach(function(k){if(!k||msg)return;[-1,0,1].forEach(function(n){var kk=dk(_dAdd(k,n));if(seen[kk]||msg)return;seen[kk]=1;var L=_ruleNotes(kk);if(L.length){var d=_dAdd(kk,0);msg='⚠ '+d.getDate()+' '+MCs[d.getMonth()]+' : '+L[0].txt;}});});if(msg)setTimeout(function(){_infoToast(msg);},400);}




























 // {ym,key} cell awaiting ce-mois/propagate choice


















function getCET(){
  const init=(S.profile&&S.profile.cetInit)||0;
  const pa=(S.profile&&S.profile.congesCETParAnnee)||{};
  return init+Object.values(pa).reduce(function(s,v){return s+(v||0);},0);
}










function openCongesModal(){
  _lockBodyScroll();
  // Determine years range: min(year of first cg pose, today-1) to today+1
  const allCgKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').sort();
  const nowY=NOW.getFullYear();
  const minY=allCgKeys.length?Math.min(parseInt(allCgKeys[0].slice(0,4)),nowY):nowY;
  const maxY=nowY+1;
  const years=[];for(let y=minY;y<=maxY;y++)years.push(y);

  const cet=getCET();

  let rows='';
  years.forEach(function(y){
    const solde=getSoldeAnnee(y);
    const used=calcCongesUsedForYear(y);
    const rest=Math.max(0,solde-used);
    const isPast=y<nowY,isFut=y>nowY;
    const rowStyle=isPast?'opacity:.6':'';
    rows+=`<tr style="${rowStyle}">
      <td style="padding:7px 8px;font-size:13px;font-weight:${y===nowY?'600':'400'};color:${y===nowY?'var(--text)':'var(--text2)'}">${y}</td>
      <td style="padding:7px 8px;text-align:center">
        <div style="display:flex;align-items:center;justify-content:center;gap:4px">
          <button onclick="adjSoldeAnnee(${y},-1)" style="width:22px;height:22px;border-radius:50%;border:0.5px solid var(--border);background:var(--btn);color:var(--text2);cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center">−</button>
          <span id="cpa-solde-${y}" style="font-size:13px;font-weight:500;min-width:28px;text-align:center">${solde} j</span>
          <button onclick="adjSoldeAnnee(${y},+1)" style="width:22px;height:22px;border-radius:50%;border:0.5px solid var(--border);background:var(--btn);color:var(--text2);cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center">+</button>
        </div>
      </td>
      <td style="padding:7px 8px;text-align:center;font-size:13px;color:var(--rend-text)">${used} j</td>
      <td style="padding:7px 8px;text-align:center;font-size:13px;font-weight:500;color:${rest>0?'var(--green)':'var(--text3)'}">${rest} j</td>
    </tr>`;
  });

  const cetSection=`
    <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:var(--r);border:0.5px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:600;color:var(--amber)">CET — Compte Épargne Temps</span>
        <span style="font-size:15px;font-weight:700;color:var(--amber)" id="cet-val">${cet} j</span>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Jours mis en réserve depuis le solde annuel</div>
      <div style="display:flex;gap:6px;align-items:center">
        <button onclick="adjCET(-1,${nowY})" style="flex:1;padding:8px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--btn);color:var(--text2);cursor:pointer;font-size:13px">− 1 j</button>
        <button onclick="adjCET(+1,${nowY})" style="flex:1;padding:8px;border:0.5px solid var(--border2);border-radius:var(--r);background:rgba(224,152,48,.12);color:var(--amber);cursor:pointer;font-size:13px;font-weight:500">+ 1 j CET</button>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:6px;text-align:center">Mettre en CET retire 1 j du solde de l’année en cours (${nowY})</div>
    </div>`;

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Congés annuels</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'
    +'<thead><tr>'
    +'<th style="padding:4px 8px;font-size:10px;color:var(--text3);text-align:left;text-transform:uppercase;letter-spacing:.05em">Année</th>'
    +'<th style="padding:4px 8px;font-size:10px;color:var(--text3);text-align:center;text-transform:uppercase;letter-spacing:.05em">Solde</th>'
    +'<th style="padding:4px 8px;font-size:10px;color:var(--text3);text-align:center;text-transform:uppercase;letter-spacing:.05em">Posés</th>'
    +'<th style="padding:4px 8px;font-size:11px;font-weight:400;color:var(--text3);text-align:center">restants</th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody>'
    +'</table></div>'
    +cetSection
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

function adjSoldeAnnee(year,delta){
  const cur=getSoldeAnnee(year);
  const nv=Math.max(0,cur+delta);
  setSoldeAnnee(year,nv);
  saveState();
  updateCounters();openMergedRenduCgModal(6,1);
}




function toggleFractForfait(year){
  if(!S.profile)return;
  if(!S.profile.fractForfaitParAnnee)S.profile.fractForfaitParAnnee={};
  S.profile.fractForfaitParAnnee[year]=!getFractForfait(year);
  saveState();updateCounters();openMergedRenduCgModal(6,1);
}


// Animation de l'en-tête Congés (anneau + chiffres), en un seul mouvement.
// from = null : ouverture (tout vert, restants depuis le solde total) ; sinon l'état d'avant un +/− (anneau et chiffres précédents)
function _cgAnim(from){
  var rg=document.querySelector('#rcc-1 .cg-ring'),ns=[].slice.call(document.querySelectorAll('#rcc-1 .cg-n'));if(!rg)return;
  var C=2*Math.PI*27,to={g:+rg.dataset.g,c:+rg.dataset.c,u:+rg.dataset.u},fr=from||{g:1,c:0,u:0},arcs=rg.querySelectorAll('.cg-arc');
  var n0=ns.map(function(n,i){return from&&from.n&&from.n[i]!=null?from.n[i]:(+n.dataset.f||0);}),n1=ns.map(function(n){return +n.dataset.n;});
  var set=function(G){arcs.forEach(function(c){var g=G[c.dataset.k];c.style.transition='none';c.style.transform='rotate('+g.r+'deg)';c.style.strokeDashoffset=(C-g.L)+'px';c.style.strokeWidth=g.w;c.style.opacity=g.o;});};
  var id=(_cgAnim.id=(_cgAnim.id||0)+1),t0=performance.now(),D=from?600:900;
  (function st(t){if(id!==_cgAnim.id)return; // une nouvelle animation (clic suivant) remplace celle-ci
    var k=Math.min(1,Math.max(0,(t-t0)/D)),e=1-Math.pow(1-k,3),L=function(a,b){return a+(b-a)*e;};
    ns.forEach(function(n,i){n.textContent=Math.round(L(n0[i],n1[i]));});
    _cgAnim.cur=k<1?{g:L(fr.g,to.g),c:L(fr.c,to.c),u:L(fr.u,to.u)}:to; // état affiché, repris si on reclique pendant l'animation
    set(_cgGeo(_cgAnim.cur.g,_cgAnim.cur.c,_cgAnim.cur.u));
    if(k<1)requestAnimationFrame(st);})(t0);
}
function adjCET(delta,year){
  if(!S.profile)return;
  if(delta>0&&computeCongesRest(year)<=0)return;
  if(!S.profile.congesCETParAnnee)S.profile.congesCETParAnnee={};
  const invalidYrs=Object.keys(S.profile.congesCETParAnnee).map(Number).filter(y=>y<2020||y>year+5);
  if(invalidYrs.length){
    const extra=invalidYrs.reduce((s,y)=>s+(S.profile.congesCETParAnnee[y]||0),0);
    invalidYrs.forEach(y=>delete S.profile.congesCETParAnnee[y]);
    S.profile.congesCETParAnnee[year]=(S.profile.congesCETParAnnee[year]||0)+extra;
  }
  const cur=getCETForYear(year);
  if(delta>0){S.profile.congesCETParAnnee[year]=cur+1;}
  else{if(cur<=0)return;S.profile.congesCETParAnnee[year]=cur-1;}
  saveState();updateCounters();openMergedRenduCgModal(6,1);
}





// ================================================================
// THEME
// ================================================================
function applyTheme(t){
  t='dark'; // mode clair retiré : l'app est toujours en sombre
  localStorage.setItem('pl_theme',t);
  window._sbC=null;
  document.documentElement.setAttribute('data-theme',t);
  if(t==='light'){
    document.documentElement.style.backgroundColor='#e8e8e4';
    document.body.style.backgroundColor='#e8e8e4';
  } else {
    // iPhone : fond du document à la couleur de l'en-tête (iOS en teinte le haut de l'écran, sous l'heure et le réseau,
    // aussi pendant un rechargement) ; la page garde son fond sombre. L'écran d'ouverture (logo) a le même fond
    document.documentElement.style.backgroundColor=_isPhone()?'#222221':'#161615';
    document.body.style.backgroundColor='#161615';
  }

  setTimeout(syncWknHeight,50);
  const _meta=document.getElementById('theme-color-meta');if(_meta)_meta.content=t==='dark'?'#222221':'#fff';
  const icon=document.getElementById('theme-icon');
  if(icon)icon.className=t==='dark'?'ti ti-moon':'ti ti-sun';
}
function toggleTheme(){
  const t=localStorage.getItem('pl_theme')||'dark',nt=t==='dark'?'light':'dark';
  if(!S.settings)S.settings={};S.settings.theme=nt;_profs[_aid]=S;saveState();applyTheme(nt);
}

// ================================================================
// NAVIGATION
// ================================================================
function goToday(){
  window._pgFlush&&window._pgFlush();window._flushAnim&&window._flushAnim();
  const alreadyHere=!annualOpen&&curM===NOW.getMonth()&&curY===NOW.getFullYear();
  if(alreadyHere)return;
  const prevYm=curY*12+curM;
  _calNavDir=prevYm>TODAY_YM?-1:1;
  _todayBtnHide();
  if(!annualOpen&&window._calSlideTo){window._calSlideTo(NOW.getFullYear(),NOW.getMonth(),_calNavDir);return;}
  _calVeil(function(){
    curM=NOW.getMonth();curY=NOW.getFullYear();
    _showMonthView();
    render();
  });
}
function openExternalUrl(url,browser){
  if(navigator.standalone||window.matchMedia('(display-mode:standalone)').matches){
    // browser=true : ouvrir dans le vrai navigateur plutôt que dans la fenêtre intégrée à l'app
    if(browser){
      var _ios=navigator.userAgent.match(/(?:iPhone|iPad|iPod).* OS (\d+)_/);
      if(_ios&&Number(_ios[1])>=17){window.location.href='x-safari-'+url;return;}
      if(/Android/.test(navigator.userAgent)){var _u=new URL(url);window.location.href='intent://'+_u.host+_u.pathname+_u.search+'#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url='+encodeURIComponent(url)+';end';return;}
    }
    window.location.href=url;
  }else{
    window.open(url,'_blank','noopener');
  }
}
function navDir(d){
  window._flushAnim&&window._flushAnim();
  _calNavDir=d;
  // Flèches : la bande continue avance d'une page à chaque appui, même en plein mouvement
  if(window._pgStep){window._pgStep(annualOpen?'y':'m',d);return;}
  if(annualOpen){curY+=d;renderAnnual();_setTitle(document.getElementById('mtit'),String(curY));return;}
  let newY=curY,newM=curM+d;if(newM<0){newM=11;newY--;}if(newM>11){newM=0;newY++;}
  curM=newM;curY=newY;render();
}

// ================================================================
// RENDER
// ================================================================
function _setTitle(el,txt){
  var d=window._titleDir||0;window._titleDir=0;
  var cur=el.getAttribute('data-t');
  if(cur===txt)return;
  el.setAttribute('data-t',txt);
  if(!d||cur===null){el.textContent=txt;return;}
  el.style.setProperty('--md',d);el.classList.add('mt-anim');
  el.innerHTML='<span class="mt-o"></span><span class="mt-n"></span>';
  el.firstChild.textContent=cur;el.lastChild.textContent=txt;
  clearTimeout(el._mtT);el._mtT=setTimeout(function(){if(el.getAttribute('data-t')===txt){el.textContent=txt;el.classList.remove('mt-anim');}},380);
}
// Lance le changement de titre au début d'un glissement (en même temps que le calendrier)
function _titleTo(txt,d){var el=document.getElementById('mtit');if(!el)return;window._titleDir=d;_setTitle(el,txt);}
function render(){
  _startMigrate();
  if(S.matelasKeys&&Object.keys(S.matelasKeys).length)recalcAllMatelas();
  autoReportEph();
  applyTheme();
  const _hpn2=document.getElementById('hdr-profile-name');if(_hpn2)_hpn2.textContent=capitalize((S.profile&&S.profile.name)||'Profil');
  const el_ml=document.getElementById('mtit'),el_heads=document.getElementById('heads'),el_cal=document.getElementById('cal');
  if(!el_ml)return;
  if(annualOpen){_fitAnnual();_setTitle(el_ml,String(curY));}
  else{_fitCalendar();_setTitle(el_ml,ML[curM]+' '+curY);if(!window._skipCalOnce)renderMonth(el_heads,el_cal);requestAnimationFrame(_checkSideBelow);_fitPhoneSoon();}
  var _todayBtn=document.querySelector('.mnav.today');
  if(_todayBtn){
    var _isTodayView=!annualOpen&&curM===NOW.getMonth()&&curY===NOW.getFullYear(); // vue annuelle : « auj. » reste pour revenir au mois en cours
    var _btnHidden=_todayBtn.classList.contains('hide-l')||_todayBtn.classList.contains('hide-r');
    if(_isTodayView&&!_btnHidden){
      if(!_todayBtn.dataset.init){_todayBtn.style.transition='none';_todayBtn.classList.add('hide-l');requestAnimationFrame(function(){_todayBtn.style.transition='';});}
      else _todayBtnHide(); // retour sur le mois en cours : il s'efface en glissant
    }else if(!_isTodayView&&_btnHidden){
      _todayBtn.style.transition='none';
      _todayBtn.classList.remove('hide-l','hide-r');
      _todayBtn.classList.add('hide-l');
      requestAnimationFrame(function(){requestAnimationFrame(function(){
        _todayBtn.style.transition='';
        _todayBtn.classList.remove('hide-l','hide-r');
      });});
    }
    _todayBtn.dataset.init='1';
  }
  renderAnnual();
  updateCounters();renderHistory();

  syncWknHeight();
  setTimeout(_syncSideTop,0);
  // Mois/années voisins redessinés à l'avance (données à jour) pour le prochain glissement
  if(window._pgPrebuild){window._pgDropPre();window._pgPrebuild();}
}

function renderMonth(el_heads,el_cal){
  el_heads.innerHTML='<th class="wkh"></th>'+['L','M','Me','J','V','S','D'].map(j=>`<th>${j}</th>`).join('');
  const rameeSet=buildRameeSet(curY,curM),first=new Date(curY,curM,1),last=new Date(curY,curM+1,0);
  // Detect weeks where the active cycle changes (new cycle OR resume after summer etc.)
  const _newCycleWeeks={};
  if(_poolCycles().length>1){
    const _cs=_poolCycles().filter(function(c){return c.weeks&&c.weeks.length>0;}).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
    const _getAC=function(mk){const mkEnd=dk(new Date(new Date(mk+'T12:00:00').getTime()+6*864e5));let ac=null;_cs.forEach(function(c){if(c.startDate<=mkEnd&&(!c.endDate||c.endDate>mk))ac=c;});return ac;};
    let _sm=getMonday(new Date(curY,curM,1));
    const _me=new Date(curY,curM+1,0);_me.setHours(12,0,0,0);
    while(_sm<=_me){
      const _mk=dk(_sm),_pmk=dk(new Date(_sm.getTime()-7*864e5));
      const _ac=_getAC(_mk),_pac=_getAC(_pmk);
      if(_ac&&(!_pac||_ac.id!==_pac.id))_newCycleWeeks[_mk]=_ac.name||'Cycle';
      _sm=new Date(_sm.getTime()+7*864e5);
    }
  }
  let sdow=first.getDay();sdow=sdow===0?6:sdow-1;
  // Warn keys come directly from the FIFO inside calcSoldes (no double-pass)
  const _cs0=calcSoldes();
  const _warnKeys=_cs0.warnKeys;
  const cells=[];
  const _VAC=getVAC();
  // Previous month overflow days (greyed)
  // For 4-week months starting on Monday (sdow=0, ≤28 days): add an extra leading week
  const _prevLast=new Date(curY,curM,0);
  const _extraLeading=(sdow===0&&last.getDate()<=28)?7:0;
  const _totalLeading=sdow+_extraLeading;
  for(let i=_totalLeading;i>0;i--){
    const _od=new Date(_prevLast.getFullYear(),_prevLast.getMonth(),_prevLast.getDate()-i+1);
    const _ok=dk(_od),_ost=getState(_od);const {vac:_ov}=getVac(_od);
    let _ol='';if(_ost==='absent')_ol=_excOf(_ok)?EXC_M[_excOf(_ok).m].s:'abs.';else if(_ost==='rh')_ol='RH';else if(_ost==='fer')_ol=(_ov&&_ov!=='RH')?vLbl(_ov,_VAC):'';else if(_ov&&_ov!=='RH'&&_ost!=='ec2'&&_ost!=='ec2-fer')_ol=vLbl(_ov,_VAC);
    cells.push({d:_od.getDate(),date:_od,key:_ok,st:_ost,lbl:_ol.length>5?_ol.slice(0,5)+'.':_ol,panDot:'',warnDot:'',today:false,overflow:true});
  }
  for(let d=1;d<=last.getDate();d++){
    const date=new Date(curY,curM,d),key=dk(date),st=getState(date),{vac,ov,fromSV,echange}=getVac(date);
    let lbl='';
    if(st==='absent')lbl=_excOf(key)?EXC_M[_excOf(key).m].s:'abs.';
    else if(st==='sv')lbl='';
    else if(st==='rh')lbl='RH';
    else if(st==='fer')lbl=(vac&&vac!=='RH')?vLbl(vac,_VAC):'';
    else if(vac&&vac!=='RH'&&st!=='ec2'&&st!=='ec2-fer')lbl=vLbl(vac,_VAC);
    const _inRes=!!(window._resvKeys||{})[key],_inWarn=_warnKeys.has(key)&&!_inRes;
    const warnDot=_inWarn?'<span class="wdot">⚠️</span>':_inRes?'<span class="wdot" style="font-size:8px;color:var(--amber)">●</span>':'';
    const _lbl=_inWarn?'':lbl;
    const _dn=_inWarn?'':d;
    const _lbl2=_lbl.length>5?_lbl.slice(0,5)+'.':_lbl;
    cells.push({d:_dn,date,key,st,lbl:_lbl2,panDot:'',warnDot,today:key===dk(NOW)});
  }
  // Next month overflow days (greyed, to always total 42 cells = 6 rows)
  {const _nf=new Date(curY,curM+1,1);let _nd=1;while(cells.length<42){
    const _od=new Date(_nf.getFullYear(),_nf.getMonth(),_nd);
    const _ok=dk(_od),_ost=getState(_od);const {vac:_ov}=getVac(_od);
    let _ol='';if(_ost==='rh')_ol='RH';else if(_ost==='fer')_ol=(_ov&&_ov!=='RH')?vLbl(_ov,_VAC):'';else if(_ov&&_ov!=='RH'&&_ost!=='ec2'&&_ost!=='ec2-fer')_ol=vLbl(_ov,_VAC);
    cells.push({d:_od.getDate(),date:_od,key:_ok,st:_ost,lbl:_ol.length>5?_ol.slice(0,5)+'.':_ol,panDot:'',warnDot:'',today:false,overflow:true});
    _nd++;
  }}
  const todayMon=dk(getMonday(NOW));let html='';
  for(let r=0;r<Math.ceil(cells.length/7);r++){
    const row=cells.slice(r*7,(r+1)*7),firstReal=row.find(x=>x&&x.date&&!x.overflow)||row.find(x=>x&&x.date);
    const wn=firstReal?isoWeek(firstReal.date):'';
    const rowMon=firstReal?dk(getMonday(firstReal.date)):'';
    const rowRamee=firstReal&&rameeSet.has(dk(firstReal.date));
    const isCurWeek=rowMon===todayMon;
    const isFullCG=firstReal&&isWeekFullCG(getMonday(firstReal.date));
    // Wkn color: ramenee > plein CG > semaine courante
    const wknCls=rowRamee?'wram':isFullCG?'wcg':isCurWeek?'wcur':'';
    const cycleStartName=rowMon?_newCycleWeeks[rowMon]:'';
    const rowCls=(isCurWeek?'curweek':isFullCG?'cgweek':'')+(cycleStartName?' new-cycle-row':'');
    html+=`<tr class="${rowCls.trim()}"><td class="wkn ${wknCls}" data-wn="${wn}"${cycleStartName?` data-cyc="${cycleStartName}"`:''}>${wn}</td>`;
    row.forEach((cell,_ci)=>{
      if(!cell){html+='<td><div class="dc"></div></td>';return;}
      var _exrCls=(S.extraRendus&&S.extraRendus[cell.key])?' has-exr':'';if(!cell.overflow&&_ruleBad(cell.key))_exrCls+=' rule-bad';
      html+=`<td${_ci>=5?' class="we"':''}><div class="dc s-${cell.st}${cell.today?' today':''}${_exrCls}" style="position:relative;${cell.overflow?'opacity:0.3;':''}">${cell.warnDot}<div class="dci" data-key="${cell.key}" onclick="openDay('${cell.key}')"><span class="dn">${cell.d}</span><span class="dv">${cell.lbl}</span></div></div></td>`;
    });
    if(isCurWeek){for(let _p=row.length;_p<7;_p++)html+='<td></td>';}
    html+='</tr>';
  }
  el_cal.innerHTML=html;
  requestAnimationFrame(function(){_renderCycBadges(el_cal);});
  // Update header warn icon
}

function _renderCycBadges(calEl){
  const calWrap=calEl?calEl.closest('.cal-wrap'):document.querySelector('.cal-wrap');
  if(!calWrap)return;
  calWrap.querySelectorAll('.cyc-badge').forEach(function(b){b.remove();});
  const wrapRect=calWrap.getBoundingClientRect();
  const _tbl=calEl||calWrap.querySelector('#cal');
  if(!_tbl)return;
  _tbl.querySelectorAll('td.wkn[data-cyc]').forEach(function(td){
    const rect=td.getBoundingClientRect();
    const badge=document.createElement('div');
    badge.className='cyc-badge';
    const lbl=document.createElement('span');
    lbl.className='cyc-label';
    lbl.textContent=td.dataset.cyc;
    badge.appendChild(lbl);
    badge.style.top=(rect.top-wrapRect.top)+'px';
    calWrap.appendChild(badge);
  });
  if(!calWrap._cycRO&&window.ResizeObserver){
    let _raf=0;
    calWrap._cycRO=new ResizeObserver(function(){
      cancelAnimationFrame(_raf);
      _raf=requestAnimationFrame(function(){_renderCycBadges(null);});
    });
    calWrap._cycRO.observe(calWrap);
  }
}
(function(){
  let _raf=0;
  window.addEventListener('resize',function(){
    cancelAnimationFrame(_raf);
    _raf=requestAnimationFrame(function(){_renderCycBadges(null);});
  });
})();


// Passage mois ↔ année : un voile couleur du fond couvre le calendrier, on change de vue, puis il s'efface.
// (Faire varier l'opacité des vues elles-mêmes ferait changer l'effet verre pendant le fondu.)
function _calVeil(cb){
  const col=document.querySelector('.cal-col');
  if(!col){cb();return;}
  if(window._veilBusy)return;window._veilBusy=true;
  const v=document.createElement('div');
  // le voile commence sous la barre du mois : les flèches et « auj. » restent visibles pendant le changement de vue
  const mb=col.querySelector('.mbar'),vt=mb?Math.round(mb.getBoundingClientRect().bottom-col.getBoundingClientRect().top):-14;
  v.style.cssText='position:absolute;inset:'+vt+'px -14px 0 -14px;z-index:60;pointer-events:none;opacity:0;transition:opacity .13s ease;background:'+getComputedStyle(document.body).backgroundColor;
  col.appendChild(v);void v.offsetWidth;v.style.opacity='1';
  setTimeout(function(){
    try{cb();}finally{
      v.style.transition='opacity .22s ease';v.style.opacity='0';
      setTimeout(function(){v.remove();window._veilBusy=false;},240);
    }
  },140);
}
function _showMonthView(){
  annualOpen=false;
  const aw=document.getElementById('ann-wrap'),mv=document.getElementById('month-view');
  if(aw){aw.classList.remove('open');aw.style.display='';}
  if(mv){mv.style.visibility='visible';mv.style.height='';mv.style.overflow='';}
}
function toggleAnnual(){
  window._pgFlush&&window._pgFlush();
  _calVeil(function(){
    const aw=document.getElementById('ann-wrap'),mv=document.getElementById('month-view');
    if(!annualOpen){
      annualOpen=true;_annSelY=curY;
      aw.classList.add('open');aw.style.display='';aw.style.overflow='visible';
      mv.style.visibility='hidden';mv.style.height='0';mv.style.overflow='hidden';
      _fitAnnual();
      render();
    }else{
      _showMonthView();
      render();
      _checkSideBelow();
    }
  });
}

function renderAnnual(){
  const el=document.getElementById('ann-grid');if(!el)return;
  el.innerHTML=_annHtml(curY);
}
function goToMonth(m){
  window._pgFlush&&window._pgFlush();
  const y=curY;
  _calVeil(function(){
    curM=m;curY=y;
    _showMonthView();
    render();
  });
}

// ================================================================
// COUNTERS
// ================================================================
function updateCounters(){
  const{gen,realEph,realAvail,prevEph,preExpiry,matelas,totalReal,totalPrev}=calcSoldes();
  const cRest=Math.max(0,getCongesDroits(curY)-calcCongesUsedForYear(curY)-getCETForYear(curY));
  // HS for current month (respect toggle and temporal settings)
  const settHS=settingsForYM(curY*12+curM);
  const useHSRendu=settHS.hsRendu;
  let hsTotal=0,hsTotalLow=0,hsTotalHigh=0,rawLowTotal=0,rawHighTotal=0;
  {const seenHSm=new Set(),mymHS=curY*12+curM;for(let dd=-6;dd<new Date(curY,curM+1,0).getDate();dd++){const date=new Date(curY,curM,1+dd),mon=getMonday(date),mk=dk(mon);if(seenHSm.has(mk))continue;seenHSm.add(mk);const sun=new Date(mon);sun.setDate(mon.getDate()+6);if(sun.getFullYear()*12+sun.getMonth()!==mymHS)continue;const hsW=calcHSWeek(mon);if(hsW.surplus<=0)continue;
    if(useHSRendu){hsTotal+=hsW.rendusMin;hsTotalLow+=hsW.rawLow*1.25;hsTotalHigh+=hsW.rawHigh*1.5;}
    else{hsTotal+=hsW.rawLow+hsW.rawHigh;hsTotalLow+=hsW.rawLow;hsTotalHigh+=hsW.rawHigh;}
    rawLowTotal+=hsW.rawLow;rawHighTotal+=hsW.rawHigh;
  }}
  const mym=curY*12+curM,gm=gen[mym]||{};const gt=((gm.dim||0)+(gm.rh||0)+(gm.fer||0)+(gm.hs||0)+(gm.ram||0)+(gm.extra||0));
  const panCount=calcPaniersMois(curY,curM);const primes=calcPrimesMois(curY,curM);const nuitTotal=calcNuitMois(curY,curM);const paye_tc=calcPayeMois(curY,curM);
  const primeParts=[];
  if(primes.antenne)primeParts.push(['Ant',primes.antenne]);
  if(primes.matin)primeParts.push(['Mat',primes.matin]);
  if(panCount)primeParts.push(['Pan',panCount]);
  if(primes.coord)primeParts.push(['Crd',primes.coord]);
  if(primes.reel)primeParts.push(['Réal',primes.reel]);
  // Expiry current viewed month — split between truly expiring and reported
  const _viewExpYM=curY*12+curM;
  let _expViewAmt=0,_repViewAmt=0;
  // Mois déjà expirés : realAvail est à 0, on prend ce qui restait juste avant l'expiration (preExpiry)
  const _viewPast=_viewExpYM<TODAY_YM;
  [...new Set(Object.keys(realAvail).concat(Object.keys(preExpiry)))].map(Number).forEach(function(ym){
    const av=getExpYm(ym)<TODAY_YM?(preExpiry[ym]||0):(realAvail[ym]||0);
    if(av>0){
      if(getExpYm(ym)===_viewExpYM){
        if((window._autoPlan||{})[ym])_repViewAmt+=av; // report automatique prévu
        else _expViewAmt+=av; // déjà reportées jusqu'à ce mois-ci : elles expirent aussi
      } else if(getBaseExpYm(ym)===_viewExpYM&&getEphExtensions(ym)>0&&getExpYm(ym)>=TODAY_YM){
        _repViewAmt+=av;
      }
    }
  });
  // Bars in recap tile (PC only)
  // Lignes « récupérations par mois d'acquisition » de la colonne de droite
  const _bRows=[];
  {
    const _bGenPast=Object.keys(gen).map(Number).filter(ym=>ym<=TODAY_YM).sort();
    const _bFut=Object.keys(gen).map(Number).filter(ym=>ym>TODAY_YM).sort();
    const _bPrev=Object.keys(prevEph).map(Number).filter(ym=>prevEph[ym]>0).sort();
    const _bExt=Object.keys(S.ephExtend||{}).map(Number).filter(ym=>ym<=TODAY_YM&&getExpYm(ym)>TODAY_YM);
    const _bYmsAll=[...new Set([..._bGenPast,..._bPrev,..._bExt,..._bFut])].sort();
    // Keep 5 most relevant: prioritise non-expired close to TODAY_YM
    const _bActive=_bYmsAll.filter(ym=>getExpYm(ym)>=TODAY_YM);
    const _bExpired=_bYmsAll.filter(ym=>getExpYm(ym)<TODAY_YM);
    const _bYms=[..._bActive,..._bExpired].slice(0,5);
    const _bMaxV=Math.max(..._bYms.map(function(ym){const o=gen[ym]?Object.values(gen[ym]).reduce(function(s,v){return s+v;},0):0;return Math.max(o,ym>TODAY_YM?(prevEph[ym]||0):(realAvail[ym]||0));}),1);
    _bYms.forEach(function(ym){
      const isFut=ym>TODAY_YM,avail=isFut?(prevEph[ym]||0):(realAvail[ym]||0);
      const orig=gen[ym]?Object.values(gen[ym]).reduce(function(s,v){return s+v;},0):0;
      if(orig<=0&&avail<=0)return;
      const y=Math.floor(ym/12),m=ym%12,expYm=getExpYm(ym),expY=Math.floor(expYm/12),expM=expYm%12;
      const isExp=expYm<TODAY_YM,ext=getEphExtensions(ym);
      const origPct=Math.round(orig/_bMaxV*100),barPct=Math.round(avail/_bMaxV*100);
      const gOp=isExp?'.15':isFut?'.35':'1',bOp=isFut?'.2':'.4';
      const aColor=isExp?'var(--text3)':isFut?'var(--text3)':'var(--text2)';
      const lostMin=isExp?(preExpiry[ym]||0):0;
      _bRows.push({y,m,orig,avail,isExp,isFut,lostMin,expY,expM,ext});
    });
  }
  const viewedYM=curY*12+curM;
  const {total:dispAtView}=calcTrueDispo(viewedYM);
  const _smEl=document.getElementById('side-month');
  if(_smEl){
    _smEl.classList.toggle('now',mym===TODAY_YM);
    if(_smEl._mym!==mym){
      const _animate=_smEl._mym!==undefined;
      _smEl.innerHTML='<span class="sm-txt'+(_animate?(_calNavDir<0?' sm-in-rev':' sm-in'):'')+'">'+ML[curM]+'<span class="sm-y">'+String(curY).slice(2)+'</span></span>';
      _smEl._mym=mym;
    }
    _fitSideMonth();
  }
  _renderSideV2({mym,matelas,cRest,dispAtView,viewPast:_viewPast,expViewAmt:_expViewAmt,repViewAmt:_repViewAmt,rows:_bRows,gt,hsTotal,useHSRendu,nuitTotal,paye_tc,primeParts});
  updateRecap();
}

// Mobile : taille du mois vertical telle que « SEPTEMBRE 26 » occupe toute la hauteur des cases ;
// le bas des lettres est coupé à 8 % sous les cases, le haut reste entier.
function _fitSideMonth(){
  var el=document.getElementById('side-month'),sc=document.querySelector('.side-col');
  if(!el||!sc)return;
  if(!_isPhone()||!el.offsetHeight){sc.style.removeProperty('padding-left');return;}
  var txt=el.querySelector('.sm-txt');if(!txt)return;
  // Longueur de référence de « SEPTEMBRE 26 » à 100 px, mesurée une fois
  if(!_fitSideMonth._ref){
    var probe=document.createElement('span');probe.className='sm-txt';probe.style.fontSize='100px';probe.style.visibility='hidden';probe.style.position='absolute';
    probe.innerHTML='Septembre<span class="sm-y">26</span>';el.appendChild(probe);
    _fitSideMonth._ref=probe.getBoundingClientRect().height;el.removeChild(probe);
  }
  var fs=Math.max(16,Math.floor(el.offsetHeight/_fitSideMonth._ref*100));
  // Le bas des lettres (côté cases, l'élément est tourné de 180°) passe sous les cases et est coupé à 8 % ;
  // le haut (côté bord de l'écran) reste entier, avec une petite marge pour le contour.
  var cap=0.72*fs,hidden=Math.round(cap*0.08),visible=Math.round(cap)-hidden,top=5;
  txt.style.fontSize=fs+'px';
  // Un espace de 8 px sépare la ligne de coupe des cases
  sc.style.setProperty('padding-left',(top+visible+2+8)+'px','important');
  el.style.left='0px';
  el.style.width=(top+visible+2+hidden)+'px';
  el.style.setProperty('--sm-cut',hidden+'px');
  // Coupe nette du bas : le bord droit à l'écran est le bord gauche local de l'élément tourné
  el.style.clipPath='inset(0 0 0 '+hidden+'px)';
}

// ── Colonne latérale, nouvelle présentation (choix « Nouvelle / Ancienne » dans les réglages) ──
// Animations de la colonne de droite : les chiffres qui changent défilent jusqu'à leur nouvelle valeur
// (avec une légère impulsion), et les barres de récupération se remplissent à l'arrivée sur un mois.
function _sv2Animate(v2,mym){
  var vals=v2.querySelectorAll('.sv2-val'),prev=window._sv2Prev||{},same=window._sv2Mym===mym,now={};
  var fmt={h:fmtMin,j:function(n){return n+'j';}};
  var parse=function(t){var m=/^(\d+)h(\d{2})$/.exec(t);if(m)return{v:+m[1]*60+ +m[2],u:'h'};m=/^(\d+)j$/.exec(t);if(m)return{v:+m[1],u:'j'};return null;};
  Array.prototype.forEach.call(vals,function(el,i){
    var t=el.textContent.trim();now[i]=t;
    if(!same||prev[i]===undefined||prev[i]===t)return;
    var a=parse(prev[i]),b=parse(t);
    el.classList.remove('sv2-bump');void el.offsetWidth;el.classList.add('sv2-bump');
    if(!a||!b||a.u!==b.u)return;
    var t0=performance.now(),dur=450;
    (function step(ts){var k=Math.min(1,(ts-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=fmt[b.u](Math.round(a.v+(b.v-a.v)*e));if(k<1)requestAnimationFrame(step);else el.textContent=t;})(t0);
  });
  window._sv2Prev=now;
  if(!same){v2.classList.add('sv2-anim');clearTimeout(window._sv2AnimT);window._sv2AnimT=setTimeout(function(){v2.classList.remove('sv2-anim');},800);}
  window._sv2Mym=mym;
}

function _renderSideV2(d){window._svD=d; // repris par la page Suivi (téléphone)
  var v2=document.getElementById('side-v2');
  if(!v2)return;
  v2.style.display='flex';
  // Noms de mois accentués (ML n'a pas d'accents) et élision « d’octobre », « d’avril », « d’août »
  var MF=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var deMois=function(i){return /^[aeiouéâ]/.test(MF[i])?'d’'+MF[i]:'de '+MF[i];};
  var mois=MF[curM].charAt(0).toUpperCase()+MF[curM].slice(1)+' '+curY,moisC=MF[curM];
  var col=function(lbl,val,color,sub,click){return '<div class="sv2-col'+(click?' clk':'')+'"'+(click?' onclick="event.stopPropagation();'+click+'"':'')+'><div class="sv2-lbl">'+lbl+'</div><div class="sv2-val" style="color:'+(val==='—'?'var(--text3)':color)+'">'+val+'</div><div class="sv2-sub">'+(sub||'')+'</div></div>';};
  // Soldes (cumulés)
  var monthLine;
  if(d.expViewAmt>0)monthLine='<span style="color:'+(d.viewPast?'var(--red)':'var(--amber)')+'">'+fmtMin(d.expViewAmt)+(d.viewPast?' perdues':' expirent')+'</span>';
  else if(d.repViewAmt>0)monthLine='<span style="color:var(--green)">'+fmtMin(d.repViewAmt)+' reportées</span>';
  else monthLine='rien n’expire';
  // Mobile : la page ne défile pas, la liste est retirée (comme dans l'ancienne colonne)
  // Barre bleue = heures acquises, barre verte = heures restantes (même échelle pour tous les mois)
  var _rMax=Math.max(1,...d.rows.map(function(r){return Math.max(r.orig,r.avail);}));
  var rows=(_isPhone()?[]:d.rows).map(function(r){
    var exp=r.isExp?(r.lostMin>0?'<span style="color:var(--red)">−'+fmtMin(r.lostMin)+'</span>':'expirées')
      :'→ '+(r.ext>0?'<span style="color:var(--green)">'+MCs[r.expM]+' '+String(r.expY).slice(2)+'</span>':MCs[r.expM]+' '+String(r.expY).slice(2));
    var oP=Math.round(r.orig/_rMax*100),aP=Math.round(r.avail/_rMax*100);
    return '<div class="sv2-row'+(r.isExp?' exp':'')+(r.isFut?' fut':'')+'"><span class="m">'+MCs[r.m]+' '+String(r.y).slice(2)+'</span>'
      +'<span class="sv2-rb"><span class="sv2-rf"><span style="color:var(--blue)">'+fmtMin(r.orig)+'</span><span style="color:var(--text3)"> → </span><b>'+fmtMin(r.avail)+'</b></span>'
      +'<span class="eph-bw"><span class="eph-b2" style="width:'+oP+'%;background:var(--blue);opacity:'+(r.isFut?'.2':'.4')+'"></span><span class="eph-b" style="width:'+aP+'%;background:var(--rend-text);opacity:'+(r.isExp?'.15':r.isFut?'.35':'1')+'"></span></span></span>'
      +'<span class="e">'+exp+'</span></div>';
  }).join('');
  var soldes='<div class="bloc clk" onclick="openMergedRenduCgModal()">'
    +'<div class="sv2-t"><span>Soldes</span></div>'
    +'<div class="sv2-cols">'
    +_recapCol(col,curY)
    +col('Dispo '+moisC,d.dispAtView>0?fmtMin(d.dispAtView):'—',d.dispAtView<120?'var(--amber)':'var(--rend-text)',monthLine)
    +col('Congés '+curY,d.cRest+' j','var(--green)','restants','openMergedRenduCgModal(6,1)')
    +'</div>'
    +(rows?'<div class="sv2-sep"></div><div class="sv2-t" style="margin-bottom:4px"><span>Récupérations par mois d’acquisition</span></div>'+rows:'')
    +'</div>';
  // Activité du mois (heures + primes gagnées ce mois-ci, payées le mois suivant)
  var PN={Pan:'Panier',Mat:'Matin',Ant:'Antenne','Réal':'Réal',Crd:'Coord'};
  var chips=d.primeParts.length?'<div class="sv2-chips'+(d.primeParts.length>=4?' many':'')+'">'+d.primeParts.map(function(p){return '<span class="sv2-chip">'+(PN[p[0]]||p[0])+' <b>×'+p[1]+'</b></span>';}).join('')+'</div>':'<div class="sv2-chips"><span class="sv2-chip" style="background:transparent;color:var(--text3)">Aucune prime</span></div>'; // même hauteur qu'une ligne de primes
  var nextM=MF[(curM+1)%12];
  var heures='<div class="bloc clk" onclick="openMergedMoisModal('+d.mym+')">'
    +'<div class="sv2-t"><span>Variables <span style="text-transform:none;letter-spacing:0;font-size:.85em">• payées en '+nextM+'</span></span></div>'
    +'<div class="sv2-cols">'
    +col('Rendus',d.gt?fmtMin(d.gt):'—','var(--rend-text)',d.mym>TODAY_YM?'prévus':'acquis')
    +col('Heures sup',d.hsTotal?fmtMin(d.hsTotal):'—','var(--blue)',d.useHSRendu?'rendues':'payées','openMergedMoisModal('+d.mym+',1)')
    +col('Nuit',d.nuitTotal?fmtMin(d.nuitTotal):'—','#9c7fe0','payées','openMergedMoisModal('+d.mym+',3)')
    +'</div>'
    +'<div class="sv2-sep" style="margin:10px 0 8px"></div>'
    +'<div onclick="event.stopPropagation();openMergedMoisModal('+d.mym+',2)" style="cursor:pointer">'
    +chips+'</div>'
    +'</div>';
  // Paie versée ce mois-ci (inclut les variables du mois précédent)
  var pt=d.paye_tc,brutOk=pt&&pt.configured&&pt.salQ&&pt.heures;
  var prevMn=(curM+11)%12;
  // Bulletin importé pour ce mois : son brut et l'état de la comparaison
  var _bu=(S.bulletins||{})[d.mym],_bc=null,_bst=null;if(_bu){try{_bc=_bulCompare(_bu);_bst=_BUL_ST[_bc.status];}catch(e){}}
  // Bulletin comparé : ✓ conforme, ⚠ écart (rien si pas de bulletin ou écart ignoré), à gauche du montant
  var _ico=_bst?(_bc.status==='ecart'?(_bulIgn(d.mym,_bc)?'':'<span title="Écart avec le calcul" style="color:'+_bst[1]+';font-size:15px">⚠</span>'):'<span title="Bulletin conforme" style="color:var(--green);font-size:16px;font-weight:700">✓</span>'):'';
  var paie='<div class="bloc clk" onclick="openBulletinModal('+d.mym+')">'
    +'<div class="sv2-t"><span>Paie <span style="text-transform:none;letter-spacing:0;font-size:.85em">• variables '+deMois(prevMn)+'</span></span></div>'
    +'<div class="sv2-pay" style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><span class="sv2-lbl" style="font-size:11px">'+(_bu?'Brut du bulletin':'Brut estimé')+'</span>'
    +'<span style="display:flex;align-items:baseline;gap:7px">'+_ico+'<span class="sv2-val" style="font-size:22px;color:'+(brutOk||_bu?'var(--gold-pay)':'var(--text3)')+'">'+(_bu?fmtEuro(_bu.brut):brutOk?fmtEuro(pt.total):'—')+'</span></span></div>'
    +'</div>';
  v2.innerHTML=soldes+heures+paie;
  // Primes sur une seule ligne : si elles débordent, on réduit leur taille juste ce qu'il faut
  var _ch=v2.querySelector('.sv2-chips.many');
  if(_ch){var _c0=_ch.querySelector('.sv2-chip'),_fs=parseFloat(getComputedStyle(_c0).fontSize)||10;
    while(_ch.scrollWidth>_ch.clientWidth&&_fs>7){_fs-=.25;_ch.style.gap=(_fs<9?3:4)+'px';_ch.querySelectorAll('.sv2-chip').forEach(function(c){c.style.fontSize=_fs+'px';if(_fs<9){c.style.paddingLeft=c.style.paddingRight='.45em';}});}}
  _sv2Animate(v2,d.mym);
}


function autoReportEph(){
  if(!S.autoExtend)S.autoExtend={};
  const saved=Object.assign({},S.autoExtend),manExt=S.ephExtend||{};
  const manOf=function(ym){return typeof manExt[ym]==='number'?manExt[ym]:(manExt[ym]?1:0);};
  // 1. reports déjà déclenchés (échéance passée) : acquis
  Object.keys(S.autoExtend).forEach(function(k){delete S.autoExtend[k];});
  var no=S.noAuto||{}; // mois où le report a été repris du tableau Gestion : pas de report automatique
  Object.keys(saved).map(Number).forEach(function(ym){if(no[ym])return;var man=manOf(ym),L=man;for(var i=man+1;i<=(saved[ym]||0);i++)if(ym+3+3*(i-1)<TODAY_YM)L=i;if(L>man)S.autoExtend[ym]=L;});
  // 2. échéances passées avec 7h ou moins : report (répété si plusieurs échéances sont passées depuis)
  for(var pass=0;pass<3;pass++){var ch=false,c0=calcSoldes();
    Object.keys(c0.preExpiry).map(Number).forEach(function(ym){if(ym>TODAY_YM||no[ym])return;var L=Math.max(manOf(ym),S.autoExtend[ym]||0),av=c0.preExpiry[ym]||0;
      if(L<3&&ym+3+3*L<TODAY_YM&&av>0&&av<=420){S.autoExtend[ym]=L+1;ch=true;}});
    if(!ch)break;}
  // 3. reports prévus : mois pas encore à échéance, 7h ou moins restantes
  var cs=calcSoldes(),plan={};
  Object.keys(cs.realAvail).map(Number).forEach(function(ym){if(ym>TODAY_YM||no[ym])return;var L=Math.max(manOf(ym),S.autoExtend[ym]||0),av=cs.realAvail[ym]||0;
    if(L<3&&getExpYm(ym)>=TODAY_YM&&av>0&&av<=420)plan[ym]=1;});
  var planCh=JSON.stringify(plan)!==JSON.stringify(window._autoPlan||{});window._autoPlan=plan;
  var changed=JSON.stringify(saved)!==JSON.stringify(S.autoExtend);
  if(changed||planCh)recalcAllMatelas();
  // 4. rendus couverts seulement par un report prévu : « sous réserve » ; s'ils n'y sont plus et passent sur le matelas, on le dit
  var cA=calcSoldes(),cP=_withProj(calcSoldes),res={};cA.warnKeys.forEach(function(k){if(!cP.warnKeys.has(k))res[k]=1;});
  var old=S.resvKeys||{},lost=Object.keys(old).filter(function(k){return !res[k]&&S.matelasKeys&&S.matelasKeys[k]!==undefined;});
  window._resvKeys=res;
  if(JSON.stringify(old)!==JSON.stringify(res)){S.resvKeys=res;changed=true;}
  if(lost.length)setTimeout(function(){_infoToast('Plus de report automatique : '+lost.map(function(k){return fmtDate(new Date(k+'T12:00:00')).replace(/ \d{4}$/,'');}).join(', ')+' passé'+(lost.length>1?'s':'')+' sur le matelas');},400);
  if(changed)saveState();
}














function togglePrimeConv(id,on){var p=S.profile;if(!p)return;if(!p.primesConvOff)p.primesConvOff={};if(on)delete p.primesConvOff[id];else p.primesConvOff[id]=true;saveState();render();}





















// Complément CP (10ᵉ des variables, payé en janvier) : le montant réel du bulletin remplace l'estimation
async function editCompCP(y,mym){
  var pr=S.profile||{},cur=pr.compCPManual&&pr.compCPManual[y]!=null?String(pr.compCPManual[y]).replace('.',','):'';
  var v=await _ask('Complément CP de janvier '+y+'\n\n« 10ème EPV » sur le bulletin, en euros. Laisser vide pour revenir au calcul automatique.',{input:cur,placeholder:'0,00',ok:'Enregistrer',inputmode:'decimal'});
  if(v===null)return;
  v=v.trim().replace(/\s/g,'').replace(',','.');
  if(!pr.compCPManual)pr.compCPManual={};
  if(v===''||isNaN(parseFloat(v)))delete pr.compCPManual[y];else pr.compCPManual[y]=Math.round(parseFloat(v)*100)/100;
  saveState();render();openBulletinModal(mym);
}








function _loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  var V='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  return new Promise(function(res,rej){var s=document.createElement('script');s.src=V+'pdf.min.js';s.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc=V+'pdf.worker.min.js';res(window.pdfjsLib);};s.onerror=function(){rej(new Error('pdfjs'));};document.head.appendChild(s);});
}

// PDF → lignes de texte (regroupées par hauteur, de gauche à droite)
async function _pdfLines(file){
  var lib=await _loadPdfJs(),doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
  for(var p=1;p<=doc.numPages;p++){
    var tc=await (await doc.getPage(p)).getTextContent();
    out=out.concat(_pdfRows(tc.items));
  }
  return out;
}
function _infoToast(msg){
  var t=document.getElementById('undo-toast');
  if(!t){t=document.createElement('div');t.id='undo-toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.innerHTML='<span></span>';t.firstChild.textContent=msg;
  clearTimeout(window._utHide);requestAnimationFrame(function(){t.classList.add('on');});
  window._utHide=setTimeout(_hideUndoToast,5000);
  t.classList.toggle('wrap',msg.length>38);
}
// Messages du navigateur (« franceinfoplanning.com indique… ») remplacés par ceux de l'app
window.alert=function(m){_infoToast(String(m));};
// Question dans l'app : _ask(texte,{ok,cancel,del,input}) → promesse (true/false, ou le texte saisi / null)
// Première ligne du texte en titre, le reste en détail.
function _ask(msg,o){o=o||{};return new Promise(function(res){
  var old=document.getElementById('ask');if(old)old.remove();
  var parts=String(msg).split('\n\n'),d=document.createElement('div');d.id='ask';d.setAttribute('role','alertdialog');
  d.innerHTML='<div class="ak"><div class="ak-t"></div>'+(parts.length>1?'<div class="ak-m"></div>':'')+(o.input!=null?'<input inputmode="'+(o.inputmode||'text')+'" maxlength="120">':'')
    +'<div class="ak-b"><button type="button" class="no"></button><button type="button" class="ok'+(o.del?' del':'')+'"></button></div></div>';
  d.querySelector('.ak-t').textContent=parts[0];if(parts.length>1)d.querySelector('.ak-m').textContent=parts.slice(1).join('\n\n');
  d.querySelector('.no').textContent=o.cancel||'Annuler';d.querySelector('.ok').textContent=o.ok||'OK';
  var inp=d.querySelector('input');if(inp){inp.value=o.input;inp.placeholder=o.placeholder||'';}
  function done(v){document.removeEventListener('keydown',key,true);d.classList.remove('on');setTimeout(function(){d.remove();},180);res(v);}
  function key(e){if(e.key==='Escape'){e.stopPropagation();e.preventDefault();done(inp?null:false);}else if(e.key==='Enter'){e.preventDefault();done(inp?inp.value:true);}}
  d.querySelector('.no').onclick=function(){done(inp?null:false);};d.querySelector('.ok').onclick=function(){_haptic();done(inp?inp.value:true);};
  d.onclick=function(e){if(e.target===d)done(inp?null:false);};
  document.addEventListener('keydown',key,true);document.body.appendChild(d);
  requestAnimationFrame(function(){d.classList.add('on');if(inp){inp.focus();inp.select();}});
});}


function _bulPayApply(){
  var D=_bulPayDiffs(),pr=S.profile;if(!D.n)return;pushUndo('Réglages de paie depuis les bulletins');
  var put=function(hk,fk,list,empty){list.forEach(function(c,i){
    // première valeur et rien de réglé avant : elle vaut depuis toujours ; les suivantes à partir du mois du bulletin
    if(empty&&i===0&&!(pr[hk]||[]).some(function(e){return e.ym<=c.ym;})){pr[fk]=c.v;return;}
    if(!pr[hk])pr[hk]=[];var i=pr[hk].findIndex(function(e){return e.ym===c.ym;});if(i>=0)pr[hk][i].v=c.v;else pr[hk].push({ym:c.ym,v:c.v});pr[hk].sort(function(a,b){return a.ym-b.ym;});});};
  put('palierHistory','palierNum',D.palier,!(pr.palierNum>0));if(pr.palierNum>0)pr.salaireQualif=calcPalierSalaire(pr.palierNum);
  put('heuresHistory','heuresMensuelles',D.heures,false);
  put('groupeHistory','groupeClassif',D.groupe,!(pr.groupeClassif>0));
  if(D.pfa)pr.pfaMensuelle=D.pfa.v;
  // Avantage individuel acquis : l'ancienne prime s'arrête le mois d'avant, la nouvelle vaut dès le premier bulletin qui la montre
  if(D.av){var st=D.av.first;pr.primesFixesCustom=(pr.primesFixesCustom||[]).filter(function(p){if(!/INDIV/i.test(p.label)||(p.finYM!=null&&p.finYM<st))return true;if(p.debutYM>=st)return false;p.finYM=st-1;return true;});
    if(D.av.v>0)pr.primesFixesCustom.push({id:'pfc_'+Date.now(),label:'Prime av. indiv. acquis',montant:D.av.v,debutYM:st,finYM:null});}
  // heures payées : « en rendus » désactivé pour ce mois-là seulement (réglage du mois, prioritaire, sans toucher aux suivants)
  var _cb={};[].forEach.call(document.querySelectorAll('.bpseg[data-bp]'),function(e){_cb[e.getAttribute('data-bp')]=e.dataset.v==='1';});
  D.paid.forEach(function(x){var c=_cb[x.k+':'+x.ym],id=x.k+':'+x.ym;
    // réglage actuel gardé contre la proposition : retenu, la proposition ne revient plus
    if(c!=null&&c!==x.v){if(!pr.bulRendKeep)pr.bulRendKeep={};pr.bulRendKeep[id]=x.v;return;}
    if(pr.bulRendKeep)delete pr.bulRendKeep[id];if(!pr.settingsMonthly)pr.settingsMonthly={};if(!pr.settingsMonthly[x.ym])pr.settingsMonthly[x.ym]={};pr.settingsMonthly[x.ym][x.k]=x.v;});
  var _an=document.getElementById('_bp-anni');if(_an&&_an.value!=='')pr.ancMoisAnni=parseInt(_an.value); // −2 : « je ne sais pas », ne plus demander
  if(D.anc){pr.ancYears=D.anc.y;pr.ancRefYM=D.anc.ym;if(D.anc.mo!=null)pr.ancMoisAnni=D.anc.mo;pr.primeAnciennete=calcAncPrime(D.anc.y);}
  saveState();render();
}
// Vérification depuis Suivi : on y revient en la fermant
// Suivi → Importer : choix des fichiers tout de suite ; après des bulletins, réglages de paie proposés seulement s'ils diffèrent
function importFromSuivi(){window._bulPayThen=function(){openMergedRenduCgModal(6,2);};_verifImport(1);}
// Choix de fichiers : le champ est rattaché à la page le temps du choix (sur iPhone, un champ détaché ne reçoit pas toujours le fichier choisi)
function _fileInput(){var i=document.createElement('input');i.type='file';i.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';return i;}
// Le fichier choisi est traité une seule fois, qu'il arrive par « change », « input » ou au retour sur la page (certains iPhone ne signalent rien)
function _fileOpen(i){document.body.appendChild(i);var f=i.onchange,done=false;i.onchange=null;
  var go=function(e){if(done||!i.files||!i.files.length)return;done=true;window.removeEventListener('focus',back);document.removeEventListener('visibilitychange',back);f&&f.call(i,e);setTimeout(function(){if(i.parentNode)i.remove();},60000);};
  var back=function(){setTimeout(go,700);};
  i.addEventListener('change',go);i.addEventListener('input',go);
  setTimeout(function(){window.addEventListener('focus',back);document.addEventListener('visibilitychange',back);},300);
  i.click();}
// Vérification : un seul bouton Importer ; les PDF vont aux bulletins (retour à la vérification), le fichier Excel au tableau Gestion
function _verifImport(quick){var th=window._bulPayThen;
  var inp=_fileInput();inp.multiple=true;inp.accept='application/pdf,.pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  inp.onchange=function(){var fs=[].slice.call(inp.files||[]),pdf=fs.filter(function(f){return /\.pdf$/i.test(f.name)||f.type==='application/pdf';}),xl=fs.filter(function(f){return /\.xlsx$/i.test(f.name);});
    if(!pdf.length&&!xl.length){showBlockAlert('Fichier non reconnu','Choisir des bulletins (PDF) ou le tableau Gestion (Excel).');return;}
    window._bulPayThen=null;
    var rh=function(){window._rvFrom='recap';_rhFile(xl[xl.length-1]);};
    if(pdf.length)_importBulletinFiles(pdf,xl.length?rh:function(){_bulPayPropose(th,quick?0:1);});else rh();};
  _fileOpen(inp);}
// Fenêtre de proposition (après un import, ou depuis Réglages → Paie)
function _bulPayPropose(then,all){
  var D=_bulPayDiffs(),nb=Object.keys(S.bulletins||{}).length;
  if(!D.n&&!all){_haptic();_infoToast('✓ Réglages conformes '+(nb>1?'aux '+nb+' bulletins':'au bulletin'));if(then)then();return false;}
  window._bulPayThen=then||null;
  // Vérification complète (Réglages) : la même fenêtre ajoute l'écart avec le tableau Gestion, recalculé ici
  var G='';if(all){var rh=null;try{rh=_rhStored();}catch(e){}if(rh){try{rhCompareShow(rh,true);}catch(e){}}
    var cm=S.profile&&S.profile.rhCmp,lk='color:var(--blue);cursor:pointer;margin-left:8px;white-space:nowrap';
    if(!rh)G='<div class="recap-row" style="font-size:13px;min-height:26px;gap:10px"><span style="color:var(--text3)">Tableau</span><span>aucun importé</span></div>';
    else{var e0=cm?-cm.d:0,ok=!cm||Math.abs(e0)<2;
      G='<div class="recap-row" style="font-size:13px;min-height:26px;gap:10px"><span style="color:var(--text3)">Écart d’heures</span><span><b style="color:'+(ok?'var(--green)':e0>0?'var(--green)':'var(--red)')+'">'+(ok?'✓ identique':(e0>0?'+':'−')+fmtMin(Math.abs(e0))+(e0>0?' favorable':' à corriger'))+'</b><a style="'+lk+'" onclick="closeModal();rhOpenFrom(\'recap\')">Détail</a></span></div>';}}
  var mo=function(ym){return MC[ym%12]+' '+Math.floor(ym/12);},li=function(l,v,c,ym){return '<div class="recap-row" style="font-size:13px;min-height:26px;gap:10px"><span style="color:var(--text3)">'+l+'</span><span><b>'+v+'</b><span style="color:var(--text3)"> · dès '+mo(ym)+(c?' (avant : '+c+')':'')+'</span></span></div>';};
  var rows=D.palier.map(function(c){return li('Palier','P'+c.v,c.cur?'P'+c.cur:'',c.ym);}).join('')
    +D.heures.map(function(c){return li('Contrat',Math.round(c.v/151.67*1000)/10+' %',Math.round(c.cur/151.67*1000)/10+' %',c.ym);}).join('')
    +D.groupe.map(function(c){return li('Groupe','Gr. '+c.v,c.cur?'Gr. '+c.cur:'',c.ym);}).join('')
    +(D.av?li('Av. indiv. acquis',fmtEuro(D.av.v),D.av.cur?fmtEuro(D.av.cur):'',D.av.first):'')
    +(D.pfa?'<div class="recap-row" style="font-size:13px;min-height:26px;gap:10px"><span style="color:var(--text3)">PFA</span><span><b>'+(D.pfa.v?'mensuelle':'semestrielle')+'</b><span style="color:var(--text3)"> · bulletin de '+mo(D.pfa.ym)+'</span></span></div>':'')
    +(D.ask?(function(){var rg=D.ask.rng,inR=function(m){if(!rg)return false;for(var y=rg.a;y<=rg.b;y++)if(y%12===m)return true;return false;};
      return '<div class="recap-row" style="font-size:13px;min-height:34px;gap:10px"><span style="color:var(--text3)">Mois d’anniversaire'+(rg?'<span style="display:block;font-size:11px">entre '+MC[rg.a%12]+' et '+MC[rg.b%12]+' d’après les bulletins</span>':'')+'</span>'
        +'<select id="_bp-anni" style="height:30px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text);font-size:13px;padding:0 6px"><option value="">—</option>'
        +ML.map(function(n,m){return {n:n,m:m};}).sort(function(a,b){return inR(b.m)-inR(a.m)||a.m-b.m;}).map(function(o){return '<option value="'+o.m+'">'+o.n+(inR(o.m)?' ·':'')+'</option>';}).join('')
        +'<option value="-2">Je ne sais pas</option></select></div>';})():'')
    +(D.anc?'<div class="recap-row" style="font-size:13px;min-height:26px;gap:10px"><span style="color:var(--text3)">Ancienneté</span><span><b>'+D.anc.y+' ans</b><span style="color:var(--text3)"> en '+MCs[D.anc.ym%12]+' '+Math.floor(D.anc.ym/12)+(D.anc.mo!=null?' · anniv. '+MC[D.anc.mo]:'')+'</span></span></div>':'');
  // Génération des rendus : une ligne par mois et par type, choix payés | rendus (proposé d'après les bulletins)
  var RL={ferRendu:'Fériés',dimRendu:'Dimanches',rhRendu:'RH travaillés',hsRendu:'Heures sup'},RO=['ferRendu','dimRendu','rhRendu','hsRendu'];
  var rend=D.paid.slice().sort(function(p,q){return p.ym-q.ym||RO.indexOf(p.k)-RO.indexOf(q.k);}).map(function(x,i){
    // état du bulletin · état actuel dans l'app (mois sans ces heures : aligné sur les mois autour)
    var why='Bulletin : <b style="font-weight:600;color:var(--text2)">'+(x.fill?'0 h':x.v?'rendus':'payés')+'</b> · App : <b style="font-weight:600;color:var(--text2)">'+(x.v?'payés':'rendus')+'</b>';
    return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;'+(i?'border-top:0.5px solid var(--border);':'')+'font-size:13px">'
      +'<span style="flex:1;min-width:0"><span style="color:var(--text)">'+MCs[x.ym%12]+' '+String(Math.floor(x.ym/12)).slice(2)+' · '+RL[x.k]+'</span>'
      +'<span style="display:block;color:var(--text3);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+why+'</span></span>'
      +'<span class="bpseg" data-bp="'+x.k+':'+x.ym+'" data-v="'+(x.v?1:0)+'">'+[0,1].map(function(v){return '<span'+((x.v?1:0)===v?' class="on"':'')+' onclick="var g=this.parentNode;g.dataset.v='+v+';[].forEach.call(g.children,function(c,j){c.classList.toggle(\'on\',j==='+v+');})">'+(v?'rendus':'payés')+'</span>';}).join('')+'</span></div>';}).join('');
  var KEPT=D.kept?'<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0 2px;border-top:0.5px solid var(--border);font-size:11px;color:var(--text3)"><span>Bulletin faux, réglage conservé : '+D.kept+' mois</span><span style="white-space:nowrap"><a style="color:var(--blue);cursor:pointer" onclick="delete S.profile.bulRendKeep;saveState();_bulPayPropose(window._bulPayThen,'+(all?1:0)+')">Revoir</a></span></div>':'';
  var okR=function(t){return '<div class="recap-row" style="font-size:13px;min-height:26px;gap:10px"><span style="color:var(--text3)">'+t+'</span><span>'+(nb?'<b style="color:var(--green)">✓ conforme</b><span style="color:var(--text3)"> · '+nb+' bulletin'+(nb>1?'s':'')+'</span>':'aucun bulletin')+'</span></div>';};
  var sec=function(t,h){return '<div class="bpsec">'+t+'</div><div class="hd-card">'+h+'</div>';};
  // écart de paie avec les bulletins (comme la tuile Suivi) : souvent dû à la génération de rendus
  var EP='';if(all&&nb){var E=_bulEcart(),eok=!E.nBad;
    EP='<div class="recap-row" style="font-size:13px;min-height:26px;gap:10px"><span style="color:var(--text3)">Écart avec les bulletins</span><span style="white-space:nowrap">'
      +(eok?'<b style="color:var(--green)">✓ aucun</b>':'<b style="color:'+(E.bal<-0.05?'var(--red)':Math.abs(E.bal)<=0.05?'var(--amber)':'var(--green)')+'">'+(Math.abs(E.bal)>0.05?(E.bal<0?'−':'+')+fmtEuro(Math.abs(E.bal)):'⚠ '+E.nPb)+'</b><span style="color:var(--text3)"> · '+E.nBad+' mois</span>')
      +'<a style="color:var(--blue);cursor:pointer;margin-left:8px" onclick="closeModal();openBulletinsCal()">Détail</a></span></div>'
      +(!eok&&D.paid.length?'<div style="font-size:11px;color:var(--text3);padding:0 0 4px">Corrigé en partie par la génération de rendus ci-dessous</div>':'');}
  var body=((rows||all)?sec('Paie',(rows||okR('Palier, contrat, primes'))+EP):'')+((rend||all)?sec('Génération de rendus',(rend||okR('Payés ou rendus'))+KEPT):'')+(all?sec('Tableau Gestion',G):'')
    +(all?sec('Documents','<div style="display:flex;align-items:center;gap:10px;padding:4px 0"><span style="flex:1;font-size:13px;color:var(--text3)">Bulletins (PDF) et/ou tableau Gestion (Excel)</span><button class="adj-pill" style="width:auto;padding:0 16px;height:34px;font-size:13px" onclick="_verifImport()"><i class="ti ti-file-import" style="margin-right:4px"></i>Importer</button></div>'):'');
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)_bulPayDone(0)"><div class="sheet"><div class="sh"></div><div class="st">'+(all?'Vérification':'Réglages lus sur les bulletins')+'</div>'
    +(D.n?'<div style="font-size:13px;color:var(--text3);line-height:1.45;margin:-4px 0 10px">Corrections proposées d’après les bulletins'+(all?' et le tableau Gestion':'')+'.</div>':'')
    +body
    +(D.n?'<div class="mbtns"><button class="mb" onclick="_bulPayDone(0)">Plus tard</button><button class="mb pri" onclick="_bulPayDone(1)">Mettre à jour</button></div>':'<div class="mbtns" style="grid-template-columns:1fr"><button class="mb pri" style="width:100%" onclick="_bulPayDone(0)">OK</button></div>')+'</div></div>';
  return true;
}
function _bulPayDone(ok){if(ok)_bulPayApply();var t=window._bulPayThen;window._bulPayThen=null;if(t)t();else if(ok)openSettingsModal(1);else closeModal();}
function importBulletins(after){
  var inp=_fileInput();inp.accept='application/pdf,.pdf';inp.multiple=true;
  inp.onchange=function(){_importBulletinFiles([].slice.call(inp.files||[]),after);};
  _fileOpen(inp);
}
async function _importBulletinFiles(files,after){{
    if(!files.length)return;
    _infoToast('Lecture du bulletin…');
    var ok=[],bad=0,rep=0;
    for(var i=0;i<files.length;i++){
      try{var b=_bulParse(await _pdfLines(files[i]));if(b){b.at=Date.now();if(!S.bulletins)S.bulletins={};if(S.bulletins[b.ym])rep++;S.bulletins[b.ym]=b;ok.push(b.ym);}else bad++;}
      catch(e){console.warn('bulletin',e);bad++;}
    }
    if(ok.length)saveState();
    // un bulletin du même mois remplace l'ancien : dit dans le message
    var msg=ok.length?(ok.length===1?'Bulletin '+_deMois(ok[0])+' '+Math.floor(ok[0]/12)+(rep?' remplacé':' importé'):ok.length+' bulletins importés'+(rep?' ('+rep+' remplacé'+(rep>1?'s':'')+')':'')):'';
    if(bad)msg+=(msg?' · ':'')+(bad===1?'1 fichier illisible':bad+' fichiers illisibles')+(navigator.onLine===false?' (hors ligne)':'');
    _infoToast(msg);
    if(ok.length){ok.sort(function(a,b){return a-b;});render();var _last=ok[ok.length-1];_bulPayPropose(after||function(){openBulletinModal(_last);});}
    else if(after)after();
}}


async function deleteBulletin(ym){
  if(!await _ask('Retirer le bulletin '+_deMois(ym)+' '+Math.floor(ym/12)+' ?',{ok:'Retirer',del:1}))return;
  if(S.bulletins)delete S.bulletins[ym];saveState();openBulletinModal(ym);
}
function useBulletinCompCP(ym){
  var b=(S.bulletins||{})[ym];if(!b||b.epv==null)return;var pr=S.profile;if(!pr.compCPManual)pr.compCPManual={};
  pr.compCPManual[Math.floor(ym/12)]=b.epv;saveState();render();openBulletinModal(ym);
}









function bulIgnL(ym,id,on){var pr=S.profile,c=_bulCompare(S.bulletins[ym]),it=c.items.filter(function(i){return i.id===id;})[0];delete pr.ignBul;
  if(!pr.ignBulL)pr.ignBulL={};var m=pr.ignBulL[ym]||(pr.ignBulL[ym]={});
  if(id==='*')c.items.forEach(function(i){if(on)m[i.id]=i.d;else delete m[i.id];}); // tout ignorer / ne plus rien ignorer
  else if(on&&it)m[id]=it.d;else delete m[id];if(!Object.keys(m).length)delete pr.ignBulL[ym];
  var sh=document.querySelector('#modal-root .sheet'),st=sh?sh.scrollTop:0;saveState();render();openBulletinModal(ym);var s2=document.querySelector('#modal-root .sheet');if(s2){s2.style.animation='none';s2.scrollTop=st;}}

function rhIgnC(k,v,on){pushUndo(/^(acq|wkm)/.test(k)?(on?'Différence reprise du tableau':'Reprise du tableau annulée'):(on?'Différence ignorée':'Différence de nouveau comptée'));var pr=S.profile;if(!pr.ignRhC)pr.ignRhC={};if(on)pr.ignRhC[k]=v;else delete pr.ignRhC[k];delete pr.ignRh;try{recalcAllMatelas();}catch(e){}saveState();rhOpenFrom(window._rvFrom||'recap');render();}


function openBulletinModal(ym,from){
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  var y=Math.floor(ym/12),cy=TODAY_YM!=null?Math.floor(TODAY_YM/12):y,arr='font-size:18px;padding:0 10px;color:var(--text2);cursor:pointer;user-select:none';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet pp-sheet"><div class="sh"></div>'
    +'<div class="nav-back" style="'+_navBackCss+'" onclick="openBulletinsCal('+y+')">‹ Paie '+y+'</div>'
    +'<div class="st" style="display:flex;align-items:center;justify-content:space-between"><span style="'+arr+'" onclick="_swipeGo(-1,function(){openBulletinModal('+(ym-1)+')})">‹</span><span>Paie '+_deMois(ym)+(y!==cy?' '+y:'')+'</span><span style="'+arr+'" onclick="_swipeGo(1,function(){openBulletinModal('+(ym+1)+')})">›</span></div>'
    +_payPageHtml(ym)
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button></div></div>';
  _swipeNav(function(nd){openBulletinModal(ym+nd);},function(){openBulletinsCal(Math.floor(ym/12));});
}





function openPaniersModal(){
  document.querySelectorAll('[onclick*="openPaniersModal"]').forEach(el=>el.classList.add('active'));
  _lockBodyScroll();
  const VAC=getVAC();
  const ML2=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const JOURS_L2=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  const last=new Date(curY,curM+1,0).getDate();
  const mym_p=curY*12+curM,seenW_p=new Set();
  const paniers=[],pa=[],pr=[],pc=[],pm=[];
  for(let dd=-6;dd<last;dd++){
    const _dp=new Date(curY,curM,1+dd),mon=getMonday(_dp),mk=dk(mon);
    if(seenW_p.has(mk))continue;seenW_p.add(mk);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    if(sun.getFullYear()*12+sun.getMonth()!==mym_p)continue;
    for(let i=0;i<7;i++){
      const date=new Date(mon);date.setDate(mon.getDate()+i);const key=dk(date);
      if((S.conges||{})[key])continue;
      const{vac,absent,echange,ecSelf}=getVac(date);
      if(absent||!vac||vac==='RH'||(echange&&!ecSelf))continue;
      const v=VAC[vac];if(!v)continue;
      const jidx=date.getDay();
      const lbl=JOURS_L2[jidx===0?6:jidx-1]+' '+date.getDate()+' '+ML2[date.getMonth()];
      const entry={lbl,vac,wk:isoWeek(date)};
      if(v.panier)paniers.push(entry);
      if(v.deb&&_toMinApp(v.deb)<240)pm.push(entry);
      if(v.primes){if(v.primes.antenne)pa.push(entry);if(v.primes.reel)pr.push(entry);if(v.primes.coord)pc.push(entry);}
    }
  }
  let _pid2=0;
  function sec(title,entries){
    if(!entries.length)return'';
    const weeks=[],wmap={};
    entries.forEach(e=>{if(!wmap[e.wk]){wmap[e.wk]=[];weeks.push(e.wk);}wmap[e.wk].push(e);});
    let h='<div class="btit" style="margin-top:14px;margin-bottom:4px">'+title+' <span style="font-weight:400;color:var(--text3)">('+entries.length+')</span></div>';
    weeks.forEach(wk=>{
      const days=wmap[wk],id='_pa'+(++_pid2);
      h+='<div onclick="_ptog(\''+id+'\')" style="font-size:11px;padding:5px 0;border-bottom:0.5px solid var(--border2);cursor:pointer">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:0">'
        +'<span style="font-weight:500;color:var(--text)"><span id="'+id+'c" style="display:inline-block;transition:transform .15s;margin-right:4px">›</span>Semaine '+wk+'</span>'
        +'<span style="color:var(--text2)">'+days.length+'j</span>'
        +'</div>'
        +'<div id="'+id+'" style="display:none">'
        +days.map(e=>'<div style="display:flex;justify-content:space-between;padding:1px 0 1px 8px"><span style="color:var(--text3)">'+e.lbl+'</span><b style="color:var(--amber)">'+e.vac+'</b></div>').join('')
        +'</div>'
        +'</div>';
    });
    return h;
  }
  const noData='<div style="font-size:11px;color:var(--text3);padding:6px 0">Aucun ce mois.</div>';
  let html=sec('Paniers',paniers)+sec('Prime matin',pm)+sec('Prime antenne',pa)+sec('Prime réal',pr)+sec('Prime coord',pc);
  if(!html)html=noData;
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Paniers & Primes — '+MC[curM]+' '+curY+'</div>'
    +html
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
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
function setEphExt(ym,n){
  if(!S.ephExtend)S.ephExtend={};
  if(getEphExtensions(ym)===n){delete S.ephExtend[ym];}else{S.ephExtend[ym]=n;}
  saveState();render();
}
// ================================================================
// RECAP
// ================================================================
function updateRecap(){
  const el=document.getElementById('recap-content');if(!el)return;
  const usedCurY=calcCongesUsedForYear(NOW.getFullYear());
  const soldeCurY=getSoldeAnnee(NOW.getFullYear());
  const restCurY=Math.max(0,soldeCurY-usedCurY);
  const rendusMin=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').reduce((s,k)=>s+getDur(new Date(k+'T12:00:00')),0);
  el.innerHTML='<div class="recap-row"><span>Congés '+NOW.getFullYear()+' restants</span><b style="color:var(--green)">'+restCurY+' j</b></div>'
    +'<div class="recap-row"><span>Rendus posés</span><b style="color:var(--rend-text)">'+fmtMin(rendusMin)+'</b></div>';
}

// Bloc dépliant du récapitulatif (l'état ouvert/fermé est gardé pendant la session)
var _foldOpen={},_foldAnim={'fold-annee':function(el){_cptAnim(el.querySelector('#cpt-card'));}};
// Anneaux des compteurs : ils se remplissent et les chiffres défilent à chaque ouverture
// La courbe se dessine de gauche à droite
function _cvAnim(el){
  var bs=el.querySelectorAll('.cv-b');bs.forEach(function(b){b.style.transition='none';b.style.transform='scaleY(0)';});
  requestAnimationFrame(function(){requestAnimationFrame(function(){bs.forEach(function(b,k){b.style.transition='transform .45s cubic-bezier(.3,1.2,.5,1) '+(k*.025).toFixed(3)+'s';b.style.transform='';});});});
  el.querySelectorAll('.cv-u').forEach(function(x){if(!x.getTotalLength)return;var L=x.getTotalLength();x.style.transition='none';x.style.strokeDasharray=L;x.style.strokeDashoffset=L;void x.getBoundingClientRect();requestAnimationFrame(function(){x.style.transition='stroke-dashoffset 1.1s cubic-bezier(.25,.8,.25,1) .15s';x.style.strokeDashoffset=0;});});
  var cl=el.querySelector('.cv-l:not(.cv-u)'),ca=el.querySelector('.cv-a'),cp=el.querySelectorAll('.cv-p');
  if(cl&&cl.getTotalLength){var L=cl.getTotalLength();cl.style.transition='none';cl.style.strokeDasharray=L;cl.style.strokeDashoffset=L;if(ca){ca.style.transition='none';ca.style.opacity=0;}cp.forEach(function(p){p.style.transition='none';p.style.opacity=0;});
    void cl.getBoundingClientRect();requestAnimationFrame(function(){cl.style.transition='stroke-dashoffset 1.1s cubic-bezier(.25,.8,.25,1)';cl.style.strokeDashoffset=0;
      if(ca){ca.style.transition='opacity .6s ease .5s';ca.style.opacity=1;}cp.forEach(function(p){p.style.transition='opacity .2s ease 1s';p.style.opacity=1;});});}
}
function _cptAnim(el){if(!el)return;
  _cvAnim(el);
  var cs=el.querySelectorAll('circle[data-c]'),ns=el.querySelectorAll('b[data-n]'),D=1300;
  el.classList.add('cp-anim');
  cs.forEach(function(c){c.style.transition='none';c.style.strokeDashoffset=c.dataset.c;});
  var caps=el.querySelectorAll('.ring-cap');caps.forEach(function(c){c.style.transition='none';c.style.opacity=0;});
  void el.offsetWidth;el.classList.remove('cp-anim');
  requestAnimationFrame(function(){cs.forEach(function(c){var ov=c.classList.contains('ring-over');
    c.style.transition='stroke-dashoffset '+(ov?.7:D/1000)+'s cubic-bezier(.25,.8,.25,1) '+(ov?(D-200)/1000:0)+'s';c.style.strokeDashoffset=c.dataset.o;});
    caps.forEach(function(c){c.style.transition='opacity .15s ease '+((D-200+650)/1000)+'s';c.style.opacity=1;});});
  var t0=performance.now();
  (function step(t){var k=Math.min(1,Math.max(0,(t-t0)/D)),e=1-Math.pow(1-k,3);
    ns.forEach(function(n){var v=Math.round(+n.dataset.n*e),u=n.dataset.u;n.textContent=u==='h'?fmtMin(v).replace(/h00$/,'h'):v+(u==='j'?' j':'');});
    if(k<1)requestAnimationFrame(step);})(t0);
}
function _fold(id,icon,color,title,sub,val,body){
  return '<details class="fold" id="'+id+'"'+(_foldOpen[id]?' open':'')+' ontoggle="_foldOpen[this.id]=this.open;if(this.open&&_foldAnim[this.id])_foldAnim[this.id](this)"><summary>'
    +'<span class="fh"><div class="ft">'+title+'</div>'+(sub?'<div class="fs">'+sub+'</div>':'')+'</span>'
    +'<span class="fv" style="color:'+color+'">'+val+'</span><i class="ti ti-chevron-down"></i></summary><div class="fb">'+body+'</div></details>';
}
// Heures de rendus acquises mois par mois, comparées au dernier tableau Gestion importé
function _rhAcqCheck(){
  var o=S.profile&&S.profile.rhTable;if(!o)return null;
  if(window._rhAcqC&&window._rhAcqC.at===o.at)return window._rhAcqC.r;
  var rh=_rhStored();if(!rh)return null;
  var ed=rh.edition,asOfYM=ed.getFullYear()*12+ed.getMonth(),sheet={};
  rh.lines.forEach(function(l){if(l.nature)sheet[l.ym]=(sheet[l.ym]||0)+l.acq;});
  var r={asOfYM:asOfYM,ed:ed,sheet:sheet};window._rhAcqC={at:o.at,r:r};return r;
}

// ── Suivi : vue simple (imports + écarts en bref) ou complète (tous les blocs) ──
function _suiviSimple(y){
  // Accueil des problèmes : imports, écart avec le tableau Gestion, bulletins à vérifier
  var c=S.profile&&S.profile.rhCmp,o=S.profile&&S.profile.rhTable,g;
  // tableau gardé mais comparaison pas encore faite (restauration, changement de départ) : calculée ici, une fois
  if(o&&!c){var _ck=(o.at||'')+'|'+((S.profile.start||{}).d||'');if(window._rhCmpTry!==_ck){window._rhCmpTry=_ck;try{var _r=_rhStored();if(_r)rhCompareShow(_r,true);}catch(e){}}c=S.profile.rhCmp;}
  if(!o)g='<button class="sv-tile" onclick="rhOpenFromRecap(true)"><span class="t">Écart Rendus</span><b style="color:var(--text3)">—</b><small>aucun tableau importé</small></button>';
  else if(!c)g='<button class="sv-tile" onclick="rhOpenFromRecap()"><span class="t">Écart Rendus</span><b style="color:var(--text3)">—</b><small>tableau pas plus récent que le départ</small></button>';
  else{var e0=-c.d,e=-_rhDe(c),ok=Math.abs(e0)<2,ig=!ok&&Math.abs(e)<2,part=!ok&&!ig&&Math.abs(e-e0)>=2;
    g='<button class="sv-tile" onclick="rhOpenFromRecap()"><span class="t">Écart Rendus</span><b style="color:'+(ok||e0>0?'var(--green)':'var(--red)')+'">'+(ok?'✓':(e0>0?'+':'−')+fmtMin(Math.abs(e0)))+'</b><small>'+(ok?'identique':(e0>0?'favorable':'à faire corriger')+(ig?'<br>différences ignorées':part?'<br>en partie ignoré':''))+'<br><span style="white-space:nowrap">Tableau du '+new Date(c.ed+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+'</span>'+'</small></button>';}
  // Bulletins : ce qui n'a pas été perçu (somme des écarts négatifs, ligne par ligne), le trop perçu, puis le solde des deux
  var E=_bulEcart(),nB=E.nB,nBad=E.nBad,nPb=E.nPb,nOld=E.nOld,nIg=E.nIg,neg=E.neg,pos=E.pos,last=E.last,bal=E.bal,hasN=E.hasN,hasP=E.hasP;
  var _bk=nIg?'<br>'+nIg+' bulletin'+(nIg>1?'s':'')+' ignoré'+(nIg>1?'s':''):'',_bl=last!=null?'<br><span style="white-space:nowrap">Dernier : '+_deMois(last).replace(/^d[e’']\s?/,'')+' '+Math.floor(last/12)+'</span>':'';
  var big=!nB?'—':!nBad?'✓':hasN?'−'+fmtEuro(-neg):hasP?'+'+fmtEuro(pos):'⚠ '+nPb,bigC=!nB?'var(--text3)':!nBad?'var(--green)':hasN?'var(--red)':hasP?'var(--green)':'var(--amber)';
  var det=!nB?'aucun bulletin importé':!nBad?(nB+' bulletin'+(nB>1?'s':'')+' conforme'+(nB>1?'s':''))+_bk+_bl
    :(hasN?'non perçu'+(hasP?'<br><b style="color:var(--green);font-size:13px">+'+fmtEuro(pos)+'</b> trop perçu<br><b style="color:'+(bal<0?'var(--red)':'var(--green)')+';font-size:13px">'+(bal<0?'−':'+')+fmtEuro(Math.abs(bal))+'</b> solde':'')+'<br>':hasP?'trop perçu<br>':'')
      +nPb+' problème'+(nPb>1?'s':'')+' sur '+nBad+' bulletin'+(nBad>1?'s':'')+(nOld?'<br>dont '+nOld+' des années précédentes':'')+_bk+_bl;
  var bl='<button class="sv-tile" onclick="openBulletinsCal()"><span class="t">Écart Paie</span><b style="color:'+bigC+'">'+big+'</b><small>'+det+'</small></button>';
  return '<div class="ct-t">À vérifier</div>'+_suiviFacts(c,o,E)+'<div class="ct-t">Écarts</div><div class="sv-tiles">'+g+bl+'</div>';
}
// Contrôle : derniers imports (tableau Gestion, bulletins), chacun avec son bouton, puis le mail au gestionnaire
function _ctImports(){var T=null;try{T=_rhStored();}catch(e){}var E=_bulEcart(),MF=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var row=function(ic,col,t,sub,js){return '<div class="ct-r"><i class="ti '+ic+'" style="color:'+col+'"></i><span><b>'+t+'</b><small>'+sub+'</small></span><button onclick="'+js+'">Importer</button></div>';};
  return '<div class="ct-t">Derniers imports</div><div class="hd-card ct-c">'
    +row('ti-table','var(--rend-text)','Tableau Gestion',T&&T.edition?'du '+T.edition.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'aucun',T?'rhCompareOpen()':'rhOpenFromRecap(true)')
    +row('ti-file-invoice','var(--blue)','Bulletins',E.nB?MF[E.last%12]+' '+Math.floor(E.last/12)+' · '+E.nB+' importé'+(E.nB>1?'s':''):'aucun','window._bulFrom=\'recap\';importBulletins()')
    +'</div><button class="rv-b2 ct-m" onclick="openGestMail()"><i class="ti ti-mail"></i>Mail au gestionnaire</button><div style="height:12px"></div>';}
// En haut de Suivi : les faits, une ligne chacun (différences, imports manquants, heures qui expirent), sans conseil
function _suiviFacts(c,o,E,raw){var L=[],RW=[],M=function(ym){return _deMois(ym).replace(/^d[e’']\s?/,'')+(Math.floor(ym/12)!==NOW.getFullYear()?' '+Math.floor(ym/12):'');},
    row=function(ic,col,t,fn){RW.push({ic:ic,col:col,t:t});L.push('<div onclick="'+fn+'" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-top:0.5px solid var(--border2);cursor:pointer"><i class="ti '+ic+'" style="color:'+col+';font-size:16px"></i><span style="flex:1;font-size:13px">'+t+'</span><i class="ti ti-chevron-right" style="color:var(--text3);font-size:15px"></i></div>');};
  var _nl=(c&&c.lost||[]).length,_nd=c?Math.max(0,(c.n||0)-_nl):0;
  if(_nd)row('ti-alert-circle','var(--amber)','Tableau Gestion : '+_nd+' différence'+(_nd>1?'s':''),'rhOpenFromRecap()');
  (c&&c.lost||[]).forEach(function(x){row('ti-clock-exclamation','var(--amber)',fmtMin(x.min)+' de '+M(x.ym)+' sans report officiel (expirées le '+new Date(x.v+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+')','rhOpenFromRecap()');});
  var exp=NOW.getDate()>=20?TODAY_YM:TODAY_YM-1;
  if(!o)row('ti-file-import','var(--blue)','Tableau Gestion : aucun importé','rhOpenFromRecap(true)');
  else{var T=null;try{T=_rhStored();}catch(e){}if(T){var ey=T.edition.getFullYear()*12+T.edition.getMonth();if(ey<exp)row('ti-file-import','var(--blue)','Tableau Gestion '+_deMois(exp)+' : pas importé','rhCompareOpen()');}}
  if(E&&E.nBad)row('ti-alert-circle','var(--amber)','Paie : '+E.nPb+' écart'+(E.nPb>1?'s':'')+' sur '+E.nBad+' bulletin'+(E.nBad>1?'s':''),'openBulletinsCal()');
  if(E&&E.nB&&!(S.bulletins||{})[TODAY_YM-1])row('ti-file-import','var(--blue)','Bulletin '+_deMois(TODAY_YM-1)+' : pas importé','window._bulFrom=\'recap\';importBulletins()');
  // règles de travail : du mois dernier aux 2 mois à venir
  try{var RS=_ruleScanNow(),fd=function(k){var d=new Date(k+'T12:00:00');return d.getDate()+' '+MCs[d.getMonth()];};
    if(RS.hard.length)row('ti-alert-triangle','var(--red)','Repos de moins de 9h : '+RS.hard.slice(0,3).map(fd).join(', ')+(RS.hard.length>3?'…':''),'pendingKey=\''+RS.hard[0]+'\';openDay(\''+RS.hard[0]+'\')');
    if(RS.rest.length)row('ti-alert-triangle','var(--amber)','Repos de moins de 11h : '+RS.rest.slice(0,3).map(fd).join(', ')+(RS.rest.length>3?'…':''),'pendingKey=\''+RS.rest[0]+'\';openDay(\''+RS.rest[0]+'\')');
    if(RS.streak.length)row('ti-alert-triangle','var(--amber)','Au-delà de 6 jours d’affilée : '+RS.streak.slice(0,3).map(fd).join(', ')+(RS.streak.length>3?'…':''),'pendingKey=\''+RS.streak[0]+'\';openDay(\''+RS.streak[0]+'\')');}catch(e){}
  if(raw)return RW;
  return '<div class="hd-card" style="padding:4px 12px 2px;margin-bottom:8px">'+(L.length?L.join('').replace('border-top:0.5px solid var(--border2);',''):'<div style="display:flex;align-items:center;gap:10px;padding:10px 2px;font-size:13px;color:var(--green)"><i class="ti ti-circle-check" style="font-size:16px"></i>Tout est à jour</div>')+'</div>';}
// Paie de l'année (calendrier des bulletins) : tous les mois de l'année, toucher un mois ouvre sa page Paie
function openBulletinsCal(y){
  if(y==null)y=window._svYear||NOW.getFullYear();window._svYear=y;
  var arr='font-size:18px;padding:0 10px;color:var(--text2);cursor:pointer;user-select:none';
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet tabmod"><div class="sh"></div>'
    +'<div class="nav-back" style="'+_navBackCss+'" onclick="openMergedRenduCgModal(6,2)">‹ '+(_isPhone()?'Contrôle':'Suivi')+'</div>'
    +'<div class="st" style="display:flex;align-items:center;justify-content:space-between"><span style="'+arr+'" onclick="_svYearGo('+(y-1)+')">‹</span><span>Paie '+y+'</span><span style="'+arr+'" onclick="_svYearGo('+(y+1)+')">›</span></div><div id="sv-sal" style="padding:0 12px">'+_svSalHtml(y)+'</div>'
    +'<div style="display:flex;gap:8px;margin:14px 0 14px"><button onclick="window._bulFrom=\'recap\';importBulletins()" style="white-space:nowrap;font-size:11px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:var(--btn);cursor:pointer;font-family:var(--font);color:var(--text2)"><i class="ti ti-file-import" style="margin-right:4px"></i>Importer des bulletins</button>'
      +'</div>'
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button></div></div>';
  _swipeNav(function(nd){window._svYear=y+nd;openBulletinsCal(y+nd);},function(){openMergedRenduCgModal(6,2);}); // glisser : année voisine ; depuis le bord gauche : retour à Suivi
}

function _svYearGo(y){var cur=window._svYear||NOW.getFullYear();_swipeGo(y>cur?1:-1,function(){openBulletinsCal(y);});}

_ringSvg.n=0;




// Appui sur un mois : ses heures acquises et posées (l'an dernier en plus) ; nouvel appui : retour au total
function _cvTap(i){var D=window._cvD,c=document.getElementById('cv-sel'),cap=document.getElementById('cv-cap'),val=document.getElementById('cv-val');if(!D||!c)return;
  if(D.sel===i){D.sel=null;c.style.display='none';cap.textContent='Rendus '+D.since;val.innerHTML=_cvVal(D.sA,D.sU,D.cur>=0?D.R[D.cur]:null);return;}
  D.sel=i;_haptic();c.setAttribute('x1',D.X(i));c.setAttribute('x2',D.X(i));c.style.display='';
  cap.textContent=MC[i].charAt(0).toUpperCase()+MC[i].slice(1)+' '+D.y+(i>D.cur?' (à venir)':'')+(D.hasB?' · '+(D.y-1)+' : +'+fmtMin(D.b[i])+' −'+fmtMin(D.bu[i]):'');val.innerHTML=_cvVal(D.a[i],D.u[i],D.R[i]);}

function openRecapModal(){
  document.querySelectorAll('[onclick*="openRecapModal"]').forEach(el=>el.classList.add('active'));_lockBodyScroll();
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const used=calcCongesUsedForYear(NOW.getFullYear());
  const soldeCurY=getSoldeAnnee(NOW.getFullYear());
  const restCurY=Math.max(0,soldeCurY-used);
  const cgKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').sort();
  const rendKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').sort();
  const rendusMin=rendKeys.reduce(function(s,k){return s+getDur(new Date(k+'T12:00:00'));},0);
  const cs=calcSoldes();

  function groupByMonth(keys){const g={};keys.forEach(function(k){const d=new Date(k+'T12:00:00'),ym=d.getFullYear()*12+d.getMonth();if(!g[ym])g[ym]=[];g[ym].push(k);});return g;}
  const cgByMonth=groupByMonth(cgKeys),rendByMonth=groupByMonth(rendKeys);

  function monthSection(byMonth,type){
    return Object.keys(byMonth).map(Number).sort().map(function(ym){
      const y=Math.floor(ym/12),m=ym%12,days=byMonth[ym];
      const val=type==='cg'?calcCongesUsedForKeys(days,cgKeys)+' j':fmtMin(days.reduce(function(s,k){return s+getDur(new Date(k+'T12:00:00'));},0));
      const color=type==='cg'?'var(--green)':'var(--rend-text)';
      const detail=days.map(function(k){const d=new Date(k+'T12:00:00');return'<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:var(--text2)"><span>'+fmtDate(d)+'</span>'+(type==='rend'?'<span>'+fmtMin(getDur(d))+'</span>':'')+'</div>';}).join('');
      return'<div style="margin-bottom:2px"><div data-tid="r-'+type+'-'+ym+'" style="display:flex;justify-content:space-between;cursor:pointer;padding:5px 0;border-bottom:0.5px solid var(--border2)" onclick="toggleRecapMonth(this)"><span style="font-size:13px;color:var(--text2)">'+MC[m]+' '+y+'</span><span style="font-size:13px;font-weight:500;color:'+color+'">'+val+' ▸</span></div><div id="r-'+type+'-'+ym+'" style="display:none;padding:4px 0 4px 8px">'+detail+'</div></div>';
    }).join('');
  }

  const cgHtml=monthSection(cgByMonth,'cg')||'<div style="font-size:11px;color:var(--text3);padding:4px 0">Aucun congé posé.</div>';
  const rendHtml=monthSection(rendByMonth,'rend')||'<div style="font-size:11px;color:var(--text3);padding:4px 0">Aucun rendu posé.</div>';

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Suivi</div>'
    +'<div class="recap-row" style="font-size:13px;font-weight:600"><span>Congés '+NOW.getFullYear()+' restants</span><b style="color:var(--green)">'+restCurY+' j</b></div>'
    +'<div class="recap-row" style="font-size:13px;font-weight:600"><span>Rendus posés</span><b style="color:var(--rend-text)">'+fmtMin(rendusMin)+'</b></div>'
    +'<div class="recap-row" style="font-size:13px;font-weight:600;margin-bottom:12px"><span>Éphem. dispo</span><b style="color:var(--blue)">'+fmtMin(cs.totalReal)+'</b></div>'
    +'<div class="btit" style="margin-bottom:4px;margin-top:4px">Congés</div>'
    +cgHtml
    +'<div class="btit" style="margin-bottom:4px;margin-top:8px">Rendus</div>'
    +rendHtml
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

// No side panel history — use modal

function logH(detail,color,key){
  if(!S.history)S.history=[];S.history.unshift({t:nowHHMM(),d:detail,c:color,key});
  if(S.history.length>8)S.history.pop();saveState();
}


function removeHistoryForKey(key){if(!S.history)return;S.history=S.history.filter(h=>h.key!==key);saveState();}

function renderHistoryDropdown(){
  const el=document.getElementById('dd-history-content');if(!el)return;
  const usedCurY=calcCongesUsedForYear(NOW.getFullYear());
  const rendusMin=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').reduce((s,k)=>s+getDur(new Date(k+'T12:00:00')),0);
  const cgKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').sort();
  const rdKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').sort();
  const cgSections=_rhMonthSections(cgKeys,'cg')||'<div style="font-size:11px;color:var(--text3);padding:2px 0">Aucun congé.</div>';
  const rdSections=_rhMonthSections(rdKeys,'rend')||'<div style="font-size:11px;color:var(--text3);padding:2px 0">Aucun rendu.</div>';
  const recapHtml=
    '<div class="recap-row" style="font-size:13px;font-weight:600"><span>Congés '+NOW.getFullYear()+' posés</span><b style="color:var(--green)">'+usedCurY+' j</b></div>'
    +'<div style="margin-bottom:8px">'+cgSections+'</div>'
    +'<div class="recap-row" style="font-size:13px;font-weight:600"><span>Rendus posés</span><b style="color:var(--rend-text)">'+fmtMin(rendusMin)+'</b></div>'
    +'<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:0.5px solid var(--border2)">'+rdSections+'</div>';
  const h=(S.history||[]).slice(0,8);
  const histHtml=h.length
    ?h.map(e=>'<div class="hrow"><div class="hdot" style="background:'+e.c+'"></div><span class="htime">'+e.t+'</span><span class="hdesc">'+_histTxt(e.d)+'</span></div>').join('')
    :'<span style="font-size:11px;color:var(--text3)">Aucune modification.</span>';
  el.innerHTML='<div class="dd-title">Suivi</div>'+recapHtml+'<div class="dd-title">Historique</div>'+histHtml;
}
function openHistoryModal(){
  const h=S.history||[];
  const html=h.length?h.map(e=>`<div class="hrow"><div class="hdot" style="background:${e.c}"></div><span class="htime">${e.t}</span><span class="hdesc">${_histTxt(e.d)}</span></div>`).join(''):'<span style="font-size:11px;color:var(--text3)">Aucune modification.</span>';
  document.getElementById('modal-root').innerHTML=`<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Historique</div>${html}<button class="mcancel mclose" onclick="closeModal()">Fermer</button></div></div>`;
}



 // backup of pendingKey for avw()

// Glisser à gauche / à droite dans une fiche : go(+1) suivant, go(-1) précédent, avec l'effet de page qui glisse
// go(+1/−1) : page suivante / précédente ; back : retour (glisser vers la droite, depuis le bord gauche si go existe)
function _swipeNav(go,back){
  var sh=document.querySelector('#modal-root .sheet');if(!sh)return;
  var d=window._dayNavDir||0;window._dayNavDir=0;
  if(d){
    sh.style.animation='none';_swipeKids(sh,'none','translateX('+(d*106)+'%)');void sh.offsetWidth;
    _swipeKids(sh,'transform .3s cubic-bezier(.2,.8,.2,1)','');
    // la hauteur du fond passe en douceur de l'ancienne page à la nouvelle
    var h0=window._swH,h1=sh.offsetHeight;
    if(h0&&Math.abs(h0-h1)>1){sh.style.height=h0+'px';void sh.offsetWidth;sh.style.transition='height .3s cubic-bezier(.2,.8,.2,1)';sh.style.height=h1+'px';}
    setTimeout(function(){_swipeKids(sh,'','');sh.style.overflowX='';sh.style.height='';sh.style.transition='';},320);
  }
  var sx=0,sy=0,skip=false,lock=0;
  sh.addEventListener('touchstart',function(e){skip=!!e.target.closest('input,select,textarea')||e.touches.length>1;sx=e.touches[0].clientX;sy=e.touches[0].clientY;lock=0;},{passive:true});
  // geste horizontal reconnu : plus de défilement vertical (sinon le contenu remonte de quelques px juste avant de glisser)
  if(go)sh.addEventListener('touchmove',function(e){if(skip||lock<0||window._edgeOn)return;var dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;
    if(!lock){if(Math.abs(dx)<8&&Math.abs(dy)<8)return;lock=Math.abs(dx)>Math.abs(dy)?1:-1;}
    if(lock>0&&e.cancelable)e.preventDefault();},{passive:false});
  sh.addEventListener('touchend',function(e){
    if(skip||window._edgeOn)return; // retour par le bord gauche en cours (sous-pages)
    var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;
    if(back&&dx>0&&(!go||sx<32)){_swipeGo(-1,back);return;}
    if(go)_swipeGo(dx<0?1:-1,go);
  },{passive:true});
}
// Seul le contenu glisse : le fond de la fiche et sa poignée restent en place
function _swipeKids(sh,tr,tf){
  sh.style.overflowX='hidden';
  [].forEach.call(sh.children,function(el){if(el.classList.contains('sh')||el.classList.contains('nav-back'))return;el.style.transition=tr;el.style.transform=tf;});
}
// Défilement de l'accueil sur téléphone : seulement quand le contenu dépasse l'écran
function _fitScroll(){
  var b=document.body;if(!b)return;
  if(!_isPhone()||b.classList.contains('modal-open')){if(!_isPhone())b.classList.remove('can-scroll');return;}
  var a=document.getElementById('app');if(!a)return;
  var need=a.getBoundingClientRect().height+(parseFloat(getComputedStyle(b).paddingTop)||0)>innerHeight+1;
  b.classList.toggle('can-scroll',need);if(!need)b.scrollTop=0;
}
window.addEventListener('resize',_fitScroll);
// Téléphone : tout l'accueil tient au-dessus de la barre d'onglets ; les cases du calendrier s'aplatissent juste ce qu'il faut
// (jusqu'à 62 % de leur largeur), au-delà la page défile ; s'il reste de la place, elles grandissent (jusqu'à 130 %)
// Téléphone : bouton menu aligné sur le bord droit des cases du calendrier
function _hdrAlign(){if(!_isPhone()||_isLand()){var h0=document.querySelector('.hdr');if(h0)h0.style.removeProperty('padding-right');return;}var h=document.querySelector('.hdr'),cw=document.querySelector('#month-view .cal-wrap')||document.querySelector('.cal-wrap');
  var r=cw&&cw.getBoundingClientRect();if(h&&r&&r.width>100)h.style.setProperty('padding-right',Math.max(8,Math.round(innerWidth-r.right))+'px','important');}
// iPhone à l'horizontale : calendrier à gauche, à la plus grande taille qui tient en hauteur ; les soldes à droite
function _fitLand(){var col=document.querySelector('.cal-col'),cw=document.querySelector('#month-view .cal-wrap'),R=document.documentElement;if(!col||!cw)return;
  var top=col.getBoundingClientRect().top,avail=innerHeight-top-10,w=parseFloat(R.style.getPropertyValue('--lcw'))||innerWidth*.5;
  for(var k=0;k<2;k++){R.style.setProperty('--lcw',w+'px');var h=cw.getBoundingClientRect().bottom-top;if(!h)break;w=Math.max(innerWidth*.38,Math.min(innerWidth*.6,Math.floor(w*avail/h)));}
  w=Math.max(innerWidth*.36,Math.min(innerWidth*.52,w)); // toute la hauteur, sans dépasser la moitié de l'écran environ : de la place pour les soldes
  R.style.setProperty('--lcw',w+'px');}
function _fitPhone(){_hdrAlign();if(_isLand()){_fitLand();return;}
  if(innerWidth>480)return;var v2=document.getElementById('side-v2'),bar=document.getElementById('tabbar'),c=document.querySelector('#cal .dc');
  if(!v2||!v2.offsetHeight||!bar||!c||!c.offsetWidth)return;
  var R=document.documentElement,p=parseFloat(R.style.getPropertyValue('--dcp'))||1.05,top=innerHeight-(parseFloat(getComputedStyle(bar).bottom)||0)-bar.offsetHeight-18; // pas sa position à l'écran : effacée sous une fenêtre, elle est plus bas
  var D=v2.getBoundingClientRect().bottom+(document.body.scrollTop||0)-top,np=Math.max(0.62,Math.min(1.3,p-D/(6*c.offsetWidth)));
  if(Math.abs(np-p)>0.004){R.style.setProperty('--dcp',np.toFixed(3));requestAnimationFrame(_fitScroll);}
}
function _fitPhoneSoon(){cancelAnimationFrame(_fpT);_fpT=requestAnimationFrame(_fitPhone);}
window.addEventListener('resize',_fitPhoneSoon);
document.addEventListener('DOMContentLoaded',function(){try{new ResizeObserver(_fitPhoneSoon).observe(document.getElementById('side-v2'));}catch(e){}});
document.addEventListener('DOMContentLoaded',function(){try{new ResizeObserver(_fitScroll).observe(document.getElementById('app'));}catch(e){}_fitScroll();});
// Retour haptique léger : vibration sur Android ; sur iPhone (iOS 18+), cliquer le libellé d'un interrupteur « switch »
// fait jouer le retour haptique du système. Méthode de la bibliothèque ios-haptics : élément neuf à chaque fois, masqué, retiré aussitôt
function _haptic(){
  if(_hapOff())return;
  try{if(navigator.vibrate&&navigator.vibrate(8))return;}catch(e){}
  if(Date.now()-(window._hapAt||0)<500)return; // déjà joué par l'interrupteur sous le doigt (voir plus bas)
  try{var l=document.createElement('label');l.setAttribute('aria-hidden','true');l.style.display='none';
    var i=document.createElement('input');i.type='checkbox';i.setAttribute('switch','');l.appendChild(i);
    document.head.appendChild(l);l.click();document.head.removeChild(l);}catch(e){}
}


function _hapArm(){
  document.querySelectorAll(_HAP_SEL).forEach(function(b){
    if(b.querySelector(':scope>.hap-sw')||b.querySelector('input,select,textarea')||b.closest('label'))return;
    if(getComputedStyle(b).position==='static')b.style.position='relative';
    var i=document.createElement('input');i.type='checkbox';i.setAttribute('switch','');i.className='hap-sw';i.tabIndex=-1;i.setAttribute('aria-hidden','true');
    i.addEventListener('click',function(){window._hapAt=Date.now();});
    b.appendChild(i);});
}
(function(){
  var ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!ios||navigator.vibrate||_hapOff())return;
  var q=false;function go(){q=false;_hapArm();}
  new MutationObserver(function(){if(!q){q=true;requestAnimationFrame(go);}}).observe(document.documentElement,{childList:true,subtree:true});
})();
function _swipeGo(nd,go){
  _haptic();
  var sh=document.querySelector('#modal-root .sheet');if(!sh){go(nd);return;}
  window._swH=sh.offsetHeight;
  _swipeKids(sh,'transform .16s cubic-bezier(.4,0,1,1)','translateX('+(-nd*106)+'%)');
  setTimeout(function(){window._dayNavDir=nd;go(nd);},160);
}
// Fiche du jour : glisser pour passer au jour suivant / précédent
function _dayNavSetup(key){
  _swipeNav(function(nd){var dt=new Date(key+'T12:00:00');dt.setDate(dt.getDate()+nd);openDay(dk(dt));});
}
// Repos entre deux vacations (11 h minimum) : simple signalement, rien n'est bloqué
// Note libre sur un jour (visible dans la fiche du jour)
// Note / heures en plus : retour à l'écran d'où on vient (fiche du jour ou « Modifier le jour »)
function _addBack(key){var f=window._addFrom;window._addFrom=null;pendingKey=key;if(f==='modif')openCustomVacModal();else openDay(key);}
function openNoteModal(key){
  var cur=(S.notes||{})[key]||'',d=new Date(key+'T12:00:00');
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)_addBack(\''+key+'\')"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Note · '+fmtDate(d)+'</div>'
    +'<input id="note-txt" maxlength="200" autocomplete="off" placeholder="Remplacement, formation, rappel…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();saveNote(\''+key+'\');}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:0.5px solid var(--border);font:14px var(--font);background:var(--bg2);color:var(--text);margin-bottom:10px">'
    +'<div class="mbtns">'+(cur?'<button class="mb del" style="border:none" onclick="saveNote(\''+key+'\',true)">Supprimer</button>':'<button class="mb" onclick="_addBack(\''+key+'\')">Annuler</button>')
    +'<button class="mb pri" onclick="saveNote(\''+key+'\')">Enregistrer</button></div>'
    +'</div></div>';
  var t=document.getElementById('note-txt');t.value=String(cur).replace(/\s*\n\s*/g,' ');setTimeout(function(){t.focus();},250);
}
function saveNote(key,del){
  var v=del?'':(document.getElementById('note-txt').value||'').trim();
  if(!S.notes)S.notes={};
  if(v)S.notes[key]=v;else delete S.notes[key];
  saveState();_addBack(key);
}



function _dayFixH(){var sh=document.querySelector('#modal-root .sheet.daymod');if(!sh)return;var db=sh.querySelector('.dbox');
  sh.style.setProperty('--dayh','auto');var base=sh.scrollHeight-(db?db.offsetHeight:0);
  var bs=sh.querySelectorAll('.mbtns'),g=bs[0],d=new Date((pendingKey||_lpk)+'T12:00:00'),cur=Math.ceil(_dayVacCount(d)/3),mx=cur;
  // grille la plus haute sur 3 semaines autour du jour (le passage d'une semaine à l'autre ne change rien)
  for(var i=-10;i<=10;i++){var x=new Date(d);x.setDate(d.getDate()+i);mx=Math.max(mx,Math.ceil(_dayVacCount(x)/3));}
  // la zone des vacations est déjà à la hauteur de la plus grande vue du jour (grille ou Autre) : on n'ajoute que ce qui dépasse
  var vg=sh.querySelector('#day-vg');if(g&&mx>cur){var gap=parseFloat(getComputedStyle(g).rowGap)||0,gh=mx*(g.offsetHeight+gap)/cur-gap;base+=Math.max(0,gh-(vg?vg.offsetHeight:g.offsetHeight));}
  // jour sans boutons Congé / Rendu / Échange / Absent (repos…) : on compte leur place quand même
  if(g&&bs.length<2)base+=(g.firstElementChild?g.firstElementChild.offsetHeight:42)+16;
  // en-tête : sa hauteur réelle, au moins 96 px (titre, horaires, nuit / primes)
  var h=Math.ceil((base+Math.max(db?db.offsetHeight:0,96))/8)*8,k='dayH2:'+window.innerWidth,m=0;try{m=+localStorage.getItem(k)||0;}catch(e){}
  // la plus grande hauteur déjà vue est gardée : la fiche ne rétrécit jamais d'un jour à l'autre
  if(h>m){m=h;try{localStorage.setItem(k,h);}catch(e){}}
  sh.style.setProperty('--dayh',m+'px');}
// Fenêtre Autre (ouverte depuis la fiche du jour) : même hauteur que la fiche
function _dayHApply(){var sh=document.querySelector('#modal-root .sheet');if(!sh)return;var m=0;try{m=+localStorage.getItem('dayH2:'+window.innerWidth)||0;}catch(e){}
  if(m){sh.classList.add('dayh');sh.style.setProperty('--dayh',m+'px');}}
function openDay(key){
  if(!key)return;window._dayVgHtml=null;pendingKey=key;_lpk=key;
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  var date=new Date(key+'T12:00:00'),VAC=getVAC(date),v2=getVac(date),vac=v2.vac,ov=v2.ov,fromSV=v2.fromSV,absent=v2.absent,echange=v2.echange,ecSelf=v2.ecSelf,li=v2.li,cycleVac=v2.cycleVac;
  var isFer=FERIES.has(key),hasCg=(S.conges||{})[key],dur=getDur(date);
  var cs=calcSoldes(),totalReal=cs.totalReal,matelas=cs.matelas,totalDispo=totalReal+cs.totalPrev+Math.max(0,matelas);
  var cR=Math.max(0,computeCongesRest(date.getFullYear()));
  var lbl=fmtDate(date),factor=renduFactor(date),ramee=isSemaineRamenée(getMonday(date)),hsW=calcHSWeek(getMonday(date)),sett=settingsForYM(date.getFullYear()*12+date.getMonth());
  var _ovData=(S.overrides||{})[key];
  var tt=vac&&vac!=='RH'?vLbl(vac,VAC):'';if(absent)tt=_excOf(key)?_excL(_excOf(key)):'Absent';else if(isFer)tt=vac&&vac!=='RH'?vLbl(vac,VAC):'Férié';else if(!vac)tt='Repos';
  var dw=date.getDay();
  var _dvr=_dayVacRows(date,VAC),rows=_dvr.rows;if(_dvr.sched){window._autreVacsForDay=_dvr.acc;window._cycleVacsShown=_dvr.sched;}
  const gridCols=3; // vacations sur 3 colonnes, semaine comme week-end
  var vgHtml='<div style="height:8px"></div>';
  // Flatten all rows into a single grid (same sizing as action buttons)
  var allVns=[];rows.forEach(function(row){row.forEach(function(vn){allVns.push(vn);});});
  vgHtml+='<div id="day-vg"><div class="mbtns" style="grid-template-columns:repeat('+gridCols+',1fr);margin-bottom:6px">';
  allVns.forEach(function(vn){
      if(vn==='Autre'){
        vgHtml+=`<button class="mb vt" style="background:var(--bg0);color:var(--text2);font-weight:700" onclick="_dayAutre(1)">Autre</button>`;
      } else {
        var vi=VAC[vn];
        if(vi&&vi.mixte)return;
        var isCur=!absent&&!echange&&vn===(vac||cycleVac); // vacation en place ce jour-là
        var isSV=vn==='SV';
        var bg=isSV?'var(--bg0)':(vi&&vi.dur>0?'var(--blue-l)':'var(--bg2)'),cl=isSV?'var(--text2)':'var(--text)';
        var bd=isCur?'0.5px solid var(--blue);box-shadow:inset 0 0 0 1.5px var(--blue)':(isSV?'0.5px solid var(--border2)':'0.5px solid var(--border)');
        var durLbl=vi&&vi.dur>0?'<div style="font-size:10px;opacity:.7;font-weight:400">'+fmtMin(vi.dur)+'</div>':'';
        vgHtml+=isCur?`<button class="mb vt" disabled aria-current="true" title="Vacation prévue ce jour" style="border:${bd};background:${bg};color:${cl};opacity:1;cursor:default"><div style="font-weight:700">${vLbl(vn,VAC)}</div>${durLbl}</button>`
          :`<button class="mb vt" style="border:${bd};background:${bg};color:${cl};" onclick="avw('${vn}')"><div style="font-weight:700">${vLbl(vn,VAC)}</div>${durLbl}</button>`;
      }
  });
  vgHtml+='</div></div>';


  var _inMatelas=!!(S.matelasKeys&&S.matelasKeys[key]!==undefined);
  var _matelasAvail=(S.profile&&S.profile.matelas)||0;
  var _isWarnedRend=false;
  // rendu sans heures pour le couvrir : même calcul que l'alerte (calcSoldes), pas un second décompte
  var _isResv=hasCg==='rend'&&!_inMatelas&&!!(window._resvKeys||{})[key];
  if(hasCg==='rend'&&!_inMatelas)_isWarnedRend=!!(cs.warnKeys&&cs.warnKeys.has(key))&&!_isResv;
  var ah='';
  if((vac&&vac!=='RH'&&!absent)&&!hasCg){
    ah=`<div class="mbtns" style="grid-template-columns:repeat(4,1fr)">
      <button class="mb grn" onclick="${cR<=0?`showBlockAlert('Solde insuffisant','Plus de congés disponibles pour ${date.getFullYear()}.')`:`openPoseModal('cg')`}"${cR<=0?' style="opacity:.5"':''}>Congé</button>
      <button class="mb" style="background:var(--rend-l);color:var(--rend-text);border-color:transparent" onclick="openPoseModal('rend')"${totalDispo<dur&&_rendStatus(key)==='rend'?' disabled':''}>Rendu</button>
      <button class="mb" style="border:none;background:rgba(165,60,60,.26);color:#b87878" onclick="openExchange('${key}')">Échange</button>
      <button class="mb" style="background:var(--btn);color:var(--text)" onclick="openPoseModal('absent')">Absence</button>
    </div>`;
  } else if(vac&&vac!=='RH'&&!absent&&hasCg){
    if(_isWarnedRend&&_matelasAvail>0){
      ah=`<div class="mbtns" style="grid-template-columns:1fr 1fr"><button class="mb del" style="border:none" onclick="removeCongé()">Retirer</button><button class="mb" style="background:rgba(220,160,30,.18);color:var(--amber);border-color:transparent" onclick="useMatelasForDay()">Matelas <span style="font-size:10px;opacity:.7">(${fmtMin(_matelasAvail)})</span></button></div>`;
    } else {
      ah=`<div class="mbtns"><button class="mb del wide" style="border:none" onclick="removeCongé()">Retirer</button></div>`;
    }
    // Rendu antérieur au début du suivi : l'utilisateur choisit s'il est déjà déduit par le gestionnaire ou non
    if((hasCg==='rend'||hasCg==='rend-hist')&&_rendStatus(key)==='rend-hist'){
      var _isH=hasCg==='rend-hist';
      ah+='<div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.45">'
        +(_isH?'Déjà déduit dans le tableau Gestion : l’app ne le décompte pas.':'Pas encore saisi par le gestionnaire : l’app le décompte elle-même.')
        +' <button style="font-size:11px;padding:3px 8px;margin-top:4px;border:1px solid var(--border);border-radius:6px;background:var(--btn);color:var(--text2);cursor:pointer" onclick="rendToggleHist(\''+key+'\')">'
        +(_isH?'Pas encore saisi ? Le décompter':'Il l’a saisi : ne plus le décompter')+'</button></div>';
    }
  }

  var epvHtml='';
  if(vac&&vac!=='RH'&&!absent&&!hasCg){
    var _pvac=getPayVac(date),_pv=_pvac?VAC[_pvac]:null,_epv=[];
    if(_pv){
      var _nMin=getNuitMinDay(date,VAC);if(_nMin>0)_epv.push('<span style="color:#9c7fe0">Nuit '+fmtMin(_nMin)+'</span>');
      var _hsD=_dayHSMin(date);if(_hsD>0)_epv.push('<span style="color:var(--blue)">HS +'+fmtMin(_hsD)+(sett.hsRendu?' rendues':'')+'</span>');
      if(_pv.primes&&_pv.primes.antenne)_epv.push('<span style="color:var(--amber)">Antenne</span>');
      if(_pv.primes&&_pv.primes.reel)_epv.push('<span style="color:var(--amber)">Réal</span>');
      if(_pv.primes&&_pv.primes.coord)_epv.push('<span style="color:var(--amber)">Coord</span>');
      if(_isMatin(date,_pv))_epv.push('<span style="color:var(--amber)">Matin</span>');
      if(isPanier(date))_epv.push('<span style="color:var(--amber)">Panier</span>');
      if(isFer)_epv.push('<span style="color:var(--text2)">Férié ×'+getTauxForYM(date.getFullYear()*12+date.getMonth()).fer+'%</span>');
      else if(date.getDay()===0)_epv.push('<span style="color:var(--text2)">Dim ×'+getTauxForYM(date.getFullYear()*12+date.getMonth()).dim+'%</span>');
      else if(isRHDay(date)&&!echange)_epv.push('<span style="color:var(--text2)">RH ×'+getTauxForYM(date.getFullYear()*12+date.getMonth()).rh+'%</span>'); // pas de majoration RH sur une vacation faite par échange (comme le calcul)
    }
    if(_epv.length)epvHtml='<div style="font-size:13px">'+_epv.join(' · ')+'</div>';
  }
  var _exr=(S.extraRendus||{})[key];
  var _renduBtn;
  if(_exr){
    _renduBtn='<div style="display:flex;align-items:center;gap:6px">'
      +'<button style="font-size:11px;padding:3px 8px;border:1px solid var(--rend-text);border-radius:6px;background:none;color:var(--rend-text);cursor:pointer;white-space:nowrap;font-weight:600" onclick="openExtraRenduModal(\''+key+'\')">+'+fmtMin(_exr.dur)+(_exr.label?' | '+_exr.label:'')+'</button>'
      +'<button style="background:none;border:none;color:var(--text3);font-size:15px;cursor:pointer;padding:2px 4px" onclick="removeExtraRendu(\''+key+'\')"><i class="ti ti-x"></i></button>'
      +'</div>';
  } else {
    _renduBtn='<button style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:var(--btn);color:var(--text2);cursor:pointer;white-space:nowrap" onclick="openExtraRenduModal(\''+key+'\')">+ Rendu</button>';
  }
  var _note=(S.notes||{})[key]||'';
  var _noteBtn=_note?'':'<button style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:var(--btn);color:var(--text2);cursor:pointer;white-space:nowrap" onclick="openNoteModal(\''+key+'\')">+ Note</button>';
  // Note et heures en plus : ajoutées depuis « Modifier » ; ici on n'affiche que ce qui existe déjà
  var _dpOn=!!((S.dayPrimes||{})[key]&&S.dayPrimes[key].amt>0);
  // Jour modifié (vacation, heures acquises ou prime) : retour au cycle (ou annulation de l'échange) en petit, en haut à droite de la fiche
  var _rst=echange?'<button class="adj-pill" style="width:auto;padding:0 14px;height:28px;font-size:13px;flex-shrink:0;white-space:nowrap;background:rgba(192,57,43,.32);color:#f3c2bb" onclick="event.stopPropagation();cancelExchange(\''+key+'\')" aria-label="Annuler l’échange"><i class="ti ti-arrow-back-up" style="margin-right:3px"></i>Échange</button>'
    :(ov||_exr||_dpOn)?'<button class="adj-pill" style="width:auto;padding:0 14px;height:28px;font-size:13px;flex-shrink:0;white-space:nowrap;background:rgba(192,57,43,.32);color:#f3c2bb" onclick="event.stopPropagation();resetVac()"><i class="ti ti-arrow-back-up" style="margin-right:3px"></i>'+(cycleVac&&cycleVac!=='RH'?vLbl(cycleVac,VAC):'Repos')+'</button>':'';
  var _plusBtn='';
  // Modifier, et en dessous le retour à l'original, même largeur (ils ne cachent plus le titre)
  _renduBtn='<div style="float:right;margin:-3px 0 0 10px;display:flex;flex-direction:column;gap:6px;align-items:stretch">'+_plusBtn+'<button class="adj-pill" style="width:auto;padding:0 14px;height:28px;font-size:13px;flex-shrink:0" onclick="event.stopPropagation();openCustomVacModal()">Modifier</button>'+_rst+'</div>';
  var _exrHtml=_exr?'<div style="margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(150,180,100,.10);border:0.5px solid rgba(150,180,100,.25);display:flex;align-items:center;gap:8px;font-size:13px">'
    +'<i class="ti ti-clock-plus" style="font-size:15px;color:var(--rend-text)"></i><span style="flex:1;color:var(--text2)">Heures de rendu acquises'+(_exr.label?' · '+String(_exr.label).replace(/</g,'&lt;'):'')+'</span><b style="color:var(--rend-text)">+'+fmtMin(_exr.dur)+'</b></div>':'';
  var _dp=(S.dayPrimes||{})[key];if(_dp&&_dp.amt>0&&epvHtml)epvHtml=epvHtml.replace('</div>',' · <span style="color:var(--amber)">'+(_dp.lbl||'Prime')+' '+fmtEuro(_dp.amt)+'</span></div>');
  var _noteHtml=_note?'<div onclick="event.stopPropagation();openNoteModal(\''+key+'\')" style="cursor:pointer;margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(255,250,243,.05);font-size:13px;color:var(--text2);line-height:1.4;display:flex;gap:7px"><i class="ti ti-note" style="font-size:15px;color:var(--text3);margin-top:1px"></i><span style="white-space:pre-wrap;word-break:break-word"></span></div>':'';
  var _wlk=dk(getMonday(date)),_wlHtml=S.weekLines&&S.weekLines[_wlk]!=null?'<div style="font-size:11px;color:#c88048;margin-top:3px">\u21c4 Semaine échangée : S'+(lineIdx(getMonday(date))+1)+' au lieu de S'+(_lineIdxBase(getMonday(date))+1)+'</div>':'';
  var _dayBox='';
  if(vac&&vac!=='RH'&&!absent&&VAC[vac]){
    // Vacation cédée par échange (je ne la fais pas) : barrée, sans nuit ni primes, avec la mention de l'échange
    var _given=echange&&!ecSelf,_ttH=_given&&tt?'<span style="text-decoration:line-through;color:var(--text3)">'+tt+'</span>':tt;
    _dayBox='<div class="dbox" onclick="openCustomVacModal()" style="cursor:pointer;background:var(--bg3);border-radius:10px;padding:10px 14px;margin-bottom:12px">'
      +_renduBtn+'<div style="display:flex;align-items:center;gap:8px;height:22px;overflow:hidden"><div style="font-size:15px;font-weight:600;color:var(--text);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(date.getFullYear()===NOW.getFullYear()?lbl.replace(' '+date.getFullYear(),''):lbl)+(tt?' — '+_ttH:'')+'</div></div>'
      +'<div style="font-size:13px;color:'+(_given?'var(--text3);text-decoration:line-through':'var(--text2)')+';margin-top:3px">'+VAC[vac].deb+'→'+VAC[vac].fin+' · '+fmtMin(dur)+'</div>'
      +(echange?'<div style="font-size:13px;color:#e09a9a;margin-top:3px;display:flex;align-items:center;gap:5px"><i class="ti ti-arrows-exchange" style="font-size:15px"></i>'+_mvTxt(key,_given)+'</div>':'')
      +(epvHtml&&!_given?'<div style="margin-top:3px">'+epvHtml+'</div>':'')
      +_wlHtml+(_isResv?'<div style="font-size:13px;color:var(--amber);margin-top:3px">● Couvert sous réserve d’un report automatique (7h ou moins restantes)</div>':'')
      +_exrHtml
      +_noteHtml
      +'</div>';
  } else {
    _dayBox='<div class="dbox" onclick="openCustomVacModal()" style="cursor:pointer;background:var(--bg3);border-radius:10px;padding:10px 14px;margin-bottom:12px">'
      +_renduBtn+'<div style="display:flex;align-items:center;gap:8px;height:22px;overflow:hidden"><div style="font-size:15px;font-weight:600;color:var(--text);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(date.getFullYear()===NOW.getFullYear()?lbl.replace(' '+date.getFullYear(),''):lbl)+(tt?' — '+tt:'')+'</div></div>'
      +_wlHtml+(_isResv?'<div style="font-size:13px;color:var(--amber);margin-top:3px">● Couvert sous réserve d’un report automatique (7h ou moins restantes)</div>':'')
      +_exrHtml
      +_noteHtml
      +'</div>';
  }

  document.getElementById('modal-root').innerHTML=`<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet daymod"><div class="sh"></div>${_dayBox}${key?_ruleHtml(key):''}${vgHtml}<div style="height:16px"></div>${_excDayLine(key)}${ah}<button class="mcancel mclose" onclick="closeModal()">Fermer</button></div></div>`;
  if(_note){var _ns=document.querySelector('#modal-root .ti-note');if(_ns)_ns.nextElementSibling.textContent=_note;}
  try{_dayVgSize();}catch(e){}
  _dayFixH();
  _dayNavSetup(key);
}



// Zone des vacations : hauteur de la plus grande des deux vues (grille, Autre), pour que la ligne Congé / Rendu… ne bouge pas
function _dayVgSize(){var vg=document.getElementById('day-vg');if(!vg)return;var t=document.createElement('div');
  t.style.cssText='position:absolute;visibility:hidden;left:0;top:0;width:'+vg.offsetWidth+'px';t.innerHTML=_dayAutreHtml();vg.parentNode.appendChild(t);
  var h=Math.max(vg.offsetHeight,t.offsetHeight+6);t.remove();vg.style.minHeight=h+'px';}
function _dayAutre(on){var vg=document.getElementById('day-vg');if(!vg)return;_haptic();
  if(on){if(!window._dayVgHtml){window._dayVgHtml=vg.innerHTML;vg.style.height=vg.offsetHeight+'px';vg.style.overflowY='auto';} // même hauteur que la grille : les boutons du dessous ne bougent pas
    vg.innerHTML='<div class="vg-in">'+_dayAutreHtml()+'</div>';}
  else if(window._dayVgHtml){vg.innerHTML='<div class="vg-in">'+window._dayVgHtml+'</div>';window._dayVgHtml=null;vg.scrollTop=0;}}
// Jours « modifiés » qui ne font que remettre la vacation du cycle (aucun autre réglage) : ce ne sont pas des modifications
function _ovCleanSame(){var o=S.overrides||{},n=0,ok={vac:1,fromSV:1,echange:1,hs:1,formation:1};
  Object.keys(o).forEach(function(k){var v=o[k];if(!v||!v.vac||v.echange||v.hs||v.formation||v.absent||Object.keys(v).some(function(f){return !ok[f];}))return;
    var cv=getCycleVac(new Date(k+'T12:00:00')).cycleVac;if(cv&&cv!=='RH'&&v.vac===cv){delete o[k];removeHistoryForKey(k);n++;}});
  if(n)saveState();return n;}
function avw(sel){
  if(!sel)return;
  var key=pendingKey||_lpk;if(!key)return;
  var date=new Date(key+'T12:00:00'),cv=getCycleVac(date).cycleVac,VAC=getVAC(date);
  // retour à la vacation prévue au cycle : plus de modification (ni marque, ni historique) ; primes et rendus ajoutés gardés
  if(sel===cv&&cv&&cv!=='RH'){var _o=(S.overrides||{})[key];if(_o){pushUndo('Vacation remise');delete S.overrides[key];removeHistoryForKey(key);saveState();render();popCell(key);gcalTrigger();}closeModal();return;}
  pushUndo('Vacation modifiée');
  if(!S.overrides)S.overrides={};
  // Les options (heures sup, primes prévues) se règlent ensuite dans la fiche du jour, seulement si elles servent
  S.overrides[key]={vac:sel==='SV'?null:sel,fromSV:!cv||cv==='RH'||sel==='SV',echange:false,hs:false,formation:false};
  logH(fmtDate(date)+' -> '+(sel==='SV'?'sans vacation':vLbl(sel,VAC)),'#62aadc',key);
  saveState();render();popCell(key);gcalTrigger();
  var cvI=cv&&cv!=='RH'?VAC[cv]:null,plus=sel!=='SV'&&VAC[sel]?VAC[sel].dur-(cvI?cvI.dur:0):0;
  closeModal();
}
function dayOpt(key,k,on){
  var o=(S.overrides||{})[key];if(!o)return;pushUndo('Option modifiée');o[k]=!!on;
  logH(fmtDate(new Date(key+'T12:00:00'))+(k==='hs'?(on?' : heures sup':' : sans heures sup'):(on?' : primes prévues':' : primes de la vacation posée')),'#62aadc',key);
  saveState();render();openDay(key);
}

function avwConfirm(){
  if(!_pendingVacSel)return;
  pushUndo('Vacation modifiée');
  var{key,sel,date,cv}=_pendingVacSel;
  var hs=document.getElementById('hs-toggle')?document.getElementById('hs-toggle').checked:false;
  var formation=document.getElementById('formation-toggle')?document.getElementById('formation-toggle').checked:false;
  if(!S.overrides)S.overrides={};
  S.overrides[key]={vac:sel==='SV'?null:sel,fromSV:!cv||cv==='RH'||sel==='SV',echange:false,hs:hs,formation:formation};
  logH(fmtDate(date)+' -> '+(sel==='SV'?'sans vacation':vLbl(sel,getVAC(date)))+(hs?' (HS)':'')+(formation?' (Formation)':''),'#62aadc',key);
  var _avwKey=key;
  _pendingVacSel=null;
  saveState();closeModal();render();popCell(_avwKey);
  gcalTrigger();
}

function openExtraRenduModal(key){
  var _ex=(S.extraRendus||{})[key];
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)_addBack(\''+key+'\')"><div class="sheet"><div class="sh"></div><div class="st">Ajouter un rendu</div>'
    +'<div class="mrow"><label>Label</label><input id="exr-label" placeholder="Réunion, formation…" value="'+(_ex?_ex.label:'')+'"></div>'
    +'<div class="mrow" style="margin-bottom:30px"><label>Durée</label><select id="exr-dur" style="padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);width:100%;-webkit-appearance:none;">'
    +'<option value="30">0h30</option><option value="60">1h00</option><option value="90">1h30</option><option value="120">2h00</option><option value="150">2h30</option><option value="180">3h00</option><option value="210">3h30</option><option value="240">4h00</option><option value="300">5h00</option><option value="360">6h00</option><option value="420">7h00</option><option value="480">8h00</option></select></div>'
    +'<div class="mbtns"><button class="mb" onclick="_addBack(\''+key+'\')">Annuler</button><button class="mb pri" onclick="confirmExtraRendu(\''+key+'\')">Ajouter</button></div>'
    +'</div></div>';
  if(_ex)document.getElementById('exr-dur').value=String(_ex.dur);
}
function confirmExtraRendu(key){
  var dur=parseInt(document.getElementById('exr-dur').value)||0;
  var label=(document.getElementById('exr-label').value||'').trim();
  if(dur<=0)return;
  pushUndo('Rendu ajouté');
  if(!S.extraRendus)S.extraRendus={};
  S.extraRendus[key]={dur:dur,label:label};
  saveState();render();_addBack(key);
}
function removeExtraRendu(key){
  pushUndo('Heures en plus retirées');
  if(S.extraRendus)delete S.extraRendus[key];
  saveState();render();_addBack(key);
}
function resetVac(){pushUndo('Jour remis');var _pk=pendingKey;removeHistoryForKey(_pk);if(S.extraRendus)delete S.extraRendus[_pk];if(S.dayPrimes)delete S.dayPrimes[_pk];if(!S.overrides)S.overrides={};delete S.overrides[_pk];if(!S.conges)S.conges={};delete S.conges[_pk];if(S.excInfo)delete S.excInfo[_pk];saveState();closeModal();render();popCell(_pk);gcalTrigger();}
function setAbsent(){pushUndo('Absence posée');var date=new Date(pendingKey+'T12:00:00');if(!S.overrides)S.overrides={};S.overrides[pendingKey]={absent:true};if(!S.conges)S.conges={};S.conges[pendingKey]='absent';logH(fmtDate(date)+' -> absent','#c88048',pendingKey);saveState();closeModal();render();gcalTrigger();}
function resetAbsent(){pushUndo('Absence retirée');removeHistoryForKey(pendingKey);if(!S.overrides)S.overrides={};delete S.overrides[pendingKey];if(!S.conges)S.conges={};delete S.conges[pendingKey];if(S.excInfo)delete S.excInfo[pendingKey];saveState();closeModal();render();gcalTrigger();}
function popCell(key){var el=document.querySelector('.dci[data-key="'+key+'"]');if(el){el.classList.add('pop');el.addEventListener('animationend',function(){el.classList.remove('pop');},{once:true});}}
function showBlockAlert(title,msg){
  document.getElementById('modal-root').innerHTML='<div class="overlay" style="z-index:400"><div class="sheet" style="max-height:220px"><div class="sh"></div>'
    +'<div class="st" style="color:#e07070">'+title+'</div>'
    +'<div class="ss" style="margin-bottom:16px">'+msg+'</div>'
    +'<button class="mb wide" onclick="closeModal()">OK</button>'
    +'</div></div>';
}
function poseConge(t){
  if(!S.conges)S.conges={};
  const _pcEx=(S.conges||{})[pendingKey];
  if(t==='cg'&&(_pcEx==='rend'||_pcEx==='rend-hist')){showBlockAlert('Conflit','Ce jour est déjà un rendu. Le supprimer avant de poser un congé.');return;}
  if(t==='rend'&&_pcEx==='cg'){showBlockAlert('Conflit','Ce jour est déjà un congé. Le supprimer avant de poser un rendu.');return;}
  if(t==='cg'){const _pcY=new Date(pendingKey+'T12:00:00').getFullYear();if(computeCongesRest(_pcY)<=0){showBlockAlert('Solde insuffisant','Plus de congés disponibles pour '+_pcY+'.');return;}}
  pushUndo('Congé posé');var date=new Date(pendingKey+'T12:00:00');
  var stored=t;
  if(t==='rend')stored=_rendStatus(dk(date));
  S.conges[pendingKey]=stored;logH(fmtDate(date)+' -> '+(t==='cg'?'congé':stored==='rend-hist'?'rendu hist. '+fmtMin(getDur(date)):'rendu '+fmtMin(getDur(date))),t==='cg'?'#6a9878':'#A8BF7A',pendingKey);
  saveState();closeModal();render();popCell(pendingKey);}
function rendToggleHist(key){
  const c=(S.conges||{})[key];if(c!=='rend'&&c!=='rend-hist')return;
  pushUndo('Rendu modifié');const d=new Date(key+'T12:00:00');
  S.conges[key]=c==='rend'?'rend-hist':'rend';
  logH(fmtDate(d)+' -> '+(c==='rend'?'rendu déjà déduit par le gestionnaire':'rendu décompté par l’app')+' '+fmtMin(getDur(d)),'#A8BF7A',key);
  saveState();openDay(key);render();
}


function useMatelasForDay(){
  var key=pendingKey;if(!key||!S.conges||S.conges[key]!=='rend')return;
  pushUndo('Matelas utilisé');
  recalcAllMatelas();
  saveState();closeModal();render();
}
function _askRemoveScope(key,type,set){
  var ks=Array.from(set).sort(),n=ks.length;
  var f=function(k){var d=new Date(k+'T12:00:00');return d.getDate()+' '+MC[d.getMonth()];};
  var what=type==='cg'?'congé':type==='absent'?'absence':'rendu';
  var col=type==='cg'?'var(--green)':type==='absent'?'var(--text2)':'var(--rend-text)';
  var bg=type==='cg'?'var(--green-l)':type==='absent'?'var(--bg3)':'var(--rend-l)';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)openDay(\''+key+'\')"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Retirer le '+what+'</div>'
    +'<div style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.45">Ce jour fait partie d’une période de '+n+' jours, du '+f(ks[0])+' au '+f(ks[n-1])+'.</div>'
    +'<button class="mb wide" style="width:100%;padding:12px;margin-bottom:8px;background:'+bg+';color:'+col+';border:none" onclick="pendingKey=\''+key+'\';removeCongé(\'one\')">Seulement le '+f(key)+'</button>'
    +'<button class="mb wide" style="width:100%;padding:12px;margin-bottom:4px" onclick="pendingKey=\''+key+'\';removeCongé(\'all\')">Toute la période ('+n+' jours)</button>'
    +'<button class="mcancel" onclick="openDay(\''+key+'\')">Annuler</button>'
    +'</div></div>';
}
function removeCongé(mode){
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
  // Jour pris dans une période (plusieurs jours d'affilée) : on demande ce qu'il faut retirer
  if(!mode&&toRemove.size>1){_askRemoveScope(key,type,toRemove);return;}
  if(mode==='one'){toRemove.clear();toRemove.add(key);}
  pushUndo(({cg:'Congé retiré',rend:'Rendu retiré','rend-hist':'Rendu retiré',absent:'Absence retirée'})[type]+(toRemove.size>1?' ('+toRemove.size+' jours)':''));
  const _pid2=window._aid||'default';
  const _stored2=JSON.parse(localStorage.getItem('gcal_event_ids_'+_pid2)||'{}');
  toRemove.forEach(function(k){
    delete S.conges[k];removeHistoryForKey(k);
    delete _stored2[k]; // clear stored IDs so sync re-creates correctly
  });
  localStorage.setItem('gcal_event_ids_'+_pid2,JSON.stringify(_stored2));
  recalcAllMatelas();
  saveState();closeModal();render();popCell(key);
  gcalTrigger();
}
function showPoseSelect(){
  var w=document.getElementById('pose-select-wrap');
  if(w)w.style.display='block';
}

// iPhone : le haut de l'écran (sous l'heure) prend la couleur de l'en-tête telle qu'on la voit, assombrie sous le voile
// d'une fenêtre ou d'un menu (#222221 sous un voile noir à 34 % ou 18 %)
function _sbTint(){if(!_isPhone()||document.documentElement.getAttribute('data-theme')==='light'||document.getElementById('boot-bg'))return;
  var v=document.getElementById('lp-veil'),k=document.body.classList.contains('tb-sheet')?.66:1;if(v&&!v._off)k*=.82;
  var c='rgb('+[34,34,33].map(function(x){return Math.round(x*k);}).join(',')+')';
  if(window._sbC===c)return;window._sbC=c;document.documentElement.style.backgroundColor=c;
  var m=document.getElementById('theme-color-meta');if(m)m.content=c;}
document.addEventListener('DOMContentLoaded',function(){try{new MutationObserver(_sbTint).observe(document.body,{childList:true});}catch(e){}});
function _closeDayMenu(){
  var m=document.getElementById('lp-menu'),v=document.getElementById('lp-veil');
  document.querySelectorAll('.dci.lp-on').forEach(function(x){x.classList.remove('lp-on');});
  if(m){m.classList.remove('on');setTimeout(function(){m.remove();},150);}
  if(v){v._off=1;v.classList.remove('on');setTimeout(function(){v.remove();},150);}
  _sbTint();
}
// Grand titre : barre fine avec le titre, qui apparaît quand le grand titre sort par le haut en faisant défiler
function _shMini(){document.querySelectorAll('#modal-root .sheet').forEach(function(sh){
  if(sh._shm)return;var st=sh.querySelector(':scope>.st');if(!st||st.offsetTop>90)return;sh._shm=1;
  var m=document.createElement('div');m.className='sh-mini';var sp=document.createElement('span');sp.textContent=(st.firstChild&&st.firstChild.nodeType===3?st.firstChild.textContent:st.textContent).trim();m.appendChild(sp);sh.insertBefore(m,sh.firstChild);});}
document.addEventListener('scroll',function(e){var sh=e.target;if(!sh||!sh.classList||!sh.classList.contains('sheet')||!sh._shm)return;
  var st=sh.querySelector(':scope>.st');if(st)sh.classList.toggle('scd',sh.scrollTop>st.offsetTop+st.offsetHeight-20);},true);


// Historique des modifications (menu) : les 40 dernières (toutes en cherchant), et « annuler des actions » de la session
function openHistModal(){
  try{if(_histClean())saveState();}catch(e){}
  _lockBodyScroll();
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Historique</div>'
    +(_us.length?'<button class="rv-b2" style="margin:0 0 12px" onclick="openUndoList()">Annuler des actions de cette session ('+_us.length+')</button>':'')
    +((S.history||[]).length>5?_srBox('hist-q','Rechercher (jour, vacation…)','_histList()'):'')
    +'<div class="ucard" id="hist-l" style="margin:0"></div><button class="mcancel" onclick="closeModal()">Fermer</button></div></div>';
  _histList();}
function _histList(){var l=document.getElementById('hist-l');if(!l)return;var qe=document.getElementById('hist-q'),q=qe?_srN(qe.value).trim():'';
  var A=S.history||[],L=q?A.filter(function(e){var t=_srN(e.t+' '+_histTxt(e.d));return q.split(/\s+/).every(function(w){return t.indexOf(w)>=0;});}).slice(0,150):A.slice(0,40);
  l.innerHTML=L.map(function(e){return '<div class="hrow"><div class="hdot" style="background:'+e.c+'"></div><span class="htime">'+e.t+'</span><span class="hdesc">'+_histTxt(e.d)+'</span></div>';}).join('')
    ||'<div style="font-size:13px;color:var(--text3);padding:6px 0">'+(q?'Rien ne correspond.':'Aucune modification.')+'</div>';}
// Menu de l'en-tête (téléphone) : ce qui était dans l'en-tête
function openHdrMenu(){
  _haptic();if(document.getElementById('lp-menu'))return _closeDayMenu();
  var ub=document.getElementById('undo-btn'),rb=document.getElementById('redo-btn'),ext=function(t){var b=document.querySelector('.hdr-btns .ibtn[title="'+t+'"]');return b?b.getAttribute('onclick'):'';};
  // hors de l'accueil (pages et sous-pages) : seulement annuler, rétablir et l'historique
  var it=function(ic,col,lbl,js,off){return '<button'+(off?' disabled':'')+' onclick="_closeDayMenu();'+js.replace(/"/g,'&quot;')+'">'+(ic.charAt(0)==='<'?ic:'<i class="ti '+ic+'" style="color:'+col+'"></i>')+lbl+'</button>';};
  var veil=document.createElement('div');veil.id='lp-veil';veil.addEventListener('click',function(e){e.stopPropagation();_closeDayMenu();});
  var m=document.createElement('div');m.id='lp-menu';m.className='hd-menu';
  var swNew=document.getElementById('menu-btn')&&document.getElementById('menu-btn').classList.contains('sw-new');
  var pg=document.body.classList.contains('tb-pg')?';_tbRefresh()':'';
  m.innerHTML='<div class="hm-row">'+it('ti-arrow-back-up','var(--text2)','Annuler','undoAction()'+pg,ub&&ub.disabled)+it('ti-arrow-forward-up','var(--text2)','Rétablir','redoAction()'+pg,rb&&rb.disabled)+'</div>'
    +it('ti-history','var(--text2)','Historique','openHistModal()')
    +(document.body.classList.contains('tb-pg')?'':'<div class="hm-sep"></div>'
    +it('ti-arrows-exchange','var(--amber)','Échanges'+(swNew?'<span class="hm-dot"></span>':''),'openSwaps()')
    +it('ti-calendar-time','var(--amber)','Sirhius',ext('Sirhius'))+it('ti-send','var(--green)','Demande de congés',ext('Demande'))
    +'<div class="hm-sep"></div>'
    +it('ti-calendar-month','var(--blue)',annualOpen?'Vue du mois':'Vue de l’année','toggleAnnual()')
    +(function(){var g=_gcalLine();return it(_gIco(g[0],g[2]),'',g[1],'gcalHandleClick()');})())+(function(l){return l?'<div class="hm-sep"></div>'+l:'';})(_verLine()+_syncLine());
  document.body.appendChild(veil);document.body.appendChild(m);
  m.style.boxSizing='border-box';m.style.width=m.offsetWidth+'px'; // largeur figée : un état plus long se coupe, le menu ne bouge pas
  // menu ouvert : l'état de l'enregistrement en ligne et de Google Agenda se met à jour tout seul
  m._iv=setInterval(function(){if(!document.body.contains(m)||!m.classList.contains('on')&&m._seen){clearInterval(m._iv);return;}m._seen=1;
    var sy=m.querySelector('.hm-sync'),nl=_syncLine();if(sy&&nl&&sy.outerHTML!==nl)sy.outerHTML=nl;
    var gb=m.querySelector('button[onclick*="gcalHandleClick"]');if(gb){var g=_gcalLine(),ic=gb.querySelector('svg.hm-g'),lb=gb.querySelector('.hm-2l'),ni=_gIco(g[0],g[2]);
      if(ic&&ic.outerHTML!==ni)ic.outerHTML=ni;
      if(lb){var t=document.createElement('div');t.innerHTML=g[1];var nb=t.firstChild;if(nb&&lb.outerHTML!==nb.outerHTML)lb.replaceWith(nb);}}},500);
  requestAnimationFrame(function(){veil.classList.add('on');m.classList.add('on');});}
document.addEventListener('click',function(e){if(Date.now()-(window._eatClickAt||0)<500){window._eatClickAt=0;e.stopPropagation();e.preventDefault();}},true);
// Barre d'onglets (téléphone) : l'onglet allumé suit la fenêtre ouverte
function _tbGo(t){_haptic();
  if(t==='cal'){if(document.querySelector('#modal-root .overlay')){window._modalBack=null;window._tbRoot=null;closeModal();if(document.querySelector('#modal-root .overlay')){document.getElementById('modal-root').innerHTML='';_unlockBodyScroll();}}
    // déjà sur l'accueil : vers aujourd'hui ; déjà sur le mois en cours : actualiser (comme tirer vers le bas)
    else if(!annualOpen&&curM===NOW.getMonth()&&curY===NOW.getFullYear()&&window.scrollY<=0&&window._ptrRefresh)window._ptrRefresh();else goToday();}
  else if(t==='suivi'){window._rgYM=null;openSuiviRoot();}
  else if(t==='swap')openSwaps();
  else if(t==='set')openSettingsModal();
  _tbSync();}

// Sous-pages (téléphone) : glisser depuis le bord gauche pour revenir, comme sur iPhone ; la page suit le doigt
// et laisse voir dessous la page du dessus (gardée à l'ouverture de la sous-page, ou l'accueil), qui revient de la gauche
document.addEventListener('scroll',function(e){var el=e.target,ov=el&&el.closest&&el.closest('.overlay.tbpage');if(ov){(ov._sc||(ov._sc=new Map())).set(el,el.scrollTop);}},true);
(function(){
  var sx=0,sy=0,t0=0,lock=0,sh=null,W=0,un=null,ovC=null;
  function under(ov){var st=window._tbStack||[],pv=st[st.length-1];ovC=ov;ov.style.setProperty('background','transparent','important');
    if(!pv)return; // sous-page de l'Accueil : l'accueil est déjà dessous
    un=document.createElement('div');un.id='tb-under';pv.classList.remove('tbpush','tbpop','tbanim','tbswap');pv.style.zIndex='199';pv.style.pointerEvents='none';
    un.appendChild(pv);document.body.appendChild(un);if(pv._sc)pv._sc.forEach(function(y,el){el.scrollTop=y;});}
  function move(dx){var k=Math.min(1,Math.max(0,dx/W));if(un){un.firstChild.style.transform='translateX('+(-28*(1-k))+'%)';un.firstChild.style.filter='brightness('+(.7+.3*k)+')';}}
  function drop(){if(un){un.remove();un=null;}if(ovC){ovC.style.removeProperty('background');ovC=null;}}
  document.addEventListener('touchstart',function(e){window._edgeOn=false;sh=null;
    if(!_isPhone()||e.touches.length>1)return;var x=e.touches[0].clientX;if(x>24)return;
    var ov=document.querySelector('#modal-root .overlay.tbsub');if(!ov||!ov.contains(e.target))return;
    sh=ov.querySelector('.sheet');sx=x;sy=e.touches[0].clientY;t0=Date.now();lock=0;W=innerWidth;window._edgeOn=true;},{capture:true,passive:true});
  document.addEventListener('touchmove',function(e){if(!window._edgeOn||!sh)return;
    var dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;
    if(!lock){if(Math.abs(dx)<6&&Math.abs(dy)<6)return;lock=dx>0&&Math.abs(dx)>Math.abs(dy)?1:-1;if(lock<0){window._edgeOn=false;return;}}
    if(e.cancelable)e.preventDefault();e.stopPropagation();
    if(!ovC)under(sh.closest('.overlay'));
    sh.style.transition='none';sh.style.transform='translateX('+Math.max(0,dx)+'px)';sh.style.boxShadow='-14px 0 30px rgba(0,0,0,.45)';move(Math.max(0,dx));},{capture:true,passive:false});
  document.addEventListener('touchend',function(e){if(!window._edgeOn||!sh)return;var s=sh;
    var dx=e.changedTouches[0].clientX-sx,v=dx/Math.max(1,Date.now()-t0);
    if(lock>0)window._eatClickAt=Date.now();
    var u=un&&un.firstChild;if(u)u.style.transition='transform .2s cubic-bezier(.3,.7,.4,1),filter .2s ease';
    if(lock>0&&(dx>W/3||(v>0.5&&dx>40))){s.style.transition='transform .2s cubic-bezier(.3,.7,.4,1)';s.style.transform='translateX('+W+'px)';move(W);
      setTimeout(function(){window._edgeOn=false;window._tbNoPop=1;
        // la page du dessus est redessinée (chiffres à jour) au même endroit du défilement que celle montrée pendant le geste
        var ys=[];if(u&&u._sc)u._sc.forEach(function(y,el){if(el.className)ys.push([String(el.className).split(' ')[0],y]);});
        drop();_tbBack();ys.forEach(function(c){var e=document.querySelector('#modal-root .overlay .'+c[0]);if(e)e.scrollTop=c[1];});},190);}
    else{s.style.transition='transform .25s cubic-bezier(.2,.9,.3,1)';s.style.transform='';move(0);setTimeout(function(){s.style.boxShadow='';s.style.transition='';window._edgeOn=false;if(u){u.style.transform=u.style.filter=u.style.transition=u.style.zIndex=u.style.pointerEvents='';}drop();},260);}
    sh=null;},{capture:true,passive:true});
})();
// page d'onglet ouverte après une annulation : redessinée avec les chiffres à jour (sous-pages : à leur prochaine ouverture)
function _tbRefresh(){if(!document.body.classList.contains('tb-pg')||document.body.classList.contains('tb-sub'))return;var t=window._tbRoot,sh=document.querySelector('#modal-root .overlay .sheet'),y=sh?sh.scrollTop:0;
  if(t==='suivi')openSuiviRoot();else if(t==='set')openSettingsModal(window._stLast||0);else return;
  sh=document.querySelector('#modal-root .overlay .sheet');if(sh)sh.scrollTop=y;}
// PC : une fenêtre ouverte prend la place de la colonne de droite (soldes, variables, paie) ; le calendrier reste visible et utilisable
function _tbBack(){_haptic();window._eatClickAt=0;window._tbPop=1;/* sous l'Accueil : retour à l'accueil */var nb=window._tbRoot&&document.querySelector('#modal-root .overlay.tbsub .nav-back');if(nb)nb.click();else closeModal();}
function _tbSync(){var b=document.getElementById('tabbar');if(!b)return;var r=document.getElementById('modal-root'),ov=r&&r.querySelector('.overlay'),t='cal';
  if(ov)t=ov.querySelector('#sw-list')?'swap':ov.querySelector('#stc-0')?'set':ov.querySelector('#sv-root')?'suivi':'';
  var phone=_isPhone();
  // onglet ouvert : ses grandes fenêtres (bulletins, tableau, vérification…) sont des sous-pages, l'onglet reste allumé ;
  // les petites (question, saisie) passent par-dessus
  if(phone&&_TB_PAGE[t])window._tbRoot=t;else if(!ov)window._tbRoot=null;
  var sub=false;if(phone&&ov&&!_TB_PAGE[t]&&ov.querySelector('.sheet.tabmod,.sheet.smod,.sheet.pp-sheet,.sheet.rv-sheet')){t=window._tbRoot||'cal';sub=true;} // depuis l'accueil : sous-page de l'Accueil
  var page=phone&&ov&&(_TB_PAGE[t]||sub);
  if(phone){var h=document.querySelector('.hdr');if(h)document.documentElement.style.setProperty('--hdrh',h.offsetHeight+'px');_hdrAlign();}
  // en-tête : nom de la page d'onglet à la place du mois
  var _nm={suivi:'Suivi',swap:'Échanges',set:'Réglages',cal:'Accueil'}[t],tt=document.getElementById('tb-title');
  // sous-page : son titre (celui de la page) dans l'en-tête, et « ‹ Suivi » (page de l'onglet) à gauche
  var _sh=sub&&ov.querySelector('.sheet'),_st=sub&&ov.querySelector('.sheet .st'),_stx=_sh&&_sh.dataset.title?_sh.dataset.title:_st?(_st.textContent||'').replace(/[‹›]/g,'').replace(/\s+/g,' ').trim():'';
  if(tt&&page)tt.textContent=sub&&_stx?_stx:_nm;if(_st&&_stx)_st.classList.add('st-hdr');
  // page qui a son propre lien retour (‹ Paie 2026…) : la flèche de l'en-tête y mène, avec son nom
  var _nb=sub&&t!=='cal'&&ov.querySelector('.nav-back'),bk=document.getElementById('tb-back');if(bk&&sub)bk.lastChild.textContent=_nb?(_nb.textContent||'').replace(/[‹<]/g,'').trim()||_nm:_nm;
  document.body.classList.toggle('tb-sub',!!(page&&sub));if(ov&&sub)ov.classList.add('tbsub');
  document.body.classList.toggle('tb-pg',!!page);
  // même sous-page redessinée (autre mois…) : sans animation ; nouvelle sous-page : glisse depuis la droite ; retour : depuis la gauche
  var _sk=sub&&_sh?_sh.className+'|'+_stx.split(' ')[0]:'';
  if(ov&&page&&!ov.classList.contains('tbpage')){ov.classList.add('tbpage');
    var pop=window._tbPop;window._tbPop=0;
    // pages du dessus gardées telles quelles (affichées sous la sous-page pendant le glissé retour)
    var _st=window._tbStack||(window._tbStack=[]),_g=window._tbGone;window._tbGone=null;
    if(pop)_st.pop();else if(sub){if(_sk!==window._tbSubK&&_g)_st.push(_g);}else _st.length=0;
    if(pop&&!window._tbNoPop)ov.classList.add('tbpop');
    else if(sub){if(_sk!==window._tbSubK&&!pop)ov.classList.add('tbpush');}
    else if(window._tbLast!==t)ov.classList.add(_TB_PAGE[window._tbLast]?'tbswap':'tbanim');
    window._tbNoPop=0;}
  if(ov&&page)window._tbSubK=_sk;else if(!ov){window._tbSubK='';window._tbPop=window._tbNoPop=0;window._tbStack=[];window._tbGone=null;}
  document.body.classList.toggle('tb-sheet',!!(phone&&ov&&!page));_sbTint();
  if(ov&&!page)return; // fenêtre par-dessus : la barre s'efface, l'onglet ne change pas
  var on=null;b.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x.dataset.t===t);if(x.dataset.t===t)on=x;});
  var ind=b.querySelector('.tb-ind');if(!ind){ind=document.createElement('span');ind.className='tb-ind';b.insertBefore(ind,b.firstChild);}
  if(!on||!on.offsetWidth){ind.style.opacity='0';window._tbLast=t;return;}
  ind.style.opacity='1';
  var x1=on.offsetLeft,w1=on.offsetWidth,last=window._tbLast;window._tbLast=t;
  if(last&&last!==t&&ind.offsetWidth&&ind.animate&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)){
    // la pastille s'étire jusqu'au nouvel onglet en s'aplatissant un peu, puis s'y pose ; l'icône rebondit
    var x0=ind._x||0,w0=ind.offsetWidth,lo=Math.min(x0,x1),hi=Math.max(x0+w0,x1+w1);
    ind.animate([{transform:'translateX('+x0+'px) scaleY(1)',width:w0+'px'},{transform:'translateX('+lo+'px) scaleY(.9)',width:(hi-lo)+'px',offset:.45},{transform:'translateX('+x1+'px) scaleY(1)',width:w1+'px'}],{duration:440,easing:'cubic-bezier(.3,1,.4,1)'});
    var ic=on.querySelector('i');if(ic&&ic.animate)ic.animate([{transform:'scale(1)'},{transform:'scale(1.22)',offset:.4},{transform:'scale(.96)',offset:.75},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});}
  ind._x=x1;ind.style.width=w1+'px';ind.style.transform='translateX('+x1+'px)';}
window.addEventListener('resize',function(){_tbSync();});
document.addEventListener('DOMContentLoaded',function(){setTimeout(_tbSync,50);});
_tbSync();
document.addEventListener('DOMContentLoaded',function(){var r=document.getElementById('modal-root');if(r)try{new MutationObserver(function(rs){rs.forEach(function(m){[].forEach.call(m.removedNodes,function(n){if(n.classList&&n.classList.contains('tbpage'))window._tbGone=n;});});_tbSync();_shMini();}).observe(r,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});}catch(e){}});


async function _swapApi(path,body){
  var r=await fetch(CLOUD_API+path,{method:'POST',headers:cloudHeaders(),body:JSON.stringify(Object.assign({pool:_pool(),userName:_swName()},body||{}))}),d=null;
  try{d=await r.json();}catch(e){}
  if(!r.ok||!d||d.error)throw new Error((d&&d.error)||'Serveur injoignable');
  _SW.offers=d.offers||[];_SW.me=d.me;_SW.at=Date.now();_swapBadge();return d;}

// Point rouge sur le bouton : nouvelle proposition de l'équipe, nouvelle réponse à une des miennes, échange conclu avec moi
function _swapBadge(){var t=_swSeen(),me=_SW.me,n=_SW.offers.some(function(o){return o.uid!==me?(!o.done&&o.at>t)||(o.done&&o.done.uid===me&&o.done.at>t):o.answers.some(function(a){return a.at>t;});});
  ['swap-btn','menu-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.toggle('sw-new',n);});}
function _swapRefresh(force){if(!window._authToken||(!force&&Date.now()-_SW.at<60000))return;_swapApi('/swap/list').then(function(){if(document.getElementById('sw-list'))_swapList();}).catch(function(){});}


function openSwaps(tab){
  if(!window._authToken){_infoToast('Se connecter pour voir les échanges');return;}
  if(tab!=null)_SW.tab=tab;_lockBodyScroll();
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div>'
    +'<div class="st">Échanges</div><div class="ss" style="margin-bottom:12px">Jours proposés dans l’équipe '+((POOLS[_pool()]||{}).l||_pool())+'. Un échange conclu s’enregistre ensuite dans chaque planning.</div>'
    +'<div class="sw-seg"><button id="sw-t0" onclick="_SW.tab=0;_swapList()">L’équipe</button><button id="sw-t1" onclick="_SW.tab=1;_swapList()">Mes propositions</button></div>'
    +_srBox('sw-q','Rechercher (nom, jour, vacation…)','_swapList()')
    +'<div id="sw-list"><div style="font-size:13px;color:var(--text3);padding:20px 0;text-align:center">Chargement…</div></div>'
    +'<button class="mcancel" onclick="closeModal()">Fermer</button></div></div>';
  if(_SW.me)_swapList();
  _swapApi('/swap/list').then(_swapList).catch(function(e){var l=document.getElementById('sw-list');if(l)l.innerHTML='<div style="font-size:13px;color:var(--text3);padding:20px 0;text-align:center">'+_h(e.message)+'</div>';});
}
function _swapList(){
  var l=document.getElementById('sw-list');if(!l)return;
  try{localStorage.setItem('swap_seen',String(Date.now()));}catch(e){}_swapBadge();
  [0,1].forEach(function(i){var b=document.getElementById('sw-t'+i);if(b)b.classList.toggle('on',_SW.tab===i);});
  var me=_SW.me,mine=_SW.tab===1,L=_SW.offers.filter(function(o){return mine?o.uid===me:o.uid!==me;});
  var qe=document.getElementById('sw-q'),qs=qe?_srN(qe.value).trim():'';
  if(qs)L=L.filter(function(o){var t=_srN([_swDay(o.date),o.date,o.vac,o.hours,o.name,o.note,o.kind==='cede'?'cede':'echange'].concat((o.answers||[]).map(function(a){return a.name+' '+(a.msg||'');})).join(' '));return qs.split(/\s+/).every(function(w){return t.indexOf(w)>=0;});});
  if(qs&&!L.length){l.innerHTML='<div style="font-size:13px;color:var(--text3);padding:18px 4px;text-align:center">Rien ne correspond.</div>';return;}
  var q=function(x){return _h(x).replace(/'/g,'&#39;');};
  if(!L.length){l.innerHTML='<div style="font-size:13px;color:var(--text3);padding:18px 4px;text-align:center;line-height:1.5">'+(mine?'Aucune proposition en cours.<br>Pour proposer un jour : appui long sur ce jour dans le calendrier, puis « Proposer à l’équipe ».':'Aucun jour proposé par l’équipe pour le moment.')+'</div>';return;}
  l.innerHTML=L.map(function(o){
    var h='<div class="swc"><div class="swc-h"><b>'+_swDay(o.date)+'</b><span class="swc-k'+(o.kind==='cede'?' cede':'')+'">'+(o.kind==='cede'?'Cédé':'Échange')+'</span></div>'
      +'<div class="swc-s">'+_h(o.vac)+(o.hours?' · '+_h(o.hours):'')+(mine?'':' · '+_h(o.name))+'</div>'
      +(o.note?'<div class="swc-n">'+_h(o.note)+'</div>':'')+'<div class="swc-me">Ce jour-là, vous : '+_h(_swMine(o.date))+'</div>';
    if(mine){
      if(o.done)h+='<div class="swc-ok">✓ Conclu avec '+_h(o.done.name)+'</div><div class="swc-b"><button class="pri" onclick="_swapRecord(\''+o.date+'\')">Enregistrer dans mon planning</button><button class="del" onclick="_swapClose(\''+o.id+'\')">Retirer</button></div>';
      else{h+=o.answers.length?o.answers.map(function(a){return '<div class="swc-a"><span>'+_h(a.name)+(a.msg?'<small>'+_h(a.msg)+'</small>':'')+'</span><button class="pri" onclick="_swapClose(\''+o.id+'\',\''+q(a.uid)+'\',\''+q(a.name)+'\')">Choisir</button></div>';}).join(''):'<div class="swc-me" style="margin-top:8px">Pas encore de réponse.</div>';
        h+='<div class="swc-b"><button class="del" onclick="_swapClose(\''+o.id+'\')">Retirer la proposition</button></div>';}
    }else{
      var ans=o.answers.filter(function(a){return a.uid===me;})[0];
      if(o.done)h+=o.done.uid===me?'<div class="swc-ok">✓ Conclu avec vous</div><div class="swc-b"><button class="pri" onclick="_swapRecord(\''+o.date+'\')">Enregistrer dans mon planning</button></div>':'<div class="swc-me" style="margin-top:8px">Déjà conclu avec quelqu’un d’autre.</div>';
      else if(ans)h+='<div class="swc-ok" style="color:var(--blue)">Réponse envoyée'+(ans.msg?' : '+_h(ans.msg):'')+'</div><div class="swc-b"><button onclick="_swapAnswer(\''+o.id+'\',1)">Retirer ma réponse</button></div>';
      else h+='<div class="swc-b"><button class="pri" onclick="_swapAnswer(\''+o.id+'\')">'+(o.kind==='cede'?'Je le prends':'Je suis disponible')+'</button></div>';
    }
    return h+'</div>';}).join('');
}
async function _swapAnswer(id,remove){
  var o=_SW.offers.filter(function(x){return x.id===id;})[0];if(!o)return;var msg='';
  if(!remove){msg=await _ask('Répondre à '+o.name+'\n\n'+_swDay(o.date)+', '+o.vac+'. Message facultatif, par exemple le jour donné en échange.',{input:'',placeholder:'Message (facultatif)',ok:'Envoyer'});if(msg===null)return;}
  try{await _swapApi('/swap/answer',{id:id,msg:msg,remove:!!remove});_haptic();_infoToast(remove?'Réponse retirée':'Réponse envoyée à '+o.name);_swapList();}catch(e){_infoToast(e.message);}}
async function _swapClose(id,uid,name){
  var o=_SW.offers.filter(function(x){return x.id===id;})[0];if(!o)return;
  if(!await _ask(uid?'Conclure avec '+name+' ?\n\nUne notification lui est envoyée. L’échange reste à enregistrer dans les deux plannings.':'Retirer la proposition du '+_swDay(o.date).toLowerCase()+' ?',uid?{ok:'Conclure'}:{ok:'Retirer',del:1}))return;
  try{await _swapApi('/swap/close',{id:id,with:uid||null});_infoToast(uid?'Conclu avec '+name:'Proposition retirée');_swapList();}catch(e){_infoToast(e.message);}}
function _swapRecord(d){closeModal();setTimeout(function(){pendingKey=d;_lpk=d;_lockBodyScroll();window._cvReq=null;openCustomVacModal();},200);}
function _swapPostModal(key){
  var dt=new Date(key+'T12:00:00'),g=getVac(dt),VAC=getVAC(dt),V=VAC[g.vac]||{},hours=V.deb?V.deb+'–'+V.fin:'';
  window._swK='echange';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div>'
    +'<div class="st">Proposer à l’équipe</div><div class="ss" style="margin-bottom:14px">'+_swDay(key)+' · '+_h(vLbl(g.vac,VAC))+(hours?' · '+hours:'')+'</div>'
    +'<div class="sw-seg"><button id="sw-k0" class="on" onclick="window._swK=\'echange\';this.classList.add(\'on\');document.getElementById(\'sw-k1\').classList.remove(\'on\')">Échange</button>'
    +'<button id="sw-k1" onclick="window._swK=\'cede\';this.classList.add(\'on\');document.getElementById(\'sw-k0\').classList.remove(\'on\')">Je cède ce jour</button></div>'
    +'<input id="sw-note" type="text" maxlength="120" placeholder="Précision (facultatif) : contre un matin…" style="width:100%;height:44px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);margin-bottom:8px">'
    +'<div style="font-size:13px;color:var(--text3);line-height:1.45;margin:0 2px 14px">L’équipe reçoit une notification. Rien ne change dans les plannings tant que l’échange n’est pas enregistré.</div>'
    +'<button class="mb" id="sw-go" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);margin-bottom:8px" onclick="_swapPost(\''+key+'\',\''+_h(vLbl(g.vac,VAC)).replace(/'/g,'&#39;')+'\',\''+hours+'\')">Proposer</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button></div></div>';
}
async function _swapPost(key,vac,hours){
  var b=document.getElementById('sw-go');if(b){b.disabled=true;b.textContent='Envoi…';}
  try{await _swapApi('/swap/post',{date:key,vac:vac,hours:hours,kind:window._swK||'echange',note:(document.getElementById('sw-note')||{}).value||''});_haptic();_infoToast('Proposé à l’équipe');openSwaps(1);}
  catch(e){_infoToast(e.message);if(b){b.disabled=false;b.textContent='Proposer';}}}
// au retour dans l'app : nouvelles propositions ; appui sur une notification d'échange, app déjà ouverte : la liste
document.addEventListener('visibilitychange',function(){if(!document.hidden)_swapRefresh();});
try{navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.open==='swap')openSwaps(0);});}catch(e){}
function _openDayMenu(cell){
  var key=cell.getAttribute('data-key');if(!key)return false;
  var date=new Date(key+'T12:00:00'),v2=getVac(date),hasCg=(S.conges||{})[key];
  var items='';
  if(v2.echange&&((S.overrides||{})[key]||{}).echange){
    items='<button onclick="_dayMenuAct(\''+key+'\',\'unex\')" style="color:var(--red)"><i class="ti ti-arrow-back-up"></i>Annuler l’échange</button>';
  }else if(!(v2.vac&&v2.vac!=='RH'&&!v2.absent))return false; // jours non travaillés : simple appui
  else if(hasCg){
    items='<button onclick="_dayMenuAct(\''+key+'\',\'del\')" style="color:var(--red)"><i class="ti ti-trash"></i>Retirer '+(hasCg==='cg'?'le congé':hasCg==='rend'||hasCg==='rend-hist'?'le rendu':'')+'</button>';
  }else{
    var cs=calcSoldes(),dispo=cs.totalReal+cs.totalPrev+Math.max(0,cs.matelas),dur=getDur(date);
    var noRend=dispo<dur&&_rendStatus(key)==='rend',cR=Math.max(0,computeCongesRest(date.getFullYear()));
    items='<button onclick="_dayMenuAct(\''+key+'\',\'rend\')"'+(noRend?' disabled':'')+'><i class="ti ti-clock" style="color:var(--rend-text)"></i>Rendu</button>'
      +'<button onclick="_dayMenuAct(\''+key+'\',\'cg\')"'+(cR<=0?' disabled':'')+'><i class="ti ti-beach" style="color:var(--green)"></i>Congé</button>'
      +'<button onclick="_dayMenuAct(\''+key+'\',\'mod\')"><i class="ti ti-pencil" style="color:var(--blue)"></i>Modifier</button>'
      +(key>=dk(NOW)&&window._authToken?'<button onclick="_dayMenuAct(\''+key+'\',\'swap\')"><i class="ti ti-arrows-exchange" style="color:var(--amber)"></i>Proposer à l’équipe</button>':'');
  }
  items+='<button onclick="_dayMenuAct(\''+key+'\',\'open\')" style="color:var(--text2)"><i class="ti ti-dots"></i>Ouvrir la journée</button>';
  _haptic();
  cell.classList.add('lp-on');
  var veil=document.createElement('div');veil.id='lp-veil';
  veil.addEventListener('click',function(e){e.stopPropagation();_closeDayMenu();});
  veil.addEventListener('touchmove',function(e){e.preventDefault();},{passive:false});
  var m=document.createElement('div');m.id='lp-menu';
  m.innerHTML='<div class="lp-h">'+capitalize(fmtDate(date))+'</div>'+_dayMenuInfo(date)+items;
  document.body.appendChild(veil);document.body.appendChild(m);
  var r=cell.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;
  var left=Math.min(Math.max(12,r.left+r.width/2-mw/2),vw-mw-12);
  var below=r.bottom+10+mh<vh-12,top=below?r.bottom+10:Math.max(12,r.top-10-mh);
  m.style.left=left+'px';m.style.top=top+'px';
  m.style.transformOrigin=(r.left+r.width/2-left)+'px '+(below?'0':'100%');
  requestAnimationFrame(function(){veil.classList.add('on');m.classList.add('on');});
  return true;
}



// Tableau de gestion : écart de solde avec le décompte de l'app, et reports différents
function _gmRh(){
  var c=S.profile&&S.profile.rhCmp,o=S.profile&&S.profile.rhTable;if(!c||!o)return null;
  var L=[],e=-_rhDe(c),igRest=((S.profile||{}).ignRhC||{}).rest!=null,T=null;try{T=_rhStored();}catch(x){} // différences ignorées retirées
  if(Math.abs(e)>=2)L.push('- heures de rendus et matelas : le tableau m’en compte '+fmtMin(Math.abs(e))+' de '+(e>0?'plus':'moins')+' que mon décompte');
  // option « heures valables un an » : l'app compte tous les reports, ceux du tableau ne sont pas à contester
  if(T&&T.lines&&!igRest&&!(S.profile&&S.profile.exp12)){var eY=T.edition.getFullYear()*12+T.edition.getMonth(),rr={};T.lines.forEach(function(l){if(l.ym<eY)rr[l.ym]=Math.max(rr[l.ym]||0,l.rep||0);});
    Object.keys(rr).map(Number).sort(function(a,b){return a-b;}).forEach(function(ym){var x=getEphExtAt(ym,eY);if(getExpYm(ym)>=TODAY_YM&&x!==rr[ym])L.push('- heures acquises en '+MF_(ym)+' : '+(x?'report de '+x*3+' mois':'aucun report')+' accordé, '+(rr[ym]?'report de '+rr[ym]*3+' mois':'aucun report')+' dans le tableau');});}
  // heures expirées encore comptées au tableau, sans report : demande de confirmation ou de report
  (c.lost||[]).forEach(function(x){L.push('- '+fmtMin(x.min)+' acquises en '+MF_(x.ym)+' ont dépassé leur validité le '+new Date(x.v+'T12:00:00').toLocaleDateString('fr-FR')+' et sont signalées en alerte, mais restent comptées dans le solde : peux-tu me confirmer qu’elles sont encore utilisables, ou les reporter ?');});
  // fav : seulement un solde en ma faveur (pas coché d'office)
  return L.length?{ed:new Date(c.ed+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}),L:L,fav:L.length===1&&e>=2}:null;}




function openGestMail(repYms){
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  var R=_gmRep(repYms),X=repYms?[]:_gmLost(),Mo=repYms?[]:_gmMonet(),H=_gmRh(),P=_gmPaie();window._gmRepYms=repYms||null;
  var row=function(id,lbl,sub,n,off){return '<div class="srow" style="padding:8px 0;align-items:center"><div style="flex:1;min-width:0"><div style="font-size:15px;color:'+(n?'var(--text)':'var(--text3)')+'">'+lbl+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+sub+'</div></div>'
    +'<label class="tgl"><input type="checkbox" id="'+id+'"'+(n?(off?'':' checked'):' disabled')+'><span class="tgl-s"></span></label></div>';};
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div>'
    +'<div class="st" style="margin-bottom:2px">Mail au gestionnaire</div>'
    +'<div style="font-size:13px;color:var(--text3);margin-bottom:10px">Choisir ce que le mail demande.</div>'
    +'<div class="hd-card" style="padding:4px 14px">'
    +row('gm-lost','Reports d’heures déjà expirées',X.length?X.length+' mois · expirées il y a moins de 3 mois':'aucune heure perdue ces 3 derniers mois',X.length)
    +row('gm-rep','Reports d’heures qui vont expirer',R.length?R.length+' mois d’acquisition · '+(repYms?'heures choisies':'expirent en '+ML[TODAY_YM%12].toLowerCase()):'aucune heure n’expire en '+ML[TODAY_YM%12].toLowerCase(),R.length)
    +row('gm-mon','Monétisation',Mo.length?Mo.length+' mois · heures monétisées dans l’app':'aucune heure monétisée',Mo.length)
    +row('gm-rh','Corrections du tableau de gestion',H?(H.fav?'écart en ma faveur':H.L.length+' point'+(H.L.length>1?'s':''))+' · tableau du '+H.ed:(S.profile&&S.profile.rhCmp?(Math.abs(S.profile.rhCmp.d)>=2?'différences ignorées':'tableau identique'):S.profile&&S.profile.rhTable?'rien à comparer':'aucun tableau importé'),H,H&&H.fav)
    +row('gm-paie','Corrections de paie',P.length?P.length+' bulletin'+(P.length>1?'s':'')+' à corriger':'aucun écart sur les bulletins',P.length)
    +'</div>'
    +(function(){var n=0;try{n=(_bulPayDiffs().paid||[]).length;}catch(e){}return n?'<div style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--text2);line-height:1.4;margin-top:10px"><span style="color:var(--amber)">⚠</span><span style="flex:1">Génération de rendus : '+n+' mois où les réglages diffèrent des bulletins. Le mail le signale. Vérifier d’abord les réglages. <a style="color:var(--blue);cursor:pointer" onclick="_bulPayPropose(function(){openGestMail();},1)">Vérifier</a></span></div>':'';})()
    +'<div class="mbtns" style="margin-top:14px"><button class="mb" onclick="openMergedRenduCgModal(6,2)">Annuler</button><button class="mb pri" onclick="gestMailSend()">Rédiger le mail</button></div>'
    +'</div></div>';}
function gestMailSend(){
  var on=function(id){var e=document.getElementById(id);return !!(e&&e.checked&&!e.disabled);};
  var R=on('gm-rep')?_gmRep(window._gmRepYms):[],X=on('gm-lost')?_gmLost():[],Mo=on('gm-mon')?_gmMonet():[],H=on('gm-rh')?_gmRh():null,P=on('gm-paie')?_gmPaie():[];
  if(!R.length&&!X.length&&!Mo.length&&!H&&!P.length){alert('Rien à demander : cocher au moins un point.');return;}
  var m=_gmBuild(R,H,P,X,Mo);_openMail(m.sub,m.body);
  openMergedRenduCgModal(6,2);}

// Outlook sur iPhone / iPad (ms-outlook://), sinon la messagerie par défaut (mailto:, Outlook sur un poste qui l'a par défaut) ; destinataire saisi dans Outlook
function _openMail(sub,body){
  var q='subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body),mt='mailto:?'+q;
  var ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!ios){location.href=mt;return;}
  // Outlook pas installé : rien ne se passe, on se rabat sur Mail
  var gone=false,h=function(){if(document.hidden)gone=true;};document.addEventListener('visibilitychange',h);
  location.href='ms-outlook://compose?'+q;
  setTimeout(function(){document.removeEventListener('visibilitychange',h);if(!gone&&!document.hidden)location.href=mt;},1500);}



function monetSet(ym,on){var m=monetInfo(ym);if(on&&!(m.open&&m.min>0))return;
  pushUndo(on?'Rendus monétisés':'Monétisation annulée');if(!S.monet)S.monet={};
  if(on){S.monet[ym]={min:m.min,req:TODAY_YM,at:dk(NOW)};logH('Rendus de '+MF_(ym)+' : '+fmtMin(m.min)+' monétisées','#e0b050',dk(NOW));}
  else{delete S.monet[ym];if(S.history)S.history=S.history.filter(function(h){return String(h.d||'').indexOf('Rendus de '+MF_(ym)+' :')!==0;});}
  saveState();render();}
function _monetAct(ym,on,limit){_haptic();_closeDayMenu();monetSet(ym,on);openMergedRenduCgModal(limit,0);}
// Menu des reports d'un mois de rendus : sans report, +3, +6, +9 mois (dates d'expiration), le choix du tableau Gestion signalé
function _openRepMenu(btn,ym,limit,rr){
  var ext=getEphExtensions(ym),auto=(S.autoExtend&&S.autoExtend[ym])||0,dl=function(e){return MCs[e%12]+' '+String(Math.floor(e/12)).slice(2);};
  var items=[0,1,2,3].map(function(n){var e=ym+3+n*3,dis=n<auto,cur=n===ext;
    return '<button onclick="_repMenuAct('+ym+','+n+','+limit+')"'+(dis?' disabled':'')+'><i class="ti '+(cur?'ti-check':'ti-point')+'" style="color:'+(cur?'var(--orange)':'var(--text3)')+'"></i>'
      +(n?'Jusqu’à fin '+dl(e):'Sans report · fin '+dl(e))+'<span class="rep-tag">'+(n===rr?'<span style="color:var(--amber)">tableau</span>':n?'+'+n*3+' mois':'')+(dis?' · auto':'')+'</span></button>';}).join('');
  _haptic();
  var veil=document.createElement('div');veil.id='lp-veil';veil.style.zIndex=450;
  veil.addEventListener('click',function(e){e.stopPropagation();_closeDayMenu();});
  veil.addEventListener('touchmove',function(e){e.preventDefault();},{passive:false});
  var m=document.createElement('div');m.id='lp-menu';m.style.zIndex=451;
  var lost=getExpYm(ym)<TODAY_YM?(calcSoldes().preExpiry[ym]||0):0;
  var mi=monetInfo(ym),mon=(S.monet||{})[ym];
  var _gr=_rhGraceYm(ym);if(_gr!=null&&_gr+1>ym+3+getEphExtensions(ym)*3)items='<div class="lp-h" style="padding-top:0"><i class="ti ti-table" style="color:#9fdc8f"></i> Expirées, mais encore dans le solde du tableau Gestion : gardées jusqu’à fin '+MC[_gr%12].toLowerCase()+' (date du tableau). Un tableau qui les retire les enlève.</div>'+items;
  var _ap=(window._autoPlan||{})[ym];if(_ap)items='<div class="lp-h" style="padding-top:0"><i class="ti ti-calendar-plus" style="color:#9fdc8f"></i> Report auto prévu à l’échéance (7h ou moins)</div>'+items;
  if(mon)items+='<button onclick="_monetAct('+ym+',0,'+limit+')"><i class="ti ti-coin-euro" style="color:#e0b050"></i><span>'+fmtMin(mon.min)+' monétisées</span><span class="rep-tag">annuler</span></button>';
  else if(mi.open&&mi.min>0)items+='<button onclick="_monetAct('+ym+',1,'+limit+')"><i class="ti ti-coin-euro" style="color:#e0b050"></i><span>Monétiser '+fmtMin(mi.min)+'</span><span class="rep-tag">≈ '+fmtEuro(mi.eur)+'</span></button>';
  if(!mon&&mi.open&&mi.toConfirm>0)items+='<div class="lp-h" style="padding-top:2px">'+fmtMin(mi.toConfirm)+' reprises du tableau : monétisables à confirmer.</div>';
  m.innerHTML='<div class="lp-h">Heures acquises en '+MC[ym%12]+' '+Math.floor(ym/12)+(lost?'<br><span style="color:#e07a6e">'+fmtMin(lost)+' perdues</span>':'')+'</div>'+items+'<button onclick="_haptic();_closeDayMenu();openGestMail(['+ym+'])"><i class="ti ti-mail" style="color:var(--blue)"></i><span style="color:var(--blue)">Demander par mail</span></button>'+(auto?'<div class="lp-h" style="padding-top:2px">Report automatique (moins de 7h restantes) : ne peut pas être retiré.</div>':'');
  document.body.appendChild(veil);document.body.appendChild(m);
  var r=btn.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;
  var left=Math.min(Math.max(12,r.right-mw),vw-mw-12),below=r.bottom+8+mh<vh-12,top=below?r.bottom+8:Math.max(12,r.top-8-mh);
  m.style.left=left+'px';m.style.top=top+'px';m.style.transformOrigin=(r.left+r.width/2-left)+'px '+(below?'0':'100%');
  requestAnimationFrame(function(){veil.classList.add('on');m.classList.add('on');});
}
// Paie du mois : sous-menu des écarts, chacun ignorable (gardé ignoré tant que son montant ne change pas)
function _openBulIgnMenu(btn,ym){
  var c=_bulCompare(S.bulletins[ym]),fe=function(x){return fmtEuro(Math.abs(x)).replace(/\s*€/,'');};
  var items=c.items.map(function(i){return '<button onclick="_bulIgnAct('+ym+',\''+i.id+'\','+(i.ign?0:1)+')"><i class="ti '+(i.ign?'ti-eye-off':'ti-alert-triangle')+'" style="color:'+(i.ign?'var(--text3)':'var(--amber)')+'"></i>'
    +'<span style="'+(i.ign?'color:var(--text3)':'')+'">'+_h(i.lbl)+'</span><span class="rep-tag">'+(i.d?(i.d>0?'+':'−')+fe(i.d)+' · ':'')+(i.ign?'ignoré':'ignorer')+'</span></button>';}).join('');
  var allI=c.items.every(function(i){return i.ign;});
  if(c.items.length)items='<button onclick="_bulIgnAct('+ym+',\'*\','+(allI?0:1)+')"><i class="ti '+(allI?'ti-eye':'ti-eye-off')+'" style="color:var(--blue)"></i><span style="color:var(--blue)">'+(allI?'Ne plus rien ignorer':'Tout ignorer')+'</span></button>'+items;
  _haptic();
  var veil=document.createElement('div');veil.id='lp-veil';veil.style.zIndex=450;
  veil.addEventListener('click',function(e){e.stopPropagation();_closeDayMenu();});
  veil.addEventListener('touchmove',function(e){e.preventDefault();},{passive:false});
  var m=document.createElement('div');m.id='lp-menu';m.style.zIndex=451;
  m.innerHTML='<div class="lp-h">Écarts '+_deMois(ym)+' '+Math.floor(ym/12)+' · toucher pour ignorer</div>'+items;
  document.body.appendChild(veil);document.body.appendChild(m);
  var r=btn.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;
  var left=Math.min(Math.max(12,r.right-mw),vw-mw-12),below=r.bottom+8+mh<vh-12,top=below?r.bottom+8:Math.max(12,r.top-8-mh);
  m.style.left=left+'px';m.style.top=top+'px';m.style.transformOrigin=(r.left+r.width/2-left)+'px '+(below?'0':'100%');
  requestAnimationFrame(function(){veil.classList.add('on');m.classList.add('on');});
}

function _bulIgnAct(ym,id,on){_haptic();_closeDayMenu();bulIgnL(ym,id,on);}
function _repMenuAct(ym,n,limit){
  _haptic();_closeDayMenu();
  if(n===getEphExtensions(ym))return;
  pushUndo('Report modifié');if(!S.ephExtend)S.ephExtend={};if(n>0)S.ephExtend[ym]=n;else delete S.ephExtend[ym];
  saveState();render();openMergedRenduCgModal(limit,0);
}
function _dayMenuAct(key,act){
  _haptic();
  _closeDayMenu();
  pendingKey=key;_lpk=key;
  if(act==='open'){openDay(key);return;}
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  if(act==='del'){removeCongé();return;}
  if(act==='unex'){cancelExchange(key);return;}
  if(act==='mod'){window._cvReq=null;openCustomVacModal();return;}
  if(act==='swap'){_swapPostModal(key);return;}
  if(act==='ex')openExchange(key);else openPoseModal(act,1);
}
function openPoseModal(type,fromMenu){
  // Ouvert depuis le mini-menu du calendrier : Retour ferme au lieu d'ouvrir la fiche du jour
  const back=fromMenu?'closeModal()':'openDay(\''+(pendingKey||_lpk)+'\')';
  const key=pendingKey||_lpk;
  if(!key)return;
  const date=new Date(key+'T12:00:00');
  // Build a list of valid target days from this day forward (worked days, same type logic)
  // Show: Unique | Jusqu'au [date picker equivalent - show next worked days]
  const lbl=type==='cg'?'Congé':type==='rend'?'Rendu':'Absence';
  const color=type==='cg'?'var(--green)':type==='rend'?'var(--rend-text)':'var(--text2)';
  // Absence : motif (congé exceptionnel de l'accord, ou sans motif) ; rentrée scolaire = ½ journée, l'autre moitié travaillée ou en rendus
  var excH='';if(type==='absent'){var _y=date.getFullYear(),_sel='width:100%;height:42px;box-sizing:border-box;padding:0 10px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text)';
    excH='<select id="_exc-m" onchange="_excPick()" style="'+_sel+';margin-bottom:6px"><option value="">Absence (sans motif)</option>'
      // « Absence non rémunérée » n'est plus proposée (même traitement que la grève) ; les jours déjà saisis restent lus
      +Object.keys(EXC_M).filter(function(m){return m!=='nonrem';}).map(function(m){return '<option value="'+m+'">'+EXC_M[m].l+'</option>';}).join('')+'</select>'
      +'<div id="_exc-i" style="font-size:11px;color:var(--text3);line-height:1.4;min-height:15px;margin-bottom:8px"></div>'
      +'<div id="_exc-g" style="display:none;margin-bottom:10px"><span class="bpseg" id="_exc-gv" data-v="j" style="display:flex">'+[['h','1 heure'],['dj','½ journée'],['j','journée']].map(function(o){return '<span style="flex:1;text-align:center"'+(o[0]==='j'?' class="on"':'')+' onclick="var g=this.parentNode;g.dataset.v=\''+o[0]+'\';[].forEach.call(g.children,function(c){c.classList.toggle(\'on\',c===this);},this)">'+o[1]+'</span>';}).join('')+'</span>'
      +'<details style="margin-top:6px;font-size:11px;color:var(--text3);line-height:1.45"><summary style="cursor:pointer;color:var(--blue)">Règles de décompte</summary><div style="margin-top:4px">'+getGreveConf().txt+'</div></details></div>'
      +'<div id="_exc-o" style="display:none;margin-bottom:10px"><input id="_exc-lbl" maxlength="40" placeholder="Précision (facultatif)" style="'+_sel+';font-size:13px;margin-bottom:8px">'
      +_excKeepRows(null)+'</div>'
      +'<div id="_exc-h" style="display:none;margin-bottom:10px"><div style="font-size:11px;color:var(--text3);margin-bottom:5px">L’autre moitié de la vacation</div>'
      +'<span class="bpseg" id="_exc-r" data-v="work" style="display:flex">'+['work','rend'].map(function(v,i){return '<span style="flex:1;text-align:center"'+(i?'':' class="on"')+' onclick="var g=this.parentNode;g.dataset.v=\''+v+'\';[].forEach.call(g.children,function(c){c.classList.toggle(\'on\',c===this);},this)">'+(v==='work'?'travaillée':'en rendus')+'</span>';}).join('')+'</span></div>';
    window._excYear=_y;}
  const bg=type==='cg'?'var(--green-l)':type==='rend'?'var(--rend-l)':'var(--bg3)';

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
      if(lastMonK&&nxtMk!==lastMonK){opts+='<option disabled>────────</option>';}
      lastMonK=nxtMk;
      opts+='<option value="'+nk+'"'+(opts===''?' selected':'')+'>'+fmtDate(nxt)+'</option>';
    }
    count++;
  }

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)'+back+'"><div class="sheet" style="max-height:'+(type==='absent'?560:380)+'px">'
    +'<div class="sh"></div>'
    +'<div class="st" style="color:#fff;margin-bottom:14px">'+lbl+'</div>'+excH
    +'<div class="mbtns" style="margin-bottom:10px">'
    +'<button class="mb" style="background:'+bg+';color:'+color+';border:none" onclick="applyPose(\''+type+'\',\''+key+'\',true)">Ce jour seulement</button>'
    +'<button class="mb" style="background:'+bg+';color:'+color+';border:none" onclick="showPoseSelect()">Plusieurs jours…</button>'
    +'</div>'
    +'<div id="pose-select-wrap" style="display:none;margin-bottom:10px">'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +'<span style="font-size:13px;color:var(--text2);flex-shrink:0">Jusqu’au</span>'
    +'<select id="pose-until" style="flex:1;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text)">'+opts+'</select>'
    +'<button class="mb pri" style="flex-shrink:0;white-space:nowrap" onclick="applyPose(\''+type+'\',\''+key+'\',false)">Valider</button>'
    +'</div>'
    +'</div>'
    +'<button class="mcancel" onclick="'+back+'">Retour</button>'
    +'</div></div>';
  if(type==='absent')_excPick();
}



function _excSet(k,f,on){var x=(S.excInfo||{})[k];if(!x)return;pushUndo('Congé exceptionnel : réglage');if(on)x[f]=1;else delete x[f];saveState();render();}
function _excOpt(m){var o={m:m};document.querySelectorAll('#_exc-o .exc-keep input[data-f]').forEach(function(c){if(c.checked)o[c.dataset.f]=1;});var l=((document.getElementById('_exc-lbl')||{}).value||'').trim().slice(0,40);if(l)o.lbl=l;return o;}
function _excKeepSheet(k){var x=(S.excInfo||{})[k];if(!x)return;
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)openDay(\''+k+'\')"><div class="sheet"><div class="sh"></div><div class="st">'+_h(_excL(x))+'</div>'
    +'<div style="font-size:13px;color:var(--text3);margin:-4px 0 10px">Ce que garde la journée, d’après la vacation prévue au cycle. La journée reste un repos pour les règles de repos.</div>'
    +_excKeepRows(k)+'<button class="mcancel" onclick="openDay(\''+k+'\')">OK</button></div></div>';}
function _excRemove(k){pushUndo('Congé exceptionnel retiré');var x=(S.excInfo||{})[k];if(x&&x.rest==='rend'&&S.conges)delete S.conges[k];if(S.excInfo)delete S.excInfo[k];saveState();render();openDay(k);}
function _excPick(){var m=(document.getElementById('_exc-m')||{}).value,i=document.getElementById('_exc-i'),h=document.getElementById('_exc-h'),X=EXC_M[m];
  if(h)h.style.display=X&&X.half?'block':'none';var oo=document.getElementById('_exc-o');if(oo)oo.style.display=X&&X.opt?'block':'none';
  if(X&&X.opt){if(i)i.textContent='Ce que garde la journée, d’après la vacation prévue au cycle. Elle reste un repos pour les règles de repos.';return;}
  var gg=document.getElementById('_exc-g');if(gg)gg.style.display=X&&X.greve?'block':'none';
  if(X&&X.greve){var G=getGreveConf();if(i)i.textContent='Retenue : 1/'+G.h+'ᵉ l’heure · 1/'+G.dj+'ᵉ la ½ journée · 1/'+G.j+'ᵉ la journée du salaire mensuel';return;}
  if(i)i.textContent=X?((X.info||'')+(m!=='autre'?' · déjà pris en '+window._excYear+' : '+String(_excUsed(m,window._excYear)).replace('.',',')+' j':'')):'Ni congé ni rendu : la journée n’est pas comptée.';}







// ============================================================
// COMPARAISON AVEC LE TABLEAU RH (fichier Excel lu sur l'appareil, rien n'est envoyé)
// ============================================================
// Lecteur .xlsx minimal : zip (méthode « deflate » via DecompressionStream) + XML de la 1re feuille
async function _xlsxRead(file){
  const buf=new Uint8Array(await file.arrayBuffer()),dv=new DataView(buf.buffer);
  let eocd=-1;for(let i=buf.length-22;i>=Math.max(0,buf.length-65558);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error('Fichier Excel illisible');
  const n=dv.getUint16(eocd+10,true);let p=dv.getUint32(eocd+16,true);const entries={};
  for(let i=0;i<n;i++){
    const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),xlen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    entries[new TextDecoder().decode(buf.subarray(p+46,p+46+nlen))]={method,csize,off};p+=46+nlen+xlen+clen;
  }
  async function read(name){
    const e=entries[name];if(!e)return null;
    const lh=e.off,start=lh+30+dv.getUint16(lh+26,true)+dv.getUint16(lh+28,true),data=buf.subarray(start,start+e.csize);
    if(e.method===0)return new TextDecoder().decode(data);
    if(typeof DecompressionStream==='undefined')throw new Error('Navigateur trop ancien pour lire ce fichier');
    const ds=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(ds).text();
  }
  const xml=t=>new DOMParser().parseFromString(t,'application/xml');
  const ss=[];const ssx=await read('xl/sharedStrings.xml');
  if(ssx)xml(ssx).querySelectorAll('si').forEach(si=>ss.push(Array.from(si.getElementsByTagName('t')).map(t=>t.textContent).join('')));
  const sheetName=Object.keys(entries).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const doc=xml(await read(sheetName));const cells={};
  doc.querySelectorAll('c').forEach(c=>{
    const r=c.getAttribute('r'),t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0];let val=v?v.textContent:null;
    if(t==='s'&&val!==null)val=ss[+val];else if(t==='inlineStr')val=Array.from(c.getElementsByTagName('t')).map(x=>x.textContent).join('');
    else if(t!=='str'&&val!==null&&val!==''&&!isNaN(+val))val=+val;
    if(val!==null&&val!=='')cells[r]=val;
  });
  return cells;
}







// Fichier Excel original du tableau (mise en page d'origine) : envoyé au serveur à part, ouvert ou partagé depuis l'app
async function _rhUpload(f){if(!f||!window._authToken||!_aid||!S.profile)return;
  try{var u=new Uint8Array(await f.arrayBuffer());if(u.length>2e6)return;var b='';for(var i=0;i<u.length;i+=32768)b+=String.fromCharCode.apply(null,u.subarray(i,i+32768));
    var r=await fetch(CLOUD_API+'/file/rh/save',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:_aid,name:f.name,b64:btoa(b)})});
    if(r.ok){S.profile.rhFile={name:f.name,at:Date.now()};saveState();}}catch(e){}}
async function _rhOpenOriginal(){
  var j=null;try{j=await (await fetch(CLOUD_API+'/file/rh/get',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:_aid})})).json();}catch(e){}
  var fr=j&&j.file;if(!fr){_infoToast('Fichier original indisponible : réimporter le tableau');return;}
  var bin=atob(fr.b64),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  var type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',file=new File([u],fr.name||'tableau.xlsx',{type:type});
  // iPhone : feuille de partage (Ouvrir avec, Enregistrer dans Fichiers, Imprimer → PDF) ; sinon téléchargement
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:file.name});return;}}catch(e){if(e&&e.name==='AbortError')return;}
  var url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},60000);}
function _rhStore(cells,name){if(!S.profile)return;S.profile.rhTable={cells:_rhCompact(cells),name,at:Date.now()};saveState();try{localStorage.removeItem(_rhStoreKey());}catch(e){}}
function _rhStored(){
  let o=S.profile&&S.profile.rhTable;
  // Ancien stockage sur l'appareil : repris une fois dans le compte
  if(!o){try{const l=JSON.parse(localStorage.getItem(_rhStoreKey())||'null');if(l&&l.cells){_rhStore(l.cells,l.name);o=S.profile&&S.profile.rhTable;}}catch(e){}}
  try{return o&&o.cells?_rhParse(o.cells,o.name):null;}catch(e){return null;}}
// Bouton du modal rendus : tableau gardé en mémoire s'il y en a un, sinon choix du fichier
// Ouverture depuis le Récap : le modal affiche « ‹ Récap » pour y revenir
function rhOpenFrom(from,newFile){window._rvFrom=from;const rh=newFile?null:_rhStored();if(rh)rhCompareShow(rh);else rhCompareOpen();}
function rhOpenFromRecap(newFile){rhOpenFrom('recap',newFile);}


function _loadScript(u){return new Promise(function(ok,ko){if(window.ExcelJS)return ok();var t=document.createElement('script');t.src=u;t.onload=ok;t.onerror=function(){ko(new Error('Chargement impossible'));};document.head.appendChild(t);});}

function _xlBorder(b){if(!b||!b.style)return null;var w=b.style==='thick'?3:b.style==='medium'||b.style==='mediumDashed'?2:1,k=/dash|dot/i.test(b.style)?'dashed':b.style==='double'?'double':'solid';return w+'px '+k+' '+(_xlColor(b.color)||'#000');}

function _rhOrigHtml(wb){var ws=wb.worksheets[0];if(!ws)return '';
  var nc=ws.columnCount||1,last=0;ws.eachRow({includeEmpty:false},function(row,r){row.eachCell({includeEmpty:false},function(c){var t=_xlText(c);if(t!==''&&t!=='0')last=Math.max(last,r);});});
  var nr=Math.min(ws.rowCount,last+1),cw=[],span={},cov={};
  for(var c=1;c<=nc;c++){var col=ws.getColumn(c);cw[c]=col.hidden?0:Math.round(((col.width||(ws.properties&&ws.properties.defaultColWidth)||10.71))*7+5);}
  (ws.model&&ws.model.merges||[]).forEach(function(m){var a=m.split(':'),p=_xlsxSplit(a[0]),q=_xlsxSplit(a[1]||a[0]),cn=function(x){var n=0;for(var i=0;i<x.length;i++)n=n*26+x.charCodeAt(i)-64;return n;};
    var r1=p.row,r2=q.row,c1=cn(p.col),c2=cn(q.col);span[r1+':'+c1]=[r2-r1+1,c2-c1+1];for(var r=r1;r<=r2;r++)for(var cc=c1;cc<=c2;cc++)if(r!==r1||cc!==c1)cov[r+':'+cc]=1;});
  var cfs=[];(ws.conditionalFormattings||[]).forEach(function(cf){(cf.rules||[]).forEach(function(ru){var tx=ru.text||(/SEARCH\("([^"]*)"/.exec((ru.formulae||[])[0]||'')||[])[1];if(ru.type==='containsText'&&tx)cfs.push({ref:cf.ref,text:String(tx).toLowerCase(),st:ru.style||{}});});});
  var inRef=function(ref,r,c){return String(ref).split(/\s+/).some(function(rg){var a=rg.split(':'),p=_xlsxSplit(a[0]),q=_xlsxSplit(a[1]||a[0]),cn=function(x){var n=0;for(var i=0;i<x.length;i++)n=n*26+x.charCodeAt(i)-64;return n;};return r>=p.row&&r<=q.row&&c>=cn(p.col)&&c<=cn(q.col);});};
  var gl='1px solid #e1e1e1',h='<table style="zoom:.72;border-collapse:collapse;table-layout:fixed;background:#fff;color:#000;font:14.7px Calibri,Carlito,Arial,sans-serif"><colgroup>';
  for(c=1;c<=nc;c++)h+='<col style="width:'+cw[c]+'px">';h+='</colgroup>';
  for(var r=1;r<=nr;r++){var row=ws.getRow(r);if(row.hidden)continue;h+='<tr style="height:'+Math.round((row.height||15)*1.333)+'px">';
    for(c=1;c<=nc;c++){if(cov[r+':'+c]||!cw[c])continue;var cell=row.getCell(c),st=cell.style||{},f=st.font||{},al=st.alignment||{},b=st.border||{},sp=span[r+':'+c],t=_xlText(cell);
      var fill=st.fill&&st.fill.type==='pattern'&&st.fill.pattern==='solid'?_xlColor(st.fill.fgColor):null,col=_xlColor(f.color);
      cfs.forEach(function(x){if(t&&inRef(x.ref,r,c)&&t.toLowerCase().indexOf(x.text)>=0){var xf=x.st.fill,xc=x.st.font&&x.st.font.color;if(xf)fill=_xlColor(xf.bgColor||xf.fgColor)||fill;if(xc)col=_xlColor(xc)||col;}});
      var num=typeof cell.value==='number'||(cell.value&&typeof cell.value==='object'&&typeof cell.value.result==='number'),ha=al.horizontal||(num||cell.value instanceof Date?'right':'left');
      var css='padding:0 3px;overflow:hidden;white-space:'+(al.wrapText?'normal':'nowrap')+';text-overflow:clip;vertical-align:'+(al.vertical==='middle'||al.vertical==='center'?'middle':al.vertical==='top'?'top':'bottom')+';text-align:'+(ha==='centerContinuous'?'center':ha)
        +';border-left:'+(_xlBorder(b.left)||gl)+';border-right:'+(_xlBorder(b.right)||gl)+';border-top:'+(_xlBorder(b.top)||gl)+';border-bottom:'+(_xlBorder(b.bottom)||gl)
        +(fill?';background:'+fill:'')+(col?';color:'+col:'')+(f.bold?';font-weight:700':'')+(f.italic?';font-style:italic':'')+(f.underline?';text-decoration:underline':'')+(f.size&&f.size!==11?';font-size:'+Math.round(f.size*1.333)+'px':'');
      h+='<td'+(sp?' rowspan="'+sp[0]+'" colspan="'+sp[1]+'"':'')+' style="'+css+'">'+_h(t)+'</td>';}
    h+='</tr>';}
  return '<div style="overflow:auto;-webkit-overflow-scrolling:touch;max-height:62vh;border-radius:12px;background:#fff">'+h+'</table></div>';}
async function _rhRenderOriginal(){var box=document.getElementById('rh-orig');if(!box)return;var at=(S.profile.rhFile||{}).at;
  try{if(!window._rhOrig||window._rhOrig.at!==at){
      var j=await (await fetch(CLOUD_API+'/file/rh/get',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:_aid})})).json(),fr=j&&j.file;if(!fr)throw new Error('absent');
      var bin=atob(fr.b64),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
      await _loadScript(_EXJS);var wb=new ExcelJS.Workbook();await wb.xlsx.load(u.buffer);window._rhOrig={at:at,html:_rhOrigHtml(wb)};}
    box=document.getElementById('rh-orig');if(box)box.innerHTML=window._rhOrig.html+'<div style="font-size:11px;color:var(--text3);margin:8px 2px 0">Le fichier tel qu’importé. Faire glisser pour le parcourir.</div>';}
  catch(e){box=document.getElementById('rh-orig');if(box)box.innerHTML=_rhSheetHtml((S.profile.rhTable||{}).cells||{})+'<div style="font-size:11px;color:var(--text3);margin:8px 2px 0;line-height:1.4">Fichier original '+(e.message==='absent'?'pas encore gardé : réimporter le tableau pour le voir avec sa mise en page':'injoignable')+'. Ici, la feuille recréée à partir des valeurs.</div>';}}
function _rhView(mode){var rh=_rhStored();if(!rh){_infoToast('Aucun tableau gardé');return;}
  if(mode==null)mode=window._rhViewMode||'sheet';window._rhViewMode=mode;
  var o=S.profile.rhTable||{},ed=rh.edition,fd=function(d){return d?new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),12).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'}):'';},
    hm=function(v){return v?fmtMin(Math.round(v)):'—';},T=rh.tot||{},
    tl=[['Stock au 31/12',T.stock2025],['Conso sur stock',T.consoStock],['Stock actualisé',T.stockAct],['Cumul acquisitions',T.cumAcq],['Cumul consommations',T.cumCons],['Cumul soldes',T.cumSol]].filter(function(x){return x[1]!=null;});
  var th='padding:6px 6px;font-size:11px;font-weight:600;color:var(--text3);text-align:right;white-space:nowrap',td='padding:6px 6px;font-size:13px;text-align:right;white-space:nowrap;border-top:0.5px solid var(--border2)';
  var rows=rh.lines.filter(function(l){return l.nature||l.acq||l.cons||l.solde||l.stock||l.com;}).map(function(l){
    var v=l.rep?(l.validRep||l.valid):l.valid,vd=v?new Date(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate(),12):null,al=l.solde>0&&vd&&vd<ed;
    return '<tr'+(al?' style="background:rgba(200,128,72,.14)"':'')+'><td style="'+td+';text-align:left">'+_h(MCs[l.ym%12]+' '+String(Math.floor(l.ym/12)).slice(2))+'</td><td style="'+td+';text-align:left">'+_h(l.nature||(l.stock?'Stock':''))+'</td>'
      +'<td style="'+td+'">'+hm(l.acq)+'</td><td style="'+td+'">'+hm(l.cons||l.stock)+'</td><td style="'+td+(l.solde>0?';font-weight:600':'')+'">'+hm(l.solde)+'</td>'
      +'<td style="'+td+(al?';color:var(--orange)':'')+'">'+(v?fd(v):'')+(l.rep?' <span style="color:var(--text3)">(+'+l.rep*3+' m)</span>':'')+'</td></tr>'
      +(l.com?'<tr'+(al?' style="background:rgba(200,128,72,.14)"':'')+'><td colspan="6" style="padding:0 6px 6px;font-size:11px;color:var(--text3);text-align:left;white-space:normal">'+_h(l.com)+'</td></tr>':'');}).join('');
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet tabmod"><div class="sh"></div>'
    +'<div class="nav-back" style="'+_navBackCss+'" onclick="rhOpenFromRecap()">‹ Tableau Gestion</div>'
    +'<div class="st" style="text-align:center">Tableau du '+ed.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</div>'
    +(o.name?'<div style="text-align:center;font-size:11px;color:var(--text3);margin:-6px 0 12px">'+_h(o.name)+'</div>':'')
    +'<div style="display:flex;justify-content:center;margin:-2px 0 12px"><button class="adj-pill" style="width:auto;padding:0 14px;height:30px;font-size:13px" onclick="_rhOpenOriginal()"><i class="ti ti-file-spreadsheet" style="margin-right:5px"></i>Fichier original'+(S.profile.rhFile&&S.profile.rhFile.name===o.name?'':' (si gardé)')+'</button></div>'
    +'<div class="vseg" style="display:flex;background:var(--btn);border-radius:999px;padding:3px;gap:2px;margin:0 0 12px">'+[['sheet','Feuille Excel'],['read','Lu par l’app']].map(function(x){return '<button onclick="_rhView(\''+x[0]+'\')" style="flex:1;border:none;font:inherit;font-size:13px;padding:7px 4px;border-radius:999px;cursor:pointer;background:'+(mode===x[0]?'var(--btn-a,rgba(255,250,243,.16))':'none')+';color:'+(mode===x[0]?'var(--text)':'var(--text2)')+';font-weight:'+(mode===x[0]?'600':'400')+'">'+x[1]+'</button>';}).join('')+'</div>'
    +(mode==='sheet'?'<div id="rh-orig">'+(window._rhOrig&&S.profile.rhFile&&window._rhOrig.at===S.profile.rhFile.at?window._rhOrig.html:'<div style="padding:30px 0;text-align:center;font-size:13px;color:var(--text3)">Ouverture du fichier…</div>')+'</div>':'')
    +(mode==='sheet'?'':(tl.length?'<div class="hd-card" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;padding:12px 14px;margin-bottom:10px">'+tl.map(function(x){return '<div style="font-size:11px;color:var(--text3)">'+x[0]+'<b style="display:block;font-size:15px;color:var(--text);font-weight:600">'+fmtMin(Math.round(x[1]))+'</b></div>';}).join('')+'</div>':'')
    +'<div class="hd-card" style="padding:4px 4px 6px;overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tr><th style="'+th+';text-align:left">Mois</th><th style="'+th+';text-align:left">Nature</th><th style="'+th+'">Acquis</th><th style="'+th+'">Conso</th><th style="'+th+'">Solde</th><th style="'+th+'">Validité</th></tr>'+rows+'</table></div>'
    +'<div style="font-size:11px;color:var(--text3);margin:8px 2px 0;line-height:1.4">En orange : heures dont la validité est passée, encore comptées dans le solde (« Alerte » du gestionnaire).</div>')
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button></div></div>';
  if(mode==='sheet')_rhRenderOriginal();
}
function _rdOpenMonth(ym){_haptic();window._mmFrom='rendus';openMergedMoisModal(ym,0);}
function _mmGoBack(){window._mmFrom=null;openMergedRenduCgModal(6,0);}
function _rvGoBack(){const t=window._rvFrom==='rendus'?0:2;window._rvFrom=null;openMergedRenduCgModal(6,t);}

function rhCompareOpen(mode){
  let inp=document.getElementById('rh-file');
  if(!inp){inp=document.createElement('input');inp.type='file';inp.id='rh-file';inp.accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';inp.style.display='none';document.body.appendChild(inp);
    inp.addEventListener('change',function(){const f=inp.files&&inp.files[0];inp.value='';if(f)_rhFile(f,inp._mode);});}
  inp._mode=mode||'compare';inp.click();
}
// Écart avec le dernier tableau Gestion importé, recalculé d'après l'état actuel (tuiles Écart Rendus à jour)
function _rhCmpRefresh(){try{var rh=_rhStored();if(rh)rhCompareShow(rh,true);}catch(e){}}
// Tableau Gestion lu : premier import (ou demandé) → on en repart ; sinon comparaison
async function _rhFile(f,mode){
  try{const cells=await _xlsxRead(f);const rh=_rhParse(cells,f.name),pr=S.profile||{},st=pr.start,ek=dk(_rhEd(rh));
    // départ demandé, ou tableau pas plus récent que le départ : proposer d'en faire le départ du calcul
    if(mode==='start'||!st||ek<=st.d){if(mode==='start'||await _ask('Tableau du '+_rhEd(rh).toLocaleDateString('fr-FR')+' : '+(st?(ek===st.d?'même date que votre départ':'plus ancien que votre départ')+' ('+_startTxt(st)+').\n\n':'')+'En faire le départ du calcul ?\n\nSes soldes (matelas, heures, reports) deviennent ceux du départ ; les rendus posés après sa dernière semaine notée sont décomptés par l’app.',{ok:'En faire le départ',cancel:'Non'})){
        pushUndo('Départ du calcul changé');_startApply(_startFromTable(rh));_rhUpload(f);render();closeModal();_infoToast('✓ Départ : tableau du '+_rhEd(rh).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));
        const L=_rhStored();if(L&&dk(_rhEd(L))>ek){window._rvFrom=null;rhCompareShow(L);}}
      return;}
    // plus récent : il sert à vérifier, rien d'autre ne change
    _rhStore(cells,f.name);_rhUpload(f);rhCompareShow(rh);}
  catch(e){console.warn(e);showBlockAlert('Lecture impossible',e.message||'Ce fichier n’a pas pu être lu.');}}
// ── Import du tableau RH : un seul bouton. Premier tableau : on en repart ; ensuite : comparaison, avec « Repartir de ce tableau » en bas ──
function rhImportOpen(){rhCompareOpen();}


function _suOpen(){
  if(document.getElementById('setup'))return;
  SU={step:0,rh:null,rh0:null,rhBusy:null,rhMode:null,bul:{},bulMode:null,v:{line:'',dimRendu:true,rhRendu:true,ferRendu:true,hsRendu:true,pfa:0,pct:100}};
  _suRestore();
  var el=document.createElement('div');el.id='setup';document.body.appendChild(el);document.body.classList.add('su-on');
  _suPullRefresh(el);
  el.addEventListener('input',_suSaveSoon);el.addEventListener('change',_suSaveSoon);
  // Retour du téléphone ou du navigateur : étape précédente, et depuis la première, l'écran de connexion (le compte est déjà enregistré)
  // iPhone : pas d'entrée d'historique (le glissement retour afficherait une page blanche) ; la flèche ‹ de chaque écran suffit
  var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!ios)try{history.pushState({su:1},'');}catch(e){}
  if(ios)_suSwipeBack(el);
  if(!ios&&!window._suPop){window._suPop=1;window.addEventListener('popstate',function(){
    if(!SU||!document.getElementById('setup'))return;
    if(SU.step>0){try{history.pushState({su:1},'');}catch(e){}_suGo(SU.step-1);}else signOut();});}
  _suDraw();
}

function _suSave(){try{if(!SU)return;_suRead();var o=JSON.stringify({step:SU.step,v:SU.v,rhMode:SU.rhMode,rh:SU.rh?{cells:SU.rh.cells,name:SU.rh.name}:null,bul:SU.bul,bulMode:SU.bulMode,aviFrom:SU.aviFrom,anniR:SU.anniR});
  try{localStorage.setItem(_suKey(),o);}catch(e){sessionStorage.setItem('pl_su',o);}}catch(e){}}
function _suSaveSoon(){clearTimeout(_suSaveT);_suSaveT=setTimeout(_suSave,300);}


function _suPullRefresh(el){var y0=null,dy=0,trig=false,w=null;
  var show=function(p){if(!w){w=document.createElement('div');w.className='bt-ptr su-ptr';w.innerHTML=window._bootSpinSvg||'';document.body.appendChild(w);}
    w.style.opacity=String(Math.min(1,p*1.4));w.style.transform='translateY('+Math.round(Math.min(1,p)*40)+'px) scale('+(.6+.4*Math.min(1,p))+')';};
  var hide=function(){if(!w)return;var x=w;w=null;x.style.transition='opacity .2s ease,transform .2s ease';x.style.opacity='0';x.style.transform='translateY(0) scale(.6)';setTimeout(function(){x.remove();},220);};
  el.addEventListener('touchstart',function(e){y0=el.scrollTop<=0&&e.touches[0].clientX>28?e.touches[0].clientY:null;dy=0;trig=false;},{passive:true});
  el.addEventListener('touchmove',function(e){if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy<=0){if(w)hide();return;}
    var p=dy/110;show(p);var was=trig;trig=p>=1;if(trig&&!was)_haptic();},{passive:true});
  el.addEventListener('touchend',function(){if(y0==null)return;y0=null;if(!trig){hide();return;}
    if(w)w.classList.add('spin');_suSave();setTimeout(function(){location.reload();},350);},{passive:true});}
// Glisser depuis le bord gauche : étape précédente (la carte suit le doigt), sans passer par l'historique
function _suSwipeBack(el){var x0=null,y0=0,dx=0,on=false,card=function(){return el.querySelector('.su-card');};
  el.addEventListener('touchstart',function(e){var t=e.touches[0];x0=SU&&SU.step>0&&t.clientX<28?t.clientX:null;y0=t.clientY;dx=0;on=false;},{passive:true});
  el.addEventListener('touchmove',function(e){if(x0==null)return;var t=e.touches[0];dx=t.clientX-x0;
    if(!on){if(Math.abs(t.clientY-y0)>Math.abs(dx)){x0=null;return;}if(dx<8)return;on=true;}
    var c=card();if(c){c.style.transition='none';c.style.transform='translateX('+Math.max(0,dx)+'px)';c.style.opacity=String(1-Math.min(.5,dx/600));}},{passive:true});
  el.addEventListener('touchend',function(){if(x0==null)return;x0=null;var c=card();if(!c||!on)return;
    if(dx>90){c.style.transition='transform .18s ease,opacity .18s ease';c.style.transform='translateX(110%)';c.style.opacity='0';
      setTimeout(function(){_suGo(SU.step-1);var n=card();if(!n)return;n.style.transition='none';n.style.transform='translateX(-30px)';n.style.opacity='0';
        requestAnimationFrame(function(){requestAnimationFrame(function(){n.style.transition='transform .22s ease,opacity .22s ease';n.style.transform='';n.style.opacity='';});});},170);}
    else{c.style.transition='transform .2s ease,opacity .2s ease';c.style.transform='';c.style.opacity='';}},{passive:true});}
// Valeurs des champs gardées avant chaque redessin (import, retour, étape suivante)
function _suRead(){[].forEach.call(document.querySelectorAll('#setup [data-k]'),function(e){SU.v[e.dataset.k]=e.type==='checkbox'?e.checked:e.value;});}
function _suGo(n){_suRead();SU.step=n;_suDraw();}
function _suDraw(){
  var el=document.getElementById('setup');if(!el||!SU)return;
  // hauteur de la carte animée d'un écran à l'autre (et quand un écran grandit : menu ouvert, tuiles, champs)
  var oc=el.querySelector('.su-card'),oh=oc?oc.offsetHeight:0,same=SU._shown===SU.step,st=el.scrollTop;SU._shown=SU.step;
  // en bas de chaque écran : se déconnecter, ou supprimer le compte sans aller au bout
  el.innerHTML='<div class="su-card'+(SU.step===0?' su-c0':'')+'">'+[_suStep0,_suStep1,_suStep3,_suStep2,_suStep4,_suStep5][SU.step]() // le tableau Gestion avant le choix du mois : le menu s'arrête où s'arrête le tableau
    +'<div class="su-foot"><a onclick="signOut()">Se déconnecter</a> · <a onclick="deleteCurrentProfile()">Supprimer mon compte</a></div></div>';el.scrollTop=same?st:0;
  var nc=el.querySelector('.su-card');
  if(oc&&nc&&!matchMedia('(prefers-reduced-motion: reduce)').matches){var nh=nc.offsetHeight;
    if(Math.abs(nh-oh)>2){nc.style.height=oh+'px';nc.style.overflow='hidden';nc.offsetHeight;nc.style.transition='height .32s cubic-bezier(.3,.8,.3,1)';nc.style.height=nh+'px';
      setTimeout(function(){if(nc.isConnected){nc.style.height='';nc.style.overflow='';nc.style.transition='';}},340);}}
  if(SU.step===4)_suPayLbls();SU.anim=null;_suSaveSoon();
}












 // recommandé : décembre de l'année d'avant (toutes les paies de l'année vérifiables, janvier compris)












function _suOk3(){var b=document.getElementById('su-next3');if(b)b.disabled=!_suCan3();}
// Tableau Gestion lu sur place (0 : le plus récent, 1 : celui de départ) : la roue tourne pendant la lecture
function _suRhPick(which){
  _suRead();
  var inp=_fileInput();inp.accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  inp.onchange=async function(){var f=inp.files&&inp.files[0];if(!f)return;
    SU.rhBusy=which;if(which)SU.rh0Err=null;else{SU.rhErr=null;SU.rhMode='imp';}_suDraw();
    try{var cells=await _xlsxRead(f),rh=_rhParse(cells,f.name),P=_rhImportPlan(rh),o={cells:cells,name:f.name,rh:rh,P:P,file:f};
      if(which){if(SU.rh&&P.ed>=SU.rh.P.ed)throw new Error('Ce tableau n’est pas plus ancien que le plus récent.');SU.rh0=o;}
      else{SU.rh=o;SU.anim='rh';SU.v.mat=P.matelas!=null?fmtMin(P.matelas):'';SU.v.eph=fmtMin(Math.round(P.total));if(SU.rh0&&SU.rh0.P.ed>=P.ed)SU.rh0=null;}}
    catch(e){var msg=(e&&e.message)||'Ce fichier n’a pas pu être lu.';if(which)SU.rh0Err=msg;else{SU.rh=null;SU.rhMode=null;SU.rhErr=msg;}}
    SU.rhBusy=null;if(SU)_suDraw();};
  _fileOpen(inp);
}

 // un bulletin paie les heures du mois d'avant





function _suPayLbls(){
  var set=function(k,t){var e=document.getElementById('su-e-'+k);if(e)e.textContent=t;},v=SU.v;
  set('pal',v.pal?fmtEuro(calcPalierSalaire(+v.pal)):'');
  set('anc',v.anc!==''&&v.anc!=null&&+v.anc>0?fmtEuro(calcAncPrime(+v.anc)):'');
  set('pct',v.pct?(Math.round(+v.pct*151.67)/100).toLocaleString('fr-FR')+' h':'');
  set('grp',v.grp?fmtEuro(calcGPE(+v.grp)):'');
}
// Bulletins lus sur place (plusieurs à la fois, ajoutés aux précédents) ; les champs de paie en sont remplis
function _suBulPick(){
  _suRead();
  var inp=_fileInput();inp.accept='application/pdf,.pdf';inp.multiple=true;
  inp.onchange=async function(){var fs=[].slice.call(inp.files||[]);if(!fs.length)return;
    SU.bulBusy=true;SU.bulErr=null;_suDraw();var bad=0;
    for(var i=0;i<fs.length;i++){try{var b=_bulParse(await _pdfLines(fs[i]));if(b){b.at=Date.now();SU.bul[b.ym]=b;}else bad++;}catch(e){bad++;}}
    if(Object.keys(SU.bul).length){if(!SU.bulMode)SU.anim='pay';SU.bulMode='imp';_suBulDerive();}
    if(bad)SU.bulErr=(bad>1?bad+' fichiers n’ont pas pu être lus':'Un fichier n’a pas pu être lu')+(navigator.onLine===false?' (hors ligne)':'')+'.';
    SU.bulBusy=false;if(SU)_suDraw();};
  _fileOpen(inp);
}

// Terminé : tout est enregistré dans le compte, la suite ne revient plus
function _suDone(){
  _suRead();var pr=S.profile,v=SU.v,D=_suFromYM(),st=_suStart();
  if(v.pool&&v.pool!=='antenne')pr.pool=v.pool;else delete pr.pool; // équipe : son cycle avant de placer la ligne
  var n=getCycleLen(NOW),diff=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
  pr.anchorLine=((+v.line-diff)%n+n)%n;
  // ligne d'avant un changement fait après le mois de départ : historique des lignes
  delete pr.origAnchor;pr.lineHistory=[];var lm=_suLcMon();
  if(v.lc&&lm&&v.lcL!==''&&v.lcL!=null&&D!=null){var lf=new Date(lm);lf.setDate(lf.getDate()+7);var n0=getCycleLen(lm),d0=Math.round((lm-ANCHOR)/(7*864e5));
    pr.origAnchor=((+v.lcL-d0)%n0+n0)%n0;pr.lineHistory=[{anchorLine:pr.anchorLine,from:dk(lf)}];}
  if(!S.settings)S.settings={};['dimRendu','rhRendu','ferRendu','hsRendu'].forEach(function(k){S.settings[k]=v[k]!==false;});
  // heures
  var mat=v.mat?parseHM(v.mat):0,eph=v.eph?parseHM(v.eph):0;
  if(SU.rh&&SU.rhMode==='imp'){var P=SU.rh.P;
    if(D==null){ // à partir de maintenant : on repart du tableau, valeurs retouchées à la main
      _rhStore(SU.rh.cells,SU.rh.name);_rhUpload(SU.rh.file);window._rhLast=SU.rh.rh;_startApply(_startFromTable(SU.rh.rh));}
    else{ // départ = le mois choisi, soldes reconstitués d'après le tableau ; il sert ensuite à vérifier
      var g=_suGestYM();_rhStore(SU.rh.cells,SU.rh.name);_rhUpload(SU.rh.file);window._rhLast=SU.rh.rh;_startApply(_startFromMonth(SU.rh.rh,dk(new Date(Math.floor(g/12),g%12,1,12))));}}
  else _startApply(_startManual(dk(new Date(Math.floor(TODAY_YM/12),TODAY_YM%12,1,12)),mat,eph)); // soldes saisis = ceux du 1er de ce mois
  // paie
  var yms=Object.keys(SU.bul).map(Number).sort(function(a,b){return a-b;}),ref=yms.length?yms[yms.length-1]:TODAY_YM;
  if(v.pal){pr.palierNum=+v.pal;pr.salaireQualif=calcPalierSalaire(+v.pal);}
  if(v.anc!==''&&v.anc!=null){pr.ancYears=+v.anc;pr.ancRefYM=ref;pr.primeAnciennete=calcAncPrime(+v.anc);}
  pr.ancMoisAnni=v.anni!==''&&v.anni!=null?+v.anni:-2; // inconnu : pas demandé, rempli au bulletin qui montre le changement de prime
  if(v.pct)pr.heuresMensuelles=Math.round(+v.pct*151.67/100*100)/100;
  if(v.grp)pr.groupeClassif=+v.grp;
  pr.pfaMensuelle=+v.pfa===1;
  pr.primesConvOff={};getPrimesConvAllForYM(TODAY_YM).forEach(function(x){if(v['pc_'+x.id]===false)pr.primesConvOff[x.id]=true;});
  var av=parseFloat(String(v.avi||'').replace(/\s|€/g,'').replace(',','.'));
  if(av>0){pr.primesFixesCustom=(pr.primesFixesCustom||[]).filter(function(p){return !/INDIV/i.test(p.label);});
    pr.primesFixesCustom.push({id:'pfc_'+Date.now(),label:'Prime av. indiv. acquis',montant:Math.round(av*100)/100,debutYM:SU.aviFrom!=null?SU.aviFrom:ref,finYM:null});}
  // bulletins gardés (vérification de chaque paie) ; changements de palier, contrat… et heures payées repris mois par mois
  if(yms.length){if(!S.bulletins)S.bulletins={};yms.forEach(function(ym){S.bulletins[ym]=SU.bul[ym];});try{_bulPayApply();}catch(e){console.warn(e);}}
  // une seule date de départ pour la Gestion et la paie : bulletins d'avant non comptés en écart
  pr.calcFrom=D!=null?'month':'now';pr.calcStart=dk(st);
  delete pr.setupPending;if(v.pal)pr.hasSeenPayPrompt=true;else delete pr.hasSeenPayPrompt; // sans données de paie : demandées à l'arrivée dans l'app
  _profs[_aid]=S;saveState();try{cloudSave(_aid);}catch(e){}
  _suForget();var el=document.getElementById('setup');if(el)el.remove();SU=null;document.body.classList.remove('su-on');
  render();_infoToast('✓ C’est prêt');
}
// Après une inscription sans matelas ni rendus saisis : proposer d'importer le tableau RH
// Après une inscription « avec un bulletin » : le demander d'abord (palier, ancienneté, contrat, groupe), puis le tableau Gestion
function _bulImportPromptIfNeeded(){
  let f=null;try{f=localStorage.getItem('pl_bul_import_prompt');}catch(e){}
  var has=_regHas('pl_bul_files');
  if(!f&&!has)return false;if(document.getElementById('modal-root').innerHTML)return false;
  try{localStorage.removeItem('pl_bul_import_prompt');}catch(e){}
  var pre=has?_regFiles('pl_bul_files'):null; // lus seulement maintenant (avant : effacés même quand une autre fenêtre bloquait)
  var next=function(){closeModal();setTimeout(function(){if(!_rhImportPromptIfNeeded())openSettingsModal(1);},250);};
  if(pre){_importBulletinFiles(pre,next);return true;} // bulletins choisis à l'inscription : lus directement
  window._bulOnbNext=next;
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this){closeModal();setTimeout(_rhImportPromptIfNeeded,250);}"><div class="sheet tabmod">'
    +'<div class="sh"></div><div class="st">Importer un bulletin de paie ?</div>'
    +'<div style="font-size:13px;color:var(--text2);line-height:1.5;margin:8px 0 14px">Choisir un bulletin récent (PDF) : l’app y lit le palier, l’ancienneté, le contrat et le groupe. Avec plusieurs bulletins de mois qui se suivent, elle trouve aussi le mois d’anniversaire de l’ancienneté. Le fichier est lu sur l’appareil, rien n’est envoyé.</div>'
    +'<button class="rc-btn" style="height:42px" onclick="closeModal();importBulletins(window._bulOnbNext)">Choisir le bulletin</button>'
    +'<button class="rc-btn rc-btn2" style="margin-top:8px;height:38px" onclick="closeModal();setTimeout(_rhImportPromptIfNeeded,250)">Plus tard (Réglages → Paie)</button>'
    +'</div></div>';
  return true;
}
function _rhImportPromptIfNeeded(){
  let f=null;try{f=localStorage.getItem('pl_rh_import_prompt');}catch(e){}
  if(!_regHas('pl_rh_file')&&document.getElementById('modal-root').innerHTML)return false;
  const pre=_regFiles('pl_rh_file');
  // tableau choisi à l'inscription : lu et appliqué directement (annulable depuis Réglages)
  if(pre){try{localStorage.removeItem('pl_rh_import_prompt');}catch(e){}
    (async function(){try{const cells=await _xlsxRead(pre[0]);const rh=_rhParse(cells,pre[0].name);_rhStore(cells,pre[0].name);_rhUpload(pre[0]);window._rhLast=rh;_startApply(_startFromTable(rh));render();}
      catch(e){_infoToast('Tableau Gestion illisible : à réimporter depuis Réglages');}})();
    return true;}
  if(!f||document.getElementById('modal-root').innerHTML)return false;
  try{localStorage.removeItem('pl_rh_import_prompt');}catch(e){}
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet tabmod">'
    +'<div class="sh"></div><div class="st">Importer le tableau Gestion ?</div>'
    +'<div style="font-size:13px;color:var(--text2);line-height:1.5;margin:8px 0 14px">Choisir le fichier Excel envoyé par le gestionnaire : l’app reprend le matelas et le solde d’heures mois par mois, avec leurs dates d’expiration et leurs reports. Le fichier est lu sur l’appareil, rien n’est envoyé.</div>'
    +'<button class="rc-btn" style="height:42px" onclick="closeModal();rhImportOpen()">Choisir le tableau Gestion</button>'
    +'<button class="rc-btn rc-btn2" style="margin-top:8px;height:38px" onclick="closeModal()">Plus tard (Réglages → Tableau Gestion)</button>'
    +'</div></div>';
  return true;
}


function rhImportPreview(rh){
  window._rhLast=rh;
  const P=_rhImportPlan(rh),pr=S.profile||{};
  const ymL=ym=>MCs[ym%12]+' '+String(Math.floor(ym/12)).slice(2);
  const row=(l,a,b)=>'<tr><td>'+l+'</td><td>'+a+'</td><td><b>'+b+'</b></td></tr>';
  const curSplit=pr.ephSoldeSplit&&Object.keys(pr.ephSoldeSplit).length?Object.keys(pr.ephSoldeSplit).map(Number).sort((a,b)=>a-b).map(ym=>ymL(ym)+' '+fmtMin(pr.ephSoldeSplit[ym])).join('<br>'):fmtMin(Math.round((pr.ephSolde||0)*60));
  const newSplit=Object.keys(P.split).map(Number).sort((a,b)=>a-b).map(ym=>ymL(ym)+' '+fmtMin(P.split[ym])+(P.reports[ym]?' <span style="opacity:.7">(report '+P.reports[ym]*3+' mois)</span>':'')).join('<br>')||'0h00';
  const curStart=pr.ephBaseDate?new Date(pr.ephBaseDate+'T12:00:00').toLocaleDateString('fr-FR'):(pr.ephSoldeCreatedYM!==undefined?'début '+ymL(pr.ephSoldeCreatedYM):'—');
  const histH=P.toHist.filter(k=>!P.maybeLate.includes(k)).reduce((t,k)=>t+getDur(new Date(k+'T12:00:00')),0);
  const hist=P.toHist.filter(k=>!P.maybeLate.includes(k));
  const html='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet tabmod">'
    +'<div class="sh"></div><div class="st">Soldes du tableau Gestion</div>'
    +'<div style="font-size:11px;color:var(--text3);margin:2px 0 10px">Tableau édité le '+P.ed.toLocaleDateString('fr-FR')+' · fichier lu sur l’appareil, rien n’est envoyé</div>'
    +'<table class="rc-t rc-sum"><tr><th></th><th>Actuellement</th><th>Après import</th></tr>'
    +(P.matelas!==null&&P.matelas!==undefined?row('Matelas',fmtMin(pr.matelas||0),fmtMin(P.matelas)):'')
    +row('Solde de départ',curSplit,newSplit)
    +row('Total',fmtMin(pr.ephSoldeSplit?Object.values(pr.ephSoldeSplit).reduce((a,b)=>a+b,0):Math.round((pr.ephSolde||0)*60)),fmtMin(P.total))
    +row('Début du suivi',curStart,P.ed.toLocaleDateString('fr-FR'))
    +'</table>'
    +'<div class="rc-note">Ensuite, l’app calcule elle-même les heures acquises à partir du planning, à compter du '+P.ed.toLocaleDateString('fr-FR')+'.</div>'
    +(hist.length?'<div class="rc-note"><i class="ti ti-history" style="color:var(--blue)"></i> <b>'+hist.length+' rendu'+(hist.length>1?'s':'')+' jusqu’au '+(rh.lastWeek?'dimanche de la S'+rh.lastWeek:P.ed.toLocaleDateString('fr-FR'))+' ('+fmtMin(histH)+')</b> : déjà déduit'+(hist.length>1?'s':'')+' dans le tableau. Ils restent affichés dans le calendrier, mais l’app ne les retire pas une deuxième fois.</div>':'')
    +(P.toRend.length?'<div class="rc-note"><i class="ti ti-clock" style="color:var(--rend-text)"></i> <b>'+P.toRend.length+' rendu'+(P.toRend.length>1?'s':'')+' pas encore dans ce tableau ('+fmtMin(P.toRend.reduce((t,k)=>t+getDur(new Date(k+'T12:00:00')),0))+')</b> : pas dans ce tableau, l’app les décompte de nouveau.</div>':'')
    +(P.maybeLate.length?'<div class="rc-note"><i class="ti ti-clock" style="color:var(--blue)"></i> <b>'+P.maybeLate.length+' rendu'+(P.maybeLate.length>1?'s':'')+' après la S'+rh.lastWeek+'</b>, dernière semaine notée par le gestionnaire ('+P.maybeLate.map(k=>new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})).join(', ')+') : pas encore dans son tableau, l’app les décompte elle-même.</div>':'')
    +(P.toHist.length?'<div class="rc-com" style="margin:2px 0 4px">Si l’app s’est trompée sur un rendu, touche le jour dans le calendrier pour corriger.</div>':'')
    +'<button class="rc-btn" style="margin-top:10px;height:40px" onclick="rhImportApply()">Reprendre ses soldes</button>'
    +'<button class="rc-btn rc-btn2" style="margin-top:8px;height:36px" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
  document.getElementById('modal-root').innerHTML=html;
}
function rhImportApply(noUi){
  const rh=window._rhLast;if(!rh)return;
  const keep=new Set(_rhImportPlan(rh).maybeLate); // rendus après la dernière semaine notée : décomptés par l'app
  const P=_rhImportPlan(rh,keep),pr=S.profile;
  // Sauvegarde pour pouvoir annuler l'import
  pr._rhImportBackup={ephRecon:pr.ephRecon||null,matelas:pr.matelas,ephSolde:pr.ephSolde,ephSoldeCreatedYM:pr.ephSoldeCreatedYM,ephSoldeSplit:pr.ephSoldeSplit?Object.assign({},pr.ephSoldeSplit):null,ephBaseDate:pr.ephBaseDate||null,ephExtend:Object.assign({},S.ephExtend||{}),autoExtend:Object.assign({},S.autoExtend||{}),matelasKeys:Object.assign({},S.matelasKeys||{}),toHist:P.toHist,at:Date.now()};
  // matelas du tableau = total disponible : les anciennes affectations aux rendus sont refaites dessus (sinon elles s'y ajoutaient)
  if(P.matelas!==null&&P.matelas!==undefined){S.matelasKeys={};pr.matelas=P.matelas;}
  delete pr.ephRecon;pr.ephSoldeSplit=P.split;pr.ephSolde=Math.round(P.total/60*100)/100;
  pr.ephSoldeCreatedYM=P.edYM;pr.ephBaseDate=P.baseKey;
  // Reports : ceux du tableau, et aucun pour les mois qu'il ne reporte pas (les anciens reports de l'app ne restent pas)
  if(!S.ephExtend)S.ephExtend={};if(!S.autoExtend)S.autoExtend={};
  Object.keys(S.ephExtend).map(Number).concat(Object.keys(S.autoExtend).map(Number)).forEach(ym=>{if(ym<P.edYM){delete S.ephExtend[ym];delete S.autoExtend[ym];}});
  Object.keys(P.reports).forEach(ym=>{S.ephExtend[ym]=P.reports[ym];});
  P.toHist.forEach(k=>{S.conges[k]='rend-hist';});
  P.toRend.forEach(k=>{S.conges[k]='rend';});pr._rhImportBackup.toRend=P.toRend;
  pr.rhImportedAt=dk(P.ed);try{recalcAllMatelas();}catch(e){}
  saveState();render();
  // puis la vérification de ce tableau (depuis le départ choisi), affichée sauf à l'inscription
  closeModal();try{rhCompareShow(rh,!!noUi);}catch(e){}
  if(!noUi)_infoToast('✓ Soldes repris du tableau du '+P.ed.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));
}
// Vérification depuis un mois passé sans tableau de cette période : solde de départ reconstitué à partir du plus récent.
// Mois d'avant le départ : ce qui leur reste au tableau, plus les rendus posés entre le départ et le tableau (pris sur les plus anciens
// d'abord, sans dépasser ce que le mois a acquis). Recalculé à chaque fois : les rendus entrés ensuite s'y ajoutent d'eux-mêmes.
function _rhReconApply(rh,Dkey){
  const pr=S.profile,D=new Date(Dkey+'T12:00:00'),Dym=D.getFullYear()*12+D.getMonth(),ed=new Date(rh.edition.getFullYear(),rh.edition.getMonth(),rh.edition.getDate(),12);
  const baseKey=dk(new Date(D.getFullYear(),D.getMonth(),D.getDate()-1,12)),base={},cap={},reports={};
  rh.lines.forEach(l=>{if(!l.nature||l.ym>=Dym)return;const v=l.rep?(l.validRep||l.valid):l.valid;
    if(v&&new Date(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate(),12)<D)return; // déjà expiré au départ
    base[l.ym]=(base[l.ym]||0)+Math.max(0,l.solde);cap[l.ym]=(cap[l.ym]||0)+Math.max(0,l.acq-l.solde);if(l.rep)reports[l.ym]=Math.max(reports[l.ym]||0,l.rep);});
  pr.ephRecon={D:Dkey,ed:dk(ed),base:base,cap:cap};delete pr.ephSoldeSplit;delete pr._rhImportBackup;
  pr.ephSolde=Math.round(Object.values(base).reduce((a,b)=>a+b,0)/60*100)/100;pr.ephSoldeCreatedYM=Dym;pr.ephBaseDate=baseKey;pr.rhImportedAt=Dkey;
  // matelas au départ : stock de début d'année (« Stock au 31/12 »), moins les compléments pris dessus avant le départ
  // (« 31h posés S2 - complément de stock 1,75 » : semaine citée en commentaire, sinon mois de la ligne)
  if(rh.tot.stock2025!=null){const y=ed.getFullYear();let used=0;
    rh.lines.forEach(l=>{if(!(l.stock>0))return;const w=(l.com.match(/\bS\s?(\d{1,2})\b/i)||[])[1];
      const when=w?(function(){const m=getMonday(new Date(y,0,4,12));m.setDate(m.getDate()+(+w-1)*7);return m;})():new Date(Math.floor(l.ym/12),l.ym%12,1,12);if(when<D)used+=l.stock;});
    S.matelasKeys={};pr.matelas=Math.round((rh.tot.stock2025-used)*1e4)/1e4;} // minutes, comme le reste du tableau lu
  else if(rh.tot.stockAct!=null){S.matelasKeys={};pr.matelas=rh.tot.stockAct;}
  if(!S.ephExtend)S.ephExtend={};if(!S.autoExtend)S.autoExtend={};
  Object.keys(S.ephExtend).map(Number).concat(Object.keys(S.autoExtend).map(Number)).forEach(ym=>{if(ym<Dym){delete S.ephExtend[ym];delete S.autoExtend[ym];}});
  Object.keys(reports).forEach(ym=>{S.ephExtend[ym]=reports[ym];});
  Object.keys(S.conges||{}).forEach(k=>{const c=S.conges[k];if(c==='rend'&&k<=baseKey)S.conges[k]='rend-hist';else if(c==='rend-hist'&&k>baseKey)S.conges[k]='rend';});
  try{recalcAllMatelas();}catch(e){}saveState();
}

async function rhImportUndo(){
  const pr=S.profile,b=pr&&pr._rhImportBackup;if(!b)return;
  if(!await _ask('Annuler l’import du tableau Gestion ?\n\nLes valeurs d’avant l’import reviennent.',{ok:'Annuler l’import',cancel:'Garder'}))return;
  pr.matelas=b.matelas;pr.ephSolde=b.ephSolde;pr.ephSoldeCreatedYM=b.ephSoldeCreatedYM;if(b.ephRecon)pr.ephRecon=b.ephRecon;
  if(b.ephSoldeSplit)pr.ephSoldeSplit=b.ephSoldeSplit;else delete pr.ephSoldeSplit;
  if(b.ephBaseDate)pr.ephBaseDate=b.ephBaseDate;else delete pr.ephBaseDate;
  S.ephExtend=b.ephExtend||{};if(b.autoExtend)S.autoExtend=b.autoExtend;if(b.matelasKeys)S.matelasKeys=b.matelasKeys;
  (b.toHist||[]).forEach(k=>{if(S.conges[k]==='rend-hist')S.conges[k]='rend';});
  (b.toRend||[]).forEach(k=>{if(S.conges[k]==='rend')S.conges[k]='rend-hist';});
  delete pr._rhImportBackup;delete pr.rhImportedAt;
  saveState();closeModal();render();
}

function rhApplyReport(ym,n){
  if(!S.ephExtend)S.ephExtend={};
  const auto=(S.autoExtend&&typeof S.autoExtend[ym]==='number')?S.autoExtend[ym]:0;
  if(n<auto){showBlockAlert('Report automatique','L’app a reporté ce mois automatiquement (solde de moins de 7h). Ce report ne peut pas être retiré ici.');return;}
  if(n>0)S.ephExtend[ym]=n;else delete S.ephExtend[ym];
  saveState();render();if(window._rhLast)rhCompareShow(window._rhLast);
}

function rhApplySplit(on){
  const rh=window._rhLast;if(!rh)return;
  if(on){
    const sg=_rhStartSplit(rh);S.profile.ephSoldeSplit=sg.split;
    if(!S.ephExtend)S.ephExtend={};
    Object.keys(sg.split).map(Number).forEach(ym=>{const r=Math.max(0,...rh.lines.filter(l=>l.ym===ym).map(l=>l.rep),0);if(r>0&&getEphExtensions(ym)<r)S.ephExtend[ym]=r;});
  }else delete S.profile.ephSoldeSplit;
  saveState();render();rhCompareShow(rh);
}
// Onglet Rendus : reprendre le report du tableau Gestion pour un mois
async function rendusTakeRep(ym,n,limit){
  if(!await _ask('Reprendre le report du tableau Gestion pour ce mois ?',{ok:'Reprendre'}))return;
  pushUndo('Report modifié');if(!S.ephExtend)S.ephExtend={};if(n>0)S.ephExtend[ym]=n;else delete S.ephExtend[ym];
  saveState();render();openMergedRenduCgModal(limit,0);
}
function rhApplyReports(list){
  pushUndo('Reports repris du tableau');
  if(!S.ephExtend)S.ephExtend={};
  // le tableau fait foi, report automatique de l'app compris : moins (ou aucun) au tableau → plus de report automatique pour ce mois
  if(!S.noAuto)S.noAuto={};
  list.forEach(([ym,n])=>{const auto=(S.autoExtend&&typeof S.autoExtend[ym]==='number')?S.autoExtend[ym]:0;if(n>0)S.ephExtend[ym]=n;else delete S.ephExtend[ym];
    if(n<auto||!n){S.noAuto[ym]=1;if(S.autoExtend)delete S.autoExtend[ym];}else delete S.noAuto[ym];});
  try{recalcAllMatelas();}catch(e){}
  saveState();render();if(window._rhLast)rhCompareShow(window._rhLast);
}








// Applique un départ : les champs du calcul en découlent, les rendus sont comptés ou non d'après leur seule date
function _startApply(st){
  const pr=S.profile;if(!pr||!st)return;pr.start=st;
  pr.ephSoldeCreatedYM=st.genFrom;pr.ephBaseDate=st.from;pr.rhImportedAt=st.d;
  pr.ephSolde=Math.round(Object.values(st.base||{}).reduce((a,b)=>a+b,0)/60*100)/100;
  if(st.recon){pr.ephRecon={D:st.d,ed:st.recon.ed,base:Object.assign({},st.base),cap:st.recon.cap};delete pr.ephSoldeSplit;}
  else{delete pr.ephRecon;pr.ephSoldeSplit=Object.assign({},st.base);}
  S.matelasKeys={};pr.matelas=st.mat||0;
  if(!S.ephExtend)S.ephExtend={};if(!S.autoExtend)S.autoExtend={};
  Object.keys(S.ephExtend).map(Number).concat(Object.keys(S.autoExtend).map(Number)).forEach(ym=>{if(ym<st.genFrom){delete S.ephExtend[ym];delete S.autoExtend[ym];}});
  Object.keys(st.rep||{}).forEach(ym=>{if(+ym<st.genFrom&&st.rep[ym])S.ephExtend[ym]=st.rep[ym];});
  Object.keys(S.conges||{}).forEach(k=>{const c=S.conges[k];if(c==='rend'||c==='rend-hist')S.conges[k]=k>st.from?'rend':'rend-hist';});
  pr.calcFrom='month';pr.calcStart=st.d; // bulletins vérifiés depuis la même date
  delete pr._rhImportBackup;delete pr.verif;delete pr.rhCmp;delete pr.ignRhC;delete pr.rendFrom; // différences acceptées : liées au départ
  try{recalcAllMatelas();}catch(e){}
  saveState();
}

// Réglages → Départ du calcul : partir d'un tableau Gestion, ou du 1er d'un mois (soldes reconstitués d'après le dernier tableau, ou saisis)
function openStartModal(mode){
  const pr=S.profile,st=pr.start;let L=null;try{L=_rhStored();}catch(e){}
  const lym=L?_rhEd(L).getFullYear()*12+_rhEd(L).getMonth():null,cur=st?new Date(st.d+'T12:00:00'):NOW,cym=cur.getFullYear()*12+cur.getMonth();
  const M=[];for(let ym=TODAY_YM;ym>=(NOW.getFullYear()-1)*12;ym--)M.push(ym);
  mode=mode||(st&&st.k!=='tab'?'mois':'tab');
  const inp='width:90px;height:36px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:15px;text-align:right;padding:0 10px;font-family:var(--font)';
  const B='width:100%;height:40px;margin-top:auto;border:none;border-radius:10px;background:var(--blue);color:#fff;font-weight:600;cursor:pointer;font-family:var(--font);font-size:13px';
  // onglets comme ceux de Suivi / Rendus / Congés
  const seg=(k,l)=>'<button onclick="openStartModal(\''+k+'\')" style="flex:1;height:32px;border:none;border-radius:999px;font-family:var(--font);font-size:13px;cursor:pointer;background:'+(mode===k?'var(--bg2)':'transparent')+';box-shadow:'+(mode===k?'0 1px 3px rgba(0,0,0,.2)':'none')+';font-weight:'+(mode===k?600:400)+';color:'+(mode===k?'var(--text)':'var(--text3)')+'">'+l+'</button>';
  const txt=st?(st.k==='tab'?'le <b>'+_startTxt(st).replace(/^tableau du /,'')+'</b> (tableau Gestion)':'le <b>'+_startTxt(st).split(' · ')[0]+'</b>'):'—';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Départ du calcul</div>'
    +'<div style="font-size:13px;color:var(--text2);line-height:1.5;margin:6px 0 14px">Vos heures sont calculées depuis '+txt+'.</div>'
    +'<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Changer le départ</div>'
    +'<div style="display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--bg3);border:0.5px solid var(--border)">'+seg('tab','Un tableau Gestion')+seg('mois','Le 1er d’un mois')+'</div>'
    // même hauteur pour les deux choix : la fenêtre ne change pas de taille, le bouton reste au même endroit
    +'<div style="display:flex;flex-direction:column;height:236px;padding-top:10px">'
    +(mode==='tab'
      ?'<div style="font-size:13px;color:var(--text2);line-height:1.45">L’app reprend le matelas et les heures de ce tableau, à sa date.</div>'
        +'<button style="'+B+'" onclick="closeModal();rhCompareOpen(\'start\')">Choisir le tableau</button>'
      :'<select id="st-m" onchange="_startMsel()" style="width:100%;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);font-family:var(--font);-webkit-appearance:none">'
        +M.map(ym=>'<option value="'+ym+'"'+(ym===cym?' selected':'')+'>'+ML[ym%12]+' '+Math.floor(ym/12)+'</option>').join('')+'</select>'
        +'<div id="st-rec" style="font-size:13px;color:var(--text2);line-height:1.45;margin-top:8px"></div>'
        +'<div id="st-man" style="margin-top:4px"><div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0"><span style="font-size:13px">Matelas au 1er</span><input id="st-mat" placeholder="00h00" value="'+fmtMin(st?st.mat||0:0)+'" style="'+inp+'"></div>'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0"><span style="font-size:13px">Heures de rendus au 1er</span><input id="st-eph" placeholder="00h00" value="'+fmtMin(st?Object.values(st.base||{}).reduce((a,b)=>a+b,0):0)+'" style="'+inp+'"></div></div>'
        +'<button style="'+B+'" onclick="startPickMonth()">Partir de ce mois</button>')+'</div>'
    +'<div style="font-size:11px;color:var(--text3);line-height:1.45;margin-top:12px">Les rendus posés avant le départ ne sont pas décomptés.</div>'
    +'<button class="mcancel mclose" style="margin-top:12px" onclick="closeModal()">Annuler</button></div></div>';
  window._stL=L?{ym:lym,ed:dk(_rhEd(L))}:null;if(mode==='mois')_startMsel();
}
function _startMsel(){const ym=+document.getElementById('st-m').value,L=window._stL,rec=L&&ym<=L.ym;
  document.getElementById('st-rec').innerHTML=rec?'L’app retrouve le matelas et les heures au 1er de ce mois grâce à votre tableau du '+new Date(L.ed+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+'.':'Indiquez le matelas et les heures au 1er de ce mois :';
  document.getElementById('st-man').style.display=rec?'none':'';}
function startPickMonth(){pushUndo('Départ du calcul changé');const ym=+document.getElementById('st-m').value,Dk=dk(new Date(Math.floor(ym/12),ym%12,1,12)),L=window._stL;let st;
  if(L&&ym<=L.ym){let rh=null;try{rh=_rhStored();}catch(e){}if(!rh)return;st=_startFromMonth(rh,Dk);}
  else st=_startManual(Dk,parseHM(document.getElementById('st-mat').value||'0'),parseHM(document.getElementById('st-eph').value||'0'));
  _startApply(st);closeModal();render();_infoToast('✓ Départ : '+_startTxt(st).split(' · ')[0]);}
// Comptes d'avant : départ tiré des champs existants (soldes de départ, matelas, mois de départ)
function _startMigrate(){const pr=S.profile;if(!pr||pr.start||pr.setupPending)return;if(window._authToken&&!window._cloudOk)return;/* après la lecture du cloud seulement */let rh=null;try{rh=_rhStored();}catch(e){}
  const V=pr.verif,R=pr.ephRecon,cy=pr.ephSoldeCreatedYM!==undefined?pr.ephSoldeCreatedYM:2026*12;let st=null;
  try{
    if(V&&V.k==='tab')st={k:'tab',d:V.ed,from:V.from,genFrom:V.genFrom,mat:V.matelas||0,base:V.base||{},cons:{},stk:{},rep:V.rep||{}};
    else if(rh&&(V&&V.k==='mois'||R))st=_startFromMonth(rh,(V&&V.D)||R.D);
  }catch(e){st=null;}
  if(!st){const mat=(pr.matelas||0)+Object.values(S.matelasKeys||{}).reduce((a,b)=>a+b,0);
    const base=pr.ephSoldeSplit&&Object.keys(pr.ephSoldeSplit).length?Object.assign({},pr.ephSoldeSplit):(pr.ephSolde>0?{[cy-1]:Math.round(pr.ephSolde*60)}:{});
    st={k:pr.rhImportedAt&&pr.ephBaseDate?'tab':'man',d:pr.rhImportedAt||dk(new Date(Math.floor(cy/12),cy%12,1,12)),from:pr.ephBaseDate||dk(new Date(Math.floor(cy/12),cy%12,0,12)),genFrom:cy,mat,base,rep:{},cons:{},stk:{}};}
  _startApply(st);}

// Rendus que l'app a pris sur le matelas et le gestionnaire sur des heures acquises après coup : faire comme lui
// (les plus récents d'abord, jusqu'au montant de l'écart) — ils prennent alors les heures du mois suivant
// montant exact : l'écart du matelas, retiré des heures du mois qui suit le dernier rendu pris sur le matelas, rendu au matelas
function rhXferAccept(amt){pushUndo('Matelas comme le tableau');const rh=window._rhLast,R=rh&&_verifSim(rh);if(!R)return;const pr=S.profile;if(!pr.ignRhC)pr.ignRhC={};
  // déjà repris : on corrige ce montant (une autre différence acceptée depuis a changé ce qui passe sur le matelas)
  const old=Object.keys(pr.ignRhC).filter(k=>/^xfer\d+$/.test(k))[0];if(!old&&!R.matK.length)return;
  const k=old||'xfer'+(Math.max.apply(null,R.matK.map(x=>x.pym))+1);
  if((pr.ignRhC[k]||0)+amt<=0){rhXferUndoAdj(k);return;}
  pr.ignRhC[k]=(pr.ignRhC[k]||0)+amt;pr.matelas=(pr.matelas||0)+amt;try{recalcAllMatelas();}catch(e){}saveState();render();rhCompareShow(rh);}
// Revenir au calcul de l'app : toutes les différences reprises du tableau sont effacées (heures, rendus, matelas)
function rhRevertAll(){pushUndo('Reprises du tableau annulées');const pr=S.profile,ig=pr.ignRhC||{};Object.keys(ig).forEach(k=>{if(/^xfer\d+$/.test(k))pr.matelas=(pr.matelas||0)-(ig[k]||0);if(/^(acq|wkm|xfer)\d/.test(k))delete ig[k];});
  delete pr.rendFrom;try{recalcAllMatelas();}catch(e){}saveState();render();if(window._rhLast)rhCompareShow(window._rhLast);}
function rhXferUndoAdj(k){pushUndo('Matelas : reprise du tableau annulée');const pr=S.profile,v=pr.ignRhC&&pr.ignRhC[k];if(!v)return;delete pr.ignRhC[k];pr.matelas=(pr.matelas||0)-v;try{recalcAllMatelas();}catch(e){}saveState();render();if(window._rhLast)rhCompareShow(window._rhLast);}
function rhXferUndo(){const pr=S.profile;delete pr.rendFrom;try{recalcAllMatelas();}catch(e){}saveState();render();if(window._rhLast)rhCompareShow(window._rhLast);}
// Reprises du tableau qui ne correspondent plus à une différence (tableau plus récent corrigé par le gestionnaire, ou planning modifié) :
// retirées d'elles-mêmes. Rend la liste de ce qui a été retiré.
function _rhAutoUnaccept(rh,R){const pr=S.profile,ig=pr&&pr.ignRhC;if(!ig||!R)return [];const out=[],bad=d=>Math.abs(d)>=2,y=R.asOf.getFullYear();
  const MF=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],NT={fer:'fériés',dim:'dimanches',rh:'RH',hs:'heures sup',extra:'heures en plus'};
  const tNat={};rh.lines.forEach(l=>{if(!l.nature)return;const k=_rhNatKey(l.nature);(tNat[l.ym]=tNat[l.ym]||{})[k]=((tNat[l.ym]||{})[k]||0)+l.acq;});
  Object.keys(ig).forEach(k=>{const v=ig[k];let m;
    if((m=/^acq(\d+)([a-z]+)$/.exec(k))){const ym=+m[1];if(ym<R.st.genFrom||ym>=R.asOfYM)return;const e=((tNat[ym]||{})[m[2]]||0)-((R.nat[ym]||{})[m[2]]||0);
      if(Math.abs(e-v)>=2){delete ig[k];out.push((NT[m[2]]||m[2])+' de '+MF[ym%12]);}}
    else if((m=/^wkm(\d+)s(\d+)$/.exec(k))){const w=+m[2],c=(rh.weeks||{})[w];if(rh.lastWeek&&w>rh.lastWeek)return;const d=c==null?null:(R.wkA[w]||0)-c;
      if(d==null||Math.abs(d-v)>=2){delete ig[k];out.push('rendus de la S'+w);}}
    else if(/^xfer\d+$/.test(k)){const orig=R.matA+R.xadj-R.matT;if(!bad(orig)||orig<0){delete ig[k];pr.matelas=(pr.matelas||0)-v;out.push('matelas ou heures');}}});
  if(out.length){try{recalcAllMatelas();}catch(e){}pr.rhAutoOff={ed:dk(R.asOf),L:out};saveState();}
  return out;}
function rhCompareShow(rh,silent){
  window._rhLast=rh;
  // heures expirées encore comptées par ce tableau : gardées tant qu'il les compte (voir _rhGraceYm)
  try{if(S.profile&&rh&&rh.lines&&rh.edition){var _ed=rh.edition,_eY=_ed.getFullYear()*12+_ed.getMonth(),_g={};
    rh.lines.forEach(function(l){if(!l.nature||!(l.solde>0))return;var v=l.rep?(l.validRep||l.valid):l.valid;if(!v)return;var vd=new Date(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate(),12);if(vd<_ed)_g[l.ym]=_eY;});
    if(JSON.stringify(_g)!==JSON.stringify(S.profile.rhGrace||{})){if(Object.keys(_g).length)S.profile.rhGrace=_g;else delete S.profile.rhGrace;try{saveState();}catch(e){}}}}catch(e){}
  let R=_verifSim(rh);if(_rhAutoUnaccept(rh,R).length)R=_verifSim(rh);
  const fd=k=>new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}).replace(/^1 /,'1er ');
  const head='<div class="sh"></div>'+(window._rvFrom?'<div class="nav-back" style="'+_navBackCss+'" onclick="_rvGoBack()">‹ '+(window._rvFrom==='rendus'?'Rendus':_isPhone()?'Contrôle':'Suivi')+'</div>':'')
    +'<div class="st" style="display:flex;justify-content:center;text-align:center;margin-bottom:2px">Tableau Gestion</div>';
  const btn='<button class="rv-b2" onclick="rhCompareOpen()">Importer un tableau plus récent</button>';
  if(!R){if(S.profile)delete S.profile.rhCmp;if(silent)return;
    document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet rv-sheet tabmod">'+head
      +'<div class="hd-card" style="font-size:13px;padding:12px;line-height:1.5;margin-top:10px">'+_suPts(['Départ du calcul → '+_startTxt(S.profile&&S.profile.start),'Tableau du '+fd(dk(_rhEd(rh)))+' → pas plus récent que le départ, rien à vérifier'])+btn+'</div>'
      +'<div style="height:6px"></div><button class="mcancel mclose" onclick="closeModal()">Fermer</button></div></div>';return;}
  const pr=S.profile||{},asOf=R.asOf,asOfYM=R.asOfYM,aoff=pr.rhAutoOff&&pr.rhAutoOff.ed===dk(R.asOf)?pr.rhAutoOff.L:null;
  const MF=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const moisDe=ym=>{const m=MF[ym%12];return(/^[aeiouy]/.test(m)?'d’':'de ')+m;},MFc=ym=>MF[ym%12].replace(/^./,c=>c.toUpperCase());
  const fmtE=d=>Math.abs(d)<2?'=':d>0?'+'+fmtMin(d):'−'+fmtMin(-d),bad=d=>Math.abs(d)>=2;
  const dayL=k=>new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
  const NAT_T={fer:'Fériés',dim:'Dimanches',rh:'RH travaillés',hs:'Heures sup',extra:'Heures en plus'},natL=k=>k.startsWith('autre:')?k.slice(6):NAT_T[k];
  const tv=(t,a)=>'<div class="rv-cmp"><span>Tableau <b>'+fmtMin(t)+'</b></span><span>App <b>'+fmtMin(a)+'</b></span></div>';
  const act=(k,v,on)=>'<button class="rv-b2" onclick="event.stopPropagation();rhIgnC(\''+k+'\','+Math.round(v)+','+(on?0:1)+')">'+(on?'Annuler la reprise ('+fmtE(v)+')':'Faire comme le tableau ('+fmtE(v)+')')+'</button>';
  // Différences : une carte dépliable chacune — à voir (point orange) ou reprise du tableau (coche verte)
  const todo=[],done=[];let ignSum=0;
  const card=(o)=>(o.done?done:todo).push('<div class="rv-it" onclick="if(!event.target.closest(\'button,a\'))this.classList.toggle(\'on\')"><div class="rv-ih">'
    +(o.done?'<span style="color:var(--green);font-size:13px;font-weight:700;width:7px;flex:none;display:flex;justify-content:center">✓</span>':'<span class="rv-dot"'+(o.info?' style="background:var(--text3)"':'')+'></span>')
    +'<div class="rv-tt">'+o.t+'<small>'+o.sub+'</small></div><b class="rv-v'+(o.done||o.info?' n':o.v>0?' pos':o.v<0?' neg':' n')+'">'+(o.vt!=null?o.vt:fmtE(o.v))+'</b><i class="ti ti-chevron-down rv-ch"></i></div><div class="rv-ib">'+o.body+'</div></div>');
  // 1. Heures acquises, par mois et par nature (+ : le tableau en compte plus)
  const tNat={};rh.lines.forEach(l=>{if(!l.nature)return;const k=_rhNatKey(l.nature);(tNat[l.ym]=tNat[l.ym]||{})[k]=((tNat[l.ym]||{})[k]||0)+l.acq;});
  const acqRows=[];
  for(let ym=R.st.genFrom;ym<asOfYM;ym++){const T=tNat[ym]||{},A=R.nat[ym]||{},s=Object.values(T).reduce((a,b)=>a+b,0),a=R.acq[ym]||0,adj=R.adjM[ym]||0;if(!s&&!a)continue;acqRows.push({ym,s,a,adj});
    const ks=[...new Set(Object.keys(A).filter(k=>A[k]>0).concat(Object.keys(T)))],diffs=ks.map(k=>({k,s:T[k]||0,a:k.startsWith('autre:')?0:(A[k]||0)})).filter(x=>bad(x.a-x.s)),used=new Set();
    const daysOf=k=>(k==='hs'?(R.det[ym+':hs']||[]).concat(R.det[ym+':ram']||[]):(R.det[ym+':'+k]||[])).map(x=>(/^\d{4}-/.test(x.lbl)?dayL(x.lbl):x.lbl)+' '+fmtMin(x.v));
    diffs.filter(x=>x.a>x.s).forEach(x=>{const y=diffs.find(z=>z.a<z.s&&!used.has(z)&&Math.abs((z.a-z.s)+(x.a-x.s))<2);if(!y||used.has(x))return;used.add(x);used.add(y);
      card({t:'Catégorie différente en '+MF[ym%12],sub:fmtMin(x.a-x.s)+' en '+natL(x.k)+' dans l’app, en '+natL(y.k)+' au tableau',info:1,vt:'=',body:_suPts(['Même durée des deux côtés → sans effet sur le solde'])});});
    diffs.filter(x=>!used.has(x)).forEach(x=>{const e=x.s-x.a,ik='acq'+ym+x.k.replace(/[^a-z0-9]/gi,''),ig=_rhCIgn(ik,e),dl=daysOf(x.k);
      card({t:natL(x.k)+' '+moisDe(ym),sub:ig?'Repris du tableau':(e>0?'Le tableau en compte ':'L’app en compte ')+fmtMin(Math.abs(e))+' de plus',v:e,done:ig,
        body:tv(x.s,x.a)+_suPts([dl.length?'Comptés par l’app → '+dl.join(' · '):'Rien compté par l’app ce mois-ci',ig?'L’app ajoute '+fmtE(e)+' à '+MF[ym%12]+' pour faire comme le tableau':'Faire comme le tableau → l’app ajoute '+fmtE(e)+' à '+MF[ym%12]])+act(ik,e,ig)});});}
  // 2. Rendus des semaines citées par le gestionnaire
  Object.keys(rh.weeks||{}).map(Number).forEach(w=>{const mon=_rhWeekMon(asOf.getFullYear(),w);if(dk(new Date(mon.getTime()+6*864e5))<=R.st.from||(rh.lastWeek&&w>rh.lastWeek))return;
    const c=rh.weeks[w],a=R.wkA[w]||0,d=a-c;if(!bad(d))return;const ym=mon.getFullYear()*12+mon.getMonth(),ik='wkm'+ym+'s'+w,ig=_rhCIgn(ik,d);
    card({t:'Rendus de la S'+w,sub:ig?'Repris du tableau':(d>0?'L’app en déduit ':'Le tableau en déduit ')+fmtMin(Math.abs(d))+' de plus',v:d,done:ig,
      body:tv(c,a)+_suPts([ig?'L’app compte '+fmtE(d)+' d’heures pour faire comme le tableau':'Faire comme le tableau → l’app compte '+fmtE(d)+' d’heures'])+act(ik,d,ig)});});
  // 3. Matelas ou heures : le gestionnaire prend parfois sur des heures acquises après coup (même total)
  const eH=R.tabH-R.appH,eM=R.hasMat?R.tabM-R.appM:0,acqE=acqRows.reduce((t,r)=>t+r.s-r.a,0),consE=R.consA-R.consT,matE=R.matA-R.matT;
  const xk=Object.keys(pr.ignRhC||{}).filter(k=>/^xfer\d+$/.test(k))[0],xv=xk?pr.ignRhC[xk]:0;
  const xfer=R.hasMat&&bad(matE)&&bad(consE)&&(matE>0)!==(consE>0)?Math.sign(matE)*Math.min(Math.abs(matE),Math.abs(consE)):0;
  if(bad(xfer)&&(matE>0&&R.matK.length||xk))card({t:'Matelas ou heures',sub:(matE>0?'Le gestionnaire a pris '+fmtMin(matE)+' sur vos heures, l’app sur le matelas':'Reprise à ajuster de '+fmtMin(-matE)),v:matE,
    body:_suPts(['Rendus pris sur le matelas → tableau '+fmtMin(R.matT)+', app '+fmtMin(R.matA),'Même total : seul l’endroit où les heures sont prises change','Faire comme le tableau → '+fmtMin(Math.abs(matE))+(matE>0?' rendus au matelas, retirés des heures':' retirés du matelas, rendus aux heures')])
      +'<button class="rv-b2" onclick="event.stopPropagation();rhXferAccept('+Math.round(matE)+')">Faire comme le tableau</button>'});
  if(xk)card({t:'Matelas ou heures',sub:'Repris du tableau',vt:fmtMin(xv),done:1,
    body:_suPts([fmtMin(xv)+' de rendus pris sur les heures '+moisDe(+xk.slice(4))+' au lieu du matelas, comme le gestionnaire'])+'<button class="rv-b2" onclick="event.stopPropagation();rhXferUndoAdj(\''+xk+'\')">Annuler la reprise ('+fmtMin(xv)+' au matelas)</button>'});
  // 4. Reports accordés par le gestionnaire
  const tRep=_rhRepOf(rh),repL=Object.keys(tRep).map(Number).filter(ym=>ym<asOfYM&&ym>=R.st.genFrom-3&&tRep[ym]!==getEphExtensions(ym)).sort((a,b)=>a-b);
  if(repL.length)card({t:'Reports',sub:repL.map(ym=>MFc(ym)+' : '+(tRep[ym]?'+'+tRep[ym]*3+' mois':'aucun')+' au tableau').join(' · '),info:1,vt:'',
    body:_suPts(repL.map(ym=>MFc(ym)+' → '+(tRep[ym]?'+'+tRep[ym]*3+' mois':'aucun')+' au tableau, '+(getEphExtensions(ym)?'+'+getEphExtensions(ym)*3+' mois':'aucun')+' dans l’app').concat(['Les reports sont accordés par le gestionnaire']))
      +'<button class="rv-b2" onclick="event.stopPropagation();rhApplyReports('+JSON.stringify(repL.map(ym=>[ym,tRep[ym]]))+')">Faire comme le tableau</button>'});
  // 4b. Heures restantes mois par mois : le tableau peut différer de l'app (reports, consommations saisies autrement)
  const MS=ym=>MF[ym%12]+(Math.floor(ym/12)!==asOf.getFullYear()?' '+Math.floor(ym/12):''),fdS=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const vOf=l=>{const v=l.rep?(l.validRep||l.valid):l.valid;return v?new Date(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate(),12):null;};
  const tRem={},tExp={},tLost={},stD=new Date(R.st.d+'T12:00:00');
  rh.lines.forEach(l=>{if(!l.nature||!(l.solde>0))return;const v=vOf(l);if(!v||v>=asOf){tRem[l.ym]=(tRem[l.ym]||0)+l.solde;if(v)tExp[l.ym]=v;}else if(v>=stD){const x=tLost[l.ym]||(tLost[l.ym]={min:0,v});x.min+=l.solde;}});
  // heures que le tableau laisse expirer alors que l'app les a utilisées (le gestionnaire a pris avant des heures valables plus longtemps)
  const lostL=[];Object.keys(tLost).map(Number).sort((a,b)=>a-b).forEach(ym=>{const x=tLost[ym],d=x.min-(R.expA[ym]||0);if(!bad(d))return;lostL.push({ym,min:d,v:dk(x.v)});
    card({t:fmtMin(d)+' de '+MS(ym)+' sans report officiel',sub:'Expirées le '+fdS(x.v)+' · encore comptées au tableau',v:0,vt:fmtMin(d),info:true,
      body:_suPts(['Le tableau les compte toujours dans le solde : l’app aussi, tant qu’il les compte','Aucun report n’a été accordé : elles peuvent être retirées à tout moment',
        'Les prochains rendus sont pris dessus en premier (heures les plus anciennes) : à poser au plus vite, ou à faire reporter','Question prête dans le mail au gestionnaire'])});});
  // 5. Le reste : heures expirées à d'autres dates
  const restH=eH-acqE-consE;
  if(bad(restH)){const ig=_rhCIgn('rest',restH);if(ig)ignSum+=restH;
    card({t:'Heures expirées',sub:ig?'Ignoré':(restH>0?'L’app en perd ':'Le tableau en perd ')+fmtMin(Math.abs(restH))+' de plus',v:restH,done:ig,
      body:_suPts(['Heures arrivées à échéance à d’autres dates',repL.length?'Reports différents → voir « Reports »':'Souvent un report différent']).replace('</ul>','</ul>')+'<div style="margin-top:6px">'+_rhIgnLink('rest',restH)+'</div>'});}
  const dTot=eH+eM,de=dTot-ignSum; // + : le tableau vous laisse plus
  if(S.profile){const _c={ed:dk(asOf),d:Math.round(-dTot),de:Math.round(-de),lost:lostL,n:todo.length};const _o=S.profile.rhCmp;if(!_o||_o.ed!==_c.ed||_o.d!==_c.d||_o.de!==_c.de||JSON.stringify(_o.lost||[])!==JSON.stringify(lostL)){S.profile.rhCmp=_c;saveState();if(!silent)try{render();}catch(e){}}}
  if(silent)return;
  // Résumé : deux lignes, puis une phrase
  const row=(l,t,a,e)=>'<tr><td style="font-size:13px;color:var(--text2);padding:4px 0;text-align:left">'+l+'</td>'
    +'<td style="font-size:13px;color:var(--text3);text-align:right;padding:4px 0">'+fmtMin(t)+'</td><td style="font-size:15px;font-weight:600;text-align:right;padding:4px 0;color:var(--rend-text)">'+fmtMin(a)+'</td>'
    +'<td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;color:'+(!bad(e)?'var(--green)':e>0?'var(--green)':'var(--red)')+'">'+(bad(e)?fmtE(e):'✓')+'</td></tr>';
  const ok=!bad(eH)&&!bad(eM),st=ok?'✓ Identique au tableau':!bad(dTot)?'Même total, répartition différente':(dTot>0?'En votre faveur : ':'À faire corriger : ')+fmtE(dTot);
  const stC=ok||dTot>=0||!bad(dTot)?'var(--green)':'var(--red)';
  const fold=(t,sub,body,open)=>'<div class="rv-sec" style="cursor:pointer" onclick="this.nextElementSibling.classList.toggle(\'on\');this.querySelector(\'.rv-ch\').classList.toggle(\'r\')">'+t+' <span>'+(sub||'')+' <i class="ti ti-chevron-down rv-ch"></i></span></div><div class="rv-det'+(open?' on':'')+'">'+body+'</div>';
  const t3=(l,t,a,c,inv,note)=>'<tr'+(c?' class="'+c+'"':'')+'><td>'+l+'</td><td>'+(t?fmtMin(t):'—')+'</td><td>'+(a?fmtMin(a):'—')+'</td>'+(bad(t-a)?'<td class="'+((t-a>0)!==!!inv?'rc-pos':'rc-neg')+'">'+fmtE(t-a)+(note?'<br><small style="color:var(--text3);font-weight:400">'+note+'</small>':'')+'</td>':'<td><span class="rc-ok">✓</span></td>')+'</tr>';
  // heures acquises : l'écart d'origine reste affiché (planning seul), avec « repris » quand l'app a fait comme le tableau
  const acqTbl='<table class="rc-t"><tr><th></th><th>Tableau</th><th>App</th><th>Écart</th></tr>'+acqRows.map(r=>t3(MFc(r.ym),r.s,r.a-r.adj,'',0,bad(r.adj)&&!bad(r.s-r.a)?'repris':'')).join('')+'</table>';
  const wks=[...new Set(Object.keys(rh.weeks||{}).map(Number).filter(w=>dk(new Date(_rhWeekMon(asOf.getFullYear(),w).getTime()+6*864e5))>R.st.from).concat(Object.keys(R.wkA).map(Number)))].filter(w=>!rh.lastWeek||w<=rh.lastWeek).sort((a,b)=>a-b);
  // écart d'origine (calcul de l'app seul), « repris » quand l'app fait comme le tableau
  const cA0=R.consA+R.adjr,mA0=R.matA+R.xadj,rp=v=>bad(v)?'dont '+fmtMin(Math.abs(v))+' repris':'';
  const consTbl='<table class="rc-t"><tr><th></th><th>Tableau</th><th>App</th><th>Écart</th></tr>'+t3('Sur les heures',R.consT,cA0,'',1,rp(R.adjr))+(R.hasMat?t3('Sur le matelas',R.matT,mA0,'',1,rp(R.xadj)):'')+t3('Total',R.consT+R.matT,cA0+mA0,'rc-tot',1,rp(R.adjr+R.xadj))+'</table>'
    +(wks.length?'<div style="font-size:11px;color:var(--text3);margin:10px 0 2px">Par semaine (commentaires du tableau)</div><table class="rc-t">'+wks.map(w=>{const c=(rh.weeks||{})[w],a=R.wkA[w]||0;if(c==null)return '<tr style="opacity:.55"><td>S'+w+'</td><td>pas cité</td><td>'+fmtMin(a)+'</td><td></td></tr>';
      const mon=_rhWeekMon(asOf.getFullYear(),w);return t3('S'+w,c,a,'',1,_rhCIgn('wkm'+(mon.getFullYear()*12+mon.getMonth())+'s'+w,a-c)?'repris':'');}).join('')+'</table>':'');
  const html='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet rv-sheet tabmod">'+head
    +'<div style="font-size:11px;color:var(--text3);text-align:center;margin:0 0 8px">tableau du '+fd(dk(asOf))+' · départ : '+_startTxt(R.st).split(' · ')[0]+'</div>'
    +'<div style="display:flex;justify-content:center;gap:8px;margin:0 0 12px"><button class="adj-pill" style="width:auto;padding:0 14px;height:30px;font-size:13px" onclick="_rhView()"><i class="ti ti-table" style="margin-right:4px"></i>Voir le tableau</button><button class="adj-pill" style="width:auto;padding:0 14px;height:30px;font-size:13px" onclick="rhCompareOpen()"><i class="ti ti-file-import" style="margin-right:4px"></i>Importer</button></div>'
    +'<div class="hd-card" style="padding:10px 14px 12px">'
    +'<table style="width:100%;border-collapse:collapse;table-layout:fixed"><colgroup><col><col style="width:62px"><col style="width:72px"><col style="width:62px"></colgroup>'
    +'<tr style="font-size:11px;color:var(--text3)"><td></td><td style="text-align:right">tableau</td><td style="text-align:right">app</td><td style="text-align:right">écart</td></tr>'
    +row('Heures de rendus',R.tabH,R.appH,eH)+(R.hasMat?row('Matelas',R.tabM,R.appM,eM):'')+'</table>'
    +'<div style="font-size:13px;font-weight:600;margin-top:8px;color:'+stC+'">'+st+'</div>'
    +(todo.length?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+todo.length+' différence'+(todo.length>1?'s':'')+' à voir ci-dessous</div>':'')
    +(aoff?'<div style="font-size:11px;color:var(--text3);margin-top:4px">Plus de différence avec ce tableau → reprise retirée : '+aoff.join(', ')+'</div>':'')
    +(done.length?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+done.length+' différence'+(done.length>1?'s reprises':' reprise')+' du tableau</div><button class="rv-b2" onclick="rhRevertAll()">Annuler les '+done.length+' reprise'+(done.length>1?'s':'')+' du tableau</button>':'')
    +(R.lag.length?'<div style="font-size:11px;color:var(--text3);margin-top:4px">'+fmtMin(R.lag.reduce((t,k)=>t+getDur(new Date(k+'T12:00:00')),0))+' de rendus après la S'+R.lw+' : pas encore au tableau, mis de côté</div>':'')
    +'</div>'
    +(todo.length+done.length?'<div class="rv-sec">Différences <span>'+(todo.length?todo.length+' à voir':'rien à voir')+'</span></div>'+todo.join('')
      +(done.length?'<div class="rv-more" onclick="var d=this.nextElementSibling;d.style.display=d.style.display===\'none\'?\'\':\'none\';this.textContent=d.style.display===\'none\'?\'Afficher les '+done.length+' différence'+(done.length>1?'s reprises ou ignorées':' reprise ou ignorée')+'\':\'Masquer\'">Afficher les '+done.length+' différence'+(done.length>1?'s reprises ou ignorées':' reprise ou ignorée')+'</div><div style="display:none">'+done.join('')+'</div>':''):'')
    +(acqRows.length?fold('Heures acquises','par mois',acqTbl):'')
    +fold('Rendus déduits','depuis le départ',consTbl)
    +fold('Départ du calcul',_startTxt(R.st).split(' · ')[0],'<div style="font-size:13px;color:var(--text2);line-height:1.45">Vos heures sont calculées à partir du <b style="color:var(--text)">'+_startTxt(R.st).split(' · ')[0]+'</b>.</div>'
      +'<button class="rv-b2" onclick="openStartModal()">Changer le départ</button>')

    +'<div style="height:6px"></div><button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
  document.getElementById('modal-root').innerHTML=html;
  if(window._rvFrom)_swipeNav(null,function(){_rvGoBack();});
}



function _applyPoseMatelas(type,startKey,endKey){
  pushUndo((type==='cg'?'Congé posé':type==='rend'?'Rendu posé':'Absence posée'));
  if(!S.conges)S.conges={};
  var _s=new Date(startKey+'T12:00:00'),_e=new Date(endKey+'T12:00:00'),_d=new Date(_s);
  var _label=type==='rend'?'rendu':'congé';
  var _createdYM_m=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  while(_d<=_e){var k=dk(_d);var v2=getVac(_d);if(v2.vac&&v2.vac!=='RH'&&!v2.absent){var _mym=_d.getFullYear()*12+_d.getMonth();S.conges[k]=type==='rend'?_rendStatus(k):type;}_d.setDate(_d.getDate()+1);}
  if(type==='rend')recalcAllMatelas();
  logH(fmtDate(_s)+(_s<_e?' au '+fmtDate(_e):'')+' -> '+_label,'#88b862',startKey);
  saveState();closeModal();render();gcalTrigger();
}
async function applyPose(type,startKey,unique){
  const endKey=unique?startKey:(document.getElementById('pose-until').value||startKey);
  const start=new Date(startKey+'T12:00:00');
  const end=new Date(endKey+'T12:00:00');

  // Conflict check: rend ↔ cg
  if(type==='cg'||type==='rend'){
    const _oppT=type==='cg'?['rend','rend-hist']:['cg'];
    var _cf=[];var _dCf=new Date(start);
    while(_dCf<=end){const _kCf=dk(_dCf),_vCf=getVac(_dCf);if(_vCf.vac&&_vCf.vac!=='RH'&&!_vCf.absent){const _exCf=(S.conges||{})[_kCf];if(_oppT.indexOf(_exCf)>=0)_cf.push(_kCf);}_dCf.setDate(_dCf.getDate()+1);}
    if(_cf.length>0){const _oppLbl=type==='cg'?'rendu':'congé';showBlockAlert('Conflit',_cf.length+' jour'+(_cf.length>1?'s':'')+' déjà posé'+(_cf.length>1?'s':'')+' comme '+_oppLbl+'. Les supprimer avant de continuer.');return;}
  }
  // Absence sur des jours déjà en congé ou en rendu : les remplacer seulement après confirmation
  if(type==='absent'){var _ab=0,_dAb=new Date(start);while(_dAb<=end){const _x=(S.conges||{})[dk(_dAb)];if(_x==='cg'||_x==='rend'||_x==='rend-hist')_ab++;_dAb.setDate(_dAb.getDate()+1);}
    if(_ab&&!await _ask(_ab+' jour'+(_ab>1?'s':'')+' déjà posé'+(_ab>1?'s':'')+' en congé ou en rendu ser'+(_ab>1?'ont':'a')+' remplacé'+(_ab>1?'s':'')+' par l’absence.',{ok:'Remplacer'}))return;}

  // Solde check: congés
  if(type==='cg'){
    const _cgByY={};var _dCg=new Date(start);
    while(_dCg<=end){const _kCg=dk(_dCg),_vCg=getVac(_dCg);if(_vCg.vac&&_vCg.vac!=='RH'&&!_vCg.absent&&(S.conges||{})[_kCg]!=='cg'){const _yCg=_dCg.getFullYear();_cgByY[_yCg]=(_cgByY[_yCg]||0)+1;}_dCg.setDate(_dCg.getDate()+1);}
    var _cgShort=0,_cgShortY=null;
    // Pose simulée puis annulée : le décompte réel (semaine entière = 5 j, jours d'écart) peut dépasser le nombre de jours travaillés
    var _cgSim=[];_dCg=new Date(start);while(_dCg<=end){const _k=dk(_dCg),_v=getVac(_dCg);if(_v.vac&&_v.vac!=='RH'&&!_v.absent&&(S.conges||{})[_k]!=='cg'){_cgSim.push([_k,(S.conges||{})[_k]]);if(!S.conges)S.conges={};S.conges[_k]='cg';}_dCg.setDate(_dCg.getDate()+1);}
    var _cgAfter={};Object.keys(_cgByY).forEach(function(_y2){_cgAfter[_y2]=computeCongesRest(Number(_y2));});
    _cgSim.forEach(function(x){if(x[1]===undefined)delete S.conges[x[0]];else S.conges[x[0]]=x[1];});
    Object.keys(_cgAfter).forEach(function(_y2){if(_cgAfter[_y2]<0){_cgShort=-_cgAfter[_y2];_cgShortY=Number(_y2);}});
    if(_cgShort>0){showBlockAlert('Solde insuffisant','Il manque '+_cgShort+' jour'+(_cgShort>1?'s':'')+' pour '+_cgShortY+'. Disponible : '+Math.max(0,computeCongesRest(_cgShortY))+' j.');return;}
  }

  // Validate rendus: full FIFO simulation including new days
  if(type==='rend'){
    const _createdYM_v=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
    var totalRend=0;
    var _newKeys=[];
    var d0=new Date(start);
    while(d0<=end){
      const v2=getVac(d0);
      if(v2.vac&&v2.vac!=='RH'&&!v2.absent){
        const _d0ym=d0.getFullYear()*12+d0.getMonth();
        if(_d0ym>=_createdYM_v&&_rendStatus(dk(d0))==='rend'){totalRend+=getDur(d0);_newKeys.push(dk(d0));}
      }
      d0.setDate(d0.getDate()+1);
    }
    if(totalRend>0){
      const deficit=canPlaceRendu(_newKeys);
      if(deficit>0){
        const matelasAvail=(S.profile&&S.profile.matelas)||0;
        const canMatelas=matelasAvail>0&&deficit<=matelasAvail;
        const matelasBtn=canMatelas?'<button class="mb" style="background:rgba(220,160,30,.18);color:var(--amber);border-color:transparent;flex:1" onclick="_applyPoseMatelas(\''+type+'\',\''+startKey+'\',\''+endKey+'\')">Matelas <span style="font-size:11px;opacity:.8">('+fmtMin(matelasAvail)+')</span></button>':'';
        const btnsRow=canMatelas
          ?'<div style="display:flex;gap:8px">'+matelasBtn+'<button class="mb" style="flex:1" onclick="if(pendingKey)openDay(pendingKey);else closeModal()">Retour</button></div>'
          :'<button class="mb wide" onclick="if(pendingKey)openDay(pendingKey);else closeModal()">Retour</button>';
        document.getElementById('modal-root').innerHTML='<div class="overlay" style="z-index:400"><div class="sheet" style="max-height:260px"><div class="sh"></div>'
          +'<div class="st" style="color:var(--rend-text)">Rendus insuffisants</div>'
          +'<div class="ss" style="margin-bottom:16px">Il manque <b>'+fmtMin(deficit)+'</b> pour poser cette période.<br>Nécessaire : '+fmtMin(totalRend)+'</div>'
          +btnsRow
          +'</div></div>';
        return;
      }
    }

  }

  var _xg=((document.getElementById('_exc-gv')||{}).dataset||{}).v||'j',_xm=type==='absent'?((document.getElementById('_exc-m')||{}).value||''):'',_xr=((document.getElementById('_exc-r')||{}).dataset||{}).v||'work',_xh=!!(EXC_M[_xm]&&EXC_M[_xm].half);
  pushUndo((type==='cg'?(unique?'Congé posé':'Congés posés'):type==='rend'?(unique?'Rendu posé':'Rendus posés'):_xm?'Congé exceptionnel posé':'Absence posée'));
  if(_xm&&!S.excInfo)S.excInfo={};
  if(!S.conges)S.conges={};if(!S.overrides)S.overrides={};
  const _createdYM_w=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  var d=new Date(start);
  while(d<=end){
    const k=dk(d);
    const v2=getVac(d);
    const isWorked=v2.vac&&v2.vac!=='RH'&&!v2.absent;
    if(isWorked){
      if(type==='absent'&&EXC_M[_xm]&&EXC_M[_xm].greve&&_xg!=='j'){S.excInfo[k]={m:_xm,g:_xg};delete S.conges[k];}
      else if(type==='absent'&&_xh){S.excInfo[k]={m:_xm,half:1,rest:_xr};if(_xr==='rend')S.conges[k]=_rendStatus(k);else delete S.conges[k];}
      else if(type==='absent'){S.overrides[k]={absent:true};S.conges[k]='absent';if(_xm)S.excInfo[k]=EXC_M[_xm].greve?{m:_xm,g:'j'}:EXC_M[_xm].opt?_excOpt(_xm):{m:_xm};else if(S.excInfo)delete S.excInfo[k];}
      else if(type==='rend'){S.conges[k]=_rendStatus(k);if(S.excInfo)delete S.excInfo[k];}
      else{S.conges[k]=type;if(S.excInfo)delete S.excInfo[k];}
    }
    d.setDate(d.getDate()+1);
  }
  const label=type==='cg'?'congé':type==='rend'?'rendu':_xm?EXC_M[_xm].l.toLowerCase()+(EXC_M[_xm]&&EXC_M[_xm].greve?' ('+({h:'1 heure',dj:'½ journée',j:'journée'})[_xg]+')':'')+(_xh?' (½'+(_xr==='rend'?' + rendu)':')'):''):'absent';
  const color=type==='cg'?'#6a9878':type==='rend'?'#A8BF7A':'#c88048';
  logH(fmtDate(start)+(unique?'':' au '+fmtDate(end))+' -> '+label,color,startKey);
  if(!unique&&S.history[0]&&!_histPeriod(S.history[0]))S.history.shift(); // repos en bout de période : la ligne ne les montre pas
  saveState();closeModal();render();
  gcalTrigger();
}



function toggleHistPanel(btn){
  const key=btn.dataset.key,pid=btn.dataset.pid;
  const panelId='th-'+key+'-'+pid;
  const existing=document.getElementById(panelId);
  if(existing){existing.style.display=existing.style.display==='none'?'block':'none';return;}
  const pr=_profs[pid];if(!pr)return;
  const history=(pr.settings&&pr.settings.settingsHistory)||[];
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
    const badge=isFuture?'<span style="font-size:10px;background:var(--gold-l);color:var(--gold-dark);padding:1px 5px;border-radius:8px;margin-left:4px">à venir</span>':'';
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
  if(!S.overrides)return;
  pushUndo('Échange annulé');
  // Find the partner key: look for ec2 (the day we gave away) or ec (the day we took)
  const ov1=S.overrides[key];
  if(!ov1||!ov1.echange)return;
  delete S.overrides[key];
  // Partenaire de l'échange : lien enregistré (pair) ; anciens échanges sans lien : tous ceux de la semaine
  if(ov1.pair){const p=S.overrides[ov1.pair];if(p&&p.echange&&ov1.pair!==key){gcalClearDateId(ov1.pair);delete S.overrides[ov1.pair];}if(ov1.pair!==key)removeHistoryForKey(ov1.pair);}
  const date=new Date(key+'T12:00:00'),mon=getMonday(date);
  if(!ov1.pair)for(let i=0;i<7;i++){
    const d=new Date(mon);d.setDate(mon.getDate()+i);const dk2=dk(d);
    const ov2=(S.overrides||{})[dk2];
    if(ov2&&ov2.echange){gcalClearDateId(dk2);if(dk2!==key){delete S.overrides[dk2];removeHistoryForKey(dk2);}}
  }
  gcalClearDateId(key);delete S.overrides[key];
  removeHistoryForKey(key);
  saveState();closeModal();render();popCell(key);
  gcalTrigger();
}
function openMonthSettingsModal(mym){
  const y=Math.floor(mym/12),m=mym%12;
  const ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const keys=['dimRendu','rhRendu','ferRendu','hsRendu'];
  const labels=['Dimanches','RH travaillés','Fériés travaillés','Heures sup.'];
  const ids=['dim','rh','fer','hs'];
  const eff=settingsForYM(mym);
  const hasAnyBp=keys.some(k=>!!_smhGet(k,mym)||(S.profile.settingsMonthly&&S.profile.settingsMonthly[mym]&&k in S.profile.settingsMonthly[mym]));
  function _tgl(i){
    const k=keys[i],id=ids[i],lbl=labels[i];
    const hasBp=!!_smhGet(k,mym);
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-top:0.5px solid var(--border2)">'
      +'<span style="font-size:13px;color:var(--text2)">'+lbl+(hasBp?'<span style="margin-left:6px;font-size:10px;padding:1px 5px;border-radius:8px;background:var(--blue);color:#fff">●</span>':'')+'</span>'
      +'<label class="tgl"><input type="checkbox" id="mo-'+id+'"'+(eff[k]?' checked':'')+'><span class="tgl-s"></span></label>'
      +'</div>';
  }
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)openMergedMoisModal('+mym+',1)"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Rendus — '+ML[m]+' '+y+'</div>'
    +'<div class="ss" style="margin-bottom:12px">Les valeurs changées se propagent aux mois suivants jusqu\'au prochain point.</div>'
    +ids.map((_,i)=>_tgl(i)).join('')
    +(hasAnyBp?'<button onclick="resetMonthSettings('+mym+')" style="margin-top:14px;width:100%;height:32px;font-size:11px;color:var(--text3);background:var(--btn);border:0.5px solid var(--border);border-radius:var(--r);cursor:pointer;font-family:var(--font)">Supprimer les points de ce mois</button>':'')
    +'<div style="display:flex;gap:8px;margin-top:10px">'
    +'<button class="mb" style="flex:1;font-size:11px;border:none" onclick="saveMonthSettings('+mym+',false)">Ce mois</button>'
    +'<button class="mb" style="flex:1;font-size:11px;border:none" onclick="saveMonthSettings('+mym+',true)">Ce mois et les suivants</button>'
    +'</div>'
    +'<button class="mcancel" onclick="openMergedMoisModal('+mym+',1)">Annuler</button>'
    +'</div></div>';
}
function saveMonthSettings(mym,propagate){
  const keys=['dimRendu','rhRendu','ferRendu','hsRendu'];
  const ids=['dim','rh','fer','hs'];
  const eff=settingsForYM(mym);
  for(let i=0;i<4;i++){
    const k=keys[i];
    const newVal=!!document.getElementById('mo-'+ids[i]).checked;
    if(newVal!==eff[k]){
      if(!propagate){
        _smhDel(k,mym);
        if(!S.profile.settingsMonthly)S.profile.settingsMonthly={};
        if(!S.profile.settingsMonthly[mym])S.profile.settingsMonthly[mym]={};
        S.profile.settingsMonthly[mym][k]=newVal;
      }else{
        if(S.profile.settingsMonthly){
          Object.keys(S.profile.settingsMonthly).forEach(function(mStr){
            var m=Number(mStr);
            if(m>=mym&&S.profile.settingsMonthly[m]&&k in S.profile.settingsMonthly[m]){
              delete S.profile.settingsMonthly[m][k];
              if(!Object.keys(S.profile.settingsMonthly[m]).length)delete S.profile.settingsMonthly[m];
            }
          });
        }
        if(S.profile.settingsMonthlyHistory&&S.profile.settingsMonthlyHistory[k]){
          S.profile.settingsMonthlyHistory[k]=S.profile.settingsMonthlyHistory[k].filter(function(e){return e.ym<=mym;});
        }
        _smhSet(k,mym,newVal);
      }
    }
  }
  saveState();render();openMergedMoisModal(mym,1);
}
function resetMonthSettings(mym){
  if(S.profile.settingsMonthly&&S.profile.settingsMonthly[mym])
    delete S.profile.settingsMonthly[mym];
  _SMH_KEYS.forEach(k=>_smhDel(k,mym));
  saveState();render();openMergedMoisModal(mym,1);
}
function openAnnualSettingsModal(y,dir){
  if(!y)y=new Date().getFullYear();
  _annualSelYear=y;
  const _wasOpen=document.body.classList.contains('modal-open');
  if(!_wasOpen)_lockBodyScroll();
  const ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const keys=['dimRendu','rhRendu','ferRendu','hsRendu'];
  const hdrs=['Dim','RH','Fér','HS'];
  const _genYr=calcSoldes().gen;
  let rows='';
  for(let m=0;m<12;m++){
    const ym=y*12+m;
    const eff=settingsForYM(ym);
    const isSel=_annualSel.has(ym);
    const isPast=ym<TODAY_YM,isCur=ym===TODAY_YM;
    const rowBg=isSel?'rgba(59,130,246,.10)':'';
    const pillBg=isSel?'rgba(59,130,246,.20)':'rgba(128,128,128,.13)';
    const pillColor=isSel?'var(--blue)':isCur?'var(--blue)':isPast?'var(--text3)':'var(--text)';
    const gm=_genYr[ym]||{};
    const ymTotal=(gm.dim||0)+(gm.rh||0)+(gm.fer||0)+(gm.hs||0)+(gm.ram||0)+(gm.extra||0);
    rows+='<tr data-row="'+ym+'" style="border-top:0.5px solid var(--border2);background:'+rowBg+'">'
      +'<td data-ym="'+ym+'" style="padding:4px;cursor:pointer;user-select:none" onclick="toggleAnnualSel('+ym+')">'
      +'<div style="display:inline-block;padding:2px 7px;border-radius:8px;font-size:11px;font-weight:500;background:'+pillBg+';color:'+pillColor+'">'+ML[m]+'</div>'
      +'</td>';
    for(let k=0;k<4;k++){
      const key=keys[k];
      const val=eff[key];
      rows+='<td style="text-align:center;padding:4px 2px">'
        +'<button onclick="toggleAnnualSel('+ym+')" style="width:28px;height:24px;border-radius:5px;border:none;background:transparent;color:'+(val?'var(--blue)':'var(--text3)')+';font-size:15px;line-height:1;cursor:pointer;font-family:var(--font);display:inline-flex;align-items:center;justify-content:center">'+(val?'●':'○')+'</button>'
        +'</td>';
    }
    rows+='<td style="text-align:right;padding:4px 6px 4px 2px;font-size:11px;color:'+(ymTotal>0?'var(--rend-text)':'var(--text3)')+';white-space:nowrap">'+(ymTotal>0?fmtMin(ymTotal):'—')+'</td>';
    rows+='</tr>';
  }
  // Permanent tfoot — always rendered so table height never changes on selection
  var _hasSel=_annualSel.size>0;
  var _previewTxt='';
  if(_hasSel&&_annualSel.size===1){
    var _pYm=Array.from(_annualSel)[0];
    var _pEff=settingsForYM(_pYm);
    var _prSett={
      dimRendu:_annualActionState.dimRendu!==null?_annualActionState.dimRendu:_pEff.dimRendu,
      rhRendu:_annualActionState.rhRendu!==null?_annualActionState.rhRendu:_pEff.rhRendu,
      ferRendu:_annualActionState.ferRendu!==null?_annualActionState.ferRendu:_pEff.ferRendu,
      hsRendu:_annualActionState.hsRendu!==null?_annualActionState.hsRendu:_pEff.hsRendu
    };
    var _potGm=buildPotentialForYM(_pYm,_prSett);
    var _pSum=(_potGm.dim||0)+(_potGm.rh||0)+(_potGm.fer||0)+(_potGm.hs||0)+(_potGm.ram||0)+(_potGm.extra||0);
    _previewTxt=fmtMin(_pSum);
  }
  var tfoot='<tfoot><tr style="border-top:2px solid '+(_hasSel?'var(--blue)':'var(--border2)')
    +';background:'+(_hasSel?'rgba(59,130,246,.07)':'')+'"><td style="padding:4px;width:52px"></td>'
    +keys.map(function(k){
      var v=_annualActionState[k];
      var dc=_hasSel?(v===true?'var(--blue)':v===null?'var(--amber)':'var(--text3)'):'transparent';
      var db=_hasSel?(v===true?'var(--blue)':v===null?'var(--amber)':'var(--border)'):'transparent';
      var dbg=_hasSel?(v===true?'rgba(59,130,246,.12)':v===null?'rgba(245,158,11,.08)':'transparent'):'transparent';
      var onclick=_hasSel?'onclick="toggleAnnualDot(\''+k+'\')"':'';
      return '<td style="text-align:center;padding:4px 2px"><button '+onclick+' style="width:28px;height:24px;border-radius:5px;border:0.5px solid '+db+';background:'+dbg+';color:'+dc+';font-size:15px;line-height:1;cursor:'+(_hasSel?'pointer':'default')+';font-family:var(--font);display:inline-flex;align-items:center;justify-content:center">'+(v===true?'●':'○')+'</button></td>';
    }).join('')
    +'<td style="text-align:right;padding:4px 6px;font-size:11px;font-weight:600;color:var(--rend-text)">'+(_hasSel?_previewTxt:'')+'</td>'
    +'</tr></tfoot>';
  // Column headers with Total
  const _allSel12=Array.from({length:12},(_,m)=>y*12+m).every(ym=>_annualSel.has(ym));
  const colHeaders='<th style="padding:4px;text-align:left"><button onclick="selectAllAnnual()" style="font-size:11px;padding:2px 7px;border-radius:6px;font-family:var(--font);font-weight:500;cursor:pointer;border:'+(_allSel12?'none':'0.5px solid var(--border)')+';background:'+(_allSel12?'var(--blue)':'rgba(128,128,128,.13)')+';color:'+(_allSel12?'#fff':'var(--text2)')+'">Tout</button></th>'
    +keys.map((_,i)=>'<th style="padding:4px 2px;font-size:10px;color:var(--text3);font-weight:500;text-align:center">'+hdrs[i]+'</th>').join('')
    +'<th style="padding:4px 6px 4px 2px;font-size:10px;color:var(--text3);font-weight:500;text-align:right">Total</th>';
  // Action buttons — fixed height container (no dotsRow, dots are in tfoot)
  var actionContent='';
  if(_hasSel){
    var sc=_annualSel.size;
    if(sc===1){
      actionContent='<div style="display:flex;gap:6px">'
        +'<button onclick="clearAnnualSel()" style="flex:1;height:28px;font-size:10px;font-family:var(--font);background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);cursor:pointer">Annuler</button>'
        +'<button onclick="applyAnnualSel(false)" style="flex:1;height:28px;font-size:10px;font-family:var(--font);background:var(--blue);color:#fff;border:0.5px solid var(--blue);border-radius:var(--r);cursor:pointer">Ce mois</button>'
        +'<button onclick="applyAnnualSel(true)" style="flex:2;height:28px;font-size:10px;font-family:var(--font);background:var(--amber);color:#000;border:0.5px solid var(--amber);border-radius:var(--r);cursor:pointer">Ce mois et les suivants</button>'
        +'</div>';
    }else{
      actionContent='<div style="display:flex;gap:8px">'
        +'<button onclick="clearAnnualSel()" style="flex:1;height:28px;font-size:11px;font-family:var(--font);background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);cursor:pointer">Annuler</button>'
        +'<button onclick="applyAnnualSel(false)" style="flex:1;height:28px;font-size:11px;font-family:var(--font);background:var(--blue);color:#fff;border:0.5px solid var(--blue);border-radius:var(--r);cursor:pointer">Appliquer</button>'
        +'</div>';
    }
  }
  // Capture current table for outgoing animation before wiping DOM
  let _oldTblClone=null;
  if(dir){const _ot=document.querySelector('#modal-root .annual-tbl-wrap table');if(_ot)_oldTblClone=_ot.cloneNode(true);}
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay"'+(_wasOpen?' style="animation:none"':'')+' onclick="if(event.target===this){_annualSel.clear();closeModal();}"><div class="sheet"'+(_wasOpen?' style="animation:none"':'')+' >'
    +'<div class="sh"></div>'
    +'<div style="display:flex;align-items:center;margin-bottom:2px">'
    +'<button onclick="_annualSel.clear();openSettingsModal(2)" style="background:transparent;border:none;color:var(--blue);cursor:pointer;font-size:11px;padding:0;display:flex;align-items:center;gap:3px">‹ Paramètres</button>'
    +'</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
    +'<button onclick="_annualSel.clear();openAnnualSettingsModal('+(y-1)+',\'prev\')" style="background:transparent;border:none;color:var(--text2);cursor:pointer;font-size:18px;padding:0 8px">‹</button>'
    +'<span onclick="jumpToCurrentYear()" style="font-size:16px;font-weight:600;cursor:pointer;padding:2px 10px;border-radius:6px;background:rgba(128,128,128,.1)">'+y+'</span>'
    +'<button onclick="_annualSel.clear();openAnnualSettingsModal('+(y+1)+',\'next\')" style="background:transparent;border:none;color:var(--text2);cursor:pointer;font-size:18px;padding:0 8px">›</button>'
    +'</div>'
    +'<div class="annual-tbl-wrap">'
    +'<table style="width:100%;border-collapse:collapse;table-layout:fixed">'
    +'<colgroup><col style="width:52px"><col><col><col><col><col style="width:54px"></colgroup>'
    +'<thead><tr>'+colHeaders+'</tr></thead><tbody>'+rows+'</tbody>'+tfoot+'</table>'
    +'</div>'
    +'<div style="margin-top:8px;height:36px">'
    +actionContent
    +'</div>'
    +'<button class="mcancel mclose" onclick="_annualSel.clear();closeModal()">Fermer</button>'
    +'</div></div>';
  // Smooth dual-direction slide animation
  const _newWrap=document.querySelector('#modal-root .annual-tbl-wrap');
  const _newTbl=_newWrap?_newWrap.querySelector('table'):null;
  if(dir&&_oldTblClone&&_newWrap&&_newTbl){
    const h=_newWrap.offsetHeight;
    _newWrap.style.cssText='position:relative;overflow:hidden;height:'+h+'px';
    _newTbl.style.cssText='width:100%;border-collapse:collapse;table-layout:fixed;position:absolute;top:0;left:0;transform:translateX('+(dir==='next'?'100%':'-100%')+')';
    _oldTblClone.style.cssText='width:100%;border-collapse:collapse;table-layout:fixed;position:absolute;top:0;left:0';
    _newWrap.appendChild(_oldTblClone);
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      var tr='transform .32s cubic-bezier(.4,0,.2,1)';
      _oldTblClone.style.transition=tr;_oldTblClone.style.transform='translateX('+(dir==='next'?'-100%':'100%')+')';
      _newTbl.style.transition=tr;_newTbl.style.transform='translateX(0)';
    });});
    setTimeout(function(){
      if(_oldTblClone.parentNode)_oldTblClone.parentNode.removeChild(_oldTblClone);
      _newTbl.style.cssText='width:100%;border-collapse:collapse;table-layout:fixed';
      _newWrap.style.cssText='';
    },350);
  }
  // Year swipe from non-table area
  let _dAct2=false;
  const _sh2=document.querySelector('#modal-root .sheet');
  if(_sh2){
    let _sx=0,_sy=0,_sb=false;
    _sh2.addEventListener('touchstart',function(e){_sx=e.touches[0].clientX;_sy=e.touches[0].clientY;_sb=!!e.target.closest('input,select,textarea');},{passive:true});
    _sh2.addEventListener('touchend',function(e){
      if(_sb||_dAct2)return;
      const dx=e.changedTouches[0].clientX-_sx,dy=Math.abs(e.changedTouches[0].clientY-_sy);
      if(Math.abs(dx)<50||dy>Math.abs(dx))return;
      _annualSel.clear();
      openAnnualSettingsModal(dx<0?y+1:y-1,dx<0?'next':'prev');
    },{passive:true});
  }
  // Drag-to-select on month cells with direction disambiguation
  const _tb2=document.querySelector('#modal-root tbody');
  if(_tb2){
    let _dAct=false,_dMode=true,_dLast=-1,_dSX=0,_dSY=0,_dSYm=-1,_dDir=null,_dWasEmpty=false;
    function _annUpd(ym2,sel){
      const tr=document.querySelector('#modal-root tr[data-row="'+ym2+'"]');if(!tr)return;
      tr.style.background=sel?'rgba(59,130,246,.10)':'';
      const pill=tr.querySelector('td[data-ym] div');
      if(pill){pill.style.background=sel?'rgba(59,130,246,.20)':'rgba(128,128,128,.13)';pill.style.color=sel?'var(--blue)':'var(--text)';}
    }
    _tb2.addEventListener('touchstart',function(e){
      const td=e.target.closest('td[data-ym]');if(!td)return;
      _dSX=e.touches[0].clientX;_dSY=e.touches[0].clientY;
      _dSYm=Number(td.dataset.ym);_dDir=null;_dAct=false;
      _dWasEmpty=(_annualSel.size===0);_dMode=!_annualSel.has(_dSYm);
    },{passive:true});
    _tb2.addEventListener('touchmove',function(e){
      if(_dSYm<0)return;
      const dx=Math.abs(e.touches[0].clientX-_dSX),dy=Math.abs(e.touches[0].clientY-_dSY);
      if(!_dDir){if(dx>8||dy>8)_dDir=dx>dy?'h':'v';else return;}
      if(_dDir==='h')return; // horizontal → will navigate in touchend
      // Vertical drag-to-select
      e.preventDefault();e.stopPropagation();
      if(!_dAct){
        _dAct=true;_dAct2=true;_annualPending=null;_dLast=_dSYm;
        if(_dMode)_annualSel.add(_dSYm);else _annualSel.delete(_dSYm);
        _annUpd(_dSYm,_dMode);
      }
      const t=e.touches[0],el=document.elementFromPoint(t.clientX,t.clientY);if(!el)return;
      let td2=el.closest('td[data-ym]');
      if(!td2){const tr2=el.closest('tr[data-row]');if(tr2)td2=tr2.querySelector('td[data-ym]');}
      if(!td2)return;
      const ym2=Number(td2.dataset.ym);if(ym2===_dLast)return;
      _dLast=ym2;
      if(_dMode)_annualSel.add(ym2);else _annualSel.delete(ym2);
      _annUpd(ym2,_dMode);
    },{passive:false});
    _tb2.addEventListener('touchend',function(e){
      if(_dSYm<0)return;
      e.stopPropagation(); // prevent global sheet-close handler
      const sYm=_dSYm;_dSYm=-1;
      if(_dDir==='h'){
        const dx=e.changedTouches[0].clientX-_dSX,dy=Math.abs(e.changedTouches[0].clientY-_dSY);
        if(Math.abs(dx)>=50&&dy<=Math.abs(dx)){
          _annualSel.clear();
          openAnnualSettingsModal(dx<0?y+1:y-1,dx<0?'next':'prev');
        }
        return;
      }
      if(_dAct){if(_annualSel.size>0&&(_dWasEmpty||!_annualActionManual))_initAnnualDots();_dAct=false;_dAct2=false;openAnnualSettingsModal(_annualSelYear);}
      // tap (_dDir===null): onclick on td fires and calls toggleAnnualSel
    },{passive:true});
  }
}
function selectAnnualCell(ym,key){
  if(_annualPending&&_annualPending.ym===ym&&_annualPending.key===key){
    _annualPending=null;openAnnualSettingsModal(_annualSelYear);return;
  }
  _annualPending={ym,key};openAnnualSettingsModal(_annualSelYear);
}
function applyAnnualCell(ym,key,propagate){
  const newVal=!settingsForYM(ym)[key];
  if(!propagate){
    // Ce mois uniquement: exact isolated override, remove any breakpoint at this month
    _smhDel(key,ym);
    if(!S.profile.settingsMonthly)S.profile.settingsMonthly={};
    if(!S.profile.settingsMonthly[ym])S.profile.settingsMonthly[ym]={};
    S.profile.settingsMonthly[ym][key]=newVal;
  }else{
    // Ce mois et les suivants: propagating breakpoint — clear everything for this key after ym
    // so neither settingsMonthly exact overrides nor later settingsMonthlyHistory entries shadow it
    if(S.profile.settingsMonthly){
      Object.keys(S.profile.settingsMonthly).forEach(function(mStr){
        var m=Number(mStr);
        if(m>=ym&&S.profile.settingsMonthly[m]&&key in S.profile.settingsMonthly[m]){
          delete S.profile.settingsMonthly[m][key];
          if(!Object.keys(S.profile.settingsMonthly[m]).length)delete S.profile.settingsMonthly[m];
        }
      });
    }
    if(S.profile.settingsMonthlyHistory&&S.profile.settingsMonthlyHistory[key]){
      S.profile.settingsMonthlyHistory[key]=S.profile.settingsMonthlyHistory[key].filter(function(e){return e.ym<=ym;});
    }
    _smhSet(key,ym,newVal);
  }
  _annualPending=null;saveState();render();openAnnualSettingsModal(_annualSelYear);
}

function toggleAnnualSel(ym){
  const prev=_annualSel.size;
  if(_annualSel.has(ym))_annualSel.delete(ym);else _annualSel.add(ym);
  if(_annualSel.size===0){_annualActionManual=false;}
  else if(prev===0||!_annualActionManual){_initAnnualDots();}
  openAnnualSettingsModal(_annualSelYear);
}
function clearAnnualSel(){_annualActionManual=false;_annualSel.clear();openAnnualSettingsModal(_annualSelYear);}
function toggleAnnualDot(key){_annualActionManual=true;_annualActionState[key]=(_annualActionState[key]!==true)?true:false;openAnnualSettingsModal(_annualSelYear);}
function selectAllAnnual(){
  const allYms=Array.from({length:12},(_,m)=>_annualSelYear*12+m);
  const allSel=allYms.every(ym=>_annualSel.has(ym));
  const prev=_annualSel.size;
  allYms.forEach(ym=>allSel?_annualSel.delete(ym):_annualSel.add(ym));
  if(_annualSel.size===0){_annualActionManual=false;}
  else if(prev===0||!_annualActionManual){_initAnnualDots();}
  openAnnualSettingsModal(_annualSelYear);
}
function applyAnnualSel(propagate){
  const keys=['dimRendu','rhRendu','ferRendu','hsRendu'];
  if(propagate&&_annualSel.size===1){
    const ym=Array.from(_annualSel)[0];
    keys.forEach(function(k){
      if(_annualActionState[k]===null)return;
      const newVal=_annualActionState[k];
      if(S.profile.settingsMonthly){
        Object.keys(S.profile.settingsMonthly).forEach(function(mStr){
          var m=Number(mStr);
          if(m>=ym&&S.profile.settingsMonthly[m]&&k in S.profile.settingsMonthly[m]){
            delete S.profile.settingsMonthly[m][k];
            if(!Object.keys(S.profile.settingsMonthly[m]).length)delete S.profile.settingsMonthly[m];
          }
        });
      }
      if(S.profile.settingsMonthlyHistory&&S.profile.settingsMonthlyHistory[k]){
        S.profile.settingsMonthlyHistory[k]=S.profile.settingsMonthlyHistory[k].filter(function(e){return e.ym<=ym;});
      }
      _smhSet(k,ym,newVal);
    });
  }else{
    if(!S.profile.settingsMonthly)S.profile.settingsMonthly={};
    _annualSel.forEach(function(ym){
      keys.forEach(function(k){
        if(_annualActionState[k]===null)return;
        if(!S.profile.settingsMonthly[ym])S.profile.settingsMonthly[ym]={};
        S.profile.settingsMonthly[ym][k]=_annualActionState[k];
      });
    });
  }
  _annualActionManual=false;_annualSel.clear();saveState();render();openAnnualSettingsModal(_annualSelYear);
}
function jumpToCurrentYear(){
  var cy=new Date().getFullYear();
  var dir=_annualSelYear>cy?'prev':_annualSelYear<cy?'next':null;
  _annualSel.clear();
  openAnnualSettingsModal(cy,dir);
}
function selectAnnualCol(key){
  _annualPending=null;
  const allYms=Array.from({length:12},(_,m)=>_annualSelYear*12+m);
  const allSel=allYms.every(ym=>_annualSel.has(ym));
  allYms.forEach(ym=>allSel?_annualSel.delete(ym):_annualSel.add(ym));
  openAnnualSettingsModal(_annualSelYear);
}
function openHSModal(mym){
  document.querySelectorAll('[onclick*="openHSModal"]').forEach(el=>el.classList.add('active'));_lockBodyScroll();
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const y=Math.floor(mym/12),m=mym%12;
  const MC=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const sett2=settingsForYM(mym);const useRendu2=sett2.hsRendu;
  const seenW=new Set();let rows='';
  let tot=0,totLow=0,totHigh=0,totRawLow=0,totRawHigh=0,totRam=0;
  const last=new Date(y,m+1,0).getDate();
  for(let dd=-6;dd<last;dd++){
    const date=new Date(y,m,1+dd);
    const mon=getMonday(date),mk=dk(mon);
    if(seenW.has(mk))continue;seenW.add(mk);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    if(sun.getFullYear()*12+sun.getMonth()!==mym)continue;
    const hsW=calcHSWeek(mon);if(hsW.surplus<=0)continue;
    const sett=settingsForYM(mym);const useRendu=sett.hsRendu;
    const prevMois=mon.getFullYear()*12+mon.getMonth()!==mym;
    const rowTotal=useRendu?hsW.rendusMin:(hsW.rawLow+hsW.rawHigh);
    const low=useRendu?hsW.rawLow*1.25:hsW.rawLow;
    const high=useRendu?hsW.rawHigh*1.5:hsW.rawHigh;
    tot+=rowTotal;totLow+=low;totHigh+=high;totRawLow+=hsW.rawLow;totRawHigh+=hsW.rawHigh;if(hsW.isRam)totRam+=7*60;
    rows+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">'      +'<span style="font-size:11px;color:var(--text2)">Semaine '+getISOWeek(mon)+(hsW.isRam?' <span style="font-size:10px;color:var(--text3)">(dont ramenée 7h)</span>':'')+'</span>'      +'<div style="display:flex;gap:16px;align-items:center">'      +(useRendu2?'<b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(hsW.rawLow+hsW.rawHigh)+'</b>':'')      +'<b style="font-size:11px;width:52px;text-align:right">'+fmtMin(rowTotal)+'</b>'      +'</div></div>';
  }
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Heures supp. – '+MC[m]+' '+y+'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0 4px"><span style="font-size:10px;color:var(--text3)"></span><div style="margin-left:auto;display:flex;gap:16px">'+(useRendu2?'<span style="font-size:11px;color:var(--text3);width:52px;text-align:right">brutes</span>':'')+'<span style="font-size:11px;color:var(--text3);width:52px;text-align:right">'+(useRendu2?'rendues':'payés')+'</span></div></div>'+(rows||'')
    +'<div class="sep"></div>'    +(useRendu2?(
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS≤8h'+'</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawLow)+'</b><b style="font-size:11px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totLow)+'</b></div></div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS>8h</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawHigh)+'</b><b style="font-size:11px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totHigh)+'</b></div></div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:0.5px solid var(--border)"><span style="font-size:15px;font-weight:600">Total</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:15px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawLow+totRawHigh)+'</b><b style="font-size:15px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(tot)+'</b></div></div>'
    ):(
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:15px;font-weight:600">HS≤8h'+'</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:15px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totRawLow)+'</b></div></div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:15px;font-weight:600">HS>8h</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:15px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totRawHigh)+'</b></div></div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:0.5px solid var(--border)"><span style="font-size:15px;font-weight:600">Total</span><b style="font-size:15px;text-align:right;color:var(--blue)">'+fmtMin(totRawLow+totRawHigh)+'</b></div>'
    ))    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

function openRestantsModal(){
  _lockBodyScroll();
  const{realAvail,prevEph}=calcSoldes();
  const ML=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  // Combine real + 12 future months
  const allReal=Object.keys(realAvail).map(Number).filter(ym=>realAvail[ym]>0).sort().slice(-6);
  const allPrev=Object.keys(prevEph).map(Number).filter(ym=>prevEph[ym]>0).sort().slice(0,3);
  const extendedUsedM=Object.keys(S.ephExtend||{}).map(Number).filter(ym=>ym<=TODAY_YM&&getExpYm(ym)>TODAY_YM);
  const yms=[...new Set([...allReal,...allPrev,...extendedUsedM])].sort().slice(-8);
  const maxV=Math.max(...yms.map(ym=>ym>TODAY_YM?(prevEph[ym]||0):(realAvail[ym]||0)),1);
  let rows='';
  const btnS='font-size:13px;padding:6px 11px;border:0.5px solid var(--border);border-radius:6px;background:var(--btn);cursor:pointer;min-width:46px;';
  yms.forEach(function(ym){
    const isFut=ym>TODAY_YM;
    const avail=isFut?(prevEph[ym]||0):(realAvail[ym]||0);
    const y=Math.floor(ym/12),m=ym%12;
    const expYm=getExpYm(ym),expY=Math.floor(expYm/12),expM=expYm%12;
    const isExp=expYm<TODAY_YM,ext=getEphExtensions(ym);
    const isAutoRepR=!!(S.autoExtend&&S.autoExtend[ym]>0);
    const baseExpYmR=ym+3+ext*3;
    const isWarnR=!isExp&&!isFut&&avail>0&&avail<=420&&baseExpYmR===TODAY_YM;
    const canAdd=!isExp&&!isFut&&ext<3;
    const canSub=!isExp&&!isFut&&ext>0;
    if(avail<=0&&!canSub)return;
    const moLeft=expYm-TODAY_YM;
    const autoNoteR=isAutoRepR?'↻ ':'';
    const expColor=isExp?'var(--rend-text)':(isWarnR)?'var(--rend-text)':'var(--text3)';
    const barColor=ephBarColor(moLeft,isExp);
    const pct=Math.round(avail/maxV*100);
    const minusBtn='<button onclick="undoEph('+ym+');openRestantsModal()" style="'+btnS+'color:'+(canSub?'var(--text3)':'var(--border2)')+';pointer-events:'+(canSub?'auto':'none')+'">-3m</button>';
    const plusBtn='<button onclick="reportEph('+ym+');openRestantsModal()" style="'+btnS+'color:'+(canAdd?'var(--text3)':'var(--border2)')+';pointer-events:'+(canAdd?'auto':'none')+'">+3m</button>';
    rows+='<div style="display:flex;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--border2);gap:6px'+(isExp?';opacity:.4':'')+'">'
      +'<div style="width:52px;flex-shrink:0"><div style="font-size:11px;color:var(--text'+(isExp||isFut?'3':'2')+')">'+MCs[m]+' '+String(y).slice(2)+'</div>'
      +'<div style="font-size:10px;color:'+expColor+'">'+autoNoteR+'→'+MCs[expM]+' '+String(expY).slice(2)+'</div></div>'
      +'<div style="flex:1"><div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+barColor+';opacity:'+(isFut?.5:1)+'"></div></div></div>'
      +'<div style="width:44px;text-align:right;font-size:13px;font-weight:600;color:'+(isFut?'var(--text3)':'var(--text)')+'">'+fmtMin(avail)+'</div>'
      +'<div style="display:flex;gap:2px">'+minusBtn+plusBtn+'</div>'
      +'</div>';
  });
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Heures de rendus</div>'
    +(rows||'<div style="font-size:11px;color:var(--text3)">Aucun rendu disponible.</div>')
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

function openMergedRenduCgModal(limit,tab){
  limit=limit||6;
  const _modalWasOpen=document.body.classList.contains('modal-open');
  if(!_modalWasOpen){_lockBodyScroll();_foldOpen={};}
  _rhCmpRefresh(); // tuiles Écart Rendus (Suivi, Rendus) à jour
  window._rcgRedraw=!!document.getElementById('rcc-wrap'); // même fenêtre redessinée (+/−, réglage) : pas de nouvelle animation
  // même fenêtre redessinée (Voir plus, +/−) : on garde la position de défilement
  var _rcgTop=window._rcgRedraw?((document.querySelector('#modal-root .sheet')||{}).scrollTop||0):0;
  // … sauf l'en-tête Congés, qui glisse de l'ancien état au nouveau (+/− CET, congés principaux)
  var _cgPrev=null;(function(){var rg=window._rcgRedraw&&window._rcgShown===1&&document.querySelector('#rcc-1 .cg-ring');if(!rg)return;
    var cu=_cgAnim.cur||{g:+rg.dataset.g,c:+rg.dataset.c,u:+rg.dataset.u};
    _cgPrev={g:cu.g,c:cu.c,u:cu.u,n:[].map.call(document.querySelectorAll('#rcc-1 .cg-n'),function(n){return +n.textContent||0;})};
  })();
  // === Rendus éphémères ===
  const{gen,realAvail,prevEph,preExpiry,matelas:matelasVal}=calcSoldes();
  const ML2=MCs;
  const genPast=Object.keys(gen).map(Number).filter(ym=>ym<=TODAY_YM).sort().slice(-24);
  const allPrev2=Object.keys(prevEph).map(Number).filter(ym=>prevEph[ym]>0).sort();
  const extM=Object.keys(S.ephExtend||{}).map(Number).filter(ym=>ym<=TODAY_YM&&getExpYm(ym)>=TODAY_YM);
  const actM=Object.keys(realAvail).map(Number).filter(ym=>ym<=TODAY_YM&&realAvail[ym]>0); // mois avec des heures encore à poser : toujours affichés
  const futureGen=Object.keys(gen).map(Number).filter(ym=>ym>TODAY_YM).sort();
  const allYms=[...new Set([...genPast,...allPrev2,...extM,...actM,...futureGen])].sort();
  const hasMore=allYms.length>limit;
  // Months with recoverable balance always shown; fill remaining slots by proximity
  const alwaysShow=new Set([...extM,...actM,...Object.keys(preExpiry).map(Number).filter(ym=>preExpiry[ym]>0)]);
  const proxRest=allYms.filter(ym=>!alwaysShow.has(ym)).sort(function(a,b){return Math.abs(a-TODAY_YM)-Math.abs(b-TODAY_YM);}).slice(0,Math.max(0,limit-alwaysShow.size));
  const yms=[...new Set([...alwaysShow,...proxRest])].sort(function(a,b){return a-b;});
  // En plus : le mois qui précède le premier affiché (déjà expiré le plus souvent, pour voir ce qui a été perdu ou utilisé)
  if(yms.length){const _pv=allYms.filter(function(ym){return ym<yms[0];}).pop();if(_pv!=null)yms.unshift(_pv);}
  const maxV=Math.max(...yms.map(ym=>{const o=gen[ym]?Object.values(gen[ym]).reduce(function(s,v){return s+v;},0):0;return Math.max(o,ym>TODAY_YM?(prevEph[ym]||0):(realAvail[ym]||0));}),1);
  // Reports d'après le dernier tableau Gestion : comparés mois par mois à ceux de l'app
  const _rhT=(function(){try{return _rhStored();}catch(e){return null;}})(),_rhRep={};
  const _rhEY=_rhT&&_rhT.edition?_rhT.edition.getFullYear()*12+_rhT.edition.getMonth():TODAY_YM;
  if(_rhT&&_rhT.lines){const _eY=_rhEY;_rhT.lines.forEach(function(l){if(l.ym<_eY)_rhRep[l.ym]=Math.max(_rhRep[l.ym]||0,l.rep||0);});}
  let rendRows='';
  const btnS='font-size:11px;padding:4px 8px;border:0.5px solid var(--border);border-radius:6px;background:var(--btn);cursor:pointer;min-width:36px;';
  yms.forEach(function(ym){
    const isFut=ym>TODAY_YM,avail=isFut?(prevEph[ym]||0):(realAvail[ym]||0);
    const y=Math.floor(ym/12),m=ym%12,expYm=getExpYm(ym),expY=Math.floor(expYm/12),expM=expYm%12;
    const isExp=expYm<TODAY_YM,ext=getEphExtensions(ym);
    const orig=(gen[ym]?Object.values(gen[ym]).reduce(function(s,v){return s+v;},0):0);
    if(orig<=0&&avail<=0&&!ext)return;
    const origPct=Math.round(orig/maxV*100);
    const barPct=Math.round(avail/maxV*100);
    const greenOpacity=isExp?'.15':isFut?'.35':'1';
    const blueOpacity=isFut?'.2':'.4';
    const isAutoRepM=!!(S.autoExtend&&S.autoExtend[ym]>0);
    const autoLevelM=(S.autoExtend&&S.autoExtend[ym])||0;
    const baseExpYmM=ym+3+ext*3;
    const isWarnM=!isExp&&!isFut&&avail>0&&avail<=420&&baseExpYmM===TODAY_YM;
    const availColor=isExp?'var(--text3)':isFut?'var(--text3)':(isWarnM)?'var(--rend-text)':'var(--text2)';
    const lostMinM=isExp?(preExpiry[ym]||0):0;
    const isExtendedM=ext>0;
    const _dl=function(e){return ML2[e%12]+' '+String(Math.floor(e/12)).slice(2);};
    // Expiration : simple date, ou pastille « date › » qui ouvre le menu des reports quand un report a un sens
    // (heures restantes ou report déjà posé, mois pas encore expiré). Le tableau Gestion : ✓ s'il donne la même date, ⚠ sinon.
    const rr=_rhRep[ym]!==undefined&&!isExp?_rhRep[ym]:-1,extT=getEphExtAt(ym,_rhEY); // reports à la date du tableau
    const _plan=!!(window._autoPlan||{})[ym],_auto=!!(S.autoExtend&&S.autoExtend[ym]>0);
    const _gr=_rhGraceYm(ym),_grace=_gr!=null&&_gr+1>ym+3+ext*3; // expirées mais encore comptées par le tableau Gestion : comme un report
    const _mLeft=expYm-TODAY_YM,_urg=!isExp&&!isFut&&avail>0&&_mLeft<=0&&!_plan;
    const _urgC=isExp?(lostMinM>0?'rgba(214,72,56,.75)':'transparent'):isFut?'rgba(150,180,100,.4)':_urg?'var(--orange)':'var(--rend-text)';
    let expLblM;
    // Heures perdues : le montant ouvre aussi le menu des reports (un report accordé après coup par le gestionnaire les rend)
    if(isExp)expLblM=lostMinM>0?'<button class="rep-pill lost" onclick="event.stopPropagation();_openRepMenu(this,'+ym+','+limit+',-1)">−'+fmtMin(lostMinM)+' <i class="ti ti-chevron-down"></i></button>':'<span style="color:var(--text3);padding-right:21px">'+_dl(expYm)+'</span>';
    else if(isFut||(avail<=0&&!ext)||(S.profile&&S.profile.exp12))expLblM='<span style="color:var(--text3);padding-right:21px">'+_dl(expYm)+'</span>';
    else{
      expLblM='<button class="rep-pill'+(ext>0||_grace?' on':'')+(_urg&&!ext?' urg':'')+(rr>=0&&rr!==extT?' warn':'')+'" onclick="event.stopPropagation();_openRepMenu(this,'+ym+','+limit+','+rr+')">'
        // emplacements fixes, alignés d'une ligne à l'autre : report auto | ✓ / ⚠ (tableau) | date | flèche
        +'<span class="rp-i">'+(_grace&&!_plan&&!_auto?'<i class="ti ti-table" title="gardées : encore dans le solde du tableau Gestion" style="font-size:13px;color:#9fdc8f"></i>':_plan||_auto?'<i class="ti ti-calendar-plus" title="'+(_plan?'report auto prévu':'report auto')+'" style="font-size:13px;color:#9fdc8f'+(_plan?';opacity:.8':'')+'"></i>':'')+'</span>'
        +'<span class="rp-t">'+(rr>=0?(rr===extT?'<span style="color:var(--green)">✓</span>':'<span style="color:var(--amber)">⚠</span>'):'')+'</span>'
        +'<span class="rp-d">'+_dl(expYm)+'</span><i class="ti ti-chevron-down"></i></button>'
        // pas d'annotation sous la date (le report et l'écart avec le tableau se voient dans la couleur et le menu)
        +'';
    }
    // Toucher la ligne : ouvre Variables du mois sur l'onglet Rendus (d'où viennent les heures), avec retour ici
    rendRows+='<div class="eph-urow clk'+(isExp?' expired':'')+(isFut?' fut':'')+'" onclick="_rdOpenMonth('+ym+')">'
      +'<div class="eph-u-mc">'+ML2[m]+' '+String(y).slice(2)+'</div>'
      +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;margin-right:14px">'
      +'<div class="eph-u-flow" style="display:flex;align-items:center;justify-content:space-between"><div>'+((S.monet||{})[ym]?'<span style="color:#e0b050;font-size:11px;margin-right:4px">€ '+fmtMin(S.monet[ym].min)+'</span>':'')+'<span style="color:var(--blue);font-size:11px">'+fmtMin(orig)+'</span><span style="color:var(--text3);font-size:11px;margin:0 2px">→</span><span style="font-weight:500;color:'+availColor+'">'+fmtMin(avail)+'</span>'+'</div></div>'
      // Une seule barre : longueur = heures acquises ; partie déjà utilisée en gris, reste coloré selon l'urgence
      // (vert : a le temps, y compris fin du mois prochain ; orange : expire ce mois-ci ; rouge : perdu ; pâle : mois à venir)
      +'<div class="eph-bw"><div class="eph-b2" style="width:'+origPct+'%;background:rgba(255,250,243,.16)"></div><div class="eph-b" style="width:'+(isExp&&lostMinM>0?Math.round(lostMinM/maxV*100):barPct)+'%;background:'+_urgC+'"></div></div>'
      +'</div>'
      +'<div class="eph-u-exp">'+expLblM+'</div>'
      +'</div>';
  });
  const moreBtn=hasMore?'<button id="rcg-more" onclick="window._rcgMoreTop=this.getBoundingClientRect().top;openMergedRenduCgModal('+(limit+4)+')" style="display:block;margin:8px auto 0;padding:6px 16px;font-size:13px;color:var(--text2);background:var(--btn);border:none;cursor:pointer;font-family:var(--font)">＋ Voir plus</button>':'';
  // === Congés ===
  const nowY=curY;
  const cet=getCETForYear(nowY);
  const cetTotal=getCET();
  // Only current year
  const soldeNow=getSoldeAnnee(nowY),usedNow=calcCongesUsedForYear(nowY);
  const ancNow=getCongesAnc(nowY);
  const _fr=getFractionnes(nowY);
  const cgWinter=_fr.cgWinter,cgAutumn=_fr.cgAutumn,fractForfait=_fr.forfait,fractBase=_fr.base,fractHiver=_fr.hiver,fractAutomne=_fr.automne,fractTotal=_fr.total;
  const flottants=getFlottants(nowY);
  // Effective total
  const soldeEffectif=soldeNow+ancNow+fractTotal+flottants;
  const restNow=Math.max(0,soldeEffectif-usedNow-cet);
  const _adjBtn=(fn,arg,lbl)=>`<button class="adj-pill" onclick="${fn}(${arg})">${lbl}</button>`; // pastille, comme les boutons de report
  const _rr=(label,val,color='var(--text2)',right='')=>`<div class="recap-row"><span style="color:var(--text3)">${label}</span><div style="display:flex;align-items:center;gap:6px">${right}<b style="color:${color};min-width:28px;text-align:right">${val}</b></div></div>`;
  const _adjRow=(label,val,fn,arg)=>`<div class="recap-row"><span style="color:var(--text3)">${label}</span><div style="display:flex;align-items:center;gap:6px">${_adjBtn(fn,arg+',-1','−')}${_adjBtn(fn,arg+',1','+')}<b style="min-width:26px;text-align:right;color:var(--green)">${val} j</b></div></div>`;
  const _card=(t,body)=>`<div class="ucard-t" style="margin:10px 0 4px">${t}</div>${body}`; // sections du dépliant « Droits de l'année »
  const _toggleStyle=fractForfait?'background:var(--rend-text);color:#fff;border-color:var(--rend-text)':'background:transparent;color:var(--text3);border-color:var(--border)';
  const _per=(t)=>`<span style="font-style:italic;font-size:10px;color:var(--text3)">${t}</span>`;
  const cgSection=
    _card('Principaux',_adjRow('Congés principaux',soldeNow,'adjSoldeAnnee',nowY)
    +_rr('Jours d’ancienneté',ancNow+' j','var(--green)'))
    +_card('Fractionnés',`<div class="recap-row"><span style="color:var(--text3)">Forfait ancienneté</span><b style="color:${fractForfait?'var(--green)':'var(--text3)'}">${fractBase} j</b></div>`
    +`<div class="recap-row"><span style="color:var(--text3)">Hiver ${_per('15/01–15/03')} <span style="color:${cgWinter>=5?'var(--rend-text)':'var(--red)'};font-size:10px">${cgWinter}/5 j</span></span><b style="color:${fractHiver?'var(--green)':'var(--text3)'};">${fractHiver} j</b></div>`
    +`<div class="recap-row"><span style="color:var(--text3)">Automne ${_per('15/09–30/11')} <span style="color:${cgAutumn>=5?'var(--rend-text)':'var(--red)'};font-size:10px">${cgAutumn}/5 j</span></span><b style="color:${fractAutomne?'var(--green)':'var(--text3)'};">${fractAutomne} j</b></div>`)
    +_card('Flottants',`<div class="recap-row"><span style="color:var(--text3)">Fériés dimanche</span><b style="color:${flottants>0?'var(--green)':'var(--text3)'}">${flottants} j</b></div>`)
    +_card('Total',`<div class="recap-row"><span style="color:var(--text3)">Droits de l’année</span><b style="color:var(--text)">${soldeEffectif} j</b></div>`
    +_rr('Mis en CET',cet+' j','var(--amber)',_adjBtn('adjCET','-1,'+nowY,'−')+_adjBtn('adjCET','1,'+nowY,'+'))
    +(cetTotal!==cet?_rr('CET total',cetTotal+' j','var(--text2)'):''));
  // détail des droits toujours affiché (plus de dépliant)
  const cgFold='<div class="fold"><div class="fb" style="border-top:none;padding-top:10px">'+cgSection+'</div></div>';
  // En-tête : anneau des droits de l'année (posés, mis en CET, restants) et chiffres en grand, comme les autres onglets
  // Anneau : restants en vert depuis le haut (sens horaire), puis CET, puis posés, bouts arrondis comme dans le Suivi ;
  // à l'ouverture, le vert part du solde total et se réduit (animation CSS, comme les anneaux du Suivi)
  const _cgRing=(function(){var T=Math.max(1,soldeEffectif),fu=Math.min(1,usedNow/T),fc=Math.min(1-fu,cet/T),fg=Math.max(0,1-fu-fc),C=2*Math.PI*27,G=_cgGeo(fg,fc,fu);
    var arc=function(k,col){var g=G[k];return '<circle cx="34" cy="34" r="27" fill="none" stroke="'+col+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+C.toFixed(2)+' '+C.toFixed(2)+'" class="cg-arc" data-k="'+k+'" style="transform-origin:34px 34px;transform:rotate('+g.r.toFixed(2)+'deg);stroke-dashoffset:'+(C-g.L).toFixed(2)+'px;stroke-width:'+g.w.toFixed(2)+';opacity:'+g.o+'"/>';};
    return '<svg class="cg-ring" data-g="'+fg+'" data-c="'+fc+'" data-u="'+fu+'" width="68" height="68" viewBox="0 0 68 68" style="transform:rotate(-90deg);flex-shrink:0"><circle cx="34" cy="34" r="27" fill="none" stroke="var(--border2)" stroke-width="8"/>'
      +arc('g','var(--green)')+arc('c','var(--amber)')+arc('u','var(--red)')+'</svg>';})();
  const _cgCell=(lbl,val,col,from)=>'<div class="hd3-c"><span>'+lbl+'</span><b style="color:'+col+'"><span class="cg-n" data-n="'+val+'" data-f="'+(from||0)+'">'+val+'</span> j</b></div>';
  const cgSoldeHeader=''
    +'<div class="cg-hd hd3">'
    +_cgRing
    +'<div class="hd3-cs">'
    +_cgCell('restants',restNow,restNow>0?'var(--green)':'var(--text3)',soldeEffectif)
    +_cgCell('posés',usedNow,usedNow>0?'var(--red)':'var(--text3)')
    +_cgCell('CET '+nowY,cet,cet>0?'var(--amber)':'var(--text3)')
    +'</div></div>';
  // mois vu : celui de l'accueil, ou celui choisi avec ‹ › en haut de l'onglet Rendus
  const _viewedYM=window._rgYM!=null?window._rgYM:(typeof curY!=='undefined'&&typeof curM!=='undefined')?curY*12+curM:TODAY_YM;
  const {total:dispoMois,stockActif,reserved,reservedMonths,afterStep1,reservedDetail,genSnapshot}=calcTrueDispo(_viewedYM);
  try{if(_histClean())saveState();}catch(e){}
  // Suivi : toujours aujourd'hui (année en cours), quel que soit le mois affiché
  const recapRows=_suiviSimple(NOW.getFullYear())+_ctImports();
  const dispoColor=dispoMois<=0?'var(--red)':dispoMois<120?'var(--amber)':'var(--rend-text)';
  const _as1Map={};afterStep1.forEach(function(e){_as1Map[e.ym]=e.amount;});
  const _rdByYm={};reservedDetail.forEach(function(e){_rdByYm[e.poseYm]=(_rdByYm[e.poseYm]||0)+e.amount;});
  const _hasRd=Object.keys(_rdByYm).length>0;
  const totalBrut=genSnapshot.reduce(function(s,e){return s+e.amount;},0);
  const consumedByPast=Math.max(0,totalBrut-stockActif);
  const _pPast=totalBrut>0?consumedByPast/totalBrut*100:0;
  const _pFut=totalBrut>0?reserved/totalBrut*100:0;
  const _pDispo=100-_pPast-_pFut;
  const _thS='padding:6px 8px;font-size:10px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;border-bottom:0.5px solid var(--border2)';
  const _tableRows=genSnapshot.map(function(e){
    const actif=_as1Map[e.ym]||0,consumed=e.amount-actif;
    const ey=Math.floor(e.expYm/12),em=e.expYm%12;
    return '<tr style="border-bottom:0.5px solid var(--border2)">'
      +'<td style="padding:5px 8px;color:var(--text2);font-weight:500;white-space:nowrap">'+MCs[e.ym%12]+' '+String(Math.floor(e.ym/12)).slice(2)+'</td>'
      +'<td style="padding:5px 8px;font-size:10px;color:var(--text3);white-space:nowrap">'+MCs[em]+' '+String(ey).slice(2)+'</td>'
      +'<td style="padding:5px 8px;text-align:right;white-space:nowrap">'+fmtMin(e.amount)+'</td>'
      +'<td style="padding:5px 8px;text-align:right;color:'+(consumed>0?'var(--red)':'var(--text3)')+';white-space:nowrap">'+(consumed>0?'−'+fmtMin(consumed):'—')+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-weight:'+(actif>0?'600':'400')+';color:'+(actif>0?'var(--rend-text)':'var(--text3)')+';white-space:nowrap">'+fmtMin(actif)+'</td>'
      +'</tr>';
  }).join('')||'<tr><td colspan="5" style="font-size:10px;color:var(--text3);padding:6px 0">Aucune heure active</td></tr>';
  const _rdTableRows=Object.keys(_rdByYm).map(Number).sort().map(function(ym){
    return '<tr style="border-bottom:0.5px solid var(--border2)">'
      +'<td style="padding:5px 8px;color:var(--text2);font-weight:500;white-space:nowrap">'+MCs[ym%12]+' '+String(Math.floor(ym/12)).slice(2)+'</td>'
      +'<td style="padding:5px 8px;text-align:right;color:var(--red);font-weight:500;white-space:nowrap">−'+fmtMin(_rdByYm[ym])+'</td>'
      +'</tr>';
  }).join('');
  const dispoDetailHtml=''
    +'<div id="dispo-detail-panel" style="display:none;margin-top:4px;padding:10px;background:var(--bg3);border-radius:var(--r);border:0.5px solid var(--border)">'
    +(totalBrut>0
      ?'<div style="margin-bottom:12px">'
       +'<div style="display:flex;border-radius:6px;overflow:hidden;height:20px;background:var(--bg2)">'
       +(consumedByPast>0?'<div style="width:'+_pPast.toFixed(1)+'%;background:var(--red);opacity:.3"></div>':'')
       +'<div style="width:'+_pDispo.toFixed(1)+'%;min-width:4px;background:var(--rend-text);opacity:.65"></div>'
       +(reserved>0?'<div style="width:'+_pFut.toFixed(1)+'%;background:var(--amber);opacity:.4"></div>':'')
       +'</div>'
       +'<div style="display:flex;margin-top:4px;font-size:10px">'
       +(consumedByPast>0?'<div style="width:'+_pPast.toFixed(1)+'%;color:var(--text3);overflow:hidden;white-space:nowrap">−'+fmtMin(consumedByPast)+'</div>':'')
       +'<div style="width:'+_pDispo.toFixed(1)+'%;text-align:center;font-weight:600;color:var(--rend-text)">'+fmtMin(dispoMois)+'</div>'
       +(reserved>0?'<div style="width:'+_pFut.toFixed(1)+'%;text-align:right;color:var(--amber);overflow:hidden;white-space:nowrap">−'+fmtMin(reserved)+'</div>':'')
       +'</div>'
       +'<div style="display:flex;margin-top:1px;font-size:8px;color:var(--text3)">'
       +(consumedByPast>0?'<div style="width:'+_pPast.toFixed(1)+'%;overflow:hidden;white-space:nowrap">← passés</div>':'')
       +'<div style="width:'+_pDispo.toFixed(1)+'%;text-align:center;color:var(--rend-text)">dispo '+MC[_viewedYM%12]+'</div>'
       +(reserved>0?'<div style="width:'+_pFut.toFixed(1)+'%;text-align:right;overflow:hidden;white-space:nowrap">futurs →</div>':'')
       +'</div>'
       +'</div>'
      :'')
    +'<div style="font-size:10px;color:var(--text3);line-height:1.9;margin-bottom:8px">'
+'rouge = consommées par les rendus passés<br>'
+'orange = réservées pour les rendus futurs<br>'
+'vert = dispo ce mois · non utilisé → reporté sur les rendus futurs'
+'</div>'
    +'<div style="border-top:0.5px solid var(--border2);padding-top:10px">'
    +'<div style="background:var(--bg);border-radius:6px;border:0.5px solid var(--border2);overflow:hidden;margin-bottom:8px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:10px">'
    +'<thead><tr>'
    +'<th style="'+_thS+';text-align:left">Mois</th>'
    +'<th style="'+_thS+';text-align:left">Expire</th>'
    +'<th style="'+_thS+';text-align:right">Généré</th>'
    +'<th style="'+_thS+';text-align:right">−Posés</th>'
    +'<th style="'+_thS+';text-align:right">Reste</th>'
    +'</tr></thead>'
    +'<tbody>'+_tableRows+'</tbody>'
    +'<tfoot><tr>'
    +'<td colspan="4" style="padding:6px 8px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;background:var(--bg2);border-top:0.5px solid var(--border2)">Total disponible</td>'
    +'<td style="padding:6px 8px;text-align:right;font-weight:700;background:var(--bg2);border-top:0.5px solid var(--border2)">'+fmtMin(stockActif)+'</td>'
    +'</tr></tfoot>'
    +'</table>'
    +'</div>'
    +(_hasRd
      ?'<div style="background:var(--bg);border-radius:6px;border:0.5px solid var(--border2);overflow:hidden;margin-bottom:8px">'
       +'<table style="width:100%;border-collapse:collapse;font-size:10px">'
       +'<thead><tr>'
       +'<th style="'+_thS+';text-align:left">Rendu à venir</th>'
       +'<th style="'+_thS+';text-align:right">Réservé</th>'
       +'</tr></thead>'
       +'<tbody>'+_rdTableRows+'</tbody>'
       +'<tfoot><tr>'
       +'<td style="padding:6px 8px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;background:var(--bg2);border-top:0.5px solid var(--border2)">Déjà attribué</td>'
       +'<td style="padding:6px 8px;text-align:right;color:var(--red);font-weight:700;background:var(--bg2);border-top:0.5px solid var(--border2)">−'+fmtMin(reserved)+'</td>'
       +'</tr></tfoot>'
       +'</table>'
       +'</div>'
      :'')
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:0.5px solid var(--border2);margin-bottom:10px">'
    +'<span style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em">= Dispo '+MC[_viewedYM%12]+'</span>'
    +'<span style="font-size:15px;font-weight:700;color:'+dispoColor+'">'+fmtMin(dispoMois)+'</span>'
    +'</div>'
    +'<div style="border-top:0.5px solid var(--border2);padding-top:8px">'
    +'<div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Étapes du calcul</div>'
    +'<ol style="margin:0;padding-left:16px;font-size:10px;color:var(--text3);line-height:1.9">'
    +'<li>Heures générées par mois (colonne Généré)</li>'
    +'<li>Rendus passés : consomment d’abord les heures les plus anciennes, comme le gestionnaire (colonne −Posés)</li>'
    +'<li>Ce qui reste = stock actif (colonne Reste, total ci-dessus)</li>'
    +'<li>Rendus futurs : réservent ce qu\'ils ne peuvent couvrir avec du stock généré plus tard</li>'
    +'<li>Ce qui reste = le dispo</li>'
    +'</ol>'
    +'</div>'
    +'</div>'
    +'</div>';
  // ── Encadré « Comment c'est calculé ? » : le dispo en 3 lignes, avec détail dépliable ──
  const _MFd=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const _MSd=MCs;
  const _vm=_MFd[_viewedYM%12],_enVm='en '+_vm,_jusquVm='jusqu’en '+_vm;
  const _ymLbl=function(ym){return _MSd[ym%12]+' '+String(Math.floor(ym/12)).slice(2);};
  const _det=function(rows){return rows.length?'<div class="dx-det">'+rows.join('')+'</div>':'';};
  const _detRow=function(l,v){return '<div class="dx-dr"><span>'+l+'</span><span>'+v+'</span></div>';};
  const _pastRows=genSnapshot.map(function(e){const c=e.amount-(_as1Map[e.ym]||0);return c>0?_detRow('sur les heures acquises en '+_ymLbl(e.ym),'−'+fmtMin(c)):'';}).filter(Boolean);
  const _acqRows=genSnapshot.map(function(e){const ey=e.expYm;return _detRow('acquises en '+_ymLbl(e.ym)+' <span style="opacity:.6">· valables jusqu’à fin '+_ymLbl(ey)+'</span>',fmtMin(e.amount));});
  const _futRows=Object.keys(_rdByYm).map(Number).sort().map(function(ym){return _detRow('rendus posés en '+_ymLbl(ym),'−'+fmtMin(_rdByYm[ym]));});
  const _dxLine=function(label,val,color,rows,sign){
    const has=rows.length>0;
    return '<div class="dx-line'+(has?' dx-clk':'')+'"'+(has?' onclick="this.classList.toggle(\'open\')"':'')+'>'
      // Sans signe : le chevron prend la place du signe, à gauche ; sinon il suit le libellé (avant le sous-titre)
      +'<div class="dx-l"><span>'+(sign?'<b class="dx-sign">'+sign+'</b>':'<b class="dx-sign">'+(has?'<i class="ti ti-chevron-right dx-chev"></i>':'')+'</b>')
      +(sign&&has?(label.indexOf('<span class="dx-sub">')>=0?label.replace('<span class="dx-sub">',' <i class="ti ti-chevron-right dx-chev"></i><span class="dx-sub">'):label+' <i class="ti ti-chevron-right dx-chev"></i>'):label)
      +'</span><b style="color:'+color+'">'+val+'</b></div>'
      +_det(rows)+'</div>';
  };
  const _fmtDec=function(min){return (min/60).toFixed(2).replace('.',',')+' h';};
  const _dateFr=NOW.getDate()+'/'+String(NOW.getMonth()+1).padStart(2,'0');
  const _futRendus={};
  Object.keys(S.conges||{}).filter(function(k){return S.conges[k]==='rend'&&k>dk(NOW);}).forEach(function(k){const d=new Date(k+'T12:00:00'),ym=d.getFullYear()*12+d.getMonth();_futRendus[ym]=(_futRendus[ym]||0)+getDur(d);});
  const _futRendusRows=Object.keys(_futRendus).map(Number).sort().map(function(ym){return _detRow('rendus posés en '+_ymLbl(ym),fmtMin(_futRendus[ym]));});
  let _calcLines;
  if(_viewedYM===TODAY_YM){
    // Mois en cours : on part du même chiffre que le tableau RH (« Cumul soldes »)
    const _rh=calcSoldeRH();
    const _promis=Math.max(0,_rh.stockAll-dispoMois);
    const _rhRows=_rh.rows.map(function(r){return _detRow(_MFd[r.ym%12]+' '+String(Math.floor(r.ym/12)).slice(2)+' <span style="opacity:.6">· '+fmtMin(r.acquis)+' acquises'+(r.conso>0?' − '+fmtMin(r.conso)+' consommées':'')+' · valables jusqu’à fin '+_ymLbl(r.expYm)+'</span>',fmtMin(r.reste));});
    _calcLines=''
      +_dxLine('Solde au '+_dateFr+'',fmtMin(_rh.solde),'var(--text)',_rhRows,'')
      +(_rh.courant>0?_dxLine('Acquises en '+_vm+'','+'+fmtMin(_rh.courant),'var(--rend-text)',[],'+'):'')
      +_dxLine('Déjà promises aux rendus à venir',_promis>0?'−'+fmtMin(_promis):'—',_promis>0?'var(--amber)':'var(--text3)',_futRendusRows.length?_futRendusRows.concat(['<div class="dx-dr" style="opacity:.8"><span>une partie sera couverte par les heures acquises d’ici là</span></div>']):[],'−');
  }else{
    // Autre mois : prévision à partir des heures valables ce mois-là
    _calcLines=''
      +_dxLine('Heures acquises encore valables '+_enVm,fmtMin(totalBrut),'var(--text)',_acqRows,'')
      +_dxLine('Rendus posés '+_jusquVm,consumedByPast>0?'−'+fmtMin(consumedByPast):'—',consumedByPast>0?'var(--red)':'var(--text3)',_pastRows,'−')
      +_dxLine('Promises à des rendus posés plus tard',reserved>0?'−'+fmtMin(reserved):'—',reserved>0?'var(--amber)':'var(--text3)',_futRows,'−');
  }
  const dispoExplainHtml=''
    +_calcLines
    // « = Restantes » et, à côté, un petit bouton Écart Rendus
    +'<div style="display:flex;gap:6px;align-items:stretch;margin-top:8px">'
    +'<div class="dx-tile" style="flex:1;min-width:0;margin-top:0;border-radius:999px;padding-left:18px;padding-right:18px"><span><b class="dx-sign">=</b>Restantes'+(_viewedYM===TODAY_YM?'':' '+_enVm)+'</span><b style="color:'+dispoColor+'">'+fmtMin(dispoMois)+'</b></div>'
    +(function(){const c=S.profile&&S.profile.rhCmp,bs='flex:0 0 auto;min-width:0;padding:6px 16px;gap:1px;border-radius:999px';if(!c)return '<button class="dx-mini dx-mbtn" style="'+bs+'" onclick="event.stopPropagation();rhOpenFrom(\'rendus\')"><span style="font-size:11px">Écart Rendus</span><span style="font-size:10px">importer</span></button>';
      const e=-c.d,ok=e>-2,txt=Math.abs(e)<2?'=':(e>0?'+':'−')+fmtMin(Math.abs(e)); // positif = le tableau laisse plus d'heures que l'app
      return '<button class="dx-mini dx-mbtn" style="'+bs+'" onclick="event.stopPropagation();rhOpenFrom(\'rendus\')"><span style="font-size:11px">Écart Rendus</span><b style="font-size:15px;color:'+(ok?'var(--green)':'var(--red)')+'">'+txt+'</b></button>';})()
    +'</div>';
  let _expAmt=0,_repAmt=0;
  // heures d'un report automatique prévu : libres « sous réserve » (pas encore accordé)
  const _resAmt=Math.max(0,_withProj(function(){return calcTrueDispo(_viewedYM).total;})-dispoMois);
  // Mois déjà expirés : realAvail est à 0, on prend ce qui restait juste avant l'expiration (preExpiry)
  const _avAt=function(ym){return getExpYm(ym)<TODAY_YM?(preExpiry[ym]||0):(realAvail[ym]||0);};
  [...new Set(Object.keys(realAvail).concat(Object.keys(preExpiry)))].map(Number).forEach(function(ym){
    const av=_avAt(ym);
    if(av>0){
      if(getExpYm(ym)===_viewedYM){if((window._autoPlan||{})[ym])_repAmt+=av;else _expAmt+=av;} // déjà reportées jusqu'à ce mois-ci : elles expirent aussi
      else if(getBaseExpYm(ym)===_viewedYM&&getEphExtensions(ym)>0&&getExpYm(ym)>=TODAY_YM){_repAmt+=av;}
    }
  });
  const _expireCol=_expAmt>0
    ?'<div style="width:0.5px;background:var(--border2)"></div><div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Expire '+MC[_viewedYM%12]+'</div><div style="font-size:15px;font-weight:600;color:var(--red)">'+fmtMin(_expAmt)+'</div></div>'
    :_repAmt>0
      ?'<div style="width:0.5px;background:var(--border2)"></div><div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Report '+MC[_viewedYM%12]+'</div><div style="font-size:15px;font-weight:600;color:var(--green)">'+fmtMin(_repAmt)+'</div></div>'
      :'<div style="width:0.5px;background:var(--border2)"></div><div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Expire '+MC[_viewedYM%12]+'</div><div style="font-size:15px;font-weight:600;color:var(--text3)">—</div></div>';
  const _mi=function(l,v,c){return '<div class="dx-mini"><span>'+l+'</span><b style="color:'+c+'">'+v+'</b></div>';};
  const _expTxt=_expAmt>0?_mi((_viewedYM<TODAY_YM?'Perdu fin ':'Expire en ')+_vm,fmtMin(_expAmt),'var(--red)'):_repAmt>0?_mi('Reporté en '+_vm,fmtMin(_repAmt),'var(--green)'):_mi('Expire en '+_vm,'—','var(--text3)');
  const _hdC=function(l,v,c){return '<div class="hd3-c"><span>'+l+'</span><b style="color:'+c+'">'+v+'</b></div>';};
  // Nouvel utilisateur sans tableau Gestion ni solde de départ : le 0 affiché ne veut rien dire, on le dit
  const _pf=S.profile||{},_noStart=!(_pf.rhTable||_pf.rhImportedAt)&&!(_pf.ephSolde>0)&&!(_pf.matelas>0);
  const _noStartHtml=_noStart?'<div class="rv-ok" style="margin-bottom:10px;align-items:flex-start"><i class="ti ti-info-circle" style="color:var(--blue);margin-top:1px"></i><div style="flex:1">Aucun solde de départ : les heures ci-dessous partent de zéro. Importez votre tableau Gestion pour partir de vos vraies heures.'
    +'<button class="mb pri" style="display:block;margin-top:8px;padding:7px 14px;font-size:13px" onclick="event.stopPropagation();rhOpenFrom(\'rendus\')">Importer le tableau Gestion</button></div></div>':'';
  const dispoBoxHtml=_noStartHtml+'<div class="hd3"><div class="hd3-cs">'
    +_hdC(_viewedYM===TODAY_YM?'libres à poser':'libres '+_enVm,fmtMin(dispoMois)+(_resAmt>1?'<small style="display:block;font-size:11px;font-weight:500;color:var(--amber);margin-top:1px">+'+fmtMin(_resAmt)+' sous réserve</small>':''),dispoColor)
    +(_expAmt>0?_hdC((_viewedYM<TODAY_YM?'perdu fin ':'expire en ')+_MSd[_viewedYM%12],fmtMin(_expAmt),'var(--red)'):_repAmt>0?_hdC('reporté en '+_MSd[_viewedYM%12],fmtMin(_repAmt),'var(--green)'):_hdC('expire en '+_MSd[_viewedYM%12],'—','var(--text3)'))
    +_hdC('matelas',matelasVal>0?fmtMin(matelasVal):'—',matelasVal>0?'var(--blue)':'var(--text3)')
    +'</div></div>'
    // Détail du calcul : replié, le résultat reste visible dans l'en-tête du dépliant
    +_fold('fold-calc','','var(--rend-text)',_viewedYM===TODAY_YM?'Détail du calcul':'Prévision pour '+_vm+' '+Math.floor(_viewedYM/12),'solde, heures acquises, rendus à venir',fmtMin(dispoMois),'<div style="font-size:13px;padding-top:8px">'+dispoExplainHtml+'</div>');
  const rendSoldeHeader=''
    +'<div style="display:flex;gap:8px;padding:8px 10px;background:var(--bg3);border-radius:var(--r);border:0.5px solid var(--border)">'
    +(matelasVal>0
      ?'<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Matelas</div><div style="font-size:15px;font-weight:600;color:var(--blue)">'+fmtMin(matelasVal)+'</div></div>'
       +'<div style="width:0.5px;background:var(--border2)"></div>'
      :'')
    +'<div style="flex:1;text-align:center">'
    +'<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Dispo '+MC[_viewedYM%12]+'</div>'
    +'<div style="display:flex;align-items:center;justify-content:center;gap:5px">'
    +'<div style="font-size:15px;font-weight:600;color:'+dispoColor+'">'+fmtMin(dispoMois)+'</div>'
    +'<button onclick="var d=document.getElementById(\'dispo-detail-panel\');d.style.display=d.style.display===\'none\'?\'block\':\'none\'" style="background:transparent;border:none;color:var(--text3);font-size:15px;cursor:pointer;padding:0;line-height:1;-webkit-tap-highlight-color:transparent;vertical-align:middle">ⓘ</button>'
    +'</div>'
    +'</div>'
    +_expireCol
    +'</div>';
  const tabBtnS='flex:1;padding:8px 4px;font-size:13px;border:none;cursor:pointer;border-radius:8px;text-align:center;';
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay"'+(_modalWasOpen?' style="animation:none"':'')+' onclick="if(event.target===this)closeModal()"><div class="sheet smod'+(_isPhone()?' tabmod sv-one" data-title="'+_SV_T[tab||0]+'"':'"')+(_modalWasOpen?' style="animation:none"':'')+'>'
    +'<div class="sh"></div>'
    +'<div class="stabs-row">'
    +'<div class="stabs-sp"></div>'
    +'<div class="stabs-bar">'
    +'<div id="rcp-pill" class="seg-pill" style="position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 10px) / 3);border-radius:8px;background:var(--bg2);box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s ease;pointer-events:none;z-index:-1"></div>'
    +'<button id="rcp-2" onclick="rcgTab(2)" style="'+tabBtnS+'background:transparent;font-weight:400;color:var(--seg-tx)">Suivi</button>'
    +'<button id="rcp-0" onclick="rcgTab(0)" style="'+tabBtnS+'background:transparent;font-weight:600;color:var(--seg-tx-on)">Rendus</button>'
    +'<button id="rcp-1" onclick="rcgTab(1)" style="'+tabBtnS+'background:transparent;font-weight:400;color:var(--seg-tx)">Congés</button>'
    +'</div>'
    +'<button class="sh-x" onclick="closeModal()"><i class="ti ti-x"></i></button>'
    +'</div>'
    +'<div class="stabs-body">'
    +'<div id="rcc-wrap" style="display:grid">'
    +'<div id="rcc-0" style="grid-area:1/1">'
    +'<div class="rg-mo"><button aria-label="Mois précédent" onclick="_rgStep(-1)"'+(_viewedYM<=TODAY_YM-24?' disabled':'')+'><i class="ti ti-chevron-left"></i></button>'
    +'<span>'+_MFd[_viewedYM%12].replace(/^./,function(c){return c.toUpperCase();})+' '+Math.floor(_viewedYM/12)+(_viewedYM!==TODAY_YM?'<button class="rg-now" onclick="_rgStep(0)">Ce mois-ci</button>':'')+'</span>'
    +'<button aria-label="Mois suivant" onclick="_rgStep(1)"'+(_viewedYM>=TODAY_YM+18?' disabled':'')+'><i class="ti ti-chevron-right"></i></button></div>'
    +dispoBoxHtml
    +(rendRows?'<div class="ucard"><div class="ucard-t">Heures par mois d’acquisition</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px"><span style="padding-left:54px">acquises → restantes</span><span style="padding-right:21px">expirent</span></div>'+rendRows+moreBtn+'</div>':'<div class="ucard" style="font-size:13px;color:var(--text3)">Aucun rendu disponible.</div>')
    +'<div style="height:8px"></div>'+_fold('fold-annee','','var(--text2)','Année '+NOW.getFullYear(),'heures de rendus mois par mois','',_cptHtml())
    +'</div>'
    +'<div id="rcc-1" style="grid-area:1/1;visibility:hidden;pointer-events:none">'
    +cgSoldeHeader
    +cgFold
    +'</div>'
    +'<div id="rcc-2" style="grid-area:1/1;visibility:hidden;pointer-events:none">'+recapRows+'</div>'
    +'</div>'
    +'</div>'
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
  var _rd=window._rcgRedraw&&window._rcgShown===(tab||0);rcgTab(tab||0);if(_rd&&_rcgTop){var _rsh=document.querySelector('#modal-root .sheet');if(_rsh)_rsh.scrollTop=_rcgTop;}
  // Voir plus : la fenêtre descend d'autant que les lignes ajoutées, le bouton reste sous le doigt
  if(window._rcgMoreTop!=null){var _mt=window._rcgMoreTop,_mb=document.getElementById('rcg-more'),_msh=document.querySelector('#modal-root .sheet');window._rcgMoreTop=null;
    if(_mb&&_msh)_msh.scrollTop+=_mb.getBoundingClientRect().top-_mt;}if(_rd&&_cgPrev&&(tab||0)===1)_cgAnim(_cgPrev);if((tab||0)===2&&!_rd)_cptAnim(document.getElementById('cpt-card'));
  var _sh=document.querySelector('#modal-root .sheet');
  if(_sh&&!_sh.classList.contains('sv-one')){ // téléphone : une sous-page par onglet, pas de glisser entre eux
    var _sx=0,_sy=0;
    _sh.addEventListener('touchstart',function(e){_sx=e.touches[0].clientX;_sy=e.touches[0].clientY;},{passive:true});
    _sh.addEventListener('touchend',function(e){
      var dx=e.changedTouches[0].clientX-_sx,dy=Math.abs(e.changedTouches[0].clientY-_sy);
      if(Math.abs(dx)<50||dy>80)return;
      var cur=0;for(var i=0;i<3;i++){var t=document.getElementById('rcc-'+i);if(t&&t.style.visibility!=='hidden')cur=i;}
      var pos=_RCG_ORDER.indexOf(cur),nx=_RCG_ORDER[dx<0?Math.min(2,pos+1):Math.max(0,pos-1)];if(nx!==cur)rcgTab(nx);
    },{passive:true});
  }
}


function openSuiviRoot(){
  if(!_isPhone())return openMergedRenduCgModal(6,window._rcgShown??2);
  // retour depuis une sous-page (ou page redessinée) : la courbe ne se redessine pas
  var _noAnim=!!(window._tbPop||document.body.classList.contains('tb-sub')||document.getElementById('sv-root'));
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  try{_rhCmpRefresh();}catch(e){}
  var y=NOW.getFullYear(),MF=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var cell=function(l,v,c){return '<span class="svr-k"><small>'+l+'</small><b style="color:'+c+'">'+v+'</b></span>';};
  var ok='var(--green)',am='var(--amber)',mu='var(--text3)';
  var block=function(i,ic,icc,t,cells,lines,extra){return '<div class="svr-b" role="button" onclick="openMergedRenduCgModal(6,'+i+')"><span class="svr-h"><span class="svr-i" style="color:'+icc+'"><i class="ti '+ic+'"></i></span><b>'+t+'</b><i class="ti ti-chevron-right svr-ch"></i></span>'
    +'<span class="svr-ks">'+cells.join('')+'</span>'+(extra||'')+(lines||[]).filter(Boolean).map(function(l){return '<span class="svr-l">'+l+'</span>';}).join('')+'</div>';};
  // Contrôle : bulletins, tableau Gestion, règles de travail
  var nb=0,bb=0;Object.keys(S.bulletins||{}).forEach(function(k){nb++;var c;try{c=_bulCompare(S.bulletins[k]);}catch(e){return;}if(c.status==='ecart'&&!_bulIgn(+k,c))bb+=(c.badList&&c.badList.length)||1;});
  var rc=S.profile&&S.profile.rhCmp,nr=0;try{var RS=_ruleScanNow();nr=RS.hard.length+RS.rest.length+RS.streak.length;}catch(e){}
  var edT=rc&&rc.ed?new Date(rc.ed+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
  // les problèmes les plus importants (dans l'ordre de la page Contrôle) : trois au plus
  var PB=[];try{PB=_suiviFacts(rc,S.profile&&S.profile.rhTable,_bulEcart(),1)||[];}catch(e){}
  var pbH='<span class="svr-pb">'+(PB.length?PB.slice(0,3).map(function(x){return '<span><i class="ti '+x.ic+'" style="color:'+x.col+'"></i>'+x.t+'</span>';}).join('')+(PB.length>3?'<em>et '+(PB.length-3)+' autre'+(PB.length>4?'s':'')+'</em>':'')
    :'<span style="color:var(--green)"><i class="ti ti-circle-check"></i>Rien à signaler</span>')+'</span>';
  var ctrl=block(2,'ti-checklist',am,'Contrôle',[
    cell('Tableau',!rc?'—':rc.n?'⚠ '+rc.n:'✓',!rc?mu:rc.n?am:ok),
    cell('Bulletins',!nb?'—':bb?'⚠ '+bb:'✓',!nb?mu:bb?am:ok),
    cell('Règles',nr?'⚠ '+nr:'✓',nr?am:ok)],[],pbH);
  // Rendus : mois affiché à l'accueil (comme la page Rendus)
  var d=window._svD||{},vm=d.mym!=null?MF[d.mym%12]:MF[NOW.getMonth()],mat=0;try{mat=calcSoldes().matelas||0;}catch(e){}
  var dp=d.dispAtView||0,ex=d.expViewAmt||0,rp=d.repViewAmt||0;
  // prochaine échéance (après le mois affiché) et rendus déjà posés à venir
  var vY=d.mym!=null?d.mym:TODAY_YM,cvH='';
  try{cvH='<span class="svr-cv" onclick="event.stopPropagation()">'+_cvHtml(y,64)+'</span>';}catch(e){}
  var rend=block(0,'ti-clock-hour-4','var(--rend-text)','Rendus',[
    cell(d.mym!=null&&d.mym!==TODAY_YM?'Libres en '+vm.slice(0,3)+'.':'Libres',dp>0?fmtMin(dp):'—',dp>0?(dp<120?am:'var(--rend-text)'):mu),
    cell((ex>0&&d.viewPast?'Perdues':rp>0&&!ex?'Reportées':'Expirent')+' '+(['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'][vY%12]),ex>0?fmtMin(ex):rp>0?fmtMin(rp):'—',ex>0?(d.viewPast?'var(--red)':am):rp>0?ok:mu),
    cell('Matelas',mat>0?fmtMin(mat):'—',mat>0?'var(--blue)':mu)],[],cvH);
  // Congés : restants, posés, CET ; les prochains posés
  var cu=0,ce=0;try{cu=calcCongesUsedForYear(y);ce=getCETForYear(y);}catch(e){}
  var cr=d.cRest!=null?d.cRest:0;
  var cg=block(1,'ti-beach',ok,'Congés',[
    cell('Restants',cr+' j',cr>0?ok:mu),
    cell('Posés',cu+' j',cu>0?'var(--text)':mu),
    cell('CET',ce?ce+' j':'—',ce?am:mu)]);
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet" data-title="Suivi"><div id="sv-root">'+ctrl+rend+cg+'</div></div></div>';
  var cv=!_noAnim&&document.querySelector('#sv-root .svr-cv');if(cv)requestAnimationFrame(function(){try{_cvAnim(cv);}catch(e){}});}
function _rgStep(d){_haptic();var c=window._rgYM!=null?window._rgYM:(typeof curY!=='undefined'?curY*12+curM:TODAY_YM);window._rgYM=d?c+d:TODAY_YM;
  var sh=document.querySelector('#modal-root .sheet'),y=sh?sh.scrollTop:0;openMergedRenduCgModal(6,0);sh=document.querySelector('#modal-root .sheet');if(sh)sh.scrollTop=y;}
function openPrevisMois(){
  document.querySelectorAll('[onclick*="openPrevisMois"]').forEach(el=>el.classList.add('active'));_lockBodyScroll();
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const{gen,prevEph}=calcSoldes();
  const MC=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const futureYms=Object.keys(prevEph).map(Number).sort();
  if(!futureYms.length){
    document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Prévis. rendus</div><div class="ss" style="margin-bottom:12px">Aucun rendu prévu.</div><button class="mcancel mclose" onclick="closeModal()">Fermer</button></div></div>';
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
        rows+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:4px;border-top:0.5px solid var(--border)"><span style="font-size:11px;font-weight:600">Total '+prevYear+'</span><div style="display:flex;align-items:center;gap:8px"><b style="font-size:13px;min-width:40px;text-align:right;color:var(--blue)">'+fmtMin(yearTotal)+'</b><div style="width:44px"></div></div></div>';
        if(prevYear===CUR_YEAR)runningTotal=yearTotal;
      }
      yearTotal=0;prevYear=y;
      rows+='<div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;padding:8px 0 4px">'+y+'</div>';
    }
    yearTotal+=gt;
    const dots=[];
    if(gm.dim>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:#38BDF8;display:inline-block"></span>');
    if(gm.rh>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:#7b9ce0;display:inline-block"></span>');
    if(gm.fer>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:var(--gold);display:inline-block"></span>');
    if(gm.ram>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:var(--gold-dark);display:inline-block"></span>');
    if(gm.hs>0)dots.push('<span style="width:5px;height:5px;border-radius:50%;background:var(--blue);display:inline-block"></span>');
    rows+='<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:0.5px solid var(--border2)">'
      +'<span style="font-size:13px;color:var(--text2)">'+MC[m]+'</span>'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<b style="font-size:13px;min-width:40px;text-align:right">'+fmtMin(gt)+'</b>'
      +'<div style="display:flex;gap:2px;align-items:center;width:44px">'+dots.join('')+'</div>'
      +'</div>'
      +'</div>';
  });
  // Last year total
  if(prevYear!==null){
    rows+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-bottom:4px;border-top:0.5px solid var(--border)"><span style="font-size:11px;font-weight:600">Total '+prevYear+'</span><div style="display:flex;align-items:center;gap:8px"><b style="font-size:13px;min-width:40px;text-align:right;color:var(--blue)">'+fmtMin(yearTotal)+'</b><div style="width:44px"></div></div></div>';
    if(prevYear===CUR_YEAR)runningTotal=yearTotal;
  }
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Rendus à venir</div>'
    +(rows||'<div style="font-size:11px;color:var(--text3);padding:4px 0">Aucun rendu prévu.</div>')
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
}

function toggleRecapMonth(btn){
  const tid=btn.getAttribute?btn.getAttribute('data-tid'):btn;
  const el=document.getElementById(tid);
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}



function openDetailMois(mym){
  document.querySelectorAll('[onclick*="openDetailMois"]').forEach(el=>el.classList.add('active'));_lockBodyScroll();
  setTimeout(function(){if(document.documentElement.classList.contains('touch')){const _t=document.createElement('button');_t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';document.body.appendChild(_t);_t.focus();document.body.removeChild(_t);}},50);
  const{gen}=calcSoldes();
  const gm=gen[mym]||{};
  const y=Math.floor(mym/12),m=mym%12;
  const ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function makeWeekRow(mon,note){
    const hsW=calcHSWeek(mon);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    const sunYm=sun.getFullYear()*12+sun.getMonth();
    const VAC=getVAC();
    let weekDim=0,weekRH=0,weekFer=0;
    for(let i=0;i<7;i++){
      const d=new Date(mon);d.setDate(mon.getDate()+i);
      if(d.getFullYear()*12+d.getMonth()!==mym)continue;
      const key=dk(d);const v2=getVac(d);
      const{vac,absent,echange,ecSelf}=v2;
      if(!vac||vac==='RH'||absent)continue;
      if(echange&&!ecSelf)continue;
      const cKey=(S.conges||{})[key];if(cKey==='rend')continue;
      const dur=VAC[vac]?VAC[vac].dur:0;
      const isFer3=FERIES.has(key),isDim3=d.getDay()===0,isRH3=isRHDay(d);
      const sett3=settingsForYM(mym);
      const ferF3=isFer3&&sett3.ferRendu?2.0:0;
      const dimF3=isDim3&&sett3.dimRendu?0.5:0;
      const rhF3=(!v2.echange&&!isDim3&&isRH3&&sett3.rhRendu)?0.5:0;
      if(ferF3+dimF3+rhF3===0)continue;
      if(ferF3>0)weekFer+=Math.round(dur*ferF3/60*100)/100*60;
      if(dimF3>0)weekDim+=Math.round(dur*dimF3/60*100)/100*60;
      if(rhF3>0)weekRH+=Math.round(dur*rhF3/60*100)/100*60;
    }
    const hsHS=sunYm===mym?hsW.rendusMinHS:0;
    const hsRam=sunYm===mym?hsW.rendusMinRam:0;
    const total=hsHS+hsRam+weekDim+weekRH+weekFer;
    if(total<=0)return'';
    const partRows=[
      {label:'Dimanches',val:weekDim,color:'#38BDF8'},
      {label:'RH',val:weekRH,color:'#7b9ce0'},
      {label:'Fériés',val:weekFer,color:'var(--gold)'},
      {label:'Heures supp.',val:hsHS,color:'var(--blue)'},
      {label:'Ramenée',val:hsRam,color:'var(--gold-dark)'},
    ].filter(r=>r.val>0);
    return'<div style="font-size:11px;padding:5px 0;border-bottom:0.5px solid var(--border2)">'      +'<div style="display:flex;justify-content:space-between;margin-bottom:3px">'      +'<span style="font-weight:500;color:var(--text)">Semaine '+getISOWeek(mon)+(note?' <span style="font-size:10px;font-weight:400;color:var(--text3)">'+note+'</span>':'')+'</span>'      +'<b style="color:var(--text2)">+'+fmtMin(total)+'</b></div>'      +partRows.map(r=>'<div style="display:flex;justify-content:space-between;padding:1px 0 1px 8px">'        +'<span style="color:var(--text3)">'+r.label+'</span>'        +'<span style="color:'+r.color+'">+'+fmtMin(r.val)+'</span>'        +'</div>').join('')      +'</div>';
  }

  const seenW=new Set();let hsRows='';
  const last2=new Date(y,m+1,0).getDate();
  for(let dd=-6;dd<last2;dd++){
    const date=new Date(y,m,1+dd);
    const mon=getMonday(date),mk=dk(mon);
    if(seenW.has(mk))continue;seenW.add(mk);
    const note='';
    hsRows+=makeWeekRow(mon,note);
  }

  const rows=[
    {label:'Dimanches',val:gm.dim,color:'#38BDF8'},
    {label:'RH',val:gm.rh,color:'#7b9ce0'},
    {label:'Fériés travaillés',val:gm.fer,color:'var(--gold)'},
    {label:'Heures supp.',val:gm.hs,color:'var(--blue)'},
    {label:'Semaines ramenées',val:gm.ram,color:'var(--gold-dark)'},
    {label:'Solde initial',val:gm.solde,color:'var(--text2)'},
  ].filter(r=>r.val>0);

  const gt=(gm.dim||0)+(gm.rh||0)+(gm.fer||0)+(gm.hs||0)+(gm.ram||0);

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'    +'<div class="sh"></div>'    +'<div class="st">Créés — '+ML[m].toLowerCase()+' '+y+'</div>'    +'<div class="ss">'+fmtMin(gt)+' acquis</div>'    +'<div style="margin-bottom:10px">'+rows.map(r=>
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0">'      +'<div style="display:flex;align-items:center;gap:6px"><span class="rdot" style="background:'+r.color+'"></span><span style="font-size:13px;color:var(--text2)">'+r.label+'</span></div>'      +'<b style="font-size:13px;color:var(--text)">'+fmtMin(r.val)+'</b></div>'    ).join('')+'</div>'    +(hsRows?'<div class="sep"></div><div class="btit" style="margin-bottom:4px">Détail par semaine</div>'+hsRows:'')    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'    +'</div></div>';
}

function openMergedMoisModal(mym,tab){
  document.querySelectorAll('[onclick*="openMergedMoisModal"]').forEach(el=>el.classList.add('active'));
  _lockBodyScroll();
  const VAC=getVAC();
  const y=Math.floor(mym/12),m=mym%12;
  const MLf=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const JOURS_L=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  const last=new Date(y,m+1,0).getDate();

  // === Paniers & Primes ===
  const paniers=[],pa=[],pr=[],pc=[],pm2=[];
  const seenW_pm=new Set();
  for(let dd=-6;dd<last;dd++){
    const _dpm=new Date(y,m,1+dd),mon_pm=getMonday(_dpm),mk_pm=dk(mon_pm);
    if(seenW_pm.has(mk_pm))continue;seenW_pm.add(mk_pm);
    const sun_pm=new Date(mon_pm);sun_pm.setDate(mon_pm.getDate()+6);
    if(sun_pm.getFullYear()*12+sun_pm.getMonth()!==mym)continue;
    for(let i=0;i<7;i++){
      const date=new Date(mon_pm);date.setDate(mon_pm.getDate()+i);const key=dk(date);
      if((S.conges||{})[key])continue;
      const{vac,absent,echange,ecSelf}=getVac(date);
      if(absent||!vac||vac==='RH'||(echange&&!ecSelf))continue;
      const v=VAC[vac];if(!v)continue;
      const jidx=date.getDay();
      const lbl=JOURS_L[jidx===0?6:jidx-1]+' '+date.getDate()+' '+MLf[date.getMonth()].toLowerCase();
      const entry={lbl,vac,wk:isoWeek(date)};
      if(v.panier)paniers.push(entry);
      if(v.deb&&_toMinApp(v.deb)<240)pm2.push(entry);
      if(v.primes){if(v.primes.antenne)pa.push(entry);if(v.primes.reel)pr.push(entry);if(v.primes.coord)pc.push(entry);}
    }
  }
  // Subtotals by type
  const _primesGroups=[['Paniers',paniers],['Prime matin',pm2],['Prime antenne',pa],['Prime réal',pr],['Prime coord',pc]].filter(g=>g[1].length);
  const _primesTotal=paniers.length+pm2.length+pa.length+pr.length+pc.length;
  const _tabSpacer='<div style="padding:2px 0 4px;font-size:10px;visibility:hidden">x</div>';
  let _primesSubHTML='';
  if(_primesGroups.length){
    _primesSubHTML='<div class="ucard" style="margin:0;padding:8px 12px"><div style="display:flex;justify-content:space-between;padding:2px 0 4px"><span></span><span style="font-size:11px;color:var(--text3)">nombre</span></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;margin-bottom:4px"><span style="font-size:11px;color:var(--text3)">total</span><b style="font-size:15px;color:var(--amber)">'+_primesTotal+'</b></div>'
      +'<div style="font-size:11px">'+_primesGroups.map(g=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="color:var(--text3)">'+g[0]+'</span><b style="color:var(--amber)">'+g[1].length+'</b></div>').join('')+'</div></div>';
  }
  // Merged week detail (entries de-duplicated per day, types + vac listed)
  const _dayPrimesMap={};
  function _collectPrime(entries,typeLbl){entries.forEach(e=>{if(!_dayPrimesMap[e.lbl])_dayPrimesMap[e.lbl]={lbl:e.lbl,wk:e.wk,vac:e.vac,types:[]};if(!_dayPrimesMap[e.lbl].types.includes(typeLbl))_dayPrimesMap[e.lbl].types.push(typeLbl);});}
  _collectPrime(paniers,'Panier');_collectPrime(pm2,'Matin');_collectPrime(pa,'Antenne');_collectPrime(pr,'Réal');_collectPrime(pc,'Coord');
  const _wkMap={},_wkOrder=[];
  Object.values(_dayPrimesMap).forEach(e=>{if(!_wkMap[e.wk]){_wkMap[e.wk]=[];_wkOrder.push(e.wk);}_wkMap[e.wk].push(e);});
  _wkOrder.sort((a,b)=>a-b);
  let _pid=0,_primesWeekHTML='';
  _wkOrder.forEach(function(wk){
    const days=_wkMap[wk],id='_pw'+(++_pid);
    _primesWeekHTML+=_mmWk(id,'Semaine '+wk,'<b style="color:var(--amber)">'+days.reduce(function(s,d){return s+d.types.length;},0)+'</b>',
      days.map(e=>_mmSub(e.lbl+'<span style="margin-left:5px;font-size:10px;opacity:.7">'+e.vac+'</span>','<b style="color:var(--amber)">'+e.types.join(' · ')+'</b>')).join(''));
  });
  let paniersHtml='';
  if(_primesTotal>0){
    paniersHtml=_primesSubHTML
      +(_primesWeekHTML?_mmBox(_primesWeekHTML):'');
  }else{
    paniersHtml='<div style="font-size:11px;color:var(--text3);padding:6px 0">Aucun ce mois.</div>';
  }
  const _nuitRows=[];const _seenWN=new Set();
  for(let dd=-6;dd<last;dd++){
    const _dn=new Date(y,m,1+dd),_mn=getMonday(_dn),_mkn=dk(_mn);
    if(_seenWN.has(_mkn))continue;_seenWN.add(_mkn);
    const _sn=new Date(_mn);_sn.setDate(_mn.getDate()+6);
    if(_sn.getFullYear()*12+_sn.getMonth()!==mym)continue;
    const _days=[];
    for(let i=0;i<7;i++){const _dd=new Date(_mn);_dd.setDate(_mn.getDate()+i);const _kd=dk(_dd);const{vac:_vn,absent:_ab,echange:_ec,ecSelf:_es}=getVac(_dd);if(_ab)continue;const _cgd=(S.conges||{})[_kd];if(_cgd&&(_cgd==='cg'||_cgd==='rend'||_cgd==='rend-hist'||_cgd==='absent'))continue;if(_ec&&!_es)continue;if(!_vn||_vn==='RH')continue;const _pv2=getPayVac(_dd)||_vn,_nm2=getNuitMinDay(_dd,VAC);if(_nm2>0){const _ji=_dd.getDay();_days.push({lbl:JOURS_L[_ji===0?6:_ji-1]+' '+_dd.getDate()+' '+MLf[m].toLowerCase(),vac:_pv2,min:_nm2});}}
    const _wkMin=_days.reduce((s,d)=>s+d.min,0);
    if(_wkMin>0)_nuitRows.push({wk:getISOWeek(_mn),min:_wkMin,days:_days});
  }
  const _nuitTotal=_nuitRows.reduce((s,r)=>s+r.min,0);
  let _nid=0;
  let nuitSection='';
  if(_nuitRows.length>0){
    nuitSection='<div class="ucard" style="margin:0;padding:8px 12px"><div style="display:flex;justify-content:space-between;padding:2px 0 4px"><span></span><span style="font-size:11px;color:var(--text3)">payées</span></div>'+'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;margin-bottom:4px"><span style="font-size:11px;color:var(--text3)">total</span><b style="font-size:15px;color:#9c7fe0">'+fmtMin(_nuitTotal)+'</b></div></div>'
      ;
    let _nuitWk='';
    _nuitRows.forEach(r=>{
      const id='_pn'+(++_nid);
      _nuitWk+=_mmWk(id,'Semaine '+r.wk,'<b style="color:#9c7fe0">'+fmtMin(r.min)+'</b>',
        r.days.map(d=>_mmSub(d.lbl+'<span style="margin-left:5px;font-size:10px;opacity:.7">'+d.vac+'</span>','<b style="color:#9c7fe0">'+fmtMin(d.min)+'</b>')).join(''));
    });
    nuitSection+=_mmBox(_nuitWk);
  }else{
    nuitSection='<div style="font-size:11px;color:var(--text3);padding:6px 0">Aucune heure de nuit ce mois.</div>';
  }

  // === Heures sup. ===
  const sett2=settingsForYM(mym),useRendu2=sett2.hsRendu;
  const seenW=new Set();let hsRows='';let tot=0,totLow=0,totHigh=0,totRawLow=0,totRawHigh=0;
  // comparaison : le même total avec l'autre méthode (durée / horaires) pour une vacation changée
  const _hsAlt=_hsMode()==='horaires'?'duree':'horaires';let totAlt=0;
  function makeHSRow(mon,prevMois){
    const hsA=calcHSWeek(mon,_hsAlt);totAlt+=useRendu2?hsA.rendusMin:(hsA.rawLow+hsA.rawHigh);
    const hsW=calcHSWeek(mon);if(hsW.surplus<=0)return;
    const sett=settingsForYM(mym),useRendu=sett.hsRendu;
    const rowTotal=useRendu?hsW.rendusMin:(hsW.rawLow+hsW.rawHigh);
    const low=useRendu?hsW.rawLow*1.25:hsW.rawLow;
    const high=useRendu?hsW.rawHigh*1.5:hsW.rawHigh;
    tot+=rowTotal;totLow+=low;totHigh+=high;totRawLow+=hsW.rawLow;totRawHigh+=hsW.rawHigh;
    const _sun=new Date(mon);_sun.setDate(mon.getDate()+6);const _f=function(d){return d.getDate()+' '+MCs[d.getMonth()];};
    hsRows+=_mmWk('_ph'+getISOWeek(mon),'Semaine '+getISOWeek(mon)+' <span style="font-weight:400;color:var(--text3)">· '+_f(mon)+' – '+_f(_sun)+'</span>'+(hsW.isRam?' <span style="font-size:10px;font-weight:400;color:var(--text3)">dont 7h de ramenée</span>':''),
      '<div style="display:flex;gap:16px;align-items:center">'+(useRendu2?'<b style="width:52px;text-align:right;color:var(--text3)">'+fmtMin(hsW.rawLow+hsW.rawHigh)+'</b>':'')
      +'<b style="width:52px;text-align:right;color:var(--blue)">'+fmtMin(rowTotal)+'</b></div>',
      // dépliant : seulement les jours qui dépassent la vacation prévue (les heures sup se comptent jour par jour)
      (hsW.days||[]).filter(function(x){return x.worked>x.base;}).map(function(x){var d=new Date(x.key+'T12:00:00'),ex=x.worked-x.base;return _mmSub(d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})+(x.vac?' · '+_h(vLbl(x.vac,getVAC(d))):''),
        '<span>'+fmtMin(x.base)+' → <b>'+fmtMin(x.worked)+'</b>'+(ex>0?' <b style="color:var(--blue)">+'+fmtMin(ex)+'</b>'+(Math.ceil(ex/30)*30!==ex?' <span style="color:var(--text3)">compté '+fmtMin(Math.ceil(ex/30)*30)+'</span>':''):'')+'</span>');}).join('')
      +(hsW.rawHigh>0?_mmSub('HS au-delà de 8h dans la semaine','<b style="color:var(--blue)">'+fmtMin(hsW.rawHigh)+'</b>'):'')
      +(hsW.isRam?_mmSub('Semaine ramenée (férié)','<b style="color:var(--blue)">+7h00</b>'):''));
  }
  for(let dd=-6;dd<last;dd++){const date=new Date(y,m,1+dd);const mon=getMonday(date),mk=dk(mon);if(seenW.has(mk))continue;seenW.add(mk);const sun=new Date(mon);sun.setDate(mon.getDate()+6);if(sun.getFullYear()*12+sun.getMonth()!==mym)continue;const prevMois2=mon.getFullYear()*12+mon.getMonth()!==mym;makeHSRow(mon,prevMois2);}
  const hsSummary=useRendu2?(
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;margin-bottom:4px"><span style="font-size:11px;color:var(--text3)">total</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:15px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawLow+totRawHigh)+'</b><b style="font-size:15px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(tot)+'</b></div></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS≤8h</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawLow)+'</b><b style="font-size:11px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totLow)+'</b></div></div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS>8h</span><div style="margin-left:auto;display:flex;gap:16px"><b style="font-size:11px;width:52px;text-align:right;color:var(--text3)">'+fmtMin(totRawHigh)+'</b><b style="font-size:11px;width:52px;text-align:right;color:var(--blue)">'+fmtMin(totHigh)+'</b></div></div>'
  ):(
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;margin-bottom:4px"><span style="font-size:11px;color:var(--text3)">total</span><b style="font-size:15px;color:var(--blue)">'+fmtMin(totRawLow+totRawHigh)+'</b></div>'
    +'<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS≤8h</span><b style="font-size:11px;color:var(--blue)">'+fmtMin(totRawLow)+'</b></div>'+
    '<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-size:11px;color:var(--text3)">HS>8h</span><b style="font-size:11px;color:var(--blue)">'+fmtMin(totRawHigh)+'</b></div>'
  );
  const hsColHdr=useRendu2?'<div style="display:flex;justify-content:space-between;padding:2px 0 4px"><span></span><div style="margin-left:auto;display:flex;gap:16px"><span style="font-size:11px;color:var(--text3);width:52px;text-align:right">brutes</span><span style="font-size:11px;color:var(--text3);width:52px;text-align:right">rendues</span></div></div>'
    // Même hauteur que l'en-tête ci-dessus : aligne le total sur ceux des autres onglets
    :'<div style="display:flex;justify-content:space-between;padding:2px 0 4px"><span></span><span style="font-size:11px;color:var(--text3)">payées</span></div>';
  const _hasMo=false;
  const _moCfgBtn='';
  const hsAltLine=Math.round(totAlt)!==Math.round(tot)?'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0 2px;margin-top:6px;border-top:0.5px solid var(--border2)"><span style="font-size:11px;color:var(--text3)">Méthode « '+(_hsAlt==='horaires'?'horaires':'durée')+' » (Réglages › Calcul)</span><b style="font-size:13px;color:var(--text2)">'+fmtMin(totAlt)+'</b></div>'
    :'<div style="font-size:11px;color:var(--text3);padding:8px 0 2px;margin-top:6px;border-top:0.5px solid var(--border2)">Même total avec la méthode « '+(_hsAlt==='horaires'?'horaires':'durée')+' »</div>';
  const hsSection='<div class="ucard" style="margin:0;padding:8px 12px">'+hsColHdr+hsSummary+hsAltLine+'</div>'+(hsRows?_mmBox(hsRows):'');

  // === Créés ce mois ===
  const{gen:gen2}=calcSoldes();const gm=gen2[mym]||{};
  const seenW2=new Set();let crRows='';
  function makeWeekRow2(mon,note){
    const hsW=calcHSWeek(mon);
    const sun2=new Date(mon);sun2.setDate(mon.getDate()+6);
    const sunYm2=sun2.getFullYear()*12+sun2.getMonth();
    // Align with buildGen: attribute whole week to Sunday's month
    if(sunYm2!==mym)return'';
    const sett3=settingsForYM(sunYm2);
    let weekDim=0,weekRH=0,weekFer=0;
    for(let i=0;i<7;i++){
      const d=new Date(mon);d.setDate(mon.getDate()+i);
      const key=dk(d);
      const v2=getVac(d);const{vac,absent,echange,ecSelf}=v2;
      if(!vac||vac==='RH'||absent)continue;if(echange&&!ecSelf)continue;
      const cKey=(S.conges||{})[key];if(cKey==='rend'||cKey==='rend-hist'||cKey==='cg'||cKey==='absent')continue;
      const dur=VAC[vac]?VAC[vac].dur:0;
      const isFer3=FERIES.has(key),isDim3=d.getDay()===0,isRH3=isRHDay(d);
      const ferF3=isFer3&&sett3.ferRendu?2.0:0,dimF3=isDim3&&sett3.dimRendu?0.5:0,rhF3=(!v2.echange&&!isDim3&&isRH3&&sett3.rhRendu)?0.5:0;
      if(ferF3+dimF3+rhF3===0)continue;
      if(ferF3>0)weekFer+=Math.round(dur*ferF3/60*100)/100*60;
      if(dimF3>0)weekDim+=Math.round(dur*dimF3/60*100)/100*60;
      if(rhF3>0)weekRH+=Math.round(dur*rhF3/60*100)/100*60;
    }
    const hsHS2=sett3.hsRendu?hsW.rendusMinHS:0;
    const hsRam2=sett3.hsRendu?hsW.rendusMinRam:0;
    let weekExtra=0;
    for(let i=0;i<7;i++){const _ed=new Date(mon);_ed.setDate(mon.getDate()+i);const _ek=dk(_ed);const _exd=(S.extraRendus||{})[_ek];if(_exd)weekExtra+=(_exd.dur||0);}
    const total=hsHS2+hsRam2+weekDim+weekRH+weekFer+weekExtra;
    if(total<=0)return'';
    const partRows=[{label:'Dimanches',val:weekDim,color:'#38BDF8'},{label:'RH',val:weekRH,color:'#7b9ce0'},{label:'Fériés',val:weekFer,color:'var(--gold)'},{label:'Heures supp.',val:hsHS2,color:'var(--blue)'},{label:'Ramenée',val:hsRam2,color:'var(--gold-dark)'},{label:'Extra',val:weekExtra,color:'var(--rend-text)'}].filter(r=>r.val>0);
    return _mmWk('_pr'+getISOWeek(mon),'Semaine '+getISOWeek(mon)+(note?' <span style="font-size:10px;font-weight:400;color:var(--text3)">'+note+'</span>':''),'<b style="color:var(--rend-text)">'+fmtMin(total)+'</b>',
      partRows.map(r=>_mmSub(r.label,'<b style="color:'+r.color+'">'+fmtMin(r.val)+'</b>')).join(''));
  }
  for(let dd=-6;dd<last;dd++){const date=new Date(y,m,1+dd);const mon=getMonday(date),mk=dk(mon);if(seenW2.has(mk))continue;seenW2.add(mk);crRows+=makeWeekRow2(mon,'');}
  const crTotRows=[{label:'Dimanches',val:gm.dim,color:'#38BDF8'},{label:'RH',val:gm.rh,color:'#7b9ce0'},{label:'Fériés travaillés',val:gm.fer,color:'var(--gold)'},{label:'Heures supp.',val:gm.hs,color:'var(--blue)'},{label:'Semaines ramenées',val:gm.ram,color:'var(--gold-dark)'},{label:'Extra',val:gm.extra,color:'var(--rend-text)'},{label:'Solde initial',val:gm.solde,color:'var(--text2)'}].filter(r=>r.val>0);
  const gt2=(gm.dim||0)+(gm.rh||0)+(gm.fer||0)+(gm.hs||0)+(gm.ram||0)+(gm.extra||0);
  const crSection=
    '<div class="ucard" style="margin:0;padding:8px 12px"><div style="display:flex;justify-content:space-between;padding:2px 0 4px"><span></span><span style="font-size:11px;color:var(--text3)">'+(mym>TODAY_YM?'prévus':'acquis')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;margin-bottom:4px">'
    +'<span style="font-size:11px;color:var(--text3)">total</span>'
    +'<span class="num" style="font-size:15px;font-weight:700;color:var(--rend-text)">'+fmtMin(gt2)+'</span>'
    +'</div>'
    +'<div>'+crTotRows.map(r=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><div style="display:flex;align-items:center;gap:6px"><span class="rdot" style="background:'+r.color+'"></span><span style="font-size:11px;color:var(--text2)">'+r.label+'</span></div><b style="font-size:11px;color:var(--text)">'+fmtMin(r.val)+'</b></div>').join('')+'</div>'+'</div>'
    +(crRows?_mmBox(crRows):'')
    +_moCfgBtn;

  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet tabmod" data-title="Variables '+(/^[aeiouéâ]/.test(MLf[m].toLowerCase())?'d’':'de ')+MLf[m].toLowerCase()+'">'
    +'<div class="sh"></div>'
    +(window._mmFrom?'<div style="display:flex;justify-content:space-between;align-items:baseline"><div class="nav-back" style="'+_navBackCss+'" onclick="_mmGoBack()">‹ Rendus</div><span style="font-size:13px;font-weight:600;color:var(--text2)">'+MLf[m]+' '+y+'</span></div>':'')
    +'<div class="stabs-row">'
    +'<div class="stabs-sp"></div>'
    +'<div id="mtp-bar" class="stabs-bar stabs-bar5" style="display:flex;background:var(--bg3);border-radius:10px;padding:3px;gap:2px;position:relative;z-index:0">'
    +'<div id="mtp-pill" class="seg-pill" style="position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 12px) / 4);border-radius:8px;background:var(--bg2);box-shadow:0 1px 3px rgba(0,0,0,.2);pointer-events:none;z-index:-1;transform:'+['translateX(0)','translateX(calc(100% + 2px))','translateX(calc(200% + 4px))','translateX(calc(300% + 6px))','translateX(calc(400% + 8px))'][tab||0]+'"></div>'
    +'<button id="mtp-0" onclick="moisTab(0)" style="flex:1;padding:8px 4px;font-size:11px;font-weight:600;color:var(--seg-tx-on);background:transparent;border-radius:8px;border:none;cursor:pointer;font-family:var(--font)">Rendus</button>'
    +'<button id="mtp-1" onclick="moisTab(1)" style="flex:1;padding:8px 4px;font-size:11px;font-weight:400;color:var(--seg-tx);background:transparent;border-radius:8px;border:none;cursor:pointer;font-family:var(--font)">HS</button>'
    +'<button id="mtp-2" onclick="moisTab(2)" style="flex:1;padding:8px 4px;font-size:11px;font-weight:400;color:var(--seg-tx);background:transparent;border-radius:8px;border:none;cursor:pointer;font-family:var(--font)">Primes</button>'
    +'<button id="mtp-3" onclick="moisTab(3)" style="flex:1;padding:8px 4px;font-size:11px;font-weight:400;color:var(--seg-tx);background:transparent;border-radius:8px;border:none;cursor:pointer;font-family:var(--font)">Nuit</button>'
    +'</div>'
    +'<button class="sh-x" onclick="closeModal()"><i class="ti ti-x"></i></button>'
    +'</div>'
    +'<div id="mtp-wrap" style="display:grid">'
    +'<div id="mtc-0" style="grid-area:1/1">'+crSection+'</div>'
    +'<div id="mtc-1" style="grid-area:1/1;visibility:hidden;pointer-events:none">'+hsSection+'</div>'
    +'<div id="mtc-2" style="grid-area:1/1;visibility:hidden;pointer-events:none">'+paniersHtml+'</div>'
    +'<div id="mtc-3" style="grid-area:1/1;visibility:hidden;pointer-events:none">'+nuitSection+'</div>'
    +'</div>'
    +'<button class="mcancel mclose" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
  const wrap=document.querySelector('#modal-root .sheet');
  requestAnimationFrame(function(){
    moisTab(tab||0);
    var _pill=document.getElementById('mtp-pill');
    requestAnimationFrame(function(){if(_pill)_pill.style.transition='transform .2s ease';});
    if(wrap){
      var _sxM=0,_syM=0,_swBlock=false,_swT=0;
      wrap.addEventListener('touchstart',function(e){_sxM=e.touches[0].clientX;_syM=e.touches[0].clientY;_swT=Date.now();_swBlock=!!e.target.closest('button,input,label,select,a');},{passive:true});
      wrap.addEventListener('touchend',function(e){
        if(_swBlock||Date.now()-_swT>600)return;
        var dx=e.changedTouches[0].clientX-_sxM,dy=Math.abs(e.changedTouches[0].clientY-_syM);
        if(Math.abs(dx)<65||dy>80)return;
        var cur=0;for(var i=0;i<4;i++){var t=document.getElementById('mtc-'+i);if(t&&t.style.visibility!=='hidden')cur=i;}
        moisTab(dx<0?Math.min(3,cur+1):Math.max(0,cur-1));
      },{passive:true});
    }
  });
}




function _ptog(id){
  var el=document.getElementById(id);if(!el)return;
  var open=el.style.display!=='none';
  el.style.display=open?'none':'';
  var ch=document.getElementById(id+'c');
  if(ch)ch.style.transform=open?'':'rotate(90deg)';
}

function _icoPop(el){if(!el||!el.id||_icoSeen[el.id])return;_icoSeen[el.id]=1;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  var n=0;el.querySelectorAll('i.ti:not([class*="chevron"])').forEach(function(i){if(n>=14||!i.offsetParent)return;
    i.style.animationDelay=(60+n++*35)+'ms';i.classList.add('ico-pop');i.addEventListener('animationend',function(){i.classList.remove('ico-pop');i.style.animationDelay='';},{once:true});});}
function moisTab(idx){
  if(idx>3)idx=0;var _mt=document.getElementById('mtc-'+idx);if(_mt&&_mt.style.visibility==='hidden')_haptic();
  if(idx>3)idx=0; // ancien onglet Paie : remplacé par la page Paie du Suivi
  var _tx=['translateX(0)','translateX(calc(100% + 2px))','translateX(calc(200% + 4px))','translateX(calc(300% + 6px))'];
  for(let i=0;i<4;i++){
    const btn=document.getElementById('mtp-'+i),tab=document.getElementById('mtc-'+i);
    if(btn){btn.style.fontWeight=i===idx?'600':'400';btn.style.color=i===idx?'var(--seg-tx-on)':'var(--seg-tx)';}
    if(tab){tab.style.visibility=i===idx?'':'hidden';tab.style.pointerEvents=i===idx?'':'none';}
  }
  var _p=document.getElementById('mtp-pill');if(_p)_p.style.transform=_tx[idx]||_tx[0];
  _icoPop(document.getElementById('mtc-'+idx));
}

function rcgTab(idx){
  // Hauteur des onglets figée à la plus grande vue : changer d'onglet (ou replier un bloc) ne fait plus sauter la fenêtre
  var _rw=document.getElementById('rcc-wrap');if(_rw&&!_rw.closest('.sv-one')){var _h=_rw.offsetHeight,_m=parseFloat(_rw.style.minHeight)||0;if(_h>_m)_rw.style.minHeight=_h+'px';}
  if(document.getElementById('rcc-'+idx)&&document.getElementById('rcc-'+idx).style.visibility==='hidden')_haptic();
  var _same=window._rcgShown===idx&&document.body.classList.contains('modal-open')&&window._rcgRedraw;window._rcgShown=idx;window._rcgRedraw=false;
  if(idx===1&&!_same)_cgAnim(null);
  if(idx===0&&!_same){var _w=document.getElementById('rcc-0');if(_w){_w.classList.remove('rc-anim');void _w.offsetWidth;_w.classList.add('rc-anim');[].forEach.call(_w.querySelectorAll('.eph-urow'),function(r,i){[].forEach.call(r.querySelectorAll('.eph-b,.eph-b2'),function(b){b.style.animationDelay=(i*.05)+'s';});});}}
  if(idx===0&&document.getElementById('rcc-0')&&document.getElementById('rcc-0').style.visibility==='hidden'&&document.querySelector('#fold-annee[open]'))requestAnimationFrame(function(){_cptAnim(document.getElementById('cpt-card'));});
  // En quittant le récap, ses blocs se replient
  if(idx!==0){delete _foldOpen['fold-annee'];var _fa=document.querySelector('#fold-annee[open]');if(_fa)_fa.open=false;}
  var _tx=['translateX(0)','translateX(calc(100% + 2px))','translateX(calc(200% + 4px))'];
  for(let i=0;i<3;i++){
    const btn=document.getElementById('rcp-'+i),tab=document.getElementById('rcc-'+i);
    if(btn){btn.style.fontWeight=i===idx?'600':'400';btn.style.color=i===idx?'var(--seg-tx-on)':'var(--seg-tx)';}
    if(tab){tab.style.visibility=i===idx?'visible':'hidden';tab.style.pointerEvents=i===idx?'':'none';if(_rw&&_rw.closest('.sv-one'))tab.style.display=i===idx?'':'none';}
  }
  _icoPop(document.getElementById('rcc-'+idx));
  var _p=document.getElementById('rcp-pill');if(_p){if(_same){_p.style.transition='none';_p.style.transform=_tx[_RCG_ORDER.indexOf(idx)]||_tx[0];void _p.offsetWidth;_p.style.transition='';}else _p.style.transform=_tx[_RCG_ORDER.indexOf(idx)]||_tx[0];}
}
// Clavier iPhone : la fenêtre se cale au-dessus du clavier (zone visible = visualViewport) et la case saisie défile
// dans la partie visible, sinon on écrit sous le clavier sans se voir
(function(){
  var vv=window.visualViewport,de=document.documentElement;if(!vv)return;
  var isField=function(el){return el&&(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|range|color|file)$/.test(el.type))||el.isContentEditable);};
  var scroller=function(el){for(var p=el.parentElement;p&&p!==document.body;p=p.parentElement){var o=getComputedStyle(p).overflowY;if((o==='auto'||o==='scroll')&&p.scrollHeight>p.clientHeight+1)return p;}return null;};
  var reveal=function(){var el=document.activeElement;if(!isField(el))return;var sc=scroller(el);if(!sc)return;
    var r=el.getBoundingClientRect(),b=sc.getBoundingClientRect(),top=Math.max(b.top,vv.offsetTop)+12,bot=Math.min(b.bottom,vv.offsetTop+vv.height)-16;
    var d=r.bottom>bot?r.bottom-bot:(r.top<top?r.top-top:0);if(d)sc.scrollBy({top:d,behavior:'smooth'});};
  var t=0,upd=function(){var kb=window.innerHeight-vv.height>120;
    de.style.setProperty('--vvh',vv.height+'px');de.style.setProperty('--vvt',vv.offsetTop+'px');de.classList.toggle('kb',kb);
    clearTimeout(t);if(kb)t=setTimeout(reveal,60);};
  vv.addEventListener('resize',upd);vv.addEventListener('scroll',upd);
  document.addEventListener('focusin',function(e){if(isField(e.target))setTimeout(function(){upd();reveal();},350);});
})();
// Hauteur des fenêtres animée : quand le contenu d'une fenêtre change de taille, ou quand une fenêtre en remplace une autre
// (fiche du jour → Rendu…), la hauteur glisse de l'ancienne à la nouvelle au lieu de sauter
(function(){
  var root=null,ro=null,cur=null,lastH=0,anim=false,EASE='cubic-bezier(.32,.72,0,1)';
  var slide=function(sh,from,to){if(Math.abs(from-to)<3)return;anim=true;
    sh.style.transition='none';sh.style.height=from+'px';void sh.offsetHeight;
    sh.style.transition='height .3s '+EASE;sh.style.height=to+'px';
    setTimeout(function(){sh.style.transition='';sh.style.height='';anim=false;lastH=sh.offsetHeight;},320);};
  var watch=function(sh){if(ro)ro.disconnect();cur=sh;if(!sh)return;ro=new ResizeObserver(function(){if(anim||cur!==sh)return;var h=sh.offsetHeight;if(lastH&&h)slide(sh,lastH,h);lastH=h;});ro.observe(sh);};
  var init=function(){root=document.getElementById('modal-root');if(!root||!window.ResizeObserver)return;
    new MutationObserver(function(recs){
      var sh=root.querySelector('.sheet');
      if(!sh){watch(null);lastH=0;return;}
      if(sh===cur)return;
      // fenêtre remplacée par une autre dans le même geste : pas de nouvelle montée, la hauteur glisse
      var replaced=recs.some(function(r){return r.removedNodes.length&&r.addedNodes.length;})&&lastH>0;
      var from=lastH;watch(null);
      if(replaced){var ov=root.querySelector('.overlay');if(ov)ov.style.animation='none';sh.style.animation='none';var to=sh.offsetHeight;lastH=to;slide(sh,from,to);}
      else lastH=0;
      watch(sh);
    }).observe(root,{childList:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
function _lockBodyScroll(){var sy=window.scrollY;document.body.style.top='-'+sy+'px';document.body.classList.add('modal-open');}
function _unlockBodyScroll(){var top=parseInt(document.body.style.top||'0');document.body.classList.remove('modal-open');document.body.style.top='';window.scrollTo(0,-top);}
function closeModal(){
  window._poolTmp=null; // équipe essayée dans « Changer de ligne » sans valider
  // fenêtre ouverte par-dessus une autre (message au gestionnaire…) : la fermer ramène à la page d'avant
  if(window._modalBack){var _b=window._modalBack;window._modalBack=null;_b();return;}
  // sous-page ou petite fenêtre ouverte depuis un onglet (téléphone) : on revient à la page de l'onglet, pas à l'accueil
  var _rt=window._tbRoot,_mr=document.getElementById('modal-root');
  if(_rt&&_isPhone()&&_mr&&_mr.querySelector('.overlay')&&!document.getElementById({suivi:_isPhone()?'sv-root':'rcc-wrap',set:'stc-0',swap:'sw-list'}[_rt])){
    window._svYear=null;window._rvFrom=null;window._mmFrom=null;pendingKey=null;if(document.body.classList.contains('tb-sub'))window._tbPop=1;
    if(_rt==='suivi')openSuiviRoot();else if(_rt==='set')openSettingsModal(window._stLast||0);else openSwaps();
    return;}
  window._tbRoot=null;window._rgYM=null;
  window._svYear=null; // le salaire du Suivi revient à l'année en cours
  // Tableau Gestion ouvert depuis le modal rendus : on y revient à la fermeture
  window._rvFrom=null;window._mmFrom=null;
  if(window._settingsPid){try{saveProfileFromDD(window._settingsPid);}catch(e){}window._settingsPid=null;}
  document.getElementById('modal-root').innerHTML='';pendingKey=null;document.querySelectorAll('.bloc.active,.ctr.active').forEach(el=>el.classList.remove('active'));_unlockBodyScroll();
  // Kill sticky hover on touch devices
  if(document.documentElement.classList.contains('touch')){
    const tmp=document.createElement('button');
    tmp.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';
    document.body.appendChild(tmp);tmp.focus();document.body.removeChild(tmp);
  }
}

// ================================================================
// WEEK VIEW
// ================================================================
function openWeekView(){
  _weekViewMon=dk(getMonday(NOW));
  var el=document.getElementById('week-view-overlay');
  if(!el){
    el=document.createElement('div');
    el.id='week-view-overlay';
    el.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:150;background:var(--bg0);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .25s ease;will-change:transform;overflow:hidden';
    document.body.appendChild(el);
    _wvInitSwipe(el);
  }
  var _hdrEl=document.querySelector('.hdr');
  el.style.top=(_hdrEl?_hdrEl.offsetHeight:60)+'px';
  el.style.display='flex';
  requestAnimationFrame(function(){el.style.transform='translateX(0)';});
  _wvLoad(_weekViewMon);
}
function weekViewToday(){
  _weekViewMon=dk(getMonday(NOW));
  _wvLoad(_weekViewMon);
}
function _wvInitSwipe(el){
  var _sx=0,_sy=0,_active=false;
  el.addEventListener('touchstart',function(e){
    if(e.target.closest('button'))return;
    _sx=e.touches[0].clientX;_sy=e.touches[0].clientY;_active=true;
  },{passive:true});
  el.addEventListener('touchend',function(e){
    if(!_active)return;_active=false;
    var dx=e.changedTouches[0].clientX-_sx,dy=e.changedTouches[0].clientY-_sy;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.2)weekViewNav(dx<0?1:-1);
  },{passive:true});
  el.addEventListener('touchcancel',function(){_active=false;},{passive:true});
}
function closeWeekView(){
  var el=document.getElementById('week-view-overlay');
  if(!el)return;
  el.style.transform='translateX(100%)';
  setTimeout(function(){if(el)el.style.display='none';},260);
}


function _wvTogglePicker(){
  var el=document.getElementById('week-view-overlay');
  var picker=document.getElementById('wv-picker');
  if(picker){picker.remove();return;}
  var hdr=document.getElementById('wv-header');
  var pickerEl=document.createElement('div');
  pickerEl.id='wv-picker';
  pickerEl.style.top=(hdr?hdr.offsetHeight:57)+'px';
  pickerEl.innerHTML=_wvPickerHtml();
  el.appendChild(pickerEl);
  var sel=pickerEl.querySelector('.wv-sel,.wv-cur');
  if(sel)setTimeout(function(){sel.scrollIntoView({block:'center'});},50);
}
function wvGoWeek(monKey){
  document.getElementById('wv-picker')?.remove();
  _weekViewMon=monKey;
  _wvLoad(monKey);
}
function weekViewNav(delta){
  var lim=_wvLimits();
  var d=new Date(_weekViewMon+'T12:00:00');
  d.setDate(d.getDate()+delta*7);
  var next=dk(d);
  if(next<lim.min||next>lim.max)return;
  _weekViewMon=next;
  _wvLoad(_weekViewMon,delta);
}


async function _wvLoad(monKey,delta){
  var el=document.getElementById('week-view-overlay');
  if(!el)return;
  _wvPendingKey=monKey;
  // Update header in-place or create fresh
  var hdrEl=document.getElementById('wv-header');
  var _ht=document.createElement('div');_ht.innerHTML=_wvHeader(monKey);
  if(hdrEl){hdrEl.replaceWith(_ht.firstChild);}
  else{el.innerHTML='';el.appendChild(_ht.firstChild);}
  // Ensure body wrapper
  var wrap=document.getElementById('wv-body-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='wv-body-wrap';
    wrap.style.cssText='flex:1;overflow:hidden;position:relative;';
    el.appendChild(wrap);
  }
  // Remove any stale outgoing body
  var outEl=document.getElementById('wv-body-out');
  if(outEl)outEl.remove();
  var oldBody=document.getElementById('wv-body');
  var newBody=document.createElement('div');
  newBody.id='wv-body';
  newBody.style.cssText='position:absolute;inset:0;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--bg0);';
  newBody.innerHTML=_wvBodyHtml(null,monKey);
  if(delta&&oldBody){
    oldBody.id='wv-body-out';
    var dx=delta>0?'100%':'-100%',dx2=delta>0?'-100%':'100%';
    newBody.style.transform='translateX('+dx+')';
    wrap.appendChild(newBody);
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      newBody.style.transition='transform .22s ease';
      newBody.style.transform='translateX(0)';
      oldBody.style.transition='transform .22s ease';
      oldBody.style.transform='translateX('+dx2+')';
      setTimeout(function(){if(oldBody.parentNode)oldBody.remove();},240);
    });});
  } else {
    if(oldBody)oldBody.remove();
    wrap.appendChild(newBody);
  }
  if(!window._authToken)return;
  clearTimeout(_wvFetchTimer);
  var _fKey=monKey;
  _wvFetchTimer=setTimeout(async function(){
    if(_wvPendingKey!==_fKey)return;
    try{
      const res=await fetch(CLOUD_API+'/lines/week',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({monday:_fKey})});
      const data=await res.json();
      if(_wvPendingKey!==_fKey)return;
      var bEl=document.getElementById('wv-body');
      if(bEl)bEl.innerHTML=_wvBodyHtml(data,_fKey);
    }catch(e){}
  },300);
}





// Fondu du flou d'arrière-plan à l'ouverture d'un modal (pas quand on passe d'un modal à un autre)
(function(){
  var root=document.getElementById('modal-root');if(!root||!window.MutationObserver)return;
  var wasOpen=false;
  new MutationObserver(function(){
    var ov=root.querySelector('.overlay');
    if(ov&&!wasOpen)ov.classList.add('ov-fade');
    // Fenêtre redessinée alors qu'une fenêtre était déjà ouverte (interrupteur, +/−, autre écran) : pas d'animation d'ouverture
    if(ov&&wasOpen){var sh=ov.querySelector('.sheet');if(sh&&!sh.style.animation)sh.style.animation='none';}
    wasOpen=!!ov;
  }).observe(root,{childList:true});
})();
// Swipe down to close modal
(function(){
  var startY=0,startX=0,startScroll=0,prevClientY=0,sheet=null,overlay=null,dragging=false,dirLocked=null,canClose=false,pulled=0,sc=null;
  // zone qui défile : le modal, ou son corps quand le modal a une hauteur fixe (Réglages)
  var _scOf=function(sh){return (sh.classList.contains('smod')&&sh.querySelector('.stabs-body'))||sh;};
  document.addEventListener('touchstart',function(e){
    var el=e.target.closest('.sheet');
    if(!el||el.closest('.tbpage'))return; // page d'onglet (téléphone) : pas de geste pour fermer
    startY=e.touches[0].clientY;
    startX=e.touches[0].clientX;
    prevClientY=e.touches[0].clientY;
    // tirer pour fermer marche aussi depuis un champ (Modifier en est presque couvert) ; pas depuis une zone de texte, qui défile
    if(e.target.closest('textarea'))return;
    sheet=el;overlay=el.closest('.overlay');sc=_scOf(el);
    startScroll=sc.scrollTop;
    // Le geste ne peut fermer le modal que s'il commence avec le contenu déjà tout en haut
    // (modal et zones défilantes à l'intérieur) : sinon, glisser vers le bas fait défiler
    canClose=startScroll<=0;
    for(var _n=e.target;canClose&&_n&&_n!==el;_n=_n.parentElement){if(_n.scrollTop>0&&_n.scrollHeight>_n.clientHeight+1)canClose=false;}
    dragging=true;dirLocked=null;pulled=0;
    sheet.style.transition='none';
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    // Page d'onglet (téléphone) : défilement natif d'iOS, avec son élan (pas de défilement « à la main »)
    if(e.target.closest&&e.target.closest('.tbpage .sheet'))return;
    // Block body scroll through overlay without overflow:hidden (keeps keyboard working)
    if(document.body.classList.contains('modal-open')&&!e.target.closest('.sheet')){
      e.preventDefault();return;
    }
    // Touch started on a button (dragging=false): scroll the sheet manually, block body
    if(document.body.classList.contains('modal-open')&&!dragging){
      var sh=e.target.closest('.sheet');
      if(sh){
        e.preventDefault();
        var delta=prevClientY-e.touches[0].clientY;
        _scOf(sh).scrollTop+=delta;
      } else {
        e.preventDefault();
      }
      prevClientY=e.touches[0].clientY;
      return;
    }
    if(!dragging||!sheet)return;
    var dx=Math.abs(e.touches[0].clientX-startX);
    var dy=e.touches[0].clientY-startY;
    var dyAbs=Math.abs(dy);
    // Lock direction on first decisive movement
    if(!dirLocked){
      if(dx>10||dyAbs>10) dirLocked=dx>dyAbs?'h':'v';
      else return;
    }
    if(dirLocked==='h'){dragging=false;sheet.style.transform='';sheet.style.transition='';if(overlay){overlay.classList.remove('ov-drag');['--ovh','--ovb','--ova'].forEach(function(k){overlay.style.removeProperty(k);});}return;}
    // Swipe down at top = close gesture; swipe up at bottom = prevent body overscroll
    if(dy>0&&canClose&&sc.scrollTop<=0){
      e.preventDefault();
      if(!pulled)pulled=dy; // point où le modal commence à être tiré
      sheet.style.transform='translateY('+Math.min(dy,300)+'px)';
      // Pendant le glissé : le voile ne couvre plus que la zone au-dessus du modal, où flou et assombrissement
      // s'estompent avec le geste ; derrière le modal, c'est le modal lui-même qui floute ce qu'il recouvre.
      if(overlay){
        var _k=Math.min(1,dy/260);
        overlay.classList.add('ov-drag');
        overlay.style.setProperty('--ovh',(sheet.getBoundingClientRect().top+24)+'px');
        overlay.style.setProperty('--ovb',(8*(1-_k)).toFixed(2)+'px');
        overlay.style.setProperty('--ova',(.34*(1-_k)).toFixed(3));
      }
    }else if(dy<0&&sc.scrollTop+sc.clientHeight>=sc.scrollHeight-1){
      e.preventDefault();
    }
  },{passive:false});
  document.addEventListener('touchend',function(e){
    if(!dragging||!sheet)return;
    dragging=false;
    var dy=e.changedTouches[0].clientY-startY;
    // le doigt a glissé (fenêtre tirée ou défilée) : l'appui sur le bouton où il s'était posé ne compte pas
    if(pulled||Math.abs(dy)>10)window._eatClickAt=Date.now();
    sheet.style.transition='transform .2s ease';
    // Fermeture seulement si le modal a vraiment été tiré vers le bas (pas après un simple défilement)
    if(pulled&&canClose&&dy>80){
      sheet.style.transform='translateY(100%)';
      var _tr='background .2s ease,backdrop-filter .2s ease,-webkit-backdrop-filter .2s ease';
      if(overlay){overlay.style.setProperty('--ovh','100%');overlay.style.setProperty('--ovb','0px');overlay.style.setProperty('--ova','0');}
      setTimeout(closeModal,200);
    }else{
      sheet.style.transform='';
      if(overlay){overlay.classList.remove('ov-drag');['--ovh','--ovb','--ova'].forEach(function(k){overlay.style.removeProperty(k);});}
    }
    sheet=null;overlay=null;
  },{passive:true});
})();





 // step 1=choisir jour, 2=choisir vacation

function _openExchangeOld(key){
  pendingKey=key;_lpk=key;
  _exState={step:1,targetKey:null,targetVac:null};
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  renderExchangeModal();
}

function _renderExchangeModalOld(){
  const myKey=pendingKey||_lpk;
  const date=new Date(myKey+'T12:00:00');
  const mon=getMonday(date);
  // Semaine affichée pour choisir le jour pris : la vôtre par défaut, ‹ › pour un autre semaine (cas rares)
  const _wo=_exState.wOff||0,mon2=new Date(mon);mon2.setDate(mon.getDate()+7*_wo);
  const weekDays=[];for(let i=0;i<7;i++){const d=new Date(mon2);d.setDate(mon2.getDate()+i);weekDays.push(d);}

  // Étape 1: grille des jours
  const dayBtns=weekDays.map(d=>{
    const dk2=dk(d),isSel=dk2===_exState.targetKey,isCurrent=dk2===myKey&&!isSel;
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
    const exGridCols=3; // comme la fiche du jour
    var exRows=[],_exCvn=_cycleVacList(tDate);
    if(_exCvn){
      var _exSchSet=_cycleGridScheduledVacs(tDate);
      var _exSched=_exCvn.filter(function(n){return _exSchSet.has(n);});
      var _exAccess=_exCvn.filter(function(n){return !_exSchSet.has(n);});
      window._autreVacsForDay=_exAccess;window._cycleVacsShown=_exSched;
      var _exRsz=(dw===0||dw===6)?3:4;
      for(var _ei=0;_ei<_exSched.length;_ei+=_exRsz)exRows.push(_exSched.slice(_ei,_ei+_exRsz));
      var _exLc=Object.keys(S.customVacs||{}).filter(function(v){return !(S.customVacs[v].hidden)&&!_exCvn.includes(v);});
      if(_exLc.length)exRows.push(_exLc);
      exRows.push(['SV','Vac. perso','Autre']);
    } else {
      if(dw===6)exRows=[['As1','As2','As3'],['Cs','Es','Fs'],['SV','Vac. perso','Autre']];
      else if(dw===0)exRows=[['Ad1','Ad2','Ad3'],['Cd','Ed','Fd'],['SV','Vac. perso','Autre']];
      else exRows=[['A1','A2','A3','B1'],['C1','C2','D1','D2'],['P423'],['SV','Vac. perso','Autre']];
      const customVacs=Object.keys(S.customVacs||{}).filter(function(v){return !(S.customVacs[v].hidden);});
      if(customVacs.length)exRows.splice(exRows.length-1,0,customVacs);
    }
    const allExVns=[];exRows.forEach(function(row){row.forEach(function(vn){allExVns.push(vn);});});
    let exVgHtml='<div style="display:grid;grid-template-columns:repeat('+exGridCols+',1fr);gap:8px;margin-bottom:6px">';
    allExVns.forEach(function(vn){
      if(vn==='Autre'){
        exVgHtml+='<button class="mb vt" style="background:var(--bg3);color:var(--text)" onclick="_lpk=_exState.targetKey;pendingKey=_exState.targetKey;openAutreVacModal()"><div style="font-weight:700">Autre</div></button>';
      } else if(vn==='Vac. perso'){
        exVgHtml+='<button class="mb vt" style="background:var(--bg3);color:var(--text)" onclick="openCustomVacModal()"><div style="font-weight:700">Perso</div></button>';
      } else if(vn==='SV'){
        exVgHtml+='<button class="mb vt" style="background:var(--bg3);color:var(--text)" data-exvac="SV"><div style="font-weight:700">SV</div></button>';
      } else {
        const vi=VAC[vn],dur=vi?vi.dur:0;
        if(vi&&vi.mixte)return;
        const bg=vi&&vi.dur>0?'var(--blue-l)':'var(--bg2)',cl='var(--text)';
        const durLbl=vi&&vi.dur>0?'<div style="font-size:10px;opacity:.7;font-weight:400">'+fmtMin(dur)+'</div>':'';
        exVgHtml+='<button class="mb vt" style="background:'+bg+';color:'+cl+'" data-exvac="'+vn+'"><div style="font-weight:700">'+vLbl(vn,VAC)+'</div>'+durLbl+'</button>';
      }
    });
    exVgHtml+='</div>';
    vacGrid='<div style="margin-top:10px" id="ex-vac-grid">'+exVgHtml+'</div>';
  }

  var _wk=_exState.mode==='week';
  var _modeSeg='<div class="cv-seg" style="margin-bottom:12px"><button type="button" class="'+(_wk?'':'on')+'" onclick="_exState.mode=\'day\';renderExchangeModal()">Un jour</button><button type="button" class="'+(_wk?'on':'')+'" onclick="_exState.mode=\'week\';renderExchangeModal()">Toute la semaine</button></div>';
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Échange collègue</div>'
    +_exCurHtml(myKey)
    +_modeSeg
    +(_wk?_exWeekHtml(mon):'<div style="font-size:13px;color:var(--text3);margin-bottom:8px">Jour pris au collègue (ou ce même jour, pour échanger la vacation) :</div>'
      +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><button type="button" class="ibtn" style="flex:none;width:36px;height:34px;justify-content:center;border:none;border-radius:10px;background:var(--btn);color:var(--text2);cursor:pointer" onclick="_exState.wOff=(_exState.wOff||0)-1;_exState.step=1;_exState.targetKey=null;renderExchangeModal()">‹</button>'
      +'<span style="flex:1;text-align:center;font-size:13px;color:'+(_wo?'var(--amber)':'var(--text2)')+'">'+(_wo?'Semaine du '+fmtDate(mon2):'Cette semaine')+'</span>'
      +'<button type="button" class="ibtn" style="flex:none;width:36px;height:34px;justify-content:center;border:none;border-radius:10px;background:var(--btn);color:var(--text2);cursor:pointer" onclick="_exState.wOff=(_exState.wOff||0)+1;_exState.step=1;_exState.targetKey=null;renderExchangeModal()">›</button></div>'
      +'<div class="exchange-days" id="ex-day-grid">'+dayBtns+'</div>'+vacGrid)
    +'<button class="mcancel" onclick="closeModal()">Fermer</button>'
    +'</div></div>';

  setTimeout(function(){
    const dg=document.getElementById('ex-day-grid');
    if(dg)dg.onclick=function(e){const b=e.target.closest('[data-exday]');if(b)exSelectDay(b.dataset.exday);};
    const vg=document.getElementById('ex-vac-grid');
    if(vg)vg.onclick=function(e){const b=e.target.closest('[data-exvac]');if(b)exSelectVac(b.dataset.exvac);};
  },0);
}


// Échange de semaine : on fait toute la semaine d'une autre ligne du cycle (pas d'heures sup, primes des vacations faites)
function _exWeekHtml(mon){
  var mk=dk(mon),grid=getActiveCycleGrid(mon)||_stdGrid(_poolAt(mon)),N=grid.length,VAC=getVAC(mon),base=_lineIdxBase(mon),cur=lineIdx(mon),sw=S.weekLines&&S.weekLines[mk]!=null;
  var users=_wvAdjustLines(window._exWeekData&&window._exWeekData.mk===mk?window._exWeekData.data:null,mon,N),me=window._authUser&&window._authUser.userId;
  if(!window._exWeekData||window._exWeekData.mk!==mk)_exLoadWeekUsers(mk);
  var sun=new Date(mon);sun.setDate(mon.getDate()+6);
  var h='<div style="font-size:13px;color:var(--text3);margin-bottom:10px;line-height:1.45">Semaine du '+mon.getDate()+' au '+fmtDate(sun)+'. Choisir la ligne à faire à la place de la ligne prévue : pas d\u2019heures sup, primes des vacations faites.</div>';
  if(sw)h+='<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;margin-bottom:10px;border-radius:10px;background:rgba(200,128,72,.14);font-size:13px"><span style="flex:1">Semaine échangée : <b>S'+(cur+1)+'</b> au lieu de S'+(base+1)+'.</span><button class="mb" style="min-height:0;padding:5px 10px;font-size:13px" onclick="_exWeekSet(null)">Annuler</button></div>';
  h+='<div style="display:flex;flex-direction:column;gap:6px">';
  for(var i=0;i<N;i++){
    var row=grid[i]||[],nm=(users['S'+(i+1)]||[]).filter(function(u){return u.userId!==me;}).map(function(u){return u.profileName||'?';}).join(', ');
    var isBase=i===base,isCur=i===cur;
    var cells=row.slice(0,7).map(function(c){var t=!c||c==='RH'?'–':vLbl(c,VAC);return '<span style="flex:1;min-width:0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 0;border-radius:6px;'+(t==='–'?'color:var(--text3)':'background:rgba(255,250,243,.09)')+'">'+t+'</span>';}).join('');
    h+='<button type="button" class="mb" '+(isCur?'disabled ':'')+'onclick="_exWeekPick('+i+')" style="flex-direction:row;align-items:center;gap:8px;padding:7px 10px;text-align:left;'+(isCur?'border:1.5px solid var(--blue);':'')+'">'
      +'<span style="width:56px;flex:none"><b>S'+(i+1)+'</b>'+(isBase?'<span style="display:block;font-size:10px;color:var(--blue)">ligne prévue</span>':nm?'<span style="display:block;font-size:10px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+String(nm).replace(/</g,'&lt;')+'</span>':'')+'</span>'
      +'<span style="flex:1;display:flex;gap:2px;font-size:11px">'+cells+'</span></button>';
  }
  h+='</div><button type="button" class="mb" style="width:100%;margin-top:10px;background:var(--btn);color:var(--text2)" onclick="_exOtherWeek()">Autre planning (pool, hors cycle)…</button>';
  return h;
}


// Semaine échangée avec un collègue hors cycle (pool cadre…) : vacation ou repos choisi jour par jour, enregistré en échanges d'un jour
function _exOtherWeek(){var key=pendingKey||_lpk,mon=getMonday(new Date(key+'T12:00:00')),sun=new Date(mon);sun.setDate(mon.getDate()+6);
  var JS=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],rows='';
  for(var i=0;i<7;i++){var d=new Date(mon);d.setDate(mon.getDate()+i);var k=dk(d),VAC=getVAC(d),g=getVac(d),cur=g.absent?null:(g.vac&&g.vac!=='RH'&&!(g.echange&&!g.ecSelf)?g.vac:'');
    var ns=_cycleVacList(d)||Object.keys(VAC).filter(function(n){return VAC_STD[n]||_globalVacs[n];});
    if(cur&&ns.indexOf(cur)<0)ns=[cur].concat(ns);
    // Rangées par catégorie (Son, Cadre, Coord, Réal), puis par heure de début, avec un séparateur par catégorie
    var _ok=ns.filter(function(n){var v=VAC[n];return v&&!v.mixte&&v.dur>0&&n!=='RH'&&n!=='SV';}),opts='<option value="">Repos</option>';
    _EX_CATS.forEach(function(ct){var g=_ok.filter(function(n){return _exCat(n,VAC[n])===ct;}).sort(function(a,b){return (_toMinApp(VAC[a].deb)||0)-(_toMinApp(VAC[b].deb)||0);});
      if(g.length)opts+='<optgroup label="'+ct+'">'+g.map(function(n){return '<option value="'+n+'"'+(n===cur?' selected':'')+'>'+vLbl(n,VAC)+' · '+(VAC[n].deb||'')+'–'+(VAC[n].fin||'')+'</option>';}).join('')+'</optgroup>';});
    var mine=g.cycleVac&&g.cycleVac!=='RH'?vLbl(g.cycleVac,VAC):'repos';
    rows+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:62px;flex:none;font-size:13px"><b>'+JS[i]+' '+d.getDate()+'</b><span style="display:block;font-size:10px;color:var(--text3)">prévu : '+mine+'</span></span>'
      +'<select data-exo="'+k+'"'+(g.absent||(S.conges||{})[k]?' disabled':'')+' style="flex:1;min-width:0;padding:9px 10px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);-webkit-appearance:none">'+opts+'</select></div>';}
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)renderExchangeModal()"><div class="sheet"><div class="sh"></div>'
    +'<div class="st">Autre planning</div>'
    +'<div style="font-size:13px;color:var(--text3);line-height:1.45;margin:2px 0 12px">Semaine du '+mon.getDate()+' au '+fmtDate(sun)+'. Indiquer ce qui est fait chaque jour à la place de la ligne prévue (planning du collègue). Pas d\u2019heures sup, primes des vacations faites.</div>'
    +rows
    +'<div class="mbtns" style="margin-top:12px"><button class="mb" onclick="renderExchangeModal()">Retour</button><button class="mb pri" onclick="_exOtherWeekSave()">Enregistrer</button></div></div></div>';}
function _exOtherWeekSave(){var sels=document.querySelectorAll('[data-exo]'),ch=[];
  sels.forEach(function(el){if(el.disabled)return;var k=el.getAttribute('data-exo'),d=new Date(k+'T12:00:00'),g=getVac(d),cur=g.vac&&g.vac!=='RH'&&!(g.echange&&!g.ecSelf)?g.vac:'',v=el.value;if(v!==cur)ch.push([k,v,g]);});
  if(!ch.length){renderExchangeModal();return;}
  pushUndo('Semaine échangée (autre planning)');if(!S.overrides)S.overrides={};
  ch.forEach(function(c){var k=c[0],v=c[1],g=c[2],cyc=g.cycleVac;
    if(v===(cyc&&cyc!=='RH'?cyc:'')){delete S.overrides[k];return;} // retour à la vacation prévue
    if(!v)S.overrides[k]={vac:cyc,fromSV:false,echange:true,ecSelf:false,hs:false,pair:k}; // je donne ce jour
    else S.overrides[k]={vac:v,fromSV:!cyc||cyc==='RH',echange:true,ecSelf:true,hs:false,pair:k};}); // je fais sa vacation
  logH('Semaine du '+fmtDate(getMonday(new Date(ch[0][0]+'T12:00:00')))+' : autre planning ('+ch.length+' jour'+(ch.length>1?'s':'')+')','#c88048',ch[0][0]);
  saveState();closeModal();render();gcalTrigger();}
function _exLoadWeekUsers(mk){if(!window._authToken)return;window._exWeekData={mk:mk,data:null};
  fetch(CLOUD_API+'/lines/week',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({monday:mk})}).then(function(r){return r.json();})
    .then(function(d){if(window._exWeekData&&window._exWeekData.mk===mk){window._exWeekData.data=d;if(_exState&&_exState.mode==='week'&&document.querySelector('#modal-root .cv-seg'))renderExchangeModal();}}).catch(function(){});}
function _exWeekPick(i){var mon=getMonday(new Date((pendingKey||_lpk)+'T12:00:00')),base=_lineIdxBase(mon),sun=new Date(mon);sun.setDate(mon.getDate()+6);
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)renderExchangeModal()"><div class="sheet"><div class="sh"></div>'
    +'<div class="st">'+(i===base?'Revenir à la ligne prévue':'Échanger la semaine')+'</div>'
    +'<div style="font-size:13px;color:var(--text2);line-height:1.5;margin:4px 0 14px">Du '+fmtDate(mon)+' au '+fmtDate(sun)+' : <b>S'+(i+1)+'</b>'+(i===base?'':' au lieu de S'+(base+1))+'.<br><span style="color:var(--text3);font-size:13px">Pas d\u2019heures sup. Primes, nuit et panier des vacations faites. Les modifications déjà saisies sur ces jours sont gardées.</span></div>'
    +'<div class="mbtns"><button class="mb" onclick="renderExchangeModal()">Retour</button><button class="mb pri" onclick="_exWeekSet('+i+')">Confirmer</button></div></div></div>';}
function _exWeekSet(i){var key=pendingKey||_lpk,mon=getMonday(new Date(key+'T12:00:00')),mk=dk(mon),base=_lineIdxBase(mon);
  pushUndo(i==null||i===base?'Échange de semaine annulé':'Semaine échangée');if(!S.weekLines)S.weekLines={};
  if(i==null||i===base)delete S.weekLines[mk];else S.weekLines[mk]=i;
  var _wp='Semaine du '+fmtDate(mon)+' : ';if(S.history)S.history=S.history.filter(function(h){return String(h.d||'').indexOf(_wp)!==0;});
  if(!(i==null||i===base))logH(_wp+'échangée avec S'+(i+1),'#c88048',key);
  saveState();closeModal();render();gcalTrigger();}
function exSelectDay(dk2){
  // Le même jour est permis : « ce jour-là je fais la vacation de mon collègue »
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
    var _same=_exState.targetKey===myKey;
    durInfo='<div style="font-size:13px;color:var(--text2);margin-bottom:6px">'+(_same?'Ce jour-là : <b>'+vLbl(vn,VAC)+'</b> au lieu de '+vLbl(getVac(myDate).vac||myCv,VAC)+'.':'Le '+fmtDate(myDate)+' donné, <b>'+vLbl(vn,VAC)+'</b> pris le '+fmtDate(new Date(_exState.targetKey+'T12:00:00'))+'.')+'</div>';
  }
  // Échange entre collègues : à votre initiative, donc jamais d'heures sup (accord VIII.5)
  const exHsToggle='<div style="font-size:11px;color:var(--text3);line-height:1.45;margin-bottom:6px">Pas d\u2019heures sup : un échange entre collègues compte les heures prévues. Primes de la vacation faite.</div>';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">\u00c9change — '+vn+'</div>'
    +durInfo+exHsToggle
    +'<div class="mbtns" style="margin-top:12px"><button class="mb" onclick="renderExchangeModal()">Retour</button><button class="mb pri" onclick="confirmExchange()">Confirmer</button></div>'
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
  var hsEx=false; // un échange entre collègues ne crée pas d'heures sup : la semaine garde ses heures prévues
  pushUndo('Échange enregistré');
  if(!S.overrides)S.overrides={};
  // myKey: mon jour original que je DONNE au collègue → je suis absent (gris)
  if(_exState.targetKey!==myKey)S.overrides[myKey]={vac:myOrigVacName,fromSV:false,echange:true,ecSelf:false,hs:hsEx,pair:_exState.targetKey};
  // targetKey: le jour que je PRENDS → je travaille la nouvelle vacation (orange) ; même jour : la vacation change seulement
  S.overrides[_exState.targetKey]={vac:_exState.targetVac,fromSV:!theirCycle||theirCycle==='RH',echange:true,ecSelf:true,hs:hsEx,pair:myKey};
  logH('Échange: '+fmtDate(date)+' <-> '+fmtDate(targetDate)+' ('+_exState.targetVac+(hsEx?' HS':'')+')', '#c88048', myKey);
  saveState();closeModal();render();
  gcalTrigger();
}


function _fitDropdown(el){
  const margin=8,vw=window.innerWidth;
  el.style.left='';el.style.right='0';
  const r=el.getBoundingClientRect();
  if(r.left<margin){
    const pr=el.offsetParent?el.offsetParent.getBoundingClientRect():{left:0,right:vw};
    el.style.right='auto';
    el.style.left=(margin-pr.left)+'px';
  }
}
function toggleDropdown(id){
  const el=document.getElementById(id);if(!el)return;
  const wasOpen=el.style.display!=='none';
  document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');
  document.removeEventListener('click',_ddClose,true);
  if(!wasOpen){
    el.style.display='block';
    if(id==='dd-history')renderHistoryDropdown();
    requestAnimationFrame(()=>_fitDropdown(el));
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
  if(closed){
    e.stopPropagation();e.preventDefault();
  }
  if(!anyOpen)document.removeEventListener('click',_ddClose,true);
}

function openSettingsModal(tab){
  tab=tab!==undefined?tab:0;
  var wasOpen=document.body.classList.contains('modal-open');
  if(!wasOpen)_lockBodyScroll();
  var pr=_profs[_aid];if(!pr)return;
  var pid=_aid;
  window._settingsPid=pid;
  var _diff=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
  var _palHist=pr.profile.palierHistory||[];
  var _heurHist=pr.profile.heuresHistory||[];
  var _curPalier=_palHist.length?_palHist[_palHist.length-1].v:(pr.profile.palierNum||'');
  var _curAncYears=pr.profile.ancYears!=null?pr.profile.ancYears:'';
  var _curHeur=_heurHist.length?_heurHist[_heurHist.length-1].v:(pr.profile.heuresMensuelles||151.67);
  var _curPct=Math.round(_curHeur/151.67*100*10)/10;
  var _inp='width:100%;height:36px;box-sizing:border-box;padding:6px 8px;border:0.5px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg2);color:var(--text)';
  var _lbl=function(t){return'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">'+t+'</label>';};
  var _sec=function(t){return'<div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin:10px 0 6px">'+t+'</div>';};
  var _inf=function(t){return'<span style="display:block;font-size:11px;color:var(--text3);font-weight:400;margin-top:2px;line-height:1.35">'+t+'</span>';};
  function mkTgl(id,label,checked,history,key,xpid){
    var histBtn=key&&xpid?'<button data-key="'+key+'" data-pid="'+xpid+'" onmousedown="event.preventDefault();toggleHistPanel(this)" style="background:transparent;border:none;color:var(--text3);font-size:11px;cursor:pointer;padding:0 4px;margin-right:4px"><i class="ti ti-history" style="font-size:11px"></i></button>':'';
    var pidAttr=xpid?' data-pid="'+xpid+'" onchange="applySettingsFromDD(this.dataset.pid,this)"':'';
    return'<div class="srow" style="padding:5px 0"><div class="slbl" style="font-size:13px">'+label+'</div><div style="display:flex;align-items:center">'+histBtn+'<label class="tgl"><input type="checkbox" id="'+id+'"'+(checked?' checked':'')+pidAttr+'><span class="tgl-s"></span></label></div></div>';
  }
  // ── TAB 0: COMPTE (profil, Google, notifications, compte) ──
  var _inpR='width:120px;height:32px;box-sizing:border-box;padding:4px 8px;border:0.5px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg0);color:var(--text)';
  var _pidLit=JSON.stringify(pid);
  var _onb='onblur="saveProfileFromDD('+_pidLit+')"';
  var _onc='onchange="saveProfileFromDD('+_pidLit+')"';
  var _gcalAs=pr.profile.gcalAutoSync?'checked':'';
  var _sr='style="padding:6px 0"';
  var _bS='class="mb" style="width:120px;height:32px;min-height:32px;padding:0;font-size:13px;background:var(--btn);flex-shrink:0"';
  // sections en cases : _sh ferme la case précédente et ouvre le titre, _co ouvre la case suivante
  var _sh='</div><div class="scard-h">',_co='<div class="scard">';
  var _pOn=_pushIsOn();
  var tab0='<div class="scard-h">Profil</div>'+_co
    // ─ Profil ─
    +'<div class="srow" '+_sr+'><div class="slbl">Nom</div><input id="ps-name" '+_onb+' value="'+_h(pr.profile.name||'')+'" style="'+_inpR+'"></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Ligne actuelle'+_inf('cycle de vacations')+'</div><button '+_bS+' data-pid="'+pid+'" onclick="openChangeLigneModal(this.dataset.pid)">Changer</button></div>'
    // ─ Google Agenda ─
    +_sh+'Google Agenda</div>'+_co
    +'<div id="gcal-disconnected-row"><div class="srow" '+_sr+'><div class="slbl">Google Agenda</div><button '+_bS+' id="gcal-btn" onclick="gcalHandleClick()">Connecter</button></div></div>'
    +'<div id="gcal-connected-rows" style="display:none">'
    +'<div class="srow" '+_sr+'><div class="slbl">Synchroniser manuellement</div><button '+_bS+' id="gcal-sync-icon-btn" onclick="gcalHandleClick()">Synchroniser</button></div>'
    +(function(){
      var _m=S.profile&&S.profile.gcalAutoSync!==false;
      var _tx=_m?'translateX(0)':'translateX(calc(100% + 2px))';
      var _s0=_m?'font-weight:600;color:var(--text)':'font-weight:400;color:var(--text3)';
      var _s1=_m?'font-weight:400;color:var(--text3)':'font-weight:600;color:var(--text)';
      return '<div class="srow" '+_sr+'><div class="slbl">Auto-sync</div>'
        +'<input type="checkbox" id="gcal-as-tgl" '+(_m?'checked':'')+' style="display:none">'
        +'<div style="width:120px;height:32px;border-radius:999px;background:var(--bg3);border:0.5px solid var(--border);position:relative;display:flex;cursor:pointer;flex-shrink:0"'
        +' onclick="gcalToggleAutoSync();var _m=S.profile&&S.profile.gcalAutoSync!==false,_pl=this.querySelector(\'.as-pill\'),_lb=this.querySelectorAll(\'.as-lbl\');if(_pl)_pl.style.transform=_m?\'translateX(0)\':\'translateX(calc(100% + 2px))\';if(_lb[0]){_lb[0].style.fontWeight=_m?\'600\':\'400\';_lb[0].style.color=_m?\'var(--text)\':\'var(--text3)\';};if(_lb[1]){_lb[1].style.fontWeight=_m?\'400\':\'600\';_lb[1].style.color=_m?\'var(--text3)\':\'var(--text)\';}">'
        +'<div class="as-pill" style="position:absolute;top:2px;bottom:2px;width:calc(50% - 3px);left:2px;border-radius:999px;background:var(--btn);box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s ease;transform:'+_tx+'"></div>'
        +'<span class="as-lbl" style="flex:1;text-align:center;font-size:10px;line-height:32px;position:relative;z-index:1;'+_s0+'">Actif</span>'
        +'<span class="as-lbl" style="flex:1;text-align:center;font-size:10px;line-height:32px;position:relative;z-index:1;'+_s1+'">Inactif</span>'
        +'</div></div>';
    })()
    +'<div class="srow" '+_sr+'><div class="slbl">Couleurs Google</div><button '+_bS+' onclick="openGcalColorsModal()">Changer</button></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Effacer'+_inf('événements Google Agenda')+'</div><button '+_bS+' id="gcal-clear-btn" onclick="gcalClear()">Effacer</button></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Déconnecter'+_inf('retirer l’accès')+'</div><button '+_bS+' id="gcal-disconnect-btn" onclick="gcalDisconnect()">Déconnecter</button></div>'
    +'</div>'
    +_sh+'Notifications</div>'+_co
    +'<div class="srow" '+_sr+'><div class="slbl">Rappels <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">heures qui expirent (14 j et 3 j avant), bulletin le 1er, tableau Gestion le 20</span></div>'
    +'<div style="display:flex;align-items:center;flex-shrink:0">'+(_pOn?'<button class="adj-pill" style="width:auto;height:26px;padding:0 12px;font-size:11px;margin-right:8px;flex-shrink:0" onclick="pushTest(this)">Tester</button>':'')
    +'<label class="tgl"><input type="checkbox" id="push-toggle"'+(_pOn?' checked':'')+' onchange="pushToggle(this)"><span class="tgl-s"></span></label></div></div>'
    // ─ Compte ─
    +'<div class="srow" '+_sr+'><div class="slbl">Vibrations <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">petit retour aux appuis (iPhone : Retour haptique du système activé)</span></div>'
    +'<label class="tgl" style="flex-shrink:0"><input type="checkbox" id="hap-tgl"'+(_hapOff()?'':' checked')+' onchange="try{localStorage.setItem(\'hap_off\',this.checked?\'0\':\'1\');}catch(e){}"><span class="tgl-s"></span></label></div>'
    +_sh+'Compte</div>'+_co
    +'<div class="srow" '+_sr+'><div class="slbl">Changer d’utilisateur</div><button '+_bS+' onclick="signOut()">Changer</button></div>'
    +'<div class="srow" '+_sr+'><div class="slbl" style="color:var(--red)">Supprimer le profil</div><button class="mb del" style="width:120px;height:32px;min-height:32px;padding:0;font-size:13px;border:none" onclick="deleteCurrentProfile()">Supprimer</button></div>'
  tab0+='</div>';
  tab0+='<div style="text-align:center;font-size:11px;color:var(--text3);margin:10px 0 2px">Version '+_h(_appVer||'?')+'</div>'; // version de l'app (mises à jour installées en quittant l'app)
  // ── TAB 1: PAIE + RENDUS ──
  var palierOpts='<option value="">—</option>';
  for(var pi=1;pi<=100;pi++)palierOpts+='<option value="'+pi+'"'+(_curPalier&&pi===parseInt(_curPalier)?' selected':'')+'>P'+pi+'</option>';
  palierOpts+='<option value="christophe"'+((_curPalier==='christophe')?' selected':'')+'>Christophe</option>';
  var ancOpts='<option value="">—</option>';
  for(var ai=0;ai<=50;ai++){var al=ai===0?'0 an':(ai===1?'1 an':ai+' ans');ancOpts+='<option value="'+ai+'"'+((_curAncYears!==''&&ai===Math.round(parseFloat(_curAncYears)||0))?' selected':'')+'>'+al+'</option>';}
  var heurOpts='<option value="">—</option>';
  for(var hp=5;hp<=100;hp+=5){heurOpts+='<option value="'+hp+'"'+(hp===Math.round(parseFloat(_curPct)||0)?' selected':'')+'>'+hp+'%</option>';}
  var _selR='width:120px;height:32px;box-sizing:border-box;padding:0 26px 0 12px;border:0.5px solid var(--border);border-radius:999px;font-size:13px;background:var(--bg0) url(&quot;data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 fill=%27none%27 stroke=%27%23a8a49c%27 stroke-width=%271.5%27/%3E%3C/svg%3E&quot;) no-repeat right 11px center;-webkit-appearance:none;appearance:none;color:var(--text)';
  var _subV='style="font-size:10px;color:var(--text3);text-align:right;min-width:52px;flex-shrink:0"';
  var _rCol='style="display:flex;align-items:center;gap:6px"';
  var _palLbl=_curPalier?(_curPalier==='christophe'?fmtEuro(100000):fmtEuro(calcPalierSalaire(parseInt(_curPalier)))):'';
  var _ancLbl=_curAncYears!==''?fmtEuro(calcAncPrime(parseFloat(_curAncYears))):'';
  var _heurLbl=_curHeur?(Math.round(_curHeur*100)/100).toFixed(2).replace('.',',')+' h':'';
  var _curGrp=getGroupeForYM(TODAY_YM);
  var _grpLbl=_curGrp?('Gr. '+_curGrp+' | '+calcGPE(_curGrp,TODAY_YM)+' €'):'—';
  var _curSft=getSupFamilialForYM(TODAY_YM);
  var _oncPal='onchange="window._sMP=true;openPalierModal()"';
  var _oncAnc='onchange="window._sMP=true;openAncModal()"';
  var _oncHeur='onchange="window._sMP=true;openContratModal()"';
  var _hasBul=Object.keys(S.bulletins||{}).length>0;
  var tab1=''
    // Palier, contrat, groupe et ancienneté lus sur les bulletins (pré-remplissage, augmentations datées)
    +_verifRow(1,_hasBul?'':'<button class="adj-pill" style="width:auto;padding:0 14px;height:32px;font-size:13px;white-space:nowrap" onclick="importBulletins(function(){openSettingsModal(1);})">+ Bulletin</button>')
    +'<div class="scard-h">Salaire</div>'+_co
    +'<div class="srow" '+_sr+'><div class="slbl">Palier'+_inf('salaire de qualification')+'</div><div '+_rCol+'><div id="ps-palier-lbl" '+_subV+'>'+_palLbl+'</div><select id="ps-palier" '+_oncPal+' style="'+_selR+'">'+palierOpts+'</select></div></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Ancienneté'+_inf('prime mensuelle')+'</div><div '+_rCol+'><div id="ps-salanc-lbl" '+_subV+'>'+_ancLbl+'</div><select id="ps-salanc" '+_oncAnc+' style="'+_selR+'">'+ancOpts+'</select></div></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Contrat'+_inf('taux de travail')+'</div><div '+_rCol+'><div id="ps-heures-lbl" '+_subV+'>'+_heurLbl+'</div><select id="ps-heures" '+_oncHeur+' style="'+_selR+'">'+heurOpts+'</select></div></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Groupe'+_inf('indemnité GPE')+'</div><div '+_rCol+'><div id="ps-groupe-lbl" '+_subV+'>'+_grpLbl+'</div><select id="ps-groupe" onchange="window._sMP=true;openGroupeModal()" style="'+_selR+'"><option value="">—</option>'+[1,2,3,4,5,6,7,8,9].map(function(g){return '<option value="'+g+'"'+(g===_curGrp?' selected':'')+'>Gr. '+g+'</option>';}).join('')+'</select></div></div>'
    +(function(){
      var _m=!!pr.profile.pfaMensuelle;
      var _tx=_m?'translateX(0)':'translateX(calc(100% + 2px))';
      var _s0=_m?'font-weight:600;color:var(--text)':'font-weight:400;color:var(--text3)';
      var _s1=_m?'font-weight:400;color:var(--text3)':'font-weight:600;color:var(--text)';
      return '<div class="srow" '+_sr+'><div class="slbl">PFA'+_inf('prime de fin d’année')+'</div>'
        +'<div style="width:120px;height:32px;border-radius:999px;background:var(--bg3);border:0.5px solid var(--border);position:relative;display:flex;cursor:pointer;flex-shrink:0"'
        +' onclick="var _p=_profs[_aid];if(!_p)return;_p.profile.pfaMensuelle=!_p.profile.pfaMensuelle;saveState();var _m=!!_p.profile.pfaMensuelle,_pl=this.querySelector(\'.pfa-pill\'),_lb=this.querySelectorAll(\'.pfa-lbl\');if(_pl)_pl.style.transform=_m?\'translateX(0)\':\' translateX(calc(100% + 2px))\';if(_lb[0]){_lb[0].style.fontWeight=_m?\'600\':\'400\';_lb[0].style.color=_m?\'var(--text)\':\' var(--text3)\';}if(_lb[1]){_lb[1].style.fontWeight=_m?\'400\':\'600\';_lb[1].style.color=_m?\'var(--text3)\':\' var(--text)\';}">'
        +'<div class="pfa-pill" style="position:absolute;top:2px;bottom:2px;width:calc(50% - 3px);left:2px;border-radius:999px;background:var(--btn);box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s ease;transform:'+_tx+'"></div>'
        +'<span class="pfa-lbl" style="flex:1;text-align:center;font-size:10px;line-height:32px;position:relative;z-index:1;'+_s0+'">Mensuel</span>'
        +'<span class="pfa-lbl" style="flex:1;text-align:center;font-size:10px;line-height:32px;position:relative;z-index:1;'+_s1+'">Semestriel</span>'
        +'</div></div>';
    })()
    +'<div class="srow" '+_sr+'><div class="slbl">Suppl. familial'+_inf('SFT mensuel brut')+'</div><div '+_rCol+'><div id="ps-sft-lbl" '+_subV+'>'+(_curSft>0?fmtEuro(_curSft):'—')+'</div><button onclick="window._sMP=true;openSupFamilialModal()" style="'+_selR+';cursor:pointer;text-align:center;background:var(--btn);padding:0 6px">Modifier</button></div></div>'
    // Avantage individuel acquis (salariés embauchés avant l'accord) : saisi ici sans bulletin, sinon proposé par la Vérification
    +(function(){var av=getPrimesFixesCustomForYM(TODAY_YM).filter(function(p){return /INDIV/i.test(p.label);}).reduce(function(s,p){return s+p.montant;},0);
      return '<div class="srow" '+_sr+'><div class="slbl">Av. indiv. acquis'+_inf('embauche avant l’accord')+'</div><div '+_rCol+'><div '+_subV+'>'+(av>0?fmtEuro(av):'—')+'</div><button onclick="window._sMP=true;openAddPrimeFixeModal(TODAY_YM,1,1)" style="'+_selR+';cursor:pointer;text-align:center;background:var(--btn);padding:0 6px">Modifier</button></div></div>';})()
    +_sh+'Primes fixes</div>'+_co
    +(function(){
      // Primes de la convention (NAO…) : à cocher selon ce que tu touches
      var off=pr.profile.primesConvOff||{};
      return getPrimesConvAllForYM(TODAY_YM).map(function(p){
        return '<label style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border);cursor:pointer">'
          +'<span style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);min-width:0"><input type="checkbox" '+(off[p.id]?'':'checked ')+'onchange="togglePrimeConv(\''+p.id+'\',this.checked);this.closest(\'label\').lastChild.style.color=this.checked?\'var(--amber)\':\'var(--text3)\'" style="width:16px;height:16px;accent-color:var(--blue);flex-shrink:0">'+p.label+'</span>'
          +'<span style="font-size:13px;color:'+(off[p.id]?'var(--text3)':'var(--amber)')+'">+'+fmtEuro(p.montant)+'</span></label>';
      }).join('');
    })()
    +(function(){
      // avantage indiv. : sa propre ligne plus haut, pas dans la liste
      var pfc=pr.profile.primesFixesCustom||[];
      var rows=pfc.filter(function(p){return (p.finYM==null||p.finYM>=TODAY_YM)&&!/INDIV/i.test(p.label);}).map(function(p){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--border)">'
          +'<span style="font-size:13px;color:var(--text2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_h(p.label)+'<span style="color:var(--text3)">'+_pfPeriod(p)+'</span></span>'
          +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
          +'<span style="font-size:13px;color:var(--amber)">+'+fmtEuro(p.montant)+'</span>'
          +'<button onclick="openDeletePrimeFixeModal(\''+p.id+'\',TODAY_YM);window._pfFromSettings=true" style="width:20px;height:20px;border-radius:50%;border:0.5px solid var(--border);background:transparent;color:var(--red);cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center">×</button>'
          +'</div></div>';
      }).join('');
      return (rows?'<div style="margin-bottom:8px">'+rows+'</div>':'')
        +'<button onclick="openAddPrimeFixeModal(TODAY_YM,true)" style="margin:10px 0;width:100%;height:32px;font-size:13px;background:transparent;color:var(--blue);border:0.5px solid var(--blue);border-radius:var(--r);cursor:pointer;font-family:var(--font)">+ Ajouter une prime</button>';
    })()
  tab1+='</div>';
  // ── TAB 2: CALCUL (départ, génération des rendus, mes données) ──
  var _todayEff=settingsForYM(TODAY_YM);
  var _rendDots=[['dimRendu','Dim'],['rhRendu','RH'],['ferRendu','Fér'],['hsRendu','HS']].map(function(x){
    var on=_todayEff[x[0]];
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px">'
      +'<span style="font-size:10px;color:var(--text3)">'+x[1]+'</span>'
      +'<span style="font-size:18px;color:'+(on?'var(--blue)':'var(--text3)')+'">'+(on?'●':'○')+'</span>'
      +'</div>';
  }).join('');
  var tab2=''
    +'<div class="scard-h">Départ du calcul</div>'+_co
    // une date de départ et les soldes à cette date ; les tableaux Gestion plus récents servent à vérifier (onglet Paie)
    +(function(){var st=pr.profile.start,b='class="adj-pill" style="width:120px;height:32px;font-size:13px;white-space:nowrap"';
      return '<div class="srow" '+_sr+'><div class="slbl">Départ <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">'+_startTxt(st).split(' · ')[0]+'</span></div><button '+b+' onclick="openStartModal()">Changer</button></div>'
        +'<div class="srow" '+_sr+'><div class="slbl">Matelas au départ <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">stock permanent</span></div><input id="ps-matelas" '+_onb+' value="'+fmtMin(st?st.mat||0:pr.profile.matelas||0)+'" onfocus="if(this.value)this.select()" style="'+_inpR+'"></div>'
        +'<div class="srow" '+_sr+'><div class="slbl">Heures de rendus au départ <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">encore à poser</span></div><input id="ps-eph" '+_onb+' value="'+fmtMin(st?Object.values(st.base||{}).reduce(function(a,b){return a+b;},0):Math.round((pr.profile.ephSolde||0)*60))+'" onfocus="if(this.value)this.select()" style="'+_inpR+'"></div>';})()
    +'<div class="srow" '+_sr+'><div class="slbl">CET <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">compte épargne-temps initial</span></div><input id="ps-cet-init" type="number" '+_onb+' value="'+(pr.profile.cetInit||0)+'" onfocus="if(this.value)this.select()" style="'+_inpR+'"></div>'
    +_sh+'Génération des rendus</div>'+_co
    +'<div class="srow" '+_sr+'><div style="display:flex;gap:20px;align-items:center;flex:1;padding-left:4px">'+_rendDots+'</div><button '+_bS+' onclick="openAnnualSettingsModal('+new Date().getFullYear()+')">Changer</button></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Heures valables un an <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">reports toujours accordés</span></div><label class="tgl"><input type="checkbox"'+(pr.profile.exp12?' checked':'')+' onchange="exp12Set(this.checked)"><span class="tgl-s"></span></label></div>'
    +'<div class="srow" '+_sr+'><div class="slbl">Heures sup d’une vacation changée <span style="display:block;color:var(--text3);font-size:11px;margin-top:2px;line-height:1.35">'+(_hsMode()==='horaires'?'ce qui sort des horaires prévus (comme une mixte)':'la plus longue des deux, prévue ou faite')+'</span></div>'
      +'<div class="cv-seg" style="width:170px;flex:none"><button type="button" class="'+(_hsMode()==='duree'?'on':'')+'" onclick="hsModeSet(\'duree\',this)">Durée</button><button type="button" class="'+(_hsMode()==='horaires'?'on':'')+'" onclick="hsModeSet(\'horaires\',this)">Horaires</button></div></div>'
    +_sh+'Mes données</div>'+_co
    // Historique côté serveur : une version par jour, 60 jours
    +'<div class="srow" '+_sr+'><div class="slbl">Sauvegardes</div><button '+_bS+' onclick="_histOpen()">Voir</button></div>'
    // Version remplacée par le cloud au chargement (30 jours) : peut être remise si le cloud contenait de mauvaises données
    +(function(){var k=null;try{k=JSON.parse(localStorage.getItem('pl_bak')||'null');}catch(e){}
      if(!k||!k.d||(k.u&&k.u!==_plU())||Date.now()-k.at>30*864e5)return '';
      var dt=new Date(k.at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' '+new Date(k.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      return '<div class="srow" '+_sr+'><div class="slbl">Version d’avant sur cet appareil<span style="display:block;font-size:11px;color:var(--text3);margin-top:2px;line-height:1.45">remplacée par le cloud le '+dt+'<br>'+(function(x){var t=function(re){return x.filter(function(y){return re.test(y);}).join(' · ');};var A=/^[✓✗]|tableau Gestion/;return [t(A),t(/^\d/),x.filter(function(y){return !A.test(y)&&!/^\d/.test(y);}).join(' · ')].filter(Boolean).join('<br>');})(_bakSum(k.d).split(' · '))+'</span></div><button '+_bS+' onclick="_restoreBak()">Restaurer</button></div>';})();
  tab2+='</div>';
  var tabBtnS='flex:1;padding:8px 6px;font-size:13px;border:none;cursor:pointer;border-radius:8px;text-align:center;';
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay"'+(wasOpen?' style="animation:none"':'')+' onclick="if(event.target===this)closeModal()"><div class="sheet smod"'+(wasOpen?' style="animation:none"':'')+'>'
    +'<div class="sh"></div>'
    +'<div class="stabs-row">'
    +'<div class="stabs-sp"></div>'
    +'<div class="stabs-bar">'
    +'<div id="stp-pill" class="seg-pill" style="position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 10px) / 3);border-radius:8px;background:var(--bg2);box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s ease;pointer-events:none;z-index:-1"></div>'
    +'<button id="stp-0" onclick="settingsTab(0)" style="'+tabBtnS+'background:transparent;font-weight:600;color:var(--seg-tx-on)">Compte</button>'
    +'<button id="stp-1" onclick="settingsTab(1)" style="'+tabBtnS+'background:transparent;font-weight:400;color:var(--seg-tx)">Paie</button>'
    +'<button id="stp-2" onclick="settingsTab(2)" style="'+tabBtnS+'background:transparent;font-weight:400;color:var(--seg-tx)">Calcul</button>'
    +'</div>'
    +'<button class="sh-x" onclick="closeModal()"><i class="ti ti-x"></i></button>'
    +'</div>'
    +'<div class="stabs-body" style="display:grid">'
    +'<div id="stc-0" style="grid-area:1/1">'+tab0+'</div>'
    +'<div id="stc-1" style="grid-area:1/1;visibility:hidden;pointer-events:none">'+tab1+'</div>'
    +'<div id="stc-2" style="grid-area:1/1;visibility:hidden;pointer-events:none">'+tab2+'</div>'
    +'</div>'
    +'</div></div>';
  settingsTab(tab);
  gcalUpdateBtn();
  // Swipe left/right between tabs (mobile)
  requestAnimationFrame(function(){
    // Equalize tab heights: reveal all panels, measure, then lock minHeight on each
    var _panels=[document.getElementById('stc-0'),document.getElementById('stc-1'),document.getElementById('stc-2')];
    var _hidden=[];
    _panels.forEach(function(p){if(p&&p.style.display==='none'){p.style.display='block';p.style.visibility='hidden';_hidden.push(p);}});
    var _maxH=0;
    _panels.forEach(function(p){if(p)_maxH=Math.max(_maxH,p.scrollHeight);});
    _hidden.forEach(function(p){p.style.display='none';p.style.visibility='';});
    var _cap=Math.round(window.innerHeight/_zoomFix()*0.7);
    void _cap;
    var _sh=document.querySelector('#modal-root .sheet');
    if(!_sh)return;
    var _sx=0,_sy=0,_skip=true;
    // Appui sur une case : pas de glissement (avant, la fin de l'appui comparait à une ancienne position et renvoyait sur Profil)
    var _lk=0;
    _sh.addEventListener('touchstart',function(e){
      _skip=!!e.target.closest('select,input,textarea,.tgl')||e.touches.length>1;
      _sx=e.touches[0].clientX;_sy=e.touches[0].clientY;_lk=0;
    },{passive:true});
    // geste horizontal : le contenu ne défile plus (il montait et descendait pendant le glissement)
    _sh.addEventListener('touchmove',function(e){if(_skip||_lk<0)return;var dx=e.touches[0].clientX-_sx,dy=e.touches[0].clientY-_sy;
      if(!_lk){if(Math.abs(dx)<8&&Math.abs(dy)<8)return;_lk=Math.abs(dx)>Math.abs(dy)?1:-1;}
      if(_lk>0&&e.cancelable)e.preventDefault();},{passive:false});
    _sh.addEventListener('touchend',function(e){
      if(_skip)return;
      var dx=e.changedTouches[0].clientX-_sx;
      var dy=e.changedTouches[0].clientY-_sy;
      if(_lk>0&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){
        var cur=0;for(var _ti=0;_ti<3;_ti++){var _tp=document.getElementById('stc-'+_ti);if(_tp&&_tp.style.display!=='none')cur=_ti;}
        var nxt=dx<0?Math.min(cur+1,2):Math.max(cur-1,0);
        if(nxt!==cur)settingsTab(nxt);
      }
    },{passive:true});
  });
}

function settingsTab(n){window._stLast=n;
  var _tx=['translateX(0)','translateX(calc(100% + 2px))','translateX(calc(200% + 4px))'];
  [0,1,2].forEach(function(i){
    var c=document.getElementById('stc-'+i);
    var b=document.getElementById('stp-'+i);
    if(c){c.style.display=i===n?'':'none';c.style.visibility='';c.style.pointerEvents=i===n?'':'none';}
    if(b){b.style.fontWeight=i===n?'600':'400';b.style.color=i===n?'var(--seg-tx-on)':'var(--seg-tx)';}
  });
  var _p=document.getElementById('stp-pill');if(_p)_p.style.transform=_tx[n]||_tx[0];
  var _bd=document.querySelector('#modal-root .stabs-body');if(_bd)_bd.scrollTop=0;
  _icoPop(document.getElementById('stc-'+n));
}

 // ps-panel always visible

function saveProfileFromDD(pid){
  const pr=_profs[pid];if(!pr)return;
  // Read oldLine BEFORE modifying pr (pr is a reference to _profs[pid])
  const oldLine=pr.profile&&pr.profile.anchorLine;
  const n=document.getElementById('ps-name');if(n)pr.profile.name=n.value.trim()||pr.profile.name;
  // Line is now changed via openChangeLigneModal
  // soldes de départ retouchés : départ « saisi » à la même date
  {const st=pr.profile.start,mi=document.getElementById('ps-matelas'),ei=document.getElementById('ps-eph');
    if(st&&mi&&ei&&mi.value.trim()&&ei.value.trim()){const m=parseHM(mi.value),e=parseHM(ei.value),e0=Object.values(st.base||{}).reduce(function(a,b){return a+b;},0);
      if(m>=0&&e>=0&&(Math.abs(m-(st.mat||0))>1||Math.abs(e-e0)>1)){const n=Object.assign({},st,{k:'man',mat:m,cons:{},stk:{}});delete n.recon;
        if(Math.abs(e-e0)>1){n.base={};if(e>0)n.base[st.genFrom-1]=e;}_startApply(n);}}}
  const cetInit=document.getElementById('ps-cet-init');if(cetInit){const v=parseInt(cetInit.value);if(!isNaN(v)&&v>=0)pr.profile.cetInit=v;}
  const _pd=s=>{const p=(s||'').trim().split('/');if(p.length!==2)return null;const _m=parseInt(p[0]),_y=parseInt(p[1]);return(!isNaN(_m)&&!isNaN(_y)&&_m>=1&&_m<=12&&_y>=2020&&_y<=2035)?_y*12+(_m-1):null;};
  const _histUps=(arr,ym,v)=>{const i=arr.findIndex(e=>e.ym===ym);if(i>=0)arr[i].v=v;else arr.push({ym,v});arr.sort((a,b)=>a.ym-b.ym);};
  const _palierEl=document.getElementById('ps-palier'),_palierDepEl=document.getElementById('ps-palier-dep');
  if(_palierEl&&_palierEl.value.trim()){const _pn=parseInt(_palierEl.value);if(_pn>=1){pr.profile.palierNum=_pn;pr.profile.salaireQualif=calcPalierSalaire(_pn);const _pd2=_pd(_palierDepEl&&_palierDepEl.value);if(_pd2!==null){if(!pr.profile.palierHistory)pr.profile.palierHistory=[];_histUps(pr.profile.palierHistory,_pd2,_pn);}}}
  const _ancYrsEl=document.getElementById('ps-salanc'),_ancMoisEl=document.getElementById('ps-anc-mois');
  if(_ancYrsEl&&_ancYrsEl.value!==''){const _ay=parseFloat(_ancYrsEl.value)||0;pr.profile.ancYears=_ay;pr.profile.ancRefYM=TODAY_YM;const _am=parseInt((_ancMoisEl||{}).value);if(!isNaN(_am)&&_am>=0)pr.profile.ancMoisAnni=_am;pr.profile.primeAnciennete=calcAncPrime(_ay);}
  const _psheur=document.getElementById('ps-heures'),_heurDepEl=document.getElementById('ps-heur-dep');
  if(_psheur){const _pct=parseFloat(_psheur.value);if(_pct>0){const _hv=Math.round(_pct*151.67/100*100)/100;pr.profile.heuresMensuelles=_hv;const _pd4=_pd(_heurDepEl&&_heurDepEl.value);if(_pd4!==null){if(!pr.profile.heuresHistory)pr.profile.heuresHistory=[];_histUps(pr.profile.heuresHistory,_pd4,_hv);}}}
  const _pfamens=document.getElementById('ps-pfamens');if(_pfamens)pr.profile.pfaMensuelle=_pfamens.checked;
  const newLine=pr.profile.anchorLine;
  _profs[pid]=pr;if(pid===_aid)S=pr;saveState();render();
  const _hpn=document.getElementById('hdr-profile-name');if(_hpn&&S.profile)_hpn.textContent=S.profile.name||'Profil';
}



function _depGetDate(){var m=parseInt((document.getElementById('_dep-m')||{}).value),y=parseInt((document.getElementById('_dep-y')||{}).value);return(!isNaN(m)&&!isNaN(y))?m+'/'+y:null;}
function openPalierModal(){
  var curN=parseInt((document.getElementById('ps-palier')||{}).value)||0;
  var curDep=(document.getElementById('ps-palier-dep')||{}).value||'',p=curDep.split('/');
  var now=new Date(),iM=p.length===2?parseInt(p[0]):now.getMonth()+1,iY=p.length===2?parseInt(p[1]):now.getFullYear();
  _depField={inputId:'ps-palier',depId:'ps-palier-dep',lblId:'ps-palier-lbl'};
  _lockBodyScroll();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this){_depField=null;openSettingsModal(1);}">'
    +'<div class="sheet"><div class="sh"></div><div class="st">Palier</div>'
    +'<div style="display:flex;align-items:center;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);height:48px;margin-bottom:6px;overflow:hidden">'
    +'<span style="padding:0 10px;font-size:16px;color:var(--text3);line-height:48px;border-right:0.5px solid var(--border);user-select:none">P</span>'
    +'<input id="_pal-n" type="number" min="11" max="99" value="'+(curN||'')+'" placeholder="022" oninput="(function(v){var l=document.getElementById(\'_pal-lbl\');if(l)l.textContent=v>=1?fmtEuro(calcPalierSalaire(v)):\'\';})(parseInt(this.value)||0)" style="flex:1;height:100%;box-sizing:border-box;padding:0 12px;border:none;font-size:16px;background:transparent;color:var(--text)">'
    +'</div>'
    +'<div id="_pal-lbl" style="font-size:13px;color:var(--text3);height:18px;line-height:18px;margin-bottom:14px">'+(curN>=1?fmtEuro(calcPalierSalaire(curN)):'')+'</div>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:10px" onclick="_confirmPalierToujours()">Depuis toujours</button>'
    +'<button id="_dep-date-btn" class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);margin-bottom:4px" onclick="var d=document.getElementById(\'_dep-date-pick\'),b=this;if(d)d.style.display=\'block\';b.style.display=\'none\'">Depuis une date</button>'
    +_mkDepPick(iM,iY,'_confirmPalierDate')
    +'<button class="mcancel" onclick="_depField=null;openSettingsModal(1);">Annuler</button>'
    +'</div></div>';
}
function _setPalierResult(n,date){var f=_depField;_depField=null;var _fn=!!window._sMP;window._sMP=false;if(n>=11&&f){var i=document.getElementById(f.inputId),l=document.getElementById(f.lblId),d=document.getElementById(f.depId);if(i)i.value=n;if(l)l.textContent=fmtEuro(calcPalierSalaire(n));if(d)d.value=date||'';if(_fn){var _pr=_profs[_aid];if(_pr){_pr.profile.palierNum=n;_pr.profile.salaireQualif=calcPalierSalaire(n);if(date){var _p2=date.split('/'),_m2=parseInt(_p2[0]),_y2=parseInt(_p2[1]);if(!isNaN(_m2)&&!isNaN(_y2)){var _ym2=_y2*12+(_m2-1);if(!_pr.profile.palierHistory)_pr.profile.palierHistory=[];var _ix=_pr.profile.palierHistory.findIndex(function(e){return e.ym===_ym2;});if(_ix>=0)_pr.profile.palierHistory[_ix].v=n;else _pr.profile.palierHistory.push({ym:_ym2,v:n});_pr.profile.palierHistory.sort(function(a,b){return a.ym-b.ym;});}}S=_profs[_aid]=_pr;saveState();render();}openSettingsModal(1);}else{saveProfileFromDD(_aid);closeModal();}}else{if(_fn)openSettingsModal(1);else closeModal();}}
function _confirmPalierToujours(){_setPalierResult(parseInt((document.getElementById('_pal-n')||{}).value)||0,'');}
function _confirmPalierDate(){var s=_depGetDate();if(s)_setPalierResult(parseInt((document.getElementById('_pal-n')||{}).value)||0,s);}
function openAncModal(){
  var pr=S.profile||{};
  var curYrs=(document.getElementById('ps-salanc')||{}).value;if(curYrs==null||curYrs==='')curYrs=pr.ancYears!=null?pr.ancYears:'';
  var moisInDOM=parseInt((document.getElementById('ps-anc-mois')||{}).value);
  var curMois=!isNaN(moisInDOM)&&moisInDOM>=0?moisInDOM:(typeof pr.ancMoisAnni==='number'&&pr.ancMoisAnni>=0?pr.ancMoisAnni:-1);
  _depField={yrsId:'ps-salanc',moisId:'ps-anc-mois',lblId:'ps-salanc-lbl'};
  _lockBodyScroll();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this){_depField=null;openSettingsModal(1);}">'
    +'<div class="sheet"><div class="sh"></div><div class="st">Ancienneté</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
    +'<input id="_anc-yrs" type="number" min="0" max="50" step="1" value="'+(curYrs!==''?curYrs:'')+'" placeholder="0" oninput="(function(v){var l=document.getElementById(\'_anc-lbl\');if(l)l.textContent=v>=0?fmtEuro(calcAncPrime(v)):\'\';})(parseFloat(this.value)||0)" style="flex:1;height:48px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:16px;background:var(--bg2);color:var(--text)">'
    +'<span style="font-size:15px;color:var(--text3);white-space:nowrap">ans</span>'
    +'</div>'
    +'<div id="_anc-lbl" style="font-size:13px;color:var(--text3);height:18px;line-height:18px;margin-bottom:14px">'+(curYrs!==''?fmtEuro(calcAncPrime(parseFloat(curYrs)||0)):'')+'</div>'
    +'<label style="font-size:13px;color:var(--text3);display:block;margin-bottom:6px">Mois d’anniversaire</label>'
    +'<select id="_anc-mois" style="width:100%;height:40px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:13px;padding:0 8px;margin-bottom:16px">'
    +'<option value="-1"'+(curMois===-1?' selected':'')+'>Non défini</option>'
    +_ML.map(function(mn,i){return'<option value="'+i+'"'+(i===curMois?' selected':'')+'>'+mn+'</option>';}).join('')
    +'</select>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r)" onclick="_confirmAnc()">Confirmer</button>'
    +'<button class="mcancel" onclick="_depField=null;openSettingsModal(1);">Annuler</button>'
    +'</div></div>';
}
function _confirmAnc(){var yrs=parseFloat((document.getElementById('_anc-yrs')||{}).value),mois=parseInt((document.getElementById('_anc-mois')||{}).value),f=_depField;_depField=null;var _fn=!!window._sMP;window._sMP=false;if(!isNaN(yrs)&&f){var i=document.getElementById(f.yrsId),l=document.getElementById(f.lblId),mi=document.getElementById(f.moisId);if(i)i.value=yrs;if(l)l.textContent=fmtEuro(calcAncPrime(yrs));if(mi)mi.value=!isNaN(mois)?mois:-1;if(_fn){var _pr=_profs[_aid];if(_pr){_pr.profile.ancYears=yrs;_pr.profile.ancRefYM=TODAY_YM;if(!isNaN(mois)&&mois>=0)_pr.profile.ancMoisAnni=mois;_pr.profile.primeAnciennete=calcAncPrime(yrs);S=_profs[_aid]=_pr;saveState();render();}openSettingsModal(1);}else{saveProfileFromDD(_aid);closeModal();}}else{if(_fn)openSettingsModal(1);else closeModal();}}
function openContratModal(){
  var curPct=parseFloat((document.getElementById('ps-heures')||{}).value)||0;
  var curDep=(document.getElementById('ps-heur-dep')||{}).value||'',p=curDep.split('/');
  var now=new Date(),iM=p.length===2?parseInt(p[0]):now.getMonth()+1,iY=p.length===2?parseInt(p[1]):now.getFullYear();
  _depField={inputId:'ps-heures',depId:'ps-heur-dep'};
  _lockBodyScroll();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this){_depField=null;openSettingsModal(1);}">'
    +'<div class="sheet"><div class="sh"></div><div class="st">Taux de travail</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
    +'<input id="_cont-pct" type="number" min="0" max="200" step="0.1" value="'+(curPct||'')+'" placeholder="100" oninput="(function(v){var l=document.getElementById(\'_cont-lbl\');if(l)l.textContent=v>0?(Math.round(v*151.67/100*100)/100)+\' h\':\'\';})(parseFloat(this.value)||0)" style="flex:1;height:48px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:16px;background:var(--bg2);color:var(--text)">'
    +'<span style="font-size:15px;color:var(--text3)">%</span>'
    +'</div>'
    +'<div id="_cont-lbl" style="font-size:13px;color:var(--text3);height:18px;line-height:18px;margin-bottom:14px">'+(curPct>0?(Math.round(curPct*151.67/100*100)/100)+' h':'')+'</div>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:10px" onclick="_confirmContratToujours()">Depuis toujours</button>'
    +'<button id="_dep-date-btn" class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);margin-bottom:4px" onclick="var d=document.getElementById(\'_dep-date-pick\'),b=this;if(d)d.style.display=\'block\';b.style.display=\'none\'">Depuis une date</button>'
    +_mkDepPick(iM,iY,'_confirmContratDate')
    +'<button class="mcancel" onclick="_depField=null;openSettingsModal(1);">Annuler</button>'
    +'</div></div>';
}
function _setContratResult(pct,date){var f=_depField;_depField=null;var _fn=!!window._sMP;window._sMP=false;if(pct>0&&f){var i=document.getElementById(f.inputId),d=document.getElementById(f.depId);if(i)i.value=pct;if(d)d.value=date||'';if(_fn){var _pr=_profs[_aid];if(_pr){var _hv=Math.round(pct*151.67/100*100)/100;_pr.profile.heuresMensuelles=_hv;if(date){var _p2=date.split('/'),_m2=parseInt(_p2[0]),_y2=parseInt(_p2[1]);if(!isNaN(_m2)&&!isNaN(_y2)){var _ym2=_y2*12+(_m2-1);if(!_pr.profile.heuresHistory)_pr.profile.heuresHistory=[];var _ix=_pr.profile.heuresHistory.findIndex(function(e){return e.ym===_ym2;});if(_ix>=0)_pr.profile.heuresHistory[_ix].v=_hv;else _pr.profile.heuresHistory.push({ym:_ym2,v:_hv});_pr.profile.heuresHistory.sort(function(a,b){return a.ym-b.ym;});}}S=_profs[_aid]=_pr;saveState();render();}openSettingsModal(1);}else{saveProfileFromDD(_aid);closeModal();}}else{if(_fn)openSettingsModal(1);else closeModal();}}
function _confirmContratToujours(){_setContratResult(parseFloat((document.getElementById('_cont-pct')||{}).value)||0,'');}
function _confirmContratDate(){var s=_depGetDate();if(s)_setContratResult(parseFloat((document.getElementById('_cont-pct')||{}).value)||0,s);}
function openGroupeModal(){
  var curG=parseInt((document.getElementById('ps-groupe')||{}).value)||getGroupeForYM(TODAY_YM);
  var now=new Date();
  _lockBodyScroll();
  var grpSelect='<select id="_grp-n" style="flex:1;height:48px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:16px;background:var(--bg2);color:var(--text)">'
    +'<option value="">—</option>'
    +[1,2,3,4,5,6,7,8,9].map(function(g){return'<option value="'+g+'"'+(g===curG?' selected':'')+'>Gr. '+g+' | '+calcGPE(g,TODAY_YM)+' €</option>';}).join('')
    +'</select>';
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)openSettingsModal(1)">'
    +'<div class="sheet"><div class="sh"></div><div class="st">Groupe</div>'
    +grpSelect
    +'<div style="height:14px"></div>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:10px" onclick="_confirmGroupeToujours()">Depuis toujours</button>'
    +'<button id="_dep-date-btn" class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);margin-bottom:4px" onclick="var d=document.getElementById(\'_dep-date-pick\'),b=this;if(d)d.style.display=\'block\';b.style.display=\'none\'">Depuis une date</button>'
    +_mkDepPick(now.getMonth()+1,now.getFullYear(),'_confirmGroupeDate')
    +'<button class="mcancel" onclick="openSettingsModal(1)">Annuler</button>'
    +'</div></div>';
  window._sMP=true;
}
function _setGroupeResult(g,date){
  window._sMP=false;
  var _pr=_profs[_aid];if(!_pr||!g)return openSettingsModal(1);
  _pr.profile.groupeClassif=g;
  if(date){var _p=date.split('/'),_m=parseInt(_p[0]),_y=parseInt(_p[1]);if(!isNaN(_m)&&!isNaN(_y)){var _ym=_y*12+(_m-1);if(!_pr.profile.groupeHistory)_pr.profile.groupeHistory=[];var _ix=_pr.profile.groupeHistory.findIndex(function(e){return e.ym===_ym;});if(_ix>=0)_pr.profile.groupeHistory[_ix].v=g;else _pr.profile.groupeHistory.push({ym:_ym,v:g});_pr.profile.groupeHistory.sort(function(a,b){return a.ym-b.ym;});}}else{_pr.profile.groupeHistory=[];}
  var _ddG=document.getElementById('ps-groupe');if(_ddG)_ddG.value=g;
  S=_profs[_aid]=_pr;saveState();render();openSettingsModal(1);
}
function _confirmGroupeToujours(){_setGroupeResult(parseInt((document.getElementById('_grp-n')||{}).value)||0,'');}
function _confirmGroupeDate(){var s=_depGetDate();if(s)_setGroupeResult(parseInt((document.getElementById('_grp-n')||{}).value)||0,s);}
function openSupFamilialModal(){
  var curSft=getSupFamilialForYM(TODAY_YM);
  var now=new Date();
  _lockBodyScroll();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)openSettingsModal(1)">'
    +'<div class="sheet"><div class="sh"></div><div class="st">Supplément familial</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
    +'<input id="_sft-v" type="number" min="0" step="0.01" value="'+(curSft||'')+'" placeholder="0" style="flex:1;height:48px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:20px;background:var(--bg2);color:var(--text)">'
    +'<span style="font-size:16px;color:var(--text3)">€</span>'
    +'</div>'
    +'<div style="height:14px"></div>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:10px" onclick="_confirmSupFamilialToujours()">Depuis toujours</button>'
    +'<button id="_dep-date-btn" class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);margin-bottom:4px" onclick="var d=document.getElementById(\'_dep-date-pick\'),b=this;if(d)d.style.display=\'block\';b.style.display=\'none\'">Depuis une date</button>'
    +_mkDepPick(now.getMonth()+1,now.getFullYear(),'_confirmSupFamilialDate')
    +'<button class="mcancel" onclick="openSettingsModal(1)">Annuler</button>'
    +'</div></div>';
  window._sMP=true;
}
function _setSupFamilialResult(v,date){
  window._sMP=false;
  var _pr=_profs[_aid];if(!_pr||isNaN(v)||v<0)return openSettingsModal(1);
  _pr.profile.supFamilial=v;
  if(date){var _p=date.split('/'),_m=parseInt(_p[0]),_y=parseInt(_p[1]);if(!isNaN(_m)&&!isNaN(_y)){var _ym=_y*12+(_m-1);if(!_pr.profile.supFamilialHistory)_pr.profile.supFamilialHistory=[];var _ix=_pr.profile.supFamilialHistory.findIndex(function(e){return e.ym===_ym;});if(_ix>=0)_pr.profile.supFamilialHistory[_ix].v=v;else _pr.profile.supFamilialHistory.push({ym:_ym,v:v});_pr.profile.supFamilialHistory.sort(function(a,b){return a.ym-b.ym;});}}else{_pr.profile.supFamilialHistory=[];}
  S=_profs[_aid]=_pr;saveState();render();openSettingsModal(1);
}
function _confirmSupFamilialToujours(){_setSupFamilialResult(parseFloat((document.getElementById('_sft-v')||{}).value)||0,'');}
function _confirmSupFamilialDate(){var s=_depGetDate();if(s)_setSupFamilialResult(parseFloat((document.getElementById('_sft-v')||{}).value)||0,s);}


function openAddPrimeFixeModal(ym,fromSettings,av){
  window._pfFromSettings=!!fromSettings;window._apfAv=!!av; // av : prime d'avantage individuel acquis (remplace la précédente)
  var y=Math.floor(ym/12),m=ym%12;
  _lockBodyScroll();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="sheet"><div class="sh"></div><div class="st">'+(av?'Avantage individuel acquis':'Ajouter une prime')+'</div>'
    +(av?'<div style="font-size:13px;color:var(--text3);line-height:1.45;margin:-4px 0 12px">« PRIME AV. INDIV. ACQUIS » sur le bulletin. Montant 0 : plus de prime.</div><input id="_apf-label" type="hidden" value="Prime av. indiv. acquis">':'<label style="font-size:13px;color:var(--text3);display:block;margin-bottom:4px">Libellé</label>')
    +(av?'':'<input id="_apf-label" type="text" placeholder="ex: Prime de nuit fixe" style="width:100%;height:44px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);margin-bottom:12px">')
    +'<label style="font-size:13px;color:var(--text3);display:block;margin-bottom:4px">Montant (€ / mois)</label>'
    +'<input id="_apf-montant" type="number" min="0" step="0.01" placeholder="0,00" style="width:100%;height:44px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);margin-bottom:12px">'
    +'<label style="font-size:13px;color:var(--text3);display:block;margin-bottom:4px">Versée depuis</label>'
    +'<select id="_apf-debut" onchange="window._apfDebut=+this.value" style="width:100%;height:44px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);margin-bottom:16px">'+_ymOpts(ym,true)+'</select>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);margin-bottom:8px" onclick="_confirmAddPrimeFixe('+ym+')">'+(av?'Enregistrer':'Ajouter')+'</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
  window._apfDebut=ym;
}
function _confirmAddPrimeFixe(ym){
  var label=(document.getElementById('_apf-label')||{value:''}).value.trim();
  var montant=parseFloat((document.getElementById('_apf-montant')||{value:''}).value);
  if(!label){alert('Libellé requis.');return;}
  if(isNaN(montant)||montant<0||(montant===0&&!window._apfAv)){alert('Montant invalide.');return;}
  if(!S.profile.primesFixesCustom)S.profile.primesFixesCustom=[];
  // avantage individuel : l'ancien montant s'arrête le mois d'avant le début choisi
  if(window._apfAv){var st=window._apfDebut||0;S.profile.primesFixesCustom=S.profile.primesFixesCustom.filter(function(p){if(!/INDIV/i.test(p.label)||(p.finYM!=null&&p.finYM<st))return true;if(p.debutYM>=st)return false;p.finYM=st-1;return true;});
    window._apfAv=false;if(montant===0){saveState();render();if(window._pfFromSettings){window._pfFromSettings=false;openSettingsModal(1);}else closeModal();return;}}
  S.profile.primesFixesCustom.push({id:'pfc_'+Date.now(),label:label,montant:montant,debutYM:window._apfDebut!=null?window._apfDebut:ym,finYM:null});
  _haptic();saveState();render();
  if(window._pfFromSettings){window._pfFromSettings=false;openSettingsModal(1);}
  else{closeModal();openBulletinModal(ym);}
}
function openDeletePrimeFixeModal(id,ym){
  var primes=S.profile&&S.profile.primesFixesCustom||[];
  var p=primes.find(function(x){return x.id===id;});
  if(!p)return;
  var y=Math.floor(ym/12),m=ym%12;
  var ML=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  _lockBodyScroll();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="sheet"><div class="sh"></div><div class="st">Arrêter la prime</div>'
    +'<div class="ss" style="margin-bottom:16px">«'+' '+_h(p.label)+' '+'» — '+fmtEuro(p.montant)+'/mois'+(p.debutYM>0?', depuis '+ML[p.debutYM%12]+' '+Math.floor(p.debutYM/12):'')+'</div>'
    +'<label style="font-size:13px;color:var(--text3);display:block;margin-bottom:4px">Plus versée à partir de</label>'
    +'<select id="_dpf-from" style="width:100%;height:44px;box-sizing:border-box;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);margin-bottom:8px">'+_ymOpts(Math.max(ym,p.debutYM+1),false)+'</select>'
    +'<button class="mb" style="width:100%;height:44px;font-size:13px;background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:8px" onclick="_deletePrimeFixeFrom(\''+id+'\','+ym+',+document.getElementById(\'_dpf-from\').value)">Arrêter à partir de ce mois</button>'
    +'<button class="mb del" style="width:100%;height:44px;font-size:13px;border-radius:var(--r);margin-bottom:8px" onclick="_deletePrimeFixeFrom(\''+id+'\','+ym+',null)">Supprimer entièrement</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
}
function _deletePrimeFixeFrom(id,ym,fromYM){
  if(!S.profile||!S.profile.primesFixesCustom)return;_haptic();
  if(fromYM===null){
    S.profile.primesFixesCustom=S.profile.primesFixesCustom.filter(function(p){return p.id!==id;});
  }else{
    var p=S.profile.primesFixesCustom.find(function(x){return x.id===id;});
    if(p){
      if(fromYM<=p.debutYM){
        S.profile.primesFixesCustom=S.profile.primesFixesCustom.filter(function(x){return x.id!==id;});
      }else{
        p.finYM=fromYM-1;
      }
    }
  }
  saveState();render();
  if(window._pfFromSettings){window._pfFromSettings=false;openSettingsModal(1);}
  else{closeModal();openBulletinModal(ym);}
}
function openDepuisModal(inputId,btnId){
  _depField={inputId:inputId,btnId:btnId};
  _lockBodyScroll();
  const _ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const _n=new Date(),_cm=_n.getMonth()+1,_cy=_n.getFullYear();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this){_depField=null;closeModal()}">'
    +'<div class="sheet"><div class="sh"></div>'
    +'<div class="st">Depuis quand ?</div>'
    +'<button class="mb" style="width:100%;height:48px;font-size:15px;background:var(--btn);color:var(--text);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:10px" onclick="_confirmDepuisToujours()">Depuis toujours</button>'
    +'<button id="_dep-date-btn" class="mb" style="width:100%;height:48px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);margin-bottom:14px" onclick="_depShowDatePick()">Depuis une date</button>'
    +'<div id="_dep-date-pick" style="display:none">'
    +'<div style="display:flex;gap:8px;margin-bottom:12px">'
    +'<select id="_dep-m" style="flex:1;height:40px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:13px;padding:0 8px">'
    +_ML.map(function(mn,i){return'<option value="'+(i+1)+'"'+((i+1)===_cm?' selected':'')+'>'+mn+'</option>';}).join('')
    +'</select>'
    +'<input id="_dep-y" type="number" value="'+_cy+'" min="2020" max="2035" style="width:88px;height:40px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:13px;padding:0 8px;box-sizing:border-box">'
    +'</div>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r)" onclick="_confirmDepuisDate()">Confirmer</button>'
    +'</div>'
    +'<button class="mcancel" onclick="_depField=null;closeModal()">Annuler</button>'
    +'</div></div>';
}
function _depShowDatePick(){var d=document.getElementById('_dep-date-pick'),b=document.getElementById('_dep-date-btn');if(d)d.style.display='block';if(b)b.style.display='none';}
function _confirmDepuisToujours(){var f=_depField;_depField=null;if(f){var el=document.getElementById(f.inputId),btn=document.getElementById(f.btnId);if(el)el.value='';if(btn)btn.textContent='depuis toujours';}closeModal();}
function _confirmDepuisDate(){var m=parseInt((document.getElementById('_dep-m')||{}).value),y=parseInt((document.getElementById('_dep-y')||{}).value),f=_depField;_depField=null;if(!isNaN(m)&&!isNaN(y)&&f){var s=m+'/'+y,el=document.getElementById(f.inputId),btn=document.getElementById(f.btnId);if(el)el.value=s;if(btn)btn.textContent='depuis '+m+'/'+y;}closeModal();}
function openEntreeDateModal(inputId,btnId,lblId){
  _depField={inputId:inputId,btnId:btnId,lblId:lblId};
  _lockBodyScroll();
  const _ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const curVal=(document.getElementById(inputId)||{}).value||'';
  const parts=curVal.split('/');
  const hasVal=parts.length===2&&!isNaN(parseInt(parts[0]))&&!isNaN(parseInt(parts[1]));
  const initM=hasVal?parseInt(parts[0]):1,initY=hasVal?parseInt(parts[1]):new Date().getFullYear()-10;
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this){_depField=null;closeModal()}">'
    +'<div class="sheet"><div class="sh"></div>'
    +'<div class="st">Date d’ancienneté</div>'
    +'<div class="ss" style="margin-bottom:14px">Mois et année d’entrée dans l’entreprise</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:16px">'
    +'<select id="_dep-m" style="flex:1;height:40px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:13px;padding:0 8px">'
    +_ML.map(function(mn,i){return'<option value="'+(i+1)+'"'+((i+1)===initM?' selected':'')+'>'+mn+'</option>';}).join('')
    +'</select>'
    +'<input id="_dep-y" type="number" value="'+initY+'" min="1970" max="2035" style="width:88px;height:40px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:13px;padding:0 8px;box-sizing:border-box">'
    +'</div>'
    +'<button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r)" onclick="_confirmEntreeDate()">Confirmer</button>'
    +'<button class="mcancel" onclick="_depField=null;closeModal()">Annuler</button>'
    +'</div></div>';
}
function _confirmEntreeDate(){
  var m=parseInt((document.getElementById('_dep-m')||{}).value),y=parseInt((document.getElementById('_dep-y')||{}).value),f=_depField;
  _depField=null;
  if(!isNaN(m)&&!isNaN(y)&&f){
    var s=m+'/'+y,el=document.getElementById(f.inputId),btn=document.getElementById(f.btnId),lbl=document.getElementById(f.lblId);
    if(el)el.value=s;
    if(btn)btn.textContent='depuis '+m+'/'+y;
    if(lbl){var eym=y*12+(m-1),yrs=calcAncYearsFromYM(eym,TODAY_YM);lbl.textContent=yrs+' an'+(yrs>1?'s':'')+' → '+fmtEuro(calcAncPrime(yrs));}
  }
  closeModal();
}
function applySettingsFromDD(pid,el){
  const pr=_profs[pid];if(!pr)return;if(!pr.settings)pr.settings={};
  const _ctx=el&&el.closest('.stabs-body');
  function $q(id){return _ctx?_ctx.querySelector('#'+id):document.getElementById(id);}
  const dimEl=$q('ps-dim'),rhEl=$q('ps-rh');
  const ferEl=$q('ps-fer'),hsEl=$q('ps-hs');
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
    if(pr.settings.settingsHistory.length>6)pr.settings.settingsHistory=pr.settings.settingsHistory.slice(-6);
  }
  const oldLine=_profs[pid]&&_profs[pid].profile&&_profs[pid].profile.anchorLine;
  const newLine=pr.profile.anchorLine;
  _profs[pid]=pr;if(pid===_aid)S=pr;saveState();render();gcalUpdateBtn();
  const _hpn=document.getElementById('hdr-profile-name');if(_hpn&&S.profile)_hpn.textContent=S.profile.name||'Profil';
  // If line changed and Google connected, clear calendar then re-sync
  if(gcalTokens&&oldLine!==undefined&&oldLine!==newLine){
    _ask('La ligne a changé.\n\nVider le calendrier Google et le re-synchroniser ?',{ok:'Re-synchroniser',cancel:'Plus tard'}).then(function(ok){if(ok)gcalClear(true).then(function(){setTimeout(gcalHandleClick,500);});});
  }
}


// ================================================================
// INIT
// ================================================================
function switchToProfile(id){switchProfile(id);render();document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');document.removeEventListener('click',_ddClose,true);openSettingsModal(0);}
function openChangeLigneModal(pid){
  const pr=_profs[pid];if(!pr)return;
  document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');
  document.removeEventListener('click',_ddClose,true);
  const _diff=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
  const _curVisual=((pr.profile.anchorLine!==undefined?pr.profile.anchorLine:ANCHOR_L)+_diff+ getCycleLen(NOW)*1000)%getCycleLen(NOW);
  const today=dk(NOW),_pa=_poolsAvail();window._poolTmp=null;
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Changer de ligne</div>'
    // équipe (antenne, cadre, coordination) : changement total ou à partir d'une date (le cycle de l'équipe s'applique dès cette date)
    +(_pa.length>1?'<div style="margin-bottom:12px"><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Équipe</label><select id="cl-pool" onchange="window._poolTmp=this.value;updateChangeLigneSelect(\''+pid+'\','+_curVisual+')" style="height:40px;width:100%;padding:0 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg2);color:var(--text);-webkit-appearance:none">'+_pa.map(function(k){return '<option value="'+k+'"'+(k===_pool()?' selected':'')+'>'+POOLS[k].l+'</option>';}).join('')+'</select></div>':'')
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:8px">Portée du changement</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer">'
    +'<input type="radio" name="cl-scope" value="total" checked onchange="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')"> Totale — efface toutes les modifications</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">'
    +'<input type="radio" name="cl-scope" value="from" onchange="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')"> À partir de'
    +'<input type="date" id="cl-date" value="'+today+'" oninput="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')" style="height:32px;padding:4px 8px;border:0.5px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg2);color:var(--text);margin-left:4px">'
    +'</label>'
    // ligne d'avant un changement oublié : rien n'est effacé, la ligne actuelle reste
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:8px;cursor:pointer">'
    +'<input type="radio" name="cl-scope" value="before" onchange="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')"> Avant le'
    +'<input type="date" id="cl-dateb" value="'+today+'" max="'+today+'" oninput="updateChangeLigneSelect(\''+pid+'\','+_curVisual+')" style="height:32px;padding:4px 8px;border:0.5px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg2);color:var(--text);margin-left:4px">'
    +'</label>'
    +'</div>'
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px" id="cl-cycle-lbl"></label>'
    +'<select id="cl-line" style="height:40px;width:100%;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg2);color:var(--text);-webkit-appearance:none"></select>'
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
  let fromDate=scopeVal==='from'?(document.getElementById('cl-date')||{value:dk(NOW)}).value:dk(NOW);
  // Avant le : ligne de la semaine qui précède cette date
  if(scopeVal==='before'){const _b=(document.getElementById('cl-dateb')||{}).value;if(_b){const _m=getMonday(new Date(_b+'T12:00:00'));_m.setDate(_m.getDate()-7);fromDate=dk(_m);}}
  // Get the grid for the target date
  const targetDate=new Date(fromDate+'T12:00:00');
  const kvGrid=getActiveCycleGrid(targetDate);
  const grid=kvGrid||_stdGrid(_poolAt(targetDate));
  const nLines=grid.length;
  // Find current visual line at target date
  const _diffTarget=Math.round((getMonday(targetDate)-ANCHOR)/(7*864e5));
  const pr=_profs[pid];
  const _al=pr&&pr.profile&&pr.profile.anchorLine!==undefined?pr.profile.anchorLine:ANCHOR_L;
  const _curAtTarget=((_al+_diffTarget)%nLines+nLines)%nLines;
  // Find active cycle name
  const activeCyc=_poolCycles(_poolAt(targetDate)).find(function(c){
    const k=fromDate;return c.startDate<=k&&(!c.endDate||c.endDate>=k);
  });
  const lbl=document.getElementById('cl-cycle-lbl');
  if(lbl)lbl.textContent=scopeVal==='before'?'Ligne la semaine du '+targetDate.getDate()+' '+MCs[targetDate.getMonth()]:'Ligne dans '+(activeCyc?activeCyc.name:'le cycle actuel');
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
  const fromDate=scopeVal==='from'?(document.getElementById('cl-date')||{value:''}).value:scopeVal==='before'?(document.getElementById('cl-dateb')||{value:''}).value:'';
  const chosenVisual=parseInt(li.value);
  if(scopeVal==='before'){if(!fromDate){alert('Date requise.');return;}_lineBefore(pid,chosenVisual,fromDate);return;}

  if(scopeVal==='total'){
    const _diffNow=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
    const _curVisual=((pr.profile.anchorLine!==undefined?pr.profile.anchorLine:ANCHOR_L)+_diffNow+getCycleLen(NOW)*1000)%getCycleLen(NOW);
    if(_curVisual===chosenVisual&&!(pr.profile.lineHistory&&pr.profile.lineHistory.length)&&!(window._poolTmp&&window._poolTmp!==(pr.profile.pool||'antenne'))){
      alert('Cette ligne est déjà la ligne actuelle.');return;
    }
  } else {
    if(!fromDate){alert('Date requise.');return;}
  }

  const warnText=scopeVal==='total'
    ?'Cette action effacera toutes les modifications manuelles et les congés.'
    :'Cette action effacera les modifications et congés à partir du '+fromDate+'.';
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Confirmer le changement ?</div>'
    +'<div class="ss" style="margin-bottom:20px">'+warnText+'</div>'
    +'<button class="mb wide" style="background:#c0392b;color:#fff;margin-bottom:8px" onclick="applyChangeLigne(\''+pid+'\','+chosenVisual+',\''+scopeVal+'\',\''+fromDate+'\')">Oui, changer de ligne</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
}

function applyChangeLigne(pid,chosenVisual,scopeVal,fromDate){
  const pr=_profs[pid];if(!pr)return;
  // nouvelle équipe : totale → son cycle pour toutes les semaines ; à partir d'une date → retenue dans l'historique des lignes
  const _np=window._poolTmp&&POOLS[window._poolTmp]?window._poolTmp:null,_op=pr.profile.pool||'antenne';
  if(scopeVal==='total'){
    if(_np){if(_np==='antenne')delete pr.profile.pool;else pr.profile.pool=_np;}
    delete pr.profile.origPool;
    const _diffNow=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
    const _Nc=getCycleLen(NOW);
    const newAnchor=((chosenVisual-_diffNow)%_Nc+_Nc)%_Nc;
    pr.profile.anchorLine=newAnchor;
    pr.profile.lineHistory=[];
    delete pr.profile.origAnchor;
    pr.overrides={};
    pr.conges={};
  } else {
    const _fromMonday=getMonday(new Date(fromDate+'T12:00:00'));
    const _diffFrom=Math.round((_fromMonday-ANCHOR)/(7*864e5));
    const _Nc2=getCycleLen(_fromMonday);
    const newAnchor=((chosenVisual-_diffFrom)%_Nc2+_Nc2)%_Nc2;
    if(!pr.profile.lineHistory)pr.profile.lineHistory=[];
    if(pr.profile.origAnchor===undefined)pr.profile.origAnchor=pr.profile.anchorLine;
    const _hadPool=pr.profile.lineHistory.some(function(h){return h.pool;});
    pr.profile.lineHistory=pr.profile.lineHistory.filter(function(h){return h.from<fromDate;});
    const _e={anchorLine:newAnchor,from:fromDate};
    if(_np&&_np!==_op||_hadPool){if(pr.profile.origPool===undefined)pr.profile.origPool=_op;_e.pool=_np||_poolAt(fromDate);}
    pr.profile.lineHistory.push(_e);
    pr.profile.lineHistory.sort(function(a,b){return a.from<b.from?-1:1;});
    pr.profile.anchorLine=pr.profile.lineHistory[pr.profile.lineHistory.length-1].anchorLine;
    // équipe actuelle (listes, invitations) : celle d'aujourd'hui
    if(_e.pool){window._poolTmp=null;const _pn=_poolAt(NOW);if(_pn==='antenne')delete pr.profile.pool;else pr.profile.pool=_pn;}
    const _fromTs=_fromMonday.getTime();
    Object.keys(pr.overrides||{}).forEach(function(k){if(new Date(k+'T00:00:00').getTime()>=_fromTs)delete pr.overrides[k];});
    Object.keys(pr.conges||{}).forEach(function(k){if(new Date(k+'T00:00:00').getTime()>=_fromTs)delete pr.conges[k];});
  }
  window._poolTmp=null;

  _profs[pid]=pr;if(pid===_aid)S=pr;
  saveState();closeModal();render();gcalUpdateBtn();
  if(gcalTokens){
    _ask('La ligne a changé.\n\nVider le calendrier Google et le re-synchroniser ?',{ok:'Re-synchroniser',cancel:'Plus tard'}).then(function(ok){if(ok)gcalClear(true).then(function(){setTimeout(gcalHandleClick,500);});});
  }
}

// « Avant le » : ligne (et équipe) suivie avant une date, la ligne d'après ne change pas. Rien n'est effacé ;
// ce qui compte autrement avec la nouvelle ligne (congés, rendus, modifications) est listé ensuite
function _lineBefore(pid,chosen,dateStr){const pr=_profs[pid];if(!pr)return;
  const D=getMonday(new Date(dateStr+'T12:00:00')),Dk=dk(D),lm=new Date(D);lm.setDate(lm.getDate()-7);
  const _np=window._poolTmp&&POOLS[window._poolTmp]?window._poolTmp:null;window._poolTmp=null;
  // avant : vacation prévue et valeur des jours posés avant la date
  const keys=Object.keys(Object.assign({},pr.conges||{},pr.overrides||{})).filter(function(k){return k<Dk;}).sort(),was={};
  keys.forEach(function(k){const d=new Date(k+'T12:00:00');was[k]={c:getCycleVac(d).cycleVac,v:getDur(d)};});
  pushUndo('Ligne avant le '+fmtDate(D));
  const P=pr.profile,h=(P.lineHistory||[]).slice().sort(function(a,b){return a.from<b.from?-1:1;}),hasP=h.some(function(x){return x.pool;})||(_np&&_np!==_poolAt(D));
  // ligne en place à la date : gardée telle quelle à partir de la date
  let aD=P.origAnchor!==undefined?P.origAnchor:(P.anchorLine!==undefined?P.anchorLine:ANCHOR_L);h.forEach(function(x){if(x.from<=Dk)aD=x.anchorLine;});
  const pD=_poolAt(D);
  const nh=h.filter(function(x){return x.from>=Dk;});
  if(!nh.length||nh[0].from!==Dk)nh.unshift({anchorLine:aD,from:Dk});
  if(hasP){if(!nh[0].pool)nh[0].pool=pD;}
  P.lineHistory=nh;
  if(hasP){P.origPool=_np||pD;}
  window._poolTmp=_np;try{const n=getCycleLen(lm),df=Math.round((lm-ANCHOR)/(7*864e5));P.origAnchor=((chosen-df)%n+n)%n;}finally{window._poolTmp=null;}
  P.anchorLine=nh[nh.length-1].anchorLine;
  _profs[pid]=pr;if(pid===_aid)S=pr;saveState();closeModal();render();
  // après : ce qui change
  const L=[];keys.forEach(function(k){const d=new Date(k+'T12:00:00'),c=getCycleVac(d).cycleVac,v=getDur(d),o=was[k],cg=(S.conges||{})[k],ov=(S.overrides||{})[k],rest=!c||c==='RH',wrest=!o.c||o.c==='RH';
    if(cg&&/^(cp|cg|rend)/.test(cg)){if(rest&&!wrest)L.push([k,(/^rend/.test(cg)?'Rendu':'Congé')+' sur un repos']);else if(/^rend/.test(cg)&&v!==o.v)L.push([k,'Rendu '+fmtMin(o.v)+' → '+fmtMin(v)]);}
    // même vacation et rien d'autre posé ce jour-là (motif, heures sup, prime du jour) : la modification ne change plus rien
    else if(ov&&!ov.echange&&ov.vac&&ov.vac===c&&!ov.motif&&!ov.formation&&!ov.hs&&!((S.dayPrimes||{})[k]))L.push([k,'Modification identique à la vacation prévue']);});
  if(!L.length){_infoToast('✓ Ligne avant le '+fmtDate(D)+' enregistrée');return;}
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Avec la nouvelle ligne</div>'
    +'<div class="ss" style="margin-bottom:12px">'+L.length+' jour'+(L.length>1?'s':'')+' compte'+(L.length>1?'nt':'')+' autrement :</div>'
    +L.map(function(x){const d=new Date(x[0]+'T12:00:00');return '<div class="srow" style="cursor:pointer" onclick="openDay(\''+x[0]+'\')"><div class="slbl">'+d.getDate()+' '+MCs[d.getMonth()]+' '+d.getFullYear()+'</div><div style="font-size:13px;color:var(--text2)">'+x[1]+' ›</div></div>';}).join('')
    +'<button class="mcancel" onclick="closeModal()">OK</button></div></div>';}


function openChangeLigneModal2(pid){openChangeLigneModal(pid);}

function showPayPromptIfNeeded(){
  if(!S||!S.profile)return;
  if(S.profile.hasSeenPayPrompt)return;
  if(S.profile.palierNum||S.profile.ancYears!=null||S.profile.salaireQualif)return;
  S.profile.hasSeenPayPrompt=true;
  saveState();
  _lockBodyScroll();
  // Champs deux par deux, montant calculé à droite du libellé (plus de grands vides entre les champs)
  var _f='width:100%;height:44px;box-sizing:border-box;padding:0 12px;border:none;border-radius:12px;font-size:16px;background:var(--btn);color:var(--text)',
    _l=function(t,id){return '<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--text3);margin-bottom:5px"><span>'+t+'</span>'+(id?'<span id="'+id+'" style="color:var(--text2)"></span>':'')+'</div>';};
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay">'
    +'<div class="sheet"><div class="sh"></div><div class="st">Données de paie</div>'
    +'<div class="ss" style="margin-bottom:14px">Renseigner les informations de paie pour calculer le salaire estimé. Modifiables à tout moment dans le profil.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 10px;margin-bottom:12px">'
    +'<div>'+_l('Palier','_pp-pal-lbl')+'<div style="display:flex;align-items:center;border-radius:12px;background:var(--btn);height:44px;overflow:hidden"><span style="padding:0 0 0 12px;font-size:16px;color:var(--text3);user-select:none">P</span>'
    +'<input id="_pp-palier" type="number" min="1" max="60" placeholder="019" oninput="(function(v){var l=document.getElementById(\'_pp-pal-lbl\');if(l)l.textContent=v>=1?fmtEuro(calcPalierSalaire(v)):\'\';})(parseInt(this.value)||0)" style="flex:1;min-width:0;height:100%;box-sizing:border-box;padding:0 12px 0 6px;border:none;font-size:16px;background:transparent;color:var(--text)"></div></div>'
    +'<div>'+_l('Ancienneté (ans)','_pp-anc-lbl')+'<input id="_pp-anc" type="number" min="0" max="50" placeholder="0" oninput="(function(v){var l=document.getElementById(\'_pp-anc-lbl\');if(l)l.textContent=v>=0?fmtEuro(calcAncPrime(v)):\'\';})(parseFloat(this.value)||0)" style="'+_f+'"></div>'
    +'<div>'+_l('Contrat (%)')+'<input id="_pp-pct" type="number" min="1" max="200" placeholder="100" style="'+_f+'"></div>'
    +'<div>'+_l('Groupe')+'<select id="_pp-groupe" style="'+_f+';-webkit-appearance:none;appearance:none">'
    +'<option value="">—</option><option value="1">Gr. 1 | 20 €</option><option value="2">Gr. 2 | 52 €</option><option value="3">Gr. 3 | 62 €</option><option value="4">Gr. 4 | 128 €</option><option value="5">Gr. 5 | 154 €</option><option value="6">Gr. 6 | 159 €</option><option value="7">Gr. 7 | 172 €</option><option value="8">Gr. 8 | 187 €</option><option value="9">Gr. 9 | 231 €</option>'
    +'</select></div></div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--btn);border-radius:16px;padding:10px 12px;margin-bottom:16px"><span style="font-size:13px">PFA mensualisée</span><label class="tgl"><input id="_pp-pfamens" type="checkbox"><span class="tgl-s"></span></label></div>'
    +'<button class="rc-btn" style="height:44px;font-size:15px;margin-bottom:8px" onclick="_confirmPayPrompt()">Enregistrer</button>'
    +'<button class="mcancel" onclick="closeModal()">Plus tard</button>'
    +'</div></div>';
}
function _confirmPayPrompt(){
  if(!S||!S.profile)return;
  const pn=parseInt((document.getElementById('_pp-palier')||{}).value);
  if(!isNaN(pn)&&pn>=1){S.profile.palierNum=pn;S.profile.salaireQualif=calcPalierSalaire(pn);}
  const an=parseFloat((document.getElementById('_pp-anc')||{}).value);
  if(!isNaN(an)&&an>=0){S.profile.ancYears=an;S.profile.ancRefYM=TODAY_YM;S.profile.primeAnciennete=calcAncPrime(an);}
  const pct=parseFloat((document.getElementById('_pp-pct')||{}).value);
  if(!isNaN(pct)&&pct>0){S.profile.heuresMensuelles=Math.round(pct*151.67/100*100)/100;}
  const pfamEl=document.getElementById('_pp-pfamens');if(pfamEl)S.profile.pfaMensuelle=pfamEl.checked;
  const grpEl=document.getElementById('_pp-groupe');if(grpEl){const _gv=parseInt(grpEl.value);S.profile.groupeClassif=(!isNaN(_gv)&&_gv>=1)?_gv:0;}
  saveState();render();closeModal();
}
function confirmDeleteProfile(id){deleteProfile(id);closeModal();render();openSettingsModal(0);}













// Horaires faits pré-remplis avec ceux de la vacation choisie
function _cvExTFill(){var W=window._cvW||{},V=W.exVac&&getVAC(new Date(_cvFKey()+'T12:00:00'))[W.exVac];if(!V)return;var t=parseHM(V.fin)-parseHM(V.deb);if(t<0)t+=1440;var pz=t-(V.dur||0);
  W.exT={deb:V.deb||'',fin:V.fin||'',pause:pz>=60?'60':pz>=45?'45':'0'};_cvExTSet();}
function _cvExTSet(){var T=(window._cvW||{}).exT||{};[['cv-exd','deb'],['cv-exf','fin'],['cv-exp','pause']].forEach(function(a){var e=document.getElementById(a[0]);if(e)e.value=T[a[1]]||(a[1]==='pause'?'0':'');});}
function _cvExTRead(){var W=window._cvW,g=function(id){var e=document.getElementById(id);return e?e.value:'';};if(W)W.exT={deb:g('cv-exd'),fin:g('cv-exf'),pause:g('cv-exp')};}
function _cvExHr(on){var W=window._cvW;W.exHr=on;var f=document.getElementById('cv-exhr-f');if(f)f.style.display=on?'':'none';if(on&&!(W.exT&&W.exT.deb))_cvExTFill();}


function _cvDraftSave(){var g=function(id){var e=document.getElementById(id);return e?e.value:null;};
  window._cvDraft={name:g('custom-name'),deb:g('custom-deb'),fin:g('custom-fin'),pause:g('custom-pause'),prime:g('custom-prime'),amt:g('cv-autre-amt'),note:g('cv-note'),xl:g('cv-exr-lbl'),xd:g('cv-exr-dur')};}
// Redessine la page (même position, sans animation) en gardant la saisie
function _cvRerender(){_cvDraftSave();window._cvRe=1;var sh=document.querySelector('#modal-root .sheet'),st=sh?sh.scrollTop:0;openCustomVacModal();
  var s2=document.querySelector('#modal-root .sheet'),o2=document.querySelector('#modal-root .overlay');if(o2)o2.style.animation='none';if(s2){s2.style.animation='none';s2.scrollTop=st;}}
function _cvSetWhen(w){var W=window._cvW;if(!W||W.when===w)return;_haptic();W.when=w;_exState.mode=w==='week'?'week':'day';_cvRerender();}
function _cvSetRole(r){var W=window._cvW;if(!W||W.role===r)return;W.role=r;_cvRerender();}
function _cvWeek(n){var W=window._cvW;_haptic();W.wOff=(W.wOff||0)+n;_cvRerender();
  // la semaine glisse depuis le côté d'où elle vient
  var r=document.querySelector('.cv-days .exchange-days');if(r&&r.animate)r.animate([{transform:'translateX('+(n>0?40:-40)+'px)',opacity:0},{transform:'none',opacity:1}],{duration:220,easing:'cubic-bezier(.3,.8,.3,1)'});}
function _cvPickDay(k){var W=window._cvW,key=pendingKey;_haptic();var _o=document.querySelector('.cv-days .exchange-day.pick'),_or=_o?_o.getBoundingClientRect():null;
  // la pilule bleue glisse de l'ancien jour au nouveau (le contenu des jours ne bouge pas)
  setTimeout(function(){var n=document.querySelector('.cv-days .exchange-day.pick');if(!_or||!n||!document.body.animate)return;var nr=n.getBoundingClientRect();if(Math.abs(_or.left-nr.left)<2)return;
    var f=document.createElement('div');f.style.cssText='position:fixed;left:'+nr.left+'px;top:'+nr.top+'px;width:'+nr.width+'px;height:'+nr.height+'px;border-radius:18px;background:var(--blue);z-index:9999;pointer-events:none;opacity:.55';
    document.body.appendChild(f);var a=f.animate([{transform:'translateX('+(_or.left-nr.left)+'px)',opacity:.55},{transform:'none',opacity:0}],{duration:260,easing:'cubic-bezier(.3,.8,.3,1)'});a.onfinish=function(){f.remove();};},0);if(k===key){W.other=null;W.when='day';}else{W.other=k;W.when='other';if(window._cvMotif==='autre')window._cvMotif='echange';}W.exVac=null;_cvRerender();}
function _cvPickExVac(b){var W=window._cvW;W.exVac=b.getAttribute('data-exv');_haptic();if(W.exHr)_cvExTFill();[].forEach.call(document.querySelectorAll('#cv-exg [data-exv]'),function(x){x.classList.toggle('exsel',x===b);});}

// Enregistre un déplacement (motif) ou un échange : jour cédé (non travaillé) et jour fait, liés l'un à l'autre
async function _cvSaveMove(){var W=window._cvW||{when:'day'},key=pendingKey,m=window._cvMotif,ex=m==='echange',oKey=key,fKey=key;
  if(W.when==='other'){if(!W.other){alert('Choisir l’autre jour.');return;}if(W.role==='give')fKey=W.other;else oKey=W.other;}
  if(ex&&!W.exVac){alert('Choisir la vacation faite.');return;}
  var oD=new Date(oKey+'T12:00:00'),fD=new Date(fKey+'T12:00:00'),oCyc=getCycleVac(oD).cycleVac,fCyc=getCycleVac(fD).cycleVac,VF=getVAC(fD);
  var val=function(id){var e=document.getElementById(id);return e?String(e.value).trim():'';},nv=null,amt=NaN;
  if(!ex){var name=val('custom-name'),deb=val('custom-deb'),fin=val('custom-fin'),pz=parseInt(val('custom-pause'))||0,prime=val('custom-prime');
    if(!deb||!fin){alert('Début et fin requis.');return;}
    var a=parseHM(deb),b=parseHM(fin),dur=b-a;if(dur<=0)dur+=1440;var pan=false;if(pz>=45)dur-=pz;else if(coversMealSlot(a,b))pan=true;if(dur<=0){alert('Horaires invalides');return;}
    if(prime==='autre'||m==='formateur')amt=parseFloat(val('cv-autre-amt').replace(/\s/g,'').replace(',','.'));if(prime==='autre'||m==='forme'||m==='formateur'||m==='syndic')prime='';
    var pr={};if(prime)pr[prime]=true;nv={deb:deb,fin:fin,dur:dur,panier:pan,hidden:true,label:name||deb+'–'+fin,primes:pr};}
  // Jour fait déjà occupé (vacation, congé, rendu) : remplacer ou annuler
  if(oKey!==fKey){var fo=(S.overrides||{})[fKey],lk=fo&&fo.echange&&fo.pair===oKey,fg=getVac(fD),cg=(S.conges||{})[fKey];
    if(!lk&&(cg||(fg.vac&&fg.vac!=='RH'&&!fg.absent&&!(fg.echange&&!fg.ecSelf)))&&!await _ask('Le '+fmtDate(fD)+' a déjà '+(cg?'un congé ou un rendu':'une vacation ('+vLbl(fg.vac,VF)+')')+'. Remplacer ?'))return;}
  pushUndo(ex?'Échange enregistré':'Déplacement enregistré');if(!S.overrides)S.overrides={};
  // liens d'un ancien échange / déplacement de ces jours : défaits
  [oKey,fKey].forEach(function(k){var o=S.overrides[k];if(o&&o.echange&&o.pair&&o.pair!==k&&o.pair!==oKey&&o.pair!==fKey){var p=S.overrides[o.pair];if(p&&p.echange&&p.pair===k)delete S.overrides[o.pair];}});
  // Échange aux horaires différents : vacation perso aux horaires faits, primes de la vacation choisie
  var exB=null;if(ex&&W.exHr){var bv=VF[W.exVac]||{},T=W.exT||{};if(!T.deb||!T.fin){alert('Début et fin requis.');return;}
    var ea=parseHM(T.deb),eb=parseHM(T.fin),ed=eb-ea;if(ed<=0)ed+=1440;var ep=parseInt(T.pause)||0,epn=false;if(ep>=45)ed-=ep;else if(coversMealSlot(ea,eb))epn=true;if(bv.panier&&!coversMealSlot(parseHM(bv.deb),parseHM(bv.fin)))epn=true; /* panier forcé dans l'admin : gardé */if(ed<=0){alert('Horaires invalides');return;}
    if(!(T.deb===bv.deb&&T.fin===bv.fin&&ed===bv.dur)){exB=W.exVac;nv={deb:T.deb,fin:T.fin,dur:ed,panier:epn,hidden:true,label:vLbl(W.exVac,VF),primes:Object.assign({},bv.primes||{})};}}
  var V=W.exVac;if(nv){V='_p_'+nv.label+'_'+Date.now();if(!S.customVacs)S.customVacs={};S.customVacs[V]=nv;}
  if(oKey!==fKey){if(S.conges&&S.conges[fKey])delete S.conges[fKey];S.overrides[oKey]={vac:oCyc,fromSV:false,echange:true,ecSelf:false,hs:false,pair:fKey};if(!ex)S.overrides[oKey].motif=m;}
  S.overrides[fKey]={vac:V,fromSV:!fCyc||fCyc==='RH',echange:true,ecSelf:true,hs:!!(ex&&W.exHs),pair:oKey};if(exB)S.overrides[fKey].exBase=exB;if(!ex){S.overrides[fKey].motif=m;S.overrides[fKey].formation=m==='forme';}
  if(!S.dayPrimes)S.dayPrimes={};if(amt>0)S.dayPrimes[fKey]={lbl:m==='formateur'?'Prime formateur':'Prime',amt:Math.round(amt*100)/100};else if(!ex)delete S.dayPrimes[fKey];
  _cvSaveExtras();
  var ML={autre:'horaires',forme:'formation',formateur:'formateur',detache:'détachement',syndic:'détachement syndical'};
  logH(ex?'Échange: '+fmtDate(oD)+' <-> '+fmtDate(fD)+' ('+vLbl(V,VF)+')':fmtDate(oD)+' -> '+fmtDate(fD)+' ('+ML[m]+')',ex?'#c88048':'#62aadc',fKey);
  saveState();render();gcalTrigger();popCell(fKey);openDay(key);_ruleToast([oKey,fKey]);}
// Heures sup d'une vacation changée : méthode « durée » (par défaut) ou « horaires » (comme les vacations mixtes)
function hsModeSet(m,el){if(_hsMode()===m)return;pushUndo(m==='horaires'?'Heures sup : méthode horaires':'Heures sup : méthode durée');if(!S.profile)S.profile={};if(m==='horaires')S.profile.hsMode='horaires';else delete S.profile.hsMode;
  saveState();render();if(el)[].forEach.call(el.parentNode.children,function(b){b.classList.toggle('on',b===el);});try{_segSync();}catch(e){}
  _infoToast(m==='horaires'?'✓ Heures sup : ce qui sort des horaires prévus':'✓ Heures sup : la plus longue des deux vacations');}
// Option « Heures valables un an » : chaque mois de rendus expire à la fin du 12e mois (plus de menu de report)
function exp12Set(on){pushUndo(on?'Heures valables un an':'Expiration par reports');if(!S.profile)S.profile={};if(on)S.profile.exp12=true;else delete S.profile.exp12;saveState();render();_infoToast(on?'✓ Heures valables un an':'Expiration à 3 mois, avec reports');}
// Échange : la page Modifier, sur « un autre jour » et le motif Échange
function openExchange(key){pendingKey=key;_lpk=key;_exState={step:1,targetKey:null,targetVac:null};if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  window._cvReq={motif:'echange'};openCustomVacModal();}
function renderExchangeModal(){if(!window._cvW)window._cvW=_cvWInit(pendingKey||_lpk);window._cvW.when=_exState&&_exState.mode==='week'?'week':(window._cvW.other?'other':'day');_cvRerender();}
function openCustomVacModal(){
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  var key=pendingKey,date=key?new Date(key+'T12:00:00'):new Date(),VAC=getVAC(date),g=key?getVac(date):{},cyc=key?getCycleVac(date).cycleVac:null;
  var cur=g.vac&&g.vac!=='RH'&&!g.absent&&VAC[g.vac]?VAC[g.vac]:null,ov=key?((S.overrides||{})[key]||{}):{};
  // Prévue ce jour / un autre jour (déplacement, échange) / toute la semaine ; redessin (_cvRe) : on garde l'état et la saisie
  var re=!!window._cvRe;window._cvRe=0;var W=window._cvW;
  if(key&&(!re||!W)){W=window._cvW=_cvWInit(key);var rq=window._cvReq;window._cvReq=null;if(rq){if(rq.when)W.when=rq.when;window._cvMotifReq=rq.motif;}}
  if(!key)W={when:'day'};
  var oKey=key,fKey=key;if(key&&W.when==='other'){if(W.role==='give')fKey=W.other;else oKey=W.other;}
  var oDate=oKey?new Date(oKey+'T12:00:00'):null,fDate=fKey?new Date(fKey+'T12:00:00'):date,VACo=oDate?getVAC(oDate):VAC;
  if(key&&W.when==='other'){
    // vacation de référence : celle prévue le jour cédé ; horaires pré-remplis : déplacement déjà posé, sinon cette vacation
    cyc=oDate?getCycleVac(oDate).cycleVac:null;VAC=VACo;
    var fo=fKey?(S.overrides||{})[fKey]:null,VACf=getVAC(fDate);
    cur=fo&&fo.echange&&fo.ecSelf&&fo.pair===oKey&&fo.motif&&VACf[fo.vac]?VACf[fo.vac]:(cyc&&cyc!=='RH'&&VACo[cyc]?VACo[cyc]:null);
    ov=fo&&fo.pair===oKey?fo:{};
  }
  var deb='',fin='',name='',pause='0',pr=cur&&cur.primes||{};
  if(cur){deb=cur.deb||'';fin=cur.fin||'';name=cur.label||g.vac;var tot=parseHM(cur.fin)-parseHM(cur.deb);if(tot<0)tot+=1440;var pz=tot-(cur.dur||0);pause=pz>=60?'60':pz>=45?'45':'0';}
  var prSel=pr.antenne?'antenne':pr.reel?'reel':pr.coord?'coord':'',dp=key?(S.dayPrimes||{})[key]:null;
  window._cvInit={deb:deb,fin:fin,name:name,pause:pause,prime:prSel,had:!!cur};
  if(dp&&dp.amt>0)prSel='autre';
  window._cvInit.sel=prSel;
  var x=key?(S.extraRendus||{})[key]:null,n=key?((S.notes||{})[key]||''):'';
  var fs='padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);font-family:var(--font);-webkit-appearance:none';
  var T='<option value="">—</option><option value="00h00">00h00</option><option value="00h15">00h15</option><option value="00h30">00h30</option><option value="00h45">00h45</option><option value="01h00">01h00</option><option value="01h15">01h15</option><option value="01h30">01h30</option><option value="01h45">01h45</option><option value="02h00">02h00</option><option value="02h15">02h15</option><option value="02h30">02h30</option><option value="02h45">02h45</option><option value="03h00">03h00</option><option value="03h15">03h15</option><option value="03h30">03h30</option><option value="03h45">03h45</option><option value="04h00">04h00</option><option value="04h15">04h15</option><option value="04h30">04h30</option><option value="04h45">04h45</option><option value="05h00">05h00</option><option value="05h15">05h15</option><option value="05h30">05h30</option><option value="05h45">05h45</option><option value="06h00">06h00</option><option value="06h15">06h15</option><option value="06h30">06h30</option><option value="06h45">06h45</option><option value="07h00">07h00</option><option value="07h15">07h15</option><option value="07h30">07h30</option><option value="07h45">07h45</option><option value="08h00">08h00</option><option value="08h15">08h15</option><option value="08h30">08h30</option><option value="08h45">08h45</option><option value="09h00">09h00</option><option value="09h15">09h15</option><option value="09h30">09h30</option><option value="09h45">09h45</option><option value="10h00">10h00</option><option value="10h15">10h15</option><option value="10h30">10h30</option><option value="10h45">10h45</option><option value="11h00">11h00</option><option value="11h15">11h15</option><option value="11h30">11h30</option><option value="11h45">11h45</option><option value="12h00">12h00</option><option value="12h15">12h15</option><option value="12h30">12h30</option><option value="12h45">12h45</option><option value="13h00">13h00</option><option value="13h15">13h15</option><option value="13h30">13h30</option><option value="13h45">13h45</option><option value="14h00">14h00</option><option value="14h15">14h15</option><option value="14h30">14h30</option><option value="14h45">14h45</option><option value="15h00">15h00</option><option value="15h15">15h15</option><option value="15h30">15h30</option><option value="15h45">15h45</option><option value="16h00">16h00</option><option value="16h15">16h15</option><option value="16h30">16h30</option><option value="16h45">16h45</option><option value="17h00">17h00</option><option value="17h15">17h15</option><option value="17h30">17h30</option><option value="17h45">17h45</option><option value="18h00">18h00</option><option value="18h15">18h15</option><option value="18h30">18h30</option><option value="18h45">18h45</option><option value="19h00">19h00</option><option value="19h15">19h15</option><option value="19h30">19h30</option><option value="19h45">19h45</option><option value="20h00">20h00</option><option value="20h15">20h15</option><option value="20h30">20h30</option><option value="20h45">20h45</option><option value="21h00">21h00</option><option value="21h15">21h15</option><option value="21h30">21h30</option><option value="21h45">21h45</option><option value="22h00">22h00</option><option value="22h15">22h15</option><option value="22h30">22h30</option><option value="22h45">22h45</option><option value="23h00">23h00</option><option value="23h15">23h15</option><option value="23h30">23h30</option><option value="23h45">23h45</option>';
  var cI=cyc&&cyc!=='RH'&&VAC[cyc]?VAC[cyc]:null,cN=cI?vLbl(cyc,VAC)+(key&&W.when==='other'&&oDate?' ('+_cvSd(oKey)+')':''):'';
  var tg=function(id,lbl,on){return '<div class="srow" style="padding:6px 0"><div class="slbl">'+lbl+'</div><label class="tgl"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'><span class="tgl-s"></span></label></div>';};
  // Motif du changement : formé (garde les primes prévues), formateur (les perd, prime de formateur), autre
  var motif=re&&window._cvMotif?window._cvMotif:(window._cvMotifReq||(ov.echange?(ov.motif||'echange'):(ov.motif||(ov.formation?'forme':'autre'))));window._cvMotifReq=null;window._cvMotif=motif;
  var cP=[];if(cI){var cp=cI.primes||{};if(cp.antenne)cP.push('Antenne');if(cp.reel)cP.push('Réal');if(cp.coord)cP.push('Coordination');if(cI.deb&&_toMinApp(cI.deb)<240)cP.push('matin');}
  if(key&&W.when==='other'&&!oKey)cN='';
  window._cvHints={forme:cN?'celles de '+cN+(cP.length?' ('+cP.join(', ')+')':''):'aucune',formateur:cN?'pas celles de '+cN:'aucune',detache:'',syndic:cN?'celles de '+cN+(cP.filter(function(x){return x!=='matin';}).length?' ('+cP.filter(function(x){return x!=='matin';}).join(', ')+')':'')+' ; matin si la vacation faite commence avant 4h':'aucune',autre:'',echange:''};
  var mB=function(k,l){return '<option value="'+k+'"'+(motif===k?' selected':'')+'>'+l+'</option>';};
  // « Pourquoi ce changement ? » : chaque choix montre directement ce qu'il implique pour les primes
  if(key&&W.when==='other'&&motif==='autre'){motif='echange';window._cvMotif=motif;}
  var opts=(key?'<div class="cv-sec">Motif</div><div id="cv-motif" style="margin-bottom:14px"><select id="cv-motif-sel" onchange="_cvSetMotif(this.value)" style="width:100%;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);font-family:var(--font);-webkit-appearance:none">'
      +(W.when==='other'?'':mB('autre','Horaires modifiés'))+mB('echange','Échange')+mB('forme','Formation suivie')+mB('formateur','Formateur')+mB('detache','Détachement')+mB('syndic','Délégation syndicale')+'</select></div>':'')
    ;
  window._cvCalcRef=cI&&!cI.mixte?{n:cN,dur:cI.dur||0,nuit:calcNuitMinShift(cI),deb:cI.deb}:(cI?{n:'',dur:-1}:{n:'',dur:0});
  var dO='<option value="0">—</option>';for(var d=15;d<=600;d+=15)dO+='<option value="'+d+'"'+(x&&x.dur===d?' selected':'')+'>'+fmtMin(d)+'</option>';
  var card='margin:0 0 10px;padding:12px';
  if(key&&W.when==='week'){_exState.mode='week';
    document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)openDay(pendingKey)"><div class="sheet"><div class="sh"></div>'
      +'<div class="nav-back" style="'+_navBackCss+'" onclick="_cvSetWhen(window._cvW.other?\'other\':\'day\')">‹ Modifier</div>'
      +'<div class="st" style="margin-bottom:2px">Échange de semaine</div><div style="font-size:11px;color:var(--text3);margin-bottom:12px">'+fmtDate(date)+'</div>'
      +_exWeekHtml(getMonday(date))+'<button class="mcancel" onclick="openDay(pendingKey)">Fermer</button></div></div>';
    return;}
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this){if(pendingKey)openDay(pendingKey);else closeModal();}"><div class="sheet"><div class="sh"></div>'
    +'<div class="st" style="margin-bottom:2px">'+(key?'Modifier':'Ajouter')+'</div>'
    +(key?'<div style="font-size:11px;color:var(--text3);margin-bottom:12px">'+fmtDate(date)+'</div>':'')
    +(key&&(S.overrides||{})[key]&&(S.overrides||{})[key].echange?_exCurHtml(key):'')
    +(key?_cvWhenHtml(key,W)+opts:'')
    // Quoi : horaires (ou vacation de l'échange) ; jour déjà modifié (hors échange) : retour à la vacation prévue au cycle
    +(key?'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div class="cv-sec">Vacation</div>'
      +(ov.vac&&!ov.echange?'<button type="button" class="adj-pill" style="width:auto;padding:0 12px;height:26px;font-size:13px;margin-bottom:6px" onclick="_cvRevert()">Revenir à l’original</button>':'')+'</div>':'')
    +'<div class="hd-card" style="'+card+'">'
    +'<div id="cv-fields"'+(motif==='echange'?' style="display:none"':'')+'>'
    +'<div class="mrow"><label>Nom</label><input id="custom-name" list="cv-vac-list" autocomplete="off" placeholder="B1, formation, renfort…" style="width:100%;'+fs+'"><datalist id="cv-vac-list">'+_cvVacOpts(fDate,getVAC(fDate))+'</datalist></div>'
    // Début | Fin | Pause sur une ligne
    +'<div class="mr2" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:14px"><div><label>Début</label><select id="custom-deb" style="width:100%;'+fs+'">'+T+'</select></div><div><label>Fin</label><select id="custom-fin" style="width:100%;'+fs+'">'+T+'</select></div>'
    +'<div><label>Pause</label><select id="custom-pause" style="width:100%;'+fs+'"><option value="0">Sans</option><option value="45">45 min</option><option value="60">1h00</option></select></div></div>'
    // Ce que change le motif, toujours au même endroit : Heures, Primes, En plus (nuit, matin, panier, majoration)
    +(key?'<div class="cv-sum">'
      +'<div class="cv-r"><span>Heures</span><div id="cv-calc" class="cv-v"></div></div>'
      +'<div class="cv-r" id="cv-prime-row"><span id="cv-autre-lbl">Primes</span><div class="cv-v" style="display:flex;gap:8px;align-items:center">'
      +'<select id="custom-prime" onchange="_cvPrimeSync(this)" style="flex:1;min-width:0;'+fs+';padding:7px 10px;font-size:13px;display:'+(motif==='autre'||motif==='detache'?'':'none')+'"><option value="">Aucune</option><option value="antenne">Antenne</option><option value="reel">Réal</option><option value="coord">Coordination</option><option value="autre">Autre (montant)</option></select>'
      +'<div id="cv-motif-hint" style="flex:1;min-width:0;display:'+(motif==='autre'||motif==='detache'?'none':'')+'">'+window._cvHints[motif]+'</div>'
      +'<div id="cv-autre" style="width:104px;flex:none;display:'+(prSel==='autre'||motif==='formateur'?'':'none')+'"><input id="cv-autre-amt" inputmode="decimal" placeholder="'+(motif==='formateur'?'formateur €':'0,00 €')+'" value="'+(dp&&dp.amt>0?String(dp.amt).replace('.',','):'')+'" style="width:100%;box-sizing:border-box;'+fs+';padding:7px 10px;font-size:13px"></div>'
      +'</div></div>'
      +'<div class="cv-r" id="cv-x-row"><span>Variables</span><div id="cv-x" class="cv-v"></div></div>'
      +'</div><div id="cv-rule" style="font-size:13px;line-height:1.4;margin-top:6px"></div>'
    // Ajout d'une vacation perso (sans jour) : seulement le menu des primes
    :'<div class="mrow" style="margin:8px 0 2px"><label>Primes</label><select id="custom-prime" style="width:100%;'+fs+'"><option value="">Aucune</option><option value="antenne">Antenne</option><option value="reel">Réal</option><option value="coord">Coordination</option></select></div>')
    +'</div>'
    // Échange : la vacation faite se choisit dans la grille du jour fait
    +(key?'<div id="cv-exg"'+(motif==='echange'?'':' style="display:none"')+'>'+_cvExGrid(fKey)+'</div>':'')
    +'</div>'
    +(key?'<button type="button" class="adj-pill" id="cv-more-b" style="width:auto;padding:0 14px;height:30px;font-size:13px;margin:0 0 10px;'+((x&&x.dur>0)||n?'display:none':'')+'" onclick="this.style.display=\'none\';document.getElementById(\'cv-more\').style.display=\'\'">+ Rendu acquis, note</button>'
      +'<div id="cv-more"'+((x&&x.dur>0)||n?'':' style="display:none"')+'>':'')
    +(key?'<div class="hd-card" style="'+card+'"><div class="btit" style="margin:0 0 8px">Heures de rendu acquises</div>'
      +'<div style="display:flex;gap:8px"><input id="cv-exr-lbl" placeholder="Réunion, formation…" value="'+String((x&&x.label)||'').replace(/"/g,'&quot;')+'" style="flex:1;min-width:0;'+fs+'"><select id="cv-exr-dur" onchange="_cvRmSync()" style="width:96px;'+fs+'">'+dO+'</select><button id="cv-exr-rm" class="cv-rm'+(x&&x.dur>0?' on':'')+'" type="button" aria-label="Retirer les heures acquises" onclick="_cvRmClick(this)"><i class="ti ti-trash"></i></button></div></div>'
      +'<div class="mrow" style="margin-bottom:16px"><label>Note</label><input id="cv-note" maxlength="200" autocomplete="off" placeholder="Facultatif" value="'+_h(String(n).replace(/\s*\n\s*/g,' '))+'" style="width:100%;box-sizing:border-box;'+fs+'"></div>':'')
    +(key?'</div>':'')
    +'<div class="mbtns"><button class="mb" onclick="if(pendingKey)openDay(pendingKey);else closeModal()">Annuler</button><button class="mb pri" onclick="confirmCustomVac()">Valider</button></div>'
    +'</div></div>';
  document.getElementById('custom-name').value=name;
  document.getElementById('custom-deb').value=deb;
  document.getElementById('custom-fin').value=fin;
  document.getElementById('custom-pause').value=pause;
  document.getElementById('custom-prime').value=prSel;
  _cvAuto=null;document.getElementById('custom-name').addEventListener('input',function(){_cvFromVac(this.value);}); // pré-remplit dès que le nom tapé correspond à une vacation connue
  ['custom-deb','custom-fin','custom-pause'].forEach(function(id){var e=document.getElementById(id);if(e)e.addEventListener('change',_cvCalc);});_cvCalc();
  // Déjà « Formé » : la liste verrouillée n'est pas un changement de la vacation
  if(document.getElementById('cv-motif')&&_cvPrimeLock(motif)){window._cvInit.prime='';window._cvInit.sel='';}
  if(re&&window._cvDraft){var D=window._cvDraft,st=function(id,v){var e=document.getElementById(id);if(e&&v!=null)e.value=v;};
    st('custom-name',D.name);st('custom-deb',D.deb);st('custom-fin',D.fin);st('custom-pause',D.pause);st('custom-prime',D.prime);st('cv-autre-amt',D.amt);st('cv-note',D.note);st('cv-exr-lbl',D.xl);st('cv-exr-dur',D.xd);
    var sp=document.getElementById('custom-prime');if(sp&&motif!=='formateur')_cvPrimeSync(sp,1);_cvRmSync();_cvCalc();}
  window._cvDraft=null;
  _cvExTSet();
}



function _cvVals(){var g=function(id){var e=document.getElementById(id);return e?e.value:'';};return{deb:g('custom-deb'),fin:g('custom-fin'),pause:g('custom-pause'),prime:g('custom-prime')};}
function _cvUnfill(){if(!_cvAuto)return;var a=_cvAuto;_cvAuto=null;if(JSON.stringify(_cvVals())!==JSON.stringify(a.filled))return;
  var set=function(id,val){var e=document.getElementById(id);if(e)e.value=val;};set('custom-deb',a.snap.deb);set('custom-fin',a.snap.fin);set('custom-pause',a.snap.pause);
  var sel=document.getElementById('custom-prime');if(sel){sel.value=a.snap.prime;_cvPrimeSync(sel);}_cvCalc();}
function _cvFromVac(lbl){var key=pendingKey;if(!lbl||!key){_cvUnfill();return;}var date=new Date(key+'T12:00:00'),VAC=getVAC(date),L=lbl.trim().toLowerCase();
  // Même label pour plusieurs vacations (ex. C1 du cycle actuel et C1 par défaut de l'app) : celle du cycle du jour d'abord, puis les vacations de l'équipe, puis les perso, en dernier les horaires par défaut
  var _cl=_cycleVacList(date)||[],_cvPrio=function(k){return _cl.indexOf(k)>=0?0:(_globalVacs[k]?1:(S.customVacs&&S.customVacs[k]?2:3));};
  var _ok=_cvDayVacs(date,VAC);var n=Object.keys(VAC).filter(function(k){return _ok.indexOf(k)>=0&&String(vLbl(k,VAC)).toLowerCase()===L;}).sort(function(a,b){return _cvPrio(a)-_cvPrio(b);})[0],v=n&&VAC[n];if(!v||v.mixte||!v.deb||!v.fin){_cvUnfill();return;}
  var _snap=_cvAuto?_cvAuto.snap:_cvVals();
  var set=function(id,val){var e=document.getElementById(id);if(e)e.value=val;};set('custom-deb',v.deb);set('custom-fin',v.fin);
  var tot=parseHM(v.fin)-parseHM(v.deb);if(tot<0)tot+=1440;var pz=tot-(v.dur||0);set('custom-pause',pz>=60?'60':pz>=45?'45':'0');
  var sel=document.getElementById('custom-prime'),pr=v.primes||{},pv=pr.antenne?'antenne':pr.reel?'reel':pr.coord?'coord':'';
  if(sel&&sel.value!=='autre'){var o=sel.querySelector('option[value="'+pv+'"]');if(!pv||(o&&!o.disabled))sel.value=pv;_cvPrimeSync(sel);}
  _cvAuto={snap:_snap,filled:_cvVals()};_cvCalc();}
// Ligne de calcul sous les horaires : heures faites, heures comptées, heures sup
function _cvCalc(){var el=document.getElementById('cv-calc'),R=window._cvCalcRef,xr=document.getElementById('cv-x-row'),xe=document.getElementById('cv-x');if(!el)return;
  var none=function(){el.innerHTML='<span style="color:var(--text3)">début et fin à saisir</span>';if(xe)xe.innerHTML='—';};if(!R){none();return;}
  var g=function(id){var e=document.getElementById(id);return e?e.value:'';},d=g('custom-deb'),f=g('custom-fin');if(!d||!f){none();return;}
  var a=parseHM(d),b=parseHM(f),t=b-a;if(t<=0)t+=1440;var pz=parseInt(g('custom-pause'))||0;if(pz>=45)t-=pz;if(t<=0){none();return;}
  var l1=_isDet(window._cvMotif)?'<b style="color:var(--text2)">'+fmtMin(t)+'</b> faites · '+(R.n&&R.dur>0?'compte '+R.n+' ('+fmtMin(R.dur)+'), ':'')+'ni heures sup ni rendus':R.dur<0?'<b style="color:var(--text2)">'+fmtMin(t)+'</b> faites':!R.dur?'<b style="color:var(--text2)">'+fmtMin(t)+'</b> faites, en heures sup (jour de repos).'
    :(function(){var x=t-R.dur;return '<b style="color:var(--text2)">'+fmtMin(t)+'</b> faites · '+R.n+' prévue '+fmtMin(R.dur)+(x>0?' → <b style="color:var(--blue)">+'+fmtMin(x)+' en heures sup</b>':x<0?' → '+fmtMin(R.dur)+' comptées':'');})();
  // Ce que le jour rapporte en plus : nuit (formation suivie → la plus grande des deux), matin, panier, majoration du jour
  var _W=window._cvW||{},syn=window._cvMotif==='syndic'&&R.dur>0,forme=(window._cvMotif==='forme'||syn)&&R.dur>0,key=_W.when==='other'&&_W.role==='give'&&_W.other?_W.other:pendingKey,date=key?new Date(key+'T12:00:00'):null,ch=[];
  var nu=calcNuitMinShift({deb:d,fin:f}),nf=forme&&(R.nuit||0)>nu;if(forme)nu=Math.max(nu,R.nuit||0);if(nu>0)ch.push('<span style="color:#9c7fe0">Nuit '+fmtMin(nu)+(nf?' (celle de '+R.n+')':'')+'</span>');
  var md=forme&&!syn&&R.deb?_toMinApp(R.deb):a;if(md!==null&&md<240)ch.push('<span style="color:var(--amber)">Matin</span>');
  if(pz<45&&coversMealSlot(a,b))ch.push('<span style="color:var(--amber)">Panier</span>');
  if(date){var tx=getTauxForYM(date.getFullYear()*12+date.getMonth()),gv=getVac(date);
    var hx=fmtMin(t);if(FERIES.has(key))ch.push('Férié '+hx+' <span style="opacity:.6">×'+tx.fer+'%</span>');else if(date.getDay()===0)ch.push('Dimanche '+hx+' <span style="opacity:.6">×'+tx.dim+'%</span>');else if(isRHDay(date)&&!(gv.echange&&!gv.ecSelf))ch.push('RH '+hx+' <span style="opacity:.6">×'+tx.rh+'%</span>');}
  el.innerHTML=l1;if(xe)xe.innerHTML=ch.length?ch.join(' · '):'—';
  // règles de travail avec les horaires saisis : repos avec la veille et le lendemain, jours d'affilée
  var ru=document.getElementById('cv-rule');if(ru){var M=[];if(key){var e1=b<=a?b+1440:b,pv=_shiftOf(_dAdd(key,-1)),nx=_shiftOf(_dAdd(key,1)),tx=function(r,w){return r<RULES.reposMin?'<span style="color:var(--red)">Repos de '+fmtMin(r)+' '+w+' : moins de 9h, non autorisé</span>':'<span style="color:var(--amber)">Repos de '+fmtMin(r)+' '+w+' : moins de 11h, uniquement sur demande du salarié</span>';};
    if(pv&&1440-pv.e+a<RULES.repos)M.push(tx(1440-pv.e+a,'après la '+vLbl(pv.v,getVAC(_dAdd(key,-1)))+' de la veille'));
    if(nx&&1440-e1+nx.s<RULES.repos)M.push(tx(1440-e1+nx.s,'avant la '+vLbl(nx.v,getVAC(_dAdd(key,1)))+' du lendemain'));
    var bk=0,fw=0;while(bk<60&&_shiftOf(_dAdd(key,-bk-1)))bk++;while(fw<60&&_shiftOf(_dAdd(key,fw+1)))fw++;
    if(bk+fw+1>RULES.joursMax)M.push('<span style="color:var(--amber)">'+(bk+fw+1)+' jours travaillés d’affilée : '+fmtMin(RULES.rendJourSup)+' de rendus par jour au-delà du 6e</span>');}
    ru.innerHTML=M.join('<br>');}}
// Revenir à l'original : retire la modification du jour (et sa prime du jour), l'écran se recharge sur la vacation prévue
function _cvRevert(){var k=pendingKey;if(!k||!(S.overrides||{})[k])return;pushUndo('Vacation remise');
  delete S.overrides[k];if(S.dayPrimes)delete S.dayPrimes[k];removeHistoryForKey(k);saveState();render();gcalTrigger();openCustomVacModal();}
// Motif : formateur ouvre directement la prime de formateur
function _cvSetMotif(k){var prev=window._cvMotif;window._cvMotif=k;setTimeout(_cvCalc,0);
  var cf=document.getElementById('cv-fields'),cx=document.getElementById('cv-exg');if(cf)cf.style.display=k==='echange'?'none':'';if(cx)cx.style.display=k==='echange'?'':'none';var _ms=document.getElementById('cv-motif-sel');if(_ms&&_ms.value!==k)_ms.value=k;
  var h=document.getElementById('cv-motif-hint');if(h){h.textContent=(window._cvHints||{})[k]||'';h.style.display=k==='autre'||k==='detache'?'none':'';}
  var am=document.getElementById('cv-autre-amt');if(am)am.placeholder=k==='formateur'?'formateur €':'0,00 €';
  var row=document.getElementById('custom-prime');if(row)row.style.display=k==='autre'||k==='detache'?'':'none'; // menu des primes : seulement pour « Horaires modifiés »
  var sel=document.getElementById('custom-prime'),I=window._cvInit||{};
  if(k==='formateur'&&sel&&sel.value!=='autre'){sel.value='autre';_cvPrimeSync(sel,1);}            // formateur : champ du montant
  else if((k==='forme'||_isDet(k))&&sel&&prev!==k){sel.value='';_cvPrimeSync(sel,1);} // détachement : pas de prime par défaut, au choix dans le menu                                       // formé : rien à saisir
  else if(k==='autre'&&prev!=='autre'&&sel){sel.value=I.sel||'';_cvPrimeSync(sel);}               // retour aux horaires modifiés : prime d'origine
  _cvPrimeLock(k);}
// Formé : les primes sont celles de la vacation prévue, la liste ne propose plus qu'« Aucune » ou « Autre »
function _cvPrimeLock(k){var sel=document.getElementById('custom-prime');if(!sel)return false;var lk=k==='forme'||k==='syndic',ch=false;
  ['antenne','reel','coord'].forEach(function(v){var o=sel.querySelector('option[value="'+v+'"]');if(o)o.disabled=lk;});
  if(lk&&['antenne','reel','coord'].indexOf(sel.value)>=0){sel.value='';_cvPrimeSync(sel);ch=true;}return ch;}
// Prime « Autre » : montant saisi à la main (prime du jour)
function _cvPrimeSync(sel,noFocus){var a=document.getElementById('cv-autre');if(!a)return;var on=sel.value==='autre';a.style.display=on?'':'none';if(on&&!noFocus)document.getElementById('cv-autre-amt').focus();}
// Bouton corbeille des heures acquises : visible dès qu'une durée est choisie, vide la case au clic
function _cvRmSync(){var d=document.getElementById('cv-exr-dur'),b=document.getElementById('cv-exr-rm');if(d&&b)b.classList.toggle('on',(parseInt(d.value)||0)>0);}
function _cvRmClick(b){document.getElementById('cv-exr-dur').value='0';document.getElementById('cv-exr-lbl').value='';b.classList.remove('on');}
// Note et rendu en plus de l'écran « Modifier le jour »
function _cvSaveExtras(){
    // Note et rendu en plus saisis directement dans l'écran
    var _ntx=document.getElementById('cv-note'),_xd=document.getElementById('cv-exr-dur'),_xl=document.getElementById('cv-exr-lbl');
    if(_ntx){var _nv=_ntx.value.trim();if(!S.notes)S.notes={};var _nOld=S.notes[pendingKey]||'';if(_nv!==_nOld){pushUndo('Note modifiée');if(_nv)S.notes[pendingKey]=_nv;else delete S.notes[pendingKey];}}
    if(_xd){var _xv=parseInt(_xd.value)||0,_xlv=(_xl&&_xl.value.trim())||'';if(!S.extraRendus)S.extraRendus={};var _xo=JSON.stringify(S.extraRendus[pendingKey]||null);
      var _xn=_xv>0?{dur:_xv,label:_xlv}:null;
      if(JSON.stringify(_xn)!==_xo){pushUndo('Heures en plus modifiées');if(_xn)S.extraRendus[pendingKey]=_xn;else delete S.extraRendus[pendingKey];}}
}
function confirmCustomVac(){
  if(pendingKey&&((window._cvW&&window._cvW.when==='other')||window._cvMotif==='echange')){_cvSaveMove();return;}
  var val=function(id){var e=document.getElementById(id);return e?String(e.value).trim():'';};
  var name=val('custom-name'),debStr=val('custom-deb'),finStr=val('custom-fin'),pauseMin=parseInt(val('custom-pause'))||0,prime=val('custom-prime');
  var I=window._cvInit||{},key=pendingKey;
  var hs=false; // heures sup : calculées d'après les horaires (la plus grande, prévue ou faite)
  var motif=document.getElementById('cv-motif')?(window._cvMotif||'autre'):'autre',formation=motif==='forme';
  var vacEmpty=!debStr||!finStr;
  var autreAmt=prime==='autre'?parseFloat(val('cv-autre-amt').replace(/\s/g,'').replace(',','.')):NaN;
  // « Autre » remplace la prime de la vacation ; liste non touchée : la prime de la vacation reste telle quelle
  if(prime===I.sel)prime=I.prime;else if(prime==='autre')prime='';
  // Pause de moins de 45 min = sans pause (même calcul)
  var vacSame=debStr===I.deb&&finStr===I.fin&&name===I.name&&String(pauseMin)===String(I.pause)&&prime===I.prime;
  var dur=0,panier=false;
  if(!vacEmpty&&!vacSame){
    var debMin=parseHM(debStr),finMin=parseHM(finStr);
    dur=finMin-debMin;if(dur<=0)dur+=1440;
    if(pauseMin>=45)dur-=pauseMin;else if(coversMealSlot(debMin,finMin))panier=true;
    if(dur<=0){alert('Horaires invalides');return;}
    if(!name)name=debStr+'–'+finStr;
  }
  if(!key&&(vacEmpty||!name)){alert('Nom et horaires requis');return;}
  // horaires saisis identiques à la vacation prévue au cycle : pas de modification (comme choisir cette vacation)
  if(key&&!vacEmpty&&!vacSame&&motif==='autre'&&!(autreAmt>0)){var _cd=new Date(key+'T12:00:00'),_cy=getCycleVac(_cd).cycleVac,_ci=_cy&&_cy!=='RH'?getVAC(_cd)[_cy]:null,_cp=_ci&&_ci.primes||{};
    if(_ci&&debStr===_ci.deb&&finStr===_ci.fin&&dur===_ci.dur&&prime===(_cp.antenne?'antenne':_cp.reel?'reel':_cp.coord?'coord':'')){
      _cvSaveExtras();if((S.overrides||{})[key]){pushUndo('Vacation remise');delete S.overrides[key];removeHistoryForKey(key);}
      saveState();render();gcalTrigger();popCell(key);openDay(key);return;}}
  if(key){_cvSaveExtras();
    if(!S.dayPrimes)S.dayPrimes={};var _dpO=JSON.stringify(S.dayPrimes[key]||null),_dpN=autreAmt>0?{lbl:motif==='formateur'?'Prime formateur':((S.dayPrimes[key]||{}).lbl==='Prime formateur'?'Prime':(S.dayPrimes[key]||{}).lbl)||'Prime',amt:Math.round(autreAmt*100)/100}:null;
    if(JSON.stringify(_dpN)!==_dpO){pushUndo('Prime modifiée');if(_dpN)S.dayPrimes[key]=_dpN;else delete S.dayPrimes[key];}}
  if(!vacEmpty&&!vacSame){
    if(!S.customVacs)S.customVacs={};
    var vacKey=key&&(VAC_STD[name]||_globalVacs[name])?'_p_'+name+'_'+Date.now():name;
    var _pr={};if(prime)_pr[prime]=true;
    S.customVacs[vacKey]={deb:debStr,fin:finStr,dur:dur,panier:panier,hidden:!!key,label:name,primes:_pr};
    if(key){
      pushUndo('Vacation modifiée');
      var date=new Date(key+'T12:00:00'),cv=getCycleVac(date).cycleVac;
      if(!S.overrides)S.overrides={};
      S.overrides[key]={vac:vacKey,fromSV:!cv||cv==='RH',echange:false,hs:hs,formation:formation,motif:motif};
      logH(fmtDate(date)+' -> '+name+(motif==='forme'?' (formation suivie)':motif==='formateur'?' (formateur)':motif==='detache'?' (détachement)':motif==='syndic'?' (détachement syndical)':''),'#62aadc',key);
    }
  } else if(key&&I.had){
    // Vacation inchangée : seules les options changent (jour déjà modifié)
    var o=(S.overrides||{})[key];
    if(o&&(!!o.formation!==formation||(o.motif||'autre')!==motif)){pushUndo('Option modifiée');o.formation=formation;o.motif=motif;}
  }
  saveState();render();gcalTrigger();
  if(key){popCell(key);openDay(key);_ruleToast([key]);}else closeModal();
}


function openAutreVacModal(){
  if(!document.body.classList.contains('modal-open'))_lockBodyScroll();
  const key=pendingKey||_lpk,html=_autreVacHtml();
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div><div class="st">Autres vacations</div>'
    +(html||'<div style="font-size:13px;color:var(--text3);padding:10px 0">Aucune vacation disponible ce jour.</div>')
    +'<button class="mcancel" onclick="if(pendingKey)openDay(pendingKey);else closeModal()">Retour</button>'
    +'</div></div>';
  if(key)_dayHApply();
}

// Pastille des sélecteurs : placée sous le choix « on », elle glisse quand il change (première pose sans animation)
function _segSync(){document.querySelectorAll('#modal-root .cv-seg,#modal-root .bpseg').forEach(function(g){var on=g.querySelector('.on');
  if(!on||!on.offsetWidth){g.style.setProperty('--so',0);return;}
  g.style.setProperty('--sx',on.offsetLeft+'px');g.style.setProperty('--sw',on.offsetWidth+'px');g.style.setProperty('--so',1);
  if(!g.classList.contains('seg-anim'))requestAnimationFrame(function(){g.classList.add('seg-anim');});});}
function init(){
  (function(){var mr=document.getElementById('modal-root');if(mr&&window.MutationObserver)new MutationObserver(function(){requestAnimationFrame(_segSync);}).observe(mr,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});window.addEventListener('resize',_segSync);})();
  _applyBigScreenZoom();
  // Detect touch device and disable hover effects
  if('ontouchstart' in window){
    document.documentElement.classList.add('touch');
    // Kill sticky hover on mobile by blurring after touchend
    document.addEventListener('touchend', function(e){
      const el = e.target;
      if(el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if(el && el.blur) setTimeout(function(){ el.blur(); }, 0);
      // Move focus to body to clear hover state (skip if an input gained focus)
      setTimeout(function(){
        const a=document.activeElement;
        if(a && (a.tagName==='INPUT'||a.tagName==='TEXTAREA')) return;
        const t=document.createElement('button');
        t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';
        document.body.appendChild(t);t.focus();document.body.removeChild(t);
      }, 100);
    }, {passive:true});
  }
  // Tirer pour actualiser, façon iOS : rien ne bouge ; la roue remplace le nom du mois, ses rayons apparaissent avec la traction,
  // vibration au seuil, puis elle tourne et l'app se recharge (sans écran de chargement). Le cycle de la roue continue au même point
  // après le rechargement. Puis la roue s'efface, « Actualisé ✓ » (ou « Hors ligne ») s'affiche, et le nom du mois revient.
  (function(){if(!document.getElementById('ptr-spin'))return; // pas de tirer pour actualiser (version PC)
    var y0=0,active=false,trig=false,TH=64,H=420,P=800;
    var ind=document.getElementById('ptr-indicator'),spin=document.getElementById('ptr-spin'),msg=document.getElementById('ptr-msg'),tit=document.getElementById('mtit'),lines=[].slice.call(spin.querySelectorAll('line'));
    var rubber=function(x){return (1-1/(x*.55/H+1))*H;};
    var x0=0,lock=null,DEAD=22,msgMode=false,tms=[],later=function(f,ms){tms.push(setTimeout(f,ms));},clearLater=function(){tms.forEach(clearTimeout);tms=[];};
    var ticks=function(n){lines.forEach(function(l,k){l.style.transition='';l.style.opacity=k<n?.8:0;});};
    var startSpin=function(t0){ind.style.setProperty('--ph',(-((Date.now()-t0)%P)/1000)+'s');lines.forEach(function(l){l.style.opacity='';});ind.classList.add('load');};
    // Arrêt façon iOS : la roue ne relance plus de tour, chaque rayon finit de s'éteindre à son rythme (les plus pâles partent d'abord)
    var stopSpin=function(){var ops=lines.map(function(l){return parseFloat(getComputedStyle(l).opacity)||0;});
      lines.forEach(function(l,k){l.style.transition='none';l.style.opacity=ops[k];});ind.classList.remove('load');void spin.offsetWidth;
      lines.forEach(function(l,k){var d=ops[k]/.75*.45;l.style.transition='opacity '+d.toFixed(3)+'s linear';l.style.opacity=0;});};
    // Arrêt en haut : on laisse la tête finir son tour jusqu'au rayon du haut, puis arrêt ; c'est ce rayon qui s'éteint en dernier
    var stopEnd=0,stopAtTop=function(t0){var w=P-((Date.now()-t0)%P);
      // phase réelle du rayon du haut (l'animation peut avoir démarré un peu après le calcul) : on s'arrête quand il se rallume
      try{var an=lines[0].getAnimations()[0],pr=an&&an.effect.getComputedTiming().progress;if(pr!=null)w=(1-pr)*P;}catch(e){}
      if(w<40)w+=P;stopEnd=Date.now()+w+650;setTimeout(stopSpin,w);};
    var hideSpin=function(ms){spin.style.transition='opacity '+ms+'ms ease,transform '+ms+'ms ease';spin.style.opacity=0;spin.style.transform='scale(.5)';};
    document.addEventListener('touchstart',function(e){
      if(window.scrollY>0||document.body.scrollTop>0||document.body.classList.contains('modal-open')||ind.classList.contains('load'))return;
      y0=e.touches[0].clientY;x0=e.touches[0].clientX;active=true;trig=false;lock=null;
      // « Actualisé » à l'écran (nom du mois masqué) : pendant cette traction, seul le message s'efface, le mois reste caché
      msgMode=msg.classList.contains('on')||tms.length>0||tit.style.opacity==='0';
    },{passive:true});
    document.addEventListener('touchmove',function(e){
      if(!active)return;
      var dy=e.touches[0].clientY-y0,dx=e.touches[0].clientX-x0;
      // sens du geste décidé une fois pour toutes : un geste plutôt horizontal (changement de mois) n'actualise jamais
      if(!lock&&(Math.abs(dx)>10||Math.abs(dy)>10))lock=dy>Math.abs(dx)*1.3?'v':'h';
      if(lock!=='v'){if(lock==='h')active=false;return;}
      dy-=DEAD; // zone morte : le nom du mois ne commence à s'effacer qu'après un vrai mouvement vers le bas
      if(dy<=0||window.scrollY>0){spin.style.opacity=0;if(msgMode)msg.style.opacity='';else tit.style.opacity='';return;}
      var p=Math.min(1,rubber(dy)/TH);
      // « Actualisé » encore affiché : il s'efface comme le nom du mois, et ne revient pas
      if(msgMode){clearLater();msg.style.transition='none';msg.style.opacity=Math.max(0,1-p*2.2);tit.style.transition='none';tit.style.opacity=0;}
      else tit.style.opacity=Math.max(0,1-p*2.2);
      spin.style.transition='none';spin.style.opacity=Math.min(1,p*1.5);spin.style.transform='scale('+(.5+.5*p)+')';
      ticks(Math.ceil(p*8));
      var was=trig;trig=p>=1;if(trig&&!was)_haptic();
    },{passive:true});
    document.addEventListener('touchend',function(){
      if(!active)return;active=false;
      if(!trig){hideSpin(250);
        // relâché sans actualiser : le message disparaît, puis le nom du mois revient en fondu
        if(msgMode){msg.style.transition='';msg.classList.remove('on');msg.style.opacity='';setTimeout(function(){tit.style.transition='';tit.style.opacity='';},200);}
        else{tit.style.transition='';tit.style.opacity='';}
        return;}
      doRefresh();
    },{passive:true});
    // actualisation (tirer vers le bas, ou toucher Accueil déjà sur le mois en cours) : la roue tourne, fondu vers le chargement, rechargement
    function doRefresh(tap){if(ind.classList.contains('load'))return;
      if(tap){clearLater();tit.style.transition='opacity .15s ease';tit.style.opacity=0;spin.style.transition='opacity .15s ease,transform .2s ease';spin.style.opacity=1;spin.style.transform='scale(1)';ticks(8);}
      msg.style.transition='';msg.classList.remove('on');msg.style.opacity='';
      var t0=Date.now();startSpin(t0);
      try{sessionStorage.setItem('ptr-ok',(navigator.onLine?'1':'off')+':'+t0);}catch(e){}
      // fondu vers l'écran de chargement (calé sur la page, roue au même endroit et même cycle), puis rechargement
      var bc=window._bootCopy&&window._bootCopy.cloneNode(true);if(bc&&_isLand()){_saveBootGeoLand();if(window._bootLand)window._bootLand(bc);} // à l'horizontale : silhouette posée sur l'app telle qu'elle est
      if(!bc){setTimeout(function(){location.reload();},350);return;}
      bc.classList.add('ptr');bc.style.opacity='0';bc.style.transition='opacity .3s ease';
      var bar=bc.querySelector('.bt-bar'),w=document.createElement('div');w.className='bt-ptr';
      w.innerHTML=window._bootSpinSvg||'';if(bar)bar.appendChild(w);
      // phases calculées au moment où la copie apparaît (pulsation et roue en phase avec la page rechargée : pas de saut)
      setTimeout(function(){bc.style.setProperty('--btd',(-(Date.now()%1300)/1000)+'s');w.style.setProperty('--ph',(-((Date.now()-t0)%P)/1000)+'s');document.body.appendChild(bc);requestAnimationFrame(function(){requestAnimationFrame(function(){bc.style.opacity='1';});});
        setTimeout(function(){location.reload();},330);},150);
    }
    window._ptrRefresh=function(){doRefresh(true);};
    // Après le rechargement : la roue continue son cycle, puis laisse place au message, puis au nom du mois
    var ok=null;try{ok=sessionStorage.getItem('ptr-ok');sessionStorage.removeItem('ptr-ok');}catch(e){}
    if(ok){
      var parts=ok.split(':'),off=parts[0]==='off'||!navigator.onLine,t0=+parts[1]||Date.now();
      // (roue déjà lancée au premier affichage par le petit script sous la barre du mois)
      tit.style.transition='none';tit.style.opacity=0;spin.style.transition='none';spin.style.opacity=1;spin.style.transform='scale(1)';if(!ind.classList.contains('load'))startSpin(t0);
      var faded=false;
      // l'écran de chargement s'estompe : la roue s'arrête et disparaît en même temps
      window._ptrFade=function(){window._ptrFade=null;faded=true;stopAtTop(t0);};
      // écran parti : « Actualisé » (ou « Hors ligne »), puis le nom du mois revient
      window._ptrDone=function(){window._ptrDone=null;
        var show=function(){ind.classList.remove('load');
          if(!off){tit.style.transition='';tit.style.opacity='';return;} // actualisé : le nom du mois revient directement
          msg.textContent='Hors ligne';msg.style.opacity='';msg.classList.add('on');
          later(function(){msg.classList.remove('on');later(function(){tit.style.transition='';tit.style.opacity='';},250);},1400);};
        if(!faded){faded=true;stopAtTop(t0);}
        later(show,Math.max(0,stopEnd-Date.now())+80);};
      setTimeout(function(){if(window._ptrFade)window._ptrFade();if(window._ptrDone)window._ptrDone();},4000); // filet de sécurité si l'app tarde
    }
  })();
  // Auth check
  const authToken=localStorage.getItem('auth_token');
  let authUser=null;try{authUser=JSON.parse(localStorage.getItem('auth_user')||'null');}catch(e){}
  if(!authToken||!authUser){window.location.replace(BASE);return;}
  window._authToken=authToken;
  window._authUser=authUser;
  // Show user name in header if needed
  // reports automatiques après la lecture du cloud (avant, ils dataient les données locales et les faisaient passer pour plus récentes)
  loadState();applyTheme();
  // inscription pas terminée, connue sur l'appareil : la suite s'affiche tout de suite, sans écran de chargement
  if(S&&S.profile&&S.profile.setupPending){_suOpen();var _bt=document.getElementById('boot');if(_bt)_bt.remove();}
  // Load global pay config (convention collective)
  fetch(CLOUD_API+'/get-pay-config',{method:'POST',headers:cloudHeaders(),body:'{}'})
    .then(function(r){return r.json();})
    .then(function(d){if(d&&d.config)window._globalPayConfig=d.config;})
    .catch(function(){});
  // Load cycle override from server if available
  fetch(CLOUD_API+'/get-cycle',{method:'POST',headers:cloudHeaders(),body:'{"pools":1}'})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d&&d.currentOverride&&d.currentOverride.weeks&&d.currentOverride.weeks.length>0){
        // Override the hardcoded CYCLE with the admin version
        d.currentOverride.weeks.forEach(function(week,i){CYCLE[i]=week;});
        render();
      }
    }).catch(function(){});// Fail silently
  // Load global vacations and cycles from KV
  Promise.all([
    fetch(CLOUD_API+'/get-vacations',{method:'POST',headers:cloudHeaders(),body:'{}'}).then(function(r){return r.json();}),
    fetch(CLOUD_API+'/get-cycle',{method:'POST',headers:cloudHeaders(),body:'{"pools":1}'}).then(function(r){return r.json();})
  ]).then(function(results){
    const vd=results[0],cd=results[1];
    if(vd&&vd.vacations){_globalVacs=vd.vacations;Object.keys(_globalVacs).forEach(function(k){if(VAC_STD[k]&&_globalVacs[k].deb&&_globalVacs[k].deb!==VAC_STD[k].deb)console.warn('Cloud vac override:',k,'deb',_globalVacs[k].deb,'(std:',VAC_STD[k].deb+')');});}
    if(cd&&cd.cycles)_globalCycles=cd.cycles;
    render();
    if(gcalTokens)gcalSync();
  }).catch(function(){});
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  var _pwaOff=false;try{_pwaOff=localStorage.getItem('pl_pwa_off')==='1';}catch(e){}
  if(isIOS&&!window.navigator.standalone&&!_pwaOff)document.getElementById('pwa-banner').style.display='flex'; // fermée avec la croix : ne revient plus
  updateUrBtns();
  // Load from cloud FIRST, then render (KV is source of truth)
  cloudLoadAll().then(function(){
    applyTheme();
    autoReportEph();
    render();
    setTimeout(pushSyncAlerts,3000);
    _lineSoon();
    setTimeout(_verCheck,1500);
    const hpn=document.getElementById('hdr-profile-name');
    if(hpn&&S&&S.profile)hpn.textContent=S.profile.name||'Profil';
    // inscription pas terminée (présentation, ligne et heures, paie) : on y revient, avant tout le reste ; terminée ailleurs : on la ferme
    if(S&&S.profile&&S.profile.setupPending)_suOpen();
    else if(document.getElementById('setup')){document.getElementById('setup').remove();SU=null;document.body.classList.remove('su-on');}
    _revealBody();
    // imports de l'inscription d'abord (le bulletin remplit palier, ancienneté, contrat, groupe) ; saisie à la main seulement sans import
    if(!(S&&S.profile&&S.profile.setupPending))setTimeout(function(){if(_bulImportPromptIfNeeded())return;if(_rhImportPromptIfNeeded())return;showPayPromptIfNeeded();},700);
    // Pousse au chargement les modifs locales qui n'auraient pas encore été synchronisées (pas celles d'un compte inconnu)
    if(S&&S.profile&&window._authToken&&!window._plLegacy)cloudSave(_aid);
  }).catch(function(){
    try{autoReportEph();render();}catch(e){}
    if(S&&S.profile&&S.profile.setupPending)_suOpen();
    _revealBody();
  });
  // Scroll to navigate months/years

  // Sticky header: show on scroll up
  let _lastScrollY=0;
  

  // Appui long sur un jour : menu rapide (rendu, congé, échange)
  let _lpT=null,_lpX=0,_lpY=0,_lpFired=false;
  window._lpCancel=function(){if(_lpT){clearTimeout(_lpT);_lpT=null;}};
  document.addEventListener('touchstart',function(e){
    _lpFired=false;window._lpCancel();
    if(e.touches.length>1||annualOpen||document.querySelector('#modal-root .overlay')||document.getElementById('lp-menu'))return;
    const c=e.target.closest('#cal .dci[data-key]');if(!c)return;
    _lpX=e.touches[0].clientX;_lpY=e.touches[0].clientY;
    _lpT=setTimeout(function(){_lpT=null;if(_openDayMenu(c)){_lpFired=true;}},300);
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(_lpT&&(Math.abs(e.touches[0].clientX-_lpX)>8||Math.abs(e.touches[0].clientY-_lpY)>8))window._lpCancel();
  },{passive:true});
  document.addEventListener('touchend',function(){window._lpCancel();},{passive:true});
  document.addEventListener('touchcancel',function(){window._lpCancel();},{passive:true});
  // Le clic qui suit l'appui long ne doit pas ouvrir la fiche du jour
  document.addEventListener('click',function(e){if(_lpFired){_lpFired=false;e.stopPropagation();e.preventDefault();}},true);
  document.addEventListener('contextmenu',function(e){if(e.target.closest('#cal .dci'))e.preventDefault();});

  // Swipe gauche/droite : le mois suit le doigt et le mois voisin arrive à côté
  let _swipeStartX=0,_swipeStartY=0,_swipeT=0,_swipeActive=false,_swipeDrag=false,_swipeLock=null,_swPeek={},_swSamples=[],_swCaught=false,_swEatClick=false;
  // Écart entre deux mois = 2 × la marge entre le bord de l'écran et le calendrier
  function _swW(mv){const l=mv.getBoundingClientRect().left;return mv.offsetWidth+Math.max(16,2*Math.round(l));}
  // On déplace les .cal-wrap eux-mêmes (pas leur parent) : un parent transformé couperait l'effet verre
  function _swMv(){return document.getElementById('month-view');}
  // PC : le calendrier n'est pas rendu invisible sous le mois arrivé (Chrome réaffichait alors un instant l'ancien mois
  // en le rendant de nouveau visible) ; la page arrivée, opaque, le couvre de toute façon
  function _pgDesk(){return window.matchMedia&&matchMedia('(min-width:721px)').matches&&!/iPhone|iPad|Android/.test(navigator.userAgent);}
  function _swWrap(){return document.querySelector('#month-view > .cal-wrap');}
  // Aperçu du mois précédent (d=-1) ou suivant (d=1), posé exactement sur le calendrier puis décalé
  // Calendrier d'un mois donné, posé exactement sur le calendrier affiché (puis décalé par translateX)
  function _swBuildPeek(y,m){
    const mv=_swMv(),el=document.createElement('div');
    el.className='mv-peek';el.setAttribute('aria-hidden','true');
    el.style.cssText='position:absolute;left:0;top:0;width:100%;pointer-events:none'+(window._pgHide?';visibility:hidden':'');
    el.innerHTML='<div class="cal-wrap"><table class="cal"><tr></tr></table><table class="cal"></table></div>';
    mv.appendChild(el);
    const sy=curY,sm=curM,t=el.querySelectorAll('table');
    try{curY=y;curM=m;renderMonth(t[0].querySelector('tr'),t[1]);}
    finally{curY=sy;curM=sm;}
    try{_renderCycBadges(t[1]);}catch(e){}
    _syncWknNow(el); // numéros et tuiles de semaines (ramenées, congés) comme sur le calendrier
    return el;
  }
  // Flèches et bouton « auj. » : même glissement que le geste, vers n'importe quel mois
  let _slideBusy=false;
  window._calSlideTo=function(y,m,d){
    _pgFlush();_flushAnim();try{_pgUnlinger();}catch(e){}
    const mv=_swMv(),wrap=_swWrap();
    if(!mv||!wrap){curY=y;curM=m;render();return;}
    _slideBusy=true;_swClearPeek();_titleTo(ML[m]+' '+y,d);
    const W=_swW(mv),pk=_swBuildPeek(y,m),w2=pk.firstChild;_swPeek.go=pk;
    w2.style.transition='none';w2.style.transform='translateX('+(d*W)+'px)';
    void w2.offsetWidth;
    const tr='transform .34s cubic-bezier(.25,.8,.25,1)';
    wrap.style.transition=tr;wrap.style.transform='translateX('+(-d*W)+'px)';
    w2.style.transition=tr;w2.style.transform='translateX(0px)';
    _pendingFinish=function(){
      _pendingFinish=null;clearTimeout(_slideT);
      _calNavDir=d;window._titleDir=d;curY=y;curM=m;
      wrap.style.transition='none';wrap.style.transform='';
      // Le mois arrivé (aperçu) reste par-dessus le temps que le calendrier soit repeint (iPhone)
      const keep=_swPeek;_swPeek={};
      render();_syncWknNow();
      const w3=_swWrap()||wrap;if(!_pgDesk())w3.style.opacity='0.001';
      requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(function(){w3.style.opacity='';Object.keys(keep).forEach(function(k){keep[k].remove();});},220);});});
      _slideBusy=false;
    };
    _slideT=setTimeout(_pendingFinish,350);
  };
  // Une nouvelle navigation pendant une animation : on termine celle-ci aussitôt, puis on enchaîne
  let _pendingFinish=null,_slideT=0;
  function _flushAnim(){
    if(!_pendingFinish)return;
    const f=_pendingFinish;
    cancelAnimationFrame(_springRaf);_springRaf=0;clearTimeout(_slideT);
    f();
  }
  window._flushAnim=_flushAnim;
  function _swClearPeek(){Object.keys(_swPeek).forEach(function(k){_swPeek[k].remove();});_swPeek={};}
  function _annGrid(){return document.getElementById('ann-grid');}
  function _annW(){const g=_annGrid();return g.offsetWidth+Math.max(16,2*Math.round(g.getBoundingClientRect().left));}
  function _annSetX(el,x,tr){Array.prototype.forEach.call(el.children,function(c){c.style.transition=tr;c.style.transform=x===null?'':'translateX('+x.toFixed(1)+'px)';});}
  function _annBuild(y){
    const g=_annGrid(),el=document.createElement('div');
    el.className='annual-grid ann-peek';el.setAttribute('aria-hidden','true');
    el.style.cssText='position:absolute;pointer-events:none;margin:0;top:'+g.offsetTop+'px;left:'+g.offsetLeft+'px;width:'+g.offsetWidth+'px';
    // même grille compacte que la vue annuelle affichée (4 colonnes × 3 rangées sur téléphone)
    if(g.style.gridTemplateColumns){el.style.gridTemplateColumns=g.style.gridTemplateColumns;el.style.gridTemplateRows=g.style.gridTemplateRows;el.style.height=g.style.height;}
    el.innerHTML=_annHtml(y);
    g.parentNode.appendChild(el);return el;
  }
  // Ressort physique pour le retour en place d'un geste annulé : repart de la vitesse du doigt,
  // revient en douceur avec un très léger dépassement (amortissement 0,78), comme sur iOS
  let _springRaf=0;
  // to : position d'arrivée ; z : amortissement (0,78 = léger rebond pour un retour, 1 = arrivée nette pour un changement)
  function _spring(x0,v0,onFrame,onDone,to,z,w){
    cancelAnimationFrame(_springRaf);
    to=to||0;z=z||0.78;w=w||0.0165;const k=w*w,c=2*z*w; // pulsation (rad/ms) et amortissement
    let x=x0-to,v=Math.max(-3,Math.min(3,v0||0)),t=performance.now();
    const step=function(now){
      let dt=Math.min(32,now-t);t=now;
      for(let i=0;i<dt;i+=4){const h=Math.min(4,dt-i);const a=-k*x-c*v;v+=a*h;x+=v*h;} // intégration par petits pas
      // On s'arrête dès que c'est visuellement en place (moins de 1,5 px et quasi immobile)
      if(Math.abs(x)<1.5&&Math.abs(v)<0.06){onFrame(to);_springRaf=0;onDone();return;}
      onFrame(x+to);_springRaf=requestAnimationFrame(step);
    };
    _springRaf=requestAnimationFrame(step);
  }
  // ================================================================
  // BANDE CONTINUE DE MOIS / D'ANNÉES (comme Google Agenda, Calendrier iOS)
  // Les mois sont posés côte à côte sur une bande que le doigt déplace librement.
  // Toucher l'écran pendant une animation « rattrape » la bande là où elle est.
  // Le mois affiché n'est validé (rendu complet, sider…) qu'une fois la bande arrêtée :
  // on enchaîne donc les coups secs sans jamais attendre.
  // ================================================================
  const PG={on:false,mode:'m',base:0,x:0,x0:0,pages:{},titleK:0,target:0,startK:0,W:0};
  function _pgW(){if(PG.on&&PG.W)return PG.W;return PG.mode==='y'?_annW():_swW(_swMv());} // largeur mise en cache pendant le mouvement
  // Mois voisins préparés à l'avance (au repos), pour que le glissement démarre sans à-coup
  let _pgPre={base:null,mode:null,pages:{}},_pgPreT=0,_pgRenderT=0;
  function _pgDropPre(){Object.keys(_pgPre.pages).forEach(function(k){_pgPre.pages[k].remove();});_pgPre={base:null,mode:null,pages:{}};}
  function _pgPrebuild(){
    clearTimeout(_pgPreT);
    _pgPreT=setTimeout(function(){
      if(PG.on||document.querySelector('#modal-root .overlay'))return;
      const mode=annualOpen?'y':'m',base=mode==='y'?curY:curY*12+curM;
      if(_pgPre.base===base&&_pgPre.mode===mode)return;
      _pgDropPre();
      if(mode==='m'&&!_swWrap())return;
      const sv=PG.mode,sb=PG.base;PG.mode=mode;PG.base=base;
      window._pgHide=1;try{[-1,1].forEach(function(k){const el=_pgBuild(k);el.style.visibility='hidden';_pgPre.pages[k]=el;});}finally{window._pgHide=0;}
      PG.mode=sv;PG.base=sb;_pgPre.base=base;_pgPre.mode=mode;
    },400);
  }
  window._pgPrebuild=_pgPrebuild;window._pgDropPre=_pgDropPre;
  function _pgTitle(k){if(PG.mode==='y')return String(PG.base+k);const ym=PG.base+k;return ML[ym%12]+' '+Math.floor(ym/12);}
  function _pgSetMain(x){
    if(PG.mode==='y'){_annSetX(_annGrid(),x,'none');return;}
    const w=_swWrap();if(w){w.style.transition='none';w.style.transform=x?'translateX('+x.toFixed(1)+'px) scale('+_pgDepth(x)+')':'';}
  }
  // Profondeur : le mois qui s'éloigne du centre rétrécit un peu (−6 % à une page de distance)
  function _pgDepth(x){var W=_pgW()||1;return (1-0.06*Math.min(1,Math.abs(x)/W)).toFixed(4);}
  function _pgSetPage(el,x){
    if(PG.mode==='y'){_annSetX(el,x,'none');return;}
    const w=el.firstChild;w.style.transition='none';w.style.transform='translateX('+x.toFixed(1)+'px) scale('+_pgDepth(x)+')';
  }
  function _pgBuild(k){
    if(PG.mode==='y')return _annBuild(PG.base+k);
    const ym=PG.base+k;return _swBuildPeek(Math.floor(ym/12),ym%12);
  }
  // Page voisine gardée un instant par-dessus le calendrier après un changement de mois (voir _pgEnd)
  let _pgLinger=null;
  function _pgUnlinger(){if(!_pgLinger)return;const L=_pgLinger;_pgLinger=null;L.w.style.opacity='';Object.keys(L.pages).forEach(function(k){L.pages[k].remove();});}
  function _pgBegin(mode){
    clearTimeout(_pgPreT);_pgUnlinger();
    PG.mode=mode;PG.base=mode==='y'?curY:curY*12+curM;PG.on=false;PG.W=_pgW();PG.on=true;
    PG.x=0;PG.pages={};PG.titleK=0;PG.target=0;PG.startK=0;
    // Reprend les voisins préparés à l'avance s'ils correspondent
    if(_pgPre.base===PG.base&&_pgPre.mode===mode){PG.pages=_pgPre.pages;_pgPre={base:null,mode:null,pages:{}};}else _pgDropPre();
    (mode==='y'?document.getElementById('ann-wrap'):_swMv()).classList.add('pg-on');
    window._lpCancel&&window._lpCancel();
    if(mode==='m'){_swClearPeek();const mv=_swMv();if(mv)mv.classList.remove('slide-left','slide-right','slide-in-left','slide-in-right');}
  }
  // Place la bande : mois affiché + voisins visibles (créés à la demande)
  function _pgLayout(){
    const W=_pgW(),c=-PG.x/W,lo=Math.floor(c)-1,hi=Math.ceil(c)+1;
    _pgSetMain(PG.x);
    for(let k=lo;k<=hi;k++){
      if(k===0)continue;
      if(!PG.pages[k])PG.pages[k]=_pgBuild(k);
      _pgSetPage(PG.pages[k],PG.x+k*W);PG.pages[k].style.visibility='';
    }
    Object.keys(PG.pages).forEach(function(kk){const k=+kk;if(k<lo||k>hi)PG.pages[k].style.visibility='hidden';});
    const near=Math.round(c);
    if(near!==PG.titleK){_titleTo(_pgTitle(near),near>PG.titleK?1:-1);PG.titleK=near;}
  }
  // La bande s'est arrêtée : on valide le mois / l'année atteint (un seul rendu complet)
  function _pgEnd(){
    const k=PG.target,_pages=PG.pages;
    PG.on=false;PG.x=0;
    const _dropPages=function(){Object.keys(_pages).forEach(function(kk){_pages[kk].remove();});};
    if(PG.mode==='y'){
      _dropPages();PG.pages={};
      document.getElementById('ann-wrap').classList.remove('pg-on');
      _annSetX(_annGrid(),null,'');
      if(k){window._titleDir=k>0?1:-1;curY=PG.base+k;renderAnnual();_setTitle(document.getElementById('mtit'),String(curY));}
      _pgPrebuild();
      return;
    }
    const w=_swWrap();
    (document.getElementById('month-view')||{classList:{remove:function(){}}}).classList.remove('pg-on');
    if(w){w.style.transition='';w.style.transform='';}
    if(k){
      const ym=PG.base+k;_calNavDir=k>0?1:-1;window._titleDir=_calNavDir;
      curY=Math.floor(ym/12);curM=ym%12;if(ym===TODAY_YM)_todayBtnHide();
      // Affichage immédiat : le calendrier du mois atteint est déjà dessiné dans la page voisine,
      // on reprend son contenu ; la mise à jour complète (sider, label…) suit juste après.
      const pk=_pages[k]&&_pages[k].firstChild;
      let _swapped=false;
      if(pk&&w){const h=document.getElementById('heads'),c=document.getElementById('cal'),t=pk.querySelectorAll('table');
        if(h&&c&&t.length===2){
          h.innerHTML=t[0].querySelector('tr').innerHTML;c.innerHTML=t[1].innerHTML;
          // bandeaux de début de cycle (« Saison… ») : ceux du mois atteint remplacent ceux de l'ancien mois
          w.querySelectorAll('.cyc-badge').forEach(function(b){b.remove();});
          pk.querySelectorAll('.cyc-badge').forEach(function(b){w.appendChild(b.cloneNode(true));});
          _swapped=true;
        }}
      // iPhone : le calendrier qui vient de recevoir le nouveau mois se repeint par morceaux, et l'ancien mois
      // apparaissait par endroits. La page voisine (déjà à sa place, identique) reste par-dessus le temps que
      // le calendrier soit repeint, puis elle est retirée.
      if(_swapped){_pgUnlinger();if(!_pgDesk())w.style.opacity='0.001';_pgLinger={pages:_pages,w:w};}
      // Sider, label et compteurs mis à jour dès l'image suivante, sans redessiner le calendrier une seconde fois
      clearTimeout(_pgRenderT);cancelAnimationFrame(_pgRenderT);
      _pgRenderT=requestAnimationFrame(function _r(){
        if(PG.on){_pgRenderT=setTimeout(function(){requestAnimationFrame(_r);},120);return;}
        window._skipCalOnce=_swapped;render();window._skipCalOnce=false;_syncWknNow();
        if(_pgLinger){var L=_pgLinger;
          requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(function(){if(_pgLinger===L)_pgUnlinger();},220);});});}
      });
      PG.pages={};if(!_swapped)_dropPages();
      return;
    }else _pgPrebuild();
    _dropPages();PG.pages={};
  }
  // Fait glisser la bande jusqu'à la page k ; léger rebond si on revient sur la page de départ
  function _pgGo(k,v0){
    PG.target=k;const W=_pgW(),back=(k===PG.startK);
    _spring(PG.x,v0||0,function(x){PG.x=x;_pgLayout();},_pgEnd,-k*W,back?0.78:1,back?0.0185:0.026); // ≈0,3 s pour se poser, comme le Calendrier d'iOS
  }
  // Termine immédiatement (avant un autre type de navigation)
  function _pgFlush(){
    if(!PG.on)return;
    cancelAnimationFrame(_springRaf);_springRaf=0;
    PG.x=-PG.target*_pgW();_pgEnd();
  }
  window._pgFlush=_pgFlush;
  // Flèches : chaque appui ajoute une page à la cible, même pendant que la bande bouge
  window._pgStep=function(mode,d){
    _flushAnim();
    if(PG.on&&PG.mode!==mode)_pgFlush();
    if(!PG.on)_pgBegin(mode);
    PG.startK=PG.target;
    _pgGo(PG.target+d,0);
  };
  // Un appui qui a seulement « rattrapé » la bande ne doit pas ouvrir la fiche du jour
  document.addEventListener('click',function(e){if(_swEatClick){_swEatClick=false;e.stopPropagation();e.preventDefault();}},true);

  document.addEventListener('touchstart',function(e){
    if(e.target.closest('.sheet')||e.target.closest('.dropdown'))return; // ignore modals/dropdowns
    if(e.touches.length>1){_swipeActive=false;return;}
    _swipeStartX=e.touches[0].clientX;
    _swipeStartY=e.touches[0].clientY;
    // Horodatage réel du toucher (e.timeStamp) : insensible aux ralentissements du téléphone pendant un rendu
    _swipeT=e.timeStamp||performance.now();_swipeActive=true;_swipeDrag=false;_swipeLock=null;_swSamples=[[_swipeT,_swipeStartX]];
    // Bande en mouvement : on la rattrape là où elle est
    _swCaught=false;_swEatClick=false;
    if(PG.on&&_springRaf){cancelAnimationFrame(_springRaf);_springRaf=0;_swCaught=true;_swEatClick=true;window._lpCancel&&window._lpCancel();}
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!_swipeActive)return;
    const dx=e.touches[0].clientX-_swipeStartX,dy=e.touches[0].clientY-_swipeStartY;
    // Derniers points du geste, pour connaître la vitesse au moment où le doigt se lève
    const _now=e.timeStamp||performance.now();_swSamples.push([_now,e.touches[0].clientX]);while(_swSamples.length>2&&_now-_swSamples[1][0]>100)_swSamples.shift();
    if(!_swipeLock&&(Math.abs(dx)>10||Math.abs(dy)>10))_swipeLock=Math.abs(dx)>Math.abs(dy)*1.5?'h':'v';
    if(_swipeLock!=='h')return;
    e.preventDefault();
    if(document.querySelector('#modal-root .overlay')||document.getElementById('lp-menu'))return;
    const mode=annualOpen?'y':'m';
    if(mode==='m'&&!_swMv())return;
    if(!_swipeDrag){
      _flushAnim();
      if(PG.on&&PG.mode!==mode)_pgFlush();
      if(!PG.on)_pgBegin(mode);
      // Page de référence : celle vers laquelle la bande allait si on l'a rattrapée, sinon la plus proche
      _swipeDrag=true;PG.x0=PG.x-dx;PG.startK=_swCaught?PG.target:Math.round(-PG.x/_pgW());
    }
    PG.x=PG.x0+dx;_pgLayout();
  },{passive:false});
  function _swEnd(e,cancel){
    if(!_swipeActive)return;
    _swipeActive=false;
    if(!_swipeDrag){
      // Simple appui (ou défilement vertical) pendant que la bande bougeait : elle repart vers sa page
      if(_swCaught&&PG.on)_pgGo(PG.target,0);
      return;
    }
    _swipeDrag=false;
    // Vitesse au moment où le doigt se lève (pas la moyenne du geste), comme sur iOS
    const _tEnd=e.timeStamp||performance.now();
    const _last=_swSamples[_swSamples.length-1],_first=_swSamples[0],_dt=Math.max(1,_tEnd-_first[0]);
    const vRel=(_tEnd-_last[0]>80)?0:(e.changedTouches[0].clientX-_first[1])/_dt; // px/ms
    const W=_pgW(),c=-PG.x/W;
    let k;
    if(cancel)k=PG.startK;
    // coup sec : page suivante dans le sens du geste, au-delà de celle que la bande visait déjà
    else if(Math.abs(vRel)>0.3)k=vRel<0?Math.max(Math.floor(c+1e-6)+1,PG.startK+1):Math.min(Math.ceil(c-1e-6)-1,PG.startK-1);
    else k=Math.round(c); // geste lent : la page la plus proche (au-delà de la moitié)
    _pgGo(k,vRel);
  }
  document.addEventListener('touchend',function(e){_swEnd(e,false);},{passive:true});
  document.addEventListener('touchcancel',function(e){_swEnd(e,true);},{passive:true});
}
init();

// ============================================================
// GOOGLE CALENDAR SYNC
// ============================================================




function gcalHandleClick(){
  if(!gcalTokens){gcalConnect();return;}
  if(window._gcalErr){
    // Sur mobile l'info-bulle n'apparaît pas : afficher la cause de l'échec
    if(window._gcalReconnect){_ask('Synchro Google Agenda impossible\n\nL’autorisation Google a expiré ('+window._gcalErr+').',{ok:'Reconnecter'}).then(function(ok){if(ok)gcalConnect();});return;}
    _ask('Dernière synchro Google Agenda en échec\n\n'+window._gcalErr,{ok:'Reconnecter',cancel:'Réessayer'}).then(function(ok){if(ok)gcalConnect();else gcalSync();});return;
  }
  gcalSync();
}

function gcalSetAutoSync(enabled){
  if(S.profile)S.profile.gcalAutoSync=enabled;
  saveState();
  gcalUpdateBtn();
}
function gcalToggleAutoSync(){
  const cur=S.profile&&S.profile.gcalAutoSync!==false;
  gcalSetAutoSync(!cur);
  if(cur===false&&gcalTokens)gcalSync();
}
function setGcalColor(key,cid,el){
  if(!S.profile)return;
  if(!S.profile.gcalColors)S.profile.gcalColors={};
  S.profile.gcalColors[key]=cid;
  saveState();
  var row=el.parentElement;
  if(row){row.querySelectorAll('span[data-cid]').forEach(function(s){
    var sel=s.dataset.cid===cid;
    s.style.border=sel?'2px solid var(--text)':'2px solid transparent';
    s.innerHTML=sel?'<span style="width:6px;height:6px;border-radius:50%;background:#fff"></span>':'';
  });}
  gcalTrigger();
}

function openGcalColorsModal(){
  var _gcColors=[{id:'1',hex:'#7986cb',n:'Lavande'},{id:'2',hex:'#33b679',n:'Sauge'},{id:'3',hex:'#8e24aa',n:'Raisin'},{id:'4',hex:'#e67c73',n:'Flamant'},{id:'5',hex:'#f6bf26',n:'Banane'},{id:'6',hex:'#f4511e',n:'Mandarine'},{id:'7',hex:'#039be5',n:'Paon'},{id:'8',hex:'#616161',n:'Graphite'},{id:'9',hex:'#3f51b5',n:'Myrtille'},{id:'10',hex:'#0b8043',n:'Basilic'},{id:'11',hex:'#d50000',n:'Tomate'}];
  var _gcTypes=[{key:'gcNormal',label:'Normal',def:'7'},{key:'gcModifie',label:'Modifié',def:'11'},{key:'gcRendu',label:'Rendu',def:'2'},{key:'gcConge',label:'Congé',def:'10'}];
  var _gcCfg=(S.profile&&S.profile.gcalColors)||{};
  var html=_gcTypes.map(function(t){
    var cur=_gcCfg[t.key]||t.def;
    var dots=_gcColors.map(function(c){
      var sel=c.id===cur;
      return '<span data-cid="'+c.id+'" onclick="setGcalColor(\''+t.key+'\',\''+c.id+'\',this)" style="width:22px;height:22px;border-radius:50%;background:'+c.hex+';cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;border:'+(sel?'2.5px solid var(--text)':'2px solid transparent')+';transition:border .15s" title="'+c.n+'">'+(sel?'<span style="width:6px;height:6px;border-radius:50%;background:#fff"></span>':'')+'</span>';
    }).join('');
    return '<div style="margin-bottom:14px"><div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">'+t.label+'</div><div style="display:flex;gap:6px;flex-wrap:wrap">'+dots+'</div></div>';
  }).join('');
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Couleurs Google Agenda</div>'+html+'<button class="mcancel mclose" onclick="closeModal();setTimeout(function(){openSettingsModal(0);},80)">Fermer</button></div></div>';
}

// ============================================================
// CLOUD SYNC
// ============================================================
// Appels au serveur : version de l'app jointe ; « mise à jour nécessaire » (426) → rechargement sur la dernière version
(function(){var f=window.fetch;if(!f)return;window.fetch=function(u,o){
  if(typeof u==='string'&&u.indexOf(CLOUD_API)===0)u+=(u.indexOf('?')<0?'?':'&')+'av='+encodeURIComponent(_appVer);
  return f.call(this,u,o).then(function(r){if(r&&r.status===426&&typeof u==='string'&&u.indexOf(CLOUD_API)===0)_forceUpdate();return r;});};})();
function _forceUpdate(){var k='pl_force_rl';try{var t=+sessionStorage.getItem(k)||0;if(Date.now()-t<120000){_infoToast('Mise à jour nécessaire : fermer et rouvrir l’app');return;}sessionStorage.setItem(k,String(Date.now()));}catch(e){}
  setTimeout(function(){location.reload();},300);}






async function pushToggle(cb){
  var on=cb.checked;
  try{
    if(on){
      if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
        var ios=/iPhone|iPad|iPod/.test(navigator.userAgent),standalone=navigator.standalone||window.matchMedia('(display-mode:standalone)').matches;
        throw new Error(ios&&!standalone?'Sur iPhone, ajoute d’abord l’app à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis active les rappels depuis l’app.':'Ce navigateur ne gère pas les notifications.');
      }
      var perm=await Notification.requestPermission();
      if(perm!=='granted')throw new Error('Notifications refusées. Autorise-les dans les réglages du téléphone pour Planning.');
      var reg=await navigator.serviceWorker.ready;
      var kr=await fetch(CLOUD_API+'/push/key');var key=(await kr.json()).key;
      var raw=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((key.length+3)%4)),u8=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)u8[i]=raw.charCodeAt(i);
      var sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8});
      var al=_pushAlerts();
      await _pushPost('/push/subscribe',{sub:sub.toJSON(),alerts:al});
      localStorage.setItem('pl_push_on','1');localStorage.setItem('pl_push_sig_'+_aid,JSON.stringify(al));
    }else{
      localStorage.removeItem('pl_push_on');
      var reg2=await navigator.serviceWorker.ready,sub2=await reg2.pushManager.getSubscription();
      if(sub2){await _pushPost('/push/unsubscribe',{sub:sub2.toJSON()}).catch(function(){});await sub2.unsubscribe();}
    }
    openSettingsModal(0);
  }catch(e){cb.checked=!on;showBlockAlert('Notifications',e.message||String(e));}
}
async function pushTest(btn){
  btn.disabled=true;btn.textContent='…';
  try{var r=await _pushPost('/push/test');btn.textContent=r.ok?'Envoyée':'Échec';}
  catch(e){btn.textContent='Échec';}
  setTimeout(function(){btn.disabled=false;btn.textContent='Tester';},2500);
}

// Indicateur discret de synchro : pending (en attente), ok, error (cliquable pour réessayer)
function setSyncStatus(st){
  var el=document.getElementById('sync-status');if(!el)return;
  window._syncStatus=st;
  var cfg={pending:['ti-cloud-upload','var(--text3)','Synchronisation en attente…'],ok:['ti-cloud-check','var(--text3)','Synchronisé'],error:['ti-cloud-off','var(--amber)','Échec de synchronisation'+(window._syncErr?' ('+window._syncErr+')':'')+' — les modifications sont gardées sur cet appareil. Nouvel essai automatique toutes les 10 min. Toucher pour réessayer maintenant.']}[st];
  if(!cfg){el.style.display='none';return;}
  el.innerHTML='<i class="ti '+cfg[0]+'"></i>';el.style.color=cfg[1];el.title=cfg[2];el.style.display='inline-flex';
  // iPhone : visible tout de suite en cas d'échec, après 4 s si l'envoi traîne ; rien quand tout va bien
  clearTimeout(window._syShowT);document.body.classList.toggle('sy-show',st==='error');
  if(st==='pending')window._syShowT=setTimeout(function(){document.body.classList.toggle('sy-show',window._syncStatus==='pending'||window._syncStatus==='error');},4000);
}

function _gcalLine(){if(!gcalTokens)return['var(--text2)','Connecter Google Agenda',0];
  var w=document.getElementById('gcal-status-wrap'),c=function(k){return w&&w.classList.contains(k);},t=window._gcalLastOk?new Date(window._gcalLastOk).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
  var x=window._gcalErr?['var(--amber)','Échec, toucher pour réessayer']:c('gcal-syncing')?['var(--blue)','Synchro…']:c('gcal-pending')?['var(--text2)','En attente…']
    :S.profile&&S.profile.gcalAutoSync===false?['var(--text2)','Synchro auto coupée']:['var(--green)',t?'Synchronisé à '+t:'Synchronisé'];
  return [x[0],'<span class="hm-2l">Google Agenda<small style="color:'+(window._gcalErr?'var(--amber)':'')+'">'+x[1]+'</small></span>',!window._gcalErr&&(c('gcal-syncing')||c('gcal-pending'))];}


async function _sessionExpired(){
  if(await _silentRelogin()){if(_aid)cloudSave(_aid);return;}
  window._syncErr='session expirée';window._sessionIsExpired=true;setSyncStatus('error');
  var el=document.getElementById('sync-status');if(el)el.title='Session expirée — les modifications sont gardées sur cet appareil. Toucher pour se reconnecter : elles seront envoyées ensuite.';
  if(!window._sessionExpiredAsked){window._sessionExpiredAsked=true;setTimeout(_relogin,300);}
}
async function _relogin(){
  if(!await _ask('Session expirée\n\nLes modifications ne sont plus synchronisées. Celles faites sur cet appareil sont conservées.',{ok:'Se reconnecter',cancel:'Plus tard'}))return;
  try{localStorage.setItem('pl_v8',JSON.stringify({p:_profs,a:_aid,u:_plU()}));}catch(e){}
  localStorage.removeItem('auth_token');localStorage.removeItem('auth_user');
  window.location.href=BASE;
}
async function syncStatusClick(){
  if(window._sessionIsExpired){_relogin();return;}
  if(window._syncStatus==='error'){if(_aid)cloudSave(_aid);return;}
  // Synchronisé : vérifier réellement la session (simple lecture) avant de l'affirmer
  try{
    var r=await fetch(CLOUD_API+'/data/list',{method:'POST',headers:cloudHeaders(),body:'{}'});
    if(r.status===401){await _sessionExpired();return;}
  }catch(e){}
  var t=window._lastSyncOk?new Date(window._lastSyncOk).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
  _infoToast(window._syncStatus==='pending'?'Envoi en cours…':'Planning enregistré en ligne ✓'+(t?' (dernier envoi à '+t+')':''));
}


// Retour du réseau : on renvoie tout de suite ce qui n'a pas pu être synchronisé
window.addEventListener('offline',function(){if(window._syncStatus==='pending')setSyncStatus('pending');});
window.addEventListener('online',function(){if(window._syncErr&&window._authToken){clearTimeout(window._syncRetryTimer);cloudSave(_aid);}});
function _cloudSaveFailed(pid,msg){
  window._syncErr=msg;setSyncStatus('error');
  clearTimeout(window._syncRetryTimer);
  window._syncRetryTimer=setTimeout(function(){cloudSave(pid);},600000);
}
// Nouvelle version publiée : l'app s'ouvre sur la copie gardée (pas d'écran blanc au lancement), puis se recharge
// une fois sur la nouvelle, que le service worker vient de mettre de côté (une seule fois par version : jamais de boucle)
// Appelée au lancement (avant tout modal) et au retour au premier plan ; renvoie true si l'app se recharge
function _verCheck(){
  window._verAt=Date.now();
  return fetch(location.href,{cache:'no-store',headers:{'Cache-Control':'no-cache, no-store','Pragma':'no-cache'}})
    .then(function(r){return r.text();})
    .then(function(html){
      // nouvelle version : numéro différent, ou même numéro mais code différent (empreinte posée à la publication)
      var m=html.match(/name="app-version" content="([^"]+)"/),mb=html.match(/name="app-build" content="([^"]+)"/),_b0=(document.querySelector('meta[name="app-build"]')||{}).content||'';
      if(m&&mb&&mb[1]!=='dev'&&_b0&&_b0!=='dev'&&mb[1]!==_b0&&m[1]===_appVer)m=[m[0],m[1]+' ('+mb[1].slice(0,6)+')'];
      if(!m||m[1]===_appVer||_syncAbort)return false;
      // inscription : rechargée tant qu'il n'y a rien à perdre (début), sinon un lien le propose
      if(document.getElementById('setup')&&SU)_suSave(); // inscription : saisie gardée, reprise à la même étape après rechargement
      if(!document.getElementById('setup')&&document.getElementById('modal-root').innerHTML)return false; // pas pendant une saisie
      // déjà tenté pour cette version il y a moins d'une minute : on attend (avant, une tentative ratée bloquait cette version pour de bon)
      var k='pl_ver_rl';try{var _t=(sessionStorage.getItem(k)||'').split('|');if(_t[0]===m[1]&&Date.now()-(+_t[1]||0)<60000)return false;}catch(e){}
      // Inscription en cours : rechargée tout de suite (rien à perdre, saisie gardée)
      if(document.getElementById('setup')){try{sessionStorage.setItem(k,m[1]+'|'+Date.now());}catch(e){}_verGo(m[1]);return true;}
      // Sinon : rechargée quand l'app passe en arrière-plan, sans que ça se voie (un rechargement à l'écran fait un écran noir
      // sur iPhone) ; la nouvelle version est de toute façon celle qui s'ouvrira la prochaine fois
      window._verPending=m[1];return false;
    }).catch(function(){return false;});
}
// Rechargement sur la nouvelle version, après l'envoi d'un enregistrement en ligne en attente (5 s après une modification)
// Rechargement sur la nouvelle version : adresse marquée (?upd=), que le service worker va chercher sur le réseau
// (un simple rechargement pouvait reprendre la copie gardée, donc l'ancienne version)
function _verGo(v){location.replace(location.pathname+'?upd='+encodeURIComponent(v||'1')+location.hash);}
try{if(/[?&]upd=/.test(location.search))history.replaceState(null,'',location.pathname+location.hash);}catch(e){}
// Nouvelle version trouvée : une ligne dans le menu pour l'installer tout de suite
function _verLine(){return window._verPending?'<div class="hm-sync" style="color:var(--blue)" onclick="_closeDayMenu();_verApply()"><i class="ti ti-download" style="color:var(--blue)"></i><span>Nouvelle version '+_h(window._verPending)+' · installer</span></div>':'';}
function _verApply(){
  if(!window._verPending)return;
  var v=window._verPending;try{sessionStorage.setItem('pl_ver_rl',v+'|'+Date.now());}catch(e){}window._verPending=null;
  var go=function(){_verGo(v);},p=null;
  try{if(window._cloudSyncTimer&&_aid){clearTimeout(window._cloudSyncTimer);window._cloudSyncTimer=null;p=cloudSave(_aid);}}catch(e){}
  if(p&&p.then){var t=setTimeout(go,2500);p.then(function(){clearTimeout(t);go();},function(){clearTimeout(t);go();});}else go();
}
// Au retour dans l'app (reprise, pas relance) : nouvelle version trouvée tout de suite, avant le moindre appui →
// l'écran d'ouverture (le motif) revient et l'app se recharge dessous, comme une ouverture normale
window._visAt=0;window._tapAt=0;
document.addEventListener('pointerdown',function(){window._tapAt=Date.now();},true);
function _verOnResume(){window._visAt=Date.now();
  _verCheck().then(function(){
    if(!window._verPending||document.hidden||window._tapAt>window._visAt||Date.now()-window._visAt>4000||document.querySelector('#modal-root .overlay')||document.getElementById('setup'))return;
    var c=window._bootCopy&&window._bootCopy.cloneNode(true);
    if(c&&_isPhone()){c.classList.add('logo');c.style.opacity='0';c.style.transition='opacity .22s ease';document.body.appendChild(c);void c.offsetWidth;c.style.opacity='1';setTimeout(_verApply,260);}
    else _verApply();
  });}
// En quittant l'app : rechargée sur la nouvelle version, sans que ça se voie ; si aucune n'a encore été cherchée
// depuis un moment, on regarde d'abord (le rechargement se fait si l'app est toujours en arrière-plan)
window._verAt=0;
document.addEventListener('visibilitychange',function(){
  if(!document.hidden||document.querySelector('#modal-root .overlay'))return;
  if(window._verPending){_verApply();return;}
  if(Date.now()-window._verAt<60000)return;
  _verCheck().then(function(){if(document.hidden&&window._verPending)_verApply();});
});



async function cloudSave(pid,_retry){
  if(!window._authToken||!_profs[pid])return;
  // Rien de nouveau depuis la dernière synchro réussie → pas d'écriture (quota KV)
  var sig=_syncSig(_profs[pid]),sigKey=_syncKey(pid);
  try{if(localStorage.getItem(sigKey)===sig){setSyncStatus('ok');pushSyncAlerts();return;}}catch(e){}
  setSyncStatus('pending');
  try{
    var sent=JSON.stringify(_profs[pid]),cb=_cbase[pid];
    var res=await fetch(CLOUD_API+'/data/save',{method:'POST',headers:cloudHeaders(),body:'{"profileId":'+JSON.stringify(pid)+',"data":'+sent+(cb&&cb.rev&&!_retry?',"base":'+JSON.stringify(cb.rev):'')+'}'});
    if(res.status===401){await _sessionExpired();return;}
    if(res.status===409&&!_retry){var cj=null;try{cj=await res.json();}catch(e){}
      // version du serveur pas plus récente que celle de départ (lecture en retard du serveur) : rien d'un autre appareil
      var _ts=function(d){return (d&&d.profile&&d.profile._lastSaved)||0;},_bs=null;try{_bs=JSON.parse(cb&&cb.str||'null');}catch(e){}
      if(cj&&cj.data&&_bs&&_ts(cj.data)<=_ts(_bs))return cloudSave(pid,2);
      if(cj&&cj.data&&cb){try{
        // version d'ici gardée 30 jours (Réglages → Restaurer), puis fusion et nouvel envoi sur la version du serveur
        try{localStorage.setItem('pl_bak',JSON.stringify({at:Date.now(),u:_plU(),pid:pid,d:_profs[pid]}));}catch(e){}
        var mg=_merge3(JSON.parse(cb.str),_profs[pid],cj.data);_profs[pid]=mg;if(pid===_aid){S=mg;try{render();}catch(e){}}
        _cbase[pid]={rev:cj.rev,str:JSON.stringify(cj.data)};
        try{localStorage.setItem('pl_v8',JSON.stringify({p:_profs,a:_aid,u:_plU()}));}catch(e){}
        _infoToast('Modifications d’un autre appareil reprises');
        return cloudSave(pid,1);}catch(e){console.warn('merge error',e);}}
      return cloudSave(pid,2); // fusion impossible : enregistré comme avant (la version d'ici l'emporte)
    }
    if(!res.ok){
      var err='';try{err=(await res.json()).error||'';}catch(e){}
      console.warn('cloud save failed',res.status,err);
      _cloudSaveFailed(pid,'erreur '+res.status+(err?' : '+err:''));
    }else{
      window._syncErr='';window._sessionIsExpired=false;window._lastSyncOk=Date.now();clearTimeout(window._syncRetryTimer);
      try{var rj=await res.json();if(rj&&rj.rev)_cbase[pid]={rev:rj.rev,str:sent};}catch(e){}
      try{localStorage.setItem(sigKey,sig);}catch(e){}
      setSyncStatus('ok');
      pushSyncAlerts();
    }
  }catch(e){console.warn('cloud save error',e);_cloudSaveFailed(pid,navigator.onLine===false?'hors ligne':'serveur injoignable');}
}



// Retour sur l'app : récupérer les modifs faites sur un autre appareil (lecture seule, pas d'écriture KV)
async function cloudRefresh(){
  if(!window._authToken||!_aid||!_profs[_aid])return;
  if(Date.now()-(window._lastCloudRefresh||0)<20000)return;
  window._lastCloudRefresh=Date.now();
  var pid=_aid,sigKey=_syncKey(pid);
  // Modif locale pas encore envoyée : on la garde, elle partira au prochain envoi
  var localSig=_syncSig(_profs[pid]),syncedSig=null;
  try{syncedSig=localStorage.getItem(sigKey);}catch(e){}
  if(window._syncStatus==='pending'||window._syncStatus==='error'||localSig!==syncedSig)return;
  var cloud=await cloudLoad(pid);
  if(!cloud||pid!==_aid)return;
  var cloudSig=_syncSig(cloud);
  if(cloudSig===localSig)return;
  // Rien en attente ici et le cloud a changé depuis notre dernier envoi : c'est une modification faite ailleurs, on la prend
  // L'utilisateur a modifié entre-temps, ou une fenêtre est ouverte : ne pas écraser
  if(_syncSig(_profs[pid])!==localSig||document.getElementById('modal-root').innerHTML)return;
  try{localStorage.setItem('pl_bak',JSON.stringify({at:Date.now(),u:_plU(),pid:pid,d:_profs[pid]}));}catch(e){} // version remplacée, gardée (Réglages → Profil → Restaurer)
  _profs[pid]=cloud;S=cloud;_us=[];_rs=[];if(window._clLast&&window._clLast.pid===pid)_cbase[pid]={rev:window._clLast.rev,str:window._clLast.str};
  try{localStorage.setItem('pl_v8',JSON.stringify({p:_profs,a:_aid,u:_plU()}));localStorage.setItem(sigKey,cloudSig);}catch(e){}
  applyTheme();render();updateUrBtns();
  var hpn=document.getElementById('hdr-profile-name');if(hpn&&S.profile)hpn.textContent=S.profile.name||'Profil';
  setSyncStatus('ok');
}

async function cloudLoadAll(){
  window._lastCloudRefresh=Date.now();
  if(!window._authToken){window._cloudReady=true;gcalLoad();return;}
  try{
    const res=await fetch(CLOUD_API+'/data/list',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({})});
    // session expirée au démarrage : reconnexion puis rechargement (le cloud d'abord), sinon le dire tout de suite
    if(res.status===401){gcalLoad();(async function(){if(await _silentRelogin())location.reload();else _sessionExpired();})();return;}
    if(!res.ok){window._cloudReady=true;gcalLoad();return;} // cloud injoignable : on travaille sur l'appareil
    const text=await res.text();
    if(!text||text.trim()===''){window._cloudReady=true;gcalLoad();return;}
    const data=JSON.parse(text);
    const profiles=data.profiles||{};
    if(Object.keys(profiles).length===0){
      // New account - no data in KV yet
      // Use profile from localStorage (set by login registration) if available
      const localState=localStorage.getItem('pl_v8');
      if(localState){
        try{
          const parsed=JSON.parse(localState);
          // seulement les données locales de ce compte (inscription) : jamais celles d'un autre compte resté sur l'appareil
          if(parsed.p&&Object.keys(parsed.p).length>0&&parsed.u&&parsed.u===_plU()){
            _profs=parsed.p;_aid=parsed.a||'default';
            S=_profs[_aid]||_profs[Object.keys(_profs)[0]];
            if(window._authUser&&window._authUser.name&&S.profile)S.profile.name=capitalize(window._authUser.name);
            // Push initial profile to cloud
            window._cloudReady=window._cloudOk=true;cloudSave(_aid);
            saveState();
            gcalLoad();checkPendingLineChoice();return;
          }
        }catch(e){}
      }
      // Fallback to DEFAULT_PD
      _profs={default:DEFAULT_PD()};
      _aid='default';
      S=_profs['default'];
      S.profile.setupPending=true; // compte sans aucune donnée : la suite de l'inscription est demandée
      if(window._authUser&&window._authUser.name)S.profile.name=capitalize(window._authUser.name);
    } else {
      for(const pid of Object.keys(profiles)){
        const cloudData=await cloudLoad(pid);
        if(cloudData&&window._clLast&&window._clLast.pid===pid)_cbase[pid]={rev:window._clLast.rev,str:window._clLast.str};
        if(cloudData){
          var _localTs=(_profs[pid]&&_profs[pid].profile&&_profs[pid].profile._lastSaved)||0;
          var _cloudTs=(cloudData.profile&&cloudData.profile._lastSaved)||0;
          // données locales d'un compte inconnu (ancien format) : jamais préférées au cloud ;
          // rien en attente d'envoi ici (signature = dernier envoi réussi) : le cloud fait foi, quelle que soit la date
          var _synced=null;try{_synced=localStorage.getItem(_syncKey(pid));}catch(e){}
          var _dirty=!!(_profs[pid]&&_synced&&_syncSig(_profs[pid])!==_synced);
          if(_cloudTs>=_localTs||window._plLegacy||(_synced&&!_dirty)){ // pas de trace du dernier envoi : la date décide
            // ce que le cloud remplace sur l'appareil est gardé 30 jours (Réglages → Profil → Restaurer)
            if(_profs[pid]&&_profs[pid].profile&&!(window._plBlank&&pid===_aid)&&_syncSig(_profs[pid])!==_syncSig(cloudData))try{localStorage.setItem('pl_bak',JSON.stringify({at:Date.now(),u:_plU(),pid:pid,d:_profs[pid]}));}catch(e){}
            _profs[pid]=cloudData;try{localStorage.setItem(_syncKey(pid),_syncSig(cloudData));}catch(e){}}
        }
      }
      // Update active profile S from loaded data
      if(_profs[_aid]){S=_profs[_aid];}
      else{_aid=Object.keys(_profs)[0];S=_profs[_aid];}
    }
    // Clean customVacs that shadow standard/cloud vacations
    Object.keys(_profs).forEach(function(pid){
      var pr=_profs[pid];
      if(pr&&pr.customVacs){
        var dirty=false;
        Object.keys(pr.customVacs).forEach(function(k){
          if(VAC_STD[k]||_globalVacs[k]){console.warn('customVacs shadow removed:',k,pr.customVacs[k]);delete pr.customVacs[k];dirty=true;}
        });
        if(dirty&&pid===_aid)cloudSave(pid);
      }
    });
    window._cloudReady=true;window._cloudOk=true;
    saveState();
  }catch(e){console.warn('cloud load all error',e);}
  window._cloudReady=true;try{_ovCleanSame();}catch(e){}try{render();}catch(e){}
  gcalLoad();
  setTimeout(function(){_swapRefresh(true);if(/[?&]swap=1/.test(location.search)){try{history.replaceState(null,'',location.pathname);}catch(e){}openSwaps(0);}},1500);
  // au lancement, l'app s'ouvre sur la copie gardée : si une version plus récente existe, elle se recharge dessus
  // avant toute question (sinon une ancienne version pouvait proposer un cycle d'une autre équipe)
  _verCheck().then(function(rl){if(!rl){checkPendingLineChoice();setTimeout(_checkAnnounce,1200);}});
  gcalStartPoll();
  window.addEventListener('focus',function(){cloudRefresh();});
  // Sync on visibility change (mobile: app comes back to foreground)
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){
      gcalStartPoll();
      cloudRefresh();
      _verOnResume();
    }else{
      clearInterval(_pollTimer);
    }
  });
}

function deleteCurrentProfile(){
  const hasGcal=!!gcalTokens;
  const gcalRow=hasGcal
    ?'<label style="display:flex;align-items:center;gap:10px;margin:14px 0;padding:12px;background:var(--bg);border-radius:10px;cursor:pointer">'
     +'<input type="checkbox" id="del-gcal-cb" style="width:18px;height:18px;accent-color:#b87878;flex-shrink:0" checked>'
     +'<span style="font-size:13px;color:var(--text2)">Supprimer aussi le calendrier <strong>franceinfo</strong> dans Google Agenda</span>'
     +'</label>'
    :'';
  document.getElementById('modal-root').innerHTML=
    '<div class="overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st" style="color:var(--red)">Supprimer le compte</div>'
    +'<div style="font-size:13px;color:var(--text2);margin:8px 0 4px">Toutes les données de planning seront définitivement effacées et le compte sera déconnecté.</div>'
    +gcalRow
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button class="mcancel" style="flex:1" onclick="closeModal()">Annuler</button>'
    +'<button id="del-confirm-btn" class="mb" style="flex:1;background:#e53935;color:#fff;border:none" onclick="confirmDeleteAccount()"><i class="ti ti-trash" style="font-size:13px;margin-right:4px"></i>Supprimer</button>'
    +'</div>'
    +'</div></div>';
  _lockBodyScroll();
}

async function confirmDeleteAccount(){
  const btn=document.getElementById('del-confirm-btn');
  if(btn){btn.disabled=true;btn.textContent='Suppression...';}
  const pid=_aid||Object.keys(_profs)[0];_suForget();
  const delGcal=!!(document.getElementById('del-gcal-cb')&&document.getElementById('del-gcal-cb').checked);
  // Delete Google Calendar if requested
  if(delGcal&&gcalTokens&&gcalCalendarId&&gcalCalendarId!=='primary'){
    try{
      const token=await gcalGetToken();
      if(token){
        await fetch(GCAL_FUNCTIONS+'/calendar',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'deleteCalendar',access_token:token,refresh_token:gcalTokens.refresh_token,calendarId:gcalCalendarId})});
        localStorage.removeItem('gcal_calendar_id');
      }
    }catch(e){console.warn('gcal delete',e);}
  }
  // Delete cloud data + account (await so requests complete before redirect)
  if(window._authToken){
    if(pid) await fetch(CLOUD_API+'/data/deleteProfile',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:pid})}).catch(function(){});
    await fetch(CLOUD_API+'/auth/delete-account',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({})}).catch(function(){});
  }
  // Clear all local storage
  ['pl_v8','auth_token','auth_user','remember_creds','gcal_calendar_id'].forEach(function(k){localStorage.removeItem(k);});
  window.location.href=BASE+'?tab=register';
}


// Historique (cloud) : chaque jour gardé, avec son résumé, et un bouton Restaurer
async function _histOpen(){var pid=_aid,dates=[];
  try{var r=await fetch(CLOUD_API+'/data/backups',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:pid})});var d=await r.json();dates=(d.dates||[]).slice().sort().reverse();}catch(e){_infoToast('Historique injoignable');return;}
  window._modalBack=function(){openSettingsModal();};
  var box=function(h){document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet"><div class="sh"></div><div class="st">Sauvegardes</div>'
    +'<div style="font-size:13px;color:var(--text3);line-height:1.45;margin:-4px 0 10px">Données telles qu’elles étaient avant les premières modifications de chaque jour.</div>'+h
    +'<button class="mcancel" onclick="closeModal()">Retour</button></div></div>';};
  if(!dates.length){box('<div class="hd-card" style="font-size:13px;color:var(--text3)">Pas encore de version : elles s’enregistrent chaque jour où l’app est modifiée.</div>');return;}
  box('<div class="hd-card" style="font-size:13px;color:var(--text3)">Lecture des sauvegardes…</div>');
  var vs=await Promise.all(dates.slice(0,20).map(function(dt){return fetch(CLOUD_API+'/data/backup',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:pid,date:dt})}).then(function(r){return r.json();}).then(function(x){return x.data;}).catch(function(){return null;});}));
  box(dates.slice(0,20).map(function(dt,i){var x=new Date(dt+'T12:00:00');return '<div class="hd-card" style="padding:10px 12px;margin-bottom:6px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:13px">Avant le '+x.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'})+'</b>'
    +(vs[i]?'<button class="adj-pill" style="width:120px;height:32px;font-size:13px;flex-shrink:0" onclick="_histRestore(\''+dt+'\')">Restaurer</button>':'')+'</div>'
    +'<div style="font-size:11px;color:var(--text3);margin-top:4px;line-height:1.45">'+(vs[i]?_bakSum(vs[i]):'illisible')+'</div></div>';}).join(''));}
async function _histRestore(dt){var data=null;try{var r=await fetch(CLOUD_API+'/data/backup',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:_aid,date:dt})});data=(await r.json()).data;}catch(e){}
  if(!data){_infoToast('Version introuvable');return;}
  if(!await _ask('Remettre les données d’avant le '+new Date(dt+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+' ?\n\nLes données actuelles restent dans l’historique d’aujourd’hui.',{ok:'Remettre'}))return;
  pushUndo('Sauvegarde restaurée');_snapApply(data);saveState();cloudSave(_aid);window._modalBack=null;closeModal();render();}
async function _restoreBak(){var k=null;try{k=JSON.parse(localStorage.getItem('pl_bak')||'null');}catch(e){}if(!k||!k.d)return;
  if(!await _ask('Remettre la version d’avant enregistrée sur cet appareil ('+((k.d.profile||{}).name||'profil')+') ?\n\nElle remplace les données actuelles, ici et dans le cloud.',{ok:'Remettre'}))return;
  if(k.pid===_aid){pushUndo('Version d’avant restaurée');_snapApply(k.d);}else{_us=[];_rs=[];_profs[k.pid]=k.d;_aid=k.pid;S=_profs[_aid];}try{localStorage.removeItem('pl_bak');}catch(e){}
  saveState();cloudSave(_aid);render();closeModal();_infoToast('✓ Version d’avant restaurée');}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&window._authToken&&_aid&&window._syncStatus==='pending'){clearTimeout(window._cloudSyncTimer);cloudSave(_aid);}});
async function signOut(){
  // modifications pas encore envoyées : envoyées avant de fermer la session
  if(window._authToken&&_aid&&window._syncStatus==='pending'){clearTimeout(window._cloudSyncTimer);try{await cloudSave(_aid);}catch(e){}}
  fetch(CLOUD_API+'/auth/logout',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({})}).catch(()=>{});
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  window.location.href=BASE;
}

// Très grands écrans (largeur logique > 1920 px, ex. 4K réglé à 100–150 %) : agrandir toute l'interface
// pour qu'elle garde les proportions d'un écran 1920. Sans effet à 200 % ou plus (largeur ≤ 1920).
// window._uiZoom : zoom appliqué (absent = 1). Pas d'initialisation ici : init() s'exécute avant cette ligne.
// Facteur à appliquer à innerWidth/innerHeight pour obtenir des px de mise en page : selon le navigateur,
// innerWidth tient compte ou non du zoom CSS (Chromium : non). On compare au clientWidth de <html>.
function _zoomFix(){
  var z=window._uiZoom||1;
  if(z===1)return 1;
  return window.innerWidth/document.documentElement.clientWidth>1.05?z:1;
}
function _applyBigScreenZoom(){
  var w=window.innerWidth*(window._uiZoom||1)/_zoomFix(); // largeur réelle de la fenêtre
  var z=w>1920?Math.min(2,Math.round(w/1920*100)/100):1;
  if(z===(window._uiZoom||1))return;
  window._uiZoom=z;
  document.documentElement.style.zoom=z===1?'':String(z);
}

function _fitCalendar(){
  const mv=document.getElementById('month-view');
  if(!mv)return;
  if(_isPhone()){mv.style.width='';document.getElementById('ann-wrap').style.width='';document.querySelector('.mbar').style.width='';return;}
  const col=document.querySelector('.cal-col');
  if(!col)return;
  const mbar=document.querySelector('.mbar');
  const availW=col.clientWidth;
  if(!availW){requestAnimationFrame(_fitCalendar);return;}
  const w=availW+'px';
  mv.style.width=w;
  const aw=document.getElementById('ann-wrap');
  if(aw)aw.style.width=w;
  if(mbar)mbar.style.width=w;
}
function _fitAnnual(){
  const hdr=document.querySelector('.hdr');
  const mbar=document.querySelector('.mbar');
  const col=document.querySelector('.cal-col');
  const hdrH=hdr?hdr.offsetHeight:60;
  const mbarH=mbar?mbar.offsetHeight:48;
  const ncols=window.innerWidth<600?3:4;
  const rowGap=6,colGap=6,mPad=6,mBorder=2,cellGap=2;
  if(_isPhone()){
    // Téléphone : 4 colonnes × 3 rangées, à la hauteur exacte du calendrier du mois (même place, rien ne bouge en dessous)
    const cw=document.querySelector('#month-view > .cal-wrap'),mv=document.getElementById('month-view');
    if(cw&&cw.offsetHeight>100)window._calH=cw.offsetHeight;if(cw)window._calGap=parseFloat(getComputedStyle(cw).marginBottom)||0;
    const H=window._calH||304,g=document.getElementById('ann-grid');
    // même espace sous la vue annuelle que sous le calendrier du mois (jusqu'à la case Soldes)
    if(g){g.style.gridTemplateColumns='repeat(4,1fr)';g.style.marginBottom=(window._calGap!=null?window._calGap:8)+'px';g.style.height=H+'px';g.style.gridTemplateRows='repeat(3,minmax(0,1fr))';}
    const G=8,P=7,NM=17,CG=2,availW=col?col.clientWidth:window.innerWidth;
    const perMonthH=(H-2*G)/3,perMonthW=(availW-3*G)/4;
    const fromH=(perMonthH-2*P-2-NM-5*CG)/6,fromW=(perMonthW-2*P-2-6*CG)/7;
    let cellH=Math.max(3,Math.min(fromH,fromW*1.15));
    document.documentElement.style.setProperty('--ann-pad',P+'px');
    document.documentElement.style.setProperty('--ann-d-h',cellH.toFixed(2)+'px');
    // correction au pixel : si une case-mois dépasse sa rangée (police, arrondis), on réduit les jours d'autant
    const m0=g&&g.querySelector('.ann-month');
    if(m0&&m0.offsetHeight){const over=m0.getBoundingClientRect().height-perMonthH;if(over>0.3){cellH=Math.max(3,cellH-over/6);document.documentElement.style.setProperty('--ann-d-h',cellH.toFixed(2)+'px');}}
    return;
  }
  const availH=window.innerHeight/_zoomFix()-hdrH-mbarH-20;
  const availW=col?col.clientWidth:window.innerWidth;
  const mnameH=20;
  const perMonthH=(availH-2*rowGap)/3;
  const miniH=perMonthH-2*mPad-2*mBorder-mnameH;
  const cellHfromH=(miniH-5*cellGap)/6;
  const perMonthW=(availW-(ncols-1)*colGap)/ncols;
  const miniW=perMonthW-2*mPad-2*mBorder;
  const cellHfromW=((miniW-6*cellGap)/7)/1.2;
  const cellH=Math.max(3,Math.min(cellHfromH,cellHfromW));
  document.documentElement.style.setProperty('--ann-d-h',cellH+'px');
}
function _syncSideTop(){
  const sc=document.querySelector('.side-col');
  if(!sc)return;
  if(_isPhone()){sc.style.paddingTop='';return;}
  const mbar=document.querySelector('.mbar');
  sc.style.paddingTop=(mbar?mbar.offsetHeight:0)+'px';
}

function _checkSideBelow(){
  if(_sbGuard||_isPhone())return;
  const mv=document.getElementById('month-view');
  const sc=document.querySelector('.side-col');
  const layout=document.querySelector('.layout');
  if(!mv||!sc||!layout)return;
  const mbar=document.querySelector('.mbar');
  const aw=document.getElementById('ann-wrap');
  // Vue annuelle affichée ou en train de disparaître : la colonne latérale est étirée à sa hauteur,
  // la mesure serait fausse (toggleAnnual relance la vérification à la fin du fondu)
  if(annualOpen||(aw&&aw.classList.contains('open')))return;
  const currently=layout.classList.contains('side-below');
  // Measure always in side-by-side mode: both calH and sideH change when
  // layout toggles, so comparing them live creates insoluble oscillation.
  // Temporarily removing the class + clearing inline widths causes a
  // synchronous reflow but no paint (browser paints once, after the frame).
  if(currently){
    layout.classList.remove('side-below');
    mv.style.width='';
    if(mbar)mbar.style.width='';
    if(aw)aw.style.width='';
  }
  const calH=(mbar?mbar.offsetHeight:0)+mv.offsetHeight;
  const sideH=sc.scrollHeight;
  const should=sideH>calH+30;
  layout.classList.toggle('side-below',should);
  if(currently!==should){
    mv.style.width='';
    if(mbar)mbar.style.width='';
    if(aw)aw.style.width='';
    _sbGuard=true;
    requestAnimationFrame(function(){_sbGuard=false;_fitCalendar();});
  } else if(currently){
    // Stayed in side-below but widths were cleared for measurement; re-fit
    requestAnimationFrame(_fitCalendar);
  }
}
window.addEventListener('resize',function(){_applyBigScreenZoom();_fitCalendar();_fitSideMonth();if(annualOpen)_fitAnnual();_syncSideTop();_checkSideBelow();});

// Affichage de l'app une fois les données chargées : l'écran de chargement s'efface
// Mémorise la position des cases du côté (téléphone) pour que l'écran de chargement suivant les reproduise
// iPhone à l'horizontale : places du calendrier, des cases, des onglets, du menu et du titre (pour la silhouette de chargement)
function _saveBootGeoLand(){try{var sc=document.querySelector('.side-col');if(sc&&sc.scrollTop>2)return;
  var Q=function(e){if(!e)return null;var r=e.getBoundingClientRect();return r.width>4&&r.height>4?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null;};
  var bl=[].map.call(document.querySelectorAll('#side-v2 > .bloc'),Q).filter(Boolean);if(!bl.length)return;
  localStorage.setItem('pl_boot_geo_l',JSON.stringify({w:innerWidth,vh:innerHeight,cal:Q(document.querySelector('#month-view .cal-wrap')),b:bl,tab:Q(document.getElementById('tabbar')),menu:Q(document.getElementById('menu-btn')),mt:Q(document.getElementById('mtit'))}));}catch(e){}}
function _saveBootGeo(){try{if(_isLand()){if(!document.querySelector('#modal-root .overlay'))_saveBootGeoLand();return;}if(!_isPhone()||document.body.scrollTop>0||scrollY>0)return;var bl=document.querySelectorAll('#side-v2 > .bloc');if(!bl.length)return;
  var ly=document.querySelector('.layout');if(ly&&ly.style.transform)return;var hd=document.querySelector('.hdr');
  var R=function(e){if(!e)return null;var r=e.getBoundingClientRect();return [Math.round(r.top),Math.round(r.height),Math.round(r.left),Math.round(r.width)];};
  var lyL=ly?ly.getBoundingClientRect().left:0;
  var RB=function(e,o){var r=e.getBoundingClientRect(),cs=getComputedStyle(e);return [Math.round(r.left-(o?o.left:0)),Math.round(r.top-(o?o.top:0)),Math.round(r.width),Math.round(r.height),cs.borderRadius];};
  var vis=function(e){var r=e.getBoundingClientRect(),cs=getComputedStyle(e);return e.offsetParent&&r.width>=6&&r.height>=6&&cs.visibility!=='hidden'&&+cs.opacity>0.05&&(e.children.length||e.textContent.trim());};
  var hb=hd?[].filter.call(hd.querySelectorAll('.hdr-btns > *, .hdr-btns .ibtn'),function(e){return vis(e)&&!e.closest('.dropdown')&&!e.querySelector('.ibtn');}).map(function(e){return RB(e);}):[];
  var mbE=document.querySelector('.mbar'),mbR=mbE&&mbE.getBoundingClientRect();
  var mb=mbE?[].filter.call(mbE.querySelectorAll('button'),vis).map(function(e){return RB(e,mbR);}):[],mt=document.getElementById('mtit');
  localStorage.setItem('pl_boot_geo',JSON.stringify({w:innerWidth,h:hd?Math.round(hd.getBoundingClientRect().height):0,hb:hb,mb:mb,mt:mt&&mbR?RB(mt,mbR):null,
    bar:R(document.querySelector('.mbar')),cal:R(document.querySelector('.cal-wrap')),sm:R(document.getElementById('side-month')),bl:Math.round(bl[0].getBoundingClientRect().left-lyL),b:[].map.call(bl,function(e){var r=e.getBoundingClientRect();return[Math.round(r.top),Math.round(r.height)];})}));}catch(e){}}
function _revealBody(){
  setTimeout(_saveBootGeo,1600);
  var b=document.getElementById('boot');if(!b){if(window._ptrDone)window._ptrDone();return;}
  // copie propre de l'écran de chargement (sans roue) : réaffichée en fondu au prochain « tirer pour actualiser »
  try{var cl=b.cloneNode(true);cl.classList.remove('ptr','logo');cl.style.opacity='';cl.style.pointerEvents='';var bp=cl.querySelector('.bt-ptr');if(bp)bp.remove();window._bootCopy=cl;}catch(e){}
  // Durée minimale d'affichage (~1 pulsation) même si les données arrivent tout de suite
  var wait=Math.max(0,(b.classList.contains('logo')?1600:1200)-performance.now()); // ouverture : le motif reste un moment
  // la roue commence à s'arrêter un peu avant que l'écran s'estompe (elle doit d'abord revenir en haut)
  setTimeout(function(){if(window._ptrFade)window._ptrFade();},Math.max(0,wait-350));
  setTimeout(function(){
    b.classList.add('out');b.style.opacity='0';b.style.pointerEvents='none'; // ouverture : le motif grossit en s'effaçant
    // retour d'actualisation : la suite (roue → « Actualisé ✓ » → mois) une fois l'écran de chargement parti
    setTimeout(function(){b.remove();var bg=document.getElementById('boot-bg');if(bg)bg.remove();if(_isPhone())document.documentElement.style.backgroundColor='#222221';if(window._ptrDone)window._ptrDone();},b.classList.contains('logo')?760:440);
  },wait);
}
function syncWknHeight(){setTimeout(_syncWknNow,0);}
// Met en forme les numéros de semaine (tuiles ramenées / congés) sans attendre
function _syncWknNow(root){ // root : seulement ce calendrier (mois voisin préparé), sans toucher au mois affiché
    const dayCell=document.querySelector('.dc');
    if(!dayCell)return;
    const sampleTd=document.querySelector('.cal td:not(.wkn)');
    const tdPad=sampleTd?Math.round(parseFloat(getComputedStyle(sampleTd).paddingTop))||7:7;
    (root||document).querySelectorAll('td.wkn').forEach(function(td){
      const num=td.getAttribute('data-wn')||td.textContent.trim();
      if(!td.getAttribute('data-wn'))td.setAttribute('data-wn',num);
      // Get actual computed background of cal-wrap for opaque badge
      const isLight=document.documentElement.getAttribute('data-theme')==='light';
      const calBg=isLight?'rgb(222,222,217)':'rgb(50,50,55)';
      var bg='transparent';var color=isLight?'#4a4a46':'#c8c8cc';var fw='normal';
      const tr=td.parentElement;
      if(td.classList.contains('wram')){
        bg=isLight?'rgba(220,185,60,.25)':'color-mix(in srgb, '+calBg+' 75%, rgba(184,148,30,1) 25%)';
        color=isLight?'#7a5c00':'#d4b040';fw='600';
      } else if(td.classList.contains('wcg')){
        bg=isLight?'rgba(90,158,63,.20)':'color-mix(in srgb, '+calBg+' 75%, rgba(90,158,63,1) 25%)';
        color=isLight?'#2d6b18':'#6ab84a';fw='600';
      }
      // Apply row background color to the td cell (behind the badge)
      var cellBg='transparent';
      if(tr&&tr.classList.contains('curweek'))cellBg='rgba(78,160,247,.06)';
      td.style.position='relative';
      td.style.padding='0';
      td.style.background=cellBg;
      td.innerHTML='<div style="position:absolute;top:'+tdPad+'px;bottom:'+tdPad+'px;left:0;width:calc(100% - 4px);display:flex;align-items:center;justify-content:center;font-size:9px;border-radius:0 var(--r) var(--r) 0;background:'+bg+';color:'+color+';font-weight:'+fw+';z-index:1;box-sizing:border-box">'+num+'</div>';
    });
}

function gcalLoad(){
  // Load tokens from current profile
  if(S.profile&&S.profile.gcalTokens){gcalTokens=S.profile.gcalTokens;}
  else{gcalTokens=null;}
  // Check for auth code in URL (OAuth callback) OR in localStorage (set by callback page)
  // Handle GitHub Pages SPA redirect (code may be in ?redirect= param)
  let searchStr=window.location.search;
  const redirectParam=new URLSearchParams(searchStr).get('redirect');
  if(redirectParam){
    // Clean the redirect param and extract the real code
    searchStr=decodeURIComponent(redirectParam).replace(/^.*?\?/,'?');
    history.replaceState({},'',BASE+'app/');
  }
  const urlParams=new URLSearchParams(searchStr);
  const urlCode=urlParams.get('code');
  const lsCode=localStorage.getItem('gcal_auth_code');
  const code=urlCode||lsCode;
  if(code){
    if(lsCode)localStorage.removeItem('gcal_auth_code');
    // Clean URL without reloading
    if(urlCode)history.replaceState({},'',window.location.pathname);
    gcalExchange(code);
  }
  gcalUpdateBtn();
}

function gcalSave(){
  if(S.profile)S.profile.gcalTokens=gcalTokens;
  saveState();
}

function gcalSetProgress(done,total){
  const circle=document.getElementById('gcal-progress-circle');
  if(!circle)return;
  const circ=81.68;
  if(!total||done>=total){circle.style.stroke='transparent';circle.style.strokeDashoffset=circ;return;}
  circle.style.stroke='#62aadc';
  circle.style.strokeDashoffset=circ*(1-done/total);
}

function gcalUpdateBtn(){
  const _wrap=document.getElementById('gcal-status-wrap');
  const _busy=_wrap&&(_wrap.classList.contains('gcal-syncing')||_wrap.classList.contains('gcal-clearing'));
  // Always update dropdown buttons regardless of sync state
  const btn=document.getElementById('gcal-btn');
  const connRow=document.getElementById('gcal-connected-btns');
  if(btn){btn.style.display=gcalTokens?'none':'';btn.textContent='Connecter';}
  if(connRow)connRow.style.display=gcalTokens?'grid':'none';
  const autoSyncBtn=document.getElementById('gcal-autosync-btn');
  if(autoSyncBtn){
    const _as=S.profile&&S.profile.gcalAutoSync!==false;
    autoSyncBtn.style.background=_as?'var(--blue)':'';
    autoSyncBtn.style.color=_as?'#fff':'var(--text2)';
    autoSyncBtn.style.boxShadow=_as?'inset 0 2px 4px rgba(0,0,0,.2)':'';
    autoSyncBtn.title=_as?'Sync auto activée':'Sync auto désactivée';
  }
  // New modal rows
  const _discRow=document.getElementById('gcal-disconnected-row');
  const _connRows=document.getElementById('gcal-connected-rows');
  if(_discRow)_discRow.style.display=gcalTokens?'none':'block';
  if(_connRows)_connRows.style.display=gcalTokens?'block':'none';
  const _asTgl=document.getElementById('gcal-as-tgl');
  if(_asTgl){const _as=S.profile&&S.profile.gcalAutoSync!==false;_asTgl.checked=_as;}
  // Don't reset icon/circle if sync/clear is running
  if(_busy)return;
  // Header status icon: Google G with color state
  const ico=document.getElementById('gcal-status');
  if(ico){
    const _autoSync=S.profile&&S.profile.gcalAutoSync!==false;
    const color=gcalTokens&&window._gcalErr?'#b87878':gcalTokens?(_autoSync?'#52a06a':'#c88048'):gcalTokens===false?'#b87878':'#666';
    ico.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.28h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="'+color+'"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="'+color+'"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="'+color+'"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="'+color+'"/></svg>';
    ico.title=gcalTokens?(window._gcalErr?'Échec de la synchro Google Agenda ('+window._gcalErr+')'+(window._gcalReconnect?' — déconnecter puis reconnecter Google Agenda dans les réglages.':''):'Google Agenda connecté'):'Google Agenda non connecté';
  }
  // Reset circle to transparent
  const _circle=document.getElementById('gcal-progress-circle');
  if(_circle){_circle.style.stroke='transparent';_circle.style.strokeDashoffset='81.68';}
}

// Avant d'envoyer vers Google : prévenir de l'écran « application non validée » (app publiée sans validation Google)
function gcalConnect(){
  document.getElementById('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Connecter Google Agenda</div>'
    +'<div style="font-size:13px;color:var(--text2);line-height:1.5;margin:8px 0 12px">Google va afficher un avertissement <b>« Google n’a pas validé cette application »</b>. C\'est normal : l\'application n’a pas fait la longue démarche de validation auprès de Google.</div>'
    +'<div style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:14px;padding:10px 12px;background:var(--bg3);border-radius:var(--r)">Pour continuer :<br>1. Toucher <b>Paramètres avancés</b> (en bas à gauche)<br>2. Toucher le lien <b>Accéder à … (non sécurisé)</b><br>3. Autoriser l’accès à l’agenda</div>'
    +'<button class="mb wide" style="background:var(--blue);color:#fff;margin-bottom:8px;width:100%" onclick="gcalConnectGo()">Continuer vers Google</button>'
    +'<button class="mcancel" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
}
function gcalConnectGo(){
  const url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({
    client_id:GCAL_CLIENT_ID,
    redirect_uri:GCAL_REDIRECT_URI,
    state:location.origin+BASE,
    response_type:'code',
    scope:GCAL_SCOPE,
    access_type:'offline',
    prompt:'consent',
  });
  window.location.href=url;
}

async function gcalExchange(code){
  const btn=document.getElementById('gcal-btn');
  if(btn)btn.textContent='Connexion...';
  try{
    const res=await fetch(GCAL_FUNCTIONS+'/auth',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'exchange',code,redirect_uri:GCAL_REDIRECT_URI}),
    });
    const data=await res.json();
    if(data.access_token){
      gcalTokens={
        access_token:data.access_token,
        refresh_token:data.refresh_token||gcalTokens&&gcalTokens.refresh_token,
        expiry:Date.now()+data.expires_in*1000,
      };
      if(S.profile)S.profile.gcalAutoSync=true;gcalSave();gcalUpdateBtn();
      await gcalEnsureCalendar();
      gcalSync();
    } else {
      console.error('gcal exchange failed', JSON.stringify(data));
      alert('Connexion Google échouée: ' + (data.error_description || data.error || JSON.stringify(data)));
      if(btn)btn.textContent='Connecter à Google Agenda';
    }
  }catch(e){
    console.error('gcal exchange error',e);
    alert('Erreur connexion Google: ' + e.message);
    if(btn)btn.textContent='Connecter à Google Agenda';
  }
}

// ID of dedicated calendar, stored locally
var gcalCalendarId= localStorage.getItem('gcal_calendar_id') || 'primary';

function gcalClearDateId(dateKey){gcalTrigger();}








function gcalTrigger(){
  if(!gcalTokens||(S.profile&&S.profile.gcalAutoSync===false))return;
  const wrap=document.getElementById('gcal-status-wrap');
  if(wrap)wrap.classList.add('gcal-pending');
  const ico=document.getElementById('gcal-status');
  if(ico&&(!wrap||!wrap.classList.contains('gcal-syncing')))ico.innerHTML=gSvg('#c88048');
  clearTimeout(_syncTimer);
  _syncTimer=setTimeout(function(){_syncTimer=null;gcalSync();},1000);
}

async function gcalSync(){
  if(!gcalTokens)return;
  if(_syncAbort){_syncQueued=true;return;}
  _syncQueued=false;
  const ac=new AbortController();_syncAbort=ac;
  const _syncTimeout=setTimeout(function(){if(_syncAbort===ac){ac.abort();}},90000);
  const wrap=document.getElementById('gcal-status-wrap');
  const ico=document.getElementById('gcal-status');
  const circle=document.getElementById('gcal-progress-circle');
  if(wrap){wrap.classList.remove('gcal-pending');wrap.classList.add('gcal-syncing');}
  if(ico)ico.innerHTML=gSvg('#62aadc');
  if(circle){circle.style.stroke='';circle.style.strokeDashoffset='';}
  const token=await gcalGetToken();
  if(!token){clearTimeout(_syncTimeout);if(wrap)wrap.classList.remove('gcal-syncing');_syncAbort=null;gcalUpdateBtn();return;}
  if(!gcalCalendarId||gcalCalendarId==='primary'){
    await gcalEnsureCalendar();
  }else{
    await gcalVerifyCalendar();
    if(!gcalCalendarId||gcalCalendarId==='primary')await gcalEnsureCalendar();
  }
  const pid=(_aid||'default').replace(/[^a-z0-9]/gi,'').toLowerCase().slice(0,10);
  function stableId(k){return 'plan'+pid+k.replace(/-/g,'');}
  const startD=new Date();startD.setMonth(startD.getMonth()-12);
  const endD=new Date();endD.setMonth(endD.getMonth()+24);
  const events=[];
  const cur=new Date(startD);
  while(cur<=endD){
    const k=dk(cur);
    const ev=gcalBuildDayEvent(k);
    if(ev)events.push({id:k,googleEventId:stableId(k),event:ev});
    cur.setDate(cur.getDate()+1);
  }
  function _syncDone(ok,errMsg,reconnect){
    if(circle){circle.style.stroke='';circle.style.strokeDashoffset='';}
    if(wrap)wrap.classList.remove('gcal-syncing');
    window._gcalErr=ok?'':(errMsg||'échec de la synchronisation');if(ok)window._gcalLastOk=Date.now();
    window._gcalReconnect=!ok&&!!reconnect;
    if(!ok)console.warn('[gcalSync]',window._gcalErr);
    if(ok){
      gcalWriteStatus('done',1,1);
      if(ico&&wrap){ico.innerHTML=gSvg('#34a853');wrap.classList.add('gcal-done-anim');setTimeout(function(){wrap.classList.remove('gcal-done-anim');gcalUpdateBtn();},2000);}
    }else{
      gcalWriteStatus('idle',0,0);
      gcalUpdateBtn();
    }
    _syncAbort=null;
    if(_syncQueued){_syncQueued=false;gcalSync();}
  }
  function _startPoll(){
    var polls=0;var maxPolls=90;
    var iv=setInterval(async function(){
      polls++;
      try{
        const sr=await fetch(CLOUD_API+'/sync-status',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({action:'get'})});
        const sd=await sr.json();
        if(sd.status==='done'||sd.status==='error'){clearInterval(iv);_syncDone(sd.status==='done',sd.message);}
        else if(polls>=maxPolls){clearInterval(iv);_syncDone(true);}
      }catch(e){if(polls>=maxPolls){clearInterval(iv);_syncDone(true);}}
    },2000);
  }
  try{
    const res=await fetch(GCAL_FUNCTIONS+'/gcal/fullsync-start',{
      method:'POST',headers:cloudHeaders(),
      body:JSON.stringify({profileId:_aid||'default',calendarId:gcalCalendarId,events:events,startDate:dk(startD),endDate:dk(endD)}),
      signal:ac.signal
    });
    clearTimeout(_syncTimeout);
    const resData=await res.json().catch(function(){return{};});
    console.log('[gcalSync] fullsync-start response:',resData,'events_sent:',events.length);
    if(res.ok){
      if(!resData.started){
        _syncDone(true);
      }else{
        _startPoll();
      }
    }else{
      console.error('[gcalSync] fullsync-start error:',resData);
      if(res.status===401){_syncDone(false,'session expirée');_sessionExpired();}
      else _syncDone(false,resData.error||('erreur '+res.status),resData.reconnect);
    }
  }catch(e){
    clearTimeout(_syncTimeout);
    _syncDone(false,e&&e.name==='AbortError'?'délai dépassé':'serveur injoignable');
    if(e&&e.name!=='AbortError')console.error('sync error',e);
  }
}

// Message de l'admin : affiché une fois, à l'ouverture (pas par-dessus une autre fenêtre : ce sera la fois suivante)
async function _checkAnnounce(){if(!window._authToken)return;try{
  var a=(await (await fetch(CLOUD_API+'/announce',{method:'POST',headers:cloudHeaders(),body:'{}'})).json()).announce;
  if(!a||!a.id||!a.text||(a.pool&&a.pool!=='all'&&a.pool!==_pool())||(S.profile&&S.profile.annSeen===a.id))return;
  if(document.getElementById('modal-root').innerHTML||document.getElementById('setup'))return;
  _lockBodyScroll();window._annId=a.id;
  document.getElementById('modal-root').innerHTML='<div class="overlay"><div class="sheet"><div class="sh"></div><div class="st">Message</div>'
    +'<div class="hd-card" style="font-size:15px;line-height:1.5;white-space:pre-wrap;padding:14px">'+_h(a.text)+'</div>'
    +'<button class="mb wide" style="background:var(--blue);color:#fff;margin-top:8px" onclick="S.profile.annSeen=window._annId;saveState();closeModal()">OK</button></div></div>';
}catch(e){}}
async function checkPendingLineChoice(){
  if(!window._authToken)return;
  try{
    const res=await fetch(CLOUD_API+'/pending-line-choice',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({pools:1})});
    if(!res.ok)return;
    const text=await res.text();
    if(!text||text.trim()==='')return;
    const data=JSON.parse(text);
    // cycles d'une autre équipe : pas de ligne à choisir
    var pend=(data.pending||[]).filter(function(c){return (c.pool||'antenne')===_poolAt(c.startDate);});
    if(!pend.length)return;
    // Show modal for first pending cycle
    showLineChoiceModal(pend[0]);
  }catch(e){}
}

function showLineChoiceModal(cycle){
  const weeks=cycle.weeks||[];
  const startDate=cycle.startDate||'';
  const startFmt=startDate?new Date(startDate+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
  // Build select options — show S1..SN with day pattern summary
  const DAY_SHORT=['L','M','Me','J','V','S','D'];
  const lineOpts=weeks.map(function(w,i){
    const summary=w.map(function(v){return(!v||v==='RH')?'—':v;}).join(' ');
    return '<option value="'+i+'">S'+(i+1)+' · '+summary+'</option>';
  }).join('');
  const html='<div class="overlay" onclick="event.stopPropagation()"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Nouveau cycle</div>'
    +'<div style="font-size:13px;color:var(--text2);margin-bottom:4px">'+_h(cycle.name||'')+'</div>'
    +(startFmt?'<div style="font-size:11px;color:var(--text3);margin-bottom:16px">À partir du '+startFmt+'</div>':'')
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:6px">Ligne dans ce cycle</label>'
    +'<select id="lc-line" style="width:100%;height:44px;padding:0 12px;border:none;border-radius:12px;font-size:15px;background:var(--btn);color:var(--text);-webkit-appearance:none;appearance:none">'+lineOpts+'</select>'
    +'</div>'
    +(startDate?'<div style="font-size:11px;color:var(--text3);margin-bottom:16px;padding:10px 12px;background:var(--btn);border-radius:16px;line-height:1.4">Ce changement s’appliquera à partir du '+startFmt+'. Le planning actuel reste inchangé avant cette date.</div>':'')
    +'<button class="rc-btn" style="height:44px;font-size:15px;margin-bottom:8px" onclick="confirmLineChoice(\''+cycle.id+'\',\''+startDate+'\')">Confirmer</button>'
    +'<button class="mcancel" onclick="closeModal()">Plus tard</button>'
    +'</div></div>';
  document.getElementById('modal-root').innerHTML=html;
}

async function confirmLineChoice(cycleId,startDate){
  const li=document.getElementById('lc-line');
  if(!li)return;
  const lineIdx2=parseInt(li.value);
  const pid=_aid||'default';
  // Store in lineHistory if startDate provided
  if(startDate){
    if(!S.profile.lineHistory)S.profile.lineHistory=[];
    if(S.profile.origAnchor===undefined)S.profile.origAnchor=S.profile.anchorLine;
    // Calculate anchorLine so that lineIdx gives lineIdx2 at startDate week
    const startMonday=getMonday(new Date(startDate+'T12:00:00'));
    const _diffFrom=Math.round((startMonday-ANCHOR)/(7*864e5));
    const _Nlc=getCycleLen(new Date(startDate+'T12:00:00'));const newAnchor=((lineIdx2-_diffFrom)%_Nlc+_Nlc)%_Nlc;
    S.profile.lineHistory=S.profile.lineHistory.filter(function(h){return h.from<startDate;});
    S.profile.lineHistory.push({anchorLine:newAnchor,from:startDate});
    S.profile.lineHistory.sort(function(a,b){return a.from<b.from?-1:1;});
    S.profile.anchorLine=newAnchor;
  } else {
    // No date — apply immediately
    const _diffNow=Math.round((getMonday(NOW)-ANCHOR)/(7*864e5));
    const _Nlcn=getCycleLen(NOW);S.profile.anchorLine=((lineIdx2-_diffNow)%_Nlcn+_Nlcn)%_Nlcn;
  }
  saveState();
  try{
    await fetch(CLOUD_API+'/confirm-line-choice',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({cycleId:cycleId,profileId:pid,ligne:'S'+(lineIdx2+1)})});
  }catch(e){}
  closeModal();render();
}

async function gcalVerifyCalendar(){
  // If we have a stored calendarId, verify it still exists
  if(!gcalCalendarId||gcalCalendarId==='primary')return;
  const token=await gcalGetToken();if(!token)return;
  try{
    const res=await fetch(GCAL_FUNCTIONS+'/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'listCalendars',access_token:gcalTokens.access_token,refresh_token:gcalTokens.refresh_token})});
    const data=await res.json();
    const exists=(data.items||[]).find(function(c){return c.id===gcalCalendarId;});
    if(!exists){
      console.log('Calendar not found, resetting');
      gcalCalendarId='primary';
      localStorage.removeItem('gcal_calendar_id');
    }
  }catch(e){}
}

async function gcalEnsureCalendar(){
  const token = await gcalGetToken();
  if(!token) return;
  // List calendars to find existing "franceinfo"
  try {
    const res = await fetch(GCAL_FUNCTIONS+'/calendar',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'listCalendars',access_token:token,refresh_token:gcalTokens.refresh_token}),
    });
    const data = await res.json();
    if(data.newToken){gcalTokens.access_token=data.newToken;gcalSave();}
    const existing = (data.items||[]).find(c=>c.summary==='franceinfo');
    if(existing){
      gcalCalendarId = existing.id;
      localStorage.setItem('gcal_calendar_id', gcalCalendarId);
      return;
    }
    // Create dedicated calendar
    const res2 = await fetch(GCAL_FUNCTIONS+'/calendar',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        action:'createCalendar',
        access_token:gcalTokens.access_token,
        refresh_token:gcalTokens.refresh_token,
        event:{summary:'franceinfo',timeZone:'Europe/Paris'},
      }),
    });
    const cal2 = await res2.json();
    if(cal2.id){
      gcalCalendarId = cal2.id;
    } else {
      gcalCalendarId = 'primary';
    }
    localStorage.setItem('gcal_calendar_id', gcalCalendarId);
  } catch(e){ console.error('ensureCalendar error',e); }
}

async function gcalGetToken(){
  if(!gcalTokens)return null;
  if(Date.now()>gcalTokens.expiry-60000){
    // Refresh
    try{
      const res=await fetch(GCAL_FUNCTIONS+'/auth',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'refresh',refresh_token:gcalTokens.refresh_token}),
      });
      const data=await res.json();
      if(data.access_token){
        gcalTokens.access_token=data.access_token;
        gcalTokens.expiry=Date.now()+data.expires_in*1000;
        gcalSave();
      }else if(data.error){
        // invalid_grant : autorisation Google expirée ou révoquée
        window._gcalErr='Google : '+(data.error==='invalid_grant'?'autorisation expirée ou révoquée':(data.error_description||data.error));window._gcalReconnect=true;
        console.warn('[gcal] refresh failed',data);
      }
    }catch(e){console.error('refresh error',e);}
  }
  return gcalTokens.access_token;
}














async function gcalPollOnce(){
  if(!window._authToken||!gcalTokens)return;
  const wrap=document.getElementById('gcal-status-wrap');
  if(wrap&&wrap.classList.contains('gcal-syncing'))return;
  try{
    const res=await fetch(CLOUD_API+'/sync-status',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({action:'get'})});
    const data=await res.json();
    const ico=document.getElementById('gcal-status');
    if(data.status==='syncing'){
      if(!_pollFast){
        _pollFast=true;clearInterval(_pollTimer);
        _pollTimer=setInterval(gcalPollOnce,2000);
      }
      if(wrap&&!wrap.classList.contains('gcal-syncing')){
        wrap.classList.add('gcal-syncing');
        if(ico)ico.innerHTML=gSvg('#62aadc');
        gcalSetProgress(data.current,data.total);
      }
    } else {
      if(_pollFast){
        _pollFast=false;clearInterval(_pollTimer);
        _pollTimer=setInterval(gcalPollOnce,30000);
        if(wrap&&wrap.classList.contains('gcal-syncing')){
          wrap.classList.remove('gcal-syncing');
          gcalSetProgress(0,0);
          if(ico&&wrap){ico.innerHTML=gSvg('#34a853');wrap.classList.add('gcal-done-anim');setTimeout(function(){wrap.classList.remove('gcal-done-anim');gcalUpdateBtn();},2000);}
        }
      }
    }
  }catch(e){}
}

function gcalStartPoll(){
  clearInterval(_pollTimer);
  _pollFast=false;
  if(document.visibilityState!=='visible')return;
  _pollTimer=setInterval(gcalPollOnce,30000);
  gcalPollOnce();
}

async function gcalClear(asked){
  if(!gcalTokens){alert('Google Agenda non connecté.');return;}
  if(!asked&&!await _ask('Supprimer tous les événements du calendrier franceinfo ?',{ok:'Supprimer',del:1}))return;
  if(_syncAbort){_syncAbort.abort();_syncAbort=null;}
  clearTimeout(_syncTimer);_syncTimer=null;
  const token=await gcalGetToken();
  if(!token)return;
  if(!gcalCalendarId||gcalCalendarId==='primary')await gcalEnsureCalendar();
  if(S.profile)S.profile.gcalAutoSync=false;
  saveState();gcalUpdateBtn();
  const wrap=document.getElementById('gcal-status-wrap');
  const ico=document.getElementById('gcal-status');
  const circle=document.getElementById('gcal-progress-circle');
  const btn=document.getElementById('gcal-clear-btn');
  if(wrap){wrap.classList.add('gcal-clearing');}
  if(ico)ico.innerHTML=gSvg('#ea4335');
  if(btn)btn.innerHTML='<span style="font-size:10px;font-weight:600">...</span>';
  try{
    const res=await fetch(GCAL_FUNCTIONS+'/calendar',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'resetCalendar',access_token:gcalTokens.access_token,refresh_token:gcalTokens.refresh_token,calendarId:gcalCalendarId})});
    const data=await res.json();
    if(data.newToken)gcalTokens.access_token=data.newToken;
    if(data.id){gcalCalendarId=data.id;localStorage.setItem('gcal_calendar_id',gcalCalendarId);}
    else if(data.error)alert('Erreur: '+data.error);
  }catch(e){alert('Erreur: '+e.message);}
  if(circle){circle.style.stroke='transparent';circle.style.strokeDashoffset='81.68';}
  if(btn)btn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM3 6h18v2H3V6zm2 3h14l-1.5 12a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9L5 9z"/></svg>';
  if(wrap){wrap.classList.remove('gcal-syncing');wrap.classList.remove('gcal-clearing');}
  gcalUpdateBtn();
}

async function gcalDisconnect(){
  if(!await _ask('Déconnecter Google Agenda ?\n\nLes événements déjà dans l’agenda restent ; ils ne seront plus mis à jour.',{ok:'Déconnecter',del:1}))return;
  gcalTokens=null;
  if(S.profile)delete S.profile.gcalTokens;
  saveState();
  const pid=_aid||'default';
  
  
  gcalCalendarId='primary';
  gcalUpdateBtn();
}

(function(){
  var mr=document.getElementById('modal-root');
  if(!mr)return;
  new MutationObserver(function(){
    var sheet=mr.querySelector('.sheet');
    if(!sheet||sheet.querySelector('.sh-x'))return;
    var x=document.createElement('button');
    x.className='sh-x';
    x.innerHTML='<i class="ti ti-x"></i>';
    x.onclick=closeModal;
    var st=sheet.querySelector('.st');
    if(st){
      st.appendChild(x);
    } else {
      var hdr=document.createElement('div');
      hdr.className='sh-hdr';
      hdr.appendChild(x);
      var sh=sheet.querySelector('.sh');
      sheet.insertBefore(hdr,sh?sh.nextSibling:sheet.firstChild);
    }
  }).observe(mr,{childList:true});
})();


// ── En-tête sur téléphone : au premier appui sur chaque bouton, une bulle donne son nom (sur PC : au survol, par title).
// Sirhius et Demande ouvrent une autre app : ce premier appui affiche seulement le nom, le suivant ouvre.
(function(){
  if(!(window.matchMedia&&matchMedia('(hover:none)').matches))return;
  var seen={};try{seen=JSON.parse(localStorage.getItem('pl_tips')||'{}');}catch(e){}
  var bub=null,bT=0;
  function show(el,txt){if(!bub){bub=document.createElement('div');bub.id='tip-bub';document.body.appendChild(bub);}
    bub.textContent=txt;var r=el.getBoundingClientRect();bub.classList.remove('on');bub.style.left='0px';bub.style.top='0px';
    var w=bub.offsetWidth;bub.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.left+r.width/2-w/2))+'px';bub.style.top=(r.bottom+8)+'px';
    requestAnimationFrame(function(){bub.classList.add('on');});clearTimeout(bT);bT=setTimeout(function(){bub.classList.remove('on');},2200);}
  document.addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('[data-tip]');if(!el)return;
    var k=el.id||el.getAttribute('title')||'';if(seen[k])return;seen[k]=1;try{localStorage.setItem('pl_tips',JSON.stringify(seen));}catch(x){}
    show(el,el.getAttribute('data-tip')+(el.getAttribute('data-ext')?' · appuyer de nouveau pour ouvrir':''));
    if(el.getAttribute('data-ext')){e.stopPropagation();e.preventDefault();}},true);
})();

// ── PC : clavier (← → changent de mois, Échap ferme), pavé tactile (glissé à deux doigts) et souris (glisser le calendrier) ──
(function(){
  function busy(){return !!(document.querySelector('#modal-root .overlay')||document.getElementById('lp-menu')||document.getElementById('setup'));}
  function typing(e){var t=e.target;return t&&(t.isContentEditable||/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName));}
  document.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey||typing(e))return;
    if(e.key==='Escape'){if(document.getElementById('lp-menu')){_closeDayMenu();e.preventDefault();}else if(document.querySelector('#modal-root .overlay')){closeModal();e.preventDefault();}return;}
    if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!busy()){e.preventDefault();navDir(e.key==='ArrowLeft'?-1:1);}
  });
  // Glissé horizontal à deux doigts : un mois par geste (le geste se termine quand les événements s'arrêtent)
  var acc=0,fired=false,wT=0;
  document.addEventListener('wheel',function(e){
    if(busy()||Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;
    var cal=document.getElementById('month-view'),ann=document.getElementById('ann-wrap');
    if(!((cal&&cal.contains(e.target))||(ann&&ann.contains(e.target))))return;
    e.preventDefault();clearTimeout(wT);wT=setTimeout(function(){acc=0;fired=false;},180);
    if(fired)return;acc+=e.deltaX;if(Math.abs(acc)>50){fired=true;navDir(acc>0?1:-1);}
  },{passive:false});
  // Souris : glisser le calendrier vers la gauche ou la droite (le clic qui termine le glissé n'ouvre pas le jour)
  var x0=null,y0=0,moved=false,eat=false;
  document.addEventListener('pointerdown',function(e){
    if(e.pointerType!=='mouse'||e.button!==0||busy())return;
    var cal=document.getElementById('month-view'),ann=document.getElementById('ann-wrap');
    if(!((cal&&cal.contains(e.target))||(ann&&ann.contains(e.target))))return;
    x0=e.clientX;y0=e.clientY;moved=false;
  });
  document.addEventListener('pointermove',function(e){
    if(x0===null||e.pointerType!=='mouse')return;
    var dx=e.clientX-x0;if(!moved&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(e.clientY-y0)*1.5){moved=true;eat=true;navDir(dx<0?1:-1);}
  });
  document.addEventListener('pointerup',function(){x0=null;setTimeout(function(){eat=false;},0);});
  document.addEventListener('click',function(e){if(eat){eat=false;e.stopPropagation();e.preventDefault();}},true);
})();
