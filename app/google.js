// app_google.js v4.08

var gcalTokens=null;

function gSvg(c){return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="'+c+'"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="'+c+'"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="'+c+'"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="'+c+'"/></svg>';}
function gcalHandleClick(){
  if(!gcalTokens){gcalConnect();return;}
  // Set G blue for manual sync
  const ico=document.getElementById('gcal-status');
  if(ico)ico.innerHTML=gSvg('#4ea0f7');
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
  // If enabling auto-sync, trigger a full sync
  if(cur===false&&gcalTokens)gcalTriggerSync();
}

// ============================================================
// CLOUD SYNC
// ============================================================
function cloudHeaders(){return{'Content-Type':'application/json','Authorization':'Bearer '+(window._authToken||'')};}

async function cloudSave(pid){
  if(!window._authToken)return;
  try{
    await fetch(CLOUD_API+'/data/save',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:pid,data:_profs[pid]})});
  }catch(e){console.warn('cloud save error',e);}
}

async function cloudLoad(pid){
  if(!window._authToken)return null;
  try{
    const res=await fetch(CLOUD_API+'/data/load',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:pid})});
    if(!res.ok)return null;
    const text=await res.text();
    if(!text||text.trim()==='')return null;
    const data=JSON.parse(text);
    return data.data||null;
  }catch(e){console.warn('cloud load error',e);return null;}
}

async function cloudLoadAll(){
  if(!window._authToken){gcalLoad();return;}
  try{
    const res=await fetch(CLOUD_API+'/data/list',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({})});
    if(!res.ok){gcalLoad();return;}
    const text=await res.text();
    if(!text||text.trim()===''){gcalLoad();return;}
    const data=JSON.parse(text);
    const profiles=data.profiles||{};
    if(Object.keys(profiles).length===0){
      // New account - no data in KV yet
      // Use profile from localStorage (set by login registration) if available
      const localState=localStorage.getItem('pl_v8');
      if(localState){
        try{
          const parsed=JSON.parse(localState);
          if(parsed.p&&Object.keys(parsed.p).length>0){
            _profs=parsed.p;_aid=parsed.a||'default';
            S=_profs[_aid]||_profs[Object.keys(_profs)[0]];
            if(window._authUser&&window._authUser.name&&S.profile)S.profile.name=capitalize(window._authUser.name);
            // Push initial profile to cloud
            cloudSave(_aid);
            saveState();
            gcalLoad();checkPendingLineChoice();return;
          }
        }catch(e){}
      }
      // Fallback to DEFAULT_PD
      _profs={default:DEFAULT_PD()};
      _aid='default';
      S=_profs['default'];
      if(window._authUser&&window._authUser.name)S.profile.name=capitalize(window._authUser.name);
    } else {
      for(const pid of Object.keys(profiles)){
        const cloudData=await cloudLoad(pid);
        if(cloudData){_profs[pid]=cloudData;} // KV always wins
      }
      // Update active profile S from loaded data
      if(_profs[_aid]){S=_profs[_aid];}
      else{_aid=Object.keys(_profs)[0];S=_profs[_aid];}
    }
    saveState();
  }catch(e){console.warn('cloud load all error',e);}
  gcalLoad();
  checkPendingLineChoice();
  // Check if startup sync needed (>2h since last)
  setTimeout(function(){gcalCheckStartupSync();},3000);
  // Background sync on page close
  window.addEventListener('beforeunload',function(){
    if(gcalTokens)gcalSyncBackground();
  });
  // Also sync on visibility change (mobile: app goes to background)
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden'&&gcalTokens)gcalSyncBackground();
  });
}

