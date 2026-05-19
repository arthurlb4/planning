// app_init.js v4.08

function init(){
  // Detect touch device and disable hover effects
  if('ontouchstart' in window){
    document.documentElement.classList.add('touch');
    // Kill sticky hover on mobile by blurring after touchend
    document.addEventListener('touchend', function(e){
      const el = e.target;
      if(el && el.blur) setTimeout(function(){ el.blur(); }, 0);
      // Move focus to body to clear hover state
      setTimeout(function(){
        const t=document.createElement('button');
        t.style.cssText='position:fixed;opacity:0;pointer-events:none;top:0;left:0';
        document.body.appendChild(t);t.focus();document.body.removeChild(t);
      }, 100);
    }, {passive:true});
  }
  // Auth check
  const authToken=localStorage.getItem('auth_token');
  const authUser=JSON.parse(localStorage.getItem('auth_user')||'null');
  if(!authToken||!authUser){window.location.replace('/planning/');return;}
  window._authToken=authToken;
  window._authUser=authUser;
  // Show user name in header if needed
  loadState();applyTheme();
  // Load cycle override from server if available
  fetch(CLOUD_API+'/get-cycle',{method:'POST',headers:cloudHeaders(),body:'{}'})
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
    fetch(CLOUD_API+'/get-cycle',{method:'POST',headers:cloudHeaders(),body:'{}'}).then(function(r){return r.json();})
  ]).then(function(results){
    const vd=results[0],cd=results[1];
    if(vd&&vd.vacations)_globalVacs=vd.vacations;
    if(cd&&cd.cycles)_globalCycles=cd.cycles;
    render();
  }).catch(function(){});
  document.body.style.opacity='1';document.body.style.transition='opacity .2s';setTimeout(function(){document.body.style.transition='';},300);
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(isIOS&&!window.navigator.standalone)document.getElementById('pwa-banner').style.display='flex';
  updateUrBtns();
  // Load from cloud FIRST, then render (KV is source of truth)
  cloudLoadAll().then(function(){    
    _appReady=true;
    render();
    const hpn=document.getElementById('hdr-profile-name');
    if(hpn&&S&&S.profile)hpn.textContent=S.profile.name||'Profil';
  });
  // Scroll to navigate months/years

  // Sticky header: show on scroll up
  let _lastScrollY=0;
  

  // Swipe left/right to change month on calendar
  let _swipeStartX=0,_swipeStartY=0,_swipeActive=false;
  document.addEventListener('touchstart',function(e){
    if(e.target.closest('.sheet')||e.target.closest('.dropdown')||e.target.closest('.ann-wrap'))return; // ignore modals/dropdowns/annual
    _swipeStartX=e.touches[0].clientX;
    _swipeStartY=e.touches[0].clientY;
    _swipeActive=true;
  },{passive:true});
  document.addEventListener('touchend',function(e){
    if(!_swipeActive)return;
    _swipeActive=false;
    const dx=e.changedTouches[0].clientX-_swipeStartX;
    const dy=e.changedTouches[0].clientY-_swipeStartY;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){
      navDir(dx<0?1:-1); // left = next month, right = prev month
    }
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!_swipeActive)return;
    const dx=Math.abs(e.touches[0].clientX-_swipeStartX);
    const dy=Math.abs(e.touches[0].clientY-_swipeStartY);
    // If clearly horizontal swipe, prevent vertical scroll
    if(dx>dy*1.5&&dx>20)e.preventDefault();
  },{passive:false});
}
init();

// ============================================================
// GOOGLE CALENDAR SYNC
// ============================================================
