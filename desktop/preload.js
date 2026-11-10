// Donne à la page l'adresse du serveur local de conversion (films MKV) de l'appli Windows, sa version et l'état des mises à jour
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('remux-base');
const base = typeof info === 'string' ? { remux: info } : info;
contextBridge.exposeInMainWorld('desktop', Object.assign({}, base, {
  updState: () => ipcRenderer.sendSync('upd-state'),
  onUpdate: cb => ipcRenderer.on('upd', (e, st) => cb(st)),
  checkUpdate: () => ipcRenderer.send('upd-check'),
  openVlc: (url, name) => ipcRenderer.invoke('open-vlc', url, name)
}));
