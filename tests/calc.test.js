// Contrôle automatique des calculs d'heures. Lancé avant chaque mise en ligne (node tests/calc.test.js).
// Chaque cas part d'une situation connue et vérifie les chiffres attendus, calculés à la main.
const { load } = require('./harness');

let fails = 0, count = 0;
function eq(label, got, want) {
  count++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.error('ÉCHEC  ' + label + '\n        attendu : ' + JSON.stringify(want) + '\n        obtenu  : ' + JSON.stringify(got)); }
  else console.log('ok     ' + label);
}
const YM = (y, m) => y * 12 + (m - 1); // m de 1 à 12

// Situation d'Arthur au 1er octobre 2026 (sans planning : seules comptent les heures de départ et les rendus)
//  avril 49h30 et mai 89h08 reportés de 3 mois, juin 12h15, juillet 18h00, août 3h23 ;
//  rendus posés en septembre : 18 × 7h30 + 4h52 = 139h52, pris sur les heures les plus anciennes.
function situation(opts) {
  const a = load('2026-10-01');
  const split = { [YM(2026, 4)]: 2970, [YM(2026, 5)]: 5348, [YM(2026, 6)]: 735, [YM(2026, 7)]: 1080, [YM(2026, 8)]: 203 };
  const ext = { [YM(2026, 4)]: 1, [YM(2026, 5)]: 1 };
  if (opts.reportJuin) ext[YM(2026, 6)] = 1;
  const dur = {};
  for (let d = 1; d <= 18; d++) dur['2026-09-' + String(d).padStart(2, '0')] = 450;
  dur['2026-09-21'] = 292;
  Object.assign(dur, opts.extraRendus || {});
  a.run('S.profile=' + JSON.stringify({ ephSoldeCreatedYM: YM(2026, 9), matelas: 0, ephSoldeSplit: split }) + ';'
    + 'S.ephExtend=' + JSON.stringify(ext) + ';S.autoExtend={};S.conges={};'
    + 'var _dur=' + JSON.stringify(dur) + ';Object.keys(_dur).forEach(function(k){S.conges[k]="rend";});'
    + 'getDur=function(dt){return _dur[dk(dt)]||0;};getVac=function(){return {vac:"",absent:false};};');
  return a;
}

