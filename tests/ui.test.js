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
function mockApi(route) {
  const u = new URL(route.request().url()), p = u.pathname; let body = {};
  if (p === '/get-cycle' || p === '/cycles' || p === '/admin/cycles') body = { cycles: FIX.cycles };
  else if (p === '/get-vacations' || p === '/admin/vacations') body = { vacations: FIX.vacations };
  else if (p === '/admin/users') body = { users: [] };
  else if (p === '/pending-line-choice') body = { pending: [] };
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

    // ── Admin ──
    { const { ctx, p } = await page({ viewport: { width: 1200, height: 900 }, isMobile: false, hasTouch: false }, () => { sessionStorage.setItem('admin_token', 'test'); });
      await p.goto(base + '/admin/'); await p.waitForTimeout(1200);
      await p.evaluate(() => switchTab('users')); await p.waitForTimeout(600);
      ok('Admin : message à tous et choix de ligne', await p.evaluate(() => { const t = document.getElementById('adm-extra').textContent; return /Message à tous/.test(t) && /1\/2 ont choisi/.test(t) && /Alice/.test(t); }));
      await p.evaluate(() => switchTab('vacations')); await p.waitForTimeout(800);
      ok('Admin : vacations d’un cycle', await p.evaluate(() => document.querySelectorAll('#vac-list .vrow').length > 0));
      await p.evaluate(() => switchVacTab('none')); await p.waitForTimeout(200);
      ok('Admin : autres vacations', await p.evaluate(() => document.querySelectorAll('#vac-list .vrow').length > 0));
      const ed = await p.evaluate(() => { const n = Object.keys(_allVacs)[0]; editVac(n); return document.getElementById('vac-modal-bg').style.display === 'flex'; });
      ok('Admin : ouvrir une vacation', ed);
      await p.evaluate(() => { closeVacForm(); switchTab('cycles'); }); await p.waitForTimeout(600);
      ok('Admin : cycles', await p.evaluate(() => document.querySelectorAll('#cycles-list .cycle-card').length > 0));
      await ctx.close(); }
  } catch (e) { ok('Tests des écrans sans exception', false, e.stack); }

  ok('Aucune erreur JavaScript', !errors.length, errors.slice(0, 5).join('\n        '));
  await browser.close(); server.close();
  console.log('\n' + (count - fails) + '/' + count + ' contrôles réussis');
  process.exit(fails ? 1 : 0);
})();
