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
/* Lecteur intégré (essai) : la fenêtre de l'appli est transparente là où se trouve le lecteur, et mpv (même moteur que VLC)
   affiche la vidéo juste sous elle ; la page et ses commandes restent par-dessus. Réglage lu au lancement (fenêtre créée
   transparente ou non), changé depuis Paramètres › Lecture puis redémarrage. */
const nativeFile = () => path.join(app.getPath('userData'), 'native.json');
let NATIVE = false;
try { NATIVE = !!JSON.parse(fs.readFileSync(nativeFile(), 'utf8')).on; } catch (e) {}
ipcMain.on('native-get', e => { e.returnValue = NATIVE && process.platform === 'win32'; });
ipcMain.on('native-set', (e, on) => { try { fs.writeFileSync(nativeFile(), JSON.stringify({ on: !!on })); } catch (er) {} app.relaunch(); app.exit(0); });
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
    ...(NATIVE && process.platform === 'win32' ? { transparent: true } : {}),
    show: false, backgroundColor: NATIVE && process.platform === 'win32' ? '#00000000' : '#1c1c1e', title: 'Lecteur IPTV', autoHideMenuBar: true, icon: path.join(__dirname, 'icon.ico'),
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
    // serveurs IPTV : sans les en-têtes des pages web, et sous le vrai nom de l'appli (lecteur IPTV) plutôt qu'un navigateur
    if (!OWN.test(d.url) && !d.url.startsWith('file:')) { delete h.Origin; delete h.Referer; if (!/^http:\/\/127\.0\.0\.1/.test(d.url) && /\/(get|player_api|xmltv|panel_api)\.php|\/(live|movie|series|timeshift)\/|\.m3u8?(\?|$)|\.ts(\?|$)/i.test(d.url)) h['User-Agent'] = 'LecteurIPTV/' + app.getVersion() + ' (Windows)'; }
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
// VPN actif ? : une carte réseau de VPN (CyberGhost, WireGuard, OpenVPN…) allumée avec une adresse ; motif choisi possible
const VPN_RE = /cyberghost|wireguard|wintun|openvpn|tap-windows|\btap\b|\btun\b|vpn|nordlynx|proton|mullvad|surfshark/i;
ipcMain.on('vpn-state', (e, pat) => {
  let re = VPN_RE; if (pat) { try { re = new RegExp(String(pat).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); } catch (er) {} }
  const all = [], hit = [];
  try { Object.entries(require('os').networkInterfaces()).forEach(([n, l]) => { if (!(l || []).some(a => !a.internal)) return; all.push(n); if (re.test(n)) hit.push(n); }); } catch (er) {}
  e.returnValue = { on: hit.length > 0, name: hit[0] || '', all };
});
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
// position réelle à l'écran (pixels) de la zone du lecteur : { x, y, w, h } ou null
function mpvScreenRect() {
  const page = MPV.page, r = MPV.rect; if (!page || page.isDestroyed()) return null;
  if (!r || r.hidden || r.w < 10 || r.h < 10 || page.isMinimized() || !page.isVisible()) return null;
  const cb = page.getContentBounds(), z = page.webContents.getZoomFactor();
  let q = { x: Math.round(cb.x + r.x * z), y: Math.round(cb.y + r.y * z), width: Math.round(r.w * z), height: Math.round(r.h * z) };
  try { q = screen.dipToScreenRect(page, q); } catch (e) {}
  return q;
}
function mpvBounds() {
  if (MPV.under) {                                  // lecteur intégré : l'assistant place la fenêtre de mpv, juste sous l'appli
    const q = mpvScreenRect();
    if (!q) { if (!MPV.min) { MPV.min = true; mpvHelp('hide'); } return; }
    // débord de 3 px sous les barres de l'appli (pas de ligne qui laisse voir derrière), sans sortir de la fenêtre
    let cw = MPV.page.getContentBounds(); try { cw = screen.dipToScreenRect(MPV.page, cw); } catch (e) {}
    const x1 = Math.max(cw.x, q.x - 3), y1 = Math.max(cw.y, q.y - 3), x2 = Math.min(cw.x + cw.width, q.x + q.width + 3), y2 = Math.min(cw.y + cw.height, q.y + q.height + 3);
    const g = [x1, y1, x2 - x1, y2 - y1].join(' ');
    if (MPV.min) { MPV.min = false; mpvHelp('show'); MPV.geo = ''; }
    if (g !== MPV.geo) { MPV.geo = g; mpvHelp('place ' + g); }
    return;
  }
  if (!MPV.sock) return;
  const g = mpvGeo();
  if (!g) { if (!MPV.min) { MPV.min = true; mpvVis(false); } return; }
  if (MPV.min) { MPV.min = false; mpvVis(true); }
  if (g !== MPV.geo) { MPV.geo = g; mpvCmd(['set_property', 'geometry', g]); }
}
function mpvHelp(line) { const h = MPV.helper; if (h && MPV.ready) { try { h.stdin.write(line + '\n'); } catch (e) {} } else MPV.queue = line.startsWith('place') ? line : MPV.queue; }
function mpvVis(show) {
  if (MPV.owned && MPV.helper) { try { MPV.helper.stdin.write(show ? 'show\n' : 'hide\n'); } catch (e) {} if (show) mpvCmd(['set_property', 'window-minimized', false]); }
  else mpvCmd(['set_property', 'window-minimized', !show]);
}
/* Fenêtre de mpv rattachée à celle de l'appli (fenêtre « possédée », comme une boîte de dialogue) : pas d'icône à part dans la
   barre des tâches, toujours juste au-dessus de l'appli et jamais devant les autres programmes, réduite avec elle.
   Petit assistant PowerShell (appels Windows standard) qui reste ouvert pendant la lecture pour masquer / montrer la fenêtre. */
