// Donne à la page l'adresse du serveur local de conversion (films MKV) de l'appli Windows
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', { remux: ipcRenderer.sendSync('remux-base') });
