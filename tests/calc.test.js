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
//  rendus posés en septembre : 18 × 7h30 + 4h52 = 139h52, pris sur les heures qui expirent le plus tôt
//  (juin fin septembre, puis avril et juillet fin octobre, puis mai reporté à fin novembre).
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

// 1. Juin (sans report) utilisé avant mai (reporté) : rien de perdu fin septembre
{
  const a = situation({});
  eq('Solde au 1/10 = 32h24 (mai 29h01 + août 3h23)', a.run('calcSoldeRH(new Date(2026,9,1,12)).solde'), 1944);
  eq('Juin : rien de perdu fin septembre', a.run('calcSoldes().preExpiry'), { [YM(2026, 6)]: 0 });
  eq('Libre à poser en septembre = 32h24', a.run('calcTrueDispo(' + YM(2026, 9) + ').total'), 1944);
  eq('Libre à poser en octobre = 32h24', a.run('calcTrueDispo(' + YM(2026, 10) + ').total'), 1944);
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
  eq('Rendu du 20/10 : solde au 1/10 inchangé', a.run('calcSoldeRH(new Date(2026,9,1,12)).solde'), 1944);
  eq('Rendu du 20/10 : libre à poser en octobre = 24h54', a.run('calcTrueDispo(' + YM(2026, 10) + ').total'), 1494);
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
  eq('Rappels : mai et août (32h24) fin novembre',
    a.run('_pushAlerts().filter(function(x){return x.tag.indexOf("exp-")===0;}).map(function(x){return x.at+" "+x.body;})'),
    ['2026-11-16 32h24 expirent fin novembre. Poser un rendu pour ne pas les perdre.', '2026-11-27 32h24 expirent le 30 novembre.']);
  eq('Rappels : bulletin le 1er, tableau Gestion le 20',
    a.run('_pushAlerts().filter(function(x){return x.tag.indexOf("exp-")!==0;}).slice(0,3).map(function(x){return x.at+" "+x.title;})'),
    ['2026-10-01 Bulletin de paie', '2026-10-20 Tableau Gestion', '2026-11-01 Bulletin de paie']);
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
    JSON.stringify({ split: { [YM(2026, 6)]: 840 }, reports: { [YM(2026, 6)]: 1 } }));  // Inscription « vérifier depuis juillet » avec ce seul tableau : solde au 1er juillet reconstitué, paie et Gestion vérifiées depuis juillet
  eq('Inscription depuis juillet : départ le 1er juillet, soldes reconstitués d’après le tableau', a.run(`(function(){var _r=render,_t=_infoToast;render=function(){};_infoToast=function(){};S.profile={name:'t'};S.conges={};S.ephExtend={};S.bulletins={};
    SU={step:5,rh:{cells:${JSON.stringify(cells)},name:'t.xlsx',rh:_rh,P:_rhImportPlan(_rh)},rh0:null,rhMode:'imp',bul:{},bulMode:'man',v:{line:'3',from:'past',fromYM:${2026*12+6},pfa:0,pct:100}};
    _suDone();render=_r;_infoToast=_t;return JSON.stringify([S.profile.calcStart,S.profile.start.d,S.profile.ephBaseDate,_ephSplit(),!!S.profile.rhTable,_calcVerifYM()]);})()`),
    JSON.stringify(['2026-07-01', '2026-07-01', '2026-06-30', { [YM(2026, 4)]: 0, [YM(2026, 5)]: 450, [YM(2026, 6)]: 840 }, true, 2026 * 12 + 7]));
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
  // Bulletin d'avril 2025 : « ABSENCE NON REMUNEREE 160 1,00 15,548 -15,55 » = (qualification + ancienneté + indemnité mensuelle) / 160, mois du bulletin
  eq('Absence non rémunérée / grève : ligne lue, retenue de l’app identique (1 heure, 1/160ᵉ)', a.run('(function(){var o=_bulParse(["PERIODE DE PAIE DU 01/04/2025 AU 30/04/2025","ABSENCE NON REMUNEREE 160 1,00 15,548 -15,55","**TOTAL BRUT PAYE 3755,99"]),sv=JSON.stringify([S.profile,S.excInfo||null,S.conges]);'
    + 'S.profile.palierNum=22;S.profile.ancYears=7;S.profile.ancRefYM=' + YM(2025, 4) + ';S.profile.groupeClassif=5;S.profile.heuresMensuelles=151.67;S.excInfo={"2025-04-10":{m:"greve",g:"h"}};delete S.conges["2025-04-10"];'
    + 'var P=calcPayeMois(2025,3),f=_bulCompare(o).fixed.filter(function(x){return x.lbl==="Absence non rémunérée";})[0];var r=JSON.stringify([o.absNR,P.greveRet,f&&f.ok]);var z=JSON.parse(sv);S.profile=z[0];S.excInfo=z[1]||undefined;S.conges=z[2];return r;})()'),
    JSON.stringify([{ q: 1, mt: -15.55, div: 160 }, 15.55, true]));
  // Découpage du PDF en lignes : libellé et montant à 1 pt d'écart réunis, mention verticale de la marge écartée
  eq('PDF : lignes reconstituées, texte pivoté écarté', a.run('JSON.stringify(_pdfRows([{str:"MESURE NAO CDI 2023",transform:[1,0,0,1,90,500]},{str:"130,00",transform:[1,0,0,1,400,499]},{str:"V. 2022",transform:[0,1,-1,0,20,500]},{str:"P.F.A NAC MENS",transform:[1,0,0,1,90,508]},{str:"170,00",transform:[1,0,0,1,400,508.6]}]))'),
    JSON.stringify(['P.F.A NAC MENS 170,00', 'MESURE NAO CDI 2023 130,00']));
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
  eq('Bulletin : dernier mois sans HS aligné sur le seul mois voisin vérifié', a.run('(function(){var sb=S.bulletins,ss=JSON.stringify(S.settings),sp=JSON.stringify(S.profile);S.settings.settingsHistory=[];S.profile.settingsMonthlyHistory=null;S.settings.hsRendu=false;S.profile.settingsMonthly={};'
    + 'S.profile.settingsMonthly[' + YM(2026, 2) + ']={hsRendu:true};var cH=calcHSWeek;calcHSWeek=function(m){return m.getMonth()===1||(m.getMonth()===2&&m.getDate()<3)?{surplus:0,rendusMin:0,rendusMinHS:0,rendusMinRam:0,rawLow:0,rawHigh:0}:cH(m);};'
    + 'var j=_bulParse(["PERIODE DE PAIE DU 01/02/2026 AU 28/02/2026","RAP 202601 HEURES SUP 125% 2,00 19,400 38,80","**TOTAL BRUT PAYE 3000,00"]),f=_bulParse(["PERIODE DE PAIE DU 01/03/2026 AU 31/03/2026","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[j.ym]=j;S.bulletins[f.ym]=f;'
    + 'var x=_bulPayDiffs().paid.filter(function(p){return p.k==="hsRendu"&&p.ym===' + YM(2026, 2) + ';})[0];calcHSWeek=cH;S.bulletins=sb;S.settings=JSON.parse(ss);S.profile=JSON.parse(sp);return x?[x.v,!!x.fill]:null;})()'), [false, true]);
  eq('Bulletin : HS payées pour juillet sans HS de juillet dans l’app → rien déduit pour août (la paie range la semaine comme l’app)', a.run('(function(){var sb=S.bulletins,ss=JSON.stringify(S.settings),sp=JSON.stringify(S.profile),cH=calcHSMinsMois;S.settings.settingsHistory=[];S.profile.settingsMonthlyHistory=null;S.profile.settingsMonthly={};S.settings.hsRendu=true;'
    + 'calcHSMinsMois=function(y,m){if(settingsForYM(y*12+m).hsRendu)return{low:0,high:0};return{low:m===7?120:0,high:0};};'
    + 'var a1=_bulParse(["PERIODE DE PAIE DU 01/08/2026 AU 31/08/2026","RAP 202607 HEURES SUP 125% 2,00 19,400 38,80","**TOTAL BRUT PAYE 3000,00"]);S.bulletins={};S.bulletins[a1.ym]=a1;'
    + 'var D=_bulPayDiffs().paid.filter(function(x){return x.k==="hsRendu";}).map(function(x){return [x.ym,x.v];});calcHSMinsMois=cH;S.bulletins=sb;S.settings=JSON.parse(ss);S.profile=JSON.parse(sp);return JSON.stringify(D);})()'), JSON.stringify([]));
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