const OWN_PS = `Add-Type @"
using System; using System.Runtime.InteropServices;
public static class LecteurW {
  public delegate bool EP(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EP f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  public static IntPtr Find(uint pid) { IntPtr r = IntPtr.Zero; EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { r = h; return false; } return true; }, IntPtr.Zero); return r; }
}
"@
$h = [IntPtr]::Zero
for ($i = 0; $i -lt 150 -and $h -eq [IntPtr]::Zero; $i++) { $h = [LecteurW]::Find([uint32]$args[0]); if ($h -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 100 } }
if ($h -eq [IntPtr]::Zero) { exit 1 }
[void][LecteurW]::ShowWindow($h, 0)
[void][LecteurW]::SetWindowLongPtr($h, -8, [IntPtr][int64]$args[1])
[void][LecteurW]::ShowWindow($h, 8)
[Console]::Out.WriteLine('ok'); [Console]::Out.Flush()
while ($null -ne ($l = [Console]::In.ReadLine())) { if ($l -eq 'hide') { [void][LecteurW]::ShowWindow($h, 0) } elseif ($l -eq 'show') { [void][LecteurW]::ShowWindow($h, 8) } }
`;
/* Lecteur intégré : fenêtre de mpv sans icône (fenêtre outil), placée et redimensionnée par l'assistant juste sous la fenêtre
   de l'appli (jamais devant elle ni devant les autres programmes) ; l'appli garde le clavier et la souris. */
