// Lecture des films MKV (et autres formats que Chromium ne lit pas) dans l'appli Windows : petit serveur local (127.0.0.1)
// qui fait passer le film par ffmpeg. L'image est gardée telle quelle (ou convertie si la carte graphique ne la décode pas),
// le son (souvent Dolby) est converti en AAC stéréo, le tout envoyé en MP4 fragmenté que l'appli lit directement.
//   /probe?url=…                       durée, pistes audio, codec vidéo
//   /remux?url=…&ss=…&a=…&v=copy|enc   film à partir de ss secondes, piste audio a
//   /live?url=…                        chaîne en direct, son converti en AAC (Dolby non lu par Chromium)
//   …&via=vlc                          le flux arrive par VLC (serveurs qui refusent ffmpeg)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
// processus lancés en priorité basse (ffmpeg, VLC) : une conversion lourde ne fige plus le PC
function spawn(cmd, args, opts) {
  const p = cp.spawn(cmd, args, opts);
  try { if (p.pid) os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
  return p;
}
const TEXT_SUBS = /^(subrip|srt|ass|ssa|mov_text|webvtt|text)$/i;   // sous-titres texte (les sous-titres en images ne se convertissent pas)
const SUBS = new Map();                                        // jeton → fichier WebVTT en cours d'écriture

// 403 : souvent la connexion précédente (chaîne ou film d'avant) que le serveur n'a pas encore libérée, alors qu'il
// n'autorise qu'une lecture à la fois par compte → on réessaie deux fois, 3 s plus tard.
async function probe(ffmpeg, src, vlcPath) {
  if (vlcPath) {                                     // par VLC : un second essai 3 s plus tard (connexion précédente pas encore libérée)
    const a = await probeOnce(ffmpeg, src, vlcPath); if (a.ok) return a;
    await new Promise(r => setTimeout(r, 3000));
    return probeOnce(ffmpeg, src, vlcPath);
  }
  let j;
  for (let k = 0; k < 3; k++) {
    if (k) await new Promise(r => setTimeout(r, 3000));
    j = await probeOnce(ffmpeg, src);
    if (j.ok || !/\b403\b|forbidden/i.test(j.err || '')) return j;
  }
  j.denied = true;
  return j;
}
function probeOnce(ffmpeg, src, vlcPath) {
  return new Promise(resolve => {
    const log = vlcPath ? path.join(os.tmpdir(), 'lecteur-iptv-vlc-' + Date.now().toString(36) + '.log') : '';
    const vlc = vlcPath ? vlcSource(vlcPath, src, 0, log) : null;
    const ff = spawn(ffmpeg, vlc ? ['-hide_banner', '-f', 'mpegts', '-i', 'pipe:0'] : ['-hide_banner', '-rw_timeout', '20000000', '-i', src], { windowsHide: true });
    if (vlc) viaVlc(ff, vlc);
    let txt = '';
    const done = () => {
      const d = txt.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      const duration = d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0;
      const lines = txt.split(/\r?\n/), audio = [], subs = [];
      let si = 0;
      let vcodec = '', vprofile = '', vh = 0;
      lines.forEach((l, i) => {
        const v = l.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\(([a-z]{2,3}|\?\?\?)\))?: Video: (\w+)(?: \(([^)]*)\))?/);
        if (v && !vcodec) { vcodec = v[2]; vprofile = v[3] || ''; const r = l.match(/,\s*(\d{3,5})x(\d{3,5})/); if (r) vh = +r[2]; }   // hauteur de l'image
        const a = l.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\(([a-z]{2,3}|\?\?\?)\))?: Audio: (\w+)[^,]*,\s*\d+ Hz,\s*([^,]+)/);
        if (a) {
          let title = '';
          for (let k = i + 1; k < Math.min(i + 6, lines.length) && !/Stream #/.test(lines[k]); k++) { const t = lines[k].match(/^\s+title\s*:\s*(.+)$/); if (t) title = t[1].trim(); }
          audio.push({ i: audio.length, lang: a[1] && a[1] !== '???' ? a[1] : '', codec: a[2], ch: a[3].trim(), title, def: /\(default\)/.test(l) });
        }
        const sb = l.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\(([a-z]{2,3}|\?\?\?)\))?: Subtitle: (\w+)/);
        if (sb) {
          let title = '';
          for (let k = i + 1; k < Math.min(i + 6, lines.length) && !/Stream #/.test(lines[k]); k++) { const t = lines[k].match(/^\s+title\s*:\s*(.+)$/); if (t) title = t[1].trim(); }
          if (TEXT_SUBS.test(sb[2])) subs.push({ i: si, lang: sb[1] && sb[1] !== '???' ? sb[1] : '', codec: sb[2], title, forced: /forced/i.test(l + title) });
          si++;
        }
      });
      // chapitres (générique de fin, intro…) : « Chapter #0:3: start 2520.0, end 2610.0 » puis « title : Credits »
      const chapters = [];
      lines.forEach((l, i) => {
        const c = l.match(/Chapter #\d+:\d+: start (-?[\d.]+), end (-?[\d.]+)/); if (!c) return;
        let title = '';
        for (let k = i + 1; k < Math.min(i + 4, lines.length) && !/Chapter #|Stream #/.test(lines[k]); k++) { const t = lines[k].match(/^\s+title\s*:\s*(.+)$/); if (t) title = t[1].trim(); }
        chapters.push({ start: +c[1], end: +c[2], title });
      });
      // En cas d'échec : la cause donnée par ffmpeg (erreur HTTP du serveur, délai, format…)
      const err = lines.filter(l => /error|failed|denied|forbidden|refused|timed out|invalid|not found|\b[45]\d\d\b/i.test(l) && !/^\s*(Stream|Duration|Input|Metadata)/.test(l)).slice(-3).join(' · ').slice(0, 300);
      let verr = '';
      if (vlc && !vcodec) {                          // cause donnée par VLC (journal) : erreurs de connexion, format non pris en charge…
        try { verr = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(l => /error|warning.*(http|access|mux)/i.test(l)).map(l => l.replace(/^.*?(error|warning)\s*:\s*/i, '')).filter((l, i, a) => a.indexOf(l) === i).slice(-4).join(' · ').slice(0, 300); } catch (e) {}
      }
      if (log) setTimeout(() => fs.unlink(log, () => {}), 2000);
      resolve({ duration, vcodec, vprofile, vh, audio, subs, chapters, ok: !!(duration || vcodec), err: vlc && !vcodec ? 'VLC n\'a rien pu lire' + (verr ? ' : ' + verr : '') : err, vlc: !!vlc });
    };
    ff.stderr.on('data', b => { txt += b; });
    ff.on('exit', done); ff.on('error', e => resolve({ ok: false, audio: [], err: 'ffmpeg ne démarre pas : ' + (e && e.message || e) }));
    setTimeout(() => { try { ff.kill('SIGKILL'); } catch (e) {} }, vlcPath ? 40000 : 25000);
  });
}

