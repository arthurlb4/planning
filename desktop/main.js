// Lecteur IPTV pour Windows : la page du lecteur (franceinfoplanning.com/iptv/) dans une fenêtre sans les limites du
// navigateur (serveurs IPTV qui refusent les navigateurs, flux en http sur la page en https).
const { app, BrowserWindow, session, shell, ipcMain } = require('electron');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 860, minWidth: 360, minHeight: 500,
    backgroundColor: '#161615', title: 'Lecteur IPTV', autoHideMenuBar: true, icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      webSecurity: false,                 // pas de blocage CORS : les serveurs IPTV n'autorisent pas les navigateurs
      allowRunningInsecureContent: true,  // flux en http depuis la page en https
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

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
  win.loadURL(PAGE).catch(() => win.loadFile(path.join(__dirname, 'index.html')));
}

// Identité Windows de l'appli : épinglage à la barre des tâches et regroupement des fenêtres
app.setAppUserModelId('com.franceinfoplanning.iptv');
app.whenReady().then(async () => {
  try { remuxBase = 'http://127.0.0.1:' + await startRemux(ffmpegPath()); } catch (e) {}
  createWindow();
});
app.on('window-all-closed', () => app.quit());