function deleteCurrentProfile(){
  const pid=_aid||Object.keys(_profs)[0];
  if(!pid)return;
  const name=(S.profile&&S.profile.profile&&S.profile.profile.name)||'ce profil';
  if(!confirm('Supprimer "'+name+'" ? Cette action est irréversible.'))return;
  // Delete from cloud
  if(window._authToken){
    fetch(CLOUD_API+'/data/deleteProfile',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:pid})}).catch(function(){});
  }
  // Delete locally
  delete _profs[pid];
  // Switch to another profile
  const remaining=Object.keys(_profs);
  if(remaining.length>0){
    _aid=remaining[0];S=_profs[_aid];
  } else {
    // No profiles left - create default
    _profs['default']=defaultState();
    _aid='default';S=_profs['default'];
  }
  localStorage.setItem(LS_KEY,JSON.stringify({active:_aid,profiles:_profs}));
  closeDropdowns();render();renderProfilesDropdown();
}

function signOut(){
  fetch(CLOUD_API+'/auth/logout',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({})}).catch(()=>{});
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  window.location.href='/planning/';
}

var _syncWknTimer=null;
function syncWknHeight(){
  clearTimeout(_syncWknTimer);
  _syncWknTimer=setTimeout(function(){
    const dayCell=document.querySelector('.dc');
    if(!dayCell)return;
    const h=dayCell.getBoundingClientRect().height;
    if(!h||h<10)return;
    document.querySelectorAll('td.wkn').forEach(function(td){
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
      else if(tr&&tr.classList.contains('cgweek'))cellBg='rgba(90,158,63,.07)';
      td.style.position='relative';
      td.style.padding='0';
      td.style.background=cellBg;
      td.innerHTML='<div style="position:absolute;top:50%;left:0;transform:translateY(-50%);width:calc(100% - 4px);height:'+h+'px;display:flex;align-items:center;justify-content:center;font-size:9px;border-radius:0 var(--r) var(--r) 0;background:'+bg+';color:'+color+';font-weight:'+fw+';z-index:1;box-sizing:border-box">'+num+'</div>';
    });
  },100);
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
    history.replaceState({},'','/planning/app/');
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
  circle.style.stroke='#4ea0f7';
  circle.style.strokeDashoffset=circ*(1-done/total);
}

function gcalUpdateBtn(){
  // Don't reset icon if sync/clear is running
  const _wrap=document.getElementById('gcal-status-wrap');
  if(_wrap&&(_wrap.classList.contains('gcal-syncing')||_wrap.classList.contains('gcal-clearing')))return;
  // Header status icon: Google G with color state
  const ico=document.getElementById('gcal-status');
  if(ico){
    const _autoSync=S.profile&&S.profile.gcalAutoSync!==false;
    const color=gcalTokens?(_autoSync?'#34a853':'#f0a030'):gcalTokens===false?'#ea4335':'#888';
    ico.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="'+color+'"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="'+color+'"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="'+color+'"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="'+color+'"/></svg>';
    ico.title=gcalTokens?'Google Agenda connecté':'Google Agenda non connecté';
  }
  // Buttons in ps-panel (rebuilt by renderProfilesDropdown, just update text)
  const btn=document.getElementById('gcal-btn');
  const connRow=document.getElementById('gcal-connected-btns');
  const autoSync=S.profile&&S.profile.gcalAutoSync!==false;
  // Show connect button or icon buttons
  if(btn){btn.style.display=gcalTokens?'none':'';btn.textContent='Connecter à Google Agenda';}
  if(connRow)connRow.style.display=gcalTokens?'grid':'none';
  // Reset circle to transparent (fix stuck red circle bug)
  const _circle=document.getElementById('gcal-progress-circle');
  if(_circle&&!document.getElementById('gcal-status-wrap').classList.contains('gcal-syncing')&&!document.getElementById('gcal-status-wrap').classList.contains('gcal-clearing')){
    _circle.style.stroke='transparent';_circle.style.strokeDashoffset='81.68';
  }
  const autoSyncBtn=document.getElementById('gcal-autosync-btn');
  if(autoSyncBtn){
    autoSyncBtn.style.background=autoSync?'var(--blue)':'';
    autoSyncBtn.style.color=autoSync?'#fff':'var(--text2)';
    autoSyncBtn.style.boxShadow=autoSync?'inset 0 2px 4px rgba(0,0,0,.2)':'';
    autoSyncBtn.title=autoSync?'Sync auto activée':'Sync auto désactivée';
  }
}