/* Aperçu d'une image du film (survol de la barre de lecture) : l'image clé la plus proche avant t, petite (160 px de haut),
   une seule à la fois (la précédente est abandonnée), gardée en mémoire */
const THUMB = { proc: null, cache: new Map() };
function thumb(ffmpeg, src, t, res) {
  const k = src + '|' + Math.round(t), c = THUMB.cache.get(k);
  const send = buf => { if (!buf || !buf.length) { res.statusCode = 204; return res.end(); } res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'max-age=3600'); res.end(buf); };
  if (c) return send(c);
  if (THUMB.proc) { try { THUMB.proc.kill('SIGKILL'); } catch (e) {} }
  // vignette : un seul cœur, priorité minimale (le reste du PC et la lecture passent avant)
  const ff = THUMB.proc = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-threads', '1', '-skip_frame', 'nokey', '-noaccurate_seek', '-ss', String(t), '-rw_timeout', '15000000', '-i', src,
    '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=-2:160', '-c:v', 'mjpeg', '-q:v', '6', '-f', 'image2pipe', 'pipe:1'], { windowsHide: true });
  try { if (ff.pid) os.setPriority(ff.pid, os.constants.priority.PRIORITY_LOW); } catch (e) {}
  const parts = []; let done = false;
  ff.stdout.on('data', b => parts.push(b));
  const end = () => { if (done) return; done = true; if (THUMB.proc === ff) THUMB.proc = null; const buf = Buffer.concat(parts);
    if (buf.length) { THUMB.cache.set(k, buf); if (THUMB.cache.size > 300) THUMB.cache.delete(THUMB.cache.keys().next().value); } send(buf); };
  ff.on('exit', end); ff.on('error', end);
  res.on('close', () => { if (!done) { try { ff.kill('SIGKILL'); } catch (e) {} } });
  setTimeout(() => { try { ff.kill('SIGKILL'); } catch (e) {} }, 15000);
}
/* Top SensCritique de l'année, lu depuis ce PC à la demande de l'utilisateur : page « Les meilleures séries de 2026 »
   retrouvée par la recherche du site, puis lue (__NEXT_DATA__ › __APOLLO_STATE__). Gardé 12 h en mémoire. */
