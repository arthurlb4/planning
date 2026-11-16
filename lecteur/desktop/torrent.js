// Lecture de vidéos depuis un torrent fourni par l'utilisateur (lien magnet ou fichier .torrent), pour ses propres fichiers.
// Client webtorrent : rien n'est téléchargé d'avance, seuls les morceaux demandés par la lecture (dans l'ordre) arrivent ;
// la vidéo est servie en local avec gestion des plages (Range), puis lue par le convertisseur habituel (ffmpeg).
// Comme tout client torrent, les morceaux reçus sont repartagés tant que le torrent est ouvert.
//   POST /torrent/add      corps : lien magnet, fichier .torrent en base64, ou adresse http(s) d'un .torrent (lien de
//                          téléchargement de Prowlarr, qui peut aussi renvoyer vers un lien magnet) → { id, name, files }
//   GET  /torrent/info?id= avancement (progression, pairs, débit)
//   GET  /torrent/file/<id>/<i>/<nom>   la vidéo (avec Range)
//   GET  /torrent/stop?id= fermeture du torrent (fichiers gardés une semaine après la dernière lecture, 80 Go au plus)
//   GET  /torrent/prefetch?id=&f= début d'un autre fichier du torrent demandé d'avance (épisode suivant)
//   Dossier : celui de qBittorrent (même disque que la médiathèque). En fin de lecture, le torrent passe à qBittorrent, qui
//   reprend les morceaux déjà reçus, finit le téléchargement et partage (ratio) ; Radarr / Sonarr le rangent ensuite.
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
let client = null, clientErr = '', blocked = false;
const VPN_MSG = 'VPN inactif : connectez CyberGhost (torrents et indexeur bloqués sans VPN)';
function getClient() {
  if (!client || client.destroyed) {
    const WebTorrent = require('webtorrent');
    client = new WebTorrent({ utp: false, maxConns: 50 });   // pas de module natif à compiler
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
function idxTouch(t, extra) {
  if (!t || !t.infoHash || !t.name) return; const o = idxRead(), e = Object.assign({ name: t.name, size: t.length || 0, at: Date.now(), dir: t.path || DIR, cat: t._cat || '' }, extra || {});
  if (t.ready && t.bitfield && t.bitfield.buffer) { e.bf = Buffer.from(t.bitfield.buffer).toString('base64'); e.np = t.pieces.length; e.mt = fileTimes(t); }
  o[t.infoHash] = e; idxWrite(o);
}
const fileTimes = t => t.files.map(f => { try { return Math.round(fs.statSync(path.join(t.path || DIR, f.path)).mtimeMs); } catch (e) { return 0; } }).join(',');
// réouverture d'un torrent déjà lu : morceaux reçus repris de l'index si les fichiers n'ont pas bougé, sans tout recontrôler
function fastResume(t) {
  t.once('metadata', () => {
    const q = RESUME.get(t.infoHash);       // repris de qBittorrent : ses morceaux terminés, sans recontrôle
    if (q) { RESUME.delete(t.infoHash); t._verifyPieces = cb => { q.forEach((v, i) => { if (v === 2 && i < t.pieces.length) t._markVerified(i); }); queueMicrotask(() => cb(null)); }; return; }
    const e = idxRead()[t.infoHash];
    if (!e || !e.bf || e.np !== t.pieces.length || e.mt !== fileTimes(t)) return;
    const bf = Buffer.from(e.bf, 'base64');
    t._verifyPieces = cb => { for (let i = 0; i < t.pieces.length; i++) if (bf[i >> 3] & (128 >> (i % 8))) t._markVerified(i); queueMicrotask(() => cb(null)); };
  });
}
function cleanup() {
  const o = idxRead(), open = new Set(client ? client.torrents.map(t => t.infoHash) : []);
  const rm = h => { const e = o[h]; if (e && e.name && !/[\\/]|^\.\.?$/.test(e.name)) try { fs.rmSync(path.join(e.dir || DIR, e.name), { recursive: true, force: true }); } catch (er) {} try { fs.rmSync(path.join(META, h + '.torrent'), { force: true }); } catch (er) {} delete o[h]; };
  // passés à qBittorrent : à lui de les garder
  Object.keys(o).forEach(h => { if (!open.has(h) && !o[h].qbt && Date.now() - o[h].at > KEEP) rm(h); });
  let tot = Object.values(o).reduce((a, e) => a + (e.qbt ? 0 : e.size || 0), 0);
  Object.keys(o).filter(h => !open.has(h) && !o[h].qbt).sort((a, b) => o[a].at - o[b].at).forEach(h => { if (tot > MAXB) { tot -= o[h].size || 0; rm(h); } });
  // fichiers d'avant le suivi (anciennes versions) : supprimés s'ils datent de plus d'une semaine
  const known = new Set(Object.values(o).map(e => e.name));
  try { fs.readdirSync(DIR).forEach(n => { if (n === '.index.json' || n === '.meta' || known.has(n)) return; const f = path.join(DIR, n); try { if (Date.now() - fs.statSync(f).mtimeMs > KEEP) fs.rmSync(f, { recursive: true, force: true }); } catch (e) {} }); } catch (e) {}
  idxWrite(o);
}
setTimeout(() => { cleanup(); giveLeft(); }, 30e3); setInterval(cleanup, 6 * 3600e3);
// à la fermeture de l'appli : torrents fermés, fichiers gardés ; ceux assez avancés passent à qBittorrent au lancement suivant
process.on('exit', () => { try { if (client) client.torrents.forEach(t => idxTouch(t, worth(t) ? { give: 1, w: [...(t._watched || [])] } : null)); } catch (e) {} try { if (client) client.destroy(); } catch (e) {} });

// progression : celle du fichier en lecture (sinon du plus gros fichier vidéo) ; « known » = pairs trouvés par les trackers
// et le DHT, pas encore forcément connectés
const mainFile = t => t._playing != null ? t.files[t._playing] : t.files.filter(f => VIDEO.test(f.name)).sort((a, b) => b.length - a.length)[0];
const info = t => { const f = t.ready && mainFile(t);
  return { id: t.infoHash, name: t.name, files: (t.files || []).map((f, i) => ({ i, name: f.name, size: f.length, video: VIDEO.test(f.name) })),
    progress: f ? f.progress : t.progress, peers: t.numPeers, known: t._peersLength || 0, down: t.downloadSpeed, up: t.uploadSpeed,
    warn: t._lastWarn || '', err: clientErr }; };

/* Description du torrent (.torrent) gardée sur le disque dès qu'elle est connue : un torrent déjà ouvert une fois se rouvre
   tout de suite, sans redemander sa description aux pairs (plusieurs secondes, parfois plus) */
const META = path.join(DIR, '.meta');
function btih(src) {
  const m = /xt=urn:btih:([0-9a-z]+)/i.exec(String(src)); if (!m) return '';
  let h = m[1];
  if (h.length === 32) {                                     // base 32 → hexadécimal
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
    for (const ch of h.toUpperCase()) { const v = A.indexOf(ch); if (v < 0) return ''; bits += v.toString(2).padStart(5, '0'); }
    h = bits.match(/.{4}/g).map(b => parseInt(b, 2).toString(16)).join('');
  }
  return /^[0-9a-f]{40}$/i.test(h) ? h.toLowerCase() : '';
}
function metaSave(t) { try { if (t && t.infoHash && t.torrentFile) { fs.mkdirSync(META, { recursive: true }); const f = path.join(META, t.infoHash + '.torrent'); if (!fs.existsSync(f)) fs.writeFileSync(f, t.torrentFile); } } catch (e) {} }
function metaLoad(src) { try { const h = typeof src === 'string' ? btih(src) : ''; const f = h && path.join(META, h + '.torrent'); return f && fs.existsSync(f) ? fs.readFileSync(f) : null; } catch (e) { return null; } }
async function add(src, cat) {
  const h = typeof src === 'string' ? btih(src) : bufHash(src), c = getClient();
  let dir = null;
  if (h && !c.get(h)) {
    const q = await qbtHas(h).catch(() => null);
    if (q && q.done) return q.info;                      // déjà fini dans qBittorrent : lu depuis le disque, tout de suite
    if (q) dir = await qbtTakeBack(q).catch(() => null);  // pas fini : repris le temps de la lecture, puis rendu
    cat = cat || (q && q.t.category) || '';
  }
  if (!dir) dir = await dlDir();
  return addWt(src, cat, dir);
}
function addWt(src, cat, dir) {
  return new Promise((resolve, reject) => {
    const c = getClient(), old = c.get(src);
    const saved = !old ? metaLoad(src) : null; if (saved) { const t0 = c.get(btih(src)); if (t0 && t0.ready) return resolve(info(t0)); }
    if (old && old.ready) return resolve(info(old));
    let done = false;
    const timer = setTimeout(() => { if (done) return; done = true; try { const t = c.get(src); if (t) t.destroy(); } catch (e) {} reject(new Error('aucun pair trouvé en 90 s (torrent sans source en ligne ?)' + (clientErr ? ' · ' + clientErr : ''))); }, 90000);
    try {
      const opts = { path: dir, destroyStoreOnDestroy: false };
      if (typeof src === 'string' || saved) opts.announce = TRACKERS;
      const t = c.add(saved || src, opts, t => {
        if (done) return; done = true; clearTimeout(timer); t._cat = cat || ''; t._watched = new Set(WATCHED.get(t.infoHash) || []); WATCHED.delete(t.infoHash);
        // Seul le fichier vidéo principal est demandé (pas les bonus, sous-titres…), dans l'ordre ; il ne faut pas tout
        // désélectionner : sans rien à demander, l'appli n'intéresse plus les pairs, qui coupent la connexion (0 source)
        t.deselect(0, t.pieces.length - 1, false);
        t.files.forEach(f => f.deselect());
        const f = mainFile(t); if (f) f.select();
        idxTouch(t); metaSave(t);
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
      // « localhost » essayé d'abord en IPv6 (::1) par Node alors que Prowlarr n'écoute souvent qu'en IPv4 : 127.0.0.1 en secours ;
      // erreur réseau : la cause précise (connexion refusée, délai, nom inconnu…) dans le message
      const get = u => fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
      let r;
      try { r = await get(url); }
      catch (e) {
        const lh = /^(https?:\/\/)(localhost)([:/])/i.exec(url);
        if (lh) { try { r = await get(url.replace(/^(https?:\/\/)localhost/i, '$1127.0.0.1')); } catch (e2) { e = e2; } }
        if (!r) { const c = e && e.cause && (e.cause.code || e.cause.message) || (e && e.name === 'TimeoutError' ? 'délai dépassé' : ''); throw new Error('lien du torrent injoignable' + (c ? ' (' + c + ')' : '') + ' : ' + new URL(url).host + ' · Prowlarr démarré ? indexeur en ligne ?'); }
      }
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
async function qbtEnsure(base) {
  if (!(await qbtUp(base))) {
    const exe = QBT_EXE.find(f => { try { return fs.existsSync(f); } catch (e) { return false; } });
    if (!exe) throw new Error('qBittorrent n\'est pas installé sur ce PC (installateur de la médiathèque, ou qbittorrent.org)');
    require('child_process').spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
    let up = false; for (let k = 0; k < 20 && !up; k++) { await pause(1000); up = await qbtUp(base); }
    const port = new URL(base).port;
    if (!up) throw new Error('qBittorrent est lancé mais son interface web ne répond pas sur le port ' + port + ' : Outils › Options › Interface web, activez-la sur le port ' + port);
  }
}
async function qbtAdd(url, category, port) {
  const base = 'http://127.0.0.1:' + port;
  await qbtEnsure(base);
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
/* ---------- Un seul téléchargement : l'appli et qBittorrent dans le même dossier ----------
   Lecture : l'appli télécharge dans le dossier de qBittorrent (lu dans ses réglages). Fin de lecture (ou appli fermée, au
   lancement suivant) : si le film a bien commencé, le torrent est confié à qBittorrent dans ce même dossier ; il contrôle ce
   qui est déjà là, ne télécharge que le reste et partage ensuite (ratio). Relu plus tard : fini, il est lu depuis le disque ;
   pas fini, l'appli le reprend le temps de la lecture (morceaux déjà terminés repris de qBittorrent), puis le rend. */
const QBT = 'http://127.0.0.1:8085', QDIR = path.join(DIR, '.qbtdir'), QB = new Map(), RESUME = new Map(), WATCHED = new Map();
async function qbt(p, opts) {
  opts = opts || {};
  const go = () => fetch(QBT + p, { method: opts.method || 'GET', body: opts.body, signal: AbortSignal.timeout(opts.timeout || 8000), headers: qbtCookie ? { Cookie: qbtCookie } : {} });
  let r = await go(); if (r.status === 403 || r.status === 401) { await qbtLogin(QBT); r = await go(); }
  const t = await r.text(); if (!r.ok) throw new Error('qBittorrent répond ' + r.status + ' ' + t.slice(0, 80));
  try { return JSON.parse(t); } catch (e) { return t; }
}
const form = o => new URLSearchParams(o);
function bufHash(b) { try { return require('parse-torrent')(b).infoHash || ''; } catch (e) { return ''; } }
// assez avancé pour valoir la peine d'être fini et partagé (sinon : gardé une semaine comme avant, puis supprimé)
const worth = t => { if (!t || !t.ready) return false; const f = mainFile(t); return (f && f.progress >= 0.05) || t.downloaded > 300e6; };
let qdir = ''; try { qdir = fs.readFileSync(QDIR, 'utf8').trim(); } catch (e) {}
async function dlDir() {
  if (await qbtUp(QBT)) try {
    const p = await qbt('/api/v2/app/preferences');
    if (p && p.save_path) { qdir = path.resolve(p.save_path); fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(QDIR, qdir); }
  } catch (e) {}
  try { if (qdir) { fs.mkdirSync(qdir, { recursive: true }); return qdir; } } catch (e) {}
  return DIR;
}
const VID = n => VIDEO.test(n);
async function qbtHas(h) {
  if (!(await qbtUp(QBT))) return null;
  const l = await qbt('/api/v2/torrents/info?hashes=' + h); const t = Array.isArray(l) && l[0]; if (!t) return null;
  const files = await qbt('/api/v2/torrents/files?hash=' + h); if (!Array.isArray(files)) return null;
  // lu depuis le disque seulement si toutes les vidéos sont là (épisodes pas gardés : repris par l'appli, qui les télécharge)
  const vids = files.filter(f => VID(f.name)), done = vids.length > 0 && vids.every(f => f.progress >= 1);
  const q = { h, t, files, done, save: t.save_path,
    info: { id: h, name: t.name, files: files.map((f, i) => ({ i: f.index != null ? f.index : i, name: path.basename(f.name), size: f.size, video: VID(f.name) })),
      progress: 1, peers: 0, known: 0, down: 0, up: 0, warn: '', err: '', qbt: true } };
  if (done) QB.set(h, q);
  return q;
}
// torrent pas fini dans qBittorrent : arrêté et retiré de sa liste (fichiers gardés), repris par l'appli dans le même dossier
async function qbtTakeBack(q) {
  const t = q.t, own = path.resolve(t.content_path || '') === path.resolve(t.save_path, t.name);
  if (!own) return null;                                  // rangement différent du torrent : laissé à qBittorrent
  WATCHED.set(q.h, q.files.map((f, i) => [f.index != null ? f.index : i, f]).filter(([, f]) => VID(f.name) && f.priority > 0).map(([i]) => i));
  if (!/^checking|^moving/i.test(t.state || '')) { const ps = await qbt('/api/v2/torrents/pieceStates?hash=' + q.h).catch(() => null); if (Array.isArray(ps)) RESUME.set(q.h, ps); }
  await qbt('/api/v2/torrents/stop', { method: 'POST', body: form({ hashes: q.h }) }).catch(() => qbt('/api/v2/torrents/pause', { method: 'POST', body: form({ hashes: q.h }) }).catch(() => {}));
  await qbt('/api/v2/torrents/delete', { method: 'POST', body: form({ hashes: q.h, deleteFiles: 'false' }) });
  QB.delete(q.h);
  return path.resolve(t.save_path);
}
async function qbtGiveBuf(buf, h, dir, cat, watched) {
  await qbtEnsure(QBT);
  const fd = new FormData();
  fd.append('torrents', new Blob([buf], { type: 'application/x-bittorrent' }), h + '.torrent');
  fd.append('savepath', dir); fd.append('category', cat || ''); fd.append('tags', 'lecteur');
  fd.append('autoTMM', 'false'); fd.append('contentLayout', 'Original'); fd.append('useDownloadPath', 'false');
  const r = String(await qbt('/api/v2/torrents/add', { method: 'POST', body: fd, timeout: 30000 }));
  if (/^fails/i.test(r.trim()) && !(await qbtHas(h).catch(() => null))) throw new Error('torrent refusé par qBittorrent');
  const o = idxRead(); if (o[h]) { o[h].qbt = 1; delete o[h].give; idxWrite(o); }
  if (watched && watched.length) qbtOnly(h, watched).catch(() => {});
}
/* Saison complète (ou film avec bonus) : qBittorrent ne finit que les vidéos regardées ; les autres épisodes ne sont pas
   téléchargés (priorité « ne pas télécharger »). Relu plus tard, un nouvel épisode regardé s'ajoute à la liste. */
async function qbtOnly(h, watched) {
  const keep = new Set(watched);
  for (let k = 0; k < 15; k++) {                          // le torrent apparaît dans qBittorrent après quelques instants
    const files = await qbt('/api/v2/torrents/files?hash=' + h).catch(() => null);
    if (Array.isArray(files) && files.length) {
      const off = files.map((f, i) => [f.index != null ? f.index : i, f]).filter(([i, f]) => VID(f.name) && !keep.has(i)).map(([i]) => i);
      if (off.length) await qbt('/api/v2/torrents/filePrio', { method: 'POST', body: form({ hash: h, id: off.join('|'), priority: '0' }) });
      return;
    }
    await pause(1000);
  }
}
async function give(t) {
  const buf = t.torrentFile, h = t.infoHash, dir = t.path || DIR, cat = t._cat || '', watched = [...(t._watched || [])];
  idxTouch(t, { give: 1, w: watched });                               // repris au lancement suivant si l'envoi échoue
  await new Promise(r => { try { t.destroy({ destroyStore: false }, () => r()); } catch (e) { r(); } });
  await qbtGiveBuf(buf, h, dir, cat, watched);
}
// torrents laissés ouverts à la fermeture de l'appli (ou envoi raté) : confiés à qBittorrent maintenant
async function giveLeft() {
  const o = idxRead();
  for (const [h, e] of Object.entries(o)) {
    if (!e.give || e.qbt || (client && client.get(h))) continue;
    let buf = null; try { buf = fs.readFileSync(path.join(META, h + '.torrent')); } catch (er) { continue; }
    await qbtGiveBuf(buf, h, e.dir || DIR, e.cat || '', e.w).catch(() => {});
  }
}
// épisode suivant d'une saison complète : son début (≈ 64 Mo) demandé d'avance, pendant la fin de l'épisode en cours
function prefetch(t, f) {
  if (!t || !t.ready || !f || f._startPiece == null) return false;
  const n = Math.max(2, Math.ceil(64e6 / t.pieceLength));
  t.select(f._startPiece, Math.min(f._endPiece, f._startPiece + n), 1);
  t.select(Math.max(f._startPiece, f._endPiece - 1), f._endPiece, 1);   // fin du fichier (index de certains formats)
  return true;
}
const diskFile = (q, i) => { const f = q.files.find((x, k) => (x.index != null ? x.index : k) === i); if (!f) return null;
  const p = path.join(q.save, f.name); return { name: path.basename(f.name), length: f.size, createReadStream: o => fs.createReadStream(p, o) }; };
// Renvoie true si la requête concernait les torrents
module.exports = function handleTorrent(req, res, u) {
  if (!u.pathname.startsWith('/torrent/')) return false;
  const json = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  // blocage sans VPN (décidé par la page) : torrents en pause, connexions coupées, aucun nouveau torrent
  if (u.pathname === '/torrent/guard') {
    blocked = u.searchParams.get('block') === '1';
    if (client && !client.destroyed) client.torrents.forEach(t => { try { if (blocked) { t.pause(); (t.wires || []).slice().forEach(w => w.destroy()); } else t.resume(); } catch (e) {} });
    json({ ok: true, blocked }); return true;
  }
  if (blocked && (u.pathname === '/torrent/add' || u.pathname === '/torrent/qbt')) { json({ error: VPN_MSG }, 403); return true; }
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
      fromBody(body).then(src => add(src, u.searchParams.get('cat') || '')).then(i => json(i), e => json({ error: e.message || String(e) }, 504));
    });
    return true;
  }
  // torrents gardés sur le PC (lus depuis moins d'une semaine) : nom, taille, part reçue, dernière lecture
  if (u.pathname === '/torrent/list') { (async () => {
    const o = idxRead(), qh = Object.keys(o).filter(h => o[h].qbt), qp = {};
    if (qh.length && await qbtUp(QBT)) { const l = await qbt('/api/v2/torrents/info?hashes=' + qh.join('|')).catch(() => null); (Array.isArray(l) ? l : []).forEach(x => { qp[x.hash] = x.progress; }); }
    const out = Object.entries(o).map(([id, e]) => {
      let pct = 0;
      const t = c.get(id); if (t && t.ready) pct = t.progress || 0;
      else if (e.qbt && qp[id] != null) pct = qp[id];
      else if (e.bf && e.np) { const b = Buffer.from(e.bf, 'base64'); let n = 0; for (let i = 0; i < e.np; i++) if (b[i >> 3] & (128 >> (i & 7))) n++; pct = n / e.np; }
      return { id, name: e.name, size: e.size || 0, at: e.at || 0, pct, qbt: !!e.qbt };
    }).sort((a, b) => b.at - a.at);
    json(out); })().catch(e => json({ error: e.message }, 500)); return true;
  }
  if (u.pathname === '/torrent/prefetch') {
    const t = c.get(u.searchParams.get('id') || ''), f = t && t.ready ? t.files[+u.searchParams.get('f')] : null;
    json({ ok: prefetch(t, f) }); return true;
  }
  if (u.pathname === '/torrent/info') {
    const t = c.get(u.searchParams.get('id') || ''), q0 = !t && QB.get(u.searchParams.get('id') || '');
    if (q0) { json(Object.assign({}, q0.info, { fprog: 1 })); return true; }
    if (!t) { json({ error: 'torrent fermé' }, 404); return true; }
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
  // fin de lecture : confié à qBittorrent s'il a bien commencé (fini et partagé par lui), sinon fermé (fichiers gardés une semaine)
  if (u.pathname === '/torrent/stop') {
    const t = c.get(u.searchParams.get('id') || '');
    if (t && worth(t) && !blocked) { give(t).then(() => json({ ok: true, qbt: true }), e => json({ ok: true, qbt: false, error: e.message })); return true; }
    if (t) { idxTouch(t); t.destroy({ destroyStore: false }); } json({ ok: true }); return true;
  }
  const m = /^\/torrent\/file\/([0-9a-f]{40})\/(\d+)\//i.exec(u.pathname);
  if (m) { const t = c.get(m[1]), f = t && t.files[+m[2]];
    if (!t && QB.has(m[1].toLowerCase())) { const d = diskFile(QB.get(m[1].toLowerCase()), +m[2]); if (d) { sendFile(null, d, req, res); return true; } }
    if (!f) { res.statusCode = 404; res.end(); return true; }
    // fichier lu : c'est lui qui est demandé aux pairs (et plus le précédent, pour un épisode suivant)
    if (!t._idxAt || Date.now() - t._idxAt > 3600e3) { t._idxAt = Date.now(); idxTouch(t); }   // dernière lecture
    (t._watched || (t._watched = new Set())).add(+m[2]);   // vidéo regardée : gardée par qBittorrent
    if (t._playing !== +m[2]) { const p = t._playing != null ? t.files[t._playing] : mainFile(t); if (p && p !== f) p.deselect(); f.select(); t._playing = +m[2]; }
    sendFile(t, f, req, res); return true; }
  res.statusCode = 404; res.end(); return true;
};
