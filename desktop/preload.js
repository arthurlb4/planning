// Donne à la page l'adresse du serveur local de conversion (films MKV) de l'appli Windows
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('remux-base');
contextBridge.exposeInMainWorld('desktop', typeof info === 'string' ? { remux: info } : info);