const SCT = new Map();
async function scTop(k, y) {
  if ((k !== 'films' && k !== 'series') || !(y >= 2000 && y <= 2100)) return { error: 'paramètres', items: [] };
  const ck = k + y, c = SCT.get(ck); if (c && Date.now() - c.at < 12 * 3600e3) return c.data;
  const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' };
  const slug = k === 'films' ? 'les_meilleurs_films_de_' + y : 'les_meilleures_series_de_' + y, out = { url: '', items: [] };
  try {
    const q = k === 'films' ? 'meilleurs films de ' + y : 'meilleures séries de ' + y;
    const st = await (await fetch('https://www.senscritique.com/search?query=' + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(20000) })).text();
    const m = new RegExp('/top/resultats/' + slug + '/(\\d+)').exec(st);
    if (m) {
      out.url = 'https://www.senscritique.com/top/resultats/' + slug + '/' + m[1];
      const html = await (await fetch(out.url, { headers: UA, signal: AbortSignal.timeout(20000) })).text();
      const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
      const ap = nd ? ((JSON.parse(nd[1]).props || {}).pageProps || {}).__APOLLO_STATE__ || {} : {};
      const poll = ap['Poll:' + m[1]] || {}, refs = poll.minimalProducts || poll.products || [];
      out.items = refs.map(r => { const x = ap[r && r.__ref] || {}; if (!x.title) return null; return { t: x.title, o: x.originalTitle || '', d: x.dateRelease || x.frenchReleaseDate || '', r: x.rating || 0, p: (x.medias && x.medias.picture) || '' }; }).filter(Boolean).slice(0, 100);
    } else out.error = 'page du top introuvable';
  } catch (e) { out.error = String(e && e.message || e); }
  if (out.items.length) SCT.set(ck, { at: Date.now(), data: out });
  return out;
}
// Image clé d'où ffmpeg partira réellement pour un départ à ss secondes (même recherche que /remux, qui doit recevoir le même
// ss), en secondes depuis le début du film (moment d'affichage) ; null si on ne la trouve pas
function seekPoint(ffmpeg, src, ss) {
  return new Promise(resolve => {
    if (!ss) return resolve(0);
    const ff = spawn(ffmpeg, ['-hide_banner', '-copyts', '-noaccurate_seek', '-ss', String(ss), '-rw_timeout', '20000000', '-i', src, '-map', '0:v:0', '-c', 'copy', '-frames:v', '1', '-f', 'framecrc', '-'], { windowsHide: true });
    let out = '', err = '', done = false;
    const end = () => {
      if (done) return; done = true;
      const tb = /#tb 0:\s*(\d+)\/(\d+)/.exec(out), pk = /^0,\s*(-?\d+),\s*(-?\d+)/m.exec(out), st = /start:\s*(-?[\d.]+)/.exec(err);
      if (!tb || !pk) return resolve(null);
      const kf = +pk[2] * +tb[1] / +tb[2] - (st ? +st[1] : 0);
      resolve(isFinite(kf) && kf <= ss + 0.5 && kf > ss - 60 ? Math.max(0, Math.round(kf * 1000) / 1000) : null);
    };
    ff.stdout.on('data', b => { out += b; }); ff.stderr.on('data', b => { err += b; });
    ff.on('exit', end); ff.on('error', () => { done = true; resolve(null); });
    setTimeout(() => { try { ff.kill('SIGKILL'); } catch (e) {} }, 25000);
  });
}

