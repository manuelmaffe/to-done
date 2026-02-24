const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  /** Open the app as a full resizable window */
  expandWindow: () => ipcRenderer.send('expand-window'),
  /** Receive todone:// deep link URLs (auth callbacks) */
  onAuthDeepLink: (callback) => ipcRenderer.on('auth-deep-link', (_, url) => callback(url)),
});
