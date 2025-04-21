const { contextBridge, ipcRenderer } = require('electron');

// Remover el evento DOMContentLoaded que usa child_process
contextBridge.exposeInMainWorld('electronAPI', {
  startServer: () => ipcRenderer.send('start-server'),
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (event, ...args) => callback(...args));
  },
  getVersion: () => process.versions.electron,
  platform: process.platform
});

// Enhanced WebSocket IPC communication
contextBridge.exposeInMainWorld('wsIPC', {
  // Send messages to main process
  initialized: (data) => ipcRenderer.send('ws-initialized', data),
  disconnected: (data) => ipcRenderer.send('ws-disconnected', data),
  reconnectRequest: (data) => ipcRenderer.send('ws-reconnect-request', data),
  
  // Receive messages from main process
  onMakePassive: (callback) => {
    ipcRenderer.on('ws-make-passive', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('ws-make-passive', callback);
  },
  onActivate: (callback) => {
    ipcRenderer.on('ws-activate', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('ws-activate', callback);
  },
  onReconnect: (callback) => {
    ipcRenderer.on('ws-reconnect', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('ws-reconnect', callback);
  },
  onDisconnect: (callback) => {
    ipcRenderer.on('ws-disconnect', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('ws-disconnect', callback);
  }
});

// Legacy WebSocket API (maintained for backward compatibility)
contextBridge.exposeInMainWorld('wss', {
  send: (message) => {
    if (window.WebSocket) {
      const ws = new WebSocket('ws://localhost:3002');
      ws.onopen = () => ws.send(message);
      return ws;
    }
    return null;
  },
  onMessage: (callback) => {
    if (window.WebSocket) {
      const ws = new WebSocket('ws://localhost:3002');
      ws.onmessage = callback;
      return ws;
    }
    return null;
  }
});