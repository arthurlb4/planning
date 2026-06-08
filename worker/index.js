// Cloudflare Worker: planning-gcal v3
// Auth + Calendar + Data sync + Admin + Cycles

const CLIENT_ID = '669191513748-a40uvl9k46kqsmjatpqokhnhgvrc7mdt.apps.googleusercontent.com';
const ALLOWED_ORIGIN = 'https://arthurlb4.github.io';
const ADMIN_PASSWORD_HASH_KEY = 'admin:password_hash'; // stored in KV

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

function resp(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: cors });
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

function randToken(len) {
  const arr = new Uint8Array(len || 32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

function getMondayKey(ts) {
  var d = new Date(ts || Date.now());
  var day = d.getUTCDay();
  var diff = day === 0 ? -6 : 1 - day;
  var mon = new Date(d.getTime() + diff * 86400000);
  return mon.toISOString().slice(0, 10);
}

async function verifySession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const session = await env.PLANNING_DB.get('session:' + token, { type: 'json' });
  if (!session) return null;
  if (session.expires < Date.now()) { await env.PLANNING_DB.delete('session:' + token); return null; }
  return session;
}

async function verifyAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return false;
  const session = await env.PLANNING_DB.get('admin_session:' + token, { type: 'json' });
  if (!session) return false;
  if (session.expires < Date.now()) { await env.PLANNING_DB.delete('admin_session:' + token); return false; }
  return true;
}

async function refreshGToken(refresh_token, env) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refresh_token, client_id: CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }),
  });
  return res.json();
}

async function calApi(method, path, data, token, refresh_token, env) {
  const base = 'https://www.googleapis.com/calendar/v3';
  var opts = { method: method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
  if (data) opts.body = JSON.stringify(data);
  var res = await fetch(base + path, opts);
  var newToken = null;
  if (res.status === 401 && refresh_token) {
    var r = await refreshGToken(refresh_token, env);
    if (r.access_token) {
      newToken = r.access_token;
      opts.headers['Authorization'] = 'Bearer ' + newToken;
      res = await fetch(base + path, opts);
    }
  }
  var text = await res.text();
  var json;
  try { json = JSON.parse(text); } catch(e) { json = { _raw: text }; }
  return { status: res.status, data: json, newToken: newToken };
}

// Send up to 50 ops in one multipart batch request to the Google Calendar Batch API.
// Returns { newToken, statuses[], ops409[] } where ops409 are create ops that got 409 (cancelled event).
async function gcalBatchRequest(ops, calId, token, refresh_token, env) {
  const boundary = 'gcalbatch' + Date.now().toString(36);
  const calBase = '/calendar/v3/calendars/' + encodeURIComponent(calId) + '/events';
  var body = '';
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    var evData = Object.assign({}, op.event, { id: op.googleEventId });
    var method, reqPath, reqBody;
    if (op.type === 'delete') {
      method = 'DELETE'; reqPath = calBase + '/' + op.googleEventId; reqBody = null;
    } else if (op.type === 'update') {
      method = 'PUT'; reqPath = calBase + '/' + op.googleEventId; reqBody = JSON.stringify(evData);
    } else {
      method = 'POST'; reqPath = calBase; reqBody = JSON.stringify(evData);
    }
    body += '--' + boundary + '\r\n';
    body += 'Content-Type: application/http\r\nContent-ID: op' + i + '\r\n\r\n';
    body += method + ' ' + reqPath + ' HTTP/1.1\r\n';
    if (reqBody) {
      body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + reqBody + '\r\n';
    } else {
      body += '\r\n';
    }
  }
  body += '--' + boundary + '--';

  async function doFetch(tok) {
    return fetch('https://www.googleapis.com/batch/calendar/v3', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'multipart/mixed; boundary=' + boundary },
      body: body,
    });
  }

  var res = await doFetch(token);
  var newToken = null;
  if (res.status === 401 && refresh_token) {
    var rt = await refreshGToken(refresh_token, env);
    if (rt.access_token) { newToken = rt.access_token; res = await doFetch(newToken); }
  }
  if (res.status === 429) {
    await new Promise(function(r){ setTimeout(r, 5000); });
    res = await doFetch(newToken || token);
  }

  // Parse multipart response to extract individual statuses
  var respText = await res.text();
  var ctHeader = res.headers.get('content-type') || '';
  var bMatch = ctHeader.match(/boundary=([^\s;,]+)/);
  var statuses = [];
  var ops409 = [];
  if (bMatch) {
    var resBoundary = bMatch[1];
    var parts = respText.split('--' + resBoundary);
    for (var p = 1; p < parts.length; p++) {
      var part = parts[p];
      if (part.trim() === '--') break;
      var sm = part.match(/HTTP\/[\d.]+ (\d+)/);
      var pStatus = sm ? parseInt(sm[1]) : 0;
      statuses.push(pStatus);
      if (pStatus === 409 && ops[p - 1] && ops[p - 1].type === 'create') {
        ops409.push(ops[p - 1]);
      }
    }
  }
  return { newToken: newToken, statuses: statuses, ops409: ops409 };
}