// 1. Heures de juin perdues fin septembre (cas réel d'octobre 2026)
{
  const a = situation({});
  eq('Solde au 1/10 = 21h23 (juillet 18h00 + août 3h23)', a.run('calcSoldeRH(new Date(2026,9,1,12)).solde'), 1283);
  eq('Juin : 11h01 perdues fin septembre', a.run('calcSoldes().preExpiry'), { [YM(2026, 6)]: 661 });
  eq('Libre à poser en septembre = 32h24', a.run('calcTrueDispo(' + YM(2026, 9) + ').total'), 1944);
  eq('Libre à poser en octobre = 21h23', a.run('calcTrueDispo(' + YM(2026, 10) + ').total'), 1283);
}
// 2. Même situation avec juin reporté : rien n'est perdu
{
  const a = situation({ reportJuin: true });
  eq('Juin reporté : solde au 1/10 = 32h24', a.run('calcSoldeRH(new Date(2026,9,1,12)).solde'), 1944);
  eq('Juin reporté : aucune heure perdue', a.run('calcSoldes().preExpiry'), {});
}
// 3. Un rendu posé plus tard en octobre réduit le libre à poser, pas le solde au 1/10
{
  const a = situation({ extraRendus: { '2026-10-20': 450 } });
  eq('Rendu du 20/10 : solde au 1/10 inchangé', a.run('calcSoldeRH(new Date(2026,9,1,12)).solde'), 1283);
  eq('Rendu du 20/10 : libre à poser en octobre = 13h53', a.run('calcTrueDispo(' + YM(2026, 10) + ').total'), 833);
}
// 4. Expiration : 3 mois après le mois d'acquisition, +3 par report
{
  const a = situation({});
  eq('Juin sans report expire fin septembre', a.run('getExpYm(' + YM(2026, 6) + ')'), YM(2026, 9));
  eq('Mai reporté expire fin novembre', a.run('getExpYm(' + YM(2026, 5) + ')'), YM(2026, 11));
}
// 4b. Rappels push : 14 j et 3 j avant la fin du mois où des heures expirent
{
  const a = situation({});
  eq('Rappels : juillet (18h00) fin octobre, août (3h23) fin novembre',
    a.run('_pushAlerts().map(function(x){return x.at+" "+x.body;})'),
    ['2026-10-17 18h00 expirent fin octobre. Poser un rendu pour ne pas les perdre.', '2026-10-28 18h00 expirent le 31 octobre.',
     '2026-11-16 3h23 expirent fin novembre. Poser un rendu pour ne pas les perdre.', '2026-11-27 3h23 expirent le 30 novembre.']);
}
// 5. Lecture du tableau RH (faux tableau, même structure que celui du gestionnaire)
{
  const a = load('2026-10-01');
  const cells = {
    A1: 'Stock au 31/12/2025', D1: 'Conso sur Stock', F1: 'Stock actualisé', Q1: 'Cumul acquisitions', R1: 'Cumul consommations', S1: 'Cumul soldes',
    A2: 100, D2: 2, F2: 98, Q2: 50, R2: 28.5, S2: 21.5,
    B3: 46283, // 18/09/2026
    C5: 'Date acquisition', D5: 'Nature', E5: 'Acquisition', F5: 'Consommation', G5: 'Solde', H5: 'Validité', L5: 'Report 1', M5: 'Validité', Q5: 'Commentaires',
    C6: 46142, D6: 'Férié', E6: 16, F6: 16, G6: 0,
    C7: 46173, D7: 'RCR (HS)', E7: 20, F7: 12.5, G7: 7.5, H7: 46265, Q7: '7,5h posées S23 / 22?5h sur S31',
    C8: 46203, D8: 'Dimanche', E8: 14, F8: 0, G8: 14, H8: 46295, L8: '3 mois', M8: 46387, Q8: '12h sur S35',
  };
  a.cells = cells;
  a.run('var _rh=_rhParse(' + JSON.stringify(cells) + ',"18-09-2026_test.xlsx");');
  eq('Tableau : date d’édition 18/09/2026', a.run('dk(_rh.edition)'), '2026-09-18');
  eq('Tableau : matelas (stock actualisé) 98h', a.run('_rh.tot.stockAct'), 5880);
  eq('Tableau : 3 lignes lues', a.run('_rh.lines.length'), 3);
  eq('Tableau : rendus par semaine, « 22?5h » lu 22h30', a.run('JSON.stringify(_rh.weeks)'), JSON.stringify({ 23: 450, 31: 1350, 35: 720 }));
  eq('Tableau : dernière semaine notée S35', a.run('_rh.lastWeek'), 35);
  eq('Tableau : report de 3 mois sur juin', a.run('_rh.lines[2].rep'), 1);
  eq('Tableau compacté : même lecture', a.run('JSON.stringify(_rhParse(_rhCompact(' + JSON.stringify(cells) + '),"18-09-2026_test.xlsx").lines)'), a.run('JSON.stringify(_rh.lines)'));
  // Import : seules les heures encore valables au 18/09 servent de point de départ (mai a expiré le 31/08)
  a.run('S.profile={};S.conges={};S.ephExtend={};');
  eq('Import : point de départ = juin 14h, reporté', a.run('(function(){var P=_rhImportPlan(_rh);return JSON.stringify({split:P.split,reports:P.reports});})()'),
    JSON.stringify({ split: { [YM(2026, 6)]: 840 }, reports: { [YM(2026, 6)]: 1 } }));
}

