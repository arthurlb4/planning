// Version PC : sa propre mécanique (ni glisser, ni bande de mois, ni fenêtres par-dessus, ni voile).
// Les calculs (../core.js) et le contenu des pages (../ui.js) sont partagés avec la version iPhone ; ce fichier remplace
// pour le PC les fonctions de navigation faites pour le doigt.
if(innerWidth<=720)location.replace('../'+location.search+location.hash);
window.addEventListener('resize',function(){if(innerWidth<=720)location.replace('../'+location.search+location.hash);});

// fondu glissé sur place (le contenu change d'un coup, sans second calendrier à côté)
function _pcFade(el,d){if(el&&el.animate)el.animate([{opacity:.25,transform:d?'translateX('+(d*22)+'px)':'scale(.985)'},{opacity:1,transform:'none'}],{duration:200,easing:'cubic-bezier(.25,.8,.25,1)'});}
function _pcMonth(y,m,d){curY=y;curM=m;window._titleDir=d||0;_calNavDir=d||0;render();_pcFade(document.querySelector('#month-view .cal-wrap'),d);}

function navDir(d){
  if(annualOpen){curY+=d;renderAnnual();window._titleDir=d;_setTitle(document.getElementById('mtit'),String(curY));_pcFade(document.getElementById('ann-grid'),d);return;}
  var m=curM+d,y=curY;if(m<0){m=11;y--;}if(m>11){m=0;y++;}_pcMonth(y,m,d);}
window._calSlideTo=function(y,m,d){_pcMonth(y,m,d);};
function _calVeil(cb){cb();_pcFade(annualOpen?document.getElementById('ann-wrap'):document.getElementById('month-view'),0);}
function goToday(){var y=NOW.getFullYear(),m=NOW.getMonth();
  if(annualOpen){_calVeil(function(){curY=y;curM=m;_showMonthView();render();});return;}
  if(curY===y&&curM===m)return;_pcMonth(y,m,(curY*12+curM)>TODAY_YM?-1:1);}

// les pages s'affichent dans le panneau : pas de page figée en arrière-plan
function _lockBodyScroll(){document.body.classList.add('modal-open');}
function _unlockBodyScroll(){document.body.classList.remove('modal-open');}

// onglets du panneau : Soldes (colonne de l'accueil), Contrôle, Rendus, Congés, Réglages
function pcTab(p){
  if(p==='home'){if(document.querySelector('#modal-root .overlay')){window._modalBack=null;closeModal();if(document.querySelector('#modal-root .overlay')){document.getElementById('modal-root').innerHTML='';_unlockBodyScroll();}}}
  else if(p==='suivi')openMergedRenduCgModal(6,2);
  else if(p==='rendus')openMergedRenduCgModal(6,0);
  else if(p==='conges')openMergedRenduCgModal(6,1);
  else if(p==='set')openSettingsModal(window._stLast||0);
  pcSync();var b=document.getElementById('pc-body');if(b)b.scrollTop=0;}
// onglet allumé : celui de la page affichée (aucun pour une autre page : fiche du jour, Modifier, Échanges…)
function pcSync(){var ov=document.querySelector('#modal-root .overlay'),p='home';
  if(ov)p=ov.querySelector('#rcc-wrap')?({2:'suivi',0:'rendus',1:'conges'}[window._rcgShown]||'suivi'):ov.querySelector('#stc-0')?'set':'';
  document.querySelectorAll('#pc-tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.p===p);});}
(function(){var r=document.getElementById('modal-root');if(r&&window.MutationObserver)new MutationObserver(function(){pcSync();}).observe(r,{childList:true,subtree:true});
  var t0=window.rcgTab;if(typeof t0==='function')window.rcgTab=function(){var x=t0.apply(this,arguments);pcSync();return x;};})();

// colonne toujours à droite ; le calendrier (ou la grille de l'année) prend la plus grande taille qui tient en hauteur
function _checkSideBelow(){var l=document.querySelector('.layout');if(l)l.classList.remove('side-below');}
function _fitCalendar(){var col=document.querySelector('.cal-col'),mv=document.getElementById('month-view'),mb=document.querySelector('.mbar'),aw=document.getElementById('ann-wrap');if(!col||!mv)return;
  var W=col.clientWidth,avail=col.clientHeight-(mb?mb.offsetHeight:0)-8,cw=mv.querySelector('.cal-wrap');
  [mv,mb,aw].forEach(function(e){if(e)e.style.width='';});
  if(!cw||!cw.offsetHeight||annualOpen){[mv,mb,aw].forEach(function(e){if(e)e.style.width=W+'px';});return;}
  // deux passes : la hauteur ne suit pas tout à fait la largeur (en-tête des jours, marges)
  var w=W;for(var k=0;k<2;k++){mv.style.width=w+'px';var h=cw.offsetHeight;if(!h)break;w=Math.max(420,Math.min(W,Math.floor(w*avail/h)));}
  [mv,mb,aw].forEach(function(e){if(e)e.style.width=w+'px';});}
window.addEventListener('resize',function(){_fitCalendar();});
document.addEventListener('DOMContentLoaded',function(){_checkSideBelow();setTimeout(_fitCalendar,50);});
