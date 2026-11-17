/* Rangement dans Ma médiathèque : un torrent terminé dans qBittorrent, de catégorie « films » ou « series », est importé
   par Radarr (films) ou Sonarr (séries) dans C:\Mediatheque\Films ou \Series (lien plutôt que copie : qBittorrent continue de
   partager le fichier d'origine), puis vu par Jellyfin. Les autres catégories ne sont jamais touchées.
   - Torrent lancé depuis l'appli : le titre exact est connu (fiche TMDB, gardé dans ranger.json par l'appli).
   - Torrent ajouté à la main dans qBittorrent avec la catégorie : reconnu d'après son nom par Radarr / Sonarr ; rangé
     seulement si la correspondance est sûre, sinon laissé (Activité › File d'attente de Radarr / Sonarr pour le faire à la main).
   Le film ou la série est ajouté à Radarr / Sonarr s'il n'y est pas (sans recherche ni téléchargement de leur part).
   Seuls les fichiers vidéo entièrement téléchargés sont importés (une saison peut n'être qu'en partie gardée).
   Appelé par l'appli (au lancement puis toutes les 10 min) et par qBittorrent à la fin d'un téléchargement, appli fermée :
     node ranger.js <empreinte>      (réglage « Lancer un programme externe » de qBittorrent, mis par l'appli si libre)
   Clés d'accès de Radarr et Sonarr lues dans leur config.xml sur ce PC ; rien n'est envoyé ailleurs. */
const fs = require('fs'), path = require('path'), os = require('os');