// 6. Bulletin de paie : lecture des lignes du PDF (exemple fictif, au format des bulletins)
{
  const a = load('2026-10-01');
  const L = ['PERIODE DE PAIE DU 01/08/2026 AU 31/08/2026', 'SALAIRE DE QUALIFICATION 2187,29 CLASSIFICATION 5B',
    'SALAIRE DE QUALIFICATION 2187,29 100,000 2187,29', 'PRIME ANCIENNETE 2091,75 167,34', 'INDEMNITE MENSUELLE GPE 154,00',
    'RAP 202607 HEURES SUP 125% 9,25 19,400 179,45', 'RAP 202607 HEURES MAJOREES NUIT 40% 13,50 6,208 83,81',
    'RAP 202604 IND.VAC.JOURNAUX INTER 1,00 34,760 34,76', 'P.F.A NAC MENS 190,00', 'MESURE NAO CDI 2023 130,00',
    'RAP 202607 Complémentaire Santé Tranche A 574,74 -1,75 2,63', '**TOTAL BRUT PAYE 3459,73', 'RAP PRIME DE PANIERS 2,00 7,500 15,00'];
  a.run('var _b=_bulParse(' + JSON.stringify(L) + ');');
  eq('Bulletin : mois de paie août 2026', a.run('_b.ym'), YM(2026, 8));
  eq('Bulletin : fixe et total lus', a.run('JSON.stringify([_b.salQ,_b.anc,_b.gpe,_b.pfa,_b.nao,_b.brut])'), JSON.stringify([2187.29, 167.34, 154, 190, { 'CDI 2023': 130 }, 3459.73]));
  eq('Bulletin : lignes RAP reconnues, cotisations ignorées', a.run('JSON.stringify(_b.rap.map(function(r){return [r.ym,r.k,r.q];}))'),
    JSON.stringify([[YM(2026, 7), 'hsLow', 9.25], [YM(2026, 7), 'nuit', 13.5], [YM(2026, 4), 'reel', 1], [YM(2026, 7), 'panier', 2]]));
  eq('Bulletin : paniers', a.run('_b.paniers.q'), 2);
  eq('Bulletin : prime d’avantage individuel acquis lue, proposée puis comparée', a.run('(function(){var o=_bulParse(["PERIODE DE PAIE DU 01/07/2026 AU 31/07/2026","PRIME AV. INDIV. ACQUIS 93,81","**TOTAL BRUT PAYE 3000,00"]),sv=S.bulletins;S.bulletins={};S.bulletins[o.ym]=o;'
    + 'var D=_bulPayDiffs(),f1=_bulCompare(o).fixed.filter(function(f){return f.lbl==="Av. indiv. acquis";})[0];S.profile.primesFixesCustom=[{id:"x",label:"Prime av. indiv. acquis",montant:93.81,debutYM:o.ym,finYM:null}];'
    + 'var f2=_bulCompare(o).fixed.filter(function(f){return f.lbl==="Av. indiv. acquis";})[0],D2=_bulPayDiffs();S.profile.primesFixesCustom=[];S.bulletins=sv;return JSON.stringify([o.avInd,D.av&&D.av.v,f1.ok,f2.ok,D2.av]);})()'), JSON.stringify([93.81, 93.81, false, true, null]));
  // Format d'un autre bulletin : « SUPPL. FAMILIAL » abrégé, groupe dans l'en-tête, relevé de présence collé à droite
  eq('Bulletin : suppl. familial abrégé, groupe de l’en-tête, relevé de présence retiré', a.run('(function(){var o=_bulParse(["PERIODE DE PAIE DU 01/08/2026 AU 31/08/2026","GRILLE DE QUALIFICATION GRP5 HEURES CONTRACTUELLES","SALAIRE DE QUALIFICATION 2356,34 100,000 2356,34 J 16 JUI 1,00","PRIME ANCIENNETE 2091,75 235,53 S 16 MAI 1,00 CPACO","INDEMNITE MENSUELLE GPE 154,00 M 27 MAI 1,00 CPACO","SUPPL. FAMILIAL 156,42","bpradiofrancedemat V. 2022 MESURE NAO CDI 2023 130,00","**TOTAL BRUT PAYE 3719,74"]);return JSON.stringify([o.supFam,o.grp,o.salQ,o.anc,o.gpe,o.nao]);})()'), JSON.stringify([156.42, 5, 2356.34, 235.53, 154, {'CDI 2023':130}]));
  eq('Bulletin : HS en quart d’heure signalées, rattrapage d’avril à part', a.run('(function(){var c=_bulCompare(_b);return JSON.stringify([c.alerts.filter(function(x){return /Heures sup/.test(x);}).length,c.late.length,c.late[0].ym]);})()'), JSON.stringify([1, 1, YM(2026, 4)]));
  // Le rattrapage d'avril (payé en août) complète le bulletin de mai, qui comptait les variables d'avril
  eq('Bulletin : paniers payés différents de l’app signalés', a.run('(function(){var c=_bulCompare(_b),r=c.rows.filter(function(x){return x.k==="panier";})[0];return c.status==="ecart"&&!!r&&!r.ok&&r.bq===2;})()'), true);
  eq('Bulletin : l’écart en € compte aussi les paniers (hors brut)', a.run('(function(){var c=_bulCompare(_b);return Math.abs(c.adj-(c.diff+c.paidLater-c.lateSum)-(c.paniers.bm-c.P.vars.supPaniers))<0.01&&c.paniers.bm!==c.P.vars.supPaniers;})()'), true);
  eq('Bulletin : écarts ignorés ligne par ligne', a.run('(function(){S.profile.ignBulL={};S.bulletins={};S.bulletins[_b.ym]=_b;var c=_bulCompare(_b),n=c.badList.length,sum=c.items.reduce(function(s,i){return s+i.d;},0),it=c.items.filter(function(i){return i.id==="r:panier";})[0];'
    + 'S.profile.ignBulL[_b.ym]={};S.profile.ignBulL[_b.ym][it.id]=it.d;var c2=_bulCompare(_b);'
    + 'c.items.forEach(function(i){S.profile.ignBulL[_b.ym][i.id]=i.d;});var c3=_bulCompare(_b);S.profile.ignBulL={};'
    + 'return JSON.stringify([Math.abs(sum-c.adj)<0.02,c2.badList.length===n-1,Math.abs(c2.adj-(c.adj-it.d))<0.02,_bulIgn(_b.ym,c2),_bulIgn(_b.ym,c3)]);})()'), JSON.stringify([true,true,true,false,true]));
  eq('Bulletin : rappel de prix des paniers réparti sur les mois payés sous le prix', a.run('(function(){var sv=S.bulletins;S.bulletins={};var F=' + YM(2026, 1) + ',A=' + YM(2026, 3) + ';'
    + 'S.bulletins[F]={ym:F,rap:[{ym:F-1,k:"panier",q:2,pu:7.4,mt:14.8}]};S.bulletins[A]={ym:A,rap:[{ym:A-1,k:"panier",q:3,pu:7.5,mt:23.2}]};'
    + 'var R=_panRappels();S.bulletins=sv;return JSON.stringify([R.cover[F],R.from[F],R.used[A]]);})()'), JSON.stringify([0.2, [YM(2026, 3)], 0.2]));
  eq('Bulletin : palier, contrat, groupe et ancienneté lus', a.run('(function(){var d=_bulPaySet(_b);return JSON.stringify([calcPalierSalaire(d.palier),d.pct,d.groupe,d.anc]);})()'), JSON.stringify([2187.29, 100, 5, 8]));
  eq('Bulletin : PFA mensuelle lue (P.F.A NAC MENS)', a.run('[_b.pfaMens,_bulPaySet(_b).pfaMens]'), [true, true]);
  eq('Bulletin : fériés payés alors que l’app les range en rendus → proposés « payés »', a.run('(function(){var sb=S.bulletins,ss=JSON.stringify(S.settings),sm=S.profile.settingsMonthlyHistory;S.settings.ferRendu=true;S.settings.settingsHistory=[];S.profile.settingsMonthlyHistory=null;'
    + 'var j=_bulParse(["PERIODE DE PAIE DU 01/01/2026 AU 31/01/2026","RAP 202512 HEURES FERIES 200% 7,00 30,780 215,46","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[j.ym]=j;var D=_bulPayDiffs(),x=D.paid.filter(function(p){return p.k==="ferRendu";})[0];'
    + 'S.bulletins=sb;S.settings=JSON.parse(ss);S.profile.settingsMonthlyHistory=sm;return x?x.ym:null;})()'), YM(2025, 12));
  eq('Bulletin : « payés » appliqué au seul mois du bulletin, même avec un réglage du mois existant', a.run('(function(){var sb=S.bulletins,ss=JSON.stringify(S.settings),sp=JSON.stringify(S.profile);S.settings.ferRendu=true;S.settings.settingsHistory=[];S.profile.settingsMonthlyHistory=null;S.profile.settingsMonthly={};S.profile.settingsMonthly[' + YM(2025, 12) + ']={ferRendu:true};'
    + 'var j=_bulParse(["PERIODE DE PAIE DU 01/01/2026 AU 31/01/2026","RAP 202512 HEURES FERIES 200% 7,00 30,780 215,46","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[j.ym]=j;'
    + 'var _r=render,_s=saveState,_u=pushUndo;render=function(){};saveState=function(){};pushUndo=function(){};_bulPayApply();render=_r;saveState=_s;pushUndo=_u;'
    + 'var r=[settingsForYM(' + YM(2025, 12) + ').ferRendu,settingsForYM(' + YM(2026, 1) + ').ferRendu,settingsForYM(' + YM(2026, 5) + ').ferRendu,_bulPayDiffs().paid.length];'
    + 'S.bulletins=sb;S.settings=JSON.parse(ss);S.profile=JSON.parse(sp);return JSON.stringify(r);})()'), JSON.stringify([false, true, true, 0]));
  eq('Bulletin : HS dans les deux sens (payées sur le bulletin / absentes alors que l’app les paie)', a.run('(function(){var sb=S.bulletins,ss=JSON.stringify(S.settings),sp=JSON.stringify(S.profile);S.settings.settingsHistory=[];S.profile.settingsMonthlyHistory=null;S.profile.settingsMonthly={};'
    + 'S.settings.hsRendu=true;var a1=_bulParse(["PERIODE DE PAIE DU 01/08/2026 AU 31/08/2026","RAP 202607 HEURES SUP 125% 9,25 19,400 179,45","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[a1.ym]=a1;'
    + 'var D1=_bulPayDiffs().paid.filter(function(x){return x.k==="hsRendu";}).map(function(x){return [x.ym,x.v];});'
    + 'S.settings.hsRendu=false;var h=calcHSMinsMois(2026,6);var a2=_bulParse(["PERIODE DE PAIE DU 01/08/2026 AU 31/08/2026","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[a2.ym]=a2;'
    + 'var D2=_bulPayDiffs().paid.filter(function(x){return x.k==="hsRendu";}).map(function(x){return [x.ym,x.v];});'
    + 'S.bulletins=sb;S.settings=JSON.parse(ss);S.profile=JSON.parse(sp);return JSON.stringify([D1,h.low+h.high>0?D2:"pas de HS en juillet"]);})()'), JSON.stringify([[[YM(2026, 7), false]], [[YM(2026, 7), true]]]));
  eq('Bulletin : mois sans HS aligné quand il est encadré par deux mois vérifiés d’accord', a.run('(function(){var sb=S.bulletins,ss=JSON.stringify(S.settings),sp=JSON.stringify(S.profile);S.settings.settingsHistory=[];S.profile.settingsMonthlyHistory=null;S.settings.hsRendu=false;S.profile.settingsMonthly={};'
    + 'S.profile.settingsMonthly[' + YM(2026, 2) + ']={hsRendu:true};var cH=calcHSWeek;calcHSWeek=function(m){return m.getMonth()===1||(m.getMonth()===2&&m.getDate()<3)?{surplus:0,rendusMin:0,rendusMinHS:0,rendusMinRam:0,rawLow:0,rawHigh:0}:cH(m);};'
    + 'var j=_bulParse(["PERIODE DE PAIE DU 01/02/2026 AU 28/02/2026","RAP 202601 HEURES SUP 125% 2,00 19,400 38,80","**TOTAL BRUT PAYE 3000,00"]),f=_bulParse(["PERIODE DE PAIE DU 01/03/2026 AU 31/03/2026","**TOTAL BRUT PAYE 3000,00"]),q=_bulParse(["PERIODE DE PAIE DU 01/04/2026 AU 30/04/2026","RAP 202603 HEURES SUP 125% 2,00 19,400 38,80","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[j.ym]=j;S.bulletins[f.ym]=f;S.bulletins[q.ym]=q;'
    + 'var x=_bulPayDiffs().paid.filter(function(p){return p.k==="hsRendu"&&p.ym===' + YM(2026, 2) + ';})[0];calcHSWeek=cH;S.bulletins=sb;S.settings=JSON.parse(ss);S.profile=JSON.parse(sp);return x?[x.v,!!x.fill]:null;})()'), [false, true]);
  eq('Bulletin : HS payées « en juillet » mais comptées en août par l’app → août marqué payé, pas juillet', a.run('(function(){var sb=S.bulletins,ss=JSON.stringify(S.settings),sp=JSON.stringify(S.profile),cH=calcHSMinsMois;S.settings.settingsHistory=[];S.profile.settingsMonthlyHistory=null;S.profile.settingsMonthly={};S.settings.hsRendu=true;'
    + 'calcHSMinsMois=function(y,m){if(settingsForYM(y*12+m).hsRendu)return{low:0,high:0};return{low:m===7?120:0,high:0};};'
    + 'var a1=_bulParse(["PERIODE DE PAIE DU 01/08/2026 AU 31/08/2026","RAP 202607 HEURES SUP 125% 2,00 19,400 38,80","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[a1.ym]=a1;'
    + 'var D=_bulPayDiffs().paid.filter(function(x){return x.k==="hsRendu";}).map(function(x){return [x.ym,x.v];});calcHSMinsMois=cH;S.bulletins=sb;S.settings=JSON.parse(ss);S.profile=JSON.parse(sp);return JSON.stringify(D);})()'), JSON.stringify([[YM(2026, 8), false]]));
  eq('Bulletin : réglages vides remplis depuis le bulletin', a.run('(function(){var sv=JSON.stringify(S.profile),sb=S.bulletins;S.bulletins={};S.bulletins[_b.ym]=_b;S.profile.palierNum=0;S.profile.palierHistory=[];S.profile.groupeClassif=0;S.profile.groupeHistory=[];'
    + 'var _r=render,_s=saveState,_u=pushUndo;render=function(){};saveState=function(){};pushUndo=function(){};var n=_bulPayDiffs().n;_bulPayApply();render=_r;saveState=_s;pushUndo=_u;var r=[n>0,calcPalierSalaire(getPalierForYM(_b.ym)),getGroupeForYM(_b.ym),getAncForYM(_b.ym),_bulPayDiffs().n];S.profile=JSON.parse(sv);S.bulletins=sb;return JSON.stringify(r);})()'), JSON.stringify([true, 2187.29, 5, 167.34, 1]));
  eq('Bulletin : panier rattrapé (RAP aaaamm) rattaché à son mois', a.run('(function(){var b2=_bulParse(["PERIODE DE PAIE DU 01/09/2026 AU 30/09/2026","RAP 202607 PRIME DE PANIERS 2,00 7,500 15,00","RAP PRIME DE PANIERS 3,00 7,500 22,50","**TOTAL BRUT PAYE 3000,00"]);var c=_bulCompare(b2),late=c.late.filter(function(l){return l.k==="panier";});S.bulletins={};S.bulletins[_b.ym]=_b;S.bulletins[b2.ym]=b2;var c1=_bulCompare(_b),r=c1.rows.filter(function(x){return x.k==="panier";})[0];return JSON.stringify([b2.rap.filter(function(x){return x.k==="panier";}).map(function(x){return x.ym%12;}),late.length,r.bq,r.rq]);})()'), JSON.stringify([[6,7],1,2,2]));
  eq('Bulletin : rattrapage relié au mois où il manquait', a.run('(function(){S.bulletins={};S.bulletins[_b.ym]=_b;var m={ym:' + YM(2026, 5) + ',rap:[],nao:{},brut:3000};var c=_bulCompare(m),r=c.rows.filter(function(x){return x.k==="reel";})[0];return JSON.stringify([c.paidLater,c.later,r.rq,r.rFrom]);})()'),
    JSON.stringify([34.76, [YM(2026, 8)], 1, [YM(2026, 8)]]));
}

