// Lecteur IPTV pour Windows : la page du lecteur (franceinfoplanning.com/iptv/) dans une fenêtre sans les limites du
// navigateur (serveurs IPTV qui refusent les navigateurs, flux en http sur la page en https).
const { app, BrowserWindow, session, shell, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const startRemux = require('./remux');

// ffmpeg livré avec l'appli (hors de l'archive app.asar pour pouvoir le lancer)
function ffmpegPath() {
  const packed = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(packed)) return packed;
  try { return require('ffmpeg-static'); } catch (e) { return 'ffmpeg'; }
}
let remuxBase = '';
ipcMain.on('remux-base', e => { e.returnValue = { remux: remuxBase, version: app.getVersion() }; });

// « VLC » : ouvre la chaîne ou le film directement dans VLC s'il est installé (dossiers habituels, sinon le registre Windows)
const { spawn, execFile } = require('child_process');
function findVlc() {
  const env = process.env, dirs = [env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432, env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs')].filter(Boolean);
  for (const d of dirs) { const f = path.join(d, 'VideoLAN', 'VLC', 'vlc.exe'); if (fs.existsSync(f)) return Promise.resolve(f); }
  if (process.platform !== 'win32') return Promise.resolve('');
  return new Promise(res => execFile('reg', ['query', 'HKLM\\SOFTWARE\\VideoLAN\\VLC', '/v', 'InstallDir'], { windowsHide: true }, (err, out) => {
    const m = !err && String(out).match(/InstallDir\s+REG_SZ\s+(.+)/); const f = m && path.join(m[1].trim(), 'vlc.exe');
    res(f && fs.existsSync(f) ? f : '');
  }));
}
ipcMain.handle('open-vlc', async (e, url, name) => {
  if (!/^https?:\/\//i.test(String(url || ''))) return false;
  const exe = await findVlc(); if (!exe) return false;
  try { spawn(exe, [url, ':meta-title=' + String(name || '').slice(0, 200)], { detached: true, stdio: 'ignore', windowsHide: false }).unref(); return true; } catch (err) { return false; }
});

const PAGE = 'https://franceinfoplanning.com/iptv/';
// Sites dont les en-têtes Origin / Referer sont gardés (le site, ses bibliothèques, le relais, YouTube pour les bandes-annonces)
const OWN = /^https?:\/\/(www\.)?franceinfoplanning\.com\/|^https:\/\/cdn\.jsdelivr\.net\/|^https:\/\/planning-gcal\.|^https:\/\/([a-z0-9-]+\.)*(youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com|google\.com|gstatic\.com)\//;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Pistes audio et vidéo des fichiers (films en plusieurs langues) accessibles à la page : choix de la langue
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');
// La page (en ligne) appelle le module de conversion local (127.0.0.1) : pas de blocage « réseau local »
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks');

// Taille et position de la fenêtre gardées d'une fois sur l'autre (fichier dans le dossier de l'appli du profil Windows)
const stateFile = () => path.join(app.getPath('userData'), 'fenetre.json');
function loadState() {
  try {
    const st = JSON.parse(fs.readFileSync(stateFile(), 'utf8')), b = st.bounds;
    if (!b || !(b.width >= 360 && b.height >= 500)) return null;
    // Toujours visible : si l'écran d'alors n'est plus branché, la fenêtre revient sur l'écran principal
    const wa = screen.getDisplayMatching(b).workArea;
    const visible = b.x < wa.x + wa.width - 80 && b.x + b.width > wa.x + 80 && b.y >= wa.y - 10 && b.y < wa.y + wa.height - 80;
    if (!visible) { delete b.x; delete b.y; }
    b.width = Math.min(b.width, wa.width); b.height = Math.min(b.height, wa.height);
    return { bounds: b, max: !!st.max };
  } catch (e) { return null; }
}
function keepState(win) {
  let t;
  const save = () => {
    try {
      if (win.isDestroyed() || win.isMinimized()) return;
      // getNormalBounds : la taille « normale », même si la fenêtre est agrandie ou en plein écran
      fs.writeFileSync(stateFile(), JSON.stringify({ bounds: win.getNormalBounds(), max: win.isMaximized() }));
    } catch (e) {}
  };
  const later = () => { clearTimeout(t); t = setTimeout(save, 500); };
  ['resize', 'move', 'maximize', 'unmaximize'].forEach(ev => win.on(ev, later));
  win.on('close', () => { clearTimeout(t); save(); });
}

function createWindow() {
  const st = loadState();
  const win = new BrowserWindow({
    width: 1400, height: 860, ...(st ? st.bounds : {}), minWidth: 360, minHeight: 500,
    // sans la barre de Windows : boutons réduire / agrandir / fermer dessinés par la page, en haut à droite
    frame: false,
    show: false, backgroundColor: '#1c1c1e', title: 'Lecteur IPTV', autoHideMenuBar: true, icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      webSecurity: false,                 // pas de blocage CORS : les serveurs IPTV n'autorisent pas les navigateurs
      allowRunningInsecureContent: true,  // flux en http depuis la page en https
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Fenêtre montrée seulement une fois l'écran de chargement (gris, logo) affiché : pas de fenêtre vide à l'ouverture
  let shown = false;
  // Windows dessine la fenêtre en blanc pendant son animation d'ouverture / d'agrandissement : elle est montrée
  // transparente, puis apparaît en fondu une fois en place
  const show = () => {
    if (shown || win.isDestroyed()) return; shown = true;
    try { win.setOpacity(0); } catch (e) {}
    if (st && st.max) win.maximize();
    win.show();
    setTimeout(() => {
      let o = 0;
      const t = setInterval(() => { o = Math.min(1, o + 0.15); try { if (!win.isDestroyed()) win.setOpacity(o); } catch (e) {} if (o >= 1) clearInterval(t); }, 16);
    }, 180);
  };
  win.once('ready-to-show', show);
  ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach(ev => win.on(ev, () => { try { win.webContents.send('win-state', { max: win.isMaximized(), full: win.isFullScreen() }); } catch (e) {} }));
  setTimeout(show, 4000);                       // site lent ou injoignable : on montre quand même
  keepState(win);

  // Vers les serveurs IPTV : pas d'en-têtes propres aux pages web (Origin, Referer), comme une appli de lecture
  session.defaultSession.webRequest.onBeforeSendHeaders((d, cb) => {
    const h = d.requestHeaders;
    if (!OWN.test(d.url) && !d.url.startsWith('file:')) { delete h.Origin; delete h.Referer; }
    // Serveur de l'app (relais des listes) : il n'accepte que les demandes venant du site
    else if (/^https:\/\/planning-gcal\./.test(d.url)) h.Origin = 'https://franceinfoplanning.com';
    cb({ requestHeaders: h });
  });

  // Liens vers d'autres sites : dans le navigateur habituel
  // (sauf connexion à Google / YouTube : dans une fenêtre de l'appli, pour que les bandes-annonces utilisent le compte)
  win.webContents.setWindowOpenHandler(({ url }) => { if (GLOGIN.test(url)) ytLogin(win, url); else shell.openExternal(url); return { action: 'deny' }; });
  // une bande-annonce qui voudrait emmener toute la page vers la connexion Google : fenêtre de connexion à la place
  win.webContents.on('will-navigate', (e, url) => { if (GLOGIN.test(url)) { e.preventDefault(); ytLogin(win, url); } });
  ipcMain.removeAllListeners('yt-login'); ipcMain.on('yt-login', () => ytLogin(win));

  // Page en ligne (toujours à jour) ; sans connexion au site, la copie livrée avec l'appli
  // (page redemandée au site à chaque lancement : jamais une ancienne copie gardée en cache)
  win.loadURL(PAGE, { extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n' }).catch(() => win.loadFile(path.join(__dirname, 'index.html')));
}

/* Connexion à YouTube (bandes-annonces) : derrière un VPN, YouTube demande souvent de se connecter pour prouver qu'on n'est
   pas un robot. Page de connexion Google dans une fenêtre de l'appli (même session : le compte sert ensuite aux lecteurs
   YouTube de la page) ; fenêtre fermée et page prévenue une fois revenu sur YouTube. */
const GLOGIN = /^https:\/\/(accounts\.google\.[a-z.]+|accounts\.youtube\.com)\/|^https:\/\/(www\.|m\.)?youtube\.com\/(signin|ServiceLogin)/i;
let ytWin = null;
function ytLogin(parent, url) {
  if (ytWin && !ytWin.isDestroyed()) { ytWin.focus(); return; }
  ytWin = new BrowserWindow({ width: 500, height: 720, parent, title: 'Connexion à YouTube', autoHideMenuBar: true, backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, sandbox: true } });
  const start = 'https://accounts.google.com/ServiceLogin?service=youtube&hl=fr&continue=' + encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&app=desktop&hl=fr&next=%2F');
  ytWin.loadURL(url && /accounts\.google\./.test(url) ? url : start);
  let ok = false;
  const check = (e, u) => { if (!ok && /^https:\/\/(www|m)\.youtube\.com\/?(\?|#|$|feed\/|index)/i.test(u)) { ok = true; setTimeout(() => { try { ytWin.close(); } catch (er) {} }, 300); } };
  ytWin.webContents.on('did-navigate', check);
  ytWin.webContents.on('did-redirect-navigation', (e) => check(e, e.url));
  ytWin.webContents.setWindowOpenHandler(({ url: u }) => { ytWin.loadURL(u); return { action: 'deny' }; });
  ytWin.on('closed', () => { ytWin = null; try { if (!parent.isDestroyed()) parent.webContents.send('yt-login', { ok }); } catch (e) {} });
}
/* ---------- mpv : lecteur vidéo intégré (films, épisodes, torrents) ----------
   Lit tout directement (Dolby, DTS, MKV, H.265, HDR), sans conversion par ffmpeg. mpv dessine dans une petite fenêtre sans
   bord posée exactement sur la zone du lecteur de la page (la page envoie sa position) ; piloté par son canal de commande
   (position, pause, fin), relayé à la page. Échap ou Retour arrière : retour ; F ou double-clic : plein écran. Absent
   (mpv/mpv.exe) : la page garde l'ancien lecteur. */
const net = require('net');
const MPV = { proc: null, sock: null, buf: '', rect: null, page: null, st: {}, last: 0, geo: '', min: false };
const mpvExe = () => { const p = path.join(process.resourcesPath || '', 'mpv', 'mpv.exe'); return process.platform === 'win32' && fs.existsSync(p) ? p : ''; };
ipcMain.on('mpv-avail', e => { e.returnValue = !!mpvExe(); });
// mpv a sa propre fenêtre sans bord, posée exactement sur la zone du lecteur de la page (en pixels réels de l'écran).
// (Incrustée dans une fenêtre de l'appli, l'image restait noire : Windows dessinait le fond de la fenêtre par-dessus la vidéo.)
function mpvGeo() {
  const page = MPV.page, r = MPV.rect; if (!page || page.isDestroyed()) return '';
  if (!r || r.hidden || r.w < 10 || r.h < 10 || page.isMinimized() || !page.isVisible()) return '';
  const cb = page.getContentBounds(), z = page.webContents.getZoomFactor();
  let q = { x: Math.round(cb.x + r.x * z), y: Math.round(cb.y + r.y * z), width: Math.round(r.w * z), height: Math.round(r.h * z) };
  try { q = screen.dipToScreenRect(page, q); } catch (e) {}
  return q.width + 'x' + q.height + (q.x < 0 ? '-' : '+') + Math.abs(q.x) + (q.y < 0 ? '-' : '+') + Math.abs(q.y);
}
function mpvBounds() {
  if (!MPV.sock) return;
  const g = mpvGeo();
  if (!g) { if (!MPV.min) { MPV.min = true; mpvCmd(['set_property', 'window-minimized', true]); } return; }
  if (MPV.min) { MPV.min = false; mpvCmd(['set_property', 'window-minimized', false]); }
  if (g !== MPV.geo) { MPV.geo = g; mpvCmd(['set_property', 'geometry', g]); }
}
function mpvSend(o) { try { if (MPV.page && !MPV.page.isDestroyed()) MPV.page.webContents.send('mpv', o); } catch (e) {} }
function mpvCmd(args) { try { if (MPV.sock) MPV.sock.write(JSON.stringify({ command: args }) + '\n'); } catch (e) {} }
function mpvStop() {
  const p = MPV.proc; MPV.proc = null;
  try { if (MPV.sock) MPV.sock.destroy(); } catch (e) {} MPV.sock = null;
  if (p) { try { p.kill(); } catch (e) {} }
}
const mpvHooked = new WeakSet();
ipcMain.on('mpv-stop', () => mpvStop());
ipcMain.on('mpv-rect', (e, r) => { MPV.rect = r; mpvBounds(); });
ipcMain.on('mpv-cmd', (e, args) => { if (Array.isArray(args)) mpvCmd(args); });
ipcMain.handle('mpv-play', async (e, o) => {
  const exe = mpvExe(); if (!exe) return { error: 'mpv absent' };
  const page = BrowserWindow.fromWebContents(e.sender); if (!page) return { error: 'fenêtre' };
  mpvStop(); MPV.page = page; MPV.rect = o.rect || null; MPV.st = {}; MPV.geo = ''; MPV.min = false;
  if (!mpvHooked.has(page)) {
    mpvHooked.add(page);
    const follow = () => mpvBounds();
    ['move', 'resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'restore', 'minimize', 'show', 'hide'].forEach(ev => page.on(ev, follow));
    // au premier plan avec l'appli, mais pas par-dessus les autres programmes quand on change de fenêtre
    page.on('focus', () => mpvCmd(['set_property', 'ontop', true]));
    page.on('blur', () => mpvCmd(['set_property', 'ontop', false]));
  }
  const g0 = mpvGeo();
  const pipe = '\\\\.\\pipe\\lecteur-mpv-' + process.pid + '-' + Date.now();
  const conf = path.join(app.getPath('temp'), 'lecteur-mpv-input.conf');
  try { fs.writeFileSync(conf, ['ESC script-message lecteur-back', 'BS script-message lecteur-back', 'q script-message lecteur-back', 'f script-message lecteur-fs', 'MBTN_LEFT_DBL script-message lecteur-fs'].join('\n')); } catch (er) {}
  const lang = { fr: 'fre,fra,fr,french', en: 'eng,en' }, al = lang[o.alang] || (o.alang ? o.alang : 'fre,fra,fr');
  const args = [o.url, '--no-border', '--ontop', '--force-window=yes', '--auto-window-resize=no', '--keepaspect-window=no', '--show-in-taskbar=no', '--snap-window=no', '--title=Lecteur IPTV', g0 ? '--geometry=' + g0 : '--window-minimized=yes', '--input-ipc-server=' + pipe, '--input-conf=' + conf, '--force-media-title=' + String(o.title || '').slice(0, 200),
    '--hwdec=auto-safe', '--keep-open=yes', '--osc=yes', '--idle=no', '--cursor-autohide=1500', '--volume=' + Math.round(Math.max(0, Math.min(1, +o.vol || 0)) * 100),
    '--alang=' + al, o.slang && o.slang !== 'off' ? '--slang=' + (lang[o.slang] || o.slang) : '--sid=no', '--sub-auto=fuzzy', '--msg-level=all=no', '--no-terminal'];
  if (o.start > 1) args.push('--start=' + Math.floor(o.start));
  let proc;
  try { proc = spawn(exe, args, { windowsHide: true, stdio: 'ignore' }); } catch (er) { return { error: String(er.message || er) }; }
  MPV.proc = proc;
  proc.on('exit', () => { if (MPV.proc === proc) { MPV.proc = null; mpvSend({ exit: true, eof: !!MPV.st.eof, pos: MPV.st.pos || 0 }); } });
  // canal de commande : position, durée, pause, fin, et messages des raccourcis
  for (let k = 0; k < 40 && MPV.proc === proc && !MPV.sock; k++) {
    await new Promise(r => setTimeout(r, 150));
    await new Promise(res => { const c = net.connect(pipe, () => { MPV.sock = c; res(); }); c.on('error', () => res()); });
  }
  if (!MPV.sock) { if (MPV.proc === proc) mpvStop(); return { error: 'mpv ne répond pas' }; }
  const sock = MPV.sock;
  ['time-pos', 'duration', 'pause', 'eof-reached', 'aid', 'sid'].forEach((pr, i) => mpvCmd(['observe_property', i + 1, pr]));
  sock.on('data', b => {
    MPV.buf += b; let n;
    while ((n = MPV.buf.indexOf('\n')) >= 0) {
      const line = MPV.buf.slice(0, n); MPV.buf = MPV.buf.slice(n + 1); let m; try { m = JSON.parse(line); } catch (er) { continue; }
      if (m.event === 'property-change') {
        const key = { 'time-pos': 'pos', duration: 'dur', pause: 'paused', 'eof-reached': 'eof' }[m.name]; if (!key) continue;
        MPV.st[key] = m.data;
        if (key !== 'pos' || Date.now() - MPV.last > 1000) { MPV.last = Date.now(); mpvSend(Object.assign({}, MPV.st)); }
        if (key === 'eof' && m.data) mpvSend({ eof: true, pos: MPV.st.pos || 0, dur: MPV.st.dur || 0 });
      } else if (m.event === 'client-message' && m.args) {
        if (m.args[0] === 'lecteur-back') mpvSend({ back: true, pos: MPV.st.pos || 0 });
        else if (m.args[0] === 'lecteur-fs' && !page.isDestroyed()) page.setFullScreen(!page.isFullScreen());
      }
    }
  });
  sock.on('close', () => { if (MPV.sock === sock) MPV.sock = null; });
  MPV.min = !g0; MPV.geo = g0; mpvBounds();
  return { ok: true };
});
app.on('before-quit', () => mpvStop());
// Identité de navigateur ordinaire (Chrome), sans « Electron » ni le nom de l'appli : le lecteur YouTube des bandes-annonces
// se méfie d'Electron (« Connectez-vous pour confirmer que vous n'êtes pas un robot »)
app.userAgentFallback = app.userAgentFallback.replace(/\s(Electron|lecteur-iptv|Lecteur IPTV)\/[\w.-]+/gi, '');
// Identité Windows de l'appli : épinglage à la barre des tâches et regroupement des fenêtres
app.setAppUserModelId('com.franceinfoplanning.iptv');
// Mise à jour automatique : nouvelle version cherchée sur GitHub au lancement puis toutes les 6 h, téléchargée en arrière-plan,
// installée à la fermeture de l'appli (ou tout de suite si on accepte de redémarrer)
// L'état est montré dans le menu ☰ de la page (version, recherche, téléchargement en %, erreur) avec un bouton « Vérifier ».
let updState = { state: 'idle' };
function setupUpdates(win) {
  let autoUpdater;
  const send = st => { updState = Object.assign({ at: Date.now() }, st); try { if (!win.isDestroyed()) win.webContents.send('upd', updState); } catch (e) {} };
  try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { send({ state: 'error', msg: 'module de mise à jour absent' }); return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => send({ state: 'latest' }));
  autoUpdater.on('update-available', i => send({ state: 'downloading', version: i.version, pct: 0 }));
  autoUpdater.on('download-progress', p => send({ state: 'downloading', version: updState.version, pct: Math.round(p.percent || 0) }));
  // Mise à jour prête : proposée par la page, dans le style de l'appli (bandeau « Redémarrer maintenant / Plus tard »)
  autoUpdater.on('update-downloaded', info => send({ state: 'ready', version: info.version }));
  // latest.yml absent quelques secondes pendant la mise en ligne d'une nouvelle version : nouvel essai 2 min plus tard
  autoUpdater.on('error', e => { const msg = String(e && e.message || e).split('\n')[0].slice(0, 200);
    if (/latest\.yml|404/i.test(msg)) { send({ state: 'checking' }); setTimeout(check, 120e3); return; } send({ state: 'error', msg }); });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});   // erreurs traitées par l'évènement « error »
  ipcMain.on('upd-check', () => { if (updState.state === 'ready') autoUpdater.quitAndInstall(true, true); else if (updState.state !== 'downloading') check(); });
  setTimeout(check, 5000);
  setInterval(check, 6 * 3600e3);
}
ipcMain.on('upd-state', e => { e.returnValue = updState; });
// Boutons de fenêtre de la page (fenêtre sans barre de Windows)
ipcMain.on('win', (e, act) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (act === 'min') w.minimize();
  else if (act === 'max') { if (w.isMaximized()) w.unmaximize(); else w.maximize(); }
  else if (act === 'close') w.close();
});
ipcMain.on('win-max', e => { const w = BrowserWindow.fromWebContents(e.sender); e.returnValue = !!(w && w.isMaximized()); });

app.whenReady().then(async () => {
  try { remuxBase = 'http://127.0.0.1:' + await startRemux(ffmpegPath(), findVlc); } catch (e) {}
  createWindow();
  if (app.isPackaged) setupUpdates(BrowserWindow.getAllWindows()[0]); else updState = { state: 'error', msg: 'version de développement' };
});
app.on('window-all-closed', () => app.quit());