// Détachement : vacation plus longue que prévue, mais aucune heure sup ni rendu
{
  const a = load('2026-10-01');
  eq('Détachement : pas d\'heures sup', a.run(`(function(){var m=getMonday(new Date(2026,9,5,12));
    for(var i=0;i<7;i++){var d=new Date(m);d.setDate(m.getDate()+i);var c=getCycleVac(d).cycleVac;if(c&&c!=='RH'){var k=dk(d);
      S.customVacs=S.customVacs||{};S.customVacs.X={deb:'06h00',fin:'20h00',dur:840,panier:false,hidden:true,label:'X',primes:{}};
      S.overrides=S.overrides||{};S.overrides[k]={vac:'X',fromSV:false,echange:false,hs:false,formation:false,motif:'autre'};
      var w1=calcHSWeek(m).surplus>0;S.overrides[k].motif='detache';return [w1,calcHSWeek(m).surplus,_dayHSMin(d)];}}})()`), [true, 0, 0]);  eq('Détachement syndical : pas d\'heures sup non plus', a.run(`(function(){var m=getMonday(new Date(2026,9,5,12));
    for(var i=0;i<7;i++){var d=new Date(m);d.setDate(m.getDate()+i);var k=dk(d);if(S.overrides&&S.overrides[k]&&S.overrides[k].vac==='X'){
      S.overrides[k].motif='syndic';return [calcHSWeek(m).surplus,_dayHSMin(d)];}}})()`), [0, 0]);
}
// Pool cadre : cycle de 5 semaines, ligne placée sur la semaine en cours
{
  const a = load('2026-10-01');
  eq('Pool cadre : 5 lignes et vacations du cycle', a.run(`(function(){S.profile.pool='cadre';var m=getMonday(NOW),n=getCycleLen(NOW);
    S.profile.anchorLine=((1-Math.round((m-ANCHOR)/(7*864e5)))%n+n)%n;var r=[n,lineIdx(m),getCycleVac(m).cycleVac];delete S.profile.pool;return r;})()`), [5, 1, 'P422V']);
}