/* VLC en coulisse, pour les serveurs qui refusent ffmpeg mais acceptent VLC. VLC est arrêté dès que la page
   ferme la connexion, et ceux encore ouverts le sont quand l'appli se ferme. */
const VLCS = new Set();
process.on('exit', () => VLCS.forEach(v => { try { v.kill('SIGKILL'); } catch (e) {} }));
// VLC lit la source (il passe là où ffmpeg est refusé) à partir de ss secondes et écrit le film tel quel (image et
// toutes les pistes audio, sans sous-titres) en MPEG-TS sur sa sortie standard, que ffmpeg reprend ensuite en local.
function vlcSource(vlcPath, src, ss, log) {
  const lg = log ? ['--file-logging', '--logfile=' + log, '--log-verbose=1'] : ['--quiet'];
  const args = ['-I', 'dummy', ...lg, '--no-video-title-show', '--network-caching=3000', '--play-and-exit', '--no-spu',
    src, ':start-time=' + Math.max(0, ss || 0), ':sout=#std{access=file,mux=ts,dst=-}', ':sout-all'];
  const vlc = spawn(vlcPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  VLCS.add(vlc); vlc.on('exit', () => VLCS.delete(vlc)); vlc.on('error', () => {});
  vlc.stop = () => { try { vlc.kill('SIGKILL'); } catch (e) {} };
  return vlc;
}
// ffmpeg branché sur la sortie de VLC (au lieu de lire le serveur lui-même)
function viaVlc(ff, vlc) {
  ff.stdin.on('error', () => {}); vlc.stdout.on('error', () => {});
  vlc.stdout.pipe(ff.stdin);
  ff.on('exit', () => vlc.stop()); vlc.on('exit', () => { try { ff.stdin.end(); } catch (e) {} });
}

/* Client torrent dans un processus à part (Node d'Electron, priorité basse) : son travail (connexions, disque, contrôle des
   morceaux) ne peut plus figer la fenêtre de l'appli ni le PC. Il sert /torrent/… sur son propre port, relayé ici ;
   relancé s'il s'arrête. */
const TP = { port: 0, child: null, wait: null };
function torrentProc() {
  if (TP.port && TP.child && TP.child.exitCode === null) return Promise.resolve(TP.port);
  if (TP.wait) return TP.wait;
  TP.wait = new Promise((resolve, reject) => {
    const child = cp.fork(path.join(__dirname, 'torrent-proc.js'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true, env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }) });
    try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
    const t = setTimeout(() => { TP.wait = null; reject(new Error('module torrent : pas de réponse')); }, 20000);
    child.on('message', m => { if (m && m.port) { clearTimeout(t); TP.port = m.port; TP.child = child; TP.wait = null; resolve(m.port); } });
    child.on('exit', () => { if (TP.child === child) { TP.child = null; TP.port = 0; } TP.wait = null; clearTimeout(t); });
    child.on('error', e => { TP.wait = null; clearTimeout(t); reject(e); });
  });
  return TP.wait;
}
// appli fermée : le processus des torrents est prévenu (il confie ses torrents à qBittorrent puis s'arrête seul) ; tué tout de
// suite seulement pour une mise à jour (il bloquerait le remplacement des fichiers de l'appli)
process.on('exit', () => { try { if (TP.child) { if (process.env.LECTEUR_MAJ) TP.child.kill(); else TP.child.disconnect(); } } catch (e) {} });
function torrentProxy(req, res) {
  torrentProc().then(port => {
    const up = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, r => {
      const h = Object.assign({}, r.headers, { 'access-control-allow-origin': '*' });
      res.writeHead(r.statusCode, h); r.pipe(res);
    });
    up.on('error', () => { if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'module torrent injoignable' })); } else res.destroy(); });
    res.on('close', () => up.destroy());
    req.pipe(up);
  }, e => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); });
}