// Vacation modifiée en « Formé » (formation suivie) : nuit et primes de la vacation prévue, le reste selon la vacation faite
{
  const a = load('2026-10-01');
  a.run('S.conges={};var _k="2026-10-06";getVac=function(d){return dk(d)===_k?{vac:"C1",absent:false}:{vac:"",absent:false};};'
    + 'getPayVac=function(d){return dk(d)===_k?"A1":"";};');
  eq('Vacation ajoutée sur une case vide du cycle : comptée en heures en plus', a.run('(function(){var g=getVac;getVac=function(d){return dk(d)===_k?{vac:"C1",absent:false,echange:false,cycleVac:null}:{vac:"",absent:false};};S.overrides={};S.overrides[_k]={vac:"C1",fromSV:true,echange:false,hs:false};var d=new Date(_k+"T12:00:00"),mon=getMonday(d),row=(getActiveCycleGrid(mon)||CYCLE)[lineIdx(mon)]||[],gv=row[(d.getDay()+6)%7],V=getVAC(),base=gv&&gv!=="RH"&&V[gv]?V[gv].dur:0;var m=_dayHSMin(d);getVac=g;S.overrides={};return m===540-base&&540-base>0;})()'), true);
  eq('Formé : nuit de A1 gardée même si on fait C1', a.run('[calcNuitMinShift(getVAC().A1)>0,calcNuitWeek(getMonday(new Date(2026,9,6,12)))===calcNuitMinShift(getVAC().A1)]'), [true, true]);
  eq('Formé : formation avec plus de nuit que la vacation prévue → nuit de la formation', a.run('(function(){var g=getPayVac,gv=getVac;S.customVacs={FN:{deb:"20h00",fin:"06h00",dur:540}};getVac=function(d){return dk(d)===_k?{vac:"FN",absent:false}:{vac:"",absent:false};};getPayVac=function(d){return dk(d)===_k?"A1":"";};var n=calcNuitWeek(getMonday(new Date(2026,9,6,12))),f=calcNuitMinShift(getVAC().FN),p=calcNuitMinShift(getVAC().A1);getPayVac=g;getVac=gv;S.customVacs={};return f>p&&n===f;})()'), true);
  eq('Formateur / autre : nuit de la vacation faite', a.run('(function(){var g=getPayVac;getPayVac=function(d){return dk(d)===_k?"C1":"";};var n=calcNuitWeek(getMonday(new Date(2026,9,6,12)));getPayVac=g;return n===calcNuitMinShift(getVAC().C1);})()'), true);
  // Dimanche 4 octobre 2026 : majoration sur la vacation faite (accord VIII.3.2 « heures accomplies »)
  a.run('_k="2026-10-04";isRHDay=function(){return false;};settingsForYM=function(){return {};};');
  eq('Formé : majoration dimanche sur la durée de C1, pas de A1', a.run('[getVAC().A1.dur!==getVAC().C1.dur,calcDimRHFerMinsMois(2026,9).dim===getVAC().C1.dur]'), [true, true]);
  eq('Formé : panier selon la vacation faite', a.run('(function(){S.customVacs={X1:{deb:"11h00",fin:"18h00",dur:420,panier:true}};var d=new Date(2026,9,4,12);getVac=function(){return {vac:"X1",absent:false};};S.overrides={"2026-10-04":{vac:"X1",formation:true}};return isPanier(d);})()'), true);
  eq('Formé : restauration du 1er mai selon la vacation faite', a.run('(function(){S.customVacs={X2:{deb:"09h00",fin:"17h00",dur:420}};S.conges={};getVac=function(d){return dk(d)==="2026-05-01"?{vac:"X2",absent:false}:{vac:"",absent:false};};getPayVac=function(d){return dk(d)==="2026-05-01"?"A1":"";};var v=calcVariablesMois(2026,4);return v.supAbsResto===v.absRestoRate&&v.absRestoRate>0;})()'), true);
}

