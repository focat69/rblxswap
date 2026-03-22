const { contextBridge, ipcRenderer } = require('electron');

const withListener = (channel, callback) => {
  if (typeof callback !== 'function') {
    return () => undefined;
  }
  const wrapped = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
};

contextBridge.exposeInMainWorld('launcher', {
  version: process.versions.electron,
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (c) => ipcRenderer.invoke('set-config', c),
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  selectDir: () => ipcRenderer.invoke('select-directory'),
  scanWeblauncher: () => ipcRenderer.invoke('scan-weblauncher'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  runBypass: (weblauncherDir) => ipcRenderer.invoke('bypass:run', weblauncherDir),
  onLog: (callback) => withListener('bypass:log', callback),
  onStatus: (callback) => withListener('bypass:status', callback),
  onComplete: (callback) => withListener('bypass:complete', callback),

  getAdapters: () => ipcRenderer.invoke('mac:get-adapters'),
  getStats: () => ipcRenderer.invoke('mac:get-stats'),
  spoofMac: (desc, mac) => ipcRenderer.invoke('mac:spoof', desc, mac),
  resetMac: (desc) => ipcRenderer.invoke('mac:reset', desc),
  restartAdapter: (name) => ipcRenderer.invoke('mac:restart-adapter', name),
  dhcpRefresh: () => ipcRenderer.invoke('mac:dhcp-refresh')
});

