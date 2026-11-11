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
const { spawn } = require('child_process');
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
      let vcodec = '', vprofile = '';
      lines.forEach((l, i) => {
        const v = l.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\(([a-z]{2,3}|\?\?\?)\))?: Video: (\w+)(?: \(([^)]*)\))?/);
        if (v && !vcodec) { vcodec = v[2]; vprofile = v[3] || ''; }
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
      // En cas d'échec : la cause donnée par ffmpeg (erreur HTTP du serveur, délai, format…)
      const err = lines.filter(l => /error|failed|denied|forbidden|refused|timed out|invalid|not found|\b[45]\d\d\b/i.test(l) && !/^\s*(Stream|Duration|Input|Metadata)/.test(l)).slice(-3).join(' · ').slice(0, 300);
      let verr = '';
      if (vlc && !vcodec) {                          // cause donnée par VLC (journal) : erreurs de connexion, format non pris en charge…
        try { verr = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(l => /error|warning.*(http|access|mux)/i.test(l)).map(l => l.replace(/^.*?(error|warning)\s*:\s*/i, '')).filter((l, i, a) => a.indexOf(l) === i).slice(-4).join(' · ').slice(0, 300); } catch (e) {}
      }
      if (log) setTimeout(() => fs.unlink(log, () => {}), 2000);
      resolve({ duration, vcodec, vprofile, audio, subs, ok: !!(duration || vcodec), err: vlc && !vcodec ? 'VLC n\'a rien pu lire' + (verr ? ' : ' + verr : '') : err, vlc: !!vlc });
    };
    ff.stderr.on('data', b => { txt += b; });
    ff.on('exit', done); ff.on('error', e => resolve({ ok: false, audio: [], err: 'ffmpeg ne démarre pas : ' + (e && e.message || e) }));
    setTimeout(() => { try { ff.kill('SIGKILL'); } catch (e) {} }, vlcPath ? 40000 : 25000);
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
      if (u.pathname === '/subs') {                                // sous-titres extraits jusqu'ici (le fichier grandit pendant la lecture)
        const f = SUBS.get(u.searchParams.get('id') || '');
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
        return fs.readFile(f || '', (e, b) => res.end(e ? 'WEBVTT\n' : b));
      }
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
        if (ss) args.push('-ss', String(ss));
        args.push('-i', src);
      }
      // par VLC, l'ordre des pistes audio peut changer d'une fois à l'autre : piste choisie par sa langue quand elle est connue
      const al = (u.searchParams.get('al') || '').toLowerCase();
      args.push('-map', '0:v:0', '-map', vlcPath && /^[a-z]{2,3}$/.test(al) ? '0:a:m:language:' + al + '?' : '0:a:' + a + '?', '-sn', '-dn');
      if (enc) args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p');
      else { args.push('-c:v', 'copy'); if (hevc) args.push('-tag:v', 'hvc1'); }
      args.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-frag_duration', '1000000', 'pipe:1');
      // Sous-titres intégrés : seconde sortie, en WebVTT dans un fichier temporaire lu par la page au fil de la lecture
      const sIdx = u.searchParams.get('s'), sid = u.searchParams.get('sid');
      let subFile = '';
      if (sIdx != null && sIdx !== '' && sid && /^[\w-]{4,40}$/.test(sid)) {
        subFile = path.join(os.tmpdir(), 'lecteur-iptv-' + sid + '.vtt');
        try { fs.writeFileSync(subFile, 'WEBVTT\n'); } catch (e) {}
        SUBS.set(sid, subFile);
        args.push('-map', '0:s:' + (+sIdx), '-c:s', 'webvtt', '-flush_packets', '1', '-f', 'webvtt', '-y', subFile);
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
