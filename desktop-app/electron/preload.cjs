const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('privateParse', {
  openPdf: () => ipcRenderer.invoke('file:open-pdf'),
  openPdfs: () => ipcRenderer.invoke('file:open-pdfs'),
  openSample: () => ipcRenderer.invoke('file:open-sample'),
  openSignatureImage: () => ipcRenderer.invoke('file:open-image'),
  openFont: () => ipcRenderer.invoke('file:open-font'),
  importVaultFont: () => ipcRenderer.invoke('font:vault-import'),
  listVaultFonts: () => ipcRenderer.invoke('font:vault-list'),
  readVaultFont: (id) => ipcRenderer.invoke('font:vault-read', id),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
  saveRecovery: (payload) => ipcRenderer.invoke('recovery:save', payload),
  getRecoveryInfo: () => ipcRenderer.invoke('recovery:info'),
  loadRecovery: () => ipcRenderer.invoke('recovery:load'),
  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),
  recognizeImage: (data) => ipcRenderer.invoke('ocr:recognize', data),
  onOcrProgress: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('ocr:progress', listener);
    return () => ipcRenderer.removeListener('ocr:progress', listener);
  },
  appInfo: () => ipcRenderer.invoke('app:info'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:state', listener);
    return () => ipcRenderer.removeListener('updates:state', listener);
  }
});
