// Lecture de vidéos depuis un torrent fourni par l'utilisateur (lien magnet ou fichier .torrent), pour ses propres fichiers.
// Client webtorrent : rien n'est téléchargé d'avance, seuls les morceaux demandés par la lecture (dans l'ordre) arrivent ;
// la vidéo est servie en local avec gestion des plages (Range), puis lue par le convertisseur habituel (ffmpeg).
// Comme tout client torrent, les morceaux reçus sont repartagés tant que le torrent est ouvert.
//   POST /torrent/add      corps : lien magnet, fichier .torrent en base64, ou adresse http(s) d'un .torrent (lien de
//                          téléchargement de Prowlarr, qui peut aussi renvoyer vers un lien magnet) → { id, name, files }
//   GET  /torrent/info?id= avancement (progression, pairs, débit)
//   GET  /torrent/file/<id>/<i>/<nom>   la vidéo (avec Range)
//   GET  /torrent/stop?id= fermeture du torrent (fichiers gardés une semaine après la dernière lecture, 80 Go au plus)
//   POST /torrent/qbt      { url, category } : envoi à qBittorrent (téléchargement complet, rangé ensuite par Radarr / Sonarr) ;
//                          fait ici et non par la page : qBittorrent refuse les requêtes venues d'un autre site
const path = require('path');
const os = require('os');
const fs = require('fs');

const DIR = path.join(os.tmpdir(), 'lecteur-iptv-torrents');
const VIDEO = /\.(mkv|mp4|avi|mov|m4v|webm|ts|m2ts|wmv|flv|mpg|mpeg|ogv)$/i;
// Trackers publics ajoutés aux liens magnet (souvent sans tracker ou avec des trackers morts) : sans eux, seul le DHT
// trouve des pairs, ce qui peut prendre longtemps. Jamais ajoutés à un fichier .torrent (trackers privés : passkey).
const TRACKERS = ['udp://tracker.opentrackr.org:1337/announce', 'udp://open.stealth.si:80/announce', 'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce', 'udp://open.demonii.com:1337/announce', 'udp://tracker.openbittorrent.com:6969/announce',
  'https://tracker.tamersunion.org:443/announce', 'udp://explodie.org:6969/announce'];
let client = null, clientErr = '';
function getClient() {
  if (!client || client.destroyed) {
    const WebTorrent = require('webtorrent');
    client = new WebTorrent({ utp: false, maxConns: 80 });   // pas de module natif à compiler
    client.on('error', e => { clientErr = e.message || String(e); });
  }
  return client;
}
/* Fichiers gardés une semaine après leur dernière lecture (relire le même film repart des morceaux déjà reçus, sans
   retélécharger), puis supprimés ; au-delà de 80 Go en tout, les plus anciens partent d'abord. Suivi dans .index.json :
   { infoHash: { name, size, at } } (at : dernière ouverture ou lecture). */
