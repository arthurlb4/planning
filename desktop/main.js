// Lecteur IPTV pour Windows : la page du lecteur (franceinfoplanning.com/iptv/) dans une fenêtre sans les limites du
// navigateur (serveurs IPTV qui refusent les navigateurs, flux en http sur la page en https).
const { app, BrowserWindow, session, shell, ipcMain, dialog, screen } = require('electron');
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
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  // Page en ligne (toujours à jour) ; sans connexion au site, la copie livrée avec l'appli
  // (page redemandée au site à chaque lancement : jamais une ancienne copie gardée en cache)
  win.loadURL(PAGE, { extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n' }).catch(() => win.loadFile(path.join(__dirname, 'index.html')));
}

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
  autoUpdater.on('update-downloaded', info => {
    send({ state: 'ready', version: info.version });
    dialog.showMessageBox(win, { type: 'info', buttons: ['Redémarrer maintenant', 'Plus tard'], defaultId: 0, cancelId: 1,
      title: 'Mise à jour', message: 'La version ' + info.version + ' du Lecteur IPTV est prête.', detail: 'Elle s\'installera à la fermeture de l\'appli, ou tout de suite en redémarrant.' })
      .then(r => { if (r.response === 0) autoUpdater.quitAndInstall(true, true); });
  });
  autoUpdater.on('error', e => send({ state: 'error', msg: String(e && e.message || e).split('\n')[0].slice(0, 200) }));
  const check = () => autoUpdater.checkForUpdates().catch(e => send({ state: 'error', msg: String(e && e.message || e).split('\n')[0].slice(0, 200) }));
  ipcMain.on('upd-check', () => { if (updState.state === 'ready') autoUpdater.quitAndInstall(true, true); else if (updState.state !== 'downloading') check(); });
  setTimeout(check, 5000);
  setInterval(check, 6 * 3600e3);
}
ipcMain.on('upd-state', e => { e.returnValue = updState; });

app.whenReady().then(async () => {
  try { remuxBase = 'http://127.0.0.1:' + await startRemux(ffmpegPath()); } catch (e) {}
  createWindow();
  if (app.isPackaged) setupUpdates(BrowserWindow.getAllWindows()[0]); else updState = { state: 'error', msg: 'version de développement' };
});
app.on('window-all-closed', () => app.quit());