// Report automatique : appliqué à l'échéance ; avant, « prévu » (7h ou moins restantes) et compté seulement « sous réserve »
{
  const a = situation({ extraRendus: { '2026-12-03': 180 } });
  a.run('saveState=function(){};_infoToast=function(m){window._toast=m;};autoReportEph();');
  eq('Report auto : août (3h23) expire encore fin novembre', a.run('getExpYm(' + YM(2026, 8) + ')'), YM(2026, 11));
  eq('Report auto : août « report auto prévu »', a.run('!!window._autoPlan[' + YM(2026, 8) + ']'), true);
  eq('Report auto : juillet (18h00) pas prévu', a.run('!!window._autoPlan[' + YM(2026, 7) + ']'), false);
  eq('Report auto : sous réserve, août valable jusqu’à fin août 2027', a.run('_withProj(function(){return getExpYm(' + YM(2026, 8) + ');})'), YM(2027, 8));
  eq('Report auto : juin utilisé avant l’échéance, rien de perdu', a.run('calcSoldes().preExpiry'), { [YM(2026, 6)]: 0 });
  eq('Report auto : pas encore compté à la date d’un tableau de septembre', a.run('getEphExtAt(' + YM(2026, 8) + ',' + YM(2026, 9) + ')'), 0);
  eq('Rendu du 3 décembre : couvert sous réserve (pas sur le matelas)', a.run('!!window._resvKeys["2026-12-03"]&&!(S.matelasKeys||{})["2026-12-03"]'), true);
  // HS ajoutées sur août avant l'échéance (8h23) : plus de report prévu, le rendu passe sur le matelas, avec un message
  a.run('S.profile.matelas=9720;S.profile.ephSoldeSplit[' + YM(2026, 8) + ']=503;autoReportEph();');
  eq('HS sur août : plus de report prévu', a.run('!!window._autoPlan[' + YM(2026, 8) + ']'), false);
  eq('HS sur août : rendu du 3 décembre sur le matelas, message affiché', a.run('(S.matelasKeys||{})["2026-12-03"]!==undefined'), true);
}
// Report auto déjà déclenché (échéance de novembre passée) : acquis, même si des heures sont ajoutées ensuite
{
  const b = load('2026-12-10');
  b.run('S.profile={ephSoldeCreatedYM:' + YM(2026, 9) + ',matelas:0,ephSoldeSplit:{' + YM(2026, 8) + ':203}};S.ephExtend={};S.conges={};S.extraRendus={};'
    + 'getVac=function(){return {vac:"",absent:false};};recalcAllMatelas=function(){};saveState=function(){};S.autoExtend={};autoReportEph();');
  b.run('S.profile.ephSoldeSplit[' + YM(2026, 8) + ']=503;autoReportEph();');
  eq('Report auto acquis à l’échéance, gardé ensuite', b.run('getExpYm(' + YM(2026, 8) + ')') >= YM(2027, 2), true);

}

