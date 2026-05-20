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

export default {
  async fetch(request, env) {
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
      for (var key of list.keys) {
        if (key.name.startsWith('user:email:')) continue;
        var user = await env.PLANNING_DB.get(key.name, { type: 'json' });
        if (!user) continue;
        var linesUsed = [];
        if (user.profiles) {
          for (var pid of Object.keys(user.profiles)) {
            var profileData = await env.PLANNING_DB.get('data:' + user.userId + ':' + pid, { type: 'json' });
            if (profileData && profileData.profile && profileData.profile.ligne) {
              linesUsed.push({ profileId: pid, name: profileData.profile.name || pid, ligne: profileData.profile.ligne });
            }
          }
        }
        users.push({ userId: user.userId, email: user.email, name: user.name, createdAt: user.createdAt, profiles: user.profiles || {}, linesUsed: linesUsed });
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
      vacs[vac.name] = {
        deb: vac.deb || existing.deb || '',
        fin: vac.fin || existing.fin || '',
        dur: vac.dur !== undefined ? vac.dur : (existing.dur || 0),
        panier: vac.panier !== undefined ? !!vac.panier : !!existing.panier,
        type: vac.type || existing.type || 'week',
        cycleIds: existing.cycleIds || []
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
      for (var l in linesMap) {
        linesMap[l] = linesMap[l].filter(function(e){ return !(e.userId === session.userId && e.profileId === profileId); });
        if (linesMap[l].length === 0) delete linesMap[l];
      }
      if (!linesMap[ligne]) linesMap[ligne] = [];
      linesMap[ligne].push({ userId: session.userId, userName: body.userName || session.userId, profileId: profileId, profileName: profileName || profileId });
      await env.PLANNING_DB.put('global:lines_used', JSON.stringify(linesMap));
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

    return resp({ error: 'Not found' }, 404);
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
    }
  }
};