function gcalConnect(){
  const url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({
    client_id:GCAL_CLIENT_ID,
    redirect_uri:GCAL_REDIRECT_URI,
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
      body:JSON.stringify({action:'exchange',code}),
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

function gcalClearDateId(dateKey){gcalQueueDelete(dateKey);}


// ============================================================
// GCAL AUTO SYNC — debounced 2s
// Toute modification déclenche une sync complète après 2s d'inactivité
// ============================================================
var _gcalSyncTimer=null;
var _gcalAbortController=null;
var _gcalPendingDates=new Set();

function gcalQueueDate(dateKey){
  if(!gcalTokens||S.profile&&S.profile.gcalAutoSync===false)return;
  _gcalPendingDates.add(dateKey);
  gcalTriggerTargeted();
}

function gcalQueueDelete(dateKey){
  if(!gcalTokens||S.profile&&S.profile.gcalAutoSync===false)return;
  const pid=window._aid||'default';
  const stored=JSON.parse(localStorage.getItem('gcal_event_ids_'+pid)||'{}');
  delete stored[dateKey];
  localStorage.setItem('gcal_event_ids_'+pid,JSON.stringify(stored));
  _gcalPendingDates.add(dateKey);
  gcalTriggerTargeted();
}

function gcalTriggerTargeted(){
  const wrap=document.getElementById('gcal-status-wrap');
  if(wrap)wrap.classList.add('gcal-pending');
  // Only abort if timer not already pending (avoid loop)
  if(_gcalAbortController&&!_gcalSyncTimer){_gcalAbortController.abort();_gcalAbortController=null;}
  clearTimeout(_gcalSyncTimer);
  _gcalSyncTimer=setTimeout(function(){
    _gcalSyncTimer=null;
    gcalSyncTargeted();
  },1000);
}

function gcalTriggerSync(){
  if(!gcalTokens)return;
  if(S.profile&&S.profile.gcalAutoSync===false)return;
  const wrap=document.getElementById('gcal-status-wrap');
  if(wrap)wrap.classList.add('gcal-pending');
  if(_gcalAbortController){_gcalAbortController.abort();_gcalAbortController=null;}
  clearTimeout(_gcalSyncTimer);
  _gcalSyncTimer=setTimeout(gcalSync,1000);
}

async function gcalSyncTargeted(){
  const dates=[..._gcalPendingDates];
  _gcalPendingDates.clear();
  if(!dates.length||!gcalTokens)return;
  const ac=new AbortController();_gcalAbortController=ac;
  const wrap=document.getElementById('gcal-status-wrap');
  if(wrap){wrap.classList.remove('gcal-pending');wrap.classList.add('gcal-syncing');}
  // Set G to blue during sync
  const _ico=document.getElementById('gcal-status');
  function _gsvg(c){return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="'+c+'"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="'+c+'"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="'+c+'"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="'+c+'"/></svg>';}
  if(_ico)_ico.innerHTML=_gsvg('#4ea0f7');
  const token=await gcalGetToken();
  if(!token){if(wrap)wrap.classList.remove('gcal-syncing');return;}
  await gcalEnsureCalendar();
  const _pid=window._aid||'default';
  function stableId(k){return 'plan'+_pid.replace(/[^a-z0-9]/gi,'').toLowerCase().slice(0,10)+k.replace(/-/g,'');}
  const batch=dates.map(function(k){
    const ev=gcalBuildDayEvent(k);
    if(!ev){
      // Only delete if we have a stored ID (event was actually created)
      return null; // no vacation, nothing to do
    }
    return{id:k,googleEventId:stableId(k),event:ev,stable:true};
  }).filter(Boolean);
  try{
    gcalSetProgress(0,batch.length);
    for(let i=0;i<batch.length;i++){
      if(ac.signal.aborted)return;
      const res=await fetch(GCAL_FUNCTIONS+'/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'batchSync',access_token:gcalTokens.access_token,refresh_token:gcalTokens.refresh_token,calendarId:gcalCalendarId,events:[batch[i]]}),signal:ac.signal});
      const data=await res.json();
      if(data.newToken){gcalTokens.access_token=data.newToken;gcalSave();}
      gcalSetProgress(i+1,batch.length);
    }
    gcalSetProgress(0,0);
    if(wrap)wrap.classList.remove('gcal-syncing');
    // Done animation
    const ico=document.getElementById('gcal-status');
    if(ico&&wrap){

      ico.innerHTML=gsvg('#34a853');
      wrap.classList.add('gcal-done-anim');
      setTimeout(function(){wrap.classList.remove('gcal-done-anim');gcalUpdateBtn();},2000);
    }
    _gcalAbortController=null;
  }catch(e){
    if(wrap)wrap.classList.remove('gcal-syncing');
    _gcalAbortController=null;
    if(e&&e.name!=='AbortError')console.error('targeted sync error',e);
    gcalSetProgress(0,0);
  }
  // Resume interrupted full sync if any
  const _resume=localStorage.getItem('gcal_sync_resume');
  if(_resume){
    try{
      const _r=JSON.parse(_resume);
      if(Date.now()-_r.ts<10*60*1000){
        setTimeout(function(){gcalSync(_r.chunkIndex);},500);
      } else {
        localStorage.removeItem('gcal_sync_resume');
      }
    }catch(e){}
  }
}

async function checkPendingLineChoice(){
  if(!window._authToken)return;
  try{
    const res=await fetch(CLOUD_API+'/pending-line-choice',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({})});
    if(!res.ok)return;
    const text=await res.text();
    if(!text||text.trim()==='')return;
    const data=JSON.parse(text);
    if(!data.pending||!data.pending.length)return;
    // Show modal for first pending cycle
    showLineChoiceModal(data.pending[0]);
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
    return '<option value="'+i+'">'+summary+'</option>';
  }).join('');
  const html='<div class="overlay" onclick="event.stopPropagation()"><div class="sheet">'
    +'<div class="sh"></div>'
    +'<div class="st">Nouveau cycle</div>'
    +'<div style="font-size:13px;color:var(--text2);margin-bottom:4px">'+cycle.name+'</div>'
    +(startFmt?'<div style="font-size:11px;color:var(--text3);margin-bottom:16px">À partir du '+startFmt+'</div>':'')
    +'<div style="margin-bottom:12px">'
    +'<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:6px">Votre ligne dans ce cycle</label>'
    +'<select id="lc-line" style="width:100%;height:44px;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--bg2);color:var(--text);-webkit-appearance:none">'+lineOpts+'</select>'
    +'</div>'
    +(startDate?'<div style="font-size:11px;color:var(--text3);margin-bottom:16px;padding:8px;background:var(--bg3);border-radius:var(--r)">Ce changement s\'appliquera à partir du '+startFmt+'. Votre planning actuel reste inchangé avant cette date.</div>':'')
    +'<button class="mb wide" style="background:var(--blue);color:#fff;margin-bottom:8px" onclick="confirmLineChoice(\''+cycle.id+'\',\''+startDate+'\')">Confirmer</button>'
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
  // List calendars to find existing "Planning France Info"
  try {
    const res = await fetch(GCAL_FUNCTIONS+'/calendar',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'listCalendars',access_token:token,refresh_token:gcalTokens.refresh_token}),
    });
    const data = await res.json();
    if(data.newToken){gcalTokens.access_token=data.newToken;gcalSave();}
    const existing = (data.items||[]).find(c=>c.summary==='Planning France Info');
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
        event:{summary:'Planning France Info',timeZone:'Europe/Paris'},
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
      }
    }catch(e){console.error('refresh error',e);}
  }
  return gcalTokens.access_token;
}



