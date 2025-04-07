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

// Mejorar el manejo de WebSocket
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