const KEEP = 7 * 864e5, MAXB = 80e9, IDX = path.join(DIR, '.index.json');
const idxRead = () => { try { return JSON.parse(fs.readFileSync(IDX, 'utf8')) || {}; } catch (e) { return {}; } };
const idxWrite = o => { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(IDX, JSON.stringify(o)); } catch (e) {} };
// bf : morceaux reçus (pour ne pas tout relire et recontrôler à la réouverture : ~1 min pour un film 4K) ; mt : date des fichiers
function idxTouch(t) {
  if (!t || !t.infoHash || !t.name) return; const o = idxRead(), e = { name: t.name, size: t.length || 0, at: Date.now() };
  if (t.ready && t.bitfield && t.bitfield.buffer) { e.bf = Buffer.from(t.bitfield.buffer).toString('base64'); e.np = t.pieces.length; e.mt = fileTimes(t); }
  o[t.infoHash] = e; idxWrite(o);
}
const fileTimes = t => t.files.map(f => { try { return Math.round(fs.statSync(path.join(DIR, f.path)).mtimeMs); } catch (e) { return 0; } }).join(',');
// réouverture d'un torrent déjà lu : morceaux reçus repris de l'index si les fichiers n'ont pas bougé, sans tout recontrôler
function fastResume(t) {
  t.once('metadata', () => {
    const e = idxRead()[t.infoHash];
    if (!e || !e.bf || e.np !== t.pieces.length || e.mt !== fileTimes(t)) return;
    const bf = Buffer.from(e.bf, 'base64');
    t._verifyPieces = cb => { for (let i = 0; i < t.pieces.length; i++) if (bf[i >> 3] & (128 >> (i % 8))) t._markVerified(i); queueMicrotask(() => cb(null)); };
  });
}
function cleanup() {
  const o = idxRead(), open = new Set(client ? client.torrents.map(t => t.infoHash) : []);
  const rm = h => { const e = o[h]; if (e && e.name && !/[\\/]|^\.\.?$/.test(e.name)) try { fs.rmSync(path.join(DIR, e.name), { recursive: true, force: true }); } catch (er) {} delete o[h]; };
  Object.keys(o).forEach(h => { if (!open.has(h) && Date.now() - o[h].at > KEEP) rm(h); });
  let tot = Object.values(o).reduce((a, e) => a + (e.size || 0), 0);
  Object.keys(o).filter(h => !open.has(h)).sort((a, b) => o[a].at - o[b].at).forEach(h => { if (tot > MAXB) { tot -= o[h].size || 0; rm(h); } });
  // fichiers d'avant le suivi (anciennes versions) : supprimés s'ils datent de plus d'une semaine
  const known = new Set(Object.values(o).map(e => e.name));
  try { fs.readdirSync(DIR).forEach(n => { if (n === '.index.json' || known.has(n)) return; const f = path.join(DIR, n); try { if (Date.now() - fs.statSync(f).mtimeMs > KEEP) fs.rmSync(f, { recursive: true, force: true }); } catch (e) {} }); } catch (e) {}
  idxWrite(o);
}
setTimeout(cleanup, 30e3); setInterval(cleanup, 6 * 3600e3);
// à la fermeture de l'appli : torrents fermés, fichiers gardés (supprimés une semaine après leur dernière lecture)
process.on('exit', () => { try { if (client) client.torrents.forEach(idxTouch); } catch (e) {} try { if (client) client.destroy(); } catch (e) {} });

// progression : celle du fichier en lecture (sinon du plus gros fichier vidéo) ; « known » = pairs trouvés par les trackers
// et le DHT, pas encore forcément connectés
const mainFile = t => t._playing != null ? t.files[t._playing] : t.files.filter(f => VIDEO.test(f.name)).sort((a, b) => b.length - a.length)[0];
const info = t => { const f = t.ready && mainFile(t);
  return { id: t.infoHash, name: t.name, files: (t.files || []).map((f, i) => ({ i, name: f.name, size: f.length, video: VIDEO.test(f.name) })),
    progress: f ? f.progress : t.progress, peers: t.numPeers, known: t._peersLength || 0, down: t.downloadSpeed, up: t.uploadSpeed,
    warn: t._lastWarn || '', err: clientErr }; };

