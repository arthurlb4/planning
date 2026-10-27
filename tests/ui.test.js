// Tests des écrans : l'app et l'admin ouverts dans un vrai navigateur (format téléphone), avec un faux serveur
// et les cycles / vacations figés dans tests/fixtures/server.json. Un écran qui casse (erreur JS, élément
// absent, défilement bloqué) fait échouer la mise en ligne.
// Lancement : node tests/ui.test.js  (Playwright requis ; CHROME_PATH pour un Chromium déjà installé)
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { try { pw = require('playwright-core'); } catch (e2) { pw = require(process.env.PW_MODULE); } }
const ROOT = path.join(__dirname, '..'), FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/server.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

let count = 0, fails = 0;
function ok(name, cond, info) { count++; if (cond) console.log('ok     ' + name); else { fails++; console.log('ÉCHEC  ' + name + (info ? '\n        ' + info : '')); } }

// Site servi tel quel depuis le dépôt
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

// Faux serveur de données : cycles et vacations figés, le reste vide
const SENT = {};
function mockApi(route) {
  const u = new URL(route.request().url()), p = u.pathname; let body = {};
  try { SENT[p] = JSON.parse(route.request().postData() || 'null'); } catch (e) {}
  if (p === '/get-cycle' || p === '/cycles' || p === '/admin/cycles') body = { cycles: FIX.cycles };
  else if (p === '/get-vacations' || p === '/admin/vacations') body = { vacations: FIX.vacations };
  else if (p === '/admin/users') body = { users: [{ userId: 'a', name: 'Alice' }, { userId: 'b', name: 'Bob' }, { userId: 'c', name: 'Chloé' }] };
  else if (p === '/admin/lines') body = { lines: { S2: [{ userId: 'a', userName: 'Alice', profileName: 'Alice', weekVacs: [] }], S10: [{ userId: 'b', userName: 'Bob', profileName: 'Bob', pool: 'cadre', weekVacs: [] }] } };
  else if (p === '/pending-line-choice') body = { pending: [] };
  else if (p.startsWith('/swap/')) { const d = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
    body = { me: 'u1', offers: [{ id: 'o1', uid: 'b', name: 'Bob', date: d, vac: 'M1', hours: '6h00–13h00', kind: 'cede', note: 'Rendez-vous médical', at: Date.now(), answers: [], done: null },
      { id: 'o2', uid: 'u1', name: 'Test', date: d, vac: 'D2', hours: '13h00–20h00', kind: 'echange', note: '', at: Date.now(), answers: [{ uid: 'c', name: 'Chloé', msg: 'contre mon mardi', at: Date.now() }], done: null }] }; }
  else if (p === '/announce') body = { announce: { id: 't1', text: 'Message de test', pool: 'all', at: 0 } };
  else if (p === '/admin/line-choices') body = { choices: [{ cycle: { id: 'c', name: 'Cycle test', pool: 'antenne', startDate: '2026-08-31' }, pending: ['Alice'], done: ['Bob'] }] };
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

(async () => {
  await new Promise(r => server.listen(0, r)); const base = 'http://localhost:' + server.address().port;
  const browser = await pw.chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const errors = [];
  async function page(opts, init) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true }, opts || {}));
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.route(/workers\.dev/, mockApi);
    await p.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|google\.com|googleapis/, r => r.fulfill({ status: 200, body: '' }));
    return { ctx, p };
  }
  const login = () => { localStorage.setItem('auth_token', 'test'); localStorage.setItem('auth_user', JSON.stringify({ userId: 'u1', name: 'Test' })); };
  // geste du doigt : de y0 à y1 au milieu de l'écran
  async function swipe(p, y0, y1) {
    const c = await p.context().newCDPSession(p);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: y0 }] });
    for (let i = 1; i <= 8; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: y0 + (y1 - y0) * i / 8 }] }); await p.waitForTimeout(16); }
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
  }

  try {
    // ── Accueil du site : déjà connecté → directement l'app ──
    { const { ctx, p } = await page(null, login); await p.goto(base + '/'); await p.waitForURL(/\/app\//, { timeout: 5000 }).catch(() => {});
      ok('Accueil du site : connecté → app', /\/app\//.test(p.url()), p.url()); await ctx.close(); }

    // ── App ──
    const { ctx, p } = await page(null, login);
    await p.goto(base + '/app/'); await p.waitForTimeout(1500);
    // inscription éventuelle retirée : on teste l'app elle-même
    await p.evaluate(() => { const s = document.getElementById('setup'); if (s) s.remove(); if (!_aid) { _aid = 'p1'; _profs = { p1: S }; } render(); });
    ok('Calendrier affiché', await p.evaluate(() => document.querySelectorAll('#cal .dci[data-key]').length >= 28));
    await p.evaluate(() => { try { Object.keys(localStorage).filter(k => k.startsWith('pl_lsig')).forEach(k => localStorage.removeItem(k)); } catch (e) {} return _lineSync(); });
    ok('Tableau Gestion : fichier original envoyé à part', await p.evaluate(async () => { await _rhUpload(new File([new Uint8Array([80, 75, 3, 4, 1, 2])], 'tableau.xlsx')); return !!(S.profile.rhFile && S.profile.rhFile.name === 'tableau.xlsx'); }) && SENT['/file/rh/save'] && SENT['/file/rh/save'].b64 === 'UEsDBAEC', JSON.stringify(SENT['/file/rh/save']));
    // Prime fixe : mois de début au choix, arrêt à partir d'un mois choisi
    ok('Prime fixe : versée depuis un mois choisi', await p.evaluate(() => { openAddPrimeFixeModal(TODAY_YM, true); document.getElementById('_apf-label').value = 'Test'; document.getElementById('_apf-montant').value = '12';
      const sel = document.getElementById('_apf-debut'), v = TODAY_YM - 5; sel.value = String(v); sel.dispatchEvent(new Event('change')); _confirmAddPrimeFixe(TODAY_YM);
      const pf = S.profile.primesFixesCustom.find(x => x.label === 'Test'); return !!pf && pf.debutYM === v && getPrimesFixesCustomForYM(TODAY_YM - 5).includes(pf) && !getPrimesFixesCustomForYM(TODAY_YM - 6).includes(pf); }));
    ok('Prime fixe : arrêtée à partir d’un mois choisi', await p.evaluate(() => { const pf = S.profile.primesFixesCustom.find(x => x.label === 'Test'); openDeletePrimeFixeModal(pf.id, TODAY_YM);
      document.getElementById('_dpf-from').value = String(TODAY_YM - 2); _deletePrimeFixeFrom(pf.id, TODAY_YM, +document.getElementById('_dpf-from').value); const r = pf.finYM === TODAY_YM - 3;
      S.profile.primesFixesCustom = S.profile.primesFixesCustom.filter(x => x !== pf); closeModal(); return r; }));
    // Questions et messages dans l'app, plus de fenêtre du navigateur
    { let nat = 0; p.on('dialog', d => { nat++; d.dismiss(); });
      const r = await p.evaluate(async () => { const a = _ask('Question ?\n\nDétail', { ok: 'Oui' }); await new Promise(r => setTimeout(r, 50)); const el = document.getElementById('ask');
        const txt = el && el.querySelector('.ak-t').textContent + '|' + el.querySelector('.ak-m').textContent + '|' + el.querySelector('.ok').textContent; el.querySelector('.ok').click();
        const b = _ask('Montant', { input: '3' }); await new Promise(r => setTimeout(r, 50)); document.querySelector('#ask input').value = '4,5'; document.querySelector('#ask .ok').click();
        alert('Libellé requis.'); return [txt, await a, await b, document.getElementById('undo-toast').textContent]; });
      ok('Question dans l’app (titre, détail, réponse)', r[0] === 'Question ?|Détail|Oui' && r[1] === true && r[2] === '4,5' && r[3] === 'Libellé requis.', JSON.stringify(r));
      ok('Aucune fenêtre du navigateur', nat === 0); await p.waitForTimeout(300); }
    // Bourse aux échanges : liste de l'équipe, mes propositions, point rouge, proposition depuis le menu du jour
    { const r = await p.evaluate(async () => { localStorage.removeItem('swap_seen'); await _swapApi('/swap/list'); const dot = document.getElementById('swap-btn').classList.contains('sw-new');
        openSwaps(0); await new Promise(r => setTimeout(r, 300)); const team = [...document.querySelectorAll('#sw-list .swc')].map(e => e.textContent).join('|');
        _SW.tab = 1; _swapList(); const mine = document.querySelector('#sw-list .swc-a') && document.querySelector('#sw-list .swc-a').textContent;
        const dot2 = document.getElementById('swap-btn').classList.contains('sw-new'); closeModal();
        const k = Object.keys(document.querySelectorAll('#cal .dci[data-key]')).length && [...document.querySelectorAll('#cal .dci[data-key]')].map(e => e.dataset.key).find(k => k > dk(NOW) && getVac(new Date(k + 'T12:00:00')).vac && getVac(new Date(k + 'T12:00:00')).vac !== 'RH' && !(S.conges || {})[k]);
        _swapPostModal(k); const post = !!document.getElementById('sw-note'); document.getElementById('sw-k1').click(); await _swapPost(k, 'X', '');
        const sent = window._lastSwapBody; closeModal(); return [dot, team, mine, dot2, post, k]; });
      ok('Échanges : point rouge sur le bouton, effacé une fois la liste vue', r[0] && !r[3], JSON.stringify([r[0], r[3]]));
      ok('Échanges : jour proposé par l’équipe (cédé, nom, ma vacation ce jour-là)', /Cédé/.test(r[1]) && /Bob/.test(r[1]) && /Ce jour-là, vous/.test(r[1]) && /Je le prends/.test(r[1]), r[1]);
      ok('Échanges : réponses à mes propositions, avec Choisir', /Chloé/.test(r[2] || '') && /Choisir/.test(r[2] || ''), r[2]);
      ok('Échanges : proposer un jour (cédé) envoie la date', r[4] && SENT['/swap/post'] && SENT['/swap/post'].date === r[5] && SENT['/swap/post'].kind === 'cede' && SENT['/swap/post'].pool === 'antenne', JSON.stringify(SENT['/swap/post'])); }
    // Barre d'onglets (téléphone) : l'onglet allumé suit la fenêtre ouverte ; Planning ferme la fenêtre
    { const r = await p.evaluate(async () => { const on = () => [...document.querySelectorAll('#tabbar button.on')].map(b => b.dataset.t).join(); const w = ms => new Promise(r => setTimeout(r, ms));
        _tbGo('suivi'); await w(150); const a = on(); _tbGo('set'); await w(150); const b = on(); _tbGo('cal'); await w(150); return [getComputedStyle(document.getElementById('tabbar')).display, a, b, on(), !!document.querySelector('#modal-root .overlay')]; });
      ok('Barre d’onglets : Suivi, Réglages puis retour au planning', r[0] === 'flex' && r[1] === 'suivi' && r[2] === 'set' && r[3] === 'cal' && !r[4], JSON.stringify(r)); }
    // Navigation (téléphone) : pages d'onglet, sous-pages (titre et retour dans l'en-tête, arrivée par la droite), petites fenêtres par-dessus
    { const r = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), B = document.body.classList, ov = () => document.querySelector('#modal-root .overlay');
        const st = () => [B.contains('tb-pg') ? 'pg' : '', B.contains('tb-sub') ? 'sub' : '', B.contains('tb-sheet') ? 'sheet' : '', [...document.querySelectorAll('#tabbar button.on')].map(b => b.dataset.t).join(), ov() ? ['tbpush', 'tbpop'].filter(c => ov().classList.contains(c)).join() : '-', document.getElementById('tb-title').textContent, document.getElementById('tb-back').lastChild.textContent].join('/');
        const out = {}; _tbGo('suivi'); await w(80); out.suivi = st();
        out.cards = document.querySelectorAll('#sv-root .svr-b').length; document.querySelectorAll('#sv-root .svr-b')[0].click(); await w(80); out.ctrl = st();
        openBulletinsCal(NOW.getFullYear()); await w(80); out.bul = st();
        _tbBack(); await w(80); out.back1 = st(); _tbBack(); await w(80); out.back = st();
        _tbGo('set'); await w(80); out.set = st();
        openHdrMenu(); const menu = [...document.querySelectorAll('#lp-menu button')].map(b => b.textContent.trim()).join(','); _closeDayMenu(); await w(200); out.menu = menu;
        _ask('Question ?', { ok: 'Oui' }); await w(80); out.ask = st(); document.querySelector('#ask .ok').click(); await w(80);
        _tbGo('cal'); await w(80); out.home = st();
        openHdrMenu(); out.menuHome = document.querySelectorAll('#lp-menu button').length; _closeDayMenu(); await w(200);
        openMergedMoisModal(TODAY_YM); await w(80); out.vars = st();
        _tbBack(); await w(80); out.varsBack = [st(), !!ov()].join('|');
        openDay([...document.querySelectorAll('#cal .dci[data-key]')][10].dataset.key); await w(80); out.day = st(); closeModal(); await w(80);
        return out; });
      ok('Navigation : page Suivi (onglet allumé, titre)', /^pg\/\/\/suivi\/.*\/Suivi\//.test(r.suivi), r.suivi);
      ok('Navigation : page Suivi = trois cases, Contrôle en sous-page (retour « Suivi »)', r.cards === 3 && /^pg\/sub\/\/suivi\/tbpush\/Contrôle\/Suivi$/.test(r.ctrl), r.cards + ' ' + r.ctrl);
      ok('Navigation : sous-page Paie depuis Contrôle (arrive par la droite, retour « Contrôle »)', /^pg\/sub\/\/suivi\/tbpush\/Paie/.test(r.bul) && /\/Contrôle$/.test(r.bul), r.bul);
      ok('Navigation : retour de Paie à Contrôle (revient de la gauche)', /^pg\/sub\/\/suivi\/tbpop\/Contrôle\//.test(r.back1), r.back1);
      ok('Navigation : retour à la page Suivi (revient de la gauche)', /^pg\/\/\/suivi\/tbpop\/Suivi\//.test(r.back), r.back);
      ok('Navigation : page Réglages', /^pg\/\/\/set\//.test(r.set), r.set);
      ok('Navigation : menu réduit hors de l’accueil (annuler, rétablir, historique)', r.menu === 'Annuler,Rétablir,Historique' && r.menuHome > 3, r.menu + ' | ' + r.menuHome);
      ok('Navigation : question par-dessus une page (la page reste, barre masquée)', /^pg\/\/\/set\//.test(r.ask), r.ask);
      ok('Navigation : accueil (rien d’ouvert)', /^\/\/\/cal\/-/.test(r.home), r.home);
      ok('Navigation : Variables, sous-page de l’Accueil, retour à l’accueil', /^pg\/sub\/\/cal\/tbpush\/Variables/.test(r.vars) && /\/Accueil$/.test(r.vars) && /^\/\/\/cal\/-\/.*\|false$/.test(r.varsBack), r.vars + ' → ' + r.varsBack);
      ok('Navigation : fiche du jour = petite fenêtre (barre masquée)', /^\/\/sheet\//.test(r.day), r.day); }
    // Recherche dans l'historique
    ok('Historique : recherche (sans accents)', await p.evaluate(() => { const h = S.history; S.history = [{ t: '01/10', d: 'Mercredi 1 octobre -> Été', c: '#fff' }, { t: '02/10', d: 'Jeudi 2 octobre -> A1', c: '#fff' }, { t: '03/10', d: 'x', c: '#fff' }, { t: '04/10', d: 'y', c: '#fff' }, { t: '05/10', d: 'z', c: '#fff' }, { t: '06/10', d: 'w', c: '#fff' }];
      openHistModal(); const q = document.getElementById('hist-q'); q.value = 'ete'; _histList(); const n = document.querySelectorAll('#hist-l .hrow').length; q.value = 'jeudi a1'; _histList(); const n2 = document.querySelectorAll('#hist-l .hrow').length; S.history = h; closeModal(); return n === 1 && n2 === 1; }));
    // Vacation changée puis remise à celle du cycle : plus de modification
    ok('Vacation remise à celle du cycle : plus de modification', await p.evaluate(() => { const k = [...document.querySelectorAll('#cal .dci[data-key]')].map(e => e.dataset.key).find(k => k > dk(NOW) && !(S.overrides || {})[k] && getVac(new Date(k + 'T12:00:00')).vac && getVac(new Date(k + 'T12:00:00')).vac !== 'RH');
      const cv = getCycleVac(new Date(k + 'T12:00:00')).cycleVac, other = Object.keys(getVAC(new Date(k + 'T12:00:00'))).find(v => v !== cv && v !== 'RH' && v !== 'SV');
      pendingKey = k; avw(other); const a = !!S.overrides[k]; pendingKey = k; avw(cv); const b = !(S.overrides || {})[k];
      S.overrides[k] = { vac: cv, fromSV: false, echange: false, hs: false, formation: false }; const c = _ovCleanSame() === 1 && !S.overrides[k]; return a && b && c; }));
    ok('Horaires saisis identiques à la vacation du cycle : plus de modification', await p.evaluate(() => { const k = [...document.querySelectorAll('#cal .dci[data-key]')].map(e => e.dataset.key).find(k => k > dk(NOW) && !(S.overrides || {})[k] && getVac(new Date(k + 'T12:00:00')).vac && getVac(new Date(k + 'T12:00:00')).vac !== 'RH');
      const d = new Date(k + 'T12:00:00'), cv = getCycleVac(d).cycleVac, ci = getVAC(d)[cv], other = Object.keys(getVAC(d)).find(v => v !== cv && v !== 'RH' && v !== 'SV');
      pendingKey = k; avw(other); const a = !!S.overrides[k]; pendingKey = k; openCustomVacModal();
      document.getElementById('custom-deb').value = ci.deb; document.getElementById('custom-fin').value = ci.fin; confirmCustomVac(); const b = !(S.overrides || {})[k]; closeModal(); return a && b; }));
    const lr = SENT['/lines/register'];
    if (process.env.SHOW) console.log(JSON.stringify(lr));
    ok('Ligne de la semaine envoyée au serveur', lr && /^S\d+$/.test(lr.ligne) && lr.pool && lr.weekVacs.length === 7, JSON.stringify(lr));
    // PC : flèches du clavier, Échap, glissé à deux doigts sur le pavé tactile, glisser à la souris
    await p.waitForTimeout(1500); await p.evaluate(() => { if (document.querySelector('#modal-root .overlay')) closeModal(); }); await p.waitForTimeout(400); // message à tous éventuel
    // Téléphone : premier appui sur un bouton de l'en-tête → bulle avec son nom ; Sirhius ne s'ouvre qu'au deuxième appui
    { const r = await p.evaluate(async () => { let opened = 0; const o = window.openExternalUrl; window.openExternalUrl = () => { opened++; };
        const b = document.querySelector('.ibtn[data-ext]'); b.click(); await new Promise(z => setTimeout(z, 100)); const t = (document.getElementById('tip-bub') || {}).textContent || '';
        const o1 = opened; b.click(); window.openExternalUrl = o; return [/Sirhius/.test(t), o1, opened]; });
      ok('En-tête : nom au premier appui, ouverture au suivant', r[0] && r[1] === 0 && r[2] === 1, JSON.stringify(r)); }
    { const m0 = await p.evaluate(() => curY * 12 + curM);
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1300);
      const m1 = await p.evaluate(() => curY * 12 + curM);
      await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1300);
      const m2 = await p.evaluate(() => curY * 12 + curM);
      await p.evaluate(() => { const r = document.getElementById('month-view').getBoundingClientRect(); document.getElementById('cal').dispatchEvent(new WheelEvent('wheel', { deltaX: 80, deltaY: 2, bubbles: true, cancelable: true, clientX: r.left + 50, clientY: r.top + 50 })); });
      await p.waitForTimeout(1300); const m3 = await p.evaluate(() => curY * 12 + curM);
      ok('PC : flèches et pavé tactile changent de mois', m1 === m0 + 1 && m2 === m0 && m3 === m0 + 1, [m0, m1, m2, m3].join(','));
      await p.evaluate(() => navDir(-1)); await p.waitForTimeout(1300);
      await p.evaluate(() => openSettingsModal(0)); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      ok('PC : Échap ferme la fenêtre', await p.evaluate(() => !document.querySelector('#modal-root .overlay'))); }

    // fiche du jour, Modifier
    const day = await p.evaluate(() => { const k = dk(NOW); pendingKey = k; openDay(k); return !!document.querySelector('#modal-root .dbox'); });
    ok('Fiche du jour', day);
    const mod = await p.evaluate(() => { openCustomVacModal(); const d = document.getElementById('custom-deb'), f = document.getElementById('custom-fin');
      if (!d || !f) return false; d.value = '06h00'; f.value = '14h00'; d.dispatchEvent(new Event('change')); return !!document.getElementById('cv-motif-sel') && !!document.getElementById('cv-calc').textContent; });
    ok('Modifier : horaires et calcul', mod);
    await p.evaluate(() => closeModal());

    // réglages : 3 onglets, défilement au doigt
    await p.evaluate(() => openSettingsModal(0)); await p.waitForTimeout(400);
    const tabs = await p.evaluate(() => [0, 1, 2].every(i => { settingsTab(i); return document.getElementById('stc-' + i).style.display !== 'none'; }));
    ok('Réglages : trois onglets', tabs);
    await p.evaluate(() => settingsTab(1)); await p.waitForTimeout(200);
    const sc = await p.evaluate(() => { const b = document.querySelector('.stabs-body'); return b.scrollHeight > b.clientHeight + 20; });
    if (sc) { await swipe(p, 600, 250); ok('Réglages : défilement au doigt', await p.evaluate(() => document.querySelector('.stabs-body').scrollTop > 0)); }
    else ok('Réglages : défilement au doigt (contenu assez long pour défiler)', false, 'contenu trop court pour tester');
    await p.evaluate(() => closeModal());

    // message de l'admin : une fois
    await p.evaluate(() => { closeModal(); delete S.profile.annSeen; return _checkAnnounce(); }); await p.waitForTimeout(300);
    ok('Message de l’admin affiché', await p.evaluate(() => /Message de test/.test(document.getElementById('modal-root').textContent)));
    await p.evaluate(() => { const b = [...document.querySelectorAll('#modal-root button')].find(x => x.textContent === 'OK'); b.click(); });
    await p.evaluate(() => _checkAnnounce()); await p.waitForTimeout(300);
    ok('Message de l’admin : pas deux fois', await p.evaluate(() => !document.getElementById('modal-root').innerHTML));

    // deux appareils : le serveur refuse (autre appareil passé avant), l'app fusionne puis renvoie
    { const bodies = [];
      await p.route(/workers\.dev\/data\/save/, route => { const b = JSON.parse(route.request().postData()); bodies.push(b);
        if (bodies.length === 1) { const remote = JSON.parse(JSON.stringify(b.data)); remote.notes = Object.assign({}, remote.notes, { '2026-12-01': 'autre appareil' }); remote.profile = Object.assign({}, remote.profile, { _lastSaved: Date.now() + 60000 });
          route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'conflict', rev: 'r1', data: remote }) }); }
        else route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rev: 'r2' }) }); });
      const merged = await p.evaluate(async () => { const pid = _aid; _cbase[pid] = { rev: 'r0', str: JSON.stringify(S) };
        S.notes = Object.assign({}, S.notes, { '2026-12-02': 'ici' }); try { localStorage.removeItem(_syncKey(pid)); } catch (e) {}
        await cloudSave(pid); return [S.notes['2026-12-01'], S.notes['2026-12-02'], _cbase[pid].rev]; });
      ok('Deux appareils : fusion des deux modifications', merged[0] === 'autre appareil' && merged[1] === 'ici', JSON.stringify(merged));
      ok('Deux appareils : envoi sur la version du serveur', bodies.length === 2 && bodies[0].base === 'r0' && !bodies[1].base && merged[2] === 'r2', JSON.stringify(bodies.map(b => b.base)));
      await p.unroute(/workers\.dev\/data\/save/); }
    // lecture en retard du serveur (version plus ancienne que celle de départ) : pas de fusion, rien ne revient en arrière
    { const bodies = [];
      await p.route(/workers\.dev\/data\/save/, route => { const b = JSON.parse(route.request().postData()); bodies.push(b);
        if (bodies.length === 1) { const old = JSON.parse(JSON.stringify(b.data)); old.notes = {}; old.profile = Object.assign({}, old.profile, { _lastSaved: 1 });
          route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'conflict', rev: 'old', data: old }) }); }
        else route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rev: 'r3' }) }); });
      const kept = await p.evaluate(async () => { const pid = _aid; S.profile._lastSaved = Date.now(); _cbase[pid] = { rev: 'r2', str: JSON.stringify(S) };
        S.notes = Object.assign({}, S.notes, { '2026-12-03': 'encore ici' }); try { localStorage.removeItem(_syncKey(pid)); } catch (e) {}
        await cloudSave(pid); return [S.notes['2026-12-02'], S.notes['2026-12-03']]; });
      ok('Deux appareils : version en retard du serveur ignorée', kept[0] === 'ici' && kept[1] === 'encore ici' && bodies.length === 2, JSON.stringify(kept));
      await p.unroute(/workers\.dev\/data\/save/); }

    // Suivi
    const sv = await p.evaluate(() => { openMergedRenduCgModal(6, 2); return (document.getElementById('modal-root').textContent || '').length > 50; });
    ok('Suivi', sv); await p.evaluate(() => closeModal());

    // règles de travail : repos trop court → alerte dans la fiche et liseré sur le calendrier
    const rule = await p.evaluate(() => {
      const V = getVAC(NOW); let late = null, early = null;
      Object.keys(V).forEach(n => { const v = V[n]; if (!v.deb || !(v.dur > 0)) return; const a = _toMinApp(v.deb), b = _toMinApp(v.fin); if (b < a && !late) late = n; if (a < 240 && !early) early = n; });
      let base = null; for (let i = 0; i < 30 && !base; i++) { const d = new Date(NOW); d.setDate(d.getDate() + i); const d2 = new Date(d); d2.setDate(d.getDate() + 1); if (_shiftOf(d) && _shiftOf(d2)) base = dk(d); }
      const k2 = dk(_dAdd(base, 1)); S.overrides = S.overrides || {}; S.overrides[base] = { vac: late, fromSV: false, echange: false }; S.overrides[k2] = { vac: early, fromSV: false, echange: false };
      curY = new Date(k2 + 'T12:00:00').getFullYear(); curM = new Date(k2 + 'T12:00:00').getMonth(); render(); pendingKey = k2; openDay(k2);
      const r = [!!document.querySelector('#modal-root .rule-note'), !!document.querySelector('#cal .rule-bad')];
      delete S.overrides[base]; delete S.overrides[k2]; closeModal(); render(); return r; });
    ok('Repos trop court : alerte dans la fiche', rule[0]); ok('Repos trop court : liseré sur le calendrier', rule[1]);
    await ctx.close();

    // ── iPhone à l'horizontale : reste la version iPhone (barre d'onglets, pages), calendrier à gauche et soldes à droite ──
    { const { ctx, p } = await page({ viewport: { width: 844, height: 390 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, login);
      await p.goto(base + '/app/'); await p.waitForTimeout(1500);
      const r = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
        const cal = document.querySelector('#month-view .cal-wrap').getBoundingClientRect(), side = document.getElementById('side-v2').getBoundingClientRect(), bar = document.getElementById('tabbar');
        const o = { phone: _isPhone(), side: side.left >= cal.right - 2, fits: cal.bottom <= innerHeight, bar: getComputedStyle(bar).display === 'flex', barOk: bar.getBoundingClientRect().bottom <= document.querySelector('.hdr').getBoundingClientRect().bottom + 2 };
        _tbGo('suivi'); await w(150); o.page = document.body.classList.contains('tb-pg'); _tbGo('cal'); await w(100); return o; });
      ok('iPhone à l’horizontale : version iPhone, calendrier à gauche, soldes à droite, onglets dans l’en-tête', /\/app\/$/.test(p.url()) && r.phone && r.side && r.fits && r.bar && r.barOk && r.page, p.url() + ' ' + JSON.stringify(r));
      await ctx.close(); }

    // ── Version PC : grand écran → page PC (calendrier à gauche, panneau à droite), pages dans le panneau ──
    { const { ctx, p } = await page({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }, login);
      await p.goto(base + '/app/'); await p.waitForURL(/\/app\/pc\//, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(1500);
      ok('PC : grand écran → version PC', /\/app\/pc\//.test(p.url()), p.url());
      const r = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
        const cal = document.querySelector('.cal-wrap').getBoundingClientRect(), pan = document.getElementById('pc-panel').getBoundingClientRect();
        out.side = pan.left > cal.right && Math.abs(pan.top - cal.top) < 80; out.fits = cal.bottom <= innerHeight;
        const on = () => [...document.querySelectorAll('#pc-tabs .on')].map(b => b.dataset.p).join();
        out.tabs = [];for (const t of ['suivi', 'rendus', 'conges', 'set', 'home']) { pcTab(t); await w(120); out.tabs.push(on() + (document.querySelector('#modal-root .overlay') ? '+' : '-')); }
        const k = [...document.querySelectorAll('#cal .dci[data-key]')][12].dataset.key; document.querySelector('#cal .dci[data-key="' + k + '"]').click(); await w(150);
        const ov = document.querySelector('#modal-root .overlay'), r2 = ov && ov.getBoundingClientRect();
        out.day = !!(ov && ov.querySelector('.sheet.daymod') && r2.left >= pan.left - 2 && getComputedStyle(ov).position === 'static');
        out.cal = document.querySelectorAll('#cal .dci[data-key]').length;
        const t0 = document.getElementById('mtit').textContent; navDir(1); await w(50); out.month = [t0 !== document.getElementById('mtit').textContent, document.querySelectorAll('#month-view .cal-wrap').length];
        return out; });
      ok('PC : panneau à droite du calendrier, calendrier entier à l’écran', r.side && r.fits, JSON.stringify(r));
      ok('PC : onglets du panneau (Contrôle, Rendus, Congés, Réglages, Soldes)', r.tabs.join() === 'suivi+,rendus+,conges+,set+,home-', r.tabs.join());
      ok('PC : fiche du jour dans le panneau', r.day, JSON.stringify(r));
      ok('PC : mois suivant sur place (un seul calendrier)', r.month[0] && r.month[1] === 1, JSON.stringify(r.month));
      await ctx.close(); }

    // ── Admin ──
    { const { ctx, p } = await page({ viewport: { width: 1200, height: 900 }, isMobile: false, hasTouch: false }, () => { sessionStorage.setItem('admin_token', 'test'); });
      await p.goto(base + '/admin/'); await p.waitForTimeout(1200);
      await p.evaluate(() => switchTab('users')); await p.waitForTimeout(600);
      ok('Admin : message à tous et choix de ligne', await p.evaluate(() => { const t = document.getElementById('adm-extra').textContent; return /Message à tous/.test(t) && /1\/2 ont choisi/.test(t) && /Alice/.test(t); }));
      await p.evaluate(() => switchTab('lines')); await p.waitForTimeout(600);
      ok('Admin : lignes par équipe et comptes sans ligne', await p.evaluate(() => { const t = document.getElementById('lines-grid').textContent; return /Antenne/.test(t) && /Cadre/.test(t) && /Pas encore de ligne connue \(1\) : Chloé/.test(t); }));
      await p.evaluate(() => switchTab('vacations')); await p.waitForTimeout(800);
      ok('Admin : vacations d’un cycle', await p.evaluate(() => document.querySelectorAll('#vac-list .vrow').length > 0));
      await p.evaluate(() => switchVacHors()); await p.waitForTimeout(200);
      ok('Admin : autres vacations', await p.evaluate(() => document.querySelectorAll('#vac-list .vrow').length > 0));
      ok('Admin : vacations hors grille proposées à personne signalées', await p.evaluate(() => { const n = Object.keys(_allVacs).find(k => !_allGridCodes().has(k) && k !== 'RH'); const sv = _allVacs[n].pools; _allVacs[n].pools = []; renderVacList(); const r = /Proposée[s]? à personne/.test(document.getElementById('vac-list').textContent); _allVacs[n].pools = sv; renderVacList(); return r; }));
      const ed = await p.evaluate(() => { const n = Object.keys(_allVacs)[0]; editVac(n); return document.getElementById('vac-modal-bg').style.display === 'flex'; });
      ok('Admin : ouvrir une vacation', ed);
      ok('Admin : supprimer une vacation de grille bloqué', await p.evaluate(async () => { const g = [..._allGridCodes()].find(n => _allVacs[n]); closeVacForm(); editVac(g);
        const b = document.getElementById('vf-del-btn'); if (b.style.display === 'none') return false; await deleteVac(g); return /Impossible/.test(document.getElementById('vf-err').textContent); }));
      await p.evaluate(() => { closeVacForm(); switchTab('cycles'); }); await p.waitForTimeout(600);
      ok('Admin : bouton cycles coordination passés', await p.evaluate(() => { switchPool('coord'); const b = [...document.querySelectorAll('#cycles-list button')].some(x => /2025-2026 et Été 2026/.test(x.textContent)); switchPool('antenne'); return b; }));
      ok('Admin : cycles', await p.evaluate(() => document.querySelectorAll('#cycles-list .cycle-card').length > 0));
      await ctx.close(); }
    // iPhone (iOS 26.5+) : interrupteur invisible glissé sous le doigt dans le bouton ; l'action du bouton part une fois
    { const { ctx, p } = await page({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' },
        () => { localStorage.setItem('auth_token', 'test'); localStorage.setItem('auth_user', JSON.stringify({ userId: 'u1', name: 'Test' })); Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true }); });
      await p.goto(base + '/app/'); await p.waitForTimeout(1500);
      await p.evaluate(() => { const s = document.getElementById('setup'); if (s) s.remove(); document.body.classList.remove('su-on'); closeModal();
        document.getElementById('modal-root').innerHTML = '<div class="overlay"><div class="sheet"><button class="mb" id="hb" onclick="window._hb=(window._hb||0)+1" style="width:200px;height:44px">Test</button></div></div>'; });
      await p.waitForTimeout(150); const pre = await p.evaluate(() => !!document.querySelector('#hb>.hap-sw[switch]'));
      await p.tap('#hb'); await p.waitForTimeout(200);
      const r = await p.evaluate(() => [window._hb, !!document.querySelector('#hb>.hap-sw[switch]'), Date.now() - (window._hapAt || 0) < 2000]);
      ok('iPhone : interrupteur posé dans le bouton avant l’appui, basculé par le doigt (vibration), action faite une fois', pre && r[0] === 1 && r[1] && r[2], JSON.stringify([pre].concat(r)));
      await ctx.close(); }
  } catch (e) { ok('Tests des écrans sans exception', false, e.stack); }

  ok('Aucune erreur JavaScript', !errors.length, errors.slice(0, 5).join('\n        '));
  await browser.close(); server.close();
  console.log('\n' + (count - fails) + '/' + count + ' contrôles réussis');
  process.exit(fails ? 1 : 0);
})();