// Color IDs for Google Calendar
var GCAL_VAC_COLORS={
  'A1':'7','A2':'7','A3':'7','B1':'7','C1':'7','C2':'7','D1':'7','D2':'7','P423':'7',
  'As1':'5','As2':'5','As3':'5','Ad1':'5','Ad2':'5','Ad3':'5',
  'Cs':'5','Cd':'5','Es':'5','Ed':'5','Fs':'5','Fd':'5',
  'RH':'8',
};

var GCAL_VAC_TIMES={
  'A1':['03:45','10:45'],
  'A2':['03:45','11:45'],
  'A3':['04:45','12:45'],
  'As1':['04:45','11:45'],
  'As2':['04:45','12:45'],
  'As3':['05:45','14:15'],
  'Ad1':['04:45','11:45'],
  'Ad2':['04:45','12:45'],
  'Ad3':['05:45','14:15'],
  'B1':['07:45','15:15'],
  'C1':['12:15','21:15'],
  'C2':['13:15','21:15'],
  'Cs':['11:15','20:15'],
  'Cd':['11:15','20:15'],
  'D1':['15:45','00:30'],
  'D2':['15:45','00:15'],
  'Fs':['15:45','00:15'],
  'Fd':['15:45','00:15'],
  'Es':['14:45','00:30'],
  'Ed':['14:45','00:30'],
  'P423':['09:45','18:15'],
  'M':['08:00','19:00'],
  'S':['13:30','00:30'],
  'SR':['11:45','21:15'],
  'SC':['12:45','21:15'],
  'MR':['05:45','13:45'],
  'MC':['07:30','17:30'],
  'B2V':['07:45','16:15'],
  'P422V':['07:45','17:15'],
  'C3V':['11:15','21:15'],
  'BsV':['07:15','15:45'],
  'BdV':['07:15','15:45'],
  'Ds':['13:15','21:15'],
  'Dd':['12:15','21:15'],
};

