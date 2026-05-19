// app_core.js v4.08


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
  C1:{deb:'12h15',fin:'21h15',dur:540,panier:true},C2:{deb:'13h15',fin:'21h15',dur:480,panier:false},
  Cd:{deb:'12h15',fin:'21h15',dur:540,panier:true},Cs:{deb:'12h15',fin:'21h15',dur:540,panier:true},
  D1:{deb:'15h45',fin:'00h30',dur:480,panier:false},D2:{deb:'15h45',fin:'00h15',dur:465,panier:false},
  Ed:{deb:'14h45',fin:'00h30',dur:540,panier:false},Es:{deb:'15h15',fin:'00h30',dur:510,panier:false},
  Fd:{deb:'15h45',fin:'00h15',dur:465,panier:false},Fs:{deb:'15h45',fin:'00h15',dur:465,panier:false},
  P423:{deb:'09h45',fin:'18h15',dur:390,panier:false},
  // Coord
  M:{deb:'08h00',fin:'19h00',dur:600,panier:true},
  S:{deb:'13h30',fin:'00h30',dur:600,panier:true},
  Pj:{deb:'08h00',fin:'19h00',dur:600,panier:true},   // P jeudi (matin)
  Pv:{deb:'13h30',fin:'19h30',dur:360,panier:false},   // P vendredi (soir)
  // Video
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
const FERIES=new Set(['2025-01-01','2025-04-21','2025-05-01','2025-05-08','2025-05-29','2025-06-09','2025-07-14','2025-08-15','2025-11-01','2025-11-11','2025-12-25','2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25','2027-01-01','2027-03-29','2027-05-01','2027-05-08','2027-05-13','2027-05-24','2027-07-14','2027-08-15','2027-11-01','2027-11-11','2027-12-25','2028-01-01','2028-04-17','2028-05-01','2028-05-08','2028-05-25','2028-06-05','2028-07-14','2028-08-15','2028-11-01','2028-11-11','2028-12-25','2029-01-01','2029-04-02','2029-05-01','2029-05-08','2029-05-10','2029-05-21','2029-07-14','2029-08-15','2029-11-01','2029-11-11','2029-12-25','2030-01-01','2030-04-22','2030-05-01','2030-05-08','2030-05-30','2030-06-10','2030-07-14','2030-08-15','2030-11-01','2030-11-11','2030-12-25']);
const ANCHOR=new Date(2026,4,4),ANCHOR_L=8;
const NOW=new Date(),TODAY_YM=NOW.getFullYear()*12+NOW.getMonth(),CUR_YEAR=NOW.getFullYear();
const MC=['jan','fev','mar','avr','mai','jun','jui','aou','sep','oct','nov','dec'];
const ML=['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
const JN=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];

const DEFAULT_PD=()=>({
  profile:{name:'Lebreton',anchorLine:8,matelas:162*60+27,congesInit:25,ephSolde:0,ephSoldeCreatedYM:TODAY_YM},
  settings:{dimRendu:true,rhRendu:true,ferRendu:true,hsRendu:true,settingsHistory:[],theme:'dark'},
  overrides:{},conges:{},history:[],customVacs:{},
});

let _profs={},_aid='default',S=DEFAULT_PD();
let curY=CUR_YEAR,curM=NOW.getMonth(),pendingKey=null,annualOpen=false;
let _us=[],_rs=[];

// ================================================================
// STATE
// ================================================================
function loadState(){
  try{const d=JSON.parse(localStorage.getItem('pl_v8')||'{}');_profs=d.p||{};_aid=d.a||'default';}catch(e){}
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
  // Mark all existing customVacs as hidden (not shown in grid)
  if(S.customVacs){Object.keys(S.customVacs).forEach(k=>{S.customVacs[k].hidden=true;});}
}
function saveState(){
  try{localStorage.setItem('pl_v8',JSON.stringify({p:_profs,a:_aid}));}catch(e){}
  // Cloud sync debounced
  clearTimeout(window._cloudSyncTimer);
  window._cloudSyncTimer=setTimeout(function(){
    if(!_aid)return;
    cloudSave(_aid);
    // Register line
    if(S&&S.profile&&S.profile.ligne&&window._authToken){
      fetch(CLOUD_API+'/lines/register',{method:'POST',headers:cloudHeaders(),body:JSON.stringify({
        ligne:S.profile.ligne,profileId:_aid,
        profileName:S.profile.name||_aid,
        userName:(window._authUser&&window._authUser.name)||''
      })}).catch(function(){});
    }
  },2000);
}
function switchProfile(id){_profs[_aid]=S;saveState();if(!_profs[id])_profs[id]=DEFAULT_PD();_aid=id;S=_profs[_aid];saveState();}
function createProfile(id,data){_profs[id]=data;saveState();}
function deleteProfile(id){if(id==='default')return;delete _profs[id];if(_aid===id){_aid='default';if(!_profs.default)_profs.default=DEFAULT_PD();S=_profs.default;}saveState();}
function getProfiles(){
  const all=Object.entries(_profs).map(([id,d])=>({id,name:capitalize((d&&d.profile&&d.profile.name)||id)}));
  // Active profile always first
  return [all.find(p=>p.id===_aid),...all.filter(p=>p.id!==_aid)].filter(Boolean);
}

// ================================================================
// UNDO / REDO
// ================================================================
function snap(){return JSON.stringify({ov:S.overrides,co:S.conges,hi:S.history});}
function pushUndo(){_us.push(snap());if(_us.length>30)_us.shift();_rs=[];updateUrBtns();}
function undoAction(){if(!_us.length)return;_rs.push(snap());const p=JSON.parse(_us.pop());S.overrides=p.ov;S.conges=p.co;S.history=p.hi;saveState();render();updateUrBtns();}
function redoAction(){if(!_rs.length)return;_us.push(snap());const n=JSON.parse(_rs.pop());S.overrides=n.ov;S.conges=n.co;S.history=n.hi;saveState();render();updateUrBtns();}
function updateUrBtns(){const u=document.getElementById('undo-btn'),r=document.getElementById('redo-btn');if(u)u.disabled=!_us.length;if(r)r.disabled=!_rs.length;}

// ================================================================
// HELPERS
// ================================================================
function dk(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function getMonday(d){const x=new Date(d);x.setHours(12,0,0,0);const dw=x.getDay();x.setDate(x.getDate()-(dw===0?6:dw-1));return x;}
function fmtH(min){if(min===0)return'0h00';const h=min/60;if(Number.isInteger(h))return h+'h00';return Math.floor(h)+'h'+String(min%60).padStart(2,'0');}
function fmtR(min){return(Math.round(min/60*100)/100).toFixed(2).replace('.',',')+'h';}
function fmtMin(min){if(isNaN(min)||min===undefined||min===null)return'0h00';return fmtH(Math.round(min));}
function capitalize(s){if(!s)return s;return s.charAt(0).toUpperCase()+s.slice(1);}
function nowHHMM(){const n=new Date();return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');}
function fmtDate(d){return JN[d.getDay()]+' '+d.getDate()+' '+MC[d.getMonth()]+' '+d.getFullYear();}
function parseHM(s){if(!s)return 0;const str=(s+'').trim().replace(',','.');var m;if((m=str.match(/^(\d+)h(\d{0,2})$/i)))return parseInt(m[1])*60+(parseInt(m[2]||'0')||0);if((m=str.match(/^(\d+(?:\.\d+)?)h?$/i))){const h=parseFloat(m[1]);return Math.round(h*60);}return 0;}
function isoWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil(((d-ys)/864e5+1)/7);}
var _globalVacs={};
var _globalCycles=[];