// Option « Heures valables un an » : chaque mois expire à la fin du 12e mois, juin 2026 n'est plus perdu fin septembre
{
  const a = situation({});
  a.run('S.profile.exp12=true;');
  eq('Valables un an : juin 2026 expire fin juin 2027', a.run('getExpYm(' + YM(2026, 6) + ')'), YM(2027, 6));
  eq('Valables un an : rien de perdu au 1/10', a.run('calcSoldes().preExpiry'), {});
  eq('Valables un an : solde au 1/10 = juin 11h01 + juillet 18h00 + août 3h23', a.run('calcSoldeRH(new Date(2026,9,1,12)).solde'), 661 + 1283);
}

// Monétisation (hypothèses par défaut) : HS, dimanche, férié, RH monétisables à partir de 6 mois, payés le mois suivant
{
  const a = load('2026-10-01'), A = YM(2026, 4);
  a.run('S.profile.ephSoldeCreatedYM=' + YM(2026, 1) + ';S.profile.palierNum=20;S.profile.heuresMensuelles=151.67;S.ephExtend={' + A + ':1};S.monet={};'
    + 'var _bg=buildGen;buildGen=function(w){var g=_bg(w);g[' + A + ']=g[' + A + ']||{dim:0,rh:0,fer:0,hs:0,ram:0,extra:0,solde:0,monet:0};g[' + A + '].hs+=600;g[' + A + '].dim+=240;g[' + A + '].ram+=120;return g;};');
  const before = a.run('calcSoldes().realAvail[' + A + ']'), info = a.run('JSON.stringify(monetInfo(' + A + '))');
  const I = JSON.parse(info);
  eq('Monétisation : ouverte à 6 mois (avril → octobre)', I.open, true);
  eq('Monétisation : montant estimé non nul', I.eur > 0 && I.min > 0, true);
  eq('Monétisation : semaine ramenée exclue', I.min <= before - 120, true);
  a.run('render=function(){};saveState=function(){};monetSet(' + A + ',true)');
  eq('Monétisation : heures retirées du solde', a.run('calcSoldes().realAvail[' + A + ']'), before - I.min);
  eq('Monétisation : payée le mois suivant (variables d’octobre) au taux de base', a.run('calcVariablesMois(2026,9).supMonet'), Math.round(I.min / 60 * a.run('_tauxHYM(TODAY_YM)') * 100) / 100);
  eq('Monétisation : pas avant 6 mois (juin)', a.run('monetInfo(' + YM(2026, 6) + ').open'), false);
}

// Échange entre collègues : les primes suivent la vacation faite, prime du matin comprise
{
  const a = load('2026-10-01');
  const m0 = a.run('calcPrimesMois(2026,9).matin');
  const ex = (give, take, vac) => a.run('S.overrides={};S.overrides["' + give + '"]={vac:getCycleVac(new Date("' + give + 'T12:00:00")).cycleVac,echange:true,ecSelf:false,hs:false,pair:"' + take + '"};'
    + 'S.overrides["' + take + '"]={vac:"' + vac + '",echange:true,ecSelf:true,hs:false,pair:"' + give + '"};calcPrimesMois(2026,9).matin');
  eq('Échange : je cède un matin (A1 le 14) contre B1 → la prime du matin part avec', ex('2026-10-14', '2026-10-13', 'B1'), m0 - 1);
  eq('Échange : je prends un matin (A2 le 23) contre B1 → une prime du matin en plus', ex('2026-10-19', '2026-10-23', 'A2'), m0 + 1);
  eq('Échange le même jour (B1 → A2) → une prime du matin en plus', a.run('S.overrides={"2026-10-20":{vac:"A2",echange:true,ecSelf:true,hs:false,pair:"2026-10-20"}};calcPrimesMois(2026,9).matin'), m0 + 1);
  a.run('S.overrides={}');
}