function gcalBuildDayEvent(dateKey){
  const d=new Date(dateKey+'T12:00:00');
  const v2=getVac(d);
  const congesType=(S.conges||{})[dateKey];
  const vac=v2.vac||'';
  let summary,colorId,description='';

  if(congesType==='cg'){
    summary=(vac&&vac!=='RH'?vac+' ':'')+'Conge';
    colorId='2';
  } else if(congesType==='rend'){
    const dur=getDur(d);
    summary=(vac&&vac!=='RH'?vac+' ':'')+'Rendu';
    colorId='11';
    description='Rendu ephemere - '+fmtMin(dur);
  } else if(congesType==='absent'){
    summary=(vac&&vac!=='RH'?vac+' ':'')+'Absent';
    colorId='8';
  } else if(!vac||vac==='RH'){
    return null;
  } else {
    const dur=getDur(d);
    const panier=isPanier(d)?' - panier':'';
    if(v2.echange&&!v2.ecSelf){summary=vac+' (donne)';colorId='8';}
    else if(v2.echange&&v2.ecSelf){summary=vac+' (echange)';colorId='3';}
    else if(v2.ov&&!v2.fromSV){summary=vac+' *';colorId='9';}
    else{summary=vac;colorId='7';}
    description=fmtMin(dur)+panier;
  }

  const tz='Europe/Paris';
  function makeDateTime(base,hhmm){
    const arr=hhmm.split(':');
    const dt=new Date(base);dt.setHours(parseInt(arr[0]),parseInt(arr[1]),0,0);return dt;
  }
  let vacStart=null,vacEnd=null;
  const customVac=S.customVacs&&S.customVacs[vac];
  if(customVac&&customVac.debut&&customVac.fin){
    const ph=function(str){const m2=str.match(/(\d+)h(\d*)/);return m2?parseInt(m2[1])+':'+('0'+(m2[2]||0)).slice(-2):null;};
    vacStart=ph(customVac.debut);vacEnd=ph(customVac.fin);
  } else {
    const vsd=VAC_STD[vac];
    if(vsd&&vsd.deb&&vsd.fin){
      const ph=function(str){const m2=str.match(/(\d+)h(\d*)/);return m2?parseInt(m2[1])+':'+('0'+(m2[2]||0)).slice(-2):null;};
      vacStart=ph(vsd.deb);vacEnd=ph(vsd.fin);
    }
  }
  let startObj,endObj;
  if(vacStart&&vacEnd){
    const startDt=makeDateTime(d,vacStart);
    const endDt=makeDateTime(d,vacEnd);
    if(endDt<=startDt)endDt.setDate(endDt.getDate()+1);
    const fmt=function(dt){return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')+'T'+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0')+':00';};
    startObj={dateTime:fmt(startDt),timeZone:tz};
    endObj={dateTime:fmt(endDt),timeZone:tz};
  } else {
    startObj={date:dateKey};endObj={date:dateKey};
  }
  return{summary,description,start:startObj,end:endObj,colorId,extendedProperties:{private:{planningKey:dateKey,planningProfile:(S.profile&&S.profile.name)||'',planningType:congesType||vac}}};
}