function add(src) {
  return new Promise((resolve, reject) => {
    const c = getClient(), old = c.get(src);
    if (old && old.ready) return resolve(info(old));
    let done = false;
    const timer = setTimeout(() => { if (done) return; done = true; try { const t = c.get(src); if (t) t.destroy(); } catch (e) {} reject(new Error('aucun pair trouvé en 90 s (torrent sans source en ligne ?)' + (clientErr ? ' · ' + clientErr : ''))); }, 90000);
    try {
      const opts = { path: DIR, destroyStoreOnDestroy: false };
      if (typeof src === 'string') opts.announce = TRACKERS;
      const t = c.add(src, opts, t => {
        if (done) return; done = true; clearTimeout(timer);
        // Seul le fichier vidéo principal est demandé (pas les bonus, sous-titres…), dans l'ordre ; il ne faut pas tout
        // désélectionner : sans rien à demander, l'appli n'intéresse plus les pairs, qui coupent la connexion (0 source)
        t.deselect(0, t.pieces.length - 1, false);
        t.files.forEach(f => f.deselect());
        const f = mainFile(t); if (f) f.select();
        idxTouch(t);
        resolve(info(t));
      });
      fastResume(t);
      t.on('warning', e => { t._lastWarn = String((e && e.message) || e).slice(0, 200); });
      t.on('error', e => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    } catch (e) { done = true; clearTimeout(timer); reject(e); }
  });
}

// Lien magnet, .torrent en base64, ou adresse d'un .torrent (suivie à la main : une redirection vers un lien magnet est
// reprise telle quelle)
async function fromBody(body) {
  if (/^magnet:\?/i.test(body)) return body;
  if (/^https?:\/\//i.test(body)) {
    let url = body;
    for (let k = 0; k < 5; k++) {
      const r = await fetch(url, { redirect: 'manual' });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) { if (/^magnet:\?/i.test(loc)) return loc; url = new URL(loc, url).href; continue; }
      if (!r.ok) throw new Error('le lien du torrent répond ' + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (/^magnet:\?/i.test(b.toString('utf8', 0, 8))) return b.toString().trim();
      return b;
    }
    throw new Error('trop de redirections');
  }
  const b = Buffer.from(body, 'base64'); if (b.length < 50) throw new Error('lien magnet ou fichier .torrent attendu');
  return b;
}

function sendFile(t, f, req, res) {
  const size = f.length, m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  let start = 0, end = size - 1;
  if (m) { if (m[1]) start = +m[1]; if (m[2]) end = Math.min(+m[2], size - 1); if (!m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; } }
  if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
  const type = /\.mp4|\.m4v$/i.test(f.name) ? 'video/mp4' : /\.webm$/i.test(f.name) ? 'video/webm' : 'video/x-matroska';
  res.writeHead(m ? 206 : 200, Object.assign({ 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type, 'Cache-Control': 'no-store' },
    m ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}));
  if (req.method === 'HEAD') return res.end();
  const st = f.createReadStream({ start, end });
  st.on('error', () => { try { res.destroy(); } catch (e) {} });
  res.on('close', () => { try { st.destroy(); } catch (e) {} });
  st.pipe(res);
}

