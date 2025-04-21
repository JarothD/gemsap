const { contextBridge, ipcRenderer } = require('electron');

// API para la comunicación con el proceso principal
contextBridge.exposeInMainWorld('electronAPI', {
  // Servidor
  startServer: () => ipcRenderer.send('start-server'),
  onServerStatus: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('server-status', subscription);
    return () => ipcRenderer.removeListener('server-status', subscription);
  },
  
  // Información del sistema
  getVersion: () => process.versions.electron,
  platform: process.platform
});

// API mejorada para gestión de WebSockets
contextBridge.exposeInMainWorld('wsIPC', {
  // Enviar mensajes al proceso principal
  initialized: (data) => ipcRenderer.send('ws-initialized', data),
  disconnected: (data) => ipcRenderer.send('ws-disconnected', data),
  reconnectRequest: (data) => ipcRenderer.send('ws-reconnect-request', data),
  
  // Recibir mensajes del proceso principal
  onMakePassive: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ws-make-passive', subscription);
    return () => ipcRenderer.removeListener('ws-make-passive', subscription);
  },
  onActivate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ws-activate', subscription);
    return () => ipcRenderer.removeListener('ws-activate', subscription);
  },
  onReconnect: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ws-reconnect', subscription);
    return () => ipcRenderer.removeListener('ws-reconnect', subscription);
  },
  onDisconnect: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ws-disconnect', subscription);
    return () => ipcRenderer.removeListener('ws-disconnect', subscription);
  }
});

// API simplificada para compatibilidad con código anterior
contextBridge.exposeInMainWorld('wss', {
  // Enviar un mensaje al WebSocket
  send: (message) => {
    if (window.WebSocket) {
      try {
        // Utilizar la instancia de WebSocket centralizada si está disponible
        if (window.ElectronWSInstance && 
            window.ElectronWSInstance.send && 
            window.ElectronWSInstance.isConnected()) {
          window.ElectronWSInstance.send(message);
          return true;
        }
        
        // Fallback a crear un nuevo WebSocket
        const ws = new WebSocket('ws://localhost:3002');
        ws.onopen = () => {
          ws.send(message);
        };
        return ws;
      } catch (err) {
        console.error('Error sending WebSocket message:', err);
        return null;
      }
    }
    return null;
  },
  
  // Escuchar mensajes del WebSocket (para compatibilidad)
  onMessage: (callback) => {
    if (window.WebSocket) {
      try {
        // Utilizar la instancia centralizada si está disponible
        if (window.ElectronWSInstance && window.ElectronWSInstance.addMessageHandler) {
          return window.ElectronWSInstance.addMessageHandler(callback);
        }
        
        // Fallback a crear un nuevo WebSocket
        const ws = new WebSocket('ws://localhost:3002');
        ws.onmessage = callback;
        return ws;
      } catch (err) {
        console.error('Error setting up WebSocket listener:', err);
        return null;
      }
    }
    return null;
  }
});