// Jour modifié dans l'écran « Modifier » : heures comptées = la plus grande, prévue ou faite (surplus en heures sup)
{
  const a = load('2026-10-01');
  a.run('S.conges={};S.customVacs={Court:{deb:"03h45",fin:"09h45",dur:360},Long:{deb:"03h45",fin:"13h15",dur:570}};'
    + 'getActiveCycleGrid=function(){return [["A1","A1","A1","A1","A1","RH","RH"]];};lineIdx=function(){return 0;};'
    + 'var _v="Court";getVac=function(d){return dk(d)==="2026-10-06"?{vac:_v,absent:false,echange:false,cycleVac:"A1"}:{vac:"",absent:false};};');
  eq('Modifier : plus courte → heures prévues, pas d’heure sup', a.run('S.overrides={"2026-10-06":{vac:"Court",motif:"autre"}};_v="Court";_dayHSMin(new Date(2026,9,6,12))'), 0);
  eq('Modifier : plus longue → surplus en heures sup (2h30)', a.run('S.overrides={"2026-10-06":{vac:"Long",motif:"forme"}};_v="Long";_dayHSMin(new Date(2026,9,6,12))'), 150);
  eq('Grille : vacation plus longue → surplus en heures sup', a.run('S.overrides={"2026-10-06":{vac:"Long",hs:false}};_v="Long";_dayHSMin(new Date(2026,9,6,12))'), 150);
  eq('Échange même jour : pas d’heure sup', a.run('S.overrides={"2026-10-06":{vac:"Long",echange:true,ecSelf:true,pair:"2026-10-06"}};getVac=function(d){return dk(d)==="2026-10-06"?{vac:"Long",absent:false,echange:true,ecSelf:true,cycleVac:"A1"}:{vac:"",absent:false};};_dayHSMin(new Date(2026,9,6,12))'), 0);
}

// Échange de semaine : la semaine prend une autre ligne du cycle, sans toucher aux autres semaines
{
  const a = load('2026-10-01');
  a.run('var _m=getMonday(new Date(2026,9,7,12)),_b=_lineIdxBase(_m),_N=getCycleLen(_m),_o=(_b+3)%_N;S.weekLines={};S.weekLines[dk(_m)]=_o;');
  eq('Échange de semaine : ligne échangée cette semaine', a.run('lineIdx(_m)===_o&&_o!==_b'), true);
  eq('Échange de semaine : semaine suivante inchangée', a.run('(function(){var n=new Date(_m);n.setDate(n.getDate()+7);return lineIdx(n)===_lineIdxBase(n);})()'), true);
  eq('Échange de semaine : vacations de la ligne échangée', a.run('(function(){var g=getActiveCycleGrid(_m)||CYCLE,d=new Date(_m);d.setDate(d.getDate()+1);return getCycleVac(d).cycleVac===(g[_o][1]||"RH")||getCycleVac(d).cycleVac===g[_o][1];})()'), true);
}

console.log('\n' + (count - fails) + '/' + count + ' contrôles réussis');
if (fails) process.exit(1);