// Envoi à qBittorrent (interface web locale, réglée par l'installateur de la médiathèque : port 8085, sans mot de passe
// depuis ce PC). qBittorrent n'est pas un service Windows : s'il n'est pas lancé, l'appli le démarre et attend son
// interface web ; s'il demande une connexion, elle se connecte avec le mot de passe gardé par l'installateur.
const QBT_EXE = [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'qBittorrent', 'qbittorrent.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'qBittorrent', 'qbittorrent.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'qBittorrent', 'qbittorrent.exe')];
let qbtCookie = '';
const pause = ms => new Promise(r => setTimeout(r, ms));
async function qbtUp(base) { try { await fetch(base + '/api/v2/app/version', { signal: AbortSignal.timeout(3000) }); return true; } catch (e) { return false; } }
async function qbtLogin(base) {
  const mdp = ['C:\\Mediatheque\\qbittorrent-mdp.txt'].map(f => { try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { return ''; } }).find(Boolean);
  if (!mdp) throw new Error('qBittorrent demande une connexion : Outils › Options › Interface web, cochez « Ignorer l\'authentification pour les clients sur l\'hôte local »');
  const r = await fetch(base + '/api/v2/auth/login', { method: 'POST', body: new URLSearchParams({ username: 'admin', password: mdp }) });
  const c = (r.headers.get('set-cookie') || '').match(/SID=[^;]+/);
  if (!r.ok || !c) throw new Error('qBittorrent refuse la connexion (identifiant admin et mot de passe de C:\\Mediatheque\\qbittorrent-mdp.txt)');
  qbtCookie = c[0];
}
async function qbtAdd(url, category, port) {
  const base = 'http://127.0.0.1:' + port;
  if (!(await qbtUp(base))) {
    const exe = QBT_EXE.find(f => { try { return fs.existsSync(f); } catch (e) { return false; } });
    if (!exe) throw new Error('qBittorrent n\'est pas installé sur ce PC (installateur de la médiathèque, ou qbittorrent.org)');
    require('child_process').spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
    let up = false; for (let k = 0; k < 20 && !up; k++) { await pause(1000); up = await qbtUp(base); }
    if (!up) throw new Error('qBittorrent est lancé mais son interface web ne répond pas sur le port ' + port + ' : Outils › Options › Interface web, activez-la sur le port ' + port);
  }
  const send = () => fetch(base + '/api/v2/torrents/add', { method: 'POST', body: new URLSearchParams({ urls: url, category }), headers: qbtCookie ? { Cookie: qbtCookie } : {} });
  let r = await send();
  if (r.status === 403 || r.status === 401) { await qbtLogin(base); r = await send(); }
  // qBittorrent 5.1 et plus : 202 et compte rendu JSON (success_count, failure_count, pending_count) ; avant : « Ok. » ou « Fails. »
  const t = (await r.text()).trim();
  if (!r.ok) throw new Error('qBittorrent répond ' + r.status + (t ? ' ' + t.slice(0, 120) : ''));
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  const failed = j && typeof j === 'object' ? !(j.success_count > 0 || j.pending_count > 0 || (j.added_torrent_ids || []).length) && j.failure_count > 0 : /^fails/i.test(t);
  if (failed) throw new Error('torrent refusé par qBittorrent (déjà dans sa liste, ou lien invalide)');
}
// Renvoie true si la requête concernait les torrents
module.exports = function handleTorrent(req, res, u) {
  if (!u.pathname.startsWith('/torrent/')) return false;
  const json = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  // envoi à qBittorrent : sans le module torrent de l'appli
  if (u.pathname === '/torrent/qbt' && req.method === 'POST') {
    const parts = []; req.on('data', b => parts.push(b));
    req.on('end', async () => {
      let o; try { o = JSON.parse(Buffer.concat(parts).toString() || '{}'); } catch (e) { return json({ error: 'demande illisible' }, 400); }
      if (!/^(magnet:\?|https?:\/\/)/i.test(o.url || '')) return json({ error: 'lien attendu' }, 400);
      try { await qbtAdd(o.url, String(o.category || ''), +o.port || 8085); json({ ok: true }); } catch (e) { json({ error: e.message }, 502); }
    });
    return true;
  }
  let c;
  try { c = getClient(); } catch (e) { json({ error: 'module torrent indisponible : ' + e.message }, 500); return true; }
  if (u.pathname === '/torrent/add' && req.method === 'POST') {
    const parts = []; req.on('data', b => parts.push(b));
    req.on('end', () => {
      const body = Buffer.concat(parts).toString().trim();
      fromBody(body).then(src => add(src)).then(i => json(i), e => json({ error: e.message || String(e) }, 504));
    });
    return true;
  }
  if (u.pathname === '/torrent/info') {
    const t = c.get(u.searchParams.get('id') || ''); if (!t) { json({ error: 'torrent fermé' }, 404); return true; }
    const o = info(t), fi = u.searchParams.get('f');
    // fresque du fichier lu (comme la barre des morceaux de qBittorrent) : part reçue de chaque tranche, en 0 à 9, 200 tranches
    const f = fi != null && t.ready ? t.files[+fi] : null;
    if (f && f._endPiece >= f._startPiece) {
      const a = f._startPiece, n = f._endPiece - a + 1, W = Math.min(200, n); let map = '';
      for (let k = 0; k < W; k++) { const p0 = a + Math.floor(k * n / W), p1 = a + Math.floor((k + 1) * n / W); let got = 0; for (let i = p0; i < Math.max(p1, p0 + 1); i++) if (t.bitfield.get(i)) got++; map += Math.round(9 * got / Math.max(1, p1 - p0)); }
      o.map = map; o.fprog = f.progress; o.fsize = f.length;
    }
    json(o); return true;
  }
  if (u.pathname === '/torrent/stop') { const t = c.get(u.searchParams.get('id') || ''); if (t) { idxTouch(t); t.destroy({ destroyStore: false }); } json({ ok: true }); return true; }   // fichiers gardés une semaine
  const m = /^\/torrent\/file\/([0-9a-f]{40})\/(\d+)\//i.exec(u.pathname);
  if (m) { const t = c.get(m[1]), f = t && t.files[+m[2]]; if (!f) { res.statusCode = 404; res.end(); return true; }
    // fichier lu : c'est lui qui est demandé aux pairs (et plus le précédent, pour un épisode suivant)
    if (!t._idxAt || Date.now() - t._idxAt > 3600e3) { t._idxAt = Date.now(); idxTouch(t); }   // dernière lecture
    if (t._playing !== +m[2]) { const p = t._playing != null ? t.files[t._playing] : mainFile(t); if (p && p !== f) p.deselect(); f.select(); t._playing = +m[2]; }
    sendFile(t, f, req, res); return true; }
  res.statusCode = 404; res.end(); return true;
};