// Historique : une période posée ne montre que ses jours posés (pas les repos choisis en bout de période)
{
  const a = load('2026-10-01');
  eq('Historique : période resserrée sur les jours posés', a.run(`(function(){var w=function(d){var v=getVac(d);return v.vac&&v.vac!=='RH'&&!v.absent;};
    var s=null,e=null,ks=[];for(var i=0;i<40&&!e;i++){var d=new Date(2026,10,1+i,12);if(!s){if(!w(d)){var p=new Date(d);p.setDate(d.getDate()+1);if(w(p))s=d;}continue;}
      if(w(d))ks.push(dk(d));else if(ks.length)e=d;}
    S.conges=S.conges||{};ks.forEach(function(k){S.conges[k]='cg';});
    S.history=[{t:'',d:fmtDate(s)+' au '+fmtDate(e)+' -> congé',c:'',key:dk(s)}];_histClean();var h=S.history[0];
    ks.forEach(function(k){delete S.conges[k];});_histClean();
    return [h.key===ks[0],h.d.indexOf(fmtDate(new Date(ks[ks.length-1]+'T12:00:00')))>0,S.history.length];})()`), [true, true, 0]);
}

// Vérification depuis janvier sans tableau de départ : solde au 1er janvier reconstitué à partir du tableau le plus récent
{
  const a = load('2026-10-01');
  eq('Solde de départ reconstitué : reste du tableau + rendus posés depuis le départ', a.run(`(function(){
    var rh={edition:new Date(2026,8,18,12),tot:{stockAct:300},lines:[{ym:2025*12+11,nature:'Dimanche',acq:600,solde:120,valid:new Date(Date.UTC(2026,2,31)),rep:0},
      {ym:2025*12+5,nature:'Dimanche',acq:200,solde:50,valid:new Date(Date.UTC(2025,8,30)),rep:0},{ym:2026*12+2,nature:'Férié',acq:400,solde:400,valid:new Date(Date.UTC(2026,5,30)),rep:0}]};
    var k=null;for(var i=0;i<28&&!k;i++){var d=new Date(2026,1,1+i,12),v=getVac(d);if(v.vac&&v.vac!=='RH')k=dk(d);}
    S.conges={};S.conges[k]='rend';_rhReconApply(rh,'2026-01-01');var sp=_ephSplit(),dur=getDur(new Date(k+'T12:00:00'));
    var r=[Object.keys(sp).length,sp[2025*12+11]===120+dur,S.profile.ephSoldeCreatedYM===2026*12,S.profile.ephBaseDate,S.profile.matelas,_rendStatus(k)];
    delete S.profile.ephRecon;S.conges={};return r;})()`), [1, true, true, '2025-12-31', 300, 'rend']);
}