async function gcalSync(resumeFromChunk){
  if(_gcalAbortController){_gcalAbortController.abort();_gcalAbortController=null;}
  _gcalAbortController=new AbortController();
  const signal=_gcalAbortController.signal;
  const wrap=document.getElementById('gcal-status-wrap');
  const ico=document.getElementById('gcal-status');
  if(wrap){wrap.classList.remove('gcal-pending');wrap.classList.add('gcal-syncing');}
  if(ico)ico.innerHTML=gSvg('#4ea0f7');

  const token=await gcalGetToken();
  if(!token){if(wrap)wrap.classList.remove('gcal-syncing');_gcalAbortController=null;return;}
  await gcalEnsureCalendar();
  if(signal.aborted){_gcalAbortController=null;return;}

  // Build full batch
  const batch=gcalBuildFullBatch();
  const chunkSize=35; // stay under 50 subrequest limit (35 events + overhead)
  const totalChunks=Math.ceil(batch.length/chunkSize);
  const startChunk=resumeFromChunk||0;
  const startDate=batch[0]&&batch[0].id;
  const endDate=batch[batch.length-1]&&batch[batch.length-1].id;

  // Set initial progress (resume point)
  gcalSetProgress(startChunk,totalChunks);
  const btn=document.getElementById('gcal-btn');
  const _syncPct=Math.round(startChunk/totalChunks*100);
  if(btn)btn.innerHTML='<span style="font-size:9px;font-weight:600">'+_syncPct+'%</span>';

  try{
    for(let ci=startChunk;ci<totalChunks;ci++){
      if(signal.aborted){
        // Store progress so we can resume
        localStorage.setItem('gcal_sync_resume',JSON.stringify({chunkIndex:ci,totalChunks,startDate,endDate,ts:Date.now()}));
        _gcalAbortController=null;
        if(wrap)wrap.classList.remove('gcal-syncing');
        return;
      }
      const chunk=batch.slice(ci*chunkSize,(ci+1)*chunkSize);
      const res=await fetch(CLOUD_API+'/gcal/sync-chunk',{
        method:'POST',
        headers:cloudHeaders(),
        body:JSON.stringify({
          profileId:_aid||'default',
          events:chunk,
          chunkIndex:ci,
          totalChunks,
          startDate,
          endDate
        }),
        signal
      });
      if(!res.ok){console.warn('sync-chunk error',res.status);continue;}
      const data=await res.json();
      gcalSetProgress(ci+1,totalChunks);
      const _pct=Math.round((ci+1)/totalChunks*100);
      if(btn)btn.innerHTML='<span style="font-size:9px;font-weight:600">'+_pct+'%</span>';
    }
    // Done
    localStorage.removeItem('gcal_sync_resume');
    gcalSetProgress(0,0);
    if(wrap)wrap.classList.remove('gcal-syncing');
    // Done animation
    if(ico&&wrap){
      ico.innerHTML=gSvg('#34a853');
      wrap.classList.add('gcal-done-anim');
      setTimeout(function(){wrap.classList.remove('gcal-done-anim');gcalUpdateBtn();},2000);
    }
    if(btn){btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 12A10 10 0 0 1 18.5 5.5l3 2.5"/><path d="M2.5 22v-6h6"/><path d="M21.5 12A10 10 0 0 1 5.5 18.5l-3-2.5"/></svg>';btn.style.color='var(--green)';}
  }catch(e){
    const _w=document.getElementById('gcal-status-wrap');
    if(_w)_w.classList.remove('gcal-syncing');
    if(e&&e.name==='AbortError'){
      // Store resume point
      gcalSetProgress(0,0);
    }else{
      console.error('sync error',e);
      if(btn){btn.textContent='↔ Erreur';btn.style.color='var(--rendu-red-text)';}
    }
  }
  _gcalAbortController=null;
  const _wd=document.getElementById('gcal-status-wrap');if(_wd)_wd.classList.remove('gcal-syncing');
}

async function gcalClear(){
  if(!gcalTokens){alert('Google Agenda non connecté.');return;}
  if(!confirm('Supprimer tous les événements du calendrier Planning France Info ?'))return;
  // Cancel any running sync first
  if(_gcalAbortController){_gcalAbortController.abort();_gcalAbortController=null;}
  clearTimeout(_gcalSyncTimer);_gcalSyncTimer=null;
  localStorage.removeItem('gcal_sync_resume'); // clear resume point
  const token=await gcalGetToken();
  if(!token)return;
  // Disable auto-sync during clear
  if(S.profile)S.profile.gcalAutoSync=false;
  saveState();gcalUpdateBtn();
  const wrap=document.getElementById('gcal-status-wrap');
  const ico=document.getElementById('gcal-status');
  const circle=document.getElementById('gcal-progress-circle');
  const btn=document.getElementById('gcal-clear-btn');
  if(wrap){wrap.classList.add('gcal-syncing');wrap.classList.add('gcal-clearing');}
  if(ico)ico.innerHTML=gSvg('#4ea0f7');
  if(circle){circle.style.stroke='#ea4335';circle.style.strokeDashoffset='0';}
  if(btn)btn.innerHTML='<span style="font-size:10px;font-weight:600">0%</span>';
  try{
    // Step 1: count total events
    if(btn)btn.innerHTML='<span style="font-size:9px;font-weight:600">0%</span>';
    let totalEvents=0;
    try{
      const cntRes=await fetch(GCAL_FUNCTIONS+'/calendar',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'countEvents',access_token:gcalTokens.access_token,refresh_token:gcalTokens.refresh_token,calendarId:gcalCalendarId}),
      });
      const cntData=await cntRes.json();
      if(cntData.newToken)gcalTokens.access_token=cntData.newToken;
      totalEvents=cntData.total||0;
    }catch(e){}
    // Step 2: delete in batches
    let pageToken=null;let totalDeleted=0;
    do{
      const res=await fetch(GCAL_FUNCTIONS+'/calendar',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'clearAll',access_token:gcalTokens.access_token,refresh_token:gcalTokens.refresh_token,calendarId:gcalCalendarId,pageToken:pageToken}),
      });
      const data=await res.json();
      if(data.newToken)gcalTokens.access_token=data.newToken;
      totalDeleted+=(data.deleted||0);
      // Show percentage
      const pct=totalEvents>0?Math.round(totalDeleted/totalEvents*100):totalDeleted;
      if(btn)btn.innerHTML='<span style="font-size:9px;font-weight:600">'+(totalEvents>0?pct+'%':'-'+totalDeleted)+'</span>';
      // Update circle progress
      if(circle&&totalEvents>0){circle.style.stroke='#ea4335';circle.style.strokeDashoffset=81.68*(1-pct/100);}
      pageToken=data.nextPageToken||null;
    }while(pageToken);
  }catch(e){alert('Erreur: '+e.message);}
  if(circle){circle.style.stroke='transparent';circle.style.strokeDashoffset='81.68';}
  if(btn)btn.innerHTML='<span style="font-size:10px;font-weight:600">100%</span>';
  setTimeout(function(){
    if(btn)btn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM3 6h18v2H3V6zm2 3h14l-1.5 12a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9L5 9z"/></svg>';
  },1000);
  if(wrap){wrap.classList.remove('gcal-syncing');wrap.classList.remove('gcal-clearing');}
  gcalUpdateBtn();
}