module.exports = function startRemux(ffmpeg, findVlc) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      // Page chargée depuis Internet → serveur local : autorisations demandées par Chrome (CORS, accès au réseau local)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
      if (u.pathname === '/ping') return res.end('ok');
      // Prowlarr installé sur ce PC : adresse et clé lues dans son config.xml (l'appli le règle toute seule)
      if (u.pathname === '/arr/conf') {
        res.setHeader('Content-Type', 'application/json');
        const fs = require('fs'), path = require('path'), env = process.env, out = {};
        for (const [n, port] of [['Prowlarr', 9696], ['Radarr', 7878], ['Sonarr', 8989]]) {
          for (const d of [env.ProgramData || 'C:\\ProgramData', env.LOCALAPPDATA, env.APPDATA].filter(Boolean)) {
            let x; try { x = fs.readFileSync(path.join(d, n, 'config.xml'), 'utf8'); } catch (e) { continue; }
            const tag = t => { const m = new RegExp('<' + t + '>([^<]*)</' + t + '>', 'i').exec(x); return m ? m[1].trim() : ''; };
            const key = tag('ApiKey'), base = tag('UrlBase').replace(/^\/+|\/+$/g, '');
            if (key) { out[n.toLowerCase()] = { url: 'http://127.0.0.1:' + (+tag('Port') || port) + (base ? '/' + base : ''), key }; break; }
          }
        }
        return res.end(JSON.stringify(out));
      }
      // installation ou mise à jour de la médiathèque (script PowerShell livré avec l'appli, fenêtre visible, droits demandés
      // par Windows) ; seulement depuis la page du lecteur
      if (u.pathname === '/outils/mediatheque' && req.method === 'POST') {
        const o = String(req.headers.origin || '');
        if (o && !/^https:\/\/(www\.)?franceinfoplanning\.com$/.test(o)) { res.statusCode = 403; return res.end('refusé'); }
        const ps = require('path').join(__dirname, '..', 'mediatheque', 'installer.ps1');
        if (!require('fs').existsSync(ps)) { res.statusCode = 404; return res.end('script absent'); }
        try { require('child_process').spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps], { detached: true, stdio: 'ignore', windowsHide: false }).unref(); res.end('ok'); }
        catch (e) { res.statusCode = 500; res.end(String(e.message || e)); }
        return;
      }
      // comme nslookup : vrai nom derrière un alias (CNAME) et adresses, pour les exceptions du VPN (serveur IPTV refusé)
      if (u.pathname === '/dns') {
        const dns = require('dns').promises, h0 = String(u.searchParams.get('h') || '').toLowerCase();
        res.setHeader('Content-Type', 'application/json');
        if (!/^[a-z0-9.-]{1,253}$/.test(h0)) return res.end(JSON.stringify({ error: 'nom invalide' }));
        (async () => {
          const alias = []; let name = h0;
          for (let k = 0; k < 5; k++) { const c = await dns.resolveCname(name).catch(() => null); if (!c || !c[0]) break; alias.push(c[0]); name = c[0]; }
          let ips = await dns.resolve4(name).catch(() => []);
          // secours (Windows, VPN) : nslookup, comme à la main ; « Nom / Name » = vrai serveur, puis ses adresses
          if (!alias.length && process.platform === 'win32') {
            const out = await new Promise(r => require('child_process').execFile('nslookup', [h0], { windowsHide: true, timeout: 6000 }, (e, so) => r(String(so || ''))));
            const ans = out.split(/\r?\n/), i = ans.findIndex(l => /^\s*(Nom|Name)\s*:/i.test(l));
            if (i >= 0) {
              const real = ans[i].split(':').slice(1).join(':').trim().toLowerCase();
              if (real && real !== h0) { alias.push(real); name = real; }
              for (let k = i + 1; k < ans.length && !/^\s*(Aliases|Alias)\s*:/i.test(ans[k]); k++) (ans[k].match(/\b\d{1,3}(\.\d{1,3}){3}\b/g) || []).forEach(x => { if (!ips.includes(x)) ips.push(x); });
            }
          }
          if (!ips.length) ips = (await dns.lookup(name, { all: true, family: 4 }).catch(() => [])).map(x => x.address);   // secours : résolveur de Windows
          res.end(JSON.stringify({ host: h0, alias, ips }));
        })().catch(e => res.end(JSON.stringify({ error: e.message })));
        return;
      }
      if (u.pathname === '/subs') {                                // sous-titres extraits jusqu'ici (le fichier grandit pendant la lecture)
        const f = SUBS.get(u.searchParams.get('id') || '');
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
        return fs.readFile(f || '', (e, b) => res.end(e ? 'WEBVTT\n' : b));
      }
      if (u.pathname.startsWith('/torrent/')) return torrentProxy(req, res);   // torrents fournis par l'utilisateur (processus séparé)
      if (u.pathname === '/sctop') { scTop(u.searchParams.get('k'), +u.searchParams.get('y')).then(j => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Access-Control-Allow-Origin', '*'); res.end(JSON.stringify(j)); }); return; }
      if (u.pathname === '/vlcinfo') { Promise.resolve(findVlc ? findVlc() : '').then(p => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: !!p })); }); return; }
      const src = u.searchParams.get('url') || '';
      if (!/^https?:\/\//i.test(src)) { res.statusCode = 400; return res.end(); }
      const via = u.searchParams.get('via') === 'vlc';
      if (via) {                                                   // même chemin, mais le film arrive par VLC
        Promise.resolve(findVlc ? findVlc() : '').then(p => {
          if (!p) { res.statusCode = 501; return res.end('vlc absent'); }
          if (u.pathname === '/probe') return probe(ffmpeg, src, p).then(j => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(j)); });
          if (u.pathname === '/remux') return remux(u, src, req, res, p);
          if (u.pathname === '/live') return live(src, req, res, p);
          res.statusCode = 404; res.end();
        });
        return;
      }
      if (u.pathname === '/live') return live(src, req, res, '');
      if (u.pathname === '/probe') {
        probe(ffmpeg, src).then(j => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(j)); });
        return;
      }
      if (u.pathname === '/thumb') return thumb(ffmpeg, src, Math.max(0, +u.searchParams.get('t') || 0), res);
      if (u.pathname === '/seekpt') { seekPoint(ffmpeg, src, Math.max(0, +u.searchParams.get('ss') || 0)).then(kf => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ kf })); }); return; }
      if (u.pathname !== '/remux') { res.statusCode = 404; return res.end(); }
      remux(u, src, req, res, '');
    });
    function remux(u, src, req, res, vlcPath) {
      const ss = Math.max(0, +u.searchParams.get('ss') || 0), a = Math.max(0, +u.searchParams.get('a') || 0);
      const enc = u.searchParams.get('v') === 'enc', hevc = u.searchParams.get('hevc') === '1';
      const args = ['-hide_banner', '-loglevel', 'error'];
      if (vlcPath) args.push('-f', 'mpegts', '-i', 'pipe:0');      // VLC a déjà démarré à ss secondes
      else {
        args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
        // image gardée telle quelle : elle ne peut partir que d'une image clé (jusqu'à ~10 s avant ss) ; sans
        // « noaccurate_seek », le son partait de ss et un trou au début de la piste son décalait le son de cet écart.
        // Le son part donc de la même image clé (la page demande d'abord laquelle à /seekpt, pour afficher la bonne position)
        if (ss) args.push(...(enc ? [] : ['-noaccurate_seek']), '-ss', String(ss));
        args.push('-i', src);
      }
      // par VLC, l'ordre des pistes audio peut changer d'une fois à l'autre : piste choisie par sa langue quand elle est connue
      const al = (u.searchParams.get('al') || '').toLowerCase();
      args.push('-map', '0:v:0', '-map', vlcPath && /^[a-z]{2,3}$/.test(al) ? '0:a:m:language:' + al + '?' : '0:a:' + a + '?', '-sn', '-dn');
      // image reconvertie (carte graphique qui ne lit pas le format, souvent du H.265 4K) : ramenée à 1080p au plus, et deux
      // cœurs du processeur laissés libres (une conversion 4K en temps réel occupait tout le processeur et figeait le PC)
      if (enc) args.push('-vf', "scale='min(1920,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-threads', String(Math.max(2, os.cpus().length - 2)));
      else { args.push('-c:v', 'copy'); if (hevc) args.push('-tag:v', 'hvc1'); }
      // décalage du son choisi dans le lecteur (ms) : positif = son retardé, négatif = son avancé
      const ad = Math.max(-10000, Math.min(10000, Math.round(+u.searchParams.get('ad') || 0)));
      if (ad) args.push('-af', 'asetpts=PTS' + (ad > 0 ? '+' : '-') + (Math.abs(ad) / 1000) + '/TB');
      args.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-frag_duration', '1000000', 'pipe:1');
      // Sous-titres intégrés : seconde sortie, en WebVTT dans un fichier temporaire lu par la page au fil de la lecture
      const sIdx = u.searchParams.get('s'), sid = u.searchParams.get('sid');
      let subFile = '';
      if (sIdx != null && sIdx !== '' && sid && /^[\w-]{4,40}$/.test(sid)) {
        subFile = path.join(os.tmpdir(), 'lecteur-iptv-' + sid + '.vtt');
        try { fs.writeFileSync(subFile, 'WEBVTT\n'); } catch (e) {}
        SUBS.set(sid, subFile);
        // calés sur l'image clé de départ (kf, donnée par la page) comme le film : sinon ffmpeg cale ce fichier sur le premier
        // sous-titre qui suit le point de départ, et les sous-titres arrivaient décalés (jusqu'à plusieurs secondes)
        const kf = +u.searchParams.get('kf'), so = ss && kf >= 0 && kf <= ss && u.searchParams.get('kf') !== null ? ss - kf : 0;
        args.push('-map', '0:s:' + (+sIdx), ...(so ? ['-output_ts_offset', String(so)] : []), '-avoid_negative_ts', 'disabled', '-c:s', 'webvtt', '-flush_packets', '1', '-f', 'webvtt', '-y', subFile);
      }
      const ff = spawn(ffmpeg, args, { windowsHide: true });
      if (vlcPath) viaVlc(ff, vlcSource(vlcPath, src, ss));
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store' });
      ff.stdout.pipe(res);
      ff.stderr.on('data', () => {});
      const kill = () => { try { ff.kill('SIGKILL'); } catch (e) {} if (subFile) setTimeout(() => { fs.unlink(subFile, () => {}); SUBS.delete(sid); }, 60000); };
      req.on('close', kill); res.on('close', kill);
      ff.on('exit', () => { try { res.end(); } catch (e) {} });
    }
    // Chaîne en direct dont le son (Dolby Digital AC-3 / E-AC-3) n'est pas lu par Chromium : image gardée telle quelle,
    // son converti en AAC stéréo, flux MPEG-TS lu par la page (mpegts.js)
    function live(src, req, res, vlcPath) {
      const args = ['-hide_banner', '-loglevel', 'error', '-fflags', '+genpts+discardcorrupt'];
      if (vlcPath) args.push('-f', 'mpegts', '-i', 'pipe:0');
      else {
        args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '5');
        // flux .ts (ou chaîne Xtream sans extension) : format imposé, certains serveurs l'annoncent mal
        if (!/\.m3u8(\?|$)/i.test(src)) args.push('-f', 'mpegts');
        args.push('-i', src);
      }
      args.push('-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn', '-c:v', 'copy', '-c:a', 'aac', '-ac', '2', '-b:a', '192k', '-f', 'mpegts', 'pipe:1');
      const ff = spawn(ffmpeg, args, { windowsHide: true });
      if (vlcPath) viaVlc(ff, vlcSource(vlcPath, src, 0));
      ff.stderr.on('data', () => {});
      ff.stdout.once('data', b => { if (res.writableEnded) return; res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Cache-Control': 'no-store' }); res.write(b); ff.stdout.pipe(res); });
      const kill = () => { try { ff.kill('SIGKILL'); } catch (e) {} };
      req.on('close', kill); res.on('close', kill);
      ff.on('exit', () => { if (!res.headersSent) { res.statusCode = 502; res.end(); } else try { res.end(); } catch (e) {} });
      ff.on('error', () => { if (!res.headersSent) { res.statusCode = 500; res.end(); } });
    }
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
};