// Tableau Gestion réel (2026, sans noms) : l'année d'avant est dans « Stock au 31/12/2025 » ; vérification Gestion au plus tôt le 1er janvier,
// matelas = stock de début d'année ; départ en cours d'année : stock moins les compléments pris avant (S2 : 1,75 h ; S8 : 7,87 h)
{
  const cells = {"A1": 2026, "B1": 46023, "A2": 46283, "A6": "Stock au 31/12/2025", "D6": "Conso sur Stock", "F6": "Stock actualisé", "Q6": "Cumul acquisitions", "R6": "Cumul consommations", "S6": "Cumul soldes", "A7": 171.89, "D7": 9.620000000000001, "F7": 162.26999999999998, "Q7": 221.01, "R7": 188.625, "S7": 32.385, "C10": "Date acquisition", "D10": "Nature", "E10": "Acquisition", "F10": "Consommation", "G10": "Solde", "H10": "Validité", "J10": "Conso sur Stock", "L10": "Report 1", "M10": "Validité", "N10": "Report 2", "O10": "Validité", "Q10": "Commentaires", "C11": 46053, "D11": "Férié", "E11": 16, "F11": 16, "G11": 0, "C12": 46053, "D12": "RCR (HS)", "E12": 8.75, "F12": 8.75, "G12": 0, "C13": 46053, "D13": "Dimanche", "E13": 4.5, "F13": 4.5, "G13": 0, "C14": 46053, "G14": 0, "J14": 1.75, "Q14": "31h posés S2 - complément de stock 1,75", "C15": 46081, "D15": "Dimanche", "E15": 0.13, "F15": 0.13, "G15": 0, "C16": 46081, "G16": 0, "J16": 7.87, "Q16": "8h posés S8 - complément de stock 7,87", "C17": 46112, "D17": "Dimanche", "E17": 16.25, "F17": 16.25, "G17": 0, "L17": "3 mois", "C18": 46112, "D18": "RCR (HS)", "E18": 3.125, "F18": 3.125, "G18": 0, "L18": "3 mois", "C19": 46142, "D19": "RCR (HS)", "E19": 24.75, "F19": 24.75, "G19": 0, "Q19": "24h posées S23", "C20": 46142, "D20": "Férié", "E20": 15, "F20": 15, "G20": 0, "L20": "3 mois", "Q20": "15h pris S27", "C21": 46142, "D21": "Dimanche", "E21": 5, "F21": 5, "G21": 0, "L21": "3 mois", "C22": 46142, "D22": "RH", "E22": 4.75, "F22": 4.75, "G22": 0, "L22": "3 mois", "C23": 46173, "D23": "Férié", "E23": 49, "F23": 49, "G23": 0, "C24": 46173, "D24": "RCR (HS)", "E24": 36.25, "F24": 36.25, "G24": 0, "C25": 46173, "D25": "Dimanche", "E25": 3.875, "F25": 3.875, "G25": 0, "A26": "Alerte", "B26": 11.004999999999999, "C26": 46203, "D26": "Dimanche", "E26": 12.25, "F26": 1.245, "G26": 11.004999999999999, "H26": 46295, "P26": 46295, "Q26": "20,5h en S32 / 32,5h en S33 / 32h en S34 / 19,25h en S35", "C27": 46234, "D27": "Dimanche", "E27": 4, "G27": 4, "H27": 46326, "P27": 46326, "C28": 46234, "D28": "Férié", "E28": 14, "G28": 14, "H28": 46326, "P28": 46326, "C29": 46265, "D29": "Dimanche", "E29": 3.38, "G29": 3.38, "H29": 46356, "P29": 46356};
  const run = f => { const a = load('2026-10-11'); return a.run(`(function(){var rh=_rhParse(${JSON.stringify(cells)},'18-09-2026.xlsx'),P=_rhImportPlan(rh);
    render=function(){};_infoToast=function(){};S.profile={name:'t'};S.conges={};S.ephExtend={};S.bulletins={};
    SU={step:5,rh:{cells:${JSON.stringify(cells)},name:'x.xlsx',rh:rh,P:P},rh0:null,rhMode:'imp',bul:{},bulMode:'man',v:{line:'3',from:'past',fromYM:${f},pfa:0,pct:100}};
    _suDone();var pr=S.profile;return JSON.stringify([dk(rh.edition),rh.lines.length,rh.lastWeek,pr.calcStart,pr.start.d,Math.round(pr.matelas)]);})()`); };
  eq('Tableau réel, départ décembre 2025 : bulletins depuis la paie de janvier, départ 1er janvier, matelas 171,89 h (stock au 31/12)', run(YM(2025, 12)), JSON.stringify(['2026-09-18', 19, 35, '2025-12-01', '2026-01-01', 10313]));
  eq('Tableau réel, « ce mois-ci » (octobre) : départ avancé à septembre, premier mois que le tableau ne couvre pas', run(YM(2026, 10)), JSON.stringify(['2026-09-18', 19, 35, '2026-09-01', '2026-09-01', 9736]));
  eq('Tableau réel, départ avril : matelas 162,27 h', run(YM(2026, 4)), JSON.stringify(['2026-09-18', 19, 35, '2026-04-01', '2026-04-01', 9736]));
  // Compte d'avant (v6 : soldes repris du dernier tableau, vérification depuis janvier) : départ le 1er janvier, rendus comptés d'après leur date
  { const a = load('2026-10-11'); eq('Migration : départ 1er janvier reconstitué, rendus de juin de nouveau décomptés',
    a.run(`(function(){render=function(){};S.profile={name:'t',verif:{k:'mois',D:'2026-01-01'},rhTable:{cells:${JSON.stringify(cells)},name:'18-09-2026.xlsx'},ephBaseDate:'2026-09-18'};
      S.conges={'2026-06-03':'rend-hist','2025-12-10':'rend'};_startMigrate();return [S.profile.start.k,S.profile.start.d,S.conges['2026-06-03'],S.conges['2025-12-10'],Math.round(S.profile.start.mat),!!S.profile.verif];})()`),
    ['mois', '2026-01-01', 'rend', 'rend-hist', 10313, false]); }
  // Reprise d'une différence que le tableau n'a plus (gestionnaire qui corrige) : retirée d'elle-même ; celle qui existe encore est gardée
  { const a = load('2026-10-11'); eq('Reprises : retirée si le tableau n’a plus la différence, gardée sinon',
    a.run(`(function(){render=function(){};saveState=function(){};var rh=_rhParse(${JSON.stringify(cells)},'18-09-2026.xlsx');S.conges={};
      S.settings=Object.assign(S.settings||{},{dimRendu:false,rhRendu:false,ferRendu:false,hsRendu:false});
      var f={edition:new Date(2026,1,22,12),tot:{stock2025:10313.4,stockAct:10208.4},lastWeek:2,weeks:{2:1860},lines:[]};_startApply(_startFromTable(f));
      var kOk='acq'+${YM(2026, 7)}+'fer',kOld='acq'+${YM(2026, 6)}+'dim';S.profile.ignRhC={};S.profile.ignRhC[kOk]=840;S.profile.ignRhC[kOld]=999;
      rhCompareShow(rh,true);return [kOk in S.profile.ignRhC,kOld in S.profile.ignRhC,S.profile.rhAutoOff.L.join()];})()`), [true, false, 'dimanches de juin']); }
  // Vérification depuis le tableau de février (22/02, janvier seulement, matelas 170,14 h) : rendus déduits = ce que le tableau
  // de septembre a consommé depuis (heures et matelas), sans ce qui l'était déjà en février
  { const a = load('2026-10-11'); eq('Départ = tableau de février : depuis, 159h23 pris sur les heures et 7h52 sur le matelas au tableau ; matelas de départ 170h14',
    a.run(`(function(){var rh=_rhParse(${JSON.stringify(cells)},'18-09-2026.xlsx');S.conges={};
      var f={edition:new Date(2026,1,22,12),tot:{stock2025:10313.4,stockAct:10208.4},lastWeek:2,weeks:{2:1860},lines:[{ym:${YM(2026, 1)},nature:'Férié',acq:960,cons:960,solde:0,stock:0,com:''},{ym:${YM(2026, 1)},nature:'RCR (HS)',acq:525,cons:525,solde:0,stock:0,com:''},{ym:${YM(2026, 1)},nature:'Dimanche',acq:270,cons:270,solde:0,stock:0,com:''},{ym:${YM(2026, 1)},nature:'',acq:0,cons:0,solde:0,stock:105,com:'31h posés S2 - complément de stock 1,75'}]};
      render=function(){};_startApply(_startFromTable(f));var R=_verifSim(rh);return [R.st.k,R.st.genFrom===${YM(2026, 2)},Math.round(R.consT),Math.round(R.matT),R.st.from,Math.round(R.appM)];})()`), ['tab', true, 9563, 472, '2026-01-11', 10208]); }
}