const HOME = path.join(process.env.LOCALAPPDATA || os.homedir(), 'LecteurIPTVNatif');
const HINTS = path.join(HOME, 'ranger.json'), DONE = path.join(HOME, 'ranger-fait.json'), LOG = path.join(HOME, 'ranger.log');
const VIDEO = /\.(mkv|mp4|avi|mov|m4v|webm|ts|m2ts|wmv|mpg|mpeg)$/i;
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (e) { return {}; } };
const writeJ = (f, o) => { try { fs.mkdirSync(HOME, { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); } catch (e) {} };
function log(m) { try { fs.mkdirSync(HOME, { recursive: true }); fs.appendFileSync(LOG, new Date().toISOString() + ' ' + m + '\n'); const st = fs.statSync(LOG); if (st.size > 200e3) fs.writeFileSync(LOG, fs.readFileSync(LOG, 'utf8').slice(-100e3)); } catch (e) {} }

// fiche connue d'un torrent lancé depuis l'appli : { kind: 'movie' | 'series', tmdb, title, year }
function hintSave(h, o) { if (!/^[0-9a-f]{40}$/i.test(h || '') || !o || !o.kind) return; const all = readJ(HINTS); all[h.toLowerCase()] = Object.assign(all[h.toLowerCase()] || {}, o, { at: Date.now() }); const k = Object.keys(all); if (k.length > 500) k.sort((a, b) => all[a].at - all[b].at).slice(0, k.length - 500).forEach(x => delete all[x]); writeJ(HINTS, all); }

/* ---------- qBittorrent (interface web locale) ---------- */
const QBT = 'http://127.0.0.1:8085';
let qCookie = '';
async function qbt(p, opts) {
  opts = opts || {};
  const go = () => fetch(QBT + p, { method: opts.method || 'GET', body: opts.body, signal: AbortSignal.timeout(10000), headers: qCookie ? { Cookie: qCookie } : {} });
  let r = await go();
  if (r.status === 401 || r.status === 403) {
    const mdp = (() => { try { return fs.readFileSync('C:\\Mediatheque\\qbittorrent-mdp.txt', 'utf8').trim(); } catch (e) { return ''; } })();
    if (mdp) { const l = await fetch(QBT + '/api/v2/auth/login', { method: 'POST', body: new URLSearchParams({ username: 'admin', password: mdp }) }); const c = (l.headers.get('set-cookie') || '').match(/SID=[^;]+/); if (c) qCookie = c[0]; r = await go(); }
  }
  if (!r.ok) throw new Error('qBittorrent répond ' + r.status);
  const t = await r.text(); try { return JSON.parse(t); } catch (e) { return t; }
}

/* ---------- Radarr / Sonarr ---------- */
function arrConf(name, port) {
  const env = process.env, files = [path.join(env.ProgramData || 'C:\\ProgramData', name, 'config.xml'), env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, name, 'config.xml'), env.APPDATA && path.join(env.APPDATA, name, 'config.xml')].filter(Boolean);
  for (const f of files) {
    let x; try { x = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const tag = t => { const m = new RegExp('<' + t + '>([^<]*)</' + t + '>', 'i').exec(x); return m ? m[1].trim() : ''; };
    const key = tag('ApiKey'); if (!key) continue;
    const base = tag('UrlBase').replace(/\/+$/, ''), p = +tag('Port') || port;
    return { name, key, api: 'http://127.0.0.1:' + p + (base ? '/' + base.replace(/^\/+/, '') : '') + '/api/v3' };
  }
  return null;
}
async function arr(c, p, opts) {
  opts = opts || {};
  const r = await fetch(c.api + p, { method: opts.method || 'GET', body: opts.body ? JSON.stringify(opts.body) : undefined, signal: AbortSignal.timeout(30000),
    headers: Object.assign({ 'X-Api-Key': c.key }, opts.body ? { 'Content-Type': 'application/json' } : {}) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error(c.name + ' répond ' + r.status + ' ' + (j && (j.message || (j[0] && j[0].errorMessage)) || t.slice(0, 120)));
  return j;
}
const nrm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
async function addDefaults(c) {
  const [qp, rf] = await Promise.all([arr(c, '/qualityprofile'), arr(c, '/rootfolder')]);
  if (!qp || !qp.length || !rf || !rf.length) throw new Error(c.name + ' : profil de qualité ou dossier racine manquant');
  return { qualityProfileId: qp[0].id, rootFolderPath: rf[0].path };
}
// film dans Radarr (ajouté sans recherche s'il n'y est pas) : par son identifiant TMDB, sinon d'après le nom du torrent
async function radarrMovie(c, hint, name) {
  let tmdb = hint && hint.kind === 'movie' ? +hint.tmdb : 0;
  if (!tmdb) {
    const p = await arr(c, '/parse?title=' + encodeURIComponent(name)).catch(() => null);
    if (p && p.movie && p.movie.id) return p.movie;
    const pi = p && p.parsedMovieInfo, t = pi && (pi.movieTitles || [pi.movieTitle])[0], y = pi && pi.year;
    if (!t || !y) return null;
    const l = await arr(c, '/movie/lookup?term=' + encodeURIComponent(t + ' ' + y)).catch(() => []);
    const ok = (l || []).filter(m => m.year === y && (nrm(m.title) === nrm(t) || nrm(m.originalTitle) === nrm(t) || (m.alternateTitles || []).some(a => nrm(a.title) === nrm(t))));
    if (ok.length !== 1) return null;                     // pas sûr : on ne range pas
    tmdb = ok[0].tmdbId;
  }
  const have = await arr(c, '/movie?tmdbId=' + tmdb); if (have && have.length) return have[0];
  const look = await arr(c, '/movie/lookup/tmdb?tmdbId=' + tmdb); if (!look) return null;
  const d = await addDefaults(c);
  return arr(c, '/movie', { method: 'POST', body: Object.assign({}, look, d, { monitored: false, minimumAvailability: 'released', addOptions: { searchForMovie: false } }) });
}
// série dans Sonarr : par son identifiant TMDB (recherche par titre, puis comparaison), sinon d'après le nom du torrent
async function sonarrSeries(c, hint, name) {
  if (!(hint && hint.kind === 'series')) {
    const p = await arr(c, '/parse?title=' + encodeURIComponent(name)).catch(() => null);
    if (p && p.series && p.series.id) return p.series;
    const t = p && p.parsedEpisodeInfo && p.parsedEpisodeInfo.seriesTitle; if (!t) return null;
    const l = await arr(c, '/series/lookup?term=' + encodeURIComponent(t)).catch(() => []);
    const ok = (l || []).filter(s => nrm(s.title) === nrm(t) || (s.alternateTitles || []).some(a => nrm(a.title) === nrm(t)));
    if (ok.length !== 1) return null;
    hint = { tvdb: ok[0].tvdbId };
  }
  const all = await arr(c, '/series');
  let s = (all || []).find(x => (hint.tmdb && +x.tmdbId === +hint.tmdb) || (hint.tvdb && +x.tvdbId === +hint.tvdb));
  if (s) return s;
  let cand = null;
  if (hint.tvdb) cand = ((await arr(c, '/series/lookup?term=' + encodeURIComponent('tvdb:' + hint.tvdb)).catch(() => [])) || [])[0];
  else {
    for (const t of [hint.title, hint.orig].filter(Boolean)) {
      const l = (await arr(c, '/series/lookup?term=' + encodeURIComponent(t)).catch(() => [])) || [];
      cand = l.find(x => hint.tmdb && +x.tmdbId === +hint.tmdb) || l.find(x => nrm(x.title) === nrm(t) && (!hint.year || Math.abs((x.year || 0) - hint.year) <= 1));
      if (cand) break;
    }
  }
  if (!cand || !cand.tvdbId) return null;
  s = (all || []).find(x => +x.tvdbId === +cand.tvdbId); if (s) return s;
  const d = await addDefaults(c);
  const lp = await arr(c, '/languageprofile').catch(() => null);   // Sonarr 3 seulement
  if (Array.isArray(lp) && lp.length) d.languageProfileId = lp[0].id;
  return arr(c, '/series', { method: 'POST', body: Object.assign({}, cand, d, { monitored: false, seasonFolder: true, addOptions: { monitor: 'none', searchForMissingEpisodes: false, searchForCutoffUnmetEpisodes: false } }) });
}
// import par Radarr / Sonarr (mode copie : un lien quand c'est le même disque) des fichiers vidéo finis seulement
async function manualImport(c, folder, idField, id, doneFiles, hash) {
  const items = await arr(c, '/manualimport?folder=' + encodeURIComponent(folder) + '&' + idField + '=' + id + '&filterExistingFiles=true');
  const want = new Set(doneFiles.map(f => path.resolve(f).toLowerCase()));
  const files = (items || []).filter(i => want.has(path.resolve(i.path).toLowerCase()) && (idField !== 'seriesId' || (i.episodes || []).length))
    .map(i => Object.assign({ path: i.path, quality: i.quality, languages: i.languages, releaseGroup: i.releaseGroup, downloadId: hash.toUpperCase() },
      idField === 'seriesId' ? { seriesId: id, episodeIds: i.episodes.map(e => e.id) } : { movieId: id }));
  if (!files.length) return 0;
  await arr(c, '/command', { method: 'POST', body: { name: 'ManualImport', importMode: 'copy', files } });
  return files.length;
}

/* ---------- un torrent ---------- */
async function rangeOne(t) {
  const cat = String(t.category || '').toLowerCase(); if (cat !== 'films' && cat !== 'series') return 'catégorie ignorée';
  if (!(t.progress >= 1)) return 'pas fini';
  const files = await qbt('/api/v2/torrents/files?hash=' + t.hash); if (!Array.isArray(files)) return 'fichiers inconnus';
  const root = t.save_path, done = files.filter(f => VIDEO.test(f.name) && f.progress >= 1 && f.priority > 0).map(f => path.join(root, f.name));
  const DONEJ = readJ(DONE), prev = new Set((DONEJ[t.hash] && DONEJ[t.hash].f) || []), todo = done.filter(f => !prev.has(f));
  if (!todo.length) return 'déjà rangé';
  const hint = readJ(HINTS)[t.hash.toLowerCase()] || null;
  const folder = (t.content_path && fs.existsSync(t.content_path) && fs.statSync(t.content_path).isDirectory()) ? t.content_path : path.dirname(todo[0]);
  let n = 0;
  if (cat === 'films') {
    const c = arrConf('Radarr', 7878); if (!c) return 'Radarr introuvable';
    const m = await radarrMovie(c, hint, t.name); if (!m) return 'film non reconnu';
    n = await manualImport(c, folder, 'movieId', m.id, todo, t.hash);
  } else {
    const c = arrConf('Sonarr', 8989); if (!c) return 'Sonarr introuvable';
    const s = await sonarrSeries(c, hint, t.name); if (!s) return 'série non reconnue';
    n = await manualImport(c, folder, 'seriesId', s.id, todo, t.hash);
  }
  if (n) { DONEJ[t.hash] = { at: Date.now(), f: [...prev, ...todo] }; writeJ(DONE, DONEJ); }
  return n ? n + ' fichier(s) envoyé(s) au rangement' : 'rien d\'importable';
}
// tous les torrents finis des deux catégories (ou un seul, par son empreinte)
async function rangeAll(hash) {
  const q = hash ? '?hashes=' + hash.toLowerCase() : '';
  const l = await qbt('/api/v2/torrents/info' + q);
  const out = [];
  for (const t of Array.isArray(l) ? l : []) {
    if (!/^(films|series)$/i.test(t.category || '')) continue;
    try { const r = await rangeOne(t); out.push(t.name + ' : ' + r); if (!/ignorée|pas fini|déjà/.test(r)) log(t.name + ' : ' + r); }
    catch (e) { out.push(t.name + ' : ' + e.message); log(t.name + ' : erreur ' + e.message); }
  }
  return out;
}
/* qBittorrent lance ce script à la fin de chaque téléchargement (appli fermée) : réglage pris seulement s'il est libre
   (ou déjà le nôtre, chemin mis à jour) ; sinon on le signale et seul le rangement par l'appli fonctionne */
async function autorunSetup(nodeExe, script) {
  const p = await qbt('/api/v2/app/preferences');
  const want = '"' + nodeExe + '" "' + script + '" "%I"', cur = String(p.autorun_program || '');
  if (p.autorun_enabled && cur === want) return 'déjà en place';
  if (p.autorun_enabled && cur && !/ranger\.js/i.test(cur)) return 'occupé par un autre programme : ' + cur;
  await qbt('/api/v2/app/setPreferences', { method: 'POST', body: new URLSearchParams({ json: JSON.stringify({ autorun_enabled: true, autorun_program: want }) }) });
  return 'mis en place';
}
module.exports = { hintSave, rangeAll, autorunSetup, log };

// appel par qBittorrent : node ranger.js <empreinte>
if (require.main === module) {
  const h = process.argv[2] || '';
  setTimeout(() => process.exit(0), 120e3).unref();
  // qBittorrent appelle à la fin du téléchargement : Radarr / Sonarr doivent voir le torrent fini, petite attente
  setTimeout(() => rangeAll(/^[0-9a-f]{40}$/i.test(h) ? h : '').then(r => { log('fin de téléchargement ' + h + ' : ' + r.join(' ; ')); process.exit(0); }, e => { log('erreur ' + e.message); process.exit(1); }), 5000);
}
