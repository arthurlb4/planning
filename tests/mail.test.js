// Contrôle automatique du texte du mail au gestionnaire (accords, élisions, phrases des écarts de paie).
// Lancé avant chaque mise en ligne (node tests/mail.test.js).
const { load } = require('./harness');

let fails = 0, count = 0;
// Espaces insécables (avant €) comptées comme des espaces
const sp = x => typeof x === 'string' ? x.replace(/[\u00a0\u202f]/g, ' ') : Array.isArray(x) ? x.map(sp) : x;
function eq(label, got, want) {
  count++; got = sp(got);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.error('ÉCHEC  ' + label + '\n        attendu : ' + JSON.stringify(want) + '\n        obtenu  : ' + JSON.stringify(got)); }
  else console.log('ok     ' + label);
}
const YM = (y, m) => y * 12 + (m - 1); // m de 1 à 12
const a = load('2026-10-07');
const item = o => a.run('_gmItem(' + JSON.stringify(o) + ')');
const row = (k, h, bq, aq, bm, am) => ({ d: bm - am, row: { k, h, bq, rq: 0, aq, bm, rm: 0, am, lbl: k } });

// 1. Élision des mois
eq('d’août', a.run('_deMois(' + YM(2026, 8) + ')'), 'd’août');
eq('d’avril', a.run('_deMois(' + YM(2026, 4) + ')'), 'd’avril');
eq('d’octobre', a.run('_deMois(' + YM(2026, 10) + ')'), 'd’octobre');
eq('de février', a.run('_deMois(' + YM(2026, 2) + ')'), 'de février');

// 2. Heures : ce qui est noté / ce que j'ai fait, sans montant
eq('HS : 9h15 notées, 9h30 faites', item(row('hsLow', true, 555, 570, 100, 104.85)), 'tu as noté 9h15 d’HS à 125 % alors que j’en ai fait 9h30');
eq('Nuit : rien noté', item(row('nuit', true, 0, 60, 0, 6)), 'tu n’as rien noté en heures de nuit alors que j’en ai fait 1h00');
eq('Nuit : notée sans en avoir fait', item(row('nuit', true, 60, 0, 6, 0)), 'tu as noté 1h00 d’heures de nuit alors que je n’en ai pas fait');

// 3. Nombres : singulier à 0 et 1
eq('Aucun panier', item(row('panier', false, 0, 2, 0, 6)), 'tu n’as noté aucun panier alors que j’en compte 2');
eq('1 panier', item(row('panier', false, 1, 2, 3, 6)), 'tu as noté 1 panier alors que j’en compte 2');
eq('10 paniers', item(row('panier', false, 10, 12, 30, 36)), 'tu as noté 10 paniers alors que j’en compte 12');
eq('Aucune indemnité antenne', item(row('antenne', false, 0, 1, 0, 6)), 'tu n’as noté aucune indemnité antenne alors que j’en compte 1');
eq('Indemnité notée sans en avoir', item(row('antenne', false, 2, 0, 12, 0)), 'tu as noté 2 indemnités antenne alors que je n’en compte aucune');

// 4. Bon nombre, mauvais montant ; montants fixes ; demi-heure ; reste
eq('Bon nombre, mauvais montant', item(row('nuit', true, 570, 570, 40, 43.2)), '9h30 d’heures de nuit : le bon nombre, mais 40,00 € payés au lieu de 43,20 €');
eq('Montant fixe', item({ d: -5, fx: { lbl: 'Ancienneté', bm: 120, am: 125 } }), 'Ancienneté : 120,00 € payés au lieu de 125,00 €');
eq('Demi-heure commencée', item({ d: 0, hs: [{ k: 'hsLow', bq: 555 }] }), 'tu as noté 9h15 d’HS à 125 % : toute demi-heure commencée est due (article VIII.5 de l’accord), soit 9h30');
eq('Écart sans ligne', item({ id: 'reste', d: -2.1 }), 'le brut diffère encore de 2,10 € sans ligne en cause (en ma défaveur)');

// 5. Écarts de paie regroupés par bulletin, avec le mois des variables ; écarts ignorés exclus
a.run('S.bulletins={' + YM(2026, 9) + ':{ym:' + YM(2026, 9) + '}};_bulIgn=function(){return false;};'
  + '_bulCompare=function(){return{status:"ecart",items:[' + JSON.stringify(row('panier', false, 0, 2, 0, 6)) + ',{id:"x",lbl:"X",d:-1,ign:true}]};};');
eq('Bulletin de septembre, variables d’août', a.run('_gmPaie()'), ['- bulletin de septembre 2026 (variables d’août) :\n   • tu n’as noté aucun panier alors que j’en compte 2']);

// 5 bis. Heures à payer mises en rendus par le bulletin (réglage gardé) : une seule ligne, sans répéter l'écart de la même ligne
a.run('_bulPayDiffs=function(){return{keptList:[{ym:' + YM(2026, 8) + ',k:"dimRendu",h:450,v:1}]};};'
  + '_bulCompare=function(){return{status:"ecart",items:[{id:"r:dim",d:-50,row:' + JSON.stringify(row('dim', true, 0, 450, 0, 50).row) + '}]};};');