// Process all ops using the batch API, splitting into groups of 50.
async function gcalBatchOps(ops, calId, token, refresh_token, env) {
  var currentToken = token;
  var failed = 0;
  var allOps409 = [];
  const BATCH = 50;
  for (var i = 0; i < ops.length; i += BATCH) {
    var batch = ops.slice(i, i + BATCH);
    try {
      var result = await gcalBatchRequest(batch, calId, currentToken, refresh_token, env);
      if (result.newToken) currentToken = result.newToken;
      for (var j = 0; j < result.statuses.length; j++) {
        var s = result.statuses[j];
        if (s >= 400 && s !== 404 && s !== 410 && s !== 409) failed++;
      }
      if (result.ops409 && result.ops409.length) allOps409 = allOps409.concat(result.ops409);
    } catch(e) { failed += batch.length; }
    if (i + BATCH < ops.length) await new Promise(function(r){ setTimeout(r, 300); });
  }
  // Retry 409 creates: the event exists as cancelled in Google — PATCH with status:confirmed to restore it
  const calEvPath = '/calendars/' + encodeURIComponent(calId) + '/events/';
  for (var k = 0; k < allOps409.length; k++) {
    var op409 = allOps409[k];
    try {
      var patchData = Object.assign({}, op409.event, { id: op409.googleEventId, status: 'confirmed' });
      var pr = await calApi('PATCH', calEvPath + op409.googleEventId, patchData, currentToken, refresh_token, env);
      if (pr.newToken) currentToken = pr.newToken;
      if (pr.status >= 400) failed++;
    } catch(e) { failed++; }
  }
  return { newToken: currentToken !== token ? currentToken : null, failed: failed };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
    var url = new URL(request.url);
    var path = url.pathname;
    var body = await request.json().catch(function(){ return {}; });

    // ============================================================
    // ADMIN ROUTES
    // ============================================================

    if (path === '/admin/login') {
      var pwd = body.password;
      if (!pwd) return resp({ error: 'Mot de passe manquant' }, 400);
      var storedHash = await env.PLANNING_DB.get(ADMIN_PASSWORD_HASH_KEY);
      if (!storedHash) {
        var defaultPwd = env.ADMIN_PASSWORD || 'admin123';
        storedHash = await sha256(defaultPwd);
        await env.PLANNING_DB.put(ADMIN_PASSWORD_HASH_KEY, storedHash);
      }
      var pwdHash = await sha256(pwd);
      if (pwdHash !== storedHash) return resp({ error: 'Mot de passe incorrect' }, 401);
      var token = randToken();
      await env.PLANNING_DB.put('admin_session:' + token, JSON.stringify({ expires: Date.now() + 8 * 60 * 60 * 1000 }), { expirationTtl: 8 * 60 * 60 });
      return resp({ token: token });
    }

    if (path === '/admin/users') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var list = await env.PLANNING_DB.list({ prefix: 'user:' });
      var users = [];
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      var userLinesIdx = {};
      for (var l in linesMap) {
        for (var e of linesMap[l]) {
          if (!userLinesIdx[e.userId]) userLinesIdx[e.userId] = [];
          userLinesIdx[e.userId].push({ ligne: l, profileId: e.profileId, name: e.profileName || e.profileId, weekVacs: e.weekVacs || [] });
        }
      }
      for (var key of list.keys) {
        if (key.name.startsWith('user:email:')) continue;
        var user = await env.PLANNING_DB.get(key.name, { type: 'json' });
        if (!user) continue;
        users.push({ userId: user.userId, email: user.email, name: user.name, createdAt: user.createdAt, profiles: user.profiles || {}, linesUsed: userLinesIdx[user.userId] || [] });
      }
      return resp({ users: users });
    }

    if (path === '/admin/reset-password') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var userId = body.userId, newPassword = body.newPassword;
      if (!userId || !newPassword) return resp({ error: 'Donnees manquantes' }, 400);
      var user = await env.PLANNING_DB.get('user:' + userId, { type: 'json' });
      if (!user) return resp({ error: 'Utilisateur introuvable' }, 404);
      user.pwHash = await sha256(newPassword + userId);
      await env.PLANNING_DB.put('user:' + userId, JSON.stringify(user));
      return resp({ ok: true });
    }

    if (path === '/admin/delete-user') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var userId = body.userId;
      if (!userId) return resp({ error: 'UserId manquant' }, 400);
      var user = await env.PLANNING_DB.get('user:' + userId, { type: 'json' });
      if (!user) return resp({ error: 'Utilisateur introuvable' }, 404);
      await env.PLANNING_DB.delete('user:email:' + user.email);
      await env.PLANNING_DB.delete('user:' + userId);
      if (user.profiles) {
        for (var pid of Object.keys(user.profiles)) {
          await env.PLANNING_DB.delete('data:' + userId + ':' + pid);
        }
      }
      // Remove from lines map
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      for (var l in linesMap) {
        linesMap[l] = linesMap[l].filter(function(e){ return e.userId !== userId; });
        if (linesMap[l].length === 0) delete linesMap[l];
      }
      await env.PLANNING_DB.put('global:lines_used', JSON.stringify(linesMap));
      return resp({ ok: true });
    }

    if (path === '/admin/lines') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      return resp({ lines: linesMap });
    }

    if (path === '/admin/cleanup-lines') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      var removed = 0;
      for (var l in linesMap) {
        var cleaned = [];
        for (var entry of linesMap[l]) {
          if (await env.PLANNING_DB.get('user:' + entry.userId)) cleaned.push(entry);
          else removed++;
        }
        if (cleaned.length > 0) linesMap[l] = cleaned; else delete linesMap[l];
      }
      await env.PLANNING_DB.put('global:lines_used', JSON.stringify(linesMap));
      return resp({ ok: true, removed: removed, lines: linesMap });
    }

    if (path === '/admin/remove-from-line') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var ligne = body.ligne, userId = body.userId, profileId = body.profileId;
      if (!ligne || !userId) return resp({ error: 'Donnees manquantes' }, 400);
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      if (linesMap[ligne]) {
        linesMap[ligne] = linesMap[ligne].filter(function(e){
          return !(e.userId === userId && (!profileId || e.profileId === profileId));
        });
        if (linesMap[ligne].length === 0) delete linesMap[ligne];
      }
      await env.PLANNING_DB.put('global:lines_used', JSON.stringify(linesMap));
      return resp({ ok: true, lines: linesMap });
    }

    if (path === '/admin/cycles') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var cycles = await env.PLANNING_DB.get('global:cycles', { type: 'json' }) || [];
      return resp({ cycles: cycles });
    }

    if (path === '/admin/cycle/create') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var cycle = body.cycle;
      if (!cycle || !cycle.startDate || !cycle.weeks) return resp({ error: 'Donnees manquantes' }, 400);
      var cycles = await env.PLANNING_DB.get('global:cycles', { type: 'json' }) || [];
      cycle.id = randToken(8);
      cycle.createdAt = Date.now();
      var activeCycle = cycles.find(function(c){ return !c.endDate || c.endDate > new Date().toISOString().slice(0,10); });
      var weekCountChanged = !activeCycle || activeCycle.weeks.length !== cycle.weeks.length;
      cycle.weekCountChanged = weekCountChanged;
      cycles.push(cycle);
      cycles.sort(function(a,b){ return a.startDate.localeCompare(b.startDate); });
      await env.PLANNING_DB.put('global:cycles', JSON.stringify(cycles));
      if (weekCountChanged) {
        var list = await env.PLANNING_DB.list({ prefix: 'user:' });
        var pendingUsers = [];
        for (var key of list.keys) {
          if (key.name.startsWith('user:email:')) continue;
          var user = await env.PLANNING_DB.get(key.name, { type: 'json' });
          if (user) pendingUsers.push(user.userId);
        }
        await env.PLANNING_DB.put('global:pending_line_choice:' + cycle.id, JSON.stringify({ cycleId: cycle.id, userIds: pendingUsers }));
      }
      return resp({ ok: true, cycle: cycle, weekCountChanged: weekCountChanged });
    }

    if (path === '/admin/cycle/update') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var cycle = body.cycle;
      if (!cycle || !cycle.weeks) return resp({ error: 'Donnees manquantes' }, 400);
      if (cycle.id === 'current') {
        await env.PLANNING_DB.put('global:cycle:current', JSON.stringify(cycle));
        return resp({ ok: true });
      }
      var cycles = await env.PLANNING_DB.get('global:cycles', { type: 'json' }) || [];
      var idx = cycles.findIndex(function(c){ return c.id === cycle.id; });
      if (idx === -1) return resp({ error: 'Cycle introuvable' }, 404);
      cycles[idx] = Object.assign(cycles[idx], cycle);
      await env.PLANNING_DB.put('global:cycles', JSON.stringify(cycles));
      return resp({ ok: true });
    }

    if (path === '/get-cycle') {
      var currentOverride = await env.PLANNING_DB.get('global:cycle:current', { type: 'json' });
      var cycles = await env.PLANNING_DB.get('global:cycles', { type: 'json' }) || [];
      var today = new Date().toISOString().slice(0,10);
      var futureCycle = cycles.filter(function(c){ return c.startDate > today; }).sort(function(a,b){ return a.startDate.localeCompare(b.startDate); })[0] || null;
      return resp({ currentOverride: currentOverride, futureCycle: futureCycle, cycles: cycles });
    }

    if (path === '/admin/vacations') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var vacs = await env.PLANNING_DB.get('global:vacations', { type: 'json' }) || {};
      return resp({ vacations: vacs });
    }
    if (path === '/get-vacations') {
      var vacs = await env.PLANNING_DB.get('global:vacations', { type: 'json' }) || {};
      return resp({ vacations: vacs });
    }
    if (path === '/admin/vacation/save') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var vac = body.vacation;
      if (!vac || !vac.name) return resp({ error: 'Champs manquants' }, 400);
      var vacs = await env.PLANNING_DB.get('global:vacations', { type: 'json' }) || {};
      var existing = vacs[vac.name] || {};
      var existingPrimes = existing.primes || { antenne: false, reel: false, coord: false };
      var newPrimes = vac.primes !== undefined ? {
        antenne: !!vac.primes.antenne,
        reel: !!vac.primes.reel,
        coord: !!vac.primes.coord
      } : existingPrimes;
      vacs[vac.name] = {
        deb: vac.deb || existing.deb || '',
        fin: vac.fin || existing.fin || '',
        dur: vac.dur !== undefined ? vac.dur : (existing.dur || 0),
        panier: vac.panier !== undefined ? !!vac.panier : !!existing.panier,
        mixte: vac.mixte !== undefined ? !!vac.mixte : !!existing.mixte,
        primes: newPrimes,
        type: vac.type || existing.type || 'week',
        cycleIds: existing.cycleIds || [],
        ...(vac.label ? { label: vac.label } : existing.label ? { label: existing.label } : {}),
        ...(vac.days && vac.days.length ? { days: vac.days } : {}),
        ...(vac.cat ? { cat: vac.cat } : existing.cat ? { cat: existing.cat } : {})
      };
      await env.PLANNING_DB.put('global:vacations', JSON.stringify(vacs));
      return resp({ ok: true });
    }
    if (path === '/admin/vacation/addcycle') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var vacs = await env.PLANNING_DB.get('global:vacations', { type: 'json' }) || {};
      var name = body.name; var cycId = body.cycleId;
      if (!name || !cycId || !vacs[name]) return resp({ error: 'Vacation ou cycle introuvable' }, 404);
      if (!vacs[name].cycleIds) vacs[name].cycleIds = [];
      if (!vacs[name].cycleIds.includes(cycId)) vacs[name].cycleIds.push(cycId);
      await env.PLANNING_DB.put('global:vacations', JSON.stringify(vacs));
      return resp({ ok: true });
    }
    if (path === '/admin/vacation/removecycle') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var vacs = await env.PLANNING_DB.get('global:vacations', { type: 'json' }) || {};
      var name = body.name; var cycId = body.cycleId;
      if (!name || !cycId || !vacs[name]) return resp({ error: 'Vacation introuvable' }, 404);
      vacs[name].cycleIds = (vacs[name].cycleIds || []).filter(function(c){ return c !== cycId; });
      await env.PLANNING_DB.put('global:vacations', JSON.stringify(vacs));
      return resp({ ok: true });
    }
    if (path === '/admin/vacation/delete') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var vacName = body.name;
      if (!vacName) return resp({ error: 'Nom manquant' }, 400);
      var vacs = await env.PLANNING_DB.get('global:vacations', { type: 'json' }) || {};
      delete vacs[vacName];
      await env.PLANNING_DB.put('global:vacations', JSON.stringify(vacs));
      return resp({ ok: true });
    }
    if (path === '/admin/cycle/delete') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var cycleId = body.cycleId;
      var cycles = await env.PLANNING_DB.get('global:cycles', { type: 'json' }) || [];
      cycles = cycles.filter(function(c){ return c.id !== cycleId; });
      await env.PLANNING_DB.put('global:cycles', JSON.stringify(cycles));
      await env.PLANNING_DB.delete('global:pending_line_choice:' + cycleId);
      return resp({ ok: true });
    }
    if (path === '/admin/change-password') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var newPwd = body.newPassword;
      if (!newPwd || newPwd.length < 6) return resp({ error: 'Mot de passe trop court' }, 400);
      await env.PLANNING_DB.put(ADMIN_PASSWORD_HASH_KEY, await sha256(newPwd));
      return resp({ ok: true });
    }

    if (path === '/admin/parse-cycle-pdf') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var pdfBase64 = body.pdfBase64;
      if (!pdfBase64) return resp({ error: 'PDF manquant' }, 400);
      if (!env.ANTHROPIC_API_KEY) return resp({ error: 'ANTHROPIC_API_KEY non configure dans les secrets Cloudflare' }, 500);
      var prompt = 'Analyse ce planning France Info. Retourne UNIQUEMENT un JSON valide (aucun texte avant ou apres, aucun bloc markdown).\n\nStructure attendue:\n{\n  "title": "titre complet du cycle",\n  "lines": [\n    {"name": "NOM_AGENT", "schedule": ["codeL","codeMa","codeMe","codeJ","codeV","codeSa","codeDi"]}\n  ],\n  "vacations": {\n    "CODE": {"deb": "HHhMM", "fin": "HHhMM", "dur": 480}\n  }\n}\n\nRegles:\n- Inclus UNIQUEMENT les lignes de la section "Antenne" — ignore completement la section "Pool Cadre"\n- schedule: null pour jour repos sans code, "RH" pour recuperation hebdomadaire, code exact sinon\n- vacations: une entree par code unique avec deb/fin extraits du tableau, dur = duree en minutes (fin - deb - pauses visibles)\n- Format heures: "HHhMM" (ex: "03h45", "00h30")';
      try {
        var claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8192,
            messages: [{ role: 'user', content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
              { type: 'text', text: prompt }
            ]}]
          })
        });
        if (!claudeRes.ok) {
          var errBody = await claudeRes.json().catch(function(){ return {}; });
          return resp({ error: 'Erreur Claude API: ' + (errBody.error && errBody.error.message || claudeRes.status) }, 500);
        }
        var claudeData = await claudeRes.json();
        var text = (claudeData.content && claudeData.content[0] && claudeData.content[0].text) || '';
        text = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
        var parsed = JSON.parse(text);
        return resp({ ok: true, data: parsed });
      } catch(e) {
        return resp({ error: 'Erreur: ' + e.message }, 500);
      }
    }

    if (path === '/cycles') {
      var cycles = await env.PLANNING_DB.get('global:cycles', { type: 'json' }) || [];
      return resp({ cycles: cycles });
    }

    if (path === '/pending-line-choice') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var list2 = await env.PLANNING_DB.list({ prefix: 'global:pending_line_choice:' });
      var pending = [];
      for (var key2 of list2.keys) {
        var data2 = await env.PLANNING_DB.get(key2.name, { type: 'json' });
        if (data2 && data2.userIds && data2.userIds.includes(session.userId)) {
          var cycles2 = await env.PLANNING_DB.get('global:cycles', { type: 'json' }) || [];
          var cycle2 = cycles2.find(function(c){ return c.id === data2.cycleId; });
          if (cycle2) pending.push(cycle2);
        }
      }
      return resp({ pending: pending });
    }

    if (path === '/confirm-line-choice') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var cycleId = body.cycleId, profileId = body.profileId, ligne = body.ligne;
      var pendingKey = 'global:pending_line_choice:' + cycleId;
      var pendingData = await env.PLANNING_DB.get(pendingKey, { type: 'json' });
      if (pendingData) {
        pendingData.userIds = pendingData.userIds.filter(function(id){ return id !== session.userId; });
        if (pendingData.userIds.length === 0) {
          await env.PLANNING_DB.delete(pendingKey);
        } else {
          await env.PLANNING_DB.put(pendingKey, JSON.stringify(pendingData));
        }
      }
      return resp({ ok: true });
    }

    if (path === '/lines/register') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var ligne = body.ligne, profileId = body.profileId, profileName = body.profileName;
      if (!ligne || !profileId) return resp({ error: 'Donnees manquantes' }, 400);
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      // Remove current profile's previous registration (any line)
      for (var l in linesMap) {
        linesMap[l] = linesMap[l].filter(function(e){ return !(e.userId === session.userId && e.profileId === profileId); });
        if (linesMap[l].length === 0) delete linesMap[l];
      }
      // Clean orphaned entries on the target line (verify user accounts still exist)
      if (linesMap[ligne] && linesMap[ligne].length > 0) {
        var cleaned = [];
        for (var entry of linesMap[ligne]) {
          if (await env.PLANNING_DB.get('user:' + entry.userId)) cleaned.push(entry);
        }
        if (cleaned.length > 0) linesMap[ligne] = cleaned; else delete linesMap[ligne];
      }
      if (!linesMap[ligne]) linesMap[ligne] = [];
      linesMap[ligne].push({ userId: session.userId, userName: body.userName || session.userId, profileId: profileId, profileName: profileName || profileId, weekVacs: body.weekVacs || [], regLine: body.regLine !== undefined ? body.regLine : parseInt(ligne.slice(1))-1, regWeek: body.regWeek || getMondayKey() });
      await env.PLANNING_DB.put('global:lines_used', JSON.stringify(linesMap));
      var monKey = body.regWeek || getMondayKey();
      await env.PLANNING_DB.put('lines:week:' + monKey, JSON.stringify(linesMap), { expirationTtl: 90 * 24 * 3600 });
      if (body.weekVacs && body.weekVacs.length) {
        await env.PLANNING_DB.put('weekvacs:' + session.userId + ':' + profileId + ':' + monKey, JSON.stringify(body.weekVacs), { expirationTtl: 90 * 24 * 3600 });
      }
      if (body.allWeekVacs && typeof body.allWeekVacs === 'object') {
        await Promise.all(Object.entries(body.allWeekVacs).map(function([wk, wv]) {
          return env.PLANNING_DB.put('weekvacs:' + session.userId + ':' + profileId + ':' + wk, JSON.stringify(wv), { expirationTtl: 180 * 24 * 3600 });
        }));
      }
      return resp({ ok: true });
    }

    if (path === '/lines/unregister') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId;
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      for (var l in linesMap) {
        linesMap[l] = linesMap[l].filter(function(e){ return !(e.userId === session.userId && e.profileId === profileId); });
        if (linesMap[l].length === 0) delete linesMap[l];
      }
      await env.PLANNING_DB.put('global:lines_used', JSON.stringify(linesMap));
      return resp({ ok: true });
    }

    if (path === '/lines/available') {
      var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      return resp({ lines: linesMap });
    }

    if (path === '/lines/week') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var currentMon = getMondayKey();
      var requestedMon = (body && body.monday) || currentMon;
      var linesMap, isHistorical = false;
      if (requestedMon < currentMon) {
        var snapshot = await env.PLANNING_DB.get('lines:week:' + requestedMon, { type: 'json' });
        if (snapshot) { linesMap = snapshot; isHistorical = true; }
        else { linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {}; }
      } else {
        linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
      }
      if (requestedMon !== currentMon) {
        var allEntries = [];
        for (var l in linesMap) { for (var e of linesMap[l]) allEntries.push(e); }
        await Promise.all(allEntries.map(async function(entry) {
          var wv = await env.PLANNING_DB.get('weekvacs:' + entry.userId + ':' + entry.profileId + ':' + requestedMon, { type: 'json' });
          entry.weekVacs = wv || [];
        }));
      }
      return resp({ lines: linesMap, monday: requestedMon, current: currentMon, isHistorical: isHistorical });
    }

    // ============================================================
    // AUTH
    // ============================================================

    if (path === '/auth/register') {
      var email = body.email, password = body.password, name = body.name;
      if (!email || !password || !name) return resp({ error: 'Champs manquants' }, 400);
      var emailKey = 'user:email:' + email.toLowerCase();
      var existing = await env.PLANNING_DB.get(emailKey);
      if (existing) return resp({ error: 'Email deja utilise' }, 409);
      var userId = randToken(16);
      var pwHash = await sha256(password + userId);
      var user = { userId: userId, email: email.toLowerCase(), name: name, pwHash: pwHash, createdAt: Date.now(), profiles: {} };
      await env.PLANNING_DB.put(emailKey, userId);
      await env.PLANNING_DB.put('user:' + userId, JSON.stringify(user));
      var token = randToken();
      await env.PLANNING_DB.put('session:' + token, JSON.stringify({ userId: userId, email: email.toLowerCase(), expires: Date.now() + 30*24*60*60*1000 }), { expirationTtl: 30*24*60*60 });
      return resp({ token: token, userId: userId, name: name, email: email.toLowerCase() });
    }

    if (path === '/auth/login') {
      var email = body.email, password = body.password;
      if (!email || !password) return resp({ error: 'Champs manquants' }, 400);
      var userId = await env.PLANNING_DB.get('user:email:' + email.toLowerCase());
      if (!userId) return resp({ error: 'Email ou mot de passe incorrect' }, 401);
      var user = await env.PLANNING_DB.get('user:' + userId, { type: 'json' });
      if (!user) return resp({ error: 'Compte introuvable' }, 401);
      var pwHash = await sha256(password + userId);
      if (pwHash !== user.pwHash) return resp({ error: 'Email ou mot de passe incorrect' }, 401);
      var token = randToken();
      await env.PLANNING_DB.put('session:' + token, JSON.stringify({ userId: userId, email: user.email, expires: Date.now() + 30*24*60*60*1000 }), { expirationTtl: 30*24*60*60 });
      return resp({ token: token, userId: userId, name: user.name, email: user.email });
    }

    if (path === '/auth/forgot') {
      var email = body.email;
      if (!email) return resp({ error: 'Email manquant' }, 400);
      var userId = await env.PLANNING_DB.get('user:email:' + email.toLowerCase());
      if (!userId) return resp({ ok: true });
      var resetToken = randToken(24);
      await env.PLANNING_DB.put('reset:' + resetToken, userId, { expirationTtl: 3600 });
      var resetUrl = 'https://arthurlb4.github.io/planning/?reset=' + resetToken;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Planning France Info <onboarding@resend.dev>', to: email, subject: 'Reinitialisation mot de passe', html: '<p>Cliquez ici pour reinitialiser votre mot de passe (1h) :</p><p><a href="' + resetUrl + '">' + resetUrl + '</a></p>' }),
      });
      return resp({ ok: true });
    }

    if (path === '/auth/reset') {
      var token = body.token, password = body.password;
      if (!token || !password) return resp({ error: 'Donnees manquantes' }, 400);
      var userId = await env.PLANNING_DB.get('reset:' + token);
      if (!userId) return resp({ error: 'Lien invalide ou expire' }, 400);
      var user = await env.PLANNING_DB.get('user:' + userId, { type: 'json' });
      if (!user) return resp({ error: 'Compte introuvable' }, 400);
      user.pwHash = await sha256(password + userId);
      await env.PLANNING_DB.put('user:' + userId, JSON.stringify(user));
      await env.PLANNING_DB.delete('reset:' + token);
      return resp({ ok: true });
    }

    if (path === '/auth/logout') {
      var auth = request.headers.get('Authorization') || '';
      var tok = auth.replace('Bearer ', '').trim();
      if (tok) await env.PLANNING_DB.delete('session:' + tok);
      return resp({ ok: true });
    }

    if (path === '/auth/delete-account') {
      var auth = request.headers.get('Authorization') || '';
      var tok = auth.replace('Bearer ', '').trim();
      if (!tok) return resp({ error: 'Non authentifie' }, 401);
      var session = await env.PLANNING_DB.get('session:' + tok, { type: 'json' });
      if (!session) return resp({ error: 'Session invalide' }, 401);
      var userId = session.userId;
      var user = await env.PLANNING_DB.get('user:' + userId, { type: 'json' });
      if (user) {
        // Delete all profile data
        if (user.profiles) {
          for (var pid of Object.keys(user.profiles)) {
            await env.PLANNING_DB.delete('data:' + userId + ':' + pid);
          }
        }
        // Delete email lookup + user record
        await env.PLANNING_DB.delete('user:email:' + user.email);
        await env.PLANNING_DB.delete('user:' + userId);
        // Remove from lines map
        var linesMap = await env.PLANNING_DB.get('global:lines_used', { type: 'json' }) || {};
        for (var l in linesMap) {
          linesMap[l] = linesMap[l].filter(function(e){ return e.userId !== userId; });
          if (linesMap[l].length === 0) delete linesMap[l];
        }
        await env.PLANNING_DB.put('global:lines_used', JSON.stringify(linesMap));
      }
      // Delete session
      await env.PLANNING_DB.delete('session:' + tok);
      return resp({ ok: true });
    }

    // ============================================================
    // DATA
    // ============================================================

    if (path === '/data/save') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId, data = body.data;
      if (!profileId || !data) return resp({ error: 'Donnees manquantes' }, 400);
      await env.PLANNING_DB.put('data:' + session.userId + ':' + profileId, JSON.stringify(data));
      var user = await env.PLANNING_DB.get('user:' + session.userId, { type: 'json' });
      if (user) {
        if (!user.profiles) user.profiles = {};
        var profileName = data && data.profile && data.profile.name || profileId;
        user.profiles[profileId] = { name: profileName, updatedAt: Date.now() };
        await env.PLANNING_DB.put('user:' + session.userId, JSON.stringify(user));
      }
      return resp({ ok: true });
    }

    if (path === '/data/load') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId;
      if (!profileId) return resp({ error: 'ProfileId manquant' }, 400);
      var data = await env.PLANNING_DB.get('data:' + session.userId + ':' + profileId, { type: 'json' });
      return resp({ data: data });
    }

    if (path === '/data/list') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var user = await env.PLANNING_DB.get('user:' + session.userId, { type: 'json' });
      return resp({ profiles: (user && user.profiles) || {} });
    }

    if (path === '/data/saveProfile') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId, name = body.name;
      var user = await env.PLANNING_DB.get('user:' + session.userId, { type: 'json' });
      if (!user) return resp({ error: 'Utilisateur introuvable' }, 404);
      if (!user.profiles) user.profiles = {};
      user.profiles[profileId] = { name: name, updatedAt: Date.now() };
      await env.PLANNING_DB.put('user:' + session.userId, JSON.stringify(user));
      return resp({ ok: true });
    }

    if (path === '/data/deleteProfile') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId;
      var user = await env.PLANNING_DB.get('user:' + session.userId, { type: 'json' });
      if (user && user.profiles) { delete user.profiles[profileId]; await env.PLANNING_DB.put('user:' + session.userId, JSON.stringify(user)); }
      await env.PLANNING_DB.delete('data:' + session.userId + ':' + profileId);
      return resp({ ok: true });
    }

    // ============================================================
    // GCAL SYNC
    // ============================================================

    if (path === '/gcal/sync-background') {
      const session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      const profileId = body.profileId || 'default';
      const profileData = await env.PLANNING_DB.get('data:' + session.userId + ':' + profileId, { type: 'json' });
      if (!profileData || !profileData.profile || !profileData.profile.gcalTokens) {
        return resp({ error: 'Tokens Google manquants' }, 400);
      }
      const tokens = profileData.profile.gcalTokens;
      const calendarId = profileData.profile.gcalCalendarId || 'primary';
      if (!tokens.access_token && !tokens.refresh_token) return resp({ error: 'Tokens invalides' }, 400);
      if (!tokens.access_token || tokens.expiry < Date.now() - 60000) {
        const r2 = await refreshGToken(tokens.refresh_token, env);
        if (r2.access_token) {
          tokens.access_token = r2.access_token;
          tokens.expiry = Date.now() + (r2.expires_in || 3600) * 1000;
          profileData.profile.gcalTokens = tokens;
          await env.PLANNING_DB.put('data:' + session.userId + ':' + profileId, JSON.stringify(profileData));
        }
      }
      const events = body.events || [];
      if (!events.length) return resp({ ok: true, synced: 0 });
      const results = [];
      const calPath = '/calendars/' + encodeURIComponent(calendarId) + '/events';
      for (var i = 0; i < events.length; i++) {
        const ev = events[i];
        var r3;
        try {
          if (ev._delete && ev.googleEventId) {
            r3 = await calApi('DELETE', calPath + '/' + ev.googleEventId, null, tokens.access_token, tokens.refresh_token, env);
            results.push({ id: ev.id, deleted: true });
          } else if (!ev._delete && ev.googleEventId) {
            const evWithId = Object.assign({}, ev.event, { id: ev.googleEventId });
            r3 = await calApi('PUT', calPath + '/' + ev.googleEventId, evWithId, tokens.access_token, tokens.refresh_token, env);
            if (r3.status === 404 || r3.status === 410) {
              r3 = await calApi('POST', calPath, evWithId, tokens.access_token, tokens.refresh_token, env);
            }
            if (r3.status === 403 || r3.status === 429) {
              await new Promise(function(res){ setTimeout(res, 1000); });
              r3 = await calApi('PUT', calPath + '/' + ev.googleEventId, evWithId, tokens.access_token, tokens.refresh_token, env);
            }
            results.push({ id: ev.id, googleEventId: (r3.data && r3.data.id) || ev.googleEventId });
          }
          if (r3 && r3.newToken) tokens.access_token = r3.newToken;
          await new Promise(function(res){ setTimeout(res, 30); });
        } catch(e) {
          results.push({ id: ev.id, error: e.message });
        }
      }
      await env.PLANNING_DB.put('gcal_last_sync:' + session.userId + ':' + profileId, Date.now().toString());
      return resp({ ok: true, synced: results.length, results });
    }

    if (path === '/gcal/last-sync') {
      const session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      const profileId = body.profileId || 'default';
      const lastSync = await env.PLANNING_DB.get('gcal_last_sync:' + session.userId + ':' + profileId);
      const syncProgress = await env.PLANNING_DB.get('gcal_sync_progress:' + session.userId + ':' + profileId, { type: 'json' });
      return resp({ lastSync: lastSync ? parseInt(lastSync) : 0, syncProgress: syncProgress || null });
    }

    if (path === '/gcal/sync-chunk') {
      const session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      const profileId = body.profileId || 'default';
      const events = body.events || [];
      const chunkIndex = body.chunkIndex || 0;
      const totalChunks = body.totalChunks || 1;
      const startDate = body.startDate || null;
      const endDate = body.endDate || null;
      const profileData = await env.PLANNING_DB.get('data:' + session.userId + ':' + profileId, { type: 'json' });
      if (!profileData || !profileData.profile || !profileData.profile.gcalTokens) {
        return resp({ error: 'Tokens Google manquants' }, 400);
      }
      var tokens = profileData.profile.gcalTokens;
      const calendarId2 = profileData.profile.gcalCalendarId || 'primary';
      if (!tokens.access_token || tokens.expiry < Date.now() - 60000) {
        const rt = await refreshGToken(tokens.refresh_token, env);
        if (rt.access_token) {
          tokens.access_token = rt.access_token;
          tokens.expiry = Date.now() + (rt.expires_in || 3600) * 1000;
          profileData.profile.gcalTokens = tokens;
          await env.PLANNING_DB.put('data:' + session.userId + ':' + profileId, JSON.stringify(profileData));
        }
      }
      const calPath3 = '/calendars/' + encodeURIComponent(calendarId2) + '/events';
      let synced = 0;
      for (var ev4 of events) {
        try {
          if (ev4._delete && ev4.googleEventId) {
            var dr = await calApi('DELETE', calPath3 + '/' + ev4.googleEventId, null, tokens.access_token, tokens.refresh_token, env);
            if (dr.newToken) tokens.access_token = dr.newToken;
          } else if (!ev4._delete && ev4.googleEventId) {
            var evWithId2 = Object.assign({}, ev4.event, { id: ev4.googleEventId });
            var pr2 = await calApi('PUT', calPath3 + '/' + ev4.googleEventId, evWithId2, tokens.access_token, tokens.refresh_token, env);
            if (pr2.status === 404 || pr2.status === 410) {
              pr2 = await calApi('POST', calPath3, evWithId2, tokens.access_token, tokens.refresh_token, env);
            }
            if (pr2.status === 403 || pr2.status === 429) {
              await new Promise(function(res){ setTimeout(res, 1000); });
              pr2 = await calApi('PUT', calPath3 + '/' + ev4.googleEventId, evWithId2, tokens.access_token, tokens.refresh_token, env);
            }
            if (pr2.newToken) tokens.access_token = pr2.newToken;
          }
          synced++;
          await new Promise(function(res){ setTimeout(res, 30); });
        } catch(e) { /* continue */ }
      }
      const progress = { chunkIndex, totalChunks, startDate, endDate, updatedAt: Date.now() };
      await env.PLANNING_DB.put('gcal_sync_progress:' + session.userId + ':' + profileId, JSON.stringify(progress));
      if (chunkIndex >= totalChunks - 1) {
        await env.PLANNING_DB.put('gcal_last_sync:' + session.userId + ':' + profileId, Date.now().toString());
        await env.PLANNING_DB.delete('gcal_sync_progress:' + session.userId + ':' + profileId);
      }
      return resp({ ok: true, synced, chunkIndex, totalChunks, done: chunkIndex >= totalChunks - 1 });
    }

    // ============================================================
    // GOOGLE AUTH
    // ============================================================

    if (path === '/auth') {
      var action = body.action, code = body.code, refresh_token = body.refresh_token;
      if (action === 'exchange') {
        var tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code: code, client_id: CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: 'https://arthurlb4.github.io/planning/app/', grant_type: 'authorization_code' }),
        });
        var data = await tokenRes.json();
        return resp(data, tokenRes.status);
      } else if (action === 'refresh') {
        var data = await refreshGToken(refresh_token, env);
        return resp(data);
      }
      return resp({ error: 'Invalid action' }, 400);
    }

    // ============================================================
    // CALENDAR
    // ============================================================

    if (path === '/calendar') {
      var action = body.action, access_token = body.access_token, refresh_token = body.refresh_token;
      var calendarId = body.calendarId, calEvent = body.event, events = body.events;
      var token = access_token;

      if (action === 'listCalendars') {
        var r = await calApi('GET', '/users/me/calendarList', null, token, refresh_token, env);
        if (r.newToken) token = r.newToken;
        return resp(Object.assign({}, r.data, { newToken: r.newToken }), r.status);
      }

      if (action === 'resetCalendar') {
        var oldCal = calendarId;
        var savedColor = null;
        if (oldCal && oldCal !== 'primary') {
          var entry = await calApi('GET', '/users/me/calendarList/' + encodeURIComponent(oldCal), null, token, refresh_token, env);
          if (entry.newToken) token = entry.newToken;
          savedColor = entry.data && entry.data.backgroundColor;
          await calApi('DELETE', '/calendars/' + encodeURIComponent(oldCal), null, token, refresh_token, env);
        }
        var newR = await calApi('POST', '/calendars', { summary: 'franceinfo', timeZone: 'Europe/Paris' }, token, null, env);
        if (newR.newToken) token = newR.newToken;
        if (newR.data && newR.data.id) {
          await calApi('POST', '/users/me/calendarList', { id: newR.data.id }, token, null, env);
          if (savedColor) {
            await calApi('PATCH', '/users/me/calendarList/' + encodeURIComponent(newR.data.id),
              { backgroundColor: savedColor, foregroundColor: '#ffffff' }, token, null, env);
          }
        }
        return resp({ id: newR.data && newR.data.id, newToken: token !== access_token ? token : null });
      }

      if (action === 'createCalendar') {
        var r = await calApi('POST', '/calendars', calEvent, token, refresh_token, env);
        if (r.newToken) token = r.newToken;
        if (r.data.id) await calApi('POST', '/users/me/calendarList', { id: r.data.id }, token, null, env);
        return resp(Object.assign({}, r.data, { newToken: r.newToken }), r.status);
      }

      if (action === 'deleteCalendar') {
        var cal = calendarId || body.calendarId;
        if (!cal || cal === 'primary') return resp({ error: 'Cannot delete primary calendar' }, 400);
        var r = await calApi('DELETE', '/calendars/' + encodeURIComponent(cal), null, token, refresh_token, env);
        if (r.newToken) token = r.newToken;
        return resp({ ok: true, newToken: r.newToken || null }, r.status === 204 ? 200 : r.status);
      }

      if (action === 'countEvents') {
        var cal3 = calendarId || 'primary';
        var calPath4 = '/calendars/' + encodeURIComponent(cal3) + '/events';
        var countUrl = calPath4 + '?maxResults=2500&singleEvents=true';
        var countR = await calApi('GET', countUrl, null, token, refresh_token, env);
        if (countR.newToken) token = countR.newToken;
        var totalItems = (countR.data && countR.data.items) || [];
        var total = totalItems.length;
        if (countR.data && countR.data.nextPageToken) total = '2500+';
        return resp({ total, newToken: token !== access_token ? token : null });
      }

      if (action === 'clearAll') {
        var cal2 = calendarId || 'primary';
        var calPath2 = '/calendars/' + encodeURIComponent(cal2) + '/events';
        var pageToken2 = body.pageToken || null;
        var listUrl2 = calPath2 + '?maxResults=40&singleEvents=true' + (pageToken2 ? '&pageToken=' + pageToken2 : '');
        var listR2 = await calApi('GET', listUrl2, null, token, refresh_token, env);
        if (listR2.newToken) token = listR2.newToken;
        var items2 = (listR2.data && listR2.data.items) || [];
        var nextPageToken2 = listR2.data && listR2.data.nextPageToken;
        var deleted2 = 0;
        for (var ev3 of items2) {
          if (ev3.id) {
            await calApi('DELETE', calPath2 + '/' + ev3.id, null, token, refresh_token, env);
            await new Promise(function(res){ setTimeout(res, 20); });
            deleted2++;
          }
        }
        return resp({ ok: true, deleted: deleted2, done: !nextPageToken2, nextPageToken: nextPageToken2||null, newToken: token !== access_token ? token : null });
      }

      if (action === 'fullSync') {
        var fsCal = calendarId || 'primary';
        var desired = events || [];
        var fsPath = '/calendars/' + encodeURIComponent(fsCal) + '/events';
        var fsToken = token;
        var fsStartDate = body.startDate || null;
        var fsEndDate = body.endDate || null;

        // Build map of desired events by googleEventId
        var desiredMap = {};
        for (var di = 0; di < desired.length; di++) {
          var dev = desired[di];
          if (dev.googleEventId) desiredMap[dev.googleEventId] = dev;
        }

        // List current Google Calendar events in time window (paginated)
        var existing = {};
        var fsPageToken = null;
        do {
          var fsListUrl = fsPath + '?maxResults=250&singleEvents=true';
          if (fsStartDate) fsListUrl += '&timeMin=' + encodeURIComponent(fsStartDate + 'T00:00:00Z');
          if (fsEndDate) fsListUrl += '&timeMax=' + encodeURIComponent(fsEndDate + 'T23:59:59Z');
          if (fsPageToken) fsListUrl += '&pageToken=' + fsPageToken;
          var fsListR = await calApi('GET', fsListUrl, null, fsToken, refresh_token, env);
          if (fsListR.newToken) fsToken = fsListR.newToken;
          var fsItems = (fsListR.data && fsListR.data.items) || [];
          for (var fi = 0; fi < fsItems.length; fi++) {
            var item = fsItems[fi];
            if (item.id) existing[item.id] = item;
          }
          fsPageToken = fsListR.data && fsListR.data.nextPageToken;
        } while (fsPageToken);

        // Compute diff
        var fsCreate = [], fsUpdate = [], fsDelete = [];
        var desiredIds = Object.keys(desiredMap);
        for (var dii = 0; dii < desiredIds.length; dii++) {
          var gid = desiredIds[dii];
          var dv = desiredMap[gid];
          if (!existing[gid]) {
            fsCreate.push(dv);
          } else {
            var ex = existing[gid];
            var exStart = ex.start && (ex.start.date || (ex.start.dateTime || '').slice(0, 16));
            var dvStart = dv.event.start && (dv.event.start.date || (dv.event.start.dateTime || '').slice(0, 16));
            var changed = ex.summary !== dv.event.summary ||
              (ex.description || '') !== (dv.event.description || '') ||
              (ex.colorId || '') !== (dv.event.colorId || '') ||
              exStart !== dvStart;
            if (changed) fsUpdate.push(dv);
          }
        }
        var existingIds = Object.keys(existing);
        for (var eii = 0; eii < existingIds.length; eii++) {
          var eid = existingIds[eii];
          if (!desiredMap[eid]) fsDelete.push(eid);
        }

        var fsCreated = 0, fsUpdated = 0, fsDeleted = 0, fsFailed = 0;
        var FS_PARALLEL = 3;
        var FS_BATCH_DELAY = 300;

        async function fsApply(method, path, data) {
          var r = await calApi(method, path, data, fsToken, refresh_token, env);
          if (r.newToken) fsToken = r.newToken;
          if (r.status === 429 || r.status === 403) {
            await new Promise(function(res){ setTimeout(res, 5000); });
            r = await calApi(method, path, data, fsToken, refresh_token, env);
            if (r.newToken) fsToken = r.newToken;
            if (r.status === 429 || r.status === 403) {
              await new Promise(function(res){ setTimeout(res, 10000); });
              r = await calApi(method, path, data, fsToken, refresh_token, env);
              if (r.newToken) fsToken = r.newToken;
            }
          }
          return r;
        }

        for (var fci = 0; fci < fsCreate.length; fci += FS_PARALLEL) {
          var cBatch = fsCreate.slice(fci, fci + FS_PARALLEL);
          await Promise.all(cBatch.map(async function(cev) {
            try {
              var cData = Object.assign({}, cev.event, { id: cev.googleEventId });
              var cr = await fsApply('POST', fsPath, cData);
              if (cr.status === 200 || cr.status === 201) fsCreated++;
              else fsFailed++;
            } catch(e) { fsFailed++; }
          }));
          if (fci + FS_PARALLEL < fsCreate.length) await new Promise(function(res){ setTimeout(res, FS_BATCH_DELAY); });
        }

        for (var fui = 0; fui < fsUpdate.length; fui += FS_PARALLEL) {
          var uBatch = fsUpdate.slice(fui, fui + FS_PARALLEL);
          await Promise.all(uBatch.map(async function(uev) {
            try {
              var uData = Object.assign({}, uev.event, { id: uev.googleEventId });
              var ur = await fsApply('PUT', fsPath + '/' + uev.googleEventId, uData);
              if (ur.status === 200) fsUpdated++;
              else fsFailed++;
            } catch(e) { fsFailed++; }
          }));
          if (fui + FS_PARALLEL < fsUpdate.length) await new Promise(function(res){ setTimeout(res, FS_BATCH_DELAY); });
        }

        for (var fdi = 0; fdi < fsDelete.length; fdi += FS_PARALLEL) {
          var dBatch = fsDelete.slice(fdi, fdi + FS_PARALLEL);
          await Promise.all(dBatch.map(async function(deid) {
            try {
              var dr = await fsApply('DELETE', fsPath + '/' + deid, null);
              if (dr.status === 204 || dr.status === 200 || dr.status === 404 || dr.status === 410) fsDeleted++;
            } catch(e) { fsFailed++; }
          }));
          if (fdi + FS_PARALLEL < fsDelete.length) await new Promise(function(res){ setTimeout(res, FS_BATCH_DELAY); });
        }

        return resp({ ok: true, created: fsCreated, updated: fsUpdated, deleted: fsDeleted, failed: fsFailed, newToken: fsToken !== access_token ? fsToken : null });
      }

      if (action === 'batchSync') {
        var cal = calendarId || 'primary';
        var evList = events || [];
        if (!evList.length) return resp({ results: [], newToken: null });
        var latestToken = token;
        var calPath = '/calendars/' + encodeURIComponent(cal) + '/events';
        async function processEv(ev) {
          var tok = latestToken;
          var r;
          try {
            if (ev._delete && ev.googleEventId) {
              r = await calApi('DELETE', calPath + '/' + ev.googleEventId, null, tok, refresh_token, env);
              if (r.newToken) return { id: ev.id, deleted: true, _tok: r.newToken };
              if (r.status === 404 || r.status === 410) return { id: ev.id, deleted: false, skipped: true };
              return { id: ev.id, deleted: true };
            } else if (!ev._delete && ev.googleEventId) {
              var evData = ev.stable ? Object.assign({}, ev.event, { id: ev.googleEventId }) : ev.event;
              r = await calApi(ev.stable ? 'PUT' : 'POST', ev.stable ? calPath + '/' + ev.googleEventId : calPath, evData, tok, refresh_token, env);
              if (r.newToken) tok = r.newToken;
              if (r.status === 404 || r.status === 410) {
                r = await calApi('POST', calPath, evData, tok, refresh_token, env);
                if (r.newToken) tok = r.newToken;
              }
              return { id: ev.id, googleEventId: r.data.id || ev.googleEventId, _tok: tok !== latestToken ? tok : null };
            } else if (!ev._delete) {
              r = await calApi('POST', calPath, ev.event, tok, refresh_token, env);
              if (r.newToken) tok = r.newToken;
              return { id: ev.id, googleEventId: r.data && r.data.id, _tok: tok !== latestToken ? tok : null };
            }
          } catch(e) {}
          return { id: ev.id, googleEventId: ev.googleEventId };
        }
        var results = [];
        var GROUP = 5;
        for (var gi = 0; gi < evList.length; gi += GROUP) {
          var grp = await Promise.all(evList.slice(gi, gi + GROUP).map(processEv));
          for (var j = 0; j < grp.length; j++) {
            var item = grp[j];
            if (item._tok) { latestToken = item._tok; delete item._tok; }
            results.push(item);
          }
        }
        return resp({ results: results, newToken: latestToken !== access_token ? latestToken : null });
      }

      return resp({ error: 'Invalid action' }, 400);
    }

    if (path === '/sync-status') {
      const session = await verifySession(request, env);
      if (!session) return resp({ error: 'Unauthorized' }, 401);
      if (body.action === 'set') {
        await env.PLANNING_DB.put(
          'sync_state:' + session.userId,
          JSON.stringify({ status: body.status||'idle', current: body.current||0, total: body.total||0, ts: Date.now() }),
          { expirationTtl: 60 }
        );
        return resp({ ok: true });
      }
      const state = await env.PLANNING_DB.get('sync_state:' + session.userId, { type: 'json' });
      return resp(state || { status: 'idle', current: 0, total: 0 });
    }

    // ============================================================
    // ASYNC FULL SYNC (Google Calendar Batch API, fire-and-forget)
    // ============================================================

    if (path === '/gcal/fullsync-start') {
      const session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      const profileId = body.profileId || 'default';
      const calendarId = body.calendarId || null;
      const events = body.events || [];
      const startDate = body.startDate || null;
      const endDate = body.endDate || null;

      const profileData = await env.PLANNING_DB.get('data:' + session.userId + ':' + profileId, { type: 'json' });
      if (!profileData || !profileData.profile || !profileData.profile.gcalTokens) {
        return resp({ error: 'Tokens Google manquants' }, 400);
      }
      var tokens = Object.assign({}, profileData.profile.gcalTokens);
      const calId = calendarId || profileData.profile.gcalCalendarId || 'primary';

      if (!tokens.access_token || tokens.expiry < Date.now() - 60000) {
        var rt = await refreshGToken(tokens.refresh_token, env);
        if (rt.access_token) {
          tokens.access_token = rt.access_token;
          tokens.expiry = Date.now() + (rt.expires_in || 3600) * 1000;
          profileData.profile.gcalTokens = tokens;
          await env.PLANNING_DB.put('data:' + session.userId + ':' + profileId, JSON.stringify(profileData));
        }
      }

      const fsCalPath = '/calendars/' + encodeURIComponent(calId) + '/events';
      var fsExisting = {};
      var fsPT = null;
      do {
        var fsListUrl = fsCalPath + '?maxResults=250&singleEvents=true';
        if (startDate) fsListUrl += '&timeMin=' + encodeURIComponent(startDate + 'T00:00:00Z');
        if (endDate) fsListUrl += '&timeMax=' + encodeURIComponent(endDate + 'T23:59:59Z');
        if (fsPT) fsListUrl += '&pageToken=' + fsPT;
        var fsLR = await calApi('GET', fsListUrl, null, tokens.access_token, tokens.refresh_token, env);
        if (fsLR.newToken) tokens.access_token = fsLR.newToken;
        var fsIt = (fsLR.data && fsLR.data.items) || [];
        for (var k = 0; k < fsIt.length; k++) { if (fsIt[k].id) fsExisting[fsIt[k].id] = fsIt[k]; }
        fsPT = fsLR.data && fsLR.data.nextPageToken;
      } while (fsPT);

      var fsDesiredMap = {};
      for (var di = 0; di < events.length; di++) {
        if (events[di].googleEventId) fsDesiredMap[events[di].googleEventId] = events[di];
      }
      var fsOps = [];
      var fsDesiredIds = Object.keys(fsDesiredMap);
      for (var dii = 0; dii < fsDesiredIds.length; dii++) {
        var fsgid = fsDesiredIds[dii]; var fsdv = fsDesiredMap[fsgid];
        if (!fsExisting[fsgid]) {
          fsOps.push({ type: 'create', googleEventId: fsgid, event: fsdv.event });
        } else {
          var fsex = fsExisting[fsgid];
          var fsExStart = fsex.start && (fsex.start.date || (fsex.start.dateTime || '').slice(0, 16));
          var fsDvStart = fsdv.event.start && (fsdv.event.start.date || (fsdv.event.start.dateTime || '').slice(0, 16));
          var fsChanged = fsex.summary !== fsdv.event.summary ||
            (fsex.description || '') !== (fsdv.event.description || '') ||
            (fsex.colorId || '') !== (fsdv.event.colorId || '') ||
            fsExStart !== fsDvStart;
          if (fsChanged) fsOps.push({ type: 'update', googleEventId: fsgid, event: fsdv.event });
        }
      }
      var fsExIds = Object.keys(fsExisting);
      for (var eii = 0; eii < fsExIds.length; eii++) {
        if (!fsDesiredMap[fsExIds[eii]]) fsOps.push({ type: 'delete', googleEventId: fsExIds[eii] });
      }

      if (fsOps.length === 0) {
        await env.PLANNING_DB.put('gcal_last_sync:' + session.userId + ':' + profileId, Date.now().toString());
        return resp({ ok: true, ops: 0 });
      }

      await env.PLANNING_DB.put('sync_state:' + session.userId,
        JSON.stringify({ status: 'syncing', current: 0, total: fsOps.length, ts: Date.now() }),
        { expirationTtl: 120 });

      const _userId = session.userId;
      const _profileId = profileId;
      const _tokens = tokens;
      const _profileData = profileData;
      const _fsOps = fsOps;
      const _calId = calId;

      ctx.waitUntil((async function() {
        try {
          var batchResult = await gcalBatchOps(_fsOps, _calId, _tokens.access_token, _tokens.refresh_token, env);
          if (batchResult.newToken) {
            _tokens.access_token = batchResult.newToken;
            _profileData.profile.gcalTokens = _tokens;
            await env.PLANNING_DB.put('data:' + _userId + ':' + _profileId, JSON.stringify(_profileData));
          }
          await env.PLANNING_DB.put('gcal_last_sync:' + _userId + ':' + _profileId, Date.now().toString());
          await env.PLANNING_DB.put('sync_state:' + _userId,
            JSON.stringify({ status: 'done', current: _fsOps.length - batchResult.failed, total: _fsOps.length, ts: Date.now() }),
            { expirationTtl: 60 });
          await env.PLANNING_DB.put('gcal_debug:' + _userId + ':' + _profileId,
            JSON.stringify({ ts: Date.now(), ops: _fsOps.length, failed: batchResult.failed, ok: true }),
            { expirationTtl: 300 });
        } catch(e) {
          await env.PLANNING_DB.put('gcal_debug:' + _userId + ':' + _profileId,
            JSON.stringify({ ts: Date.now(), error: e.message, stack: e.stack }),
            { expirationTtl: 300 });
          await env.PLANNING_DB.put('sync_state:' + _userId,
            JSON.stringify({ status: 'error', ts: Date.now() }),
            { expirationTtl: 60 });
        }
      })());

      return resp({ ok: true, ops: fsOps.length, started: true });
    }

    if (path === '/get-pay-config') {
      var config = await env.PLANNING_DB.get('global:pay-config', { type: 'json' }) || null;
      return resp({ config: config });
    }
    if (path === '/admin/pay-config/save') {
      if (!await verifyAdmin(request, env)) return resp({ error: 'Non autorise' }, 401);
      var config = body.config;
      if (!config) return resp({ error: 'Config manquante' }, 400);
      await env.PLANNING_DB.put('global:pay-config', JSON.stringify(config));
      return resp({ ok: true });
    }
    if (path === '/gcal/sync-debug') {
      const session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      const profileId = body.profileId || 'default';
      const log = await env.PLANNING_DB.get('gcal_debug:' + session.userId + ':' + profileId, { type: 'json' });
      return resp({ log: log });
    }

    // ============================================================
    // POWER AUTOMATE INTEGRATION
    // ============================================================

    if (path === '/pa/token') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId || 'default';
      var tokenKey = 'patoken:' + session.userId + ':' + profileId;
      var existing = await env.PLANNING_DB.get(tokenKey);
      if (existing) return resp({ token: existing });
      var newTok = randToken(24);
      await env.PLANNING_DB.put(tokenKey, newTok);
      await env.PLANNING_DB.put('patokenrev:' + newTok, JSON.stringify({ userId: session.userId, profileId: profileId }));
      return resp({ token: newTok });
    }

    if (path === '/pa/token-reset') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId || 'default';
      var tokenKey = 'patoken:' + session.userId + ':' + profileId;
      var oldTok = await env.PLANNING_DB.get(tokenKey);
      if (oldTok) await env.PLANNING_DB.delete('patokenrev:' + oldTok);
      var newTok = randToken(24);
      await env.PLANNING_DB.put(tokenKey, newTok);
      await env.PLANNING_DB.put('patokenrev:' + newTok, JSON.stringify({ userId: session.userId, profileId: profileId }));
      return resp({ token: newTok });
    }

    // Called by Power Automate — token auth, no session needed
    if (path === '/pa/notify') {
      var tok = body.token;
      if (!tok) return resp({ error: 'Token manquant' }, 401);
      var revData = await env.PLANNING_DB.get('patokenrev:' + tok, { type: 'json' });
      if (!revData) return resp({ error: 'Token invalide' }, 401);
      var action = (body.action || '').toLowerCase();
      var dateDebut = body.dateDebut, dateFin = body.dateFin;
      var type = (body.type || 'rend').toLowerCase();
      var requestId = body.requestId || randToken(8);
      if (!action || !dateDebut || !dateFin) return resp({ error: 'Donnees manquantes' }, 400);
      function parseFrDate(s) {
        var p = (s || '').split('/');
        return p.length === 3 ? p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0') : null;
      }
      var debut = parseFrDate(dateDebut), fin = parseFrDate(dateFin);
      if (!debut || !fin) return resp({ error: 'Format date invalide (DD/MM/YYYY)' }, 400);
      var qKey = 'pa:queue:' + revData.userId + ':' + revData.profileId;
      var queue = await env.PLANNING_DB.get(qKey, { type: 'json' }) || [];
      queue = queue.filter(function(op) { return op.requestId !== requestId && op.ts > Date.now() - 90*24*3600*1000; });
      queue.push({ requestId, action, debut, fin, type, ts: Date.now(), applied: false });
      await env.PLANNING_DB.put(qKey, JSON.stringify(queue), { expirationTtl: 90 * 24 * 3600 });
      return resp({ ok: true });
    }

    if (path === '/pa/sync') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId || 'default';
      var qKey = 'pa:queue:' + session.userId + ':' + profileId;
      var queue = await env.PLANNING_DB.get(qKey, { type: 'json' }) || [];
      return resp({ ops: queue.filter(function(op) { return !op.applied; }) });
    }

    if (path === '/pa/applied') {
      var session = await verifySession(request, env);
      if (!session) return resp({ error: 'Non authentifie' }, 401);
      var profileId = body.profileId || 'default';
      var ids = body.ids || [];
      var qKey = 'pa:queue:' + session.userId + ':' + profileId;
      var queue = await env.PLANNING_DB.get(qKey, { type: 'json' }) || [];
      queue = queue.map(function(op) { return ids.indexOf(op.requestId) !== -1 ? Object.assign({}, op, { applied: true }) : op; });
      await env.PLANNING_DB.put(qKey, JSON.stringify(queue), { expirationTtl: 90 * 24 * 3600 });
      return resp({ ok: true });
    }

    return resp({ error: 'Not found' }, 404);
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
    }
  }
};