// Repartir d'un tableau plus ancien : rendus déjà passés en historique mais postérieurs à sa dernière semaine notée → de nouveau décomptés
{ const a = load('2026-10-11');
  eq('Tableau de février (dernière semaine S2) : rendu de la S8 de nouveau décompté', a.run(`(function(){
    var k=null;for(var i=16;i<=20&&!k;i++){var d=new Date(2026,1,i,12),v=getVac(d);if(v.vac&&v.vac!=='RH')k=dk(d);}
    var rh={edition:new Date(2026,1,22,12),tot:{stockAct:10208},lines:[{ym:2026*12,nature:'Férié',acq:960,cons:960,solde:0,com:'31h posés S2'}],lastWeek:2,weeks:{2:1860}};
    S.conges={};S.conges[k]='rend-hist';S.conges['2026-01-07']='rend-hist';var P=_rhImportPlan(rh);return [P.toRend.indexOf(k)>=0,P.toRend.indexOf('2026-01-07')<0];})()`), [true, true]); }


// « Faire comme le tableau » : rendu de février pris sur les heures de mars (au lieu du matelas), et heures acquises corrigées
{ const a = load('2026-10-11');
  eq('Rendu de février pris sur mars : matelas intact, mars entamé ; différence acceptée ajoutée au mois', a.run(`(function(){render=function(){};saveState=function(){};
    S.settings=Object.assign(S.settings||{},{dimRendu:false,rhRendu:false,ferRendu:false,hsRendu:false});S.conges={};S.extraRendus={'2026-03-08':{dur:600}};
    _startApply(_startManual('2026-02-01',6000,0));getDur=function(){return 480;};S.conges['2026-02-23']='rend';recalcAllMatelas();
    var m0=Math.round(calcSoldes().matelas);S.profile.rendFrom={'2026-02-23':${YM(2026, 3)}};recalcAllMatelas();var c=calcSoldes(),m1=Math.round(c.matelas);
    S.profile.ignRhC={['acq'+${YM(2026, 3)}+'dim']:60};var g=buildGen()[${YM(2026, 3)}];return [m0,m1,Math.round(g.adj)];})()`), [5520, 6000, 60]); }