eq('Dimanche mis en rendus à tort', a.run('_gmPaie()'), ['- bulletin de septembre 2026 (variables d’août) :\n   • génération de rendus : tu as mis 7h30 d’heures de dimanche en rendus alors qu’elles doivent être payées']);
// Réglage qui diffère encore du bulletin (non tranché) : signalé comme un problème de génération de rendus
a.run('_bulPayDiffs=function(){return{keptList:[],paid:[{ym:' + YM(2026, 8) + ',k:"dimRendu",h:405,v:true}]};};');
eq('Dimanche : réglage différent du bulletin', a.run('_gmPaie()'), ['- bulletin de septembre 2026 (variables d’août) :\n   • génération de rendus : tu as mis 6h45 d’heures de dimanche en rendus alors que je les compte payées']);
a.run('_bulPayDiffs=function(){return{keptList:[],paid:[{ym:' + YM(2026, 8) + ',k:"dimRendu",h:405,v:false}]};};');
eq('Dimanche payé, compté en rendus', a.run('_gmPaie()'), ['- bulletin de septembre 2026 (variables d’août) :\n   • génération de rendus : tu as payé 6h45 d’heures de dimanche alors que je les compte en rendus']);
// … sauf si la ligne du bulletin est ignorée
a.run('_bulCompare=function(){return{status:"ecart",items:[{id:"r:dim",d:-50,ign:true}]};};');
eq('Génération de rendus ignorée : pas dans le mail', a.run('_gmPaie()'), []);
a.run('_bulPayDiffs=function(){return{keptList:[],paid:[]};};');

// 5 ter. Tableau : différences ignorées retirées (écart brut 1h00, 0 après ignorées)
a.run('S.profile.rhCmp={ed:"2026-09-18",d:-60,de:0};S.profile.rhTable={};S.profile.ignRhC={rest:60};_rhStored=function(){return null;};');
eq('Tableau : écart ignoré absent du mail', a.run('_gmRh()'), null);
a.run('S.profile.rhCmp={ed:"2026-09-18",d:-60,de:-60};S.profile.ignRhC={};');
eq('Tableau : écart non ignoré', a.run('_gmRh().L'), ['- solde d’heures : le tableau m’en compte 1h00 de plus que mon décompte']);

// 6. Reports : uniquement les heures qui expirent ce mois-ci
a.run('calcSoldes=function(){return{realAvail:{' + YM(2026, 7) + ':1080,' + YM(2026, 8) + ':203},preExpiry:{}};};'
  + 'getExpYm=function(ym){return ym+3;};');
eq('Reports : juillet (expire fin octobre), pas août', a.run('_gmRep()'), ['- 18h00 acquises en juillet 2026, qui expirent fin octobre 2026']);

// 6 bis. Heures perdues : expirées il y a moins de 3 mois (juin, perdu fin septembre), pas avant (mars, perdu fin juin)
a.run('calcSoldes=function(){return{realAvail:{},preExpiry:{' + YM(2026, 3) + ':300,' + YM(2026, 6) + ':661}};};');
eq('Heures perdues : juin seulement', a.run('_gmLost()'), ['- 11h01 acquises en juin 2026, perdues fin septembre 2026']);
eq('Mail : heures perdues', a.run('_gmBuild([],null,[],["- 11h01 acquises en juin 2026, perdues fin septembre 2026"])'),
  { sub: 'Report d’heures déjà expirées', body: 'Bonjour,\n\nDes heures de rendus ont expiré récemment. Peux-tu m’accorder un report pour les récupérer :\n- 11h01 acquises en juin 2026, perdues fin septembre 2026\n\nMerci d’avance' });

// 6 ter. Monétisation demandée
eq('Mail : monétisation', a.run('_gmBuild([],null,[],[],["- 9h15 acquises en mars 2026, qui expirent fin mars 2027"])'),
  { sub: 'Monétisation d’heures de rendus', body: 'Bonjour,\n\nJe n’ai pas pu poser ces heures de rendus. Peux-tu me les monétiser :\n- 9h15 acquises en mars 2026, qui expirent fin mars 2027\n\nMerci d’avance' });

// 7. Objet et texte : tutoiement, sans signature
const m = a.run('_gmBuild(["- 18h00 acquises en juillet 2026, qui expirent fin octobre 2026"],null,["- bulletin d’août 2026 (variables de juillet) :\\n   • tu as noté 1 panier alors que j’en compte 2"])');
eq('Objet', m.sub, 'Report d’heures qui vont expirer et corrections de paie');
eq('Texte', m.body, 'Bonjour,\n\nPeux-tu m’accorder un report de mes heures de rendus qui vont expirer :\n- 18h00 acquises en juillet 2026, qui expirent fin octobre 2026\n\n'
  + 'Sur mes bulletins de paie, je relève les écarts suivants :\n- bulletin d’août 2026 (variables de juillet) :\n   • tu as noté 1 panier alors que j’en compte 2\nPeux-tu les faire corriger ?\n\nMerci d’avance');

console.log('\n' + (count - fails) + '/' + count + ' contrôles réussis');
if (fails) process.exit(1);