// ============================================================
// BACKGROUND SYNC
// ============================================================
function gcalBuildFullBatch(){
  const _pid=_aid||'default';
  function stableId(k){return 'plan'+_pid.replace(/[^a-z0-9]/gi,'').toLowerCase().slice(0,10)+k.replace(/-/g,'');}
  const startD=new Date();startD.setDate(startD.getDate()-30);
  const endD=new Date();endD.setMonth(endD.getMonth()+12);
  const batch=[];
  const cur=new Date(startD);
  while(cur<=endD){
    const key=dk(cur);
    const ev=gcalBuildDayEvent(key);
    if(ev){
      batch.push({id:key,googleEventId:stableId(key),event:ev,stable:true});
    } else {
      // Always try to delete - soft=true so 404 is ignored
      batch.push({id:key,googleEventId:stableId(key),_delete:true,soft:true});
    }
    cur.setDate(cur.getDate()+1);
  }
  return batch;
}

async function gcalSyncBackground(){
  if(!gcalTokens||!window._authToken)return;
  if(S.profile&&S.profile.gcalAutoSync===false)return;
  const pid=_aid||'default';
  const events=gcalBuildFullBatch();
  if(!events.length)return;
  // Save tokens to KV first
  await cloudSave(pid);
  // Send sync request to worker (fire and forget)
  try{
    // sendBeacon doesn't support custom headers, use keepalive fetch
    throw new Error('use keepalive');
  }catch(e){
    // Fallback: keepalive fetch
    fetch(CLOUD_API+'/gcal/sync-background',{
      method:'POST',
      headers:cloudHeaders(),
      body:JSON.stringify({profileId:pid,events:events}),
      keepalive:true
    }).catch(function(){});
  }
  // Mark last sync time locally
  localStorage.setItem('gcal_last_bg_sync',Date.now().toString());
}