// Reports du tableau repris alors que l'app avait un report automatique : le tableau fait foi, plus de report auto pour ce mois
{ const a = situation({ extraRendus: { '2026-12-03': 180 } });
  a.run('saveState=function(){};render=function(){};_infoToast=function(){};autoReportEph();');
  eq('Report auto de juin remplacé par « aucun » du tableau', a.run('(function(){S.autoExtend={};S.autoExtend[' + YM(2026, 6) + ']=1;autoReportEph();var b=getEphExtensions(' + YM(2026, 6) + ');window._rhLast=null;rhApplyReports([[' + YM(2026, 6) + ',0]]);autoReportEph();return [b,getEphExtensions(' + YM(2026, 6) + ')];})()'), [1, 0]);
  eq('Report du tableau (+3 mois) sur juin repris ensuite', a.run('(function(){rhApplyReports([[' + YM(2026, 6) + ',1]]);autoReportEph();return getEphExtensions(' + YM(2026, 6) + ');})()'), 1);
}

// Heures que le tableau laisse expirer alors que l'app les a utilisées (le gestionnaire a pris avant des heures reportées)
{ const a = load('2026-10-25');
  eq('Juin perdu au tableau (10h le 30/09), utilisé dans l’app : signalé, avec la ligne du mail', a.run(`(function(){render=function(){};saveState=function(){};
    S.settings=Object.assign(S.settings||{},{dimRendu:false,rhRendu:false,ferRendu:false,hsRendu:false});S.conges={};S.extraRendus={'2026-04-05':{dur:600},'2026-06-07':{dur:600}};
    _startApply(_startManual('2026-04-01',0,0));S.ephExtend={};S.ephExtend[${YM(2026, 4)}]=1;S.noAuto={};getDur=function(){return 600;};S.conges['2026-09-10']='rend';recalcAllMatelas();
    var U=function(y,m,d){return new Date(Date.UTC(y,m,d));};
    var rh={edition:new Date(2026,9,20,12),tot:{},lastWeek:0,weeks:{},lines:[{ym:${YM(2026, 4)},nature:'Dimanche',acq:600,cons:600,solde:0,stock:0,rep:1,valid:U(2026,6,31),validRep:U(2026,9,31),com:''},
      {ym:${YM(2026, 6)},nature:'Dimanche',acq:600,cons:0,solde:600,stock:0,rep:0,valid:U(2026,8,30),com:''}]};
    rhCompareShow(rh,true);S.profile.rhTable={cells:{},name:'x'};var c=S.profile.rhCmp,m=_gmRh();return [JSON.stringify(c.lost),!!(m&&m.L.some(function(l){return l.indexOf('expiré le 30')>=0;}))];})()`),
    ['[{"ym":' + YM(2026, 6) + ',"min":600,"v":"2026-09-30"}]', true]); }

// Annuler : instantané complet (rendus, départ, reprises du tableau), libellé gardé, rétablir
{ const a = load('2026-10-11');
  eq('Annuler / rétablir une action nommée', a.run(`(function(){render=function(){};saveState=function(){};gcalTrigger=function(){};_undoToast=function(l){window._lt=l;};
    S.conges={};pushUndo('Rendu posé');S.conges['2026-10-20']='rend';S.profile.ignRhC={x:1};var t1=document.getElementById('undo-btn');
    undoAction();var a=[Object.keys(S.conges).length,!!(S.profile.ignRhC&&S.profile.ignRhC.x),window._lt];redoAction();a.push(S.conges['2026-10-20'],window._lt);return a;})()`),
    [0, false, 'Annulé : Rendu posé', 'rend', 'Rétabli : Rendu posé']); }

console.log('\n' + (count - fails) + '/' + count + ' contrôles réussis');
if (fails) process.exit(1);