const UNDER_PS = `Add-Type @"
using System; using System.Runtime.InteropServices;
public static class LecteurU {
  public delegate bool EP(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EP f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr h, int i);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr v);
  public static IntPtr Find(uint pid) { IntPtr r = IntPtr.Zero; EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { r = h; return false; } return true; }, IntPtr.Zero); return r; }
}
"@
# positions en vrais pixels de l'écran (sinon, sur un écran agrandi à 150 %, 200 %, 300 %…, Windows les agrandit une seconde fois)
try { [void][LecteurU]::SetProcessDpiAwarenessContext([IntPtr](-4)) } catch {}
try { [void][LecteurU]::SetThreadDpiAwarenessContext([IntPtr](-4)) } catch {}
$h = [IntPtr]::Zero; $page = [IntPtr][int64]$args[1]
for ($i = 0; $i -lt 150 -and $h -eq [IntPtr]::Zero; $i++) { $h = [LecteurU]::Find([uint32]$args[0]); if ($h -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 100 } }
if ($h -eq [IntPtr]::Zero) { exit 1 }
[void][LecteurU]::ShowWindow($h, 0)
$ex = [int64][LecteurU]::GetWindowLongPtr($h, -20); $ex = ($ex -bor 0x80 -bor 0x08000000) -band (-bnot 0x40000)
[void][LecteurU]::SetWindowLongPtr($h, -20, [IntPtr]$ex)
[void][LecteurU]::SetWindowPos($h, $page, 0, 0, 0, 0, 0x0013)
[void][LecteurU]::ShowWindow($h, 4)
[void][LecteurU]::SetForegroundWindow($page)
[Console]::Out.WriteLine('ok'); [Console]::Out.Flush()
while ($null -ne ($l = [Console]::In.ReadLine())) {
  $a = $l.Split(' ')
  if ($a[0] -eq 'place') { [void][LecteurU]::SetWindowPos($h, $page, [int]$a[1], [int]$a[2], [int]$a[3], [int]$a[4], 0x0010) }
  elseif ($a[0] -eq 'below') { [void][LecteurU]::SetWindowPos($h, $page, 0, 0, 0, 0, 0x0013) }
  elseif ($a[0] -eq 'hide') { [void][LecteurU]::ShowWindow($h, 0) }
  elseif ($a[0] -eq 'show') { [void][LecteurU]::ShowWindow($h, 4); [void][LecteurU]::SetWindowPos($h, $page, 0, 0, 0, 0, 0x0013) }
}
`;
function mpvUnder(proc, page) {
  try {
    const f = path.join(app.getPath('temp'), 'lecteur-mpv-under.ps1'); fs.writeFileSync(f, UNDER_PS);
    const hb = page.getNativeWindowHandle(), ph = (hb.length >= 8 ? hb.readBigUInt64LE(0) : BigInt(hb.readUInt32LE(0))).toString();
    const ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', f, String(proc.pid), ph], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    MPV.helper = ps; MPV.ready = false;
    ps.stdout.on('data', b => {
      if (!/ok/.test(String(b)) || MPV.proc !== proc) return;
      MPV.ready = true; MPV.geo = ''; MPV.min = false; mpvBounds();
      if (!page.isDestroyed()) page.focus();
    });
    ps.on('exit', () => { if (MPV.helper === ps) { MPV.helper = null; MPV.ready = false; } });
    ps.on('error', () => {});
  } catch (e) {}
}
function mpvOwn(proc, page) {
  try {
    const f = path.join(app.getPath('temp'), 'lecteur-mpv-own.ps1'); fs.writeFileSync(f, OWN_PS);
    const hb = page.getNativeWindowHandle(), owner = (hb.length >= 8 ? hb.readBigUInt64LE(0) : BigInt(hb.readUInt32LE(0))).toString();
    const ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', f, String(proc.pid), owner], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    MPV.helper = ps;
    ps.stdout.on('data', b => {
      if (!/ok/.test(String(b)) || MPV.proc !== proc) return;
      MPV.owned = true; mpvCmd(['set_property', 'ontop', false]); mpvVis(!MPV.min);
    });
    ps.on('exit', () => { if (MPV.helper === ps) { MPV.helper = null; if (MPV.owned) { MPV.owned = false; mpvCmd(['set_property', 'ontop', true]); } } });
    ps.on('error', () => {});
  } catch (e) {}
}
function mpvSend(o) { try { if (MPV.page && !MPV.page.isDestroyed()) MPV.page.webContents.send('mpv', o); } catch (e) {} }
function mpvCmd(args) { try { if (MPV.sock) MPV.sock.write(JSON.stringify({ command: args }) + '\n'); } catch (e) {} }
function mpvStop() {
  const p = MPV.proc; MPV.proc = null;
  try { if (MPV.sock) MPV.sock.destroy(); } catch (e) {} MPV.sock = null;
  if (p) { try { p.kill(); } catch (e) {} }
  const h = MPV.helper; MPV.helper = null; MPV.owned = false; MPV.ready = false; if (h) { try { h.kill(); } catch (e) {} }
}
const mpvHooked = new WeakSet();
ipcMain.on('mpv-stop', () => mpvStop());
ipcMain.on('mpv-rect', (e, r) => { MPV.rect = r; mpvBounds(); });
ipcMain.on('mpv-cmd', (e, args) => { if (Array.isArray(args)) mpvCmd(args); });
ipcMain.handle('mpv-play', async (e, o) => {
  const exe = mpvExe(); if (!exe) return { error: 'mpv absent' };
  const page = BrowserWindow.fromWebContents(e.sender); if (!page) return { error: 'fenêtre' };
  mpvStop(); MPV.page = page; MPV.rect = o.rect || null; MPV.st = {}; MPV.geo = ''; MPV.min = false; MPV.under = !!(NATIVE && o.under);
  if (!mpvHooked.has(page)) {
    mpvHooked.add(page);
    let mt = 0;
    const follow = () => {
      if (MPV.under) { mpvSend({ moving: true }); clearTimeout(mt); mt = setTimeout(() => { mpvBounds(); setTimeout(() => mpvSend({ moving: false }), 120); }, 180); }
      mpvBounds();
    };
    ['move', 'resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'restore', 'minimize', 'show', 'hide'].forEach(ev => page.on(ev, follow));
    // au premier plan avec l'appli, mais pas par-dessus les autres programmes quand on change de fenêtre
    // (sans rattachement seulement) au premier plan avec l'appli, pas par-dessus les autres programmes
    page.on('focus', () => { if (MPV.under) mpvHelp('below'); else if (!MPV.owned) mpvCmd(['set_property', 'ontop', true]); });
    page.on('blur', () => { if (!MPV.under && !MPV.owned) mpvCmd(['set_property', 'ontop', false]); });
  }
  const g0 = MPV.under ? (q => q ? q.width + 'x' + q.height + (q.x < 0 ? '-' : '+') + Math.abs(q.x) + (q.y < 0 ? '-' : '+') + Math.abs(q.y) : '')(mpvScreenRect()) : mpvGeo();
  const pipe = '\\\\.\\pipe\\lecteur-mpv-' + process.pid + '-' + Date.now();
  const conf = path.join(app.getPath('temp'), 'lecteur-mpv-input.conf');
  try { fs.writeFileSync(conf, ['ESC script-message lecteur-back', 'BS script-message lecteur-back', 'q script-message lecteur-back', 'f script-message lecteur-fs', 'MBTN_LEFT_DBL script-message lecteur-fs'].join('\n')); } catch (er) {}
  const lang = { fr: 'fre,fra,fr,french', en: 'eng,en' }, al = lang[o.alang] || (o.alang ? o.alang : 'fre,fra,fr');
  // lecteur intégré : pas de commandes de mpv (celles de la page sont par-dessus), pas de clavier ni de souris
  const under = MPV.under ? ['--osc=no', '--osd-level=0', '--input-default-bindings=no', '--input-vo-keyboard=no', '--no-input-cursor', '--cursor-autohide=no', '--background=color', '--background-color=#000000']
    .concat((Array.isArray(o.subArgs) ? o.subArgs : []).filter(a => /^--sub-[a-z-]+=[^\n\r]{0,80}$/.test(a))) : [];
  const args = [o.url, '--no-border', ...(MPV.under ? [] : ['--ontop']), '--force-window=yes', '--auto-window-resize=no', '--keepaspect-window=no', '--show-in-taskbar=no', '--snap-window=no', '--title=Lecteur IPTV', g0 ? '--geometry=' + g0 : '--window-minimized=yes', '--input-ipc-server=' + pipe, '--input-conf=' + conf, '--force-media-title=' + String(o.title || '').slice(0, 200),
    '--hwdec=auto-safe', '--keep-open=yes', '--osc=yes', '--idle=no', '--cursor-autohide=1500', '--volume=' + Math.round(Math.max(0, Math.min(1, +o.vol || 0)) * 100),
    '--alang=' + al, o.slang && o.slang !== 'off' ? '--slang=' + (lang[o.slang] || o.slang) : '--sid=no', '--sub-auto=fuzzy', '--msg-level=all=no', '--no-terminal'];
  if (o.start > 1) args.push('--start=' + Math.floor(o.start));
  if (MPV.under) { const i = args.indexOf('--osc=yes'); if (i >= 0) args.splice(i, 1); const j = args.indexOf('--cursor-autohide=1500'); if (j >= 0) args.splice(j, 1); args.push(...under); }
  let proc;
  try { proc = spawn(exe, args, { windowsHide: true, stdio: 'ignore' }); } catch (er) { return { error: String(er.message || er) }; }
  MPV.proc = proc;
  if (MPV.under) mpvUnder(proc, page); else mpvOwn(proc, page);
  proc.on('exit', () => { if (MPV.proc === proc) { MPV.proc = null; mpvSend({ exit: true, eof: !!MPV.st.eof, pos: MPV.st.pos || 0 }); } });
  // canal de commande : position, durée, pause, fin, et messages des raccourcis
  for (let k = 0; k < 40 && MPV.proc === proc && !MPV.sock; k++) {
    await new Promise(r => setTimeout(r, 150));
    await new Promise(res => { const c = net.connect(pipe, () => { MPV.sock = c; res(); }); c.on('error', () => res()); });
  }
  if (!MPV.sock) { if (MPV.proc === proc) mpvStop(); return { error: 'mpv ne répond pas' }; }
  const sock = MPV.sock;
  ['time-pos', 'duration', 'pause', 'eof-reached', 'aid', 'sid', 'track-list', 'chapter-list', 'volume', 'mute', 'demuxer-cache-time'].forEach((pr, i) => mpvCmd(['observe_property', i + 1, pr]));
  sock.on('data', b => {
    MPV.buf += b; let n;
    while ((n = MPV.buf.indexOf('\n')) >= 0) {
      const line = MPV.buf.slice(0, n); MPV.buf = MPV.buf.slice(n + 1); let m; try { m = JSON.parse(line); } catch (er) { continue; }
      if (m.event === 'property-change') {
        if (m.name === 'track-list') { mpvSend({ tracks: (m.data || []).map(t => ({ id: t.id, type: t.type, lang: t.lang || '', title: t.title || '', codec: t.codec || '', ch: t['demux-channel-count'] || 0, sel: !!t.selected, forced: !!t.forced, ext: !!t.external, w: t['demux-w'] || 0, h: t['demux-h'] || 0 })) }); continue; }
        if (m.name === 'chapter-list') { mpvSend({ chapters: (m.data || []).map(c => ({ start: c.time, title: c.title || '' })) }); continue; }
        const key = { 'time-pos': 'pos', duration: 'dur', pause: 'paused', 'eof-reached': 'eof', aid: 'aid', sid: 'sid', volume: 'vol', mute: 'mute', 'demuxer-cache-time': 'cache' }[m.name]; if (!key) continue;
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
  if (!MPV.under) { MPV.min = !g0; MPV.geo = g0; mpvBounds(); }
  if (MPV.owned) mpvCmd(['set_property', 'ontop', false]);
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
  ipcMain.on('upd-check', () => { if (updState.state === 'ready') { process.env.LECTEUR_MAJ = '1'; autoUpdater.quitAndInstall(true, true); } else if (updState.state !== 'downloading') check(); });
  setTimeout(check, 5000);
  setInterval(check, 6 * 3600e3);
}
ipcMain.on('upd-state', e => { e.returnValue = updState; });
// Boutons de fenêtre de la page (fenêtre sans barre de Windows)
ipcMain.on('win', (e, act) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (act === 'min') w.minimize();
  else if (act === 'max') {
    if (w._fakeMax) { w.setBounds(w._fakeMax); w._fakeMax = null; w.webContents.send('win-state', { max: false, full: w.isFullScreen() }); }
    else if (w.isMaximized()) w.unmaximize();
    else {
      w.maximize();
      // fenêtre transparente (lecteur intégré) : Windows ne l'agrandit pas toujours ; elle prend alors toute la zone de travail
      setTimeout(() => { if (!w.isDestroyed() && !w.isMaximized()) { w._fakeMax = w.getBounds(); w.setBounds(screen.getDisplayMatching(w.getBounds()).workArea); w.webContents.send('win-state', { max: true, full: w.isFullScreen() }); } }, 150);
    }
  }
  else if (act === 'close') w.close();
});
ipcMain.on('win-max', e => { const w = BrowserWindow.fromWebContents(e.sender); e.returnValue = !!(w && (w.isMaximized() || w._fakeMax)); });

app.whenReady().then(async () => {
  try { remuxBase = 'http://127.0.0.1:' + await startRemux(ffmpegPath(), findVlc); } catch (e) {}
  createWindow();
  if (app.isPackaged) setupUpdates(BrowserWindow.getAllWindows()[0]); else updState = { state: 'error', msg: 'version de développement' };
});
app.on('window-all-closed', () => app.quit());
