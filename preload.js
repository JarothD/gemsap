const { exec } = require("child_process")

const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener("DOMContentLoaded", () => {
    exec(`npm run cors-server`)
})

// Exponer funcionalidades específicas de forma segura
contextBridge.exposeInMainWorld('electronAPI', {
  // Comunicación IPC segura
  startServer: () => ipcRenderer.send('start-server'),
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (event, ...args) => callback(...args));
  },
  // Funciones específicas de la aplicación
  getVersion: () => process.versions.electron,
  platform: process.platform
});

// Exponer API de WebSocket
contextBridge.exposeInMainWorld('wss', {
  send: (message) => {
    if (window.WebSocket) {
      const ws = new WebSocket('ws://localhost:3002');
      ws.onopen = () => ws.send(message);
    }
  },
  onMessage: (callback) => {
    if (window.WebSocket) {
      const ws = new WebSocket('ws://localhost:3002');
      ws.onmessage = callback;
    }
  }
});