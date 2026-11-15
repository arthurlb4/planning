// Donne à la page l'adresse du serveur local de conversion (films MKV) de l'appli Windows, sa version et l'état des mises à jour
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('remux-base');
const base = typeof info === 'string' ? { remux: info } : info;
contextBridge.exposeInMainWorld('desktop', Object.assign({}, base, {
  updState: () => ipcRenderer.sendSync('upd-state'),
  onUpdate: cb => ipcRenderer.on('upd', (e, st) => cb(st)),
  checkUpdate: () => ipcRenderer.send('upd-check'),
  openVlc: (url, name) => ipcRenderer.invoke('open-vlc', url, name),
  ytLogin: () => ipcRenderer.send('yt-login'),
  mpv: ipcRenderer.sendSync('mpv-avail') ? {
    play: o => ipcRenderer.invoke('mpv-play', o), stop: () => ipcRenderer.send('mpv-stop'), rect: r => ipcRenderer.send('mpv-rect', r),
    cmd: a => ipcRenderer.send('mpv-cmd', a), on: cb => ipcRenderer.on('mpv', (e, st) => cb(st))
  } : null,
  onYtLogin: cb => ipcRenderer.on('yt-login', (e, st) => cb(st)),
  win: { act: a => ipcRenderer.send('win', a), isMax: () => ipcRenderer.sendSync('win-max'), onState: cb => ipcRenderer.on('win-state', (e, st) => cb(st)) }
}));