async function gcalCheckStartupSync(){
  if(!gcalTokens||!window._authToken)return;
  if(S.profile&&S.profile.gcalAutoSync===false)return;
  try{
    // Check for local resume point first
    const resumeRaw=localStorage.getItem('gcal_sync_resume');
    if(resumeRaw){
      const resume=JSON.parse(resumeRaw);
      // Resume if interrupted less than 10 minutes ago
      if(Date.now()-resume.ts<10*60*1000){
        console.log('Resuming sync from chunk',resume.chunkIndex,'/',resume.totalChunks);
        // Set circle to show progress from resume point
        gcalSetProgress(resume.chunkIndex,resume.totalChunks);
        setTimeout(function(){gcalSync(resume.chunkIndex);},2000);
        return;
      }
      localStorage.removeItem('gcal_sync_resume');
    }
    // Check server for last sync time + progress
    const res=await fetch(CLOUD_API+'/gcal/last-sync',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:_aid||'default'})});
    const data=await res.json();
    // If server has unfinished progress, resume from there
    if(data.syncProgress&&data.syncProgress.chunkIndex<data.syncProgress.totalChunks-1){
      const ci=data.syncProgress.chunkIndex+1;
      console.log('Resuming server sync from chunk',ci);
      gcalSetProgress(ci,data.syncProgress.totalChunks);
      setTimeout(function(){gcalSync(ci);},2000);
      return;
    }
    // Full sync if >2h
    const lastSync=data.lastSync||0;
    if(Date.now()-lastSync>2*60*60*1000){
      console.log('Last sync >2h, triggering full sync');
      setTimeout(function(){gcalSync(0);},3000);
    }
  }catch(e){console.warn('startup sync check error',e);}
}

function gcalDisconnect(){
  gcalTokens=null;
  if(S.profile)delete S.profile.gcalTokens;
  saveState();
  const pid=_aid||'default';
  
  
  gcalCalendarId='primary';
  gcalUpdateBtn();
}

