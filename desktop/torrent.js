// Lecture de vidéos depuis un torrent fourni par l'utilisateur (lien magnet ou fichier .torrent), pour ses propres fichiers.
// Client webtorrent : rien n'est téléchargé d'avance, seuls les morceaux demandés par la lecture (dans l'ordre) arrivent ;
// la vidéo est servie en local avec gestion des plages (Range), puis lue par le convertisseur habituel (ffmpeg).
// Comme tout client torrent, les morceaux reçus sont repartagés tant que le torrent est ouvert.
//   POST /torrent/add      corps : lien magnet, ou fichier .torrent en base64 → { id, name, files: [{ i, name, size, video }] }
//   GET  /torrent/info?id= avancement (progression, pairs, débit)
//   GET  /torrent/file/<id>/<i>/<nom>   la vidéo (avec Range)
//   GET  /torrent/stop?id= fermeture du torrent et suppression de ses morceaux
const path = require('path');
const os = require('os');
const fs = require('fs');

const DIR = path.join(os.tmpdir(), 'lecteur-iptv-torrents');
const VIDEO = /\.(mkv|mp4|avi|mov|m4v|webm|ts|m2ts|wmv|flv|mpg|mpeg|ogv)$/i;
let client = null;
function getClient() {
  if (!client) {
    const WebTorrent = require('webtorrent');
    client = new WebTorrent({ utp: false });            // pas de module natif à compiler
    client.on('error', () => {});
  }
  return client;
}
// à la fermeture de l'appli : torrents fermés, morceaux supprimés
process.on('exit', () => { try { if (client) client.destroy(); } catch (e) {} try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {} });

const info = t => ({ id: t.infoHash, name: t.name, files: t.files.map((f, i) => ({ i, name: f.name, size: f.length, video: VIDEO.test(f.name) })),
  progress: t.progress, peers: t.numPeers, down: t.downloadSpeed });

function add(src) {
  return new Promise((resolve, reject) => {
    const c = getClient(), old = c.get(src);
    if (old && old.ready) return resolve(info(old));
    let done = false;
    const timer = setTimeout(() => { if (done) return; done = true; try { const t = c.get(src); if (t) t.destroy(); } catch (e) {} reject(new Error('aucun pair trouvé en 90 s (torrent sans source en ligne ?)')); }, 90000);
    try {
      c.add(src, { path: DIR, destroyStoreOnDestroy: true }, t => {
        if (done) return; done = true; clearTimeout(timer);
        t.deselect(0, t.pieces.length - 1, false);        // rien d'avance : seulement ce que la lecture demande
        resolve(info(t));
      });
    } catch (e) { done = true; clearTimeout(timer); reject(e); }
  });
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

// Renvoie true si la requête concernait les torrents
module.exports = function handleTorrent(req, res, u) {
  if (!u.pathname.startsWith('/torrent/')) return false;
  const json = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  let c;
  try { c = getClient(); } catch (e) { json({ error: 'module torrent indisponible : ' + e.message }, 500); return true; }
  if (u.pathname === '/torrent/add' && req.method === 'POST') {
    const parts = []; req.on('data', b => parts.push(b));
    req.on('end', () => {
      const body = Buffer.concat(parts).toString().trim();
      let src = body;
      if (!/^magnet:\?/i.test(body)) { try { src = Buffer.from(body, 'base64'); if (src.length < 50) throw new Error(); } catch (e) { return json({ error: 'lien magnet ou fichier .torrent attendu' }, 400); } }
      add(src).then(i => json(i), e => json({ error: e.message || String(e) }, 504));
    });
    return true;
  }
  if (u.pathname === '/torrent/info') { const t = c.get(u.searchParams.get('id') || ''); json(t ? info(t) : { error: 'torrent fermé' }, t ? 200 : 404); return true; }
  if (u.pathname === '/torrent/stop') { const t = c.get(u.searchParams.get('id') || ''); if (t) t.destroy({ destroyStore: true }); json({ ok: true }); return true; }
  const m = /^\/torrent\/file\/([0-9a-f]{40})\/(\d+)\//i.exec(u.pathname);
  if (m) { const t = c.get(m[1]), f = t && t.files[+m[2]]; if (!f) { res.statusCode = 404; res.end(); return true; } sendFile(t, f, req, res); return true; }
  res.statusCode = 404; res.end(); return true;
};
