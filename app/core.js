// Cœur partagé (téléphone et PC) : données, calculs d’heures, congés, paie, bulletins, tableau Gestion, règles de travail.
// Aucun accès à la page ici : uniquement des calculs et du texte. Chargé avant le script de l’interface.
var GCAL_CLIENT_ID='669191513748-a40uvl9k46kqsmjatpqokhnhgvrc7mdt.apps.googleusercontent.com';
var GCAL_REDIRECT_URI='https://arthurlb4.github.io/planning/app/';
var GCAL_SCOPE='https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';
var GCAL_FUNCTIONS='https://planning-gcal.arthur-lebreton94.workers.dev';
var CLOUD_API='https://planning-gcal.arthur-lebreton94.workers.dev';
// ================================================================
// DONNEES
// ================================================================
const VAC_STD={
  A1:{deb:'03h45',fin:'10h45',dur:420,panier:false},A2:{deb:'03h45',fin:'11h45',dur:480,panier:false},
  A3:{deb:'04h45',fin:'12h45',dur:480,panier:false},Ad1:{deb:'04h45',fin:'11h45',dur:420,panier:false},
  Ad2:{deb:'04h45',fin:'12h45',dur:480,panier:false},Ad3:{deb:'05h45',fin:'14h15',dur:510,panier:false},
  As1:{deb:'04h45',fin:'11h45',dur:420,panier:false},As2:{deb:'04h45',fin:'12h45',dur:480,panier:false},
  As3:{deb:'05h45',fin:'14h15',dur:510,panier:false},B1:{deb:'07h45',fin:'15h15',dur:450,panier:true},
  C1:{deb:'12h15',fin:'21h15',dur:540,panier:false},C2:{deb:'13h15',fin:'21h15',dur:480,panier:false},
  Cd:{deb:'11h15',fin:'20h15',dur:540,panier:true},Cs:{deb:'11h15',fin:'20h15',dur:540,panier:true},
  D1:{deb:'15h45',fin:'00h30',dur:480,panier:false},D2:{deb:'15h45',fin:'00h15',dur:465,panier:false},
  Ed:{deb:'14h45',fin:'00h30',dur:540,panier:false},Es:{deb:'15h15',fin:'00h30',dur:510,panier:false},
  Fd:{deb:'15h45',fin:'00h15',dur:465,panier:false},Fs:{deb:'15h45',fin:'00h15',dur:465,panier:false},
  P423:{deb:'09h45',fin:'18h15',dur:450,panier:false},
  // Coord
  M:{deb:'08h00',fin:'19h00',dur:600,panier:true},
  S:{deb:'13h30',fin:'00h30',dur:600,panier:true},
  Pj:{deb:'08h00',fin:'19h00',dur:600,panier:true},   // P jeudi (matin)
  Pv:{deb:'13h30',fin:'19h30',dur:360,panier:false},   // P vendredi (soir)
  // Réal
  MR:{deb:'05h45',fin:'13h45',dur:480,panier:false},
  SR:{deb:'11h45',fin:'21h15',dur:570,panier:false},
  // Cadre
  B2V:{deb:'07h45',fin:'16h15',dur:510,panier:true},
  C3V:{deb:'11h15',fin:'21h15',dur:540,panier:true},
  P422V:{deb:'07h45',fin:'17h15',dur:510,panier:true},
  Ds:{deb:'13h15',fin:'21h15',dur:480,panier:false},
  Dd:{deb:'12h15',fin:'21h15',dur:540,panier:false},
  BsV:{deb:'07h15',fin:'15h45',dur:450,panier:true},
  BdV:{deb:'07h15',fin:'15h45',dur:510,panier:true},
  MIXTE:{deb:'07h45',fin:'16h45',dur:480,panier:true},
  'Ms-R':{deb:'05h45',fin:'13h45',dur:480,panier:false},
  'Md-R':{deb:'05h45',fin:'13h45',dur:480,panier:false},
};
const WEEK_DUR=[2160,1410,2340,1320,1860,1860,1830,1425,2160,2400,1410,2400,2040,2190];
const CYCLE=[
  ['A1','A1',null,'RH','A2','As1','Ad1'],[null,null,'A2','A2','B1',null,'RH'],
  ['A3','A3',null,'RH','A1','As2','Ad2'],[null,null,'A1','A1','A3',null,'RH'],
  ['B1','B1','A3','A3',null,null,'RH'],['A2','A2','B1','B1',null,null,'RH'],
  [null,null,'RH','P423','P423','Es','Ed'],[null,null,'D2','D1','D1',null,'RH'],
  ['C1','C1','C1','C1',null,null,'RH'],['D2','D2',null,'RH','C1','Fs','Fd'],
  [null,null,'D1','D2','D2',null,'RH'],['C2','C2','C2','C2','C2',null,'RH'],
  ['D1','D1',null,null,'RH','Cs','Cd'],['P423','P423','P423',null,'RH','As3','Ad3'],
];
// Pool cadre (cycle 2025/2026, 5 semaines)
const CYCLE_CADRE=[
  [null,null,'C3V','C3V','C3V',null,'RH'],['P422V','P422V','P422V','B2V','MIXTE',null,'RH'],
  ['C3V','C3V',null,null,'RH','Ds','Dd'],[null,null,'B2V','P422V','P422V',null,'RH'],
  ['B2V','B2V',null,'RH','B2V','BsV','BdV'],
];
// Équipes : chacune a son cycle (cycles de l'admin marqués de l'équipe, sinon celui du code) ; la coordination n'a que ceux de l'admin
const POOLS={antenne:{l:'Antenne',s:'Antenne',g:CYCLE},cadre:{l:'Cadre',s:'Cadre',g:CYCLE_CADRE},coord:{l:'Coordination',s:'Coord',g:null}};
function _pool(){var p=window._poolTmp||(typeof S!=='undefined'&&S&&S.profile&&S.profile.pool);return POOLS[p]?p:'antenne';}
// Équipe à une date : changement d'équipe « à partir de » (pool dans S.profile.lineHistory), avant le premier : origPool
function _poolAt(date){if(window._poolTmp&&POOLS[window._poolTmp])return window._poolTmp;var pr=typeof S!=='undefined'&&S&&S.profile;
  var h=pr&&pr.lineHistory;if(!date||!h||!h.some(function(x){return x.pool;}))return _pool();
  var key=dk(date instanceof Date?date:new Date(date+'T12:00:00')),p=pr.origPool||'antenne';
  h.slice().sort(function(a,b){return a.from<b.from?-1:1;}).forEach(function(x){if(x.from<=key&&x.pool)p=x.pool;});return POOLS[p]?p:'antenne';}
function _poolCycles(pool){pool=pool||_pool();return (_globalCycles||[]).filter(function(c){return (c.pool||'antenne')===pool;});}
// Cycles en cours des autres équipes à une date : {id du cycle: équipe} (leurs vacations sont proposées dans « Autres »)
function _otherPoolCyc(date){var key=dk(date instanceof Date?date:new Date(date+'T12:00:00')),me=_poolAt(key),o={};
  Object.keys(POOLS).forEach(function(p){if(p===me)return;var a=null;_poolCycles(p).sort(function(x,y){return x.startDate<y.startDate?-1:1;}).forEach(function(c){if(c.startDate<=key)a=c;});if(a)o[a.id]=p;});return o;}
// Cycle en cours d'une équipe à une date (le plus récent commencé, pas terminé)
function _activeCycleOf(pool,key){var a=null;_poolCycles(pool).filter(function(c){return c.weeks&&c.weeks.length;}).sort(function(x,y){return x.startDate<y.startDate?-1:1;}).forEach(function(c){if(c.startDate<=key&&(!c.endDate||c.endDate>=key))a=c;});return a;}
// Vacations des grilles des cycles en cours des autres équipes : {code: équipe}
function _otherPoolCodes(date){var o=_otherPoolCyc(date),r={};(_globalCycles||[]).forEach(function(c){if(o[c.id])(c.weeks||[]).forEach(function(w){(w||[]).forEach(function(x){if(x&&x!=='RH'&&x!=='SV')r[x]=o[c.id];});});});return r;}
function _stdGrid(pool){return POOLS[pool||_pool()].g||CYCLE;}
// Équipes proposées : celles qui ont un cycle (dans le code ou dans l'admin)
function _poolsAvail(){return Object.keys(POOLS).filter(function(k){return POOLS[k].g||_poolCycles(k).some(function(c){return c.weeks&&c.weeks.length;});});}
// Jours fériés calculés (fixes + lundi de Pâques, Ascension, lundi de Pentecôte)
function _feriesAnnee(y){
  // Date de Pâques (algorithme de Meeus/Jones/Butcher)
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const pm=Math.floor((h+l-7*m+114)/31),pd=((h+l-7*m+114)%31)+1;
  const p=n=>new Date(Date.UTC(y,pm-1,pd+n)).toISOString().slice(0,10);
  return[y+'-01-01',p(1),y+'-05-01',y+'-05-08',p(39),p(50),y+'-07-14',y+'-08-15',y+'-11-01',y+'-11-11',y+'-12-25'];
}
const FERIES=new Set();
const ANCHOR=new Date(2026,4,4),ANCHOR_L=8;
const NOW=new Date(),TODAY_YM=NOW.getFullYear()*12+NOW.getMonth(),CUR_YEAR=NOW.getFullYear();
// Mois en toutes lettres partout ; abréviations (MCs) seulement là où la place manque (colonnes étroites, tableaux)
const MC=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MCs=['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
const ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const JN=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const DEFAULT_PD=()=>({
  profile:{name:'',anchorLine:0,matelas:0,congesInit:25,ephSolde:0,ephSoldeCreatedYM:TODAY_YM},
  settings:{dimRendu:true,rhRendu:true,ferRendu:true,hsRendu:true,settingsHistory:[],theme:'dark'},
  overrides:{},conges:{},history:[],customVacs:{},
});
let _profs={},_aid='default',S=DEFAULT_PD();
var _calNavDir=0;
var _weekViewMon=null;
let curY=CUR_YEAR,curM=NOW.getMonth(),pendingKey=null,annualOpen=false;
let _annSelY=CUR_YEAR;
let _us=[],_rs=[];
// ================================================================
// STATE
// ================================================================
// Données locales liées au compte connecté (u) : celles d'un autre compte sont rangées à part (pl_v8_<compte>)
// et jamais mélangées ni envoyées dans le cloud du compte connecté
function _plU(){return (window._authUser&&window._authUser.userId)||null;}
function loadState(){
  try{var d=JSON.parse(localStorage.getItem('pl_v8')||'{}'),me=_plU();window._plLegacy=false;
    if(me&&d.u&&d.u!==me){try{localStorage.setItem('pl_v8_'+d.u,JSON.stringify(d));}catch(e){}d=JSON.parse(localStorage.getItem('pl_v8_'+me)||'{}');try{localStorage.removeItem('pl_v8_'+me);}catch(e){}}
    else if(me&&!d.u&&d.p&&Object.keys(d.p).length)window._plLegacy=true; // ancien format : compte inconnu, le cloud fait foi
    _profs=d.p||{};_aid=d.a||'default';}catch(e){}
  window._plBlank=!_profs[_aid]; // profil vide créé ici : rien à garder si le cloud le remplace
  if(!_profs[_aid])_profs[_aid]=DEFAULT_PD();
  S=_profs[_aid];
  // Ensure settings exist with defaults
  if(!S.settings)S.settings={};
  if(S.settings.dimRendu===undefined)S.settings.dimRendu=true;
  if(S.settings.rhRendu===undefined)S.settings.rhRendu=true;
  if(S.settings.ferRendu===undefined)S.settings.ferRendu=true;
  if(S.settings.hsRendu===undefined)S.settings.hsRendu=true;
  // Ensure profile fields exist
  if(!S.profile)S.profile={};
  if(S.profile.ephSoldeCreatedYM===undefined)S.profile.ephSoldeCreatedYM=TODAY_YM;
  delete S.profile.repMail;
  try{_histClean();}catch(e){}
  // Échanges entre collègues : jamais d'heures sup (anciens échanges marqués HS remis à la vacation prévue)
  Object.keys(S.overrides||{}).forEach(function(k){var o=S.overrides[k];if(o&&o.echange&&o.hs)o.hs=false;}); // adresse de l'ancienne demande de report par mail (le destinataire est saisi dans Outlook)
  // Migrate: old autoReportEph incorrectly incremented ephExtend — undo it
  if(S.autoReported&&S.ephExtend){Object.keys(S.autoReported).forEach(function(ym){if(S.ephExtend[ym]>0){S.ephExtend[ym]--;if(S.ephExtend[ym]<=0)delete S.ephExtend[ym];}});delete S.autoReported;}
  // Migrate: autoReport1m → autoExtend level 1
  if(S.autoReport1m){if(!S.autoExtend)S.autoExtend={};Object.keys(S.autoReport1m).forEach(function(k){S.autoExtend[k]=Math.max((S.autoExtend[k]||0),1);});delete S.autoReport1m;}  // Mark all existing customVacs as hidden (not shown in grid)
  if(S.customVacs){Object.keys(S.customVacs).forEach(k=>{S.customVacs[k].hidden=true;});}
  if(S.customVacs){Object.keys(S.customVacs).forEach(k=>{if(VAC_STD[k]){console.warn('customVacs shadow removed:',k,S.customVacs[k]);delete S.customVacs[k];}});}
}
// ================================================================
// UNDO / REDO
// ================================================================
// Instantané pour Annuler / Rétablir : tout ce que la fiche du jour et ses écrans modifient
// Instantané complet du profil (planning, rendus, congés, soldes, départ, reprises du tableau…) pour annuler n'importe quelle action
function snap(){return JSON.stringify(S,function(k,v){return k==='_lastSaved'||k==='rhCmp'?undefined:v;});}
function _snapApply(p){var ls=S.profile&&S.profile._lastSaved;Object.keys(S).forEach(function(k){delete S[k];});Object.assign(S,typeof p==='string'?JSON.parse(p):p);if(S.profile&&ls)S.profile._lastSaved=ls;try{recalcAllMatelas();}catch(e){}}
// ================================================================
// HELPERS
// ================================================================
function dk(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function getMonday(d){const x=new Date(d);x.setHours(12,0,0,0);const dw=x.getDay();x.setDate(x.getDate()-(dw===0?6:dw-1));return x;}
function _toMinApp(t){const m=/^(\d{1,2})h(\d{2})$/.exec((t||'').trim());return m?+m[1]*60+ +m[2]:null;}
function _calcMixteHsDetail(mixteCode,replCode,VAC){
  const mv=VAC[mixteCode],rv=VAC[replCode];
  if(!mv||!rv)return{hsBounds:0,hsDur:0};
  const dm=_toMinApp(mv.deb),fm0=_toMinApp(mv.fin);
  const dr=_toMinApp(rv.deb),fr0=_toMinApp(rv.fin);
  const hsBounds=(dm!==null&&fm0!==null&&dr!==null&&fr0!==null)?function(){
    const fm=fm0<=dm?fm0+1440:fm0,fr=fr0<=dr?fr0+1440:fr0;
    return Math.max(0,dm-dr)+Math.max(0,fr-fm);
  }():0;
  const hsDur=Math.max(0,(rv.dur||0)-(mv.dur||0));
  return{hsBounds,hsDur};
}
function _calcMixteHsMin(mixteCode,replCode,VAC){
  const{hsBounds}=_calcMixteHsDetail(mixteCode,replCode,VAC);
  return hsBounds;
}
function _cycleGridScheduledVacs(date){
  const d=date instanceof Date?date:new Date(date+'T12:00:00');
  const dw=d.getDay(),key=dk(d);
  const sorted=_poolCycles(_poolAt(d)).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
  let activeCycle=null;
  sorted.forEach(function(c){if(c.startDate<=key)activeCycle=c;});
  if(!activeCycle||!activeCycle.weeks)return new Set();
  const weeks=activeCycle.weeks,s=new Set();
  weeks.forEach(function(w){
    if(dw===6){if(w[5]&&w[5]!=='RH')s.add(w[5]);}
    else if(dw===0){if(w[6]&&w[6]!=='RH')s.add(w[6]);}
    else{for(var i=0;i<5;i++){if(w[i]&&w[i]!=='RH')s.add(w[i]);}}
  });
  return s;
}
function _cycleVacList(date){
  const d=date instanceof Date?date:new Date(date+'T12:00:00');
  const dw=d.getDay(),dayType=dw===6?'sat':dw===0?'sun':'week';
  if(!_poolCycles(_poolAt(d)).length)return null;
  const key=dk(d);
  const sorted=_poolCycles(_poolAt(d)).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
  let activeCycle=null;
  sorted.forEach(function(c){if(c.startDate<=key)activeCycle=c;});
  if(!activeCycle)return null;
  return Object.entries(_globalVacs)
    .filter(function([n,v]){return v.cycleIds&&v.cycleIds.includes(activeCycle.id)&&n!=='RH';})
    .filter(function([n,v]){var ts=(v.type||'week').split(',');return ts.includes('all')||ts.includes(dayType);})
    .filter(function([n,v]){if(!v.days||!v.days.length)return true;return v.days.includes(dw);})
    .sort(function([an,av],[bn,bv]){return(_toMinApp(av.deb)||9999)-(_toMinApp(bv.deb)||9999);})
    .map(function([n]){return n;});
}
function fmtH(min){if(min===0)return'0h00';const h=min/60;if(Number.isInteger(h))return h+'h00';return Math.floor(h)+'h'+String(min%60).padStart(2,'0');}
function fmtR(min){return(Math.round(min/60*100)/100).toFixed(2).replace('.',',')+'h';}
function fmtMin(min){if(isNaN(min)||min===undefined||min===null)return'0h00';return fmtH(Math.round(min));}
function capitalize(s){if(!s)return s;return s.charAt(0).toUpperCase()+s.slice(1);}
function nowHHMM(){const n=new Date();return String(n.getDate()).padStart(2,'0')+'/'+String(n.getMonth()+1).padStart(2,'0');}
function fmtDate(d){return JN[d.getDay()]+' '+d.getDate()+' '+MC[d.getMonth()]+' '+d.getFullYear();}
function parseHM(s){if(!s)return 0;const str=(s+'').trim().replace(',','.');var m;if((m=str.match(/^(\d+)h(\d{0,2})$/i)))return parseInt(m[1])*60+(parseInt(m[2]||'0')||0);if((m=str.match(/^(\d+(?:\.\d+)?)h?$/i))){const h=parseFloat(m[1]);return Math.round(h*60);}return 0;}
function isoWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil(((d-ys)/864e5+1)/7);}
var _globalVacs={};
var _globalCycles=[];
function getActiveCycleGrid(date){
  const _pc=_poolCycles(_poolAt(date));if(!_pc.length)return null;
  const key=dk(date instanceof Date?date:new Date(date+'T12:00:00'));
  const sorted=_pc.filter(function(c){return c.weeks&&c.weeks.length>0;}).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
  let active=null;
  sorted.forEach(function(c){
    if(c.startDate<=key&&(!c.endDate||c.endDate>=key))active=c;
  });
  return active?active.weeks:null;
}
function getActiveCycleAnchor(date){
  const _pc=_poolCycles(_poolAt(date));if(!_pc.length)return null;
  const key=dk(date instanceof Date?date:new Date(date+'T12:00:00'));
  const sorted=_pc.filter(function(c){return c.weeks&&c.weeks.length>0;}).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
  let active=null;
  sorted.forEach(function(c){if(c.startDate<=key&&(!c.endDate||c.endDate>=key))active=c;});
  return active?active.startDate:null;
}
function getCycleLen(date){
  const grid=getActiveCycleGrid(date||NOW);
  return grid?grid.length:_stdGrid(_poolAt(date||NOW)).length;
}
function getVAC(date){
  // If we have cycles with vacations, filter by active cycle at given date
  if(date&&_poolCycles(_poolAt(date)).length){
    const key=dk(date instanceof Date?date:new Date(date+'T12:00:00'));
    // Find active cycle at this date (most recent startDate <= key)
    const sorted=_poolCycles(_poolAt(date)).sort(function(a,b){return a.startDate<b.startDate?-1:1;});
    let activeCycle=null;
    sorted.forEach(function(c){if(c.startDate<=key)activeCycle=c;});
    if(activeCycle){
      // Build VAC from vacations belonging to this cycle
      const cycVacs={},oth=_otherPoolCyc(date),othC=_otherPoolCodes(date),mine={};
      // vacations de la grille du cycle : reconnues même sans être rattachées au cycle dans l'admin
      (activeCycle.weeks||[]).forEach(function(w){(w||[]).forEach(function(x){if(x)mine[x]=1;});});
      Object.entries(_globalVacs).forEach(function([name,v]){
        if(Array.isArray(v.pools)?(mine[name]||othC[name]||(v.pools.indexOf(_poolAt(date))>=0&&(!v.from||v.from<=key)&&(!v.to||v.to>=key))):(!v.cycleIds||!v.cycleIds.length||v.cycleIds.includes(activeCycle.id)||mine[name]||v.cycleIds.some(function(id){return oth[id];})||othC[name])){
          cycVacs[name]=v;
        }
      });
      return{...VAC_STD,...cycVacs,...(S.customVacs||{})};
    }
  }
  return{...VAC_STD,..._globalVacs,...(S.customVacs||{})};
}
// Ligne du cycle de la semaine ; une semaine échangée avec une autre ligne (S.weekLines) prend celle-ci
function lineIdx(monday){
  const _wl=S&&S.weekLines&&S.weekLines[dk(monday)];
  if(_wl!=null){const N=getCycleLen(monday);return((_wl%N)+N)%N;}
  return _lineIdxBase(monday);
}
function _lineIdxBase(monday){
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
  const kvGrid=getActiveCycleGrid(date);
  if(_poolCycles(_poolAt(date)).length&&!kvGrid)return{cycleVac:null,li};
  const grid=kvGrid||_stdGrid(_poolAt(date));
  const cv=grid[li][idx];return{cycleVac:(cv==='SV'?null:cv),li};
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
// Texte saisi ou lu (noms, libellés de primes, lignes de bulletin) avant de l'insérer dans le HTML
function _h(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function getDur(date){const{vac}=getVac(date);const VAC=getVAC();const d=(vac&&vac!=='RH'&&VAC[vac])?VAC[vac].dur:0;
  // demi-journée de congé exceptionnel complétée par des rendus : le rendu ne compte que l'autre moitié
  if(d&&S.excInfo){const k=dk(date),x=S.excInfo[k];if(x&&x.half&&x.rest==='rend'&&/^rend/.test((S.conges||{})[k]||''))return Math.round(d/2);}return d;}
// ── Règles de travail ──
// Repos quotidien : 11h entre deux vacations, abaissable à 9h à la demande du salarié.
// Au-delà de 6 jours travaillés d'affilée : 7h de rendus par jour en plus.
var RULES={repos:660,reposMin:540,joursMax:6,rendJourSup:420};
// Vacation réellement faite ce jour : début et fin en minutes depuis minuit du jour (fin après minuit : > 1440)
function _shiftOf(d){var k=dk(d),g=getVac(d),c=(S.conges||{})[k];if(c||!g.vac||g.vac==='RH'||g.absent||(g.echange&&!g.ecSelf))return null;
  var V=(S.customVacs||{})[g.vac]||_globalVacs[g.vac]||VAC_STD[g.vac];if(!V||!V.deb||!V.fin||!(V.dur>0))return null; /* même ordre que getVAC, sans reconstruire la liste */var a=_toMinApp(V.deb),b=_toMinApp(V.fin);if(a==null||b==null)return null;if(b<=a)b+=1440;return{s:a,e:b,v:g.vac};}
function _dAdd(k,n){var d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return d;}
// Repos entre la vacation de la veille et celle du jour (null : pas deux vacations de suite)
function _restBefore(k){var a=_shiftOf(_dAdd(k,-1)),b=_shiftOf(_dAdd(k,0));return a&&b?1440-a.e+b.s:null;}
// Rang du jour dans une suite de jours travaillés d'affilée (0 : jour non travaillé)
function _streakPos(k){if(!_shiftOf(_dAdd(k,0)))return 0;var n=1;while(n<60&&_shiftOf(_dAdd(k,-n)))n++;return n;}
// Ce que les règles disent d'un jour : repos trop court avant ou après, jour au-delà du 6e d'affilée
function _ruleNotes(k){var L=[],fd=function(n){var d=_dAdd(k,n);return d.getDate()+' '+MCs[d.getMonth()];};
  [[_restBefore(k),-1],[_restBefore(dk(_dAdd(k,1))),1]].forEach(function(x){var r=x[0];if(r==null||r>=RULES.repos)return;
    var od=_dAdd(k,x[1]),o=_shiftOf(od),ol=vLbl(o.v,getVAC(od)),w=x[1]<0?'après la '+ol+' de la veille':'avant la '+ol+' du lendemain';
    L.push(r<RULES.reposMin?{lvl:'red',txt:'Repos de '+fmtMin(r)+' '+w+' : moins de 9h, non autorisé'}:{lvl:'amber',txt:'Repos de '+fmtMin(r)+' '+w+' : moins de 11h, possible uniquement sur demande du salarié'});});
  var p=_streakPos(k);if(p>RULES.joursMax)L.push({lvl:'amber',txt:p+'e jour travaillé d’affilée : '+fmtMin(RULES.rendJourSup)+' de rendus comptées'});
  return L;}
// Alerte validée (repos accepté, jours d'affilée voulus) : plus de liseré ni de ligne dans Suivi
// Repos de moins de 9h : interdit, ne se valide pas
function _ruleHard(k){var rb=_restBefore(k),ra=_restBefore(dk(_dAdd(k,1)));return (rb!=null&&rb<RULES.reposMin)||(ra!=null&&ra<RULES.reposMin);}
function _ruleOk(k){return !!((S.ruleOk||{})[k])&&!_ruleHard(k);}
// Jour à signaler (liseré du calendrier) : repos trop court avant ou après, ou jour au-delà du 6e sans ses rendus
function _ruleBad(k){if(_ruleOk(k))return false;var me=_shiftOf(_dAdd(k,0));if(!me)return false;var rb=_restBefore(k),ra=_restBefore(dk(_dAdd(k,1)));
  if((rb!=null&&rb<RULES.repos)||(ra!=null&&ra<RULES.repos))return true;
  return _streakPos(k)>RULES.joursMax;}
// Jours à signaler sur une période (Suivi) : repos trop courts (jour d'après), jours au-delà du 6e sans rendus
function _ruleScan(from,to){var R=[],J=[],d=new Date(from+'T12:00:00'),e=new Date(to+'T12:00:00');
  var H=[];for(;d<=e;d.setDate(d.getDate()+1)){var k=dk(d);if(_ruleOk(k))continue;var rb=_restBefore(k);if(rb!=null&&rb<RULES.repos)(rb<RULES.reposMin?H:R).push(k);
    if(_streakPos(k)>RULES.joursMax)J.push(k);}
  return{hard:H,rest:R,streak:J};}
// Période regardée par Suivi et l'accueil : du mois dernier aux 2 mois à venir
function _ruleScanNow(){return _ruleScan(dk(new Date(NOW.getFullYear(),NOW.getMonth()-1,1,12)),dk(new Date(NOW.getFullYear(),NOW.getMonth()+3,0,12)));}
function _ruleHtml(k){var L=_ruleNotes(k);if(!L.length)return '';var ok=_ruleOk(k);
  return L.map(function(n,i){return '<div class="rule-note" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin:-4px 0 10px;font-size:13px;line-height:1.4;background:'+(n.lvl==='red'?'rgba(192,57,43,.18);color:#f3c2bb':'rgba(200,128,72,.16);color:var(--text)')+'"><i class="ti ti-alert-triangle" style="font-size:15px;flex-shrink:0;color:'+(n.lvl==='red'?'var(--red)':'var(--amber)')+'"></i><span style="flex:1">'+n.txt+'</span>'
    +(i===L.length-1&&!_ruleHard(k)?'<button class="adj-pill" style="width:auto;height:28px;padding:0 12px;font-size:13px;flex-shrink:0" onclick="event.stopPropagation();_ruleSet(\''+k+'\','+(!ok)+')">'+(ok?'✓ Validé':'Valider')+'</button>':'')+'</div>';}).join('');}
// Congés pour événements familiaux (accord collectif, art. IX.2.4) : rémunérés, ni congés payés ni rendus
const EXC_M={rentree:{l:'Rentrée scolaire',s:'Rentrée',half:1,info:'½ journée · enfant en maternelle, élémentaire ou 6ᵉ'},enfant:{l:'Enfant malade',s:'Enf.',info:'6 j/an · 9 avec 2 enfants · 12 avec 3+ (avec conjoint ou parent malade)'},
  proche:{l:'Conjoint ou parent malade',s:'Malad.',info:'compté avec enfant malade : 6 j/an · 9 · 12'},mariage:{l:'Mariage / PACS',s:'Mar.',info:'5 j (2 j pour un enfant ou un parent)'},
  naissance:{l:'Naissance / adoption',s:'Naiss.',info:'3 j, à prendre dans les 15 jours'},maternite:{l:'Congé maternité',s:'Mat.',info:'16 semaines en général (6 avant, 10 après la naissance) · à poser avec « Plusieurs jours »'},paternite:{l:'Congé paternité',s:'Pat.',info:'25 jours calendaires (32 pour des naissances multiples), après les 3 j de naissance · à poser avec « Plusieurs jours »'},deces:{l:'Décès',s:'Décès',info:'2 à 5 j selon le lien'},demenag:{l:'Déménagement',s:'Démén.',info:'2 j'},maladie:{l:'Arrêt maladie',s:'Mal.',info:'Arrêt de travail : la journée n’est pas comptée'},autre:{l:'Autre congé exceptionnel',s:'Exc.',opt:1},greve:{l:'Grève',s:'Grève',greve:1},nonrem:{l:'Absence non rémunérée',s:'Abs.NR',greve:1}};
function _excOf(k){var x=(S.excInfo||{})[k];if(!x)return null;var c=(S.conges||{})[k];
  // valable seulement si le jour est toujours posé comme ça (absence, ou rendu pour la ½ journée complétée)
  if(x.g&&x.g!=='j')return c?null:x;if(x.half&&x.rest==='rend'&&!c)return Object.assign({},x,{rest:'work'});if(x.half?(x.rest==='rend'?(c!=='rend'&&c!=='rend-hist'):!!c):c!=='absent')return null;return x;}
// Autre congé exceptionnel « compté comme travaillé » (ex. vacation supprimée par la direction) : les heures de la vacation
// prévue comptent pour les heures sup et la semaine ramenée ; la journée reste un repos pour les règles de repos
// Ce que garde le jour : tw heures (heures sup, semaine ramenée), mj majorations dimanche/férié/RH, nt nuit,
// pr primes antenne/réal/coord, mt prime du matin, pn panier — toujours d'après la vacation prévue au cycle
var EXC_KEEP=[['tw','Heures','heures sup et semaine ramenée'],['mj','Majorations','dimanche, férié, RH'],['nt','Heures de nuit',''],['pr','Primes','antenne, réal, coord'],['mt','Prime du matin',''],['pn','Panier','']];
function _excKeep(k,f){var x=_excOf(k);return !!(x&&x.m==='autre'&&x[f]);}
function _excAssim(k){return _excKeep(k,'tw');}
// Jour d'absence gardé pour un calcul : la vacation prévue au cycle, comme si elle avait été faite
function _gvK(d,f){var g=getVac(d);return g.absent&&_excKeep(dk(d),f)?Object.assign({},g,{vac:g.cycleVac,absent:false}):g;}
function _cgK(k,f){var c=(S.conges||{})[k];return c==='absent'&&_excKeep(k,f)?undefined:c;}
function _excL(x){return x?(x.lbl||EXC_M[x.m].l):'';}
// Jours pris par motif sur l'année (½ journée = 0,5 ; enfant et proche malades comptés ensemble)
function _excUsed(m,y){var n=0;Object.keys(S.excInfo||{}).forEach(function(k){if(+k.slice(0,4)!==y)return;var x=_excOf(k);if(!x)return;
  var same=x.m===m||((m==='enfant'||m==='proche')&&(x.m==='enfant'||x.m==='proche'));if(same)n+=x.half?0.5:1;});return n;}
// Minutes de nuit d'un jour : formation suivie → la plus grande entre la vacation prévue et la formation
function getNuitMinDay(date,VAC){VAC=VAC||getVAC(date);const pv=getPayVac(date),v=getVac(date).vac;let n=calcNuitMinShift(VAC[pv])||0;if(v&&v!==pv&&v!=='RH')n=Math.max(n,calcNuitMinShift(VAC[v])||0);return n;}
// Délégation syndicale : primes et heures de nuit de la vacation prévue, comme une formation suivie ; matin selon la vacation faite
// prime de matin : la vacation payée commence avant 4h ; en délégation syndicale, c'est la vacation faite qui compte
function _isMatin(date,V){if(_isSyndicDay(date)){const v=getVac(date).vac,A=v&&getVAC(date)[v];return !!(A&&A.deb&&_toMinApp(A.deb)<240);}return !!(V&&V.deb&&_toMinApp(V.deb)<240);}
function _isSyndicDay(date){const ov=(S.overrides||{})[dk(date)];return !!(ov&&ov.motif==='syndic'&&(!ov.echange||ov.ecSelf));}
function getPayVac(date){const key=dk(date);const ov=(S.overrides||{})[key];
  if(ov&&ov.echange&&ov.ecSelf&&(ov.motif==='forme'||ov.motif==='syndic')&&ov.pair&&ov.pair!==key){const pc=getCycleVac(new Date(ov.pair+'T12:00:00')).cycleVac;if(pc&&pc!=='RH')return pc;}
  if(ov&&(ov.formation||ov.motif==='syndic')&&!ov.echange){const cv=getCycleVac(date).cycleVac;if(cv&&cv!=='RH')return cv;}return getVac(date).vac;}
// Panier : selon la vacation réellement faite (horaires, pause), même avec « Garder les primes » (accord, annexe 12 §6)
function isPanier(date){const vac=getVac(date).vac;const VAC=getVAC();return!!(vac&&vac!=='RH'&&VAC[vac]&&VAC[vac].panier);}
function isRHDay(date){return getCycleVac(date).cycleVac==='RH';}
function vLbl(code,VAC){return(code&&VAC&&VAC[code]&&VAC[code].label)||code||'';}
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
// Heures sup d'une vacation changée : « duree » (la plus longue des deux, prévue ou faite) ou « horaires »
// (comme les vacations mixtes : les minutes faites avant le début ou après la fin de la vacation prévue)
function _hsMode(){return S&&S.profile&&S.profile.hsMode==='horaires'?'horaires':'duree';}
function calcHSWeek(monday,mode){
  mode=mode||_hsMode();
  const li=lineIdx(monday),VAC=getVAC();
  const _grid=getActiveCycleGrid(monday)||_stdGrid(_poolAt(monday));
  const gridRow=_grid[li]||[];
  const weekBase=gridRow.reduce(function(s,v){return s+(!v||v==='RH'||v==='SV'?0:(VAC[v]?VAC[v].dur:0));},0);
  let weekWorked=0;
  function _ceilHS(m){return m>0?Math.ceil(m/30)*30:0;}
  let roundedSurplus=0;const days=[]; // détail jour par jour (fenêtre du mois)
  const isRam=isSemaineRamenée(monday);
  for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=dk(d);const{vac,absent,echange,ecSelf,cycleVac}=getVac(d);
    if(absent||(S.conges||{})[key]==='absent'){if(_excAssim(key)){const _ab=gridRow[i]&&gridRow[i]!=='RH'&&gridRow[i]!=='SV'&&VAC[gridRow[i]]?VAC[gridRow[i]].dur:0;weekWorked+=_ab;if(_ab>0)days.push({key:key,vac:gridRow[i],base:_ab,worked:_ab});}continue;}
    const _cg=(S.conges||{})[key];
    if(_cg&&(_cg==='cg'||_cg==='rend'||_cg==='rend-hist'||_cg==='absent'))continue;
    var _dayBase=gridRow[i]&&gridRow[i]!=='RH'&&gridRow[i]!=='SV'&&VAC[gridRow[i]]?VAC[gridRow[i]].dur:0;
    var _dayWorked=0;
    if(echange){
      const _ecOv=(S.overrides||{})[key];
      const _hsFlag=_ecOv&&_ecOv.hs;
      if(_hsFlag){
        if(ecSelf&&vac&&vac!=='RH')_dayWorked=VAC[vac]?VAC[vac].dur:0;
      } else {
        if(cycleVac&&cycleVac!=='RH')_dayWorked=VAC[cycleVac]?VAC[cycleVac].dur:0;
        // Déplacement (formation, horaires, formateur) : en plus, ce qui dépasse la vacation du jour cédé part en heures sup
        if(ecSelf&&_ecOv&&_ecOv.motif&&!_isDet(_ecOv.motif)&&_ecOv.pair&&_ecOv.pair!==key){var _pd=new Date(_ecOv.pair+'T12:00:00'),_pc=getCycleVac(_pd).cycleVac,_pV=getVAC(_pd)[_pc],_od=_pV?_pV.dur:0,_dd=VAC[vac]?VAC[vac].dur:0;if(_dd>_od)_dayWorked+=_dd-_od;}
      }
    }else{
      if(!vac||vac==='RH'){weekWorked+=0;roundedSurplus+=0;continue;}
      const _ov=(S.overrides||{})[key];
      if(_ov&&_ov.vac&&!_ov.echange&&_isDet(_ov.motif)){
        // Détachement sur un autre service : compte la vacation prévue au cycle, jamais d'heures sup
        _dayWorked=_dayBase;
      } else if(_ov&&_ov.vac&&!_ov.echange&&cycleVac&&VAC[cycleVac]&&VAC[cycleVac].mixte){
        _dayWorked=(VAC[cycleVac].dur||0)+_calcMixteHsMin(cycleVac,_ov.vac,VAC);
      } else if(_ov&&_ov.vac&&!_ov.echange&&cycleVac&&cycleVac!=='RH'&&VAC[cycleVac]){
        // Jour travaillé changé (grille ou « Modifier ») : la plus grande des deux, prévue ou faite ; le surplus part en heures sup
        // (méthode « horaires » : seulement ce qui sort des horaires prévus, comme une vacation mixte)
        if(mode==='horaires'&&VAC[vac]&&_toMinApp(VAC[cycleVac].deb)!==null&&_toMinApp(VAC[vac].deb)!==null)_dayWorked=(VAC[cycleVac].dur||0)+_calcMixteHsMin(cycleVac,vac,VAC);
        else _dayWorked=Math.max(VAC[cycleVac].dur||0,VAC[vac]?VAC[vac].dur:0);
      } else if(_ov&&_ov.vac&&!_ov.echange&&!_ov.hs){
        _dayWorked=(!cycleVac||cycleVac==='RH'||!VAC[cycleVac])?(VAC[vac]?VAC[vac].dur:0):VAC[cycleVac].dur;
      } else {
        _dayWorked=VAC[vac]?VAC[vac].dur:0;
      }
    }
    weekWorked+=_dayWorked;if(_dayWorked>0)days.push({key:key,vac:vac,base:_dayBase,worked:_dayWorked});
    roundedSurplus+=_ceilHS(Math.max(0,_dayWorked-_dayBase));
  }
  if(isRam){
    const ramMin=7*60;
    const rendusRam=hsRenduFromSurplus(ramMin);
    const rendusPure=hsRenduFromSurplus(roundedSurplus);
    const surplusTotal=ramMin+roundedSurplus;
    const rawLow=Math.min(surplusTotal,480);
    const rawHigh=Math.max(0,surplusTotal-480);
    return{days:days,surplus:surplusTotal,weekBase,weekWorked:weekBase+surplusTotal,
      rendusMin:rendusPure+rendusRam,rendusH:Math.round((rendusPure+rendusRam)/60*100)/100,
      rendusMinHS:rendusPure,rendusMinRam:rendusRam,isRam,rawLow,rawHigh};
  }
  const surplusTotal=roundedSurplus;
  const rendusTotal=hsRenduFromSurplus(surplusTotal);
  const rawLow=Math.min(surplusTotal,480);
  const rawHigh=Math.max(0,surplusTotal-480);
  return{days:days,surplus:surplusTotal,weekBase,weekWorked:weekWorked,
    rendusMin:rendusTotal,rendusH:Math.round(rendusTotal/60*100)/100,
    rendusMinHS:rendusTotal,rendusMinRam:0,isRam,rawLow,rawHigh};
}
function isSemaineRamenée(monday){
  let hasFérié=false,hasWork=false,allPosed=true,hasAbsent=false;
  for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=dk(d),{vac,absent,echange,ecSelf}=getVac(d);if(FERIES.has(key))hasFérié=true;if(i<6){if(absent&&!_excAssim(key))hasAbsent=true;const isGivenAway=echange&&!ecSelf;if(vac&&vac!=='RH'&&!absent&&!isGivenAway){hasWork=true;const _p=(S.conges||{})[key];if(_p!=='cg'&&_p!=='absent')allPosed=false;}}}
  // Semaine ramenée si: contient un férié, a des jours travaillés, pas tous posés (cg/rend/absent), et pas d'absent
  return hasFérié&&hasWork&&!allPosed&&!hasAbsent;
}
function isWeekFullCG(monday){
  let hasWorked=false;
  for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=dk(d),{vac,cycleVac,absent}=getVac(d);const cv=cycleVac||vac;if(cv&&cv!=='RH'&&!FERIES.has(key)){hasWorked=true;if(!absent&&(S.conges||{})[key]!=='cg')return false;}}
  return hasWorked;
}
var _SMH_KEYS=['dimRendu','rhRendu','ferRendu','hsRendu'];
function settingsForYM(ym){
  if(window._sfForce)return{dimRendu:false,rhRendu:false,ferRendu:false,hsRendu:false}; // heures brutes (vérification des bulletins)
  const ss=S.settings||{};
  const base={dimRendu:ss.dimRendu!==false,rhRendu:ss.rhRendu!==false,ferRendu:ss.ferRendu!==false,hsRendu:ss.hsRendu!==false};
  let result;
  if(!ss.settingsHistory||!ss.settingsHistory.length){result=base;}
  else{
    let active=null;
    for(const h of ss.settingsHistory){const hym=parseInt(h.since.split('-')[0])*12+(parseInt(h.since.split('-')[1])-1);if(hym<=ym)active=h;}
    result=active?{dimRendu:active.dimRendu!==false,rhRendu:active.rhRendu!==false,ferRendu:active.ferRendu!==false,hsRendu:active.hsRendu!==false}:base;
  }
  // Per-key monthly breakpoints — propagate forward (settingsMonthlyHistory)
  const smh=S.profile&&S.profile.settingsMonthlyHistory;
  if(smh){for(const k of _SMH_KEYS){const hist=smh[k];if(!hist||!hist.length)continue;let v=null;for(const e of hist){if(e.ym<=ym)v=e.value;}if(v!==null)result[k]=v;}}
  // Exact per-month overrides — this month only, highest priority (settingsMonthly)
  const sme=S.profile&&S.profile.settingsMonthly;
  if(sme&&sme[ym]){for(const k of _SMH_KEYS){if(k in sme[ym])result[k]=sme[ym][k];}}
  return result;
}
// Get the breakpoint at exactly ym for key (null if none)
function _smhGet(key,ym){const h=(S.profile&&S.profile.settingsMonthlyHistory&&S.profile.settingsMonthlyHistory[key])||[];return h.find(e=>e.ym===ym)||null;}
// Set or update a breakpoint
function _smhSet(key,ym,value){
  if(!S.profile.settingsMonthlyHistory)S.profile.settingsMonthlyHistory={};
  if(!S.profile.settingsMonthlyHistory[key])S.profile.settingsMonthlyHistory[key]=[];
  const hist=S.profile.settingsMonthlyHistory[key];
  const ex=hist.find(e=>e.ym===ym);
  if(ex){ex.value=value;}else{hist.push({ym,value});hist.sort((a,b)=>a.ym-b.ym);}
}
// Remove a breakpoint
function _smhDel(key,ym){
  if(!S.profile.settingsMonthlyHistory||!S.profile.settingsMonthlyHistory[key])return;
  S.profile.settingsMonthlyHistory[key]=S.profile.settingsMonthlyHistory[key].filter(e=>e.ym!==ym);
}
// Global selection state for annual grid
var _annualSel=new Set(),_annualSelYear=new Date().getFullYear();
var _annualPending=null;
var _annualActionState={dimRendu:null,rhRendu:null,ferRendu:null,hsRendu:null};
var _annualActionManual=false;
// ================================================================
// HELPERS EXPIRATION
function getEphExtensions(ym){
  if(S.profile&&S.profile.exp12)return 3;
  if(window._projAuto&&window._autoPlan&&window._autoPlan[ym])return 3; // calcul « sous réserve » : report auto prévu // option « valables un an » : comme si les trois reports étaient accordés (fin du 12e mois)
  const m=S.ephExtend&&S.ephExtend[ym];
  const a=S.autoExtend&&S.autoExtend[ym];
  const mv=m===true?1:typeof m==='number'?m:0;
  const av=typeof a==='number'?a:0;
  return Math.max(mv,av);
}
function getBaseExpYm(ym){return ym+3;}
// Ordre de consommation des heures éphémères : les plus anciennes d'abord (ordre d'acquisition), comme le gestionnaire
// (règle confirmée par la RH en octobre 2026) — un mois reporté reste pris avant les suivants, même s'il expire plus tard
// Rendu pris par le gestionnaire sur des heures acquises après coup (accepté depuis la comparaison) : ce mois-là lui est ouvert
function _rbw(k,ym){var f=S.profile&&S.profile.rendFrom,r=f&&f[k];return r!=null&&+r===ym;}
function _fifoYms(yms){return yms.map(Number).sort(function(a,b){return a-b;});}
// Heures dont la validité est passée mais que le dernier tableau Gestion compte encore dans son solde (« Alerte », sans report) :
// le solde du tableau fait foi, elles restent utilisables jusqu'à la fin du mois qui suit ce tableau (un tableau plus récent
// qui ne les compte plus les retire) ; signalées à part, comme « sans report officiel »
function _rhGraceYm(ym){var g=S&&S.profile&&S.profile.rhGrace;return g&&g[ym]!=null?+g[ym]:null;}
function getExpYm(ym){var b=ym+3+getEphExtensions(ym)*3,g=_rhGraceYm(ym);return g!=null?Math.max(b,g+1):b;}
// BUILD GEN
// ================================================================
// withDetail : renvoie aussi le détail jour par jour / semaine par semaine (comparaison avec le tableau RH)
function buildGen(withDetail){
  const det=withDetail?{}:null;
  const gen={};function add(ym,k,v,lbl){if(!gen[ym])gen[ym]={dim:0,rh:0,fer:0,hs:0,ram:0,extra:0,solde:0,monet:0,adj:0,adjr:0};gen[ym][k]+=v;if(det&&lbl){const dkk=ym+':'+k;(det[dkk]=det[dkk]||[]).push({lbl:lbl,v:v});}}
  const START=2026*12,maxYM=CUR_YEAR*12+11,maxYMDisplay=(CUR_YEAR+2)*12+11,VAC=getVAC();
  const createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:START;
  const solde=(S.profile&&S.profile.ephSolde)||0,split=_ephSplit();
  // Solde de départ : réparti par mois d'origine (repris du tableau RH) ou, à défaut, rattaché au mois précédant le suivi
  if(split&&Object.keys(split).length)Object.keys(split).forEach(function(ym){if(split[ym]>0)add(Number(ym),'solde',split[ym],'solde de départ');});
  else if(solde>0)add(createdYM>0?createdYM-1:createdYM,'solde',solde*60);
  for(let y=2025;y<=2030;y++)for(let m=0;m<12;m++){
    const ym=y*12+m;if(ym<createdYM||ym>TODAY_YM&&ym>maxYMDisplay)continue;
    const last=new Date(y,m+1,0).getDate();
    for(let d=1;d<=last;d++){const date=new Date(y,m,d),key=dk(date);const v2e=_gvK(date,'mj');const{vac,absent,echange,ecSelf}=v2e;if(!vac||vac==='RH'||absent)continue;if(echange&&!ecSelf)continue;// ec2: I give away, no rendu for me
const cKey=_cgK(key,'mj');if(cKey==='rend'||cKey==='rend-hist'||cKey==='cg'||cKey==='absent')continue;// vacation posée: pas de rendu dim/fer/RH
const dur=VAC[vac]?VAC[vac].dur:0;
      const isFer2=FERIES.has(key),isDim2=date.getDay()===0,isRH2=isRHDay(date);
      const _dMon=getMonday(date);const _dSun=new Date(_dMon);_dSun.setDate(_dMon.getDate()+6);const _dSunYm=_dSun.getFullYear()*12+_dSun.getMonth();
      const sett2b=settingsForYM(_dSunYm);
      const ferF=isFer2&&sett2b.ferRendu?2.0:0;
      const dimF=(isDim2&&sett2b.dimRendu)?0.5:0;
      const rhF=(!echange&&!isDim2&&isRH2&&sett2b.rhRendu)?0.5:0;
      const totF=ferF+dimF+rhF;
      if(totF===0)continue;
      if(ferF>0)add(_dSunYm,'fer',Math.round(dur*ferF/60*100)/100*60,key);
      if(dimF>0)add(_dSunYm,'dim',Math.round(dur*dimF/60*100)/100*60,key);
      if(rhF>0)add(_dSunYm,'rh',Math.round(dur*rhF/60*100)/100*60,key);}
  }
  // Heures monétisées : retirées du mois d'acquisition (elles ne sont plus à poser)
  Object.keys(S.monet||{}).forEach(function(k){var x=S.monet[k];if(x&&x.min>0)add(Number(k),'monet',-x.min,'monétisées');});
  const seenHS=new Set();
  for(let y=2025;y<=2030;y++)for(let m=0;m<12;m++){
    const ym=y*12+m;if(ym<createdYM||ym>TODAY_YM&&ym>maxYM)continue;
    const last=new Date(y,m+1,0).getDate();
    for(let d=1;d<=last;d++){const date=new Date(y,m,d),mon=getMonday(date),mk2=dk(mon);if(seenHS.has(mk2))continue;seenHS.add(mk2);
      const sun=new Date(mon);sun.setDate(mon.getDate()+6);
      const sunYm=sun.getFullYear()*12+sun.getMonth();
      const sunInScope=sunYm>=createdYM&&(sunYm<=TODAY_YM||sunYm<=maxYM);
      if(!sunInScope)continue;
      const sett=settingsForYM(sunYm);if(!sett.hsRendu)continue;
      const hsW=calcHSWeek(mon);if(hsW.rendusMin>0){
        if(hsW.rendusMinHS>0)add(sunYm,'hs',hsW.rendusMinHS,'S'+getISOWeek(mon));
        if(hsW.rendusMinRam>0)add(sunYm,'ram',hsW.rendusMinRam,'S'+getISOWeek(mon)+' (ramenée)');
      }}
  }
  // Différences acceptées depuis la comparaison avec le tableau Gestion (« faire comme le tableau ») : heures acquises (adj) ou
  // rendus déduits (adjr) du mois, en plus ou en moins
  var _ig=(S.profile&&S.profile.ignRhC)||{};Object.keys(_ig).forEach(function(k){var m=/^acq(\d+)/.exec(k),r=/^wkm(\d+)s/.exec(k),x=/^xfer(\d+)$/.exec(k),ym=m?+m[1]:r?+r[1]:x?+x[1]:null;
    if(ym!=null&&ym>=createdYM&&typeof _ig[k]==='number')add(ym,m?'adj':'adjr',x?-_ig[k]:_ig[k],'tableau Gestion');}); // xfer : pris sur ces heures au lieu du matelas
  Object.keys(S.extraRendus||{}).forEach(function(key){
    var d=new Date(key+'T12:00:00'),mon=getMonday(d),sun=new Date(mon);sun.setDate(mon.getDate()+6);
    var sunYm=sun.getFullYear()*12+sun.getMonth();
    if(sunYm>=createdYM)add(sunYm,'extra',(S.extraRendus[key].dur||0),key);
  });
  // Au-delà de 6 jours travaillés d'affilée : 7h de rendus par jour en plus, comptées d'office (sauf si déjà ajoutées à la main)
  // Le cycle seul ne dépasse jamais 6 jours : on ne regarde qu'autour des changements (modifications, échanges, semaines échangées, lignes)
  try{var _c0=dk(new Date(Math.floor(createdYM/12),createdYM%12,1,12)),_cand={},_near=function(k,a,b){for(var n=a;n<=b;n++)_cand[dk(_dAdd(k,n))]=1;};
    Object.keys(S.overrides||{}).forEach(function(k){_near(k,0,2*RULES.joursMax);});
    Object.keys(S.weekLines||{}).forEach(function(k){_near(k,0,6+2*RULES.joursMax);});
    ((S.profile&&S.profile.lineHistory)||[]).forEach(function(h){if(h.from)_near(h.from,0,2*RULES.joursMax);});
    Object.keys(_cand).sort().forEach(function(k){if(k<_c0||((S.extraRendus||{})[k]&&S.extraRendus[k].dur>0))return;var p=_streakPos(k);if(p>RULES.joursMax){
      var _mon=getMonday(new Date(k+'T12:00:00')),_sun=new Date(_mon);_sun.setDate(_mon.getDate()+6);add(_sun.getFullYear()*12+_sun.getMonth(),'extra',RULES.rendJourSup,k+' ('+p+'e jour d’affilée)');}});}catch(e){}
  return withDetail?{gen:gen,det:det}:gen;
}
// Compute potential gen for a single month with given settings (used for preview)
function buildPotentialForYM(ym,sett){
  const ty=Math.floor(ym/12),tm=ym%12;
  const VAC2=getVAC();
  const createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  const maxYM=CUR_YEAR*12+11;
  const res={dim:0,rh:0,fer:0,hs:0,ram:0,extra:0};
  const seenHS=new Set();
  const start=new Date(ty,tm,1-6),end=new Date(ty,tm+1,0);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const mon=getMonday(new Date(d));
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    const sunYm=sun.getFullYear()*12+sun.getMonth();
    if(sunYm!==ym)continue;
    const mk2=dk(mon);
    if(!seenHS.has(mk2)){
      seenHS.add(mk2);
      const sunInScope=sunYm>=createdYM&&(sunYm<=TODAY_YM||sunYm<=maxYM);
      if(sett.hsRendu&&sunInScope){const hsW=calcHSWeek(mon);if(hsW.rendusMinHS>0)res.hs+=hsW.rendusMinHS;if(hsW.rendusMinRam>0)res.ram+=hsW.rendusMinRam;}
    }
    const key=dk(d);const v2e=_gvK(d,'mj');const{vac,absent,echange,ecSelf}=v2e;
    if(!vac||vac==='RH'||absent)continue;if(echange&&!ecSelf)continue;
    const cKey=_cgK(key,'mj');if(cKey==='rend'||cKey==='rend-hist'||cKey==='cg'||cKey==='absent')continue;
    const dur=VAC2[vac]?VAC2[vac].dur:0;
    const isFer=FERIES.has(key),isDim=d.getDay()===0,isRH=isRHDay(d);
    const ferF=isFer&&sett.ferRendu?2.0:0,dimF=isDim&&sett.dimRendu?0.5:0,rhF=(!echange&&!isDim&&isRH&&sett.rhRendu)?0.5:0;
    if(ferF>0)res.fer+=Math.round(dur*ferF/60*100)/100*60;
    if(dimF>0)res.dim+=Math.round(dur*dimF/60*100)/100*60;
    if(rhF>0)res.rh+=Math.round(dur*rhF/60*100)/100*60;
  }
  return res;
}
function calcSoldes(){
  const gen=buildGen(),createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  const realEph={},prevEph={};
  for(let ym=createdYM;ym<=TODAY_YM;ym++)realEph[ym]=0;
  Object.keys(gen).forEach(ymStr=>{const ym=Number(ymStr),total=Object.values(gen[ym]).reduce((s,v)=>s+v,0),expYm=getExpYm(ym);if(ym>TODAY_YM){prevEph[ym]=total;return;}realEph[ym]=expYm<TODAY_YM?0:total;});
  // FIFO: deduct all rendus from combined stock — credit month must be <= rendu month (no borrowing from future months)
  const _fifoWarnKeys=new Set();
  const preExpiry={};
  {
    const _mK=new Set(Object.keys(S.matelasKeys||{}));
    const _rendKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend').sort();
    const _sim={};
    // Use historical gen totals (not expiry-zeroed realEph) so past rendu days consume the correct month's stock.
    // Expiry (reports included, as the RH table does) is enforced by the getExpYm(_ym)<_poseYm check in the loop below.
    Object.keys(realEph).forEach(function(ym){var ymN=Number(ym);_sim[ymN]=gen[ymN]?Object.values(gen[ymN]).reduce(function(s,v){return s+v;},0):0;});
    Object.keys(prevEph).forEach(function(ym){_sim[ym]=(_sim[ym]||0)+prevEph[ym];});
    _rendKeys.forEach(function(k){
      const _d=new Date(k+'T12:00:00'),_poseYm=_d.getFullYear()*12+_d.getMonth(),_dur=getDur(_d);
      let _left=_dur;
      const _yms=_fifoYms(Object.keys(_sim));
      for(const _ym of _yms){
        if(_sim[_ym]<=0||getExpYm(_ym)<_poseYm||_ym>_poseYm&&!_rbw(k,_ym))continue;
        const _take=Math.min(_sim[_ym],_left);_sim[_ym]-=_take;_left-=_take;
        if(_left<=0)break;
      }
      if(_left>0&&!_mK.has(k))_fifoWarnKeys.add(k);
    });
    // Capture pre-expiry balance for expired months before zeroing (needed for auto-report check)
    Object.keys(realEph).forEach(function(ym){var ymN=Number(ym);if(getExpYm(ymN)<TODAY_YM)preExpiry[ymN]=Math.max(0,_sim[ymN]||0);});
    // Apply expiry after FIFO: expired months are 0 regardless of remaining sim balance
    Object.keys(realEph).forEach(function(ym){var ymN=Number(ym);realEph[ymN]=getExpYm(ymN)<TODAY_YM?0:Math.max(0,_sim[ymN]||0);});
    Object.keys(prevEph).forEach(function(ym){prevEph[ym]=Math.max(0,(_sim[ym]||0));});
  }
  let toDeduct=0;
  const realAvail={};Object.keys(realEph).map(Number).sort().forEach(ym=>realAvail[ym]=realEph[ym]);
  for(const ym of Object.keys(realAvail).map(Number).sort()){if(toDeduct<=0)break;const take=Math.min(realAvail[ym],toDeduct);realAvail[ym]-=take;toDeduct-=take;}
  let matelas=(S.profile&&S.profile.matelas)||0;if(toDeduct>0)matelas-=toDeduct;
  return{gen,realEph,realAvail,prevEph,preExpiry,matelas,warnKeys:_fifoWarnKeys,totalReal:Object.values(realAvail).reduce((s,v)=>s+v,0),totalPrev:Object.keys(prevEph).map(Number).filter(ym=>ym<=CUR_YEAR*12+11).reduce((s,ym)=>s+(prevEph[ym]||0),0)};
}
// ================================================================
// CONGÉS ANNUELS
// ================================================================
function getSoldeAnnee(year){
  const pa=S.profile&&S.profile.congesParAnnee;
  if(pa&&pa[year]!==undefined)return pa[year];
  return 25;
}
function setSoldeAnnee(year,val){
  if(!S.profile)return;
  if(!S.profile.congesParAnnee)S.profile.congesParAnnee={};
  S.profile.congesParAnnee[year]=val;
}
function getCETForYear(year){
  if(S.profile&&S.profile.congesCET&&!S.profile.congesCETParAnnee){
    S.profile.congesCETParAnnee={};
    S.profile.congesCETParAnnee[NOW.getFullYear()]=S.profile.congesCET;
    delete S.profile.congesCET;
  }
  return((S.profile&&S.profile.congesCETParAnnee)||{})[year]||0;
}
function calcCongesUsedForYear(year){
  // Filter conges keys to that year only, then apply full calcCongesUsed logic
  const allCgKeys=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').sort();
  const yearKeys=allCgKeys.filter(k=>k.startsWith(String(year)+'-'));
  if(!yearKeys.length)return 0;
  const cgSet=new Set(allCgKeys);// full set for écart rule

  function isFullWeekCP(monday){
    const monKey=dk(monday);
    if(!cgSet.has(monKey))return false;
    for(var i=0;i<7;i++){
      const d=new Date(monday);d.setDate(monday.getDate()+i);
      const v2=getVac(d);
      const isWorked=v2.vac&&v2.vac!=='RH'&&!v2.absent;
      if(isWorked&&!cgSet.has(dk(d)))return false;
    }
    return true;
  }
  const fullWeeks=new Set(),seenMon=new Set();let total=0;
  yearKeys.forEach(function(k){
    const d=new Date(k+'T12:00:00'),mon=getMonday(d),mk=dk(mon);
    if(seenMon.has(mk))return;seenMon.add(mk);
    if(isFullWeekCP(mon)){fullWeeks.add(mk);total+=5;}
  });
  const partialKeys=yearKeys.filter(function(k){
    const d=new Date(k+'T12:00:00');return!fullWeeks.has(dk(getMonday(d)));
  });
  if(!partialKeys.length)return total;
  function findReprise(fromDate){
    const sd=new Date(fromDate);sd.setDate(sd.getDate()+1);
    while(sd<=new Date('2031-01-01')){
      const v2=getVac(sd);if(v2.vac&&v2.vac!=='RH'&&!v2.absent)return new Date(sd);
      sd.setDate(sd.getDate()+1);}return null;
  }
  const groups={};
  partialKeys.forEach(function(k){
    const d=new Date(k+'T12:00:00'),r=findReprise(d),rk=r?dk(r):'none';
    if(!groups[rk])groups[rk]={reprise:r,dates:[]};groups[rk].dates.push(d);
  });
  Object.values(groups).forEach(function(g){
    const nb=g.dates.length;if(!g.reprise){total+=nb;return;}
    const lastCp=new Date(Math.max.apply(null,g.dates));
    const ecart=Math.round((g.reprise-lastCp)/(864e5))-1;
    total+=nb+Math.max(0,ecart-2);
  });
  return total;
}
// Jours flottants : 1 par férié tombant un dimanche, 4 max par an
function getFlottants(year){
  let n=0;
  for(const k of FERIES){if(k.startsWith(year+'')&&new Date(k+'T12:00:00').getDay()===0)n++;}
  return Math.min(4,n);
}
// Fractionnés : forfait ancienneté (3 j) + 1 j si ≥5 CG du 15/01 au 15/03 + 1 j si ≥5 CG du 15/09 au 30/11
function getFractionnes(year){
  const d1s=new Date(year,0,15),d1e=new Date(year,2,15),d2s=new Date(year,8,15),d2e=new Date(year,10,30);
  let cgWinter=0,cgAutumn=0;
  Object.keys(S.conges||{}).forEach(function(k){if(S.conges[k]!=='cg'||!k.startsWith(year+''))return;const d=new Date(k+'T12:00:00');if(d>=d1s&&d<=d1e)cgWinter++;if(d>=d2s&&d<=d2e)cgAutumn++;});
  const forfait=getFractForfait(year),base=forfait?3:0,hiver=cgWinter>=5?1:0,automne=cgAutumn>=5?1:0;
  return{forfait,base,hiver,automne,cgWinter,cgAutumn,total:base+hiver+automne};
}
// Total des droits à congés de l'année (hors CET et jours posés)
function getCongesDroits(year){return getSoldeAnnee(year)+getCongesAnc(year)+getFractionnes(year).total+getFlottants(year);}
// Congés restants de l'année : principaux + ancienneté + fractionnés + flottants − posés − versés au CET cette année-là
// (même calcul que l'affichage « Congés restants »)
function computeCongesRest(year){
  return getCongesDroits(year)-calcCongesUsedForYear(year)-getCETForYear(year);
}
function calcCongesUsed(){
  // Total tous azimuts (pour compat récap, etc.) — somme sur toutes les années présentes dans S.conges
  const allYears=[...new Set(Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').map(k=>parseInt(k.slice(0,4))))];
  return allYears.reduce((s,y)=>s+calcCongesUsedForYear(y),0);
}
function calcCongesAncJours(years){if(years>=25)return 4;if(years>20)return 3;if(years>15)return 2;if(years>5)return 1;return 0;}
function getCongesAnc(year){const pr=S.profile||{};const ym=year*12+11;let yrs=0;if(pr.ancYears!=null&&pr.ancRefYM!=null){const anni=typeof pr.ancMoisAnni==='number'&&pr.ancMoisAnni>=0?pr.ancMoisAnni:-1;yrs=pr.ancYears;if(anni>=0){const minYM=Math.min(pr.ancRefYM,ym),maxYM=Math.max(pr.ancRefYM,ym);let cnt=0;for(let y=Math.floor(minYM/12);y<=Math.floor(maxYM/12)+1;y++){const aym=y*12+anni;if(aym>minYM&&aym<=maxYM)cnt++;}yrs=ym>=pr.ancRefYM?yrs+cnt:yrs-cnt;}yrs=Math.max(0,yrs);}else if(pr.ancYears!=null)yrs=pr.ancYears;return calcCongesAncJours(yrs);}
function adjCongesAnc(year,delta){}
function getFractForfait(year){
  if(_getAncYrsForYM(year*12+11)<1)return false;
  if(!S.profile||!S.profile.fractForfaitParAnnee)return true;
  return S.profile.fractForfaitParAnnee[year]!==false;
}
// Anneau des congés : longueur visible (L), rotation (r) et épaisseur (w) de chaque arc (vert, CET, posés).
// Chaque jour occupe exactement la même part du cercle : l'étendue visible d'un arc (bouts arrondis compris) vaut sa part moins
// un petit écart. Un arc trop court pour ses bouts arrondis devient un point de diamètre proportionnel.
// Un seul arc : cercle complet (l'écart se referme progressivement quand les autres disparaissent).
function _cgGeo(fg,fc,fu){var C=2*Math.PI*27,w=8,gp=3,D=w+gp,fs={g:fg,c:fc,u:fu},K=['g','c','u'],S={},o={},big='g';
  K.forEach(function(k){S[k]=Math.max(0,fs[k]||0)*C;if(S[k]>S[big])big=k;});
  var q=Math.min(1,(C-S[big])/D),a=0; // q : 0 avec un seul arc (cercle complet), 1 dès que les autres ont la place d'un bout arrondi
  K.forEach(function(k){var x=S[k],ext=x-q*gp;
    if(ext<=0.01)o[k]={L:0,r:a/C*360,w:0,o:0};
    else if(ext>=w||k===big)o[k]={L:Math.max(0.01,ext-q*w),r:(a+q*D/2)/C*360,w:w,o:1};
    else o[k]={L:0.01,r:(a+x/2)/C*360,w:ext,o:1}; // point : centré dans sa part, diamètre = sa part
    a+=x;});
  return o;}
function tvSlot(vac){
  const deb=_toMinApp((getVAC()[vac]||{}).deb);
  if(deb===null||deb===undefined||isNaN(deb))return'tv';
  if(deb<480)return'tv-am';
  if(deb<840)return'tv';
  return'tv-pm';
}
function getState(date){
  const key=dk(date),v2=getVac(date),{vac,ov,fromSV,absent,echange,ecSelf}=v2;
  if(absent)return'absent';
  const c=(S.conges||{})[key];
  // Échange: ec=rouge (I work it), ec2=grey (colleague covers)
  if(echange){
    if(!ecSelf)return FERIES.has(key)?'ec2-fer':'ec2';
    if(FERIES.has(key))return'ec-fer';
    return'ec';
  }
  if(FERIES.has(key)){
    if(c==='cg')return'cg-fer';
    if(c==='rend'||c==='rend-hist')return'rend-fer';
    if(absent)return'absent-fer';
    if(!ecSelf&&echange)return'ec2-fer';
    if(vac&&vac!=='RH')return fromSV?'sv-vac-fer':(tvSlot(vac)+'-fer');
    return'fer';
  }
  if(!vac){
    const _ovr=(S.overrides||{})[key];
    return(_ovr&&_ovr.fromSV&&!_ovr.echange)?'sv-ov':'sv';
  }
  if(vac==='RH')return'rh';
  if(c==='cg')return'cg';if(c==='rend'||c==='rend-hist')return'rend';
  if(ov&&!fromSV&&vac&&vac!=='RH')return FERIES.has(key)?'tv-ov-fer':'tv-ov';
  return fromSV?'sv-vac':tvSlot(vac);
}
function buildRameeSet(y,m){
  const set=new Set(),seen=new Set(),last=new Date(y,m+1,0).getDate();
  for(let d=1;d<=last;d++){const date=new Date(y,m,d),mon=getMonday(date),mk=dk(mon);if(seen.has(mk))continue;seen.add(mk);if(isSemaineRamenée(mon)){for(let i=0;i<7;i++){const dd=new Date(mon);dd.setDate(mon.getDate()+i);set.add(dk(dd));}}}
  return set;
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
// Grille des 12 mois d'une année (vue annuelle)
function _annHtml(y){
  let html='';
  for(let m=0;m<12;m++){
    const isSel=m===curM&&y===_annSelY,first=new Date(y,m,1),last=new Date(y,m+1,0);
    let sdow=first.getDay();sdow=sdow===0?6:sdow-1;const rameeSet=buildRameeSet(y,m);
    let mini='';for(let i=0;i<sdow;i++)mini+=`<div class="ann-day sv"></div>`;
    for(let d=1;d<=last.getDate();d++){const date=new Date(y,m,d),key=dk(date),st=getState(date);mini+=`<div class="ann-day ${st}"></div>`;}
    // Toujours 6 lignes : la grille garde la même hauteur d'une année à l'autre (le sider ne bouge pas)
    for(let i=sdow+last.getDate();i<42;i++)mini+=`<div class="ann-day sv"></div>`;
    const isCur=y===NOW.getFullYear()&&m===NOW.getMonth();
    const annCls=isSel&&isCur?'sel cur-month':isSel?'sel':isCur?'cur-month':'';
    html+=`<div class="ann-month${annCls?' '+annCls:''}" onclick="goToMonth(${m})"><div class="ann-mname">${ML[m]}</div><div class="ann-mini">${mini}</div></div>`;
  }
  return html;
}
// Accueil : accès au Récap avec l'état des vérifications (bulletins, tableau Gestion)
function _recapCol(col,y){
  var bad=0,n=0;
  // un point par problème (ligne en écart non ignorée), comme la case Écart Paie de Suivi, et non un par bulletin
  // toutes les années : un écart non corrigé ne disparaît pas au 1er janvier
  Object.keys(S.bulletins||{}).forEach(function(k){n++;var c;try{c=_bulCompare(S.bulletins[k]);}catch(e){return;}if(c.status==='ecart'&&!_bulIgn(+k,c))bad+=(c.badList&&c.badList.length)||1;});
  var c=S.profile&&S.profile.rhCmp;if(c){n++;bad+=c.n||0;} // tableau Gestion : ses différences et ses heures sans report, comme les lignes de Suivi
  try{var RS=_ruleScanNow(),nr=RS.hard.length+RS.rest.length+RS.streak.length;if(nr){n++;bad+=nr;}}catch(e){} // règles de travail : un par jour signalé, comme dans Suivi
  var val=!n?'—':bad?'⚠ '+bad:'✓',color=bad?'var(--amber)':'var(--green)',sub=!n?'bilan':bad?'à vérifier':'conforme';
  return col('Suivi',val,color,sub,'openMergedRenduCgModal(6,2)');
}
// Report automatique (règle du gestionnaire) : un mois dont il reste 7h ou moins à son échéance est reporté de 3 mois,
// de nouveau à chaque échéance tant qu'il en reste 7h ou moins, jusqu'à 12 mois. Appliqué à l'échéance, comme le gestionnaire.
// Avant l'échéance, un mois à 7h ou moins est « report auto prévu » (window._autoPlan) : ses heures ne sont pas comptées comme
// libres, mais un rendu posé après l'échéance qui en dépend est « couvert sous réserve » (pas basculé sur le matelas).
function _withProj(fn){var p=window._projAuto;window._projAuto=1;try{return fn();}finally{window._projAuto=p;}}
// Reports d'un mois tels qu'ils étaient à une date (tableau Gestion) : les reports automatiques pas encore déclenchés ne comptent pas
function getEphExtAt(ym,refYM){if(S.profile&&S.profile.exp12)return 3;var m=S.ephExtend&&S.ephExtend[ym],man=m===true?1:typeof m==='number'?m:0,a=(S.autoExtend&&S.autoExtend[ym])||0,L=man;
  for(var i=man+1;i<=a;i++)if(ym+3+3*(i-1)<=refYM)L=i;return Math.max(L,man);}
function ephBarColor(moLeft,isExp){
  if(isExp)return'#555';
  if(moLeft<=0)return'#E24B4A';
  if(moLeft>=3)return'var(--rend-text)';
  if(moLeft<=1){
    const t=moLeft;
    const r=Math.round(226+(186-226)*t);const g=Math.round(75+(152-75)*t);const b=Math.round(74+(23-74)*t);
    return'rgb('+r+','+g+','+b+')';
  } else {
    const t=(moLeft-1)/2;
    const r=Math.round(186+(168-186)*t);const g=Math.round(152+(191-152)*t);const b=Math.round(23+(122-23)*t);
    return'rgb('+r+','+g+','+b+')';
  }
}
function calcPaniersMois(y,m){
  let c=0;const mym=y*12+m,seenW=new Set(),last=new Date(y,m+1,0).getDate();
  for(let dd=-6;dd<last;dd++){const date=new Date(y,m,1+dd),mon=getMonday(date),mk=dk(mon);if(seenW.has(mk))continue;seenW.add(mk);const sun=new Date(mon);sun.setDate(mon.getDate()+6);if(sun.getFullYear()*12+sun.getMonth()!==mym)continue;for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const key=dk(d);const _g=getVac(d);if(_g.echange&&!_g.ecSelf)continue;if(isPanier(d)&&!(S.conges||{})[key])c++;else if(_excKeep(key,'pn')){const _kv=getVAC(d)[getCycleVac(d).cycleVac];if(_kv&&_kv.panier)c++;}}}
  return c;
}
function calcPrimesMois(y,m){
  let antenne=0,reel=0,coord=0,matin=0;const mym=y*12+m,seenW=new Set(),last=new Date(y,m+1,0).getDate();const VAC=getVAC();
  for(let dd=-6;dd<last;dd++){const date=new Date(y,m,1+dd),mon=getMonday(date),mk=dk(mon);if(seenW.has(mk))continue;seenW.add(mk);const sun=new Date(mon);sun.setDate(mon.getDate()+6);if(sun.getFullYear()*12+sun.getMonth()!==mym)continue;for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const key=dk(d);if(_excKeep(key,'pr')||_excKeep(key,'mt')){const _kv=VAC[getCycleVac(d).cycleVac];if(_kv){if(_excKeep(key,'mt')&&_isMatin(d,_kv))matin++;if(_excKeep(key,'pr')&&_kv.primes){if(_kv.primes.antenne)antenne++;if(_kv.primes.reel)reel++;if(_kv.primes.coord)coord++;}}continue;}if((S.conges||{})[key])continue;const{vac,absent,echange,ecSelf}=getVac(d);if(absent)continue;if(echange&&!ecSelf)continue;if(!vac||vac==='RH')continue;const pvac=getPayVac(d);const v=VAC[pvac];if(!v)continue;if(_isMatin(d,v))matin++;if(!v.primes)continue;if(v.primes.antenne)antenne++;if(v.primes.reel)reel++;if(v.primes.coord)coord++;}}
  return{antenne,reel,coord,matin};
}
function fmtEuro(n){if(!isFinite(n)||isNaN(n))n=0;const abs=Math.abs(n).toFixed(2);const[int,dec]=abs.split('.');const intFmt=int.replace(/\B(?=(\d{3})+(?!\d))/g,' ');return(n<0?'-':'')+intFmt+','+dec+' €';}
function calcPalierSalaire(n){const base=2091.75;if(n<1)return base;if(n<=44)return Math.floor(base*Math.pow(1.015,n-19)*100)/100;const p44=Math.floor(base*Math.pow(1.015,25)*100)/100;return Math.floor(p44*Math.pow(1.0075,n-44)*100)/100;}
var _DPC={primes:[{id:'nao2022',label:'NAO 2022',montant:130,debutYM:0,finYM:null},{id:'nao2023',label:'NAO 2023',montant:55,debutYM:0,finYM:null}],gpe:[{debutYM:0,t:[20,52,62,128,154,159,172,187,231]}],pfa:[{debutYM:0,t:[{max:1,v:240},{max:3,v:230},{max:5,v:220},{max:8,v:210},{max:17,v:200},{max:22,v:190},{max:30,v:170},{max:9999,v:160}]}],anc:[{debutYM:0,base:2091.75,rate1:0.01,rate2:0.005,threshold:20}]};
function getPayConfig(){return window._globalPayConfig||{};}
// Grève : retenue de 1/160ᵉ (heure), 1/50ᵉ (demi-journée), 1/30ᵉ (journée) du salaire mensuel ; modifiable dans l'admin (Convention)
var _DEF_GREVE={h:160,dj:50,j:30,base:'qag',txt:'Le décompte se fait à l’heure (1/160ᵉ), à la demi-journée (1/50ᵉ) ou à la journée (1/30ᵉ). On peut entrer et sortir de la grève à tout moment, dans la limite d’une heure par journée, d’une demi-journée ou d’une journée. Si la grève touche plus d’une vacation, une journée complète est décomptée. Toute sortie de grève au sein d’une vacation est définitive. L’entrée en grève se constate à la prise de poste : prévenir sa hiérarchie, au moins par mail, d’une sortie (ou d’une entrée et d’une sortie) en cours de planification, sinon la journée entière est décomptée. Pour les salariés affectés à l’édition, la fabrication ou la diffusion de l’antenne : se déclarer dès la prise de poste pour la première heure, la première demi-journée ou la journée.'};
function getGreveConf(){var g=getPayConfig().greve||{};return Object.assign({},_DEF_GREVE,g);}
function _pcLatest(arr,ym,def){var a=(arr||[]).filter(function(e){return e.debutYM<=ym;});if(a.length)return a.sort(function(a,b){return b.debutYM-a.debutYM;})[0];return(arr&&arr.length)?arr.sort(function(a,b){return b.debutYM-a.debutYM;})[0]:def;}
function getPrimesConvAllForYM(ym){var pc=getPayConfig();var src=pc.primes&&pc.primes.length?pc.primes:_DPC.primes;return src.filter(function(p){return p.debutYM<=ym&&(p.finYM==null||ym<=p.finYM);});}
// Primes de la convention (NAO…) : chaque profil peut décocher celles qu'il ne touche pas
function getPrimesConvForYM(ym,prof){var off=((prof||S.profile||{}).primesConvOff)||{};return getPrimesConvAllForYM(ym).filter(function(p){return !off[p.id];});}
function calcPFA(n,ym){var pc=getPayConfig();var e=_pcLatest(pc.pfa,ym!=null?ym:TODAY_YM,_DPC.pfa[0]);if(!e)e=_DPC.pfa[0];for(var i=0;i<e.t.length;i++){if(n<=e.t[i].max)return e.t[i].v;}return e.t[e.t.length-1].v;}
function calcGPE(g,ym){if(!(g>=1&&g<=9))return 0;var pc=getPayConfig();var e=_pcLatest(pc.gpe,ym!=null?ym:TODAY_YM,_DPC.gpe[0]);if(!e)e=_DPC.gpe[0];return e.t[g-1]||0;}
function calcAncPrime(years,ym){var pc=getPayConfig();var e=_pcLatest(pc.anc,ym!=null?ym:TODAY_YM,_DPC.anc[0]);if(!e)e=_DPC.anc[0];var b=e.base,r1=e.rate1,r2=e.rate2,th=e.threshold;var y=parseFloat(years)||0;if(y<=0)return 0;if(y<=th)return Math.round(y*r1*b*100)/100;return Math.round((th*r1+(y-th)*r2)*b*100)/100;}
function calcAncYearsFromYM(entreeYM,ym){const eY=Math.floor(entreeYM/12),eM=entreeYM%12,cY=Math.floor(ym/12),cM=ym%12;return Math.max(0,cY-eY-(cM<eM?1:0));}
function _getAncYrsForYM(ym){const pr=S.profile||{};if(pr.ancYears!=null&&pr.ancRefYM!=null){const anni=typeof pr.ancMoisAnni==='number'&&pr.ancMoisAnni>=0?pr.ancMoisAnni:-1;let yrs=pr.ancYears;if(anni>=0){const minYM=Math.min(pr.ancRefYM,ym),maxYM=Math.max(pr.ancRefYM,ym);let cnt=0;for(let y=Math.floor(minYM/12);y<=Math.floor(maxYM/12)+1;y++){const aym=y*12+anni;if(aym>minYM&&aym<=maxYM)cnt++;}yrs=ym>=pr.ancRefYM?yrs+cnt:yrs-cnt;}return Math.max(0,yrs);}if(pr.ancEntreeYM!=null)return calcAncYearsFromYM(pr.ancEntreeYM,ym);if(pr.ancYearsHistory&&pr.ancYearsHistory.length)return _getHistVal(pr.ancYearsHistory,pr.ancYears||0,ym);return pr.ancYears!=null?pr.ancYears:0;}
function _getHistVal(hist,fb,ym){if(hist&&hist.length){let v=null;for(const e of hist)if(e.ym<=ym)v=e.v;if(v!==null)return v;}return fb;}
function getPalierForYM(ym){return _getHistVal((S.profile||{}).palierHistory,(S.profile||{}).palierNum||0,ym);}
function getGroupeForYM(ym){const pr=S.profile||{};return _getHistVal(pr.groupeHistory||[],pr.groupeClassif||0,ym);}
function getSupFamilialForYM(ym){const pr=S.profile||{};return _getHistVal(pr.supFamilialHistory||[],pr.supFamilial||0,ym);}
function getAncForYM(ym){const pr=S.profile||{};if(pr.ancYears!=null&&pr.ancRefYM!=null){const anni=typeof pr.ancMoisAnni==='number'&&pr.ancMoisAnni>=0?pr.ancMoisAnni:-1;let yrs=pr.ancYears;if(anni>=0){const minYM=Math.min(pr.ancRefYM,ym),maxYM=Math.max(pr.ancRefYM,ym);let cnt=0;for(let y=Math.floor(minYM/12);y<=Math.floor(maxYM/12)+1;y++){const aym=y*12+anni;if(aym>minYM&&aym<=maxYM)cnt++;}yrs=ym>=pr.ancRefYM?yrs+cnt:yrs-cnt;}return calcAncPrime(Math.max(0,yrs),ym);}if(pr.ancEntreeYM!=null)return calcAncPrime(calcAncYearsFromYM(pr.ancEntreeYM,ym),ym);if(pr.ancYearsHistory&&pr.ancYearsHistory.length){const y=_getHistVal(pr.ancYearsHistory,pr.ancYears||0,ym);return calcAncPrime(y,ym);}if(pr.ancYears!=null)return calcAncPrime(pr.ancYears,ym);return _getHistVal(pr.ancHistory,pr.primeAnciennete||0,ym);}
function getHeuresForYM(ym){return _getHistVal((S.profile||{}).heuresHistory,(S.profile||{}).heuresMensuelles||151.67,ym);}
function calcDimRHFerMinsMois(y,m){
  const mym=y*12+m,sett=settingsForYM(mym),seenW=new Set(),last=new Date(y,m+1,0).getDate();const VAC=getVAC();let dim=0,rh=0,fer=0;
  for(let dd=-6;dd<last;dd++){const date=new Date(y,m,1+dd),mon=getMonday(date),mk=dk(mon);if(seenW.has(mk))continue;seenW.add(mk);const sun=new Date(mon);sun.setDate(mon.getDate()+6);if(sun.getFullYear()*12+sun.getMonth()!==mym)continue;
    for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const key=dk(d);const cKey=_cgK(key,'mj');if(cKey&&(cKey==='cg'||cKey==='rend'||cKey==='rend-hist'||cKey==='absent'))continue;const{vac:_rawVac,absent,echange,ecSelf}=_gvK(d,'mj');if(!_rawVac||_rawVac==='RH'||absent)continue;if(echange&&!ecSelf)continue;const dur=VAC[_rawVac]?VAC[_rawVac].dur:0;if(!dur)continue;const isFer=FERIES.has(key),isDim=d.getDay()===0,isRH=isRHDay(d);
      // férié se cumule avec dimanche ou RH (comme buildGen) ; dimanche et RH, eux, ne se cumulent pas
      if(isFer&&!sett.ferRendu)fer+=dur;
      if(isDim&&!sett.dimRendu)dim+=dur;
      else if(isRH&&!echange&&!sett.rhRendu)rh+=dur;}}
  return{dim,rh,fer};
}
function calcHSMinsMois(y,m){
  const mym=y*12+m,sett=settingsForYM(mym);
  if(sett.hsRendu)return{low:0,high:0};
  const seenW=new Set(),last=new Date(y,m+1,0).getDate();let low=0,high=0;
  for(let dd=-6;dd<last;dd++){const date=new Date(y,m,1+dd),mon=getMonday(date),mk=dk(mon);if(seenW.has(mk))continue;seenW.add(mk);const sun=new Date(mon);sun.setDate(mon.getDate()+6);if(sun.getFullYear()*12+sun.getMonth()!==mym)continue;const hsW=calcHSWeek(mon);low+=hsW.rawLow;high+=hsW.rawHigh;}
  return{low,high};
}
// Version datée en vigueur au mois ym (la plus ancienne si ym précède toutes les versions, la plus récente si ym absent)
function _pcPick(arr,ym){const srt=arr.slice().sort(function(a,b){return a.debutYM-b.debutYM;});let e=srt[0];if(ym!=null)srt.forEach(function(x){if(x.debutYM<=ym)e=x;});else e=srt[srt.length-1];return e;}
function getPanierRate(ym){const pc=getPayConfig();const arr=pc.panier&&pc.panier.length?pc.panier:[{debutYM:0,v:pc.panierRate!=null?pc.panierRate:7.50}];return _pcPick(arr,ym).v;}
// Taux des primes par vacation (€) et majorations (%) — éditables dans l'admin (onglet Convention)
const _DEF_TAUX={debutYM:0,antenne:17.38,matin:17.38,reel:34.76,coord:17.38,dim:30,rh:30,fer:200,hsLow:125,hsHigh:150,nuit:40};
function getTauxForYM(ym){const pc=getPayConfig();return Object.assign({},_DEF_TAUX,pc.taux&&pc.taux.length?_pcPick(pc.taux,ym):{});}
// Prime spéciale d'un jour (formateur, prime ponctuelle…) : rattachée au mois de la semaine, comme les autres primes
function calcDayPrimesMois(y,m){
  var mym=y*12+m,out=[],tot=0;Object.keys(S.dayPrimes||{}).forEach(function(k){var p=S.dayPrimes[k];if(!p||!(p.amt>0))return;
    var d=new Date(k+'T12:00:00'),sun=getMonday(d);sun.setDate(sun.getDate()+6);if(sun.getFullYear()*12+sun.getMonth()!==mym)return;
    out.push({key:k,lbl:p.lbl||'Prime spéciale',amt:p.amt});tot+=p.amt;});
  out.sort(function(a,b){return a.key<b.key?-1:1;});return{list:out,total:Math.round(tot*100)/100};
}
function calcVariablesMois(y,m,overrideTauxH){
  const mym_cv=y*12+m;const pr=S.profile||{};const _pn=getPalierForYM(mym_cv);const salQ=_pn>0?calcPalierSalaire(_pn):(pr.salaireQualif||0);const salAnc=getAncForYM(mym_cv);const heures=getHeuresForYM(mym_cv);const base=salQ+salAnc;const tauxH=overrideTauxH!=null?overrideTauxH:(heures>0?Math.round(base/151.67*100)/100:0); // taux horaire : base temps plein / 151,67 (accord VII.3.3), même à temps partiel
  const drf=calcDimRHFerMinsMois(y,m);const hs=calcHSMinsMois(y,m);const nuitMin=calcNuitMois(y,m);const primes=calcPrimesMois(y,m);const paniers=calcPaniersMois(y,m);
  const r2=v=>Math.round(v*100)/100;
  const tx=getTauxForYM(mym_cv);
  const supDim=r2(drf.dim/60*tauxH*tx.dim/100),supRH=r2(drf.rh/60*tauxH*tx.rh/100),supFer=r2(drf.fer/60*tauxH*tx.fer/100);
  const supHSlow=r2(hs.low/60*tauxH*tx.hsLow/100),supHShigh=r2(hs.high/60*tauxH*tx.hsHigh/100);
  const supNuit=r2(nuitMin/60*tauxH*tx.nuit/100);
  const pc=getPayConfig();const absRestoRate=pc.absRestoRate!=null?pc.absRestoRate:5.34;
  var supAbsResto=0;
  if(m===4){
    var _may1=new Date(y,4,1),_m1k=dk(_may1),_m1v=getVac(_may1),_m1cg=(S.conges||{})[_m1k];
    if(_m1v.vac&&_m1v.vac!=='RH'&&!_m1v.absent&&!(_m1cg==='cg'||_m1cg==='rend'||_m1cg==='rend-hist'||_m1cg==='absent')){
      var _m1pv=_m1v.vac,_m1vi=_m1pv?getVAC()[_m1pv]:null; // vacation réellement faite, comme le panier
      if(_m1vi){var _m1total=parseHM(_m1vi.fin)-parseHM(_m1vi.deb);if(_m1total<0)_m1total+=1440;var _m1pause=_m1total-(_m1vi.dur||0);if(_m1pause>=45)supAbsResto=r2(absRestoRate);}
    }
  }
  const panierRate=getPanierRate(mym_cv),supPaniers=r2(paniers*panierRate),supAntenne=r2(primes.antenne*tx.antenne),supMatin=r2(primes.matin*tx.matin),supReal=r2(primes.reel*tx.reel),supCoord=r2(primes.coord*tx.coord);
  const dpr=calcDayPrimesMois(y,m),supSpec=dpr.total;
  // Rendus monétisés ce mois-ci (payés sur le bulletin suivant) : heures × taux horaire de base
  let monetMin=0;Object.keys(S.monet||{}).forEach(function(k){var x=S.monet[k];if(x&&x.req===mym_cv)monetMin+=x.min;});const supMonet=r2(monetMin/60*tauxH);
  const total=supDim+supRH+supFer+supHSlow+supHShigh+supNuit+supAbsResto+supAntenne+supMatin+supReal+supCoord+supSpec+supMonet;
  return{total,supSpec,supMonet,monetMin,specList:dpr.list,tauxH,supDim,supRH,supFer,supHSlow,supHShigh,supNuit,supPaniers,panierRate,tx,supAbsResto,absRestoRate,supAntenne,supMatin,supReal,supCoord,dimMin:drf.dim,rhMin:drf.rh,ferMin:drf.fer,hsLow:hs.low,hsHigh:hs.high,nuitMin,paniers,antenne:primes.antenne,matin:primes.matin,reel:primes.reel,coord:primes.coord};
}
function _pfPeriod(p){var M=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'],f=function(x){return M[x%12]+' '+Math.floor(x/12);};
  return (p.debutYM>0?' · depuis '+f(p.debutYM):'')+(p.finYM!=null?' · jusqu’à '+f(p.finYM):'');}
function getPrimesFixesCustomForYM(ym){
  const primes=(S.profile&&S.profile.primesFixesCustom)||[];
  return primes.filter(function(p){return p.debutYM<=ym&&(p.finYM==null||ym<=p.finYM);});
}
// Un mois sans cycle de travail (avant le début du planning, entre deux cycles) n'a pas de salaire estimé
function _hasCycleMonth(y,m){
  if(typeof _globalCycles==='undefined'||!_poolCycles().length)return true;
  var last=new Date(y,m+1,0).getDate();for(var d=1;d<=last;d++){if(getActiveCycleGrid(new Date(y,m,d,12)))return true;}return false;}
function calcPayeMois(y,m){
  const mym_cp=y*12+m;const pr=S.profile||{};const _pn=getPalierForYM(mym_cp);const heures=getHeuresForYM(mym_cp);
  // Temps partiel : salaire, ancienneté, indemnité mensuelle et PFA au prorata (accord VII.3.1) ; taux horaire sur la base temps plein / 151,67
  const _k=heures>0?Math.round(heures/151.67*1000)/1000:1,_r2=v=>Math.round(v*100)/100; // taux de travail du bulletin (80,000 %), pas 121,34/151,67
  const _salQf=_pn>0?calcPalierSalaire(_pn):(pr.salaireQualif||0),_salAncf=getAncForYM(mym_cp);
  const salQ=_k===1?_salQf:_r2(_salQf*_k),salAnc=_k===1?_salAncf:_r2(_salAncf*_k);const base=salQ+salAnc;
  const tauxH=heures>0?Math.round((_salQf+_salAncf)/151.67*100)/100:0;
  const prevM=m===0?11:m-1,prevY=m===0?y-1:y;
  const _prevMym=prevY*12+prevM,_prevPn=getPalierForYM(_prevMym);
  const _prevSalQ=_prevPn>0?calcPalierSalaire(_prevPn):(pr.salaireQualif||0);
  const _prevBase=_prevSalQ+getAncForYM(_prevMym),_prevHeur=getHeuresForYM(_prevMym);
  const prevTauxH=_prevHeur>0?Math.round(_prevBase/151.67*100)/100:0;
  const vars=calcVariablesMois(prevY,prevM,prevTauxH);
  const _primesConv=getPrimesConvForYM(mym_cp);const _pcTotal=_primesConv.reduce(function(s,p){return s+p.montant;},0);
  const gpe=_k===1?calcGPE(getGroupeForYM(mym_cp),mym_cp):_r2(calcGPE(getGroupeForYM(mym_cp),mym_cp)*_k);
  const pfaM=_pn>0?calcPFA(_pn,mym_cp):(pr.palierNum?calcPFA(pr.palierNum,mym_cp):190);
  let pfa=(pr.pfaMensuelle?pfaM:(m===5||m===11?pfaM*6:0))*_k;if(_k!==1)pfa=_r2(pfa);
  const supFamilial=getSupFamilialForYM(mym_cp);
  const totalFixes=_pcTotal+gpe+pfa+supFamilial;
  const primesCustom=getPrimesFixesCustomForYM(mym_cp);
  const totalPrimesCustom=primesCustom.reduce(function(s,p){return s+p.montant;},0);
  // Grève / absence non rémunérée : retenue sur le bulletin du mois même (ligne « ABSENCE NON REMUNEREE 160 » sans RAP),
  // (qualification + ancienneté + indemnité mensuelle) / 160 l'heure, / 50 la ½ journée, / 30 la journée
  const _G=getGreveConf(),_gBase=base+(_G.base==='qag'?gpe:0);let greveRet=0;const greveDays=[];
  Object.keys(S.excInfo||{}).forEach(function(k){var x=_excOf(k);if(!x||!EXC_M[x.m]||!EXC_M[x.m].greve)return;var d=new Date(k+'T12:00:00');if(d.getFullYear()!==y||d.getMonth()!==m)return;
    var r=_gBase/(x.g==='h'?_G.h:x.g==='dj'?_G.dj:_G.j);greveRet+=r;greveDays.push({k:k,g:x.g,m:x.m,r:Math.round(r*100)/100});});
  greveRet=Math.round(greveRet*100)/100;
  // Complément CP de janvier : montant saisi depuis le bulletin s'il existe, sinon 1/10 des variables de l'année précédente
  const _cpMan=pr.compCPManual&&pr.compCPManual[y]!=null?pr.compCPManual[y]:null;
  let compCP=0;if(m===0){if(_cpMan!=null)compCP=_cpMan;else{let yv=0;for(let pm=0;pm<12;pm++)yv+=calcVariablesMois(y-1,pm).total;compCP=yv/10;}}
  return{base,salQ,salAnc,tauxH,heures,prevM,prevY,vars,primesConv:_primesConv,gpe,groupeClassif:getGroupeForYM(mym_cp),pfa,pfaM,pfaMensuelle:pr.pfaMensuelle,supFamilial,totalFixes,primesCustom,totalPrimesCustom,greveRet,greveDays,compCP,compCPManual:_cpMan!=null,total:base+vars.total+totalFixes+totalPrimesCustom+compCP-greveRet,configured:(salQ>0||salAnc>0||heures>0)&&_hasCycleMonth(y,m),noCycle:!_hasCycleMonth(y,m)};
}
// ================================================================
// BULLETIN DE PAIE : import du PDF (lu sur l'appareil) et comparaison avec le calcul de l'app
// ================================================================
var _BUL_LBL={panier:'Paniers',hsLow:'Heures sup 125 %',hsHigh:'Heures sup 150 %',nuit:'Heures de nuit',fer:'Fériés',dim:'Dimanche',rh:'Repos hebdo',antenne:'Ind. antenne',matin:'Ind. sup. vacations',reel:'Ind. journaux inter',coord:'Ind. coordination',absResto:'Abs. restauration',cp:'Congés payés',autre:'Autre'};
var _BUL_H={hsLow:1,hsHigh:1,nuit:1,fer:1,dim:1,rh:1};
function _deMois(ym){var n=MC[ym%12];return(/^[aeiouy]/.test(n)?'d’':'de ')+n;}
function _bulNum(s){return parseFloat(String(s).replace(/\s/g,'').replace(',','.'));}
// Ligne « RAP » du bulletin → rubrique de l'app (null : cotisation, sans rapport avec le brut)
function _bulKey(l){
  l=l.toUpperCase();
  if(/COMPL|EXON|COTIS|CONTRIB|CSG|CRDS|SANTE|SANTÉ|RETRAITE|CHOMAGE/.test(l))return null;
  if(/HEURES? SUP/.test(l))return /150/.test(l)?'hsHigh':'hsLow';
  if(/NUIT/.test(l))return'nuit';
  if(/FERIE|FÉRIÉ/.test(l))return'fer';
  if(/DIMANCHE/.test(l))return'dim';
  if(/REPOS HEBDO/.test(l))return'rh';
  if(/ANTENNE/.test(l))return'antenne';
  if(/SUP\.? ?VACATION/.test(l))return'matin';
  if(/JOURNAUX|INTER\b/.test(l))return'reel';
  if(/COORD/.test(l))return'coord';
  if(/RESTAURATION/.test(l))return'absResto';
  if(/CONGES? PAYES?|CONGÉS? PAYÉS?/.test(l))return'cp';
  return'autre';
}
// Lignes de texte du bulletin → chiffres utiles (aucune donnée personnelle conservée)
function _bulParse(lines){
  var b={rap:[],nao:{}},N='(-?\\d+,\\d+)',m,fx=[['salQ',/^SALAIRE DE QUALIFICATION .*?(-?\d+,\d+)$/],['anc',/^PRIME ANCIENNETE .*?(-?\d+,\d+)$/],['gpe',/^INDEMNITE MENSUELLE.*?(-?\d+,\d+)$/],['pfa',/^P\.?F\.?A\b.*?(-?\d+,\d+)$/],['epv',/^INDEMNITE 10EME EPV .*?(-?\d+,\d+)$/],['supFam',/^SUPPL(?:EMENT|\.)? ?FAMILIAL.*?(-?\d+,\d+)$/],['avInd',/^PRIME AV\.? ?INDIV.*?(-?\d+,\d+)$/],['brut',/TOTAL BRUT PAYE (-?\d+,\d+)$/]];
  var reRap=new RegExp('^RAP (\\d{4})(\\d\\d) (.+?) '+N+' '+N+' '+N+'$'),rePan=new RegExp('^RAP PRIME DE PANIERS '+N+' '+N+' '+N+'$');
  lines.forEach(function(raw){
    var t=String(raw).replace(/\*/g,'').replace(/\s+/g,' ').trim();if(!t)return;
    // Relevé de présence collé à droite de la ligne (« S 16 MAI 1,00 CPACO », « J 16 JUI 1,00 ») : retiré jusqu'au bout,
    // il fausserait le dernier montant. Repéré par jour de semaine + date + mois abrégé
    t=t.replace(/ [LMJVSD] \d{1,2} (?:JANV?|F[EÉ]VR?|MARS?|AVR|MAI|JUIN?|JUIL?|AO[UÛ]T?|SEPT?|OCT|NOV|D[EÉ]C)\b.*$/,'');
    // Groupe écrit dans l'en-tête (« GRILLE DE QUALIFICATION GRP5 ») : repli si l'indemnité GPE n'est pas lue
    if(b.grp==null&&(m=/GRILLE DE QUALIFICATION.*?\bGRP ?(\d)\b/.exec(t)))b.grp=+m[1];
    if(b.ym==null&&(m=/PERIODE DE PAIE DU (\d\d)\/(\d\d)\/(\d{4})/.exec(t)))b.ym=+m[3]*12+(+m[2]-1);
    if((m=reRap.exec(t))){var k=/PANIER/i.test(m[3])?'panier':_bulKey(m[3]);if(k)b.rap.push({ym:+m[1]*12+(+m[2]-1),k:k,lbl:m[3],q:_bulNum(m[4]),pu:_bulNum(m[5]),mt:_bulNum(m[6])});return;}
    // Paniers sans mois : ceux du mois de travail (mois précédent), comme les primes
    if((m=rePan.exec(t))){var pq=_bulNum(m[1]),pm=_bulNum(m[3]);if(!b.paniers)b.paniers={q:pq,pu:_bulNum(m[2]),mt:pm};else{b.paniers.q+=pq;b.paniers.mt=Math.round((b.paniers.mt+pm)*100)/100;}b.rap.push({ym:null,k:'panier',lbl:'PRIME DE PANIERS',q:pq,pu:_bulNum(m[2]),mt:pm});return;}
    if(/^RAP /.test(t))return;
    // « ABSENCE NON REMUNEREE 160 1,00 15,548 -15,55 » : grève ou absence non payée (retenue, mois du bulletin)
    if((m=/^ABSENCE NON REMUNEREE(?: (\d+))? (\d+,\d+) (\d+,\d+) (-?\d+,\d+)$/.exec(t))){if(!b.absNR)b.absNR={q:0,mt:0,div:m[1]?+m[1]:null};b.absNR.q+=_bulNum(m[2]);b.absNR.mt=Math.round((b.absNR.mt+_bulNum(m[4]))*100)/100;return;}
    if((m=/(?:^| )MESURE NAO (.+?) (-?\d+,\d+)$/.exec(t))){b.nao[m[1]]=_bulNum(m[2]);return;}
    // « SALAIRE DE QUALIFICATION base taux montant » : base temps plein (→ palier) et taux de travail (→ contrat)
    if(b.salQBase==null&&(m=/^SALAIRE DE QUALIFICATION (\d+,\d+) (\d+,\d+) (-?\d+,\d+)$/.exec(t))){b.salQBase=_bulNum(m[1]);b.taux=_bulNum(m[2]);b.salQ=_bulNum(m[3]);return;}
    for(var i=0;i<fx.length;i++){if(b[fx[i][0]]==null&&(m=fx[i][1].exec(t))){b[fx[i][0]]=_bulNum(m[1]);if(fx[i][0]==='pfa')b.pfaMens=/\bMENS/i.test(t);return;}} // « P.F.A NAC MENS » : PFA mensuelle
  });
  if(b.ym!=null)b.rap.forEach(function(r){if(r.ym==null)r.ym=b.ym-1;});
  return b.ym!=null&&b.brut!=null?b:null;
}
// Éléments de texte d'une page → lignes. Même ligne si la hauteur diffère de moins de 2,5 pt (un arrondi fixe
// coupait parfois un libellé de son montant). Texte pivoté (mention verticale dans la marge) écarté : il se collait à une ligne
function _pdfRows(items){
  var its=items.filter(function(it){return it.str&&it.str.trim()&&Math.abs(it.transform[1])<0.01&&Math.abs(it.transform[2])<0.01;})
    .map(function(it){return [it.transform[5],it.transform[4],it.str];}).sort(function(a,b){return b[0]-a[0];}),grp=[];
  its.forEach(function(it){var g=grp[grp.length-1];if(g&&g.y-it[0]<2.5)g.it.push(it);else grp.push({y:it[0],it:[it]});});
  return grp.map(function(g){return g.it.sort(function(a,b){return a[1]-b[1];}).map(function(r){return r[2];}).join(' ');});
}
// ── Réglages de paie lus sur les bulletins : palier, contrat, groupe, ancienneté (et mois d'anniversaire) ──
function _bulPaySet(b){
  var r={},ym=b.ym,base=b.salQBase||b.salQ,t=b.taux>0?b.taux:null,k=(t||100)/100,near=function(a,v){return Math.abs(a-v)<0.02||Math.abs(a*k-v)<0.02;};
  if(base>0)for(var n=11;n<=99;n++){if(Math.abs(calcPalierSalaire(n)-base)<0.02){r.palier=n;break;}}
  if(t)r.pct=t;
  if(b.gpe>0)for(var g=1;g<=9;g++){if(near(calcGPE(g,ym),b.gpe)){r.groupe=g;break;}}
  if(r.groupe==null&&b.grp>=1&&b.grp<=9)r.groupe=b.grp;
  if(b.anc>0)for(var y=1;y<=50;y++){if(near(calcAncPrime(y,ym),b.anc)){r.anc=y;break;}}
  if(b.pfa>0&&b.pfaMens!==undefined)r.pfaMens=!!b.pfaMens;
  return r;
}
// Différences avec les réglages : un changement par valeur nouvelle, daté du premier bulletin qui la montre
function _bulPayDiffs(){
  var pr=S.profile||{},bs=Object.keys(S.bulletins||{}).map(Number).sort(function(a,b){return a-b;}),out={palier:[],heures:[],groupe:[]},anc=[],last={},pfa=null,av=null;
  bs.forEach(function(ym){var d=_bulPaySet(S.bulletins[ym]);
    var chk=function(k,v,cur,eq){if(v==null)return;if(!eq(v,cur)&&last[k]!==v)out[k].push({ym:ym,v:v,cur:cur});last[k]=eq(v,cur)?null:v;};
    chk('palier',d.palier,getPalierForYM(ym),function(a,b){return a===b;});
    chk('heures',d.pct!=null?Math.round(d.pct*151.67/100*100)/100:null,getHeuresForYM(ym),function(a,b){return Math.abs(a-b)<0.01;});
    chk('groupe',d.groupe,getGroupeForYM(ym),function(a,b){return a===b;});
    if(d.anc!=null)anc.push({ym:ym,y:d.anc});
    if(d.pfaMens!=null)pfa={ym:ym,v:d.pfaMens};
    var bb=S.bulletins[ym];if(bb.avInd!=null){var aa=getPrimesFixesCustomForYM(ym).filter(function(p){return /INDIV/i.test(p.label);}).reduce(function(s,p){return s+p.montant;},0);
      av=Math.abs(aa-bb.avInd)>0.02?{ym:ym,v:bb.avInd,cur:aa,first:av&&av.v===bb.avInd?av.first:ym}:null;}});
  // Heures payées sur le bulletin (fériés, dimanches, RH, HS) alors que l'app les range en rendus : ce type d'heures est payé
  // Chaque bulletin ne règle que le mois de travail qu'il paie (comme « Ce mois » dans Variables), jamais les suivants
  // Génération des rendus d'après les bulletins, prudemment (l'app range les heures au mois du dimanche de la semaine,
  // la paie pas toujours : une heure payée « en juillet » peut tomber dans une semaine d'août côté app)
  //  · payé sur un bulletin → « payés », sur le mois où l'app a vraiment ces heures (celui du bulletin, sinon le voisin) ;
  //  · heures calculées par l'app mais absentes du bulletin → « en rendus », seulement si les mois voisins n'en paient pas en trop ;
  //  · mois sans ces heures → aligné seulement s'il est encadré par deux mois vérifiés d'accord.
  var RK={fer:'ferRendu',dim:'dimRendu',rh:'rhRendu',hsLow:'hsRendu',hsHigh:'hsRendu'},PD=[],B={},cov={},rawC={};
  var raw=function(sk,W){var id=sk+':'+W;if(rawC[id]!=null)return rawC[id];window._sfForce=1;var v=0;try{var y=Math.floor(W/12),m=W%12;
    if(sk==='hsRendu'){var h=calcHSMinsMois(y,m);v=h.low+h.high;}else{var d=calcDimRHFerMinsMois(y,m);v=sk==='ferRendu'?d.fer:sk==='dimRendu'?d.dim:d.rh;}}catch(e){}finally{window._sfForce=0;}return rawC[id]=v;};
  var addB=function(sk,W,min){var o=B[sk]||(B[sk]={});o[W]=(o[W]||0)+min;};
  bs.forEach(function(ym){var c;try{c=_bulCompare(S.bulletins[ym]);}catch(e){return;}cov[ym-1]=1;
    c.rows.forEach(function(r){var sk=RK[r.k];if(sk&&(r.bq>0||r.rq>0))addB(sk,ym-1,(r.bq||0)+(r.rq||0));});
    // rattrapage d'un mois dont le bulletin est importé : déjà compté par ce bulletin (rq), pas une seconde fois
    c.late.forEach(function(l){var sk=RK[l.k];if(sk&&l.ym!=null&&!l.info&&l.q>0&&!S.bulletins[l.ym+1])addB(sk,l.ym,Math.round(l.q*60));});});
  var bm=function(sk,W){return (B[sk]||{})[W]||0;};
  // Choix gardés contre le bulletin (erreur du gestionnaire à faire corriger) : plus proposés tant que le bulletin dit la même chose
  var KP=pr.bulRendKeep||{},KL=[],add=function(x){x.h=raw(x.k,x.ym);if(KP[x.k+':'+x.ym]===x.v){KL.push(x);return;}PD.push(x);};
  ['ferRendu','dimRendu','rhRendu','hsRendu'].forEach(function(sk){var known={};
    var months=Object.keys(cov).map(Number).concat(Object.keys(B[sk]||{}).map(Number)).filter(function(v,i,a){return a.indexOf(v)===i;}).sort(function(a,b){return a-b;});
    months.forEach(function(W){var b=bm(sk,W),A=raw(sk,W);
      // payé sur le bulletin : même mois que l'app (semaine rangée dans le mois de son dimanche, comme la paie)
      if(b>0){if(A>0)known[W]=false;}
      // heures dans l'app, rien sur le bulletin du mois : mises en rendus
      else if(A>0&&cov[W]){if(known[W]==null)known[W]=true;}});
    var ks=Object.keys(known).map(Number).sort(function(a,b){return a-b;});
    ks.forEach(function(W){if(settingsForYM(W)[sk]!==known[W])add({k:sk,ym:W,v:known[W]});});
    Object.keys(cov).map(Number).forEach(function(W){if(known[W]!=null||raw(sk,W)>0)return;var pv=null,nx=null;ks.forEach(function(k){if(k<W)pv=k;else if(nx==null&&k>W)nx=k;});
      if(bm(sk,W)>0)return; // payé sur le bulletin sans heures dans l'app : écart d'heures, rien à déduire du réglage
      if(pv==null&&nx==null)return;if(pv!=null&&nx!=null&&known[pv]!==known[nx])return;var kv=known[pv!=null?pv:nx];if(settingsForYM(W)[sk]!==kv)add({k:sk,ym:W,v:kv,fill:1});});});
  // PFA : mensuelle ou semestrielle d'après le dernier bulletin qui en montre une
  var P=pfa&&!!pr.pfaMensuelle!==pfa.v?pfa:null;
  // Ancienneté : années du dernier bulletin ; mois d'anniversaire si deux bulletins consécutifs passent d'une année à la suivante
  var A=null,ask=null;if(anc.length){var L=anc[anc.length-1],mo=null,rng=null;for(var i=1;i<anc.length;i++)if(anc[i].y===anc[i-1].y+1){if(anc[i].ym-anc[i-1].ym===1)mo=anc[i].ym%12;else rng={a:anc[i-1].ym+1,b:anc[i].ym};}
    var bad=anc.some(function(a){return Math.abs(calcAncPrime(a.y,a.ym)-getAncForYM(a.ym))>0.02;});
    if(bad||(mo!=null&&mo!==pr.ancMoisAnni))A={y:L.y,ym:L.ym,mo:mo};
    // Mois d'anniversaire inconnu (pas deux bulletins consécutifs qui l'encadrent) : demandé, avec l'intervalle déduit des bulletins
    var known=typeof pr.ancMoisAnni==='number'&&pr.ancMoisAnni>=0,skip=pr.ancMoisAnni===-2;
    if(mo==null&&((!known&&!skip)||bad))ask={rng:rng};}
  return{av:av,kept:KL.length,keptList:KL,palier:out.palier,heures:out.heures,groupe:out.groupe,anc:A,ask:ask,pfa:P,paid:PD,n:out.palier.length+out.heures.length+out.groupe.length+(A?1:0)+(P?1:0)+(av?1:0)+(ask&&!A?1:0)+PD.length};
}
// Fichiers choisis sur la page d'inscription (gardés en data URL) → Blob lisibles comme un fichier choisi ici
function _regHas(key){try{var a=JSON.parse(localStorage.getItem(key)||'null');return !!(a&&a.length);}catch(e){return false;}}
function _regFiles(key){var a=null;try{a=JSON.parse(localStorage.getItem(key)||'null');localStorage.removeItem(key);}catch(e){}
  if(!a||!a.length)return null;return a.map(function(f){var p=String(f.data).split(','),bin=atob(p[1]||''),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);var b=new Blob([u]);b.name=f.name;return b;});}
// Comparaison ligne à ligne : variables du mois précédent, fixe, rattrapages, total
// Rappels de prix des paniers (revalorisation rétroactive) : sur un bulletin, ce qui est payé au-delà de « quantité × valeur unitaire »
// comble les mois précédents payés sous le prix de l'app (le plus ancien d'abord). cover : rattrapé pour ce bulletin ; used : rappel expliqué
function _panRappels(){
  var r2=function(x){return Math.round(x*100)/100;},bs=Object.keys(S.bulletins||{}).map(Number).sort(function(a,b){return a-b;}),def=[],cover={},from={},used={};
  bs.forEach(function(ym){var b=S.bulletins[ym];if(!b)return;var rap=b.rap||[],W=ym-1;
    var ex=0,pl=rap.filter(function(r){return r.k==='panier';});
    // bulletins importés avant le détail des lignes : seulement b.paniers (prix unitaire du bulletin, sinon celui de l'app)
    if(!pl.length&&b.paniers)pl=[{q:b.paniers.q,pu:b.paniers.pu||getPanierRate(W),mt:b.paniers.mt}];
    pl.forEach(function(r){var pu=r.pu>0?r.pu:getPanierRate(r.ym!=null?r.ym:W),e=r2(r.mt-r.q*pu);if(e>0.005)ex+=e;});ex=r2(ex);
    def.forEach(function(d){if(ex<=0.005||d.left<=0.005)return;var t=r2(Math.min(ex,d.left));d.left=r2(d.left-t);ex=r2(ex-t);
      cover[d.ym]=r2((cover[d.ym]||0)+t);(from[d.ym]=from[d.ym]||[]).indexOf(ym)<0&&from[d.ym].push(ym);used[ym]=r2((used[ym]||0)+t);});
    var q=0,mt=0,has=false;rap.forEach(function(r){if(r.k==='panier'&&r.ym===W){q+=r.q;mt+=r.mt;has=true;}});
    if(!has&&b.paniers){q=b.paniers.q;mt=b.paniers.mt;}
    var dd=r2(q*getPanierRate(W)-mt);if(dd>0.005)def.push({ym:ym,left:dd});
  });
  return{cover:cover,from:from,used:used};
}
function _bulCompare(b){
  var y=Math.floor(b.ym/12),m=b.ym%12,P=calcPayeMois(y,m),v=P.vars,W=b.ym-1,r2=function(x){return Math.round(x*100)/100;};
  var rows=[],late=[],alerts=[];
  var app={hsLow:[v.hsLow,v.supHSlow],hsHigh:[v.hsHigh,v.supHShigh],nuit:[v.nuitMin,v.supNuit],fer:[v.ferMin,v.supFer],dim:[v.dimMin,v.supDim],rh:[v.rhMin,v.supRH],antenne:[v.antenne,v.supAntenne],matin:[v.matin,v.supMatin],reel:[v.reel,v.supReal],coord:[v.coord,v.supCoord],absResto:[v.supAbsResto>0?1:0,v.supAbsResto],panier:[v.paniers||0,v.supPaniers||0]};
  var bq={},bm={},autreW=0;
  // Bulletins importés avant : paniers sans ligne « rap », ils sont ceux du mois de travail
  var _rap=(b.rap||[]).slice();if(b.paniers&&!_rap.some(function(r){return r.k==='panier';}))_rap.push({ym:W,k:'panier',lbl:'PRIME DE PANIERS',q:b.paniers.q,mt:b.paniers.mt});
  _rap.forEach(function(r){
    if(r.k==='cp')return; // retenue / paiement congés payés : se compensent, sans intérêt pour la comparaison
    // ligne inconnue du mois de travail : comparée aux primes spéciales saisies dans l'app (sinon « il manque » leur montant)
    if(r.k==='autre'){var sp=r.ym===W&&v.supSpec>0;late.push({lbl:r.lbl,ym:r.ym,mt:r.mt,info:1,spec:sp});if(sp)autreW+=r.mt;return;}
    if(r.ym!==W){late.push({lbl:_BUL_LBL[r.k],ym:r.ym,mt:r.mt,q:r.q,k:r.k});return;}
    var q=_BUL_H[r.k]?Math.round(r.q*60):r.k==='absResto'?1:r.q;
    bq[r.k]=(bq[r.k]||0)+q;bm[r.k]=r2((bm[r.k]||0)+r.mt);
  });
  // Lignes de ce mois de travail rattrapées sur un bulletin suivant : elles complètent celui-ci
  var rq={},rm={},rFrom={},paidLater=0,panLater=0;
  Object.keys(S.bulletins||{}).forEach(function(k){var o=S.bulletins[k];if(!o||o.ym<=b.ym||!o.rap)return;
    o.rap.forEach(function(r){if(r.ym!==W||!app[r.k])return;
      rq[r.k]=(rq[r.k]||0)+(_BUL_H[r.k]?Math.round(r.q*60):r.k==='absResto'?1:r.q);rm[r.k]=r2((rm[r.k]||0)+r.mt);if(r.k==='panier')panLater=1;else paidLater=r2(paidLater+r.mt);
      (rFrom[r.k]=rFrom[r.k]||[]).indexOf(o.ym)<0&&rFrom[r.k].push(o.ym);});});
  Object.keys(app).forEach(function(k){
    var aq=app[k][0]||0,am=r2(app[k][1]||0),q=bq[k]||0,mt=bm[k]||0,lq=rq[k]||0;
    if(!aq&&!q&&!lq)return;
    rows.push({k:k,lbl:_BUL_LBL[k],h:!!_BUL_H[k],eur:k==='absResto',bq:q,aq:aq,bm:mt,am:am,rq:lq,rm:rm[k]||0,rFrom:rFrom[k]||[],ok:q+lq===aq&&(k==='panier'||Math.abs(mt+(rm[k]||0)-am)<=Math.max(0.1,am*0.005)),okEur:Math.abs(mt-am)<=0.05}); // bonne quantité mais mauvais montant : ligne en écart (paniers : rappels de prix traités à part)
    if((k==='hsLow'||k==='hsHigh')&&q%30)alerts.push('Heures sup payées : '+fmtMin(q)+'. Selon l’article VIII.5 de l’accord collectif, « toute demi-heure supplémentaire commencée est acquise » : le total devrait être un multiple de 30 min.');
  });
  var nao=0;Object.keys(b.nao||{}).forEach(function(k){nao+=b.nao[k];});
  var fix=[['Qualification',b.salQ,P.salQ],['Ancienneté',b.anc,P.salAnc],['Ind. GPE',b.gpe,P.gpe],['PFA',b.pfa,P.pfa],['Mesures NAO',nao||null,P.primesConv.reduce(function(s,p){return s+p.montant;},0)]];
  if(b.epv!=null||P.compCP>0)fix.push(['Complément CP',b.epv||0,r2(P.compCP),'epv']);
  if(b.supFam!=null||P.supFamilial>0)fix.push(['Suppl. familial',b.supFam||0,P.supFamilial]);
  if(v.supSpec>0)fix.push(['Primes spéciales',r2(autreW),r2(v.supSpec||0)]);
  if(v.supMonet>0)fix.push(['Monétisation rendus',b.monet||0,r2(v.supMonet)]); // libellé du bulletin encore inconnu : à vérifier
  if(b.absNR||P.greveRet>0)fix.push(['Absence non rémunérée',b.absNR?b.absNR.mt:0,-P.greveRet]);
  // Prime d'avantage individuel acquis : prime fixe personnelle (Réglages → primes fixes, libellé « … indiv. … »)
  var avA=P.primesCustom.filter(function(p){return /INDIV/i.test(p.label);}).reduce(function(s,p){return s+p.montant;},0);
  if(b.avInd!=null||avA>0)fix.push(['Av. indiv. acquis',b.avInd||0,avA]);
  // Mois avec absence non rémunérée / grève : PFA et NAO légèrement réduites sur le bulletin (règle non publiée, ex. 190 → 188,76) : pas un écart
  var fixed=fix.filter(function(f){return f[1]!=null||f[2];}).map(function(f){var bv=f[1]||0,av=r2(f[2]||0),red=!!b.absNR&&(f[0]==='PFA'||f[0]==='Mesures NAO')&&bv<av&&av-bv<=av*0.02;
    return{lbl:f[0],bm:bv,am:av,ok:Math.abs(bv-av)<=0.05||red,red:red,key:f[3]};});
  // Paniers hors brut : leur rattrapage n'entre pas dans le brut, leur écart s'ajoute à part
  var lateSum=r2(late.reduce(function(s,l){return s+(l.k==='panier'||l.spec?0:l.mt);},0)),diff=r2(b.brut-P.total),PR=_panRappels(),panCov=PR.cover[b.ym]||0,panDiff=r2((bm.panier||0)+(rm.panier||0)-(v.supPaniers||0)+panCov-(PR.used[b.ym]||0));
  // Coordination payée comme antenne (même taux) : le total des deux suffit
  var rA=rows.filter(function(r){return r.k==='antenne';})[0],rC=rows.filter(function(r){return r.k==='coord';})[0];
  if(rA&&rC&&!(rA.ok&&rC.ok)&&rA.bq+rA.rq+rC.bq+rC.rq===rA.aq+rC.aq){rA.ok=rC.ok=true;rA.mix=rC.mix=1;}
  // Paniers : « RAP » sans mois = mois de travail ; un écart compte comme une ligne qui diffère (le brut n'en dépend pas)
  var nBad=rows.filter(function(r){return !r.ok;}).length+fixed.filter(function(f){return !f.ok;}).length;
  var redSum=fixed.reduce(function(t,f){return t+(f.red?f.bm-f.am:0);},0); // PFA/NAO réduites pour absence : retirées de l'écart
  var adj=r2(diff+paidLater-lateSum+panDiff-redSum),later=(PR.from[b.ym]||[]).slice();if(panCov)panLater=1;rows.forEach(function(r){r.rFrom.forEach(function(f){if(later.indexOf(f)<0)later.push(f);});});
  var status=nBad||alerts.length?'ecart':Math.abs(adj)>0.1?'ecart':paidLater||panLater?'later':late.some(function(l){return !l.info;})?'late':'ok';
  var badList=rows.filter(function(r){return !r.ok;}).map(function(r){return r.k==='panier'?'Paniers':(_BUL_LBL[r.k]||r.k);}).concat(fixed.filter(function(f){return !f.ok;}).map(function(f){return f.lbl;}));
  // L'alerte « demi-heure » des HS décrit le même problème qu'une ligne HS en écart : comptée une seule fois
  var hsBad=rows.some(function(r){return (r.k==='hsLow'||r.k==='hsHigh')&&!r.ok;});if(!hsBad)badList=badList.concat(alerts.map(function(){return 'Heures sup (demi-heure)';}));
  // Lignes en écart, chacune avec son montant (bulletin − app) ; ce que les lignes n'expliquent pas forme un « reste »
  var items=rows.filter(function(r){return !r.ok;}).map(function(r){return{id:'r:'+r.k,lbl:r.k==='panier'?'Paniers':(_BUL_LBL[r.k]||r.k),d:r2(r.bm+r.rm-r.am),row:r};})
    .concat(fixed.filter(function(f){return !f.ok;}).map(function(f){return{id:'f:'+f.lbl,lbl:f.lbl,d:r2(f.bm-f.am),fx:f};}));
  if(!hsBad&&alerts.length)items.push({id:'a:hs',lbl:'Heures sup (demi-heure)',d:0,hs:rows.filter(function(r){return (r.k==='hsLow'||r.k==='hsHigh')&&r.bq%30;})});
  var res=r2(adj-items.reduce(function(s,i){return s+i.d;},0));if(Math.abs(res)>0.1)items.push({id:'reste',lbl:'Écart non expliqué par une ligne',d:res});
  // Écarts ignorés ligne par ligne : chacun reste ignoré tant que son montant ne change pas
  var IG=(((S.profile||{}).ignBulL||{})[b.ym])||{},adjI=adj;
  items.forEach(function(i){i.ign=IG[i.id]!=null&&Math.abs(IG[i.id]-i.d)<=0.05;if(i.ign)adjI=r2(adjI-i.d);});
  badList=items.filter(function(i){return !i.ign;}).map(function(i){return i.lbl;});
  var nIgn=items.filter(function(i){return i.ign;}).length,allIgn=status==='ecart'&&items.length>0&&nIgn===items.length;
  return{panCov:panCov,panFrom:PR.from[b.ym]||[],panUsed:PR.used[b.ym]||0,items:items,nIgn:nIgn,allIgn:allIgn,adjAll:adj,badList:badList,P:P,rows:rows,fixed:fixed,late:late,lateSum:lateSum,paidLater:paidLater,later:later.sort(),adj:adjI,alerts:alerts,diff:diff,status:status,nBad:nBad,paniers:(bq.panier||rq.panier||v.paniers)?{bq:(bq.panier||0)+(rq.panier||0),aq:v.paniers||0,bm:r2((bm.panier||0)+(rm.panier||0))}:null};
}
var _BUL_ST={ok:['✓','var(--green)','Conforme'],late:['✓','var(--green)','Conforme, avec des rattrapages'],later:['✓','var(--green)','Conforme, complété plus tard'],ecart:['⚠','var(--amber)','Écarts à vérifier']};
// Écarts ignorés : un bulletin reste ignoré tant que son écart ne change pas, le tableau Gestion tant que c'est le même tableau et le même écart
function _bulIgn(ym,c){return !!c&&(!!c.allIgn||(c.status==='ecart'&&ym<_calcVerifYM()));}
// Premier bulletin vérifié : celui qui paie un mois entièrement suivi (départ du calcul en cours de mois : le suivant)
function _calcStartYM(){var p=S.profile||{};if(!p.calcStart)return -1;var d=new Date(p.calcStart+'T12:00:00');return d.getFullYear()*12+d.getMonth();}
function _calcVerifYM(){var p=S.profile||{};if(!p.calcStart)return -1;var d=new Date(p.calcStart+'T12:00:00'),ym=d.getFullYear()*12+d.getMonth();return d.getDate()===1?ym+1:ym+2;}
// Montant des écarts ignorés (tous les écarts moins ceux qui restent), signé : − il manque, + payé en plus
function _bulIgnAmt(c){return c?Math.round(((c.adjAll||0)-(c.adj||0))*100)/100:0;}
function _bulIgnTxt(c){var a=_bulIgnAmt(c);return Math.abs(a)>0.05?(a>0?'+':'−')+fmtEuro(Math.abs(a)):'';}
function _bulBad(ym){var c;try{c=_bulCompare(S.bulletins[ym]);}catch(e){return false;}return c.status==='ecart'&&!_bulIgn(ym,c);}
// Tableau Gestion : on ignore une différence précise (gardée tant que sa valeur ne change pas), pas l'écart entier
function _rhCIgn(k,v){var i=((S.profile||{}).ignRhC||{})[k];return i!=null&&Math.abs(i-v)<2;}
// Écart restant une fois les différences ignorées retirées (app − tableau, comme rhCmp.d)
function _rhDe(c){return c?(c.de!=null?c.de:c.d):0;}
function _rhIgnLink(k,v,acc){var on=_rhCIgn(k,v);return '<a style="color:var(--blue);cursor:pointer;font-weight:400;white-space:nowrap" onclick="event.stopPropagation();rhIgnC(\''+k+'\','+Math.round(v)+','+(on?0:1)+')">'+(acc?(on?'Annuler la reprise':'Faire comme le tableau'):(on?'Ne plus ignorer':'Ignorer'))+'</a>';}
// Page Paie d'un mois : calcul de l'app, annoté avec le bulletin s'il est importé
function _payPageHtml(ym){
  var y=Math.floor(ym/12),m=ym%12,P=calcPayeMois(y,m),b=(S.bulletins||{})[ym];
  if(P.noCycle)return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px 16px;text-align:center"><div style="font-size:13px;font-weight:600;color:var(--text2)">Pas de cycle ce mois-ci</div><div style="font-size:13px;color:var(--text3);line-height:1.5">Aucun cycle de travail n’est associé à ce mois : pas de salaire estimé.</div></div>';
  if(!P.configured||!P.salQ||!P.heures)return '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 16px;text-align:center">'
    +'<div style="font-size:13px;font-weight:600;color:var(--text2)">Données de paie incomplètes</div>'
    +'<div style="font-size:13px;color:var(--text3);line-height:1.5">Renseigner le palier, l’ancienneté et le taux de travail dans les paramètres pour voir l’estimation du salaire.</div>'
    +'<button class="mb" style="height:36px;padding:0 16px;font-size:13px;background:var(--blue);color:#fff;border:none;border-radius:var(--r);cursor:pointer" onclick="closeModal();setTimeout(()=>openSettingsModal(1),80)">Paramètres → Paie</button>'
    +'<button class="mb" style="height:36px;padding:0 16px;font-size:13px;margin-top:8px;cursor:pointer" onclick="window._bulFrom=\'recap\';importBulletins()">ou importer un bulletin (PDF)</button></div>';
  var c=b?_bulCompare(b):null,fe=function(x){return fmtEuro(x).replace(/\s*€/,'');},v=P.vars,_tx=v.tx||getTauxForYM(),_eu=function(n){return n.toFixed(2).replace('.',',')+' €';};
  var btn='font-size:11px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:var(--btn);cursor:pointer;font-family:var(--font)';
  var rowsBy={},fixBy={};if(c){c.rows.forEach(function(r){rowsBy[r.k]=r;});c.fixed.forEach(function(f){fixBy[f.lbl]=f;});}
  // Colonne bulletin (à gauche du calcul de l'app) : ✓ si pareil, sinon ⚠ et le montant du bulletin
  var E='<span class="pp-n"></span>',OK='<span class="pp-n" style="color:var(--green)"><span class="tk">✓</span></span>';
  var _ig={};if(c)c.items.forEach(function(i){if(i.ign)_ig[i.id]=1;});
  // id : écart de la ligne ; ignoré (ou id===true) → montant grisé, sans ⚠
  var bul=function(same,bv,id){var g=id===true||(id&&_ig[id]);return same?OK:'<span class="pp-n" style="color:'+(g?'var(--text3)':'var(--amber)')+'">'+(g?'':'⚠ ')+fe(bv)+'</span>';};
  // Sous-totaux : grisés quand tous les écarts de la section (f : ligne fixe de la liste, r : variable) sont ignorés
  var _secIgn=function(test){var its=c?c.items.filter(function(i){return test(i.id);}):[];return its.length>0&&its.every(function(i){return i.ign;});};
  var cmp=function(bv,av,test){return bul(Math.abs(bv-av)<=0.05,bv,test&&_secIgn(test)?true:null);};
  var _fT=function(ls){return function(id){return ls.some(function(l){return id==='f:'+l;});};};
  var row=function(lbl,val,col,n){return '<div class="pp-r"><span class="pp-l">'+lbl+'</span>'+(c?(n||E):'')+'<b'+(col?' style="color:'+col+'"':'')+'>'+fe(val)+'</b></div>';};
  var sub=function(lbl,val,n){return '<div class="pp-r pp-s"><span>'+lbl+'</span>'+(c?(n||E):'')+'<span class="pp-v"><b class="stag">'+fe(val)+'</b></span></div>';};
  var tit=function(t,first){return '<div class="btit" style="margin:'+(first?'4px':'14px')+' 0 4px">'+t+'</div>';};
  var vl='',vb=0;
  var vr=function(k,lbl,aq,am,col){var r=rowsBy[k];if(!(aq>0)&&!r)return;var bm=r?r.bm:0;vb+=bm+(r?r.rm:0);
    vl+=row(lbl,am,col,c?(r?(r.ok?(r.mix?'<span class="pp-n" style="color:var(--green)">'+(k==='coord'?'antenne <span class="tk">✓</span>':'coord <span class="tk">✓</span>')+'</span>':r.rq?'<span class="pp-n" style="color:var(--green)">en '+MCs[r.rFrom[0]%12].toLowerCase()+' <span class="tk">✓</span></span>':OK):bul(false,bm+r.rm,'r:'+k)):bul(false,0,'r:'+k)):null);};
  vr('dim','Dim ('+fmtMin(v.dimMin)+' × '+_tx.dim+'%)',v.dimMin,v.supDim,null);
  vr('rh','RH ('+fmtMin(v.rhMin)+' × '+_tx.rh+'%)',v.rhMin,v.supRH,null);
  vr('fer','Fériés ('+fmtMin(v.ferMin)+' × '+_tx.fer+'%)',v.ferMin,v.supFer,null);
  vr('hsLow','HS ≤8h ('+fmtMin(v.hsLow)+' × '+_tx.hsLow+'%)',v.hsLow,v.supHSlow,null);
  vr('hsHigh','HS >8h ('+fmtMin(v.hsHigh)+' × '+_tx.hsHigh+'%)',v.hsHigh,v.supHShigh,null);
  vr('nuit','Nuit ('+fmtMin(v.nuitMin)+' × '+_tx.nuit+'%)',v.nuitMin,v.supNuit,null);
  vr('antenne','P. antenne ('+v.antenne+' × '+_eu(_tx.antenne)+')',v.antenne,v.supAntenne,null);
  vr('matin','P. matin ('+v.matin+' × '+_eu(_tx.matin)+')',v.matin,v.supMatin,null);
  vr('reel','P. réal ('+v.reel+' × '+_eu(_tx.reel)+')',v.reel,v.supReal,null);
  vr('coord','P. coord ('+v.coord+' × '+_eu(_tx.coord)+')',v.coord,v.supCoord,null);
  vr('absResto','Abs. restauration',v.supAbsResto,v.supAbsResto,null);
  var _spF=fixBy['Primes spéciales'],_spL=(v.specList||[]).length;if(_spF)vb+=_spF.bm;
  (v.specList||[]).forEach(function(sp,i){var d=new Date(sp.key+'T12:00:00');vl+=row(_h(sp.lbl)+' ('+d.getDate()+' '+MCs[d.getMonth()]+')',sp.amt,null,c?(i===_spL-1&&_spF?fn('Primes spéciales',v.supSpec):E):null);});
  if(_spF&&!_spL)vl+=row('Autres lignes du mois',0,null,fn('Primes spéciales',0));
  if(v.supMonet>0){var _mF=fixBy['Monétisation rendus'];if(_mF)vb+=_mF.bm;vl+=row('Monétisation rendus ('+fmtMin(v.monetMin)+')',v.supMonet,null,c?fn('Monétisation rendus',v.supMonet):null);}
  if(!vl)vl='<div style="color:var(--text3);padding:3px 0">Aucune.</div>';
  // En-tête et total brut comme l'ancien onglet Paie ; la colonne bulletin s'ajoute à gauche
  var h='<div class="pp-r" style="font-size:11px;color:var(--text3);padding:0 0 2px"><span style="flex:1"></span>'+(c?'<span class="pp-n">bulletin</span>':'')+'<span class="pp-v">app</span></div>'
    +'<div class="hd-card out"><div class="pp-r" style="padding:3px 0;margin-bottom:2px"><span style="flex:1;color:var(--text3)">total brut</span>'+(c?bul(c.status!=='ecart'||Math.abs(c.diff)<=0.05,b.brut,c.allIgn||null):'')+'<b style="font-size:15px;color:var(--gold-pay)">'+fe(P.total)+'</b></div>';
  if(c){var lt=c.later.map(function(f){return '<a onclick="_swipeGo('+(f>ym?1:-1)+',function(){openBulletinModal('+f+')})" style="color:inherit;text-decoration:underline;cursor:pointer">'+MC[f%12]+'</a>';}).join(', '),A=Math.abs(c.adj),msg;
    if(c.status==='ok')msg='✓ Conforme au calcul';
    else if(c.status==='later')msg='✓ Conforme, avec un rattrapage payé en '+lt;
    else if(c.status==='late')msg='✓ Conforme, avec des rattrapages d’anciens mois';
    else if(A>0.1)msg='⚠ '+(c.adj<0?'Il manque '+fmtEuro(A)+' sur le bulletin':'Le bulletin paie '+fmtEuro(A)+' de plus')+(c.paidLater?', après le rattrapage de '+lt:'');
    else msg='⚠ Le total correspond, mais des lignes diffèrent';
    var ig=c.status==='ecart'&&_bulIgn(ym,c),nI=c.nIgn||0;
    var _iT=_bulIgnTxt(c);
    if(ig)msg=ym<_calcVerifYM()?'Avant le début du calcul : écarts non comptés':'Écarts ignorés';else if(c.status==='ecart'&&!(A>0.1)&&!c.badList.length)msg='✓ Conforme, écarts ignorés';
    h+='<div style="font-size:11px;font-weight:600;margin:0 0 4px;display:flex;align-items:baseline;gap:8px;color:'+(ig?'var(--text3)':c.status==='ecart'&&c.badList.length?'var(--amber)':'var(--green)')+'"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+msg+'</span>'
      // tout ignoré (ou le reste conforme) : le montant ignoré dans la colonne bulletin
      +(/cart?s? ignorés/i.test(msg)&&_iT?'<span class="pp-n" style="font-weight:400;color:var(--text3)">'+_iT.replace(/\s*€/,'')+'</span>':'')
      +(c.status==='ecart'&&c.items.length?'<a style="font-weight:400;color:var(--blue);cursor:pointer;margin-left:auto;min-width:66px;text-align:right;flex-shrink:0;white-space:nowrap" onclick="event.stopPropagation();_openBulIgnMenu(this,'+ym+')">Ignorer…</a>':'')+'</div>'
    // Écarts ignorés en partie : combien et leur montant, sur une ligne à part
    // Montant des écarts ignorés dans la colonne bulletin (ligne à part si d'autres écarts restent)
    +(nI&&!ig&&!/écarts ignorés/.test(msg)?'<div class="pp-r" style="color:var(--text3)"><span class="pp-l">'+nI+' écart'+(nI>1?'s':'')+' ignoré'+(nI>1?'s':'')+'</span><span class="pp-n">'+_iT.replace(/\s*€/,'')+'</span><b></b></div>':'')
    // Écart sur fériés, dimanches, RH ou HS dû au réglage de l'app → Vérification (le mail au gestionnaire est dans Suivi)
    if(c.status==='ecart'&&!ig){var _D=null;try{_D=_bulPayDiffs();}catch(e){}
      var _lk='color:var(--blue);cursor:pointer;margin-left:auto;padding-left:8px;white-space:nowrap',_W=ym-1;
      if(_D&&_D.paid.some(function(x){return x.ym===_W;})&&c.items.some(function(i){return !i.ign&&/^r:(fer|dim|rh|hsLow|hsHigh)$/.test(i.id);}))
        h+='<div style="font-size:11px;margin:0 0 4px;display:flex;color:var(--text3)"><span>Génération de rendus à corriger</span><a style="'+_lk+'" onclick="_bulPayPropose(function(){openBulletinModal('+ym+')},1)">Vérifier ›</a></div>';
}}
  var pR=(v.panierRate!=null?v.panierRate:getPanierRate());
  // Ligne paniers et ligne de statut toujours présentes : la case garde la même hauteur
  if(!c)h+='<div style="font-size:11px;margin:0 0 4px;color:var(--text3)">Pas de bulletin</div>';
  if(!(v.paniers>0||(c&&c.paniers)))h+='<div class="pp-r"><span class="pp-l">Paniers</span>'+(c?E:'')+'<b style="color:var(--text3);font-weight:400">—</b></div>';
  else{var _e2=function(x){return x.toFixed(2).replace('.',',');},_pl='Paniers ('+v.paniers+' × '+_e2(pR)+' €)',_pn=null;
    // Prix payé sous celui de l'app puis rattrapé (rappel de revalorisation) : prix payé → prix dû, et le mois du rattrapage
    // colonne bulletin : montant versé ce mois-ci + mois du rattrapage, en vert (la différence de prix est rattrapée)
    if(c&&c.paniers&&c.panCov>0.005&&c.paniers.bq>0){
      if(Math.abs(Number(c.paniers.bq)-Number(c.paniers.aq))<0.01)_pn='<span class="pp-n" style="color:var(--green);width:auto">'+fe(c.paniers.bm)+' + '+c.panFrom.map(function(f){return MCs[f%12].toLowerCase();}).join(', ')+' <span class="tk">✓</span></span>';}
    // Bulletin qui verse un rappel de prix pour des mois précédents
    else if(c&&c.panUsed>0.005){_pl='Paniers ('+v.paniers+' × '+_e2(pR)+' €) + rappel';
      if(c.paniers&&Math.abs(Number(c.paniers.bq)-Number(c.paniers.aq))<0.01)_pn='<span class="pp-n" style="color:var(--green)">+'+_e2(c.panUsed)+' <span class="tk">✓</span></span>';}
    _pl='<span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_pl+'</span>';
    h+=row(_pl,v.supPaniers,null,c?(_pn||(c.paniers?bul(Math.abs(Number(c.paniers.bq)-Number(c.paniers.aq))<0.01,c.paniers.bm,'r:panier'):bul(false,0))):null);}
  // Cumul depuis janvier : estimé de l'app ; colonne bulletin = brut des bulletins importés
  (function(){var cum=0,paid=0,nb=0;for(var mm=0;mm<=m;mm++){var pp=calcPayeMois(y,mm);if(pp&&pp.configured)cum+=pp.total;var bb=(S.bulletins||{})[y*12+mm];if(bb){paid+=bb.brut||0;nb++;}}
    h+='<div class="pp-r" style="padding:3px 0"><span class="pp-l">Depuis janvier</span>'+(c?'<span class="pp-n" style="color:var(--text3)">'+(nb?fe(paid):'')+'</span>':'')+'<b style="color:var(--gold-pay)">'+fe(cum)+'</b></div>';})();
  h+='</div>';
  var fn=function(lbl,av){var f=fixBy[lbl];return c?(f?bul(f.ok,f.bm,'f:'+lbl):bul(Math.abs(av)<=0.05,0,'f:'+lbl)):null;},fsum=function(ls){return ls.reduce(function(s,l){var f=fixBy[l];return s+(f?f.bm:0);},0);};
  // Avantage individuel acquis : complète le salaire de qualification (salariés embauchés avant l'accord), affiché avec le salaire de base
  // mais hors du taux horaire (le bulletin calcule la nuit sur qualification + ancienneté seulement)
  var avP=P.primesCustom.filter(function(p){return /INDIV/i.test(p.label);}),avT=avP.reduce(function(s,p){return s+p.montant;},0),avB=!!fixBy['Av. indiv. acquis'];
  h+=tit('Salaire de base',1)+row('Qualification',P.salQ,null,fn('Qualification',P.salQ))+row('Ancienneté',P.salAnc,null,fn('Ancienneté',P.salAnc))
    +avP.map(function(p){return row('Av. indiv. acquis',p.montant,null,fn('Av. indiv. acquis',p.montant));}).join('')+(avB&&!avP.length?row('Av. indiv. acquis',0,null,fn('Av. indiv. acquis',0)):'')
    +sub('Sous-total',P.base+avT,c?cmp(fsum(['Qualification','Ancienneté','Av. indiv. acquis']),P.base+avT,_fT(['Qualification','Ancienneté','Av. indiv. acquis'])):null);
  h+=tit('Variables <span style="font-weight:400;color:var(--text3);font-size:11px">('+MC[P.prevM]+')</span>')+vl+sub('Sous-total',v.total,c?cmp(vb,v.total,function(id){return id.indexOf('r:')===0;}):null);
  if(m===0){var cf=fixBy['Complément CP'];
    h+=tit('Complément CP')+(P.compCP>0||cf?row(P.compCPManual?'Montant du bulletin':'1/10 variables '+(y-1),P.compCP,null,fn('Complément CP',P.compCP)):'<div style="color:var(--amber);display:flex;gap:5px;padding:4px 0"><span>⚠</span><span>1/10 des variables '+(y-1)+' non calculable : les données de l’année précédente sont incomplètes.</span></div>')
      +'<div style="display:flex;gap:6px;margin-top:4px"><button onclick="editCompCP('+y+','+ym+')" style="'+btn+';color:var(--text2);padding:3px 8px">'+(P.compCPManual?'Modifier le montant':'Saisir le montant du bulletin')+'</button>'+(cf&&!cf.ok&&b.epv!=null?'<button onclick="useBulletinCompCP('+ym+')" style="'+btn+';color:var(--blue);padding:3px 8px">Reprendre le bulletin</button>':'')+'</div>';}
  // Indemnité 10e (complément CP) versée un autre mois que janvier : affichée, sinon elle comptait comme un problème invisible
  if(m!==0&&fixBy['Complément CP'])h+=tit('Complément CP')+row('Indemnité 10e (bulletin)',P.compCP,null,fn('Complément CP',P.compCP));
  // NAO : le bulletin les nomme autrement, comparées en total (sur la dernière ligne si ça diffère)
  var naoF=fixBy['Mesures NAO'],nN=P.primesConv.length,fa=P.totalFixes+P.totalPrimesCustom-avT;
  h+=tit('Primes fixes')+P.primesConv.map(function(p,i){return row(p.label,p.montant,null,c?(naoF&&naoF.ok?OK:i===nN-1?(naoF?bul(false,naoF.bm,'f:Mesures NAO'):bul(false,0,'f:Mesures NAO')):E):null);}).join('')
    +row('Ind. GPE'+(P.groupeClassif?' (Gr.'+P.groupeClassif+')':''),P.gpe,null,fn('Ind. GPE',P.gpe))
    +row('PFA ('+fmtEuro(P.pfaM)+'/mois)'+(P.pfaMensuelle?'':' (sem.)'),P.pfa,null,fn('PFA',P.pfa))
    +(P.supFamilial>0||fixBy['Suppl. familial']?row('Suppl. familial',P.supFamilial,null,fn('Suppl. familial',P.supFamilial)):'')
    +(naoF&&!nN?row('Mesures NAO',0,null,bul(false,naoF.bm,'f:Mesures NAO')):'')
    +P.primesCustom.filter(function(p){return !/INDIV/i.test(p.label);}).map(function(p){return row(_h(p.label),p.montant,null);}).join('')
    // primes personnelles hors bulletin lu : hors de la comparaison du sous-total (sinon ⚠ permanent)
    +sub('Sous-total',fa,c?cmp(fsum(['Mesures NAO','Ind. GPE','PFA','Suppl. familial']),fa-P.primesCustom.filter(function(p){return !/INDIV/i.test(p.label);}).reduce(function(t,p){return t+p.montant;},0),_fT(['Mesures NAO','Ind. GPE','PFA','Suppl. familial'])):null);
  if(P.greveRet>0||fixBy['Absence non rémunérée'])h+=tit('Absences non rémunérées')
    +P.greveDays.map(function(g,i){var d=new Date(g.k+'T12:00:00');return row(d.getDate()+' '+MCs[d.getMonth()]+' · '+(g.m==='greve'?'grève ':'')+(g.g==='h'?'1 heure':g.g==='dj'?'½ journée':'journée'),-g.r,null,i===P.greveDays.length-1?fn('Absence non rémunérée',-P.greveRet):null);}).join('')
    +(!P.greveDays.length?row('Absence non rémunérée',0,null,fn('Absence non rémunérée',0)):'');
  if(c&&c.late.length)h+=tit('Rattrapages et autres lignes')+c.late.map(function(l){return '<div class="pp-r"><span class="pp-l">'+_h(l.lbl)+(l.q!=null?' ('+(_BUL_H[l.k]?fmtMin(Math.round(l.q*60)):l.q)+')':'')+'<span style="display:block;font-size:11px;font-style:italic">'+(l.info?'sans effet sur la comparaison':l.ym!=null&&l.ym<_calcStartYM()?'travail '+_deMois(l.ym)+' '+Math.floor(l.ym/12)+' : avant le début de la vérification, non vérifié':'travail '+_deMois(l.ym)+' '+Math.floor(l.ym/12)+((S.bulletins||{})[l.ym+1]?', manquait sur le <a onclick="event.stopPropagation();_swipeGo(-1,function(){openBulletinModal('+(l.ym+1)+')})" style="color:var(--blue);cursor:pointer;font-style:normal">bulletin '+_deMois(l.ym+1)+'</a>':''))+'</span></span><span class="pp-n" style="color:var(--text2)">'+fe(l.mt)+'</span><b style="color:var(--text3)">—</b></div>';}).join('');
  // Alerte demi-heure des HS : grisée, sans ⚠, quand l'écart HS correspondant est ignoré
  if(c){var _hsI=c.items.filter(function(i){return i.id==='a:hs'||i.id==='r:hsLow'||i.id==='r:hsHigh';}),_aIg=_hsI.length>0&&_hsI.every(function(i){return i.ign;});
    h+=c.alerts.map(function(a){return '<div style="font-size:11px;color:'+(_aIg?'var(--text3)':'var(--amber)')+';display:flex;gap:5px;padding:10px 0 0;line-height:1.45">'+(_aIg?'':'<span>⚠</span>')+'<span>'+a+(_aIg?' (ignoré)':'')+'</span></div>';}).join('');}
  h+='<div style="font-size:11px;color:var(--text3);text-align:center;margin-top:10px">taux : '+fmtEuro(P.tauxH)+'/h · '+P.heures.toFixed(2)+'h/mois</div>';
  h+=(b?'':'<div style="font-size:11px;color:var(--text3);line-height:1.5;margin:14px 0 0">Importer le PDF du bulletin pour que l’app compare chaque ligne. Le fichier est lu sur le téléphone et n’est envoyé nulle part ; seuls les montants sont gardés.</div>')
    +'<div style="display:flex;gap:8px;margin:12px 0 14px"><button onclick="window._bulFrom=\'recap\';importBulletins()" style="'+btn+';color:var(--text2)"><i class="ti ti-file-import" style="margin-right:4px"></i>'+(b?'Importer / réimporter':'Importer le bulletin (PDF)')+'</button>'+(b?'<button onclick="deleteBulletin('+ym+')" style="'+btn+';color:var(--text3)">Retirer</button>':'')+'</div>';
  // Contenu en retrait de la largeur d'une case : la case d'en-tête prend toute la largeur, les colonnes restent alignées
  return '<div style="font-size:11px;padding:0 12px">'+h+'</div>';
}
function calcNuitMinShift(v){
  if(!v||!v.deb||!v.fin)return 0;
  let deb=_toMinApp(v.deb),fin=_toMinApp(v.fin);
  if(deb===null||fin===null)return 0;
  if(fin<deb)fin+=1440;
  const n1=Math.max(0,Math.min(fin,360)-Math.max(deb,0));     // 0h-6h (matin)
  const n2=Math.max(0,Math.min(fin,1440)-Math.max(deb,1260)); // 21h-24h
  const n3=Math.max(0,Math.min(fin,1800)-Math.max(deb,1440)); // 0h-6h (après minuit)
  return n1+n2+n3;
}
function calcNuitWeek(monday){
  const VAC=getVAC();let nuit=0;
  for(let i=0;i<7;i++){
    const d=new Date(monday);d.setDate(monday.getDate()+i);
    const key=dk(d);const{vac,absent,echange,ecSelf}=getVac(d);
    if(_excKeep(key,'nt')){nuit+=calcNuitMinShift(VAC[getCycleVac(d).cycleVac])||0;continue;}
    if(absent)continue;
    const _cg=(S.conges||{})[key];
    if(_cg&&(_cg==='cg'||_cg==='rend'||_cg==='rend-hist'||_cg==='absent'))continue;
    if(echange&&!ecSelf)continue;
    if(!vac||vac==='RH')continue;
    // Heures de nuit : formation suivie (« Formé ») → max(vacation prévue, formation) ; sinon celles réellement faites
    nuit+=getNuitMinDay(d,VAC);
  }
  return nuit;
}
function calcNuitMois(y,m){
  const mym=y*12+m,seenW=new Set(),last=new Date(y,m+1,0).getDate();let total=0;
  for(let dd=-6;dd<last;dd++){
    const date=new Date(y,m,1+dd),mon=getMonday(date),mk=dk(mon);
    if(seenW.has(mk))continue;seenW.add(mk);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    if(sun.getFullYear()*12+sun.getMonth()!==mym)continue;
    total+=calcNuitWeek(mon);
  }
  return total;
}
// Bilan de l'année : compteurs (depuis le 1er janvier, comparés à la même période l'an dernier) et paie mois par mois
function _bilanCount(y,toMonth,toDay){
  var c={jours:0,nuits:0,dim:0,fer:0,matins:0},d=new Date(y,0,1,12),end=new Date(y,toMonth,toDay,12);
  while(d<=end){
    var k=dk(d),g=getVac(d),cg=(S.conges||{})[k];
    if(!g.absent&&!(cg==='cg'||cg==='rend'||cg==='rend-hist'||cg==='absent')&&!(g.echange&&!g.ecSelf)&&g.vac&&g.vac!=='RH'){
      var V=getVAC(d)[g.vac];
      c.jours++;
      if(V)c.nuits+=getNuitMinDay(d); // minutes de nuit
      if(d.getDay()===0)c.dim++;
      if(FERIES.has(k))c.fer++;
      if(V&&V.deb&&_toMinApp(V.deb)<240)c.matins++;
    }
    d.setDate(d.getDate()+1);
  }
  return c;
}
// Écart des bulletins, tous mois confondus (tuile Suivi et Vérification)
function _bulEcart(){
  var nB=0,nBad=0,nPb=0,nOld=0,nIg=0,neg=0,pos=0,last=null;Object.keys(S.bulletins||{}).forEach(function(k){var ym=+k,c;nB++;if(last==null||ym>last)last=ym;
    try{c=_bulCompare(S.bulletins[k]);}catch(e){return;}if(c.status!=='ecart')return;if(_bulIgn(ym,c)){nIg++;return;}
    nBad++;var _np=(c.badList?c.badList.length:0)||1;nPb+=_np;if(Math.floor(ym/12)<NOW.getFullYear())nOld+=_np;(c.items||[]).forEach(function(i){if(i.ign)return;if(i.d<0)neg+=i.d;else pos+=i.d;});});
  neg=Math.round(neg*100)/100;pos=Math.round(pos*100)/100;
  return{nB:nB,nBad:nBad,nPb:nPb,nOld:nOld,nIg:nIg,neg:neg,pos:pos,last:last,bal:Math.round((neg+pos)*100)/100,hasN:neg<-0.05,hasP:pos>0.05};
}
// Salaire de l'année, style de l'onglet Paie : tous les mois, brut du bulletin s'il est importé, sinon estimé
function _svSalHtml(y){
  // Comme la paie du mois : brut estimé à droite, écart avec le payé (bulletin) dans la colonne à sa gauche
  var nowYM=NOW.getFullYear()*12+NOW.getMonth(),rows='',tot=0,tB=0,tBe=0,nB=0,nBad=0,adjT=0,nIg=0;
  var fe=function(x){return fmtEuro(x).replace(/\s*€/,'');};
  for(var m=0;m<12;m++){
    var ym=y*12+m,pt;try{pt=calcPayeMois(y,m);}catch(e){continue;}
    if(!(pt&&pt.configured&&pt.salQ&&pt.heures))continue;
    var bu=(S.bulletins||{})[ym],fut=ym>nowYM,est=pt.total,st='';
    tot+=est;
    if(bu){nB++;tB+=bu.brut||0;tBe+=est;var cc=null;try{cc=_bulCompare(bu);}catch(e){}
      var d=Math.round(((bu.brut||0)-est)*100)/100,ig=cc&&cc.status==='ecart'&&_bulIgn(ym,cc),bad=cc&&cc.status==='ecart'&&!ig;if(bad)nBad++;if(ig)nIg++;if(cc&&!ig)adjT+=cc.adj||0;
      // Écart expliqué par des rattrapages (payés un autre mois, ou ce mois pour un mois passé) : tout va bien
      var rat=cc&&!bad&&!ig&&(Math.abs(d)>0.05||cc.status==='later'||cc.panUsed>0.005);
      if(rat)st='<span style="color:var(--text3)">'+(cc.later&&cc.later.length?'rattrapé en '+MCs[cc.later[0]%12]:'dont rattrapage')+' <span style="color:var(--green)"><span class="tk">✓</span></span></span>';
      // Écart affiché = celui de la page du mois (paniers compris, rattrapages et lignes ignorées déduits)
      else{var e=cc?cc.adj:d;
        st=ig?'<span style="color:var(--text3)">ignoré'+(_bulIgnTxt(cc)?' '+_bulIgnTxt(cc):'')+'</span>'
          :Math.abs(e)<=0.05?'<span style="color:'+(bad?'var(--amber)':'var(--green)')+'">'+(bad?'lignes ⚠':'<span class="tk">✓</span>')+'</span>'
          :'<span style="color:'+(e>0?'var(--green)':'var(--red)')+'">'+(e>0?'+':'−')+fe(Math.abs(e))+'</span>';}}
    else st='<span style="color:var(--text3)">—</span>';
    rows+='<div class="sv-pr" onclick="'+'openBulletinModal('+ym+',\'recap\')'+'"><span class="l">'+ML[m]+'</span><span class="s" style="width:auto;min-width:78px">'+st+'</span><b>'+fe(est)+'</b><i>›</i></div>';
  }
  // Écart total après rattrapages (un rattrapage versé un autre mois n'est pas un écart)
  var dT=Math.round(adjT*100)/100,dS=!nB?'':Math.abs(dT)<=0.05?'<span style="color:var(--green)"><span class="tk">✓</span></span>':'<span style="color:'+(dT>0?'var(--green)':'var(--red)')+'">'+(dT>0?'+':'−')+fe(Math.abs(dT))+'</span>';
  return ''
    // En-tête des colonnes au-dessus de la case, à la même place que sur la page Paie du mois
    +(rows?'<div class="sv-pr" style="cursor:default;color:var(--text3);font-size:11px;padding:0 0 2px"><span class="l"></span><span class="s" style="color:var(--text3)">bulletin</span><b style="color:var(--text3);font-weight:400">app</b></div>':'')
    // Totaux alignés sur les colonnes des mois
    +'<div class="hd-card out"><div class="sv-pr" style="cursor:default;padding:2px 0 4px"><span class="l" style="font-size:11px">total brut estimé</span><b style="width:auto;min-width:66px;font-size:17px;font-weight:700">'+(rows?fe(tot):'—')+'</b><i></i></div>'
    // Payé depuis janvier au-dessus de la colonne bulletin : ✓ conforme, ⚠ à vérifier, rien si les écarts restants sont ignorés
    +(rows?'<div class="sv-pr" style="cursor:default;padding:2px 0 4px;font-size:11px"><span class="l" style="line-height:1.4">payé depuis janvier<br>'+(nB?nB+' bulletin'+(nB>1?'s':'')+(nBad?'<br>'+nBad+' à vérifier':''):'aucun bulletin')+'</span><span class="s" style="width:auto;min-width:78px;color:var(--text)">'+(nB?fe(tB)+(nBad?' <span style="color:var(--amber)">⚠</span>':nIg?'':' <span style="color:var(--green)"><span class="tk">✓</span></span>'):'—')+'</span><b style="width:auto;min-width:66px;opacity:.6">'+(nB?fe(tBe):'')+'</b><i></i></div>':'')
    +'</div>'
    +(rows||'<div style="font-size:11px;color:var(--text3);padding:6px 0">Renseigner la paie dans Réglages → Paie pour voir l’estimation.</div>');
}
// Compteurs de l'année (pour les curieux), façon anneaux d'activité : à ce jour, par rapport à toute l'année
function _ringSvg(size,rings,wr){
  // rings : [{f:fraction (peut dépasser 1),c:couleur}], du plus grand au plus petit
  var w=size*(wr||0.105),gap=w*0.18,h='<svg class="ring" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">';
  rings.forEach(function(r,i){
    var rad=size/2-w/2-i*(w+gap),C=2*Math.PI*rad,f=Math.max(0,r.f||0);
    var arc=function(fr,extra){var o=C*(1-Math.min(1,fr));return '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+rad+'" fill="none" stroke="'+r.c+'" stroke-width="'+w+'" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+o+'" data-c="'+C+'" data-o="'+o+'"'+(extra||'')+'/>';};
    h+='<circle cx="'+size/2+'" cy="'+size/2+'" r="'+rad+'" fill="none" stroke="'+r.c+'" stroke-opacity=".18" stroke-width="'+w+'"/>';
    if(f>0)h+=arc(f);
    if(f>1){
      // Tour en plus : le bout du trait porte une ombre sur le tour d'en dessous, pour qu'on voie où il s'arrête
      h+=arc(f-1,' class="ring-over"');
      var th=2*Math.PI*Math.min(f-1,1),px=size/2+rad*Math.cos(th),py=size/2+rad*Math.sin(th),fid='rsh'+(++_ringSvg.n);
      h+='<filter id="'+fid+'" x="-1" y="-1" width="3" height="3"><feDropShadow dx="'+(-Math.sin(th)*w*0.28).toFixed(2)+'" dy="'+(Math.cos(th)*w*0.28).toFixed(2)+'" stdDeviation="'+(w*0.18).toFixed(2)+'" flood-color="#000" flood-opacity=".75"/></filter>'
        +'<circle class="ring-cap" cx="'+px.toFixed(2)+'" cy="'+py.toFixed(2)+'" r="'+(w/2).toFixed(2)+'" fill="'+r.c+'" filter="url(#'+fid+')"/>';
    }
  });
  return h+'</svg>';
}
// Courbe des heures de rendus mois par mois : acquises (vert) et consommées par les rendus posés (corail, à leur date) ;
// mois à venir en pointillé (prévu, rendus déjà posés). Un appui sur un mois : ses chiffres (et l'an dernier).
var _CV_C='#e07a6e';
// Heures de rendus restantes chaque mois (après les rendus du mois, heures expirées retirées), mêmes règles que calcSoldes :
// les plus anciennes consommées d'abord, pas d'emprunt sur un mois à venir, expiration avec les reports
function _rendRestYear(y){
  var gen=buildGen(),c0=(S.profile&&S.profile.ephSoldeCreatedYM!=null)?S.profile.ephSoldeCreatedYM:2026*12,stock={},out=[];
  var byM={};Object.keys(S.conges||{}).filter(function(k){return S.conges[k]==='rend';}).sort().forEach(function(k){var d=new Date(k+'T12:00:00'),ym=d.getFullYear()*12+d.getMonth();(byM[ym]=byM[ym]||[]).push(k);});
  // le solde de départ est rangé dans ses mois d'origine, avant le départ du calcul
  var M0=Object.keys(gen).map(Number).reduce(function(m,k){return Math.min(m,k);},c0);
  for(var M=M0;M<=y*12+11;M++){
    var g=gen[M];if(g)stock[M]=Object.values(g).reduce(function(a,v){return a+v;},0);
    (byM[M]||[]).forEach(function(k){var left=getDur(new Date(k+'T12:00:00'));
      _fifoYms(Object.keys(stock)).forEach(function(a){if(left<=0||stock[a]<=0||getExpYm(a)<M||a>M&&!_rbw(k,a))return;var t=Math.min(stock[a],left);stock[a]-=t;left-=t;});});
    if(M>=y*12)out.push(Object.keys(stock).reduce(function(a,k){return a+(getExpYm(+k)>=M?Math.max(0,stock[k]):0);},0));
  }
  while(out.length<12)out.unshift(0);return out;
}
function _cvHtml(y,hh){
  var gen=buildGen(),tot=function(ym){var g=gen[ym]||{};return (g.dim||0)+(g.rh||0)+(g.fer||0)+(g.hs||0)+(g.ram||0)+(g.extra||0);};
  var used={};Object.keys(S.conges||{}).forEach(function(k){var t=S.conges[k];if(t!=='rend'&&t!=='rend-hist')return;var d=new Date(k+'T12:00:00'),ym=d.getFullYear()*12+d.getMonth();used[ym]=(used[ym]||0)+getDur(d);});
  // avant le départ du calcul : pas de chiffres, pas de trait
  var c0=(S.profile&&S.profile.ephSoldeCreatedYM!=null)?S.profile.ephSoldeCreatedYM:2026*12,f0=Math.max(0,c0-y*12);
  var a=[],u=[],b=[],bu=[],i;for(i=0;i<12;i++){a.push(tot(y*12+i));u.push(used[y*12+i]||0);b.push(tot((y-1)*12+i));bu.push(used[(y-1)*12+i]||0);}
  var R=_rendRestYear(y);
  var hasB=c0<=(y-1)*12&&b.concat(bu).some(function(v){return v>0;}),mx=Math.max.apply(null,R.slice(f0).concat(a.slice(f0)).concat(u.slice(f0)).concat([60])),W=300,H=hh||110,P=6;
  var X=function(i){return W*(i+.5)/12;},Y=function(v){return P+(H-2*P)*(1-v/mx);};
  // trait lissé passant par les points (Catmull-Rom)
  var path=function(v,from,to){var d='',pts=[];for(var k=from;k<=to;k++)pts.push([X(k),Y(v[k])]);
    pts.forEach(function(q,k){if(!k){d='M'+q[0].toFixed(1)+' '+q[1].toFixed(1);return;}var p0=pts[k-2]||pts[k-1],p1=pts[k-1],p3=pts[k+1]||q;
      var c1=[p1[0]+(q[0]-p0[0])/6,p1[1]+(q[1]-p0[1])/6],c2=[q[0]-(p3[0]-p1[0])/6,q[1]-(p3[1]-p1[1])/6];
      c1[1]=Math.min(H-P,Math.max(P,c1[1]));c2[1]=Math.min(H-P,Math.max(P,c2[1]));
      d+='C'+c1[0].toFixed(1)+' '+c1[1].toFixed(1)+' '+c2[0].toFixed(1)+' '+c2[1].toFixed(1)+' '+q[0].toFixed(1)+' '+q[1].toFixed(1);});return d;};
  var cur=y===NOW.getFullYear()?NOW.getMonth():y<NOW.getFullYear()?11:-1;if(f0>11)cur=-1;
  var sum=function(v){return v.slice(f0,cur+1).reduce(function(s,x){return s+x;},0);},sA=sum(a),sU=sum(u);
  var h='<svg viewBox="0 0 '+W+' '+H+'" aria-hidden="true">'
    +'<defs><linearGradient id="cvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eeece5" stop-opacity=".14"/><stop offset="1" stop-color="#eeece5" stop-opacity="0"/></linearGradient></defs>';
  [.25,.5,.75].forEach(function(f){h+='<line x1="0" x2="'+W+'" y1="'+(P+(H-2*P)*f)+'" y2="'+(P+(H-2*P)*f)+'" stroke="var(--border2)" stroke-width=".5"/>';});
  h+='<line id="cv-sel" x1="0" x2="0" y1="0" y2="'+H+'" stroke="var(--text3)" stroke-width="1" stroke-dasharray="2 3" style="display:none"/>';
  // une seule courbe, le stock (heures restantes) ; ce qui le fait bouger, mois par mois, en barres : acquises (claires) et posées (corail)
  var bw=W/12*.22;
  for(i=f0;i<12;i++){var fu=i>cur?' opacity=".35"':'';
    if(a[i]>0)h+='<rect class="cv-b" x="'+(X(i)-bw-.6).toFixed(1)+'" y="'+Y(a[i]).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(H-P-Y(a[i])).toFixed(1)+'" rx="1.2" fill="rgba(238,236,229,.32)"'+fu+'/>';
    if(u[i]>0)h+='<rect class="cv-b" x="'+(X(i)+.6).toFixed(1)+'" y="'+Y(u[i]).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(H-P-Y(u[i])).toFixed(1)+'" rx="1.2" fill="'+_CV_C+'"'+(fu||' opacity=".8"')+'/>';}
  if(cur>=f0){var line=path(R,f0,cur);
    if(cur>f0)h+='<path class="cv-a" d="'+line+'L'+X(cur).toFixed(1)+' '+(H-P)+'L'+X(f0).toFixed(1)+' '+(H-P)+'Z" fill="url(#cvg)"/>';
    h+='<path class="cv-l" d="'+line+'" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round"/>';}
  if(cur<11&&f0<=11)h+='<path d="'+path(R,Math.max(f0,cur),11)+'" fill="none" stroke="var(--text)" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="2 4" stroke-linecap="round"/>';
  if(cur>=f0)h+='<circle class="cv-p" cx="'+X(cur).toFixed(1)+'" cy="'+Y(R[cur]).toFixed(1)+'" r="3.2" fill="var(--text)" stroke="var(--bg2)" stroke-width="1.5"/>';
  for(i=f0;i<12;i++)h+='<rect x="'+(W*i/12)+'" y="0" width="'+(W/12)+'" height="'+H+'" fill="transparent" style="cursor:pointer" onclick="_cvTap('+i+')"/>';
  h+='</svg>';
  var since=f0?'depuis '+MC[f0]:'depuis janvier';
  window._cvD={y:y,a:a,u:u,b:b,bu:bu,hasB:hasB,cur:cur,sA:sA,sU:sU,X:X,since:since,R:R};
  var ML='JFMAMJJASOND';
  return '<div class="cv" id="cv"><div class="cv-hd"><span id="cv-cap">Rendus '+since+'</span><b id="cv-val">'+_cvVal(sA,sU,cur>=0?R[cur]:null)+'</b></div>'+h
    +'<div class="cv-x">'+ML.split('').map(function(c,k){return '<span'+(k===cur?' class="on"':'')+'>'+c+'</span>';}).join('')+'</div>'
    +'<div class="cv-lg"><span><i style="background:var(--text)"></i>restantes</span><span><i class="sq" style="background:rgba(238,236,229,.32)"></i>acquises</span><span><i class="sq" style="background:'+_CV_C+'"></i>posées</span>'+(cur<11?'<span><i style="background:repeating-linear-gradient(90deg,var(--text3) 0 2px,transparent 2px 5px)"></i>à venir</span>':'')+'</div></div>';
}
function _cvVal(a,u,r){return '<span style="color:var(--text2);font-weight:500">+'+fmtMin(a)+'</span> <span style="color:'+_CV_C+';font-weight:500">−'+fmtMin(u)+'</span>'+(r!=null?' <span style="color:var(--text)">· reste '+fmtMin(r)+'</span>':'');}
function _cptHtml(){
  // Année en cours : à ce jour, sur toute l'année du planning
  var t=new Date(),y=t.getFullYear(),a=_bilanCount(y,t.getMonth(),t.getDate()),b=_bilanCount(y,11,31);
  var M=[{k:'jours',l:'Jours',c:'#FA2D55',u:'j'},{k:'nuits',l:'Nuit',c:'#A78BFA',u:'h'},{k:'dim',l:'Dimanches',c:'#38BDF8',u:''},{k:'matins',l:'Matins',c:'#34D399',u:''},{k:'fer',l:'Fériés',c:'#FBBF24',u:''}];
  var fmt=function(x,u){return u==='h'?fmtMin(x).replace(/h00$/,'h'):String(x)+(u==='j'?' j':'');};
  var leg=function(o){var v=a[o.k];
    return '<div class="cp-l"><span class="cp-n" style="color:'+o.c+'">'+o.l+'</span><span class="cp-v"><b data-n="'+v+'" data-u="'+o.u+'">'+fmt(v,o.u)+'</b> <small>/ '+fmt(b[o.k],o.u)+'</small></span></div>';};
  var big='<div class="cp-big">'+_ringSvg(84,M.map(function(o){return{f:b[o.k]?a[o.k]/b[o.k]:0,c:o.c};}),0.08)+'<div class="cp-ls">'+M.map(leg).join('')+'</div></div>';
  return '<div class="sv-card cp-card" id="cpt-card">'
    +_cvHtml(y)+'</div>'; // anneaux (jours, nuits, dimanches…) retirés pour l'instant : la courbe seule
}
// ================================================================
// HISTORY
// ================================================================
function renderHistory(){}
// Texte d'une ligne d'historique (corrige aussi les anciennes entrées : identifiants internes des vacations modifiées)
function _histTxt(d){var t=String(d||'').replace(/^(.+?) -> (.+?) au (\S+ \d{1,2} \S+ \d{4})$/,'$1 au $3 -> $2');t=t.charAt(0).toUpperCase()+t.slice(1);return t.replace(/_p_(.+?)_\d{10,}/g,'$1').replace(/ <-> /g,' ⇄ ').replace(/ -> /g,' → ').replace(/ \(HS\)/g,' · HS').replace(/ \(Formation\)/g,' · EPV gardés');}
// Historique : retire les lignes dont le jour n'a plus aucune modification (changement annulé depuis)
function _histClean(){if(!S.history||!S.history.length)return false;var n=JSON.stringify(S.history);
  S.history=S.history.filter(function(h){var k=h&&h.key;if(!k||!/^\d{4}-\d{2}-\d{2}$/.test(k))return true;
    if(/^Semaine du /.test(String(h.d||''))){var mon=getMonday(new Date(k+'T12:00:00'));if(S.weekLines&&S.weekLines[dk(mon)]!=null)return true;
      for(var i=0;i<7;i++){var d=new Date(mon);d.setDate(mon.getDate()+i);var o=(S.overrides||{})[dk(d)];if(o&&o.echange)return true;}return false;}
    if(/ au \S+ \d{1,2} \S+ \d{4}/.test(String(h.d||'')))return _histPeriod(h); // période posée : resserrée sur ses jours posés
    return !!((S.overrides||{})[k]||(S.conges||{})[k]||(S.excInfo||{})[k]||(S.extraRendus||{})[k]||(S.dayPrimes||{})[k]);});
  return JSON.stringify(S.history)!==n;}
// Période posée (« X au Y -> congé ») : seuls les jours travaillés sont posés ; la ligne va du premier au dernier jour
// réellement posé (pas les repos choisis en bout de période), et disparaît s'il n'en reste aucun
function _histPeriod(h){
  var m=String(h.d||'').match(/^(.+?) au (\S+ \d{1,2} \S+ \d{4}) -> (.+)$/);if(!m)return true;
  var pd=function(t){var x=t.match(/(\d{1,2}) (\S+) (\d{4})$/),i=x?MC.indexOf(x[2]):-1;return i<0?null:new Date(+x[3],i,+x[1],12);};
  var a=new Date(h.key+'T12:00:00'),b=pd(m[2]),lbl=m[3];if(!b||b<a)return true;
  var T=/^congé/.test(lbl)?['cg']:/^rendu/.test(lbl)?['rend','rend-hist']:['absent'],ks=[];
  for(var d=new Date(a);d<=b;d.setDate(d.getDate()+1)){var k=dk(d),c=(S.conges||{})[k];if(T.indexOf(c)>=0||(T[0]==='absent'&&(S.excInfo||{})[k]))ks.push(k);}
  if(!ks.length)return false;
  var f=new Date(ks[0]+'T12:00:00'),l=new Date(ks[ks.length-1]+'T12:00:00');
  h.key=ks[0];h.d=fmtDate(f)+(ks.length>1?' au '+fmtDate(l):'')+' -> '+lbl;return true;
}
function _rhMonthSections(keys,type){
  const MC2=MC;
  const allCgKeys=type==='cg'?Object.keys(S.conges||{}).filter(k=>S.conges[k]==='cg').sort():null;
  const byMonth={};
  keys.forEach(function(k){
    const d=new Date(k+'T12:00:00'),mon=getMonday(d),mk=dk(mon);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    const ym=sun.getFullYear()*12+sun.getMonth(); // group by Sunday's month: cross-month week belongs to the month its Sunday falls in
    if(!byMonth[ym])byMonth[ym]={ym,weeks:{}};
    if(!byMonth[ym].weeks[mk])byMonth[ym].weeks[mk]={mon,keys:[],min:0};
    byMonth[ym].weeks[mk].keys.push(k);
    byMonth[ym].weeks[mk].min+=getDur(d);
  });
  const color=type==='cg'?'var(--green)':'var(--rend-text)';
  return Object.keys(byMonth).map(Number).sort().map(function(ym){
    const{weeks}=byMonth[ym];
    const y=Math.floor(ym/12),m=ym%12;
    const wks=Object.keys(weeks).sort().map(function(mk){
      const{mon,keys:wkKeys,min}=weeks[mk];
      const val=type==='cg'?calcCongesUsedForKeys(wkKeys,allCgKeys)+'j':fmtMin(min);
      return '<div class="recap-row" style="padding-left:10px"><span style="color:var(--text3)">S'+isoWeek(mon)+' · '+mon.getDate()+' '+MC2[mon.getMonth()]+'</span><b style="color:'+color+'">'+val+'</b></div>';
    }).join('');
    const total=type==='cg'
      ?Object.values(weeks).reduce((s,w)=>s+calcCongesUsedForKeys(w.keys,allCgKeys),0)+'j'
      :fmtMin(Object.values(weeks).reduce((s,w)=>s+w.min,0));
    const uid='rhm-'+type+'-'+ym;
    return '<div onclick="var x=document.getElementById(\''+uid+'\');x.style.display=x.style.display===\'block\'?\'none\':\'block\'" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:5px 0">'
      +'<span style="font-size:11px;color:var(--text2)">'+MC2[m]+' '+y+'</span>'
      +'<b style="font-size:11px;color:'+color+'">'+total+'</b>'
      +'</div>'
      +'<div id="'+uid+'" style="display:none">'+wks+'</div>';
  }).join('');
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
var _lpk=null;
var _fpT=0;
// iOS 26.5 et plus : l'interrupteur « cliqué » par le code ne vibre plus, seul un vrai appui du doigt sur un interrupteur
// le fait. Chaque bouton d'action reçoit, dès qu'il apparaît, un interrupteur natif invisible sur toute sa surface :
// l'appui le bascule (vibration du système) puis remonte jusqu'au bouton, dont l'action part comme avant.
// (Glissé au moment où le doigt se pose, il arrivait trop tard : iOS a déjà choisi l'élément touché.)
var _HAP_SEL='#lp-menu button,#ask .ok,.sheet .mb,.swc-b button,.swc-a button,.sw-seg button,[data-hap]';
function _hapOff(){try{return localStorage.getItem('hap_off')==='1';}catch(e){return false;}}
// Heures sup faites un jour donné : même règle que le décompte de la semaine (calcHSWeek) —
// dépassement sur la vacation prévue au cycle ce jour-là, arrondi à la demi-heure supérieure
function _dayHSMin(date){
  const key=dk(date),VAC=getVAC(),mon=getMonday(date),i=(date.getDay()+6)%7;
  const _grid=getActiveCycleGrid(mon)||_stdGrid(_poolAt(mon)),gridRow=_grid[lineIdx(mon)]||[];
  const{vac,absent,echange,ecSelf,cycleVac}=getVac(date);if(absent)return 0;
  const _cg=(S.conges||{})[key];if(_cg&&(_cg==='cg'||_cg==='rend'||_cg==='rend-hist'||_cg==='absent'))return 0;
  const _dayBase=gridRow[i]&&gridRow[i]!=='RH'&&gridRow[i]!=='SV'&&VAC[gridRow[i]]?VAC[gridRow[i]].dur:0;
  let w=0;const _ov=(S.overrides||{})[key];
  if(echange){
    if(_ov&&_ov.hs){if(ecSelf&&vac&&vac!=='RH')w=VAC[vac]?VAC[vac].dur:0;}
    else if(cycleVac&&cycleVac!=='RH')w=VAC[cycleVac]?VAC[cycleVac].dur:0;
  }else{
    if(!vac||vac==='RH')return 0;
    if(_ov&&_ov.vac&&!_ov.echange&&_isDet(_ov.motif))return 0;
    if(_ov&&_ov.vac&&!_ov.echange&&cycleVac&&VAC[cycleVac]&&VAC[cycleVac].mixte)w=(VAC[cycleVac].dur||0)+_calcMixteHsMin(cycleVac,_ov.vac,VAC);
    else if(_ov&&_ov.vac&&!_ov.echange&&cycleVac&&cycleVac!=='RH'&&VAC[cycleVac])w=Math.max(VAC[cycleVac].dur||0,VAC[vac]?VAC[vac].dur:0);
    else if(_ov&&_ov.vac&&!_ov.echange&&!_ov.hs)w=(!cycleVac||cycleVac==='RH'||!VAC[cycleVac])?(VAC[vac]?VAC[vac].dur:0):VAC[cycleVac].dur;
    else w=VAC[vac]?VAC[vac].dur:0;
  }
  const d=Math.max(0,w-_dayBase);return d>0?Math.ceil(d/30)*30:0;
}
// Fiche du jour : une seule hauteur quel que soit le jour (on passe d'un jour à l'autre sans que la fenêtre change de taille).
// Hauteur = tout sauf la case d'en-tête + une place fixe pour celle-ci (titre, horaires, nuit/primes, alerte, note…),
// grille la plus haute de la semaine, arrondie à 8 px (absorbe la bordure du bouton du jour)
function _dayVacRows(date,VAC){
  var dw=date.getDay(),rows=[],cycleVacNames=_cycleVacList(date),_scheduledVacs=null,_accessibleVacs=null;
  if(cycleVacNames){
    var _scheduledSet=_cycleGridScheduledVacs(date);
    var _scheduledVacs=cycleVacNames.filter(function(n){return _scheduledSet.has(n);});
    var _accessibleVacs=cycleVacNames.filter(function(n){return !_scheduledSet.has(n);});
    
    var _rowSz=(dw===0||dw===6)?3:4;
    for(var _i=0;_i<_scheduledVacs.length;_i+=_rowSz)rows.push(_scheduledVacs.slice(_i,_i+_rowSz));
    var _lc=Object.keys(S.customVacs||{}).filter(function(v){return !(S.customVacs[v].hidden)&&!cycleVacNames.includes(v);});
    if(_lc.length)rows.push(_lc);
    rows.push(['SV','Autre']);
  } else {
    if(dw===6){rows=[['As1','As2','As3'],['Cs','Es','Fs'],['SV','Autre']];}
    else if(dw===0){rows=[['Ad1','Ad2','Ad3'],['Cd','Ed','Fd'],['SV','Autre']];}
    else{rows=[['A1','A2','A3','B1'],['C1','C2','D1','D2'],['P423'],['SV','Autre']];}
    var customVacs=Object.keys(VAC).filter(v=>!VAC_STD[v]&&v!=='SV'&&!(S.customVacs&&S.customVacs[v]&&S.customVacs[v].hidden));
    customVacs.forEach(function(cv){var found=false;rows.forEach(function(r){if(r.includes(cv))found=true;});if(!found)rows[rows.length-1].unshift(cv);});
  }
  return{rows:rows,sched:_scheduledVacs,acc:_accessibleVacs};
}
// Nombre max de boutons de vacation sur la semaine (semaine / samedi / dimanche n'ont pas la même grille)
function _dayVacCount(date){var VAC=getVAC(date);return _dayVacRows(date,VAC).rows.reduce(function(n,r){return n+r.filter(function(v){return !(VAC[v]&&VAC[v].mixte);}).length;},0);}
// Détachement (autre service) ou détachement syndical : la vacation prévue au cycle compte, ni heures sup ni rendus
function _isDet(m){return m==='detache'||m==='syndic';}
// Fiche du jour : jour cédé / fait, par échange ou par déplacement (formation, horaires, formateur, détachement)
function _mvTxt(key,given){var o=(S.overrides||{})[key]||{},pk=o.pair&&o.pair!==key?o.pair:null,ML={autre:'Horaires changés',forme:'Formation',formateur:'Formateur',detache:'Détachement',syndic:'Détachement syndical'};
  if(o.motif&&pk)return given?'Déplacée au '+_cvSd(pk)+' · non travaillée':ML[o.motif]+', à la place du '+_cvSd(pk);
  return given?'Cédée par échange'+(pk?' ('+_cvSd(pk)+')':'')+' · non travaillée':'Faite par échange'+(pk?', à la place du '+_cvSd(pk):'');}
// « Autre » dans la fiche du jour : les autres vacations prennent la place de la grille (en-tête et boutons du dessous gardés)
function _dayAutreHtml(){var h=_autreVacHtml();
  return '<div style="display:flex;justify-content:flex-end;margin:0 0 -22px"><button class="adj-pill" style="width:auto;padding:0 14px;height:28px;font-size:13px;position:relative;z-index:1" onclick="_dayAutre(0)">Retour</button></div>'
    +(h||'<div style="font-size:13px;color:var(--text3);padding:10px 0">Aucune vacation disponible ce jour.</div>');}
var _pendingVacSel=null;
function recalcAllMatelas(){return _withProj(_recalcAllMatelasRaw);}
function _recalcAllMatelasRaw(){
  // Return all current matelas allocations to balance
  if(S.matelasKeys){Object.values(S.matelasKeys).forEach(function(v){if(S.profile)S.profile.matelas=(S.profile.matelas||0)+v;});S.matelasKeys={};}
  var _avail=(S.profile&&S.profile.matelas)||0;if(_avail<=0)return;
  var gen=buildGen();
  var createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  var _sim={};
  for(var ym=createdYM;ym<=TODAY_YM;ym++)_sim[ym]=0;
  Object.keys(gen).forEach(function(ymStr){
    var _ym=Number(ymStr),total=Object.values(gen[_ym]).reduce(function(s,v){return s+v;},0);
    if(_ym>TODAY_YM){_sim[_ym]=total;return;}
    _sim[_ym]=total; // per-day getExpYm check (line below) handles expiry per rendu day
  });
  var _syms=_fifoYms(Object.keys(_sim));
  var _rks=Object.keys(S.conges||{}).filter(function(k){return S.conges[k]==='rend';}).sort();
  _rks.forEach(function(k){
    var _d=new Date(k+'T12:00:00'),_pym=_d.getFullYear()*12+_d.getMonth(),_kdur=getDur(_d);
    var _lft=_kdur;
    _syms.forEach(function(_ym){if(_lft<=0||_sim[_ym]<=0||getExpYm(_ym)<_pym||_ym>_pym&&!_rbw(k,_ym))return;var _tk=Math.min(_sim[_ym],_lft);_sim[_ym]-=_tk;_lft-=_tk;});
    if(_lft>0){var _use=Math.min(_lft,_avail);if(!S.matelasKeys)S.matelasKeys={};S.matelasKeys[k]=_use;S.profile.matelas=_avail-_use;_avail=S.profile.matelas;}
  });
}
// Mini-menu du jour : l'essentiel de la journée (horaires, heures faites, rendus acquis, primes)
function _dayMenuInfo(date){
  var key=dk(date),g=getVac(date),VAC=getVAC(date),cg=(S.conges||{})[key],v=g.vac&&VAC[g.vac];
  if(!v||g.absent||cg||(g.echange&&!g.ecSelf))return '';
  var out=[],dur=v.dur||0,sett=settingsForYM(date.getFullYear()*12+date.getMonth());
  out.push('<div class="lp-v"><b>'+_h(vLbl(g.vac,VAC))+'</b><span>'+(v.deb&&v.fin?v.deb+' – '+v.fin:'')+'</span><b class="lp-d">'+fmtMin(dur)+'</b></div>');
  // rendus du jour : mêmes règles que le décompte du mois (férié ×2, dimanche et RH travaillé ×½), heures sup de la semaine
  var r=[],isF=FERIES.has(key),isD=date.getDay()===0,isR=!g.echange&&!isD&&isRHDay(date);
  if(isF&&sett.ferRendu)r.push(fmtMin(dur*2)+' férié');if(isD&&sett.dimRendu)r.push(fmtMin(dur/2)+' dimanche');if(isR&&sett.rhRendu)r.push(fmtMin(dur/2)+' RH');
  var hs=0;try{hs=_dayHSMin(date);}catch(e){}if(hs>0)r.push(fmtMin(hs)+(sett.hsRendu?' HS':' HS payées'));
  var x=(S.extraRendus||{})[key];if(x&&x.dur>0)r.push(fmtMin(x.dur)+' en plus');
  var ch=[];r.forEach(function(x){ch.push('<span class="lp-c rd">+'+x+'</span>');});
  var p=[],pv=VAC[getPayVac(date)]||v,pr=pv.primes||{};
  if(pr.antenne)p.push('Antenne');if(pr.reel)p.push('Réal');if(pr.coord)p.push('Coord');if(_isMatin(date,pv))p.push('Matin');if(isPanier(date))p.push('Panier');
  var n=0;try{n=getNuitMinDay(date,VAC);}catch(e){}if(n>0)ch.push('<span class="lp-c nt">Nuit '+fmtMin(n)+'</span>');
  var dp=(S.dayPrimes||{})[key];if(dp&&dp.amt>0)p.push(_h(dp.lbl||'Prime')+' '+fmtEuro(dp.amt));
  p.forEach(function(x){ch.push('<span class="lp-c pm">'+x+'</span>');});
  if(ch.length)out.push('<div class="lp-cs">'+ch.join('')+'</div>');
  return '<div class="lp-i">'+out.join('')+'</div>';
}
// Recherche : sans majuscules ni accents
function _srN(x){return String(x==null?'':x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/<[^>]*>/g,' ');}
function _srBox(id,ph,fn){return '<div class="sr-box"><i class="ti ti-search"></i><input id="'+id+'" type="search" enterkeyhint="search" autocomplete="off" placeholder="'+ph+'" oninput="'+fn+'"></div>';}
var _TB_PAGE={suivi:1,swap:1,set:1};
// ================================================================
// BOURSE AUX ÉCHANGES : jours proposés à l'équipe (échange ou jour cédé), réponses, choix
// L'échange conclu s'enregistre ensuite dans chaque planning (Modifier → Échange), comme avant
// ================================================================
var _SW={offers:[],me:null,tab:0,at:0};
function _swName(){try{var u=JSON.parse(localStorage.getItem('auth_user')||'{}');return u.name||(S.profile&&S.profile.name)||'';}catch(e){return (S.profile&&S.profile.name)||'';}}
function _swSeen(){try{return +localStorage.getItem('swap_seen')||0;}catch(e){return 0;}}
function _swDay(d){return capitalize(fmtDate(new Date(d+'T12:00:00')).replace(/ \d{4}$/,''));}
function _swMine(d){var dt=new Date(d+'T12:00:00'),g=getVac(dt),cg=(S.conges||{})[d];
  if(cg==='cg')return 'congé';if(cg==='rend'||cg==='rend-hist')return 'rendu';if(g.absent)return 'absent';
  if(!g.vac||g.vac==='RH')return 'repos';var V=getVAC(dt)[g.vac];return vLbl(g.vac,getVAC(dt))+(V&&V.deb?' ('+V.deb+'–'+V.fin+')':'');}
// Mail au gestionnaire (Outlook) : reports, corrections du tableau de gestion et/ou de paie, au choix ; l'adresse est saisie dans Outlook
// Reports : les mois passés en argument, sinon uniquement les heures qui expirent ce mois-ci
function _gmRep(yms){
  var sd=calcSoldes(),av=function(ym){return getExpYm(ym)<TODAY_YM?(sd.preExpiry[ym]||0):(sd.realAvail[ym]||0);};
  if(!yms){var ok=Object.keys(sd.realAvail).map(Number).filter(function(ym){return ym<=TODAY_YM&&getExpYm(ym)>=TODAY_YM&&(sd.realAvail[ym]||0)>0;}).sort(function(a,b){return a-b;});
    yms=ok.filter(function(ym){return getExpYm(ym)===TODAY_YM&&!(window._autoPlan||{})[ym];});}
  return yms.filter(function(ym){return av(ym)>0;}).map(function(ym){var e=getExpYm(ym);return '- '+fmtMin(av(ym))+' acquises en '+MF_(ym)+(e<TODAY_YM?', expirées fin ':', qui expirent fin ')+MF_(e);});}
// Heures perdues : expirées il y a moins de 3 mois, avec ce qui restait à l'expiration
function _gmLost(){var sd=calcSoldes();
  return Object.keys(sd.preExpiry||{}).map(Number).filter(function(ym){var e=getExpYm(ym);return sd.preExpiry[ym]>0&&e<TODAY_YM&&e>=TODAY_YM-3;}).sort(function(a,b){return a-b;})
    .map(function(ym){return '- '+fmtMin(sd.preExpiry[ym])+' acquises en '+MF_(ym)+', perdues fin '+MF_(getExpYm(ym));});}
// Monétisation : heures monétisées dans l'app ce mois-ci ou le mois dernier (demande à faire au gestionnaire)
function _gmMonet(){return Object.keys(S.monet||{}).map(Number).filter(function(ym){var x=S.monet[ym];return x&&x.min>0&&x.req>=TODAY_YM-1;}).sort(function(a,b){return a-b;})
  .map(function(ym){return '- '+fmtMin(S.monet[ym].min)+' acquises en '+MF_(ym)+(getExpYm(ym)>=TODAY_YM?', qui expirent fin '+MF_(getExpYm(ym)):'');});}
// Paie : écarts des bulletins non ignorés, ligne par ligne, dits concrètement (ce qui est noté sur le bulletin / ce que j'ai fait)
// Heures : « 9h15 d’HS à 125 % » / « rien noté en HS à 125 % » ; nombres : singulier à 0 et 1 (« 0 panier », « 2 paniers »)
var _GM_H={hsLow:['d’HS à 125 %','HS à 125 %'],hsHigh:['d’HS à 150 %','HS à 150 %'],nuit:['d’heures de nuit','heures de nuit'],fer:['d’heures de férié','heures de férié'],dim:['d’heures de dimanche','heures de dimanche'],rh:['d’heures de repos hebdo','repos hebdo']};
var _GM_C={panier:['panier','paniers','m'],antenne:['indemnité antenne','indemnités antenne','f'],matin:['indemnité de vacation sup','indemnités de vacation sup','f'],reel:['indemnité journaux inter','indemnités journaux inter','f'],coord:['indemnité de coordination','indemnités de coordination','f']};
function _gmItem(i){
  var eu=function(x){return fmtEuro(Math.abs(x));},r=i.row,f=i.fx;
  if(r){var q=r.bq+r.rq,H=_GM_H[r.k],C=_GM_C[r.k]||[r.lbl,r.lbl,'f'],nb=function(x){return x+' '+(x>1?C[1]:C[0]);};
    if(r.eur)return r.lbl+' : '+eu(r.bm+r.rm)+' payés au lieu de '+eu(r.am);
    if(q!==r.aq){
      if(H)return (q?'tu as noté '+fmtMin(q)+' '+H[0]:'tu n’as rien noté en '+H[1])+(r.aq?' alors que j’en ai fait '+fmtMin(r.aq):' alors que je n’en ai pas fait');
      return (q?'tu as noté '+nb(q):'tu n’as noté '+(C[2]==='f'?'aucune ':'aucun ')+C[0])+(r.aq?' alors que j’en compte '+r.aq:' alors que je n’en compte '+(C[2]==='f'?'aucune':'aucun'));}
    return (H?fmtMin(q)+' '+H[0]:nb(q))+' : le bon nombre, mais '+eu(r.bm+r.rm)+' payés au lieu de '+eu(r.am);}
  if(f)return f.lbl+' : '+eu(f.bm)+' payés au lieu de '+eu(f.am);
  if(i.hs)return i.hs.map(function(h){return 'tu as noté '+fmtMin(h.bq)+' '+_GM_H[h.k][0]+' : toute demi-heure commencée est due (article VIII.5 de l’accord), soit '+fmtMin(Math.ceil(h.bq/30)*30);}).join(' ; ')||'heures sup : toute demi-heure commencée est due (article VIII.5 de l’accord)';
  if(i.id==='reste')return 'le brut diffère encore de '+eu(i.d)+' sans ligne en cause'+(i.d<0?' (en ma défaveur)':'');
  return i.lbl;}
function _gmPaie(){
  var KL={ferRendu:'d’heures de férié',dimRendu:'d’heures de dimanche',rhRendu:'d’heures de repos hebdo',hsRendu:'d’HS'},RK={fer:'ferRendu',dim:'dimRendu',rh:'rhRendu',hsLow:'hsRendu',hsHigh:'hsRendu'};
  // génération de rendus : choix gardés contre le bulletin (kept) et réglages qui diffèrent encore du bulletin (paid) ; v : ce que dit le bulletin (vrai = rendus)
  var kept=[],pd=[];try{var D=_bulPayDiffs();kept=D.keptList||[];pd=D.paid||[];}catch(e){}
  var yms=Object.keys(S.bulletins||{}).map(Number);kept.concat(pd).forEach(function(x){if(yms.indexOf(x.ym+1)<0)yms.push(x.ym+1);});
  var L=[];yms.filter(function(v,i,a){return a.indexOf(v)===i;}).sort(function(a,b){return a-b;}).forEach(function(ym){
    // heures à payer que le bulletin a mises en rendus (seulement ce qui manque)
    var kp=kept.filter(function(x){return x.ym===ym-1&&x.h>0&&x.v;}).map(function(x){return{k:x.k,t:'tu as mis '+fmtMin(x.h)+' '+KL[x.k]+' en rendus alors qu’elles doivent être payées'};})
      .concat(pd.filter(function(x){return x.ym===ym-1&&x.h>0;}).map(function(x){return{k:x.k,t:x.v?'tu as mis '+fmtMin(x.h)+' '+KL[x.k]+' en rendus alors que je les compte payées':'tu as payé '+fmtMin(x.h)+' '+KL[x.k]+' alors que je les compte en rendus'};}));
    var c=null;try{c=S.bulletins[ym]?_bulCompare(S.bulletins[ym]):null;}catch(e){}
    var ignAll=!!(c&&c.status==='ecart'&&_bulIgn(ym,c)),ignK=function(sk){return (c&&c.items||[]).some(function(i){return i.ign&&RK[String(i.id||'').slice(2)]===sk;});};
    kp=kp.filter(function(x){return !ignAll&&!ignK(x.k);}); // écarts ignorés : pas dans le mail
    var it=kp.map(function(x){return '   • génération de rendus : '+x.t;});
    if(c&&c.status==='ecart'&&!ignAll)(c.items||[]).forEach(function(i){if(i.ign)return;var sk=RK[String(i.id||'').slice(2)];if(sk&&kp.some(function(x){return x.k===sk;}))return;it.push('   • '+_gmItem(i));});
    if(it.length)L.push('- bulletin '+_deMois(ym)+' '+Math.floor(ym/12)+' (variables '+_deMois(ym-1)+') :\n'+it.join('\n'));});
  return L;}
// Objet et texte du mail (tutoiement, sans signature)
function _gmBuild(R,H,P,X,Mo){
  var sub=[],B=[];
  if(X&&X.length){sub.push('report d’heures déjà expirées');B.push('Des heures de rendus ont expiré récemment. Peux-tu m’accorder un report pour les récupérer :\n'+X.join('\n'));}
  if(R.length){sub.push('report d’heures qui vont expirer');B.push('Peux-tu m’accorder un report de mes heures de rendus qui vont expirer :\n'+R.join('\n'));}
  if(Mo&&Mo.length){sub.push('monétisation d’heures de rendus');B.push('Je n’ai pas pu poser ces heures de rendus. Peux-tu me les monétiser :\n'+Mo.join('\n'));}
  if(H){sub.push('corrections du tableau de gestion');B.push('Dans le tableau de gestion du '+H.ed+', je relève :\n'+H.L.join('\n')+'\nPeux-tu le vérifier et le corriger ?');}
  if(P.length){sub.push('corrections de paie');B.push('Sur mes bulletins de paie, je relève les écarts suivants :\n'+P.join('\n')+'\nPeux-tu les faire corriger ?');}
  var subj=sub.join(', ').replace(/, ([^,]*)$/,' et $1');subj=subj.charAt(0).toUpperCase()+subj.slice(1);
  return{sub:subj,body:'Bonjour,\n\n'+B.join('\n\n')+'\n\nMerci d’avance'};}
// ── Monétisation des rendus (règles RH 2026) ──
// Possible à partir de 6 mois après le mois d'acquisition, tant que les heures n'ont pas expiré (au plus tard à 12 mois).
// Hypothèses par défaut, à confirmer avec le gestionnaire : monétisables = HS, dimanche, férié, RH ; non = semaine ramenée,
// heures en plus ; heures reprises du tableau = à confirmer (non comptées) ; montant = heures de rendu × taux horaire de base ;
// le mois entier (pas de monétisation partielle) ; payé sur le bulletin du mois suivant la demande.
var _MONET_NAT=['hs','dim','fer','rh'];
function _tauxHYM(ym){var pr=S.profile||{},pn=getPalierForYM(ym),q=pn>0?calcPalierSalaire(pn):(pr.salaireQualif||0),h=getHeuresForYM(ym);return h>0?Math.round((q+getAncForYM(ym))/151.67*100)/100:0;}
function monetInfo(ym,G,SD){G=G||buildGen();SD=SD||calcSoldes();var g=G[ym]||{},done=((S.monet||{})[ym]||{}).min||0;
  var nat=_MONET_NAT.reduce(function(t,k){return t+(g[k]||0);},0),av=Math.max(0,SD.realAvail[ym]||0),exp=getExpYm(ym);
  var ok=Math.max(0,Math.min(av,nat-done)),open=TODAY_YM>=ym+6&&exp>=TODAY_YM;
  return{ym:ym,open:open,min:Math.round(ok),toConfirm:Math.round(Math.min(Math.max(0,av-ok),g.solde||0)),done:done,eur:Math.round(ok/60*_tauxHYM(TODAY_YM)*100)/100,exp:exp};}
function MF_(ym){return ML[ym%12].toLowerCase()+' '+Math.floor(ym/12);}
// Fiche du jour : la ½ journée de congé exceptionnel (la journée reste travaillée ou en rendu pour l'autre moitié)
function _excDayLine(k){var x=_excOf(k);if(x&&x.g&&x.g!=='j')return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;color:var(--text2);margin:-6px 0 10px"><span>'+EXC_M[x.m].l+' · '+(x.g==='h'?'1 heure':'½ journée')+' décomptée</span><a style="color:var(--blue);cursor:pointer;white-space:nowrap" onclick="_excRemove(\''+k+'\')">Retirer</a></div>';
  if(x&&x.m==='autre'){var kp=EXC_KEEP.filter(function(e){return x[e[0]];}).map(function(e){return e[1].toLowerCase();});
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;color:var(--text2);margin:-6px 0 10px"><span>'+_h(_excL(x))+' · '+(kp.length?'garde : '+kp.join(', '):'rien n’est gardé')+'</span><a style="color:var(--blue);cursor:pointer;white-space:nowrap" onclick="_excKeepSheet(\''+k+'\')">Régler</a></div>';}
  if(!x||!x.half)return '';
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;color:var(--text2);margin:-6px 0 10px"><span>½ '+EXC_M[x.m].l.toLowerCase()+' · autre moitié '+(x.rest==='rend'?'en rendu':'travaillée')+'</span>'
    +(x.rest==='rend'?'':'<a style="color:var(--blue);cursor:pointer;white-space:nowrap" onclick="_excRemove(\''+k+'\')">Retirer</a>')+'</div>';}
// Interrupteurs « ce que garde le jour » : dans le formulaire (k nul) ou sur un jour déjà posé
function _excKeepRows(k){var x=k?(S.excInfo||{})[k]||{}:null;
  return '<div class="exc-keep" style="background:var(--bg2);border-radius:16px;padding:2px 12px">'+EXC_KEEP.map(function(e,i){var on=x?!!x[e[0]]:e[0]!=='pn';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0'+(i?';border-top:0.5px solid var(--border2)':'')+'"><div style="font-size:13px">'+e[1]+(e[2]?'<div style="font-size:11px;color:var(--text3)">'+e[2]+'</div>':'')+'</div>'
      +'<label class="tgl"><input type="checkbox" data-f="'+e[0]+'"'+(on?' checked':'')+(k?' onchange="_excSet(\''+k+'\',\''+e[0]+'\',this.checked)"':'')+'><span class="tgl-s"></span></label></div>';}).join('')+'</div>';}
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
    const expYm=getExpYm(ym);
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
    const expYm=getExpYm(ym);
    const expDate=new Date(Math.floor(expYm/12),expYm%12+1,0);
    if(expDate>=targetDate)dispo+=total;
  });
  return dispo;
}
// Returns truly free ephemeral minutes for a given viewed month.
// Future rendus run with >viewedYM credits preferred first; they only fall back
// to ≤viewedYM credits when those are actually accessible (expiry >= their poseYm).
// Remaining ≤viewedYM eligible credits after all passes = dispo.
function calcTrueDispo(viewedYM){
  const gen=buildGen();
  const createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  const _sim={};
  for(let ym=createdYM;ym<=TODAY_YM;ym++)_sim[ym]=0;
  Object.keys(gen).forEach(function(ymStr){
    const ym=Number(ymStr),total=Object.values(gen[ym]).reduce(function(s,v){return s+v;},0);
    _sim[ym]=total; // use gen totals; per-day getExpYm<_pym check handles expiry; step 3 filters by current expiry
  });
  const _all=Object.keys(S.conges||{}).filter(function(k){return S.conges[k]==='rend';}).sort();
  const _sortedYms=Object.keys(_sim).map(Number).sort();
  // Snapshot brut before step 1
  const genSnapshot=[];
  _sortedYms.forEach(function(ym){if(ym<=viewedYM&&getExpYm(ym)>=viewedYM&&_sim[ym]>0)genSnapshot.push({ym,amount:_sim[ym],expYm:getExpYm(ym)});});
  // Step 1: FIFO for rendus ≤ viewedYM (they have priority, use all ≤ their month)
  _all.filter(function(k){const d=new Date(k+'T12:00:00');return d.getFullYear()*12+d.getMonth()<=viewedYM;})
    .forEach(function(k){
      const _d=new Date(k+'T12:00:00'),_pym=_d.getFullYear()*12+_d.getMonth(),_dur=getDur(_d);
      let _lft=_dur;
      _fifoYms(_sortedYms).forEach(function(_ym){
        if(_lft<=0||_sim[_ym]<=0||getExpYm(_ym)<_pym||_ym>_pym&&!_rbw(k,_ym))return;
        const _tk=Math.min(_sim[_ym],_lft);_sim[_ym]-=_tk;_lft-=_tk;
      });
    });
  // Snapshot stock actif after step 1 (before future rendus consume any)
  let stockActif=0;
  _sortedYms.forEach(function(ym){if(ym<=viewedYM&&getExpYm(ym)>=viewedYM)stockActif+=(_sim[ym]||0);});
  const afterStep1=[];
  _sortedYms.forEach(function(ym){if(ym<=viewedYM&&getExpYm(ym)>=viewedYM&&_sim[ym]>0)afterStep1.push({ym,amount:_sim[ym],expYm:getExpYm(ym)});});
  // Step 2: Future rendus — prefer >viewedYM credits first, then fall back to ≤viewedYM
  const reservedMonths=new Set();
  const reservedDetail=[];
  _all.filter(function(k){const d=new Date(k+'T12:00:00');return d.getFullYear()*12+d.getMonth()>viewedYM;})
    .forEach(function(k){
      const _d=new Date(k+'T12:00:00'),_pym=_d.getFullYear()*12+_d.getMonth(),_dur=getDur(_d);
      let _lft=_dur;
      _sortedYms.forEach(function(_ym){
        if(_lft<=0||_sim[_ym]<=0||getExpYm(_ym)<_pym||_ym>_pym&&!_rbw(k,_ym)||_ym<=viewedYM)return;
        const _tk=Math.min(_sim[_ym],_lft);_sim[_ym]-=_tk;_lft-=_tk;
      });
      if(_lft>0){
        const beforeFallback=_lft;
        _sortedYms.forEach(function(_ym){
          if(_lft<=0||_sim[_ym]<=0||getExpYm(_ym)<_pym||_ym>_pym&&!_rbw(k,_ym)||_ym>viewedYM)return;
          const _tk=Math.min(_sim[_ym],_lft);_sim[_ym]-=_tk;_lft-=_tk;
        });
        const consumed=beforeFallback-_lft;
        if(consumed>0){reservedMonths.add(_pym);reservedDetail.push({poseYm:_pym,amount:consumed});}
      }
    });
  // Step 3: remaining ≤viewedYM credits with expiry ≥viewedYM = what's genuinely free
  let dispo=0;
  const breakdown=[];
  _sortedYms.forEach(function(ym){
    if(ym<=viewedYM&&getExpYm(ym)>=viewedYM&&_sim[ym]>0){
      dispo+=_sim[ym];
      breakdown.push({ym,amount:_sim[ym]});
    }
  });
  const reserved=Math.max(0,stockActif-dispo);
  return{total:Math.max(0,dispo),breakdown,stockActif,reserved,reservedMonths,afterStep1,reservedDetail,genSnapshot};
}
// Solde « façon tableau RH » à aujourd'hui : heures des mois terminés encore valables,
// moins les rendus déjà pris (jusqu'à aujourd'hui inclus), imputés sur les mois les plus anciens.
// stockAll ajoute les heures du mois en cours (créditées par les RH seulement en fin de mois).
// Un rendu antérieur au début du suivi est « historique » : affiché mais pas décompté.
// Après un import du tableau RH, le suivi démarre au jour du tableau (son solde a déjà ces rendus en moins).
function _rendStatus(key){
  const st=S.profile&&S.profile.start;if(st)return key>st.from?'rend':'rend-hist'; // compté s'il est posé après le départ
  const pr=S.profile||{},cym=pr.ephSoldeCreatedYM!==undefined?pr.ephSoldeCreatedYM:2026*12;
  const d=new Date(key+'T12:00:00');
  if(d.getFullYear()*12+d.getMonth()<cym)return'rend-hist';
  if(pr.ephBaseDate&&key<=pr.ephBaseDate)return'rend-hist';
  return'rend';
}
function calcSoldeRH(asOf){
  const _asOf=asOf||NOW,TODAY_YM=_asOf.getFullYear()*12+_asOf.getMonth(); // masque la constante globale : calcul « à la date »
  const gen=buildGen(),todayKey=dk(_asOf);
  const _sim={};
  Object.keys(gen).forEach(function(k){const ym=Number(k);_sim[ym]=Object.values(gen[ym]).reduce(function(s,v){return s+v;},0);});
  const _yms=Object.keys(_sim).map(Number).sort(function(a,b){return a-b;});
  const acquisRows=[];
  _yms.forEach(function(ym){if(ym<TODAY_YM&&getExpYm(ym)>=TODAY_YM&&_sim[ym]>0)acquisRows.push({ym:ym,acquis:_sim[ym]});});
  const _acq={};_yms.forEach(function(ym){_acq[ym]=_sim[ym];});
  let surStock=0,rendusPris=0;const rendusList=[],alloc={};
  Object.keys(S.conges||{}).filter(function(k){return S.conges[k]==='rend'&&k<=todayKey;}).sort().forEach(function(k){
    const _d=new Date(k+'T12:00:00'),_pym=_d.getFullYear()*12+_d.getMonth();let _lft=getDur(_d);
    rendusPris+=_lft;rendusList.push({key:k,dur:_lft});
    _fifoYms(_yms).forEach(function(_ym){
      if(_lft<=0||_sim[_ym]<=0||getExpYm(_ym)<_pym||_ym>_pym&&!_rbw(k,_ym))return;
      const _tk=Math.min(_sim[_ym],_lft);_sim[_ym]-=_tk;_lft-=_tk;
      (alloc[_ym]=alloc[_ym]||[]).push({key:k,amt:_tk});
    });
    surStock+=_lft; // non couvert par les heures du mois → pris sur le matelas
  });
  const perMonth={};_yms.forEach(function(ym){perMonth[ym]={acquis:_acq[ym],conso:_acq[ym]-(_sim[ym]||0),reste:_sim[ym]||0};});
  let solde=0,courant=0;const rows=[];
  acquisRows.forEach(function(r){const reste=_sim[r.ym]||0;solde+=reste;rows.push({ym:r.ym,acquis:r.acquis,conso:r.acquis-reste,reste:reste,expYm:getExpYm(r.ym)});});
  if(getExpYm(TODAY_YM)>=TODAY_YM)courant=Math.max(0,_sim[TODAY_YM]||0);
  return{solde:solde,courant:courant,stockAll:solde+courant,rows:rows,perMonth:perMonth,surStock:surStock,rendusPris:rendusPris,rendusList:rendusList,alloc:alloc};
}
function _xlsxSplit(ref){const m=/^([A-Z]+)(\d+)$/.exec(ref);return{col:m[1],row:+m[2]};}
function _xlsxDate(serial){return new Date(Date.UTC(1899,11,30)+Math.round(serial)*864e5);}
// Lecture du tableau RH : colonnes repérées par leur titre, totaux par leur libellé (positions variables)
function _rhParse(cells,fileName){
  const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  const byRow={};Object.keys(cells).forEach(r=>{const x=_xlsxSplit(r);(byRow[x.row]=byRow[x.row]||{})[x.col]=cells[r];});
  const rowsN=Object.keys(byRow).map(Number).sort((a,b)=>a-b);
  // En-tête du tableau
  let hdrRow=null;const hdrs=[]; // [{col,name}] dans l'ordre des colonnes
  const colIdx=c=>c.split('').reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);
  for(const r of rowsN){const cs=byRow[r];const k=Object.keys(cs).find(c=>typeof cs[c]==='string'&&/date acquisition/.test(norm(cs[c])));if(k){hdrRow=r;Object.keys(cs).filter(c=>typeof cs[c]==='string').sort((a,b)=>colIdx(a)-colIdx(b)).forEach(c=>hdrs.push({col:c,name:norm(cs[c])}));break;}}
  if(!hdrRow)throw new Error('Colonne « Date acquisition » introuvable : est-ce bien le tableau Gestion ?');
  const C=(name,after)=>{const st=after?hdrs.findIndex(h=>h.col===after)+1:0;const h=hdrs.slice(st).find(h=>h.name.startsWith(name));return h?h.col:null;};
  const cDate=C('date acquisition'),cNat=C('nature'),cAcq=C('acquisition'),cCons=C('consommation'),cSol=C('solde'),cVal=C('validite',cSol),cStock=C('conso sur stock'),cCom=C('commentaire');
  const cRep1=C('report 1'),cVal1=cRep1?C('validite',cRep1):null,cRep2=C('report 2'),cVal2=cRep2?C('validite',cRep2):null;
  const repMonths=v=>{if(v===undefined||v===null||v==='')return 0;const m=/(\d+)/.exec(String(v));return m?+m[1]:0;};
  // Totaux : valeur sous le libellé
  const tot={};const labels={stock2025:/^stock au/,consoStock:/^conso sur stock/,stockAct:/^stock actualise/,cumAcq:/^cumul acquisitions/,cumCons:/^cumul consommations/,cumSol:/^cumul soldes/};
  for(const r of rowsN){if(r>=hdrRow)break;const cs=byRow[r];Object.keys(cs).forEach(c=>{if(typeof cs[c]!=='string')return;const n=norm(cs[c]);Object.keys(labels).forEach(k=>{if(tot[k]===undefined&&labels[k].test(n)){const below=(byRow[r+1]||{})[c];if(typeof below==='number')tot[k]=below;}});});}
  // Date d'édition : la plus récente des dates en haut du fichier, sinon le nom du fichier
  let edition=null;
  for(const r of rowsN){if(r>=hdrRow)break;Object.values(byRow[r]).forEach(v=>{if(typeof v==='number'&&v>40000&&v<70000){const d=_xlsxDate(v);if(!edition||d>edition)edition=d;}});}
  const fm=/(\d{2})-(\d{2})-(\d{4})/.exec(fileName||'');if(fm){const d=new Date(+fm[3],+fm[2]-1,+fm[1]);if(!edition||Math.abs(d-edition)>864e5*40)edition=d;}
  if(!edition)edition=new Date();
  // Lignes
  const lines=[];
  for(const r of rowsN){if(r<=hdrRow)continue;const cs=byRow[r];const dv=cs[cDate];if(typeof dv!=='number')continue;
    const d=_xlsxDate(dv),ym=d.getUTCFullYear()*12+d.getUTCMonth();const h=v=>typeof v==='number'?Math.round(v*60*1e4)/1e4:0; // minutes exactes (le tableau compte en heures décimales)
    const dt=c=>c&&typeof cs[c]==='number'?_xlsxDate(cs[c]):null;
    const r1=cRep1?repMonths(cs[cRep1]):0,r2=cRep2?repMonths(cs[cRep2]):0;
    lines.push({ym,nature:cNat&&cs[cNat]?String(cs[cNat]).trim():'',acq:h(cs[cAcq]),cons:h(cs[cCons]),solde:h(cs[cSol]),stock:cStock?h(cs[cStock]):0,
      valid:dt(cVal),rep:Math.round((r1+r2)/3),validRep:dt(cVal2)||dt(cVal1),com:cCom&&cs[cCom]?String(cs[cCom]):''});}
  // Dernière semaine citée dans les commentaires (« 24h posées S23 ») = jusqu'où le gestionnaire a saisi les rendus
  let lastWeek=0;lines.forEach(l=>{(l.com.match(/\bS\s?(\d{1,2})\b/gi)||[]).forEach(w=>{const n=+w.replace(/\D/g,'');if(n>=1&&n<=53&&n>lastWeek)lastWeek=n;});});
  const m=v=>typeof v==='number'?Math.round(v*60*1e4)/1e4:null;
  // Heures posées par semaine d'après les commentaires (« 20,5h en S32 », « 24h posées S23 », « 31h posés S2 »)
  // Séparateur décimal toléré même mal tapé (« 22?5h », « 7;5h »), et texte d'origine gardé pour l'afficher
  const weeks={},weekSrc={};lines.forEach(l=>{const re=/(\d+(?:[.,?;:']\d+)?)\s*h\b[^\d\/·]*?\bS\s?(\d{1,2})\b/gi;let mm;while((mm=re.exec(l.com))){const w=+mm[2],h=Math.round(parseFloat(mm[1].replace(/[,?;:']/,'.'))*60);if(w>=1&&w<=53&&h>0){weeks[w]=(weeks[w]||0)+h;(weekSrc[w]=weekSrc[w]||[]).push(mm[0].trim());}}});
  return{edition,lines,lastWeek,weeks,weekSrc,raw:tot,tot:{stock2025:m(tot.stock2025),consoStock:m(tot.consoStock),stockAct:m(tot.stockAct),cumAcq:m(tot.cumAcq),cumCons:m(tot.cumCons),cumSol:m(tot.cumSol)}};
}
// Nature du tableau RH → clé(s) de l'app
function _rhNatKey(n){const s=n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');if(/feri/.test(s))return'fer';if(/dimanche/.test(s))return'dim';if(/rcr|\bhs\b|heures? sup/.test(s))return'hs';if(/^rh\b|repos hebdo/.test(s))return'rh';if(/rament|ramen/.test(s))return'hs';if(/extra/.test(s))return'extra';return'autre:'+n;}
const _RH_NAT_LBL={fer:'Férié',dim:'Dimanche',rh:'RH',hs:'RCR (HS)',extra:'Extra'};
// Dernier tableau lu, gardé avec le compte (synchronisé entre appareils) : cellules brutes, relues à l'ouverture.
// Les lignes entièrement vides ou à zéro sont retirées (≈ 2 Ko), la relecture donne le même résultat.
function _rhStoreKey(){return 'pl_rh_cells_'+((window._authUser&&window._authUser.email)||'');}
function _rhCompact(cells){const byRow={};Object.keys(cells).forEach(r=>{const x=_xlsxSplit(r);(byRow[x.row]=byRow[x.row]||[]).push(r);});
  const keep={};Object.values(byRow).forEach(rs=>{if(rs.some(r=>{const v=cells[r];return v!==''&&v!==0&&v!=='0'&&v!=null;}))rs.forEach(r=>{keep[r]=cells[r];});});return keep;}
// Le tableau Gestion importé, tel que lu : totaux du haut, puis une ligne par acquisition (heures en h:mm), commentaires dessous ;
// en orange, les heures encore comptées dont la validité est passée (« Alerte » du gestionnaire)
// Feuille Excel du tableau, telle qu'importée : grille, lettres de colonnes, numéros de lignes (lignes vides non gardées) ;
// numéros de série Excel affichés en dates, nombres à 2 décimales comme dans Excel
function _rhSheetHtml(cells){var cols={},rows={},ci=function(c){var n=0;for(var i=0;i<c.length;i++)n=n*26+c.charCodeAt(i)-64;return n;},cl=function(n){var t='';while(n>0){var m=(n-1)%26;t=String.fromCharCode(65+m)+t;n=Math.floor((n-1)/26);}return t;};
  Object.keys(cells).forEach(function(r){var x=_xlsxSplit(r),v=cells[r];if(v===''||v==null)return;cols[ci(x.col)]=1;rows[x.row]=1;});
  var nc=Math.max.apply(null,Object.keys(cols).map(Number).concat([1])),rs=Object.keys(rows).map(Number).sort(function(a,b){return a-b;});
  var fv=function(v){if(typeof v==='number'){if(Number.isInteger(v)&&v>=36000&&v<=60000){var d=_xlsxDate(v);return String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0')+'/'+d.getUTCFullYear();}
      return Number.isInteger(v)?String(v):(Math.round(v*100)/100).toFixed(2).replace(/\.?0+$/,'').replace('.',',');}return _h(String(v));};
  var bd='border:1px solid #d4d4d4',hd='background:#f3f3f3;color:#666;font-weight:600;text-align:center;font-size:10px;'+bd,
    h='<table style="border-collapse:collapse;background:#fff;color:#111;font:11px Arial,Helvetica,sans-serif"><tr><th style="'+hd+';position:sticky;left:0;z-index:2;min-width:26px"></th>';
  for(var c=1;c<=nc;c++)h+='<th style="'+hd+';min-width:46px;padding:2px 4px">'+cl(c)+'</th>';
  h+='</tr>'+rs.map(function(r){var t='<tr><td style="'+hd+';position:sticky;left:0;z-index:1;padding:2px 4px">'+r+'</td>';
    for(var c=1;c<=nc;c++){var v=cells[cl(c)+r],num=typeof v==='number';t+='<td style="'+bd+';padding:2px 5px;white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis;text-align:'+(num?'right':'left')+'">'+(v==null||v===''?'':fv(v))+'</td>';}
    return t+'</tr>';}).join('')+'</table>';
  return '<div style="overflow:auto;-webkit-overflow-scrolling:touch;max-height:60vh;border-radius:12px;background:#fff">'+h+'</div>';}
// Fichier original affiché tel quel dans l'onglet « Feuille Excel » : lu avec ExcelJS (chargé seulement ici) pour garder la mise
// en page — largeurs de colonnes, cellules fusionnées, polices (gras, italique, couleur), bordures, alignements, formats de date,
// mise en forme conditionnelle « contient le texte » (ex. « Alerte » en rouge) ; sinon la feuille recréée à partir des valeurs
var _EXJS='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
function _xlColor(c){if(!c)return null;if(c.argb)return '#'+String(c.argb).slice(-6);
  var th=['FFFFFF','000000','E7E6E6','44546A','4472C4','ED7D31','A5A5A5','FFC000','5B9BD5','70AD47','0563C1','954F72'];
  if(c.theme!=null&&th[c.theme]){var h=th[c.theme],t=c.tint||0,rgb=[0,2,4].map(function(i){var v=parseInt(h.substr(i,2),16);v=t<0?v*(1+t):v+(255-v)*t;return Math.max(0,Math.min(255,Math.round(v)));});return 'rgb('+rgb.join(',')+')';}
  if(c.indexed!=null)return c.indexed===64||c.indexed===8?'#000':c.indexed===9?'#fff':null;return null;}
function _xlText(cell){var v=cell.value;if(v==null)return '';if(typeof v==='object'&&!(v instanceof Date)){if(v.richText)return v.richText.map(function(x){return x.text;}).join('');if(v.text!=null)return String(v.text);if('result' in v)v=v.result;if(v&&v.error)return String(v.error);}
  if(v==null)return '';var f=cell.numFmt||'';
  var asDate=v instanceof Date||(typeof v==='number'&&/[dmy]/i.test(f.replace(/"[^"]*"/g,''))&&!/\[?h\]?:mm/i.test(f));
  if(asDate){var d=v instanceof Date?v:_xlsxDate(v);return String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0')+'/'+d.getUTCFullYear();}
  if(typeof v==='number'){var dec=/0\.(0+)/.exec(f);if(dec)return v.toFixed(dec[1].length).replace('.',',');return (Number.isInteger(v)?String(v):String(+v.toPrecision(10))).replace('.',',');}
  if(typeof v==='boolean')return v?'VRAI':'FAUX';return String(v);}
var _navBackCss='display:inline-flex;align-items:center;gap:3px;color:var(--blue);font-size:13px;margin:0 0 6px;cursor:pointer';
// ── Suite de l'inscription : présentation de l'app, ligne et heures, paie ──
// Le compte est créé sur la page de connexion (nom, email vérifié, mot de passe). Tant que cette suite n'est pas terminée
// (profile.setupPending, synchronisé avec le compte), l'app y revient : après une reconnexion ou sur un autre appareil.
// Elle tourne ici pour lire le tableau Gestion et les bulletins sur place et remplir les champs avec leurs valeurs.
var SU=null;
function _suEsc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
// Actualiser en tirant vers le bas (comme dans l'app) : la saisie est gardée le temps du rechargement et reprise à la même étape
// Saisie gardée sur l'appareil (par compte) : reprise à la même étape après fermeture de l'app, actualisation ou nouvelle version
function _suKey(){return 'pl_su_'+(typeof _aid!=='undefined'&&_aid?_aid:'x');}
var _suSaveT=null;
function _suForget(){try{localStorage.removeItem(_suKey());sessionStorage.removeItem('pl_su');}catch(e){}}
function _suRestore(){var o=null;try{o=JSON.parse(sessionStorage.getItem('pl_su')||localStorage.getItem(_suKey())||'null');sessionStorage.removeItem('pl_su');}catch(e){}if(!o)return;
  SU.step=o.step||0;SU.v=o.v||SU.v;SU.rhMode=o.rhMode||null;SU.bul=o.bul||{};SU.bulMode=o.bulMode||null;SU.aviFrom=o.aviFrom;SU.anniR=o.anniR||null;
  if(o.rh){try{var rh=_rhParse(o.rh.cells,o.rh.name);SU.rh={cells:o.rh.cells,name:o.rh.name,rh:rh,P:_rhImportPlan(rh)};}catch(e){SU.rhMode=null;}}}
function _suDots(){return '<div class="su-dots">'+[0,1,2,3,4,5].map(function(i){return '<i class="'+(i===SU.step?'on':i<SU.step?'done':'')+'"></i>';}).join('')+'</div>';}
// En-tête des étapes : titre à la même hauteur que « Bienvenue », retour à gauche
function _suHd(t,back){return _suDots()+'<div class="su-hd"><span class="su-back" onclick="_suGo('+back+')" aria-label="Retour">‹</span><h1>'+t+'</h1></div>';}
function _suSec(t){return '<div class="su-sec">'+t+'</div>';}
function _suRow(l,c){return '<div class="su-row"><span class="su-lbl">'+l+'</span><span class="su-ctl">'+c+'</span></div>';}
function _suTgl(k){return '<label class="tgl"><input type="checkbox" data-k="'+k+'"'+(SU.v[k]===false?'':' checked')+'><span class="tgl-s"></span></label>';}
function _suSel(k,opts,eur){return (eur?'<span class="su-eur" id="su-e-'+k+'"></span>':'')+'<select data-k="'+k+'" onchange="_suRead();_suPayLbls();var b=document.getElementById(\'su-next4\');if(b)b.textContent=SU.v.pal?\'Continuer\':\'Continuer sans\'">'+opts.map(function(o){return '<option value="'+o[0]+'"'+(String(SU.v[k]==null?'':SU.v[k])===String(o[0])?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>';}
// 1. Présentation
function _suStep0(){
  var nm=(S.profile&&S.profile.name)||'';
  // une idée par ligne, sans phrases
  var F=[['ti-calendar','Planning',['Votre ligne semaine par semaine · cycles à jour','Modifier, échanger, déplacer en un clic']],
    ['ti-clock-hour-4','Rendus et congés',['Heures acquises : dimanches, fériés, RH, HS','Heures posées · expirations · reports','Solde de congés à jour à chaque pose']],
    ['ti-receipt-2','Paie',['Brut estimé chaque mois','Heures, primes et rattrapages compris']],
    ['ti-scale','Vérification',['Tableau Gestion et bulletins comparés à vos heures','Chaque écart repéré et expliqué']],
    ['ti-send','Démarches',['Sirhius et demande de congés → accès direct','Mail au gestionnaire pré-rédigé : écarts, reports']],
    ['ti-devices','Sur tous vos appareils',['Serveur en ligne, accessible partout','Synchro Google Agenda']]];
  return _suDots()+'<h1>Bienvenue'+(nm?' '+_suEsc(capitalize(nm)):'')+'</h1>'
    +F.map(function(f){return '<div class="su-feat"><i class="ti '+f[0]+'"></i><div><b>'+f[1]+'</b><ul class="su-fl">'+f[2].map(function(l){return '<li>'+l+'</li>';}).join('')+'</ul></div></div>';}).join('')
    +'<button class="su-btn" onclick="_suGo(1)">Commencer</button>';
}
// 2. Ligne (et équipe)
// Équipe choisie (antenne, pool cadre, coordination) : sa grille sert au choix de la ligne
function _suGrid(){window._poolTmp=SU.v.pool||'antenne';try{return getActiveCycleGrid(NOW)||_stdGrid();}finally{window._poolTmp=null;}}
function _suStep1(){
  var g=_suGrid(),VAC=getVAC(NOW),pa=_poolsAvail();
  // noms des vacations (pas leurs codes), repos en tiret ; 7 colonnes alignées sous les jours
  var cells=function(w){return (w||[]).map(function(v){var off=!v||v==='RH'||v==='SV';return '<span'+(off?' class="off"':'')+'>'+(off?'—':_suEsc(vLbl(v,VAC)))+'</span>';}).join('');};
  var sel=SU.v.line!==''&&g[+SU.v.line];
  return _suHd('Votre ligne',0)
    +(pa.length>1?_suSec('Équipe')+'<div class="su-seg">'+pa.map(function(k){return '<button class="'+((SU.v.pool||'antenne')===k?'on':'')+'" onclick="_suRead();SU.v.pool=\''+k+'\';SU.v.line=\'\';_suDraw()">'+POOLS[k].s+'</button>';}).join('')+'</div>':'')
    +_suSec('Ligne de cette semaine')
    +'<div class="su-lpick'+(SU.lineOpen?' open':'')+'"><button class="su-lsel" onclick="_suRead();SU.lineOpen=!SU.lineOpen;_suDraw()">'
    +(sel?'<span class="su-wk">'+cells(sel)+'</span>':'<span class="su-ph">Sélectionner</span>')+'<i class="ti ti-chevron-down"></i></button>'
    +(SU.lineOpen?'<div class="su-lmenu su-in"><div class="su-wk su-wkh">'+['L','M','M','J','V','S','D'].map(function(x){return '<span>'+x+'</span>';}).join('')+'</div>'
      +g.map(function(w,i){return '<div class="su-wk su-wkr'+(sel&&+SU.v.line===i?' on':'')+'" style="animation-delay:'+Math.min(i*15,200)+'ms" onclick="_suRead();SU.v.line=\''+i+'\';SU.lineOpen=false;_suDraw()">'+cells(w)+'</div>';}).join('')+'</div>':'')
    +'</div>'
    +'<button class="su-btn" onclick="_suGo(2)"'+(SU.v.line===''?' disabled':'')+'>Continuer</button>';
}
// 3. Vérifier depuis quand : une seule date pour le tableau Gestion et les bulletins
var _SU_REC_YM=NOW.getFullYear()*12-1;
// Un seul choix : le mois depuis lequel les changements sont entrés (fromYM). Départ effectif : ce mois, ou plus tôt
// si le dernier tableau Gestion s'arrête avant (premier mois qu'il ne couvre pas) — sinon ce trou ne serait compté nulle part
function _suTabYM(){return SU.rh&&SU.rh.P&&SU.rhMode==='imp'?SU.rh.P.edYM:null;}
function _suFromYM(){if(!SU.v.from)return null;var m=+SU.v.fromYM,u=_suTabYM();return u!=null&&u<m?u:m;}
function _suMoisL(ym){return ML[ym%12].toLowerCase()+' '+Math.floor(ym/12);}
// Puces : une idée par ligne
function _suPts(a,cls){return '<ul class="su-fl'+(cls?' '+cls:'')+'">'+a.filter(Boolean).map(function(l){return '<li>'+l+'</li>';}).join('')+'</ul>';}
// Ce qu'implique un mois de départ : à entrer, paies vérifiées, tableau Gestion vérifié
// Ce qu'implique le mois choisi, en trois lignes : libellé à gauche, dates à droite
function _suFromSum(m){var g=Math.max(m,NOW.getFullYear()*12),ms=_suMoisL,sm=function(ym){var n=MCs[ym%12];return (n.length<ML[ym%12].length?n+'.':n)+' '+Math.floor(ym/12);},row=function(l,v){return '<div><span>'+l+'</span><b>'+v+'</b></div>';};
  return '<div class="su-sum">'
    +(g>m?row('Vacations modifiées','dès le 1er '+sm(m))+row('Rendus et congés','dès le 1er '+sm(g)):row('Vacations et rendus','dès le 1er '+sm(m))+row('Congés','dès le 1er janvier'))
    +row('Paies vérifiées','dès '+sm(m+1))
    +row('Gestion vérifiée',SU.rhMode==='man'?'non (saisie à la main)':'dès '+ms(g))
    +'</div>';}
function _suStep2(){
  var u=_suTabYM(),top=u!=null?Math.min(u,TODAY_YM):TODAY_YM,M=[];for(var ym=top;ym>=Math.min(_SU_REC_YM,top);ym--)M.push(ym); // pas avant décembre de l'année d'avant
  if(SU.v.fromYM==null||SU.v.fromYM===''||M.indexOf(+SU.v.fromYM)<0)SU.v.fromYM=M.indexOf(_SU_REC_YM)>=0?_SU_REC_YM:top;
  SU.v.from='month';var f=+SU.v.fromYM,late=u!=null&&u<TODAY_YM;
  var sel='<select data-k="fromYM" onchange="_suRead();_suDraw()" class="su-msel">'+M.map(function(ym){return '<option value="'+ym+'"'+(f===ym?' selected':'')+'>'+capitalize(_suMoisL(ym))+(ym===_SU_REC_YM?' · recommandé':ym===top?(late?' · le plus récent':' · ce mois-ci'):'')+'</option>';}).join('')+'</select>';
  return _suHd('Depuis quel mois&nbsp;?',2)
    +sel
    +(f<TODAY_YM?'<div style="margin-top:6px">'+_suLcHtml(f)+'</div>':'')
    +'<div class="su-note" style="margin-top:10px">'+_suPts(['Entrez ce qui s’écarte du cycle depuis ce mois','Échanges, horaires, absences, formations, rendus','L’app compare ensuite vos heures au tableau Gestion et aux bulletins'])+'</div>'
    +_suFromSum(f)
    +'<button class="su-btn" onclick="_suGo(4)">Continuer</button>';
}
// Cas rare : changement de ligne entre le mois de départ et aujourd'hui → date du changement et ligne d'avant (la semaine qui le précède)
function _suLcMon(){var d=SU.v.lcD?new Date(SU.v.lcD+'T12:00:00'):null;if(!d||isNaN(d))return null;var m=getMonday(d);m.setDate(m.getDate()-7);return m;}
function _suLcHtml(f){var on=!!SU.v.lc,d0=dk(new Date(Math.floor(f/12),f%12,1,12)),pm=_suLcMon(),VAC=getVAC(NOW);
  var h=_suRow('Changé de ligne depuis&nbsp;?','<label class="tgl"><input type="checkbox" data-k="lc"'+(on?' checked':'')+' onchange="_suRead();_suDraw()"><span class="tgl-s"></span></label>');
  if(!on)return h;
  window._poolTmp=SU.v.pool||'antenne';var g;try{g=(pm&&getActiveCycleGrid(pm))||_stdGrid();}finally{window._poolTmp=null;}
  var lbl=function(w){return (w||[]).map(function(v){return !v||v==='RH'||v==='SV'?'—':vLbl(v,VAC);}).join(' ');};
  return h+_suRow('Date du changement','<input type="date" data-k="lcD" min="'+d0+'" max="'+dk(NOW)+'" value="'+(SU.v.lcD||'')+'" onchange="_suRead();_suDraw()">')
    +(pm?_suRow('Ligne la semaine du '+pm.getDate()+' '+MCs[pm.getMonth()],'<select data-k="lcL" style="width:170px"><option value="">—</option>'+g.map(function(w,i){return '<option value="'+i+'"'+(String(SU.v.lcL)===String(i)?' selected':'')+'>'+lbl(w)+'</option>';}).join('')+'</select>'):'');}
// 4. Tableau Gestion : le plus récent (solde actuel, référence de la vérification) et, pour un mois passé, celui de départ (facultatif)
function _suStep3(){
  var D=_suFromYM(),m=SU.rhMode,P=SU.rh&&SU.rh.P,S0=SU.rh0&&SU.rh0.P,mD=D!=null?ML[D%12].toLowerCase():'',
    fd=function(d){return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});},fs=function(d){return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});},
    vals=function(p,sub){return '<div class="su-tiles'+(SU.anim==='rh'?' su-pop':'')+'"><div><small>Matelas</small><b>'+(p.matelas!=null?fmtMin(p.matelas):'—')+'</b><span>stock permanent</span></div><div><small>Rendus à poser</small><b style="color:var(--rend-text)">'+fmtMin(Math.round(p.total))+'</b><span>heures encore valables</span></div></div>'+(sub?'<div class="su-tsub">'+sub+'</div>':'');};
  var h=_suHd('Tableau Gestion',1)
    +_suSec('Votre dernier tableau')
    +'<div class="su-seg"><button class="'+(m==='imp'?'on':'')+'" onclick="_suRhPick(0)">'+(SU.rhBusy===0?'<span class="su-spin"></span>Lecture…':SU.rh?'✓ Tableau du '+fs(P.ed):'Importer le tableau')+'</button>'
    +'<button class="'+(m==='man'?'on':'')+'" onclick="_suRead();if(SU.rhMode!==\'man\')SU.anim=\'rh\';SU.rhMode=\'man\';_suDraw()">Saisir à la main</button></div>';
  if(SU.rhErr)h+='<div class="su-err">'+_suEsc(SU.rhErr)+'</div>';
  if(!m)h+='<div class="su-note">'+_suPts(['<span style="color:var(--green)">Recommandé → importer le tableau : soldes exacts et vérifiés</span>','Lu en local par l’app : matelas · heures · expirations · reports'])+'</div>';
  if(m==='imp'&&P)h+=vals(P,'À jour → heures fin '+ML[(P.edYM+11)%12].toLowerCase()+' · rendus S'+(SU.rh.rh.lastWeek||'—'));
  if(m==='man')h+='<div class="su-note">'+_suPts(['<span style="color:var(--green)">Recommandé → importer le tableau : soldes exacts et vérifiés</span>','Lu en local par l’app : matelas · heures · expirations · reports','Vos soldes au 1er '+_suMoisL(TODAY_YM)+' → heures acquises jusqu’à fin '+ML[(TODAY_YM+11)%12].toLowerCase()+', moins les rendus posés','À partir de ce mois-ci → calculé par l’app (heures acquises, rendus posés)'])+'</div>'
    +'<div class="'+(SU.anim==='rh'?'su-in':'')+'">'+_suRow('Matelas<small>stock permanent</small>','<input type="text" data-k="mat" placeholder="00h00" oninput="_suRead();_suOk3()" value="'+_suEsc(SU.v.mat||'')+'">')
    +_suRow('Rendus à poser<small>heures encore valables</small>','<input type="text" data-k="eph" placeholder="00h00" oninput="_suRead();_suOk3()" value="'+_suEsc(SU.v.eph||'')+'">')+'</div>';
  h+=_suSec('Génération des rendus')
    +_suRow('Dimanches',_suTgl('dimRendu'))+_suRow('RH travaillés',_suTgl('rhRendu'))+_suRow('Fériés',_suTgl('ferRendu'))+_suRow('Heures sup.',_suTgl('hsRendu'))
    +'<button class="su-btn" id="su-next3" onclick="_suGo(3)"'+(_suCan3()?'':' disabled')+'>Continuer</button>'
    ;
  return h;
}
// Continuer : tableau lu, ou matelas et rendus saisis (0h00 accepté)
function _suHoursOk(){var ok=function(x){return x!=null&&String(x).trim()!==''&&(/^\s*0+\s*h?\s*0*\s*$/i.test(x)||parseHM(x)>0);};return !!(SU.rh&&SU.rhMode==='imp')||(SU.rhMode==='man'&&ok(SU.v.mat)&&ok(SU.v.eph));}
function _suCan3(){return SU.rhBusy==null&&_suHoursOk();}
// 5. Paie : bulletins depuis la date choisie (ils remplissent aussi palier, ancienneté…), ou saisie à la main
function _suBulNeed(){var D=_suFromYM(),o=[];if(D==null)return o;for(var ym=D+1;ym<TODAY_YM;ym++)o.push(ym);return o;}
function _suStep4(){
  var m=SU.bulMode,nb=Object.keys(SU.bul).length,pc=getPrimesConvAllForYM(TODAY_YM),D=_suFromYM(),need=_suBulNeed(),miss=need.filter(function(ym){return !SU.bul[ym];});
  var h=_suHd('Paie',3)
    +'<div class="su-seg"><button class="'+(m==='imp'?'on':'')+'" onclick="_suBulPick()">'+(SU.bulBusy?'<span class="su-spin"></span>Lecture…':nb?'✓ '+(nb>1?nb+' bulletins':'1 bulletin'):'Importer des bulletins')+'</button>'
    +'<button class="'+(m==='man'?'on':'')+'" onclick="_suRead();if(!SU.bulMode)SU.anim=\'pay\';SU.bulMode=\'man\';_suDraw()">Saisir à la main</button></div>';
  if(SU.bulErr)h+='<div class="su-err">'+_suEsc(SU.bulErr)+'</div>';
  if(!nb)h+='<div class="su-note">'+_suPts([D!=null?'<b>Recommandé</b> → bulletins de '+_suMoisL(D+1)+' à aujourd’hui (PDF)':'<b>Recommandé</b> → votre dernier bulletin (PDF)',D!=null?'Bulletin de '+ML[(D+1)%12].toLowerCase()+' = heures de '+ML[D%12].toLowerCase():'','Lu par l’app : palier · ancienneté · contrat · groupe · PFA · avantage individuel',D!=null?'Puis chaque paie vérifiée':'','Lus sur l’appareil, rien n’est envoyé'])+'</div>';
  else{var yms=Object.keys(SU.bul).map(Number).sort(function(a,b){return a-b;}),lab=function(ym){return MCs[ym%12]+' '+Math.floor(ym/12);};
    // une idée par ligne : bulletins lus, manquants, mois d'anniversaire
    var am=SU.v.anni===''||SU.v.anni==null,amb=function(t){return '<span style="color:var(--amber)">'+t+'</span>';};
    h+='<div class="su-note">'+_suPts(['Bulletins '+(nb>1?'de '+lab(yms[0])+' à '+lab(yms[nb-1]):'de '+lab(yms[0]))+' → valeurs lues ci-dessous, modifiables',
      D!=null&&miss.length?amb('Il manque '+(miss.length>1?'les bulletins':'le bulletin')+' '+_suMoisList(miss)+' → '+(miss.length>1?'mois non vérifiés':'mois non vérifié')):'',
      SU.anniR&&am?amb('Ancienneté passée à l’année suivante entre '+_suMoisL(SU.anniR[0]-1)+' et '+_suMoisL(SU.anniR[1])+' → choisir le mois d’anniversaire'):am?'Mois d’anniversaire non trouvé → rempli au bulletin qui montre le changement de prime':''])
      +'<a style="color:var(--blue);cursor:pointer;display:inline-block;margin-top:4px" onclick="_suBulPick()">+ Ajouter des bulletins</a></div>';}
  if(m){
    var P=[['','—']];for(var i=1;i<=100;i++)P.push([i,'P'+i]);
    var A=[['','—']];for(var y=0;y<=50;y++)A.push([y,y+(y>1?' ans':' an')]);
    var M=[['','—']].concat(SU.anniR?(function(){var o=[];for(var y=SU.anniR[0];y<=SU.anniR[1];y++)o.push([y%12,ML[y%12]]);return o;})():ML.map(function(l,i){return [i,l];}));
    var C=[];for(var p=5;p<=100;p+=5)C.push([p,p+' %']);if(SU.v.pct&&+SU.v.pct%5)C.push([+SU.v.pct,SU.v.pct+' %']);
    var G=[['','—']];for(var k=1;k<=9;k++)G.push([k,'Groupe '+k]);
    h+='<div class="'+(SU.anim==='pay'?'su-in':'')+'">'+_suSec('Votre paie')
      +_suRow('Palier',_suSel('pal',P,1))
      +_suRow('Ancienneté',_suSel('anc',A,1))
      +_suRow('Mois d’anniversaire<small>de l’ancienneté</small>',_suSel('anni',M))
      +_suRow('Contrat',_suSel('pct',C,1))
      +_suRow('Groupe',_suSel('grp',G,1))
      +_suRow('PFA',_suSel('pfa',[[1,'Mensuelle'],[0,'Semestrielle']]))
      +_suSec('Primes')
      +_suRow('Avantage individuel acquis<small>montant mensuel, s’il y en a un</small>','<input type="text" data-k="avi" inputmode="decimal" placeholder="0,00 €" value="'+_suEsc(SU.v.avi||'')+'">')
      +pc.map(function(x){return _suRow(_suEsc(x.label)+'<small>'+fmtEuro(x.montant)+'</small>',_suTgl('pc_'+x.id));}).join('')+'</div>';
  }
  h+='<button class="su-btn" id="su-next4" onclick="_suGo(5)"'+(SU.bulBusy?' disabled':'')+'>'+(SU.v.pal?'Continuer':'Continuer sans')+'</button>';
  return h;
}
// « de mars et avril 2026 », « de mars 2026 »
function _suMoisList(yms){var y=Math.floor(yms[yms.length-1]/12),same=yms.every(function(x){return Math.floor(x/12)===y;}),n=yms.map(function(x){return ML[x%12].toLowerCase()+(same?'':' '+Math.floor(x/12));});
  var de=function(x){return (/^[aeiouyâéè]/i.test(x)?'d’':'de ')+x;};
  if(yms.length>2&&yms[yms.length-1]-yms[0]===yms.length-1)return de(n[0])+' à '+n[n.length-1]+(same?' '+y:''); // suite de mois : « de janvier à août 2026 »
  n=n.map(de); // « de mars et d’avril »
  return (n.length>1?n.slice(0,-1).join(', ')+' et '+n[n.length-1]:n[0])+(same?' '+y:'');}
// 6. Ce qu'il reste à entrer
// Le tableau Gestion couvre l'année : ce qui restait au 31/12 y est un stock (matelas). Sa vérification part donc au plus tôt
// du 1er janvier ; les bulletins, eux, depuis la paie choisie (une paie de janvier compte les heures de décembre)
function _suGestYM(){var D=_suFromYM();if(D==null)return null;if(SU.rhMode==='man')return Math.max(D,TODAY_YM);var y=SU.rh&&SU.rh.P?SU.rh.P.ed.getFullYear():NOW.getFullYear();return Math.max(D,y*12);}
function _suStart(){var D=_suFromYM();if(D!=null)return new Date(Math.floor(D/12),D%12,1,12);return SU.rh?new Date(SU.rh.P.ed):new Date(NOW);}
// Avant de commencer : chaque élément n'apparaît qu'une fois, dans « vérifié » ou dans « non vérifié »
function _suStep5(){
  var D=_suFromYM(),st=_suStart(),fd=st.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}).replace(/^1 /,'1er '),
    need=_suBulNeed(),miss=need.filter(function(ym){return !SU.bul[ym];}),imp=need.filter(function(ym){return SU.bul[ym];}),g=_suGestYM(),ok=[],nv=[];
  if(imp.length)ok.push('Paies '+_suMoisList(imp)+' → bulletins importés');
  if(miss.length)nv.push('Paies '+_suMoisList(miss)+' → '+(imp.length?'bulletin'+(miss.length>1?'s':'')+' manquant'+(miss.length>1?'s':''):'aucun bulletin importé'));
  ok.push(imp.length||miss.length?'Paies suivantes → à chaque bulletin ajouté':'Paies dès celle '+_deMois(D+1)+' '+Math.floor((D+1)/12)+' → à chaque bulletin ajouté');
  if(SU.rhMode==='man')nv.push('Tableau Gestion → soldes saisis à la main');else ok.push('Tableau Gestion depuis '+_suMoisL(g));
  if(imp.length)ok.push('Rattrapages des mois d’avant → affichés, non vérifiés');
  // données de paie absentes (ni bulletin ni saisie) : pas de salaire estimé ni de vérification possible
  var noPay=!SU.v.pal;if(noPay)nv.unshift('Salaire estimé et paies → données de paie manquantes, à compléter dans Réglages → Paie');
  return _suHd('Avant de commencer',4)
    +_suSec('À entrer')
    +_suPts(['<b>Vacations modifiées</b> depuis le '+fd+' · échanges, horaires, absences, formations','<b>Rendus</b> posés depuis le 1er '+_suMoisL(g),'<b>Congés</b> posés depuis le 1er janvier'],'su-big')
    +_suSec('Vérifié')+_suPts(ok,'su-big')
    +(nv.length?_suSec('Non vérifié')+_suPts(nv,'su-big su-nv'):'')
    +(noPay?'<button class="su-btn" style="background:rgba(255,250,243,.09);color:var(--text);margin-top:14px" onclick="_suGo(4)">Ajouter les données de paie</button>':'')
    +'<button class="su-btn"'+(noPay?' style="margin-top:8px"':'')+' onclick="_suDone()">'+'Commencer'+'</button>';
}
function _suBulDerive(){
  var yms=Object.keys(SU.bul).map(Number).sort(function(a,b){return a-b;}),last=SU.bul[yms[yms.length-1]],d=_bulPaySet(last),v=SU.v;
  if(d.palier)v.pal=d.palier;if(d.pct)v.pct=Math.round(d.pct*100)/100;if(d.groupe)v.grp=d.groupe;if(d.anc!=null)v.anc=d.anc;if(d.pfaMens!=null)v.pfa=d.pfaMens?1:0;
  // mois d'anniversaire : deux bulletins de mois qui se suivent où l'ancienneté passe à l'année suivante ; sinon laissé vide
  // bulletins éloignés : l'ancienneté a changé entre les deux → mois à choisir dans cet intervalle (SU.anniR)
  var mo=null,prev=null;SU.anniR=null;yms.forEach(function(ym){var a=_bulPaySet(SU.bul[ym]).anc;if(a==null)return;if(prev&&a===prev.a+1){if(ym-prev.ym===1){mo=ym%12;SU.anniR=null;}else if(mo==null)SU.anniR=[prev.ym+1,ym];}prev={ym:ym,a:a};});
  var inR=function(m){if(m===''||m==null)return false;for(var y=SU.anniR[0];y<=SU.anniR[1];y++)if(y%12===+m)return true;return false;};
  v.anni=mo!=null?mo:SU.anniR?(inR(v.anni)?v.anni:''):(v.anni==null?'':v.anni);
  // avantage individuel : montant du dernier bulletin, compté depuis le premier bulletin qui le montre
  if(last.avInd!=null){v.avi=last.avInd.toFixed(2).replace('.',',');SU.aviFrom=yms[yms.length-1];for(var i=yms.length-1;i>=0;i--){if(SU.bul[yms[i]].avInd===last.avInd)SU.aviFrom=yms[i];else break;}}
}
// Dimanche (fin) de la dernière semaine notée par le gestionnaire. En janvier, une « S50 » est celle de l'année d'avant
function _rhLastWeekEnd(rh,ed){if(!rh.lastWeek)return null;var y=ed.getFullYear();if(rh.lastWeek>getISOWeek(getMonday(ed))+1)y--;
  var m=getMonday(new Date(y,0,4,12));m.setDate(m.getDate()+(rh.lastWeek-1)*7+6);m.setHours(23,59,0,0);return m;}
function _rhImportPlan(rh,keepCounted){
  const ed=new Date(rh.edition.getFullYear(),rh.edition.getMonth(),rh.edition.getDate(),12);
  const baseKey=dk(ed),edYM=ed.getFullYear()*12+ed.getMonth();
  // Solde restant de chaque mois encore valable à la date du tableau
  const split={},reports={};
  rh.lines.forEach(l=>{
    if(!l.nature||l.solde<=0)return;
    const v=l.rep?(l.validRep||l.valid):l.valid;
    if(v){const vd=new Date(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate(),12);if(vd<ed)return;}
    split[l.ym]=(split[l.ym]||0)+l.solde;
    if(l.rep)reports[l.ym]=Math.max(reports[l.ym]||0,l.rep);
  });
  const total=Object.values(split).reduce((a,b)=>a+b,0);
  // Rendus déjà déduits par le tableau → deviennent historiques
  const toHist=Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend'&&(k<=baseKey||new Date(k+'T12:00:00').getFullYear()*12+new Date(k+'T12:00:00').getMonth()<edYM)).sort();
  // Rendus postérieurs à la dernière semaine citée mais antérieurs au tableau : peut-être pas encore déduits par le gestionnaire
  const edY=ed.getFullYear();
  const _lwE=_rhLastWeekEnd(rh,ed),maybeLate=_lwE?toHist.filter(k=>new Date(k+'T12:00:00')>_lwE):[];
  // Rendus douteux que l'utilisateur garde décomptés par l'app (pas encore saisis par le gestionnaire)
  const keep=keepCounted||new Set();
  // Rendus passés en historique par un tableau plus récent (ou un départ plus tardif) mais postérieurs à celui-ci : de nouveau décomptés
  // ainsi que ceux d'après sa dernière semaine notée (un tableau plus ancien ne les a pas encore déduits)
  const toRend=Object.keys(S.conges||{}).filter(k=>{if(S.conges[k]!=='rend-hist')return false;const d=new Date(k+'T12:00:00');
    return (k>baseKey&&d.getFullYear()*12+d.getMonth()>=edYM)||(!!_lwE&&d>_lwE&&k<=baseKey&&!keep.has(k));}).sort();
  return{ed,baseKey,edYM,split,reports,total,toHist:toHist.filter(k=>!keep.has(k)),toRend,maybeLate,matelas:rh.tot.stockAct};
}
function _ephSplit(){
  const pr=S.profile||{},R=pr.ephRecon;if(!R)return pr.ephSoldeSplit;
  const out=Object.assign({},R.base),yms=Object.keys(R.base).map(Number).sort((a,b)=>a-b);
  Object.keys(S.conges||{}).filter(k=>S.conges[k]==='rend'&&k>=R.D&&k<=R.ed).sort().forEach(k=>{
    const d=new Date(k+'T12:00:00'),pym=d.getFullYear()*12+d.getMonth();let left=getDur(d);
    yms.forEach(ym=>{if(left<=0||getExpYm(ym)<pym)return;const room=(R.cap[ym]||0)-(out[ym]-(R.base[ym]||0));if(room<=0)return;const t=Math.min(room,left);out[ym]+=t;left-=t;});});
  return out;
}
// Répartition suggérée du solde de départ : les heures les plus anciennes ont été consommées en premier,
// le solde restant vient donc des mois les plus récents avant le début du suivi.
function _rhStartSplit(rh){
  const createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
  const split=S.profile&&S.profile.ephSoldeSplit;
  const S0=split&&Object.keys(split).length?Object.values(split).reduce((a,b)=>a+b,0):Math.round(((S.profile&&S.profile.ephSolde)||0)*60);
  const acq={};rh.lines.forEach(l=>{if(l.ym<createdYM&&l.nature)acq[l.ym]=(acq[l.ym]||0)+l.acq;});
  let left=S0;const out={};
  Object.keys(acq).map(Number).sort((a,b)=>b-a).forEach(ym=>{if(left<=0)return;const t=Math.min(acq[ym],left);out[ym]=t;left-=t;});
  if(left>0){const oldest=Math.min(...Object.keys(acq).map(Number),createdYM-1);out[oldest]=(out[oldest]||0)+left;} // surplus : rattaché au plus ancien mois
  return{S0,split:out,createdYM};
}
// ── Départ du calcul ──
// Une date de départ et les soldes à cette date : le matelas à part, les heures éphémères par mois d'acquisition.
// Ensuite l'app compte seule : heures acquises d'après le planning, rendus posés après le départ (heures les plus anciennes
// encore valables d'abord, comme le gestionnaire, sinon le matelas). Les tableaux Gestion plus récents servent à vérifier : ils ne changent rien.
// pr.start = {k:'tab'|'mois'|'man', d: jour de départ, from: rendus comptés après ce jour, genFrom: premier mois d'heures acquises
//   comptées par l'app, mat: matelas (min), base:{ym:min} heures éphémères restantes, rep:{ym:n} reports,
//   cons/stk:{ym:min} déjà déduit au tableau de départ, recon:{cap,ed} soldes reconstitués d'après un tableau plus récent, src: son jour}
function _rhWeekMon(y,w){const m=getMonday(new Date(y,0,4,12));m.setDate(m.getDate()+(w-1)*7);return m;}
function _rhRepOf(rh){const r={};rh.lines.forEach(l=>{if(l.nature)r[l.ym]=Math.max(r[l.ym]||0,l.rep||0);});return r;}
function _rhValidAt(l,d){const v=l.rep?(l.validRep||l.valid):l.valid;return !v||new Date(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate(),12)>=d;}
function _rhEd(rh){return new Date(rh.edition.getFullYear(),rh.edition.getMonth(),rh.edition.getDate(),12);}
// Rendus cités en commentaire : [{w,min}] (« 24h posées S23 », « 20,5h en S32 »)
function _rhComWeeks(com){const o=[],re=/(\d+(?:[.,?;:']\d+)?)\s*h\b[^\d\/·]*?\bS\s?(\d{1,2})\b/gi;let m;while((m=re.exec(com||''))){const w=+m[2],h=Math.round(parseFloat(m[1].replace(/[,?;:']/,'.'))*60);if(w>=1&&w<=53&&h>0)o.push({w,min:h});}return o;}
// Départ = un tableau Gestion : ses soldes ce jour-là ; les rendus d'après sa dernière semaine notée sont décomptés par l'app
function _startFromTable(rh){
  const ed=_rhEd(rh),base={},cons={},stk={};
  rh.lines.forEach(l=>{cons[l.ym]=(cons[l.ym]||0)+(l.cons||0);stk[l.ym]=(stk[l.ym]||0)+(l.stock||0);if(l.nature&&l.solde>0&&_rhValidAt(l,ed))base[l.ym]=(base[l.ym]||0)+l.solde;});
  const lw=_rhLastWeekEnd(rh,ed),lyms=rh.lines.map(l=>l.ym);
  return{k:'tab',d:dk(ed),from:dk(lw&&lw<ed?lw:ed),genFrom:Math.max(ed.getFullYear()*12+ed.getMonth(),lyms.length?Math.max.apply(null,lyms)+1:0),
    mat:rh.tot.stockAct!=null?rh.tot.stockAct:0,base,cons,stk,rep:_rhRepOf(rh)};}
// Départ = le 1er d'un mois, soldes reconstitués d'après un tableau plus récent : ce qui reste aux mois d'avant, plus ce que les rendus
// posés depuis y ont pris (recalculé à chaque fois) ; matelas = stock de début d'année moins les compléments pris avant le départ
function _startFromMonth(rh,Dk){
  const ed=_rhEd(rh);let D=new Date(Dk+'T12:00:00');
  if(rh.tot.stock2025!=null&&D.getFullYear()<ed.getFullYear())D=new Date(ed.getFullYear(),0,1,12); // l'année d'avant est dans le stock du tableau
  const Dym=D.getFullYear()*12+D.getMonth(),y=ed.getFullYear(),base={},cap={},rep={};
  rh.lines.forEach(l=>{if(!l.nature||l.ym>=Dym||!_rhValidAt(l,D))return;base[l.ym]=(base[l.ym]||0)+Math.max(0,l.solde);cap[l.ym]=(cap[l.ym]||0)+Math.max(0,l.acq-l.solde);if(l.rep)rep[l.ym]=Math.max(rep[l.ym]||0,l.rep);});
  let used=0;rh.lines.forEach(l=>{if(!(l.stock>0))return;const ws=_rhComWeeks(l.com),when=ws.length?_rhWeekMon(y,ws[0].w):new Date(Math.floor(l.ym/12),l.ym%12,1,12);if(when<D)used+=l.stock;});
  const mat=rh.tot.stock2025!=null?Math.round((rh.tot.stock2025-used)*1e4)/1e4:(rh.tot.stockAct||0);
  return{k:'mois',d:dk(D),from:dk(new Date(D.getFullYear(),D.getMonth(),D.getDate()-1,12)),genFrom:Dym,mat,base,rep,recon:{cap,ed:dk(ed)},src:dk(ed)};}
// Départ = le 1er d'un mois, soldes saisis (heures éphémères rattachées au mois d'avant)
function _startManual(Dk,mat,eph){const D=new Date(Dk+'T12:00:00'),Dym=D.getFullYear()*12+D.getMonth(),base={};if(eph>0)base[Dym-1]=eph;
  return{k:'man',d:Dk,from:dk(new Date(D.getFullYear(),D.getMonth(),0,12)),genFrom:Dym,mat:mat||0,base,rep:{}};}
function _startTxt(st){const fd=k=>new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}).replace(/^1 /,'1er ');
  if(!st)return '—';return st.k==='tab'?'tableau du '+fd(st.d):fd(st.d)+(st.k==='mois'?' · soldes reconstitués (tableau du '+fd(st.src)+')':st.k==='man'?' · soldes saisis':'');}
// ── Vérification par un tableau plus récent : l'état de l'app à la date du tableau (même calcul, depuis le même départ),
// matelas et heures éphémères comparés séparément. Ne modifie rien.
function _verifSim(rh){
  const pr=S.profile||{},st=pr.start,xadj=Object.keys(pr.ignRhC||{}).filter(k=>/^xfer\d+$/.test(k)).reduce((t,k)=>t+(pr.ignRhC[k]||0),0),asOf=_rhEd(rh),asOfYM=asOf.getFullYear()*12+asOf.getMonth(),asK=dk(asOf);
  if(!st||st.d>=asK)return null; // tableau pas plus récent que le départ
  // rendus comptés jusqu'à la dernière semaine notée par le gestionnaire ; ceux d'après sont mis de côté
  const lw=_rhLastWeekEnd(rh,asOf),cut=lw&&lw<asOf?lw:asOf,cutK=dk(cut),y=asOf.getFullYear(),exp=ym=>getExpYm(ym);
  // Tableau : déduit depuis le départ, sur les heures (consommation) et sur le matelas (compléments de stock)
  let consT=0,matT=0;const hasMat=rh.tot.stockAct!=null;
  if(st.k==='tab'&&st.cons&&Object.keys(st.cons).length){rh.lines.forEach(l=>{consT+=l.cons||0;});consT-=Object.values(st.cons).reduce((a,b)=>a+b,0);}
  else{const D=new Date(st.from+'T12:00:00');let pre=0;
    rh.lines.forEach(l=>{consT+=(l.cons||0)+(l.stock||0);const ws=_rhComWeeks(l.com);ws.forEach(x=>{if(_rhWeekMon(y,x.w)<=D)pre+=x.min;});});
    consT-=pre;}
  if(hasMat){matT=(st.mat||0)-rh.tot.stockAct;if(!(st.k==='tab'&&st.cons&&Object.keys(st.cons).length))consT-=matT;} // part prise sur les heures
  // App : heures acquises d'après le planning depuis le départ, rendus posés après le départ
  const pr0=S.profile;let G;
  try{const t=Object.assign({},pr0,{ephSoldeCreatedYM:st.genFrom,ephSolde:0});delete t.ephSoldeSplit;delete t.ephRecon;S.profile=t;G=buildGen(true);}finally{S.profile=pr0;}
  const acq={},nat={},adjrM={},adjM={};let adjr=0;Object.keys(G.gen).map(Number).forEach(ym=>{if(ym<st.genFrom||ym>=asOfYM)return;const g=G.gen[ym];
    nat[ym]={fer:g.fer||0,dim:g.dim||0,rh:g.rh||0,hs:(g.hs||0)+(g.ram||0),extra:g.extra||0};acq[ym]=Object.keys(g).filter(k=>k!=='solde'&&k!=='adjr').reduce((t,k)=>t+g[k],0);adjr+=g.adjr||0;adjrM[ym]=g.adjr||0;adjM[ym]=g.adj||0;});
  const isR=k=>S.conges[k]==='rend'||S.conges[k]==='rend-hist';
  const keys=Object.keys(S.conges||{}).filter(k=>isR(k)&&k>st.from&&k<=cutK).sort(),lag=Object.keys(S.conges||{}).filter(k=>isR(k)&&k>cutK&&k<=asK).sort();
  const pool={};Object.keys(st.base||{}).forEach(ym=>{pool[ym]=(pool[ym]||0)+st.base[ym];});Object.keys(acq).forEach(ym=>{pool[ym]=(pool[ym]||0)+acq[ym]+(adjrM[ym]||0);});
  // soldes reconstitués : ce que les rendus posés depuis le départ ont pris aux mois d'avant y est rajouté (comme dans le calcul)
  if(st.recon){const add={},oy=Object.keys(st.recon.cap).map(Number).sort((a,b)=>a-b);
    Object.keys(S.conges||{}).filter(k=>isR(k)&&k>=st.d&&k<=st.recon.ed).sort().forEach(k=>{const d=new Date(k+'T12:00:00'),pym=d.getFullYear()*12+d.getMonth();let left=getDur(d);
      oy.forEach(ym=>{if(left<=0||exp(ym)<pym)return;const t=Math.min((st.recon.cap[ym]||0)-(add[ym]||0),left);if(t<=0)return;add[ym]=(add[ym]||0)+t;pool[ym]+=t;left-=t;});});}
  let matA=0,consA=0;const matK=[],wkA={},yms=_fifoYms(Object.keys(pool));
  keys.forEach(k=>{const d=new Date(k+'T12:00:00'),pym=d.getFullYear()*12+d.getMonth(),dur=getDur(d),w=getISOWeek(getMonday(d));wkA[w]=(wkA[w]||0)+dur;let left=dur;
    yms.forEach(ym=>{if(left<=0||pool[ym]<=0||ym>pym&&!_rbw(k,ym)||exp(ym)<pym)return;const t=Math.min(pool[ym],left);pool[ym]-=t;left-=t;consA+=t;});if(left>0)matK.push({k,pym,left});matA+=left;});
  let appH=0;const remA={},expA={};yms.forEach(ym=>{if(ym>=asOfYM)return;if(exp(ym)>=asOfYM){appH+=pool[ym];if(pool[ym]>0)remA[ym]=pool[ym];}else if(pool[ym]>0)expA[ym]=pool[ym];});
  const tabH=rh.tot.cumSol!=null?rh.tot.cumSol:rh.lines.reduce((t,l)=>t+(l.nature&&_rhValidAt(l,asOf)?Math.max(0,l.solde):0),0);
  return{st,asOf,asOfYM,lw:rh.lastWeek,cutK,acq,adjM,nat,adjrM,remA,expA,det:G.det,keys,lag,matK,adjr,consA:consA-adjr,xadj,consT,matA:matA-xadj,matT,wkA,appH,tabH,hasMat,appM:(st.mat||0)+xadj-matA,tabM:hasMat?rh.tot.stockAct:0};
}
function canPlaceRendu(newKeys){
  // Double FIFO: compare existing-only deficit vs existing+new deficit.
  // Blocks if new keys are uncovered OR if they increase existing rendus' deficit.
  function _fifo(allKeys,trackSet){
    const gen=buildGen();
    const createdYM=(S.profile&&S.profile.ephSoldeCreatedYM!==undefined)?S.profile.ephSoldeCreatedYM:2026*12;
    const _sim={};
    for(let ym=createdYM;ym<=TODAY_YM;ym++)_sim[ym]=0;
    Object.keys(gen).forEach(function(ymStr){
      const ym=Number(ymStr),total=Object.values(gen[ym]).reduce(function(s,v){return s+v;},0);
      _sim[ym]=total; // use gen totals; per-day expiry check handles expiry
    });
    let tracked=0,other=0;
    allKeys.forEach(function(k){
      const _d=new Date(k+'T12:00:00'),_pym=_d.getFullYear()*12+_d.getMonth(),_dur=getDur(_d);
      let _lft=_dur;
      _fifoYms(Object.keys(_sim)).forEach(function(_ym){
        if(_lft<=0||_sim[_ym]<=0||getExpYm(_ym)<_pym||_ym>_pym&&!_rbw(k,_ym))return;
        const _tk=Math.min(_sim[_ym],_lft);_sim[_ym]-=_tk;_lft-=_tk;
      });
      if(_lft>0){if(trackSet&&trackSet.has(k))tracked+=_lft;else other+=_lft;}
    });
    return{tracked,other};
  }
  const _newSet=new Set(newKeys);
  const _existing=Object.keys(S.conges||{}).filter(function(k){return S.conges[k]==='rend'&&!_newSet.has(k);}).sort();
  const baseline=_fifo(_existing,null);
  const withNew=_fifo([..._existing,...newKeys].sort(),_newSet);
  // Deficit = uncovered new keys + additional burden placed on existing rendus
  return withNew.tracked+Math.max(0,withNew.other-baseline.other);
}
function computeSettForProfile(pr,targetYM,key){
  var ss=pr&&pr.settings?pr.settings:{};
  var base=ss[key]!==false;
  var hist=ss.settingsHistory||[];
  var active=null;
  for(var h of hist){var p2=h.since||'';if(!p2)continue;var py=parseInt(p2.split('-')[0]),pm=parseInt(p2.split('-')[1])-1;var hym=py*12+pm;if(hym<=targetYM)active=h;}
  return active?active[key]!==false:base;
}
function _initAnnualDots(){
  ['dimRendu','rhRendu','ferRendu','hsRendu'].forEach(k=>{
    const vals=Array.from(_annualSel).map(ym=>!!settingsForYM(ym)[k]);
    _annualActionState[k]=vals.every(v=>v)?true:vals.every(v=>!v)?false:null;
  });
  _annualActionManual=false;
}
// Rendus : changer de mois sans repasser par l'accueil (0 = mois en cours)
// Page Suivi (téléphone) : trois cases qui ouvrent chacune sa sous-page (Contrôle, Rendus, Congés)
var _SV_T={2:'Contrôle',0:'Rendus',1:'Congés'};
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
// Variables du mois : une même ligne de semaine dans les quatre onglets (dépliable s'il y a un détail), sans trait entre les lignes
function _mmWk(id,title,val,inner){return '<div'+(inner?' onclick="_ptog(\''+id+'\')"':'')+' style="font-size:11px;padding:6px 0;'+(inner?'cursor:pointer':'')+'"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-weight:500;color:var(--text)"><span id="'+id+'c" style="display:inline-block;width:10px;transition:transform .15s;'+(inner?'':'visibility:hidden')+'">›</span>'+title+'</span>'+val+'</div>'+(inner?'<div id="'+id+'" style="display:none;padding-top:3px">'+inner+'</div>':'')+'</div>';}
// Détail par semaine : une case avec son titre dedans, comme les cases de la fenêtre Rendus
function _mmBox(h){return '<div class="ucard" style="margin:10px 0 0;padding:12px 12px 6px"><div class="ucard-t" style="margin-bottom:2px">Détail par semaine</div>'+h+'</div>';}
function _mmSub(l,v){return '<div style="display:flex;justify-content:space-between;padding:2px 0 2px 10px"><span style="color:var(--text3)">'+l+'</span>'+v+'</div>';}
// Première fois qu'un onglet s'affiche dans la session : ses icônes apparaissent en petit rebond, l'une après l'autre
var _icoSeen={};
// Ordre affiché des onglets (Suivi à gauche, comme sur l'accueil) ; les numéros restent Rendus 0, Congés 1, Suivi 2
var _RCG_ORDER=[2,0,1];
function _wvLimits(){
  var cur=new Date(dk(getMonday(NOW))+'T12:00:00');
  return{min:dk(new Date(cur.getTime()-4*7*864e5)),max:dk(new Date(cur.getTime()+26*7*864e5))};
}
function _wvPickerHtml(){
  var curMon=dk(getMonday(NOW));
  var curDate=new Date(curMon+'T12:00:00');
  var _MC=MC;
  var _MCL=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var html='',lastMK=-1,pills='';
  function flush(){if(pills){html+='<div class="wv-wgrid">'+pills+'</div>';pills='';}}
  for(var w=-4;w<=26;w++){
    var wMon=new Date(curDate.getTime()+w*7*864e5);
    var wKey=dk(wMon);
    var wNum=isoWeek(wMon);
    var wSun=new Date(wMon.getTime()+6*864e5);
    var mk=wSun.getFullYear()*12+wSun.getMonth();
    if(mk!==lastMK){
      flush();
      html+='<div style="padding:8px 12px 2px;font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.03em">'+_MCL[wSun.getMonth()]+' '+wSun.getFullYear()+'</div>';
      lastMK=mk;
    }
    var isCur=wKey===curMon,isSel=wKey===_weekViewMon;
    var cls='wv-wpill'+(isCur?' wv-cur':'')+(isSel&&!isCur?' wv-sel':'');
    pills+='<div class="'+cls+'" onclick="wvGoWeek(\''+wKey+'\')">'
      +'<div class="wv-wpnum">S'+wNum+'</div>'
      +'<div class="wv-wpdate">'+wMon.getDate()+' '+_MC[wMon.getMonth()]+'</div>'
      +'</div>';
  }
  flush();
  return html;
}
var _wvPendingKey=null;
var _wvFetchTimer=null;
// Collègues par ligne pour la semaine affichée (lignes décalées selon leur semaine d'inscription)
function _wvAdjustLines(data,monDate,nLines){
  var linesData=(data&&data.lines)||{};
  var _clientCurMon=getMonday(NOW);
  var weekDelta=Math.round((getMonday(monDate)-_clientCurMon)/(7*864e5));
  var _viewedMon=getMonday(monDate);
  var adjustedLines={};
  Object.keys(linesData).forEach(function(lineName){
    (linesData[lineName]||[]).forEach(function(user){
      if((user.pool||'antenne')!==_poolAt(dk(_viewedMon)))return; // autre équipe : autres lignes
      var nl=lineName;
      if(user.regWeek&&user.regLine!==undefined){
        var _regMon=new Date(user.regWeek+'T12:00:00');
        var _diff=Math.round((_viewedMon-_regMon)/(7*864e5));
        if(_diff!==0)nl='S'+(((user.regLine+_diff)%nLines+nLines)%nLines+1);
      }else if(weekDelta!==0){
        var idx=parseInt(lineName.slice(1))-1;
        nl='S'+(((idx+weekDelta)%nLines+nLines)%nLines+1);
      }
      if(!adjustedLines[nl])adjustedLines[nl]=[];
      adjustedLines[nl].push(user);
    });
  });
  return adjustedLines;
}
function _wvHeader(monKey){
  var isCurrent=monKey===dk(getMonday(NOW));
  var lim=_wvLimits();
  var atMin=monKey<=lim.min,atMax=monKey>=lim.max;
  var monDate=new Date(monKey+'T12:00:00');
  var sunDate=new Date(monDate);sunDate.setDate(sunDate.getDate()+6);
  var weekNum=isoWeek(monDate);
  var lbl='S'+weekNum+' · '+monDate.getDate()+' — '+sunDate.getDate()+' '+MC[sunDate.getMonth()]+' '+sunDate.getFullYear();
  var _bs='background:var(--btn);border:0.5px solid var(--border);border-radius:8px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;';
  var btnL='<button onclick="weekViewNav(-1)"'+(atMin?' disabled':'')+' style="'+_bs+'color:'+(atMin?'var(--text3)':'var(--text)')+';cursor:'+(atMin?'default':'pointer')+';opacity:'+(atMin?'.35':'1')+'"><i class="ti ti-chevron-left"></i></button>';
  var btnR='<button onclick="weekViewNav(1)"'+(atMax?' disabled':'')+' style="'+_bs+'color:'+(atMax?'var(--text3)':'var(--text)')+';cursor:'+(atMax?'default':'pointer')+';opacity:'+(atMax?'.35':'1')+'"><i class="ti ti-chevron-right"></i></button>';
  var todayBtn=!isCurrent?'<button onclick="weekViewToday()" style="'+_bs+'width:auto;padding:0 8px;font-size:11px;font-weight:500;color:var(--text);cursor:pointer;">Auj.</button>':'';
  var closeBtn='<button onclick="closeWeekView()" style="'+_bs+'cursor:pointer;color:var(--text2);"><i class="ti ti-x"></i></button>';
  return '<div id="wv-header" style="display:flex;align-items:center;padding:12px 12px 10px;gap:8px;border-bottom:0.5px solid var(--border);background:var(--bg0);flex-shrink:0">'
    +'<div style="display:flex;gap:8px;align-items:center;flex:1;min-width:0">'
    +btnL
    +'<button onclick="_wvTogglePicker()" style="flex:1;min-width:0;background:var(--btn);border:0.5px solid var(--border);border-radius:8px;height:28px;padding:0 10px;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:center;font-family:var(--font)">'+lbl+'</button>'
    +todayBtn
    +btnR
    +'</div>'
    +closeBtn
    +'</div>';
}
function _wvBodyHtml(data,monKey){
  var monDate=new Date(monKey+'T12:00:00');
  var grid=getActiveCycleGrid(monDate)||_stdGrid(_poolAt(monDate));
  var nLines=grid.length;
  var VAC=getVAC(monDate);
  var days=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  var html='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'
    +'<thead><tr style="position:sticky;top:0;background:var(--bg0);z-index:1">'
    +'<th style="text-align:left;padding:8px 4px 8px 10px;font-size:11px;font-weight:500;color:var(--text3);width:62px;border-bottom:0.5px solid var(--border)">Ligne</th>';
  days.forEach(function(d,di){
    var _hd=new Date(monDate.getTime()+di*864e5);
    var _hFer=FERIES.has(dk(_hd));
    html+='<th style="padding:8px 2px;font-size:11px;font-weight:500;color:'+(_hFer?'var(--gold)':'var(--text3)')+';text-align:center;border-bottom:0.5px solid var(--border)">'+d+'</th>';
  });
  html+='</tr></thead><tbody>';
  if(!data){
    for(var i=0;i<nLines;i++){
      html+='<tr style="border-top:0.5px solid var(--border2);height:43px">'
        +'<td style="padding:0 4px 0 10px;width:62px"><div class="wv-skel" style="height:10px;width:26px;margin-bottom:4px"></div><div class="wv-skel" style="height:8px;width:38px"></div></td>';
      for(var d=0;d<7;d++)html+='<td style="padding:2px 2px"><div class="wv-skel" style="height:39px;border-radius:var(--r)"></div></td>';
      html+='</tr>';
    }
  } else {
    var adjustedLines=_wvAdjustLines(data,monDate,nLines);
    var userLine=(S&&S.profile)?'S'+(lineIdx(getMonday(monDate))+1):null;
    var _myUid=window._authUser&&window._authUser.userId;
    for(var i=0;i<nLines;i++){
      var lineName='S'+(i+1);
      var isUser=lineName===userLine;
      var otherUsers=_myUid?(adjustedLines[lineName]||[]).filter(function(u){return u.userId!==_myUid;}):(adjustedLines[lineName]||[]);
      var users=isUser?otherUsers.concat([{profileName:S.profile&&S.profile.name||_aid}]):otherUsers;
      var hasUser=users.length>0,multiUser=users.length>1;
      var profileNames=users.map(function(u){return u.profileName||u.profileId||'?';});
      var rowBg=isUser?'rgba(98,170,220,.07)':'transparent';
      html+='<tr style="border-top:0.5px solid var(--border2);background:'+rowBg+';height:43px">'
        +'<td style="padding:0 4px 0 10px;overflow:hidden;width:62px">'
        +'<div style="font-size:13px;font-weight:'+(isUser?'600':'400')+';color:'+(isUser?'var(--blue)':hasUser?'var(--text)':'var(--text3)')+'">'+lineName+(multiUser?' <span style="font-size:10px;color:var(--amber)">✕'+users.length+'</span>':'')+'</div>'
        +(hasUser?'<div style="font-size:10px;color:'+(multiUser?'var(--amber)':'var(--text3)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_h(profileNames.join(', '))+'</div>':'')
        +'</td>';
      for(var d=0;d<7;d++){
        var _cellHtml;
        if(isUser){
          var _dd=new Date(monDate.getTime()+d*864e5);
          var _st=getState(_dd),_dv2=getVac(_dd);
          var _lbl=_st==='absent'?(_excOf(dk(_dd))?EXC_M[_excOf(dk(_dd)).m].s:'abs.'):_st==='rh'?'RH':(_dv2.vac&&_dv2.vac!=='RH'?vLbl(_dv2.vac,VAC):'');
          _cellHtml='<div class="dc s-'+_st+'"><div class="dci"><span class="dv">'+_lbl+'</span></div></div>';
        } else {
          var _wvCode=(hasUser&&users[0].weekVacs)?users[0].weekVacs[d]:null;
          var _cyc=grid[i]?grid[i][d]:null;
          if(_wvCode==='CG')_cellHtml='<div class="dc s-cg"><div class="dci"><span class="dv">'+vLbl(_cyc,VAC)+'</span></div></div>';
          else if(_wvCode==='REND'||(_wvCode==='RH'&&_cyc!=='RH'))_cellHtml='<div class="dc s-rend"><div class="dci"><span class="dv">'+vLbl(_cyc,VAC)+'</span></div></div>';
          else if(_wvCode==='Abs')_cellHtml='<div class="dc s-absent"><div class="dci"><span class="dv" style="color:var(--red)">abs.</span></div></div>';
          else{var _code=(_wvCode&&_wvCode!=='-')?_wvCode:_cyc;var _isOv=!!(_wvCode&&_wvCode!=='-'&&_wvCode!==_cyc);_cellHtml=_wvCell(_code,VAC,_isOv);}
        }
        html+='<td style="padding:2px 2px">'+_cellHtml+'</td>';
      }
      html+='</tr>';
    }
  }
  html+='</tbody></table>';
  return html;
}
function _wvCell(code,VAC,isOv){
  if(!code||code==='-')return '<div class="dc s-sv"><div class="dci"></div></div>';
  if(code==='RH')return '<div class="dc s-rh"><div class="dci"><span class="dv">RH</span></div></div>';
  if(code==='CG')return '<div class="dc s-cg"><div class="dci"><span class="dv">CG</span></div></div>';
  if(code==='Abs')return '<div class="dc s-absent"><div class="dci"><span class="dv" style="color:var(--red)">abs.</span></div></div>';
  return '<div class="dc '+(isOv?'s-tv-ov':'s-tv')+'"><div class="dci"><span class="dv">'+vLbl(code,VAC)+'</span></div></div>';
}
// ================================================================
// ECHANGE COLLEGUE
// ================================================================
// Vacations valides par type de jour (pour le jour que l'on PREND)
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
var _exState={step:1,targetKey:null,targetVac:null};
// Échange déjà enregistré sur ce jour : rappel et annulation directement dans la fenêtre Échange
function _exCurHtml(key){var o=(S.overrides||{})[key];if(!o||!o.echange)return '';var VAC=getVAC(new Date(key+'T12:00:00')),pk=o.pair&&o.pair!==key?o.pair:null;
  var t=o.ecSelf?(pk?'<b>'+vLbl(o.vac,VAC)+'</b> pris ce jour, contre le '+fmtDate(new Date(pk+'T12:00:00'))+'.':'<b>'+vLbl(o.vac,VAC)+'</b> fait ce jour (échange).'):'Jour donné'+(pk?' contre le '+fmtDate(new Date(pk+'T12:00:00')):'')+'.';
  return '<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;margin-bottom:10px;border-radius:10px;background:rgba(200,128,72,.14);font-size:13px;line-height:1.4"><span style="flex:1">'+t+'</span><button class="mb" style="min-height:0;padding:5px 10px;font-size:13px;flex:none" onclick="cancelExchange(\''+key+'\')">Annuler l\u2019échange</button></div>';}
// Catégorie d'une vacation pour « Autre planning » : celle de l'admin si renseignée, sinon d'après le code
var _EX_CATS=['Son','Cadre','Coord','Réal'];
function _exCat(n,v){var c=v&&v.cat;if(c==='Cadre')return 'Cadre';if(c==='Coordination')return 'Coord';if(c==='Réal'||c==='Vidéo')return 'Réal';if(c==='Général')return 'Son';
  var M={M:'Coord',S:'Coord',Pj:'Coord',Pv:'Coord',MR:'Réal',SR:'Réal','MS-R':'Réal','MD-R':'Réal',B2V:'Cadre',C3V:'Cadre',P422V:'Cadre',MIXTE:'Cadre',BSV:'Cadre',DS:'Cadre',BDV:'Cadre',DD:'Cadre'};
  var b=String(n).toUpperCase();if(M[n]||M[b])return M[n]||M[b];var l=String((v&&v.label)||'').toUpperCase();if(M[l])return M[l];
  while(b.length>1&&/[a-z]$/.test(n.slice(0,b.length))){b=b.slice(0,-1);if(M[b])return M[b];}return 'Son';}
// Une seule vérification, la même dans les onglets Paie et Heures : réglages de paie et rendus d'après les bulletins, écart avec le tableau Gestion
function _verifRow(tab,extra){return '<div style="display:flex;align-items:center;gap:8px;margin:0 12.5px 10px 4px"><span style="flex:1;min-width:0;font-size:11px;color:var(--text3);line-height:1.35">Bulletins et tableau Gestion</span><div style="display:flex;gap:6px;flex-shrink:0">'+(extra||'')
  +'<button class="adj-pill" style="width:120px;height:32px;font-size:13px;white-space:nowrap" onclick="_bulPayPropose(function(){openSettingsModal('+tab+');},1)"><i class="ti ti-checks" style="margin-right:4px"></i>Vérifier</button></div></div>';}
function togglePsPanel(){}
var _depField=null;
var _ML=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function _mkDepPick(iM,iY,cfn){return '<div id="_dep-date-pick" style="display:none;margin-top:4px"><div style="display:flex;gap:8px;margin-bottom:12px"><select id="_dep-m" style="flex:1;height:40px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:13px;padding:0 8px">'+_ML.map(function(mn,i){return'<option value="'+(i+1)+'"'+((i+1)===iM?' selected':'')+'>'+mn+'</option>';}).join('')+'</select><input id="_dep-y" type="number" value="'+iY+'" min="2020" max="2035" style="width:88px;height:40px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);font-size:13px;padding:0 8px;box-sizing:border-box"></div><button class="mb" style="width:100%;height:44px;font-size:15px;background:var(--blue);color:#fff;border:none;border-radius:var(--r)" onclick="'+cfn+'()">Confirmer</button></div>';}
// Mois pour un <select> : un an devant à trois ans en arrière, « Depuis toujours » (0) en tête si demandé
function _ymOpts(sel,always){var ML=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],h=always?'<option value="0"'+(sel===0?' selected':'')+'>Depuis toujours</option>':'';
  for(var x=Math.max(TODAY_YM+12,sel);x>=Math.min(TODAY_YM-36,sel||TODAY_YM);x--)h+='<option value="'+x+'"'+(x===sel?' selected':'')+'>'+ML[x%12]+' '+Math.floor(x/12)+'</option>';return h;}
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
function formatLineOption(idx,grid){
  const lineData=(grid||_stdGrid())[idx];
  if(!lineData)return'—';
  return lineData.map(function(v){return(!v||v==='RH')?'—':v;}).join(' ');
}
function weeksDiff(date){
  return Math.round((getMonday(date)-ANCHOR)/(7*864e5));
}
function coversMealSlot(debMin,finMin){
  return(debMin<=690&&finMin>=870)||(debMin<=1110&&finMin>=1290);
}
// ── Modifier : prévue ce jour, un autre jour (déplacement, échange) ou toute la semaine ──
// Jour court : « lun. 5 »
function _cvSd(k){var d=new Date(k+'T12:00:00');return ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'][d.getDay()]+' '+d.getDate();}
// État de départ : déplacement / échange déjà posé, sinon ce jour ; rôle par défaut : repos → je le fais à la place d'un autre, jour travaillé → je ne le fais pas
function _cvWInit(key){var o=(S.overrides||{})[key]||{},d=new Date(key+'T12:00:00'),c=getCycleVac(d).cycleVac,mon=getMonday(d);
  if(o.echange&&o.pair&&o.pair!==key){var pm=getMonday(new Date(o.pair+'T12:00:00'));
    return{when:'other',role:o.ecSelf?'take':'give',other:o.pair,wOff:Math.round((pm-mon)/(7*864e5)),exVac:o.motif?null:_exBaseOf(o.ecSelf?o:((S.overrides||{})[o.pair]||{})),exHs:!!(o.ecSelf?o.hs:((S.overrides||{})[o.pair]||{}).hs),exT:_exTOf(o.ecSelf?o:((S.overrides||{})[o.pair]||{}))};}
  return{when:'day',role:c&&c!=='RH'?'give':'take',other:null,wOff:0,exVac:o.echange&&!o.motif?_exBaseOf(o):null,exHs:!!(o.echange&&o.hs),exT:o.echange&&!o.motif?_exTOf(o):null};}
// Échange aux horaires différents : la vacation de base est gardée (exBase), les horaires faits sont une vacation perso
function _exBaseOf(o){return o&&(o.exBase||o.vac)||null;}
function _exTOf(o){var v=o&&o.exBase&&(S.customVacs||{})[o.vac];if(!v)return null;var t=parseHM(v.fin)-parseHM(v.deb);if(t<0)t+=1440;var pz=t-(v.dur||0);return{deb:v.deb,fin:v.fin,pause:pz>=60?'60':pz>=45?'45':'0'};}
function _cvTOpts(){var h='<option value="">—</option>';for(var m=0;m<1440;m+=15){var t=String(Math.floor(m/60)).padStart(2,'0')+'h'+String(m%60).padStart(2,'0');h+='<option value="'+t+'">'+t+'</option>';}return h;}
function _cvFKey(){var W=window._cvW||{},k=pendingKey;return W.when==='other'&&W.role==='give'&&W.other?W.other:k;}
// Sélecteurs du haut : Prévue (ce jour / un autre jour / semaine) ; pour un autre jour : rôle de ce jour et choix de l'autre jour (‹ › pour changer de semaine)
// Rangée des jours (‹ › : autre semaine). Le jour ouvert = ce jour ; un autre jour = déplacement ou échange.
// Sens déduit du jour ouvert : jour travaillé → « Fait le » (il est cédé) ; repos → « Vacation prévue le » (il est fait à la place)
function _cvWhenHtml(key,W){var mon=getMonday(new Date(key+'T12:00:00'));mon.setDate(mon.getDate()+7*(W.wOff||0));

  var h='<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px"><div class="cv-sec" style="margin:0">Jour travaillé'+(W.role==='give'?'':' <span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text3)">· ce jour, à la place du</span>')+'</div>'
    +(W.wOff?'<span style="font-size:11px;color:var(--text)">semaine du '+mon.getDate()+' '+MCs[mon.getMonth()]+'</span>':'')+'</div>'
    // rangée en pilule comme les onglets de l'app : ‹ jours de la semaine ›
    +'<div class="cv-days" ontouchstart="window._cvTx=event.touches[0].clientX;window._cvTy=event.touches[0].clientY" ontouchend="var t=event.changedTouches[0],dx=t.clientX-(window._cvTx||t.clientX),dy=t.clientY-(window._cvTy||t.clientY);if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.5){event.stopPropagation();_cvWeek(dx<0?1:-1);}"><button type="button" class="cvd-nav" onclick="_cvWeek(-1)" aria-label="Semaine précédente">‹</button><div class="exchange-days" style="flex:1;min-width:0">';
  for(var i=0;i<7;i++){var d=new Date(mon);d.setDate(mon.getDate()+i);var k=dk(d),g=getVac(d),me=k===key,sel=me?!W.other:k===W.other;
    // jour choisi : surbrillance forte ; jour ouvert quand un autre est choisi : surbrillance légère
    h+='<div class="exchange-day'+(sel?' pick':me?' ced':'')+'" onclick="_cvPickDay(\''+k+'\')"><div class="exc-dl">'+['dim','lun','mar','mer','jeu','ven','sam'][d.getDay()]+'</div><div class="exc-day-n">'+d.getDate()+'</div><div class="exc-day-v">'+(g.vac&&g.vac!=='RH'?_h(vLbl(g.vac,getVAC(d))):'–')+'</div></div>';}
  return h+'</div><button type="button" class="cvd-nav" onclick="_cvWeek(1)" aria-label="Semaine suivante">›</button></div>';}
// Échange : vacations du jour fait (celles du cycle ce jour-là, puis les autres)
function _cvExGrid(fk){var W=window._cvW||{},d=new Date(fk+'T12:00:00'),VAC=getVAC(d);
  var dv=_dayVacRows(d,VAC),typ=dv.rows.reduce(function(a,r){return a.concat(r);},[]).filter(function(n){var v=VAC[n];return n!=='SV'&&n!=='Autre'&&v&&!v.mixte&&v.dur>0;});
  var bt=function(n){return '<button type="button" class="mb vt'+(n===W.exVac?' exsel':'')+'" data-exv="'+n+'" onclick="_cvPickExVac(this)" style="background:var(--blue-l);color:var(--text)"><div style="font-weight:700">'+vLbl(n,VAC)+'</div><div style="font-size:10px;opacity:.7;font-weight:400">'+fmtMin(VAC[n].dur)+'</div></button>';};
  // « Autres » : celles du jour hors grille, rangées par catégorie (comme la fiche du jour) ; ouvert si la vacation choisie en fait partie
  if(dv.sched){window._autreVacsForDay=dv.acc;window._cycleVacsShown=dv.sched;}
  var oth=_autreVacHtml(fk,1),open=!!(W.exVac&&typ.indexOf(W.exVac)<0);
  return '<div style="font-size:11px;color:var(--text2);margin:2px 0 6px">Vacation faite le '+_cvSd(fk)+'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'+typ.map(bt).join('')
    +(oth?'<button type="button" class="mb vt" style="background:var(--bg0);color:var(--text2);font-weight:700" onclick="var o=document.getElementById(\'cv-exo\');o.style.display=o.style.display?\'\':\'none\'">Autres</button>':'')+'</div>'
    +(oth?'<div id="cv-exo"'+(open?'':' style="display:none"')+'>'+oth+'</div>':'')
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 2px 0"><span style="font-size:13px">Horaires différents</span>'
    +'<label class="tgl"><input type="checkbox" id="cv-exhr"'+(W.exHr?' checked':'')+' onchange="_cvExHr(this.checked)"><span class="tgl-s"></span></label></div>'
    +'<div id="cv-exhr-f" class="mr2" style="grid-template-columns:1fr 1fr 1fr;margin:8px 0 0'+(W.exHr?'':';display:none')+'">'
    +[['cv-exd','Début',_cvTOpts()],['cv-exf','Fin',_cvTOpts()],['cv-exp','Pause','<option value="0">Sans</option><option value="45">45 min</option><option value="60">1h00</option>']].map(function(a){return '<div><label>'+a[1]+'</label><select id="'+a[0]+'" onchange="_cvExTRead()" style="width:100%;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--r);font-size:15px;background:var(--bg2);color:var(--text);font-family:var(--font);-webkit-appearance:none">'+a[2]+'</select></div>';}).join('')+'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 2px 0"><span style="font-size:13px">Heures sup <span style="font-size:11px;color:var(--text3)">demande de la direction</span></span>'
    +'<label class="tgl"><input type="checkbox" id="cv-exhs"'+(W.exHs?' checked':'')+' onchange="window._cvW.exHs=this.checked;var h=document.getElementById(\'cv-exhint\');if(h)h.textContent=this.checked?\'Les heures faites comptent : ce qui dépasse part en heures sup. Primes de la vacation faite.\':\'Les heures prévues comptent (pas d’heures sup). Primes de la vacation faite.\'"><span class="tgl-s"></span></label></div>'
    +'<div class="cv-hint" id="cv-exhint" style="margin:8px 2px 4px">'+(W.exHs?'Les heures faites comptent : ce qui dépasse part en heures sup. Primes de la vacation faite.':'Les heures prévues comptent (pas d’heures sup). Primes de la vacation faite.')+'</div>'
    +'<button type="button" class="adj-pill" style="width:auto;padding:0 14px;height:30px;font-size:13px;margin:8px 0 2px" onclick="_cvSetWhen(\'week\')">Échanger toute la semaine…</button>';}
// Nom : vacations connues du jour proposées ; en choisir une remplit horaires, pause et prime (ex. B1 rallongée sur un repos)
// Vacations proposables ce jour-là : celles du cycle actif pour ce type de jour (sans cycle : la grille par défaut du jour), plus les vacations perso visibles
function _cvDayVacs(date,VAC){var ns=_cycleVacList(date);
  if(!ns)ns=_dayVacRows(date,VAC).rows.reduce(function(a,r){return a.concat(r);},[]).filter(function(n){return n!=='SV'&&n!=='Autre';});
  Object.keys(S.customVacs||{}).forEach(function(k){if(!S.customVacs[k].hidden&&ns.indexOf(k)<0)ns=ns.concat([k]);});return ns;}
function _cvVacOpts(date,VAC){var dw=date.getDay(),dt=dw===6?'sat':dw===0?'sun':'week',ns=_cvDayVacs(date,VAC);
  var seen={};return ns.filter(function(n){var v=VAC[n];if(!v||v.mixte||!(v.dur>0)||n==='RH'||n==='SV')return false;var ts=String(v.type||'all').split(',');if(_globalVacs[n]&&!(ts.includes('all')||ts.includes(dt)))return false;var l=vLbl(n,VAC);if(seen[l])return false;seen[l]=1;return true;})
    .map(function(n){var v=VAC[n];return '<option value="'+String(vLbl(n,VAC)).replace(/"/g,'&quot;')+'">'+(v.deb||'')+'–'+(v.fin||'')+'</option>';}).join('');}
// Pré-remplissage : on garde les valeurs d'avant ; si le nom ne correspond plus à une vacation (C1 → C10), elles reviennent
// (sauf si l'utilisateur a retouché les champs entre-temps)
var _cvAuto=null;
// Autres vacations du jour, par catégorie (fiche du jour : à la place de la grille ; échange : fenêtre à part)
function _autreVacHtml(k,ex){
  const key=k||pendingKey||_lpk;
  const date=key?new Date(key+'T12:00:00'):new Date();
  const VAC=getVAC(date);
  const dw=date.getDay();
  const isSam=dw===6,isDim=dw===0,isWeek=!isSam&&!isDim;

  function vacBtn(vn){
    const vi=VAC[vn];const dur=vi?vi.dur:0;
    return '<button class="mb vt'+(ex&&vn===(window._cvW||{}).exVac?' exsel':'')+'" style="background:var(--blue-l);color:var(--text);border:0.5px solid var(--border);width:100%;" '+(ex?'data-exv="'+vn+'" onclick="_cvPickExVac(this)"':'onclick="avw(\''+vn+'\')"')+'>'
      +'<div style="font-weight:700">'+(vi&&vi.label?vi.label:vn)+'</div>'
      +'<div style="font-size:10px;opacity:.7;font-weight:400">'+fmtMin(dur)+'</div>'
      +'</button>';
  }
  function debMin(vn){const v=VAC[vn];if(!v)return 9999;const m=(v.deb||'').match(/(\d+)h(\d*)/i);return m?parseInt(m[1])*60+(parseInt(m[2])||0):9999;}
  function section(title,vns){
    if(!vns.length)return'';
    const sorted=vns.slice().sort(function(a,b){return debMin(a)-debMin(b);});
    return'<div style="margin-top:10px;margin-bottom:5px;font-size:13px;font-weight:700;color:var(--text2)">'+title+'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px">'
      +sorted.map(vacBtn).join('')+'</div>';
  }

  const VAC_CAT={
    M:'Coordination',S:'Coordination',Pj:'Coordination',Pv:'Coordination',
    MR:'Réal',SR:'Réal','Ms-R':'Réal','Md-R':'Réal',
    B2V:'Cadre',C3V:'Cadre',P422V:'Cadre',MIXTE:'Cadre',BsV:'Cadre',Ds:'Cadre',BdV:'Cadre',Dd:'Cadre',
  };
  const _oc={}; // vacation d'une autre équipe : rangée sous le nom de l'équipe
  const _VCU={};Object.keys(VAC_CAT).forEach(function(k){_VCU[k.toUpperCase()]=VAC_CAT[k];});
  function vacCat(n){
    // Catégorie choisie dans l'admin d'abord ; sinon d'après le code
    if(_oc[n])return _oc[n]; // rangée sous l'équipe dont la grille la contient
    var _cv=VAC[n]&&VAC[n].cat;if(_cv==='Vidéo')_cv='Réal'; // ancienne catégorie
    if(_cv==='Coordination'||_cv==='Réal'||_cv==='Cadre')return _cv;if(_cv==='Général')return'Autre';
    if(VAC_CAT[n])return VAC_CAT[n];
    if(_VCU[String(n).toUpperCase()])return _VCU[String(n).toUpperCase()];
    var b=n;
    while(b.length>1&&b[b.length-1]>='a'&&b[b.length-1]<='z'){b=b.slice(0,-1);if(VAC_CAT[b])return VAC_CAT[b];}
    return'Autre';
  }

  var html='';
  // Cycle mode: show accessible (non-scheduled) cycle vacs split by category
  // Toutes les vacations définies dans l'admin pour ce type de jour, même si elles ne sont rattachées à aucun cycle,
  // sauf celles déjà proposées dans la grille du jour
  // 1. autres équipes : les vacations de la grille de leur cycle en cours, ce jour de la semaine
  // 2. mon cycle : les vacations qui y sont rattachées sans être dans aucune grille (Réal…), celles d'une équipe
  //    sans cycle en cours à cette date à la place de sa grille
  if(_poolCycles(_poolAt(date)).length&&Object.keys(_globalVacs).length){
    const dt=dw===6?'sat':dw===0?'sun':'week',inGrid=new Set((window._cycleVacsShown||[])),key=dk(date),col=(dw+6)%7,me=_poolAt(date);
    const PL={antenne:'Antenne',cadre:'Cadre',coord:'Coordination'},has={},seen=new Set(),out=[];
    (window._cycleVacsShown||[]).forEach(function(n){var v=_globalVacs[n]||VAC[n];if(v)seen.add(String(v.label||n).toLowerCase());});
    const ok=function(n){var v=_globalVacs[n];return v&&n!=='RH'&&n!=='SV'&&!v.mixte&&v.dur>0&&!inGrid.has(n);};
    const add=function(cat,n){var l=String(_globalVacs[n].label||n).toLowerCase();if(seen.has(l))return;seen.add(l);_oc[n]=cat;out.push(n);};
    Object.keys(POOLS).forEach(function(p){if(p===me)return;var ac=_activeCycleOf(p,key);if(!ac)return;has[p]=1;
      ac.weeks.forEach(function(w){var c=w&&w[col];if(c&&ok(c))add(PL[p],c);});});
    const allGrid=new Set();(_globalCycles||[]).forEach(function(c){(c.weeks||[]).forEach(function(w){(w||[]).forEach(function(x){if(x)allGrid.add(x);});});});
    const myAc=_activeCycleOf(me,key),TP={Antenne:'antenne',Cadre:'cadre',Coordination:'coord'};
    if(myAc)Object.keys(_globalVacs).filter(function(n){var v=_globalVacs[n],ts=String(v.type||'week').split(',');
        return ok(n)&&!allGrid.has(n)&&(Array.isArray(v.pools)?(v.pools.indexOf(me)>=0&&(!v.from||v.from<=key)&&(!v.to||v.to>=key)):(v.cycleIds||[]).includes(myAc.id))&&(ts.includes('all')||ts.includes(dt));})
      .forEach(function(n){var c=vacCat(n);if(!Array.isArray(_globalVacs[n].pools)&&TP[c]&&(has[TP[c]]||TP[c]===me))return;add(c,n);}); // cases cochées dans l'admin : respectées telles quelles
    window._autreVacsForDay=out;
  }
  if(window._autreVacsForDay&&window._autreVacsForDay.length){
    const dayFiltered=window._autreVacsForDay.filter(function(n){
      const v=VAC[n];if(!v||!v.days||!v.days.length)return true;
      return v.days.includes(dw);
    });
    const cats=['Coordination','Réal','Cadre','Antenne','Autre'];
    cats.forEach(function(cat){
      const vns=dayFiltered.filter(function(n){return vacCat(n)===cat;});
      html+=section(cat,vns);
    });
  } else {
    // Fallback: hardcoded lists for non-cycle mode
    const coordVacs=[];
    if(isWeek||isSam||isDim)coordVacs.push('S');
    if(isWeek)coordVacs.push('M');
    if(dw===4)coordVacs.push('Pj');
    if(dw===5)coordVacs.push('Pv');
    const videoVacs=isWeek?['MR','SR']:isSam?['Ms-R']:['Md-R'];
    const cadreVacs=isWeek?['B2V','C3V','P422V']:isSam?['BsV','Ds']:['BdV','Dd'];
    html=section('Coordination',coordVacs)+section('Réal',videoVacs)+section('Cadre',cadreVacs);
  }

  return html;
}
var gcalTokens=null;
function gSvg(c){return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.28h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="'+c+'"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="'+c+'"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="'+c+'"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="'+c+'"/></svg>';}
function _gcCol(key,def){var c=S.profile&&S.profile.gcalColors;return(c&&c[key])||def;}
function cloudHeaders(){return{'Content-Type':'application/json','Authorization':'Bearer '+(window._authToken||'')};}
// ================================================================
// NOTIFICATIONS PUSH : rappels avant expiration des heures
// L'app calcule les rappels à venir et les confie au serveur, qui les envoie le jour venu.
// ================================================================
function _pushIsOn(){try{return localStorage.getItem('pl_push_on')==='1';}catch(e){return false;}}
function _pushAlerts(){
  var cs=calcSoldes(),byE={},out=[];
  Object.keys(cs.realAvail).map(Number).forEach(function(ym){var av=cs.realAvail[ym],e=getExpYm(ym);if(av>0&&e>=TODAY_YM&&e<=TODAY_YM+2&&!(window._autoPlan||{})[ym])byE[e]=(byE[e]||0)+av;});
  var today=dk(NOW);
  Object.keys(byE).map(Number).sort().forEach(function(e){
    var last=new Date(Math.floor(e/12),e%12+1,0),mois=ML[e%12].toLowerCase(),h=fmtMin(byE[e]);
    [[14,'Heures bientôt perdues',h+' expirent fin '+mois+'. Poser un rendu pour ne pas les perdre.'],
     [3,'Plus que 3 jours',h+' expirent le '+last.getDate()+' '+mois+'.']].forEach(function(r){
      var d=new Date(last);d.setDate(d.getDate()-r[0]);var at=dk(d);
      if(at>=today)out.push({at:at,tag:'exp-'+_aid+'-'+e+'-'+r[0],title:r[1],body:r[2]});
    });
  });
  // Rappels de chaque mois : le 1er, ajouter le bulletin ; le 20, ajouter le tableau Gestion (3 mois d'avance, l'app n'est pas ouverte tous les jours)
  for(var i=0;i<4;i++){
    var b=new Date(NOW.getFullYear(),NOW.getMonth()+i,1,12),g=new Date(NOW.getFullYear(),NOW.getMonth()+i,20,12),pm=_deMois(b.getFullYear()*12+b.getMonth()-1);
    if(dk(b)>=today)out.push({at:dk(b),tag:'bul-'+_aid+'-'+dk(b),title:'Bulletin de paie',body:'Ajouter le bulletin '+pm+' : l’app le compare aux heures faites.'});
    if(dk(g)>=today)out.push({at:dk(g),tag:'rh-'+_aid+'-'+dk(g),title:'Tableau Gestion',body:'Ajouter le tableau Gestion du mois : l’app vérifie les rendus et leurs reports.'});
  }
  return out;
}
async function _pushPost(path,extra){
  var res=await fetch(CLOUD_API+path,{method:'POST',headers:cloudHeaders(),body:JSON.stringify(Object.assign({profileId:_aid},extra||{}))});
  if(!res.ok)throw new Error('serveur '+res.status);
  return res.json();
}
// Envoie au serveur la liste des rappels quand elle a changé
async function pushSyncAlerts(){
  if(!_pushIsOn()||!window._authToken)return;
  try{
    var al=_pushAlerts(),sig=JSON.stringify(al),k='pl_push_sig_'+_aid;
    if(localStorage.getItem(k)===sig)return;
    await _pushPost('/push/alerts',{alerts:al});
    localStorage.setItem(k,sig);
  }catch(e){console.warn('push sync',e);}
}
// Google Agenda dans le menu : son état sous le libellé (connecté, synchro en cours, échec, synchro automatique coupée)
// logo Google plein, dans la couleur de l'état ; il pulse pendant une synchro
function _gIco(col,anim){return '<svg class="hm-g'+(anim?' hm-pulse':'')+'" viewBox="0 0 24 24" aria-hidden="true" style="color:'+col+'"><path fill="currentColor" d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1-1.265.06a6 6 0 1 0 2.103 6.836l.001-.004h-3.66a1 1 0 0 1-.992-.883l-.007-.117v-2a1 1 0 0 1 1-1h6.945a1 1 0 0 1 .994.89c.04.367.061.737.061 1.11c0 5.523-4.477 10-10 10s-10-4.477-10-10s4.477-10 10-10z"/></svg>';}
// État de la synchronisation, en une ligne (bas du menu)
function _syncLine(){var st=window._syncStatus;if(!window._authToken||!st)return '';
  var t=window._lastSyncOk?new Date(window._lastSyncOk).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
  var x=st==='error'?['ti-cloud-off','var(--amber)',window._sessionIsExpired?'Session expirée':navigator.onLine===false?'Hors ligne, gardé sur l’iPhone':'Envoi impossible']
    :st==='pending'?['ti-cloud-upload','var(--text3)','Envoi…']:['ti-cloud-check','var(--text3)',t?'Sauvegardé à '+t:'Sauvegardé'];
  return '<div class="hm-sync" onclick="_closeDayMenu();syncStatusClick()"><i class="ti '+x[0]+(st==='pending'?' hm-bob':'')+'" style="color:'+x[1]+'"></i><span style="color:'+(st==='error'?x[1]:'')+'">'+x[2]+'</span></div>';}
// Session expirée côté serveur : rien ne peut plus se synchroniser tant qu'on ne se reconnecte pas
async function _silentRelogin(){
  // Identifiants mémorisés (« Se souvenir de moi ») : nouvelle session sans rien demander
  // « Se souvenir de moi » retiré : plus d'identifiants gardés sur l'appareil, donc plus de reconnexion silencieuse
  try{localStorage.removeItem('remember_creds');}catch(e){}var cr=null;
  // identifiants d'un autre compte (mémorisés avant un changement d'utilisateur) : jamais utilisés pour ce compte
  var me=window._authUser||{};if(cr&&me.email&&String(cr.email).toLowerCase()!==String(me.email).toLowerCase())cr=null;
  if(!cr||!cr.email||!cr.password||window._silentReloginTried)return false;
  window._silentReloginTried=true;
  try{
    var r=await fetch(CLOUD_API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:cr.email,password:cr.password})});
    if(!r.ok)return false;
    var d=await r.json();if(!d.token)return false;
    if(_plU()&&d.userId&&d.userId!==_plU())return false;
    window._authToken=d.token;localStorage.setItem('auth_token',d.token);
    return true;
  }catch(e){return false;}
}
// Contenu comparable d'un profil (sans l'horodatage, qui change à chaque saveState)
function _syncKey(pid){return'pl_synced_'+((window._authUser&&window._authUser.userId)||'')+'_'+pid;}
function _syncSig(d){return JSON.stringify(d,function(k,v){return k==='_lastSaved'?undefined:v;});}
// ── Deux appareils : chaque envoi dit sur quelle version du serveur il repose (_cbase). Si un autre appareil a
// enregistré entre-temps, le serveur refuse (409) et renvoie sa version : on fusionne les trois (base, ici, serveur)
// clé par clé — ce qui n'a changé que d'un côté est pris de ce côté ; changé des deux côtés : ce qui est ici l'emporte.
var _cbase={};
function _isObj(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function _merge3(b,l,r){var J=JSON.stringify;if(J(l)===J(b))return r;if(J(r)===J(b))return l;
  if(_isObj(l)&&_isObj(r)){var o={},ks={};Object.keys(l).forEach(function(k){ks[k]=1;});Object.keys(r).forEach(function(k){ks[k]=1;});
    Object.keys(ks).forEach(function(k){var v=_merge3(_isObj(b)?b[k]:undefined,l[k],r[k]);if(v!==undefined)o[k]=v;});return o;}
  return l;}
async function cloudLoad(pid){
  if(!window._authToken)return null;
  try{
    const res=await fetch(CLOUD_API+'/data/load',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({profileId:pid})});
    if(!res.ok)return null;
    const text=await res.text();
    if(!text||text.trim()==='')return null;
    const data=JSON.parse(text);
    window._clLast=data.data&&data.rev?{pid:pid,rev:data.rev,str:JSON.stringify(data.data)}:null;
    return data.data||null;
  }catch(e){console.warn('cloud load error',e);return null;}
}
// Historique (cloud) : liste des jours, puis restauration d'une version (la version actuelle reste dans l'historique du jour)
// Résumé d'une version : de quoi reconnaître la bonne (tableau Gestion, paie, rendus, dernière modification)
function _bakSum(d){var p=(d&&d.profile)||{},c=d&&d.conges||{},n=Object.keys(c).filter(function(k){return c[k]==='rend'||c[k]==='rend-hist';}).length,
    cg=Object.keys(c).filter(function(k){return c[k]==='cg';}).length,ov=Object.keys(d&&d.overrides||{}).length,ls=p._lastSaved?new Date(p._lastSaved):null;
  return [p.rhTable?'✓ tableau Gestion':p.rhImportedAt?'tableau Gestion lu, fichier pas gardé':'✗ tableau Gestion',(p.palierNum?'✓':'✗')+' paie',n+' rendus · '+cg+' congés · '+ov+' changements',ls?'modifiée le '+ls.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' à '+ls.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''].filter(Boolean).join(' · ');}
function _calNRows(y,m){
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const startDay=(first.getDay()+6)%7;
  return Math.ceil((startDay+last.getDate())/7);
}
var _sbGuard=false;
// ============================================================
// GCAL AUTO SYNC — state sync via worker
// ============================================================
var _syncTimer=null;
var _syncAbort=null;
var _syncQueued=false;
var _pollTimer=null;
var _pollFast=false;
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
  const VAC=getVAC(d);
  const vacLbl=vLbl(vac,VAC)||vac;
  let summary,colorId,description='';

  if(congesType==='cg'){
    const dur=getDur(d);
    summary=vac&&vac!=='RH'?vacLbl:'Congé';
    colorId=_gcCol('gcConge','10');
    description='congé'+(dur?' - '+fmtMin(dur):'');
  } else if(congesType==='rend'){
    const dur=getDur(d);
    summary=vac&&vac!=='RH'?vacLbl:'Rendu';
    colorId=_gcCol('gcRendu','2');
    description='rendu - '+fmtMin(dur);
  } else if(congesType==='absent'){
    summary=(vac&&vac!=='RH'?vacLbl+' ':'')+'Absent';
    colorId='8';
  } else if(!vac||vac==='RH'){
    return null;
  } else {
    const dur=getDur(d);
    const panier=isPanier(d)?' - panier':'';
    if(v2.echange&&!v2.ecSelf){summary=vacLbl+' (donne)';colorId='8';}
    else if(v2.echange&&v2.ecSelf){summary=vacLbl+' (echange)';colorId=_gcCol('gcModifie','11');}
    else if(v2.ov&&!v2.fromSV){summary=vacLbl;colorId=_gcCol('gcModifie','11');}
    else if(v2.ov&&v2.fromSV){summary=vacLbl+' +';colorId=_gcCol('gcModifie','11');}
    else{summary=vacLbl;colorId=_gcCol('gcNormal','7');}
    description=fmtMin(dur)+panier;
  }

  const tz='Europe/Paris';
  const ph=function(str){const m2=str.match(/(\d+)h(\d*)/);return m2?parseInt(m2[1])+':'+('0'+(m2[2]||0)).slice(-2):null;};
  function makeDateTime(base,hhmm){const arr=hhmm.split(':');const dt=new Date(base);dt.setHours(parseInt(arr[0]),parseInt(arr[1]),0,0);return dt;}
  let vacStart=null,vacEnd=null;
  const vacData=VAC[vac];
  if(vacData){
    const deb=vacData.deb||vacData.debut;
    if(deb&&vacData.fin){vacStart=ph(deb);vacEnd=ph(vacData.fin);}
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
    const _nd=new Date(dateKey+'T12:00:00');_nd.setDate(_nd.getDate()+1);
    startObj={date:dateKey};endObj={date:dk(_nd)};
  }
  return{summary,description,start:startObj,end:endObj,colorId,extendedProperties:{private:{planningKey:dateKey,planningProfile:(S.profile&&S.profile.name)||'',planningType:congesType||vac}}};
}
// Ligne de la semaine envoyée au serveur (admin « Lignes », collègues par ligne dans l'échange de semaine) :
// seulement quand elle a changé (quota d'écritures du serveur)
var _lsT;
// Ligne de la semaine envoyée au serveur (admin « Lignes », collègues par ligne dans l'échange de semaine) :
// seulement quand elle a changé (quota d'écritures du serveur)
var _lsT;function _lineSoon(){clearTimeout(_lsT);_lsT=setTimeout(_lineSync,6000);}
function _wkCodes(mon){var r=[];for(var d=0;d<7;d++){var dt=new Date(mon.getTime()+d*864e5),k=dk(dt),g=getVac(dt),c=(S.conges||{})[k];
  r.push(g.absent?'Abs':c==='cg'?'CG':(c==='rend'||c==='rend-hist')?'REND':(g.vac||'-'));}return r;}
async function _lineSync(){if(!window._authToken||!window._cloudReady||!_aid||!S||!S.profile)return;
  try{var mon=getMonday(NOW),mk=dk(mon),li=_lineIdxBase(mon),all={};
    for(var i=1;i<=26;i++){var m=new Date(mon.getTime()+i*7*864e5),w=_wkCodes(m);if(w.some(function(x){return x==='CG'||x==='REND'||x==='Abs';}))all[dk(m)]=w;}
    var nm=S.profile.name||(window._authUser&&window._authUser.name)||'';
    var sig=JSON.stringify({ligne:'S'+(li+1),profileId:_aid,profileName:nm,userName:nm,pool:_poolAt(mk),regLine:li,regWeek:mk,weekVacs:_wkCodes(mon),allWeekVacs:all});
    var sk='pl_lsig_'+_aid;try{if(localStorage.getItem(sk)===sig)return;}catch(e){}
    var r=await fetch(CLOUD_API+'/lines/register',{method:'POST',headers:cloudHeaders(),body:sig});
    if(r.ok)try{localStorage.setItem(sk,sig);}catch(e){}}catch(e){}}
function gcalWriteStatus(status,current,total){
  if(!window._authToken||!gcalTokens)return;
  fetch(CLOUD_API+'/sync-status',{
    method:'POST',headers:cloudHeaders(),
    body:JSON.stringify({action:'set',status:status,current:current,total:total})
  }).catch(function(){});
}
