const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getShops: () => ipcRenderer.invoke('shops:get'),
  saveShops: (shops) => ipcRenderer.invoke('shops:save', shops),
  clearSession: (id) => ipcRenderer.invoke('shops:clearSession', id)
});
