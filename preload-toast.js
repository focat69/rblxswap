const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toastActions', {
  yes: (toastId) => ipcRenderer.send('toast-action', { action: 'yes', toastId }),
  no: (toastId) => ipcRenderer.send('toast-action', { action: 'no', toastId })
});
